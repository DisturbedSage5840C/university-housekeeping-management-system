const express = require('express');
const db = require('../database/postgres');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all rooms (with optional floor filter)
router.get('/', async (req, res, next) => {
    try {
        const { floor, status } = req.query;
        let query = db('rooms as r')
            .select('r.*', 'f.name as floor_name', 'u.name as assigned_staff_name')
            .leftJoin('floors as f', 'r.floor_id', 'f.id')
            .leftJoin('users as u', 'r.assigned_staff_id', 'u.id');

        if (floor) query = query.where('r.floor_id', floor);
        if (status) query = query.where('r.status', status);

        const rooms = await query.orderBy('r.room_number');
        res.json(rooms);
    } catch (error) {
        next(error);
    }
});

// Get rooms by floor grouped
router.get('/by-floor', async (req, res, next) => {
    try {
        const floors = await db('floors as f')
            .select('f.*', 'u.name as assigned_staff_name')
            .leftJoin('users as u', 'f.assigned_staff_id', 'u.id')
            .orderBy('f.id');

        const result = await Promise.all(floors.map(async (floor) => {
            const rooms = await db('rooms').where('floor_id', floor.id).orderBy('room_number');
            return { ...floor, rooms };
        }));

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Get single room
router.get('/:id', async (req, res, next) => {
    try {
        const room = await db('rooms as r')
            .select('r.*', 'f.name as floor_name', 'u.name as assigned_staff_name')
            .leftJoin('floors as f', 'r.floor_id', 'f.id')
            .leftJoin('users as u', 'r.assigned_staff_id', 'u.id')
            .where('r.id', req.params.id)
            .first();

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        res.json(room);
    } catch (error) {
        next(error);
    }
});

// Update room status (staff or admin)
router.put('/:id/status', async (req, res, next) => {
    try {
        const { status, notes } = req.body;
        const validStatuses = ['pending', 'in-progress', 'cleaned', 'needs-maintenance'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const room = await db('rooms').where('id', req.params.id).first();
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const updateData = {
            status,
            updated_at: db.fn.now(),
        };
        if (notes !== undefined) updateData.notes = notes;
        if (status === 'cleaned') updateData.last_cleaned = db.fn.now();

        await db('rooms').where('id', req.params.id).update(updateData);

        // Log the cleaning activity
        await db('cleaning_logs').insert({
            room_id: req.params.id,
            staff_id: req.user.id,
            status,
            notes: notes || null,
        });

        const updatedRoom = await db('rooms').where('id', req.params.id).first();
        res.json(updatedRoom);
    } catch (error) {
        next(error);
    }
});

// Assign room to staff (admin only)
router.put('/:id/assign', requireRole('admin'), async (req, res, next) => {
    try {
        const { staff_id } = req.body;

        if (staff_id) {
            const staff = await db('users').where({ id: staff_id, role: 'staff' }).first();
            if (!staff) {
                return res.status(400).json({ error: 'Invalid staff ID' });
            }
        }

        await db('rooms').where('id', req.params.id).update({
            assigned_staff_id: staff_id || null,
            updated_at: db.fn.now(),
        });

        const room = await db('rooms').where('id', req.params.id).first();
        res.json(room);
    } catch (error) {
        next(error);
    }
});

// Get rooms assigned to current staff
router.get('/my/tasks', async (req, res, next) => {
    try {
        if (!['staff', 'supervisor'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Staff only' });
        }

        const rooms = await db('rooms as r')
            .select('r.*', 'f.name as floor_name')
            .leftJoin('floors as f', 'r.floor_id', 'f.id')
            .where('r.assigned_staff_id', req.user.id)
            .orderBy('r.room_number');

        res.json(rooms);
    } catch (error) {
        next(error);
    }
});

// Get cleaning history for a room
router.get('/:id/history', async (req, res, next) => {
    try {
        const history = await db('cleaning_logs as cl')
            .select('cl.*', 'u.name as staff_name')
            .leftJoin('users as u', 'cl.staff_id', 'u.id')
            .where('cl.room_id', req.params.id)
            .orderBy('cl.created_at', 'desc')
            .limit(50);

        res.json(history);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
