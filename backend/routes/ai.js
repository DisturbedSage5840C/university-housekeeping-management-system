const express = require('express');
const db = require('../database/postgres');
const aiService = require('../services/aiService');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Check AI service status
router.get('/status', (req, res) => {
    res.json({
        available: aiService.isAvailable(),
        features: [
            'Complaint Analysis',
            'Smart Categorization',
            'Task Optimization',
            'Predictive Maintenance',
            'Response Suggestions',
            'Dashboard Insights',
        ],
    });
});

// Analyze a complaint
router.post('/analyze-complaint', async (req, res, next) => {
    try {
        const { category, room_number, description } = req.body;

        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }

        const analysis = await aiService.analyzeComplaint({ category, room_number, description });
        res.json(analysis);
    } catch (error) {
        next(error);
    }
});

// Auto-categorize complaint description
router.post('/categorize', async (req, res, next) => {
    try {
        const { description } = req.body;

        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }

        const result = await aiService.categorizeComplaint(description);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Get optimized task schedule for staff
router.get('/optimize-tasks', async (req, res, next) => {
    try {
        if (req.user.role !== 'staff') {
            return res.status(403).json({ error: 'Staff only' });
        }

        const rooms = await db('rooms')
            .select('id', 'room_number', 'status', 'floor_id')
            .where({ assigned_staff_id: req.user.id })
            .andWhere('status', '!=', 'cleaned');

        const complaints = await db('complaints')
            .select('id', 'category', 'room_number', 'priority')
            .where({ assigned_staff_id: req.user.id })
            .andWhere('status', '!=', 'resolved');

        const tasks = [
            ...rooms.map(r => ({ id: `room-${r.id}`, type: 'cleaning', ...r })),
            ...complaints.map(c => ({ id: `complaint-${c.id}`, type: 'complaint', ...c })),
        ];

        if (tasks.length === 0) {
            return res.json({ optimizedOrder: [], reasoning: 'No tasks assigned', estimatedTotalTime: '0 minutes' });
        }

        const optimized = await aiService.optimizeTaskSchedule(tasks, req.user.id);
        res.json(optimized);
    } catch (error) {
        next(error);
    }
});

// Get predictive maintenance insights
router.get('/predictions', requireRole('admin'), async (req, res, next) => {
    try {
        const history = await db('complaints')
            .select(
                'room_number',
                'category',
                db.raw('COUNT(*)::int as complaint_count'),
                db.raw('MAX(created_at) as last_complaint')
            )
            .where('created_at', '>=', db.raw("NOW() - INTERVAL '90 days'"))
            .groupBy('room_number', 'category')
            .orderBy('complaint_count', 'desc')
            .limit(50);

        const predictions = await aiService.predictMaintenanceNeeds(history);
        res.json(predictions);
    } catch (error) {
        next(error);
    }
});

// Get response suggestions for a complaint
router.get('/responses/:complaintId', requireRole('admin', 'staff'), async (req, res, next) => {
    try {
        const complaint = await db('complaints').where('id', req.params.complaintId).first();

        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const suggestions = await aiService.generateResponseSuggestions(complaint);
        res.json(suggestions);
    } catch (error) {
        next(error);
    }
});

// Get dashboard insights
router.get('/insights', requireRole('admin'), async (req, res, next) => {
    try {
        const totalRooms = await db('rooms').count('* as count').first();
        const cleanedToday = await db('rooms')
            .where({ status: 'cleaned' })
            .andWhere(db.raw("DATE(last_cleaned) = CURRENT_DATE"))
            .count('* as count')
            .first();
        const pendingComplaints = await db('complaints').where('status', 'pending').count('* as count').first();
        const inProgressComplaints = await db('complaints').where('status', 'in-progress').count('* as count').first();
        const resolvedThisWeek = await db('complaints')
            .where('status', 'resolved')
            .andWhere('resolved_at', '>=', db.raw("NOW() - INTERVAL '7 days'"))
            .count('* as count')
            .first();
        const avgResolution = await db('complaints')
            .where('status', 'resolved')
            .select(db.raw("COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600), 0)::numeric(10,1) as avg_hours"))
            .first();
        const staffCount = await db('users').where('role', 'staff').count('* as count').first();
        const residentCount = await db('users').where('role', 'resident').count('* as count').first();

        const stats = {
            totalRooms: parseInt(totalRooms.count),
            cleanedToday: parseInt(cleanedToday.count),
            pendingComplaints: parseInt(pendingComplaints.count),
            inProgressComplaints: parseInt(inProgressComplaints.count),
            resolvedThisWeek: parseInt(resolvedThisWeek.count),
            avgResolutionHours: parseFloat(avgResolution.avg_hours) || 0,
            staffCount: parseInt(staffCount.count),
            residentCount: parseInt(residentCount.count),
        };

        const insights = await aiService.generateDashboardInsights(stats);
        res.json({ stats, insights });
    } catch (error) {
        next(error);
    }
});

// Batch analyze multiple complaints
router.post('/batch-analyze', requireRole('admin'), async (req, res, next) => {
    try {
        const { complaint_ids } = req.body;

        if (!Array.isArray(complaint_ids) || complaint_ids.length === 0) {
            return res.status(400).json({ error: 'complaint_ids array required' });
        }

        const results = [];
        for (const id of complaint_ids.slice(0, 10)) {
            const complaint = await db('complaints').where('id', id).first();
            if (complaint) {
                const analysis = await aiService.analyzeComplaint(complaint);
                results.push({ id, analysis });

                await db('complaints').where('id', id).update({
                    ai_analysis: JSON.stringify(analysis),
                    ai_suggested_priority: analysis.ml_analysis?.priority?.priority || analysis.priority || null,
                });
            }
        }

        res.json({ analyzed: results.length, results });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
