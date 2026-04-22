import { useEffect, useMemo, useState } from 'react';
import { getLastSync, syncPatientsWithCloud } from '../../services/storage';
import { useAuthStore } from '../../store/useAuthStore'; // Import Auth Store
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
  const currentUser = useAuthStore((s) => s.currentUser); // Get User Info
  const [conn, setConn] = useState<ConnState>(() =>
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  );

  const [syncNonce, setSyncNonce] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastSyncAt = useMemo(() => getLastSync(), [syncNonce]);

  const handleSync = async () => {
    if (conn === 'offline') return;
    setConn('syncing');
    setSyncError(null);
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
          
          {/* USER IDENTITY SECTION */}
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
            <span className="text-emerald-600">👤 {currentUser?.displayName || 'Unknown User'}</span>
            <span className="opacity-50">|</span>
            <span>{currentUser?.isSuperAdmin ? 'Platform Superadmin' : `${currentUser?.role} : ${currentUser?.adminRegion || 'National'}`}</span>
          </div>
        </div>

        {conn !== 'offline' && (
          <Button
            size="xs"
            variant="ghost"
            icon={<span>↻</span>}
            label={conn === 'syncing' ? "Processing..." : "Sync Now"}
            onClick={handleSync}
            disabled={conn === 'syncing'}
          />
        )}
      </div>
      {syncError && (
        <div className="mt-1 text-[11px] text-red-600 font-medium truncate" title={syncError}>
          ⚠ {syncError}
        </div>
      )}
    </div>
  );
}
