import { isMealStarch, foodFamily, dailyFoodBudget } from './mealComposition';
import { dataFingerprint, getClinicalDataState, getFoodsSync, getFoodsForZone } from './dataLoader';
import { NUTRITION_POLICY } from './nutritionPolicy';
import { canonicalizeCondition, normalizeConditionList } from './conditions';
import { evalFoodForPatient } from './foodSafety';
import { computeFoodMacros, formatMealPortion, getPracticalPortionLimit, getServingGrams, roundPortion } from './mealPortions';
import type { FoodItem, GeneratedMealPlan, MealItem, NutritionInputs, NutrientTotals, PlanIssue, NutritionApproval } from './types';

export function inputFingerprint(input: NutritionInputs): string {
  return dataFingerprint({ ...input, medicationNames: input.medicationNames?.map(n=>n.trim().toLowerCase()).sort(), conditions: [...normalizeConditionList(input.conditions)].sort(), medicationIds: [...input.medicationIds].sort(),
    assessment: { ...input.assessment, availableFoodIds: input.assessment.availableFoodIds?.slice().sort(), excludedFoodIds: input.assessment.excludedFoodIds.slice().sort() } });
}
export function makeMealItem(food: FoodItem, multiplier: number, language: 'en' | 'sw', prep: string, ingredientGrams?: number): MealItem {
  const portion = roundPortion(food, multiplier);
  const grams = ingredientGrams ?? getServingGrams(food, portion);
  const factor = grams / 100, m = food.macros_per_100g;
  const computed = computeFoodMacros(food, portion);
  return { foodId: food.id, name_en: food.name_en, name_sw: food.name_sw,
    portionMultiplier: ingredientGrams == null ? portion : undefined,
    portionText: ingredientGrams == null ? formatMealPortion(food, portion, language) : `${grams}g`,
    portionText_en: ingredientGrams == null ? formatMealPortion(food, portion, 'en') : `${grams}g`,
    portionText_sw: ingredientGrams == null ? formatMealPortion(food, portion, 'sw') : `${grams}g`,
    preparation: prep, prepMethod: prep.toLowerCase(), grams, gramsPerHouseholdUnit: ingredientGrams == null ? food.serving?.grams_per_unit : undefined, ingredient: ingredientGrams != null,
    macros: ingredientGrams == null ? computed : { calories: Math.round(m.calories * factor), protein: m.protein_g * factor, carbs: m.carbs_g * factor, fat: m.fat_g * factor },
    sodiumMg: ingredientGrams == null ? computed.sodiumMg : Number.isFinite(m.sodium_mg) ? m.sodium_mg * factor : null,
    fiberG: ingredientGrams == null ? computed.fiberG : Number.isFinite(m.fiber_g) ? m.fiber_g! * factor : null };
}
export function sumNutrients(items: MealItem[]): NutrientTotals {
  const total: NutrientTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, sodiumMg: 0, fiberG: 0 };
  for (const item of items) {
    for (const key of ['calories','protein','carbs','fat'] as const) total[key] += item.macros[key];
    for (const key of ['sodiumMg','fiberG'] as const) total[key] = total[key] == null || item[key] == null ? null : total[key]! + item[key]!;
  }
  for (const key of ['calories','protein','carbs','fat','sodiumMg','fiberG'] as const) if (total[key] != null) total[key] = Math.round(total[key]! * 10) / 10;
  return total;
}
export function planSignature(plan: GeneratedMealPlan): string {
  return dataFingerprint({ inputs: plan.inputFingerprint, meals: plan.meals, foodChoiceGuide: plan.foodChoiceGuide, targets: plan.targets, dataset: plan.datasetVersion, policy: plan.policyVersion });
}
export function isPlanStale(plan: GeneratedMealPlan, input?: NutritionInputs): boolean {
  return !!plan.stale || (plan.schemaVersion === 2 && (plan.datasetVersion !== getClinicalDataState().version || plan.policyVersion !== NUTRITION_POLICY.version
    || (!!input && plan.inputFingerprint !== inputFingerprint(input))));
}
export function approvalIsCurrent(plan: GeneratedMealPlan): boolean {
  return !!plan.approval && !isPlanStale(plan) && plan.approval.fingerprint === planSignature(plan);
}
export function archiveApproved(plan: GeneratedMealPlan): GeneratedMealPlan['history'] {
  if (!plan.approval) return plan.history;
  const { history, ...snapshot } = plan;
  return [...(history ?? []), snapshot];
}
export function invalidatePlan(plan: GeneratedMealPlan): GeneratedMealPlan {
  return validatePlan({ ...plan, stale: true, history: archiveApproved(plan), approval: undefined });
}
export function validatePlan(plan: GeneratedMealPlan): GeneratedMealPlan {
  const issues: PlanIssue[] = [];
  let review = false;
  const add = (code: string, en: string, sw: string, needsReview = false) => { issues.push({ code, message_en: en, message_sw: sw }); review ||= needsReview; };
  const input = plan.inputSnapshot, assessment = plan.assessment;
  const totals = sumNutrients(plan.meals.flatMap((m) => m.items));
  if (!assessment || !input) add('assessment_missing', 'Assessment unavailable. Complete screening before clinical use.', 'Tathmini haipatikani. Kamilisha uchunguzi kabla ya matumizi.', true);
  if (input && (input.age < 18 || input.age > 120 || input.weightKg <= 0 || input.heightCm <= 0)) add('outside_scope', 'Adult clinical assessment required.', 'Tathmini ya kitabibu ya mtu mzima inahitajika.', true);
  if (assessment) {
    const screens = [assessment.allergyScreen, assessment.pregnancyOrBreastfeeding, assessment.significantWeightLoss, assessment.specialistCondition];
    if (screens.some((v) => v !== 'no')) add('screening_review', 'Incomplete or positive screening requires clinician review; allergy safety is not established.', 'Uchunguzi haujakamilika au una tahadhari; uhakiki wa mtaalamu unahitajika.', true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(assessment.measurementDate) || !Number.isFinite(Date.parse(assessment.measurementDate)) || new Date(assessment.measurementDate).toISOString().slice(0,10) !== assessment.measurementDate || assessment.measurementDate > new Date().toISOString().slice(0,10)) add('measurement_date', 'Record a valid measurement date.', 'Rekodi tarehe sahihi ya vipimo.', true);
    if (assessment.adjustedTargets && Object.keys(assessment.adjustedTargets).length && !assessment.targetAdjustmentReason?.trim()) add('adjustment_reason', 'Document the reason for adjusted targets.', 'Rekodi sababu ya kubadili malengo.', true);
  }
  if (plan.targets.tdee <= 1200) add('low_energy_review','Energy target is 1,200 kcal/day or lower. Individual clinical review and nutritional supervision are required.','Lengo ni kcal 1,200 au chini kwa siku. Uhakiki binafsi na usimamizi wa lishe unahitajika.',true);
  const bmi = input ? input.weightKg / Math.pow(input.heightCm / 100, 2) : plan.bmi;
  if (bmi != null && bmi >= 40) add('measurement_review','BMI is 40 or above. Confirm weight/height and arrange individualized review; the nutrition-risk label is not a full clinical risk assessment.','BMI ni 40 au zaidi. Thibitisha uzito/urefu na tathmini binafsi; lebo ya hatari ya lishe si tathmini kamili.',true);
  if (assessment?.adjustedTargets && Object.keys(assessment.adjustedTargets).length) {
    const energy = plan.targets.proteinG*4 + plan.targets.carbsG*4 + plan.targets.fatG*9;
    if (Math.abs(energy-plan.targets.tdee) > Math.max(50,plan.targets.tdee*.05)) add('macro_target_mismatch','Adjusted macronutrient energy does not agree with the calorie target. Review the targets.','Nishati ya malengo ya protini, wanga na mafuta hailingani na kalori. Hakiki malengo.');
  }
  const dx = normalizeConditionList(plan.conditions ?? []);
  if (!dx.some(c => ['DM','HTN'].includes(c)) || dx.some(c => !['DM','HTN','Obesity','Dyslipid'].includes(canonicalizeCondition(c)))) add('specialist_review', 'Conditions outside routine adult DM/HTN planning require specialist review.', 'Hali nje ya mpango wa kawaida wa kisukari/presha zinahitaji uhakiki wa mtaalamu.', true);
  if (!['Breakfast','Lunch','Dinner'].every(type => plan.meals.some(m => m.mealType === type && m.items.some(i => !i.ingredient)))) add('empty_meal', 'One or more main meals could not be filled. Expand available food choices.', 'Baadhi ya milo haijakamilika. Ongeza vyakula vinavyopatikana.');
  for (const item of plan.meals.flatMap((m) => m.items)) {
    if (assessment?.excludedFoodIds.includes(item.foodId) || (assessment?.availableFoodIds && !assessment.availableFoodIds.includes(item.foodId))) add('excluded_food', 'A selected food is excluded or unavailable.', 'Chakula kilichochaguliwa kimezuiwa au hakipatikani.', true);
    if (evalFoodForPatient(item.foodId, item.preparation, [...(plan.conditions ?? []), ...(plan.inputSnapshot?.medicationIds ?? [])]).severity !== 'Safe') add('food_review', `${item.name_en}: food/preparation requires review.`, `${item.name_sw}: chakula/maandalizi yanahitaji uhakiki.`, true);
  }
  if (Math.abs(totals.calories - plan.targets.tdee) > plan.targets.tdee * NUTRITION_POLICY.calorieTolerance) add('energy_target', `Energy: ${totals.calories} / ${plan.targets.tdee} kcal; outside ±10%.`, `Nishati: ${totals.calories} / ${plan.targets.tdee} kcal; nje ya ±10%.`);
  if (Math.abs(totals.protein - plan.targets.proteinG) > plan.targets.proteinG * NUTRITION_POLICY.proteinTolerance) add('protein_target', `Protein: ${totals.protein} / ${plan.targets.proteinG}g; outside ±20%.`, `Protini: ${totals.protein} / ${plan.targets.proteinG}g; nje ya ±20%.`);
  if (Math.abs(totals.carbs - plan.targets.carbsG) > plan.targets.carbsG * NUTRITION_POLICY.carbohydrateTolerance) add('carbohydrate_target', `Carbohydrates: ${totals.carbs} / ${plan.targets.carbsG}g; outside selected target tolerance.`, `Wanga: ${totals.carbs} / ${plan.targets.carbsG}g; nje ya kiwango cha lengo.`);
  if (Math.abs(totals.fat - plan.targets.fatG) > plan.targets.fatG * NUTRITION_POLICY.fatTolerance) add('fat_target', `Fat: ${totals.fat} / ${plan.targets.fatG}g; outside selected target tolerance.`, `Mafuta: ${totals.fat} / ${plan.targets.fatG}g; nje ya kiwango cha lengo.`);
  if (totals.sodiumMg == null || totals.fiberG == null) add('missing_nutrients', 'Sodium or fibre is unknown, not zero.', 'Sodiamu au nyuzinyuzi hazijulikani; si sifuri.');
  if (totals.sodiumMg != null && totals.sodiumMg > plan.targets.sodiumMg) add('sodium_limit', `Sodium exceeds ${plan.targets.sodiumMg}mg/day.`, `Sodiamu imezidi ${plan.targets.sodiumMg}mg/siku.`);
  if (totals.fiberG != null && totals.fiberG < plan.targets.fiberG) add('fiber_target', `Fibre below ${plan.targets.fiberG}g/day.`, `Nyuzinyuzi ziko chini ya ${plan.targets.fiberG}g/siku.`);
  if (Object.values(plan.targets).some(v => !Number.isFinite(v) || v <= 0) || Object.entries(totals).some(([key,v]) => !['sodiumMg','fiberG'].includes(key) && (!Number.isFinite(v) || Number(v) < 0))
    || plan.meals.flatMap(m=>m.items).some(i=>!Number.isFinite(i.grams) || Number(i.grams)<=0)) add('invalid_nutrients','Invalid quantities or targets prevent completeness.','Vipimo au malengo si sahihi.');
  const familyGrams=new Map<string,number>();
  for(const meal of plan.meals){
    let starches=0;
    for(const item of meal.items){
      if(item.ingredient)continue;
      const food=findFood(item.foodId);if(!food)continue;
      if(isMealStarch(food))starches++;
      const family=foodFamily(food),grams=(familyGrams.get(family)??0)+Number(item.grams);
      familyGrams.set(family,grams);
      if(grams>dailyFoodBudget(food))add('daily_variety','Repeated food exceeds the routine daily planning budget; adjust or review.','Chakula kilichorudiwa kimezidi kiasi cha kawaida cha mpango; rekebisha au hakiki.');
    }
    if(starches>1)add('multiple_starches','Use one main starch in each routine meal.','Tumia chakula kikuu kimoja cha wanga katika kila mlo.');
  }
  const stale = isPlanStale(plan);
  if (stale) add('stale', 'Inputs or clinical datasets changed. Regenerate and review.', 'Taarifa au data zimebadilika. Tengeneza tena na uhakiki.', true);
  return { ...plan, stale, totals, meals: plan.meals.map((m) => ({ ...m, totalCalories: sumNutrients(m.items).calories })), validation: {
    status: review ? 'needs_review' : issues.length ? 'incomplete' : 'complete', issues,
    assumptions: planAssumptions(plan, plan.language),
  } };
}
export function editPlanItem(plan: GeneratedMealPlan, mealIndex: number, itemIndex: number, foodId: string, multiplier: number, prep: string): GeneratedMealPlan {
  if (!plan.inputSnapshot || !plan.assessment) throw new Error('Legacy plans must be regenerated before editing.');
  const food = getFoodsForZone(plan.region).find((f) => f.id === foodId);
  const meal = plan.meals[mealIndex];
  if (!food || !meal || !meal.items[itemIndex] || meal.items[itemIndex].ingredient) throw new Error('Select an assessed regional food. Edit cooking ingredients in the assessment.');
  if (evalFoodForPatient(foodId, prep, [...(plan.conditions ?? []), ...(plan.inputSnapshot?.medicationIds ?? [])]).severity !== 'Safe' || plan.assessment.excludedFoodIds.includes(foodId)
    || (plan.assessment.availableFoodIds && !plan.assessment.availableFoodIds.includes(foodId))) throw new Error('Food or preparation is restricted, unavailable, or not assessed.');
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error('Portion must be a positive number.');
  const rounded = roundPortion(food, multiplier);
  if (rounded > getPracticalPortionLimit(food, meal.mealType)) throw new Error('Portion exceeds the practical meal limit.');
  const meals = plan.meals.map((m, mi) => ({ ...m, items: m.items.map((item, ii) => mi === mealIndex && ii === itemIndex ? makeMealItem(food, rounded, plan.language, prep) : item) }));
  return validatePlan({ ...plan, meals, history: archiveApproved(plan), approval: undefined });
}
export function approvePlan(plan: GeneratedMealPlan, actor: Omit<NutritionApproval, 'fingerprint' | 'approvedAt'>): GeneratedMealPlan {
  const checked = validatePlan(plan);
  if (checked.validation?.status !== 'complete' || checked.stale || !actor.note.trim() || !actor.accountId) throw new Error('Resolve all issues and document clinical review before approval.');
  return { ...checked, approval: { ...actor, approvedAt: new Date().toISOString(), fingerprint: planSignature(checked) } };
}
export function planStatusText(plan: GeneratedMealPlan, language: 'en' | 'sw'): string {
  const sw = language === 'sw';
  if (!plan.schemaVersion) return sw ? 'Tathmini haipatikani — mpango wa zamani, haujahakikiwa' : 'Assessment unavailable — legacy plan, unreviewed';
  const status = isPlanStale(plan) ? (sw ? 'Umepitwa na taarifa' : 'STALE') : plan.validation?.status === 'complete' ? (sw ? 'Umekamilika kwa hesabu' : 'Computationally complete') : plan.validation?.status === 'incomplete' ? (sw ? 'HAUJAKAMILIKA' : 'INCOMPLETE') : (sw ? 'UNAHITAJI UHAKIKI' : 'NEEDS REVIEW');
  return status + ' · ' + (approvalIsCurrent(plan) ? (sw ? 'Umeidhinishwa na mtaalamu' : 'Clinician approved') : (sw ? 'HAUJAIDHINISHWA' : 'UNREVIEWED'));
}

