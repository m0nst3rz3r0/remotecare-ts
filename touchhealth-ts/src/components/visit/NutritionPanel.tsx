import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Info, Utensils, Printer, Share2, FileDown, Eye } from 'lucide-react';
import {
  computeNutritionTargets,
  toMedIds,
  getDrugFoodInteractions,
  searchFoods,
  evalFoodForPatient,
  getPatientConditions,
  regionToZone,
  isFoodsReady,
  getNutritionRiskLevel,
  generateMealPlan,
  getRecommendedFoods,
} from '../../lib/clinical';
import { getClinicZone } from '../../lib/clinical/dataLoader';
import { calculateBMI } from '../../lib/clinical/calculators';
import type { GeneratedMealPlan, TZRegion } from '../../lib/clinical';
import type { Patient } from '../../types';
import { printDietarySlip, saveDietarySlipPdf, shareDietarySlip } from './DietarySlip';

const INK   = '#132b31';
const TEAL  = '#10b981';
const SLATE = '#516169';

const fieldStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid rgba(191,200,205,.55)',
  borderRadius: '4px', padding: '8px 10px', fontSize: '13px',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  color: INK, background: '#fff', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const,
  letterSpacing: '0.5px', color: SLATE, marginBottom: '4px',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
};

interface NutritionPanelProps {
  patient: Patient;
  weightKg: number | null;
  heightCm: number | null;
  currentMeds: string[];
  visitDiagnoses: string[];
  language: 'en' | 'sw';
  mealPlan?: GeneratedMealPlan | null;
  onGenerateMealPlan: (plan: GeneratedMealPlan) => void;
  onOpenMealPlan?: () => void;
}

