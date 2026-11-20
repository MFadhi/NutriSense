import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Upload,
  PlusCircle,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Calendar,
  Lock,
  Info,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useApp } from "../context/AppContext";
import { Badge, Card, PageHeader, SectionTitle, Modal } from "../components/ui";
import {
  getConsent,
  setConsent,
  withdrawConsent,
  uploadReport,
  listReports,
  deleteReport,
  saveResults,
  listResults,
  getResultsHistory,
  deleteResult,
  getInsights,
} from "../api/lab";

const PARAMETERS_CONFIG = [
  { id: "fasting_blood_glucose", label: "Fasting Blood Glucose", unit: "mg/dL", normalMin: 70, normalMax: 99, step: 1 },
  { id: "hba1c", label: "HbA1c", unit: "%", normalMin: 4.0, normalMax: 5.6, step: 0.1 },
  { id: "ldl_cholesterol", label: "LDL Cholesterol", unit: "mg/dL", normalMin: 50, normalMax: 99, step: 1 },
  { id: "hdl_cholesterol", label: "HDL Cholesterol", unit: "mg/dL", normalMin: 40, normalMax: 60, step: 1 },
  { id: "triglycerides", label: "Triglycerides", unit: "mg/dL", normalMin: 50, normalMax: 149, step: 1 },
  { id: "haemoglobin", label: "Haemoglobin", unit: "g/dL", normalMin: 12.0, normalMax: 17.5, step: 0.1 },
  { id: "vitamin_d", label: "Vitamin D (25-OH)", unit: "ng/mL", normalMin: 30, normalMax: 100, step: 1 },
  { id: "vitamin_b12", label: "Vitamin B12", unit: "pg/mL", normalMin: 300, normalMax: 900, step: 1 },
];

function ClassificationBadge({ classification }) {
  if (classification === "within_reference" || classification === "optimal") {
    return (
      <Badge color="green">
        <CheckCircle2 size={12} className="mr-1 inline" /> Normal
      </Badge>
    );
  }
  if (classification === "borderline") {
    return (
      <Badge color="amber">
        <AlertTriangle size={12} className="mr-1 inline" /> Borderline
      </Badge>
    );
  }
  if (classification === "above_reference") {
    return (
      <Badge color="red">
        <TrendingUp size={12} className="mr-1 inline" /> Elevated
      </Badge>
    );
  }
  if (classification === "below_reference") {
    return (
      <Badge color="red">
        <AlertTriangle size={12} className="mr-1 inline" /> Low
      </Badge>
    );
  }
  return <Badge color="mist">Recorded</Badge>;
}

