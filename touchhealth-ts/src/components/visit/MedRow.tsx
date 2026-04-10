// ════════════════════════════════════════════════════════════
// REMOTECARE · src/components/visit/MedRow.tsx
// Medication row — free-text autocomplete + diagnosis-aware
// drug suggestions. Each active diagnosis gets its own
// collapsible chip section with relevant medications.
// ════════════════════════════════════════════════════════════

import { useRef, useState, useMemo } from 'react';
import { Pill, Syringe, Pencil, ClipboardList } from 'lucide-react';
import type { Medication } from '../../types';
import {
  HTN_MEDS, DM_MEDS, ALL_MEDS, getMedGroupsForDiagnoses,
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

// ── Core groups always shown ─────────────────────────────────
const CORE_GROUPS = [
  { label: 'HTN Medications', icon: Pill, meds: HTN_MEDS },
  { label: 'DM Medications', icon: Syringe, meds: DM_MEDS  },
];

// ── Styles ──────────────────────────────────────────────────
const INK   = '#0f1f26';
const SLATE = '#516169';
const TEAL  = '#005469';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid rgba(191,200,205,.55)',
  borderRadius: '4px',
  padding: '7px 10px',
  fontSize: '13px',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  color: INK,
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.5px',
  color: SLATE,
  marginBottom: '4px',
};

