// Council: the monthly review. Each minister is judged on adherence, never on the scale.
import { S, MINISTERS, today, addDays, range, diff, fmt, periods, score, verdict, termIndex, termStartFor, termInfo } from "@/lib/logic.js";
import { saveSettings } from "@/lib/store.js";
import { bump } from "@/lib/app-state.js";
import { AdvisorCard } from "@/components/advisor.jsx";
import { Section, Hint, Emblem, Ar, pctTxt } from "@/components/kit";
import { MinisterBars } from "@/components/charts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function Council() {
  const t = today(), ps = periods(t), ti = termIndex(t), term = termInfo(t);
  if (S.period == null || !ps[S.period]) { const cur = ps.find((p) => t >= p.start && t < p.end); S.period = cur ? cur.i : 0; }
  const p = ps[S.period], endCount = t < p.end ? addDays(t, 1) : p.end;
  const dates = p.start < endCount ? range(p.start, endCount) : [];
  const r = score(dates), left = diff(t, p.end);
  const notesKey = `${ti}-${p.i}`, notes = S.settings.revNotes || {};
  const note = notes[notesKey] ?? (ti === 0 ? notes[p.i] : "") ?? "";
  const ts = termStartFor(t), ws = Object.keys(S.days).filter((k) => k >= ts && S.days[k].weight != null).sort();
  const dlt = ws.length > 1 ? Math.round((S.days[ws.at(-1)].weight - S.days[ws[0]].weight) * 10) / 10 : null;

  return (
    <>
      <ToggleGroup type="single" value={String(S.period)} onValueChange={(v) => { if (v) { S.period = +v; bump(); } }}>
        {ps.map((x) => <ToggleGroupItem key={x.i} value={String(x.i)}>{x.label} · {fmt(x.start, { month: "short" })}</ToggleGroupItem>)}
      </ToggleGroup>

      <div className="rounded-3xl border bg-gradient-to-br from-gold-soft to-card px-5 py-6 text-center">
        <Ar className="block text-[34px] leading-tight text-gold">مجلس الشورى</Ar>
        <p className="mt-2 text-[15px] text-muted-foreground">Term {term.n}, {term.name}. The council sits on <b className="text-foreground">{fmt(p.end, { day: "numeric", month: "long" })}</b>.</p>
      </div>

      {!r ? (
        <Section title="Approval"><Hint>{t < p.start ? `This month starts ${fmt(p.start, { day: "numeric", month: "long" })}.` : "No days counted yet."}</Hint></Section>
      ) : (
        <Section title="Approval" right={<span className="text-sm text-muted-foreground">{left > 0 ? `council in ${left} day${left > 1 ? "s" : ""}` : "council is due"}</span>}>
          <div className="mb-4 flex items-baseline gap-3">
            <span className="text-[52px] leading-none font-bold tracking-tight tnum">{pctTxt(r.overall)}</span>
            <span className="text-sm text-muted-foreground">overall · {r.logged} of {r.n} days logged</span>
          </div>
          <MinisterBars threshold={S.settings.threshold} items={MINISTERS.map((m) => ({ key: m.key, short: m.en.replace("Minister of ", ""), value: r[m.key] }))} />
          <div className="mt-4 flex flex-col">
            {MINISTERS.map((m) => {
              const [cls, txt] = verdict(r[m.key], m.immune);
              return (
                <div key={m.key} className="flex items-center gap-3 border-t py-2.5">
                  <Emblem k={m.key} size={34} />
                  <span className="flex-1 text-[15px]">{m.en}</span>
                  <Badge variant={cls || "muted"}>{txt}</Badge>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {dlt != null && (
        <Section title="Weight this term" desc="The result, not the measure.">
          <span className={cn("text-3xl font-bold tnum", dlt < 0 && "text-ok", dlt > 0 && "text-bad")}>{dlt > 0 ? "+" : ""}{dlt} kg</span>
        </Section>
      )}

      <AdvisorCard full />

      <Section title="The council’s verdict" ar="قرار المجلس" desc="Who keeps their seat, who is replaced, and the new strategy.">
        <Textarea key={notesKey} defaultValue={note} rows={6} placeholder="e.g. Body holds. Knowledge impeached: reading moves to right after Fajr."
          onChange={(e) => { S.settings.revNotes = { ...(S.settings.revNotes || {}), [notesKey]: e.target.value }; clearTimeout(S.timers.rev); S.timers.rev = setTimeout(saveSettings, 600); }} />
      </Section>
    </>
  );
}
