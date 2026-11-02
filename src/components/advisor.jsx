// The advisor's weekly report (written every Friday), short on the palace, full in the council.
import { useEffect, useState } from "react";
import { S } from "@/lib/logic.js";
import { SESSION, loadReviews, saveSettings } from "@/lib/store.js";
import { bump, go } from "@/lib/app-state.js";
import { Section, Hint, Subhead, Icon } from "./kit";
import { Shape } from "@/components/m3/index.jsx";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

let tried = false, loading = false;
export function AdvisorCard({ full = false }) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (tried || !SESSION) return;
    tried = true; loading = true;
    loadReviews().then(() => { loading = false; bump(); }).catch(() => { loading = false; setT(1); });
  }, []);
  const r = (S.reviews || [])[0];
  const txt = (x) => (typeof x === "string" ? x : x.text || "");
  return (
    <Section title="The advisor’s report" ar="تقرير المستشار" icon={<Shape name="cookie7" size={40} color="var(--md-sys-color-secondary-container)"><Icon name="psychology" fill size={22} className="text-on-secondary-container" /></Shape>}>
      {!r ? <Hint>{loading ? "Loading…" : "Every Friday the advisor reviews your week and writes here."}</Hint> : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 type-label-m text-on-surface-variant"><Icon name="auto_awesome" size={16} fill className="text-tertiary" />Week of {new Date(r.week_start + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</div>
          <h3 className="type-title-l em">{r.title}</h3>
          {full ? (
            <>
              <p className="type-body-l">{r.summary}</p>
              {(r.recommendations || []).length > 0 && <ol className="ml-5 list-decimal space-y-1.5 type-body-l">{r.recommendations.map((x, i) => <li key={i}>{txt(x)}</li>)}</ol>}
              {(r.changes || []).length > 0 && <><Subhead>Changes made to the app</Subhead><ul className="ml-5 list-disc space-y-1 type-body-m text-on-surface-variant">{r.changes.map((x, i) => <li key={i}>{txt(x)}</li>)}</ul></>}
            </>
          ) : <Button variant="secondary" className="mt-1" onClick={() => go("palace")}>Read the full report</Button>}
        </div>
      )}
      {full && (
        <div className="mt-4 flex flex-col gap-2">
          <Hint>Notes to the advisor: what to change in your plan or in this app. Read every Friday.</Hint>
          <Textarea defaultValue={S.settings.advisorNotes || ""} placeholder="e.g. Move reading to after Isha. Add a water counter to Today."
            onChange={(e) => { S.settings.advisorNotes = e.target.value; clearTimeout(S.timers.adv); S.timers.adv = setTimeout(saveSettings, 600); }} />
        </div>
      )}
    </Section>
  );
}
