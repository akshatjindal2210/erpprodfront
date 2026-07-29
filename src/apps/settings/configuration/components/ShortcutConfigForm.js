"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Settings, Link as LinkIcon, ChevronDown, Store, Box, Truck, Users as UsersIcon, FileText, Home, Zap, Package, Database, FileSearch, BarChart3, Map, Boxes, 
  ClipboardCheck, Locate, ClipboardList, Scale, Sticker, History, ShieldAlert, Activity, Clock, Briefcase, Calendar, Cloud, Filter,
  Flag, Folder, Layers, LifeBuoy, PieChart, Printer, ShoppingCart, Tag, Target, Toolbox, Wrench, Hammer, Wallet, X, Check, User, Users, Edit3, RefreshCcw
} from "lucide-react";
import { appConfigService } from "@/apps/settings/lib/services/appConfigService";
import { userService } from "@/common/auth/services/userService";
import { NAV_REGISTRY } from "@/apps/ims/lib/config/navRegistry";
import { SETTINGS_NAV_REGISTRY } from "@/apps/settings/configuration/config/settingsNavRegistry";
import { APPS } from "@/config/appsRegistry";
import { toast } from "react-toastify";
import { AppConfigFormFooter, AppConfigFormLoading, CONFIG_INPUT, CONFIG_LABEL, CONFIG_SELECT } from "./AppConfigFormFields";
import GlobalDetailModal from "@/ui/common/modals/GlobalDetailModal";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";

const DYNAMIC_SHORTCUTS_KEY = "dynamic_shortcuts";

const ICON_OPTIONS = [
  { name: "Home", icon: <Home size={14} /> },
  { name: "Zap", icon: <Zap size={14} /> },
  { name: "Package", icon: <Package size={14} /> },
  { name: "Truck", icon: <Truck size={14} /> },
  { name: "Users", icon: <UsersIcon size={14} /> },
  { name: "Database", icon: <Database size={14} /> },
  { name: "FileSearch", icon: <FileSearch size={14} /> },
  { name: "BarChart3", icon: <BarChart3 size={14} /> },
  { name: "Map", icon: <Map size={14} /> },
  { name: "Boxes", icon: <Boxes size={14} /> },
  { name: "ClipboardCheck", icon: <ClipboardCheck size={14} /> },
  { name: "Locate", icon: <Locate size={14} /> },
  { name: "ClipboardList", icon: <ClipboardList size={14} /> },
  { name: "Scale", icon: <Scale size={14} /> },
  { name: "Sticker", icon: <Sticker size={14} /> },
  { name: "History", icon: <History size={14} /> },
  { name: "ShieldAlert", icon: <ShieldAlert size={14} /> },
  { name: "Link", icon: <LinkIcon size={14} /> },
  { name: "Store", icon: <Store size={14} /> },
  { name: "Box", icon: <Box size={14} /> },
  { name: "Settings", icon: <Settings size={14} /> },
  { name: "FileText", icon: <FileText size={14} /> },
  { name: "Activity", icon: <Activity size={14} /> },
  { name: "Clock", icon: <Clock size={14} /> },
  { name: "Briefcase", icon: <Briefcase size={14} /> },
  { name: "Calendar", icon: <Calendar size={14} /> },
  { name: "Cloud", icon: <Cloud size={14} /> },
  { name: "Filter", icon: <Filter size={14} /> },
  { name: "Flag", icon: <Flag size={14} /> },
  { name: "Folder", icon: <Folder size={14} /> },
  { name: "Layers", icon: <Layers size={14} /> },
  { name: "LifeBuoy", icon: <LifeBuoy size={14} /> },
  { name: "PieChart", icon: <PieChart size={14} /> },
  { name: "Printer", icon: <Printer size={14} /> },
  { name: "ShoppingCart", icon: <ShoppingCart size={14} /> },
  { name: "Tag", icon: <Tag size={14} /> },
  { name: "Target", icon: <Target size={14} /> },
  { name: "Toolbox", icon: <Toolbox size={14} /> },
  { name: "Wrench", icon: <Wrench size={14} /> },
  { name: "Hammer", icon: <Hammer size={14} /> },
  { name: "Wallet", icon: <Wallet size={14} /> },
];

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map(o => [o.name, o.icon]));

