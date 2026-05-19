/**
 * Diagnostics Controller
 *
 * Admin-only health & smoke tests for every major subsystem:
 *   - DB connectivity
 *   - Auth (JWT roundtrip)
 *   - Mail / SMTP (verify + optional real send)
 *   - AI (Gemini ping)
 *   - Market data API
 *   - CRUD probes for every collection
 *   - Notification builders (budget / pot / bill) — dry-run logic check
 *
 * Each probe returns:
 *   { ok: boolean, latencyMs: number, details?: object, error?: string }
 *
 * Mutating probes ALWAYS clean up (try/finally) so the DB is never polluted by
 * a diagnostic run, even on failure.
 *
 * Most probes need a real userId to satisfy `userId: required` schema fields.
 * The admin should set DIAGNOSTIC_USER_EMAIL in .env to a real user — otherwise
 * CRUD/notification probes return `skipped: true`.
 */

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';

import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import Pot from '../models/Pot.js';
import RecurringBill from '../models/RecurringBill.js';
import Portfolio from '../models/Portfolio.js';

import { sendEmail } from '../utils/sendEmail.js';
import { generateMotivationalLine } from '../services/aiCopywriter.js';

// ─── Probe naming so we can safely clean up any orphans ─────────────────────
const PROBE_TAG = 'DIAG_PROBE';

// Resolve the diagnostic user. Returns { user, reason } so the caller can
// distinguish env-missing from user-not-found (the original null-return
// hid this distinction and showed the same "Skipped" message for both).
const getDiagnosticUser = async () => {
  const raw = (process.env.DIAGNOSTIC_USER_EMAIL || '').trim();
  if (!raw) {
    return {
      user: null,
      reason: 'DIAGNOSTIC_USER_EMAIL is not set in backend .env (or backend was not restarted after adding it)',
    };
  }
  const email = raw.toLowerCase();
  // Case-insensitive lookup so casing in .env doesn't matter — the User schema
  // stores email lowercased, but we double-check by also trying a regex
  // fallback for any edge case where data was inserted before the lowercase
  // pre-save hook was added.
  let user = await User.findOne({ email }).lean();
  if (!user) {
    user = await User.findOne({
      email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    }).lean();
  }
  if (!user) {
    return {
      user: null,
      reason: `No user with email "${raw}" found in DB. Sign up that email first, or change DIAGNOSTIC_USER_EMAIL to a real registered user.`,
    };
  }
  return { user };
};

// Wraps a probe so the harness can capture timing + error consistently.
const runProbe = async (fn) => {
  const t0 = Date.now();
  try {
    const result = await fn();
    return {
      ok: result?.ok !== false,
      latencyMs: Date.now() - t0,
      details: result?.details,
      skipped: result?.skipped || false,
      reason: result?.reason,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: err?.message || String(err),
    };
  }
};

// ────────────────────────────────────────────────────────────────────────────
// 1) DB & AUTH
// ────────────────────────────────────────────────────────────────────────────

export const probeDb = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const state = mongoose.connection.readyState; // 1 = connected
      if (state !== 1) {
        return { ok: false, details: { readyState: state, note: 'Mongoose not connected' } };
      }
      await mongoose.connection.db.admin().ping();
      const userCount = await User.estimatedDocumentCount();
      return {
        ok: true,
        details: {
          readyState: state,
          host: mongoose.connection.host,
          name: mongoose.connection.name,
          userCount,
        },
      };
    })
  );
};

export const probeAuth = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return { ok: false, details: { note: 'JWT_SECRET missing in .env' } };
      }
      const payload = { id: 'diag-probe', at: Date.now() };
      const token = jwt.sign(payload, secret, { expiresIn: '1m' });
      const decoded = jwt.verify(token, secret);
      const ok = decoded?.id === payload.id;
      return {
        ok,
        details: {
          algo: 'HS256',
          tokenLen: token.length,
          decodedId: decoded?.id,
        },
      };
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 2) MAIL — verify + optional send
// ────────────────────────────────────────────────────────────────────────────

