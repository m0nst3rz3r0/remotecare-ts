import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import {
  loadUsers,
} from '../services/auth';

export default function AuthPage() {
  const signIn     = useAuthStore((s) => s.signIn);
  const loginError = useAuthStore((s) => s.loginError);
  const clearError = useAuthStore((s) => s.clearError);

  const [username,      setUsername]      = useState('');
  const [password,      setPassword]      = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Detect role from username — doctors no longer pick location at login
  const detectedRole = useMemo(() => {
    if (!username.trim()) return null;
    const users = loadUsers();
    const match = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    return match?.role || null;
  }, [username]);

  useEffect(() => {
    clearError();
  }, [username, clearError]);

  const canSubmit = !!(username.trim() && password.trim());

  const onSubmit = () => {
    if (!canSubmit) return;
    signIn({
      username: username.trim(),
      password,
      // FIXED: Fallback to 'auto' instead of 'admin' for new devices
      role: detectedRole || 'auto',
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          minHeight: '580px',
          borderRadius: '14px',
          boxShadow: '0 32px 80px rgba(15,31,38,.14)',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* ── Left Panel ─────────────────────────────────────── */}
        <div
          style={{
            width: '380px',
            background: '#f4f7f7',
            borderRight: '1px solid rgba(191,200,205,.2)',
            padding: '48px 40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <div className="flex items-center gap-4 mb-8">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: '#132b31' }}
              >
                <img src="data:image/png;base64,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" alt="RemoteCare" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div className="font-sans text-2xl font-extrabold" style={{ color: '#005469' }}>
                RemoteCare
              </div>
            </div>

            <h1 className="font-sans text-3xl font-extrabold mb-4" style={{ color: '#005469' }}>
              RemoteCare Research Organisation
            </h1>
            <p className="text-lg mb-6" style={{ color: '#2a4a58', lineHeight: 1.6 }}>
              Advanced Sentinel System for Non-Communicable Disease Management.
            </p>
          </div>

          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border"
            style={{ borderColor: 'rgba(16,185,129,.2)', background: 'rgba(16,185,129,.05)' }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }} />
            <span className="font-mono text-sm font-semibold" style={{ color: '#132b31' }}>
              Encrypted Clinical Node · Active
            </span>
          </div>
        </div>

        {/* ── Right Panel ────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            padding: '48px 52px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Header */}
          <div className="mb-8">
            <div
              className="font-mono text-xs font-bold mb-2"
              style={{ color: '#516169', letterSpacing: '1px', textTransform: 'uppercase' }}
            >
              Secure Access Portal
            </div>
            <h2 className="font-sans text-2xl font-extrabold mb-2" style={{ color: '#005469' }}>
              Portal Access
            </h2>
            <p className="text-sm" style={{ color: '#516169', lineHeight: 1.5 }}>
              Enter your authorized credentials to access the sentinel dashboard.
            </p>
          </div>

          {/* Error */}
          {loginError && (
            <div
              className="mb-6 rounded-lg border px-4 py-3"
              style={{
                background: 'rgba(220,38,38,.1)',
                borderColor: 'rgba(220,38,38,.2)',
                color: '#7f1d1d',
                fontWeight: 700,
                fontSize: '12px',
              }}
            >
              {loginError}
            </div>
          )}

          <div className="space-y-4">
            {/* Staff Identifier */}
            <div>
              <label
                className="block font-sans text-xs font-bold mb-2"
                style={{ color: '#005469', textTransform: 'uppercase', letterSpacing: '0.5px' }}
              >
                Staff Identifier
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute', left: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: '#516169', fontSize: '16px',
                  }}
                >
                  ●
                </div>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  type="text"
                  placeholder="Enter your staff identifier"
                  className="w-full rounded-lg border px-4 py-3 outline-none transition-colors"
                  style={{
                    borderColor: 'rgba(191,200,205,.55)',
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                    fontSize: '14px',
                    paddingLeft: '44px',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0d6e87';
                    e.target.style.boxShadow = '0 0 0 3px rgba(13,110,135,.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(191,200,205,.55)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Security Key */}
            <div>
              <label
                className="block font-sans text-xs font-bold mb-2"
                style={{ color: '#005469', textTransform: 'uppercase', letterSpacing: '0.5px' }}
              >
                Security Key
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute', left: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: '#516169', fontSize: '16px',
                  }}
                >
                  🔒
                </div>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your security key"
                  className="w-full rounded-lg border px-4 py-3 outline-none transition-colors"
                  style={{
                    borderColor: 'rgba(191,200,205,.55)',
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                    fontSize: '14px',
                    paddingLeft: '44px',
                    paddingRight: '44px',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0d6e87';
                    e.target.style.boxShadow = '0 0 0 3px rgba(13,110,135,.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(191,200,205,.55)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: '#64748b' }}
                >
                  <span style={{ fontSize: '16px' }}>{showPassword ? '👁️' : '👁'}</span>
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="w-full rounded-lg py-3 font-sans font-bold text-white transition-all"
              style={{
                background: canSubmit ? '#10b981' : '#cbd5e1',
                fontSize: '14px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '0 4px 12px rgba(16,185,129,.25)' : 'none',
                marginTop: '8px',
              }}
              onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.background = '#059669'; }}
              onMouseLeave={(e) => { if (canSubmit) e.currentTarget.style.background = '#10b981'; }}
            >
              Authenticate Identity →
            </button>
          </div>

          <div className="mt-8 text-center">
            <div className="font-mono text-xs" style={{ color: '#64748b', letterSpacing: '0.5px' }}>
              SECURE TERMINAL © 2025 REMOTECARE PRECISION MEDICINE SUITE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
