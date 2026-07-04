import { lazy, Suspense } from 'react';
import Topbar from './components/layout/Topbar';
import NavTabs from './components/layout/NavTabs';
import Sidebar from './components/layout/Sidebar';
import SyncBar from './components/ui/SyncBar';
import MedModal from './components/visit/MedModal';
import VisitModal from './components/visit/VisitModal';
import {
  useAppBootstrap,
  useAutoBackup,
  useAutoLtfuScheduler,
  useDevicePrefixAssignment,
  usePageAccessGuard,
} from './hooks/useAppLifecycle';
import AuthPage from './pages/AuthPage';
import { useAuthStore } from './store/useAuthStore';
import { usePatientStore } from './store/usePatientStore';
import { useUIStore } from './store/useUIStore';

const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const LTFUPage = lazy(() => import('./pages/LTFUPage'));
const ClinicPage = lazy(() => import('./pages/ClinicPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function PageFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: '#94a3b8',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        fontSize: 13,
      }}
    >
      Loading...
    </div>
  );
}

export default function App() {
  const { init, currentUser, isLoading } = useAuthStore();
  const loadFromStorage = usePatientStore((s) => s.loadFromStorage);
  const runAutoLtfu = usePatientStore((s) => s.runAutoLtfu);
  const activePage = useUIStore((s) => s.activePage);
  const navigateTo = useUIStore((s) => s.navigateTo);
  const clinicSettings = useUIStore((s) => s.clinicSettings);

  useAppBootstrap(init, loadFromStorage);
  useAutoBackup(currentUser);
  useDevicePrefixAssignment(currentUser);
  useAutoLtfuScheduler(currentUser, clinicSettings, runAutoLtfu);
  usePageAccessGuard(currentUser, activePage, navigateTo);

  if (isLoading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#132b31',
        }}
      >
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div
            style={{
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontSize: 24,
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            RemoteCare
          </div>
          <div style={{ fontSize: 12, opacity: 0.5 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) return <AuthPage />;

  const role = currentUser.role;
  const isAdmin = role === 'admin';
  const pageBg = role === 'doctor' ? '#f8fafc' : '#f0f2f5';

  if (isAdmin) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #e8ecf3 0%, #eef0f5 40%, #e4e9f2 100%)',
          backgroundImage:
            'linear-gradient(135deg, #e8ecf3 0%, #eef0f5 40%, #e4e9f2 100%), url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23b8c4d4\' fill-opacity=\'0.08\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'1.5\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      >
        <Sidebar />
        <div
          id="admin-main"
          style={{
            flex: 1,
            minWidth: 0,
            marginLeft: '220px',
            transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <Suspense fallback={<PageFallback />}>
            <AdminPage />
          </Suspense>
        </div>
        <VisitModal />
        <MedModal />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: pageBg }}>
      <Topbar />
      <SyncBar />
      <NavTabs />

      <main className="min-h-[calc(100vh-94px)]">
        <Suspense fallback={<PageFallback />}>
          {role === 'doctor' ? (
            <>
              {activePage === 'patients' ? <PatientsPage /> : null}
              {activePage === 'ltfu' ? <LTFUPage /> : null}
              {activePage === 'clinic' ? <ClinicPage /> : null}
              {activePage === 'reports' ? <ReportsPage /> : null}
            </>
          ) : (
            <AdminPage />
          )}
        </Suspense>
      </main>

      <VisitModal />
      <MedModal />
    </div>
  );
}