export default function LabReports() {
  const { toast } = useApp();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("overview"); // overview | upload | manual | history | insights
  const [consentGranted, setConsentGranted] = useState(false);
  const [loadingConsent, setLoadingConsent] = useState(true);

  // Data states
  const [reports, setReports] = useState([]);
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState({});
  const [insightsData, setInsightsData] = useState(null);

  // Manual entry state
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualValues, setManualValues] = useState({});
  const [manualNotes, setManualNotes] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  // Upload & OCR Draft state
  const [uploading, setUploading] = useState(false);
  const [ocrDraftModalOpen, setOcrDraftModalOpen] = useState(false);
  const [ocrDraft, setOcrDraft] = useState(null);
  const [draftReportId, setDraftReportId] = useState(null);
  const [draftItems, setDraftItems] = useState([]);
  const [savingDraft, setSavingDraft] = useState(false);

  // History chart selected parameter
  const [selectedParam, setSelectedParam] = useState("fasting_blood_glucose");

  const checkConsentStatus = async () => {
    try {
      const res = await getConsent();
      setConsentGranted(Boolean(res?.consented));
    } catch {
      setConsentGranted(false);
    } finally {
      setLoadingConsent(false);
    }
  };

  const loadAllData = async () => {
    try {
      const [reps, resList, hist, ins] = await Promise.all([
        listReports().catch(() => []),
        listResults().catch(() => []),
        getResultsHistory().catch(() => ({})),
        getInsights().catch(() => null),
      ]);
      setReports(Array.isArray(reps) ? reps : []);
      setResults(Array.isArray(resList) ? resList : []);
      setHistory(hist || {});
      setInsightsData(ins);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkConsentStatus();
  }, []);

  useEffect(() => {
    if (consentGranted) {
      loadAllData();
    }
  }, [consentGranted]);

  const handleGrantConsent = async () => {
    try {
      await setConsent(true);
      setConsentGranted(true);
      toast("Laboratory data consent granted. Storage encrypted with AES-256-GCM.");
      loadAllData();
    } catch (err) {
      toast(err?.message || "Failed to save consent.");
    }
  };

  const handleWithdrawConsent = async () => {
    if (window.confirm("Are you sure you want to withdraw laboratory storage consent?")) {
      try {
        await withdrawConsent();
        setConsentGranted(false);
        toast("Laboratory consent withdrawn.");
      } catch (err) {
        toast(err?.message || "Failed to withdraw consent.");
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    setUploading(true);
    try {
      const res = await uploadReport(fd);
      setDraftReportId(res.report_id);
      setOcrDraft(res.draft);
      setDraftItems(
        (res.draft?.extracted_parameters || []).map((p, idx) => ({
          ...p,
          tempId: idx,
          enabled: true,
        }))
      );
      setOcrDraftModalOpen(true);
      toast("Report processed. Please verify extracted parameters.");
    } catch (err) {
      toast(err?.message || "Failed to upload and extract report.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmDraft = async () => {
    const toSave = draftItems
      .filter((i) => i.enabled)
      .map((i) => ({
        parameter: i.parameter,
        value: parseFloat(i.value),
        unit: i.unit,
        test_date: ocrDraft?.test_date || manualDate,
        report_id: draftReportId,
      }));

    if (!toSave.length) {
      toast("No parameters selected to save.");
      return;
    }

    setSavingDraft(true);
    try {
      await saveResults(toSave);
      toast(`Successfully saved ${toSave.length} lab parameter(s).`);
      setOcrDraftModalOpen(false);
      loadAllData();
      setActiveTab("overview");
    } catch (err) {
      toast(err?.message || "Failed to save confirmed parameters.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSaveManual = async (e) => {
    e.preventDefault();
    const items = [];
    Object.entries(manualValues).forEach(([param, val]) => {
      if (val !== "" && val !== undefined && val !== null) {
        const cfg = PARAMETERS_CONFIG.find((p) => p.id === param);
        items.push({
          parameter: param,
          value: parseFloat(val),
          unit: cfg ? cfg.unit : "mg/dL",
          test_date: manualDate,
          notes: manualNotes,
        });
      }
    });

    if (!items.length) {
      toast("Please enter at least one laboratory value.");
      return;
    }

    setSavingManual(true);
    try {
      await saveResults(items);
      toast(`Saved ${items.length} laboratory parameter(s).`);
      setManualValues({});
      setManualNotes("");
      loadAllData();
      setActiveTab("overview");
    } catch (err) {
      toast(err?.message || "Failed to save results.");
    } finally {
      setSavingManual(false);
    }
  };

  const handleDeleteResultItem = async (id) => {
    if (window.confirm("Delete this laboratory record?")) {
      try {
        await deleteResult(id);
        toast("Result deleted.");
        loadAllData();
      } catch (err) {
        toast(err?.message || "Failed to delete.");
      }
    }
  };

  const handleDeleteReport = async (id) => {
    if (window.confirm("Delete this report and all extracted results?")) {
      try {
        await deleteReport(id);
        toast("Report deleted.");
        loadAllData();
      } catch (err) {
        toast(err?.message || "Failed to delete report.");
      }
    }
  };

  if (loadingConsent) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-leaf-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratory Intelligence"
        subtitle="Secure encrypted health markers, OCR analysis, and personalized dietary guidance."
      >
        {consentGranted && (
          <button
            onClick={handleWithdrawConsent}
            className="btn btn-outline btn-xs text-mist hover:text-red-600"
          >
            <Lock size={12} className="mr-1" /> Withdraw Consent
          </button>
        )}
      </PageHeader>

      {!consentGranted ? (
        <Card className="border-leaf-300 bg-leaf-50/60 p-7 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-leaf-500 text-white shadow-lg shadow-leaf-500/25">
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-xl font-bold text-ink">Personal Health Data Consent</h2>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-mist">
            NutriSense provides personalized nutrition guidance based on your clinical laboratory results.
            All laboratory data is <span className="font-semibold text-ink">encrypted at rest with AES-256-GCM</span>,
            strictly isolated to your account, and never shared with third parties or medical insurers.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={handleGrantConsent} className="btn btn-primary px-6 shadow-md shadow-leaf-500/20">
              <CheckCircle2 size={16} className="mr-1.5" /> Accept & Enable Lab Intelligence
            </button>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 border-b border-line pb-3">
            {[
              { id: "overview", label: "Overview", icon: CheckCircle2 },
              { id: "upload", label: "Upload & OCR", icon: Upload },
              { id: "manual", label: "Manual Entry", icon: PlusCircle },
              { id: "history", label: "Historical Trends", icon: TrendingUp },
              { id: "insights", label: "Nutrition Insights", icon: Sparkles },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    active
                      ? "bg-leaf-500 text-white shadow-md shadow-leaf-500/25"
                      : "bg-white text-mist hover:bg-leaf-50 hover:text-ink"
                  }`}
                >
                  <Icon size={14} /> {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Card className="p-4">
                  <p className="text-[11px] font-bold text-mist uppercase">Latest Test Date</p>
                  <p className="mt-1 text-xl font-extrabold text-ink">
                    {insightsData?.latest_test_date || "No tests yet"}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-[11px] font-bold text-mist uppercase">Markers Tracked</p>
                  <p className="mt-1 text-xl font-extrabold text-ink">
                    {insightsData?.total_parameters_recorded || 0} / 8
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-[11px] font-bold text-mist uppercase">Within Reference</p>
                  <p className="mt-1 text-xl font-extrabold text-leaf-600">
                    {insightsData?.normal_count || 0}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-[11px] font-bold text-mist uppercase">Requiring Attention</p>
                  <p className="mt-1 text-xl font-extrabold text-amber-600">
                    {insightsData?.attention_count || 0}
                  </p>
                </Card>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <SectionTitle title="Current Laboratory Markers" />
                  <div className="flex gap-2">
                    <button onClick={() => setActiveTab("upload")} className="btn btn-soft btn-xs">
                      <Upload size={12} className="mr-1" /> Upload Report
                    </button>
                    <button onClick={() => setActiveTab("manual")} className="btn btn-primary btn-xs">
                      <PlusCircle size={12} className="mr-1" /> Log Values
                    </button>
                  </div>
                </div>

                {results.length === 0 ? (
                  <Card className="p-8 text-center">
                    <FileText size={36} className="mx-auto text-mist" />
                    <p className="mt-3 text-sm font-bold text-ink">No laboratory values recorded</p>
                    <p className="mt-1 text-xs text-mist">
                      Upload your blood test PDF/image or enter values manually to unlock personalized insights.
                    </p>
                    <button onClick={() => setActiveTab("upload")} className="btn btn-primary mt-4">
                      Upload Report
                    </button>
                  </Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {PARAMETERS_CONFIG.map((cfg) => {
                      const res = results.find((r) => r.parameter === cfg.id);
                      return (
                        <Card key={cfg.id} className="relative p-4">
                          <div className="flex items-start justify-between">
                            <p className="text-xs font-bold text-ink">{cfg.label}</p>
                            {res ? (
                              <ClassificationBadge classification={res.classification} />
                            ) : (
                              <Badge color="mist">Not logged</Badge>
                            )}
                          </div>
                          {res ? (
                            <div className="mt-3">
                              <div className="flex items-baseline gap-1">
                                <span className="font-display text-2xl font-bold text-ink">{res.value}</span>
                                <span className="text-xs font-semibold text-mist">{res.unit}</span>
                              </div>
                              <p className="mt-1 text-[10px] font-medium text-mist">
                                Ref: {cfg.normalMin} - {cfg.normalMax} {cfg.unit}
                              </p>
                              <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-[10px] text-mist">
                                <span>{res.test_date}</span>
                                <button
                                  onClick={() => handleDeleteResultItem(res.id)}
                                  className="text-red-500 hover:text-red-700"
                                  title="Delete record"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 text-center">
                              <p className="text-[11px] text-mist">Target: {cfg.normalMin} - {cfg.normalMax} {cfg.unit}</p>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {reports.length > 0 && (
                <div>
                  <SectionTitle title="Uploaded Laboratory Documents" />
                  <div className="mt-3 space-y-2">
                    {reports.map((rep) => (
                      <Card key={rep.id} className="flex items-center justify-between p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-100 text-leaf-600">
                            <FileText size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-ink">{rep.original_filename}</p>
                            <p className="text-[10px] text-mist">
                              {rep.report_date} · {rep.result_count} parameters extracted
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteReport(rep.id)}
                          className="btn btn-outline btn-xs text-red-500 hover:border-red-300 hover:bg-red-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "upload" && (
            <div className="space-y-5">
              <Card className="p-8 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                />
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-leaf-100 text-leaf-600">
                  <Upload size={28} />
                </div>
                <h3 className="mt-3 text-base font-bold text-ink">Upload Laboratory Report</h3>
                <p className="mx-auto mt-1 max-w-sm text-xs text-mist">
                  Upload PDF, PNG, or JPG lab reports. Our OCR parses values as editable drafts for your approval.
                </p>
                <div className="mt-5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="btn btn-primary px-5 shadow-md shadow-leaf-500/25"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Extracting Parameters...
                      </span>
                    ) : (
                      <>
                        <Upload size={14} className="mr-1.5" /> Select Report File
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-3 text-[10px] text-mist">
                  Supported formats: PDF, JPG, PNG up to 10 MB. Never auto-saved without confirmation.
                </p>
              </Card>
            </div>
          )}

          {activeTab === "manual" && (
            <Card className="p-6">
              <form onSubmit={handleSaveManual} className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-ink">Manual Parameter Entry</h3>
                  <p className="text-xs text-mist">Enter any blood test parameters available on your physical report.</p>
                </div>

                <div className="max-w-xs">
                  <label className="mb-1 block text-xs font-bold text-ink">Test Date</label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="input h-10 w-full"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {PARAMETERS_CONFIG.map((cfg) => (
                    <div key={cfg.id} className="rounded-xl border border-line bg-leaf-50/20 p-3.5">
                      <label className="block text-xs font-bold text-ink">{cfg.label}</label>
                      <span className="text-[10px] text-mist">
                        Ref: {cfg.normalMin} - {cfg.normalMax} {cfg.unit}
                      </span>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          step={cfg.step}
                          placeholder="e.g. 95"
                          value={manualValues[cfg.id] || ""}
                          onChange={(e) =>
                            setManualValues({ ...manualValues, [cfg.id]: e.target.value })
                          }
                          className="input h-9 flex-1"
                        />
                        <span className="text-xs font-semibold text-mist">{cfg.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-ink">Notes / Lab Facility (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Annual preventive checkup"
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    className="input h-10 w-full"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingManual}
                    className="btn btn-primary px-6 shadow-md shadow-leaf-500/25"
                  >
                    {savingManual ? "Saving..." : "Save Parameters"}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === "history" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle title="Historical Trend Analysis" />
                <select
                  value={selectedParam}
                  onChange={(e) => setSelectedParam(e.target.value)}
                  className="input h-9 text-xs font-bold"
                >
                  {PARAMETERS_CONFIG.map((cfg) => (
                    <option key={cfg.id} value={cfg.id}>
                      {cfg.label} ({cfg.unit})
                    </option>
                  ))}
                </select>
              </div>

              {history[selectedParam]?.records?.length > 0 ? (
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-ink">
                        {PARAMETERS_CONFIG.find((p) => p.id === selectedParam)?.label}
                      </p>
                      <p className="text-xs text-mist">
                        Latest: <span className="font-bold text-ink">{history[selectedParam].latest?.value} {history[selectedParam].standard_unit}</span>
                        {history[selectedParam].delta !== null && (
                          <span className={`ml-2 font-bold ${history[selectedParam].delta > 0 ? "text-amber-600" : "text-leaf-600"}`}>
                            ({history[selectedParam].delta > 0 ? `+${history[selectedParam].delta}` : history[selectedParam].delta})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history[selectedParam].records}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="test_date" tick={{ fontSize: 11, fill: "#6b7280" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#16a34a"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "#16a34a" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              ) : (
                <Card className="p-8 text-center">
                  <TrendingUp size={32} className="mx-auto text-mist" />
                  <p className="mt-2 text-sm font-bold text-ink">No historical readings for this parameter</p>
                  <p className="mt-1 text-xs text-mist">Log at least one result to view trends over time.</p>
                </Card>
              )}
            </div>
          )}

          {activeTab === "insights" && (
            <div className="space-y-5">
              <Card className="border-leaf-200 bg-leaf-50/50 p-4 text-xs text-leaf-800">
                <Info size={16} className="mr-1.5 inline text-leaf-600" />
                These dietary suggestions represent educational guidance based on your configured laboratory reference ranges.
                They are not a medical diagnosis or treatment plan. Always consult a qualified physician or dietitian.
              </Card>

              {(!insightsData?.insights || insightsData.insights.length === 0) ? (
                <Card className="p-8 text-center">
                  <Sparkles size={32} className="mx-auto text-mist" />
                  <p className="mt-2 text-sm font-bold text-ink">No insights available yet</p>
                  <p className="mt-1 text-xs text-mist">Log your blood test values to generate tailored dietary recommendations.</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {insightsData.insights.map((ins) => (
                    <Card key={ins.parameter} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
                        <div>
                          <p className="text-sm font-bold text-ink">{ins.display_name}</p>
                          <p className="text-xs text-mist">
                            Recorded value: <span className="font-extrabold text-ink">{ins.value} {ins.unit}</span>
                          </p>
                        </div>
                        <ClassificationBadge classification={ins.classification} />
                      </div>

                      <p className="mt-3 text-xs leading-relaxed text-ink/80">{ins.explanation}</p>

                      {ins.recommendations?.map((rec, rIdx) => (
                        <div key={rIdx} className="mt-4 rounded-2xl bg-leaf-50/40 p-4 border border-leaf-100">
                          <p className="text-xs font-bold text-leaf-800">{rec.title}</p>
                          <p className="mt-1 text-[11px] text-mist">{rec.explanation}</p>

                          {rec.foods?.length > 0 && (
                            <div className="mt-3">
                              <p className="text-[10px] font-bold tracking-wider text-leaf-700 uppercase">
                                Recommended Foods
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-2">
                                {rec.foods.map((food) => (
                                  <span
                                    key={food.id}
                                    className="inline-flex items-center gap-1 rounded-lg border border-leaf-200 bg-white px-2.5 py-1 text-xs font-semibold text-leaf-900 shadow-2xs"
                                  >
                                    {food.name_en}
                                    <Badge color={food.diet === "veg" ? "green" : food.diet === "vegan" ? "blue" : "amber"}>
                                      {food.diet}
                                    </Badge>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {rec.limit_foods?.length > 0 && (
                            <div className="mt-3">
                              <p className="text-[10px] font-bold tracking-wider text-red-600 uppercase">
                                Foods to Moderate
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-2">
                                {rec.limit_foods.map((food) => (
                                  <span
                                    key={food.id}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 shadow-2xs"
                                  >
                                    {food.name_en}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* OCR REVIEW & CONFIRMATION MODAL */}
      <Modal
        open={ocrDraftModalOpen}
        onClose={() => setOcrDraftModalOpen(false)}
        title="Verify Extracted Laboratory Values"
      >
        <div className="space-y-4">
          <p className="text-xs text-mist">
            Confirm, edit, or remove parameters extracted from your report. Nothing is saved until you click confirm.
          </p>

          <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
            {draftItems.map((item, idx) => (
              <div
                key={idx}
                className={`rounded-xl border p-3 transition-colors ${
                  item.enabled ? "border-leaf-300 bg-leaf-50/20" : "border-line bg-gray-50 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => {
                        const copy = [...draftItems];
                        copy[idx].enabled = e.target.checked;
                        setDraftItems(copy);
                      }}
                      className="rounded text-leaf-500"
                    />
                    <span className="text-xs font-bold text-ink">{item.display_name}</span>
                  </div>
                  {item.confidence && (
                    <span className="text-[10px] font-semibold text-mist">
                      {Math.round(item.confidence * 100)}% confidence
                    </span>
                  )}
                </div>

                {item.enabled && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      value={item.value}
                      onChange={(e) => {
                        const copy = [...draftItems];
                        copy[idx].value = e.target.value;
                        setDraftItems(copy);
                      }}
                      className="input h-8 w-24 text-xs"
                    />
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => {
                        const copy = [...draftItems];
                        copy[idx].unit = e.target.value;
                        setDraftItems(copy);
                      }}
                      className="input h-8 w-20 text-xs"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setOcrDraftModalOpen(false)}
              className="btn btn-outline btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDraft}
              disabled={savingDraft}
              className="btn btn-primary btn-sm shadow-md shadow-leaf-500/25"
            >
              {savingDraft ? "Saving..." : "Confirm & Save Parameters"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
