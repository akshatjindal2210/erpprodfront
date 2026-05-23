"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { userService } from "@/services/user";
import { moduleService } from "@/services/module";
import SelectField from "@/components/common/SelectField";
import Drawer from "@/components/ui/Drawer";
import ModuleSopAcknowledgment from "@/components/common/ModuleSopAcknowledgment";
import { errInput, FieldError, okInput, ROLE_LABELS, selectCls, TYPES, USER_STATUSES, AUTH_SOURCES, AUTH_SOURCE_LABELS } from "@/components/common/Constants";
import { focusFirstError } from "@/utils/formFocus";

const FIELD_ORDER = ["name", "email", "phone", "username", "auth_source", "usercode", "password", "type", "status"];

const emailToUsername = (email) => email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 30);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Exactly 10 digits only (no +91 / country code). Spaces are stripped for validation. */
function normalizePhoneTo10Digits(raw) {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length === 10 ? d : null;
}

function isAllSameDigit10(d) {
  return /^(\d)\1{9}$/.test(d);
}

function isFullAscendingOrDescending10(d) {
  let asc = true;
  let desc = true;
  for (let i = 1; i < d.length; i++) {
    const a = d.charCodeAt(i - 1);
    const b = d.charCodeAt(i);
    if (b !== a + 1) asc = false;
    if (b !== a - 1) desc = false;
  }
  return asc || desc;
}

/** null = valid; otherwise error message for the field */
function getPhoneFieldError(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "Phone number is required";
  const n = normalizePhoneTo10Digits(t);
  if (!n) return "Enter exactly 10 digits (no +91 or country code)";
  if (!/^[6-9]\d{9}$/.test(n)) return "Mobile must start with 6, 7, 8, or 9";
  if (isAllSameDigit10(n)) return "Enter a real mobile number (not repeated digits)";
  if (isFullAscendingOrDescending10(n)) return "Enter a real mobile number (not a simple pattern like 123…)";
  return null;
}

/** Form display: 10 digits only; legacy DB value with leading 91 is trimmed once for editing */
function hydratePhoneForForm(stored) {
  const d = String(stored ?? "").replace(/\D/g, "");
  if (d.length === 10) return d;
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length < 10) return d;
  return "";
}

const EMPTY_FORM = {
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  status: "active",
  type: "user",
  auth_source: "local",
  usercode: "",
};

const imsRowKey = (row) => `${String(row.username || "").toLowerCase()}_${row.ims_usercode ?? row.usercode ?? ""}`;

function normalizeAuthSource(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "erp" ? "erp" : "local";
}

/** List row or API payload → form snapshot (same rules as GET-by-id hydration) */
function normalizedUserPayload(user) {
  if (!user) return null;
  let snapAuth = normalizeAuthSource(user.auth_source);
  let snapUc = user.usercode != null && String(user.usercode).trim() !== "" ? String(user.usercode) : "";
  if (snapAuth === "erp" && !snapUc) {
    snapAuth = "local";
    snapUc = "";
  }
  const form = {
    name: user.name || "",
    username: user.username || "",
    email: user.email || "",
    phone: hydratePhoneForForm(user.phone),
    status: user.status || "active",
    type: user.type || "user",
    auth_source: snapAuth,
    usercode: snapUc,
    password: "",
  };
  const snapshot = { auth: snapAuth, usercode: snapUc };
  let erpPickKey = "";
  if (snapAuth === "erp" && snapUc !== "") {
    erpPickKey = imsRowKey({ username: user.username ?? "", ims_usercode: user.usercode, usercode: user.usercode });
  }
  return { snapshot, form, erpPickKey };
}

const buildInitialPerms = (modules, existingPermissions = []) => {
  const perms = {};
  modules.forEach((mod) => {
    const existing = existingPermissions.find(
      (p) => p.module_name?.toLowerCase() === mod.name.toLowerCase()
    );
    perms[mod.id] = {
      can_view:      existing?.can_view      ?? false,
      can_view_days: existing?.can_view_days ?? 0,
      can_add:       existing?.can_add       ?? false,
      can_edit:      existing?.can_edit      ?? false,
      can_edit_days: existing?.can_edit_days ?? 0,
      can_delete:    existing?.can_delete    ?? false,
      can_authorize: existing?.can_authorize ?? false,
    };
  });
  return perms;
};