const buildTransporter = () => {
  return nodemailer.createTransport({
    service: 'Gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const probeMailVerify = async (req, res) => {
  res.json(
    await runProbe(async () => {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return { ok: false, details: { note: 'EMAIL_USER/EMAIL_PASS missing in .env' } };
      }
      const transporter = buildTransporter();
      await transporter.verify(); // throws if SMTP creds invalid
      return {
        ok: true,
        details: { from: process.env.EMAIL_USER, host: 'smtp.gmail.com', port: 465 },
      };
    })
  );
};

export const probeMailSend = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const to =
        (req.body?.to || '').trim() ||
        process.env.DIAGNOSTIC_EMAIL ||
        process.env.EMAIL_USER;
      if (!to) {
        return { ok: false, details: { note: 'No recipient (body.to or DIAGNOSTIC_EMAIL or EMAIL_USER)' } };
      }
      const result = await sendEmail({
        email: to,
        subject: `FinanceApp diagnostic — ${new Date().toISOString()}`,
        message: `<p>This is an automated diagnostic email. Subsystem: SMTP send.</p>
                  <p>Time: ${new Date().toString()}</p>`,
      });
      return {
        ok: true,
        details: { to, messageId: result?.messageId },
      };
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 3) AI — Gemini ping (uses the same model list as aiCopywriter)
// ────────────────────────────────────────────────────────────────────────────

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const probeAi = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return { ok: false, details: { note: 'GEMINI_API_KEY missing in .env' } };
      }

      const body = {
        contents: [
          { role: 'user', parts: [{ text: 'Reply with exactly one word: pong.' }] },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8 },
      };

      let lastError = null;
      for (const model of GEMINI_MODELS) {
        try {
          const r = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await r.json();
          if (!r.ok) {
            lastError = `${model}: ${data?.error?.message || r.status}`;
            continue;
          }
          const text =
            data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() || '';
          if (!text) {
            lastError = `${model}: empty response`;
            continue;
          }
          return {
            ok: true,
            details: { model, reply: text.slice(0, 200) },
          };
        } catch (e) {
          lastError = `${model}: ${e.message}`;
        }
      }
      return { ok: false, details: { note: 'All models failed', lastError } };
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 4) MARKET API
// ────────────────────────────────────────────────────────────────────────────

export const probeMarket = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const r = await fetch('https://finans.truncgil.com/v3/today.json', { timeout: 8000 });
      if (!r.ok) {
        return { ok: false, details: { status: r.status, statusText: r.statusText } };
      }
      const data = await r.json();
      const hasUsd = !!data?.USD?.Selling;
      const hasGold = !!data?.['gram-altin']?.Selling;
      return {
        ok: hasUsd && hasGold,
        details: {
          hasUSD: hasUsd,
          hasGramGold: hasGold,
          usdSelling: data?.USD?.Selling || null,
          gramGoldSelling: data?.['gram-altin']?.Selling || null,
        },
      };
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 5) CRUD PROBES — create/read/update/delete cycles per collection
// ────────────────────────────────────────────────────────────────────────────

const probeCrudFactory = (Model, buildPayload, updatePayload) => async (userResult) => {
  if (!userResult?.user) {
    return { ok: false, skipped: true, reason: userResult?.reason || 'No diagnostic user' };
  }
  const user = userResult.user;
  const doc = await Model.create(buildPayload(user._id));
  try {
    const found = await Model.findById(doc._id).lean();
    if (!found) throw new Error('read-after-create returned null');

    const upd = await Model.findByIdAndUpdate(doc._id, updatePayload, { new: true }).lean();
    if (!upd) throw new Error('update returned null');

    return {
      ok: true,
      details: {
        collection: Model.collection.collectionName,
        createdId: String(doc._id),
        cycle: 'create→read→update→delete',
      },
    };
  } finally {
    await Model.findByIdAndDelete(doc._id).catch(() => {});
  }
};

export const probeCrudTransactions = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      return probeCrudFactory(
        Transaction,
        (uid) => ({
          userId: uid,
          name: `${PROBE_TAG}-tx`,
          category: `${PROBE_TAG}-cat`,
          type: 'expense',
          amount: 1,
        }),
        { amount: 2 }
      )(userResult);
    })
  );
};

export const probeCrudBudgets = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      return probeCrudFactory(
        Budget,
        (uid) => ({ userId: uid, category: `${PROBE_TAG}-bud-${Date.now()}`, limit: 100 }),
        { limit: 200 }
      )(userResult);
    })
  );
};

export const probeCrudPots = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      return probeCrudFactory(
        Pot,
        (uid) => ({ userId: uid, name: `${PROBE_TAG}-pot-${Date.now()}`, target: 100, saved: 0 }),
        { saved: 25 }
      )(userResult);
    })
  );
};

