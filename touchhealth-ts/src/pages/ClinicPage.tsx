import { useMemo } from 'react';
import { usePatientStore } from '../store/usePatientStore';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import {
  getLastVisit, nextVisitDate, bpClass, formatDate
} from '../services/clinical';
import { selectVisiblePatients } from '../store/usePatientStore';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function ClinicPage() {
  const currentUser   = useAuthStore((s) => s.currentUser);
  const patients      = usePatientStore((s) => s.patients);
  const openVisitModal = useUIStore((s) => s.openVisitModal);
  const clinicSettings = useUIStore((s) => s.clinicSettings);
  const toggleClinicDay = useUIStore((s) => s.toggleClinicDay);

  const visible = useMemo(
    () => selectVisiblePatients(patients, currentUser),
    [patients, currentUser]
  );

  const active = visible.filter((p) => p.status === 'active');

  const rows = useMemo(() => {
    return active.map((p) => {
      const lv = getLastVisit(p);
      const fromDate = lv ? new Date(lv.date) : new Date(p.enrol);
      const nextDate = nextVisitDate(fromDate, 30, clinicSettings.days);
      const today = new Date();
      today.setHours(0,0,0,0);
      nextDate.setHours(0,0,0,0);
      const diffDays = Math.round((nextDate.getTime() - today.getTime()) / 86400000);
      const isOverdue = diffDays < 0;
      const isToday   = diffDays === 0;
      const bpCls = lv?.sbp && lv?.dbp ? bpClass(lv.sbp, lv.dbp) : null;
      return { p, lv, nextDate, diffDays, isOverdue, isToday, bpCls };
    }).sort((a,b) => a.diffDays - b.diffDays);
  }, [active, clinicSettings]);

  return (
    <div style={{ padding: 32, background: '#f9f9f7', minHeight: '100vh' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#6f797d', marginBottom: 4 }}>
          Registry › Schedule Management
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, color: '#0f1f26', margin: 0 }}>
          Clinic Schedule
        </h1>
        <p style={{ color: '#516169', margin: '4px 0 0', fontSize: 13 }}>
          NCD Management Program · {currentUser?.sessionDistrict || 'All Districts'}
        </p>
      </div>

      {/* Clinic days setup */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(191,200,205,.2)', padding: 20, marginBottom: 24, boxShadow: '0 2px 8px rgba(15,31,38,.06)' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#0f1f26', marginBottom: 12 }}>
          Clinic Days
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#6f797d', textTransform: 'uppercase', letterSpacing: '.5px', marginRight: 4 }}>
            Select Days:
          </span>
          {[1,2,3,4,5,6,0].map((d) => {
            const active = clinicSettings.days.includes(d as any);
            return (
              <button
                key={d}
                onClick={() => toggleClinicDay(d as any)}
                style={{
                  padding: '6px 16px', borderRadius: 9999,
                  fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', transition: 'all .12s',
                  border: active ? '2px solid #0d6e87' : '1px solid rgba(191,200,205,.4)',
                  background: active ? 'rgba(13,110,135,.08)' : '#fff',
                  color: active ? '#0d6e87' : '#516169',
                }}
              >
                {DAYS[d]}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#6f797d' }}>
          ℹ️ Appointments snap to nearest clinic day · max 30 days from last visit
        </div>
      </div>

      {/* Schedule table */}
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,31,38,.06)', border: '1px solid rgba(191,200,205,.18)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#0f1f26' }}>
              {['Clinical Code','Patient','Condition','Last Visit','Last BP','Last Glucose','Next Appointment','Days Until','Status','Action'].map((h) => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontFamily: 'Syne, sans-serif', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#fff', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#6f797d', fontFamily: 'Karla, sans-serif' }}>
                  No active patients found.
                </td>
              </tr>
            )}
            {rows.map(({ p, lv, nextDate, diffDays, isOverdue, isToday, bpCls }) => (
              <tr key={p.id} style={{ background: isOverdue ? 'rgba(220,38,38,.04)' : isToday ? 'rgba(217,119,6,.04)' : '#fff' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(13,110,135,.04)'}
                onMouseLeave={(e) => e.currentTarget.style.background = isOverdue ? 'rgba(220,38,38,.04)' : isToday ? 'rgba(217,119,6,.04)' : '#fff'}
              >
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 11, color: isOverdue ? '#dc2626' : '#0d6e87', background: isOverdue ? 'rgba(220,38,38,.08)' : 'rgba(13,110,135,.08)', padding: '2px 8px', borderRadius: 4 }}>
                    {p.code}
                  </span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: '#0f1f26' }}>{p.age}y</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#516169' }}>{p.age}y · {p.sex}</div>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 9999, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase', background: p.cond === 'DM+HTN' ? 'rgba(217,119,6,.12)' : p.cond === 'DM' ? 'rgba(13,110,135,.12)' : 'rgba(220,38,38,.12)', color: p.cond === 'DM+HTN' ? '#d97706' : p.cond === 'DM' ? '#0d6e87' : '#dc2626' }}>
                    {p.cond}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#516169' }}>
                  {lv ? formatDate(lv.date) : '—'}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {lv?.sbp && lv?.dbp ? (
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12, color: bpCls?.cls === 'chip-crisis' || bpCls?.cls === 'chip-high' ? '#dc2626' : '#16a34a' }}>
                        {lv.sbp}/{lv.dbp}
                      </div>
                      <div style={{ fontSize: 9, color: '#6f797d' }}>{bpCls?.lbl}</div>
                    </div>
                  ) : <span style={{ color: '#bfc8cd' }}>—</span>}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {lv?.sugar ? (
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#516169' }}>
                      {lv.sugar} mmol/L
                    </div>
                  ) : <span style={{ color: '#bfc8cd' }}>—</span>}
                </td>
                <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 11, color: '#0f1f26' }}>
                  {nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {isOverdue ? (
                    <span style={{ fontSize: 9, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#dc2626', background: 'rgba(220,38,38,.1)', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {Math.abs(diffDays)}d overdue
                    </span>
                  ) : isToday ? (
                    <span style={{ fontSize: 9, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#d97706', background: 'rgba(217,119,6,.1)', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                      Today
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#16a34a', fontWeight: 700 }}>
                      {diffDays}d
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {p.scheduledNext ? (
                    <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(13,110,135,.1)', color: '#0d6e87', padding: '3px 8px', borderRadius: 9999, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase' }}>
                      Confirmed
                    </span>
                  ) : (
                    <span style={{ fontSize: 9, fontWeight: 800, background: '#e8e8e6', color: '#516169', padding: '3px 8px', borderRadius: 9999, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase' }}>
                      Predicted
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <button
                    onClick={() => openVisitModal(p.id)}
                    style={{ padding: '5px 12px', background: '#005469', color: '#fff', border: 'none', borderRadius: 4, fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.4px' }}
                  >
                    + Visit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Table footer */}
        <div style={{ background: '#f4f4f2', padding: '10px 16px', borderTop: '1px solid rgba(191,200,205,.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#6f797d', textTransform: 'uppercase' }}>
            Showing {rows.length} active patients
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>● {rows.filter(r => !r.isOverdue && !r.isToday).length} upcoming</span>
            <span style={{ fontSize: 10, color: '#d97706', fontWeight: 700 }}>● {rows.filter(r => r.isToday).length} today</span>
            <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>● {rows.filter(r => r.isOverdue).length} overdue</span>
          </div>
        </div>
      </div>
    </div>
  );
}


