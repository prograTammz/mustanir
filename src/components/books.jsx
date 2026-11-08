// The bookshelf, in a bottom sheet (opened from the reading quest on Today): the books you're reading with how far you
// are in each, adding one or correcting where you are, finishing one (+BOOK_XP), and the ones you've finished.
// Pages are counted on Today; this sheet only sets up the books. The numbers come from src/lib/books.js.
import { useState } from "react";
import { S, today, fmt, BOOK_XP } from "@/lib/logic.js";
import { shelf, reading, finished } from "@/lib/books.js";
import { useApp, allMedals, allTotals, finishBook, unfinishBook, saveBooks } from "@/lib/app-state.js";
import { DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ar, Emblem, Hint, Fold, mColor, fmtN } from "./kit";
import { Icon, Button, Progress } from "@/components/m3/index.jsx";
import { cn } from "@/lib/utils";

const short = (s) => fmt(s, { day: "numeric", month: "short" });

export function BooksSheet({ add = false }) {
  useApp();
  const books = shelf(), now = reading(books), done = finished(books), [edit, setEdit] = useState(add ? "new" : null); // a book's id, "new", or null
  const s = S.selected, past = s !== today();
  const next = allMedals().find((m) => /^book\d/.test(m.id) && !m.won), n = allTotals().books;
  return (
    <>
      <DrawerHeader className="flex-row items-center gap-4">
        <Emblem k="knowledge" size={56} />
        <div className="min-w-0">
          <Ar className="block text-left text-[22px] leading-tight" style={{ color: mColor("knowledge") }}>المكتبة</Ar>
          <DrawerTitle>Bookshelf</DrawerTitle>
          <DrawerDescription>{now.length ? `${now.length} reading` : "Nothing on the go"}{n ? ` · ${n} finished` : ""} · a finished book pays +{BOOK_XP} XP</DrawerDescription>
        </div>
      </DrawerHeader>

      {past && now.length > 0 && <Hint className="-mt-2 mb-3">A book finished here counts on {fmt(s, { weekday: "long", day: "numeric", month: "long" })}, the day you’re looking at.</Hint>}
      <div className="flex flex-col gap-2">
        {now.map((b) => (edit === b.id ? <BookForm key={b.id} book={b} onDone={() => setEdit(null)} /> : <BookRow key={b.id} b={b} onEdit={() => setEdit(b.id)} />))}
        {edit === "new" ? <BookForm onDone={() => setEdit(null)} />
          : <Button variant={now.length ? "tonal" : "filled"} icon="add" className="w-full" onClick={() => setEdit("new")}>{now.length ? "Add another book" : "Add the book you’re reading"}</Button>}
      </div>
      {!now.length && edit !== "new" && <Hint className="mt-3">Add each book you’re reading with its page count. On Today, the page buttons then count toward it, and you can see how far you are in each.</Hint>}

      {next && (
        <div className="mt-4 flex items-center gap-2 type-body-m text-on-surface-variant tnum">
          <Icon name="military_tech" size={18} className="shrink-0" style={{ color: mColor("knowledge") }} />
          <span className="min-w-0 flex-1 truncate">Next medal: {next.en}</span><span className="shrink-0">{fmtN(next.cur)} / {fmtN(next.goal)} books</span>
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-2 border-t">
          <Fold title="Finished" summary={`${done.length} book${done.length === 1 ? "" : "s"}`} leading={<Icon name="task_alt" size={20} className="text-on-surface-variant" />}>
            {done.map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="type-title-s truncate">{b.title}</div>
                  <div className="type-body-s text-on-surface-variant tnum">{b.pages ? `${b.pages.toLocaleString("en")} pages · ` : ""}finished {short(b.done)}</div>
                </div>
                <Button variant="text" size="xs" icon="undo" onClick={() => unfinishBook(b.id)} aria-label={`${b.title} isn’t finished: put it back on the shelf`}>Not yet</Button>
              </div>
            ))}
          </Fold>
        </div>
      )}
      <div className="h-6" />
    </>
  );
}

