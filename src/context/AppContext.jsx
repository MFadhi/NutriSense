import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { FOODS } from "../data/foods";
import { RECIPES } from "../data/recipes";
import { DEFAULT_PANTRY } from "../data/pantry";
import {
  DEFAULT_PROFILE,
  DEFAULT_TARGETS,
  DEFAULT_PREFS,
  DEFAULT_DIARY,
  DEFAULT_NOTIFICATIONS,
} from "../data/defaults";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { resetAppData } from "../services/storage";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

let seq = 0;
export const uid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

const norm = (s) => String(s || "").toLowerCase().trim();

/* Guess a shopping/pantry category from an ingredient name. */
const CATEGORY_RULES = [
  [/tomato|onion|carrot|spinach|cucumber|peas|vegetable|lettuce|mint|coriander|lemon|chilli|spice|bay|cumin|gourd/i, "Vegetables"],
  [/banana|apple|strawberr|mango|orange|fruit|pomegranate|watermelon/i, "Fruits"],
  [/rice|oats|bread|quinoa|wheat|flour|dal|lentil/i, "Grains"],
  [/milk|yogurt|curd|paneer|cheese|butter|ghee|feta|cream/i, "Dairy"],
];
export function guessCategory(name) {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(name)) return cat;
  return "Others";
}

