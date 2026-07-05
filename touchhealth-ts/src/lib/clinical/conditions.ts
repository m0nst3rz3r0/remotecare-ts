import type { Condition, Diagnosis, HbA1cEntry, MedicationRecord, Patient, Visit } from '../../types';
import type { CanonicalCondition, TZRegion } from './types';

const CONDITION_ALIASES: Array<{ canonical: CanonicalCondition; match: RegExp }> = [
  { canonical: 'DM', match: /\b(dm|dm1|dm2|type\s*1\s*diabetes|type\s*2\s*diabetes|diabetes|e10|e11)\b/i },
  { canonical: 'HTN', match: /\b(htn|hypertension|i10)\b/i },
  { canonical: 'CKD', match: /\b(ckd|chronic kidney disease|kidney disease|n18)\b/i },
  { canonical: 'HF', match: /\b(hf|heart failure|i50)\b/i },
  { canonical: 'PUD', match: /\b(pud|peptic ulcer|k27)\b/i },
  { canonical: 'HIV', match: /\b(hiv|on art|art|b20|b21|b22|b23|b24)\b/i },
  { canonical: 'TB', match: /\b(tb|tuberculosis|a15|a16|a17|a18|a19)\b/i },
  { canonical: 'Anemia', match: /\b(anemia|anaemia|d50|d51|d52|d53)\b/i },
  { canonical: 'Obesity', match: /\b(obesity|obese|e66)\b/i },
  { canonical: 'Dyslipid', match: /\b(dyslipid|dyslipidaemia|dyslipidemia|e78)\b/i },
];

const DM_DIAGNOSIS_PATTERN = /\b(E10|E11|E13|DM|DIABETES)\b/i;
const HTN_DIAGNOSIS_PATTERN = /\b(I10|I11|I12|I13|I15|HTN|HYPERTENSION)\b/i;

const DM_MED_KEYWORDS = [
  'metformin', 'glibenclamide', 'gliclazide', 'glimepiride', 'glipizide',
  'insulin', 'mixtard', 'lantus', 'novomix', 'humulin', 'novorapid',
  'dapagliflozin', 'empagliflozin', 'canagliflozin',
  'sitagliptin', 'linagliptin', 'saxagliptin',
  'semaglutide', 'liraglutide', 'acarbose', 'pioglitazone',
];

const HTN_MED_KEYWORDS = [
  'amlodipine', 'nifedipine', 'felodipine', 'diltiazem', 'verapamil',
  'losartan', 'valsartan', 'irbesartan', 'telmisartan',
  'enalapril', 'lisinopril', 'captopril', 'ramipril', 'perindopril',
  'hydrochlorothiazide', 'chlorthalidone', 'indapamide', 'spironolactone', 'furosemide',
  'atenolol', 'bisoprolol', 'metoprolol', 'carvedilol', 'propranolol', 'labetalol',
  'methyldopa', 'hydralazine', 'prazosin', 'doxazosin', 'clonidine',
];

export function canonicalizeCondition(raw: string): CanonicalCondition | string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const match = CONDITION_ALIASES.find((entry) => entry.match.test(trimmed));
  return match?.canonical ?? trimmed;
}

export function normalizeConditionList(conditions: unknown): string[] {
  const values = Array.isArray(conditions) ? conditions : [];
  const normalized = new Set<string>();
  values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .forEach((value) => {
      normalized.add(value);
      const canonical = canonicalizeCondition(value);
      if (canonical) normalized.add(canonical);
    });
  return [...normalized];
}

export function conditionMatches(target: string, userConditions: string[]): boolean {
  if (!target) return false;
  if (target === 'ALL') return true;
  const canonical = canonicalizeCondition(target);
  const expanded = normalizeConditionList(userConditions);
  return expanded.includes(target) || (!!canonical && expanded.includes(canonical));
}

export function getPatientConditions(
  cond: string,
  visitDiagnoses: string[] = [],
): string[] {
  const base = cond.split('+').map((segment) => segment.trim()).filter(Boolean);
  return normalizeConditionList([...base, ...visitDiagnoses]);
}

function collectMedicationNames(
  visits: Visit[] = [],
  medicationRecords: MedicationRecord[] = [],
): string[] {
  const visitMeds = visits.flatMap((visit) => visit.meds ?? []);
  const savedMeds = medicationRecords.flatMap((record) => record.meds ?? []);
  return [...visitMeds, ...savedMeds]
    .map((med) => (med.name ?? '').toLowerCase())
    .filter(Boolean);
}

function hasMedicationEvidence(meds: string[], keywords: string[]) {
  return meds.some((med) => keywords.some((keyword) => med.includes(keyword)));
}

