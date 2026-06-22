// RCRO NutritionTool — offline meal plan generator

import { getFoodsForZone, getZonePresets } from './dataLoader';
import { normalizeConditionList } from './conditions';
import { computeNutritionTargets } from './nutritionEngine';
import { evalFoodForPatient } from './foodSafety';
import { getDrugFoodInteractions } from './drugInteractions';
import { getAvoidFoods } from './foodSafety';
import type { DailyMeal, MealItem, GeneratedMealPlan, TZRegion, NutritionTargets, FoodItem } from './types';

/** Not meal staples — condiments, sweeteners, etc. */
const BLOCKED_MEAL_STARCH_IDS = new Set([
  'food_118', // white sugar
  'food_119', // iodized salt
]);

const BLOCKED_DM_STARCH_IDS = new Set(['food_130', 'food_132', 'food_001', 'food_002', 'food_021']);

function foodLabel(f: FoodItem): string {
  return `${f.name_en} ${f.name_sw}`.toLowerCase();
}

function giRank(gi: string): number {
  return ({ Low: 0, Medium: 1, High: 2 } as Record<string, number>)[gi] ?? 1;
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

export function proteinGroup(f: FoodItem): string {
  const name = foodLabel(f);
  if (/fish|samaki|dagaa|tilapia|sardine|sato/i.test(name)) return 'fish';
  if (/egg|yai/i.test(name)) return 'egg';
  if (/chicken|kuku/i.test(name)) return 'poultry';
  if (/bean|maharage|choroko|ndengu|mbaazi|pea|kunde|lentil/i.test(name)) return 'legume';
  if (/beef|nyama|goat|mbuzi/i.test(name)) return 'meat';
  return 'other';
}

function pickStarch(foods: FoodItem[], conditions: string[], zone: TZRegion): FoodItem[] {
  const coreIds = new Set(getZonePresets()[zone]?.coreStaples ?? []);
  const dx = normalizeConditionList(conditions);
  const hasDM = dx.some(d => /dm|diabetes/i.test(d));
  const hasHTN = dx.some(d => /htn|hypertension/i.test(d));

  return foods
    .filter(isMealStarch)
    .filter(f => {
      if (hasDM && BLOCKED_DM_STARCH_IDS.has(f.id)) return false;
      const result = evalFoodForPatient(f.id, 'Boiled', conditions);
      return result.severity === 'Safe';
    })
    .sort((a, b) => {
      const aCore = coreIds.has(a.id) ? 0 : 1;
      const bCore = coreIds.has(b.id) ? 0 : 1;
      if (aCore !== bCore) return aCore - bCore;

      if (hasDM || hasHTN) {
        const giDiff = giRank(a.glycemic_index) - giRank(b.glycemic_index);
        if (giDiff !== 0) return giDiff;
      }
      if (hasHTN) {
        const sodDiff = (a.macros_per_100g.sodium_mg ?? 0) - (b.macros_per_100g.sodium_mg ?? 0);
        if (sodDiff !== 0) return sodDiff;
      }
      return (b.macros_per_100g.fiber_g ?? 0) - (a.macros_per_100g.fiber_g ?? 0);
    });
}

function pickProtein(
  foods: FoodItem[],
  conditions: string[],
  usedGroups: Set<string>,
): FoodItem[] {
  const dx = normalizeConditionList(conditions);
  const hasCKD = dx.some(d => /ckd|kidney/i.test(d));
  const hasHTN = dx.some(d => /htn|hypertension/i.test(d));

  const groupPriority = (g: string): number => {
    if (usedGroups.has(g)) return 10;
    if (hasHTN) {
      if (g === 'fish') return 0;
      if (g === 'egg') return 1;
      if (g === 'poultry') return 2;
      if (g === 'legume') return 4;
      if (g === 'meat') return 5;
    }
    if (g === 'legume') return 3;
    return 2;
  };

  return foods
    .filter(f => {
      const cats = Array.isArray(f.category) ? f.category : [f.category];
      if (!cats.includes('protein')) return false;
      if (hasCKD && f.macros_per_100g.protein_g > 25) return false;
      const result = evalFoodForPatient(f.id, 'Boiled', conditions);
      return result.severity === 'Safe';
    })
    .sort((a, b) => {
      const gp = groupPriority(proteinGroup(a)) - groupPriority(proteinGroup(b));
      if (gp !== 0) return gp;
      return (a.macros_per_100g.sodium_mg ?? 0) - (b.macros_per_100g.sodium_mg ?? 0);
    });
}

function pickVegetable(foods: FoodItem[], conditions: string[]): FoodItem[] {
  const dx = normalizeConditionList(conditions);
  const hasCKD = dx.some(d => /ckd|kidney/i.test(d));

  return foods
    .filter(f => {
      const cats = Array.isArray(f.category) ? f.category : [f.category];
      if (!cats.some(c => c === 'vitamin' || c === 'vegetable')) return false;
      const result = evalFoodForPatient(f.id, 'Boiled', conditions);
      if (result.severity === 'Danger') return false;
      if (hasCKD && result.severity === 'Warning') return false;
      return true;
    })
    .sort((a, b) => (a.macros_per_100g.sodium_mg ?? 0) - (b.macros_per_100g.sodium_mg ?? 0));
}

function pickFruit(foods: FoodItem[], conditions: string[]): FoodItem[] {
  const dx = normalizeConditionList(conditions);
  const hasDM = dx.some(d => /dm|diabetes/i.test(d));

  return foods
    .filter(f => {
      const cats = Array.isArray(f.category) ? f.category : [f.category];
      if (!cats.includes('fruit')) return false;
      if (hasDM && f.glycemic_index === 'High') return false;
      const result = evalFoodForPatient(f.id, 'Raw', conditions);
      return result.severity === 'Safe';
    })
    .sort((a, b) => giRank(a.glycemic_index) - giRank(b.glycemic_index));
}

function pickFromPool(pool: FoodItem[], usedFoodIds: Set<string>): FoodItem | undefined {
  return pool.find(f => !usedFoodIds.has(f.id)) ?? pool[0];
}

function getPortionText(food: FoodItem, portionMultiplier: number, lang: 'en' | 'sw'): string {
  if (food.serving) {
    const units = Math.round(food.serving.default_units * portionMultiplier * 2) / 2;
    const unit = lang === 'sw' ? food.serving.unit_sw : food.serving.unit_en;
    return `${units} ${unit}`;
  }
  const grams = Math.round(100 * portionMultiplier);
  return `${grams}g`;
}

function computeFoodMacros(food: FoodItem, portionMultiplier: number) {
  const m = food.macros_per_100g;
  const factor = portionMultiplier;
  return {
    calories: Math.round(m.calories * factor),
    protein:  Math.round((m.protein_g ?? 0) * factor * 10) / 10,
    carbs:    Math.round((m.carbs_g ?? 0) * factor * 10) / 10,
    fat:      Math.round((m.fat_g ?? 0) * factor * 10) / 10,
  };
}

function buildMeal(
  mealType: 'Breakfast' | 'Lunch' | 'Dinner',
  conditions: string[],
  zone: TZRegion,
  targets: NutritionTargets,
  lang: 'en' | 'sw',
  usedFoodIds: Set<string>,
  usedProteinGroups: Set<string>,
): DailyMeal {
  const foods = getFoodsForZone(zone);
  const mealTargetCalories = Math.round(
    mealType === 'Breakfast' ? targets.tdee * 0.3 :
    mealType === 'Lunch'     ? targets.tdee * 0.4 :
                               targets.tdee * 0.3
  );

  const starches   = pickStarch(foods, conditions, zone);
  const proteins   = pickProtein(foods, conditions, usedProteinGroups);
  const vegetables = pickVegetable(foods, conditions);
  const fruits     = pickFruit(foods, conditions);

  const starch = pickFromPool(starches, usedFoodIds);
  const protein = pickFromPool(proteins, usedFoodIds);
  const veg = pickFromPool(vegetables, usedFoodIds);
  const fruit = (mealType !== 'Lunch') ? pickFromPool(fruits, usedFoodIds) : null;

  if (starch)  usedFoodIds.add(starch.id);
  if (protein) {
    usedFoodIds.add(protein.id);
    usedProteinGroups.add(proteinGroup(protein));
  }
  if (veg)     usedFoodIds.add(veg.id);
  if (fruit)   usedFoodIds.add(fruit.id);

  const items: MealItem[] = [];

  const add = (food: FoodItem | undefined | null, portion: number, prep: string) => {
    if (!food) return;
    const macros = computeFoodMacros(food, portion);
    items.push({
      foodId: food.id,
      name_en: food.name_en,
      name_sw: food.name_sw,
      portionText: getPortionText(food, portion, lang),
      preparation: prep,
      macros,
    });
  };

  const calPerUnit = starch
    ? (starch.macros_per_100g.calories * (starch.serving?.grams_per_unit ?? 100)) / 100
    : 200;
  const starchPortion = starch
    ? Math.max(0.5, Math.min(2.5, (mealTargetCalories * 0.45) / Math.max(calPerUnit, 50)))
    : 1;

  add(starch, starchPortion, 'Boiled');
  add(protein, 1.0, 'Boiled');
  add(veg, 1.0, 'Boiled');
  if (mealType !== 'Lunch') add(fruit, 1.0, 'Raw');

  const totalMacros = items.reduce(
    (acc, i) => ({
      calories: acc.calories + i.macros.calories,
      protein:  acc.protein  + i.macros.protein,
      carbs:    acc.carbs    + i.macros.carbs,
      fat:      acc.fat      + i.macros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const mealNames: Record<'Breakfast' | 'Lunch' | 'Dinner', [string, string]> = {
    Breakfast: ['Breakfast', 'Kiamsha kinywa'],
    Lunch:     ['Lunch', 'Chakula cha mchana'],
    Dinner:    ['Dinner', 'Chakula cha jioni'],
  };

  return {
    mealType,
    name_en: mealNames[mealType][0],
    name_sw: mealNames[mealType][1],
    items,
    totalCalories: totalMacros.calories,
  };
}

function buildCautions(conditions: string[], lang: 'en' | 'sw'): string[] {
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

  const usedFoodIds = new Set<string>();
  const usedProteinGroups = new Set<string>();
  const meals: DailyMeal[] = [
    buildMeal('Breakfast', conditions, zone, targets, language, usedFoodIds, usedProteinGroups),
    buildMeal('Lunch',     conditions, zone, targets, language, usedFoodIds, usedProteinGroups),
    buildMeal('Dinner',    conditions, zone, targets, language, usedFoodIds, usedProteinGroups),
  ];

  const drugAlerts = getDrugFoodInteractions(medicationIds);
  const avoidFoods = getAvoidFoods(conditions, zone);
  const cautions = buildCautions(conditions, language);

  return {
    patientCode,
    date: new Date().toISOString().split('T')[0],
    diagnosis: conditions.filter(c => ['DM', 'HTN', 'CKD', 'HF', 'PUD', 'HIV', 'TB'].includes(c)).join(', '),
    region: zone,
    language,
    targets,
    meals,
    drugAlerts,
    cautions,
    avoidFoods,
    generatedAt: new Date().toISOString(),
  };
}
