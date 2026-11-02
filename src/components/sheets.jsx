// Every bottom sheet in the app: one controlled drawer, its content picked by S.sheet.type.
import { useEffect, useState } from "react";
import { S, MINISTERS, SPORTS, today, rankFor, streak, bestStreak, T, verdict, currentApproval, hmMin, minHM } from "@/lib/logic.js";
import { saveSettings, loadMetricSeries } from "@/lib/store.js";
import { bump, go, allTotals } from "@/lib/app-state.js";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Ar, Emblem, Ring, Chip, Hint, Subhead, Stat, fmtMin, pctTxt, SHORT } from "./kit";
import { TrendChart } from "./charts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

export function openSheet(sheet) { S.sheet = sheet; bump(); }
export function closeSheet() { S.sheet = null; bump(); }

export function Sheets() {
  const sh = S.sheet;
  return (
    <Drawer open={!!sh} onOpenChange={(o) => { if (!o) closeSheet(); }}>
      <DrawerContent>
        {sh?.type === "minister" && <MinisterSheet k={sh.key} />}
        {sh?.type === "slot" && <SlotSheet pre={sh} />}
        {sh?.type === "metric" && <MetricSheet m={sh.meta} r={sh.row} fmtVal={sh.fmtVal} />}
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
        <DrawerHeader className="flex-row items-center gap-3"><Emblem k="president" size={48} /><div><Ar className="block text-left text-2xl leading-tight text-gold">الرئيس المُستنير</Ar><DrawerTitle className="text-base font-medium text-muted-foreground">The President</DrawerTitle></div></DrawerHeader>
        <p className="text-[15px]">Level {t.level}, {rank.en}. {t.logged} days logged, {t.perfect} perfect.</p>
        <div className="my-4 flex flex-col gap-2">
          {[1, 3, 6, 9, 12].map((L) => { const rk = rankFor(L); return (
            <div key={L} className={cn("flex items-center justify-between rounded-2xl px-4 py-3", t.level >= L ? "bg-gold-soft" : "bg-muted/60")}>
              <Ar className={cn("text-lg", t.level >= L ? "text-gold" : "text-muted-foreground")}>{rk.ar}</Ar><span className="text-sm text-muted-foreground">{rk.en} · level {L}</span>
            </div>); })}
        </div>
        <Hint className="pb-4">Every minister earns up to 20 XP a day; a perfect day adds 25, the checklist and the vitals up to 20 each, and a day with no masturbation and no porn adds 10.</Hint>
      </>
    );
  }
  const m = M[k], v = r ? r[k] : null, [cls, txt] = verdict(v, m.immune);
  const detail = r ? {
    body: `Training ${pctTxt(r.training)} (${r.sessions} of ${Math.round(r.planned * 10) / 10} sessions${r.plannedMin ? `, ${fmtMin(r.trainMin)} of ${fmtMin(r.plannedMin)}` : ""}), diet on target ${pctTxt(r.diet)} of days.`,
    faith: "Average share of the five prayers kept; a made-up prayer counts half.",
    knowledge: `Days at ${S.settings.pagesPerDay} pages or more.`,
    purity: `Porn-free ${pctTxt(r.porn)} of days, masturbation-free ${pctTxt(r.plan)}. Every day starts clean; only a logged slip counts against it.`,
    habits: "Up for Fajr and seven hours asleep count double; bedtime, routines and the watch once each.",
  }[k] : "No days in this council period yet.";
  const st = { faith: ["All five prayers", T.prayers], knowledge: ["Reading", T.read], purity: ["Porn-free", T.pure], habits: ["Up for Fajr", T.fajr] }[k];
  return (
    <>
      <DrawerHeader className="flex-row items-center gap-3"><Emblem k={k} size={48} /><div className="min-w-0"><Ar className="block text-left text-2xl leading-tight">{m.ar}</Ar><DrawerTitle className="text-base font-medium text-muted-foreground">{m.en} · {m.agenda}</DrawerTitle></div></DrawerHeader>
      <div className="flex items-center gap-4 rounded-2xl bg-muted/60 p-4">
        <Ring value={v || 0} color={`var(--m-${k})`} size={72} stroke={7} label="Approval"><span className="text-base">{pctTxt(v)}</span></Ring>
        <div><div className={cn("font-semibold", cls === "ok" && "text-ok", cls === "warn" && "text-warn", cls === "bad" && "text-bad")}>{txt}</div><Hint>{period ? `${period.label} of the term` : "Last 30 days"}</Hint></div>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed">{detail}</p>
      {st && <p className="mt-2 text-[15px]">{st[0]} streak: <b>{streak(st[1])}</b> days now, best <b>{bestStreak(st[1])}</b>.</p>}
      {k === "purity" && <p className="mt-1 text-[15px]">Abstinence streak (no masturbation, no porn): <b>{streak(T.abstain)}</b> days now, best <b>{bestStreak(T.abstain)}</b>. Each one is +10 XP.</p>}
      <Hint className="mt-3">{m.immune ? "The prayer is the foundation: this minister can never be impeached." : `Below ${S.settings.threshold}% at a council review, the strategy is impeached and replaced. The agenda stays.`}</Hint>
      <Button className="my-5 w-full" size="lg" onClick={() => { closeSheet(); go("today"); }}>Open today</Button>
    </>
  );
}

