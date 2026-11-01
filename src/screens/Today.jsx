// Today: the game board. Your player card, the cabinet's score, today's decrees (each one shows what it pays),
// the medals within reach, then what WHOOP and FatSecret measured for you (read-only).
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Plus, X, Dumbbell, WifiOff, Crown, Sparkles, Trophy } from "lucide-react";
import { S, PRAYERS, MINISTERS, today, addDays, fmt, hijri, termDay, termInfo, dayXP, MAX_DAY_XP, totals, rankFor, RANKS, streak, T, matchDay, hasSchedule,
  slotName, ABSTAIN_XP, checklistFor, vitalityFor, fajrTime, isSunday, weighIn, WEIGH_IN_XP, awayRun, FLOOR, medals, xpParts, PERFECT_BONUS } from "@/lib/logic.js";
import { SESSION, loadMeals, saveDay } from "@/lib/store.js";
import { useApp, set, rec, bump, go } from "@/lib/app-state.js";
import { openSheet } from "@/components/sheets.jsx";
import { Ar, Ring, Stepper, Chip, Hint, Fold, Tile, Bar, Tick, fmtMin } from "@/components/kit";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function Today() {
  useApp();
  const s = S.selected, r = rec(), isToday = s === today(), xp = xpParts(s);
  return (
    <>
      <DayHeader s={s} isToday={isToday} />
      {S.mode === "error" && <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-[13px] text-muted-foreground"><WifiOff className="size-4" />Offline. Keep checking in; it syncs when you’re back.</div>}
      <PlayerCard s={s} />
      <Cabinet xp={xp} />
      <Decrees s={s} r={r} xp={xp} />
      <WithinReach />
      <Measured s={s} r={r} xp={xp} />
      <Reflect s={s} r={r} />
      <Away s={s} r={r} />
    </>
  );
}

function DayHeader({ s, isToday }) {
  const dn = termDay(s), term = termInfo(s);
  const move = (n) => { const nx = addDays(s, n); if (nx <= today()) { S.selected = nx; bump(); } };
  return (
    <div className="flex items-end justify-between gap-3 px-1 pt-2 pb-1">
      <div className="min-w-0">
        <Ar className="block text-left text-[13px] leading-tight text-gold"><bdi>{hijri(s)}</bdi></Ar>
        <h1 className="text-[30px] leading-tight font-bold tracking-tight">{isToday ? "Today" : fmt(s, { weekday: "long" })}</h1>
        <p className="truncate text-[13px] text-muted-foreground">{fmt(s, { weekday: isToday ? "long" : undefined, day: "numeric", month: "long" })}{dn >= 1 ? ` · day ${dn} of term ${term.n}` : ""}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 pb-1">
        <button aria-label="Previous day" onClick={() => move(-1)} className="press grid size-9 place-items-center rounded-full bg-muted"><ChevronLeft className="size-[18px]" /></button>
        <button aria-label="Next day" disabled={isToday} onClick={() => move(1)} className="press grid size-9 place-items-center rounded-full bg-muted disabled:opacity-30"><ChevronRight className="size-[18px]" /></button>
      </div>
    </div>
  );
}

/* ---------- the player card ---------- */
export const SEAL = "M12 2l2.4 4.2 4.7-1-1 4.7L22 12l-4.2 2.4 1 4.7-4.7-1L12 22l-2.4-4.2-4.7 1 1-4.7L2 12l4.2-2.4-1-4.7 4.7 1z";
export function Seal({ level, size = 60, dim = false }) {
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" className={cn("absolute inset-0 size-full", dim ? "fill-muted-foreground/25" : "fill-[#D6AF5F] drop-shadow-[0_4px_14px_rgb(214_175_95/0.45)]")}><path d={SEAL} /></svg>
      <span className={cn("relative font-bold tnum", dim ? "text-muted-foreground" : "text-[#0F3A30]")} style={{ fontSize: size * 0.32 }}>{level}</span>
    </div>
  );
}
function PlayerCard({ s }) {
  const xp = dayXP(s), t = totals(), rank = rankFor(t.level), next = RANKS.find((x) => x.from > t.level), run = streak(T.office);
  const won = medals().filter((m) => m.won).length;
  return (
    <button onClick={() => go("palace")} className="press relative overflow-hidden rounded-[24px] bg-[linear-gradient(140deg,#13584A_0%,#0F4A3C_45%,#0A3329_100%)] p-4 text-left text-white shadow-[0_12px_30px_-14px_rgb(15_74_60/0.7)]">
      <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-44 fill-white/[0.05]"><path d={SEAL} /></svg>
      <div className="relative flex items-center gap-3.5">
        <Seal level={t.level} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2"><Ar className="text-[22px] leading-tight text-[#E6C77E]">{rank.ar}</Ar><span className="truncate text-[13px] text-white/70">{rank.en} · Level {t.level}</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[linear-gradient(90deg,#C99A3E,#EBD08E)] transition-[width] duration-700" style={{ width: `${t.frac * 100}%` }} /></div>
          <div className="mt-1.5 flex justify-between gap-2 text-[11.5px] text-white/65 tnum"><span>{t.xp.toLocaleString("en")} XP</span><span className="truncate">{(t.to - t.xp).toLocaleString("en")} to level {t.level + 1}{next && next.from === t.level + 1 ? ` · ${next.en}` : ""}</span></div>
        </div>
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white/[0.08] px-3 py-2.5">
          <div className="flex items-center gap-1 text-[20px] font-bold tnum"><Flame className={cn("size-5", run ? "fill-[#F0A23B] text-[#F0A23B]" : "text-white/50")} />{run}</div>
          <div className="text-[11px] text-white/65">day streak</div>
        </div>
        <div className="rounded-2xl bg-white/[0.08] px-3 py-2.5">
          <div className="text-[20px] font-bold tnum">{xp}<span className="text-[12px] font-medium text-white/55">/{MAX_DAY_XP + (isSunday(s) ? WEIGH_IN_XP : 0)}</span></div>
          <div className="text-[11px] text-white/65">XP today</div>
        </div>
        <div className="rounded-2xl bg-white/[0.08] px-3 py-2.5">
          <div className="flex items-center gap-1 text-[20px] font-bold tnum"><Crown className="size-[18px] text-[#E6C77E]" />{won}</div>
          <div className="text-[11px] text-white/65">medals</div>
        </div>
      </div>
    </button>
  );
}

/* ---------- the cabinet today: five ministers, each worth 20 XP ---------- */
function Cabinet({ xp }) {
  const all = xp.perfect.earned > 0;
  return (
    <Card className="gap-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold tracking-tight">The cabinet today</h2>
        <span className="text-[13px] text-muted-foreground tnum">{Object.values(xp.ministers).reduce((a, m) => a + m.earned, 0)} of 100 XP</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {MINISTERS.map((m) => {
          const x = xp.ministers[m.key];
          return (
            <button key={m.key} onClick={() => openSheet({ type: "minister", key: m.key })} className="press flex flex-col items-center gap-1.5 rounded-2xl py-1">
              <Ring value={x.frac} color={`var(--m-${m.key})`} size={52} stroke={5} label={m.en}><span className="text-[13px] font-bold tnum">{x.earned}</span></Ring>
              <span className="text-[11px] leading-tight text-muted-foreground">{m.en.replace("Minister of ", "")}</span>
            </button>
          );
        })}
      </div>
      <div className={cn("flex items-center gap-2.5 rounded-2xl px-3 py-2.5", all ? "bg-gold-soft" : "bg-muted")}>
        <Sparkles className={cn("size-4 shrink-0", all ? "text-gold" : "text-muted-foreground")} />
        <span className="min-w-0 flex-1 text-[13px]">{all ? "Perfect day sealed" : `Perfect day: ${xp.near} of 5 ministers at 90%`}</span>
        <span className={cn("shrink-0 text-[13px] font-semibold tnum", all ? "text-gold" : "text-muted-foreground")}>+{PERFECT_BONUS} XP</span>
      </div>
    </Card>
  );
}

/* ---------- today's decrees: what you log by hand, each with its pay ---------- */
const ROUTINES = [["hair", "Hair"], ["skinAm", "Skin"], ["teethAm", "Teeth"], ["skinPm", "Skin"], ["teethPm", "Teeth"]];
function Pay({ earned, max, plus }) {
  const full = earned >= max;
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold tnum", full ? "bg-gold-soft text-gold" : "bg-muted text-muted-foreground")}>{plus ?? `${earned}/${max} XP`}</span>;
}
function Quest({ title, color, pay, children, className }) {
  return (
    <div className={cn("border-t py-3 first:border-t-0", className)}>
      <div className="mb-2.5 flex items-center gap-2">
        {color && <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />}
        <span className="min-w-0 flex-1 text-[15px] font-medium">{title}</span>
        {pay}
      </div>
      {children}
    </div>
  );
}
function Decrees({ s, r, xp }) {
  const pr = r.prayers || {}, c = checklistFor(s), mx = xp.ministers;
  const done = PRAYERS.filter(([k]) => pr[k]).length + (r.pages >= S.settings.pagesPerDay ? 1 : 0) + ROUTINES.filter(([k]) => r[k]).length + c.done;
  const total = 5 + 1 + ROUTINES.length + c.total;
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <h2 className="text-[17px] font-semibold tracking-tight">Today’s decrees</h2>
        <span className="text-[13px] text-muted-foreground tnum">{done} of {total} done</span>
      </div>
      <CardContent className="flex flex-col pb-1">
        <Quest title="Prayers" color="var(--m-faith)" pay={<Pay {...mx.faith} />}><Prayers pr={pr} /></Quest>
        <Quest title={"Reading" + (S.settings.book ? ` · ${S.settings.book}` : "")} color="var(--m-knowledge)" pay={<Pay {...mx.knowledge} />}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted-foreground tnum">{r.pages || 0} of {S.settings.pagesPerDay} pages</span>
            <Stepper label="pages" value={r.pages} step={5} onChange={(v) => set("pages", v)} />
          </div>
        </Quest>
        <Quest title="Routines" color="var(--m-habits)" pay={<Pay {...mx.habits} />}>
          {[["Morning", ROUTINES.slice(0, 3)], ["Night", ROUTINES.slice(3)]].map(([label, items]) => (
            <div key={label} className="flex items-center gap-3 py-1">
              <span className="w-16 shrink-0 text-[13px] text-muted-foreground">{label}</span>
              <div className="flex flex-1 flex-wrap gap-2">{items.map(([k, l]) => <Chip key={k} size="sm" on={!!r[k]} onClick={() => set(k, !r[k])}>{l}</Chip>)}</div>
            </div>
          ))}
          <Hint className="mt-1.5">Sleep, Fajr and WHOOP worn count here too, filled in for you.</Hint>
        </Quest>
        <Tasks r={r} c={c} pay={xp.checklist} />
        <Purity s={s} r={r} xp={xp} />
      </CardContent>
    </Card>
  );
}

function Prayers({ pr }) {
  // One tap: on time (+4). Two: made up, qada (+2). Three: clear.
  const cyc = (k) => { const cur = pr[k], nx = cur == null ? "on" : cur === "on" ? "late" : null, p = { ...pr }; if (nx) p[k] = nx; else delete p[k]; set("prayers", p); };
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {PRAYERS.map(([k, l, a]) => {
        const st = pr[k];
        return (
          <button key={k} aria-pressed={!!st} aria-label={`${l}: ${st === "on" ? "on time" : st === "late" ? "made up" : "not yet"}`} onClick={() => cyc(k)}
            className={cn("press flex flex-col items-center gap-0.5 rounded-2xl py-2.5", st === "on" ? "bg-faith text-white" : st === "late" ? "bg-warn/15 text-warn" : "bg-muted")}>
            <Ar className="text-[15px] leading-tight">{a}</Ar>
            <span className={cn("text-[10.5px] font-medium", !st && "text-muted-foreground")}>{st === "late" ? "Qada" : l}</span>
            <span className={cn("text-[10px] font-semibold tnum", st ? "opacity-80" : "text-gold")}>{st === "late" ? "+2" : "+4"}</span>
          </button>
        );
      })}
    </div>
  );
}

