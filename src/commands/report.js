import { Command } from 'commander';
import chalk from 'chalk';
import { collectReport, buildEmailHtml, buildTelegramText } from '../utils/report.js';
import { sendEmail, sendTelegram } from '../utils/notify.js';
import { configGet } from '../utils/config.js';

const report = new Command('report')
    .description('Send a full system report now')
    .action(async () => {
        const hasTelegram = configGet('telegram.botToken') && configGet('telegram.chatId');
        const hasEmail = configGet('email.host') && configGet('email.to');

        if (!hasTelegram && !hasEmail) {
            console.log(chalk.red('\n  ✗ No notification channels configured.'));
            console.log(chalk.gray('  Run: sudo xairas config init\n'));
            return;
        }

        console.log(chalk.bold.white('\n⚡ Xairas Report\n'));
        console.log(chalk.gray('  Collecting data...'));

        const data = await collectReport();

        if (hasEmail) {
            try {
                console.log(chalk.gray('  Sending email...'));
                const result = await sendEmail('⚡ Xairas Daily Report — ' + data.host, buildEmailHtml(data));
                console.log(chalk.green(`  ✓ Email sent (${result.messageId})`));
            } catch (err) {
                console.log(chalk.red(`  ✗ Email failed: ${err.message}`));
            }
        }

        if (hasTelegram) {
            try {
                console.log(chalk.gray('  Sending telegram...'));
                const result = await sendTelegram(buildTelegramText(data));
                if (result.ok) {
                    console.log(chalk.green('  ✓ Telegram sent'));
                } else {
                    console.log(chalk.red(`  ✗ Telegram failed: ${result.description}`));
                }
            } catch (err) {
                console.log(chalk.red(`  ✗ Telegram failed: ${err.message}`));
            }
        }

        console.log('');
    });

export default report;