// ─── Reusable debounced duplicate check hook ──────────────────────
// status: "idle" | "checking" | "taken" | "available"
function useDuplicateCheck(fetchFn, delay = 600) {
  const [status, setStatus]   = useState("idle");
  const timerRef              = useRef(null);
  const controllerRef         = useRef(null);
  const seqRef                = useRef(0);

  const check = useCallback((value) => {
    // Cancel previous pending debounce + in-flight request
    clearTimeout(timerRef.current);
    controllerRef.current?.abort();

    if (!value?.trim()) { setStatus("idle"); return; }

    const seq = ++seqRef.current;
    setStatus("checking");

    timerRef.current = setTimeout(async () => {
      controllerRef.current = new AbortController();
      try {
        const taken = await fetchFn(value, controllerRef.current.signal);
        if (seq !== seqRef.current) return;
        setStatus(taken ? "taken" : "available");
      } catch (err) {
        if (seq !== seqRef.current) return;
        // AbortError means a newer check started — ignore silently
        if (err.name !== "AbortError") setStatus("idle");
      }
    }, delay);
  }, [fetchFn, delay]);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    controllerRef.current?.abort();
    setStatus("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    controllerRef.current?.abort();
  }, []);

  return { status, check, reset };
}

// ─── Inline status indicator shown below field ────────────────────
function FieldStatus({ status }) {
  if (status === "checking")  return <span className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5"><Loader2 size={10} className="animate-spin" />Checking…</span>;
  if (status === "taken")     return <span className="flex items-center gap-1 text-[11px] text-rose-500 mt-0.5"><XCircle size={10} />Already taken</span>;
  if (status === "available") return <span className="flex items-center gap-1 text-[11px] text-emerald-500 mt-0.5"><CheckCircle2 size={10} />Available</span>;
  return null;
}

