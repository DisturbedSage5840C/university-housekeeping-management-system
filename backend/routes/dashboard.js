const express = require('express');
const db = require('../database/postgres');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get admin dashboard stats
router.get('/admin', requireRole('admin'), async (req, res, next) => {
    try {
        const roomStats = await db('rooms')
            .select(
                db.raw('COUNT(*)::int as total'),
                db.raw("COUNT(CASE WHEN status = 'cleaned' THEN 1 END)::int as cleaned"),
                db.raw("COUNT(CASE WHEN status = 'in-progress' THEN 1 END)::int as in_progress"),
                db.raw("COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending"),
                db.raw("COUNT(CASE WHEN status = 'needs-maintenance' THEN 1 END)::int as needs_maintenance")
            )
            .first();

        const complaintStats = await db('complaints')
            .select(
                db.raw('COUNT(*)::int as total'),
                db.raw("COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending"),
                db.raw("COUNT(CASE WHEN status = 'in-progress' THEN 1 END)::int as in_progress"),
                db.raw("COUNT(CASE WHEN status = 'resolved' THEN 1 END)::int as resolved"),
                db.raw("COUNT(CASE WHEN status = 'resolved' AND resolved_at >= NOW() - INTERVAL '7 days' THEN 1 END)::int as resolved_this_week")
            )
            .first();

        const staffCount = await db('users').whereIn('role', ['staff', 'supervisor']).count('* as count').first();
        const residentCount = await db('users').where('role', 'resident').count('* as count').first();

        // Washroom stats (if table exists)
        let washroomStats = { total: 0, needsCleaning: 0, restockedToday: 0 };
        try {
            const wStats = await db('washrooms')
                .select(
                    db.raw('COUNT(*)::int as total'),
                    db.raw("COUNT(CASE WHEN status = 'needs-cleaning' THEN 1 END)::int as needs_cleaning"),
                    db.raw("COUNT(CASE WHEN last_restocked >= CURRENT_DATE THEN 1 END)::int as restocked_today")
                )
                .first();
            washroomStats = { total: wStats.total, needsCleaning: wStats.needs_cleaning, restockedToday: wStats.restocked_today };
        } catch (e) { /* table may not exist yet */ }

        // Work verification stats
        let verificationStats = { pending: 0, approved: 0, rejected: 0 };
        try {
            const vStats = await db('work_submissions')
                .select(
                    db.raw("COUNT(CASE WHEN supervisor_approved IS NULL THEN 1 END)::int as pending"),
                    db.raw("COUNT(CASE WHEN supervisor_approved = true THEN 1 END)::int as approved"),
                    db.raw("COUNT(CASE WHEN supervisor_approved = false THEN 1 END)::int as rejected")
                )
                .first();
            verificationStats = { pending: vStats.pending, approved: vStats.approved, rejected: vStats.rejected };
        } catch (e) { /* table may not exist yet */ }

        const stats = {
            rooms: {
                total: roomStats.total,
                cleaned: roomStats.cleaned,
                inProgress: roomStats.in_progress,
                pending: roomStats.pending,
                needsMaintenance: roomStats.needs_maintenance,
            },
            complaints: {
                total: complaintStats.total,
                pending: complaintStats.pending,
                inProgress: complaintStats.in_progress,
                resolved: complaintStats.resolved,
                resolvedThisWeek: complaintStats.resolved_this_week,
            },
            washrooms: washroomStats,
            verification: verificationStats,
            staff: parseInt(staffCount.count),
            residents: parseInt(residentCount.count),
        };

        // Recent complaints
        const recentComplaints = await db('complaints as c')
            .select('c.*', 'u.name as resident_name')
            .leftJoin('users as u', 'c.resident_id', 'u.id')
            .orderBy('c.created_at', 'desc')
            .limit(5);

        // Today's cleaning progress by floor
        const floorProgress = await db('floors as f')
            .select(
                'f.id', 'f.name',
                db.raw('COUNT(r.id)::int as total_rooms'),
                db.raw("SUM(CASE WHEN r.status = 'cleaned' THEN 1 ELSE 0 END)::int as cleaned_rooms")
            )
            .leftJoin('rooms as r', 'r.floor_id', 'f.id')
            .groupBy('f.id', 'f.name');

        // Complaint trends (last 7 days)
        const complaintTrends = await db('complaints')
            .select(
                db.raw('DATE(created_at) as date'),
                db.raw('COUNT(*)::int as count'),
                db.raw("SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END)::int as resolved")
            )
            .where('created_at', '>=', db.raw("NOW() - INTERVAL '7 days'"))
            .groupByRaw('DATE(created_at)')
            .orderBy('date');

        res.json({ stats, recentComplaints, floorProgress, complaintTrends });
    } catch (error) {
        next(error);
    }
});

