// RCRO NutritionTool — drug name → MED_ ID mapper

const DRUG_MAP: [RegExp, string][] = [
  [/warfarin/i,                                              'MED_WARFARIN'],
  [/amlodipine|nifedipine|felodipine|diltiazem|verapamil/i, 'MED_CCB'],
  [/metronidazole|flagyl/i,                                  'MED_METRONIDAZOLE'],
  [/rifampicin|rifampin/i,                                   'MED_RIFAMPICIN'],
  [/isoniazid|inh/i,                                         'MED_ISONIAZID'],
  [/ciprofloxacin|levofloxacin|ofloxacin|norfloxacin/i,     'MED_QUINOLONE'],
  [/ibuprofen|diclofenac|naproxen|indomethacin|piroxicam/i, 'MED_NSAID'],
  [/aspirin/i,                                               'MED_ASPIRIN'],
  [/metformin/i,                                             'MED_METFORMIN'],
  [/spironolactone|eplerenone/i,                             'MED_KSPARING'],
];

export function toMedIds(medNames: string[]): string[] {
  const ids = new Set<string>();
  for (const name of medNames) {
    for (const [re, id] of DRUG_MAP) {
      if (re.test(name)) ids.add(id);
    }
  }
  return [...ids];
}
