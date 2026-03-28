// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · DM/HTN NCD MANAGEMENT SYSTEM
// src/services/clinical.ts — All clinical logic & calculations
// Tanzania NCD STG 2017 · WHO ISH/2023 BP Guidelines
// ════════════════════════════════════════════════════════════

import type {
  Patient,
  Visit,
  BPClassification,
  GlucoseClassification,
  HbA1cClassification,
  HbA1cEntry,
  HbA1cQuarter,
  ClinicSettings,
  ClinicDayIndex,
} from '../types';

// ── CONSTANTS ────────────────────────────────────────────────

export const HTN_MEDS: string[] = [
  // CCBs
  'Amlodipine 5mg','Amlodipine 10mg','Nifedipine SR 20mg','Nifedipine SR 30mg',
  'Felodipine 5mg','Diltiazem 60mg','Diltiazem 120mg',
  // Beta-blockers
  'Atenolol 50mg','Atenolol 100mg','Bisoprolol 2.5mg','Bisoprolol 5mg','Bisoprolol 10mg',
  'Metoprolol 25mg','Metoprolol 50mg','Carvedilol 3.125mg','Carvedilol 6.25mg','Carvedilol 12.5mg',
  'Propranolol 40mg','Propranolol 80mg',
  // Diuretics
  'Hydrochlorothiazide 25mg','Chlorthalidone 12.5mg','Chlorthalidone 25mg',
  'Furosemide 20mg','Furosemide 40mg','Spironolactone 25mg','Spironolactone 50mg',
  'Indapamide 1.5mg SR','Indapamide 2.5mg',
  // ACE inhibitors
  'Enalapril 5mg','Enalapril 10mg','Enalapril 20mg',
  'Lisinopril 5mg','Lisinopril 10mg','Lisinopril 20mg',
  'Captopril 12.5mg','Captopril 25mg','Captopril 50mg',
  'Ramipril 2.5mg','Ramipril 5mg','Ramipril 10mg',
  // ARBs
  'Losartan 25mg','Losartan 50mg','Losartan 100mg',
  'Valsartan 80mg','Valsartan 160mg','Irbesartan 150mg','Irbesartan 300mg',
  'Telmisartan 40mg','Telmisartan 80mg',
  // Alpha-blockers / central
  'Methyldopa 250mg','Methyldopa 500mg','Hydralazine 25mg','Hydralazine 50mg',
  'Prazosin 1mg','Prazosin 2mg','Clonidine 75mcg','Clonidine 150mcg',
];

export const DM_MEDS: string[] = [
  // Biguanides
  'Metformin 500mg','Metformin 850mg','Metformin 1000mg',
  // Sulphonylureas
  'Glibenclamide 2.5mg','Glibenclamide 5mg',
  'Glipizide 5mg','Glipizide 10mg',
  'Glimepiride 1mg','Glimepiride 2mg','Glimepiride 4mg',
  'Gliclazide 40mg','Gliclazide MR 30mg','Gliclazide MR 60mg',
  // Insulins
  'Insulin Regular (short-acting)','Insulin NPH (intermediate)','Insulin Glargine (long-acting)',
  'Insulin Detemir','Insulin Mixtard 30/70','Insulin Aspart','Insulin Lispro',
  // SGLT2 inhibitors
  'Empagliflozin 10mg','Empagliflozin 25mg','Dapagliflozin 10mg','Canagliflozin 100mg',
  // DPP-4 inhibitors
  'Sitagliptin 50mg','Sitagliptin 100mg','Linagliptin 5mg','Saxagliptin 5mg',
  // GLP-1 agonists
  'Semaglutide 0.5mg weekly','Semaglutide 1mg weekly','Liraglutide 0.6mg',
  // Alpha-glucosidase inhibitors
  'Acarbose 50mg','Acarbose 100mg',
  // Thiazolidinediones
  'Pioglitazone 15mg','Pioglitazone 30mg',
];

// ── Comorbidity-specific drug groups ──────────────────────────
// Keyed by ICD-10 code prefix — used in MedRow to suggest
// relevant medications when a comorbidity is diagnosed

export interface MedGroup {
  label: string;
  meds: string[];
}

