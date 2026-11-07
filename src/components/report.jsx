// The weekly report, in a bottom sheet: the week just ended (Sunday to Saturday), step back through earlier ones.
// The numbers come from src/lib/week.js; protein is fetched from FatSecret's meals for the week shown.
import { useEffect, useState } from "react";
import { S, MINISTERS, WEIGH_IN_XP, addDays, fmt } from "@/lib/logic.js";
import { weekReport, lastWeek, weekEnd, firstTracked } from "@/lib/week.js";
import { loadProtein } from "@/lib/store.js";
import { openSheet } from "@/lib/app-state.js";
import { DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Hint, Subhead, Stat, MIN, mColor, mContainer, pctTxt } from "./kit";
import { Icon, Shape, IconButton, Progress } from "@/components/m3/index.jsx";
import { DayBars } from "./charts";
import { cn } from "@/lib/utils";

const n0 = (x) => (x == null ? "—" : Math.round(x).toLocaleString("en"));
const n1 = (x) => (x == null ? "—" : (Math.round(x * 10) / 10).toFixed(1));
const signed = (x, unit = "") => (x == null ? "" : `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x)}${unit}`);
const short = (s) => fmt(s, { day: "numeric", month: "short" });

export function WeekSheet({ start: asked }) {
  const last = lastWeek(), start = asked || last, first = firstTracked();
  const [protein, setProtein] = useState({});
  useEffect(() => { setProtein({}); loadProtein(start, weekEnd(start)).then(setProtein).catch(() => {}); }, [start]);
  const r = weekReport(start, { protein }), s = r.sum, p = r.prev, line = S.settings.threshold;
  const go = (n) => openSheet({ type: "week", start: addDays(start, 7 * n) });
  return (
    <>
      <DrawerHeader className="flex-row items-center gap-2">
        <IconButton icon="chevron_left" label="The week before" onClick={() => go(-1)} disabled={!first || addDays(start, -1) < first} />
        <div className="min-w-0 flex-1 text-center">
          <p className="type-label-l text-on-surface-variant">{r.inTerm ? `Week ${r.week} of term ${r.term.n} · ${r.term.name}` : "Before the term"}</p>
          <DrawerTitle>{r.label}</DrawerTitle>
          <DrawerDescription className="sr-only">The weekly report, Sunday to Saturday.</DrawerDescription>
        </div>
        <IconButton icon="chevron_right" label="The week after" onClick={() => go(1)} disabled={start >= last} />
      </DrawerHeader>

      {!s.logged && !s.sleepDays ? <Hint className="pb-8 text-center">Nothing was recorded this week.</Hint> : (
        <div className="flex flex-col gap-2 pb-8">
          <div className="flex items-end gap-3">
            <span className="type-display-m em-x tnum leading-none text-primary">{r.inTerm ? n0(s.xp) : pctTxt(r.score.overall)}</span>
            <span className="pb-1 type-body-m text-on-surface-variant">{r.inTerm ? `XP · level ${r.level.level}, ${r.level.rank.en} · approval ${pctTxt(r.score.overall)}` : "approval · no XP before the term"}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat value={`${s.clean} of ${s.days}`} label={`days clean${p.tracked ? ` · ${p.sum.clean} the week before` : ""}`} tone={s.slips.length ? "warn" : "ok"} />
            <Stat value={s.night == null ? "—" : `${n1(s.night)} h`} label={`night sleep${s.nap ? ` · +${n0(s.nap)} min naps` : ""}`} />
            <Stat value={`${s.fajr} of ${s.fajrDays || s.days}`} label="up for Fajr" />
            <Stat value={`${s.sessions}`} label={r.score.planned ? `sessions · ${r.score.sessions} of ${Math.round(r.score.planned)} slots met` : "training sessions"} />
            <Stat value={s.foodDays ? n0(s.deficit) : "—"} label={s.foodDays ? `kcal deficit · ${s.dietDays} of ${s.foodDays} days at ${n0(S.settings.deficitMin)}+` : "kcal deficit · no meals logged"} />
            <Stat value={s.proteinDays ? `${n0(s.protein)} g` : "—"} label={s.proteinDays ? `protein · ${s.proteinMet} of ${s.proteinDays} days at ${S.settings.proteinTarget} g` : "protein"} />
            <Stat value={s.weightLast == null ? "—" : `${n1(s.weightLast)} kg`} label={s.weightChange != null ? `${signed(s.weightChange, " kg")} this week` : "weight"} />
            <Stat value={r.weighIn?.won ? `+${WEIGH_IN_XP} XP` : r.weighIn?.drop != null ? signed(-r.weighIn.drop, " kg") : "—"} label={`Sunday weigh-in, ${short(addDays(r.end, 1))}`} tone={r.weighIn?.won ? "ok" : undefined} />
          </div>

          <Subhead>The cabinet</Subhead>
          <div className="flex flex-col gap-2">
            {MINISTERS.map((m) => {
              const v = r.score[m.key], b = p.tracked ? p.score[m.key] : null, d = b == null ? null : Math.round((v - b) * 100);
              return (
                <div key={m.key} className="flex items-center gap-3">
                  <Shape name={MIN[m.key].shape} rot={MIN[m.key].rot || 0} size={32} color={mContainer(m.key)}><Icon name={MIN[m.key].icon} fill size={16} style={{ color: mColor(m.key) }} /></Shape>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 type-label-l">
                      <span>{m.en.replace("Minister of ", "")}</span>
                      <span className="tnum"><span className={cn("em", v * 100 < line && !m.immune && "text-error")}>{pctTxt(v)}</span>
                        {d != null && <span className={cn("ml-1.5 type-label-m", d > 0 ? "text-success" : d < 0 ? "text-error" : "text-on-surface-variant")}>{signed(d)}</span>}</span>
                    </div>
                    <div className="relative mt-1">
                      <Progress value={v} color={mColor(m.key)} stop={false} />
                      <span className="absolute -top-1 h-3 w-0.5 rounded-full bg-on-surface" style={{ left: `${line}%` }} aria-hidden />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Hint className="mt-1">The mark is the impeachment line ({line}%). {p.tracked ? `Changes are against ${p.label}.` : ""}</Hint>

          {r.findings.length > 0 && <>
            <Subhead>What the week says</Subhead>
            <div className="flex flex-col gap-2">
              {r.findings.map((f) => (
                <div key={f.key} className="flex gap-3 rounded-[20px] bg-surface-container-high p-3">
                  <Shape name={f.tone === "good" ? "cookie9" : "cookie4"} size={36} color={f.tone === "good" ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-tertiary-container)"}>
                    <Icon name={f.icon} fill size={18} className={f.tone === "good" ? "text-on-primary-container" : "text-on-tertiary-container"} />
                  </Shape>
                  <div className="min-w-0"><div className="type-title-s em">{f.title}</div><p className="mt-0.5 type-body-m text-on-surface-variant">{f.text}</p></div>
                </div>
              ))}
            </div>
          </>}

          <Subhead>Day by day</Subhead>
          <div className="flex flex-col">
            {r.days.map((d) => {
              const pr = d.prayers.on + d.prayers.late / 2;
              return (
                <div key={d.date} className={cn("grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 border-b border-outline-variant py-2.5 last:border-0", !d.office && "opacity-70")}>
                  <div><div className="type-label-l em">{fmt(d.date, { weekday: "short" })}</div><div className="type-body-s text-on-surface-variant tnum">{short(d.date)}</div></div>
                  <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 type-body-s text-on-surface-variant tnum">
                    {d.rest && <span className="inline-flex items-center gap-1 text-primary"><Icon name="weekend" fill size={16} />Rest day</span>}
                    <span className="inline-flex items-center gap-1"><Icon name="mosque" size={16} />{d.prayers.logged ? `${pr} of 5` : d.office ? "not logged" : "—"}</span>
                    <span className="inline-flex items-center gap-1"><Icon name="bedtime" size={16} />{d.night == null ? "—" : `${n1(d.night)} h`}{d.nap ? ` +${d.nap}m` : ""}{d.bed ? ` · ${d.bed}` : ""}</span>
                    {d.fajr != null && <span className={cn("inline-flex items-center gap-1", d.fajr && "text-primary")}><Icon name="wb_twilight" fill={d.fajr} size={16} />{d.fajr ? "Fajr" : "no Fajr"}</span>}
                    {d.deficit != null && <span className="inline-flex items-center gap-1"><Icon name="nutrition" size={16} />{n0(d.deficit)}{d.protein != null ? ` · ${n0(d.protein)} g` : ""}</span>}
                    {d.did.length > 0 && <span className="inline-flex items-center gap-1"><Icon name="fitness_center" size={16} />{d.did.map((k) => ({ gym: "Gym", tennis: "Tennis", mma: "MMA", swim: "Swim", run: "Run", other: "Training" })[k] || k).join(" · ")}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {d.xp != null && <span className="type-label-l em tnum">{d.xp}</span>}
                    <Icon name="shield" fill size={18} className={d.slip ? "text-error" : "text-success"} label={d.slip ? "Slip" : "Clean"} />
                  </div>
                </div>
              );
            })}
          </div>

          <Subhead>Sleep</Subhead>
          <DayBars label="Night sleep and naps by day" digits={1} target={S.settings.sleepTarget || 7}
            parts={[{ color: "var(--m-habits)" }, { color: "var(--m-habits)", opacity: 0.4 }]}
            days={r.days.map((d) => ({ key: d.date, label: fmt(d.date, { weekday: "narrow" }), values: d.night == null ? [null] : [d.night, (d.nap || 0) / 60] }))} />
          <Hint>Night sleep, with naps lighter on top. The line is your {S.settings.sleepTarget || 7} h target.</Hint>

          {s.foodDays > 0 && <>
            <Subhead>Deficit</Subhead>
            <DayBars label="Deficit by day" target={S.settings.deficitMin || 700} parts={[{ color: "var(--ok)" }]}
              days={r.days.map((d) => ({ key: d.date, label: fmt(d.date, { weekday: "narrow" }), values: [d.deficit], dim: d.deficit != null && d.deficit < (S.settings.deficitMin || 700) }))} />
            <Hint>WHOOP’s energy burned less what FatSecret logged. Days under the line are faded.</Hint>
          </>}

          {r.since.from && <>
            <Subhead>Since tracking began, {fmt(r.since.from, { day: "numeric", month: "long" })}</Subhead>
            <div className="grid grid-cols-2 gap-2">
              <Stat value={`${r.since.clean} of ${r.since.days}`} label={`days clean · best run ${r.since.bestClean.n}`} />
              <Stat value={r.since.night == null ? "—" : `${n1(r.since.night)} h`} label="night sleep" />
              <Stat value={`${r.since.fajr} of ${r.since.fajrDays}`} label="up for Fajr" />
              <Stat value={n0(r.since.steps)} label="steps a day" />
              <Stat value={r.since.recovery == null ? "—" : `${n0(r.since.recovery)}%`} label="recovery" />
              <Stat value={n0(r.since.exercise)} label="exercise min a day" />
            </div>
          </>}
          <Hint className="mt-3">A new report comes out every Sunday, for the week that just ended.</Hint>
        </div>
      )}
    </>
  );
}
