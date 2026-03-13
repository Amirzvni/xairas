import { readFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';



// up time
export async function getUptime() {
    const raw = await readFile('/proc/uptime', 'utf-8');
    const seconds = parseFloat(raw.split(' ')[0]);

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return {
        totalSeconds: seconds,
        days,
        hours,
        minutes,
        formatted: `${days}d ${hours}h ${minutes}m`
    };
}

// cpu usage - we need to read twice to calculate the difference
function parseCpuLines(content) {
    const lines = content.trim().split('\n');
    const cpus = [];

    for (const line of lines) {
        if (!line.startsWith('cpu')) continue;

        const parts = line.split(/\s+/);
        const name = parts[0];
        const values = parts.slice(1).map(Number);

        const [user, nice, system, idle, iowait, irq, softirq, steal] = values;
        const busy = user + nice + system + irq + softirq + steal;
        const total = busy + idle + iowait;

        cpus.push({ name, busy, total });
    }

    return cpus;
}

export async function getCpuUsage(interval = 1000) {
    const first = await readFile('/proc/stat', 'utf-8');
    const before = parseCpuLines(first);

    await new Promise(resolve => setTimeout(resolve, interval));

    const second = await readFile('/proc/stat', 'utf-8');
    const after = parseCpuLines(second);

    const results = [];

    for (let i = 0; i < before.length; i++) {
        const busyDelta = after[i].busy - before[i].busy;
        const totalDelta = after[i].total - before[i].total;
        const usage = totalDelta === 0 ? 0 : Math.round((busyDelta / totalDelta) * 1000) / 10;

        results.push({ name: before[i].name, usage });
    }

    return results;
}

// memory usage
export async function getMemory() {
    const raw = await readFile('/proc/meminfo', 'utf-8');
    const lines = raw.split('\n');

    const values = {};
    for (const line of lines) {
        const match = line.match(/^(\w+):\s+(\d+)/);
        if (match) values[match[1]] = parseInt(match[2]);
    }

    const ramTotal = values.MemTotal;
    const ramAvailable = values.MemAvailable;
    const ramUsed = ramTotal - ramAvailable;

    const swapTotal = values.SwapTotal || 0;
    const swapFree = values.SwapFree || 0;
    const swapUsed = swapTotal - swapFree;

    function toMB(kb) { return Math.round(kb / 1024); }
    function pct(used, total) { return total === 0 ? 0 : Math.round((used / total) * 1000) / 10; }

    return {
        ram: {
            total: toMB(ramTotal),
            used: toMB(ramUsed),
            available: toMB(ramAvailable),
            percent: pct(ramUsed, ramTotal)
        },
        swap: {
            total: toMB(swapTotal),
            used: toMB(swapUsed),
            free: toMB(swapFree),
            percent: pct(swapUsed, swapTotal)
        }
    };
}

// disk

const exec = promisify(execFile);

function parseDfOutput(output) {
    const lines = output.trim().split('\n').slice(1);
    const partitions = [];

    for (const line of lines) {
        const parts = line.split(/\s+/);
        if (!parts[0].startsWith('/dev/')) continue;

        partitions.push({
            filesystem: parts[0],
            size: parts[1],
            used: parts[2],
            available: parts[3],
            percent: parseFloat(parts[4]),
            mounted: parts[5]
        });
    }

    return partitions;
}

export async function getDisk() {
    const { stdout: dfh } = await exec('df', ['-h']);
    const { stdout: dfi } = await exec('df', ['-i']);

    const usage = parseDfOutput(dfh);
    const inodes = parseDfOutput(dfi);

    return { usage, inodes };
}

// disk I/O
function parseDiskStats(content) {
    const lines = content.trim().split('\n');
    const disks = [];

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const name = parts[2];

        if (name.startsWith('loop') || name.startsWith('ram')) continue;
        if (/\d$/.test(name)) continue; // skip partitions like vda1, vda2

        disks.push({
            name,
            sectorsRead: parseInt(parts[5]),
            sectorsWritten: parseInt(parts[9])
        });
    }

    return disks;
}

