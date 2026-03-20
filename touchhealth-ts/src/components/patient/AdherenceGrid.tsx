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

  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-2">
        12-month adherence (Jan–Dec)
      </div>

      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }).map((_, i) => {
          const month = i + 1;
          const monthLabel = MONTHS_FULL[i].slice(0, 3);
          const rec = byMonth.get(month);

          const state = rec ? (rec.att ? 'attended' : 'missed') : 'pending';
          const bg =
            state === 'attended'
              ? 'var(--emerald-pale)'
              : state === 'missed'
                ? 'var(--rose-pale)'
                : 'var(--cream)';
          const fg =
            state === 'attended'
              ? 'var(--emerald)'
              : state === 'missed'
                ? 'var(--rose)'
                : 'var(--slate)';
          const symbol = state === 'attended' ? '✓' : state === 'missed' ? '✕' : '•';

          return (
            <div
              key={month}
              className="rounded-[var(--r-sm)] border border-[var(--border)] px-2 py-2 flex flex-col items-center"
              style={{ background: bg }}
            >
              <div
                className="font-extrabold text-[14px] leading-none"
                style={{ color: fg }}
              >
                {symbol}
              </div>
              <div className="text-[10px] font-extrabold mt-1" style={{ color: fg }}>
                {monthLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

