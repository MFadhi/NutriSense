import { useMemo, useState } from "react";
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  Package,
  Plus,
  RefreshCw,
  ShoppingBasket,
  Trash2,
  Undo2,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Card, EmptyState, Modal, PageHeader, ProgressBar } from "../components/ui";
import { RECIPES } from "../data/recipes";
import { CATEGORY_META, PANTRY_CATEGORIES } from "../data/pantry";

const UNITS = ["pcs", "g", "kg", "ml", "L", "pack", "bunch", "jar"];

export default function ShoppingList() {
  const {
    shopping,
    pantry,
    addShoppingItem,
    removeShoppingItem,
    clearPurchased,
    addMissingToShopping,
    recipeStats,
    purchaseGroceryItemAndSync,
    unpurchaseGroceryItem,
    correctGroceryPurchase,
    toast,
  } = useApp();

  const [name, setName] = useState("");
  const [cat, setCat] = useState("Vegetables");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("pcs");

  // Purchase Confirmation Modal State
  const [purchaseItem, setPurchaseItem] = useState(null);
  const [confirmQty, setConfirmQty] = useState("1");
  const [confirmUnit, setConfirmUnit] = useState("pcs");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Correct Purchase Modal State
  const [correctItem, setCorrectItem] = useState(null);
  const [newCorrectQty, setNewCorrectQty] = useState("");

  const purchasedCount = shopping.filter((x) => x.purchased || x.is_purchased).length;
  const totalCount = shopping.length;

  const grouped = useMemo(() => {
    const map = {};
    for (const c of PANTRY_CATEGORIES) map[c] = [];
    for (const item of shopping) {
      const c = item.category || "Others";
      if (!map[c]) map[c] = [];
      map[c].push(item);
    }
    return map;
  }, [shopping]);

  const add = () => {
    if (!name.trim()) return;
    addShoppingItem({
      name: name.trim(),
      category: cat,
      qty: confirmQty ? `${qty} ${unit}`.trim() : "1 unit",
      unit,
      source: "Manual entry",
    });
    setName("");
    setQty("1");
    setUnit("pcs");
  };

  const regenerate = () => {
    const missing = RECIPES.flatMap((r) => recipeStats(r).missing);
    const unique = Object.values(Object.fromEntries(missing.map((m) => [m.name.toLowerCase(), m])));
    addMissingToShopping(unique, "Recipe Recommendations");
  };

  // Open the purchase confirmation modal
  const openPurchaseModal = (item) => {
    setPurchaseItem(item);
    // Parse quantity
    const rawQty = item.quantity || parseFloat(item.qty) || 1;
    setConfirmQty(String(rawQty));
    setConfirmUnit(item.unit || (typeof item.qty === "string" && item.qty.includes(" ") ? item.qty.split(" ").slice(1).join(" ") : "pcs"));
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setExpiryDate("");
    setPurchaseNotes("");
  };

  const handleConfirmPurchase = async () => {
    if (!purchaseItem) return;
    setSubmitting(true);
    try {
      await purchaseGroceryItemAndSync(purchaseItem.id, {
        purchased_quantity: parseFloat(confirmQty) || 1,
        unit: confirmUnit,
        purchase_date: purchaseDate || null,
        expiry_date: expiryDate || null,
        notes: purchaseNotes || null,
      });
      setPurchaseItem(null);
    } catch (err) {
      toast(err.message || "Failed to confirm purchase");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCorrectSubmit = async () => {
    if (!correctItem || !newCorrectQty) return;
    try {
      await correctGroceryPurchase(correctItem.id, parseFloat(newCorrectQty));
      setCorrectItem(null);
      setNewCorrectQty("");
    } catch (err) {
      toast(err.message || "Correction failed");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Smart Shopping List"
        subtitle="Missing meal & recipe ingredients land here. Marking items as bought automatically synchronizes to your kitchen pantry inventory."
      >
        <button className="btn btn-outline btn-sm" onClick={regenerate}>
          <RefreshCw size={14} /> Pull from recipes
        </button>
        <button className="btn btn-ghost btn-sm" onClick={clearPurchased} disabled={purchasedCount === 0}>
          <Trash2 size={14} /> Clear bought
        </button>
      </PageHeader>

      {/* Progress Card */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-leaf-100 text-leaf-700">
            <ShoppingBasket size={19} />
          </span>
          <div className="min-w-[180px] flex-1">
            <div className="mb-1.5 flex justify-between text-xs font-extrabold">
              <span className="text-mist uppercase tracking-wide">Shopping Progress</span>
              <span className="text-leaf-600">
                {purchasedCount} of {totalCount} bought
              </span>
            </div>
            <ProgressBar value={purchasedCount} max={Math.max(1, totalCount)} height={9} />
          </div>
          <p className="text-[11px] font-semibold text-mist">
            {totalCount - purchasedCount > 0
              ? `${totalCount - purchasedCount} item${totalCount - purchasedCount === 1 ? "" : "s"} left to buy`
              : "All done — stocked in pantry!"}
          </p>
        </div>
      </Card>

      {/* Quick Add Form */}
      <Card className="p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="Add an item — e.g. Quinoa, Almonds, Greek Yogurt…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <div className="flex flex-wrap gap-2">
            <select className="input sm:w-36" value={cat} onChange={(e) => setCat(e.target.value)}>
              {PANTRY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              min="0.1"
              step="any"
              className="input w-20"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
            />
            <select className="input w-24" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={add}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      </Card>

      {/* Grouped Shopping List */}
      {totalCount === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingBasket}
            title="Your shopping list is empty"
            text="Add ingredients manually or pull missing items directly from your recommended recipes and meal plans."
          >
            <button className="btn btn-soft btn-sm" onClick={regenerate}>
              <RefreshCw size={13} /> Pull from recipes
            </button>
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          {PANTRY_CATEGORIES.map((category) => {
            const items = grouped[category] || [];
            if (items.length === 0) return null;
            const meta = CATEGORY_META[category] || CATEGORY_META.Others;
            const Icon = meta.icon;

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ background: meta.bg, color: meta.color }}>
                    <Icon size={14} />
                  </span>
                  <h3 className="text-xs font-extrabold tracking-wider text-mist uppercase">{category}</h3>
                  <span className="text-[11px] font-bold text-mist">({items.length})</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((item) => {
                    const isBought = item.purchased || item.is_purchased;
                    // Find if there's a matching pantry stock
                    const inPantry = pantry.find((p) => p.name.toLowerCase() === item.name.toLowerCase() && !p.is_consumed);

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition-all ${
                          isBought ? "border-leaf-200 bg-leaf-50/50 opacity-80" : "border-line bg-white hover:border-leaf-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Checkbox triggers Purchase Confirmation */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isBought) {
                                unpurchaseGroceryItem(item.id);
                              } else {
                                openPurchaseModal(item);
                              }
                            }}
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition-all ${
                              isBought
                                ? "border-leaf-500 bg-leaf-500 text-white shadow-sm"
                                : "border-line bg-white text-transparent hover:border-leaf-400"
                            }`}
                            title={isBought ? "Click to unpurchase" : "Confirm purchase & sync to pantry"}
                          >
                            <Check size={14} className={isBought ? "stroke-[3]" : ""} />
                          </button>

                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-[13.5px] font-bold truncate ${
                                isBought ? "text-mist line-through" : "text-ink"
                              }`}
                            >
                              {item.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-mist">
                              <span>
                                {item.purchased_quantity
                                  ? `${item.purchased_quantity} ${item.unit || ""}`
                                  : item.qty || `${item.quantity || 1} ${item.unit || "pcs"}`}
                              </span>
                              {item.notes && <span>· {item.notes}</span>}
                              {isBought && inPantry && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-leaf-700">
                                  <Package size={11} /> Stock: {inPantry.quantity || inPantry.qty} {inPantry.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isBought ? (
                            <>
                              <button
                                className="icon-btn h-7 w-7 text-mist hover:text-leaf-700"
                                title="Correct purchase quantity"
                                onClick={() => {
                                  setCorrectItem(item);
                                  setNewCorrectQty(String(item.purchased_quantity || item.quantity || 1));
                                }}
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                className="icon-btn h-7 w-7 text-mist hover:text-amber-600"
                                title="Mark as unpurchased"
                                onClick={() => unpurchaseGroceryItem(item.id)}
                              >
                                <Undo2 size={12} />
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-soft btn-xs text-leaf-700"
                              onClick={() => openPurchaseModal(item)}
                            >
                              <CheckCircle2 size={12} /> Buy
                            </button>
                          )}
                          <button
                            className="icon-btn h-7 w-7 text-mist hover:text-red-500"
                            onClick={() => removeShoppingItem(item.id)}
                            title="Remove from list"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Automatic Grocery-to-Pantry Purchase Confirmation Modal */}
      <Modal
        open={!!purchaseItem}
        onClose={() => setPurchaseItem(null)}
        title="Confirm Purchase & Sync to Pantry"
        subtitle={`Synchronize "${purchaseItem?.name}" directly to your kitchen pantry inventory.`}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-leaf-200 bg-leaf-50/70 p-3 text-xs font-semibold text-leaf-800">
            Confirming this purchase will automatically update your pantry stock inside an atomic database transaction.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Purchased Quantity</label>
              <input
                type="number"
                min="0.1"
                step="any"
                className="input"
                value={confirmQty}
                onChange={(e) => setConfirmQty(e.target.value)}
                autoFocus
              />
              <p className="mt-1 text-[10.5px] font-semibold text-mist">Supports partial purchases</p>
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={confirmUnit} onChange={(e) => setConfirmUnit(e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Purchase Date</label>
              <input
                type="date"
                className="input"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Expiry Date (Optional)</label>
              <input
                type="date"
                className="input"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Notes (Optional)</label>
            <input
              className="input"
              placeholder="e.g. Bought at Farmers Market, Brand name"
              value={purchaseNotes}
              onChange={(e) => setPurchaseNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button className="btn btn-primary flex-1" onClick={handleConfirmPurchase} disabled={submitting}>
              <Check size={16} /> {submitting ? "Synchronizing…" : "Confirm & Add to Pantry"}
            </button>
            <button className="btn btn-outline" onClick={() => setPurchaseItem(null)} disabled={submitting}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Correct Purchase Quantity Modal */}
      <Modal
        open={!!correctItem}
        onClose={() => setCorrectItem(null)}
        title="Correct Purchase Quantity"
        subtitle={`Adjust recorded quantity for "${correctItem?.name}" without duplicate additions.`}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Correct Quantity ({correctItem?.unit || "pcs"})</label>
            <input
              type="number"
              min="0.1"
              step="any"
              className="input"
              value={newCorrectQty}
              onChange={(e) => setNewCorrectQty(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button className="btn btn-primary flex-1" onClick={handleCorrectSubmit}>
              Save Correction
            </button>
            <button className="btn btn-outline" onClick={() => setCorrectItem(null)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
