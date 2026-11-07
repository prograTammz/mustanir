// The weekly report, pinned. Run with `bun test` (TZ=Africa/Cairo, as CI does).
import { describe, expect, test, beforeEach, setSystemTime, afterEach } from "bun:test";
import * as G from "../src/lib/logic.js";
import * as W from "../src/lib/week.js";

const PRAYED = { fajr: "on", dhuhr: "on", asr: "on", maghrib: "on", isha: "late" };
function fresh(days = {}, settings = {}) {
  G.setTimeZone(null);
  G.S.settings = { ...G.DEFAULTS, training: [], trainingOnce: [], whoopFrom: "2026-11-01", ...settings };
  G.S.days = structuredClone(days);
}
// A night from `bed` (the evening before `day`, Cairo time) to `up` on `day`, as WHOOP stores it.
const night = (day, bed, up, h, extra = {}) => ({
  sleepStart: new Date(`${G.addDays(day, bed < "12:00" ? 0 : -1)}T${bed}:00+02:00`).toISOString(),
  sleepEnd: new Date(`${day}T${up}:00+02:00`).toISOString(), sleepH: h, napMin: 0, ...extra,
});
beforeEach(() => { fresh(); setSystemTime(new Date(2026, 10, 8, 9)); }); // Sunday 8 November, the first report's morning
afterEach(() => setSystemTime());

describe("which week", () => {
  test("weeks run Sunday to Saturday, and the report is the latest one that has ended", () => {
    expect(W.weekStart("2026-11-07")).toBe("2026-11-01");
    expect(W.weekStart("2026-11-08")).toBe("2026-11-08");
    expect(W.lastWeek("2026-11-08")).toBe("2026-11-01"); // Sunday: last week's report is out
    expect(W.lastWeek("2026-11-07")).toBe("2026-10-25"); // Saturday: this week isn't over yet
    expect(W.weekLabel("2026-11-01")).toBe("1–7 Nov");
    expect(W.weekLabel("2026-11-29")).toBe("29 Nov – 5 Dec");
  });
  test("the first week of the term is week 1, and a week before it has none", () => {
    fresh({ "2026-11-02": { prayers: PRAYED } });
    expect(W.weekReport("2026-11-01").week).toBe(1);
    expect(W.weekReport("2026-11-08").week).toBe(2);
    expect(W.weekReport("2026-10-25").week).toBe(null);
  });
});

describe("the numbers", () => {
  test("XP is the sum of the term days, and the level is the one the week closed on", () => {
    fresh({ "2026-11-01": { prayers: PRAYED }, "2026-11-03": { prayers: PRAYED }, "2026-11-09": { prayers: PRAYED } });
    const r = W.weekReport("2026-11-01"), xp = G.dayXP("2026-11-01") + G.dayXP("2026-11-03"); // days with no record earn nothing
    expect(r.sum.xp).toBe(xp);
    expect(r.level.xp).toBe(xp); // 9 November comes after the week, so it isn't counted
    expect(r.level.level).toBe(G.levelFor(xp).level);
  });
  test("night sleep leaves out naps, and bedtimes past midnight average with the ones before it", () => {
    fresh({ "2026-11-02": night("2026-11-02", "23:30", "05:00", 7, { napMin: 60, prayers: PRAYED }), "2026-11-03": night("2026-11-03", "00:30", "06:00", 5.5) });
    const r = W.weekReport("2026-11-01");
    expect(r.days[1].night).toBeCloseTo(6, 5);
    expect(r.days[1].bed).toBe("23:30");
    expect(r.sum.night).toBeCloseTo(5.75, 5);
    expect(r.sum.bed).toBe("00:00");
  });
  test("the deficit counts only days with food logged, and protein comes from FatSecret", () => {
    fresh({ "2026-11-02": { totalKcal: 2800, dietaryKcal: 1800, prayers: PRAYED }, "2026-11-03": { totalKcal: 2500, deficit: 900 } });
    const r = W.weekReport("2026-11-01", { protein: { "2026-11-02": 170 } });
    expect(r.sum.foodDays).toBe(1);
    expect(r.sum.deficit).toBe(1000);
    expect(r.sum.dietDays).toBe(1);
    expect([r.sum.protein, r.sum.proteinMet]).toEqual([170, 1]);
  });
  test("a slip breaks the clean run, and training counts each sport once a day", () => {
    fresh({
      "2026-11-02": { mast: true, workoutsDetail: [{ a: "Elliptical", s: "11:00", e: "11:20" }, { a: "Weightlifting", s: "11:25", e: "12:30" }, { a: "Walking", s: "17:00", e: "17:30" }] },
      "2026-11-05": { pornFree: false, workoutsDetail: [{ a: "Tennis", s: "20:30", e: "22:00" }] },
    });
    const r = W.weekReport("2026-11-01");
    expect(r.sum.clean).toBe(5);
    expect(r.sum.slips).toEqual(["2026-11-02", "2026-11-05"]);
    expect(r.sum.bestClean).toMatchObject({ n: 2, from: "2026-11-03", to: "2026-11-04" });
    expect([r.sum.sessions, r.sum.trainingDays]).toEqual([2, 2]);
  });
  test("the week before is reported beside it, and the Sunday after closes the weigh-in", () => {
    fresh({ "2026-11-01": { weight: 94, prayers: PRAYED }, "2026-11-06": { weight: 90.5 }, "2026-10-27": { mast: true } });
    const r = W.weekReport("2026-11-01");
    expect(r.prev.start).toBe("2026-10-25");
    expect(r.prev.tracked).toBe(true);
    expect(r.sum.weightChange).toBe(-3.5);
    expect(r.weighIn).toMatchObject({ before: 94, now: 90.5, won: true });
    expect(r.since.from).toBe("2026-10-27");
  });
});

