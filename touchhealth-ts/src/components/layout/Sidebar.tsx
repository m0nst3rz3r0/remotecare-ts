// ════════════════════════════════════════════════════════════
// REMOTECARE · src/components/layout/Sidebar.tsx
// Dark charcoal sidebar — Admin & SuperAdmin only
// ════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutDashboard, LogOut, TrendingUp, UserCog, Users } from 'lucide-react';
import { useAuthStore }    from '../../store/useAuthStore';
import { useUIStore }      from '../../store/useUIStore';
import { loadUsers }       from '../../services/auth';
import { LOGO }            from './Topbar';
import { getUserInitials } from '../../services/auth';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  badge?: number;
  section: string;
}

// ── Design tokens ─────────────────────────────────────────
const BG        = '#132b31';           // charcoal
const BG_HOVER  = 'rgba(255,255,255,0.07)';
const BORDER    = 'rgba(255,255,255,0.09)';
const TEXT_PRI  = '#fff';
const TEXT_SEC  = 'rgba(255,255,255,0.55)';
const TEXT_MUTE = 'rgba(255,255,255,0.35)';

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

  const directoryCount = useMemo(
    () => loadUsers().filter((u) => !u.isSuperAdmin).length,
    [],
  );

  if (!currentUser || currentUser.role === 'doctor') return null;

  const isSuperAdmin = currentUser.isSuperAdmin === true;
  const initials     = getUserInitials(currentUser.displayName);

  // Superadmin gets red accent; admin gets emerald
  const accent       = isSuperAdmin ? '#ef4444' : '#10b981';
  const accentBg     = isSuperAdmin ? 'rgba(239,68,68,0.15)'  : 'rgba(16,185,129,0.15)';
  const accentBorder = isSuperAdmin ? 'rgba(239,68,68,0.30)'  : 'rgba(16,185,129,0.30)';

  const sidebarW = collapsed ? '64px' : '220px';
  const TEXT = { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" } as const;

  const navItems: NavItem[] = [
    { id: 'overview',        label: 'Overview',        icon: LayoutDashboard, section: 'MAIN' },
    { id: 'trends',          label: 'Trends',          icon: TrendingUp,      section: 'MAIN' },
    { id: 'directory',       label: 'Directory',       icon: Users,           badge: directoryCount, section: 'MAIN' },
    { id: 'user-management', label: 'User Management', icon: UserCog,         section: 'SYSTEM' },
  ];

  return (
    <aside style={{
      position:      'fixed',
      top: 0, left: 0,
      height:        '100vh',
      width:         sidebarW,
      zIndex:        300,
      display:       'flex',
      flexDirection: 'column',
      background:    BG,
      borderRight:   `1px solid ${BORDER}`,
      boxShadow:     '4px 0 20px rgba(0,0,0,0.18)',
      transition:    'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow:      'hidden',
    }}>

      {/* ── Logo bar ─────────────────────────────────────── */}
      <div style={{
        height: 64, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: collapsed ? '0 16px' : '0 16px',
        gap: 10,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <img
          src={LOGO}
          alt="RemoteCare"
          style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0, borderRadius: 6 }}
        />

        {!collapsed && (
          <span style={{ ...TEXT, fontWeight: 800, fontSize: 14, color: TEXT_PRI, letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
            RemoteCare
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={handleToggle}
          title={collapsed ? 'Expand' : 'Collapse'}
          style={{
            width: 26, height: 26, flexShrink: 0,
            borderRadius: 6, cursor: 'pointer',
            background: 'rgba(255,255,255,0.08)',
            border: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
        >
          {collapsed ? <ChevronRight size={15} color={TEXT_SEC} /> : <ChevronLeft size={15} color={TEXT_SEC} />}
        </button>
      </div>

      {/* ── User badge ───────────────────────────────────── */}
      {!collapsed && (
        <div style={{
          margin: '12px 10px 4px',
          padding: '10px 12px',
          borderRadius: 8,
          background: accentBg,
          border: `1px solid ${accentBorder}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...TEXT, fontWeight: 800, fontSize: 11, color: '#fff',
            }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ ...TEXT, fontWeight: 600, fontSize: 12, color: TEXT_PRI, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
            ...TEXT, fontWeight: 800, fontSize: 12, color: '#fff',
          }}>
            {initials}
          </div>
        </div>
      )}

      {/* ── Nav ──────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '6px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
        {(['MAIN', 'SYSTEM'] as const).map((section) => {
          const items = navItems.filter((n) => n.section === section);
          if (!items.length) return null;
          return (
            <div key={section} style={{ marginBottom: 4 }}>
              {!collapsed && (
                <div style={{ ...TEXT, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEXT_MUTE, padding: '8px 8px 4px' }}>
                  {section}
                </div>
              )}
              {items.map((item) => {
                const active = activePage === item.id;
                const Icon = item.icon;
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
                      borderRadius: 8,
                      background: active ? accentBg : 'transparent',
                      border: `1px solid ${active ? accentBorder : 'transparent'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      marginBottom: 2,
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = BG_HOVER; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {active && (
                      <div style={{
                        position: 'absolute', left: 0, top: '20%', bottom: '20%',
                        width: 3, borderRadius: '0 3px 3px 0',
                        background: accent,
                      }} />
                    )}
                    <Icon size={18} color={active ? accent : TEXT_SEC} style={{ flexShrink: 0 }} />
                    {!collapsed && (
                      <span style={{ ...TEXT, fontSize: 13, fontWeight: active ? 700 : 400, color: active ? TEXT_PRI : TEXT_SEC, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
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

      {/* ── Sign out ─────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 8px', flexShrink: 0 }}>
        <button
          onClick={signOut}
          title={collapsed ? 'Sign out' : undefined}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '9px 0' : '9px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid transparent',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={18} color={TEXT_MUTE} style={{ flexShrink: 0 }} />
          {!collapsed && (
            <span style={{ ...TEXT, fontSize: 13, fontWeight: 400, color: TEXT_MUTE, whiteSpace: 'nowrap' }}>
              Sign out
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
