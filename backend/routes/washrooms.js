const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const db = require('../database/postgres');
const config = require('../config');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const CHECKLIST_ITEM_KEYS = [
    'soap_refill',
    'tissue_refill',
    'sanitizer_refill',
    'sink_cleaning',
    'floor_mopping',
    'dustbin_cleared',
];

const CHECKLIST_RESTOCK_KEYS = ['soap_refill', 'tissue_refill', 'sanitizer_refill'];
const CHECKLIST_CLEANING_KEYS = ['sink_cleaning', 'floor_mopping', 'dustbin_cleared'];

function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
    }
    return false;
}

function formatDateTimeForFilename(date = new Date()) {
    const pad2 = (num) => String(num).padStart(2, '0');
    const pad3 = (num) => String(num).padStart(3, '0');

    return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}${pad3(date.getMilliseconds())}`;
}

function sanitizeChecklistKey(rawKey) {
    return String(rawKey || '')
        .replace(/^photo_/, '')
        .replace(/[^a-z0-9_]/gi, '_')
        .toLowerCase();
}

const uploadDir = config.upload.dir;
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const checklistStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
        const originalExt = path.extname(file.originalname || '').toLowerCase();
        const ext = allowedExts.has(originalExt) ? originalExt : '.jpg';
        const itemKey = sanitizeChecklistKey(file.fieldname);
        const timestamp = formatDateTimeForFilename(new Date());

        // Required format: date_time-based filenames for captured checklist photos.
        cb(null, `checklist_${itemKey}_${timestamp}${ext}`);
    },
});

const checklistUpload = multer({
    storage: checklistStorage,
    limits: { fileSize: config.upload.maxSize },
    fileFilter: (_req, file, cb) => {
        if (config.upload.allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'));
        }
    },
});

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

// Get latest digital checklist for a washroom
router.get('/:id/checklist/latest', requireRole('admin', 'supervisor', 'staff'), async (req, res, next) => {
    try {
        const checklist = await db('washroom_checklists')
            .where('washroom_id', req.params.id)
            .orderBy('submitted_at', 'desc')
            .first();

        if (!checklist) {
            return res.json({ checklist: null });
        }

        const normalized = {
            ...checklist,
            checklist_items: typeof checklist.checklist_items === 'string'
                ? JSON.parse(checklist.checklist_items)
                : checklist.checklist_items,
        };

        res.json({ checklist: normalized });
    } catch (error) {
        next(error);
    }
});

// Submit a digital checklist with per-item camera uploads
router.post('/:id/checklist', requireRole('supervisor'), checklistUpload.any(), async (req, res, next) => {
    try {
        const washroom = await db('washrooms').where('id', req.params.id).first();
        if (!washroom) {
            return res.status(404).json({ error: 'Washroom not found' });
        }

        let parsedItems = {};
        if (typeof req.body.items === 'string' && req.body.items.trim()) {
            try {
                parsedItems = JSON.parse(req.body.items);
            } catch (_error) {
                return res.status(400).json({ error: 'Invalid checklist payload' });
            }
        } else if (req.body.items && typeof req.body.items === 'object') {
            parsedItems = req.body.items;
        }

        const files = Array.isArray(req.files) ? req.files : [];
        const fileMap = new Map(files.map((file) => [file.fieldname, file]));

        const normalizedItems = {};
        CHECKLIST_ITEM_KEYS.forEach((key) => {
            const incoming = parsedItems[key] || {};
            const completed = toBoolean(incoming.completed);
            const file = fileMap.get(`photo_${key}`) || null;

            normalizedItems[key] = {
                completed,
                photo_url: file ? `/uploads/${file.filename}` : null,
                photo_filename: file ? file.filename : null,
                completed_at: completed ? new Date().toISOString() : null,
            };
        });

        const completedKeys = Object.entries(normalizedItems)
            .filter(([, value]) => value.completed)
            .map(([key]) => key);

        if (!completedKeys.length) {
            return res.status(400).json({ error: 'Mark at least one checklist item as completed' });
        }

        const missingPhotoKeys = completedKeys.filter((key) => !normalizedItems[key].photo_filename);
        if (missingPhotoKeys.length) {
            return res.status(400).json({
                error: `Photo required for completed items: ${missingPhotoKeys.join(', ')}`,
            });
        }

        const notes = req.body.notes ? String(req.body.notes).trim() : null;

        const [inserted] = await db('washroom_checklists').insert({
            washroom_id: washroom.id,
            supervisor_id: req.user.id,
            checklist_date: db.raw('CURRENT_DATE'),
            checklist_items: normalizedItems,
            notes: notes || null,
            submitted_at: db.fn.now(),
        }).returning('*');

        const didRestock = completedKeys.some((key) => CHECKLIST_RESTOCK_KEYS.includes(key));
        const didClean = completedKeys.some((key) => CHECKLIST_CLEANING_KEYS.includes(key));

        const washroomUpdates = { updated_at: db.fn.now() };
        if (didRestock) washroomUpdates.last_restocked = db.fn.now();
        if (didClean) washroomUpdates.last_cleaned = db.fn.now();

        if (didRestock || didClean) {
            await db('washrooms').where('id', washroom.id).update(washroomUpdates);
        }

        res.status(201).json({
            ...inserted,
            checklist_items: typeof inserted.checklist_items === 'string'
                ? JSON.parse(inserted.checklist_items)
                : inserted.checklist_items,
        });
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
