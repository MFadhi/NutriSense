import { get, post, patch, del } from "./client";

// Pantry Endpoints
export const getPantryItems = (params = {}) => {
  const q = new URLSearchParams();
  if (params.category && params.category !== "All") q.set("category", params.category);
  if (params.search) q.set("search", params.search);
  if (params.sort) q.set("sort", params.sort);
  const qs = q.toString();
  return get(`/pantry${qs ? `?${qs}` : ""}`);
};

export const getPantryDashboard = () => get("/pantry/dashboard");

export const addPantryItem = (payload) => post("/pantry", payload);

export const updatePantryItem = (itemId, payload) => patch(`/pantry/${itemId}`, payload);

export const consumePantryItem = (itemId, amount = null) =>
  post(`/pantry/${itemId}/consume`, amount !== null ? { amount } : {});

export const deletePantryItem = (itemId) => del(`/pantry/${itemId}`);

// Grocery Endpoints
export const getGroceryItems = () => get("/grocery");

export const addGroceryItem = (payload) => post("/grocery", payload);

export const addGroceryBatch = (items, source = "Meal Plan") =>
  post("/grocery/batch", { items, source });

export const updateGroceryItem = (itemId, payload) => patch(`/grocery/${itemId}`, payload);

export const deleteGroceryItem = (itemId) => del(`/grocery/${itemId}`);

export const clearPurchasedGrocery = () => del("/grocery/purchased");

// Automatic Grocery-to-Pantry Synchronization
export const purchaseAndSyncToPantry = (itemId, payload) =>
  post(`/grocery/${itemId}/purchase`, payload);

export const unpurchaseGroceryItem = (itemId) => post(`/grocery/${itemId}/unpurchase`, {});

export const correctPurchaseQuantity = (itemId, purchasedQuantity) =>
  patch(`/grocery/${itemId}/purchase-correction`, { purchased_quantity: purchasedQuantity });
