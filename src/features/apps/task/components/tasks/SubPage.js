"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import { ArrowLeft, Calendar, Clock, User, Tag, Flag, CheckCircle2, AlertCircle, Paperclip, MessageSquare, Activity, RefreshCw, Edit2, ChevronRight, Repeat, TrendingUp, Shield,
  Send, Image as ImageIcon, X, ChevronDown, CornerUpLeft, GitBranch, ThumbsUp, CheckCheck, AlertTriangle, Share2, Loader2, Lock, XCircle, ClipboardList, Search, Bell,
} from "lucide-react";
import { toast }       from "react-toastify";
import { taskService } from "@/features/apps/task/services/taskApi";
import { userService } from "@/features/apps/task/services/userApi";
import TaskModal       from "@/features/apps/task/components/tasks/TaskModal";
import RichTextDisplay from "@/features/apps/task/components/common/RichTextDisplay";

import { PRIORITY_CONFIG_DETAIL_PAGE, TASK_STATUS_CONFIG } from "@/features/apps/task/components/common/Constants";
import { MiniRow, Sk, fmtDt, Badge, TimelineItem, AssignmentChain, AutoTextarea, FilePill, ChatBubble, ForwardModal, ActionModal, SidebarTaskItem, ChatMembers, ActivityLogModal, } from "./SubPageExtra";
import { formatDateTime, formatDateTimeLocalLabel, toDateTimeLocalInput } from "@/features/apps/task/helpers/utilHelper";

import { SIDEBAR_TABS, TASK_COLORS } from "@/features/apps/task/components/tasks_common_component/TaskConstant"
import { filterSidebarTasks, getTaskColor, SidebarCounts } from "@/features/apps/task/components/tasks_common_component/TaskHelper"
import { buildTaskDetailUrl, resolveTaskId } from "@/features/apps/task/helpers/taskRouteHelper";
import {
  readReportFilterStateFromSession,
  buildReportTaskListApiParams,
  applyReportDisplayTaskFilter,
} from "@/features/apps/task/helpers/reportTaskListParams";
import { usePersistedScroll } from "@/features/apps/task/hooks/usePersistedScroll";


