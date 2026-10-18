// Al-Mustanir palace services: push notifications, the Apple Calendar feed, and test pushes.
//   GET  /palace/vapid              → { publicKey } for subscribing (keys are generated once, kept server-side)
//   POST /palace/notify             → called by pg_cron every 5 minutes (x-cron-token); sends reminders that are due
//   GET  /palace/calendar?t=<token> → private iCalendar feed of the daily schedule
//   POST /palace/test               → sends a test notification to the signed-in user's devices
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TZ = "Africa/Cairo";
const APP = "https://mustanir.ahmed-elmahdy.com/";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const DEFAULTS = {
  termStart: "2026-11-01", wake: "05:00", windowHours: 8, pagesPerDay: 20, sessionsPerWeek: 4,
  trainingDays: "SAT,MON,WED,THU", trainingTime: "18:00", trainingMin: 60, readingTime: "05:30", readingMin: 30,
  windDownMin: 45, checkinTime: "20:00",
  notify: { morning: true, reading: true, training: true, evening: true, windDown: true, advisor: true },
};
// deno-lint-ignore no-explicit-any
type Settings = typeof DEFAULTS & Record<string, any>;

const pad = (n: number) => String(n).padStart(2, "0");
const hm = (s: string) => { const m = String(s || "").match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const toHM = (min: number) => { const x = ((min % 1440) + 1440) % 1440; return pad(Math.floor(x / 60)) + ":" + pad(x % 60); };
function cairoNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute, dow: String(p.weekday).toUpperCase().slice(0, 3) };
}
const addDays = (s: string, n: number) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const addMonths = (s: string, n: number) => { const d = new Date(s + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const dowOf = (s: string) => ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(s + "T12:00:00Z").getUTCDay()];

function settingsOf(raw: Record<string, unknown> | null): Settings {
  const s = { ...DEFAULTS, ...(raw || {}) } as Settings;
  s.notify = { ...DEFAULTS.notify, ...((raw || {}).notify as object || {}) };
  const w = hm(s.wake) ?? 300;
  s.bedtimeMin = w - Math.round(Number(s.windowHours || 8) * 60);
  s.bedtime = toHM(s.bedtimeMin);
  return s;
}
const trainingDays = (s: Settings) => String(s.trainingDays || "").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);

// The day's schedule, shared by reminders and the calendar.
function blocks(s: Settings, day: string) {
  const wake = hm(s.wake) ?? 300, bed = s.bedtimeMin as number, out = [];
  out.push({ key: "sleep", title: "Sleep · النوم", start: bed, end: wake + 1440 * (bed > wake ? 1 : 0), note: `Lights out ${s.bedtime}, up for Fajr ${s.wake}.` });
  out.push({ key: "windDown", title: "Wind-down · phone away", start: bed - Number(s.windDownMin || 45), end: bed, note: "Phone out of the bedroom. Night skin and teeth." });
  const r = hm(s.readingTime); if (r != null) out.push({ key: "reading", title: "Reading · المعرفة", start: r, end: r + Number(s.readingMin || 30), note: `Today's minimum: ${s.pagesPerDay} pages.` });
  const t = hm(s.trainingTime);
  if (t != null && trainingDays(s).includes(dowOf(day))) out.push({ key: "training", title: "Training · البدن", start: t, end: t + Number(s.trainingMin || 60), note: "Ministry of Body: today's session." });
  return out;
}

/* ---------- VAPID ---------- */
async function vapid() {
  const { data } = await admin.from("app_secrets").select("name,value").in("name", ["vapid_public", "vapid_private"]);
  const m = Object.fromEntries((data || []).map((r) => [r.name, r.value]));
  if (m.vapid_public && m.vapid_private) return { publicKey: m.vapid_public, privateKey: m.vapid_private };
  const k = webpush.generateVAPIDKeys();
  await admin.from("app_secrets").upsert([{ name: "vapid_public", value: k.publicKey }, { name: "vapid_private", value: k.privateKey }], { onConflict: "name", ignoreDuplicates: true });
  const { data: again } = await admin.from("app_secrets").select("name,value").in("name", ["vapid_public", "vapid_private"]);
  const m2 = Object.fromEntries((again || []).map((r) => [r.name, r.value])); // another run may have won the race
  return { publicKey: m2.vapid_public, privateKey: m2.vapid_private };
}

