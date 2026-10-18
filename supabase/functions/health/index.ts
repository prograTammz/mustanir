// Al-Mustanir Health ingest.
// An iOS Shortcut POSTs batches of Apple Health data here with "Authorization: Bearer <key>".
// Body: { kind?: "daily" | "backfill", samples?: Sample[], workouts?: Workout[] }
//   Sample  = { type, start, end?, value?, unit?, source? }   type: our key ("steps") or Apple's name ("Step Count")
//             Sleep: { type: "Sleep", value: "Core" | "Deep" | "REM" | "Awake" | "In Bed" | "Asleep", start, end }
//   Workout = { activity, start, end, duration?, energy?, distance?, avgHR?, maxHR?, source? }
// Everything is upserted on natural keys, so resending an overlapping window is safe.
// After saving, daily totals are recomputed and the tracker's measured fields are refreshed.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TZ = "Africa/Cairo";
const MAX_ITEMS = 50000;
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const n = Number(String(v).replace(",", ".").replace(/[^\d.\-eE]/g, ""));
  return isNaN(n) ? null : n;
};

// Apple Health / Shortcuts names → our keys. Matching ignores case, spaces and punctuation.
const ALIASES: Record<string, string> = {
  stepcount: "steps", steps: "steps",
  walkingrunningdistance: "distance", distancewalkingrunning: "distance", distance: "distance",
  flightsclimbed: "flights", flights: "flights",
  activeenergy: "activeKcal", activeenergyburned: "activeKcal", activekcal: "activeKcal",
  restingenergy: "basalKcal", basalenergyburned: "basalKcal", basalkcal: "basalKcal",
  exerciseminutes: "exerciseMin", appleexercisetime: "exerciseMin", exercisemin: "exerciseMin",
  standminutes: "standMin", applestandtime: "standMin", standmin: "standMin",
  standhours: "standHours", applestandhour: "standHours",
  heartrate: "heartRate", restingheartrate: "restingHR", restinghr: "restingHR",
  walkingheartrateaverage: "walkingHR", walkinghr: "walkingHR",
  heartratevariability: "hrv", heartratevariabilitysdnn: "hrv", hrv: "hrv",
  vo2max: "vo2max", cardiofitness: "vo2max",
  bloodoxygen: "spo2", oxygensaturation: "spo2", spo2: "spo2",
  respiratoryrate: "respRate", resprate: "respRate",
  wristtemperature: "wristTemp", sleepingwristtemperature: "wristTemp", applesleepingwristtemperature: "wristTemp", wristtemp: "wristTemp",
  weight: "weight", bodymass: "weight",
  bodyfatpercentage: "bodyFat", bodyfat: "bodyFat",
  leanbodymass: "leanMass", leanmass: "leanMass",
  bodymassindex: "bmi", bmi: "bmi", waistcircumference: "waist", waist: "waist",
  dietaryenergy: "dietaryKcal", dietaryenergyconsumed: "dietaryKcal", dietarykcal: "dietaryKcal",
  protein: "protein", dietaryprotein: "protein",
  carbohydrates: "carbs", dietarycarbohydrates: "carbs", carbs: "carbs",
  totalfat: "fat", dietaryfattotal: "fat", fat: "fat",
  water: "water", dietarywater: "water", caffeine: "caffeine", dietarycaffeine: "caffeine",
  mindfulminutes: "mindfulMin", mindfulsession: "mindfulMin", mindfulmin: "mindfulMin",
  timeindaylight: "daylightMin", daylightmin: "daylightMin",
  environmentalaudioexposure: "noiseDb", environmentalsoundlevels: "noiseDb", noisedb: "noiseDb",
};
const SLEEP_STAGES: Record<string, string> = {
  core: "sleepCore", asleepcore: "sleepCore", deep: "sleepDeep", asleepdeep: "sleepDeep",
  rem: "sleepREM", asleeprem: "sleepREM", awake: "sleepAwake", inbed: "sleepInBed",
  asleep: "sleepAsleep", asleepunspecified: "sleepAsleep",
};
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIAS_N: Record<string, string> = Object.fromEntries(Object.entries(ALIASES).map(([k, v]) => [norm(k), v]));

