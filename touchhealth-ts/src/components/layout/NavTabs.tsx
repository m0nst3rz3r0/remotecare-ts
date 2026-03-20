import { useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { usePatientStore, selectTopbarCounts } from '../../store/usePatientStore';
import { loadUsers } from '../../services/auth';

export default function NavTabs() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activePage = useUIStore((s) => s.activePage);
  const navigateTo = useUIStore((s) => s.navigateTo);

  const patients = usePatientStore((s) => s.patients);
  const counts = selectTopbarCounts(patients);

  const doctorCount = useMemo(() => loadUsers().filter((u) => u.role === 'doctor').length, []);

  const tabs = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role === 'doctor') {
      return [
        { id: 'patients', label: 'Patients' },
        { id: 'ltfu', label: 'LTFU', badge: counts.ltfu },
        { id: 'clinic', label: 'Clinic' },
        { id: 'reports', label: 'Reports' },
      ] as const;
    }

    return [
      { id: 'overview', label: 'Overview' },
      { id: 'trends', label: 'Trends' },
      { id: 'doctors', label: 'Doctors', badge: doctorCount },
      { id: 'settings', label: 'Settings' },
    ] as const;
  }, [currentUser, counts.ltfu, doctorCount]);

  return (
    <nav className="h-[42px] px-2 flex items-center gap-2 overflow-x-auto border-b border-[var(--border)] bg-[var(--cream)]">
      {tabs.map((t) => {
        const isActive = activePage === t.id;
        return (
          <button
            key={t.id}
            onClick={() => navigateTo(t.id)}
            className="relative whitespace-nowrap px-3 py-2 rounded-[var(--r-sm)] text-[12px] font-bold uppercase tracking-[0.5px]"
            style={{
              color: isActive ? 'var(--teal)' : 'var(--ink)',
              background: isActive ? 'var(--teal-ultra)' : 'transparent',
              border: `1.5px solid ${isActive ? 'var(--teal)' : 'transparent'}`,
            }}
          >
            {t.label}
            {'badge' in t && typeof (t as any).badge === 'number' && (t as any).badge > 0 ? (
              <span
                className="ml-2 inline-flex items-center justify-center px-2 py-[1px] rounded-full text-[10px] font-extrabold"
                style={{ background: 'var(--teal-pale)', color: 'var(--teal)' }}
              >
                {(t as any).badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

