// RCRO NutritionTool — BMR/TDEE calculators

import type { ActivityLevel } from './types';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  Sedentary:   1.2,
  Light:       1.375,
  Moderate:    1.55,
  Active:      1.725,
  'Very Active': 1.9,
};

export const WORK_TYPE_BONUS: Record<string, number> = {
  Sedentary: 0, Light: 50, Moderate: 100, Heavy: 200,
};

export const FITNESS_BONUS: Record<string, number> = {
  Beginner: 0, Intermediate: 50, Advanced: 100,
};

export function calculateBMR(params: {
  weightKg: number; heightCm: number; age: number; sex: 'male' | 'female';
}): number {
  const { weightKg, heightCm, age, sex } = params;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function calculateTDEE(params: {
  weightKg: number; heightCm: number; age: number; sex: 'male' | 'female';
  activityLevel: ActivityLevel | string;
  workType?: string;
  fitnessStatus?: string;
}): { bmr: number; tdee: number } {
  const bmr = calculateBMR(params);
  const pal = ACTIVITY_MULTIPLIERS[params.activityLevel as ActivityLevel] ?? 1.55;
  const workBonus = WORK_TYPE_BONUS[params.workType ?? 'Moderate'] ?? 100;
  const fitBonus = FITNESS_BONUS[params.fitnessStatus ?? 'Beginner'] ?? 0;
  const tdee = Math.round(bmr * pal + workBonus + fitBonus);
  return { bmr, tdee };
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) return 0;
  return weightKg / Math.pow(heightCm / 100, 2);
}

export function bmiCategory(bmi: number): 'Underweight' | 'Normal' | 'Overweight' | 'Obese' {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}
