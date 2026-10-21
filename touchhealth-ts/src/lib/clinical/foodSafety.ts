import { applyStaplePolicy, CONTROLLED_STAPLES, isPortionAdvice } from './staplePolicy';
// RCRO NutritionTool — food safety evaluator

import { getRulesSync, getFoodsForZone, getFoodsSync, isFoodsReady, supportedPreparations } from './dataLoader';
import { conditionMatches } from './conditions';
import type { EvaluationResult, TZRegion, FoodGuidance } from './types';

const AVOID_LIST_LIMIT = 5;
const RECOMMEND_LIMIT = 20;
const SEVERITY_RANK: Record<EvaluationResult['severity'], number> = {
  Safe: 0,
  not_assessed: 2,
  Warning: 1,
  Danger: 3,
};

function shortenReason(message: string): string {
  return message.trim();
}

export function getFoodGuidance(conditions: string[], zone: TZRegion, priorityFoodIds: string[] = []): FoodGuidance[] {
  const result: FoodGuidance[] = [];
  for (const food of getFoodsForZone(zone).slice().sort((a,b)=>Number(priorityFoodIds.includes(b.id))-Number(priorityFoodIds.includes(a.id)))) {
    const rules = getRulesSync().map(applyStaplePolicy).filter(r => r.target_food_id === food.id && r.safety_level !== 'Safe' && conditionMatches(r.condition, conditions));
    for (const prep of new Set(rules.map(r => r.target_prep_method))) {
      const matching = rules.filter(r => r.target_prep_method === prep);
      const alternative = supportedPreparations(food).find(p => evalFoodForPatient(food.id,p,conditions).severity === 'Safe');
      result.push({ foodId: food.id, name_en: food.name_en, name_sw: food.name_sw, preparation: prep,
        level: matching.some(r=>r.safety_level === 'Danger') ? 'Danger' : 'Warning',
        reasons: [...new Map(matching.map(r=>[r.alert_message_en+'|'+r.alert_message_sw,{message_en:r.alert_message_en,message_sw:r.alert_message_sw}])).values()],
        alternative: alternative ? { preparation:alternative, message_en:'Assessed alternative preparation',message_sw:'Maandalizi mbadala yaliyotathminiwa' } : undefined });
    }
    if (result.length >= 8) break;
  }
  return result;
}

export function evalFoodForPatient(
  foodId: string,
  prepMethod: string,
  conditions: string[],
): EvaluationResult {
  const rules = getRulesSync().map(applyStaplePolicy);
  const food = getFoodsSync().find((f) => f.id === foodId);
  if (!isFoodsReady() || !food || !supportedPreparations(food).includes(prepMethod.toLowerCase())) return {
    severity: 'not_assessed', message_en: 'Food or preparation has not been assessed with a validated dataset.',
    message_sw: 'Chakula au maandalizi hayajatathminiwa kwa data iliyohakikiwa.', reasons: [],
  };
  const applicable = rules.filter(r => {
    const foodMatch = !r.target_food_id || r.target_food_id === foodId;
    const prepMatch = r.target_prep_method === 'Any' ||
      r.target_prep_method.toLowerCase() === prepMethod.toLowerCase();
    return foodMatch && prepMatch && conditionMatches(r.condition, conditions);
  });

  for (const sev of ['Danger', 'Warning', 'Safe'] as const) {
    const r = applicable.find(x => x.safety_level === sev);
    if (r) return { portionControlled: sev==='Warning' && CONTROLLED_STAPLES.has(foodId) && /boiled|steamed|uji|ugali/.test(prepMethod.toLowerCase()) && applicable.every(rule=>rule.safety_level==='Safe'||isPortionAdvice(rule)), severity: sev, message_en: r.alert_message_en, message_sw: r.alert_message_sw,
      reasons: applicable.map((rule) => ({ ruleId: rule.id, message_en: rule.alert_message_en, message_sw: rule.alert_message_sw })) };
  }

  return {
    severity: 'Safe', reasons: [],
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

  const food = getFoodsSync().find((f) => f.id === foodId);
  for (const prep of food ? supportedPreparations(food) : []) candidatePreps.add(prep);
  if (!candidatePreps.size) return evalFoodForPatient(foodId, 'unsupported', conditions);
  let worst = evalFoodForPatient(foodId, [...candidatePreps][0], conditions);
  for (const prep of candidatePreps) {
    const result = evalFoodForPatient(foodId, prep, conditions);
    if (SEVERITY_RANK[result.severity] > SEVERITY_RANK[worst.severity]) worst = result;
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
export function getRecommendedFoods(conditions: string[], zone: TZRegion, availableFoodIds?: Set<string>, excludedFoodIds: string[] = []): {
  starch: Array<{ id: string; name_en: string; name_sw: string }>;
  protein: Array<{ id: string; name_en: string; name_sw: string }>;
  vegetable: Array<{ id: string; name_en: string; name_sw: string }>;
  fruit: Array<{ id: string; name_en: string; name_sw: string }>;
} {
  const foods = getFoodsForZone(zone);
  const perGroup = Math.floor(RECOMMEND_LIMIT / 4) + 1;

  const pick = (catFilter: (cats: string[]) => boolean, nameFilter?: RegExp) => {
    return foods
      .filter(f => {
        if ((availableFoodIds && !availableFoodIds.has(f.id)) || excludedFoodIds.includes(f.id)) return false;
        const cats = Array.isArray(f.category) ? f.category : [f.category];
        if (!catFilter(cats)) return false;
        if (nameFilter && nameFilter.test(f.name_en)) return false;
        return supportedPreparations(f).some((prep) => evalFoodForPatient(f.id, prep, conditions).severity === 'Safe');
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
  const rules = getRulesSync().map(applyStaplePolicy);
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

export function isMealEligible(foodId:string,prep:string,conditions:string[]):boolean {
 const result=evalFoodForPatient(foodId,prep,conditions);
 return result.severity==='Safe'||result.portionControlled===true;
}
