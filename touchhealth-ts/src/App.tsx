// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · src/App.tsx
// Root component — auth gate, page routing, store init
// ════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { usePatientStore } from './store/usePatientStore';
import { useUIStore } from './store/useUIStore';
import Topbar from './components/layout/Topbar';
import NavTabs from './components/layout/NavTabs';
import SyncBar from './components/ui/SyncBar';
import AuthPage from './pages/AuthPage';
import PatientsPage from './pages/PatientsPage';
import LTFUPage from './pages/LTFUPage';
import ClinicPage from './pages/ClinicPage';
import ReportsPage from './pages/ReportsPage';
import AdminPage from './pages/AdminPage';
import VisitModal from './components/visit/VisitModal';
import MedModal from './components/visit/MedModal';
import type { PageId } from './types';
import { checkAutoBackup, startAutoBackupScheduler } from './services/backup';

function isDoctorPage(p: PageId) {
  return p === 'patients' || p === 'ltfu' || p === 'clinic' || p === 'reports';
}

function isAdminPage(p: PageId) {
  return p === 'overview' || p === 'trends' || p === 'doctors' || p === 'settings';
}

export default function App() {
  const { init, currentUser, isLoading } = useAuthStore();
  const loadFromStorage = usePatientStore((s) => s.loadFromStorage);
  const runAutoLtfu    = usePatientStore((s) => s.runAutoLtfu);
  const activePage     = useUIStore((s) => s.activePage);
  const navigateTo     = useUIStore((s) => s.navigateTo);
  const clinicSettings = useUIStore((s) => s.clinicSettings);

  useEffect(() => {
    init();
    loadFromStorage();
    // seedPatients() removed — no demo data
  }, [init, loadFromStorage]);

  useEffect(() => {
    if (!currentUser) return;
    checkAutoBackup(currentUser.displayName);
    const cleanup = startAutoBackupScheduler(currentUser.displayName);
    return cleanup;
  }, [currentUser]);

  // ── Auto-LTFU engine — runs on load + every 60s ──────────────
  useEffect(() => {
    if (!currentUser) return;
    runAutoLtfu(clinicSettings);
    const timer = setInterval(() => runAutoLtfu(clinicSettings), 60_000);
    return () => clearInterval(timer);
  }, [currentUser, clinicSettings, runAutoLtfu]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'doctor' && !isDoctorPage(activePage)) {
      navigateTo('patients');
    }
    if (currentUser.role === 'admin' && !isAdminPage(activePage)) {
      navigateTo('overview');
    }
  }, [currentUser, activePage, navigateTo]);

  if (isLoading) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#132b31',
      }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
            RemoteCare
          </div>
          <div style={{ fontSize: 12, opacity: 0.5 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!currentUser) return <AuthPage />;

  const role = currentUser.role;

  return (
    <div className="min-h-screen bg-brand-bg">
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