function ShortcutModal({ open, onClose, onSave, editData, users, appPagesMap, shortcuts, editingId }) {
  const [formData, setFormData] = useState({
    label: "",
    rank: 1,
    color: "#4f46e5",
    type: "URL",
    url: "",
    appId: "",
    pageId: "",
    userAccessType: "ALL",
    allowedUsers: [],
    isChild: false,
    parentId: "",
    icon: "Link"
  });

  const [isIconDropdownOpen, setIsIconDropdownOpen] = useState(false);

  const fetchUsers = useCallback(
    async ({ search, page = 1, limit = 50 }) => {
      const q = String(search || "").trim().toLowerCase();
      let rows = (Array.isArray(users) ? users : [])
        .map((u) => ({
          id: u.id,
          name: String(u.name || u.username || "").trim(),
          username: u.username,
        }))
        .filter((row) => row.id != null && row.name);
      if (q) {
        rows = rows.filter(
          (row) =>
            row.name.toLowerCase().includes(q) ||
            String(row.username || "").toLowerCase().includes(q)
        );
      }
      const start = (page - 1) * limit;
      return { data: rows.slice(start, start + limit), total: rows.length };
    },
    [users]
  );

  const getUserById = useCallback(
    async (id) => {
      const found = (Array.isArray(users) ? users : []).find((u) => String(u.id) === String(id));
      if (found) {
        return { id: found.id, name: String(found.name || found.username || "").trim(), username: found.username };
      }
      const res = await userService.getById(id);
      return res?.data || res;
    },
    [users]
  );

  useEffect(() => {
    if (editData) {
      setFormData({
        ...editData,
        userAccessType: editData.allowedUsers?.length > 1 ? "MULTIPLE" : editData.allowedUsers?.length === 1 ? "SINGLE" : "ALL",
        isChild: !!editData.parentId,
        parentId: editData.parentId || ""
      });
    } else {
      setFormData({
        label: "",
        rank: shortcuts.length + 1,
        color: "#4f46e5",
        type: "URL",
        url: "",
        appId: "",
        pageId: "",
        userAccessType: "ALL",
        allowedUsers: [],
        isChild: false,
        parentId: "",
        icon: "Link"
      });
    }
  }, [editData, open, shortcuts.length]);

  const handleAppPageSelect = (e) => {
    const pageId = e.target.value;
    const selectedPage = appPagesMap[formData.appId]?.find(p => p.id === pageId);
    if (selectedPage) {
      setFormData({
        ...formData,
        pageId: pageId,
        label: selectedPage.name.includes('>') ? selectedPage.name.split('>')[1].trim() : selectedPage.name,
        url: selectedPage.url,
        requiredPermission: selectedPage.permission || null
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.label) {
      toast.error("Label is required");
      return;
    }
    
    // For URL type, ensure requiredPermission is null or a generic value if not set
    const finalSubmitData = {
      ...formData,
      requiredPermission: formData.type === "APP" ? formData.requiredPermission : null
    };
    
    onSave(finalSubmitData);
  };

  const handleUsersChange = (ids) => {
    const nextIds = Array.isArray(ids) ? ids : [ids].filter(Boolean);
    setFormData(prev => ({ ...prev, allowedUsers: nextIds }));
  };

  return (
    <GlobalDetailModal 
      open={open} 
      onClose={onClose} 
      title={editData ? "Edit Shortcut" : "New Shortcut"} 
      icon={editData ? Edit3 : Plus}
      size="wide"
      footer={null}
    >
      <form onSubmit={handleSubmit} className="space-y-6 p-1">
        {/* Step 1: Type Selection */}
        <div className="space-y-1">
          <label className={CONFIG_LABEL}>Shortcut Type</label>
          <select 
            value={formData.type} 
            onChange={(e) => setFormData({...formData, type: e.target.value, appId: "", pageId: "", url: "", label: "", requiredPermission: null})}
            className={CONFIG_SELECT}
          >
            <option value="URL">External / Custom URL</option>
            <option value="APP">ERP Module Page</option>
          </select>
        </div>

        {/* Conditional Step 2: App Selection or URL Details */}
        {formData.type === "APP" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-1">
              <label className={CONFIG_LABEL}>Choose App</label>
              <select 
                value={formData.appId} 
                onChange={(e) => setFormData({...formData, appId: e.target.value, pageId: "", label: "", url: "", requiredPermission: null})}
                className={CONFIG_SELECT}
              >
                <option value="">-- Select App --</option>
                {APPS.filter(a => a.id !== "home").map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={CONFIG_LABEL}>Choose Page</label>
              <select 
                value={formData.pageId} 
                onChange={handleAppPageSelect}
                className={CONFIG_SELECT}
                disabled={!formData.appId}
              >
                <option value="">-- Select Page --</option>
                {(appPagesMap[formData.appId] || []).map(page => <option key={page.id} value={page.id}>{page.name}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-1">
              <label className={CONFIG_LABEL}>Shortcut Title</label>
              <input 
                type="text" 
                value={formData.label} 
                onChange={(e) => setFormData({...formData, label: e.target.value})} 
                className={CONFIG_INPUT} 
                placeholder="e.g. Google Docs" 
              />
            </div>
            <div className="space-y-1">
              <label className={CONFIG_LABEL}>URL / Path</label>
              <input 
                type="text" 
                value={formData.url} 
                onChange={(e) => setFormData({...formData, url: e.target.value})} 
                className={CONFIG_INPUT} 
                placeholder="https://... or /ims/..." 
              />
            </div>
          </div>
        )}

        {/* Icon (Color removed) */}
        <div className="space-y-1 relative">
          <label className={CONFIG_LABEL}>Display Icon</label>
          <div onClick={() => setIsIconDropdownOpen(!isIconDropdownOpen)} className={`${CONFIG_INPUT} flex items-center justify-between cursor-pointer bg-white`}>
            <div className="flex items-center gap-2">
              <div className="text-indigo-600">{ICON_MAP[formData.icon] || <LinkIcon size={14} />}</div>
              <span className="truncate text-[11px] font-medium">{formData.icon}</span>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
          {isIconDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsIconDropdownOpen(false)} />
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto p-2 grid grid-cols-3 gap-1">
                {ICON_OPTIONS.map(opt => (
                  <div key={opt.name} onClick={() => { setFormData({...formData, icon: opt.name}); setIsIconDropdownOpen(false); }} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg cursor-pointer transition-all ${formData.icon === opt.name ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}>
                    <div className={formData.icon === opt.name ? 'text-white' : 'text-slate-400'}>{opt.icon}</div>
                    <span className="text-[8px] font-bold uppercase truncate w-full text-center">{opt.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Visibility (Redesigned with Toggle + SearchableSelect) */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className={CONFIG_LABEL}>Visibility</label>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                type="button"
                onClick={() => setFormData({...formData, userAccessType: "ALL", allowedUsers: []})}
                className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${formData.userAccessType === "ALL" ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                All Users
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, userAccessType: "MULTIPLE"})}
                className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${formData.userAccessType !== "ALL" ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Select Users
              </button>
            </div>
          </div>

          {formData.userAccessType !== "ALL" && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <SearchableSelect
                multiple={true}
                value={formData.allowedUsers}
                onChange={handleUsersChange}
                fetchService={fetchUsers}
                getByIdService={getUserById}
                placeholder="Search and add users..."
                label=""
                variant="form"
                showTags={true}
                dataKey="id"
                labelKey="name"
                subLabelKey="username"
              />
            </div>
          )}
        </div>

        {/* Menu Structure (Redesigned) */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className={CONFIG_LABEL}>Menu Position</label>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                type="button"
                onClick={() => setFormData({...formData, isChild: false, parentId: ""})}
                className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${!formData.isChild ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Main Menu
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, isChild: true})}
                className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${formData.isChild ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Sub Menu
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.isChild && (
              <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
                <label className={CONFIG_LABEL}>Select Parent Menu</label>
                <select value={formData.parentId || ""} onChange={(e) => setFormData({...formData, parentId: e.target.value})} className={CONFIG_SELECT}>
                  <option value="">-- Choose Parent --</option>
                  {shortcuts.filter(s => !s.parentId && s.id !== editingId).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className={CONFIG_LABEL}>Display Rank</label>
              <input type="number" value={formData.rank} onChange={(e) => setFormData({...formData, rank: e.target.value})} className={CONFIG_INPUT} placeholder="1" />
            </div>
          </div>
        </div>

        <div className="pt-6">
          <button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl text-[12px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
          >
            {editData ? <Check size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={3} />}
            {editData ? "Update Shortcut" : "Create Shortcut"}
          </button>
        </div>
      </form>
    </GlobalDetailModal>
  );
}

export default function ShortcutConfigForm() {
  const [shortcuts, setShortcuts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const pendingActionRef = useRef(null);
  const hasUnsavedChangesRef = useRef(false);
  const handleSaveAllRef = useRef(null);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  const appPagesMap = useMemo(() => {
    const map = {
      ims: NAV_REGISTRY.flatMap(item => {
        const pages = [];
        if (item.href) pages.push({ id: item.id, name: item.name, url: item.href, permission: item.module });
        if (item.subItems) {
          item.subItems.forEach(sub => pages.push({ id: sub.id, name: `${item.name} > ${sub.name}`, url: sub.href, permission: sub.module }));
        }
        return pages;
      }),
      settings: SETTINGS_NAV_REGISTRY.map(item => ({ id: item.id, name: item.name, url: item.href, permission: item.module })),
      task: [{ id: "task-home", name: "Task Dashboard", url: "/task", permission: "task_view" }]
    };
    return map;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, usersRes] = await Promise.all([
        appConfigService.list("shortcut"),
        userService.getViews({ 
          permission_module: "users",
          permission_action: "view"
        })
      ]);

      if (configRes?.success) {
        const configRow = configRes.data?.find(r => (r.key === DYNAMIC_SHORTCUTS_KEY || r.config_key === DYNAMIC_SHORTCUTS_KEY));
        if (configRow?.config_value) {
          try {
            const parsed = JSON.parse(configRow.config_value);
            setShortcuts(Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            setShortcuts([]);
          }
        }
      }

      if (usersRes?.success) {
        const userList = usersRes.data?.data || usersRes.data || [];
        setUsers(Array.isArray(userList) ? userList : []);
      }
    } catch (err) {
      toast.error("Failed to load configuration data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddOrUpdate = (itemData) => {
    const finalData = {
      ...itemData,
      allowedUsers: itemData.userAccessType === "ALL" ? [] : itemData.allowedUsers,
      parentId: itemData.isChild ? itemData.parentId : null,
      rank: parseInt(itemData.rank) || shortcuts.length + 1
    };

    let updated;
    if (editingId) {
      updated = shortcuts.map(s => s.id === editingId ? { ...s, ...finalData } : s);
      toast.info("Shortcut updated");
    } else {
      updated = [...shortcuts, { id: Date.now().toString(), ...finalData }];
      toast.info("Shortcut added");
    }
    
    updated.sort((a, b) => (parseInt(a.rank) || 0) - (parseInt(b.rank) || 0));
    setShortcuts(updated);
    setHasUnsavedChanges(true);
    setModalOpen(false);
    setEditingId(null);
  };

  const handleDelete = (id) => {
    setShortcuts(shortcuts.filter(s => s.id !== id && s.parentId !== id));
    setHasUnsavedChanges(true);
    toast.warn("Item removed");
    setSelected(null);
  };

  const moveRank = (index, direction) => {
    const newShortcuts = [...shortcuts];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newShortcuts.length) return;
    [newShortcuts[index], newShortcuts[targetIndex]] = [newShortcuts[targetIndex], newShortcuts[index]];
    const reRanked = newShortcuts.map((s, i) => ({ ...s, rank: i + 1 }));
    setShortcuts(reRanked);
    setHasUnsavedChanges(true);
  };

  const handleSaveAll = useCallback(async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await appConfigService.update(DYNAMIC_SHORTCUTS_KEY, JSON.stringify(shortcuts));
      if (res?.success) {
        toast.success("Configuration saved");
        setHasUnsavedChanges(false);
        return true;
      }
      throw new Error(res?.message || "Failed to save");
    } catch (err) {
      toast.error(err?.message || "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }, [shortcuts]);

  useEffect(() => {
    handleSaveAllRef.current = handleSaveAll;
  }, [handleSaveAll]);

  const runPendingAction = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setShowUnsavedModal(false);
    if (typeof action === "function") action();
  }, []);

  const handleUnsavedSave = useCallback(async () => {
    const saved = await handleSaveAllRef.current?.();
    if (saved) runPendingAction();
  }, [runPendingAction]);

  const handleUnsavedLeave = useCallback(() => {
    setHasUnsavedChanges(false);
    runPendingAction();
  }, [runPendingAction]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || event.shiftKey || event.altKey) return;
      if (String(event.key || "").toLowerCase() !== "s") return;
      event.preventDefault();
      event.stopPropagation();
      if (!hasUnsavedChangesRef.current) {
        toast.info("No changes to save");
        return;
      }
      handleSaveAllRef.current?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleDocumentClick = (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target === "_blank") return;
      const href = String(anchor.getAttribute("href") || "").trim();
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      if (href === window.location.pathname + window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      pendingActionRef.current = () => {
        window.location.href = href;
      };
      setShowUnsavedModal(true);
    };
    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [hasUnsavedChanges]);

  if (loading) return <AppConfigFormLoading />;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
      <form onSubmit={handleSaveAll} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Simplified Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setEditingId(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-sm"
            >
              <Plus size={14} /> New Shortcut
            </button>
            <button
              type="button"
              onClick={() => loadData()}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              title="Refresh"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              {shortcuts.length} Items
            </span>
          </div>
        </div>

      {/* Simple Table Form */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-slate-100">
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] w-16">#</th>
              <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Shortcut</th>
              <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Path / URL</th>
              <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] w-32">Access</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {shortcuts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-300">
                    <LinkIcon size={32} strokeWidth={1} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">No shortcuts found</p>
                  </div>
                </td>
              </tr>
            ) : (
              shortcuts.map((row, index) => (
                <tr key={row.id} className="hover:bg-slate-50/40 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-medium text-slate-400 w-4">{row.rank}</span>
                      <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => moveRank(index, 'up')} className="text-slate-300 hover:text-indigo-500"><ArrowUp size={10} /></button>
                        <button type="button" onClick={() => moveRank(index, 'down')} className="text-slate-300 hover:text-indigo-500"><ArrowDown size={10} /></button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="text-indigo-500 shrink-0">
                        {ICON_MAP[row.icon] || <LinkIcon size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-bold text-slate-700 text-[12px] tracking-tight ${row.parentId ? 'pl-4 border-l border-slate-200 ml-1' : ''}`}>
                          {row.label}
                        </p>
                        {row.parentId && <p className="text-[9px] text-slate-400 uppercase ml-4 mt-0.5">Sub-item</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-[11px] text-slate-400 font-medium truncate block max-w-[300px]">{row.url}</span>
                  </td>
                  <td className="px-4 py-4">
                    {row.allowedUsers?.length > 0 ? (
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">
                        {row.allowedUsers.length} {row.allowedUsers.length === 1 ? 'User' : 'Users'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">
                        Everyone
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => { setSelected(row.id); setEditingId(row.id); setModalOpen(true); }}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

        <AppConfigFormFooter 
          saving={saving} 
          dirtyCount={hasUnsavedChanges ? 1 : 0} 
          onReset={() => { loadData(); setHasUnsavedChanges(false); }} 
          submitLabel="Publish Changes" 
        />
      </form>

      <ShortcutModal 
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingId(null); }}
        onSave={handleAddOrUpdate}
        editData={shortcuts.find(s => s.id === (editingId || selected))}
        users={users}
        appPagesMap={appPagesMap}
        shortcuts={shortcuts}
        editingId={editingId}
      />

      {showUnsavedModal && (
        <>
          <button
            type="button"
            aria-label="Close unsaved changes dialog"
            className="fixed inset-0 z-[110] bg-slate-900/30"
            onClick={() => {
              pendingActionRef.current = null;
              setShowUnsavedModal(false);
            }}
          />
          <div className="fixed left-1/2 top-1/2 z-[120] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <p className="text-sm font-bold text-slate-800">Unsaved shortcut changes</p>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Do you want to save your changes before leaving, leave without saving, or stay on this page?
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleUnsavedSave}
                disabled={saving}
                className="flex-1 min-w-[100px] rounded-md bg-indigo-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleUnsavedLeave}
                disabled={saving}
                className="flex-1 min-w-[100px] rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-rose-600 hover:bg-rose-100 disabled:opacity-50"
              >
                Leave
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingActionRef.current = null;
                  setShowUnsavedModal(false);
                }}
                className="flex-1 min-w-[100px] rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50"
              >
                Stay
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
