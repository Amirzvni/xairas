import { Command } from 'commander';
import chalk from 'chalk';
import { getListening, getConnections } from '../utils/network.js';

function header(title) {
    return '\n' + chalk.bold.cyan(`── ${title} ──`);
}

const network = new Command('network')
    .description('Show network status')
    .action(async () => {
        const isRoot = process.getuid && process.getuid() === 0;

        console.log(chalk.bold.white('\n⚡ Xairas Network Status\n'));

        if (!isRoot) {
            console.log(chalk.yellow('  ⚠ Run as root for process details\n'));
        }

        const [listening, connections] = await Promise.all([
            getListening(),
            getConnections()
        ]);

        // Listening
        console.log(header('Listening Ports'));
        for (const l of listening) {
            const bind = `${l.ip}:${l.port}`;
            const proc = l.process
                ? chalk.gray(`${l.process.name} (${l.process.pid})`)
                : chalk.gray('unknown');
            console.log(`  ${chalk.bold(String(l.port).padStart(6))}  ${bind.padEnd(25)} ${proc}`);
        }

        // Connections
        console.log(header('Established Connections'));
        if (connections.length === 0) {
            console.log(chalk.gray('  No active connections'));
        }
        for (const c of connections) {
            const direction = `${c.local.ip}:${c.local.port} → ${c.peer.ip}:${c.peer.port}`;
            const proto = c.proto.toUpperCase().padEnd(4);
            const proc = c.process
                ? chalk.gray(`${c.process.name} (${c.process.pid})`)
                : chalk.gray('unknown');
            const stateColor = c.state === 'ESTAB' ? chalk.green : chalk.yellow;
            console.log(`  ${chalk.bold(proto)} ${stateColor(c.state.padEnd(10))} ${direction}`);
            console.log(`       ${proc}`);
        }

        console.log('');
    });

export default network;