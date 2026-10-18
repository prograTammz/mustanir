// Charts: one measure per chart, recessive axes, a tooltip on every mark, colour carries identity only.
import { useMemo } from "react";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { cn } from "@/lib/utils";
import { pctTxt } from "./kit";

const fmtDay = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
const nice = (v, digits) => (v == null || !isFinite(v) ? "—" : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en") : v.toFixed(digits));

function TipBox({ active, payload, unit, digits, smooth }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-foreground">{fmtDay(p.d)}</div>
      <div className="mt-0.5 text-sm font-semibold tnum">{nice(p.v, digits)}{unit ? ` ${unit}` : ""}</div>
      {smooth > 1 && p.avg != null && <div className="text-muted-foreground tnum">{smooth}-day avg {nice(p.avg, digits)}</div>}
    </div>
  );
}

// Daily values as faint dots, the rolling average as the line, an optional goal as a dashed rule.
export function TrendChart({ points, unit = "", digits = 0, color = "var(--primary)", smooth = 7, goal = null, height = 170, id = "c" }) {
  const data = useMemo(() => (points || []).map((p, i, a) => {
    const w = a.slice(Math.max(0, i - smooth + 1), i + 1);
    return { d: p[0], v: p[1], avg: w.reduce((s, q) => s + q[1], 0) / w.length };
  }), [points, smooth]);
  if (data.length < 2) return <div className="grid h-24 place-items-center text-sm text-muted-foreground">Not enough data yet</div>;
  const vals = data.map((x) => x.v).concat(goal != null ? [goal] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
  const gid = "g-" + id;
  return (
    <div style={{ height }} className="-mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="d" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" minTickGap={60} tickFormatter={fmtDay} />
          <YAxis width={40} tickLine={false} axisLine={false} domain={[lo, hi]} tickCount={4} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => nice(v, digits)} />
          <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={<TipBox unit={unit} digits={digits} smooth={smooth} />} />
          {goal != null && <ReferenceLine y={goal} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.7} />}
          <Area type="monotone" dataKey="avg" stroke={color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
          {smooth > 1 && <Line type="monotone" dataKey="v" stroke="none" isAnimationActive={false} dot={{ r: 1.6, fill: color, fillOpacity: 0.35, strokeWidth: 0 }} activeDot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
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
