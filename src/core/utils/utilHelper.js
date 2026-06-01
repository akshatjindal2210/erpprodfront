export const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", }) : "—";

export function formatDateTime(date, options = {}) {
  if (!date) return "—";

  const defaultOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  return new Date(date).toLocaleString(
    "en-IN",
    { ...defaultOptions, ...options }
  );
}

export function getInitials(name = "") {
  if (!name) return "??";

  const words = name.trim().split(" ");

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0][0] + words[1][0]
  ).toUpperCase();
}

export const extractList = (res) => {
  const d = res.data;
  const raw = d?.data?.items ?? d?.data?.data ?? d?.data ?? d ?? [];
  return Array.isArray(raw) ? raw : [];
};

export const maskTaskId = (id) => {
  if (!id) return "";
  const pattern = `TSK${id}Z${id * 7}`; 
  return btoa(pattern).replace(/=/g, "");
};




/**
 * Allocates boxes in FIFO order; never returns more than `requestedQty`.
 *
 * @param {Array}  boxes         - Boxes from the API in FIFO order `[{ box_uid, qty, ... }, ...]`
 * @param {number} requestedQty - Quantity requested
 * @returns {{ selectedBoxes: Array, allocatedQty: number, remainingQty: number }}
 */
export function calculateFifoBoxes(boxes, requestedQty) {
  if (!boxes?.length || !requestedQty || requestedQty <= 0) {
    return { selectedBoxes: [], allocatedQty: 0, remainingQty: requestedQty };
  }

  const selectedBoxes = [];
  let allocated = 0;
  const needed = Number(requestedQty);

  for (const box of boxes) {
    if (allocated >= needed) break;

    const boxQty    = Number(box.qty);
    const remaining = needed - allocated;

    if (boxQty <= remaining) {
      selectedBoxes.push({ ...box });
      allocated += boxQty;
    } else {
      // Partial allocation: same box row, qty capped to what is still needed
      selectedBoxes.push({ ...box, qty: remaining, is_partial: true });
      allocated += remaining;
    }

    if (allocated >= needed) break;
  }

  return {
    selectedBoxes,
    allocatedQty:  allocated,
    remainingQty:  needed - allocated, // 0 if fully satisfied
  };
}