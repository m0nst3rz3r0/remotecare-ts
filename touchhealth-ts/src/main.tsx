import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// ADDED: import migratePasswords to upgrade legacy plain-text passwords on startup
import { migratePasswords } from './services/crypto';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Offline-first should never block the app.
  });
}

// ADDED: silently migrate any plain-text passwords to PBKDF2 hashes
migratePasswords();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
