/**
 * Manual test for the bill auto-reset cycle logic.
 *
 * Backdates every currently-paid bill's `paidAt` by ~40 days (well past one
 * monthly cycle), then invokes autoResetExpiredBills and prints what changed.
 *
 * Usage (from project root):
 *     node backend/scripts/testBillReset.js
 *
 * Optional: pass an email to scope to one user:
 *     node backend/scripts/testBillReset.js you@example.com
 *
 * After it runs, open the /bills page in the browser → previously paid bills
 * should appear as unpaid. Then mark one as Paid again to restore normal state.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import RecurringBill from '../models/RecurringBill.js';
import User from '../models/User.js';
import { autoResetExpiredBills } from '../services/billCycleService.js';

// Load backend/.env regardless of which directory the script is invoked from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

const main = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing from .env'); process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const filter = {};
  const emailArg = process.argv[2];
  if (emailArg) {
    const user = await User.findOne({ email: emailArg.toLowerCase().trim() }).lean();
    if (!user) {
      console.error(`No user with email ${emailArg}`); process.exit(1);
    }
    filter.userId = user._id;
    console.log(`Scoped to user ${user.email} (${user._id})`);
  }

  // Snapshot before
  const before = await RecurringBill.find({ ...filter, isPaid: true }).lean();
  if (before.length === 0) {
    console.log('No paid bills found. Mark a bill as Paid first, then re-run.');
    await mongoose.disconnect();
    return;
  }

  console.log(`\nFound ${before.length} paid bill(s):`);
  before.forEach((b) =>
    console.log(`  • ${b.name} | dueDay=${b.dueDay} | paidAt=${fmt(b.paidAt)}`)
  );

  // Backdate paidAt by ~75 days. Why 75 and not, say, 30? With 30 days, if the
  // bill's dueDay is later in the month than today, "30 days ago" can land
  // closest to the still-active cycle's dueDate (e.g., today=May 8, dueDay=9 →
  // current cycle anchor is April 9; paidAt March 29 is also closest to April 9
  // → no reset, which is technically correct but useless for testing). 75 days
  // unambiguously falls 2+ cycles back for any dueDay.
  const backdate = new Date(Date.now() - 75 * 24 * 60 * 60 * 1000);
  await RecurringBill.updateMany(
    { _id: { $in: before.map((b) => b._id) } },
    { $set: { paidAt: backdate } }
  );
  console.log(`\nBackdated paidAt to ${fmt(backdate)} for ${before.length} bill(s).`);

  // Run the reset that getBills / cron would normally trigger
  const resetCount = await autoResetExpiredBills(filter);
  console.log(`\nautoResetExpiredBills reset ${resetCount} bill(s).`);

  // Snapshot after
  const after = await RecurringBill.find({
    _id: { $in: before.map((b) => b._id) },
  }).lean();
  console.log('\nResult:');
  after.forEach((b) =>
    console.log(
      `  • ${b.name} → isPaid=${b.isPaid} | paidAt=${fmt(b.paidAt)} | lastRemindedFor="${b.lastRemindedFor || ''}"`
    )
  );

  const success = resetCount === before.length;
  console.log(
    `\n${success ? '✅ PASS' : '❌ FAIL'} — expected ${before.length} reset, got ${resetCount}`
  );

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
