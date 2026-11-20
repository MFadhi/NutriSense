/**
 * src/api/mock/mockAdapter.js
 * In-memory / localStorage mock backend satisfying the API interface when VITE_USE_MOCK=true.
 */
import { FOODS } from "../../data/foods";
import { WEEKLY } from "../../data/extras";

// In-memory mock store
let mockUser = { id: 1, email: "demo@nutrilens.app" };
let mockProfile = {
  height_cm: 175,
  weight_kg: 70,
  activity_level: "moderate",
  diet_type: "veg",
  goal: "maintain",
  sex: "male",
  dob: "1996-05-15",
};

let _mockLogsStore = [];
let _mockWaterStore = [];
let _mockCustomFoodsStore = [];

export const mockAuth = {
  login: async (email, password) => {
    mockUser = { id: 1, email };
    return {
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      user: mockUser,
    };
  },
  register: async (email, password, diet_type) => {
    mockUser = { id: 1, email };
    mockProfile.diet_type = diet_type || "veg";
    return {
      message: "Registered",
      user: mockUser,
    };
  },
  refresh: async () => ({ access_token: "mock-refreshed-token" }),
  getMe: async () => ({
    id: mockUser.id,
    email: mockUser.email,
    profile: mockProfile,
  }),
  updateMe: async (data) => {
    mockProfile = { ...mockProfile, ...data };
    return { profile: mockProfile };
  },
};

export const mockFoods = {
  searchFoods: async (q = "", options = {}) => {
    const query = q.toLowerCase().trim();
    const all = [...FOODS, ..._mockCustomFoodsStore];
    const filtered = all.filter((f) =>
      (f.name || f.name_en || "").toLowerCase().includes(query)
    );
    return {
      foods: filtered.map((f) => ({
        id: f.id,
        name_en: f.name || f.name_en,
        name_hi: f.name_hi || null,
        name_kn: f.name_kn || null,
        category: { label_en: f.category || "General" },
        kcal_per_100g: f.calories || f.kcal_per_100g || 150,
        protein_per_100g: f.protein || f.protein_per_100g || 5,
        carbs_per_100g: f.carbs || f.carbs_per_100g || 20,
        fat_per_100g: f.fat || f.fat_per_100g || 3,
        fibre_per_100g: f.fibre || f.fibre_per_100g || 2,
        diet: f.diet || "veg",
        portions: f.portions || [{ label: "100g serving", grams: 100, is_default: true }],
        warnings: [],
      })),
      total: filtered.length,
    };
  },
  getCategories: async () => [
    { id: 1, slug: "grains", label_en: "Grains & Cereals" },
    { id: 2, slug: "dairy", label_en: "Dairy & Eggs" },
    { id: 3, slug: "produce", label_en: "Fruits & Vegetables" },
  ],
  getFood: async (id) => {
    const f = [...FOODS, ..._mockCustomFoodsStore].find((x) => x.id === id) || FOODS[0];
    return {
      id: f.id,
      name_en: f.name || f.name_en,
      category: { label_en: f.category || "General" },
      kcal_per_100g: f.calories || 150,
      protein_per_100g: f.protein || 5,
      carbs_per_100g: f.carbs || 20,
      fat_per_100g: f.fat || 3,
      fibre_per_100g: 2,
      diet: f.diet || "veg",
      portions: f.portions || [{ label: "1 serving", grams: 100, is_default: true }],
      warnings: [],
    };
  },
  getRecentFoods: async () => [],
  createCustomFood: async (body) => {
    const newFood = {
      id: `custom-${Date.now()}`,
      ...body,
    };
    _mockCustomFoodsStore.push(newFood);
    return { food: newFood };
  },
  updateCustomFood: async (id, body) => {
    const idx = _mockCustomFoodsStore.findIndex((x) => x.id === id);
    if (idx >= 0) _mockCustomFoodsStore[idx] = { ..._mockCustomFoodsStore[idx], ...body };
    return { food: _mockCustomFoodsStore[idx] };
  },
  deleteCustomFood: async (id) => {
    _mockCustomFoodsStore = _mockCustomFoodsStore.filter((x) => x.id !== id);
    return { message: "Deleted" };
  },
};

