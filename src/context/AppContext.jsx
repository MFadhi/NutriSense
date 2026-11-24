import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { getAccessToken, setAccessToken, setRefreshToken, clearTokens, hasSession, getRefreshToken } from "../auth/tokenStore";
import * as AuthAPI from "../api/auth";
import * as LogsAPI from "../api/logs";
import * as WaterAPI from "../api/water";
import * as PantryGroceryAPI from "../api/pantryGrocery";
import { localToday, nowUtcIso } from "../utils/date";

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

/**
 * Map API profile fields → local profile shape used by Settings/Topbar.
 */
function apiProfileToLocal(apiProfile, email) {
  if (!apiProfile) return null;
  const actMap = {
    sedentary: "Sedentary",
    light: "Lightly active",
    moderate: "Moderately active",
    active: "Very active",
    very_active: "Athlete",
  };
  const dietMap = {
    veg: "Vegetarian",
    vegan: "Vegan",
    nonveg: "Non-vegetarian",
    eggetarian: "Eggetarian",
  };
  return {
    name: apiProfile.display_name || (email ? email.split("@")[0] : "Guest"),
    email: email || "",
    age: apiProfile.dob ? Math.floor((Date.now() - new Date(apiProfile.dob)) / 31557600000) : 25,
    height: apiProfile.height_cm || 170,
    weight: apiProfile.weight_kg || 65,
    activity: actMap[apiProfile.activity_level] || "Moderately active",
    avatar: DEFAULT_PROFILE.avatar,
    diet: apiProfile.diet_type ? [dietMap[apiProfile.diet_type] || apiProfile.diet_type] : ["Vegetarian"],
    goals: ["Balanced nutrition"],
    // Raw API fields — used when saving back
    _api: {
      height_cm: apiProfile.height_cm,
      weight_kg: apiProfile.weight_kg,
      activity_level: apiProfile.activity_level,
      diet_type: apiProfile.diet_type,
      goal: apiProfile.goal,
      sex: apiProfile.sex,
      dob: apiProfile.dob,
    },
  };
}

/**
 * Map API targets (from /dashboard/daily) → local targets shape.
 */
function apiTargetsToLocal(apiTargets) {
  if (!apiTargets) return null;
  return {
    calories: apiTargets.kcal || 2000,
    protein: apiTargets.protein_g || 100,
    carbs: apiTargets.carbs_g || 250,
    fat: apiTargets.fat_g || 65,
    water: apiTargets.water_ml || 2500,
  };
}

/**
 * Map API log entries → local diary shape.
 * API: array of food_log rows with meal ∈ {breakfast,lunch,snack,dinner}
 * Local: { breakfast:[], lunch:[], snacks:[], dinner:[] }
 */
