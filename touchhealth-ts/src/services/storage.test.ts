import { describe, it, expect, beforeEach } from 'vitest';
import { initStorageScope, runSchemaMigrations } from './storage';

// Minimal localStorage stub for test environment
function mockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

beforeEach(() => {
  const ms = mockStorage();
  Object.defineProperty(global, 'localStorage', { value: ms, writable: true });
});

describe('runSchemaMigrations', () => {
  it('stamps schema version on first run', () => {
    runSchemaMigrations();
    expect(localStorage.getItem('th_schema_v')).toBe('3');
  });

  it('is idempotent — runs twice without error', () => {
    runSchemaMigrations();
    runSchemaMigrations();
    expect(localStorage.getItem('th_schema_v')).toBe('3');
  });

  it('back-fills missing cond field on patients (v1 migration)', () => {
    const legacyPts = [{ id: '1', name: 'Alice', age: 40, sex: 'F', status: 'active' }];
    localStorage.setItem('zmz2_pts', JSON.stringify(legacyPts));
    runSchemaMigrations();
    const migrated = JSON.parse(localStorage.getItem('zmz2_pts') ?? '[]');
    expect(migrated[0].cond).toBe('HTN');
  });

  it('does not overwrite cond if already present', () => {
    const pts = [{ id: '1', name: 'Bob', age: 50, sex: 'M', cond: 'DM', status: 'active' }];
    localStorage.setItem('zmz2_pts', JSON.stringify(pts));
    runSchemaMigrations();
    const result = JSON.parse(localStorage.getItem('zmz2_pts') ?? '[]');
    expect(result[0].cond).toBe('DM');
  });
});

describe('initStorageScope', () => {
  it('migrates unscoped patient key to scoped key', () => {
    const pts = [{ id: '1', name: 'Test' }];
    localStorage.setItem('zmz2_pts', JSON.stringify(pts));
    initStorageScope('hospital-abc-xyz');
    const suffix = 'hospital';
    expect(localStorage.getItem(`zmz2_pts_${suffix}`)).toBe(JSON.stringify(pts));
    expect(localStorage.getItem('zmz2_pts')).toBeNull();
  });

  it('does not overwrite already-scoped key during migration', () => {
    const suffix = 'hospital';
    const existing = [{ id: '2', name: 'Existing' }];
    localStorage.setItem(`zmz2_pts_${suffix}`, JSON.stringify(existing));
    localStorage.setItem('zmz2_pts', JSON.stringify([{ id: '3', name: 'Old' }]));
    initStorageScope('hospital-abc-xyz');
    const result = JSON.parse(localStorage.getItem(`zmz2_pts_${suffix}`) ?? '[]');
    expect(result[0].id).toBe('2');
  });
});
