// Books: the shelf, what a finished book pays, the book medals. Run with `bun test` (TZ=Africa/Cairo, as CI does).
import { describe, expect, test, beforeEach, setSystemTime, afterEach } from "bun:test";
import * as G from "../src/lib/logic.js";
import * as B from "../src/lib/books.js";
import * as W from "../src/lib/week.js";

const NECTAR = { id: "nectar", title: "The Sealed Nectar", pages: 420, start: 100, added: "2026-11-01" };
const HABITS = { id: "habits", title: "Atomic Habits", pages: 320, start: 0, added: "2026-11-03" };
const TOME = { id: "tome", title: "Ihya", pages: 620, start: 600, added: "2026-11-02" };
function fresh(days = {}, settings = {}) {
  G.setTimeZone(null);
  G.S.settings = { ...G.DEFAULTS, training: [], trainingOnce: [], whoopFrom: "2026-11-01", books: [NECTAR, HABITS, TOME], ...settings };
  G.S.days = structuredClone(days);
}
beforeEach(() => { fresh(); setSystemTime(new Date(2026, 10, 8, 12)); }); // Sunday 8 November
afterEach(() => setSystemTime());

describe("what a finished book pays", () => {
  test("a finished book pays BOOK_XP on its day, as extra past the ring", () => {
    fresh({ "2026-11-04": { pages: 20, pagesBy: { nectar: 20 } } });
    const before = G.dayXP("2026-11-04");
    G.S.days["2026-11-04"].finished = ["nectar"];
    expect(G.dayXP("2026-11-04")).toBe(before + G.BOOK_XP);
    const p = G.xpParts("2026-11-04");
    expect(p.book).toEqual({ earned: G.BOOK_XP, n: 1, extra: true });
    expect(p.extra).toBe(G.BOOK_XP);
    expect(p.earned).toBe(before); // the ring is what it was; the book goes past it
    expect(G.totals().xp).toBe(before + G.BOOK_XP);
  });
  test("two books on one day pay twice", () => {
    fresh({ "2026-11-04": { pages: 20, finished: ["nectar", "habits"] } });
    expect(G.xpParts("2026-11-04").book.earned).toBe(2 * G.BOOK_XP);
  });
  test("finishing a book makes the day logged, and pays on it", () => {
    fresh({ "2026-11-04": { finished: ["habits"] } });
    expect(G.manual(G.S.days["2026-11-04"])).toBe(true);
    expect(G.totals().logged).toBe(1);
    expect(G.dayXP("2026-11-04")).toBeGreaterThanOrEqual(G.BOOK_XP);
  });
  test("a book finished before the term pays nothing and wins no medal", () => {
    fresh({ "2026-10-30": { pages: 30, finished: ["nectar"] } });
    expect(G.totals().books).toBe(0);
    expect(G.medals().find((m) => m.id === "book1").won).toBe(false);
  });
  test("on the rest day a book adds to the rest-day extras", () => {
    fresh({ "2026-11-08": { pages: 20, finished: ["habits"], hair: true } }); // Sunday, the default rest day
    const p = G.xpParts("2026-11-08");
    expect(p.rest).toBe(true);
    expect(p.extra).toBe(p.ministers.habits.earned + p.ministers.body.earned + p.checklist.earned + p.vitality.earned + (p.weighIn?.earned || 0) + G.BOOK_XP);
  });
  test("the ring's target is unchanged on a book day", () => {
    fresh({ "2026-11-04": { pages: 20, finished: ["habits"] } });
    expect(G.xpParts("2026-11-04").max).toBe(G.MAX_DAY_XP);
  });
});

