// ════════════════════════════════════════════════════════════
// REMOTECARE · src/pages/DirectoryPage.tsx
//
// Role-based directory view:
//   Admin      → Hospitals + Doctors in their district
//   SuperAdmin → Admins + Hospitals + Doctors programme-wide
//
// Performance metrics are derived from local patient data.
// TODO: replace loadUsers() / loadHospitals() calls with your
//       remote API/DB queries when moving off localStorage.
// ════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore }    from '../store/useAuthStore';
import { usePatientStore } from '../store/usePatientStore';
import { loadUsers, loadHospitals } from '../services/auth';
import type { User, Hospital, Patient } from '../types';

// ── Shared design tokens ─────────────────────────────────────
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const CARD: React.CSSProperties = {
  background:          'rgba(255,255,255,0.78)',
  backdropFilter:      'blur(14px)',
  WebkitBackdropFilter:'blur(14px)',
  borderRadius:        12,
  border:              '1px solid rgba(255,255,255,0.78)',
  boxShadow:           '0 2px 12px rgba(0,0,0,0.06)',
  marginBottom:        16,
  overflow:            'hidden',
};

const TH: React.CSSProperties = {
  fontFamily:      FONT,
  fontSize:        10,
  fontWeight:      600,
  textTransform:   'uppercase',
  letterSpacing:   '0.06em',
  color:           '#64748b',
  padding:         '10px 14px',
  textAlign:       'left',
  borderBottom:    '1px solid #f1f5f9',
  whiteSpace:      'nowrap',
};

const TD: React.CSSProperties = {
  fontFamily: FONT,
  fontSize:   13,
  color:      '#374151',
  padding:    '10px 14px',
  borderBottom: '1px solid #f8fafc',
};

// ── Small helpers ────────────────────────────────────────────

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
    green:  { bg: '#d1fae5', text: '#065f46' },
    amber:  { bg: '#fef3c7', text: '#92400e' },
    red:    { bg: '#fee2e2', text: '#991b1b' },
    blue:   { bg: '#dbeafe', text: '#1e40af' },
    gray:   { bg: '#f1f5f9', text: '#475569' },
  };
  const { bg, text } = map[color] ?? map.gray;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 9999,
      fontFamily: FONT, fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      background: bg, color: text,
    }}>
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

// ── Metrics helpers ──────────────────────────────────────────

function calcDoctorMetrics(doc: User, patients: Patient[]) {
  const dp        = patients.filter((p) => p.hospital === doc.hospital);
  const allVisits = dp.flatMap((p) => p.visits ?? []);
  const attended  = allVisits.filter((v) => v.att).length;
  const missed    = allVisits.length - attended;
  const attendPct = allVisits.length ? Math.round((attended / allVisits.length) * 100) : 0;
  const ltfu      = dp.filter((p) => p.status === 'ltfu').length;
  return { patientCount: dp.length, attended, missed, attendPct, ltfu };
}

function calcHospitalMetrics(hospital: Hospital, patients: Patient[]) {
  const hp        = patients.filter((p) => p.hospital === hospital.name);
  const allVisits = hp.flatMap((p) => p.visits ?? []);
  const attended  = allVisits.filter((v) => v.att).length;
  const attendPct = allVisits.length ? Math.round((attended / allVisits.length) * 100) : 0;
  const ltfu      = hp.filter((p) => p.status === 'ltfu').length;
  // TODO: replace with DB aggregate query if patient data is remote
  return { patientCount: hp.length, attendPct, ltfu };
}

// ── Doctors table ────────────────────────────────────────────

