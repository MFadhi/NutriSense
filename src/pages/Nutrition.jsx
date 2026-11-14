import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Beef, CalendarDays, Droplet, Plus, Trash2, Wheat } from "lucide-react";
import { useApp } from "../context/AppContext";
import AddFoodModal from "../components/AddFoodModal";
import { Card, ChartTooltip, EmptyState, PageHeader, ProgressBar, Ring, SectionTitle, Thumb, fmt } from "../components/ui";
import { MEAL_TYPES, MEAL_LABEL } from "../data/foods";
import { WEEKLY } from "../data/extras";

const suggestedMeal = () => {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 19 ? "snacks" : "dinner";
};

const MACRO_COLORS = { protein: "#4caf50", carbs: "#8bc34a", fat: "#f0a13c" };

function MealSection({ meal, onAdd }) {
  const { diary, totals, resolveFood, removeDiaryItem } = useApp();
  const items = diary[meal.id] || [];
  const sum = totals.perMeal[meal.id] || { calories: 0 };
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
        <span className="rounded-full bg-leaf-100 px-2.5 py-1 text-[11px] font-extrabold text-leaf-700">{fmt(sum.calories)} kcal</span>
        <button className="btn btn-xs btn-soft" onClick={() => onAdd(meal.id)}>
          <Plus size={12} /> Add food
        </button>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-5 text-xs font-semibold text-mist">Nothing logged yet — add your first {meal.label.toLowerCase()} item.</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {items.map((it) => {
            const food = resolveFood(it);
            if (!food) return null;
            const s = it.servings || 1;
            return (
              <li key={it.id} className="group flex items-center gap-3 px-4 py-3 sm:px-5">
                <Thumb item={food} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-ink">
                    {food.name}
                    {s !== 1 && <span className="ml-1.5 rounded bg-leaf-100 px-1.5 py-0.5 text-[9px] font-extrabold text-leaf-700">×{s}</span>}
                  </p>
                  <p className="text-[11px] font-medium text-mist">
                    {food.serving} · P {fmt(food.protein * s)}g · C {fmt(food.carbs * s)}g · F {fmt(food.fat * s)}g
                  </p>
                </div>
                <span className="text-[10px] font-bold text-mist">{it.time}</span>
                <span className="w-16 text-right text-[13px] font-extrabold text-ink">{fmt(food.calories * s)} kcal</span>
                <button
                  className="icon-btn h-8 w-8 text-mist/70 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50! hover:text-red-500!"
                  onClick={() => removeDiaryItem(meal.id, it.id)}
                  aria-label="Remove item"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function Nutrition() {
  const { totals, targets, diary, resolveFood, removeDiaryItem } = useApp();
  const location = useLocation();
  const [modal, setModal] = useState({ open: false, meal: suggestedMeal(), focus: null });

  /* Opened from global search — preselect a food */
  useEffect(() => {
    if (location.state?.addFood) {
      setModal({ open: true, meal: suggestedMeal(), focus: location.state.addFood });
    }
  }, [location.state]);

  const openAdd = (meal) => setModal({ open: true, meal: meal || suggestedMeal(), focus: null });

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
      <PageHeader title="My Nutrition" subtitle="Track today's meals, macros and weekly trends — data persists in your browser.">
        <span className="btn btn-outline btn-sm pointer-events-none">
          <CalendarDays size={14} /> {new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => openAdd()}>
          <Plus size={15} /> Add food
        </button>
      </PageHeader>

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
            <MealSection key={meal.id} meal={meal} onAdd={openAdd} />
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
                          {MEAL_LABEL[it.meal]} · {it.time}
                        </p>
                      </div>
                      <span className="text-[12px] font-extrabold text-ink">{fmt(food.calories * (it.servings || 1))} kcal</span>
                      <button
                        className="icon-btn h-7 w-7 text-mist/60 opacity-0 group-hover:opacity-100 hover:bg-red-50! hover:text-red-500!"
                        onClick={() => removeDiaryItem(it.meal, it.id)}
                        aria-label="Delete entry"
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
    </div>
  );
}
