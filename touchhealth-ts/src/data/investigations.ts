// Laboratory Investigations and Reference Values
export interface Investigation {
  id: string;
  name: string;
  category: string;
  unit: string;
  referenceLow: number;
  referenceHigh: number;
  referenceText?: string;
}

export interface InvestigationResult {
  id: string;
  name: string;
  value: string;
  unit: string;
  reference: string;
  interpretation?: {
    level: 'normal' | 'low' | 'high' | 'critical';
    text: string;
    color?: string;
  };
}

export const INVESTIGATION_TEMPLATES: Investigation[] = [
  // Hematology
  { id: 'hgb', name: 'Hemoglobin', category: 'Hematology', unit: 'g/dL', referenceLow: 12.0, referenceHigh: 16.0 },
  { id: 'hct', name: 'Hematocrit', category: 'Hematology', unit: '%', referenceLow: 37.0, referenceHigh: 47.0 },
  { id: 'rbc', name: 'Red Blood Cells', category: 'Hematology', unit: 'x10^12/L', referenceLow: 4.2, referenceHigh: 5.4 },
  { id: 'wbc', name: 'White Blood Cells', category: 'Hematology', unit: 'x10^9/L', referenceLow: 4.0, referenceHigh: 11.0 },
  { id: 'plt', name: 'Platelets', category: 'Hematology', unit: 'x10^9/L', referenceLow: 150, referenceHigh: 450 },
  { id: 'mcv', name: 'Mean Corpuscular Volume', category: 'Hematology', unit: 'fL', referenceLow: 80, referenceHigh: 100 },
  { id: 'mch', name: 'Mean Corpuscular Hemoglobin', category: 'Hematology', unit: 'pg', referenceLow: 27, referenceHigh: 33 },
  { id: 'mchc', name: 'MCH Concentration', category: 'Hematology', unit: 'g/dL', referenceLow: 32, referenceHigh: 36 },

  // Renal Function
  { id: 'creatinine', name: 'Creatinine', category: 'Renal', unit: 'μmol/L', referenceLow: 44, referenceHigh: 80 },
  { id: 'urea', name: 'Urea', category: 'Renal', unit: 'mmol/L', referenceLow: 2.5, referenceHigh: 7.1 },
  { id: 'egfr', name: 'eGFR', category: 'Renal', unit: 'mL/min/1.73m²', referenceLow: 90, referenceHigh: 999, referenceText: '≥90 normal' },
  { id: 'uric_acid', name: 'Uric Acid', category: 'Renal', unit: 'μmol/L', referenceLow: 150, referenceHigh: 420 },
  { id: 'protein_urine', name: 'Protein (Urine)', category: 'Renal', unit: 'g/L', referenceLow: 0, referenceHigh: 0.15, referenceText: '<0.15 normal' },
  { id: 'albumin_urine', name: 'Albumin (Urine)', category: 'Renal', unit: 'mg/L', referenceLow: 0, referenceHigh: 20, referenceText: '<20 normal' },
  { id: 'acr', name: 'Albumin/Creatinine Ratio', category: 'Renal', unit: 'mg/g', referenceLow: 0, referenceHigh: 30, referenceText: '<30 normal' },

  // Liver Function
  { id: 'ast', name: 'AST (SGOT)', category: 'Liver', unit: 'U/L', referenceLow: 0, referenceHigh: 40 },
  { id: 'alt', name: 'ALT (SGPT)', category: 'Liver', unit: 'U/L', referenceLow: 0, referenceHigh: 40 },
  { id: 'alp', name: 'Alkaline Phosphatase', category: 'Liver', unit: 'U/L', referenceLow: 40, referenceHigh: 129 },
  { id: 'ggt', name: 'Gamma GT', category: 'Liver', unit: 'U/L', referenceLow: 0, referenceHigh: 50 },
  { id: 'bilirubin_total', name: 'Total Bilirubin', category: 'Liver', unit: 'μmol/L', referenceLow: 0, referenceHigh: 21 },
  { id: 'bilirubin_direct', name: 'Direct Bilirubin', category: 'Liver', unit: 'μmol/L', referenceLow: 0, referenceHigh: 7 },
  { id: 'albumin', name: 'Albumin', category: 'Liver', unit: 'g/L', referenceLow: 35, referenceHigh: 50 },
  { id: 'total_protein', name: 'Total Protein', category: 'Liver', unit: 'g/L', referenceLow: 64, referenceHigh: 83 },

  // Lipids
  { id: 'cholesterol', name: 'Total Cholesterol', category: 'Lipids', unit: 'mmol/L', referenceLow: 0, referenceHigh: 5.2 },
  { id: 'ldl', name: 'LDL Cholesterol', category: 'Lipids', unit: 'mmol/L', referenceLow: 0, referenceHigh: 3.4 },
  { id: 'hdl', name: 'HDL Cholesterol', category: 'Lipids', unit: 'mmol/L', referenceLow: 1.0, referenceHigh: 999, referenceText: '>1.0 desirable' },
  { id: 'triglycerides', name: 'Triglycerides', category: 'Lipids', unit: 'mmol/L', referenceLow: 0, referenceHigh: 1.7 },

  // Glucose Metabolism
  { id: 'glucose_fasting', name: 'Glucose (Fasting)', category: 'Glucose', unit: 'mmol/L', referenceLow: 3.9, referenceHigh: 6.1 },
  { id: 'glucose_random', name: 'Glucose (Random)', category: 'Glucose', unit: 'mmol/L', referenceLow: 3.9, referenceHigh: 11.1 },
  { id: 'hba1c', name: 'HbA1c', category: 'Glucose', unit: '%', referenceLow: 0, referenceHigh: 6.5 },
  { id: 'c_peptide', name: 'C-Peptide', category: 'Glucose', unit: 'ng/mL', referenceLow: 0.8, referenceHigh: 3.5 },

  // Electrolytes
  { id: 'sodium', name: 'Sodium', category: 'Electrolytes', unit: 'mmol/L', referenceLow: 135, referenceHigh: 145 },
  { id: 'potassium', name: 'Potassium', category: 'Electrolytes', unit: 'mmol/L', referenceLow: 3.5, referenceHigh: 5.1 },
  { id: 'chloride', name: 'Chloride', category: 'Electrolytes', unit: 'mmol/L', referenceLow: 98, referenceHigh: 106 },
  { id: 'bicarbonate', name: 'Bicarbonate', category: 'Electrolytes', unit: 'mmol/L', referenceLow: 22, referenceHigh: 28 },
  { id: 'calcium', name: 'Calcium', category: 'Electrolytes', unit: 'mmol/L', referenceLow: 2.15, referenceHigh: 2.55 },
  { id: 'phosphate', name: 'Phosphate', category: 'Electrolytes', unit: 'mmol/L', referenceLow: 0.8, referenceHigh: 1.45 },
  { id: 'magnesium', name: 'Magnesium', category: 'Electrolytes', unit: 'mmol/L', referenceLow: 0.7, referenceHigh: 1.0 },

  // Thyroid
  { id: 'tsh', name: 'TSH', category: 'Thyroid', unit: 'mIU/L', referenceLow: 0.4, referenceHigh: 4.0 },
  { id: 'free_t4', name: 'Free T4', category: 'Thyroid', unit: 'pmol/L', referenceLow: 12, referenceHigh: 22 },
  { id: 'free_t3', name: 'Free T3', category: 'Thyroid', unit: 'pmol/L', referenceLow: 3.1, referenceHigh: 6.8 },

  // Cardiac Markers
  { id: 'troponin_t', name: 'Troponin T', category: 'Cardiac', unit: 'ng/L', referenceLow: 0, referenceHigh: 14, referenceText: '<14 normal' },
  { id: 'troponin_i', name: 'Troponin I', category: 'Cardiac', unit: 'ng/L', referenceLow: 0, referenceHigh: 40, referenceText: '<40 normal' },
  { id: 'ck_mb', name: 'CK-MB', category: 'Cardiac', unit: 'U/L', referenceLow: 0, referenceHigh: 25 },
  { id: 'ck_total', name: 'CK Total', category: 'Cardiac', unit: 'U/L', referenceLow: 0, referenceHigh: 200 },
  { id: 'ldh', name: 'LDH', category: 'Cardiac', unit: 'U/L', referenceLow: 100, referenceHigh: 250 },
  { id: 'bnp', name: 'BNP', category: 'Cardiac', unit: 'pg/mL', referenceLow: 0, referenceHigh: 100, referenceText: '<100 normal' },

  // Cardiac Imaging & ECG — non-numeric, free-text findings
  { id: 'ecg', name: 'ECG', category: 'Cardiac', unit: 'findings', referenceLow: 0, referenceHigh: 0, referenceText: 'Normal sinus rhythm' },
  { id: 'echocardiogram', name: 'Echocardiogram', category: 'Cardiac', unit: 'findings', referenceLow: 0, referenceHigh: 0, referenceText: 'Normal cardiac function' },

  // Coagulation
  { id: 'pt', name: 'Prothrombin Time', category: 'Coagulation', unit: 'seconds', referenceLow: 11, referenceHigh: 13.5 },
  { id: 'inr', name: 'INR', category: 'Coagulation', unit: 'ratio', referenceLow: 0.8, referenceHigh: 1.2 },
  { id: 'aptt', name: 'APTT', category: 'Coagulation', unit: 'seconds', referenceLow: 25, referenceHigh: 35 },

  // Inflammatory Markers
  { id: 'crp', name: 'C-Reactive Protein', category: 'Inflammatory', unit: 'mg/L', referenceLow: 0, referenceHigh: 5, referenceText: '<5 normal' },
  { id: 'esr', name: 'ESR', category: 'Inflammatory', unit: 'mm/hr', referenceLow: 0, referenceHigh: 20 },
];

