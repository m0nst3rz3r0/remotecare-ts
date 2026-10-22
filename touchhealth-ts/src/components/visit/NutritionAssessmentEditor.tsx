import { useState } from 'react';
import { getFoodsSync } from '../../lib/clinical/dataLoader';
import type { NutritionAssessment, ScreeningAnswer } from '../../lib/clinical/types';

const field = 'border border-slate-300 rounded px-2 py-1 text-xs w-full';
export default function NutritionAssessmentEditor({ value, onChange, language }: { value: NutritionAssessment; onChange: (value: NutritionAssessment) => void; language: 'en' | 'sw' }) {
  const [foodSearch,setFoodSearch]=useState('');
  const sw = language === 'sw';
  const update = (patch: Partial<NutritionAssessment>) => onChange({ ...value, ...patch });
  const foods = getFoodsSync();
  const screenings = [
    ['allergyScreen', 'Known food allergy or intolerance?', 'Mzio au kutovumilia chakula?'],
    ['pregnancyOrBreastfeeding', 'Pregnant or breastfeeding?', 'Mjamzito au ananyonyesha?'],
    ['significantWeightLoss', 'Significant recent unintended weight loss?', 'Kupungua uzito bila kukusudia hivi karibuni?'],
    ['specialistCondition', 'Kidney, heart failure or other specialist nutrition needs?', 'Figo, moyo au hitaji la lishe ya mtaalamu?'],
  ] as const;
  return <fieldset className="border rounded-lg p-3 mb-4 space-y-3">
    <legend className="text-xs font-bold px-1">{sw ? 'Tathmini ya lishe ya mtu mzima' : 'Adult nutrition assessment'}</legend>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {screenings.map(([key,en,translated]) => <label key={key} className="text-xs">{sw ? translated : en}<select className={field} value={value[key]} onChange={(e) => update({ [key]: e.target.value as ScreeningAnswer })}>
        <option value="unknown">{sw ? 'Bado haijatathminiwa' : 'Not assessed'}</option><option value="no">{sw ? 'Hapana' : 'No'}</option><option value="yes">{sw ? 'Ndiyo — uhakiki unahitajika' : 'Yes — review required'}</option>
      </select></label>)}
      <label className="text-xs">{sw ? 'Tarehe ya vipimo' : 'Measurement date'}<input type="date" className={field} value={value.measurementDate} max={new Date().toISOString().slice(0,10)} onChange={(e) => update({ measurementDate: e.target.value })} /></label>
      <label className="text-xs">{sw ? 'Shughuli za mwili' : 'Activity level'}<select className={field} value={value.activityLevel} onChange={(e) => update({ activityLevel: e.target.value as NutritionAssessment['activityLevel'] })}>{['Sedentary','Light','Moderate','Active','Very Active'].map((v,i) => <option key={v} value={v}>{sw ? ['Kukaa zaidi','Nyepesi','Wastani','Hai','Hai sana'][i] : v}</option>)}</select></label>
      <label className="text-xs">{sw ? 'Lengo la uzito' : 'Body goal'}<select className={field} value={value.bodyGoal} onChange={(e) => update({ bodyGoal: e.target.value as NutritionAssessment['bodyGoal'] })}><option value="maintain">{sw ? 'Dumisha' : 'Maintain'}</option><option value="lose_weight">{sw ? 'Punguza uzito' : 'Lose weight'}</option><option value="gain_muscle">{sw ? 'Ongeza misuli' : 'Gain muscle'}</option></select></label>
    </div>
    <label className="block text-xs">{sw ? 'Maelezo ya mzio/uvumilivu' : 'Allergy / intolerance details'}<input className={field} value={value.allergyDetails} onChange={(e) => update({ allergyDetails: e.target.value })} /></label>
    <p className="text-xs text-amber-800">{sw ? 'Mzio hauwezi kuthibitishwa na orodha hii pekee. Jibu chanya au lisilojulikana linahitaji uhakiki.' : 'Food exclusions do not establish allergy safety. Positive or unknown screening requires clinical review.'}</p>
    <label className="block text-xs">{sw ? 'Vyakula vilivyozuiwa' : 'Exclude foods'}<select multiple className={field + ' h-24'} value={value.excludedFoodIds} onChange={(e) => update({ excludedFoodIds: [...e.target.selectedOptions].map((o) => o.value) })}>{foods.map((f) => <option key={f.id} value={f.id}>{sw ? f.name_sw : f.name_en}</option>)}</select></label>
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={value.availableFoodIds !== undefined} onChange={(e) => update({ availableFoodIds: e.target.checked ? [] : undefined })} />{sw ? 'Tumia vyakula vinavyopatikana na vinavyomudu gharama tu' : 'Use only foods available and affordable to this patient'}</label>
    {value.availableFoodIds !== undefined && <div className="border rounded p-2">
      <p className="text-xs font-bold">{sw?'Vyakula vilivyochaguliwa':'Selected foods'}: {value.availableFoodIds.length}</p>
      {!value.availableFoodIds.length&&<p role="alert" className="text-xs text-amber-900">{sw?'Hakuna chakula kilichochaguliwa. Weka alama kwenye vyakula kabla ya kutengeneza mpango.':'No foods selected. Tick available foods before generating a plan.'}</p>}
      <input className={field+' my-2'} aria-label={sw?'Tafuta vyakula vinavyopatikana':'Search available foods'} placeholder={sw?'Tafuta chakula':'Search foods'} value={foodSearch} onChange={e=>setFoodSearch(e.target.value)}/>
      <div className="max-h-48 overflow-y-auto">{foods.filter(f=>(f.name_en+' '+f.name_sw).toLowerCase().includes(foodSearch.toLowerCase())).map(f=><label key={f.id} className="flex gap-2 py-1 text-xs"><input type="checkbox" checked={value.availableFoodIds!.includes(f.id)} onChange={e=>update({availableFoodIds:e.target.checked?[...value.availableFoodIds!,f.id]:value.availableFoodIds!.filter(id=>id!==f.id)})}/>{sw?f.name_sw:f.name_en}</label>)}</div>
    </div>}
    <details><summary className="text-xs font-bold cursor-pointer">{sw ? 'Malengo yaliyorekebishwa na mtaalamu' : 'Clinician target adjustments'}</summary>
      <p className="text-xs text-slate-600 my-2">{sw ? 'Makadirio ni ya awali. Rekodi sababu ya marekebisho.' : 'Estimates are provisional. Record a clinical reason for adjustments.'}</p>
      <div className="grid grid-cols-2 gap-2">{([['tdee','Energy (kcal)','Nishati (kcal)'],['proteinG','Protein (g)','Protini (g)'],['carbsG','Carbohydrates (g)','Wanga (g)'],['fatG','Fat (g)','Mafuta (g)'],['sodiumMg','Sodium (mg)','Sodiamu (mg)'],['fiberG','Fibre (g)','Nyuzinyuzi (g)']] as const).map(([key,en,translated]) => <label key={key} className="text-xs">{sw ? translated : en}<input type="number" min="0.1" step="any" className={field} value={value.adjustedTargets?.[key] ?? ''} onChange={(e) => { const targets = { ...value.adjustedTargets }; if (e.target.value === '') delete targets[key]; else targets[key] = Number(e.target.value); update({ adjustedTargets: targets }); }} /></label>)}</div>
      <label className="block text-xs mt-2">{sw ? 'Sababu ya marekebisho' : 'Adjustment reason'}<input className={field} value={value.targetAdjustmentReason ?? ''} onChange={(e) => update({ targetAdjustmentReason: e.target.value })} /></label>
    </details>
    <details><summary className="text-xs font-bold cursor-pointer">{sw ? 'Viungo vya ziada vya kupikia' : 'Additional cooking ingredients'}</summary>
      <p className="text-xs text-slate-600 my-2">{sw ? 'Rekodi mafuta, chumvi na viungo vilivyoongezwa. Usihesabu mara mbili viungo vilivyomo tayari kwenye chakula.' : 'Record extra oil, salt and ingredients. Avoid double-counting ingredients already included in a prepared food.'}</p>
      {value.cookingIngredients.map((ingredient, index) => <div className="flex flex-wrap gap-1 mb-2" key={index}>
        <select aria-label="Ingredient" className={field} value={ingredient.foodId} onChange={(e) => update({ cookingIngredients: value.cookingIngredients.map((v,i) => i === index ? { ...v, foodId: e.target.value } : v) })}>{foods.map((f) => <option key={f.id} value={f.id}>{sw ? f.name_sw : f.name_en}</option>)}</select>
        <select aria-label="Ingredient meal" className={field} value={ingredient.mealType} onChange={(e) => update({ cookingIngredients: value.cookingIngredients.map((v,i) => i === index ? { ...v, mealType: e.target.value as typeof v.mealType } : v) })}>{(['Breakfast','Lunch','Dinner'] as const).map((m,i) => <option key={m} value={m}>{sw ? ['Asubuhi','Mchana','Jioni'][i] : m}</option>)}</select>
        <label className="text-xs">{sw ? 'Gramu' : 'Grams'}<input type="number" min="0.1" max="1000" step="0.1" className={field} value={ingredient.grams} onChange={(e) => update({ cookingIngredients: value.cookingIngredients.map((v,i) => i === index ? { ...v, grams: Number(e.target.value) } : v) })} /></label>
        <button type="button" className="text-xs text-red-700" onClick={() => update({ cookingIngredients: value.cookingIngredients.filter((_,i) => i !== index) })}>{sw ? 'Ondoa' : 'Remove'}</button>
      </div>)}
      <button type="button" className="text-xs font-bold text-teal-800" onClick={() => update({ cookingIngredients: [...value.cookingIngredients, { foodId: 'food_073', grams: 5, mealType: 'Lunch' }] })}>{sw ? 'Ongeza kiungo' : 'Add ingredient'}</button>
    </details>
  </fieldset>;
}
