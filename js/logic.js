// Al-Mustanir game logic: dates, ministers, scoring, XP, ranks and medals. No DOM here.

export const DEFAULTS = {
  termStart: "2026-11-01", sessionsPerWeek: 4, pagesPerDay: 20, bedtime: "21:00", wake: "05:00",
  windowHours: 8, sleepTarget: 7, deficitMin: 500, threshold: 70, book: "", revNotes: {},
  trainingDays: "SAT,MON,WED,THU", trainingTime: "18:00", trainingMin: 60, readingTime: "05:30", readingMin: 30,
  windDownMin: 45, checkinTime: "20:00", advisorNotes: "",
  // Body profile for the biological-age estimate, and the daily vitals the watch keeps.
  birthDate: "", sex: "male",
  vitality: { steps: 8000, exerciseMin: 30, standHours: 10, sleepH: 7, daylightMin: 20 },
  // Training slots. Weekly: { id, sport, label?, days[], start, end }. One-off: { id, sport, label?, date, start, end }.
  training: [
    { id: "tennis-mw", sport: "tennis", days: ["MON", "WED"], start: "19:00", end: "21:00" },
    { id: "tennis-th", sport: "tennis", days: ["THU"], start: "09:30", end: "11:00" },
  ],
  trainingOnce: [],
  // The productivity checklist: standing items for every day.
  checklist: [
    { id: "plan", text: "Plan the day before 9:00" },
    { id: "deep", text: "Two hours of deep work" },
    { id: "ship", text: "Ship one meaningful thing" },
    { id: "inbox", text: "Inbox and messages cleared" },
    { id: "tomorrow", text: "Tomorrow’s top three written" },
  ],
  notify: { morning: true, reading: true, training: true, evening: true, windDown: true, advisor: true },
};

export const S = {
  settings: { ...DEFAULTS }, days: {}, health: null, tab: "palace", selected: null, period: null,
  mode: "local", loaded: false, dirty: new Set(), timers: {}, range: 90, err: "",
};

export const PRAYERS = [["fajr", "Fajr", "الفجر"], ["dhuhr", "Dhuhr", "الظهر"], ["asr", "Asr", "العصر"], ["maghrib", "Maghrib", "المغرب"], ["isha", "Isha", "العشاء"]];

// Fixed order and colors (validated for colorblind separation in light and dark mode).
export const MINISTERS = [
  { key: "body", ar: "وزير البدن", en: "Minister of Body", agenda: "Training and diet", color: "body" },
  { key: "knowledge", ar: "وزير المعرفة", en: "Minister of Knowledge", agenda: "Daily reading", color: "knowledge" },
  { key: "faith", ar: "وزير الإيمان", en: "Minister of Faith", agenda: "The five prayers", color: "faith", immune: true },
  { key: "habits", ar: "وزير النظام", en: "Minister of Order", agenda: "Sleep and routines", color: "habits" },
  { key: "purity", ar: "وزير الطهارة", en: "Minister of Purity", agenda: "No porn, keep the schedule", color: "purity" },
];
// The order ministers appear on the decrees page (the agenda's own order).
export const DECREE_ORDER = ["faith", "body", "knowledge", "purity", "habits"];

export const RANKS = [
  { from: 1, ar: "مُرشَّح", en: "Candidate" },
  { from: 3, ar: "مُنتخَب", en: "Elected" },
  { from: 6, ar: "رجل دولة", en: "Statesman" },
  { from: 9, ar: "مُصلِح", en: "Reformer" },
  { from: 12, ar: "المُستنير", en: "The Enlightened" },
];

/* ---------- dates (local calendar days as yyyy-mm-dd) ---------- */
export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const parse = (s) => { const [a, b, c] = s.split("-").map(Number); return new Date(a, b - 1, c); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const addMonths = (s, n) => { const d = parse(s); d.setMonth(d.getMonth() + n); return ymd(d); };
export const diff = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const today = () => ymd(new Date());
export const fmt = (s, o) => parse(s).toLocaleDateString("en-GB", o || { weekday: "long", day: "numeric", month: "long" });
export function hijri(s) {
  try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(parse(s)); }
  catch { return ""; }
}
export function range(a, b) { const out = []; for (let s = a; s < b; s = addDays(s, 1)) out.push(s); return out; }

