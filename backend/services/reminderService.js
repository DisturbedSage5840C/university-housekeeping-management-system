const db = require('../database/postgres');
const logger = require('../utils/logger');
const { sendSMS } = require('./smsService');

const REMINDER_INTERVAL_HOURS = 2;
const CHECK_INTERVAL_MS = parseInt(
    process.env.SUPERVISOR_REMINDER_CHECK_INTERVAL_MS || String(5 * 60 * 1000),
    10
);

let schedulerHandle = null;
let schedulerRunning = false;

function isMissingReminderTableError(error) {
    if (!error) return false;
    return error.code === '42P01' || error.code === '42703';
}

async function ensureSupervisorReminderRows() {
    await db.raw(`
        INSERT INTO supervisor_check_reminders (supervisor_id, next_due, is_active, created_at, updated_at)
        SELECT u.id, NOW() + INTERVAL '2 hour', true, NOW(), NOW()
        FROM users u
        WHERE u.role = 'supervisor' AND u.is_active = true
        ON CONFLICT (supervisor_id) DO NOTHING
    `);
}

async function pullAndAdvanceDueReminders() {
    return db.transaction(async (trx) => {
        const { rows } = await trx.raw(`
            SELECT scr.supervisor_id, u.name, u.phone
            FROM supervisor_check_reminders scr
            JOIN users u ON u.id = scr.supervisor_id
            WHERE scr.is_active = true
              AND u.is_active = true
              AND u.role = 'supervisor'
              AND scr.next_due <= NOW()
            ORDER BY scr.next_due ASC
            FOR UPDATE SKIP LOCKED
        `);

        if (!rows.length) {
            return [];
        }

        const supervisorIds = rows.map((row) => row.supervisor_id);

        await trx('supervisor_check_reminders')
            .whereIn('supervisor_id', supervisorIds)
            .update({
                next_due: trx.raw(`NOW() + INTERVAL '${REMINDER_INTERVAL_HOURS} hour'`),
                last_sent_at: trx.fn.now(),
                updated_at: trx.fn.now(),
            });

        const notifications = rows.map((row) => ({
            user_id: row.supervisor_id,
            title: 'Washroom Checklist Reminder',
            message: 'Please inspect assigned washrooms and submit the digital checklist with photos.',
            type: 'warning',
        }));

        await trx('notifications').insert(notifications);

        return rows;
    });
}

async function sendMobileReminder(row) {
    if (!row.phone) {
        return { sent: false, reason: 'missing_phone' };
    }

    const message = 'ILGC Tracker reminder: Please check assigned washrooms and submit your digital checklist with photos.';

    try {
        await sendSMS(row.phone, message, 'Supervisor checklist reminder SMS');
        return { sent: true };
    } catch (error) {
        logger.warn('Supervisor reminder SMS failed', {
            supervisorId: row.supervisor_id,
            phone: row.phone,
            error: error.message,
        });
        return { sent: false, reason: error.message };
    }
}

async function runSupervisorReminderCycle() {
    if (schedulerRunning) {
        return { skipped: true };
    }

    schedulerRunning = true;

    try {
        await ensureSupervisorReminderRows();
        const dueRows = await pullAndAdvanceDueReminders();

        if (!dueRows.length) {
            return { processed: 0, smsSent: 0 };
        }

        const smsResults = await Promise.all(dueRows.map((row) => sendMobileReminder(row)));
        const smsSent = smsResults.filter((result) => result.sent).length;

        logger.info('Supervisor reminder cycle completed', {
            dueReminders: dueRows.length,
            smsSent,
        });

        return { processed: dueRows.length, smsSent };
    } catch (error) {
        if (isMissingReminderTableError(error)) {
            logger.warn('Supervisor reminder scheduler is disabled until migrations are applied');
            return { processed: 0, smsSent: 0, skipped: true };
        }

        logger.error('Supervisor reminder cycle failed', { error: error.message });
        return { processed: 0, smsSent: 0, error: error.message };
    } finally {
        schedulerRunning = false;
    }
}

function startSupervisorReminderScheduler() {
    if (schedulerHandle) return;

    const initialDelayMs = parseInt(process.env.SUPERVISOR_REMINDER_INITIAL_DELAY_MS || '20000', 10);

    logger.info('Starting supervisor reminder scheduler', {
        checkIntervalMs: CHECK_INTERVAL_MS,
        reminderEveryHours: REMINDER_INTERVAL_HOURS,
        initialDelayMs,
    });

    const kickoffTimer = setTimeout(() => {
        runSupervisorReminderCycle().catch((error) => {
            logger.error('Initial supervisor reminder cycle failed', { error: error.message });
        });
    }, initialDelayMs);

    if (typeof kickoffTimer.unref === 'function') {
        kickoffTimer.unref();
    }

    schedulerHandle = setInterval(() => {
        runSupervisorReminderCycle().catch((error) => {
            logger.error('Scheduled supervisor reminder cycle failed', { error: error.message });
        });
    }, CHECK_INTERVAL_MS);

    if (typeof schedulerHandle.unref === 'function') {
        schedulerHandle.unref();
    }
}

function stopSupervisorReminderScheduler() {
    if (!schedulerHandle) return;

    clearInterval(schedulerHandle);
    schedulerHandle = null;
    logger.info('Supervisor reminder scheduler stopped');
}

module.exports = {
    startSupervisorReminderScheduler,
    stopSupervisorReminderScheduler,
    runSupervisorReminderCycle,
};
