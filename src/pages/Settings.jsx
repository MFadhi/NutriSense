import { useState } from "react";
import {
  BellRing,
  ChefHat,
  CloudSun,
  Droplets,
  FileText,
  Flame,
  RotateCcw,
  Save,
  Scale,
  Target,
  User,
  Utensils,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Card, PageHeader, SectionTitle, Toggle } from "../components/ui";

const DIET_OPTIONS = ["Vegetarian", "Vegan", "Non-vegetarian", "Eggetarian", "Gluten-free", "Dairy-free", "High-protein", "Low-carb"];
const GOAL_OPTIONS = ["Weight management", "Muscle gain", "Better energy", "Heart health", "Blood sugar control", "Better digestion"];
const ACTIVITY = ["Sedentary", "Lightly active", "Moderately active", "Very active", "Athlete"];

const PREF_ROWS = [
  { key: "mealReminders", icon: Utensils, label: "Meal logging reminders", desc: "Nudges at breakfast, lunch and dinner time" },
  { key: "hydrationAlerts", icon: Droplets, label: "Hydration alerts", desc: "Reminders when you fall behind on water" },
  { key: "weatherUpdates", icon: CloudSun, label: "Weather-based tips", desc: "Morning advice tuned to the day's forecast" },
  { key: "weeklyReport", icon: FileText, label: "Weekly nutrition report", desc: "A Sunday summary of your intake trends" },
  { key: "newRecipes", icon: ChefHat, label: "New recipe matches", desc: "Alerts when pantry items unlock a recipe" },
];

