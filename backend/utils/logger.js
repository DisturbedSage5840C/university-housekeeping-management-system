/**
 * Winston Logger - Production-grade logging with rotation
 */
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../config');
const fs = require('fs');

// Ensure log directory exists
const logDir = config.log.dir;
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
    })
);

const transports = [
    // Console
    new winston.transports.Console({
        format: consoleFormat,
        level: config.app.env === 'development' ? 'debug' : config.log.level,
    }),

    // All logs file (rotating daily)
    new DailyRotateFile({
        filename: path.join(logDir, 'app-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: logFormat,
        level: config.log.level,
    }),

    // Error logs file
    new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '90d',
        format: logFormat,
        level: 'error',
    }),
];

const logger = winston.createLogger({
    level: config.log.level,
    format: logFormat,
    defaultMeta: { service: 'ilgc-api' },
    transports,
    exitOnError: false,
});

// Stream for Morgan HTTP logging
logger.stream = {
    write: (message) => {
        logger.info(message.trim(), { type: 'http' });
    },
};

module.exports = logger;
