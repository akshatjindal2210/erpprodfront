import { AlertCircle, Settings, Shield, UserIcon } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

export { MODULE_DISABLED_MESSAGE, NO_ACCESS_MESSAGE, FLOW_SCAN_REJECTED_MSG, FLOW_SCAN_CAMERA_ERROR_MSG, SCAN_SNACK_MSG } from "@/core/utils/global";

export const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  user: "User",
  executive_assistant: "Executive Assistant",
};
export const TYPES = ["super_admin", "admin", "user", "executive_assistant"];

// ── Avatar gradient colors
export const AVATAR_COLORS = [
  "from-violet-400 to-purple-500",
  "from-blue-400 to-cyan-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-amber-500",
  "from-rose-400 to-pink-500",
  "from-indigo-400 to-blue-500",
];

export function getAvatarColor(id) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export const USER_STATUSES = ["active", "inactive", "training"];

// ── Status badge styles
export const USER_STATUS_CONFIG = {
  active:     { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", label: "Active"    },
  inactive:   { bg: "bg-slate-100",  text: "text-slate-600",   border: "border-slate-200",   dot: "bg-slate-400",  label: "Inactive"  },
  training:   { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500", label: "Training" },
};

export const USER_TYPE_CONFIG = {
  super_admin: {
    label: "Super Admin",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: <Shield size={12} className="text-amber-500" />
  },
  admin: {
    label: "Admin",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    icon: <Settings size={12} className="text-indigo-500" />
  },
  user: {
    label: "User",
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
    icon: <UserIcon size={12} className="text-slate-400" />
  },
  executive_assistant: {
    label: "Executive Assistant",
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    icon: <UserIcon size={12} className="text-teal-500" />
  },
};

/** Same idea as `TYPES`: DB `CHECK (auth_source IN ('local','erp'))`. */
export const AUTH_SOURCES = ["local", "erp"];

/** User list filter labels (`ERP` / `App`) — align with sign-in and table columns. */
export const AUTH_SOURCE_LABELS = {
  local: "App",
  erp: "ERP",
};


// --- User model helpers --- 

export function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-rose-500 mt-1">
      <AlertCircle size={11} /> {msg}
    </p>
  );
}

/** Drawer / modal field labels (12px — readable on phone, not oversized). */
export const FORM_LABEL_CLASS =
  "text-xs font-bold text-slate-500 uppercase tracking-wide ml-1";

/** Dense grid labels inside modals (item rows, scan meta). */
export const FORM_MICRO_LABEL_CLASS =
  "text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide";

export const FORM_HINT_CLASS = "text-xs text-slate-500 ml-1 leading-relaxed";
export const FORM_ERROR_CLASS = "text-xs text-rose-500 ml-1 flex items-center gap-1";

/** Drawer / list form labels — pass `required` when `validate()` enforces the field. */
export function FormLabel({
  children,
  required = false,
  className = FORM_LABEL_CLASS,
  htmlFor,
}) {
  return (
    <label className={className} htmlFor={htmlFor}>
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </label>
  );
}

const baseInput =
  "w-full bg-white border rounded-lg px-3 py-2 text-base md:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all min-h-10";
export const okInput = `${baseInput} border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20`;
/** Sentence-case labels for settings / user forms */
export const formFieldLabelCls = "block text-xs font-medium text-slate-600 mb-1";
export const errInput = `${baseInput} border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 bg-rose-50/30`;
export const selectCls = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm h-10 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all";

// ------------- For User Model

// ------------- For Training Module

export const PERMS = ['view', 'add', 'edit', 'delete', 'authorize'];

// ------------- For Training Module


// ------------------ IMS drawer / modal inputs (compact)
const BASE_INPUT =
  "w-full bg-white border rounded-lg px-2.5 sm:px-3 h-9 text-[11px] sm:text-xs text-slate-800 placeholder-slate-400 outline-none transition-all appearance-none leading-normal";
export const OK_INPUT   = `${BASE_INPUT} border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50/80`;
export const ERR_INPUT  = `${BASE_INPUT} border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-50 bg-rose-50/20`;
/** Optional class merge for modal fields (same density as OK_INPUT). */
export const MODAL_INPUT_CLASS = "text-[11px] h-9 rounded-lg";

export const UNIT_OPTIONS = ["PCS", "KG"];