import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { User, StateNode, DistrictNode, AreaNode, UserRole } from '../types';
import { Building2, MapPin, Map, Users, Plus, Trash2, Edit2, Shield, UserPlus, Key, CheckCircle2, XCircle, Eye, EyeOff, AlertTriangle } from 'lucide-react';

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
  onSaveHierarchy?: () => void;
  hierarchyDirty?: boolean;
  isSavingHierarchy?: boolean;
  dbStatus?: 'cloud' | 'local' | 'loading';
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
  onUpdateState,
  onUpdateDistrict,
  onUpdateArea,
  onAddState,
  onAddDistrict,
  onAddArea,
  onDeleteState,
  onDeleteDistrict,
  onDeleteArea,
  onSaveHierarchy,
  hierarchyDirty = false,
  isSavingHierarchy = false,
  dbStatus = 'loading',
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

  // Custom Delete Confirmation Modal State
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmButtonText?: string;
    onConfirm: () => void;
  } | null>(null);

  const requestDeleteConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmButtonText = 'Yes, Delete Permanently'
  ) => {
    setConfirmDeleteModal({
      isOpen: true,
      title,
      message,
      confirmButtonText,
      onConfirm: () => {
        onConfirm();
        setConfirmDeleteModal(null);
      },
    });
  };
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Add user form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(isDM ? 'Area Manager' : isAM ? 'CF' : 'Area Manager');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [targetStateName, setTargetStateName] = useState<string>('');
  const [targetDistrictName, setTargetDistrictName] = useState<string>('');
  const [targetAreaName, setTargetAreaName] = useState<string>('');
  const [targetNewDistrictName, setTargetNewDistrictName] = useState<string>('');
  const [targetNewAreaName, setTargetNewAreaName] = useState<string>('');

  const [editingHierarchyItem, setEditingHierarchyItem] = useState<any>(null);
  const [editingHierarchyType, setEditingHierarchyType] = useState<'state' | 'district' | 'area' | null>(null);

  const [isAddingHierarchy, setIsAddingHierarchy] = useState(false);
  const [addingHierarchyType, setAddingHierarchyType] = useState<'state' | 'district' | 'area' | null>(null);
  const [newHierarchyName, setNewHierarchyName] = useState('');

  const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const matchLoc = (a?: string, b?: string) => {
    if (!a || !b) return false;
    const na = norm(a); const nb = norm(b);
    return na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na));
  };

  // Filter lists based on role and selection — use both ID AND name matching for robustness
  const visibleStates = states.filter(st => {
    if (isAdmin) return true;
    return matchLoc(st.name, currentUser.state);
  });

  const selectedState = states.find(s => s.id === selectedStateId);
  const selectedDistrict = districts.find(d => d.id === selectedDistrictId);

  const visibleDistricts = useMemo(() => {
    if (isDM || isAM) return districts.filter(d => matchLoc(d.name, currentUser.district));
    if (!selectedStateId && !selectedState) return [];
    return districts.filter(d => {
      // Match by stateId (if properly set)
      if (selectedStateId && d.stateId === selectedStateId) return true;
      // Fallback: match by stateName string
      if (selectedState && matchLoc(d.stateName, selectedState.name)) return true;
      return false;
    });
  }, [districts, selectedStateId, selectedState, isDM, isAM, currentUser.district]);

  const visibleAreas = useMemo(() => {
    if (isAM) return areas.filter(a => matchLoc(a.name, currentUser.areaName));
    if (!selectedDistrictId && !selectedDistrict) return [];
    return areas.filter(a => {
      if (selectedDistrictId && a.districtId === selectedDistrictId) return true;
      if (selectedDistrict && matchLoc(a.districtName, selectedDistrict.name)) return true;
      return false;
    });
  }, [areas, selectedDistrictId, selectedDistrict, isAM, currentUser.areaName]);
  const availableStateOptions = useMemo(
    () => (isAdmin ? states : visibleStates),
    [isAdmin, states, visibleStates]
  );
  const targetState = states.find((s) => s.name === targetStateName);
  const targetDistrictOptions = useMemo(
    () => districts.filter((d) => d.stateId === targetState?.id),
    [districts, targetState?.id]
  );
  const targetDistrict = targetDistrictOptions.find((d) => d.name === targetDistrictName);
  const targetAreaOptions = useMemo(
    () => areas.filter((a) => a.districtId === targetDistrict?.id),
    [areas, targetDistrict?.id]
  );
  const needsCustomDistrict = newUserRole === 'District Manager' && targetDistrictOptions.length === 0;
  const needsCustomArea = (newUserRole === 'Area Manager' || newUserRole === 'CF' || newUserRole === 'JCF') && targetAreaOptions.length === 0;
  const effectiveAreaName = targetAreaName === '__new__' ? targetNewAreaName.trim() : targetAreaName;
  const effectiveDistrictName = needsCustomDistrict ? targetNewDistrictName.trim() : targetDistrictName;
  const managerPreview = useMemo(() => {
    if (newUserRole === 'District Manager') {
      return users.find((u) => u.role === 'State Manager' && u.state === targetStateName)?.name || 'Unassigned';
    }
    if (newUserRole === 'Area Manager') {
      return users.find((u) => u.role === 'District Manager' && u.district === effectiveDistrictName)?.name || 'Unassigned';
    }
    if (newUserRole === 'CF' || newUserRole === 'JCF') {
      return users.find((u) => u.role === 'Area Manager' && u.areaName === effectiveAreaName)?.name || 'Unassigned';
    }
    return 'System Admin';
  }, [newUserRole, users, targetStateName, effectiveDistrictName, effectiveAreaName]);

  // When opening add modal, pre-fill defaults
  const openAddModal = (defaultRole?: UserRole, defaultArea?: string) => {
    const role = defaultRole || (isDM ? 'Area Manager' : isAM ? 'CF' : 'Area Manager');
    const initialStateName = selectedState?.name || availableStateOptions[0]?.name || states[0]?.name || '';
    const initialDistrictName = selectedDistrict?.name || districts.find((d) => d.stateId === selectedState?.id)?.name || '';
    const initialAreaName = defaultArea || visibleAreas[0]?.name || '';
    setNewUserRole(role);
    setTargetStateName(initialStateName);
    setTargetDistrictName(initialDistrictName);
    setTargetAreaName(initialAreaName);
    setTargetNewDistrictName('');
    setTargetNewAreaName('');
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

    let intelligentReportsToId = currentUser.id;
    const assignedState = newUserRole === 'Admin' ? undefined : targetStateName || selectedState?.name;
    const assignedDistrict = newUserRole === 'District Manager'
      ? effectiveDistrictName
      : (newUserRole === 'Area Manager' || newUserRole === 'CF' || newUserRole === 'JCF' ? effectiveDistrictName : undefined);
    const assignedArea = (newUserRole === 'Area Manager' || newUserRole === 'CF' || newUserRole === 'JCF') ? effectiveAreaName : undefined;

    if (newUserRole === 'District Manager' && !assignedDistrict) return;
    if ((newUserRole === 'Area Manager' || newUserRole === 'CF' || newUserRole === 'JCF') && (!assignedDistrict || !assignedArea)) return;

    if (newUserRole === 'District Manager' && needsCustomDistrict && onAddDistrict && targetState) {
      onAddDistrict({
        id: `dist-${Date.now()}`,
        stateId: targetState.id,
        stateName: targetState.name,
        name: assignedDistrict,
        managerId: '',
        managerName: ''
      });
    }

    if ((newUserRole === 'Area Manager' || newUserRole === 'CF' || newUserRole === 'JCF') && targetAreaName === '__new__' && onAddArea && targetDistrict && assignedArea) {
      onAddArea({
        id: `area-${Date.now()}`,
        districtId: targetDistrict.id,
        districtName: targetDistrict.name,
        stateName: targetState?.name || '',
        name: assignedArea,
        managerId: '',
        managerName: ''
      });
    }

    // Intelligent Reporting Structure:
    if (newUserRole === 'District Manager') {
      const stateManager = users.find(u => u.role === 'State Manager' && u.state === assignedState);
      if (stateManager) intelligentReportsToId = stateManager.id;
    } else if (newUserRole === 'Area Manager') {
      const districtManager = users.find(u => u.role === 'District Manager' && u.district === assignedDistrict);
      if (districtManager) intelligentReportsToId = districtManager.id;
    } else if (newUserRole === 'CF' || newUserRole === 'JCF') {
      const areaManager = users.find(u => u.role === 'Area Manager' && u.areaName === assignedArea);
      if (areaManager) intelligentReportsToId = areaManager.id;
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: newUserName.trim(),
      username: newUserUsername.trim().toLowerCase(),
      password: newUserPassword.trim(),
      role: newUserRole,
      email: newUserEmail || `${newUserUsername.toLowerCase()}@awdpipe.org`,
      phone: newUserPhone || '+91 98765 00000',
      isActive: true,
      state: assignedState,
      district: assignedDistrict,
      areaName: assignedArea,
      reportsToId: intelligentReportsToId,
      createdById: currentUser.id,
      createdAt: new Date().toISOString().split('T')[0],
    };

    onAddUser(newUser);
    setIsAddUserOpen(false);
  };

  useEffect(() => {
    if (!isAddUserOpen) return;

    if (!targetStateName && availableStateOptions.length > 0) {
      setTargetStateName(selectedState?.name || availableStateOptions[0].name);
      return;
    }

    if ((newUserRole === 'District Manager' || newUserRole === 'Area Manager' || newUserRole === 'CF' || newUserRole === 'JCF') && targetDistrictOptions.length > 0) {
      if (!targetDistrictOptions.some((d) => d.name === targetDistrictName)) {
        setTargetDistrictName(targetDistrictOptions[0].name);
      }
    } else if (newUserRole === 'District Manager') {
      setTargetDistrictName('');
    }

    if ((newUserRole === 'Area Manager' || newUserRole === 'CF' || newUserRole === 'JCF') && targetAreaOptions.length > 0) {
      if (!targetAreaOptions.some((a) => a.name === targetAreaName)) {
        setTargetAreaName(targetAreaOptions[0].name);
      }
    } else if (newUserRole === 'Area Manager' || newUserRole === 'CF' || newUserRole === 'JCF') {
      setTargetAreaName('__new__');
    }
  }, [isAddUserOpen, newUserRole, targetStateName, targetDistrictName, targetAreaName, targetDistrictOptions, targetAreaOptions, availableStateOptions, selectedState?.name]);

  useEffect(() => {
    if (!editingUser) return;

    if (editingUser.role === 'Area Manager' || editingUser.role === 'CF' || editingUser.role === 'JCF') {
      const area = areas.find((a) => a.name === editingUser.areaName);
      if (area && (editingUser.district !== area.districtName || editingUser.state !== area.stateName)) {
        setEditingUser({ ...editingUser, district: area.districtName, state: area.stateName });
      }
    }
  }, [editingUser, areas]);

  const confirmAndDeleteUser = (userId: string, userName?: string) => {
    const nameStr = userName ? ` "${userName}"` : '';
    const title = `Delete User${nameStr}`;
    const message = `Are you sure you want to permanently delete user${nameStr}? This action cannot be undone.`;

    requestDeleteConfirmation(title, message, () => {
      onDeleteUser?.(userId);
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (onUpdateUser) {
      onUpdateUser(editingUser);
    }
    setEditingUser(null);
  };

  const handleHierarchyEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHierarchyItem) return;
    if (editingHierarchyType === 'state' && onUpdateState) {
      onUpdateState(editingHierarchyItem);
    } else if (editingHierarchyType === 'district' && onUpdateDistrict) {
      onUpdateDistrict(editingHierarchyItem);
    } else if (editingHierarchyType === 'area' && onUpdateArea) {
      onUpdateArea(editingHierarchyItem);
    }
    setEditingHierarchyType(null);
    setEditingHierarchyItem(null);
  };

  const handleHierarchyDelete = () => {
    if (!editingHierarchyItem || !editingHierarchyType) return;
    const item = editingHierarchyItem;
    const type = editingHierarchyType;

    const hasChildren =
      (type === 'state' && districts.some((d) => d.stateId === item.id || d.stateName === item.name)) ||
      (type === 'district' && areas.some((a) => a.districtId === item.id || a.districtName === item.name));

    const title = `Delete ${type.toUpperCase()}: ${item.name}`;
    const message = hasChildren
      ? `This ${type} "${item.name}" contains child locations and users. Are you sure you want to permanently delete it and all associated items?`
      : `Are you sure you want to permanently delete ${type} "${item.name}"?`;

    requestDeleteConfirmation(title, message, () => {
      if (type === 'state') onDeleteState?.(item.id);
      if (type === 'district') onDeleteDistrict?.(item.id);
      if (type === 'area') onDeleteArea?.(item.id);
      setEditingHierarchyType(null);
      setEditingHierarchyItem(null);
    });
  };

  const handleInlineHierarchyDelete = (type: 'state' | 'district' | 'area', item: any) => {
    const hasChildren =
      (type === 'state' && districts.some((d) => d.stateId === item.id || d.stateName === item.name)) ||
      (type === 'district' && areas.some((a) => a.districtId === item.id || a.districtName === item.name));

    const title = `Delete ${type.toUpperCase()}: ${item.name}`;
    const message = hasChildren
      ? `This ${type} "${item.name}" contains child locations and users. Are you sure you want to permanently delete it and all associated items?`
      : `Are you sure you want to permanently delete ${type} "${item.name}"?`;

    requestDeleteConfirmation(title, message, () => {
      if (type === 'state') onDeleteState?.(item.id);
      if (type === 'district') onDeleteDistrict?.(item.id);
      if (type === 'area') onDeleteArea?.(item.id);
    });
  };

  const clearNodeManager = (type: 'state' | 'district' | 'area', item: any) => {
    const cleared = { ...item, managerId: '', managerName: '' };
    if (type === 'state' && onUpdateState) onUpdateState(cleared);
    if (type === 'district' && onUpdateDistrict) onUpdateDistrict(cleared);
    if (type === 'area' && onUpdateArea) onUpdateArea(cleared);
  };

  const handleOpenAddHierarchy = (type: 'state' | 'district' | 'area') => {
    setAddingHierarchyType(type);
    setNewHierarchyName('');
    setIsAddingHierarchy(true);
  };

  const handleSubmitAddHierarchy = () => {
    if (!newHierarchyName.trim()) return;

    if (addingHierarchyType === 'state' && onAddState) {
      onAddState({
        id: `state-${Date.now()}`,
        name: newHierarchyName.trim(),
        code: newHierarchyName.trim().slice(0, 3).toUpperCase(),
        managerId: '',
        managerName: ''
      });
    } else if (addingHierarchyType === 'district' && onAddDistrict && selectedStateId && selectedState) {
      onAddDistrict({
        id: `dist-${Date.now()}`,
        stateId: selectedStateId,
        stateName: selectedState.name,
        name: newHierarchyName.trim(),
        managerId: '',
        managerName: ''
      });
    } else if (addingHierarchyType === 'area' && onAddArea && selectedDistrictId && selectedDistrict) {
      onAddArea({
        id: `area-${Date.now()}`,
        districtId: selectedDistrictId,
        districtName: selectedDistrict.name,
        stateName: selectedDistrict.stateName || selectedState?.name || '',
        name: newHierarchyName.trim(),
        managerId: '',
        managerName: ''
      });
    }

    setIsAddingHierarchy(false);
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
        <button
          onClick={onSaveHierarchy}
          disabled={!onSaveHierarchy || isSavingHierarchy}
          className="bg-white/10 hover:bg-white/15 disabled:opacity-60 text-white text-xs font-extrabold px-4 py-3 rounded-xl transition border border-white/15 shrink-0"
        >
          {isSavingHierarchy ? 'Saving...' : hierarchyDirty ? 'Save Hierarchy' : dbStatus === 'cloud' ? 'Saved to Cloud' : 'Saved Locally'}
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md uppercase">
                State Level
              </span>
              {(isAdmin || isSM) && (
                <button
                  onClick={() => handleOpenAddHierarchy('state')}
                  className="p-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-md transition cursor-pointer"
                  title="Add New State"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {visibleStates.map((st) => {
              const isSelected = st.id === selectedStateId;
              const stateUser = users.find((u) => u.role === 'State Manager' && matchLoc(u.state, st.name));

              return (
                <div
                  key={st.id}
                  onClick={() => {
                    setSelectedStateId(st.id);
                    setSelectedDistrictId(''); // Reset district when switching state
                    // Auto-select first district (match by stateId or stateName)
                    const firstDist = districts.find((d) => d.stateId === st.id || matchLoc(d.stateName, st.name));
                    if (firstDist) setSelectedDistrictId(firstDist.id);
                  }}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-amber-50/80 border-amber-400 shadow-sm ring-1 ring-amber-400/30'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 block">{st.name} ({st.code})</span>
                      {(isAdmin || isSM) && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingHierarchyType('state');
                              setEditingHierarchyItem(st);
                            }}
                            className="p-1 text-slate-400 hover:text-amber-600 rounded-md hover:bg-amber-100 transition cursor-pointer"
                            title="Edit State"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInlineHierarchyDelete('state', st);
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-100 transition cursor-pointer"
                              title="Delete State"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      Manager: <strong className="text-slate-800">{stateUser?.name || st.managerName || 'Unassigned'}</strong>
                      {stateUser && (isAdmin || isSM) && (
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingUser(stateUser); }}
                            title="Edit State Manager"
                            className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {isAdmin && onDeleteUser && (
                            <button
                              onClick={(e) => { e.stopPropagation(); confirmAndDeleteUser(stateUser.id, stateUser.name); }}
                              title="Remove State Manager"
                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      {!stateUser && st.managerName && isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearNodeManager('state', st);
                          }}
                          title="Clear State Manager Label"
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  </div>
                  <span className="text-xs font-bold font-mono text-amber-800 bg-amber-200/60 px-2.5 py-1 rounded-lg">
                    {districts.filter((d) => d.stateId === st.id || matchLoc(d.stateName, st.name)).length} Dists
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md uppercase">
                District Level
              </span>
              {(isAdmin || isSM || isDM) && selectedStateId && (
                <button
                  onClick={() => handleOpenAddHierarchy('district')}
                  className="p-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition cursor-pointer"
                  title="Add New District"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {visibleDistricts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed">
                No districts available in your scope.
              </p>
            ) : (
              visibleDistricts.map((dt) => {
                const isSelected = dt.id === selectedDistrictId;
                const distUser = users.find((u) => u.role === 'District Manager' && matchLoc(u.district, dt.name));

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
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 block">{dt.name}</span>
                        {(isAdmin || isSM || isDM) && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingHierarchyType('district');
                                setEditingHierarchyItem(dt);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-100 transition cursor-pointer"
                              title="Edit District"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {(isAdmin || isSM) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInlineHierarchyDelete('district', dt);
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-100 transition cursor-pointer"
                                title="Delete District"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        DM: <strong className="text-slate-800">{distUser?.name || dt.managerName || 'Unassigned'}</strong>
                        {distUser && (isAdmin || isSM || isDM) && (
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingUser(distUser); }}
                              title="Edit District Manager"
                              className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {(isAdmin || isSM) && onDeleteUser && (
                              <button
                                onClick={(e) => { e.stopPropagation(); confirmAndDeleteUser(distUser.id, distUser.name); }}
                                title="Remove District Manager"
                                className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                        {!distUser && dt.managerName && isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearNodeManager('district', dt);
                            }}
                            title="Clear District Manager Label"
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer ml-2"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    </div>
                    <span className="text-xs font-bold font-mono text-blue-800 bg-blue-200/60 px-2.5 py-1 rounded-lg">
                      {areas.filter((a) => a.districtId === dt.id || matchLoc(a.districtName, dt.name)).length} Areas
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md uppercase">
                Field Operations
              </span>
              {(isAdmin || isSM || isDM || isAM) && selectedDistrictId && (
                <button
                  onClick={() => handleOpenAddHierarchy('area')}
                  className="p-1 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-md transition cursor-pointer"
                  title="Add New Area"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {visibleAreas.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed">
                No area managers configured under selected district.
              </p>
            ) : (
              visibleAreas.map((ar) => {
                const areaUser = users.find((u) => u.role === 'Area Manager' && u.areaName && ar.name && matchLoc(u.areaName, ar.name));
                const fieldStaff = users.filter((u) => (u.role === 'CF' || u.role === 'JCF') && u.areaName && ar.name && matchLoc(u.areaName, ar.name));

                return (
                  <div key={ar.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                    {/* Area Header */}
                    <div className="flex items-start justify-between border-b border-slate-200/80 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 block">{ar.name} Area</span>
                          {(isAdmin || isSM || isDM || isAM) && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingHierarchyType('area');
                                  setEditingHierarchyItem(ar);
                                }}
                                className="p-1 text-slate-400 hover:text-teal-600 rounded-md hover:bg-teal-100 transition cursor-pointer"
                                title="Edit Area"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              {(isAdmin || isSM || isDM) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInlineHierarchyDelete('area', ar);
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-100 transition cursor-pointer"
                                  title="Delete Area"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] text-teal-800 font-bold bg-teal-100 px-2 py-0.5 rounded-md flex items-center gap-2">
                            <span>AM: {areaUser?.name || 'Unassigned'}</span>
                            {areaUser && (isAdmin || isSM || isDM || isAM) && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingUser(areaUser); }}
                                  title="Edit Area Manager"
                                  className="p-0.5 text-teal-600 hover:text-blue-600 transition cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                {(isAdmin || isSM || isDM) && onDeleteUser && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); confirmAndDeleteUser(areaUser.id, areaUser.name); }}
                                    title="Remove Area Manager"
                                    className="p-0.5 text-teal-600 hover:text-red-600 transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                            {!areaUser && ar.managerName && isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearNodeManager('area', ar);
                                }}
                                title="Clear Area Manager Label"
                                className="p-0.5 text-teal-600 hover:text-red-600 transition cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
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
                                      onClick={() => confirmAndDeleteUser(staff.id, staff.name)}
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
              const canEdit = isAdmin || 
                (isSM && ['District Manager', 'Area Manager', 'CF', 'JCF'].includes(u.role)) ||
                (isDM && ['Area Manager', 'CF', 'JCF'].includes(u.role)) ||
                (isAM && ['CF', 'JCF'].includes(u.role));
                
              return (
                <div key={u.id} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                        {u.name}
                        {canEdit && (
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => setEditingUser(u)}
                              title="Edit User"
                              className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {onDeleteUser && (
                              <button
                                onClick={() => confirmAndDeleteUser(u.id, u.name)}
                                title="Remove User"
                                className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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

      {/* MODAL: ADD TEAM MEMBER */}
      {isAddUserOpen && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
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

              {newUserRole === 'State Manager' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Assign to State *</label>
                  {availableStateOptions.length === 0 ? (
                    <input
                      type="text"
                      required
                      value={targetStateName}
                      onChange={(e) => setTargetStateName(e.target.value)}
                      placeholder="Enter state name"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  ) : (
                    <select
                      value={targetStateName}
                      onChange={(e) => setTargetStateName(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
                    >
                      {availableStateOptions.map((st) => (
                        <option key={st.id} value={st.name}>{st.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {newUserRole === 'District Manager' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Assign to State *</label>
                    <select
                      value={targetStateName}
                      onChange={(e) => {
                        setTargetStateName(e.target.value);
                        const stateId = states.find(s => s.name === e.target.value)?.id;
                        const dists = districts.filter(d => d.stateId === stateId);
                        setTargetDistrictName(dists[0]?.name || '');
                      }}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
                    >
                      {availableStateOptions.map((st) => (
                        <option key={st.id} value={st.name}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Assign to District *</label>
                    {needsCustomDistrict ? (
                      <input
                        type="text"
                        required
                        value={targetNewDistrictName}
                        onChange={(e) => setTargetNewDistrictName(e.target.value)}
                        placeholder="Enter new district name"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <select
                        value={targetDistrictName}
                        onChange={(e) => setTargetDistrictName(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
                      >
                        {targetDistrictOptions.map((dt) => (
                          <option key={dt.id} value={dt.name}>{dt.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              {(newUserRole === 'Area Manager' || newUserRole === 'CF' || newUserRole === 'JCF') && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">State *</label>
                      <select
                        value={targetStateName}
                        onChange={(e) => setTargetStateName(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
                      >
                        {availableStateOptions.length === 0 ? null : availableStateOptions.map((st) => (
                          <option key={st.id} value={st.name}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">District *</label>
                      {targetDistrictOptions.length === 0 ? (
                        <input
                          type="text"
                          required
                          value={targetNewDistrictName}
                          onChange={(e) => setTargetNewDistrictName(e.target.value)}
                          placeholder="Enter new district name"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      ) : (
                        <select
                          value={targetDistrictName}
                          onChange={(e) => setTargetDistrictName(e.target.value)}
                          required
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
                        >
                          {targetDistrictOptions.map((dt) => (
                            <option key={dt.id} value={dt.name}>{dt.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Assign to Area *</label>
                    {needsCustomArea ? (
                      <input
                        type="text"
                        required
                        value={targetNewAreaName}
                        onChange={(e) => setTargetNewAreaName(e.target.value)}
                        placeholder="Enter new area name"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <select
                        value={targetAreaName}
                        onChange={(e) => setTargetAreaName(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
                      >
                        {targetAreaOptions.map((ar) => (
                          <option key={ar.id} value={ar.name}>
                            {ar.name} ({ar.districtName})
                          </option>
                        ))}
                        <option value="__new__">+ Create new area</option>
                      </select>
                    )}
                    {targetAreaName === '__new__' && !needsCustomArea && (
                      <input
                        type="text"
                        required
                        value={targetNewAreaName}
                        onChange={(e) => setTargetNewAreaName(e.target.value)}
                        placeholder="Enter new area name"
                        className="w-full mt-3 bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    )}
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs">
                    <span className="font-bold text-emerald-900">Reports to:</span>{' '}
                    <span className="text-emerald-800">{managerPreview}</span>
                  </div>
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
      , document.body)}

      {/* MODAL: EDIT ROLES & RESPONSIBILITIES */}
      {editingUser && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
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
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      const fallbackState = editingUser.state || states[0]?.name || '';
                      const fallbackDistrict = districts.find((district) => district.stateName === fallbackState)?.name || '';
                      const fallbackArea = areas.find((area) => area.districtName === fallbackDistrict)?.name || '';
                      setEditingUser({
                        ...editingUser,
                        role: nextRole,
                        state: nextRole === 'Admin' ? undefined : fallbackState,
                        district: nextRole === 'State Manager' || nextRole === 'Admin' ? undefined : (editingUser.district || fallbackDistrict),
                        areaName: nextRole === 'Area Manager' || nextRole === 'CF' || nextRole === 'JCF' ? (editingUser.areaName || fallbackArea) : undefined
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                  >
                    <option value="Admin">Admin</option>
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

              {editingUser.role === 'State Manager' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Assigned State</label>
                  <select
                    value={editingUser.state || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, state: e.target.value, district: undefined, areaName: undefined })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                  >
                    {states.map((st) => (
                      <option key={st.id} value={st.name}>{st.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {editingUser.role === 'District Manager' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Assigned State</label>
                    <select
                      value={editingUser.state || ''}
                      onChange={(e) => {
                        const nextState = e.target.value;
                        const nextDistrict = districts.find((district) => district.stateName === nextState)?.name || '';
                        setEditingUser({ ...editingUser, state: nextState, district: nextDistrict, areaName: undefined });
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                    >
                      {states.map((st) => (
                        <option key={st.id} value={st.name}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Assigned District</label>
                    <select
                      value={editingUser.district || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, district: e.target.value, areaName: undefined })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                    >
                      {districts.filter((district) => district.stateName === editingUser.state).map((district) => (
                        <option key={district.id} value={district.name}>{district.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {(editingUser.role === 'Area Manager' || editingUser.role === 'CF' || editingUser.role === 'JCF') && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">State</label>
                      <select
                        value={editingUser.state || ''}
                        onChange={(e) => {
                          const nextState = e.target.value;
                          const nextDistrict = districts.find((d) => d.stateName === nextState)?.name || '';
                          const nextArea = areas.find((a) => a.stateName === nextState && (!nextDistrict || a.districtName === nextDistrict))?.name || '';
                          setEditingUser({ ...editingUser, state: nextState, district: nextDistrict, areaName: nextArea });
                        }}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                      >
                        {states.map((st) => (
                          <option key={st.id} value={st.name}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">District</label>
                      <select
                        value={editingUser.district || ''}
                        onChange={(e) => {
                          const nextDistrict = e.target.value;
                          const nextArea = areas.find((a) => a.districtName === nextDistrict)?.name || '';
                          setEditingUser({ ...editingUser, district: nextDistrict, areaName: nextArea });
                        }}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                      >
                        {districts.filter((d) => d.stateName === editingUser.state).map((dt) => (
                          <option key={dt.id} value={dt.name}>{dt.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Assigned Jurisdiction Area</label>
                    <select
                      value={editingUser.areaName || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, areaName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                    >
                      {areas.filter((ar) => ar.districtName === editingUser.district).map((ar) => (
                        <option key={ar.id} value={ar.name}>
                          {ar.name} ({ar.districtName})
                        </option>
                      ))}
                    </select>
                  </div>
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

              <div className="pt-3 flex items-center justify-between gap-3 border-t">
                {onDeleteUser && (
                  <button
                    type="button"
                    onClick={() => {
                      const idToDelete = editingUser.id;
                      const nameToDelete = editingUser.name;
                      setEditingUser(null);
                      confirmAndDeleteUser(idToDelete, nameToDelete);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-red-600 bg-red-50 hover:bg-red-100 transition cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete User
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
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
              </div>
            </form>
          </div>
        </div>
      , document.body)}

    {/* MODAL: EDIT HIERARCHY */}
      {editingHierarchyItem && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-900 capitalize">
                  Edit {editingHierarchyType}
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingHierarchyType(null);
                  setEditingHierarchyItem(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleHierarchyEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  required
                  value={editingHierarchyItem.name}
                  onChange={(e) => setEditingHierarchyItem({ ...editingHierarchyItem, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-between gap-3 border-t mt-4">
                <button
                  type="button"
                  onClick={handleHierarchyDelete}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-red-600 bg-red-50 hover:bg-red-100 transition cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove {editingHierarchyType}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingHierarchyType(null);
                      setEditingHierarchyItem(null);
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/30 transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* Add Hierarchy Modal */}
      {isAddingHierarchy && addingHierarchyType && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2 text-slate-800">
                <Plus className="w-5 h-5 text-indigo-500" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                  Add New {addingHierarchyType}
                </h3>
              </div>
              <button
                onClick={() => setIsAddingHierarchy(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                {addingHierarchyType} Name
              </label>
              <input
                type="text"
                required
                value={newHierarchyName}
                onChange={(e) => setNewHierarchyName(e.target.value)}
                placeholder={`Enter ${addingHierarchyType} name`}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="pt-3 flex items-center justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingHierarchy(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAddHierarchy}
                  disabled={!newHierarchyName.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-900/30 transition cursor-pointer"
                >
                  Create {addingHierarchyType}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* CUSTOM CONFIRM DELETE MODAL */}
      {confirmDeleteModal && confirmDeleteModal.isOpen && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {confirmDeleteModal.title}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                  Permanent Action Required
                </p>
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
              {confirmDeleteModal.message}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteModal.onConfirm}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmDeleteModal.confirmButtonText || 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
