import PageWrapper from '../components/layout/PageWrapper';
import PatientSidebar from '../components/patient/PatientSidebar';
import PatientDetail from '../components/patient/PatientDetail';
import { useAuthStore } from '../store/useAuthStore';
import { usePatientStore, selectSelectedPatient } from '../store/usePatientStore';

export default function PatientsPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const selectedId = usePatientStore((s) => s.selectedId);
  const selectPatient = usePatientStore((s) => s.selectPatient);
  const selectedPatient = usePatientStore((s) =>
    selectSelectedPatient(s.patients, s.selectedId),
  );

  const showMobileDetail = !!selectedId;
  const title = currentUser?.role === 'doctor' ? 'Patients' : 'Patients';

  const mobileBack = (
    <div className="p-3 border-b border-slate-200 bg-white flex items-center gap-2">
      <button
        type="button"
        className="px-3 py-2 rounded-md border border-slate-200 font-semibold text-[12px] uppercase tracking-wider text-slate-800"
        onClick={() => selectPatient(null)}
      >
        ← Back
      </button>
      <div className="font-syne font-semibold text-slate-800 text-[14px]">
        {selectedPatient?.code ?? 'Patient'}
      </div>
    </div>
  );

  // Desktop: sidebar + detail
  if (showMobileDetail) {
    return (
      <div className="h-full flex flex-col">
        <div className="lg:hidden">{mobileBack}</div>
        <div className="flex-1 lg:flex hidden">
          <div className="hidden lg:block w-[300px] border-r border-slate-200">
            <PatientSidebar />
          </div>
          <div className="flex-1">
            <PatientDetail />
          </div>
        </div>
        <div className="lg:hidden flex-1">
          <PatientDetail />
        </div>
      </div>
    );
  }

  return (
    <PageWrapper title={title}>
      <div className="flex flex-col lg:flex-row gap-0">
        <aside className="w-full lg:w-[300px] lg:flex-shrink-0 lg:border-r border-slate-200">
          <div className="lg:block">{/* desktop */}</div>
          <div className="lg:hidden">{/* mobile sidebar */}</div>
          <PatientSidebar />
        </aside>

        <section className="hidden lg:block flex-1 overflow-hidden">
          <PatientDetail />
        </section>
      </div>
    </PageWrapper>
  );
}

