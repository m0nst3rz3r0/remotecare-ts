import { lazy } from 'react';

const RETRY_PREFIX = 'rc_lazy_retry_';

function shouldHandleChunkFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /Failed to fetch dynamically imported module/i.test(message)
    || /Importing a module script failed/i.test(message);
}

function getReloadKey(pageKey: string) {
  return `${RETRY_PREFIX}${pageKey}`;
}

export function lazyWithRetry<T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>,
  pageKey: string,
) {
  return lazy(async () => {
    try {
      const module = await factory();
      sessionStorage.removeItem(getReloadKey(pageKey));
      return module;
    } catch (error) {
      if (shouldHandleChunkFailure(error)) {
        const reloadKey = getReloadKey(pageKey);
        const hasReloaded = sessionStorage.getItem(reloadKey) === '1';
        if (!hasReloaded) {
          sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
          return new Promise<T>(() => {});
        }
      }
      throw error;
    }
  });
}
