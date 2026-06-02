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
 * List drawer shortcuts (N/E/P/A) — window listener here; pass `tableHotkeyProps` to DataTable for `hotkeysDisabled` only.
 * Ctrl+Alt+N / Ctrl+Alt+E / Ctrl+Alt+P (browser); Ctrl+N / E / P in PWA.
 */
export function useListDrawerHotkeys({
  module,
  addAction = "add",
  /** When set, New is allowed if any listed action is permitted (e.g. packing_entry add or edit). */
  addActions,
  editAction = "edit",
  authorizeAction = "authorize",
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
}) {
  const canAccess = useCanAccess();

  const openNewModal = useCallback(() => {
    if (!canOpenNewByAccess(canAccess, module, addAction, addActions)) return;
    if (typeof canOpenNew === "function" && !canOpenNew()) {
      if (typeof onNewBlocked === "function") {
        onNewBlocked();
      } else if (newBlockedMessage && String(newBlockedMessage).trim()) {
        toast.info(String(newBlockedMessage).trim());
      }
      return;
    }
    openAdd();
  }, [canAccess, module, addAction, addActions, canOpenNew, newBlockedMessage, onNewBlocked, openAdd]);

  const openEditModal = useCallback(() => {
    if (typeof openEdit !== "function") return;
    if (selectedId == null || selectedId === "") return;
    if (typeof canEditSelection === "function" && !canEditSelection()) {
      if (typeof onEditBlocked === "function") {
        onEditBlocked();
      } else if (editBlockedMessage && String(editBlockedMessage).trim()) {
        toast.info(String(editBlockedMessage).trim());
      }
      return;
    }
    const row = typeof getSelectedRow === "function" ? getSelectedRow() : null;
    if (!row) return;
    const access = canAccess(module, editAction);
    if (!access.allowed) return;
    if (editTimeBlockedByAccess(row, access)) return;
    openEdit(row);
  }, [canAccess, module, editAction, selectedId, getSelectedRow, openEdit, canEditSelection, onEditBlocked, editBlockedMessage]);

  const openApproveModal = useCallback(() => {
    if (typeof openApprove !== "function") return;
    if (selectedId == null || selectedId === "") return;
    const access = canAccess(module, authorizeAction);
    if (!access.allowed) return;
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
    selectedId,
    canAccess,
    module,
    authorizeAction,
    canApproveSelection,
    onApproveBlocked,
    approveBlockedMessage,
    getSelectedRow,
  ]);

  const openPrintModal = useCallback(() => {
    if (typeof onPrint !== "function") return;
    if (selectedId == null || selectedId === "") return;
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
  }, [onPrint, selectedId, canPrintSelection, printBlockedMessage, onPrintBlocked, getSelectedRow, printModule, printAction, canAccess]);

  const tableHotkeyProps = useMemo(() => {
    return { hotkeysDisabled: modalOpen };
  }, [modalOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (modalOpen) return;
      if (isHotkeyTypingTarget(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = (e.key || "").toLowerCase();
      const listChord = mod && e.altKey && !e.shiftKey;
      const listChordPwa = mod && !e.altKey && !e.shiftKey;

      if ((listChord || listChordPwa) && key === "n") {
        e.preventDefault();
        e.stopPropagation();
        openNewModal();
        return;
      }

      if ((listChord || listChordPwa) && key === "e" && typeof openEdit === "function") {
        e.preventDefault();
        e.stopPropagation();
        openEditModal();
        return;
      }

      if ((listChord || listChordPwa) && key === "p" && typeof onPrint === "function") {
        e.preventDefault();
        e.stopPropagation();
        openPrintModal();
        return;
      }

      if (mod && !e.altKey && !e.shiftKey && key === "a" && typeof openApprove === "function") {
        e.preventDefault();
        e.stopPropagation();
        openApproveModal();
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
    openEdit,
    onPrint,
    openApprove,
  ]);

  return { openNewModal, openEditModal, openApproveModal, openPrintModal, tableHotkeyProps };
}
