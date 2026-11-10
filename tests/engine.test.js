// The game engine's rules, pinned. Run with `bun test` (CI runs it before every deploy).
import { describe, expect, test, beforeEach, setSystemTime, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import * as G from "../src/lib/logic.js";

const PERFECT = {
  prayers: { fajr: "on", dhuhr: "on", asr: "on", maghrib: "on", isha: "on" }, pages: 20,
  hair: true, skinAm: true, skinPm: true, teethAm: true, teethPm: true, watch: true, sleepPerf: 100, recovery: 80, sleepH: 7.5, sleepCons: 90,
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
  test("an unlogged day pays only Purity, whatever the watch measured", () => {
    fresh({ "2026-11-02": { steps: 20000, sleepH: 8, source: "WHOOP 2026-11-02T10:00:00Z" } });
    expect(G.manual(G.S.days["2026-11-02"])).toBe(false);
    expect(G.xpParts("2026-11-02").ministers.purity.earned).toBe(20);
    expect(G.xpParts("2026-11-02").abstain.earned).toBe(G.ABSTAIN_XP);
    expect(G.dayXP("2026-11-02")).toBe(20 + G.ABSTAIN_XP);
    expect(G.totals().xp).toBe(20 + G.ABSTAIN_XP);
    expect(G.totals().logged).toBe(0);
    expect(G.score(["2026-11-02"]).purity).toBe(1);
  });
  test("the shield is only up on term days so far", () => {
    const later = G.addDays(G.today(), 1);
    fresh({ "2026-10-31": { steps: 1 }, [later]: { steps: 1 } });
    for (const k of ["2026-10-31", later]) {
      expect(G.dayXP(k)).toBe(0);
      expect(G.dayMinisters(k).purity).toBe(0);
    }
    expect(G.totals().xp).toBe(0);
  });
  test("a made-up prayer pays half", () => {
    fresh({ "2026-11-02": { prayers: { fajr: "late" } } });
    expect(G.day("2026-11-02").faith).toBeCloseTo(0.1);
  });
  test("purity starts clean; porn costs 15 of its 20 and the abstain bonus", () => {
    fresh({ "2026-11-02": { pages: 20 } });
    const clean = G.dayXP("2026-11-02");
    expect(G.xpParts("2026-11-02").ministers.purity.earned).toBe(20);
    G.S.days["2026-11-02"].pornFree = false;
    expect(G.xpParts("2026-11-02").ministers.purity.earned).toBe(5);
    expect(G.xpParts("2026-11-02").abstain.earned).toBe(0);
    expect(clean - G.dayXP("2026-11-02")).toBe(G.PORN_COST + G.ABSTAIN_XP);
  });
  test("masturbation alone costs Purity 5, not the whole 20; both slips take all of it", () => {
    fresh({ "2026-11-02": { pages: 20, mast: true } });
    expect(G.xpParts("2026-11-02").ministers.purity.earned).toBe(20 - G.MAST_COST);
    expect(G.xpParts("2026-11-02").abstain.earned).toBe(0);
    expect(G.score(["2026-11-02"]).purity).toBeCloseTo(0.75);
    G.S.days["2026-11-02"].pornFree = false;
    expect(G.xpParts("2026-11-02").ministers.purity.earned).toBe(0);
    expect(G.score(["2026-11-02"]).purity).toBe(0);
  });
  test("sleep pays by WHOOP's sleep score in whole points of 10, not by hours, Fajr or consistency", () => {
    const routines = { hair: true, skinAm: true, skinPm: true, teethAm: true, teethPm: true, watch: true };
    // A short night with a high score beats a long one with a low score; up for Fajr and a steady rhythm add nothing.
    fresh({ "2026-11-02": { ...routines, sleepPerf: 75, sleepH: 5.2, sleepCons: 40 }, "2026-11-03": { ...routines, sleepPerf: 40, sleepH: 8.5, sleepCons: 95, wake: true } });
    expect(G.sleepPoints(G.S.days["2026-11-02"])).toBe(8); // 7.5 rounds up
    expect(G.xpParts("2026-11-02").ministers.habits.earned).toBe(18);
    expect(G.sleepPoints(G.S.days["2026-11-03"])).toBe(4);
    expect(G.xpParts("2026-11-03").ministers.habits.earned).toBe(14);
    // No score yet (or a pre-WHOOP day): the sleep half pays nothing, the routines still pay theirs.
    fresh({ "2026-11-02": { ...routines, sleepH: 8 } });
    expect(G.xpParts("2026-11-02").ministers.habits.earned).toBe(10);
    fresh({ "2026-11-02": { pages: 20, sleepPerf: 100 } });
    expect(G.xpParts("2026-11-02").ministers.habits.earned).toBe(10);
  });
  test("vitality: sleep score and recovery are vitals, hours and consistency are not; the medal needs 4 of 5", () => {
    fresh({ "2026-11-02": { pages: 20, steps: 9000, exerciseMin: 35, sleepPerf: 82, recovery: 70, strain: 11, sleepH: 5, sleepCons: 30 } });
    const v = G.vitalityFor("2026-11-02");
    expect(v.items.map((x) => x.k).join()).toBe("steps,exerciseMin,sleepPerf,recovery,strain");
    expect(v.hits).toBe(5);
    G.S.days["2026-11-02"].recovery = 50;
    expect(G.vitalityFor("2026-11-02").hits).toBe(4);
    expect(G.T.vital(G.S.days["2026-11-02"], "2026-11-02")).toBe(true);
    G.S.days["2026-11-02"].sleepPerf = 79;
    expect(G.T.vital(G.S.days["2026-11-02"], "2026-11-02")).toBe(false);
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

// Prayed and read, nothing else: what the rest day asks for.
const PRAYED = { prayers: PERFECT.prayers, pages: 20 };

describe("the Minister of Productivity", () => {
  test("pays the share of the day's checklist ticked, out of 20, in place of the old checklist XP", () => {
    fresh({ "2026-11-02": { ...PERFECT, checks: { plan: true, deep: true, ship: true }, extraTasks: [{ id: "x1", text: "Call the bank" }] } });
    const p = G.xpParts("2026-11-02");
    expect(p.ministers.productivity.earned).toBe(10); // 3 of 6 tasks
    expect(p.checklist).toBe(undefined);
    expect(G.MAX_DAY_XP).toBe(6 * 20 + G.PERFECT_BONUS + G.VITALITY_XP + G.ABSTAIN_XP);
    expect(G.MINISTERS.map((m) => m.key)).toContain("productivity");
  });
  test("is judged in the approval on working days, like Order and Body", () => {
    fresh({ "2026-11-01": PRAYED, "2026-11-02": { ...PERFECT, checks: { plan: true, deep: true } } });
    const r = G.score(["2026-11-01", "2026-11-02"]);
    expect(r.productivity).toBeCloseTo(2 / 5);
    expect(G.score(["2026-11-01"]).productivity).toBeNull();
  });
});

describe("the perfect-day chest", () => {
  test("opens with 5 of the 6 ministers at 90%", () => {
    fresh({ "2026-11-02": { ...PERFECT, checks: {} } }); // everything but the checklist
    const p = G.xpParts("2026-11-02");
    expect(p.near).toBe(5);
    expect(p.need).toBe(5);
    expect(p.of).toBe(6);
    expect(p.perfect.earned).toBe(G.PERFECT_BONUS);
    expect(G.totals().perfect).toBe(1); // and it counts toward the perfect-day medals
  });
  test("stays shut with 4 of 6", () => {
    fresh({ "2026-11-02": { ...PERFECT, checks: {}, pages: 5 } });
    const p = G.xpParts("2026-11-02");
    expect(p.near).toBe(4);
    expect(p.perfect.earned).toBe(0);
    expect(G.totals().perfect).toBe(0);
  });
  test("on the rest day it still asks for all three that count", () => {
    fresh({ "2026-11-01": { ...PRAYED, pages: 5 } });
    const p = G.xpParts("2026-11-01");
    expect(p.need).toBe(3);
    expect(p.of).toBe(3);
    expect(p.perfect.earned).toBe(0);
  });
});

describe("a session is yes or no", () => {
  const gym = { id: "gym", sport: "gym", days: ["TUE"], start: "07:00", end: "08:30" };
  test("a done session pays in full, however much shorter than its calendar slot", () => {
    setSystemTime(new Date(2026, 10, 10, 23)); // Tuesday night
    fresh({ "2026-11-10": { pages: 20, totalKcal: 2174, dietaryKcal: 844, workoutsDetail: [{ a: "Elliptical", s: "12:46", e: "13:12" }, { a: "Powerlifting", s: "13:17", e: "13:53" }] } }, { training: [gym] });
    const m = G.matchSlot("2026-11-10", gym);
    expect(m.status).toBe("done");
    expect(m.done).toBe(62);
    expect(G.dayMinisters("2026-11-10").body).toBeCloseTo(1);
    expect(G.xpParts("2026-11-10").ministers.body.earned).toBe(20);
  });
  test("a session short of done pays nothing for training", () => {
    setSystemTime(new Date(2026, 10, 10, 23));
    fresh({ "2026-11-10": { pages: 20, totalKcal: 3000, dietaryKcal: 2000, workoutsDetail: [{ a: "Weightlifting", s: "07:00", e: "07:20" }] } }, { training: [gym] });
    expect(G.matchSlot("2026-11-10", gym).status).toBe("partial");
    expect(G.dayMinisters("2026-11-10").body).toBeCloseTo(0.6);
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

describe("the rest day", () => {
  const PRAYED_AND_READ = { prayers: PERFECT.prayers, pages: 20 };
  test("Sunday unless Settings moves it", () => {
    expect(G.isRestDay("2026-11-01")).toBe(true); // a Sunday
    expect(G.isRestDay("2026-11-02")).toBe(false);
    fresh({}, { restDay: "FRI" });
    expect(G.isRestDay("2026-11-06")).toBe(true);
    expect(G.isRestDay("2026-11-01")).toBe(false);
    expect(G.restDayName()).toBe("Friday");
  });
  test("Faith, Knowledge and Purity make the whole target and open the chest", () => {
    fresh({ "2026-11-01": PRAYED_AND_READ, "2026-11-02": PRAYED_AND_READ });
    expect(G.REST_MAX_XP).toBe(3 * 20 + G.PERFECT_BONUS + G.ABSTAIN_XP);
    const sun = G.xpParts("2026-11-01");
    expect(sun.max).toBe(G.REST_MAX_XP);
    expect(sun.perfect.earned).toBe(G.PERFECT_BONUS);
    expect(sun.earned).toBe(G.REST_MAX_XP);
    expect(sun.extra).toBe(0);
    expect(G.dayXP("2026-11-01")).toBe(G.REST_MAX_XP);
    // The same day's work on a Monday leaves Order and Body short: no chest.
    expect(G.xpParts("2026-11-02").perfect.earned).toBe(0);
    expect(G.xpParts("2026-11-02").max).toBe(G.MAX_DAY_XP);
    expect(G.totals().perfect).toBe(1);
  });
  test("Order, Body, Productivity and the vitals still pay, as extra", () => {
    fresh({ "2026-11-01": PERFECT, "2026-11-02": PERFECT });
    const sun = G.xpParts("2026-11-01");
    expect(G.dayXP("2026-11-01")).toBe(G.dayXP("2026-11-02")); // nothing is lost on the rest day
    expect(sun.ministers.body.extra).toBe(true);
    expect(sun.ministers.habits.extra).toBe(true);
    expect(sun.ministers.productivity.extra).toBe(true);
    expect(sun.ministers.faith.extra).toBe(false);
    expect(sun.earned).toBe(G.REST_MAX_XP);
    expect(sun.extra).toBe(G.dayXP("2026-11-01") - G.REST_MAX_XP);
  });
  test("the approval judges Order and Body on working days only", () => {
    fresh({ "2026-11-01": PRAYED_AND_READ, "2026-11-02": PERFECT });
    const r = G.score(["2026-11-01", "2026-11-02"]);
    expect(r.diet).toBe(1); // Sunday ate nothing logged, and isn't judged
    expect(r.habits).toBe(1);
    expect(r.rest).toBe(1);
    const sun = G.score(["2026-11-01"]); // nothing but the rest day: no verdict for them
    expect(sun.body).toBeNull();
    expect(sun.habits).toBeNull();
    expect(sun.overall).toBe(1);
  });
  test("a session on the rest day counts when done and is never missed", () => {
    setSystemTime(new Date(2026, 10, 7, 12));
    const gym = { a: "Weightlifting", s: "10:00", e: "11:00", min: 60 };
    fresh({ "2026-11-01": PRAYED_AND_READ, "2026-11-02": { ...PRAYED_AND_READ, workoutsDetail: [gym] } },
      { training: [{ id: "g", sport: "gym", days: ["SUN", "MON"], start: "10:00", end: "11:00" }] });
    let r = G.score(["2026-11-01", "2026-11-02"]);
    expect(r.planned).toBe(1);
    expect(r.sessions).toBe(1);
    expect(r.training).toBe(1);
    G.S.days["2026-11-01"].workoutsDetail = [gym];
    r = G.score(["2026-11-01", "2026-11-02"]);
    expect(r.sessions).toBe(2);
    expect(r.planned).toBe(1);
  });
  test("Order and Body streaks step over a missed rest day; Faith's don't", () => {
    setSystemTime(new Date(2026, 10, 10, 20));
    const up = { wake: true, prayers: PERFECT.prayers };
    fresh({ "2026-11-07": up, "2026-11-08": { wake: false, prayers: {} }, "2026-11-09": up, "2026-11-10": up }); // 8 Nov is a Sunday
    expect(G.bestStreak(G.T.fajr)).toBe(3);
    expect(G.streak(G.T.fajr)).toBe(3);
    expect(G.bestStreak(G.T.prayers)).toBe(2);
    expect(G.streak(G.T.prayers)).toBe(2);
    delete G.S.days["2026-11-08"]; // nothing recorded on the rest day at all
    expect(G.bestStreak(G.T.fajr)).toBe(3);
    G.S.days["2026-11-08"] = up; // met on the rest day, it counts
    expect(G.bestStreak(G.T.fajr)).toBe(4);
    fresh({ "2026-11-09": up, "2026-11-10": { wake: false }, "2026-11-11": up }); // a missed Tuesday still breaks it
    expect(G.bestStreak(G.T.fajr)).toBe(1);
  });
});

describe("marking the rest day", () => {
  test("a day marked rest takes the week's rest from Sunday; the next week rests on Sunday again", () => {
    fresh({ "2026-11-04": { rest: true } }); // a Wednesday in the week of Sunday 1 November
    expect(G.isRestDay("2026-11-04")).toBe(true);
    expect(G.isRestDay("2026-11-01")).toBe(false);
    expect(G.restDayOf("2026-11-07")).toBe("2026-11-04");
    expect(G.isRestDay("2026-11-08")).toBe(true);
    expect(G.manual(G.S.days["2026-11-04"])).toBe(true); // marking it logs the day
  });
  test("unmarking Sunday leaves the week without a rest day", () => {
    fresh({ "2026-11-01": { rest: false, prayers: PERFECT.prayers, pages: 20 } });
    expect(G.isRestDay("2026-11-01")).toBe(false);
    expect(G.restDayOf("2026-11-03")).toBeNull();
    expect(G.xpParts("2026-11-01").max).toBe(G.MAX_DAY_XP + G.WEIGH_IN_XP);
    expect(G.xpParts("2026-11-01").perfect.earned).toBe(0); // all six count again, and only 3 are at 90%
  });
  test("a marked day scores as the rest day: three ministers open the chest", () => {
    fresh({ "2026-11-04": { rest: true, prayers: PERFECT.prayers, pages: 20 } });
    const p = G.xpParts("2026-11-04");
    expect(p.rest).toBe(true);
    expect(p.max).toBe(G.REST_MAX_XP);
    expect(p.perfect.earned).toBe(G.PERFECT_BONUS);
  });
});
