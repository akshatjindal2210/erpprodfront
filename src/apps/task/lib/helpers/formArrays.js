/** Never null — safe for `.length`, `.map`, `.find`. */
export function asArray(val) {
  return Array.isArray(val) ? val : [];
}

/** API / FormData JSON field → array (recurrence, sub_users, etc.). */
export function parseArr(val) {
  if (val == null || val === "") return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      return asArray(JSON.parse(val));
    } catch {
      return [];
    }
  }
  return [];
}
