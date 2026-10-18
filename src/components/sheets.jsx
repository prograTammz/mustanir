// Every bottom sheet in the app: one controlled drawer, its content picked by S.sheet.type.
import { useEffect, useState } from "react";
import { S, MINISTERS, SPORTS, today, totals, rankFor, streak, bestStreak, T, verdict, currentApproval, hmMin } from "@/lib/logic.js";
import { saveSettings, loadMetricSeries } from "@/lib/store.js";
import { bump, go } from "@/lib/app-state.js";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Ar, Emblem, Ring, Chip, Hint, Subhead, Stat, fmtMin, pctTxt, SHORT } from "./kit";
import { TrendChart } from "./charts";
import { cn } from "@/lib/utils";

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
    const t = totals(), rank = rankFor(t.level);
    return (
      <>
        <DrawerHeader className="flex-row items-center gap-3"><Emblem k="president" size={48} /><div><Ar className="block text-2xl leading-tight text-gold">الرئيس المُستنير</Ar><DrawerTitle className="text-base font-medium text-muted-foreground">The President</DrawerTitle></div></DrawerHeader>
        <p className="text-[15px]">Level {t.level}, {rank.en}. {t.logged} days logged, {t.perfect} perfect.</p>
        <div className="my-4 flex flex-col gap-2">
          {[1, 3, 6, 9, 12].map((L) => { const rk = rankFor(L); return (
            <div key={L} className={cn("flex items-center justify-between rounded-2xl px-4 py-3", t.level >= L ? "bg-gold-soft" : "bg-muted/60")}>
              <Ar className={cn("text-lg", t.level >= L ? "text-gold" : "text-muted-foreground")}>{rk.ar}</Ar><span className="text-sm text-muted-foreground">{rk.en} · level {L}</span>
            </div>); })}
        </div>
        <Hint className="pb-4">Every minister earns up to 20 XP a day; a perfect day adds 25, the checklist and the vitals up to 20 each.</Hint>
      </>
    );
  }
  const m = M[k], v = r ? r[k] : null, [cls, txt] = verdict(v, m.immune);
  const detail = r ? {
    body: `Training ${pctTxt(r.training)} (${r.sessions} of ${Math.round(r.planned * 10) / 10} sessions${r.plannedMin ? `, ${fmtMin(r.trainMin)} of ${fmtMin(r.plannedMin)}` : ""}), diet on target ${pctTxt(r.diet)} of days.`,
    faith: "Average share of the five prayers kept; a made-up prayer counts half.",
    knowledge: `Days at ${S.settings.pagesPerDay} pages or more.`,
    purity: `Porn-free ${pctTxt(r.porn)} of days, within the spacing schedule ${pctTxt(r.plan)}.`,
    habits: "Up for Fajr and seven hours asleep count double; bedtime, routines and the watch once each.",
  }[k] : "No days in this council period yet.";
  const st = { faith: ["All five prayers", T.prayers], knowledge: ["Reading", T.read], purity: ["Porn-free", T.pure], habits: ["Up for Fajr", T.fajr] }[k];
  return (
    <>
      <DrawerHeader className="flex-row items-center gap-3"><Emblem k={k} size={48} /><div className="min-w-0"><Ar className="block text-2xl leading-tight">{m.ar}</Ar><DrawerTitle className="text-base font-medium text-muted-foreground">{m.en} · {m.agenda}</DrawerTitle></div></DrawerHeader>
      <div className="flex items-center gap-4 rounded-2xl bg-muted/60 p-4">
        <Ring value={v || 0} color={`var(--m-${k})`} size={72} stroke={7} label="Approval"><span className="text-base">{pctTxt(v)}</span></Ring>
        <div><div className={cn("font-semibold", cls === "ok" && "text-ok", cls === "warn" && "text-warn", cls === "bad" && "text-bad")}>{txt}</div><Hint>{period ? `${period.label} of the term` : "Last 30 days"}</Hint></div>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed">{detail}</p>
      {st && <p className="mt-2 text-[15px]">{st[0]} streak: <b>{streak(st[1])}</b> days now, best <b>{bestStreak(st[1])}</b>.</p>}
      <Hint className="mt-3">{m.immune ? "The prayer is the foundation: this minister can never be impeached." : `Below ${S.settings.threshold}% at a council review, the strategy is impeached and replaced. The agenda stays.`}</Hint>
      <Button className="my-5 w-full" size="lg" onClick={() => { closeSheet(); go("decrees"); setTimeout(() => document.getElementById("dec-" + k)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120); }}>Go to today’s decree</Button>
    </>
  );
}

