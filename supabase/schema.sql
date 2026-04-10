-- ════════════════════════════════════════════════════════════
-- REMOTECARE · Supabase Database Schema
-- DM/HTN NCD Management System
-- ════════════════════════════════════════════════════════════

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ════════════════════════════════════════════════════════════
-- USERS TABLE (App users - admins and doctors)
-- ════════════════════════════════════════════════════════════
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- hashed password
    role TEXT NOT NULL CHECK (role IN ('admin', 'doctor')),
    display_name TEXT NOT NULL,
    hospital TEXT,
    region TEXT,
    district TEXT,
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster username lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_region_district ON users(region, district);

-- ════════════════════════════════════════════════════════════
-- HOSPITALS TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    region TEXT NOT NULL,
    district TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hospitals_region ON hospitals(region);
CREATE INDEX idx_hospitals_district ON hospitals(district);

-- ════════════════════════════════════════════════════════════
-- PATIENTS TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    age INTEGER NOT NULL,
    sex TEXT NOT NULL CHECK (sex IN ('M', 'F')),
    cond TEXT NOT NULL CHECK (cond IN ('HTN', 'DM', 'DM+HTN')),
    enrol DATE NOT NULL,
    phone TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ltfu', 'completed')),
    hospital TEXT NOT NULL,
    region TEXT NOT NULL,
    district TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_code ON patients(code);
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_hospital ON patients(hospital);
CREATE INDEX idx_patients_region_district ON patients(region, district);
CREATE INDEX idx_patients_enrol ON patients(enrol);

-- ════════════════════════════════════════════════════════════
-- VISITS TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    date DATE NOT NULL,
    att BOOLEAN NOT NULL DEFAULT FALSE,
    sbp INTEGER,
    dbp INTEGER,
    sugar NUMERIC,
    sugar_type TEXT CHECK (sugar_type IN ('FBS', 'RBS', '2HPP', '')),
    weight NUMERIC,
    height NUMERIC,
    bmi NUMERIC,
    notes TEXT,
    presenting_complaint TEXT,
    physical_exam JSONB,
    diagnoses JSONB,
    investigations JSONB,
    drug_warnings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_visits_patient ON visits(patient_id);
CREATE INDEX idx_visits_date ON visits(date);
CREATE INDEX idx_visits_month_year ON visits(month, year);
CREATE INDEX idx_visits_att ON visits(att);

-- ════════════════════════════════════════════════════════════
-- MEDICATIONS TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dose TEXT,
    freq TEXT,
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medications_visit ON medications(visit_id);

-- ════════════════════════════════════════════════════════════
-- PATIENT MEDICATIONS TABLE (Patient-level medication history)
-- ════════════════════════════════════════════════════════════
CREATE TABLE patient_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    name TEXT NOT NULL,
    dose TEXT,
    freq TEXT,
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patient_medications_patient ON patient_medications(patient_id);
CREATE INDEX idx_patient_medications_date ON patient_medications(date);

-- ════════════════════════════════════════════════════════════
-- HBA1C TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE hba1c (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    value NUMERIC NOT NULL,
    date DATE NOT NULL,
    recorded_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hba1c_patient ON hba1c(patient_id);
CREATE INDEX idx_hba1c_year_quarter ON hba1c(year, quarter);

-- ════════════════════════════════════════════════════════════
-- CALL LOGS TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    note TEXT NOT NULL,
    by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_logs_patient ON call_logs(patient_id);

-- ════════════════════════════════════════════════════════════
-- SCHEDULED APPOINTMENTS TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE scheduled_appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    note TEXT,
    scheduled_on TIMESTAMPTZ DEFAULT NOW(),
    scheduled_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_appointments_patient ON scheduled_appointments(patient_id);
CREATE INDEX idx_scheduled_appointments_date ON scheduled_appointments(date);

-- ════════════════════════════════════════════════════════════
-- SMS LOGS TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_code TEXT NOT NULL,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('at', 'twilio')),
    lang TEXT NOT NULL CHECK (lang IN ('en', 'sw')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'demo')),
    hospital TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_logs_patient ON sms_logs(patient_id);
CREATE INDEX idx_sms_logs_status ON sms_logs(status);
CREATE INDEX idx_sms_logs_sent_at ON sms_logs(sent_at);

-- ════════════════════════════════════════════════════════════
-- STOCKOUT REPORTS TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE stockout_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    med TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('out', 'low', 'adequate')),
    days_remaining INTEGER,
    hospital TEXT NOT NULL,
    region TEXT NOT NULL,
    flagged_by TEXT NOT NULL,
    flagged_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stockout_hospital ON stockout_reports(hospital);
CREATE INDEX idx_stockout_resolved ON stockout_reports(resolved);

-- ════════════════════════════════════════════════════════════
-- CLINIC SETTINGS TABLE
-- ════════════════════════════════════════════════════════════
CREATE TABLE clinic_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    days INTEGER[] DEFAULT '{1,2,3,4,5}', -- Default Mon-Fri (1-5)
    interval INTEGER DEFAULT 30,
    open_hour INTEGER DEFAULT 8,
    close_hour INTEGER DEFAULT 17,
    auto_ltfu_days INTEGER DEFAULT 21,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- UPDATE TRIGGER FOR updated_at
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stockout_reports_updated_at BEFORE UPDATE ON stockout_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinic_settings_updated_at BEFORE UPDATE ON clinic_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY POLICIES
-- ════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hba1c ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stockout_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;

-- Note: Create these policies after setting up Supabase Auth
-- For now, allow all access (development mode)
CREATE POLICY "Allow all" ON users FOR ALL USING (true);
CREATE POLICY "Allow all" ON hospitals FOR ALL USING (true);
CREATE POLICY "Allow all" ON patients FOR ALL USING (true);
CREATE POLICY "Allow all" ON visits FOR ALL USING (true);
CREATE POLICY "Allow all" ON medications FOR ALL USING (true);
CREATE POLICY "Allow all" ON patient_medications FOR ALL USING (true);
CREATE POLICY "Allow all" ON hba1c FOR ALL USING (true);
CREATE POLICY "Allow all" ON call_logs FOR ALL USING (true);
CREATE POLICY "Allow all" ON scheduled_appointments FOR ALL USING (true);
CREATE POLICY "Allow all" ON sms_logs FOR ALL USING (true);
CREATE POLICY "Allow all" ON stockout_reports FOR ALL USING (true);
CREATE POLICY "Allow all" ON clinic_settings FOR ALL USING (true);
