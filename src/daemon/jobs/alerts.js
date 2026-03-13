import { getCpuUsage, getMemory, getDisk, getDiskIO, getProcesses } from '../../utils/resources.js';
import { sendEmail, sendTelegram } from '../../utils/notify.js';
import { configGet } from '../../utils/config.js';
import { hostname } from 'os';

const THRESHOLD = 90;
const ZOMBIE_THRESHOLD = 100;
const COOLDOWN = 30 * 60 * 1000; // 30 minutes

const cooldowns = {};

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

export const alertsJob = {
    name: 'resource-alerts',
    lastRun: 0,

    shouldRun() {
        return Date.now() - this.lastRun >= 60000;
    },

    async run() {
        this.lastRun = Date.now();

        const [cpu, memory, disk, diskIO, processes] = await Promise.all([
            getCpuUsage(500),
            getMemory(),
            getDisk(),
            getDiskIO(500),
            getProcesses(500)
        ]);

        // CPU
        const overall = cpu.find(c => c.name === 'cpu');
        if (overall && overall.usage >= THRESHOLD) {
            await alert('cpu', `CPU at ${overall.usage}%`);
        }

        // RAM
        if (memory.ram.percent >= THRESHOLD) {
            await alert('ram', `RAM at ${memory.ram.percent}% (${memory.ram.used}MB / ${memory.ram.total}MB)`);
        }

        // Swap
        if (memory.swap.total > 0 && memory.swap.percent >= THRESHOLD) {
            await alert('swap', `Swap at ${memory.swap.percent}% (${memory.swap.used}MB / ${memory.swap.total}MB)`);
        }

        // Disk usage
        for (const part of disk.usage) {
            if (part.percent >= THRESHOLD) {
                await alert(`disk:${part.mounted}`, `Disk ${part.mounted} at ${part.percent}% (${part.used} / ${part.size})`);
            }
        }

        // Inodes
        for (const part of disk.inodes) {
            const pct = part.percent ?? 0;
            if (pct >= THRESHOLD) {
                await alert(`inode:${part.mounted}`, `Inodes ${part.mounted} at ${pct}%`);
            }
        }

        // Zombies
        if (processes.zombies >= ZOMBIE_THRESHOLD) {
            await alert('zombies', `${processes.zombies} zombie processes detected`);
        }

        // Disk I/O
        const diskioReadThreshold = (configGet('thresholds.diskioRead') || 100) * 1024 * 1024;
        const diskioWriteThreshold = (configGet('thresholds.diskioWrite') || 100) * 1024 * 1024;

        for (const d of diskIO) {
            if (d.readPerSec >= diskioReadThreshold) {
                const mbps = (d.readPerSec / 1048576).toFixed(1);
                await alert(`diskio-read:${d.name}`, `Disk I/O read on ${d.name} at ${mbps} MB/s`);
            }
            if (d.writePerSec >= diskioWriteThreshold) {
                const mbps = (d.writePerSec / 1048576).toFixed(1);
                await alert(`diskio-write:${d.name}`, `Disk I/O write on ${d.name} at ${mbps} MB/s`);
            }
        }
    }
};