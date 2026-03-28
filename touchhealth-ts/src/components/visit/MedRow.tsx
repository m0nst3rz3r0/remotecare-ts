// ════════════════════════════════════════════════════════════
// REMOTECARE · src/components/visit/MedRow.tsx
// Medication row — free-text autocomplete + diagnosis-aware
// drug suggestions. Groups expand based on comorbidities.
// ════════════════════════════════════════════════════════════

import { useRef, useState, useMemo } from 'react';
import type { Medication } from '../../types';
import {
  HTN_MEDS, DM_MEDS, COMORBIDITY_MEDS, ALL_MEDS,
} from '../../services/clinical';

// ── Frequency options ────────────────────────────────────────
const FREQ_OPTIONS = [
  'Once daily (OD)',
  'Twice daily (BD)',
  'Three times daily (TDS)',
  'Four times daily (QDS)',
  'Every 8 hours',
  'Every 12 hours',
  'At night (nocte)',
  'In the morning',
  'Before meals',
  'With meals',
  'After meals',
  'Weekly',
  'As needed (PRN)',
  'Stat (single dose)',
];

// ── Group labels for the suggestion panel ───────────────────
const CORE_GROUPS = [
  { label: 'HTN Medications', meds: HTN_MEDS },
  { label: 'DM Medications',  meds: DM_MEDS  },
];

// ── Styles ──────────────────────────────────────────────────
const INK   = '#0f1f26';
const SLATE = '#516169';
const fieldStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid rgba(191,200,205,.55)',
  borderRadius: '4px',
  padding: '7px 10px',
  fontSize: '13px',
  fontFamily: 'Karla, sans-serif',
  color: INK,
  background: '#fff',
  outline: 'none',
};

// ────────────────────────────────────────────────────────────

export default function MedRow({
  med,
  onChange,
  onRemove,
  diagnosisCodes = [],
}: {
  med: Medication;
  onChange: (next: Medication) => void;
  onRemove: () => void;
  diagnosisCodes?: string[];
}) {
  const [query, setQuery] = useState(med.name ?? '');
  const [open,  setOpen]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestionGroups = useMemo(() => {
    const groups = [...CORE_GROUPS];
    const seen   = new Set<string>();
    for (const code of diagnosisCodes) {
      const prefix = code.slice(0, 3);
      if (!seen.has(prefix) && COMORBIDITY_MEDS[prefix]) {
        seen.add(prefix);
        groups.push(COMORBIDITY_MEDS[prefix]);
      }
    }
    return groups;
  }, [diagnosisCodes]);

  const autocompleteResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return ALL_MEDS.filter((m) => m.toLowerCase().includes(q)).slice(0, 12);
  }, [query]);

  const selectMed = (name: string) => {
    setQuery(name);
    onChange({ ...med, name });
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div style={{
      background: '#fafaf8',
      border: '1px solid rgba(191,200,205,.35)',
      borderRadius: '8px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>

      {/* Row 1: Name + Frequency + Remove */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'end' }}>

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: SLATE, marginBottom: '4px' }}>Drug Name</div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Type drug name…"
            style={fieldStyle}
            autoComplete="off"
            onChange={(e) => { setQuery(e.target.value); onChange({ ...med, name: e.target.value }); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && autocompleteResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid rgba(13,110,135,.25)', borderRadius: '4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 16px rgba(15,31,38,.1)' }}>
              {autocompleteResults.map((m) => (
                <div key={m} onMouseDown={() => selectMed(m)}
                  style={{ padding: '7px 12px', fontSize: '12px', fontFamily: 'Karla, sans-serif', cursor: 'pointer', color: INK, borderBottom: '1px solid rgba(191,200,205,.2)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7fa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >{m}</div>
              ))}
              {query.trim() && !ALL_MEDS.find((m) => m.toLowerCase() === query.trim().toLowerCase()) && (
                <div onMouseDown={() => selectMed(query.trim())}
                  style={{ padding: '7px 12px', fontSize: '12px', fontFamily: 'Karla, sans-serif', cursor: 'pointer', color: '#005469', fontWeight: 700, background: 'rgba(13,110,135,.04)', borderTop: '1px solid rgba(13,110,135,.1)' }}
                >Use: "{query.trim()}"</div>
              )}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: SLATE, marginBottom: '4px' }}>Frequency</div>
          <select value={med.freq ?? ''} onChange={(e) => onChange({ ...med, freq: e.target.value })} style={fieldStyle}>
            <option value="">— Select —</option>
            {FREQ_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <button type="button" onClick={onRemove}
          style={{ padding: '7px 12px', borderRadius: '4px', border: '1.5px solid rgba(186,26,26,.3)', color: '#ba1a1a', background: 'rgba(186,26,26,.05)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '12px', cursor: 'pointer', alignSelf: 'flex-end' }}
        >✕</button>
      </div>

      {/* Row 2: Quick-pick chips grouped by drug category */}
      <div>
        <div style={{ fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: SLATE, marginBottom: '6px' }}>
          Quick Pick
          {diagnosisCodes.length > 0 && (
            <span style={{ marginLeft: '6px', fontSize: '9px', fontWeight: 600, color: '#005469', background: 'rgba(13,110,135,.08)', padding: '1px 6px', borderRadius: '9999px' }}>
              + comorbidity drugs shown
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {suggestionGroups.map((group) => (
            <div key={group.label}>
              <div style={{ fontSize: '9px', fontFamily: 'Syne, sans-serif', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', color: '#0d6e87', marginBottom: '4px' }}>{group.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {group.meds.map((m) => (
                  <button key={m} type="button" onClick={() => selectMed(m)}
                    style={{ padding: '3px 9px', borderRadius: '9999px', border: med.name === m ? '1.5px solid #005469' : '1.5px solid rgba(191,200,205,.5)', background: med.name === m ? '#005469' : '#fff', color: med.name === m ? '#fff' : INK, fontSize: '11px', fontFamily: 'Karla, sans-serif', cursor: 'pointer', fontWeight: med.name === m ? 700 : 400 }}
                  >{m}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 3: Notes */}
      <div>
        <div style={{ fontSize: '10px', fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: SLATE, marginBottom: '4px' }}>Notes / Instructions (optional)</div>
        <input type="text" value={med.dose ?? ''} onChange={(e) => onChange({ ...med, dose: e.target.value })} placeholder="e.g. take with food, titrate up, new prescription…" style={{ ...fieldStyle, fontSize: '12px' }} />
      </div>
    </div>
  );
}
