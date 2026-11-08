// The bookshelf as the screen shows it: each book with where you are in it, read off the days. Pure like week.js: it
// reads the engine's state and never writes. The rules (what a finished book pays, the book medals) are in logic.js.
import { S, today, addDays, diff, inOffice } from "./logic.js";

const PACE_DAYS = 14; // pace: the pages a day of a book over the last two weeks (or since it was added, if later)

/** Every book on the shelf: `at` (the page you're on: where you started plus every day's pages of it), `frac` of the
 *  book, `done` (the day it was finished, or null), `last` (the last day you read it), `pace` and `left` (days to go at it). */
export function shelf() {
  const read = {}, recent = {}, done = {}, last = {}, t = today(), from = addDays(t, -(PACE_DAYS - 1));
  for (const k of Object.keys(S.days).sort()) {
    const d = S.days[k];
    for (const [id, n] of Object.entries(d.pagesBy || {})) {
      const v = +n || 0;
      read[id] = (read[id] || 0) + v;
      if (v > 0) last[id] = k;
      if (k >= from && k <= t) recent[id] = (recent[id] || 0) + v;
    }
    for (const id of d.finished || []) done[id] = k;
  }
  return (S.settings.books || []).map((b) => {
    const pages = Math.max(0, +b.pages || 0), at = Math.max(0, (+b.start || 0) + (read[b.id] || 0));
    const since = b.added && b.added > from ? b.added : from, span = Math.max(1, diff(since, t) + 1);
    const pace = (recent[b.id] || 0) / span, togo = Math.max(0, pages - at);
    return {
      ...b, pages, at, logged: read[b.id] || 0, frac: pages ? Math.min(1, at / pages) : 0, end: pages > 0 && at >= pages,
      done: done[b.id] || null, last: last[b.id] || null, pace, left: pace > 0 && togo > 0 ? Math.ceil(togo / pace) : null,
    };
  });
}

export const reading = (books = shelf()) => books.filter((b) => !b.done);
// Finished, newest first.
export const finished = (books = shelf()) => books.filter((b) => b.done).sort((a, b) => b.done.localeCompare(a.done));
// Finished in office: the ones the medals count.
export const finishedInOffice = (books = shelf()) => finished(books).filter((b) => inOffice(b.done));

/** The book the page buttons count toward: the one you picked, else the one you read last, else the newest on the shelf. */
export function currentBook(list = reading()) {
  return list.find((b) => b.id === S.settings.bookNow)
    || [...list].sort((a, b) => (b.last || b.added || "").localeCompare(a.last || a.added || ""))[0]
    || null;
}
