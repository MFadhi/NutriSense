import { IMAGES } from "./foods";

/** Initial user profile */
export const DEFAULT_PROFILE = {
  name: "Guest",
  email: "",
  age: 25,
  height: 170, // cm
  weight: 65, // kg
  activity: "Moderately active",
  avatar: IMAGES.avatar,
  diet: ["Vegetarian"],
  goals: ["Balanced nutrition", "Better energy"],
};

/** Default daily nutrition targets. */
export const DEFAULT_TARGETS = {
  calories: 2000,
  protein: 100, // g
  carbs: 250, // g
  fat: 65, // g
  water: 2500, // ml
};

export const DEFAULT_PREFS = {
  mealReminders: true,
  hydrationAlerts: true,
  weatherUpdates: true,
  weeklyReport: false,
  newRecipes: true,
};

/** Fresh, empty diary — no pre-logged demo meals */
export const DEFAULT_DIARY = {
  breakfast: [],
  lunch: [],
  snacks: [],
  dinner: [],
};

/** Fresh empty notifications list */
export const DEFAULT_NOTIFICATIONS = [];
