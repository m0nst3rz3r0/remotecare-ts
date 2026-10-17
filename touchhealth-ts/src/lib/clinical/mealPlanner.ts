// RCRO NutritionTool - offline meal plan generator

import { getFoodsForZone, getZonePresets, getClinicalDataState, isFoodsReady } from './dataLoader';
import { calculateBMI } from './calculators';
import { normalizeConditionList } from './conditions';
import { getDrugFoodInteractions } from './drugInteractions';
import { evalFoodForPatient, getAvoidFoods, getRecommendedFoods, getFoodGuidance } from './foodSafety';
import { getMealTemplates, STARCH_EGG_INCOMPATIBLE, type MealBlueprint } from './mealTemplates';
import { computeFoodMacros, getPracticalPortionLimit } from './mealPortions';
import { computeNutritionTargets, getNutritionRiskLevel } from './nutritionEngine';
import { makeMealItem, validatePlan, inputFingerprint, findFood } from './planValidation';
import { balanceDailyMeals } from './dailyBalancer';
import { defaultNutritionAssessment, NUTRITION_POLICY, NUTRITION_DATA_METADATA } from './nutritionPolicy';
import { randomUUID } from '../../utils/id';
import type { NutritionAssessment, NutritionInputs } from './types';
import type { PrepMethod } from './mealLocalization';
import type { DailyMeal, FoodItem, GeneratedMealPlan, MealItem, NutritionTargets, TZRegion } from './types';

/** Not meal staples - condiments, sweeteners, etc. */
const BLOCKED_MEAL_STARCH_IDS = new Set([
  'food_118', // white sugar
  'food_119', // iodized salt
]);

const DIAGNOSIS_CODES = new Set(['DM', 'HTN', 'CKD', 'HF', 'PUD', 'HIV', 'TB']);

type ResolvedMealItem = {
  food: FoodItem;
  portion: number;
  prep: PrepMethod;
  slotFoodIds: string[];
};

function foodLabel(f: FoodItem): string {
  return `${f.name_en} ${f.name_sw}`.toLowerCase();
}

/** True staple starches suitable as a meal base (not sugar, salt, snacks). */
export function isMealStarch(f: FoodItem): boolean {
  if (BLOCKED_MEAL_STARCH_IDS.has(f.id)) return false;

  const cats = Array.isArray(f.category) ? f.category : [f.category];
  if (!cats.includes('carb')) return false;

  const name = foodLabel(f);
  if (/sugar|sukari|asali|honey|syrup|soda|cola|biscuit|biskuti|mandazi|vitumbua|mkate mweupe|white bread/i.test(name)) {
    return false;
  }
  if (/\bsalt\b|chumvi/i.test(name) && !/fish|samaki/i.test(name)) return false;

  if (f.serving && f.serving.grams_per_unit < 25 && (f.macros_per_100g.carbs_g ?? 0) > 85) {
    return false;
  }

  return true;
}

function prepToEval(prep: PrepMethod): string {
  const map: Record<PrepMethod, string> = {
    boiled: 'Boiled',
    steamed: 'Steamed',
    raw: 'Raw',
    grilled: 'Grilled',
  };
  return map[prep] ?? 'Boiled';
}

function isFruitFood(f: FoodItem): boolean {
  const cats = Array.isArray(f.category) ? f.category : [f.category];
  return cats.includes('fruit');
}

function isProteinFood(food: FoodItem): boolean {
  const cats = Array.isArray(food.category) ? food.category : [food.category];
  return cats.includes('protein');
}

function sortZoneCandidates(a: FoodItem, b: FoodItem, coreIds: Set<string>): number {
  return (coreIds.has(a.id) ? 0 : 1) - (coreIds.has(b.id) ? 0 : 1);
}

function resolveBlueprintSlot(
  foodIds: string[],
  prep: PrepMethod,
  conditions: string[],
  zone: TZRegion,
  availableFoodIds?: Set<string>,
  excludeFoodIds: Set<string> = new Set(),
): FoodItem | undefined {
  const foods = getFoodsForZone(zone);
  const coreIds = new Set(getZonePresets()[zone]?.coreStaples ?? []);
  const excludeIds = new Set(getZonePresets()[zone]?.excludeIds ?? []);
  const prepLabel = prepToEval(prep);

  const candidates = foodIds
    .map(id => foods.find(f => f.id === id))
    .filter((f): f is FoodItem => {
      if (!f) return false;
      if (excludeIds.has(f.id) || excludeFoodIds.has(f.id)) return false;
      if (availableFoodIds && !availableFoodIds.has(f.id)) return false;
      return true;
    })
    .sort((a, b) => sortZoneCandidates(a, b, coreIds));

  return candidates.find(f => evalFoodForPatient(f.id, prepLabel, conditions).severity === 'Safe');
}

