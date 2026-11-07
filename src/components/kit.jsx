// Small building blocks shared by every screen, on Material 3 (see src/components/m3 for the primitives).
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon, Shape, Ring as M3Ring, Progress, Checkbox, Chip as M3Chip, haptic } from "@/components/m3/index.jsx";

// Each minister's identity: a color (M3 custom color), an expressive shape and a symbol.
export const MIN = {
  body: { shape: "cookie4", rot: 45, icon: "fitness_center" },
  knowledge: { shape: "cookie6", icon: "menu_book" },
  faith: { shape: "flower", icon: "mosque" },
  habits: { shape: "clover4", rot: 45, icon: "routine" },
  purity: { shape: "gem", icon: "shield" },
  president: { shape: "verySunny", icon: "crown" },
  tasks: { shape: "cookie9", icon: "task_alt" },
};
export const mColor = (key) => (key === "president" || key === "tasks" ? "var(--md-sys-color-tertiary)" : `var(--md-custom-color-${key}-vivid)`);
export const mContainer = (key) => (key === "president" || key === "tasks" ? "var(--md-sys-color-tertiary-container)" : `var(--md-custom-color-${key}-container)`);
export const mOnContainer = (key) => (key === "president" || key === "tasks" ? "var(--md-sys-color-on-tertiary-container)" : `var(--md-custom-color-on-${key}-container)`);

/** A minister's emblem: its shape in its container color, its symbol on top. `solid` fills with the vivid color instead. */
export function Emblem({ k, size = 40, solid = false, className, done = false }) {
  const m = MIN[k] || MIN.president;
  return (
    <Shape name={m.shape} rot={m.rot || 0} size={size} color={solid || done ? mColor(k) : mContainer(k)} className={className}>
      <Icon name={done ? "check" : m.icon} fill size={Math.round(size * 0.5)} style={{ color: solid || done ? "var(--md-sys-color-surface)" : mOnContainer(k) }} />
    </Shape>
  );
}

export function Ar({ children, className, ...p }) {
  return <span lang="ar" dir="rtl" className={cn("ar", className)} {...p}>{children}</span>;
}

// The top of the screen, dressed for the palace: an astrolabe from the House of Wisdom, ring and star turning against each
// other, and embers rising past the clock.
export function Astrolabe({ className }) {
  return (
    <span aria-hidden="true" className={cn("m3-astrolabe", className)}>
      <svg viewBox="0 0 200 200" className="dial"><g fill="none" stroke="currentColor"><circle cx="100" cy="100" r="98" strokeWidth="1.5" /><circle cx="100" cy="100" r="90" strokeWidth="8" strokeDasharray="1.5 7.925" /><circle cx="100" cy="100" r="82" /></g></svg>
      <svg viewBox="0 0 200 200" className="rete"><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><rect x="46" y="46" width="108" height="108" rx="4" /><rect x="46" y="46" width="108" height="108" rx="4" transform="rotate(45 100 100)" /><circle cx="100" cy="100" r="40" /></g><circle cx="100" cy="100" r="5" fill="currentColor" /></svg>
    </span>
  );
}
// [left %, seconds, delay, drift px]
const EMBERS = [[14, 5.2, 0, 8], [62, 6.4, 1.1, -10], [38, 4.6, 2.3, 6], [84, 5.8, 0.6, -6], [26, 6.8, 3.2, 12], [72, 4.9, 1.9, 10], [50, 5.5, 4.1, -8], [92, 6.1, 2.8, -12]];
export function Embers({ count = EMBERS.length }) {
  return EMBERS.slice(0, count).map(([x, d, w, dx]) => <i key={x} aria-hidden="true" className="m3-ember" style={{ left: `${x}%`, animationDuration: `${d}s`, animationDelay: `${w}s`, "--dx": `${dx}px` }} />);
}
// A screen's opening: full width on the banner's emerald, dissolving into the page. Dark roles in both themes, since it stays dark.
export function Hero({ oath = false, className, children }) {
  return <div className={cn("m3-hero dark text-on-surface", oath && "oath", className)}>{children}</div>;
}

// A screen's headline: the M3 Expressive "headline large emphasized", the Arabic name across from it.
export function LargeTitle({ title, ar, caption }) {
  return (
    <Hero>
      <div className="rise px-1 pt-2 pb-1">
        {caption && <p className="type-label-l truncate text-on-surface-variant">{caption}</p>}
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="type-headline-l em min-w-0 truncate">{title}</h1>
          {ar && <Ar className="shrink-0 text-[20px] text-tertiary">{ar}</Ar>}
        </div>
      </div>
    </Hero>
  );
}

// A progress ring: one measure, its own colour, the number inside.
export function Ring({ value = 0, color = "var(--md-sys-color-primary)", size = 44, stroke = 5, label, children, className, wavy }) {
  return (
    <M3Ring value={value} color={color} size={size} stroke={stroke} label={label} className={className} wavy={wavy}>
      <span className="type-label-m em tnum">{children ?? Math.round(Math.max(0, Math.min(1, value || 0)) * 100)}</span>
    </M3Ring>
  );
}

// A card with a title (title large, emphasized), an optional line under it, and something on the right.
export function Section({ title, ar, desc, right, children, className, contentClassName, icon }) {
  return (
    <section className={cn("rise rounded-[28px] bg-surface-container py-5", className)}>
      {(title || right) && (
        <div className="mb-3 flex items-start justify-between gap-3 px-5">
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <div className="min-w-0">
              <h2 className="type-title-l em">{title}{ar && <span className="sr-only"> · {ar}</span>}</h2>
              {desc && <p className="mt-0.5 type-body-m text-on-surface-variant">{desc}</p>}
            </div>
          </div>
          {right}
        </div>
      )}
      <div className={cn("px-5", contentClassName)}>{children}</div>
    </section>
  );
}

