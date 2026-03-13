const fetch = require('node-fetch');
const logger = require('../utils/logger');

function normalizePhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.startsWith('0') && digits.length === 11) return `+91${digits.slice(1)}`;
    return `+${digits}`;
}

async function sendViaTwilio(phone, message) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        throw new Error('Twilio is not fully configured');
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            To: phone,
            From: fromNumber,
            Body: message,
        }).toString(),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Twilio send failed');
    }

    return { provider: 'twilio', messageId: data.sid };
}

async function sendViaFast2SMS(phone, message) {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
        throw new Error('FAST2SMS_API_KEY is missing');
    }

    const localNumber = phone.replace(/^\+91/, '').replace(/\D/g, '');
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
            authorization: apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            route: 'q',
            language: 'english',
            flash: 0,
            numbers: localNumber,
            message,
        }),
    });

    const data = await response.json();
    if (!response.ok || data.return === false) {
        throw new Error(data.message?.[0] || data.message || 'Fast2SMS send failed');
    }

    return { provider: 'fast2sms', messageId: data.request_id || null };
}

async function sendViaTextbelt(phone, message) {
    const key = process.env.TEXTBELT_KEY || 'textbelt';

    const response = await fetch('https://textbelt.com/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            phone,
            message,
            key,
        }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Textbelt send failed');
    }

    return { provider: 'textbelt', messageId: data.textId || null };
}

async function sendOtpSMS(rawPhone, otp) {
    const phone = normalizePhone(rawPhone);
    const provider = (process.env.SMS_PROVIDER || '').toLowerCase().trim();
    const message = `Your ILGC Tracker OTP is ${otp}. It expires in 10 minutes.`;

    if (!phone) {
        throw new Error('Invalid phone number');
    }

    try {
        if (provider === 'twilio') {
            return await sendViaTwilio(phone, message);
        }

        if (provider === 'fast2sms') {
            return await sendViaFast2SMS(phone, message);
        }

        if (provider === 'textbelt') {
            return await sendViaTextbelt(phone, message);
        }

        throw new Error('SMS provider is not configured');
    } catch (error) {
        logger.error('OTP SMS send failed', {
            provider: provider || 'none',
            phone,
            error: error.message,
        });
        throw error;
    }
}

module.exports = { sendOtpSMS, normalizePhone };