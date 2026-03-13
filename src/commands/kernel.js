import { Command } from 'commander';
import chalk from 'chalk';
import { getKernelModules, getAppArmor, getTimeSync } from '../utils/kernel.js';

function header(title) {
    return '\n' + chalk.bold.cyan(`── ${title} ──`);
}

const kernel = new Command('kernel')
    .description('Inspect kernel and system security')
    .action(async () => {
        const isRoot = process.getuid && process.getuid() === 0;

        console.log(chalk.bold.white('\n⚡ Xairas Kernel & System\n'));

        if (!isRoot) {
            console.log(chalk.yellow('  ⚠ Run as root for AppArmor details\n'));
        }

        const [modules, apparmor, time] = await Promise.all([
            getKernelModules(),
            getAppArmor(),
            getTimeSync()
        ]);

        // Time sync
        console.log(header('Time Synchronization'));
        const syncStatus = time.synced ? chalk.green('synced') : chalk.red('NOT synced');
        const ntpStatus = time.ntp ? chalk.green('active') : chalk.red('inactive');
        console.log(`  Clock:    ${syncStatus}`);
        console.log(`  NTP:      ${ntpStatus}`);
        console.log(`  Timezone: ${chalk.white(time.timezone)}`);

        // AppArmor
        console.log(header('AppArmor'));
        if (apparmor.loaded) {
            console.log(`  Status:   ${chalk.green('loaded')}`);
            console.log(`  Profiles: ${chalk.white(apparmor.profiles)}`);
            console.log(`  Enforce:  ${chalk.green(apparmor.enforce)}`);
            console.log(`  Complain: ${apparmor.complain > 0 ? chalk.yellow(apparmor.complain) : chalk.gray(0)}`);
        } else {
            console.log(`  Status:   ${chalk.red('NOT loaded')}`);
        }

        // Kernel modules
        console.log(header(`Kernel Modules (${modules.length})`));
        for (const m of modules) {
            const deps = m.usedBy.length > 0 ? chalk.gray(` ← ${m.usedBy.join(', ')}`) : '';
            console.log(`  ${chalk.bold(m.name.padEnd(25))} ${chalk.gray(String(m.size).padStart(8))}B${deps}`);
        }

        console.log('');
    });

export default kernel;