export const mockLogs = {
  createLog: async (body) => {
    const newLog = {
      id: `log-${Date.now()}`,
      food_id: body.food_id,
      food_name: body.food_name,
      meal: body.meal,
      logged_at: body.logged_at,
      log_date: body.log_date,
      quantity: body.quantity,
      portion_label: body.portion_label,
      portion_grams: body.portion_grams,
      kcal: (150 * Number(body.quantity)).toFixed(2),
      protein_g: (6 * Number(body.quantity)).toFixed(2),
      carbs_g: (20 * Number(body.quantity)).toFixed(2),
      fat_g: (3 * Number(body.quantity)).toFixed(2),
      fibre_g: (2 * Number(body.quantity)).toFixed(2),
    };
    _mockLogsStore.push(newLog);
    return { log: newLog };
  },
  getLogs: async (date) => _mockLogsStore.filter((l) => l.log_date === date),
  updateLog: async (id, body) => {
    const idx = _mockLogsStore.findIndex((l) => l.id === id);
    if (idx >= 0) _mockLogsStore[idx] = { ..._mockLogsStore[idx], ...body };
    return { log: _mockLogsStore[idx] };
  },
  deleteLog: async (id) => {
    _mockLogsStore = _mockLogsStore.filter((l) => l.id !== id);
    return { message: "Deleted" };
  },
};

export const mockWater = {
  addWater: async (body) => {
    const entry = { id: `w-${Date.now()}`, ...body };
    _mockWaterStore.push(entry);
    return { water_log: entry };
  },
  getWater: async (date) => _mockWaterStore.filter((w) => w.log_date === date),
  deleteWater: async (id) => {
    _mockWaterStore = _mockWaterStore.filter((w) => w.id !== id);
    return { message: "Deleted" };
  },
};

export const mockDashboard = {
  getDailyDashboard: async (date) => {
    const dayLogs = _mockLogsStore.filter((l) => l.log_date === date);
    const dayWater = _mockWaterStore.filter((w) => w.log_date === date);
    const consumed = {
      kcal: dayLogs.reduce((s, l) => s + Number(l.kcal || 0), 0),
      protein_g: dayLogs.reduce((s, l) => s + Number(l.protein_g || 0), 0),
      carbs_g: dayLogs.reduce((s, l) => s + Number(l.carbs_g || 0), 0),
      fat_g: dayLogs.reduce((s, l) => s + Number(l.fat_g || 0), 0),
      fibre_g: dayLogs.reduce((s, l) => s + Number(l.fibre_g || 0), 0),
    };
    const waterMl = dayWater.reduce((s, w) => s + Number(w.amount_ml || 0), 0);
    return {
      date,
      targets: {
        kcal: 2556,
        protein_g: 84,
        carbs_g: 395,
        fat_g: 71,
        fibre_g: 36,
        water_ml: 2450,
      },
      consumed,
      remaining: { kcal: Math.max(0, 2556 - consumed.kcal) },
      macro_split_pct: { protein: 15, carbs: 60, fat: 25 },
      meals: {
        breakfast: { kcal: 0, entries: dayLogs.filter((l) => l.meal === "breakfast") },
        lunch: { kcal: 0, entries: dayLogs.filter((l) => l.meal === "lunch") },
        snack: { kcal: 0, entries: dayLogs.filter((l) => l.meal === "snack") },
        dinner: { kcal: 0, entries: dayLogs.filter((l) => l.meal === "dinner") },
      },
      water: {
        ml: waterMl,
        goal_ml: 2450,
        glasses: Math.round(waterMl / 250),
      },
    };
  },
  getWeeklyDashboard: async (end, days = 7) => {
    return {
      start: "2026-11-10",
      end,
      days: WEEKLY.map((w, idx) => ({
        date: `2026-11-${String(10 + idx).padStart(2, "0")}`,
        kcal: w.calories,
        target_kcal: 2000,
        logged_meals: 3,
        water_ml: 2000,
      })),
      target_kcal: 2000,
    };
  },
};

let _mockConsent = true;
let _mockLabResults = [
  {
    id: 1,
    parameter: "fasting_blood_glucose",
    value: 95.0,
    unit: "mg/dL",
    test_date: "2026-11-15",
    classification: "within_reference",
    notes: "Annual checkup",
  },
  {
    id: 2,
    parameter: "haemoglobin",
    value: 13.8,
    unit: "g/dL",
    test_date: "2026-11-15",
    classification: "within_reference",
    notes: "",
  },
];

