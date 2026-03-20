import type { TanzaniaGeo } from '@/types';

// ════════════════════════════════════════════════════
// TANZANIA REGIONS & DISTRICTS
// ════════════════════════════════════════════════════

export const TZ_GEO: TanzaniaGeo = {
  Arusha:       ['Arusha City','Arusha','Karatu','Longido','Meru','Monduli','Ngorongoro'],
  'Dar es Salaam':['Ilala','Kinondoni','Kigamboni','Temeke','Ubungo'],
  Dodoma:       ['Bahi','Chamwino','Chemba','Dodoma City','Kondoa','Kongwa','Mpwapwa'],
  Geita:        ['Bukombe','Chato','Geita','Mbogwe',"Nyang'hwale"],
  Iringa:       ['Iringa','Iringa Urban','Kilolo','Mafinga Town','Mufindi'],
  Kagera:       ['Biharamulo','Bukoba','Bukoba Municipal','Karagwe','Kyerwa','Misenyi','Muleba','Ngara'],
  Kilimanjaro:  ['Hai','Moshi','Moshi Municipal','Mwanga','Rombo','Same','Siha'],
  Mara:         ['Bunda','Butiama','Musoma','Musoma Municipal','Rorya','Serengeti','Tarime'],
  Mbeya:        ['Busokelo','Chunya','Kyela','Mbarali','Mbeya City','Mbeya','Rungwe'],
  Morogoro:     ['Gairo','Kilosa','Kilombero','Morogoro','Morogoro Municipal','Mvomero','Ulanga'],
  Mtwara:       ['Masasi','Mtwara','Mtwara Municipal','Newala','Tandahimba'],
  Mwanza:       ['Ilemela','Kwimba','Magu','Misungwi','Nyamagana','Sengerema','Ukerewe'],
  Pwani:        ['Bagamoyo','Kibaha','Kisarawe','Mafia','Mkuranga','Rufiji'],
  Singida:      ['Ikungi','Iramba','Manyoni','Mkalama','Singida','Singida Municipal'],
  Tabora:       ['Igunga','Kaliua','Nzega','Sikonge','Tabora','Tabora Municipal','Urambo'],
  Tanga:        ['Handeni','Kilindi','Korogwe','Lushoto','Mkinga','Muheza','Pangani','Tanga City'],
  'Zanzibar West':['Magharibi','Mjini'],
};

export const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const MONTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MONTHS_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export const HTN_MEDS = [
  'Amlodipine 5mg','Amlodipine 10mg','Nifedipine SR 20mg','Atenolol 50mg','Atenolol 100mg',
  'Hydrochlorothiazide 25mg','Enalapril 5mg','Enalapril 10mg','Losartan 50mg','Losartan 100mg',
  'Lisinopril 5mg','Lisinopril 10mg','Methyldopa 250mg','Methyldopa 500mg',
  'Hydralazine 25mg','Hydralazine 50mg',
];

export const DM_MEDS = [
  'Metformin 500mg','Metformin 850mg','Metformin 1000mg','Glibenclamide 2.5mg','Glibenclamide 5mg',
  'Glipizide 5mg','Glimepiride 2mg','Glimepiride 4mg','Insulin Regular','Insulin NPH',
  'Insulin Glargine','Insulin Mixtard 30/70','Acarbose 50mg','Sitagliptin 50mg','Empagliflozin 10mg',
];

export const ALL_MEDS = [...HTN_MEDS, ...DM_MEDS];
