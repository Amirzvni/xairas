import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { getUsers, getSudoers } from '../../utils/auth.js';
import { getKernelModules, getAppArmor, getTimeSync } from '../../utils/kernel.js';
import { getUptime } from '../../utils/resources.js';
import { getRunningServices } from '../../utils/services.js';
import { sendEmail, sendTelegram } from '../../utils/notify.js';
import { configGet } from '../../utils/config.js';
import { hostname } from 'os';

const exec = promisify(execFile);
const COOLDOWN = 30 * 60 * 1000;
const cooldowns = {};

let knownUsers = null;
let knownSudoers = null;
let knownPam = null;
let knownServices = null;
let knownEnabledServices = null;
let knownModules = null;
let knownUptime = null;
let knownAppArmor = null;
let knownTimeSync = null;

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

async function checkUsers() {
    const current = await getUsers();
    const currentMap = {};
    for (const u of current) currentMap[u.name] = u.uid;

    if (knownUsers === null) {
        knownUsers = { ...currentMap };
        console.log(`[xairas] users baseline: ${Object.keys(knownUsers).join(', ')}`);
        return;
    }

    for (const [name, uid] of Object.entries(currentMap)) {
        if (!(name in knownUsers)) {
            const isRoot = uid === 0 ? ' ⚠️ UID 0 (root equivalent!)' : '';
            await alert(`user-new:${name}`, `New user account created: ${name} (uid: ${uid})${isRoot}`);
        }
    }

    knownUsers = { ...currentMap };
}

async function checkSudoers() {
    const current = await getSudoers();
    const currentKeys = new Set(current.map(s => `${s.source}|${s.entry}`));

    if (knownSudoers === null) {
        knownSudoers = currentKeys;
        console.log(`[xairas] sudoers baseline: ${knownSudoers.size} rules`);
        return;
    }

    for (const key of currentKeys) {
        if (!knownSudoers.has(key)) {
            const [source, entry] = key.split('|');
            await alert(`sudoers:${key}`, `Sudoers rule added in ${source}: ${entry}`);
        }
    }

    for (const key of knownSudoers) {
        if (!currentKeys.has(key)) {
            const [source, entry] = key.split('|');
            await alert(`sudoers-removed:${key}`, `Sudoers rule removed from ${source}: ${entry}`);
        }
    }

    knownSudoers = currentKeys;
}

async function checkPam() {
    try {
        const { stdout } = await exec('md5sum', ['/etc/pam.d/*'], { shell: true });
        const currentMap = {};
        for (const line of stdout.trim().split('\n').filter(Boolean)) {
            const [hash, file] = line.split(/\s+/);
            currentMap[file] = hash;
        }

        if (knownPam === null) {
            knownPam = { ...currentMap };
            console.log(`[xairas] PAM baseline: ${Object.keys(knownPam).length} files`);
            return;
        }

        for (const [file, hash] of Object.entries(currentMap)) {
            if (!(file in knownPam)) {
                await alert(`pam-new:${file}`, `⚠️ New PAM module: ${file}`);
            } else if (knownPam[file] !== hash) {
                await alert(`pam-mod:${file}`, `⚠️ PAM module modified: ${file}`);
            }
        }

        for (const file of Object.keys(knownPam)) {
            if (!(file in currentMap)) {
                await alert(`pam-del:${file}`, `⚠️ PAM module deleted: ${file}`);
            }
        }

        knownPam = { ...currentMap };
    } catch (err) {
        console.error(`[xairas] PAM check failed: ${err.message}`);
    }
}

async function checkServices() {
    const running = await getRunningServices();
    const currentRunning = new Set(running.map(s => s.name));

    let currentEnabled = new Set();
    try {
        const { stdout } = await exec('systemctl', [
            'list-unit-files', '--type=service', '--state=enabled',
            '--no-pager', '--no-legend'
        ]);
        for (const line of stdout.trim().split('\n').filter(Boolean)) {
            const name = line.trim().split(/\s+/)[0];
            currentEnabled.add(name);
        }
    } catch { }

    if (knownServices === null) {
        knownServices = currentRunning;
        knownEnabledServices = currentEnabled;
        console.log(`[xairas] services baseline: ${knownServices.size} running, ${knownEnabledServices.size} enabled`);
        return;
    }

    // New service appeared
    for (const name of currentRunning) {
        if (!knownServices.has(name)) {
            await alert(`service-new:${name}`, `New service running: ${name}`);
        }
    }

    // Disabled service came back
    for (const name of currentEnabled) {
        if (!knownEnabledServices.has(name)) {
            await alert(`service-enabled:${name}`, `Service re-enabled: ${name}`);
        }
    }

    knownServices = currentRunning;
    knownEnabledServices = currentEnabled;
}

async function checkKernelModules() {
    const current = await getKernelModules();
    const currentNames = new Set(current.map(m => m.name));

    if (knownModules === null) {
        knownModules = currentNames;
        console.log(`[xairas] kernel modules baseline: ${knownModules.size} modules`);
        return;
    }

    for (const name of currentNames) {
        if (!knownModules.has(name)) {
            await alert(`module:${name}`, `⚠️ New kernel module loaded: ${name}`);
        }
    }

    knownModules = currentNames;
}

async function checkUptime() {
    const current = await getUptime();

    if (knownUptime === null) {
        knownUptime = current.totalSeconds;
        console.log(`[xairas] uptime baseline: ${current.formatted}`);
        return;
    }

    if (current.totalSeconds < knownUptime) {
        await alert('reboot', `⚠️ Unexpected reboot detected! Uptime reset to ${current.formatted}`);
    }

    knownUptime = current.totalSeconds;
}

async function checkAppArmor() {
    const current = await getAppArmor();

    if (knownAppArmor === null) {
        knownAppArmor = { ...current };
        console.log(`[xairas] AppArmor baseline: ${current.loaded ? 'loaded' : 'not loaded'}`);
        return;
    }

    if (knownAppArmor.loaded && !current.loaded) {
        await alert('apparmor', '⚠️ AppArmor was disabled!');
    }

    if (current.loaded && current.enforce < knownAppArmor.enforce) {
        await alert('apparmor-enforce', `⚠️ AppArmor enforce profiles dropped: ${knownAppArmor.enforce} → ${current.enforce}`);
    }

    knownAppArmor = { ...current };
}

async function checkTimeSync() {
    const current = await getTimeSync();

    if (knownTimeSync === null) {
        knownTimeSync = { ...current };
        console.log(`[xairas] time sync baseline: synced=${current.synced}, ntp=${current.ntp}`);
        return;
    }

    if (knownTimeSync.synced && !current.synced) {
        await alert('time-desync', '⚠️ System clock lost synchronization!');
    }

    if (knownTimeSync.ntp && !current.ntp) {
        await alert('ntp-disabled', '⚠️ NTP service was disabled!');
    }

    knownTimeSync = { ...current };
}

export const securityAlertsJob = {
    name: 'security-alerts',
    lastRun: 0,

    shouldRun() {
        return Date.now() - this.lastRun >= 60000;
    },

    async run() {
        this.lastRun = Date.now();
        await checkUsers();
        await checkSudoers();
        await checkPam();
        await checkServices();
        await checkKernelModules();
        await checkUptime();
        await checkAppArmor();
        await checkTimeSync();
    }
};