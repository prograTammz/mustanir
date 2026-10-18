// Health: the year's body plan, biological age, the vitals, and every measure Apple Health keeps.
import { useEffect, useState } from "react";
import { ChevronRight, Sun, Check } from "lucide-react";
import { S, today, addDays, range, ageOn, bioAge, bioInputs, lastWithin, windowAvg, BODY_PLAN, TERMS, termIndex, termInfo, planTargets, vitalityFor, VITALS, DEFAULTS } from "@/lib/logic.js";
import { SESSION, loadHealthSummary, saveSettings } from "@/lib/store.js";
import { bump } from "@/lib/app-state.js";
import { openSheet } from "@/components/sheets.jsx";
import { Section, Stat, Hint, Subhead, Ar, fmtMin } from "@/components/kit";
import { TrendChart, DivergingBar } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CATS = [["activity", "Activity"], ["heart", "Heart"], ["sleep", "Sleep"], ["body", "Body"], ["mobility", "Mobility"], ["vitals", "Vitals"], ["environment", "Environment"], ["nutrition", "Nutrition"], ["sport", "Sport"], ["mind", "Mind"]];
export function fmtVal(v, unit, key) {
  if (v == null || !isFinite(v)) return "—";
  if (unit === "min" && /^sleep/.test(key || "")) return fmtMin(Math.round(v));
  const a = Math.abs(v);
  const n = a >= 1000 ? Math.round(v).toLocaleString("en") : a >= 100 ? String(Math.round(v)) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2).replace(/0$/, "") : v.toFixed(3).replace(/0+$/, "");
  return unit ? `${n} ${unit}` : n;
}
const short = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

let sumLoading = false, sumFailedAt = 0;
export default function Health({ hs }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (S.healthSummary || sumLoading || !SESSION || Date.now() - sumFailedAt < 60000) return;
    sumLoading = true;
    loadHealthSummary().then(() => { sumLoading = false; bump(); }).catch(() => { sumLoading = false; sumFailedAt = Date.now(); force(1); });
  }, []);
  return (
    <>
      <PlanCard />
      <BioCard hs={hs} />
      <VitalityHistory />
      <Explorer />
    </>
  );
}

function current() {
  const H = S.health?.byMetric || {}, t = today(), age = ageOn(S.settings.birthDate, t);
  return {
    weight: lastWithin(H.weight, t, 30), bodyFat: lastWithin(H.bodyFat, t, 120), vo2max: lastWithin(H.vo2max, t, 120),
    restingHR: windowAvg(H.restingHR, addDays(t, -13), t),
    bioAge: age != null && S.health ? bioAge(age, bioInputs(H, t), S.settings.sex)?.bio : null,
  };
}

