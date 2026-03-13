import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';

const exec = promisify(execFile);

export async function getFailedLogins() {
    try {
        const { stdout } = await exec('grep', ['-E', 'Failed password for', '/var/log/auth.log']);
        const lines = stdout.trim().split('\n').filter(Boolean);
        return lines.map(line => {
            const ipMatch = line.match(/from\s+(\S+)/);
            const userMatch = line.match(/for\s+(?:invalid user\s+)?(\S+)/);
            const dateMatch = line.match(/^(\S+)/);
            return {
                date: dateMatch ? dateMatch[1] : 'unknown',
                user: userMatch ? userMatch[1] : 'unknown',
                ip: ipMatch ? ipMatch[1] : 'unknown'
            };
        });
    } catch {
        return [];
    }
}

export async function getUsers() {
    try {
        const content = await readFile('/etc/passwd', 'utf-8');
        return content.trim().split('\n').map(line => {
            const parts = line.split(':');
            return {
                name: parts[0],
                uid: parseInt(parts[2]),
                gid: parseInt(parts[3]),
                home: parts[5],
                shell: parts[6]
            };
        }).filter(u => !u.shell.includes('nologin') && !u.shell.includes('/bin/false'));
    } catch {
        return [];
    }
}

export async function getSudoUsage() {
    try {
        const { stdout } = await exec('grep', ['sudo:', '/var/log/auth.log']);
        const lines = stdout.trim().split('\n').filter(Boolean);
        const entries = [];

        for (const line of lines) {
            const userMatch = line.match(/:\s+(\S+)\s+:/);
            const cmdMatch = line.match(/COMMAND=(.+)$/);
            const dateMatch = line.match(/^(\S+)/);

            if (userMatch && cmdMatch) {
                entries.push({
                    date: dateMatch ? dateMatch[1] : 'unknown',
                    user: userMatch[1],
                    command: cmdMatch[1]
                });
            }
        }

        return entries;
    } catch {
        return [];
    }
}

export async function getSshSessions() {
    try {
        const { stdout } = await exec('who');
        return stdout.trim().split('\n').filter(Boolean).map(line => {
            const parts = line.split(/\s+/);
            const ipMatch = line.match(/\((.+)\)/);
            return {
                user: parts[0],
                terminal: parts[1],
                date: `${parts[2]} ${parts[3]}`,
                ip: ipMatch ? ipMatch[1] : 'local'
            };
        });
    } catch {
        return [];
    }
}

export async function getSudoers() {
    const results = [];

    try {
        const content = await readFile('/etc/sudoers', 'utf-8');
        for (const line of content.split('\n')) {
            if (line.trim() && !line.startsWith('#') && !line.startsWith('Defaults')) {
                results.push({ source: '/etc/sudoers', entry: line.trim() });
            }
        }
    } catch { }

    try {
        const { stdout } = await exec('ls', ['/etc/sudoers.d']);
        for (const file of stdout.trim().split('\n').filter(Boolean)) {
            try {
                const content = await readFile(`/etc/sudoers.d/${file}`, 'utf-8');
                for (const line of content.split('\n')) {
                    if (line.trim() && !line.startsWith('#') && !line.startsWith('Defaults')) {
                        results.push({ source: `/etc/sudoers.d/${file}`, entry: line.trim() });
                    }
                }
            } catch { }
        }
    } catch { }

    return results;
}