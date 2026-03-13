/**
 * Request Logger Middleware - Structured request logging
 */
const logger = require('../utils/logger');

function requestLogger(req, res, next) {
    const start = Date.now();

    // Log when response finishes
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('user-agent'),
        };

        if (req.user) {
            logData.userId = req.user.id;
            logData.role = req.user.role;
        }

        if (res.statusCode >= 500) {
            logger.error('Request failed', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('Client error', logData);
        } else if (duration > 1000) {
            logger.warn('Slow request', logData);
        }
    });

    next();
}

module.exports = { requestLogger };
