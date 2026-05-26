"use client";

import { useMemo } from "react";
import { getBoxStickerEntries } from "@/utils/boxTransactionStickerEntries";

export { getBoxStickerEntries };

export default function BoxStickerNosCell({ row }) {
  const entries = useMemo(() => getBoxStickerEntries(row), [row]);

  if (!entries.length) {
    return <span className="text-slate-400 text-[9px]">—</span>;
  }

  const looseCount = entries.filter((e) => e.is_loose).length;

  return (
    <div
      className="flex flex-wrap gap-x-1 gap-y-0.5 w-full min-w-0 content-start"
      title={ looseCount ? `${entries.length} sticker(s) · ${looseCount} loose` : `${entries.length} sticker(s)` }
    >
      {entries.map((e) => (
        <span
          key={e.box_no_uid}
          className={`inline-flex max-w-full shrink-0 font-mono text-[9px] leading-tight whitespace-nowrap rounded px-2 py-1 ${
            e.is_loose ? "font-semibold text-amber-800 bg-amber-50 ring-1 ring-inset ring-amber-300" : "text-slate-700 bg-slate-50 ring-1 ring-inset ring-slate-200"
          }`}
          title={e.is_loose ? `${e.box_no_uid} (loose)` : e.box_no_uid}
        >
          {e.box_no_uid}
        </span>
      ))}
    </div>
  );
}
