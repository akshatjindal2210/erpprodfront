// components/task/dashboard/SectionHeader.jsx
export default function SectionHeader({ icon: Icon, color, title, badge }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={13} className={color} />
      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{title}</span>
      {badge && (
        <span className="ml-auto text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}