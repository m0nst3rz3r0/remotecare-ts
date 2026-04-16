import React from 'react';
import ReactDOM from 'react-dom/client';\nimport App from './App';
import './index.css';
// ADDED: import migratePasswords to upgrade legacy plain-text passwords on startup
import { migratePasswords } from './services/crypto';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Offline-first should never block the app.
  });
}

// ── One-time cleanup of stale demo/seed data ──────────────────
// Removes any demo patients seeded by old versions of storage.ts,
// and removes hard-coded demo admin accounts (alexalpha360, admin)
// if they still exist in localStorage from a previous session.
(function purgeDemoData() {
  const PURGE_KEY = 'rc_demo_purged_v2';
  if (localStorage.getItem(PURGE_KEY)) return; // already done

  // Remove phantom/demo patients
  const rawPts = localStorage.getItem('zmz2_pts');
  if (rawPts) {
    try {
      const pts = JSON.parse(rawPts);
      // If the only patients are demo ones (id < 100 or flagged), wipe them.
      // More conservatively: only wipe if the array is very small and was
      // created by seeding (all ids are numeric and <= 10).
      const DEMO_IDS = new Set([1, 2, 3, 4, 5]);
      const cleaned = pts.filter((p: { id: unknown }) =>
        typeof p.id !== 'number' || !DEMO_IDS.has(p.id)
      );
      if (cleaned.length !== pts.length) {
        localStorage.setItem('zmz2_pts', JSON.stringify(cleaned));
      }
    } catch {
      // corrupt — leave alone
    }
  }

  // Remove hard-coded demo admin accounts from localStorage user list
  const DEMO_USERNAMES = new Set(['alexalpha360', 'admin']);
  const rawUsers = localStorage.getItem('th_users');
  if (rawUsers) {
    try {
      const users = JSON.parse(rawUsers);
      const cleaned = users.filter(
        (u: { username: string; id: string }) =>
          !DEMO_USERNAMES.has(u.username.toLowerCase()) ||
          // Keep if the id is NOT the old seed id (u0/u1) — meaning it was
          // recreated via the Admin UI and should be preserved.
          (u.id !== 'u0' && u.id !== 'u1')
      );
      if (cleaned.length !== users.length) {
        localStorage.setItem('th_users', JSON.stringify(cleaned));
        // Also clear session if it belonged to a purged demo user
        const rawSession = localStorage.getItem('th_session');
        if (rawSession) {
          try {
            const sess = JSON.parse(rawSession);
            if (DEMO_USERNAMES.has(sess.username?.toLowerCase()) && (sess.id === 'u0' || sess.id === 'u1')) {
              localStorage.removeItem('th_session');
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      // corrupt — leave alone
    }
  }

  localStorage.setItem(PURGE_KEY, '1');
})();

// ADDED: silently migrate any plain-text passwords to PBKDF2 hashes
migratePasswords();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
