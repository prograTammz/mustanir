// Al-Mustanir game engine on the server (ADR-0001). The rules are logic.js, byte for byte the app's src/lib/logic.js.
//   POST /game/recompute  (x-cron-token) { user_id, origin }  ← the days trigger, after every write
//   POST /game/all        (x-cron-token)                      ← pg_cron, hourly: midnight rollover, Sunday weigh-ins
//   GET  /game/widget     (Authorization: Bearer <Shortcut key>) → a small JSON for home-screen widgets
// It writes player_state (level, XP, today, streaks, closest medals), medal_awards (when each medal was won) and
// game_events (level-ups and medals; origin "server" ones become pushes, "app" ones were celebrated on screen).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as G from "./logic.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const TZ = "Africa/Cairo";
const STREAKS = ["office", "prayers", "fajr", "abstain", "read", "regular", "vital"] as const;

async function cronOk(req: Request) {
  const { data } = await admin.from("app_secrets").select("value").eq("name", "cron_token").single();
  return !!data && req.headers.get("x-cron-token") === data.value;
}
const sha256 = async (t: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");

// deno-lint-ignore no-explicit-any
type Any = any;

/** Load one player into the engine and read the game off it. */
async function compute(uid: string) {
  // Fetch everything first: the engine's state is module-global, so it is loaded and read in one synchronous run below,
  // and two recomputes interleaving at an await can never mix one player's settings with another's days.
  const { data: st } = await admin.from("settings").select("data").eq("user_id", uid).maybeSingle();
  const raw = st?.data || {};
  // The term and the two weeks before it: weigh-ins compare against the previous Sunday.
  const from = G.addDays(raw.termStart || G.DEFAULTS.termStart, -14);
  const days: Record<string, Any> = {};
  for (let at = 0; ; at += 1000) {
    const { data, error } = await admin.from("days").select("date,data").eq("user_id", uid).gte("date", from).order("date").range(at, at + 999);
    if (error) throw error;
    for (const r of data || []) days[r.date] = r.data || {};
    if (!data || data.length < 1000) break;
  }
  G.setTimeZone(raw.timeZone || TZ);
  G.S.settings = { ...G.DEFAULTS, ...raw, notify: { ...G.DEFAULTS.notify, ...(raw.notify || {}) } };
  G.syncBed();
  G.S.days = days;
  const day = G.today(), t = G.totals(), rank = G.rankFor(t.level), parts = G.xpParts(day), ms = G.medals();
  const won = ms.filter((m: Any) => m.won);
  const d = days[day] || {}, pr = d.prayers || {};
  const open = {
    prayers: G.PRAYERS.filter(([k]: string[]) => !pr[k]).map(([k]: string[]) => k),
    pagesLeft: Math.max(0, (G.S.settings.pagesPerDay || 20) - (d.pages || 0)),
    tasks: (() => { const c = G.checklistFor(day); return c.total - c.done; })(),
  };
  const todayMax = G.MAX_DAY_XP + (G.isSunday(day) ? G.WEIGH_IN_XP : 0);
  const next = ms.filter((m: Any) => !m.won).sort((a: Any, b: Any) => b.frac - a.frac).slice(0, 3)
    .map((m: Any) => ({ id: m.id, en: m.en, ar: m.ar, how: m.how, frac: Math.round(m.frac * 100) / 100, cur: m.cur, goal: m.goal }));
  const state = {
    user_id: uid, level: t.level, xp: t.xp, rank_en: rank.en, rank_ar: rank.ar, day,
    today_xp: G.dayXP(day), today_max: todayMax, streak: G.streak(G.T.office),
    medals_won: won.length, medals_total: ms.length,
    data: {
      toNext: t.to - t.xp, frac: Math.round(t.frac * 1000) / 1000, perfect: parts.perfect.earned > 0, near: parts.near,
      ministers: Object.fromEntries(Object.entries(parts.ministers).map(([k, v]: [string, Any]) => [k, v.earned])),
      open, next,
      streaks: Object.fromEntries(STREAKS.map((k) => [k, { now: G.streak(G.T[k]), best: G.bestStreak(G.T[k]) }])),
    },
    computed_at: new Date().toISOString(),
  };
  return { state, won: won.map((m: Any) => ({ id: m.id, en: m.en, ar: m.ar })), rank };
}

async function recompute(uid: string, origin: "app" | "server") {
  const [{ state, won, rank }, { data: prev }, { data: had }] = await Promise.all([
    compute(uid),
    admin.from("player_state").select("level").eq("user_id", uid).maybeSingle(),
    admin.from("medal_awards").select("medal_id").eq("user_id", uid),
  ]);
  const { error } = await admin.from("player_state").upsert(state, { onConflict: "user_id" });
  if (error) throw error;
  const known = new Set((had || []).map((r) => r.medal_id));
  const fresh = won.filter((m) => !known.has(m.id));
  if (fresh.length) await admin.from("medal_awards").upsert(fresh.map((m) => ({ user_id: uid, medal_id: m.id, won_on: state.day })), { onConflict: "user_id,medal_id", ignoreDuplicates: true });
  // The first run only takes stock: no flood of "new" medals and levels.
  const events: Record<string, unknown>[] = [];
  if (prev) {
    if (state.level > prev.level) events.push({ kind: "level_up", payload: { level: state.level, rank_en: rank.en, rank_ar: rank.ar } });
    for (const m of fresh) events.push({ kind: "medal", payload: m });
  }
  if (events.length) {
    const now = new Date().toISOString();
    await admin.from("game_events").insert(events.map((e) => ({ ...e, user_id: uid, origin, notified_at: origin === "app" ? now : null })));
    // Earned from WHOOP or FatSecret with the app closed: push it now, not at the next 5-minute run.
    if (origin === "server") {
      const { data: tok } = await admin.from("app_secrets").select("value").eq("name", "cron_token").single();
      await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/palace/events", {
        method: "POST", headers: { "Content-Type": "application/json", "x-cron-token": tok?.value || "" }, body: JSON.stringify({ user_id: uid }),
      }).catch(() => {});
    }
  }
  return { level: state.level, xp: state.xp, today: state.today_xp, events: events.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const route = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  try {
    if (route === "recompute" && req.method === "POST") {
      if (!(await cronOk(req))) return json({ ok: false }, 401);
      const b = await req.json().catch(() => ({}));
      if (!b.user_id) return json({ ok: false, error: "user_id" }, 400);
      return json({ ok: true, ...(await recompute(String(b.user_id), b.origin === "app" ? "app" : "server")) });
    }
    if (route === "all" && req.method === "POST") {
      if (!(await cronOk(req))) return json({ ok: false }, 401);
      const { data } = await admin.from("settings").select("user_id");
      const out = [];
      for (const r of data || []) out.push(await recompute(r.user_id, "server").catch((e) => ({ error: (e as Error).message })));
      return json({ ok: true, users: out.length, out });
    }
    if (route === "widget" && req.method === "GET") {
      const key = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!key) return json({ ok: false, error: "Missing key." }, 401);
      const { data: tok } = await admin.from("ingest_tokens").select("user_id").eq("token_hash", await sha256(key)).maybeSingle();
      if (!tok) return json({ ok: false, error: "Wrong key." }, 401);
      const { data: p } = await admin.from("player_state").select("*").eq("user_id", tok.user_id).maybeSingle();
      if (!p) return json({ ok: false, error: "No game yet." }, 404);
      return json({ ok: true, level: p.level, xp: p.xp, rank: { en: p.rank_en, ar: p.rank_ar }, toNext: p.data?.toNext, frac: p.data?.frac,
        today: { day: p.day, xp: p.today_xp, max: p.today_max, open: p.data?.open, ministers: p.data?.ministers }, streak: p.streak,
        medals: { won: p.medals_won, total: p.medals_total, next: p.data?.next?.[0] || null }, at: p.computed_at });
    }
    return json({ ok: false, error: "Unknown route" }, 404);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
