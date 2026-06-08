import { AlertTriangle, Download, Trash2, FileText, CheckCircle2, ThumbsUp, XCircle, CornerUpLeft, X, Loader2, Share2, ChevronDown, User, Activity, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";

import { FILE_BASE_URL } from "@/core/utils/lib";
import SearchableSelect  from "@/features/apps/task/components/common/SearchableSelect";
import { PRIORITY_CONFIG } from "../common/Constants";
import { taskService } from "@/features/apps/task/services/taskApi";
import { activityLogService } from "@/features/shared/services/activityLogService";
import { mapTaskUserToOption } from "@/features/apps/task/helpers/utilHelper";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";

// ─── Helpers ───────────────────────────────────────────────────────────────────
export function MiniRow({ label, value, icon, color = "text-slate-600" }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-1">{label}</span>
      <div className={`flex items-center gap-1.5 ${color}`}>
        <span className="opacity-70">{icon}</span>
        <span className="text-[11px] font-medium truncate max-w-[120px]">{value}</span>
      </div>
    </div>
  );
}

export const Sk    = ({ className = "" }) => <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />;
export const fmtDt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;
export const fmtTs = (d) => d ? new Date(d).toLocaleString("en-IN",  { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "";

export function Badge({ config }) {
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

export function TimelineItem({ action, action_detail, performedBy, time, isLast }) {
  return (
    <div className="flex gap-2.5 min-w-0">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center border-2 flex-shrink-0 bg-indigo-50 border-indigo-200">
          <User size={10} className="text-indigo-600" />
        </div>
        {!isLast && <div className="w-px bg-slate-100 my-1" style={{ minHeight: 12 }} />}
      </div>
      <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-3"}`}>
        <p className="text-xs text-slate-700 font-medium leading-relaxed break-words">{action}</p>
        {action_detail && <p className="text-[10px] text-slate-400 mt-0.5 italic">{action_detail}</p>}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{performedBy}</span>
          <span className="text-[10px] text-slate-400">{fmtTs(time)}</span>
        </div>
      </div>
    </div>
  );
}


export function AssignmentChain({ chain }) {

  if (!chain?.length) {
    return (
      <p className="text-xs text-slate-400 text-center py-3">
        No chain data
      </p>
    );
  }

  // sort by time
  const sortedChain = [...chain].sort((a, b) => {
    const timeA = new Date(a.completion_approved_at || a.completion_requested_at || a.assigned_at);
    const timeB = new Date(b.completion_approved_at || b.completion_requested_at || b.assigned_at);
    return timeA - timeB; // oldest → newest
  });

  const formatTime = (time) => {
    if (!time) return "";
    const d = new Date(time);
    return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }); // date + time
  };

  return (
    <div className="space-y-2 relative">
      {sortedChain.map((a, i) => {

        const isActive  = a.is_active === 1;
        const isDone    = !!a.completion_approved_at;
        const isPending = !!a.completion_requested_at && !isDone;
        const isL1      = a.is_level_one === 1;

        const displayTime =
          a.completion_approved_at ||
          a.completion_requested_at ||
          a.assigned_at;

        return (
          <div
            key={a.assignment_id}
            className="relative flex items-start gap-2.5"
          >

            {i < sortedChain.length - 1 && (
              <div className="absolute left-3.5 top-8 w-px h-full bg-slate-200 z-0" />
            )}

            {/* Level Circle */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2 z-10
              ${
                isDone
                  ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                  : isActive
                  ? "bg-indigo-100 border-indigo-400 text-indigo-700"
                  : "bg-slate-100 border-slate-300 text-slate-500"
              }`}
            >
              {isL1 ? "L1" : `L${a.assignment_level}`}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 z-10">
              <div className="flex items-center gap-2 flex-wrap">

                <span className="text-xs font-semibold text-slate-700">
                  {a.assigned_to_name}
                </span>

                {isL1 && (
                  <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold border border-indigo-200">
                    L1
                  </span>
                )}

                {isActive && !isDone && (
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold border border-blue-200">
                    Active
                  </span>
                )}

                {isPending && (
                  <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold border border-amber-200">
                    Awaiting
                  </span>
                )}

                {isDone && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-semibold border border-emerald-200">
                    ✓ Done
                  </span>
                )}

              </div>

              {a.note && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Note: {a.note}
                </p>
              )}

              <p className="text-[10px] text-slate-400 mt-0.5">
                By {a.assigned_by_name}
              </p>

              <p className="text-[10px] text-slate-400">
                {formatTime(displayTime)}
              </p>

            </div>

            {/* Status Icon */}
            <div className="flex-shrink-0 z-10">
              {isDone ? (
                <CheckCheck size={14} className="text-emerald-500" />
              ) : isPending ? (
                <AlertTriangle size={14} className="text-amber-500" />
              ) : isActive ? (
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1 animate-pulse" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-300 mt-1" />
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
}

export function AutoTextarea({ value, onChange, onKeyDown, placeholder, className = "", disabled }) {
  const ref = useRef(null);
  const MIN = 40, MAX = 100;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = `${MIN}px`;
    el.style.height = `${Math.min(el.scrollHeight, MAX)}px`;
  }, [value]);
  return (
    <textarea ref={ref} value={value} onChange={onChange} onKeyDown={onKeyDown}
      placeholder={placeholder} disabled={disabled}
      style={{ minHeight: MIN, maxHeight: MAX, resize: "none", overflowY: "auto" }}
      className={`w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none leading-5 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function FilePill({ file, onRemove, isNew = false }) {
  const fileName = file.file_name ?? file.name;
  const isImg    = file.preview || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
  const fileUrl  = file.preview ?? (file.file_path ? `${FILE_BASE_URL}/${file.file_path}` : null);
  return (
    <div className="relative group flex-shrink-0">
      {fileUrl ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer"
          className="block w-14 h-14 rounded-lg overflow-hidden border border-slate-200" title={fileName}>
          {isImg
            ? <img src={fileUrl} alt={fileName} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center gap-1 p-1">
                <FileText size={16} className="text-slate-400" />
                <span className="text-[8px] text-slate-400 truncate w-full text-center">{fileName}</span>
              </div>}
        </a>
      ) : isImg ? (
        <img src={file.preview} alt={fileName} className="w-14 h-14 object-cover rounded-lg border border-slate-200" />
      ) : (
        <div className="w-14 h-14 rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-1 p-1">
          <FileText size={16} className="text-slate-400" />
          <span className="text-[8px] text-slate-400 truncate w-full text-center">{fileName}</span>
        </div>
      )}
      {isNew && <span className="absolute -top-1 -left-1 text-[8px] bg-indigo-500 text-white px-1 rounded font-bold">NEW</span>}
      {onRemove && (
        <button onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center shadow hover:bg-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
          type="button"><X size={8} /></button>
      )}
    </div>
  );
}

export function ChatBubble({ msg, onReply, onDelete, isTaskDone, isSuperAdmin }) {
  const isOwn = msg.is_own;
  const atts  = Array.isArray(msg.attachments) ? msg.attachments : [];
  return (
    <div className={`flex gap-2 mb-4 group ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5 shadow-sm ${isOwn ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-600"}`}>
        {msg.sender_name?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className={`flex flex-col gap-1 max-w-[78%] ${isOwn ? "items-end" : "items-start"}`}>
        <div className={`flex items-center gap-1.5 flex-wrap ${isOwn ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] font-semibold text-slate-500">{msg.sender_name}</span>
          <span className="text-[10px] text-slate-400">{fmtTs(msg.created_at)}</span>
        </div>
        {msg.reply && (
          <div className={`px-2.5 py-1.5 rounded-xl border-l-2 border-indigo-300 bg-indigo-50/60 text-xs text-indigo-700 max-w-full ${isOwn ? "text-right" : ""}`}>
            <span className="font-semibold text-indigo-500 text-[10px]">{msg.reply.sender_name}</span>
            <p className="italic truncate text-[11px]">{msg.reply.message}</p>
          </div>
        )}
        {/* {msg.message && (
          <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words ${isOwn ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"}`}>
            {msg.message}
          </div>
        )} */}
        {msg.message && (
          <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words ${isOwn ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"}`}>
            {msg.message.split("\n").map((line, i) => (
              <span key={i}>
                {line || <>&nbsp;</>}
                {i < msg.message.split("\n").length - 1 && <br />}
              </span>
            ))}
          </div>
        )}
        {atts.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 mt-0.5 ${isOwn ? "justify-end" : ""}`}>
            {atts.map((a, i) => {
              const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(a.file_name ?? "");
              return isImg ? (
                <a key={i} href={`${FILE_BASE_URL}/${a.file_path}`} target="_blank" rel="noreferrer"
                  className="block w-28 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:opacity-90">
                  <img src={`${FILE_BASE_URL}/${a.file_path}`} alt={a.file_name} className="w-full h-full object-cover" />
                </a>
              ) : (
                <a key={i} href={`${FILE_BASE_URL}/${a.file_path}`} target="_blank" rel="noreferrer"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors ${isOwn ? "bg-indigo-500 border-indigo-400 text-white hover:bg-indigo-400" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  <FileText size={11} /><span className="truncate max-w-[100px]">{a.file_name}</span><Download size={10} />
                </a>
              );
            })}
          </div>
        )}
        {!isTaskDone && (
          <div className={`flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? "flex-row-reverse" : ""}`}>
            <button onClick={() => onReply(msg)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-600 px-1.5 py-0.5 rounded-md hover:bg-indigo-50 transition-colors">
              <CornerUpLeft size={10} /> Reply
            </button>
            {/* {(isOwn || isSuperAdmin) && ( */}
            {(isSuperAdmin) && (
              <button onClick={() => onDelete(msg.chat_id)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-600 px-1.5 py-0.5 rounded-md hover:bg-rose-50 transition-colors">
                <Trash2 size={10} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ── Chat Members Badge Component ──────────────────────────────
export function ChatMembers({ taskDetail }) {
  const [open, setOpen] = useState(false);

  // extract unique members from assignment_chain + creator
  const members = useMemo(() => {
  if (!taskDetail) return [];
  const map = new Map();

  // Creator
  if (taskDetail.created_by_id) {
    map.set(String(taskDetail.created_by_id), {
      id:    taskDetail.created_by_id,
      name:  taskDetail.created_by_name,
      role:  "Creator",
      color: "bg-violet-100 text-violet-700",
    });
  }

  // Assigner (if different from creator)
  if (taskDetail.assigned_by_id &&
      String(taskDetail.assigned_by_id) !== String(taskDetail.created_by_id)) {
    map.set(String(taskDetail.assigned_by_id), {
      id:    taskDetail.assigned_by_id,
      name:  taskDetail.assigned_by_name,
      role:  "Assigner",
      color: "bg-slate-100 text-slate-600",
    });
  }

  // ✅ Assignment chain — only those with is_active === 1
  (taskDetail.assignment_chain ?? [])
    .filter((a) => a.is_active === 1)  // ← THIS IS THE FIX
    .forEach((a) => {
      if (!map.has(String(a.assigned_to_id))) {
        const roleLabel =
          a.role === "level_one" || a.is_level_one ? "Level-1" :
          a.role === "sub_user"                    ? "Sub-user" : "Member";
        const color =
          roleLabel === "Level-1"  ? "bg-amber-100 text-amber-700"  :
          roleLabel === "Sub-user" ? "bg-indigo-100 text-indigo-700" :
                                     "bg-emerald-100 text-emerald-700";
        map.set(String(a.assigned_to_id), {
          id:    a.assigned_to_id,
          name:  a.assigned_to_name,
          role:  roleLabel,
          color,
        });
      }
    });

  return Array.from(map.values());
}, [taskDetail]);

  return (
    <div className="relative">
      {/* Badge Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl transition-all">
        {/* Avatar stack */}
        <div className="flex -space-x-1.5">
          {members.slice(0, 3).map((m) => (
            <div key={m.id}
              className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold ring-1 ring-white flex-shrink-0">
              {m.name?.[0]?.toUpperCase()}
            </div>
          ))}
          {members.length > 3 && (
            <div className="w-5 h-5 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-[9px] font-bold ring-1 ring-white flex-shrink-0">
              +{members.length - 3}
            </div>
          )}
        </div>
        <span className="text-xs font-semibold text-slate-600">{members.length} Members</span>
        <ChevronDown size={11} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Task Members ({members.length})
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {m.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{m.name}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${m.color}`}>
                      {m.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Action Modals ─────────────────────────────────────────────────────────────
export function ForwardModal({ open, onClose, onSubmit, loading, users }) {
  const [forwardTo, setForwardTo] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { if (!open) { setForwardTo(""); setNote(""); } }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center"><Share2 size={16} className="text-violet-600" /></div>
          <div className="flex-1"><h3 className="text-sm font-semibold text-slate-800">Forward Task</h3><p className="text-xs text-slate-400">Delegate to someone else</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>
        <SearchableSelect label="Forward To" required
          options={users.map(mapTaskUserToOption)}
          value={forwardTo} onChange={setForwardTo}
          placeholder={users.length === 0 ? "Loading…" : "Select a person…"}  />
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Note (optional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Instructions…" rows={3}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all resize-none" />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button onClick={() => onSubmit({ forward_to: forwardTo, note })} disabled={loading || !forwardTo}
            className="px-5 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-xl flex items-center gap-2 disabled:opacity-50 shadow-sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} Forward
          </button>
        </div>
      </div>
    </div>
  );
}


export function ReassignModal({ open, onClose, onSubmit, loading, users }) {
  const [reassignTo, setReassignTo] = useState("");

  useEffect(() => {
    if (!open) setReassignTo("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
            <Share2 size={16} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800">Reassign Task</h3>
            <p className="text-xs text-slate-400">Select a person to reassign</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {/* Dropdown */}
        <SearchableSelect
          label="Reassign To"
          required
          options={users.map(mapTaskUserToOption)}
          value={reassignTo}
          onChange={setReassignTo}
          placeholder={users.length === 0 ? "Loading…" : "Select a person…"}
        />

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ reassign_to: reassignTo })}
            disabled={loading || !reassignTo}
            className="px-5 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} Reassign
          </button>
        </div>

      </div>
    </div>
  );
}

// Complete / Approve / Reject — unified modal
export function ActionModal({ open, onClose, onSubmit, loading, type }) {
  const [note, setNote] = useState("");
  useEffect(() => { if (!open) setNote(""); }, [open]);

  const cfg = {
    complete: {
      title: "Request Completion", icon: CheckCircle2,
      iconBg: "bg-emerald-50 border-emerald-200", iconClr: "text-emerald-600",
      btnClr: "bg-emerald-600 hover:bg-emerald-700",
      label: "Submit", ph: "What did you complete?", noteRequired: false,
    },
    approve: {
      title: "Approve Completion", icon: ThumbsUp,
      iconBg: "bg-indigo-50 border-indigo-200", iconClr: "text-indigo-600",
      btnClr: "bg-indigo-600 hover:bg-indigo-700",
      label: "Approve", ph: "Approval note (optional)…", noteRequired: false,
    },
    reject: {
      title: "Reject Completion", icon: XCircle,
      iconBg: "bg-rose-50 border-rose-200", iconClr: "text-rose-600",
      btnClr: "bg-rose-600 hover:bg-rose-700",
      label: "Reject", ph: "Reason for rejection (required)…", noteRequired: true,
    },
  }[type] ?? {};

  const Icon = cfg.icon;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${cfg.iconBg}`}>
            <Icon size={16} className={cfg.iconClr} />
          </div>
          <div className="flex-1"><h3 className="text-sm font-semibold text-slate-800">{cfg.title}</h3></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        {type === "reject" && (
          <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-100 rounded-xl">
            <AlertTriangle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700">Task will be moved back to <strong>In Progress</strong>. Assignee will be notified.</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Note {cfg.noteRequired ? <span className="text-rose-400">*</span> : <span className="text-slate-400 font-normal normal-case">(optional)</span>}
          </label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={cfg.ph} rows={3}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none transition-all" />
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button onClick={() => onSubmit({ note })} disabled={loading || (cfg.noteRequired && !note.trim())}
            className={`px-5 py-2 text-sm font-medium text-white rounded-xl flex items-center gap-2 disabled:opacity-50 shadow-sm transition-all ${cfg.btnClr}`}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />} {cfg.label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar color helper ──────────────────────────────────────────────────────
export function getSidebarStyle(task) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const due      = task.due_date           ? new Date(task.due_date           + "T00:00:00") : null;
  const reminder = task.reminder_date      ? new Date(task.reminder_date      + "T00:00:00") : task.self_reminder_date ? new Date(task.self_reminder_date + "T00:00:00") : null;
  const created  = task.created_at         ? new Date(task.created_at) : null;

  // 1. Completed
  if (task.status === "completed")
    return { dot: "bg-emerald-400", bar: "bg-emerald-300", tag: "Completed",        tagCls: "bg-emerald-50 text-emerald-700 border-emerald-200" };

  // 2. Overdue due date
  if (due && due < today)
    return { dot: "bg-rose-400",    bar: "bg-rose-300",    tag: "Overdue",           tagCls: "bg-rose-50 text-rose-700 border-rose-200" };

  // 3. New today
  if (created && created >= today)
    return { dot: "bg-sky-400",     bar: "bg-sky-300",     tag: "New",               tagCls: "bg-sky-50 text-sky-700 border-sky-200" };

  // 4. Upcoming due date
  if (due && due >= today)
    return { dot: "bg-blue-400",    bar: "bg-blue-300",    tag: "Upcoming Due",      tagCls: "bg-blue-50 text-blue-700 border-blue-200" };

  // 5. Overdue reminder
  if (reminder && reminder < today)
    return { dot: "bg-orange-400",  bar: "bg-orange-300",  tag: "Overdue Reminder",  tagCls: "bg-orange-50 text-orange-700 border-orange-200" };

  // 6. Upcoming reminder
  if (reminder && reminder >= today)
    return { dot: "bg-amber-400",   bar: "bg-amber-300",   tag: "Reminder",          tagCls: "bg-amber-50 text-amber-700 border-amber-200" };

  // 7. Normal
  const DOTS = {
    pending:          "bg-amber-400",
    in_progress:      "bg-blue-400",
    on_hold:          "bg-orange-400",
    forwarded:        "bg-violet-400",
    pending_approval: "bg-amber-500",
    creator_pending:  "bg-violet-500",
  };
  return { dot: DOTS[task.status] ?? "bg-slate-400", bar: "bg-slate-200", tag: null, tagCls: null };
}

// ─── Left Sidebar Task Item ────────────────────────────────────────────────────
export function SidebarTaskItem({ task, isActive, onClick, colorData }) {
  const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.low;

  // colorData aaye (TaskDetailPage se getTaskColor) toh sab kuch wahan se lo
  // if colorData not provided, then old getSidebarStyle fallback — same design
  const sidebarStyle = colorData || getSidebarStyle(task) || {};
  const tag = sidebarStyle.tag;
  const tagCls = sidebarStyle.tagCls || "";
  const barHex = colorData ? colorData.bar : null;

  // due date red — for both overdue or approval
  const dueDateRed = tag === "Overdue" || tag === "Approval";

  return (
    <button onClick={onClick}
      className={`w-full text-left px-2.5 py-2.5 rounded-xl transition-all border ${
        isActive
          ? "bg-indigo-50 border-indigo-200 shadow-sm"
          : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"
      }`}>
      <div className="flex items-stretch gap-2">

        {/* Left bar — hex inline ya Tailwind fallback */}
        {barHex ? (
          <div className="w-1 rounded-full flex-shrink-0"
            style={{ backgroundColor: isActive ? "#818cf8" : barHex }} />
        ) : (
          <div className={`w-1 rounded-full flex-shrink-0 ${isActive ? "bg-indigo-400" : sidebarStyle.bar}`} />
        )}

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold leading-snug line-clamp-2 ${isActive ? "text-indigo-700" : "text-slate-700"}`}>
            {task.title}
          </p>

          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {/* Dot — hex inline ya Tailwind fallback */}
            {barHex ? (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: barHex }} />
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sidebarStyle.dot}`} />
            )}

            {tag && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none ${tagCls}`}>
                {tag}
              </span>
            )}

            <span className={`text-[10px] font-semibold ${pri.color}`}>
              {pri.label}
            </span>

            <span className="text-[10px] text-slate-300 ml-auto">#{task.task_id}</span>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.due_date && (
              <span className={`text-[9px] flex items-center gap-0.5 ${dueDateRed ? "text-rose-500 font-semibold" : "text-slate-400"}`}>
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
            )}
            {task.current_holder_name && (
              <span className="text-[9px] text-slate-400 flex items-center gap-0.5 truncate max-w-[80px]">
                <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                {task.current_holder_name}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Activity Log Modal — Reusable ────────────────────────────────────────────
const ACTION_CONFIG = {
  create:                    { label: "Created",                color: "bg-emerald-100 border-emerald-200 text-emerald-700", dot: "bg-emerald-500" },
  update:                    { label: "Updated",                color: "bg-blue-100 border-blue-200 text-blue-700",         dot: "bg-blue-500"    },
  approve:                   { label: "Approved",               color: "bg-indigo-100 border-indigo-200 text-indigo-700",   dot: "bg-indigo-500"  },
  delete:                    { label: "Deleted",                color: "bg-rose-100 border-rose-200 text-rose-700",         dot: "bg-rose-500"    },
  task_created:              { label: "Task Created",           color: "bg-emerald-100 border-emerald-200 text-emerald-700", dot: "bg-emerald-500" },
  task_assigned:             { label: "Task Assigned",          color: "bg-indigo-100 border-indigo-200 text-indigo-700",   dot: "bg-indigo-500"  },
  task_edited:               { label: "Task Edited",            color: "bg-blue-100 border-blue-200 text-blue-700",         dot: "bg-blue-500"    },
  l1_changed:                { label: "L1 Changed",             color: "bg-violet-100 border-violet-200 text-violet-700",   dot: "bg-violet-500"  },
  sub_user_added:            { label: "Sub-user Added",         color: "bg-sky-100 border-sky-200 text-sky-700",            dot: "bg-sky-500"     },
  sub_user_removed:          { label: "Sub-user Removed",       color: "bg-rose-100 border-rose-200 text-rose-700",         dot: "bg-rose-500"    },
  reminder_set:              { label: "Reminder Set",           color: "bg-amber-100 border-amber-200 text-amber-700",      dot: "bg-amber-500"   },
  title_changed:             { label: "Title Changed",          color: "bg-blue-100 border-blue-200 text-blue-700",         dot: "bg-blue-500"    },
  status_changed:            { label: "Status Changed",         color: "bg-orange-100 border-orange-200 text-orange-700",   dot: "bg-orange-500"  },
  completion_requested:      { label: "Completion Requested",   color: "bg-amber-100 border-amber-200 text-amber-700",      dot: "bg-amber-500"   },
  completion_approved:       { label: "Completion Approved",    color: "bg-emerald-100 border-emerald-200 text-emerald-700",dot: "bg-emerald-500" },
  completion_rejected:       { label: "Completion Rejected",    color: "bg-rose-100 border-rose-200 text-rose-700",         dot: "bg-rose-500"    },
  task_forwarded:            { label: "Task Forwarded",         color: "bg-violet-100 border-violet-200 text-violet-700",   dot: "bg-violet-500"  },
  task_completed:            { label: "Task Completed",         color: "bg-emerald-100 border-emerald-200 text-emerald-700",dot: "bg-emerald-500" },
};

export function ActivityLogModal({ open, onClose, taskId, taskTitle, taskStatus, logs: propLogs = null }) {
  const [logs,       setLogs]       = useState([]);
  const [taskInfo,   setTaskInfo]   = useState({ title: taskTitle, status: taskStatus });
  const [loading,    setLoading]    = useState(false);
  const [total,      setTotal]      = useState(0);
  const [offset,     setOffset]     = useState(0);
  const [actionType, setActionType] = useState("");
  const LIMIT = 20;

  // If propLogs passed (SubPage) — use directly, don't fetch
  const isLazy = propLogs === null;

  const fetchLogs = useCallback(async (off = 0, atype = "") => {
    if (!isLazy || !taskId) return;
    setLoading(true);
    try {
      const page = Math.floor(off / LIMIT) + 1;
      const response = await activityLogService.getLogs({
        app_type: "task",
        entity: "tasks",
        entity_id: taskId,
        action_type: atype || undefined,
        page,
        limit: LIMIT,
        all_users: "true"
      });
      
      if (response.success) {
        const data = response.data;
        const pagin = response.pagination;
        
        setTotal(pagin.total);
        if (off === 0) setLogs(data);
        else           setLogs((p) => [...p, ...data]);
        setOffset(off);
      }
    } catch {
      toast.error("Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [taskId, isLazy]);

  useEffect(() => {
    if (!open) { setLogs([]); setOffset(0); setActionType(""); return; }
    if (isLazy) fetchLogs(0, "");
  }, [open]);

  const handleFilterChange = (atype) => {
    setActionType(atype);
    if (isLazy) fetchLogs(0, atype);
  };

  const displayLogs = isLazy ? logs : [...propLogs].reverse();
  const displayTotal = isLazy ? total : propLogs.length;

  const ACTION_TYPES = [
    { value: "",                    label: "All"          },
    { value: "CREATE",              label: "Created"      },
    { value: "UPDATE",              label: "Updated"      },
    { value: "APPROVE",             label: "Approved"     },
    { value: "DELETE",              label: "Deleted"      },
    { value: "task_created",        label: "Old Created"  },
    { value: "task_assigned",       label: "Old Assigned" },
  ];

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Activity size={15} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Activity Log</h3>
              <p className="text-xs text-slate-400">{displayTotal} activities recorded</p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Task strip */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex-shrink-0 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">#{taskId}</span>
          <span className="text-xs text-slate-500 truncate flex-1">{taskInfo.title}</span>
          {taskInfo.status && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-semibold flex-shrink-0">
              {taskInfo.status?.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {/* Filter chips */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex-shrink-0 flex gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}>
          {ACTION_TYPES.map((at) => (
            <button key={at.value}
              onClick={() => handleFilterChange(at.value)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                actionType === at.value
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"
              }`}>
              {at.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-slate-300" />
            </div>
          ) : displayLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity size={24} className="text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No activity recorded</p>
            </div>
          ) : (
            <>
              {displayLogs.map((log, i) => {
                const actionKey = (log.action || log.action_type || "").toLowerCase();
                const cfg = ACTION_CONFIG[actionKey] ?? {
                  label: (log.action || log.action_type || "").replace(/_/g, " "),
                  color: "bg-slate-100 border-slate-200 text-slate-600",
                  dot:   "bg-slate-400",
                };
                const isLast = i === displayLogs.length - 1;
                return (
                  <div key={log.id || log.activity_id} className="flex gap-3 min-w-0">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${cfg.dot}`} />
                      {!isLast && <div className="w-px bg-slate-100 flex-1 my-1" style={{ minHeight: 16 }} />}
                    </div>
                    <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-3"}`}>
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">{fmtTs(log.created_at || log.action_time)}</span>
                      </div>
                      {(log.description || log.action_detail) && (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{(log.description || log.action_detail).replace(/<[^>]*>/g, "")}</p>
                      )}
                      <span className="text-[10px] font-semibold text-indigo-600 mt-0.5 inline-block">
                        {log.user_name || log.performed_by || "System"}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Load More */}
              {isLazy && offset + LIMIT < total && (
                <button
                  onClick={() => fetchLogs(offset + LIMIT, actionType)}
                  disabled={loading}
                  className="w-full mt-3 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={12} className="animate-spin" /> : null}
                  Load More ({total - offset - LIMIT} remaining)
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-slate-400">Newest first · {displayTotal} total</p>
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>, document.body
  );
}
