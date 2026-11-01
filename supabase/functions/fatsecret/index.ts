// Al-Mustanir × FatSecret: meals you log in the FatSecret app (photo, barcode, search) arrive in `meals` by themselves.
//   POST /fatsecret/start       (signed in) → { url } to FatSecret's sign-in page (OAuth 1.0, three-legged)
//   GET  /fatsecret/callback    FatSecret sends you back here; the token is stored and the last 14 days imported
//   POST /fatsecret/poll        pg_cron, hourly (x-cron-token): today and the two days before
//   POST /fatsecret/sync        (signed in) { days? } → pull now
//   POST /fatsecret/disconnect  (signed in) → forget the token (meals already imported stay)
// The consumer key and shared secret live in app_secrets (fatsecret_key / fatsecret_secret) or the function
// secrets FATSECRET_KEY / FATSECRET_SECRET. They never reach the app.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TZ = "Africa/Cairo";
const APP = "https://mustanir.ahmed-elmahdy.com/";
const CALLBACK = SB.replace(/^http:/, "https:") + "/functions/v1/fatsecret/callback";
const AUTH = "https://authentication.fatsecret.com/oauth";
const API = "https://platform.fatsecret.com/rest/server.api";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const back = (q: string) => new Response(null, { status: 302, headers: { Location: `${APP}?fatsecret=${encodeURIComponent(q)}#diwan` } });

/* ---------- time ---------- */
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const cairoDay = (d: Date | string) => dayFmt.format(new Date(d));
const addDays = (s: string, n: number) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayInt = (s: string) => Math.round(Date.parse(s + "T00:00:00Z") / 86400000); // FatSecret dates: days since 1970-01-01
// When each meal "happened" (FatSecret keeps the meal, not the time). Cairo local time → ISO.
const MEAL_AT: Record<string, string> = { breakfast: "08:00", lunch: "14:00", dinner: "20:00", other: "17:00" };
function mealTime(day: string, meal: string) {
  const hhmm = MEAL_AT[String(meal || "").toLowerCase()] || "17:00";
  const guess = Date.parse(`${day}T${hhmm}:00Z`);
  const local = new Date(guess).toLocaleString("sv-SE", { timeZone: TZ }).replace(" ", "T") + "Z";
  return new Date(guess - (Date.parse(local) - guess)).toISOString();
}

/* ---------- secrets and auth ---------- */
async function creds() {
  let key = Deno.env.get("FATSECRET_KEY") || "", secret = Deno.env.get("FATSECRET_SECRET") || "";
  if (!key || !secret) {
    const { data } = await admin.from("app_secrets").select("name,value").in("name", ["fatsecret_key", "fatsecret_secret"]);
    const m = Object.fromEntries((data || []).map((r) => [r.name, r.value]));
    key ||= m.fatsecret_key || ""; secret ||= m.fatsecret_secret || "";
  }
  return { key, secret };
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
  await admin.from("fatsecret_status").upsert({ user_id: uid, ...patch }, { onConflict: "user_id" });
}

/* ---------- OAuth 1.0 (HMAC-SHA1) ---------- */
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
async function hmacSha1(key: string, text: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)))));
}
// Signs and sends; every parameter travels in the query string (FatSecret accepts that for GET and POST).
async function signed(method: "GET" | "POST", url: string, params: Record<string, string>, tokenSecret = "") {
  const { key, secret } = await creds();
  if (!key || !secret) throw new Error("The FatSecret keys aren't set up yet.");
  const p: Record<string, string> = {
    ...params, oauth_consumer_key: key, oauth_nonce: crypto.randomUUID().replace(/-/g, ""), oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_version: "1.0",
  };
  const norm = Object.keys(p).sort().map((k) => `${enc(k)}=${enc(p[k])}`).join("&");
  const base = [method, enc(url), enc(norm)].join("&");
  p.oauth_signature = await hmacSha1(`${enc(secret)}&${enc(tokenSecret)}`, base);
  const qs = Object.keys(p).map((k) => `${enc(k)}=${enc(p[k])}`).join("&");
  const res = await fetch(`${url}?${qs}`, { method });
  const text = await res.text();
  if (!res.ok) throw new Error(`FatSecret ${res.status}: ${text.slice(0, 200)}`);
  return text;
}
const form = (t: string) => Object.fromEntries(new URLSearchParams(t));

async function api(uid: string, method: string, params: Record<string, string> = {}) {
  const { data: t } = await admin.from("fatsecret_tokens").select("token,secret").eq("user_id", uid).maybeSingle();
  if (!t) throw new Error("FatSecret is not connected.");
  const out = JSON.parse(await signed("GET", API, { method, format: "json", oauth_token: t.token, ...params }, t.secret));
  if (out?.error) throw Object.assign(new Error(`FatSecret: ${out.error.message || out.error.code}`), { code: Number(out.error.code) });
  return out;
}

