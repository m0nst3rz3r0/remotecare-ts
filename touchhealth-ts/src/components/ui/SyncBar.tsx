import { useEffect, useMemo, useState } from 'react';
import { getLastSync, syncPatientsWithCloud, deduplicateAndRepair, diagnoseSyncIssue } from '../../services/storage';
import { useAuthStore } from '../../store/useAuthStore';
import Button from './Button';

type ConnState = 'online' | 'offline' | 'syncing';

function formatLastSync(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SyncBar() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [conn, setConn] = useState<ConnState>(() =>
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  );

  const [syncNonce, setSyncNonce] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const lastSyncAt = useMemo(() => getLastSync(), [syncNonce]);

  const handleSync = async () => {
    if (conn === 'offline') return;
    setConn('syncing');
    setSyncError(null);
    setSyncMsg(null);
    try {
      const result = await syncPatientsWithCloud();
      if (result.success) {
        window.location.reload();
      } else {
        setSyncError(result.error ?? 'Sync failed — check console for details');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown sync error';
      setSyncError(msg);
      console.error('Sync failed', error);
    } finally {
      setConn('online');
      setSyncNonce((n) => n + 1);
    }
  };

  const handleRepair = async () => {
    if (conn === 'offline') return;
    if (!confirm('This will remove duplicate patients (keeping the one with visits) and clean up Supabase. Continue?')) return;
    setConn('syncing');
    setSyncError(null);
    setSyncMsg(null);
    const result = await deduplicateAndRepair();
    setConn('online');
    setSyncNonce((n) => n + 1);
    if (result.error) {
      setSyncError(result.error);
    } else if (result.fixed === 0) {
      setSyncMsg('No duplicates found.');
    } else {
      setSyncMsg(`✓ Removed ${result.fixed} duplicate(s). Reloading...`);
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  const [diagReport, setDiagReport] = useState<string | null>(null);

  const handleDiagnose = async () => {
    setDiagReport('Running diagnostic...');
    const report = await diagnoseSyncIssue();
    setDiagReport(report);
  };

  useEffect(() => {
    const onOnline = () => setConn('online');
    const onOffline = () => setConn('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <div className="px-3 py-2 border border-slate-200 rounded-lg bg-white shadow-sm mb-4">
      <div className="flex items-center gap-3">
        {/* Connection Status Dot */}
        <div className="relative flex h-3 w-3">
           {conn === 'online' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
           <span className={`relative inline-flex rounded-full h-3 w-3 ${
             conn === 'online' ? 'bg-emerald-600' : conn === 'offline' ? 'bg-amber-500' : 'bg-blue-500 animate-spin border-2 border-t-transparent'
           }`}></span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-slate-800">
              {conn === 'syncing' ? 'Synchronizing...' : `Last Sync: ${formatLastSync(lastSyncAt)}`}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
              {conn.toUpperCase()}
            </span>
          </div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
            <span className="text-emerald-600">👤 {currentUser?.displayName || 'Unknown User'}</span>
            <span className="opacity-50">|</span>
            <span>{currentUser?.isSuperAdmin ? 'Platform Superadmin' : `${currentUser?.role} : ${currentUser?.adminRegion || 'National'}`}</span>
          </div>
        </div>

        {conn !== 'offline' && (
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant="ghost"
              icon={<span>↻</span>}
              label={conn === 'syncing' ? "Processing..." : "Sync Now"}
              onClick={handleSync}
              disabled={conn === 'syncing'}
            />
            <Button
              size="xs"
              variant="ghost"
              icon={<span>🔧</span>}
              label="Fix Duplicates"
              onClick={handleRepair}
              disabled={conn === 'syncing'}
            />
            <Button
              size="xs"
              variant="ghost"
              icon={<span>🔍</span>}
              label="Diagnose"
              onClick={handleDiagnose}
              disabled={conn === 'syncing'}
            />
          </div>
        )}
      </div>
      {syncError && (
        <div className="mt-1 text-[11px] text-red-600 font-medium truncate" title={syncError}>
          ⚠ {syncError}
        </div>
      )}
      {syncMsg && (
        <div className="mt-1 text-[11px] text-emerald-600 font-medium">
          {syncMsg}
        </div>
      )}
      {diagReport && (
        <pre className="mt-2 text-[10px] bg-slate-50 border border-slate-200 rounded p-2 whitespace-pre-wrap max-h-48 overflow-y-auto text-slate-700">
          {diagReport}
        </pre>
      )}
    </div>
  );
}