function PlanCard() {
  const ti = Math.min(termIndex(), 3), term = termInfo(), cur = current(), P = BODY_PLAN, tg = planTargets(ti);
  const f = (x) => (x == null ? "—" : String(Math.round(x * 10) / 10));
  return (
    <Section title="The body plan" ar="خطة الجسد" desc="Aim for strong, accept likely.">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {TERMS.map((x, i) => (
          <div key={x.n} className={cn("min-w-[132px] rounded-2xl border px-3 py-2.5", i === ti ? "border-primary bg-primary/8" : "bg-card", i < ti && "opacity-60")}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">Term {x.n}{i >= 2 && <Sun className="size-3.5 text-warn" />}{i < ti && <Check className="size-3.5 text-ok" />}</div>
            <div className="mt-0.5 text-[13px] leading-snug font-semibold">{x.name}</div>
            <div className="text-[11px] text-muted-foreground">to {short(P.checkpoints[i])}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[14px] leading-relaxed"><b>Term {term.n}: {TERMS[ti].name}.</b> {TERMS[ti].focus}</p>

      <div className="mt-3 overflow-hidden rounded-2xl border">
        <div className="grid grid-cols-[1.7fr_.8fr_.8fr_.8fr] gap-2 bg-muted/60 px-3.5 py-2 text-[11px] font-semibold text-muted-foreground"><span>By {short(P.checkpoints[ti])}</span><span className="text-right">Now</span><span className="text-right">Likely</span><span className="text-right">Strong</span></div>
        {P.rows.map((r) => {
          const v = cur[r.k], lk = r.likely[ti], st = r.strong[ti];
          const hit = v == null ? "" : (r.down ? v <= st : v >= st) ? "strong" : (r.down ? v <= lk : v >= lk) ? "likely" : "";
          return (
            <div key={r.k} className="grid grid-cols-[1.7fr_.8fr_.8fr_.8fr] items-baseline gap-2 border-t px-3.5 py-2.5 text-[15px]">
              <span>{r.en}<span className="block text-[11px] text-muted-foreground">started {f(r.now)}{r.unit ? " " + r.unit : ""}</span></span>
              <b className={cn("text-right tnum", hit === "strong" && "text-ok", hit === "likely" && "text-warn")}>{f(v)}</b>
              <span className="text-right text-muted-foreground tnum">{f(lk)}</span>
              <span className="text-right text-muted-foreground tnum">{f(st)}</span>
            </div>
          );
        })}
      </div>
      <Subhead>This term asks</Subhead>
      <ul className="flex flex-col gap-1.5">
        {tg.rules.map((x) => <li key={x} className="flex gap-2 text-[14px] leading-snug"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />{x}</li>)}
      </ul>
      <Hint className="mt-3">Targets switch on their own when a term begins: {S.settings.deficitMin} kcal deficit, {S.settings.proteinTarget || 160} g protein, {S.settings.sessionsPerWeek} strength sessions, {(S.settings.vitality || {}).steps?.toLocaleString("en")} steps. Change them any time in the Diwan.</Hint>
    </Section>
  );
}

function BioCard({ hs }) {
  const H = S.health?.byMetric;
  const [birth, setBirth] = useState("");
  if (!S.settings.birthDate) return (
    <Section title="Biological age" ar="العمر البيولوجي">
      <p className="text-[15px]">Your watch data can estimate how old your body behaves. Add your birth date to see it.</p>
      <div className="mt-3 flex gap-2"><Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} /><Button onClick={() => { if (birth) { S.settings.birthDate = birth; saveSettings(); bump(); } }}>Save</Button></div>
    </Section>
  );
  if (!H) return <Section title="Biological age" ar="العمر البيولوجي"><Hint>{hs.loading ? "Reading three years of Apple Health…" : "No Apple Health data yet."}</Hint></Section>;
  const t = today(), age = ageOn(S.settings.birthDate, t), b = bioAge(age, bioInputs(H, t), S.settings.sex);
  if (!b || !b.factors.length) return <Section title="Biological age" ar="العمر البيولوجي"><Hint>Not enough recent watch data for an estimate yet.</Hint></Section>;
  const younger = b.delta < 0, max = Math.max(3, ...b.factors.map((x) => Math.abs(x.years)));
  const first = (H.steps || [])[0]?.[0] || t, trend = [];
  for (let d = new Date(first + "T12:00:00"); ; d.setMonth(d.getMonth() + 1)) {
    let k = d.toISOString().slice(0, 10); if (k > t) k = t;
    const x = bioAge(ageOn(S.settings.birthDate, k), bioInputs(H, k), S.settings.sex);
    if (x && x.factors.length >= 3) trend.push([k, Math.round(x.delta * 10) / 10]);
    if (k === t) break;
  }
  return (
    <Section title="Biological age" ar="العمر البيولوجي">
      <div className="flex flex-wrap items-end gap-6">
        <div><div className="text-[52px] leading-none font-bold tracking-tight tnum">{b.bio.toFixed(1)}</div><div className="mt-1 text-sm text-muted-foreground">body age</div></div>
        <div><div className="text-[32px] leading-none font-semibold text-muted-foreground tnum">{age.toFixed(1)}</div><div className="mt-1 text-sm text-muted-foreground">calendar age</div></div>
        <Badge variant={younger ? "ok" : "bad"} className="mb-1 px-3 py-1 text-[13px]">{younger ? "▼" : "▲"} {Math.abs(b.delta).toFixed(1)} years {younger ? "younger" : "older"}</Badge>
      </div>
      {b.fitnessAge && <Hint className="mt-2">Fitness age from VO₂ max: {b.fitnessAge.toFixed(0)}.</Hint>}
      <Subhead>What moves it</Subhead>
      {b.factors.map((x) => (
        <div key={x.k} className="flex flex-col gap-1.5 border-t py-2.5 first:border-t-0">
          <div className="flex justify-between text-[15px]"><span className="font-medium">{x.en}</span><span className="font-semibold tnum">{x.years === 0 ? "±0" : `${x.years > 0 ? "+" : "−"}${Math.abs(x.years).toFixed(1)} y`}</span></div>
          <DivergingBar years={x.years} max={max} />
          <span className="text-xs text-muted-foreground">{x.note}</span>
        </div>
      ))}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-knowledge" />makes you younger</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-body" />makes you older</span>
      </div>
      {trend.length > 2 && <><Subhead>Years older than your age, month by month</Subhead><TrendChart id="bio" points={trend} unit="y" digits={1} color="var(--m-purity)" goal={0} smooth={1} /></>}
      <Hint className="mt-3">Estimate from your last 60 days: each measure’s link to long-term health in large studies, converted to years and scaled down because the measures overlap. Apps like StressWatch weigh mainly heart-rate data, so numbers differ; watch the trend, not the digit.</Hint>
    </Section>
  );
}

function VitalityHistory() {
  const t = today(), days = range(addDays(t, -29), addDays(t, 1));
  const pts = days.map((k) => [k, vitalityFor(k)]).filter(([, v]) => v.seen).map(([k, v]) => [k, v.hits]);
  const goals = { ...DEFAULTS.vitality, ...(S.settings.vitality || {}) };
  const avg = (k) => { const v = days.map((d) => (S.days[d] || {})[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return (
    <Section title="Vitality" ar="الحيوية" right={<span className="text-sm text-muted-foreground">last 30 days</span>}>
      <TrendChart id="vit" points={pts} unit="of 5" digits={0} color="var(--m-body)" goal={4} smooth={7} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {VITALS.map((x) => { const a = avg(x.k); return <Stat key={x.k} value={a == null ? "—" : x.fmt(a)} label={`${x.en} avg`} tone={a != null && a >= goals[x.k] ? "ok" : undefined} />; })}
      </div>
    </Section>
  );
}

function Explorer() {
  const sum = S.healthSummary, cat = S.hcat || "activity";
  if (!sum) return <Section title="Every measure" ar="كل المقاييس"><Hint>{sumLoading ? "Loading…" : "Couldn’t load the measures right now."}</Hint></Section>;
  const rows = new Map(sum.rows.map((r) => [r.metric, r]));
  const metas = sum.catalog.filter((m) => m.category !== "private" && rows.has(m.key));
  const cats = CATS.filter(([k]) => metas.some((m) => m.category === k));
  return (
    <Section title="Every measure" ar="كل المقاييس" desc={`${metas.length} measures · ${sum.rows.reduce((a, r) => a + r.days, 0).toLocaleString("en")} daily records`}>
      <div className="no-scrollbar -mx-5 mb-1 flex gap-2 overflow-x-auto px-5 pb-1">
        {cats.map(([k, l]) => <button key={k} onClick={() => { S.hcat = k; bump(); }} className={cn("h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold", k === cat ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>{l}</button>)}
      </div>
      {metas.filter((m) => m.category === cat).map((m) => {
        const r = rows.get(m.key), ch = r.avg30 != null && r.prev30 ? (r.avg30 - r.prev30) / Math.abs(r.prev30) : null;
        const good = ch == null || !m.better || Math.abs(ch) < 0.02 ? null : (ch > 0) === (m.better > 0);
        return (
          <button key={m.key} onClick={() => openSheet({ type: "metric", meta: m, row: r, fmtVal })} className="flex w-full items-center gap-3 border-t py-3 text-left first:border-t-0">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">{m.label}</div>
              <div className="text-xs text-muted-foreground">{r.avg30 != null ? `30-day avg ${fmtVal(r.avg30, m.unit, m.key)}` : `last on ${short(r.latest_day)}`}
                {ch != null && Math.abs(ch) >= 0.02 && <span className={cn(good === true && "text-ok", good === false && "text-bad")}> {ch > 0 ? "▲" : "▼"} {Math.abs(ch * 100).toFixed(0)}%{good == null ? "" : good ? " better" : " worse"}</span>}
              </div>
            </div>
            <span className="text-[15px] font-semibold tnum">{fmtVal(r.latest, m.unit, m.key)}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        );
      })}
    </Section>
  );
}
