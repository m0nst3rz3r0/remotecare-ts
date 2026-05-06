import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migratePasswords } from './services/crypto';
import { migratePhones } from './services/phoneEncryption';
import { loadPatients, savePatients } from './services/storage';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Offline-first should never block the app.
  });
}

// Silently migrate any plain-text passwords to PBKDF2 hashes
migratePasswords();

// Silently encrypt any plain-text phone numbers in localStorage.
// This runs once on first app load after the update; subsequent runs
// are no-ops (isEncryptedPhone guard in migratePhones).
(async () => {
  try {
    const patients = loadPatients();
    const count = await migratePhones(patients);
    if (count > 0) {
      savePatients(patients);
      console.info(`[RemoteCare] Encrypted ${count} phone number(s) at rest.`);
    }
  } catch (e) {
    console.error('[RemoteCare] Phone migration failed:', e);
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
