import { Carrot, Apple, Wheat, Milk, Package } from "lucide-react";

export const PANTRY_CATEGORIES = ["Vegetables", "Fruits", "Grains", "Dairy", "Others"];

export const CATEGORY_META = {
  Vegetables: { icon: Carrot, color: "#4caf50", bg: "#e8f5d8" },
  Fruits: { icon: Apple, color: "#fb8c00", bg: "#fff4e3" },
  Grains: { icon: Wheat, color: "#a1884f", bg: "#f6efdf" },
  Dairy: { icon: Milk, color: "#26a69a", bg: "#e3f4f2" },
  Others: { icon: Package, color: "#78909c", bg: "#eceff1" },
};

/** Starter pantry — qty + unit drive the stepper controls. */
export const DEFAULT_PANTRY = [
  { id: "p1", name: "Tomato", category: "Vegetables", qty: 6, unit: "pcs", tags: ["tomato"] },
  { id: "p2", name: "Onion", category: "Vegetables", qty: 5, unit: "pcs", tags: ["onion"] },
  { id: "p3", name: "Carrot", category: "Vegetables", qty: 4, unit: "pcs", tags: ["carrot"] },
  { id: "p4", name: "Spinach", category: "Vegetables", qty: 1, unit: "bunch", tags: ["spinach", "leafy"] },
  { id: "p5", name: "Cucumber", category: "Vegetables", qty: 2, unit: "pcs", tags: ["cucumber"] },
  { id: "p6", name: "Green Peas", category: "Vegetables", qty: 200, unit: "g", tags: ["peas"] },
  { id: "p7", name: "Banana", category: "Fruits", qty: 6, unit: "pcs", tags: ["banana"] },
  { id: "p8", name: "Apple", category: "Fruits", qty: 3, unit: "pcs", tags: ["apple"] },
  { id: "p9", name: "Strawberries", category: "Fruits", qty: 250, unit: "g", tags: ["strawberries", "strawberry"] },
  { id: "p10", name: "Rolled Oats", category: "Grains", qty: 500, unit: "g", tags: ["oats"] },
  { id: "p11", name: "Basmati Rice", category: "Grains", qty: 1, unit: "kg", tags: ["rice", "basmati"] },
  { id: "p12", name: "Whole Wheat Bread", category: "Grains", qty: 1, unit: "pack", tags: ["bread"] },
  { id: "p13", name: "Milk", category: "Dairy", qty: 1, unit: "L", tags: ["milk"] },
  { id: "p14", name: "Greek Yogurt", category: "Dairy", qty: 500, unit: "g", tags: ["yogurt", "curd"] },
  { id: "p15", name: "Paneer", category: "Dairy", qty: 200, unit: "g", tags: ["paneer"] },
  { id: "p16", name: "Eggs", category: "Others", qty: 6, unit: "pcs", tags: ["eggs", "egg"] },
  { id: "p17", name: "Honey", category: "Others", qty: 1, unit: "jar", tags: ["honey"] },
  { id: "p18", name: "Almonds", category: "Others", qty: 100, unit: "g", tags: ["almonds", "nuts"] },
  { id: "p19", name: "Olive Oil", category: "Others", qty: 250, unit: "ml", tags: ["olive oil", "oil"] },
  { id: "p20", name: "Chicken Breast", category: "Others", qty: 400, unit: "g", tags: ["chicken"] },
];
