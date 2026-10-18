// Al-Mustanir: receives Apple Health data from an iOS Shortcut and merges it into one day.
// Auth: the Shortcut sends its key as "Authorization: Bearer <key>". Only the key's SHA-256 is stored.
// Measured values (sleep, energy, weight, walking minutes) are always written.
// Judgements (in bed on time, up for Fajr, training type, diet yes/no) are only filled when still blank.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(",", ".").replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? null : n;
};
const minutesOf = (v: unknown): number | null => {
  const all = String(v ?? "").match(/(\d{1,2}):(\d{2})/g);
  if (!all) return null;
  const [h, m] = all[all.length - 1].split(":").map(Number);
  return h * 60 + m;
};
const cairoToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// deno-lint-ignore no-explicit-any
function scores(d: any, s: any) {
  const pr = d.prayers || {};
  const faith = PRAYERS.reduce((a, k) => a + (pr[k] === "on" ? 1 : pr[k] === "late" ? 0.5 : 0), 0) / 5;
  const knowledge = (d.pages || 0) >= (s.pagesPerDay || 20) ? 1 : 0;
  const slept = (d.sleepH || 0) >= (s.sleepTarget || 7) ? 1 : 0;
  const habits = (+!!d.bed + 2 * +!!d.wake + 2 * slept + +!!d.hair + +!!d.skinAm + +!!d.skinPm + +!!d.teethAm + +!!d.teethPm + +!!d.watch) / 11;
  return { faith, knowledge, habits };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  const key = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return json({ ok: false, error: "Missing key." }, 401);
  const { data: tok } = await admin.from("ingest_tokens").select("user_id").eq("token_hash", await sha256(key)).maybeSingle();
  if (!tok) return json({ ok: false, error: "Wrong key." }, 401);
  const uid = tok.user_id as string;

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return json({ ok: false, error: "Body must be JSON." }, 400); }
  const date = DATE_RE.test(String(b.date || "")) ? String(b.date) : cairoToday();

  const [{ data: st }, { data: row }] = await Promise.all([
    admin.from("settings").select("data").eq("user_id", uid).maybeSingle(),
    admin.from("days").select("data").eq("user_id", uid).eq("date", date).maybeSingle(),
  ]);
  const s = { bedtime: "21:00", wake: "05:00", sleepTarget: 7, deficitMin: 500, ...(st?.data || {}) };
  const d = { prayers: {}, ...(row?.data || {}) };
  const set: string[] = [];

  let hours = num(b.sleepH);
  if (hours == null && num(b.sleepMinutes) != null) hours = num(b.sleepMinutes)! / 60;
  if (hours == null && num(b.sleepSeconds) != null) hours = num(b.sleepSeconds)! / 3600;
  if (hours != null) { d.sleepH = Math.round(hours * 100) / 100; set.push("sleepH"); }
  if (b.sleepStart) {
    d.sleepStart = String(b.sleepStart);
    const stM = minutesOf(b.sleepStart), target = minutesOf(s.bedtime);
    if (stM != null && target != null && d.bed == null) {
      const norm = (x: number) => (x < 12 * 60 ? x + 1440 : x); // after midnight counts as late
      d.bed = norm(stM) <= norm(target) + 30; // the watch logs sleep onset, not lights out
      set.push("bed");
    }
  }
  if (b.sleepEnd) {
    d.sleepEnd = String(b.sleepEnd);
    const en = minutesOf(b.sleepEnd), target = minutesOf(s.wake);
    if (en != null && target != null && d.wake == null) { d.wake = en <= target + 10; set.push("wake"); }
  }
  for (const k of ["activeKcal", "basalKcal", "dietaryKcal"]) {
    const v = num(b[k]);
    if (v != null) { d[k] = Math.round(v); set.push(k); }
  }
  if (d.dietaryKcal > 0 && (d.activeKcal > 0 || d.basalKcal > 0)) {
    d.deficit = Math.round((d.activeKcal || 0) + (d.basalKcal || 0) - d.dietaryKcal);
    set.push("deficit");
    if (d.diet == null) d.diet = d.deficit >= (s.deficitMin || 500);
  }
  if (b.workouts) {
    const w = Array.isArray(b.workouts) ? b.workouts.join(", ") : String(b.workouts);
    d.workouts = w; set.push("workouts");
    if (!d.train) {
      if (/strength|functional|core|cross|hiit|weight/i.test(w)) d.train = "gym";
      else if (/tennis/i.test(w)) d.train = "tennis";
      else if (/walk/i.test(w)) d.train = "walk";
      if (d.train) set.push("train");
    }
  }
  const walk = num(b.walkMin);
  if (walk != null) { d.walkMin = Math.round(walk); set.push("walkMin"); }
  const kg = num(b.weight);
  if (kg != null && kg > 20) { d.weight = Math.round(kg * 10) / 10; set.push("weight"); }
  d.source = "Apple Health " + new Date().toISOString();

  const { error } = await admin.from("days").upsert({ user_id: uid, date, data: d, scores: scores(d, s) });
  if (error) return json({ ok: false, error: error.message }, 500);
  await admin.from("ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", await sha256(key));
  return json({ ok: true, date, updated: set });
});
