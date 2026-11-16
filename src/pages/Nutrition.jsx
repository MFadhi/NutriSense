import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Beef, CalendarDays, Droplet, Edit2, Loader2, Plus, RotateCcw, Trash2, Wheat, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import AddFoodModal from "../components/AddFoodModal";
import { Card, ChartTooltip, EmptyState, Modal, PageHeader, ProgressBar, Ring, SectionTitle, Thumb, fmt } from "../components/ui";
import { MEAL_TYPES, MEAL_LABEL } from "../data/foods";
import { WEEKLY } from "../data/extras";
import { localToday, nowUtcIso } from "../utils/date";
import * as LogsAPI from "../api/logs";

const suggestedMeal = () => {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 19 ? "snacks" : "dinner";
};

const MACRO_COLORS = { protein: "#4caf50", carbs: "#8bc34a", fat: "#f0a13c" };

function MealSection({ meal, onAdd, onEdit, onDelete }) {
  const { diary, totals, resolveFood } = useApp();
  const mealKey = meal.id === "snack" ? "snacks" : meal.id;
  const items = diary[mealKey] || [];
  const sum = totals.perMeal[mealKey] || { calories: 0 };
  const Icon = meal.icon;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-leaf-75/60 px-4 py-3.5 sm:px-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-leaf-600 shadow-sm">
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-ink">{meal.label}</p>
          <p className="text-[10.5px] font-bold text-mist">{meal.hint}</p>
        </div>
        <span className="rounded-full bg-leaf-100 px-2.5 py-1 text-[11px] font-extrabold text-leaf-700">
          {fmt(sum.calories)} kcal
        </span>
        <button
          className="btn btn-xs btn-soft min-h-[36px] sm:min-h-[32px] px-3"
          onClick={() => onAdd(mealKey)}
          aria-label={`Add food to ${meal.label}`}
        >
          <Plus size={12} /> Add food
        </button>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-5 text-xs font-semibold text-mist">
          Nothing logged yet — add your first {meal.label.toLowerCase()} item.
        </p>
      ) : (
        <ul className="divide-y divide-line/70">
          {items.map((it) => {
            const food = resolveFood(it);
            if (!food) return null;
            const s = it.servings || 1;
            return (
              <li key={it.id} className="group flex items-center gap-3 px-4 py-3 sm:px-5 hover:bg-leaf-50/50 transition-colors">
                <Thumb item={food} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-ink">
                    {food.name}
                    {s !== 1 && (
                      <span className="ml-1.5 rounded bg-leaf-100 px-1.5 py-0.5 text-[9px] font-extrabold text-leaf-700">
                        ×{s}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] font-medium text-mist">
                    {food.serving} · P {fmt(food.protein * s)}g · C {fmt(food.carbs * s)}g · F {fmt(food.fat * s)}g
                  </p>
                </div>
                <span className="text-[10px] font-bold text-mist">{it.time}</span>
                <span className="w-16 text-right text-[13px] font-extrabold text-ink">
                  {fmt(food.calories * s)} kcal
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="icon-btn h-8 w-8 min-h-[36px] min-w-[36px] text-mist/70 hover:bg-leaf-100 hover:text-leaf-800"
                    onClick={() => onEdit(mealKey, it, food)}
                    aria-label={`Edit ${food.name}`}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    className="icon-btn h-8 w-8 min-h-[36px] min-w-[36px] text-mist/70 hover:bg-red-50 hover:text-red-500"
                    onClick={() => onDelete(mealKey, it, food)}
                    aria-label={`Remove ${food.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function Nutrition() {
  const { totals, targets, diary, resolveFood, removeDiaryItem, addDiaryItem, loadDiaryForDate, auth, toast } = useApp();
  const location = useLocation();
  const [modal, setModal] = useState({ open: false, meal: suggestedMeal(), focus: null });

  // Edit state
  const [editingItem, setEditingItem] = useState(null); // { meal, it, food, quantity, targetMeal }

  // Undo state
  const [undoState, setUndoState] = useState(null); // { item, meal, rawLog, timerId }

  /* Opened from global search — preselect a food */
  useEffect(() => {
    if (location.state?.addFood) {
      setModal({ open: true, meal: suggestedMeal(), focus: location.state.addFood });
    }
  }, [location.state]);

  const openAdd = (meal) => setModal({ open: true, meal: meal || suggestedMeal(), focus: null });

  const handleEdit = (meal, it, food) => {
    setEditingItem({
      meal,
      targetMeal: meal,
      it,
      food,
      quantity: it.servings || 1,
    });
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    const { meal, targetMeal, it, quantity } = editingItem;
    const isApi = Boolean(it._logId && auth?.isAuthenticated);

    if (isApi) {
      try {
        const apiMeal = targetMeal === "snacks" ? "snack" : targetMeal;
        await LogsAPI.updateLog(it._logId, {
          quantity: Number(quantity) || 1,
          meal: apiMeal,
        });
        await loadDiaryForDate(localToday());
        toast("Log updated successfully");
      } catch (err) {
        toast(err?.message || "Failed to update log");
      }
    } else {
      // Local diary edit: remove from old meal, re-add to targetMeal with new servings
      removeDiaryItem(meal, it.id);
      addDiaryItem(targetMeal, it, Number(quantity) || 1);
      toast("Log updated");
    }
    setEditingItem(null);
  };

  const handleDeleteWithUndo = async (meal, it, food) => {
    // If there's an existing undo timer, commit it
    if (undoState?.timerId) {
      clearTimeout(undoState.timerId);
    }

    const rawLog = it.customFood?._raw || null;
    const deletedInfo = {
      meal,
      it,
      food,
      rawLog,
    };

    // Remove item right away
    await removeDiaryItem(meal, it.id);

    // Setup 5-second undo timer
    const timerId = setTimeout(() => {
      setUndoState(null);
    }, 5000);

    setUndoState({ ...deletedInfo, timerId });
  };

  const handleUndo = async () => {
    if (!undoState) return;
    clearTimeout(undoState.timerId);
    const { meal, it, food, rawLog } = undoState;

    if (auth?.isAuthenticated && rawLog) {
      try {
        await LogsAPI.createLog({
          food_id: rawLog.food_id || null,
          food_name: rawLog.food_name || food.name,
          meal: rawLog.meal,
          logged_at: nowUtcIso(),
          log_date: localToday(),
          quantity: rawLog.quantity || it.servings || 1,
          portion_label: rawLog.portion_label || "serving",
          portion_grams: rawLog.portion_grams || 100,
        });
        await loadDiaryForDate(localToday());
        toast(`Restored ${food.name}`);
      } catch {
        // Fallback local re-add
        addDiaryItem(meal, it, it.servings || 1);
        toast(`Restored ${food.name}`);
      }
    } else {
      addDiaryItem(meal, it, it.servings || 1);
      toast(`Restored ${food.name}`);
    }

    setUndoState(null);
  };

  const macroPie = [
    { name: "Protein", value: Math.round(totals.protein * 4), key: "protein" },
    { name: "Carbs", value: Math.round(totals.carbs * 4), key: "carbs" },
    { name: "Fat", value: Math.round(totals.fat * 9), key: "fat" },
  ];
  const pieTotal = macroPie.reduce((a, b) => a + b.value, 0) || 1;

  /* Chronological diary feed */
  const feed = Object.keys(diary)
    .flatMap((meal) => (diary[meal] || []).map((it) => ({ ...it, meal })))
    .slice()
    .reverse();

  return (
    <div className="space-y-5">
      <PageHeader title="My Nutrition" subtitle="Track today's meals, macros and weekly trends — synced with NutriLens.">
        <span className="btn btn-outline btn-sm pointer-events-none min-h-[44px]">
          <CalendarDays size={14} /> {new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
        </span>
        <button
          className="btn btn-primary btn-sm min-h-[44px] px-4"
          onClick={() => openAdd()}
          aria-label="Add food to diary"
        >
          <Plus size={15} /> Add food
        </button>
      </PageHeader>

      {/* Undo Banner if an item was just deleted */}
      {undoState && (
        <div className="flex items-center justify-between rounded-2xl border border-leaf-300 bg-leaf-100/90 px-4 py-3 shadow-md">
          <p className="text-xs font-bold text-leaf-800">
            Removed <span className="font-extrabold">{undoState.food?.name}</span> from diary.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              className="inline-flex items-center gap-1 rounded-xl bg-leaf-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs hover:bg-leaf-700 min-h-[36px]"
              aria-label="Undo food removal"
            >
              <RotateCcw size={13} /> Undo
            </button>
            <button
              onClick={() => {
                clearTimeout(undoState.timerId);
                setUndoState(null);
              }}
              className="text-leaf-600 hover:text-leaf-900 p-1"
              aria-label="Dismiss undo notification"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex items-center gap-4 p-4">
          <Ring value={totals.calories} max={targets.calories} size={86} stroke={9}>
            <span className="text-sm font-extrabold text-ink">{fmt((totals.calories / targets.calories) * 100)}%</span>
          </Ring>
          <div>
            <p className="text-[11px] font-extrabold tracking-wide text-mist uppercase">Calories</p>
            <p className="text-xl font-extrabold tracking-tight text-ink">
              {fmt(totals.calories)} <span className="text-xs font-bold text-mist">/ {targets.calories}</span>
            </p>
            <p className="text-[11px] font-semibold text-mist">{fmt(Math.max(0, targets.calories - totals.calories))} kcal left today</p>
          </div>
        </Card>
        {[
          { key: "protein", icon: Beef, label: "Protein" },
          { key: "carbs", icon: Wheat, label: "Carbohydrates" },
          { key: "fat", icon: Droplet, label: "Fats" },
        ].map(({ key, icon: Icon, label }) => (
          <Card key={key} className="p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-extrabold text-mist">
                <Icon size={14} style={{ color: MACRO_COLORS[key] }} /> {label}
              </span>
              <span className="text-[10px] font-extrabold text-mist">{fmt((totals[key] / targets[key]) * 100)}%</span>
            </div>
            <p className="mt-2 text-xl font-extrabold tracking-tight text-ink">
              {fmt(totals[key])} <span className="text-xs font-bold text-mist">/ {targets[key]} g</span>
            </p>
            <div className="mt-2.5">
              <ProgressBar value={totals[key]} max={targets[key]} color={MACRO_COLORS[key]} height={8} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Meals */}
        <div className="space-y-4 xl:col-span-2">
          {MEAL_TYPES.map((meal) => (
            <MealSection
              key={meal.id}
              meal={meal}
              onAdd={openAdd}
              onEdit={handleEdit}
              onDelete={handleDeleteWithUndo}
            />
          ))}
        </div>

        {/* Analytics column */}
        <div className="space-y-4">
          <Card className="p-5">
            <SectionTitle title="Energy split" subtitle="Calories by macro, today" />
            <div className="mt-2 h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={macroPie} dataKey="value" innerRadius={52} outerRadius={74} paddingAngle={4} strokeWidth={0} cornerRadius={6}>
                    {macroPie.map((m) => (
                      <Cell key={m.key} fill={MACRO_COLORS[m.key]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip unit=" kcal" />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 space-y-2">
              {macroPie.map((m) => (
                <div key={m.key} className="flex items-center gap-2.5 text-xs font-bold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: MACRO_COLORS[m.key] }} />
                  <span className="flex-1 text-mist">{m.name}</span>
                  <span className="text-ink">{fmt((m.value / pieTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Weekly intake" subtitle="Calories per day" />
            <div className="mt-2 h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={WEEKLY} margin={{ top: 8, right: 0, left: -22, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e0ead9" strokeDasharray="4 6" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#78909c", fontSize: 10, fontWeight: 700 }} dy={6} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#b3c4ad", fontSize: 9, fontWeight: 700 }} domain={[0, 2400]} />
                  <Tooltip content={<ChartTooltip unit=" kcal" />} cursor={{ fill: "rgba(139,195,74,0.08)" }} />
                  <Bar dataKey="calories" name="Calories" fill="#8bc34a" radius={[6, 6, 2, 2]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Food diary" subtitle="Everything logged today" />
            {feed.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Diary is empty" text="Log your first meal to start today's timeline." />
            ) : (
              <ul className="mt-3 space-y-1">
                {feed.map((it) => {
                  const food = resolveFood(it);
                  if (!food) return null;
                  return (
                    <li key={it.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-leaf-50">
                      <span className="h-8 w-1 rounded-full bg-leaf-300" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold text-ink">{food.name}</p>
                        <p className="text-[10.5px] font-semibold text-mist">
                          {MEAL_LABEL[it.meal] || it.meal} · {it.time}
                        </p>
                      </div>
                      <span className="text-[12px] font-extrabold text-ink">{fmt(food.calories * (it.servings || 1))} kcal</span>
                      <button
                        className="icon-btn h-8 w-8 text-mist/60 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                        onClick={() => handleDeleteWithUndo(it.meal, it, food)}
                        aria-label={`Delete ${food.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <AddFoodModal open={modal.open} defaultMeal={modal.meal} focusFoodId={modal.focus} onClose={() => setModal((m) => ({ ...m, open: false }))} />

      {/* Edit Entry Modal */}
      {editingItem && (
        <Modal
          open={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          title="Edit food log"
          subtitle={`Adjust meal or quantity for ${editingItem.food?.name}`}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-extrabold text-ink">Meal</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setEditingItem((e) => ({ ...e, targetMeal: m.id }))}
                    className={`flex h-10 items-center justify-center rounded-xl border text-xs font-bold transition-all min-h-[44px] ${
                      editingItem.targetMeal === m.id
                        ? "border-leaf-400 bg-leaf-100 text-leaf-800 shadow-xs"
                        : "border-line bg-white text-mist hover:border-leaf-200 hover:text-ink"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-extrabold text-ink">Quantity / Servings</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingItem((e) => ({ ...e, quantity: Math.max(0.25, (Number(e.quantity) || 1) - 0.5) }))}
                  className="icon-btn h-11 w-11 min-h-[44px] min-w-[44px] rounded-xl border border-line bg-white text-ink"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="50"
                  value={editingItem.quantity}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, quantity: e.target.value }))}
                  className="input h-11 text-center font-bold text-ink"
                />
                <button
                  type="button"
                  onClick={() => setEditingItem((e) => ({ ...e, quantity: (Number(e.quantity) || 1) + 0.5 }))}
                  className="icon-btn h-11 w-11 min-h-[44px] min-w-[44px] rounded-xl border border-line bg-white text-ink"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-outline min-h-[44px]"
                onClick={() => setEditingItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary min-h-[44px]"
                onClick={saveEdit}
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
