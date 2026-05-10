import cron from 'node-cron';
import { sendBillRemindersForToday } from '../services/notificationService.js';

/**
 * Schedules the recurring-bill reminder sweep.
 *
 * Runs every day at 09:00 server time. The sweep is idempotent thanks to
 * `RecurringBill.lastRemindedFor`, so accidental double runs (e.g. server
 * restart) won't double-send.
 *
 * Cron expression: minute hour dayOfMonth month dayOfWeek
 *   "0 9 * * *" → 09:00 every day
 */
export const startBillReminderJob = () => {
  // Optional manual run on boot (helps verify config in dev). Comment out if noisy.
  if (process.env.RUN_BILL_REMINDERS_ON_BOOT === 'true') {
    sendBillRemindersForToday()
      .then((n) => console.log(`[billReminderJob] boot sweep sent ${n} reminders`))
      .catch((err) => console.error('[billReminderJob] boot sweep failed:', err));
  }

  cron.schedule(
    '0 9 * * *',
    async () => {
      try {
        const sent = await sendBillRemindersForToday();
        console.log(`[billReminderJob] daily sweep sent ${sent} reminders`);
      } catch (err) {
        console.error('[billReminderJob] daily sweep failed:', err);
      }
    },
    { timezone: process.env.TZ || undefined }
  );

  console.log('[billReminderJob] scheduled daily at 09:00');
};
