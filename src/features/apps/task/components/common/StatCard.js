export default function StatCard({ label, value, icon: Icon, iconBg, iconText, borderColor, barColor }) {
  return (
    <div className={`bg-white border ${borderColor} rounded-xl p-2 md:p-3 xl:p-4 flex items-center gap-2 shadow-sm overflow-hidden relative min-w-0`}>

      {/* Left color bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 md:w-1.5 rounded-l-xl"
        style={{ backgroundColor: barColor }}
      />

      {/* Icon */}
      <div className={`w-7 h-7 md:w-9 md:h-9 xl:w-10 xl:h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 ml-1.5 md:ml-2`}>
        <Icon size={12} className={`md:hidden ${iconText}`} />
        <Icon size={15} className={`hidden md:block xl:hidden ${iconText}`} />
        <Icon size={18} className={`hidden xl:block ${iconText}`} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-base md:text-lg xl:text-2xl font-bold text-slate-800 leading-tight truncate">{value}</p>
        <p className="text-[9px] md:text-[10px] xl:text-xs text-slate-400 font-medium leading-snug truncate">{label}</p>
      </div>
    </div>
  );
}

// export default function StatCard({ label, value, icon: Icon, iconBg, iconText, borderColor, barColor }) {
//   return (
//     <div className={`bg-white border ${borderColor} rounded-xl p-4 flex items-center gap-4 shadow-sm overflow-hidden relative`}>

//       {/* Left color bar */}
//       <div
//         className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl"
//         style={{ backgroundColor: barColor }}
//       />

//       {/* Icon */}
//       <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 ml-2`}>
//         <Icon size={18} className={iconText} />
//       </div>

//       {/* Text */}
//       <div>
//         <p className="text-2xl font-bold text-slate-800">{value}</p>
//         <p className="text-xs text-slate-400 font-medium">{label}</p>
//       </div>
//     </div>
//   );
// }

// export default function StatCard({ label, value, icon: Icon, iconBg, iconText, borderColor }) {
//   return (
//     <div className={`bg-white border ${borderColor} rounded-xl p-4 flex items-center gap-4 shadow-sm`}>
//       <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
//         <Icon size={18} className={iconText} />
//       </div>
//       <div>
//         <p className="text-2xl font-bold text-slate-800">{value}</p>
//         <p className="text-xs text-slate-400 font-medium">{label}</p>
//       </div>
//     </div>
//   );
// }

// export default function StatCard({ label, value, icon: Icon, iconBg, iconText, borderColor, barColor }) {
//   return (
//     <div className="bg-white rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden relative">

//       {/* Inner left color bar — direct hex color, no Tailwind derivation */}
//       <div
//         className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
//         style={{ backgroundColor: barColor }}
//       />

//       {/* Subtle tint wash */}
//       <div className={`absolute inset-0 opacity-[0.04] ${iconBg}`} />

//       {/* Icon */}
//       <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 shadow-sm ml-2 relative`}>
//         <Icon size={20} className={iconText} />
//       </div>

//       {/* Text */}
//       <div className="relative">
//         <p className="text-2xl font-extrabold text-slate-800 leading-none tracking-tight">{value}</p>
//         <p className="text-[11px] text-slate-500 font-semibold mt-1 uppercase tracking-wide">{label}</p>
//       </div>
//     </div>
//   );
// }