// The weekly report: the week just ended (Sunday to Saturday, in step with the term), set beside the week before it and
// everything since tracking began. Pure like logic.js: it reads the engine's state and returns numbers and findings.
// It only reads the rules, so the game function's copy of logic.js is untouched by it.
import { S, PRAYERS, FLOOR, addDays, range, diff, parse, fmt, today, inOffice, manual, score, dayXP, dayMinisters, matchDay, slotsOn,
  slotName, deficitOf, sportOf, levelFor, rankFor, termInfo, weighIn, minHM, hmMin } from "./logic.js";

export const weekStart = (s) => addDays(s, -parse(s).getDay()); // the Sunday that opens s's week
export const lastWeek = (s = today()) => addDays(weekStart(s), -7); // the latest week that has ended
export const weekEnd = (start) => addDays(start, 6);
// The first day logged by hand. The Apple Health history before it has steps and energy, nothing to report on.
export const firstTracked = () => Object.keys(S.days).filter((k) => manual(S.days[k])).sort()[0] || null;
// "1–7 Nov", or "29 Nov – 5 Dec" across a month.
export function weekLabel(start) {
  const end = weekEnd(start), a = parse(start), b = parse(end);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${fmt(end, { day: "numeric", month: "short" })}` : `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(end, { day: "numeric", month: "short" })}`;
}

// WHOOP's sleep hours include naps; the night is what's left without them.
export const nightOf = (d) => (d?.sleepH == null ? null : Math.max(0, d.sleepH - (d.napMin || 0) / 60));
// A WHOOP timestamp as a wall-clock time in the player's zone (the phone's own when none is set).
export function clockOf(iso) {
  const t = Date.parse(iso || "");
  if (!t) return null;
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: S.settings.timeZone || undefined }).format(new Date(t));
}
// Bedtimes run past midnight: count them from noon so 23:50 and 00:10 average to midnight, not midday.
const fromNoon = (hm) => { const m = hmMin(hm); return m == null ? null : m < 720 ? m + 1440 : m; };

/** One day of the report: what the engine scored and what the watch, the food log and you recorded. */
export function dayRow(s, protein = {}) {
  const d = S.days[s] || {}, pr = d.prayers || {}, office = inOffice(s);
  const did = [...new Set((d.workoutsDetail || []).map((w) => sportOf(w.a)).filter((k) => k && k !== "walk"))];
  return {
    date: s, office, logged: manual(d), away: !!d.away,
    // A day with no record earns nothing, as in the engine's totals (and the HUD).
    xp: office ? (S.days[s] ? dayXP(s) : 0) : null, ministers: dayMinisters(s),
    prayers: { on: PRAYERS.filter(([k]) => pr[k] === "on").length, late: PRAYERS.filter(([k]) => pr[k] === "late").length, logged: Object.keys(pr).length > 0 },
    pages: d.pages || 0,
    sleepH: d.sleepH ?? null, night: nightOf(d), nap: d.sleepH == null ? null : d.napMin || 0, bed: clockOf(d.sleepStart), up: clockOf(d.sleepEnd), fajr: d.wake ?? null,
    deficit: d.dietaryKcal ? deficitOf(d) : null, eaten: d.dietaryKcal ?? null, protein: protein[s] ?? null, weight: d.weight ?? null,
    steps: d.steps ?? null, recovery: d.recovery ?? null, hrv: d.hrv ?? null, restingHR: d.restingHR ?? null, strain: d.strain ?? null, exercise: d.exerciseMin ?? null,
    porn: d.pornFree === false, mast: d.mast === true, slip: d.pornFree === false || d.mast === true,
    did, slots: matchDay(s).map((m) => ({ id: m.slot.id, sport: m.slot.sport, name: slotName(m.slot), status: m.status })),
  };
}

/** Averages and counts over any run of day rows. */
export function summarize(rows) {
  const has = (k) => rows.filter((r) => r[k] != null);
  const avg = (k) => { const x = has(k); return x.length ? x.reduce((a, r) => a + r[k], 0) / x.length : null; };
  const food = has("deficit"), fed = has("protein"), weights = has("weight"), beds = rows.map((r) => fromNoon(r.bed)).filter((m) => m != null);
  let best = { n: 0, from: null, to: null }, run = null;
  for (const r of rows) {
    run = r.slip ? null : run ? { ...run, n: run.n + 1, to: r.date } : { n: 1, from: r.date, to: r.date };
    if (run && run.n > best.n) best = run;
  }
  return {
    days: rows.length, logged: rows.filter((r) => r.logged).length, office: rows.filter((r) => r.office).length,
    xp: rows.reduce((a, r) => a + (r.xp || 0), 0), xpBest: Math.max(0, ...rows.map((r) => r.xp || 0)),
    night: avg("night"), nap: avg("nap"), sleepDays: has("sleepH").length, nights7: rows.filter((r) => r.night >= (S.settings.sleepTarget || 7)).length,
    bed: beds.length ? minHM(beds.reduce((a, b) => a + b, 0) / beds.length) : null,
    fajr: rows.filter((r) => r.fajr === true).length, fajrDays: has("fajr").length,
    foodDays: food.length, deficit: avg("deficit"), dietDays: food.filter((r) => r.deficit >= (S.settings.deficitMin || 700)).length,
    proteinDays: fed.length, protein: avg("protein"), proteinMet: fed.filter((r) => r.protein >= (S.settings.proteinTarget || 160)).length,
    weightFirst: weights[0]?.weight ?? null, weightLast: weights.at(-1)?.weight ?? null,
    weightChange: weights.length > 1 ? Math.round((weights.at(-1).weight - weights[0].weight) * 10) / 10 : null,
    clean: rows.filter((r) => !r.slip).length, slips: rows.filter((r) => r.slip).map((r) => r.date), bestClean: best,
    steps: avg("steps"), recovery: avg("recovery"), hrv: avg("hrv"), restingHR: avg("restingHR"), strain: avg("strain"), exercise: avg("exercise"),
    sessions: rows.reduce((a, r) => a + r.did.length, 0), trainingDays: rows.filter((r) => r.did.length).length,
    pages: rows.reduce((a, r) => a + r.pages, 0),
  };
}

const dayName = (s) => fmt(s, { weekday: "long" });
const DAY = { SUN: "Sunday", MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday" };
const VERB = { gym: "went to the gym", tennis: "played tennis", mma: "trained MMA", swim: "swam", run: "ran" };
const NOUN = { gym: "gym", tennis: "tennis", mma: "MMA", swim: "swimming", run: "running" };
const list = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs.at(-1));
const h1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

/** What the week's numbers say, in sentences. Each finding appears only when the week's data supports it. */
export function findings(rows, sum) {
  const out = [];
  // Fajr against bedtime: only when every night you made it began before every night you missed it.
  const nights = rows.filter((r) => r.office && r.bed && r.fajr != null).map((r) => ({ ...r, at: fromNoon(r.bed) }));
  const made = nights.filter((r) => r.fajr), missed = nights.filter((r) => !r.fajr);
  if (made.length >= 2 && missed.length >= 2) {
    const lastMade = made.reduce((a, r) => (r.at > a.at ? r : a)), firstMissed = missed.reduce((a, r) => (r.at < a.at ? r : a));
    if (lastMade.at < firstMissed.at) out.push({ key: "fajr", tone: "warn", icon: "wb_twilight", title: "Bedtime decided Fajr",
      text: `You were up for Fajr after every night that began by ${lastMade.bed}, and missed it after every night that began at ${firstMissed.bed} or later.` });
  }
  // Slips after short nights (the night counts toward the morning you woke, so it's the slip day's own night).
  const slips = rows.filter((r) => r.slip), short = slips.filter((r) => r.night != null && r.night < FLOOR.sleepH);
  if (short.length) out.push({ key: "slips", tone: "warn", icon: "shield", title: "Short nights before slips",
    text: `${short.length === slips.length ? (slips.length === 1 ? "The" : "Every") : `${short.length} of ${slips.length}`} slip${slips.length === 1 ? "" : "s"} came after a night under ${FLOOR.sleepH} h: ${list(short.map((r) => `${dayName(r.date)} (${h1(r.night)} h)`))}.` });
  else if (!slips.length && sum.days === 7) out.push({ key: "clean", tone: "good", icon: "check_circle", title: "A clean week", text: "No slip on any of the seven days." });
  // Protein, once a few days of food are in.
  const target = S.settings.proteinTarget || 160;
  if (sum.proteinDays >= 3 && sum.protein < target) {
    const big = rows.filter((r) => r.protein != null && r.deficit != null).sort((a, b) => b.deficit - a.deficit).slice(0, 2);
    out.push({ key: "protein", tone: "warn", icon: "nutrition", title: "Protein lags the target",
      text: `You averaged ${Math.round(sum.protein)} g against ${target} g; ${sum.proteinMet} of ${sum.proteinDays} days reached it.` +
        (big.length === 2 ? ` The two biggest deficits (${big.map((r) => Math.round(r.deficit).toLocaleString("en")).join(" and ")} kcal) came with ${big.map((r) => Math.round(r.protein)).join(" g and ")} g.` : "") });
  }
  // Training against the schedule: sessions on days with no slot for that sport, slots called off, slots too long to meet.
  const off = [];
  for (const r of rows) if (!r.away) for (const k of r.did) if (!slotsOn(r.date).some((x) => x.sport === k)) off.push([k, r.date]);
  const cancelled = rows.flatMap((r) => r.slots.filter((x) => x.status === "cancelled").map((x) => [x.name, r.date]));
  const long = (S.settings.training || []).filter((x) => { const a = hmMin(x.start), b = hmMin(x.end); return a != null && b != null && (b > a ? b - a : b + 1440 - a) > 240; });
  const parts = [], bySport = {};
  for (const [k, s] of off) (bySport[k] ||= []).push(dayName(s));
  for (const [k, ds] of Object.entries(bySport)) parts.push(`You ${VERB[k] || "trained"} on ${list(ds)}, which ${ds.length === 1 ? "has" : "have"} no ${NOUN[k] || "training"} slot.`);
  const byName = {};
  for (const [n, s] of cancelled) (byName[n] ||= []).push(dayName(s));
  if (cancelled.length) parts.push(`${cancelled.length === 1 ? "One session was" : `${cancelled.length} sessions were`} called off: ${list(Object.entries(byName).map(([n, ds]) => `${n.toLowerCase()} on ${list(ds)}`))}.`);
  for (const x of long) {
    const a = hmMin(x.start), b = hmMin(x.end), h = Math.round(((b > a ? b - a : b + 1440 - a) / 60) * 10) / 10;
    parts.push(`The ${list((x.days || []).map((d) => DAY[d] || d))} ${slotName(x).toLowerCase()} slot runs ${h} hours (${x.start}–${x.end}), so it can never be met.`);
  }
  if (parts.length) out.push({ key: "schedule", tone: "warn", icon: "event_busy", title: "The schedule and the way you train", text: parts.join(" ") });
  // Knowledge at zero.
  if (sum.office && !rows.some((r) => r.office && r.pages >= (S.settings.pagesPerDay || 20))) out.push({ key: "pages", tone: "warn", icon: "menu_book", title: "Knowledge is at zero",
    text: `${sum.pages} page${sum.pages === 1 ? "" : "s"} in ${sum.office} day${sum.office === 1 ? "" : "s"} against ${S.settings.pagesPerDay} a day. A chapter ticked as a task earns nothing here; its page count does.` });
  return out;
}

/** The whole report for the week that opens on `start` (a Sunday). `protein` maps dates to grams from FatSecret. */
export function weekReport(start, { protein = {} } = {}) {
  const end = weekEnd(start), dates = range(start, addDays(end, 1)), prevDates = range(addDays(start, -7), start);
  const rows = dates.map((s) => dayRow(s, protein)), prevRows = prevDates.map((s) => dayRow(s, protein));
  const first = firstTracked(), sinceRows = first && first <= end ? range(first, addDays(end, 1)).map((s) => dayRow(s, protein)) : [];
  const t = termInfo(end), week = inOffice(end) ? Math.floor(diff(t.start, end) / 7) + 1 : null;
  // Level as it stood when the week closed, from every term day up to then.
  const xp = Object.keys(S.days).filter((k) => inOffice(k) && k <= end).reduce((a, k) => a + dayXP(k), 0), lv = levelFor(xp);
  const sum = summarize(rows);
  return {
    start, end, label: weekLabel(start), week, term: { n: t.n, name: t.name, ar: t.ar }, inTerm: inOffice(end),
    days: rows, sum, score: score(dates),
    prev: { start: prevDates[0], label: weekLabel(prevDates[0]), sum: summarize(prevRows), score: score(prevDates), tracked: prevRows.some((r) => r.logged) },
    since: { from: first, ...summarize(sinceRows) },
    level: { xp, ...lv, rank: rankFor(lv.level) },
    weighIn: weighIn(addDays(end, 1)), // the Sunday that closes it: this week's weight against last week's
    findings: findings(rows, sum),
  };
}
