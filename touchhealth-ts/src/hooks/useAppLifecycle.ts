import { useEffect } from 'react';
import { checkAutoBackup, startAutoBackupScheduler } from '../services/backup';
import { migratePasswords } from '../services/crypto';
import { autoAssignPrefix } from '../services/deviceManager';
import { getSafePageForUser } from '../services/navigation';
import type { ClinicSettings, PageId, SessionUser } from '../types';
import { logger } from '../utils/logger';

const IS_SHARED_DEVICE = (import.meta as any).env.VITE_SHARED_DEVICE === 'true';

export function useAppBootstrap(init: () => void, loadFromStorage: () => void) {
  useEffect(() => {
    migratePasswords().then(() => {
      init();
      loadFromStorage();
    });
  }, [init, loadFromStorage]);
}

export function useAutoBackup(currentUser: SessionUser | null) {
  useEffect(() => {
    if (!currentUser || IS_SHARED_DEVICE) return;
    checkAutoBackup(currentUser.displayName);
    const cleanup = startAutoBackupScheduler(currentUser.displayName);
    return cleanup;
  }, [currentUser]);
}

export function useDevicePrefixAssignment(currentUser: SessionUser | null) {
  useEffect(() => {
    if (!currentUser) return;
    const { sessionRegion, sessionDistrict, sessionHospital } = currentUser;
    if (!sessionRegion || !sessionHospital) return;

    autoAssignPrefix(sessionRegion, sessionDistrict, sessionHospital)
      .then((letter) => {
        if (letter) logger.info(`Device prefix: ${letter}`);
      })
      .catch((err) => logger.warn('Device prefix assignment failed (offline?)', err));
  }, [currentUser]);
}

export function useAutoLtfuScheduler(
  currentUser: SessionUser | null,
  clinicSettings: ClinicSettings,
  runAutoLtfu: (settings: ClinicSettings) => string[],
) {
  useEffect(() => {
    if (!currentUser) return;
    runAutoLtfu(clinicSettings);
    const timer = setInterval(() => runAutoLtfu(clinicSettings), 60_000);
    return () => clearInterval(timer);
  }, [currentUser, clinicSettings, runAutoLtfu]);
}

export function usePageAccessGuard(
  currentUser: SessionUser | null,
  activePage: PageId,
  navigateTo: (page: PageId) => void,
) {
  useEffect(() => {
    if (!currentUser) return;
    const safePage = getSafePageForUser(currentUser, activePage);
    if (safePage !== activePage) navigateTo(safePage);
  }, [currentUser, activePage, navigateTo]);
}
