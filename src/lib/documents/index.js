/**
 * Uploads — sync keys/folders with backend `lib/documents/documents.config.js`.
 * Backend validates files; FE only sets `accept` and builds preview URLs.
 */
import { FILE_BASE_URL } from "@/platform/utils/core/lib";

const pdfImage = ["pdf", "png", "jpg", "jpeg", "webp"];
const pdfImageWord = ["pdf", "png", "jpg", "jpeg", "webp", "gif", "doc", "docx"];
const tcRmtc = { tc: "uploads/rmstore/tc", rmtc: "uploads/rmstore/rmtc" };

const CFG = {
  rm_mrn_portal: { exts: pdfImage, slots: tcRmtc },
  rm_stock_adjustment: { exts: pdfImage, slots: tcRmtc },
  rm_qc_check: { exts: pdfImage, folder: "uploads/rmstore/qc" },
  rm_in_process_request: { exts: pdfImage, folder: "uploads/rmstore/ipr" },
  rm_in_process_request_rejection: { accept: "image/jpeg,image/png,image/webp" },
  invoice_receiving: {
    exts: pdfImageWord,
    folder: "uploads/ims/invoice-receiving",
    accept: ".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf",
  },
  eng_machine_master: {
    exts: ["pdf", "png", "jpg", "jpeg", "webp", "gif", "doc", "docx", "xls", "xlsx", "txt", "csv"],
    folder: "uploads/eng/machine",
  },
  // Keys match backend DOC_FILE_LINKS (aliases kept for older call sites).
  tasks: { exts: pdfImageWord, folder: "uploads/task_tasks/chat" },
  task_form: { exts: pdfImageWord, folder: "uploads/task_tasks/chat" },
  task_self_note: { exts: pdfImageWord, folder: "uploads/task_tasks/self" },
  task_recurring_chat: { exts: pdfImageWord, folder: "uploads/task_recurring_tasks/chat" },
  recurring_task: { exts: pdfImageWord, folder: "uploads/task_recurring_tasks/chat" },
  cl_task_master: { exts: pdfImageWord, folder: "uploads/task_cl_tasks/attachments" },
  cl_task_fill: { exts: pdfImageWord, folder: "uploads/task_cl_tasks/attachments" },
  cl_task: { exts: pdfImageWord, folder: "uploads/task_cl_tasks/attachments" },
};

const BARE = /^[\w.\-]+\.(pdf|png|jpe?g|webp|gif|docx?|xlsx?|txt|csv)$/i;

function folder(key, slot) {
  const c = CFG[key];
  if (!c) return null;
  if (c.folder) return c.folder;
  return c.slots?.[String(slot ?? "").toLowerCase()] ?? null;
}

function toUploadsPath(raw, moduleKey) {
  let p = String(raw ?? "").trim().replace(/\\/g, "/");
  if (!p) return "";
  const base = String(FILE_BASE_URL || "").replace(/\/$/, "");
  if (base && p.startsWith(base)) p = p.slice(base.length).replace(/^\/+/, "");
  if (/^https?:\/\//i.test(p) || p.startsWith("blob:")) return p;
  p = p.replace(/^\/+/, "");
  if (p.startsWith("rmstore/")) p = `uploads/${p}`;
  if (p.startsWith("uploads/")) return p;
  if (!moduleKey) return "";
  const f = folder(moduleKey, /\/rmtc\//i.test(p) ? "rmtc" : /\/tc\//i.test(p) ? "tc" : null);
  if (!f) return "";
  if (moduleKey === "invoice_receiving" || BARE.test(p)) return `${f}/${p}`;
  return "";
}

export function uploadAccept(key) {
  const c = CFG[key];
  if (!c) return ".pdf,.png,.jpg,.jpeg,.webp";
  return c.accept || (c.exts || []).map((e) => `.${e}`).join(",");
}

export function uploadUrl(path, moduleKey = null) {
  const p = toUploadsPath(path, moduleKey);
  if (!p) return "";
  if (/^https?:\/\//i.test(p) || p.startsWith("blob:")) return p;
  if (!p.startsWith("uploads/")) return "";
  const base = String(FILE_BASE_URL || "").replace(/\/$/, "");
  return base ? `${base}/${p}` : `/${p}`;
}
