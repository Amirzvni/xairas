import { Command } from 'commander';
import chalk from 'chalk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { configGet } from '../utils/config.js';

const exec = promisify(execFile);

const SERVICE_NAME = 'xairas';
const SERVICE_PATH = `/etc/systemd/system/${SERVICE_NAME}.service`;

function getServiceFile() {
    const binaryPath = process.argv[0];
    const scriptPath = process.argv[1];
    const isCompiled = !scriptPath || binaryPath.endsWith('xairas');

    const execStart = isCompiled
        ? `${binaryPath} daemon run`
        : `${binaryPath} ${scriptPath} daemon run`;

    return `[Unit]
Description=Xairas Security Daemon
After=network.target

[Service]
Type=simple
ExecStart=${execStart}
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=xairas

[Install]
WantedBy=multi-user.target
`;
}

const daemon = new Command('daemon')
    .description('Manage the xairas daemon');

daemon
    .command('start')
    .description('Install and start the xairas daemon')
    .action(async () => {
        const hasTelegram = configGet('telegram.botToken') && configGet('telegram.chatId');
        const hasEmail = configGet('email.host') && configGet('email.to');

        if (!hasTelegram && !hasEmail) {
            console.log(chalk.red('\n  ✗ No notification channels configured.'));
            console.log(chalk.gray('  Run: sudo xairas config init\n'));
            return;
        }

        try {
            console.log(chalk.gray('  Installing service...'));
            writeFileSync(SERVICE_PATH, getServiceFile());

            await exec('systemctl', ['daemon-reload']);
            await exec('systemctl', ['enable', SERVICE_NAME]);
            await exec('systemctl', ['start', SERVICE_NAME]);

            console.log(chalk.green('\n  ✓ Xairas daemon started'));
            console.log(chalk.gray('  Survives reboot. Logs: journalctl -u xairas -f\n'));
        } catch (err) {
            console.log(chalk.red(`\n  ✗ Failed: ${err.message}\n`));
        }
    });

daemon
    .command('stop')
    .description('Stop and disable the xairas daemon')
    .action(async () => {
        try {
            await exec('systemctl', ['stop', SERVICE_NAME]);
            await exec('systemctl', ['disable', SERVICE_NAME]);
            console.log(chalk.green('\n  ✓ Xairas daemon stopped\n'));
        } catch (err) {
            console.log(chalk.red(`\n  ✗ Failed: ${err.message}\n`));
        }
    });

daemon
    .command('status')
    .description('Check daemon status')
    .action(async () => {
        try {
            const { stdout } = await exec('systemctl', ['is-active', SERVICE_NAME]);
            const state = stdout.trim();
            const color = state === 'active' ? chalk.green : chalk.red;
            console.log(`\n  Xairas daemon: ${color(state)}\n`);
        } catch {
            console.log(`\n  Xairas daemon: ${chalk.gray('not running')}\n`);
        }
    });

daemon
    .command('logs')
    .description('Show daemon logs')
    .action(async () => {
        try {
            const { stdout } = await exec('journalctl', ['-u', SERVICE_NAME, '-n', '50', '--no-pager']);
            console.log(stdout);
        } catch (err) {
            console.log(chalk.red(`\n  ✗ Failed: ${err.message}\n`));
        }
    });

daemon
    .command('run')
    .description('Run the daemon (used by systemd)')
    .action(async () => {
        const { Scheduler } = await import('../daemon/scheduler.js');
        const { reportJob } = await import('../daemon/jobs/report.js');
        const { alertsJob } = await import('../daemon/jobs/alerts.js');
        const { networkAlertsJob } = await import('../daemon/jobs/network-alerts.js');
        const { filesystemAlertsJob } = await import('../daemon/jobs/filesystem-alerts.js');
        const { securityAlertsJob } = await import('../daemon/jobs/security-alerts.js');

        const scheduler = new Scheduler();
        scheduler.register(reportJob);
        scheduler.register(alertsJob);
        scheduler.register(networkAlertsJob);
        scheduler.register(filesystemAlertsJob);
        scheduler.register(securityAlertsJob);

        console.log('[xairas] daemon started');
        scheduler.start();
    });

export default daemon;