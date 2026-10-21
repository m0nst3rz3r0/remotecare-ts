import { useRef, useState } from 'react';
import { FileDown, Printer, Share2 } from 'lucide-react';
import type { GeneratedMealPlan } from '../../lib/clinical/types';
import type { ExportAudience } from './mealDocument';
import { printDietarySlip, saveDietarySlipPdf, shareDietarySlip } from './DietarySlip';
export default function MealExportActions({plan,patient,language}:{plan:GeneratedMealPlan;patient:string;language:'en'|'sw'}) {
  const [audience,setAudience]=useState<ExportAudience>('full'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [includeFoodGuide,setIncludeFoodGuide]=useState(false);
  const active=useRef(false),sw=language==='sw';
  const run=async(action:()=>Promise<void>)=>{if(active.current)return;active.current=true;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:(sw?'Imeshindikana. Jaribu tena.':'Export failed. Retry.'));}finally{active.current=false;setBusy(false);}};
  const button='rounded border border-slate-300 px-3 py-2 text-xs font-bold flex gap-2 items-center disabled:opacity-50';
  return <div className="w-full"><label className="text-xs block mb-2">{sw?'Sehemu za hati':'Document contents'}<select className="border rounded p-2 ml-2" value={audience} disabled={busy} onChange={e=>setAudience(e.target.value as ExportAudience)}><option value="full">{sw?'Mgonjwa na mtaalamu':'Patient and clinician'}</option><option value="patient">{sw?'Mgonjwa pekee':'Patient only'}</option></select></label>
    <label className="block text-xs mb-2"><input type="checkbox" checked={includeFoodGuide} disabled={busy} onChange={e=>setIncludeFoodGuide(e.target.checked)}/> {sw?'Ongeza mwongozo kamili wa vyakula':'Include full food-choice guide'}</label><div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={busy} onClick={()=>void run(()=>printDietarySlip(plan,patient,language,{audience,includeFoodGuide}))}><Printer size={14}/>{sw?'Chapisha':'Print'}</button>
      <button type="button" className={button} disabled={busy} onClick={()=>void run(()=>shareDietarySlip(plan,patient,language,{audience,includeFoodGuide}))}><Share2 size={14}/>{sw?'Shiriki':'Share'}</button>
      <button type="button" className={button+' bg-teal-800 text-white'} disabled={busy} onClick={()=>void run(()=>saveDietarySlipPdf(plan,patient,language,{audience,includeFoodGuide}))}><FileDown size={14}/>{busy?(sw?'Inatayarisha...':'Preparing...'):(sw?'Hifadhi PDF':'Save PDF')}</button>
    </div>{error&&<p role="alert" className="text-red-800 text-xs mt-2">{error}</p>}
    <p className="text-xs text-slate-600 mt-2">{sw?'Hifadhi PDF hupakua faili moja kwa moja; haihitaji dirisha la kuchapisha.':'Save PDF downloads a file directly; no print dialog is needed.'}</p>
  </div>;
}
