import type { Medication } from '../../types';
import { DM_MEDS, HTN_MEDS } from '../../services/clinical';

const GROUPS = ['HTN', 'DM'] as const;
type MedGroup = (typeof GROUPS)[number];

function medGroupFromName(name: string): MedGroup {
  const n = name.toLowerCase();
  if (DM_MEDS.some((m) => m.toLowerCase() === n)) return 'DM';
  return 'HTN';
}

export default function MedRow({
  med,
  onChange,
  onRemove,
}: {
  med: Medication;
  onChange: (next: Medication) => void;
  onRemove: () => void;
}) {
  const group: MedGroup = med.name ? medGroupFromName(med.name) : 'HTN';
  const list = group === 'HTN' ? HTN_MEDS : DM_MEDS;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
      <div>
        <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
          Group
        </div>
        <select
          value={group}
          onChange={(e) => {
            const nextGroup = e.target.value as MedGroup;
            const first = (nextGroup === 'HTN' ? HTN_MEDS : DM_MEDS)[0] ?? '';
            onChange({ ...med, name: first });
          }}
          className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
        >
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-[10px] uppercase font-extrabold tracking-[0.5px] text-[var(--slate)] mb-1">
          Medication
        </div>
        <select
          value={med.name}
          onChange={(e) => onChange({ ...med, name: e.target.value })}
          className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 outline-none bg-white"
        >
          {list.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center justify-center px-3 py-2 rounded-[var(--r-sm)] border border-[var(--rose)] text-[var(--rose)] font-extrabold text-xs uppercase tracking-[0.5px]"
          title="Remove"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

