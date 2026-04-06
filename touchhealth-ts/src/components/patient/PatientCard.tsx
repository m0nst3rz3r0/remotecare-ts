import type { Patient } from '../../types';
import { getLastVisit, bpClass, sgClass } from '../../services/clinical';

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
        'w-full text-left rounded-lg transition p-3',
        selected
          ? 'bg-emerald-50'
          : 'bg-white hover:bg-slate-50',
      ].join(' ')}
      style={{ 
        border: 'none',
        borderLeft: selected ? '3px solid #10b981' : '3px solid transparent',
        boxShadow: selected ? '0 1px 3px rgba(16,185,129,.1)' : '0 1px 3px rgba(15,31,38,.06)'
      }}
    >
      <div className="flex items-start gap-3">
        <div className="pt-tag">
          {patient.code}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={[
              'px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider',
              conditionChipCls(patient.cond)
            ].join(' ')}>
              {patient.cond}
            </span>
            <span className={[
              'px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider',
              statusChipCls(patient.status)
            ].join(' ')}>
              {patient.status === 'ltfu' ? 'LTFU' : patient.status.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span style={{ fontFamily: 'Karla, sans-serif' }}>
              {patient.age}y · {patient.sex}
            </span>
            <span style={{ fontFamily: 'Karla, sans-serif' }}>
              {lv?.date ? new Date(lv.date).toLocaleDateString('en-GB') : '—'}
            </span>
          </div>

          {(bpCls || sgCls) && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {bpCls && (
                <span className={[
                  'px-2 py-1 rounded text-[9px] font-bold',
                  bpCls.cls === 'chip-crisis' ? 'bg-[#ba1a1a] text-white' :
                  bpCls.cls === 'chip-high' ? 'bg-[#fee2e2] text-[#7f1d1d]' :
                  bpCls.cls === 'chip-elevated' ? 'bg-[#fef3c7] text-[#78350f]' :
                  'bg-[#dcfce7] text-[#14532d]'
                ].join(' ')}>
                  {lv!.sbp}/{lv!.dbp}
                </span>
              )}
              {sgCls && (
                <span className={[
                  'px-2 py-1 rounded text-[9px] font-bold',
                  sgCls.cls === 'chip-crisis' ? 'bg-[#ba1a1a] text-white' :
                  sgCls.cls === 'chip-high' ? 'bg-[#fee2e2] text-[#7f1d1d]' :
                  sgCls.cls === 'chip-elevated' ? 'bg-[#fef3c7] text-[#78350f]' :
                  'bg-[#dcfce7] text-[#14532d]'
                ].join(' ')}>
                  {lv!.sugar} {lv!.sugarType}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

