/** Pipe-separated list meta (packing, item codes, qty) shown comma-separated in table and cards. */
export function splitPipeMeta(value) {
  if (value == null || value === "") return [];
  return String(value)
    .split(/\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function renderPipeMetaCell(value, className = "text-[10px] leading-tight", { full = false } = {}) {
  const parts = splitPipeMeta(value);
  if (!parts.length) return <span className="text-slate-400">—</span>;
  const text = parts.join(", ");
  return (
    <span
      className={`block ${full ? "whitespace-normal break-words" : "truncate"} ${className}`}
      title={full ? undefined : text}
    >
      {text}
    </span>
  );
}

/** Table + card render pair — card shows full comma-separated meta without truncation. */
export function pipeMetaRenderers(className) {
  return {
    table: (v) => renderPipeMetaCell(v, className),
    card: (v) => renderPipeMetaCell(v, className, { full: true }),
  };
}
