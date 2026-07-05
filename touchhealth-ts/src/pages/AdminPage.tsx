import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Target, X } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import SyncBar from '../components/ui/SyncBar';
import { OverviewView, titleForAdminPage } from '../components/admin/AdminOverview';
import AdminSettingsView from '../components/admin/AdminSettingsView';
import type { Hospital } from '../types';
import { usePatientStore } from '../store/usePatientStore';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import { loadHospitals } from '../services/auth';
import { TZ_GEO } from '../utils/geo';

const DirectoryPage = lazy(() => import('./DirectoryPage'));
const AnalyticsBuilder = lazy(() => import('./AnalyticsBuilder'));

function AdminSectionFallback() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-[13px] text-slate-500">
      Loading section...
    </div>
  );
}

export default function AdminPage() {
  const activePage = useUIStore((s) => s.activePage);
  const clinicSettings = useUIStore((s) => s.clinicSettings);
  const patients = usePatientStore((s) => s.patients);
  const currentUser = useAuthStore((s) => s.currentUser);
  const superAdmin = currentUser?.isSuperAdmin === true;
  const currentYear = new Date().getFullYear();

  const [hospitals, setHospitals] = useState<Hospital[]>(() => loadHospitals());
  const [scopeRegion, setScopeRegion] = useState('');
  const [scopeDistrict, setScopeDistrict] = useState('');
  const [overviewYear, setOverviewYear] = useState(currentYear);

  const allRegions = useMemo(() => Object.keys(TZ_GEO).sort(), []);
  const scopeDistrictOptions = useMemo(
    () => (scopeRegion ? TZ_GEO[scopeRegion] ?? [] : []),
    [scopeRegion],
  );

  useEffect(() => {
    setHospitals(loadHospitals());
  }, [activePage]);

  const { scopedPatients, scopedHospitals, scopeLabel } = useMemo(() => {
    if (superAdmin) {
      const filteredPatients = patients.filter((patient) => {
        if (scopeRegion && patient.region !== scopeRegion) return false;
        if (scopeDistrict && patient.district !== scopeDistrict) return false;
        return true;
      });
      const filteredHospitals = hospitals.filter((hospital) => {
        if (scopeRegion && hospital.region !== scopeRegion) return false;
        if (scopeDistrict && hospital.district !== scopeDistrict) return false;
        return true;
      });
      const label = scopeDistrict
        ? `${scopeRegion} · ${scopeDistrict}`
        : scopeRegion
          ? scopeRegion
          : 'All Regions';
      return {
        scopedPatients: filteredPatients,
        scopedHospitals: filteredHospitals,
        scopeLabel: label,
      };
    }

    const region = currentUser?.adminRegion ?? '';
    const district = currentUser?.adminDistrict ?? '';
    return {
      scopedPatients: patients.filter(
        (patient) => (!region || patient.region === region) && (!district || patient.district === district),
      ),
      scopedHospitals: hospitals.filter(
        (hospital) => (!region || hospital.region === region) && (!district || hospital.district === district),
      ),
      scopeLabel: district ? `${region} · ${district}` : region || 'Your District',
    };
  }, [superAdmin, patients, hospitals, scopeRegion, scopeDistrict, currentUser]);

  return (
    <PageWrapper title={titleForAdminPage(activePage)}>
      <div className="mb-4">
        <SyncBar />
      </div>

      {(activePage === 'overview' || (superAdmin && activePage === 'trends')) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '18px',
            flexWrap: 'wrap',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 1px 2px rgba(0,0,0,.04)',
          }}
        >
          {superAdmin && (activePage === 'overview' || activePage === 'trends') && (
            <>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  fontWeight: 700,
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Target size={14} /> Scope:
              </span>
              <select
                value={scopeRegion}
                onChange={(event) => {
                  setScopeRegion(event.target.value);
                  setScopeDistrict('');
                }}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '13px',
                  background: '#fff',
                  outline: 'none',
                  color: '#1e293b',
                }}
              >
                <option value="">All Regions</option>
                {allRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
              <select
                value={scopeDistrict}
                onChange={(event) => setScopeDistrict(event.target.value)}
                disabled={!scopeRegion}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '13px',
                  background: scopeRegion ? '#fff' : '#f9fafb',
                  outline: 'none',
                  color: '#1e293b',
                  opacity: scopeRegion ? 1 : 0.5,
                }}
              >
                <option value="">All Districts</option>
                {scopeDistrictOptions.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
              {(scopeRegion || scopeDistrict) && (
                <button
                  onClick={() => {
                    setScopeRegion('');
                    setScopeDistrict('');
                  }}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#dc2626',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <X size={12} /> Clear
                  </span>
                </button>
              )}
            </>
          )}
          {activePage === 'overview' && (
            <>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  fontWeight: 700,
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Year:
              </span>
              <select
                value={overviewYear}
                onChange={(event) => setOverviewYear(Number(event.target.value))}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '13px',
                  background: '#fff',
                  outline: 'none',
                  color: '#1e293b',
                }}
              >
                {Array.from({ length: 6 }, (_, index) => currentYear - index).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </>
          )}
          <span
            style={{
              fontSize: '11px',
              color: '#6b7280',
              fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
              marginLeft: 'auto',
            }}
          >
            {scopedPatients.length} patients · {scopedHospitals.length} facilities
          </span>
        </div>
      )}

      {activePage === 'overview' && (
        <OverviewView
          patients={scopedPatients}
          hospitals={scopedHospitals}
          year={overviewYear}
          scopeLabel={scopeLabel}
        />
      )}

      {activePage === 'trends' && (
        <Suspense fallback={<AdminSectionFallback />}>
          <AnalyticsBuilder
            scopedPatients={scopedPatients}
            scopeLabel={scopeLabel}
            isSuperAdmin={superAdmin}
            selectedYear={overviewYear}
            onSelectedYearChange={setOverviewYear}
          />
        </Suspense>
      )}

      {activePage === 'directory' && (
        <Suspense fallback={<AdminSectionFallback />}>
          <DirectoryPage />
        </Suspense>
      )}

      {(activePage === 'settings' || activePage === 'user-management') && (
        <AdminSettingsView patients={patients} clinicSettings={clinicSettings} />
      )}
    </PageWrapper>
  );
}