export function syncBed() {
  const m = String(S.settings.wake || "05:00").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return;
  let t = (Number(m[1]) * 60 + Number(m[2]) - Math.round(Number(S.settings.windowHours || 8) * 60)) % 1440;
  if (t < 0) t += 1440;
  S.settings.bedtime = pad(Math.floor(t / 60)) + ":" + pad(t % 60);
}
export const termEnd = () => addMonths(S.settings.termStart, 3); // exclusive
export const termLength = () => diff(S.settings.termStart, termEnd());
export const termDay = (s) => diff(S.settings.termStart, s) + 1;
export const periods = () => [0, 1, 2].map((i) => ({ i, start: addMonths(S.settings.termStart, i), end: addMonths(S.settings.termStart, i + 1), label: "Month " + (i + 1) }));
export function intervalFor(s) { const w = Math.floor(Math.max(0, diff(S.settings.termStart, s)) / 7) + 1; return w <= 3 ? 3 : w <= 6 ? 7 : w <= 9 ? 14 : 30; }

/* ---------- training slots and the watch ---------- */
export const SPORTS = {
  tennis: { en: "Tennis", ar: "التنس" }, gym: { en: "Gym", ar: "الحديد" }, walk: { en: "Walking pad", ar: "المشي" },
  run: { en: "Running", ar: "الجري" }, swim: { en: "Swimming", ar: "السباحة" }, other: { en: "Training", ar: "التدريب" },
};
export const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const hmMin = (t) => { const m = String(t || "").match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
export const minHM = (m) => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(x / 60)) + ":" + pad(x % 60); };
export const slotName = (x) => x.label || (SPORTS[x.sport] || SPORTS.other).en;
export const hasSchedule = () => (S.settings.training || []).length + (S.settings.trainingOnce || []).length > 0;
export function slotsOn(date) {
  const dow = DOW[parse(date).getDay()];
  return [
    ...(S.settings.training || []).filter((x) => (x.days || []).includes(dow)),
    ...(S.settings.trainingOnce || []).filter((x) => x.date === date),
  ].filter((x) => hmMin(x.start) != null && hmMin(x.end) != null).sort((a, b) => hmMin(a.start) - hmMin(b.start));
}
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
// How much of a slot the watch saw. Workouts (exact times) win; otherwise hourly exercise minutes are
// spread across the hour and counted where they overlap the slot. 30 minutes of slack either side
// covers starting late or staying on court.
export function matchSlot(date, slot, nowMin = null) {
  const d = S.days[date] || {}, a = hmMin(slot.start), b0 = hmMin(slot.end), b = b0 > a ? b0 : b0 + 1440;
  const planned = b - a, A = a - 30, B = b + 30;
  let done = 0, kcal = 0, source = null;
  const wks = (d.workoutsDetail || []).filter((w) => slot.sport === "walk" ? /walk/i.test(w.a) : !/walking pad/i.test(w.a));
  for (const w of wks) {
    const s0 = hmMin(w.s), e0 = hmMin(w.e); if (s0 == null || e0 == null) continue;
    const e1 = e0 >= s0 ? e0 : e0 + 1440, ov = overlap(s0, e1, A, B);
    if (ov > 0) { done += ov; if (w.kcal) kcal += w.kcal * (ov / Math.max(1, e1 - s0)); source = "workout"; }
  }
  if (!source && d.exByHour) {
    for (const [h, v] of Object.entries(d.exByHour)) {
      const h0 = +h * 60, ov = overlap(h0, h0 + 60, A, B);
      if (ov > 0 && v > 0) { done += v * (ov / 60); const kc = (d.kcalByHour || {})[h]; if (kc) kcal += kc * (ov / 60); source = "hourly"; }
    }
  }
  done = Math.round(Math.min(done, planned + 60)); kcal = Math.round(kcal);
  const manual = (d.slotMarks || {})[slot.id];
  const t = today(), past = date < t || (date === t && (nowMin ?? new Date().getHours() * 60 + new Date().getMinutes()) > b);
  let status = manual === "done" ? "done" : manual === "skipped" ? "skipped" : done >= planned * 0.5 ? "done" : done > 0 ? (past ? "partial" : "live") : past ? "missed" : "upcoming";
  const frac = manual === "done" ? 1 : manual === "skipped" ? 0 : Math.min(1, done / planned);
  return { slot, planned, done, kcal, source, status, frac };
}
export const matchDay = (date) => slotsOn(date).map((x) => matchSlot(date, x));

