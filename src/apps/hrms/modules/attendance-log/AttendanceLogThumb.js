"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { fetchAttendanceLogImage, peekAttendanceLogImage } from "@/apps/hrms/lib/attendanceLogImage";

const BTN_TABLE =
  "block w-full aspect-square max-h-16 relative overflow-hidden border-0 bg-slate-100 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400";
const BTN_CARD =
  "block w-full h-full min-h-[11rem] relative overflow-hidden border-0 bg-slate-900 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400";

export default function AttendanceLogThumb({ row, onClick, variant = "table" }) {
  const ref = useRef(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(false);
  const isCard = variant === "card";

  useEffect(() => {
    setUrl("");
    setFail(false);
    setBusy(false);
    if (!row?.employee_code || !row?.event_timestamp) return undefined;

    const cached = peekAttendanceLogImage(row);
    if (cached?.displayUrl) {
      setUrl(cached.displayUrl);
      return undefined;
    }

    const load = () => {
      setBusy(true);
      fetchAttendanceLogImage(row)
        .then((r) => {
          if (r?.displayUrl) {
            setUrl(r.displayUrl);
            setFail(false);
          } else setFail(true);
        })
        .catch(() => setFail(true))
        .finally(() => setBusy(false));
    };

    if (isCard) {
      load();
      return undefined;
    }

    const el = ref.current;
    if (!el) return undefined;
    let dead = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (dead || !e?.isIntersecting) return;
        io.disconnect();
        load();
      },
      { root: null, rootMargin: "100px" }
    );
    io.observe(el);
    return () => {
      dead = true;
      io.disconnect();
    };
  }, [row?.id, row?.employee_code, row?.event_timestamp, row?.sub_event_type, isCard]);

  return (
    <button
      type="button"
      ref={ref}
      title="View image"
      className={isCard ? BTN_CARD : BTN_TABLE}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(row);
      }}
    >
      {busy && !url ? <span className="absolute inset-0 animate-pulse bg-slate-700" aria-hidden /> : null}
      {(!url || fail) && (
        <span className="flex h-full w-full items-center justify-center text-slate-400">
          <ImageOff size={isCard ? 22 : 14} />
        </span>
      )}
      {url && !fail ? (
        <img
          src={url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
          onError={() => setFail(true)}
        />
      ) : null}
    </button>
  );
}
