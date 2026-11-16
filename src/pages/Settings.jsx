import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  BellRing,
  ChefHat,
  CloudSun,
  Droplets,
  FileText,
  Flame,
  Loader2,
  RotateCcw,
  Save,
  Scale,
  ShieldAlert,
  Target,
  User,
  Utensils,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Card, PageHeader, SectionTitle, Toggle } from "../components/ui";
import { getMe, updateMe } from "../api/me";
import { getDailyDashboard } from "../api/dashboard";
import { localToday } from "../utils/date";

const DIET_OPTIONS = ["Vegetarian", "Vegan", "Non-vegetarian", "Eggetarian"];
const GOAL_OPTIONS = ["maintain", "lose", "gain"];
const GOAL_LABELS = {
  maintain: "Maintain weight",
  lose: "Lose fat (-500 kcal)",
  gain: "Build muscle (+300 kcal)",
};

const ACTIVITY_MAP = [
  { id: "sedentary", label: "Sedentary (desk job, little exercise)" },
  { id: "light", label: "Lightly active (1-3 days/week)" },
  { id: "moderate", label: "Moderately active (3-5 days/week)" },
  { id: "active", label: "Very active (6-7 days/week)" },
  { id: "very_active", label: "Extra active / Athlete" },
];

const PREF_ROWS = [
  { key: "mealReminders", icon: Utensils, label: "Meal logging reminders", desc: "Nudges at breakfast, lunch and dinner time" },
  { key: "hydrationAlerts", icon: Droplets, label: "Hydration alerts", desc: "Reminders when you fall behind on water" },
  { key: "weatherUpdates", icon: CloudSun, label: "Weather-based tips", desc: "Morning advice tuned to the day's forecast" },
  { key: "weeklyReport", icon: FileText, label: "Weekly nutrition report", desc: "A Sunday summary of your intake trends" },
  { key: "newRecipes", icon: ChefHat, label: "New recipe matches", desc: "Alerts when pantry items unlock a recipe" },
];

