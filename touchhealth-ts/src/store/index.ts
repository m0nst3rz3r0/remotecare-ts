// ════════════════════════════════════════════════════════════
// TOUCH HEALTH · src/store/index.ts
// Barrel export — all stores
// ════════════════════════════════════════════════════════════

export { usePatientStore, selectVisiblePatients, selectFilteredPatients, selectSelectedPatient, selectTopbarCounts } from './usePatientStore';
export { useAuthStore, selectIsAdmin, selectIsDoctor, selectIsSuperAdmin } from './useAuthStore';
export { useUIStore } from './useUIStore';
