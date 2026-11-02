// The data layer (ADR-0001): Supabase over plain REST, local-first in IndexedDB, live over one Realtime socket.
//   BASE[date]   the server's copy of a day (what IndexedDB keeps)
//   OUTBOX[date] the keys you changed and the server hasn't confirmed yet (a patch; null removes a key)
//   S.days[date] what the screen shows: BASE with the OUTBOX patch on top
// Saves send only the patch to the save_day RPC, which merges in Postgres, so a WHOOP write landing at the same moment is never lost.
// Loads ask only for rows changed since the last cursor. Realtime delivers WHOOP and FatSecret rows seconds after they land.
import { S, DEFAULTS, syncBed, day, violation, termIndex, planTargets } from "./logic.js";
import { idb } from "./idb.js";
import { connectRealtime } from "./realtime.js";

export const SB_URL = "https://qanzhisoxueaizscdial.supabase.co";
const SB_KEY = "sb_publishable_L6srdujqlW0FgMinucAqaw_qMOEMhqJ"; // publishable: safe in the page; row-level security protects the data
export const APP_URL = location.origin + location.pathname.replace(/index\.html$/, "");

export const LS = {
  get(k, f) { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* blocked */ } },
};
export let SESSION = LS.get("a2-session", null);
let onChange = () => {};
export const setRenderer = (fn) => { onChange = fn; };
export function setStatus(t) { S.status = t; onChange(); }
// app-state wraps changes that arrive from the server, to celebrate XP the watch earned. Default: just apply.
let onRemote = (apply) => apply();
export const setRemoteHandler = (fn) => { onRemote = fn; };

