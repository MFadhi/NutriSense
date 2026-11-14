import { useState } from "react";
import { Lock, Mail, User, Eye, EyeOff, LogIn, UserPlus, CheckCircle2, ShieldCheck } from "lucide-react";
import { Modal } from "./ui";
import { useApp } from "../context/AppContext";
import { apiLogin, apiRegister } from "../services/api";

const DIET_OPTIONS = [
  { id: "veg", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "eggetarian", label: "Eggetarian" },
  { id: "nonveg", label: "Non-Veg" },
];

export default function AuthModal({ open, onClose }) {
  const { login, toast } = useApp();
  const [tab, setTab] = useState("login"); // "login" | "register"
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [diet, setDiet] = useState("veg");

  const resetForm = () => {
    setError("");
    setEmail("");
    setPassword("");
    setName("");
  };

  const handleSwitchTab = (newTab) => {
    setTab(newTab);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      if (tab === "login") {
        const res = await apiLogin(email.trim(), password);
        login(res.access_token, res.refresh_token, res.user);
        toast(`Welcome back, ${res.user.email.split("@")[0]}!`);
        resetForm();
        onClose();
      } else {
        await apiRegister(email.trim(), password, name.trim(), diet);
        const loginRes = await apiLogin(email.trim(), password);
        login(loginRes.access_token, loginRes.refresh_token, {
          ...loginRes.user,
          name: name.trim() || loginRes.user.email.split("@")[0],
          diet,
        });
        toast("Account created successfully!");
        resetForm();
        onClose();
      }
    } catch (err) {
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        setError("Backend server is not running at localhost:5000. Start the backend with 'flask run' or sign in with guest mode.");
      } else {
        setError(err.message || "An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = () => {
    const guestUser = {
      id: 1,
      email: email || "user@nutrisense.app",
      name: name || (email ? email.split("@")[0] : "NutriSense User"),
      diet,
    };
    login("guest-session-token", "guest-session-refresh", guestUser);
    toast("Signed in with guest mode!");
    resetForm();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tab === "login" ? "Welcome to NutriSense" : "Create NutriSense Account"}
      subtitle={
        tab === "login"
          ? "Sign in to access your nutrition diary and personal profile"
          : "Join NutriSense for context-aware nutrition tracking"
      }
      maxW="max-w-md"
    >
      {/* Segmented Tab Switcher */}
      <div className="mb-5 flex rounded-2xl border border-line bg-leaf-75/70 p-1">
        <button
          type="button"
          onClick={() => handleSwitchTab("login")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
            tab === "login"
              ? "border border-line bg-white text-leaf-700 shadow-sm"
              : "text-mist hover:text-ink"
          }`}
        >
          <LogIn size={14} /> Sign In
        </button>
        <button
          type="button"
          onClick={() => handleSwitchTab("register")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
            tab === "register"
              ? "border border-line bg-white text-leaf-700 shadow-sm"
              : "text-mist hover:text-ink"
          }`}
        >
          <UserPlus size={14} /> Create Account
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/90 p-3.5 text-xs font-semibold text-red-600">
          <p className="leading-relaxed">{error}</p>
          {error.includes("Backend server is not running") && (
            <button
              type="button"
              onClick={handleGuestSignIn}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-200"
            >
              <ShieldCheck size={13} /> Continue in guest mode →
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {tab === "register" && (
          <div>
            <label className="mb-1.5 block text-xs font-extrabold text-ink">
              Full Name
            </label>
            <div className="relative">
              <User
                size={16}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mist"
              />
              <input
                type="text"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input h-11 pl-10"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-extrabold text-ink">
            Email Address
          </label>
          <div className="relative">
            <Mail
              size={16}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mist"
            />
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input h-11 pl-10"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-extrabold text-ink">
            Password
          </label>
          <div className="relative">
            <Lock
              size={16}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mist"
            />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input h-11 pr-11 pl-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute top-1/2 right-3.5 -translate-y-1/2 text-mist transition-colors hover:text-ink"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {tab === "register" && (
          <div>
            <label className="mb-1.5 block text-xs font-extrabold text-ink">
              Dietary Preference
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIET_OPTIONS.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => setDiet(d.id)}
                  className={`flex h-10 items-center justify-center rounded-xl border text-xs font-bold transition-all ${
                    diet === d.id
                      ? "border-leaf-400 bg-leaf-100 text-leaf-800 shadow-xs"
                      : "border-line bg-white text-mist hover:border-leaf-200 hover:text-ink"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary mt-2 h-11 w-full justify-center text-sm font-bold shadow-md shadow-leaf-400/30"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processing...
            </span>
          ) : tab === "login" ? (
            <span className="inline-flex items-center gap-1.5">
              <LogIn size={15} /> Sign In
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={15} /> Create Account
            </span>
          )}
        </button>
      </form>

      <div className="mt-5 border-t border-line/70 pt-3.5 text-center">
        <p className="text-xs font-medium text-mist">
          {tab === "login" ? (
            <>
              Don't have an account yet?{" "}
              <button
                type="button"
                onClick={() => handleSwitchTab("register")}
                className="font-bold text-leaf-600 transition-colors hover:text-leaf-700"
              >
                Sign up free
              </button>
            </>
          ) : (
            <>
              Already registered?{" "}
              <button
                type="button"
                onClick={() => handleSwitchTab("login")}
                className="font-bold text-leaf-600 transition-colors hover:text-leaf-700"
              >
                Log in here
              </button>
            </>
          )}
        </p>
      </div>
    </Modal>
  );
}
