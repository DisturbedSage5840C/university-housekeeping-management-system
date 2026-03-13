const express = require('express');
const db = require('../database/postgres');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all staff members (admin/supervisor)
router.get('/', requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
        let query = db('users')
            .select(
                'users.id', 'users.email', 'users.name', 'users.phone', 'users.role', 'users.shift', 'users.supervisor_id', 'users.created_at',
                db.raw('(SELECT COUNT(*) FROM rooms WHERE rooms.assigned_staff_id = users.id)::int as assigned_rooms'),
                db.raw("(SELECT COUNT(*) FROM complaints WHERE complaints.assigned_staff_id = users.id AND complaints.status != 'resolved')::int as pending_complaints")
            )
            .whereIn('users.role', ['staff', 'supervisor']);

        // Supervisor only sees their assigned staff
        if (req.user.role === 'supervisor') {
            query = query.where(function() {
                this.where('users.supervisor_id', req.user.id)
                    .orWhere('users.id', req.user.id);
            });
        }

        const staff = await query.orderBy('users.name');
        res.json(staff);
    } catch (error) {
        next(error);
    }
});

// Get single staff member with details
router.get('/:id', requireRole('admin'), async (req, res, next) => {
    try {
        const staff = await db('users')
            .select('id', 'email', 'name', 'phone', 'created_at')
            .where({ id: req.params.id, role: 'staff' })
            .first();

        if (!staff) {
            return res.status(404).json({ error: 'Staff not found' });
        }

        const floors = await db('floors').where('assigned_staff_id', req.params.id);

        const stats = await db('rooms')
            .select(
                db.raw("COUNT(CASE WHEN status = 'cleaned' THEN 1 END)::int as cleaned_today"),
                db.raw("COUNT(CASE WHEN status = 'in-progress' THEN 1 END)::int as in_progress"),
                db.raw('COUNT(*)::int as total_assigned')
            )
            .where('assigned_staff_id', req.params.id)
            .first();

        res.json({ ...staff, floors, stats });
    } catch (error) {
        next(error);
    }
});

// Assign floor to staff (admin only)
router.post('/:id/floors', requireRole('admin'), async (req, res, next) => {
    try {
        const { floor_id } = req.body;

        const staff = await db('users').where({ id: req.params.id, role: 'staff' }).first();
        if (!staff) {
            return res.status(404).json({ error: 'Staff not found' });
        }

        const floor = await db('floors').where('id', floor_id).first();
        if (!floor) {
            return res.status(404).json({ error: 'Floor not found' });
        }

        await db('floors').where('id', floor_id).update({ assigned_staff_id: req.params.id });
        await db('rooms').where('floor_id', floor_id).update({ assigned_staff_id: req.params.id });

        res.json({ message: 'Floor assigned successfully' });
    } catch (error) {
        next(error);
    }
});

// Remove floor assignment
router.delete('/:id/floors/:floorId', requireRole('admin'), async (req, res, next) => {
    try {
        await db('floors')
            .where({ id: req.params.floorId, assigned_staff_id: req.params.id })
            .update({ assigned_staff_id: null });

        await db('rooms')
            .where({ floor_id: req.params.floorId, assigned_staff_id: req.params.id })
            .update({ assigned_staff_id: null });

        res.json({ message: 'Floor unassigned successfully' });
    } catch (error) {
        next(error);
    }
});

// Get staff performance stats
router.get('/:id/performance', requireRole('admin'), async (req, res, next) => {
    try {
        const { days = 7 } = req.query;
        const daysInt = parseInt(days, 10) || 7;

        const performance = await db('cleaning_logs')
            .select(
                db.raw('DATE(created_at) as date'),
                db.raw('COUNT(*)::int as tasks_completed'),
                db.raw('COALESCE(SUM(duration_minutes), 0)::int as total_minutes')
            )
            .where('staff_id', req.params.id)
            .andWhere('created_at', '>=', db.raw(`NOW() - INTERVAL '${daysInt} days'`))
            .groupByRaw('DATE(created_at)')
            .orderBy('date', 'desc');

        const complaintResolutions = await db('complaints')
            .select(
                db.raw('COUNT(*)::int as resolved'),
                db.raw("COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600), 0)::numeric(10,1) as avg_hours_to_resolve")
            )
            .where({ assigned_staff_id: req.params.id, status: 'resolved' })
            .andWhere('resolved_at', '>=', db.raw(`NOW() - INTERVAL '${daysInt} days'`))
            .first();

        res.json({ daily_performance: performance, complaint_stats: complaintResolutions });
    } catch (error) {
        next(error);
    }
});

// Get all residents (admin only)
router.get('/residents/list', requireRole('admin'), async (req, res, next) => {
    try {
        const residents = await db('users')
            .select(
                'users.id', 'users.email', 'users.name', 'users.room_number', 'users.phone', 'users.created_at',
                db.raw('(SELECT COUNT(*) FROM complaints WHERE complaints.resident_id = users.id)::int as total_complaints')
            )
            .where('users.role', 'resident')
            .orderBy('users.room_number');

        res.json(residents);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
