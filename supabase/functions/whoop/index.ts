// Al-Mustanir × WHOOP: the only source of body data once connected (Apple Health is switched off).
//   POST /whoop/start       (signed in) → { url } to WHOOP's consent page
//   GET  /whoop/callback    WHOOP sends the member back here; tokens are stored, 30 days are imported
//   POST /whoop/webhook     WHOOP's sleep / recovery / workout events (signed with the client secret)
//   POST /whoop/poll        pg_cron, hourly (x-cron-token): catches missed events, cycles (strain, steps) and body
//   POST /whoop/sync        (signed in) { days? } → pull now
//   POST /whoop/disconnect  (signed in) → forget the tokens, Apple Health may resume
// The client id and secret live in the Edge Function secrets WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET,
// or in app_secrets (whoop_client_id / whoop_client_secret). They never reach the app.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TZ = "Africa/Cairo";
const APP = "https://mustanir.ahmed-elmahdy.com/";
const REDIRECT = SB.replace(/^http:/, "https:") + "/functions/v1/whoop/callback";
const OAUTH = "https://api.prod.whoop.com/oauth/oauth2";
const API = "https://api.prod.whoop.com/developer";
const SCOPES = "offline read:recovery read:cycles read:sleep read:workout read:body_measurement read:profile";
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const back = (q: string) => new Response(null, { status: 302, headers: { Location: `${APP}?whoop=${encodeURIComponent(q)}#diwan` } });

/* ---------- time ---------- */
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const cairoDay = (d: Date | string) => dayFmt.format(new Date(d));
const cairoTime = (d: Date | string) => timeFmt.format(new Date(d));
const hm = (s: string) => { const m = String(s || "").match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const addDays = (s: string, n: number) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const r1 = (x: number) => Math.round(x * 10) / 10;
const min = (ms: unknown) => (typeof ms === "number" ? ms / 60000 : 0);
// Fajr in New Cairo (Egyptian General Authority of Survey, 19.5°) as a UTC timestamp. Same formula as the app.
function fajrAt(s: string) {
  const rad = Math.PI / 180, t0 = Date.parse(s + "T12:00:00Z"), d = (t0 - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / rad / 15, dec = Math.asin(Math.sin(e) * Math.sin(L));
  const eq = (((q / 15 - (((ra % 24) + 24) % 24)) + 12) % 24 + 24) % 24 - 12, noon = 12 - 31.47 / 15 - eq;
  const h = Math.acos((-Math.sin(19.5 * rad) - Math.sin(dec) * Math.sin(30.03 * rad)) / (Math.cos(dec) * Math.cos(30.03 * rad))) / rad / 15;
  return t0 - 12 * 3600000 + (noon - h) * 3600000;
}
// Up for Fajr: awake at some moment from 10 minutes before Fajr to 45 minutes after (going back to sleep later is fine).
// deno-lint-ignore no-explicit-any
function upForFajr(day: string, sleeps: any[]) {
  const f = fajrAt(day), w0 = f - 10 * 60000, w1 = f + 45 * 60000;
  const iv = sleeps.map((x) => [Date.parse(x.start), Date.parse(x.end)]).filter(([a, b]) => b > w0 && a < w1).sort((x, y) => x[0] - y[0]);
  let t = w0;
  for (const [a, b] of iv) { if (a > t) return true; t = Math.max(t, b); if (t >= w1) return false; }
  return t < w1;
}

/* ---------- secrets and auth ---------- */
async function creds() {
  let id = Deno.env.get("WHOOP_CLIENT_ID") || "", secret = Deno.env.get("WHOOP_CLIENT_SECRET") || "";
  if (!id || !secret) {
    const { data } = await admin.from("app_secrets").select("name,value").in("name", ["whoop_client_id", "whoop_client_secret"]);
    const m = Object.fromEntries((data || []).map((r) => [r.name, r.value]));
    id ||= m.whoop_client_id || ""; secret ||= m.whoop_client_secret || "";
  }
  return { id, secret };
}
async function signedIn(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data?.user?.id || null;
}
async function cronOk(req: Request) {
  const { data } = await admin.from("app_secrets").select("value").eq("name", "cron_token").single();
  return !!data && req.headers.get("x-cron-token") === data.value;
}
async function setStatus(uid: string, patch: Record<string, unknown>) {
  await admin.from("whoop_status").upsert({ user_id: uid, ...patch }, { onConflict: "user_id" });
}

/* ---------- tokens ---------- */
// deno-lint-ignore no-explicit-any
async function saveTokens(uid: string, t: any, whoopUser?: number | null) {
  const row: Record<string, unknown> = {
    user_id: uid, access_token: t.access_token, refresh_token: t.refresh_token ?? null, scope: t.scope ?? null,
    expires_at: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000).toISOString(), updated_at: new Date().toISOString(),
  };
  if (whoopUser != null) row.whoop_user_id = whoopUser;
  await admin.from("whoop_tokens").upsert(row, { onConflict: "user_id" });
}
async function tokenFor(uid: string, force = false): Promise<string> {
  const { data: t } = await admin.from("whoop_tokens").select("*").eq("user_id", uid).maybeSingle();
  if (!t) throw new Error("WHOOP is not connected.");
  if (!force && Date.parse(t.expires_at) - Date.now() > 120000) return t.access_token;
  if (!t.refresh_token) throw new Error("WHOOP session expired. Connect again.");
  const { id, secret } = await creds();
  const res = await fetch(OAUTH + "/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: id, client_secret: secret, scope: "offline" }),
  });
  if (!res.ok) {
    // Another run may have refreshed a moment ago (each refresh invalidates the old pair): use the stored one.
    const { data: again } = await admin.from("whoop_tokens").select("access_token,expires_at,updated_at").eq("user_id", uid).maybeSingle();
    if (again && again.access_token !== t.access_token && Date.parse(again.expires_at) > Date.now()) return again.access_token;
    throw new Error(`WHOOP refresh failed (${res.status}). Connect again.`);
  }
  const nt = await res.json();
  await saveTokens(uid, nt);
  return nt.access_token;
}
async function api(uid: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(API + path); for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  let tok = await tokenFor(uid);
  for (let i = 0; i < 2; i++) {
    const res = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
    if (res.status === 401 && i === 0) { tok = await tokenFor(uid, true); continue; }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`WHOOP ${path} → ${res.status}`);
    return await res.json();
  }
  return null;
}
// deno-lint-ignore no-explicit-any
async function list(uid: string, path: string, start: string): Promise<any[]> {
  const out = []; let next = "";
  for (let i = 0; i < 40; i++) {
    const page = await api(uid, path, { limit: "25", start, nextToken: next });
    if (!page) break;
    out.push(...(page.records || []));
    next = page.next_token || page.nextToken || "";
    if (!next) break;
  }
  return out;
}