function ChipGroup({ options  = [], selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            onClick={() => onToggle(o)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
              on ? "border-leaf-400 bg-leaf-400 text-white shadow-sm" : "border-line bg-white text-mist hover:border-leaf-300 hover:text-leaf-700"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export default function Settings() {
  const { profile, setProfile, targets, setTargets, prefs, setPrefs, toast, resetDemo, shopping, pantry, totals } = useApp();

  const [p, setP] = useState(profile);
  const [t, setT] = useState(targets);

  const bmi = p.weight / ((p.height / 100) ** 2);
  const bmiLabel = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy" : bmi < 30 ? "Overweight" : "Obese";
  const macroKcal = Math.round(t.protein * 4 + t.carbs * 4 + t.fat * 9);

  const toggleDiet = (v) => setP((x) => ({ ...x, diet: x.diet.includes(v) ? x.diet.filter((d) => d !== v) : [...x.diet, v] }));
  const toggleGoal = (v) => setP((x) => ({ ...x, goals: x.goals.includes(v) ? x.goals.filter((g) => g !== v) : [...x.goals, v] }));

  const saveProfile = () => {
    setProfile({ ...p, age: Number(p.age) || 0, height: Number(p.height) || 0, weight: Number(p.weight) || 0 });
    toast("Profile updated");
  };
  const saveTargets = () => {
    setTargets({
      calories: Number(t.calories) || 2000,
      protein: Number(t.protein) || 100,
      carbs: Number(t.carbs) || 250,
      fat: Number(t.fat) || 65,
      water: Number(t.water) || 2500,
    });
    toast("Nutrition targets saved");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Tune your profile, targets and preferences — everything is stored locally in the browser." />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Profile */}
        <Card className="p-5">
          <SectionTitle
            title="Profile"
            subtitle="Used to personalise targets and greetings"
            action={<Badge color="green"><Scale size={10} /> BMI {bmi.toFixed(1)} · {bmiLabel}</Badge>}
          />
          <div className="mt-4 flex items-center gap-4">
            <img src={profile.avatar} alt={profile.name} className="h-16 w-16 rounded-2xl border border-line object-cover" />
            <div>
              <p className="text-base font-extrabold text-ink">{profile.name}</p>
              <p className="text-xs font-semibold text-mist">{profile.email}</p>
              <Badge color="blue" className="mt-1.5">{profile.activity}</Badge>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Age</label>
              <input type="number" min="10" max="100" className="input" value={p.age} onChange={(e) => setP({ ...p, age: e.target.value })} />
            </div>
            <div>
              <label className="label">Activity level</label>
              <select className="input" value={p.activity} onChange={(e) => setP({ ...p, activity: e.target.value })}>
                {ACTIVITY.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Height (cm)</label>
              <input type="number" min="100" max="230" className="input" value={p.height} onChange={(e) => setP({ ...p, height: e.target.value })} />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input type="number" min="25" max="250" className="input" value={p.weight} onChange={(e) => setP({ ...p, weight: e.target.value })} />
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Dietary preferences</label>
            <ChipGroup options={DIET_OPTIONS} selected={p.diet} onToggle={toggleDiet} />
          </div>
          <div className="mt-4">
            <label className="label">Nutrition goals</label>
            <ChipGroup options={GOAL_OPTIONS} selected={p.goals} onToggle={toggleGoal} />
          </div>
          <button className="btn btn-primary btn-sm mt-5" onClick={saveProfile}>
            <Save size={14} /> Save profile
          </button>
        </Card>

        {/* Targets */}
        <Card className="p-5">
          <SectionTitle title="Nutrition targets" subtitle="Dashboards and rings track against these" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Daily calorie target (kcal)</label>
              <input type="number" step="50" min="1200" max="4500" className="input" value={t.calories} onChange={(e) => setT({ ...t, calories: e.target.value })} />
            </div>
            <div>
              <label className="label">Daily water target</label>
              <select className="input" value={t.water} onChange={(e) => setT({ ...t, water: Number(e.target.value) })}>
                {[2000, 2500, 3000, 3500].map((w) => (
                  <option key={w} value={w}>{(w / 1000).toFixed(1)} L</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {[
              { key: "protein", label: "Protein", min: 40, max: 220, step: 5, color: "#4caf50" },
              { key: "carbs", label: "Carbohydrates", min: 100, max: 420, step: 5, color: "#8bc34a" },
              { key: "fat", label: "Fat", min: 25, max: 130, step: 5, color: "#f0a13c" },
            ].map(({ key, label, min, max, step, color }) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-mist">{label}</span>
                  <span className="rounded-full bg-leaf-75 px-2.5 py-0.5 text-xs font-extrabold text-ink">{t[key]} g</span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={t[key]}
                  onChange={(e) => setT({ ...t, [key]: Number(e.target.value) })}
                  className="w-full cursor-pointer"
                  style={{ accentColor: color }}
                />
              </div>
            ))}
          </div>
          <div className={`mt-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[12px] font-semibold ${Math.abs(macroKcal - t.calories) > 260 ? "bg-amber-50 text-amber-700" : "bg-leaf-75 text-leaf-800"}`}>
            <Target size={14} className="mt-0.5 shrink-0" />
            Macro split ≈ {macroKcal} kcal
            {Math.abs(macroKcal - t.calories) > 260 ? ` — noticeably different from your ${t.calories} kcal target; adjust either side.` : " — nicely aligned with your calorie target."}
          </div>
          <button className="btn btn-primary btn-sm mt-5" onClick={saveTargets}>
            <Save size={14} /> Save targets
          </button>
        </Card>

        {/* Notifications */}
        <Card className="p-5">
          <SectionTitle title="Notifications" subtitle="Choose what NutriLens pings you about" />
          <ul className="mt-3 divide-y divide-line/70">
            {PREF_ROWS.map(({ key, icon: Icon, label, desc }) => (
              <li key={key} className="flex items-center gap-3.5 py-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-leaf-75 text-leaf-600">
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-extrabold text-ink">{label}</p>
                  <p className="text-[11.5px] font-medium text-mist">{desc}</p>
                </div>
                <Toggle checked={prefs[key]} onChange={(v) => setPrefs((pr) => ({ ...pr, [key]: v }))} />
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-mist">
            <BellRing size={12} className="text-leaf-500" /> Preferences save instantly (sample toggles — no push service yet).
          </p>
        </Card>

        {/* Data */}
        <Card className="p-5">
          <SectionTitle title="Data & demo" subtitle="LocalStorage powers this frontend demo" />
          <div className="mt-4 space-y-3 text-[12.5px] font-medium leading-relaxed text-mist">
            <p>
              Everything you log — diary entries, pantry items, shopping list and settings — is persisted in your browser so the
              demo survives refreshes. When the Flask + MySQL backend lands, these stores map 1:1 onto REST endpoints.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Pantry items", value: pantry.length },
                { label: "List items", value: shopping.length },
                { label: "Bought", value: shopping.filter((s) => s.purchased).length },
                { label: "Diary entries", value: totals.count },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-leaf-75 px-3 py-2.5 text-center">
                  <p className="text-lg leading-none font-extrabold text-ink">{s.value}</p>
                  <p className="mt-1 text-[9.5px] font-extrabold tracking-wide text-mist uppercase">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className="btn btn-danger btn-sm" onClick={resetDemo}>
              <RotateCcw size={14} /> Reset demo data
            </button>
            <span className="btn btn-soft btn-sm pointer-events-none">
              <Flame size={13} /> v1.0 demo build
            </span>
            <span className="btn btn-soft btn-sm pointer-events-none">
              <User size={13} /> Single-user profile
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