function metricOf(type: unknown, value: unknown): string | null {
  const t = norm(type);
  if (!t) return null;
  if (ALIAS_N[t]) return ALIAS_N[t];
  if (t.startsWith("sleep")) return SLEEP_STAGES[norm(value)] || SLEEP_STAGES[t.replace(/^sleep(analysis)?/, "")] || null;
  return String(type).trim().slice(0, 64); // unknown types are kept as sent
}

// Cairo calendar day for an instant (handles Egypt's daylight-saving switch).
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const cairoDay = (d: Date) => dayFmt.format(d);
const cairoTime = (d: Date) => timeFmt.format(d);

// Accepts ISO 8601 with offset, or "yyyy-MM-dd HH:mm[:ss]" read as Cairo local time.
function parseDate(v: unknown): Date | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return new Date(v > 1e12 ? v : v * 1000);
  const s = String(v).trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) { const d = new Date(s.replace(" ", "T")); return isNaN(+d) ? null : d; }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) { const d = new Date(s); return isNaN(+d) ? null : d; }
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asCairo = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess - (asCairo - guess));
}

// deno-lint-ignore no-explicit-any
function scores(d: any, s: any) {
  const pr = d.prayers || {};
  const faith = PRAYERS.reduce((a, k) => a + (pr[k] === "on" ? 1 : pr[k] === "late" ? 0.5 : 0), 0) / 5;
  const knowledge = (d.pages || 0) >= (s.pagesPerDay || 20) ? 1 : 0;
  const slept = (d.sleepH || 0) >= (s.sleepTarget || 7) ? 1 : 0;
  const habits = (+!!d.bed + 2 * +!!d.wake + 2 * slept + +!!d.hair + +!!d.skinAm + +!!d.skinPm + +!!d.teethAm + +!!d.teethPm + +!!d.watch) / 11;
  return { faith, knowledge, habits };
}
const hm = (s: string) => { const m = String(s || "").match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };

