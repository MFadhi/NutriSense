import { useState, useEffect } from "react";
import {
  CloudSun,
  CloudRain,
  Sun,
  Droplets,
  Wind,
  MapPin,
  Thermometer,
  Sparkles,
  RefreshCw,
  Plus,
  Info,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Card, PageHeader, ProgressBar, Ring, SectionTitle } from "../components/ui";
import { getWeatherRecommendations } from "../api/weather";

const POPULAR_CITIES = [
  { name: "Pune", lat: 18.5204, lon: 73.8567 },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  { name: "Mumbai", lat: 19.0760, lon: 72.8777 },
  { name: "Delhi", lat: 28.6139, lon: 77.2090 },
  { name: "Hyderabad", lat: 17.3850, lon: 78.4867 },
  { name: "Chennai", lat: 13.0827, lon: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
];

export default function Weather() {
  const { water, targets, addWater, toast } = useApp();

  const [city, setCity] = useState("Pune");
  const [coords, setCoords] = useState({ lat: 18.5204, lon: 73.8567 });
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWeather = async (lat, lon, cityName) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWeatherRecommendations(lat, lon, cityName);
      setWeatherData(data);
    } catch (err) {
      setError(err?.message || "Failed to load live weather.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Try browser geolocation on initial mount
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setCoords({ lat, lon });
          setCity("Local Device");
          fetchWeather(lat, lon, "Local Device");
        },
        () => {
          // Denied or timed out -> use default Pune
          fetchWeather(coords.lat, coords.lon, city);
        },
        { timeout: 5000 }
      );
    } else {
      fetchWeather(coords.lat, coords.lon, city);
    }
  }, []);

  const handleSelectCity = (c) => {
    setCity(c.name);
    setCoords({ lat: c.lat, lon: c.lon });
    fetchWeather(c.lat, c.lon, c.name);
  };

  const currentW = weatherData?.weather;
  const hydration = weatherData?.hydration;
  const foodSuggestions = weatherData?.food_suggestions || [];

  const baselineWater = targets?.water || hydration?.baseline_water_ml || 2500;
  const adjustment = hydration?.weather_adjustment_ml || 0;
  const adjustedTarget = baselineWater + adjustment;
  const progressPct = Math.min(100, Math.round((water / adjustedTarget) * 100));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weather Intelligence"
        subtitle="Context-aware nutrition and dynamic hydration adapting to real-time climate conditions."
      >
        <div className="flex items-center gap-2">
          <Badge color="blue">
            <MapPin size={11} className="mr-1 inline" /> {city}
          </Badge>
          <button
            onClick={() => fetchWeather(coords.lat, coords.lon, city)}
            className="icon-btn"
            title="Refresh weather"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </PageHeader>

      {/* City Switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-mist">Quick Location:</span>
        {POPULAR_CITIES.map((c) => (
          <button
            key={c.name}
            onClick={() => handleSelectCity(c)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              city === c.name
                ? "bg-leaf-500 text-white shadow-xs"
                : "border border-line bg-white text-mist hover:bg-leaf-50 hover:text-ink"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading && !weatherData ? (
        <Card className="flex min-h-[300px] items-center justify-center p-8">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-leaf-500 border-t-transparent" />
            <p className="mt-3 text-xs font-semibold text-mist">Connecting to Open-Meteo forecast...</p>
          </div>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50/50 p-6 text-center text-xs text-red-600">
          <p className="font-bold">Weather service unavailable</p>
          <p className="mt-1">{error}</p>
          <button
            onClick={() => fetchWeather(coords.lat, coords.lon, city)}
            className="btn btn-outline btn-xs mt-3 text-red-700"
          >
            Retry
          </button>
        </Card>
      ) : (
        <>
          {/* Hero Weather & Hydration Grid */}
          <div className="grid gap-5 lg:grid-cols-12">
            {/* Live Weather Card */}
            <Card className="relative overflow-hidden p-6 lg:col-span-7">
              <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-leaf-100/60" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-extrabold tracking-wider text-mist uppercase">
                      {currentW?.condition_text || "Clear"} · {city}
                    </p>
                    <div className="mt-2 flex items-start">
                      <span className="font-display text-7xl font-bold tracking-tight text-ink">
                        {Math.round(currentW?.temperature || 26)}
                      </span>
                      <span className="mt-2 text-xl font-bold text-mist">°C</span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-ink">
                      Feels like {Math.round(currentW?.apparent_temperature || currentW?.temperature || 26)}°C with{" "}
                      {Math.round(currentW?.humidity || 50)}% humidity
                    </p>
                  </div>
                  <div className="grid h-20 w-20 place-items-center rounded-3xl bg-leaf-100 text-leaf-600">
                    <CloudSun size={44} strokeWidth={1.8} />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-line bg-leaf-50/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-mist">
                      <Droplets size={14} className="text-leaf-500" /> Humidity
                    </div>
                    <p className="mt-1 text-base font-extrabold text-ink">{Math.round(currentW?.humidity || 50)}%</p>
                  </div>
                  <div className="rounded-xl border border-line bg-leaf-50/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-mist">
                      <Thermometer size={14} className="text-leaf-500" /> Apparent Temp
                    </div>
                    <p className="mt-1 text-base font-extrabold text-ink">
                      {Math.round(currentW?.apparent_temperature || currentW?.temperature || 26)}°C
                    </p>
                  </div>
                  <div className="col-span-2 rounded-xl border border-line bg-leaf-50/20 p-3 sm:col-span-1">
                    <div className="flex items-center gap-1.5 text-xs text-mist">
                      <Sparkles size={14} className="text-leaf-500" /> Source
                    </div>
                    <p className="mt-1 text-xs font-bold text-ink">Open-Meteo Live</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Weather-Aware Hydration Card */}
            <Card className="p-6 lg:col-span-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">Hydration Guidance</h3>
                  <p className="text-xs text-mist">
                    {adjustment > 0 ? `+${adjustment} ml climate adjustment` : "Standard baseline target"}
                  </p>
                </div>
                <Badge color={adjustment > 0 ? "blue" : "green"}>
                  {adjustment > 0 ? "Heat Aware" : "Optimal"}
                </Badge>
              </div>

              <div className="mt-5 flex items-center gap-5">
                <div className="shrink-0">
                  <Ring value={water} max={adjustedTarget} size={80} strokeWidth={8}>
                    <span className="text-xs font-extrabold text-ink">{progressPct}%</span>
                  </Ring>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink">
                    <span className="text-xl font-extrabold text-leaf-600">{(water / 1000).toFixed(2)} L</span>
                    {" "}of {(adjustedTarget / 1000).toFixed(2)} L
                  </p>
                  <p className="mt-1 text-[11px] text-mist leading-relaxed">
                    Baseline: {(baselineWater / 1000).toFixed(1)} L
                    {adjustment > 0 && ` + ${(adjustment / 1000).toFixed(2)} L due to temperature/humidity`}
                  </p>
                  <button
                    onClick={() => {
                      addWater(250);
                      toast("Logged 250 ml of water.");
                    }}
                    className="btn btn-primary btn-xs mt-3"
                  >
                    <Plus size={12} className="mr-1" /> Log 250 ml
                  </button>
                </div>
              </div>

              {hydration?.explanation && (
                <div className="mt-5 rounded-xl bg-leaf-50/50 p-3 border border-leaf-100 text-[11px] text-leaf-800 leading-relaxed">
                  <Info size={13} className="mr-1 inline text-leaf-600" />
                  {hydration.explanation}
                </div>
              )}
            </Card>
          </div>

          {/* Weather-Based Food Recommendations */}
          <div>
            <div className="mb-3">
              <SectionTitle title="Climate-Optimized Food Recommendations" />
              <p className="text-xs text-mist">
                Foods selected from your Indian food database to balance internal body temperature, electrolyte levels, and digestion.
              </p>
            </div>

            {foodSuggestions.length === 0 ? (
              <Card className="p-6 text-center text-xs text-mist">
                No specific climate suggestions found for current preferences.
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {foodSuggestions.map((food) => (
                  <Card key={food.id} className="p-4 transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-ink">{food.name_en}</p>
                        {food.name_hi && (
                          <p className="text-[11px] text-mist">{food.name_hi}</p>
                        )}
                      </div>
                      <Badge color={food.diet === "veg" ? "green" : food.diet === "vegan" ? "blue" : "amber"}>
                        {food.diet}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {(food.tags || []).slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-leaf-50 px-2 py-0.5 text-[10px] font-semibold text-leaf-700"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-[11px] text-mist">
                      <span>{Math.round(food.kcal_per_100g || 0)} kcal / 100g</span>
                      <span className="font-semibold text-leaf-700">
                        {food.protein_per_100g || 0}g protein
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
