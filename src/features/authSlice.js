import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  role: null,
  permissions: [],
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { id, name, role, email, permissions } = action.payload;
      state.user = { id, name, email };
      state.role = role;
      state.permissions = permissions || [];
    },
    logout: (state) => {
      state.user = null;
      state.role = null;
      state.permissions = [];
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

// ── Selectors ─────────────────────────────────────────
export const selectUser        = (state) => state.auth.user;
export const selectRole        = (state) => state.auth.role;
export const selectPermissions = (state) => state.auth.permissions;

const isModuleEnabledFromPerm = (perm) => {
  const statusCandidate = perm?.module_is_active;
  if (statusCandidate === undefined || statusCandidate === null) return true;
  if (typeof statusCandidate === "string") {
    const normalized = statusCandidate.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "active";
  }
  return !!statusCandidate;
};

// ── Module permission check
export const selectHasPermission = (moduleName, action) => (state) => {
  if (state.auth.role === "super_admin") return true;
  const perm = state.auth.permissions.find(p => p.module_name === moduleName);
  if (!perm) return false;
  if (!isModuleEnabledFromPerm(perm)) return false;
  return perm[`can_${action}`] === true;
};