function ActionBtn({ onClick, cls, icon: Icon, label, pulse }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all shadow-sm ${pulse ? "animate-pulse" : ""} ${cls}`}>
      <Icon size={12} /><span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TaskDetailPage() {
  const { id: routeId }  = useParams();
  const router  = useRouter();
  const searchParams = useSearchParams();
  const report = searchParams.get("report") === "true";
  const initialTaskId = useMemo(() => resolveTaskId(routeId), [routeId]);
  const allTasksCacheKey = `taskDetailAllTasks_${report ? "report" : "normal"}`;
  const [id, setId] = useState(initialTaskId);

  const currentUserId = useSelector((s) => s.auth?.user?.id ?? s.auth?.id ?? null);
  const currentUser   = useSelector((s) => s.auth.user);
  const userRole      = useSelector((s) => s.auth?.role);
  const isSuperAdmin  = userRole === "super_admin";

  const [task,        setTask]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [editOpen,    setEditOpen]    = useState(false);
  const [rightTab,    setRightTab]    = useState("chat");
  const [showActivity,setShowActivity]= useState(false);
  const [showChain,   setShowChain]   = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(42);
  const [isResizingPanels, setIsResizingPanels] = useState(false);
  const [users,       setUsers]       = useState([]);
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  const [allTasks,          setAllTasks]          = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem(`taskDetailAllTasks_${report ? "report" : "normal"}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [sidebarTab,        setSidebarTab]         = useState(() => {
    if (typeof window === "undefined") return "action_required";
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("report") === "true") return "all";
    return sessionStorage.getItem("sidebarTab") || "action_required";
  });
  const [sidebarSearch,     setSidebarSearch]      = useState(() => {
    if (typeof window === "undefined") return "";
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("report") === "true") return sessionStorage.getItem("report_filter_search") || "";
    return sessionStorage.getItem("sidebarSearch") || "";
  });

  const [sidebarCollapsed,  setSidebarCollapsed]   = useState(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("sidebarCollapsed") === "true" : false
  );
  const [mobileSidebar, setMobileSidebar] = useState(false);

  const setSidebarTabPersist       = (v) => { setSidebarTab(v);       sessionStorage.setItem("sidebarTab", v); };
  const setSidebarSearchPersist    = useCallback((v) => {
    setSidebarSearch(v);
    if (typeof window === "undefined") return;
    if (report) sessionStorage.setItem("report_filter_search", v);
    else sessionStorage.setItem("sidebarSearch", v);
  }, [report]);
  const setSidebarCollapsedPersist = (v) => { setSidebarCollapsed(v); sessionStorage.setItem("sidebarCollapsed", String(v)); };

  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading,  setChatLoading]  = useState(false);
  const [chatMsg,      setChatMsg]      = useState("");
  const [chatFiles,    setChatFiles]    = useState([]);
  const [chatSending,  setChatSending]  = useState(false);
  const [replyTo,      setReplyTo]      = useState(null);
  const chatEndRef  = useRef(null);
  const chatFileRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);
  const prevTaskIdRef = useRef(null);

  const [selfNote,       setSelfNote]       = useState("");
  const [selfAtts,       setSelfAtts]       = useState([]);
  const [selfNewFiles,   setSelfNewFiles]   = useState([]);
  const [selfRemove,     setSelfRemove]     = useState([]);
  const [selfSaving,     setSelfSaving]     = useState(false);
  const [selfDirty,      setSelfDirty]      = useState(false);
  const [selfNoteExists, setSelfNoteExists] = useState(false);
  const [selfReminder,   setSelfReminder]   = useState("");
  const [savedReminder,  setSavedReminder]  = useState("");
  const [reminderDirty,  setReminderDirty]  = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const reminderDirtyRef = useRef(false);
  const [targetDateInput, setTargetDateInput] = useState("");
  const [targetDateSaving, setTargetDateSaving] = useState(false);
  const [autoSaving,     setAutoSaving]     = useState(false);
  const [autoSaveEnabled] = useState(true);
  const selfFileRef = useRef(null);

  const [forwardOpen,   setForwardOpen]   = useState(false);
  const [completeOpen,  setCompleteOpen]  = useState(false);
  const [approveOpen,   setApproveOpen]   = useState(false);
  const [rejectOpen,    setRejectOpen]    = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const mainSplitRef = useRef(null);
  const sidebarListRef = useRef(null);
  const detailScrollRef = useRef(null);

  const fetchTask = useCallback(async () => {
    if (!id) return;
    try {
      const res  = await taskService.getById(id);
      const data = res.data?.data;
      if (!data) { toast.error("Task not found"); setTimeout(() => router.push("/task/dashboard/tasks"), 1000); return; }
      setTask(data);
    } catch { router.push("/task/dashboard/tasks"); }
    finally  {
      setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, [id, router]);

  const fetchChat = useCallback(async () => {
    if (!id) return;
    setChatLoading(true);
    try { const res = await taskService.getChat(id); setChatMessages(res.data?.data ?? []); } catch {}
    finally { setChatLoading(false); }
  }, [id]);

  const fetchSelfNote = useCallback(async () => {
    if (!id) return;
    try {
      const res  = await taskService.getSelfNote(id);
      const data = res.data?.data;
      if (data) {
        setSelfNote(data.note ?? "");
        const reminder = toDateTimeLocalInput(data.reminder_at);
        if (!reminderDirtyRef.current) {
          setSelfReminder(reminder);
          setSavedReminder(reminder);
          setReminderDirty(false);
        }
        let atts = data.attachments;
        if (typeof atts === "string") { try { atts = JSON.parse(atts); } catch { atts = []; } }
        setSelfAtts(Array.isArray(atts) ? atts : []);
        setSelfNoteExists(true);
      } else {
        setSelfNote(""); setSelfAtts([]); setSelfNoteExists(false);
        if (!reminderDirtyRef.current) {
          setSelfReminder(""); setSavedReminder(""); setReminderDirty(false);
        }
      }
      setSelfDirty(false); setSelfNewFiles([]); setSelfRemove([]);
    } catch (err) { console.log("fetchSelfNote error:", err); }
  }, [id]);

  const fetchAllTasks = useCallback(async () => {
    try {
      let params;
      let reportFilterState = null;
      if (report) {
        reportFilterState = readReportFilterStateFromSession();
        params = buildReportTaskListApiParams(reportFilterState, currentUser, {
          page: 1,
          limit: 500,
        });
      } else {
        params = {
          limit: 200,
          sortBy: "task_id",
          order: "desc",
          report: false,
        };
      }

      const res = await taskService.getAll(params);
      const raw = res.data?.data?.tasks ?? res.data?.data?.items ?? res.data?.data ?? res.data ?? [];
      let next = Array.isArray(raw) ? raw : [];
      if (report && reportFilterState) {
        next = applyReportDisplayTaskFilter(next, reportFilterState);
      }
      setAllTasks(next);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(allTasksCacheKey, JSON.stringify(next));
      }
    } catch {
      // Keep existing cached list to avoid blank sidebar flicker.
    }
  }, [report, allTasksCacheKey, currentUser]);

  useEffect(() => {
    if (routeId == null) return;
    if (initialTaskId) return;
    toast.error("Invalid task link");
    router.push("/task/dashboard/tasks");
  }, [initialTaskId, routeId, router]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await userService.getViews();
      const raw = res.data?.data ?? res.data ?? [];
      setUsers(Array.isArray(raw) ? raw : []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchTask(); fetchChat(); fetchSelfNote();
  }, [fetchTask, fetchChat, fetchSelfNote]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  useEffect(() => {
    const taskChanged = prevTaskIdRef.current !== id;
    prevTaskIdRef.current = id;
    if (taskChanged) return;
    if (rightTab === "chat")
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [chatMessages, rightTab, id]);

  useEffect(() => {
    setId(initialTaskId);
  }, [initialTaskId]);

  const isTaskDone      = task?.status === "completed";
  const isAssignedTask  = task?.task_type === "assigned";
  const isAssigner      = task && Number(task.assigned_by_id)        === Number(currentUserId);
  const isL1            = task && Number(task.first_assigned_to_id) === Number(currentUserId);
  const canSetTargetDate = isAssignedTask && !isTaskDone && task?.can_set_target_date === true;
  const canAdminOverrideTarget = isAssignedTask && !isTaskDone && task?.can_admin_override_target_date === true;
  const hasValidTarget   = task?.has_valid_target === true;
  const isChatLockedByTarget = isAssignedTask && !hasValidTarget && !isAssigner && !isTaskDone;
  const isCurrentHolder = task && Number(task.current_holder_id)    === Number(currentUserId);
  const isTaskFinalDone = task?.status === "completed";

  const isAssignmentActive = (a) => a && (a.is_active === 1 || a.is_active === true);
  const currentAssignment = task?.assignment_chain?.find(
    (a) => Number(a.assigned_to_id) === Number(currentUserId)
      && Number(a.assignment_id) === Number(task.current_assignment_id)
  );
  const isUserActive = isAssignmentActive(currentAssignment)
    || (isCurrentHolder && (task?.assignment_chain ?? []).some(
      (a) => Number(a.assigned_to_id) === Number(currentUserId) && isAssignmentActive(a)
    ));
  const canSubUserAction = !isL1 && isCurrentHolder && isUserActive
    && ["in_progress", "pending", "forwarded"].includes(task?.status ?? "");
  const canL1AlwaysAction = isL1 && task?.status !== "creator_pending" && !isTaskFinalDone;

  const canForward        = (canL1AlwaysAction || canSubUserAction) && task?.task_type !== "self";
  const canComplete       = canL1AlwaysAction || canSubUserAction;
  const canL1Approve      = isL1      && task?.status === "pending_approval";
  const canL1Reject       = isL1      && task?.status === "pending_approval";
  const canAssignerApprove = isAssigner && task?.status === "creator_pending";
  const canAssignerReject  = isAssigner && task?.status === "creator_pending";

  const sidebarTasks = filterSidebarTasks(allTasks, sidebarTab, sidebarSearch);

  usePersistedScroll(
    sidebarListRef,
    `taskDetailSidebarScroll_${report ? "report" : "normal"}`,
    true
  );

  // When task changes, ensure selected task card is visible in sidebar.
  useEffect(() => {
    const listEl = sidebarListRef.current;
    if (!listEl || !id) return;
    const activeEl = listEl.querySelector(`[data-task-id="${id}"]`);
    if (activeEl) {
      const activeTop = activeEl.offsetTop;
      const activeBottom = activeTop + activeEl.offsetHeight;
      const viewTop = listEl.scrollTop;
      const viewBottom = viewTop + listEl.clientHeight;

      if (activeTop < viewTop) {
        listEl.scrollTop = activeTop;
      } else if (activeBottom > viewBottom) {
        listEl.scrollTop = activeBottom - listEl.clientHeight;
      }
    }
  }, [id, sidebarTasks.length]);

  // Reset right detail panel scroll to top when opening another task.
  useEffect(() => {
    if (!detailScrollRef.current) return;
    detailScrollRef.current.scrollTop = 0;
  }, [id]);

  const handleSaveSelf = useCallback(async ({ includeReminder = false } = {}) => {
    setSelfSaving(true);
    try {
      const fd = new FormData();
      fd.append("note", selfNote);
      fd.append("reminder_at", includeReminder ? (selfReminder || "") : (savedReminder || ""));
      selfNewFiles.forEach((f) => fd.append("files", f.file));
      if (selfRemove.length > 0) fd.append("remove_files", JSON.stringify(selfRemove));
      await taskService.upsertSelfNote(id, fd);
      await fetchSelfNote();
    } catch { toast.error("Failed to save note"); }
    finally  { setSelfSaving(false); }
  }, [id, selfNote, selfReminder, savedReminder, selfNewFiles, selfRemove, fetchSelfNote]);

  const handleSaveReminder = useCallback(async () => {
    setReminderSaving(true);
    try {
      const fd = new FormData();
      fd.append("note", selfNote);
      fd.append("reminder_at", selfReminder || "");
      selfNewFiles.forEach((f) => fd.append("files", f.file));
      if (selfRemove.length > 0) fd.append("remove_files", JSON.stringify(selfRemove));
      await taskService.upsertSelfNote(id, fd);
      setSavedReminder(selfReminder);
      setReminderDirty(false);
      reminderDirtyRef.current = false;
      toast.success(selfReminder ? "Personal reminder saved" : "Personal reminder cleared");
      await fetchSelfNote();
    } catch {
      toast.error("Failed to save reminder");
    } finally {
      setReminderSaving(false);
    }
  }, [id, selfNote, selfReminder, selfNewFiles, selfRemove, fetchSelfNote]);

  useEffect(() => {
    if (!selfDirty || selfNewFiles.length > 0 || selfRemove.length > 0) return;
    const timer = setTimeout(async () => {
      setAutoSaving(true); await handleSaveSelf(); setAutoSaving(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [selfNote, selfDirty, handleSaveSelf, selfNewFiles, selfRemove]);

  useEffect(() => {
    reminderDirtyRef.current = reminderDirty;
  }, [reminderDirty]);

  const handleChatSend = async () => {
    if (isTaskDone || isChatLockedByTarget || (!chatMsg.trim() && chatFiles.length === 0)) return;
    setChatSending(true);
    try {
      const fd = new FormData();
      if (chatMsg.trim()) fd.append("message", chatMsg.trim());
      if (replyTo)        fd.append("reply_to_id", replyTo.chat_id);
      chatFiles.forEach((f) => fd.append("files", f.file));
      await taskService.sendChatMessage(id, fd);
      setChatMsg(""); setChatFiles([]); setReplyTo(null);
      await fetchChat();
    } catch { toast.error("Failed to send message"); }
    finally  { setChatSending(false); }
  };

  const handleChatKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
  };

  const ALLOWED_FILE_TYPES = ["image/jpeg","image/png","image/jpg","image/gif","image/webp","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

  const pickFiles = (files, onValid) => {
    const MAX_MB = 10;
    const valid   = files.filter((f) => ALLOWED_FILE_TYPES.includes(f.type) && f.size <= MAX_MB * 1024 * 1024);
    const invalid = files.filter((f) => !ALLOWED_FILE_TYPES.includes(f.type));
    const tooBig  = files.filter((f) => ALLOWED_FILE_TYPES.includes(f.type) && f.size > MAX_MB * 1024 * 1024);
    if (invalid.length > 0) toast.error(`${invalid.length} file(s) rejected — only images & documents allowed`);
    if (tooBig.length  > 0) toast.error(`${tooBig.length} file(s) rejected — max size is ${MAX_MB}MB`);
    if (valid.length   > 0) onValid(valid.map((f) => ({ file: f, name: f.name, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null })));
  };

  const handleChatFilePick = (e) => {
    if (isTaskDone) return;
    pickFiles(Array.from(e.target.files), (mapped) => setChatFiles((p) => [...p, ...mapped]));
    e.target.value = "";
  };

  const removeChatFile = (i) => setChatFiles((p) => {
    const n = [...p]; if (n[i].preview) URL.revokeObjectURL(n[i].preview); n.splice(i, 1); return n;
  });

  const handleDeleteChatMsg = async (chatId) => {
    if (isTaskDone || !confirm("Delete this message?")) return;
    try { await taskService.deleteChatMessage(id, chatId); toast.success("Message deleted"); await fetchChat(); }
    catch { toast.error("Failed to delete"); }
  };

  const handleSelfFilePick = (e) => {
    pickFiles(Array.from(e.target.files), (mapped) => { setSelfNewFiles((p) => [...p, ...mapped]); setSelfDirty(true); });
    e.target.value = "";
  };

  const markSelfRemove = (filePath) => {
    setSelfRemove((p) => [...p, filePath]);
    setSelfAtts((p) => p.filter((a) => a.file_path !== filePath));
    setSelfDirty(true);
  };

  const removeSelfNew = (i) => {
    setSelfNewFiles((p) => { const n = [...p]; if (n[i].preview) URL.revokeObjectURL(n[i].preview); n.splice(i, 1); return n; });
    setSelfDirty(true);
  };

  const withAction = (fn) => async (payload) => {
    setActionLoading(true);
    try { await fn(payload); fetchTask(); fetchAllTasks(); }
    catch (err) { toast.error(err.response?.data?.message || "Failed"); }
    finally { setActionLoading(false); }
  };

  const handleForward  = withAction(async ({ forward_to, note }) => {
    await taskService.forwardTask(id, { forward_to, note });
    toast.success("Task forwarded"); setForwardOpen(false);
  });
  const handleComplete = withAction(async ({ note }) => {
    await taskService.requestCompletion(id, { completion_note: note });
    toast.success("Completion requested"); setCompleteOpen(false);
  });
  const handleApprove  = withAction(async ({ note }) => {
    if (canL1Approve) {
      const sub = task.assignment_chain?.find((a) => a.role === "sub_user" && a.is_active && a.completion_requested_at && !a.completion_approved_at);
      if (!sub) throw new Error("No pending sub-user assignment found");
      await taskService.approveSubUser(id, sub.assignment_id, { approval_note: note });
      toast.success("Sub-user approved!");
    } else if (canAssignerApprove) {
      await taskService.creatorDecision(id, { decision: "approved", approval_note: note });
      toast.success("Task finally approved & completed!");
    }
    setApproveOpen(false);
  });
  const handleReject   = withAction(async ({ note }) => {
    if (canL1Reject) {
      const sub = task.assignment_chain?.find((a) => a.role === "sub_user" && a.is_active && a.completion_requested_at && !a.completion_approved_at);
      if (!sub) throw new Error("No pending sub-user assignment found");
      await taskService.rejectSubUser(id, sub.assignment_id, { rejection_note: note });
      toast.success("Sub-user request rejected");
    } else if (canAssignerReject) {
      await taskService.creatorDecision(id, { decision: "rejected", rejection_note: note });
      toast.success("Rejected — task back to In Progress");
    }
    setRejectOpen(false);
  });

  const handleRefreshAll = useCallback(() => {
    fetchTask();
    fetchChat();
    fetchSelfNote();
    fetchAllTasks();
  }, [fetchTask, fetchChat, fetchSelfNote, fetchAllTasks]);

  const handleSetTargetDate = async () => {
    if (!targetDateInput) { toast.error("Please select target date & time"); return; }
    setTargetDateSaving(true);
    try {
      await taskService.setTargetDate(id, { target_at: targetDateInput });
      toast.success("Target date set");
      setTargetDateInput("");
      await fetchTask();
      await fetchAllTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to set target date");
    } finally {
      setTargetDateSaving(false);
    }
  };

  const statusCfg   = TASK_STATUS_CONFIG[task?.status]            ?? {};
  const priorityCfg = PRIORITY_CONFIG_DETAIL_PAGE[task?.priority] ?? {};
  const isRecurring = task?.is_recurring === 1 || task?.is_recurring === true;
  const isOverdue   = task?.due_date && !["completed"].includes(task?.status) && new Date(task.due_date) < new Date();
  const assignChain = task?.assignment_chain ?? [];
  const topActionButtons = [
    canForward && {
      key: "forward",
      onClick: () => setForwardOpen(true),
      icon: Share2,
      label: isL1 ? "L1 Forward" : "Forward",
      cls: "bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100",
      pulse: false,
    },
    canComplete && {
      key: "complete",
      onClick: () => setCompleteOpen(true),
      icon: CheckCircle2,
      label: isL1 ? "L1 Complete" : "Complete",
      cls: "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100",
      pulse: false,
    },
    canL1Approve && {
      key: "l1-approve",
      onClick: () => setApproveOpen(true),
      icon: ThumbsUp,
      label: "L1 Approve",
      cls: "bg-indigo-600 text-white hover:bg-indigo-700",
      pulse: true,
    },
    canL1Reject && {
      key: "l1-reject",
      onClick: () => setRejectOpen(true),
      icon: XCircle,
      label: "L1 Reject",
      cls: "bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100",
      pulse: false,
    },
    canAssignerApprove && {
      key: "assigner-approve",
      onClick: () => setApproveOpen(true),
      icon: ThumbsUp,
      label: "Final Approve",
      cls: "bg-emerald-600 text-white hover:bg-emerald-700",
      pulse: true,
    },
    canAssignerReject && {
      key: "assigner-reject",
      onClick: () => setRejectOpen(true),
      icon: XCircle,
      label: "Final Reject",
      cls: "bg-rose-600 text-white hover:bg-rose-700",
      pulse: false,
    },
  ].filter(Boolean);

  const getCurrentDateTime = () => {
    const n = new Date(); const p = (x) => String(x).padStart(2,"0");
    return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`;
  };

  useEffect(() => {
    if (!isResizingPanels) return;
    const onMouseMove = (e) => {
      if (!mainSplitRef.current) return;
      const rect = mainSplitRef.current.getBoundingClientRect();
      if (!rect.width) return;
      const next = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPanelWidth(Math.max(30, Math.min(65, next)));
    };
    const onMouseUp = () => setIsResizingPanels(false);

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizingPanels]);

  // ── Sidebar Content JSX ──────────────────────────────────────────────────
  const sidebarContentJSX = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-2 py-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
          <Search size={11} className="text-slate-400 flex-shrink-0" />
          <input value={sidebarSearch} onChange={(e) => setSidebarSearchPersist(e.target.value)}
            placeholder="Search tasks…"
            className="flex-1 bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none min-w-0" />
          {sidebarSearch && <button onClick={() => setSidebarSearchPersist("")} className="text-slate-400 hover:text-slate-600"><X size={10} /></button>}
        </div>
      </div>

      <div className="flex px-2 gap-1 pb-2 flex-shrink-0 flex-wrap">
        {SIDEBAR_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSidebarTabPersist(key)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all flex-1 justify-center ${
              sidebarTab === key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
            }`}>
            <Icon size={9} /> {label}
          </button>
        ))}
      </div>

      <div ref={sidebarListRef} className="flex-1 overflow-y-auto px-2 pb-2 space-y-1"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
        {sidebarTasks.length === 0 ? (
          <div className="py-8 text-center">
            <ClipboardList size={20} className="mx-auto text-slate-300 mb-2" />
            <p className="text-[10px] text-slate-400">No tasks</p>
          </div>
        ) : sidebarTasks.map((t) => (
          <div key={t.task_id} data-task-id={String(t.task_id)}>
            <SidebarTaskItem task={t}
              isActive={String(t.task_id) === String(id)}
              colorData={getTaskColor(t)}
              onClick={() => {
                const newId = Number(t.task_id);
                setId(newId);
                router.push(buildTaskDetailUrl(newId, { report }), { scroll: false });
                setMobileSidebar(false);
              }} />
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-100 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400">{sidebarTasks.length} task{sidebarTasks.length !== 1 ? "s" : ""}</p>
          <SidebarCounts tasks={sidebarTasks} />
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {[
            { key: "approval",     label: "Approval"     },
            { key: "overdue",      label: "Overdue"      },
            { key: "due_today",    label: "Due Today"    },
            { key: "reminder",     label: "Reminder"     },
            { key: "upcoming_due", label: "Upcoming Due" },
            { key: "new_today",    label: "New"          },
            { key: "completed",    label: "Done"         },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: TASK_COLORS[key]?.bar }} />
              <span className="text-[9px] text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex overflow-hidden bg-slate-100" style={{ height: "100%" }}>

      {mobileSidebar && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileSidebar(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{report ? "Report list" : "All Tasks"}</span>
              <button onClick={() => setMobileSidebar(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={14} /></button>
            </div>
            {sidebarContentJSX}
          </div>
        </div>
      )}

      <div className={`flex-shrink-0 flex-col bg-white border-r border-slate-200 transition-all duration-300 hidden md:flex ${sidebarCollapsed ? "w-10" : "w-64"}`}>
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100 flex-shrink-0 h-13">
          {!sidebarCollapsed && (
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{report ? "Report list" : "Tasks"}</span>
          )}
          <button onClick={() => setSidebarCollapsedPersist(!sidebarCollapsed)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-auto">
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ArrowLeft size={14} />}
          </button>
        </div>
        {!sidebarCollapsed && sidebarContentJSX}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 md:px-5 py-2.5 flex items-center gap-2 z-20 shadow-sm">
          <button onClick={() => router.back()}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500 transition-all flex-shrink-0">
            <ArrowLeft size={15} />
          </button>
          <button onClick={() => setMobileSidebar(v => !v)}
            className="md:hidden p-1.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500 transition-all flex-shrink-0">
            <ClipboardList size={15} />
          </button>
          <div className="flex items-center gap-1 text-xs text-slate-400 min-w-0 flex-1">
            <span className="hidden sm:inline flex-shrink-0">{report ? "Reports" : "Tasks"}</span>
            <ChevronRight size={10} className="hidden sm:inline flex-shrink-0" />
            {loading ? <Sk className="h-4 w-32" /> : <span className="text-slate-600 font-semibold truncate">{task?.title}</span>}
          </div>
          {task && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {topActionButtons.map((btn) => (
                <ActionBtn
                  key={btn.key}
                  onClick={btn.onClick}
                  icon={btn.icon}
                  label={btn.label}
                  cls={btn.cls}
                  pulse={btn.pulse}
                />
              ))}
              <div className="w-px h-5 bg-slate-200 mx-0.5" />
              <button onClick={handleRefreshAll} disabled={loading}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500 transition-all">
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
              {((task.task_type === "self" && task.created_by_id === currentUserId) || (task.task_type !== "self" && task.assigned_by_id === currentUserId)) && (
                <button onClick={() => { if (!isTaskFinalDone) setEditOpen(true); }} disabled={isTaskFinalDone}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all shadow-sm ${
                    isTaskFinalDone ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60" : "bg-slate-800 text-white hover:bg-slate-900"
                  }`}>
                  <Edit2 size={12} /><span className="hidden sm:inline">Edit</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status banners */}
        <div className="flex-shrink-0">
          {isTaskDone && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border-b border-emerald-100">
              <div className="p-1 bg-emerald-100 rounded-full"><CheckCheck size={14} className="text-emerald-600" /></div>
              <div>
                <p className="text-[13px] font-bold text-emerald-900 leading-none mb-1">Task Successfully Completed</p>
                <p className="text-[11px] text-emerald-700 font-medium">This record is now read-only. Editing, assignments, and messaging are permanently disabled.</p>
              </div>
            </div>
          )}
          {(task?.status === "pending_approval" || task?.status === "creator_pending") && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100">
              <div className="p-1 bg-amber-100 rounded-full animate-pulse"><AlertTriangle size={14} className="text-amber-600" /></div>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-amber-900 leading-none mb-1">
                  {task?.status === "creator_pending" ? "Final Approval Required" : "L1 Review Pending"}
                </p>
                <p className="text-[11px] text-amber-700 font-medium leading-tight">
                  {task?.status === "creator_pending"
                    ? "Level-1 has submitted this task for your final closure. Review the work and approve or reject."
                    : "A sub-user has requested task completion. Please verify the submission and take necessary action."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div ref={detailScrollRef} className="flex-1 overflow-y-auto lg:overflow-hidden p-2 md:p-3 grid grid-cols-12 gap-2">
          {loading ? (
            <>
              <div className="col-span-12 lg:col-span-5 space-y-3"><Sk className="h-48 rounded-2xl" /><Sk className="h-32 rounded-2xl" /></div>
              <div className="col-span-12 lg:col-span-7"><Sk className="h-full rounded-2xl" /></div>
            </>
          ) : !task ? (
            <div className="col-span-12 flex items-center justify-center">
              <div className="bg-white rounded-2xl p-12 text-center text-slate-400 shadow-sm">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Task not found</p>
              </div>
            </div>
          ) : (
            <div ref={mainSplitRef} className="col-span-12 min-h-0 flex flex-col lg:flex-row gap-2">
              {/* LEFT PANEL */}
              <div
                className="flex flex-col gap-2 overflow-y-auto min-h-0 pb-1 w-full lg:flex-none lg:min-w-[320px] lg:max-w-[65%]"
                style={{
                  flexBasis: `${leftPanelWidth}%`,
                  scrollbarWidth: "thin",
                  scrollbarColor: "#e2e8f0 transparent",
                }}
              >

                <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex flex-wrap items-center gap-2">
                  <Badge config={statusCfg} />
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${priorityCfg.bg} ${priorityCfg.color}`}>
                    <Flag size={9} /> {priorityCfg.label}
                  </span>
                  {isRecurring && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-indigo-50 text-indigo-600 border-indigo-200"><Repeat size={9} /> {task.recurrence_type}</span>}
                  {isOverdue   && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-rose-50 text-rose-600 border-rose-200"><AlertCircle size={9} /> Overdue</span>}
                  <span className="ml-auto text-[10px] text-slate-400">#{task.task_id}</span>
                </div>

                <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell size={13} className="text-purple-500" />
                      <span className="text-sm font-semibold text-slate-700">Personal Reminder</span>
                      {savedReminder && !reminderDirty && (
                        <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-semibold">Saved</span>
                      )}
                      {reminderDirty && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Unsaved</span>
                      )}
                    </div>
                    {selfReminder && (
                      <button
                        onClick={() => { setSelfReminder(""); setReminderDirty(true); }}
                        className="text-[10px] text-rose-400 hover:text-rose-600 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <input
                      type="datetime-local"
                      value={selfReminder}
                      min={getCurrentDateTime()}
                      onChange={(e) => { setSelfReminder(e.target.value); setReminderDirty(true); }}
                      className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                    />
                    {savedReminder && !reminderDirty && (
                      <p className="text-[10px] text-purple-500 flex items-center gap-1">
                        🔔 Active: {formatDateTimeLocalLabel(savedReminder)}
                      </p>
                    )}
                    {selfReminder && reminderDirty && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1">
                        Preview: {formatDateTimeLocalLabel(selfReminder)} — click Save to apply
                      </p>
                    )}
                    <button
                      onClick={handleSaveReminder}
                      disabled={reminderSaving || !reminderDirty}
                      className="w-full py-2 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
                    >
                      {reminderSaving ? "Saving…" : savedReminder ? "Update Reminder" : "Save Reminder"}
                    </button>
                  </div>
                </div>

                <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-50">
                    <div className="flex justify-between items-start gap-3">
                      <h2 className="text-base font-bold text-slate-800 leading-tight">{task.title}</h2>
                      {isOverdue && <span className="shrink-0 bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-100 uppercase">Overdue</span>}
                    </div>
                    {task.description ? <RichTextDisplay value={task.description} className="mt-2" /> : <p className="mt-2 text-xs text-slate-300 italic">No description provided</p>}
                  </div>
                  <div className="p-4 bg-slate-50/50">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <div className="space-y-3">
                        <MiniRow label="Created By"  value={task.created_by_name ? `${task.created_by_name}${task.creator_label ? ` (${task.creator_label})` : ""}` : null} icon={<User size={12}/>} />
                        <MiniRow label="Assigned By" value={task.assigned_by_name}       icon={<User size={12}/>} />
                        <MiniRow label="Assigned To" value={task.current_holder_name || task.first_assigned_to_name} icon={<Shield size={12} />} color="text-indigo-600" />
                      </div>
                      <div className="space-y-3">
                        <MiniRow label="Due Date" value={fmtDt(task.due_date)} icon={<Calendar size={12}/>} color={isOverdue ? "text-rose-600 font-bold" : ""} />
                        <MiniRow label="Reminder" value={fmtDt(task.reminder_date ?? task.self_reminder_date)} icon={<Clock size={12}/>} />
                        <MiniRow label="Category" value={task.category_name} icon={<Tag size={12}/>} />
                      </div>
                      <div className="col-span-2 pt-2 mt-1 border-t border-slate-100 flex flex-wrap gap-4">
                        {task.created_at   && <div className="flex items-center gap-1.5 text-slate-400"><Clock size={11}/><span className="text-[10px]">Created: {formatDateTime(task.created_at)}</span></div>}
                        {task.updated_at   && <div className="flex items-center gap-1.5 text-slate-400"><Clock size={11}/><span className="text-[10px]">Last Updated: {formatDateTime(task.updated_at)}</span></div>}
                        {task.completed_at && <div className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 size={12}/><span className="text-[10px] font-bold uppercase tracking-tight">Completed: {formatDateTime(task.completed_at)}</span></div>}
                      </div>
                    </div>
                  </div>
                </div>

                {isAssignedTask && (
                  <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-sky-500" />
                        <span className="text-sm font-semibold text-slate-700">Target Date</span>
                        {hasValidTarget && task?.current_target?.target_at && (
                          <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
                        )}
                      </div>
                    </div>
                    <div className="p-3 space-y-3">
                      {task?.current_target?.target_at && (
                        <div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2">
                          <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wide">Current Target</p>
                          <p className="text-sm font-bold text-sky-900 mt-0.5">{formatDateTime(task.current_target.target_at)}</p>
                          {task.current_target.set_by_name && (
                            <p className="text-[10px] text-sky-600 mt-1">Set by {task.current_target.set_by_name}</p>
                          )}
                        </div>
                      )}
                      {canSetTargetDate && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-slate-500">
                            {canAdminOverrideTarget
                              ? "Admin override — change target date before current one passes:"
                              : task?.current_target?.target_at
                                ? "Set next target date (current target has passed):"
                                : "Set your target date & time:"}
                          </p>
                          <input
                            type="datetime-local"
                            value={targetDateInput}
                            min={getCurrentDateTime()}
                            onChange={(e) => setTargetDateInput(e.target.value)}
                            className="w-full border border-sky-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all"
                          />
                          <button
                            onClick={handleSetTargetDate}
                            disabled={targetDateSaving || !targetDateInput}
                            className="w-full py-2 text-xs font-semibold rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 transition-colors"
                          >
                            {targetDateSaving
                              ? "Saving…"
                              : canAdminOverrideTarget
                                ? "Override Target Date"
                                : task?.current_target?.target_at
                                  ? "Set Next Target Date"
                                  : "Set Target Date"}
                          </button>
                        </div>
                      )}
                      {hasValidTarget && !canSetTargetDate && isL1 && (
                        <p className="text-[10px] text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
                          Target date is locked until {formatDateTime(task.current_target.target_at)} passes. Contact Admin to change it earlier.
                        </p>
                      )}
                      {(task?.target_dates?.length ?? 0) > 0 && (
                        <div className="border-t border-slate-100 pt-2">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Previous Target Dates</p>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {task.target_dates.map((td, idx) => (
                              <div
                                key={`${td.target_at}-${td.created_at}-${idx}`}
                                className={`flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg ${
                                  td.is_current ? "bg-sky-50 text-sky-800 border border-sky-100" : "bg-slate-50 text-slate-600"
                                }`}
                              >
                                <span>{formatDateTime(td.target_at)}</span>
                                <span className="text-[9px] text-slate-400">{td.is_current ? "Current" : "Past"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <TrendingUp size={13} className="text-emerald-500" />
                    <span className="text-sm font-semibold text-slate-700">Quick Stats</span>
                  </div>
                  <div className="p-3 grid grid-cols-4 gap-2">
                    {[
                      { label: "Messages",    value: chatMessages.length,        color: "text-indigo-600", bg: "bg-indigo-50"  },
                      { label: "Activities",  value: task.task_log?.length ?? 0, color: "text-blue-600",   bg: "bg-blue-50"    },
                      { label: "Chain",       value: assignChain.length,         color: "text-violet-600", bg: "bg-violet-50"  },
                      { label: "Attachments", value: selfAtts.length,            color: "text-amber-600",  bg: "bg-amber-50"   },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className={`${bg} rounded-xl p-2 text-center`}>
                        <div className={`text-lg font-bold ${color}`}>{value}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <button onClick={() => setShowChain(v => !v)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <GitBranch size={13} className="text-violet-500" />
                      <span className="text-sm font-semibold text-slate-700">Assignment Chain</span>
                      {assignChain.length > 0 && <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-semibold">{assignChain.length}</span>}
                    </div>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${showChain ? "rotate-180" : ""}`} />
                  </button>
                  {showChain && <div className="border-t border-slate-100 px-4 py-3"><AssignmentChain chain={assignChain} /></div>}
                </div>

                <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setShowActivity(v => !v)}>
                    <div className="flex items-center gap-2">
                      <Activity size={13} className="text-blue-500" />
                      <span className="text-sm font-semibold text-slate-700">Activity Log</span>
                      {(task.task_log?.length ?? 0) > 0 && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">{task.task_log.length}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {(task.task_log?.length ?? 0) > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setActivityModalOpen(true); }}
                          className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                          <Activity size={10} /> View All
                        </button>
                      )}
                      <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${showActivity ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                  {showActivity && (
                    <div className="border-t border-slate-100">
                      <div className="overflow-y-auto px-4 pt-3 pb-4"
                        style={{ maxHeight: 260, scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
                        {(task.task_log?.length ?? 0) === 0
                          ? <p className="text-xs text-slate-400 text-center py-3">No activity yet</p>
                          : task.task_log.map((log, i) => (
                              <TimelineItem key={log.activity_id} action={log.action} action_detail={log.action_detail}
                                performedBy={log.performed_by} time={log.action_time} isLast={i === task.task_log.length - 1} />
                            ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div
                onMouseDown={() => setIsResizingPanels(true)}
                className="hidden lg:flex w-3 items-center justify-center cursor-col-resize select-none"
                title="Drag to resize panels"
              >
                <div className={`w-1.5 h-16 rounded-full transition-colors ${isResizingPanels ? "bg-indigo-400" : "bg-slate-200 hover:bg-slate-300"}`} />
              </div>

              {/* RIGHT PANEL */}
              <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-0">
                <div className="flex-shrink-0 flex items-center px-3 pt-3 pb-0 border-b border-slate-100 gap-0.5">
                  <div className="flex gap-0.5 flex-1">
                    {[
                      { id: "chat", label: "Chat",    icon: MessageSquare, badge: chatMessages.length > 0 ? chatMessages.length : null },
                      { id: "self", label: "My Note", icon: Lock,          badge: null },
                    ].map(({ id: tid, label, icon: Icon, badge }) => (
                      <button key={tid} onClick={() => setRightTab(tid)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-semibold transition-all border-b-2 -mb-px ${
                          rightTab === tid ? "border-indigo-600 text-indigo-600 bg-indigo-50/50" : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                        }`}>
                        <Icon size={12} /> {label}
                        {badge !== null && <span className={`text-[10px] px-1.5 rounded-full ${rightTab === tid ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500"}`}>{badge}</span>}
                      </button>
                    ))}
                  </div>
                  {rightTab === "chat" && <div className="flex-shrink-0 mb-1"><ChatMembers taskDetail={task} /></div>}
                </div>

                {rightTab === "chat" && (
                  <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                    <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4"
                      style={{ background: "linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)", scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
                      {chatLoading ? (
                        <div className="flex items-center justify-center h-full"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
                      ) : chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3"><MessageSquare size={22} className="text-slate-300" /></div>
                          <p className="text-sm font-medium text-slate-400">No messages yet</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {isTaskDone ? "Task is completed" : isChatLockedByTarget ? "Waiting for target date — only Assigned By can chat" : "Start the conversation below"}
                          </p>
                        </div>
                      ) : chatMessages.map((msg) => (
                        <ChatBubble key={msg.chat_id} msg={msg} onReply={setReplyTo} onDelete={handleDeleteChatMsg} isTaskDone={isTaskDone} isSuperAdmin={isSuperAdmin} />
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    {replyTo && !isTaskDone && !isChatLockedByTarget && (
                      <div className="flex-shrink-0 px-3 py-2 border-t border-indigo-100 bg-indigo-50 flex items-center gap-2">
                        <CornerUpLeft size={12} className="text-indigo-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold text-indigo-600">{replyTo.sender_name}</span>
                          <p className="text-xs text-indigo-700 truncate italic">{replyTo.message}</p>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="text-indigo-400 hover:text-indigo-600"><X size={13} /></button>
                      </div>
                    )}
                    {chatFiles.length > 0 && !isTaskDone && !isChatLockedByTarget && (
                      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-100 bg-white flex gap-2 overflow-x-auto">
                        {chatFiles.map((f, i) => <FilePill key={i} file={{ file_name: f.name, preview: f.preview }} isNew onRemove={() => removeChatFile(i)} />)}
                      </div>
                    )}
                    {isTaskDone ? (
                      <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-center gap-2">
                        <Lock size={13} className="text-slate-400" />
                        <p className="text-xs text-slate-400 font-medium">Chat is locked — task completed</p>
                      </div>
                    ) : isChatLockedByTarget ? (
                      <div className="flex-shrink-0 px-4 py-3 border-t border-sky-100 bg-sky-50 flex items-center justify-center gap-2 text-center">
                        <Lock size={13} className="text-sky-500 flex-shrink-0" />
                        <p className="text-xs text-sky-700 font-medium">Chat locked — Assigned To must set target date first. Only Assigned By can message.</p>
                      </div>
                    ) : (
                      <div className="flex-shrink-0 px-3 py-3 border-t border-slate-100 bg-white">
                        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                          <AutoTextarea value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={handleChatKey}
                            placeholder={replyTo ? "Write a reply…" : "Type a message… (Enter to send)"}
                            disabled={isTaskDone} />
                          <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
                            <input ref={chatFileRef} type="file" multiple className="hidden"
                              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx" onChange={handleChatFilePick} />
                            <button onClick={() => chatFileRef.current?.click()}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Paperclip size={15} /></button>
                            <button onClick={() => chatFileRef.current?.click()}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><ImageIcon size={15} /></button>
                            <button onClick={handleChatSend}
                              disabled={chatSending || (!chatMsg.trim() && chatFiles.length === 0)}
                              className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors shadow-sm disabled:opacity-40">
                              {chatSending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 ml-1">Shift+Enter for new line · Hover a message to reply or delete</p>
                      </div>
                    )}
                  </div>
                )}

                {rightTab === "self" && (
                  <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                    <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4"
                      style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
                      <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                          <Lock size={14} className="text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-amber-800">Private Note — Only You Can See This</p>
                          <p className="text-[10px] text-amber-600 mt-0.5">Stored per task, per user. No one else has access.</p>
                        </div>
                        {autoSaving
                          ? <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold flex-shrink-0 flex items-center gap-1"><RefreshCw size={8} className="animate-spin" /> Saving…</span>
                          : selfDirty
                            ? <span className="text-[10px] bg-amber-200 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Unsaved</span>
                            : selfNoteExists
                              ? <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Saved ✓</span>
                              : null}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Note</label>
                          {autoSaveEnabled && <span className="text-[10px] text-slate-400 flex items-center gap-1"><RefreshCw size={8} /> Auto-save on</span>}
                        </div>
                        <textarea value={selfNote} onChange={(e) => { setSelfNote(e.target.value); setSelfDirty(true); }}
                          placeholder="Write your private notes for this task…"
                          className="w-full border rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all resize-none leading-relaxed bg-amber-50/40 border-amber-200/70 focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                          style={{ minHeight: 380 }} />
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Paperclip size={12} className="text-slate-400" />
                            <span className="text-xs font-semibold text-slate-600">Attachments ({selfAtts.length + selfNewFiles.length})</span>
                          </div>
                          <>
                            <input ref={selfFileRef} type="file" multiple className="hidden" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx" onChange={handleSelfFilePick} />
                            <button onClick={() => selfFileRef.current?.click()}
                              className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
                              <Paperclip size={10} /> Add Files
                            </button>
                          </>
                        </div>
                        {selfAtts.length === 0 && selfNewFiles.length === 0 ? (
                          <div onClick={() => selfFileRef.current?.click()} className="px-4 py-8 text-center cursor-pointer hover:bg-slate-50">
                            <Paperclip size={20} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs text-slate-400">Click to attach files</p>
                            <p className="text-[10px] text-slate-300 mt-0.5">Images (JPG, PNG, WEBP) · Documents (PDF, DOC, DOCX)</p>
                          </div>
                        ) : (
                          <div className="p-3">
                            {selfAtts.length > 0 && (
                              <div className="mb-3">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Saved Files</p>
                                <div className="flex flex-wrap gap-2">{selfAtts.map((a, i) => <FilePill key={i} file={a} onRemove={() => markSelfRemove(a.file_path)} />)}</div>
                              </div>
                            )}
                            {selfNewFiles.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Pending Upload</p>
                                <div className="flex flex-wrap gap-2">{selfNewFiles.map((f, i) => <FilePill key={i} file={{ file_name: f.name, preview: f.preview }} isNew onRemove={() => removeSelfNew(i)} />)}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 bg-white flex items-center justify-between">
                      <p className="text-[10px] text-slate-400">
                        {selfNoteExists ? "Updates saved on server" : "Will create new private note"}
                        {selfNewFiles.length > 0 && ` · ${selfNewFiles.length} file(s) pending`}
                        {selfRemove.length > 0   && ` · ${selfRemove.length} file(s) to remove`}
                      </p>
                      <button onClick={() => handleSaveSelf()}
                        disabled={selfSaving || (!selfNote.trim() && selfNewFiles.length === 0 && selfRemove.length === 0)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-xs font-semibold rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50 shadow-sm">
                        {selfSaving ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Save Note
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ForwardModal open={forwardOpen}  onClose={() => setForwardOpen(false)}  onSubmit={handleForward}  loading={actionLoading} users={users} />
      <ActionModal  open={completeOpen} onClose={() => setCompleteOpen(false)} onSubmit={handleComplete} loading={actionLoading} type="complete" />
      <ActionModal  open={approveOpen}  onClose={() => setApproveOpen(false)}  onSubmit={handleApprove}  loading={actionLoading} type="approve" />
      <ActionModal  open={rejectOpen}   onClose={() => setRejectOpen(false)}   onSubmit={handleReject}   loading={actionLoading} type="reject"  />
      {editOpen && task && !isTaskDone && (
        <TaskModal open={editOpen} onClose={() => setEditOpen(false)} editTask={task}
          onSuccess={() => { setEditOpen(false); fetchTask(); fetchAllTasks(); }}
          taskType={task.task_type === "self" ? "self" : "assigned"} currentUser={currentUser} />
      )}
      <ActivityLogModal open={activityModalOpen} onClose={() => setActivityModalOpen(false)} taskId={task?.task_id} taskTitle={task?.title} taskStatus={task?.status} logs={task?.task_log ?? null} />
    </div>
  );
}