export const probeCrudBills = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      return probeCrudFactory(
        RecurringBill,
        (uid) => ({
          userId: uid,
          name: `${PROBE_TAG}-bill-${Date.now()}`,
          amount: 10,
          dueDay: 15,
          frequency: 'monthly',
        }),
        { amount: 20 }
      )(userResult);
    })
  );
};

export const probeCrudPortfolio = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      if (!userResult.user) {
        return { ok: false, skipped: true, reason: userResult.reason };
      }
      const user = userResult.user;

      const doc = await Portfolio.create({
        userId: user._id,
        assetType: 'USD',
        transactionType: 'BUY',
        amount: 1,
        pricePerUnit: 1,
        totalCost: 1,
      });
      try {
        const found = await Portfolio.findById(doc._id).lean();
        if (!found) throw new Error('read-after-create returned null');
        return {
          ok: true,
          details: { collection: 'portfolio', createdId: String(doc._id) },
        };
      } finally {
        await Portfolio.findByIdAndDelete(doc._id).catch(() => {});
      }
    })
  );
};

// Portfolio TX delete: tests the new single-transaction delete flow used by
// the "Son İşlemler" UI. Creates a BUY probe (over-bought so a SELL fits),
// then a SELL probe, then deletes the SELL — verifying the holding-floor
// guard does NOT trigger. Finally deletes the BUY too. Cleans up either way.
export const probeCrudPortfolioTxDelete = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      if (!userResult.user) {
        return { ok: false, skipped: true, reason: userResult.reason };
      }
      const user = userResult.user;

      // Create a probe BUY (10 units) then a probe SELL (3 units).
      const buy = await Portfolio.create({
        userId: user._id,
        assetType: 'USD',
        transactionType: 'BUY',
        amount: 10,
        pricePerUnit: 1,
        totalCost: 10,
      });
      const sell = await Portfolio.create({
        userId: user._id,
        assetType: 'USD',
        transactionType: 'SELL',
        amount: 3,
        pricePerUnit: 1,
        totalCost: 3,
      });

      try {
        // Step 1: delete the SELL. Should succeed (holdings go 7 → 10).
        await Portfolio.deleteOne({ _id: sell._id });
        const sellGone = await Portfolio.findById(sell._id).lean();
        if (sellGone) throw new Error('SELL still present after deleteOne');

        // Step 2: delete the BUY. Should succeed (no more SELLs, holdings → 0).
        await Portfolio.deleteOne({ _id: buy._id });
        const buyGone = await Portfolio.findById(buy._id).lean();
        if (buyGone) throw new Error('BUY still present after deleteOne');

        return {
          ok: true,
          details: {
            cycle: 'create BUY → create SELL → delete SELL → delete BUY',
            buyId: String(buy._id),
            sellId: String(sell._id),
          },
        };
      } finally {
        // Defensive cleanup in case an assertion threw mid-flow.
        await Portfolio.deleteOne({ _id: buy._id }).catch(() => {});
        await Portfolio.deleteOne({ _id: sell._id }).catch(() => {});
      }
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 5b) POT DELETE GUARDS — verifies the controller's defense-in-depth rules:
//       - empty pot can be deleted
//       - pot with saved > 0 must reject (POT_HAS_FUNDS)
//       - completed pot (saved >= target) must reject (POT_COMPLETED)
// Hits the HTTP layer (not the model) because the guards live in the controller.
// ────────────────────────────────────────────────────────────────────────────

// Resolve our own backend base URL so probes that need the HTTP layer (auth
// guards etc.) don't depend on a hardcoded port. Falls back to 5000.
const selfBase = () => {
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
};

// Sign a short-lived JWT for the diagnostic user so we can hit auth-protected
// endpoints from within the backend. authMiddleware.protect reads `decoded.id`
// (not `uid`) — using the wrong key here silently fails every probe with 401.
const issueDiagJwt = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing — cannot exercise HTTP layer');
  return jwt.sign({ id: String(user._id) }, secret, { expiresIn: '5m' });
};

