// RCRO NutritionTool — drug-food interaction alerts

import type { DrugFoodInteraction } from './types';

export function getDrugFoodInteractions(medicationIds: string[]): DrugFoodInteraction[] {
  const ids = new Set(medicationIds.map(x => String(x)));
  const out: DrugFoodInteraction[] = [];

  if (ids.has('MED_WARFARIN')) out.push({
    id: 'warfarin-vitk', medicationId: 'MED_WARFARIN', severity: 'warning',
    title_en: 'Warfarin: keep vitamin K intake consistent',
    title_sw: 'Warfarin: weka ulaji wa vitamin K kuwa thabiti',
    body_en: 'Avoid sudden big changes in dark leafy greens. Consistency matters more than avoidance.',
    body_sw: 'Epuka kubadilisha ghafla kiasi cha mboga za majani ya kijani. Uthabiti ni muhimu.',
  });

  if (ids.has('MED_CCB')) out.push({
    id: 'ccb-grapefruit', medicationId: 'MED_CCB', severity: 'warning',
    title_en: 'Calcium Channel Blocker: avoid grapefruit',
    title_sw: 'Dawa ya shinikizo la damu: epuka zabibu ya uchungu (grapefruit)',
    body_en: 'Grapefruit inhibits the enzyme that breaks down this medication, raising blood levels and risk of side effects.',
    body_sw: 'Zabibu ya uchungu huzuia enzyme inayovunja dawa hii, ikiongeza viwango vya damu na hatari ya athari.',
  });

  if (ids.has('MED_QUINOLONE')) out.push({
    id: 'quinolone-dairy', medicationId: 'MED_QUINOLONE', severity: 'warning',
    title_en: 'Quinolone antibiotics: separate from dairy and minerals',
    title_sw: 'Antibiotiki za quinolone: zitenganishe na maziwa na madini',
    body_en: 'Do not take with milk, yogurt, or iron/calcium/magnesium supplements. Space by 2h before or 4h after.',
    body_sw: 'Usimeze pamoja na maziwa, mtindi, au virutubisho vya chuma/calcium/magnesium.',
  });

  if (ids.has('MED_METRONIDAZOLE')) out.push({
    id: 'metronidazole-alcohol', medicationId: 'MED_METRONIDAZOLE', severity: 'warning',
    title_en: 'Metronidazole: avoid all alcohol',
    title_sw: 'Metronidazole: epuka pombe yote',
    body_en: 'Avoid alcohol during treatment and 48h after last dose to prevent severe vomiting.',
    body_sw: 'Epuka pombe wakati wa tiba na masaa 48 baada ya dozi ya mwisho.',
  });

  if (ids.has('MED_RIFAMPICIN') || ids.has('MED_ISONIAZID')) out.push({
    id: 'tb-food', medicationId: ids.has('MED_RIFAMPICIN') ? 'MED_RIFAMPICIN' : 'MED_ISONIAZID',
    severity: 'info',
    title_en: 'TB medicines: take with small snack if nausea occurs',
    title_sw: 'Dawa za TB: meza na kitafunwa kidogo ukihisi kichefuchefu',
    body_en: 'If nausea occurs, take TB medicines with a small snack unless fasting dose is prescribed.',
    body_sw: 'Ukihisi kichefuchefu, meza dawa za TB na kitafunwa kidogo isipokuwa daktari amesema tofauti.',
  });

  if (ids.has('MED_NSAID') || ids.has('MED_ASPIRIN')) out.push({
    id: 'nsaid-stomach', medicationId: ids.has('MED_NSAID') ? 'MED_NSAID' : 'MED_ASPIRIN',
    severity: 'warning',
    title_en: 'NSAIDs / Aspirin: take with food; stomach risk',
    title_sw: 'NSAIDs / Aspirini: meza na chakula; hatari ya tumbo',
    body_en: 'NSAIDs irritate the stomach lining. Always take with food and avoid combining multiple NSAIDs.',
    body_sw: 'NSAIDs huweza kuudhi ukuta wa tumbo. Meza daima na chakula na epuka kutumia NSAIDs nyingi.',
  });

  if (ids.has('MED_KSPARING')) out.push({
    id: 'ksparing-potassium', medicationId: 'MED_KSPARING', severity: 'warning',
    title_en: 'Spironolactone: limit high-potassium foods',
    title_sw: 'Spironolactone: punguza vyakula vyenye potasiamu nyingi',
    body_en: 'This diuretic retains potassium. Limit bananas, avocado, tomato paste, and potassium supplements.',
    body_sw: 'Dawa hii hushikilia potasiamu. Punguza ndizi, parachichi, tomato paste, na virutubisho vya potasiamu.',
  });

  if (ids.has('MED_METFORMIN')) out.push({
    id: 'metformin-food', medicationId: 'MED_METFORMIN', severity: 'info',
    title_en: 'Metformin: take with meals to reduce nausea',
    title_sw: 'Metformin: meza wakati wa mlo kupunguza kichefuchefu',
    body_en: 'Metformin causes less nausea when taken with food. No food restrictions needed.',
    body_sw: 'Metformin husababisha kichefuchefu kidogo ukimeza na chakula. Hakuna vikwazo maalum vya chakula.',
  });

  return out;
}
