"use client";

import { useMemo } from "react";
import { getBoxStickerEntries } from "@/features/apps/ims/utils/boxTransactionStickerEntries";
import { getBoxKindStickerChipClass } from "@/features/apps/ims/utils/boxTransactionVisuals";

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
          className={`inline-flex max-w-full shrink-0 font-mono text-[9px] leading-tight whitespace-nowrap rounded px-2 py-1 ${getBoxKindStickerChipClass(e)}`}
          title={e.is_loose ? `${e.box_no_uid} (loose)` : e.box_no_uid}
        >
          {e.box_no_uid}
        </span>
      ))}
    </div>
  );
}