/* ---------- productivity checklist ---------- */
export function checklistFor(date) {
  const d = S.days[date] || {};
  const items = [...(S.settings.checklist || []), ...(d.extraTasks || [])];
  const checks = d.checks || {};
  const done = items.filter((x) => checks[x.id]).length;
  return { items, checks, done, total: items.length, frac: items.length ? done / items.length : null };
}

/* ---------- scoring ---------- */
export const TRAINED = ["gym", "tennis", "walk"];

// A day counts as logged only when something was entered by hand. Health data alone
// (two years of backfill) must not count as days in office.
export function manual(d) {
  if (!d) return false;
  return !!((d.prayers && Object.keys(d.prayers).length) || d.pages > 0 || d.pornFree != null || d.mast != null ||
    d.hair || d.skinAm || d.skinPm || d.teethAm || d.teethPm || d.watch || d.good || d.fix || d.margin > 0 ||
    (d.checks && Object.values(d.checks).some(Boolean)) || (d.slotMarks && Object.keys(d.slotMarks).length) ||
    (d.train && !String(d.source || "").startsWith("Apple Health")) || d.diet != null && d.deficit == null);
}
export function lastMastBefore(s) { let best = null; for (const k in S.days) if (k < s && S.days[k].mast && (!best || k > best)) best = k; return best; }
export function violation(s) { const d = S.days[s]; if (!d || !d.mast) return false; const last = lastMastBefore(s); return !!last && diff(last, s) < intervalFor(s); }

export function day(s) {
  const d = S.days[s];
  if (!manual(d)) return { logged: false, faith: 0, knowledge: 0, diet: 0, trained: 0, porn: 0, plan: 0, habits: 0, rest: 0 };
  const pr = d.prayers || {};
  const faith = PRAYERS.reduce((a, [k]) => a + (pr[k] === "on" ? 1 : pr[k] === "late" ? 0.5 : 0), 0) / 5;
  const slept = (d.sleepH || 0) >= S.settings.sleepTarget;
  const habits = (+!!d.bed + 2 * +!!d.wake + 2 * +slept + +!!d.hair + +!!d.skinAm + +!!d.skinPm + +!!d.teethAm + +!!d.teethPm + +!!d.watch) / 11;
  return {
    logged: true, faith, habits,
    knowledge: Math.min(1, (d.pages || 0) / S.settings.pagesPerDay),
    diet: d.diet === true ? 1 : 0, trained: TRAINED.includes(d.train) ? 1 : 0, rest: d.train === "rest" ? 1 : 0,
    porn: d.pornFree === true ? 1 : 0, plan: violation(s) ? 0 : 1,
  };
}

// Each minister's verdict on one day, 0 to 1. Used for XP and the decrees rings.
export function dayMinisters(s) {
  const x = day(s);
  if (!x.logged) return { body: 0, knowledge: 0, faith: 0, habits: 0, purity: 0 };
  const ms = matchDay(s);
  const training = ms.length ? ms.reduce((a, m) => a + m.frac, 0) / ms.length : (hasSchedule() ? 1 : (x.trained || x.rest)); // no slot today = rest day
  return {
    body: 0.6 * x.diet + 0.4 * training,
    knowledge: x.knowledge >= 1 ? 1 : x.knowledge,
    faith: x.faith,
    habits: x.habits,
    purity: x.porn * x.plan,
  };
}

