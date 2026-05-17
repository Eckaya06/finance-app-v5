import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useTransactions } from "../../context/TransactionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import api from "../../api.js";
import "./SettingsPage.css";

/* --- minik inline ikonlar (lucide tarzı, sade çizgi) --- */
const IconUser = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconLock = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconSun = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
const IconDownload = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IconAlert = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const IconCheck = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const getInitials = (name = "", email = "") => {
  const src = (name || email || "").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
};

const SettingsPage = () => {
  const { t } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const { theme, setTheme, sidebarSide, toggleSidebarSide } = useTheme();
  const { transactions } = useTransactions();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState({ type: "", text: "" });

  // password change
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });
  const [showPwSuccess, setShowPwSuccess] = useState(false);

  // delete account
  const [showDelete, setShowDelete] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  // export
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || "");
  }, [user]);

  const handleNameSave = async (e) => {
    e.preventDefault();
    setNameMsg({ type: "", text: "" });
    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameMsg({ type: "error", text: t("settings.nameRequired") });
      return;
    }
    try {
      setSavingName(true);
      const { data } = await api.put("/auth/change-display-name", { displayName: trimmed });
      // Auth context'i hemen güncelle — AI chatbot ve diğer "merhaba {name}"
      // gösteren bileşenler yeniden render olur olmaz yeni ismi kullanır.
      // Backend güncel user objesini döndürdüğü için onu tercih ediyoruz; düşmezse
      // local trimmed değere fallback.
      updateUser({ displayName: data?.user?.displayName || trimmed });
      setNameMsg({ type: "ok", text: t("settings.nameUpdated") });
    } catch (err) {
      setNameMsg({
        type: "error",
        text: err.response?.data?.message || t("settings.nameFailed"),
      });
    } finally {
      setSavingName(false);
    }
  };

  const handlePwSave = async (e) => {
    e.preventDefault();
    setPwMsg({ type: "", text: "" });
    if (pw.next.length < 6) {
      setPwMsg({ type: "error", text: t("settings.pwTooShort") });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ type: "error", text: t("settings.pwMismatch") });
      return;
    }
    try {
      setPwSaving(true);
      await api.put("/auth/change-password", {
        currentPassword: pw.current,
        newPassword: pw.next,
      });
      setPw({ current: "", next: "", confirm: "" });
      // Şifre değiştikten sonra önce kullanıcıya "Yeni şifrenle giriş yap"
      // bilgilendirme modalını gösteriyoruz; ardından session'ı kapatıp
      // login'e yönlendiriyoruz. Modal ~2.6 sn ekranda kalır.
      setShowPwSuccess(true);
      setTimeout(async () => {
        try { await logout(); } catch { /* ignore */ }
        navigate("/login", { replace: true });
      }, 2600);
    } catch (err) {
      setPwMsg({
        type: "error",
        text: err.response?.data?.message || t("settings.pwFailed"),
      });
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteErr("");
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
      setDeleteErr(t("settings.deleteTypeWord"));
      return;
    }
    try {
      setDeleting(true);
      await api.delete("/auth/account", {
        data: { currentPassword: deletePw },
      });
      localStorage.removeItem("financeapp_token");
      localStorage.removeItem("financeapp_ui_prefs");
      try {
        await logout();
      } catch {
        // ignore
      }
      showToast(t("settings.deleteSuccess"), "success");
      setShowDelete(false);
      navigate("/login", { replace: true });
    } catch (err) {
      setDeleteErr(err.response?.data?.message || t("settings.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  // ---- EXPORT helpers --------------------------------------------------
  const formatCurrency = (n) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);

  const computeTotals = (rows) => {
    let income = 0;
    let expense = 0;
    rows.forEach((r) => {
      const amt = Number(r.amount) || 0;
      if (r.type === "income") income += amt;
      else if (r.type === "expense") expense += amt;
    });
    return { income, expense, net: income - expense };
  };

  const exportTxt = () => {
    const rows = [...transactions].sort(
      (a, b) => (b.rawDate || 0) - (a.rawDate || 0)
    );
    const { income, expense, net } = computeTotals(rows);

    const lines = [];
    lines.push("=================================================");
    lines.push("       FINANCEAPP - TRANSACTIONS REPORT");
    lines.push("=================================================");
    lines.push(`User: ${user?.displayName || "-"}  (${user?.email || "-"})`);
    lines.push(`Generated: ${new Date().toLocaleString("tr-TR")}`);
    lines.push(`Total records: ${rows.length}`);
    lines.push("-------------------------------------------------");
    lines.push(`Total income : ${formatCurrency(income)}`);
    lines.push(`Total expense: ${formatCurrency(expense)}`);
    lines.push(`Net          : ${formatCurrency(net)}`);
    lines.push("=================================================");
    lines.push("");
    lines.push("DATE        TYPE      CATEGORY            NAME                          AMOUNT");
    lines.push("-".repeat(95));
    rows.forEach((r) => {
      const date = String(r.date || "").padEnd(11);
      const type = String(r.type || "").toUpperCase().padEnd(9);
      const cat = String(r.category || "-").padEnd(20).slice(0, 20);
      const name = String(r.name || "-").padEnd(30).slice(0, 30);
      const amt = formatCurrency(r.amount);
      lines.push(`${date} ${type} ${cat} ${name} ${amt}`);
    });

    const blob = new Blob([lines.join("\r\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // jsPDF default fonts (Helvetica) use WinAnsi encoding, which lacks glyphs
  // for ₺ (U+20BA) and some Turkish letters (ş, Ş, ğ, Ğ, ı, İ). Intl.NumberFormat
  // for tr-TR also injects NBSP (U+00A0) and NARROW NBSP (U+202F) around the
  // currency symbol; both render as tofu. Normalize all of these here.
  const sanitizePdfText = (s) =>
    String(s ?? "")
      .replace(/₺/g, "TL")
      .replace(/[    ]/g, " ")
      .replace(/ş/g, "s")
      .replace(/Ş/g, "S")
      .replace(/ğ/g, "g")
      .replace(/Ğ/g, "G")
      .replace(/ı/g, "i")
      .replace(/İ/g, "I");

  const exportPdf = async () => {
    try {
      setExportingPdf(true);
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const rows = [...transactions].sort(
        (a, b) => (b.rawDate || 0) - (a.rawDate || 0)
      );
      const { income, expense, net } = computeTotals(rows);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 40;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(20, 20, 20);
      doc.text("FinanceApp - Transactions Report", marginX, 50);

      // Meta line
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      const metaLine1 = `User: ${sanitizePdfText(user?.displayName || "-")}  (${sanitizePdfText(user?.email || "-")})`;
      const metaLine2 = `Generated: ${new Date().toLocaleString("tr-TR")}    Records: ${rows.length}`;
      doc.text(metaLine1, marginX, 68);
      doc.text(metaLine2, marginX, 82);

      // Summary cards
      const cardY = 100;
      const cardH = 56;
      const gap = 12;
      const cardW = (pageWidth - marginX * 2 - gap * 2) / 3;

      const drawCard = (x, label, value, valueColor) => {
        doc.setDrawColor(229, 231, 235);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, cardY, cardW, cardH, 6, 6, "S");
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.setFont("helvetica", "normal");
        doc.text(label.toUpperCase(), x + 12, cardY + 18);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...valueColor);
        doc.text(sanitizePdfText(value), x + 12, cardY + 40);
      };

      drawCard(marginX, "Total income", formatCurrency(income), [21, 128, 61]);
      drawCard(marginX + cardW + gap, "Total expense", formatCurrency(expense), [185, 28, 28]);
      drawCard(marginX + (cardW + gap) * 2, "Net", formatCurrency(net), [30, 41, 59]);

      // Transactions table
      const body = rows.map((r) => [
        sanitizePdfText(r.date || "-"),
        sanitizePdfText(String(r.type || "").toUpperCase()),
        sanitizePdfText(r.category || "-"),
        sanitizePdfText(r.name || "-"),
        sanitizePdfText(formatCurrency(r.amount)),
      ]);

      autoTable(doc, {
        startY: cardY + cardH + 18,
        head: [["Date", "Type", "Category", "Name", "Amount"]],
        body: body.length ? body : [["", "", "No transactions", "", ""]],
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 6,
          textColor: [30, 41, 59],
          lineColor: [229, 231, 235],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [243, 244, 246],
          textColor: [55, 65, 81],
          fontStyle: "bold",
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 60 },
          2: { cellWidth: 90 },
          3: { cellWidth: "auto" },
          4: { halign: "right", cellWidth: 90, fontStyle: "bold" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 1) {
            const v = String(data.cell.raw || "").toUpperCase();
            if (v === "INCOME") data.cell.styles.textColor = [21, 128, 61];
            else if (v === "EXPENSE") data.cell.styles.textColor = [185, 28, 28];
          }
        },
        margin: { left: marginX, right: marginX },
      });

      // Footer with page numbers
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const ph = doc.internal.pageSize.getHeight();
        doc.text(
          `FinanceApp  -  Page ${i} of ${pageCount}`,
          pageWidth / 2,
          ph - 18,
          { align: "center" }
        );
      }

      doc.save(`transactions-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      showToast(t("settings.pdfFailed"), "error");
    } finally {
      setExportingPdf(false);
    }
  };

  const initials = getInitials(user?.displayName, user?.email);

  return (
    <div className="settings-v2">
      <div className="sv-page-card">
        {/* === Sayfa başlığı === */}
        <header className="sv-header">
          <div>
            <h1 className="sv-title">{t("settings.title")}</h1>
          </div>
        </header>

        {/* === Kart grid === */}
        <div className="sv-grid">
        {/* ---------- Profile ---------- */}
        <section className="sv-card">
          <div className="sv-card-head">
            <span className="sv-card-icon"><IconUser /></span>
            <h2>{t("settings.sectionAccount")}</h2>
          </div>

          <form className="sv-card-body" onSubmit={handleNameSave}>
            <div className="sv-profile">
              <div className="sv-avatar" aria-hidden="true">{initials}</div>
              <div className="sv-profile-info">
                <span className="sv-field-label">{t("settings.displayName")}</span>
                <div className="sv-inline">
                  <input
                    className="sv-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("settings.displayNamePh")}
                    maxLength={60}
                  />
                  <button type="submit" className="sv-btn sv-btn-primary" disabled={savingName}>
                    {savingName ? t("settings.saving") : t("settings.save")}
                  </button>
                </div>
                {nameMsg.text && (
                  <p className={`sv-msg ${nameMsg.type === "ok" ? "sv-msg-ok" : "sv-msg-err"}`}>
                    {nameMsg.text}
                  </p>
                )}
              </div>
            </div>

            <div className="sv-readonly">
              <span className="sv-eyebrow-sm">{t("settings.email")}</span>
              <div className="sv-input sv-input-readonly">{user?.email || "—"}</div>
            </div>
          </form>
        </section>

        {/* ---------- Appearance ---------- */}
        <section className="sv-card">
          <div className="sv-card-head">
            <span className="sv-card-icon"><IconSun /></span>
            <h2>{t("settings.sectionAppearance")}</h2>
          </div>

          <div className="sv-card-body">
            {/* Tema seçimi - görsel kartlar */}
            <div className="sv-theme-grid" role="radiogroup" aria-label={t("settings.darkMode")}>
              <button
                type="button"
                role="radio"
                aria-checked={theme === "light"}
                className={`sv-theme-card sv-theme-light ${theme === "light" ? "is-active" : ""}`}
                onClick={() => theme !== "light" && setTheme("light")}
              >
                <div className="sv-theme-preview">
                  <span className="bar bar-1" />
                  <span className="bar bar-2" />
                </div>
                <span className="sv-theme-name">Light</span>
                {theme === "light" && (
                  <span className="sv-theme-check"><IconCheck /></span>
                )}
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={theme === "dark"}
                className={`sv-theme-card sv-theme-dark ${theme === "dark" ? "is-active" : ""}`}
                onClick={() => theme !== "dark" && setTheme("dark")}
              >
                <div className="sv-theme-preview">
                  <span className="bar bar-1" />
                  <span className="bar bar-2" />
                </div>
                <span className="sv-theme-name">Dark</span>
                {theme === "dark" && (
                  <span className="sv-theme-check"><IconCheck /></span>
                )}
              </button>
            </div>

            {/* Sidebar konumu */}
            <div className="sv-row">
              <div className="sv-row-text">
                <span className="sv-field-label">{t("settings.sidebarSide")}</span>
                <p className="sv-row-hint">{t("settings.sidebarSideHelp")}</p>
              </div>
              <div className="sv-seg">
                <button
                  type="button"
                  className={`sv-seg-btn ${sidebarSide === "left" ? "is-active" : ""}`}
                  onClick={() => sidebarSide !== "left" && toggleSidebarSide()}
                >
                  {t("settings.sidebarLeft")}
                </button>
                <button
                  type="button"
                  className={`sv-seg-btn ${sidebarSide === "right" ? "is-active" : ""}`}
                  onClick={() => sidebarSide !== "right" && toggleSidebarSide()}
                >
                  {t("settings.sidebarRight")}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Password ---------- */}
        <section className="sv-card">
          <div className="sv-card-head">
            <span className="sv-card-icon"><IconLock /></span>
            <h2>{t("settings.sectionPassword")}</h2>
          </div>

          <form className="sv-card-body sv-form" onSubmit={handlePwSave}>
            <label className="sv-field">
              <span className="sv-field-label">{t("settings.currentPassword")}</span>
              <input
                className="sv-input"
                type="password"
                value={pw.current}
                onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))}
                autoComplete="current-password"
                required
              />
            </label>

            <label className="sv-field">
              <span className="sv-field-label">{t("settings.newPassword")}</span>
              <input
                className="sv-input"
                type="password"
                value={pw.next}
                onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))}
                autoComplete="new-password"
                required
              />
            </label>

            <label className="sv-field">
              <span className="sv-field-label">{t("settings.confirmPassword")}</span>
              <input
                className="sv-input"
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))}
                autoComplete="new-password"
                required
              />
            </label>

            {pwMsg.text && (
              <p className={`sv-msg ${pwMsg.type === "ok" ? "sv-msg-ok" : "sv-msg-err"}`}>
                {pwMsg.text}
              </p>
            )}

            <div className="sv-actions">
              <button type="submit" className="sv-btn sv-btn-primary" disabled={pwSaving}>
                {pwSaving ? t("settings.updating") : t("settings.updatePassword")}
              </button>
            </div>
          </form>
        </section>

        {/* ---------- Data Export ---------- */}
        <section className="sv-card">
          <div className="sv-card-head">
            <span className="sv-card-icon"><IconDownload /></span>
            <h2>{t("settings.sectionExport")}</h2>
          </div>

          <div className="sv-card-body">
            <p className="sv-row-hint sv-export-hint">
              {t("settings.exportHelp", { count: transactions.length })}
            </p>

            <div className="sv-export-actions">
              <button
                type="button"
                className="sv-btn sv-btn-primary"
                onClick={exportPdf}
                disabled={exportingPdf}
              >
                <IconDownload />
                <span>{exportingPdf ? t("settings.exporting") : t("settings.exportPdf")}</span>
              </button>
              <button type="button" className="sv-btn sv-btn-ghost" onClick={exportTxt}>
                <IconDownload />
                <span>{t("settings.exportTxt")}</span>
              </button>
            </div>
          </div>
        </section>

        {/* ---------- Danger zone ---------- */}
        <section className="sv-card sv-danger sv-span-2">
          <div className="sv-card-head">
            <span className="sv-card-icon sv-card-icon-danger"><IconAlert /></span>
            <h2>{t("settings.sectionDanger")}</h2>
          </div>

          <div className="sv-card-body sv-danger-body">
            <p className="sv-row-hint sv-danger-hint">{t("settings.deleteHelp")}</p>
            <button
              type="button"
              className="sv-btn sv-btn-danger"
              onClick={() => setShowDelete(true)}
            >
              {t("settings.deleteAccount")}
            </button>
          </div>
        </section>
        </div>
      </div>

      {/* ---------- Password-changed redirect modal ---------- */}
      {showPwSuccess &&
        createPortal(
          <div className="sv-modal-overlay" aria-modal="true" role="dialog">
            <div className="sv-modal sv-pw-success-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sv-pw-success-icon" aria-hidden="true">
                <IconCheck />
              </div>
              <h3 className="sv-pw-success-title">{t("settings.pwChangedModalTitle")}</h3>
              <p className="sv-pw-success-desc">{t("settings.pwChangedModalMsg")}</p>
              <div className="sv-pw-success-bar"><span /></div>
            </div>
          </div>,
          document.body
        )}

      {/* ---------- Delete modal ---------- */}
      {showDelete &&
        createPortal(
          <div
            className="sv-modal-overlay"
            onClick={() => !deleting && setShowDelete(false)}
          >
            <div className="sv-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-head">
                <span className="sv-card-icon sv-card-icon-danger"><IconAlert /></span>
                <h3>{t("settings.deleteConfirmTitle")}</h3>
              </div>
              <p className="sv-modal-desc">{t("settings.deleteConfirmDesc")}</p>

              <form onSubmit={handleDeleteAccount} className="sv-form">
                <label className="sv-field">
                  <span className="sv-field-label">{t("settings.currentPassword")}</span>
                  <input
                    className="sv-input"
                    type="password"
                    value={deletePw}
                    onChange={(e) => setDeletePw(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>

                <label className="sv-field">
                  <span className="sv-field-label">{t("settings.typeDelete")}</span>
                  <input
                    className="sv-input"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                  />
                </label>

                {deleteErr && <p className="sv-msg sv-msg-err">{deleteErr}</p>}

                <div className="sv-actions sv-actions-right">
                  <button
                    type="button"
                    className="sv-btn sv-btn-ghost"
                    onClick={() => setShowDelete(false)}
                    disabled={deleting}
                  >
                    {t("settings.cancel")}
                  </button>
                  <button type="submit" className="sv-btn sv-btn-danger" disabled={deleting}>
                    {deleting ? t("settings.deleting") : t("settings.deleteConfirmBtn")}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default SettingsPage;
