// Every bottom sheet in the app: one controlled M3 bottom sheet, its content picked by S.sheet.type.
import { useEffect, useState } from "react";
import { S, MINISTERS, SPORTS, today, rankFor, RANKS, streak, bestStreak, T, verdict, currentApproval, hmMin, minHM, levelStart } from "@/lib/logic.js";
import { saveSettings, loadMetricSeries } from "@/lib/store.js";
import { go, allTotals, allMedals, openSheet, closeSheet } from "@/lib/app-state.js";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ar, Emblem, Ring, Hint, Subhead, Stat, Seal, MIN, mColor, mContainer, medalKind, fmtN, fmtMin, pctTxt, SHORT } from "./kit";
import { Icon, Shape, Button, IconButton, Chip, Connected, Progress } from "@/components/m3/index.jsx";
import { TrendChart } from "./charts";
import { WeekSheet } from "./report";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export { openSheet, closeSheet };

export default function Sheets() {
  const sh = S.sheet;
  return (
    <Drawer open={!!sh} onOpenChange={(o) => { if (!o) closeSheet(); }}>
      <DrawerContent>
        {sh?.type === "minister" && <MinisterSheet k={sh.key} />}
        {sh?.type === "medal" && <MedalSheet id={sh.id} />}
        {sh?.type === "slot" && <SlotSheet pre={sh} />}
        {sh?.type === "metric" && <MetricSheet m={sh.meta} r={sh.row} fmtVal={sh.fmtVal} />}
        {sh?.type === "week" && <WeekSheet start={sh.start} />}
      </DrawerContent>
    </Drawer>
  );
}

const M = Object.fromEntries(MINISTERS.map((m) => [m.key, m]));

function MinisterSheet({ k }) {
  const { r, period } = currentApproval();
  if (k === "president") {
    const t = allTotals(), rank = rankFor(t.level);
    return (
      <>
        <DrawerHeader className="flex-row items-center gap-4"><Seal level={t.level} size={64} /><div><Ar className="block text-left text-[26px] leading-tight text-tertiary">الرئيس المُستنير</Ar><DrawerTitle>The President</DrawerTitle></div></DrawerHeader>
        <p className="type-body-l">Level {t.level}, {rank.en}. {t.logged} days logged, {t.perfect} perfect.</p>
        <div className="my-4 flex flex-col gap-2">
          {RANKS.map((rk) => (
            <div key={rk.from} className={cn("flex items-center justify-between rounded-[20px] px-4 py-3", t.level >= rk.from ? "bg-tertiary-container text-on-tertiary-container" : "bg-surface-container-high")}>
              <Ar className={cn("text-lg", t.level >= rk.from ? "" : "text-on-surface-variant")}>{rk.ar}</Ar><span className="type-body-m">{rk.en} · level {rk.from}</span>
            </div>
          ))}
        </div>
        <Hint className="pb-6">Every minister earns up to 20 XP a day; a perfect day adds 25, the checklist and the vitals up to 20 each, and a day with no masturbation and no porn adds 10.</Hint>
      </>
    );
  }
  const m = M[k], v = r ? r[k] : null, [cls, txt] = verdict(v, m.immune);
  const detail = r ? {
    body: `Training ${pctTxt(r.training)} (${r.sessions} of ${Math.round(r.planned * 10) / 10} sessions${r.plannedMin ? `, ${fmtMin(r.trainMin)} of ${fmtMin(r.plannedMin)}` : ""}), diet on target ${pctTxt(r.diet)} of days.`,
    faith: "Average share of the five prayers kept; a made-up prayer counts half.",
    knowledge: `Days at ${S.settings.pagesPerDay} pages or more.`,
    purity: `Porn-free ${pctTxt(r.porn)} of days, masturbation-free ${pctTxt(r.plan)}. Every day starts clean; a logged slip of porn costs 15 of the 20, masturbation 5.`,
    habits: "WHOOP’s sleep score pays half, in whole points of its 10 XP (75% earns 8); the five routines and wearing the watch share the other 10.",
  }[k] : "No days in this council period yet.";
  const st = { faith: ["All five prayers", T.prayers], knowledge: ["Reading", T.read], purity: ["Porn-free", T.pure] }[k];
  return (
    <>
      <DrawerHeader className="flex-row items-center gap-4"><Emblem k={k} size={64} /><div className="min-w-0"><Ar className="block text-left text-[26px] leading-tight" style={{ color: mColor(k) }}>{m.ar}</Ar><DrawerTitle className="type-title-l">{m.en}</DrawerTitle><DrawerDescription>{m.agenda}</DrawerDescription></div></DrawerHeader>
      <div className="flex items-center gap-4 rounded-[24px] p-4" style={{ background: mContainer(k) }}>
        <Ring value={v || 0} color={mColor(k)} size={80} stroke={8} wavy label="Approval"><span className="type-title-m em">{pctTxt(v)}</span></Ring>
        <div><div className={cn("type-title-m em", cls === "bad" && "text-error")}>{txt}</div><div className="type-body-m opacity-80">{period ? `${period.label} of the term` : "Last 30 days"}</div></div>
      </div>
      <p className="mt-4 type-body-l">{detail}</p>
      {st && <p className="mt-2 type-body-l">{st[0]} streak: <b>{streak(st[1])}</b> days now, best <b>{bestStreak(st[1])}</b>.</p>}
      {k === "purity" && <p className="mt-1 type-body-l">Abstinence streak (no masturbation, no porn): <b>{streak(T.abstain)}</b> days now, best <b>{bestStreak(T.abstain)}</b>. Each one is +10 XP.</p>}
      <Hint className="mt-3">{m.immune ? "The prayer is the foundation: this minister can never be impeached." : `Below ${S.settings.threshold}% at a council review, the strategy is impeached and replaced. The agenda stays.`}</Hint>
      <Button size="m" className="my-6 w-full" icon="swords" onClick={() => { closeSheet(); go("today"); }}>Open today’s quests</Button>
    </>
  );
}

