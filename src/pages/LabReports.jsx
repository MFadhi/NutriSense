import { useRef, useState } from "react";
import {
  Apple,
  CircleAlert,
  CheckCircle2,
  CloudUpload,
  FileText,
  Image as ImageIcon,
  Loader2,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { uid, useApp } from "../context/AppContext";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "../components/ui";
import { LAB_STATUS, SAMPLE_LAB_VALUES } from "../data/extras";

const fmtSize = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function RangeBar({ metric }) {
  const span = metric.max - metric.min || 1;
  const dMin = metric.min - span * 0.45;
  const dMax = metric.max + span * 0.45;
  const total = dMax - dMin;
  const left = ((metric.min - dMin) / total) * 100;
  const width = (span / total) * 100;
  const pos = Math.min(98, Math.max(2, ((metric.value - dMin) / total) * 100));
  const inRange = metric.value >= metric.min && metric.value <= metric.max;
  return (
    <div className="relative mt-1.5 h-2.5 w-full rounded-full bg-leaf-75">
      <span className="absolute top-0 h-full rounded-full bg-leaf-300/60" style={{ left: `${left}%`, width: `${width}%` }} />
      <span
        className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white shadow-md ${inRange ? "bg-leaf-500" : "bg-amber-500"}`}
        style={{ left: `${pos}%` }}
      />
    </div>
  );
}

export default function LabReports() {
  const { reports, setReports, toast } = useApp();
  const [selectedId, setSelectedId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const selected = reports.find((r) => r.id === selectedId) || (reports.length ? reports[reports.length - 1] : null);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    const id = uid("r");
    const entry = {
      id,
      name: file.name,
      size: fmtSize(file.size),
      type: file.type.includes("pdf") ? "PDF" : "Image",
      date: new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
      status: "processing",
    };
    setReports((rs) => [...rs, entry]);
    setSelectedId(id);
    /* Simulate an analysis pass with sample values */
    window.setTimeout(() => {
      setReports((rs) => rs.map((r) => (r.id === id ? { ...r, status: "analyzed" } : r)));
      toast("Sample lab values extracted (demo)");
    }, 1400);
  };

  const removeReport = (id) => {
    setReports((rs) => rs.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast("Report deleted");
  };

  const allFoods = [...new Set(SAMPLE_LAB_VALUES.flatMap((m) => m.foods))];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lab Reports"
        subtitle="Upload a blood test or health report to preview how NutriLens turns biomarkers into nutrition guidance."
      >
        <Badge color="amber">Demo — sample extracted values</Badge>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Upload + list */}
        <div className="space-y-4 lg:col-span-5">
          <Card
            className={`p-5 transition-all ${dragging ? "border-leaf-400 bg-leaf-75" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-leaf-300/80 bg-leaf-50 px-6 py-10 text-center transition-colors hover:bg-leaf-75"
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-leaf-500 shadow-sm">
                <CloudUpload size={26} />
              </span>
              <span>
                <span className="block text-sm font-extrabold text-ink">Drop your lab report here</span>
                <span className="mt-1 block text-xs font-semibold text-mist">or click to browse — PDF, PNG or JPG up to 10 MB</span>
              </span>
              <span className="btn btn-sm btn-soft">Choose file</span>
            </button>
            <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed font-medium text-mist">
              <Sparkles size={12} className="mt-0.5 shrink-0 text-leaf-500" />
              In this frontend demo, uploads are listed locally and analysis shows realistic sample values — real OCR plugs into the Flask backend later.
            </p>
          </Card>

          <Card className="p-4">
            <div className="px-1 pt-1">
              <SectionTitle title="Uploaded reports" subtitle={`${reports.length} file${reports.length === 1 ? "" : "s"}`} />
            </div>
            {reports.length === 0 ? (
              <EmptyState icon={FileText} title="No reports yet" text="Upload a report to see the analysis flow with sample biomarker values." />
            ) : (
              <ul className="mt-2 space-y-1.5">
                {reports.map((r) => {
                  const Icon = r.type === "PDF" ? FileText : ImageIcon;
                  const active = selected?.id === r.id;
                  return (
                    <li
                      key={r.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                        active ? "border-leaf-300 bg-leaf-75" : "border-line hover:border-leaf-200 hover:bg-leaf-50"
                      }`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-leaf-600 shadow-sm">
                        {r.status === "processing" ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-ink">{r.name}</p>
                        <p className="text-[10.5px] font-semibold text-mist">
                          {r.type} · {r.size} · {r.date}
                        </p>
                      </div>
                      {r.status === "analyzed" ? <Badge color="green">Analyzed</Badge> : <Badge color="blue">Processing…</Badge>}
                      <button
                        className="icon-btn h-7 w-7 hover:bg-red-50! hover:text-red-500!"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeReport(r.id);
                        }}
                        aria-label="Delete report"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Analysis */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="p-5">
            <SectionTitle
              title="Extracted lab values"
              subtitle={selected ? `${selected.name} · ${selected.date}` : "Select a report to view its analysis"}
              action={selected?.status === "analyzed" && <Badge color="green">Sample data</Badge>}
            />
            {!selected ? (
              <EmptyState icon={CloudUpload} title="Nothing to analyse yet" text="Upload a lab report on the left and NutriLens will display extracted values with reference ranges." />
            ) : selected.status === "processing" ? (
              <div className="mt-4 space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-leaf-75" />
                ))}
                <p className="text-center text-xs font-bold text-mist">Simulating extraction…</p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {SAMPLE_LAB_VALUES.map((m) => {
                  const st = LAB_STATUS[m.status];
                  return (
                    <li key={m.name} className="rounded-2xl border border-line p-4 transition-colors hover:border-leaf-200">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-extrabold text-ink">{m.name}</p>
                        <Badge color={st.color}>{st.label}</Badge>
                        <span className="ml-auto text-sm font-extrabold text-ink">
                          {m.value} <span className="text-[10px] font-bold text-mist">{m.unit}</span>
                        </span>
                      </div>
                      <RangeBar metric={m} />
                      <div className="mt-1.5 flex justify-between text-[10px] font-bold text-mist">
                        <span>Reference: {m.min}–{m.max} {m.unit}</span>
                        <span>Your value: {m.value}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {selected?.status === "analyzed" && (
            <>
              <Card className="p-5">
                <SectionTitle title="Nutrition insights" subtitle="Food-first suggestions mapped to your biomarkers" />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {SAMPLE_LAB_VALUES.map((m) => {
                    const st = LAB_STATUS[m.status];
                    const ok = m.status === "normal";
                    return (
                      <div key={m.name} className="rounded-2xl border border-line bg-leaf-50 p-4">
                        <div className="flex items-center gap-2">
                          {ok ? <CheckCircle2 size={15} className="text-leaf-500" /> : <CircleAlert size={15} className="text-amber-500" />}
                          <p className="text-[13px] font-extrabold text-ink">{m.name}</p>
                          <Badge color={st.color} className="ml-auto">{st.label}</Badge>
                        </div>
                        <p className="mt-2 text-[12px] leading-relaxed font-medium text-ink/70">{m.insight}</p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {m.foods.map((f) => (
                            <span key={f} className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-leaf-700 shadow-sm">{f}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle title="Suggested nutrient-rich foods" subtitle="Consolidated from all flagged markers" />
                <div className="mt-4 flex flex-wrap gap-2">
                  {allFoods.map((f) => (
                    <span key={f} className="flex items-center gap-1.5 rounded-full border border-line bg-leaf-75 px-3 py-1.5 text-xs font-bold text-leaf-800">
                      <Apple size={12} className="text-leaf-500" /> {f}
                    </span>
                  ))}
                </div>
              </Card>
            </>
          )}

          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-[12px] leading-relaxed font-medium text-amber-700">
              <span className="font-extrabold">Medical disclaimer:</span> NutriLens provides nutrition-focused insights from sample data and is not a
              medical device. These values are illustrative only — they are not a diagnosis, prescription, or treatment plan. Always consult a
              qualified physician or dietitian before changing your diet based on lab results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