function findFallbackProtein(
  conditions: string[],
  zone: TZRegion,
  availableFoodIds?: Set<string>,
  excludeFoodIds: Set<string> = new Set(),
): FoodItem | undefined {
  const foods = getFoodsForZone(zone);
  const coreIds = new Set(getZonePresets()[zone]?.coreStaples ?? []);

  return foods
    .filter(food => {
      if (!isProteinFood(food)) return false;
      if (excludeFoodIds.has(food.id)) return false;
      if (availableFoodIds && !availableFoodIds.has(food.id)) return false;
      return evalFoodForPatient(food.id, 'Boiled', conditions).severity === 'Safe';
    })
    .sort((a, b) => sortZoneCandidates(a, b, coreIds))[0];
}

function mealHasIncompatibleStarchEgg(items: ResolvedMealItem[]): boolean {
  const ids = new Set(items.map(i => i.food.id));
  if (!ids.has('food_051')) return false;
  return [...ids].some(id => STARCH_EGG_INCOMPATIBLE.has(id));
}

function repairIncompatibleEggMeals(
  resolved: ResolvedMealItem[],
  conditions: string[],
  zone: TZRegion,
  availableFoodIds?: Set<string>,
): ResolvedMealItem[] {
  if (!mealHasIncompatibleStarchEgg(resolved)) return resolved;

  const usedIds = new Set(resolved.map(item => item.food.id));

  return resolved.flatMap(item => {
    if (item.food.id !== 'food_051') return [item];

    const replacement = resolveBlueprintSlot(
      item.slotFoodIds.filter(id => id !== 'food_051'),
      item.prep,
      conditions,
      zone,
      availableFoodIds,
      usedIds,
    ) ?? findFallbackProtein(conditions, zone, availableFoodIds, new Set([...usedIds, 'food_051']));

    if (!replacement) return [];
    usedIds.add(replacement.id);
    return [{ ...item, food: replacement }];
  });
}

function scalePortion(portion: number, ratio: number, maxPortion: number): number {
  return Math.max(0.5, Math.min(maxPortion, portion * ratio));
}

function rebalanceMealPortions(
  resolved: ResolvedMealItem[],
  mealType: 'Breakfast' | 'Lunch' | 'Dinner',
  mealTargetCalories: number,
): ResolvedMealItem[] {
  if (resolved.length === 0) return resolved;

  let scaled = resolved.map(item => ({ ...item }));
  const starchIdx = scaled.findIndex(item => isMealStarch(item.food));
  const currentKcal = scaled.reduce((sum, item) => sum + computeFoodMacros(item.food, item.portion).calories, 0);
  const primaryRatio = mealTargetCalories / Math.max(currentKcal, 80);

  if (starchIdx >= 0 && primaryRatio >= 0.4 && primaryRatio <= 4.5) {
    const starchMax = getPracticalPortionLimit(scaled[starchIdx].food, mealType);
    scaled[starchIdx] = {
      ...scaled[starchIdx],
      portion: scalePortion(scaled[starchIdx].portion, primaryRatio, starchMax),
    };
  }

  const afterPrimaryKcal = scaled.reduce((sum, item) => sum + computeFoodMacros(item.food, item.portion).calories, 0);
  const finalRatio = mealTargetCalories / Math.max(afterPrimaryKcal, 80);

  if (finalRatio >= 0.7 && finalRatio <= 2.5) {
    scaled = scaled.map((item, idx) => ({
      ...item,
      portion: scalePortion(
        item.portion,
        starchIdx >= 0 && idx !== starchIdx ? Math.min(finalRatio, 1.25) : finalRatio,
        getPracticalPortionLimit(item.food, mealType),
      ),
    }));
  }

  return scaled;
}

