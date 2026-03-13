/**
 * Redis Cache Service - Production caching layer
 */
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

let client = null;
let isConnected = false;

function getClient() {
    if (!client) {
        client = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
            retryStrategy: (times) => {
                if (times > 10) {
                    logger.error('Redis: Max retry attempts reached');
                    return null; // Stop retrying
                }
                return Math.min(times * 200, 5000);
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true,
        });

        client.on('connect', () => {
            isConnected = true;
            logger.info('Redis connected');
        });

        client.on('error', (err) => {
            isConnected = false;
            logger.warn('Redis error', { error: err.message });
        });

        client.on('close', () => {
            isConnected = false;
        });
    }
    return client;
}

async function connect() {
    try {
        const redis = getClient();
        await redis.connect();
        return true;
    } catch (err) {
        logger.warn('Redis connection failed, caching disabled', { error: err.message });
        return false;
    }
}

async function get(key) {
    if (!isConnected) return null;
    try {
        const data = await client.get(`ilgc:${key}`);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        logger.warn('Cache get failed', { key, error: err.message });
        return null;
    }
}

async function set(key, value, ttlSeconds = 3600) {
    if (!isConnected) return;
    try {
        await client.setex(`ilgc:${key}`, ttlSeconds, JSON.stringify(value));
    } catch (err) {
        logger.warn('Cache set failed', { key, error: err.message });
    }
}

async function del(key) {
    if (!isConnected) return;
    try {
        await client.del(`ilgc:${key}`);
    } catch (err) {
        logger.warn('Cache del failed', { key, error: err.message });
    }
}

async function clearPattern(pattern) {
    if (!isConnected) return;
    try {
        const stream = client.scanStream({ match: `ilgc:${pattern}`, count: 100 });
        stream.on('data', (keys) => {
            if (keys.length) {
                client.unlink(...keys);
            }
        });
    } catch (err) {
        logger.warn('Cache clear failed', { pattern, error: err.message });
    }
}

async function disconnect() {
    if (client) {
        await client.quit();
        client = null;
        isConnected = false;
    }
}

module.exports = { connect, get, set, del, clearPattern, disconnect, getClient };
