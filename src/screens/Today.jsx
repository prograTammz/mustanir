// Today: the check-in. What you do by hand on top (a few taps), what WHOOP and FatSecret fill in below (read-only).
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Plus, X, Moon, Sunrise, Footprints, Activity, Dumbbell, Repeat, WifiOff } from "lucide-react";
import { S, PRAYERS, today, addDays, fmt, hijri, termDay, termInfo, day, dayXP, MAX_DAY_XP, totals, rankFor, streak, T, matchDay, hasSchedule,
  slotName, ABSTAIN_XP, checklistFor, vitalityFor, fajrTime, sleptEnough, consistent, isSunday, weighIn, WEIGH_IN_XP, awayRun, FLOOR } from "@/lib/logic.js";
import { SESSION, loadMeals, saveDay } from "@/lib/store.js";
import { useApp, set, rec, bump, go } from "@/lib/app-state.js";
import { Ar, Ring, Row, Stepper, Chip, Hint, Fold, Tile, Bar, Tick, fmtMin } from "@/components/kit";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function Today() {
  useApp();
  const s = S.selected, r = rec(), isToday = s === today();
  return (
    <>
      <DayHeader s={s} isToday={isToday} />
      {S.mode === "error" && <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-[13px] text-muted-foreground"><WifiOff className="size-4" />Offline. Keep checking in; it syncs when you’re back.</div>}
      <Hero s={s} />
      <CheckIn s={s} r={r} />
      <Measured s={s} r={r} />
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

function Hero({ s }) {
  const xp = dayXP(s), t = totals(), rank = rankFor(t.level), run = streak(T.office);
  return (
    <Card className="flex-row items-center gap-4 px-4 py-4">
      <Ring value={xp / MAX_DAY_XP} color="var(--gold)" size={84} stroke={7} label="Today's score">
        <span className="flex flex-col items-center leading-none"><span className="text-[22px] font-bold tracking-tight">{xp}</span><span className="mt-1 text-[10px] font-medium text-muted-foreground">XP</span></span>
      </Ring>
      <button className="min-w-0 flex-1 text-left" onClick={() => go("progress")}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-semibold">Level {t.level}</span>
          <span className="truncate text-[13px] text-muted-foreground">{rank.en}</span>
        </div>
        <Bar className="mt-2" value={t.frac} color="var(--gold)" />
        <div className="mt-1.5 text-[12px] text-muted-foreground tnum">{(t.to - t.xp).toLocaleString("en")} XP to level {t.level + 1}</div>
        <div className="mt-2.5 flex items-center gap-1.5 text-[13px] font-medium"><Flame className="size-4 text-gold" />{run ? `${run}-day streak` : "Start your streak today"}</div>
      </button>
    </Card>
  );
}

/* ---------- what you log by hand ---------- */
const ROUTINES = [["hair", "Hair"], ["skinAm", "Skin"], ["teethAm", "Teeth"], ["skinPm", "Skin"], ["teethPm", "Teeth"]];
function CheckIn({ s, r }) {
  const pr = r.prayers || {}, c = checklistFor(s);
  const done = PRAYERS.filter(([k]) => pr[k]).length + (r.pages >= S.settings.pagesPerDay ? 1 : 0) + ROUTINES.filter(([k]) => r[k]).length + c.done;
  const total = 5 + 1 + ROUTINES.length + c.total;
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <h2 className="text-[17px] font-semibold tracking-tight">Check in</h2>
        <span className="text-[13px] text-muted-foreground tnum">{done} of {total}</span>
      </div>
      <CardContent className="flex flex-col pb-2">
        <Prayers pr={pr} />
        <Row label="Reading" sub={`${r.pages || 0} of ${S.settings.pagesPerDay} pages${S.settings.book ? " · " + S.settings.book : ""}`}>
          <Stepper label="pages" value={r.pages} step={5} onChange={(v) => set("pages", v)} />
        </Row>
        {[["Morning", ROUTINES.slice(0, 3)], ["Night", ROUTINES.slice(3)]].map(([label, items]) => (
          <div key={label} className="flex min-h-12 items-center gap-3 border-t py-2">
            <span className="w-20 shrink-0 text-[15px]">{label}</span>
            <div className="flex flex-1 flex-wrap gap-2">{items.map(([k, l]) => <Chip key={k} size="sm" on={!!r[k]} onClick={() => set(k, !r[k])}>{l}</Chip>)}</div>
          </div>
        ))}
        <Tasks r={r} c={c} />
        <Purity s={s} r={r} />
      </CardContent>
    </Card>
  );
}

function Prayers({ pr }) {
  // One tap: on time. Two: made up (qada). Three: clear.
  const cyc = (k) => { const cur = pr[k], nx = cur == null ? "on" : cur === "on" ? "late" : null, p = { ...pr }; if (nx) p[k] = nx; else delete p[k]; set("prayers", p); };
  return (
    <div className="grid grid-cols-5 gap-1.5 py-3">
      {PRAYERS.map(([k, l, a]) => {
        const st = pr[k];
        return (
          <button key={k} aria-pressed={!!st} aria-label={`${l}: ${st === "on" ? "on time" : st === "late" ? "made up" : "not yet"}`} onClick={() => cyc(k)}
            className={cn("press flex flex-col items-center gap-1 rounded-2xl py-2.5", st === "on" ? "bg-faith text-white" : st === "late" ? "bg-warn/15 text-warn" : "bg-muted")}>
            <Ar className="text-[15px] leading-tight">{a}</Ar>
            <span className={cn("text-[10.5px] font-medium", !st && "text-muted-foreground")}>{st === "late" ? "Qada" : l}</span>
          </button>
        );
      })}
    </div>
  );
}

function Tasks({ r, c }) {
  const [txt, setTxt] = useState("");
  const toggle = (id) => set("checks", { ...(r.checks || {}), [id]: !(r.checks || {})[id] });
  const add = () => { const t = txt.trim(); if (!t) return; set("extraTasks", [...(r.extraTasks || []), { id: "x" + Date.now().toString(36), text: t }]); setTxt(""); };
  const extra = (id) => (r.extraTasks || []).some((t) => t.id === id);
  return (
    <div className="border-t py-2">
      <div className="flex items-center justify-between py-1.5"><span className="text-[15px]">Tasks</span>{c.total > 0 && <span className="text-[13px] text-muted-foreground tnum">{c.done} of {c.total}</span>}</div>
      {c.items.map((x) => (
        <div key={x.id} className="flex items-center gap-3 py-2">
          <Tick on={!!c.checks[x.id]} onClick={() => toggle(x.id)} label={x.text} />
          <span className={cn("min-w-0 flex-1 text-[15px] leading-snug", c.checks[x.id] && "text-muted-foreground line-through")}>{x.text}</span>
          {extra(x.id) && <button aria-label="Remove task" className="press grid size-7 place-items-center rounded-full text-muted-foreground" onClick={() => set("extraTasks", r.extraTasks.filter((t) => t.id !== x.id))}><X className="size-4" /></button>}
        </div>
      ))}
      <div className="flex items-center gap-3 py-1.5">
        <span className="grid size-6 shrink-0 place-items-center text-muted-foreground"><Plus className="size-4" /></span>
        <Input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} onBlur={add}
          placeholder="Add a task for today" className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent" />
      </div>
    </div>
  );
}

// Purity runs the other way: every day starts clean with full marks; only a logged slip takes them away.
function Purity({ s, r }) {
  const slipped = r.pornFree === false || r.mast === true;
  const [open, setOpen] = useState(false);
  const show = open || slipped;
  const toggle = (k, v) => set(k, r[k] === v ? null : v);
  return (
    <div className="border-t py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px]">Purity</div>
          <div className={cn("text-xs", slipped ? "text-bad" : "text-muted-foreground")}>{slipped ? "Slip logged · today’s points lost" : `Clean · full marks · +${ABSTAIN_XP} XP`}</div>
        </div>
        {!slipped && <button className="press h-8 rounded-full px-3 text-[13px] text-muted-foreground" onClick={() => setOpen(!open)}>{open ? "Close" : "Log a slip"}</button>}
      </div>
      {show && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Chip size="sm" tone="bad" on={r.pornFree === false} onClick={() => toggle("pornFree", false)}>Porn</Chip>
          <Chip size="sm" tone="bad" on={r.mast === true} onClick={() => toggle("mast", true)}>Masturbation</Chip>
        </div>
      )}
      {slipped && <Input className="mt-2.5" key={"n" + s} defaultValue={r.note || ""} placeholder="What triggered it? A slip is data, not defeat." onBlur={(e) => set("note", e.target.value.trim())} />}
    </div>
  );
}

