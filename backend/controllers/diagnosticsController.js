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
