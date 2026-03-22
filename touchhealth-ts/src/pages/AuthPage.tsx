import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import {
  getHospitalsByRegionDistrict,
  loadUsers,
  clearAndReseed,
} from '../services/auth';

export default function AuthPage() {
  const signIn = useAuthStore((s) => s.signIn);
  const loginError = useAuthStore((s) => s.loginError);
  const clearError = useAuthStore((s) => s.clearError);

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [hospital, setHospital] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Detect role from username
  const detectedRole = useMemo(() => {
    if (!username.trim()) return null;
    const users = loadUsers();
    const matchedUser = users.find(u => 
      u.username.toLowerCase() === username.toLowerCase()
    );
    return matchedUser?.role || null;
  }, [username]);

  // Reset dependent fields when username changes
  useEffect(() => {
    clearError();
    if (!username.trim()) {
      setRegion('');
      setDistrict('');
      setHospital('');
    }
  }, [username, clearError]);

  const hospitalOptions = useMemo(() => {
    if (!region || !district) return [];
    return getHospitalsByRegionDistrict(region, district);
  }, [region, district]);

  const canSubmit = !!(username.trim() && 
                        password.trim() && 
                        (detectedRole === 'admin' || (detectedRole === 'doctor' && region && district && hospital)));

  // Debug logging
  console.log('Auth Debug:', {
    username: username.trim(),
    password: password.trim(),
    detectedRole,
    region,
    district,
    hospital,
    canSubmit
  });

  const onSubmit = () => {
    console.log('submitting', username.trim());
    alert('Button clicked! Username: ' + username.trim());
    
    const res = signIn({
      username: username.trim(),
      password,
      role: detectedRole || 'admin',
      ...(detectedRole === 'doctor' && { region, district, hospital }),
    });
    
    console.log('Login result:', res);
    void res;
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f4f7f7 0%, #e8eef0 100%)' }}>
      <div 
        className="overflow-hidden" 
        style={{ 
          width: '100%', 
          maxWidth: '920px', 
          minHeight: '640px',
          borderRadius: '14px',
          boxShadow: '0 32px 80px rgba(15,31,38,.14)',
          display: 'flex',
          flexDirection: 'row'
        }}
      >
        {/* Left Panel - Fixed width 380px */}
        <div 
          style={{ 
            width: '380px',
            background: '#f4f7f7',
            borderRight: '1px solid rgba(191,200,205,.2)',
            padding: '48px 40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          {/* Top Section */}
          <div>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#005469' }}>
                <span className="text-white" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  RC
                </span>
              </div>
              <div>
                <div className="font-syne text-2xl font-extrabold" style={{ color: '#005469' }}>
                  RemoteCare
                </div>
              </div>
            </div>
            
            <h1 className="font-syne text-3xl font-extrabold mb-4" style={{ color: '#005469' }}>
              RemoteCare Research Organisation
            </h1>
            
            <p className="text-lg mb-6" style={{ color: '#2a4a58', lineHeight: 1.6 }}>
              Advanced Sentinel System for Non-Communicable Disease Management.
            </p>
          </div>

          {/* Bottom Section */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border" style={{ borderColor: 'rgba(13,110,135,.2)', background: 'rgba(13,110,135,.05)' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }}></div>
              <span className="font-mono text-sm font-bold" style={{ color: '#005469' }}>
                Encrypted Clinical Node · Active
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel - Flex: 1 */}
        <div 
          style={{ 
            flex: 1,
            background: '#ffffff',
            padding: '48px 52px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          {/* Header */}
          <div className="mb-8">
            <div className="font-mono text-xs font-bold mb-2" style={{ color: '#516169', letterSpacing: '1px', textTransform: 'uppercase' }}>
              SECURE ACCESS PORTAL
            </div>
            <h2 className="font-syne text-2xl font-extrabold mb-2" style={{ color: '#005469' }}>
              Portal Access
            </h2>
            <p className="text-sm" style={{ color: '#516169', lineHeight: 1.5 }}>
              Enter your authorized credentials to access the sentinel dashboard.
            </p>
          </div>

          {/* Error Message */}
          {loginError && (
            <div 
              className="mb-6 rounded-lg border px-4 py-3" 
              style={{ 
                background: 'rgba(220,38,38,.1)', 
                borderColor: 'rgba(220,38,38,.2)', 
                color: '#7f1d1d',
                fontWeight: 700,
                fontSize: '12px'
              }}
            >
              {loginError}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Staff Identifier */}
            <div>
              <label className="block font-syne text-xs font-bold mb-2" style={{ color: '#005469', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Staff Identifier
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: '#516169',
                  fontSize: '16px'
                }}>
                  ●
                </div>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  type="text"
                  placeholder="Enter your staff identifier"
                  className="w-full rounded-lg border px-4 py-3 outline-none transition-colors"
                  style={{ 
                    borderColor: 'rgba(191,200,205,.55)', 
                    fontFamily: 'Karla, sans-serif',
                    fontSize: '14px',
                    paddingLeft: '44px'
                  }}
                  onFocus={(e) => {
                    const target = e.target as HTMLInputElement;
                    target.style.borderColor = '#0d6e87';
                    target.style.boxShadow = '0 0 0 3px rgba(13,110,135,.1)';
                  }}
                  onBlur={(e) => {
                    const target = e.target as HTMLInputElement;
                    target.style.borderColor = 'rgba(191,200,205,.55)';
                    target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Security Key */}
            <div>
              <label className="block font-syne text-xs font-bold mb-2" style={{ color: '#005469', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Security Key
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: '#516169',
                  fontSize: '16px'
                }}>
                  🔒
                </div>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your security key"
                  className="w-full rounded-lg border px-4 py-3 outline-none transition-colors"
                  style={{ 
                    borderColor: 'rgba(191,200,205,.55)', 
                    fontFamily: 'Karla, sans-serif',
                    fontSize: '14px',
                    paddingLeft: '44px',
                    paddingRight: '44px'
                  }}
                  onFocus={(e) => {
                    const target = e.target as HTMLInputElement;
                    target.style.borderColor = '#0d6e87';
                    target.style.boxShadow = '0 0 0 3px rgba(13,110,135,.1)';
                  }}
                  onBlur={(e) => {
                    const target = e.target as HTMLInputElement;
                    target.style.borderColor = 'rgba(191,200,205,.55)';
                    target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: '#516169' }}
                >
                  <span style={{ fontSize: '16px' }}>
                    {showPassword ? '👁️' : '👁'}
                  </span>
                </button>
              </div>
            </div>

            {/* Hospital Selector (only for doctors) */}
            {detectedRole === 'doctor' && (
              <div className="space-y-3">
                <div>
                  <label className="block font-syne text-xs font-bold mb-2" style={{ color: '#005469', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Region
                  </label>
                  <select
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value);
                      setDistrict('');
                      setHospital('');
                    }}
                    className="w-full rounded-lg border px-4 py-3 outline-none transition-colors"
                    style={{ 
                      borderColor: 'rgba(191,200,205,.55)', 
                      fontFamily: 'Karla, sans-serif',
                      fontSize: '14px'
                    }}
                    onFocus={(e) => {
                    const target = e.target as HTMLSelectElement;
                    target.style.borderColor = '#0d6e87';
                    target.style.boxShadow = '0 0 0 3px rgba(13,110,135,.1)';
                  }}
                  onBlur={(e) => {
                    const target = e.target as HTMLSelectElement;
                    target.style.borderColor = 'rgba(191,200,205,.55)';
                    target.style.boxShadow = 'none';
                  }}
                  >
                    <option value="">Select Region</option>
                    <option value="Kagera">Kagera</option>
                    <option value="Arusha">Arusha</option>
                    <option value="Dar es Salaam">Dar es Salaam</option>
                  </select>
                </div>
                
                <div>
                  <label className="block font-syne text-xs font-bold mb-2" style={{ color: '#005469', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    District
                  </label>
                  <select
                    value={district}
                    onChange={(e) => {
                      setDistrict(e.target.value);
                      setHospital('');
                    }}
                    disabled={!region}
                    className="w-full rounded-lg border px-4 py-3 outline-none transition-colors"
                    style={{ 
                      borderColor: 'rgba(191,200,205,.55)', 
                      fontFamily: 'Karla, sans-serif',
                      fontSize: '14px'
                    }}
                    onFocus={(e) => {
                    const target = e.target as HTMLSelectElement;
                    target.style.borderColor = '#0d6e87';
                    target.style.boxShadow = '0 0 0 3px rgba(13,110,135,.1)';
                  }}
                  onBlur={(e) => {
                    const target = e.target as HTMLSelectElement;
                    target.style.borderColor = 'rgba(191,200,205,.55)';
                    target.style.boxShadow = 'none';
                  }}
                  >
                    <option value="">Select District</option>
                    {region === 'Kagera' && (
                      <>
                        <option value="Bukoba Municipal">Bukoba Municipal</option>
                        <option value="Muleba">Muleba</option>
                        <option value="Karagwe">Karagwe</option>
                      </>
                    )}
                    {region === 'Arusha' && (
                      <>
                        <option value="Arusha Urban">Arusha Urban</option>
                        <option value="Meru">Meru</option>
                      </>
                    )}
                    {region === 'Dar es Salaam' && (
                      <>
                        <option value="Ilala">Ilala</option>
                        <option value="Kinondoni">Kinondoni</option>
                        <option value="Temeke">Temeke</option>
                      </>
                    )}
                  </select>
                </div>
                
                <div>
                  <label className="block font-syne text-xs font-bold mb-2" style={{ color: '#005469', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Hospital Facility
                  </label>
                  <select
                    value={hospital}
                    onChange={(e) => setHospital(e.target.value)}
                    disabled={!region || !district}
                    className="w-full rounded-lg border px-4 py-3 outline-none transition-colors"
                    style={{ 
                      borderColor: 'rgba(191,200,205,.55)', 
                      fontFamily: 'Karla, sans-serif',
                      fontSize: '14px'
                    }}
                    onFocus={(e) => {
                    const target = e.target as HTMLSelectElement;
                    target.style.borderColor = '#0d6e87';
                    target.style.boxShadow = '0 0 0 3px rgba(13,110,135,.1)';
                  }}
                  onBlur={(e) => {
                    const target = e.target as HTMLSelectElement;
                    target.style.borderColor = 'rgba(191,200,205,.55)';
                    target.style.boxShadow = 'none';
                  }}
                  >
                    <option value="">Select Hospital</option>
                    {hospitalOptions.map((h) => (
                      <option key={h.id} value={h.name}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Debug Button */}
            <button
              type="button"
              onClick={() => {
                clearAndReseed();
                alert('Data cleared and reseeded! Check console for details.');
              }}
              className="w-full rounded-lg py-2 mb-2 font-syne font-bold text-white transition-all"
              style={{ 
                background: '#dc2626',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: 'pointer'
              }}
            >
              CLEAR & RESEED DATA (Debug)
            </button>

            {/* Test Button */}
            <button
              type="button"
              onClick={() => alert('Test button works!')}
              className="w-full rounded-lg py-2 mb-2 font-syne font-bold text-white transition-all"
              style={{ 
                background: '#dc2626',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: 'pointer'
              }}
            >
              TEST CLICK (Red Button)
            </button>

            {/* Submit Button */}
            <button
              type="button"
              onClick={() => {
                console.log('Button clicked!');
                alert('Main button clicked!');
                onSubmit();
              }}
              className="w-full rounded-lg py-3 font-syne font-bold text-white transition-all"
              style={{ 
                background: '#005469',
                fontSize: '14px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,84,105,.25)'
              }}
              onMouseEnter={(e) => {
                if (canSubmit) {
                  const target = e.target as HTMLButtonElement;
                  target.style.background = '#004252';
                }
              }}
              onMouseLeave={(e) => {
                if (canSubmit) {
                  const target = e.target as HTMLButtonElement;
                  target.style.background = '#005469';
                }
              }}
            >
              Authenticate Identity →
            </button>
          </div>

          {/* Onboarding Hint */}
          <div className="mt-6 p-3 rounded-lg border" style={{ 
            borderColor: 'rgba(13,110,135,.2)', 
            background: 'rgba(13,110,135,.05)' 
          }}>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '16px', color: '#005469' }}>
                💡
              </span>
              <div className="text-xs" style={{ color: '#005469', fontFamily: 'JetBrains Mono, monospace' }}>
                First login: superadmin / super123
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <div className="font-mono text-xs" style={{ color: '#516169', letterSpacing: '0.5px' }}>
              SECURE TERMINAL © 2025 REMOTECARE PRECISION MEDICINE SUITE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
                
