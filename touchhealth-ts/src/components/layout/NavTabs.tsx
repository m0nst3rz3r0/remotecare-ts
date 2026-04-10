import { useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore }   from '../../store/useUIStore';
import { usePatientStore, selectTopbarCounts } from '../../store/usePatientStore';
import { loadUsers }    from '../../services/auth';

export default function NavTabs() {
  const currentUser = useAuthStore((s) => s.currentUser);

  // Admin/SuperAdmin use the sidebar instead
  if (currentUser?.role === 'admin') return null;

  const activePage  = useUIStore((s) => s.activePage);
  const navigateTo  = useUIStore((s) => s.navigateTo);
  const patients    = usePatientStore((s) => s.patients);
  const counts      = selectTopbarCounts(patients);
  const doctorCount = useMemo(() => loadUsers().filter((u) => u.role === 'doctor').length, []);

  const isAdmin = currentUser?.role === 'admin';

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

  // Admin/SuperAdmin: light grey nav; Doctors: white nav
  const navBg         = isAdmin ? '#e8eaed' : '#ffffff';
  const navBorder     = isAdmin ? '1px solid #d1d5db' : '1px solid rgba(191,200,205,.25)';
  const activeColor   = isAdmin ? '#1a56db' : '#10b981';
  const inactiveColor = isAdmin ? '#6b7280' : '#94a3b8';

  return (
    <nav style={{
      position: 'sticky', top: 52, zIndex: 190,
      height: 48, padding: '0 20px',
      display: 'flex', alignItems: 'stretch', gap: 2,
      background: navBg,
      borderBottom: navBorder,
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
              color: active ? activeColor : inactiveColor,
              background: active && isAdmin ? 'rgba(26,86,219,.07)' : 'transparent',
              border: 'none',
              borderBottom: active ? `2.5px solid ${activeColor}` : '2.5px solid transparent',
              borderRadius: active && isAdmin ? '4px 4px 0 0' : undefined,
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
                background: isAdmin ? '#1a56db' : '#ef4444', color: '#fff',
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
