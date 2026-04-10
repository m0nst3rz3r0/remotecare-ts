import type { Patient, Visit, SessionUser } from '../types';
import { supabase } from './supabase';
import {
  getLastSync,
  setLastSync,
  getSyncCount,
  setSyncCount,
} from './storage';

export interface SyncResult {
  success: boolean;
  skipped?: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  error?: string;
}

/**
 * Offline-first sync to Supabase:
 * - Saves patients, visits, medications to Supabase
 * - Only called when the app is online
 * - Never throws: always resolves with a SyncResult
 */
export async function syncToCloud(
  patients: Patient[],
  user: SessionUser | null,
): Promise<SyncResult> {
  const lastSyncAt = getLastSync();
  const lastCount = getSyncCount();
  const pendingCount = Math.max(0, patients.length - lastCount);

  if (!patients.length) {
    return {
      success: true,
      lastSyncAt,
      pendingCount: 0,
    };
  }

  try {
    // Sync each patient with their visits and medications
    for (const patient of patients) {
      // Upsert patient
      const { error: patientError } = await supabase
        .from('patients')
        .upsert({
          id: patient.id,
          code: patient.code,
          age: patient.age,
          sex: patient.sex,
          cond: patient.cond,
          enrol: patient.enrol,
          phone: patient.phone,
          address: patient.address,
          status: patient.status,
          hospital: patient.hospital,
          region: patient.region,
          district: patient.district,
        }, { onConflict: 'id' });

      if (patientError) {
        console.error('Patient sync error:', patientError);
        continue;
      }

      // Sync visits
      if (patient.visits?.length) {
        for (const visit of patient.visits) {
          const { error: visitError } = await supabase
            .from('visits')
            .upsert({
              id: visit.id,
              patient_id: patient.id,
              month: visit.month,
              year: visit.year,
              date: visit.date,
              att: visit.att,
              sbp: visit.sbp,
              dbp: visit.dbp,
              sugar: visit.sugar,
              sugar_type: visit.sugarType,
              weight: visit.weight,
              height: visit.height,
              bmi: visit.bmi,
              notes: visit.notes,
              presenting_complaint: visit.presentingComplaint,
              physical_exam: visit.physicalExam,
              diagnoses: visit.diagnoses,
              investigations: visit.investigations,
              drug_warnings: visit.drugWarnings,
            }, { onConflict: 'id' });

          if (visitError) {
            console.error('Visit sync error:', visitError);
          }

          // Sync visit medications
          if (visit.meds?.length) {
            for (const med of visit.meds) {
              await supabase
                .from('medications')
                .upsert({
                  visit_id: visit.id,
                  name: med.name,
                  dose: med.dose,
                  freq: med.freq,
                  instructions: med.instructions,
                }, { onConflict: 'id' });
            }
          }
        }
      }
    }

    setLastSync();
    setSyncCount(patients.length);

    return {
      success: true,
      lastSyncAt: getLastSync(),
      pendingCount: 0,
    };
  } catch (e) {
    return {
      success: false,
      lastSyncAt,
      pendingCount,
      error: e instanceof Error ? e.message : 'Unknown sync error',
    };
  }
}

/**
 * Fetch patients from Supabase (for initial load or refresh)
 */
export async function fetchFromCloud(): Promise<Patient[]> {
  try {
    const { data: patients, error } = await supabase
      .from('patients')
      .select('*');

    if (error || !patients) {
      return [];
    }

    // Fetch visits for each patient
    const fullPatients: Patient[] = [];
    for (const p of patients) {
      const { data: visits } = await supabase
        .from('visits')
        .select('*')
        .eq('patient_id', p.id);

      // Fetch medications for each visit
      const visitsWithMeds: Visit[] = [];
      if (visits) {
        for (const v of visits) {
          const { data: meds } = await supabase
            .from('medications')
            .select('*')
            .eq('visit_id', v.id);

          visitsWithMeds.push({
            ...v,
            meds: meds || [],
            sugarType: v.sugar_type,
            presentingComplaint: v.presenting_complaint,
            physicalExam: v.physical_exam,
            drugWarnings: v.drug_warnings,
          });
        }
      }

      fullPatients.push({
        ...p,
        visits: visitsWithMeds,
      });
    }

    return fullPatients;
  } catch (e) {
    console.error('Fetch error:', e);
    return [];
  }
}

