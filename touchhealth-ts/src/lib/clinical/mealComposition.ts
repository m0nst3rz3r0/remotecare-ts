import type { FoodItem } from './types';

/** Not meal staples - condiments, sweeteners, etc. */
const BLOCKED_MEAL_STARCH_IDS = new Set([
  'food_118', // white sugar
  'food_119', // iodized salt
]);

function foodLabel(f: FoodItem): string { return `${f.name_en} ${f.name_sw}`.toLowerCase(); }
/** True staple starches suitable as a meal base (not sugar, salt, snacks). */
export function isMealStarch(f: FoodItem): boolean {
  if (BLOCKED_MEAL_STARCH_IDS.has(f.id)) return false;

  const cats = Array.isArray(f.category) ? f.category : [f.category];
  if (!cats.includes('carb')) return false;

  const name = foodLabel(f);
  if (/sugar|sukari|asali|honey|syrup|soda|cola|biscuit|biskuti|mandazi|vitumbua|mkate mweupe|white bread/i.test(name)) {
    return false;
  }
  if (/^(salt|iodized salt|chumvi)(,|\s*$)/i.test(f.name_en)) return false;

  if (f.serving && f.serving.grams_per_unit < 25 && (f.macros_per_100g.carbs_g ?? 0) > 85) {
    return false;
  }

  return true;
}

/** Catalogue aliases share one practical daily budget; these are software defaults, not prescriptions. */
export function foodFamily(food: Pick<FoodItem,'id'|'name_en'>): string {
  const name=food.name_en.toLowerCase();
  if (/^egg[, ]/.test(name)) return 'whole-egg';
  if (/^avocado[, ]/.test(name) && !/juice/.test(name)) return 'avocado';
  if (/^jackfruit[, ]/.test(name)) return 'jackfruit';
  return food.id;
}
export function dailyFoodBudget(food: FoodItem): number {
  const family=foodFamily(food);
  if(family==='avocado')return 200;
  if(family==='jackfruit')return 140;
  if(family==='whole-egg')return 120;
  return Infinity;
}

