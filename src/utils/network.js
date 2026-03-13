import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

function parseProcess(str) {
    if (!str) return null;
    const match = str.match(/\("([^"]+)",pid=(\d+)/);
    if (!match) return null;
    return { name: match[1], pid: parseInt(match[2]) };
}

function parseAddress(addr) {
    // handle IPv6-mapped IPv4 like [::ffff:45.82.136.54]:22
    const v6mapped = addr.match(/^\[::ffff:(.+)\]:(\d+)$/);
    if (v6mapped) return { ip: v6mapped[1], port: parseInt(v6mapped[2]) };

    // handle [ipv6]:port
    const v6 = addr.match(/^\[(.+)\]:(\d+)$/);
    if (v6) return { ip: v6[1], port: parseInt(v6[2]) };

    // handle interface-bound like 127.0.0.53%lo:53
    const iface = addr.match(/^(.+)%\w+:(\d+)$/);
    if (iface) return { ip: iface[1], port: parseInt(iface[2]) };

    // handle ip:port or *:port
    const last = addr.lastIndexOf(':');
    return {
        ip: addr.substring(0, last),
        port: parseInt(addr.substring(last + 1))
    };
}

export async function getListening() {
    const { stdout } = await exec('ss', ['-Htlnp']);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const results = [];

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const local = parseAddress(parts[3]);
        const proc = parseProcess(parts[5]);

        results.push({
            ip: local.ip,
            port: local.port,
            process: proc
        });
    }

    return results;
}

export async function getConnections() {
    const { stdout } = await exec('ss', ['-Htunp']);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const results = [];

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const proto = parts[0];
        const state = parts[1];
        const local = parseAddress(parts[4]);
        const peer = parseAddress(parts[5]);
        const proc = parseProcess(parts[6]);

        results.push({
            proto,
            state,
            local,
            peer,
            process: proc
        });
    }

    return results;
}