import { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  Sparkles,
  RefreshCw,
  Bookmark,
  CheckCircle2,
  Utensils,
  ChevronRight,
  SlidersHorizontal,
  FolderOpen,
  ArrowRightLeft,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Info,
  Trash2,
  Check,
  Star,
  Clock,
  Plus,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Card, PageHeader, ProgressBar, SectionTitle, Modal } from "../components/ui";
import {
  generateDailyPlan,
  generateWeeklyPlan,
  replaceMeal,
  saveMealPlan,
  listMealPlans,
  setActiveMealPlan,
  deleteMealPlan,
  getMealPreferences,
  updateMealPreferences,
} from "../api/mealPlanner";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function MealPlanner() {
  const { toast } = useApp();

  const [viewMode, setViewMode] = useState("weekly"); // weekly | daily
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [dailyPlan, setDailyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Swap modal state
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapMealKey, setSwapMealKey] = useState(null);
  const [swapAlternatives, setSwapAlternatives] = useState([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  // Save plan modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  // Saved plans drawer
  const [savedPlansOpen, setSavedPlansOpen] = useState(false);
  const [savedPlansList, setSavedPlansList] = useState([]);
  const [loadingSavedPlans, setLoadingSavedPlans] = useState(false);

  // Preferences modal
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const [plannerPrefs, setPlannerPrefs] = useState({
    meals_per_day: 4,
    include_snacks: true,
    diet_type: "veg",
    allergies: [],
  });

  // Initial load
  useEffect(() => {
    loadPreferencesAndGenerate();
  }, []);

  const loadPreferencesAndGenerate = async () => {
    setLoading(true);
    try {
      const prefs = await getMealPreferences().catch(() => null);
      if (prefs) setPlannerPrefs(prefs);
      const wPlan = await generateWeeklyPlan();
      setWeeklyPlan(wPlan);
    } catch (err) {
      toast(err?.message || "Failed to generate initial plan.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWeekly = async () => {
    setGenerating(true);
    try {
      const wPlan = await generateWeeklyPlan();
      setWeeklyPlan(wPlan);
      setViewMode("weekly");
      toast("Generated fresh 7-day personalized meal plan!");
    } catch (err) {
      toast(err?.message || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateDaily = async () => {
    setGenerating(true);
    try {
      const dPlan = await generateDailyPlan({ day: "Today" });
      setDailyPlan(dPlan);
      setViewMode("daily");
      toast("Generated personalized daily plan!");
    } catch (err) {
      toast(err?.message || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  // Meal replacement
  const handleOpenSwapModal = async (mealKey, mealObj) => {
    setSwapMealKey(mealKey);
    setSwapModalOpen(true);
    setLoadingAlternatives(true);
    try {
      const foodId = mealObj.items?.[0]?.food_id || 0;
      const res = await replaceMeal({
        meal_key: mealKey,
        exclude_food_id: foodId,
        target_kcal: mealObj.target_kcal || 600,
      });
      setSwapAlternatives(res.alternatives || []);
    } catch (err) {
      toast(err?.message || "Failed to load meal alternatives.");
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const handleApplySwap = (newMeal) => {
    if (viewMode === "weekly" && weeklyPlan) {
      const copy = { ...weeklyPlan };
      const currentDay = copy.days[selectedDayIdx];
      currentDay.meals[swapMealKey] = newMeal;

      // Recalculate day totals
      currentDay.totals.kcal = Math.round(
        Object.values(currentDay.meals).reduce((s, m) => s + (m.total_kcal || 0), 0)
      );
      currentDay.totals.protein_g = Math.round(
        Object.values(currentDay.meals).reduce((s, m) => s + (m.total_protein_g || 0), 0)
      );
      currentDay.totals.carbs_g = Math.round(
        Object.values(currentDay.meals).reduce((s, m) => s + (m.total_carbs_g || 0), 0)
      );
      currentDay.totals.fat_g = Math.round(
        Object.values(currentDay.meals).reduce((s, m) => s + (m.total_fat_g || 0), 0)
      );
      setWeeklyPlan(copy);
    } else if (viewMode === "daily" && dailyPlan) {
      const copy = { ...dailyPlan };
      copy.meals[swapMealKey] = newMeal;
      copy.totals.kcal = Math.round(
        Object.values(copy.meals).reduce((s, m) => s + (m.total_kcal || 0), 0)
      );
      copy.totals.protein_g = Math.round(
        Object.values(copy.meals).reduce((s, m) => s + (m.total_protein_g || 0), 0)
      );
      copy.totals.carbs_g = Math.round(
        Object.values(copy.meals).reduce((s, m) => s + (m.total_carbs_g || 0), 0)
      );
      copy.totals.fat_g = Math.round(
        Object.values(copy.meals).reduce((s, m) => s + (m.total_fat_g || 0), 0)
      );
      setDailyPlan(copy);
    }

    setSwapModalOpen(false);
    toast("Meal swapped successfully!");
  };

  // Save plan
  const handleSavePlanSubmit = async (e) => {
    e.preventDefault();
    if (!planTitle.trim()) return;

    setSavingPlan(true);
    try {
      const payload = {
        title: planTitle.trim(),
        plan_type: viewMode,
        plan_data: viewMode === "weekly" ? weeklyPlan : dailyPlan,
        totals:
          viewMode === "weekly"
            ? weeklyPlan?.averages
            : dailyPlan?.totals,
      };
      await saveMealPlan(payload);
      toast(`Saved "${planTitle}" to your meal plans!`);
      setSaveModalOpen(false);
      setPlanTitle("");
    } catch (err) {
      toast(err?.message || "Failed to save meal plan.");
    } finally {
      setSavingPlan(false);
    }
  };

  // Saved plans management
  const handleOpenSavedPlans = async () => {
    setSavedPlansOpen(true);
    setLoadingSavedPlans(true);
    try {
      const plans = await listMealPlans();
      setSavedPlansList(plans || []);
    } catch (err) {
      toast(err?.message || "Failed to load saved plans.");
    } finally {
      setLoadingSavedPlans(false);
    }
  };

  const handleSetActive = async (planId) => {
    try {
      await setActiveMealPlan(planId);
      setSavedPlansList((prev) =>
        prev.map((p) => ({ ...p, is_active: p.id === planId }))
      );
      toast("Plan marked as active!");
    } catch (err) {
      toast(err?.message || "Failed to set active plan.");
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm("Are you sure you want to delete this saved plan?")) return;
    try {
      await deleteMealPlan(planId);
      setSavedPlansList((prev) => prev.filter((p) => p.id !== planId));
      toast("Meal plan deleted.");
    } catch (err) {
      toast(err?.message || "Failed to delete plan.");
    }
  };

  const handleLoadSavedPlan = (plan) => {
    if (plan.plan_type === "weekly") {
      setWeeklyPlan(plan.plan_data);
      setViewMode("weekly");
    } else {
      setDailyPlan(plan.plan_data);
      setViewMode("daily");
    }
    setSavedPlansOpen(false);
    toast(`Loaded "${plan.title}"!`);
  };

  // Preferences update
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    try {
      await updateMealPreferences(plannerPrefs);
      toast("Preferences updated! Re-generating plan...");
      setPrefsModalOpen(false);
      handleGenerateWeekly();
    } catch (err) {
      toast(err?.message || "Failed to save preferences.");
    }
  };

  // Compute active day display
  const currentDayData =
    viewMode === "weekly"
      ? weeklyPlan?.days?.[selectedDayIdx]
      : dailyPlan;

  const currentTargets =
    viewMode === "weekly" ? weeklyPlan?.targets : dailyPlan?.targets;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personalized Meal Planner"
        subtitle="Intelligent meal schedules balanced for macros, diet preferences, and clinical lab findings."
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPrefsModalOpen(true)}
            className="btn btn-outline btn-xs"
          >
            <SlidersHorizontal size={13} className="mr-1" /> Preferences
          </button>
          <button
            onClick={handleOpenSavedPlans}
            className="btn btn-outline btn-xs"
          >
            <FolderOpen size={13} className="mr-1" /> Saved Plans
          </button>
          <button
            onClick={() => {
              setPlanTitle(
                `${viewMode === "weekly" ? "Weekly" : "Daily"} Plan - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              );
              setSaveModalOpen(true);
            }}
            className="btn btn-soft btn-xs text-leaf-700"
          >
            <Bookmark size={13} className="mr-1" /> Save Plan
          </button>
          <button
            onClick={viewMode === "weekly" ? handleGenerateWeekly : handleGenerateDaily}
            disabled={generating}
            className="btn btn-primary btn-xs shadow-xs"
          >
            <RefreshCw size={13} className={`mr-1 ${generating ? "animate-spin" : ""}`} />
            Regenerate
          </button>
        </div>
      </PageHeader>

      {/* Plan Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("weekly")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              viewMode === "weekly"
                ? "bg-leaf-500 text-white shadow-md shadow-leaf-500/25"
                : "bg-white text-mist hover:bg-leaf-50 hover:text-ink"
            }`}
          >
            <CalendarDays size={14} className="mr-1.5 inline" /> 7-Day Weekly Plan
          </button>
          <button
            onClick={() => {
              if (!dailyPlan) handleGenerateDaily();
              else setViewMode("daily");
            }}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              viewMode === "daily"
                ? "bg-leaf-500 text-white shadow-md shadow-leaf-500/25"
                : "bg-white text-mist hover:bg-leaf-50 hover:text-ink"
            }`}
          >
            <Utensils size={14} className="mr-1.5 inline" /> Single Day Plan
          </button>
        </div>

        {plannerPrefs.diet_type && (
          <div className="flex items-center gap-1.5 text-xs text-mist">
            <span>Diet:</span>
            <Badge color={plannerPrefs.diet_type === "veg" ? "green" : "blue"}>
              {plannerPrefs.diet_type}
            </Badge>
            {plannerPrefs.allergies?.length > 0 && (
              <Badge color="red">
                No: {plannerPrefs.allergies.join(", ")}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Weekly Day Tabs */}
      {viewMode === "weekly" && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {DAYS_OF_WEEK.map((dayName, idx) => {
            const isSelected = selectedDayIdx === idx;
            const dayTotals = weeklyPlan?.days?.[idx]?.totals;
            return (
              <button
                key={dayName}
                onClick={() => setSelectedDayIdx(idx)}
                className={`flex min-w-[110px] flex-col items-center rounded-2xl border p-2.5 text-center transition-all ${
                  isSelected
                    ? "border-leaf-500 bg-leaf-500 text-white shadow-md shadow-leaf-500/25"
                    : "border-line bg-white text-mist hover:border-leaf-200 hover:text-ink"
                }`}
              >
                <span className="text-xs font-bold">{dayName}</span>
                <span className={`mt-0.5 text-[10px] font-semibold ${isSelected ? "text-leaf-100" : "text-mist"}`}>
                  {dayTotals ? `${dayTotals.kcal} kcal` : "..."}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <Card className="flex min-h-[350px] items-center justify-center p-8">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-leaf-500 border-t-transparent" />
            <p className="mt-3 text-xs font-semibold text-mist">Personalizing meals from Indian food database...</p>
          </div>
        </Card>
      ) : !currentDayData ? (
        <Card className="p-8 text-center text-xs text-mist">
          No meal plan loaded. Click "Regenerate" above to generate your plan.
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Day Nutritional Targets vs Actual */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <p className="text-sm font-extrabold text-ink">
                  {currentDayData.day} Nutritional Balance
                </p>
                <p className="text-xs text-mist">
                  Target: {currentTargets?.kcal || 2000} kcal · Planned:{" "}
                  <span className="font-extrabold text-leaf-600">{currentDayData.totals.kcal} kcal</span>
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 font-bold text-ink">
                  <Beef size={14} className="text-leaf-600" /> {currentDayData.totals.protein_g}g Protein
                </span>
                <span className="flex items-center gap-1 font-bold text-ink">
                  <Wheat size={14} className="text-amber-500" /> {currentDayData.totals.carbs_g}g Carbs
                </span>
                <span className="flex items-center gap-1 font-bold text-ink">
                  <Droplet size={14} className="text-orange-500" /> {currentDayData.totals.fat_g}g Fat
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-line bg-leaf-50/20 p-2.5">
                <span className="text-[10px] font-bold text-mist uppercase">Calories</span>
                <p className="mt-0.5 text-base font-extrabold text-ink">{currentDayData.totals.kcal} kcal</p>
                <ProgressBar
                  value={currentDayData.totals.kcal}
                  max={currentTargets?.kcal || 2000}
                  height={5}
                />
              </div>
              <div className="rounded-xl border border-line bg-leaf-50/20 p-2.5">
                <span className="text-[10px] font-bold text-mist uppercase">Protein</span>
                <p className="mt-0.5 text-base font-extrabold text-leaf-600">{currentDayData.totals.protein_g}g</p>
                <ProgressBar
                  value={currentDayData.totals.protein_g}
                  max={currentTargets?.protein_g || 85}
                  height={5}
                />
              </div>
              <div className="rounded-xl border border-line bg-leaf-50/20 p-2.5">
                <span className="text-[10px] font-bold text-mist uppercase">Carbohydrates</span>
                <p className="mt-0.5 text-base font-extrabold text-ink">{currentDayData.totals.carbs_g}g</p>
                <ProgressBar
                  value={currentDayData.totals.carbs_g}
                  max={currentTargets?.carbs_g || 250}
                  height={5}
                />
              </div>
              <div className="rounded-xl border border-line bg-leaf-50/20 p-2.5">
                <span className="text-[10px] font-bold text-mist uppercase">Healthy Fats</span>
                <p className="mt-0.5 text-base font-extrabold text-ink">{currentDayData.totals.fat_g}g</p>
                <ProgressBar
                  value={currentDayData.totals.fat_g}
                  max={currentTargets?.fat_g || 60}
                  height={5}
                />
              </div>
            </div>
          </Card>

          {/* Meals Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(currentDayData.meals || {}).map(([mKey, meal]) => (
              <Card key={mKey} className="flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between border-b border-line pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold tracking-wide text-leaf-800 uppercase">
                          {meal.label}
                        </span>
                        {meal.has_lab_insight && (
                          <Badge color="blue">
                            <Sparkles size={10} className="mr-1 inline" /> Lab Aligned
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-mist">
                        {meal.total_kcal} kcal · {meal.total_protein_g}g protein
                      </p>
                    </div>

                    <button
                      onClick={() => handleOpenSwapModal(mKey, meal)}
                      className="btn btn-outline btn-xs text-mist hover:text-ink"
                      title="Replace with alternative meal"
                    >
                      <ArrowRightLeft size={11} className="mr-1" /> Swap
                    </button>
                  </div>

                  {/* Food Items */}
                  <div className="mt-3.5 space-y-3">
                    {meal.items?.map((item, iIdx) => (
                      <div key={iIdx} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-ink">
                            {item.food_name}
                            {item.food_name_hi && (
                              <span className="ml-1.5 text-xs font-normal text-mist">
                                ({item.food_name_hi})
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-mist">
                            Portion: <span className="font-semibold text-ink">{item.portion_label}</span> ({item.portion_grams}g)
                          </p>
                        </div>
                        <Badge color={item.diet === "veg" ? "green" : item.diet === "vegan" ? "blue" : "amber"}>
                          {item.diet}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reason footer */}
                <div className="mt-4 rounded-xl bg-leaf-50/40 p-2.5 border border-leaf-100 text-[11px] text-leaf-800">
                  <Info size={12} className="mr-1 inline text-leaf-600" />
                  {meal.reason}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* SWAP MEAL MODAL */}
      <Modal
        open={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        title={`Swap ${swapMealKey ? swapMealKey.toUpperCase() : "Meal"}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-mist">
            Choose an alternative meal tailored to your nutritional targets and dietary preferences:
          </p>

          {loadingAlternatives ? (
            <div className="py-8 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-leaf-500 border-t-transparent" />
              <p className="mt-2 text-xs text-mist">Finding eligible replacements...</p>
            </div>
          ) : swapAlternatives.length === 0 ? (
            <p className="text-xs text-mist">No alternatives found for current constraints.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {swapAlternatives.map((alt, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-line bg-white p-3.5 transition-all hover:border-leaf-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-ink">
                        {alt.items?.[0]?.food_name}
                      </p>
                      <p className="text-[11px] text-mist">
                        {alt.total_kcal} kcal · {alt.total_protein_g}g protein · {alt.items?.[0]?.portion_label}
                      </p>
                    </div>
                    <button
                      onClick={() => handleApplySwap(alt)}
                      className="btn btn-primary btn-xs shadow-xs"
                    >
                      Select
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-leaf-700 italic">{alt.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* SAVE PLAN MODAL */}
      <Modal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save Meal Plan"
      >
        <form onSubmit={handleSavePlanSubmit} className="space-y-4">
          <p className="text-xs text-mist">
            Save this plan snapshot to your personal library to reuse anytime.
          </p>
          <div>
            <label className="label">Plan Title</label>
            <input
              type="text"
              required
              className="input"
              placeholder="e.g. High Protein Week"
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSaveModalOpen(false)}
              className="btn btn-outline btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingPlan}
              className="btn btn-primary btn-sm shadow-xs"
            >
              {savingPlan ? "Saving..." : "Save to Library"}
            </button>
          </div>
        </form>
      </Modal>

      {/* SAVED PLANS DRAWER */}
      <Modal
        open={savedPlansOpen}
        onClose={() => setSavedPlansOpen(false)}
        title="Your Saved Meal Plans"
      >
        <div className="space-y-3">
          {loadingSavedPlans ? (
            <div className="py-8 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-leaf-500 border-t-transparent" />
            </div>
          ) : savedPlansList.length === 0 ? (
            <p className="py-6 text-center text-xs text-mist">No saved meal plans yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {savedPlansList.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-white p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-ink truncate">{plan.title}</p>
                      {plan.is_active && (
                        <Badge color="green">Active</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-mist">
                      {plan.plan_type} · {plan.total_kcal ? `${Math.round(plan.total_kcal)} kcal avg` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleLoadSavedPlan(plan)}
                      className="btn btn-soft btn-xs"
                      title="Load this plan"
                    >
                      Load
                    </button>
                    {!plan.is_active && (
                      <button
                        onClick={() => handleSetActive(plan.id)}
                        className="btn btn-outline btn-xs"
                        title="Set active"
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Delete plan"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* PREFERENCES MODAL */}
      <Modal
        open={prefsModalOpen}
        onClose={() => setPrefsModalOpen(false)}
        title="Meal Planning Preferences"
      >
        <form onSubmit={handleSavePreferences} className="space-y-4">
          <div>
            <label className="label">Dietary Preference</label>
            <select
              className="input"
              value={plannerPrefs.diet_type || "veg"}
              onChange={(e) =>
                setPlannerPrefs({ ...plannerPrefs, diet_type: e.target.value })
              }
            >
              <option value="veg">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="eggetarian">Eggetarian</option>
              <option value="nonveg">Non-Vegetarian</option>
            </select>
          </div>

          <div>
            <label className="label">Meals Per Day</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setPlannerPrefs({ ...plannerPrefs, meals_per_day: 3, include_snacks: false })
                }
                className={`rounded-xl border p-2 text-xs font-bold ${
                  plannerPrefs.meals_per_day === 3
                    ? "border-leaf-500 bg-leaf-50 text-leaf-800"
                    : "border-line bg-white text-mist"
                }`}
              >
                3 Meals (No Snacks)
              </button>
              <button
                type="button"
                onClick={() =>
                  setPlannerPrefs({ ...plannerPrefs, meals_per_day: 4, include_snacks: true })
                }
                className={`rounded-xl border p-2 text-xs font-bold ${
                  plannerPrefs.meals_per_day === 4
                    ? "border-leaf-500 bg-leaf-50 text-leaf-800"
                    : "border-line bg-white text-mist"
                }`}
              >
                4 Meals (With Snacks)
              </button>
            </div>
          </div>

          {plannerPrefs.allergies?.length > 0 && (
            <div className="rounded-xl bg-red-50 p-3 border border-red-200 text-xs text-red-700">
              <p className="font-bold">Active Allergy Restrictions (from Profile):</p>
              <p className="mt-0.5">{plannerPrefs.allergies.join(", ")}</p>
              <p className="mt-1 text-[10px] text-red-600">These ingredients are strictly excluded from all recommendations.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPrefsModalOpen(false)}
              className="btn btn-outline btn-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm shadow-xs">
              Save & Apply
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
