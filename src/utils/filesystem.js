import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, readdir, stat } from 'fs/promises';

const exec = promisify(execFile);

export async function getSuidBinaries() {
    try {
        const { stdout } = await exec('find', [
            '/usr/bin', '/usr/sbin', '/bin', '/sbin',
            '-type', 'f', '(', '-perm', '-4000', '-o', '-perm', '-2000', ')'
        ], { timeout: 10000 });
        return stdout.trim().split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

export async function getTmpFiles() {
    const dirs = ['/tmp', '/dev/shm'];
    const results = [];

    for (const dir of dirs) {
        try {
            const { stdout } = await exec('find', [
                dir, '-maxdepth', '2', '-type', 'f',
                '-not', '-path', '*/node-compile-cache/*',
                '-printf', '%s %u %p\n'
            ], { timeout: 5000 });

            for (const line of stdout.trim().split('\n').filter(Boolean)) {
                const parts = line.split(' ');
                const size = parseInt(parts[0]);
                const owner = parts[1];
                const path = parts.slice(2).join(' ');
                const hidden = path.split('/').pop().startsWith('.');
                results.push({ path, size, owner, hidden, dir });
            }
        } catch { }
    }

    return results;
}

export async function getCronJobs() {
    const jobs = [];

    try {
        const content = await readFile('/etc/crontab', 'utf-8');
        for (const line of content.split('\n')) {
            if (line.trim() && !line.startsWith('#') && !line.startsWith('SHELL') && !line.startsWith('PATH')) {
                jobs.push({ source: '/etc/crontab', entry: line.trim() });
            }
        }
    } catch { }

    try {
        const files = await readdir('/etc/cron.d');
        for (const file of files) {
            try {
                const content = await readFile(`/etc/cron.d/${file}`, 'utf-8');
                for (const line of content.split('\n')) {
                    if (line.trim() && !line.startsWith('#') && !line.startsWith('SHELL') && !line.startsWith('PATH')) {
                        jobs.push({ source: `/etc/cron.d/${file}`, entry: line.trim() });
                    }
                }
            } catch { }
        }
    } catch { }

    try {
        const { stdout } = await exec('ls', ['/var/spool/cron/crontabs']);
        for (const user of stdout.trim().split('\n').filter(Boolean)) {
            try {
                const content = await readFile(`/var/spool/cron/crontabs/${user}`, 'utf-8');
                for (const line of content.split('\n')) {
                    if (line.trim() && !line.startsWith('#')) {
                        jobs.push({ source: `crontab(${user})`, entry: line.trim() });
                    }
                }
            } catch { }
        }
    } catch { }

    return jobs;
}

export async function getTimers() {
    try {
        const { stdout } = await exec('systemctl', [
            'list-unit-files', '--type=timer', '--no-pager', '--no-legend'
        ]);
        return stdout.trim().split('\n').filter(Boolean).map(line => {
            const parts = line.trim().split(/\s+/);
            return { name: parts[0], enabled: parts[1] };
        });
    } catch {
        return [];
    }
}

export async function getSensitiveFiles() {
    const results = [];
    const paths = [];

    // Gather home dirs
    try {
        const passwd = await readFile('/etc/passwd', 'utf-8');
        for (const line of passwd.split('\n')) {
            const parts = line.split(':');
            if (!parts[6] || parts[6].includes('nologin') || parts[6].includes('/bin/false')) continue;
            const home = parts[5];
            paths.push(`${home}/.bashrc`, `${home}/.profile`, `${home}/.ssh/authorized_keys`);
        }
    } catch { }

    for (const path of paths) {
        try {
            const s = await stat(path);
            results.push({
                path,
                size: s.size,
                modified: s.mtime.toISOString(),
                mode: '0' + (s.mode & 0o777).toString(8)
            });
        } catch { }
    }

    return results;
}

export async function getLdPreload() {
    try {
        const content = await readFile('/etc/ld.so.preload', 'utf-8');
        return content.trim().split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

export async function getRcLocal() {
    try {
        const content = await readFile('/etc/rc.local', 'utf-8');
        return { exists: true, content: content.trim() };
    } catch {
        return { exists: false, content: null };
    }
}