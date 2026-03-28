// ════════════════════════════════════════════════════════════
// REMOTECARE · src/data/drugInteractions.ts
// Drug interaction database for Tanzania NCD programme
// Links interactions to relevant lab investigations
// ════════════════════════════════════════════════════════════

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'monitor';

export interface DrugInteraction {
  id: string;
  drug1Pattern: string[];
  drug2Pattern: string[];
  severity: InteractionSeverity;
  mechanism: string;
  clinicalEffect: string;
  management: string;
  monitorLabs?: string[];
  monitorParams?: { labName: string; thresholdNote: string }[];
}

// ── DIAGNOSIS-DRUG WARNINGS ───────────────────────────────────
// Fired when a single drug is prescribed to a patient with a
// known diagnosis — even if only ONE drug is in the list.
// This is the fix for the "HCT in a diabetic" blind spot.

export interface DiagnosisDrugWarning {
  id: string;
  diagnosisPatterns: string[];   // ICD-10 prefixes or patient.cond values
  drugPattern: string[];         // lowercase partial matches
  severity: InteractionSeverity;
  clinicalEffect: string;
  mechanism: string;
  management: string;
  monitorLabs?: string[];
  monitorParams?: { labName: string; thresholdNote: string }[];
}

export const DIAGNOSIS_DRUG_WARNINGS: DiagnosisDrugWarning[] = [

  // ── THIAZIDE IN DIABETES ──────────────────────────────────
  {
    id: 'ddw001',
    diagnosisPatterns: ['E11', 'E10', 'DM', 'DM+HTN'],
    drugPattern: ['hydrochlorothiazide', 'bendroflumethiazide', 'chlorthalidone', 'indapamide'],
    severity: 'moderate',
    mechanism: 'Thiazide diuretics impair pancreatic insulin secretion and increase peripheral insulin resistance',
    clinicalEffect: 'Worsening glycaemic control — elevated fasting and post-prandial glucose, may unmask or worsen diabetes',
    management: 'Prefer CCB (amlodipine) or ACE inhibitor/ARB as first-line antihypertensive in diabetic patients. If thiazide needed, use low dose indapamide (1.5mg SR) which has least metabolic effect. Monitor HbA1c every 3 months and fasting glucose monthly.',
    monitorLabs: ['Fasting Blood Glucose', 'HbA1c'],
    monitorParams: [
      { labName: 'Fasting Blood Glucose', thresholdNote: 'Check monthly — thiazides raise blood glucose' },
      { labName: 'HbA1c', thresholdNote: 'Recheck HbA1c at 3 months after starting thiazide' },
    ],
  },

  // ── BETA-BLOCKER IN DIABETES ──────────────────────────────
  {
    id: 'ddw002',
    diagnosisPatterns: ['E11', 'E10', 'DM', 'DM+HTN'],
    drugPattern: ['propranolol', 'atenolol'],
    severity: 'moderate',
    mechanism: 'Non-selective beta-blockers mask tachycardia — the main warning symptom of hypoglycaemia. Also impair glycogen mobilisation.',
    clinicalEffect: 'Silent hypoglycaemia — patient may not feel palpitations during a hypo. Sweating is preserved (alpha-mediated) but may be misleading.',
    management: 'Prefer cardioselective beta-blockers (bisoprolol, metoprolol) over non-selective (propranolol, atenolol) in diabetic patients. Educate patient to check glucose if feeling sweaty or unwell. Avoid propranolol especially if on insulin or sulphonylurea.',
    monitorLabs: ['Fasting Blood Glucose'],
    monitorParams: [
      { labName: 'Fasting Blood Glucose', thresholdNote: 'Patient may not feel hypo — check glucose if unwell' },
    ],
  },

  // ── NSAIDs IN CKD / DIABETIC NEPHROPATHY ─────────────────
  {
    id: 'ddw003',
    diagnosisPatterns: ['N18', 'E11.2', 'N08', 'CKD'],
    drugPattern: ['ibuprofen', 'diclofenac', 'naproxen', 'indomethacin', 'celecoxib'],
    severity: 'major',
    mechanism: 'NSAIDs inhibit renal prostaglandins causing afferent arteriolar constriction — reduces GFR acutely',
    clinicalEffect: 'Acute-on-chronic kidney injury — may precipitate dialysis in already compromised kidneys',
    management: 'NSAIDs are CONTRAINDICATED in CKD (eGFR <60). Use paracetamol for pain. If inflammation, short course with renal function check after 5 days.',
    monitorLabs: ['Serum Creatinine', 'eGFR'],
    monitorParams: [
      { labName: 'eGFR', thresholdNote: 'Check eGFR before and 5 days after any NSAID use in CKD' },
    ],
  },

  // ── ACE INHIBITOR IN PREGNANCY ────────────────────────────
  {
    id: 'ddw004',
    diagnosisPatterns: ['O'],
    drugPattern: ['enalapril', 'lisinopril', 'captopril', 'ramipril', 'perindopril'],
    severity: 'contraindicated',
    mechanism: 'ACE inhibitors cross the placenta and cause fetal renal tubular dysplasia and oligohydramnios',
    clinicalEffect: 'Fetal renal failure, oligohydramnios, neonatal death — CONTRAINDICATED in all trimesters',
    management: 'STOP ACE inhibitor immediately. Switch to methyldopa 250mg BD or nifedipine SR 20mg BD for BP control in pregnancy. ARBs (losartan, valsartan) are equally contraindicated.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── METFORMIN IN HEART FAILURE ────────────────────────────
  {
    id: 'ddw005',
    diagnosisPatterns: ['I50'],
    drugPattern: ['metformin'],
    severity: 'moderate',
    mechanism: 'In decompensated heart failure, reduced cardiac output impairs renal perfusion — metformin accumulates causing lactic acidosis',
    clinicalEffect: 'Lactic acidosis — especially if eGFR <30 or patient hospitalised for decompensated HF',
    management: 'Hold metformin during acute decompensation or if eGFR <30. Resume when patient is stable and eGFR >30. SGLT2 inhibitors (empagliflozin, dapagliflozin) are preferred in HF with DM — they reduce hospitalisations.',
    monitorLabs: ['eGFR', 'Serum Creatinine'],
    monitorParams: [
      { labName: 'eGFR', thresholdNote: 'Stop metformin if eGFR <30 mL/min or acute decompensation' },
    ],
  },

  // ── THIAZIDE IN GOUT ──────────────────────────────────────
  {
    id: 'ddw006',
    diagnosisPatterns: ['M10', 'E79'],
    drugPattern: ['hydrochlorothiazide', 'bendroflumethiazide', 'chlorthalidone'],
    severity: 'moderate',
    mechanism: 'Thiazides reduce renal uric acid excretion — raises serum uric acid',
    clinicalEffect: 'Gout flare — can precipitate acute gouty arthritis or worsen chronic gout',
    management: 'Avoid thiazides in gout. Use amlodipine, losartan (losartan is actually uricosuric — preferred in gout + HTN), or ACE inhibitor instead.',
    monitorLabs: ['Serum Uric Acid'],
    monitorParams: [
      { labName: 'Serum Uric Acid', thresholdNote: 'Target uric acid <360 μmol/L (6 mg/dL)' },
    ],
  },

  // ── NSAID IN HEART FAILURE ────────────────────────────────
  {
    id: 'ddw007',
    diagnosisPatterns: ['I50', 'I11'],
    drugPattern: ['ibuprofen', 'diclofenac', 'naproxen', 'indomethacin', 'celecoxib'],
    severity: 'major',
    mechanism: 'NSAIDs cause sodium and water retention, vasoconstriction, and reduce efficacy of diuretics and ACE inhibitors',
    clinicalEffect: 'Acute decompensation of heart failure — fluid overload, worsening dyspnoea',
    management: 'NSAIDs are CONTRAINDICATED in heart failure. Use paracetamol. For inflammation, consider short course prednisolone under specialist guidance.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── SPIRONOLACTONE IN RENAL IMPAIRMENT ────────────────────
  {
    id: 'ddw008',
    diagnosisPatterns: ['N18', 'E11.2', 'N08'],
    drugPattern: ['spironolactone', 'eplerenone'],
    severity: 'major',
    mechanism: 'Spironolactone retains potassium — dangerous in already impaired kidneys that cannot excrete K+',
    clinicalEffect: 'Hyperkalaemia — life-threatening cardiac arrhythmia',
    management: 'Avoid spironolactone if eGFR <30. Use with caution if eGFR 30–45 with close potassium monitoring. Check K+ at baseline, 1 week, 1 month then every 3 months.',
    monitorLabs: ['Serum Potassium', 'eGFR'],
    monitorParams: [
      { labName: 'Serum Potassium', thresholdNote: 'Stop spironolactone if K+ >5.5 mmol/L' },
      { labName: 'eGFR', thresholdNote: 'Do not start if eGFR <30 mL/min' },
    ],
  },

  // ── METFORMIN IN RENAL IMPAIRMENT ────────────────────────
  {
    id: 'ddw009',
    diagnosisPatterns: ['N18', 'E11.2', 'N08'],
    drugPattern: ['metformin'],
    severity: 'major',
    mechanism: 'Metformin is renally cleared — accumulates in CKD causing lactic acidosis',
    clinicalEffect: 'Lactic acidosis — nausea, vomiting, abdominal pain, Kussmaul breathing, shock',
    management: 'Stop metformin if eGFR <30. Reduce dose by 50% if eGFR 30–45. Check eGFR every 3–6 months in CKD patients on metformin. Switch to gliclazide or insulin if eGFR deteriorates.',
    monitorLabs: ['eGFR', 'Serum Creatinine'],
    monitorParams: [
      { labName: 'eGFR', thresholdNote: 'Reduce dose if eGFR <45; STOP if eGFR <30' },
    ],
  },

  // ── CORTICOSTEROIDS IN DIABETES ──────────────────────────
  {
    id: 'ddw010',
    diagnosisPatterns: ['E11', 'E10', 'DM', 'DM+HTN'],
    drugPattern: ['prednisolone', 'dexamethasone', 'hydrocortisone', 'methylprednisolone'],
    severity: 'major',
    mechanism: 'Corticosteroids cause hepatic gluconeogenesis and peripheral insulin resistance — post-prandial hyperglycaemia',
    clinicalEffect: 'Severe hyperglycaemia — steroid-induced hyperglycaemia, may precipitate hyperosmolar state',
    management: 'Monitor glucose daily during steroid course. May need to increase DM medications or add insulin temporarily. Check fasting glucose within 48h of starting steroids.',
    monitorLabs: ['Fasting Blood Glucose', 'Random Blood Glucose'],
    monitorParams: [
      { labName: 'Random Blood Glucose', thresholdNote: 'Check glucose daily during steroid course — target <11.1 mmol/L' },
    ],
  },

  // ── WARFARIN IN LIVER DISEASE ─────────────────────────────
  {
    id: 'ddw011',
    diagnosisPatterns: ['K70', 'K74', 'B18'],
    drugPattern: ['warfarin'],
    severity: 'major',
    mechanism: 'Clotting factors synthesised in liver — already reduced in liver disease; warfarin amplifies this',
    clinicalEffect: 'Unpredictable anticoagulation — high bleeding risk even at low doses',
    management: 'Use warfarin with extreme caution in liver disease. Check INR at baseline and every 3–5 days initially. Consider LMWH or direct oral anticoagulant with haematology advice.',
    monitorLabs: ['INR / Prothrombin Time'],
    monitorParams: [
      { labName: 'INR / Prothrombin Time', thresholdNote: 'Baseline INR may already be elevated — target 2–3 above baseline' },
    ],
  },

  // ── ALLOPURINOL DURING GOUT FLARE ────────────────────────
  {
    id: 'ddw012',
    diagnosisPatterns: ['M10'],
    drugPattern: ['allopurinol'],
    severity: 'monitor',
    mechanism: 'Starting allopurinol during an acute gout flare causes mobilisation of urate crystals — prolongs or worsens the attack',
    clinicalEffect: 'Prolonged or worsened acute gout attack if allopurinol started during active flare',
    management: 'Do NOT start allopurinol during an acute gout attack. First treat the acute flare (colchicine or NSAID). Start allopurinol 2–4 weeks after the flare resolves, at a low dose (50–100mg), titrating up slowly with colchicine prophylaxis.',
    monitorLabs: ['Serum Uric Acid'],
    monitorParams: [
      { labName: 'Serum Uric Acid', thresholdNote: 'Target <360 μmol/L; check 4 weeks after each dose increase' },
    ],
  },
];

// ── DRUG-DRUG INTERACTION DATABASE ───────────────────────────

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

  // ── METFORMIN + CONTRAST MEDIA ──────────────────────────────
  {
    id: 'di003',
    drug1Pattern: ['metformin'],
    drug2Pattern: [],
    severity: 'monitor',
    mechanism: 'Metformin accumulates in renal impairment causing lactic acidosis',
    clinicalEffect: 'Lactic acidosis — potentially fatal',
    management: 'Check eGFR before starting. Stop if eGFR <30. Reduce dose if eGFR 30–60. Hold 48h before contrast procedures.',
    monitorLabs: ['eGFR', 'Serum Creatinine'],
    monitorParams: [{ labName: 'eGFR', thresholdNote: 'Stop Metformin if eGFR <30 mL/min' }],
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

  // ── THIAZIDE + SULPHONYLUREA / METFORMIN ────────────────────
  {
    id: 'di005',
    drug1Pattern: ['hydrochlorothiazide', 'bendroflumethiazide', 'chlorthalidone', 'indapamide'],
    drug2Pattern: ['glibenclamide', 'glipizide', 'glimepiride', 'metformin', 'gliclazide', 'insulin', 'sitagliptin', 'linagliptin', 'empagliflozin', 'dapagliflozin'],
    severity: 'moderate',
    mechanism: 'Thiazides impair insulin secretion and increase insulin resistance',
    clinicalEffect: 'Reduced glycaemic control — elevated blood glucose',
    management: 'Monitor glucose regularly. May need to increase antidiabetic dose. Consider alternative antihypertensive (amlodipine or ACE inhibitor preferred in DM).',
    monitorLabs: ['Fasting Blood Glucose', 'HbA1c'],
    monitorParams: [{ labName: 'HbA1c', thresholdNote: 'Recheck HbA1c after 3 months if thiazide added' }],
  },

  // ── THIAZIDE + ACE INHIBITOR (POTASSIUM) ────────────────────
  {
    id: 'di006',
    drug1Pattern: ['hydrochlorothiazide', 'chlorthalidone', 'indapamide'],
    drug2Pattern: ['enalapril', 'lisinopril', 'losartan', 'ramipril', 'captopril'],
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
    drug1Pattern: ['ibuprofen', 'diclofenac', 'naproxen', 'indomethacin'],
    drug2Pattern: ['enalapril', 'lisinopril', 'losartan', 'ramipril', 'captopril'],
    severity: 'major',
    mechanism: 'NSAIDs reduce renal prostaglandins causing sodium/water retention',
    clinicalEffect: 'Reduced antihypertensive effect, acute kidney injury',
    management: 'Avoid NSAIDs in patients on ACE inhibitors. Use paracetamol instead. If unavoidable, monitor renal function.',
    monitorLabs: ['Serum Creatinine', 'eGFR'],
    monitorParams: [{ labName: 'Serum Creatinine', thresholdNote: 'Check creatinine 1 week after adding NSAID' }],
  },

  // ── BETA-BLOCKER + INSULIN/SULPHONYLUREA ────────────────────
  {
    id: 'di008',
    drug1Pattern: ['atenolol', 'propranolol', 'metoprolol', 'bisoprolol', 'carvedilol'],
    drug2Pattern: ['insulin', 'glibenclamide', 'glipizide', 'glimepiride', 'gliclazide'],
    severity: 'moderate',
    mechanism: 'Beta-blockers mask tachycardia — a key warning sign of hypoglycaemia',
    clinicalEffect: 'Hypoglycaemia may be undetected. Sweating still occurs (alpha-mediated).',
    management: 'Use cardioselective beta-blocker (bisoprolol preferred). Educate patient that palpitations may not warn of low sugar. Monitor glucose.',
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
    drug1Pattern: ['hydrochlorothiazide', 'chlorthalidone'],
    drug2Pattern: ['lithium'],
    severity: 'major',
    mechanism: 'Thiazides reduce lithium excretion causing accumulation',
    clinicalEffect: 'Lithium toxicity — tremor, confusion, seizures, cardiac arrhythmias',
    management: 'Avoid combination. If unavoidable, reduce lithium dose by 50% and monitor levels weekly.',
    monitorLabs: ['Serum Sodium'],
    monitorParams: [{ labName: 'Serum Sodium', thresholdNote: 'Hyponatraemia worsens lithium toxicity' }],
  },

  // ── SGLT2 + LOOP DIURETIC ───────────────────────────────────
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
    management: 'Avoid unless cardiologist-directed. If unavoidable, add PPI cover and monitor INR closely.',
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
    management: 'Reduce warfarin dose by 25–50% while on antibiotics. Check INR every 3–5 days during course and 1 week after stopping.',
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
    management: 'Monitor INR very closely when starting or stopping rifampicin. May need to switch anticoagulant.',
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
    management: 'Avoid combination where possible. If used together, use lowest doses and monitor closely.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── ANTIDEPRESSANT + ACE INHIBITOR / ARB ──────────────────────
  {
    id: 'di020',
    drug1Pattern: ['amitriptyline', 'duloxetine'],
    drug2Pattern: ['enalapril', 'lisinopril', 'captopril', 'ramipril', 'losartan', 'valsartan'],
    severity: 'moderate',
    mechanism: 'TCAs block noradrenaline reuptake causing vasodilation — additive hypotensive effect',
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
    management: 'Dual antiplatelet therapy is indicated post-ACS/stent (first 12 months). Add PPI for GI protection. Review duration regularly.',
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
    management: 'For short antibiotic courses, temporary statin hold acceptable. Rosuvastatin/pravastatin are safer alternatives.',
    monitorLabs: [],
    monitorParams: [],
  },

  // ── SPIRONOLACTONE + ARB ─────────────────────────────────────
  {
    id: 'di023',
    drug1Pattern: ['spironolactone', 'eplerenone'],
    drug2Pattern: ['losartan', 'valsartan', 'irbesartan', 'telmisartan'],
    severity: 'major',
    mechanism: 'Both retain potassium via different RAAS mechanisms',
    clinicalEffect: 'Severe hyperkalaemia — life-threatening cardiac arrhythmia',
    management: 'Avoid triple therapy (ACE + ARB + mineralocorticoid antagonist). Monitor potassium closely if any two combined.',
    monitorLabs: ['Serum Potassium', 'Serum Creatinine'],
    monitorParams: [
      { labName: 'Serum Potassium', thresholdNote: 'Stop spironolactone if K+ >5.5 mmol/L' },
      { labName: 'Serum Creatinine', thresholdNote: 'Check renal function monthly for first 3 months' },
    ],
  },

  // ── DIGOXIN + AMIODARONE ─────────────────────────────────────
  {
    id: 'di024',
    drug1Pattern: ['digoxin'],
    drug2Pattern: ['amiodarone'],
    severity: 'major',
    mechanism: 'Amiodarone inhibits P-glycoprotein and CYP3A4 — increases digoxin levels',
    clinicalEffect: 'Digoxin toxicity — nausea, bradycardia, heart block, arrhythmia',
    management: 'Reduce digoxin dose by 50% when amiodarone added. Monitor digoxin levels and ECG closely.',
    monitorLabs: ['Serum Potassium'],
    monitorParams: [{ labName: 'Serum Potassium', thresholdNote: 'Hypokalaemia worsens digoxin toxicity — target K+ >4.0' }],
  },

  // ── ALLOPURINOL + ACE INHIBITOR ──────────────────────────────
  {
    id: 'di025',
    drug1Pattern: ['allopurinol'],
    drug2Pattern: ['enalapril', 'lisinopril', 'captopril', 'ramipril'],
    severity: 'moderate',
    mechanism: 'ACE inhibitors reduce allopurinol excretion; increased risk of allopurinol hypersensitivity',
    clinicalEffect: 'Stevens-Johnson syndrome, severe skin reactions (rare but serious)',
    management: 'Start allopurinol at low dose (50–100mg) and titrate slowly. Monitor for rash.',
    monitorLabs: ['Serum Creatinine'],
    monitorParams: [{ labName: 'Serum Creatinine', thresholdNote: 'Reduce allopurinol dose if eGFR <30 mL/min' }],
  },

  // ── CARBAMAZEPINE + MANY DRUGS ───────────────────────────────
  {
    id: 'di026',
    drug1Pattern: ['carbamazepine'],
    drug2Pattern: ['warfarin', 'atorvastatin', 'simvastatin', 'amlodipine', 'losartan',
                   'sertraline', 'fluoxetine', 'metformin', 'glibenclamide'],
    severity: 'moderate',
    mechanism: 'Carbamazepine is a potent CYP450 inducer — reduces plasma levels of many drugs',
    clinicalEffect: 'Subtherapeutic drug levels — loss of efficacy of warfarin, statins, CCBs, antidepressants',
    management: 'Monitor drug levels and clinical response closely when starting/stopping carbamazepine.',
    monitorLabs: ['INR / Prothrombin Time'],
    monitorParams: [{ labName: 'INR / Prothrombin Time', thresholdNote: 'INR falls when carbamazepine started — adjust warfarin dose' }],
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

export interface DetectedDiagnosisWarning {
  warning: DiagnosisDrugWarning;
  drugName: string;
  matchedDiagnosis: string;
}

/**
 * Check drug-drug interactions from a list of medication names.
 */
export function checkInteractions(medicationNames: string[]): DetectedInteraction[] {
  const detected: DetectedInteraction[] = [];
  const names = medicationNames.map((n) => n.toLowerCase());

  for (const interaction of DRUG_INTERACTIONS) {
    // Single-drug watch (drug2Pattern empty)
    if (interaction.drug2Pattern.length === 0) {
      for (let i = 0; i < names.length; i++) {
        if (interaction.drug1Pattern.some((p) => names[i].includes(p))) {
          detected.push({ interaction, drug1Name: medicationNames[i], drug2Name: '' });
        }
      }
      continue;
    }

    // Two-drug pairs
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const n1 = names[i], n2 = names[j];
        const match =
          (interaction.drug1Pattern.some((p) => n1.includes(p)) && interaction.drug2Pattern.some((p) => n2.includes(p))) ||
          (interaction.drug1Pattern.some((p) => n2.includes(p)) && interaction.drug2Pattern.some((p) => n1.includes(p)));

        if (match && !detected.some((d) => d.interaction.id === interaction.id)) {
          detected.push({ interaction, drug1Name: medicationNames[i], drug2Name: medicationNames[j] });
        }
      }
    }
  }

  const order: InteractionSeverity[] = ['contraindicated', 'major', 'moderate', 'monitor'];
  return detected.sort((a, b) =>
    order.indexOf(a.interaction.severity) - order.indexOf(b.interaction.severity)
  );
}

/**
 * Check drug-diagnosis warnings.
 * Fires even with a SINGLE drug — catches cases like HCT in a diabetic patient
 * where the antidiabetic drug may not yet be in the current med list.
 *
 * @param medicationNames  - current medication names being prescribed
 * @param diagnosisCodes   - active ICD-10 codes (e.g. ["E11", "I10"])
 * @param patientCond      - patient.cond ("DM", "HTN", "DM+HTN")
 */
export function checkDiagnosisWarnings(
  medicationNames: string[],
  diagnosisCodes: string[],
  patientCond: string = '',
): DetectedDiagnosisWarning[] {
  const detected: DetectedDiagnosisWarning[] = [];
  const names = medicationNames.map((n) => n.toLowerCase());

  // Build a flat list of all active condition identifiers to match against
  const activeDx = [
    ...diagnosisCodes,
    ...diagnosisCodes.map((c) => c.slice(0, 3)),   // prefix e.g. "E11" from "E11.40"
    ...diagnosisCodes.map((c) => c.slice(0, 1)),   // category letter e.g. "O" for pregnancy
    patientCond,
  ].map((d) => d.toUpperCase());

  for (const warning of DIAGNOSIS_DRUG_WARNINGS) {
    // Does this patient have one of the trigger diagnoses?
    const dxMatch = warning.diagnosisPatterns.some((dp) =>
      activeDx.some((dx) => dx.startsWith(dp.toUpperCase()))
    );
    if (!dxMatch) continue;

    // Does any current drug match the warning?
    for (let i = 0; i < names.length; i++) {
      const drugMatches = warning.drugPattern.some((p) => names[i].includes(p));
      if (drugMatches && !detected.some((d) => d.warning.id === warning.id && d.drugName === medicationNames[i])) {
        detected.push({
          warning,
          drugName: medicationNames[i],
          matchedDiagnosis: warning.diagnosisPatterns[0],
        });
      }
    }
  }

  const order: InteractionSeverity[] = ['contraindicated', 'major', 'moderate', 'monitor'];
  return detected.sort((a, b) =>
    order.indexOf(a.warning.severity) - order.indexOf(b.warning.severity)
  );
}

export function suggestMonitoringLabs(medicationNames: string[]): string[] {
  const interactions = checkInteractions(medicationNames);
  const labs = new Set<string>();
  for (const { interaction } of interactions) {
    for (const lab of interaction.monitorLabs ?? []) labs.add(lab);
  }
  return Array.from(labs);
}
