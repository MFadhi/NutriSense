import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Citrus,
  CloudRain,
  CloudSun,
  Droplet,
  Droplets,
  Eye,
  Flame,
  MapPin,
  Milk,
  Salad,
  Soup,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Card, ChartTooltip, PageHeader, ProgressBar, Ring, SectionTitle } from "../components/ui";
import { FORECAST, HOURLY, HYDRATION_PLAN, WEATHER, WEATHER_FOODS, WEATHER_TIPS } from "../services/weather";

const DAY_ICON = { sun: Sun, cloudsun: CloudSun, rain: CloudRain };
const FOOD_ICON = { citrus: Citrus, salad: Salad, glass: Droplets, milk: Milk, soup: Soup, droplets: Droplets };

export default function Weather() {
  const { water, addWater } = useApp();

  return (
    <div className="space-y-5">
      <PageHeader title="Weather Intelligence" subtitle="Context-aware nutrition that adapts to the day's climate conditions.">
        <Badge color="blue">
          <MapPin size={11} /> {WEATHER.city}
        </Badge>
      </PageHeader>

      {/* Hero conditions */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="relative overflow-hidden p-6 lg:col-span-7">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-leaf-100" />
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-leaf-200/60" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold tracking-[0.14em] text-mist uppercase">{WEATHER.condition} · {WEATHER.updated}</p>
                <div className="mt-2 flex items-start">
                  <span className="font-display text-7xl leading-none font-semibold tracking-tight text-ink">{WEATHER.temp}</span>
                  <span className="mt-2 text-xl font-bold text-mist">°C</span>
                </div>
                <p className="mt-2 text-sm font-bold text-ink">Feels like {WEATHER.feelsLike}°C with {WEATHER.humidity}% humidity</p>
              </div>
              <span className="grid h-20 w-20 place-items-center rounded-3xl bg-leaf-400/15 text-leaf-500">
                <CloudSun size={44} strokeWidth={1.6} />
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { icon: Droplets, label: "Humidity", value: `${WEATHER.humidity}%` },
                { icon: Wind, label: "Wind", value: `${WEATHER.wind} km/h` },
                { icon: Sun, label: "UV index", value: `${WEATHER.uvIndex} · ${WEATHER.uv}` },
                { icon: Eye, label: "Visibility", value: `${WEATHER.visibility} km` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl border border-line bg-white/80 px-3.5 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wide text-mist uppercase">
                    <Icon size={11} className="text-leaf-500" /> {label}
                  </div>
                  <p className="mt-1 text-base font-extrabold text-ink">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-leaf-200 bg-leaf-100 px-4 py-3">
              <Thermometer size={15} className="mt-0.5 shrink-0 text-leaf-600" />
              <p className="font-display text-[15px] leading-relaxed text-leaf-800 italic">
                It's {WEATHER.temp}°C today! Stay hydrated and include water-rich fruits in your meals.
              </p>
            </div>
          </div>
        </Card>

        {/* Hydration plan */}
        <Card className="p-5 lg:col-span-5">
          <SectionTitle title="Hydration plan" subtitle="+500 ml heat adjustment applied" />
          <div className="mt-4 flex items-center gap-5">
            <Ring value={water} max={HYDRATION_PLAN.target} size={132} stroke={12} color="var(--color-leaf-500)">
              <Droplets size={16} className="text-leaf-500" />
              <span className="mt-1 text-xl font-extrabold text-ink">{(water / 1000).toFixed(1)} L</span>
              <span className="text-[9px] font-bold tracking-[0.12em] text-mist uppercase">of {(HYDRATION_PLAN.target / 1000).toFixed(1)} L</span>
            </Ring>
            <div className="flex-1 space-y-3">
              <p className="text-[12px] leading-relaxed font-semibold text-mist">{HYDRATION_PLAN.reason}</p>
              <div>
                <div className="mb-1 flex justify-between text-[10.5px] font-extrabold text-mist uppercase">
                  <span>Progress</span>
                  <span>{Math.min(100, Math.round((water / HYDRATION_PLAN.target) * 100))}%</span>
                </div>
                <ProgressBar value={water} max={HYDRATION_PLAN.target} height={8} color="var(--color-leaf-500)" />
              </div>
              <button className="btn btn-primary btn-sm w-full" onClick={() => addWater(250)}>
                <Droplet size={14} /> Log 250 ml
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Trend + forecast */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-7">
          <SectionTitle title="Temperature today" subtitle="Hourly forecast (°C)" />
          <div className="mt-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={HOURLY} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4caf50" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#4caf50" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e0ead9" strokeDasharray="4 6" />
                <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "#78909c", fontSize: 10.5, fontWeight: 700 }} dy={6} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#b3c4ad", fontSize: 9.5, fontWeight: 700 }} domain={[20, 38]} unit="°" />
                <Tooltip content={<ChartTooltip unit="°C" />} cursor={{ stroke: "#a5d66d", strokeWidth: 1.5, strokeDasharray: "4 4" }} />
                <Area type="monotone" dataKey="temp" name="Temp" stroke="#4caf50" strokeWidth={2.5} fill="url(#tempFill)" dot={{ r: 3, fill: "#fff", stroke: "#4caf50", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#33691e" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-5">
          <SectionTitle title="6-day outlook" subtitle="Plan meals and activity ahead" />
          <ul className="mt-3 space-y-1">
            {FORECAST.map((d) => {
              const Icon = DAY_ICON[d.icon] || Sun;
              return (
                <li key={d.day} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-leaf-50">
                  <span className="w-12 text-[12.5px] font-extrabold text-ink">{d.day}</span>
                  <Icon size={17} className={d.icon === "rain" ? "text-sky-500" : "text-leaf-500"} />
                  <span className="flex-1 text-[11.5px] font-semibold text-mist">{d.note}</span>
                  <span className="text-[12.5px] font-extrabold text-ink">{d.hi}°</span>
                  <span className="w-7 text-right text-[12.5px] font-bold text-mist">{d.lo}°</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Weather-smart foods */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Eat smart for the heat</h2>
          <Badge color="green">
            <Umbrella size={11} /> Heat-friendly picks
          </Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {WEATHER_FOODS.map((f) => {
            const Icon = FOOD_ICON[f.icon] || Salad;
            return (
              <Card key={f.name} hover className="flex gap-3.5 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-leaf-100 text-leaf-600">
                  <Icon size={19} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13.5px] font-extrabold text-ink">{f.name}</p>
                    <span className="rounded-full bg-leaf-75 px-2 py-0.5 text-[9.5px] font-extrabold text-leaf-700">{f.kcal}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed font-medium text-mist">{f.why}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tips */}
      <Card className="p-5">
        <SectionTitle title="Weather-smart tips" subtitle="Small adjustments for hot, humid days" />
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {WEATHER_TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-xl bg-leaf-75 px-3.5 py-3">
              <Flame size={14} className="mt-0.5 shrink-0 text-leaf-500" />
              <p className="text-[12.5px] leading-relaxed font-semibold text-leaf-800">{tip}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
