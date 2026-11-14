import {
  Salad,
  Droplets,
  Apple,
  Brain,
  MoonStar,
  Flame,
} from "lucide-react";

/** Last 7 days of intake — realistic demo series for charts. */
export const WEEKLY = [
  { day: "Mon", calories: 1820, protein: 88, carbs: 232, fat: 58 },
  { day: "Tue", calories: 1965, protein: 96, carbs: 248, fat: 62 },
  { day: "Wed", calories: 1750, protein: 82, carbs: 210, fat: 55 },
  { day: "Thu", calories: 2050, protein: 102, carbs: 260, fat: 66 },
  { day: "Fri", calories: 1885, protein: 91, carbs: 238, fat: 60 },
  { day: "Sat", calories: 2110, protein: 99, carbs: 272, fat: 70 },
  { day: "Sun", calories: 1690, protein: 79, carbs: 205, fat: 52 },
];

export const HEALTH_TIPS = [
  {
    icon: Salad,
    title: "Tip of the day",
    text: "Fill half your plate with vegetables and fruits — colour is a quick proxy for micronutrient variety.",
  },
  {
    icon: Droplets,
    title: "Hydrate before thirst",
    text: "Thirst lags behind dehydration. Sip water steadily instead of chugging at meal times.",
  },
  {
    icon: Apple,
    title: "Snack smart",
    text: "Pair fruit with protein (yogurt, nuts) to keep blood sugar and energy levels stable.",
  },
  {
    icon: Brain,
    title: "Eat mindfully",
    text: "Eating slowly for ~20 minutes lets satiety signals catch up and helps portion control.",
  },
  {
    icon: MoonStar,
    title: "Early dinners win",
    text: "Finishing dinner 2–3 hours before sleep improves digestion and overnight glucose control.",
  },
  {
    icon: Flame,
    title: "Protein each meal",
    text: "20–30 g of protein per meal supports muscle maintenance and keeps you fuller for longer.",
  },
];

/** Rotating motivational messages for the dashboard banner. */
export const QUOTES = [
  "Small healthy choices, every single day, compound into big results.",
  "Eat the rainbow — a colourful plate is a nutrient-dense plate.",
  "Progress, not perfection. One balanced meal at a time.",
  "Hydration and fibre are the quiet heroes of good nutrition.",
];

/** Sample extracted metrics shown for any uploaded lab report (demo only). */
export const SAMPLE_LAB_VALUES = [
  {
    name: "Hemoglobin",
    value: 12.1,
    unit: "g/dL",
    min: 13,
    max: 17,
    status: "low",
    insight: "Slightly below range — iron-rich foods can help support healthy haemoglobin.",
    foods: ["Spinach", "Beetroot", "Lentils", "Dates"],
  },
  {
    name: "Fasting Blood Glucose",
    value: 106,
    unit: "mg/dL",
    min: 70,
    max: 99,
    status: "high",
    insight: "Marginally above the reference range — favour low-GI carbs and fibre-rich meals.",
    foods: ["Rolled oats", "Whole grains", "Bitter gourd", "Legumes"],
  },
  {
    name: "Vitamin D (25-OH)",
    value: 18,
    unit: "ng/mL",
    min: 30,
    max: 100,
    status: "deficient",
    insight: "Below the sufficiency threshold — add vitamin-D sources and safe sun exposure.",
    foods: ["Fortified milk", "Mushrooms", "Egg yolk", "Fatty fish"],
  },
  {
    name: "Total Cholesterol",
    value: 214,
    unit: "mg/dL",
    min: 0,
    max: 200,
    status: "borderline",
    insight: "Borderline-high — soluble fibre and healthy fats can support lipid balance.",
    foods: ["Oats", "Almonds", "Olive oil", "Flaxseed"],
  },
  {
    name: "Serum Iron",
    value: 62,
    unit: "µg/dL",
    min: 60,
    max: 170,
    status: "normal",
    insight: "Within range, but near the lower edge — keep iron and vitamin-C rich foods in rotation.",
    foods: ["Citrus fruits", "Sprouts", "Jaggery", "Leafy greens"],
  },
];

export const LAB_STATUS = {
  normal: { label: "Normal", color: "green" },
  low: { label: "Low", color: "amber" },
  high: { label: "High", color: "amber" },
  borderline: { label: "Borderline", color: "amber" },
  deficient: { label: "Deficient", color: "red" },
};