function Tasks({ r, c, pay }) {
  const [txt, setTxt] = useState("");
  const toggle = (id) => set("checks", { ...(r.checks || {}), [id]: !(r.checks || {})[id] });
  const add = () => { const t = txt.trim(); if (!t) return; set("extraTasks", [...(r.extraTasks || []), { id: "x" + Date.now().toString(36), text: t }]); setTxt(""); };
  const extra = (id) => (r.extraTasks || []).some((t) => t.id === id);
  return (
    <Quest title="Tasks" color="var(--gold)" pay={<Pay {...pay} />}>
      {c.items.map((x) => (
        <div key={x.id} className="flex items-center gap-3 py-1.5">
          <Tick on={!!c.checks[x.id]} onClick={() => toggle(x.id)} label={x.text} />
          <span className={cn("min-w-0 flex-1 text-[15px] leading-snug", c.checks[x.id] && "text-muted-foreground line-through")}>{x.text}</span>
          {extra(x.id) && <button aria-label="Remove task" className="press grid size-7 place-items-center rounded-full text-muted-foreground" onClick={() => set("extraTasks", r.extraTasks.filter((t) => t.id !== x.id))}><X className="size-4" /></button>}
        </div>
      ))}
      <div className="flex items-center gap-3 pt-1">
        <span className="grid size-6 shrink-0 place-items-center text-muted-foreground"><Plus className="size-4" /></span>
        <Input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} onBlur={add}
          placeholder="Add a task for today" className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent" />
      </div>
    </Quest>
  );
}

