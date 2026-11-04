// The game engine's rules, pinned. Run with `bun test` (CI runs it before every deploy).
import { describe, expect, test, beforeEach, setSystemTime, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import * as G from "../src/lib/logic.js";

const PERFECT = {
  prayers: { fajr: "on", dhuhr: "on", asr: "on", maghrib: "on", isha: "on" }, pages: 20,
  hair: true, skinAm: true, skinPm: true, teethAm: true, teethPm: true, watch: true, wake: true, sleepH: 7.5, sleepCons: 90,
  totalKcal: 2900, dietaryKcal: 2000, steps: 13000, exerciseMin: 60, strain: 13,
  checks: { plan: true, deep: true, ship: true, inbox: true, tomorrow: true }, train: "gym",
};
function fresh(days = {}, settings = {}) {
  G.setTimeZone(null);
  G.S.settings = { ...G.DEFAULTS, training: [], trainingOnce: [], whoopFrom: "2026-11-01", ...settings };
  G.S.days = structuredClone(days);
}
beforeEach(() => fresh());
afterEach(() => setSystemTime());

describe("one engine, two runtimes", () => {
  test("the game function deploys the same file as the app", () => {
    const app = readFileSync(new URL("../src/lib/logic.js", import.meta.url), "utf8");
    const server = readFileSync(new URL("../supabase/functions/game/logic.js", import.meta.url), "utf8");
    expect(server).toBe(app); // after changing the rules: cp src/lib/logic.js supabase/functions/game/ and redeploy `game`
  });
});

describe("levels", () => {
  test("level 1 at 0 XP, level 2 at 60, and each level costs more than the last", () => {
    expect(G.levelFor(0).level).toBe(1);
    expect(G.levelFor(59).level).toBe(1);
    expect(G.levelFor(60).level).toBe(2);
    for (let L = 2; L < 30; L++) expect(G.levelStart(L + 1) - G.levelStart(L)).toBeGreaterThan(G.levelStart(L) - G.levelStart(L - 1));
  });
  test("ranks change at their levels", () => {
    expect(G.rankFor(1).en).toBe("Candidate");
    expect(G.rankFor(3).en).toBe("Elected");
    expect(G.rankFor(30).en).toBe("The Enlightened");
  });
});

describe("a day's XP", () => {
  test("a perfect weekday pays the maximum", () => {
    fresh({ "2026-11-02": PERFECT }); // a Monday, no training slots
    expect(G.dayXP("2026-11-02")).toBe(G.MAX_DAY_XP);
    expect(G.xpParts("2026-11-02").perfect.earned).toBe(G.PERFECT_BONUS);
  });
  test("an unlogged day pays nothing, whatever the watch measured", () => {
    fresh({ "2026-11-02": { steps: 20000, sleepH: 8, source: "WHOOP 2026-11-02T10:00:00Z" } });
    expect(G.dayXP("2026-11-02")).toBe(0);
    expect(G.manual(G.S.days["2026-11-02"])).toBe(false);
  });
  test("a made-up prayer pays half", () => {
    fresh({ "2026-11-02": { prayers: { fajr: "late" } } });
    expect(G.day("2026-11-02").faith).toBeCloseTo(0.1);
  });
  test("purity starts clean; a logged slip takes Purity and the abstain bonus away", () => {
    fresh({ "2026-11-02": { pages: 20 } });
    const clean = G.dayXP("2026-11-02");
    expect(G.xpParts("2026-11-02").ministers.purity.earned).toBe(20);
    G.S.days["2026-11-02"].pornFree = false;
    expect(G.xpParts("2026-11-02").ministers.purity.earned).toBe(0);
    expect(clean - G.dayXP("2026-11-02")).toBe(20 + G.ABSTAIN_XP);
  });
  test("days before the term never count", () => {
    fresh({ "2026-10-31": PERFECT, "2026-11-02": { pages: 20 } });
    expect(G.totals().logged).toBe(1);
  });
});

describe("the Sunday weigh-in", () => {
  test("a drop of 0.1 kg or more against last Sunday pays 40 XP", () => {
    fresh({ "2026-11-01": { weight: 92.0 }, "2026-11-08": { weight: 91.9, pages: 20 } });
    expect(G.weighIn("2026-11-08").won).toBe(true);
    expect(G.xpParts("2026-11-08").weighIn.earned).toBe(G.WEIGH_IN_XP);
  });
  test("no drop, no XP; not a Sunday, no weigh-in", () => {
    fresh({ "2026-11-01": { weight: 92.0 }, "2026-11-08": { weight: 92.0 } });
    expect(G.weighIn("2026-11-08").won).toBe(false);
    expect(G.weighIn("2026-11-09")).toBeNull();
  });
});

describe("training slots and WHOOP workouts", () => {
  test("workout names map to sports", () => {
    const cases = { Weightlifting: "gym", "Functional Fitness": "gym", Elliptical: "gym", Tennis: "tennis", Padel: "tennis", Boxing: "mma", "Jiu Jitsu": "mma",
      "Muay Thai": "mma", Swimming: "swim", Running: "run", Walking: "walk", Activity: null };
    for (const [name, sport] of Object.entries(cases)) expect([name, G.sportOf(name)]).toEqual([name, sport]);
  });
  test("a slot is met by its own sport, not by a walk at the same time", () => {
    setSystemTime(new Date(2026, 10, 3, 12)); // the day after
    const slot = { id: "t", sport: "tennis", days: ["MON"], start: "19:00", end: "21:00" };
    fresh({ "2026-11-02": { workoutsDetail: [{ a: "Walking", s: "19:00", e: "21:00", min: 120 }] } }, { training: [slot] });
    expect(G.matchSlot("2026-11-02", slot, 23 * 60).status).toBe("missed");
    G.S.days["2026-11-02"].workoutsDetail = [{ a: "Tennis", s: "19:10", e: "20:40", min: 90 }];
    expect(G.matchSlot("2026-11-02", slot, 23 * 60).status).toBe("done");
  });
  test("an unnamed WHOOP activity still counts for the slot it overlaps", () => {
    setSystemTime(new Date(2026, 10, 3, 12));
    const slot = { id: "g", sport: "gym", days: ["MON"], start: "18:00", end: "19:00" };
    fresh({ "2026-11-02": { workoutsDetail: [{ a: "Activity", s: "18:00", e: "19:00", min: 60 }] } }, { training: [slot] });
    expect(G.matchSlot("2026-11-02", slot, 23 * 60).status).toBe("done");
  });
  test("a workout of the slot's sport counts at any time that day", () => {
    setSystemTime(new Date(2026, 10, 4, 12));
    const slot = { id: "g", sport: "gym", days: ["TUE"], start: "07:00", end: "08:30" };
    fresh({ "2026-11-03": { workoutsDetail: [
      { a: "Elliptical", s: "10:36", e: "10:56", kcal: 300 }, { a: "Walking", s: "10:59", e: "11:14", kcal: 100 },
      { a: "Weightlifting", s: "11:17", e: "12:27", kcal: 400 }, { a: "Tennis", s: "20:32", e: "21:56", kcal: 600 },
    ] } }, { training: [slot] });
    const m = G.matchSlot("2026-11-03", slot);
    expect(m.status).toBe("done");
    expect(m.done).toBe(90); // the elliptical and the weights, not the walk or the tennis
    expect(m.kcal).toBe(700);
    expect(m.source).toBe("workout");
  });
  test("another sport, or a walk, doesn't count at any time", () => {
    setSystemTime(new Date(2026, 10, 4, 12));
    const slot = { id: "g", sport: "gym", days: ["TUE"], start: "07:00", end: "08:30" };
    fresh({ "2026-11-03": { workoutsDetail: [{ a: "Tennis", s: "20:00", e: "22:00" }, { a: "Walking", s: "12:00", e: "13:00" }] } }, { training: [slot] });
    expect(G.matchSlot("2026-11-03", slot).status).toBe("missed");
  });
  test("an unnamed activity away from the slot's time doesn't count", () => {
    setSystemTime(new Date(2026, 10, 4, 12));
    const slot = { id: "g", sport: "gym", days: ["TUE"], start: "07:00", end: "08:30" };
    fresh({ "2026-11-03": { workoutsDetail: [{ a: "Activity", s: "15:00", e: "16:00" }] } }, { training: [slot] });
    expect(G.matchSlot("2026-11-03", slot).status).toBe("missed");
  });
  test("with two slots of one sport, time decides, and two off-hours games fill both", () => {
    setSystemTime(new Date(2026, 10, 8, 12));
    const am = { id: "am", sport: "tennis", days: ["SAT"], start: "09:00", end: "10:30" };
    const pm = { id: "pm", sport: "tennis", days: ["SAT"], start: "20:00", end: "21:30" };
    fresh({ "2026-11-07": { workoutsDetail: [{ a: "Tennis", s: "12:00", e: "13:30" }] } }, { training: [am, pm] });
    expect(G.matchSlot("2026-11-07", am).status).toBe("done");
    expect(G.matchSlot("2026-11-07", pm).status).toBe("missed");
    G.S.days["2026-11-07"].workoutsDetail = [{ a: "Tennis", s: "12:00", e: "13:30" }, { a: "Tennis", s: "15:00", e: "16:30" }];
    expect(G.matchSlot("2026-11-07", am).status).toBe("done");
    expect(G.matchSlot("2026-11-07", pm).status).toBe("done");
  });
  test("a workout already training today fills a session later today", () => {
    const slot = { id: "t", sport: "tennis", days: ["WED"], start: "20:00", end: "21:30" };
    fresh({ "2026-11-04": { workoutsDetail: [{ a: "Tennis", s: "09:00", e: "10:30" }] } }, { training: [slot] });
    setSystemTime(new Date(2026, 10, 4, 12));
    expect(G.matchSlot("2026-11-04", slot, 12 * 60).status).toBe("done");
  });
});

describe("cancelled sessions", () => {
  const am = { id: "am", sport: "tennis", days: ["SAT"], start: "09:00", end: "10:30" };
  const pm = { id: "pm", sport: "tennis", days: ["SAT"], start: "17:00", end: "18:30" };
  test("a cancelled session is never judged, and the one that stands decides the day", () => {
    setSystemTime(new Date(2026, 10, 8, 23)); // Saturday night
    fresh({ "2026-11-07": { pages: 20, cancelled: { pm: true }, workoutsDetail: [{ a: "Tennis", s: "09:00", e: "10:30", min: 90 }] } }, { training: [am, pm] });
    expect(G.matchSlot("2026-11-07", pm).status).toBe("cancelled");
    expect(G.matchSlot("2026-11-07", am).status).toBe("done");
    G.S.days["2026-11-07"].totalKcal = 3000; G.S.days["2026-11-07"].dietaryKcal = 2000; // diet met
    expect(G.dayMinisters("2026-11-07").body).toBeCloseTo(1);
  });
  test("every session called off is a rest day, not a missed one", () => {
    setSystemTime(new Date(2026, 10, 8, 23));
    fresh({ "2026-11-07": { pages: 20, cancelled: { am: true, pm: true }, totalKcal: 3000, dietaryKcal: 2000 } }, { training: [am, pm] });
    expect(G.dayMinisters("2026-11-07").body).toBeCloseTo(1);
    const r = G.score(["2026-11-07"]);
    expect(r.planned).toBe(0);
  });
  test("without cancelling, the missed session counts against the day", () => {
    setSystemTime(new Date(2026, 10, 8, 23));
    fresh({ "2026-11-07": { pages: 20, totalKcal: 3000, dietaryKcal: 2000, workoutsDetail: [{ a: "Tennis", s: "09:00", e: "10:30", min: 90 }] } }, { training: [am, pm] });
    expect(G.matchSlot("2026-11-07", pm).status).toBe("missed");
    expect(G.dayMinisters("2026-11-07").body).toBeCloseTo(0.6 + 0.4 * 0.5);
  });
});

describe("streaks and medals", () => {
  test("streaks count back from today, or from yesterday if today isn't logged yet", () => {
    setSystemTime(new Date(2026, 10, 4, 12));
    fresh({ "2026-11-01": { pages: 1 }, "2026-11-02": { pages: 1 }, "2026-11-03": { pages: 1 } });
    expect(G.streak(G.T.office)).toBe(3);
    G.S.days["2026-11-04"] = { pages: 1 };
    expect(G.streak(G.T.office)).toBe(4);
  });
  test("best streak survives a gap", () => {
    fresh({ "2026-11-01": { pages: 1 }, "2026-11-02": { pages: 1 }, "2026-11-04": { pages: 1 } });
    expect(G.bestStreak(G.T.office)).toBe(2);
  });
  test("every medal reports progress between 0 and 1, and the first decree is won by the first logged day", () => {
    fresh({ "2026-11-02": PERFECT });
    const ms = G.medals();
    expect(ms.length).toBeGreaterThanOrEqual(47);
    for (const m of ms) { expect(m.frac).toBeGreaterThanOrEqual(0); expect(m.frac).toBeLessThanOrEqual(1); }
    expect(ms.find((m) => m.id === "first").won).toBe(true);
    expect(new Set(ms.map((m) => m.id)).size).toBe(ms.length);
  });
});

describe("the clock", () => {
  test("on the server (UTC), today is Cairo's date: 23:30 in Cairo is still that day", () => {
    setSystemTime(new Date("2026-11-01T21:30:00Z")); // 23:30 in Cairo (UTC+2)
    G.setTimeZone("Africa/Cairo");
    expect(G.today()).toBe("2026-11-01");
    expect(G.minutesNow()).toBe(23 * 60 + 30);
    setSystemTime(new Date("2026-11-01T22:30:00Z")); // 00:30 the next day in Cairo
    expect(G.today()).toBe("2026-11-02");
    G.setTimeZone(null);
  });
});
