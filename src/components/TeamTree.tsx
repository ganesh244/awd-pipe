import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { User, StateNode, DistrictNode, AreaNode, UserRole } from '../types';
import {
  ChevronRight, Search, Plus, MoreHorizontal, Pencil, Trash2, X, Copy, Check,
  Eye, EyeOff, UserRound, MapPin, Building2, Map, ShieldCheck, Database, KeyRound,
} from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

/**
 * Team screen — one tree, people inside it.
 *
 * Replaces the three-column cascade + separate credentials directory. The
 * cascade needed a selection in one column before the next showed anything,
 * which on a phone (where the columns stack) left panels silently empty; and
 * every person appeared twice, each copy with its own edit and delete. Here
 * the whole visible hierarchy is a single expandable outline — State >
 * District > Area — with each node's manager shown on the node row and field
 * staff listed beneath their area. Tapping a person opens one card for view,
 * edit, password reset and delete. Adding a person is a short stepper that
 * only asks for the location fields that the chosen role needs, pre-filled
 * from wherever you tapped "+".
 *
 * Same props and export name as the component it replaces, so App.tsx's
 * wiring, role rules and server contracts are unchanged.
 */

interface HierarchyManagerProps {
  states: StateNode[];
  districts: DistrictNode[];
  areas: AreaNode[];
  users: User[];
  currentUser: User;
  onAddUser: (user: User) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onDeleteUser?: (userId: string) => void;
  onUpdateState?: (state: StateNode) => void;
  onUpdateDistrict?: (district: DistrictNode) => void;
  onUpdateArea?: (area: AreaNode) => void;
  onAddState?: (state: StateNode) => void;
  onAddDistrict?: (district: DistrictNode) => void;
  onAddArea?: (area: AreaNode) => void;
  onDeleteState?: (stateId: string) => void;
  onDeleteDistrict?: (districtId: string) => void;
  onDeleteArea?: (areaId: string) => void;
  dbStatus?: 'cloud' | 'local' | 'loading';
  onOpenDevTools?: () => void;
}

// ─── Shared helpers (same matching rules as before) ──────────────────────────

const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const matchLoc = (a?: string, b?: string) => {
  if (!a || !b) return false;
  const na = norm(a); const nb = norm(b);
  return na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na));
};