// Purity runs the other way: every day starts clean with full marks; only a logged slip takes them away.
function Purity({ s, r, xp }) {
  const slipped = r.pornFree === false || r.mast === true;
  const [open, setOpen] = useState(false);
  const toggle = (k, v) => set(k, r[k] === v ? null : v);
  const total = xp.ministers.purity.earned + xp.abstain.earned;
  return (
    <Quest title="Purity" color="var(--m-purity)" pay={<Pay earned={total} max={20 + ABSTAIN_XP} plus={slipped ? "0 XP" : undefined} />}>
      <div className="flex items-center gap-3">
        <span className={cn("min-w-0 flex-1 text-[13px]", slipped ? "text-bad" : "text-muted-foreground")}>{slipped ? "Slip logged · today’s points lost. A slip is data, not defeat." : `Clean · ${streak(T.abstain)}-day streak. Full marks unless you log a slip.`}</span>
        {!slipped && <button className="press h-8 shrink-0 rounded-full bg-muted px-3 text-[13px] text-muted-foreground" onClick={() => setOpen(!open)}>{open ? "Close" : "Log a slip"}</button>}
      </div>
      {(open || slipped) && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Chip size="sm" tone="bad" on={r.pornFree === false} onClick={() => toggle("pornFree", false)}>Porn</Chip>
          <Chip size="sm" tone="bad" on={r.mast === true} onClick={() => toggle("mast", true)}>Masturbation</Chip>
        </div>
      )}
      {slipped && <Input className="mt-2.5" key={"n" + s} defaultValue={r.note || ""} placeholder="What triggered it?" onBlur={(e) => set("note", e.target.value.trim())} />}
    </Quest>
  );
}

