// RCRO NutritionTool — condition normalization

import type { CanonicalCondition, TZRegion } from './types';

const CONDITION_ALIASES: Array<{ canonical: CanonicalCondition; match: RegExp }> = [
  { canonical: 'DM',        match: /\b(dm|dm1|dm2|type\s*1\s*diabetes|type\s*2\s*diabetes|diabetes|e10|e11)\b/i },
  { canonical: 'HTN',       match: /\b(htn|hypertension|i10)\b/i },
  { canonical: 'CKD',       match: /\b(ckd|chronic kidney disease|kidney disease|n18)\b/i },
  { canonical: 'HF',        match: /\b(hf|heart failure|i50)\b/i },
  { canonical: 'PUD',       match: /\b(pud|peptic ulcer|k27)\b/i },
  { canonical: 'HIV',       match: /\b(hiv|on art|art|b20|b21|b22|b23|b24)\b/i },
  { canonical: 'TB',        match: /\b(tb|tuberculosis|a15|a16|a17|a18|a19)\b/i },
  { canonical: 'Anemia',    match: /\b(anemia|anaemia|d50|d51|d52|d53)\b/i },
  { canonical: 'Obesity',   match: /\b(obesity|obese|e66)\b/i },
  { canonical: 'Dyslipid',  match: /\b(dyslipid|dyslipidaemia|dyslipidemia|e78)\b/i },
];

export function canonicalizeCondition(raw: string): CanonicalCondition | string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const match = CONDITION_ALIASES.find(e => e.match.test(trimmed));
  return match?.canonical ?? trimmed;
}

export function normalizeConditionList(conditions: unknown): string[] {
  const values = Array.isArray(conditions) ? conditions : [];
  const normalized = new Set<string>();
  values
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .forEach(v => {
      normalized.add(v);
      const canonical = canonicalizeCondition(v);
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
  visitDiagnoses: string[] = []
): string[] {
  const base = cond.split('+').map(s => s.trim()).filter(Boolean);
  return normalizeConditionList([...base, ...visitDiagnoses]);
}

export function regionToZone(region: string): TZRegion {
  const map: Record<string, TZRegion> = {
    'Arusha':          'Northern Highlands',
    'Kilimanjaro':     'Northern Highlands',
    'Moshi':           'Northern Highlands',
    'Dar es Salaam':   'Coast',
    'Tanga':           'Coast',
    'Pwani':           'Coast',
    'Mtwara':          'Coast',
    'Lindi':           'Coast',
    'Mwanza':          'Lake Zone',
    'Mara':            'Lake Zone',
    'Kagera':          'Lake Zone',
    'Geita':           'Lake Zone',
    'Simiyu':          'Lake Zone',
    'Mwanza City':     'Lake Zone',
    'Iringa':          'Southern Highlands',
    'Mbeya':           'Southern Highlands',
    'Morogoro':        'Southern Highlands',
    'Njombe':          'Southern Highlands',
    'Songwe':          'Southern Highlands',
    'Ruvuma':          'Southern Highlands',
    'Dodoma':          'Central',
    'Singida':         'Central',
    'Tabora':          'Western',
    'Kigoma':          'Western',
    'Katavi':          'Western',
    'Rukwa':           'Western',
    'Zanzibar West':   'Zanzibar',
    'Zanzibar North':  'Zanzibar',
    'Zanzibar South':  'Zanzibar',
  };
  return map[region] ?? 'All';
}