const ROLE_LABEL: Record<UserRole, string> = {
  'Admin': 'Admin',
  'State Manager': 'State Manager',
  'District Manager': 'District Manager',
  'Area Manager': 'Area Manager',
  'CF': 'Community Facilitator',
  'JCF': 'Junior CF',
};
const ROLE_SHORT: Record<UserRole, string> = {
  'Admin': 'Admin', 'State Manager': 'SM', 'District Manager': 'DM', 'Area Manager': 'AM', 'CF': 'CF', 'JCF': 'JCF',
};
// One muted tint per tier; all pairs clear 4.5:1 on their surface.
const ROLE_TINT: Record<UserRole, string> = {
  'Admin': 'bg-purple-50 text-purple-700 border-purple-200',
  'State Manager': 'bg-amber-50 text-amber-800 border-amber-200',
  'District Manager': 'bg-blue-50 text-blue-700 border-blue-200',
  'Area Manager': 'bg-teal-50 text-teal-700 border-teal-200',
  'CF': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'JCF': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const NEEDS_DISTRICT = (r: UserRole) => r === 'District Manager' || r === 'Area Manager' || r === 'CF' || r === 'JCF';
const NEEDS_AREA = (r: UserRole) => r === 'Area Manager' || r === 'CF' || r === 'JCF';

/** Which roles the signed-in user may create. Unchanged from the old screen and the server. */
const allowedRolesFor = (me: User): UserRole[] => {
  if (me.role === 'Admin') return ['Admin', 'State Manager', 'District Manager', 'Area Manager', 'CF', 'JCF'];
  if (me.role === 'State Manager') return ['District Manager', 'Area Manager', 'CF', 'JCF'];
  if (me.role === 'District Manager') return ['Area Manager', 'CF', 'JCF'];
  if (me.role === 'Area Manager') return ['CF', 'JCF'];
  return [];
};
const canEditUser = (me: User, u: User) =>
  me.role === 'Admin' ||
  (me.role === 'State Manager' && ['District Manager', 'Area Manager', 'CF', 'JCF'].includes(u.role)) ||
  (me.role === 'District Manager' && ['Area Manager', 'CF', 'JCF'].includes(u.role)) ||
  (me.role === 'Area Manager' && ['CF', 'JCF'].includes(u.role));
const canSeeUser = (me: User, u: User) => {
  if (me.role === 'Admin') return true;
  if (me.role === 'State Manager') return matchLoc(u.state, me.state);
  if (me.role === 'District Manager') return matchLoc(u.district, me.district);
  if (me.role === 'Area Manager') return matchLoc(u.areaName, me.areaName);
  return u.id === me.id;
};

const btnBase = 'inline-flex items-center justify-center gap-1.5 font-bold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = `${btnBase} bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-4 min-h-[44px] text-sm shadow-sm shadow-emerald-900/10`;
const btnSecondary = `${btnBase} bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-4 min-h-[44px] text-sm`;
const btnDanger = `${btnBase} bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl px-4 min-h-[44px] text-sm`;
const btnIcon = `${btnBase} min-w-[44px] min-h-[44px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100`;
const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900 min-h-[44px] focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition placeholder:text-slate-400';
const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5';

// ─── Small UI atoms ──────────────────────────────────────────────────────────

const RoleBadge: React.FC<{ role: UserRole; long?: boolean }> = ({ role, long }) => (
  <span className={`inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${ROLE_TINT[role]}`}>
    {long ? ROLE_LABEL[role] : ROLE_SHORT[role]}
  </span>
);

const Avatar: React.FC<{ name: string; inactive?: boolean }> = ({ name, inactive }) => {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  return (
    <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black tabular-nums ${inactive ? 'bg-slate-100 text-slate-500' : 'bg-emerald-700 text-white'}`}>
      {initials}
    </span>
  );
};

const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {});
      }}
      className={btnIcon}
    >
      {done ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
    </button>
  );
};

/**
 * One panel for every task: bottom sheet on phones, right-hand drawer on
 * larger screens. Escape, focus trap and scroll lock come from useDialog.
 */
const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }> = ({ title, onClose, children, footer }) => {
  const { dialogProps } = useDialog({ onClose, label: title });
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 max-h-[92dvh] bg-white rounded-t-3xl shadow-2xl flex flex-col
                   sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[440px] sm:max-h-none sm:rounded-none sm:rounded-l-3xl animate-slideUp"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900 truncate">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className={btnIcon}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 pt-3 border-t border-slate-100 bg-white" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

const ConfirmDialog: React.FC<{ title: string; message: string; confirmText?: string; onConfirm: () => void; onCancel: () => void }> = ({ title, message, confirmText = 'Delete', onConfirm, onCancel }) => {
  const { dialogProps } = useDialog({ onClose: onCancel, label: title });
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div {...dialogProps} onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
        <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className={`${btnSecondary} flex-1`}>Cancel</button>
          <button type="button" onClick={onConfirm} className={`${btnDanger} flex-1`}>{confirmText}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─── Person card (view + edit + password + delete) ───────────────────────────

const PersonSheet: React.FC<{
  user: User; me: User; users: User[]; states: StateNode[]; districts: DistrictNode[]; areas: AreaNode[];
  onClose: () => void; onUpdate?: (u: User) => void; onDelete?: (id: string) => void;
}> = ({ user, me, users, states, districts, areas, onClose, onUpdate, onDelete }) => {
  const editable = canEditUser(me, user) && !!onUpdate;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<User>({ ...user, password: '' });
  const [showPw, setShowPw] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => { setDraft({ ...user, password: '' }); setEditing(false); }, [user]);

  const reportsTo = users.find((u) => u.id === user.reportsToId);
  const location = [user.areaName, user.district, user.state].filter(Boolean).join(' · ');

  // Area implies its district and state (same rule as before).
  const setArea = (areaName: string) => {
    const a = areas.find((x) => x.name === areaName);
    setDraft((d) => ({ ...d, areaName, district: a?.districtName ?? d.district, state: a?.stateName ?? d.state }));
  };

  const districtOptions = districts.filter((d) => !draft.state || matchLoc(d.stateName, draft.state));
  const areaOptions = areas.filter((a) => !draft.district || matchLoc(a.districtName, draft.district));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const payload: User = { ...draft, name: draft.name.trim() };
    if (!payload.password) delete payload.password; // blank = keep current
    onUpdate?.(payload);
    setEditing(false);
  };

  return (
    <>
      <Sheet
        title={editing ? 'Edit person' : user.name}
        onClose={onClose}
        footer={
          editing ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => { setDraft({ ...user, password: '' }); setEditing(false); }} className={`${btnSecondary} flex-1`}>Cancel</button>
              <button type="submit" form="person-edit-form" className={`${btnPrimary} flex-1`}>Save changes</button>
            </div>
          ) : editable ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirm(true)} className={btnDanger} aria-label={`Delete ${user.name}`}><Trash2 className="w-4 h-4" /></button>
              <button type="button" onClick={() => setEditing(true)} className={`${btnPrimary} flex-1`}><Pencil className="w-4 h-4" /> Edit</button>
            </div>
          ) : undefined
        }
      >
        {!editing ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} inactive={user.isActive === false} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <RoleBadge role={user.role} long />
                  {user.isActive === false && <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md">Disabled</span>}
                </div>
                {location && <p className="text-sm text-slate-600 mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" />{location}</p>}
              </div>
            </div>

            <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</dt>
                <dd className="flex items-center gap-1 min-w-0">
                  <code className="text-sm font-semibold text-slate-900 truncate">@{user.username}</code>
                  <CopyButton value={user.username} label="username" />
                </dd>
              </div>
              {user.phone && (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</dt>
                  <dd className="text-sm font-semibold text-slate-900 tabular-nums">{user.phone}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reports to</dt>
                <dd className="text-sm font-semibold text-slate-900 text-right">{reportsTo ? reportsTo.name : user.role === 'Admin' ? '—' : 'Assigned automatically'}</dd>
              </div>
              {user.createdAt && (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">Added</dt>
                  <dd className="text-sm font-semibold text-slate-900 tabular-nums">{user.createdAt}</dd>
                </div>
              )}
            </dl>

            <p className="text-xs text-slate-500 flex items-start gap-1.5"><KeyRound className="w-3.5 h-3.5 mt-0.5 shrink-0" />Passwords are never shown. To hand out a login, set a new password from Edit and share it directly.</p>
          </div>
        ) : (
          <form id="person-edit-form" onSubmit={save} className="space-y-4">
            <div>
              <label className={labelCls} htmlFor="pe-name">Full name</label>
              <input id="pe-name" className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="pe-phone">Phone</label>
                <input id="pe-phone" className={`${inputCls} tabular-nums`} type="tel" value={draft.phone || ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </div>
              <div>
                <label className={labelCls} htmlFor="pe-status">Status</label>
                <select id="pe-status" className={inputCls} value={draft.isActive === false ? 'off' : 'on'} onChange={(e) => setDraft({ ...draft, isActive: e.target.value === 'on' })}>
                  <option value="on">Active</option>
                  <option value="off">Disabled</option>
                </select>
              </div>
            </div>

            {me.role === 'Admin' && (
              <div>
                <label className={labelCls} htmlFor="pe-role">Role</label>
                <select id="pe-role" className={inputCls} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}>
                  {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
            )}

            {draft.role !== 'Admin' && (
              <div>
                <label className={labelCls} htmlFor="pe-state">State</label>
                <select id="pe-state" className={inputCls} value={draft.state || ''} onChange={(e) => setDraft({ ...draft, state: e.target.value, district: '', areaName: '' })}>
                  <option value="">Select state</option>
                  {states.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            )}
            {NEEDS_DISTRICT(draft.role) && (
              <div>
                <label className={labelCls} htmlFor="pe-district">District</label>
                <select id="pe-district" className={inputCls} value={draft.district || ''} onChange={(e) => setDraft({ ...draft, district: e.target.value, areaName: '' })}>
                  <option value="">Select district</option>
                  {districtOptions.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
            )}
            {NEEDS_AREA(draft.role) && (
              <div>
                <label className={labelCls} htmlFor="pe-area">Area</label>
                <select id="pe-area" className={inputCls} value={draft.areaName || ''} onChange={(e) => setArea(e.target.value)}>
                  <option value="">Select area</option>
                  {areaOptions.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls} htmlFor="pe-password">New password</label>
              <div className="relative">
                <input id="pe-password" className={`${inputCls} pr-12`} type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Leave blank to keep current" value={draft.password || ''} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className={`${btnIcon} absolute right-0 top-0`}>{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
          </form>
        )}
      </Sheet>

      {confirm && (
        <ConfirmDialog
          title={`Delete ${user.name}?`}
          message="This removes their login permanently. Registrations they made are kept."
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); onDelete?.(user.id); onClose(); }}
        />
      )}
    </>
  );
};

// ─── Add person (3 steps: who → role → where) ────────────────────────────────

interface AddPreset { role?: UserRole; stateName?: string; districtName?: string; areaName?: string }

const AddPersonSheet: React.FC<{
  me: User; users: User[]; states: StateNode[]; districts: DistrictNode[]; areas: AreaNode[]; preset: AddPreset;
  onClose: () => void; onAddUser: (u: User) => void; onAddDistrict?: (d: DistrictNode) => void; onAddArea?: (a: AreaNode) => void;
}> = ({ me, users, states, districts, areas, preset, onClose, onAddUser, onAddDistrict, onAddArea }) => {
  const roles = allowedRolesFor(me);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(preset.role && roles.includes(preset.role) ? preset.role : (roles.includes('CF') ? 'CF' : roles[0]));
  const [stateName, setStateName] = useState(preset.stateName || me.state || states[0]?.name || '');
  const [districtName, setDistrictName] = useState(preset.districtName || me.district || '');
  const [newDistrict, setNewDistrict] = useState('');
  const [areaName, setAreaName] = useState(preset.areaName || (me.role === 'Area Manager' ? me.areaName || '' : ''));
  const [newArea, setNewArea] = useState('');
  const [password] = useState(() => `Pwd@${Math.floor(1000 + Math.random() * 9000)}`);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Non-admins are pinned to their own posting, same as before.
  const lockState = me.role !== 'Admin';
  const lockDistrict = me.role === 'District Manager' || me.role === 'Area Manager';
  const lockArea = me.role === 'Area Manager';

  const stateOptions = me.role === 'Admin' ? states : states.filter((s) => matchLoc(s.name, me.state));
  const districtOptions = districts.filter((d) => matchLoc(d.stateName, stateName) || states.find((s) => s.name === stateName)?.id === d.stateId);
  const areaOptions = areas.filter((a) => matchLoc(a.districtName, districtName === '__new__' ? '' : districtName));

  useEffect(() => {
    if (!usernameTouched) setUsername(name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20));
  }, [name, usernameTouched]);

  const effectiveDistrict = districtName === '__new__' ? newDistrict.trim() : districtName;
  const effectiveArea = areaName === '__new__' ? newArea.trim() : areaName;

  const reportsToPreview = useMemo(() => {
    if (role === 'District Manager') return users.find((u) => u.role === 'State Manager' && matchLoc(u.state, stateName))?.name;
    if (role === 'Area Manager') return users.find((u) => u.role === 'District Manager' && matchLoc(u.district, effectiveDistrict))?.name
      || users.find((u) => u.role === 'State Manager' && matchLoc(u.state, stateName))?.name;
    if (role === 'CF' || role === 'JCF') return users.find((u) => u.role === 'Area Manager' && matchLoc(u.areaName, effectiveArea))?.name
      || users.find((u) => u.role === 'District Manager' && matchLoc(u.district, effectiveDistrict))?.name
      || users.find((u) => u.role === 'State Manager' && matchLoc(u.state, stateName))?.name;
    return undefined;
  }, [role, users, stateName, effectiveDistrict, effectiveArea]);

  const usernameTaken = users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  const step1Ok = name.trim().length >= 2 && username.trim().length >= 3 && !usernameTaken;
  const whereOk = role === 'Admin' || (
    !!stateName &&
    (!NEEDS_DISTRICT(role) || !!effectiveDistrict) &&
    (!NEEDS_AREA(role) || !!effectiveArea)
  );

  const submit = () => {
    setError(null);
    if (!step1Ok || !whereOk) { setError('Fill in the highlighted fields.'); return; }
    const parentState = states.find((s) => s.name === stateName);

    // Create a missing district / area first so the person has a real node to
    // hang from — the same order the previous screen used.
    if (role === 'District Manager' && districtName === '__new__' && onAddDistrict) {
      onAddDistrict({ id: `dist-${Date.now()}`, stateId: parentState?.id || `state-${Date.now()}`, stateName: stateName || parentState?.name || 'Telangana', name: effectiveDistrict, managerId: '', managerName: '' });
    }
    if (NEEDS_AREA(role) && areaName === '__new__' && onAddArea) {
      const parentDist = districts.find((d) => d.name === effectiveDistrict) || districts.find((d) => matchLoc(d.name, effectiveDistrict));
      onAddArea({ id: `area-${Date.now()}`, districtId: parentDist?.id || `dist-${Date.now()}`, districtName: effectiveDistrict || parentDist?.name || '', stateName: stateName || parentDist?.stateName || 'Telangana', name: effectiveArea, managerId: '', managerName: '' });
    }

    // Best-effort parent; the server reconciles the chain authoritatively.
    let reportsToId = me.id;
    if (role === 'District Manager') reportsToId = users.find((u) => u.role === 'State Manager' && matchLoc(u.state, stateName))?.id || reportsToId;
    else if (role === 'Area Manager') reportsToId = users.find((u) => u.role === 'District Manager' && matchLoc(u.district, effectiveDistrict))?.id
      || users.find((u) => u.role === 'State Manager' && matchLoc(u.state, stateName))?.id || reportsToId;
    else if (role === 'CF' || role === 'JCF') reportsToId = users.find((u) => u.role === 'Area Manager' && matchLoc(u.areaName, effectiveArea))?.id
      || users.find((u) => u.role === 'District Manager' && matchLoc(u.district, effectiveDistrict))?.id
      || users.find((u) => u.role === 'State Manager' && matchLoc(u.state, stateName))?.id || reportsToId;

    const cleanUsername = username.trim().toLowerCase();
    onAddUser({
      id: `usr-${Date.now()}`,
      name: name.trim(),
      username: cleanUsername,
      password,
      role,
      email: `${cleanUsername}@awdpipe.org`,
      phone: phone.trim() || '+91 98765 00000',
      isActive: true,
      state: role === 'Admin' ? undefined : stateName,
      district: NEEDS_DISTRICT(role) ? effectiveDistrict : undefined,
      areaName: NEEDS_AREA(role) ? effectiveArea : undefined,
      reportsToId,
      createdById: me.id,
      createdAt: new Date().toISOString().split('T')[0],
    });
    onClose();
  };

  const StepDots = () => (
    <ol className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500" aria-label="Progress">
      {(['Who', 'Role', 'Where'] as const).map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] tabular-nums ${step === i + 1 ? 'bg-emerald-700 text-white' : step > i + 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{i + 1}</span>
          <span className={step === i + 1 ? 'text-slate-900' : ''}>{s}</span>
          {i < 2 && <ChevronRight className="w-3 h-3 text-slate-300" />}
        </li>
      ))}
    </ol>
  );

  return (
    <Sheet
      title="Add person"
      onClose={onClose}
      footer={
        <div className="space-y-2">
          {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
          <div className="flex gap-2">
            {step > 1 && <button type="button" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} className={btnSecondary}>Back</button>}
            {step < 3 ? (
              <button type="button" disabled={step === 1 && !step1Ok} onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)} className={`${btnPrimary} flex-1`}>Continue <ChevronRight className="w-4 h-4" /></button>
            ) : (
              <button type="button" disabled={!whereOk} onClick={submit} className={`${btnPrimary} flex-1`}><Check className="w-4 h-4" /> Create login</button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <StepDots />

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls} htmlFor="ap-name">Full name</label>
              <input id="ap-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pushpalatha" autoFocus />
            </div>
            <div>
              <label className={labelCls} htmlFor="ap-username">Username</label>
              <input id="ap-username" className={`${inputCls} ${usernameTaken ? 'border-red-400' : ''}`} value={username} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={(e) => { setUsernameTouched(true); setUsername(e.target.value.toLowerCase().replace(/\s+/g, '')); }} placeholder="lowercase, no spaces" />
              {usernameTaken ? <p className="text-xs font-semibold text-red-700 mt-1">That username is already taken.</p>
                : <p className="text-xs text-slate-500 mt-1">Suggested from the name — they will type this to sign in.</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="ap-phone">Phone <span className="normal-case font-semibold text-slate-400">(optional)</span></label>
              <input id="ap-phone" className={`${inputCls} tabular-nums`} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2" role="radiogroup" aria-label="Role">
            {roles.map((r) => (
              <button
                key={r} type="button" role="radio" aria-checked={role === r}
                onClick={() => { setRole(r); if (!NEEDS_AREA(r)) setAreaName(''); if (!NEEDS_DISTRICT(r)) setDistrictName(''); }}
                className={`w-full text-left flex items-center gap-3 rounded-2xl border px-4 min-h-[56px] transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${role === r ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${role === r ? 'border-emerald-700 bg-emerald-700' : 'border-slate-300'}`} />
                <span className="flex-1">
                  <span className="block text-sm font-bold text-slate-900">{ROLE_LABEL[r]}</span>
                  <span className="block text-xs text-slate-500">
                    {r === 'Admin' ? 'Full access to everything' : r === 'State Manager' ? 'Runs a state' : r === 'District Manager' ? 'Runs a district' : r === 'Area Manager' ? 'Runs an area and its field staff' : 'Registers and monitors pipes in one area'}
                  </span>
                </span>
                <RoleBadge role={r} />
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {role === 'Admin' ? (
              <p className="text-sm text-slate-600">Admins are not tied to a location.</p>
            ) : (
              <>
                <div>
                  <label className={labelCls} htmlFor="ap-state">State</label>
                  <select id="ap-state" className={inputCls} value={stateName} disabled={lockState} onChange={(e) => { setStateName(e.target.value); setDistrictName(''); setAreaName(''); }}>
                    {stateOptions.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                {NEEDS_DISTRICT(role) && (
                  <div>
                    <label className={labelCls} htmlFor="ap-district">District</label>
                    <select id="ap-district" className={inputCls} value={districtName} disabled={lockDistrict} onChange={(e) => { setDistrictName(e.target.value); setAreaName(''); }}>
                      <option value="">Select district</option>
                      {districtOptions.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                      {!lockDistrict && <option value="__new__">+ New district…</option>}
                    </select>
                    {districtName === '__new__' && <input className={`${inputCls} mt-2`} value={newDistrict} onChange={(e) => setNewDistrict(e.target.value)} placeholder="New district name" autoFocus />}
                  </div>
                )}
                {NEEDS_AREA(role) && (
                  <div>
                    <label className={labelCls} htmlFor="ap-area">Area</label>
                    <select id="ap-area" className={inputCls} value={areaName} disabled={lockArea || !effectiveDistrict} onChange={(e) => setAreaName(e.target.value)}>
                      <option value="">{effectiveDistrict ? 'Select area' : 'Choose a district first'}</option>
                      {areaOptions.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                      {!lockArea && effectiveDistrict && <option value="__new__">+ New area…</option>}
                    </select>
                    {areaName === '__new__' && <input className={`${inputCls} mt-2`} value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="New area name" autoFocus />}
                  </div>
                )}
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  Will report to <strong className="text-slate-900">{reportsToPreview || 'the next manager up (assigned automatically)'}</strong>.
                </p>
              </>
            )}

            <div>
              <label className={labelCls} htmlFor="ap-password">Password to hand over</label>
              <div className="relative">
                <input id="ap-password" readOnly className={`${inputCls} pr-24 font-mono`} type={showPw ? 'text' : 'password'} value={password} />
                <div className="absolute right-0 top-0 flex">
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className={btnIcon}>{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  <CopyButton value={password} label="password" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">Generated for you. Copy it now — it cannot be viewed again after saving.</p>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};

// ─── Node name sheet (add / rename a state, district or area) ─────────────────

const NodeNameSheet: React.FC<{ title: string; initial?: string; placeholder: string; onClose: () => void; onSave: (name: string) => void }> = ({ title, initial = '', placeholder, onClose, onSave }) => {
  const [value, setValue] = useState(initial);
  const ok = value.trim().length >= 2;
  return (
    <Sheet title={title} onClose={onClose} footer={<button type="button" disabled={!ok} onClick={() => { onSave(value.trim()); onClose(); }} className={`${btnPrimary} w-full`}>Save</button>}>
      <label className={labelCls} htmlFor="node-name">Name</label>
      <input id="node-name" className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && ok) { onSave(value.trim()); onClose(); } }} />
    </Sheet>
  );
};

// ─── Rows ─────────────────────────────────────────────────────────────────────

const PersonRow: React.FC<{ user: User; onOpen: () => void; subtitle?: string }> = ({ user, onOpen, subtitle }) => (
  <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 px-3 min-h-[56px] rounded-xl hover:bg-slate-50 active:bg-slate-100 transition text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
    <Avatar name={user.name} inactive={user.isActive === false} />
    <span className="flex-1 min-w-0">
      <span className={`block text-sm font-bold truncate ${user.isActive === false ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{user.name}</span>
      <span className="block text-xs text-slate-500 truncate">{subtitle ?? `@${user.username}`}</span>
    </span>
    <RoleBadge role={user.role} />
    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
  </button>
);

/** A node's manager slot: the person if there is one, otherwise a clear gap. */
const ManagerChip: React.FC<{ user?: User; fallbackName?: string; roleLabel: string; onOpen?: () => void; onAssign?: () => void }> = ({ user, fallbackName, roleLabel, onOpen, onAssign }) => {
  if (user) {
    return (
      <button type="button" onClick={onOpen} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-700 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-md">
        <UserRound className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">{roleLabel}:</span> {user.name}
      </button>
    );
  }
  if (fallbackName) return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600"><UserRound className="w-3.5 h-3.5 text-slate-400" />{roleLabel}: {fallbackName}</span>;
  return onAssign
    ? <button type="button" onClick={onAssign} className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 min-h-[44px] hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"><Plus className="w-3 h-3" /> Assign {roleLabel}</button>
    : <span className="text-xs font-semibold text-slate-500">No {roleLabel.toLowerCase()} yet</span>;
};

/** Overflow menu for a node: rename, add child, add person here, delete. */
const NodeMenu: React.FC<{ label: string; items: { label: string; onClick: () => void; danger?: boolean }[] }> = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  if (items.length === 0) return null;
  return (
    <div className="relative">
      <button type="button" aria-label={`Actions for ${label}`} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} className={btnIcon}><MoreHorizontal className="w-5 h-5" /></button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-30 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/10 p-1.5 animate-fadeIn">
          {items.map((it) => (
            <button key={it.label} role="menuitem" type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }} className={`w-full text-left text-sm font-semibold rounded-xl px-3 min-h-[44px] flex items-center gap-2 transition ${it.danger ? 'text-red-700 hover:bg-red-50' : 'text-slate-800 hover:bg-slate-50'}`}>
              {it.danger ? <Trash2 className="w-4 h-4" /> : it.label.startsWith('Rename') ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const NodeRow: React.FC<{
  depth: 0 | 1 | 2; icon: React.ReactNode; name: string; meta: string; expanded: boolean; onToggle: () => void;
  manager: React.ReactNode; menu: React.ReactNode; children?: React.ReactNode;
}> = ({ depth, icon, name, meta, expanded, onToggle, manager, menu, children }) => (
  <li className={depth === 0 ? '' : 'border-l-2 border-slate-100 ml-4 sm:ml-5'}>
    <div className={`flex items-center gap-1 rounded-2xl ${depth === 0 ? 'bg-white border border-slate-200 shadow-sm px-2' : 'pl-2 pr-1'}`}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex-1 min-w-0 flex items-center gap-2.5 min-h-[56px] text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
        <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${depth === 0 ? 'bg-amber-50 text-amber-800' : depth === 1 ? 'bg-blue-50 text-blue-700' : 'bg-teal-50 text-teal-700'}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${depth === 0 ? 'text-base font-extrabold text-slate-900' : 'text-sm font-bold text-slate-900'}`}>{name}</span>
          <span className="block text-xs text-slate-500 tabular-nums truncate">{meta}</span>
        </span>
      </button>
      {menu}
    </div>
    <div className={`${depth === 0 ? 'pl-4 sm:pl-5' : 'pl-3'} pt-1`}>{manager}</div>
    {expanded && <div className="pt-1">{children}</div>}
  </li>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

type SheetState =
  | { kind: 'person'; userId: string }
  | { kind: 'add'; preset: AddPreset }
  | { kind: 'node-add'; type: 'state' | 'district' | 'area'; parent?: StateNode | DistrictNode }
  | { kind: 'node-rename'; type: 'state' | 'district' | 'area'; item: StateNode | DistrictNode | AreaNode }
  | null;

export const HierarchyManager: React.FC<HierarchyManagerProps> = ({
  states, districts, areas, users, currentUser: me,
  onAddUser, onUpdateUser, onDeleteUser,
  onUpdateState, onUpdateDistrict, onUpdateArea,
  onAddState, onAddDistrict, onAddArea,
  onDeleteState, onDeleteDistrict, onDeleteArea,
  onOpenDevTools,
}) => {
  const isAdmin = me.role === 'Admin', isSM = me.role === 'State Manager', isDM = me.role === 'District Manager', isAM = me.role === 'Area Manager';

  // ── Scope (same rules as before, without the selection gating) ──
  const visibleStates = useMemo(() => isAdmin ? states : states.filter((s) => matchLoc(s.name, me.state)), [states, isAdmin, me.state]);
  const districtsOf = (st: StateNode) => districts.filter((d) => (d.stateId === st.id || matchLoc(d.stateName, st.name)) && (!(isDM || isAM) || matchLoc(d.name, me.district)));
  const areasOf = (dt: DistrictNode) => areas.filter((a) => (a.districtId === dt.id || matchLoc(a.districtName, dt.name)) && (!isAM || matchLoc(a.name, me.areaName)));
  const visibleUsers = useMemo(() => users.filter((u) => canSeeUser(me, u)), [users, me]);

  const smOf = (st: StateNode) => visibleUsers.find((u) => u.role === 'State Manager' && matchLoc(u.state, st.name));
  const dmOf = (dt: DistrictNode) => visibleUsers.find((u) => u.role === 'District Manager' && matchLoc(u.district, dt.name));
  const amOf = (ar: AreaNode) => visibleUsers.find((u) => u.role === 'Area Manager' && u.areaName && matchLoc(u.areaName, ar.name));
  const staffOf = (ar: AreaNode) => visibleUsers.filter((u) => (u.role === 'CF' || u.role === 'JCF') && u.areaName && matchLoc(u.areaName, ar.name));

  // Anyone the tree could not place still has to be reachable.
  const placedIds = useMemo(() => {
    const ids = new Set<string>();
    visibleStates.forEach((st) => {
      const sm = smOf(st); if (sm) ids.add(sm.id);
      districtsOf(st).forEach((dt) => {
        const dm = dmOf(dt); if (dm) ids.add(dm.id);
        areasOf(dt).forEach((ar) => { const am = amOf(ar); if (am) ids.add(am.id); staffOf(ar).forEach((u) => ids.add(u.id)); });
      });
    });
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleStates, districts, areas, visibleUsers]);
  const admins = visibleUsers.filter((u) => u.role === 'Admin');
  const unplaced = visibleUsers.filter((u) => u.role !== 'Admin' && !placedIds.has(u.id));

  // ── UI state ──
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Small hierarchies open fully; large ones open to the state level.
    const total = states.length + districts.length + areas.length;
    return new Set(total <= 14 ? [...states, ...districts, ...areas].map((n) => n.id) : states.map((n) => n.id));
  });
  const toggle = (id: string) => setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [sheet, setSheet] = useState<SheetState>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const canAddPeople = allowedRolesFor(me).length > 0;
  const stateOps = isAdmin || isSM;
  const districtOps = isAdmin || isSM || isDM;
  const areaOps = isAdmin || isSM || isDM || isAM;

  const askDelete = (type: 'state' | 'district' | 'area', item: { id: string; name: string }) => {
    const hasChildren =
      (type === 'state' && districts.some((d) => d.stateId === item.id || d.stateName === item.name)) ||
      (type === 'district' && areas.some((a) => a.districtId === item.id || a.districtName === item.name));
    setConfirm({
      title: `Delete ${type} "${item.name}"?`,
      message: hasChildren
        ? `Everything inside it — locations and the people assigned to them — is deleted with it. This cannot be undone.`
        : `This cannot be undone.`,
      onConfirm: () => {
        setConfirm(null);
        if (type === 'state') onDeleteState?.(item.id);
        if (type === 'district') onDeleteDistrict?.(item.id);
        if (type === 'area') onDeleteArea?.(item.id);
      },
    });
  };

  // ── Search: a flat people list is clearer than a pruned tree ──
  const q = query.trim().toLowerCase();
  const results = q ? visibleUsers.filter((u) =>
    u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || ROLE_LABEL[u.role].toLowerCase().includes(q) ||
    (u.areaName || '').toLowerCase().includes(q) || (u.district || '').toLowerCase().includes(q)) : [];

  const scopeLabel = isAdmin ? 'All regions' : isSM ? me.state : isDM ? me.district : isAM ? me.areaName : me.name;
  const openPerson = (u: User) => setSheet({ kind: 'person', userId: u.id });
  const sheetUser = sheet?.kind === 'person' ? users.find((u) => u.id === sheet.userId) : undefined;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Team</h1>
            <p className="text-sm text-slate-600 mt-0.5 tabular-nums">{scopeLabel} · {visibleUsers.length} {visibleUsers.length === 1 ? 'person' : 'people'}</p>
          </div>
          {canAddPeople && (
            <button type="button" onClick={() => setSheet({ kind: 'add', preset: {} })} className={btnPrimary}><Plus className="w-4 h-4" /> Add person</button>
          )}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people by name, username, role or place" aria-label="Search people" className={`${inputCls} pl-10`} />
        </div>
      </header>

      {/* Search results replace the tree while typing */}
      {q ? (
        <section aria-live="polite" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5">
          {results.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-8">No one matches “{query}”.</p>
          ) : results.map((u) => <PersonRow key={u.id} user={u} onOpen={() => openPerson(u)} subtitle={[u.areaName, u.district, u.state].filter(Boolean).join(' · ') || `@${u.username}`} />)}
        </section>
      ) : (
        <>
          {isAdmin && admins.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 pt-2 pb-1 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Administrators</h2>
              {admins.map((u) => <PersonRow key={u.id} user={u} onOpen={() => openPerson(u)} />)}
            </section>
          )}

          {visibleStates.length === 0 ? (
            <section className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
              <Map className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-600">No states yet. The tree starts with one.</p>
              {stateOps && <button type="button" onClick={() => setSheet({ kind: 'node-add', type: 'state' })} className={btnPrimary}><Plus className="w-4 h-4" /> Add state</button>}
            </section>
          ) : (
            <ul className="space-y-3">
              {visibleStates.map((st) => {
                const sm = smOf(st); const dts = districtsOf(st);
                return (
                  <NodeRow key={st.id} depth={0} icon={<Map className="w-4 h-4" />} name={st.name} meta={`${dts.length} ${dts.length === 1 ? 'district' : 'districts'}`}
                    expanded={expanded.has(st.id)} onToggle={() => toggle(st.id)}
                    manager={<ManagerChip user={sm} fallbackName={st.managerName} roleLabel="State Manager" onOpen={sm ? () => openPerson(sm) : undefined}
                      onAssign={isAdmin ? () => setSheet({ kind: 'add', preset: { role: 'State Manager', stateName: st.name } }) : undefined} />}
                    menu={<NodeMenu label={st.name} items={[
                      ...(districtOps ? [{ label: 'Add district', onClick: () => setSheet({ kind: 'node-add', type: 'district', parent: st }) }] : []),
                      ...(canAddPeople ? [{ label: 'Add person here', onClick: () => setSheet({ kind: 'add', preset: { stateName: st.name } }) }] : []),
                      ...(stateOps ? [{ label: 'Rename', onClick: () => setSheet({ kind: 'node-rename', type: 'state', item: st }) }, { label: 'Delete state', danger: true, onClick: () => askDelete('state', st) }] : []),
                    ]} />}
                  >
                    {dts.length === 0 ? (
                      <p className="text-xs text-slate-500 pl-6 py-3">No districts in {st.name} yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {dts.map((dt) => {
                          const dm = dmOf(dt); const ars = areasOf(dt);
                          const staffCount = ars.reduce((n, a) => n + staffOf(a).length, 0);
                          return (
                            <NodeRow key={dt.id} depth={1} icon={<Building2 className="w-4 h-4" />} name={dt.name} meta={`${ars.length} ${ars.length === 1 ? 'area' : 'areas'} · ${staffCount} field staff`}
                              expanded={expanded.has(dt.id)} onToggle={() => toggle(dt.id)}
                              manager={<ManagerChip user={dm} fallbackName={dt.managerName} roleLabel="District Manager" onOpen={dm ? () => openPerson(dm) : undefined}
                                onAssign={(isAdmin || isSM) ? () => setSheet({ kind: 'add', preset: { role: 'District Manager', stateName: st.name, districtName: dt.name } }) : undefined} />}
                              menu={<NodeMenu label={dt.name} items={[
                                ...(areaOps ? [{ label: 'Add area', onClick: () => setSheet({ kind: 'node-add', type: 'area', parent: dt }) }] : []),
                                ...(canAddPeople ? [{ label: 'Add person here', onClick: () => setSheet({ kind: 'add', preset: { stateName: st.name, districtName: dt.name } }) }] : []),
                                ...(districtOps ? [{ label: 'Rename', onClick: () => setSheet({ kind: 'node-rename', type: 'district', item: dt }) }, { label: 'Delete district', danger: true, onClick: () => askDelete('district', dt) }] : []),
                              ]} />}
                            >
                              {ars.length === 0 ? (
                                <p className="text-xs text-slate-500 pl-6 py-3">No areas in {dt.name} yet.</p>
                              ) : (
                                <ul className="space-y-1">
                                  {ars.map((ar) => {
                                    const am = amOf(ar); const staff = staffOf(ar);
                                    return (
                                      <NodeRow key={ar.id} depth={2} icon={<MapPin className="w-4 h-4" />} name={ar.name} meta={`${staff.length} field staff`}
                                        expanded={expanded.has(ar.id)} onToggle={() => toggle(ar.id)}
                                        manager={<ManagerChip user={am} fallbackName={ar.managerName} roleLabel="Area Manager" onOpen={am ? () => openPerson(am) : undefined}
                                          onAssign={(isAdmin || isSM || isDM) ? () => setSheet({ kind: 'add', preset: { role: 'Area Manager', stateName: st.name, districtName: dt.name, areaName: ar.name } }) : undefined} />}
                                        menu={<NodeMenu label={ar.name} items={[
                                          ...(canAddPeople ? [{ label: 'Add field staff here', onClick: () => setSheet({ kind: 'add', preset: { role: 'CF', stateName: st.name, districtName: dt.name, areaName: ar.name } }) }] : []),
                                          ...(areaOps ? [{ label: 'Rename', onClick: () => setSheet({ kind: 'node-rename', type: 'area', item: ar }) }, { label: 'Delete area', danger: true, onClick: () => askDelete('area', ar) }] : []),
                                        ]} />}
                                      >
                                        <div className="ml-3 pl-2 border-l-2 border-slate-100">
                                          {staff.length === 0
                                            ? <p className="text-xs text-slate-500 px-3 py-3">No field staff in {ar.name} yet.</p>
                                            : staff.map((u) => <PersonRow key={u.id} user={u} onOpen={() => openPerson(u)} />)}
                                        </div>
                                      </NodeRow>
                                    );
                                  })}
                                </ul>
                              )}
                            </NodeRow>
                          );
                        })}
                      </ul>
                    )}
                  </NodeRow>
                );
              })}
            </ul>
          )}

          {unplaced.length > 0 && (
            <section className="bg-white rounded-2xl border border-amber-200 shadow-sm p-1.5">
              <h2 className="text-xs font-bold text-amber-800 uppercase tracking-wider px-3 pt-2 pb-1">Not placed on the map</h2>
              <p className="text-xs text-slate-600 px-3 pb-2">Their recorded place doesn’t match any location above. Open one to fix its area or district.</p>
              {unplaced.map((u) => <PersonRow key={u.id} user={u} onOpen={() => openPerson(u)} subtitle={[u.areaName, u.district, u.state].filter(Boolean).join(' · ') || 'No location recorded'} />)}
            </section>
          )}

          {stateOps && visibleStates.length > 0 && (
            <button type="button" onClick={() => setSheet({ kind: 'node-add', type: 'state' })} className={`${btnSecondary} w-full border-dashed`}><Plus className="w-4 h-4" /> Add state</button>
          )}
        </>
      )}

      {isAdmin && onOpenDevTools && (
        <p className="text-center pt-2">
          <button type="button" onClick={onOpenDevTools} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 min-h-[44px] px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-lg"><Database className="w-3.5 h-3.5" /> Developer tools &amp; database</button>
        </p>
      )}

      {/* Sheets */}
      {sheet?.kind === 'person' && sheetUser && (
        <PersonSheet user={sheetUser} me={me} users={users} states={states} districts={districts} areas={areas} onClose={() => setSheet(null)} onUpdate={onUpdateUser} onDelete={onDeleteUser} />
      )}
      {sheet?.kind === 'add' && (
        <AddPersonSheet me={me} users={users} states={states} districts={districts} areas={areas} preset={sheet.preset} onClose={() => setSheet(null)} onAddUser={onAddUser} onAddDistrict={onAddDistrict} onAddArea={onAddArea} />
      )}
      {sheet?.kind === 'node-add' && (
        <NodeNameSheet
          title={sheet.type === 'state' ? 'Add state' : sheet.type === 'district' ? `Add district to ${sheet.parent?.name}` : `Add area to ${sheet.parent?.name}`}
          placeholder={sheet.type === 'state' ? 'e.g. Telangana' : sheet.type === 'district' ? 'e.g. Sangareddy' : 'e.g. Kandi'}
          onClose={() => setSheet(null)}
          onSave={(name) => {
            if (sheet.type === 'state') onAddState?.({ id: `state-${Date.now()}`, name, code: name.slice(0, 3).toUpperCase(), managerId: '', managerName: '' });
            if (sheet.type === 'district' && sheet.parent) { const st = sheet.parent as StateNode; onAddDistrict?.({ id: `dist-${Date.now()}`, stateId: st.id, stateName: st.name, name, managerId: '', managerName: '' }); setExpanded((p) => new Set(p).add(st.id)); }
            if (sheet.type === 'area' && sheet.parent) { const dt = sheet.parent as DistrictNode; onAddArea?.({ id: `area-${Date.now()}`, districtId: dt.id, districtName: dt.name, stateName: dt.stateName, name, managerId: '', managerName: '' }); setExpanded((p) => new Set(p).add(dt.id)); }
          }}
        />
      )}
      {sheet?.kind === 'node-rename' && (
        <NodeNameSheet
          title={`Rename ${sheet.type}`} initial={sheet.item.name} placeholder="New name"
          onClose={() => setSheet(null)}
          onSave={(name) => {
            if (sheet.type === 'state') onUpdateState?.({ ...(sheet.item as StateNode), name });
            if (sheet.type === 'district') onUpdateDistrict?.({ ...(sheet.item as DistrictNode), name });
            if (sheet.type === 'area') onUpdateArea?.({ ...(sheet.item as AreaNode), name });
          }}
        />
      )}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  );
};
