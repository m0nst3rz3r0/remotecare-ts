import { archiveApproved } from '../lib/clinical/planValidation';
import type { Patient } from '../types';
import type { GeneratedMealPlan, NutritionSyncState } from '../lib/clinical/types';
import { supabase } from './supabase';

export function nutritionPlans(patient: Patient): Record<string, GeneratedMealPlan> {
  return Object.fromEntries(patient.visits.filter((v) => v.mealPlan).map((v) => [v.id, v.mealPlan!]));
}
export interface NutritionSyncResult {
  profile: Patient['nutritionProfile']; plans: Record<string, GeneratedMealPlan>; state: NutritionSyncState;
}
export async function pushNutrition(patient: Patient): Promise<NutritionSyncResult | null> {
  if (!patient.nutritionSync?.dirty && (patient.nutritionSync || (!patient.nutritionProfile && !patient.visits.some((v) => v.mealPlan)))) return null;
  const plans = nutritionPlans(patient);
  const { data, error } = await supabase.rpc('sync_nutrition', { patient_key: String(patient.id), expected_revision: patient.nutritionSync?.revision ?? 0,
    profile: patient.nutritionProfile ?? null, plans });
  if (error || !data) throw new Error('Nutrition sync failed. Apply migration 006 and retry; local plans are saved. ' + (error?.message ?? 'Missing response'));
  if (!data.applied) return { profile: patient.nutritionProfile, plans, state: { revision: patient.nutritionSync?.revision ?? 0, dirty: true,
    conflict: { revision: Number(data.revision), profile: data.profile, plans: data.plans } } };
  return { profile: data.profile ?? undefined, plans: data.plans, state: { revision: Number(data.revision), dirty: false } };
}
export function resolveNutritionConflict(patient: Patient, choice: 'local' | 'cloud'): Patient {
  const conflict = patient.nutritionSync?.conflict;
  if (!conflict) return patient;
  const cloudPlans = conflict.plans;
  return { ...patient,
    nutritionProfile: choice === 'cloud' ? conflict.profile as Patient['nutritionProfile'] : patient.nutritionProfile,
    nutritionSync: { revision: conflict.revision, dirty: choice === 'local' },
    visits: patient.visits.map((visit) => {
      const cloud = cloudPlans[visit.id];
      if (choice === 'cloud') return { ...visit, mealPlan: cloud ?? undefined };
      if (!visit.mealPlan) return { ...visit, mealPlan: cloud ?? undefined };
      if (cloud?.approval && JSON.stringify(cloud) !== JSON.stringify(visit.mealPlan)) {
        const { history, ...oldSnapshot } = cloud;
        return { ...visit, mealPlan: { ...visit.mealPlan, approval: undefined, history: [...(history ?? []), ...(archiveApproved(visit.mealPlan) ?? []), oldSnapshot] } };
      }
      return visit;
    }),
  };
}
