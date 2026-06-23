// RCRO NutritionTool — offline meal plan generator

import { getFoodsForZone, getZonePresets } from './dataLoader';
import { normalizeConditionList } from './conditions';
import { computeNutritionTargets } from './nutritionEngine';
import { evalFoodForPatient } from './foodSafety';
import { getDrugFoodInteractions } from './drugInteractions';
import { getAvoidFoods, getRecommendedFoods } from './foodSafety';
import { getMealTemplates, STARCH_EGG_INCOMPATIBLE, type MealBlueprint } from './mealTemplates';
import type { PrepMethod } from './mealLocalization';
import type { DailyMeal, MealItem, GeneratedMealPlan, TZRegion, NutritionTargets, FoodItem } from './types';

/** Not meal staples — condiments, sweeteners, etc. */
const BLOCKED_MEAL_STARCH_IDS = new Set([
  'food_118', // white sugar
  'food_119', // iodized salt
]);

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

  // Teaspoon-sized servings with almost pure sugar/carbs are not meal bases
  if (f.serving && f.serving.grams_per_unit < 25 && (f.macros_per_100g.carbs_g ?? 0) > 85) {
    return false;
  }

  return true;
}

function servingGrams(food: FoodItem, portionMultiplier: number): number {
  const gramsPerUnit = food.serving?.grams_per_unit ?? 100;
  const defaultUnits = food.serving?.default_units ?? 1;
  return gramsPerUnit * defaultUnits * portionMultiplier;
}

function getPortionText(food: FoodItem, portionMultiplier: number, lang: 'en' | 'sw'): string {
  if (food.serving) {
    const rawUnits = food.serving.default_units * portionMultiplier;
    const units = Math.min(3, Math.round(rawUnits * 2) / 2);
    const unit = lang === 'sw' ? food.serving.unit_sw : food.serving.unit_en;
    return `${units} ${unit}`;
  }
  const grams = Math.round(Math.min(350, 100 * portionMultiplier));
  return `${grams}g`;
}

function computeFoodMacros(food: FoodItem, portionMultiplier: number) {
  const m = food.macros_per_100g;
  const factor = servingGrams(food, portionMultiplier) / 100;
  return {
    calories: Math.round(m.calories * factor),
    protein:  Math.round((m.protein_g ?? 0) * factor * 10) / 10,
    carbs:    Math.round((m.carbs_g ?? 0) * factor * 10) / 10,
    fat:      Math.round((m.fat_g ?? 0) * factor * 10) / 10,
  };
}

function prepToEval(prep: PrepMethod): string {
  const map: Record<PrepMethod, string> = {
    boiled: 'Boiled', steamed: 'Steamed', raw: 'Raw', grilled: 'Grilled',
  };
  return map[prep] ?? 'Boiled';
}

function isFruitFood(f: FoodItem): boolean {
  const cats = Array.isArray(f.category) ? f.category : [f.category];
  return cats.includes('fruit');
}

function resolveBlueprintSlot(
  foodIds: string[],
  prep: PrepMethod,
  conditions: string[],
  zone: TZRegion,
): FoodItem | undefined {
  const foods = getFoodsForZone(zone);
  const coreIds = new Set(getZonePresets()[zone]?.coreStaples ?? []);
  const excludeIds = new Set(getZonePresets()[zone]?.excludeIds ?? []);
  const prepLabel = prepToEval(prep);

  const candidates = foodIds
    .map(id => foods.find(f => f.id === id))
    .filter((f): f is FoodItem => !!f && !excludeIds.has(f.id))
    .sort((a, b) => (coreIds.has(a.id) ? 0 : 1) - (coreIds.has(b.id) ? 0 : 1));

  return candidates.find(f => evalFoodForPatient(f.id, prepLabel, conditions).severity === 'Safe');
}

function mealHasIncompatibleStarchEgg(items: { food: FoodItem }[]): boolean {
  const ids = new Set(items.map(i => i.food.id));
  if (!ids.has('food_051')) return false;
  return [...ids].some(id => STARCH_EGG_INCOMPATIBLE.has(id));
}

