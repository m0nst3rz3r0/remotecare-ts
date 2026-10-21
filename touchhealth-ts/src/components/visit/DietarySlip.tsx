import type { GeneratedMealPlan } from '../../lib/clinical';
import { escapeHtml } from '../../utils/html';
import { buildMealDocument, documentPlainText, type ExportOptions } from './mealDocument';
import { renderMealDocumentPdf } from './mealPdf';

export function buildDietarySlipHtml(plan:GeneratedMealPlan,patient:string,lang:'en'|'sw',options:ExportOptions={}):string {
  const doc=buildMealDocument(plan,patient,lang,options),e=escapeHtml;
  const header=`<header><h1>RemoteCare - ${e(doc.title)}</h1><p>${e(doc.patient)} | ${e(doc.date)}</p>${doc.facility?`<p>${e(doc.facility)}</p>`:''}<p class="status">${e(doc.status)}</p></header>`;
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><title>${e(doc.title)} - ${e(patient)}</title><style>
    @page {size:A4 portrait;margin:16mm 14mm;} *{box-sizing:border-box;} body{font:11.5pt/1.3 Arial,sans-serif;color:#132b31;margin:0;} h1{font-size:17pt;color:#0d6367;margin:0 0 5pt;} h2{font-size:15pt;color:#0d6367;} h3{font-size:12.5pt;margin:0 0 7pt;color:#0d6367;break-after:avoid;} p{margin:0 0 3pt;overflow-wrap:anywhere;} header{border-bottom:2pt solid #0d6367;padding-bottom:8pt;} .status{font-weight:bold;color:#784500;} article{margin:5pt 0;padding:4pt 8pt;border:1pt solid #dce5e6;border-radius:6pt;break-inside:avoid;} h3{background:#edf7f6;padding:3pt;margin:0 0 3pt;} .warning{border-left:3pt solid #b47719;padding-left:10pt;} section+section{break-before:page;} footer{font-size:9pt;border-top:1pt solid #dce5e6;padding:6pt 0;} thead{display:table-header-group;} table{width:100%;border-collapse:collapse;} td{padding:0;} @media screen{body{max-width:780px;margin:24px auto;padding:16px;}} @media print{h2,h3{break-after:avoid;}p{orphans:3;widows:3;}}
  </style></head><body>${doc.sections.map(section=>`<section><table><thead><tr><td>${header}</td></tr></thead><tbody><tr><td><h2>${e(section.title)}</h2>${section.blocks.map(block=>`<article class="${block.tone==='warning'?'warning':''}">${block.heading?`<h3>${e(block.heading)}</h3>`:''}${block.lines.map(line=>`<p>${e(line)}</p>`).join('')}</article>`).join('')}</td></tr></tbody></table><footer>${doc.patientFacing?'':e(doc.version)}</footer></section>`).join('')}</body></html>`;
}
export function slipFilename(patient:string,date:string):string {
  return `meal-plan-${patient.replace(/[^\w-]+/g,'_').slice(0,60)}-${date.replace(/[^\d-]/g,'')}`;
}
function download(blob:Blob,name:string):void {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function printDietarySlip(plan:GeneratedMealPlan,patient:string,lang:'en'|'sw',options:ExportOptions={}):Promise<void> {
  // Open before any asynchronous work to retain the browser's user gesture.
  const w=window.open('','_blank','width=850,height=1000');
  if(!w)throw new Error(lang==='sw'?'Ruhusu dirisha ibukizi ili kuchapisha.':'Allow popups for this app to print. Save PDF can download without popups.');
  const html=buildDietarySlipHtml(plan,patient,lang,options);
  await new Promise<void>((resolve,reject)=>{
    w.onload=()=>resolve();w.onerror=()=>reject(new Error('Print document could not load.'));
    w.document.open();w.document.write(html);w.document.close();
  });
  await w.document.fonts?.ready;
  if(w.closed)throw new Error(lang==='sw'?'Dirisha la kuchapisha limefungwa.':'The print window was closed.');
  w.focus();w.print();
}
const activeDownloads=new Set<string>();
export async function saveDietarySlipPdf(plan:GeneratedMealPlan,patient:string,lang:'en'|'sw',options:ExportOptions={}):Promise<void> {
  const key=patient+'|'+plan.date+'|'+(options.audience??'full');if(activeDownloads.has(key))return;
  activeDownloads.add(key);
  try {
    const bytes=await renderMealDocumentPdf(buildMealDocument(plan,patient,lang,options));
    download(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),slipFilename(patient,plan.date)+'.pdf');
  } catch(error){throw new Error((lang==='sw'?'PDF haijahifadhiwa. Jaribu tena. ':'PDF was not saved. Retry the download. ')+(error instanceof Error?error.message:''));}
  finally{activeDownloads.delete(key);}
}
export function downloadDietarySlipHtml(plan:GeneratedMealPlan,patient:string,lang:'en'|'sw',options:ExportOptions={}):void {
  download(new Blob([buildDietarySlipHtml(plan,patient,lang,options)],{type:'text/html;charset=utf-8'}),slipFilename(patient,plan.date)+'.html');
}
export async function shareDietarySlip(plan:GeneratedMealPlan,patient:string,lang:'en'|'sw',options:ExportOptions={}):Promise<void> {
  const doc=buildMealDocument(plan,patient,lang,options),text=documentPlainText(doc);
  if(navigator.share){try{await navigator.share({title:doc.title,text});return;}catch(error){if(error instanceof DOMException && error.name==='AbortError')return;}}
  downloadDietarySlipHtml(plan,patient,lang,options);
}
