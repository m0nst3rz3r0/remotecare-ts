import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { usePatientStore } from '../store/usePatientStore';
import {
  getDirectorySummary,
  getDoctorAnalyticsRows,
  getHospitalAnalyticsRows,
  getProgrammeOverview,
} from '../services/analytics';
import { loadUsers, loadHospitals } from '../services/auth';
import { loadClinicSettings } from '../services/storage';
import type { User, Hospital, Patient, ClinicSettings } from '../types';

const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.78)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  marginBottom: 16,
  overflow: 'hidden',
};

const TH: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#64748b',
  padding: '10px 14px',
  textAlign: 'left',
  borderBottom: '1px solid #f1f5f9',
  whiteSpace: 'nowrap',
};

const TD: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 13,
  color: '#374151',
  padding: '10px 14px',
  borderBottom: '1px solid #f8fafc',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
        {children}
      </span>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    green: { bg: '#d1fae5', text: '#065f46' },
    amber: { bg: '#fef3c7', text: '#92400e' },
    red: { bg: '#fee2e2', text: '#991b1b' },
    blue: { bg: '#dbeafe', text: '#1e40af' },
    gray: { bg: '#f1f5f9', text: '#475569' },
  };
  const { bg, text } = map[color] ?? map.gray;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 9px',
        borderRadius: 9999,
        fontFamily: FONT,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        background: bg,
        color: text,
      }}
    >
      {label}
    </span>
  );
}

