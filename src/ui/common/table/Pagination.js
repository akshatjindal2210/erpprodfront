import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100,];

export default function Pagination({ page, totalPages, pageSize, totalItems, onPageChange, onPageSizeChange }) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce((acc, n, idx, arr) => {
      if (idx > 0 && n - arr[idx - 1] > 1) acc.push("…");
      acc.push(n);
      return acc;
    }, []);

  return (
    <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
      
      {/* Left: count + rows per page */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">
          Showing {start}–{end} of {totalItems}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 outline-none focus:border-indigo-400 transition-all"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: page buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-200 transition-all"
        >
          «
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-200 transition-all"
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-2 text-slate-400 text-xs">
              …
            </span>
          ) : (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`w-8 h-8 text-xs rounded-lg transition-all ${page === n ? "bg-indigo-600 text-white font-semibold shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"}`}
            >
              {n}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-200 transition-all"
        >
          <ChevronRight size={15} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-200 transition-all"
        >
          »
        </button>
      </div>
    </div>
  );
}