function apiLogsToLocalDiary(logs) {
  const diary = { breakfast: [], lunch: [], snacks: [], dinner: [] };
  for (const log of logs || []) {
    const mealKey = log.meal === "snack" ? "snacks" : log.meal;
    if (!diary[mealKey]) diary[mealKey] = [];
    diary[mealKey].push({
      id: log.id,
      _logId: log.id,
      foodId: log.food_id || null,
      customFood: {
        id: log.id,
        name: log.food_name,
        serving: log.portion_label || `${log.portion_grams || 100}g`,
        category: "API",
        calories: log.kcal || 0,
        protein: log.protein_g || 0,
        carbs: log.carbs_g || 0,
        fat: log.fat_g || 0,
        image: null,
        iconKey: "food",
        // Keep raw for edit/display
        _raw: log,
      },
      servings: log.quantity || 1,
      time: new Date(log.logged_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    });
  }
  return diary;
}

export function AppProvider({ children }) {
  /* ------------------------------------------------------------------ Auth */
  const [auth, setAuth] = useLocalStorage("nutrisense_auth", {
    token: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  // Track whether initial session restore is done
  const [sessionRestored, setSessionRestored] = useState(false);

  /* ---------------------------------------------------------------- Profile */
  const [profile, setProfile] = useLocalStorage("nutrisense_profile", DEFAULT_PROFILE);
  const [targets, setTargets] = useLocalStorage("nutrisense_targets", DEFAULT_TARGETS);
  const [prefs, setPrefs] = useLocalStorage("nutrisense_prefs", DEFAULT_PREFS);

  /* ------------------------------------------------------------------ Diary — API-backed when authenticated */
  const [diary, setDiary] = useLocalStorage("nutrisense_diary", DEFAULT_DIARY);
  const [water, setWater] = useLocalStorage("nutrisense_water_ml", 0);
  const [waterLogs, setWaterLogs] = useState([]); // API water log entries [{id, amount_ml}]

  /* --------------------------------------------------------- Local-only state */
  const [pantry, setPantry] = useLocalStorage("nutrisense_pantry", DEFAULT_PANTRY);
  const [pantryDashboard, setPantryDashboard] = useState({ total_items: 0, expiring_soon: 0, expired: 0, recently_added: [] });
  const [shopping, setShopping] = useLocalStorage("nutrisense_shopping", []);
  const [reports, setReports] = useLocalStorage("nutrisense_reports", []);
  const [notifications, setNotifications] = useLocalStorage("nutrisense_notifs", DEFAULT_NOTIFICATIONS);
  const [toasts, setToasts] = useState([]);

  /* ------------------------------------------------------------------ Toasts */
  const toast = useCallback((message) => {
    const id = uid("t");
    setToasts((t) => [...t, { id, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  /* ------------------------------------------------ Session restore on mount */
  useEffect(() => {
    // Restore token from localStorage into the in-memory store
    if (auth.token) setAccessToken(auth.token);
    if (auth.refreshToken) setRefreshToken(auth.refreshToken);

    // If we have a session and are authenticated, try to refresh and re-fetch profile
    const restore = async () => {
      if (!auth.isAuthenticated) {
        setSessionRestored(true);
        return;
      }
      try {
        // Try to get current user; if 401, tryRefresh is handled inside client.js
        const me = await AuthAPI.getMe();
        const localProfile = apiProfileToLocal(me.profile, me.email);
        if (localProfile) setProfile(localProfile);
      } catch {
        // Session dead — clear everything
        setAuth({ token: null, refreshToken: null, user: null, isAuthenticated: false });
        clearTokens();
      } finally {
        setSessionRestored(true);
      }
    };
    restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------- Listen for forced sign-out events */
  useEffect(() => {
    const handler = () => {
      setAuth({ token: null, refreshToken: null, user: null, isAuthenticated: false });
      clearTokens();
      setDiary(DEFAULT_DIARY);
      setWater(0);
      setWaterLogs([]);
    };
    window.addEventListener("nutrilens:signout", handler);
    return () => window.removeEventListener("nutrilens:signout", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------- Load diary from API today */
  const loadDiaryForDate = useCallback(async (dateStr) => {
    if (!auth.isAuthenticated) return;
    try {
      const logs = await LogsAPI.getLogs(dateStr);
      setDiary(apiLogsToLocalDiary(logs));
    } catch {
      // Keep local state on failure
    }
  }, [auth.isAuthenticated, setDiary]);

  // Load today's diary whenever auth status changes
  useEffect(() => {
    if (auth.isAuthenticated && sessionRestored) {
      loadDiaryForDate(localToday());
    }
  }, [auth.isAuthenticated, sessionRestored, loadDiaryForDate]);

  /* -------------------------------------------- Load water from API today */
  const loadWaterForDate = useCallback(async (dateStr) => {
    if (!auth.isAuthenticated) return;
    try {
      const entries = await WaterAPI.getWater(dateStr);
      setWaterLogs(entries || []);
      const total = (entries || []).reduce((s, e) => s + (e.amount_ml || 0), 0);
      setWater(total);
    } catch {
      // Keep local
    }
  }, [auth.isAuthenticated, setWater]);

  useEffect(() => {
    if (auth.isAuthenticated && sessionRestored) {
      loadWaterForDate(localToday());
    }
  }, [auth.isAuthenticated, sessionRestored, loadWaterForDate]);

  /* ------------------------------------------- Load pantry & grocery from API */
  const loadPantry = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    try {
      const items = await PantryGroceryAPI.getPantryItems();
      if (Array.isArray(items)) {
        setPantry(items);
      }
      const dash = await PantryGroceryAPI.getPantryDashboard();
      if (dash && typeof dash === "object") {
        setPantryDashboard(dash);
      }
    } catch {
      // Keep local
    }
  }, [auth.isAuthenticated, setPantry]);

  const loadGrocery = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    try {
      const items = await PantryGroceryAPI.getGroceryItems();
      if (Array.isArray(items)) {
        setShopping(items);
      }
    } catch {
      // Keep local
    }
  }, [auth.isAuthenticated, setShopping]);

  useEffect(() => {
    if (auth.isAuthenticated && sessionRestored) {
      loadPantry();
      loadGrocery();
    }
  }, [auth.isAuthenticated, sessionRestored, loadPantry, loadGrocery]);

  /* ------------------------------ Auth -------------------------------- */
  const login = useCallback(
    async (token, refreshToken, user) => {
      setAccessToken(token);
      setRefreshToken(refreshToken);
      setAuth({ token, refreshToken, user, isAuthenticated: true });
      // Fetch full profile from API
      try {
        const me = await AuthAPI.getMe();
        const localProfile = apiProfileToLocal(me.profile, me.email || user?.email);
        if (localProfile) setProfile(localProfile);
        // Load diary + water for today
        const today = localToday();
        loadDiaryForDate(today);
        loadWaterForDate(today);
        loadPantry();
        loadGrocery();
      } catch {
        if (user) {
          setProfile((p) => ({
            ...p,
            email: user.email || p.email,
            name: user.email ? user.email.split("@")[0] : p.name,
          }));
        }
      }
    },
    [setAuth, setProfile, loadDiaryForDate, loadWaterForDate, loadPantry, loadGrocery]
  );

  const logout = useCallback(() => {
    clearTokens();
    setAuth({ token: null, refreshToken: null, user: null, isAuthenticated: false });
    setProfile(DEFAULT_PROFILE);
    setDiary(DEFAULT_DIARY);
    setWater(0);
    setWaterLogs([]);
    setToasts((t) => [...t, { id: uid("t"), message: "Signed out successfully." }]);
  }, [setAuth, setProfile, setDiary, setWater]);

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

  /**
   * Add a food log entry. If authenticated, calls the API; otherwise uses localStorage.
   * payload may contain:
   *  - foodId (string) — ID of a known food
   *  - customFood (object) — custom inline food data
   *  - apiFood (object) — from /foods/<id> API response
   * For API calls the server computes all nutritional values from the food record.
   */
  const addDiaryItem = useCallback(
    async (meal, payload, servings = 1) => {
      const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      // Map "snacks" (UI) → "snack" (API enum)
      const apiMeal = meal === "snacks" ? "snack" : meal;

      if (auth.isAuthenticated && payload.apiFood) {
        // API path — use the food from the backend
        const food = payload.apiFood;
        const defaultPortion = food.portions?.find((p) => p.is_default) || food.portions?.[0];
        const portionGrams = payload.portionGrams || defaultPortion?.grams || 100;
        const portionLabel = payload.portionLabel || defaultPortion?.label || "serving";

        try {
          await LogsAPI.createLog({
            food_id: food.id,
            food_name: food.name_en,
            meal: apiMeal,
            logged_at: nowUtcIso(),
            log_date: localToday(),
            quantity: servings,
            portion_label: portionLabel,
            portion_grams: portionGrams,
          });
          // Refresh diary from API
          await loadDiaryForDate(localToday());
          return;
        } catch (err) {
          // Fallback to local
          console.warn("API log failed, using local:", err);
        }
      }

      // Local path (unauthenticated or API food fallback)
      const mealKey = meal; // keep "snacks" for local dict
      setDiary((d) => ({
        ...d,
        [mealKey]: [...(d[mealKey] || []), { id: uid("f"), servings, time, ...payload }],
      }));
    },
    [auth.isAuthenticated, setDiary, loadDiaryForDate]
  );

  const removeDiaryItem = useCallback(
    async (meal, id) => {
      // Check if this is an API log entry
      const mealKey = meal;
      const item = (diary[mealKey] || []).find((x) => x.id === id);

      if (auth.isAuthenticated && item?._logId) {
        try {
          await LogsAPI.deleteLog(item._logId);
          await loadDiaryForDate(localToday());
          toast("Removed from diary");
          return;
        } catch (err) {
          console.warn("API delete failed:", err);
        }
      }

      // Local fallback
      setDiary((d) => ({ ...d, [mealKey]: (d[mealKey] || []).filter((x) => x.id !== id) }));
      toast("Removed from diary");
    },
    [auth.isAuthenticated, diary, setDiary, loadDiaryForDate, toast]
  );

  /* ------------------------------- Water ------------------------------ */
  const addWater = useCallback(
    async (ml = 250) => {
      if (auth.isAuthenticated) {
        // Optimistic update
        setWater((w) => Math.min(6000, w + ml));
        try {
          const today = localToday();
          await WaterAPI.addWater({
            amount_ml: ml,
            log_date: today,
            logged_at: nowUtcIso(),
          });
          // Reload to get the entry IDs for future deletion
          await loadWaterForDate(today);
          toast(`+${ml} ml water logged`);
        } catch (err) {
          // Roll back optimistic update
          setWater((w) => Math.max(0, w - ml));
          toast("Failed to log water — please retry.");
        }
      } else {
        setWater((w) => Math.min(6000, w + ml));
        toast(`+${ml} ml water logged`);
      }
    },
    [auth.isAuthenticated, setWater, loadWaterForDate, toast]
  );

  const resetWater = useCallback(() => setWater(0), [setWater]);

  /* ------------------------------- Pantry ----------------------------- */
  const addIngredient = useCallback(
    async (item) => {
      if (auth.isAuthenticated) {
        try {
          const created = await PantryGroceryAPI.addPantryItem({
            name: item.name,
            category: item.category,
            quantity: Number(item.qty || item.quantity) || 1,
            unit: item.unit || "pcs",
            purchase_date: item.purchase_date || null,
            expiry_date: item.expiry_date || null,
            notes: item.notes || null,
            food_id: item.food_id || null,
          });
          setPantry((p) => [created, ...p]);
          loadPantry();
          toast(`${item.name} added to pantry`);
          return;
        } catch (err) {
          console.warn("API addIngredient failed:", err);
        }
      }
      setPantry((p) => [...p, { id: uid("p"), tags: [norm(item.name)], ...item }]);
      toast(`${item.name} added to pantry`);
    },
    [auth.isAuthenticated, setPantry, loadPantry, toast]
  );

  const updateIngredient = useCallback(
    async (id, patch) => {
      if (auth.isAuthenticated && typeof id === "number") {
        try {
          const updated = await PantryGroceryAPI.updatePantryItem(id, {
            name: patch.name,
            category: patch.category,
            quantity: patch.qty !== undefined ? Number(patch.qty) : (patch.quantity !== undefined ? Number(patch.quantity) : undefined),
            unit: patch.unit,
            expiry_date: patch.expiry_date,
            purchase_date: patch.purchase_date,
            notes: patch.notes,
          });
          setPantry((p) => p.map((x) => (x.id === id ? { ...x, ...updated } : x)));
          loadPantry();
          return;
        } catch (err) {
          console.warn("API updateIngredient failed:", err);
        }
      }
      setPantry((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    },
    [auth.isAuthenticated, setPantry, loadPantry]
  );

  const consumeIngredient = useCallback(
    async (id, amount = null) => {
      if (auth.isAuthenticated && typeof id === "number") {
        try {
          const res = await PantryGroceryAPI.consumePantryItem(id, amount);
          if (res.is_consumed) {
            setPantry((p) => p.filter((x) => x.id !== id));
            toast("Ingredient marked as consumed");
          } else {
            setPantry((p) => p.map((x) => (x.id === id ? { ...x, ...res } : x)));
            toast(`Used ${amount} ${res.unit || ""}`);
          }
          loadPantry();
          return;
        } catch (err) {
          console.warn("API consume failed:", err);
        }
      }
      setPantry((p) => p.filter((x) => x.id !== id));
      toast("Ingredient consumed");
    },
    [auth.isAuthenticated, setPantry, loadPantry, toast]
  );

  const removeIngredient = useCallback(
    async (id) => {
      if (auth.isAuthenticated && typeof id === "number") {
        try {
          await PantryGroceryAPI.deletePantryItem(id);
          setPantry((p) => p.filter((x) => x.id !== id));
          loadPantry();
          toast("Ingredient removed");
          return;
        } catch (err) {
          console.warn("API remove failed:", err);
        }
      }
      setPantry((p) => p.filter((x) => x.id !== id));
      toast("Ingredient removed");
    },
    [auth.isAuthenticated, setPantry, loadPantry, toast]
  );

  const haveIngredient = useCallback(
    (match) => {
      const m = norm(match);
      return pantry.some(
        (p) =>
          !p.is_consumed &&
          (norm(p.name).includes(m) ||
          m.includes(norm(p.name)) ||
          (p.tags || []).some((t) => m.includes(norm(t)) || norm(t).includes(m)))
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
    async ({ name, category, qty, unit, source }) => {
      const cat = category || guessCategory(name);
      const parsedQty = parseFloat(qty) || 1;
      const parsedUnit = unit || (typeof qty === "string" && qty.includes(" ") ? qty.split(" ").slice(1).join(" ") : "pcs");
      if (auth.isAuthenticated) {
        try {
          const created = await PantryGroceryAPI.addGroceryItem({
            name,
            category: cat,
            quantity: parsedQty,
            unit: parsedUnit,
            notes: source,
          });
          setShopping((s) => [created, ...s]);
          toast(`${name} added to list`);
          return;
        } catch (err) {
          console.warn("API addGroceryItem failed:", err);
        }
      }
      setShopping((s) => {
        if (s.some((x) => norm(x.name) === norm(name) && !x.purchased && !x.is_purchased)) return s;
        return [...s, { id: uid("sh"), name, category: cat, qty: qty || "1 unit", unit: parsedUnit, quantity: parsedQty, purchased: false, is_purchased: false, source }];
      });
      toast(`${name} added to list`);
    },
    [auth.isAuthenticated, setShopping, toast]
  );

  const addMissingToShopping = useCallback(
    async (items, source) => {
      if (auth.isAuthenticated) {
        try {
          const batchPayload = items.map((i) => ({
            name: i.name,
            category: guessCategory(i.name),
            quantity: parseFloat(i.qty) || 1,
            unit: i.unit || (typeof i.qty === "string" && i.qty.includes(" ") ? i.qty.split(" ").slice(1).join(" ") : "pcs"),
            notes: source,
          }));
          const createdList = await PantryGroceryAPI.addGroceryBatch(batchPayload, source);
          setShopping((s) => [...createdList, ...s]);
          toast(createdList.length > 0 ? `${createdList.length} items added to shopping list` : "Already on your list");
          return createdList.length;
        } catch (err) {
          console.warn("API addGroceryBatch failed:", err);
        }
      }
      const existing = new Set(shopping.filter((x) => !x.purchased && !x.is_purchased).map((x) => norm(x.name)));
      const fresh = [];
      for (const i of items) {
        const key = norm(i.name);
        if (existing.has(key)) continue;
        existing.add(key);
        fresh.push({ id: uid("sh"), name: i.name, category: guessCategory(i.name), qty: i.qty || "1 unit", purchased: false, is_purchased: false, source });
      }
      if (fresh.length) setShopping((s) => [...s, ...fresh]);
      toast(fresh.length > 0 ? `${fresh.length} item${fresh.length > 1 ? "s" : ""} added to shopping list` : "Already on your shopping list");
      return fresh.length;
    },
    [auth.isAuthenticated, shopping, setShopping, toast]
  );

  const purchaseGroceryItemAndSync = useCallback(
    async (id, purchasePayload) => {
      if (auth.isAuthenticated && typeof id === "number") {
        const res = await PantryGroceryAPI.purchaseAndSyncToPantry(id, purchasePayload);
        await Promise.all([loadGrocery(), loadPantry()]);
        toast(`Synced ${res.pantry_item?.name || "item"} to pantry!`);
        return res;
      }
      // Local fallback
      setShopping((s) => s.map((x) => (x.id === id ? { ...x, purchased: true, is_purchased: true } : x)));
      const target = shopping.find((x) => x.id === id);
      if (target) {
        addIngredient({
          name: target.name,
          category: target.category,
          qty: purchasePayload.purchased_quantity || target.quantity || 1,
          unit: purchasePayload.unit || target.unit || "pcs",
        });
      }
      toast("Marked as purchased and added to pantry");
      return { message: "Item purchased and added to pantry" };
    },
    [auth.isAuthenticated, shopping, loadGrocery, loadPantry, setShopping, addIngredient, toast]
  );

  const unpurchaseGroceryItem = useCallback(
    async (id) => {
      if (auth.isAuthenticated && typeof id === "number") {
        await PantryGroceryAPI.unpurchaseGroceryItem(id);
        await loadGrocery();
        toast("Item marked as unpurchased");
        return;
      }
      setShopping((s) => s.map((x) => (x.id === id ? { ...x, purchased: false, is_purchased: false } : x)));
      toast("Item marked as unpurchased");
    },
    [auth.isAuthenticated, loadGrocery, setShopping, toast]
  );

  const correctGroceryPurchase = useCallback(
    async (id, newQty) => {
      if (auth.isAuthenticated && typeof id === "number") {
        const res = await PantryGroceryAPI.correctPurchaseQuantity(id, newQty);
        await Promise.all([loadGrocery(), loadPantry()]);
        toast("Purchase quantity corrected");
        return res;
      }
    },
    [auth.isAuthenticated, loadGrocery, loadPantry, toast]
  );

  const toggleShoppingItem = useCallback(
    (id) => setShopping((s) => s.map((x) => (x.id === id ? { ...x, purchased: !x.purchased, is_purchased: !x.purchased } : x))),
    [setShopping]
  );

  const removeShoppingItem = useCallback(
    async (id) => {
      if (auth.isAuthenticated && typeof id === "number") {
        try {
          await PantryGroceryAPI.deleteGroceryItem(id);
          setShopping((s) => s.filter((x) => x.id !== id));
          toast("Item removed");
          return;
        } catch (err) {
          console.warn("API delete grocery failed:", err);
        }
      }
      setShopping((s) => s.filter((x) => x.id !== id));
      toast("Item removed");
    },
    [auth.isAuthenticated, setShopping, toast]
  );

  const clearPurchased = useCallback(
    async () => {
      if (auth.isAuthenticated) {
        try {
          await PantryGroceryAPI.clearPurchasedGrocery();
          setShopping((s) => s.filter((x) => !x.purchased && !x.is_purchased));
          toast("Cleared purchased items");
          return;
        } catch (err) {
          console.warn("API clear purchased failed:", err);
        }
      }
      setShopping((s) => s.filter((x) => !x.purchased && !x.is_purchased));
      toast("Cleared purchased items");
    },
    [auth.isAuthenticated, setShopping, toast]
  );

  /* --------------------------- Notifications --------------------------- */
  const unreadCount = notifications.filter((n) => !n.read).length;
  const markAllRead = useCallback(
    () => setNotifications((ns) => ns.map((n) => ({ ...n, read: true }))),
    [setNotifications]
  );

  /* ------------------------------- Reset ------------------------------ */
  const resetApp = useCallback(() => {
    resetAppData();
    clearTokens();
    window.location.reload();
  }, []);

  /* ----------------------- Profile save helper ----------------------- */
  const saveProfileToApi = useCallback(
    async (localProfile) => {
      if (!auth.isAuthenticated) return;
      const actMap = {
        "Sedentary": "sedentary",
        "Lightly active": "light",
        "Moderately active": "moderate",
        "Very active": "active",
        "Athlete": "very_active",
      };
      const dietMap = {
        "Vegetarian": "veg",
        "Vegan": "vegan",
        "Non-vegetarian": "nonveg",
        "Eggetarian": "eggetarian",
      };
      const apiBody = {
        height_cm: Number(localProfile.height) || undefined,
        weight_kg: Number(localProfile.weight) || undefined,
        activity_level: actMap[localProfile.activity] || undefined,
        diet_type: dietMap[localProfile.diet?.[0]] || undefined,
      };
      try {
        await AuthAPI.updateMe(apiBody);
      } catch (err) {
        console.warn("Profile API save failed:", err);
      }
    },
    [auth.isAuthenticated]
  );

  const value = {
    auth, authModalOpen, setAuthModalOpen, login, logout,
    profile, setProfile, saveProfileToApi,
    targets, setTargets,
    prefs, setPrefs,
    diary, totals, addDiaryItem, removeDiaryItem, resolveFood,
    loadDiaryForDate,
    water, waterLogs, addWater, resetWater, loadWaterForDate,
    pantry, pantryDashboard, loadPantry, addIngredient, updateIngredient, consumeIngredient, removeIngredient,
    haveIngredient, recipeStats,
    shopping, loadGrocery, addShoppingItem, addMissingToShopping, toggleShoppingItem, removeShoppingItem, clearPurchased,
    purchaseGroceryItemAndSync, unpurchaseGroceryItem, correctGroceryPurchase,
    reports, setReports,
    notifications, unreadCount, markAllRead,
    toasts, toast,
    sessionRestored,
    resetDemo: resetApp,
    resetApp,
    apiProfileToLocal,
    apiTargetsToLocal,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
