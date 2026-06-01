"use client";

import { X, ScrollText, User, Clock, Hash, Info, User2 } from "lucide-react";

export default function LogDetailModal({ item, onClose }) {
  if (!item) return null;

  const rows = [
    { icon: Hash,       label: "Log ID",    value: item.id },
    { icon: User,       label: "User",      value: item.user?.name ?? `User #${item.root_user_id}` },
    { icon: User2,       label: "Username",  value: item.user?.username ? `@${item.user.username}` : "—" },
    { icon: ScrollText, label: "Action",    value: item.action_type },
    { icon: Info,       label: "Description",    value: item.description },
    { icon: Clock,      label: "Timestamp", value: new Date(item.created_at).toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"}),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <ScrollText size={15} className="text-violet-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-800">Log Detail</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-md bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon size={13} className="text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
                <p className="text-sm text-slate-700 break-words">{value ?? "—"}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm font-medium px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}