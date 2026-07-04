// RCRO NutritionTool — Kiswahili / English display helpers for meal plans

import { getFoodsSync } from './dataLoader';
import { formatMealPortion } from './mealPortions';
import type { FoodItem, MealItem } from './types';

export type PrepMethod = 'boiled' | 'steamed' | 'raw' | 'grilled';

const PREP_LABELS: Record<PrepMethod, [string, string]> = {
  boiled:  ['Boiled', 'Imechemshwa'],
  steamed: ['Steamed', 'Imevukwa'],
  raw:     ['Raw', 'Mbichi'],
  grilled: ['Grilled', 'Iliyoiva'],
};

export function localizePrep(prep: PrepMethod | string, lang: 'en' | 'sw'): string {
  const key = prep.toLowerCase() as PrepMethod;
  const pair = PREP_LABELS[key];
  if (pair) return lang === 'sw' ? pair[1] : pair[0];
  if (lang === 'sw' && /^boiled$/i.test(prep)) return 'Imechemshwa';
  if (lang === 'sw' && /^raw$/i.test(prep)) return 'Mbichi';
  return prep;
}

export function formatPortion(food: FoodItem, portionMultiplier: number, lang: 'en' | 'sw'): string {
  return formatMealPortion(food, portionMultiplier, lang);
}

export function formatMealItemDetail(item: MealItem, lang: 'en' | 'sw'): string {
  const food = getFoodsSync().find(f => f.id === item.foodId);
  const prep = localizePrep(item.prepMethod ?? item.preparation, lang);
  if (food && item.portionMultiplier != null) {
    return `${formatPortion(food, item.portionMultiplier, lang)}, ${prep}`;
  }
  if (lang === 'sw') {
    const portion = item.portionText.replace(/tea cup/gi, 'kikombe cha chai')
      .replace(/egg/gi, 'yai')
      .replace(/heaped tablespoon \(cooked\)/gi, 'kijiko kikubwa (waliopikwa)')
      .replace(/serving spoon \(cooked\)/gi, 'kijiko cha kupakulia (iliyopikwa)')
      .replace(/finger \(boiled\)/gi, 'kidole (iliyochemshwa)')
      .replace(/piece \(medium\)/gi, 'kipande (wastani)')
      .replace(/fruit \(medium\)/gi, 'tunda (wastani)')
      .replace(/avocado/gi, 'parachichi')
      .replace(/cup \(cooked\)/gi, 'kikombe (iliyopikwa)');
    return `${portion}, ${prep}`;
  }
  return `${item.portionText}, ${prep}`;
}

export function mealFoodName(item: MealItem, lang: 'en' | 'sw'): string {
  return lang === 'sw' ? item.name_sw : item.name_en;
}
