// ════════════════════════════════════════════════════════════
// REMOTECARE · src/components/visit/DrugInteractionAlert.tsx
// Shows drug-drug AND drug-diagnosis warnings in the visit modal.
// Drug-diagnosis warnings fire even with a single drug —
// e.g. HCT prescribed to a diabetic patient.
// ════════════════════════════════════════════════════════════

import type { Medication } from '../../types';
import { Microscope, AlertTriangle, Pill } from 'lucide-react';
import {
  checkInteractions,
  checkDiagnosisWarnings,
  severityDisplay,
  type DetectedInteraction,
  type DetectedDiagnosisWarning,
} from '../../data/drugInteractions';
import { useMemo } from 'react';

// ── shared pill + card styles ────────────────────────────────
const drugPill = {
  fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
  fontSize: 10,
  fontWeight: 700,
  background: 'rgba(124,58,237,.08)',
  color: '#7c3aed',
  padding: '1px 7px',
  borderRadius: 4,
} as const;

const managementBox = {
  fontSize: 11,
  color: '#0f1f26',
  background: 'rgba(13,110,135,.05)',
  border: '1px solid rgba(13,110,135,.1)',
  borderRadius: 4,
  padding: '6px 10px',
  marginBottom: 6,
} as const;

// ── Lab monitor row ──────────────────────────────────────────
function LabRow({
  monitorParams,
  onAddLab,
}: {
  monitorParams: { labName: string; thresholdNote: string }[];
  onAddLab?: (lab: string) => void;
}) {
  if (!monitorParams?.length) return null;
  return (
    <div>
      <div style={{
        fontSize: 10, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '.4px',
        color: '#15803d', marginBottom: 4,
        display: 'flex', alignItems: 'center', gap: 4
      }}>
        <Microscope size={12} /> Recommended Monitoring Labs:
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {monitorParams.map((mp) => (
          <div key={mp.labName} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 600,
              background: '#f0fdf4', color: '#15803d',
              border: '1px solid #86efac',
              padding: '2px 8px', borderRadius: 4,
            }}>
              {mp.labName}
            </span>
            <span style={{ fontSize: 10, color: '#516169', fontStyle: 'italic' }}>
              ({mp.thresholdNote})
            </span>
            {onAddLab && (
              <button
                type="button"
                onClick={() => onAddLab(mp.labName)}
                style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  padding: '2px 7px', borderRadius: 4,
                  background: '#005469', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif", letterSpacing: '.4px',
                }}
              >
                + Add
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Drug-Drug interaction card ───────────────────────────────
function DrugDrugCard({
  item,
  index,
  total,
  onAddLab,
}: {
  item: DetectedInteraction;
  index: number;
  total: number;
  onAddLab?: (lab: string) => void;
}) {
  const { interaction, drug1Name, drug2Name } = item;
  const disp = severityDisplay(interaction.severity);
  return (
    <div style={{
      padding: '12px 14px',
      borderBottom: index < total - 1 ? '1px solid rgba(220,38,38,.1)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px',
          padding: '2px 8px', borderRadius: 9999,
          background: disp.bg, color: disp.color,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}>
          {disp.icon} {disp.label}
        </span>
        {drug1Name && <span style={drugPill}>{drug1Name}</span>}
        {drug2Name && (
          <>
            <span style={{ fontSize: 10, color: '#6f797d' }}>+</span>
            <span style={drugPill}>{drug2Name}</span>
          </>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#7f1d1d', marginBottom: 3 }}>
        {interaction.clinicalEffect}
      </div>
      <div style={{ fontSize: 11, color: '#516169', marginBottom: 4 }}>
        <span style={{ fontWeight: 700 }}>Mechanism: </span>{interaction.mechanism}
      </div>
      <div style={managementBox}>
        <span style={{ fontWeight: 700, color: '#005469' }}>Management: </span>
        {interaction.management}
      </div>
      <LabRow monitorParams={interaction.monitorParams ?? []} onAddLab={onAddLab} />
    </div>
  );
}

// ── Diagnosis-Drug warning card ──────────────────────────────
function DiagnosisDrugCard({
  item,
  index,
  total,
  onAddLab,
}: {
  item: DetectedDiagnosisWarning;
  index: number;
  total: number;
  onAddLab?: (lab: string) => void;
}) {
  const { warning, drugName } = item;
  const disp = severityDisplay(warning.severity);
  return (
    <div style={{
      padding: '12px 14px',
      borderBottom: index < total - 1 ? '1px solid rgba(234,179,8,.15)' : 'none',
      background: '#fffdf0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px',
          padding: '2px 8px', borderRadius: 9999,
          background: disp.bg, color: disp.color,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}>
          {disp.icon} {disp.label}
        </span>
        <span style={drugPill}>{drugName}</span>
        <span style={{ fontSize: 10, color: '#6f797d' }}>in patient with</span>
        <span style={{
          fontSize: 10, fontWeight: 700,
          background: 'rgba(234,179,8,.15)', color: '#78350f',
          padding: '1px 7px', borderRadius: 4,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}>
          {warning.diagnosisPatterns[0]} diagnosis
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 3 }}>
        {warning.clinicalEffect}
      </div>
      <div style={{ fontSize: 11, color: '#516169', marginBottom: 4 }}>
        <span style={{ fontWeight: 700 }}>Mechanism: </span>{warning.mechanism}
      </div>
      <div style={{ ...managementBox, background: 'rgba(234,179,8,.06)', border: '1px solid rgba(234,179,8,.2)' }}>
        <span style={{ fontWeight: 700, color: '#92400e' }}>Management: </span>
        {warning.management}
      </div>
      <LabRow monitorParams={warning.monitorParams ?? []} onAddLab={onAddLab} />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function DrugInteractionAlert({
  medications,
  diagnosisCodes = [],
  patientCond = '',
  onAddLab,
}: {
  medications: Medication[];
  diagnosisCodes?: string[];
  patientCond?: string;
  onAddLab?: (labName: string) => void;
}) {
  const names = medications.map((m) => m.name).filter(Boolean);

  const interactions = useMemo(
    () => checkInteractions(names),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [names.join('|')]
  );

  const dxWarnings = useMemo(
    () => checkDiagnosisWarnings(names, diagnosisCodes, patientCond),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [names.join('|'), diagnosisCodes.join('|'), patientCond]
  );

  const totalCount = interactions.length + dxWarnings.length;
  if (totalCount === 0) return null;

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(220,38,38,.2)', marginBottom: 12 }}>

      {/* Header */}
      <div style={{
        background: '#7f1d1d', padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16, display: 'inline-flex', alignItems: 'center' }}><AlertTriangle size={16} /></span>
        <span style={{
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700,
          fontSize: 11, color: '#fff', textTransform: 'uppercase', letterSpacing: '.5px',
        }}>
          Clinical Alert — {totalCount} warning{totalCount > 1 ? 's' : ''} detected
        </span>
      </div>

      {/* Drug-Diagnosis warnings (shown first — most clinically urgent) */}
      {dxWarnings.length > 0 && (
        <div style={{ background: '#fffdf0', borderBottom: interactions.length > 0 ? '2px solid rgba(234,179,8,.3)' : 'none' }}>
          <div style={{
            padding: '5px 14px',
            background: 'rgba(234,179,8,.12)',
            fontSize: 10, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.4px', color: '#78350f',
            display: 'flex', alignItems: 'center', gap: 4
          }}>
            <Microscope size={12} /> Drug–Diagnosis Warnings ({dxWarnings.length})
          </div>
          {dxWarnings.map((item, i) => (
            <DiagnosisDrugCard
              key={item.warning.id + item.drugName}
              item={item}
              index={i}
              total={dxWarnings.length}
              onAddLab={onAddLab}
            />
          ))}
        </div>
      )}

      {/* Drug-Drug interactions */}
      {interactions.length > 0 && (
        <div style={{ background: '#fff9f9' }}>
          {dxWarnings.length > 0 && (
            <div style={{
              padding: '5px 14px',
              background: 'rgba(220,38,38,.06)',
              fontSize: 10, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.4px', color: '#7f1d1d',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
              <Pill size={12} /> Drug–Drug Interactions ({interactions.length})
            </div>
          )}
          {interactions.map((item, i) => (
            <DrugDrugCard
              key={item.interaction.id}
              item={item}
              index={i}
              total={interactions.length}
              onAddLab={onAddLab}
            />
          ))}
        </div>
      )}
    </div>
  );
}
