#!/usr/bin/env node

import { Scheduler } from './scheduler.js';
import { reportJob } from './jobs/report.js';
import { alertsJob } from './jobs/alerts.js';
import { networkAlertsJob } from './jobs/network-alerts.js';
import { filesystemAlertsJob } from './jobs/filesystem-alerts.js';
import { securityAlertsJob } from './jobs/security-alerts.js';

const scheduler = new Scheduler();

scheduler.register(reportJob);
scheduler.register(alertsJob);
scheduler.register(networkAlertsJob);
scheduler.register(filesystemAlertsJob);
scheduler.register(securityAlertsJob);

console.log('[xairas] daemon started');
scheduler.start();