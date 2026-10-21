import type { GeneratedMealPlan } from '../../lib/clinical/types';
import { localizePrep, formatMealItemDetail, mealFoodName } from '../../lib/clinical/mealLocalization';
import { planStatusText, planNutritionText, planAssumptions, validatePlan, approvalIsCurrent, findFood } from '../../lib/clinical/planValidation';
import { NUTRITION_POLICY } from '../../lib/clinical/nutritionPolicy';

export type ExportAudience = 'patient' | 'full';
export interface ExportOptions { audience?: ExportAudience }
export const EXPORT_FORMAT_VERSION = 'meal-document-4';
export interface DocumentBlock { heading?: string; lines: string[]; tone?: 'warning' | 'normal' }
export interface DocumentSection { title: string; blocks: DocumentBlock[] }
export interface MealDocument { title:string; patient:string; date:string; status:string; version:string; sections:DocumentSection[] }

export function buildMealDocument(source: GeneratedMealPlan, patient:string, language:'en'|'sw', options:ExportOptions={}): MealDocument {
  // Validate a copy at export time; never rewrite a saved/approved snapshot.
  const plan=source.schemaVersion===2 ? validatePlan(source) : source;
  const sw=language==='sw', L=(en:string, translated:string)=>sw?translated:en;
  const status=planStatusText(plan,language);
  const issues=plan.validation?.issues.map(i=>sw?i.message_sw:i.message_en) ?? [];
  const guidance = plan.foodGuidance?.map(g=> {
    const prep=g.preparation.toLowerCase()==='any' ? L('all preparations','maandalizi yote') : localizePrep(g.preparation,language);
    const alternative=g.alternative ? ' '+(sw?g.alternative.message_sw:g.alternative.message_en)+': '+localizePrep(g.alternative.preparation,language)+'.' : '';
    return (sw?g.name_sw:g.name_en)+' - '+prep+': '+g.reasons.map(r=>sw?r.message_sw:r.message_en).join(' ')+alternative;
  }) ?? plan.avoidFoods.map(g=>(sw?g.name_sw:g.name_en)+': '+(sw?g.reason_sw:g.reason_en)+' '+L('(Legacy guidance; preparation not recorded. Regenerate.)','(Mwongozo wa zamani; maandalizi hayajarekodiwa. Tengeneza tena.)'));
  const drugLines=plan.drugAlerts.map(a=>(sw?a.title_sw:a.title_en)+': '+(sw?a.body_sw:a.body_en));
  const salt=(plan.targets.sodiumMg*2.5/1000).toFixed(2).replace(/0$/,'');
  const patientBlocks:DocumentBlock[]=[
    ...(issues.length ? [{heading:L('Review before use','Hakiki kabla ya matumizi'),lines:issues,tone:'warning' as const}] : []),
    ...plan.meals.map(meal=>({heading:(sw?meal.name_sw:meal.name_en)+' - '+meal.totalCalories+' kcal',lines:meal.items.length ? meal.items.map(item=> { const food=findFood(item.foodId); const categories=food ? (Array.isArray(food.category)?food.category:[food.category]) : []; const fruit=categories.includes('fruit') && meal.mealType!=='Snack'; return (fruit?L('Fruit alongside meal: ','Tunda pembeni ya mlo: '):'')+mealFoodName(item,language)+' - '+formatMealItemDetail(item,language); }) : [L('Meal could not be completed.','Mlo haujakamilika.')]})),
    {heading:L('Portions and preparation','Vipimo na maandalizi'),lines:[
      L('Use these portions; count added oil, salt and ingredients in daily totals.','Tumia vipimo hivi; hesabu mafuta, chumvi na viungo vya ziada.'),
      ...[...new Map(plan.meals.flatMap(m=>m.items).filter(i=>!/ugali|stiff/i.test(i.name_en) && /porridge|uji/i.test(i.name_en+' '+i.name_sw)).map(i=>[i.foodId,i])).values()].map(i=>
        (sw?i.name_sw:i.name_en)+': '+(i.gramsPerHouseholdUnit != null ? L('1 catalogue cup = ','kikombe 1 cha orodha = ')+i.gramsPerHouseholdUnit+L(' g prepared porridge. Confirm cup size and thickness.',' g za uji uliopikwa. Thibitisha kikombe na uzito wa uji.') : L('Cup weight was not recorded; use the saved gram weight and confirm the household measure.','Uzito wa kikombe haukurekodiwa; tumia gramu zilizohifadhiwa na thibitisha kipimo.'))),
      L('Sodium limit: ','Kikomo cha sodiamu: ')+plan.targets.sodiumMg+' mg '+L('(about ','(takriban ')+salt+L(' g total dietary salt, not extra cooking salt).',' g za chumvi kutoka vyakula vyote, si chumvi ya ziada ya kupikia).'),
    ]},
    ...(drugLines.length ? [{heading:L('Your medicines and food','Dawa zako na chakula'),lines:drugLines,tone:'warning' as const}] : []),
    ...(plan.foodGuidance?.some(g=>plan.meals.some(m=>m.items.some(i=>i.foodId===g.foodId))) ? [{heading:L('Food and preparation precautions','Tahadhari za vyakula na maandalizi'),lines:guidance.filter((_,i)=>plan.meals.some(m=>m.items.some(item=>item.foodId===plan.foodGuidance?.[i]?.foodId)))}] : []),
  ];
  const input=plan.inputSnapshot, a=plan.assessment;
  const answer=(v:unknown)=>v==='no'?L('No','Hapana'):v==='yes'?L('Yes - review required','Ndiyo - uhakiki unahitajika'):L('Not assessed','Haijatathminiwa');
  const activity:Record<string,string>={Sedentary:'Kukaa zaidi',Light:'Nyepesi',Moderate:'Wastani',Active:'Hai','Very Active':'Hai sana'};
  const goals:Record<string,string>={maintain:'Dumisha uzito',lose_weight:'Punguza uzito',gain_muscle:'Ongeza misuli'};
  const clinicalBlocks:DocumentBlock[]=[
    {heading:L('Assessment and measurements','Tathmini na vipimo'),lines: input && a ? [
      L('Age: ','Umri: ')+input.age+'; '+L('Sex: ','Jinsia: ')+(input.sex==='male'?L('Male','Mwanaume'):L('Female','Mwanamke')),
      L('Weight: ','Uzito: ')+input.weightKg+' kg; '+L('Height: ','Urefu: ')+input.heightCm+' cm; BMI: '+(input.weightKg/Math.pow(input.heightCm/100,2)).toFixed(1),
      L('Measurement date: ','Tarehe ya vipimo: ')+a.measurementDate,
      L('Activity: ','Shughuli: ')+(sw?activity[a.activityLevel]:a.activityLevel)+'; '+L('Goal: ','Lengo: ')+(sw?goals[a.bodyGoal]:a.bodyGoal),
      L('Allergy/intolerance: ','Mzio/kutovumilia: ')+answer(a.allergyScreen)+(a.allergyDetails?' - '+a.allergyDetails:''),
      L('Pregnant/breastfeeding: ','Mjamzito/ananyonyesha: ')+answer(a.pregnancyOrBreastfeeding),
      L('Recent unintended weight loss: ','Kupungua uzito bila kukusudia: ')+answer(a.significantWeightLoss),
      L('Kidney/heart failure/other specialist needs: ','Figo/moyo/mahitaji ya mtaalamu: ')+answer(a.specialistCondition),
      L('Diagnoses: ','Utambuzi: ')+plan.diagnosis,
      L('Nutrition-risk label is a limited software screen, not a full clinical assessment.','Lebo ya hatari ya lishe ni uchunguzi wa programu, si tathmini kamili ya kitabibu.'),
    ] : [L('Assessment unavailable - legacy plan.','Tathmini haipatikani - mpango wa zamani.')]},
    {heading:L('Planned / selected daily targets','Jumla iliyopangwa / malengo ya siku'),lines:planNutritionText(plan,language).split(' | ')},
    {heading:L('Calculation assumptions and adjustments','Dhana za hesabu na marekebisho'),lines:planAssumptions(plan,language)},
    {heading:L('Clinical approval','Idhini ya kitabibu'),lines: approvalIsCurrent(plan) && plan.approval ? [plan.approval.accountName,plan.approval.approvedAt,plan.approval.note,L('Device: ','Kifaa: ')+plan.approval.deviceId] : [status]},
    ...(guidance.length ? [{heading:L('Food and preparation precautions','Tahadhari za vyakula na maandalizi'),lines:guidance}] : []),
    {heading:L('Versions and references','Matoleo na marejeo'),lines:[EXPORT_FORMAT_VERSION,plan.policyVersion ?? L('Policy unavailable','Sera haipatikani'),plan.datasetVersion ?? L('Dataset unavailable','Data haipatikani'),...NUTRITION_POLICY.sources.map(s=>s.title+' - '+s.url)]},
  ];
  return {title:L('Daily meal plan','Mpango wa chakula wa siku'),patient,date:plan.date,status,version:EXPORT_FORMAT_VERSION,sections:[{title:L('Patient meal plan','Mpango wa mgonjwa'),blocks:patientBlocks},...(options.audience==='patient'?[]:[{title:L('Clinician review','Uhakiki wa mtaalamu'),blocks:clinicalBlocks}])]};
}

export function documentPlainText(doc:MealDocument):string {
  return [doc.title,doc.patient+' | '+doc.date,doc.status,...doc.sections.flatMap(section=>[section.title,...section.blocks.flatMap(block=>[block.heading??'',...block.lines])])].join('\n');
}
