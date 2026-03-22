// ICD-10 Diagnosis Codes for NCD Management
export interface ICD10Code {
  code: string;
  description: string;
  category: string;
}

export const ICD10_CODES: ICD10Code[] = [
  // Hypertension related codes
  { code: 'I10', description: 'Essential (primary) hypertension', category: 'Hypertension' },
  { code: 'I11', description: 'Hypertensive heart disease', category: 'Hypertension' },
  { code: 'I11.0', description: 'Hypertensive heart disease with heart failure', category: 'Hypertension' },
  { code: 'I11.9', description: 'Hypertensive heart disease without heart failure', category: 'Hypertension' },
  { code: 'I12', description: 'Hypertensive renal disease', category: 'Hypertension' },
  { code: 'I12.0', description: 'Hypertensive renal disease with renal failure', category: 'Hypertension' },
  { code: 'I12.9', description: 'Hypertensive renal disease without renal failure', category: 'Hypertension' },
  { code: 'I13', description: 'Hypertensive heart and renal disease', category: 'Hypertension' },
  { code: 'I13.0', description: 'Hypertensive heart and renal disease with heart failure', category: 'Hypertension' },
  { code: 'I13.1', description: 'Hypertensive heart and renal disease with renal failure', category: 'Hypertension' },
  { code: 'I13.2', description: 'Hypertensive heart and renal disease with both heart and renal failure', category: 'Hypertension' },
  { code: 'I15', description: 'Secondary hypertension', category: 'Hypertension' },
  { code: 'I15.0', description: 'Renovascular hypertension', category: 'Hypertension' },
  { code: 'I15.1', description: 'Hypertension secondary to other renal disorders', category: 'Hypertension' },
  { code: 'I15.2', description: 'Hypertension secondary to endocrine disorders', category: 'Hypertension' },
  { code: 'I15.8', description: 'Other secondary hypertension', category: 'Hypertension' },
  { code: 'I15.9', description: 'Secondary hypertension, unspecified', category: 'Hypertension' },

  // Diabetes related codes
  { code: 'E10', description: 'Type 1 diabetes mellitus', category: 'Diabetes' },
  { code: 'E10.0', description: 'Type 1 diabetes mellitus with coma', category: 'Diabetes' },
  { code: 'E10.1', description: 'Type 1 diabetes mellitus with ketoacidosis', category: 'Diabetes' },
  { code: 'E10.2', description: 'Type 1 diabetes mellitus with renal complications', category: 'Diabetes' },
  { code: 'E10.3', description: 'Type 1 diabetes mellitus with ophthalmic complications', category: 'Diabetes' },
  { code: 'E10.4', description: 'Type 1 diabetes mellitus with neurological complications', category: 'Diabetes' },
  { code: 'E10.5', description: 'Type 1 diabetes mellitus with peripheral circulatory complications', category: 'Diabetes' },
  { code: 'E10.6', description: 'Type 1 diabetes mellitus with other specified complications', category: 'Diabetes' },
  { code: 'E10.7', description: 'Type 1 diabetes mellitus with multiple complications', category: 'Diabetes' },
  { code: 'E10.8', description: 'Type 1 diabetes mellitus with unspecified complications', category: 'Diabetes' },
  { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications', category: 'Diabetes' },
  { code: 'E11', description: 'Type 2 diabetes mellitus', category: 'Diabetes' },
  { code: 'E11.0', description: 'Type 2 diabetes mellitus with coma', category: 'Diabetes' },
  { code: 'E11.1', description: 'Type 2 diabetes mellitus with ketoacidosis', category: 'Diabetes' },
  { code: 'E11.2', description: 'Type 2 diabetes mellitus with renal complications', category: 'Diabetes' },
  { code: 'E11.3', description: 'Type 2 diabetes mellitus with ophthalmic complications', category: 'Diabetes' },
  { code: 'E11.4', description: 'Type 2 diabetes mellitus with neurological complications', category: 'Diabetes' },
  { code: 'E11.5', description: 'Type 2 diabetes mellitus with peripheral circulatory complications', category: 'Diabetes' },
  { code: 'E11.6', description: 'Type 2 diabetes mellitus with other specified complications', category: 'Diabetes' },
  { code: 'E11.7', description: 'Type 2 diabetes mellitus with multiple complications', category: 'Diabetes' },
  { code: 'E11.8', description: 'Type 2 diabetes mellitus with unspecified complications', category: 'Diabetes' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Diabetes' },
  { code: 'E13', description: 'Other specified diabetes mellitus', category: 'Diabetes' },
  { code: 'E13.0', description: 'Other specified diabetes mellitus with coma', category: 'Diabetes' },
  { code: 'E13.1', description: 'Other specified diabetes mellitus with ketoacidosis', category: 'Diabetes' },
  { code: 'E13.2', description: 'Other specified diabetes mellitus with renal complications', category: 'Diabetes' },
  { code: 'E13.3', description: 'Other specified diabetes mellitus with ophthalmic complications', category: 'Diabetes' },
  { code: 'E13.4', description: 'Other specified diabetes mellitus with neurological complications', category: 'Diabetes' },
  { code: 'E13.5', description: 'Other specified diabetes mellitus with peripheral circulatory complications', category: 'Diabetes' },
  { code: 'E13.6', description: 'Other specified diabetes mellitus with other specified complications', category: 'Diabetes' },
  { code: 'E13.7', description: 'Other specified diabetes mellitus with multiple complications', category: 'Diabetes' },
  { code: 'E13.8', description: 'Other specified diabetes mellitus with unspecified complications', category: 'Diabetes' },
  { code: 'E13.9', description: 'Other specified diabetes mellitus without complications', category: 'Diabetes' },
  { code: 'E14', description: 'Unspecified diabetes mellitus', category: 'Diabetes' },
  { code: 'E14.0', description: 'Unspecified diabetes mellitus with coma', category: 'Diabetes' },
  { code: 'E14.1', description: 'Unspecified diabetes mellitus with ketoacidosis', category: 'Diabetes' },
  { code: 'E14.2', description: 'Unspecified diabetes mellitus with renal complications', category: 'Diabetes' },
  { code: 'E14.3', description: 'Unspecified diabetes mellitus with ophthalmic complications', category: 'Diabetes' },
  { code: 'E14.4', description: 'Unspecified diabetes mellitus with neurological complications', category: 'Diabetes' },
  { code: 'E14.5', description: 'Unspecified diabetes mellitus with peripheral circulatory complications', category: 'Diabetes' },
  { code: 'E14.6', description: 'Unspecified diabetes mellitus with other specified complications', category: 'Diabetes' },
  { code: 'E14.7', description: 'Unspecified diabetes mellitus with multiple complications', category: 'Diabetes' },
  { code: 'E14.8', description: 'Unspecified diabetes mellitus with unspecified complications', category: 'Diabetes' },
  { code: 'E14.9', description: 'Unspecified diabetes mellitus without complications', category: 'Diabetes' },

  // Cardiovascular complications
  { code: 'I20', description: 'Angina pectoris', category: 'Cardiovascular' },
  { code: 'I20.0', description: 'Unstable angina', category: 'Cardiovascular' },
  { code: 'I20.1', description: 'Angina with spasm', category: 'Cardiovascular' },
  { code: 'I20.8', description: 'Other forms of angina pectoris', category: 'Cardiovascular' },
  { code: 'I20.9', description: 'Angina pectoris, unspecified', category: 'Cardiovascular' },
  { code: 'I21', description: 'Acute myocardial infarction', category: 'Cardiovascular' },
  { code: 'I21.0', description: 'Acute transmural myocardial infarction of anterior wall', category: 'Cardiovascular' },
  { code: 'I21.1', description: 'Acute transmural myocardial infarction of inferior wall', category: 'Cardiovascular' },
  { code: 'I21.2', description: 'Acute transmural myocardial infarction of other locations', category: 'Cardiovascular' },
  { code: 'I21.3', description: 'Acute transmural myocardial infarction of unspecified site', category: 'Cardiovascular' },
  { code: 'I21.4', description: 'Acute subendocardial myocardial infarction', category: 'Cardiovascular' },
  { code: 'I21.9', description: 'Acute myocardial infarction, unspecified', category: 'Cardiovascular' },
  { code: 'I25', description: 'Chronic ischemic heart disease', category: 'Cardiovascular' },
  { code: 'I25.1', description: 'Atherosclerotic heart disease', category: 'Cardiovascular' },
  { code: 'I25.2', description: 'Old myocardial infarction', category: 'Cardiovascular' },
  { code: 'I25.5', description: 'Ischemic cardiomyopathy', category: 'Cardiovascular' },
  { code: 'I25.6', description: 'Silent myocardial ischemia', category: 'Cardiovascular' },
  { code: 'I25.8', description: 'Other forms of chronic ischemic heart disease', category: 'Cardiovascular' },
  { code: 'I25.9', description: 'Chronic ischemic heart disease, unspecified', category: 'Cardiovascular' },
  { code: 'I50', description: 'Heart failure', category: 'Cardiovascular' },
  { code: 'I50.0', description: 'Congestive heart failure', category: 'Cardiovascular' },
  { code: 'I50.1', description: 'Left ventricular failure', category: 'Cardiovascular' },
  { code: 'I50.9', description: 'Heart failure, unspecified', category: 'Cardiovascular' },
  { code: 'I63', description: 'Cerebral infarction', category: 'Cardiovascular' },
  { code: 'I63.0', description: 'Cerebral infarction due to thrombosis of precerebral arteries', category: 'Cardiovascular' },
  { code: 'I63.1', description: 'Cerebral infarction due to embolism of precerebral arteries', category: 'Cardiovascular' },
  { code: 'I63.2', description: 'Cerebral infarction due to unspecified occlusion or stenosis of precerebral arteries', category: 'Cardiovascular' },
  { code: 'I63.3', description: 'Cerebral infarction due to thrombosis of cerebral arteries', category: 'Cardiovascular' },
  { code: 'I63.4', description: 'Cerebral infarction due to embolism of cerebral arteries', category: 'Cardiovascular' },
  { code: 'I63.5', description: 'Cerebral infarction due to unspecified occlusion or stenosis of cerebral arteries', category: 'Cardiovascular' },
  { code: 'I63.6', description: 'Cerebral infarction due to cerebral venous thrombosis', category: 'Cardiovascular' },
  { code: 'I63.8', description: 'Other cerebral infarction', category: 'Cardiovascular' },
  { code: 'I63.9', description: 'Cerebral infarction, unspecified', category: 'Cardiovascular' },
  { code: 'I64', description: 'Stroke, not specified as haemorrhage or infarction', category: 'Cardiovascular' },
  { code: 'I64.0', description: 'Cerebral artery thrombosis causing nontraumatic intracerebral haemorrhage', category: 'Cardiovascular' },
  { code: 'I64.1', description: 'Cerebral embolism causing nontraumatic intracerebral haemorrhage', category: 'Cardiovascular' },
  { code: 'I64.2', description: 'Cerebral atherosclerosis causing nontraumatic intracerebral haemorrhage', category: 'Cardiovascular' },
  { code: 'I64.3', description: 'Cerebral amyloid angiopathy causing nontraumatic intracerebral haemorrhage', category: 'Cardiovascular' },
  { code: 'I64.4', description: 'Nontraumatic intracerebral haemorrhage, unspecified', category: 'Cardiovascular' },
  { code: 'I64.5', description: 'Nontraumatic subarachnoid haemorrhage', category: 'Cardiovascular' },
  { code: 'I64.6', description: 'Nontraumatic epidural haemorrhage', category: 'Cardiovascular' },
  { code: 'I64.8', description: 'Other nontraumatic intracranial haemorrhage', category: 'Cardiovascular' },
  { code: 'I64.9', description: 'Nontraumatic intracranial haemorrhage, unspecified', category: 'Cardiovascular' },

  // Renal complications
  { code: 'N18', description: 'Chronic kidney disease', category: 'Renal' },
  { code: 'N18.1', description: 'Chronic kidney disease, stage 1', category: 'Renal' },
  { code: 'N18.2', description: 'Chronic kidney disease, stage 2', category: 'Renal' },
  { code: 'N18.3', description: 'Chronic kidney disease, stage 3', category: 'Renal' },
  { code: 'N18.4', description: 'Chronic kidney disease, stage 4', category: 'Renal' },
  { code: 'N18.5', description: 'Chronic kidney disease, stage 5', category: 'Renal' },
  { code: 'N18.6', description: 'End-stage renal disease', category: 'Renal' },
  { code: 'N18.9', description: 'Chronic kidney disease, unspecified', category: 'Renal' },
  { code: 'N17', description: 'Acute kidney failure', category: 'Renal' },
  { code: 'N17.0', description: 'Acute kidney failure with tubular necrosis', category: 'Renal' },
  { code: 'N17.1', description: 'Acute kidney failure with acute cortical necrosis', category: 'Renal' },
  { code: 'N17.2', description: 'Acute kidney failure with medullary necrosis', category: 'Renal' },
  { code: 'N17.8', description: 'Other acute kidney failure', category: 'Renal' },
  { code: 'N17.9', description: 'Acute kidney failure, unspecified', category: 'Renal' },

  // Eye complications
  { code: 'H36', description: 'Retinal vascular disorders', category: 'Ophthalmic' },
  { code: 'H36.0', description: 'Diabetic retinopathy', category: 'Ophthalmic' },
  { code: 'H36.1', description: 'Retinal artery occlusion', category: 'Ophthalmic' },
  { code: 'H36.2', description: 'Retinal vein occlusion', category: 'Ophthalmic' },
  { code: 'H36.3', description: 'Retinal vascular changes', category: 'Ophthalmic' },
  { code: 'H36.8', description: 'Other specified retinal vascular disorders', category: 'Ophthalmic' },
  { code: 'H36.9', description: 'Retinal vascular disorder, unspecified', category: 'Ophthalmic' },
  { code: 'H40', description: 'Glaucoma', category: 'Ophthalmic' },
  { code: 'H40.0', description: 'Suspected glaucoma', category: 'Ophthalmic' },
  { code: 'H40.1', description: 'Primary open-angle glaucoma', category: 'Ophthalmic' },
  { code: 'H40.2', description: 'Primary angle-closure glaucoma', category: 'Ophthalmic' },
  { code: 'H40.3', description: 'Pigmentary glaucoma', category: 'Ophthalmic' },
  { code: 'H40.4', description: 'Glaucoma secondary to eye inflammation', category: 'Ophthalmic' },
  { code: 'H40.5', description: 'Glaucoma secondary to other eye disorders', category: 'Ophthalmic' },
  { code: 'H40.6', description: 'Glaucoma secondary to drugs', category: 'Ophthalmic' },
  { code: 'H40.8', description: 'Other glaucoma', category: 'Ophthalmic' },
  { code: 'H40.9', description: 'Glaucoma, unspecified', category: 'Ophthalmic' },
  { code: 'H54', description: 'Blindness and low vision', category: 'Ophthalmic' },
  { code: 'H54.0', description: 'Blindness, both eyes', category: 'Ophthalmic' },
  { code: 'H54.1', description: 'Blindness, one eye, low vision other eye', category: 'Ophthalmic' },
  { code: 'H54.2', description: 'Low vision, both eyes', category: 'Ophthalmic' },
  { code: 'H54.3', description: 'Unqualified visual loss, both eyes', category: 'Ophthalmic' },
  { code: 'H54.4', description: 'Legal blindness, as defined in US', category: 'Ophthalmic' },
  { code: 'H54.5', description: 'Legal blindness, as defined in US, one eye', category: 'Ophthalmic' },
  { code: 'H54.6', description: 'Total blindness, including NLP', category: 'Ophthalmic' },
  { code: 'H54.7', description: 'Total blindness, NLP, one eye', category: 'Ophthalmic' },
  { code: 'H54.9', description: 'Unspecified visual loss', category: 'Ophthalmic' },

  // Neurological complications
  { code: 'G60', description: 'Hereditary and idiopathic peripheral neuropathy', category: 'Neurological' },
  { code: 'G60.0', description: 'Hereditary motor and sensory neuropathy', category: 'Neurological' },
  { code: 'G60.1', description: 'Reflex sympathetic dystrophy', category: 'Neurological' },
  { code: 'G60.2', description: 'Hereditary sensory and autonomic neuropathy', category: 'Neurological' },
  { code: 'G60.3', description: 'Idiopathic progressive neuropathy', category: 'Neurological' },
  { code: 'G60.8', description: 'Other hereditary and idiopathic peripheral neuropathy', category: 'Neurological' },
  { code: 'G60.9', description: 'Hereditary and idiopathic peripheral neuropathy, unspecified', category: 'Neurological' },
  { code: 'G63', description: 'Polyneuropathy in diseases classified elsewhere', category: 'Neurological' },
  { code: 'G63.2', description: 'Diabetic polyneuropathy', category: 'Neurological' },
  { code: 'G63.8', description: 'Polyneuropathy in other diseases classified elsewhere', category: 'Neurological' },
  { code: 'G63.9', description: 'Polyneuropathy, unspecified', category: 'Neurological' },
];

export function searchICD10(query: string): ICD10Code[] {
  if (!query.trim()) return [];
  
  const searchTerm = query.toLowerCase();
  return ICD10_CODES.filter(code => 
    code.code.toLowerCase().includes(searchTerm) ||
    code.description.toLowerCase().includes(searchTerm) ||
    code.category.toLowerCase().includes(searchTerm)
  ).slice(0, 20); // Limit results to 20
}

export interface Diagnosis {
  id: string;
  code: string;
  description: string;
  isPrimary: boolean;
}