// ── Diagnosis colour palette (cycles through these) ──────────
const DX_COLOURS = [
  { bg: '#e0f2fe', border: '#38bdf8', text: '#0369a1', header: '#0284c7' },
  { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', header: '#d97706' },
  { bg: '#dcfce7', border: '#86efac', text: '#14532d', header: '#16a34a' },
  { bg: '#f3e8ff', border: '#d8b4fe', text: '#581c87', header: '#7c3aed' },
  { bg: '#fce7f3', border: '#f9a8d4', text: '#831843', header: '#db2777' },
  { bg: '#ffedd5', border: '#fdba74', text: '#7c2d12', header: '#ea580c' },
  { bg: '#f0fdf4', border: '#6ee7b7', text: '#064e3b', header: '#059669' },
  { bg: '#ede9fe', border: '#c4b5fd', text: '#3b0764', header: '#6d28d9' },
];

// ── Collapsible chip section for a single diagnosis ──────────
function DiagnosisChipSection({
  label,
  meds,
  selectedName,
  onSelect,
  colourIdx,
}: {
  label: string;
  meds: string[];
  selectedName: string;
  onSelect: (name: string) => void;
  colourIdx: number;
}) {
  const [open, setOpen] = useState(true);
  const col = DX_COLOURS[colourIdx % DX_COLOURS.length];

  return (
    <div style={{
      border: `1.5px solid ${col.border}`,
      borderRadius: '6px',
      overflow: 'hidden',
      marginBottom: '6px',
    }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 10px',
          background: col.header,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{
          fontSize: '10px',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.5px',
          color: '#fff',
        }}>
          {label}
        </span>
        <span style={{ fontSize: '12px', color: '#fff', opacity: .8 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Chips */}
      {open && (
        <div style={{
          padding: '8px 10px',
          background: col.bg,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '5px',
        }}>
          {meds.map((med) => {
            const active = selectedName === med;
            return (
              <button
                key={med}
                type="button"
                onClick={() => onSelect(active ? '' : med)}
                style={{
                  fontSize: '11px',
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  fontWeight: active ? 700 : 500,
                  padding: '3px 9px',
                  borderRadius: '9999px',
                  border: `1.5px solid ${active ? col.header : col.border}`,
                  background: active ? col.header : '#fff',
                  color: active ? '#fff' : col.text,
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                {med}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main MedRow component ────────────────────────────────────
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
  const [query, setQuery]       = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autocomplete matches
  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return ALL_MEDS.filter((m) => m.toLowerCase().includes(q)).slice(0, 10);
  }, [query]);

  // Diagnosis-specific groups
  const dxGroups = useMemo(
    () => getMedGroupsForDiagnoses(diagnosisCodes),
    [diagnosisCodes],
  );

  function selectMed(name: string) {
    onChange({ ...med, name });
    setQuery('');
    setShowDrop(false);
    setShowPicker(false);
  }

  const hasName = med.name.trim().length > 0;

  return (
    <div style={{
      border: '1.5px solid rgba(191,200,205,.45)',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '10px',
      background: '#fafcfd',
    }}>
      {/* ── Row 1: Drug name autocomplete + Remove ── */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>

        {/* Drug name field */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={labelStyle}>Drug Name</div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type drug name or pick below…"
            value={query || med.name}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange({ ...med, name: e.target.value });
              setShowDrop(true);
            }}
            onFocus={() => { if (query) setShowDrop(true); }}
            onBlur={() => setTimeout(() => setShowDrop(false), 180)}
            style={{ ...fieldStyle, fontWeight: hasName ? 600 : 400 }}
          />

          {/* Autocomplete dropdown */}
          {showDrop && (matches.length > 0 || query.length > 1) && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#fff', border: '1.5px solid rgba(0,84,105,.25)',
              borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,.1)',
              maxHeight: '200px', overflowY: 'auto',
            }}>
              {matches.map((m) => (
                <div
                  key={m}
                  onMouseDown={() => selectMed(m)}
                  style={{
                    padding: '7px 12px', fontSize: '12px',
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                    cursor: 'pointer', color: INK,
                    borderBottom: '1px solid rgba(191,200,205,.3)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#e0f7fa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  {m}
                </div>
              ))}
              {query.length > 1 && (
                <div
                  onMouseDown={() => selectMed(query)}
                  style={{
                    padding: '7px 12px', fontSize: '11px',
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                    cursor: 'pointer', color: TEAL, fontStyle: 'italic',
                    background: '#f0fdf4',
                    display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <Pencil size={12} /> Use: "{query}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dose */}
        <div style={{ width: '100px' }}>
          <div style={labelStyle}>Dose</div>
          <input
            type="text"
            placeholder="e.g. 500mg"
            value={med.dose ?? ''}
            onChange={(e) => onChange({ ...med, dose: e.target.value })}
            style={fieldStyle}
          />
        </div>

        {/* Remove button */}
        <div style={{ paddingTop: '18px' }}>
          <button
            type="button"
            onClick={onRemove}
            style={{
              background: '#fee2e2', color: '#dc2626',
              border: '1.5px solid #fca5a5',
              borderRadius: '4px', padding: '6px 10px',
              fontSize: '13px', cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Row 2: Frequency + Notes ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div>
          <div style={labelStyle}>Frequency</div>
          <select
            value={med.freq ?? ''}
            onChange={(e) => onChange({ ...med, freq: e.target.value })}
            style={{ ...fieldStyle, appearance: 'none' }}
          >
            <option value="">— select frequency —</option>
            {FREQ_OPTIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Instructions / Notes</div>
          <input
            type="text"
            placeholder="e.g. take with food, titrate up…"
            value={(med as any).instructions ?? ''}
            onChange={(e) => onChange({ ...med, ...{ instructions: e.target.value } } as Medication)}
            style={fieldStyle}
          />
        </div>
      </div>

      {/* ── Toggle picker button ── */}
      <button
        type="button"
        onClick={() => setShowPicker((p) => !p)}
        style={{
          fontSize: '11px',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.4px',
          padding: '4px 12px',
          borderRadius: '9999px',
          border: `1.5px solid ${TEAL}`,
          background: showPicker ? TEAL : '#fff',
          color: showPicker ? '#fff' : TEAL,
          cursor: 'pointer',
          marginBottom: showPicker ? '10px' : 0,
        }}
      >
        {showPicker ? '▲ Hide Drug Picker' : '▼ Quick-Pick Drug'}
      </button>

      {/* ── Drug picker panel ── */}
      {showPicker && (
        <div style={{ marginTop: '4px' }}>

          {/* Core groups (HTN + DM) */}
          {CORE_GROUPS.map((group, gi) => (
            <DiagnosisChipSection
              key={group.label}
              label={group.label}
              meds={group.meds}
              selectedName={med.name}
              onSelect={selectMed}
              colourIdx={gi}
            />
          ))}

          {/* Diagnosis-specific groups */}
          {dxGroups.length > 0 && (
            <>
              <div style={{
                fontSize: '10px',
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.5px',
                color: TEAL,
                margin: '10px 0 6px',
                paddingLeft: '2px',
                borderTop: '1.5px solid rgba(0,84,105,.15)',
                paddingTop: '8px',
                display: 'flex', alignItems: 'center', gap: 4
              }}>
                <ClipboardList size={12} /> Medications by Diagnosis
              </div>
              {dxGroups.map((group, gi) => (
                <DiagnosisChipSection
                  key={group.label}
                  label={group.label}
                  meds={group.meds}
                  selectedName={med.name}
                  onSelect={selectMed}
                  colourIdx={gi + 2}
                />
              ))}
            </>
          )}

          {dxGroups.length === 0 && (
            <div style={{
              fontSize: '11px', color: SLATE,
              fontStyle: 'italic', textAlign: 'center',
              padding: '8px 0',
              borderTop: '1px solid rgba(191,200,205,.4)',
              marginTop: '6px',
            }}>
              Add diagnoses in Section 3 to see comorbidity-specific drug groups here
            </div>
          )}
        </div>
      )}
    </div>
  );
}
