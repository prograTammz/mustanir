// The palace: where you stand in the game. Your seal and level, the road of ranks, streaks, the trophy room, then the
// council, the advisor, trends and every measure.
import { useEffect, useState } from "react";
import { S, MINISTERS, today, addDays, range, diff, fmt, manual, day, dayXP, inOffice, rankFor, RANKS, streak, bestStreak, T, periods, score, verdict, levelStart, termDay, termLength,
  termIndex, termInfo, checklistFor, deficitOf } from "@/lib/logic.js";
import { SESSION, loadHealth, saveSettings } from "@/lib/store.js";
import { useApp, bump, allTotals, allMedals, memo } from "@/lib/app-state.js";
import { weekReport, lastWeek, weekEnd, firstTracked } from "@/lib/week.js";
import { openSheet } from "@/lib/app-state.js";
import { AdvisorCard } from "@/components/advisor.jsx";
import { Ar, Fold, Hint, LargeTitle, Seal, Stat, MIN, mColor, mContainer, medalKind, fmtN, pctTxt } from "@/components/kit";
import { Icon, Shape, Button, Chip, Card, SectionTitle, Progress, Ring, Connected } from "@/components/m3/index.jsx";
import { TrendChart } from "@/components/charts";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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

export default function Palace() {
  useApp();
  const hs = useHealth();
  return (
    <>
      <LargeTitle title="Palace" ar="القصر" caption="Rank, streaks, medals and the council" />
      <Hero />
      <RankRoad />
      <Streaks />
      <Trophies />
      <WeekCard />
      <Council />
      <AdvisorCard full />
      <Trends />
      <Card className="rise px-4 py-2">
        <Fold title="All health data" summary="Plan · measures" leading={<Icon name="monitoring" size={22} className="text-on-surface-variant" />}>
          <div className="-mx-4 flex flex-col gap-3 pt-1 pb-3 [&>section]:rounded-none [&>section]:bg-transparent"><Health hs={hs} /></div>
        </Fold>
      </Card>
    </>
  );
}