function AttendBar({ pct }: { pct: number }) {
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 9999, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function DoctorsTable({
  doctors,
  patients,
  title,
  settings,
  year,
  month,
}: {
  doctors: User[];
  patients: Patient[];
  title: string;
  settings: ClinicSettings;
  year: number;
  month: number;
}) {
  const rows = useMemo(
    () => getDoctorAnalyticsRows(doctors, patients, settings, month, year),
    [doctors, patients, settings, year, month],
  );

  return (
    <div style={CARD}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Doctor', 'Hospital', 'Region / District', 'Patients', 'Controlled', 'Missed/Due', 'Attendance', 'LTFU'].map((h) => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                  No doctors found.
                </td>
              </tr>
            )}
            {rows.map(({ doctor, patientCount, controlled, missed, attendPct, ltfu }) => (
              <tr
                key={doctor.id}
                style={{ transition: 'background 0.1s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
              >
                <td style={TD}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{doctor.displayName}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>@{doctor.username}</div>
                </td>
                <td style={TD}>{doctor.hospital || <span style={{ color: '#cbd5e1' }}>-</span>}</td>
                <td style={{ ...TD, fontSize: 12, color: '#64748b' }}>
                  {[doctor.region, doctor.district].filter(Boolean).join(' / ') || '-'}
                </td>
                <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>{patientCount}</td>
                <td style={{ ...TD, textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{controlled}</td>
                <td style={{ ...TD, textAlign: 'center', color: missed > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{missed}</td>
                <td style={{ ...TD, minWidth: 120 }}><AttendBar pct={attendPct} /></td>
                <td style={{ ...TD, textAlign: 'center' }}>
                  <Badge label={String(ltfu)} color={ltfu > 0 ? 'amber' : 'green'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HospitalsTable({
  hospitals,
  patients,
  title,
  settings,
  year,
  month,
}: {
  hospitals: Hospital[];
  patients: Patient[];
  title: string;
  settings: ClinicSettings;
  year: number;
  month: number;
}) {
  const rows = useMemo(
    () => getHospitalAnalyticsRows(hospitals, patients, settings, month, year),
    [hospitals, patients, settings, year, month],
  );

  return (
    <div style={CARD}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Facility', 'Region', 'District', 'Patients', 'Controlled', 'Missed/Due', 'Attendance', 'LTFU'].map((h) => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                  No facilities found.
                </td>
              </tr>
            )}
            {rows.map(({ hospital, patientCount, controlled, missed, attendPct, ltfu }) => (
              <tr
                key={hospital.id}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
              >
                <td style={{ ...TD, fontWeight: 600, color: '#1e293b' }}>{hospital.name}</td>
                <td style={{ ...TD, fontSize: 12, color: '#64748b' }}>{hospital.region || '-'}</td>
                <td style={{ ...TD, fontSize: 12, color: '#64748b' }}>{hospital.district || '-'}</td>
                <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>{patientCount}</td>
                <td style={{ ...TD, textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{controlled}</td>
                <td style={{ ...TD, textAlign: 'center', color: missed > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{missed}</td>
                <td style={{ ...TD, minWidth: 120 }}><AttendBar pct={attendPct} /></td>
                <td style={{ ...TD, textAlign: 'center' }}>
                  <Badge label={String(ltfu)} color={ltfu > 0 ? 'amber' : 'green'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminsTable({ admins }: { admins: User[] }) {
  return (
    <div style={CARD}>
      <SectionTitle>Admins</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Admin', 'Region', 'District', 'Type'].map((h) => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                  No admins found.
                </td>
              </tr>
            )}
            {admins.map((a) => (
              <tr
                key={a.id}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
              >
                <td style={TD}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{a.displayName}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>@{a.username}</div>
                </td>
                <td style={{ ...TD, fontSize: 12, color: '#64748b' }}>{a.region || '-'}</td>
                <td style={{ ...TD, fontSize: 12, color: '#64748b' }}>{a.district || '-'}</td>
                <td style={TD}>
                  <Badge label={a.isSuperAdmin ? 'Super Admin' : 'Admin'} color={a.isSuperAdmin ? 'red' : 'blue'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatStrip({ stats }: { stats: { label: string; value: number | string; color?: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            flex: '1 1 140px',
            padding: '14px 18px',
            background: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(255,255,255,0.75)',
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 6 }}>
            {s.label}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: s.color ?? '#1e293b', lineHeight: 1 }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          maxWidth: 320,
          padding: '7px 12px',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          fontFamily: FONT,
          fontSize: 13,
          color: '#1e293b',
          background: 'rgba(255,255,255,0.8)',
          outline: 'none',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1a56db'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontFamily: FONT, fontSize: 12 }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

export default function DirectoryPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const patients = usePatientStore((s) => s.patients);
  const clinicSettings = useMemo(() => loadClinicSettings(), []);
  const now = useMemo(() => new Date(), []);
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const isSuperAdmin = currentUser?.isSuperAdmin === true;
  const adminRegion = currentUser?.adminRegion ?? '';
  const adminDistrict = currentUser?.adminDistrict ?? '';

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allHospitals, setAllHospitals] = useState<Hospital[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setAllUsers(loadUsers());
    setAllHospitals(loadHospitals());
  }, []);

  const { visibleAdmins, visibleDoctors, visibleHospitals, visiblePatients } = useMemo(() => {
    if (isSuperAdmin) {
      return {
        visibleAdmins: allUsers.filter((u) => u.role === 'admin'),
        visibleDoctors: allUsers.filter((u) => u.role === 'doctor'),
        visibleHospitals: allHospitals,
        visiblePatients: patients,
      };
    }

    const inScope = (u: { region?: string; district?: string }) =>
      (!adminRegion || u.region === adminRegion) &&
      (!adminDistrict || u.district === adminDistrict);

    return {
      visibleAdmins: [],
      visibleDoctors: allUsers.filter((u) => u.role === 'doctor' && inScope(u)),
      visibleHospitals: allHospitals.filter(inScope),
      visiblePatients: patients.filter(
        (p) =>
          (!adminRegion || p.region === adminRegion) &&
          (!adminDistrict || p.district === adminDistrict),
      ),
    };
  }, [isSuperAdmin, allUsers, allHospitals, patients, adminRegion, adminDistrict]);

  const q = search.toLowerCase().trim();

  const filteredDoctors = useMemo(
    () =>
      q
        ? visibleDoctors.filter(
            (d) =>
              d.displayName.toLowerCase().includes(q) ||
              d.username.toLowerCase().includes(q) ||
              (d.hospital ?? '').toLowerCase().includes(q),
          )
        : visibleDoctors,
    [q, visibleDoctors],
  );

  const filteredHospitals = useMemo(
    () =>
      q
        ? visibleHospitals.filter(
            (h) =>
              h.name.toLowerCase().includes(q) ||
              (h.region ?? '').toLowerCase().includes(q) ||
              (h.district ?? '').toLowerCase().includes(q),
          )
        : visibleHospitals,
    [q, visibleHospitals],
  );

  const filteredAdmins = useMemo(
    () =>
      q
        ? visibleAdmins.filter(
            (a) =>
              a.displayName.toLowerCase().includes(q) ||
              a.username.toLowerCase().includes(q),
          )
        : visibleAdmins,
    [q, visibleAdmins],
  );

  const summaryStats = useMemo(() => {
    const overview = getProgrammeOverview(visiblePatients, clinicSettings, now);
    const summary = getDirectorySummary(visiblePatients, clinicSettings, currentMonth, currentYear, now);

    const base = [
      { label: 'Facilities', value: visibleHospitals.length },
      { label: 'Doctors', value: visibleDoctors.length },
      { label: 'Patients', value: visiblePatients.length },
      { label: 'Controlled', value: overview.controlled, color: overview.controlled > 0 ? '#10b981' : '#64748b' },
      { label: 'Missed/Due', value: overview.due, color: overview.due > 0 ? '#ef4444' : '#10b981' },
      { label: 'Attendance', value: `${summary.attendPct}%`, color: summary.attendPct >= 70 ? '#10b981' : '#f59e0b' },
      { label: 'LTFU', value: overview.ltfu, color: overview.ltfu > 0 ? '#ef4444' : '#10b981' },
    ];

    if (isSuperAdmin) base.splice(1, 0, { label: 'Admins', value: visibleAdmins.length });
    return base;
  }, [visibleHospitals, visibleDoctors, visibleAdmins, visiblePatients, isSuperAdmin, clinicSettings, currentMonth, currentYear, now]);

  return (
    <div>
      <StatStrip stats={summaryStats} />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, hospital, region..."
      />

      {isSuperAdmin && <AdminsTable admins={filteredAdmins} />}

      <HospitalsTable
        hospitals={filteredHospitals}
        patients={visiblePatients}
        settings={clinicSettings}
        year={currentYear}
        month={currentMonth}
        title={isSuperAdmin ? 'All Facilities' : `Facilities · ${adminDistrict || adminRegion || 'Your District'}`}
      />

      <DoctorsTable
        doctors={filteredDoctors}
        patients={visiblePatients}
        settings={clinicSettings}
        year={currentYear}
        month={currentMonth}
        title={isSuperAdmin ? 'All Doctors' : `Doctors · ${adminDistrict || adminRegion || 'Your District'}`}
      />
    </div>
  );
}
