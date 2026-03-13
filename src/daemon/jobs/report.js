import { collectReport, buildEmailHtml, buildTelegramText } from '../../utils/report.js';
import { sendEmail, sendTelegram } from '../../utils/notify.js';
import { configGet } from '../../utils/config.js';

export const reportJob = {
    name: 'daily-report',

    shouldRun(currentTime) {
        const dailyTime = configGet('report.dailyTime') || '08:00';
        return currentTime === dailyTime;
    },

    async run() {
        const data = await collectReport();

        const hasEmail = configGet('email.host') && configGet('email.to');
        const hasTelegram = configGet('telegram.botToken') && configGet('telegram.chatId');

        if (hasEmail) {
            try {
                const result = await sendEmail('⚡ Xairas Daily Report — ' + data.host, buildEmailHtml(data));
                console.log(`[xairas] email sent: ${result.messageId}`);
            } catch (err) {
                console.error(`[xairas] email failed: ${err.message}`);
            }
        }

        if (hasTelegram) {
            try {
                const result = await sendTelegram(buildTelegramText(data));
                if (result.ok) {
                    console.log('[xairas] telegram sent');
                } else {
                    console.error(`[xairas] telegram failed: ${result.description}`);
                }
            } catch (err) {
                console.error(`[xairas] telegram failed: ${err.message}`);
            }
        }
    }
};