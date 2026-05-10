import User from '../models/User.js';
import Pot from '../models/Pot.js';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import { sendEmail } from '../utils/sendEmail.js';
import { generateMotivationalLine } from './aiCopywriter.js';

// ────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ────────────────────────────────────────────────────────────────────────────

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' TL';

const todayIso = (d = new Date()) => {
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const currentPeriod = (d = new Date()) => {
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

// Modern email shell: top accent bar + brand mark + content card + footer.
// Built with table-friendly inline styles so Gmail / Outlook / Apple Mail
// render it consistently. No external CSS, no fonts, no images.
const buildHtmlShell = ({ title, eyebrow, accent, bodyHtml }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f3f4f6" style="background:#f3f4f6; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,0.06);">
          <!-- Accent strip -->
          <tr>
            <td style="height:6px; background:${accent}; line-height:6px; font-size:0;">&nbsp;</td>
          </tr>
          <!-- Brand row -->
          <tr>
            <td style="padding:22px 32px 0 32px;">
              <div style="font-size:12px; font-weight:700; letter-spacing:1.5px; color:#94a3b8; text-transform:uppercase;">
                FinanceApp${eyebrow ? ` · <span style="color:${accent};">${eyebrow}</span>` : ''}
              </div>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding:8px 32px 4px 32px;">
              <h1 style="margin:0; font-size:24px; line-height:1.25; color:#0f172a; font-weight:700;">${title}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:16px 32px 28px 32px; color:#334155; font-size:15px; line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 24px 32px; border-top:1px solid #f1f5f9;">
              <div style="font-size:12px; color:#94a3b8; line-height:1.5;">
                FinanceApp · Automated alert. You're receiving this because of activity on your account.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// HTML-email-safe progress bar. Two stacked divs work everywhere; we keep the
// inner bar capped at 100% so an over-limit budget still renders cleanly.
const renderProgressBar = (percent, color) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return `
    <div style="background:#e5e7eb; border-radius:999px; height:8px; overflow:hidden; margin:8px 0;">
      <div style="background:${color}; width:${clamped}%; height:8px; border-radius:999px;"></div>
    </div>
  `;
};

// Stat card used inside emails to highlight the key numbers.
const renderStatCard = ({ label, value, accent, subtext, progress }) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; margin:18px 0;">
    <tr>
      <td style="padding:18px 20px;">
        <div style="font-size:11px; font-weight:600; letter-spacing:1px; color:#64748b; text-transform:uppercase; margin-bottom:6px;">${label}</div>
        <div style="font-size:22px; font-weight:700; color:#0f172a; line-height:1.2;">${value}</div>
        ${progress ? renderProgressBar(progress.percent, progress.color || accent) : ''}
        ${subtext ? `<div style="font-size:13px; color:#475569; margin-top:${progress ? 4 : 8}px;">${subtext}</div>` : ''}
      </td>
    </tr>
  </table>
`;

// Resolve recipient (email + display name) from a userId. Returns null if missing.
const resolveRecipient = async (userId) => {
  const user = await User.findById(userId).select('email displayName').lean();
  if (!user || !user.email) return null;
  return {
    email: user.email,
    name: (user.displayName || '').trim() || 'there',
  };
};

// ────────────────────────────────────────────────────────────────────────────
// 1) POT MILESTONES (50% / 90% / 100%)
// ────────────────────────────────────────────────────────────────────────────

const potMilestoneCopy = {
  50: {
    accent: '#0d9488',
    subjectFn: (n) => `${n}, you're halfway to your goal! 🎯`,
    title: 'Halfway there!',
    fallback: (n) => `${n}, you've reached the 50% mark — momentum is on your side. Keep going.`,
  },
  90: {
    accent: '#0284c7',
    subjectFn: (n) => `${n}, you're almost there — 90% reached!`,
    title: 'So close to the finish line',
    fallback: (n) => `${n}, only 10% of your goal remains. One more push and you're done.`,
  },
  100: {
    accent: '#16a34a',
    subjectFn: (n) => `Congratulations ${n}! Goal completed 🎉`,
    title: 'Goal complete!',
    fallback: (n) => `${n}, you did it. You hit your savings target — time to celebrate the win.`,
  },
};

