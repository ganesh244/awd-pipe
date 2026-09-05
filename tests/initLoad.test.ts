/**
 * Cold-start load behaviour — the "dashboard shows 0 pipes for ~4 seconds" bug.
 * Run: npx tsx tests/initLoad.test.ts
 */
import { initRetryDelay, preserveOnDegraded, canRevealApp, HOLD_LOADING_MS } from '../src/utils/initLoad.ts';

let pass = 0, fail = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

// ── Retry pacing ────────────────────────────────────────────────────────────
// The old schedule was attempt * 4000, so the first retry landed at 4s — which
// is precisely how long the wrong number sat on screen.
check('first retry is sub-second', initRetryDelay(1), 600);
check('second retry', initRetryDelay(2), 1200);
check('third retry', initRetryDelay(3), 2400);
check('backoff is capped', initRetryDelay(9), 10000);
check('attempt 0 treated as first', initRetryDelay(0), 600);
check('first retry beats the old 4s schedule', initRetryDelay(1) < 4000, true);
// Atlas connected at ~1.5-2s when measured locally, so cumulative retry time
// must cross that quickly.
check('cumulative delay covers a ~2s connect by retry 3',
  initRetryDelay(1) + initRetryDelay(2) + initRetryDelay(3) >= 2000, true);

// ── Not clobbering good data with a degraded empty payload ──────────────────
const pipes = [{ Pipe_ID: 'AWD-1' }, { Pipe_ID: 'AWD-2' }];
check('degraded empty response keeps existing data', preserveOnDegraded([], pipes, true), pipes);
check('degraded non-empty response is applied', preserveOnDegraded([{ Pipe_ID: 'AWD-9' }], pipes, true), [{ Pipe_ID: 'AWD-9' }]);
// The important counter-case: a real response saying "there is nothing" must
// win, or a deletion would never show up.
check('authoritative empty response IS applied', preserveOnDegraded([], pipes, false), []);
check('degraded empty with nothing held yet stays empty', preserveOnDegraded([], [], true), []);
check('first good load populates from empty', preserveOnDegraded(pipes, [], false), pipes);

// ── When the app may be revealed ────────────────────────────────────────────
const reveal = (stillWaking: boolean, attempt: number, elapsedMs: number) =>
  canRevealApp({ stillWaking, attempt, maxAttempts: 5, elapsedMs });

check('real data reveals immediately', reveal(false, 1, 0), true);
check('still waking early does NOT reveal', reveal(true, 1, 0), false);
check('still waking mid-window does NOT reveal', reveal(true, 2, 3000), false);
check('reveals once the hold window elapses', reveal(true, 2, HOLD_LOADING_MS), true);
check('reveals once retries are exhausted', reveal(true, 5, 100), true);
// The guarantee that matters: a backend that never becomes healthy can still
// never strand the user on a spinner.
check('never strands the user', reveal(true, 5, 999999), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
