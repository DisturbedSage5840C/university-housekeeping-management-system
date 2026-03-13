const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/postgres');
const { generateToken, generateRefreshToken, authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { sendOtpSMS } = require('../services/smsService');
const logger = require('../utils/logger');

const router = express.Router();

// Register new user
router.post('/register', validate('register'), async (req, res, next) => {
    try {
        const { email, password, name, role, room_number, phone } = req.body;

        // Check if user exists
        const existing = await db('users').where({ email }).first();
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        const userId = uuidv4();

        // Insert user
        await db('users').insert({
            id: userId, email, password: hashedPassword, name, role,
            room_number: room_number || null, phone: phone || null,
        });

        const user = await db('users')
            .select('id', 'email', 'name', 'role', 'room_number', 'phone', 'created_at')
            .where({ id: userId })
            .first();

        const token = generateToken(user);

        logger.info('User registered', { userId, role });

        res.status(201).json({ message: 'User registered successfully', user, token });
    } catch (error) {
        next(error);
    }
});

// Login
router.post('/login', validate('login'), async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await db('users').where({ email, is_active: true }).first();
        if (!user) {
            return res.status(401).json({ error: 'Email not found' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Password not correct' });
        }

        // Generate tokens
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        // Update last login
        await db('users').where({ id: user.id }).update({ last_login: db.fn.now() });

        // Store refresh token
        await db('refresh_tokens').insert({
            user_id: user.id,
            token: refreshToken,
            expires_at: db.raw("NOW() + INTERVAL '30 days'"),
        });

        // Remove password from response
        delete user.password;

        logger.info('User logged in', { userId: user.id, role: user.role });

        res.json({ message: 'Login successful', user, token, refreshToken });
    } catch (error) {
        next(error);
    }
});

// Forgot password: request OTP on registered mobile number
router.post('/forgot-password/request-otp', async (req, res, next) => {
    try {
        const { email, phone } = req.body;
        const otpTestMode = String(process.env.OTP_TEST_MODE || '').toLowerCase() === 'true';

        if (!email || !phone) {
            return res.status(400).json({ error: 'Email and phone are required' });
        }

        const user = await db('users').where({ email, is_active: true }).first();
        if (!user) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const normalizedInputPhone = String(phone).replace(/\D/g, '');
        const normalizedUserPhone = String(user.phone || '').replace(/\D/g, '');
        if (!normalizedUserPhone || normalizedInputPhone !== normalizedUserPhone) {
            return res.status(400).json({ error: 'Mobile number does not match this account' });
        }

        // Invalidate older active OTPs for this user
        await db('password_reset_otps')
            .where({ user_id: user.id, used: false })
            .update({ used: true, updated_at: db.fn.now() });

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpHash = await bcrypt.hash(otp, 10);

        const [otpRecord] = await db('password_reset_otps').insert({
            user_id: user.id,
            phone: user.phone,
            otp_hash: otpHash,
            expires_at: db.raw("NOW() + INTERVAL '10 minutes'"),
            used: false,
            attempts: 0,
        }).returning(['id']);

        if (!otpTestMode) {
            try {
                await sendOtpSMS(user.phone, otp);
            } catch (smsError) {
                if (otpRecord?.id) {
                    await db('password_reset_otps').where({ id: otpRecord.id }).update({ used: true, updated_at: db.fn.now() });
                }
                return res.status(502).json({ error: `Unable to send OTP SMS: ${smsError.message}` });
            }
        }

        logger.info('Password reset OTP generated', { userId: user.id, phone: user.phone });

        const response = {
            message: otpTestMode ? 'OTP generated in test mode (no SMS sent)' : 'OTP sent to registered mobile number',
        };
        if (otpTestMode || process.env.NODE_ENV !== 'production') {
            response.devOtp = otp;
        }

        res.json(response);
    } catch (error) {
        next(error);
    }
});

// Forgot password: verify OTP and reset password
router.post('/forgot-password/reset', async (req, res, next) => {
    try {
        const { email, phone, otp, newPassword } = req.body;

        if (!email || !phone || !otp || !newPassword) {
            return res.status(400).json({ error: 'Email, phone, OTP, and new password are required' });
        }

        if (String(newPassword).length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        const user = await db('users').where({ email, is_active: true }).first();
        if (!user) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const normalizedInputPhone = String(phone).replace(/\D/g, '');
        const normalizedUserPhone = String(user.phone || '').replace(/\D/g, '');
        if (!normalizedUserPhone || normalizedInputPhone !== normalizedUserPhone) {
            return res.status(400).json({ error: 'Mobile number does not match this account' });
        }

        const otpRecord = await db('password_reset_otps')
            .where({ user_id: user.id, used: false })
            .where('expires_at', '>', db.fn.now())
            .orderBy('created_at', 'desc')
            .first();

        if (!otpRecord) {
            return res.status(400).json({ error: 'OTP expired or not found' });
        }

        if (otpRecord.attempts >= 5) {
            await db('password_reset_otps').where({ id: otpRecord.id }).update({ used: true, updated_at: db.fn.now() });
            return res.status(400).json({ error: 'Too many invalid OTP attempts. Request a new OTP.' });
        }

        const otpValid = await bcrypt.compare(String(otp), otpRecord.otp_hash);
        if (!otpValid) {
            await db('password_reset_otps')
                .where({ id: otpRecord.id })
                .update({ attempts: otpRecord.attempts + 1, updated_at: db.fn.now() });
            return res.status(400).json({ error: 'OTP not correct' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await db.transaction(async (trx) => {
            await trx('users').where({ id: user.id }).update({
                password: hashedPassword,
                updated_at: db.fn.now(),
            });

            await trx('password_reset_otps').where({ id: otpRecord.id }).update({
                used: true,
                updated_at: db.fn.now(),
            });

            // Revoke all refresh tokens after password reset
            await trx('refresh_tokens').where({ user_id: user.id, revoked: false }).update({ revoked: true });
        });

        logger.info('Password reset via OTP', { userId: user.id });
        res.json({ message: 'Password reset successful' });
    } catch (error) {
        next(error);
    }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const user = await db('users')
            .select('id', 'email', 'name', 'role', 'room_number', 'phone', 'avatar_url', 'created_at')
            .where({ id: req.user.id })
            .first();

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        next(error);
    }
});

// Update profile
router.put('/me', authenticateToken, async (req, res, next) => {
    try {
        const { name, phone, room_number } = req.body;

        const updates = {};
        if (name) updates.name = name;
        if (phone) updates.phone = phone;
        if (room_number) updates.room_number = room_number;
        updates.updated_at = db.fn.now();

        await db('users').where({ id: req.user.id }).update(updates);

        const user = await db('users')
            .select('id', 'email', 'name', 'role', 'room_number', 'phone', 'created_at')
            .where({ id: req.user.id })
            .first();

        res.json(user);
    } catch (error) {
        next(error);
    }
});

// Change password
router.put('/password', authenticateToken, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        const user = await db('users').select('password').where({ id: req.user.id }).first();
        const validPassword = await bcrypt.compare(currentPassword, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await db('users').where({ id: req.user.id }).update({
            password: hashedPassword,
            updated_at: db.fn.now(),
        });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        next(error);
    }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        const stored = await db('refresh_tokens')
            .where({ token: refreshToken, revoked: false })
            .where('expires_at', '>', db.fn.now())
            .first();

        if (!stored) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const user = await db('users')
            .select('id', 'email', 'name', 'role')
            .where({ id: stored.user_id, is_active: true })
            .first();

        if (!user) {
            return res.status(401).json({ error: 'User not found or deactivated' });
        }

        // Revoke old token and issue new ones
        await db('refresh_tokens').where({ id: stored.id }).update({ revoked: true });

        const newToken = generateToken(user);
        const newRefreshToken = generateRefreshToken(user);

        await db('refresh_tokens').insert({
            user_id: user.id,
            token: newRefreshToken,
            expires_at: db.raw("NOW() + INTERVAL '30 days'"),
        });

        res.json({ token: newToken, refreshToken: newRefreshToken });
    } catch (error) {
        next(error);
    }
});

// Logout (revoke refresh token)
router.post('/logout', authenticateToken, async (req, res, next) => {
    try {
        await db('refresh_tokens')
            .where({ user_id: req.user.id, revoked: false })
            .update({ revoked: true });

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
