import type { GeneratedMealPlan } from './types';

export function patientExportProblem(plan:GeneratedMealPlan,language:'en'|'sw'):string|null {
  const sw=language==='sw';
  if(plan.assessment?.availableFoodIds?.length===0)return sw
    ?'Chagua vyakula vinavyopatikana, au zima kikomo hicho, kisha tengeneza mpango tena. Hakuna chakula kilichochaguliwa.'
    :'No available foods are selected. Select foods or turn off the availability restriction, then regenerate the plan.';
  if(!['Breakfast','Lunch','Dinner'].every(type=>plan.meals.some(m=>m.mealType===type&&m.items.some(i=>!i.ingredient))))return sw
    ?'Baadhi ya milo haina chakula. Hakiki vyakula vinavyopatikana na vilivyoondolewa, kisha tengeneza mpango tena kabla ya kumpa mgonjwa.'
    :'One or more main meals have no food. Review available and excluded foods, then regenerate before exporting a patient handout.';
  return null;
}
