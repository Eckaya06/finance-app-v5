import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./SettingsPage.css";
import { transactions as mockTransactions } from "../../data/mockTransactions.js";

const SettingsPage = () => {
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState({ displayName: "", email: "" });

  const [prefs, setPrefs] = useState({
    theme: "light",
    language: (i18n.resolvedLanguage || i18n.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en",
    currency: "TRY",
    dateFormat: "DD/MM/YYYY",
  });

  const [notifications, setNotifications] = useState({
    weeklySummary: false,
    budgetWarning: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem("settings");
    if (!saved) return;

    try {
      const s = JSON.parse(saved);
      if (s.profile) setProfile(s.profile);
      if (s.prefs) setPrefs(s.prefs);
      if (s.notifications) setNotifications(s.notifications);
    } catch {
      // ignore broken JSON
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("settings", JSON.stringify({ profile, prefs, notifications }));
  }, [profile, prefs, notifications]);

  useEffect(() => {
    if (prefs.theme === "dark") document.body.classList.add("theme-dark");
    else document.body.classList.remove("theme-dark");
  }, [prefs.theme]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((p) => ({ ...p, [name]: value }));
  };

  const handlePrefChange = (e) => {
    const { name, value } = e.target;
    setPrefs((p) => ({ ...p, [name]: value }));
    if (name === "language") {
      i18n.changeLanguage(value);
    }
  };

  const toggleNotification = (name) => {
    setNotifications((n) => ({ ...n, [name]: !n[name] }));
  };

  const toggleDarkMode = () => {
    setPrefs((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" }));
  };

  const exportTransactions = () => {
    const fromLS = localStorage.getItem("transactions");
    let data = [];

    if (fromLS) {
      try {
        data = JSON.parse(fromLS);
      } catch {
        data = [];
      }
    } else {
      data = mockTransactions || [];
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.json";
    a.click();

    URL.revokeObjectURL(url);
  };

  const clearLocalData = () => {
    const ok = window.confirm(t("settings.clearConfirm"));
    if (!ok) return;
    localStorage.clear();
    window.alert(t("settings.clearedAlert"));
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>{t("settings.title")}</h1>
      </div>

      {/* 1) Profile */}
      <section className="settings-section">
        <h2>{t("settings.section1")}</h2>

        <div className="field-row">
          <label>{t("settings.displayName")}</label>
          <div className="row-right">
            <input
              className="input"
              name="displayName"
              value={profile.displayName}
              onChange={handleProfileChange}
              placeholder={t("settings.displayNamePh")}
            />
          </div>
        </div>

        <div className="field-row">
          <label>{t("settings.email")}</label>
          <div className="row-right">
            <input
              className="input"
              name="email"
              value={profile.email}
              onChange={handleProfileChange}
              placeholder={t("settings.emailPh")}
            />
            <span className="badge">{t("settings.phase2")}</span>
          </div>
        </div>

        <div className="field-row">
          <label>{t("settings.password")}</label>
          <div className="row-right">
            <button className="btn btn-ghost" disabled>
              {t("settings.changePassword")}
            </button>
            <span className="badge">{t("settings.phase2")}</span>
          </div>
        </div>

        <div className="field-row">
          <label>{t("settings.deleteAccount")}</label>
          <div className="row-right">
            <button className="btn btn-danger" disabled>
              {t("settings.deleteAccount")}
            </button>
            <span className="badge">{t("settings.phase2")}</span>
          </div>
        </div>
      </section>

      {/* 2) Preferences */}
      <section className="settings-section">
        <h2>{t("settings.section2")}</h2>

        <div className="field-row">
          <label>{t("settings.darkMode")}</label>
          <div className="row-right">
            <button
              type="button"
              className="toggle"
              data-on={prefs.theme === "dark"}
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
            >
              <span className="toggle-knob" />
            </button>
            <span className="muted">{prefs.theme === "dark" ? t("settings.on") : t("settings.off")}</span>
          </div>
        </div>

        <div className="field-row">
          <label>{t("settings.language")}</label>
          <div className="row-right">
            <select className="select" name="language" value={prefs.language} onChange={handlePrefChange}>
              <option value="en">EN</option>
              <option value="tr">TR</option>
            </select>
          </div>
        </div>

        <div className="field-row">
          <label>{t("settings.currency")}</label>
          <div className="row-right">
            <select className="select" name="currency" value={prefs.currency} onChange={handlePrefChange}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        <div className="field-row">
          <label>{t("settings.dateFormat")}</label>
          <div className="row-right">
            <select className="select" name="dateFormat" value={prefs.dateFormat} onChange={handlePrefChange}>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>
      </section>

      {/* 3) Data */}
      <section className="settings-section">
        <h2>{t("settings.section3")}</h2>

        <div className="field-row">
          <label>{t("settings.exportData")}</label>
          <div className="row-right">
            <button className="btn btn-primary" onClick={exportTransactions}>
              {t("settings.exportJson")}
            </button>
          </div>
        </div>

        <div className="field-row">
          <label>{t("settings.importData")}</label>
          <div className="row-right">
            <button className="btn btn-ghost" disabled>
              {t("settings.importBtn")}
            </button>
            <span className="badge">{t("settings.phase2")}</span>
          </div>
        </div>

        <div className="field-row">
          <label>{t("settings.clearData")}</label>
          <div className="row-right">
            <button className="btn btn-danger" onClick={clearLocalData}>
              {t("settings.clearBtn")}
            </button>
          </div>
        </div>

        <p className="muted-note">{t("settings.dataNote")}</p>
      </section>

      {/* 4) Notifications */}
      <section className="settings-section">
        <h2>{t("settings.section4")}</h2>

        <div className="field-row">
          <label>{t("settings.weeklySummary")}</label>
          <div className="row-right">
            <input
              type="checkbox"
              checked={notifications.weeklySummary}
              onChange={() => toggleNotification("weeklySummary")}
            />
            <span className="muted">{t("settings.uiOnlyNote")}</span>
          </div>
        </div>

        <div className="field-row">
          <label>{t("settings.budgetWarning")}</label>
          <div className="row-right">
            <input
              type="checkbox"
              checked={notifications.budgetWarning}
              onChange={() => toggleNotification("budgetWarning")}
            />
            <span className="muted">{t("settings.uiOnlyNote")}</span>
          </div>
        </div>
      </section>

      {/* 5) App info */}
      <section className="settings-section">
        <h2>{t("settings.section5")}</h2>

        <div className="field-row">
          <label>{t("settings.version")}</label>
          <div className="row-right">
            <span>v1.0</span>
          </div>
        </div>

        <div className="field-row">
          <label>{t("settings.techStack")}</label>
          <div className="row-right">
            <span>React (Vite)</span>
          </div>
        </div>

        <div className="field-row">
          <label>{t("settings.support")}</label>
          <div className="row-right">
            <a href="mailto:support@example.com">support@example.com</a>
            <span className="badge">{t("settings.replace")}</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
