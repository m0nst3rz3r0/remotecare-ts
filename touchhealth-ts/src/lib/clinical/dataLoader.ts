// RCRO NutritionTool — static data loader

import { getMealTemplates } from './mealTemplates';
import type { FoodItem, ClinicalRule, ZonePreset, TZRegion } from './types';

let _foods: FoodItem[] | null = null;
let _rules: ClinicalRule[] | null = null;
let _zonePresets: Record<string, ZonePreset> | null = null;

const CLINIC_ZONE_KEY = 'rcro_clinic_zone';

export interface ClinicalDataState { status: 'loading' | 'ready' | 'error'; error?: string; cached?: boolean; warnings: string[]; quarantinedRuleIds: string[]; version: string }
const CACHE_KEY = 'rcro_validated_nutrition_v2';
let state: ClinicalDataState = { status: 'loading', warnings: [], quarantinedRuleIds: [], version: '' };
const listeners = new Set<() => void>();
export function getClinicalDataState(): ClinicalDataState { return state; }
export function subscribeClinicalData(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
function publish(next: ClinicalDataState) { state = next; for (const listener of listeners) listener(); }
export function dataFingerprint(value: unknown): string {
  const text = JSON.stringify(value); let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function validateClinicalData(foods: FoodItem[], rules: ClinicalRule[], presets: Record<string, ZonePreset> = getZonePresets()) {
  const errors: string[] = [], warnings: string[] = [], quarantinedRuleIds: string[] = [];
  const ids = new Set<string>(), ruleIds = new Set<string>();
  if (!Array.isArray(foods) || !foods.length || !Array.isArray(rules) || !rules.length) throw new Error('Food and rule datasets are both required.');
  for (const food of foods) {
    if (!food || !food.id || ids.has(food.id)) { errors.push('Missing or duplicate food ID'); continue; }
    ids.add(food.id);
    if (!food.name_en || !food.name_sw || !Array.isArray(food.regions) || !food.macros_per_100g) errors.push('Invalid food: ' + food.id);
    for (const key of ['calories','protein_g','carbs_g','fat_g','sodium_mg','fiber_g'] as const) {
      if (!Number.isFinite(food.macros_per_100g?.[key]) || Number(food.macros_per_100g?.[key]) < 0) errors.push('Missing/invalid nutrient ' + key + ': ' + food.id);
    }
    if (!food.serving || !food.serving.unit_en || !food.serving.unit_sw || !(food.serving.grams_per_unit > 0) || !(food.serving.default_units > 0)
      || !Number.isFinite(food.serving.grams_per_unit) || !Number.isFinite(food.serving.default_units)) errors.push('Invalid serving: ' + food.id);
  }
  const accepted = rules.filter((rule) => {
    if (!rule || !rule.id || ruleIds.has(rule.id)) { errors.push('Missing or duplicate rule ID'); return false; }
    ruleIds.add(rule.id);
    if (!['Safe','Warning','Danger'].includes(rule.safety_level) || !rule.condition || !rule.target_prep_method || !rule.alert_message_en || !rule.alert_message_sw) errors.push('Invalid rule: ' + rule.id);
    // Legacy ulcer restriction rules are quarantined until local clinical review.
    if ((rule.target_food_id && !ids.has(rule.target_food_id)) || /^(PUD|K27)$/i.test(rule.condition)) {
      quarantinedRuleIds.push(rule.id); return false;
    }
    return true;
  });
  for (const [zone, preset] of Object.entries(presets)) {
    for (const id of [...preset.coreStaples, ...preset.excludeIds]) if (!ids.has(id)) warnings.push('Unknown zone food: ' + zone + '/' + id);
    for (const meal of getMealTemplates(zone as TZRegion)) for (const slot of meal.items) {
      if (!slot.foodIds.some((id) => ids.has(id))) errors.push('Empty template alternatives: ' + zone + '/' + meal.mealType);
      if (!(slot.portion > 0) || !['boiled','steamed','raw','grilled'].includes(slot.prep)) errors.push('Invalid meal template: ' + zone);
      for (const id of slot.foodIds) if (!ids.has(id)) warnings.push('Unknown template alternative: ' + id);
    }
  }
  if (errors.length) throw new Error([...new Set(errors)].join('; '));
  return { foods, rules: accepted, warnings: [...new Set(warnings)], quarantinedRuleIds,
    version: 'foods-' + dataFingerprint({ foods, rules, presets, templates: Object.keys(presets).map(zone => [zone,getMealTemplates(zone as TZRegion)]) }) };
}
function install(foods: FoodItem[], rules: ClinicalRule[], cached = false) {
  const valid = validateClinicalData(foods, rules);
  _foods = valid.foods; _rules = valid.rules;
  publish({ status: 'ready', cached, warnings: valid.warnings, quarantinedRuleIds: valid.quarantinedRuleIds, version: valid.version });
}
export async function preloadClinicalData(): Promise<void> {
  publish({ ...state, status: 'loading', error: undefined });
  try {
    const [foodsRes, rulesRes] = await Promise.all([fetch('/foods.json', { cache: 'no-cache' }), fetch('/rules.json', { cache: 'no-cache' })]);
    if (!foodsRes.ok || !rulesRes.ok) throw new Error('Nutrition dataset download failed.');
    const foodsRaw = await foodsRes.json(), rulesRaw = await rulesRes.json();
    const foods = Array.isArray(foodsRaw) ? foodsRaw : foodsRaw.foods;
    const rules = Array.isArray(rulesRaw) ? rulesRaw : rulesRaw.rules;
    install(foods, rules);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ foods, rules })); } catch { /* In-memory data still usable. */ }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nutrition data unavailable';
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
      if (cached) { install(cached.foods, cached.rules, true); publish({ ...state, error: message }); return; }
    } catch { /* No valid offline cache. */ }
    if (_foods?.length && _rules?.length) { publish({ ...state, status: 'ready', cached: true, error: message }); return; }
    publish({ ...state, status: 'error', error: message });
  }
}
export function loadZonePresets(presets: Record<string, ZonePreset>): void { _zonePresets = presets; }
/** Test-only injection: validation failures remain explicitly unavailable. */
export function setClinicalDataForTests(foods: FoodItem[], rules: ClinicalRule[]): void {
  _foods = null; _rules = null;
  try { install(foods, rules); } catch (error) { publish({ status: 'error', error: String(error), version: '', warnings: [], quarantinedRuleIds: [] }); }
}
const preparationCache = new WeakMap<FoodItem, { presets: unknown; values: string[] }>();
export function supportedPreparations(food: FoodItem): string[] {
  const cached = preparationCache.get(food);
  if (cached?.presets === _zonePresets) return cached.values;
  const result = new Set((food.preparationMethods ?? []).map((p) => p.toLowerCase()));
  for (const zone of Object.keys(getZonePresets())) for (const meal of getMealTemplates(zone as TZRegion)) {
    for (const slot of meal.items) if (slot.foodIds.includes(food.id)) result.add(slot.prep);
  }
  // An explicitly named preparation in the composition entry is supported.
  const name = food.name_en.toLowerCase();
  for (const prep of ['boiled','steamed','raw','grilled','fried']) if (name.includes(prep)) result.add(prep);
  const categories = Array.isArray(food.category) ? food.category : [food.category];
  if (categories.includes('fruit')) result.add('raw');
  const values = [...result];
  preparationCache.set(food, { presets: _zonePresets, values });
  return values;
}

export function getClinicZone(): TZRegion | null {
  try {
    const stored = localStorage.getItem(CLINIC_ZONE_KEY);
    return stored ? (stored as TZRegion) : null;
  } catch {
    return null;
  }
}

export function getFoodsSync(): FoodItem[] { return _foods ?? []; }
export function getRulesSync(): ClinicalRule[] { return _rules ?? []; }
export function getZonePresets(): Record<string, ZonePreset> { return _zonePresets ?? {}; }
export function isFoodsReady(): boolean { return state.status === 'ready' && !!_foods?.length && !!_rules?.length; }

export function getFoodsForZone(zone: TZRegion): FoodItem[] {
  const presets = getZonePresets();
  const preset = presets[zone];
  const allFoods = getFoodsSync();

  if (!preset) {
    return allFoods.filter(f => {
      const regions = Array.isArray(f.regions) ? f.regions : [f.regions];
      return regions.includes('All');
    });
  }

  const excluded = new Set(preset.excludeIds);
  return allFoods.filter(f => {
    if (excluded.has(f.id)) return false;
    const regions = Array.isArray(f.regions) ? f.regions : [f.regions];
    return regions.includes('All') || regions.includes(zone);
  });
}
