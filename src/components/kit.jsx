// Small building blocks shared by every screen.
import { useState } from "react";
import { Minus, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const PATHS = {
  body: "M4 12h16M7 8v8M17 8v8M4.5 10v4M19.5 10v4",
  knowledge: "M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13",
  faith: "M15.5 4.5a8 8 0 1 0 4 11 6.5 6.5 0 1 1-4-11z M17.5 8.5l.6 1.6 1.7.1-1.3 1 .4 1.7-1.4-.9-1.4.9.4-1.7-1.3-1 1.7-.1z",
  habits: "M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9",
  purity: "M12 3.5c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.5 6-10.5z",
  president: "M12 2l2.4 4.2 4.7-1-1 4.7L22 12l-4.2 2.4 1 4.7-4.7-1L12 22l-2.4-4.2-4.7 1 1-4.7L2 12l4.2-2.4-1-4.7 4.7 1z",
};
export const mColor = (key) => (key === "president" ? "var(--gold)" : `var(--m-${key})`);

export function Emblem({ k, size = 40, className }) {
  const c = mColor(k);
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-[30%]", className)}
      style={{ width: size, height: size, color: c, background: `color-mix(in oklch, ${c} 14%, transparent)` }}>
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={PATHS[k]} /></svg>
    </span>
  );
}

export function Ar({ children, className, ...p }) {
  return <span lang="ar" dir="rtl" className={cn("ar", className)} {...p}>{children}</span>;
}

// The iOS large title: a small caption over the 34 pt title, the Arabic name across from it.
export function LargeTitle({ title, ar, caption }) {
  return (
    <div className="px-1 pt-0.5 pb-1">
      {caption && <p className="truncate text-[12.5px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">{caption}</p>}
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="min-w-0 truncate text-[34px] leading-[1.15] font-bold tracking-[-0.022em]">{title}</h1>
        {ar && <Ar className="shrink-0 text-[17px] text-gold">{ar}</Ar>}
      </div>
    </div>
  );
}

// A progress ring like Apple's Activity rings: one measure, its own colour, the number inside.
export function Ring({ value = 0, color = "var(--primary)", size = 44, stroke = 5, label, children, className }) {
  const r = size / 2 - stroke / 2 - 0.5, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, value || 0));
  return (
    <div role="img" aria-label={label ? `${label}: ${Math.round(f * 100)}%` : undefined} className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`color-mix(in oklch, ${color} 18%, transparent)`} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - f)} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-bold tnum">{children ?? Math.round(f * 100)}</span>
    </div>
  );
}

// A card with a quiet title. (The Arabic name is kept for screen readers only: the UI stays minimal.)
export function Section({ title, ar, desc, right, children, className, contentClassName }) {
  return (
    <Card className={className}>
      {(title || right) && (
        <CardHeader className="items-center">
          <div className="min-w-0">
            <CardTitle>{title}{ar && <span className="sr-only"> · {ar}</span>}</CardTitle>
            {desc && <CardDescription className="mt-1">{desc}</CardDescription>}
          </div>
          {right}
        </CardHeader>
      )}
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export function Stat({ value, label, className, tone }) {
  return (
    <div className={cn("rounded-2xl bg-muted px-3.5 py-3", className)}>
      <div className={cn("text-[22px] leading-tight font-bold tracking-tight tnum", tone === "ok" && "text-ok", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function Hint({ children, className }) {
  return <p className={cn("text-[13px] leading-relaxed text-muted-foreground", className)}>{children}</p>;
}

export function Subhead({ children, className }) {
  return <div className={cn("mt-5 mb-2 text-[12px] font-semibold tracking-[0.06em] text-muted-foreground uppercase", className)}>{children}</div>;
}

// A labelled row: label on the left (wraps on small screens), control on the right.
export function Row({ label, sub, children, className }) {
  return (
    <div className={cn("flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t py-2.5 first:border-t-0", className)}>
      <div className="min-w-0 flex-1 basis-40">
        <div className="text-[15px] leading-snug">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

export function Stepper({ value = 0, step = 1, onChange, label }) {
  return (
    <div className="flex items-center rounded-full bg-muted">
      <button aria-label={`Less ${label || ""}`} className="grid size-10 place-items-center rounded-full active:bg-muted" onClick={() => onChange(Math.max(0, (value || 0) - step))}><Minus className="size-4" /></button>
      <input aria-label={label} type="number" inputMode="numeric" min="0" value={value || 0} onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
        className="w-12 bg-transparent text-center text-base font-semibold tnum outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      <button aria-label={`More ${label || ""}`} className="grid size-10 place-items-center rounded-full active:bg-muted" onClick={() => onChange((value || 0) + step)}><Plus className="size-4" /></button>
    </div>
  );
}

// A tappable chip that can be on or off (aria-pressed), for quick logging.
export function Chip({ on, onClick, children, tone = "primary", size = "md", className, ...p }) {
  return (
    <button aria-pressed={!!on} onClick={onClick} {...p}
      className={cn("press inline-flex items-center justify-center gap-1.5 rounded-full border border-transparent bg-muted font-medium select-none",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        on && tone === "primary" && "border-primary bg-primary text-primary-foreground",
        on && tone === "bad" && "border-bad bg-bad text-white",
        on && tone === "ok" && "border-ok bg-ok text-white",
        on && tone === "warn" && "border-warn bg-warn text-white",
        className)}>
      {children}
    </button>
  );
}

export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")} m` : `${Math.round(m)} min`);
export const SHORT = { day: "numeric", month: "short", year: "numeric" };
export const pctTxt = (x) => (x == null ? "—" : Math.round(x * 100) + "%");

// A section that opens on tap: a title and a one-line summary when closed.
export function Fold({ title, summary, children, defaultOpen = false, className }) {
  // Open or closed on first render only; after that it's yours. (A live `open` prop would snap it shut under your finger,
  // e.g. when cancelling the last upcoming session.)
  const [initial] = useState(defaultOpen);
  return (
    <details open={initial || undefined} className={cn("group", className)}>
      <summary className="press flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span className="text-[15px] font-medium">{title}</span>
        <span className="ml-auto truncate text-[13px] text-muted-foreground tnum">{summary}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="pb-1">{children}</div>
    </details>
  );
}

// A small measured number: label, value, and whether it met its goal.
export function Tile({ label, value, sub, hit, icon: Icon }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-muted px-3 py-2.5">
      <div className="flex items-center gap-1 text-[11.5px] text-muted-foreground">{Icon && <Icon className="size-3.5" />}<span className="truncate">{label}</span></div>
      <div className={cn("text-[19px] leading-tight font-semibold tracking-tight tnum", hit === true && "text-ok", hit === false && "text-foreground")}>{value}</div>
      {sub && <div className="truncate text-[11px] text-muted-foreground tnum">{sub}</div>}
    </div>
  );
}

// A thin progress bar.
export function Bar({ value = 0, color = "var(--primary)", className }) {
  const f = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${f * 100}%`, background: color }} />
    </div>
  );
}

// A round tick for tasks.
export function Tick({ on, onClick, label }) {
  return (
    <button role="checkbox" aria-checked={!!on} aria-label={label} onClick={onClick}
      className={cn("press grid size-6 shrink-0 place-items-center rounded-full border-[1.5px]", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
      {on && <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>}
    </button>
  );
}

export function useToggle(init = false) { const [v, setV] = useState(init); return [v, () => setV((x) => !x), setV]; }