function DoctorsTable({ doctors, patients, title }: { doctors: User[]; patients: Patient[]; title: string }) {
  const rows = useMemo(
    () => doctors.map((d) => ({ d, ...calcDoctorMetrics(d, patients) })),
    [doctors, patients],
  );

  return (
    <div style={CARD}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Doctor', 'Hospital', 'Region · District', 'Patients', 'Attended', 'Missed', 'Attendance', 'LTFU'].map((h) => (
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
            {rows.map(({ d, patientCount, attended, missed, attendPct, ltfu }) => (
              <tr key={d.id} style={{ transition: 'background 0.1s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}>
                <td style={TD}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{d.displayName}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>@{d.username}</div>
                </td>
                <td style={TD}>{d.hospital || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                <td style={{ ...TD, fontSize: 12, color: '#64748b' }}>
                  {[d.region, d.district].filter(Boolean).join(' · ') || '—'}
                </td>
                <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>{patientCount}</td>
                <td style={{ ...TD, textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{attended}</td>
                <td style={{ ...TD, textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>{missed}</td>
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

// ── Hospitals table ──────────────────────────────────────────

function HospitalsTable({ hospitals, patients, title }: { hospitals: Hospital[]; patients: Patient[]; title: string }) {
  const rows = useMemo(
    () => hospitals.map((h) => ({ h, ...calcHospitalMetrics(h, patients) })),
    [hospitals, patients],
  );

  return (
    <div style={CARD}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Facility', 'Region', 'District', 'Patients', 'Attendance', 'LTFU'].map((h) => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                  No facilities found.
                </td>
              </tr>
            )}
            {rows.map(({ h, patientCount, attendPct, ltfu }) => (
              <tr key={h.id}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}>
                <td style={{ ...TD, fontWeight: 600, color: '#1e293b' }}>{h.name}</td>
                <td style={{ ...TD, fontSize: 12, color: '#64748b' }}>{h.region || '—'}</td>
                <td style={{ ...TD, fontSize: 12, color: '#64748b' }}>{h.district || '—'}</td>
                <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>{patientCount}</td>
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

// ── Admins table (SuperAdmin only) ───────────────────────────

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
              <tr key={a.id}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}>
                <td style={TD}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{a.displayName}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>@{a.username}</div>
                </td>
                <td style={{ ...TD, fontSize: 12, color: '#64748b' }}>{a.region   || '—'}</td>
                <td style={{ ...TD, fontSize: 12, color: '#64748b' }}>{a.district || '—'}</td>
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

// ── Summary stat strip ───────────────────────────────────────

function StatStrip({ stats }: { stats: { label: string; value: number | string; color?: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {stats.map((s) => (
        <div key={s.label} style={{
          flex: '1 1 140px',
          padding: '14px 18px',
          background: 'rgba(255,255,255,0.72)',
          border: '1px solid rgba(255,255,255,0.75)',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
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

// ── Search bar ───────────────────────────────────────────────

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, maxWidth: 320,
          padding: '7px 12px',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          fontFamily: FONT, fontSize: 13, color: '#1e293b',
          background: 'rgba(255,255,255,0.8)',
          outline: 'none',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1a56db'; }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
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

// ── Main export ──────────────────────────────────────────────

export default function DirectoryPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const patients    = usePatientStore((s) => s.patients);

  const isSuperAdmin = currentUser?.isSuperAdmin === true;
  const adminRegion   = currentUser?.adminRegion   ?? '';
  const adminDistrict = currentUser?.adminDistrict ?? '';

  // TODO: replace with remote API calls (GET /api/users, GET /api/hospitals)
  const [allUsers,     setAllUsers]     = useState<User[]>([]);
  const [allHospitals, setAllHospitals] = useState<Hospital[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setAllUsers(loadUsers());
    setAllHospitals(loadHospitals());
  }, []);

  // ── Scope data by role ──────────────────────────────────────
  const { visibleAdmins, visibleDoctors, visibleHospitals, visiblePatients } = useMemo(() => {
    if (isSuperAdmin) {
      // SuperAdmin sees everything
      return {
        visibleAdmins:    allUsers.filter((u) => u.role === 'admin'),
        visibleDoctors:   allUsers.filter((u) => u.role === 'doctor'),
        visibleHospitals: allHospitals,
        visiblePatients:  patients,
      };
    }
    // Regular Admin: scoped to their district
    const inScope = (u: { region?: string; district?: string }) =>
      (!adminRegion   || u.region   === adminRegion) &&
      (!adminDistrict || u.district === adminDistrict);

    return {
      visibleAdmins:    [],   // admins can't see other admins
      visibleDoctors:   allUsers.filter((u) => u.role === 'doctor' && inScope(u)),
      visibleHospitals: allHospitals.filter(inScope),
      visiblePatients:  patients.filter((p) =>
        (!adminRegion   || p.region   === adminRegion) &&
        (!adminDistrict || p.district === adminDistrict),
      ),
    };
  }, [isSuperAdmin, allUsers, allHospitals, patients, adminRegion, adminDistrict]);

  // ── Search filter ───────────────────────────────────────────
  const q = search.toLowerCase().trim();

  const filteredDoctors   = useMemo(() => q ? visibleDoctors.filter((d) =>
    d.displayName.toLowerCase().includes(q) ||
    d.username.toLowerCase().includes(q) ||
    (d.hospital ?? '').toLowerCase().includes(q),
  ) : visibleDoctors, [q, visibleDoctors]);

  const filteredHospitals = useMemo(() => q ? visibleHospitals.filter((h) =>
    h.name.toLowerCase().includes(q) ||
    (h.region ?? '').toLowerCase().includes(q) ||
    (h.district ?? '').toLowerCase().includes(q),
  ) : visibleHospitals, [q, visibleHospitals]);

  const filteredAdmins    = useMemo(() => q ? visibleAdmins.filter((a) =>
    a.displayName.toLowerCase().includes(q) ||
    a.username.toLowerCase().includes(q),
  ) : visibleAdmins, [q, visibleAdmins]);

  // ── Summary stats ───────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const totalVisits  = visiblePatients.flatMap((p) => p.visits ?? []);
    const attended     = totalVisits.filter((v) => v.att).length;
    const attendPct    = totalVisits.length ? Math.round((attended / totalVisits.length) * 100) : 0;
    const ltfuCount    = visiblePatients.filter((p) => p.status === 'ltfu').length;

    const base = [
      { label: 'Facilities',   value: visibleHospitals.length },
      { label: 'Doctors',      value: visibleDoctors.length },
      { label: 'Patients',     value: visiblePatients.length },
      { label: 'Attendance',   value: `${attendPct}%`, color: attendPct >= 70 ? '#10b981' : '#f59e0b' },
      { label: 'LTFU',         value: ltfuCount, color: ltfuCount > 0 ? '#ef4444' : '#10b981' },
    ];
    if (isSuperAdmin) base.splice(1, 0, { label: 'Admins', value: visibleAdmins.length });
    return base;
  }, [visibleHospitals, visibleDoctors, visibleAdmins, visiblePatients, isSuperAdmin]);

  return (
    <div>
      {/* Summary strip */}
      <StatStrip stats={summaryStats} />

      {/* Search */}
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, hospital, region…"
      />

      {/* SuperAdmin: Admins table */}
      {isSuperAdmin && (
        <AdminsTable admins={filteredAdmins} />
      )}

      {/* Hospitals */}
      <HospitalsTable
        hospitals={filteredHospitals}
        patients={visiblePatients}
        title={isSuperAdmin ? 'All Facilities' : `Facilities · ${adminDistrict || adminRegion || 'Your District'}`}
      />

      {/* Doctors */}
      <DoctorsTable
        doctors={filteredDoctors}
        patients={visiblePatients}
        title={isSuperAdmin ? 'All Doctors' : `Doctors · ${adminDistrict || adminRegion || 'Your District'}`}
      />
    </div>
  );
}
