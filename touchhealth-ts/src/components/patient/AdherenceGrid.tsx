import type { Patient } from '../../types';
import { MONTHS_FULL } from '../../utils/geo';

export default function AdherenceGrid({ patient }: { patient: Patient }) {
  const visits = patient.visits ?? [];
  const byMonth = new Map<number, { att: boolean }>();

  for (const v of visits) {
    // Visit.month is 1-12
    if (v.month < 1 || v.month > 12) continue;
    byMonth.set(v.month, { att: !!v.att });
  }

  // Calculate adherence score
  const attendedCount = Array.from(byMonth.values()).filter(v => v.att).length;
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
          const rec = byMonth.get(month);

          const state = rec ? (rec.att ? 'attended' : 'missed') : 'pending';
          const isFuture = month > new Date().getMonth() + 1;
          
          let bg, fg, icon = '';
          
          if (isFuture) {
            bg = '#ffffff';
            fg = '#bfc8cd';
            icon = '';
          } else if (state === 'attended') {
            bg = '#dcfce7';
            fg = '#16a34a';
            icon = 'check';
          } else if (state === 'missed') {
            bg = '#fee2e2';
            fg = '#dc2626';
            icon = 'close';
          } else {
            bg = '#e8e8e6';
            fg = '#64748b';
            icon = 'schedule';
          }

          const opacity = isFuture ? 0.3 : 1;

          return (
            <div
              key={month}
              className="rounded border flex flex-col items-center justify-center p-2"
              style={{ 
                background: bg, 
                opacity,
                height: '48px',
                borderColor: '#e2e8f0'
              }}
            >
              {icon && (
                <span 
                  className="material-symbols-outlined" 
                  style={{ 
                    fontSize: 16, 
                    color: fg,
                    marginBottom: '2px'
                  }}
                >
                  {icon}
                </span>
              )}
              <div className="font-mono text-[8px] font-bold" style={{ color: fg }}>
                {monthLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

