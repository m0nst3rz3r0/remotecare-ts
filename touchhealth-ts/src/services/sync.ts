import type { Patient, SessionUser } from '../types';
import {
  getLastSync,
  setLastSync,
  getSyncCount,
  setSyncCount,
} from './storage';

export interface SyncResult {
  success: boolean;
  skipped?: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  error?: string;
}

/**
 * Offline-first sync:
 * - Only called when the app is online (and optional sync button / auto-sync triggers).
 * - Never throws: always resolves with a SyncResult.
 */
export async function syncToCloud(
  patients: Patient[],
  user: SessionUser | null,
): Promise<SyncResult> {
  const lastSyncAt = getLastSync();
  const lastCount = getSyncCount();
  const pendingCount = Math.max(0, patients.length - lastCount);

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !anonKey) {
    // Spec requirement: log and never crash
    // eslint-disable-next-line no-console
    console.log('sync skipped — no backend configured');
    return {
      success: false,
      skipped: true,
      lastSyncAt,
      pendingCount,
      error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY',
    };
  }

  if (!patients.length) {
    return {
      success: true,
      lastSyncAt,
      pendingCount: 0,
    };
  }

  try {
    const res = await fetch(supabaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        patients,
        user,
        lastSyncAt,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        success: false,
        lastSyncAt,
        pendingCount,
        error: `Sync failed: ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}`,
      };
    }

    setLastSync();
    setSyncCount(patients.length);

    return {
      success: true,
      lastSyncAt: getLastSync(),
      pendingCount: 0,
    };
  } catch (e) {
    return {
      success: false,
      lastSyncAt,
      pendingCount,
      error: e instanceof Error ? e.message : 'Unknown sync error',
    };
  }
}

