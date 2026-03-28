// ════════════════════════════════════════════════════════════
// REMOTECARE · src/data/drugInteractions.ts
// Drug interaction database for Tanzania NCD programme
// Links interactions to relevant lab investigations
// ════════════════════════════════════════════════════════════

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'monitor';

export interface DrugInteraction {
  id: string;
  drug1Pattern: string[];       // drug names or partial matches (lowercase)
  drug2Pattern: string[];
  severity: InteractionSeverity;
  mechanism: string;
  clinicalEffect: string;
  management: string;
  monitorLabs?: string[];       // lab tests to monitor (matches INVESTIGATION_TEMPLATES names)
  monitorParams?: {
    labName: string;
    thresholdNote: string;      // what to watch for
  }[];
}

export const DRUG_INTERACTIONS: DrugInteraction[] = [
  // ── ACE INHIBITOR + POTASSIUM-SPARING ──────────────────────
  {
    id: 'di001',
    drug1Pattern: ['enalapril', 'lisinopril', 'captopril', 'ramipril'],
    drug2Pattern: ['spironolactone', 'amiloride', 'triamterene'],
    severity: 'major',
    mechanism: 'Both drugs reduce potassium excretion',
    clinicalEffect: 'Hyperkalaemia — can cause dangerous cardiac arrhythmias',
    management: 'Avoid combination where possible. If necessary, monitor serum potassium closely. Reduce dietary potassium.',
    monitorLabs: ['Serum Potassium'],
    monitorParams: [{ labName: 'Serum Potassium', thresholdNote: 'Stop if K+ > 5.5 mmol/L' }],
  },

  // ── ACE INHIBITOR + ARB ─────────────────────────────────────
  {
    id: 'di002',
    drug1Pattern: ['enalapril', 'lisinopril'],
    drug2Pattern: ['losartan', 'valsartan', 'irbesartan'],
    severity: 'major',
    mechanism: 'Double blockade of renin-angiotensin system',
    clinicalEffect: 'Acute kidney injury, hyperkalaemia, severe hypotension',
    management: 'Combination generally contraindicated. Use one or the other. If combining, monitor renal function and potassium weekly.',
    monitorLabs: ['Serum Creatinine', 'Serum Potassium', 'eGFR'],
    monitorParams: [
      { labName: 'Serum Creatinine', thresholdNote: 'Stop if creatinine rises >30% from baseline' },
      { labName: 'Serum Potassium',  thresholdNote: 'Stop if K+ > 5.5 mmol/L' },
    ],
  },

  // ── METFORMIN + CONTRAST MEDIA / RENAL IMPAIRMENT ──────────
  {
    id: 'di003',
    drug1Pattern: ['metformin'],
    drug2Pattern: [],
    severity: 'monitor',
    mechanism: 'Metformin accumulates in renal impairment causing lactic acidosis',
    clinicalEffect: 'Lactic acidosis — potentially fatal',
    management: 'Check eGFR before starting. Stop if eGFR <30. Reduce dose if eGFR 30–60. Hold 48h before contrast procedures.',
    monitorLabs: ['eGFR', 'Serum Creatinine'],
    monitorParams: [
      { labName: 'eGFR', thresholdNote: 'Stop Metformin if eGFR <30 mL/min' },
    ],
  },

  // ── SULPHONYLUREA + ACE INHIBITOR ──────────────────────────
  {
    id: 'di004',
    drug1Pattern: ['glibenclamide', 'glipizide', 'glimepiride', 'gliclazide'],
    drug2Pattern: ['enalapril', 'lisinopril', 'captopril'],
    severity: 'moderate',
    mechanism: 'ACE inhibitors may enhance insulin sensitivity',
    clinicalEffect: 'Enhanced hypoglycaemic effect — increased risk of hypoglycaemia',
    management: 'Monitor blood glucose closely especially in first weeks. Patient education on hypoglycaemia symptoms.',
    monitorLabs: ['Fasting Blood Glucose', 'Random Blood Glucose'],
    monitorParams: [{ labName: 'Fasting Blood Glucose', thresholdNote: 'Watch for FBS <3.9 mmol/L (hypoglycaemia)' }],
  },

  // ── THIAZIDE + SULPHONYLUREA ─────────────────────────────────
  {
    id: 'di005',
    drug1Pattern: ['hydrochlorothiazide', 'bendroflumethiazide'],
    drug2Pattern: ['glibenclamide', 'glipizide', 'glimepiride', 'metformin'],
    severity: 'moderate',
    mechanism: 'Thiazides impair insulin secretion and increase insulin resistance',
    clinicalEffect: 'Reduced glycaemic control — elevated blood glucose',
    management: 'Monitor glucose regularly. May need to increase antidiabetic dose. Consider alternative antihypertensive.',
    monitorLabs: ['Fasting Blood Glucose', 'HbA1c'],
    monitorParams: [{ labName: 'HbA1c', thresholdNote: 'Recheck HbA1c after 3 months if thiazide added' }],
  },

  // ── THIAZIDE + ACE INHIBITOR (POTASSIUM) ────────────────────
  {
    id: 'di006',
    drug1Pattern: ['hydrochlorothiazide'],
    drug2Pattern: ['enalapril', 'lisinopril', 'losartan'],
    severity: 'monitor',
    mechanism: 'Thiazide causes potassium loss; ACE inhibitor retains potassium',
    clinicalEffect: 'May partially offset — but monitor for hypokalaemia or hyperkalaemia',
    management: 'Monitor potassium at baseline and 4–6 weeks after starting combination.',
    monitorLabs: ['Serum Potassium'],
    monitorParams: [{ labName: 'Serum Potassium', thresholdNote: 'Target K+ 3.5–5.0 mmol/L' }],
  },

  // ── NSAIDs + ACE INHIBITOR ───────────────────────────────────
  {
    id: 'di007',
    drug1Pattern: ['ibuprofen', 'diclofenac', 'naproxen', 'indomethacin', 'aspirin'],
    drug2Pattern: ['enalapril', 'lisinopril', 'losartan'],
    severity: 'major',
    mechanism: 'NSAIDs reduce renal prostaglandins causing sodium/water retention',
    clinicalEffect: 'Reduced antihypertensive effect, acute kidney injury',
    management: 'Avoid NSAIDs in patients on ACE inhibitors where possible. Use paracetamol instead. If unavoidable, monitor renal function.',
    monitorLabs: ['Serum Creatinine', 'eGFR'],
    monitorParams: [{ labName: 'Serum Creatinine', thresholdNote: 'Check creatinine 1 week after adding NSAID' }],
  },

  // ── BETA-BLOCKER + INSULIN/SULPHONYLUREA ────────────────────
  {
    id: 'di008',
    drug1Pattern: ['atenolol', 'propranolol', 'metoprolol', 'bisoprolol', 'carvedilol'],
    drug2Pattern: ['insulin', 'glibenclamide', 'glipizide', 'glimepiride'],
    severity: 'moderate',
    mechanism: 'Beta-blockers mask tachycardia — a key warning sign of hypoglycaemia',
    clinicalEffect: 'Hypoglycaemia may be undetected. Sweating still occurs (alpha-mediated).',
    management: 'Use cardioselective beta-blocker (atenolol, bisoprolol). Educate patient that palpitations may not warn of low sugar. Monitor glucose.',
    monitorLabs: ['Fasting Blood Glucose'],
    monitorParams: [{ labName: 'Fasting Blood Glucose', thresholdNote: 'Patient may not feel hypo — check glucose if unwell' }],
  },

  // ── STATIN + FIBRATE ─────────────────────────────────────────
  {
    id: 'di009',
    drug1Pattern: ['simvastatin', 'atorvastatin', 'rosuvastatin', 'lovastatin'],
    drug2Pattern: ['fenofibrate', 'gemfibrozil', 'bezafibrate'],
    severity: 'major',
    mechanism: 'Fibrates inhibit statin metabolism increasing plasma levels',
    clinicalEffect: 'Myopathy and rhabdomyolysis — muscle breakdown causing kidney failure',
    management: 'Avoid combination especially gemfibrozil + statin. If necessary, fenofibrate is safer. Monitor CK levels.',
    monitorLabs: ['Full Blood Count'],
    monitorParams: [{ labName: 'Full Blood Count', thresholdNote: 'Check CK if patient reports muscle pain/weakness' }],
  },

  // ── AMLODIPINE + SIMVASTATIN ─────────────────────────────────
  {
    id: 'di010',
    drug1Pattern: ['amlodipine'],
    drug2Pattern: ['simvastatin'],
    severity: 'moderate',
    mechanism: 'Amlodipine inhibits CYP3A4, increasing simvastatin levels',
    clinicalEffect: 'Increased risk of myopathy at high simvastatin doses',
    management: 'Limit simvastatin to 20mg/day when combined with amlodipine. Consider switching to atorvastatin or rosuvastatin.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── METFORMIN + ALCOHOL ──────────────────────────────────────
  {
    id: 'di011',
    drug1Pattern: ['metformin'],
    drug2Pattern: ['alcohol', 'ethanol'],
    severity: 'major',
    mechanism: 'Alcohol increases metformin-induced lactic acidosis risk',
    clinicalEffect: 'Lactic acidosis — nausea, vomiting, abdominal pain, respiratory distress',
    management: 'Advise patient to avoid alcohol. If heavy alcohol use, consider alternative antidiabetic.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── ACE INHIBITOR IN PREGNANCY ───────────────────────────────
  {
    id: 'di012',
    drug1Pattern: ['enalapril', 'lisinopril', 'captopril', 'ramipril'],
    drug2Pattern: [],
    severity: 'contraindicated',
    mechanism: 'ACE inhibitors cross placenta and cause fetal kidney damage',
    clinicalEffect: 'Fetal renal tubular dysplasia, oligohydramnios, fetal death',
    management: 'CONTRAINDICATED in pregnancy. Switch to methyldopa or nifedipine for HTN in pregnancy.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── THIAZIDE + LITHIUM ───────────────────────────────────────
  {
    id: 'di013',
    drug1Pattern: ['hydrochlorothiazide'],
    drug2Pattern: ['lithium'],
    severity: 'major',
    mechanism: 'Thiazides reduce lithium excretion causing accumulation',
    clinicalEffect: 'Lithium toxicity — tremor, confusion, seizures, cardiac arrhythmias',
    management: 'Avoid combination. If unavoidable, reduce lithium dose by 50% and monitor levels weekly.',
    monitorLabs: ['Serum Sodium'],
    monitorParams: [{ labName: 'Serum Sodium', thresholdNote: 'Hyponatraemia worsens lithium toxicity' }],
  },

  // ── EMPAGLIFLOZIN + LOOP DIURETIC ───────────────────────────
  {
    id: 'di014',
    drug1Pattern: ['empagliflozin', 'dapagliflozin', 'canagliflozin'],
    drug2Pattern: ['furosemide', 'bumetanide'],
    severity: 'moderate',
    mechanism: 'SGLT2 inhibitors have diuretic effect — additive with loop diuretics',
    clinicalEffect: 'Volume depletion, hypotension, acute kidney injury',
    management: 'Monitor renal function and blood pressure. Reduce loop diuretic dose if needed. Ensure adequate hydration.',
    monitorLabs: ['Serum Creatinine', 'eGFR', 'Serum Potassium'],
    monitorParams: [
      { labName: 'eGFR', thresholdNote: 'Stop SGLT2 if eGFR <45 mL/min' },
      { labName: 'Serum Potassium', thresholdNote: 'Watch for hypokalaemia' },
    ],
  },
];

// ── SEVERITY DISPLAY ─────────────────────────────────────────

export function severityDisplay(s: InteractionSeverity): {
  label: string; bg: string; color: string; icon: string;
} {
  switch (s) {
    case 'contraindicated':
      return { label: 'CONTRAINDICATED', bg: '#7f1d1d', color: '#fff', icon: '🚫' };
    case 'major':
      return { label: 'MAJOR',           bg: '#fee2e2', color: '#7f1d1d', icon: '⚠️' };
    case 'moderate':
      return { label: 'MODERATE',        bg: '#fef3c7', color: '#78350f', icon: '⚡' };
    case 'monitor':
      return { label: 'MONITOR',         bg: '#dbeafe', color: '#1e3a8a', icon: '🔍' };
  }
}

// ── INTERACTION CHECKER ──────────────────────────────────────

export interface DetectedInteraction {
  interaction: DrugInteraction;
  drug1Name: string;
  drug2Name: string;
}

/**
 * Check a list of medication names for known interactions.
 * Returns all detected interactions sorted by severity.
 */
export function checkInteractions(medicationNames: string[]): DetectedInteraction[] {
  const detected: DetectedInteraction[] = [];
  const names = medicationNames.map((n) => n.toLowerCase());

  for (const interaction of DRUG_INTERACTIONS) {
    // Single-drug interactions (e.g. metformin + renal failure risk)
    if (interaction.drug2Pattern.length === 0) {
      for (const name of names) {
        const matchesDrug1 = interaction.drug1Pattern.some((p) => name.includes(p));
        if (matchesDrug1) {
          detected.push({ interaction, drug1Name: name, drug2Name: '' });
        }
      }
      continue;
    }

    // Two-drug interactions
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const n1 = names[i];
        const n2 = names[j];

        const match1 =
          (interaction.drug1Pattern.some((p) => n1.includes(p)) &&
            interaction.drug2Pattern.some((p) => n2.includes(p))) ||
          (interaction.drug1Pattern.some((p) => n2.includes(p)) &&
            interaction.drug2Pattern.some((p) => n1.includes(p)));

        if (match1) {
          // Avoid duplicates
          const alreadyFound = detected.some(
            (d) => d.interaction.id === interaction.id,
          );
          if (!alreadyFound) {
            detected.push({
              interaction,
              drug1Name: medicationNames[i],
              drug2Name: medicationNames[j],
            });
          }
        }
      }
    }
  }

  // Sort: contraindicated first, then major, moderate, monitor
  const order: InteractionSeverity[] = ['contraindicated', 'major', 'moderate', 'monitor'];
  return detected.sort(
    (a, b) =>
      order.indexOf(a.interaction.severity) - order.indexOf(b.interaction.severity),
  );
}

/**
 * Get all lab tests that should be monitored given a list of medications.
 * Used to suggest relevant investigations in the visit modal.
 */
export function suggestMonitoringLabs(medicationNames: string[]): string[] {
  const interactions = checkInteractions(medicationNames);
  const labs = new Set<string>();
  for (const { interaction } of interactions) {
    for (const lab of interaction.monitorLabs ?? []) {
      labs.add(lab);
    }
  }
  return Array.from(labs);
}