function diagnosisDescriptions(diagnoses: Diagnosis[] = []) {
  return diagnoses.flatMap((diagnosis) => [diagnosis.code, diagnosis.description]).filter(Boolean);
}

function hasDiagnosisEvidence(visits: Visit[] = [], pattern: RegExp) {
  return visits.some((visit) => diagnosisDescriptions(visit.diagnoses ?? []).some((value) => pattern.test(String(value))));
}

function hasDmLabEvidence(visits: Visit[] = [], hba1c: HbA1cEntry[] = []) {
  const visitEvidence = visits.some((visit) => {
    if (!visit.att || visit.sugar == null || !visit.sugarType) return false;
    if (visit.sugarType === 'FBS') return visit.sugar >= 7;
    return visit.sugar >= 11.1;
  });
  const hba1cEvidence = hba1c.some((entry) => entry.value >= 6.5);
  return visitEvidence || hba1cEvidence;
}

export function resolvePatientCondition(
  patient: Pick<Patient, 'cond' | 'visits' | 'medications' | 'hba1c'>,
): Condition {
  const visits = patient.visits ?? [];
  const condTokens = new Set(
    String(patient.cond ?? '')
      .split('+')
      .map((token) => token.trim())
      .filter(Boolean),
  );
  const meds = collectMedicationNames(visits, patient.medications ?? []);

  const hasDm =
    condTokens.has('DM') ||
    String(patient.cond ?? '').includes('DM+HTN') ||
    hasDiagnosisEvidence(visits, DM_DIAGNOSIS_PATTERN) ||
    hasMedicationEvidence(meds, DM_MED_KEYWORDS) ||
    hasDmLabEvidence(visits, patient.hba1c ?? []);

  const hasHtn =
    condTokens.has('HTN') ||
    String(patient.cond ?? '').includes('DM+HTN') ||
    hasDiagnosisEvidence(visits, HTN_DIAGNOSIS_PATTERN) ||
    hasMedicationEvidence(meds, HTN_MED_KEYWORDS) ||
    visits.some((visit) => visit.att && visit.sbp != null && visit.dbp != null);

  if (hasDm && hasHtn) return 'DM+HTN';
  if (hasDm) return 'DM';
  return 'HTN';
}

export interface ConditionAuditRow {
  patientId: number;
  code: string;
  stored: Condition;
  resolved: Condition;
  reasons: string[];
}

export function auditPatientConditions(patients: Patient[]): ConditionAuditRow[] {
  return patients.flatMap((patient) => {
    const visits = patient.visits ?? [];
    const meds = collectMedicationNames(visits, patient.medications ?? []);
    const reasons: string[] = [];

    if (hasDiagnosisEvidence(visits, DM_DIAGNOSIS_PATTERN)) reasons.push('DM diagnosis');
    if (hasDiagnosisEvidence(visits, HTN_DIAGNOSIS_PATTERN)) reasons.push('HTN diagnosis');
    if (hasMedicationEvidence(meds, DM_MED_KEYWORDS)) reasons.push('DM medication');
    if (hasMedicationEvidence(meds, HTN_MED_KEYWORDS)) reasons.push('HTN medication');
    if (hasDmLabEvidence(visits, patient.hba1c ?? [])) reasons.push('DM lab evidence');

    const resolved = resolvePatientCondition(patient);
    if (resolved === patient.cond) return [];

    return [{
      patientId: patient.id,
      code: patient.code,
      stored: patient.cond,
      resolved,
      reasons,
    }];
  });
}

export function regionToZone(region: string): TZRegion {
  const map: Record<string, TZRegion> = {
    Arusha: 'Northern Highlands',
    Kilimanjaro: 'Northern Highlands',
    Moshi: 'Northern Highlands',
    'Dar es Salaam': 'Coast',
    Tanga: 'Coast',
    Pwani: 'Coast',
    Mtwara: 'Coast',
    Lindi: 'Coast',
    Mwanza: 'Lake Zone',
    Mara: 'Lake Zone',
    Kagera: 'Lake Zone',
    Geita: 'Lake Zone',
    Simiyu: 'Lake Zone',
    'Mwanza City': 'Lake Zone',
    Iringa: 'Southern Highlands',
    Mbeya: 'Southern Highlands',
    Morogoro: 'Southern Highlands',
    Njombe: 'Southern Highlands',
    Songwe: 'Southern Highlands',
    Ruvuma: 'Southern Highlands',
    Dodoma: 'Central',
    Singida: 'Central',
    Tabora: 'Western',
    Kigoma: 'Western',
    Katavi: 'Western',
    Rukwa: 'Western',
    'Zanzibar West': 'Zanzibar',
    'Zanzibar North': 'Zanzibar',
    'Zanzibar South': 'Zanzibar',
  };
  return map[region] ?? 'All';
}
