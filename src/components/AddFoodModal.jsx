import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useApp } from "../context/AppContext";
import { FOODS, MEAL_TYPES } from "../data/foods";
import { Modal, Thumb, fmt } from "./ui";

export default function AddFoodModal({ open, onClose, defaultMeal = "lunch", focusFoodId = null }) {
  const { addDiaryItem, toast } = useApp();
  const [meal, setMeal] = useState(defaultMeal);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setMeal(defaultMeal);
      setQuery("");
    }
  }, [open, defaultMeal]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = FOODS.filter((f) => `${f.name} ${f.category}`.toLowerCase().includes(q));
    if (focusFoodId) items = [...items].sort((a, b) => (a.id === focusFoodId ? -1 : b.id === focusFoodId ? 1 : 0));
    return items;
  }, [query, focusFoodId]);

  const add = (food) => {
    addDiaryItem(meal, { foodId: food.id });
    toast(`${food.name} logged to ${meal}`);
  };

  return (
    <Modal open={open} onClose={onClose} title="Add food to diary" subtitle="Search the sample database and log a serving">
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

      <div className="relative mb-3">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mist" />
        <input autoFocus className="input pl-9" placeholder="Search foods — e.g. oats, salad, smoothie" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
        {list.map((f) => (
          <div
            key={f.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
              f.id === focusFoodId ? "border-leaf-300 bg-leaf-75" : "border-transparent hover:border-line hover:bg-leaf-50"
            }`}
          >
            <Thumb item={f} size={42} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-ink">{f.name}</p>
              <p className="text-[11px] font-medium text-mist">
                {f.serving} · P {f.protein}g · C {f.carbs}g · F {f.fat}g
              </p>
            </div>
            <span className="w-14 text-right text-[13px] font-extrabold text-ink">
              {fmt(f.calories)} <span className="text-[9px] font-bold text-mist">kcal</span>
            </span>
            <button className="btn btn-xs btn-soft" onClick={() => add(f)}>
              <Plus size={12} /> Add
            </button>
          </div>
        ))}
        {list.length === 0 && <p className="py-8 text-center text-xs font-semibold text-mist">No foods match “{query}”.</p>}
      </div>

      <p className="mt-3 text-[10.5px] font-medium text-mist">Values are estimated per serving from sample data — ready to be wired to a real nutrition API.</p>
    </Modal>
  );
}
