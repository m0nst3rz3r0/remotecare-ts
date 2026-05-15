// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · src/services/sync.ts
//
// FIX: This file previously duplicated the push/pull logic that
// storage.ts already implements more completely (with dedup,
// ghost-patient cleanup, and user/hospital sync).  It is now a
// thin wrapper so existing callers don't break, but all real
// work is delegated to syncPatientsWithCloud() in storage.ts.
//
// The old fetchFromCloud() had an N+1 query problem (one Supabase
// round trip per patient for visits, then one per visit for meds).
// The canonical implementation in storage.ts fetches all visits
// and medications in two bulk queries.
// ════════════════════════════════════════════════════════════

import type { Patient, SessionUser } from '../types';
import {
  syncPatientsWithCloud,
  loadPatients,
  getLastSync,
  getSyncCount,
} from './storage';
import { syncDevicePrefixFromCloud } from './deviceManager';
import { getSession } from './auth';

export interface SyncResult {
  success: boolean;
  skipped?: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  error?: string;
}

/**
 * Sync to cloud.  Delegates to the canonical implementation in
 * storage.ts which handles deduplication, ghost-patient cleanup,
 * users, hospitals, and bulk-fetch of visits/medications.
 */
export async function syncToCloud(
  patients: Patient[],
  _user: SessionUser | null,
): Promise<SyncResult> {
  const lastSyncAt  = getLastSync();
  const lastCount   = getSyncCount();
  const pendingCount = Math.max(0, patients.length - lastCount);

  if (!patients.length) {
    return { success: true, lastSyncAt, pendingCount: 0 };
  }

  const result = await syncPatientsWithCloud();

  // Sync device prefix from cloud (admin may have assigned one remotely)
  const session = getSession();
  if (session) {
    syncDevicePrefixFromCloud(
      session.sessionRegion,
      session.sessionDistrict,
      session.sessionHospital,
    ).catch((err) => console.warn('Device prefix sync failed:', err));
  }

  if (result.success) {
    return {
      success:     true,
      lastSyncAt:  getLastSync(),
      pendingCount: 0,
    };
  }

  return {
    success:      false,
    lastSyncAt,
    pendingCount,
    error:        result.error,
  };
}

/**
 * Fetch patients from cloud.
 *
 * FIX: Delegates to syncPatientsWithCloud() which uses 2 bulk
 * queries instead of N+1.  Returns the merged local patient list
 * after the sync completes.
 */
export async function fetchFromCloud(): Promise<Patient[]> {
  try {
    await syncPatientsWithCloud();
    return loadPatients();
  } catch (e) {
    console.error('Fetch error:', e);
    return loadPatients(); // return local data on failure
  }
}