export const COMORBIDITY_MEDS: Record<string, MedGroup> = {
  // Dyslipidaemia
  'E78': {
    label: 'Lipid-Lowering',
    meds: [
      'Atorvastatin 10mg','Atorvastatin 20mg','Atorvastatin 40mg','Atorvastatin 80mg',
      'Rosuvastatin 5mg','Rosuvastatin 10mg','Rosuvastatin 20mg',
      'Simvastatin 10mg','Simvastatin 20mg','Simvastatin 40mg',
      'Fenofibrate 145mg','Fenofibrate 200mg',
      'Ezetimibe 10mg',
    ],
  },
  // Diabetic nephropathy / CKD
  'N18': {
    label: 'CKD / Renal Protection',
    meds: [
      'Folic Acid 5mg','Sodium Bicarbonate 500mg','Calcium Carbonate 500mg',
      'Ferrous Sulphate 200mg','Erythropoietin (EPO) 2000IU',
      'Furosemide 40mg','Furosemide 80mg','Phosphate binder (Sevelamer 800mg)',
    ],
  },
  // Heart failure
  'I50': {
    label: 'Heart Failure',
    meds: [
      'Bisoprolol 2.5mg','Bisoprolol 5mg','Bisoprolol 10mg',
      'Carvedilol 3.125mg','Carvedilol 6.25mg','Carvedilol 12.5mg',
      'Spironolactone 25mg','Spironolactone 50mg','Eplerenone 25mg',
      'Furosemide 20mg','Furosemide 40mg','Furosemide 80mg',
      'Digoxin 0.0625mg','Digoxin 0.125mg','Digoxin 0.25mg',
      'Sacubitril/Valsartan 24/26mg','Sacubitril/Valsartan 49/51mg',
      'Empagliflozin 10mg','Dapagliflozin 10mg',
    ],
  },
  // Ischaemic heart disease / angina
  'I25': {
    label: 'Ischaemic Heart Disease',
    meds: [
      'Aspirin 75mg','Aspirin 100mg','Aspirin 150mg',
      'Clopidogrel 75mg','Ticagrelor 90mg',
      'Nitroglycerine sublingual 0.5mg','Isosorbide Dinitrate 5mg','Isosorbide Dinitrate 10mg',
      'Isosorbide Mononitrate SR 30mg','Isosorbide Mononitrate SR 60mg',
      'Atorvastatin 40mg','Atorvastatin 80mg',
      'Ranolazine 500mg','Ranolazine 1000mg',
    ],
  },
  // Atrial fibrillation
  'I48': {
    label: 'Atrial Fibrillation',
    meds: [
      'Warfarin 1mg','Warfarin 2mg','Warfarin 5mg',
      'Digoxin 0.125mg','Digoxin 0.25mg',
      'Amiodarone 100mg','Amiodarone 200mg',
      'Bisoprolol 2.5mg','Bisoprolol 5mg',
      'Atenolol 25mg','Atenolol 50mg',
    ],
  },
  // Stroke / cerebrovascular — expanded entry below (I63)
  // Peripheral artery disease
  'I73': {
    label: 'Peripheral Artery Disease',
    meds: [
      'Aspirin 75mg','Aspirin 100mg','Clopidogrel 75mg',
      'Cilostazol 50mg','Cilostazol 100mg',
      'Pentoxifylline 400mg',
      'Atorvastatin 40mg','Atorvastatin 80mg',
    ],
  },
  // Thyroid disorders
  'E03': {
    label: 'Hypothyroidism',
    meds: [
      'Levothyroxine 25mcg','Levothyroxine 50mcg','Levothyroxine 75mcg',
      'Levothyroxine 100mcg','Levothyroxine 125mcg','Levothyroxine 150mcg',
    ],
  },
  'E05': {
    label: 'Hyperthyroidism',
    meds: [
      'Carbimazole 5mg','Carbimazole 10mg','Carbimazole 20mg',
      'Propylthiouracil 50mg','Propylthiouracil 100mg',
      'Propranolol 40mg','Propranolol 80mg',
    ],
  },
  // Gout / hyperuricaemia
  'M10': {
    label: 'Gout',
    meds: [
      'Allopurinol 100mg','Allopurinol 200mg','Allopurinol 300mg',
      'Colchicine 0.5mg','Colchicine 1mg',
      'Indomethacin 25mg','Indomethacin 50mg',
      'Febuxostat 40mg','Febuxostat 80mg',
    ],
  },
  // Depression
  'F32': {
    label: 'Depression / Mental Health',
    meds: [
      'Amitriptyline 10mg','Amitriptyline 25mg','Amitriptyline 50mg',
      'Fluoxetine 20mg','Sertraline 50mg','Sertraline 100mg',
      'Mirtazapine 15mg','Mirtazapine 30mg',
    ],
  },
  // Asthma / COPD
  'J45': {
    label: 'Asthma',
    meds: [
      'Salbutamol inhaler 100mcg','Beclometasone inhaler 100mcg','Beclometasone inhaler 200mcg',
      'Budesonide inhaler 200mcg','Fluticasone inhaler 125mcg',
      'Formoterol 12mcg inhaler','Salmeterol 25mcg inhaler',
      'Montelukast 10mg','Theophylline SR 200mg','Theophylline SR 300mg',
      'Prednisolone 5mg','Prednisolone 10mg',
    ],
  },
  'J44': {
    label: 'COPD',
    meds: [
      'Salbutamol inhaler 100mcg','Ipratropium inhaler 20mcg',
      'Tiotropium 18mcg inhaler','Formoterol 12mcg inhaler',
      'Beclometasone inhaler 200mcg','Roflumilast 500mcg',
      'Prednisolone 5mg','Prednisolone 10mg','N-Acetylcysteine 600mg',
    ],
  },
  // Peptic ulcer / GERD
  'K25': {
    label: 'Peptic Ulcer / GERD',
    meds: [
      'Omeprazole 20mg','Omeprazole 40mg','Pantoprazole 20mg','Pantoprazole 40mg',
      'Ranitidine 150mg','Ranitidine 300mg','Lansoprazole 15mg','Lansoprazole 30mg',
      'Antacid suspension','Sucralfate 1g',
    ],
  },
  // Anaemia
  'D50': {
    label: 'Iron-deficiency Anaemia',
    meds: [
      'Ferrous Sulphate 200mg','Ferrous Fumarate 200mg','Ferrous Gluconate 300mg',
      'Folic Acid 5mg','Vitamin B12 (Cyanocobalamin) 1mg',
      'Iron sucrose IV 100mg/5ml',
    ],
  },
  // Pain / musculoskeletal
  'M79': {
    label: 'Pain / Musculoskeletal',
    meds: [
      'Paracetamol 500mg','Paracetamol 1000mg',
      'Ibuprofen 200mg','Ibuprofen 400mg','Diclofenac 25mg','Diclofenac 50mg',
      'Naproxen 250mg','Naproxen 500mg',
      'Tramadol 50mg','Tramadol SR 100mg',
      'Gabapentin 100mg','Gabapentin 300mg','Pregabalin 75mg','Pregabalin 150mg',
      'Amitriptyline 10mg (neuropathic)',
    ],
  },
  // Infections / antibiotics (common in NCD comorbidity)
  'A09': {
    label: 'Antibiotics / Infections',
    meds: [
      'Amoxicillin 250mg','Amoxicillin 500mg','Co-amoxiclav 375mg','Co-amoxiclav 625mg',
      'Doxycycline 100mg','Azithromycin 250mg','Azithromycin 500mg',
      'Ciprofloxacin 250mg','Ciprofloxacin 500mg','Metronidazole 200mg','Metronidazole 400mg',
      'Cotrimoxazole 480mg','Cotrimoxazole 960mg',
    ],
  },

  // ── DIABETIC COMPLICATIONS ───────────────────────────────────

  // Diabetic peripheral neuropathy (E11.4 / E13.4)
  'E11': {
    label: 'Diabetic Neuropathy',
    meds: [
      // First-line neuropathic pain
      'Amitriptyline 10mg (neuropathy)','Amitriptyline 25mg (neuropathy)',
      'Gabapentin 100mg','Gabapentin 300mg','Gabapentin 400mg',
      'Pregabalin 75mg','Pregabalin 150mg','Pregabalin 300mg',
      // Second-line
      'Duloxetine 30mg','Duloxetine 60mg',
      'Carbamazepine 100mg','Carbamazepine 200mg',
      // Topical
      'Capsaicin cream 0.075%','Lignocaine gel 2%',
      // Supportive / vitamin
      'Vitamin B1 (Thiamine) 100mg','Vitamin B12 1mg','B-complex tablet',
      'Alpha-lipoic acid 600mg',
      // Foot care
      'Clotrimazole cream 1% (tinea)','Gentian violet (wound)',
    ],
  },

  // Diabetic retinopathy (E11.3)
  'E11.3': {
    label: 'Diabetic Retinopathy',
    meds: [
      // Tight glycaemic control is primary — re-emphasise
      'Metformin 1000mg','Insulin Glargine (long-acting)',
      // Eye-protective supplements
      'Vitamin C 500mg','Vitamin E 400IU','Lutein 10mg',
      // Co-morbid HTN control (retinopathy target <130/80)
      'Lisinopril 10mg','Losartan 50mg',
      // Aspirin (if no vitreous haemorrhage)
      'Aspirin 75mg',
    ],
  },

  // Diabetic foot / peripheral vascular disease (E11.5 / L97)
  'E11.5': {
    label: 'Diabetic Foot / Wound',
    meds: [
      'Amoxicillin 500mg (foot infection)','Co-amoxiclav 625mg (foot infection)',
      'Clindamycin 300mg','Metronidazole 400mg (anaerobic cover)',
      'Ciprofloxacin 500mg (gram-negative)','Flucloxacillin 500mg (staph)',
      'Zinc sulphate 220mg','Vitamin C 500mg (wound healing)',
      'Clopidogrel 75mg (PAD)','Aspirin 100mg (PAD)',
      'Pentoxifylline 400mg','Cilostazol 100mg',
      'Povidone-iodine solution (wound dressing)',
    ],
  },

  // ── STROKE & CEREBROVASCULAR ─────────────────────────────────

  // Ischaemic stroke — acute + maintenance (I63)
  'I63': {
    label: 'Stroke Maintenance',
    meds: [
      // Antiplatelets — maintenance (post-stroke secondary prevention)
      'Aspirin 75mg (secondary prevention)','Aspirin 100mg',
      'Clopidogrel 75mg (post-stroke)','Dipyridamole MR 200mg',
      // Anticoagulation (cardioembolic stroke / AF)
      'Warfarin 1mg','Warfarin 2mg','Warfarin 5mg',
      // Statin (mandatory post-stroke)
      'Atorvastatin 40mg','Atorvastatin 80mg','Rosuvastatin 20mg',
      // Strict BP control post-stroke (<130/80)
      'Amlodipine 5mg','Amlodipine 10mg',
      'Lisinopril 5mg','Lisinopril 10mg','Losartan 50mg','Losartan 100mg',
      'Indapamide 1.5mg SR',
      // Spasticity (post-stroke)
      'Baclofen 5mg','Baclofen 10mg','Diazepam 2mg (spasticity)',
      // Depression post-stroke
      'Sertraline 50mg (post-stroke depression)','Fluoxetine 20mg',
      // Seizure prophylaxis post-stroke
      'Carbamazepine 200mg','Phenytoin 100mg',
      // DVT prophylaxis (immobile post-stroke)
      'Heparin 5000IU SC (DVT prophylaxis)',
      // Swallowing / aspiration risk
      'Omeprazole 20mg (aspiration prophylaxis)',
    ],
  },

  // TIA (I63.9 / G45)
  'G45': {
    label: 'TIA / Mini-Stroke',
    meds: [
      'Aspirin 300mg (loading, first 2 weeks)','Aspirin 75mg (maintenance)',
      'Clopidogrel 75mg','Dipyridamole MR 200mg',
      'Atorvastatin 40mg','Atorvastatin 80mg',
      'Amlodipine 5mg','Lisinopril 10mg','Losartan 50mg',
    ],
  },

  // Haemorrhagic stroke (I61)
  'I61': {
    label: 'Haemorrhagic Stroke',
    meds: [
      // Strict BP control — target <140/90 (no antiplatelets)
      'Amlodipine 5mg','Amlodipine 10mg',
      'Lisinopril 5mg','Lisinopril 10mg',
      'Labetalol 100mg','Labetalol 200mg',
      // Raised ICP / oedema
      'Mannitol 20% IV (ICP)','Dexamethasone 4mg (vasogenic oedema)',
      // Seizure
      'Levetiracetam 500mg','Phenytoin 100mg',
      // DVT (immobile patient — mechanical first)
      'Enoxaparin 40mg SC (after 72h)',
      // Spasticity
      'Baclofen 5mg','Baclofen 10mg',
    ],
  },

  // ── NEUROPATHY (non-diabetic) ────────────────────────────────

  // Peripheral neuropathy — general (G62)
  'G62': {
    label: 'Peripheral Neuropathy',
    meds: [
      'Amitriptyline 10mg','Amitriptyline 25mg',
      'Gabapentin 100mg','Gabapentin 300mg','Gabapentin 400mg',
      'Pregabalin 75mg','Pregabalin 150mg',
      'Duloxetine 30mg','Duloxetine 60mg',
      'Carbamazepine 100mg','Carbamazepine 200mg',
      'Vitamin B1 (Thiamine) 100mg','Vitamin B12 1mg',
      'Alpha-lipoic acid 600mg',
      'Tramadol 50mg (breakthrough pain)',
    ],
  },

  // ── HEART ────────────────────────────────────────────────────

  // Hypertensive heart disease (I11)
  'I11': {
    label: 'Hypertensive Heart Disease',
    meds: [
      'Bisoprolol 5mg','Bisoprolol 10mg','Carvedilol 6.25mg','Carvedilol 12.5mg',
      'Enalapril 10mg','Enalapril 20mg','Lisinopril 10mg','Lisinopril 20mg',
      'Losartan 50mg','Losartan 100mg',
      'Spironolactone 25mg','Furosemide 40mg',
      'Sacubitril/Valsartan 24/26mg','Sacubitril/Valsartan 49/51mg',
      'Digoxin 0.125mg','Atorvastatin 40mg',
    ],
  },

  // Acute myocardial infarction / post-MI (I21 / I22)
  'I21': {
    label: 'Post-MI / ACS',
    meds: [
      // Mandatory post-MI quadruple therapy
      'Aspirin 75mg (lifelong)','Clopidogrel 75mg (12 months)',
      'Atorvastatin 80mg (lifelong)','Bisoprolol 5mg','Bisoprolol 10mg',
      'Ramipril 2.5mg','Ramipril 5mg','Ramipril 10mg',
      // SGLT2 — cardioprotective post-MI with HF
      'Empagliflozin 10mg','Dapagliflozin 10mg',
      // Nitrates PRN
      'Nitroglycerine sublingual 0.5mg','Isosorbide Dinitrate 5mg',
      'Isosorbide Mononitrate SR 30mg',
      // Aldosterone antagonist if EF reduced
      'Eplerenone 25mg','Spironolactone 25mg',
    ],
  },

  // ── RENAL ────────────────────────────────────────────────────

  // Diabetic nephropathy (E11.2 / N08)
  'N08': {
    label: 'Diabetic Nephropathy',
    meds: [
      // Renoprotection
      'Lisinopril 5mg (nephropathy)','Lisinopril 10mg','Losartan 50mg (nephropathy)',
      'Losartan 100mg','Irbesartan 150mg','Irbesartan 300mg',
      // SGLT2 (proven renal benefit)
      'Empagliflozin 10mg (renal protection)','Dapagliflozin 10mg',
      'Canagliflozin 100mg',
      // Phosphate control
      'Calcium Carbonate 500mg (phosphate binder)',
      'Sevelamer 800mg',
      // Anaemia of CKD
      'Ferrous Sulphate 200mg','Erythropoietin (EPO) 2000IU',
      // Metabolic acidosis
      'Sodium Bicarbonate 500mg',
      // Fluid management
      'Furosemide 40mg','Furosemide 80mg',
    ],
  },

  // ── EYES ─────────────────────────────────────────────────────

  // Glaucoma (H40)
  'H40': {
    label: 'Glaucoma',
    meds: [
      'Timolol 0.5% eye drops','Latanoprost 0.005% eye drops',
      'Brimonidine 0.2% eye drops','Dorzolamide 2% eye drops',
      'Acetazolamide 250mg (acute)',
    ],
  },

  // ── ENDOCRINE ────────────────────────────────────────────────

  // Obesity / metabolic syndrome (E66)
  'E66': {
    label: 'Obesity / Metabolic Syndrome',
    meds: [
      'Orlistat 120mg','Metformin 500mg (insulin resistance)',
      'Semaglutide 0.5mg weekly (weight loss)','Semaglutide 1mg weekly',
      'Liraglutide 0.6mg',
      'Topiramate 25mg (adjunct)',
    ],
  },

  // Hyperuricaemia without gout (E79)
  'E79': {
    label: 'Hyperuricaemia',
    meds: [
      'Allopurinol 100mg','Allopurinol 200mg','Allopurinol 300mg',
      'Febuxostat 40mg','Febuxostat 80mg',
    ],
  },

  // ── RESPIRATORY ──────────────────────────────────────────────

  // Tuberculosis (A15) — common NCD comorbidity in Tanzania
  'A15': {
    label: 'Tuberculosis (TB)',
    meds: [
      // Standard 6-month regimen — refer to TB clinic
      'Rifampicin 150mg','Rifampicin 300mg',
      'Isoniazid 100mg','Isoniazid 300mg',
      'Ethambutol 400mg',
      'Pyrazinamide 500mg',
      // Pyridoxine to prevent INH neuropathy
      'Pyridoxine (Vitamin B6) 25mg',
      // Note: Rifampicin accelerates warfarin metabolism
      'Pyridoxine (Vitamin B6) 50mg (high dose if neuropathy)',
    ],
  },

  // ── MENTAL HEALTH ────────────────────────────────────────────

  // Anxiety (F41)
  'F41': {
    label: 'Anxiety Disorder',
    meds: [
      'Sertraline 50mg','Sertraline 100mg',
      'Fluoxetine 20mg','Escitalopram 10mg','Escitalopram 20mg',
      'Buspirone 5mg','Buspirone 10mg',
      'Diazepam 2mg (short-term only)','Diazepam 5mg',
      'Propranolol 10mg (performance anxiety)',
    ],
  },

  // Alcohol use disorder (F10)
  'F10': {
    label: 'Alcohol Use Disorder',
    meds: [
      'Thiamine (Vitamin B1) 100mg','B-complex tablet',
      'Chlordiazepoxide 10mg (detox)','Chlordiazepoxide 25mg (detox)',
      'Diazepam 5mg (detox protocol)',
      'Naltrexone 50mg (relapse prevention)',
      'Acamprosate 333mg',
      'Folic Acid 5mg',
    ],
  },

  // ── MUSCULOSKELETAL ──────────────────────────────────────────

  // Osteoarthritis (M15 / M16 / M17)
  'M15': {
    label: 'Osteoarthritis',
    meds: [
      'Paracetamol 500mg','Paracetamol 1000mg',
      'Diclofenac 25mg','Diclofenac 50mg (with PPI cover)',
      'Ibuprofen 200mg','Ibuprofen 400mg',
      'Celecoxib 100mg','Celecoxib 200mg',
      'Tramadol 50mg',
      'Glucosamine 500mg','Chondroitin 400mg',
      'Omeprazole 20mg (GI protection with NSAIDs)',
      'Diclofenac gel 1% (topical)','Methyl salicylate cream (topical)',
    ],
  },

  // Osteoporosis (M81)
  'M81': {
    label: 'Osteoporosis',
    meds: [
      'Calcium Carbonate 500mg + Vitamin D3 400IU',
      'Calcium Carbonate 1000mg','Vitamin D3 800IU','Vitamin D3 1000IU',
      'Alendronate 70mg weekly','Risedronate 35mg weekly',
      'Calcitonin nasal spray',
    ],
  },
};

