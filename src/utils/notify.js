import nodemailer from 'nodemailer';
import { configGet } from './config.js';

export async function sendTelegram(text) {
    const apiUrl = configGet('telegram.apiUrl');
    const token = configGet('telegram.botToken');
    const chatId = configGet('telegram.chatId');

    if (!token || !chatId) return { ok: false, error: 'Telegram not configured' };

    const url = `${apiUrl}/bot${token}/sendMessage`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML'
        })
    });

    return res.json();
}

export async function sendEmail(subject, html) {
    const host = configGet('email.host');
    const port = configGet('email.port');
    const username = configGet('email.username');
    const password = configGet('email.password');
    const from = configGet('email.from');
    const to = configGet('email.to');

    if (!host || !username || !to) return { error: 'Email not configured' };

    const transport = nodemailer.createTransport({
        host,
        port: typeof port === 'string' ? parseInt(port) : port,
        secure: true,
        auth: { user: username, pass: password }
    });

    const result = await transport.sendMail({
        from,
        to,
        subject,
        html
    });

    return { messageId: result.messageId };
}