// Get staff dashboard
router.get('/staff', async (req, res, next) => {
    try {
        if (!['staff', 'supervisor'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Staff only' });
        }

        const myRooms = await db('rooms as r')
            .select('r.*', 'f.name as floor_name')
            .leftJoin('floors as f', 'r.floor_id', 'f.id')
            .where('r.assigned_staff_id', req.user.id)
            .orderBy('r.room_number');

        const myComplaints = await db('complaints as c')
            .select('c.*', 'u.name as resident_name')
            .leftJoin('users as u', 'c.resident_id', 'u.id')
            .where('c.assigned_staff_id', req.user.id)
            .andWhere('c.status', '!=', 'resolved')
            .orderByRaw("CASE c.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END")
            .orderBy('c.created_at');

        const todayStats = {
            totalRooms: myRooms.length,
            cleaned: myRooms.filter(r => r.status === 'cleaned').length,
            pending: myRooms.filter(r => r.status === 'pending').length,
            pendingComplaints: myComplaints.length,
        };

        res.json({ stats: todayStats, rooms: myRooms, complaints: myComplaints });
    } catch (error) {
        next(error);
    }
});

// Get supervisor dashboard
router.get('/supervisor', async (req, res, next) => {
    try {
        if (!['supervisor', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Supervisor only' });
        }

        // Get my staff
        const myStaff = await db('users')
            .select('id', 'name', 'email', 'shift', 'phone')
            .where('supervisor_id', req.user.id)
            .orderBy('name');

        const staffIds = myStaff.map(s => s.id);

        // Pending verifications
        let pendingQuery = db('work_submissions').whereNull('supervisor_approved');
        if (req.user.role === 'supervisor') {
            pendingQuery = pendingQuery.whereIn('staff_id', staffIds);
        }
        const pendingResult = await pendingQuery.count('* as count').first();

        // Approved today
        const approvedToday = await db('work_submissions')
            .where('supervisor_approved', true)
            .where('approved_by', req.user.id)
            .whereRaw("approved_at >= CURRENT_DATE")
            .count('* as count')
            .first();

        // Recent submissions needing review
        let submissionsQuery = db('work_submissions as ws')
            .select('ws.*', 'u.name as staff_name', 'w.label as washroom_label')
            .leftJoin('users as u', 'ws.staff_id', 'u.id')
            .leftJoin('washrooms as w', 'ws.washroom_id', 'w.id')
            .whereNull('ws.supervisor_approved')
            .orderBy('ws.created_at', 'desc')
            .limit(20);

        if (req.user.role === 'supervisor') {
            submissionsQuery = submissionsQuery.whereIn('ws.staff_id', staffIds);
        }
        const pendingSubmissions = await submissionsQuery;

        // My reminders
        const reminders = await db('reminders')
            .where('created_by', req.user.id)
            .where('is_active', true)
            .orderBy('next_due', 'asc');

        res.json({
            stats: {
                pendingVerifications: parseInt(pendingResult.count),
                approvedToday: parseInt(approvedToday.count),
                staffCount: myStaff.length,
            },
            staff: myStaff,
            pendingSubmissions,
            reminders,
        });
    } catch (error) {
        next(error);
    }
});

// Get resident dashboard
router.get('/resident', async (req, res, next) => {
    try {
        if (req.user.role !== 'resident') {
            return res.status(403).json({ error: 'Resident only' });
        }

        const myComplaints = await db('complaints')
            .where('resident_id', req.user.id)
            .orderBy('created_at', 'desc');

        const stats = {
            total: myComplaints.length,
            pending: myComplaints.filter(c => c.status === 'pending').length,
            inProgress: myComplaints.filter(c => c.status === 'in-progress').length,
            resolved: myComplaints.filter(c => c.status === 'resolved').length,
        };

        res.json({ stats, complaints: myComplaints });
    } catch (error) {
        next(error);
    }
});

// Get notifications
router.get('/notifications', async (req, res, next) => {
    try {
        const notifications = await db('notifications')
            .where('user_id', req.user.id)
            .orderBy('created_at', 'desc')
            .limit(20);

        const unreadResult = await db('notifications')
            .where({ user_id: req.user.id, read: false })
            .count('* as count')
            .first();

        res.json({ notifications, unreadCount: parseInt(unreadResult.count) });
    } catch (error) {
        next(error);
    }
});

// Mark notification as read
router.put('/notifications/:id/read', async (req, res, next) => {
    try {
        await db('notifications')
            .where({ id: req.params.id, user_id: req.user.id })
            .update({ read: true });
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Mark all notifications as read
router.put('/notifications/read-all', async (req, res, next) => {
    try {
        await db('notifications').where('user_id', req.user.id).update({ read: true });
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