async function sendTo(userId: string, msg: { title: string; body: string; url?: string; tag?: string }) {
  const { data: subs } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", userId);
  if (!subs?.length) return 0;
  const k = await vapid();
  webpush.setVapidDetails(APP, k.publicKey, k.privateKey);
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...msg, url: msg.url || APP }), { TTL: 3600, urgency: "normal" });
      ok++; await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id); // device unsubscribed
      else console.error("push failed", code, (e as Error).message);
    }
  }
  return ok;
}

/* ---------- reminders ---------- */
// deno-lint-ignore no-explicit-any
function openItems(d: any) {
  if (!d) return ["everything"];
  const out = [];
  const pr = d.prayers || {}; const n = ["fajr", "dhuhr", "asr", "maghrib", "isha"].filter((k) => pr[k]).length;
  if (n < 5) out.push(`prayers (${n} of 5)`);
  if (!(d.pages > 0)) out.push("reading");
  if (d.pornFree == null) out.push("purity");
  if (!d.train) out.push("training");
  if (!d.good && !d.fix) out.push("journal");
  return out;
}
async function notifyRun() {
  const now = cairoNow(), LOOKBACK = 10;
  const { data: subs } = await admin.from("push_subscriptions").select("user_id");
  const users = [...new Set((subs || []).map((r) => r.user_id))];
  let sent = 0;
  for (const uid of users) {
    const [{ data: st }, { data: logged }, { data: today }] = await Promise.all([
      admin.from("settings").select("data").eq("user_id", uid).maybeSingle(),
      admin.from("push_log").select("key").eq("user_id", uid).eq("day", now.day),
      admin.from("days").select("data").eq("user_id", uid).eq("date", now.day).maybeSingle(),
    ]);
    const s = settingsOf(st?.data || null), done = new Set((logged || []).map((r) => r.key));
    const due: { key: string; at: number; title: string; body: string; url?: string }[] = [];
    const wake = hm(s.wake) ?? 300;
    if (s.notify.morning) due.push({ key: "morning", at: wake + 20, title: "Morning decrees · صباح الخير", body: "Seal Fajr, last night's sleep and your morning routine.", url: APP + "#decrees" });
    for (const b of blocks(s, now.day)) {
      if (b.key === "reading" && s.notify.reading) due.push({ key: "reading", at: b.start, title: "وزير المعرفة · Reading time", body: `${s.readingMin} minutes, ${s.pagesPerDay} pages minimum.` });
      if (b.key === "training" && s.notify.training) due.push({ key: "training", at: b.start - 30, title: "وزير البدن · Training in 30 min", body: `Session at ${s.trainingTime}. Pack your bag.` });
      if (b.key === "windDown" && s.notify.windDown) due.push({ key: "windDown", at: b.start, title: "Wind-down · وقت الهدوء", body: `Phone out of the bedroom. Lights out at ${s.bedtime}.` });
    }
    if (s.notify.evening) {
      const open = openItems(today?.data);
      if (open.length) due.push({ key: "evening", at: hm(s.checkinTime) ?? 1200, title: "Evening decrees · مراسيم المساء", body: "Still open: " + open.join(", ") + ".", url: APP + "#decrees" });
    }
    for (const r of due) {
      const at = ((r.at % 1440) + 1440) % 1440;
      if (done.has(r.key) || at > now.min || now.min - at > LOOKBACK) continue;
      const { error } = await admin.from("push_log").insert({ user_id: uid, day: now.day, key: r.key }); // claim it first so overlapping runs can't double-send
      if (error) continue;
      sent += await sendTo(uid, { title: r.title, body: r.body, url: r.url, tag: r.key });
    }
    // A new weekly report from the advisor.
    if (s.notify.advisor) {
      const { data: rev } = await admin.from("weekly_reviews").select("id,title").eq("user_id", uid).is("announced_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (rev) {
        await admin.from("weekly_reviews").update({ announced_at: new Date().toISOString() }).eq("id", rev.id);
        sent += await sendTo(uid, { title: "المستشار · The advisor's report", body: rev.title, url: APP + "#council", tag: "advisor" });
      }
    }
  }
  return { users: users.length, sent, at: `${now.day} ${toHM(now.min)}` };
}