export function interpretValue(investigation: Investigation, value: string): InvestigationResult['interpretation'] {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return undefined;

  const { referenceLow, referenceHigh } = investigation;

  if (numValue < referenceLow) {
    return {
      level: 'low',
      text: 'Low',
      color: '#3b82f6' // blue
    };
  } else if (numValue > referenceHigh) {
    // Special handling for HDL (higher is better)
    if (investigation.id === 'hdl') {
      return {
        level: 'low',
        text: 'Low',
        color: '#3b82f6'
      };
    }
    
    // Check for critical values
    if (isCriticalValue(investigation.id, numValue)) {
      return {
        level: 'critical',
        text: 'Critical',
        color: '#dc2626' // red
      };
    }
    
    return {
      level: 'high',
      text: 'High',
      color: '#f59e0b' // amber
    };
  } else {
    return {
      level: 'normal',
      text: 'Normal',
      color: '#059669' // green
    };
  }
}

function isCriticalValue(investigationId: string, value: number): boolean {
  const criticalThresholds: Record<string, number> = {
    'creatinine': 200, // μmol/L
    'potassium': 6.5, // mmol/L
    'sodium': 160, // mmol/L
    'glucose_fasting': 13.9, // mmol/L
    'glucose_random': 20, // mmol/L
    'troponin_t': 100, // ng/L
    'troponin_i': 300, // ng/L
    'k': 7.0, // mmol/L
    'na': 165, // mmol/L
  };

  const threshold = criticalThresholds[investigationId];
  return threshold ? value > threshold : false;
}

export function interpretationChip(interpretation: {
  level: 'normal' | 'low' | 'high' | 'critical';
  text: string;
  color?: string;
} | undefined) {
  if (!interpretation) return null;
  
  const color = interpretation.color || '#6b7280'; // Default gray color
  
  return {
    text: interpretation.text,
    style: {
      background: color + '20',
      color: color,
      border: `1px solid ${color}40`,
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px'
    }
  };
}

export function getInvestigationsByCategory(): Record<string, Investigation[]> {
  const categories: Record<string, Investigation[]> = {};
  
  INVESTIGATION_TEMPLATES.forEach(inv => {
    if (!categories[inv.category]) {
      categories[inv.category] = [];
    }
    categories[inv.category].push(inv);
  });
  
  return categories;
}
