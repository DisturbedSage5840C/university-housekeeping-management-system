const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, config.jwt.secret, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
            }
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            logger.warn('Unauthorized access attempt', {
                userId: req.user.id,
                role: req.user.role,
                requiredRoles: roles,
                path: req.path,
            });
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            role: user.role,
            name: user.name 
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiry }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        { id: user.id, type: 'refresh' },
        config.jwt.secret,
        { expiresIn: config.jwt.refreshExpiry }
    );
}

module.exports = { authenticateToken, requireRole, generateToken, generateRefreshToken };
