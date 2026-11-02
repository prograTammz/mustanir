// Material 3 Expressive components, sized and named after the spec, tuned for a game: shapes that morph, springs,
// wavy progress, haptics. Colors come from the M3 roles in src/styles/m3-tokens.css.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ICONS } from "./icons.js";
import { shapePath } from "./shapes.js";

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- haptics: Android vibrates; iOS 18+ taps when a native switch toggles, so a hidden one stands in ---------- */
let hapticLabel = null;
export function haptic(ms = 8) {
  try {
    if (navigator.vibrate) { navigator.vibrate(ms); return; }
    if (!hapticLabel) {
      hapticLabel = document.createElement("label"); hapticLabel.setAttribute("aria-hidden", "true"); hapticLabel.style.display = "none";
      const input = document.createElement("input"); input.type = "checkbox"; input.setAttribute("switch", ""); hapticLabel.append(input); document.body.append(hapticLabel);
    }
    hapticLabel.click();
  } catch { /* no haptics here */ }
}

/* ---------- Material Symbols Rounded ---------- */
export function Icon({ name, fill = false, size = 24, className, style, label }) {
  const d = ICONS[name], p = d ? (fill && d.f) || d.o : "";
  return (
    <svg viewBox="0 -960 960 960" width={size} height={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      className={cn("shrink-0 fill-current", className)} style={style}><path d={p} /></svg>
  );
}

/* ---------- expressive shapes, morphing when `name` changes ---------- */
export function Shape({ name = "circle", size = 48, color, rot = 0, spin = false, className, style, children, label }) {
  const d = shapePath(name, rot), prev = useRef(d), anim = useRef(null);
  useLayoutEffect(() => {
    if (prev.current === d) return;
    const a = anim.current;
    if (a && !reduced()) { a.setAttribute("from", prev.current); a.setAttribute("to", d); try { a.beginElement(); } catch { /* no SMIL */ } }
    prev.current = d;
  }, [d]);
  return (
    <span role={label ? "img" : undefined} aria-label={label} className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size, ...style }}>
      <svg viewBox="0 0 100 100" aria-hidden className={cn("absolute inset-0 size-full overflow-visible", spin && "spin-slow")}>
        <path d={d} style={{ fill: color || "currentColor", transition: "fill .3s" }}>
          <animate ref={anim} attributeName="d" dur="0.6s" begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 1.4 0.4 1" />
        </path>
      </svg>
      {children != null && <span className="relative grid place-items-center">{children}</span>}
    </span>
  );
}

