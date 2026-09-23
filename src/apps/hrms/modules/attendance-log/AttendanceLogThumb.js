"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { fetchAttendanceLogImage, peekAttendanceLogImage, subscribeAttendanceLogImageCache } from "@/apps/hrms/lib/attendanceLogImage";

const BTN_TABLE =
  "block w-full aspect-square max-h-16 relative overflow-hidden border-0 bg-slate-100 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400";
const BTN_CARD =
  "block w-full h-full min-h-[11rem] relative overflow-hidden border-0 bg-slate-900 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400";

function listScrollRoot(el) {
  return el?.closest?.("[data-list-scroll-root='true']") || null;
}

function applyCached(cached, setters) {
  if (!cached) return false;
  if (cached.displayUrl) {
    setters.setUrl(cached.displayUrl);
    setters.setProxy(cached.proxyUrl || "");
    setters.setSource(cached.sourceUrl || "");
    setters.setFail(false);
    setters.setBusy(false);
    return true;
  }
  if (cached.notFound) {
    setters.setUrl("");
    setters.setProxy(cached.proxyUrl || "");
    setters.setSource(cached.sourceUrl || "");
    setters.setFail(true);
    setters.setBusy(false);
    return true;
  }
  return false;
}

export default function AttendanceLogThumb({ row, onClick, variant = "table" }) {
  const ref = useRef(null);
  const startedRef = useRef(false);
  const cached0 = peekAttendanceLogImage(row);
  const [url, setUrl] = useState(cached0?.displayUrl || "");
  const [proxy, setProxy] = useState(cached0?.proxyUrl || "");
  const [source, setSource] = useState(cached0?.sourceUrl || "");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(Boolean(cached0?.notFound));
  const isCard = variant === "card";
  const rowId = row?.id;
  const emp = row?.employee_code;
  const ts = row?.event_timestamp;
  const sub = row?.sub_event_type;

  const setters = { setUrl, setProxy, setSource, setFail, setBusy };

  const syncFromCache = useCallback(() => {
    applyCached(peekAttendanceLogImage(row), setters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, emp, ts, sub]);

  useEffect(() => subscribeAttendanceLogImageCache(syncFromCache), [syncFromCache]);

  useEffect(() => {
    startedRef.current = false;

    if (!emp || !ts) {
      setUrl("");
      setProxy("");
      setSource("");
      setFail(false);
      setBusy(false);
      return undefined;
    }

    if (applyCached(peekAttendanceLogImage(row), setters)) return undefined;

    setUrl("");
    setProxy("");
    setSource("");
    setFail(false);
    setBusy(false);

    const el = ref.current;
    if (!el) return undefined;

    let dead = false;

    const load = () => {
      if (dead || startedRef.current) return;
      startedRef.current = true;
      setBusy(true);
      fetchAttendanceLogImage(row)
        .then((r) => {
          if (dead) return;
          if (r?.displayUrl) {
            setUrl(r.displayUrl);
            setProxy(r.proxyUrl || "");
            setSource(r.sourceUrl || "");
            setFail(false);
          } else {
            setFail(true);
          }
        })
        .catch(() => {
          if (!dead) {
            startedRef.current = false;
            setFail(true);
          }
        })
        .finally(() => {
          if (!dead) setBusy(false);
        });
    };

    const root = listScrollRoot(el);
    const io = new IntersectionObserver(
      ([e]) => {
        if (dead || !e?.isIntersecting) return;
        load();
      },
      { root, rootMargin: "80px 0px", threshold: 0 },
    );
    io.observe(el);

    // Already on screen (common after Search) — load without waiting for another scroll event
    requestAnimationFrame(() => {
      if (dead || startedRef.current) return;
      const r = el.getBoundingClientRect();
      const rootEl = root;
      if (rootEl) {
        const rr = rootEl.getBoundingClientRect();
        const visible =
          r.bottom > rr.top - 80 && r.top < rr.bottom + 80 && r.right > rr.left && r.left < rr.right;
        if (visible) load();
      } else if (r.top < window.innerHeight + 80 && r.bottom > -80) {
        load();
      }
    });

    return () => {
      dead = true;
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, emp, ts, sub, isCard]);

  const onImgError = () => {
    if (proxy && url !== proxy) {
      setUrl(proxy);
      return;
    }
    if (source && url !== source) {
      setUrl(source);
      return;
    }
    setFail(true);
  };

  return (
    <button
      type="button"
      ref={ref}
      title={onClick ? "View image" : undefined}
      tabIndex={onClick ? 0 : -1}
      className={`${isCard ? BTN_CARD : BTN_TABLE}${onClick ? "" : " pointer-events-none"}`}
      onClick={(e) => {
        if (!onClick) return;
        e.stopPropagation();
        onClick(row);
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
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
          onError={onImgError}
        />
      ) : null}
    </button>
  );
}
