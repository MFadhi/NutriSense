import { useEffect, useState } from "react";

/** React state that persists to localStorage (frontend-only demo persistence). */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable — ignore in demo */
    }
  }, [key, value]);

  return [value, setValue];
}
