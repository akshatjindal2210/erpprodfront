"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { AlertCircle, Loader2, Shield } from "lucide-react";
import {
  APP_ACCESS,
  PORTAL_APP_KEYS,
  getModulesForAppKey,
} from "@/config/moduleAppRegistry";

const PERM_COLUMNS = [
  { key: "can_view", label: "View" },
  { key: "can_add", label: "Add" },
  { key: "can_edit", label: "Edit" },
  { key: "can_delete", label: "Delete" },
  { key: "can_authorize", label: "Approve" },
];

function AccessSwitch({ enabled, disabled, onChange }) {
  return (
    <label className={`inline-flex items-center gap-2.5 select-none ${disabled ? "opacity-50" : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => !disabled && onChange(!enabled)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed ${
          enabled ? "bg-indigo-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4" : ""
          }`}
        />
      </button>
      <span className="text-sm text-slate-700">Allow access</span>
    </label>
  );
}

function DaysNumberInput({ value, disabled, onChange, ariaLabel }) {
  return (
    <input
      type="number"
      min={0}
      max={3650}
      placeholder="0"
      value={value > 0 ? value : ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="w-12 text-center border border-slate-200 rounded px-1 py-0.5 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
    />
  );
}

/** Checkbox that supports an indeterminate (partial) state for "select all" headers. */
function HeaderCheckbox({ checked, indeterminate, onChange, ariaLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !checked && !!indeterminate;
  }, [checked, indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 cursor-pointer"
    />
  );
}

function ModulePermissionTable({
  moduleList,
  permissions,
  onToggle,
  onToggleAll,
  onClearAll,
  onSelectAll,
  onDaysChange,
  onApplyGlobalDays,
}) {
  const [globalViewDays, setGlobalViewDays] = useState("");
  const [globalEditDays, setGlobalEditDays] = useState("");

  useEffect(() => {
    setGlobalViewDays("");
    setGlobalEditDays("");
  }, [moduleList]);

  const colState = useCallback(
    (key) => {
      const total = moduleList.length;
      const on = moduleList.reduce((n, m) => n + (permissions[m.id]?.[key] ? 1 : 0), 0);
      return { all: total > 0 && on === total, some: on > 0 && on < total };
    },
    [moduleList, permissions]
  );

  // Master "select all" across every module + every permission column.
  const masterState = useMemo(() => {
    const total = moduleList.length * PERM_COLUMNS.length;
    let on = 0;
    moduleList.forEach((m) => {
      PERM_COLUMNS.forEach(({ key }) => {
        if (permissions[m.id]?.[key]) on += 1;
      });
    });
    return { all: total > 0 && on === total, some: on > 0 && on < total };
  }, [moduleList, permissions]);

  if (!moduleList?.length) {
    return (
      <p className="text-sm text-slate-500 py-10 text-center">
        No modules for this application.
      </p>
    );
  }

  return (
    <div>
      <div className="flex justify-end px-3 py-1.5 border-b border-slate-100">
        <button
          type="button"
          className="text-[11px] text-slate-500 hover:text-rose-600"
          onClick={() => onClearAll?.(moduleList)}
        >
          Clear all
        </button>
      </div>
      <div className="overflow-auto max-h-[min(48vh,400px)]">
          <table className="w-full text-sm border-collapse min-w-[680px]">
            <thead className="sticky top-0 z-30">
              <tr className="border-b border-slate-200">
                <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 min-w-[150px] sticky left-0 bg-slate-50 z-40">
                  <div className="flex items-center gap-2">
                    <HeaderCheckbox
                      checked={masterState.all}
                      indeterminate={masterState.some}
                      onChange={() => onSelectAll?.(moduleList, !masterState.all)}
                      ariaLabel="Select all permissions for all modules"
                    />
                    <span>Module</span>
                  </div>
                </th>
                {PERM_COLUMNS.map(({ key, label }) => {
                  const { all, some } = colState(key);
                  return (
                    <th key={key} className="py-1.5 px-2 text-center align-top bg-slate-50">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                      <div className="mt-1 flex justify-center">
                        <HeaderCheckbox
                          checked={all}
                          indeterminate={some}
                          onChange={() => onToggleAll(key, moduleList)}
                          ariaLabel={`Toggle ${label} for all modules`}
                        />
                      </div>
                    </th>
                  );
                })}
                <th className="py-1.5 px-2 text-center align-top bg-slate-50">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">View days</div>
                  <div className="mt-1">
                    <DaysNumberInput
                      value={globalViewDays === "" ? 0 : Number(globalViewDays)}
                      disabled={false}
                      ariaLabel="Apply view days to all modules with view access"
                      onChange={(v) => {
                        setGlobalViewDays(v);
                        onApplyGlobalDays?.("can_view", "can_view_days", v, moduleList);
                      }}
                    />
                  </div>
                  <span className="block mt-0.5 text-[9px] font-normal text-slate-400">0 = unlimited</span>
                </th>
                <th className="py-1.5 px-2 text-center align-top bg-slate-50">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Edit days</div>
                  <div className="mt-1">
                    <DaysNumberInput
                      value={globalEditDays === "" ? 0 : Number(globalEditDays)}
                      disabled={false}
                      ariaLabel="Apply edit days to all modules with edit access"
                      onChange={(v) => {
                        setGlobalEditDays(v);
                        onApplyGlobalDays?.("can_edit", "can_edit_days", v, moduleList);
                      }}
                    />
                  </div>
                  <span className="block mt-0.5 text-[9px] font-normal text-slate-400">0 = unlimited</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {moduleList.map((mod) => {
                const row = permissions[mod.id] || {};
                return (
                  <tr key={mod.id} className="group hover:bg-indigo-50/40">
                    <td className="py-2.5 px-3 text-slate-700 text-[13px] sticky left-0 bg-white group-hover:bg-indigo-50/40 z-10 border-r border-slate-100 transition-colors">
                      {mod.label}
                    </td>
                    {PERM_COLUMNS.map(({ key, label }) => (
                      <td key={key} className="py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!row[key]}
                          onChange={() => onToggle(mod.id, key)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 cursor-pointer"
                          aria-label={`${mod.label} ${label}`}
                        />
                      </td>
                    ))}
                    <td className="py-2.5 text-center">
                      <DaysNumberInput
                        value={row.can_view_days ?? 0}
                        disabled={!row.can_view}
                        ariaLabel={`${mod.label} view days`}
                        onChange={(v) => onDaysChange(mod.id, "can_view_days", v)}
                      />
                    </td>
                    <td className="py-2.5 text-center">
                      <DaysNumberInput
                        value={row.can_edit_days ?? 0}
                        disabled={!row.can_edit}
                        ariaLabel={`${mod.label} edit days`}
                        onChange={(v) => onDaysChange(mod.id, "can_edit_days", v)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>
    </div>
  );
}

export default function UserPermissionsPanel({
  modulesLoading,
  modulesError,
  onRetryModules,
  coreModules,
  imsModules,
  taskModules,
  rmStoreModules,
  appAccess,
  activePermTab,
  onActivePermTabChange,
  onAppAccessToggle,
  permissions,
  onPermissionToggle,
  onPermissionDaysChange,
  onApplyGlobalDays,
  onToggleAllForField,
  onClearAllForList,
  onSelectAllPermissions,
  userRole,
  imsSpecialPermissionsSection = null,
  taskSpecialPermissionsSection = null,
  rmstoreSpecialPermissionsSection = null,
}) {
  const isSuperAdmin = userRole === "super_admin";
  const activeMeta = APP_ACCESS[activePermTab];
  const enabled = isSuperAdmin || appAccess[activePermTab];

  const moduleList = useMemo(
    () =>
      getModulesForAppKey(activePermTab, {
        imsModules,
        coreModules,
        taskModules,
        rmStoreModules,
      }),
    [activePermTab, imsModules, coreModules, taskModules, rmStoreModules]
  );

  const handleTabKeyDown = useCallback(
    (e) => {
      const idx = PORTAL_APP_KEYS.indexOf(activePermTab);
      if (idx < 0) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onActivePermTabChange(PORTAL_APP_KEYS[(idx + 1) % PORTAL_APP_KEYS.length]);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onActivePermTabChange(PORTAL_APP_KEYS[(idx - 1 + PORTAL_APP_KEYS.length) % PORTAL_APP_KEYS.length]);
      }
    },
    [activePermTab, onActivePermTabChange]
  );

  if (modulesLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 border border-slate-200 rounded-lg">
        <Loader2 size={16} className="animate-spin" />
        Loading…
      </div>
    );
  }

  if (modulesError) {
    return (
      <div className="py-8 text-center text-sm border border-slate-200 rounded-lg">
        <p className="text-rose-600">{modulesError}</p>
        <button type="button" onClick={onRetryModules} className="mt-2 text-indigo-600 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      {/* Tabs — App Configuration style */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 pt-2">
        <div
          className="flex items-end gap-1 overflow-x-auto -mb-px"
          role="tablist"
          aria-label="Applications"
          onKeyDown={handleTabKeyDown}
        >
          {PORTAL_APP_KEYS.map((appKey) => {
            const meta = APP_ACCESS[appKey];
            const selected = activePermTab === appKey;
            return (
              <button
                key={appKey}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                id={`user-perm-tab-${appKey}`}
                aria-controls={`user-perm-panel-${appKey}`}
                onClick={() => onActivePermTabChange(appKey)}
                className={`shrink-0 min-w-[80px] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide border transition-colors ${
                  selected
                    ? "border-slate-200 border-b-white bg-white text-indigo-700"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active tab panel */}
      <div
        id={`user-perm-panel-${activePermTab}`}
        role="tabpanel"
        aria-labelledby={`user-perm-tab-${activePermTab}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-b border-slate-100">
          <p className="text-xs text-slate-500">
            {isSuperAdmin 
              ? "Super Admin has full access to all applications and modules" 
              : !enabled 
                ? "Enable access to edit modules"
                : activeMeta?.hasModulePermissions 
                  ? "Set permissions for each module" 
                  : `Access to ${activeMeta?.label} is enabled`}
          </p>
          {!isSuperAdmin && (
            <AccessSwitch
              enabled={enabled}
              onChange={(on) => onAppAccessToggle(activePermTab, on)}
            />
          )}
        </div>

        {isSuperAdmin ? (
          <div className="py-12 px-6 text-center bg-slate-50/50">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-600 mb-3">
              <Shield size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">Full Access Enabled</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              As a Super Admin, this user automatically has full permissions across all modules in the <span className="font-semibold text-slate-700">{activeMeta?.label}</span> application.
            </p>
          </div>
        ) : !enabled ? (
          <p className="text-sm text-slate-400 py-10 text-center bg-slate-50">
            Turn on access for <span className="font-medium text-slate-600">{activeMeta?.label}</span>.
          </p>
        ) : activeMeta?.hasModulePermissions && moduleList.length > 0 ? (
          <ModulePermissionTable
            moduleList={moduleList}
            permissions={permissions}
            onToggle={onPermissionToggle}
            onToggleAll={onToggleAllForField}
            onClearAll={onClearAllForList}
            onSelectAll={onSelectAllPermissions}
            onDaysChange={onPermissionDaysChange}
            onApplyGlobalDays={onApplyGlobalDays}
          />
        ) : null}

        {(enabled || isSuperAdmin) && activePermTab === "ims" && imsSpecialPermissionsSection ? (
          <div className="border-t border-slate-100 px-3 py-4 bg-slate-50/40">
            {imsSpecialPermissionsSection}
          </div>
        ) : null}

        {(enabled || isSuperAdmin) && activePermTab === "task" && taskSpecialPermissionsSection ? (
          <div className="border-t border-slate-100 px-3 py-4 bg-slate-50/40">
            {taskSpecialPermissionsSection}
          </div>
        ) : null}

        {(enabled || isSuperAdmin) && activePermTab === "rmstore" && rmstoreSpecialPermissionsSection ? (
          <div className="border-t border-slate-100 px-3 py-4 bg-slate-50/40">
            {rmstoreSpecialPermissionsSection}
          </div>
        ) : null}
      </div>
    </div>
  );
}