/* ---------- storing records ---------- */
// deno-lint-ignore no-explicit-any
type Rec = any;
async function store(uid: string, kind: string, recs: Rec[], dayOf: (r: Rec) => string | null, idOf = (r: Rec) => String(r.id)) {
  if (!recs.length) return new Set<string>();
  const rows = recs.map((r) => ({ user_id: uid, kind, id: idOf(r), day: dayOf(r), start_at: r.start ?? null, end_at: r.end ?? null, data: r, received_at: new Date().toISOString() }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin.from("whoop_records").upsert(rows.slice(i, i + 200), { onConflict: "user_id,kind,id" });
    if (error) throw error;
  }
  return new Set(rows.map((r) => r.day).filter(Boolean) as string[]);
}
const sleepDay = (s: Rec) => cairoDay(s.end || s.start);
async function dayOfSleep(uid: string, sleepId: string, known: Map<string, string>) {
  if (known.has(sleepId)) return known.get(sleepId)!;
  const { data } = await admin.from("whoop_records").select("day").eq("user_id", uid).eq("kind", "sleep").eq("id", sleepId).maybeSingle();
  return data?.day || null;
}

// Pull everything since `since` (ISO) and rebuild the touched days.
async function pull(uid: string, since: string) {
  const days = new Set<string>();
  const [cycles, sleeps, recs, wks] = await Promise.all([
    list(uid, "/v2/cycle", since), list(uid, "/v2/activity/sleep", since),
    list(uid, "/v2/recovery", since), list(uid, "/v2/activity/workout", since),
  ]);
  const known = new Map<string, string>(sleeps.map((s) => [String(s.id), sleepDay(s)]));
  for (const d of await store(uid, "sleep", sleeps, sleepDay)) days.add(d);
  for (const d of await store(uid, "cycle", cycles, (c) => cairoDay(c.start))) days.add(d);
  for (const d of await store(uid, "workout", wks, (w) => cairoDay(w.start))) days.add(d);
  const recDays = new Map<string, string | null>();
  for (const r of recs) recDays.set(String(r.sleep_id), await dayOfSleep(uid, String(r.sleep_id), known));
  for (const d of await store(uid, "recovery", recs, (r) => recDays.get(String(r.sleep_id)) || null, (r) => String(r.sleep_id))) days.add(d);
  const body = await api(uid, "/v2/user/measurement/body").catch(() => null);
  if (body) await store(uid, "body", [body], () => cairoDay(new Date()), () => "latest");
  await rebuild(uid, [...days], body);
  const n = cycles.length + sleeps.length + recs.length + wks.length;
  await setStatus(uid, { last_sync_at: new Date().toISOString(), last_error: null });
  return { days: days.size, records: n };
}

/* ---------- turning WHOOP into the day's record ---------- */
// deno-lint-ignore no-explicit-any
function scores(d: any, s: any) {
  const pr = d.prayers || {};
  const faith = PRAYERS.reduce((a, k) => a + (pr[k] === "on" ? 1 : pr[k] === "late" ? 0.5 : 0), 0) / 5;
  const knowledge = (d.pages || 0) >= (s.pagesPerDay || 20) ? 1 : 0;
  const slept = (d.sleepH || 0) >= (s.sleepTarget || 7) ? 1 : 0;
  const regular = d.sleepCons != null && d.sleepCons >= ((s.vitality || {}).sleepCons ?? 80) ? 1 : 0;
  // Sleep is judged by WHOOP alone: Fajr, hours and consistency count double; no bedtime check.
  const habits = (2 * +!!d.wake + 2 * slept + 2 * regular + +!!d.hair + +!!d.skinAm + +!!d.skinPm + +!!d.teethAm + +!!d.teethPm + +!!d.watch) / 12;
  return { faith, knowledge, habits };
}
const trainOf = (names: string) =>
  /weight|strength|functional|cross|hiit|power|gym|core|pilates|boxing/i.test(names) ? "gym" : /tennis|padel|squash/i.test(names) ? "tennis" : /walk/i.test(names) ? "walk" : null;

async function rebuild(uid: string, dayList: string[], body: Rec = null) {
  const todayKey = cairoDay(new Date());
  if (body && typeof body.weight_kilogram === "number") dayList = [...dayList, todayKey];
  if (!dayList.length) return 0;
  const days = [...new Set(dayList)].sort();
  const [{ data: st }, { data: recs }, { data: existing }, { data: meals }] = await Promise.all([
    admin.from("settings").select("data").eq("user_id", uid).maybeSingle(),
    admin.from("whoop_records").select("kind,id,day,data").eq("user_id", uid).in("day", days),
    admin.from("days").select("date,data").eq("user_id", uid).in("date", days),
    admin.from("meals").select("day,kcal").eq("user_id", uid).in("day", days),
  ]);
  const s = { bedtime: "21:00", wake: "05:00", sleepTarget: 7, deficitMin: 500, pagesPerDay: 20, ...(st?.data || {}) };
  const from = s.whoopFrom || "9999-12-31"; // verdicts only for days since WHOOP was connected
  const old = new Map((existing || []).map((r) => [r.date, r.data || {}]));
  const eaten = new Map<string, number>();
  for (const m of meals || []) eaten.set(m.day, (eaten.get(m.day) || 0) + Number(m.kcal || 0));
  const byDay = new Map<string, Rec[]>();
  for (const r of recs || []) { const l = byDay.get(r.day) || []; l.push(r); byDay.set(r.day, l); }
  const dayRows = [], metricRows: Record<string, unknown>[] = [];
  const stamp = new Date().toISOString();
  for (const day of days) {
    const rs = byDay.get(day) || [];
    const sleeps = rs.filter((r) => r.kind === "sleep" && r.data.score_state === "SCORED").map((r) => r.data);
    const cycle = rs.filter((r) => r.kind === "cycle").map((r) => r.data).sort((a, b) => String(b.start).localeCompare(String(a.start)))[0];
    const wks = rs.filter((r) => r.kind === "workout").map((r) => r.data).sort((a, b) => String(a.start).localeCompare(String(b.start)));
    const main = sleeps.filter((x) => !x.nap).sort((a, b) => (Date.parse(b.end) - Date.parse(b.start)) - (Date.parse(a.end) - Date.parse(a.start)))[0];
    const rec = main ? rs.find((r) => r.kind === "recovery" && r.id === String(main.id))?.data : null;
    // deno-lint-ignore no-explicit-any
    const d: any = { prayers: {}, ...(old.get(day) || {}) };
    const M: Record<string, number> = {};
    // Sleep: every sleep that ended this day (naps included), stages from WHOOP.
    if (sleeps.length) {
      let light = 0, deep = 0, rem = 0, awake = 0, bed = 0, nap = 0;
      for (const x of sleeps) {
        const g = x.score?.stage_summary || {};
        light += min(g.total_light_sleep_time_milli); deep += min(g.total_slow_wave_sleep_time_milli); rem += min(g.total_rem_sleep_time_milli);
        awake += min(g.total_awake_time_milli); bed += min(g.total_in_bed_time_milli);
        if (x.nap) nap += min(g.total_light_sleep_time_milli) + min(g.total_slow_wave_sleep_time_milli) + min(g.total_rem_sleep_time_milli);
      }
      Object.assign(M, { sleepCore: light, sleepDeep: deep, sleepREM: rem, sleepAwake: awake, sleepInBed: bed });
      if (nap) M.napMin = nap;
      d.sleepH = Math.round(((light + deep + rem) / 60) * 100) / 100;
      d.napMin = Math.round(nap);
    }
    if (main) {
      const sc = main.score || {}, need = sc.sleep_needed || {};
      d.sleepStart = new Date(main.start).toISOString(); d.sleepEnd = new Date(main.end).toISOString();
      const put = (k: string, v: unknown, key = k) => { if (typeof v === "number") { M[k] = v; d[key] = r1(v); } };
      put("sleepPerformance", sc.sleep_performance_percentage, "sleepPerf");
      put("sleepConsistency", sc.sleep_consistency_percentage, "sleepCons");
      put("sleepEfficiency", sc.sleep_efficiency_percentage, "sleepEff");
      put("respRate", sc.respiratory_rate);
      if (typeof sc.stage_summary?.sleep_cycle_count === "number") M.sleepCycles = sc.stage_summary.sleep_cycle_count;
      if (typeof sc.stage_summary?.disturbance_count === "number") M.disturbances = sc.stage_summary.disturbance_count;
      const needMin = min(need.baseline_milli) + min(need.need_from_sleep_debt_milli) + min(need.need_from_recent_strain_milli) + min(need.need_from_recent_nap_milli);
      if (needMin > 0) { M.sleepNeed = needMin; d.sleepNeedH = r1(needMin / 60); }
      if (typeof need.need_from_sleep_debt_milli === "number") M.sleepDebt = min(need.need_from_sleep_debt_milli);
    }
    if (rec && rec.score_state === "SCORED" && rec.score) {
      const sc = rec.score;
      if (typeof sc.recovery_score === "number") { M.recovery = sc.recovery_score; d.recovery = Math.round(sc.recovery_score); }
      if (typeof sc.hrv_rmssd_milli === "number") { M.hrv = sc.hrv_rmssd_milli; d.hrv = Math.round(sc.hrv_rmssd_milli); }
      if (typeof sc.resting_heart_rate === "number") { M.restingHR = sc.resting_heart_rate; d.restingHR = Math.round(sc.resting_heart_rate); }
      if (typeof sc.spo2_percentage === "number") { M.spo2 = sc.spo2_percentage; d.spo2 = r1(sc.spo2_percentage); }
      if (typeof sc.skin_temp_celsius === "number") { M.skinTemp = sc.skin_temp_celsius; d.skinTemp = r1(sc.skin_temp_celsius); }
    }
    // The cycle runs wake-up to wake-up; it belongs to the day it started.
    if (cycle) {
      const sc = cycle.score || {};
      const steps = cycle.step_count ?? sc.step_count ?? sc.steps ?? null;
      if (typeof steps === "number") { M.steps = steps; d.steps = Math.round(steps); }
      if (typeof sc.strain === "number") { M.strain = sc.strain; d.strain = r1(sc.strain); }
      if (typeof sc.kilojoule === "number") { M.totalKcal = sc.kilojoule / 4.184; d.totalKcal = Math.round(sc.kilojoule / 4.184); }
      if (typeof sc.average_heart_rate === "number") { M.heartRate = sc.average_heart_rate; d.avgHR = Math.round(sc.average_heart_rate); }
      if (typeof sc.max_heart_rate === "number") M.maxHR = sc.max_heart_rate;
    }
    // Workouts: exact times, so training slots match precisely.
    if (wks.length) {
      let total = 0, km = 0, walk = 0; const zones = [0, 0, 0, 0, 0, 0];
      d.workoutsDetail = wks.map((w) => {
        const sc = w.score || {}, z = sc.zone_durations || {};
        const m = Math.round((Date.parse(w.end) - Date.parse(w.start)) / 60000);
        total += m; if (/walk/i.test(w.sport_name || "")) walk += m;
        if (typeof sc.distance_meter === "number") km += sc.distance_meter / 1000;
        const zs = ["zero", "one", "two", "three", "four", "five"].map((k) => Math.round(min(z[`zone_${k}_milli`])));
        zs.forEach((v, i) => (zones[i] += v));
        return {
          a: String(w.sport_name || "Activity").replace(/(^|[-_ ])(\w)/g, (_: string, p: string, c: string) => (p ? " " : "") + c.toUpperCase()).trim(),
          s: cairoTime(w.start), e: cairoTime(w.end), min: m,
          kcal: typeof sc.kilojoule === "number" ? Math.round(sc.kilojoule / 4.184) : null,
          strain: typeof sc.strain === "number" ? r1(sc.strain) : null,
          avgHR: sc.average_heart_rate ?? null, maxHR: sc.max_heart_rate ?? null, zones: zs,
        };
      });
      d.workouts = d.workoutsDetail.map((w: { a: string }) => w.a).join(", ");
      d.exerciseMin = total; M.exerciseMin = total; M.workoutMin = total;
      if (km) M.workoutKm = km;
      zones.slice(1).forEach((v, i) => { if (v) M[`zone${i + 1}Min`] = v; });
      if (walk) d.walkMin = walk;
    }
    // Deficit: everything WHOOP says you burned minus the meals logged in the app.
    const ate = eaten.get(day);
    if (ate != null) d.dietaryKcal = Math.round(ate);
    if (d.totalKcal && ate) d.deficit = Math.round(d.totalKcal - ate);
    // Up for Fajr is decided by the sleep data alone, every day (no bedtime check any more).
    if (main) d.wake = upForFajr(day, sleeps);
    delete d.bed;
    // Other verdicts fill only blanks, and only for days since WHOOP was connected.
    if (day >= from) {
      if (wks.length && !d.train) { const t = trainOf(wks.map((w) => w.sport_name).join(" ")); if (t) d.train = t; }
      if (d.deficit != null && d.diet == null && day < cairoDay(new Date())) d.diet = d.deficit >= (s.deficitMin || 500);
      if (d.watch == null && (sleeps.length || cycle?.score?.strain != null)) d.watch = true; // WHOOP worn
    }
    // Weight: WHOOP reads it from Apple Health; it lands on today's record (the app no longer takes it by hand).
    if (day === todayKey && body && typeof body.weight_kilogram === "number") d.weight = r1(body.weight_kilogram);
    if (!sleeps.length && !cycle && !wks.length && !rec && d.weight == null) continue;
    d.source = "WHOOP " + stamp;
    dayRows.push({ user_id: uid, date: day, data: d, scores: scores(d, s) });
    for (const [metric, value] of Object.entries(M)) if (isFinite(value)) metricRows.push({ user_id: uid, day, metric, value, min_value: value, max_value: value, samples: 1 });
  }
  // Body: weight and height only when they change (WHOOP keeps what you typed into its profile).
  if (body && typeof body.weight_kilogram === "number") {
    const today = cairoDay(new Date());
    const { data: lastW } = await admin.from("health_daily").select("value").eq("user_id", uid).eq("metric", "weight").order("day", { ascending: false }).limit(1).maybeSingle();
    if (!lastW || Math.abs(Number(lastW.value) - body.weight_kilogram) >= 0.05) metricRows.push({ user_id: uid, day: today, metric: "weight", value: body.weight_kilogram, min_value: body.weight_kilogram, max_value: body.weight_kilogram, samples: 1 });
    if (typeof body.height_meter === "number") metricRows.push({ user_id: uid, day: today, metric: "height", value: body.height_meter, min_value: body.height_meter, max_value: body.height_meter, samples: 1 });
  }
  for (let i = 0; i < dayRows.length; i += 200) await admin.from("days").upsert(dayRows.slice(i, i + 200), { onConflict: "user_id,date" });
  for (let i = 0; i < metricRows.length; i += 500) await admin.from("health_daily").upsert(metricRows.slice(i, i + 500), { onConflict: "user_id,day,metric" });
  return dayRows.length;
}

/* ---------- webhook ---------- */
async function verify(req: Request, raw: string) {
  const sig = req.headers.get("X-WHOOP-Signature") || "", ts = req.headers.get("X-WHOOP-Signature-Timestamp") || "";
  if (!sig || !ts) return false;
  const { secret } = await creds();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ts + raw)));
  const b64 = btoa(String.fromCharCode(...mac));
  return b64 === sig;
}
async function handleEvent(ev: { user_id: number; id: string; type: string }) {
  const { data: t } = await admin.from("whoop_tokens").select("user_id").eq("whoop_user_id", ev.user_id).maybeSingle();
  if (!t) return;
  const uid = t.user_id as string, id = String(ev.id), [kind, action] = String(ev.type).split(".");
  const touched = new Set<string>();
  try {
    if (action === "deleted") {
      const k = kind === "recovery" ? "recovery" : kind;
      const { data: gone } = await admin.from("whoop_records").delete().eq("user_id", uid).eq("kind", k).eq("id", id).select("day");
      (gone || []).forEach((g) => g.day && touched.add(g.day));
    } else if (kind === "workout") {
      const w = await api(uid, "/v2/activity/workout/" + id);
      if (w) for (const d of await store(uid, "workout", [w], (x) => cairoDay(x.start))) touched.add(d);
    } else if (kind === "sleep" || kind === "recovery") {
      const sl = await api(uid, "/v2/activity/sleep/" + id); // recovery events carry the sleep's id
      if (sl) {
        for (const d of await store(uid, "sleep", [sl], sleepDay)) touched.add(d);
        if (sl.cycle_id != null) {
          const [rec, cyc] = await Promise.all([api(uid, `/v2/cycle/${sl.cycle_id}/recovery`).catch(() => null), api(uid, `/v2/cycle/${sl.cycle_id}`).catch(() => null)]);
          if (rec) await store(uid, "recovery", [rec], () => sleepDay(sl), (r) => String(r.sleep_id || id));
          if (cyc) for (const d of await store(uid, "cycle", [cyc], (c) => cairoDay(c.start))) touched.add(d);
        }
      }
    }
    await rebuild(uid, [...touched]);
    await setStatus(uid, { last_sync_at: new Date().toISOString(), last_error: null });
  } catch (e) {
    await setStatus(uid, { last_error: (e as Error).message.slice(0, 300) });
  }
}

