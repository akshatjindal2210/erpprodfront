// components/task/dashboard/StatCard.jsx
import Sk from "./Skeleton";

export default function StatCard({ label, value, sub, icon: Icon, iconBg, iconText, border, accent, loading }) {
  if (loading) return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2.5">
      <Sk className="w-9 h-9 rounded-xl" />
      <Sk className="h-6 w-14" />
      <Sk className="h-3 w-20" />
    </div>
  );
  return (
    <div className={`bg-white border ${border} rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon size={16} className={iconText} />
        </div>
        {accent !== undefined && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
            +{accent}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-800 leading-none mb-1">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}