async function chunked<T>(rows: T[], size: number, fn: (part: T[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  const key = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return json({ ok: false, error: "Missing key." }, 401);
  const keyHash = await sha256(key);
  const { data: tok } = await admin.from("ingest_tokens").select("user_id").eq("token_hash", keyHash).maybeSingle();
  if (!tok) return json({ ok: false, error: "Wrong key." }, 401);
  const uid = tok.user_id as string;

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return json({ ok: false, error: "Body must be JSON." }, 400); }
  const kind = b.kind === "backfill" ? "backfill" : "daily";
  const rawSamples = Array.isArray(b.samples) ? b.samples : [];
  const rawWorkouts = Array.isArray(b.workouts) ? b.workouts : [];
  if (rawSamples.length + rawWorkouts.length > MAX_ITEMS) return json({ ok: false, error: `Send at most ${MAX_ITEMS} items per request; split the range.` }, 413);

  const days = new Set<string>();
  const skipped: string[] = [];
  const sampleMap = new Map<string, Record<string, unknown>>();
  for (const r of rawSamples) {
    const metric = metricOf(r.type ?? r.metric, r.value);
    const start = parseDate(r.start ?? r.startDate);
    const end = parseDate(r.end ?? r.endDate) || start;
    if (!metric || !start || !end) { if (skipped.length < 5) skipped.push(JSON.stringify(r).slice(0, 120)); continue; }
    const isSleep = metric.startsWith("sleep");
    const value = isSleep ? (end.getTime() - start.getTime()) / 60000 : num(r.value);
    if (value === null) { if (skipped.length < 5) skipped.push(JSON.stringify(r).slice(0, 120)); continue; }
    const day = cairoDay(isSleep ? end : start); // sleep counts toward the morning you wake
    days.add(day);
    const row = { user_id: uid, metric, start_at: start.toISOString(), end_at: end.toISOString(), value, unit: r.unit ? String(r.unit).slice(0, 32) : null, source: String(r.source ?? "").slice(0, 120), day };
    sampleMap.set(`${metric}|${row.start_at}|${row.end_at}|${row.source}`, row); // dedupe within the batch
  }
  const workoutMap = new Map<string, Record<string, unknown>>();
  for (const w of rawWorkouts) {
    const start = parseDate(w.start ?? w.startDate);
    const end = parseDate(w.end ?? w.endDate) || start;
    const activity = String(w.activity ?? w.type ?? "").trim().slice(0, 64);
    if (!start || !end || !activity) { if (skipped.length < 5) skipped.push(JSON.stringify(w).slice(0, 120)); continue; }
    const day = cairoDay(start);
    days.add(day);
    const row = {
      user_id: uid, activity, start_at: start.toISOString(), end_at: end.toISOString(),
      duration_min: num(w.duration) ?? (end.getTime() - start.getTime()) / 60000,
      energy_kcal: num(w.energy), distance_km: num(w.distance), avg_hr: num(w.avgHR), max_hr: num(w.maxHR),
      source: String(w.source ?? "").slice(0, 120), day,
    };
    workoutMap.set(`${activity}|${row.start_at}`, row);
  }
  const samples = [...sampleMap.values()], workouts = [...workoutMap.values()];

  try {
    await chunked(samples, 1000, async (part) => {
      const { error } = await admin.from("health_samples").upsert(part, { onConflict: "user_id,metric,start_at,end_at,source" });
      if (error) throw error;
    });
    await chunked(workouts, 500, async (part) => {
      const { error } = await admin.from("health_workouts").upsert(part, { onConflict: "user_id,activity,start_at" });
      if (error) throw error;
    });
  } catch (e) {
    return json({ ok: false, error: "Couldn’t save: " + (e as Error).message }, 500);
  }

  const sorted = [...days].sort();
  if (sorted.length) {
    const from = sorted[0], to = sorted[sorted.length - 1];
    const { error } = await admin.rpc("health_rollup", { p_user: uid, p_from: from, p_to: to });
    if (error) return json({ ok: false, error: "Saved, but daily totals failed: " + error.message }, 500);
    await refreshTracker(uid, from, to, kind);
  }
  await admin.from("health_syncs").insert({ user_id: uid, kind, samples: samples.length, workouts: workouts.length, first_day: sorted[0] ?? null, last_day: sorted[sorted.length - 1] ?? null });
  await admin.from("ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", keyHash);
  return json({ ok: true, kind, samples: samples.length, workouts: workouts.length, days: sorted.length, from: sorted[0] ?? null, to: sorted[sorted.length - 1] ?? null, skipped });
});

