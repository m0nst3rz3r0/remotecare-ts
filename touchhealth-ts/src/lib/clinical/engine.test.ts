import { describe, it, expect } from 'vitest';
import { normalizeConditionList } from './conditions';
import { computeNutritionTargets } from './nutritionEngine';
import { toMedIds } from './drugMapper';
import { getDrugFoodInteractions } from './drugInteractions';

describe('clinical nutrition engine', () => {
  it('normalizes DM and I10 to HTN', () => {
    const conds = normalizeConditionList(['DM', 'I10', 'DM+HTN']);
    expect(conds).toContain('DM');
    expect(conds).toContain('HTN');
  });

  it('computes targets for HTN+DM female 52yo 65kg 162cm', () => {
    const targets = computeNutritionTargets({
      age: 52,
      sex: 'female',
      weightKg: 65,
      heightCm: 162,
      activityLevel: 'Moderate',
      diagnoses: ['HTN', 'DM'],
      bodyGoal: 'maintain',
    });
    expect(targets.tdee).toBeGreaterThan(1400);
    expect(targets.tdee).toBeLessThan(2100);
    expect(targets.sodiumMg).toBe(1500);
    expect(targets.proteinG).toBeGreaterThan(40);
    expect(targets.proteinG).toBeLessThan(80);
    const macroCalories = (targets.proteinG * 4) + (targets.carbsG * 4) + (targets.fatG * 9);
    expect(Math.abs(macroCalories - targets.tdee)).toBeLessThanOrEqual(20);
  });

  it('maps Warfarin and Amlodipine to MED ids', () => {
    const medIds = toMedIds(['Warfarin 5mg', 'Amlodipine 10mg', 'Metformin 500mg']);
    expect(medIds).toContain('MED_WARFARIN');
    expect(medIds).toContain('MED_CCB');
    expect(medIds).toContain('MED_METFORMIN');
  });

  it('fires warfarin and CCB drug-food alerts', () => {
    const medIds = toMedIds(['Warfarin 5mg', 'Amlodipine 10mg']);
    const alerts = getDrugFoodInteractions(medIds);
    expect(alerts.some(a => a.id === 'warfarin-vitk')).toBe(true);
    expect(alerts.some(a => a.id === 'ccb-grapefruit')).toBe(true);
  });
});
