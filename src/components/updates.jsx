// Settings → Updates: the release running on this phone, a check for a newer one, and every release's notes, folded away.
import { RELEASE, useUpdate, checkForUpdate, applyUpdate } from "@/lib/update.js";
import HISTORY from "virtual:release-history";
import { Section, Icon } from "@/components/kit";
import { Loading, Shape } from "@/components/m3/index.jsx";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const day = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : day(t); };
const FRESH = 3 * 864e5; // "New" for three days after an update arrives
const CHANNEL = { preview: "Preview", local: "Local build" };

function line(u) {
  const a = u.available, n = a?.number ? `Update ${a.number}` : "An update";
  switch (u.status) {
    case "checking": return { busy: true, text: "Checking for updates…" };
    case "downloading": return { icon: "sync", spin: true, text: `Downloading ${a?.number ? n.toLowerCase() : "an update"}…` };
    case "ready": return a?.reloadOnly ? { icon: "new_releases", tone: "primary", text: `${n} is out. Restart to load it.` }
      : { icon: "new_releases", tone: "primary", text: `${n} is ready. It installs ${(a?.minimum || 0) > RELEASE.number ? "right away, as it fixes something important" : "the next time you leave the app"}.` };
    case "applying": return { busy: true, text: `Restarting into ${n.toLowerCase()}…` };
    case "current": return { icon: "check_circle", tone: "ok", text: `You’re on the newest version. Checked ${ago(u.checkedAt)}.` };
    case "offline": return { icon: "cloud_off", text: "You’re offline. The app checks again once you’re back online." };
    case "stuck": return { icon: "hourglass_top", text: `${n} is out but hasn’t reached this phone yet. Try again in a few minutes.` };
    case "error": return { icon: "warning", tone: "warn", text: `Couldn’t check: ${u.error}` };
    case "unsupported": return { icon: "info", text: import.meta.env.DEV ? "Development server: it always serves the newest code." : "This browser can’t install updates in the background. Restart to load the newest version." };
    default: return { icon: "check_circle", text: "Updates download on their own and install when you leave the app." };
  }
}

function Notes({ r, tag }) {
  return (
    <li>
      <div className="flex items-baseline gap-2">
        <span className="type-title-s em tnum">Update {r.number}</span>
        {tag && <span className="type-label-m text-primary">{tag}</span>}
        <span className="ml-auto shrink-0 type-body-s text-on-surface-variant tnum">{day(r.date)}</span>
      </div>
      {r.notes?.length > 0 && (
        <ul className="mt-1 ml-5 list-disc space-y-1 type-body-m text-on-surface-variant marker:text-outline">
          {r.notes.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}
    </li>
  );
}

export function Updates() {
  const u = useUpdate(), r = RELEASE, s = line(u);
  const busy = u.status === "checking" || u.status === "applying";
  const ready = u.status === "ready";
  const fresh = u.from > 0 && u.from < r.number && Date.now() - u.installedAt < FRESH;
  // Releases this phone doesn't have yet: from what's live, or at least the one waiting.
  const ahead = [...(u.live?.history || []), ...(u.available?.number ? [u.available] : [])]
    .filter((x, i, all) => x.number > r.number && all.findIndex((y) => y.number === x.number) === i).sort((a, b) => b.number - a.number);
  const past = HISTORY.filter((x) => x.number <= r.number);
  return (
    <Section title="Updates" ar="التحديثات">
      <div className="flex items-center gap-4">
        <Shape name="cookie9" size={56} color="var(--md-sys-color-tertiary-container)">
          <span className="type-title-l em tnum text-on-tertiary-container">{r.number || "–"}</span>
        </Shape>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-title-m em">{r.number ? `Update ${r.number}` : "Development build"}</span>
            {fresh && <span className="rounded-full bg-tertiary px-2 py-0.5 type-label-s text-on-tertiary">New</span>}
            {CHANNEL[r.channel] && <span className="rounded-full bg-surface-container-highest px-2 py-0.5 type-label-s text-on-surface-variant">{CHANNEL[r.channel]}</span>}
          </div>
          <div className="truncate type-body-s text-on-surface-variant tnum">{[`v${r.version}`, day(r.date), r.sha].filter(Boolean).join(" · ")}</div>
        </div>
      </div>

      <div role="status" aria-live="polite" className={cn("mt-4 flex items-start gap-3 rounded-[20px] px-4 py-3", ready ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high")}>
        {s.busy ? <Loading size={24} label="Checking" /> : (
          <Icon name={s.icon} size={24} fill={s.tone === "ok" || s.tone === "primary"}
            className={cn("shrink-0", s.spin && "spin-slow [animation-duration:1.2s]", s.tone === "ok" ? "text-success" : s.tone === "warn" ? "text-warning" : s.tone === "primary" ? "" : "text-on-surface-variant")} />
        )}
        <p className={cn("min-w-0 flex-1 pt-0.5 type-body-m", !ready && "text-on-surface-variant")}>{s.text}</p>
      </div>

      <div className="mt-3 flex gap-2">
        {ready && <Button className="flex-1" onClick={applyUpdate}><Icon name="restart_alt" size={20} />Restart now</Button>}
        <Button variant={ready ? "outline" : "secondary"} className="flex-1" disabled={busy || u.status === "downloading"} onClick={checkForUpdate}>
          <Icon name="refresh" size={20} className={cn(u.status === "checking" && "spin-slow [animation-duration:1s]")} />Check for updates
        </Button>
      </div>

      <details className="group mt-4 border-t border-outline-variant">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-3 type-title-s [&::-webkit-details-marker]:hidden">
          <span className="flex-1">Release notes</span>
          {ahead.length > 0 && <span className="rounded-full bg-primary px-2 py-0.5 type-label-s text-on-primary tnum">{ahead.length} new</span>}
          <Icon name="expand_more" size={24} className="text-on-surface-variant transition-transform group-open:rotate-180" />
        </summary>
        {ahead.length + past.length ? (
          <ol className="flex flex-col gap-4 pb-1">
            {ahead.map((x) => <Notes key={x.number} r={x} tag="Available" />)}
            {past.map((x) => <Notes key={x.number} r={x} tag={x.number === r.number ? "On this phone" : null} />)}
          </ol>
        ) : <p className="pb-1 type-body-m text-on-surface-variant">No release notes yet.</p>}
      </details>
    </Section>
  );
}
