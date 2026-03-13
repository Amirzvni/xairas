import { configGet } from '../utils/config.js';

export class Scheduler {
    constructor() {
        this.jobs = [];
        this.interval = null;
        this.lastCheck = '';
    }

    register(job) {
        this.jobs.push(job);
        console.log(`[xairas] registered job: ${job.name}`);
    }

    start() {
        // Check every 30 seconds
        this.interval = setInterval(() => this.tick(), 30000);
        this.tick();
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    tick() {
        const tz = configGet('report.timezone') || 'Asia/Tehran';
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        // Prevent running same minute twice
        if (timeStr === this.lastCheck) return;
        this.lastCheck = timeStr;

        for (const job of this.jobs) {
            if (job.shouldRun(timeStr)) {
                console.log(`[xairas] running job: ${job.name} at ${timeStr}`);
                job.run().catch(err => {
                    console.error(`[xairas] job ${job.name} failed:`, err.message);
                });
            }
        }
    }
}