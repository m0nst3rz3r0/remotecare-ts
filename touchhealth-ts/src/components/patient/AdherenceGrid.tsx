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
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase font-bold tracking-wider text-slate-500">
          12-month adherence (Jan–Dec)
        </div>
        <div className="font-mono text-sm font-semibold" style={{ color: '#10b981' }}>
          {adherenceScore}%
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 12 }).map((_, i) => {
          const month = i + 1;
          const monthLabel = MONTHS_FULL[i].slice(0, 3);
          const state = states[i];

          let bg: string;
          let fg: string;
          let icon = '';

          switch (state) {
            case 'attended':
              bg = '#dcfce7';
              fg = '#16a34a';
              icon = 'check';
              break;
            case 'missed':
              bg = '#fee2e2';
              fg = '#dc2626';
              icon = 'close';
              break;
            case 'future':
              bg = '#ffffff';
              fg = '#bfc8cd';
              break;
            case 'before_programme':
              bg = '#f1f5f9';
              fg = '#cbd5e1';
              break;
            default:
              bg = '#e8e8e6';
              fg = '#64748b';
              icon = 'schedule';
          }

          const opacity = state === 'future' || state === 'before_programme' ? 0.45 : 1;

          return (
            <div
              key={month}
              className="rounded border flex flex-col items-center justify-center p-2"
              style={{
                background: bg,
                opacity,
                height: '48px',
                borderColor: '#e2e8f0',
              }}
            >
              {icon && (
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 16,
                    color: fg,
                    marginBottom: '2px',
                  }}
                >
                  {icon}
                </span>
              )}
              <div className="font-mono text-[9px] font-bold" style={{ color: fg, letterSpacing: '-0.3px' }}>
                {monthLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