/* ---------- medals within reach ---------- */
export const fmtN = (x) => (x == null ? "—" : x >= 1000 ? Math.round(x).toLocaleString("en") : Math.round(x * 10) / 10);
function WithinReach() {
  const near = medals().filter((m) => !m.won && m.frac > 0).sort((a, b) => b.frac - a.frac).slice(0, 3);
  if (!near.length) return null;
  return (
    <Card className="gap-1 px-4 py-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold tracking-tight">Within reach</h2>
        <button onClick={() => go("palace")} className="press text-[13px] text-muted-foreground">All medals</button>
      </div>
      {near.map((m) => (
        <div key={m.id} className="flex items-center gap-3 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-soft"><Trophy className="size-[18px] text-gold" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[14px] font-medium">{m.en}</span>
              <span className="shrink-0 text-[12px] text-muted-foreground tnum">{m.down ? `${fmtN(m.cur)} → ${m.goal} kg` : `${fmtN(m.cur)} / ${fmtN(m.goal)}`}</span>
            </div>
            <Bar className="mt-1.5" value={m.frac} color="var(--gold)" />
            <div className="mt-1 truncate text-[11.5px] text-muted-foreground">{m.how}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ---------- vitality: what WHOOP and FatSecret fill in ---------- */
const mealsLoading = new Set();
function Measured({ s, r, xp }) {
  useEffect(() => {
    if (SESSION && !(S.meals || {})[s] && !mealsLoading.has(s)) { mealsLoading.add(s); loadMeals(s).then(() => { mealsLoading.delete(s); bump(); }).catch(() => mealsLoading.delete(s)); }
  }, [s]);
  const v = vitalityFor(s), g = Object.fromEntries(v.items.map((x) => [x.k, x]));
  const u = (x) => (x.unit && x.unit !== "%" ? " " + x.unit : x.unit);
  const tile = (k, label, val) => { const x = g[k]; return x ? <Tile label={label} value={x.val == null ? "—" : val ?? x.fmt(x.val) + u(x)} sub={`goal ${x.goal.toLocaleString("en")}${u(x)}`} hit={x.val == null ? null : x.hit} /> : null; };
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-[17px] font-semibold tracking-tight">Vitality</h2>
        <Pay {...xp.vitality} />
      </div>
      <CardContent className="flex flex-col pb-2">
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Up for Fajr" value={r.wake == null ? "—" : r.wake ? "Yes" : "No"} sub={`Fajr ${fajrTime(s)}`} hit={r.wake == null ? null : r.wake} />
          {tile("sleepH", "Sleep", r.sleepH != null ? `${(Math.round(r.sleepH * 10) / 10).toFixed(1)} h` : undefined)}
          {tile("sleepCons", "Consistency")}
          {tile("steps", "Steps")}
          {tile("exerciseMin", "Exercise")}
          {tile("strain", "Strain")}
        </div>
        <Hint className="mt-2">{v.seen ? `${v.hits} of ${v.total} vitals kept · measured by WHOOP` : "Waiting for WHOOP."}</Hint>
        <Food s={s} r={r} />
        <Sessions s={s} r={r} />
        <Weight s={s} r={r} xp={xp} />
      </CardContent>
    </Card>
  );
}

function Food({ s, r }) {
  const meals = (S.meals || {})[s] || [];
  const eaten = meals.length ? meals.reduce((a, m) => a + Number(m.kcal || 0), 0) : r.dietaryKcal || 0;
  const burned = r.totalKcal || 0, target = S.settings.deficitMin || 700;
  const deficit = burned && eaten ? burned - eaten : null, protein = meals.reduce((a, m) => a + (Number(m.protein) || 0), 0);
  const met = deficit != null && deficit >= target;
  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[15px] font-medium"><span className="size-2 rounded-full bg-body" />Deficit</span>
        <span className={cn("text-[15px] font-semibold tnum", met && "text-ok")}>{deficit == null ? "—" : Math.round(deficit).toLocaleString("en")}<span className="font-normal text-muted-foreground"> / {target} kcal</span></span>
      </div>
      <Bar className="mt-2" value={deficit == null ? 0 : deficit / target} color={met ? "var(--ok)" : "var(--m-body)"} />
      <div className="mt-1.5 text-xs text-muted-foreground tnum">
        {burned || eaten ? `Burned ${Math.round(burned).toLocaleString("en")} · ate ${Math.round(eaten).toLocaleString("en")}${protein ? ` · ${Math.round(protein)} g protein` : ""}${s === today() ? " so far" : ""}` : "Log meals in FatSecret; they arrive within 10 minutes."}
      </div>
      {meals.length > 0 && (
        <Fold className="mt-1" title="Meals" summary={`${meals.length} logged`}>
          {meals.map((m) => (
            <div key={m.id} className="flex items-baseline gap-3 border-t py-2 text-[14px]">
              <span className="min-w-0 flex-1 truncate">{m.name || "Meal"}</span>
              <span className="shrink-0 text-muted-foreground tnum">{Math.round(m.kcal)} kcal{m.protein ? ` · ${Math.round(m.protein)} g` : ""}</span>
            </div>
          ))}
        </Fold>
      )}
    </div>
  );
}

function Sessions({ s, r }) {
  const ms = matchDay(s);
  const dot = { done: "bg-ok", partial: "bg-warn", live: "bg-warn animate-pulse", missed: "bg-bad", upcoming: "bg-muted-foreground/40", skipped: "bg-muted-foreground/40" };
  const label = (m) => ({ done: `${fmtMin(m.done || m.planned)} done`, partial: `${fmtMin(m.done)} of ${fmtMin(m.planned)}`, live: `${fmtMin(m.done)} so far`, missed: "Missed", upcoming: "Upcoming", skipped: "Skipped" }[m.status]);
  const wks = r.workoutsDetail || []; // every workout WHOOP recorded, matched to a slot or not
  const summary = r.away ? "Paused today" : ms.length ? `${ms.filter((m) => m.status === "done").length} of ${ms.length} done` : hasSchedule() ? "Rest day" : "No schedule";
  return (
    <div className="mt-3 border-t pt-1">
      <Fold title="Training" summary={summary}>
        {ms.map((m) => (
          <div key={m.slot.id} className="flex items-center gap-3 border-t py-2.5">
            <span className={cn("size-2 shrink-0 rounded-full", dot[m.status])} />
            <span className="min-w-0 flex-1 text-[14px]">{slotName(m.slot)} <span className="text-muted-foreground">{m.slot.start}–{m.slot.end}</span></span>
            <span className="shrink-0 text-[13px] text-muted-foreground tnum">{label(m)}</span>
          </div>
        ))}
        {wks.map((w, i) => (
          <div key={i} className="flex items-center gap-3 border-t py-2.5">
            <Dumbbell className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-[14px]">{w.a} <span className="text-muted-foreground">{w.s}–{w.e}</span></span>
            <span className="shrink-0 text-[13px] text-muted-foreground tnum">{w.min} min{w.strain ? ` · ${w.strain}` : ""}</span>
          </div>
        ))}
        {!ms.length && !wks.length && <Hint className="border-t py-2.5">No workouts recorded{s === today() ? " yet" : ""}. WHOOP adds them here.</Hint>}
      </Fold>
    </div>
  );
}

function latestWeight(s, r) {
  if (r.weight != null) return +r.weight;
  for (let i = 1; i <= 30; i++) { const x = S.days[addDays(s, -i)]?.weight; if (x != null) return +x; }
  return null;
}
function Weight({ s, r, xp }) {
  const w = latestWeight(s, r), wi = isSunday(s) ? weighIn(s) : null;
  return (
    <div className="mt-1 border-t py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-medium">Weight</span>
        <span className="flex items-center gap-2"><span className="text-[15px] font-semibold tnum">{w == null ? "—" : `${w.toFixed(1)} kg`}</span>{xp.weighIn && <Pay {...xp.weighIn} />}</span>
      </div>
      {wi ? (
        <div className={cn("mt-2 rounded-xl px-3 py-2 text-[13px]", wi.won ? "bg-ok/10 text-ok" : "bg-muted text-muted-foreground")}>
          {wi.drop == null ? `Sunday weigh-in: lower than last Sunday pays +${WEIGH_IN_XP} XP. Needs a reading both weeks.` : wi.won ? `Sunday weigh-in: down ${wi.drop.toFixed(1)} kg on last week. +${WEIGH_IN_XP} XP` : `Sunday weigh-in: ${wi.drop === 0 ? "level with" : `up ${(-wi.drop).toFixed(1)} kg on`} last week. Next Sunday.`}
        </div>
      ) : <Hint className="mt-1">Every Sunday, a lower weight than last week pays +{WEIGH_IN_XP} XP.</Hint>}
    </div>
  );
}

/* ---------- the journal and the away switch ---------- */
function Reflect({ s, r }) {
  const filled = [r.good, r.fix].filter((x) => x && x.trim()).length;
  return (
    <Card className="py-1">
      <CardContent>
        <Fold title="Reflect" summary={filled ? `${filled} of 2 written` : "Two questions"}>
          <div className="flex flex-col gap-3 pt-1 pb-3">
            {[["good", "What went well today?", "Prayed Fajr on time, hit 30 pages"], ["fix", "What got in the way, and what changes tomorrow?", "Slept late after a call; phone stays outside the bedroom"]].map(([k, l, ph]) => (
              <label key={k + s} className="grid gap-1.5"><span className="text-[13px] text-muted-foreground">{l}</span>
                <Textarea defaultValue={r[k] || ""} placeholder={ph} rows={2} onChange={(e) => { rec()[k] = e.target.value; saveDay(S.selected); }} /></label>
            ))}
          </div>
        </Fold>
      </CardContent>
    </Card>
  );
}

function Away({ s, r }) {
  const run = awayRun(s);
  return (
    <Card className={cn("py-3", r.away && "border-warn/40")}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[15px]">Away or interrupted</div>
            <div className="text-xs text-muted-foreground">Travel, illness, a family day: training pauses, the floor applies, the streak survives.</div>
          </div>
          <Switch checked={!!r.away} onCheckedChange={(v) => set("away", v || null)} aria-label="Away today" />
        </div>
        {r.away && (
          <Hint>Floor for today: {FLOOR.steps.toLocaleString("en")} steps, {FLOOR.exerciseMin} min of movement, {FLOOR.sleepH} h of sleep. Prayers and purity still count.
            {run >= 2 && <span className="mt-1 block font-semibold text-bad">{run} away days in a row. Never miss twice.</span>}</Hint>
        )}
      </CardContent>
    </Card>
  );
}
