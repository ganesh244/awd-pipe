/**
 * Cold-start behaviour for the initial /api/init load.
 *
 * The API answers immediately even when it has not finished connecting to
 * Atlas, returning `dbStatus: 'local'` with empty arrays. Two rules keep that
 * from surfacing as a dashboard that reads "0 pipes" for several seconds before
 * the real numbers appear:
 *
 *   1. a degraded, empty response must never overwrite data we already hold
 *   2. the retry after a degraded response must be quick, because that delay is
 *      exactly how long the wrong number stays on screen
 *
 * Extracted so both are directly testable — see tests/initLoad.test.ts.
 */

/**
 * Delay before retrying a still-waking backend, in ms.
 *
 * Exponential from 600ms and capped at 10s. The previous schedule started at a
 * flat 4s, which was the entire visible gap between the empty dashboard and the
 * real one; the server is typically connected within a second or two.
 */
export function initRetryDelay(attempt: number): number {
  const n = Math.max(1, Math.floor(attempt));
  return Math.min(600 * 2 ** (n - 1), 10000);
}

/**
 * Choose between an incoming list and what is already in state.
 *
 * Only a degraded response that is empty while we hold data is ignored. A
 * genuinely empty *authoritative* response is applied — a user whose last
 * record was deleted must see it disappear.
 */
export function preserveOnDegraded<T>(incoming: T[], prev: T[], degraded: boolean): T[] {
  if (degraded && incoming.length === 0 && prev.length > 0) return prev;
  return incoming;
}

/** How long the loading screen may be held while waiting for a real response. */
export const HOLD_LOADING_MS = 6000;

/**
 * Whether the app may be revealed yet.
 *
 * Real data reveals immediately. Otherwise the spinner is held until the hold
 * window elapses or retries run out, so a backend that never answers can still
 * never strand the user on a spinner.
 */
export function canRevealApp(opts: {
  stillWaking: boolean;
  attempt: number;
  maxAttempts: number;
  elapsedMs: number;
}): boolean {
  const { stillWaking, attempt, maxAttempts, elapsedMs } = opts;
  if (!stillWaking) return true;
  return attempt >= maxAttempts || elapsedMs >= HOLD_LOADING_MS;
}
