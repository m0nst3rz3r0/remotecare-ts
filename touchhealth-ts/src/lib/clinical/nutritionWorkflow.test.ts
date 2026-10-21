import { getDrugFoodInteractions } from './drugInteractions';
import { formatMealItemDetail } from './mealLocalization';
import { refreshNutritionPlans } from '../../services/nutritionRecords';
import type { Patient } from '../../types';
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadZonePresets, setClinicalDataForTests, validateClinicalData, getClinicalDataState, getFoodsSync, supportedPreparations, preloadClinicalData } from './dataLoader';
import { isMealStarch } from './mealComposition';
import { generateMealPlan } from './mealPlanner';
import { getFoodGuidance, evalFoodForPatient } from './foodSafety';
import { defaultNutritionAssessment } from './nutritionPolicy';
import { approvePlan, editPlanItem, isPlanStale, makeMealItem, planStatusText, sumNutrients, validatePlan } from './planValidation';
import { getPracticalPortionLimit } from './mealPortions';
import { buildDietarySlipHtml } from '../../components/visit/DietarySlip';
import presets from '../../data/zoneAvailabilityPresets.json';
import type { FoodItem, ClinicalRule, NutritionAssessment, TZRegion, ZonePreset } from './types';
const read = (name: string) => JSON.parse(readFileSync(new URL('../../../public/'+name+'.json',import.meta.url),'utf8'));
const foodRaw = read('foods'), ruleRaw = read('rules');
const foods: FoodItem[] = foodRaw.foods ?? foodRaw, rules: ClinicalRule[] = ruleRaw.rules ?? ruleRaw;
function install(){ loadZonePresets(presets as Record<string, ZonePreset>); setClinicalDataForTests(foods,rules); }
const screened = (): NutritionAssessment => ({ ...defaultNutritionAssessment(), allergyScreen:'no', pregnancyOrBreastfeeding:'no', significantWeightLoss:'no', specialistCondition:'no', measurementDate:'2026-10-01' });
const base = {patientCode:'KG-A-M0001',age:55,sex:'female' as const,weightKg:65,heightCm:162,conditions:['DM','HTN'],zone:'Lake Zone' as TZRegion,language:'en' as const,medicationIds:[]};
beforeAll(install);
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();install();});
describe('nutrition data integrity',()=>{
  it('validates the shipped catalogue and quarantines orphan rules',()=>{
    const result=validateClinicalData(foods,rules);
    expect(result.quarantinedRuleIds).toEqual(expect.arrayContaining(['rule_034','rule_037','rule_052']));
    expect(getClinicalDataState().status).toBe('ready');
    expect(result.version).toMatch(/^foods-/);
  });
  it('rejects duplicate IDs, missing nutrients and invalid servings',()=>{
    expect(()=>validateClinicalData([...foods,foods[0]],rules)).toThrow(/duplicate/);
    const broken=structuredClone(foods);broken[0].macros_per_100g.fiber_g=undefined;
    expect(()=>validateClinicalData(broken,rules)).toThrow(/nutrient/);
    broken[0]=structuredClone(foods[0]);broken[0].serving!.grams_per_unit=0;
    expect(()=>validateClinicalData(broken,rules)).toThrow(/serving/);
    expect(()=>validateClinicalData(foods,[...rules,rules[0]])).toThrow(/duplicate/);
  });
  it('never calls unknown foods, unsupported preparation or missing rules safe',()=>{
    expect(evalFoodForPatient('missing','boiled',['DM']).severity).toBe('not_assessed');
    expect(evalFoodForPatient(foods[0].id,'unassessed',['DM']).severity).toBe('not_assessed');
    setClinicalDataForTests(foods,[]);
    expect(evalFoodForPatient('food_014','boiled',['HTN']).severity).toBe('not_assessed');
    expect(()=>generateMealPlan(base)).toThrow(/datasets/);
  });
  it('applies medication-specific food rules to generated meals',()=>{
    const original=generateMealPlan({...base,assessment:screened()});const foodId=original.meals[0].items[0].foodId;
    setClinicalDataForTests(foods,[...rules,{id:'med-test',target_food_id:foodId,target_prep_method:'Any',condition:'MED_TEST',safety_level:'Danger',alert_message_en:'Medication restriction',alert_message_sw:'Kizuizi cha dawa'}]);
    const plan=generateMealPlan({...base,assessment:screened(),medicationIds:['MED_TEST']});
    expect(plan.meals.flatMap(m=>m.items).some(i=>i.foodId===foodId)).toBe(false);
    expect(()=>editPlanItem(plan,0,0,foodId,.5,original.meals[0].items[0].preparation)).toThrow(/restricted/);
  });
  it('returns every matching reason',()=>{
    const custom=rules.filter(r=>r.id!=='extra-one'&&r.id!=='extra-two');
    for(const id of ['extra-one','extra-two'])custom.push({id,target_food_id:'food_014',target_prep_method:'Any',condition:'ALL',safety_level:'Warning',alert_message_en:id,alert_message_sw:id});
    setClinicalDataForTests(foods,custom);
    expect(evalFoodForPatient('food_014','boiled',['HTN']).reasons?.map(r=>r.ruleId)).toEqual(expect.arrayContaining(['extra-one','extra-two']));
  });
  it('restores a validated dataset after restart and failed fetch',async()=>{
    const cache=new Map<string,string>();
    vi.stubGlobal('localStorage',{getItem:(k:string)=>cache.get(k)??null,setItem:(k:string,v:string)=>cache.set(k,v)});
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('foods')?foods:rules})));
    await preloadClinicalData();setClinicalDataForTests([],[]);
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
    await preloadClinicalData();expect(getClinicalDataState()).toMatchObject({status:'ready',cached:true});
    expect(generateMealPlan({...base,assessment:screened()}).schemaVersion).toBe(2);
  });
});
describe('daily completeness and safe review',()=>{
  for(const zone of Object.keys(presets)) for(const conditions of [['DM'],['HTN'],['DM','HTN'],['DM','HTN','CKD']]){
    it(`${zone}: ${conditions.join('+')} meets checks or explains unmet requirements`,()=>{
      vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-17T08:00:00Z'));
      const plan=generateMealPlan({...base,zone:zone as TZRegion,conditions,assessment:screened()});
      expect(plan.totals).toEqual(sumNutrients(plan.meals.flatMap(m=>m.items)));
      if(plan.validation?.status==='complete'){
        expect(Math.abs(plan.totals!.calories-plan.targets.tdee)).toBeLessThanOrEqual(plan.targets.tdee*.1);
        expect(Math.abs(plan.totals!.protein-plan.targets.proteinG)).toBeLessThanOrEqual(plan.targets.proteinG*.2);
        expect(plan.totals!.sodiumMg).toBeLessThanOrEqual(plan.targets.sodiumMg);
        expect(plan.totals!.fiberG).toBeGreaterThanOrEqual(plan.targets.fiberG);
        expect(plan.meals.filter(m=>m.mealType!=='Snack').every(m=>m.items.length>0)).toBe(true);
      }else expect(plan.validation!.issues.length).toBeGreaterThan(0);
      if(conditions.includes('CKD'))expect(plan.validation?.status).toBe('needs_review');
      for(const meal of plan.meals)for(const item of meal.items){
        expect(item.grams).toBeGreaterThan(0);
        if(item.portionMultiplier){const food=foods.find(f=>f.id===item.foodId)!;expect(item.portionMultiplier).toBeLessThanOrEqual(getPracticalPortionLimit(food,meal.mealType));expect(item.portionMultiplier*food.serving!.default_units*2).toBeCloseTo(Math.round(item.portionMultiplier*food.serving!.default_units*2));}
      }
    });
  }
  it('empty availability produces explicit incomplete meals',()=>{
    const plan=generateMealPlan({...base,assessment:{...screened(),availableFoodIds:[]}});
    expect(plan.validation?.status).toBe('incomplete');expect(plan.validation?.issues.map(i=>i.code)).toContain('empty_meal');
  });
  it('screens unknown and positive allergies and pregnancy for review',()=>{
    expect(generateMealPlan(base).validation?.status).toBe('needs_review');
    for(const key of ['allergyScreen','pregnancyOrBreastfeeding','significantWeightLoss','specialistCondition'] as const){
      const plan=generateMealPlan({...base,assessment:{...screened(),[key]:'yes'}});
      expect(plan.validation?.status).toBe('needs_review');expect(()=>approvePlan(plan,{accountId:'x',accountName:'Doctor',deviceId:'a',note:'review'})).toThrow();
    }
  });
  it('rejects invalid input and target adjustments',()=>{
    for(const weightKg of [0,-1,NaN,Infinity])expect(()=>generateMealPlan({...base,weightKg})).toThrow();
    expect(()=>generateMealPlan({...base,assessment:{...screened(),adjustedTargets:{tdee:NaN}}})).toThrow();
  });
  it('totals include recorded oil and salt; unknown nutrients remain unknown',()=>{
    const oil=foods.find(f=>/oil/i.test(f.name_en))!,salt=foods.find(f=>/^salt/i.test(f.name_en))!;
    const plan=generateMealPlan({...base,assessment:{...screened(),cookingIngredients:[{foodId:oil.id,grams:10,mealType:'Lunch'},{foodId:salt.id,grams:1,mealType:'Lunch'}]}});
    const additions=plan.meals.flatMap(m=>m.items).filter(i=>i.ingredient);
    expect(additions).toHaveLength(2);expect(additions[0].macros.fat).toBeCloseTo(oil.macros_per_100g.fat_g*.1);
    expect(additions[1].sodiumMg).toBeCloseTo(salt.macros_per_100g.sodium_mg*.01);
    const item=makeMealItem(foods[0],1,'en',supportedPreparations(foods[0])[0]??'raw');
    expect(sumNutrients([{...item,sodiumMg:null}]).sodiumMg).toBeNull();
  });
  it('English and Kiswahili plans have identical nutrition and food choices',()=>{
    const en=generateMealPlan({...base,assessment:screened()}),sw=generateMealPlan({...base,assessment:screened(),language:'sw'});
    expect(en.totals).toEqual(sw.totals);expect(en.meals.map(m=>m.items.map(i=>[i.foodId,i.grams]))).toEqual(sw.meals.map(m=>m.items.map(i=>[i.foodId,i.grams])));
  });
  it('edits recalculate totals and reject unsafe portions',()=>{
    const plan=generateMealPlan({...base,assessment:screened()});const item=plan.meals[0].items[0];
    const edited=editPlanItem(plan,0,0,item.foodId,.5,item.preparation);
    expect(edited.totals).toEqual(sumNutrients(edited.meals.flatMap(m=>m.items)));
    expect(()=>editPlanItem(plan,0,0,item.foodId,100,item.preparation)).toThrow(/limit/);
    expect(()=>editPlanItem(plan,0,0,item.foodId,0,item.preparation)).toThrow();
  });
  it('keeps approved snapshots when foods are edited or later measurements change',()=>{
    let plan=generateMealPlan({...base,conditions:['HTN'],assessment:screened()});
    const n=plan.totals!;
    plan=validatePlan({...plan,targets:{...plan.targets,tdee:n.calories,proteinG:n.protein,sodiumMg:Math.max(1500,n.sodiumMg!),fiberG:n.fiberG!}});
    expect(plan.validation?.status).toBe('complete');
    const approved=approvePlan(plan,{accountId:'doctor',accountName:'Doctor',deviceId:'A',note:'Clinically reviewed'});
    const item=approved.meals[0].items[0];
    const edited=editPlanItem(approved,0,0,item.foodId,.5,item.preparation);
    expect(edited.approval).toBeUndefined();expect(edited.history?.[0].approval?.note).toBe('Clinically reviewed');
    const patient={id:1,code:base.patientCode,age:55,sex:'F',cond:'HTN',region:'Kagera',medications:[],nutritionProfile:{assessment:screened()},visits:[{id:'v1',date:'2026-10-01',att:true,weight:70,height:162,meds:[],mealPlan:approved}]} as unknown as Patient;
    const changed=refreshNutritionPlans(patient);expect(changed.visits[0].mealPlan?.stale).toBe(true);expect(changed.visits[0].mealPlan?.history?.[0].approval?.note).toBe('Clinically reviewed');expect(changed.nutritionSync?.dirty).toBe(true);
  });
  it('stales changed inputs and labels legacy or stale printouts prominently',()=>{
    const plan=generateMealPlan({...base,assessment:screened()});
    expect(isPlanStale(plan,{...plan.inputSnapshot!,weightKg:70})).toBe(true);
    const stale=validatePlan({...plan,stale:true});expect(buildDietarySlipHtml(stale,'Patient','en')).toContain('STALE');
    const legacy={...plan,schemaVersion:undefined,assessment:undefined};expect(planStatusText(legacy,'en')).toContain('Assessment unavailable');
    expect(buildDietarySlipHtml(legacy,'Patient','en')).toContain('Assessment unavailable');
    expect(getFoodsSync()).toHaveLength(foods.length);
  });
});

