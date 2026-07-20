export default function StatCard({ label, value, icon: Icon, iconBg, iconText, borderColor, barColor }) {
  return (
    <div className={`bg-white border ${borderColor} rounded-none px-2 py-1.5 md:px-2.5 md:py-2 flex items-center gap-2 shadow-none overflow-hidden relative min-w-0`}>
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: barColor }}
      />
      <div className={`w-7 h-7 md:w-8 md:h-8 rounded-md ${iconBg} flex items-center justify-center flex-shrink-0 ml-1`}>
        <Icon size={13} className={`md:hidden ${iconText}`} />
        <Icon size={15} className={`hidden md:block ${iconText}`} />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-sm md:text-base xl:text-lg font-bold text-slate-800 leading-tight truncate tabular-nums">{value}</p>
        <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-snug truncate">{label}</p>
      </div>
    </div>
  );
}
