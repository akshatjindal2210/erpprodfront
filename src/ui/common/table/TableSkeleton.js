"use client";

const TableSkeleton = ({ rows = 5, cols = 6, showSelection = true, selectionColPx = 36 }) => {
  const selStyle = { width: selectionColPx, minWidth: selectionColPx, maxWidth: selectionColPx };
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100 last:border-0">
          {showSelection && (
            <td className="sticky left-0 bg-white border-r border-slate-200 py-3.5 px-0 text-center align-middle box-border" style={selStyle}>
              <div className="h-3.5 w-3.5 bg-slate-100 rounded animate-pulse mx-auto" />
            </td>
          )}

          {/* Data Columns Skeleton */}
          {Array.from({ length: cols }).map((__, j) => (
            <td 
              key={j} 
              className="px-3 py-3.5 border-r border-slate-100 last:border-r-0"
            >
              <div 
                className="h-3.5 bg-slate-100 rounded-full animate-pulse"
                style={{ width: `${60 + (i * j % 5) * 10}%`, maxWidth: '120px' }} 
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default TableSkeleton;