export async function getDiskIO(interval = 1000) {
    const first = await readFile('/proc/diskstats', 'utf-8');
    const before = parseDiskStats(first);

    await new Promise(resolve => setTimeout(resolve, interval));

    const second = await readFile('/proc/diskstats', 'utf-8');
    const after = parseDiskStats(second);

    const results = [];

    for (let i = 0; i < before.length; i++) {
        const readDelta = (after[i].sectorsRead - before[i].sectorsRead) * 512;
        const writeDelta = (after[i].sectorsWritten - before[i].sectorsWritten) * 512;
        const seconds = interval / 1000;

        results.push({
            name: before[i].name,
            readPerSec: Math.round(readDelta / seconds),
            writePerSec: Math.round(writeDelta / seconds)
        });
    }

    return results;
}

// network bandwidth
function parseNetDev(content) {
    const lines = content.trim().split('\n').slice(2);
    const interfaces = [];

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const name = parts[0].replace(':', '');

        if (name === 'lo') continue;

        interfaces.push({
            name,
            bytesRx: parseInt(parts[1]),
            bytesTx: parseInt(parts[9])
        });
    }

    return interfaces;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B/s';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB/s';
    return (bytes / 1048576).toFixed(1) + ' MB/s';
}

export async function getNetwork(interval = 1000) {
    const first = await readFile('/proc/net/dev', 'utf-8');
    const before = parseNetDev(first);

    await new Promise(resolve => setTimeout(resolve, interval));

    const second = await readFile('/proc/net/dev', 'utf-8');
    const after = parseNetDev(second);

    const beforeMap = {};
    for (const b of before) beforeMap[b.name] = b;

    const seconds = interval / 1000;
    return after.map(a => {
        const b = beforeMap[a.name];
        if (!b) return { name: a.name, rxPerSec: 0, txPerSec: 0, rxFormatted: formatBytes(0), txFormatted: formatBytes(0) };

        const rxPerSec = Math.round((a.bytesRx - b.bytesRx) / seconds);
        const txPerSec = Math.round((a.bytesTx - b.bytesTx) / seconds);
        return { name: a.name, rxPerSec, txPerSec, rxFormatted: formatBytes(rxPerSec), txFormatted: formatBytes(txPerSec) };
    });
}

// proccess
export async function getProcesses(interval = 1000) {
    const dirs = (await readFile('/proc', 'utf-8').catch(() => null))
        ? [] : [];

    // Get list of PIDs
    const { stdout: lsOut } = await exec('ls', ['/proc']);
    const pids = lsOut.split('\n').filter(p => /^\d+$/.test(p));

    let total = 0;
    let zombies = 0;
    const rootProcesses = [];

    for (const pid of pids) {
        try {
            const status = await readFile(`/proc/${pid}/status`, 'utf-8');
            total++;

            const nameLine = status.match(/^Name:\s+(.+)$/m);
            const stateLine = status.match(/^State:\s+(\S)/m);
            const uidLine = status.match(/^Uid:\s+(\d+)/m);
            const ppidLine = status.match(/^PPid:\s+(\d+)/m);

            const name = nameLine ? nameLine[1] : 'unknown';
            const state = stateLine ? stateLine[1] : '?';
            const uid = uidLine ? parseInt(uidLine[1]) : -1;
            const ppid = ppidLine ? parseInt(ppidLine[1]) : -1;

            if (state === 'Z') zombies++;

            if (uid === 0 && ppid !== 2 && parseInt(pid) !== 2) {
                rootProcesses.push({ pid: parseInt(pid), name });
            }
        } catch {
            // process may have exited between listing and reading
        }
    }

    // Spawn rate
    const statContent1 = await readFile('/proc/stat', 'utf-8');
    const forks1 = parseInt(statContent1.match(/^processes\s+(\d+)$/m)[1]);

    await new Promise(resolve => setTimeout(resolve, interval));

    const statContent2 = await readFile('/proc/stat', 'utf-8');
    const forks2 = parseInt(statContent2.match(/^processes\s+(\d+)$/m)[1]);

    const spawnRate = Math.round((forks2 - forks1) / (interval / 1000));

    return {
        total,
        zombies,
        rootProcesses,
        rootCount: rootProcesses.length,
        spawnRate
    };
}