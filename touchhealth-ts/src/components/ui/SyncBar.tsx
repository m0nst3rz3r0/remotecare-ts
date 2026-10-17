import { useEffect, useState } from 'react';
import { getLastSync, syncPatientsWithCloud } from '../../services/storage';
import { useAuthStore } from '../../store/useAuthStore';
import { login } from '../../services/auth';
import Button from './Button';
import { AlertTriangle, RefreshCw, UserCircle2 } from 'lucide-react';

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
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const lastSyncAt = getLastSync();

  const handleSync = async () => {
    if (conn === 'offline') return;
    setConn('syncing');
    setSyncError(null);
    try {
      const result = await syncPatientsWithCloud();
      if (result.success) {
        window.location.reload();
      } else {
        setSyncError(result.error ?? 'Sync failed');
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setConn('online');
    }
  };

  useEffect(() => {
    const onOnline  = () => setConn('online');
    const onOffline = () => setConn('offline');
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <div className="px-3 py-2 border border-slate-200 rounded-lg bg-white shadow-sm mb-4">
      <div className="flex items-center gap-3">

        {/* Status dot */}
        <div className="relative flex h-3 w-3 shrink-0">
          {conn === 'online' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${
            conn === 'online'  ? 'bg-emerald-600' :
            conn === 'offline' ? 'bg-amber-500'   :
            'bg-blue-500 animate-spin border-2 border-t-transparent'
          }`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-slate-800">
            {conn === 'syncing' ? 'Synchronizing…' : `Last Sync: ${formatLastSync(lastSyncAt)}`}
          </div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
            <span className="text-emerald-600 inline-flex items-center gap-1">
              <UserCircle2 size={12} />
              {currentUser?.displayName || 'Unknown User'}
            </span>
            <span className="opacity-50">|</span>
            <span>
              {currentUser?.isSuperAdmin
                ? 'Platform Superadmin'
                : `${currentUser?.role} · ${currentUser?.adminRegion || 'National'}`}
            </span>
          </div>
        </div>

        {conn === 'online' && <button type="button" className="text-[11px] font-bold text-teal-700" onClick={() => setShowLogin((v) => !v)}>Sign in online</button>}
        {/* Sync button */}
        {conn !== 'offline' && (
          <Button
            size="xs"
            variant="ghost"
            icon={<RefreshCw size={12} />}
            label={conn === 'syncing' ? 'Syncing…' : 'Sync Now'}
            onClick={handleSync}
            disabled={conn === 'syncing'}
          />
        )}
      </div>

      {showLogin && currentUser && <form className="flex flex-wrap items-center gap-2 mt-2" onSubmit={async (event) => {
        event.preventDefault();
        setSigningIn(true); setSyncError(null);
        try {
          const result = await login({ username: currentUser.username, password, role: currentUser.role });
          if (!result.success) setSyncError(result.error);
          else if (result.offline) setSyncError('Still offline. Local access is available; connect before syncing.');
          else { setShowLogin(false); setSyncError('Connected. Select Sync Now when you are ready.'); }
        } catch { setSyncError('Sign in failed. Local work is saved.'); }
        finally { setPassword(''); setSigningIn(false); }
      }}>
        <label className="text-[11px]">Password for {currentUser.username}
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="ml-2 border rounded px-2 py-1" />
        </label>
        <button type="submit" disabled={signingIn} className="text-[11px] font-bold text-teal-700">{signingIn ? 'Signing in...' : 'Reconnect account'}</button>
        <span className="text-[10px] text-slate-500">Your local records and device letter stay saved. This does not start a sync.</span>
      </form>}
      {syncError && (
        <div className="mt-1 text-[11px] text-red-600 font-medium" title={syncError}>
          <span className="inline-flex items-center gap-1"><AlertTriangle size={12} /> {syncError}</span>
        </div>
      )}
    </div>
  );
}

