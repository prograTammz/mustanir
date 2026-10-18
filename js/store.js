// Supabase over plain REST (no SDK), with an on-device copy and an outbox so logging works offline.
import { S, DEFAULTS, syncBed, day, violation } from "./logic.js";

export const SB_URL = "https://qanzhisoxueaizscdial.supabase.co";
const SB_KEY = "sb_publishable_L6srdujqlW0FgMinucAqaw_qMOEMhqJ"; // publishable: safe in the page; row-level security protects the data
export const HEALTH_URL = SB_URL + "/functions/v1/health";
export const APP_URL = location.origin + location.pathname.replace(/index\.html$/, "");

export const LS = {
  get(k, f) { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* blocked */ } },
};
export let SESSION = LS.get("a2-session", null);
const OUTBOX = LS.get("a2-outbox", {});
let onChange = () => {};
export const setRenderer = (fn) => { onChange = fn; };
export function setStatus(t) { const el = document.getElementById("status"); if (el) el.textContent = t; }

async function authCall(path, body) {
  const res = await fetch(SB_URL + "/auth/v1/" + path, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.msg || out.error_description || out.message || "Sign-in failed");
  return out;
}
function keepSession(out) {
  SESSION = { access_token: out.access_token, refresh_token: out.refresh_token, expires_at: Date.now() + (out.expires_in || 3600) * 1000, email: out.user && out.user.email };
  LS.set("a2-session", SESSION);
}
export async function signIn(email, password) { keepSession(await authCall("token?grant_type=password", { email, password })); }
export async function signUp(email, password) {
  const out = await authCall("signup", { email, password, options: { emailRedirectTo: APP_URL } });
  if (!out.access_token) return false; // email confirmation required
  keepSession(out); return true;
}
export function signOut() { SESSION = null; LS.del("a2-session"); LS.del("a2-cache"); S.days = {}; S.health = null; S.mode = "signin"; }

async function token() {
  if (!SESSION) throw new Error("Signed out");
  if (Date.now() > SESSION.expires_at - 60000) {
    try { keepSession(await authCall("token?grant_type=refresh_token", { refresh_token: SESSION.refresh_token })); }
    catch (e) { if (navigator.onLine !== false) { signOut(); onChange(); } throw e; }
  }
  return SESSION.access_token;
}
async function rest(path, opts = {}) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, { ...opts, headers: { apikey: SB_KEY, Authorization: "Bearer " + await token(), "Content-Type": "application/json", ...(opts.headers || {}) } });
  if (!res.ok) { const t = await res.text(); throw new Error(t || "HTTP " + res.status); }
  return res.status === 204 ? null : res.json().catch(() => null);
}
const upsert = (table, conflict, row) => rest(table + "?on_conflict=" + conflict, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });

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

function scoresFor(date) { const d = S.days[date] || {}, ds = day(date); return { faith: ds.faith, knowledge: ds.knowledge, habits: ds.habits, withinSchedule: d.mast ? !violation(date) : null }; }
const pushDay = (date, entry) => upsert("days", "user_id,date", { date, data: entry.d, scores: entry.scores });

export async function flushOutbox() {
  const dates = Object.keys(OUTBOX); if (!dates.length || !SESSION) return;
  for (const date of dates) {
    try { await pushDay(date, OUTBOX[date]); delete OUTBOX[date]; LS.set("a2-outbox", OUTBOX); }
    catch { setStatus("Saved on this phone · syncs when you’re back online"); return; }
  }
  setStatus("Synced");
}
export function saveDay(date) {
  S.dirty.add(date); setStatus("Saving…");
  LS.set("a2-cache", { settings: S.settings, days: S.days });
  clearTimeout(S.timers[date]);
  S.timers[date] = setTimeout(async () => {
    const entry = { d: S.days[date] || {}, scores: scoresFor(date) };
    OUTBOX[date] = entry; LS.set("a2-outbox", OUTBOX);
    try { await pushDay(date, entry); delete OUTBOX[date]; LS.set("a2-outbox", OUTBOX); setStatus("Sealed"); }
    catch { setStatus(navigator.onLine === false ? "Saved on this phone · syncs when you’re back online" : "Saved on this phone · will retry"); }
    finally { S.dirty.delete(date); }
  }, 700);
}
let settingsTimer;
export function saveSettings() {
  LS.set("a2-cache", { settings: S.settings, days: S.days });
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => { upsert("settings", "user_id", { data: { ...S.settings, appUrl: APP_URL } }).catch(() => setStatus("Settings saved on this phone · will retry")); }, 400);
}
function applyData(settings, days) {
  S.settings = { ...DEFAULTS, ...(settings || {}) }; S.settings.notify = { ...DEFAULTS.notify, ...((settings || {}).notify || {}) }; syncBed();
  const next = { ...(days || {}) };
  Object.keys(OUTBOX).forEach((k) => { next[k] = OUTBOX[k].d; });
  S.dirty.forEach((k) => { if (S.days[k]) next[k] = S.days[k]; });
  S.days = next;
}
export async function load() {
  if (!SESSION) { S.mode = "signin"; onChange(); return; }
  try {
    await flushOutbox();
    const [st, rows] = await Promise.all([rest("settings?select=data"), all("days?select=date,data&order=date")]);
    const days = {}; rows.forEach((r) => { days[r.date] = r.data || {}; });
    applyData(st && st[0] ? st[0].data : {}, days); S.mode = "cloud"; S.loaded = true;
    LS.set("a2-cache", { settings: S.settings, days: S.days }); onChange();
  } catch (e) { if (S.mode !== "signin") { S.mode = "error"; S.err = e.message; onChange(); } }
}

