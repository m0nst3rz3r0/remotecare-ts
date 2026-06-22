import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, ChevronDown, FileDown, Share2 } from 'lucide-react';
import type { GeneratedMealPlan } from '../../lib/clinical';
import { buildCautions } from '../../lib/clinical/mealPlanner';
import { formatMealItemDetail, mealFoodName } from '../../lib/clinical/mealLocalization';
import { printDietarySlip, saveDietarySlipPdf, shareDietarySlip } from './DietarySlip';

const INK  = '#132b31';
const TEAL = '#10b981';
const SLATE = '#516169';

interface MealPlanModalProps {
  plan: GeneratedMealPlan;
  patientName: string;
  onClose: () => void;
}

const actionBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  flex: '1 1 120px',
  minHeight: '44px',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 14px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

export default function MealPlanModal({ plan, patientName, onClose }: MealPlanModalProps) {
  const [lang, setLang] = useState<'en' | 'sw'>(plan.language);
  const [openMeals, setOpenMeals] = useState<Set<string>>(new Set(['Breakfast', 'Lunch', 'Dinner']));

  const toggleMeal = (meal: string) => {
    setOpenMeals(prev => {
      const next = new Set(prev);
      if (next.has(meal)) next.delete(meal);
      else next.add(meal);
      return next;
    });
  };

  const dayTotal = plan.meals.reduce((sum, m) => sum + m.totalCalories, 0);
  const mealColors: Record<string, string> = { Breakfast: '#f59e0b', Lunch: '#10b981', Dinner: '#6366f1' };
  const cautions = buildCautions(plan.conditions ?? [], lang);

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)' }} onClick={onClose} />

      <div style={{
        position: 'relative', background: '#fff', borderRadius: '12px',
        width: '100%', maxWidth: '640px', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.35)',
      }}>
        {/* Header */}
        <div style={{ background: INK, padding: '14px 16px', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 800, fontFamily: "'Inter', system-ui" }}>
              {lang === 'sw' ? 'Mpango wa Chakula' : 'Meal Plan'} — {patientName}
            </div>
            <div style={{ color: 'rgba(255,255,255,.65)', fontSize: '11px', fontFamily: "'Inter', system-ui", marginTop: '2px' }}>
              {plan.region} · {plan.diagnosis || '—'} · {dayTotal} kcal/day
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setLang(l => l === 'en' ? 'sw' : 'en')}
              style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', system-ui" }}>
              {lang === 'en' ? 'SW' : 'EN'}
            </button>
            <button onClick={onClose} aria-label="Close" style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '16px' }}>
            {[
              { label: 'kcal', value: plan.targets.tdee },
              { label: lang === 'sw' ? 'Protini' : 'Protein', value: `${plan.targets.proteinG}g` },
              { label: lang === 'sw' ? 'Wanga' : 'Carbs', value: `${plan.targets.carbsG}g` },
              { label: lang === 'sw' ? 'Chumvi' : 'Sodium', value: `${plan.targets.sodiumMg}mg` },
            ].map(t => (
              <div key={t.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: TEAL, fontFamily: "'Inter', system-ui" }}>{t.value}</div>
                <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.4px', fontFamily: "'Inter', system-ui" }}>{t.label}</div>
              </div>
            ))}
          </div>

          {cautions.length > 0 && (
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#166534', letterSpacing: '0.5px', marginBottom: '6px', fontFamily: "'Inter', system-ui" }}>
                {lang === 'sw' ? 'Tahadhari za Lishe' : 'Dietary Cautions'}
              </div>
              {cautions.map((c, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#166534', fontFamily: "'Inter', system-ui", marginBottom: '3px' }}>• {c}</div>
              ))}
            </div>
          )}

          {plan.meals.map(meal => (
            <div key={meal.mealType} style={{ border: '1.5px solid #e2e8f0', borderRadius: '8px', marginBottom: '10px', overflow: 'hidden' }}>
              <button
                onClick={() => toggleMeal(meal.mealType)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: mealColors[meal.mealType] + '20',
                  border: 'none', cursor: 'pointer',
                  borderBottom: openMeals.has(meal.mealType) ? `1.5px solid ${mealColors[meal.mealType]}40` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: mealColors[meal.mealType], display: 'inline-block' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: INK, fontFamily: "'Inter', system-ui" }}>
                    {lang === 'sw' ? meal.name_sw : meal.name_en}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontFamily: "'Inter', system-ui" }}>{meal.totalCalories} kcal</span>
                  <ChevronDown size={14} color="#64748b" style={{ transform: openMeals.has(meal.mealType) ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </div>
              </button>

              {openMeals.has(meal.mealType) && (
                <div style={{ padding: '10px 14px' }}>
                  {(lang === 'sw' ? meal.culturalNote_sw : meal.culturalNote_en) && (
                    <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '8px', fontFamily: "'Inter', system-ui" }}>
                      {lang === 'sw' ? meal.culturalNote_sw : meal.culturalNote_en}
                    </div>
                  )}
                  {meal.items.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 0', borderBottom: i < meal.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: INK, fontFamily: "'Inter', system-ui" }}>
                          {mealFoodName(item, lang)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: "'Inter', system-ui" }}>
                          {formatMealItemDetail(item, lang)}
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b', fontFamily: "'Inter', system-ui" }}>{item.macros.calories} kcal</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {plan.avoidFoods.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#991b1b', letterSpacing: '0.5px', marginBottom: '6px', fontFamily: "'Inter', system-ui" }}>
                {lang === 'sw' ? 'Vyakula vya Kuepuka' : 'Foods to Avoid'}
              </div>
              {plan.avoidFoods.map((f, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#991b1b', fontFamily: "'Inter', system-ui", marginBottom: '3px' }}>
                  • <strong>{lang === 'sw' ? f.name_sw : f.name_en}</strong> — {lang === 'sw' ? f.reason_sw : f.reason_en}
                </div>
              ))}
            </div>
          )}

          {plan.drugAlerts.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#92400e', letterSpacing: '0.5px', marginBottom: '6px', fontFamily: "'Inter', system-ui" }}>
                {lang === 'sw' ? 'Tahadhari za Dawa na Chakula' : 'Drug-Food Alerts'}
              </div>
              {plan.drugAlerts.map(a => (
                <div key={a.id} style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '6px', padding: '8px', marginBottom: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: INK, fontFamily: "'Inter', system-ui" }}>
                    {lang === 'sw' ? a.title_sw : a.title_en}
                  </div>
                  <div style={{ fontSize: '11px', color: '#92400e', fontFamily: "'Inter', system-ui", marginTop: '2px' }}>
                    {lang === 'sw' ? a.body_sw : a.body_en}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', fontFamily: "'Inter', system-ui", marginBottom: '4px' }}>
              {lang === 'sw' ? 'Ushauri wa Kila Siku wa Chakula' : 'Daily Meal Coaching'}
            </div>
            <div style={{ fontSize: '11px', color: '#166534', fontFamily: "'Inter', system-ui" }}>
              {lang === 'sw'
                ? 'Mwambie mgonjwa apakue AfyaLishe kwa ushauri wa kila siku wa chakula.'
                : 'Refer patient to AfyaLishe app for daily personalised meal coaching.'
              }
            </div>
          </div>
        </div>

        {/* Sticky footer — always visible Print / Share / PDF */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          borderRadius: '0 0 12px 12px',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: SLATE, letterSpacing: '0.5px', marginBottom: '8px', fontFamily: "'Inter', system-ui" }}>
            {lang === 'sw' ? 'Chapisha au Shiriki na Mgonjwa' : 'Print or Share with Patient'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              onClick={() => printDietarySlip(plan, patientName, lang)}
              style={{ ...actionBtn, background: TEAL, color: '#fff' }}
            >
              <Printer size={16} />
              {lang === 'sw' ? 'Chapisha' : 'Print'}
            </button>
            <button
              type="button"
              onClick={() => { void shareDietarySlip(plan, patientName, lang); }}
              style={{ ...actionBtn, background: '#0d7377', color: '#fff' }}
            >
              <Share2 size={16} />
              {lang === 'sw' ? 'Shiriki' : 'Share'}
            </button>
            <button
              type="button"
              onClick={() => saveDietarySlipPdf(plan, patientName, lang)}
              style={{ ...actionBtn, background: '#fff', color: INK, border: '1.5px solid rgba(191,200,205,.55)' }}
            >
              <FileDown size={16} />
              {lang === 'sw' ? 'Hifadhi PDF' : 'Save PDF'}
            </button>
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '8px', fontFamily: "'Inter', system-ui" }}>
            {lang === 'sw'
              ? 'Hifadhi PDF: chagua "Save as PDF" kwenye kidirisha cha kuchapisha.'
              : 'Save PDF: choose "Save as PDF" in the print dialog.'}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
