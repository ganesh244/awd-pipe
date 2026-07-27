import React, { useState } from 'react';
import { User, StateNode, DistrictNode, AreaNode, UserRole } from '../types';
import { Building2, MapPin, Map, Users, Plus, Trash2, Edit2, Shield, UserPlus, Key, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';

interface HierarchyManagerProps {
  states: StateNode[];
  districts: DistrictNode[];
  areas: AreaNode[];
  users: User[];
  currentUser: User;
  onAddUser: (user: User) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onDeleteUser?: (userId: string) => void;
}

export const HierarchyManager: React.FC<HierarchyManagerProps> = ({
  states,
  districts,
  areas,
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  // Scoping based on logged in user
  const isDM = currentUser.role === 'District Manager';
  const isAM = currentUser.role === 'Area Manager';
  const isSM = currentUser.role === 'State Manager';
  const isAdmin = currentUser.role === 'Admin';

  const defaultStateId = isDM || isAM || isSM 
    ? states.find(s => s.name === currentUser.state)?.id || states[0]?.id || '' 
    : states[0]?.id || '';
  
  const defaultDistrictId = isDM || isAM 
    ? districts.find(d => d.name === currentUser.district)?.id || districts[0]?.id || '' 
    : districts.find(d => d.stateId === defaultStateId)?.id || '';

  const [selectedStateId, setSelectedStateId] = useState<string>(defaultStateId);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(defaultDistrictId);

  // Modals state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Add user form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(isDM ? 'Area Manager' : isAM ? 'CF' : 'Area Manager');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [targetAreaName, setTargetAreaName] = useState<string>('');

  // Filter lists based on role and selection
  const visibleStates = states.filter(st => {
    if (isAdmin) return true;
    return st.name === currentUser.state;
  });

  const visibleDistricts = districts.filter(d => {
    if (d.stateId !== selectedStateId) return false;
    if (isDM || isAM) return d.name === currentUser.district;
    return true;
  });

  const visibleAreas = areas.filter(a => {
    if (a.districtId !== selectedDistrictId) return false;
    if (isAM) return a.name === currentUser.areaName;
    return true;
  });

  const selectedState = states.find(s => s.id === selectedStateId);
  const selectedDistrict = districts.find(d => d.id === selectedDistrictId);

  // When opening add modal, pre-fill defaults
  const openAddModal = (defaultRole?: UserRole, defaultArea?: string) => {
    setNewUserRole(defaultRole || (isDM ? 'Area Manager' : isAM ? 'CF' : 'Area Manager'));
    setTargetAreaName(defaultArea || visibleAreas[0]?.name || '');
    setNewUserName('');
    setNewUserUsername('');
    setNewUserPassword(`Pwd@${Math.floor(1000 + Math.random() * 9000)}`);
    setNewUserEmail('');
    setNewUserPhone('');
    setIsAddUserOpen(true);
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPassword.trim()) return;

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: newUserName.trim(),
      username: newUserUsername.trim().toLowerCase(),
      password: newUserPassword.trim(),
      role: newUserRole,
      email: newUserEmail || `${newUserUsername.toLowerCase()}@awdpipe.org`,
      phone: newUserPhone || '+91 98765 00000',
      isActive: true,
      state: selectedState?.name,
      district: selectedDistrict?.name,
      areaName: (newUserRole === 'Area Manager' || newUserRole === 'CF' || newUserRole === 'JCF') ? targetAreaName : undefined,
      reportsToId: currentUser.id,
      createdById: currentUser.id,
      createdAt: new Date().toISOString().split('T')[0],
    };

    onAddUser(newUser);
    setIsAddUserOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (onUpdateUser) {
      onUpdateUser(editingUser);
    }
    setEditingUser(null);
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswordMap(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">
      
      {/* HEADER BANNER WITH PERMISSIONS INFO */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-purple-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-black uppercase tracking-wide">
              Hierarchy & Role Management
            </h1>
            <span className="bg-purple-500/20 text-purple-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-purple-500/30">
              {currentUser.role} View
            </span>
          </div>
          <p className="text-xs text-purple-200">
            {isAdmin && 'Global Admin Access: Create and manage State Managers, District Managers, Area Managers, CFs and JCFs.'}
            {isSM && `State Manager Scope (${currentUser.state}): Manage District Managers, Area Managers, and Field Staff.`}
            {isDM && `District Manager Scope (${currentUser.district}): Assign Area Managers, set CF/JCF roles, and manage login passwords.`}
            {isAM && `Area Manager Scope (${currentUser.areaName}): Manage and assign Community Facilitators (CF) and Junior CFs (JCF).`}
          </p>
        </div>

        <button
          onClick={() => openAddModal()}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold px-4 py-3 rounded-xl transition shadow-lg shadow-purple-950/40 flex items-center gap-2 cursor-pointer border border-purple-400/30 shrink-0"
        >
          <UserPlus className="w-4 h-4 text-purple-200" />
          <span>Add Team Member / Assign Credentials</span>
        </button>
      </div>

      {/* CASCADING HIERARCHY COLUMNS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUMN 1: STATES */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-600" /> 1. States ({visibleStates.length})
            </h3>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md uppercase">
              State Level
            </span>
          </div>

          <div className="space-y-2">
            {visibleStates.map((st) => {
              const isSelected = st.id === selectedStateId;
              const stateUser = users.find((u) => u.role === 'State Manager' && u.state === st.name);

              return (
                <div
                  key={st.id}
                  onClick={() => {
                    setSelectedStateId(st.id);
                    const firstDist = districts.find((d) => d.stateId === st.id);
                    if (firstDist) setSelectedDistrictId(firstDist.id);
                  }}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-amber-50/80 border-amber-400 shadow-sm ring-1 ring-amber-400/30'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <span className="text-xs font-black text-slate-900 block">{st.name} ({st.code})</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Manager: <strong className="text-slate-800">{stateUser?.name || st.managerName || 'Unassigned'}</strong>
                    </span>
                  </div>
                  <span className="text-xs font-bold font-mono text-amber-800 bg-amber-200/60 px-2.5 py-1 rounded-lg">
                    {districts.filter((d) => d.stateId === st.id).length} Dists
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2: DISTRICTS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> 2. Districts ({visibleDistricts.length})
            </h3>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md uppercase">
              District Level
            </span>
          </div>

          <div className="space-y-2">
            {visibleDistricts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed">
                No districts available in your scope.
              </p>
            ) : (
              visibleDistricts.map((dt) => {
                const isSelected = dt.id === selectedDistrictId;
                const distUser = users.find((u) => u.role === 'District Manager' && u.district === dt.name);

                return (
                  <div
                    key={dt.id}
                    onClick={() => setSelectedDistrictId(dt.id)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-400 shadow-sm ring-1 ring-blue-400/30'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-black text-slate-900 block">{dt.name}</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        DM: <strong className="text-slate-800">{distUser?.name || dt.managerName || 'Unassigned'}</strong>
                      </span>
                    </div>
                    <span className="text-xs font-bold font-mono text-blue-800 bg-blue-200/60 px-2.5 py-1 rounded-lg">
                      {areas.filter((a) => a.districtId === dt.id).length} Areas
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 3: AREA MANAGERS & CF / JCF TEAM */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Map className="w-4 h-4 text-teal-600" /> 3. Areas & Field Teams
            </h3>
            <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md uppercase">
              Field Operations
            </span>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {visibleAreas.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed">
                No area managers configured under selected district.
              </p>
            ) : (
              visibleAreas.map((ar) => {
                const areaUser = users.find((u) => u.role === 'Area Manager' && u.areaName === ar.name);
                const fieldStaff = users.filter((u) => (u.role === 'CF' || u.role === 'JCF') && u.areaName === ar.name);

                return (
                  <div key={ar.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                    {/* Area Header */}
                    <div className="flex items-start justify-between border-b border-slate-200/80 pb-2.5">
                      <div>
                        <span className="text-xs font-black text-slate-900 block">{ar.name} Area</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] text-teal-800 font-bold bg-teal-100 px-2 py-0.5 rounded-md">
                            AM: {areaUser?.name || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                      {(isAdmin || isSM || isDM) && (
                        <button
                          onClick={() => openAddModal('CF', ar.name)}
                          className="text-[11px] font-extrabold text-teal-700 hover:text-teal-900 bg-teal-100/70 hover:bg-teal-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Staff
                        </button>
                      )}
                    </div>

                    {/* CF / JCF Field Staff List */}
                    <div className="space-y-2 pl-2 border-l-2 border-teal-500/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Assigned Facilitators ({fieldStaff.length})
                        </span>
                        <span className="text-[9px] text-slate-400 italic">Strict data scoping enabled</span>
                      </div>

                      {fieldStaff.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic py-1">No CF/JCF assigned to this area yet.</p>
                      ) : (
                        fieldStaff.map((staff) => {
                          const isJCF = staff.role === 'JCF';
                          const showPwd = showPasswordMap[staff.id] || false;

                          return (
                            <div
                              key={staff.id}
                              className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5 hover:border-teal-300 transition"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-900">{staff.name}</span>
                                  <span
                                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                      isJCF
                                        ? 'bg-lime-100 text-lime-900 border border-lime-300'
                                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    }`}
                                  >
                                    {staff.role}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {(isAdmin || isDM || isSM || isAM) && (
                                    <button
                                      onClick={() => setEditingUser(staff)}
                                      title="Edit Roles & Responsibilities"
                                      className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {(isAdmin || isDM) && onDeleteUser && (
                                    <button
                                      onClick={() => onDeleteUser(staff.id)}
                                      title="Remove User"
                                      className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Credentials preview for supervisors */}
                              <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2 py-1 rounded-lg font-mono border border-slate-100">
                                <span className="text-slate-600">ID: <strong>@{staff.username}</strong></span>
                                <div className="flex items-center gap-1.5 text-slate-700">
                                  <span>Pwd: {showPwd ? <strong>{staff.password}</strong> : '••••••••'}</span>
                                  <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility(staff.id)}
                                    className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                  >
                                    {showPwd ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* CREDENTIALS DIRECTORY FOR SUPERVISORS */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" /> Active Team Credentials Directory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribute these credentials to assigned Area Managers, Community Facilitators (CF), and Junior CFs (JCF).
            </p>
          </div>
          <span className="bg-indigo-50 text-indigo-700 font-extrabold text-xs px-3 py-1 rounded-xl border border-indigo-200">
            {users.length} Active Accounts
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {users
            .filter((u) => {
              if (isAdmin) return true;
              if (isSM) return u.state === currentUser.state;
              if (isDM) return u.district === currentUser.district;
              if (isAM) return u.areaName === currentUser.areaName;
              return u.id === currentUser.id;
            })
            .map((u) => {
              const showPwd = showPasswordMap[u.id] || false;
              return (
                <div key={u.id} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-extrabold text-xs text-slate-900">{u.name}</div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {u.areaName || u.district || u.state || 'System Admin'}
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                      {u.role}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between font-mono text-xs">
                    <span className="text-slate-700">User: <strong className="text-indigo-600">@{u.username}</strong></span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600">Pass: {showPwd ? <strong className="text-slate-900">{u.password}</strong> : '••••••••'}</span>
                      <button
                        onClick={() => togglePasswordVisibility(u.id)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                      >
                        {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* MODAL: ADD TEAM MEMBER & ASSIGN CREDENTIALS */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Assign New Role & Credentials
                </h3>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => {
                      setNewUserName(e.target.value);
                      if (!newUserUsername) {
                        setNewUserUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                      }
                    }}
                    placeholder="e.g. Ramesh Naidu"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Role *</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
                  >
                    {isAdmin && <option value="State Manager">State Manager</option>}
                    {(isAdmin || isSM) && <option value="District Manager">District Manager</option>}
                    {(isAdmin || isSM || isDM) && <option value="Area Manager">Area Manager</option>}
                    <option value="CF">Community Facilitator (CF)</option>
                    <option value="JCF">Junior CF (JCF)</option>
                  </select>
                </div>
              </div>

              {(newUserRole === 'Area Manager' || newUserRole === 'CF' || newUserRole === 'JCF') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Assign to Area *</label>
                  <select
                    value={targetAreaName}
                    onChange={(e) => setTargetAreaName(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
                  >
                    {visibleAreas.map((ar) => (
                      <option key={ar.id} value={ar.name}>
                        {ar.name} ({ar.districtName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-purple-600" /> Login Credentials Assignment
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-purple-800 mb-1">Username ID *</label>
                    <input
                      type="text"
                      required
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                      placeholder="e.g. cf_ramesh"
                      className="w-full bg-white border border-purple-300 rounded-xl p-2.5 text-xs font-mono font-bold text-purple-950 outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-purple-800 mb-1">Assigned Password *</label>
                    <input
                      type="text"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="e.g. Pwd@2026"
                      className="w-full bg-white border border-purple-300 rounded-xl p-2.5 text-xs font-mono font-bold text-purple-950 outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-purple-700 leading-normal">
                  💡 The assigned user will use this exact ID and password to sign in. They will only have access to scoped field data in their assigned jurisdiction.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Phone Contact</label>
                <input
                  type="text"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30 transition cursor-pointer"
                >
                  Confirm & Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ROLES & RESPONSIBILITIES */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Edit Role & Jurisdiction: {editingUser.name}
                </h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Role Assignment</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                  >
                    <option value="State Manager">State Manager</option>
                    <option value="District Manager">District Manager</option>
                    <option value="Area Manager">Area Manager</option>
                    <option value="CF">Community Facilitator (CF)</option>
                    <option value="JCF">Junior CF (JCF)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Account Status</label>
                  <select
                    value={editingUser.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.value === 'active' })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                  >
                    <option value="active">🟢 Active Access</option>
                    <option value="inactive">🔴 Disabled / Revoked</option>
                  </select>
                </div>
              </div>

              {(editingUser.role === 'Area Manager' || editingUser.role === 'CF' || editingUser.role === 'JCF') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Assigned Jurisdiction Area</label>
                  <select
                    value={editingUser.areaName || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, areaName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                  >
                    {areas.map((ar) => (
                      <option key={ar.id} value={ar.name}>
                        {ar.name} ({ar.districtName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-blue-600" /> Update Login Credentials
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-blue-800 mb-1">Username ID</label>
                    <input
                      type="text"
                      required
                      value={editingUser.username}
                      onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value.toLowerCase() })}
                      className="w-full bg-white border border-blue-300 rounded-xl p-2.5 text-xs font-mono font-bold text-blue-950 outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-blue-800 mb-1">Password</label>
                    <input
                      type="text"
                      required
                      value={editingUser.password}
                      onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                      className="w-full bg-white border border-blue-300 rounded-xl p-2.5 text-xs font-mono font-bold text-blue-950 outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/30 transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
