import { CheckCircle2, CircleAlert, Clock, Flame, ListPlus, Users, Zap } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Modal, ProgressBar } from "./ui";

export default function RecipeModal({ recipe, onClose }) {
  const { recipeStats, addMissingToShopping } = useApp();
  if (!recipe) return null;
  const stats = recipeStats(recipe);

  return (
    <Modal open={!!recipe} onClose={onClose} title={recipe.name} subtitle={`${recipe.time} min · ${recipe.servings} serving${recipe.servings > 1 ? "s" : ""} · ${recipe.tags.join(" · ")}`} maxW="max-w-2xl">
      <img src={recipe.image} alt={recipe.name} className="h-48 w-full rounded-2xl border border-line object-cover sm:h-56" />

      {/* Macros */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { icon: Flame, label: "Calories", value: `${recipe.calories}`, unit: "kcal" },
          { icon: Zap, label: "Protein", value: `${recipe.protein}`, unit: "g" },
          { icon: Clock, label: "Carbs", value: `${recipe.carbs || 0}`, unit: "g" },
          { icon: Users, label: "Fat", value: `${recipe.fat || 0}`, unit: "g" },
        ].map(({ icon: Icon, label, value, unit }) => (
          <div key={label} className="rounded-xl bg-leaf-75 px-3 py-2.5 text-center">
            <Icon size={14} className="mx-auto text-leaf-500" />
            <p className="mt-1 text-lg leading-none font-extrabold text-ink">
              {value} <span className="text-[10px] font-bold text-mist">{unit}</span>
            </p>
            <p className="mt-0.5 text-[10px] font-bold tracking-wide text-mist uppercase">{label}</p>
          </div>
        ))}
      </div>

      {/* Pantry availability & Match Percentage */}
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
          <span className="text-ink">Pantry Match</span>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-leaf-100 px-2 py-0.5 text-[11px] font-extrabold text-leaf-800">
              {Math.round((stats.have / stats.total) * 100)}% Match
            </span>
            <span className="text-leaf-600">
              {stats.have}/{stats.total} ingredients
            </span>
          </div>
        </div>
        <ProgressBar value={stats.have} max={stats.total} height={7} />
      </div>

      {/* Ingredients */}
      <p className="mt-5 mb-2 text-[11px] font-extrabold tracking-[0.12em] text-mist uppercase">Ingredients</p>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {recipe.ingredients.map((ing) => {
          const ok = stats.isAvailable(ing.match);
          return (
            <div key={ing.name} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
              {ok ? <CheckCircle2 size={15} className="shrink-0 text-leaf-500" /> : <CircleAlert size={15} className="shrink-0 text-amber-500" />}
              <span className={`text-[12.5px] font-semibold ${ok ? "text-ink" : "text-ink"}`}>
                {ing.name} <span className="font-medium text-mist">· {ing.qty}</span>
              </span>
              {!ok && (
                <Badge color="amber" className="ml-auto shrink-0">
                  Missing
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Steps */}
      <p className="mt-5 mb-2 text-[11px] font-extrabold tracking-[0.12em] text-mist uppercase">Method</p>
      <ol className="space-y-2.5">
        {recipe.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-leaf-100 text-[11px] font-extrabold text-leaf-700">{i + 1}</span>
            <p className="pt-0.5 text-[13px] leading-relaxed font-medium text-ink/85">{step}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <button
          className="btn btn-primary"
          disabled={stats.missing.length === 0}
          onClick={() => {
            addMissingToShopping(stats.missing, recipe.name);
            onClose();
          }}
        >
          <ListPlus size={16} />
          {stats.missing.length > 0 ? `Add ${stats.missing.length} missing to shopping list` : "All ingredients in pantry"}
        </button>
        <button className="btn btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
