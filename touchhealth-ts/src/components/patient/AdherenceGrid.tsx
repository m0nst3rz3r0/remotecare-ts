import { Check, Clock3, X } from 'lucide-react';
import type { Patient } from '../../types';
import { getAdherenceMonthState } from '../../services/clinical';
import { MONTHS_FULL } from '../../utils/geo';

export default function AdherenceGrid({ patient }: { patient: Patient }) {
  const year = new Date().getFullYear();
  const states = Array.from({ length: 12 }, (_, i) =>
    getAdherenceMonthState(patient, i + 1, year),
  );

  const attendedCount = states.filter((s) => s === 'attended').length;
  const adherenceScore = Math.round((attendedCount / 12) * 100);

  return (
    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontFamily: "'Inter', system-ui" }}>
          12-month adherence (Jan–Dec)
        </div>
        <div style={{ fontFamily: "ui-monospace, 'Cascadia Code', monospace", fontSize: '13px', fontWeight: 700, color: '#10b981' }}>
          {adherenceScore}%
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
        {Array.from({ length: 12 }).map((_, i) => {
          const month = i + 1;
          const monthLabel = MONTHS_FULL[i].slice(0, 3);
          const state = states[i];

          type CellStyle = { bg: string; fg: string; border: string; icon?: JSX.Element; dim?: boolean };
          let cell: CellStyle;

          switch (state) {
            case 'attended':
              cell = { bg: '#dcfce7', fg: '#15803d', border: '#86efac', icon: <Check size={17} color="#15803d" strokeWidth={2.5} /> };
              break;
            case 'missed':
              cell = { bg: '#fee2e2', fg: '#dc2626', border: '#fca5a5', icon: <X size={17} color="#dc2626" strokeWidth={2.5} /> };
              break;
            case 'future':
              cell = { bg: '#f8fafc', fg: '#94a3b8', border: '#e2e8f0', dim: true };
              break;
            case 'before_programme':
              cell = { bg: '#f1f5f9', fg: '#94a3b8', border: '#e2e8f0', dim: true };
              break;
            default:
              cell = { bg: '#fef9c3', fg: '#854d0e', border: '#fde047', icon: <Clock3 size={17} color="#854d0e" strokeWidth={2.2} /> };
          }

          return (
            <div
              key={month}
              style={{
                background: cell.bg,
                border: `1.5px solid ${cell.border}`,
                borderRadius: '7px',
                height: '58px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                opacity: cell.dim ? 0.5 : 1,
              }}
            >
              {cell.icon}
              <div style={{
                fontFamily: "ui-monospace, 'Cascadia Code', monospace",
                fontSize: '10px',
                fontWeight: 700,
                color: cell.fg,
                letterSpacing: '0.2px',
              }}>
                {monthLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
