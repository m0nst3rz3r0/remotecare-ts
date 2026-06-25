import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { migratePhones } from './services/phoneEncryption';
import { loadPatients, savePatients, runSchemaMigrations } from './services/storage';
import { preloadClinicalData, loadZonePresets } from './lib/clinical/dataLoader';
import zonePresets from './data/zoneAvailabilityPresets.json';
import type { ZonePreset } from './lib/clinical/types';
import { logger } from './utils/logger';

runSchemaMigrations();
preloadClinicalData().catch((e) => logger.warn('Clinical preload failed', e));
loadZonePresets(zonePresets as Record<string, ZonePreset>);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Offline-first should never block the app.
  });
}

// NOTE: password migration is handled in App.tsx (awaited before
// init/session restore) so it runs exactly once, sequenced. Do not
// also call it here — a second unsequenced call races the same
// localStorage key.

// Silently encrypt any plain-text phone numbers in localStorage.
// This runs once on first app load after the update; subsequent runs
// are no-ops (isEncryptedPhone guard in migratePhones).
(async () => {
  try {
    const patients = loadPatients();
    const count = await migratePhones(patients);
    if (count > 0) {
      savePatients(patients);
      logger.info(`Encrypted ${count} phone number(s) at rest.`);
    }
  } catch (e) {
    logger.error('Phone migration failed', e);
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
