/**
 * Offline snapshot of the pipe registry — the "offline cold start has no pipes
 * to scan against" gap. Run: npx tsx tests/offlineSnapshot.test.ts
 */
// Node has no localStorage; a minimal in-memory shim with the same surface.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
};

const { loadDataSnapshot, saveDataSnapshot, clearDataSnapshot, trimPipe, preserveOnDegraded, MAX_SNAPSHOT_BYTES } =
  await import('../src/utils/offlineSnapshot.ts');

let pass = 0, fail = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

const pipe = (id: string, extra: object = {}) => ({ Pipe_ID: id, Batch_No: 'B1', QR_URL: `?id=${id}`, Status: 'Available', ...extra }) as any;
const inst = (id: string) => ({ Pipe_ID: id, Farmer_Name: 'F', Timestamp: 't' }) as any;

// ── round trip ───────────────────────────────────────────────────────────────
check('nothing saved -> null', loadDataSnapshot('u1'), null);
check('save reports success', saveDataSnapshot('u1', { pipes: [pipe('AWD-1'), pipe('AWD-2')], installations: [inst('AWD-1')], monitoringList: [] }), true);
const back = loadDataSnapshot('u1');
check('round-trip pipe ids', back?.pipes.map(p => p.Pipe_ID), ['AWD-1', 'AWD-2']);
check('round-trip installations', back?.installations.length, 1);
check('savedAt is an ISO timestamp', typeof back?.savedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(back!.savedAt), true);

// ── per-user keying: a shared phone must not leak one worker's list ─────────
check('other user sees nothing', loadDataSnapshot('u2'), null);
check('no user id -> null', loadDataSnapshot(undefined), null);
check('no user id -> save refused', saveDataSnapshot(null, { pipes: [pipe('AWD-9')], installations: [], monitoringList: [] }), false);

// ── trimming keeps what the field needs and drops heavy client-only fields ──
const heavy = pipe('AWD-3', { QR_Code: 'data:image/png;base64,' + 'A'.repeat(5000), Security_Hash: 'h', Specification: 's', District: 'Sangareddy' });
const trimmed = trimPipe(heavy);
check('trim drops QR_Code/Security_Hash/Specification', Object.keys(trimmed).sort(), ['Batch_No', 'District', 'Pipe_ID', 'QR_URL', 'Status']);
saveDataSnapshot('u3', { pipes: [heavy], installations: [], monitoringList: [] });
check('persisted copy is trimmed', 'QR_Code' in (loadDataSnapshot('u3')!.pipes[0] as any), false);

// ── never overwrite a good snapshot with an empty one ───────────────────────
check('empty write refused', saveDataSnapshot('u1', { pipes: [], installations: [], monitoringList: [] }), false);
check('previous snapshot survives the refused write', loadDataSnapshot('u1')?.pipes.length, 2);

// ── quota guard ─────────────────────────────────────────────────────────────
const huge = Array.from({ length: 20000 }, (_, i) => pipe(`AWD-${i}`, { Village: 'V'.repeat(200) }));
check('oversize payload refused (not thrown)', saveDataSnapshot('u4', { pipes: huge, installations: [], monitoringList: [] }), false);
check('MAX_SNAPSHOT_BYTES is 3MB', MAX_SNAPSHOT_BYTES, 3 * 1024 * 1024);

// ── corrupt storage is treated as absent, never thrown ──────────────────────
store.set('awd_data_snapshot:u5', '{not json');
check('corrupt JSON -> null', loadDataSnapshot('u5'), null);
store.set('awd_data_snapshot:u6', JSON.stringify({ pipes: 'nope' }));
check('wrong shape -> null', loadDataSnapshot('u6'), null);

// ── storage throwing (private mode / disabled) never breaks the app ─────────
const realSet = (globalThis as any).localStorage.setItem;
(globalThis as any).localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
check('setItem throwing -> save returns false', saveDataSnapshot('u7', { pipes: [pipe('AWD-7')], installations: [], monitoringList: [] }), false);
(globalThis as any).localStorage.setItem = realSet;

// ── clear ───────────────────────────────────────────────────────────────────
clearDataSnapshot('u1');
check('cleared on logout', loadDataSnapshot('u1'), null);
check('clearing one user leaves another', loadDataSnapshot('u3')?.pipes.length, 1);

// ── degraded-response guard (the reverted commit's SAFE half only) ──────────
const held = [pipe('AWD-1')];
check('degraded empty keeps held data', preserveOnDegraded([], held, true), held);
check('degraded non-empty is applied', preserveOnDegraded([pipe('AWD-9')], held, true).length, 1);
check('authoritative empty IS applied (deletion not masked)', preserveOnDegraded([], held, false), []);
check('degraded empty with nothing held stays empty', preserveOnDegraded([], [], true), []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
