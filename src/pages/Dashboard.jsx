import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  Beef,
  CalendarDays,
  ChefHat,
  CloudSun,
  Droplet,
  Droplets,
  FileUp,
  Flame,
  Lightbulb,
  PackagePlus,
  Quote,
  UtensilsCrossed,
  Wheat,
  Wind,
  RotateCcw,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Card, ChartTooltip, ProgressBar, Ring, SectionTitle, Thumb, fmt } from "../components/ui";
import { IMAGES, MEAL_TYPES } from "../data/foods";
import { HEALTH_TIPS, QUOTES, WEEKLY } from "../data/extras";
import { WEATHER } from "../services/weather";
import { getDailyDashboard, getWeeklyDashboard } from "../api/dashboard";
import { getWeatherRecommendations } from "../api/weather";
import { localToday } from "../utils/date";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const MACRO_META = [
  { key: "protein", label: "Protein", icon: Beef,  color: "#4caf50", tint: "bg-[#e8f5d8]" },
  { key: "carbs",   label: "Carbs",   icon: Wheat,  color: "#8bc34a", tint: "bg-[#eef7e0]" },
  { key: "fat",     label: "Fat",     icon: Droplet, color: "#f0a13c", tint: "bg-[#fdf2e0]" },
];

const QUICK_ACTIONS = [
  { to: "/nutrition",    icon: UtensilsCrossed, label: "Log Meals",        desc: "Track daily intake" },
  { to: "/meal-planner", icon: CalendarDays,    label: "Meal Planner",     desc: "Personalized nutrition plan" },
  { to: "/lab-reports",  icon: FileUp,          label: "Upload Lab Report", desc: "Get nutrition insights" },
  { to: "/pantry",       icon: PackagePlus,     label: "Add Pantry Items",  desc: "Track ingredients" },
  { to: "/recipes",      icon: ChefHat,         label: "Explore Recipes",    desc: "Cook from your pantry" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, totals, targets, water, addWater, resetWater, diary, resolveFood, auth } = useApp();

  /* API data */
  const [dailyData, setDailyData]   = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [liveWeather, setLiveWeather] = useState(null);

  const isAuthenticated = auth?.isAuthenticated;

  useEffect(() => {
    getWeatherRecommendations().then(setLiveWeather).catch(() => {});
  }, []);

  // Load API data when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const today = localToday();
    getDailyDashboard(today)
      .then(setDailyData)
      .catch(() => setDailyData(null));

    const endDate = today;
    getWeeklyDashboard(endDate, 7)
      .then(setWeeklyData)
      .catch(() => setWeeklyData(null));
  }, [isAuthenticated]);

  // Reload daily when diary changes (after a log entry)
  useEffect(() => {
    if (!isAuthenticated) return;
    const today = localToday();
    getDailyDashboard(today)
      .then(setDailyData)
      .catch(() => {});
  }, [totals, isAuthenticated]);

  /* Decide which values to display */
  const displayTargets = isAuthenticated && dailyData?.targets
    ? {
        calories: dailyData.targets.kcal,
        protein: dailyData.targets.protein_g,
        carbs: dailyData.targets.carbs_g,
        fat: dailyData.targets.fat_g,
        water: dailyData.targets.water_ml,
      }
    : targets;

  const displayTotals = isAuthenticated && dailyData?.consumed
    ? {
        calories: dailyData.consumed.kcal,
        protein: dailyData.consumed.protein_g,
        carbs: dailyData.consumed.carbs_g,
        fat: dailyData.consumed.fat_g,
        count: Object.values(dailyData.meals || {}).reduce((s, m) => s + (m.entries || []).length, 0),
      }
    : totals;

  const displayWater = isAuthenticated && dailyData?.water
    ? dailyData.water.ml
    : water;

  const displayWaterGoal = isAuthenticated && dailyData?.water
    ? dailyData.water.goal_ml
    : (displayTargets.water || 2500);

  /* Weekly chart data */
  const chartData = weeklyData?.days
    ? weeklyData.days.map((d) => ({
        day: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
        calories: d.kcal,
      }))
    : WEEKLY;

  const remaining  = Math.max(0, displayTargets.calories - displayTotals.calories);
  const dateStr    = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
  const quote      = QUOTES[new Date().getDate() % QUOTES.length];
  const glasses    = Math.round(displayWaterGoal / 250);
  const filledGlasses = Math.round(displayWater / 250);

  return (
    <div className="space-y-5">
      {/* ---------- Welcome banner ---------- */}
      <div className="relative overflow-hidden rounded-3xl border border-line shadow-sm">
        <img src={IMAGES.banner} alt="Fresh healthy ingredients" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#24470f]/90 via-[#33691e]/70 to-[#33691e]/25" />
        <div className="relative flex min-h-[216px] flex-col justify-center gap-3 p-6 sm:p-9">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-wide text-white backdrop-blur">
            <CalendarDays size={12} /> {dateStr}
          </span>
          <h1 className="font-display max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {greeting()}, {profile.name.split(" ")[0]}
          </h1>
          <p className="font-display max-w-lg text-[15px] text-white/85 italic sm:text-base">"{quote}"</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
              <Flame size={11} className="mr-1 inline -translate-y-px" /> {fmt(displayTotals.calories)} / {displayTargets.calories} kcal
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
              <Droplets size={11} className="mr-1 inline -translate-y-px" /> {(displayWater / 1000).toFixed(1)} / {(displayWaterGoal / 1000).toFixed(1)} L water
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
              {WEATHER.temp}°C · {WEATHER.condition}
            </span>
          </div>
        </div>
      </div>

      {/* ---------- Daily overview ---------- */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-5">
          <SectionTitle title="Calories today" subtitle="Daily energy budget" />
          <div className="mt-4 flex items-center gap-6">
            <Ring value={displayTotals.calories} max={displayTargets.calories} size={168} stroke={14}>
              <span className="text-3xl font-extrabold tracking-tight text-ink">{fmt(displayTotals.calories)}</span>
              <span className="text-[10px] font-bold tracking-[0.12em] text-mist uppercase">of {displayTargets.calories} kcal</span>
              <span className="mt-1 rounded-full bg-leaf-100 px-2 py-0.5 text-[10px] font-extrabold text-leaf-700">
                {fmt((displayTotals.calories / displayTargets.calories) * 100)}%
              </span>
            </Ring>
            <div className="flex-1 space-y-3.5">
              {[
                { label: "Daily target", value: `${fmt(displayTargets.calories)} kcal`, cls: "text-ink" },
                { label: "Consumed",     value: `${fmt(displayTotals.calories)} kcal`, cls: "text-leaf-600" },
                { label: "Remaining",    value: `${fmt(remaining)} kcal`,              cls: "text-ink" },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between border-b border-dashed border-line pb-3 last:border-0 last:pb-0">
                  <span className="text-xs font-bold text-mist">{row.label}</span>
                  <span className={`text-sm font-extrabold ${row.cls}`}>{row.value}</span>
                </div>
              ))}
              <p className="text-[11px] leading-relaxed font-medium text-mist">
                {displayTotals.count} item{displayTotals.count === 1 ? "" : "s"} logged across your meals today.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-7">
          <SectionTitle title="Macronutrients" subtitle="Protein · Carbs · Fat progress" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {MACRO_META.map(({ key, label, icon: Icon, color, tint }) => (
              <div key={key} className="rounded-2xl border border-line bg-leaf-50 p-4">
                <div className={`grid h-9 w-9 place-items-center rounded-xl ${tint}`} style={{ color }}>
                  <Icon size={17} />
                </div>
                <p className="mt-3 text-xs font-bold text-mist">{label}</p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-ink">
                  {fmt(displayTotals[key])}
                  <span className="text-xs font-bold text-mist"> / {displayTargets[key]} g</span>
                </p>
                <div className="mt-2.5">
                  <ProgressBar value={displayTotals[key]} max={displayTargets[key]} color={color} height={7} />
                </div>
                <p className="mt-1.5 text-[10px] font-bold" style={{ color }}>
                  {fmt((displayTotals[key] / displayTargets[key]) * 100)}% of target
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-leaf-75 px-3.5 py-2.5 text-[12px] font-semibold text-leaf-800">
            <Lightbulb size={14} className="shrink-0 text-leaf-500" />
            {displayTotals.protein < displayTargets.protein * 0.5
              ? "Protein is lagging — add eggs, paneer or chicken to your next meal."
              : "Great macro balance so far. Keep protein steady through the evening."}
          </div>
        </Card>
      </div>

      {/* ---------- Hydration + Weather ---------- */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-5">
          <SectionTitle
            title="Hydration tracker"
            subtitle={`Target ${(displayWaterGoal / 1000).toFixed(1)} L today`}
            action={
              <button className="icon-btn" onClick={resetWater} title="Reset water intake" aria-label="Reset water intake">
                <RotateCcw size={14} />
              </button>
            }
          />
          <div className="mt-3 flex items-end justify-between">
            <p className="text-[34px] leading-none font-extrabold tracking-tight text-ink">
              {(displayWater / 1000).toFixed(1)} <span className="text-base font-bold text-mist">L</span>
            </p>
            <p className="text-xs font-bold text-mist">{fmt(Math.max(0, displayWaterGoal - displayWater))} ml remaining</p>
          </div>
          <div className="mt-3">
            <ProgressBar value={displayWater} max={displayWaterGoal} height={10} color="var(--color-leaf-500)" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {Array.from({ length: glasses }).map((_, i) => (
              <Droplet
                key={i}
                size={17}
                strokeWidth={0}
                className={i < filledGlasses ? "fill-leaf-400 text-leaf-400 transition-all" : "fill-leaf-100 text-leaf-100"}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2.5">
            <button className="btn btn-primary btn-sm" onClick={() => addWater(250)} aria-label="Add 250ml water">
              <Droplets size={14} /> Add 250 ml
            </button>
            <p className="text-[11px] font-semibold text-mist">1 glass ≈ 250 ml</p>
          </div>
        </Card>

        <Card hover className="relative cursor-pointer overflow-hidden p-5 lg:col-span-7" onClick={() => navigate("/weather")}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.12em] text-mist uppercase">
                Weather intelligence · {liveWeather?.weather?.city || WEATHER.city}
              </p>
              <div className="mt-2 flex items-start gap-1.5">
                <span className="font-display text-6xl leading-none font-semibold tracking-tight text-ink">
                  {Math.round(liveWeather?.weather?.temperature ?? WEATHER.temp)}°
                </span>
                <span className="mt-1 text-base font-bold text-mist">C</span>
              </div>
              <p className="mt-1.5 text-sm font-bold text-ink">
                {liveWeather?.weather?.condition_text || WEATHER.condition} · feels{" "}
                {Math.round(liveWeather?.weather?.apparent_temperature ?? liveWeather?.weather?.temperature ?? WEATHER.feelsLike)}°C
              </p>
            </div>
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-leaf-100 text-leaf-500">
              <CloudSun size={34} strokeWidth={1.8} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Humidity",     value: `${Math.round(liveWeather?.weather?.humidity ?? WEATHER.humidity)}%`, icon: Droplets },
              { label: "Wind",         value: `${WEATHER.wind} km/h`,           icon: Wind },
              { label: "UV index",     value: `${WEATHER.uvIndex} · ${WEATHER.uv}`, icon: Lightbulb },
              { label: "Water target", value: `${(displayWaterGoal/1000).toFixed(1)} L`, icon: Droplet },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-line bg-leaf-50 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wide text-mist uppercase">
                  <Icon size={11} className="text-leaf-500" /> {label}
                </div>
                <p className="mt-0.5 text-sm font-extrabold text-ink">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-leaf-100 px-3.5 py-3">
            <Quote size={15} className="mt-0.5 shrink-0 text-leaf-600" />
            <p className="text-[13px] leading-relaxed font-semibold text-leaf-800">
              {liveWeather?.hydration?.explanation || `It's ${WEATHER.temp}°C today! Stay hydrated and include water-rich fruits in your meals.`}
            </p>
          </div>
          <span className="absolute right-5 bottom-5 hidden items-center gap-1 text-[11px] font-extrabold text-leaf-600 sm:flex">
            Full insights <ArrowRight size={12} />
          </span>
        </Card>
      </div>

      {/* ---------- Today's meals ---------- */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Today's meals</h2>
          <Link to="/nutrition" className="flex items-center gap-1 text-xs font-extrabold text-leaf-600 hover:text-leaf-700">
            Open food diary <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MEAL_TYPES.map((meal) => {
            const mealKey = meal.id === "snack" ? "snacks" : meal.id;
            const data  = totals.perMeal[mealKey] || { calories: 0, count: 0 };
            const items = diary[mealKey] || [];
            return (
              <Card key={meal.id} hover className="cursor-pointer overflow-hidden" onClick={() => navigate("/nutrition")}>
                <div className="relative h-28">
                  <img src={meal.image} alt={meal.label} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/55 to-transparent" />
                  <span className="absolute bottom-2.5 left-3.5 text-sm font-extrabold text-white">{meal.label}</span>
                  <span className="absolute right-3 bottom-2.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold text-white backdrop-blur">
                    {fmt(data.calories)} kcal
                  </span>
                </div>
                <div className="p-3.5">
                  {items.length > 0 ? (
                    <ul className="space-y-1.5">
                      {items.slice(0, 2).map((it) => {
                        const food = resolveFood(it);
                        return food ? (
                          <li key={it.id} className="flex items-center gap-2 text-xs font-semibold text-ink/80">
                            <Thumb item={food} size={22} className="rounded-md" />
                            <span className="truncate">{food.name}</span>
                          </li>
                        ) : null;
                      })}
                      {items.length > 2 && <li className="pl-1 text-[10px] font-bold text-mist">+{items.length - 2} more items</li>}
                    </ul>
                  ) : (
                    <p className="text-xs font-semibold text-mist">Not logged yet — tap to plan {meal.label.toLowerCase()}.</p>
                  )}
                  <p className="mt-2.5 text-[10px] font-bold tracking-wide text-leaf-500 uppercase">{meal.hint}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ---------- Trends + actions ---------- */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-8">
          <SectionTitle title="Weekly calorie trend" subtitle="Last 7 days · target line" />
          <div className="mt-3 h-[248px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="calFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#8bc34a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#8bc34a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e0ead9" strokeDasharray="4 6" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#78909c", fontSize: 11, fontWeight: 700 }} dy={6} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#b3c4ad", fontSize: 10, fontWeight: 700 }} domain={[0, "auto"]} />
                <Tooltip content={<ChartTooltip unit=" kcal" />} cursor={{ stroke: "#a5d66d", strokeWidth: 1.5, strokeDasharray: "4 4" }} />
                <Area type="monotone" dataKey="calories" name="Calories" stroke="#8bc34a" strokeWidth={2.5} fill="url(#calFill)" dot={{ r: 3, fill: "#fff", stroke: "#8bc34a", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#4caf50" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-4">
          <Card className="p-5">
            <SectionTitle title="Quick actions" />
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc }) => (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className="group flex flex-col items-start gap-2.5 rounded-2xl border border-line bg-leaf-50 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-leaf-300 hover:bg-leaf-100"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-leaf-600 shadow-sm transition-colors group-hover:bg-leaf-400 group-hover:text-white">
                    <Icon size={17} />
                  </span>
                  <span>
                    <span className="block text-[13px] leading-tight font-extrabold text-ink">{label}</span>
                    <span className="mt-0.5 block text-[10.5px] font-semibold text-mist">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Health tips" subtitle="Curated for your goals" />
            <ul className="mt-3 space-y-3">
              {HEALTH_TIPS.slice(0, 3).map((tip, i) => (
                <li key={i} className="flex gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${i === 0 ? "bg-leaf-400 text-white shadow-md shadow-leaf-400/30" : "bg-leaf-100 text-leaf-600"}`}>
                    <tip.icon size={16} />
                  </span>
                  <div>
                    <p className="text-[13px] font-extrabold text-ink">
                      {i === 0 && <span className="mr-1.5 rounded bg-leaf-100 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-leaf-700 uppercase">{tip.title}</span>}
                      {i !== 0 && tip.title}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed font-medium text-mist">{tip.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
