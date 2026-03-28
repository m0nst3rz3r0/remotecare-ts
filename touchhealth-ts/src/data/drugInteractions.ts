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

  // ── WARFARIN + ASPIRIN / NSAIDs ─────────────────────────────
  {
    id: 'di015',
    drug1Pattern: ['warfarin'],
    drug2Pattern: ['aspirin', 'ibuprofen', 'diclofenac', 'naproxen', 'indomethacin'],
    severity: 'major',
    mechanism: 'Additive anticoagulant and antiplatelet effects; NSAIDs may cause gastric erosion',
    clinicalEffect: 'Serious or fatal bleeding — GI haemorrhage, intracranial bleed',
    management: 'Avoid combination unless cardiologist-directed (e.g. post-MI with AF). If unavoidable, add PPI cover. Monitor INR closely.',
    monitorLabs: ['INR / Prothrombin Time'],
    monitorParams: [{ labName: 'INR / Prothrombin Time', thresholdNote: 'Therapeutic INR 2–3; check INR weekly if aspirin added' }],
  },

  // ── WARFARIN + ANTIBIOTICS ───────────────────────────────────
  {
    id: 'di016',
    drug1Pattern: ['warfarin'],
    drug2Pattern: ['ciprofloxacin', 'metronidazole', 'doxycycline', 'azithromycin', 'cotrimoxazole', 'fluconazole'],
    severity: 'major',
    mechanism: 'Antibiotics disrupt gut flora reducing vitamin K synthesis; some inhibit CYP2C9',
    clinicalEffect: 'Elevated INR — risk of bleeding',
    management: 'Reduce warfarin dose by 25–50% while on antibiotics. Check INR every 3–5 days during antibiotic course and 1 week after stopping.',
    monitorLabs: ['INR / Prothrombin Time'],
    monitorParams: [{ labName: 'INR / Prothrombin Time', thresholdNote: 'Target INR 2–3; bleeding risk if INR >4' }],
  },

  // ── WARFARIN + RIFAMPICIN (TB) ───────────────────────────────
  {
    id: 'di017',
    drug1Pattern: ['warfarin'],
    drug2Pattern: ['rifampicin'],
    severity: 'major',
    mechanism: 'Rifampicin is a powerful CYP450 inducer — markedly increases warfarin metabolism',
    clinicalEffect: 'Subtherapeutic INR — thromboembolism risk. Warfarin dose may need to double or triple.',
    management: 'Monitor INR very closely when starting or stopping rifampicin. May need to switch anticoagulant. Adjust dose weekly.',
    monitorLabs: ['INR / Prothrombin Time'],
    monitorParams: [{ labName: 'INR / Prothrombin Time', thresholdNote: 'Check INR weekly; dose increase often 2–3× needed' }],
  },

  // ── AMITRIPTYLINE + BETA-BLOCKER ─────────────────────────────
  {
    id: 'di018',
    drug1Pattern: ['amitriptyline'],
    drug2Pattern: ['atenolol', 'propranolol', 'metoprolol', 'bisoprolol', 'carvedilol'],
    severity: 'moderate',
    mechanism: 'TCAs and beta-blockers both depress cardiac conduction',
    clinicalEffect: 'Bradycardia, prolonged QT interval, heart block',
    management: 'Use lowest effective amitriptyline dose. Avoid in patients with pre-existing conduction disease. ECG monitoring advisable.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── GABAPENTIN / PREGABALIN + OPIOIDS ────────────────────────
  {
    id: 'di019',
    drug1Pattern: ['gabapentin', 'pregabalin'],
    drug2Pattern: ['tramadol', 'morphine', 'codeine', 'oxycodone'],
    severity: 'major',
    mechanism: 'Additive CNS and respiratory depression',
    clinicalEffect: 'Respiratory depression, excessive sedation, risk of overdose death',
    management: 'Avoid combination where possible. If used together, use lowest doses and monitor closely. Do not prescribe for unsupervised outpatient use.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── AMITRIPTYLINE + ACE INHIBITOR / ARB ──────────────────────
  {
    id: 'di020',
    drug1Pattern: ['amitriptyline', 'duloxetine'],
    drug2Pattern: ['enalapril', 'lisinopril', 'captopril', 'ramipril', 'losartan', 'valsartan'],
    severity: 'moderate',
    mechanism: 'Additive hypotensive effect — TCAs block noradrenaline reuptake causing vasodilation',
    clinicalEffect: 'Postural hypotension — falls risk especially in elderly',
    management: 'Start amitriptyline at lowest dose (10mg nocte). Advise patient to sit up slowly. Monitor BP lying and standing.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── CLOPIDOGREL + ASPIRIN ─────────────────────────────────────
  {
    id: 'di021',
    drug1Pattern: ['clopidogrel'],
    drug2Pattern: ['aspirin'],
    severity: 'moderate',
    mechanism: 'Additive antiplatelet effect via different pathways',
    clinicalEffect: 'Increased bleeding risk — GI haemorrhage, bruising',
    management: 'Dual antiplatelet therapy is indicated post-ACS and post-stent (first 12 months). Add PPI (omeprazole/pantoprazole) for GI protection. Review duration regularly.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── STATIN + MACROLIDE ANTIBIOTICS ───────────────────────────
  {
    id: 'di022',
    drug1Pattern: ['simvastatin', 'atorvastatin', 'lovastatin'],
    drug2Pattern: ['azithromycin', 'clarithromycin', 'erythromycin'],
    severity: 'moderate',
    mechanism: 'Macrolides inhibit CYP3A4 increasing statin plasma levels',
    clinicalEffect: 'Myopathy and rhabdomyolysis risk',
    management: 'For short antibiotic courses (<5 days), temporary statin hold is acceptable. Avoid clarithromycin with simvastatin. Rosuvastatin/pravastatin are safer alternatives.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── ACE INHIBITOR / ARB + NSAID + DIURETIC (triple whammy) ──
  {
    id: 'di023',
    drug1Pattern: ['enalapril', 'lisinopril', 'losartan', 'ramipril', 'captopril'],
    drug2Pattern: ['ibuprofen', 'diclofenac', 'naproxen', 'indomethacin'],
    severity: 'major',
    mechanism: 'NSAIDs reduce renal perfusion; combined with RAAS blockade creates high AKI risk',
    clinicalEffect: 'Acute kidney injury — "triple whammy" if also on diuretic',
    management: 'Avoid NSAIDs in patients on ACE inhibitor or ARB. Use paracetamol. If necessary, hold diuretic during NSAID use and check creatinine after 1 week.',
    monitorLabs: ['Serum Creatinine', 'eGFR'],
    monitorParams: [{ labName: 'eGFR', thresholdNote: 'Check eGFR 5–7 days after adding NSAID' }],
  },

  // ── CARBAMAZEPINE + MANY DRUGS ───────────────────────────────
  {
    id: 'di024',
    drug1Pattern: ['carbamazepine'],
    drug2Pattern: ['warfarin', 'atorvastatin', 'simvastatin', 'amlodipine', 'losartan',
                   'sertraline', 'fluoxetine', 'metformin', 'glibenclamide'],
    severity: 'moderate',
    mechanism: 'Carbamazepine is a potent CYP450 inducer — reduces plasma levels of many drugs',
    clinicalEffect: 'Subtherapeutic drug levels — loss of efficacy of warfarin, statins, CCBs, antidepressants',
    management: 'Monitor drug levels and clinical response closely when starting/stopping carbamazepine. May need dose increases. Consider alternative anticonvulsant.',
    monitorLabs: ['INR / Prothrombin Time'],
    monitorParams: [{ labName: 'INR / Prothrombin Time', thresholdNote: 'INR falls when carbamazepine started — adjust warfarin dose' }],
  },

  // ── ALLOPURINOL + ACE INHIBITOR ──────────────────────────────
  {
    id: 'di025',
    drug1Pattern: ['allopurinol'],
    drug2Pattern: ['enalapril', 'lisinopril', 'captopril', 'ramipril'],
    severity: 'moderate',
    mechanism: 'ACE inhibitors reduce allopurinol excretion; increased risk of allopurinol hypersensitivity',
    clinicalEffect: 'Stevens-Johnson syndrome, severe skin reactions (rare but serious)',
    management: 'Start allopurinol at low dose (50–100mg) and titrate slowly. Monitor for rash. Allopurinol dose-adjust for renal function.',
    monitorLabs: ['Serum Creatinine'],
    monitorParams: [{ labName: 'Serum Creatinine', thresholdNote: 'Reduce allopurinol dose if eGFR <30 mL/min' }],
  },

  // ── DIGOXIN + AMIODARONE ─────────────────────────────────────
  {
    id: 'di026',
    drug1Pattern: ['digoxin'],
    drug2Pattern: ['amiodarone'],
    severity: 'major',
    mechanism: 'Amiodarone inhibits P-glycoprotein and CYP3A4 — increases digoxin levels',
    clinicalEffect: 'Digoxin toxicity — nausea, bradycardia, heart block, arrhythmia',
    management: 'Reduce digoxin dose by 50% when amiodarone added. Monitor digoxin levels and ECG closely.',
    monitorLabs: ['Serum Potassium'],
    monitorParams: [{ labName: 'Serum Potassium', thresholdNote: 'Hypokalaemia worsens digoxin toxicity — target K+ >4.0' }],
  },

  // ── SPIRONOLACTONE + ACE + ARB ───────────────────────────────
  {
    id: 'di027',
    drug1Pattern: ['spironolactone', 'eplerenone'],
    drug2Pattern: ['losartan', 'valsartan', 'irbesartan', 'telmisartan'],
    severity: 'major',
    mechanism: 'Both retain potassium via different RAAS mechanisms',
    clinicalEffect: 'Severe hyperkalaemia — life-threatening cardiac arrhythmia',
    management: 'Avoid triple therapy (ACE + ARB + mineralocorticoid antagonist). Monitor potassium closely if any two of these are combined.',
    monitorLabs: ['Serum Potassium', 'Serum Creatinine'],
    monitorParams: [
      { labName: 'Serum Potassium', thresholdNote: 'Stop spironolactone if K+ >5.5 mmol/L' },
      { labName: 'Serum Creatinine', thresholdNote: 'Check renal function monthly for first 3 months' },
    ],
  },

  // ── METFORMIN + CONTRAST / SURGERY ──────────────────────────
  {
    id: 'di028',
    drug1Pattern: ['metformin'],
    drug2Pattern: ['iodinated contrast', 'iv contrast', 'contrast media'],
    severity: 'major',
    mechanism: 'Contrast-induced AKI causes metformin accumulation leading to lactic acidosis',
    clinicalEffect: 'Lactic acidosis — potentially fatal if eGFR drops post-contrast',
    management: 'Hold metformin 48h before contrast procedure and restart only when renal function confirmed normal (creatinine check post-procedure).',
    monitorLabs: ['eGFR', 'Serum Creatinine'],
    monitorParams: [{ labName: 'Serum Creatinine', thresholdNote: 'Check creatinine 48h post-contrast before restarting metformin' }],
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
