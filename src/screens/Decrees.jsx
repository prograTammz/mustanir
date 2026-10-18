// The decrees: today's log, one card per minister, then the checklist, the vitals and the journal.
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plane, Plus, X, Watch, TriangleAlert, Info } from "lucide-react";
import { S, PRAYERS, MINISTERS, today, addDays, fmt, hijri, termDay, termLength, termInfo, day, dayMinisters, dayXP, MAX_DAY_XP, matchDay, hasSchedule,
  slotName, lastMastBefore, intervalFor, violation, streak, T, checklistFor, vitalityFor, VITALS, VITALITY_XP, awayRun, FLOOR, range, termStartFor } from "@/lib/logic.js";
import { SESSION, LS, loadMeals, addMeal, deleteMeal, saveDay } from "@/lib/store.js";
import { useApp, set, setQuiet, rec, bump } from "@/lib/app-state.js";
import { openSheet } from "@/components/sheets.jsx";
import { Ar, Emblem, Ring, Row, Stepper, Chip, Hint, Subhead, fmtMin } from "@/components/kit";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const M = Object.fromEntries(MINISTERS.map((m) => [m.key, m]));

function Decree({ k, side, children, ring, color }) {
  const m = M[k], v = ring ?? dayMinisters(S.selected)[k];
  return (
    <Card id={"dec-" + k} className="scroll-mt-20">
      <div className="flex items-center gap-3 px-5">
        <Emblem k={k} size={42} />
        <div className="min-w-0 flex-1"><Ar className="block text-[19px] leading-tight">{m.ar}</Ar><div className="truncate text-[13px] text-muted-foreground">{side}</div></div>
        <Ring value={v} color={color || `var(--m-${k})`} size={46} label={m.en + " today"} />
      </div>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function Decrees() {
  useApp();
  const s = S.selected, r = rec(), dn = termDay(s), term = termInfo(s);
  const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  const xp = dayXP(s);
  return (
    <>
      {!standalone && !LS.get("a2-hide-install", false) && (
        <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
          <Info className="size-4 shrink-0 text-gold" /><span className="flex-1">Install: in Safari tap Share, then Add to Home Screen.</span>
          <button className="text-muted-foreground" aria-label="Hide" onClick={() => { LS.set("a2-hide-install", true); bump(); }}><X className="size-4" /></button>
        </div>
      )}
      {S.mode === "error" && <div className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">Offline. Keep logging; your decrees sync when you’re back.</div>}

      <Card className="gap-3 py-3">
        <div className="flex items-center gap-1 px-2">
          <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => { S.selected = addDays(s, -1); bump(); }}><ChevronLeft className="size-5" /></Button>
          <div className="flex-1 text-center">
            <div className="text-[17px] font-semibold">{fmt(s)}</div>
            <div className="text-xs text-muted-foreground"><Ar>{hijri(s)}</Ar> · {dn < 1 ? "Before the term" : `Term ${term.n} · day ${dn} · week ${Math.floor((dn - 1) / 7) + 1}`}</div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Next day" disabled={s >= today()} onClick={() => { if (s < today()) { S.selected = addDays(s, 1); bump(); } }}><ChevronRight className="size-5" /></Button>
        </div>
        <div className="mx-5 flex items-center justify-between rounded-xl bg-gold-soft px-3.5 py-2">
          <span className="text-[15px] font-bold text-gold tnum">{xp} XP</span>
          <span className="text-xs text-muted-foreground">{S.status || `earned this day · up to ${MAX_DAY_XP}`}</span>
        </div>
      </Card>

      <AwayCard s={s} r={r} />

      <FaithDecree s={s} r={r} />
      <BodyDecree s={s} r={r} dn={dn} />
      <Decree k="knowledge" side={`${r.pages || 0} of ${S.settings.pagesPerDay} pages`}>
        <Row label={"Pages read" + (S.settings.book ? ` · ${S.settings.book}` : "")}><Stepper label="pages" value={r.pages} step={5} onChange={(v) => set("pages", v)} /></Row>
        <Row label="Margin learning" sub="minutes, not scored"><Stepper label="minutes" value={r.margin} step={15} onChange={(v) => set("margin", v)} /></Row>
      </Decree>
      <PurityDecree s={s} r={r} />
      <HabitsDecree r={r} />
      <ChecklistCard s={s} r={r} />
      <VitalityCard s={s} />
      <Card>
        <div className="flex items-center justify-between px-5"><div className="text-[19px] font-semibold tracking-tight">The president’s journal</div><Ar className="text-lg text-gold">مذكرات الرئيس</Ar></div>
        <CardContent className="flex flex-col gap-3">
          {[["good", "What went well today?", "e.g. Prayed Fajr on time, hit 30 pages"], ["fix", "What got in the way, and what changes tomorrow?", "e.g. Slept late after a call; phone stays outside the bedroom"]].map(([k, l, ph]) => (
            <label key={k + s} className="grid gap-1.5"><span className="text-sm font-medium">{l}</span><Textarea defaultValue={r[k] || ""} placeholder={ph} onChange={(e) => { rec()[k] = e.target.value; saveDay(S.selected); }} /></label>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function AwayCard({ s, r }) {
  const run = awayRun(s);
  const yesterdayMissed = !r.away && s === today() && (S.days[addDays(s, -1)] || {}).away;
  return (
    <Card className={cn("gap-2 py-3.5", r.away && "border-warn/50 bg-warn/5")}>
      <div className="flex items-center gap-3 px-5">
        <span className="grid size-10 place-items-center rounded-[30%] bg-warn/15 text-warn"><Plane className="size-5" /></span>
        <div className="min-w-0 flex-1"><div className="text-[15px] font-semibold">Away or interrupted today</div><div className="text-xs text-muted-foreground">Travel, illness, a family day: pause the schedule, keep the floor.</div></div>
        <Switch checked={!!r.away} onCheckedChange={(v) => set("away", v || null)} aria-label="Away today" />
      </div>
      {r.away && (
        <div className="mx-5 rounded-xl bg-background/60 px-3.5 py-2.5 text-[13px] leading-relaxed">
          Training slots aren’t judged today. The floor: {FLOOR.steps.toLocaleString("en")} steps, {FLOOR.exerciseMin} min of movement, protein, {FLOOR.sleepH} h of sleep. Prayers and purity still count.
          {run >= 2 && <div className="mt-2 flex items-start gap-2 font-semibold text-bad"><TriangleAlert className="mt-0.5 size-4 shrink-0" />{run} away days in a row. Never miss twice: tomorrow, do the 20-minute minimum whatever happens.</div>}
        </div>
      )}
      {yesterdayMissed && <div className="mx-5 flex items-start gap-2 rounded-xl bg-gold-soft px-3.5 py-2.5 text-[13px]"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-gold" />Yesterday was an away day. Today is the one that keeps the pattern: never miss twice.</div>}
    </Card>
  );
}

function FaithDecree({ s, r }) {
  const pr = r.prayers || {};
  const cyc = (k) => { const cur = pr[k]; const nx = cur == null ? "on" : cur === "on" ? "late" : null; const p = { ...pr }; if (nx) p[k] = nx; else delete p[k]; set("prayers", p); };
  return (
    <Decree k="faith" side={`${Math.round(day(s).faith * 50) / 10} of 5 prayers`}>
      <div className="grid grid-cols-5 gap-1.5">
        {PRAYERS.map(([k, l, a]) => (
          <button key={k} aria-pressed={!!pr[k]} onClick={() => cyc(k)}
            className={cn("flex flex-col items-center gap-0.5 rounded-2xl border py-3 transition-all active:scale-95",
              pr[k] === "on" && "border-faith bg-faith text-white", pr[k] === "late" && "border-warn bg-warn/15 text-warn", !pr[k] && "bg-card")}>
            <Ar className="text-[17px] leading-tight">{a}</Ar>
            <span className={cn("text-[11px]", pr[k] ? "opacity-90" : "text-muted-foreground")}>{pr[k] === "late" ? "qada" : l}</span>
          </button>
        ))}
      </div>
      <Hint className="mt-3">Tap once for on time, twice for made up, a third time to clear. Combined prayers while travelling count as on time.</Hint>
    </Decree>
  );
}

const mealsLoading = new Set();
function BodyDecree({ s, r, dn }) {
  const ms = matchDay(s);
  const wkStart = dn >= 1 ? addDays(termStartFor(s), Math.floor((dn - 1) / 7) * 7) : addDays(s, -6);
  const wk = range(wkStart, addDays(s, 1)).flatMap((k) => matchDay(k));
  const wkPlanned = wk.length, wkDone = wk.filter((m) => m.status === "done").length;
  const [food, setFood] = useState({ kcal: "", name: "", protein: "" }), [foodMsg, setFoodMsg] = useState("");
  useEffect(() => {
    if (SESSION && !(S.meals || {})[s] && !mealsLoading.has(s)) { mealsLoading.add(s); loadMeals(s).then(() => { mealsLoading.delete(s); bump(); }).catch(() => mealsLoading.delete(s)); }
  }, [s]);
  const mark = (id, val, sport) => { const marks = { ...(rec().slotMarks || {}) }; if (val) marks[id] = val; else delete marks[id]; if (val === "done" && sport) rec().train = sport; set("slotMarks", marks); };
  const status = (m) => ({ done: m.done ? `${fmtMin(m.done)} active${m.kcal ? ` · ${m.kcal} kcal` : ""}` : "Done", partial: `${fmtMin(m.done)} of ${fmtMin(m.planned)}${m.kcal ? ` · ${m.kcal} kcal` : ""}`, live: `${fmtMin(m.done)} so far`, missed: "No activity recorded", upcoming: "Upcoming", skipped: "Skipped" }[m.status]);
  const dot = { done: "bg-ok", partial: "bg-warn", live: "bg-warn animate-pulse", missed: "bg-bad", upcoming: "bg-muted-foreground/40", skipped: "bg-muted-foreground/40" };
  const meals = (S.meals || {})[s] || [];
  const pending = meals.filter((m) => !m.exported_at).reduce((a, m) => a + Number(m.kcal), 0);
  const eaten = (r.dietaryKcal || 0) + pending, burned = (r.activeKcal || 0) + (r.basalKcal || 0), deficit = burned && eaten ? burned - eaten : null;
  const protein = meals.reduce((a, m) => a + (Number(m.protein) || 0), 0);
  const addFood = async () => {
    const kcal = parseFloat(food.kcal), protein = parseFloat(food.protein);
    if (!(kcal > 0)) return setFoodMsg("Enter the calories.");
    try { await addMeal(s, { kcal, name: food.name.trim(), protein: isNaN(protein) ? null : protein }); setFood({ kcal: "", name: "", protein: "" }); setFoodMsg(""); bump(); }
    catch { setFoodMsg("Couldn’t save the meal. Food needs a connection."); }
  };
  const marked = (m) => (r.slotMarks || {})[m.slot.id];
  return (
    <Decree k="body" side={r.away ? "Away day · schedule paused" : wkPlanned ? `${wkDone} of ${wkPlanned} sessions this week` : "Training and diet"}>
      <Subhead className="mt-1">Today’s sessions</Subhead>
      {ms.length ? ms.map((m) => (
        <div key={m.slot.id} className="flex items-center gap-3 border-t py-3 first:border-t-0">
          <span className={cn("size-2.5 shrink-0 rounded-full", dot[m.status])} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{slotName(m.slot)} <span className="font-normal text-muted-foreground">{m.slot.start}–{m.slot.end}</span></div>
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">{status(m)}{m.source && !marked(m) && <Badge variant="muted" className="gap-1"><Watch />Watch</Badge>}</div>
          </div>
          {marked(m) ? <Button size="sm" variant="secondary" onClick={() => mark(m.slot.id, null)}>Undo</Button> : (
            <div className="flex gap-1.5">
              {m.status !== "done" && <Button size="sm" variant="secondary" onClick={() => mark(m.slot.id, "done", m.slot.sport)}>Done</Button>}
              {(m.status === "upcoming" || m.status === "missed") && <Button size="sm" variant="ghost" onClick={() => mark(m.slot.id, "skipped")}>Skip</Button>}
            </div>
          )}
        </div>
      )) : <Hint>{r.away ? "Away today: the schedule is paused." : hasSchedule() ? "Rest day. Nothing scheduled." : "No training schedule yet. Add your slots in the Diwan."}</Hint>}
      <Button variant="outline" className="mt-2 w-full" onClick={() => openSheet({ type: "slot", date: s })}><Plus />Add a session today</Button>

      <Subhead>Walking pad</Subhead>
      <Row label="Minutes walked" sub={r.walkMin && String(r.source || "").startsWith("Apple Health") ? "Logged by the watch or the Walking Pad shortcut" : "Logs itself with the Walking Pad shortcut"}><Stepper label="walking minutes" value={r.walkMin} step={10} onChange={(v) => set("walkMin", v)} /></Row>

      <Subhead>Food</Subhead>
      {meals.map((m) => (
        <div key={m.id} className="flex items-center gap-3 border-t py-2.5 first:border-t-0">
          <div className="min-w-0 flex-1"><span className="font-semibold tnum">{Math.round(m.kcal)} kcal</span> <span className="text-sm text-muted-foreground">{m.name || "Meal"} · {new Date(m.eaten_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}{m.protein ? ` · ${Math.round(m.protein)} g protein` : ""}</span></div>
          {m.exported_at ? <Badge variant="ok">In Health</Badge> : <Button size="icon-sm" variant="ghost" aria-label="Remove meal" onClick={async () => { await deleteMeal(s, m.id).catch(() => {}); bump(); }}><X /></Button>}
        </div>
      ))}
      <Input className="mt-2" placeholder="What did you eat?" value={food.name} onChange={(e) => setFood({ ...food, name: e.target.value })} />
      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
        <Input type="number" inputMode="numeric" placeholder="kcal" value={food.kcal} onChange={(e) => setFood({ ...food, kcal: e.target.value })} />
        <Input type="number" inputMode="numeric" placeholder="Protein (g)" value={food.protein} onChange={(e) => setFood({ ...food, protein: e.target.value })} />
        <Button size="icon" className="size-11" aria-label="Add meal" onClick={addFood}><Plus /></Button>
      </div>
      <Hint className="mt-2">{foodMsg || (eaten || burned ? `Eaten ${Math.round(eaten).toLocaleString("en")} · burned ${Math.round(burned).toLocaleString("en")} kcal${deficit != null ? ` · deficit ${Math.round(deficit).toLocaleString("en")} of ${S.settings.deficitMin}` : ""}${protein ? ` · ${Math.round(protein)} of ${S.settings.proteinTarget || 160} g protein` : ""}` : "Meals go to Apple Health with the nightly Shortcut.")}</Hint>
      <Row label="On my deficit target" className="mt-2 border-t">
        <Chip size="sm" on={r.diet === true} tone="ok" onClick={() => set("diet", r.diet === true ? null : true)}>Yes</Chip>
        <Chip size="sm" on={r.diet === false} tone="bad" onClick={() => set("diet", r.diet === false ? null : false)}>No</Chip>
      </Row>
      <Row label="Weight" sub={r.steps ? `${r.steps.toLocaleString("en")} steps today` : undefined}>
        <Input className="w-28 text-right" type="number" inputMode="decimal" step="0.1" placeholder="kg" defaultValue={r.weight ?? ""} key={"w" + s}
          onBlur={(e) => { const n = parseFloat(e.target.value); set("weight", isNaN(n) ? null : n); }} />
      </Row>
    </Decree>
  );
}

function PurityDecree({ s, r }) {
  const last = lastMastBefore(s), iv = intervalFor(s), viol = violation(s);
  const next = last ? addDays(last, iv) : null;
  const allow = !last || next <= s ? `Allowed today. Current spacing: every ${iv} days.` : `Next allowed ${fmt(next, { weekday: "short", day: "numeric", month: "short" })}. Current spacing: every ${iv} days.`;
  return (
    <Decree k="purity" side={r.pornFree === true ? (viol ? "Outside the schedule" : `Clean · ${streak(T.pure)}-day streak`) : r.pornFree === false ? "Slip logged" : "Not confirmed"}>
      <Row label="No porn today"><Chip size="sm" tone="ok" on={r.pornFree === true} onClick={() => set("pornFree", r.pornFree === true ? null : true)}>Confirmed</Chip><Chip size="sm" tone="bad" on={r.pornFree === false} onClick={() => set("pornFree", r.pornFree === false ? null : false)}>Slipped</Chip></Row>
      <Row label="Masturbation today"><Chip size="sm" on={r.mast === false} onClick={() => set("mast", r.mast === false ? null : false)}>No</Chip><Chip size="sm" tone={viol ? "bad" : "primary"} on={r.mast === true} onClick={() => set("mast", r.mast === true ? null : true)}>Yes</Chip></Row>
      <div className={cn("mt-2 rounded-xl px-3.5 py-2.5 text-[13px]", viol ? "bg-bad/10 text-bad" : "bg-muted/70 text-muted-foreground")}>{viol ? "This was inside the spacing window. Log the trigger and carry on: a slip is data, not defeat." : allow}</div>
      {(r.pornFree === false || viol) && <Input className="mt-3" key={"n" + s} defaultValue={r.note || ""} placeholder="What triggered it? e.g. 1am, bored, phone in bed" onBlur={(e) => set("note", e.target.value.trim())} />}
    </Decree>
  );
}

function HabitsDecree({ r }) {
  const tg = (k, l) => <Chip size="sm" on={!!r[k]} onClick={() => set(k, !r[k])}>{l}</Chip>;
  return (
    <Decree k="habits" side={`Window ${S.settings.bedtime} to ${S.settings.wake} · aim ${S.settings.sleepTarget} h`}>
      <Row label="Sleep">{tg("bed", "In bed by " + S.settings.bedtime)}{tg("wake", "Up for Fajr")}</Row>
      <Row label="Hours slept" sub={(r.sleepH || 0) >= S.settings.sleepTarget ? "Target met" : `Target ${S.settings.sleepTarget} h${String(r.source || "").startsWith("Apple Health") && r.sleepH != null ? " · from the watch" : ""}`}>
        <Input className="w-24 text-right" type="number" inputMode="decimal" step="0.25" placeholder="h" key={"sl" + S.selected} defaultValue={r.sleepH != null ? Math.round(r.sleepH * 100) / 100 : ""} onBlur={(e) => { const n = parseFloat(e.target.value); set("sleepH", isNaN(n) ? null : n); }} />
      </Row>
      <Row label="Morning">{tg("hair", "Hair")}{tg("skinAm", "Skin")}{tg("teethAm", "Teeth")}</Row>
      <Row label="Night">{tg("skinPm", "Skin")}{tg("teethPm", "Teeth")}</Row>
      <Row label="Tracking">{tg("watch", "Watch worn and charged")}</Row>
    </Decree>
  );
}

function ChecklistCard({ s, r }) {
  const c = checklistFor(s), [txt, setTxt] = useState("");
  const toggle = (id) => set("checks", { ...(r.checks || {}), [id]: !(r.checks || {})[id] });
  const add = () => { const t = txt.trim(); if (!t) return; set("extraTasks", [...(r.extraTasks || []), { id: "x" + Date.now().toString(36), text: t }]); setTxt(""); };
  return (
    <Card>
      <div className="flex items-center gap-3 px-5">
        <Emblem k="president" size={42} />
        <div className="min-w-0 flex-1"><Ar className="block text-[19px] leading-tight">قائمة الإنجاز</Ar><div className="text-[13px] text-muted-foreground">Daily checklist · {c.done} of {c.total}</div></div>
        <Ring value={c.frac || 0} color="var(--gold)" size={46} label="Productivity today" />
      </div>
      <CardContent>
        {c.items.map((x) => (
          <label key={x.id} className="flex items-center gap-3 border-t py-3 first:border-t-0">
            <Checkbox checked={!!c.checks[x.id]} onCheckedChange={() => toggle(x.id)} />
            <span className={cn("flex-1 text-[15px]", c.checks[x.id] && "text-muted-foreground line-through")}>{x.text}</span>
            {(r.extraTasks || []).some((t) => t.id === x.id) && <button aria-label="Remove task" className="text-muted-foreground" onClick={(e) => { e.preventDefault(); set("extraTasks", r.extraTasks.filter((t) => t.id !== x.id)); }}><X className="size-4" /></button>}
          </label>
        ))}
        <div className="mt-2 flex gap-2"><Input placeholder="Add a task for today only" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /><Button size="icon" className="size-11 shrink-0" aria-label="Add task" onClick={add}><Plus /></Button></div>
        <Hint className="mt-2">Productivity counts up to 20 XP a day. Edit the standing list in the Diwan.</Hint>
      </CardContent>
    </Card>
  );
}

function VitalityCard({ s }) {
  const v = vitalityFor(s), away = (S.days[s] || {}).away;
  return (
    <Card>
      <div className="flex items-center gap-3 px-5">
        <Emblem k="body" size={42} />
        <div className="min-w-0 flex-1"><Ar className="block text-[19px] leading-tight">الحيوية</Ar><div className="text-[13px] text-muted-foreground">{v.seen ? `Vitality · ${v.hits} of ${v.total}${away ? " · floor goals" : ""}` : "Vitality · waiting for the watch"}</div></div>
        <Ring value={v.frac || 0} color="var(--m-body)" size={46} label="Vitality today" />
      </div>
      <CardContent>
        <div className="grid grid-cols-5 gap-1">
          {v.items.map((x) => (
            <div key={x.k} className="flex flex-col items-center gap-1 text-center">
              <Ring value={x.frac} color={x.hit ? "var(--ok)" : "var(--m-body)"} size={48} stroke={5} label={x.en} />
              <div className={cn("text-[15px] font-bold tnum", x.hit && "text-ok")}>{x.val == null ? "—" : x.fmt(x.val)}</div>
              <div className="text-[10.5px] leading-tight text-muted-foreground">{x.en}<br />{x.goal.toLocaleString("en")}{x.unit ? " " + x.unit : ""}</div>
            </div>
          ))}
        </div>
        <Hint className="mt-3">Filled by the watch. Each vital kept is worth {VITALITY_XP / VITALS.length} XP on days you log; 4 of 5 for 7 days wins the Vitality medal.</Hint>
      </CardContent>
    </Card>
  );
}