/* ---------- the hero: the seal, the rank in both languages, XP to the next level ---------- */
function Hero() {
  const t = allTotals(), rank = rankFor(t.level), next = RANKS.find((r) => r.from > t.level);
  const days = Object.keys(S.days).filter((k) => inOffice(k) && manual(S.days[k]));
  const week = range(addDays(today(), -6), addDays(today(), 1)).reduce((a, k) => a + (inOffice(k) && S.days[k] ? dayXP(k) : 0), 0);
  const best = days.reduce((a, k) => Math.max(a, dayXP(k)), 0);
  return (
    <Card className="rise relative overflow-hidden bg-primary-container p-5 text-on-primary-container">
      <Shape name="flower" size={260} spin color="color-mix(in srgb, var(--md-sys-color-on-primary-container) 6%, transparent)" className="pointer-events-none absolute -top-20 -right-20" />
      <p className="relative type-label-l opacity-80">Term {termInfo().n} · day {Math.max(1, termDay(today()))} of {termLength()}</p>
      <div className="relative mt-3 flex items-center gap-4">
        <Seal level={t.level} size={96} spin className="pop" />
        <div className="min-w-0 flex-1">
          <Ar className="block text-left text-[30px] leading-tight text-tertiary">{rank.ar}</Ar>
          <div className="type-headline-s em">{rank.en}</div>
          <div className="type-body-m opacity-80">Level {t.level}{next ? ` · ${next.en} at level ${next.from}` : " · the highest rank"}</div>
        </div>
      </div>
      <div className="relative mt-5">
        <div className="mb-1.5 flex items-baseline justify-between type-label-l tnum"><span className="em">{t.xp.toLocaleString("en")} XP</span><span className="opacity-80">{(t.to - t.xp).toLocaleString("en")} to level {t.level + 1}</span></div>
        <Progress value={t.frac} wavy thick color="var(--md-sys-color-tertiary)" track="color-mix(in srgb, var(--md-sys-color-on-primary-container) 16%, transparent)" />
      </div>
      <div className="relative mt-5 grid grid-cols-3 gap-2">
        {[[week.toLocaleString("en"), "XP this week", "bolt"], [best, "best day", "star"], [days.length, "days logged", "event_available"]].map(([v, l, ic]) => (
          <div key={l} className="rounded-[20px] bg-[color-mix(in_srgb,var(--md-sys-color-on-primary-container)_9%,transparent)] px-3 py-2.5">
            <Icon name={ic} size={18} fill className="text-tertiary" />
            <div className="type-title-l em tnum">{v}</div>
            <div className="type-label-m opacity-80">{l}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- the road of ranks: a winding path from Candidate to The Enlightened ---------- */
const XS = [50, 80, 50, 20];
function RankRoad() {
  const t = allTotals(), cur = rankFor(t.level), ci = RANKS.indexOf(cur), STEP = 92, H = STEP * (RANKS.length - 1) + 64;
  const pts = RANKS.map((_, i) => [XS[i % 4], 32 + i * STEP]);
  const seg = (a, b) => `C${a[0]} ${a[1] + STEP / 2} ${b[0]} ${b[1] - STEP / 2} ${b[0]} ${b[1]}`;
  const all = `M${pts[0][0]} ${pts[0][1]}` + pts.slice(1).map((p, i) => seg(pts[i], p)).join("");
  const done = `M${pts[0][0]} ${pts[0][1]}` + pts.slice(1, ci + 1).map((p, i) => seg(pts[i], p)).join("");
  const nextRank = RANKS[ci + 1], toNext = nextRank ? Math.max(0, levelStart(nextRank.from) - t.xp) : 0;
  const span = nextRank ? levelStart(nextRank.from) - levelStart(cur.from) : 1, into = nextRank ? (t.xp - levelStart(cur.from)) / span : 1;
  return (
    <>
      <SectionTitle sub={nextRank ? `${nextRank.en} in ${toNext.toLocaleString("en")} XP` : "Every rank is yours"}>The road of ranks</SectionTitle>
      <Card className="rise relative overflow-hidden px-4" style={{ height: H + 16 }}>
        <svg className="absolute inset-x-4 top-2" style={{ height: H, width: "calc(100% - 32px)" }} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden>
          <path d={all} fill="none" stroke="var(--md-sys-color-outline-variant)" strokeWidth="4" strokeDasharray="2 10" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {ci > 0 && <path d={done} fill="none" stroke="var(--md-sys-color-tertiary)" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        </svg>
        <div className="absolute inset-x-4 top-2" style={{ height: H }}>
          {RANKS.map((r, i) => {
            const [x, y] = pts[i], got = i <= ci, here = i === ci, left = x > 50, size = here ? 64 : 48;
            return (
              <div key={r.from} className="absolute flex items-center gap-3" style={{ top: y - size / 2, ...(left ? { right: `calc(${100 - x}% - ${size / 2}px)`, flexDirection: "row-reverse" } : { left: `calc(${x}% - ${size / 2}px)` }) }}>
                <span className="relative">
                  {here && <span className="pulse-ring absolute inset-0 rounded-full bg-tertiary/40" />}
                  {here ? <Ring value={into} size={size} stroke={4} color="var(--md-sys-color-tertiary)" label={`${Math.round(into * 100)}% of the way to ${nextRank?.en || "the top"}`}><Seal level={t.level} size={48} /></Ring>
                    : got ? <Seal level={r.from} size={size} />
                    : <Shape name="verySunny" size={size} color="var(--md-sys-color-surface-container-highest)"><Icon name="lock" size={20} className="text-on-surface-variant" /></Shape>}
                </span>
                <div className={cn("max-w-[150px]", left && "text-right")}>
                  <Ar className={cn("block text-[18px] leading-tight", got ? "text-tertiary" : "text-on-surface-variant", left ? "text-right" : "text-left")}>{r.ar}</Ar>
                  <div className={cn("type-title-s em", !got && "text-on-surface-variant")}>{r.en}</div>
                  <div className={cn("type-label-s tnum", here ? "em text-tertiary" : "text-on-surface-variant")}>{here ? `You · level ${t.level}` : got ? "Reached" : `Level ${r.from} · ${levelStart(r.from).toLocaleString("en")} XP`}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

/* ---------- streaks ---------- */
const STREAKS = [["office", "Days in office", "Log something every day", "event_available"], ["prayers", "All five prayers", "Every prayer, every day", "mosque"], ["fajr", "Up for Fajr", "From WHOOP", "wb_twilight"],
  ["abstain", "Purity", "No slip logged", "shield"], ["read", "Reading", "Your pages, daily", "menu_book"], ["regular", "Sleep rhythm", "Consistency on target", "repeat"], ["vital", "Vitality", "4 of 5 vitals", "ecg_heart"]];
function Streaks() {
  return (
    <>
      <SectionTitle trailing={<span className="type-label-l text-on-surface-variant">now · best</span>}>Streaks</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {STREAKS.map(([k, l, how, ic], i) => {
          const now = streak(T[k]), best = bestStreak(T[k]);
          return (
            <Card key={k} className={cn("rise flex flex-col gap-1 p-4", i === 0 && "col-span-2", now ? "bg-fire-container text-on-fire-container" : "")}>
              <div className="flex items-center justify-between">
                <Icon name={ic} size={20} className={now ? "" : "text-on-surface-variant"} />
                <span className={cn("flex items-center gap-0.5 type-label-m tnum", !now && "text-on-surface-variant")}><Icon name="emoji_events" size={14} />best {best}</span>
              </div>
              <div className="flex items-center gap-1">
                <Icon name="local_fire_department" fill={!!now} size={i === 0 ? 34 : 26} className={now ? "text-fire" : "text-outline"} />
                <span className={cn("em-x tnum leading-none", i === 0 ? "type-display-s" : "type-headline-m")}>{now}</span>
                <span className={cn("type-label-l", !now && "text-on-surface-variant")}>{now === 1 ? "day" : "days"}</span>
              </div>
              <div className="type-title-s">{l}</div>
              <div className={cn("type-body-s", now ? "opacity-80" : "text-on-surface-variant")}>{how}</div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

/* ---------- the trophy room: every medal, shaped and coloured by its minister ---------- */
function Trophies() {
  const [filter, setFilter] = useState("all"), [all, setAll] = useState(false);
  const ms = allMedals(), won = ms.filter((m) => m.won), rest = ms.filter((m) => !m.won).sort((a, b) => b.frac - a.frac);
  const list = filter === "won" ? won : filter === "close" ? rest.filter((m) => m.frac > 0) : [...won, ...rest];
  const shown = all ? list : list.slice(0, 12);
  return (
    <>
      <SectionTitle trailing={<span className="type-title-m em tnum text-tertiary">{won.length}<span className="type-body-m text-on-surface-variant"> / {ms.length}</span></span>}>Trophy room</SectionTitle>
      <Card className="rise p-4">
        <Connected value={filter} onChange={(v) => { setFilter(v); setAll(false); }} options={[{ value: "all", label: "All" }, { value: "won", label: `Won ${won.length}` }, { value: "close", label: "Closest" }]} label="Show medals" />
        <Progress value={won.length / ms.length} color="var(--md-sys-color-tertiary)" className="mt-4" />
        <div className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4">
          {shown.map((m) => {
            const k = medalKind(m.id), sh = MIN[k];
            return (
              <button key={m.id} type="button" onClick={() => openSheet({ type: "medal", id: m.id })} className="state flex flex-col items-center gap-1.5 rounded-[20px] px-1 py-2 text-center">
                {m.won
                  ? <Shape name={sh.shape} rot={sh.rot || 0} size={64} color={mColor(k)} className="pop"><Icon name={sh.icon} fill size={28} style={{ color: "var(--md-sys-color-surface)" }} /></Shape>
                  : <Ring value={m.frac} size={64} stroke={4} color={mColor(k)}><Shape name={sh.shape} rot={sh.rot || 0} size={46} color="var(--md-sys-color-surface-container-highest)"><Icon name="lock" size={18} className="text-on-surface-variant" /></Shape></Ring>}
                <span className={cn("line-clamp-2 type-label-l leading-tight", m.won ? "em" : "text-on-surface-variant")}>{m.en}</span>
                {m.won ? <Ar className="text-[12px] leading-tight text-tertiary">{m.ar}</Ar> : <span className="type-label-s text-on-surface-variant tnum">{m.down ? `${fmtN(m.cur)} → ${m.goal}` : `${fmtN(m.cur)} / ${fmtN(m.goal)}`}</span>}
              </button>
            );
          })}
        </div>
        {!list.length && <Hint className="py-6 text-center">{filter === "won" ? "No medals yet. The first one is close." : "Nothing under way yet."}</Hint>}
        {list.length > 12 && <Button variant="tonal" className="mt-4 w-full" icon={all ? "expand_more" : undefined} onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${list.length}`}</Button>}
      </Card>
    </>
  );
}

/* ---------- the week in review: out every Sunday, for the week that just ended ---------- */
function WeekCard() {
  const start = lastWeek(), first = firstTracked();
  if (!first || weekEnd(start) < first) return null;
  const r = memo("week:" + start, () => weekReport(start)), s = r.sum;
  return (
    <>
      <SectionTitle sub={r.inTerm ? `Week ${r.week} of term ${r.term.n} · ${r.label}` : `Before the term · ${r.label}`}
        trailing={<span className="inline-flex h-8 items-center gap-1 rounded-lg bg-secondary-container px-3 type-label-l text-on-secondary-container"><Icon name="event" size={16} />Sundays</span>}>The week in review</SectionTitle>
      <Card as="button" type="button" onClick={() => openSheet({ type: "week", start })} className="rise state w-full p-4 text-left">
        <div className="flex items-end gap-3">
          <span className="type-display-m em-x tnum leading-none text-primary">{r.inTerm ? s.xp.toLocaleString("en") : pctTxt(r.score.overall)}</span>
          <span className="pb-1 type-body-m text-on-surface-variant">{r.inTerm ? `XP earned · approval ${pctTxt(r.score.overall)}` : "approval · before the term"}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat value={`${s.clean} of ${s.days}`} label="days clean" />
          <Stat value={s.night == null ? "—" : `${s.night.toFixed(1)} h`} label="night sleep, without naps" />
          <Stat value={s.foodDays ? Math.round(s.deficit).toLocaleString("en") : "—"} label="kcal deficit a day" />
          <Stat value={`${s.sessions}`} label="training sessions" />
        </div>
        <div className="mt-3 flex items-center justify-between type-label-l text-primary">
          <span>{r.findings.length ? `Open the report · ${r.findings.length} finding${r.findings.length === 1 ? "" : "s"}` : "Open the report"}</span><Icon name="chevron_right" size={20} />
        </div>
      </Card>
    </>
  );
}

/* ---------- this month's council ---------- */
function Council() {
  const t = today(), ps = periods(t), ti = termIndex(t), term = termInfo(t);
  const cur = ps.find((p) => t >= p.start && t < p.end) || ps[0];
  const end = t < cur.end ? addDays(t, 1) : cur.end;
  const r = cur.start < end ? score(range(cur.start, end)) : null, left = diff(t, cur.end), line = S.settings.threshold;
  const notesKey = `${ti}-${cur.i}`, note = (S.settings.revNotes || {})[notesKey] ?? "";
  return (
    <>
      <SectionTitle sub={`${cur.label} of term ${term.n}`} trailing={<span className="inline-flex h-8 items-center gap-1 rounded-lg bg-secondary-container px-3 type-label-l text-on-secondary-container"><Icon name="gavel" size={16} />{left > 0 ? `Council in ${left} d` : "Council due"}</span>}>The council</SectionTitle>
      <Card className="rise p-4">
        {!r ? <Hint>{t < cur.start ? `Term ${term.n} starts ${fmt(cur.start, { day: "numeric", month: "long" })}.` : "No days counted yet."}</Hint> : (
          <>
            <div className="flex items-end gap-3">
              <span className={cn("type-display-m em-x tnum leading-none", r.overall * 100 < line ? "text-error" : "text-primary")}>{pctTxt(r.overall)}</span>
              <span className="pb-1 type-body-m text-on-surface-variant">approval · {r.logged} of {r.n} days logged</span>
            </div>
            <div className="mt-4 flex flex-col gap-1">
              {MINISTERS.map((m) => {
                const [cls, txt] = verdict(r[m.key], m.immune);
                return (
                  <button key={m.key} type="button" onClick={() => openSheet({ type: "minister", key: m.key })} className="state -mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 text-left" title={txt}>
                    <Shape name={MIN[m.key].shape} rot={MIN[m.key].rot || 0} size={32} color={mContainer(m.key)}><Icon name={MIN[m.key].icon} fill size={16} style={{ color: mColor(m.key) }} /></Shape>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between type-label-l"><span>{m.en.replace("Minister of ", "")}</span>
                        <span className={cn("em tnum", cls === "bad" && "text-error", cls === "warn" && "text-warning")}>{pctTxt(r[m.key])}</span></div>
                      <div className="relative mt-1">
                        <Progress value={r[m.key]} color={mColor(m.key)} stop={false} />
                        <span className="absolute -top-1 h-3 w-0.5 rounded-full bg-on-surface" style={{ left: `${line}%` }} aria-hidden />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <Hint className="mt-2">The mark is the impeachment line ({line}%): below it a minister’s strategy is up for replacement at the council. Faith can’t be impeached.</Hint>
          </>
        )}
        <Fold className="mt-2 border-t pt-1" title="The council’s verdict" summary={note ? "Written" : "Notes"}>
          <Textarea key={notesKey} defaultValue={note} rows={4} className="mt-1 mb-2" placeholder="Who keeps their seat, who is replaced, and the new strategy."
            onChange={(e) => { S.settings.revNotes = { ...(S.settings.revNotes || {}), [notesKey]: e.target.value }; clearTimeout(S.timers.rev); S.timers.rev = setTimeout(saveSettings, 600); }} />
        </Fold>
      </Card>
    </>
  );
}

/* ---------- trends: one chart, pick the measure ---------- */
function Trends() {
  const to = today(), days = S.range || 30, from = addDays(to, -days + 1), win = range(from, addDays(to, 1));
  const logged = win.filter((k) => manual(S.days[k]));
  const H = S.health?.byMetric || {};
  const series = (k, field) => {
    const map = new Map((H[k] || []).filter(([d]) => d >= from).map(([d, v]) => [d, v]));
    if (field) for (const d of win) { const v = (S.days[d] || {})[field]; if (v != null && v !== 0 && !map.has(d)) map.set(d, v); }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  };
  const M = {
    weight: ["Weight", "kg", 1, () => series("weight", "weight"), "var(--m-body)", null],
    sleep: ["Sleep", "h", 1, () => series("sleepH", "sleepH"), "var(--m-habits)", S.settings.sleepTarget],
    deficit: ["Deficit", "kcal", 0, () => win.map((k) => [k, deficitOf(S.days[k])]).filter(([, v]) => v != null), "var(--ok)", S.settings.deficitMin],
    steps: ["Steps", "", 0, () => series("steps", "steps"), "var(--m-knowledge)", (S.settings.vitality || {}).steps],
    prayers: ["Prayers", "of 5", 1, () => logged.map((k) => [k, day(k).faith * 5]), "var(--m-faith)", 5],
    recovery: ["Recovery", "%", 0, () => series("recovery", "recovery"), "var(--ok)", 67],
    tasks: ["Tasks", "%", 0, () => logged.filter((k) => checklistFor(k).total).map((k) => [k, Math.round((checklistFor(k).frac || 0) * 100)]), "var(--gold)", 80],
  };
  const key = S.trend && M[S.trend] ? S.trend : "weight", [title, unit, digits, get, color, goal] = M[key], pts = get();
  return (
    <>
      <SectionTitle>Trends</SectionTitle>
      <Card className="rise p-4">
        <Connected value={days} onChange={(n) => { S.range = n; bump(); }} options={[{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }, { value: 90, label: "90 days" }]} label="Range" />
        <div className="no-scrollbar -mx-4 my-3 flex gap-2 overflow-x-auto px-4">
          {Object.entries(M).map(([k, [l]]) => <Chip key={k} selected={k === key} onClick={() => { S.trend = k; bump(); }}>{l}</Chip>)}
        </div>
        {pts.length ? <TrendChart points={pts} unit={unit} digits={digits} color={color} goal={goal || null} smooth={days > 60 ? 7 : 1} min={key === "weight" ? null : 0} />
          : <Hint className="py-8 text-center">No {title.toLowerCase()} data in the last {days} days yet.</Hint>}
      </Card>
    </>
  );
}
