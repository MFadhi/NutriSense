import { useEffect, useMemo, useState } from "react";
import { Minus, PackagePlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Card, EmptyState, Modal, PageHeader, fmt } from "../components/ui";
import { CATEGORY_META, PANTRY_CATEGORIES } from "../data/pantry";

const UNITS = ["pcs", "g", "kg", "ml", "L", "bunch", "pack", "jar"];
const stepFor = (unit) => (unit === "kg" || unit === "L" ? 0.5 : unit === "g" || unit === "ml" ? 50 : 1);

const EMPTY_FORM = { name: "", category: "Vegetables", qty: 1, unit: "pcs" };

export default function Pantry() {
  const { pantry, addIngredient, updateIngredient, removeIngredient, toast } = useApp();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // id when editing
  const [form, setForm] = useState(EMPTY_FORM);

  const counts = useMemo(() => {
    const c = { All: pantry.length };
    PANTRY_CATEGORIES.forEach((k) => (c[k] = pantry.filter((p) => p.category === k).length));
    return c;
  }, [pantry]);

  const visible = pantry.filter((p) => (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(query.toLowerCase()));

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm({ name: item.name, category: item.category, qty: item.qty, unit: item.unit });
    setModalOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), category: form.category, qty: Number(form.qty) || 1, unit: form.unit };
    if (editing) {
      updateIngredient(editing, payload);
      toast("Ingredient updated");
    } else {
      addIngredient(payload);
    }
    setModalOpen(false);
  };

  const bump = (item, dir) => {
    const step = stepFor(item.unit);
    const next = Math.max(step, Math.round((item.qty + dir * step) * 10) / 10);
    updateIngredient(item.id, { qty: next });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="My Pantry" subtitle="Your ingredient inventory — recipes are matched against what you already have.">
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <PackagePlus size={15} /> Add ingredient
        </button>
      </PageHeader>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mist" />
          <input className="input !pl-10" placeholder="Search ingredients…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["All", ...PANTRY_CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                cat === c ? "border-leaf-400 bg-leaf-400 text-white shadow-sm" : "border-line bg-white text-mist hover:border-leaf-300 hover:text-leaf-700"
              }`}
            >
              {c}
              <span className={`rounded-full px-1.5 text-[10px] font-extrabold ${cat === c ? "bg-white/25" : "bg-leaf-100 text-leaf-700"}`}>
                {counts[c] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="Nothing found" text="Try a different search or category, or add a new ingredient.">
            <button className="btn btn-soft btn-sm" onClick={openAdd}>
              <Plus size={13} /> Add ingredient
            </button>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => {
            const meta = CATEGORY_META[item.category] || CATEGORY_META.Others;
            const Icon = meta.icon;
            return (
              <Card key={item.id} hover className="flex flex-col p-4">
                <div className="flex items-start justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: meta.bg, color: meta.color }}>
                    <Icon size={19} />
                  </span>
                  <div className="flex gap-1">
                    <button className="icon-btn h-7 w-7" onClick={() => openEdit(item)} aria-label="Edit">
                      <Pencil size={13} />
                    </button>
                    <button className="icon-btn h-7 w-7 hover:bg-red-50! hover:text-red-500!" onClick={() => removeIngredient(item.id)} aria-label="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-[14px] font-extrabold text-ink">{item.name}</p>
                <p className="text-[10.5px] font-bold tracking-wide text-mist uppercase">{item.category}</p>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-leaf-50 px-2 py-1.5">
                  <button className="icon-btn h-7 w-7 bg-white shadow-sm" onClick={() => bump(item, -1)} aria-label="Decrease">
                    <Minus size={13} />
                  </button>
                  <span className="text-sm font-extrabold text-ink">
                    {fmt(item.qty)} <span className="text-[10px] font-bold text-mist">{item.unit}</span>
                  </span>
                  <button className="icon-btn h-7 w-7 bg-white shadow-sm" onClick={() => bump(item, 1)} aria-label="Increase">
                    <Plus size={13} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit ingredient" : "Add ingredient"} subtitle="Track what is stocked in your kitchen">
        <div className="space-y-4">
          <div>
            <label className="label">Ingredient name</label>
            <input className="input" placeholder="e.g. Quinoa" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="label">Category</label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {PANTRY_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, category: c }))}
                  className={`rounded-xl border px-2 py-2 text-xs font-bold transition-all ${
                    form.category === c ? "border-leaf-400 bg-leaf-75 text-leaf-700" : "border-line bg-white text-mist hover:border-leaf-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantity</label>
              <input type="number" min="0" step="any" className="input" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2.5 pt-1">
            <button className="btn btn-primary flex-1" onClick={save}>
              {editing ? "Save changes" : "Add to pantry"}
            </button>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