export function findFood(id: string): FoodItem | undefined { return getFoodsSync().find((f) => f.id === id); }

export function planNutritionText(plan: GeneratedMealPlan, language: 'en' | 'sw'): string {
  const n=plan.totals ?? sumNutrients(plan.meals.flatMap(m=>m.items)), t=plan.targets, sw=language==='sw';
  const unknown=sw?'Haijulikani':'Unknown';
  return [
    (sw?'Nishati':'Energy')+': '+n.calories+' / '+t.tdee+' kcal',
    (sw?'Protini':'Protein')+': '+n.protein+' / '+t.proteinG+' g',
    (sw?'Wanga':'Carbohydrates')+': '+n.carbs+' / '+t.carbsG+' g',
    (sw?'Mafuta':'Fat')+': '+n.fat+' / '+t.fatG+' g',
    (sw?'Sodiamu (kikomo)':'Sodium (limit)')+': '+(n.sodiumMg ?? unknown)+' / '+t.sodiumMg+' mg',
    (sw?'Nyuzinyuzi':'Fibre')+': '+(n.fiberG ?? unknown)+' / '+t.fiberG+' g',
  ].join(' | ');
}

export function planAssumptions(plan: GeneratedMealPlan, language: 'en' | 'sw'): string[] {
  const sw=language==='sw', a=plan.assessment;
  return [
    sw ? 'Makadirio ya watu wazima: BMR ya Mifflin-St Jeor mara kiwango cha shughuli + nyongeza ya kazi 100 kcal; mabadiliko ya hali/lengo hutumika.' : 'Provisional adult estimate: Mifflin-St Jeor BMR multiplied by activity multiplier + 100 kcal work allowance, then condition/body-goal adjustments.',
    (sw ? 'BMR ya makadirio: ' : 'Estimated BMR: ')+plan.targets.bmr+' kcal; '+(sw ? 'shughuli: ' : 'activity: ')+(sw ? ({Sedentary:'Kukaa zaidi',Light:'Nyepesi',Moderate:'Wastani',Active:'Hai','Very Active':'Hai sana'}[a?.activityLevel ?? 'Moderate']) : a?.activityLevel ?? '?')+'; '+(sw ? 'lengo: ' : 'goal: ')+(sw ? ({maintain:'Dumisha uzito',lose_weight:'Punguza uzito',gain_muscle:'Ongeza misuli'}[a?.bodyGoal ?? 'maintain']) : a?.bodyGoal ?? '?'),
    sw ? 'Ukamilifu wa hesabu hauchukui nafasi ya idhini ya kitabibu.' : 'Software completeness is separate from clinical approval.',
    sw ? 'Sera na vyanzo vya data vinasubiri uhakiki wa mtaalamu wa eneo.' : 'Clinical policy and original food-composition sources await local review.',
    sw ? 'Viungo vilivyorekodiwa pekee vimehesabiwa.' : 'Recorded ingredients only; unrecorded cooking additions are not included.',
    ...(a?.targetAdjustmentReason ? [(sw ? 'Sababu ya kubadili malengo: ' : 'Target adjustment reason: ')+a.targetAdjustmentReason] : []),
  ];
}