function MedalSheet({ id }) {
  const m = allMedals().find((x) => x.id === id);
  if (!m) return null;
  const k = medalKind(id), sh = MIN[k];
  return (
    <div className="flex flex-col items-center pb-6 text-center">
      <div className="relative mt-2">
        {m.won && <Shape name="burst" size={150} spin color={`color-mix(in srgb, ${mColor(k)} 22%, transparent)`} className="absolute -inset-[23px]" />}
        {m.won
          ? <Shape name={sh.shape} rot={sh.rot || 0} size={104} color={mColor(k)} className="pop"><Icon name={sh.icon} fill size={46} style={{ color: "var(--md-sys-color-surface)" }} /></Shape>
          : <Ring value={m.frac} size={104} stroke={6} wavy color={mColor(k)}><Shape name={sh.shape} rot={sh.rot || 0} size={76} color="var(--md-sys-color-surface-container-highest)"><Icon name="lock" size={30} className="text-on-surface-variant" /></Shape></Ring>}
      </div>
      <Ar className="mt-5 text-[26px] leading-tight text-tertiary">{m.ar}</Ar>
      <DrawerTitle className="mt-1">{m.en}</DrawerTitle>
      <DrawerDescription className="mt-1 max-w-[280px]">{m.how}</DrawerDescription>
      <div className={cn("mt-5 w-full rounded-[24px] p-4", m.won ? "bg-tertiary-container text-on-tertiary-container" : "bg-surface-container-high")}>
        {m.won ? <div className="flex items-center justify-center gap-2 type-title-m em"><Icon name="military_tech" fill size={22} />Won</div> : (
          <>
            <div className="flex items-baseline justify-between type-label-l"><span>Progress</span><span className="em tnum">{m.down ? `${fmtN(m.cur)} → ${m.goal} kg` : `${fmtN(m.cur)} / ${fmtN(m.goal)}`}</span></div>
            <Progress value={m.frac} wavy color={mColor(k)} className="mt-2" />
            <div className="mt-2 type-body-m text-on-surface-variant">{Math.round(m.frac * 100)}% of the way there</div>
          </>
        )}
      </div>
    </div>
  );
}