// Helper: get suggested med groups from a list of ICD-10 codes
// Matches on full code first (e.g. "E11.3"), then 3-char prefix (e.g. "E11")
export function getMedGroupsForDiagnoses(icdCodes: string[]): MedGroup[] {
  const groups: MedGroup[] = [];
  const seen = new Set<string>();
  for (const code of icdCodes) {
    // Try exact match first (e.g. "E11.3", "E11.5")
    if (!seen.has(code) && COMORBIDITY_MEDS[code]) {
      seen.add(code);
      groups.push({ ...COMORBIDITY_MEDS[code] });
    }
    // Then 3-char prefix (e.g. "E11" from "E11.40")
    const prefix = code.slice(0, 3);
    if (!seen.has(prefix) && COMORBIDITY_MEDS[prefix]) {
      seen.add(prefix);
      groups.push({ ...COMORBIDITY_MEDS[prefix] });
    }
  }
  return groups;
}

export const ALL_MEDS: string[] = [
  ...HTN_MEDS,
  ...DM_MEDS,
  ...Object.values(COMORBIDITY_MEDS).flatMap((g) => g.meds),
];

export const MONTHS: string[] = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

export const DAYS_FULL: string[] = [
  'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday',
];

export const VISIT_INTERVAL_DAYS = 30;
export const OVERDUE_THRESHOLD_DAYS = 28;

