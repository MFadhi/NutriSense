/**
 * NutriSense API Service
 * Interacts with the Flask backend (/api/v1) for authentication, food logs, and user profile.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

export async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Invalid email or password.");
  }
  return data; // { access_token, refresh_token, user }
}

export async function apiRegister(email, password, name, diet) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, diet }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Registration failed.");
  }
  return data; // { message, user }
}

export async function apiGetMe(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Failed to fetch user profile.");
  }
  return data; // { id, email, profile }
}

export async function apiRefreshToken(refreshToken) {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${refreshToken}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Session expired. Please log in again.");
  }
  return data; // { access_token }
}