/* ---------- session ---------- */
async function authCall(path, body) {
  const res = await fetch(SB_URL + "/auth/v1/" + path, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.msg || out.error_description || out.message || "Sign-in failed");
  return out;
}
function keepSession(out) {
  SESSION = { access_token: out.access_token, refresh_token: out.refresh_token, expires_at: Date.now() + (out.expires_in || 3600) * 1000, email: out.user && out.user.email };
  LS.set("a2-session", SESSION);
  live?.setToken(SESSION.access_token);
}
export async function signIn(email, password) { keepSession(await authCall("token?grant_type=password", { email, password })); }
export async function signUp(email, password) {
  const out = await authCall("signup", { email, password, options: { emailRedirectTo: APP_URL } });
  if (!out.access_token) return false; // email confirmation required
  keepSession(out); return true;
}
export function signOut() {
  SESSION = null; LS.del("a2-session"); live?.close(); live = null;
  for (const k of Object.keys(BASE)) delete BASE[k];
  for (const k of Object.keys(OUTBOX)) delete OUTBOX[k];
  CURSOR = null; idb.clear();
  S.days = {}; S.health = null; S.player = null; S.mode = "signin";
}
let refreshing = null;
async function token() {
  if (!SESSION) throw new Error("Signed out");
  if (Date.now() > SESSION.expires_at - 60000) {
    refreshing ||= authCall("token?grant_type=refresh_token", { refresh_token: SESSION.refresh_token }).then(keepSession).finally(() => { refreshing = null; });
    // Sign out only when the auth server rejects the session; a network blip (fetch throws a TypeError) just retries later.
    try { await refreshing; } catch (e) { if (!(e instanceof TypeError) && navigator.onLine !== false) { signOut(); onChange(); } throw e; }
  }
  return SESSION.access_token;
}
const userId = () => { try { return JSON.parse(atob(SESSION.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub; } catch { return null; } };

async function rest(path, opts = {}) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, { ...opts, headers: { apikey: SB_KEY, Authorization: "Bearer " + await token(), "Content-Type": "application/json", ...(opts.headers || {}) } });
  if (!res.ok) { const t = await res.text(); throw new Error(t || "HTTP " + res.status); }
  return res.status === 204 ? null : res.json().catch(() => null);
}
const upsert = (table, conflict, row) => rest(table + "?on_conflict=" + conflict, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
const rpc = (fn, args) => rest("rpc/" + fn, { method: "POST", body: JSON.stringify(args || {}) });

// Page through a table past PostgREST's row cap.
async function all(path, page = 1000) {
  const out = [];
  for (let from = 0; ; from += page) {
    const rows = await rest(path, { headers: { "Range-Unit": "items", Range: `${from}-${from + page - 1}` } });
    out.push(...(rows || []));
    if (!rows || rows.length < page) break;
  }
  return out;
}

/* ---------- days: the server's copy, your pending changes, and what the screen shows ---------- */
const BASE = {};
const OUTBOX = {};
let CURSOR = null; // the newest updated_at this phone has seen
const SEEN = {};   // date → the updated_at of the copy in BASE, so an older copy arriving late never replaces a newer one
// Realtime and PostgREST spell timestamps differently ("2026-11-01 20:03:03.58+00" vs "2026-11-01T20:03:03.58+00:00").
const ts = (x) => (x ? String(x).replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00") : null);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function applyPatch(base, patch) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(patch || {})) { if (v === null || v === undefined) delete out[k]; else out[k] = v; }
  return out;
}
export function diffDay(base, cur) {
  const patch = {};
  for (const k of new Set([...Object.keys(base || {}), ...Object.keys(cur || {})])) {
    const a = (base || {})[k], b = (cur || {})[k];
    if (!same(a, b)) patch[k] = b === undefined ? null : b;
  }
  return patch;
}
// Always a deep copy: the screen mutates its day in place (nested objects too), and the base must stay the server's.
const clone = (x) => (typeof structuredClone === "function" ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
const shown = (date) => clone(applyPatch(BASE[date], OUTBOX[date]?.patch));
function scoresFor(date) { const d = S.days[date] || {}, ds = day(date); return { faith: ds.faith, knowledge: ds.knowledge, habits: ds.habits, withinSchedule: d.mast ? !violation(date) : null }; }

let baseQueue = new Set(), baseTimer = 0;
function persistBase(date) {
  baseQueue.add(date); clearTimeout(baseTimer);
  baseTimer = setTimeout(() => { const ds = [...baseQueue]; baseQueue = new Set(); idb.put("days", ds.map((d) => [d, BASE[d]])); }, 300);
}
const persistOutbox = () => idb.set("meta", "outbox", OUTBOX);
const persistSettings = () => idb.set("meta", "settings", S.settings);

/** A row from the server (a load or a live change): it becomes the base, your pending patch stays on top. */
function applyRow(date, data, updatedAt) {
  updatedAt = ts(updatedAt);
  if (updatedAt && SEEN[date] && updatedAt < SEEN[date]) return; // a late copy of an older version
  if (updatedAt) SEEN[date] = updatedAt;
  BASE[date] = data || {};
  S.days[date] = shown(date);
  persistBase(date);
  if (updatedAt && (!CURSOR || updatedAt > CURSOR)) { CURSOR = updatedAt; idb.set("meta", "cursor", CURSOR); }
}

async function send(date) {
  const entry = OUTBOX[date]; if (!entry) return;
  await rpc("save_day", { p_date: date, p_patch: entry.patch, p_scores: entry.scores });
  BASE[date] = applyPatch(BASE[date], entry.patch); persistBase(date);
  if (OUTBOX[date] === entry) { delete OUTBOX[date]; persistOutbox(); } // unchanged while it was in flight
}
export async function flushOutbox() {
  const dates = Object.keys(OUTBOX); if (!dates.length || !SESSION) return;
  for (const date of dates) {
    try { await send(date); } catch { setStatus("Saved on this phone · syncs when you’re back online"); return; }
  }
  setStatus("Synced");
}
/** Every change to a day comes here: the patch is kept on the phone at once and sent a moment later. */
export function saveDay(date) {
  S.dirty.add(date); setStatus("Saving…");
  const patch = diffDay(BASE[date], S.days[date]);
  if (Object.keys(patch).length) OUTBOX[date] = { patch, scores: scoresFor(date) }; else delete OUTBOX[date];
  persistOutbox();
  clearTimeout(S.timers[date]);
  S.timers[date] = setTimeout(async () => {
    try { await send(date); setStatus("Sealed"); }
    catch { setStatus(navigator.onLine === false ? "Saved on this phone · syncs when you’re back online" : "Saved on this phone · will retry"); }
    finally { S.dirty.delete(date); }
  }, 600);
}
// Settings changed on the phone win until the server has them: a sync that lands in between (coming back from another
// app, say) must not put an older schedule back on screen and then save that instead.
let settingsTimer, settingsRev = 0, settingsSent = 0;
const settingsPending = () => settingsRev !== settingsSent;
export function saveSettings() {
  settingsRev++; persistSettings(); idb.set("meta", "settingsPending", true);
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(sendSettings, 400);
}
async function sendSettings() {
  const rev = settingsRev;
  try {
    await upsert("settings", "user_id", { data: { ...S.settings, appUrl: APP_URL } });
    settingsSent = rev;
    if (!settingsPending()) idb.set("meta", "settingsPending", false);
  } catch { setStatus("Settings saved on this phone · will retry"); }
}
function applySettings(settings) {
  S.settings = { ...DEFAULTS, ...(settings || {}) }; S.settings.notify = { ...DEFAULTS.notify, ...((settings || {}).notify || {}) }; syncBed();
}

/** Before the first frame: everything this phone already knows, from IndexedDB (or the old localStorage cache, once). */
export async function hydrate() {
  const [days, outbox, cursor, settings, settingsUnsent] = await Promise.all([idb.entries("days"), idb.get("meta", "outbox"), idb.get("meta", "cursor"), idb.get("meta", "settings"), idb.get("meta", "settingsPending")]);
  if (days.length) {
    for (const [k, v] of days) BASE[k] = v;
    Object.assign(OUTBOX, outbox || {}); CURSOR = cursor || null;
    applySettings(settings);
    if (settingsUnsent) settingsRev++; // changed on this phone last time and never confirmed: send it with the next sync
  } else {
    // First run on this version: bring over the localStorage cache, then drop it (it was rewritten whole on every tap).
    const old = LS.get("a2-cache", null), oldOut = LS.get("a2-outbox", {});
    if (old) { Object.assign(BASE, old.days || {}); applySettings(old.settings); idb.put("days", Object.entries(BASE)); persistSettings(); }
    for (const [k, e] of Object.entries(oldOut || {})) OUTBOX[k] = { patch: e.d || {}, scores: e.scores };
    persistOutbox(); LS.del("a2-cache"); LS.del("a2-outbox");
  }
  S.days = {}; for (const k of new Set([...Object.keys(BASE), ...Object.keys(OUTBOX)])) S.days[k] = shown(k);
  S.player = LS.get("a2-player", null);
  S.loaded = Object.keys(S.days).length > 0;
}

let loading = null;
/** Sync with the server: send what's pending, then fetch only what changed since the cursor. */
export function load() {
  if (!SESSION) { S.mode = "signin"; onChange(); return Promise.resolve(); }
  return (loading ||= (async () => {
    try {
      await flushOutbox();
      if (settingsPending()) { clearTimeout(settingsTimer); await sendSettings(); }
      const since = CURSOR ? "&updated_at=gt." + encodeURIComponent(CURSOR) : "";
      const [st, rows, player] = await Promise.all([
        rest("settings?select=data"),
        all("days?select=date,data,updated_at&order=updated_at" + since),
        rest("player_state?select=*").catch(() => null),
      ]);
      if (!settingsPending()) { applySettings(st && st[0] ? st[0].data : {}); persistSettings(); }
      if (rows.length) onRemote(() => { for (const r of rows) applyRow(r.date, r.data, r.updated_at); }, { initial: !CURSOR });
      if (player && player[0]) setPlayer(player[0]);
      S.mode = "cloud"; S.loaded = true;
      // When a new term begins, adopt that term's body-plan targets once (aim strong, accept likely).
      const ti = termIndex();
      if (S.settings.bodyPlanTerm !== ti) { const { rules, ...t } = planTargets(ti); Object.assign(S.settings, t, { bodyPlanTerm: ti }); saveSettings(); }
      onChange();
      startLive();
    } catch (e) { if (S.mode !== "signin") { S.mode = "error"; S.err = e.message; onChange(); } }
    finally { loading = null; }
  })());
}
function setPlayer(p) { S.player = p; LS.set("a2-player", { level: p.level, xp: p.xp, rank_en: p.rank_en, rank_ar: p.rank_ar, day: p.day }); }

/* ---------- live ---------- */
let live = null;
S.live = "offline";
function startLive() {
  if (live || !SESSION) return;
  const uid = userId(); if (!uid) return;
  live = connectRealtime({
    url: SB_URL, apikey: SB_KEY, token,
    tables: [{ table: "days", filter: "user_id=eq." + uid }, { table: "player_state", filter: "user_id=eq." + uid }],
    onStatus: (s) => { S.live = s; onChange(); },
    onChange: (c) => {
      const r = c.record || {};
      if (c.table === "days" && r.date && c.type !== "DELETE") { onRemote(() => applyRow(r.date, r.data, r.updated_at), { date: r.date, data: r.data }); onChange(); }
      if (c.table === "player_state" && r.user_id) { setPlayer(r); onChange(); }
    },
  });
}
/** Back from the background: reconnect the socket and catch up on anything missed while asleep. */
export function wake() { live?.wake(); return load(); }

// Health history for statistics, the vitals and the biological-age estimate: daily rollups in one call.
export const CHART_METRICS = ["recovery", "strain", "totalKcal", "sleepConsistency", "sleepPerformance", "skinTemp", "steps", "activeKcal", "restingHR", "hrv", "weight", "sleepCore", "sleepDeep", "sleepREM", "sleepAsleep", "exerciseMin", "vo2max",
  "standHours", "daylightMin", "bmi", "height", "bodyFat", "leanMass", "walking_speed", "respRate", "spo2"];
export async function loadHealth(days = 1500) {
  if (!SESSION) return null;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const [series, sync, dataSync] = await Promise.all([
    rpc("health_series", { p_metrics: CHART_METRICS, p_from: since }),
    rest("health_syncs?select=received_at,kind,samples,workouts,first_day,last_day&order=received_at.desc&limit=1"),
    // Workout-only syncs (Health Auto Export's workout automation) carry no steps, sleep or energy.
    rest("health_syncs?select=received_at,samples&samples=gt.0&order=received_at.desc&limit=1").catch(() => null),
  ]);
  const byMetric = {};
  for (const [k, pts] of Object.entries(series || {})) byMetric[k] = pts.map(([d, v]) => [d, Number(v)]);
  // Total sleep = the asleep stages combined.
  const sleep = {};
  for (const k of ["sleepCore", "sleepDeep", "sleepREM", "sleepAsleep"]) for (const [d, v] of byMetric[k] || []) sleep[d] = (sleep[d] || 0) + v;
  byMetric.sleepH = Object.entries(sleep).sort().map(([d, v]) => [d, v / 60]);
  S.health = { byMetric, lastSync: sync && sync[0] ? sync[0] : null, lastData: dataSync && dataSync[0] ? dataSync[0] : null, loadedAt: Date.now() };
  return S.health;
}
// Every metric at a glance: latest value, this month against last, the year's average.
export async function loadHealthSummary() {
  const [rows, cat] = await Promise.all([rpc("health_summary"), rest("health_metrics?select=key,label,unit,agg,category,better,sort&order=sort")]);
  S.healthSummary = { rows: rows || [], catalog: cat || [], loadedAt: Date.now() };
  return S.healthSummary;
}
export async function loadMetricSeries(metric, days = 1500) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const out = await rpc("health_series", { p_metrics: [metric], p_from: since });
  return ((out || {})[metric] || []).map(([d, v]) => [d, Number(v)]);
}

// A private key for something outside the app (the widget). Only its hash is stored; the key itself is shown once.
export async function newShortcutKey(label = "Widget") {
  const raw = crypto.getRandomValues(new Uint8Array(24));
  const key = "mk_" + [...raw].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await rest("ingest_tokens", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ token_hash: hash, label }) });
  return key;
}