const DAYS = [["SAT", "Sat"], ["SUN", "Sun"], ["MON", "Mon"], ["TUE", "Tue"], ["WED", "Wed"], ["THU", "Thu"], ["FRI", "Fri"]];
const DAY_NAME = { SAT: "Saturday", SUN: "Sunday", MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday" };
const SPORT_ICON = { gym: "fitness_center", tennis: "sports_tennis", mma: "sports_mma", swim: "pool", run: "directions_run", walk: "directions_walk", other: "exercise" };
const plus = (t, m) => { const x = hmMin(t); return x == null ? t : minHM(x + m); };
// One sport on the chosen days, with as many sessions a day as you train: two tennis sessions on Saturday are one sheet.
function SlotSheet({ pre }) {
  const [st, setSt] = useState({ sport: pre.sport || "gym", label: "", mode: pre.date ? "once" : "weekly", days: pre.day ? [pre.day] : [], date: pre.date || today() });
  const [times, setTimes] = useState([{ start: "19:00", end: "20:30" }]);
  const [msg, setMsg] = useState("");
  const up = (p) => setSt((x) => ({ ...x, ...p }));
  const setTime = (i, p) => { setMsg(""); setTimes((ts) => ts.map((t, j) => (j === i ? { ...t, ...p } : t))); };
  const another = () => setTimes((ts) => { const last = ts[ts.length - 1]; const s0 = plus(last.end, 60); return [...ts, { start: s0, end: plus(s0, 90) }]; });
  const save = () => {
    if (st.mode === "weekly" && !st.days.length) return setMsg("Pick at least one day.");
    if (times.some((t) => hmMin(t.start) == null || hmMin(t.end) == null || hmMin(t.end) === hmMin(t.start))) return setMsg("Each session needs a start and an end time.");
    // A session over four hours is almost always a slip of the clock (07:00–20:30 for 07:00–08:30), and WHOOP would need half of it.
    const long = times.map((t) => (hmMin(t.end) - hmMin(t.start) + 1440) % 1440).find((m) => m > 240);
    if (long && !msg.startsWith("That session")) return setMsg(`That session runs ${Math.floor(long / 60)}h ${long % 60}m, and the watch needs half of it to count. Check the end time, or tap again to keep it.`);
    const base = Date.now();
    const slots = times.map((t, i) => ({ id: st.sport + "-" + (base + i).toString(36), sport: st.sport, start: t.start, end: t.end, ...(st.sport === "other" && st.label.trim() ? { label: st.label.trim() } : {}) }));
    const days = DAYS.map((d) => d[0]).filter((d) => st.days.includes(d));
    if (st.mode === "weekly") S.settings.training = [...(S.settings.training || []), ...slots.map((x) => ({ ...x, days }))];
    else S.settings.trainingOnce = [...(S.settings.trainingOnce || []), ...slots.map((x) => ({ ...x, date: st.date }))];
    saveSettings(); closeSheet();
    const name = st.sport === "other" && st.label.trim() ? st.label.trim() : (SPORTS[st.sport] || SPORTS.other).en;
    const when = st.mode === "weekly" ? days.map((d) => DAY_NAME[d]).join(", ") : st.date;
    toast.success(`${name} · ${when}`, { description: times.map((t) => `${t.start}–${t.end}`).join(" and ") + (times.length > 1 ? " · both on your schedule" : " · on your schedule") });
  };
  return (
    <>
      <DrawerHeader><DrawerTitle>Add training</DrawerTitle><DrawerDescription>Checked by the watch, shown in Apple Calendar, reminded 30 minutes before.</DrawerDescription></DrawerHeader>
      <Subhead className="mt-0">Sport</Subhead>
      <div className="flex flex-wrap gap-2">{Object.entries(SPORTS).map(([k, v]) => <Chip key={k} selected={st.sport === k} icon={SPORT_ICON[k]} onClick={() => up({ sport: k })}>{v.chip || v.en}</Chip>)}</div>
      {st.sport === "other" && <Input className="mt-3" placeholder="Name, e.g. Yoga" value={st.label} onChange={(e) => up({ label: e.target.value })} />}
      <Subhead>Repeats</Subhead>
      <Connected value={st.mode} onChange={(v) => up({ mode: v })} options={[{ value: "weekly", label: "Every week", icon: "repeat" }, { value: "once", label: "One date", icon: "event" }]} label="Repeats" />
      <div className="mt-3">
        {st.mode === "weekly"
          ? <div className="flex flex-wrap gap-2">{DAYS.map(([k, l]) => <Chip key={k} selected={st.days.includes(k)} onClick={() => up({ days: st.days.includes(k) ? st.days.filter((x) => x !== k) : [...st.days, k] })}>{l}</Chip>)}</div>
          : <div className="grid gap-1.5"><Label htmlFor="sl-date">Date</Label><Input id="sl-date" type="date" value={st.date} onChange={(e) => up({ date: e.target.value })} /></div>}
      </div>
      <Subhead>{times.length > 1 ? `${times.length} sessions a day` : "Time"}</Subhead>
      <div className="flex flex-col gap-2.5">
        {times.map((t, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
            <div className="grid min-w-0 gap-1.5"><Label htmlFor={`sl-s${i}`} className={cn(i && "sr-only")}>Starts</Label><Input id={`sl-s${i}`} type="time" value={t.start} onChange={(e) => setTime(i, { start: e.target.value })} /></div>
            <div className="grid min-w-0 gap-1.5"><Label htmlFor={`sl-e${i}`} className={cn(i && "sr-only")}>Ends</Label><Input id={`sl-e${i}`} type="time" value={t.end} onChange={(e) => setTime(i, { end: e.target.value })} /></div>
            {times.length > 1
              ? <IconButton icon="close" label={`Remove session ${i + 1}`} className="mb-1" onClick={() => setTimes((ts) => ts.filter((_, j) => j !== i))} />
              : <span className="w-10" />}
          </div>
        ))}
      </div>
      <Button variant="tonal" icon="add" className="mt-3 w-full" onClick={another}>Add another time</Button>
      {msg && <p className="mt-3 type-body-m text-error" role="alert">{msg}</p>}
      <Button size="m" className="my-6 w-full" onClick={save}>{times.length > 1 ? `Add ${times.length} sessions` : "Add to schedule"}</Button>
    </>
  );
}

function MetricSheet({ m, r, fmtVal }) {
  const [pts, setPts] = useState(null), [err, setErr] = useState(false);
  useEffect(() => { loadMetricSeries(m.key).then(setPts).catch(() => setErr(true)); }, [m.key]);
  const hours = m.unit === "min" && /^sleep/.test(m.key);
  const p = pts ? (hours ? pts.map(([d, v]) => [d, v / 60]) : pts) : null;
  const fd = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", SHORT);
  return (
    <>
      <DrawerHeader><DrawerTitle>{m.label}</DrawerTitle><DrawerDescription>{r.days.toLocaleString("en")} days recorded since {fd(r.first_day)}</DrawerDescription></DrawerHeader>
      {err ? <Hint>Couldn’t load this measure.</Hint> : !p ? <Hint>Loading…</Hint> :
        <TrendChart points={p} unit={hours ? "h" : m.unit} digits={Math.abs(p.at(-1)?.[1] || 0) >= 100 ? 0 : 1} color="var(--m-knowledge)" smooth={p.length > 60 ? 7 : 1} height={200} />}
      <div className="mt-4 mb-6 grid grid-cols-2 gap-2">
        <Stat value={fmtVal(r.latest, m.unit, m.key)} label={`latest · ${fd(r.latest_day)}`} />
        <Stat value={fmtVal(r.avg30, m.unit, m.key)} label="30-day average" />
        <Stat value={fmtVal(r.prev30, m.unit, m.key)} label="the 30 days before" />
        <Stat value={fmtVal(r.avg365, m.unit, m.key)} label="1-year average" />
      </div>
    </>
  );
}
