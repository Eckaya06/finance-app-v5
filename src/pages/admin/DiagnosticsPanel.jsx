import { useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  FiActivity, FiDatabase, FiLock, FiMail, FiCpu, FiTrendingUp,
  FiBox, FiClipboard, FiBell, FiAlertCircle, FiCheckCircle, FiXCircle,
  FiPlayCircle, FiTrash2, FiArrowLeft, FiSettings,
} from 'react-icons/fi';
import './DiagnosticsPanel.css';

const diagApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/diagnostics`
    : '/api/diagnostics',
});

diagApi.interceptors.request.use((config) => {
  const adminKey = localStorage.getItem('financeapp_admin_key');
  if (adminKey) config.headers['x-admin-key'] = adminKey;
  return config;
});

// ─── Test definitions ──────────────────────────────────────────────────────
// Each test: { id, group, label, icon, method, path, body? }
const TESTS = [
  // Environment
  { id: 'env', group: 'Environment', label: '.env / required secrets', icon: <FiSettings />, method: 'GET', path: '/env' },

  // DB & Auth
  { id: 'db', group: 'Database & Auth', label: 'MongoDB connection', icon: <FiDatabase />, method: 'GET', path: '/db' },
  { id: 'auth', group: 'Database & Auth', label: 'JWT sign / verify roundtrip', icon: <FiLock />, method: 'GET', path: '/auth' },

  // Mail
  { id: 'mail_verify', group: 'Mail (SMTP)', label: 'SMTP transporter.verify()', icon: <FiMail />, method: 'GET', path: '/mail/verify' },
  { id: 'mail_send', group: 'Mail (SMTP)', label: 'Send real test email', icon: <FiMail />, method: 'POST', path: '/mail/send', needsRecipient: true },

  // AI & Market
  { id: 'ai', group: 'External APIs', label: 'Gemini (AI) ping', icon: <FiCpu />, method: 'GET', path: '/ai' },
  { id: 'market', group: 'External APIs', label: 'Market rates (truncgil) — basic', icon: <FiTrendingUp />, method: 'GET', path: '/market' },
  { id: 'market_v3_deep', group: 'External APIs', label: 'Truncgil v3 deep check (Update_Date, JPY per-1-yen, ons format)', icon: <FiTrendingUp />, method: 'GET', path: '/market/v3-deep' },
  { id: 'market_api', group: 'External APIs', label: 'Internal /api/market/rates shape (currencies + gold + timestamp)', icon: <FiTrendingUp />, method: 'GET', path: '/market/api' },

  // CRUD
  { id: 'crud_transactions', group: 'CRUD Endpoints', label: 'Transactions create/read/update/delete', icon: <FiActivity />, method: 'GET', path: '/crud/transactions' },
  { id: 'crud_budgets', group: 'CRUD Endpoints', label: 'Budgets create/read/update/delete', icon: <FiActivity />, method: 'GET', path: '/crud/budgets' },
  { id: 'crud_budget_delete', group: 'CRUD Endpoints', label: 'Budget delete (explicit)', icon: <FiActivity />, method: 'GET', path: '/crud/budget-delete' },
  { id: 'crud_pots', group: 'CRUD Endpoints', label: 'Pots create/read/update/delete', icon: <FiBox />, method: 'GET', path: '/crud/pots' },
  { id: 'crud_pot_delete_guards', group: 'CRUD Endpoints', label: 'Pot delete guards (empty=OK, funded=POT_HAS_FUNDS, completed=POT_COMPLETED)', icon: <FiBox />, method: 'GET', path: '/crud/pot-delete-guards' },
  { id: 'crud_pot_withdraw_guards', group: 'CRUD Endpoints', label: 'Pot withdraw guards (normal=OK, completed=POT_WITHDRAW_BLOCKED_COMPLETED)', icon: <FiBox />, method: 'GET', path: '/crud/pot-withdraw-guards' },
  { id: 'crud_bills', group: 'CRUD Endpoints', label: 'Recurring bills create/read/update/delete', icon: <FiClipboard />, method: 'GET', path: '/crud/bills' },
  { id: 'crud_bill_mark_paid', group: 'CRUD Endpoints', label: 'Bill mark paid → unpaid roundtrip', icon: <FiClipboard />, method: 'GET', path: '/crud/bill-mark-paid' },
  { id: 'crud_portfolio', group: 'CRUD Endpoints', label: 'Portfolio buy probe', icon: <FiTrendingUp />, method: 'GET', path: '/crud/portfolio' },
  { id: 'crud_portfolio_tx_delete', group: 'CRUD Endpoints', label: 'Portfolio single-tx delete (buy + sell + delete)', icon: <FiTrendingUp />, method: 'GET', path: '/crud/portfolio-tx-delete' },

  // Notifications
  { id: 'notify_budget', group: 'Notifications', label: 'Budget threshold (50/90/100%) email path', icon: <FiBell />, method: 'GET', path: '/notify/budget' },
  { id: 'notify_pot', group: 'Notifications', label: 'Pot milestone (50/90/100%) email path', icon: <FiBell />, method: 'GET', path: '/notify/pot' },
  { id: 'notify_bill', group: 'Notifications', label: 'Bill reminder (real send to diag user!)', icon: <FiBell />, method: 'GET', path: '/notify/bill' },
];

const GROUP_ORDER = [
  'Environment',
  'Database & Auth',
  'Mail (SMTP)',
  'External APIs',
  'CRUD Endpoints',
  'Notifications',
];

const groupedTests = GROUP_ORDER.map((g) => ({
  name: g,
  tests: TESTS.filter((t) => t.group === g),
}));

// ─── Status badge ──────────────────────────────────────────────────────────
const StatusBadge = ({ result, running }) => {
  if (running) return <span className="diag-badge running">Running…</span>;
  if (!result) return <span className="diag-badge idle">Idle</span>;
  if (result.skipped) return <span className="diag-badge skipped">Skipped</span>;
  if (result.ok) return <span className="diag-badge ok"><FiCheckCircle /> Pass</span>;
  return <span className="diag-badge fail"><FiXCircle /> Fail</span>;
};

// ─── Auth Gate (re-uses admin key) ────────────────────────────────────────
const AuthGate = ({ onAuthed }) => {
  const [val, setVal] = useState(localStorage.getItem('financeapp_admin_key') || '');
  const [err, setErr] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await axios.get(
        (import.meta.env.VITE_API_BASE_URL || '/api') + '/diagnostics/env',
        { headers: { 'x-admin-key': val } }
      );
      localStorage.setItem('financeapp_admin_key', val);
      onAuthed();
    } catch (e) {
      setErr('Geçersiz Admin Anahtarı');
    }
  };

  return (
    <div className="diag-login">
      <div className="diag-login-card">
        <div className="diag-login-head">
          <FiAlertCircle className="diag-login-icon" />
          <h1>Diagnostics</h1>
          <p>Admin anahtarını gir</p>
        </div>
        <form onSubmit={handle}>
          <input
            type="password"
            placeholder="Admin Key"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            autoFocus
          />
          {err && <div className="diag-login-err">{err}</div>}
          <button type="submit">Giriş</button>
        </form>
      </div>
    </div>
  );
};

export default function DiagnosticsPanel() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('financeapp_admin_key'));
  const [results, setResults] = useState({}); // { [testId]: { ok, latencyMs, details?, error?, skipped? } }
  const [running, setRunning] = useState({}); // { [testId]: bool }
  const [expanded, setExpanded] = useState({}); // collapsible details
  const [mailTo, setMailTo] = useState('');
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  const runOne = useCallback(async (test) => {
    setRunning((r) => ({ ...r, [test.id]: true }));
    try {
      const cfg = test.method === 'POST'
        ? await diagApi.post(test.path, test.needsRecipient ? { to: mailTo } : {})
        : await diagApi.get(test.path);
      setResults((r) => ({ ...r, [test.id]: cfg.data }));
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('financeapp_admin_key');
        setAuthed(false);
        return;
      }
      setResults((r) => ({
        ...r,
        [test.id]: { ok: false, latencyMs: 0, error: err.response?.data?.message || err.message },
      }));
    } finally {
      setRunning((r) => ({ ...r, [test.id]: false }));
    }
  }, [mailTo]);

  const runAll = useCallback(async () => {
    // Run in parallel — independent probes don't block each other.
    await Promise.all(TESTS.map((t) => runOne(t)));
  }, [runOne]);

  const runGroup = useCallback(async (groupName) => {
    const tests = TESTS.filter((t) => t.group === groupName);
    await Promise.all(tests.map((t) => runOne(t)));
  }, [runOne]);

  const runCleanup = useCallback(async () => {
    setCleanupRunning(true);
    try {
      const r = await diagApi.post('/cleanup');
      setCleanupResult(r.data);
    } catch (err) {
      setCleanupResult({ ok: false, error: err.response?.data?.message || err.message });
    } finally {
      setCleanupRunning(false);
    }
  }, []);

  if (!authed) return <AuthGate onAuthed={() => setAuthed(true)} />;

  // ─── Summary ───
  const total = TESTS.length;
  const passed = Object.values(results).filter((r) => r?.ok && !r?.skipped).length;
  const failed = Object.values(results).filter((r) => r && !r?.ok && !r?.skipped).length;
  const skipped = Object.values(results).filter((r) => r?.skipped).length;
  const ran = passed + failed + skipped;

  return (
    <div className="diag-panel">
      <header className="diag-header">
        <div className="diag-header-left">
          <Link to="/admin" className="diag-back" title="Admin Panele Dön">
            <FiArrowLeft />
          </Link>
          <div>
            <span className="diag-eyebrow">FinanceApp</span>
            <h1>Sistem Diagnostiği</h1>
            <p>Site genelindeki tüm subsystem'leri tek tıkla test et</p>
          </div>
        </div>
        <div className="diag-header-actions">
          <button className="diag-btn diag-btn-primary" onClick={runAll} disabled={Object.values(running).some(Boolean)}>
            <FiPlayCircle /> Tümünü Çalıştır
          </button>
          <button className="diag-btn diag-btn-ghost" onClick={runCleanup} disabled={cleanupRunning}>
            <FiTrash2 /> {cleanupRunning ? 'Temizleniyor…' : 'Probe Temizliği'}
          </button>
        </div>
      </header>

      <div className="diag-summary">
        <div className="diag-summary-card">
          <span className="diag-summary-label">Toplam Test</span>
          <span className="diag-summary-val">{total}</span>
        </div>
        <div className="diag-summary-card ok">
          <span className="diag-summary-label">Geçti</span>
          <span className="diag-summary-val">{passed}</span>
        </div>
        <div className="diag-summary-card fail">
          <span className="diag-summary-label">Hata</span>
          <span className="diag-summary-val">{failed}</span>
        </div>
        <div className="diag-summary-card skipped">
          <span className="diag-summary-label">Atlandı</span>
          <span className="diag-summary-val">{skipped}</span>
        </div>
        <div className="diag-summary-card">
          <span className="diag-summary-label">Çalıştırıldı</span>
          <span className="diag-summary-val">{ran}/{total}</span>
        </div>
      </div>

      {cleanupResult && (
        <div className={`diag-cleanup-banner ${cleanupResult.ok ? 'ok' : 'fail'}`}>
          <strong>Cleanup:</strong>{' '}
          {cleanupResult.ok
            ? `Silinen probe kayıtları: ${JSON.stringify(cleanupResult.details)}`
            : `Hata: ${cleanupResult.error}`}
        </div>
      )}

      <div className="diag-mail-recipient">
        <label>Test maili alıcısı (opsiyonel — boşsa .env'deki DIAGNOSTIC_EMAIL veya EMAIL_USER):</label>
        <input
          type="email"
          placeholder="ornek@gmail.com"
          value={mailTo}
          onChange={(e) => setMailTo(e.target.value)}
        />
      </div>

      {groupedTests.map((g) => (
        <section key={g.name} className="diag-group">
          <div className="diag-group-head">
            <h2>{g.name}</h2>
            <button
              className="diag-btn diag-btn-small"
              onClick={() => runGroup(g.name)}
              disabled={g.tests.some((t) => running[t.id])}
            >
              <FiPlayCircle /> Bu Grubu Çalıştır
            </button>
          </div>

          <div className="diag-test-grid">
            {g.tests.map((test) => {
              const r = results[test.id];
              const isRunning = running[test.id];
              const isOpen = expanded[test.id];
              return (
                <div key={test.id} className={`diag-test-card ${r?.ok ? 'is-ok' : r?.skipped ? 'is-skipped' : r ? 'is-fail' : 'is-idle'}`}>
                  <div className="diag-test-top">
                    <div className="diag-test-icon">{test.icon}</div>
                    <div className="diag-test-info">
                      <div className="diag-test-label">{test.label}</div>
                      <div className="diag-test-meta">
                        <StatusBadge result={r} running={isRunning} />
                        {r?.latencyMs != null && <span className="diag-latency">{r.latencyMs}ms</span>}
                      </div>
                    </div>
                    <button
                      className="diag-test-run"
                      onClick={() => runOne(test)}
                      disabled={isRunning}
                      title="Çalıştır"
                    >
                      <FiPlayCircle />
                    </button>
                  </div>

                  {r && (
                    <>
                      {r.error && <div className="diag-test-error">{r.error}</div>}
                      {r.reason && <div className="diag-test-reason">⚠ {r.reason}</div>}
                      {r.details && (
                        <div className="diag-test-details">
                          <button
                            className="diag-test-details-toggle"
                            onClick={() => setExpanded((e) => ({ ...e, [test.id]: !e[test.id] }))}
                          >
                            {isOpen ? '▾ Detayları gizle' : '▸ Detayları göster'}
                          </button>
                          {isOpen && (
                            <pre className="diag-test-details-body">
                              {JSON.stringify(r.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <footer className="diag-footer">
        <p>
          <strong>Not:</strong> CRUD ve bildirim testleri, bir gerçek kullanıcı gerektirir.
          Backend <code>.env</code> içine <code>DIAGNOSTIC_USER_EMAIL=eckaya631906@gmail.com</code> ekle (test maili için <code>DIAGNOSTIC_EMAIL</code>).
          Probe satırları otomatik silinir; yine de "Probe Temizliği" ile manuel sweep yapılabilir.
        </p>
      </footer>
    </div>
  );
}
