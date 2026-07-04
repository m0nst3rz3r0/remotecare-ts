import { describe, expect, it } from 'vitest';
import {
  ADMIN_PAGES,
  DOCTOR_PAGES,
  canAccessPage,
  getDefaultPageForRole,
  getSafePageForRole,
} from './navigation';

describe('navigation policy', () => {
  it('keeps doctor and admin page sets distinct', () => {
    expect(DOCTOR_PAGES).toContain('patients');
    expect(DOCTOR_PAGES).not.toContain('overview');
    expect(ADMIN_PAGES).toContain('overview');
    expect(ADMIN_PAGES).not.toContain('patients');
  });

  it('returns the correct role landing pages', () => {
    expect(getDefaultPageForRole('doctor')).toBe('patients');
    expect(getDefaultPageForRole('admin')).toBe('overview');
    expect(getDefaultPageForRole('auto')).toBe('patients');
  });

  it('blocks pages outside the role scope', () => {
    expect(canAccessPage('doctor', 'reports')).toBe(true);
    expect(canAccessPage('doctor', 'settings')).toBe(false);
    expect(canAccessPage('admin', 'directory')).toBe(true);
    expect(canAccessPage('admin', 'clinic')).toBe(false);
  });

  it('falls back to the default landing page when needed', () => {
    expect(getSafePageForRole('doctor', 'overview')).toBe('patients');
    expect(getSafePageForRole('admin', 'patients')).toBe('overview');
    expect(getSafePageForRole('admin', 'trends')).toBe('trends');
  });
});
