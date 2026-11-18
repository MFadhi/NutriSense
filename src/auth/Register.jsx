import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, Eye, EyeOff, UserPlus, CheckCircle2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { register as apiRegister, login as apiLogin } from "../api/auth";
import { setAccessToken, setRefreshToken } from "./tokenStore";

const DIET_OPTIONS = [
  { id: "veg", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "eggetarian", label: "Eggetarian" },
  { id: "nonveg", label: "Non-Veg" },
];

export default function Register() {
  const navigate = useNavigate();
  const { login, toast } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [diet, setDiet] = useState("veg");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      await apiRegister(email.trim(), password, diet);
      const loginRes = await apiLogin(email.trim(), password);
      setAccessToken(loginRes.access_token);
      setRefreshToken(loginRes.refresh_token);
      await login(loginRes.access_token, loginRes.refresh_token, loginRes.user);
      toast("Account created successfully!");
      navigate("/", { replace: true });
    } catch (err) {
      const msg = err?.message || String(err);
      if (
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("network_error") ||
        msg.toLowerCase().includes("network error") ||
        err?.code === "network_error"
      ) {
        setError("Backend server is not running at localhost:5001. Start it with 'cd backend && flask run'.");
      } else {
        setError(msg || "Registration failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-7 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Create Account</h1>
          <p className="mt-1 text-xs font-semibold text-mist">Join NutriLens for smart nutrition tracking</p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/90 p-3.5 text-xs font-semibold text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-extrabold text-ink">Email Address</label>
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mist" />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input h-11 !pl-10"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-extrabold text-ink">Password</label>
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mist" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input h-11 !pr-11 !pl-10"
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

          <div>
            <label className="mb-1.5 block text-xs font-extrabold text-ink">Dietary Preference</label>
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

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary mt-2 h-11 w-full justify-center text-sm font-bold shadow-md shadow-leaf-400/30"
          >
            {loading ? "Creating account..." : (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} /> Create Account
              </span>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs font-medium text-mist">
          Already registered?{" "}
          <Link to="/login" className="font-bold text-leaf-600 hover:text-leaf-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