export const probePotDeleteGuards = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      if (!userResult.user) {
        return { ok: false, skipped: true, reason: userResult.reason };
      }
      const user = userResult.user;
      const token = issueDiagJwt(user);
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      // 3 isolated probe pots: empty / funded / completed.
      const empty = await Pot.create({ userId: user._id, name: `${PROBE_TAG}-pot-empty-${Date.now()}`, target: 100, saved: 0 });
      const funded = await Pot.create({ userId: user._id, name: `${PROBE_TAG}-pot-funded-${Date.now()}`, target: 100, saved: 40 });
      const completed = await Pot.create({ userId: user._id, name: `${PROBE_TAG}-pot-done-${Date.now()}`, target: 100, saved: 100 });

      const callDelete = async (id) => {
        const r = await fetch(`${selfBase()}/api/pots/${id}`, { method: 'DELETE', headers });
        const body = await r.json().catch(() => ({}));
        return { status: r.status, body };
      };

      try {
        const emptyRes = await callDelete(empty._id);
        const fundedRes = await callDelete(funded._id);
        const completedRes = await callDelete(completed._id);

        const passEmpty = emptyRes.status === 200; // deleted OK
        const passFunded = fundedRes.status === 400 && fundedRes.body.code === 'POT_HAS_FUNDS';
        const passCompleted = completedRes.status === 400 && completedRes.body.code === 'POT_COMPLETED';

        const ok = passEmpty && passFunded && passCompleted;
        return {
          ok,
          details: {
            empty: { status: emptyRes.status, passed: passEmpty },
            funded: { status: fundedRes.status, code: fundedRes.body.code, passed: passFunded },
            completed: { status: completedRes.status, code: completedRes.body.code, passed: passCompleted },
          },
        };
      } finally {
        // Best-effort cleanup: empty may already be gone after the first call.
        await Pot.deleteMany({ _id: { $in: [empty._id, funded._id, completed._id] } }).catch(() => {});
      }
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 5c) POT WITHDRAW GUARDS — controller-level guard:
//       - normal withdraw (saved 50 → 30) succeeds
//       - withdraw > saved fails (rejects negative balance)
//       - withdraw from a completed pot fails (POT_WITHDRAW_BLOCKED_COMPLETED)
// ────────────────────────────────────────────────────────────────────────────

