// RCRO NutritionTool — food safety evaluator

import { getRulesSync, getFoodsForZone } from './dataLoader';
import { conditionMatches } from './conditions';
import type { EvaluationResult, TZRegion } from './types';

const AVOID_LIST_LIMIT = 5;

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
