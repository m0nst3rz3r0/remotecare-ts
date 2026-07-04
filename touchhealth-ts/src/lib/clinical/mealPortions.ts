import type { FoodItem } from './types';

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

export function getServingGrams(food: FoodItem, portionMultiplier: number): number {
  const gramsPerUnit = food.serving?.grams_per_unit ?? 100;
  const defaultUnits = food.serving?.default_units ?? 1;
  return gramsPerUnit * defaultUnits * portionMultiplier;
}

export function formatMealPortion(
  food: FoodItem,
  portionMultiplier: number,
  lang: 'en' | 'sw',
): string {
  if (food.serving) {
    const rawUnits = food.serving.default_units * portionMultiplier;
    const units = Math.round(rawUnits * 2) / 2;
    const unit = lang === 'sw' ? food.serving.unit_sw : food.serving.unit_en;
    return `${formatQuantity(units)} ${unit}`;
  }

  const grams = Math.max(5, Math.round(getServingGrams(food, portionMultiplier) / 5) * 5);
  return `${grams}g`;
}

export function computeFoodMacros(food: FoodItem, portionMultiplier: number) {
  const m = food.macros_per_100g;
  const factor = getServingGrams(food, portionMultiplier) / 100;
  return {
    calories: Math.round(m.calories * factor),
    protein: Math.round((m.protein_g ?? 0) * factor * 10) / 10,
    carbs: Math.round((m.carbs_g ?? 0) * factor * 10) / 10,
    fat: Math.round((m.fat_g ?? 0) * factor * 10) / 10,
  };
}