describe('meal handout safety checks',()=>{
 it('requires review at 1200 kcal and confirms BMI >=40 without altering targets',()=>{
  const plan=generateMealPlan({...base,assessment:{...screened(),adjustedTargets:{tdee:1200},targetAdjustmentReason:'Provisional clinical estimate'}});
  expect(plan.targets.tdee).toBe(1200);expect(plan.validation?.issues.map(i=>i.code)).toContain('low_energy_review');expect(plan.validation?.status).toBe('needs_review');
  const high=generateMealPlan({...base,weightKg:140,assessment:screened()});expect(high.validation?.issues.map(i=>i.code)).toContain('measurement_review');
 });
 it('detects inconsistent adjusted macro targets and accepts consistent targets',()=>{
  const plan=generateMealPlan({...base,assessment:screened()});
  const bad=validatePlan({...plan,assessment:{...screened(),adjustedTargets:{proteinG:200},targetAdjustmentReason:'Review'},targets:{...plan.targets,proteinG:200}});
  expect(bad.validation?.issues.map(i=>i.code)).toContain('macro_target_mismatch');
  const good=validatePlan({...plan,assessment:{...screened(),adjustedTargets:{tdee:2000},targetAdjustmentReason:'Review'},targets:{...plan.targets,tdee:2000,proteinG:75,carbsG:275,fatG:200/3}});
  expect(good.validation?.issues.map(i=>i.code)).not.toContain('macro_target_mismatch');
 });
 it('distinguishes one/two cups of uji from ugali, keeping grams and calories aligned',()=>{
  const food=foods.find(f=>f.id==='food_006_uji')!,ugali=foods.find(f=>f.id==='food_014')!;
  const one=makeMealItem(food,.5,'sw','boiled'),two=makeMealItem(food,1,'sw','boiled');
  expect(one.grams).toBe(250);expect(two.grams).toBe(500);expect(two.macros.calories).toBe(190);
  expect(formatMealItemDetail(one,'sw')).toContain('Kikombe 1 cha uji');expect(formatMealItemDetail(two,'sw')).toContain('Vikombe 2 vya uji');
  expect(formatMealItemDetail(two,'sw')).toContain('jumla 500 g');expect(makeMealItem(ugali,1,'sw','boiled').portionText).not.toContain('uji');
 });
 it('does not use another ugali/rice meal as an optional snack',()=>{
  const plan=generateMealPlan({...base,assessment:screened()});
  expect(plan.meals.filter(m=>m.mealType==='Snack').flatMap(m=>m.items).some(i=>/ugali|rice/i.test(i.name_en))).toBe(false);
 });
 it('retains preparations and all distinct reasons in food guidance',()=>{
  const custom:ClinicalRule[]=[...rules,{id:'prep-a',target_food_id:'food_014',target_prep_method:'Fried',condition:'HTN',safety_level:'Danger',alert_message_en:'Fried restriction',alert_message_sw:'Kizuizi cha kukaanga'},{id:'prep-b',target_food_id:'food_014',target_prep_method:'Fried',condition:'HTN',safety_level:'Warning',alert_message_en:'Second full reason',alert_message_sw:'Sababu ya pili'}];
  setClinicalDataForTests(foods,custom);const guidance=getFoodGuidance(['HTN'],'Lake Zone',['food_014']).find(g=>g.foodId==='food_014'&&g.preparation==='Fried');
  expect(guidance?.reasons).toHaveLength(2);expect(guidance?.alternative?.preparation).toBe('boiled');
 });
 it('names the medication and handles class-only legacy alerts conservatively',()=>{
  const named=getDrugFoodInteractions(['MED_CCB'],['Amlodipine 5 mg'])[0];expect(named.title_en).toContain('Amlodipine');expect(named.matchedMedications).toEqual(['Amlodipine 5 mg']);
  const legacy=getDrugFoodInteractions(['MED_CCB'])[0];expect(legacy.body_en).toContain('does not apply to every');expect(legacy.title_en).toContain('pharmacist');
 });
});

it('keeps routine porridge to one cup, one staple per meal, and reports macro gaps',()=>{
 const plan=generateMealPlan({...base,age:78,sex:'male',weightKg:70,heightCm:137,assessment:screened()});
 for(const meal of plan.meals){
  const staples=meal.items.filter(item=>{const food=foods.find(f=>f.id===item.foodId);return food && !item.ingredient && isMealStarch(food);});
  expect(staples.length).toBeLessThanOrEqual(1);
  for(const item of meal.items.filter(i=>!/ugali|stiff/i.test(i.name_en)&&/porridge|uji/i.test(i.name_en))) expect(item.grams).toBeLessThanOrEqual(item.gramsPerHouseholdUnit!);
 }
 const excessive={...plan,meals:plan.meals.map(m=>({...m,items:m.items.map(i=>({...i,macros:{...i.macros,carbs:i.macros.carbs*10,fat:0}}))}))};
 const result=validatePlan(excessive);
 expect(result.validation?.issues.map(i=>i.code)).toEqual(expect.arrayContaining(['carbohydrate_target','fat_target']));
 expect(result.validation?.status).not.toBe('complete');
});
