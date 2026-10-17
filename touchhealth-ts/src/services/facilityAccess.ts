import type { SessionUser } from '../types';

/** Local visibility only. Cloud permissions are independently enforced by RLS. */
export function canAccessLocalFacility(user: SessionUser | null, facility: { region: string; district: string; hospital: string }): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  if (user.role === 'admin') return !!user.adminRegion && user.adminRegion === facility.region;
  return user.role === 'doctor' && !!user.sessionHospital && user.sessionHospital === facility.hospital
    && user.sessionRegion === facility.region && user.sessionDistrict === facility.district;
}
