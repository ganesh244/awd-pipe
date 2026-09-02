/**
 * Canonical reporting chain
 * ─────────────────────────
 *   JCF / CF  ->  Area Manager  ->  District Manager  ->  State Manager  ->  Admin
 *
 * A user's parent is DERIVED from their role and posting rather than frozen at
 * creation time. Each tier falls back to the next one up when the immediate tier
 * has no manager yet — an Area Manager in a district with no District Manager
 * reports to the State Manager instead.
 *
 * Deriving it is what fixes the drift this module was written for: an Area
 * Manager created before their District Manager existed used to keep reporting
 * to the State Manager forever, because the fallback chosen at creation was
 * written to the record and never revisited. Recomputing means adding that
 * District Manager later re-parents them automatically.
 *
 * Shared deliberately between the API (which reconciles after every user
 * mutation) and the one-time repair script, so there is exactly one definition
 * of what "correct" means.
 */

/** Minimal shape needed to place a user in the chain. */
export interface ChainUser {
  id?: string;
  name?: string;
  role?: string;
  state?: string;
  district?: string;
  areaName?: string;
  reportsToId?: string;
  createdById?: string;
  isActive?: boolean;
}

export interface ChainChange {
  id: string;
  name: string;
  role: string;
  from: string | null;
  to: string;
}

const norm = (s?: string): string => (s || '').toString().trim().toLowerCase();

/**
 * The id of the manager this user should report to, or null when none applies
 * (Admins, or a user for whom no suitable manager exists anywhere).
 */
export function computeParentId(user: ChainUser, allUsers: ChainUser[]): string | null {
  if (!user || !user.id || user.role === 'Admin') return null;

  // Never treat malformed records, the user themselves, or deactivated accounts
  // as candidate managers.
  const candidates = allUsers.filter(
    (u) => u && u.id && u.id !== user.id && u.name && u.isActive !== false
  );

  const pick = (pred: (u: ChainUser) => boolean): string | null => {
    const matches = candidates.filter(pred);
    if (matches.length === 0) return null;
    // Sort by id so the choice is stable and deterministic when several tie.
    matches.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return matches[0].id!;
  };

  // Prefer the admin who created this account, so an existing chain is kept
  // rather than reshuffled arbitrarily when more than one Admin exists.
  const admin = (): string | null => {
    const creator = candidates.find((u) => u.id === user.createdById && u.role === 'Admin');
    return creator ? creator.id! : pick((u) => u.role === 'Admin');
  };

  const stateMgr = (): string | null =>
    !norm(user.state)
      ? null
      : pick((u) => u.role === 'State Manager' && norm(u.state) === norm(user.state));

  const distMgr = (): string | null =>
    !norm(user.district)
      ? null
      : pick(
          (u) =>
            u.role === 'District Manager' &&
            norm(u.district) === norm(user.district) &&
            norm(u.state) === norm(user.state)
        );

  const areaMgr = (): string | null =>
    !norm(user.areaName)
      ? null
      : pick(
          (u) =>
            u.role === 'Area Manager' &&
            norm(u.areaName) === norm(user.areaName) &&
            norm(u.district) === norm(user.district)
        );

  switch (user.role) {
    case 'State Manager':
      return admin();
    case 'District Manager':
      return stateMgr() || admin();
    case 'Area Manager':
      return distMgr() || stateMgr() || admin();
    case 'CF':
    case 'JCF':
      return areaMgr() || distMgr() || stateMgr() || admin();
    default:
      return null;
  }
}

/**
 * The reportsToId corrections needed across the whole user set, without
 * applying them.
 *
 * A change is only proposed when a better parent actually exists, so this can
 * never orphan someone by blanking a link it cannot replace. Because every edge
 * points from a lower tier to a strictly higher one, the result is always a
 * tree — cycles are structurally impossible.
 */
export function reconcileHierarchy(allUsers: ChainUser[]): ChainChange[] {
  const changes: ChainChange[] = [];
  for (const u of allUsers) {
    if (!u || !u.id || !u.name || u.role === 'Admin') continue;
    const want = computeParentId(u, allUsers);
    const have = u.reportsToId || null;
    if (want && want !== have) {
      changes.push({ id: u.id, name: u.name, role: u.role || '', from: have, to: want });
    }
  }
  return changes;
}
