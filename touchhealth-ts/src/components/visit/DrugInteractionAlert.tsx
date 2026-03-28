// ════════════════════════════════════════════════════════════
// REMOTECARE · src/components/visit/DrugInteractionAlert.tsx
// Shows drug interaction warnings in the visit modal
// Links to relevant lab investigations
// ════════════════════════════════════════════════════════════

import type { Medication } from '../../types';
import {
  checkInteractions, severityDisplay,
  type DetectedInteraction,
} from '../../data/drugInteractions';
import { useMemo } from 'react';

export default function DrugInteractionAlert({
  medications,
  onAddLab,
}: {
  medications: Medication[];
  onAddLab?: (labName: string) => void;
}) {
  const names = medications.map((m) => m.name).filter(Boolean);
  const interactions = useMemo(() => checkInteractions(names), [names]);

  if (interactions.length === 0) return null;

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(220,38,38,.2)', marginBottom: 12 }}>
      {/* Header */}
      <div style={{
        background: '#7f1d1d', padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: '#fff', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Drug Interaction Alert — {interactions.length} interaction{interactions.length > 1 ? 's' : ''} detected
        </span>
      </div>

      {/* Interaction list */}
      <div style={{ background: '#fff9f9' }}>
        {interactions.map(({ interaction, drug1Name, drug2Name }, i) => {
          const disp = severityDisplay(interaction.severity);
          return (
            <div key={interaction.id} style={{
              padding: '12px 14px',
              borderBottom: i < interactions.length - 1 ? '1px solid rgba(220,38,38,.1)' : 'none',
            }}>
              {/* Severity + drugs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px',
                  padding: '2px 8px', borderRadius: 9999,
                  background: disp.bg, color: disp.color,
                  fontFamily: 'Syne, sans-serif',
                }}>
                  {disp.icon} {disp.label}
                </span>
                {drug1Name && (
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
                    background: 'rgba(124,58,237,.08)', color: '#7c3aed',
                    padding: '1px 7px', borderRadius: 4,
                  }}>
                    {drug1Name}
                  </span>
                )}
                {drug2Name && (
                  <>
                    <span style={{ fontSize: 10, color: '#6f797d' }}>+</span>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
                      background: 'rgba(124,58,237,.08)', color: '#7c3aed',
                      padding: '1px 7px', borderRadius: 4,
                    }}>
                      {drug2Name}
                    </span>
                  </>
                )}
              </div>

              {/* Clinical effect */}
              <div style={{ fontSize: 12, fontWeight: 600, color: '#7f1d1d', marginBottom: 3 }}>
                {interaction.clinicalEffect}
              </div>

              {/* Mechanism */}
              <div style={{ fontSize: 11, color: '#516169', marginBottom: 4 }}>
                <span style={{ fontWeight: 700 }}>Mechanism: </span>{interaction.mechanism}
              </div>

              {/* Management */}
              <div style={{
                fontSize: 11, color: '#0f1f26',
                background: 'rgba(13,110,135,.05)',
                border: '1px solid rgba(13,110,135,.1)',
                borderRadius: 4, padding: '6px 10px', marginBottom: 6,
              }}>
                <span style={{ fontWeight: 700, color: '#005469' }}>Management: </span>
                {interaction.management}
              </div>

              {/* Linked lab tests */}
              {(interaction.monitorLabs?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: '#15803d', marginBottom: 4 }}>
                    🔬 Recommended Monitoring Labs:
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {interaction.monitorParams?.map((mp) => (
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
                              fontFamily: 'Syne, sans-serif', letterSpacing: '.4px',
                            }}
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
