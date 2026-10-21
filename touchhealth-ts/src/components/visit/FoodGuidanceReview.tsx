import type { GeneratedMealPlan } from '../../lib/clinical/types';
import { buildMealDocument } from './mealDocument';
export default function FoodGuidanceReview({plan,language}:{plan:GeneratedMealPlan;language:'en'|'sw'}) {
  const section=buildMealDocument(plan,plan.patientCode,language).sections[2];
  const block=section.blocks.find(b=>b.heading===(language==='sw'?'Tahadhari za vyakula na maandalizi':'Food and preparation precautions'));
  if(!block)return null;
  return <details className="border border-amber-300 rounded p-3 my-3 text-xs"><summary className="font-semibold">{block.heading}</summary>{block.lines.map((line,i)=><p className="mt-2" key={i}>{line}</p>)}</details>;
}
