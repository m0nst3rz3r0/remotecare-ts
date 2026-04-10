import type { ReactNode } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export default function PageWrapper({
  title,
  children,
}: {
  title?: ReactNode;
  children: ReactNode;
}) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAdmin = currentUser?.role === 'admin';

  if (isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
        {title && (
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            padding: '0 28px',
            height: 60,
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(240, 242, 248, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
          }}>
            <h1 style={{
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: '#1e293b',
              margin: 0,
            }}>
              {title}
            </h1>
          </div>
        )}
        <div style={{ padding: '24px 28px' }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-5">
      {title ? (
        <div className="mb-3">
          <h1 className="font-syne text-[18px] font-semibold text-slate-800">
            {title}
          </h1>
        </div>
      ) : null}
      {children}
    </div>
  );
}
