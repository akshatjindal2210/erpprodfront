"use client";

import { useEffect, useRef, useState, startTransition } from "react";

/** @typedef {"quick" | "server"} ListPageFilterVariant */

const LABEL_BASE =
  "block text-[10px] font-bold uppercase ml-1 tracking-tight italic leading-snug whitespace-normal break-normal [overflow-wrap:normal] [word-break:normal]";

/** Shared label fallback */
export const LIST_PAGE_SEARCH_LABEL_CLASS = `${LABEL_BASE} text-slate-500`;

/** Quick filter — screen par loaded rows filter (warm accent) */
export const LIST_PAGE_FILTER_QUICK_LABEL_CLASS = `${LABEL_BASE} text-indigo-700`;

/** Server filter — date / dropdown / Search button (cool accent) */
export const LIST_PAGE_FILTER_SERVER_LABEL_CLASS = `${LABEL_BASE} text-slate-500`;

export const LIST_PAGE_FILTER_VALUE_CLASS = "list-page-filter-value";
export const LIST_PAGE_FILTER_PLACEHOLDER_CLASS = "list-page-filter-placeholder";

const BOX_BASE =
  "list-page-filter-control h-8 md:h-9 w-full min-w-0 rounded-none border px-2 md:px-3 transition-all focus-within:border-slate-500 focus:outline-none";

/** Subtle left stripe — quick (client) */
export const LIST_PAGE_FILTER_QUICK_BOX_CLASS = `${BOX_BASE} bg-indigo-50 border-indigo-300`;

/** Subtle left stripe — server (DB search) */
export const LIST_PAGE_FILTER_SERVER_BOX_CLASS = `${BOX_BASE} bg-white border-slate-300`;

/** @deprecated use listPageFilterBoxClass() */
export const LIST_PAGE_FILTER_BOX_CLASS = LIST_PAGE_FILTER_SERVER_BOX_CLASS;

export const LIST_PAGE_FILTER_FIELD_WRAP_CLASS = "flex min-w-0 flex-col gap-0.5 md:gap-1";

export const LIST_PAGE_FILTER_ACTION_BTN_CLASS =
  "flex h-8 md:h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-none px-2 md:px-3 text-[10px] md:text-[11px] font-bold uppercase tracking-wide transition-all active:scale-[0.98]";

/** @param {ListPageFilterVariant} [variant] */
export function listPageFilterLabelClass(variant = "quick") {
  return variant === "server" ? LIST_PAGE_FILTER_SERVER_LABEL_CLASS : LIST_PAGE_FILTER_QUICK_LABEL_CLASS;
}

/** @param {ListPageFilterVariant} [variant] */
export function listPageFilterBoxClass(variant = "quick") {
  return variant === "server" ? LIST_PAGE_FILTER_SERVER_BOX_CLASS : LIST_PAGE_FILTER_QUICK_BOX_CLASS;
}

/** @param {ListPageFilterVariant} [variant] */
export function listPageSearchInputClass(variant = "quick") {
  return [
    "w-full min-w-0",
    listPageFilterBoxClass(variant),
    LIST_PAGE_FILTER_VALUE_CLASS,
    "placeholder:text-slate-400 focus:outline-none",
  ].join(" ");
}

export const LIST_PAGE_SEARCH_INPUT_CLASS = listPageSearchInputClass("quick");

export const LIST_PAGE_SEARCH_CONTAINER_CLASS =
  "w-full min-w-0 max-w-[16rem] space-y-1";

export const LIST_PAGE_FILTER_SELECT_CLASS = [
  LIST_PAGE_FILTER_SERVER_BOX_CLASS,
  LIST_PAGE_FILTER_VALUE_CLASS,
  "cursor-pointer appearance-none outline-none pr-7 md:pr-8",
].join(" ");

export function listPageFilterDisplayTextClass(hasValue) {
  return hasValue ? LIST_PAGE_FILTER_VALUE_CLASS : LIST_PAGE_FILTER_PLACEHOLDER_CLASS;
}

const QUICK_SEARCH_WAIT_MS = 180;

export default function ListPageSearchField({
  label = "Search",
  placeholder = "Search...",
  value,
  onChange,
  onKeyDown,
  className = "",
  containerClassName = LIST_PAGE_SEARCH_CONTAINER_CLASS,
  inputClassName = "",
  disabled = false,
  /** `quick` = client filter; `server` = DB / Search apply */
  variant = "quick",
}) {
  const isQuick = variant === "quick";
  const [draft, setDraft] = useState(value ?? "");
  const focusedRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isQuick || focusedRef.current) return;
    setDraft(value ?? "");
  }, [value, isQuick]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const emit = (next, immediate = false) => {
    clearTimeout(timerRef.current);
    const send = () => startTransition(() => onChange?.(next));
    if (immediate) send();
    else timerRef.current = setTimeout(send, QUICK_SEARCH_WAIT_MS);
  };

  return (
    <div className={`${containerClassName} ${className}`.trim()}>
      <label className={listPageFilterLabelClass(variant)}>{label}</label>
      <div className="relative group">
        <input
          type="text"
          value={isQuick ? draft : (value ?? "")}
          onFocus={() => { focusedRef.current = true; }}
          onBlur={() => {
            focusedRef.current = false;
            if (!isQuick) return;
            emit(draft, true);
          }}
          onChange={(e) => {
            const next = e.target.value;
            if (!isQuick) {
              onChange?.(next);
              return;
            }
            setDraft(next);
            emit(next);
          }}
          onKeyDown={(e) => {
            if (isQuick && e.key === "Enter") emit(draft, true);
            onKeyDown?.(e);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`${listPageSearchInputClass(variant)} ${inputClassName}`.trim()}
        />
      </div>
    </div>
  );
}