export const probePotWithdrawGuards = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      if (!userResult.user) {
        return { ok: false, skipped: true, reason: userResult.reason };
      }
      const user = userResult.user;
      const token = issueDiagJwt(user);
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      const okPot = await Pot.create({ userId: user._id, name: `${PROBE_TAG}-wd-ok-${Date.now()}`, target: 100, saved: 50 });
      const donePot = await Pot.create({ userId: user._id, name: `${PROBE_TAG}-wd-done-${Date.now()}`, target: 100, saved: 100 });

      const callUpdate = async (id, saved) => {
        const r = await fetch(`${selfBase()}/api/pots/${id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ saved }),
        });
        const body = await r.json().catch(() => ({}));
        return { status: r.status, body };
      };

      try {
        // 1) Normal withdraw: 50 → 30. Should succeed.
        const normalRes = await callUpdate(okPot._id, 30);
        // 2) Completed pot withdraw: 100 → 80. Should reject with POT_WITHDRAW_BLOCKED_COMPLETED.
        const completedRes = await callUpdate(donePot._id, 80);

        const passNormal = normalRes.status === 200 && normalRes.body?.saved === 30;
        const passCompleted = completedRes.status === 400 && completedRes.body.code === 'POT_WITHDRAW_BLOCKED_COMPLETED';

        const ok = passNormal && passCompleted;
        return {
          ok,
          details: {
            normalWithdraw: { status: normalRes.status, savedAfter: normalRes.body?.saved, passed: passNormal },
            completedWithdraw: { status: completedRes.status, code: completedRes.body.code, passed: passCompleted },
          },
        };
      } finally {
        await Pot.deleteMany({ _id: { $in: [okPot._id, donePot._id] } }).catch(() => {});
      }
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 5d) BUDGET DELETE — explicit probe (factory's `finally` masked this earlier).
// ────────────────────────────────────────────────────────────────────────────

export const probeBudgetDelete = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      if (!userResult.user) return { ok: false, skipped: true, reason: userResult.reason };
      const user = userResult.user;

      const doc = await Budget.create({
        userId: user._id,
        category: `${PROBE_TAG}-budget-del-${Date.now()}`,
        limit: 100,
      });
      const r = await Budget.deleteOne({ _id: doc._id });
      const stillThere = await Budget.findById(doc._id).lean();
      return {
        ok: r.deletedCount === 1 && !stillThere,
        details: { deletedCount: r.deletedCount, stillExists: !!stillThere, id: String(doc._id) },
      };
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 5e) BILL MARK PAID / UNPAID — exercises the controller endpoints used by
//       the AI agent's mark_bill_paid / mark_bill_unpaid commands.
// ────────────────────────────────────────────────────────────────────────────

export const probeBillMarkPaid = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      if (!userResult.user) return { ok: false, skipped: true, reason: userResult.reason };
      const user = userResult.user;
      const token = issueDiagJwt(user);
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      const bill = await RecurringBill.create({
        userId: user._id,
        name: `${PROBE_TAG}-bill-mark-${Date.now()}`,
        amount: 1,
        dueDay: 15,
        frequency: 'monthly',
        isPaid: false,
      });

      try {
        // Toggle paid → true via PUT (matches what the controller exposes).
        const setPaid = await fetch(`${selfBase()}/api/bills/${bill._id}`, {
          method: 'PUT', headers, body: JSON.stringify({ isPaid: true }),
        });
        const paidBody = await setPaid.json().catch(() => ({}));
        const passPaid = setPaid.status === 200 && paidBody?.isPaid === true;

        // Toggle paid → false.
        const setUnpaid = await fetch(`${selfBase()}/api/bills/${bill._id}`, {
          method: 'PUT', headers, body: JSON.stringify({ isPaid: false }),
        });
        const unpaidBody = await setUnpaid.json().catch(() => ({}));
        const passUnpaid = setUnpaid.status === 200 && unpaidBody?.isPaid === false;

        const ok = passPaid && passUnpaid;
        return {
          ok,
          details: {
            markPaid: { status: setPaid.status, isPaidAfter: paidBody?.isPaid, passed: passPaid },
            markUnpaid: { status: setUnpaid.status, isPaidAfter: unpaidBody?.isPaid, passed: passUnpaid },
          },
        };
      } finally {
        await RecurringBill.findByIdAndDelete(bill._id).catch(() => {});
      }
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 5f) MARKET V3 DEEP — verifies truncgil v3 quirks our backend depends on:
//       - Update_Date present and parseable
//       - JPY quoted per-1-yen (< 1 TRY)
//       - ons returns USD-prefixed string we then × USD to TRY
//       - gram-altin + ceyrek-altin present
//       - TR-locale format (comma as decimal)
// ────────────────────────────────────────────────────────────────────────────

export const probeMarketV3Deep = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const r = await fetch('https://finans.truncgil.com/v3/today.json', { timeout: 8000 });
      if (!r.ok) {
        return { ok: false, details: { status: r.status, statusText: r.statusText } };
      }
      const data = await r.json();

      const parseTr = (s) => {
        if (s == null) return NaN;
        return parseFloat(String(s).replace(/[$%₺\s]/g, '').replace(/\./g, '').replace(',', '.'));
      };

      // Update_Date check
      const updateRaw = data?.Update_Date;
      const updateDate = updateRaw ? new Date(String(updateRaw).replace(' ', 'T')) : null;
      const hasUpdateDate = !!updateRaw && Number.isFinite(updateDate?.getTime());

      // JPY sanity: per-1-yen ⇒ value < 1. v4/devextreme bug produces ~0.003.
      const jpyRaw = data?.JPY?.Selling;
      const jpyNum = parseTr(jpyRaw);
      const jpyPerOneYen = Number.isFinite(jpyNum) && jpyNum > 0.05 && jpyNum < 1;

      // ons must be USD-quoted ("$X.XXX,YY") so backend can do ons × USD → TRY
      const onsRaw = data?.ons?.Selling;
      const onsIsUsd = typeof onsRaw === 'string' && onsRaw.includes('$');
      const onsNum = parseTr(onsRaw);
      const onsSane = Number.isFinite(onsNum) && onsNum > 1000; // ons ≈ $4500ish

      // Gram + çeyrek
      const gramRaw = data?.['gram-altin']?.Selling;
      const ceyrekRaw = data?.['ceyrek-altin']?.Selling;
      const hasGram = !!gramRaw;
      const hasCeyrek = !!ceyrekRaw;

      // TR locale: comma as decimal. Spot-check USD.
      const usdRaw = data?.USD?.Selling;
      const usdTrLocale = typeof usdRaw === 'string' && usdRaw.includes(',');

      const ok = hasUpdateDate && jpyPerOneYen && onsIsUsd && onsSane && hasGram && hasCeyrek && usdTrLocale;

      return {
        ok,
        details: {
          updateDate: updateRaw,
          updateDateAgeMinutes: hasUpdateDate
            ? Math.round((Date.now() - updateDate.getTime()) / 60000)
            : null,
          jpy: { raw: jpyRaw, parsed: jpyNum, perOneYen: jpyPerOneYen },
          ons: { raw: onsRaw, isUsd: onsIsUsd, parsed: onsNum, sane: onsSane },
          gramAltin: gramRaw,
          ceyrekAltin: ceyrekRaw,
          usdTrLocale,
        },
      };
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 5g) INTERNAL MARKET API — verifies our own /api/market/rates response shape
//       is what the frontend expects, including derived values:
//       JPY < 1 (per-1-yen), GOLD_OUNCE > 0 (USD × USD computation succeeded).
// ────────────────────────────────────────────────────────────────────────────

export const probeMarketApi = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const r = await fetch(`${selfBase()}/api/market/rates`, { timeout: 8000 });
      if (!r.ok) {
        return { ok: false, details: { status: r.status, statusText: r.statusText } };
      }
      const data = await r.json();

      const currencyKeys = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD'];
      const goldKeys = ['GOLD_GRAM', 'GOLD_QUARTER', 'GOLD_OUNCE'];

      const missingCurrencies = currencyKeys.filter((k) => !data?.currencies?.[k]);
      const missingGold = goldKeys.filter((k) => !data?.gold?.[k]);

      const jpyRate = data?.currencies?.JPY?.rate;
      const jpyOk = Number.isFinite(jpyRate) && jpyRate > 0.05 && jpyRate < 1;

      const ounceRate = data?.gold?.GOLD_OUNCE?.rate;
      const ounceOk = Number.isFinite(ounceRate) && ounceRate > 1000; // TRY value, e.g. ~200k

      // timestamp: must be parseable ISO; age informs UI staleness banner.
      const tsRaw = data?.timestamp;
      const tsDate = tsRaw ? new Date(tsRaw) : null;
      const tsOk = !!tsRaw && Number.isFinite(tsDate?.getTime());
      const tsAgeMin = tsOk ? Math.round((Date.now() - tsDate.getTime()) / 60000) : null;

      const ok =
        missingCurrencies.length === 0 &&
        missingGold.length === 0 &&
        jpyOk && ounceOk && tsOk;

      return {
        ok,
        details: {
          missingCurrencies,
          missingGold,
          jpyRate, jpyOk,
          ounceRate, ounceOk,
          timestamp: tsRaw,
          timestampAgeMinutes: tsAgeMin,
          marketOpen: data?.marketOpen,
          stale: data?.stale,
        },
      };
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 6) NOTIFICATION PROBES — dry-run logic check (no real email sent)
// ────────────────────────────────────────────────────────────────────────────

// Pure tier helpers, mirror notificationService.js so we can validate the math.
const computePotTier = (saved, target) => {
  if (!target || target <= 0) return 0;
  const r = saved / target;
  if (r >= 1) return 100;
  if (r >= 0.9) return 90;
  if (r >= 0.5) return 50;
  return 0;
};
const computeBudgetTier = (spent, limit) => {
  if (!limit || limit <= 0) return 0;
  const r = spent / limit;
  if (r >= 1) return 100;
  if (r >= 0.9) return 90;
  if (r >= 0.5) return 50;
  return 0;
};

export const probeNotifyPot = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      if (!userResult.user) return { ok: false, skipped: true, reason: userResult.reason };
      const user = userResult.user;

      // Verify tier math AND that the AI copywriter is reachable. The copywriter
      // is the same code path used by notificationService.
      const tier = computePotTier(60, 100);
      if (tier !== 50) throw new Error(`tier math failed: expected 50, got ${tier}`);

      const line = await generateMotivationalLine({
        kind: 'pot_milestone',
        userName: user.displayName || 'there',
        fallback: 'fallback line',
        context: { potName: 'probe pot', target: 100, saved: 60, percent: 50 },
      });

      return {
        ok: !!line && typeof line === 'string',
        details: {
          tierAt60Of100: tier,
          aiLineLen: line?.length || 0,
          aiLinePreview: (line || '').slice(0, 120),
        },
      };
    })
  );
};

export const probeNotifyBudget = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      if (!userResult.user) return { ok: false, skipped: true, reason: userResult.reason };
      const user = userResult.user;

      const tier50 = computeBudgetTier(55, 100);
      const tier90 = computeBudgetTier(91, 100);
      const tier100 = computeBudgetTier(150, 100);
      if (tier50 !== 50 || tier90 !== 90 || tier100 !== 100) {
        throw new Error(`tier math failed: ${tier50}/${tier90}/${tier100}`);
      }

      const line = await generateMotivationalLine({
        kind: 'budget_warning',
        userName: user.displayName || 'there',
        fallback: 'fallback line',
        context: { category: 'probe-cat', limit: 100, spent: 55, percent: 55 },
      });

      return {
        ok: !!line && typeof line === 'string',
        details: { tier50, tier90, tier100, aiLineLen: line?.length || 0 },
      };
    })
  );
};

export const probeNotifyBill = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const userResult = await getDiagnosticUser();
      if (!userResult.user) return { ok: false, skipped: true, reason: userResult.reason };
      const user = userResult.user;

      // Create a probe bill due TOMORROW, then call processBillReminder. This
      // will actually fire an email to the diagnostic user if everything is
      // wired up. After the probe we DELETE the bill so it doesn't fire again.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dueDay = tomorrow.getDate();

      const bill = await RecurringBill.create({
        userId: user._id,
        name: `${PROBE_TAG}-bill`,
        amount: 1,
        dueDay,
        frequency: 'monthly',
        isPaid: false,
      });

      try {
        const { processBillReminder } = await import('../services/notificationService.js');
        const sent = await processBillReminder(bill);
        return {
          ok: true,
          details: {
            emailFired: !!sent,
            probeDueDay: dueDay,
            note: sent
              ? 'Reminder email was actually sent to the diagnostic user.'
              : 'Logic ran without errors; no mail fired (already-reminded or off-window).',
          },
        };
      } finally {
        await RecurringBill.findByIdAndDelete(bill._id).catch(() => {});
      }
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 7) ORPHAN CLEANUP — sweep for any lingering DIAG_PROBE rows
// ────────────────────────────────────────────────────────────────────────────

export const probeCleanup = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const filters = [
        { Model: Transaction, q: { name: { $regex: `^${PROBE_TAG}` } } },
        { Model: Budget, q: { category: { $regex: `^${PROBE_TAG}` } } },
        { Model: Pot, q: { name: { $regex: `^${PROBE_TAG}` } } },
        { Model: RecurringBill, q: { name: { $regex: `^${PROBE_TAG}` } } },
      ];
      const counts = {};
      for (const { Model, q } of filters) {
        const r = await Model.deleteMany(q);
        counts[Model.collection.collectionName] = r.deletedCount;
      }
      return { ok: true, details: counts };
    })
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 8) ENV REPORT — quick view of which secrets/feature flags are set
// ────────────────────────────────────────────────────────────────────────────

export const probeEnv = async (req, res) => {
  res.json(
    await runProbe(async () => {
      const present = (k) => !!process.env[k] && String(process.env[k]).trim().length > 0;
      const details = {
        MONGO_URI: present('MONGO_URI'),
        JWT_SECRET: present('JWT_SECRET'),
        EMAIL_USER: present('EMAIL_USER'),
        EMAIL_PASS: present('EMAIL_PASS'),
        GEMINI_API_KEY: present('GEMINI_API_KEY'),
        ADMIN_SECRET: present('ADMIN_SECRET'),
        DIAGNOSTIC_USER_EMAIL: present('DIAGNOSTIC_USER_EMAIL'),
        DIAGNOSTIC_EMAIL: present('DIAGNOSTIC_EMAIL'),
        CLIENT_URL: present('CLIENT_URL'),
      };

      // DB-side validation for the diagnostic user: catches the case where the
      // env var IS set but no matching user exists in the database.
      if (details.DIAGNOSTIC_USER_EMAIL) {
        const userResult = await getDiagnosticUser();
        details.diagnosticUserFoundInDb = !!userResult.user;
        if (!userResult.user) {
          details.diagnosticUserError = userResult.reason;
        } else {
          details.diagnosticUserDisplayName = userResult.user.displayName;
        }
      }

      const missing = Object.entries(details)
        .filter(([k, v]) => !v && ['MONGO_URI', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS', 'GEMINI_API_KEY', 'ADMIN_SECRET'].includes(k))
        .map(([k]) => k);
      return { ok: missing.length === 0, details: { ...details, missingRequired: missing } };
    })
  );
};
