import type { PageId, SessionUser, UserRole } from '../types';

export const DOCTOR_PAGES: readonly PageId[] = ['patients', 'ltfu', 'clinic', 'reports'];
export const ADMIN_PAGES: readonly PageId[] = ['overview', 'trends', 'doctors', 'settings', 'user-management', 'directory'];

export function getDefaultPageForRole(role: UserRole): PageId {
  return role === 'admin' ? 'overview' : 'patients';
}

export function getAllowedPagesForRole(role: UserRole): readonly PageId[] {
  return role === 'admin' ? ADMIN_PAGES : DOCTOR_PAGES;
}

export function canAccessPage(role: UserRole, page: PageId): boolean {
  return getAllowedPagesForRole(role).includes(page);
}

export function getSafePageForRole(role: UserRole, page: PageId): PageId {
  return canAccessPage(role, page) ? page : getDefaultPageForRole(role);
}

export function getSafePageForUser(user: SessionUser | null, page: PageId): PageId {
  if (!user) return page;
  return getSafePageForRole(user.role, page);
}
