const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../database/postgres');
const config = require('../config');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function formatDateTimeForFilename(date = new Date()) {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    const hour = pad2(date.getHours());
    const minute = pad2(date.getMinutes());
    const second = pad2(date.getSeconds());
    return `${year}${month}${day}_${hour}${minute}${second}`;
}

function cleanupUploadedFile(file) {
    if (!file || !file.path) return;
    if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
    }
}

function normalizeCleanedValue(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'yes' || normalized === 'no') return normalized;
    return null;
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (req, _file, cb) => {
        const facilityId = String(req.params.id || 'unknown').replace(/[^0-9]/g, '') || 'unknown';
        const timestamp = formatDateTimeForFilename(new Date());
        cb(null, `facility_${facilityId}_${timestamp}.jpg`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: config.upload.maxSize },
    fileFilter: (_req, file, cb) => {
        if ((file.mimetype || '').startsWith('image/')) {
            cb(null, true);
            return;
        }
        cb(new Error('Only image files are allowed'));
    },
});

router.get('/', async (req, res, next) => {
    try {
        const { building, floor } = req.query;

        if (!building || !floor) {
            return res.status(400).json({ error: 'building and floor are required' });
        }

        const rows = await db('facility_updates')
            .where({ building, floor })
            .orderBy('facility_type', 'asc')
            .orderBy('facility_number', 'asc');

        res.json(rows);
    } catch (error) {
        next(error);
    }
});

router.get('/log', async (req, res, next) => {
    try {
        const { building, floor, facility_type } = req.query;

        if (!building || !floor) {
            return res.status(400).json({ error: 'building and floor are required' });
        }

        const query = db('facility_updates')
            .where({ building, floor })
            .whereNotNull('cleaned');

        if (facility_type) {
            query.andWhere('facility_type', facility_type);
        }

        const rows = await query
            .orderBy('last_updated', 'desc')
            .orderBy('facility_number', 'asc');

        res.json(rows);
    } catch (error) {
        next(error);
    }
});

router.put('/:id', requireRole('supervisor'), upload.single('photo'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            cleanupUploadedFile(req.file);
            return res.status(400).json({ error: 'Invalid facility id' });
        }

        const cleaned = normalizeCleanedValue(req.body.cleaned);
        if (!cleaned) {
            cleanupUploadedFile(req.file);
            return res.status(400).json({ error: "cleaned must be either 'yes' or 'no'" });
        }

        if (cleaned === 'yes' && !req.file) {
            return res.status(400).json({ error: 'Photo proof is required when marking as cleaned' });
        }

        if (cleaned === 'no' && req.file) {
            cleanupUploadedFile(req.file);
            return res.status(400).json({ error: 'Photo is not allowed when marking as not cleaned' });
        }

        const existing = await db('facility_updates').where({ id }).first();
        if (!existing) {
            cleanupUploadedFile(req.file);
            return res.status(404).json({ error: 'Facility row not found' });
        }

        const updates = {
            cleaned,
            last_updated: db.fn.now(),
            updated_by: req.user.name || req.user.email || 'Supervisor',
            updated_at: db.fn.now(),
            photo_url: cleaned === 'yes' ? `/uploads/${req.file.filename}` : null,
        };

        if (cleaned === 'yes' && existing.photo_url && existing.photo_url !== updates.photo_url) {
            const priorFilename = path.basename(existing.photo_url);
            const priorPath = path.join(uploadDir, priorFilename);
            if (fs.existsSync(priorPath)) {
                fs.unlinkSync(priorPath);
            }
        }

        if (cleaned === 'no' && existing.photo_url) {
            const priorFilename = path.basename(existing.photo_url);
            const priorPath = path.join(uploadDir, priorFilename);
            if (fs.existsSync(priorPath)) {
                fs.unlinkSync(priorPath);
            }
        }

        const [updated] = await db('facility_updates')
            .where({ id })
            .update(updates)
            .returning('*');

        res.json(updated);
    } catch (error) {
        cleanupUploadedFile(req.file);
        next(error);
    }
});

module.exports = router;
