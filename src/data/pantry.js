import { Carrot, Apple, Wheat, Milk, Package } from "lucide-react";

export const PANTRY_CATEGORIES = ["Vegetables", "Fruits", "Grains", "Dairy", "Others"];

export const CATEGORY_META = {
  Vegetables: { icon: Carrot, color: "#4caf50", bg: "#e8f5d8" },
  Fruits: { icon: Apple, color: "#fb8c00", bg: "#fff4e3" },
  Grains: { icon: Wheat, color: "#a1884f", bg: "#f6efdf" },
  Dairy: { icon: Milk, color: "#26a69a", bg: "#e3f4f2" },
  Others: { icon: Package, color: "#78909c", bg: "#eceff1" },
};

/** Empty pantry on clean start */
export const DEFAULT_PANTRY = [];
