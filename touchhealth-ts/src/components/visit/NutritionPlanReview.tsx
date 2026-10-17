import { localizePrep } from '../../lib/clinical/mealLocalization';
import { useState } from 'react';
import { approvePlan, editPlanItem, planStatusText, planAssumptions, sumNutrients } from '../../lib/clinical/planValidation';
import { getFoodsForZone, getFoodsSync, supportedPreparations } from '../../lib/clinical/dataLoader';
import { evalFoodForPatient } from '../../lib/clinical/foodSafety';
import { getDeviceHardwareId } from '../../services/deviceManager';
import { useAuthStore } from '../../store/useAuthStore';
import { NUTRITION_POLICY } from '../../lib/clinical/nutritionPolicy';
import type { GeneratedMealPlan } from '../../lib/clinical/types';

export default function NutritionPlanReview({ plan, onChange, language, editable = true }: { plan: GeneratedMealPlan; onChange?: (plan: GeneratedMealPlan) => void; language: 'en' | 'sw'; editable?: boolean }) {
  const [error,setError] = useState(''), [note,setNote] = useState('');
  const user = useAuthStore((s) => s.currentUser);
  const sw = language === 'sw';
  const totals = plan.totals ?? sumNutrients(plan.meals.flatMap((m) => m.items));
  const candidates = getFoodsForZone(plan.region).filter((food) => !plan.assessment?.excludedFoodIds.includes(food.id)
    && (!plan.assessment?.availableFoodIds || plan.assessment.availableFoodIds.includes(food.id)));
  const action = (run: () => GeneratedMealPlan) => { try { onChange?.(run()); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Review failed'); } };
  return <section className="border rounded-lg p-3 mb-3 text-xs" aria-label={sw ? 'Uhakiki wa mpango' : 'Plan review'}>
    <p role="status" className="font-bold text-amber-900 mb-2">{planStatusText(plan, language)}</p>
    <p className="text-slate-600 mb-2">{sw ? 'Jumla ya mpango / lengo; sodiamu ni kikomo.' : 'Planned total / target; sodium is a limit. Completeness does not replace clinical approval.'}</p>
    <dl className="grid grid-cols-2 gap-2 mb-3">{[
      [sw ? 'Nishati' : 'Energy', `${totals.calories} / ${plan.targets.tdee} kcal`],
      [sw ? 'Protini' : 'Protein', `${totals.protein} / ${plan.targets.proteinG} g`],
      [sw ? 'Wanga' : 'Carbohydrates', `${totals.carbs} / ${plan.targets.carbsG} g`],
      [sw ? 'Mafuta' : 'Fat', `${totals.fat} / ${plan.targets.fatG} g`],
      [sw ? 'Sodiamu' : 'Sodium', `${totals.sodiumMg ?? (sw ? 'Haijulikani' : 'Unknown')} / ${plan.targets.sodiumMg} mg`],
      [sw ? 'Nyuzinyuzi' : 'Fibre', `${totals.fiberG ?? (sw ? 'Haijulikani' : 'Unknown')} / ${plan.targets.fiberG} g`],
    ].map(([label,value]) => <div key={label}><dt className="text-slate-600">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
    {!!plan.validation?.issues.length && <ul className="list-disc pl-4 space-y-1 mb-3">{plan.validation.issues.map((issue,i) => <li key={issue.code + i}>{sw ? issue.message_sw : issue.message_en}</li>)}</ul>}
    {editable && plan.schemaVersion === 2 && onChange && <details><summary className="font-bold cursor-pointer">{sw ? 'Badili vyakula na vipimo' : 'Edit foods and portions'}</summary>
      {plan.meals.map((meal,mi) => <div key={mi} className="my-2"><p className="font-semibold">{sw ? meal.name_sw : meal.name_en}</p>{meal.items.map((item,ii) => {
        if (item.ingredient) return <p key={ii}>{sw ? item.name_sw : item.name_en}: {item.grams}g ({sw ? 'kiungo' : 'ingredient'})</p>;
        const existingFood = getFoodsSync().find(f => f.id === item.foodId);
        const preps = (existingFood ? supportedPreparations(existingFood) : []).filter((p) => evalFoodForPatient(item.foodId,p,[...(plan.conditions ?? []), ...(plan.inputSnapshot?.medicationIds ?? [])]).severity === 'Safe');
        return <div key={ii} className="flex flex-wrap gap-1 mb-2">
          <select aria-label="Substitute food" className="border rounded p-1 max-w-full" value={item.foodId} onChange={(e) => { const food = candidates.find((f) => f.id === e.target.value)!; const prep = supportedPreparations(food).find((p) => evalFoodForPatient(food.id,p,[...(plan.conditions ?? []), ...(plan.inputSnapshot?.medicationIds ?? [])]).severity === 'Safe'); if (prep) action(() => editPlanItem(plan,mi,ii,food.id,0.5,prep)); }}>
            {candidates.filter((f) => f.id === item.foodId || supportedPreparations(f).some((p) => evalFoodForPatient(f.id,p,[...(plan.conditions ?? []), ...(plan.inputSnapshot?.medicationIds ?? [])]).severity === 'Safe')).map((f) => <option key={f.id} value={f.id}>{sw ? f.name_sw : f.name_en}</option>)}
          </select>
          <label>{sw ? 'Vipimo vya kawaida' : 'Household units'}<input type="number" min="0.5" step="0.5" className="border rounded p-1 w-16" value={(item.portionMultiplier ?? 1) * (candidates.find((f) => f.id === item.foodId)?.serving?.default_units ?? 1)} onChange={(e) => action(() => editPlanItem(plan,mi,ii,item.foodId,Number(e.target.value)/(candidates.find((f) => f.id === item.foodId)?.serving?.default_units ?? 1),item.preparation))} /></label>
          <select aria-label="Preparation" className="border rounded p-1" value={item.prepMethod} onChange={(e) => action(() => editPlanItem(plan,mi,ii,item.foodId,item.portionMultiplier ?? 1,e.target.value))}>{preps.map((p) => <option key={p} value={p}>{localizePrep(p,language)}</option>)}</select>
        </div>;
      })}</div>)}
    </details>}
    {editable && onChange && plan.schemaVersion === 2 && <div className="mt-3">
      <label className="block">{sw ? 'Maelezo ya uhakiki wa kitabibu' : 'Clinical review note'}<textarea className="border rounded p-2 w-full" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button type="button" disabled={!user || plan.validation?.status !== 'complete' || plan.stale || !note.trim()} className="px-3 py-1.5 bg-teal-800 text-white rounded disabled:opacity-40" onClick={() => { if (user) action(() => approvePlan(plan, { accountId: user.id, accountName: user.displayName, deviceId: getDeviceHardwareId(), note })); }}>{sw ? 'Nimehakiki; idhinisha mpango' : 'I have clinically reviewed — approve plan'}</button>
    </div>}
    {error && <p role="alert" className="text-red-700 mt-2">{error}</p>}
    {!!plan.history?.length && <details className="mt-2"><summary>{sw ? 'Mipango iliyohifadhiwa awali' : 'Previous approved snapshots'} ({plan.history.length})</summary>{plan.history.map((snapshot,i) => <details key={i}><summary>{snapshot.generatedAt} ? {snapshot.approval?.accountName} ? {snapshot.approval?.note}</summary>{snapshot.meals.map((meal,j) => <p key={j}>{sw ? meal.name_sw : meal.name_en}: {meal.items.map(item => (sw ? item.name_sw : item.name_en)+' ('+(item.grams ?? '?')+'g)').join(', ')}</p>)}</details>)}</details>}
    <details className="mt-3"><summary>{sw ? 'Makadirio na marejeo' : 'Assumptions and sources'}</summary><p>{sw ? 'Sera inasubiri uhakiki wa kitabibu wa eneo.' : 'Clinical policy is pending local clinical review.'}</p><ul className="list-disc pl-4">{planAssumptions(plan,language).map((text) => <li key={text}>{text}</li>)}</ul>{NUTRITION_POLICY.sources.map((source) => <a key={source.url} className="block underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</details>
  </section>;
}
