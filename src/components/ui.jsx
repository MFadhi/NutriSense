import { useEffect } from "react";
import { X } from "lucide-react";
import { FOOD_ICONS } from "../data/foods";

export function Card({ className = "", hover = false, children, ...rest }) {
  return (
    <div className={`card ${hover ? "card-hover" : ""} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-xl text-sm leading-relaxed text-mist">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-bold tracking-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-mist">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const BADGE_COLORS = {
  green: "bg-leaf-100 text-leaf-700 border-leaf-200",
  amber: "bg-amber-50 text-amber-600 border-amber-200",
  red: "bg-red-50 text-red-500 border-red-200",
  blue: "bg-sky-50 text-sky-600 border-sky-200",
  gray: "bg-slate-100 text-slate-500 border-slate-200",
  white: "bg-white/90 text-ink border-white/40 backdrop-blur",
};
export function Badge({ color = "green", className = "", children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${BADGE_COLORS[color]} ${className}`}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, max, color = "var(--color-leaf-400)", height = 8, track = "var(--color-leaf-100)" }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height, background: track }}>
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Ring({ value, max, size = 160, stroke = 13, color = "var(--color-leaf-400)", track = "var(--color-leaf-100)", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, maxW = "max-w-lg" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[3px]" onClick={onClose} />
      <div className={`modal-panel relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-2xl ${maxW}`}>
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
          <div>
            <h3 className="text-lg font-extrabold tracking-tight text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-mist">{subtitle}</p>}
          </div>
          <button className="icon-btn shrink-0" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-6 pt-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-300 ${checked ? "bg-leaf-500" : "bg-slate-200"}`}
      aria-pressed={checked}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}

export function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-leaf-75 text-leaf-400">
        <Icon size={24} />
      </div>
      <p className="text-sm font-bold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-xs text-xs leading-relaxed text-mist">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function ChartTooltip({ active, payload, label, unit = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-lg">
      {label != null && <p className="mb-1 text-[11px] font-bold text-mist">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-bold" style={{ color: p.color || "#263238" }}>
          {p.name}: {p.value}
          {unit}
        </p>
      ))}
    </div>
  );
}

/** Food thumbnail — photo when available, otherwise a themed icon tile. */
export function Thumb({ item, size = 44, className = "" }) {
  if (item?.image) {
    return (
      <img
        src={item.image}
        alt={item.name}
        loading="lazy"
        className={`shrink-0 rounded-xl object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const Icon = (item?.iconKey && FOOD_ICONS[item.iconKey]) || FOOD_ICONS.food;
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-xl border border-leaf-100 bg-leaf-75 text-leaf-500 ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.45)} />
    </div>
  );
}

export const fmt = (n) => String(Math.round(n));
