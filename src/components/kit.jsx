// Small building blocks shared by every screen.
import { Minus, Plus } from "lucide-react";
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

// A card with the English title on the left and the Arabic name on the right.
export function Section({ title, ar, desc, right, children, className, contentClassName }) {
  return (
    <Card className={className}>
      {(title || ar || right) && (
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {desc && <CardDescription className="mt-1">{desc}</CardDescription>}
          </div>
          {right ?? (ar && <Ar className="text-gold text-lg leading-none pt-0.5 whitespace-nowrap shrink-0">{ar}</Ar>)}
        </CardHeader>
      )}
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export function Stat({ value, label, className, tone }) {
  return (
    <div className={cn("rounded-2xl bg-muted/70 px-3.5 py-3", className)}>
      <div className={cn("text-[22px] leading-tight font-bold tracking-tight tnum", tone === "ok" && "text-ok", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function Hint({ children, className }) {
  return <p className={cn("text-[13px] leading-relaxed text-muted-foreground", className)}>{children}</p>;
}

export function Subhead({ children, className }) {
  return <div className={cn("mt-5 mb-2 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase", className)}>{children}</div>;
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
    <div className="flex items-center rounded-full border bg-background/60 dark:bg-input/30">
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
      className={cn("inline-flex items-center justify-center gap-1.5 rounded-full border bg-card font-medium transition-all select-none active:scale-[0.96]",
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
