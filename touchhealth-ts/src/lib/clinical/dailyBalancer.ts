import { getFoodsForZone, getZonePresets, supportedPreparations } from './dataLoader';
import { evalFoodForPatient } from './foodSafety';
import { getPracticalPortionLimit, roundPortion } from './mealPortions';
import { makeMealItem, sumNutrients } from './planValidation';
import { STARCH_EGG_INCOMPATIBLE } from './mealTemplates';
import type { DailyMeal, GeneratedMealPlan, MealItem } from './types';

function score(plan: GeneratedMealPlan, meals: DailyMeal[]): number {
  const n = sumNutrients(meals.flatMap((m) => m.items)), t = plan.targets;
  return 40 * Math.pow((n.calories - t.tdee) / t.tdee, 2)
    + 12 * Math.pow((n.protein - t.proteinG) / t.proteinG, 2)
    + 4 * Math.pow(Math.max(0, t.fiberG - (n.fiberG ?? 0)) / t.fiberG, 2)
    + 100 * Math.pow(Math.max(0, (n.sodiumMg ?? t.sodiumMg * 2) - t.sodiumMg) / t.sodiumMg, 2);
}
function incompatible(items: MealItem[]): boolean {
  return items.some((i) => i.foodId === 'food_051') && items.some((i) => STARCH_EGG_INCOMPATIBLE.has(i.foodId));
}
/** Bounded, deterministic local search. An infeasible selection remains incomplete. */
export function balanceDailyMeals(plan: GeneratedMealPlan): DailyMeal[] {
  const assessment = plan.assessment!;
  const foodConditions = [...(plan.conditions ?? []), ...(plan.inputSnapshot?.medicationIds ?? [])];
  const core = new Set(getZonePresets()[plan.region]?.coreStaples ?? []);
  const candidates = getFoodsForZone(plan.region).filter((f) => {
    const categories = Array.isArray(f.category) ? f.category : [f.category];
    return categories.some((c) => ['carb','protein','fruit','vegetable','veg'].includes(c))
      && !/sugar|sukari|salt|chumvi|biscuit|mandazi|soda|honey|syrup/i.test(f.name_en + ' ' + f.name_sw)
      && !assessment.excludedFoodIds.includes(f.id) && (!assessment.availableFoodIds || assessment.availableFoodIds.includes(f.id))
      && supportedPreparations(f).some((p) => evalFoodForPatient(f.id, p, foodConditions).severity === 'Safe');
  }).sort((a, b) => Number(core.has(b.id)) - Number(core.has(a.id)) || a.id.localeCompare(b.id));
  // Keep a balanced candidate shortlist rather than favoring catalogue order.
  const shortlist = [...new Map(['carb','protein','fruit','vegetable'].flatMap((cat) => candidates.filter((f) =>
    (Array.isArray(f.category) ? f.category : [f.category]).includes(cat)).slice(0, 8)).map((f) => [f.id, f])).values()];
  const snackEligible = (food: typeof candidates[number]) => {
    const cats=Array.isArray(food.category)?food.category:[food.category];
    return cats.includes('fruit') || /egg|milk|yogurt|yoghurt|groundnut|peanut/i.test(food.name_en);
  };
  const snackFoods=shortlist.filter(snackEligible);
  const prepFor = (id: string) => supportedPreparations(candidates.find((f) => f.id === id)!).find((p) => evalFoodForPatient(id, p, foodConditions).severity === 'Safe')!;
  let meals = plan.meals.map((m) => ({ ...m, items: [...m.items] }));
  for (let step = 0; step < 120; step++) {
    let best = meals, bestScore = score(plan, meals);
    const consider = (trial: DailyMeal[]) => {
      if (trial.some((m) => incompatible(m.items))) return;
      const nextScore = score(plan, trial);
      if (nextScore < bestScore - 0.00001) { bestScore = nextScore; best = trial; }
    };
    for (let mi = 0; mi < meals.length; mi++) {
      const meal = meals[mi];
      for (let ii = 0; ii < meal.items.length; ii++) {
        const item = meal.items[ii], food = candidates.find((f) => f.id === item.foodId);
        if (!food || item.ingredient || item.portionMultiplier == null) continue;
        const halfUnit = 0.5 / (food.serving?.default_units ?? 1);
        for (const delta of [-halfUnit, halfUnit]) {
          const portion = item.portionMultiplier + delta;
          if (portion < halfUnit || roundPortion(food, portion) > getPracticalPortionLimit(food, meal.mealType)) continue;
          const updated = makeMealItem(food, portion, plan.language, item.preparation);
          consider(meals.map((m, index) => index === mi ? { ...m, items: m.items.map((i, index) => index === ii ? updated : i) } : m));
        }
      }
      if (meal.items.filter((i) => !i.ingredient).length < (meal.mealType === 'Snack' ? 3 : 5)) for (const food of shortlist) {
        if (meal.items.some((i) => i.foodId === food.id) || (meal.mealType === 'Snack' && !snackEligible(food))) continue;
        const cats = Array.isArray(food.category) ? food.category : [food.category];
        if (meal.mealType === 'Dinner' && cats.includes('fruit')) continue;
        if (cats.includes('carb') && meal.items.some((i) => {
          const f = candidates.find((c) => c.id === i.foodId); return f && (Array.isArray(f.category) ? f.category : [f.category]).includes('carb');
        })) continue;
        const item = makeMealItem(food, Math.min(0.5, getPracticalPortionLimit(food, meal.mealType)), plan.language, prepFor(food.id));
        consider(meals.map((m, index) => index === mi ? { ...m, items: [...m.items, item] } : m));
      }
    }
    if (!meals.some((m) => m.mealType === 'Snack') && sumNutrients(meals.flatMap((m) => m.items)).calories < plan.targets.tdee * 0.9) {
      for (let a = 0; a < snackFoods.length; a++) for (let b = a + 1; b < snackFoods.length; b++) {
        const items = [snackFoods[a], snackFoods[b]].map((food) => makeMealItem(food, Math.min(0.5, getPracticalPortionLimit(food, 'Snack')), plan.language, prepFor(food.id)));
        consider([...meals, { mealType: 'Snack', name_en: 'Optional snacks', name_sw: 'Vitafunwa vya ziada', items, totalCalories: 0 }]);
      }
    }
    if (best === meals) break;
    meals = best;
  }
  return meals.map((meal) => ({ ...meal, totalCalories: sumNutrients(meal.items).calories }));
}
