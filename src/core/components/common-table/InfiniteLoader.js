"use client";
import React, { useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

export default function InfiniteLoader({ loading, hasMore, onLoadMore, totalItems, currentCount }) {
  const observerRef = useRef();

  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    }, { 
      threshold: 0.1, 
      rootMargin: "100px"
    });

    if (node) observerRef.current.observe(node);
  }, [loading, hasMore, onLoadMore]);

  return (
    <div className="w-full bg-slate-50 border-t border-slate-100">
      <div ref={lastElementRef} className="h-4" />
      
      <div className="px-5 py-4 flex flex-col items-center justify-center min-h-[60px]">
        {loading ? (
          <div className="flex items-center gap-2 text-indigo-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Loading...</span>
          </div>
        ) : (
          <div className="w-full flex justify-between items-center px-2">
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-black text-slate-400 uppercase">Progress</span>
              <span className="text-xs font-bold text-slate-600">{currentCount} / {totalItems}</span>
            </div>
            {!hasMore && totalItems > 0 && (
              <span className="text-[10px] font-bold text-slate-400 uppercase italic bg-slate-200/50 px-2 py-1 rounded">
                End of list
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}