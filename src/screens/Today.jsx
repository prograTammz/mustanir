// Today: the quest board. The day's run (XP ring, the five ministers as stats, the perfect-day chest), the quests you
// complete by hand (each one shows what it pays), what WHOOP and FatSecret fill in for you, the medals within reach.
import { useEffect, useState } from "react";
import { S, PRAYERS, MINISTERS, today, addDays, fmt, hijri, termDay, termInfo, dayXP, MAX_DAY_XP, streak, T, matchDay, hasSchedule,
  slotName, ABSTAIN_XP, checklistFor, vitalityFor, fajrTime, isSunday, weighIn, WEIGH_IN_XP, awayRun, FLOOR, xpParts, PERFECT_BONUS, sleptEnough, consistent } from "@/lib/logic.js";
import { SESSION, loadMeals, saveDay, saveSettings } from "@/lib/store.js";
import { useApp, set, rec, bump, go, allMedals } from "@/lib/app-state.js";
import { openSheet } from "@/lib/app-state.js";
import { Ar, Fold, Hero, Tile, Hint, Stepper, Emblem, MIN, mColor, mContainer, medalKind, fmtN, fmtMin } from "@/components/kit";
import { Icon, Shape, Button, IconButton, Chip, Checkbox, Switch, Card, SectionTitle, Progress, Ring, XP, haptic } from "@/components/m3/index.jsx";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Today() {
  useApp();
  const s = S.selected, r = rec(), isToday = s === today(), xp = xpParts(s), c = checklistFor(s);
  const pr = r.prayers || {};
  const quests = [PRAYERS.every(([k]) => pr[k]), (r.pages || 0) >= S.settings.pagesPerDay, xp.ministers.habits.earned >= 20, c.total > 0 && c.done === c.total, r.pornFree !== false && r.mast !== true];
  return (
    <>
      <Hero><DayBar s={s} isToday={isToday} /></Hero>
      {S.mode === "error" && <div className="flex items-center gap-3 rounded-2xl bg-error-container px-4 py-3 type-body-m text-on-error-container"><Icon name="cloud_off" size={20} />Offline. Keep checking in; it syncs when you’re back.</div>}
      <RunCard s={s} xp={xp} />
      <SectionTitle trailing={<span className="type-label-l text-on-surface-variant tnum">{quests.filter(Boolean).length} of {quests.length} complete</span>}>Quests</SectionTitle>
      <PrayerQuest pr={pr} pay={xp.ministers.faith} done={quests[0]} />
      <ReadingQuest r={r} pay={xp.ministers.knowledge} done={quests[1]} />
      <RoutineQuest r={r} pay={xp.ministers.habits} done={quests[2]} />
      <TaskQuest r={r} c={c} pay={xp.checklist} done={quests[3]} />
      <PurityQuest s={s} r={r} xp={xp} />
      <SectionTitle sub="Filled in by WHOOP and FatSecret, nothing to tap">Tracked for you</SectionTitle>
      <Vitality s={s} r={r} xp={xp} />
      <BodyCard s={s} r={r} xp={xp} />
      <Bounties />
      <Reflect s={s} r={r} />
      <Away s={s} r={r} />
    </>
  );
}

/* ---------- the day: step through days, see where you are in the term ---------- */
function DayBar({ s, isToday }) {
  const dn = termDay(s), term = termInfo(s), yest = s === addDays(today(), -1);
  const move = (n) => { const nx = addDays(s, n); if (nx <= today()) { S.selected = nx; bump(); } };
  return (
    <div className="rise flex flex-col gap-2 pt-1">
      <div className="flex items-center gap-2">
        <IconButton icon="chevron_left" label="Previous day" variant="surface" onClick={() => move(-1)} />
        <div className="min-w-0 flex-1 text-center">
          <h1 className="type-headline-s em truncate">{isToday ? "Today" : yest ? "Yesterday" : fmt(s, { weekday: "long" })}</h1>
          <p className="type-body-s truncate text-on-surface-variant">{fmt(s, { day: "numeric", month: "long" })}{dn >= 1 ? ` · Day ${dn} of term ${term.n}` : ""}</p>
          <Ar className="block truncate text-center text-[13px] leading-5 text-tertiary">{hijri(s)}</Ar>
        </div>
        <IconButton icon="chevron_right" label="Next day" variant="surface" disabled={isToday} className="disabled:opacity-30" onClick={() => move(1)} />
      </div>
      {!isToday && <Button variant="tonal" size="xs" icon="undo" className="self-center" onClick={() => { S.selected = today(); bump(); }}>Back to today</Button>}
    </div>
  );
}