function buildMealFromBlueprint(
  blueprint: MealBlueprint,
  conditions: string[],
  zone: TZRegion,
  targets: NutritionTargets,
  lang: 'en' | 'sw',
  availableFoodIds?: Set<string>,
): DailyMeal {
  const mealTargetCalories = Math.round(
    blueprint.mealType === 'Breakfast' ? targets.tdee * 0.3 :
    blueprint.mealType === 'Lunch' ? targets.tdee * 0.4 :
      targets.tdee * 0.3,
  );
  const normalizedConditions = normalizeConditionList(conditions);
  const shouldLimitDinnerFruit = normalizedConditions.some(code => code === 'DM' || code === 'Obesity');

  let resolved = blueprint.items
    .map(slot => {
      const food = resolveBlueprintSlot(slot.foodIds, slot.prep, conditions, zone, availableFoodIds);
      return food ? { food, portion: slot.portion, prep: slot.prep, slotFoodIds: slot.foodIds } : null;
    })
    .filter((item): item is ResolvedMealItem => item !== null);

  if (blueprint.mealType === 'Dinner' && shouldLimitDinnerFruit) {
    resolved = resolved.filter(item => !isFruitFood(item.food));
  }

  resolved = repairIncompatibleEggMeals(resolved, conditions, zone, availableFoodIds);
  resolved = rebalanceMealPortions(resolved, blueprint.mealType, mealTargetCalories);

  const items: MealItem[] = resolved.map(({ food, portion, prep }) => makeMealItem(food, portion, lang, prepToEval(prep)));

  const totalCalories = items.reduce((sum, item) => sum + item.macros.calories, 0);

  const mealNames: Record<'Breakfast' | 'Lunch' | 'Dinner', [string, string]> = {
    Breakfast: ['Breakfast', 'Kiamsha kinywa'],
    Lunch: ['Lunch', 'Chakula cha mchana'],
    Dinner: ['Dinner', 'Chakula cha jioni'],
  };

  return {
    mealType: blueprint.mealType,
    name_en: mealNames[blueprint.mealType][0],
    name_sw: mealNames[blueprint.mealType][1],
    items,
    totalCalories,
    culturalNote_en: blueprint.note_en,
    culturalNote_sw: blueprint.note_sw,
    culturalNote: lang === 'sw' ? blueprint.note_sw : blueprint.note_en,
  };
}

export function buildCautions(
  conditions: string[],
  lang: 'en' | 'sw',
  targets?: Pick<NutritionTargets, 'sodiumMg'>,
): string[] {
  const dx = normalizeConditionList(conditions);
  const L = (en: string, sw: string) => lang === 'en' ? en : sw;
  const cautions: string[] = [];
  const sodiumTarget = targets?.sodiumMg ?? (dx.some(d => /hf|heart failure|htn|hypertension/i.test(d)) ? 1500 : 2000);

  if (dx.some(d => /dm|diabetes/i.test(d))) cautions.push(L(
    'Diabetes: avoid sugary drinks; follow the planned carbohydrate portions and regular meal timing.',
    'Kisukari: epuka vinywaji vyenye sukari; fuata vipimo vya wanga na muda wa milo uliopangwa.',
  ));
  if (dx.some(d => /htn|hypertension/i.test(d))) cautions.push(L(
    `Hypertension: keep sodium under ${sodiumTarget}mg/day. Include cooking salt and processed foods in the daily sodium total.`,
    `Presha: weka sodiamu chini ya ${sodiumTarget}mg kwa siku. Hesabu chumvi ya kupikia na vyakula vilivyosindikwa katika jumla ya sodiamu.`,
  ));
  if (dx.some(d => /ckd|kidney/i.test(d))) cautions.push(L(
    'CKD: specialist assessment is required for protein, potassium and fluid targets. Routine DM/HTN estimates are not renal prescriptions.',
    'Ugonjwa sugu wa figo: mtaalamu athibitishe malengo ya protini, potasiamu na maji.',
  ));
  if (dx.some(d => /hf|heart failure/i.test(d))) cautions.push(L(
    'Heart failure: confirm individualized sodium and fluid advice with the treating clinician.',
    'Moyo kushindwa kufanya kazi: thibitisha ushauri binafsi wa sodiamu na maji na daktari.',
  ));
  if (dx.some(d => /pud|ulcer/i.test(d))) cautions.push(L(
    'Peptic ulcer: no universal special diet is recommended; identify individual symptom triggers and review ulcer treatment with your clinician.',
    'Kidonda cha tumbo: hakuna lishe maalum kwa wote; tambua vyakula vinavyochochea dalili na hakiki tiba na daktari.',
  ));

  return cautions;
}

