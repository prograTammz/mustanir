// Al-Mustanir game logic: dates, ministers, scoring, XP, ranks and medals. No DOM here.

export const DEFAULTS = {
  termStart: "2026-11-01", sessionsPerWeek: 4, pagesPerDay: 20, bedtime: "21:00", wake: "05:00",
  windowHours: 8, sleepTarget: 7, deficitMin: 500, threshold: 70, book: "", revNotes: {},
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

/* ---------- scoring ---------- */
export const TRAINED = ["gym", "tennis", "walk"];

// A day counts as logged only when something was entered by hand. Health data alone
// (two years of backfill) must not count as days in office.
export function manual(d) {
  if (!d) return false;
  return !!((d.prayers && Object.keys(d.prayers).length) || d.pages > 0 || d.pornFree != null || d.mast != null ||
    d.hair || d.skinAm || d.skinPm || d.teethAm || d.teethPm || d.watch || d.good || d.fix || d.margin > 0 ||
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
  return {
    body: 0.6 * x.diet + 0.4 * (x.trained || x.rest),
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
  const sessions = sum("trained"), planned = S.settings.sessionsPerWeek * n / 7;
  const training = Math.min(1, planned ? sessions / planned : 1), diet = sum("diet") / n;
  const porn = sum("porn") / n, plan = ds.reduce((a, x) => a + (x.logged ? x.plan : 0), 0) / n;
  const defs = dates.map((k) => (S.days[k] || {}).deficit).filter((v) => v > 0);
  const walk = dates.reduce((a, k) => a + ((S.days[k] || {}).walkMin || 0), 0);
  const r = {
    n, sessions, planned, training, diet, porn, plan, walk,
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
export const XP_PER_MINISTER = 20, PERFECT_BONUS = 25;
export function dayXP(s) {
  const m = dayMinisters(s);
  const base = Object.values(m).reduce((a, v) => a + v * XP_PER_MINISTER, 0);
  const perfect = Object.values(m).every((v) => v >= 0.9);
  return Math.round(base + (perfect ? PERFECT_BONUS : 0));
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
  { id: "office30", ar: "شهر في الحكم", en: "A month in office", how: "Log 30 days in a row", test: () => bestStreak(T.office) >= 30 },
  { id: "term", ar: "إتمام الولاية", en: "Term complete", how: "Reach the end of a term", test: () => today() >= termEnd() && Object.keys(S.days).some((k) => k >= addDays(termEnd(), -7) && manual(S.days[k])) },
];
export function medals() { const t = totals(); return MEDALS.map((m) => ({ ...m, won: !!m.test(t) })); }

export const pct = (x) => (x == null ? "—" : Math.round(x * 100) + "%");

// One verse for the palace: the term's whole idea, change begins within.
export const AYAH = { ar: "إِنَّ ٱللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا۟ مَا بِأَنفُسِهِمْ", en: "Allah does not change the condition of a people until they change what is within themselves.", ref: "Ar-Ra'd 13:11" };