// Approval over a period, the measure impeachment is judged on.
export function score(dates) {
  const n = dates.length; if (!n) return null;
  const ds = dates.map(day); const sum = (f) => ds.reduce((a, x) => a + x[f], 0);
  let sessions = sum("trained"), planned = S.settings.sessionsPerWeek * n / 7, trainMin = 0, plannedMin = 0;
  if (hasSchedule()) {
    sessions = 0; planned = 0;
    for (const k of dates) for (const m of matchDay(k)) {
      if (m.status === "upcoming" || m.status === "live") continue; // not judged yet
      planned++; plannedMin += m.planned; trainMin += m.status === "skipped" ? 0 : Math.min(m.done, m.planned) + (m.status === "done" && !m.done ? m.planned : 0);
      if (m.status === "done") sessions++;
    }
  }
  const training = Math.min(1, planned ? sessions / planned : 1), diet = sum("diet") / n;
  const porn = sum("porn") / n, plan = ds.reduce((a, x) => a + (x.logged ? x.plan : 0), 0) / n;
  const defs = dates.map((k) => (S.days[k] || {}).deficit).filter((v) => v > 0);
  const walk = dates.reduce((a, k) => a + ((S.days[k] || {}).walkMin || 0), 0);
  const r = {
    n, sessions, planned, training, diet, porn, plan, walk, trainMin, plannedMin,
    avgDeficit: defs.length ? Math.round(defs.reduce((a, b) => a + b, 0) / defs.length) : null,
    logged: ds.filter((x) => x.logged).length,
    body: (training + diet) / 2, faith: sum("faith") / n, knowledge: ds.reduce((a, x) => a + (x.knowledge >= 1 ? 1 : 0), 0) / n,
    purity: (porn + plan) / 2, habits: sum("habits") / n,
  };
  r.overall = (r.body + r.faith + r.knowledge + r.purity + r.habits) / 5;
  return r;
}

export function verdict(x, immune) {
  const t = S.settings.threshold / 100;
  if (x == null) return ["", "No days yet"];
  if (immune) return [x >= t ? "ok" : "warn", x >= t ? "Strong · cannot be impeached" : "Below the line · cannot be impeached, needs attention"];
  if (x >= t + 0.15) return ["ok", "Strong"];
  if (x >= t) return ["warn", "Holding, close to the line"];
  return ["bad", "Impeachment risk"];
}

// Approval for the council period containing `s` (or the first one before the term).
export function currentApproval(s = today()) {
  const ps = periods();
  const p = ps.find((x) => s >= x.start && s < x.end) || (s < ps[0].start ? null : ps[2]);
  const start = p ? p.start : addDays(s, -29);
  const end = s < (p ? p.end : addDays(s, 1)) ? addDays(s, 1) : p.end;
  return { period: p, r: start < end ? score(range(start, end)) : null };
}

/* ---------- XP, levels, ranks ---------- */
export const XP_PER_MINISTER = 20, PERFECT_BONUS = 25, CHECKLIST_XP = 20, VITALITY_XP = 20, MAX_DAY_XP = 5 * 20 + 25 + 20 + 20;
export function dayXP(s) {
  const m = dayMinisters(s);
  const base = Object.values(m).reduce((a, v) => a + v * XP_PER_MINISTER, 0);
  const perfect = Object.values(m).every((v) => v >= 0.9);
  const c = manual(S.days[s]) ? checklistFor(s).frac || 0 : 0;
  const v = manual(S.days[s]) ? vitalityFor(s).frac || 0 : 0;
  return Math.round(base + (perfect ? PERFECT_BONUS : 0) + c * CHECKLIST_XP + v * VITALITY_XP);
}

