import type { Patient } from '../types';
import { getPatientConditions, regionToZone } from '../lib/clinical/conditions';
import { toMedIds } from '../lib/clinical/drugMapper';
import { getClinicalDataState, getClinicZone } from '../lib/clinical/dataLoader';
import { invalidatePlan, isPlanStale } from '../lib/clinical/planValidation';
import type { TZRegion } from '../lib/clinical/types';

/** Clinical changes invalidate current approvals; their immutable snapshots survive. */
export function refreshNutritionPlans(patient: Patient): Patient {
  if (getClinicalDataState().status !== 'ready' || !patient.visits.some(v => v.mealPlan?.schemaVersion === 2)) return patient;
  const ordered = patient.visits.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const latest = ordered.find(v=>v.att);
  const weight = ordered.find(v=>v.weight)?.weight;
  const height = ordered.find(v=>v.height)?.height;
  const meds = patient.medications.slice().sort((a,b)=>(b.changedAt ?? b.date).localeCompare(a.changedAt ?? a.date))[0]?.meds ?? latest?.meds;
  let changed = false;
  const visits = patient.visits.map(visit=>{
    const plan=visit.mealPlan;
    if (!plan?.inputSnapshot || plan.stale) return visit;
    const input = { ...plan.inputSnapshot, age:patient.age, sex:patient.sex === 'M' ? 'male' as const : 'female' as const,
      weightKg:weight ?? plan.inputSnapshot.weightKg, heightCm:height ?? plan.inputSnapshot.heightCm,
      conditions:getPatientConditions(patient.cond,latest?.diagnoses?.map(d=>d.code) ?? []),
      medicationIds:meds ? toMedIds(meds.map(m=>m.name)) : plan.inputSnapshot.medicationIds,
      zone:(patient.nutritionProfile?.zoneOverride as TZRegion | undefined) ?? getClinicZone() ?? regionToZone(patient.region),
      assessment:patient.nutritionProfile?.assessment ?? plan.assessment ?? plan.inputSnapshot.assessment };
    if (!isPlanStale(plan,input)) return visit;
    changed=true;return {...visit,mealPlan:invalidatePlan(plan)};
  });
  return changed ? {...patient,visits,nutritionSync:{...patient.nutritionSync,revision:patient.nutritionSync?.revision ?? 0,dirty:true}} : patient;
}
