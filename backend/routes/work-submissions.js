const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/postgres');
const { requireRole } = require('../middleware/auth');
const config = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

// Setup multer for work proof uploads
const uploadDir = config.upload.dir;
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `work-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: config.upload.maxSize },
    fileFilter: (req, file, cb) => {
        if (config.upload.allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'));
        }
    }
});

// Get all work submissions (admin sees all, supervisor sees their staff, staff sees own)
router.get('/', async (req, res, next) => {
    try {
        const { status, building, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = db('work_submissions as ws')
            .select(
                'ws.*',
                'u.name as staff_name',
                'w.label as washroom_label',
                'a.name as approved_by_name'
            )
            .leftJoin('users as u', 'ws.staff_id', 'u.id')
            .leftJoin('washrooms as w', 'ws.washroom_id', 'w.id')
            .leftJoin('users as a', 'ws.approved_by', 'a.id');

        // Role-based filtering
        if (req.user.role === 'staff') {
            query = query.where('ws.staff_id', req.user.id);
        } else if (req.user.role === 'supervisor') {
            // Supervisor sees submissions from their staff
            const myStaff = await db('users').where('supervisor_id', req.user.id).select('id');
            const staffIds = myStaff.map(s => s.id);
            staffIds.push(req.user.id); // Include own submissions
            query = query.whereIn('ws.staff_id', staffIds);
        }

        if (building) query = query.where('ws.building', building);
        if (status === 'pending') {
            query = query.whereNull('ws.supervisor_approved');
        } else if (status === 'approved') {
            query = query.where('ws.supervisor_approved', true);
        } else if (status === 'rejected') {
            query = query.where('ws.supervisor_approved', false);
        }

        const countQuery = query.clone().clearSelect().count('* as total').first();
        const { total } = await countQuery;

        const submissions = await query
            .orderBy('ws.created_at', 'desc')
            .limit(parseInt(limit))
            .offset(offset);

        res.json({
            data: submissions,
            pagination: {
                total: parseInt(total),
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(parseInt(total) / parseInt(limit)),
            },
        });
    } catch (error) {
        next(error);
    }
});

// Submit work proof (staff and supervisors)
router.post('/', upload.single('image'), requireRole('staff', 'supervisor'), async (req, res, next) => {
    try {
        const { washroom_id, building, floor, task_type, notes } = req.body;

        if (!building || floor === undefined || !task_type) {
            return res.status(400).json({ error: 'Building, floor, and task type are required' });
        }

        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        // Simulated LLM verification (in production, call AI service)
        let llmVerified = false;
        let llmScore = 0;
        let llmFeedback = 'No image provided for verification';

        if (imageUrl) {
            // Simulate LLM analysis - in production this calls the AI microservice
            llmScore = 0.7 + Math.random() * 0.3; // 0.7 - 1.0
            llmVerified = llmScore >= 0.75;
            llmFeedback = llmVerified
                ? 'Image analysis confirms cleaning/restocking activity visible'
                : 'Image quality insufficient for verification, awaiting supervisor review';
        }

        const [inserted] = await db('work_submissions').insert({
            staff_id: req.user.id,
            washroom_id: washroom_id || null,
            building,
            floor: parseInt(floor),
            task_type,
            notes: notes || null,
            image_url: imageUrl,
            llm_verified: llmVerified,
            llm_score: parseFloat(llmScore.toFixed(2)),
            llm_feedback: llmFeedback,
        }).returning('*');

        // Notify supervisor
        const supervisor = await db('users')
            .where('id', function() {
                this.select('supervisor_id').from('users').where('id', req.user.id);
            })
            .first();

        if (supervisor) {
            await db('notifications').insert({
                user_id: supervisor.id,
                title: 'Work Proof Submitted',
                message: `${req.user.name} submitted ${task_type} proof for ${building} Floor ${floor}`,
                type: 'warning',
            });
        }

        logger.info('Work submission created', { id: inserted.id, staff: req.user.id, building, task_type });
        res.status(201).json(inserted);
    } catch (error) {
        next(error);
    }
});

// Supervisor approve/reject work submission
router.put('/:id/approve', requireRole('supervisor', 'admin'), async (req, res, next) => {
    try {
        const { approved, notes } = req.body;

        const submission = await db('work_submissions').where('id', req.params.id).first();
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Supervisor can only approve their own staff's submissions
        if (req.user.role === 'supervisor') {
            const staff = await db('users').where('id', submission.staff_id).first();
            if (staff && staff.supervisor_id !== req.user.id) {
                return res.status(403).json({ error: 'You can only approve submissions from your assigned staff' });
            }
        }

        await db('work_submissions').where('id', req.params.id).update({
            supervisor_approved: approved,
            approved_by: req.user.id,
            approved_at: db.fn.now(),
            approval_notes: notes || null,
            updated_at: db.fn.now(),
        });

        // Notify staff
        await db('notifications').insert({
            user_id: submission.staff_id,
            title: approved ? 'Work Approved ✅' : 'Work Rejected ❌',
            message: `Your ${submission.task_type} submission for ${submission.building} Floor ${submission.floor} was ${approved ? 'approved' : 'rejected'}${notes ? ': ' + notes : ''}`,
            type: approved ? 'success' : 'error',
        });

        const updated = await db('work_submissions').where('id', req.params.id).first();
        logger.info('Work submission reviewed', { id: req.params.id, approved, by: req.user.id });
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// Get pending verifications count
router.get('/pending/count', requireRole('supervisor', 'admin'), async (req, res, next) => {
    try {
        let query = db('work_submissions').whereNull('supervisor_approved');

        if (req.user.role === 'supervisor') {
            const myStaff = await db('users').where('supervisor_id', req.user.id).select('id');
            query = query.whereIn('staff_id', myStaff.map(s => s.id));
        }

        const result = await query.count('* as count').first();
        res.json({ pending: parseInt(result.count) });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