/* ---------- routes ---------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url), route = url.pathname.split("/").filter(Boolean).pop();
  try {
    if (route === "start" && req.method === "POST") {
      const uid = await signedIn(req); if (!uid) return json({ ok: false, error: "Sign in first." }, 401);
      const { id } = await creds(); if (!id) return json({ ok: false, error: "The WHOOP client id isn't set up yet." }, 400);
      const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789", rnd = crypto.getRandomValues(new Uint8Array(8));
      const state = [...rnd].map((b) => abc[b % abc.length]).join(""); // WHOOP wants exactly eight characters
      await admin.from("whoop_states").delete().lt("created_at", new Date(Date.now() - 3600000).toISOString());
      await admin.from("whoop_states").insert({ state, user_id: uid });
      const q = new URLSearchParams({ response_type: "code", client_id: id, redirect_uri: REDIRECT, scope: SCOPES, state });
      return json({ ok: true, url: `${OAUTH}/auth?${q}` });
    }
    if (route === "callback") {
      const code = url.searchParams.get("code"), state = url.searchParams.get("state") || "";
      if (url.searchParams.get("error")) return back("denied");
      const { data: st } = await admin.from("whoop_states").select("user_id,created_at").eq("state", state).maybeSingle();
      if (!code || !st || Date.now() - Date.parse(st.created_at) > 30 * 60000) return back("expired");
      await admin.from("whoop_states").delete().eq("state", state);
      const uid = st.user_id as string, { id, secret } = await creds();
      const res = await fetch(OAUTH + "/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: id, client_secret: secret, redirect_uri: REDIRECT }),
      });
      if (!res.ok) { await setStatus(uid, { last_error: `Token exchange failed (${res.status}): ${(await res.text()).slice(0, 200)}` }); return back("failed"); }
      await saveTokens(uid, await res.json());
      const prof = await api(uid, "/v2/user/profile/basic").catch(() => null);
      if (prof?.user_id != null) await admin.from("whoop_tokens").update({ whoop_user_id: prof.user_id }).eq("user_id", uid);
      await setStatus(uid, { whoop_user_id: prof?.user_id ?? null, connected_at: new Date().toISOString(), last_error: null });
      // WHOOP becomes the source: Apple Health is ignored from now on, and its "late sync" push is muted.
      const { data: sr } = await admin.from("settings").select("data").eq("user_id", uid).maybeSingle();
      const sd = sr?.data || {};
      const next = { ...sd, healthSource: "whoop", whoopFrom: sd.whoopFrom || cairoDay(new Date()), notify: { ...(sd.notify || {}), health: false } };
      await admin.from("settings").upsert({ user_id: uid, data: next }, { onConflict: "user_id" });
      try { await pull(uid, new Date(Date.now() - 30 * 86400000).toISOString()); }
      catch (e) { await setStatus(uid, { last_error: (e as Error).message.slice(0, 300) }); }
      return back("connected");
    }
    if (route === "webhook" && req.method === "POST") {
      const raw = await req.text();
      if (!(await verify(req, raw))) return json({ ok: false }, 401);
      const ev = JSON.parse(raw);
      // Answer at once; WHOOP retries anything slow.
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil ? (globalThis as any).EdgeRuntime.waitUntil(handleEvent(ev)) : await handleEvent(ev);
      return json({ ok: true });
    }
    if (route === "poll" && req.method === "POST") {
      if (!(await cronOk(req))) return json({ ok: false }, 401);
      const { data: users } = await admin.from("whoop_tokens").select("user_id");
      const out = [];
      for (const u of users || []) {
        const { data: s } = await admin.from("whoop_status").select("last_sync_at").eq("user_id", u.user_id).maybeSingle();
        const since = Math.min(Date.parse(s?.last_sync_at || "") || 0, Date.now()) - 3 * 86400000; // three days back covers late scores
        try { out.push(await pull(u.user_id, new Date(Math.max(since, Date.now() - 30 * 86400000)).toISOString())); }
        catch (e) { await setStatus(u.user_id, { last_error: (e as Error).message.slice(0, 300) }); }
      }
      return json({ ok: true, users: out.length, out });
    }
    if (route === "sync" && req.method === "POST") {
      const uid = await signedIn(req); if (!uid) return json({ ok: false, error: "Sign in first." }, 401);
      const b = await req.json().catch(() => ({}));
      const n = Math.min(365, Math.max(1, Number(b.days) || 7));
      try { return json({ ok: true, ...(await pull(uid, new Date(Date.now() - n * 86400000).toISOString())) }); }
      catch (e) { await setStatus(uid, { last_error: (e as Error).message.slice(0, 300) }); return json({ ok: false, error: (e as Error).message }, 502); }
    }
    if (route === "disconnect" && req.method === "POST") {
      const uid = await signedIn(req); if (!uid) return json({ ok: false, error: "Sign in first." }, 401);
      await admin.from("whoop_tokens").delete().eq("user_id", uid);
      await setStatus(uid, { connected_at: null, last_error: null });
      const { data: sr } = await admin.from("settings").select("data").eq("user_id", uid).maybeSingle();
      if (sr) { const { healthSource: _h, ...rest } = sr.data || {}; await admin.from("settings").update({ data: rest }).eq("user_id", uid); }
      return json({ ok: true });
    }
    return json({ ok: false, error: "Unknown route" }, 404);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
