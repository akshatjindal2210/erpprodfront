"use client";
import React from 'react';
import { useCanAccess } from "@/hooks/useCanAccess";

const ActionButton = ({ module, action, label, icon: Icon, variant = "primary", onClick, disabled, className = "", record = null, ...props }) => {
  const canAccess = useCanAccess();

  const access = canAccess(module, action);
  
  // Simplified check: access is now always an object { allowed, days }
  if (!access.allowed) return null;

  // Additional check for edit days if record is provided
  let isTimeRestricted = false;
  if (action === "edit" && record && access.days > 0) {
    const createdAt = new Date(record.created_at || record.timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - createdAt);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > access.days) {
      isTimeRestricted = true;
    }
  }

  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-sm",    
    outline: "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400",
    danger: "bg-white border-slate-300 text-rose-600 hover:bg-rose-50 hover:border-rose-200",
    ghost: "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700"
  };
  
  const baseStyles = "flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed border";

  return (
    <button
      onClick={onClick}
      disabled={disabled || isTimeRestricted}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      title={isTimeRestricted ? `Edit time limit exceeded (${access.days} days)` : ""}
      {...props}
    >
      {Icon && <Icon size={16} strokeWidth={2} />}
      {label && <span>{label}</span>}
    </button>
  );
};

export default ActionButton;