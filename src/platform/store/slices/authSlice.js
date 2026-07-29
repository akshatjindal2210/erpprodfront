import { createSlice } from "@reduxjs/toolkit";
import { normalizeAppAccess } from "@/config/moduleAppRegistry";

const initialState = {
  user: null,
  role: null,
  permissions: [],
  app_access: {},
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const p = action.payload;
      state.user = {
        id: p.id,
        name: p.name,
        email: p.email ?? "",
        type: p.type ?? p.role ?? "user",
        designation: p.designation ?? null,
        designation_name: p.designation_name ?? p.designation?.name ?? null,
        department: p.department ?? null,
        department_id: p.department_id ?? p.department?.id ?? null,
        special_permissions: (typeof p.special_permissions === 'string' 
          ? JSON.parse(p.special_permissions) 
          : p.special_permissions) ?? {},
      };
      state.role = p.role ?? p.type ?? "user";
      state.permissions = p.permissions || [];
      state.app_access = normalizeAppAccess(p.app_access);
    },
    logout: (state) => {
      state.user = null;
      state.role = null;
      state.permissions = [];
      state.app_access = {};
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

// ── Selectors ─────────────────────────────────────────
export const selectUser        = (state) => state.auth.user;
export const selectRole        = (state) => state.auth.role;
export const selectPermissions = (state) => state.auth.permissions;
export const selectAppAccess   = (state) => state.auth.app_access;

const isModuleEnabledFromPerm = (perm) => {
  const statusCandidate = perm?.module_is_active;
  if (statusCandidate === undefined || statusCandidate === null) return true;
  if (typeof statusCandidate === "string") {
    const normalized = statusCandidate.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "active";
  }
  return !!statusCandidate;
};

// ── App Access check
export const selectHasAppAccess = (appKey) => (state) => {
  if (state.auth.role?.toLowerCase() === "super_admin") return true;
  const normalized = normalizeAppAccess(state.auth.app_access);
  if (Object.keys(normalized).length > 0) {
    return !!normalized[appKey];
  }
  return false;
};

// ── Module permission check
export const selectHasPermission = (moduleName, action) => (state) => {
  if (state.auth.role === "super_admin") return true;
  const perm = state.auth.permissions.find(p => p.module_name === moduleName);
  if (!perm) return false;
  if (!isModuleEnabledFromPerm(perm)) return false;
  return perm[`can_${action}`] === true;
};