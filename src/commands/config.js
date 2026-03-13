import { Command } from 'commander';
import chalk from 'chalk';
import { configGet, configSet, configList, configInit } from '../utils/config.js';
import { createInterface } from 'readline';

function header(title) {
    return '\n' + chalk.bold.cyan(`── ${title} ──`);
}

function ask(rl, question, defaultVal) {
    const def = defaultVal ? chalk.gray(` (${defaultVal})`) : '';
    return new Promise(resolve => {
        rl.question(`  ${question}${def}: `, answer => {
            resolve(answer.trim() || defaultVal || '');
        });
    });
}

const config = new Command('config')
    .description('Manage xairas configuration');

config
    .command('init')
    .description('Interactive configuration wizard')
    .action(async () => {
        console.log(chalk.bold.white('\n⚡ Xairas Configuration Wizard\n'));

        const rl = createInterface({ input: process.stdin, output: process.stdout });

        configInit();

        // Telegram
        console.log(header('Telegram'));
        const tgUrl = await ask(rl, 'API URL', configGet('telegram.apiUrl'));
        const tgToken = await ask(rl, 'Bot Token', '');
        const tgChat = await ask(rl, 'Chat ID', configGet('telegram.chatId'));

        if (tgUrl) configSet('telegram.apiUrl', tgUrl);
        if (tgToken) configSet('telegram.botToken', tgToken);
        if (tgChat) configSet('telegram.chatId', tgChat);

        // Email
        console.log(header('Email (SMTP)'));
        const emHost = await ask(rl, 'SMTP Host', configGet('email.host'));
        const emPort = await ask(rl, 'SMTP Port', String(configGet('email.port')));
        const emUser = await ask(rl, 'Username', '');
        const emPass = await ask(rl, 'Password', '');
        const emFrom = await ask(rl, 'From address', configGet('email.from'));
        const emTo = await ask(rl, 'To address', configGet('email.to'));

        if (emHost) configSet('email.host', emHost);
        if (emPort) configSet('email.port', parseInt(emPort));
        if (emUser) configSet('email.username', emUser);
        if (emPass) configSet('email.password', emPass);
        if (emFrom) configSet('email.from', emFrom);
        if (emTo) configSet('email.to', emTo);

        // Report
        console.log(header('Daily Report'));
        let repTime = await ask(rl, 'Send time (HH:MM)', configGet('report.dailyTime'));
        if (repTime && /^\d{1,2}:\d{2}$/.test(repTime)) {
            const [h, m] = repTime.split(':');
            repTime = h.padStart(2, '0') + ':' + m;
        }
        const repTz = await ask(rl, 'Timezone', configGet('report.timezone'));

        if (repTime) configSet('report.dailyTime', repTime);
        if (repTz) configSet('report.timezone', repTz);

        rl.close();

        console.log(chalk.green('\n  ✓ Configuration saved to /etc/xairas/config.json\n'));
    });

config
    .command('set <key> <value>')
    .description('Set a config value')
    .action((key, value) => {
        if (key === 'report.dailyTime' && /^\d{1,2}:\d{2}$/.test(value)) {
            const [h, m] = value.split(':');
            value = h.padStart(2, '0') + ':' + m;
        }
        configSet(key, value);
        console.log(chalk.green(`  ✓ ${key} updated`));
    });

config
    .command('get <key>')
    .description('Get a config value')
    .action((key) => {
        const value = configGet(key);
        if (value === undefined) {
            console.log(chalk.red(`  ✗ Unknown key: ${key}`));
        } else {
            console.log(`  ${key} = ${value}`);
        }
    });

config
    .command('list')
    .description('Show all config values')
    .action(() => {
        console.log(chalk.bold.white('\n⚡ Xairas Configuration\n'));
        const all = configList();
        for (const [key, value] of Object.entries(all)) {
            const display = value === '********' ? chalk.yellow(value) : chalk.white(String(value));
            console.log(`  ${chalk.gray(key.padEnd(25))} ${display}`);
        }
        console.log('');
    });

export default config;