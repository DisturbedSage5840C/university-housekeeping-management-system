/**
 * PostgreSQL Database Connection with Knex
 * Production-grade with connection pooling and health checks
 */
const knex = require('knex');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

const knexConfig = {
    client: 'pg',
    connection: {
        host: config.db.host,
        port: config.db.port,
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
        ssl: config.db.ssl,
    },
    pool: {
        min: config.db.pool.min,
        max: config.db.pool.max,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
    },
    migrations: {
        directory: path.join(__dirname, 'migrations'),
        tableName: 'knex_migrations',
    },
    seeds: {
        directory: path.join(__dirname, 'seeds'),
    },
    acquireConnectionTimeout: 60000,
    debug: config.app.env === 'development',
};

const db = knex(knexConfig);

// Health check
async function healthCheck() {
    try {
        await db.raw('SELECT 1');
        return true;
    } catch (err) {
        logger.error('Database health check failed', { error: err.message });
        return false;
    }
}

// Graceful shutdown
async function destroy() {
    await db.destroy();
    logger.info('Database connection pool destroyed');
}

// Log pool events
db.on('query', (queryData) => {
    if (config.app.env === 'development') {
        logger.debug('SQL Query', { sql: queryData.sql, bindings: queryData.bindings });
    }
});

db.on('query-error', (error, queryData) => {
    logger.error('SQL Query Error', { error: error.message, sql: queryData.sql });
});

module.exports = db;
module.exports.healthCheck = healthCheck;
module.exports.destroy = destroy;
