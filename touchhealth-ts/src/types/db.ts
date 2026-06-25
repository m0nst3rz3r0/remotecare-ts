// Typed interfaces for Supabase table rows.
// Used in storage.ts to replace `as any` casts on Supabase query results.

export interface PatientRow {
  id: string;
  code: string;
  name: string;
  age: number;
  sex: 'M' | 'F';
  cond: string;
  phone?: string;
  village?: string;
  status: string;
  hospital: string;
  region?: string;
  district?: string;
  visits?: unknown;
  medications?: unknown;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface UserRow {
  id: string;
  username: string;
  password: string;
  role: string;
  display_name: string;
  hospital: string;
  region: string;
  district: string;
  is_super_admin?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HospitalRow {
  id: string;
  name: string;
  region: string;
  district: string;
  level?: string;
  beds?: number;
  created_at?: string;
  updated_at?: string;
}

export interface VisitRow {
  id: string;
  patient_id: string;
  date: string;
  attended: boolean;
  sbp?: number;
  dbp?: number;
  sugar?: number;
  sugar_type?: string;
  weight_kg?: number;
  height_cm?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}
