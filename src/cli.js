import { Command } from 'commander';
import daemon from './commands/daemon.js';
import resources from './commands/resources.js';
import network from './commands/network.js';
import filesystem from './commands/filesystem.js';
import auth from './commands/auth.js';
import services from './commands/services.js';
import kernel from './commands/kernel.js';
import config from './commands/config.js';
import report from './commands/report.js';

const program = new Command();

program
    .name('xairas')
    .description('Xairas CLI')
    .version('0.1.0');

program.addCommand(daemon);
program.addCommand(resources);
program.addCommand(network);
program.addCommand(filesystem);
program.addCommand(auth);
program.addCommand(services);
program.addCommand(kernel);
program.addCommand(config);
program.addCommand(report);

export function run(argv) {
    program.parse(argv);
}