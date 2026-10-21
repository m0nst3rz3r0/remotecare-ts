import type { FoodItem } from './types';

type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export function roundPortion(food: FoodItem, multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error('Portion must be a positive number.');
  if (food.serving) return Math.max(0.5, Math.round(food.serving.default_units * multiplier * 2) / 2) / food.serving.default_units;
  return Math.max(5, Math.round(multiplier * 100 / 5) * 5) / 100;
}

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

  if ((!/ugali|stiff/.test(name) && /porridge|uji/.test(name)) || /tea cup|kikombe cha chai/.test(unit)) {
    // Routine generated portions; larger clinician-edited servings remain possible.
    return toMultiplier(1);
  }
  if (/ugali|stiff porridge|fist/.test(name) || /fist|ngumi/.test(unit)) {
    return toMultiplier(mealType === 'Lunch' ? 2 : 1.5);
  }
  if (/piece/.test(unit) && categories.includes('carb')) {
    return toMultiplier(mealType === 'Lunch' ? 2 : 1.5);
  }
  if (categories.includes('protein')) {
    if (/palm/.test(unit)) return toMultiplier(1);
    if (/egg|yai/.test(name)) return toMultiplier(1);
    return toMultiplier(1);
  }
  if (categories.includes('vegetable') || categories.includes('veg') || categories.includes('vitamin')) {
    return toMultiplier(1);
  }
  if (categories.includes('fruit')) {
    return toMultiplier(1);
  }

  return Math.max(1, toMultiplier(1.5));
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
    if (!/ugali|stiff/i.test(food.name_en) && /porridge|uji/i.test(food.name_en+' '+food.name_sw)) return lang === 'sw'
      ? (units === 1 ? 'Kikombe 1 cha uji' : 'Vikombe '+formatQuantity(units)+' vya uji')
      : formatQuantity(units)+' '+(units === 1 ? 'cup' : 'cups')+' of prepared porridge';
    if (/fist/.test(food.serving.unit_en)) return formatQuantity(units)+' '+(lang === 'sw' ? 'ngumi' : units === 1 ? 'fist' : 'fists');
    const plural = units === 1 ? unit : lang === 'en' ? (unit.endsWith('s') ? unit : unit+'s') : unit.replace(/^kikombe/,'vikombe').replace(/^kijiko/,'vijiko').replace(/^kipande/,'vipande').replace(/^tunda/,'matunda');
    return formatQuantity(units)+' '+plural;
  }

  const grams = Math.max(5, Math.round(getServingGrams(food, portionMultiplier) / 5) * 5);
  return `${grams}g`;
}

export function computeFoodMacros(food: FoodItem, portionMultiplier: number) {
  const m = food.macros_per_100g;
  const factor = getServingGrams(food, roundPortion(food, portionMultiplier)) / 100;
  return {
    calories: Math.round(m.calories * factor),
    protein: Math.round((m.protein_g ?? 0) * factor * 10) / 10,
    carbs: Math.round((m.carbs_g ?? 0) * factor * 10) / 10,
    fat: Math.round((m.fat_g ?? 0) * factor * 10) / 10,
    sodiumMg: Number.isFinite(m.sodium_mg) ? Math.round(m.sodium_mg * factor) : null,
    fiberG: Number.isFinite(m.fiber_g) ? Math.round(m.fiber_g! * factor * 10) / 10 : null,
  };
}
