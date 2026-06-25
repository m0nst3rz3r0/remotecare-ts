import { describe, it, expect, beforeAll } from 'vitest';
import { getRecommendedFoods, getAvoidFoods } from './foodSafety';
import { setClinicalDataForTests } from './dataLoader';
import type { FoodItem, ClinicalRule } from './types';

const M = (calories: number, carbs_g: number, protein_g: number, fat_g: number) =>
  ({ calories, carbs_g, protein_g, fat_g, sodium_mg: 5 });

const FOODS: FoodItem[] = [
  { id: 'ugali',   name_en: 'Ugali',   name_sw: 'Ugali',    category: ['carb'],      regions: ['All'], glycemic_index: 'Medium', macros_per_100g: M(120, 25, 3, 1) },
  { id: 'rice',    name_en: 'Rice',    name_sw: 'Wali',     category: ['carb'],      regions: ['All'], glycemic_index: 'High',   macros_per_100g: M(130, 28, 3, 0) },
  { id: 'sugar',   name_en: 'Sugar',   name_sw: 'Sukari',   category: ['carb'],      regions: ['All'], glycemic_index: 'High',   macros_per_100g: M(387, 100, 0, 0) },
  { id: 'beans',   name_en: 'Beans',   name_sw: 'Maharagwe',category: ['protein'],   regions: ['All'], glycemic_index: 'Low',    macros_per_100g: M(127, 22, 9, 1) },
  { id: 'chicken', name_en: 'Chicken', name_sw: 'Kuku',     category: ['protein'],   regions: ['All'], glycemic_index: 'Low',    macros_per_100g: M(165, 0, 31, 4) },
  { id: 'spinach', name_en: 'Spinach', name_sw: 'Mchicha',  category: ['vegetable'], regions: ['All'], glycemic_index: 'Low',    macros_per_100g: M(23, 4, 3, 0) },
  { id: 'tomato',  name_en: 'Tomato',  name_sw: 'Nyanya',   category: ['vegetable'], regions: ['All'], glycemic_index: 'Low',    macros_per_100g: M(18, 4, 1, 0) },
  { id: 'banana',  name_en: 'Banana',  name_sw: 'Ndizi',    category: ['fruit'],     regions: ['All'], glycemic_index: 'Medium', macros_per_100g: M(89, 23, 1, 0) },
  { id: 'mango',   name_en: 'Mango',   name_sw: 'Embe',     category: ['fruit'],     regions: ['All'], glycemic_index: 'Medium', macros_per_100g: M(60, 15, 1, 0) },
];

const RULES: ClinicalRule[] = [
  {
    id: 'r1',
    condition: 'DM',
    target_food_id: 'sugar',
    target_prep_method: 'Any',
    safety_level: 'Danger',
    alert_message_en: 'Avoid sugar — raises blood glucose.',
    alert_message_sw: 'Epuka sukari — inaongeza sukari ya damu.',
  },
];

beforeAll(() => {
  setClinicalDataForTests(FOODS, RULES);
});

describe('getRecommendedFoods', () => {
  it('returns all four food groups', () => {
    const result = getRecommendedFoods(['HTN'], 'Central');
    expect(Array.isArray(result.starch)).toBe(true);
    expect(Array.isArray(result.protein)).toBe(true);
    expect(Array.isArray(result.vegetable)).toBe(true);
    expect(Array.isArray(result.fruit)).toBe(true);
  });

  it('starch group excludes sugary items filtered by name', () => {
    const result = getRecommendedFoods(['HTN'], 'Central');
    const names = result.starch.map((f) => f.name_en.toLowerCase());
    expect(names).not.toContain('sugar');
  });

  it('excludes danger foods for given condition', () => {
    const result = getRecommendedFoods(['DM'], 'Central');
    const allIds = [
      ...result.starch, ...result.protein,
      ...result.vegetable, ...result.fruit,
    ].map((f) => f.id);
    expect(allIds).not.toContain('sugar');
  });

  it('each food item has id, name_en, name_sw', () => {
    const result = getRecommendedFoods(['HTN'], 'Central');
    const all = [...result.starch, ...result.protein, ...result.vegetable, ...result.fruit];
    for (const f of all) {
      expect(f).toHaveProperty('id');
      expect(f).toHaveProperty('name_en');
      expect(f).toHaveProperty('name_sw');
    }
  });

  it('fruit group is populated', () => {
    const result = getRecommendedFoods(['HTN'], 'Central');
    expect(result.fruit.length).toBeGreaterThan(0);
  });
});

describe('getAvoidFoods', () => {
  it('returns danger foods for DM', () => {
    const result = getAvoidFoods(['DM'], 'Central');
    expect(result.some((f) => f.name_en === 'Sugar')).toBe(true);
  });

  it('each avoid item has a reason_en field', () => {
    const result = getAvoidFoods(['DM'], 'Central');
    for (const f of result) {
      expect(f).toHaveProperty('reason_en');
    }
  });

  it('returns empty array when no danger foods match', () => {
    const result = getAvoidFoods(['HTN'], 'Central');
    expect(result).toHaveLength(0);
  });
});
