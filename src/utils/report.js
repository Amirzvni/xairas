import { getUptime, getCpuUsage, getMemory, getDisk, getDiskIO, getNetwork, getProcesses } from './resources.js';
import { getListening, getConnections } from './network.js';
import { getSuidBinaries, getTmpFiles, getCronJobs, getSensitiveFiles, getLdPreload, getRcLocal } from './filesystem.js';
import { getFailedLogins, getUsers, getSshSessions, getSudoUsage } from './auth.js';
import { getRunningServices } from './services.js';
import { getKernelModules, getAppArmor, getTimeSync } from './kernel.js';
import { hostname } from 'os';

export async function collectReport() {
    const [uptime, cpu, memory, disk, diskIO, network, processes] = await Promise.all([
        getUptime(),
        getCpuUsage(),
        getMemory(),
        getDisk(),
        getDiskIO(),
        getNetwork(),
        getProcesses()
    ]);

    const [listening, connections] = await Promise.all([
        getListening(),
        getConnections()
    ]);

    const [suid, tmp, cron, sensitive, ldpreload, rclocal] = await Promise.all([
        getSuidBinaries(),
        getTmpFiles(),
        getCronJobs(),
        getSensitiveFiles(),
        getLdPreload(),
        getRcLocal()
    ]);

    const [failed, users, sessions, sudo] = await Promise.all([
        getFailedLogins(),
        getUsers(),
        getSshSessions(),
        getSudoUsage()
    ]);

    const [services, modules, apparmor, time] = await Promise.all([
        getRunningServices(),
        getKernelModules(),
        getAppArmor(),
        getTimeSync()
    ]);

    return {
        host: hostname(),
        timestamp: new Date().toISOString(),
        uptime, cpu, memory, disk, diskIO, network, processes,
        listening, connections,
        suid, tmp, cron, sensitive, ldpreload, rclocal,
        failed, users, sessions, sudo,
        services, modules, apparmor, time
    };
}

