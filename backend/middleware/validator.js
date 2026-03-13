/**
 * Input Validation Middleware using Joi
 */
const Joi = require('joi');

// Validation schemas
const schemas = {
    register: Joi.object({
        email: Joi.string().email().required().max(255),
        password: Joi.string().min(8).max(128).required(),
        name: Joi.string().min(2).max(255).required(),
        role: Joi.string().valid('admin', 'staff', 'supervisor', 'resident').required(),
        room_number: Joi.string().max(20).allow(null, ''),
        phone: Joi.string().max(20).allow(null, ''),
    }),

    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required(),
    }),

    complaint: Joi.object({
        category: Joi.string().max(100).required(),
        room_number: Joi.string().max(20).required(),
        description: Joi.string().min(10).max(5000).required(),
        priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
    }),

    updateComplaint: Joi.object({
        status: Joi.string().valid('pending', 'in-progress', 'resolved'),
        priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
        assigned_staff_id: Joi.string().uuid().allow(null),
        resolution_notes: Joi.string().max(5000).allow(null, ''),
    }).min(1),

    updateRoom: Joi.object({
        status: Joi.string().valid('pending', 'in-progress', 'cleaned', 'needs-maintenance'),
        assigned_staff_id: Joi.string().uuid().allow(null),
        notes: Joi.string().max(2000).allow(null, ''),
    }).min(1),

    pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        sortBy: Joi.string().max(50).default('created_at'),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    }),
};

/**
 * Middleware factory for request body validation
 */
function validate(schemaName) {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) {
            return next(new Error(`Unknown validation schema: ${schemaName}`));
        }

        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            return res.status(400).json({
                error: 'Validation Error',
                details: error.details.map(d => d.message),
            });
        }

        req.body = value;
        next();
    };
}

/**
 * Middleware for query parameter validation
 */
function validateQuery(schemaName) {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) return next();

        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            return res.status(400).json({
                error: 'Invalid query parameters',
                details: error.details.map(d => d.message),
            });
        }

        req.query = value;
        next();
    };
}

module.exports = { validate, validateQuery, schemas };
