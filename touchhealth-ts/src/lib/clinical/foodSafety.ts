// RCRO NutritionTool — food safety evaluator

import { getRulesSync, getFoodsForZone } from './dataLoader';
import { conditionMatches } from './conditions';
import type { EvaluationResult, TZRegion } from './types';

const AVOID_LIST_LIMIT = 5;
const RECOMMEND_LIMIT = 20;
const SEVERITY_RANK: Record<EvaluationResult['severity'], number> = {
  Safe: 0,
  Warning: 1,
  Danger: 2,
};

function shortenReason(message: string): string {
  const main = message.split(/\s*TIP:/i)[0].trim();
  if (main.length <= 100) return main;
  return `${main.slice(0, 97)}…`;
}

export function evalFoodForPatient(
  foodId: string,
  prepMethod: string,
  conditions: string[],
): EvaluationResult {
  const rules = getRulesSync();
  const applicable = rules.filter(r => {
    const foodMatch = !r.target_food_id || r.target_food_id === foodId;
    const prepMatch = r.target_prep_method === 'Any' ||
      r.target_prep_method.toLowerCase() === prepMethod.toLowerCase();
    return foodMatch && prepMatch && conditionMatches(r.condition, conditions);
  });

  for (const sev of ['Danger', 'Warning', 'Safe'] as const) {
    const r = applicable.find(x => x.safety_level === sev);
    if (r) return { severity: sev, message_en: r.alert_message_en, message_sw: r.alert_message_sw };
  }

  return {
    severity: 'Safe',
    message_en: 'No specific clinical restrictions for this selection.',
    message_sw: 'Hakuna vikwazo maalum vya kitabibu kwa chaguo hili.',
  };
}

export function evalFoodAcrossPreparations(
  foodId: string,
  conditions: string[],
  preparationMethods: string[] = [],
): EvaluationResult {
  const candidatePreps = new Set<string>();

  for (const prep of preparationMethods) {
    if (prep && prep.trim()) candidatePreps.add(prep.trim());
  }

  for (const rule of getRulesSync()) {
    const appliesToFood = !rule.target_food_id || rule.target_food_id === foodId;
    if (appliesToFood && rule.target_prep_method && rule.target_prep_method !== 'Any') {
      candidatePreps.add(rule.target_prep_method);
    }
  }

  if (candidatePreps.size === 0) {
    candidatePreps.add('Boiled');
  }

  let worst = evalFoodForPatient(foodId, 'Boiled', conditions);
  for (const prep of candidatePreps) {
    const result = evalFoodForPatient(foodId, prep, conditions);
    if (SEVERITY_RANK[result.severity] > SEVERITY_RANK[worst.severity]) {
      worst = result;
    }
  }
  return worst;
}

export function searchFoods(query: string, zone: TZRegion, limit = 8) {
  const q = query.toLowerCase().trim();
  if (!q || q.length < 2) return [];
  const foods = getFoodsForZone(zone);
  return foods
    .filter(f =>
      f.name_en.toLowerCase().includes(q) ||
      (f.name_sw && f.name_sw.toLowerCase().includes(q))
    )
    .slice(0, limit);
}

/** Returns zone-appropriate foods rated Safe for this patient, grouped by category */
export function getRecommendedFoods(conditions: string[], zone: TZRegion): {
  starch: Array<{ id: string; name_en: string; name_sw: string }>;
  protein: Array<{ id: string; name_en: string; name_sw: string }>;
  vegetable: Array<{ id: string; name_en: string; name_sw: string }>;
  fruit: Array<{ id: string; name_en: string; name_sw: string }>;
} {
  const rules = getRulesSync();
  const foods = getFoodsForZone(zone);

  const dangerIds = new Set<string>();
  for (const rule of rules) {
    if (rule.safety_level === 'Danger' && rule.target_food_id &&
        conditionMatches(rule.condition, conditions)) {
      dangerIds.add(rule.target_food_id);
    }
  }

  const perGroup = Math.floor(RECOMMEND_LIMIT / 4) + 1;

  const pick = (catFilter: (cats: string[]) => boolean, nameFilter?: RegExp) => {
    return foods
      .filter(f => {
        if (dangerIds.has(f.id)) return false;
        const cats = Array.isArray(f.category) ? f.category : [f.category];
        if (!catFilter(cats)) return false;
        if (nameFilter && nameFilter.test(f.name_en)) return false;
        return evalFoodAcrossPreparations(f.id, conditions, f.preparationMethods).severity === 'Safe';
      })
      .slice(0, perGroup)
      .map(f => ({ id: f.id, name_en: f.name_en, name_sw: f.name_sw ?? f.name_en }));
  };

  return {
    starch: pick(
      cats => cats.includes('carb'),
      /sugar|sukari|honey|asali|soda|biscuit|biskuti|mandazi|white bread|mkate mweupe/i,
    ),
    protein: pick(cats => cats.includes('protein')),
    vegetable: pick(cats => cats.includes('vegetable') || cats.includes('veg')),
    fruit: pick(cats => cats.includes('fruit')),
  };
}

export function getAvoidFoods(conditions: string[], zone: TZRegion) {
  const rules = getRulesSync();
  const foods = getFoodsForZone(zone);
  const avoidFoodIds = new Set<string>();

  for (const rule of rules) {
    if (rule.safety_level === 'Danger' && rule.target_food_id &&
        conditionMatches(rule.condition, conditions)) {
      avoidFoodIds.add(rule.target_food_id);
    }
  }

  return foods
    .filter(f => avoidFoodIds.has(f.id))
    .slice(0, AVOID_LIST_LIMIT)
    .map(f => {
      const rule = rules.find(r => r.target_food_id === f.id &&
        r.safety_level === 'Danger' && conditionMatches(r.condition, conditions));
      return {
        name_en: f.name_en,
        name_sw: f.name_sw,
        reason_en: shortenReason(rule?.alert_message_en ?? 'Avoid for your condition.'),
        reason_sw: shortenReason(rule?.alert_message_sw ?? 'Epuka kwa hali yako.'),
      };
    });
}
