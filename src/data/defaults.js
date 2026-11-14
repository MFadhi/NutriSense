import { IMAGES } from "./foods";

/** Demo user profile — editable from the Settings page. */
export const DEFAULT_PROFILE = {
  name: "Ananya Sharma",
  email: "ananya.sharma@example.com",
  age: 23,
  height: 165, // cm
  weight: 58, // kg
  activity: "Moderately active",
  avatar: IMAGES.avatar,
  diet: ["Vegetarian", "High-protein"],
  goals: ["Weight management", "Better energy"],
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

/** Pre-logged sample meals so the dashboard feels alive on first load. */
export const DEFAULT_DIARY = {
  breakfast: [
    { id: "b1", foodId: "oats-bowl", servings: 1, time: "8:15 AM" },
    { id: "b2", foodId: "banana", servings: 1, time: "8:20 AM" },
    { id: "b3", foodId: "greek-yogurt", servings: 1, time: "8:25 AM" },
    { id: "b4", foodId: "honey", servings: 1, time: "8:25 AM" },
  ],
  lunch: [],
  snacks: [{ id: "s1", foodId: "berry-smoothie", servings: 1, time: "11:05 AM" }],
  dinner: [],
};

export const DEFAULT_NOTIFICATIONS = [
  {
    id: "n1",
    icon: "droplets",
    title: "Hydration reminder",
    desc: "You are 1 L away from today's water goal. Keep sipping!",
    time: "20 min ago",
    read: false,
  },
  {
    id: "n2",
    icon: "chef",
    title: "New recipe match",
    desc: "Fruit Smoothie is fully cookable with your pantry items.",
    time: "1 h ago",
    read: false,
  },
  {
    id: "n3",
    icon: "file",
    title: "Lab report analysed",
    desc: "Sample values were extracted from your blood test report.",
    time: "Yesterday",
    read: true,
  },
];
