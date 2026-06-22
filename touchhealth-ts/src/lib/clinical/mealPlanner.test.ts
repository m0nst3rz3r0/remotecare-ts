import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadZonePresets, setClinicalDataForTests } from './dataLoader';
import type { FoodItem, ClinicalRule } from './types';
import { isMealStarch, generateMealPlan, buildCautions } from './mealPlanner';
import { formatMealItemDetail } from './mealLocalization';
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
});
