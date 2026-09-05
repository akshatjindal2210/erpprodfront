const ENCODE_FACTOR = 7919;
const ENCODE_OFFSET = 73459;

export function buildTaskDetailUrl(taskId, { report = false } = {}) {
  const numericId = Number(taskId);
  if (!Number.isFinite(numericId)) {
    return `/task/dashboard/tasks/${taskId}${report ? "?report=true" : ""}`;
  }

  const obfuscated = numericId * ENCODE_FACTOR + ENCODE_OFFSET;
  const token = obfuscated.toString(36);

  return `/task/dashboard/tasks/${token}${report ? "?report=true" : ""}`;
}

export function resolveTaskId(routeId) {
  if (!routeId) return null;
  const text = String(routeId);
  if (/^\d+$/.test(text)) return Number(text);

  const parsed = parseInt(text, 36);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return null;

  const raw = parsed - ENCODE_OFFSET;
  if (raw <= 0 || raw % ENCODE_FACTOR !== 0) return null;

  const taskId = raw / ENCODE_FACTOR;
  if (!Number.isFinite(taskId) || taskId <= 0) return null;
  return taskId;
}

export function isValidTaskRouteId(routeId) {
  if (!routeId) return false;
  return resolveTaskId(routeId) !== null;
}

export function openTaskOnPhone(row, navigate) {
  if (navigate && row?.task_id && typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) navigate(row);
}
