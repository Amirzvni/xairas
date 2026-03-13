import { Command } from 'commander';
import chalk from 'chalk';
import { getFailedLogins, getUsers, getSudoUsage, getSshSessions, getSudoers } from '../utils/auth.js';

function header(title) {
    return '\n' + chalk.bold.cyan(`── ${title} ──`);
}

const auth = new Command('auth')
    .description('Inspect users and authentication')
    .action(async () => {
        console.log(chalk.bold.white('\n⚡ Xairas Auth Audit\n'));

        const [failed, users, sudo, sessions, sudoers] = await Promise.all([
            getFailedLogins(),
            getUsers(),
            getSudoUsage(),
            getSshSessions(),
            getSudoers()
        ]);

        // Failed logins
        console.log(header(`Failed Logins (${failed.length})`));
        if (failed.length === 0) {
            console.log(`  ${chalk.green('None')}`);
        }
        for (const f of failed) {
            console.log(`  ${chalk.red(f.date)}  user: ${chalk.bold(f.user)}  from: ${chalk.yellow(f.ip)}`);
        }

        // Users with shell
        console.log(header(`Users with Shell Access (${users.length})`));
        for (const u of users) {
            const isRoot = u.uid === 0 ? chalk.red(' [root]') : '';
            console.log(`  ${chalk.bold(u.name.padEnd(15))} uid:${String(u.uid).padStart(5)}  ${chalk.gray(u.shell)}${isRoot}`);
        }

        // SSH sessions
        console.log(header(`Active SSH Sessions (${sessions.length})`));
        for (const s of sessions) {
            console.log(`  ${chalk.bold(s.user.padEnd(10))} ${s.terminal.padEnd(8)} ${chalk.gray(s.date)}  from ${chalk.yellow(s.ip)}`);
        }

        // Sudo usage (last 10)
        const recentSudo = sudo.slice(-10);
        console.log(header(`Recent Sudo Usage (last ${recentSudo.length} of ${sudo.length})`));
        for (const s of recentSudo) {
            console.log(`  ${chalk.gray(s.date)}`);
            console.log(`    ${chalk.bold(s.user)} → ${s.command}`);
        }

        // Sudoers
        console.log(header(`Sudoers Rules (${sudoers.length})`));
        for (const s of sudoers) {
            console.log(`  ${chalk.gray(s.source)}`);
            console.log(`    ${s.entry}`);
        }

        console.log('');
    });

export default auth;