export const mockLab = {
  getConsent: async () => ({ consented: _mockConsent, consented_at: "2026-11-01T00:00:00Z" }),
  setConsent: async (consented) => {
    _mockConsent = consented;
    return { consented, consented_at: new Date().toISOString() };
  },
  withdrawConsent: async () => {
    _mockConsent = false;
    return { consented: false };
  },
  uploadReport: async () => ({
    report_id: 101,
    filename: "sample_lab_report.pdf",
    draft: {
      test_date: "2026-11-18",
      extracted_parameters: [
        {
          parameter: "fasting_blood_glucose",
          display_name: "Fasting Blood Glucose",
          value: 108.0,
          unit: "mg/dL",
          confidence: 0.95,
          raw_text: "Fasting Blood Glucose : 108 mg/dL",
          needs_review: false,
        },
        {
          parameter: "vitamin_d",
          display_name: "Vitamin D (25-OH)",
          value: 22.0,
          unit: "ng/mL",
          confidence: 0.88,
          raw_text: "Vitamin D 25-OH : 22 ng/mL",
          needs_review: false,
        },
      ],
      total_extracted: 2,
      is_draft: true,
      requires_confirmation: true,
    },
  }),
  listReports: async () => [
    {
      id: 101,
      report_date: "2026-11-18",
      original_filename: "sample_lab_report.pdf",
      processing_status: "completed",
      result_count: 2,
    },
  ],
  getReport: async (id) => ({
    id,
    report_date: "2026-11-18",
    original_filename: "sample_lab_report.pdf",
    results: _mockLabResults,
  }),
  deleteReport: async () => ({ message: "Report deleted" }),
  saveResults: async (results) => {
    const saved = results.map((r, i) => ({
      id: Date.now() + i,
      ...r,
      classification: r.value > 120 ? "above_reference" : "within_reference",
    }));
    _mockLabResults.push(...saved);
    return saved;
  },
  listResults: async () => _mockLabResults,
  getResultsHistory: async () => {
    const history = {};
    const params = [
      "fasting_blood_glucose",
      "hba1c",
      "ldl_cholesterol",
      "hdl_cholesterol",
      "triglycerides",
      "haemoglobin",
      "vitamin_d",
      "vitamin_b12",
    ];
    params.forEach((p) => {
      const recs = _mockLabResults.filter((r) => r.parameter === p);
      history[p] = {
        parameter: p,
        display_name: p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        standard_unit: "mg/dL",
        records: recs,
        latest: recs[recs.length - 1] || null,
        previous: recs[recs.length - 2] || null,
        delta: null,
      };
    });
    return history;
  },
  updateResult: async (id, patch) => {
    const idx = _mockLabResults.findIndex((r) => r.id === id);
    if (idx !== -1) {
      _mockLabResults[idx] = { ..._mockLabResults[idx], ...patch };
      return _mockLabResults[idx];
    }
    return patch;
  },
  deleteResult: async (id) => {
    _mockLabResults = _mockLabResults.filter((r) => r.id !== id);
    return { message: "Deleted" };
  },
  getInsights: async () => ({
    total_parameters_recorded: _mockLabResults.length,
    normal_count: 2,
    attention_count: 0,
    latest_test_date: "2026-11-15",
    insights: [
      {
        parameter: "fasting_blood_glucose",
        display_name: "Fasting Blood Glucose",
        value: 95.0,
        unit: "mg/dL",
        classification: "within_reference",
        label: "Normal Fasting Glucose",
        reference_range: { min: 70.0, max: 99.0 },
        explanation: "Normal fasting blood glucose is between 70 and 99 mg/dL.",
        recommendations: [],
      },
    ],
  }),
  evaluateAdHoc: async (param, val, unit) => ({
    parameter: param,
    value: val,
    unit,
    classification: "within_reference",
  }),
};

export const mockWeather = {
  getCurrent: async (lat, lon, city) => ({
    latitude: lat,
    longitude: lon,
    city: city || "Pune",
    temperature: 31.0,
    humidity: 58.0,
    apparent_temperature: 33.5,
    weather_code: 1,
    condition_text: "Mainly clear",
    fetched_at: new Date().toISOString(),
  }),
  getRecommendations: async (lat, lon, city) => ({
    weather: {
      latitude: lat,
      longitude: lon,
      city: city || "Pune",
      temperature: 31.0,
      humidity: 58.0,
      apparent_temperature: 33.5,
      weather_code: 1,
      condition_text: "Mainly clear",
      fetched_at: new Date().toISOString(),
    },
    hydration: {
      baseline_water_ml: 2500,
      weather_adjustment_ml: 250,
      suggested_total_ml: 2750,
      temperature: 31.0,
      humidity: 58.0,
      explanation: "Warm weather (31.0°C) elevates daily hydration requirements by +250 ml.",
    },
    food_suggestions: [
      {
        id: 1,
        name_en: "Cucumber Salad",
        category: "Salads",
        diet: "vegan",
        tags: ["cooling", "hydrating"],
      },
      {
        id: 2,
        name_en: "Coconut Water",
        category: "Drinks",
        diet: "vegan",
        tags: ["electrolyte", "cooling"],
      },
    ],
  }),
};
