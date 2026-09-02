/**
 * Self-test for the canonical reporting chain.
 * Run: npx tsx tests/hierarchyChain.test.ts
 */
import { reconcileHierarchy, computeParentId, type ChainUser } from '../src/utils/hierarchyChain.ts';

let pass = 0, fail = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

const admin: ChainUser = { id: 'a1', name: 'Admin', role: 'Admin', isActive: true };
const sm: ChainUser   = { id: 's1', name: 'SM', role: 'State Manager', state: 'Telangana', createdById: 'a1', isActive: true };
const am: ChainUser   = { id: 'm1', name: 'AM', role: 'Area Manager', state: 'Telangana', district: 'Karimnagar', areaName: 'Jammikunta', isActive: true };
const cf: ChainUser   = { id: 'c1', name: 'CF', role: 'CF', state: 'Telangana', district: 'Karimnagar', areaName: 'Jammikunta', isActive: true };

// 1. No District Manager yet — the Area Manager falls back to the State Manager.
check('AM falls back to SM when no DM exists', computeParentId(am, [admin, sm, am, cf]), 's1');
check('CF attaches to its AM', computeParentId(cf, [admin, sm, am, cf]), 'm1');

// 2. The original bug: a DM is added later. The AM must be re-parented.
const dm: ChainUser = { id: 'd1', name: 'DM', role: 'District Manager', state: 'Telangana', district: 'Karimnagar', isActive: true };
const withDm = [admin, sm, { ...am, reportsToId: 's1' }, { ...cf, reportsToId: 'm1' }, dm];
check('AM is re-parented to the new DM', computeParentId(am, withDm), 'd1');
// The SM in this fixture also starts unparented, so it is corrected too.
check(
  'reconcile reports the AM move, the new DM link, and the SM link',
  reconcileHierarchy(withDm).map((c) => `${c.name}:${c.from}->${c.to}`).sort(),
  ['AM:s1->d1', 'DM:null->s1', 'SM:null->a1']
);

// 3. A DM in a district with no State Manager for that state climbs to Admin.
const lone: ChainUser = { id: 'd2', name: 'LoneDM', role: 'District Manager', state: 'Kerala', district: 'Kochi', isActive: true };
check('DM with no SM in its state climbs to Admin', computeParentId(lone, [admin, sm, lone]), 'a1');

// 4. A deactivated manager is never chosen as a parent.
const offAm = { ...am, isActive: false };
check('deactivated AM is skipped, CF climbs to SM', computeParentId(cf, [admin, sm, offAm, cf]), 's1');

// 5. Malformed records are never chosen as a parent.
const junk: ChainUser = { role: 'Area Manager', district: 'Karimnagar', areaName: 'Jammikunta', isActive: true };
check('record with no id/name is never a parent', computeParentId(cf, [admin, sm, junk, cf]), 's1');

// 6. Admins are never given a parent, and a settled tree proposes no changes.
check('Admin gets no parent', computeParentId(admin, [admin, sm]), null);
const settled = [admin, { ...sm, reportsToId: 'a1' }, { ...dm, reportsToId: 's1' }, { ...am, reportsToId: 'd1' }, { ...cf, reportsToId: 'm1' }];
check('a settled tree is stable (no churn)', reconcileHierarchy(settled), []);

// 7. Reconciliation must never blank an existing link it cannot improve on.
const noManagers = [{ ...cf, reportsToId: 'ghost' }];
check('never blanks a link when no better parent exists', reconcileHierarchy(noManagers), []);

// 8. Every edge must point strictly upward, so the result is always a tree.
const RANK: Record<string, number> = { 'Admin': 0, 'State Manager': 1, 'District Manager': 2, 'Area Manager': 3, 'CF': 4, 'JCF': 4 };
const all = [admin, sm, dm, am, cf];
const upward = all.every((u) => {
  const p = computeParentId(u, all);
  return !p || RANK[all.find((x) => x.id === p)!.role!] < RANK[u.role!];
});
check('every edge points strictly upward (no cycles possible)', upward, true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
