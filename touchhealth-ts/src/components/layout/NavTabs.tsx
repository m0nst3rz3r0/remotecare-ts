import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore }   from '../../store/useUIStore';
import { usePatientStore, selectTopbarCounts } from '../../store/usePatientStore';
import { Activity, ClipboardList, Hospital, Users } from 'lucide-react';

export default function NavTabs() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activePage  = useUIStore((s) => s.activePage);
  const navigateTo  = useUIStore((s) => s.navigateTo);
  const visitModalOpen = useUIStore((s) => s.visitModalOpen);
  const medModalOpen = useUIStore((s) => s.medModalOpen);
  const patients    = usePatientStore((s) => s.patients);
  const counts      = selectTopbarCounts(patients);
  const modalOpen = visitModalOpen || medModalOpen;

  // Admin/SuperAdmin use the sidebar instead
  if (!currentUser || currentUser.role !== 'doctor') return null;

  const tabs = [
    { id: 'patients', label: 'Patients', Icon: Users },
    { id: 'ltfu',     label: 'LTFU',     Icon: ClipboardList, badge: counts.ltfu + counts.due },
    { id: 'clinic',   label: 'Clinic',   Icon: Hospital },
    { id: 'reports',  label: 'Reports',  Icon: Activity },
  ];

  return (
    <nav style={{
      position: 'sticky', top: 52, zIndex: 30,
      height: 48, padding: '0 20px',
      display: 'flex', alignItems: 'stretch', gap: 2,
      background: '#ffffff',
      borderBottom: '1px solid rgba(191,200,205,.25)',
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollbarWidth: 'thin',
      pointerEvents: modalOpen ? 'none' : 'auto',
      opacity: modalOpen ? 0.85 : 1,
    }}>
      {tabs.map((t) => {
        const active = activePage === t.id;
        const Icon = t.Icon;
        return (
          <button
            key={t.id}
            onClick={() => navigateTo(t.id as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              flex: '0 0 auto',
              padding: '0 16px',
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.5px',
              color: active ? '#10b981' : '#94a3b8',
              background: 'transparent',
              border: 'none',
              borderBottom: active ? '2.5px solid #10b981' : '2.5px solid transparent',
              marginBottom: -1,
              cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
            }}
          >
            <Icon size={16} />
            {t.label}
            {'badge' in t && (t as any).badge > 0 && (
              <span style={{
                minWidth: 18, height: 18, padding: '0 5px',
                borderRadius: 9999, fontSize: 9, fontWeight: 800,
                background: '#ef4444', color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {(t as any).badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
