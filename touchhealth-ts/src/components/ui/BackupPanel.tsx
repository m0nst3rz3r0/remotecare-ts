// ════════════════════════════════════════════════════════════
// REMOTECARE · src/components/ui/BackupPanel.tsx
// Backup management panel for admin settings page
// ════════════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import {
  exportBackup, restoreFromFile, backupStatus,
  loadBackupMeta, formatBytes,
} from '../../services/backup';

export default function BackupPanel() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [status, setStatus] = useState(() => backupStatus());
  const [meta,   setMeta]   = useState(() => loadBackupMeta());
  const [msg,    setMsg]    = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function doBackup() {
    const name = currentUser?.displayName ?? 'Unknown';
    const bytes = exportBackup(name);
    setStatus(backupStatus());
    setMeta(loadBackupMeta());
    setMsg({ type: 'ok', text: `✅ Backup downloaded successfully (${formatBytes(bytes)})` });
  }

  async function doRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    const result = await restoreFromFile(file);
    setRestoring(false);
    if (result.success) {
      setMsg({ type: 'ok', text: `✅ ${result.message} · Patients: ${result.counts.patients ?? 0} · Users: ${result.counts.users ?? 0}` });
      window.location.reload(); // reload to reflect restored data
    } else {
      setMsg({ type: 'err', text: `❌ ${result.error}` });
    }
    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  }

  const daysSince = status.daysSinceBackup;
  const isDue     = status.isDue;

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(191,200,205,.18)', boxShadow: '0 2px 8px rgba(15,31,38,.06)' }}>
      {/* Header */}
      <div style={{ background: '#0f1f26', height: 40, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
        <span style={{ fontSize: 16 }}>💾</span>
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: '#fff' }}>
          Data Backup & Restore
        </span>
        {isDue && (
          <span style={{ marginLeft: 'auto', fontSize: 8, fontWeight: 800, background: 'rgba(220,38,38,.3)', color: '#fca5a5', padding: '2px 8px', borderRadius: 9999, textTransform: 'uppercase', letterSpacing: '.4px' }}>
            Backup Due
          </span>
        )}
      </div>

      <div style={{ padding: 20, background: '#fff' }}>
        {/* Status */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20,
        }}>
          {[
            {
              label: 'Last Backup',
              val: status.lastBackupAt
                ? new Date(status.lastBackupAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Never',
              color: status.lastBackupAt ? '#16a34a' : '#dc2626',
            },
            {
              label: 'Days Since Backup',
              val: daysSince !== null ? `${daysSince}d ago` : '—',
              color: daysSince !== null && daysSince > 1 ? '#d97706' : '#16a34a',
            },
            {
              label: 'Total Backups',
              val: String(meta.totalBackups),
              color: '#0d6e87',
            },
          ].map((t) => (
            <div key={t.label} style={{ background: '#f9f9f7', borderRadius: 8, padding: 12 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#6f797d', marginBottom: 4 }}>
                {t.label}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: t.color }}>
                {t.val}
              </div>
            </div>
          ))}
        </div>

        {/* Message */}
        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: 4, marginBottom: 16, fontSize: 12,
            background: msg.type === 'ok' ? 'rgba(22,163,74,.08)' : 'rgba(220,38,38,.08)',
            border: `1px solid ${msg.type === 'ok' ? 'rgba(22,163,74,.2)' : 'rgba(220,38,38,.2)'}`,
            color: msg.type === 'ok' ? '#14532d' : '#7f1d1d',
          }}>
            {msg.text}
          </div>
        )}

        {/* Warning if overdue */}
        {isDue && (
          <div style={{
            padding: '10px 14px', borderRadius: 4, marginBottom: 16, fontSize: 12,
            background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.2)', color: '#78350f',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <div>
              <strong>Backup overdue.</strong> Your last backup was {daysSince} day{daysSince !== 1 ? 's' : ''} ago.
              Regular backups protect against data loss. Click "Download Backup" now.
            </div>
          </div>
        )}

        {/* Info */}
        <div style={{
          padding: '10px 14px', borderRadius: 4, marginBottom: 20, fontSize: 11,
          background: 'rgba(13,110,135,.05)', border: '1px solid rgba(13,110,135,.1)', color: '#005469',
        }}>
          <strong>How it works:</strong> Backup exports all patient records, user accounts, hospital data and SMS logs
          as a single JSON file to your Downloads folder. Store it on a USB drive or email it to yourself.
          Restore loads the file back if data is ever lost.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={doBackup}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', background: '#005469', color: '#fff',
              border: 'none', borderRadius: 4, cursor: 'pointer',
              fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,84,105,.25)',
            }}
          >
            💾 Download Backup Now
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={restoring}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px',
              background: restoring ? '#e8e8e6' : '#fee2e2',
              color: restoring ? '#6f797d' : '#dc2626',
              border: '1.5px solid rgba(220,38,38,.2)', borderRadius: 4,
              cursor: restoring ? 'not-allowed' : 'pointer',
              fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700,
            }}
          >
            {restoring ? '⏳ Restoring…' : '📂 Restore from Backup'}
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={doRestore}
        />

        <div style={{ marginTop: 12, fontSize: 10, color: '#6f797d', fontStyle: 'italic' }}>
          ⚠️ Restoring a backup will replace ALL current data. This cannot be undone.
        </div>
      </div>
    </div>
  );
}