const DAYS = [["SAT", "Sat"], ["SUN", "Sun"], ["MON", "Mon"], ["TUE", "Tue"], ["WED", "Wed"], ["THU", "Thu"], ["FRI", "Fri"]];
const DAY_NAME = { SAT: "Saturday", SUN: "Sunday", MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday" };
const plus = (t, m) => { const x = hmMin(t); return x == null ? t : minHM(x + m); };
// One sport on the chosen days, with as many sessions a day as you train: two tennis sessions on Saturday are one sheet.
function SlotSheet({ pre }) {
  const [st, setSt] = useState({ sport: pre.sport || "gym", label: "", mode: pre.date ? "once" : "weekly", days: pre.day ? [pre.day] : [], date: pre.date || today() });
  const [times, setTimes] = useState([{ start: "19:00", end: "20:30" }]);
  const [msg, setMsg] = useState("");
  const up = (p) => setSt((x) => ({ ...x, ...p }));
  const setTime = (i, p) => setTimes((ts) => ts.map((t, j) => (j === i ? { ...t, ...p } : t)));
  const another = () => setTimes((ts) => { const last = ts[ts.length - 1]; const s0 = plus(last.end, 60); return [...ts, { start: s0, end: plus(s0, 90) }]; });
  const save = () => {
    if (st.mode === "weekly" && !st.days.length) return setMsg("Pick at least one day.");
    if (times.some((t) => hmMin(t.start) == null || hmMin(t.end) == null || hmMin(t.end) === hmMin(t.start))) return setMsg("Each session needs a start and an end time.");
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
      <div className="flex flex-wrap gap-2">{Object.entries(SPORTS).map(([k, v]) => <Chip key={k} on={st.sport === k} onClick={() => up({ sport: k })}>{v.chip || v.en}</Chip>)}</div>
      {st.sport === "other" && <Input className="mt-3" placeholder="Name, e.g. Yoga" value={st.label} onChange={(e) => up({ label: e.target.value })} />}
      <Subhead>Repeats</Subhead>
      <ToggleGroup type="single" value={st.mode} onValueChange={(v) => v && up({ mode: v })}><ToggleGroupItem value="weekly">Every week</ToggleGroupItem><ToggleGroupItem value="once">One date</ToggleGroupItem></ToggleGroup>
      <div className="mt-3">
        {st.mode === "weekly"
          ? <div className="flex flex-wrap gap-2">{DAYS.map(([k, l]) => <Chip key={k} size="sm" on={st.days.includes(k)} onClick={() => up({ days: st.days.includes(k) ? st.days.filter((x) => x !== k) : [...st.days, k] })}>{l}</Chip>)}</div>
          : <div className="grid gap-1.5"><Label htmlFor="sl-date">Date</Label><Input id="sl-date" type="date" value={st.date} onChange={(e) => up({ date: e.target.value })} /></div>}
      </div>
      <Subhead>{times.length > 1 ? `${times.length} sessions a day` : "Time"}</Subhead>
      <div className="flex flex-col gap-2.5">
        {times.map((t, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
            <div className="grid min-w-0 gap-1.5"><Label htmlFor={`sl-s${i}`} className={cn(i && "sr-only")}>Starts</Label><Input id={`sl-s${i}`} type="time" value={t.start} onChange={(e) => setTime(i, { start: e.target.value })} /></div>
            <div className="grid min-w-0 gap-1.5"><Label htmlFor={`sl-e${i}`} className={cn(i && "sr-only")}>Ends</Label><Input id={`sl-e${i}`} type="time" value={t.end} onChange={(e) => setTime(i, { end: e.target.value })} /></div>
            {times.length > 1
              ? <Button variant="ghost" size="icon" aria-label={`Remove session ${i + 1}`} onClick={() => setTimes((ts) => ts.filter((_, j) => j !== i))}><X /></Button>
              : <span className="w-9" />}
          </div>
        ))}
      </div>
      <Button variant="secondary" className="mt-3 w-full" onClick={another}><Plus />Add another time</Button>
      {msg && <p className="mt-3 text-sm text-bad" role="alert">{msg}</p>}
      <Button className="my-5 w-full" size="lg" onClick={save}>{times.length > 1 ? `Add ${times.length} sessions` : "Add to schedule"}</Button>
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
