// RCRO NutritionTool — shared types

export type Severity = 'Safe' | 'Warning' | 'Danger';
export type ActivityLevel = 'Sedentary' | 'Light' | 'Moderate' | 'Active' | 'Very Active';
export type BodyGoal = 'lose_weight' | 'maintain' | 'gain_muscle';
export type TZRegion =
  | 'All'
  | 'Lake Zone'
  | 'Coast'
  | 'Zanzibar'
  | 'Northern Highlands'
  | 'Southern Highlands'
  | 'Central'
  | 'Western';

export type CanonicalCondition =
  | 'DM' | 'HTN' | 'CKD' | 'HF' | 'PUD'
  | 'HIV' | 'TB' | 'Anemia' | 'Obesity' | 'Dyslipid' | 'General';

export interface FoodServing {
  unit_en: string;
  unit_sw: string;
  grams_per_unit: number;
  default_units: number;
}

export interface FoodMacros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sodium_mg: number;
  fiber_g?: number;
}

export interface FoodItem {
  id: string;
  name_en: string;
  name_sw: string;
  category: string | string[];
  regions: string[];
  glycemic_index: 'Low' | 'Medium' | 'High';
  macros_per_100g: FoodMacros;
  serving?: FoodServing;
  preparationMethods?: string[];
}

export interface ClinicalRule {
  id: string;
  target_food_id: string | null;
  target_prep_method: string;
  condition: string;
  safety_level: Severity;
  alert_message_en: string;
  alert_message_sw: string;
}

export interface EvaluationResult {
  severity: Severity;
  message_en: string;
  message_sw: string;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
  fiberG: number;
}

export interface MealItem {
  foodId: string;
  name_en: string;
  name_sw: string;
  portionText: string;
  preparation: string;
  /** For re-localizing portions when language toggles */
  portionMultiplier?: number;
  prepMethod?: string;
  macros: { calories: number; protein: number; carbs: number; fat: number };
}

export interface DailyMeal {
  mealType: 'Breakfast' | 'Lunch' | 'Dinner';
  name_en: string;
  name_sw: string;
  items: MealItem[];
  totalCalories: number;
  culturalNote?: string;
  culturalNote_en?: string;
  culturalNote_sw?: string;
}

export interface DrugFoodInteraction {
  id: string;
  medicationId: string;
  severity: 'info' | 'warning';
  title_en: string;
  title_sw: string;
  body_en: string;
  body_sw: string;
}

export interface GeneratedMealPlan {
  patientCode: string;
  date: string;
  diagnosis: string;
  /** Clinical condition codes used to build cautions and safety rules */
  conditions?: string[];
  region: TZRegion;
  language: 'en' | 'sw';
  targets: NutritionTargets;
  bmi?: number;
  nutritionRisk?: 'Low' | 'Moderate' | 'High';
  meals: DailyMeal[];
  drugAlerts: DrugFoodInteraction[];
  cautions: string[];
  avoidFoods: { name_en: string; name_sw: string; reason_en: string; reason_sw: string }[];
  recommendedFoods?: {
    starch:    { id: string; name_en: string; name_sw: string }[];
    protein:   { id: string; name_en: string; name_sw: string }[];
    vegetable: { id: string; name_en: string; name_sw: string }[];
    fruit:     { id: string; name_en: string; name_sw: string }[];
  };
  generatedAt: string;
}

export interface ZonePreset {
  coreStaples: string[];
  excludeIds: string[];
}
