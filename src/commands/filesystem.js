import { Command } from 'commander';
import chalk from 'chalk';
import { getSuidBinaries, getTmpFiles, getCronJobs, getTimers, getSensitiveFiles, getLdPreload, getRcLocal } from '../utils/filesystem.js';

function header(title) {
    return '\n' + chalk.bold.cyan(`── ${title} ──`);
}

const filesystem = new Command('filesystem')
    .alias('fs')
    .description('Inspect filesystem security')
    .action(async () => {
        console.log(chalk.bold.white('\n⚡ Xairas Filesystem Audit\n'));

        const [suid, tmp, cron, timers, sensitive, ldpreload, rclocal] = await Promise.all([
            getSuidBinaries(),
            getTmpFiles(),
            getCronJobs(),
            getTimers(),
            getSensitiveFiles(),
            getLdPreload(),
            getRcLocal()
        ]);

        // SUID/SGID
        console.log(header(`SUID/SGID Binaries (${suid.length})`));
        for (const path of suid) {
            console.log(`  ${chalk.yellow(path)}`);
        }

        // Tmp files
        console.log(header(`Files in /tmp & /dev/shm (${tmp.length})`));
        if (tmp.length === 0) {
            console.log(chalk.gray('  Clean'));
        }
        for (const f of tmp) {
            const flags = [];
            if (f.hidden) flags.push(chalk.red('hidden'));
            if (f.owner === 'root') flags.push(chalk.red('root'));
            const tag = flags.length > 0 ? ' ' + flags.join(' ') : '';
            console.log(`  ${chalk.gray(f.owner.padEnd(10))} ${String(f.size).padStart(8)}B  ${f.path}${tag}`);
        }

        // Cron
        console.log(header(`Cron Jobs (${cron.length})`));
        for (const j of cron) {
            console.log(`  ${chalk.gray(j.source)}`);
            console.log(`    ${j.entry}`);
        }

        // Timers
        console.log(header(`Systemd Timers (${timers.length})`));
        for (const t of timers) {
            const color = t.enabled === 'enabled' ? chalk.green : t.enabled === 'disabled' ? chalk.gray : chalk.yellow;
            console.log(`  ${color(t.enabled.padEnd(10))} ${t.name}`);
        }

        // Sensitive files
        console.log(header('Sensitive Files'));
        for (const f of sensitive) {
            console.log(`  ${chalk.bold(f.path)}`);
            console.log(`    ${chalk.gray(`mode: ${f.mode}  size: ${f.size}B  modified: ${f.modified}`)}`);
        }

        // LD_PRELOAD
        console.log(header('LD_PRELOAD'));
        if (ldpreload.length === 0) {
            console.log(`  ${chalk.green('Clean')} — /etc/ld.so.preload not present or empty`);
        } else {
            for (const lib of ldpreload) {
                console.log(`  ${chalk.red('⚠ ' + lib)}`);
            }
        }

        // rc.local
        console.log(header('rc.local'));
        if (!rclocal.exists) {
            console.log(`  ${chalk.green('Clean')} — /etc/rc.local not present`);
        } else {
            console.log(`  ${chalk.yellow('⚠ File exists:')}`);
            console.log(`  ${rclocal.content}`);
        }

        console.log('');
    });

export default filesystem;