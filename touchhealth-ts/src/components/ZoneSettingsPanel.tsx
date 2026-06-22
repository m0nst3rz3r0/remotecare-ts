import { useState } from 'react';
import type { TZRegion } from '../lib/clinical/types';

const ZONES: TZRegion[] = [
  'Northern Highlands', 'Lake Zone', 'Coast', 'Zanzibar',
  'Southern Highlands', 'Central', 'Western',
];

const STORAGE_KEY = 'rcro_clinic_zone';

export function getStoredZone(): TZRegion | null {
  try { return (localStorage.getItem(STORAGE_KEY) as TZRegion) || null; } catch { return null; }
}

const INK = '#132b31';
const TEAL = '#10b981';

export default function ZoneSettingsPanel() {
  const [zone, setZone] = useState<TZRegion>(() => getStoredZone() ?? 'Northern Highlands');
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, zone);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ background: '#fff', border: '1.5px solid rgba(191,200,205,.4)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: INK, fontFamily: "'Inter', system-ui", marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Clinic Food Zone
      </div>
      <p style={{ fontSize: '12px', color: '#516169', fontFamily: "'Inter', system-ui", marginBottom: '12px' }}>
        Set the food zone for this clinic. This determines which regional foods appear in meal plans and food safety checks.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {ZONES.map(z => (
          <button key={z} onClick={() => setZone(z)} style={{
            padding: '5px 14px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
            border: `1.5px solid ${z === zone ? TEAL : 'rgba(191,200,205,.55)'}`,
            background: z === zone ? TEAL : '#fff',
            color: z === zone ? '#fff' : INK,
            cursor: 'pointer', fontFamily: "'Inter', system-ui",
          }}>
            {z}
          </button>
        ))}
      </div>
      <button onClick={save} style={{
        background: TEAL, color: '#fff', border: 'none', borderRadius: '6px',
        padding: '7px 20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
        fontFamily: "'Inter', system-ui",
      }}>
        {saved ? 'Saved' : 'Save Zone'}
      </button>
    </div>
  );
}
