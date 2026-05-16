// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · src/App.tsx
// Root component — auth gate, page routing, store init
//
// SECURITY FIXES
// ─────────────────────────────────────────────────────────
// • migratePasswords() runs on every mount so any user whose
//   password was created before PBKDF2 hashing is upgraded
//   automatically on their next login.
// • autoAssignPrefix() runs after login so each device at a
//   facility gets a unique letter (A, B, C…) without manual
//   admin action.  No-op if a prefix is already assigned.
// • checkAutoBackup() only fires on non-shared devices.
//   On shared clinic tablets, auto-download would expose
//   data to whoever is sitting at the machine.  Set
//   VITE_SHARED_DEVICE=true in Vercel env vars to disable
//   auto-backup on shared hardware.
// ════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useAuthStore }    from './store/useAuthStore';
import { usePatientStore } from './store/usePatientStore';
import { useUIStore }      from './store/useUIStore';
import Topbar    from './components/layout/Topbar';
import NavTabs   from './components/layout/NavTabs';
import Sidebar   from './components/layout/Sidebar';
import SyncBar   from './components/ui/SyncBar';
import AuthPage  from './pages/AuthPage';
import PatientsPage from './pages/PatientsPage';
import LTFUPage     from './pages/LTFUPage';
import ClinicPage   from './pages/ClinicPage';
import ReportsPage  from './pages/ReportsPage';
import AdminPage    from './pages/AdminPage';
import VisitModal   from './components/visit/VisitModal';
import MedModal     from './components/visit/MedModal';
import type { PageId } from './types';
import { checkAutoBackup, startAutoBackupScheduler } from './services/backup';
import { migratePasswords } from './services/crypto';
import { autoAssignPrefix }  from './services/deviceManager';

// Set VITE_SHARED_DEVICE=true in Vercel env to disable auto-download
// backups on shared clinic tablets (security hardening).
const IS_SHARED_DEVICE =
  (import.meta as any).env.VITE_SHARED_DEVICE === 'true';

function isDoctorPage(p: PageId) {
  return p === 'patients' || p === 'ltfu' || p === 'clinic' || p === 'reports';
}

function isAdminPage(p: PageId) {
  return (
    p === 'overview'         ||
    p === 'trends'           ||
    p === 'doctors'          ||
    p === 'settings'         ||
    p === 'user-management'  ||
    p === 'directory'
  );
}

export default function App() {
  const { init, currentUser, isLoading } = useAuthStore();
  const loadFromStorage = usePatientStore((s) => s.loadFromStorage);
  const runAutoLtfu     = usePatientStore((s) => s.runAutoLtfu);
  const activePage      = useUIStore((s) => s.activePage);
  const navigateTo      = useUIStore((s) => s.navigateTo);
  const clinicSettings  = useUIStore((s) => s.clinicSettings);

  // ── App init ─────────────────────────────────────────────────
  useEffect(() => {
    // FIX: migrate any plain-text passwords in localStorage to
    // PBKDF2 hashes before the session is restored.  Safe to call
    // on every mount — idempotent.
    migratePasswords().then(() => {
      init();
      loadFromStorage();
    });
  }, [init, loadFromStorage]);

  // ── Auto-backup (non-shared devices only) ────────────────────
  useEffect(() => {
    if (!currentUser || IS_SHARED_DEVICE) return;
    checkAutoBackup(currentUser.displayName);
    const cleanup = startAutoBackupScheduler(currentUser.displayName);
    return cleanup;
  }, [currentUser]);

  // ── Device prefix auto-assignment ────────────────────────────
  // Runs once after login.  If this device has no prefix yet,
  // claims the next available letter at the facility.
  // The result is written to localStorage (th_device_prefix) so
  // subsequent patient codes use it automatically.
  useEffect(() => {
    if (!currentUser) return;
    const { sessionRegion, sessionDistrict, sessionHospital } = currentUser;
    if (!sessionRegion || !sessionHospital) return;

    autoAssignPrefix(sessionRegion, sessionDistrict, sessionHospital)
      .then((letter) => {
        if (letter) {
          console.info(`[RemoteCare] Device prefix: ${letter}`);
        }
      })
      .catch((err) => {
        // Non-fatal — prefix assignment fails gracefully offline.
        // The device will use legacy codes (no letter) until connectivity
        // is restored and the prefix is assigned on the next login.
        console.warn('[RemoteCare] Device prefix assignment failed:', err);
      });
  }, [currentUser?.id]); // only re-run on actual user change

  // ── Auto-LTFU engine — runs on load + every 60 s ─────────────
  useEffect(() => {
    if (!currentUser) return;
    runAutoLtfu(clinicSettings);
    const timer = setInterval(() => runAutoLtfu(clinicSettings), 60_000);
    return () => clearInterval(timer);
  }, [currentUser, clinicSettings, runAutoLtfu]);

  // ── Role-based page guard ─────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'doctor' && !isDoctorPage(activePage)) {
      navigateTo('patients');
    }
    if (currentUser.role === 'admin' && !isAdminPage(activePage)) {
      navigateTo('overview');
    }
  }, [currentUser, activePage, navigateTo]);

  // ── Loading splash ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#132b31',
      }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            fontSize: 24, fontWeight: 800, marginBottom: 8,
          }}>
            RemoteCare
          </div>
          <div style={{ fontSize: 12, opacity: 0.5 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!currentUser) return <AuthPage />;

  const role    = currentUser.role;
  const isAdmin = role === 'admin';
  const pageBg  = role === 'doctor' ? '#f8fafc' : '#f0f2f5';

  // ── Admin layout (sidebar) ────────────────────────────────────
  if (isAdmin) {
    return (
      <div style={{
        display: 'flex', minHeight: '100vh',
        background: 'linear-gradient(135deg,#e8ecf3 0%,#eef0f5 40%,#e4e9f2 100%)',
        backgroundImage: `linear-gradient(135deg,#e8ecf3 0%,#eef0f5 40%,#e4e9f2 100%),url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23b8c4d4' fill-opacity='0.08'%3E%3Ccircle cx='30' cy='30' r='1.5'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}>
        <Sidebar />
        <div
          id="admin-main"
          style={{
            flex: 1, minWidth: 0, marginLeft: '220px',
            transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <AdminPage />
        </div>
        <VisitModal />
        <MedModal />
      </div>
    );
  }

  // ── Doctor layout (topbar + tabs) ─────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: pageBg }}>
      <Topbar />
      <SyncBar />
      <NavTabs />
      <main className="min-h-[calc(100vh-94px)]">
        {role === 'doctor' ? (
          <>
            {activePage === 'patients' ? <PatientsPage /> : null}
            {activePage === 'ltfu'     ? <LTFUPage />     : null}
            {activePage === 'clinic'   ? <ClinicPage />   : null}
            {activePage === 'reports'  ? <ReportsPage />  : null}
          </>
        ) : (
          <AdminPage />
        )}
      </main>
      <VisitModal />
      <MedModal />
    </div>
  );
}
