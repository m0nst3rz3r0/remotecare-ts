// RCRO NutritionTool — culturally appropriate meal blueprints per zone
// Each meal is a real Tanzanian combination, not random starch + protein picks.

import type { TZRegion } from './types';
import type { PrepMethod } from './mealLocalization';

export interface BlueprintSlot {
  /** First safe food ID in list is used */
  foodIds: string[];
  portion: number;
  prep: PrepMethod;
}

export interface MealBlueprint {
  mealType: 'Breakfast' | 'Lunch' | 'Dinner';
  items: BlueprintSlot[];
  note_en?: string;
  note_sw?: string;
}

/** Lake Zone — Bukoba/Mwanza: uji/ugali, samaki, maharage, mboga za majani */
const LAKE_ZONE: MealBlueprint[] = [
  {
    mealType: 'Breakfast',
    items: [
      { foodIds: ['food_006_uji', 'food_009_uji'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_056', 'food_055', 'food_053'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_096', 'food_097'], portion: 1, prep: 'boiled' },
    ],
    note_sw: 'Kiamsha kinywa: uji na samaki kidogo na mboga — mlo mwepesi wa asubuhi.',
    note_en: 'Breakfast: light porridge with small fish and greens.',
  },
  {
    mealType: 'Lunch',
    items: [
      { foodIds: ['food_014', 'food_161'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_053', 'food_056', 'food_055'], portion: 1, prep: 'steamed' },
      { foodIds: ['food_096', 'food_097', 'food_107'], portion: 1, prep: 'boiled' },
    ],
    note_sw: 'Chakula cha mchana: ugali na samaki na mboga za majani.',
    note_en: 'Lunch: ugali with fish and leafy greens — the main meal.',
  },
  {
    mealType: 'Dinner',
    items: [
      { foodIds: ['food_024', 'food_014'], portion: 0.75, prep: 'boiled' },
      { foodIds: ['food_030', 'food_033'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_097', 'food_096', 'food_107'], portion: 1, prep: 'boiled' },
    ],
    note_sw: 'Chakula cha jioni: viazi vitamu au ugali kidogo na maharage na mboga.',
    note_en: 'Dinner: sweet potato or small ugali with beans and greens.',
  },
];

/** Coast / Zanzibar — wali, samaki, maharage */
const COAST_ZONE: MealBlueprint[] = [
  {
    mealType: 'Breakfast',
    items: [
      { foodIds: ['food_006_uji', 'food_019'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_051'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_096', 'food_097'], portion: 1, prep: 'boiled' },
    ],
    note_sw: 'Kiamsha kinywa: uji na yai la kuchemsha na mboga.',
  },
  {
    mealType: 'Lunch',
    items: [
      { foodIds: ['food_016', 'food_014'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_053', 'food_056'], portion: 1, prep: 'steamed' },
      { foodIds: ['food_096', 'food_097'], portion: 1, prep: 'boiled' },
    ],
    note_sw: 'Chakula cha mchana: wali na samaki na mboga.',
  },
  {
    mealType: 'Dinner',
    items: [
      { foodIds: ['food_014', 'food_016'], portion: 0.75, prep: 'boiled' },
      { foodIds: ['food_030', 'food_033'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_097', 'food_107'], portion: 1, prep: 'boiled' },
    ],
    note_sw: 'Chakula cha jioni: wanga kidogo na maharage na mboga.',
  },
];

/** Northern / Southern Highlands — ugali, maharage, viazi, mayai */
const HIGHLANDS_ZONE: MealBlueprint[] = [
  {
    mealType: 'Breakfast',
    items: [
      { foodIds: ['food_006_uji', 'food_009_uji'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_051'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_096', 'food_097'], portion: 1, prep: 'boiled' },
    ],
    note_sw: 'Kiamsha kinywa: uji na yai la kuchemsha na mboga.',
  },
  {
    mealType: 'Lunch',
    items: [
      { foodIds: ['food_014', 'food_009'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_030', 'food_051'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_096', 'food_097'], portion: 1, prep: 'boiled' },
    ],
    note_sw: 'Chakula cha mchana: ugali na maharage au yai na mboga.',
  },
  {
    mealType: 'Dinner',
    items: [
      { foodIds: ['food_024', 'food_014'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_030', 'food_033'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_097', 'food_107'], portion: 1, prep: 'boiled' },
    ],
    note_sw: 'Chakula cha jioni: viazi vitamu na maharage na mboga.',
  },
];

/** Central / Western — ugali, viazi, maharage */
const INLAND_ZONE: MealBlueprint[] = [
  {
    mealType: 'Breakfast',
    items: [
      { foodIds: ['food_006_uji', 'food_019'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_051'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_096'], portion: 1, prep: 'boiled' },
    ],
  },
  {
    mealType: 'Lunch',
    items: [
      { foodIds: ['food_014', 'food_024'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_030', 'food_051'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_096', 'food_097'], portion: 1, prep: 'boiled' },
    ],
    note_sw: 'Chakula cha mchana: ugali na maharage na mboga.',
  },
  {
    mealType: 'Dinner',
    items: [
      { foodIds: ['food_024', 'food_014'], portion: 0.75, prep: 'boiled' },
      { foodIds: ['food_030'], portion: 1, prep: 'boiled' },
      { foodIds: ['food_097'], portion: 1, prep: 'boiled' },
    ],
  },
];

const ZONE_TEMPLATES: Partial<Record<TZRegion, MealBlueprint[]>> = {
  'Lake Zone': LAKE_ZONE,
  'Coast': COAST_ZONE,
  'Zanzibar': COAST_ZONE,
  'Northern Highlands': HIGHLANDS_ZONE,
  'Southern Highlands': HIGHLANDS_ZONE,
  'Central': INLAND_ZONE,
  'Western': INLAND_ZONE,
  'All': INLAND_ZONE,
};

export function getMealTemplates(zone: TZRegion): MealBlueprint[] {
  return ZONE_TEMPLATES[zone] ?? INLAND_ZONE;
}

/** Foods that should not appear as a main-meal starch with egg in the same sitting */
export const STARCH_EGG_INCOMPATIBLE = new Set(['food_148', 'food_3524']);