export function generateMealPlan(params: {
  patientCode: string;
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  conditions: string[];
  zone: TZRegion;
  language: 'en' | 'sw';
  activityLevel?: string;
  bodyGoal?: 'lose_weight' | 'maintain' | 'gain_muscle';
  medicationIds: string[];
  medicationNames?: string[];
  availableFoodIds?: Set<string>;
  assessment?: NutritionAssessment;
}): GeneratedMealPlan {
  const {
    patientCode,
    age,
    sex,
    weightKg,
    heightCm,
    conditions,
    zone,
    language,
    activityLevel = 'Moderate',
    bodyGoal = 'maintain',
    medicationIds,
    availableFoodIds,
  } = params;

  if (!isFoodsReady()) throw new Error('Validated food and rule datasets are required. Retry nutrition loading.');
  const assessment: NutritionAssessment = { ...defaultNutritionAssessment(), ...params.assessment };
  if (availableFoodIds) assessment.availableFoodIds = [...availableFoodIds];
  if (!params.assessment) { assessment.activityLevel = activityLevel as NutritionAssessment['activityLevel']; assessment.bodyGoal = bodyGoal; }
  const selectedFoodIds = assessment.availableFoodIds ? new Set(assessment.availableFoodIds.filter((id) => !assessment.excludedFoodIds.includes(id)))
    : new Set(getFoodsForZone(zone).map((f) => f.id).filter((id) => !assessment.excludedFoodIds.includes(id)));
  const inputs: NutritionInputs = { age, sex, weightKg, heightCm, conditions, medicationIds, medicationNames: params.medicationNames, zone, assessment };
  const targets = computeNutritionTargets({
    age,
    sex,
    weightKg,
    heightCm,
    activityLevel: assessment.activityLevel,
    diagnoses: conditions,
    bodyGoal: assessment.bodyGoal,
  });

  for (const [key, value] of Object.entries(assessment.adjustedTargets ?? {})) {
    if (!Number.isFinite(value) || value <= 0) throw new Error('Adjusted nutrient targets must be positive numbers.');
    if (['tdee','proteinG','carbsG','fatG','sodiumMg','fiberG'].includes(key)) (targets as unknown as Record<string, number>)[key] = value;
  }
  const foodConditions = [...conditions, ...medicationIds];
  const templates = getMealTemplates(zone);
  const meals: DailyMeal[] = templates.map(blueprint =>
    buildMealFromBlueprint(blueprint, foodConditions, zone, targets, language, selectedFoodIds),
  );

  const normalizedConditions = normalizeConditionList(conditions);
  const bmi = calculateBMI(weightKg, heightCm);
  const nutritionRisk = getNutritionRiskLevel(normalizedConditions, bmi, targets.sodiumMg);
  const drugAlerts = getDrugFoodInteractions(medicationIds, params.medicationNames);
  const avoidFoods = getAvoidFoods(foodConditions, zone);
  const recommendedFoods = getRecommendedFoods(foodConditions, zone, selectedFoodIds, assessment.excludedFoodIds);
  const cautions = buildCautions(conditions, language, targets);

  for (const addition of assessment.cookingIngredients) {
    const food = findFood(addition.foodId), meal = meals.find((m) => m.mealType === addition.mealType);
    if (!food || !meal || !Number.isFinite(addition.grams) || addition.grams <= 0 || addition.grams > 1000) throw new Error('Invalid cooking ingredient or grams.');
    meal.items.push(makeMealItem(food, 1, language, 'raw', Math.round(addition.grams * 10) / 10));
  }
  const plan: GeneratedMealPlan = {
    datasetMetadata: NUTRITION_DATA_METADATA,
    schemaVersion: 2, id: randomUUID(), datasetVersion: getClinicalDataState().version, policyVersion: NUTRITION_POLICY.version,
    assessment, inputSnapshot: inputs, inputFingerprint: inputFingerprint(inputs),
    patientCode,
    date: new Date().toISOString().split('T')[0],
    diagnosis: normalizedConditions.filter(code => DIAGNOSIS_CODES.has(code)).join(', '),
    conditions,
    region: zone,
    language,
    targets,
    bmi,
    nutritionRisk,
    meals,
    drugAlerts,
    cautions,
    avoidFoods,
    foodGuidance: getFoodGuidance(foodConditions, zone, meals.flatMap(m=>m.items.map(i=>i.foodId))),
    recommendedFoods,
    generatedAt: new Date().toISOString(),
  };
  plan.meals = balanceDailyMeals(plan);
  return validatePlan(plan);
}
