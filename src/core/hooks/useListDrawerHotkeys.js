"use client";

import { useCallback, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { isHotkeyTypingTarget } from "@/core/utils/listHotkeys";

export function editTimeBlockedByAccess(record, access) {
  if (!record || !access || access.days <= 0) return false;
  const createdAt = new Date(record.created_at || record.timestamp);
  if (Number.isNaN(createdAt.getTime())) return false;
  const diffDays = Math.ceil(Math.abs(Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > access.days;
}

function canOpenNewByAccess(canAccess, module, addAction, addActions) {
  const actions = Array.isArray(addActions) && addActions.length > 0 ? addActions : [addAction];
  return actions.some((action) => canAccess(module, action).allowed);
}

/**
 * List drawer shortcuts — window listener here; pass `tableHotkeyProps` to DataTable for `hotkeysDisabled` only.
 * Browser: Ctrl+Alt+N / E / P / A. PWA: Ctrl+N (New), Ctrl+E (Edit), Ctrl+D (Delete), Ctrl+P (Print), Ctrl+A (Approve).
 */
export function useListDrawerHotkeys({
  module,
  addAction = "add",
  /** When set, New is allowed if any listed action is permitted (e.g. packing_entry add or edit). */
  addActions,
  editAction = "edit",
  authorizeAction = "authorize",
  /** When set, overrides canAccess(module, authorizeAction) for approve hotkey/button gating. */
  getAuthorizeAccess,
  /**
   * Skip portal `canAccess(module, …)` for New/Edit.
   * Use when the page already gates `openAdd` / `openEdit` (e.g. Task `canFeature`).
   */
  bypassModulePermission = false,
  modalOpen,
  selectedId,
  getSelectedRow,
  openAdd,
  openEdit,
  openApprove,
  canApproveSelection,
  onApproveBlocked,
  approveBlockedMessage,
  canOpenNew,
  newBlockedMessage,
  onNewBlocked,
  canEditSelection,
  onEditBlocked,
  editBlockedMessage,
  onPrint,
  canPrintSelection,
  printBlockedMessage,
  onPrintBlocked,
  printModule,
  printAction = "view",
  openDelete,
  canDeleteSelection,
  onDeleteBlocked,
  deleteBlockedMessage,
}) {
  const canAccess = useCanAccess();

  const openNewModal = useCallback(() => {
    if (!bypassModulePermission && !canOpenNewByAccess(canAccess, module, addAction, addActions)) return;
    if (typeof canOpenNew === "function" && !canOpenNew()) {
      if (typeof onNewBlocked === "function") {
        onNewBlocked();
      } else if (newBlockedMessage && String(newBlockedMessage).trim()) {
        toast.info(String(newBlockedMessage).trim());
      }
      return;
    }
    openAdd();
  }, [bypassModulePermission, canAccess, module, addAction, addActions, canOpenNew, newBlockedMessage, onNewBlocked, openAdd]);

  const openEditModal = useCallback(() => {
    if (typeof openEdit !== "function" || openEdit === null) return;
    const row = typeof getSelectedRow === "function" ? getSelectedRow() : null;
    if (!row) return;
    if (!bypassModulePermission) {
      const access = canAccess(module, editAction);
      if (!access.allowed) return;
      if (editTimeBlockedByAccess(row, access)) return;
    }
    openEdit(row);
  }, [bypassModulePermission, canAccess, module, editAction, getSelectedRow, openEdit, canEditSelection, onEditBlocked, editBlockedMessage]);

  const openApproveModal = useCallback(() => {
    if (typeof openApprove !== "function" || openApprove === null) return;
    const access =
      typeof getAuthorizeAccess === "function"
        ? getAuthorizeAccess()
        : canAccess(module, authorizeAction);
    if (!access?.allowed) return;
    if (typeof canApproveSelection === "function" && !canApproveSelection()) {
      if (typeof onApproveBlocked === "function") {
        onApproveBlocked();
      } else if (approveBlockedMessage && String(approveBlockedMessage).trim()) {
        toast.info(String(approveBlockedMessage).trim());
      }
      return;
    }
    const row = typeof getSelectedRow === "function" ? getSelectedRow() : null;
    if (!row) return;
    openApprove(row);
  }, [
    openApprove,
    canAccess,
    module,
    authorizeAction,
    getAuthorizeAccess,
    canApproveSelection,
    onApproveBlocked,
    approveBlockedMessage,
    getSelectedRow,
  ]);

  const openPrintModal = useCallback(() => {
    if (typeof onPrint !== "function" || onPrint === null) return;
    if (typeof canPrintSelection === "function" && !canPrintSelection()) {
      if (typeof onPrintBlocked === "function") {
        onPrintBlocked();
      } else if (printBlockedMessage && String(printBlockedMessage).trim()) {
        toast.info(String(printBlockedMessage).trim());
      }
      return;
    }
    const row = typeof getSelectedRow === "function" ? getSelectedRow() : null;
    if (!row) return;
    if (printModule) {
      const access = canAccess(printModule, printAction);
      if (!access.allowed) return;
    }
    onPrint(row);
  }, [onPrint, canPrintSelection, printBlockedMessage, onPrintBlocked, getSelectedRow, printModule, printAction, canAccess]);

  const openDeleteModal = useCallback(() => {
    if (typeof openDelete !== "function" || openDelete === null) return;
    if (typeof canDeleteSelection === "function" && !canDeleteSelection()) {
      if (typeof onDeleteBlocked === "function") {
        onDeleteBlocked();
      } else if (deleteBlockedMessage && String(deleteBlockedMessage).trim()) {
        toast.info(String(deleteBlockedMessage).trim());
      }
      return;
    }
    const row = typeof getSelectedRow === "function" ? getSelectedRow() : null;
    if (!row) return;
    openDelete(row);
  }, [openDelete, canDeleteSelection, onDeleteBlocked, deleteBlockedMessage, getSelectedRow]);

  const tableHotkeyProps = useMemo(() => {
    return { hotkeysDisabled: modalOpen };
  }, [modalOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (modalOpen) return;
      if (isHotkeyTypingTarget(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = (e.key || "").toLowerCase();
      const isAlt = e.altKey;
      const isShift = e.shiftKey;

      if (!mod && e.key !== "Insert" && e.key !== "F2" && e.key !== "Delete") return;

      // PWA detection
      const isPWA = typeof window !== "undefined" &&
        (window.matchMedia("(display-mode: standalone)").matches || !!window.navigator.standalone);

      // 1. NEW: Ctrl+Alt+N (Browser), Ctrl+N (PWA), or Insert
      if ((mod && key === "n") || e.key === "Insert") {
        e.preventDefault();
        e.stopPropagation();
        const allowN = (mod && isAlt) || (mod && !isAlt && isPWA) || e.key === "Insert";
        if (allowN && typeof openAdd === "function" && openAdd !== null) {
          openNewModal();
        }
        return;
      }

      // 2. EDIT: Ctrl+Alt+E (Browser), Ctrl+E (PWA), or F2
      if ((mod && key === "e") || e.key === "F2") {
        e.preventDefault();
        e.stopPropagation();
        const allowE = (mod && isAlt) || (mod && !isAlt && isPWA) || e.key === "F2";
        if (allowE && typeof openEdit === "function" && openEdit !== null) {
          openEditModal();
        }
        return;
      }

      // 3. PRINT: Ctrl+P or Ctrl+Alt+P
      if (mod && key === "p") {
        e.preventDefault();
        e.stopPropagation();
        if (typeof onPrint === "function" && onPrint !== null) {
          openPrintModal();
        }
        return;
      }

      // 4. APPROVE: Ctrl+A
      if (mod && key === "a" && !isAlt && !isShift) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof openApprove === "function" && openApprove !== null) {
          openApproveModal();
        }
        return;
      }

      // 5. DELETE: Ctrl+D, Ctrl+Alt+D, or Delete key
      if ((mod && key === "d") || e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        if (typeof openDelete === "function" && openDelete !== null) {
          openDeleteModal();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    modalOpen,
    openNewModal,
    openEditModal,
    openPrintModal,
    openApproveModal,
    openDeleteModal,
    openEdit,
    onPrint,
    openApprove,
    openDelete,
  ]);

  return { openNewModal, openEditModal, openApproveModal, openPrintModal, openDeleteModal, tableHotkeyProps };
}