// One book you're reading: where you are, the bar, your pace, and Finished. Tap the title to correct it.
function BookRow({ b, onEdit }) {
  const pct = Math.floor(b.frac * 100); // 379 of 380 is 99%, not done
  const pace = b.end ? "Last page reached" : b.left ? `${fmtN(b.pace)} pages a day · about ${b.left} day${b.left === 1 ? "" : "s"} to go`
    : b.logged ? "Not read in the last two weeks" : "Your pace shows once you count pages on Today";
  return (
    <div className={cn("rounded-[24px] p-4 transition-colors", b.end ? "bg-tertiary-container text-on-tertiary-container" : "bg-surface-container-high")}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={onEdit} aria-label={`Edit ${b.title}`} className="state -m-1 min-w-0 flex-1 rounded-xl p-1 text-left">
          <div className="type-title-m em truncate">{b.title}</div>
          <div className="type-body-s tnum opacity-80">Page {b.at.toLocaleString("en")}{b.pages ? ` of ${b.pages.toLocaleString("en")} · ${pct}%` : ""}</div>
        </button>
        <Button variant={b.end ? "filled" : "outlined"} size="xs" icon="check" onClick={() => finishBook(b.id)}>Finished</Button>
      </div>
      {b.pages > 0 && <Progress value={b.frac} color={mColor("knowledge")} stop={false} className="mt-3" label={`${b.title}: ${pct}% read`} />}
      <div className="mt-2 type-body-s tnum opacity-80">{pace}</div>
    </div>
  );
}

// Adding a book, or correcting one: its title, its length, and the page you're on. Correcting the page moves where the
// book started, never a day's pages, so it changes no XP.
function BookForm({ book, onDone }) {
  const [title, setTitle] = useState(book?.title || ""), [pages, setPages] = useState(book?.pages ? String(book.pages) : ""), [at, setAt] = useState(book ? String(book.at) : "");
  const [err, setErr] = useState(""), [sure, setSure] = useState(false);
  const id = book?.id || "new", list = S.settings.books || [];
  const save = () => {
    const t = title.trim(), n = parseInt(pages, 10), p = Math.max(0, parseInt(at, 10) || 0);
    if (!t) return setErr("Give it a title.");
    if (!(n > 0)) return setErr("How many pages does it have?");
    if (p > n) return setErr(`Page ${p} is past the end of a ${n}-page book.`);
    if (book) saveBooks(list.map((x) => (x.id === book.id ? { ...x, title: t, pages: n, start: p - book.logged } : x)));
    else { const nid = "b" + Date.now().toString(36); saveBooks([...list, { id: nid, title: t, pages: n, start: p, added: today() }], nid); }
    onDone();
  };
  const remove = () => {
    if (!sure) return setSure(true);
    saveBooks(list.filter((x) => x.id !== book.id), S.settings.bookNow === book.id ? null : undefined);
    onDone();
  };
  const field = "grid min-w-0 gap-1.5";
  return (
    <form className="flex flex-col gap-3 rounded-[24px] bg-surface-container-high p-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className={field}><Label htmlFor={`bk-t-${id}`}>Title</Label>
        <Input id={`bk-t-${id}`} autoFocus={!book} value={title} placeholder="The book’s title" enterKeyHint="next" onChange={(e) => { setErr(""); setTitle(e.target.value); }} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className={field}><Label htmlFor={`bk-n-${id}`}>Pages in it</Label>
          <Input id={`bk-n-${id}`} type="number" inputMode="numeric" min="1" value={pages} placeholder="320" onChange={(e) => { setErr(""); setPages(e.target.value); }} /></div>
        <div className={field}><Label htmlFor={`bk-p-${id}`}>Page you’re on</Label>
          <Input id={`bk-p-${id}`} type="number" inputMode="numeric" min="0" value={at} placeholder="0" onChange={(e) => { setErr(""); setAt(e.target.value); }} /></div>
      </div>
      {book && <Hint className="type-body-s">Changing the page corrects where you are; count today’s pages on Today.</Hint>}
      {err && <p className="type-body-m text-error" role="alert">{err}</p>}
      <div className="flex items-center gap-2">
        {book && <Button variant="text" size="xs" className={cn("-ml-2", sure && "text-error")} onClick={remove}>{sure ? "Tap again to remove" : "Remove"}</Button>}
        <Button variant="text" size="xs" className="ml-auto" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="xs">{book ? "Save" : "Add to shelf"}</Button>
      </div>
    </form>
  );
}
