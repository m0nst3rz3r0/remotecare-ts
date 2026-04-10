// ════════════════════════════════════════════════════════════
// REMOTECARE · src/components/layout/Sidebar.tsx
// Glassmorphism sidebar — Admin & SuperAdmin only
// Tabs: Overview · Trends · Directory · User Management
// ════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { useAuthStore }    from '../../store/useAuthStore';
import { useUIStore }      from '../../store/useUIStore';
import { loadUsers }       from '../../services/auth';
import { getUserInitials } from '../../services/auth';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  section: string;
}

export default function Sidebar() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const signOut     = useAuthStore((s) => s.signOut);
  const activePage  = useUIStore((s) => s.activePage);
  const navigateTo  = useUIStore((s) => s.navigateTo);
  const [collapsed, setCollapsed] = useState(false);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    const main = document.getElementById('admin-main');
    if (main) main.style.marginLeft = next ? '64px' : '220px';
  };

  // Badge: total registered users (doctors + admins) for directory
  const directoryCount = useMemo(
    () => loadUsers().filter((u) => !u.isSuperAdmin).length,
    [],
  );

  if (!currentUser || currentUser.role === 'doctor') return null;

  const isSuperAdmin = currentUser.isSuperAdmin === true;
  const initials     = getUserInitials(currentUser.displayName);

  const navItems: NavItem[] = [
    { id: 'overview',        label: 'Overview',        icon: 'dashboard',       section: 'MAIN' },
    { id: 'trends',          label: 'Trends',          icon: 'trending_up',     section: 'MAIN' },
    { id: 'directory',       label: 'Directory',       icon: 'people',          badge: directoryCount, section: 'MAIN' },
    { id: 'user-management', label: 'User Management', icon: 'manage_accounts', section: 'SYSTEM' },
  ];

  const accent       = isSuperAdmin ? '#ef4444' : '#1a56db';
  const accentLight  = isSuperAdmin ? 'rgba(239,68,68,0.12)'  : 'rgba(26,86,219,0.12)';
  const accentBorder = isSuperAdmin ? 'rgba(239,68,68,0.28)'  : 'rgba(26,86,219,0.28)';
  const sidebarW     = collapsed ? '64px' : '220px';

  const TEXT = {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  } as const;

  return (
    <aside style={{
      position:           'fixed',
      top: 0, left: 0,
      height:             '100vh',
      width:              sidebarW,
      zIndex:             300,
      display:            'flex',
      flexDirection:      'column',
      background:         'rgba(240,242,248,0.85)',
      backdropFilter:     'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRight:        '1px solid rgba(255,255,255,0.62)',
      boxShadow:          '4px 0 24px rgba(0,0,0,0.06), inset -1px 0 0 rgba(255,255,255,0.5)',
      transition:         'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow:           'hidden',
    }}>

      {/* ── Logo bar ───────────────────────────────────── */}
      <div style={{
        height: 64, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: collapsed ? '0 16px' : '0 18px',
        gap: 10,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg,#132b31 0%,#1a4a55 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(19,43,49,0.28)',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#6ee7b7' }}>favorite</span>
        </div>

        {!collapsed && (
          <span style={{ ...TEXT, fontWeight: 700, fontSize: 15, color: '#132b31', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
            RemoteCare
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={handleToggle}
          title={collapsed ? 'Expand' : 'Collapse'}
          style={{
            width: 26, height: 26, flexShrink: 0,
            borderRadius: 7, cursor: 'pointer',
            background: 'rgba(0,0,0,0.05)',
            border: '1px solid rgba(0,0,0,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#64748b' }}>
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>

      {/* ── User badge ─────────────────────────────────── */}
      {!collapsed && (
        <div style={{
          margin: '12px 10px 4px',
          padding: '10px 12px',
          borderRadius: 10,
          background: accentLight,
          border: `1px solid ${accentBorder}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...TEXT, fontWeight: 700, fontSize: 11, color: '#fff',
            }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ ...TEXT, fontWeight: 600, fontSize: 12, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser.displayName}
              </div>
              <div style={{ ...TEXT, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: accent, marginTop: 1 }}>
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </div>
            </div>
          </div>
        </div>
      )}

      {collapsed && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...TEXT, fontWeight: 700, fontSize: 12, color: '#fff',
          }}>
            {initials}
          </div>
        </div>
      )}

      {/* ── Nav ────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '6px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
        {(['MAIN', 'SYSTEM'] as const).map((section) => {
          const items = navItems.filter((n) => n.section === section);
          if (!items.length) return null;
          return (
            <div key={section} style={{ marginBottom: 4 }}>
              {!collapsed && (
                <div style={{ ...TEXT, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', padding: '8px 8px 4px' }}>
                  {section}
                </div>
              )}
              {items.map((item) => {
                const active = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id as any)}
                    title={collapsed ? item.label : undefined}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center',
                      gap: 10,
                      padding: collapsed ? '9px 0' : '9px 10px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      borderRadius: 9,
                      background: active ? accentLight : 'transparent',
                      border: `1px solid ${active ? accentBorder : 'transparent'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      marginBottom: 2,
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {active && (
                      <div style={{
                        position: 'absolute', left: 0, top: '20%', bottom: '20%',
                        width: 3, borderRadius: '0 3px 3px 0',
                        background: accent,
                      }} />
                    )}
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: active ? accent : '#64748b', flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span style={{ ...TEXT, fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#1e293b' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {item.label}
                      </span>
                    )}
                    {!collapsed && item.badge !== undefined && item.badge > 0 && (
                      <span style={{
                        minWidth: 18, height: 18, padding: '0 5px',
                        borderRadius: 9999, fontSize: 9, fontWeight: 700,
                        background: accent, color: '#fff',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Sign out ───────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '10px 8px', flexShrink: 0 }}>
        <button
          onClick={signOut}
          title={collapsed ? 'Sign out' : undefined}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '9px 0' : '9px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 9,
            background: 'transparent',
            border: '1px solid transparent',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8', flexShrink: 0 }}>logout</span>
          {!collapsed && (
            <span style={{ ...TEXT, fontSize: 13, fontWeight: 400, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              Sign out
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