describe("the book medals", () => {
  const won = (id) => G.medals().find((m) => m.id === id);
  test("one finished book wins First book; the count medals show how far", () => {
    fresh({ "2026-11-04": { finished: ["habits"] } });
    expect(won("book1").won).toBe(true);
    expect(won("book5")).toMatchObject({ won: false, cur: 1, goal: 5 });
    expect(won("book5").frac).toBeCloseTo(0.2, 5);
  });
  test("five books win Friend of books", () => {
    const books = Array.from({ length: 5 }, (_, i) => ({ id: "b" + i, title: "Book " + i, pages: 100 }));
    fresh({ "2026-11-02": { finished: ["b0", "b1"] }, "2026-11-05": { finished: ["b2"] }, "2026-11-07": { finished: ["b3", "b4"] } }, { books });
    expect(G.totals().books).toBe(5);
    expect(won("book5").won).toBe(true);
    expect(won("book12").won).toBe(false);
  });
  test("the tome needs one finished book of 500 pages or more", () => {
    fresh({ "2026-11-04": { finished: ["habits"] } });
    expect(won("bookTome")).toMatchObject({ won: false, cur: 320, goal: G.TOME_PAGES });
    G.S.days["2026-11-06"] = { finished: ["tome"] };
    expect(won("bookTome").won).toBe(true);
  });
  test("a finished book that's no longer on the shelf still counts, without its pages", () => {
    fresh({ "2026-11-04": { finished: ["gone"] } });
    expect(won("book1").won).toBe(true);
    expect(won("bookTome").cur).toBe(0);
  });
  test("they're Knowledge's medals, and there are six", () => {
    expect(G.MEDALS.filter((m) => m.id.startsWith("book")).map((m) => m.id)).toEqual(["book1", "book5", "book12", "book25", "book50", "bookTome"]);
  });
});

describe("the shelf", () => {
  test("where you are: the start page plus every day's pages of the book", () => {
    fresh({ "2026-11-02": { pages: 25, pagesBy: { nectar: 20, habits: 5 } }, "2026-11-05": { pages: 30, pagesBy: { nectar: 30 } } });
    const s = Object.fromEntries(B.shelf().map((b) => [b.id, b]));
    expect(s.nectar).toMatchObject({ at: 150, logged: 50, pages: 420, done: null, last: "2026-11-05", end: false });
    expect(s.nectar.frac).toBeCloseTo(150 / 420, 5);
    expect(s.habits).toMatchObject({ at: 5, last: "2026-11-02" });
    expect(s.tome).toMatchObject({ at: 600, last: null, pace: 0, left: null });
  });
  test("pace is the last two weeks' pages a day, counted from the day the book was added if that's later", () => {
    fresh({ "2026-11-04": { pagesBy: { habits: 30 } }, "2026-11-07": { pagesBy: { habits: 30 } } });
    const h = B.shelf().find((b) => b.id === "habits"); // added on the 3rd: 6 days to the 8th
    expect(h.pace).toBeCloseTo(60 / 6, 5);
    expect(h.left).toBe(Math.ceil((320 - 60) / 10));
  });
  test("reaching the last page marks the end, not the finish", () => {
    fresh({ "2026-11-06": { pagesBy: { tome: 20 } } });
    const t = B.shelf().find((b) => b.id === "tome");
    expect(t).toMatchObject({ at: 620, end: true, done: null, frac: 1 });
  });
  test("finished books leave the reading list, newest first", () => {
    fresh({ "2026-11-03": { finished: ["habits"] }, "2026-11-06": { finished: ["tome"] }, "2026-10-30": { finished: ["nectar"] } });
    expect(B.reading().map((b) => b.id)).toEqual([]);
    expect(B.finished().map((b) => [b.id, b.done])).toEqual([["tome", "2026-11-06"], ["habits", "2026-11-03"], ["nectar", "2026-10-30"]]);
    expect(B.finishedInOffice().map((b) => b.id)).toEqual(["tome", "habits"]);
  });
  test("the current book: the one picked, else the one read last, else the newest", () => {
    fresh({});
    expect(B.currentBook().id).toBe("habits"); // added last
    G.S.days["2026-11-05"] = { pagesBy: { nectar: 10 } };
    expect(B.currentBook().id).toBe("nectar"); // read last
    G.S.settings.bookNow = "tome";
    expect(B.currentBook().id).toBe("tome"); // picked
    G.S.days["2026-11-06"] = { finished: ["tome"] };
    expect(B.currentBook().id).toBe("nectar"); // the pick was finished
    fresh({}, { books: [] });
    expect(B.currentBook()).toBeNull();
  });
});

describe("the weekly report", () => {
  test("a finished book is named in the week it was finished", () => {
    fresh({ "2026-11-02": { pages: 20 }, "2026-11-06": { pages: 20, finished: ["habits"] } });
    const f = W.weekReport("2026-11-01").findings.find((x) => x.key === "books");
    expect(f.title).toBe("A book finished");
    expect(f.text).toBe("You finished “Atomic Habits” (320 pages) on Friday.");
  });
  test("no book, no line", () => {
    fresh({ "2026-11-02": { pages: 20 } });
    expect(W.weekReport("2026-11-01").findings.find((x) => x.key === "books")).toBeUndefined();
  });
});