export function AppProvider({ children }) {
  const [auth, setAuth] = useLocalStorage("nutrisense_auth", {
    token: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [profile, setProfile] = useLocalStorage("nutrisense_profile", DEFAULT_PROFILE);
  const [targets, setTargets] = useLocalStorage("nutrisense_targets", DEFAULT_TARGETS);
  const [prefs, setPrefs] = useLocalStorage("nutrisense_prefs", DEFAULT_PREFS);
  const [diary, setDiary] = useLocalStorage("nutrisense_diary", DEFAULT_DIARY);
  const [water, setWater] = useLocalStorage("nutrisense_water_ml", 0);
  const [pantry, setPantry] = useLocalStorage("nutrisense_pantry", DEFAULT_PANTRY);
  const [shopping, setShopping] = useLocalStorage("nutrisense_shopping", []);
  const [reports, setReports] = useLocalStorage("nutrisense_reports", []);
  const [notifications, setNotifications] = useLocalStorage("nutrisense_notifs", DEFAULT_NOTIFICATIONS);
  const [toasts, setToasts] = useState([]);

  /* ------------------------------ Auth -------------------------------- */
  const login = useCallback(
    (token, refreshToken, user) => {
      setAuth({ token, refreshToken, user, isAuthenticated: true });
      if (user) {
        setProfile((p) => ({
          ...p,
          email: user.email || p.email,
          name: user.name || (user.email ? user.email.split("@")[0] : p.name),
          diet: user.diet ? [user.diet] : p.diet,
        }));
      }
    },
    [setAuth, setProfile]
  );

  const logout = useCallback(() => {
    setAuth({ token: null, refreshToken: null, user: null, isAuthenticated: false });
    setProfile(DEFAULT_PROFILE);
    setToasts((t) => [...t, { id: uid("t"), message: "Signed out successfully." }]);
  }, [setAuth, setProfile]);

  /* ------------------------------ Toasts ------------------------------ */
  const toast = useCallback((message) => {
    const id = uid("t");
    setToasts((t) => [...t, { id, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  /* ------------------------------- Diary ------------------------------ */
  const resolveFood = useCallback(
    (item) => item.customFood || FOODS.find((f) => f.id === item.foodId) || null,
    []
  );

  const totals = useMemo(() => {
    const perMeal = {};
    const all = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
    for (const meal of Object.keys(diary)) {
      const acc = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
      for (const item of diary[meal] || []) {
        const food = resolveFood(item);
        if (!food) continue;
        const s = item.servings || 1;
        acc.calories += food.calories * s;
        acc.protein += food.protein * s;
        acc.carbs += food.carbs * s;
        acc.fat += food.fat * s;
        acc.count += 1;
      }
      perMeal[meal] = acc;
      all.calories += acc.calories;
      all.protein += acc.protein;
      all.carbs += acc.carbs;
      all.fat += acc.fat;
      all.count += acc.count;
    }
    return { perMeal, ...all };
  }, [diary, resolveFood]);

  const addDiaryItem = useCallback(
    (meal, payload, servings = 1) => {
      const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      setDiary((d) => ({ ...d, [meal]: [...(d[meal] || []), { id: uid("f"), servings, time, ...payload }] }));
    },
    [setDiary]
  );

  const removeDiaryItem = useCallback(
    (meal, id) => {
      setDiary((d) => ({ ...d, [meal]: (d[meal] || []).filter((x) => x.id !== id) }));
      toast("Removed from diary");
    },
    [setDiary, toast]
  );

  /* ------------------------------- Water ------------------------------ */
  const addWater = useCallback(
    (ml = 250) => {
      setWater((w) => Math.min(6000, w + ml));
      toast(`+${ml} ml water logged`);
    },
    [setWater, toast]
  );
  const resetWater = useCallback(() => setWater(0), [setWater]);

  /* ------------------------------- Pantry ----------------------------- */
  const addIngredient = useCallback(
    (item) => {
      setPantry((p) => [...p, { id: uid("p"), tags: [norm(item.name)], ...item }]);
      toast(`${item.name} added to pantry`);
    },
    [setPantry, toast]
  );
  const updateIngredient = useCallback((id, patch) => {
    setPantry((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, [setPantry]);
  const removeIngredient = useCallback(
    (id) => {
      setPantry((p) => p.filter((x) => x.id !== id));
      toast("Ingredient removed");
    },
    [setPantry, toast]
  );

  /* Pantry-aware ingredient matching for recipes */
  const haveIngredient = useCallback(
    (match) => {
      const m = norm(match);
      return pantry.some(
        (p) =>
          norm(p.name).includes(m) ||
          m.includes(norm(p.name)) ||
          (p.tags || []).some((t) => m.includes(norm(t)) || norm(t).includes(m))
      );
    },
    [pantry]
  );

  const recipeStats = useCallback(
    (recipe) => {
      const missing = recipe.ingredients.filter((i) => !haveIngredient(i.match));
      const have = recipe.ingredients.length - missing.length;
      return {
        have,
        total: recipe.ingredients.length,
        missing,
        ready: missing.length === 0,
        isAvailable: (match) => haveIngredient(match),
      };
    },
    [haveIngredient]
  );

  /* ----------------------------- Shopping ----------------------------- */
  const addShoppingItem = useCallback(
    ({ name, category, qty, source }) => {
      const cat = category || guessCategory(name);
      setShopping((s) => {
        if (s.some((x) => norm(x.name) === norm(name) && !x.purchased)) return s;
        return [...s, { id: uid("sh"), name, category: cat, qty: qty || "1 unit", purchased: false, source }];
      });
    },
    [setShopping]
  );

  const addMissingToShopping = useCallback(
    (items, source) => {
      const existing = new Set(shopping.filter((x) => !x.purchased).map((x) => norm(x.name)));
      const fresh = [];
      for (const i of items) {
        const key = norm(i.name);
        if (existing.has(key)) continue;
        existing.add(key);
        fresh.push({ id: uid("sh"), name: i.name, category: guessCategory(i.name), qty: i.qty || "1 unit", purchased: false, source });
      }
      if (fresh.length) setShopping((s) => [...s, ...fresh]);
      toast(fresh.length > 0 ? `${fresh.length} item${fresh.length > 1 ? "s" : ""} added to shopping list` : "Already on your shopping list");
      return fresh.length;
    },
    [shopping, setShopping, toast]
  );

  const toggleShoppingItem = useCallback(
    (id) => setShopping((s) => s.map((x) => (x.id === id ? { ...x, purchased: !x.purchased } : x))),
    [setShopping]
  );
  const removeShoppingItem = useCallback(
    (id) => setShopping((s) => s.filter((x) => x.id !== id)),
    [setShopping]
  );
  const clearPurchased = useCallback(() => {
    setShopping((s) => s.filter((x) => !x.purchased));
    toast("Cleared purchased items");
  }, [setShopping, toast]);

  /* --------------------------- Notifications --------------------------- */
  const unreadCount = notifications.filter((n) => !n.read).length;
  const markAllRead = useCallback(
    () => setNotifications((ns) => ns.map((n) => ({ ...n, read: true }))),
    [setNotifications]
  );

  /* ------------------------------- Reset ------------------------------ */
  const resetApp = useCallback(() => {
    resetAppData();
    window.location.reload();
  }, []);

  const value = {
    auth, authModalOpen, setAuthModalOpen, login, logout,
    profile, setProfile,
    targets, setTargets,
    prefs, setPrefs,
    diary, totals, addDiaryItem, removeDiaryItem, resolveFood,
    water, addWater, resetWater,
    pantry, addIngredient, updateIngredient, removeIngredient,
    haveIngredient, recipeStats,
    shopping, addShoppingItem, addMissingToShopping, toggleShoppingItem, removeShoppingItem, clearPurchased,
    reports, setReports,
    notifications, unreadCount, markAllRead,
    toasts, toast,
    resetDemo: resetApp,
    resetApp,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
