import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadZonePresets, setClinicalDataForTests } from './dataLoader';
import type { FoodItem, ClinicalRule } from './types';
import { isMealStarch, generateMealPlan, buildCautions } from './mealPlanner';
import { formatMealItemDetail, formatPortion } from './mealLocalization';
import zonePresets from '../../data/zoneAvailabilityPresets.json';

function loadJsonData() {
  const root = resolve(__dirname, '../../..');
  const foodsRaw = JSON.parse(readFileSync(resolve(root, 'public/foods.json'), 'utf8'));
  const rulesRaw = JSON.parse(readFileSync(resolve(root, 'public/rules.json'), 'utf8'));
  const foods: FoodItem[] = Array.isArray(foodsRaw) ? foodsRaw : foodsRaw.foods;
  const rules: ClinicalRule[] = Array.isArray(rulesRaw) ? rulesRaw : rulesRaw.rules;
  return { foods, rules };
}

describe('meal planner', () => {
  beforeAll(() => {
    const { foods, rules } = loadJsonData();
    setClinicalDataForTests(foods, rules);
    loadZonePresets(zonePresets as Record<string, import('./types').ZonePreset>);
  });

  it('excludes sugar as a meal starch', () => {
    const sugar: FoodItem = {
      id: 'food_118',
      name_en: 'Sugar (White)',
      name_sw: 'Sukari',
      category: 'carb',
      regions: ['All'],
      glycemic_index: 'High',
      macros_per_100g: { calories: 400, protein_g: 0, carbs_g: 100, fat_g: 0, sodium_mg: 0 },
      serving: { unit_en: 'teaspoon', unit_sw: 'kijiko kidogo', grams_per_unit: 4, default_units: 1 },
    };
    expect(isMealStarch(sugar)).toBe(false);
  });

  it('includes ugali as a meal starch', () => {
    const ugali: FoodItem = {
      id: 'food_014',
      name_en: 'Maize Ugali (Stiff Porridge)',
      name_sw: 'Ugali wa Mahindi',
      category: 'carb',
      regions: ['All'],
      glycemic_index: 'High',
      macros_per_100g: { calories: 105, protein_g: 2.5, carbs_g: 23, fat_g: 0.5, sodium_mg: 0, fiber_g: 1.2 },
      serving: { unit_en: 'fist', unit_sw: 'ngumi', grams_per_unit: 150, default_units: 1 },
    };
    expect(isMealStarch(ugali)).toBe(true);
  });

  it('HTN plan never includes sugar or fried rice in any meal', () => {
    const plan = generateMealPlan({
      patientCode: 'RC-001',
      age: 55,
      sex: 'female',
      weightKg: 65,
      heightCm: 162,
      conditions: ['HTN', 'I10'],
      zone: 'Lake Zone',
      language: 'sw',
      medicationIds: ['MED_CCB'],
    });

    const allItems = plan.meals.flatMap(m => m.items);
    expect(allItems.some(i => i.foodId === 'food_118')).toBe(false);
    expect(allItems.some(i => i.foodId === 'food_015')).toBe(false);
    expect(plan.meals.every(m => m.items.length >= 2)).toBe(true);
    const dayKcal = plan.meals.reduce((s, m) => s + m.totalCalories, 0);
    expect(dayKcal).toBeGreaterThan(plan.targets.tdee * 0.5);
    expect(allItems.some(i => i.foodId === 'food_264')).toBe(false);
  });

  it('Lake Zone HTN uses culturally appropriate meals in Kiswahili', () => {
    const plan = generateMealPlan({
      patientCode: 'KG-BK-ZMZ-F0014',
      age: 55,
      sex: 'female',
      weightKg: 65,
      heightCm: 162,
      conditions: ['HTN', 'I10'],
      zone: 'Lake Zone',
      language: 'sw',
      medicationIds: [],
    });

    const lunch = plan.meals.find(m => m.mealType === 'Lunch')!;
    const dinner = plan.meals.find(m => m.mealType === 'Dinner')!;
    const breakfast = plan.meals.find(m => m.mealType === 'Breakfast')!;

    expect(breakfast.items.some(i => /uji/i.test(i.name_sw))).toBe(true);
    expect(lunch.items.some(i => /ugali|wali/i.test(i.name_sw))).toBe(true);
    expect(lunch.items.some(i => /samaki/i.test(i.name_sw))).toBe(true);

    const dinnerIds = new Set(dinner.items.map(i => i.foodId));
    expect(dinnerIds.has('food_051')).toBe(false);
    expect(dinner.items.every(i => !/mapera|papaya|parachichi|tunda/i.test(i.name_sw))).toBe(true);

    for (const meal of plan.meals) {
      const ids = meal.items.map(i => i.foodId);
      const hasEgg = ids.includes('food_051');
      const hasPlantain = ids.includes('food_148');
      expect(!(hasEgg && hasPlantain)).toBe(true);
    }

    const swCautions = buildCautions(plan.conditions ?? ['HTN'], 'sw');
    expect(swCautions[0]).toMatch(/Presha|chumvi/i);
    expect(swCautions[0]).not.toMatch(/Hypertension/i);

    const detail = formatMealItemDetail(breakfast.items[0], 'sw');
    expect(detail).toMatch(/Imechemshwa|Mbichi/);
    expect(detail).not.toMatch(/Boiled|tea cup/i);
  });

  it('does not cap displayed portions below the actual planned multiplier', () => {
    const testFood: FoodItem = {
      id: 'demo_food',
      name_en: 'Demo Ugali',
      name_sw: 'Ugali wa Mfano',
      category: 'carb',
      regions: ['All'],
      glycemic_index: 'Medium',
      macros_per_100g: { calories: 120, protein_g: 2, carbs_g: 24, fat_g: 1, sodium_mg: 0 },
      serving: { unit_en: 'fist', unit_sw: 'ngumi', grams_per_unit: 150, default_units: 1 },
    };

    expect(formatPortion(testFood, 4, 'en')).toBe('4 fist');
    expect(formatPortion(testFood, 3.5, 'sw')).toBe('3.5 ngumi');
  });

  it('respects available-food filters when generating a plan', () => {
    const allowedIds = new Set([
      'food_006_uji',
      'food_019',
      'food_051',
      'food_096',
      'food_097',
      'food_016',
      'food_053',
      'food_056',
      'food_148',
      'food_028c',
      'food_030',
      'food_033',
      'food_107',
      'food_009',
      'food_014',
      'food_161',
    ]);

    const plan = generateMealPlan({
      patientCode: 'RC-AVAILABLE',
      age: 48,
      sex: 'female',
      weightKg: 70,
      heightCm: 165,
      conditions: [],
      zone: 'Coast',
      language: 'en',
      medicationIds: [],
      availableFoodIds: allowedIds,
    });

    expect(plan.meals.flatMap(meal => meal.items).every(item => allowedIds.has(item.foodId))).toBe(true);
  });

  it('normalizes diagnosis labels to canonical condition codes', () => {
    const plan = generateMealPlan({
      patientCode: 'RC-DX',
      age: 52,
      sex: 'female',
      weightKg: 66,
      heightCm: 162,
      conditions: ['Diabetes', 'I10'],
      zone: 'Lake Zone',
      language: 'en',
      medicationIds: [],
    });

    expect(plan.diagnosis).toBe('DM, HTN');
  });
});
