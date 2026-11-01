// Charts: one measure per chart, recessive axes, a readout on every point, colour carries identity only.
// Hand-drawn SVG (recharts was 155 kB gzipped for this one chart): daily values as faint dots, the rolling average as a
// smooth line over a soft fill, an optional goal as a dashed rule; drag a finger across it to read any day.
import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { pctTxt } from "./kit";

const fmtDay = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
const nice = (v, digits) => (v == null || !isFinite(v) ? "—" : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en") : v.toFixed(digits));
// Monotone cubic (Fritsch–Carlson): smooth, and never overshoots between points the way a plain spline does.
function smoothPath(P) {
  if (P.length < 2) return "";
  const n = P.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0] || 1));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  let out = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (P[i + 1][0] - P[i][0]) / 3;
    out += `C${(P[i][0] + h).toFixed(1)},${(P[i][1] + m[i] * h).toFixed(1)} ${(P[i + 1][0] - h).toFixed(1)},${(P[i + 1][1] - m[i + 1] * h).toFixed(1)} ${P[i + 1][0].toFixed(1)},${P[i + 1][1].toFixed(1)}`;
  }
  return out;
}

export function TrendChart({ points, unit = "", digits = 0, color = "var(--primary)", smooth = 7, goal = null, height = 170, min = null, max = null }) {
  const gid = useId().replace(/:/g, ""), box = useRef(null), [hover, setHover] = useState(null);
  const data = useMemo(() => (points || []).map((p, i, a) => {
    const w = a.slice(Math.max(0, i - smooth + 1), i + 1);
    return { d: p[0], v: p[1], avg: w.reduce((s, q) => s + q[1], 0) / w.length };
  }), [points, smooth]);
  if (data.length < 2) return <div className="grid h-24 place-items-center text-sm text-muted-foreground">Not enough data yet</div>;
  const W = 340, H = height, L = 40, R = 6, T = 8, B = 22;
  const vals = data.map((x) => x.v).concat(goal != null ? [goal] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
  if (min != null) lo = Math.max(lo, min); if (max != null) hi = Math.min(hi, max);
  const x = (i) => L + (i / (data.length - 1)) * (W - L - R), y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const line = smoothPath(data.map((p, i) => [x(i), y(p.avg)]));
  const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);
  const xt = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const pick = (e) => {
    const r = box.current.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(((px - L) / (W - L - R)) * (data.length - 1)))));
  };
  const h = hover != null ? data[hover] : null;
  return (
    <div className="relative -mx-1 touch-pan-y select-none" ref={box} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Trend from ${fmtDay(data[0].d)} to ${fmtDay(data.at(-1).d)}: latest ${nice(data.at(-1).v, digits)} ${unit}`}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--muted-foreground)" className="tnum">{nice(v, digits)}</text>
          </g>
        ))}
        {xt.map((i, k) => <text key={k} x={x(i)} y={H - 6} textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"} fontSize="10.5" fill="var(--muted-foreground)">{fmtDay(data[i].d)}</text>)}
        {goal != null && <line x1={L} x2={W - R} y1={y(goal)} y2={y(goal)} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity="0.7" />}
        <path d={`${line}L${x(data.length - 1)},${H - B}L${L},${H - B}Z`} fill={`url(#${gid})`} />
        {smooth > 1 && data.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r="1.6" fill={color} fillOpacity="0.35" />)}
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.avg)} r="4.5" fill={color} stroke="var(--card)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg" style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 60px), calc(100% - 132px))` }}>
          <div className="text-muted-foreground">{fmtDay(h.d)}</div>
          <div className="mt-0.5 text-sm font-semibold tnum">{nice(h.v, digits)}{unit ? ` ${unit}` : ""}</div>
          {smooth > 1 && <div className="text-muted-foreground tnum">{smooth}-day avg {nice(h.avg, digits)}</div>}
        </div>
      )}
    </div>
  );
}

// Approval per minister against the impeachment line.
export function MinisterBars({ items, threshold }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((m) => (
        <div key={m.key} className="grid grid-cols-[96px_1fr_44px] items-center gap-3">
          <span className="truncate text-[13px] text-muted-foreground">{m.short}</span>
          <div className="relative h-2.5 rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${Math.round((m.value || 0) * 100)}%`, background: `var(--m-${m.key})` }} />
            <div className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground/50" style={{ left: `${threshold}%` }} title={`Impeachment line ${threshold}%`} />
          </div>
          <span className="text-right text-[13px] font-semibold tnum">{pctTxt(m.value)}</span>
        </div>
      ))}
    </div>
  );
}

// A year of days, like a contributions calendar: one gold, lighter to darker.
export function Heatmap({ from, to, valueOf, label }) {
  const days = [];
  for (let d = new Date(from + "T12:00:00"); ; d.setDate(d.getDate() + 1)) {
    const k = d.toISOString().slice(0, 10); days.push(k); if (k >= to) break;
  }
  const first = new Date(days[0] + "T12:00:00").getDay(); // Sun = 0
  const cells = [...Array(first).fill(null), ...days];
  const weeks = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const step = (v) => (v == null ? null : v < 0.25 ? 25 : v < 0.5 ? 45 : v < 0.75 ? 70 : 100);
  return (
    <div>
      <div className="no-scrollbar flex justify-end gap-[3px] overflow-x-auto pb-1" role="img" aria-label={label}>
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {w.map((k, j) => {
              const v = k ? valueOf(k) : undefined, s = step(v);
              return <div key={j} title={k ? `${fmtDay(k)} · ${v == null ? "not logged" : pctTxt(v)}` : ""}
                className={cn("size-[11px] rounded-[3px]", !k && "opacity-0", k && s == null && "bg-muted")}
                style={s ? { background: `color-mix(in oklch, var(--gold) ${s}%, var(--muted))` } : undefined} />;
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        Less {[25, 45, 70, 100].map((s) => <span key={s} className="size-[10px] rounded-[3px]" style={{ background: `color-mix(in oklch, var(--gold) ${s}%, var(--muted))` }} />)} More
      </div>
    </div>
  );
}

// Years added (right, older) or taken off (left, younger), centred on zero.
export function DivergingBar({ years, max }) {
  const w = (Math.abs(years) / max) * 50;
  return (
    <div className="relative h-2 rounded-full bg-muted" role="img" aria-label={`${years > 0 ? "+" : ""}${years} years`}>
      <div className="absolute -inset-y-1 left-1/2 w-px bg-foreground/30" />
      <div className="absolute inset-y-0 rounded-full" style={{ width: `${w}%`, [years > 0 ? "left" : "right"]: "50%", background: years > 0 ? "var(--m-body)" : "var(--m-knowledge)" }} />
    </div>
  );
}