// ── BP CLASSIFICATION ─────────────────────────────────────────

export function bpClass(sbp: number, dbp: number): BPClassification {
  if (!sbp || !dbp) return { cls: 'chip-gray', lbl: 'No data', who: '' };
  if (sbp < 90  || dbp < 60)  return { cls: 'chip-low',     lbl: 'Hypotension',  who: 'Low BP — monitor closely, review medications' };
  if (sbp < 120 && dbp < 80)  return { cls: 'chip-normal',  lbl: 'Normal',       who: 'Normal — no intervention needed' };
  if (sbp < 140 && dbp < 90)  return { cls: 'chip-elevated',lbl: 'High-Normal',  who: 'High-Normal — lifestyle modification recommended' };
  if (sbp < 160 && dbp < 100) return { cls: 'chip-elevated',lbl: 'Grade 1 HTN',  who: 'Grade 1 — consider pharmacotherapy if lifestyle fails' };
  if (sbp < 180 && dbp < 110) return { cls: 'chip-high',    lbl: 'Grade 2 HTN',  who: 'Grade 2 — drug treatment indicated' };
  return                              { cls: 'chip-crisis',  lbl: 'Grade 3 HTN',  who: 'Grade 3 — URGENT, immediate treatment required' };
}

export function isBPControlled(sbp: number | null, dbp: number | null): boolean {
  if (!sbp || !dbp) return false;
  return sbp < 140 && dbp < 90;
}

