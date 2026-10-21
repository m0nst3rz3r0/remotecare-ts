import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { loadZonePresets,setClinicalDataForTests } from '../../lib/clinical/dataLoader';
import { generateMealPlan } from '../../lib/clinical/mealPlanner';
import { defaultNutritionAssessment } from '../../lib/clinical/nutritionPolicy';
import { buildMealDocument,documentPlainText } from './mealDocument';
import { buildDietarySlipHtml,saveDietarySlipPdf,printDietarySlip } from './DietarySlip';
import * as renderer from './mealPdf';
import presets from '../../data/zoneAvailabilityPresets.json';
import type { GeneratedMealPlan,ZonePreset } from '../../lib/clinical/types';
let plan:GeneratedMealPlan;
beforeAll(()=>{
 const foods=JSON.parse(readFileSync(new URL('../../../public/foods.json',import.meta.url),'utf8')).foods;
 const raw=JSON.parse(readFileSync(new URL('../../../public/rules.json',import.meta.url),'utf8'));
 loadZonePresets(presets as Record<string,ZonePreset>);setClinicalDataForTests(foods,raw.rules??raw);
 plan=generateMealPlan({patientCode:'TEST-A-F0001',age:55,sex:'female',weightKg:65,heightCm:162,conditions:['HTN'],zone:'Lake Zone',language:'sw',medicationIds:['MED_CCB'],medicationNames:['Amlodipine 5 mg'],assessment:{...defaultNutritionAssessment(),allergyScreen:'no',pregnancyOrBreastfeeding:'no',significantWeightLoss:'no',specialistCondition:'no',measurementDate:'2026-10-17'}});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
describe('shared meal document',()=>{
 it('keeps patient/clinician choices, status, portions and sodium terminology aligned',()=>{
  const before=JSON.stringify(plan),full=buildMealDocument(plan,plan.patientCode,'sw'),patient=buildMealDocument(plan,plan.patientCode,'sw',{audience:'patient'});
  expect(full.sections).toHaveLength(3);expect(patient.sections).toHaveLength(3);
  const html=buildDietarySlipHtml(plan,plan.patientCode,'sw'),text=documentPlainText(full);
  expect(html).toContain('Sodiamu');expect(html).not.toContain('1500mg</div>');expect(html).not.toContain('...');
  for(const section of full.sections)for(const block of section.blocks)for(const line of block.lines)expect(text).toContain(line);
  expect(text).toContain('Tunda pembeni ya mlo:');expect(documentPlainText(buildMealDocument(plan,plan.patientCode,'en'))).toContain('Fruit alongside meal:');
  expect(JSON.stringify(plan)).toBe(before);expect(html).toContain('meal-document-6');
 });
 it('escapes identifiers and labels stale, incomplete and legacy documents',()=>{
  expect(buildDietarySlipHtml(plan,'<script>bad</script>','en')).toContain('&lt;script&gt;');
  expect(buildMealDocument({...plan,stale:true},plan.patientCode,'en').status).toContain('STALE');
  expect(buildMealDocument({...plan,schemaVersion:undefined},plan.patientCode,'en').status).toContain('Assessment unavailable');
 });
 it('embeds a Unicode font and exports searchable, bounded text on all PDF pages offline',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
  const doc=buildMealDocument(plan,plan.patientCode,'sw',{includeFoodGuide:true});
  const font=new Uint8Array(readFileSync(new URL('../../assets/fonts/NotoSans-Regular.ttf',import.meta.url)));
  const bytes=await renderer.renderMealDocumentPdf(doc,font);
  if(process.env.MEAL_PREVIEW_PATH)writeFileSync(process.env.MEAL_PREVIEW_PATH,bytes);
  expect(new TextDecoder().decode(bytes.slice(0,8))).toMatch(/^%PDF-/);expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
  const canvas=await import('@napi-rs/canvas');Object.assign(globalThis,{DOMMatrix:canvas.DOMMatrix,ImageData:canvas.ImageData,Path2D:canvas.Path2D});
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const loaded=await getDocument({data:bytes}).promise;
  let text='';
  for(let i=1;i<=loaded.numPages;i++){
    const page=await loaded.getPage(i),content=await page.getTextContent();const strings=content.items.filter(x=>'str'in x);
    const current=strings.map(x=>x.str).join(' ');text+=current;
    expect(current).toContain('TEST-A-F0001');expect(current).toContain(doc.status);expect(current).toContain('meal-document-6');
    expect(strings.every(x=>x.transform[4]>=41&&x.transform[5]>=28&&x.transform[5]<=810&&x.transform[4]+x.width<=555)).toBe(true);
  }
  expect(text).toContain('Kikombe 1 cha uji');expect(text).toContain('Nyuzinyuzi');expect(fetch).not.toHaveBeenCalled();
 },30000);
});
describe('PDF download and printing',()=>{
 function browser(){
  const a={href:'',download:'',click:vi.fn(),remove:vi.fn()},open=vi.fn();
  vi.stubGlobal('document',{createElement:()=>a,body:{appendChild:vi.fn()}});vi.stubGlobal('window',{open});
  vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  return {a,open};
 }
 it('downloads a PDF without window.open or a print dialog; suppresses concurrent clicks',async()=>{
  vi.useFakeTimers();const {a,open}=browser();let finish:(value:Uint8Array)=>void=()=>{};
  vi.spyOn(renderer,'renderMealDocumentPdf').mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const first=saveDietarySlipPdf(plan,plan.patientCode,'sw');await saveDietarySlipPdf(plan,plan.patientCode,'sw');
  expect(renderer.renderMealDocumentPdf).toHaveBeenCalledTimes(1);finish(new TextEncoder().encode('%PDF-test'));await first;
  expect(a.download).toBe('meal-plan-TEST-A-F0001-'+plan.date+'.pdf');expect(a.click).toHaveBeenCalledTimes(1);expect(open).not.toHaveBeenCalled();
  expect(vi.mocked(URL.createObjectURL).mock.calls[0][0]).toHaveProperty('type','application/pdf');vi.runAllTimers();
 });
 it('reports generation errors without downloading a file and allows retry',async()=>{
  const {a}=browser();vi.spyOn(renderer,'renderMealDocumentPdf').mockRejectedValue(new Error('font failure'));
  await expect(saveDietarySlipPdf(plan,plan.patientCode,'en')).rejects.toThrow('PDF was not saved');expect(a.click).not.toHaveBeenCalled();
  vi.mocked(renderer.renderMealDocumentPdf).mockResolvedValue(new Uint8Array([1]));await saveDietarySlipPdf(plan,plan.patientCode,'en');expect(a.click).toHaveBeenCalledOnce();
 });
 it('opens Print synchronously and waits for document and fonts before printing',async()=>{
  let loaded:()=>void=()=>{},fontsReady:()=>void=()=>{};const print=vi.fn(),focus=vi.fn();
  const w={closed:false,document:{open:vi.fn(),write:vi.fn(),close:()=>queueMicrotask(()=>loaded()),fonts:{ready:new Promise<void>(r=>{fontsReady=r;})}},focus,print,set onload(fn:()=>void){loaded=fn;},onerror:null};
  const open=vi.fn(()=>w);vi.stubGlobal('window',{open});const pending=printDietarySlip(plan,plan.patientCode,'en');
  expect(open).toHaveBeenCalledOnce();await Promise.resolve();expect(print).not.toHaveBeenCalled();fontsReady();await pending;expect(print).toHaveBeenCalledOnce();
 });
});

it('rejects oversized content instead of producing more than three pages',async()=>{
 const doc=buildMealDocument(plan,plan.patientCode,'en');
 doc.sections[0].blocks.push({heading:'Long clinical content',lines:Array.from({length:100},()=> 'Additional clinical detail must remain readable and must not be silently discarded.')});
 const font=new Uint8Array(readFileSync(new URL('../../assets/fonts/NotoSans-Regular.ttf',import.meta.url)));
 await expect(renderer.renderMealDocumentPdf(doc,font)).rejects.toThrow(/one readable page/);
});

it('prints a clean patient guide with identity, facility and food choices before meals',async()=>{
 const patient=buildMealDocument(plan,plan.patientCode,'sw',{audience:'patient',facility:'ZamZam HealthCentre'});
 const text=documentPlainText(patient);
 expect(patient.patient).toBe(plan.patientCode);expect(patient.facility).toBe('ZamZam HealthCentre');
 expect(text.indexOf('Vyakula vya kula')).toBeLessThan(text.indexOf('Mfano wa mchanganyiko'));
 for(const hidden of ['BMR','BMI','meal-document','foods-c','adult-dm','Rekodi tarehe','UNAHITAJI UHAKIKI'])expect(text).not.toContain(hidden);
 const font=new Uint8Array(readFileSync(new URL('../../assets/fonts/NotoSans-Regular.ttf',import.meta.url)));
 const bytes=await renderer.renderMealDocumentPdf(patient,font);
 expect((await PDFDocument.load(bytes)).getPageCount()).toBeLessThanOrEqual(3);
 if(process.env.MEAL_PREVIEW_PATH)writeFileSync(process.env.MEAL_PREVIEW_PATH.replace('.pdf','-patient.pdf'),bytes);
 const html=buildDietarySlipHtml(plan,plan.patientCode,'sw',{audience:'patient',facility:'ZamZam HealthCentre'});
 expect(html).toContain('ZamZam HealthCentre');expect(html).not.toContain('meal-document-6');
});