/* ---------- what WHOOP and FatSecret fill in ---------- */
const mealsLoading = new Set();
function Measured({ s, r }) {
  useEffect(() => {
    if (SESSION && !(S.meals || {})[s] && !mealsLoading.has(s)) { mealsLoading.add(s); loadMeals(s).then(() => { mealsLoading.delete(s); bump(); }).catch(() => mealsLoading.delete(s)); }
  }, [s]);
  const v = vitalityFor(s), g = Object.fromEntries(v.items.map((x) => [x.k, x]));
  const tile = (k, label, icon, val) => { const x = g[k]; return x ? <Tile label={label} icon={icon} value={x.val == null ? "—" : val ?? x.fmt(x.val) + (x.unit && x.unit !== "%" ? " " + x.unit : x.unit)} sub={`goal ${x.goal.toLocaleString("en")}${x.unit && x.unit !== "%" ? " " + x.unit : x.unit}`} hit={x.val == null ? null : x.hit} /> : null; };
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-[17px] font-semibold tracking-tight">Measured for you</h2>
        <span className="text-[13px] text-muted-foreground tnum">{v.seen ? `${v.hits} of ${v.total} vitals` : "Waiting for WHOOP"}</span>
      </div>
      <CardContent className="flex flex-col pb-2">
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Up for Fajr" value={r.wake == null ? "—" : r.wake ? "Yes" : "No"} sub={`Fajr ${fajrTime(s)}`} hit={r.wake == null ? null : r.wake} />
          {tile("sleepH", "Sleep", null, r.sleepH != null ? `${(Math.round(r.sleepH * 10) / 10).toFixed(1)} h` : undefined)}
          {tile("sleepCons", "Consistency", null)}
          {tile("steps", "Steps", null)}
          {tile("exerciseMin", "Exercise", null)}
          {tile("strain", "Strain", null)}
        </div>
        <Food s={s} r={r} />
        <Sessions s={s} r={r} />
        <Weight s={s} r={r} />
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
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px]">Deficit</span>
        <span className={cn("text-[15px] font-semibold tnum", met && "text-ok")}>{deficit == null ? "—" : Math.round(deficit).toLocaleString("en")}<span className="font-normal text-muted-foreground"> / {target} kcal</span></span>
      </div>
      <Bar className="mt-2" value={deficit == null ? 0 : deficit / target} color={met ? "var(--ok)" : "var(--primary)"} />
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
  const extra = r.workoutsDetail || []; // every workout WHOOP recorded, matched to a slot or not
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
        {extra.map((w, i) => (
          <div key={i} className="flex items-center gap-3 border-t py-2.5">
            <Dumbbell className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-[14px]">{w.a} <span className="text-muted-foreground">{w.s}–{w.e}</span></span>
            <span className="shrink-0 text-[13px] text-muted-foreground tnum">{w.min} min{w.strain ? ` · ${w.strain}` : ""}</span>
          </div>
        ))}
        {!ms.length && !extra.length && <Hint className="border-t py-2.5">No workouts recorded{s === today() ? " yet" : ""}. WHOOP adds them here.</Hint>}
      </Fold>
    </div>
  );
}

