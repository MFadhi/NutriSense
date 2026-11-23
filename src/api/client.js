/**
 * src/api/client.js — Base fetch wrapper for the NutriLens API.
 *
 * Features:
 *  - Base URL from VITE_API_URL env var (defaults to localhost:5000/api/v1)
 *  - Attaches Authorization header from in-memory access token
 *  - Normalises error shape from {"error":{"code","message","details"}}
 *  - 401 → tries one refresh using the refresh token, then signs out
 *  - 8-second request timeout via AbortController
 *  - Network errors surfaced as {code: 'network_error', message: '...'}
 */

import { getAccessToken, getRefreshToken, setAccessToken, clearTokens } from '../auth/tokenStore';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';
const TIMEOUT_MS = 8000;

/** Dispatched globally so AuthContext can react and sign the user out. */
function dispatchSignOut() {
  window.dispatchEvent(new CustomEvent('nutrilens:signout'));
}

/** One attempt to exchange the refresh token for a new access token. */
async function tryRefresh() {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rt}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.access_token) {
      setAccessToken(data.access_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Core request function.
 * @param {string} path   - e.g. '/foods?q=paneer'
 * @param {object} opts   - standard fetch options (method, body, headers …)
 * @param {boolean} retry - internal flag to prevent infinite refresh loop
 */
export async function request(path, opts = {}, retry = true) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw { code: 'timeout', message: 'Request timed out. Please try again.' };
    }
    throw { code: 'network_error', message: 'Network error — check your connection.' };
  } finally {
    clearTimeout(timer);
  }

  // 401 → try refresh once
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request(path, opts, false); // retry with new token
    }
    clearTokens();
    dispatchSignOut();
    throw { code: 'unauthorized', message: 'Session expired. Please sign in again.' };
  }

  // Parse JSON (even for errors)
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    // Normalise backend error envelope
    const err = data?.error || {};
    throw {
      code: err.code || `http_${res.status}`,
      message: err.message || `Request failed (${res.status})`,
      details: err.details || null,
      status: res.status,
    };
  }

  return data;
}

export const get  = (path, opts) => request(path, { method: 'GET', ...opts });
export const post = (path, body, opts) => request(path, { method: 'POST',  body: JSON.stringify(body), ...opts });
export const put  = (path, body, opts) => request(path, { method: 'PUT',   body: JSON.stringify(body), ...opts });
export const patch = (path, body, opts) => request(path, { method: 'PATCH', body: JSON.stringify(body), ...opts });
export const del  = (path, opts) => request(path, { method: 'DELETE', ...opts });
