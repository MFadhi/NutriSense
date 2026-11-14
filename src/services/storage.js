/**
 * LocalStorage service layer for NutriSense.
 */
export const LS_PREFIX = "nutrisense_";

export function resetAppData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_PREFIX) || k.startsWith("nutrilens_"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