// Copy the day's Health totals into the tracker. Measured values are always refreshed.
// Judgements (in bed on time, up for Fajr, training type, diet on target) are filled only when blank,
// and only on daily syncs, so a two-year backfill never invents verdicts for days before the term.
async function refreshTracker(uid: string, from: string, to: string, kind: string) {
  const [{ data: st }, { data: daily }, { data: wks }, { data: rows }, { data: sleepRows }] = await Promise.all([
    admin.from("settings").select("data").eq("user_id", uid).maybeSingle(),
    admin.from("health_daily").select("day,metric,value").eq("user_id", uid).gte("day", from).lte("day", to),
    admin.from("health_workouts").select("day,activity,duration_min").eq("user_id", uid).gte("day", from).lte("day", to),
    admin.from("days").select("date,data").eq("user_id", uid).gte("date", from).lte("date", to),
    admin.from("health_samples").select("day,start_at,end_at").eq("user_id", uid).in("metric", ["sleepCore", "sleepDeep", "sleepREM", "sleepAsleep"]).gte("day", from).lte("day", to),
  ]);
  const s = { bedtime: "21:00", wake: "05:00", sleepTarget: 7, deficitMin: 500, pagesPerDay: 20, ...(st?.data || {}) };
  const byDay = new Map<string, Record<string, number>>();
  for (const r of daily || []) { if (!byDay.has(r.day)) byDay.set(r.day, {}); byDay.get(r.day)![r.metric] = r.value; }
  const wByDay = new Map<string, { names: string[]; walk: number }>();
  for (const w of wks || []) {
    const e = wByDay.get(w.day) || { names: [], walk: 0 };
    e.names.push(w.activity);
    if (/walk/i.test(w.activity)) e.walk += w.duration_min || 0;
    wByDay.set(w.day, e);
  }
  const sleepSpan = new Map<string, { start: string; end: string }>();
  for (const r of sleepRows || []) {
    const e = sleepSpan.get(r.day);
    if (!e) sleepSpan.set(r.day, { start: r.start_at, end: r.end_at });
    else { if (r.start_at < e.start) e.start = r.start_at; if (r.end_at > e.end) e.end = r.end_at; }
  }
  const existing = new Map<string, Record<string, unknown>>((rows || []).map((r) => [r.date, r.data || {}]));
  const out = [];
  const allDays = new Set([...byDay.keys(), ...wByDay.keys()]);
  for (const day of allDays) {
    const m = byDay.get(day) || {};
    // deno-lint-ignore no-explicit-any
    const d: any = { prayers: {}, ...(existing.get(day) || {}) };
    const asleep = (m.sleepCore || 0) + (m.sleepDeep || 0) + (m.sleepREM || 0) + (m.sleepAsleep || 0);
    if (asleep > 0) d.sleepH = Math.round((asleep / 60) * 100) / 100;
    for (const k of ["activeKcal", "basalKcal", "dietaryKcal", "steps"]) if (m[k] != null) d[k] = Math.round(m[k]);
    if (m.weight != null) d.weight = Math.round(m.weight * 10) / 10;
    if (m.dietaryKcal > 0 && (m.activeKcal > 0 || m.basalKcal > 0)) d.deficit = Math.round((m.activeKcal || 0) + (m.basalKcal || 0) - m.dietaryKcal);
    const w = wByDay.get(day);
    if (w) { d.workouts = w.names.join(", "); if (w.walk > 0) d.walkMin = Math.round(w.walk); }
    const span = sleepSpan.get(day);
    if (span) { d.sleepStart = span.start; d.sleepEnd = span.end; }
    if (kind === "daily") {
      if (span && d.bed == null) {
        const st0 = hm(cairoTime(new Date(span.start))), target = hm(s.bedtime);
        const lateNorm = (x: number) => (x < 12 * 60 ? x + 1440 : x);
        if (st0 != null && target != null) d.bed = lateNorm(st0) <= lateNorm(target) + 30;
      }
      if (span && d.wake == null) {
        const en = hm(cairoTime(new Date(span.end))), target = hm(s.wake);
        if (en != null && target != null) d.wake = en <= target + 10;
      }
      if (w && !d.train) {
        const all = w.names.join(" ");
        d.train = /strength|functional|core|cross|hiit|weight/i.test(all) ? "gym" : /tennis/i.test(all) ? "tennis" : /walk/i.test(all) ? "walk" : d.train;
      }
      if (d.deficit != null && d.diet == null) d.diet = d.deficit >= (s.deficitMin || 500);
    }
    d.source = "Apple Health " + new Date().toISOString();
    out.push({ user_id: uid, date: day, data: d, scores: scores(d, s) });
  }
  await chunked(out, 500, async (part) => { await admin.from("days").upsert(part, { onConflict: "user_id,date" }); });
}
