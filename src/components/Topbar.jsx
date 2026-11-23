import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BellRing,
  ChevronDown,
  ChefHat,
  CloudSun,
  Droplets,
  FileText,
  LogIn,
  LogOut,
  Menu,
  RotateCcw,
  Search,
  Settings,
  UtensilsCrossed,
  User,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { FOODS } from "../data/foods";
import { RECIPES } from "../data/recipes";
import { WEATHER } from "../services/weather";
import { NAV } from "./Sidebar";
import { Thumb } from "./ui";
import AuthModal from "./AuthModal";

const NOTIF_ICONS = { droplets: Droplets, chef: ChefHat, file: FileText };

function useOutside(ref, onClose) {
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

export default function Topbar({ onMenu }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, notifications, unreadCount, markAllRead, resetDemo, auth, authModalOpen, setAuthModalOpen, logout } = useApp();

  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  useOutside(searchRef, () => setSearchOpen(false));
  useOutside(notifRef, () => setNotifOpen(false));
  useOutside(profileRef, () => setProfileOpen(false));

  const pageTitle = (NAV.find((n) => (n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to))) || {}).label || "Dashboard";

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return { foods: [], recipes: [] };
    return {
      foods: FOODS.filter((f) => `${f.name} ${f.category}`.toLowerCase().includes(query)).slice(0, 4),
      recipes: RECIPES.filter((r) => r.name.toLowerCase().includes(query)).slice(0, 3),
    };
  }, [q]);
  const hasResults = results.foods.length > 0 || results.recipes.length > 0;

  const openFood = (food) => {
    setSearchOpen(false);
    setQ("");
    navigate("/nutrition", { state: { addFood: food.id } });
  };
  const openRecipe = (recipe) => {
    setSearchOpen(false);
    setQ("");
    navigate("/recipes", { state: { openRecipe: recipe.id } });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-leaf-50/85 backdrop-blur-md">
      <div className="flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button className="icon-btn lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu size={20} />
        </button>

        <p className="hidden text-sm font-extrabold tracking-tight text-ink md:block">{pageTitle}</p>

        {/* Search */}
        <div ref={searchRef} className="relative order-4 w-full sm:order-none sm:mx-auto sm:w-auto sm:flex-1 sm:max-w-md">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mist z-10" />
          <input
            className="input !pl-11"
            style={{ paddingLeft: "2.75rem" }}
            placeholder="Search foods, recipes…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
          />
          {searchOpen && q.trim().length >= 2 && (
            <div className="dropdown absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
              {hasResults ? (
                <div className="max-h-80 overflow-y-auto p-2">
                  {results.foods.length > 0 && (
                    <>
                      <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-extrabold tracking-[0.12em] text-mist uppercase">Foods</p>
                      {results.foods.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => openFood(f)}
                          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-leaf-75"
                        >
                          <Thumb item={f} size={34} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold text-ink">{f.name}</span>
                            <span className="block text-[11px] font-medium text-mist">{f.category} · {f.calories} kcal</span>
                          </span>
                          <UtensilsCrossed size={13} className="text-leaf-400" />
                        </button>
                      ))}
                    </>
                  )}
                  {results.recipes.length > 0 && (
                    <>
                      <p className="px-2.5 pt-2.5 pb-1 text-[10px] font-extrabold tracking-[0.12em] text-mist uppercase">Recipes</p>
                      {results.recipes.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => openRecipe(r)}
                          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-leaf-75"
                        >

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold text-ink">{r.name}</span>
                            <span className="block text-[11px] font-medium text-mist">{r.time} min · {r.calories} kcal</span>
                          </span>
                          <ChefHat size={13} className="text-leaf-400" />
                        </button>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <p className="px-4 py-5 text-center text-xs font-semibold text-mist">No matches for “{q}” in the sample data.</p>
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:ml-0 sm:gap-2">
          {/* Weather chip */}
          <button
            onClick={() => navigate("/weather")}
            className="hidden items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-leaf-700 shadow-sm transition-all hover:border-leaf-300 hover:bg-leaf-75 md:flex"
          >
            <CloudSun size={15} className="text-leaf-500" />
            {WEATHER.temp}°C · Pune
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button className="icon-btn relative border border-line bg-white shadow-sm" onClick={() => setNotifOpen((o) => !o)} aria-label="Notifications">
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-leaf-500 text-[8px] font-extrabold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="dropdown absolute top-full right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <p className="text-sm font-extrabold text-ink">Notifications</p>
                  <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-bold text-leaf-600 hover:text-leaf-700">
                    <BellRing size={12} /> Mark all read
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto p-1.5">
                  {notifications.map((n) => {
                    const Icon = NOTIF_ICONS[n.icon] || Bell;
                    return (
                      <div key={n.id} className={`flex items-start gap-3 rounded-xl px-2.5 py-2.5 ${n.read ? "opacity-60" : "bg-leaf-75/60"}`}>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-leaf-100 text-leaf-600">
                          <Icon size={14} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12.5px] font-bold text-ink">{n.title}</span>
                          <span className="block text-[11.5px] leading-snug text-mist">{n.desc}</span>
                          <span className="mt-0.5 block text-[10px] font-bold tracking-wide text-leaf-500 uppercase">{n.time}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Profile / Auth */}
          {auth?.isAuthenticated ? (
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-white py-1.5 pr-2.5 pl-1.5 shadow-sm transition-all hover:border-leaf-300 hover:bg-leaf-75"
              >
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-leaf-100 text-leaf-700">
                  <User size={15} />
                </div>
                <span className="hidden text-xs font-extrabold text-ink sm:block">{profile.name.split(" ")[0]}</span>
                <ChevronDown size={13} className="text-mist" />
              </button>
              {profileOpen && (
                <div className="dropdown absolute top-full right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
                  <div className="border-b border-line px-4 py-3">
                    <p className="truncate text-sm font-extrabold text-ink">{profile.name}</p>
                    <p className="truncate text-[11px] font-medium text-mist">{profile.email}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        navigate("/settings");
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-leaf-75"
                    >
                      <Settings size={14} className="text-leaf-500" /> Profile & settings
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        navigate("/nutrition");
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-leaf-75"
                    >
                      <User size={14} className="text-leaf-500" /> My food diary
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-bold text-red-500 transition-colors hover:bg-red-50"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="btn btn-sm btn-primary shadow-xs"
            >
              <LogIn size={14} /> Sign In
            </button>
          )}
        </div>
      </div>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </header>
  );
}