function RecommendedFoodsSection({
  conditions, zone, language,
}: { conditions: string[]; zone: TZRegion; language: 'en' | 'sw' }) {
  const recs = useMemo(() => getRecommendedFoods(conditions, zone), [conditions, zone]);
  const hasAny = recs.starch.length > 0 || recs.protein.length > 0 || recs.vegetable.length > 0 || recs.fruit.length > 0;
  if (!hasAny) return null;

  const groups = [
    {
      label: language === 'sw' ? 'Wanga (Nishati)' : 'Starches (Energy)',
      items: recs.starch,
      color: '#d97706',
      bg: '#fffbeb',
    },
    {
      label: language === 'sw' ? 'Protini' : 'Proteins',
      items: recs.protein,
      color: '#6366f1',
      bg: '#f5f3ff',
    },
    {
      label: language === 'sw' ? 'Mboga' : 'Vegetables',
      items: recs.vegetable,
      color: '#10b981',
      bg: '#f0fdf4',
    },
    {
      label: language === 'sw' ? 'Matunda' : 'Fruits',
      items: recs.fruit,
      color: '#ea580c',
      bg: '#fff7ed',
    },
  ].filter(g => g.items.length > 0);

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={labelStyle}>
        {language === 'sw' ? 'Vyakula Salama kwa Mgonjwa Huyu' : 'Safe Foods for This Patient'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {groups.map(g => (
          <div key={g.label} style={{
            background: g.bg, border: `1.5px solid ${g.color}30`,
            borderRadius: '6px', padding: '8px 10px',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const,
              letterSpacing: '0.4px', color: g.color, marginBottom: '5px',
              fontFamily: "'Inter', system-ui",
            }}>{g.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {g.items.map(f => (
                <span key={f.id} style={{
                  fontSize: '11px', color: INK, background: '#fff',
                  border: `1px solid ${g.color}40`, borderRadius: '4px',
                  padding: '2px 8px', fontFamily: "'Inter', system-ui",
                }}>
                  {language === 'sw' ? f.name_sw : f.name_en}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NutritionPanel({
  patient, weightKg, heightCm, currentMeds,
  visitDiagnoses, language, mealPlan, onGenerateMealPlan, onOpenMealPlan,
}: NutritionPanelProps) {
  const [foodQuery, setFoodQuery] = useState('');
  const [generating, setGenerating] = useState(false);
  const [dataReady, setDataReady] = useState(isFoodsReady());

  useEffect(() => {
    if (dataReady) return;
    const t = setInterval(() => { if (isFoodsReady()) { setDataReady(true); clearInterval(t); } }, 200);
    return () => clearInterval(t);
  }, [dataReady]);

  const effectiveWeight = weightKg ??
    patient.visits.slice().reverse().find(v => v.weight)?.weight ?? null;
  const effectiveHeight = heightCm ??
    patient.visits.slice().reverse().find(v => v.height)?.height ?? null;

  const conditions = useMemo(() =>
    getPatientConditions(patient.cond, visitDiagnoses),
    [patient.cond, visitDiagnoses]
  );

  const zone: TZRegion =
    (patient.nutritionProfile?.zoneOverride as TZRegion | undefined)
    ?? getClinicZone()
    ?? regionToZone(patient.region);

  const activityLevel = patient.nutritionProfile?.activityLevel ?? 'Moderate';
  const bodyGoal = patient.nutritionProfile?.bodyGoal ?? 'maintain';

  const targets = useMemo(() => {
    if (!effectiveWeight || !effectiveHeight) return null;
    return computeNutritionTargets({
      age: patient.age,
      sex: patient.sex === 'M' ? 'male' : 'female',
      weightKg: effectiveWeight,
      heightCm: effectiveHeight,
      activityLevel,
      diagnoses: conditions,
      bodyGoal,
    });
  }, [effectiveWeight, effectiveHeight, patient.age, patient.sex, activityLevel, conditions, bodyGoal]);

  const bmi = effectiveWeight && effectiveHeight
    ? calculateBMI(effectiveWeight, effectiveHeight) : null;

  const riskLevel = targets && bmi
    ? getNutritionRiskLevel(conditions, bmi, targets.sodiumMg)
    : null;

  const medIds = useMemo(() => toMedIds(currentMeds), [currentMeds]);
  const drugAlerts = useMemo(() => getDrugFoodInteractions(medIds), [medIds]);

  const foodResults = useMemo(() => {
    if (!dataReady || foodQuery.length < 2) return [];
    return searchFoods(foodQuery, zone, 6);
  }, [foodQuery, zone, dataReady]);

  const handleGenerateMealPlan = () => {
    if (!effectiveWeight || !effectiveHeight) {
      alert('Weight and height are required to generate a meal plan. Please record vitals first.');
      return;
    }
    setGenerating(true);
    setTimeout(() => {
      try {
        const plan = generateMealPlan({
          patientCode: patient.code,
          age: patient.age,
          sex: patient.sex === 'M' ? 'male' : 'female',
          weightKg: effectiveWeight,
          heightCm: effectiveHeight,
          conditions,
          zone,
          language,
          activityLevel,
          bodyGoal,
          medicationIds: medIds,
        });
        onGenerateMealPlan(plan);
      } finally {
        setGenerating(false);
      }
    }, 10);
  };

  const riskColors: Record<string, string> = {
    Low: '#10b981', Moderate: '#d97706', High: '#dc2626',
  };

  if (!dataReady) {
    return (
      <div style={{ padding: '12px', color: SLATE, fontSize: '12px', textAlign: 'center' }}>
        Loading nutrition data…
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {targets ? (
        <div style={{ marginBottom: '14px' }}>
          <div style={labelStyle}>Daily Targets</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
            {[
              { label: 'Calories', value: `${targets.tdee} kcal`, color: TEAL },
              { label: 'Protein', value: `${targets.proteinG}g`, color: '#6366f1' },
              { label: 'Carbs', value: `${targets.carbsG}g`, color: '#f59e0b' },
              { label: 'Sodium', value: `${Math.round(targets.sodiumMg / 100) * 100}mg`, color: '#ef4444' },
            ].map(t => (
              <div key={t.label} style={{
                background: '#f8fafc', border: '1.5px solid rgba(191,200,205,.4)',
                borderRadius: '6px', padding: '8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: t.color, fontFamily: "'Inter', system-ui" }}>{t.value}</div>
                <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: SLATE, letterSpacing: '0.4px' }}>{t.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {riskLevel && (
              <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                padding: '2px 10px', borderRadius: '9999px',
                background: riskColors[riskLevel] + '20',
                color: riskColors[riskLevel],
                border: `1.5px solid ${riskColors[riskLevel]}40`,
                fontFamily: "'Inter', system-ui",
              }}>
                {riskLevel} Nutrition Risk
              </span>
            )}
            {bmi && (
              <span style={{ fontSize: '11px', color: SLATE, fontFamily: "'Inter', system-ui" }}>
                BMI: <strong>{bmi.toFixed(1)}</strong>
              </span>
            )}
            <span style={{ fontSize: '11px', color: SLATE, fontFamily: "'Inter', system-ui" }}>
              Zone: <strong>{zone}</strong>
            </span>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#fffbeb', border: '1.5px solid #fcd34d',
          borderRadius: '6px', padding: '10px', marginBottom: '14px',
          fontSize: '12px', color: '#92400e', fontFamily: "'Inter', system-ui",
          display: 'flex', gap: '8px', alignItems: 'flex-start',
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>Record weight and height in Vitals to see nutrition targets and generate a meal plan.</span>
        </div>
      )}

      {drugAlerts.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={labelStyle}>Drug-Food Alerts ({drugAlerts.length})</div>
          {drugAlerts.map(alert => (
            <div key={alert.id} style={{
              background: alert.severity === 'warning' ? '#fffbeb' : '#eff6ff',
              border: `1.5px solid ${alert.severity === 'warning' ? '#fcd34d' : '#93c5fd'}`,
              borderRadius: '6px', padding: '10px', marginBottom: '6px',
              display: 'flex', gap: '8px',
            }}>
              {alert.severity === 'warning'
                ? <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                : <Info size={14} color="#3b82f6" style={{ flexShrink: 0, marginTop: '1px' }} />
              }
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: INK, fontFamily: "'Inter', system-ui", marginBottom: '2px' }}>
                  {language === 'sw' ? alert.title_sw : alert.title_en}
                </div>
                <div style={{ fontSize: '11px', color: SLATE, fontFamily: "'Inter', system-ui" }}>
                  {language === 'sw' ? alert.body_sw : alert.body_en}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dataReady && (
        <RecommendedFoodsSection conditions={conditions} zone={zone} language={language} />
      )}

      <div style={{ marginBottom: '14px' }}>
        <div style={labelStyle}>Food Safety Quick-Check</div>
        <input
          type="text"
          placeholder={language === 'sw' ? 'Andika chakula… mfano ugali, maharage' : 'Type a food… e.g. ugali, beans, fish'}
          value={foodQuery}
          onChange={e => setFoodQuery(e.target.value)}
          style={fieldStyle}
        />
        {foodResults.length > 0 && (
          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {foodResults.map(food => {
              const result = evalFoodForPatient(food.id, 'Boiled', conditions);
              const colors = { Safe: '#10b981', Warning: '#d97706', Danger: '#dc2626' };
              const bgs    = { Safe: '#f0fdf4', Warning: '#fffbeb', Danger: '#fef2f2' };
              return (
                <div key={food.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', borderRadius: '6px',
                  background: bgs[result.severity],
                  border: `1.5px solid ${colors[result.severity]}40`,
                }}>
                  <span style={{ fontSize: '12px', color: INK, fontFamily: "'Inter', system-ui" }}>
                    {language === 'sw' ? food.name_sw : food.name_en}
                  </span>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: '9999px',
                    background: colors[result.severity] + '25',
                    color: colors[result.severity], fontFamily: "'Inter', system-ui",
                    letterSpacing: '0.4px',
                  }}>
                    {result.severity}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={handleGenerateMealPlan}
          disabled={generating || !effectiveWeight || !effectiveHeight}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: generating || !effectiveWeight ? '#e2e8f0' : TEAL,
            color: generating || !effectiveWeight ? SLATE : '#fff',
            border: 'none', borderRadius: '6px', padding: '8px 16px',
            fontSize: '12px', fontWeight: 700, cursor: generating || !effectiveWeight ? 'not-allowed' : 'pointer',
            fontFamily: "'Inter', system-ui", textTransform: 'uppercase', letterSpacing: '0.4px',
          }}
        >
          <Utensils size={13} />
          {generating ? 'Generating…' : (language === 'sw' ? 'Tengeneza Mpango wa Chakula' : 'Generate Meal Plan')}
        </button>
      </div>

      {mealPlan && (
        <div style={{ marginTop: '14px', padding: '12px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '8px' }}>
          <div style={{ ...labelStyle, color: '#166534', marginBottom: '8px' }}>
            {language === 'sw' ? 'Mpango Umetengenezwa — Chapisha au Shiriki' : 'Plan Ready — Print or Share'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {onOpenMealPlan && (
              <button type="button" onClick={onOpenMealPlan}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: INK, border: '1.5px solid rgba(191,200,205,.55)', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', system-ui" }}>
                <Eye size={14} /> {language === 'sw' ? 'Angalia' : 'View'}
              </button>
            )}
            <button type="button" onClick={() => printDietarySlip(mealPlan, patient.code, language)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: TEAL, color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', system-ui" }}>
              <Printer size={14} /> {language === 'sw' ? 'Chapisha' : 'Print'}
            </button>
            <button type="button" onClick={() => { void shareDietarySlip(mealPlan, patient.code, language); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0d7377', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', system-ui" }}>
              <Share2 size={14} /> {language === 'sw' ? 'Shiriki' : 'Share'}
            </button>
            <button type="button" onClick={() => saveDietarySlipPdf(mealPlan, patient.code, language)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: INK, border: '1.5px solid rgba(191,200,205,.55)', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', system-ui" }}>
              <FileDown size={14} /> {language === 'sw' ? 'Hifadhi PDF' : 'Save PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
