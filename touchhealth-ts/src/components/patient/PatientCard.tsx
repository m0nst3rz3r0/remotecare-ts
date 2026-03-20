import type { Patient } from '../../types';
import { getLastVisit, bpClass, sgClass } from '../../services/clinical';
import Chip from '../ui/Chip';

function conditionChipCls(cond: Patient['cond']): string {
  if (cond === 'DM') return 'chip-blue';
  if (cond === 'DM+HTN') return 'chip-elevated';
  return 'chip-high';
}

function statusChipCls(status: Patient['status']): string {
  if (status === 'active') return 'chip-normal';
  if (status === 'ltfu') return 'chip-high';
  return 'chip-gray';
}

export default function PatientCard({
  patient,
  selected,
  onSelect,
}: {
  patient: Patient;
  selected: boolean;
  onSelect: () => void;
}) {
  const lv = getLastVisit(patient);
  const bpCls =
    lv?.sbp && lv?.dbp ? bpClass(lv.sbp, lv.dbp) : null;
  const sgCls =
    lv?.sugar && lv?.sugarType
      ? sgClass(lv.sugar, (lv.sugarType as any) ?? 'FBS')
      : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left rounded-[var(--r)] border px-3 py-2 transition',
        selected
          ? 'border-[var(--teal)] bg-[var(--teal-ultra)]'
          : 'border-[var(--border)] bg-white hover:bg-[var(--teal-ultra)]/50',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <div className="mono text-[12px] font-extrabold text-[var(--ink)]">
          {patient.code}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Chip cls={conditionChipCls(patient.cond)}>
              {patient.cond}
            </Chip>
            <Chip cls={statusChipCls(patient.status)}>
              {patient.status === 'ltfu' ? 'LTFU' : patient.status.toUpperCase()}
            </Chip>
          </div>

          <div className="mt-1 text-[12px] text-[var(--slate)] flex items-center gap-2 flex-wrap">
            <span>
              {patient.age}y · {patient.sex}
            </span>
            <span>·</span>
            <span>{lv?.date ? new Date(lv.date).toLocaleDateString('en-GB') : '—'}</span>
          </div>

          {(bpCls || sgCls) && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {bpCls && (
                <Chip cls={bpCls.cls}>
                  {lv!.sbp}/{lv!.dbp}
                </Chip>
              )}
              {sgCls && (
                <Chip cls={sgCls.cls}>
                  {lv!.sugar} {lv!.sugarType}
                </Chip>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

