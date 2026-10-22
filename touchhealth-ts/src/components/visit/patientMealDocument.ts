import type { GeneratedMealPlan } from '../../lib/clinical/types';
import type { MealDocument, DocumentBlock } from './mealDocument';
import { approvalIsCurrent } from '../../lib/clinical/planValidation';
import { localizePrep, formatMealItemDetail, neutralFoodName } from '../../lib/clinical/mealLocalization';

/** Patient-facing, bounded summary. Detailed clinical records stay in the app. */
export function patientMealDocument(plan:GeneratedMealPlan,language:'en'|'sw',facility:string):MealDocument {
  const sw=language==='sw',L=(en:string,translated:string)=>sw?translated:en;
  const used=new Set(plan.meals.flatMap(m=>m.items.map(i=>i.foodId)));
  const guide=plan.foodChoiceGuide;
  const provisional=guide?.provisional !== false || plan.stale || plan.validation?.status!=='complete';
  const choices:DocumentBlock[]=[];
  const potential=(guide?.entries??[]).filter(e=>e.available && (e.status==='suitable'||(guide?.provisional&&e.status==='not_assessed'&&e.foodAssessment==='Safe'))).sort((a,b)=>Number(used.has(b.foodId))-Number(used.has(a.foodId)));
  const grouped:string[]=[];
  const seen=new Set<string>();
  for(const [cats,en,translated,count] of [
    [['carb'],'Starches','Vyakula vya wanga',3],
    [['protein'],'Proteins','Vyakula vya protini',3],
    [['vegetable','veg','vitamin'],'Vegetables','Mboga',3],
    [['fruit'],'Fruits','Matunda',3],
    [['fat'],'Fats in small portions','Mafuta kwa kiasi kidogo',2],
  ] as const){
    const picked=potential.filter(e=>!seen.has(e.foodId)&&cats.some(c=>e.categories.includes(c))).filter((e,i,all)=>all.findIndex(x=>x.foodId===e.foodId)===i).slice(0,count);
    picked.forEach(e=>seen.add(e.foodId));
    if(picked.length)grouped.push(L(en,translated)+': '+picked.map(e=>neutralFoodName(e,language)+' ('+localizePrep(e.preparation,language)+')').join('; '));
  }
  choices.push({heading:guide?.provisional?L('Food choices to confirm with your clinician','Chaguo za vyakula za kuthibitisha na mtaalamu'):L('Foods to eat in the agreed portions','Vyakula vya kula kwa kiasi kilichoshauriwa'),lines:grouped.length?grouped:[L('Ask your clinician to confirm your choices.','Muulize mtaalamu athibitishe vyakula vinavyokufaa.')]});
  for(const [status,en,translated] of [['limit','Foods to eat in smaller amounts','Vyakula vya kula kwa kiasi kidogo'],['avoid','Foods and preparations to avoid','Vyakula na maandalizi ya kuepuka']] as const){
    const entries=(guide?.entries??[]).filter(e=>e.status===status && e.available).sort((a,b)=>Number(used.has(b.foodId))-Number(used.has(a.foodId)));
    const unique=[...new Map(entries.map(e=>[e.foodId,e])).values()].slice(0,3);
    choices.push({heading:L(en,translated),lines:unique.length?unique.map(e=>neutralFoodName(e,language)+' - '+localizePrep(e.preparation,language)+(status==='avoid'?': '+briefReason(e.reasons.map(r=>sw?r.message_sw:r.message_en),language):'; '+(sw?e.portion_sw:e.portion_en)+' ('+e.grams+' g)')):[L('Ask your clinician to confirm your choices.','Muulize mtaalamu athibitishe vyakula vinavyokufaa.')]});
  }
  choices.push({heading:L('How to use this guide','Jinsi ya kutumia mwongozo'),lines:[L('These are examples. Eat the portions agreed with your clinician; suitable does not mean unlimited.','Hii ni mifano. Kula kiasi ulichokubaliana na mtaalamu; usile bila kikomo.'),L('Ask before replacing foods, especially if you have allergies or kidney disease.','Uliza kabla ya kubadili vyakula, hasa ukiwa na mzio au ugonjwa wa figo.')]});
  const meals=plan.meals.slice(0,4).map(m=>({heading:m.mealType==='Snack'?L('Planned snack','Kitafunwa kilichopangwa'):(sw?m.name_sw:m.name_en),lines:m.items.slice(0,5).map(i=>neutralFoodName(i,language)+' — '+formatMealItemDetail(i,language))}));
  const advice:DocumentBlock[]=[{heading:L('Preparation and portions','Maandalizi na kiasi'),lines:[L('Use the household portions and gram weights shown. Do not add sugar to porridge.','Tumia vipimo vya nyumbani na gramu zilizoonyeshwa. Usiongeze sukari kwenye uji.'),L('Snacks shown are already part of the day, not extra meals.','Vitafunwa vilivyoonyeshwa ni sehemu ya siku, si milo ya ziada.'),L('Count cooking oil and salt as part of your meals.','Hesabu mafuta na chumvi ya kupikia kama sehemu ya milo yako.')]}];
  if(plan.drugAlerts.length)advice.push({heading:L('Your medicines and food','Dawa zako na chakula'),lines:plan.drugAlerts.slice(0,4).map(a=>sw?a.title_sw:a.title_en)});
  advice.push({heading:L('Your next step','Hatua inayofuata'),lines:[approvalIsCurrent(plan)?L('Follow the agreed plan. Ask your clinician about changes.','Fuata mpango uliokubaliwa. Uliza mtaalamu kuhusu mabadiliko.'):L('Discuss these food choices and sample meals with your clinician before following them.','Jadili vyakula hivi na mfano wa milo na mtaalamu kabla ya kuufuata.')]});
  return {title:L('Your food and meal guide','Mwongozo wako wa chakula'),patient:plan.patientCode,date:plan.date,facility,
    status:approvalIsCurrent(plan)?L('Reviewed by your clinician','Umehakikiwa na mtaalamu'):L('Discuss with your clinician before use','Jadili na mtaalamu kabla ya matumizi'),
    version:'patient-handout-3',patientFacing:true,sections:[{title:L('Your food choices','Uchaguzi wako wa vyakula'),blocks:[...choices,...advice]},{title:provisional?L('Sample meals to discuss with your clinician','Mfano wa milo ya kujadili na mtaalamu'):L('Sample daily meal combinations','Mfano wa mchanganyiko wa milo ya siku'),blocks:meals}]};
}

function briefReason(reasons:string[],language:'en'|'sw'):string {
 const first=[...new Set(reasons)].find(r=>!r.includes('Screening incomplete')&&!r.includes('Uchunguzi haujakamilika'));
 const sentence=first?.split(/(?<=[.!?])\s/)[0];
 return sentence && sentence.length<=140 ? sentence : language==='sw'?'Huenda hakifai kwa hali au dawa zako; uliza mtaalamu.':'May be unsuitable for your conditions or medicines; ask your clinician.';
}