const computePotTier = (saved, target) => {
  if (!target || target <= 0) return 0;
  const ratio = saved / target;
  if (ratio >= 1) return 100;
  if (ratio >= 0.9) return 90;
  if (ratio >= 0.5) return 50;
  return 0;
};

/**
 * Recomputes pot tier from current saved/target. Fires email when the new tier
 * is HIGHER than the previously-recorded tier (a fresh climb). Drops the stored
 * tier when ratio falls below it so a future climb re-fires the same email.
 *
 * Trigger this AFTER any save change (createPot / updatePot).
 */
export const checkPotMilestone = async (potDoc) => {
  if (!potDoc) return;
  const pot = potDoc.toObject ? potDoc.toObject() : potDoc;

  const newTier = computePotTier(pot.saved, pot.target);
  const prevTier = pot.milestoneTier || 0;

  // No change in bucket → nothing to do.
  if (newTier === prevTier) return;

  // Drop without sending — user withdrew below the previous milestone.
  if (newTier < prevTier) {
    await Pot.findByIdAndUpdate(pot._id, { milestoneTier: newTier });
    return;
  }

  // Climbed into a new bucket. Only fire the HIGHEST milestone crossed:
  // a jump from 30% → 100% should send the "Goal complete!" email alone,
  // not 50%/90%/100% in sequence.
  const recipient = await resolveRecipient(pot.userId);
  if (recipient) {
    await sendPotEmail({ recipient, pot, tier: newTier });
  }

  await Pot.findByIdAndUpdate(pot._id, { milestoneTier: newTier });
};

