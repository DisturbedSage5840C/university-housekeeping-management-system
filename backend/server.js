/**
 * ILGC Tracker - Production API Server
 * Express.js with PostgreSQL, Redis, and Python AI Service integration
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cluster = require('cluster');
const os = require('os');

const config = require('./config');
const logger = require('./utils/logger');
const db = require('./database/postgres');
const cache = require('./services/cacheService');
const reminderService = require('./services/reminderService');

// Import routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const complaintRoutes = require('./routes/complaints');
const staffRoutes = require('./routes/staff');
const aiRoutes = require('./routes/ai');
const dashboardRoutes = require('./routes/dashboard');
const washroomRoutes = require('./routes/washrooms');
const workSubmissionRoutes = require('./routes/work-submissions');
const reminderRoutes = require('./routes/reminders');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');

// Cluster mode for production (use all CPU cores)
if (config.app.env === 'production' && cluster.isPrimary) {
    const numCPUs = Math.min(os.cpus().length, 4); // Max 4 workers
    logger.info(`Primary process ${process.pid} starting ${numCPUs} workers`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code) => {
        logger.warn(`Worker ${worker.process.pid} exited with code ${code}. Restarting...`);
        cluster.fork();
    });
} else {
    startWorker();
}

function startWorker() {
    const app = express();

    // Trust proxy (for Nginx/load balancer)
    app.set('trust proxy', 1);

    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: config.app.env === 'production' ? undefined : false,
        crossOriginEmbedderPolicy: false,
    }));
    app.use(hpp()); // HTTP Parameter Pollution protection
    app.use(compression()); // Gzip compression

    // CORS - properly configured
    app.use(cors({
        origin: config.app.env === 'production'
            ? config.cors.origins
            : true, // Allow all in development
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 86400, // Cache preflight for 24 hours
    }));

    // Rate limiting
    const apiLimiter = rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests. Please try again later.' },
        keyGenerator: (req) => req.ip,
    });

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: config.rateLimit.authMax,
        message: { error: 'Too many login attempts. Please try again later.' },
        keyGenerator: (req) => req.ip,
    });

    app.use('/api/', apiLimiter);
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);

    // Logging
    app.use(morgan('combined', { stream: logger.stream }));
    app.use(requestLogger);

    // Body parsing with limits
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files for uploads (with cache headers)
    app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
        maxAge: '7d',
        etag: true,
    }));

    // Serve frontend in production (serves from project root where index.html lives)
    const frontendDir = path.join(__dirname, '..');
    app.use(express.static(frontendDir, {
        maxAge: '30d',
        etag: true,
        index: 'index.html',
    }));

    // Health check
    app.get('/health', async (req, res) => {
        const dbHealthy = await db.healthCheck();
        const status = dbHealthy ? 'healthy' : 'degraded';

        res.status(dbHealthy ? 200 : 503).json({
            status,
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            pid: process.pid,
            components: {
                database: dbHealthy ? 'connected' : 'disconnected',
                cache: cache.getClient() ? 'connected' : 'disconnected',
            },
        });
    });

    // Readiness probe (for k8s/docker)
    app.get('/ready', async (req, res) => {
        const dbHealthy = await db.healthCheck();
        res.status(dbHealthy ? 200 : 503).json({ ready: dbHealthy });
    });

    // Public home stats for landing screen (no auth required)
    app.get('/api/home-stats', async (req, res, next) => {
        try {
            const requestsTodayResult = await db('complaints')
                .whereRaw('created_at >= CURRENT_DATE')
                .count('* as count')
                .first();

            const completedResult = await db('complaints')
                .where({ status: 'resolved' })
                .count('* as count')
                .first();

            const pendingResult = await db('complaints')
                .where({ status: 'pending' })
                .count('* as count')
                .first();

            let supplyStats = {
                totalPoints: 0,
                lowSupplyPoints: 0,
                supplyHealth: 0,
            };

            try {
                const supplyResult = await db('washrooms')
                    .select(
                        db.raw('COUNT(*)::int as total_points'),
                        db.raw("COUNT(CASE WHEN ((soap_level + tissue_level + sanitizer_level) / 3.0) < 35 THEN 1 END)::int as low_supply_points"),
                        db.raw('COALESCE(AVG((soap_level + tissue_level + sanitizer_level) / 3.0), 0)::numeric(10,1) as supply_health')
                    )
                    .first();

                supplyStats = {
                    totalPoints: parseInt(supplyResult.total_points, 10) || 0,
                    lowSupplyPoints: parseInt(supplyResult.low_supply_points, 10) || 0,
                    supplyHealth: Math.round(parseFloat(supplyResult.supply_health) || 0),
                };
            } catch (_error) {
                // If washrooms table is not ready, keep zeroed supply stats.
            }

            res.json({
                requestsToday: parseInt(requestsTodayResult.count, 10) || 0,
                completedRequests: parseInt(completedResult.count, 10) || 0,
                pendingRequests: parseInt(pendingResult.count, 10) || 0,
                supplyStats,
                updatedAt: new Date().toISOString(),
            });
        } catch (error) {
            next(error);
        }
    });

    // API Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/rooms', authenticateToken, roomRoutes);
    app.use('/api/complaints', authenticateToken, complaintRoutes);
    app.use('/api/staff', authenticateToken, staffRoutes);
    app.use('/api/ai', authenticateToken, aiRoutes);
    app.use('/api/dashboard', authenticateToken, dashboardRoutes);
    app.use('/api/washrooms', authenticateToken, washroomRoutes);
    app.use('/api/work-submissions', authenticateToken, workSubmissionRoutes);
    app.use('/api/reminders', authenticateToken, reminderRoutes);

    // SPA fallback - serve index.html for client-side routes
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
            return next();
        }
        res.sendFile(path.join(__dirname, '..', 'index.html'), (err) => {
            if (err) next();
        });
    });

    // Error handling
    app.use(errorHandler);

    // 404 handler
    app.use((req, res) => {
        res.status(404).json({ error: 'Route not found' });
    });

    // Start server
    async function start() {
        try {
            // Test database connection
            const dbOk = await db.healthCheck();
            if (!dbOk) {
                throw new Error('Database connection failed');
            }
            logger.info('PostgreSQL connected');

            // Connect Redis (non-blocking - app works without it)
            await cache.connect();

            const server = app.listen(config.app.port, config.app.host, () => {
                logger.info(`ILGC Tracker API v2.0 running`, {
                    port: config.app.port,
                    env: config.app.env,
                    pid: process.pid,
                });
            });

            // Run scheduler on a single process to avoid duplicate reminder loops.
            const shouldRunReminderScheduler = !cluster.isWorker || cluster.worker?.id === 1;
            if (shouldRunReminderScheduler) {
                reminderService.startSupervisorReminderScheduler();
            }

            // Graceful shutdown
            const shutdown = async (signal) => {
                logger.info(`${signal} received, shutting down gracefully`);
                reminderService.stopSupervisorReminderScheduler();
                server.close(async () => {
                    await cache.disconnect();
                    await db.destroy();
                    logger.info('Server shutdown complete');
                    process.exit(0);
                });
                // Force close after 30 seconds
                setTimeout(() => process.exit(1), 30000);
            };

            process.on('SIGTERM', () => shutdown('SIGTERM'));
            process.on('SIGINT', () => shutdown('SIGINT'));
        } catch (error) {
            logger.error('Failed to start server', { error: error.message });
            process.exit(1);
        }
    }

    start();
    module.exports = app;
}
