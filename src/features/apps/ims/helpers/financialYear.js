/**
 * Helper utilities for managing Financial Year in the session.
 */

const FY_ID_KEY = "selectedFyId";
const FY_NAME_KEY = "selectedFyName";

/**
 * Get the currently selected Financial Year from localStorage.
 */
export function getSelectedFinancialYear() {
  if (typeof window === "undefined") return { id: null, name: null };
  return {
    id: localStorage.getItem(FY_ID_KEY),
    name: localStorage.getItem(FY_NAME_KEY)
  };
}

/**
 * Save the selected Financial Year to localStorage.
 */
export function setSelectedFinancialYear(id, name) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(FY_ID_KEY, String(id));
  else localStorage.removeItem(FY_ID_KEY);
  
  if (name) localStorage.setItem(FY_NAME_KEY, String(name));
  else localStorage.removeItem(FY_NAME_KEY);
}

/**
 * Clear the selected Financial Year from localStorage.
 */
export function clearSelectedFinancialYear() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FY_ID_KEY);
  localStorage.removeItem(FY_NAME_KEY);
}
