import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Barcode,
  Camera,
  Check,
  CheckCircle2,
  ExternalLink,
  Flame,
  Loader2,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  VideoOff,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, fmt } from "../components/ui";
import { MEAL_TYPES } from "../data/foods";
import { lookupBarcode } from "../api/barcodes";
import { createCustomFood } from "../api/foods";
import * as LogsAPI from "../api/logs";
import { localToday, nowUtcIso } from "../utils/date";

export default function FoodScanner() {
  const { addDiaryItem, toast, auth } = useApp();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const zxingReaderRef = useRef(null);

  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const [savedFood, setSavedFood] = useState(null);
  const [meal, setMeal] = useState("lunch");
  const [saving, setSaving] = useState(false);

  // Stop camera when unmounting
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch {
        // ignore
      }
      zxingReaderRef.current = null;
    }
    setScanning(false);
  };

  const startCamera = async () => {
    setError("");
    setCameraError("");
    setScanning(true);

    try {
      // 1. Try native BarcodeDetector if available
      if ("BarcodeDetector" in window) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          const detector = new window.BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"],
          });

          const detectInterval = setInterval(async () => {
            if (!videoRef.current || !streamRef.current) {
              clearInterval(detectInterval);
              return;
            }
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const detectedCode = barcodes[0].rawValue;
                clearInterval(detectInterval);
                stopCamera();
                handleLookup(detectedCode);
              }
            } catch {
              // ignore frame read errors
            }
          }, 300);
        }
      } else {
        // 2. Fallback to @zxing/browser
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const codeReader = new BrowserMultiFormatReader();
        zxingReaderRef.current = codeReader;

        await codeReader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (result) {
              stopCamera();
              handleLookup(result.getText());
            }
          }
        );
      }
    } catch (err) {
      setScanning(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera access or use manual input.");
      } else {
        setCameraError("Could not access camera. Please enter barcode number below.");
      }
    }
  };

  const handleLookup = async (codeToLookup) => {
    const code = (codeToLookup || manualCode).trim();
    if (!code) return;

    setLoading(true);
    setError("");
    setDraft(null);
    setSavedFood(null);

    try {
      const res = await lookupBarcode(code);
      setDraft({
        barcode: res.barcode,
        name_en: res.name_en || "",
        kcal_per_100g: res.kcal_per_100g || 0,
        protein_per_100g: res.protein_per_100g || 0,
        carbs_per_100g: res.carbs_per_100g || 0,
        fat_per_100g: res.fat_per_100g || 0,
        fibre_per_100g: res.fibre_per_100g || 0,
        diet: res.diet || "veg",
        diet_verified: res.diet_verified ?? false,
        needs_review: res.needs_review ?? false,
        missing_fields: res.missing_fields || [],
        warnings: res.warnings || [],
        portions: res.portions || [{ label: "100g serving", grams: 100, is_default: true }],
      });
      toast("Product details loaded!");
    } catch (err) {
      if (err.code === "product_not_found" || err.status === 404) {
        setError("Not found in Open Food Facts. You can add it as a custom food manually.");
      } else if (err.code === "upstream_unavailable" || err.status === 503) {
        setError("Open Food Facts is currently unavailable. Please try again shortly.");
      } else {
        setError(err.message || "Could not look up barcode.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustom = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = {
        name_en: draft.name_en,
        kcal_per_100g: Number(draft.kcal_per_100g) || 0,
        protein_per_100g: Number(draft.protein_per_100g) || 0,
        carbs_per_100g: Number(draft.carbs_per_100g) || 0,
        fat_per_100g: Number(draft.fat_per_100g) || 0,
        fibre_per_100g: Number(draft.fibre_per_100g) || 0,
        diet: draft.diet,
        barcode: draft.barcode,
        portions: draft.portions || [{ label: "100g serving", grams: 100, is_default: true }],
      };

      if (auth?.isAuthenticated) {
        const res = await createCustomFood(payload);
        setSavedFood(res.food || res);
        toast(`${draft.name_en} saved to your custom foods!`);
      } else {
        setSavedFood({
          id: `custom-${Date.now()}`,
          name: draft.name_en,
          ...payload,
        });
        toast(`${draft.name_en} saved locally!`);
      }
    } catch (err) {
      toast(err.message || "Failed to save custom food");
    } finally {
      setSaving(false);
    }
  };

  const handleLogToDiary = async () => {
    if (!savedFood && !draft) return;
    const foodToLog = savedFood || draft;
    const apiMeal = meal === "snacks" ? "snack" : meal;

    if (auth?.isAuthenticated && savedFood?.id) {
      try {
        await LogsAPI.createLog({
          food_id: savedFood.id,
          food_name: savedFood.name_en || draft.name_en,
          meal: apiMeal,
          logged_at: nowUtcIso(),
          log_date: localToday(),
          quantity: 1,
          portion_label: "100g serving",
          portion_grams: 100,
        });
        toast(`Logged to ${meal === "snacks" ? "Snacks" : meal}!`);
      } catch (err) {
        toast("Failed to log to diary");
      }
    } else {
      addDiaryItem(meal, {
        customFood: {
          id: `scanned-${Date.now()}`,
          name: foodToLog.name_en || foodToLog.name,
          serving: "100 g",
          category: "Scanned",
          calories: foodToLog.kcal_per_100g,
          protein: foodToLog.protein_per_100g,
          carbs: foodToLog.carbs_per_100g,
          fat: foodToLog.fat_per_100g,
          image: null,
          iconKey: "scan",
        },
      });
      toast(`Logged to ${meal === "snacks" ? "Snacks" : meal}!`);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Barcode Scanner"
        subtitle="Scan or search packaged foods powered by Open Food Facts with allergen and diet verification."
      >
        <Badge color="green">Barcode & OFF Lookup</Badge>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Scanner Panel */}
        <Card className="p-5 lg:col-span-3">
          <SectionTitle
            title="Scan Barcode"
            subtitle="Point camera at product barcode or enter numbers manually"
          />

          {/* Camera Viewfinder */}
          <div
            className="relative mt-4 overflow-hidden rounded-2xl border-2 border-dashed border-leaf-300/80 bg-leaf-50 flex flex-col items-center justify-center min-h-[320px]"
          >
            {scanning ? (
              <div className="relative w-full h-[320px] bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <div className="scanline" />
                <button
                  onClick={stopCamera}
                  className="absolute top-3 right-3 rounded-xl bg-ink/70 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-ink"
                >
                  Stop Camera
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3.5 p-6 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white text-leaf-500 shadow-sm">
                  <Barcode size={32} />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-ink">Ready to Scan</p>
                  <p className="mt-1 text-xs font-semibold text-mist">
                    Support for EAN-13, UPC, Code-128 and QR codes
                  </p>
                </div>
                <button
                  onClick={startCamera}
                  className="btn btn-primary btn-sm min-h-[44px] px-4"
                  aria-label="Start Camera Scanner"
                >
                  <Camera size={15} /> Start Camera Scanner
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">
              <VideoOff size={14} className="shrink-0" />
              {cameraError}
            </div>
          )}

          {/* Manual Input Fallback */}
          <div className="mt-4 border-t border-line/70 pt-4">
            <label className="mb-1.5 block text-xs font-extrabold text-ink">
              Manual Barcode Entry
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 8901030383749, 737628064502"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup(manualCode)}
                className="input h-11 flex-1 font-mono text-sm"
              />
              <button
                onClick={() => handleLookup(manualCode)}
                disabled={loading || !manualCode.trim()}
                className="btn btn-primary min-h-[44px] px-5"
                aria-label="Look up barcode"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Lookup"}
              </button>
            </div>
          </div>
        </Card>

        {/* Results Panel */}
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Product Information" subtitle="Nutritional draft & verification" />

          {loading ? (
            <div className="mt-8 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="animate-spin text-leaf-500" />
              <p className="text-xs font-bold text-mist">Fetching from Open Food Facts...</p>
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-600">
              <p className="leading-relaxed">{error}</p>
            </div>
          ) : !draft ? (
            <div className="mt-6">
              <EmptyState
                icon={ScanLine}
                title="No Product Selected"
                text="Scan a barcode or enter numbers to retrieve nutrition data from Open Food Facts."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <input
                  type="text"
                  value={draft.name_en}
                  onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
                  className="input font-extrabold text-base text-ink h-11"
                  placeholder="Product Name"
                />
                <p className="mt-1 text-[11px] font-mono text-mist">Barcode: {draft.barcode}</p>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-1.5">
                {draft.diet_verified ? (
                  <Badge color="green"><ShieldCheck size={11} /> Diet Verified</Badge>
                ) : (
                  <Badge color="amber"><ShieldAlert size={11} /> Diet Unverified</Badge>
                )}

                {draft.needs_review ? (
                  <Badge color="red"><AlertTriangle size={11} /> Needs Review</Badge>
                ) : (
                  <Badge color="blue"><CheckCircle2 size={11} /> Verified Match</Badge>
                )}

                <Badge color="white">{draft.diet.toUpperCase()}</Badge>
              </div>

              {/* Missing Fields Warning */}
              {draft.missing_fields?.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  <p className="font-extrabold flex items-center gap-1.5">
                    <AlertCircle size={13} /> Incomplete nutritional data:
                  </p>
                  <p className="mt-0.5 text-[11px]">
                    Missing: {draft.missing_fields.join(", ")} — please estimate before saving.
                  </p>
                </div>
              )}

              {/* Nutrition Inputs per 100g */}
              <div className="space-y-2">
                <p className="text-[10.5px] font-extrabold tracking-wider text-mist uppercase">
                  Nutrients per 100g
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 flex items-center justify-between rounded-xl bg-leaf-400/15 px-3.5 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-leaf-700">
                      <Flame size={14} /> Calories (kcal)
                    </span>
                    <input
                      type="number"
                      value={draft.kcal_per_100g}
                      onChange={(e) => setDraft({ ...draft, kcal_per_100g: e.target.value })}
                      className="input h-8 w-24 text-right font-extrabold text-sm"
                    />
                  </div>

                  {[
                    { key: "protein_per_100g", label: "Protein (g)" },
                    { key: "carbs_per_100g",   label: "Carbs (g)" },
                    { key: "fat_per_100g",     label: "Fat (g)" },
                    { key: "fibre_per_100g",   label: "Fibre (g)" },
                  ].map(({ key, label }) => (
                    <div key={key} className="rounded-xl bg-leaf-75 p-2.5">
                      <label className="block text-[10px] font-bold text-mist">{label}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={draft[key]}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                        className="input mt-1 h-8 text-sm font-extrabold text-ink"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Attribution */}
              <div className="flex items-center justify-between text-[11px] font-medium text-mist border-t border-line pt-2">
                <span>Data: Open Food Facts</span>
                <a
                  href={`https://world.openfoodfacts.org/product/${draft.barcode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-leaf-600 hover:underline"
                >
                  View source <ExternalLink size={10} />
                </a>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                {!savedFood ? (
                  <button
                    onClick={handleSaveCustom}
                    disabled={saving}
                    className="btn btn-primary w-full min-h-[44px]"
                    aria-label="Save as custom food"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : "Save as Custom Food"}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-leaf-700 bg-leaf-100 rounded-xl py-2">
                      <Check size={14} /> Saved to custom foods
                    </div>

                    <div className="flex gap-1.5">
                      {MEAL_TYPES.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setMeal(m.id)}
                          className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-all min-h-[36px] ${
                            meal === m.id ? "bg-leaf-500 text-white" : "border border-line bg-white text-mist"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleLogToDiary}
                      className="btn btn-primary w-full min-h-[44px]"
                      aria-label="Log product to food diary"
                    >
                      <Plus size={15} /> Log to Diary
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
