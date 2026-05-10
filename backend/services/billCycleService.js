import RecurringBill from '../models/RecurringBill.js';

// ────────────────────────────────────────────────────────────────────────────
// CYCLE MATH
// ────────────────────────────────────────────────────────────────────────────

const monthIndex = (d) => d.getFullYear() * 12 + d.getMonth();

const dueDateInMonth = (year, month, dueDay) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dueDay, lastDay));
};

// "Closest" of three candidate due dates (prev / this / next month) to the
// given timestamp. Used to decide which monthly cycle a payment satisfies.
// Closest works correctly for both early payments (paid Apr 30 for May 1 due)
// and late payments (paid May 15 for May 10 due).
const closestMonthlyDueDate = (timestamp, dueDay) => {
  const ref = new Date(timestamp);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const candidates = [-1, 0, 1].map((offset) => {
    const total = m + offset;
    const cy = y + Math.floor(total / 12);
    const cm = ((total % 12) + 12) % 12;
    return dueDateInMonth(cy, cm, dueDay);
  });
  let best = candidates[0];
  let bestDist = Math.abs(ref - best);
  for (const c of candidates.slice(1)) {
    const d = Math.abs(ref - c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
};

// The due date that anchors the cycle "now" is currently inside.
// Before this month's dueDay → previous month's dueDate is the active anchor.
// On or after this month's dueDay → this month's dueDate is the active anchor.
const currentMonthlyCycleAnchor = (now, dueDay) => {
  const y = now.getFullYear();
  const m = now.getMonth();
  const dueThis = dueDateInMonth(y, m, dueDay);
  if (now >= dueThis) return dueThis;
  const total = m - 1;
  const py = y + Math.floor(total / 12);
  const pm = ((total % 12) + 12) % 12;
  return dueDateInMonth(py, pm, dueDay);
};

// ────────────────────────────────────────────────────────────────────────────
// RESET DECISION
// ────────────────────────────────────────────────────────────────────────────

const shouldResetBill = (bill, now) => {
  if (!bill.isPaid || !bill.paidAt) return false;
  const freq = bill.frequency || 'monthly';
  const paidAt = new Date(bill.paidAt);
  if (Number.isNaN(paidAt.getTime())) return false;

  if (freq === 'monthly') {
    const satisfied = closestMonthlyDueDate(paidAt, bill.dueDay);
    const current = currentMonthlyCycleAnchor(now, bill.dueDay);
    // Reset only when "now" has moved into a strictly later cycle than the
    // one the payment satisfied. Same cycle (paid early or late) → keep paid.
    return monthIndex(current) > monthIndex(satisfied);
  }

  if (freq === 'weekly') {
    const ms7 = 7 * 24 * 60 * 60 * 1000;
    return now.getTime() - paidAt.getTime() >= ms7;
  }

  if (freq === 'yearly') {
    return now.getFullYear() > paidAt.getFullYear();
  }

  return false;
};

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scans bills matching `filter` and flips any whose paid status belongs to a
 * past cycle back to unpaid (clearing paidAt and lastRemindedFor so a fresh
 * reminder can fire for the new cycle). Returns the number reset.
 *
 * Called from:
 *   - recurringBillController.getBills (filter by user) — lazy reset on page open
 *   - notificationService.sendBillRemindersForToday (no filter) — eager reset
 *     before the daily reminder sweep so renewed bills get reminded immediately
 */
export const autoResetExpiredBills = async (filter = {}) => {
  const bills = await RecurringBill.find({
    ...filter,
    isPaid: true,
    paidAt: { $ne: null },
  });

  const now = new Date();
  let reset = 0;

  for (const bill of bills) {
    if (shouldResetBill(bill, now)) {
      bill.isPaid = false;
      bill.paidAt = null;
      bill.lastRemindedFor = '';
      await bill.save();
      reset += 1;
    }
  }

  return reset;
};