/* ---------- calendar feed ---------- */
const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
function fold(line: string) { // RFC 5545: lines at most 75 octets
  const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
  const out: string[] = []; let cur = "";
  for (const ch of line) { if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ""; } cur += ch; }
  out.push(cur); return out.join("\r\n ");
}
const local = (day: string, min: number) => { const d = addDays(day, Math.floor(min / 1440)); return d.replace(/-/g, "") + "T" + toHM(min).replace(":", "") + "00"; };
async function calendar(token: string) {
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data: tok } = await admin.from("feed_tokens").select("user_id").eq("token_hash", hash).maybeSingle();
  if (!tok) return new Response("Not found", { status: 404 });
  await admin.from("feed_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", hash);
  const { data: st } = await admin.from("settings").select("data").eq("user_id", tok.user_id).maybeSingle();
  const s = settingsOf(st?.data || null), now = cairoNow();
  const termEnd = addMonths(s.termStart, 3);
  const from = addDays(now.day, -7), until = (termEnd > now.day ? termEnd : addDays(now.day, 90)).replace(/-/g, "") + "T235959Z";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Al-Mustanir//Ahmed 2.0//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Al-Mustanir", "X-WR-TIMEZONE:" + TZ, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  const ev = (uid: string, title: string, note: string, startDay: string, start: number, end: number, rrule: string) => {
    L.push("BEGIN:VEVENT", `UID:${uid}-${tok.user_id}@mustanir`, `DTSTAMP:${stamp}`, `DTSTART;TZID=${TZ}:${local(startDay, start)}`, `DTEND;TZID=${TZ}:${local(startDay, end)}`,
      rrule, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(note + "\n" + APP)}`, "TRANSP:OPAQUE", "END:VEVENT");
  };
  for (const b of blocks(s, from)) if (b.key !== "training") ev(b.key, b.title, b.note, from, b.start, b.end, `RRULE:FREQ=DAILY;UNTIL=${until}`);
  const days = trainingDays(s), t = hm(s.trainingTime);
  if (days.length && t != null) {
    let first = from; for (let i = 0; i < 7 && !days.includes(dowOf(first)); i++) first = addDays(first, 1);
    const by = days.map((d) => d.slice(0, 2)).join(",");
    ev("training", "Training · البدن", "Ministry of Body: today's session.", first, t, t + Number(s.trainingMin || 60), `RRULE:FREQ=WEEKLY;BYDAY=${by};UNTIL=${until}`);
  }
  [1, 2, 3].forEach((i) => {
    const d = addMonths(s.termStart, i).replace(/-/g, "");
    L.push("BEGIN:VEVENT", `UID:council-${i}-${s.termStart}-${tok.user_id}@mustanir`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`,
      `SUMMARY:${esc(i < 3 ? `Council · month ${i} review` : "Council · term review")}`, `DESCRIPTION:${esc("Judge each minister on adherence. Below the line: impeach the strategy, keep the agenda.\n" + APP)}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  });
  L.push("END:VCALENDAR");
  return new Response(L.map(fold).join("\r\n") + "\r\n", { headers: { ...CORS, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url), route = url.pathname.split("/").filter(Boolean).pop();
  try {
    if (route === "vapid") return json({ publicKey: (await vapid()).publicKey });
    if (route === "calendar") { const t = url.searchParams.get("t") || ""; return t ? await calendar(t) : new Response("Not found", { status: 404 }); }
    if (route === "notify" && req.method === "POST") {
      const { data } = await admin.from("app_secrets").select("value").eq("name", "cron_token").single();
      if (!data || req.headers.get("x-cron-token") !== data.value) return json({ ok: false }, 401);
      return json({ ok: true, ...(await notifyRun()) });
    }
    if (route === "test" && req.method === "POST") {
      const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = await admin.auth.getUser(jwt);
      if (!u?.user) return json({ ok: false, error: "Sign in first." }, 401);
      const n = await sendTo(u.user.id, { title: "المُستنير · Al-Mustanir", body: "Notifications are working. The cabinet will remind you on time.", tag: "test" });
      return json({ ok: n > 0, devices: n, error: n ? undefined : "No device is subscribed yet." });
    }
    return json({ ok: false, error: "Unknown route" }, 404);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