/* ---------- pulling the diary ---------- */
// deno-lint-ignore no-explicit-any
const asList = (x: any) => (Array.isArray(x) ? x : x ? [x] : []);
const num = (x: unknown) => { const n = Number(x); return isFinite(n) ? n : null; };
async function entriesFor(uid: string, day: string) {
  // deno-lint-ignore no-explicit-any
  let out: any;
  try { out = await api(uid, "food_entries.get.v2", { date: String(dayInt(day)) }); }
  catch (e) { if ((e as { code?: number }).code === 2 || /unknown method|2:/i.test((e as Error).message)) out = await api(uid, "food_entries.get", { date: String(dayInt(day)) }); else throw e; }
  return asList(out?.food_entries?.food_entry);
}
async function pullDays(uid: string, days: string[]) {
  let n = 0;
  for (const day of days) {
    const entries = await entriesFor(uid, day);
    const rows = entries.map((e) => ({
      user_id: uid, day, source: "fatsecret", external_id: String(e.food_entry_id),
      eaten_at: mealTime(day, e.meal), name: [e.food_entry_name, e.food_entry_description].filter(Boolean)[0] || "Meal",
      kcal: num(e.calories), protein: num(e.protein), carbs: num(e.carbohydrate), fat: num(e.fat),
    })).filter((r) => r.kcal != null);
    if (rows.length) {
      const { error } = await admin.from("meals").upsert(rows, { onConflict: "user_id,source,external_id" });
      if (error) throw error;
    }
    // Entries you deleted or edited away in FatSecret disappear here too.
    const keep = rows.map((r) => r.external_id);
    let del = admin.from("meals").delete().eq("user_id", uid).eq("source", "fatsecret").eq("day", day);
    if (keep.length) del = del.not("external_id", "in", `(${keep.join(",")})`);
    await del;
    n += rows.length;
    await refreshDay(uid, day);
  }
  await setStatus(uid, { last_sync_at: new Date().toISOString(), last_error: null });
  return { days: days.length, meals: n };
}
// Intake and deficit on the day's record (WHOOP's energy burned − everything eaten).
async function refreshDay(uid: string, day: string) {
  const [{ data: meals }, { data: row }] = await Promise.all([
    admin.from("meals").select("kcal").eq("user_id", uid).eq("day", day),
    admin.from("days").select("data").eq("user_id", uid).eq("date", day).maybeSingle(),
  ]);
  if (!row) return;
  const eaten = (meals || []).reduce((a, m) => a + Number(m.kcal || 0), 0);
  const d = { ...(row.data || {}) };
  if (eaten > 0) d.dietaryKcal = Math.round(eaten); else delete d.dietaryKcal;
  if (d.totalKcal && eaten > 0) d.deficit = Math.round(d.totalKcal - eaten); else delete d.deficit;
  await admin.from("days").update({ data: d }).eq("user_id", uid).eq("date", day);
}
const lastDays = (n: number) => { const t = cairoDay(new Date()); return Array.from({ length: n }, (_, i) => addDays(t, -i)).reverse(); };

/* ---------- routes ---------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url), route = url.pathname.split("/").filter(Boolean).pop();
  try {
    if (route === "start" && req.method === "POST") {
      const uid = await signedIn(req); if (!uid) return json({ ok: false, error: "Sign in first." }, 401);
      // FatSecret only accepts GET here (their docs say POST; that fails with "Invalid signature").
      const r = form(await signed("GET", AUTH + "/request_token", { oauth_callback: CALLBACK }));
      if (!r.oauth_token) return json({ ok: false, error: "FatSecret didn't issue a sign-in token. Check the keys." }, 502);
      await admin.from("fatsecret_states").delete().lt("created_at", new Date(Date.now() - 3600000).toISOString());
      await admin.from("fatsecret_states").insert({ token: r.oauth_token, secret: r.oauth_token_secret || "", user_id: uid });
      return json({ ok: true, url: `${AUTH}/authorize?oauth_token=${enc(r.oauth_token)}` });
    }
    if (route === "callback") {
      const tok = url.searchParams.get("oauth_token") || "", verifier = url.searchParams.get("oauth_verifier") || "";
      const { data: st } = await admin.from("fatsecret_states").select("secret,user_id,created_at").eq("token", tok).maybeSingle();
      if (!st || !verifier) return back(verifier ? "expired" : "denied");
      await admin.from("fatsecret_states").delete().eq("token", tok);
      const uid = st.user_id as string;
      try {
        const a = form(await signed("GET", AUTH + "/access_token", { oauth_token: tok, oauth_verifier: verifier }, st.secret));
        if (!a.oauth_token || !a.oauth_token_secret) throw new Error("No access token returned.");
        await admin.from("fatsecret_tokens").upsert({ user_id: uid, token: a.oauth_token, secret: a.oauth_token_secret, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        await setStatus(uid, { connected_at: new Date().toISOString(), last_error: null });
      } catch (e) { await setStatus(uid, { last_error: (e as Error).message.slice(0, 300) }); return back("failed"); }
      try { await pullDays(uid, lastDays(14)); } catch (e) { await setStatus(uid, { last_error: (e as Error).message.slice(0, 300) }); }
      return back("connected");
    }
    if (route === "poll" && req.method === "POST") {
      if (!(await cronOk(req))) return json({ ok: false }, 401);
      const { data: users } = await admin.from("fatsecret_tokens").select("user_id");
      const out = [];
      for (const u of users || []) {
        try { out.push(await pullDays(u.user_id, lastDays(3))); }
        catch (e) { await setStatus(u.user_id, { last_error: (e as Error).message.slice(0, 300) }); }
      }
      return json({ ok: true, users: out.length, out });
    }
    if (route === "sync" && req.method === "POST") {
      const uid = await signedIn(req); if (!uid) return json({ ok: false, error: "Sign in first." }, 401);
      const b = await req.json().catch(() => ({}));
      const n = Math.min(60, Math.max(1, Number(b.days) || 3));
      try { return json({ ok: true, ...(await pullDays(uid, lastDays(n))) }); }
      catch (e) { await setStatus(uid, { last_error: (e as Error).message.slice(0, 300) }); return json({ ok: false, error: (e as Error).message }, 502); }
    }
    if (route === "disconnect" && req.method === "POST") {
      const uid = await signedIn(req); if (!uid) return json({ ok: false, error: "Sign in first." }, 401);
      await admin.from("fatsecret_tokens").delete().eq("user_id", uid);
      await setStatus(uid, { connected_at: null, last_error: null });
      return json({ ok: true });
    }
    return json({ ok: false, error: "Unknown route" }, 404);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
