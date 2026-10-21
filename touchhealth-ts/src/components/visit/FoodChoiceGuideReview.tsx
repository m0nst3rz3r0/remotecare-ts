import { useState } from 'react';
import type { GeneratedMealPlan } from '../../lib/clinical/types';
import { localizePrep } from '../../lib/clinical/mealLocalization';

export default function FoodChoiceGuideReview({plan,language}:{plan:GeneratedMealPlan;language:'en'|'sw'}) {
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all');
  const sw=language==='sw',guide=plan.foodChoiceGuide;
  const labels:Record<string,string>=sw?{all:'Vyote',suitable:'Vinavyofaa kwa kiasi',limit:'Punguza / badili maandalizi',avoid:'Epuka kwa sababu maalum',not_assessed:'Havijatathminiwa / uhakiki'}:{all:'All',suitable:'Suitable in stated portions',limit:'Limit / change preparation',avoid:'Avoid for stated reason',not_assessed:'Not assessed / review'};
  return <details className="border rounded p-3 my-3"><summary className="font-semibold">{sw?'Mwongozo binafsi wa vyakula':'Personalized food-choice guide'}</summary>
    <p className="my-2">{sw?'Vipimo ni mifano, si vyakula vya kuongeza kwenye mpango. Thibitisha kiasi na mtaalamu.':'Reference portions are examples, not additions to the daily plan. Confirm portions with your clinician.'}</p>
    {!guide?<p>{sw?'Mwongozo haupatikani kwa mpango wa zamani; tengeneza tena na uhakiki.':'Guide unavailable for this older plan; regenerate and review.'}</p>:<>
      <p>{guide.version} | {guide.datasetVersion} | {guide.policyVersion}</p>
      <input aria-label={sw?'Tafuta chakula':'Search food'} placeholder={sw?'Tafuta chakula':'Search food'} className="border rounded p-2 my-2" value={query} onChange={e=>setQuery(e.target.value)}/>
      <select aria-label={sw?'Chuja mwongozo':'Filter food guide'} className="border rounded p-2" value={filter} onChange={e=>setFilter(e.target.value)}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
      <div className="max-h-96 overflow-y-auto">{guide.entries.filter(e=>(filter==='all'||e.status===filter)&&(e.name_en+' '+e.name_sw+' '+e.categories.join(' ')).toLowerCase().includes(query.trim().toLowerCase())).map(e=><div className="border-b py-2" key={e.foodId+e.preparation}>
        <p className="font-semibold">{sw?e.name_sw:e.name_en} — {localizePrep(e.preparation,language)}</p><p>{labels[e.status]} | {e.categories.join(', ')} | {sw?e.portion_sw:e.portion_en} ({e.grams} g)</p>
        {e.reasons.map((r,i)=><p key={i}>{sw?r.message_sw:r.message_en}</p>)}
        {e.alternativePreparation&&<p>{sw?'Maandalizi mbadala: ':'Alternative preparation: '}{localizePrep(e.alternativePreparation,language)}</p>}
        {!e.available&&<p>{sw?'Hakijaorodheshwa kuwa kinapatikana.':'Not marked available.'}</p>}
      </div>)}</div>
    </>}
  </details>;
}