export function Stat({ value, label, className, tone, icon }) {
  return (
    <div className={cn("rounded-[20px] bg-surface-container-high px-4 py-3", className)}>
      {icon}
      <div className={cn("type-title-l em tnum", tone === "ok" && "text-success", tone === "warn" && "text-warning", tone === "bad" && "text-error")}>{value}</div>
      <div className="mt-0.5 type-body-s text-on-surface-variant">{label}</div>
    </div>
  );
}

export function Hint({ children, className }) {
  return <p className={cn("type-body-m text-on-surface-variant", className)}>{children}</p>;
}

export function Subhead({ children, className }) {
  return <div className={cn("mt-5 mb-2 type-title-s text-primary", className)}>{children}</div>;
}

// A labelled row: label on the left (wraps on small screens), control on the right.
export function Row({ label, sub, children, className }) {
  return (
    <div className={cn("flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2", className)}>
      <div className="min-w-0 flex-1 basis-40">
        <div className="type-body-l">{label}</div>
        {sub && <div className="type-body-m text-on-surface-variant">{sub}</div>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

// A tappable chip that can be on or off (aria-pressed), for quick logging.
export function Chip({ on, onClick, children, tone = "primary", size = "md", className, icon, ...p }) {
  return <M3Chip selected={!!on} onClick={onClick} tone={tone === "bad" ? "error" : tone === "primary" ? "secondary" : tone} size={size === "sm" ? "m" : "m"} icon={icon} className={className} {...p}>{children}</M3Chip>;
}

export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")} m` : `${Math.round(m)} min`);
export const SHORT = { day: "numeric", month: "short", year: "numeric" };
export const pctTxt = (x) => (x == null ? "—" : Math.round(x * 100) + "%");

// A section that opens on tap: a title and a one-line summary when closed. Open state is taken on first render only.
export function Fold({ title, summary, children, defaultOpen = false, className, leading }) {
  const [initial] = useState(defaultOpen);
  return (
    <details open={initial || undefined} className={cn("group", className)} onToggle={() => haptic(5)}>
      <summary className="state -mx-2 flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-2xl px-2 [&::-webkit-details-marker]:hidden">
        {leading}
        <span className="shrink-0 type-title-m">{title}</span>
        <span className="ml-auto min-w-0 truncate type-body-m text-on-surface-variant tnum">{summary}</span>
        <Icon name="expand_more" size={22} className="shrink-0 text-on-surface-variant transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="pb-1">{children}</div>
    </details>
  );
}

// A small measured number: label, value, and whether it met its goal (a check badge when it did).
export function Tile({ label, value, sub, hit, icon }) {
  return (
    <div className={cn("relative flex min-w-0 flex-col gap-0.5 rounded-[20px] px-3 py-2.5 transition-colors", hit === true ? "bg-success-container text-on-success-container" : "bg-surface-container-high")}>
      <div className={cn("flex items-center gap-1 type-label-m", hit === true ? "opacity-80" : "text-on-surface-variant")}>{icon && <Icon name={hit === true ? "check_circle" : icon} fill={hit === true} size={14} />}<span className="truncate">{label}</span></div>
      <div className="type-title-l em tnum">{value}</div>
      {sub && <div className={cn("truncate type-label-s tnum", hit === true ? "opacity-75" : "text-on-surface-variant")}>{sub}</div>}
    </div>
  );
}

// A progress bar (M3 linear progress; wavy while it's under way).
export function Bar({ value = 0, color = "var(--md-sys-color-primary)", className, wavy = false, thick = false }) {
  return <Progress value={value} color={color} className={className} wavy={wavy} thick={thick} stop={false} />;
}

// A checkbox for tasks.
export function Tick({ on, onClick, label, color }) {
  return <Checkbox checked={!!on} onChange={onClick} label={label} color={color} />;
}

export function useToggle(init = false) { const [v, setV] = useState(init); return [v, () => setV((x) => !x), setV]; }
export { Icon, Shape };

/** Your level, on the gold seal (the M3 "very sunny" shape: the eight-pointed star of the brand, softened). */
export function Seal({ level, size = 56, dim = false, spin = false, className }) {
  return (
    <Shape name="verySunny" size={size} spin={spin} color={dim ? "var(--md-sys-color-surface-container-highest)" : "var(--md-sys-color-tertiary-fixed-dim)"} className={className}>
      <span className={cn("em-x tnum leading-none", dim ? "text-on-surface-variant" : "text-on-tertiary-fixed")} style={{ fontSize: Math.round(size * 0.36) }}>{level}</span>
    </Shape>
  );
}

// Which minister a medal belongs to (its colour and shape in the trophy room).
export function medalKind(id) {
  if (/^pray/.test(id)) return "faith";
  if (/^(fajr|regular|slept|green)/.test(id)) return "habits";
  if (/^(weigh|under|iron|deficit|steps|vital)/.test(id)) return "body";
  if (/^(pure|abstain)/.test(id)) return "purity";
  if (/^(read|pages|chancellor)/.test(id)) return "knowledge";
  return "president";
}
export const fmtN = (x) => (x == null ? "—" : x >= 1000 ? Math.round(x).toLocaleString("en") : Math.round(x * 10) / 10);
