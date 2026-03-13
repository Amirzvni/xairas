import { Command } from 'commander';
import chalk from 'chalk';
import { getUptime, getCpuUsage, getMemory, getDisk, getDiskIO, getNetwork, getProcesses } from '../utils/resources.js';
function bar(percent, width = 20) {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    let color = chalk.green;
    if (percent > 70) color = chalk.yellow;
    if (percent > 90) color = chalk.red;
    return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty)) + ` ${percent}%`;
}

function header(title) {
    return '\n' + chalk.bold.cyan(`── ${title} ──`);
}

function formatBytesRate(bytes) {
    if (bytes < 1024) return bytes + ' B/s';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB/s';
    return (bytes / 1048576).toFixed(1) + ' MB/s';
}

function formatDiskRate(bytes) {
    if (bytes < 1024) return bytes + ' B/s';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB/s';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB/s';
    return (bytes / 1073741824).toFixed(1) + ' GB/s';
}

const resources = new Command('resources')
    .description('Show system resource usage')
    .action(async () => {
        console.log(chalk.bold.white('\n⚡ Xairas Resource Monitor\n'));
        console.log(chalk.gray('  Collecting data (1s sample)...'));

        const [uptime, cpu, memory, disk, diskIO, network, processes] = await Promise.all([
            getUptime(),
            getCpuUsage(),
            getMemory(),
            getDisk(),
            getDiskIO(),
            getNetwork(),
            getProcesses()
        ]);

        // Clear the "collecting" line
        process.stdout.write('\x1B[1A\x1B[2K');

        // Uptime
        console.log(header('Uptime'));
        console.log(`  ${chalk.white(uptime.formatted)}`);

        // CPU
        console.log(header('CPU'));
        for (const core of cpu) {
            const label = core.name === 'cpu'
                ? chalk.bold('  Overall')
                : chalk.gray(`  ${core.name}   `);
            console.log(`${label}  ${bar(core.usage)}`);
        }

        // Memory
        console.log(header('Memory'));
        console.log(`  ${chalk.bold('RAM')}    ${bar(memory.ram.percent)}  ${chalk.gray(`${memory.ram.used}MB / ${memory.ram.total}MB`)}`);
        if (memory.swap.total > 0) {
            console.log(`  ${chalk.bold('Swap')}   ${bar(memory.swap.percent)}  ${chalk.gray(`${memory.swap.used}MB / ${memory.swap.total}MB`)}`);
        } else {
            console.log(`  ${chalk.bold('Swap')}   ${chalk.gray('not configured')}`);
        }

        // Disk Usage
        console.log(header('Disk Usage'));
        for (const part of disk.usage) {
            console.log(`  ${chalk.bold(part.mounted.padEnd(15))} ${bar(part.percent)}  ${chalk.gray(`${part.used} / ${part.size}`)}`);
        }

        // Inodes
        console.log(header('Inodes'));
        for (const part of disk.inodes) {
            const pct = isNaN(part.percent) || part.percent === null ? 0 : part.percent;
            console.log(`  ${chalk.bold(part.mounted.padEnd(15))} ${bar(pct)}  ${chalk.gray(`${part.used} / ${part.size}`)}`);
        }

        // Disk I/O
        console.log(header('Disk I/O'));
        for (const d of diskIO) {
            console.log(`  ${chalk.bold(d.name.padEnd(10))} ${chalk.green('R')} ${formatDiskRate(d.readPerSec).padStart(12)}   ${chalk.red('W')} ${formatDiskRate(d.writePerSec).padStart(12)}`);
        }

        // Network
        console.log(header('Network'));
        for (const iface of network) {
            console.log(`  ${chalk.bold(iface.name.padEnd(10))} ${chalk.green('↓')} ${formatBytesRate(iface.rxPerSec).padStart(12)}   ${chalk.red('↑')} ${formatBytesRate(iface.txPerSec).padStart(12)}`);
        }

        // Processes
        console.log(header('Processes'));
        console.log(`  ${chalk.bold('Total')}        ${chalk.white(processes.total)}`);
        console.log(`  ${chalk.bold('Zombies')}      ${processes.zombies === 0 ? chalk.green(0) : chalk.red(processes.zombies)}`);
        console.log(`  ${chalk.bold('Spawn rate')}   ${chalk.white(processes.spawnRate + '/s')}`);
        console.log(`  ${chalk.bold('Root')}         ${chalk.yellow(processes.rootCount)} processes`);
        for (const p of processes.rootProcesses) {
            console.log(`    ${chalk.gray(String(p.pid).padStart(6))}  ${p.name}`);
        }

        console.log('');
    });

export default resources;