import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Minus,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Card, EmptyState, Modal, PageHeader, fmt } from "../components/ui";
import { CATEGORY_META, PANTRY_CATEGORIES } from "../data/pantry";
import { FOODS } from "../data/foods";

const UNITS = ["pcs", "g", "kg", "ml", "L", "pack", "bunch", "jar"];
const stepFor = (unit) => (unit === "kg" || unit === "L" ? 0.5 : unit === "g" || unit === "ml" ? 50 : 1);

const EMPTY_FORM = {
  name: "",
  category: "Vegetables",
  qty: 1,
  unit: "pcs",
  purchase_date: "",
  expiry_date: "",
  notes: "",
  food_id: null,
};

function getExpiryStatus(expiryDateStr) {
  if (!expiryDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDateStr);
  exp.setHours(0, 0, 0, 0);
  const diffDays = Math.round((exp - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Expired", color: "red", days: diffDays };
  if (diffDays === 0) return { label: "Expires today", color: "red", days: 0 };
  if (diffDays <= 3) return { label: `Expires in ${diffDays}d`, color: "amber", days: diffDays };
  return { label: `Exp: ${expiryDateStr.slice(0, 10)}`, color: "neutral", days: diffDays };
}

export default function Pantry() {
  const {
    pantry,
    pantryDashboard,
    addIngredient,
    updateIngredient,
    consumeIngredient,
    removeIngredient,
    toast,
  } = useApp();

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [sortBy, setSortBy] = useState("created_desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // id when editing
  const [form, setForm] = useState(EMPTY_FORM);

  // Consume modal state
  const [consumeItem, setConsumeItem] = useState(null);
  const [consumeAmount, setConsumeAmount] = useState("");

  const activePantry = useMemo(() => pantry.filter((p) => !p.is_consumed), [pantry]);

  // Dashboard calculations
  const dashboardStats = useMemo(() => {
    let expired = 0;
    let expiringSoon = 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    activePantry.forEach((item) => {
      if (item.expiry_date) {
        const d = new Date(item.expiry_date);
        d.setHours(0, 0, 0, 0);
        const diff = Math.round((d - now) / 86400000);
        if (diff < 0) expired++;
        else if (diff <= 3) expiringSoon++;
      }
    });

    return {
      total: activePantry.length,
      expiringSoon: pantryDashboard?.expiring_soon ?? expiringSoon,
      expired: pantryDashboard?.expired ?? expired,
    };
  }, [activePantry, pantryDashboard]);

  const counts = useMemo(() => {
    const c = { All: activePantry.length };
    PANTRY_CATEGORIES.forEach((k) => (c[k] = activePantry.filter((p) => p.category === k).length));
    return c;
  }, [activePantry]);

  const visible = useMemo(() => {
    let list = activePantry.filter(
      (p) => (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(query.toLowerCase())
    );

    if (sortBy === "expiry") {
      list.sort((a, b) => {
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return new Date(a.expiry_date) - new Date(b.expiry_date);
      });
    } else if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // created_desc
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    return list;
  }, [activePantry, cat, query, sortBy]);

  // Autocomplete suggestions from FOODS
  const suggestions = useMemo(() => {
    if (!form.name.trim() || form.name.length < 2) return [];
    const q = form.name.toLowerCase();
    return FOODS.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.name_hi && f.name_hi.toLowerCase().includes(q)) ||
        (f.name_kn && f.name_kn.toLowerCase().includes(q))
    ).slice(0, 4);
  }, [form.name]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item.id);
    setForm({
      name: item.name,
      category: item.category || "Vegetables",
      qty: item.qty || item.quantity || 1,
      unit: item.unit || "pcs",
      purchase_date: item.purchase_date ? String(item.purchase_date).slice(0, 10) : "",
      expiry_date: item.expiry_date ? String(item.expiry_date).slice(0, 10) : "",
      notes: item.notes || "",
      food_id: item.food_id || null,
    });
    setModalOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      category: form.category,
      qty: Number(form.qty) || 1,
      unit: form.unit,
      purchase_date: form.purchase_date || null,
      expiry_date: form.expiry_date || null,
      notes: form.notes ? form.notes.trim() : null,
      food_id: form.food_id || null,
    };

    if (editing) {
      updateIngredient(editing, payload);
      toast("Ingredient updated");
    } else {
      addIngredient(payload);
    }
    setModalOpen(false);
  };

  const bump = (item, dir) => {
    const step = stepFor(item.unit || "pcs");
    const current = Number(item.qty || item.quantity || 1);
    const next = Math.max(step, Math.round((current + dir * step) * 10) / 10);
    updateIngredient(item.id, { qty: next, quantity: next });
  };

  const handleConsumeSubmit = () => {
    if (!consumeItem) return;
    const amt = consumeAmount ? parseFloat(consumeAmount) : null;
    consumeIngredient(consumeItem.id, amt);
    setConsumeItem(null);
    setConsumeAmount("");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Pantry"
        subtitle="Your real-time kitchen ingredient inventory — recipes and meal plans automatically sync against what you already own."
      >
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <PackagePlus size={15} /> Add ingredient
        </button>
      </PageHeader>

      {/* Pantry Dashboard Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-leaf-100 text-leaf-700">
            <Package size={20} />
          </span>
          <div>
            <p className="text-xl font-extrabold text-ink">{dashboardStats.total}</p>
            <p className="text-[11px] font-bold tracking-wide text-mist uppercase">Stocked Ingredients</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-4">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
              dashboardStats.expiringSoon > 0 ? "bg-amber-100 text-amber-600" : "bg-leaf-75 text-leaf-600"
            }`}
          >
            <Clock size={20} />
          </span>
          <div>
            <p className="text-xl font-extrabold text-ink">{dashboardStats.expiringSoon}</p>
            <p className="text-[11px] font-bold tracking-wide text-mist uppercase">Expiring in 3 Days</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-4">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
              dashboardStats.expired > 0 ? "bg-red-100 text-red-600" : "bg-leaf-75 text-leaf-600"
            }`}
          >
            <AlertTriangle size={20} />
          </span>
          <div>
            <p className="text-xl font-extrabold text-ink">{dashboardStats.expired}</p>
            <p className="text-[11px] font-bold tracking-wide text-mist uppercase">Expired Items</p>
          </div>
        </Card>
      </div>

      {/* Expiry alerts banner if items need attention */}
      {dashboardStats.expired > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-3.5 text-xs font-semibold text-red-700">
          <AlertTriangle size={16} className="shrink-0 text-red-500" />
          <span>
            You have <strong>{dashboardStats.expired} expired item(s)</strong> in your pantry. Review or discard them to keep your kitchen fresh.
          </span>
        </div>
      )}

      {/* Filter and search bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mist" />
            <input
              className="input !pl-10"
              placeholder="Search pantry ingredients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["All", ...PANTRY_CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                  cat === c
                    ? "border-leaf-400 bg-leaf-400 text-white shadow-sm"
                    : "border-line bg-white text-mist hover:border-leaf-300 hover:text-leaf-700"
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

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-mist">Sort:</span>
          <select
            className="input !py-1.5 text-xs font-bold"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="created_desc">Recently added</option>
            <option value="expiry">Expiry (Soonest)</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="No pantry ingredients found"
            text="Add ingredients from your kitchen, or mark items as purchased in your Shopping List to auto-sync."
          >
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
            const exp = getExpiryStatus(item.expiry_date);

            return (
              <Card key={item.id} hover className="flex flex-col justify-between p-4">
                <div>
                  <div className="flex items-start justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: meta.bg, color: meta.color }}>
                      <Icon size={19} />
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        className="icon-btn h-7 w-7 text-leaf-700 hover:bg-leaf-100"
                        title="Use / Consume"
                        onClick={() => {
                          setConsumeItem(item);
                          setConsumeAmount("");
                        }}
                      >
                        <UtensilsCrossed size={13} />
                      </button>
                      <button className="icon-btn h-7 w-7" onClick={() => openEdit(item)} aria-label="Edit">
                        <Pencil size={13} />
                      </button>
                      <button
                        className="icon-btn h-7 w-7 hover:bg-red-50! hover:text-red-500!"
                        onClick={() => removeIngredient(item.id)}
                        aria-label="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-[14px] font-extrabold text-ink">{item.name}</p>
                    <p className="text-[10.5px] font-bold tracking-wide text-mist uppercase">{item.category}</p>
                  </div>

                  {/* Expiry Pill */}
                  {exp && (
                    <div className="mt-2">
                      <Badge
                        color={exp.color === "red" ? "red" : exp.color === "amber" ? "amber" : "white"}
                        className="text-[10px]"
                      >
                        {exp.label}
                      </Badge>
                    </div>
                  )}

                  {item.notes && <p className="mt-1.5 text-[11px] font-medium text-mist italic">"{item.notes}"</p>}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-leaf-50 px-2 py-1.5">
                  <button className="icon-btn h-7 w-7 bg-white shadow-sm" onClick={() => bump(item, -1)} aria-label="Decrease">
                    <Minus size={13} />
                  </button>
                  <span className="text-sm font-extrabold text-ink">
                    {fmt(item.qty || item.quantity)}{" "}
                    <span className="text-[10px] font-bold text-mist">{item.unit || "pcs"}</span>
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

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Ingredient" : "Add Ingredient"}
        subtitle="Track quantities, expiry dates and purchase notes"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Ingredient Name</label>
            <input
              className="input"
              placeholder="e.g. Basmati Rice, Spinach, Olive Oil…"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, food_id: null }))}
              autoFocus
            />
            {/* Database suggestions */}
            {!editing && suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-leaf-700">
                  <Sparkles size={12} /> Food DB match:
                </span>
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        name: s.name,
                        category: s.category || f.category,
                        food_id: s.id,
                      }))
                    }
                    className="rounded-lg bg-leaf-100 px-2 py-0.5 text-xs font-bold text-leaf-800 transition hover:bg-leaf-200"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Category</label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {PANTRY_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: c }))}
                  className={`rounded-xl border px-2 py-2 text-xs font-bold transition-all ${
                    form.category === c
                      ? "border-leaf-400 bg-leaf-75 text-leaf-700"
                      : "border-line bg-white text-mist hover:border-leaf-300"
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
              <input
                type="number"
                min="0.1"
                step="any"
                className="input"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              />
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Purchase Date (Optional)</label>
              <input
                type="date"
                className="input"
                value={form.purchase_date}
                onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Expiry Date (Optional)</label>
              <input
                type="date"
                className="input"
                value={form.expiry_date}
                onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Notes / Storage Location (Optional)</label>
            <input
              className="input"
              placeholder="e.g. Top shelf, opened container"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button className="btn btn-primary flex-1" onClick={save}>
              {editing ? "Save changes" : "Add to pantry"}
            </button>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Consume Modal */}
      <Modal
        open={!!consumeItem}
        onClose={() => setConsumeItem(null)}
        title={`Use ${consumeItem?.name || "Ingredient"}`}
        subtitle={`Current stock: ${fmt(consumeItem?.qty || consumeItem?.quantity)} ${consumeItem?.unit || "pcs"}`}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Amount used</label>
            <input
              type="number"
              min="0.1"
              step="any"
              className="input"
              placeholder={`e.g. 100 (${consumeItem?.unit || "pcs"}) — leave blank to consume all`}
              value={consumeAmount}
              onChange={(e) => setConsumeAmount(e.target.value)}
              autoFocus
            />
            <p className="mt-1 text-[11px] font-semibold text-mist">
              Leave blank to mark the entire quantity as consumed.
            </p>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button className="btn btn-primary flex-1" onClick={handleConsumeSubmit}>
              <Check size={15} /> Confirm use
            </button>
            <button className="btn btn-outline" onClick={() => setConsumeItem(null)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
