import type { AWDPipe, Installation, MonitoringRecord } from '../types';

/**
 * Offline snapshot of the field data.
 *
 * The service worker makes the app shell open with no signal, but the pipe
 * registry itself came only from /api/init and was never saved — so on an
 * offline cold start the list was empty and every scan / manual Verify was
 * rejected as "not in your registry". Registration already worked offline
 * mid-session (scanning is on-device, Verify checks the local list, submit
 * goes to the sync queue); this closes the cold-start gap by persisting the
 * last good copy of that list.
 *
 * Keyed by user id: /api/init is scoped per user, and a shared phone must not
 * seed one worker's session with another worker's pipes.
 */

const KEY_PREFIX = 'awd_data_snapshot:';

/** Refuse to persist beyond this; localStorage quota is ~5MB per origin. */
export const MAX_SNAPSHOT_BYTES = 3 * 1024 * 1024;

export interface DataSnapshot {
  pipes: AWDPipe[];
  installations: Installation[];
  monitoringList: MonitoringRecord[];
  savedAt: string;
}

const keyFor = (userId: string) => KEY_PREFIX + userId;

/**
 * Only what scanning, Verify and registration need. Drops client-side fields
 * such as a generated QR data-URL (`QR_Code`) that would blow the quota across
 * 1,500 pipes and are never needed to identify a pipe in the field.
 */
export function trimPipe(p: AWDPipe): AWDPipe {
  const { QR_Code: _qr, Security_Hash: _sh, Specification: _sp, ...rest } = p;
  return rest as AWDPipe;
}

// Parsing ~300KB of JSON is not free on a low-end phone, and three pieces of
// state seed from the same snapshot at startup — memoise the first read.
let cache: { userId: string; value: DataSnapshot | null } | null = null;

export function loadDataSnapshot(userId: string | null | undefined): DataSnapshot | null {
  if (!userId) return null;
  if (cache && cache.userId === userId) return cache.value;
  let value: DataSnapshot | null = null;
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.pipes) && Array.isArray(parsed.installations)) {
        value = {
          pipes: parsed.pipes,
          installations: parsed.installations,
          monitoringList: Array.isArray(parsed.monitoringList) ? parsed.monitoringList : [],
          savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
        };
      }
    }
  } catch {
    value = null; // corrupt or inaccessible storage: behave as if nothing was saved
  }
  cache = { userId, value };
  return value;
}

/**
 * Persist the current lists. Never throws: a QuotaExceededError or a private
 * window must not break the app, it just means no offline copy this time.
 * Returns whether the write happened.
 */
export function saveDataSnapshot(
  userId: string | null | undefined,
  data: { pipes: AWDPipe[]; installations: Installation[]; monitoringList: MonitoringRecord[] },
): boolean {
  if (!userId) return false;
  // Nothing to save yet (e.g. the init request has not answered): keep the
  // previous snapshot rather than overwriting it with an empty one.
  if (data.pipes.length === 0 && data.installations.length === 0) return false;
  try {
    const snapshot: DataSnapshot = {
      pipes: data.pipes.map(trimPipe),
      installations: data.installations,
      monitoringList: data.monitoringList,
      savedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(snapshot);
    if (json.length > MAX_SNAPSHOT_BYTES) return false;
    localStorage.setItem(keyFor(userId), json);
    cache = { userId, value: snapshot };
    return true;
  } catch {
    return false;
  }
}

export function clearDataSnapshot(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    /* ignore */
  }
  if (cache && cache.userId === userId) cache = null;
}

/**
 * Choose between an incoming list from /api/init and what is already held.
 *
 * A `local` response means the API answered before Atlas finished connecting
 * and carries empty arrays; applying it blindly would wipe the snapshot we just
 * seeded from — the same "0 pipes" flash as before, now also destroying the
 * offline copy. Only that case is ignored: an authoritative empty response is
 * still applied, so a genuine deletion is never masked.
 */
export function preserveOnDegraded<T>(incoming: T[], prev: T[], degraded: boolean): T[] {
  if (degraded && incoming.length === 0 && prev.length > 0) return prev;
  return incoming;
}
