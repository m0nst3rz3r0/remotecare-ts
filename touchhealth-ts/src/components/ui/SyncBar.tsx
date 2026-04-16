import { useEffect, useMemo, useState } from 'react';
import { getLastSync, syncPatientsWithCloud } from '../../services/storage';
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
  const [conn, setConn] = useState<ConnState>(() =>
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  );

  const [syncNonce, setSyncNonce] = useState(0);
  const lastSyncAt = useMemo(() => getLastSync(), [syncNonce]);

  const handleSync = async () => {
    if (conn === 'offline') return;
    
    setConn('syncing');
    try {
      const result = await syncPatientsWithCloud();
      if (result.success) {
        // Force refresh to update the global store with the pulled data
        window.location.reload(); 
      }
    } catch (error) {
      console.error("Sync failed", error);
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
    <div className="h-auto px-3 py-2 border-b border-slate-200 bg-slate-50">
      <div className="flex items-center gap-3">
        {conn === 'online' ? (
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
        ) : conn === 'offline' ? (
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
        )}

        <div className="flex-1 min-w-0">
          {conn === 'syncing' ? (
            <div className="text-[13px] font-bold truncate">Syncing with Supabase…</div>
          ) : conn === 'offline' ? (
            <div className="text-[13px] font-bold truncate">
              Offline mode · Changes saved locally
            </div>
          ) : (
            <div className="text-[13px] font-bold truncate">
              Connected · Last synced: {formatLastSync(lastSyncAt)}
            </div>
          )}
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Offline-first NCD management
          </div>
        </div>

        {conn !== 'offline' && (
          <Button
            size="xs"
            variant="ghost"
            icon={<span className="leading-none">↻</span>}
            label={conn === 'syncing' ? "Syncing..." : "Sync"}
            onClick={handleSync}
            disabled={conn === 'syncing'}
          />
        )}
      </div>
    </div>
  );
}