// ── GLUCOSE CLASSIFICATION ────────────────────────────────────

export function sgClass(
  value: number,
  testType: 'FBS' | 'RBS' | '2HPP'
): GlucoseClassification {
  if (!value) return { cls: 'chip-gray', lbl: 'No data', who: '' };

  if (testType === 'FBS') {
    if (value < 3.0)  return { cls: 'chip-crisis',  lbl: 'Severe Hypo',  who: 'Severe hypoglycaemia — URGENT, give glucose immediately' };
    if (value < 3.9)  return { cls: 'chip-low',     lbl: 'Hypoglycaemia',who: 'Hypoglycaemia — give glucose immediately' };
    if (value < 5.6)  return { cls: 'chip-normal',  lbl: 'Normal FBS',   who: 'Normal fasting glucose' };
    if (value < 7.0)  return { cls: 'chip-elevated',lbl: 'IFG',          who: 'Impaired Fasting Glucose — pre-diabetes' };
    if (value < 10.0) return { cls: 'chip-high',    lbl: 'DM fair ctrl', who: 'Diabetic range — fair control' };
    if (value < 16.7) return { cls: 'chip-high',    lbl: 'DM poor ctrl', who: 'Poor glycaemic control — intensify treatment' };
    return                   { cls: 'chip-crisis',  lbl: 'DM danger',    who: 'Hyperglycaemic danger zone — urgent review' };
  }

  // RBS or 2HPP
  if (value < 3.0)  return { cls: 'chip-crisis',  lbl: 'Severe Hypo',  who: 'Severe hypoglycaemia — URGENT' };
  if (value < 3.9)  return { cls: 'chip-low',     lbl: 'Hypoglycaemia',who: 'Hypo — give glucose immediately' };
  if (value < 7.8)  return { cls: 'chip-normal',  lbl: 'Normal',       who: 'Normal post-load glucose' };
  if (value < 11.1) return { cls: 'chip-elevated',lbl: 'IGT',          who: 'Impaired Glucose Tolerance' };
  if (value < 16.7) return { cls: 'chip-high',    lbl: 'DM poor ctrl', who: 'Diabetic range — poor control' };
  return                   { cls: 'chip-crisis',  lbl: 'DM danger',    who: 'Hyperglycaemic danger zone — urgent review' };
}

