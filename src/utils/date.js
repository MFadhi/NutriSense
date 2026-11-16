/**
 * src/utils/date.js — Date helpers that always use the user's LOCAL calendar day.
 *
 * IMPORTANT: Never use toISOString() for log_date — it converts to UTC, which
 * can silently shift the date for users in UTC+5:30 (India) after 18:30 local time.
 */

/** Returns today as "YYYY-MM-DD" in the user's local timezone. */
export function localToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns a Date object as "YYYY-MM-DD" in local timezone. */
export function toLocalDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns an ISO 8601 datetime string in UTC, e.g. for logged_at. */
export function nowUtcIso() {
  return new Date().toISOString();
}
