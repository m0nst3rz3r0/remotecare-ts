import type { NutritionAssessment } from './types';

export const NUTRITION_POLICY = {
  version: 'adult-dm-htn-2.1.0',
  reviewStatus: 'pending_local_clinical_review',
  reviewedBy: null,
  reviewedAt: null,
  calorieTolerance: 0.10,
  proteinTolerance: 0.20,
  sources: [
    { title: 'NICE low-energy diet safeguards', url: 'https://www.nice.org.uk/guidance/ng246/chapter/Physical-activity-and-diet' },
    { title: 'WHO sodium and salt equivalents', url: 'https://www.who.int/news-room/fact-sheets/detail/sodium-reduction' },
    { title: 'NHS amlodipine food precautions', url: 'https://www.nhs.uk/medicines/amlodipine/' },
    { title: 'WHO healthy diet', url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet' },
    { title: 'KDIGO CKD guidance — specialist review scope', url: 'https://kdigo.org/guidelines/ckd-evaluation-and-management/' },
    { title: 'NIDDK eating and peptic ulcers', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/peptic-ulcers-stomach-ulcers/eating-diet-nutrition' },
  ],
} as const;

export function defaultNutritionAssessment(): NutritionAssessment {
  return { activityLevel: 'Moderate', bodyGoal: 'maintain', excludedFoodIds: [], allergyScreen: 'unknown', allergyDetails: '',
    pregnancyOrBreastfeeding: 'unknown', significantWeightLoss: 'unknown', specialistCondition: 'unknown',
    measurementDate: '', cookingIngredients: [] };
}

/** Provenance is intentionally explicit: original catalogue citations await review. */
export const NUTRITION_DATA_METADATA = {
  schemaVersion: 2,
  catalogueSources: ['public/foods.json', 'public/rules.json', 'src/data/zoneAvailabilityPresets.json', 'src/lib/clinical/mealTemplates.ts'],
  provenanceStatus: 'original_composition_sources_unverified',
  reviewStatus: 'pending_local_dietitian_review',
  reviewedBy: null,
  reviewedAt: null,
} as const;