/* ---------- the day's run: XP ring, five stats, the perfect-day chest ---------- */
function RunCard({ s, xp }) {
  const earned = dayXP(s), max = MAX_DAY_XP + (isSunday(s) ? WEIGH_IN_XP : 0), open = xp.perfect.earned > 0;
  return (
    <Card variant="high" className="rise relative overflow-hidden p-5">
      <Shape name="verySunny" size={220} spin color="color-mix(in srgb, var(--md-sys-color-tertiary) 9%, transparent)" className="pointer-events-none absolute -top-16 -right-16" />
      <div className="relative flex items-center gap-4">
        <Ring value={earned / max} size={128} stroke={8} wavy color="var(--md-sys-color-tertiary)" label={`${earned} of ${max} XP ${s === today() ? "today" : "that day"}`}>
          <span className="type-display-s em-x tnum leading-none">{earned}</span>
          <span className="mt-1 type-label-m text-on-surface-variant tnum">of {max} XP</span>
        </Ring>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5" role="list" aria-label={"Today: " + MINISTERS.map((m) => `${m.en.replace("Minister of ", "")} ${xp.ministers[m.key].earned} of 20`).join(", ")}>
          {MINISTERS.map((m) => {
            const v = xp.ministers[m.key];
            return (
              <button key={m.key} role="listitem" onClick={() => openSheet({ type: "minister", key: m.key })} className="state -mx-1.5 rounded-xl px-1.5 py-0.5 text-left">
                <div className="flex items-center gap-1.5 type-label-m">
                  <Icon name={MIN[m.key].icon} size={14} fill style={{ color: mColor(m.key) }} />
                  <span className="min-w-0 flex-1 truncate">{m.en.replace("Minister of ", "")}</span>
                  <span className="em tnum">{v.earned}</span><span className="text-on-surface-variant tnum">/20</span>
                </div>
                <Progress value={v.frac} color={mColor(m.key)} stop={false} className="mt-1" />
              </button>
            );
          })}
        </div>
      </div>
      <div className={cn("relative mt-4 flex items-center gap-3 rounded-[20px] p-3 transition-colors", open ? "bg-tertiary-container text-on-tertiary-container" : "bg-surface-container-highest")}>
        <Shape name={open ? "burst" : "cookie9"} size={44} color={open ? "var(--md-sys-color-tertiary)" : "var(--md-sys-color-surface-container)"}>
          <Icon name={open ? "celebration" : "redeem"} fill size={22} className={open ? "text-on-tertiary" : "text-tertiary"} />
        </Shape>
        <div className="min-w-0 flex-1">
          <div className="type-title-s em">{open ? "Perfect day · chest opened" : "Perfect-day chest"}</div>
          <div className="mt-1 flex items-center gap-1" aria-label={`${xp.near} of 5 ministers at 90%`}>
            {[0, 1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i < xp.near ? "bg-tertiary" : "bg-outline-variant")} />)}
          </div>
          <div className={cn("mt-1 type-body-s", !open && "text-on-surface-variant")}>{open ? "Every minister at 90% or more." : `${xp.near} of 5 ministers at 90% · all five open it`}</div>
        </div>
        <XP plus={`+${PERFECT_BONUS}`} earned={xp.perfect.earned} max={PERFECT_BONUS} />
      </div>
    </Card>
  );
}