/* ---------- push notifications ---------- */
export const PALACE_URL = SB_URL + "/functions/v1/palace";
export const WHOOP_URL = SB_URL + "/functions/v1/whoop";
export const FATSECRET_URL = SB_URL + "/functions/v1/fatsecret";

/* ---------- WHOOP ---------- */
async function whoopCall(path, body) {
  const res = await fetch(WHOOP_URL + "/" + path, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + await token(), "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) throw new Error(j.error || "HTTP " + res.status);
  return j;
}
export async function loadWhoop() {
  const rows = await rest("whoop_status?select=connected_at,last_sync_at,last_error,whoop_user_id").catch(() => null);
  S.whoop = rows && rows[0] ? rows[0] : { connected_at: null };
  return S.whoop;
}
export async function whoopConnect() { const { url } = await whoopCall("start"); location.href = url; }
export async function whoopSync(days = 7) { const r = await whoopCall("sync", { days }); await load(); await loadWhoop(); return r; }
export async function whoopDisconnect() { await whoopCall("disconnect"); await load(); await loadWhoop(); }
/* ---------- FatSecret (meals logged there arrive here on their own) ---------- */
async function fsCall(path, body) {
  const res = await fetch(FATSECRET_URL + "/" + path, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + await token(), "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) throw new Error(j.error || "HTTP " + res.status);
  return j;
}
export async function loadFatsecret() {
  const rows = await rest("fatsecret_status?select=connected_at,last_sync_at,last_error").catch(() => null);
  S.fatsecret = rows && rows[0] ? rows[0] : { connected_at: null };
  return S.fatsecret;
}
export async function fatsecretConnect() { const { url } = await fsCall("start"); location.href = url; }
export async function fatsecretSync(days = 3) { const r = await fsCall("sync", { days }); S.meals = {}; await load(); await loadFatsecret(); return r; }
export async function fatsecretDisconnect() { await fsCall("disconnect"); await loadFatsecret(); }
const b64ToBytes = (b64) => { const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export async function pushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? "on" : "off";
}
export async function enablePush() {
  const perm = await Notification.requestPermission(); // must run inside the tap that asked for it
  if (perm !== "granted") throw new Error(perm === "denied" ? "Notifications are blocked. Allow them in iOS Settings → Notifications → Mustanir." : "Permission wasn’t given.");
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await (await fetch(PALACE_URL + "/vapid")).json();
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  const j = sub.toJSON();
  await rest("push_subscriptions?on_conflict=endpoint", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: navigator.userAgent.slice(0, 120) }) });
}
export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  await rest("push_subscriptions?endpoint=eq." + encodeURIComponent(sub.endpoint), { method: "DELETE" }).catch(() => {});
  await sub.unsubscribe();
}
export async function testPush() {
  const res = await fetch(PALACE_URL + "/test", { method: "POST", headers: { Authorization: "Bearer " + await token(), "Content-Type": "application/json" }, body: "{}" });
  const out = await res.json().catch(() => ({}));
  if (!out.ok) throw new Error(out.error || "Test failed");
  return out.devices;
}

/* ---------- Apple Calendar feed ---------- */
export async function newCalendarLink() {
  const raw = crypto.getRandomValues(new Uint8Array(24));
  const t = [...raw].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await rest("feed_tokens?user_id=not.is.null", { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {}); // one live link at a time
  await rest("feed_tokens", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ token_hash: hash }) });
  return PALACE_URL.replace(/^https:/, "webcal:") + "/calendar?t=" + t;
}

/* ---------- meals (from FatSecret) ---------- */
export async function loadMeals(date) {
  if (!SESSION) return [];
  const rows = (await rest(`meals?select=id,eaten_at,name,kcal,protein,exported_at,source&day=eq.${date}&order=eaten_at`)) || [];
  (S.meals ||= {})[date] = rows;
  return rows;
}
/* ---------- the advisor's weekly reports ---------- */
export async function loadReviews() {
  if (!SESSION) return [];
  S.reviews = (await rest("weekly_reviews?select=week_start,title,summary,recommendations,changes,created_at&order=week_start.desc&limit=8")) || [];
  return S.reviews;
}

