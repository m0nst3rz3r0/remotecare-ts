import type { GeneratedMealPlan } from '../../lib/clinical';

function L(lang: 'en' | 'sw', en: string, sw: string): string {
  return lang === 'en' ? en : sw;
}

export function buildDietarySlipHtml(
  plan: GeneratedMealPlan,
  patientName: string,
  lang: 'en' | 'sw',
): string {
  const mealHTML = plan.meals.map(meal => `
    <div class="meal-card">
      <div class="meal-title">${lang === 'sw' ? meal.name_sw : meal.name_en} — ${meal.totalCalories} kcal</div>
      ${meal.items.map(item => `
        <div class="food-row">
          <span class="food-name">${lang === 'sw' ? item.name_sw : item.name_en}</span>
          <span class="food-detail">${item.portionText}, ${item.preparation}</span>
        </div>
      `).join('')}
    </div>
  `).join('');

  const avoidHTML = plan.avoidFoods.length > 0 ? `
    <div class="section danger-section">
      <div class="section-title">${L(lang, 'Foods to AVOID', 'Vyakula vya KUEPUKA')}</div>
      ${plan.avoidFoods.map(f => `
        <div class="avoid-row">• <strong>${lang === 'sw' ? f.name_sw : f.name_en}</strong> — ${lang === 'sw' ? f.reason_sw : f.reason_en}</div>
      `).join('')}
    </div>
  ` : '';

  const drugHTML = plan.drugAlerts.length > 0 ? `
    <div class="section warn-section">
      <div class="section-title">${L(lang, 'Drug-Food Alerts', 'Tahadhari za Dawa na Chakula')}</div>
      ${plan.drugAlerts.map(a => `
        <div class="drug-row">⚠ <strong>${lang === 'sw' ? a.title_sw : a.title_en}</strong> — ${lang === 'sw' ? a.body_sw : a.body_en}</div>
      `).join('')}
    </div>
  ` : '';

  const cautionHTML = plan.cautions.length > 0 ? `
    <div class="section safe-section">
      <div class="section-title">${L(lang, 'Key Dietary Rules', 'Kanuni Muhimu za Lishe')}</div>
      ${plan.cautions.map(c => `<div class="caution-row">• ${c}</div>`).join('')}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <title>${L(lang, 'Dietary Advice', 'Ushauri wa Lishe')} — ${patientName}</title>
  <style>
    @page { size: A5 portrait; margin: 10mm 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 9.5px; color: #132b31; line-height: 1.4; }
    .header { border-bottom: 2px solid #10b981; padding-bottom: 8px; margin-bottom: 10px; }
    .org-name { font-size: 13px; font-weight: 800; color: #0d7377; text-transform: uppercase; letter-spacing: 0.5px; }
    .slip-title { font-size: 11px; font-weight: 700; color: #132b31; margin-top: 2px; }
    .meta { font-size: 8.5px; color: #64748b; margin-top: 2px; }
    .targets { display: flex; gap: 6px; margin: 8px 0; }
    .target-pill { background: #f0fdf4; border: 1px solid #86efac; border-radius: 5px; padding: 4px 8px; text-align: center; flex: 1; }
    .target-value { font-size: 13px; font-weight: 800; color: #10b981; }
    .target-label { font-size: 7.5px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.3px; }
    .meal-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; page-break-inside: avoid; }
    .meal-title { font-size: 10px; font-weight: 700; color: #0d7377; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
    .food-row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #f1f5f9; font-size: 9px; }
    .food-name { font-weight: 600; color: #132b31; }
    .food-detail { color: #64748b; }
    .section { border-radius: 6px; padding: 8px; margin-bottom: 8px; page-break-inside: avoid; }
    .section-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
    .danger-section { background: #fef2f2; border: 1px solid #fca5a5; }
    .danger-section .section-title { color: #991b1b; }
    .avoid-row { font-size: 8.5px; color: #7f1d1d; margin-bottom: 2px; }
    .warn-section { background: #fffbeb; border: 1px solid #fcd34d; }
    .warn-section .section-title { color: #92400e; }
    .drug-row { font-size: 8.5px; color: #78350f; margin-bottom: 3px; }
    .safe-section { background: #f0fdf4; border: 1px solid #86efac; }
    .safe-section .section-title { color: #166534; }
    .caution-row { font-size: 8.5px; color: #14532d; margin-bottom: 2px; }
    .footer { border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 6px; font-size: 8px; color: #94a3b8; text-align: center; }
    .print-hint { display: none; }
    @media screen {
      .print-hint { display: block; background: #eff6ff; border: 1px solid #93c5fd; border-radius: 6px; padding: 8px; margin-bottom: 10px; font-size: 10px; color: #1e40af; }
    }
  </style>
</head>
<body>
  <div class="print-hint">${L(lang, 'To save as PDF: open the print dialog and choose "Save as PDF" or "Microsoft Print to PDF".', 'Kuhifadhi kama PDF: fungua kidirisha cha kuchapisha na chagua "Save as PDF".')}</div>
  <div class="header">
    <div class="org-name">RemoteCare Research Organization</div>
    <div class="slip-title">${L(lang, 'Dietary Advice Slip', 'Karatasi ya Ushauri wa Lishe')}</div>
    <div class="meta">
      ${patientName} · ${plan.region} · ${plan.date} ·
      ${L(lang, 'Diagnosis:', 'Ugonjwa:')} ${plan.diagnosis || '—'}
    </div>
  </div>

  <div class="targets">
    <div class="target-pill">
      <div class="target-value">${plan.targets.tdee}</div>
      <div class="target-label">kcal/day</div>
    </div>
    <div class="target-pill">
      <div class="target-value">${plan.targets.proteinG}g</div>
      <div class="target-label">${L(lang, 'Protein', 'Protini')}</div>
    </div>
    <div class="target-pill">
      <div class="target-value">${Math.round(plan.targets.sodiumMg / 100) * 100}mg</div>
      <div class="target-label">${L(lang, 'Sodium limit', 'Kikomo cha chumvi')}</div>
    </div>
    <div class="target-pill">
      <div class="target-value">${plan.targets.fiberG}g</div>
      <div class="target-label">${L(lang, 'Fibre', 'Nyuzinyuzi')}</div>
    </div>
  </div>

  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#0d7377;margin:8px 0 4px;">
    ${L(lang, "Today's Meal Plan", 'Mpango wa Chakula wa Leo')}
  </div>
  ${mealHTML}

  ${cautionHTML}
  ${avoidHTML}
  ${drugHTML}

  <div class="footer">
    ${L(
      lang,
      'For daily meal coaching, ask your doctor about the AfyaLishe app. RCRO — Your health, our priority.',
      'Kwa ushauri wa kila siku wa chakula, muulize daktari wako kuhusu programu ya AfyaLishe. RCRO — Afya yako, kipaumbele chetu.',
    )}
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
      const items = meal.items.map(i => `  - ${lang === 'sw' ? i.name_sw : i.name_en} (${i.portionText})`).join('\n');
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
