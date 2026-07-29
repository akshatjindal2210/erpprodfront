// components/task/dashboard/Ring.jsx
export default function Ring({ value, max, color, size = 56, stroke = 5, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          style={{ transition: "stroke-dashoffset 0.7s ease" }} />
      </svg>
      <div className="text-center -mt-1">
        <div className="text-sm font-bold text-slate-700">{value}</div>
        <div className="text-[10px] text-slate-400 leading-tight">{label}</div>
      </div>
    </div>
  );
}