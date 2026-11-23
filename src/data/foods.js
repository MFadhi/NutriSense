import {
  Droplets,
  GlassWater,
  ScanLine,
  UtensilsCrossed,
  Sunrise,
  Sun,
  Cookie,
  Sunset,
} from "lucide-react";

/* ---------------- Images (royalty-free stock, https URLs) ---------------- */
export const IMAGES = {
  banner:
    "https://images.pexels.com/photos/4638384/pexels-photo-4638384.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  oats:
    "https://images.pexels.com/photos/12091676/pexels-photo-12091676.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  oatsRecipe:
    "https://images.pexels.com/photos/5604825/pexels-photo-5604825.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  banana:
    "https://images.pexels.com/photos/12896846/pexels-photo-12896846.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  yogurt:
    "https://images.pexels.com/photos/4725762/pexels-photo-4725762.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  berrySmoothie:
    "https://images.pexels.com/photos/104662/pexels-photo-104662.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  mangoSmoothie:
    "https://images.pexels.com/photos/14930492/pexels-photo-14930492.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  fruitSmoothies:
    "https://images.pexels.com/photos/6990114/pexels-photo-6990114.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  watermelonDrink:
    "https://images.pexels.com/photos/4113138/pexels-photo-4113138.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  pulao:
    "https://images.pexels.com/photos/36885725/pexels-photo-36885725.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  dalRice:
    "https://images.pexels.com/photos/35008222/pexels-photo-35008222.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  paneerPlate:
    "https://images.pexels.com/photos/29148133/pexels-photo-29148133.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  thaliDinner:
    "https://images.pexels.com/photos/32797056/pexels-photo-32797056.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  chickenSalad:
    "https://images.pexels.com/photos/5192435/pexels-photo-5192435.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  chickenSaladTall:
    "https://images.pexels.com/photos/27969809/pexels-photo-27969809.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  greensSalad:
    "https://images.pexels.com/photos/842545/pexels-photo-842545.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  mediterranean:
    "https://images.pexels.com/photos/38551608/pexels-photo-38551608.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  quinoaBowl:
    "https://images.pexels.com/photos/17597414/pexels-photo-17597414.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  avocadoToast:
    "https://images.pexels.com/photos/7936680/pexels-photo-7936680.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  sandwich:
    "https://images.pexels.com/photos/32504564/pexels-photo-32504564.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  omelette:
    "https://images.pexels.com/photos/3920506/pexels-photo-3920506.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  appleRustic:
    "https://images.pexels.com/photos/32369842/pexels-photo-32369842.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  fruits:
    "https://images.pexels.com/photos/4451837/pexels-photo-4451837.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
};

/* Icon fallbacks for foods without a photo */
export const FOOD_ICONS = {
  droplets: Droplets,
  glass: GlassWater,
  scan: ScanLine,
  food: UtensilsCrossed,
};

/* ------------------------ Sample food database --------------------------
   Values are estimated per serving — realistic demo data only.            */
export const FOODS = [
  { id: "oats-bowl", name: "Rolled Oats Porridge", serving: "1 bowl (250 g)", category: "Breakfast", calories: 190, protein: 7, carbs: 33, fat: 3.6, image: IMAGES.oats },
  { id: "banana", name: "Banana", serving: "1 medium (118 g)", category: "Fruits", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, image: IMAGES.banana },
  { id: "greek-yogurt", name: "Greek Yogurt & Fruit Cup", serving: "1 cup (170 g)", category: "Dairy", calories: 140, protein: 15, carbs: 8, fat: 4, image: IMAGES.yogurt },
  { id: "honey", name: "Honey", serving: "1 tbsp (21 g)", category: "Others", calories: 64, protein: 0, carbs: 17, fat: 0, image: null, iconKey: "droplets" },
  { id: "berry-smoothie", name: "Berry Oat Smoothie", serving: "1 glass (350 ml)", category: "Beverages", calories: 222, protein: 8, carbs: 38, fat: 3.2, image: IMAGES.berrySmoothie },
  { id: "mango-smoothie", name: "Mango Banana Smoothie", serving: "1 glass (300 ml)", category: "Beverages", calories: 210, protein: 6, carbs: 40, fat: 2, image: IMAGES.mangoSmoothie },
  { id: "veg-pulao", name: "Vegetable Pulao", serving: "1 plate (300 g)", category: "Mains", calories: 320, protein: 7, carbs: 58, fat: 6, image: IMAGES.pulao },
  { id: "dal-rice", name: "Dal Tadka with Rice", serving: "1 plate (350 g)", category: "Mains", calories: 380, protein: 14, carbs: 68, fat: 5, image: IMAGES.dalRice },
  { id: "chicken-salad", name: "Grilled Chicken Salad", serving: "1 bowl (280 g)", category: "Mains", calories: 350, protein: 28, carbs: 12, fat: 19, image: IMAGES.chickenSalad },
  { id: "mediterranean", name: "Mediterranean Chicken Bowl", serving: "1 bowl (320 g)", category: "Mains", calories: 410, protein: 30, carbs: 38, fat: 14, image: IMAGES.mediterranean },
  { id: "quinoa-bowl", name: "Chicken & Pineapple Quinoa Bowl", serving: "1 bowl (300 g)", category: "Mains", calories: 340, protein: 24, carbs: 48, fat: 8, image: IMAGES.quinoaBowl },
  { id: "avocado-toast", name: "Avocado Egg Toast", serving: "2 slices", category: "Breakfast", calories: 260, protein: 11, carbs: 30, fat: 12, image: IMAGES.avocadoToast },
  { id: "paneer-sandwich", name: "Paneer Sandwich", serving: "2 halves (220 g)", category: "Mains", calories: 310, protein: 14, carbs: 38, fat: 11, image: IMAGES.sandwich },
  { id: "veg-omelette", name: "Veggie Omelette", serving: "2 eggs", category: "Breakfast", calories: 210, protein: 13, carbs: 4, fat: 15, image: IMAGES.omelette },
  { id: "sprout-salad", name: "Sprout & Greens Salad", serving: "1 bowl (200 g)", category: "Salads", calories: 180, protein: 9, carbs: 24, fat: 5, image: IMAGES.greensSalad },
  { id: "grilled-paneer", name: "Paneer Tikka Plate", serving: "150 g", category: "Mains", calories: 250, protein: 15, carbs: 8, fat: 17, image: IMAGES.paneerPlate },
  { id: "apple", name: "Apple", serving: "1 medium (182 g)", category: "Fruits", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, image: IMAGES.appleRustic },
  { id: "coconut-water", name: "Coconut Water", serving: "1 glass (240 ml)", category: "Beverages", calories: 45, protein: 0.4, carbs: 11, fat: 0, image: null, iconKey: "glass" },
];

/* ------------------------------- Meals ---------------------------------- */
export const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast", hint: "7:00 – 9:30 AM", icon: Sunrise, image: IMAGES.oatsRecipe },
  { id: "lunch", label: "Lunch", hint: "12:30 – 2:00 PM", icon: Sun, image: IMAGES.chickenSaladTall },
  { id: "snacks", label: "Snacks", hint: "4:00 – 6:00 PM", icon: Cookie, image: IMAGES.watermelonDrink },
  { id: "dinner", label: "Dinner", hint: "7:30 – 9:00 PM", icon: Sunset, image: IMAGES.thaliDinner },
];

export const MEAL_LABEL = Object.fromEntries(MEAL_TYPES.map((m) => [m.id, m.label]));