export default function Settings() {
  const { profile, setProfile, targets, setTargets, prefs, setPrefs, toast, resetDemo, shopping, pantry, totals, auth } = useApp();
  const isAuthenticated = auth?.isAuthenticated;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [missingFields, setMissingFields] = useState([]);

  // Form states matching API
  const [heightCm, setHeightCm] = useState(profile.height || 170);
  const [weightKg, setWeightKg] = useState(profile.weight || 65);
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [dietType, setDietType] = useState("veg");
  const [goal, setGoal] = useState("maintain");
  const [sex, setSex] = useState("other");
  const [dob, setDob] = useState("1995-01-01");
  const [email, setEmail] = useState(profile.email || "");

  // Fetch from API
  const fetchSettings = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    setMissingFields([]);

    try {
      const meData = await getMe();
      if (meData) {
        setEmail(meData.email || "");
        const p = meData.profile || {};
        if (p.height_cm) setHeightCm(p.height_cm);
        if (p.weight_kg) setWeightKg(p.weight_kg);
        if (p.activity_level) setActivityLevel(p.activity_level);
        if (p.diet_type) setDietType(p.diet_type);
        if (p.goal) setGoal(p.goal);
        if (p.sex) setSex(p.sex);
        if (p.dob) setDob(p.dob);
      }

      // Try fetching dashboard daily to see calculated targets or missing fields
      try {
        const daily = await getDailyDashboard(localToday());
        if (daily?.targets) {
          setTargets({
            calories: daily.targets.kcal || 2000,
            protein: daily.targets.protein_g || 100,
            carbs: daily.targets.carbs_g || 250,
            fat: daily.targets.fat_g || 65,
            water: daily.targets.water_ml || 2500,
          });
        }
      } catch (dashErr) {
        if (dashErr.code === "profile_incomplete" || dashErr.status === 409) {
          setMissingFields(dashErr.details?.missing_fields || ["profile fields"]);
        }
      }
    } catch (err) {
      setError(err?.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setTargets]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      height_cm: Number(heightCm) || undefined,
      weight_kg: Number(weightKg) || undefined,
      activity_level: activityLevel,
      diet_type: dietType,
      goal,
      sex,
      dob: dob || undefined,
    };

    if (isAuthenticated) {
      try {
        await updateMe(payload);
        toast("Profile updated successfully!");
        setMissingFields([]);
        // Re-fetch targets
        try {
          const daily = await getDailyDashboard(localToday());
          if (daily?.targets) {
            setTargets({
              calories: daily.targets.kcal || 2000,
              protein: daily.targets.protein_g || 100,
              carbs: daily.targets.carbs_g || 250,
              fat: daily.targets.fat_g || 65,
              water: daily.targets.water_ml || 2500,
            });
          }
        } catch (dashErr) {
          if (dashErr.code === "profile_incomplete" || dashErr.status === 409) {
            setMissingFields(dashErr.details?.missing_fields || []);
          }
        }
      } catch (err) {
        if (err.code === "profile_incomplete" || err.status === 409) {
          setMissingFields(err.details?.missing_fields || []);
          toast("Please fill all required profile fields.");
        } else {
          setError(err?.message || "Failed to save profile.");
        }
      } finally {
        setSaving(false);
      }
    } else {
      // Local demo mode save
      setProfile((prev) => ({
        ...prev,
        height: Number(heightCm),
        weight: Number(weightKg),
      }));
      setSaving(false);
      toast("Profile updated (local)");
    }
  };

  const bmi = weightKg / ((heightCm / 100) ** 2);
  const bmiLabel = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy" : bmi < 30 ? "Overweight" : "Obese";
  const macroKcal = Math.round(targets.protein * 4 + targets.carbs * 4 + targets.fat * 9);

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Tune your profile, calculate personal targets and manage preferences." />

      {/* Profile Incomplete Banner */}
      {missingFields.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-semibold text-amber-800 shadow-sm">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-extrabold text-amber-900">Profile Incomplete</p>
            <p className="mt-0.5 leading-relaxed">
              To calculate accurate Mifflin-St Jeor targets, please complete the required fields:{" "}
              <span className="font-extrabold">{missingFields.join(", ")}</span>.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-600">
          <span>{error}</span>
          <button onClick={fetchSettings} className="btn btn-xs btn-outline min-h-[36px]">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-leaf-500" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {/* Profile Card */}
          <Card className="p-5">
            <SectionTitle
              title="Profile & Biometrics"
              subtitle="Used to calculate MSJ BMR and calorie targets"
              action={<Badge color="green"><Scale size={10} /> BMI {bmi.toFixed(1)} · {bmiLabel}</Badge>}
            />

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Account Email</label>
                  <input className="input bg-slate-50 text-mist" value={email} disabled />
                </div>
                <div>
                  <label className="label">Date of Birth</label>
                  <input
                    type="date"
                    className={`input ${missingFields.includes("dob") ? "border-amber-400 bg-amber-50/50" : ""}`}
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Biological Sex</label>
                  <select
                    className={`input ${missingFields.includes("sex") ? "border-amber-400 bg-amber-50/50" : ""}`}
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                  >
                    <option value="male">Male (+5 kcal)</option>
                    <option value="female">Female (-161 kcal)</option>
                    <option value="other">Other (-78 kcal)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Goal</label>
                  <select
                    className={`input ${missingFields.includes("goal") ? "border-amber-400 bg-amber-50/50" : ""}`}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  >
                    {GOAL_OPTIONS.map((g) => (
                      <option key={g} value={g}>{GOAL_LABELS[g]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Height (cm)</label>
                  <input
                    type="number"
                    min="100"
                    max="250"
                    className={`input ${missingFields.includes("height_cm") ? "border-amber-400 bg-amber-50/50" : ""}`}
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Weight (kg)</label>
                  <input
                    type="number"
                    min="25"
                    max="300"
                    step="0.5"
                    className={`input ${missingFields.includes("weight_kg") ? "border-amber-400 bg-amber-50/50" : ""}`}
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Activity Level</label>
                <select
                  className={`input ${missingFields.includes("activity_level") ? "border-amber-400 bg-amber-50/50" : ""}`}
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value)}
                >
                  {ACTIVITY_MAP.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Dietary Preference</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { id: "veg", label: "Vegetarian" },
                    { id: "vegan", label: "Vegan" },
                    { id: "eggetarian", label: "Eggetarian" },
                    { id: "nonveg", label: "Non-Veg" },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDietType(d.id)}
                      className={`flex h-10 items-center justify-center rounded-xl border text-xs font-bold transition-all min-h-[44px] ${
                        dietType === d.id
                          ? "border-leaf-400 bg-leaf-100 text-leaf-800 shadow-xs"
                          : "border-line bg-white text-mist hover:border-leaf-200 hover:text-ink"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary btn-sm min-h-[44px] px-4"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Save size={14} /> Save Profile & Recalculate
                  </span>
                )}
              </button>
            </form>
          </Card>

          {/* Targets Card (Calculated from Backend) */}
          <Card className="p-5">
            <SectionTitle
              title="Personal Nutrition Targets"
              subtitle="Computed with Mifflin-St Jeor equation by backend"
            />
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-line bg-leaf-50 p-4">
                  <p className="text-xs font-bold text-mist">Daily Energy Budget</p>
                  <p className="mt-1 text-2xl font-extrabold text-ink">{targets.calories} <span className="text-xs font-bold text-mist">kcal</span></p>
                </div>
                <div className="rounded-2xl border border-line bg-leaf-50 p-4">
                  <p className="text-xs font-bold text-mist">Daily Water Target</p>
                  <p className="mt-1 text-2xl font-extrabold text-ink">{(targets.water / 1000).toFixed(1)} <span className="text-xs font-bold text-mist">L</span></p>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-white p-4 space-y-3">
                <p className="text-xs font-extrabold tracking-wide text-ink uppercase">Macro Breakdown</p>
                {[
                  { label: "Protein", grams: targets.protein, color: "#4caf50", kcal: targets.protein * 4 },
                  { label: "Carbohydrates", grams: targets.carbs, color: "#8bc34a", kcal: targets.carbs * 4 },
                  { label: "Fat", grams: targets.fat, color: "#f0a13c", kcal: targets.fat * 9 },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between border-b border-dashed border-line pb-2 last:border-0 last:pb-0">
                    <span className="flex items-center gap-2 text-xs font-bold text-ink">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                      {m.label}
                    </span>
                    <span className="text-xs font-extrabold text-ink">
                      {m.grams} g <span className="text-[10px] text-mist font-normal">({m.kcal} kcal)</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-leaf-75 px-3.5 py-2.5 text-[12px] font-semibold text-leaf-800">
                <Target size={14} className="mt-0.5 shrink-0 text-leaf-600" />
                Target split: {targets.protein}g protein (1.6g/kg), {targets.fat}g fat (25% kcal), and remaining in carbs.
              </div>
            </div>
          </Card>

          {/* Preferences */}
          <Card className="p-5">
            <SectionTitle title="Notifications" subtitle="Choose what NutriSense pings you about" />
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
          </Card>

          {/* Data & Reset */}
          <Card className="p-5">
            <SectionTitle title="Data & Storage" subtitle="Manage your application data and local storage" />
            <div className="mt-4 space-y-3 text-[12.5px] font-medium leading-relaxed text-mist">
              <p>Everything you log is synced with your NutriLens account.</p>
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
              <button className="btn btn-danger btn-sm min-h-[44px]" onClick={resetDemo}>
                <RotateCcw size={14} /> Clear stored data
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