export function isGlucoseControlled(value: number | null): boolean {
  if (!value) return false;
  return value < 10;
}

// ── HbA1c CLASSIFICATION ──────────────────────────────────────

export function hba1cClass(value: number): HbA1cClassification {
  if (!value) return { lbl: '—', cls: 'chip-gray', bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0', who: '' };
  if (value < 5.7)  return { lbl: 'Normal',          cls: 'chip-normal',   bg: '#dcfce7', color: '#14532d', border: '#86efac', who: 'No diabetes — normal HbA1c' };
  if (value < 6.5)  return { lbl: 'Pre-diabetes',    cls: 'chip-elevated', bg: '#fef3c7', color: '#78350f', border: '#fcd34d', who: 'Pre-diabetes — lifestyle intervention recommended' };
  if (value < 7.0)  return { lbl: 'DM – Excellent',  cls: 'chip-normal',   bg: '#dcfce7', color: '#14532d', border: '#86efac', who: 'Excellent DM control — maintain current therapy' };
  if (value < 8.0)  return { lbl: 'DM – At Target',  cls: 'chip-blue',     bg: '#e4f6fb', color: '#0c4a6e', border: '#7dd3fc', who: 'At HbA1c target (≤8%) — continue current therapy' };
  if (value < 9.0)  return { lbl: 'DM – Above Target',cls:'chip-elevated', bg: '#fef3c7', color: '#78350f', border: '#fcd34d', who: 'Above target — consider intensifying therapy' };
  if (value < 10.0) return { lbl: 'DM – Poor Control',cls:'chip-high',     bg: '#fee2e2', color: '#7f1d1d', border: '#fca5a5', who: 'Poor glycaemic control — intensify treatment now' };
  return                   { lbl: 'DM – Danger Zone', cls: 'chip-crisis',  bg: '#7f1d1d', color: '#fef2f2', border: '#dc2626', who: 'Very poor control — urgent clinical review required' };
}

export function isHbA1cAtTarget(value: number | null): boolean {
  if (!value) return false;
  return value < 8.0;
}

// ── PATIENT HELPERS ───────────────────────────────────────────

export function getLastVisit(patient: Patient): Visit | null {
  const attended = (patient.visits ?? []).filter((v) => v.att);
  if (!attended.length) return null;
  return [...attended].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
}

export function isDue(patient: Patient): boolean {
  if (patient.status !== 'active') return false;
  const lv = getLastVisit(patient);
  const ref = lv
    ? new Date(lv.date)
    : new Date(patient.enrol ?? new Date().toISOString());
  return (Date.now() - ref.getTime()) / 86_400_000 >= OVERDUE_THRESHOLD_DAYS;
}

export function isControlled(patient: Patient): boolean {
  const lv = getLastVisit(patient);
  if (!lv) return false;
  return (
    (!lv.sbp || isBPControlled(lv.sbp, lv.dbp)) &&
    (!lv.sugar || isGlucoseControlled(lv.sugar))
  );
}

export function getCurrentMeds(patient: Patient) {
  if (patient.medications?.length) {
    const sorted = [...patient.medications].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sorted[0].meds ?? [];
  }
  return getLastVisit(patient)?.meds ?? [];
}

// ── BMI ───────────────────────────────────────────────────────

export function calculateBMI(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const hM = heightCm / 100;
  return parseFloat((weightKg / (hM * hM)).toFixed(1));
}

export function bmiClass(bmi: number | null): { lbl: string; cls: string } {
  if (!bmi)      return { lbl: '—',         cls: 'chip-gray' };
  if (bmi < 18.5)return { lbl: 'Underweight',cls: 'chip-low' };
  if (bmi < 25.0)return { lbl: 'Normal',     cls: 'chip-normal' };
  if (bmi < 30.0)return { lbl: 'Overweight', cls: 'chip-elevated' };
  if (bmi < 35.0)return { lbl: 'Obese I',    cls: 'chip-high' };
  return               { lbl: 'Obese II+',  cls: 'chip-crisis' };
}

// ── CLINIC SCHEDULE ───────────────────────────────────────────

/**
 * Calculate next visit date.
 * Hard deadline = fromDate + intervalDays (NEVER exceeded).
 * Snaps backward to nearest configured clinic day (max 7 days back).
 */
export function nextVisitDate(
  fromDate: Date,
  intervalDays: number = VISIT_INTERVAL_DAYS,
  clinicDays: ClinicDayIndex[] = []
): Date {
  const deadline = new Date(fromDate);
  deadline.setDate(deadline.getDate() + intervalDays);

  if (!clinicDays.length) return deadline;

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(deadline);
    candidate.setDate(candidate.getDate() - offset);
    if (clinicDays.includes(candidate.getDay() as ClinicDayIndex)) {
      return candidate;
    }
  }
  return deadline;
}

