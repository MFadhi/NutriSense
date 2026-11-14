/**
 * Mock weather service — returns realistic static data for Pune, India.
 * Swap these exports for a real API (e.g. OpenWeatherMap) when the backend is ready.
 */
export const WEATHER = {
  city: "Pune, India",
  condition: "Sunny intervals",
  temp: 34,
  feelsLike: 37,
  humidity: 68,
  wind: 14,
  uvIndex: 8,
  uv: "High",
  visibility: 9,
  pressure: 1009,
  sunrise: "6:04 AM",
  sunset: "6:41 PM",
  updated: "Updated 15 min ago",
};

export const HOURLY = [
  { time: "6 AM", temp: 25 },
  { time: "8 AM", temp: 28 },
  { time: "10 AM", temp: 31 },
  { time: "12 PM", temp: 33 },
  { time: "2 PM", temp: 34 },
  { time: "4 PM", temp: 33 },
  { time: "6 PM", temp: 31 },
  { time: "8 PM", temp: 28 },
];

export const FORECAST = [
  { day: "Today", icon: "sun", hi: 34, lo: 24, note: "Sunny intervals" },
  { day: "Tue", icon: "sun", hi: 35, lo: 25, note: "Hot & clear" },
  { day: "Wed", icon: "cloudsun", hi: 33, lo: 24, note: "Partly cloudy" },
  { day: "Thu", icon: "rain", hi: 31, lo: 23, note: "Light showers" },
  { day: "Fri", icon: "sun", hi: 35, lo: 25, note: "Sunny" },
  { day: "Sat", icon: "sun", hi: 34, lo: 24, note: "Sunny" },
];

/** Heat-adjusted hydration plan for the dashboard & weather page. */
export const HYDRATION_PLAN = {
  base: 2500,
  extra: 500,
  target: 3000,
  reason: "Heat (34°C) and humidity (68%) increase fluid loss through sweat.",
};

export const WEATHER_FOODS = [
  {
    name: "Watermelon & citrus",
    icon: "citrus",
    kcal: "~46 kcal / cup",
    why: "Water-rich fruits replace fluids and electrolytes lost in the heat.",
  },
  {
    name: "Cucumber salad",
    icon: "salad",
    kcal: "~16 kcal / cup",
    why: "95% water — cooling, light and adds crunch without heaviness.",
  },
  {
    name: "Coconut water",
    icon: "glass",
    kcal: "~45 kcal / glass",
    why: "Natural source of potassium to rebalance what you sweat out.",
  },
  {
    name: "Buttermilk (chaas)",
    icon: "milk",
    kcal: "~40 kcal / glass",
    why: "A traditional probiotic cooler that aids digestion in hot weather.",
  },
  {
    name: "Light veggie soups",
    icon: "soup",
    kcal: "~90 kcal / bowl",
    why: "Hydration plus micronutrients for a warm-but-light dinner.",
  },
  {
    name: "Curd & yogurt bowls",
    icon: "droplets",
    kcal: "~140 kcal / cup",
    why: "Cooling protein that pairs well with fruit for a heat-friendly snack.",
  },
];

export const WEATHER_TIPS = [
  "Increase today's water target from 2.5 L to about 3.0 L.",
  "Prefer water-rich produce: cucumber, watermelon, citrus and tomatoes.",
  "Schedule intense workouts before 10 AM or after 5 PM.",
  "Limit deep-fried and very spicy food during peak afternoon heat.",
];
