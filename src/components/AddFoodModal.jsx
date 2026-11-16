import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Minus, Plus, Search, ShieldAlert, Wheat } from "lucide-react";
import { useApp } from "../context/AppContext";
import { FOODS, MEAL_TYPES } from "../data/foods";
import { Modal, Thumb, fmt } from "./ui";
import { searchFoods, getFood } from "../api/foods";
import { localToday, nowUtcIso } from "../utils/date";
import * as LogsAPI from "../api/logs";

/** Normalise an API food into the shape AddFoodModal needs. */
function apiFoodToDisplay(f) {
  return {
    id: f.id,
    name: f.name_en,
    name_hi: f.name_hi,
    name_kn: f.name_kn,
    category: f.category?.label_en || "Food",
    calories: parseFloat(f.kcal_per_100g) || 0,
    protein: parseFloat(f.protein_per_100g) || 0,
    carbs: parseFloat(f.carbs_per_100g) || 0,
    fat: parseFloat(f.fat_per_100g) || 0,
    serving: "per 100g",
    image: null,
    iconKey: "food",
    portions: f.portions || [],
    warnings: f.warnings || [],
    diet: f.diet,
    _apiFood: f,
  };
}

/** Diet badge colour */
const DIET_COLORS = {
  vegan:  "bg-green-100 text-green-700",
  veg:    "bg-leaf-100 text-leaf-700",
  egg:    "bg-amber-100 text-amber-700",
  nonveg: "bg-red-100 text-red-600",
};

function WarningBadge({ warning }) {
  const colorMap = {
    allergen: "bg-red-100 text-red-600",
    diet_mismatch: "bg-amber-100 text-amber-700",
  };
  const cls = colorMap[warning.type] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      <ShieldAlert size={9} /> {warning.message}
    </span>
  );
}

