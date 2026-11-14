/**
 * LocalStorage service layer.
 * Keeps the data-access shape ready to be swapped for a Python Flask + MySQL
 * backend later — pages never touch localStorage directly.
 */
export const LS_PREFIX = "nutrilens_";

export function resetDemoData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
