import { useRef, useState } from "react";
import { Aperture, Beef, Camera, Droplet, Flame, Loader2, Plus, RotateCw, ScanLine, UtensilsCrossed, Wheat } from "lucide-react";
import { uid, useApp } from "../context/AppContext";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, fmt } from "../components/ui";
import { IMAGES, MEAL_TYPES } from "../data/foods";

/** Simulated recognition results — picked at random per scan. */
const SCAN_RESULTS = [
  { name: "Masala Dosa", serving: 220, calories: 380, protein: 9, carbs: 58, fat: 12, confidence: 94 },
  { name: "Grilled Chicken Sandwich", serving: 240, calories: 356, protein: 22, carbs: 34, fat: 11, confidence: 91 },
  { name: "Idli with Sambar (2 pc)", serving: 200, calories: 238, protein: 8, carbs: 48, fat: 3, confidence: 96 },
  { name: "Mixed Vegetable Salad Bowl", serving: 250, calories: 195, protein: 6, carbs: 22, fat: 9, confidence: 89 },
];

const suggestedMeal = () => {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 19 ? "snacks" : "dinner";
};

export default function FoodScanner() {
  const { addDiaryItem, toast } = useApp();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [portion, setPortion] = useState(1);
  const [meal, setMeal] = useState(suggestedMeal());

  const runAnalysis = (imageSrc, name) => {
    setPreview(imageSrc);
    setFileName(name);
    setResult(null);
    setAnalyzing(true);
    setPortion(1);
    /* Simulate the vision pipeline */
    window.setTimeout(() => {
      setResult(SCAN_RESULTS[Math.floor(Math.random() * SCAN_RESULTS.length)]);
      setAnalyzing(false);
    }, 1600);
  };

  const handleFile = (file) => {
    if (!file) return;
    runAnalysis(URL.createObjectURL(file), file.name);
  };

  const useSample = () => runAnalysis(IMAGES.chickenSaladTall, "sample-food-photo.jpg");

  const grams = result ? Math.round(result.serving * portion) : 0;
  const scaled = (v) => Math.round(v * portion);

  const addToDiary = () => {
    if (!result) return;
    addDiaryItem(
      meal,
      {
        customFood: {
          id: uid("cf"),
          name: result.name,
          serving: `${result.serving} g (scanned)`,
          category: "Scanned",
          calories: result.calories,
          protein: result.protein,
          carbs: result.carbs,
          fat: result.fat,
          image: null,
          iconKey: "scan",
        },
      },
      portion
    );
    toast(`${result.name} added to ${meal}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Food Scanner" subtitle="Point your camera at a dish and NutriSense estimates its nutrition instantly.">
        <Badge color="green">AI Vision Scanner</Badge>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Capture panel */}
        <Card className="p-5 lg:col-span-3">
          <SectionTitle title="Scan a meal" subtitle="Upload or drop a food photo to analyse" />
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <div
            className="relative mt-4 overflow-hidden rounded-2xl border-2 border-dashed border-leaf-300/80 bg-leaf-50 transition-colors hover:bg-leaf-75"
            style={{ minHeight: 340 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            {preview ? (
              <>
                <img src={preview} alt="Scanned food" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent" />
                {/* Corner brackets */}
                <span className="absolute top-4 left-4 h-7 w-7 rounded-tl-lg border-t-[3px] border-l-[3px] border-leaf-300" />
                <span className="absolute top-4 right-4 h-7 w-7 rounded-tr-lg border-t-[3px] border-r-[3px] border-leaf-300" />
                <span className="absolute bottom-4 left-4 h-7 w-7 rounded-bl-lg border-b-[3px] border-l-[3px] border-leaf-300" />
                <span className="absolute right-4 bottom-4 h-7 w-7 rounded-br-lg border-r-[3px] border-b-[3px] border-leaf-300" />
                {analyzing && <div className="scanline" />}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/60 px-3.5 py-1.5 text-[11px] font-bold text-white backdrop-blur">
                  {analyzing ? "Analysing…" : fileName}
                </div>
              </>
            ) : (
              <button onClick={() => inputRef.current?.click()} className="absolute inset-0 flex w-full flex-col items-center justify-center gap-3.5 p-6">
                <span className="relative grid h-16 w-16 place-items-center rounded-3xl bg-white text-leaf-500 shadow-sm">
                  <Aperture size={28} />
                  <span className="absolute inset-0 animate-ping rounded-3xl bg-leaf-300/30" style={{ animationDuration: "2.2s" }} />
                </span>
                <span className="text-center">
                  <span className="block text-sm font-extrabold text-ink">Drop a food photo here</span>
                  <span className="mt-1 block text-xs font-semibold text-mist">or use your camera — JPG / PNG</span>
                </span>
                <span className="btn btn-primary btn-sm">
                  <Camera size={14} /> Open camera / gallery
                </span>
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()}>
              <Camera size={14} /> Upload image
            </button>
            <button className="btn btn-soft btn-sm" onClick={useSample}>
              <UtensilsCrossed size={14} /> Try a sample photo
            </button>
            {preview && !analyzing && (
              <button className="btn btn-ghost btn-sm ml-auto" onClick={() => runAnalysis(preview, fileName)}>
                <RotateCw size={13} /> Rescan
              </button>
            )}
          </div>
        </Card>

        {/* Result panel */}
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Recognition result" subtitle="Estimated nutrition" />
          {analyzing ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2.5 text-xs font-bold text-leaf-600">
                <Loader2 size={15} className="animate-spin" /> Identifying food…
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-leaf-75" />
              ))}
            </div>
          ) : !result ? (
            <EmptyState
              icon={ScanLine}
              title="No scan yet"
              text="Upload a food photo and the simulated recogniser will estimate its name, calories and macros."
            />
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-lg font-extrabold tracking-tight text-ink">{result.name}</h4>
                  <Badge color="green">{result.confidence}% match</Badge>
                </div>
                <p className="mt-0.5 text-[11px] font-semibold text-mist">Simulated recognition · resize the portion to fit your plate</p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
                  <span className="text-mist">Portion size</span>
                  <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-leaf-700">{portion}× · {grams} g</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.25"
                  value={portion}
                  onChange={(e) => setPortion(parseFloat(e.target.value))}
                  className="w-full cursor-pointer"
                />
                <div className="flex justify-between text-[9.5px] font-extrabold text-mist">
                  <span>Half</span>
                  <span>Regular</span>
                  <span>Double</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 flex items-center justify-between rounded-xl bg-leaf-400/15 px-4 py-3">
                  <span className="flex items-center gap-2 text-xs font-extrabold text-leaf-700">
                    <Flame size={14} /> Calories
                  </span>
                  <span className="text-xl font-extrabold text-ink">
                    {fmt(scaled(result.calories))} <span className="text-[10px] font-bold text-mist">kcal</span>
                  </span>
                </div>
                {[
                  { icon: Beef, label: "Protein", value: `${scaled(result.protein)} g` },
                  { icon: Wheat, label: "Carbs", value: `${scaled(result.carbs)} g` },
                  { icon: Droplet, label: "Fat", value: `${scaled(result.fat)} g` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className={`rounded-xl bg-leaf-75 px-3.5 py-2.5 text-center ${label === "Fat" ? "col-span-2" : ""}`}>
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold tracking-wide text-mist uppercase">
                      <Icon size={11} className="text-leaf-500" /> {label}
                    </div>
                    <p className="mt-0.5 text-sm font-extrabold text-ink">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="label">Add to</p>
                <div className="flex flex-wrap gap-1.5">
                  {MEAL_TYPES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMeal(m.id)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                        meal === m.id ? "border-leaf-400 bg-leaf-400 text-white" : "border-line bg-white text-mist hover:border-leaf-300 hover:text-leaf-700"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary w-full" onClick={addToDiary}>
                <Plus size={16} /> Add to food diary
              </button>
              <p className="text-center text-[10px] font-medium text-mist">Estimates generated from sample data — not from a live vision model.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
