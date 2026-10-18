// The palace: the scene, the president's standing, the cabinet, the advisor, medals and the verse.
import { useEffect, useRef } from "react";
import { ChevronRight, Crown, Flame, ScrollText, CalendarCheck } from "lucide-react";
import { S, MINISTERS, AYAH, today, dayMinisters, totals, rankFor, streak, T, medals, currentApproval, verdict } from "@/lib/logic.js";
import { go, bump } from "@/lib/app-state.js";
import { openSheet } from "@/components/sheets.jsx";
import { AdvisorCard } from "@/components/advisor.jsx";
import { Ar, Emblem, Section, pctTxt, Hint } from "@/components/kit";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function standing() {
  const { r, period } = currentApproval();
  const out = {};
  for (const m of MINISTERS) { const v = r ? r[m.key] : null; const [cls] = verdict(v, m.immune); out[m.key] = { approval: v, status: r && r.logged ? cls : "", period }; }
  return { out, r, period };
}

let palace3d = null, host = null, tried = false;
function Stage({ out }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!host) { host = document.createElement("div"); host.className = "absolute inset-0"; }
    ref.current.append(host);
    if (!tried) {
      tried = true;
      import("@/lib/palace3d.js").then(({ createPalace }) => { palace3d = createPalace(host, { onPick: (k) => openSheet({ type: "minister", key: k }) }); palace3d?.update(standing().out); bump(); }).catch(() => {});
    }
    return () => { host.remove(); };
  }, []);
  useEffect(() => { palace3d?.update(out); });
  return (
    <div ref={ref} aria-label="The palace: the president and five ministers. Tap one to open their file."
      className="relative -mx-1 h-[clamp(290px,72vw,400px)] overflow-hidden rounded-t-[50%_26%] rounded-b-[28px] shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_0_0_0.5px_color-mix(in_oklch,var(--gold)_60%,transparent),0_30px_60px_-30px_rgb(0_0_0/0.6)] [&_canvas]:absolute [&_canvas]:inset-0 [&_canvas]:size-full [&_canvas]:touch-pan-y"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #1E4258 0%, #0E2230 55%, #08131B 100%)" }}>
      {!palace3d && (
        <div className="absolute inset-x-0 bottom-[16%] flex flex-wrap justify-center gap-2.5 px-3">
          {["body", "knowledge", "president", "faith", "habits", "purity"].map((k) => (
            <button key={k} onClick={() => openSheet({ type: "minister", key: k })} aria-label={k}><Emblem k={k} size={52} className="bg-white/10" /></button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Palace() {
  const t = totals(), rank = rankFor(t.level), { out, r } = standing();
  const dm = dayMinisters(today()), done = Object.values(dm).filter((v) => v >= 0.9).length;
  const office = streak(T.office);
  const ms = medals(), won = ms.filter((m) => m.won).length;
  return (
    <>
      <Stage out={out} />

      <Card className="overflow-hidden pt-0">
        <button onClick={() => openSheet({ type: "minister", key: "president" })} className="flex items-center gap-4 bg-gradient-to-br from-gold-soft to-transparent px-5 pt-5 pb-4 text-left">
          <div className="relative grid size-16 shrink-0 place-items-center">
            <svg viewBox="0 0 24 24" className="absolute inset-0 size-full fill-gold drop-shadow-[0_6px_14px_color-mix(in_oklch,var(--gold)_40%,transparent)]"><path d="M12 2l2.4 4.2 4.7-1-1 4.7L22 12l-4.2 2.4 1 4.7-4.7-1L12 22l-2.4-4.2-4.7 1 1-4.7L2 12l4.2-2.4-1-4.7 4.7 1z" /></svg>
            <span className="relative text-xl font-extrabold text-[oklch(0.22_0.03_70)] tnum">{t.level}</span>
          </div>
          <div className="min-w-0 flex-1">
            <Ar className="block text-[26px] leading-tight text-gold">المُستنير</Ar>
            <div className="text-sm text-muted-foreground">{rank.en} · <Ar>{rank.ar}</Ar></div>
          </div>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Progress value={t.frac * 100} indicatorClassName="bg-gold" aria-label="Progress to next level" />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground tnum"><span>{t.xp.toLocaleString("en")} XP</span><span>{(t.to - t.xp).toLocaleString("en")} to level {t.level + 1}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[[Flame, office, "days in office"], [ScrollText, `${done}/5`, "sealed today"], [CalendarCheck, r ? pctTxt(r.overall) : "—", "approval"]].map(([I, v, l]) => (
              <div key={l} className="rounded-2xl bg-muted/70 px-3 py-2.5">
                <I className="mb-1 size-4 text-gold" />
                <div className="text-xl font-bold tnum">{v}</div>
                <div className="text-[11px] text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
          <Button size="lg" onClick={() => go("decrees")}>{done === 5 ? "Today is sealed · review decrees" : "Issue today’s decrees"}</Button>
        </CardContent>
      </Card>

      <Section title="The cabinet" ar="مجلس الوزراء" contentClassName="-my-1">
        {MINISTERS.map((m) => {
          const s = out[m.key], [cls, txt] = verdict(s.approval, m.immune);
          return (
            <button key={m.key} onClick={() => openSheet({ type: "minister", key: m.key })} className="flex w-full items-center gap-3 border-t py-3 text-left first:border-t-0">
              <Emblem k={m.key} />
              <div className="min-w-0 flex-1">
                <Ar className="block text-[17px] leading-tight">{m.ar}</Ar>
                <div className="truncate text-[13px] text-muted-foreground">{m.en}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-base font-bold tnum">{pctTxt(s.approval)}</span>
                <Badge variant={!s.status ? "muted" : cls || "muted"}>{!s.status ? "Awaiting days" : m.immune ? (cls === "ok" ? "Strong" : "Needs attention") : txt}</Badge>
              </div>
            </button>
          );
        })}
      </Section>

      <AdvisorCard />

      <Section title="Medals" right={<span className="text-sm text-muted-foreground tnum">{won} of {ms.length}</span>}>
        <div className="grid grid-cols-3 gap-2">
          {ms.map((m) => (
            <div key={m.id} title={m.how} className={cn("flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center", m.won ? "bg-gold-soft" : "bg-muted/60 opacity-70")}>
              <Crown className={cn("size-6", m.won ? "text-gold" : "text-muted-foreground/50")} />
              <Ar className={cn("text-[15px] leading-tight", m.won ? "text-gold" : "text-muted-foreground")}>{m.ar}</Ar>
              <span className="text-[11px] leading-tight text-muted-foreground">{m.won ? m.en : m.how}</span>
            </div>
          ))}
        </div>
      </Section>

      <figure className="px-4 py-6 text-center">
        <blockquote lang="ar" dir="rtl" className="font-[family-name:var(--font-quran)] text-[22px] leading-loose text-gold">{AYAH.ar}</blockquote>
        <figcaption className="mt-2 text-sm text-muted-foreground">{AYAH.en} <cite className="not-italic">· {AYAH.ref}</cite></figcaption>
      </figure>
      <Hint className="text-center">Tap the president or any minister to open their file.</Hint>
    </>
  );
}