export default function UserModal({ open, onClose, onSuccess, editUser }) {
  const isProvisioning = !!editUser && String(editUser.id ?? "").startsWith("pending_");
  const isDbUpdate = !!editUser && !isProvisioning;
  /** IMS directory synced rows already live in app DB — title must stay “Edit”, even if `id` is oddly shaped */
  const showEditTitle =
    !!editUser &&
    !String(editUser.id ?? "").startsWith("pending_") &&
    (Number.isFinite(Number(editUser.id)) || editUser.is_synced === true);

  const [form, setForm]               = useState(EMPTY_FORM);
  const [errors, setErrors]           = useState({});
  const [loading, setLoading]         = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [modules, setModules]         = useState([]);
  const [permissions, setPermissions] = useState({});
  const [globalViewDays, setGlobalViewDays] = useState(0);
  const [globalEditDays, setGlobalEditDays] = useState(0);
  /** GET /users/:id in flight — form still visible (seeded from table row) */
  const [detailSyncing, setDetailSyncing] = useState(false);
  const [imsOptions, setImsOptions] = useState([]);
  const [imsLoading, setImsLoading] = useState(false);
  const [erpPickKey, setErpPickKey] = useState("");
  /** Snapshot from DB when Edit opened — distinguishes real IMS-linked ERP vs stray `erp` rows */
  const [editSnapshot, setEditSnapshot] = useState(null);
  const freshUserForPermsRef = useRef(null);
  /** Until true, PUT must not send `permissions` — list rows have none; GET-by-id failures would wipe DB perms. */
  const serverProfileSyncedRef = useRef(false);
  const modulesRef = useRef(modules);
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  const focusFormErrors = (nextErrors) => {
    focusFirstError(nextErrors, FIELD_ORDER, (key) =>
      formRef.current?.querySelector(`[data-field="${key}"]`)
    );
  };
  modulesRef.current = modules;

  // ── Separate duplicate checkers (no shared state = no race condition) ─
  const checkUsernameFn = useCallback(async (value, signal) => {
    const needle = String(value ?? "").trim();
    if (!needle) return false;

    const res = await userService.getAll(
      {
        filters: { username: needle },
        permission_module: "users",
        permission_action: "view",
      },
      { signal }
    );
    const list = res.data?.data ?? res.data ?? [];
    if (!Array.isArray(list)) return false;
    const needleLower = needle.toLowerCase();
    return list.some((u) => {
      const uname = String(u.username ?? "").trim().toLowerCase();
      if (uname !== needleLower) return false;
      if (!isDbUpdate) return true;
      return Number(u.id) !== Number(editUser?.id);
    });
  }, [isDbUpdate, editUser?.id]);

  const checkPhoneFn = useCallback(async (value, signal) => {
    const res  = await userService.getAll({ 
      filters: { phone: value },
      permission_module: "users",
      permission_action: "view"
    }, { signal });
    const list = res.data?.data ?? res.data ?? [];
    if (!Array.isArray(list)) return false;
    return list.some((u) => (isDbUpdate ? u.id !== editUser?.id : true));
  }, [isDbUpdate, editUser?.id]);

  const usernameCheck = useDuplicateCheck(checkUsernameFn);
  const phoneCheck    = useDuplicateCheck(checkPhoneFn);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setShowPass(false);
    setGlobalViewDays(0);
    setGlobalEditDays(0);
    setErpPickKey("");
    usernameCheck.reset();
    phoneCheck.reset();

    if (!editUser) {
      setForm(EMPTY_FORM);
      setUsernameEdited(false);
      setPermissions({});
      setErpPickKey("");
      setImsOptions([]);
      setEditSnapshot(null);
      setDetailSyncing(false);
      freshUserForPermsRef.current = null;
      serverProfileSyncedRef.current = false;
    }
  }, [open, editUser]);

  // ── IMS directory picker: only Edit + ERP accounts (ERP users opened from ERP list use provisioning, no picker)
  useEffect(() => {
    if (!open || isProvisioning) return;
    if (!isDbUpdate || !editSnapshot) return;

    const authNorm = normalizeAuthSource(form.auth_source);
    if (authNorm !== "erp") return;

    const lockedErpLinked = normalizeAuthSource(editSnapshot.auth) === "erp" && String(editSnapshot.usercode ?? "").trim() !== "";
    const switchedFromApp = normalizeAuthSource(editSnapshot.auth) === "local" && authNorm === "erp";
    if (!(lockedErpLinked || switchedFromApp)) return;

    const load = async () => {
      setImsLoading(true);
      try {
        const res = await userService.getImsUsers({});
        const list = Array.isArray(res.data) ? res.data : [];
        const cur = Number(form.usercode);
        const pickList = list.filter((r) => {
          if (!r.is_synced) return true;
          const rc = Number(r.usercode ?? r.ims_usercode);
          return Number.isFinite(cur) && Number.isFinite(rc) && rc === cur;
        });
        setImsOptions(pickList);
      } catch (err) {
        toast.error(err?.message || "Failed to load IMS user directory");
      } finally {
        setImsLoading(false);
      }
    };
    load();
  }, [open, isProvisioning, isDbUpdate, editSnapshot, form.auth_source, form.usercode]);

  useEffect(() => {
    if (!open) return;
    const fetchModules = async () => {
      try {
        const res = await moduleService.getViews({
          page: 1,
          limit: 5000,
          sortBy: "sort_order",
          order: "ASC",
          permission_module: "users",
          permission_action: "view"
        });
        const list = res?.data ?? [];
        setModules(Array.isArray(list) ? list : []);
      } catch (err) {
        toast.error(err?.message || "Failed to load modules");
      }
    };
    fetchModules();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editUser?.id != null && !isProvisioning) return;
    if (modules.length === 0) return;
    setPermissions((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return buildInitialPerms(modules);
    });
  }, [open, editUser, modules, isProvisioning]);

  useEffect(() => {
    if (!open || modules.length === 0) return;
    if (!isProvisioning) return;

    setForm({
      name: editUser.name || "",
      username: editUser.username || "",
      email: editUser.email || "",
      phone: hydratePhoneForForm(editUser.phone),
      password: "",
      status: editUser.status || "inactive",
      type: editUser.type || "user",
      auth_source: "erp",
      usercode: String(editUser.ims_usercode ?? editUser.usercode ?? ""),
    });
    setUsernameEdited(true);
    setErpPickKey(imsRowKey(editUser));
    setPermissions(buildInitialPerms(modules));
  }, [open, isProvisioning, editUser?.id, modules]);

  useEffect(() => {
    if (!open || !editUser?.id || isProvisioning) return;

    let cancelled = false;
    serverProfileSyncedRef.current = false;
    const payload = normalizedUserPayload(editUser);
    if (payload) {
      setEditSnapshot(payload.snapshot);
      setForm({ ...payload.form, password: "" });
      setUsernameEdited(true);
      setErpPickKey(payload.erpPickKey);
      setImsOptions([]);
    }

    const applyServerUser = (user) => {
      const p = normalizedUserPayload(user);
      if (!p) return;
      setEditSnapshot(p.snapshot);
      setForm({ ...p.form, password: "" });
      setUsernameEdited(true);
      setErpPickKey(p.erpPickKey);
      freshUserForPermsRef.current = user;
      if (modulesRef.current.length > 0) {
        setPermissions(buildInitialPerms(modulesRef.current, user.permissions));
        freshUserForPermsRef.current = null;
      }
      serverProfileSyncedRef.current = true;
    };

    const run = async () => {
      setDetailSyncing(true);
      try {
        const res = await userService.getById(editUser.id);
        if (cancelled) return;
        const user = res.data?.data ?? res.data;
        applyServerUser(user);
      } catch (err) {
        if (!cancelled) toast.error(err?.message || "Failed to load user data");
      } finally {
        if (!cancelled) setDetailSyncing(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      setDetailSyncing(false);
    };
  }, [open, editUser?.id, isProvisioning]);

  useEffect(() => {
    if (!open || modules.length === 0) return;
    const u = freshUserForPermsRef.current;
    if (!u) return;
    setPermissions(buildInitialPerms(modules, u.permissions));
    freshUserForPermsRef.current = null;
  }, [open, modules]);

  useEffect(() => {
    if (!open || modules.length === 0 || !editUser?.id || isProvisioning) return;
    setPermissions((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return buildInitialPerms(modules, editUser.permissions);
    });
  }, [open, modules, editUser?.id, isProvisioning]);

  // ── Generic field setter ──────────────────────────────────────────
  const set = (k) => (e) => {
    let val = e.target.value;
    if (k === "email") val = val.toLowerCase();
    if (k === "phone") val = val.replace(/\D/g, "").slice(0, 10);

    setForm((prev) => {
      const next = { ...prev, [k]: val };
      if (k === "email" && !usernameEdited && !isDbUpdate && !isProvisioning) {
        next.username = emailToUsername(val);
        // Duplicate check runs on username field / save — not while typing email (avoids false "taken" on prefixes like "sagar" → "sagarshrama").
      }
      return next;
    });

    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));

    // Trigger duplicate checks — skip if value unchanged in edit mode
    if (k === "phone") {
      const norm = normalizePhoneTo10Digits(val);
      const editNorm =
        normalizePhoneTo10Digits(hydratePhoneForForm(editUser?.phone)) ||
        normalizePhoneTo10Digits(String(editUser?.phone ?? "").replace(/\D/g, ""));
      if (isDbUpdate && norm && editNorm && norm === editNorm) {
        phoneCheck.reset();
        return;
      }
      const fmtErr = getPhoneFieldError(val);
      if (!fmtErr && norm) phoneCheck.check(norm);
      else phoneCheck.reset();
    }
    if (k === "username") {
      if (isDbUpdate && val === editUser?.username) { usernameCheck.reset(); return; }
      usernameCheck.check(val);
    }
  };

  const handleUsernameChange = (e) => {
    setUsernameEdited(true);
    set("username")(e);
  };

  const handleAuthSourceChange = (e) => {
    const val = e.target.value;
    setForm((prev) => ({
      ...prev,
      auth_source: val,
      ...(val === "local" ? { usercode: "" } : {}),
    }));
    if (val === "local") setErpPickKey("");
    if (errors.auth_source) setErrors((prev) => ({ ...prev, auth_source: "" }));
  };

  const handleErpPickChange = (e) => {
    const key = e.target.value;
    setErpPickKey(key);
    const row = imsOptions.find((r) => imsRowKey(r) === key);
    if (row) {
      setForm((prev) => ({
        ...prev,
        auth_source: "erp",
        username: row.username || prev.username,
        usercode: String(row.ims_usercode ?? row.usercode ?? ""),
      }));
      setUsernameEdited(true);
      usernameCheck.reset();
    }
  };

  // ── Permission helpers ────────────────────────────────────────────
  
  /*
  const handlePermissionToggle = (moduleId, field) => {
    setPermissions((prev) => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [field]: !prev[moduleId][field] },
    }));
  };
  */

  const handlePermissionToggle = (moduleId, field) => {
    setPermissions((prev) => {
      const currentMod = prev[moduleId] || {};
      const newState = !currentMod[field];
      
      let updatedModule = { ...currentMod, [field]: newState };
      
      if (field === "can_view" && newState === false) {
        updatedModule.can_add = false;
        updatedModule.can_edit = false;
        updatedModule.can_delete = false;
        updatedModule.can_authorize = false;
        updatedModule.can_view_days = 0;
        updatedModule.can_edit_days = 0;
      }

      return { ...prev, [moduleId]: updatedModule };
    });
  };
 
  /*
  const toggleAllForField = (field) => {
    const allOn = modules.every((m) => permissions[m.id]?.[field]);
    setPermissions((prev) => {
      const updated = { ...prev };
      modules.forEach((m) => { updated[m.id] = { ...updated[m.id], [field]: !allOn }; });
      return updated;
    });
  };
  */

  const toggleAllForField = (field) => {
    const allOn = modules.every((m) => permissions[m.id]?.[field]);
    const nextState = !allOn;

    setPermissions((prev) => {
      const updated = { ...prev };
      modules.forEach((m) => {
        updated[m.id] = { ...updated[m.id], [field]: nextState };
        
        if (field === "can_view" && nextState === false) {
          updated[m.id].can_add = false;
          updated[m.id].can_edit = false;
          updated[m.id].can_delete = false;
          updated[m.id].can_authorize = false;
          updated[m.id].can_view_days = 0;
          updated[m.id].can_edit_days = 0;
        }
      });
      return updated;
    });
  };

  // ── Validate ──────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    const imsLike = normalizeAuthSource(form.auth_source) === "erp";
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.username.trim()) e.username = "Username is required";
    if (form.email.trim() && !EMAIL_RE.test(form.email)) e.email = "Enter a valid email address";

    if (!form.phone.trim()) e.phone = "Phone number is required";
    else {
      const pe = getPhoneFieldError(form.phone);
      if (pe) e.phone = pe;
    }

    if (!isDbUpdate && normalizeAuthSource(form.auth_source) === "local" && !form.password.trim()) {
      e.password = "Password is required for App sign-in";
    }

    if (imsLike && !isProvisioning && !String(form.usercode || "").trim()) {
      e.usercode = isDbUpdate ? "Pick an IMS user" : "IMS user code required";
    }

    return e;
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSave = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fix the errors before saving");
      focusFormErrors(validationErrors);
      return;
    }

    const trimmedUsername = form.username.trim();

    // Block submit if check still in progress
    if (usernameCheck.status === "checking" || phoneCheck.status === "checking") {
      toast.warning("Please wait, checking for duplicates…");
      return;
    }
    // Block submit if duplicate found (re-check server so stale "taken" from typing "sagar" → "sagarshrama" cannot block save)
    let usernameTaken = usernameCheck.status === "taken";
    if (!usernameTaken && trimmedUsername) {
      try {
        usernameTaken = await checkUsernameFn(trimmedUsername);
      } catch {
        /* network — server will validate on save */
      }
    }
    if (usernameTaken) {
      const dup = { username: "This username is already taken" };
      setErrors((p) => ({ ...p, ...dup }));
      usernameCheck.check(trimmedUsername);
      toast.error("Please resolve duplicate username");
      focusFormErrors(dup);
      return;
    }
    if (phoneCheck.status === "taken") {
      const dup = { phone: "This phone number is already in use" };
      setErrors((p) => ({ ...p, ...dup }));
      toast.error("Please resolve duplicate phone number");
      focusFormErrors(dup);
      return;
    }

    if (!sopAckRef.current?.assertAcknowledged()) return;

    const phoneNorm = normalizePhoneTo10Digits(form.phone);
    if (!phoneNorm) {
      const pe = { phone: "Phone number is required" };
      setErrors((p) => ({ ...p, ...pe }));
      toast.error("Phone number is required");
      focusFormErrors(pe);
      return;
    }
    if (!trimmedUsername) {
      const ue = { username: "Username is required" };
      setErrors((p) => ({ ...p, ...ue }));
      toast.error("Username is required");
      focusFormErrors(ue);
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form };
      const emailTrim = form.email.trim();
      payload.email = emailTrim ? emailTrim.toLowerCase() : null;
      payload.phone = phoneNorm;
      payload.username = trimmedUsername;

      if (!isDbUpdate || serverProfileSyncedRef.current) payload.permissions = permissions;
      if (normalizeAuthSource(form.auth_source) === "local") {
        delete payload.usercode;
      } else if (String(form.usercode || "").trim()) {
        payload.usercode = Number(form.usercode);
      }
      if (isDbUpdate && !payload.password?.trim()) delete payload.password;
      if (!isDbUpdate && !payload.password?.trim()) delete payload.password;

      if (isDbUpdate) {
        await userService.update(editUser.id, payload);
        toast.success("User updated successfully");
      } else {
        await userService.create(payload);
        toast.success("User created successfully");
      }
      onSuccess();
      onClose();
    } catch (err) {
      // `api()` throws Error with server `message` (not Axios `err.response`)
      const msg = (typeof err?.message === "string" && err.message.trim()) ? err.message.trim() : (err?.payload?.message || "");
      const lower = msg.toLowerCase();
      if (lower.includes("phone")) {
        setErrors((p) => ({ ...p, phone: msg }));
        toast.error(msg);
      } else if (lower.includes("username")) {
        setErrors((p) => ({ ...p, username: msg }));
        toast.error(msg);
      } else if (lower.includes("email")) {
        setErrors((p) => ({ ...p, email: msg }));
        toast.error(msg);
      } else toast.error(msg || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Header checkbox helper ────────────────────────────────────────
  const ColHeader = ({ label, field }) => (
    <th className="px-2 py-3 text-center">
      <div className="flex flex-col items-center gap-1">
        <span>{label}</span>
        <input
          type="checkbox"
          checked={modules.length > 0 && modules.every((m) => permissions[m.id]?.[field])}
          onChange={() => toggleAllForField(field)}
          className="w-3.5 h-3.5 rounded border-slate-300 cursor-pointer accent-indigo-600"
        />
      </div>
    </th>
  );

  const isBusy =
    loading ||
    detailSyncing ||
    imsLoading ||
    usernameCheck.status === "checking" ||
    phoneCheck.status === "checking";

  const authNorm = normalizeAuthSource(form.auth_source);
  const imsDirectoryMode = authNorm === "erp";

  const lockedErpProfile =
    isDbUpdate &&
    !!editSnapshot &&
    normalizeAuthSource(editSnapshot.auth) === "erp" &&
    String(editSnapshot.usercode ?? "").trim() !== "";

  const switchedFromAppToErp = !!editSnapshot && normalizeAuthSource(editSnapshot.auth) === "local" && imsDirectoryMode;

  const showErpDirectoryRow = isDbUpdate && imsDirectoryMode && (lockedErpProfile || switchedFromAppToErp);

  const usernameLocked = isProvisioning;
  const showLocalPassword = authNorm === "local";

  const isPlainAdd = !isDbUpdate && !isProvisioning;
  /** App row (not IMS-linked ERP) — editable sign-in, optional password unless switched to ERP */
  const isEditLocal = isDbUpdate && !lockedErpProfile;
  const signInLocked = !isProvisioning && (isPlainAdd || lockedErpProfile);

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSave}
      title={isDbUpdate ? "Edit User" : "New User"}
      description={isDbUpdate ? "Update user details and permissions" : "Register a new application user"}
      maxWidth="max-w-6xl"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-xl bg-white hover:bg-slate-50 transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isBusy}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Saving…
              </>
            ) : (
              <><Check size={15} />Save</>
            )}
          </button>
        </div>
      }
    >
      <div ref={formRef} className="overflow-y-auto flex-1 space-y-5">
        {isDbUpdate && detailSyncing ? (
          <div className="flex items-center gap-2 px-1 py-1.5 text-[11px] text-slate-600 border-b border-slate-100 -mt-1 mb-1">
            <Loader2 size={12} className="animate-spin shrink-0" />
            <span>Syncing latest from server…</span>
          </div>
        ) : null}
          <div className="flex flex-col gap-3">
            {/* Row 1 · four fields · mobile 1 col → sm 2 → lg 4 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input data-field="name" value={form.name} onChange={set("name")} placeholder="Full name" className={errors.name ? errInput : okInput} />
                <FieldError msg={errors.name} />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Email <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <input data-field="email" type="text" value={form.email} onChange={set("email")} placeholder="john@example.com" className={errors.email ? errInput : okInput} autoComplete="off" />
                <FieldError msg={errors.email} />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Phone <span className="text-rose-400">*</span>
                </label>
                <input
                  data-field="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="10-digit mobile"
                  maxLength={10}
                  className={errors.phone || phoneCheck.status === "taken" ? errInput : okInput}
                />
                {errors.phone
                  ? <FieldError msg={errors.phone} />
                  : <FieldStatus status={phoneCheck.status} />
                }
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Username <span className="text-rose-400">*</span>
                </label>
                <input
                  data-field="username"
                  value={form.username}
                  onChange={handleUsernameChange}
                  readOnly={usernameLocked}
                  placeholder="auto_from_email"
                  className={`${errors.username || usernameCheck.status === "taken" ? errInput : okInput} ${usernameLocked ? "bg-slate-50" : ""}`}
                />
                {errors.username
                  ? <FieldError msg={errors.username} />
                  : !usernameEdited && form.email
                    ? <p className="text-[11px] text-slate-400 mt-0.5">From email</p>
                    : <FieldStatus status={usernameCheck.status} />
                }
              </div>
            </div>

            {isProvisioning ? (
              /* Case · ERP from directory — row 2: Sign-in, Role, Status + empty 4th slot (lg) for alignment */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <SelectField
                    dataField="auth_source"
                    label="Sign-in"
                    required
                    value={form.auth_source}
                    onChange={handleAuthSourceChange}
                    options={
                      AUTH_SOURCES.includes(form.auth_source) ? AUTH_SOURCES : [...AUTH_SOURCES, form.auth_source]
                    }
                    labelMap={{
                      ...AUTH_SOURCE_LABELS,
                      ...(form.auth_source && !AUTH_SOURCE_LABELS[form.auth_source] ? { [form.auth_source]: form.auth_source } : {}),
                    }}
                    error={errors.auth_source}
                    selectCls={selectCls}
                    disabled
                  />
                </div>

                <div className="space-y-1">
                  <SelectField dataField="type" label="Role" required value={form.type} onChange={set("type")} options={TYPES} labelMap={ROLE_LABELS} error={errors.type} selectCls={selectCls} />
                </div>

                <div className="space-y-1">
                  <SelectField dataField="status" label="Status" required options={USER_STATUSES} value={form.status} onChange={set("status")} error={errors.status} selectCls={selectCls} />
                </div>

                <div className="hidden lg:block min-h-0 pointer-events-none" aria-hidden="true" />
              </div>
            ) : showErpDirectoryRow ? (
              /* ERP row: 4 cells on lg — switch flow = IMS | Sign-in | Role | Status; else Sign-in | Role | Status | (spacer) */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {switchedFromAppToErp ? (
                  <div className="space-y-1" data-field="usercode">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      IMS user <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={erpPickKey}
                        onChange={handleErpPickChange}
                        disabled={imsLoading}
                        className={`${errors.usercode ? errInput : selectCls} pr-9`}
                        aria-busy={imsLoading}
                      >
                        <option value="">{imsLoading ? "Loading directory…" : "Select IMS user to link"}</option>
                        {imsOptions.map((row) => {
                          const key = imsRowKey(row);
                          const code = row.ims_usercode ?? row.usercode ?? "";
                          return (
                            <option key={key} value={key}>
                              {(row.username || "") + (code !== "" && code != null ? ` (${code})` : "")}
                            </option>
                          );
                        })}
                      </select>
                      {imsLoading ? (
                        <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400 pointer-events-none" />
                      ) : null}
                    </div>
                    <FieldError msg={errors.usercode} />
                  </div>
                ) : null}

                <div className="space-y-1">
                  <SelectField
                    dataField="auth_source"
                    label="Sign-in"
                    required
                    value={form.auth_source}
                    onChange={handleAuthSourceChange}
                    options={
                      AUTH_SOURCES.includes(form.auth_source) ? AUTH_SOURCES : [...AUTH_SOURCES, form.auth_source]
                    }
                    labelMap={{
                      ...AUTH_SOURCE_LABELS,
                      ...(form.auth_source && !AUTH_SOURCE_LABELS[form.auth_source] ? { [form.auth_source]: form.auth_source } : {}),
                    }}
                    error={errors.auth_source}
                    selectCls={selectCls}
                    disabled={signInLocked}
                  />
                </div>

                <div className="space-y-1">
                  <SelectField dataField="type" label="Role" required value={form.type} onChange={set("type")} options={TYPES} labelMap={ROLE_LABELS} error={errors.type} selectCls={selectCls} />
                </div>

                <div className="space-y-1">
                  <SelectField dataField="status" label="Status" required options={USER_STATUSES} value={form.status} onChange={set("status")} error={errors.status} selectCls={selectCls} />
                </div>

                {!switchedFromAppToErp ? (
                  <div className="hidden lg:block min-h-0 pointer-events-none" aria-hidden="true" />
                ) : null}
              </div>
            ) : (
              /* Row 2 · sign-in · password · role · status */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <SelectField
                    dataField="auth_source"
                    label="Sign-in"
                    required
                    value={form.auth_source}
                    onChange={handleAuthSourceChange}
                    options={
                      isPlainAdd
                        ? AUTH_SOURCES.filter((s) => s === "local")
                        : AUTH_SOURCES.includes(form.auth_source) ? AUTH_SOURCES : [...AUTH_SOURCES, form.auth_source]
                    }
                    labelMap={{
                      ...AUTH_SOURCE_LABELS,
                      ...(form.auth_source && !AUTH_SOURCE_LABELS[form.auth_source] ? { [form.auth_source]: form.auth_source } : {}),
                    }}
                    error={errors.auth_source}
                    selectCls={selectCls}
                    disabled={signInLocked}
                  />
                </div>

                {showLocalPassword && (isPlainAdd || isEditLocal) ? (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Password{" "}
                      {isPlainAdd ? (
                        <span className="text-rose-400">*</span>
                      ) : (
                        <span className="text-slate-400 font-medium normal-case tracking-normal text-[10px]">
                          (optional)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        data-field="password"
                        type={showPass ? "text" : "password"}
                        value={form.password}
                        onChange={set("password")}
                        placeholder={isEditLocal ? "Leave blank to keep current password" : "Enter password"}
                        className={`${errors.password ? errInput : okInput} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-400"
                      >
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <FieldError msg={errors.password} />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {imsDirectoryMode ? "App password" : "Password"}
                    </label>
                    <input
                      readOnly
                      value="—"
                      className={`${okInput} bg-slate-50 text-slate-400 text-sm cursor-default`}
                      tabIndex={-1}
                      aria-label={imsDirectoryMode ? "No app password for ERP — IMS authenticates" : "Password not applicable"}
                    />
                    {imsDirectoryMode ? (
                      <p className="text-[10px] text-slate-500">IMS validates credentials; this row is linked by username and IMS code only.</p>
                    ) : null}
                  </div>
                )}

                <div className="space-y-1">
                  <SelectField dataField="type" label="Role" required value={form.type} onChange={set("type")} options={TYPES} labelMap={ROLE_LABELS} error={errors.type} selectCls={selectCls} />
                </div>

                <div className="space-y-1">
                  <SelectField dataField="status" label="Status" required options={USER_STATUSES} value={form.status} onChange={set("status")} error={errors.status} selectCls={selectCls} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-600">Modules</h4>

            <div className="border border-slate-200 bg-white shadow-sm">
              <div className="max-h-[600px] overflow-y-auto overflow-x-auto relative">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                    <tr className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      <th className="px-4 py-3">Module</th>
                      <ColHeader label="View"     field="can_view" />
                      <ColHeader label="Add"      field="can_add" />
                      <ColHeader label="Edit"     field="can_edit" />
                      <ColHeader label="Delete"   field="can_delete" />
                      <ColHeader label="Approved" field="can_authorize" />

                      <th className="px-2 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span>View Days</span>
                          <input type="number" min="0" value={globalViewDays || ""} placeholder="0"
                            onChange={(e) => {
                              const num = e.target.value === "" ? 0 : Number(e.target.value);
                              setGlobalViewDays(num);
                              setPermissions((prev) => {
                                const updated = { ...prev };
                                modules.forEach((m) => { if (updated[m.id]?.can_view) updated[m.id] = { ...updated[m.id], can_view_days: num }; });
                                return updated;
                              });
                            }}
                            className="w-14 text-center border border-slate-200 rounded-md px-1 py-0.5 text-[10px]"
                          />
                          <span className="text-[9px] text-slate-400">0 = unlimited</span>
                        </div>
                      </th>

                      <th className="px-2 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span>Edit Days</span>
                          <input type="number" min="0" value={globalEditDays || ""} placeholder="0"
                            onChange={(e) => {
                              const num = e.target.value === "" ? 0 : Number(e.target.value);
                              setGlobalEditDays(num);
                              setPermissions((prev) => {
                                const updated = { ...prev };
                                modules.forEach((m) => { if (updated[m.id]?.can_edit) updated[m.id] = { ...updated[m.id], can_edit_days: num }; });
                                return updated;
                              });
                            }}
                            className="w-14 text-center border border-slate-200 rounded-md px-1 py-0.5 text-[10px]"
                          />
                          <span className="text-[9px] text-slate-400">0 = unlimited</span>
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {modules.map((mod) => (
                      <tr key={mod.id} className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* <td className="px-4 py-2.5 font-semibold text-slate-700 text-xs">{mod.label}</td> */}
                        <td className="px-4 py-2.5 font-semibold text-slate-700 text-xs sticky left-0 bg-white z-10 border-r border-slate-50">{mod.label}</td>
                        {["can_view", "can_add", "can_edit", "can_delete", "can_authorize"].map((field) => (
                          <td key={field} className="px-2 py-2.5 text-center">
                            <input type="checkbox"
                              checked={permissions[mod.id]?.[field] || false}
                              onChange={() => handlePermissionToggle(mod.id, field)}
                              className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-indigo-600"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2.5 text-center">
                          <input type="number" min="0" placeholder="0"
                            value={permissions[mod.id]?.can_view_days || ""}
                            disabled={!permissions[mod.id]?.can_view}
                            onChange={(e) => setPermissions((prev) => ({ ...prev, [mod.id]: { ...prev[mod.id], can_view_days: e.target.value === "" ? 0 : Number(e.target.value) } }))}
                            className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <input type="number" min="0" placeholder="0"
                            value={permissions[mod.id]?.can_edit_days || ""}
                            disabled={!permissions[mod.id]?.can_edit}
                            onChange={(e) => setPermissions((prev) => ({ ...prev, [mod.id]: { ...prev[mod.id], can_edit_days: e.target.value === "" ? 0 : Number(e.target.value) } }))}
                            className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {modules.length === 0 && (
                <div className="p-10 text-center text-slate-400 text-xs italic">Loading modules…</div>
              )}
            </div>
          </div>
          
          <ModuleSopAcknowledgment
            ref={sopAckRef}
            key={`${open}-${isDbUpdate ? "edit" : "add"}`}
            moduleSlug="users"
            permissionType={isDbUpdate ? "edit" : "add"}
            isOpen={open}
          />
      </div>
    </Drawer>
  );
}