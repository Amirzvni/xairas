import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { sendEmail, sendTelegram } from '../../utils/notify.js';
import { configGet } from '../../utils/config.js';
import { hostname } from 'os';

const exec = promisify(execFile);
const COOLDOWN = 30 * 60 * 1000;
const cooldowns = {};

let knownPorts = null;
let knownArp = null;

function canAlert(key) {
    const last = cooldowns[key] || 0;
    if (Date.now() - last < COOLDOWN) return false;
    cooldowns[key] = Date.now();
    return true;
}

async function alert(key, message) {
    if (!canAlert(key)) return;

    const host = hostname();
    const line = `🚨 <b>${host}</b> — ${message}`;

    console.log(`[xairas] ALERT: ${message}`);

    const hasTelegram = configGet('telegram.botToken') && configGet('telegram.chatId');
    const hasEmail = configGet('email.host') && configGet('email.to');

    if (hasTelegram) {
        try {
            await sendTelegram(line);
        } catch (err) {
            console.error(`[xairas] telegram alert failed: ${err.message}`);
        }
    }

    if (hasEmail) {
        try {
            const html = `<div style="font-family:monospace;padding:16px;background:#1a1a2e;color:#e74c3c;border-radius:8px;">${line}</div>`;
            await sendEmail(`🚨 Xairas Alert — ${host}`, html);
        } catch (err) {
            console.error(`[xairas] email alert failed: ${err.message}`);
        }
    }
}



async function checkPorts() {
    const enabled = configGet('alerts.newPort');
    if (enabled === false || enabled === 'false') return;

    const { stdout } = await exec('ss', ['-Htlnp']);
    const currentPorts = new Set();

    for (const line of stdout.trim().split('\n').filter(Boolean)) {
        const parts = line.trim().split(/\s+/);
        const addr = parts[3];
        const last = addr.lastIndexOf(':');
        const port = parseInt(addr.substring(last + 1));
        currentPorts.add(port);
    }

    if (knownPorts === null) {
        knownPorts = currentPorts;
        console.log(`[xairas] port baseline: ${[...knownPorts].sort((a, b) => a - b).join(', ')}`);
        return;
    }

    for (const port of currentPorts) {
        if (!knownPorts.has(port)) {
            await alert(`new-port:${port}`, `New listening port detected: ${port}`);
        }
    }

    knownPorts = currentPorts;
}

async function checkArp() {
    const raw = await readFile('/proc/net/arp', 'utf-8');
    const lines = raw.trim().split('\n').slice(1);
    const currentArp = {};

    for (const line of lines) {
        const parts = line.split(/\s+/);
        const ip = parts[0];
        const mac = parts[3];
        if (mac === '00:00:00:00:00:00') continue;
        currentArp[ip] = mac;
    }

    if (knownArp === null) {
        knownArp = { ...currentArp };
        console.log(`[xairas] ARP baseline: ${Object.entries(knownArp).map(([ip, mac]) => `${ip}=${mac}`).join(', ')}`);
        return;
    }

    for (const [ip, mac] of Object.entries(currentArp)) {
        if (knownArp[ip] && knownArp[ip] !== mac) {
            await alert(`arp-spoof:${ip}`, `ARP spoofing detected! ${ip} changed from ${knownArp[ip]} to ${mac}`);
        }
    }

    knownArp = { ...currentArp };
}

export const networkAlertsJob = {
    name: 'network-alerts',
    lastRun: 0,

    shouldRun() {
        return Date.now() - this.lastRun >= 60000;
    },

    async run() {
        this.lastRun = Date.now();
        await checkPorts();
        await checkArp();
    }
};