/* ---------- vitality: the five things the watch keeps every day ---------- */
export const VITALS = [
  { k: "steps", en: "Steps", ar: "خطوات", unit: "", fmt: (v) => Math.round(v).toLocaleString("en") },
  { k: "exerciseMin", en: "Exercise", ar: "تمرين", unit: "min", fmt: (v) => Math.round(v) },
  { k: "standHours", en: "Stand hours", ar: "وقوف", unit: "h", fmt: (v) => Math.round(v) },
  { k: "sleepH", en: "Sleep", ar: "نوم", unit: "h", fmt: (v) => (+v).toFixed(1) },
  { k: "daylightMin", en: "Daylight", ar: "شمس", unit: "min", fmt: (v) => Math.round(v) },
];
export function vitalityFor(s) {
  const d = S.days[s] || {}, goals = { ...DEFAULTS.vitality, ...(S.settings.vitality || {}) };
  const items = VITALS.map((x) => { const val = d[x.k]; const goal = goals[x.k]; return { ...x, val, goal, hit: val != null && val >= goal, frac: val == null ? 0 : Math.min(1, val / goal) }; });
  const seen = items.some((i) => i.val != null);
  const hits = items.filter((i) => i.hit).length;
  return { items, hits, total: items.length, frac: seen ? hits / items.length : null, seen };
}

/* ---------- biological age ----------
   Each measure's effect on all-cause mortality, from large cohort studies and meta-analyses, turned into
   years with the Gompertz law (risk roughly doubles every 8 years of age): years = 8 × log2(hazard ratio).
   An estimate for direction and motivation, not a medical test. */
