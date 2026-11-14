import { useMemo, useState } from "react";
import { Check, Plus, RefreshCw, ShoppingBasket, Trash2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Card, EmptyState, PageHeader, ProgressBar, SectionTitle } from "../components/ui";
import { RECIPES } from "../data/recipes";
import { CATEGORY_META, PANTRY_CATEGORIES } from "../data/pantry";

export default function ShoppingList() {
  const {
    shopping,
    addShoppingItem,
    toggleShoppingItem,
    removeShoppingItem,
    clearPurchased,
    addMissingToShopping,
    recipeStats,
    toast,
  } = useApp();
  const [name, setName] = useState("");
  const [cat, setCat] = useState("Vegetables");
  const [qty, setQty] = useState("1 unit");

  const purchased = shopping.filter((x) => x.purchased).length;
  const total = shopping.length;

  const grouped = useMemo(() => {
    const map = {};
    for (const c of PANTRY_CATEGORIES) map[c] = [];
    for (const item of shopping) (map[item.category] || map.Others).push(item);
    return map;
  }, [shopping]);

  const add = () => {
    if (!name.trim()) return;
    addShoppingItem({ name: name.trim(), category: cat, qty: qty.trim() || "1 unit" });
    toast(`${name.trim()} added to list`);
    setName("");
    setQty("1 unit");
  };

  const regenerate = () => {
    const missing = RECIPES.flatMap((r) => recipeStats(r).missing);
    const unique = Object.values(Object.fromEntries(missing.map((m) => [m.name.toLowerCase(), m])));
    addMissingToShopping(unique, "Recipe plan");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Shopping List" subtitle="Missing recipe ingredients land here automatically — tick them off at the store.">
        <button className="btn btn-outline btn-sm" onClick={regenerate}>
          <RefreshCw size={14} /> Pull from recipes
        </button>
        <button className="btn btn-ghost btn-sm" onClick={clearPurchased} disabled={purchased === 0}>
          <Trash2 size={14} /> Clear bought
        </button>
      </PageHeader>

      {/* Progress */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-leaf-100 text-leaf-600">
            <ShoppingBasket size={19} />
          </span>
          <div className="min-w-[180px] flex-1">
            <div className="mb-1.5 flex justify-between text-xs font-extrabold">
              <span className="text-mist uppercase tracking-wide">Shopping progress</span>
              <span className="text-leaf-600">
                {purchased} of {total} bought
              </span>
            </div>
            <ProgressBar value={purchased} max={Math.max(1, total)} height={9} />
          </div>
          <p className="text-[11px] font-semibold text-mist">{total - purchased > 0 ? `${total - purchased} item${total - purchased === 1 ? "" : "s"} left to buy` : "All done — happy cooking!"}</p>
        </div>
      </Card>

      {/* Add row */}
      <Card className="p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input className="input flex-1" placeholder="Add an item — e.g. Quinoa" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <div className="flex gap-2.5">
            <select className="input sm:w-36" value={cat} onChange={(e) => setCat(e.target.value)}>
              {PANTRY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input className="input w-28" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
            <button className="btn btn-primary" onClick={add}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      </Card>

      {/* List */}
      {total === 0 ? (
        <Card>
          <EmptyState icon={ShoppingBasket} title="List is empty" text="Add items manually or pull missing ingredients from your recommended recipes.">
            <button className="btn btn-soft btn-sm" onClick={regenerate}>
              <RefreshCw size={13} /> Pull from recipes
            </button>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {PANTRY_CATEGORIES.filter((c) => grouped[c].length > 0).map((c) => {
            const meta = CATEGORY_META[c];
            const Icon = meta.icon;
            return (
              <Card key={c} className="p-4">
                <div className="flex items-center gap-2.5 px-1 pt-1 pb-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: meta.bg, color: meta.color }}>
                    <Icon size={15} />
                  </span>
                  <SectionTitle title={c} />
                  <span className="ml-auto rounded-full bg-leaf-75 px-2 py-0.5 text-[10px] font-extrabold text-leaf-700">{grouped[c].length}</span>
                </div>
                <ul className="space-y-1">
                  {grouped[c].map((item) => (
                    <li key={item.id} className={`group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-leaf-50 ${item.purchased ? "opacity-55" : ""}`}>
                      <button
                        onClick={() => toggleShoppingItem(item.id)}
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all ${
                          item.purchased ? "border-leaf-500 bg-leaf-500 text-white" : "border-line bg-white text-transparent hover:border-leaf-400"
                        }`}
                        aria-label={item.purchased ? "Mark as not bought" : "Mark as bought"}
                      >
                        <Check size={13} strokeWidth={3} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[13px] font-bold ${item.purchased ? "text-mist line-through" : "text-ink"}`}>{item.name}</p>
                        {item.source && <p className="text-[10px] font-semibold text-mist">for {item.source}</p>}
                      </div>
                      {item.purchased && <span className="rounded-full bg-leaf-100 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-leaf-700 uppercase">Bought</span>}
                      <span className="text-[11px] font-extrabold text-mist">{item.qty}</span>
                      <button
                        className="icon-btn h-7 w-7 text-mist/60 opacity-0 group-hover:opacity-100 hover:bg-red-50! hover:text-red-500!"
                        onClick={() => removeShoppingItem(item.id)}
                        aria-label="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
