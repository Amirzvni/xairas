import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';

const exec = promisify(execFile);

export async function getKernelModules() {
    try {
        const content = await readFile('/proc/modules', 'utf-8');
        return content.trim().split('\n').map(line => {
            const parts = line.split(' ');
            return {
                name: parts[0],
                size: parseInt(parts[1]),
                usedBy: parts[3] === '-' ? [] : parts[3].replace(/,$/, '').split(',').filter(Boolean)
            };
        });
    } catch {
        return [];
    }
}

export async function getAppArmor() {
    try {
        const { stdout } = await exec('aa-status', [], { timeout: 5000 });
        const profiles = stdout.match(/(\d+) profiles are loaded/);
        const enforce = stdout.match(/(\d+) profiles are in enforce mode/);
        const complain = stdout.match(/(\d+) profiles are in complain mode/);
        return {
            loaded: true,
            profiles: profiles ? parseInt(profiles[1]) : 0,
            enforce: enforce ? parseInt(enforce[1]) : 0,
            complain: complain ? parseInt(complain[1]) : 0
        };
    } catch {
        return { loaded: false, profiles: 0, enforce: 0, complain: 0 };
    }
}

export async function getTimeSync() {
    try {
        const { stdout } = await exec('timedatectl', ['status']);
        const synced = /System clock synchronized:\s+yes/i.test(stdout);
        const ntp = /NTP service:\s+active/i.test(stdout);
        const tz = stdout.match(/Time zone:\s+(\S+)/);
        return {
            synced,
            ntp,
            timezone: tz ? tz[1] : 'unknown'
        };
    } catch {
        return { synced: false, ntp: false, timezone: 'unknown' };
    }
}