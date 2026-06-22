// RCRO NutritionTool — macro/calorie targets

import { calculateTDEE, calculateBMI } from './calculators';
import { normalizeConditionList } from './conditions';
import type { NutritionTargets, ActivityLevel, BodyGoal } from './types';

export function computeNutritionTargets(params: {
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  activityLevel?: ActivityLevel | string;
  diagnoses: string[];
  bodyGoal?: BodyGoal;
}): NutritionTargets {
  const {
    age, sex, weightKg, heightCm,
    activityLevel = 'Moderate',
    diagnoses,
    bodyGoal = 'maintain',
  } = params;

  const { bmr, tdee: baseTDEE } = calculateTDEE({
    weightKg, heightCm, age, sex, activityLevel, workType: 'Moderate', fitnessStatus: 'Beginner',
  });

  const bmi = calculateBMI(weightKg, heightCm);
  const dx = normalizeConditionList(diagnoses);

  const hasDM    = dx.some(d => /dm|diabetes/i.test(d));
  const hasHTN   = dx.some(d => /htn|hypertension/i.test(d));
  const hasCKD   = dx.some(d => /ckd|kidney/i.test(d));
  const hasHF    = dx.some(d => /hf|heart failure/i.test(d));
  const hasTB    = dx.some(d => /tb|tuberculosis/i.test(d));
  const hasHIV   = dx.some(d => /hiv/i.test(d));
  const isObese  = bmi >= 30;

  let tdee = baseTDEE;
  if (hasTB || hasHIV) tdee = Math.round(tdee * 1.10);
  if (hasHF) tdee -= 100;
  if ((hasHTN || hasDM) && isObese) tdee -= 300;

  let targetCalories = tdee;
  if (bodyGoal === 'lose_weight') {
    const deficit = isObese ? 500 : 300;
    targetCalories = Math.max(tdee - deficit, bmr + 200);
  } else if (bodyGoal === 'gain_muscle') {
    targetCalories = tdee + (isObese ? 200 : 350);
  }

  let proteinG = Math.round(weightKg * 0.9);
  if (hasCKD) proteinG = Math.round(weightKg * 0.7);
  if (hasTB || hasHIV) proteinG = Math.round(weightKg * 1.2);
  if (bodyGoal === 'gain_muscle') proteinG = Math.round(weightKg * 1.5);
  if (hasCKD && bodyGoal === 'gain_muscle') proteinG = Math.min(proteinG, Math.round(weightKg * 1.0));

  let sodiumMg = 2300;
  if (hasHTN || hasHF) sodiumMg = 1500;
  if (hasCKD) sodiumMg = 2000;

  const fatG = Math.round(weightKg * 0.9);

  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbsG = Math.max(50, Math.round((targetCalories - proteinKcal - fatKcal) / 4));

  const carbsCapped = hasDM ? Math.min(carbsG, Math.round(targetCalories * 0.50 / 4)) : carbsG;

  const fiberG = hasDM ? 38 : 25;

  return {
    bmr,
    tdee: targetCalories,
    proteinG,
    carbsG: Math.max(50, carbsCapped),
    fatG,
    sodiumMg,
    fiberG,
  };
}

export function getNutritionRiskLevel(
  diagnoses: string[],
  bmi: number,
  sodiumMg: number,
): 'Low' | 'Moderate' | 'High' {
  const dx = normalizeConditionList(diagnoses);
  const hasDM  = dx.some(d => /dm|diabetes/i.test(d));
  const hasHTN = dx.some(d => /htn|hypertension/i.test(d));
  const hasCKD = dx.some(d => /ckd|kidney/i.test(d));
  const hasHF  = dx.some(d => /hf|heart failure/i.test(d));

  if (hasCKD || hasHF || (hasDM && hasHTN)) return 'High';
  if (hasDM || hasHTN || bmi >= 30 || sodiumMg < 1600) return 'Moderate';
  return 'Low';
}
