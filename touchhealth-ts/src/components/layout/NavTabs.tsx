import { useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore }   from '../../store/useUIStore';
import { usePatientStore, selectTopbarCounts } from '../../store/usePatientStore';
import { loadUsers }    from '../../services/auth';

export default function NavTabs() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activePage  = useUIStore((s) => s.activePage);
  const navigateTo  = useUIStore((s) => s.navigateTo);
  const patients    = usePatientStore((s) => s.patients);
  const counts      = selectTopbarCounts(patients);
  const doctorCount = useMemo(() => loadUsers().filter((u) => u.role === 'doctor').length, []);

  const tabs = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'doctor') return [
      { id: 'patients', label: 'Patients',  icon: 'group' },
      { id: 'ltfu',     label: 'LTFU',       icon: 'history_toggle_off', badge: counts.ltfu + counts.due },
      { id: 'clinic',   label: 'Clinic',     icon: 'local_hospital' },
      { id: 'reports',  label: 'Reports',    icon: 'analytics' },
    ];
    return [
      { id: 'overview',  label: 'Overview',  icon: 'dashboard' },
      { id: 'trends',    label: 'Trends',    icon: 'trending_up' },
      { id: 'doctors',   label: 'Doctors',   icon: 'stethoscope', badge: doctorCount },
      { id: 'settings',  label: 'Settings',  icon: 'settings' },
    ];
  }, [currentUser, counts.ltfu, counts.due, doctorCount]);

  return (
    <nav style={{
      position: 'sticky', top: 52, zIndex: 190,
      height: 48, padding: '0 16px',
      display: 'flex', alignItems: 'stretch', gap: 2,
      background: '#ffffff',
      borderBottom: '1px solid rgba(191,200,205,.25)',
    }}>
      {tabs.map((t) => {
        const active = activePage === t.id;
        return (
          <button
            key={t.id}
            onClick={() => navigateTo(t.id as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 16px',
              fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.5px',
              color: active ? '#10b981' : '#94a3b8',
              background: 'transparent',
              border: 'none',
              borderBottom: active ? '2.5px solid #10b981' : '2.5px solid transparent',
              marginBottom: -1,
              cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {t.icon}
            </span>
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