/** The M3 Expressive loading indicator: a shape that keeps morphing as it turns. */
const LOADING = ["softBurst", "cookie9", "pentagon", "clover4", "sunny", "cookie4", "circle"];
export function Loading({ size = 48, color = "var(--md-sys-color-primary)", contained = false, className, label = "Loading" }) {
  const values = [...LOADING, LOADING[0]].map((n) => shapePath(n)).join(";");
  const splines = Array(LOADING.length).fill("0.3 1.3 0.4 1").join(";");
  return (
    <span role="progressbar" aria-label={label} className={cn("relative grid shrink-0 place-items-center rounded-full", contained && "bg-primary-container", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden className="spin-slow size-[70%]" style={{ animationDuration: "4.2s" }}>
        <path d={shapePath(LOADING[0])} style={{ fill: color }}>
          {!reduced() && <animate attributeName="d" values={values} dur="4.2s" repeatCount="indefinite" calcMode="spline" keyTimes={LOADING.map((_, i) => (i / LOADING.length).toFixed(3)).concat("1").join(";")} keySplines={splines} />}
        </path>
      </svg>
    </span>
  );
}

/* ---------- buttons: the corners morph on press (round to squarer); a selected toggle stays square ---------- */
const BTN_SIZE = {
  xs: "h-8 px-3 gap-1 type-label-l [--rp:8px] [--rs:12px]",
  s: "h-10 px-4 gap-2 type-label-l [--rp:8px] [--rs:12px]",
  m: "h-14 px-6 gap-2 type-title-m [--rp:12px] [--rs:16px]",
  l: "h-24 px-12 gap-3 type-headline-s [--rp:16px] [--rs:28px]",
};
const BTN_VARIANT = {
  filled: "bg-primary text-on-primary",
  tonal: "bg-secondary-container text-on-secondary-container",
  outlined: "border border-outline-variant text-on-surface-variant",
  text: "text-primary",
  elevated: "bg-surface-container-low text-primary elev-1",
  tertiary: "bg-tertiary text-on-tertiary",
  gold: "bg-tertiary-container text-on-tertiary-container",
  error: "bg-error text-on-error",
  errorTonal: "bg-error-container text-on-error-container",
  surface: "bg-surface-container-highest text-on-surface",
};
export function Button({ variant = "filled", size = "s", icon, iconFill, iconEnd, selected, className, children, as: C = "button", onClick, ...p }) {
  const isz = size === "xs" ? 18 : size === "s" ? 20 : size === "m" ? 24 : 32;
  return (
    <C type={C === "button" ? "button" : undefined} data-selected={selected === undefined ? undefined : String(!!selected)} aria-pressed={selected === undefined ? undefined : !!selected}
      onClick={(e) => { haptic(); onClick?.(e); }}
      className={cn("m3-btn state inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none", BTN_SIZE[size], BTN_VARIANT[variant], className)} {...p}>
      {icon && <Icon name={icon} size={isz} fill={iconFill} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={isz} />}
    </C>
  );
}

const IB_SIZE = { xs: ["size-8", 20], s: ["size-10", 24], m: ["size-14", 24], l: ["size-24", 32] };
const IB_VARIANT = {
  standard: (on) => (on ? "text-primary" : "text-on-surface-variant"),
  filled: (on) => (on === false ? "bg-surface-container-highest text-primary" : "bg-primary text-on-primary"),
  tonal: (on) => (on ? "bg-secondary text-on-secondary" : "bg-secondary-container text-on-secondary-container"),
  outlined: (on) => (on ? "bg-inverse-surface text-inverse-on-surface" : "border border-outline-variant text-on-surface-variant"),
  surface: () => "bg-surface-container-highest text-on-surface",
};
export function IconButton({ icon, label, variant = "standard", size = "s", selected, fill, className, onClick, iconClassName, ...p }) {
  const [box, isz] = IB_SIZE[size];
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={selected === undefined ? undefined : !!selected} data-selected={selected === undefined ? undefined : String(!!selected)}
      onClick={(e) => { haptic(); onClick?.(e); }}
      className={cn("m3-btn state grid shrink-0 place-items-center [--rp:12px] [--rs:14px]", box, IB_VARIANT[variant](selected), className)} {...p}>
      <Icon name={icon} size={isz} fill={fill ?? !!selected} className={iconClassName} />
    </button>
  );
}

/** M3 Expressive connected button group (the successor of segmented buttons): the selected one turns fully round. */
export function Connected({ value, onChange, options, size = "s", className, label }) {
  const h = size === "xs" ? "h-8 type-label-l" : size === "m" ? "h-14 type-title-m" : "h-10 type-label-l";
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex w-full gap-0.5", className)}>
      {options.map((o, i) => {
        const on = o.value === value, first = i === 0, last = i === options.length - 1;
        const r = on ? "999px" : `${first ? "999px" : "8px"} ${last ? "999px" : "8px"} ${last ? "999px" : "8px"} ${first ? "999px" : "8px"}`;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => { haptic(); onChange(o.value); }}
            className={cn("m3-btn state flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3", h, on ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-highest text-on-surface-variant")}
            style={{ "--r": r, "--rp": "6px" }}>
            {o.icon && <Icon name={on ? "check" : o.icon} size={18} />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- chips (8 dp corners): filter chips show a check when selected ---------- */
export function Chip({ selected, onClick, icon, children, tone = "secondary", className, size = "m", disabled, trailing, ...p }) {
  const on = !!selected;
  const toneOn = { secondary: "bg-secondary-container text-on-secondary-container", error: "bg-error-container text-on-error-container", tertiary: "bg-tertiary-container text-on-tertiary-container", primary: "bg-primary text-on-primary" }[tone];
  return (
    <button type="button" aria-pressed={selected === undefined ? undefined : on} disabled={disabled} onClick={(e) => { haptic(); onClick?.(e); }}
      className={cn("state inline-flex shrink-0 items-center gap-1.5 rounded-lg border type-label-l transition-[background-color,color,border-color] duration-200 select-none disabled:opacity-60",
        size === "s" ? "h-7 px-2.5" : "h-8 px-3", on ? cn("border-transparent", toneOn) : "border-outline-variant text-on-surface-variant", (icon || on) && "pl-2", className)} {...p}>
      {on && selected !== undefined ? <Icon name="check" size={18} /> : icon ? <Icon name={icon} size={18} /> : null}
      {children}
      {trailing}
    </button>
  );
}

/* ---------- selection controls ---------- */
export function Switch({ checked, onCheckedChange, id, label, disabled, className }) {
  return (
    <button type="button" role="switch" id={id} aria-checked={!!checked} aria-label={label} disabled={disabled}
      onClick={() => { haptic(); onCheckedChange?.(!checked); }} className={cn("m3-switch", className)}>
      <i><Icon name="check" size={16} /></i>
    </button>
  );
}
export function Checkbox({ checked, onChange, label, className, color }) {
  return (
    <button type="button" role="checkbox" aria-checked={!!checked} aria-label={label} onClick={() => { haptic(); onChange?.(!checked); }}
      className={cn("state -m-2 grid size-10 shrink-0 place-items-center rounded-full text-primary", className)}>
      <span className={cn("grid size-[22px] place-items-center rounded-[7px] border-2 transition-all duration-200", checked ? "border-transparent text-on-primary" : "border-on-surface-variant")}
        style={checked ? { background: color || "var(--md-sys-color-primary)" } : undefined}>
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="22" strokeDashoffset={checked ? 0 : 22} style={{ transition: "stroke-dashoffset .3s cubic-bezier(.2,0,0,1) .05s" }} />
        </svg>
      </span>
    </button>
  );
}

/* ---------- containers ---------- */
const CARD = {
  filled: "bg-surface-container", low: "bg-surface-container-low", high: "bg-surface-container-high", highest: "bg-surface-container-highest",
  elevated: "bg-surface-container-low elev-1", outlined: "border border-outline-variant bg-surface",
};
export function Card({ variant = "filled", className, children, as: C = "div", ...p }) {
  return <C className={cn("rounded-[28px]", CARD[variant], className)} {...p}>{children}</C>;
}
export function SectionTitle({ children, trailing, className, sub }) {
  return (
    <div className={cn("flex items-end justify-between gap-3 px-1 pt-5 pb-2", className)}>
      <div className="min-w-0"><h2 className="type-title-l em truncate">{children}</h2>{sub && <p className="type-body-s text-on-surface-variant">{sub}</p>}</div>
      {trailing}
    </div>
  );
}
export function ListItem({ leading, headline, supporting, trailing, onClick, className, as, ...p }) {
  const C = as || (onClick ? "button" : "div");
  return (
    <C type={C === "button" ? "button" : undefined} onClick={onClick} className={cn("flex min-h-14 w-full items-center gap-4 py-2 text-left", onClick && "state -mx-2 rounded-2xl px-2", className)} {...p}>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="type-body-l truncate">{headline}</div>
        {supporting && <div className="type-body-m text-on-surface-variant">{supporting}</div>}
      </div>
      {trailing}
    </C>
  );
}

/* ---------- progress: wavy linear and circular (M3 Expressive) ---------- */
export function useTween(target, ms = 800) {
  const [v, setV] = useState(target), cur = useRef(target);
  useEffect(() => {
    if (reduced() || cur.current === target) { cur.current = target; setV(target); return; }
    const a = cur.current, t0 = performance.now(); let raf;
    const step = (t) => { const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 4; cur.current = a + (target - a) * e; setV(cur.current); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
const WAVE = (h, w) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='${h}'%3E%3Cpath d='M0 ${h / 2}Q6 ${h / 2 - 2 * (h / 2 - w / 2 - 0.5)} 12 ${h / 2}T24 ${h / 2}' fill='none' stroke='black' stroke-width='${w}'/%3E%3C/svg%3E")`;
export function Progress({ value = 0, color = "var(--md-sys-color-primary)", track, wavy = false, thick = false, className, label, stop = true }) {
  const v = Math.max(0, Math.min(1, useTween(value || 0))), w = thick ? 8 : 4, h = wavy ? (thick ? 16 : 10) : w;
  const waving = wavy && v > 0.02 && v < 0.999;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className={cn("relative flex w-full items-center gap-1", className)} style={{ height: h }}>
      {v > 0.005 && (
        <div className={cn("shrink-0", waving && "wave")} style={{ width: `calc(${v * 100}% - ${v < 1 ? 2 : 0}px)`, height: waving ? h : w, borderRadius: 999, background: color, "--wave": WAVE(h, w) }} />
      )}
      {v < 0.999 && <div className="relative h-full min-w-1 flex-1" style={{ height: w }}>
        <div className="absolute inset-0 rounded-full" style={{ background: track || `color-mix(in srgb, ${color} 22%, transparent)` }} />
        {stop && <div className="absolute top-0 right-0 rounded-full" style={{ width: w, height: w, background: color }} />}
      </div>}
    </div>
  );
}

function arc(cx, cy, r, a0, a1) { // degrees, clockwise from 12 o'clock
  const p = (a) => [cx + r * Math.cos(((a - 90) * Math.PI) / 180), cy + r * Math.sin(((a - 90) * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function waveArc(cx, cy, r, amp, waves, a0, a1) {
  const n = Math.max(2, Math.ceil(a1 - a0) * 2), pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, rr = r + amp * Math.sin(((a * Math.PI) / 180) * waves);
    pts.push(`${(cx + rr * Math.cos(((a - 90) * Math.PI) / 180)).toFixed(2)} ${(cy + rr * Math.sin(((a - 90) * Math.PI) / 180)).toFixed(2)}`);
  }
  return "M" + pts.join("L");
}
export function Ring({ value = 0, size = 48, stroke = 4, color = "var(--md-sys-color-primary)", track, wavy = false, label, className, children }) {
  const v = Math.max(0, Math.min(1, useTween(value || 0))), amp = wavy ? Math.max(1.2, stroke * 0.38) : 0;
  const c = size / 2, r = c - stroke / 2 - amp, gap = v > 0 && v < 1 ? ((stroke + 4) / r) * (180 / Math.PI) : 0;
  const end = 360 * v, waves = Math.max(6, Math.round((2 * Math.PI * r) / (stroke * 5)));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100} className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
        {v < 1 && <path d={v > 0 ? arc(c, c, r, end + gap, 360 - gap) : arc(c, c, r, 0, 359.99)} fill="none" stroke={track || `color-mix(in srgb, ${color} 22%, transparent)`} strokeWidth={stroke} strokeLinecap="round" />}
        {v > 0.004 && (v >= 1 ? <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke} />
          : <path d={wavy ? waveArc(c, c, r, amp, waves, 0, end) : arc(c, c, r, 0, Math.max(0.5, end))} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      {children != null && <div className="relative grid place-items-center text-center">{children}</div>}
    </div>
  );
}

/* ---------- small things ---------- */
export function Badge({ children, className, tone = "error" }) {
  const t = { error: "bg-error text-on-error", tertiary: "bg-tertiary text-on-tertiary", primary: "bg-primary text-on-primary" }[tone];
  return <span className={cn("inline-grid h-4 min-w-4 place-items-center rounded-full px-1 type-label-s tnum", t, className)}>{children}</span>;
}
export function Divider({ className }) { return <div role="separator" className={cn("h-px bg-outline-variant", className)} />; }
/** An XP reward pill: gold when earned in full. */
export function XP({ earned, max, plus, className, size = "m" }) {
  const full = max != null && earned >= max;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full tnum em", size === "s" ? "h-6 px-2 type-label-m" : "h-7 px-2.5 type-label-l",
      full ? "bg-tertiary text-on-tertiary" : "bg-tertiary-container text-on-tertiary-container", className)}>
      <Icon name="bolt" size={size === "s" ? 14 : 16} fill />
      {plus ?? (max != null ? `${earned}/${max}` : earned)}
    </span>
  );
}
