import type { HbA1cEntry, HbA1cQuarter, Patient } from '../../types';
import { getLatestHbA1c, hba1cClass, isHbA1cAtTarget } from '../../services/clinical';
import Chip from '../ui/Chip';

export default function HbA1cBox({
  patient,
  value,
  quarter,
  onValueChange,
  onQuarterChange,
}: {
  patient: Patient;
  value: string;
  quarter: HbA1cQuarter;
  onValueChange: (v: string) => void;
  onQuarterChange: (q: HbA1cQuarter) => void;
}) {
  const last = getLatestHbA1c(patient, null) as HbA1cEntry | null;

  const typed = value.trim() === '' ? null : Number(value);
  const classification = typed === null ? null : hba1cClass(typed);

  const lastBadge = (() => {
    if (!last) return 'No HbA1c yet';
    const atTarget = isHbA1cAtTarget(last.value);
    return `Last: ${last.value.toFixed(1)}% ${last.quarter} ${last.year} · ${
      atTarget ? 'At Target' : 'Above Target'
    }`;
  })();

  return (
    <div className="rounded-xl border border-slate-200 p-3" style={{ background: '#fef3c7' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="text-xs uppercase font-bold tracking-wider text-slate-500">
          HbA1c (DM only)
        </div>
        <Chip cls={classification ? classification.cls : 'chip-gray'} title="Control status">
          {classification ? classification.lbl : 'No new value'}
        </Chip>
      </div>

      <div className="mb-3 text-[12px] font-semibold text-slate-800">
        {lastBadge}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1">
            HbA1c %
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="3"
            max="15"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="e.g. 7.8"
          />
        </div>

        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1">
            Quarter
          </div>
          <select
            value={quarter}
            onChange={(e) => onQuarterChange(e.target.value as HbA1cQuarter)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          >
            {(['Q1', 'Q2', 'Q3', 'Q4'] as HbA1cQuarter[]).map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Target ≤ 8%
        </div>
      </div>

      {/* Reference thresholds */}
      <div className="mt-4">
        <div className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">
          Threshold reference
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-3 rounded bg-emerald-100" />
          <div className="flex-1 h-3 rounded bg-amber-100" />
          <div className="flex-1 h-3 rounded bg-blue-100" />
          <div className="flex-1 h-3 rounded bg-rose-100" />
        </div>
        <div className="mt-2 text-[10px] font-semibold text-slate-500 flex items-center justify-between">
          <span>Normal</span>
          <span>Pre-DM</span>
          <span>Target</span>
          <span>Danger</span>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-slate-500 font-semibold">
        Leave blank if not tested this quarter.
      </div>
    </div>
  );
}

