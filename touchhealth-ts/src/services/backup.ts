// ════════════════════════════════════════════════════════════
// REMOTECARE · src/services/backup.ts
// Automated backup system
// - Daily automatic JSON export to browser download
// - Manual backup trigger
// - Backup restore from JSON file
// - Backup history in localStorage
// - Works fully offline
// ════════════════════════════════════════════════════════════

const BACKUP_META_KEY = 'th_backup_meta';
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface BackupMeta {
  lastBackupAt: string | null;
  lastBackupSize: number;
  totalBackups: number;
  nextBackupAt: string | null;
}

export interface BackupData {
  version: '2.0';
  exportedAt: string;
  exportedBy: string;
  organisation: 'RemoteCare Research Organisation';
  data: {
    patients:  unknown;
    users:     unknown;
    hospitals: unknown;
    clinic:    unknown;
    smsLog:    unknown;
  };
}

// ── META ──────────────────────────────────────────────────────

export function loadBackupMeta(): BackupMeta {
  try {
    const raw = localStorage.getItem(BACKUP_META_KEY);
    return raw ? JSON.parse(raw) : defaultMeta();
  } catch {
    return defaultMeta();
  }
}
function defaultMeta(): BackupMeta {
  return { lastBackupAt: null, lastBackupSize: 0, totalBackups: 0, nextBackupAt: null };
}
function saveMeta(meta: BackupMeta): void {
  localStorage.setItem(BACKUP_META_KEY, JSON.stringify(meta));
}

// ── COLLECT DATA ──────────────────────────────────────────────

function collectAllData(exportedBy: string): BackupData {
  return {
    version:      '2.0',
    exportedAt:   new Date().toISOString(),
    exportedBy,
    organisation: 'RemoteCare Research Organisation',
    data: {
      patients:  safeRead('zmz2_pts'),
      users:     safeRead('th_users'),
      hospitals: safeRead('th_hospitals'),
      clinic:    safeRead('th_clinic'),
      smsLog:    safeRead('th_sms_log'),
    },
  };
}

function safeRead(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── EXPORT (DOWNLOAD) ─────────────────────────────────────────

/**
 * Export all data as a downloadable JSON file.
 * Returns the file size in bytes.
 */
export function exportBackup(exportedBy: string): number {
  const data    = collectAllData(exportedBy);
  const json    = JSON.stringify(data, null, 2);
  const bytes   = new TextEncoder().encode(json).length;
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `RemoteCare_Backup_${dateStr}.json`;

  // Create download
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Update meta
  const meta = loadBackupMeta();
  const now  = new Date();
  const next = new Date(now.getTime() + BACKUP_INTERVAL_MS);
  saveMeta({
    lastBackupAt:  now.toISOString(),
    lastBackupSize: bytes,
    totalBackups:  meta.totalBackups + 1,
    nextBackupAt:  next.toISOString(),
  });

  return bytes;
}

// ── AUTO BACKUP ───────────────────────────────────────────────

/**
 * Check if a backup is due and trigger one automatically.
 * Call this on app startup.
 */
export function checkAutoBackup(exportedBy: string): boolean {
  const meta = loadBackupMeta();
  if (!meta.lastBackupAt) return false; // first session — don't auto-backup

  const lastBackup = new Date(meta.lastBackupAt).getTime();
  const now = Date.now();
  const isDue = now - lastBackup > BACKUP_INTERVAL_MS;

  if (isDue) {
    exportBackup(exportedBy);
    return true;
  }
  return false;
}

/**
 * Schedule an auto-backup check every hour.
 * Returns cleanup function.
 */
export function startAutoBackupScheduler(exportedBy: string): () => void {
  const interval = setInterval(() => {
    checkAutoBackup(exportedBy);
  }, 60 * 60 * 1000); // check every hour

  return () => clearInterval(interval);
}

// ── RESTORE ───────────────────────────────────────────────────

export type RestoreResult =
  | { success: true; message: string; counts: Record<string, number> }
  | { success: false; error: string };

/**
 * Restore data from a backup JSON file.
 * The user selects the file via a file input element.
 */
export async function restoreFromFile(file: File): Promise<RestoreResult> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as BackupData;

    // Validate structure
    if (data.version !== '2.0' || !data.data) {
      return { success: false, error: 'Invalid backup file format. Please use a RemoteCare backup file.' };
    }

    const confirmMsg =
      `This will REPLACE all current data with the backup from ${new Date(data.exportedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}.\n\n` +
      `Exported by: ${data.exportedBy}\n\n` +
      `Are you sure you want to restore? This cannot be undone.`;

    if (!window.confirm(confirmMsg)) {
      return { success: false, error: 'Restore cancelled by user.' };
    }

    // Restore each key
    const counts: Record<string, number> = {};

    if (data.data.patients) {
      localStorage.setItem('zmz2_pts', JSON.stringify(data.data.patients));
      counts.patients = (data.data.patients as unknown[]).length;
    }
    if (data.data.users) {
      localStorage.setItem('th_users', JSON.stringify(data.data.users));
      counts.users = (data.data.users as unknown[]).length;
    }
    if (data.data.hospitals) {
      localStorage.setItem('th_hospitals', JSON.stringify(data.data.hospitals));
      counts.hospitals = (data.data.hospitals as unknown[]).length;
    }
    if (data.data.clinic) {
      localStorage.setItem('th_clinic', JSON.stringify(data.data.clinic));
    }
    if (data.data.smsLog) {
      localStorage.setItem('th_sms_log', JSON.stringify(data.data.smsLog));
    }

    return {
      success: true,
      message: `Restore successful. Data from ${new Date(data.exportedAt).toLocaleDateString('en-GB')} has been restored.`,
      counts,
    };
  } catch (e) {
    return { success: false, error: `Failed to restore: ${String(e)}` };
  }
}

// ── BACKUP STATUS ─────────────────────────────────────────────

export function backupStatus(): {
  isDue: boolean;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
  daysSinceBackup: number | null;
} {
  const meta = loadBackupMeta();
  if (!meta.lastBackupAt) {
    return { isDue: false, lastBackupAt: null, nextBackupAt: null, daysSinceBackup: null };
  }

  const lastBackup = new Date(meta.lastBackupAt).getTime();
  const daysSince  = Math.floor((Date.now() - lastBackup) / 86400000);
  const isDue      = daysSince >= 1;

  return {
    isDue,
    lastBackupAt:    meta.lastBackupAt,
    nextBackupAt:    meta.nextBackupAt,
    daysSinceBackup: daysSince,
  };
}

// ── FORMAT HELPERS ────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
