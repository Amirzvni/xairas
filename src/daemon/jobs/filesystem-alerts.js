import { getSuidBinaries, getTmpFiles, getCronJobs, getTimers, getSensitiveFiles, getLdPreload, getRcLocal } from '../../utils/filesystem.js';
import { sendEmail, sendTelegram } from '../../utils/notify.js';
import { configGet } from '../../utils/config.js';
import { hostname } from 'os';

const COOLDOWN = 30 * 60 * 1000;
const cooldowns = {};

let knownSuid = null;
let knownCron = null;
let knownTimers = null;
let knownTmp = null;
let knownSensitive = null;
let knownLdPreload = null;
let knownRcLocal = null;

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

async function checkSuid() {
    const current = await getSuidBinaries();
    const currentSet = new Set(current);

    if (knownSuid === null) {
        knownSuid = currentSet;
        console.log(`[xairas] SUID baseline: ${knownSuid.size} binaries`);
        return;
    }

    for (const path of currentSet) {
        if (!knownSuid.has(path)) {
            await alert(`suid:${path}`, `New SUID/SGID binary: ${path}`);
        }
    }

    knownSuid = currentSet;
}

async function checkCron() {
    const current = await getCronJobs();
    const currentKeys = new Set(current.map(j => `${j.source}|${j.entry}`));

    if (knownCron === null) {
        knownCron = currentKeys;
        console.log(`[xairas] cron baseline: ${knownCron.size} entries`);
        return;
    }

    for (const key of currentKeys) {
        if (!knownCron.has(key)) {
            const [source, entry] = key.split('|');
            await alert(`cron:${key}`, `New cron job in ${source}: ${entry}`);
        }
    }

    knownCron = currentKeys;
}

async function checkTimers() {
    const current = await getTimers();
    const currentMap = {};
    for (const t of current) currentMap[t.name] = t.enabled;

    if (knownTimers === null) {
        knownTimers = { ...currentMap };
        console.log(`[xairas] timer baseline: ${Object.keys(knownTimers).length} timers`);
        return;
    }

    for (const [name, enabled] of Object.entries(currentMap)) {
        if (!(name in knownTimers)) {
            await alert(`timer-new:${name}`, `New systemd timer: ${name} (${enabled})`);
        } else if (knownTimers[name] !== enabled) {
            await alert(`timer-change:${name}`, `Timer ${name} changed: ${knownTimers[name]} → ${enabled}`);
        }
    }

    knownTimers = { ...currentMap };
}

async function checkTmp() {
    const enabled = configGet('alerts.newTmp');
    if (enabled === false || enabled === 'false') return;
    const current = await getTmpFiles();
    const currentPaths = new Set(current.map(f => f.path));

    if (knownTmp === null) {
        knownTmp = currentPaths;
        console.log(`[xairas] tmp baseline: ${knownTmp.size} files`);
        return;
    }

    for (const f of current) {
        if (!knownTmp.has(f.path)) {
            await alert(`tmp:${f.path}`, `New file in ${f.dir}: ${f.path} (owner: ${f.owner}, ${f.size}B)`);
        }
    }

    knownTmp = currentPaths;
}

async function checkSensitive() {
    const current = await getSensitiveFiles();
    const currentMap = {};
    for (const f of current) currentMap[f.path] = f.modified;

    if (knownSensitive === null) {
        knownSensitive = { ...currentMap };
        console.log(`[xairas] sensitive files baseline: ${Object.keys(knownSensitive).length} files`);
        return;
    }

    for (const [path, modified] of Object.entries(currentMap)) {
        if (!(path in knownSensitive)) {
            await alert(`sensitive-new:${path}`, `New sensitive file: ${path}`);
        } else if (knownSensitive[path] !== modified) {
            await alert(`sensitive-mod:${path}`, `Sensitive file modified: ${path}`);
        }
    }

    knownSensitive = { ...currentMap };
}

async function checkLdPreload() {
    const current = await getLdPreload();

    if (knownLdPreload === null) {
        knownLdPreload = [...current];
        console.log(`[xairas] LD_PRELOAD baseline: ${knownLdPreload.length === 0 ? 'clean' : knownLdPreload.join(', ')}`);
        return;
    }

    for (const lib of current) {
        if (!knownLdPreload.includes(lib)) {
            await alert(`ldpreload:${lib}`, `⚠️ LD_PRELOAD hijack detected: ${lib}`);
        }
    }

    if (current.length > 0 && knownLdPreload.length === 0) {
        await alert('ldpreload-new', '⚠️ /etc/ld.so.preload file appeared!');
    }

    knownLdPreload = [...current];
}

async function checkRcLocal() {
    const current = await getRcLocal();

    if (knownRcLocal === null) {
        knownRcLocal = { exists: current.exists, content: current.content };
        console.log(`[xairas] rc.local baseline: ${knownRcLocal.exists ? 'exists' : 'not present'}`);
        return;
    }

    if (!knownRcLocal.exists && current.exists) {
        await alert('rclocal-new', '⚠️ /etc/rc.local appeared!');
    } else if (current.exists && knownRcLocal.content !== current.content) {
        await alert('rclocal-mod', '⚠️ /etc/rc.local was modified!');
    }

    knownRcLocal = { exists: current.exists, content: current.content };
}

export const filesystemAlertsJob = {
    name: 'filesystem-alerts',
    lastRun: 0,

    shouldRun() {
        return Date.now() - this.lastRun >= 60000;
    },

    async run() {
        this.lastRun = Date.now();
        await checkSuid();
        await checkCron();
        await checkTimers();
        await checkTmp();
        await checkSensitive();
        await checkLdPreload();
        await checkRcLocal();
    }
};