/* ---------- quests ---------- */
function Quest({ k, title, sub, pay, done, children, className }) {
  return (
    <Card className={cn("rise p-4 transition-colors duration-500", className)} style={done ? { background: `color-mix(in srgb, ${mContainer(k)} 45%, var(--md-sys-color-surface-container))` } : undefined}>
      <div className="flex items-center gap-3">
        <Emblem k={k} size={44} done={done} />
        <div className="min-w-0 flex-1">
          <div className="type-title-m em truncate">{title}</div>
          {sub && <div className="type-body-s truncate text-on-surface-variant">{sub}</div>}
        </div>
        {pay}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}

// One tap: on time (+4). Two: made up, qada (+2). Three: clear.
function PrayerQuest({ pr, pay, done }) {
  const cyc = (k) => { const cur = pr[k], nx = cur == null ? "on" : cur === "on" ? "late" : null, p = { ...pr }; if (nx) p[k] = nx; else delete p[k]; set("prayers", p); };
  const n = PRAYERS.filter(([k]) => pr[k]).length;
  return (
    <Quest k="faith" title="The five prayers" sub={done ? "All five kept" : `${n} of 5 · tap once on time, twice for qada`} pay={<XP {...pay} />} done={done}>
      <div className="grid grid-cols-5 gap-1.5">
        {PRAYERS.map(([k, l, a]) => {
          const st = pr[k];
          return (
            <button key={k} type="button" aria-pressed={!!st} aria-label={`${l}: ${st === "on" ? "on time" : st === "late" ? "made up" : "not yet"}`} onClick={() => { haptic(); cyc(k); }}
              data-selected={String(!!st)}
              className={cn("m3-btn state flex h-[76px] flex-col items-center justify-center gap-0.5 [--r:22px] [--rs:14px] [--rp:10px]",
                st === "on" ? "bg-[var(--md-custom-color-faith)] text-[var(--md-custom-color-on-faith)]" : st === "late" ? "bg-warning-container text-on-warning-container" : "bg-surface-container-highest")}>
              <Ar className="text-[16px] leading-tight">{a}</Ar>
              <span className={cn("type-label-s", !st && "text-on-surface-variant")}>{st === "late" ? "Qada" : l}</span>
              {st ? <Icon name="check" size={16} className="pop" /> : <span className="type-label-s em text-tertiary tnum">+4</span>}
            </button>
          );
        })}
      </div>
    </Quest>
  );
}

function ReadingQuest({ r, pay, done }) {
  const goal = S.settings.pagesPerDay, p = r.pages || 0;
  return (
    <Quest k="knowledge" title={`Read ${goal} pages`} sub={S.settings.book || "Your current book"} pay={<XP {...pay} />} done={done}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1"><span className="type-headline-m em-x tnum">{p}</span><span className="type-body-m text-on-surface-variant tnum">/ {goal} pages</span></div>
          <Progress value={p / goal} wavy color={mColor("knowledge")} className="mt-1.5" />
        </div>
        <Stepper label="pages" value={r.pages} step={5} onChange={(v) => set("pages", v)} />
      </div>
    </Quest>
  );
}

const ROUTINES = [["hair", "Hair", "Morning"], ["skinAm", "Skin", "Morning"], ["teethAm", "Teeth", "Morning"], ["skinPm", "Skin", "Night"], ["teethPm", "Teeth", "Night"]];
function RoutineQuest({ r, pay, done }) {
  // What the watch fills in counts here too (sleep counts double), shown as read-only chips.
  const auto = [["Up for Fajr", r.wake === true, "wb_twilight"], [`${S.settings.sleepTarget || 7} h asleep`, sleptEnough(r), "bedtime"], ["Steady rhythm", consistent(r), "repeat"], ["WHOOP worn", !!r.watch, "watch"]];
  return (
    <Quest k="habits" title="Routines and sleep" sub="Five routines by hand, four from the watch" pay={<XP {...pay} />} done={done}>
      {["Morning", "Night"].map((when) => (
        <div key={when} className="flex items-center gap-3 py-1">
          <span className="w-16 shrink-0 type-label-l text-on-surface-variant">{when}</span>
          <div className="flex flex-1 flex-wrap gap-2">{ROUTINES.filter((x) => x[2] === when).map(([k, l]) => <Chip key={k} selected={!!r[k]} onClick={() => set(k, !r[k])}>{l}</Chip>)}</div>
        </div>
      ))}
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Filled in by WHOOP">
        {auto.map(([l, on, ic]) => (
          <span key={l} className={cn("inline-flex h-7 items-center gap-1 rounded-lg px-2 type-label-m", on ? "bg-success-container text-on-success-container" : "bg-surface-container-highest text-on-surface-variant")}>
            <Icon name={on ? "check" : ic} size={15} />{l}
          </span>
        ))}
      </div>
    </Quest>
  );
}

// A task reads as plain text and edits in place, like a note: tap, type, Done. Emptying one keeps its old words; the X removes it.
function TaskText({ text, done, onSave }) {
  const fit = (el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };
  return (
    <textarea key={text} ref={fit} rows={1} defaultValue={text} aria-label="Task" enterKeyHint="done" onInput={(e) => fit(e.target)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
      onBlur={(e) => { const t = e.target.value.trim(); if (t && t !== text) onSave(t); else { e.target.value = text; fit(e.target); } }}
      className={cn("min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-2 type-body-l outline-none transition-colors", done && "text-on-surface-variant line-through")} />
  );
}

function TaskQuest({ r, c, pay, done }) {
  const [txt, setTxt] = useState("");
  const toggle = (id) => set("checks", { ...(r.checks || {}), [id]: !(r.checks || {})[id] });
  const add = () => { const t = txt.trim(); if (!t) return; set("extraTasks", [...(r.extraTasks || []), { id: "x" + Date.now().toString(36), text: t }]); setTxt(""); };
  const extra = (id) => (r.extraTasks || []).some((t) => t.id === id);
  // Today's own tasks change for today; an item of the daily checklist changes in Settings too, so it stays reworded.
  const rename = (id, text) => {
    const swap = (list) => list.map((t) => (t.id === id ? { ...t, text } : t));
    if (extra(id)) set("extraTasks", swap(r.extraTasks));
    else { S.settings.checklist = swap(S.settings.checklist || []); saveSettings(); bump(); }
  };
  return (
    <Quest k="tasks" title="The day’s work" sub={c.total ? `${c.done} of ${c.total} done` : "Add what today is for"} pay={<XP {...pay} />} done={done}>
      <div className="flex flex-col">
        {c.items.map((x) => (
          <div key={x.id} className="flex min-h-11 items-center gap-3">
            <Checkbox checked={!!c.checks[x.id]} onChange={() => toggle(x.id)} label={x.text} color="var(--md-sys-color-tertiary)" />
            <TaskText text={x.text} done={!!c.checks[x.id]} onSave={(t) => rename(x.id, t)} />
            {extra(x.id) &&<IconButton icon="close" label="Remove task" size="xs" onClick={() => set("extraTasks", r.extraTasks.filter((t) => t.id !== x.id))} />}
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2">
          <Icon name="add" size={22} className="ml-0.5 text-on-surface-variant" />
          <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} onBlur={add} placeholder="Add a task for today"
            className="h-11 min-w-0 flex-1 bg-transparent type-body-l outline-none placeholder:text-on-surface-variant/70" />
        </div>
      </div>
    </Quest>
  );
}

// Purity runs the other way: every day starts with the shield up and full marks; only a logged slip takes them away.
function PurityQuest({ s, r, xp }) {
  const slipped = r.pornFree === false || r.mast === true, [open, setOpen] = useState(false);
  const toggle = (k, v) => set(k, r[k] === v ? null : v);
  const total = xp.ministers.purity.earned + xp.abstain.earned, run = streak(T.abstain);
  return (
    <Quest k="purity" title={slipped ? "Shield down today" : "Purity shield"} sub={slipped ? "A slip is data, not defeat" : `Up · ${run}-day streak · full marks unless a slip is logged`}
      pay={<XP earned={total} max={20 + ABSTAIN_XP} plus={slipped ? "0" : undefined} />} done={!slipped}>
      {!slipped && !open && <Button variant="text" size="xs" icon="flag" className="-ml-2" onClick={() => setOpen(true)}>Log a slip</Button>}
      {(open || slipped) && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="error" selected={r.pornFree === false} onClick={() => toggle("pornFree", false)}>Porn</Chip>
          <Chip tone="error" selected={r.mast === true} onClick={() => toggle("mast", true)}>Masturbation</Chip>
          {!slipped && <Button variant="text" size="xs" onClick={() => setOpen(false)}>Close</Button>}
        </div>
      )}
      {slipped && <Input className="mt-3" key={"n" + s} defaultValue={r.note || ""} placeholder="What triggered it?" onBlur={(e) => set("note", e.target.value.trim())} />}
    </Quest>
  );
}

/* ---------- tracked for you: vitality (WHOOP), then fuel, training and the scale ---------- */
const mealsLoading = new Set();
function Vitality({ s, r, xp }) {
  const v = vitalityFor(s), g = Object.fromEntries(v.items.map((x) => [x.k, x]));
  const u = (x) => (x.unit && x.unit !== "%" ? " " + x.unit : x.unit);
  const tile = (k, label, icon, val) => { const x = g[k]; return x ? <Tile icon={icon} label={label} value={x.val == null ? "—" : val ?? x.fmt(x.val) + u(x)} sub={`goal ${x.goal.toLocaleString("en")}${u(x)}`} hit={x.val == null ? null : x.hit} /> : null; };
  return (
    <Card className="rise p-4">
      <div className="mb-3 flex items-center gap-3">
        <Shape name="cookie12" size={44} color="var(--md-custom-color-success-container)"><Icon name="ecg_heart" fill size={22} style={{ color: "var(--md-custom-color-on-success-container)" }} /></Shape>
        <div className="min-w-0 flex-1"><div className="type-title-m em">Vitality</div><div className="type-body-s text-on-surface-variant">{v.seen ? `${v.hits} of ${v.total} kept · measured by WHOOP` : "Waiting for WHOOP"}</div></div>
        <XP {...xp.vitality} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Tile icon="wb_twilight" label="Fajr" value={r.wake == null ? "—" : r.wake ? "Yes" : "No"} sub={`Fajr ${fajrTime(s)}`} hit={r.wake == null ? null : r.wake} />
        {tile("sleepH", "Sleep", "bedtime", r.sleepH != null ? `${(Math.round(r.sleepH * 10) / 10).toFixed(1)} h` : undefined)}
        {tile("sleepCons", "Rhythm", "repeat")}
        {tile("steps", "Steps", "footprint")}
        {tile("exerciseMin", "Exercise", "exercise")}
        {tile("strain", "Strain", "bolt")}
      </div>
    </Card>
  );
}

function BodyCard({ s, r, xp }) {
  useEffect(() => {
    if (SESSION && !(S.meals || {})[s] && !mealsLoading.has(s)) { mealsLoading.add(s); loadMeals(s).then(() => { mealsLoading.delete(s); bump(); }).catch(() => mealsLoading.delete(s)); }
  }, [s]);
  return (
    <Card className="rise p-4">
      <div className="flex items-center gap-3">
        <Emblem k="body" size={44} />
        <div className="min-w-0 flex-1"><div className="type-title-m em">Fuel, training, the scale</div><div className="type-body-s text-on-surface-variant">Ministry of Body</div></div>
        <XP {...xp.ministers.body} />
      </div>
      <Food s={s} r={r} />
      <Sessions s={s} r={r} />
      <Weight s={s} r={r} xp={xp} />
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
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 type-title-s"><Icon name="restaurant" size={18} className="text-on-surface-variant" />Deficit</span>
        <span className="tnum"><span className={cn("type-title-m em", met && "text-success")}>{deficit == null ? "—" : Math.round(deficit).toLocaleString("en")}</span><span className="type-body-m text-on-surface-variant"> / {target} kcal</span></span>
      </div>
      <Progress className="mt-2" value={deficit == null ? 0 : deficit / target} wavy={!met} color={met ? "var(--md-custom-color-success-vivid)" : mColor("body")} />
      <div className="mt-1.5 type-body-s text-on-surface-variant tnum">
        {burned || eaten ? `Burned ${Math.round(burned).toLocaleString("en")} · ate ${Math.round(eaten).toLocaleString("en")}${protein ? ` · ${Math.round(protein)} g protein` : ""}${s === today() ? " so far" : ""}` : "Log meals in FatSecret; they arrive within 10 minutes."}
      </div>
      {meals.length > 0 && (
        <Fold className="mt-1" title="Meals" summary={`${meals.length} logged`}>
          {meals.map((m) => (
            <div key={m.id} className="flex items-baseline gap-3 py-2 type-body-m">
              <span className="min-w-0 flex-1 truncate">{m.name || "Meal"}</span>
              <span className="shrink-0 text-on-surface-variant tnum">{Math.round(m.kcal)} kcal{m.protein ? ` · ${Math.round(m.protein)} g` : ""}</span>
            </div>
          ))}
        </Fold>
      )}
    </div>
  );
}

const STATUS = {
  done: ["bg-success-container text-on-success-container", "check_circle"], partial: ["bg-warning-container text-on-warning-container", "hourglass_top"],
  live: ["bg-warning-container text-on-warning-container", "timer"], missed: ["bg-error-container text-on-error-container", "close"],
  upcoming: ["bg-surface-container-highest text-on-surface-variant", "schedule"], cancelled: ["bg-surface-container-highest text-on-surface-variant", "event_busy"],
};
const SPORT_ICON = { gym: "fitness_center", tennis: "sports_tennis", mma: "sports_mma", swim: "pool", run: "directions_run", walk: "directions_walk", other: "exercise" };
function Sessions({ s, r }) {
  const ms = matchDay(s), standing = ms.filter((m) => m.status !== "cancelled"), off = ms.length - standing.length;
  const label = (m) => ({ done: `${fmtMin(m.done || m.planned)} done`, partial: `${fmtMin(m.done)} of ${fmtMin(m.planned)}`, live: `${fmtMin(m.done)} so far`, missed: "Missed", upcoming: "Upcoming", cancelled: "Cancelled" }[m.status]);
  const wks = r.workoutsDetail || []; // every workout WHOOP recorded, matched to a slot or not
  const summary = r.away ? "Paused today" : ms.length
    ? (standing.length ? `${standing.filter((m) => m.status === "done").length} of ${standing.length} done` : "All cancelled · rest day") + (off && standing.length ? ` · ${off} cancelled` : "")
    : hasSchedule() ? "Rest day" : "No schedule";
  // Calling a session off (or putting it back): it stops counting either way, and its reminder and calendar event go too.
  const toggle = (m) => {
    const c = { ...(r.cancelled || {}) }, was = !!c[m.slot.id];
    if (was) delete c[m.slot.id]; else c[m.slot.id] = true;
    set("cancelled", Object.keys(c).length ? c : null);
    toast(was ? `${slotName(m.slot)} ${m.slot.start} is back on` : `${slotName(m.slot)} ${m.slot.start} cancelled`, {
      description: was ? "It counts again." : "Not counted for or against you" + (s === today() ? ", and no reminder." : "."),
    });
  };
  const upcoming = ms.some((m) => m.status === "upcoming" || m.status === "live");
  return (
    <div className="mt-3 border-t pt-1">
      <Fold key={s} title="Training" summary={summary} defaultOpen={upcoming} leading={<Icon name="sports_tennis" size={18} className="text-on-surface-variant" />}>
        <div className="flex flex-col gap-1.5">
          {ms.map((m) => {
            const off = m.status === "cancelled", canCancel = !off && m.status !== "done", [tone, ic] = STATUS[m.status];
            return (
              <div key={m.slot.id} className="flex items-center gap-3 rounded-[18px] bg-surface-container-high py-2 pr-2 pl-3">
                <Icon name={SPORT_ICON[m.slot.sport] || "exercise"} size={20} className="shrink-0 text-on-surface-variant" />
                <div className="min-w-0 flex-1">
                  <div className={cn("type-title-s truncate", off && "text-on-surface-variant line-through")}>{slotName(m.slot)} <span className="font-normal text-on-surface-variant tnum">{m.slot.start}–{m.slot.end}</span></div>
                  <span className={cn("mt-0.5 inline-flex h-5 items-center gap-1 rounded-md px-1.5 type-label-s", tone)}><Icon name={ic} size={13} />{label(m)}</span>
                </div>
                {(canCancel || off) && (
                  <Button variant={off ? "tonal" : "text"} size="xs" icon={off ? "undo" : "event_busy"} onClick={() => toggle(m)} aria-label={off ? `Restore ${slotName(m.slot)} at ${m.slot.start}` : `Cancel ${slotName(m.slot)} at ${m.slot.start}`}>
                    {off ? "Restore" : "Cancel"}
                  </Button>
                )}
              </div>
            );
          })}
          {wks.map((w, i) => (
            <div key={i} className="flex items-center gap-3 px-1 py-1.5">
              <Icon name="watch" size={18} className="shrink-0 text-on-surface-variant" />
              <span className="min-w-0 flex-1 truncate type-body-m">{w.a} <span className="text-on-surface-variant">{w.s}–{w.e}</span></span>
              <span className="shrink-0 type-body-s text-on-surface-variant tnum">{w.min} min{w.strain ? ` · ${w.strain}` : ""}</span>
            </div>
          ))}
          {!ms.length && !wks.length && <Hint className="py-2">No workouts recorded{s === today() ? " yet" : ""}. WHOOP adds them here.</Hint>}
          {off > 0 && <Hint className="pt-1 pb-1">Cancelled sessions don’t count for or against you.</Hint>}
        </div>
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
    <div className="border-t pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 type-title-s"><Icon name="monitor_weight" size={18} className="text-on-surface-variant" />Weight</span>
        <span className="flex items-center gap-2"><span className="type-title-m em tnum">{w == null ? "—" : `${w.toFixed(1)} kg`}</span>{xp.weighIn && <XP {...xp.weighIn} size="s" />}</span>
      </div>
      {wi ? (
        <div className={cn("mt-2 rounded-2xl px-3 py-2 type-body-m", wi.won ? "bg-success-container text-on-success-container" : "bg-surface-container-highest text-on-surface-variant")}>
          {wi.drop == null ? `Sunday weigh-in: lower than last Sunday pays +${WEIGH_IN_XP} XP. Needs a reading both weeks.` : wi.won ? `Sunday weigh-in: down ${wi.drop.toFixed(1)} kg on last week. +${WEIGH_IN_XP} XP` : `Sunday weigh-in: ${wi.drop === 0 ? "level with" : `up ${(-wi.drop).toFixed(1)} kg on`} last week. Next Sunday.`}
        </div>
      ) : <Hint className="mt-1">Every Sunday, a lower weight than last week pays +{WEIGH_IN_XP} XP.</Hint>}
    </div>
  );
}

/* ---------- bounties: the medals closest to falling ---------- */
function Bounties() {
  const ms = allMedals(), near = ms.filter((m) => !m.won && m.frac > 0).sort((a, b) => b.frac - a.frac).slice(0, 6);
  if (!near.length) return null;
  return (
    <>
      <SectionTitle trailing={<Button variant="text" size="xs" iconEnd="chevron_right" onClick={() => go("palace")}>{ms.filter((m) => m.won).length} of {ms.length}</Button>}>Medals within reach</SectionTitle>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1">
        {near.map((m) => {
          const k = medalKind(m.id);
          return (
            <button key={m.id} type="button" onClick={() => openSheet({ type: "medal", id: m.id })} className="state rise flex w-[150px] shrink-0 snap-start flex-col gap-2 rounded-[24px] bg-surface-container p-3 text-left">
              <Ring value={m.frac} size={52} stroke={4} color={mColor(k)}>
                <Shape name={MIN[k].shape} rot={MIN[k].rot || 0} size={34} color={mContainer(k)}><Icon name="lock" size={16} fill style={{ color: mColor(k) }} /></Shape>
              </Ring>
              <div className="type-title-s em leading-tight">{m.en}</div>
              <div className="mt-auto type-label-m text-on-surface-variant tnum">{m.down ? `${fmtN(m.cur)} → ${m.goal} kg` : `${fmtN(m.cur)} / ${fmtN(m.goal)}`}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ---------- the journal and the away switch ---------- */
function Reflect({ s, r }) {
  const filled = [r.good, r.fix].filter((x) => x && x.trim()).length;
  return (
    <Card className="rise mt-2 px-4 py-2">
      <Fold title="Reflect" summary={filled ? `${filled} of 2 written` : "Two questions"} leading={<Icon name="edit_note" size={22} className="text-on-surface-variant" />}>
        <div className="flex flex-col gap-3 pt-1 pb-3">
          {[["good", "What went well today?", "Prayed Fajr on time, hit 30 pages"], ["fix", "What got in the way, and what changes tomorrow?", "Slept late after a call; phone stays outside the bedroom"]].map(([k, l, ph]) => (
            <label key={k + s} className="grid gap-1.5"><span className="type-label-l text-on-surface-variant">{l}</span>
              <Textarea defaultValue={r[k] || ""} placeholder={ph} rows={2} onChange={(e) => { rec()[k] = e.target.value; saveDay(S.selected); }} /></label>
          ))}
        </div>
      </Fold>
    </Card>
  );
}

function Away({ s, r }) {
  const run = awayRun(s);
  return (
    <Card className={cn("rise p-4", r.away && "bg-warning-container text-on-warning-container")}>
      <div className="flex items-center gap-4">
        <Icon name="luggage" size={24} className={r.away ? "" : "text-on-surface-variant"} />
        <div className="min-w-0 flex-1">
          <div className="type-title-m">Away or interrupted</div>
          <div className={cn("type-body-s", !r.away && "text-on-surface-variant")}>Travel, illness, a family day: training pauses, the floor applies, the streak survives.</div>
        </div>
        <Switch checked={!!r.away} onCheckedChange={(v) => set("away", v || null)} label="Away today" />
      </div>
      {r.away && (
        <p className="mt-3 type-body-m">Floor for today: {FLOOR.steps.toLocaleString("en")} steps, {FLOOR.exerciseMin} min of movement, {FLOOR.sleepH} h of sleep. Prayers and purity still count.
          {run >= 2 && <span className="mt-1 block font-bold text-error">{run} away days in a row. Never miss twice.</span>}</p>
      )}
    </Card>
  );
}