function buildMealFromBlueprint(
  blueprint: MealBlueprint,
  conditions: string[],
  zone: TZRegion,
  targets: NutritionTargets,
  lang: 'en' | 'sw',
): DailyMeal {
  const mealTargetCalories = Math.round(
    blueprint.mealType === 'Breakfast' ? targets.tdee * 0.3 :
    blueprint.mealType === 'Lunch'     ? targets.tdee * 0.4 :
                                         targets.tdee * 0.3
  );

  let resolved = blueprint.items
    .map(slot => {
      const food = resolveBlueprintSlot(slot.foodIds, slot.prep, conditions, zone);
      return food ? { food, portion: slot.portion, prep: slot.prep } : null;
    })
    .filter((r): r is { food: FoodItem; portion: number; prep: PrepMethod } => r !== null);

  if (blueprint.mealType === 'Dinner') {
    resolved = resolved.filter(r => !isFruitFood(r.food));
  }

  if (mealHasIncompatibleStarchEgg(resolved)) {
    resolved = resolved.filter(r => r.food.id !== 'food_051');
  }

  const starchIdx = resolved.findIndex(r => isMealStarch(r.food));
  if (starchIdx >= 0) {
    const currentKcal = resolved.reduce(
      (s, r) => s + computeFoodMacros(r.food, r.portion).calories, 0
    );
    const ratio = mealTargetCalories / Math.max(currentKcal, 80);
    // Allow up to 4.5× to handle low-density starches like taro/yam
    if (ratio >= 0.4 && ratio <= 4.5) {
      resolved[starchIdx].portion = Math.max(0.5, Math.min(4.0, resolved[starchIdx].portion * ratio));
    }
    // If starch scaling alone still leaves us well under target, scale all items proportionally
    const afterStarchKcal = resolved.reduce(
      (s, r) => s + computeFoodMacros(r.food, r.portion).calories, 0
    );
    const remaining = mealTargetCalories / Math.max(afterStarchKcal, 80);
    if (remaining > 1.25 && remaining <= 2.5) {
      resolved = resolved.map((r, idx) => idx === starchIdx ? r : {
        ...r,
        portion: Math.max(0.5, Math.min(3.0, r.portion * Math.min(remaining, 1.8))),
      });
    }
  }

  const items: MealItem[] = resolved.map(({ food, portion, prep }) => ({
    foodId: food.id,
    name_en: food.name_en,
    name_sw: food.name_sw,
    portionText: getPortionText(food, portion, lang),
    preparation: prepToEval(prep),
    prepMethod: prep,
    portionMultiplier: portion,
    macros: computeFoodMacros(food, portion),
  }));

  const totalCalories = items.reduce((s, i) => s + i.macros.calories, 0);

  const mealNames: Record<'Breakfast' | 'Lunch' | 'Dinner', [string, string]> = {
    Breakfast: ['Breakfast', 'Kiamsha kinywa'],
    Lunch:     ['Lunch', 'Chakula cha mchana'],
    Dinner:    ['Dinner', 'Chakula cha jioni'],
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

export function buildCautions(conditions: string[], lang: 'en' | 'sw'): string[] {
  const dx = normalizeConditionList(conditions);
  const L = (en: string, sw: string) => lang === 'en' ? en : sw;
  const cautions: string[] = [];

  if (dx.some(d => /dm|diabetes/i.test(d))) cautions.push(L(
    'Diabetes: avoid sugary drinks, limit starch to one fist per meal, choose low-GI foods.',
    'Kisukari: epuka vinywaji vyenye sukari, punguza wanga hadi ngumi moja kwa mlo, chagua vyakula vya GI ya chini.',
  ));
  if (dx.some(d => /htn|hypertension/i.test(d))) cautions.push(L(
    'Hypertension: keep salt under 5g/day. Avoid salty processed foods and excess coconut milk.',
    'Presha: weka chumvi chini ya gramu 5 kwa siku. Epuka vyakula vilivyosindikwa vyenye chumvi na maziwa mengi ya nazi.',
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
    patientCode, age, sex, weightKg, heightCm,
    conditions, zone, language,
    activityLevel = 'Moderate',
    bodyGoal = 'maintain',
    medicationIds,
  } = params;

  const targets = computeNutritionTargets({
    age, sex, weightKg, heightCm, activityLevel, diagnoses: conditions, bodyGoal,
  });

  const templates = getMealTemplates(zone);
  const meals: DailyMeal[] = templates.map(bp =>
    buildMealFromBlueprint(bp, conditions, zone, targets, language)
  );

  const drugAlerts = getDrugFoodInteractions(medicationIds);
  const avoidFoods = getAvoidFoods(conditions, zone);
  const recommendedFoods = getRecommendedFoods(conditions, zone);
  const cautions = buildCautions(conditions, language);

  return {
    patientCode,
    date: new Date().toISOString().split('T')[0],
    diagnosis: conditions.filter(c => ['DM', 'HTN', 'CKD', 'HF', 'PUD', 'HIV', 'TB'].includes(c)).join(', '),
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
