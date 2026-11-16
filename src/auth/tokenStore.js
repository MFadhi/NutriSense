/**
 * tokenStore.js — Single source of truth for auth tokens.
 *
 * Access token: held in module-level memory only.
 *   - Lost on page reload (intentional — prevents XSS via localStorage).
 *   - Re-acquired via refresh token on mount.
 *
 * Refresh token: stored in sessionStorage under key 'nl_rt'.
 *   - Survives page reload within the same browser tab.
 *   - Cleared automatically when the tab/window is closed.
 *   - Trade-off: sessionStorage is still readable by JS (XSS risk).
 *     In Phase 7 this should move to an httpOnly cookie set by the backend
 *     so the token is never accessible to JavaScript at all.
 */

let _accessToken = null;

export const getAccessToken = () => _accessToken;
export const setAccessToken = (t) => { _accessToken = t; };

export const getRefreshToken = () => sessionStorage.getItem('nl_rt');
export const setRefreshToken = (t) => {
  if (t) {
    sessionStorage.setItem('nl_rt', t);
  } else {
    sessionStorage.removeItem('nl_rt');
  }
};

export const clearTokens = () => {
  _accessToken = null;
  sessionStorage.removeItem('nl_rt');
};

export const hasSession = () => Boolean(sessionStorage.getItem('nl_rt'));
