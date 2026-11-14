import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  FlaskConical,
  CloudSun,
  ScanLine,
  Package,
  ChefHat,
  ShoppingCart,
  Settings,
  Leaf,
  X,
  Droplets,
  Plus,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { ProgressBar } from "./ui";

export const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/nutrition", label: "My Nutrition", icon: UtensilsCrossed },
  { to: "/lab-reports", label: "Lab Reports", icon: FlaskConical },
  { to: "/weather", label: "Weather Intelligence", icon: CloudSun },
  { to: "/scanner", label: "Food Scanner", icon: ScanLine },
  { to: "/pantry", label: "My Pantry", icon: Package },
  { to: "/recipes", label: "Recipe Recommendations", icon: ChefHat },
  { to: "/shopping", label: "Shopping List", icon: ShoppingCart },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ open, onClose }) {
  const { water, targets, addWater } = useApp();
  const waterPct = Math.min(100, Math.round((water / targets.water) * 100));

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-line bg-leaf-75 transition-transform duration-300 ease-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-leaf-400 to-leaf-600 text-white shadow-lg shadow-leaf-400/30">
            <Leaf size={20} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-[19px] leading-tight font-semibold tracking-tight text-leaf-800">NutriSense</p>
            <p className="text-[9.5px] font-bold tracking-[0.14em] text-leaf-600/80 uppercase">Smart Nutrition Engine</p>
          </div>
          <button className="icon-btn ml-auto lg:hidden" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3.5 pb-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-leaf-400 text-white shadow-md shadow-leaf-400/35"
                    : "text-leaf-800/65 hover:bg-leaf-100 hover:text-leaf-800"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} strokeWidth={2.2} className={isActive ? "" : "text-leaf-600/70 group-hover:text-leaf-700"} />
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Hydration mini widget */}
        <div className="mx-3.5 mb-3 rounded-2xl border border-leaf-200/70 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <Droplets size={14} className="text-leaf-500" /> Hydration
            </div>
            <span className="text-[10px] font-bold text-mist">{waterPct}%</span>
          </div>
          <div className="mt-2.5">
            <ProgressBar value={water} max={targets.water} height={6} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-mist">
              <span className="font-extrabold text-ink">{(water / 1000).toFixed(1)} L</span> of {(targets.water / 1000).toFixed(1)} L
            </p>
            <button className="btn btn-xs btn-soft" onClick={() => addWater(250)}>
              <Plus size={12} /> 250 ml
            </button>
          </div>
        </div>

        <p className="px-5 pb-5 text-[10px] font-semibold tracking-wide text-leaf-700/50">
          NutriSense Platform v1.0
        </p>
      </aside>
    </>
  );
}
