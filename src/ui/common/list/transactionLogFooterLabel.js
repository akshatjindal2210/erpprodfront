/** Shared footer count text for IMS box / RM coil transaction log pages. */

function plural(n, one, many) {
  return n === 1 ? one : many;
}

/**
 * @param {object} p
 * @param {boolean} p.isUniqueView
 * @param {boolean} p.hasActiveSearch
 * @param {boolean} p.isUniquePerLog
 * @param {number} p.shown
 * @param {number} p.total
 * @param {number} p.loadedCount — allRows.length (summary search)
 * @param {number} p.uniqueSourceLogCount — distinct source logs in unique view
 * @param {boolean} p.isJourneyMode
 * @param {string} p.entitySingular — e.g. box, coil
 * @param {string} p.entityPlural — e.g. boxes, coils
 */
export function buildTransactionLogFooterLabel({
  isUniqueView,
  hasActiveSearch,
  isUniquePerLog,
  shown,
  total,
  loadedCount,
  uniqueSourceLogCount,
  isJourneyMode,
  entitySingular,
  entityPlural,
}) {
  const s = shown;
  const t = total;

  if (isUniqueView) {
    if (hasActiveSearch) {
      if (isUniquePerLog) {
        return `Unique · ${s} of ${t} ${plural(t, "log row", "log rows")} matching search`;
      }
      return `Unique · ${s} of ${t} ${entityPlural} from ${uniqueSourceLogCount} ${plural(uniqueSourceLogCount, "log", "logs")} matching search`;
    }
    return `Unique · ${s} of ${t} ${entitySingular} ${plural(t, "row", "rows")} from ${loadedCount} ${plural(loadedCount, "log", "logs")}`;
  }

  if (hasActiveSearch) {
    return `Summary · ${s} of ${t} ${plural(t, "match", "matches")} (${loadedCount} loaded)`;
  }
  if (isJourneyMode) {
    return `Summary · ${s} of ${t} journey matches (all DB)`;
  }
  return `Summary · ${s} of ${t} in date range`;
}

export function transactionLogSelectionLabel(row) {
  const id = row?.id ?? "—";
  const type = row?.transaction_type ? String(row.transaction_type).replace(/_/g, " ") : "—";
  return `Selected: Log #${id} · ${type}`;
}