export default function AddFoodModal({ open, onClose, defaultMeal = "lunch", focusFoodId = null }) {
  const { addDiaryItem, toast, auth } = useApp();
  const [meal, setMeal] = useState(defaultMeal);
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [apiResults, setApiResults] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [portionIdx, setPortionIdx] = useState(0);
  const [gramsMode, setGramsMode] = useState(false);
  const [customGrams, setCustomGrams] = useState(100);
  const debounceRef = useRef(null);
  const isAuthenticated = auth?.isAuthenticated;

  useEffect(() => {
    if (open) {
      setMeal(defaultMeal);
      setQuery("");
      setDebouncedQ("");
      setApiResults([]);
      setApiError(null);
      setSelectedFood(null);
      setQuantity(1);
      setPortionIdx(0);
      setGramsMode(false);
      setCustomGrams(100);
    }
  }, [open, defaultMeal]);

  // Debounce query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Search API when query changes
  useEffect(() => {
    if (!debouncedQ.trim() || debouncedQ.trim().length < 2) {
      setApiResults([]);
      setApiLoading(false);
      setApiError(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setApiLoading(true);
      setApiError(null);
      try {
        const data = await searchFoods(debouncedQ.trim(), { limit: 20 });
        if (!cancelled) setApiResults((data.foods || []).map(apiFoodToDisplay));
      } catch (err) {
        if (!cancelled) {
          setApiError(err?.message || "Search failed");
          setApiResults([]);
        }
      } finally {
        if (!cancelled) setApiLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [debouncedQ]);

  // Local fallback list (when no query or API not available)
  const localList = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = FOODS.filter((f) => `${f.name} ${f.category}`.toLowerCase().includes(q));
    if (focusFoodId) items = [...items].sort((a, b) => (a.id === focusFoodId ? -1 : b.id === focusFoodId ? 1 : 0));
    return items;
  }, [query, focusFoodId]);

  const hasQuery = query.trim().length >= 2;
  // Prefer API results if available, else local sample data
  const list = hasQuery && apiResults.length > 0 ? apiResults :
               hasQuery && !apiLoading ? localList :
               !hasQuery ? localList : [];

  /* ---- Computed nutrition preview ---- */
  const activePortion = selectedFood?.portions?.[portionIdx];
  const portionGrams = gramsMode ? customGrams : (activePortion?.grams || 100);
  const factor = (portionGrams / 100) * quantity;

  const preview = selectedFood ? {
    calories: Math.round(selectedFood.calories * factor),
    protein:  +(selectedFood.protein * factor).toFixed(1),
    carbs:    +(selectedFood.carbs   * factor).toFixed(1),
    fat:      +(selectedFood.fat     * factor).toFixed(1),
  } : null;

  const add = async (food) => {
    const apiMeal = meal === "snacks" ? "snack" : meal;

    if (isAuthenticated && food._apiFood) {
      const pLabel = gramsMode ? "custom" : (activePortion?.label || "serving");
      try {
        await LogsAPI.createLog({
          food_id: food._apiFood.id,
          food_name: food._apiFood.name_en,
          meal: apiMeal,
          logged_at: nowUtcIso(),
          log_date: localToday(),
          quantity,
          portion_label: pLabel,
          portion_grams: portionGrams,
        });
        toast(`${food.name} logged to ${meal === "snacks" ? "Snacks" : meal}`);
        onClose();
        return;
      } catch (err) {
        // Fall through to local
      }
    }

    // Local path (unauthenticated or API food fallback)
    addDiaryItem(meal, {
      customFood: {
        id: `cf-${food.id}`,
        name: food.name,
        serving: gramsMode ? `${customGrams} g` : (activePortion?.label || "serving"),
        category: food.category,
        calories: preview?.calories || food.calories,
        protein: preview?.protein || food.protein,
        carbs: preview?.carbs || food.carbs,
        fat: preview?.fat || food.fat,
        image: food.image,
        iconKey: food.iconKey || "food",
      },
    }, quantity);
    toast(`${food.name} logged to ${meal === "snacks" ? "Snacks" : meal}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add food to diary" subtitle="Search the food database and log a portion">
      {/* Meal selector */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {MEAL_TYPES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMeal(m.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
              meal === m.id
                ? "border-leaf-400 bg-leaf-400 text-white shadow-sm"
                : "border-line bg-white text-mist hover:border-leaf-300 hover:text-leaf-700"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Search box */}
      <div className="relative mb-3">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mist" />
        <input
          autoFocus
          className="input h-10 pl-10"
          placeholder="Search foods — e.g. paneer, oats, dosa…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {apiLoading && (
          <Loader2 size={14} className="absolute top-1/2 right-3.5 -translate-y-1/2 animate-spin text-leaf-500" />
        )}
      </div>

      {/* Error state */}
      {apiError && hasQuery && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          <AlertTriangle size={13} />
          {apiError} — showing sample data instead.
        </div>
      )}

      {/* Loading skeleton */}
      {apiLoading && (
        <div className="space-y-2 pb-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-leaf-75" />
          ))}
        </div>
      )}

      {/* Food list */}
      {!apiLoading && (
        <div className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
          {list.map((f) => (
            <div
              key={f.id}
              onClick={() => {
                setSelectedFood(f);
                setPortionIdx(0);
                setGramsMode(false);
                setQuantity(1);
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                selectedFood?.id === f.id
                  ? "border-leaf-400 bg-leaf-75"
                  : f.id === focusFoodId
                  ? "border-leaf-300 bg-leaf-75"
                  : "border-transparent hover:border-line hover:bg-leaf-50"
              }`}
            >
              <Thumb item={f} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-ink">{f.name}</p>
                {(f.name_hi || f.name_kn) && (
                  <p className="text-[10px] font-medium text-mist">
                    {[f.name_hi, f.name_kn].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="text-[11px] font-medium text-mist">
                  {f.serving} · P {f.protein}g · C {f.carbs}g · F {f.fat}g
                </p>
                {f.warnings?.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {f.warnings.slice(0, 2).map((w, i) => (
                      <WarningBadge key={i} warning={w} />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[13px] font-extrabold text-ink">
                  {fmt(f.calories)} <span className="text-[9px] font-bold text-mist">kcal</span>
                </span>
                {f.diet && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${DIET_COLORS[f.diet] || "bg-slate-100 text-slate-500"}`}>
                    {f.diet}
                  </span>
                )}
                <button
                  className="btn btn-xs btn-soft"
                  onClick={(e) => { e.stopPropagation(); add(f); }}
                  aria-label={`Add ${f.name}`}
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
          ))}
          {!apiLoading && list.length === 0 && hasQuery && (
            <p className="py-8 text-center text-xs font-semibold text-mist">
              No foods match "{query}".
            </p>
          )}
          {!hasQuery && list.length === 0 && (
            <p className="py-8 text-center text-xs font-semibold text-mist">
              Type to search the food database.
            </p>
          )}
        </div>
      )}

      {/* Portion / quantity controls — shown when a food is selected */}
      {selectedFood && !apiLoading && (
        <div className="mt-3 rounded-2xl border border-leaf-200 bg-leaf-50 p-3.5 space-y-3">
          <p className="text-xs font-extrabold text-ink">{selectedFood.name}</p>

          {/* Portion chips */}
          {selectedFood.portions?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedFood.portions.map((p, i) => (
                <button
                  key={i}
                  onClick={() => { setPortionIdx(i); setGramsMode(false); }}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
                    !gramsMode && portionIdx === i
                      ? "border-leaf-400 bg-leaf-400 text-white"
                      : "border-line bg-white text-mist hover:border-leaf-300"
                  }`}
                >
                  {p.label} · {p.grams}g
                </button>
              ))}
              <button
                onClick={() => setGramsMode(true)}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
                  gramsMode
                    ? "border-leaf-400 bg-leaf-400 text-white"
                    : "border-line bg-white text-mist hover:border-leaf-300"
                }`}
              >
                Custom g
              </button>
            </div>
          )}

          {/* Custom grams input */}
          {gramsMode && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-mist">Grams</label>
              <input
                type="number"
                min={1}
                max={2000}
                value={customGrams}
                onChange={(e) => setCustomGrams(Number(e.target.value) || 100)}
                className="input h-8 w-24 text-sm"
              />
            </div>
          )}

          {/* Quantity stepper */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-mist">Quantity</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="icon-btn h-8 w-8"
                aria-label="Decrease quantity"
              >
                <Minus size={13} />
              </button>
              <span className="w-8 text-center text-sm font-extrabold text-ink">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                className="icon-btn h-8 w-8"
                aria-label="Increase quantity"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Live nutrition preview */}
          {preview && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Calories", value: `${preview.calories} kcal`, cls: "col-span-4 bg-leaf-400/15 text-leaf-800" },
              ].map((r) => (
                <div key={r.label} className={`${r.cls} rounded-xl px-3 py-2 text-center`}>
                  <p className="text-[10px] font-bold text-mist">{r.label}</p>
                  <p className="text-sm font-extrabold">{r.value}</p>
                </div>
              ))}
              {[
                { label: "Protein", value: `${preview.protein}g` },
                { label: "Carbs",   value: `${preview.carbs}g` },
                { label: "Fat",     value: `${preview.fat}g` },
              ].map((r) => (
                <div key={r.label} className="col-span-1 rounded-xl bg-leaf-75 px-2 py-2 text-center">
                  <p className="text-[9px] font-bold text-mist">{r.label}</p>
                  <p className="text-xs font-extrabold text-ink">{r.value}</p>
                </div>
              ))}
            </div>
          )}

          <button
            className="btn btn-primary w-full"
            onClick={() => add(selectedFood)}
          >
            <Plus size={14} /> Log to {meal === "snacks" ? "Snacks" : meal.charAt(0).toUpperCase() + meal.slice(1)}
          </button>
        </div>
      )}

      <p className="mt-3 text-[10.5px] font-medium text-mist">
        {isAuthenticated
          ? "Values are computed from the NutriLens food database."
          : "Values are estimated from sample data — sign in for the full database."}
      </p>
    </Modal>
  );
}
