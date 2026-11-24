import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, Flame, ListChecks, Zap } from "lucide-react";
import { useApp } from "../context/AppContext";
import RecipeModal from "../components/RecipeModal";
import { Badge, Card, PageHeader, ProgressBar } from "../components/ui";
import { RECIPES } from "../data/recipes";

const FILTERS = [
  { id: "all", label: "All recipes" },
  { id: "ready", label: "Ready to cook" },
  { id: "quick", label: "Under 30 min" },
  { id: "protein", label: "High protein" },
];

export default function Recipes() {
  const { recipeStats, addMissingToShopping } = useApp();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  /* Deep link from global search */
  useEffect(() => {
    if (location.state?.openRecipe) {
      const r = RECIPES.find((x) => x.id === location.state.openRecipe);
      if (r) setSelected(r);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const stats = useMemo(() => Object.fromEntries(RECIPES.map((r) => [r.id, recipeStats(r)])), [recipeStats]);

  const visible = RECIPES.filter((r) => {
    const s = stats[r.id];
    if (filter === "ready") return s.ready;
    if (filter === "quick") return r.time <= 30;
    if (filter === "protein") return r.protein >= 20;
    return true;
  });

  const generateList = () => {
    const allMissing = RECIPES.flatMap((r) => stats[r.id].missing);
    const unique = Object.values(Object.fromEntries(allMissing.map((m) => [m.name.toLowerCase(), m])));
    addMissingToShopping(unique, "Recipe plan");
  };

  const totalMissing = Object.values(stats).reduce((a, s) => a + s.missing.length, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Recipe Recommendations" subtitle="Matched to the ingredients already in your pantry — cook more, waste less.">
        <button className="btn btn-outline btn-sm" onClick={generateList}>
          <ListChecks size={15} /> Generate shopping list
          {totalMissing > 0 && <span className="rounded-full bg-leaf-100 px-1.5 text-[10px] font-extrabold text-leaf-700">{totalMissing}</span>}
        </button>
      </PageHeader>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
              filter === f.id ? "border-leaf-400 bg-leaf-400 text-white shadow-sm" : "border-line bg-white text-mist hover:border-leaf-300 hover:text-leaf-700"
            }`}
          >
            {f.label}
            {f.id === "ready" && <span className={`ml-1.5 rounded-full px-1.5 text-[10px] font-extrabold ${filter === "ready" ? "bg-white/25" : "bg-leaf-100 text-leaf-700"}`}>{RECIPES.filter((r) => stats[r.id]?.ready).length}</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((r) => {
          const s = stats[r.id];
          return (
            <Card key={r.id} hover className="flex flex-col overflow-hidden">
              <button className="relative block h-44 w-full" onClick={() => setSelected(r)}>
                <img src={r.image} alt={r.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" />
                <span className="absolute top-3 right-3">
                  <Badge color="white">
                    <Flame size={10} /> {r.calories} kcal
                  </Badge>
                </span>
                {s.ready ? (
                  <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-leaf-400 px-2.5 py-1 text-[10px] font-extrabold text-white shadow-md">
                    <CheckCircle2 size={11} /> Ready to cook
                  </span>
                ) : (
                  <span className="absolute top-3 left-3 rounded-full bg-ink/55 px-2.5 py-1 text-[10px] font-extrabold text-white backdrop-blur">
                    {s.missing.length} missing
                  </span>
                )}
                <span className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[11px] font-bold text-white">
                  <Clock size={11} /> {r.time} min · <Zap size={11} /> {r.protein} g protein
                </span>
              </button>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[15px] font-extrabold tracking-tight text-ink line-clamp-1" title={r.name}>{r.name}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-mist truncate">{r.tags.join(" · ")}</p>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[10.5px] font-extrabold">
                    <span className="text-mist uppercase tracking-wide">Pantry match ({Math.round((s.have / s.total) * 100)}%)</span>
                    <span className="text-leaf-600 font-extrabold">{s.have}/{s.total}</span>
                  </div>
                  <ProgressBar value={s.have} max={s.total} height={6} />
                </div>
                <div className="mt-3 min-h-[26px] flex flex-wrap items-center gap-1.5">
                  {s.missing.length > 0 ? (
                    <>
                      {s.missing.slice(0, 2).map((m) => (
                        <Badge key={m.name} color="amber">{m.name}</Badge>
                      ))}
                      {s.missing.length > 2 && <Badge color="gray">+{s.missing.length - 2} more</Badge>}
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-leaf-600">
                      <CheckCircle2 size={12} /> All ingredients in pantry
                    </span>
                  )}
                </div>
                <div className="mt-auto pt-4">
                  <button className="btn btn-outline btn-sm w-full font-bold" onClick={() => setSelected(r)}>
                    View recipe
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {visible.length === 0 && (
        <Card>
          <p className="py-10 text-center text-sm font-semibold text-mist">No recipes match this filter right now.</p>
        </Card>
      )}

      <RecipeModal recipe={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
