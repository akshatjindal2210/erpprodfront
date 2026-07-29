"use client";

import { useMemo } from "react";
import { getCoilStickerEntries } from "@/apps/rmstore/lib/utils/coilTransactionStickerEntries";
import { getCoilStickerChipClass } from "@/apps/rmstore/lib/utils/coilTransactionVisuals";

export { getCoilStickerEntries };

export default function CoilStickerNosCell({ row }) {
  const entries = useMemo(() => getCoilStickerEntries(row), [row]);

  if (!entries.length) {
    return <span className="text-slate-400 text-[9px]">—</span>;
  }

  return (
    <div
      className="flex flex-wrap gap-x-1 gap-y-0.5 w-full min-w-0 content-start"
      title={`${entries.length} sticker(s)`}
    >
      {entries.map((e) => (
        <span
          key={e.coil_no_uid}
          className={`inline-flex max-w-full shrink-0 font-mono text-[9px] leading-tight whitespace-nowrap rounded px-2 py-1 ${getCoilStickerChipClass()}`}
          title={e.coil_no_uid}
        >
          {e.coil_no_uid}
        </span>
      ))}
    </div>
  );
}