export function getPatientNextVisitDate(patient: Patient, settings: ClinicSettings): Date {
  if (patient.scheduledNext?.date) return new Date(patient.scheduledNext.date);
  const lv = getLastVisit(patient);
  const from = lv?.date
    ? new Date(lv.date)
    : new Date(patient.enrol ?? new Date().toISOString());
  return nextVisitDate(from, VISIT_INTERVAL_DAYS, settings.days);
}

export function getDaysUntilVisit(patient: Patient, settings: ClinicSettings): number {
  const nd = getPatientNextVisitDate(patient, settings);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((nd.getTime() - today.getTime()) / 86_400_000);
}

// ── HbA1c HELPERS ─────────────────────────────────────────────

const Q_ORDER: HbA1cQuarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export function getLatestHbA1c(patient: Patient, year: number | null = null): HbA1cEntry | null {
  if (!patient.hba1c?.length) return null;
  let entries = year ? patient.hba1c.filter((h) => h.year === year) : patient.hba1c;
  if (!entries.length) entries = patient.hba1c;
  return [...entries].sort(
    (a, b) =>
      (b.year * 10 + Q_ORDER.indexOf(b.quarter)) -
      (a.year * 10 + Q_ORDER.indexOf(a.quarter))
  )[0] ?? null;
}

