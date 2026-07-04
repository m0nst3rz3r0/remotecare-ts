import type { Hospital } from '../../types';
import Button from '../ui/Button';
import Alert from '../ui/Alert';

export default function AdminHospitalPanel({
  superAdmin,
  regions,
  districtOptions,
  visibleHospitals,
  hRegion,
  hDistrict,
  hName,
  hErr,
  inputCls,
  labelCls,
  setHRegion,
  setHDistrict,
  setHName,
  onAddHospital,
  onDeleteHospital,
}: {
  superAdmin: boolean;
  regions: string[];
  districtOptions: string[];
  visibleHospitals: Hospital[];
  hRegion: string;
  hDistrict: string;
  hName: string;
  hErr: string | null;
  inputCls: string;
  labelCls: string;
  setHRegion: (value: string) => void;
  setHDistrict: (value: string) => void;
  setHName: (value: string) => void;
  onAddHospital: () => void;
  onDeleteHospital: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="font-sans font-semibold text-slate-800 text-[14px] mb-2">Hospital Management</div>
      {hErr ? <Alert variant="red">Could not add hospital: {hErr}</Alert> : null}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <div className={labelCls}>Region</div>
          <select value={hRegion} onChange={(e) => { setHRegion(e.target.value); setHDistrict(''); }} className={inputCls}>
            <option value="">- Select -</option>
            {regions.map((region) => <option key={region} value={region}>{region}</option>)}
          </select>
        </div>
        <div>
          <div className={labelCls}>District</div>
          <select value={hDistrict} onChange={(e) => setHDistrict(e.target.value)} disabled={!hRegion} className={`${inputCls} disabled:opacity-50`}>
            <option value="">- Select -</option>
            {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
          </select>
        </div>
        <div>
          <div className={labelCls}>Hospital name</div>
          <input value={hName} onChange={(e) => setHName(e.target.value)} className={inputCls} placeholder="e.g. Bukoba Regional Hospital" />
        </div>
      </div>
      <div className="mt-3"><Button size="md" variant="primary" label="Add Hospital" onClick={onAddHospital} /></div>
      <div className="mt-4 overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.05em] font-bold text-slate-500">
              <th className="pb-2 px-2">Name</th><th className="pb-2 px-2">Region</th><th className="pb-2 px-2">District</th><th className="pb-2 px-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleHospitals.map((hospital) => (
              <tr key={hospital.id} style={{ background: '#f8fafc' }}>
                <td className="px-2 py-2 font-semibold text-slate-800 text-[12px]">{hospital.name}</td>
                <td className="px-2 py-2 text-[12px] text-slate-500">{hospital.region}</td>
                <td className="px-2 py-2 text-[12px] text-slate-500">{hospital.district}</td>
                <td className="px-2 py-2 text-right"><Button size="sm" variant="danger" label="Delete" onClick={() => onDeleteHospital(hospital.id)} /></td>
              </tr>
            ))}
            {!visibleHospitals.length ? <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-500 font-semibold">No hospitals configured{!superAdmin ? ' in your district' : ''}.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
