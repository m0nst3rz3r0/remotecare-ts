import type { FoodItem } from './types';

type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

export function getServingGrams(food: FoodItem, portionMultiplier: number): number {
  const gramsPerUnit = food.serving?.grams_per_unit ?? 100;
  const defaultUnits = food.serving?.default_units ?? 1;
  return gramsPerUnit * defaultUnits * portionMultiplier;
}

export function getPracticalPortionLimit(food: FoodItem, mealType: MealType): number {
  const defaultUnits = food.serving?.default_units ?? 1;
  const name = `${food.name_en} ${food.name_sw}`.toLowerCase();
  const unit = `${food.serving?.unit_en ?? ''} ${food.serving?.unit_sw ?? ''}`.toLowerCase();
  const categories = Array.isArray(food.category) ? food.category : [food.category];

  const toMultiplier = (maxUnits: number) => Math.max(0.5, maxUnits / Math.max(defaultUnits, 0.5));

  if (/porridge|uji/.test(name) || /tea cup|kikombe cha chai/.test(unit)) {
    return toMultiplier(mealType === 'Breakfast' ? 3 : 2.5);
  }
  if (/ugali|stiff porridge|fist/.test(name) || /fist|ngumi/.test(unit)) {
    return toMultiplier(mealType === 'Lunch' ? 2.5 : 2);
  }
  if (/piece/.test(unit) && categories.includes('carb')) {
    return toMultiplier(mealType === 'Lunch' ? 3 : 2.5);
  }
  if (categories.includes('protein')) {
    if (/palm/.test(unit)) return toMultiplier(mealType === 'Lunch' ? 1.5 : 1.25);
    if (/egg|yai/.test(name)) return toMultiplier(1);
    return toMultiplier(1.5);
  }
  if (categories.includes('vegetable') || categories.includes('veg') || categories.includes('vitamin')) {
    return toMultiplier(1.5);
  }
  if (categories.includes('fruit')) {
    return toMultiplier(1.5);
  }

  return Math.max(1.5, toMultiplier(2));
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