// Health history for statistics: daily rollups for the metrics the charts use, plus the last sync.
export const CHART_METRICS = ["steps", "activeKcal", "restingHR", "hrv", "weight", "sleepCore", "sleepDeep", "sleepREM", "sleepAsleep", "exerciseMin", "vo2max"];
export async function loadHealth(days = 730) {
  if (!SESSION) return null;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const [rows, sync] = await Promise.all([
    all(`health_daily?select=day,metric,value&metric=in.(${CHART_METRICS.join(",")})&day=gte.${since}&order=day`),
    rest("health_syncs?select=received_at,kind,samples,workouts,first_day,last_day&order=received_at.desc&limit=1"),
  ]);
  const byMetric = {};
  for (const r of rows) (byMetric[r.metric] ||= []).push([r.day, r.value]);
  // Total sleep = the asleep stages combined.
  const sleep = {};
  for (const k of ["sleepCore", "sleepDeep", "sleepREM", "sleepAsleep"]) for (const [d, v] of byMetric[k] || []) sleep[d] = (sleep[d] || 0) + v;
  byMetric.sleepH = Object.entries(sleep).sort().map(([d, v]) => [d, v / 60]);
  S.health = { byMetric, lastSync: sync && sync[0] ? sync[0] : null, loadedAt: Date.now() };
  return S.health;
}

export async function newShortcutKey() {
  const raw = crypto.getRandomValues(new Uint8Array(24));
  const key = "mk_" + [...raw].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await rest("ingest_tokens", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ token_hash: hash }) });
  return key;
}

/* ---------- push notifications ---------- */
export const PALACE_URL = SB_URL + "/functions/v1/palace";
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

/* ---------- food (written to Apple Health by the nightly Shortcut) ---------- */
export async function loadMeals(date) {
  if (!SESSION) return [];
  const rows = (await rest(`meals?select=id,eaten_at,name,kcal,protein,exported_at&day=eq.${date}&order=eaten_at`)) || [];
  (S.meals ||= {})[date] = rows;
  return rows;
}
export async function addMeal(date, meal) {
  const now = new Date(), isToday = date === new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const at = isToday ? now : new Date(date + "T13:00:00"); // a past day's meal lands at lunchtime
  const row = { day: date, eaten_at: at.toISOString(), name: meal.name || null, kcal: meal.kcal, protein: meal.protein ?? null };
  const out = await rest("meals", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  ((S.meals ||= {})[date] ||= []).push(out[0]);
  return out[0];
}
export async function deleteMeal(date, id) {
  await rest("meals?id=eq." + id, { method: "DELETE" });
  if (S.meals?.[date]) S.meals[date] = S.meals[date].filter((m) => m.id !== id);
}

/* ---------- the advisor's weekly reports ---------- */
export async function loadReviews() {
  if (!SESSION) return [];
  S.reviews = (await rest("weekly_reviews?select=week_start,title,summary,recommendations,changes,created_at&order=week_start.desc&limit=8")) || [];
  return S.reviews;
}

const cached = LS.get("a2-cache", null);
if (cached) { applyData(cached.settings, cached.days); S.loaded = true; }
