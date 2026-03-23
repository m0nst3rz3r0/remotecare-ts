import { useAuthStore } from '../../store/useAuthStore';
import { usePatientStore, selectTopbarCounts } from '../../store/usePatientStore';
import { getUserInitials } from '../../services/auth';

const LOGO =  + logo_uri + ;

export default function Topbar() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const signOut     = useAuthStore((s) => s.signOut);
  const patients    = usePatientStore((s) => s.patients);
  const counts      = selectTopbarCounts(patients);
  if (!currentUser) return null;
  const initials    = getUserInitials(currentUser.displayName);
  const role        = currentUser.role;
  const isSuperAdmin = currentUser.isSuperAdmin === true;

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 200,
      height: '52px', padding: '0 24px',
      display: 'flex', alignItems: 'center', gap: '10px',
      background: 'linear-gradient(90deg, #0f1f26 0%, #005469 100%)',
      boxShadow: '0 2px 20px rgba(0,0,0,.3)',
    }}>
      {/* Logo */}
      <img src={LOGO} alt="RemoteCare" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid rgba(255,255,255,.2)' }} />

      <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-.3px', whiteSpace: 'nowrap' }}>
        RemoteCare
      </span>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'rgba(255,255,255,.4)', paddingLeft: 8, borderLeft: '1px solid rgba(255,255,255,.15)', whiteSpace: 'nowrap' }}>
        Research Organisation
      </span>

      {role === 'doctor' && (
        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
          {[
            { label: 'Total', val: counts.total,      warn: false },
            { label: 'Due',   val: counts.due,        warn: counts.due > 0 },
            { label: 'LTFU',  val: counts.ltfu,       warn: counts.ltfu > 0 },
            { label: 'Ctrl',  val: counts.controlled, warn: false },
          ].map(({ label, val, warn }) => (
            <div key={label} style={{
              padding: '5px 12px',
              background: warn ? 'rgba(220,38,38,.2)' : 'rgba(255,255,255,.12)',
              border: ,
              borderRadius: 9999,
              fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.5px',
              color: warn ? '#fca5a5' : 'rgba(255,255,255,.9)',
              whiteSpace: 'nowrap',
            }}>
              {label} {val}
            </div>
          ))}
        </div>
      )}

      {role === 'admin' && (
        <div style={{ marginLeft: 8 }}>
          <div style={{
            padding: '5px 12px',
            background: 'rgba(255,255,255,.12)',
            border: '1px solid rgba(255,255,255,.15)',
            borderRadius: 9999,
            fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.5px',
            color: 'rgba(255,255,255,.9)',
            whiteSpace: 'nowrap',
          }}>
            {isSuperAdmin
              ? '🌐 All Regions'
              : }
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: isSuperAdmin ? 'rgba(220,38,38,.3)' : role === 'admin' ? 'rgba(13,110,135,.3)' : 'rgba(22,163,74,.3)',
          border: '2px solid rgba(255,255,255,.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 11, color: '#fff',
        }}>
          {initials}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: '#fff', lineHeight: 1.2 }}>
            {currentUser.displayName}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px',
            padding: '2px 8px', borderRadius: 9999, marginTop: 2, display: 'inline-block',
            background: isSuperAdmin ? 'rgba(220,38,38,.25)' : role === 'admin' ? 'rgba(13,110,135,.25)' : 'rgba(22,163,74,.25)',
            color: isSuperAdmin ? '#fca5a5' : role === 'admin' ? '#7dd3fc' : '#86efac',
          }}>
            {isSuperAdmin ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Doctor'}
          </span>
        </div>
        <button
          onClick={signOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px',
            background: 'transparent',
            color: 'rgba(255,255,255,.7)',
            border: '1.5px solid rgba(255,255,255,.25)',
            borderRadius: 9999,
            fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.5px',
            cursor: 'pointer', transition: 'all .15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,.12)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255,255,255,.7)';
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>logout</span>
          Sign out
        </button>
      </div>
    </header>
  );
}