function latestWeight(s, r) {
  if (r.weight != null) return +r.weight;
  for (let i = 1; i <= 30; i++) { const x = S.days[addDays(s, -i)]?.weight; if (x != null) return +x; }
  return null;
}
function Weight({ s, r }) {
  const w = latestWeight(s, r), wi = isSunday(s) ? weighIn(s) : null;
  return (
    <div className="mt-1 border-t py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px]">Weight</span>
        <span className="text-[15px] font-semibold tnum">{w == null ? "—" : `${w.toFixed(1)} kg`}</span>
      </div>
      {wi && (
        <div className={cn("mt-2 rounded-xl px-3 py-2 text-[13px]", wi.won ? "bg-ok/10 text-ok" : "bg-muted text-muted-foreground")}>
          {wi.drop == null ? "Sunday weigh-in: needs a reading this week and last." : wi.won ? `Sunday weigh-in: down ${wi.drop.toFixed(1)} kg on last week. +${WEIGH_IN_XP} XP` : `Sunday weigh-in: ${wi.drop === 0 ? "level with" : `up ${(-wi.drop).toFixed(1)} kg on`} last week.`}
        </div>
      )}
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
            <div className="text-xs text-muted-foreground">Travel, illness, a family day: training pauses, the floor applies.</div>
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
