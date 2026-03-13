const express = require('express');
const db = require('../database/postgres');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all reminders (supervisor sees own, admin sees all)
router.get('/', async (req, res, next) => {
    try {
        let query = db('reminders as r')
            .select('r.*', 'u.name as created_by_name')
            .leftJoin('users as u', 'r.created_by', 'u.id');

        if (req.user.role === 'supervisor') {
            query = query.where('r.created_by', req.user.id);
        }

        const reminders = await query.where('r.is_active', true).orderBy('r.next_due', 'asc');
        res.json(reminders);
    } catch (error) {
        next(error);
    }
});

// Create reminder (supervisor/admin)
router.post('/', requireRole('supervisor', 'admin'), async (req, res, next) => {
    try {
        const { building, reminder_type, frequency, notify_portal, notify_mobile, notes } = req.body;

        if (!building || !reminder_type || !frequency) {
            return res.status(400).json({ error: 'Building, type, and frequency are required' });
        }

        const validTypes = ['restocking', 'cleaning', 'refilling', 'inspection'];
        if (!validTypes.includes(reminder_type)) {
            return res.status(400).json({ error: 'Invalid reminder type' });
        }

        const validFreqs = ['4h', '8h', '12h', '24h'];
        if (!validFreqs.includes(frequency)) {
            return res.status(400).json({ error: 'Invalid frequency' });
        }

        // Calculate next due
        const freqHours = parseInt(frequency);
        const nextDue = new Date(Date.now() + freqHours * 3600000);

        const [inserted] = await db('reminders').insert({
            building,
            reminder_type,
            frequency,
            notify_portal: notify_portal !== false,
            notify_mobile: notify_mobile === true,
            notes: notes || null,
            created_by: req.user.id,
            next_due: nextDue,
        }).returning('*');

        res.status(201).json(inserted);
    } catch (error) {
        next(error);
    }
});

// Update reminder
router.put('/:id', requireRole('supervisor', 'admin'), async (req, res, next) => {
    try {
        const reminder = await db('reminders').where('id', req.params.id).first();
        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        // Supervisors can only edit their own reminders
        if (req.user.role === 'supervisor' && reminder.created_by !== req.user.id) {
            return res.status(403).json({ error: 'Cannot edit other supervisor\'s reminders' });
        }

        const { building, reminder_type, frequency, notify_portal, notify_mobile, notes, is_active } = req.body;
        const updates = { updated_at: db.fn.now() };

        if (building) updates.building = building;
        if (reminder_type) updates.reminder_type = reminder_type;
        if (frequency) {
            updates.frequency = frequency;
            const freqHours = parseInt(frequency);
            updates.next_due = new Date(Date.now() + freqHours * 3600000);
        }
        if (notify_portal !== undefined) updates.notify_portal = notify_portal;
        if (notify_mobile !== undefined) updates.notify_mobile = notify_mobile;
        if (notes !== undefined) updates.notes = notes;
        if (is_active !== undefined) updates.is_active = is_active;

        await db('reminders').where('id', req.params.id).update(updates);
        const updated = await db('reminders').where('id', req.params.id).first();
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// Delete reminder
router.delete('/:id', requireRole('supervisor', 'admin'), async (req, res, next) => {
    try {
        const reminder = await db('reminders').where('id', req.params.id).first();
        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        if (req.user.role === 'supervisor' && reminder.created_by !== req.user.id) {
            return res.status(403).json({ error: 'Cannot delete other supervisor\'s reminders' });
        }

        await db('reminders').where('id', req.params.id).del();
        res.json({ message: 'Reminder deleted' });
    } catch (error) {
        next(error);
    }
});

// Get due reminders (for notification service)
router.get('/due/now', requireRole('supervisor', 'admin'), async (req, res, next) => {
    try {
        const dueReminders = await db('reminders')
            .where('is_active', true)
            .where('next_due', '<=', db.fn.now())
            .orderBy('next_due', 'asc');

        res.json(dueReminders);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