const YRS = (hr) => 8 * Math.log2(hr);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const vo2Norm = (age) => 48 - 0.49 * (age - 25); // FRIEND registry, men, 50th percentile
export function ageOn(birth, date = today()) {
  if (!birth) return null;
  const b = new Date(birth + "T12:00:00"), d = new Date(date + "T12:00:00");
  return (d - b) / (365.2425 * 86400000);
}
// inputs: averages over the window { vo2max, restingHR, steps, sleepH, bmi, hrv, walking_speed }
export function bioAge(age, m, sex = "male") {
  if (age == null) return null;
  const f = [];
  const add = (k, en, ar, value, years, note) => { if (value != null && isFinite(value)) f.push({ k, en, ar, value, years: Math.round(years * 10) / 10, note }); };
  const norm = sex === "female" ? vo2Norm(age) - 6.5 : vo2Norm(age);
  if (m.vo2max != null) add("vo2max", "Cardio fitness", "اللياقة", m.vo2max, clamp(YRS(0.87) * (m.vo2max - norm) / 3.5, -8, 8), `VO₂ max ${m.vo2max.toFixed(1)} vs ${norm.toFixed(1)} typical for your age · each extra MET (3.5) ≈ 13% lower risk`);
  if (m.restingHR != null) add("restingHR", "Resting heart rate", "نبض الراحة", m.restingHR, clamp(YRS(1.09) * (m.restingHR - 60) / 10, -2, 4), `${Math.round(m.restingHR)} bpm · each 10 bpm above 60 ≈ 9% higher risk`);
  if (m.steps != null) {
    const st = m.steps, base = 7000;
    const y = st < base ? YRS(1 / 0.88) * (base - st) / 1000 : -YRS(1 / 0.88) * 0.5 * (Math.min(st, 12000) - base) / 1000;
    add("steps", "Daily steps", "الخطوات", st, clamp(y, -4, 6), `${Math.round(st).toLocaleString("en")} a day · each 1,000 steps up to ~10k ≈ 12% lower risk`);
  }
  if (m.sleepH != null) {
    const h = m.sleepH, y = h < 7 ? YRS(1.06) * (7 - h) : h > 9 ? YRS(1.13) * (h - 9) : 0;
    add("sleepH", "Sleep", "النوم", h, clamp(y, 0, 4), `${h.toFixed(1)} h a night · 7–9 h is the lowest-risk band`);
  }
  if (m.bmi != null) {
    const b = m.bmi, y = b > 25 ? YRS(1.31) * (b - 25) / 5 : b < 18.5 ? YRS(1.5) * (18.5 - b) / 2 : 0;
    add("bmi", "Body mass index", "كتلة الجسم", b, clamp(y, 0, 10), `BMI ${b.toFixed(1)} · each 5 points above 25 ≈ 31% higher risk`);
  }
  if (m.hrv != null) { const hn = 70 - 0.7 * age; add("hrv", "Heart rate variability", "تقلب النبض", m.hrv, clamp(-0.08 * (m.hrv - hn), -2, 2), `${Math.round(m.hrv)} ms vs ~${Math.round(hn)} typical for your age`); }
  if (m.walking_speed != null) add("walking_speed", "Walking speed", "سرعة المشي", m.walking_speed, clamp(-1.5 * (m.walking_speed - 4.6), -1.5, 2), `${m.walking_speed.toFixed(1)} km/h · brisk walkers live longer`);
  const delta = f.reduce((a, x) => a + x.years, 0);
  const fitnessAge = m.vo2max != null ? Math.max(18, 25 + (48 - (sex === "female" ? m.vo2max + 6.5 : m.vo2max)) / 0.49) : null;
  return { age, bio: age + delta, delta, factors: f.sort((a, b) => b.years - a.years), fitnessAge };
}
// Average a daily series over [from, to]; "last" takes the latest reading within `lookback` days.
export function windowAvg(series, from, to) {
  const v = (series || []).filter(([d]) => d >= from && d <= to).map(([, x]) => x);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
export function lastWithin(series, to, lookback) {
  const from = addDays(to, -lookback); let out = null;
  for (const [d, x] of series || []) if (d >= from && d <= to) out = x;
  return out;
}
export function bioInputs(H, to, days = 60) {
  const from = addDays(to, -days + 1);
  return {
    vo2max: lastWithin(H.vo2max, to, 240), restingHR: windowAvg(H.restingHR, from, to), steps: windowAvg(H.steps, from, to),
    sleepH: windowAvg(H.sleepH, from, to), bmi: lastWithin(H.bmi, to, 400), hrv: windowAvg(H.hrv, from, to), walking_speed: windowAvg(H.walking_speed, from, to),
  };
}
export const levelStart = (L) => 50 * L * (L - 1); // XP needed to reach level L
export function levelFor(xp) {
  let L = 1; while (levelStart(L + 1) <= xp) L++;
  const from = levelStart(L), to = levelStart(L + 1);
  return { level: L, from, to, into: xp - from, need: to - from, frac: (xp - from) / (to - from) };
}
export const rankFor = (L) => RANKS.filter((r) => L >= r.from).pop();
export function totals() {
  let xp = 0, logged = 0, perfect = 0;
  for (const k of Object.keys(S.days)) {
    if (!manual(S.days[k])) continue;
    logged++; const x = dayXP(k); xp += x;
    if (Object.values(dayMinisters(k)).every((v) => v >= 0.9)) perfect++;
  }
  return { xp, logged, perfect, ...levelFor(xp) };
}

// Consecutive days ending today (or yesterday, if today isn't logged yet) that satisfy `test`.
export function streak(test, from = today()) {
  let n = 0, s = from;
  if (!S.days[s] || !test(S.days[s], s)) s = addDays(s, -1);
  while (S.days[s] && test(S.days[s], s)) { n++; s = addDays(s, -1); }
  return n;
}
export function bestStreak(test) {
  const keys = Object.keys(S.days).sort(); let best = 0, cur = 0, prev = null;
  for (const k of keys) {
    if (test(S.days[k], k)) { cur = prev && diff(prev, k) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = k; }
    else { cur = 0; prev = null; }
  }
  return best;
}
export const T = {
  productive: (d, s) => (checklistFor(s).frac || 0) >= 0.8,
  vital: (d, s) => manual(d) && vitalityFor(s).hits >= 4,
  office: (d) => manual(d),
  prayers: (d, s) => day(s).faith === 1,
  pure: (d) => d.pornFree === true,
  read: (d) => (d.pages || 0) >= S.settings.pagesPerDay,
  fajr: (d) => d.wake === true,
};

/* ---------- medals ---------- */
export const MEDALS = [
  { id: "first", ar: "أول مرسوم", en: "First decree", how: "Log your first day", test: (t) => t.logged >= 1 },
  { id: "fajr7", ar: "وسام الفجر", en: "Order of Fajr", how: "Up for Fajr 7 days in a row", test: () => bestStreak(T.fajr) >= 7 },
  { id: "pray7", ar: "المحافظ", en: "The Steadfast", how: "All five prayers 7 days in a row", test: () => bestStreak(T.prayers) >= 7 },
  { id: "pray40", ar: "الأربعين", en: "The Forty", how: "All five prayers 40 days in a row", test: () => bestStreak(T.prayers) >= 40 },
  { id: "pure7", ar: "العفيف", en: "The Chaste · 7", how: "7 porn-free days in a row", test: () => bestStreak(T.pure) >= 7 },
  { id: "pure30", ar: "الطاهر", en: "The Pure · 30", how: "30 porn-free days in a row", test: () => bestStreak(T.pure) >= 30 },
  { id: "pure90", ar: "المنتصر", en: "The Victor · 90", how: "90 porn-free days in a row", test: () => bestStreak(T.pure) >= 90 },
  { id: "read7", ar: "طالب العلم", en: "Seeker of knowledge", how: "Hit your pages 7 days in a row", test: () => bestStreak(T.read) >= 7 },
  { id: "pages1000", ar: "ألف صفحة", en: "A thousand pages", how: "Read 1,000 pages in total", test: () => Object.values(S.days).reduce((a, d) => a + (d.pages || 0), 0) >= 1000 },
  { id: "perfect", ar: "يوم كامل", en: "Perfect day", how: "Every minister at 90% or more in one day", test: (t) => t.perfect >= 1 },
  { id: "perfect7", ar: "أسبوع ذهبي", en: "Golden week", how: "7 perfect days", test: (t) => t.perfect >= 7 },
  { id: "iron", ar: "الحديد", en: "Iron", how: "Train 30 sessions", test: () => Object.values(S.days).filter((d) => TRAINED.includes(d.train)).length >= 30 },
  { id: "deficit", ar: "الصائم عن الزيادة", en: "Master of the deficit", how: "30 days on your deficit target", test: () => Object.values(S.days).filter((d) => d.diet === true).length >= 30 },
  { id: "chancellor", ar: "المُنجِز", en: "The Achiever", how: "80% of the checklist 7 days in a row", test: () => bestStreak(T.productive) >= 7 },
  { id: "vital7", ar: "الحيوية", en: "Vitality · 7", how: "4 of the 5 vitals 7 days in a row", test: () => bestStreak(T.vital) >= 7 },
  { id: "vital30", ar: "الجسد الحي", en: "Vitality · 30", how: "4 of the 5 vitals 30 days in a row", test: () => bestStreak(T.vital) >= 30 },
  { id: "office30", ar: "شهر في الحكم", en: "A month in office", how: "Log 30 days in a row", test: () => bestStreak(T.office) >= 30 },
  { id: "term", ar: "إتمام الولاية", en: "Term complete", how: "Reach the end of a term", test: () => today() >= termEnd() && Object.keys(S.days).some((k) => k >= addDays(termEnd(), -7) && manual(S.days[k])) },
];
export function medals() { const t = totals(); return MEDALS.map((m) => ({ ...m, won: !!m.test(t) })); }

export const pct = (x) => (x == null ? "—" : Math.round(x * 100) + "%");

// One verse for the palace: the term's whole idea, change begins within.
export const AYAH = { ar: "إِنَّ ٱللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا۟ مَا بِأَنفُسِهِمْ", en: "Allah does not change the condition of a people until they change what is within themselves.", ref: "Ar-Ra'd 13:11" };
