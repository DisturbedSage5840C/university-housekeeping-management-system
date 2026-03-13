const express = require('express');
const db = require('../database/postgres');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all washrooms (grouped by building)
router.get('/', async (req, res, next) => {
    try {
        const { building, status } = req.query;
        let query = db('washrooms as w')
            .select('w.*', 'u.name as assigned_staff_name')
            .leftJoin('users as u', 'w.assigned_staff_id', 'u.id');

        if (building) query = query.where('w.building', building);
        if (status) query = query.where('w.status', status);

        const washrooms = await query.orderBy(['w.building', 'w.floor', 'w.direction']);
        res.json(washrooms);
    } catch (error) {
        next(error);
    }
});

// Get washrooms grouped by building
router.get('/by-building', async (req, res, next) => {
    try {
        const washrooms = await db('washrooms as w')
            .select('w.*', 'u.name as assigned_staff_name')
            .leftJoin('users as u', 'w.assigned_staff_id', 'u.id')
            .orderBy(['w.building', 'w.floor', 'w.direction']);

        // Group by building
        const grouped = {};
        washrooms.forEach(w => {
            if (!grouped[w.building]) grouped[w.building] = [];
            grouped[w.building].push(w);
        });

        res.json(grouped);
    } catch (error) {
        next(error);
    }
});

// Get single washroom
router.get('/:id', async (req, res, next) => {
    try {
        const washroom = await db('washrooms as w')
            .select('w.*', 'u.name as assigned_staff_name')
            .leftJoin('users as u', 'w.assigned_staff_id', 'u.id')
            .where('w.id', req.params.id)
            .first();

        if (!washroom) {
            return res.status(404).json({ error: 'Washroom not found' });
        }
        res.json(washroom);
    } catch (error) {
        next(error);
    }
});

// Update washroom supply levels (staff/supervisor)
router.put('/:id/supplies', requireRole('admin', 'supervisor', 'staff'), async (req, res, next) => {
    try {
        const { soap_level, tissue_level, sanitizer_level, freshener_level } = req.body;
        const updates = { updated_at: db.fn.now() };

        if (soap_level !== undefined) updates.soap_level = Math.min(100, Math.max(0, parseInt(soap_level)));
        if (tissue_level !== undefined) updates.tissue_level = Math.min(100, Math.max(0, parseInt(tissue_level)));
        if (sanitizer_level !== undefined) updates.sanitizer_level = Math.min(100, Math.max(0, parseInt(sanitizer_level)));
        if (freshener_level !== undefined) updates.freshener_level = Math.min(100, Math.max(0, parseInt(freshener_level)));

        if (Object.keys(updates).length <= 1) {
            return res.status(400).json({ error: 'At least one supply level required' });
        }

        updates.last_restocked = db.fn.now();

        await db('washrooms').where('id', req.params.id).update(updates);
        const updated = await db('washrooms').where('id', req.params.id).first();
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// Update washroom status
router.put('/:id/status', requireRole('admin', 'supervisor', 'staff'), async (req, res, next) => {
    try {
        const { status } = req.body;
        const validStatuses = ['clean', 'needs-cleaning', 'in-progress', 'maintenance'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const updates = { status, updated_at: db.fn.now() };
        if (status === 'clean') updates.last_cleaned = db.fn.now();

        await db('washrooms').where('id', req.params.id).update(updates);
        const updated = await db('washrooms').where('id', req.params.id).first();
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// Assign washroom to staff (admin/supervisor)
router.put('/:id/assign', requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
        const { staff_id } = req.body;

        if (staff_id) {
            const staff = await db('users').where({ id: staff_id }).whereIn('role', ['staff', 'supervisor']).first();
            if (!staff) {
                return res.status(400).json({ error: 'Invalid staff ID' });
            }
        }

        await db('washrooms').where('id', req.params.id).update({
            assigned_staff_id: staff_id || null,
            updated_at: db.fn.now(),
        });

        const updated = await db('washrooms').where('id', req.params.id).first();
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// Get supply inventory (by building)
router.get('/inventory/all', async (req, res, next) => {
    try {
        const { building } = req.query;
        let query = db('supply_inventory as si')
            .select('si.*', 'u.name as last_refilled_by_name')
            .leftJoin('users as u', 'si.last_refilled_by', 'u.id');

        if (building) query = query.where('si.building', building);

        const inventory = await query.orderBy(['si.building', 'si.item_name']);
        res.json(inventory);
    } catch (error) {
        next(error);
    }
});

// Update supply inventory
router.put('/inventory/:id', requireRole('admin', 'supervisor', 'staff'), async (req, res, next) => {
    try {
        const { current_stock, min_threshold } = req.body;
        const updates = { updated_at: db.fn.now() };

        if (current_stock !== undefined) updates.current_stock = parseInt(current_stock);
        if (min_threshold !== undefined) updates.min_threshold = parseInt(min_threshold);
        updates.last_refilled = db.fn.now();
        updates.last_refilled_by = req.user.id;

        await db('supply_inventory').where('id', req.params.id).update(updates);
        const updated = await db('supply_inventory').where('id', req.params.id).first();
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
