import type { GeneratedMealPlan } from './types';
import { approvalIsCurrent, validatePlan } from './planValidation';

export function nutritionReadiness(source:GeneratedMealPlan,language:'en'|'sw'):string[] {
  const sw=language==='sw',L=(en:string,translated:string)=>sw?translated:en;
  const plan=source.schemaVersion===2?validatePlan(source):source,a=plan.assessment;
  const pending:string[]=[];
  for(const [key,en,translated] of [
    ['allergyScreen','Complete allergy/intolerance screening.','Kamilisha uchunguzi wa mzio.'],
    ['pregnancyOrBreastfeeding','Complete pregnancy/breastfeeding screening.','Kamilisha uchunguzi wa ujauzito/unyonyeshaji.'],
    ['significantWeightLoss','Complete unintended weight-loss screening.','Kamilisha uchunguzi wa kupungua uzito bila kukusudia.'],
    ['specialistCondition','Complete kidney/heart/specialist-needs screening.','Kamilisha uchunguzi wa figo/moyo/mahitaji maalum.'],
  ] as const)if(!a||!a[key]||a[key]==='unknown')pending.push(L(en,translated));
  if(!a?.measurementDate||!Number.isFinite(Date.parse(a.measurementDate)))pending.push(L('Record a valid measurement date.','Rekodi tarehe sahihi ya vipimo.'));
  if(plan.validation?.status!=='complete')pending.push(L('Resolve unmet daily nutrient targets and clinical findings below.','Tatua malengo ya virutubisho na tahadhari zilizo hapa chini.'));
  if(!approvalIsCurrent(plan))pending.push(L('Clinician: confirm measurements, practical portions and daily adequacy before approval.','Mtaalamu: thibitisha vipimo, kiasi kinachotekelezeka na utoshelevu wa siku kabla ya kuidhinisha.'));
  return pending;
}
