import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { usePatientStore } from '../../store/usePatientStore';
import { getLastSync, getSyncCount } from '../../services/storage';
import { syncToCloud } from '../../services/sync';
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
  const patients = usePatientStore((s) => s.patients);
  const user = useAuthStore((s) => s.currentUser);

  const [conn, setConn] = useState<ConnState>(() =>
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  );

  // Force re-render after sync so `getLastSync/getSyncCount` reads stay fresh.
  const [syncNonce, setSyncNonce] = useState(0);
  const timerRef = useRef<number | null>(null);

  const pendingCount = useMemo(() => {
    const lastCount = getSyncCount();
    return Math.max(0, patients.length - lastCount);
  }, [patients.length, syncNonce]);

  const lastSyncAt = useMemo(() => getLastSync(), [syncNonce]);

  useEffect(() => {
    const onOnline = () => {
      setConn('online');
      if (timerRef.current) window.clearTimeout(timerRef.current);

      timerRef.current = window.setTimeout(() => {
        const shouldSync = pendingCount > 0 && navigator.onLine;
        if (!shouldSync) return;
        setConn('syncing');
        syncToCloud(patients, user)
          .catch(() => {
            // Never crash
          })
          .finally(() => {
            setConn('online');
            setSyncNonce((n) => n + 1);
          });
      }, 2000);
    };

    const onOffline = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setConn('offline');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [patients, user, pendingCount]);

  const canManualSync = conn === 'online' && pendingCount > 0;

  const handleSync = async () => {
    setConn('syncing');
    try {
      await syncToCloud(patients, user);
    } finally {
      setConn('online');
      setSyncNonce((n) => n + 1);
    }
  };

  return (
    <div
      className="h-auto px-3 py-2 border-b border-slate-200 bg-slate-50"
    >
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
            <div className="text-[13px] font-bold truncate">Syncing…</div>
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

        {canManualSync ? (
          <Button
            size="xs"
            variant="ghost"
            icon={<span className="leading-none">↻</span>}
            label="Sync"
            onClick={handleSync}
          />
        ) : null}
      </div>
    </div>
  );
}

