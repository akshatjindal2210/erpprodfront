"use client";

import { Plus, Pencil, Eye, Trash2, CheckCircle } from "lucide-react";
import ActionButton from "@/ui/primitives/ActionButton";
import { LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";

/** Shared list-page action button classes (IMS-style). */
export const LIST_PAGE_PRIMARY_ACTION = `${LIST_PAGE_ACTION_CLASS} px-4`;
export const LIST_PAGE_OUTLINE_ACTION = `${LIST_PAGE_ACTION_CLASS} bg-white px-4 border-slate-300`;
export const LIST_PAGE_DANGER_ACTION = `${LIST_PAGE_ACTION_CLASS} px-4`;

export function ListPageAddButton({ module, label = "New", onClick, ...props }) {
  return (
    <ActionButton
      module={module}
      action="add"
      label={label}
      icon={Plus}
      onClick={onClick}
      className={LIST_PAGE_PRIMARY_ACTION}
      {...props}
    />
  );
}

export function ListPageEditButton({ module, label = "Edit", disabled, record, onClick, ...props }) {
  return (
    <ActionButton
      module={module}
      action="edit"
      variant="outline"
      label={label}
      icon={Pencil}
      disabled={disabled}
      record={record}
      onClick={onClick}
      className={LIST_PAGE_OUTLINE_ACTION}
      {...props}
    />
  );
}

export function ListPageViewButton({ module, label = "View", disabled, record, onClick, ...props }) {
  return (
    <ActionButton
      module={module}
      action="view"
      variant="outline"
      label={label}
      icon={Eye}
      disabled={disabled}
      record={record}
      onClick={onClick}
      className={LIST_PAGE_OUTLINE_ACTION}
      {...props}
    />
  );
}

export function ListPageApproveButton({ module, label = "Approve", disabled, record, onClick, ...props }) {
  return (
    <ActionButton
      module={module}
      action="authorize"
      label={label}
      icon={CheckCircle}
      disabled={disabled}
      record={record}
      onClick={onClick}
      className={LIST_PAGE_PRIMARY_ACTION}
      {...props}
    />
  );
}

export function ListPageDeleteButton({ module, label = "Delete", disabled, onClick, ...props }) {
  return (
    <ActionButton
      module={module}
      action="delete"
      variant="danger"
      label={label}
      icon={Trash2}
      disabled={disabled}
      onClick={onClick}
      className={LIST_PAGE_DANGER_ACTION}
      {...props}
    />
  );
}
