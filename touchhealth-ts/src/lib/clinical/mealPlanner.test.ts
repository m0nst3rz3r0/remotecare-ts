import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadZonePresets, setClinicalDataForTests } from './dataLoader';
import type { FoodItem, ClinicalRule } from './types';
import { isMealStarch, generateMealPlan } from './mealPlanner';
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
  });
});
