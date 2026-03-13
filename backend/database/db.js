/**
 * Legacy compatibility - redirects to PostgreSQL connection
 * All new code should import from '../database/postgres' directly
 */
module.exports = require('./postgres');
