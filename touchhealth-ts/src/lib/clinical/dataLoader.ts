// RCRO NutritionTool — static data loader

import type { FoodItem, ClinicalRule, ZonePreset, TZRegion } from './types';

let _foods: FoodItem[] | null = null;
let _rules: ClinicalRule[] | null = null;
let _zonePresets: Record<string, ZonePreset> | null = null;

const CLINIC_ZONE_KEY = 'rcro_clinic_zone';

export async function preloadClinicalData(): Promise<void> {
  const [foodsRes, rulesRes] = await Promise.all([
    fetch('/foods.json'),
    fetch('/rules.json'),
  ]);

  const foodsRaw = await foodsRes.json();
  const rulesRaw = await rulesRes.json();

  _foods = Array.isArray(foodsRaw) ? foodsRaw : (foodsRaw.foods ?? []);
  _rules = Array.isArray(rulesRaw) ? rulesRaw : (rulesRaw.rules ?? []);
}

export function loadZonePresets(presets: Record<string, ZonePreset>): void {
  _zonePresets = presets;
}

/** Test-only helper to inject foods/rules without fetch. */
export function setClinicalDataForTests(foods: FoodItem[], rules: ClinicalRule[]): void {
  _foods = foods;
  _rules = rules;
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
export function isFoodsReady(): boolean { return (_foods?.length ?? 0) > 0; }

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
