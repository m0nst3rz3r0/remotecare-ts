import { useEffect, useMemo, useState } from 'react';
import { usePatientStore } from '../../store/usePatientStore';
import { useUIStore } from '../../store/useUIStore';
import type { Medication, Patient } from '../../types';
import { HTN_MEDS, getCurrentMeds } from '../../services/clinical';
import MedRow from './MedRow';
import Button from '../ui/Button';

function defaultMedication(): Medication {
  return { name: HTN_MEDS[0] };
}

export default function MedModal() {
  const open = useUIStore((s) => s.medModalOpen);
  const patientId = useUIStore((s) => s.medModalPatientId);
  const close = useUIStore((s) => s.closeMedModal);

  const patients = usePatientStore((s) => s.patients);
  const updateMedications = usePatientStore((s) => s.updateMedications);

  const patient: Patient | null = useMemo(() => {
    if (patientId === null) return null;
    return patients.find((p) => p.id === patientId) ?? null;
  }, [patientId, patients]);

  const [meds, setMeds] = useState<Medication[]>([]);

  useEffect(() => {
    if (!open || !patient) return;
    const current = getCurrentMeds(patient);
    setMeds(current.length ? current : [defaultMedication()]);
  }, [open, patient]);

  if (!open || !patient || patientId === null) return null;

  const onSave = () => {
    updateMedications(patientId, meds);
    close();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0"
        onClick={close}
        style={{ background: 'rgba(0,0,0,.35)' }}
      />

      <div
        className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white border-l border-slate-200 shadow-lg"
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <div className="font-syne font-semibold text-[16px] text-slate-800">
              Edit Medications
            </div>
            <div className="text-[12px] text-slate-500">
              {patient.code}
            </div>
          </div>
          <Button size="xs" variant="ghost" label="Close" onClick={close} />
        </div>

        <div className="p-4 overflow-auto">
          <div className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">
            Current meds (saved on “Today”)
          </div>

          <div className="space-y-3">
            {meds.map((m, idx) => (
              <MedRow
                key={`${idx}-${m.name}`}
                med={m}
                onChange={(next) => {
                  setMeds((prev) => prev.map((x, i) => (i === idx ? next : x)));
                }}
                onRemove={() => {
                  setMeds((prev) => prev.filter((_, i) => i !== idx));
                }}
              />
            ))}
          </div>

          <div className="mt-4">
            <Button
              size="sm"
              variant="ghost"
              label="+ Add medication"
              onClick={() => setMeds((prev) => [...prev, defaultMedication()])}
              className="w-full justify-center"
            />
          </div>

          <div className="mt-4">
            <Button
              size="md"
              variant="primary"
              label="Save"
              onClick={onSave}
              className="w-full justify-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

