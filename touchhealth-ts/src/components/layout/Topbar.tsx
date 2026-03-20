import { useAuthStore } from '../../store/useAuthStore';
import { usePatientStore, selectTopbarCounts } from '../../store/usePatientStore';
import Button from '../ui/Button';

import { getUserInitials } from '../../services/auth';

export default function Topbar() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const signOut = useAuthStore((s) => s.signOut);

  const patients = usePatientStore((s) => s.patients);
  const counts = selectTopbarCounts(patients);

  if (!currentUser) return null;

  const initials = getUserInitials(currentUser.displayName);

  return (
    <header
      className="h-[52px] px-3 flex items-center gap-3"
      style={{ background: 'linear-gradient(135deg,var(--ink) 0%,var(--ink2) 70%,var(--teal2) 140%)' }}
    >
      <div className="text-white font-extrabold font-syne" style={{ lineHeight: 1 }}>
        Touch Health
      </div>

      <div className="hidden sm:flex items-center gap-2 ml-1">
        {currentUser.role === 'doctor' ? (
          <>
            <div
              className="px-2 py-1 rounded-[var(--r-sm)] text-[10px] uppercase font-bold"
              style={{ background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.92)' }}
            >
              Due: {counts.due}
            </div>
            <div
              className="px-2 py-1 rounded-[var(--r-sm)] text-[10px] uppercase font-bold"
              style={{ background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.92)' }}
            >
              LTFU: {counts.ltfu}
            </div>
            <div
              className="px-2 py-1 rounded-[var(--r-sm)] text-[10px] uppercase font-bold"
              style={{ background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.92)' }}
            >
              Controlled: {counts.controlled}
            </div>
          </>
        ) : (
          <div
            className="px-3 py-1 rounded-[var(--r-sm)] text-[10px] uppercase font-bold"
            style={{ background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.92)' }}
          >
            Admin View
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <div
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-bold text-white"
          style={{ background: 'rgba(255,255,255,.14)' }}
          title={currentUser.displayName}
        >
          {initials}
        </div>
        <div className="hidden md:block">
          <div className="text-white font-bold text-[13px] leading-tight">{currentUser.displayName}</div>
          <div className="text-white/80 text-[10px] uppercase font-bold leading-tight">
            {currentUser.role}
          </div>
        </div>
        <Button size="xs" variant="ghost" label="Sign out" onClick={signOut} />
      </div>
    </header>
  );
}