const DAYS = [["SAT", "Sat"], ["SUN", "Sun"], ["MON", "Mon"], ["TUE", "Tue"], ["WED", "Wed"], ["THU", "Thu"], ["FRI", "Fri"]];
function SlotSheet({ pre }) {
  const [st, setSt] = useState({ sport: pre.sport || "tennis", label: "", mode: pre.date ? "once" : "weekly", days: [], date: pre.date || today(), start: "19:00", end: "20:30" });
  const [msg, setMsg] = useState("");
  const up = (p) => setSt((x) => ({ ...x, ...p }));
  const save = () => {
    if (st.mode === "weekly" && !st.days.length) return setMsg("Pick at least one day.");
    if (hmMin(st.start) == null || hmMin(st.end) == null || hmMin(st.end) === hmMin(st.start)) return setMsg("Set a start and end time.");
    const slot = { id: st.sport + "-" + Date.now().toString(36), sport: st.sport, start: st.start, end: st.end, ...(st.sport === "other" && st.label.trim() ? { label: st.label.trim() } : {}) };
    if (st.mode === "weekly") S.settings.training = [...(S.settings.training || []), { ...slot, days: DAYS.map((d) => d[0]).filter((d) => st.days.includes(d)) }];
    else S.settings.trainingOnce = [...(S.settings.trainingOnce || []), { ...slot, date: st.date }];
    saveSettings(); closeSheet();
  };
  return (
    <>
      <DrawerHeader><DrawerTitle>Add a training slot</DrawerTitle><DrawerDescription>Checked by the watch, shown in Apple Calendar, reminded 30 minutes before.</DrawerDescription></DrawerHeader>
      <Subhead className="mt-0">Sport</Subhead>
      <div className="flex flex-wrap gap-2">{Object.entries(SPORTS).map(([k, v]) => <Chip key={k} on={st.sport === k} onClick={() => up({ sport: k })}>{v.en}</Chip>)}</div>
      {st.sport === "other" && <Input className="mt-3" placeholder="Name, e.g. Padel" value={st.label} onChange={(e) => up({ label: e.target.value })} />}
      <Subhead>Repeats</Subhead>
      <ToggleGroup type="single" value={st.mode} onValueChange={(v) => v && up({ mode: v })}><ToggleGroupItem value="weekly">Every week</ToggleGroupItem><ToggleGroupItem value="once">One date</ToggleGroupItem></ToggleGroup>
      <div className="mt-3">
        {st.mode === "weekly"
          ? <div className="flex flex-wrap gap-2">{DAYS.map(([k, l]) => <Chip key={k} size="sm" on={st.days.includes(k)} onClick={() => up({ days: st.days.includes(k) ? st.days.filter((x) => x !== k) : [...st.days, k] })}>{l}</Chip>)}</div>
          : <div className="grid gap-1.5"><Label htmlFor="sl-date">Date</Label><Input id="sl-date" type="date" value={st.date} onChange={(e) => up({ date: e.target.value })} /></div>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="grid gap-1.5"><Label htmlFor="sl-s">Starts</Label><Input id="sl-s" type="time" value={st.start} onChange={(e) => up({ start: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="sl-e">Ends</Label><Input id="sl-e" type="time" value={st.end} onChange={(e) => up({ end: e.target.value })} /></div>
      </div>
      {msg && <p className="mt-3 text-sm text-bad">{msg}</p>}
      <Button className="my-5 w-full" size="lg" onClick={save}>Add to schedule</Button>
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
        <TrendChart id="metric" points={p} unit={hours ? "h" : m.unit} digits={Math.abs(p.at(-1)?.[1] || 0) >= 100 ? 0 : 1} color="var(--m-knowledge)" smooth={p.length > 60 ? 7 : 1} height={200} />}
      <div className="mt-4 mb-6 grid grid-cols-2 gap-2">
        <Stat value={fmtVal(r.latest, m.unit, m.key)} label={`latest · ${fd(r.latest_day)}`} />
        <Stat value={fmtVal(r.avg30, m.unit, m.key)} label="30-day average" />
        <Stat value={fmtVal(r.prev30, m.unit, m.key)} label="the 30 days before" />
        <Stat value={fmtVal(r.avg365, m.unit, m.key)} label="1-year average" />
      </div>
    </>
  );
}
