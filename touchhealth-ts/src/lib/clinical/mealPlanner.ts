// RCRO NutritionTool - offline meal plan generator

import { getFoodsForZone, getZonePresets } from './dataLoader';
import { normalizeConditionList } from './conditions';
import { getDrugFoodInteractions } from './drugInteractions';
import { evalFoodForPatient, getAvoidFoods, getRecommendedFoods } from './foodSafety';
import { getMealTemplates, STARCH_EGG_INCOMPATIBLE, type MealBlueprint } from './mealTemplates';
import { computeFoodMacros, formatMealPortion, getPracticalPortionLimit } from './mealPortions';
import { computeNutritionTargets } from './nutritionEngine';
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

  const items: MealItem[] = resolved.map(({ food, portion, prep }) => ({
    foodId: food.id,
    name_en: food.name_en,
    name_sw: food.name_sw,
    portionText: formatMealPortion(food, portion, lang),
    preparation: prepToEval(prep),
    prepMethod: prep,
    portionMultiplier: portion,
    macros: computeFoodMacros(food, portion),
  }));

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
    'Diabetes: avoid sugary drinks, limit starch to one fist per meal, choose low-GI foods.',
    'Kisukari: epuka vinywaji vyenye sukari, punguza wanga hadi ngumi moja kwa mlo, chagua vyakula vya GI ya chini.',
  ));
  if (dx.some(d => /htn|hypertension/i.test(d))) cautions.push(L(
    `Hypertension: keep sodium under ${sodiumTarget}mg/day. Avoid salty processed foods and excess coconut milk.`,
    `Presha: weka sodiamu chini ya ${sodiumTarget}mg kwa siku. Epuka vyakula vilivyosindikwa vyenye chumvi na maziwa mengi ya nazi.`,
  ));
  if (dx.some(d => /ckd|kidney/i.test(d))) cautions.push(L(
    'CKD: limit protein and potassium. Confirm fluid limits with your renal team.',
    'Figozisugua: punguza protini na potasiamu. Thibitisha vipimo vya maji na daktari wa figo.',
  ));
  if (dx.some(d => /hf|heart failure/i.test(d))) cautions.push(L(
    'Heart failure: strict salt and fluid restriction. Check with your cardiologist.',
    'Shindwa la moyo: zuia chumvi na maji kwa ukakamavu. Wasiliana na daktari wa moyo.',
  ));
  if (dx.some(d => /pud|ulcer/i.test(d))) cautions.push(L(
    'Peptic ulcer: avoid spicy, fried, acidic, and gas-forming foods. No NSAIDs on empty stomach.',
    'Kidonda cha tumbo: epuka vyakula vyenye pilipili, vya kukaanga, tindikali, au vinavyosababisha gesi.',
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
  availableFoodIds?: Set<string>;
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

  const targets = computeNutritionTargets({
    age,
    sex,
    weightKg,
    heightCm,
    activityLevel,
    diagnoses: conditions,
    bodyGoal,
  });

  const templates = getMealTemplates(zone);
  const meals: DailyMeal[] = templates.map(blueprint =>
    buildMealFromBlueprint(blueprint, conditions, zone, targets, language, availableFoodIds),
  );

  const normalizedConditions = normalizeConditionList(conditions);
  const drugAlerts = getDrugFoodInteractions(medicationIds);
  const avoidFoods = getAvoidFoods(conditions, zone);
  const recommendedFoods = getRecommendedFoods(conditions, zone);
  const cautions = buildCautions(conditions, language, targets);

  return {
    patientCode,
    date: new Date().toISOString().split('T')[0],
    diagnosis: normalizedConditions.filter(code => DIAGNOSIS_CODES.has(code)).join(', '),
    conditions,
    region: zone,
    language,
    targets,
    meals,
    drugAlerts,
    cautions,
    avoidFoods,
    recommendedFoods,
    generatedAt: new Date().toISOString(),
  };
}
