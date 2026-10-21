import { getFoodsForZone, supportedPreparations } from './dataLoader';
import { evalFoodForPatient } from './foodSafety';
import { canonicalizeCondition, normalizeConditionList } from './conditions';
import { formatMealPortion, getServingGrams, roundPortion } from './mealPortions';
import type { GeneratedMealPlan } from './types';

export type FoodChoiceStatus = 'suitable' | 'limit' | 'avoid' | 'not_assessed';
export interface FoodChoiceEntry {
  foodId: string; name_en: string; name_sw: string; categories: string[];
  preparation: string; status: FoodChoiceStatus;
  portion_en: string; portion_sw: string; grams: number;
  reasons: Array<{ message_en: string; message_sw: string }>;
  available: boolean; alternativePreparation?: string;
}
export interface FoodChoiceGuide {
  version: string; datasetVersion?: string; policyVersion?: string;
  assessmentFingerprint?: string; provisional: boolean; entries: FoodChoiceEntry[];
}
/** Save evaluated food/preparation pairs with the plan; never recompute historical advice. */
export function buildFoodChoiceGuide(plan: GeneratedMealPlan): FoodChoiceGuide {
  const conditions = [...(plan.conditions ?? []), ...(plan.inputSnapshot?.medicationIds ?? [])];
  const a = plan.assessment;
  const provisional = !a || a.allergyScreen !== 'no' || a.pregnancyOrBreastfeeding !== 'no'
    || a.significantWeightLoss !== 'no' || a.specialistCondition !== 'no'
    || !a.measurementDate || !Number.isFinite(Date.parse(a.measurementDate))
    || normalizeConditionList(plan.conditions ?? []).some(c=>!['DM','HTN','Obesity','Dyslipid'].includes(canonicalizeCondition(c)));
  const entries = getFoodsForZone(plan.region).flatMap(food => {
    const preps = supportedPreparations(food);
    const alternative = preps.find(p => evalFoodForPatient(food.id,p,conditions).severity === 'Safe');
    return (preps.length ? preps : ['unassessed']).map(preparation => {
      const result = evalFoodForPatient(food.id,preparation,conditions);
      const excluded = !!a?.excludedFoodIds.includes(food.id);
      const status: FoodChoiceStatus = excluded ? 'avoid' : result.severity === 'Danger' ? 'avoid'
        : result.severity === 'Warning' ? 'limit' : result.severity === 'not_assessed' || provisional ? 'not_assessed' : 'suitable';
      const reasons = excluded ? [{message_en:'Excluded in this assessment; confirm the reason before use.',message_sw:'Kimeondolewa katika tathmini; thibitisha sababu kabla ya matumizi.'}]
        : [...(result.reasons?.length ? result.reasons : [{message_en:result.message_en,message_sw:result.message_sw}]),
          ...(provisional ? [{message_en:'Screening incomplete or positive; clinician review required.',message_sw:'Uchunguzi haujakamilika au una tahadhari; uhakiki wa mtaalamu unahitajika.'}] : [])];
      const portion = roundPortion(food,0.5);
      return {foodId:food.id,name_en:food.name_en,name_sw:food.name_sw,categories:Array.isArray(food.category)?food.category:[food.category],preparation,status,
        portion_en:formatMealPortion(food,portion,'en'),portion_sw:formatMealPortion(food,portion,'sw'),grams:getServingGrams(food,portion),reasons,
        available:!a?.availableFoodIds || a.availableFoodIds.includes(food.id),
        alternativePreparation: !excluded && !provisional && alternative !== preparation ? alternative : undefined};
    });
  });
  return {version:'food-guide-1',datasetVersion:plan.datasetVersion,policyVersion:plan.policyVersion,assessmentFingerprint:plan.inputFingerprint,provisional,entries};
}
