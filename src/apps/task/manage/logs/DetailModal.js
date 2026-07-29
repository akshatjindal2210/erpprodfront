"use client";

import { ScrollText, User, Clock, Hash, Info, User2 } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";

export default function LogDetailModal({ item, onClose }) {
  if (!item) return null;

  const rows = [
    { icon: Hash,       label: "Log ID",    value: item.id },
    { icon: User,       label: "User",      value: item.user_name ?? `User #${item.user_id}` },
    { icon: User2,       label: "Username",  value: item.user_username ? `@${item.user_username}` : "—" },
    { icon: ScrollText, label: "Action",    value: item.action_type },
    { icon: Clock,      label: "Timestamp", value: new Date(item.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    },
  ];

  const renderLogData = () => {
    if (!item.log_data) return null;
    let data = item.log_data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (e) { return null; }
    }

    const body = data.updated_fields || data.body || data.changes || data.meta || (data.id && Object.keys(data).length > 1 ? data : null);
    if (!body || typeof body !== "object" || Object.keys(body).length === 0) return null;

    return (
      <div className="mt-6 pt-5 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 bg-violet-500 rounded-full" />
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Changes / Details</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(body).map(([key, value]) => {
            if (["password", "token", "otp", "id", "created_at", "updated_at", "success"].includes(key.toLowerCase())) return null;
            return (
              <div key={key} className="flex flex-col min-w-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1 ml-1">{key.replace(/_/g, " ")}</span>
                <div className="text-[12px] text-slate-700 font-semibold bg-slate-50/80 px-3 py-2 rounded-xl border border-slate-100 break-words leading-relaxed">
                  {String(value).replace(/<[^>]*>/g, "") || <span className="text-slate-300 italic">Empty</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Drawer
      isOpen={!!item}
      onClose={onClose}
      closeOnOutside={false}
      title="Activity Log Detail"
      description="System Audit Log"
      headerVariant="form"
      maxWidth="max-w-2xl"
      footer={
        <button
          onClick={onClose}
          className="text-sm font-medium px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
        >
          Close
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5 mb-6">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={12} className="text-slate-400" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</span>
            </div>
            <div className="text-[13px] text-slate-700 font-bold break-words px-1">
              {value ?? "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 mb-2">
        <div className="flex items-center gap-1.5 mb-2">
          <Info size={12} className="text-slate-400" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Description</span>
        </div>
        <div className="text-[14px] text-slate-800 font-semibold leading-relaxed">
          {item.description?.replace(/<[^>]*>/g, "") ?? "—"}
        </div>
      </div>

      {renderLogData()}
    </Drawer>
  );
}
