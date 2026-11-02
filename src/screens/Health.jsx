// Health: the year's body plan, the vitals, and every measure WHOOP (and, before it, Apple Health) keeps.
// Biological age is read in the WHOOP app: WHOOP Age is not in its API, so the app no longer estimates it.
import { useEffect, useState } from "react";
import { S, today, addDays, range, lastWithin, windowAvg, BODY_PLAN, TERMS, termIndex, termInfo, planTargets, vitalityFor, vitalsFor, DEFAULTS } from "@/lib/logic.js";
import { SESSION, loadHealthSummary, saveSettings } from "@/lib/store.js";
import { bump } from "@/lib/app-state.js";
import { openSheet } from "@/components/sheets.jsx";
import { Section, Stat, Hint, Subhead, Ar, fmtMin, Icon } from "@/components/kit";
import { Chip } from "@/components/m3/index.jsx";
import { TrendChart, DivergingBar } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CATS = [["recovery", "Recovery"], ["activity", "Activity"], ["heart", "Heart"], ["sleep", "Sleep"], ["body", "Body"], ["mobility", "Mobility"], ["vitals", "Vitals"], ["environment", "Environment"], ["nutrition", "Nutrition"], ["sport", "Sport"], ["mind", "Mind"]];
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
      <VitalityHistory />
      <Explorer />
    </>
  );
}

function current() {
  const H = S.health?.byMetric || {}, t = today();
  return {
    weight: lastWithin(H.weight, t, 30), bodyFat: lastWithin(H.bodyFat, t, 120), vo2max: lastWithin(H.vo2max, t, 120),
    restingHR: windowAvg(H.restingHR, addDays(t, -13), t),
    bioAge: null, // read in the WHOOP app (WHOOP Age isn't in its API)
  };
}

function PlanCard() {
  const ti = Math.min(termIndex(), 3), term = termInfo(), cur = current(), P = BODY_PLAN, tg = planTargets(ti);
  const f = (x) => (x == null ? "—" : String(Math.round(x * 10) / 10));
  return (
    <Section title="The body plan" ar="خطة الجسد" desc="Aim for strong, accept likely.">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TERMS.map((x, i) => (
          <div key={x.n} className={cn("min-w-[140px] rounded-[20px] px-3 py-2.5", i === ti ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high", i < ti && "opacity-60")}>
            <div className="flex items-center gap-1.5 type-label-m opacity-80">Term {x.n}{i >= 2 && <Icon name="clear_day" size={14} className="text-warning" />}{i < ti && <Icon name="check" size={14} className="text-success" />}</div>
            <div className="mt-0.5 type-title-s em">{x.name}</div>
            <div className="type-label-s opacity-75">to {short(P.checkpoints[i])}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 type-body-m"><b>Term {term.n}: {TERMS[ti].name}.</b> {TERMS[ti].focus}</p>

      <div className="mt-3 overflow-hidden rounded-[20px] bg-surface-container-high">
        <div className="grid grid-cols-[1.7fr_.8fr_.8fr_.8fr] gap-2 bg-surface-container-highest px-3.5 py-2 type-label-m text-on-surface-variant"><span>By {short(P.checkpoints[ti])}</span><span className="text-right">Now</span><span className="text-right">Likely</span><span className="text-right">Strong</span></div>
        {P.rows.filter((r) => r.k !== "bioAge").map((r) => {
          const v = cur[r.k], lk = r.likely[ti], st = r.strong[ti];
          const hit = v == null ? "" : (r.down ? v <= st : v >= st) ? "strong" : (r.down ? v <= lk : v >= lk) ? "likely" : "";
          return (
            <div key={r.k} className="grid grid-cols-[1.7fr_.8fr_.8fr_.8fr] items-baseline gap-2 border-t px-3.5 py-2.5 type-body-l">
              <span>{r.en}<span className="block type-label-s text-on-surface-variant">started {f(r.now)}{r.unit ? " " + r.unit : ""}</span></span>
              <b className={cn("text-right em tnum", hit === "strong" && "text-success", hit === "likely" && "text-warning")}>{f(v)}</b>
              <span className="text-right text-on-surface-variant tnum">{f(lk)}</span>
              <span className="text-right text-on-surface-variant tnum">{f(st)}</span>
            </div>
          );
        })}
      </div>
      <Subhead>This term asks</Subhead>
      <ul className="flex flex-col gap-1.5">
        {tg.rules.map((x) => <li key={x} className="flex gap-2 type-body-m"><Icon name="star" fill size={16} className="mt-0.5 shrink-0 text-tertiary" />{x}</li>)}
      </ul>
      <Hint className="mt-3">Targets switch on their own when a term begins: {S.settings.deficitMin} kcal deficit, {S.settings.proteinTarget || 160} g protein, {S.settings.sessionsPerWeek} training sessions, {(S.settings.vitality || {}).steps?.toLocaleString("en")} steps. Change them any time in the Diwan.</Hint>
    </Section>
  );
}

function VitalityHistory() {
  const t = today(), days = range(addDays(t, -29), addDays(t, 1));
  const pts = days.map((k) => [k, vitalityFor(k)]).filter(([, v]) => v.seen).map(([k, v]) => [k, v.hits]);
  const goals = { ...DEFAULTS.vitality, ...(S.settings.vitality || {}) };
  const avg = (k) => { const v = days.map((d) => (S.days[d] || {})[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return (
    <Section title="Vitality" ar="الحيوية" right={<span className="type-label-l text-on-surface-variant">last 30 days</span>}>
      <TrendChart points={pts} unit="of 5" digits={0} color="var(--m-body)" goal={4} smooth={7} min={0} max={5} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {vitalsFor(today()).map((x) => { const a = avg(x.k); return <Stat key={x.k} value={a == null ? "—" : x.fmt(a)} label={`${x.en} avg`} tone={a != null && a >= goals[x.k] ? "ok" : undefined} />; })}
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
      <div className="no-scrollbar -mx-4 mb-1 flex gap-2 overflow-x-auto px-4 pb-1">
        {cats.map(([k, l]) => <Chip key={k} selected={k === cat} onClick={() => { S.hcat = k; bump(); }}>{l}</Chip>)}
      </div>
      {metas.filter((m) => m.category === cat).map((m) => {
        const r = rows.get(m.key), ch = r.avg30 != null && r.prev30 ? (r.avg30 - r.prev30) / Math.abs(r.prev30) : null;
        const good = ch == null || !m.better || Math.abs(ch) < 0.02 ? null : (ch > 0) === (m.better > 0);
        return (
          <button key={m.key} onClick={() => openSheet({ type: "metric", meta: m, row: r, fmtVal })} className="state -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-2xl px-2 py-3 text-left">
            <div className="min-w-0 flex-1">
              <div className="type-body-l">{m.label}</div>
              <div className="type-body-s text-on-surface-variant">{r.avg30 != null ? `30-day avg ${fmtVal(r.avg30, m.unit, m.key)}` : `last on ${short(r.latest_day)}`}
                {ch != null && Math.abs(ch) >= 0.02 && <span className={cn(good === true && "text-success", good === false && "text-error")}> {ch > 0 ? "▲" : "▼"} {Math.abs(ch * 100).toFixed(0)}%{good == null ? "" : good ? " better" : " worse"}</span>}
              </div>
            </div>
            <span className="type-title-m em tnum">{fmtVal(r.latest, m.unit, m.key)}</span>
            <Icon name="chevron_right" size={20} className="text-on-surface-variant" />
          </button>
        );
      })}
    </Section>
  );
}
