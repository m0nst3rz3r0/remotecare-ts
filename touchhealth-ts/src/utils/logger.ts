// ════════════════════════════════════════════════════════════
// REMOTECARE · src/utils/logger.ts
// Central logging abstraction.
//
// WHY
// ───
// Bare console.* calls scatter noise into production builds and
// give no path to remote error reporting. This wrapper:
//   • Silences debug/info in production (keeps warn/error)
//   • Provides a single seam to forward errors to Sentry (or any
//     reporter) WITHOUT adding an npm dependency now — wire it in
//     setErrorReporter() when/if Sentry is adopted.
//
// USAGE
//   import { logger } from '../utils/logger';
//   logger.info('synced', count);
//   logger.warn('offline, using cache');
//   logger.error('sync failed', err);
//
// To wire Sentry later (after `npm i @sentry/react`):
//   import * as Sentry from '@sentry/react';
//   setErrorReporter((msg, err) => Sentry.captureException(err ?? new Error(msg)));
// ════════════════════════════════════════════════════════════

type ErrorReporter = (message: string, error?: unknown, extra?: unknown) => void;

const isProd = (import.meta as { env?: { PROD?: boolean } }).env?.PROD === true;

let reporter: ErrorReporter | null = null;

/** Register an external error reporter (e.g. Sentry). Optional. */
export function setErrorReporter(fn: ErrorReporter): void {
  reporter = fn;
}

export const logger = {
  /** Verbose diagnostics — dropped in production. */
  debug(...args: unknown[]): void {
    if (!isProd) console.debug('[RemoteCare]', ...args);
  },

  /** Informational — dropped in production. */
  info(...args: unknown[]): void {
    if (!isProd) console.info('[RemoteCare]', ...args);
  },

  /** Warnings — kept in production. */
  warn(...args: unknown[]): void {
    console.warn('[RemoteCare]', ...args);
  },

  /** Errors — kept in production AND forwarded to the reporter. */
  error(message: string, error?: unknown, extra?: unknown): void {
    console.error('[RemoteCare]', message, error ?? '', extra ?? '');
    try {
      reporter?.(message, error, extra);
    } catch {
      // never let logging throw
    }
  },
};
