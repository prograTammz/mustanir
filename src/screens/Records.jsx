// Records: the agenda (approval, days in office, trends) and Health (plan, biological age, vitals, every measure).
import { useEffect } from "react";
import { S, MINISTERS, today, addDays, range, manual, day, dayXP, MAX_DAY_XP, totals, bestStreak, T, score, checklistFor, matchDay, slotsOn } from "@/lib/logic.js";
import { SESSION, loadHealth } from "@/lib/store.js";
import { useApp, bump } from "@/lib/app-state.js";
import { Section, Stat, Hint, pctTxt } from "@/components/kit";
import { TrendChart, MinisterBars, Heatmap } from "@/components/charts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import Health from "./Health.jsx";

let healthLoading = false, healthFailedAt = 0;
export function useHealth() {
  useEffect(() => {
    if (S.health || healthLoading || !SESSION || Date.now() - healthFailedAt < 60000) return;
    healthLoading = true;
    loadHealth().then(() => { healthLoading = false; bump(); }).catch(() => { healthLoading = false; healthFailedAt = Date.now(); bump(); });
  }, []);
  return { loading: healthLoading, failed: !!healthFailedAt };
}

export default function Records() {
  useApp();
  const hs = useHealth();
  return (
    <Tabs value={S.recTab || "agenda"} onValueChange={(v) => { S.recTab = v; bump(); }}>
      <TabsList><TabsTrigger value="agenda">Agenda</TabsTrigger><TabsTrigger value="health">Health</TabsTrigger></TabsList>
      <TabsContent value="agenda" className="flex flex-col gap-4"><Agenda hs={hs} /></TabsContent>
      <TabsContent value="health" className="flex flex-col gap-4"><Health hs={hs} /></TabsContent>
    </Tabs>
  );
}

function Agenda({ hs }) {
  const t = totals(), to = today(), days = S.range, from = addDays(to, -days + 1), win = range(from, addDays(to, 1));
  const logged = win.filter((k) => manual(S.days[k]));
  const prayerAvg = logged.length ? logged.reduce((a, k) => a + day(k).faith, 0) / logged.length : null;
  const sleepVals = win.map((k) => (S.days[k] || {}).sleepH).filter((v) => v > 0);
  const sc = score(win);
  const H = S.health?.byMetric || {};
  const series = (k, tracker) => {
    const map = new Map((H[k] || []).filter(([d]) => d >= from).map(([d, v]) => [d, v]));
    if (tracker) for (const d of win) { const v = (S.days[d] || {})[tracker]; if (v > 0 && !map.has(d)) map.set(d, v); }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  };
  const charts = [
    ["Weight", "kg", 1, series("weight", "weight"), "var(--m-body)", null],
    ["Hours asleep", "h", 1, series("sleepH", "sleepH"), "var(--m-habits)", S.settings.sleepTarget],
    ["Prayers kept", "of 5", 1, logged.map((k) => [k, day(k).faith * 5]), "var(--m-faith)", 5],
    ["Productivity", "%", 0, logged.filter((k) => checklistFor(k).total).map((k) => [k, Math.round((checklistFor(k).frac || 0) * 100)]), "var(--gold)", 80],
    ["Training minutes (watch)", "min", 0, win.map((k) => [k, matchDay(k).reduce((a, m) => a + (m.status === "skipped" ? 0 : m.done), 0)]).filter(([k, v]) => v > 0 || slotsOn(k).length), "var(--m-body)", null],
    ["Steps", "", 0, series("steps", "steps"), "var(--m-knowledge)", null],
    ["Active energy", "kcal", 0, series("activeKcal", "activeKcal"), "var(--m-body)", null],
    ["Resting heart rate", "bpm", 0, series("restingHR"), "var(--m-purity)", null],
    ["Heart rate variability", "ms", 0, series("hrv"), "var(--m-purity)", null],
  ];
  const ls = S.health?.lastSync;
  return (
    <>
      <ToggleGroup type="single" value={String(days)} onValueChange={(v) => { if (v) { S.range = +v; bump(); } }}>
        {[[30, "30 days"], [90, "90 days"], [365, "1 year"], [730, "2 years"]].map(([n, l]) => <ToggleGroupItem key={n} value={String(n)}>{l}</ToggleGroupItem>)}
      </ToggleGroup>
      <div className="grid grid-cols-2 gap-2">
        <Stat value={t.xp.toLocaleString("en")} label="total XP" className="bg-card border" />
        <Stat value={bestStreak(T.office)} label="longest run in office" className="bg-card border" />
        <Stat value={pctTxt(prayerAvg)} label="prayers kept" className="bg-card border" />
        <Stat value={sleepVals.length ? (sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(1) : "—"} label="avg hours asleep" className="bg-card border" />
      </div>
      <Section title="Approval by minister" right={<span className="text-sm text-muted-foreground">last {days} days</span>}>
        <MinisterBars threshold={S.settings.threshold} items={MINISTERS.map((m) => ({ key: m.key, short: m.en.replace("Minister of ", ""), value: sc && sc.logged ? sc[m.key] : null }))} />
        <Hint className="mt-3">The tick marks the impeachment line at {S.settings.threshold}%.</Hint>
      </Section>
      <Section title="Days in office" ar="سجل الأيام">
        <Heatmap from={addDays(to, -Math.min(days, 365) + 1)} to={to} label="Daily share of the agenda kept" valueOf={(k) => (manual(S.days[k]) ? dayXP(k) / MAX_DAY_XP : null)} />
      </Section>
      {charts.map(([title, unit, digits, pts, color, goal], i) => (
        <Section key={title} title={title} right={<span className="text-sm text-muted-foreground tnum">{pts.length ? `${pts.length} days` : ""}</span>}>
          <TrendChart id={"a" + i} points={pts} unit={unit} digits={digits} color={color} goal={goal} smooth={pts.length > 60 ? 7 : 1} />
        </Section>
      ))}
      <Hint className="text-center">{ls ? `Apple Health last synced ${new Date(ls.received_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.` : hs.loading ? "Loading Apple Health…" : hs.failed ? "Couldn’t load Apple Health data right now." : "Apple Health hasn’t synced yet. Set it up in the Diwan."}</Hint>
    </>
  );
}
