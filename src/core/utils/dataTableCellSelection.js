/** Excel-style column letters: 0 → A, 25 → Z, 26 → AA */
export function excelColumnLabel(colIndex) {
  let n = colIndex + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function cellCoordKey(rowIndex, colIndex) {
  return `${rowIndex},${colIndex}`;
}

export function parseCellCoordKey(key) {
  const [r, c] = String(key).split(",").map(Number);
  return { row: r, col: c };
}

export function cellAddressLabel(rowIndex, colIndex) {
  return `${excelColumnLabel(colIndex)}${rowIndex + 1}`;
}

/** Inclusive rectangular range → Set of "row,col" keys */
export function buildCellRangeSet(r1, c1, r2, c2) {
  const minR = Math.min(r1, r2);
  const maxR = Math.max(r1, r2);
  const minC = Math.min(c1, c2);
  const maxC = Math.max(c1, c2);
  const set = new Set();
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      set.add(cellCoordKey(r, c));
    }
  }
  return set;
}

export function isCellInSet(set, rowIndex, colIndex) {
  return set?.has(cellCoordKey(rowIndex, colIndex));
}

export function rowHasCellInSet(set, rowIndex, colCount) {
  if (!set?.size) return false;
  for (let c = 0; c < colCount; c++) {
    if (set.has(cellCoordKey(rowIndex, c))) return true;
  }
  return false;
}

export function getCellPlainText(item, header, rowIndex) {
  if (!header || !item) return "";
  const [, key, renderFn, options] = header;
  const value = item[key];
  if (options?.copyValue && typeof options.copyValue === "function") {
    const custom = options.copyValue(item, value, rowIndex);
    if (custom != null && String(custom).trim() !== "") return String(custom);
    if (custom === "" || custom === 0) return String(custom);
  }
  if (renderFn) {
    const rendered = renderFn(value, item, rowIndex);
    if (rendered == null || rendered === false) return "";
    if (typeof rendered === "string" || typeof rendered === "number") {
      return String(rendered);
    }
    if (typeof rendered === "boolean") return rendered ? "true" : "false";
    return String(value ?? "");
  }
  if (value === undefined || value === null) return "";
  return String(value);
}

/** TSV for clipboard (Excel / Sheets friendly) */
export function buildClipboardFromCellSet(data, headers, cellSet) {
  if (!cellSet?.size) return "";
  const coords = [...cellSet].map(parseCellCoordKey);
  const minR = Math.min(...coords.map((x) => x.row));
  const maxR = Math.max(...coords.map((x) => x.row));
  const minC = Math.min(...coords.map((x) => x.col));
  const maxC = Math.max(...coords.map((x) => x.col));
  const lines = [];
  for (let r = minR; r <= maxR; r++) {
    const rowParts = [];
    for (let c = minC; c <= maxC; c++) {
      if (!cellSet.has(cellCoordKey(r, c))) {
        rowParts.push("");
        continue;
      }
      const item = data[r];
      const header = headers[c];
      rowParts.push(getCellPlainText(item, header, r));
    }
    lines.push(rowParts.join("\t"));
  }
  return lines.join("\n");
}

export async function copyTextToClipboard(text) {
  const t = String(text ?? "");
  if (!t) return false;
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch {
      /* fallback */
    }
  }
  try {
    const textArea = document.createElement("textarea");
    textArea.value = t;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textArea);
    return ok;
  } catch {
    return false;
  }
}
