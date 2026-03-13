const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/postgres');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const aiService = require('../services/aiService');
const cache = require('../services/cacheService');
const logger = require('../utils/logger');
const config = require('../config');

const router = express.Router();

// Setup multer for image uploads
const uploadDir = config.upload.dir;
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
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

// Get all complaints (admin sees all, staff sees assigned, resident sees own)
router.get('/', async (req, res, next) => {
    try {
        const { status, category, priority, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = db('complaints as c')
            .select(
                'c.*',
                'u.name as resident_name',
                's.name as assigned_staff_name'
            )
            .leftJoin('users as u', 'c.resident_id', 'u.id')
            .leftJoin('users as s', 'c.assigned_staff_id', 's.id');

        // Role-based filtering
        if (req.user.role === 'resident') {
            query = query.where('c.resident_id', req.user.id);
        } else if (req.user.role === 'staff') {
            query = query.where('c.assigned_staff_id', req.user.id);
        } else if (req.user.role === 'supervisor') {
            // Supervisor sees complaints from their assigned staff
            query = query.where(function() {
                this.where('c.assigned_staff_id', req.user.id)
                    .orWhereIn('c.assigned_staff_id', function() {
                        this.select('id').from('users').where('supervisor_id', req.user.id);
                    });
            });
        }

        if (status) query = query.where('c.status', status);
        if (category) query = query.where('c.category', category);
        if (priority) query = query.where('c.priority', priority);

        // Get total count for pagination
        const countQuery = query.clone().clearSelect().count('* as total').first();
        const { total } = await countQuery;

        const complaints = await query
            .orderBy('c.created_at', 'desc')
            .limit(parseInt(limit))
            .offset(offset);

        res.json({
            data: complaints,
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

// Get single complaint
router.get('/:id', async (req, res, next) => {
    try {
        const complaint = await db('complaints as c')
            .select('c.*', 'u.name as resident_name', 's.name as assigned_staff_name')
            .leftJoin('users as u', 'c.resident_id', 'u.id')
            .leftJoin('users as s', 'c.assigned_staff_id', 's.id')
            .where('c.id', req.params.id)
            .first();

        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        // Check access
        if (req.user.role === 'resident' && complaint.resident_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(complaint);
    } catch (error) {
        next(error);
    }
});

// Create new complaint (residents)
router.post('/', upload.single('image'), async (req, res, next) => {
    try {
        const { category, room_number, description, priority } = req.body;

        if (!category || !room_number || !description) {
            return res.status(400).json({ error: 'Category, room number, and description are required' });
        }

        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        // AI Analysis (calls Python AI service)
        let aiAnalysis = null;
        let suggestedPriority = priority || 'medium';
        let suggestedCategory = category;

        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        const mapPriority = (p) => {
            if (!p) return 'medium';
            const lower = p.toLowerCase();
            if (validPriorities.includes(lower)) return lower;
            if (lower === 'critical') return 'urgent';
            return 'medium';
        };

        try {
            const analysis = await aiService.analyzeComplaint({ category, room_number, description });
            aiAnalysis = analysis;
            suggestedPriority = mapPriority(analysis?.ml_analysis?.priority?.priority) || suggestedPriority;
            suggestedCategory = analysis?.ml_analysis?.category?.category || category;
        } catch (e) {
            logger.warn('AI analysis failed, using defaults', { error: e.message });
        }

        suggestedPriority = mapPriority(suggestedPriority);

        // Auto-assign to staff based on room's floor
        const room = await db('rooms').where({ room_number }).select('assigned_staff_id').first();
        const assignedStaffId = room?.assigned_staff_id || null;

        const [inserted] = await db('complaints').insert({
            category,
            room_number,
            description,
            status: 'pending',
            priority: suggestedPriority,
            resident_id: req.user.id,
            assigned_staff_id: assignedStaffId,
            image_url: imageUrl,
            ai_analysis: aiAnalysis ? JSON.stringify(aiAnalysis) : null,
            ai_suggested_priority: suggestedPriority,
            ai_suggested_category: suggestedCategory,
        }).returning('*');

        // Create notification for assigned staff
        if (assignedStaffId) {
            await db('notifications').insert({
                user_id: assignedStaffId,
                title: 'New Complaint Assigned',
                message: `New ${category} complaint in room ${room_number}: ${description.substring(0, 100)}`,
                type: 'warning',
            });
        }

        // Invalidate dashboard cache
        await cache.clearPattern('dashboard:*');

        logger.info('Complaint created', { id: inserted.id, category, room_number, priority: suggestedPriority });

        res.status(201).json(inserted);
    } catch (error) {
        next(error);
    }
});

// Update complaint status
router.put('/:id/status', async (req, res, next) => {
    try {
        const { status, resolution_notes } = req.body;
        const validStatuses = ['pending', 'in-progress', 'resolved'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const complaint = await db('complaints').where({ id: req.params.id }).first();
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        if (req.user.role === 'resident') {
            return res.status(403).json({ error: 'Residents cannot update complaint status' });
        }

        const updates = {
            status,
            updated_at: db.fn.now(),
        };

        if (resolution_notes) updates.resolution_notes = resolution_notes;
        if (status === 'resolved') updates.resolved_at = db.fn.now();

        await db('complaints').where({ id: req.params.id }).update(updates);

        // Notify resident
        await db('notifications').insert({
            user_id: complaint.resident_id,
            title: 'Complaint Update',
            message: `Your ${complaint.category} complaint is now ${status}`,
            type: status === 'resolved' ? 'success' : 'info',
        });

        await cache.clearPattern('dashboard:*');

        const updated = await db('complaints').where({ id: req.params.id }).first();
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// Assign complaint to staff (admin only)
router.put('/:id/assign', requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
        const { staff_id } = req.body;

        if (staff_id) {
            const staff = await db('users').where({ id: staff_id, role: 'staff' }).first();
            if (!staff) {
                return res.status(400).json({ error: 'Invalid staff ID' });
            }
        }

        await db('complaints')
            .where({ id: req.params.id })
            .update({ assigned_staff_id: staff_id || null, updated_at: db.fn.now() });

        if (staff_id) {
            const complaint = await db('complaints').where({ id: req.params.id }).first();
            await db('notifications').insert({
                user_id: staff_id,
                title: 'Complaint Assigned',
                message: `${complaint.category} complaint in room ${complaint.room_number} assigned to you`,
                type: 'warning',
            });
        }

        const updated = await db('complaints').where({ id: req.params.id }).first();
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// Update complaint priority
router.put('/:id/priority', requireRole('admin', 'supervisor', 'staff'), async (req, res, next) => {
    try {
        const { priority } = req.body;
        const validPriorities = ['low', 'medium', 'high', 'urgent'];

        if (!validPriorities.includes(priority)) {
            return res.status(400).json({ error: 'Invalid priority' });
        }

        await db('complaints')
            .where({ id: req.params.id })
            .update({ priority, updated_at: db.fn.now() });

        const updated = await db('complaints').where({ id: req.params.id }).first();
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// Delete complaint (resident can delete own complaint)
router.delete('/:id', async (req, res, next) => {
    try {
        const complaint = await db('complaints').where({ id: req.params.id }).first();
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const canDeleteOwn = req.user.role === 'resident' && complaint.resident_id === req.user.id;
        if (!canDeleteOwn) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db('complaints').where({ id: req.params.id }).del();
        await cache.clearPattern('dashboard:*');

        res.json({ success: true, id: complaint.id });
    } catch (error) {
        next(error);
    }
});

// Get my complaints (for residents)
router.get('/my/list', async (req, res, next) => {
    try {
        const complaints = await db('complaints')
            .where({ resident_id: req.user.id })
            .orderBy('created_at', 'desc');

        res.json(complaints);
    } catch (error) {
        next(error);
    }
});

// Get assigned complaints (for staff)
router.get('/assigned/list', async (req, res, next) => {
    try {
        if (req.user.role !== 'staff') {
            return res.status(403).json({ error: 'Staff only' });
        }

        const complaints = await db('complaints as c')
            .select('c.*', 'u.name as resident_name')
            .leftJoin('users as u', 'c.resident_id', 'u.id')
            .where('c.assigned_staff_id', req.user.id)
            .whereNot('c.status', 'resolved')
            .orderByRaw(`
                CASE c.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    ELSE 4 
                END
            `)
            .orderBy('c.created_at', 'desc');

        res.json(complaints);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
