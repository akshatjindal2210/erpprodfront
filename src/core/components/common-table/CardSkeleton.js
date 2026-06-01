"use client";

const CardSkeleton = ({ count = 8, gridClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" }) => {
  return (
    <div className={`grid ${gridClass} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 animate-pulse"
        >
          {/* Header Skeleton: Avatar + Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-slate-100 rounded-full w-2/3" />
              <div className="h-3 bg-slate-100 rounded-full w-1/2" />
            </div>
          </div>

          {/* Body Skeleton: Details */}
          <div className="space-y-2 pt-2">
            <div className="h-3 bg-slate-100 rounded-full w-full" />
            <div className="h-3 bg-slate-100 rounded-full w-4/5" />
          </div>

          {/* Footer Skeleton: Button */}
          <div className="h-9 bg-slate-50 rounded-xl w-full mt-2" />
        </div>
      ))}
    </div>
  );
};

export default CardSkeleton;