export function getHbA1cTrend(
  patient: Patient,
  year: number
): 'improving' | 'worsening' | 'stable' | 'insufficient-data' {
  const entries = (patient.hba1c ?? [])
    .filter((h) => h.year === year)
    .sort((a, b) => Q_ORDER.indexOf(a.quarter) - Q_ORDER.indexOf(b.quarter));
  if (entries.length < 2) return 'insufficient-data';
  const diff = entries[entries.length - 1].value - entries[0].value;
  if (diff < -0.5) return 'improving';
  if (diff > 0.5)  return 'worsening';
  return 'stable';
}

export function avgHbA1cForQuarter(
  patients: Patient[],
  year: number,
  quarter: HbA1cQuarter
): number | null {
  const values = patients
    .map((p) => (p.hba1c ?? []).find((h) => h.year === year && h.quarter === quarter))
    .filter((e): e is HbA1cEntry => !!e)
    .map((e) => e.value);
  if (!values.length) return null;
  return parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1));
}

export function getCurrentQuarter(): HbA1cQuarter {
  const m = new Date().getMonth();
  if (m < 3) return 'Q1';
  if (m < 6) return 'Q2';
  if (m < 9) return 'Q3';
  return 'Q4';
}

// ── PROGRAMME STATS ───────────────────────────────────────────

export function getProgrammeSummary(patients: Patient[]) {
  const active     = patients.filter((p) => p.status === 'active');
  const ltfu       = patients.filter((p) => p.status === 'ltfu');
  const due        = patients.filter((p) => isDue(p));
  const controlled = patients.filter((p) => isControlled(p));
  const dm         = patients.filter((p) => p.cond === 'DM' || p.cond === 'DM+HTN');
  const htn        = patients.filter((p) => p.cond === 'HTN' || p.cond === 'DM+HTN');
  return {
    total: patients.length, active: active.length,
    ltfu: ltfu.length, due: due.length,
    controlled: controlled.length, dm: dm.length, htn: htn.length,
    controlRate: active.length ? Math.round((controlled.length / active.length) * 100) : null,
    ltfuRate: patients.length ? Math.round((ltfu.length / patients.length) * 100) : null,
  };
}

export function getMonthlyStats(patients: Patient[], month: number) {
  const visits = patients.flatMap((p) => p.visits ?? []).filter((v) => +v.month === month);
  const attended = visits.filter((v) => v.att);
  const withBP   = attended.filter((v) => v.sbp && v.dbp);
  const bpCtrl   = withBP.filter((v) => isBPControlled(v.sbp, v.dbp));
  const withSG   = attended.filter((v) => v.sugar);
  const sgCtrl   = withSG.filter((v) => isGlucoseControlled(v.sugar));
  return {
    total: visits.length, attended: attended.length,
    missed: visits.length - attended.length,
    attendanceRate: visits.length ? Math.round((attended.length / visits.length) * 100) : null,
    bpMeasured: withBP.length, bpControlled: bpCtrl.length,
    bpControlRate: withBP.length ? Math.round((bpCtrl.length / withBP.length) * 100) : null,
    glucoseMeasured: withSG.length, glucoseControlled: sgCtrl.length,
    glucoseControlRate: withSG.length ? Math.round((sgCtrl.length / withSG.length) * 100) : null,
  };
}

// ── DATE UTILITIES ────────────────────────────────────────────

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}
