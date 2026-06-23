import type { GeneratedMealPlan } from '../../lib/clinical';
import { buildCautions } from '../../lib/clinical/mealPlanner';
import { formatMealItemDetail, mealFoodName } from '../../lib/clinical/mealLocalization';

function L(lang: 'en' | 'sw', en: string, sw: string): string {
  return lang === 'en' ? en : sw;
}

export function buildDietarySlipHtml(
  plan: GeneratedMealPlan,
  patientName: string,
  lang: 'en' | 'sw',
): string {
  const cautions = buildCautions(plan.conditions ?? [], lang);
  const dayTotal = plan.meals.reduce((s, m) => s + m.totalCalories, 0);

  const headerHTML = `
    <div class="header">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div class="org-name">RemoteCare Research Organization</div>
          <div class="slip-title">${L(lang, 'Dietary Advice Slip', 'Karatasi ya Ushauri wa Lishe')}</div>
        </div>
        <div style="text-align:right;">
          <div class="meta-bold">${patientName}</div>
          <div class="meta">${plan.diagnosis || '—'} · ${plan.region}</div>
          <div class="meta">${plan.date}</div>
        </div>
      </div>
    </div>`;

  const targetsHTML = `
    <div class="targets">
      <div class="target-pill">
        <div class="target-value">${plan.targets.tdee}</div>
        <div class="target-label">${L(lang, 'kcal/day', 'kcal/siku')}</div>
      </div>
      <div class="target-pill">
        <div class="target-value">${dayTotal}</div>
        <div class="target-label">${L(lang, 'Plan kcal', 'kcal mpango')}</div>
      </div>
      <div class="target-pill">
        <div class="target-value">${plan.targets.proteinG}g</div>
        <div class="target-label">${L(lang, 'Protein', 'Protini')}</div>
      </div>
      <div class="target-pill">
        <div class="target-value">${plan.targets.carbsG}g</div>
        <div class="target-label">${L(lang, 'Carbs', 'Wanga')}</div>
      </div>
      <div class="target-pill">
        <div class="target-value">${Math.round(plan.targets.sodiumMg / 100) * 100}mg</div>
        <div class="target-label">${L(lang, 'Sodium max', 'Chumvi max')}</div>
      </div>
      <div class="target-pill">
        <div class="target-value">${plan.targets.fiberG}g</div>
        <div class="target-label">${L(lang, 'Fibre', 'Nyuzi')}</div>
      </div>
    </div>`;

  const mealHTML = `
    <div class="section-title-major">${L(lang, 'Sample Meal Combinations for Today', 'Mfano wa Mchanganyiko wa Chakula Leo')}</div>
    ${plan.meals.map(meal => `
      <div class="meal-card">
        <div class="meal-header">
          <div class="meal-title">${lang === 'sw' ? meal.name_sw : meal.name_en}</div>
          <div class="meal-kcal">${meal.totalCalories} kcal</div>
        </div>
        ${(lang === 'sw' ? meal.culturalNote_sw : meal.culturalNote_en) ? `<div class="meal-note">${lang === 'sw' ? meal.culturalNote_sw : meal.culturalNote_en}</div>` : ''}
        ${meal.items.map(item => `
          <div class="food-row">
            <span class="food-name">${mealFoodName(item, lang)}</span>
            <span class="food-detail">${formatMealItemDetail(item, lang)}</span>
          </div>
        `).join('')}
      </div>
    `).join('')}`;

  /* ── PAGE 2 ─────────────────────────────────────────── */

  const rec = plan.recommendedFoods;
  type RecGroup = {
    title: string;
    benefit: string;
    items: { id: string; name_en: string; name_sw: string }[];
    accent: string;
    bg: string;
    border: string;
  };
  const recGroups: RecGroup[] = rec ? [
    {
      title:   L(lang, 'Starches / Energy Foods', 'Wanga / Vyakula vya Nishati'),
      benefit: L(lang, 'Good source of energy', 'Chanzo kizuri cha nishati'),
      items:   rec.starch,   accent: '#92400e', bg: '#fffbeb', border: '#fcd34d',
    },
    {
      title:   L(lang, 'Proteins / Body-building Foods', 'Protini / Vyakula vya Kujenga Mwili'),
      benefit: L(lang, 'Builds and repairs tissue', 'Hujenga na kurekebisha tishu'),
      items:   rec.protein,  accent: '#3730a3', bg: '#eef2ff', border: '#a5b4fc',
    },
    {
      title:   L(lang, 'Vegetables', 'Mboga za Majani'),
      benefit: L(lang, 'Rich in vitamins & fibre', 'Tajiri wa vitamini na nyuzi'),
      items:   rec.vegetable, accent: '#166534', bg: '#f0fdf4', border: '#86efac',
    },
    {
      title:   L(lang, 'Fruits', 'Matunda'),
      benefit: L(lang, 'Rich in vitamins & antioxidants', 'Tajiri wa vitamini na antioxidants'),
      items:   rec.fruit,    accent: '#9a3412', bg: '#fff7ed', border: '#fdba74',
    },
  ].filter(g => g.items.length > 0) : [];

  const safeHTML = recGroups.length > 0 ? `
    <div class="section safe-section" style="margin-bottom:8px;">
      <div class="section-title">${L(lang, '✓ Foods to EAT — Safe for This Patient', '✓ Vyakula vya KULA — Salama kwa Mgonjwa Huyu')}</div>
      ${recGroups.map(g => `
        <div style="margin-bottom:7px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.3px;color:${g.accent};">${g.title}</div>
            <div style="font-size:7.5px;color:#64748b;font-style:italic;">${g.benefit}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;">
            ${g.items.map(f => `
              <div style="font-size:8.5px;color:${g.accent};padding:2px 0;border-bottom:1px solid ${g.border}40;">
                ✓ <strong>${lang === 'sw' ? f.name_sw : f.name_en}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const avoidHTML = plan.avoidFoods.length > 0 ? `
    <div class="section danger-section">
      <div class="section-title">${L(lang, '✗ Foods to AVOID', '✗ Vyakula vya KUEPUKA')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;">
        ${plan.avoidFoods.map(f => `
          <div class="avoid-row">• <strong>${lang === 'sw' ? f.name_sw : f.name_en}</strong> — ${lang === 'sw' ? f.reason_sw : f.reason_en}</div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const drugHTML = plan.drugAlerts.length > 0 ? `
    <div class="section warn-section">
      <div class="section-title">${L(lang, '⚠ Drug-Food Warnings', '⚠ Tahadhari za Dawa na Chakula')}</div>
      ${plan.drugAlerts.map(a => `
        <div class="drug-row"><strong>${lang === 'sw' ? a.title_sw : a.title_en}</strong> — ${lang === 'sw' ? a.body_sw : a.body_en}</div>
      `).join('')}
    </div>
  ` : '';

  const cautionHTML = cautions.length > 0 ? `
    <div class="section caution-section">
      <div class="section-title">${L(lang, 'Key Dietary Rules', 'Kanuni Muhimu za Lishe')}</div>
      ${cautions.map(c => `<div class="caution-row">• ${c}</div>`).join('')}
    </div>
  ` : '';

  const footerHTML = `
    <div class="footer">
      RCRO — ${L(lang, 'Your health, our priority', 'Afya yako, kipaumbele chetu')} · ${L(lang, 'Ask your doctor for more dietary guidance.', 'Muulize daktari wako kwa ushauri zaidi wa lishe.')}
    </div>`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <title>${L(lang, 'Dietary Advice', 'Ushauri wa Lishe')} — ${patientName}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', -apple-system, Roboto, sans-serif; font-size: 9.5px; color: #132b31; line-height: 1.4; }
    .header { border-bottom: 2.5px solid #10b981; padding-bottom: 10px; margin-bottom: 10px; }
    .org-name { font-size: 14px; font-weight: 900; color: #0d7377; text-transform: uppercase; letter-spacing: 0.5px; }
    .slip-title { font-size: 11px; font-weight: 700; color: #132b31; margin-top: 2px; }
    .meta { font-size: 8.5px; color: #64748b; margin-top: 1px; }
    .meta-bold { font-size: 10px; font-weight: 700; color: #132b31; }
    .targets { display: flex; gap: 5px; margin: 8px 0 12px; }
    .target-pill { background: #f0fdf4; border: 1px solid #86efac; border-radius: 5px; padding: 5px 6px; text-align: center; flex: 1; }
    .target-value { font-size: 12px; font-weight: 800; color: #10b981; }
    .target-label { font-size: 7px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.2px; margin-top: 1px; }
    .section-title-major { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0d7377; margin: 10px 0 5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    .meal-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 9px; margin-bottom: 6px; page-break-inside: avoid; }
    .meal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .meal-title { font-size: 10px; font-weight: 800; color: #0d7377; text-transform: uppercase; letter-spacing: 0.3px; }
    .meal-kcal { font-size: 10px; font-weight: 700; color: #10b981; background: #f0fdf4; border-radius: 3px; padding: 1px 7px; }
    .meal-note { font-size: 8.5px; color: #475569; font-style: italic; margin-bottom: 4px; }
    .food-row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #f1f5f9; font-size: 9px; }
    .food-name { font-weight: 600; color: #132b31; }
    .food-detail { color: #64748b; }
    /* ── Page 2 ── */
    .page-break { page-break-before: always; }
    .page2-header { border-bottom: 2.5px solid #10b981; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
    .page2-title { font-size: 12px; font-weight: 900; color: #0d7377; text-transform: uppercase; }
    .section { border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; page-break-inside: avoid; }
    .section-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 5px; }
    .safe-section { background: #f0fdf4; border: 1px solid #86efac; }
    .safe-section .section-title { color: #166534; }
    .danger-section { background: #fef2f2; border: 1px solid #fca5a5; }
    .danger-section .section-title { color: #991b1b; }
    .avoid-row { font-size: 8.5px; color: #7f1d1d; margin-bottom: 3px; }
    .warn-section { background: #fffbeb; border: 1px solid #fcd34d; }
    .warn-section .section-title { color: #92400e; }
    .drug-row { font-size: 8.5px; color: #78350f; margin-bottom: 3px; }
    .caution-section { background: #eff6ff; border: 1px solid #93c5fd; }
    .caution-section .section-title { color: #1e40af; }
    .caution-row { font-size: 8.5px; color: #1e3a8a; margin-bottom: 2px; }
    .footer { border-top: 1px solid #e2e8f0; margin-top: 10px; padding-top: 6px; font-size: 8px; color: #94a3b8; text-align: center; }
    .print-hint { display: none; }
    @media screen {
      .print-hint { display: block; background: #eff6ff; border: 1px solid #93c5fd; border-radius: 6px; padding: 10px; margin-bottom: 10px; font-size: 11px; color: #1e40af; }
    }
  </style>
</head>
<body>
  <div class="print-hint">${L(lang, 'To save as PDF: File → Print → "Save as PDF". Two pages will be generated.', 'Kuhifadhi kama PDF: Faili → Chapisha → "Hifadhi kama PDF". Kurasa mbili zitatengenezwa.')}</div>

  <!-- PAGE 1: Header + Targets + Meal Plan -->
  ${headerHTML}
  ${targetsHTML}
  ${mealHTML}
  ${footerHTML}

  <!-- PAGE 2: Safe foods, Avoid, Warnings -->
  <div class="page-break">
    <div class="page2-header">
      <div>
        <div class="page2-title">${L(lang, 'Food Guide', 'Mwongozo wa Chakula')}</div>
        <div class="meta">${patientName} · ${plan.diagnosis || '—'} · ${plan.date}</div>
      </div>
      <div class="meta">${L(lang, 'Page 2 of 2', 'Ukurasa 2 kati ya 2')}</div>
    </div>
    ${safeHTML}
    ${avoidHTML}
    ${drugHTML}
    ${cautionHTML}
    ${footerHTML}
  </div>
</body>
</html>`;
}

function slipFilename(patientName: string): string {
  const safe = patientName.replace(/[^\w-]+/g, '_').slice(0, 40);
  return `dietary-slip-${safe}-${new Date().toISOString().split('T')[0]}`;
}

function openSlipWindow(html: string): Window | null {
  const w = window.open('', '_blank', 'width=600,height=800');
  if (!w) return null;
  w.document.write(html);
  w.document.close();
  w.focus();
  return w;
}

export function printDietarySlip(
  plan: GeneratedMealPlan,
  patientName: string,
  lang: 'en' | 'sw',
): void {
  const html = buildDietarySlipHtml(plan, patientName, lang);
  const w = openSlipWindow(html);
  if (!w) {
    alert(L(lang, 'Please allow popups to print the dietary slip.', 'Ruhusu popups ili kuchapisha karatasi ya lishe.'));
    return;
  }
  setTimeout(() => { w.print(); }, 300);
}

/** Opens print dialog — user selects "Save as PDF" destination. */
export function saveDietarySlipPdf(
  plan: GeneratedMealPlan,
  patientName: string,
  lang: 'en' | 'sw',
): void {
  const html = buildDietarySlipHtml(plan, patientName, lang);
  const w = openSlipWindow(html);
  if (!w) {
    alert(L(lang, 'Please allow popups to save the dietary slip as PDF.', 'Ruhusu popups ili kuhifadhi karatasi kama PDF.'));
    return;
  }
  setTimeout(() => { w.print(); }, 400);
}

export function downloadDietarySlipHtml(
  plan: GeneratedMealPlan,
  patientName: string,
  lang: 'en' | 'sw',
): void {
  const html = buildDietarySlipHtml(plan, patientName, lang);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slipFilename(patientName)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildPlainTextSummary(
  plan: GeneratedMealPlan,
  patientName: string,
  lang: 'en' | 'sw',
): string {
  const dayTotal = plan.meals.reduce((s, m) => s + m.totalCalories, 0);
  const lines = [
    L(lang, `Dietary advice for ${patientName}`, `Ushauri wa lishe kwa ${patientName}`),
    `${plan.region} · ${plan.diagnosis || '—'} · ${dayTotal} kcal/day`,
    '',
    ...plan.meals.map(meal => {
      const title = lang === 'sw' ? meal.name_sw : meal.name_en;
      const items = meal.items.map(i =>
        `  - ${mealFoodName(i, lang)} (${formatMealItemDetail(i, lang)})`
      ).join('\n');
      return `${title} (${meal.totalCalories} kcal)\n${items}`;
    }),
  ];
  return lines.join('\n');
}

export async function shareDietarySlip(
  plan: GeneratedMealPlan,
  patientName: string,
  lang: 'en' | 'sw',
): Promise<void> {
  const html = buildDietarySlipHtml(plan, patientName, lang);
  const text = buildPlainTextSummary(plan, patientName, lang);
  const title = L(lang, `Meal plan — ${patientName}`, `Mpango wa chakula — ${patientName}`);

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const file = new File([html], `${slipFilename(patientName)}.html`, { type: 'text/html' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return;
      }
      await navigator.share({ title, text });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  downloadDietarySlipHtml(plan, patientName, lang);
}
