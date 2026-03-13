import { Command } from 'commander';
import chalk from 'chalk';
import { getRunningServices } from '../utils/services.js';

function header(title) {
    return '\n' + chalk.bold.cyan(`── ${title} ──`);
}

const services = new Command('services')
    .description('Inspect running services')
    .action(async () => {
        console.log(chalk.bold.white('\n⚡ Xairas Services\n'));

        const running = await getRunningServices();

        console.log(header(`Running Services (${running.length})`));
        for (const s of running) {
            console.log(`  ${chalk.green('●')} ${chalk.bold(s.name.padEnd(40))} ${chalk.gray(s.description)}`);
        }

        console.log('');
    });

export default services;