function bar(percent) {
    const filled = Math.round(percent / 5);
    const empty = 20 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function alertColor(percent) {
    if (percent > 90) return '#e74c3c';
    if (percent > 70) return '#f39c12';
    return '#2ecc71';
}

export function buildEmailHtml(data) {
    const overall = data.cpu.find(c => c.name === 'cpu');
    const cores = data.cpu.filter(c => c.name !== 'cpu');

    return `
<div style="font-family: monospace; max-width: 700px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; padding: 24px; border-radius: 8px;">
  <h2 style="color: #00d4ff; margin-top: 0;">⚡ Xairas Daily Report</h2>
  <p style="color: #888;">${data.host} — ${new Date(data.timestamp).toLocaleString('en-GB', { timeZone: 'Asia/Tehran' })}</p>

  <h3 style="color: #00d4ff; border-bottom: 1px solid #333; padding-bottom: 6px;">Uptime</h3>
  <p>${data.uptime.formatted}</p>

  <h3 style="color: #00d4ff; border-bottom: 1px solid #333; padding-bottom: 6px;">CPU</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td>Overall</td><td style="color: ${alertColor(overall.usage)}">${overall.usage}%</td></tr>
    ${cores.map(c => `<tr><td>${c.name}</td><td style="color: ${alertColor(c.usage)}">${c.usage}%</td></tr>`).join('')}
  </table>

  <h3 style="color: #00d4ff; border-bottom: 1px solid #333; padding-bottom: 6px;">Memory</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td>RAM</td><td style="color: ${alertColor(data.memory.ram.percent)}">${data.memory.ram.percent}% — ${data.memory.ram.used}MB / ${data.memory.ram.total}MB</td></tr>
    <tr><td>Swap</td><td>${data.memory.swap.total > 0 ? data.memory.swap.percent + '% — ' + data.memory.swap.used + 'MB / ' + data.memory.swap.total + 'MB' : 'not configured'}</td></tr>
  </table>

  <h3 style="color: #00d4ff; border-bottom: 1px solid #333; padding-bottom: 6px;">Disk</h3>
  <table style="width: 100%; border-collapse: collapse;">
    ${data.disk.usage.map(d => `<tr><td>${d.mounted}</td><td style="color: ${alertColor(d.percent)}">${d.percent}% — ${d.used} / ${d.size}</td></tr>`).join('')}
  </table>

  <h3 style="color: #00d4ff; border-bottom: 1px solid #333; padding-bottom: 6px;">Network</h3>
  <table style="width: 100%; border-collapse: collapse;">
    ${data.network.map(n => `<tr><td>${n.name}</td><td>↓ ${n.rxFormatted} ↑ ${n.txFormatted}</td></tr>`).join('')}
  </table>

  <h3 style="color: #00d4ff; border-bottom: 1px solid #333; padding-bottom: 6px;">Processes</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td>Total</td><td>${data.processes.total}</td></tr>
    <tr><td>Zombies</td><td style="color: ${data.processes.zombies > 0 ? '#e74c3c' : '#2ecc71'}">${data.processes.zombies}</td></tr>
    <tr><td>Root</td><td>${data.processes.rootCount}</td></tr>
    <tr><td>Spawn rate</td><td>${data.processes.spawnRate}/s</td></tr>
  </table>

  <h3 style="color: #00d4ff; border-bottom: 1px solid #333; padding-bottom: 6px;">Listening Ports</h3>
  <table style="width: 100%; border-collapse: collapse;">
    ${data.listening.map(l => `<tr><td>:${l.port}</td><td>${l.ip}</td><td>${l.process ? l.process.name : 'unknown'}</td></tr>`).join('')}
  </table>

  <h3 style="color: #00d4ff; border-bottom: 1px solid #333; padding-bottom: 6px;">Connections</h3>
  <table style="width: 100%; border-collapse: collapse;">
    ${data.connections.map(c => `<tr><td>${c.proto.toUpperCase()}</td><td>${c.local.ip}:${c.local.port} → ${c.peer.ip}:${c.peer.port}</td><td>${c.process ? c.process.name : 'unknown'}</td></tr>`).join('')}
  </table>

  <h3 style="color: #00d4ff; border-bottom: 1px solid #333; padding-bottom: 6px;">Security</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td>Failed logins</td><td style="color: ${data.failed.length > 0 ? '#e74c3c' : '#2ecc71'}">${data.failed.length}</td></tr>
    <tr><td>Users with shell</td><td>${data.users.length}</td></tr>
    <tr><td>SSH sessions</td><td>${data.sessions.length}</td></tr>
    <tr><td>SUID binaries</td><td>${data.suid.length}</td></tr>
    <tr><td>Files in /tmp</td><td>${data.tmp.length}</td></tr>
    <tr><td>LD_PRELOAD</td><td style="color: ${data.ldpreload.length > 0 ? '#e74c3c' : '#2ecc71'}">${data.ldpreload.length > 0 ? '⚠ LOADED' : 'clean'}</td></tr>
    <tr><td>rc.local</td><td style="color: ${data.rclocal.exists ? '#e74c3c' : '#2ecc71'}">${data.rclocal.exists ? '⚠ EXISTS' : 'clean'}</td></tr>
    <tr><td>AppArmor</td><td style="color: ${data.apparmor.loaded ? '#2ecc71' : '#e74c3c'}">${data.apparmor.loaded ? 'loaded (' + data.apparmor.enforce + ' enforce)' : '⚠ NOT LOADED'}</td></tr>
    <tr><td>NTP</td><td style="color: ${data.time.synced ? '#2ecc71' : '#e74c3c'}">${data.time.synced ? 'synced' : '⚠ NOT SYNCED'}</td></tr>
  </table>

  <h3 style="color: #00d4ff; border-bottom: 1px solid #333; padding-bottom: 6px;">Active SSH Sessions</h3>
  <table style="width: 100%; border-collapse: collapse;">
    ${data.sessions.map(s => `<tr><td>${s.user}</td><td>${s.ip}</td><td>${s.date}</td></tr>`).join('')}
  </table>

  <p style="color: #555; margin-top: 24px; font-size: 12px;">Generated by Xairas v0.1.0</p>
</div>`;
}

export function buildTelegramText(data) {
    const overall = data.cpu.find(c => c.name === 'cpu');

    let msg = `⚡ <b>Xairas Report — ${data.host}</b>\n`;
    msg += `📅 ${new Date(data.timestamp).toLocaleString('en-GB', { timeZone: 'Asia/Tehran' })}\n\n`;

    msg += `<b>Resources</b>\n`;
    msg += `  Uptime: ${data.uptime.formatted}\n`;
    msg += `  CPU: ${overall.usage}%\n`;
    msg += `  RAM: ${data.memory.ram.percent}% (${data.memory.ram.used}/${data.memory.ram.total}MB)\n`;
    msg += `  Disk: ${data.disk.usage.map(d => d.mounted + ' ' + d.percent + '%').join(', ')}\n\n`;

    msg += `<b>Network</b>\n`;
    msg += `  Ports: ${data.listening.map(l => l.port).join(', ')}\n`;
    msg += `  Connections: ${data.connections.length}\n\n`;

    msg += `<b>Security</b>\n`;
    msg += `  Failed logins: ${data.failed.length}\n`;
    msg += `  Zombies: ${data.processes.zombies}\n`;
    msg += `  Root procs: ${data.processes.rootCount}\n`;
    msg += `  SSH sessions: ${data.sessions.length}\n`;
    msg += `  AppArmor: ${data.apparmor.loaded ? '✅' : '❌'}\n`;
    msg += `  NTP: ${data.time.synced ? '✅' : '❌'}\n`;
    msg += `  LD_PRELOAD: ${data.ldpreload.length > 0 ? '⚠️' : '✅'}\n`;
    msg += `  rc.local: ${data.rclocal.exists ? '⚠️' : '✅'}`;

    return msg;
}