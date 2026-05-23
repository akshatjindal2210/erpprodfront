import { X } from "lucide-react";

/** Shared detail dialog shell (masters and read-only previews). */
export default function GlobalDetailModal({ open, onClose, title, icon: Icon, children, size = "default" }) {
  if (!open) return null;

  const sizeClass = size === "wide" ? "max-w-2xl" : "max-w-lg";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-6 animate-in fade-in duration-200">
      <div
        className={`w-full ${sizeClass} max-h-[min(90vh,720px)] bg-white rounded-none shadow-2xl overflow-hidden flex flex-col border border-slate-300`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-detail-modal-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 text-indigo-600 min-w-0">
            {Icon && <Icon size={18} className="shrink-0" />}
            <h3 id="global-detail-modal-title" className="font-bold text-[11px] uppercase tracking-wider text-slate-700 truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 text-slate-400 hover:text-slate-700 transition-colors rounded-none"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 min-h-0">{children}</div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 rounded-none text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100 transition-colors shadow-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
