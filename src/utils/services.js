import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

export async function getRunningServices() {
    try {
        const { stdout } = await exec('systemctl', [
            'list-units', '--type=service', '--state=running',
            '--no-pager', '--no-legend'
        ]);
        return stdout.trim().split('\n').filter(Boolean).map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                name: parts[0],
                description: parts.slice(4).join(' ')
            };
        });
    } catch {
        return [];
    }
}