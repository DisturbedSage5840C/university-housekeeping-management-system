const logger = require('../utils/logger');
const config = require('../config');

function errorHandler(err, req, res, next) {
    // Log error details
    logger.error('Request error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        userId: req.user?.id,
        ip: req.ip,
    });

    // Joi validation errors
    if (err.isJoi || err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: err.details?.map(d => d.message) || [err.message],
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }

    // PostgreSQL unique constraint violation
    if (err.code === '23505') {
        return res.status(409).json({ error: 'Resource already exists' });
    }

    // PostgreSQL foreign key violation
    if (err.code === '23503') {
        return res.status(400).json({ error: 'Referenced resource not found' });
    }

    // PostgreSQL check constraint violation
    if (err.code === '23514') {
        return res.status(400).json({ error: 'Invalid value for field' });
    }

    // Rate limit errors
    if (err.status === 429) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    // Multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Max size: 10MB' });
    }

    // Default error - don't expose internals in production
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
        error: statusCode === 500 && config.app.env === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error',
    });
}

module.exports = errorHandler;