const sendPotEmail = async ({ recipient, pot, tier }) => {
  const copy = potMilestoneCopy[tier];
  if (!copy) return;

  const aiLine = await generateMotivationalLine({
    kind: 'pot_milestone',
    userName: recipient.name,
    fallback: copy.fallback(recipient.name),
    context: {
      potName: pot.name,
      target: pot.target,
      saved: pot.saved,
      percent: tier,
    },
  });

  const bodyHtml = `
    <p style="margin:0 0 4px 0;">${aiLine}</p>
    ${renderStatCard({
      label: `Pot · ${pot.name}`,
      value: `${fmtMoney(pot.saved)} <span style="color:#94a3b8; font-weight:500; font-size:16px;">/ ${fmtMoney(pot.target)}</span>`,
      accent: copy.accent,
      progress: { percent: tier, color: copy.accent },
      subtext: `${tier}% of goal reached`,
    })}
  `;

  try {
    await sendEmail({
      email: recipient.email,
      subject: copy.subjectFn(recipient.name),
      message: buildHtmlShell({
        title: copy.title,
        eyebrow: `Pot ${tier}%`,
        accent: copy.accent,
        bodyHtml,
      }),
    });
  } catch (err) {
    console.error(`[notify] pot ${tier}% email failed:`, err.message);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// 2) BUDGET THRESHOLDS (50% / 90% of monthly limit)
// ────────────────────────────────────────────────────────────────────────────

const budgetThresholdCopy = {
  50: {
    accent: '#f59e0b',
    subjectFn: (n, cat) => `Heads up ${n}: ${cat} budget is half-spent`,
    title: 'You are at the halfway mark',
    eyebrow: 'Budget 50%',
    fallback: (n, cat) =>
      `${n}, half of your ${cat} budget is gone for this month. Keep an eye on the next purchases so you don't overshoot.`,
  },
  90: {
    accent: '#ef4444',
    subjectFn: (n, cat) => `${n}, your ${cat} budget is almost gone`,
    title: 'You are about to hit the limit',
    eyebrow: 'Budget 90%',
    fallback: (n, cat) =>
      `${n}, you've burned through 90% of your ${cat} budget. One more careless spend and you're over the limit.`,
  },
  100: {
    accent: '#b91c1c',
    subjectFn: (n, cat) => `🚨 ${n}, you've blown past your ${cat} budget`,
    title: 'Budget limit exceeded',
    eyebrow: 'Over budget',
    fallback: (n, cat) =>
      `${n}, your ${cat} spending has crossed the monthly limit. Stop the bleeding now — every extra spend is straight overshoot.`,
  },
};

const computeBudgetTier = (spent, limit) => {
  if (!limit || limit <= 0) return 0;
  const ratio = spent / limit;
  if (ratio >= 1.0) return 100;
  if (ratio >= 0.9) return 90;
  if (ratio >= 0.5) return 50;
  return 0;
};

// Sum expenses by their server-side creation timestamp (Transaction.createdAt,
// stored as a Number in ms). We deliberately do NOT use Transaction.date because
// the AddTransactionForm sends "YYYY-MM-DD" which becomes 00:00 UTC — that loses
// the actual moment the user logged the expense and breaks any clamping against
// budget.createdAt within the same day.
const sumExpensesByEntryTime = async (userId, category, fromMs, toMs) => {
  const txns = await Transaction.find({
    userId,
    type: 'expense',
    category,
    createdAt: { $gte: fromMs, $lte: toMs },
  })
    .select('amount')
    .lean();
  return txns.reduce((acc, t) => acc + Number(t.amount || 0), 0);
};

const monthBounds = (d = new Date()) => {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const dayBounds = (d = new Date()) => {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
};

// Returns the millisecond timestamp from which expenses should start counting
// for this budget: the later of the calendar window start and the exact moment
// the budget was created. Because we now query by Transaction.createdAt (the
// real entry timestamp, not the user-picked date), this clamp can be strict
// to the second — same-day pre-budget entries are excluded, post-budget
// entries (whatever date the user picked) are included.
const clampMsToBudgetStart = (startMs, budget) => {
  const createdMs = Number(budget?.createdAt);
  if (!createdMs || Number.isNaN(createdMs)) return startMs;
  return createdMs > startMs ? createdMs : startMs;
};

/**
 * Called after a transaction create/update/delete. For each budget matching the
 * affected category, recomputes month-to-date spend and:
 *   - fires 50% / 90% threshold emails when crossing UP into a new bucket,
 *   - drops the stored tier (or resets on month rollover) so re-climbs re-fire,
 *   - fires a "daily spike" email if the day's spending alone exceeds 20% of
 *     the monthly limit (once per category per day).
 */
export const checkBudgetForCategory = async (userId, category) => {
  if (!userId || !category) return;

  const budget = await Budget.findOne({ userId, category });
  if (!budget) return;

  const now = new Date();
  const period = currentPeriod(now);
  const { start: monthStart, end: monthEnd } = monthBounds(now);
  const { start: dayStart, end: dayEnd } = dayBounds(now);

  // Strict-to-the-second clamp: only count expenses logged AFTER the budget
  // was created. The "background clock" the user asked for: if budget was
  // opened at 13:11, anything logged before 13:11 is invisible to the alert.
  const monthFromMs = clampMsToBudgetStart(monthStart.getTime(), budget);
  const dayFromMs = clampMsToBudgetStart(dayStart.getTime(), budget);
  const monthEndMs = monthEnd.getTime();
  const dayEndMs = dayEnd.getTime();

  const monthSpent = await sumExpensesByEntryTime(userId, category, monthFromMs, monthEndMs);
  const todaySpent = await sumExpensesByEntryTime(userId, category, dayFromMs, dayEndMs);

  // ─── Monthly threshold transitions ────────────────────────────────────────
  const newTier = computeBudgetTier(monthSpent, budget.limit);
  // If the calendar month changed since last tier was set, treat prior tier as 0.
  const effectivePrevTier =
    budget.monthlyMilestonePeriod === period ? budget.monthlyMilestoneTier || 0 : 0;

  const recipient = await resolveRecipient(userId);

  // Diagnostic: if spent is 0, dump nearby categories so we can spot
  // casing/spelling mismatches between the budget and txns.
  let nearbyCategoriesNote = '';
  if (monthSpent === 0) {
    const recentExpenses = await Transaction.find({
      userId,
      type: 'expense',
      createdAt: { $gte: monthFromMs, $lte: monthEndMs },
    })
      .select('category amount createdAt')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();
    const uniqueCats = [...new Set(recentExpenses.map((t) => `"${t.category}"`))];
    nearbyCategoriesNote =
      ` | recent_expense_cats_in_window=[${uniqueCats.join(', ') || 'none'}] ` +
      `(budget looks for exactly "${category}")`;
  }

  console.log(
    `[budget-notify] ${category} | spent=${monthSpent}/${budget.limit} ` +
      `(today=${todaySpent}) | tier ${effectivePrevTier}→${newTier} | ` +
      `recipient=${recipient?.email || 'NONE'} | ` +
      `monthFrom=${new Date(monthFromMs).toISOString()}` +
      nearbyCategoriesNote
  );

  // Only fire the highest tier crossed. Jumping 0% → 92% in one transaction
  // sends just the 90% email; the 50% one would be noise after the bigger alarm.
  if (newTier > effectivePrevTier && recipient) {
    await sendBudgetThresholdEmail({ recipient, budget, tier: newTier, monthSpent });
  }

  // Persist tier + period (also clamps tier down on month rollover or refunds).
  if (
    newTier !== budget.monthlyMilestoneTier ||
    period !== budget.monthlyMilestonePeriod
  ) {
    await Budget.findByIdAndUpdate(budget._id, {
      monthlyMilestoneTier: newTier,
      monthlyMilestonePeriod: period,
    });
  }

  // ─── Daily-spike alert (today's spend ≥ 20% of monthly limit) ─────────────
  const dailyRatio = budget.limit > 0 ? todaySpent / budget.limit : 0;
  const todayKey = todayIso(now);
  if (dailyRatio >= 0.2 && budget.dailyAlertDate !== todayKey && recipient) {
    await sendBudgetDailySpikeEmail({
      recipient,
      budget,
      todaySpent,
      dailyRatio,
    });
    await Budget.findByIdAndUpdate(budget._id, { dailyAlertDate: todayKey });
  }
};

const sendBudgetThresholdEmail = async ({ recipient, budget, tier, monthSpent }) => {
  const copy = budgetThresholdCopy[tier];
  if (!copy) return;

  const remaining = budget.limit - monthSpent;
  const overspend = remaining < 0 ? Math.abs(remaining) : 0;
  const actualPct = budget.limit > 0 ? Math.round((monthSpent / budget.limit) * 100) : 0;

  // Subtext changes when over the limit: show overspend amount instead of remaining.
  const subtext =
    tier === 100
      ? `Over budget by <strong style="color:${copy.accent};">${fmtMoney(overspend)}</strong> · ${actualPct}% used`
      : `Remaining: <strong>${fmtMoney(Math.max(remaining, 0))}</strong> · ${actualPct}% used`;

  const aiLine = await generateMotivationalLine({
    kind:
      tier === 100
        ? 'budget_overlimit'
        : tier >= 90
        ? 'budget_critical'
        : 'budget_warning',
    userName: recipient.name,
    fallback: copy.fallback(recipient.name, budget.category),
    context: {
      category: budget.category,
      limit: budget.limit,
      spent: monthSpent,
      remaining: Math.max(remaining, 0),
      overspend,
      percent: actualPct,
    },
  });

  const bodyHtml = `
    <p style="margin:0 0 4px 0;">${aiLine}</p>
    ${renderStatCard({
      label: `Budget · ${budget.category}`,
      value: `${fmtMoney(monthSpent)} <span style="color:#94a3b8; font-weight:500; font-size:16px;">/ ${fmtMoney(budget.limit)}</span>`,
      accent: copy.accent,
      progress: { percent: actualPct, color: copy.accent },
      subtext,
    })}
  `;

  try {
    await sendEmail({
      email: recipient.email,
      subject: copy.subjectFn(recipient.name, budget.category),
      message: buildHtmlShell({
        title: copy.title,
        eyebrow: copy.eyebrow,
        accent: copy.accent,
        bodyHtml,
      }),
    });
  } catch (err) {
    console.error(`[notify] budget ${tier}% email failed:`, err.message);
  }
};

const sendBudgetDailySpikeEmail = async ({ recipient, budget, todaySpent, dailyRatio }) => {
  const accent = '#dc2626';
  const pct = Math.round(dailyRatio * 100);
  const fallback =
    `${recipient.name}, you spent ${fmtMoney(todaySpent)} on ${budget.category} today — ` +
    `that's ${pct}% of the entire monthly budget in a single day. ` +
    `At this pace you'll blow through the limit before month-end. Slow down.`;

  const aiLine = await generateMotivationalLine({
    kind: 'budget_daily_spike',
    userName: recipient.name,
    fallback,
    context: {
      category: budget.category,
      limit: budget.limit,
      todaySpent,
      dailyPercent: pct,
    },
  });

  const bodyHtml = `
    <p style="margin:0 0 4px 0;">${aiLine}</p>
    ${renderStatCard({
      label: `Today's ${budget.category} spend`,
      value: fmtMoney(todaySpent),
      accent,
      progress: { percent: pct, color: accent },
      subtext: `${pct}% of the monthly ${budget.category} budget (${fmtMoney(budget.limit)}) — in a single day.`,
    })}
  `;

  try {
    await sendEmail({
      email: recipient.email,
      subject: `${recipient.name}, big spend today on ${budget.category}`,
      message: buildHtmlShell({
        title: 'Daily spend warning',
        eyebrow: 'Daily spike',
        accent,
        bodyHtml,
      }),
    });
  } catch (err) {
    console.error('[notify] daily spike email failed:', err.message);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// 3) RECURRING BILL "DUE TOMORROW" REMINDER (cron-driven)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Computes the next concrete due Date for a bill, starting from `from` (default: today).
 * Handles months that don't have the bill's dueDay (clamps to month-end).
 */
const nextDueDate = (bill, from = new Date()) => {
  const freq = bill.frequency || 'monthly';

  if (freq === 'monthly') {
    const year = from.getFullYear();
    const month = from.getMonth();
    const lastDayThisMonth = new Date(year, month + 1, 0).getDate();
    const dayThisMonth = Math.min(bill.dueDay, lastDayThisMonth);
    const candidate = new Date(year, month, dayThisMonth);
    if (candidate >= startOfDay(from)) return candidate;
    const lastDayNextMonth = new Date(year, month + 2, 0).getDate();
    return new Date(year, month + 1, Math.min(bill.dueDay, lastDayNextMonth));
  }

  if (freq === 'weekly') {
    // dueDay treated as day-of-month is awkward for weekly; we fall back to
    // "1 week from createdAt anchor" — but since createdAt is a number, we
    // compute the next 7-day boundary on or after `from`. Good enough for v1.
    const c = new Date(bill.createdAt || Date.now());
    const candidate = new Date(c);
    while (candidate < startOfDay(from)) {
      candidate.setDate(candidate.getDate() + 7);
    }
    return candidate;
  }

  if (freq === 'yearly') {
    const year = from.getFullYear();
    const month = from.getMonth();
    const candidate = new Date(year, month, bill.dueDay);
    if (candidate >= startOfDay(from)) return candidate;
    return new Date(year + 1, month, bill.dueDay);
  }

  return new Date(from);
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const daysBetween = (a, b) => {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
};

/**
 * Single-bill reminder check. Fires a reminder email if the bill is unpaid AND
 * its next due date is 0–1 days away AND we haven't already reminded for that
 * due date. Idempotent via `lastRemindedFor` dedup.
 *
 * Used both by the daily cron sweep AND by createBill/updateBill so a freshly
 * added bill that already falls in the 1-day window gets its mail immediately
 * instead of waiting until 09:00 the next day.
 *
 * Returns true if a mail was sent, false otherwise.
 */
export const processBillReminder = async (bill, now = new Date()) => {
  if (!bill || bill.isPaid) return false;

  const due = nextDueDate(bill, now);
  const days = daysBetween(now, due);
  if (days < 0 || days > 1) return false;

  const dueIso = todayIso(due);
  if (bill.lastRemindedFor === dueIso) return false;

  const recipient = await resolveRecipient(bill.userId);
  if (!recipient) return false;

  await sendBillReminderEmail({ recipient, bill, due, daysUntilDue: days });

  const RecurringBill = (await import('../models/RecurringBill.js')).default;
  await RecurringBill.findByIdAndUpdate(bill._id, { lastRemindedFor: dueIso });
  return true;
};

/**
 * Daily cron sweep: auto-resets expired paid bills, then runs processBillReminder
 * for every unpaid bill across all users. Safe to invoke multiple times per day.
 */
export const sendBillRemindersForToday = async () => {
  const RecurringBill = (await import('../models/RecurringBill.js')).default;
  const { autoResetExpiredBills } = await import('./billCycleService.js');
  const now = new Date();

  // Flip cycle-expired paid bills back to unpaid first.
  await autoResetExpiredBills();

  const bills = await RecurringBill.find({ isPaid: false }).lean();
  let sent = 0;

  for (const bill of bills) {
    try {
      if (await processBillReminder(bill, now)) sent += 1;
    } catch (err) {
      console.error('[notify] bill reminder loop error:', err.message);
    }
  }

  return sent;
};

const sendBillReminderEmail = async ({ recipient, bill, due, daysUntilDue }) => {
  const isToday = daysUntilDue === 0;
  const accent = isToday ? '#dc2626' : '#6366f1';
  const dueLabel = due.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const whenWord = isToday ? 'today' : 'tomorrow';
  const subjectSuffix = isToday ? 'is due TODAY' : 'is due tomorrow';
  const titleText = isToday ? 'Bill due today' : 'Bill due tomorrow';
  const eyebrow = isToday ? 'Due today' : 'Due tomorrow';
  const fallbackLine = isToday
    ? `${recipient.name}, your ${bill.name} bill of ${fmtMoney(bill.amount)} is due today. ` +
      `The deadline is at the door — settle it before the day ends.`
    : `${recipient.name}, only one day left to pay your ${bill.name} bill of ${fmtMoney(bill.amount)}. ` +
      `Make sure you have it covered before tomorrow.`;

  const aiLine = await generateMotivationalLine({
    kind: 'bill_due',
    userName: recipient.name,
    fallback: fallbackLine,
    context: {
      billName: bill.name,
      amount: bill.amount,
      dueDate: dueLabel,
      whenWord,
    },
  });

  const bodyHtml = `
    <p style="margin:0 0 4px 0;">${aiLine}</p>
    ${renderStatCard({
      label: `Bill · ${bill.name}`,
      value: fmtMoney(bill.amount),
      accent,
      subtext: `Due <strong>${dueLabel}</strong> (${whenWord})`,
    })}
  `;

  try {
    await sendEmail({
      email: recipient.email,
      subject: `Reminder ${recipient.name}: ${bill.name} ${subjectSuffix}`,
      message: buildHtmlShell({ title: titleText, eyebrow, accent, bodyHtml }),
    });
  } catch (err) {
    console.error('[notify] bill reminder email failed:', err.message);
  }
};