describe("findings", () => {
  const keys = (r) => r.findings.map((f) => f.key);
  test("bedtime and Fajr, only when every night made began before every night missed", () => {
    fresh({
      "2026-11-01": night("2026-11-01", "22:40", "05:00", 6, { wake: true, prayers: PRAYED }), "2026-11-02": night("2026-11-02", "22:55", "05:00", 6, { wake: true }),
      "2026-11-03": night("2026-11-03", "23:50", "07:00", 7, { wake: false }), "2026-11-04": night("2026-11-04", "00:05", "07:30", 7, { wake: false }),
    });
    const f = W.weekReport("2026-11-01").findings.find((x) => x.key === "fajr");
    expect(f.text).toContain("began by 22:55");
    expect(f.text).toContain("at 23:50 or later");
    G.S.days["2026-11-04"].wake = true; // an exception: no clean split, no finding
    expect(keys(W.weekReport("2026-11-01"))).not.toContain("fajr");
  });
  test("a slip after a short night is named; a week with none is called clean", () => {
    fresh({ "2026-11-03": night("2026-11-03", "22:55", "03:34", 6.1, { napMin: 132, mast: true, pornFree: false }) });
    expect(W.weekReport("2026-11-01").findings.find((x) => x.key === "slips").text).toBe("The slip came after a night under 6.5 h: Tuesday (3.9 h).");
    fresh({ "2026-11-02": { prayers: PRAYED } });
    expect(keys(W.weekReport("2026-11-01"))).toContain("clean");
  });
  test("protein below the target, once three days of food are in", () => {
    const fed = { totalKcal: 3000, dietaryKcal: 1500 };
    fresh({ "2026-11-02": fed, "2026-11-03": fed, "2026-11-04": fed });
    expect(keys(W.weekReport("2026-11-01", { protein: { "2026-11-02": 90, "2026-11-03": 100 } }))).not.toContain("protein");
    expect(keys(W.weekReport("2026-11-01", { protein: { "2026-11-02": 90, "2026-11-03": 100, "2026-11-04": 170 } }))).toContain("protein");
  });
  test("sessions off the schedule, called off, and a slot too long to meet", () => {
    const training = [
      { id: "t-mon", sport: "tennis", days: ["MON"], start: "20:00", end: "21:30" },
      { id: "g-sun", sport: "gym", days: ["SUN"], start: "07:00", end: "20:30" },
    ];
    fresh({
      "2026-11-02": { cancelled: { "t-mon": true }, prayers: PRAYED },
      "2026-11-03": { workoutsDetail: [{ a: "Tennis", s: "20:30", e: "22:00" }] },
    }, { training });
    const text = W.weekReport("2026-11-01").findings.find((x) => x.key === "schedule").text;
    expect(text).toContain("You played tennis on Tuesday, which has no tennis slot.");
    expect(text).toContain("One session was called off: tennis on Monday.");
    expect(text).toContain("The Sunday gym slot runs 13.5 hours (07:00–20:30)");
  });
  test("Knowledge at zero only when no term day had pages", () => {
    fresh({ "2026-11-02": { prayers: PRAYED, pages: 5 } });
    expect(W.weekReport("2026-11-01").findings.find((x) => x.key === "pages").text).toContain("5 pages in 7 days against 20 a day");
    G.S.days["2026-11-03"] = { pages: 20 };
    expect(keys(W.weekReport("2026-11-01"))).not.toContain("pages");
  });
});
