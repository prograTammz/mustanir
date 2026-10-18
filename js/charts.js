// Small hand-built SVG charts: one measure per chart, recessive axes, hover tooltips.
const NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };
const fmtDay = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
const niceNum = (v, digits) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en") : v.toFixed(digits));

function tooltip(wrap) {
  const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true; wrap.append(tip);
  return {
    show(x, y, title, value) {
      tip.replaceChildren(Object.assign(document.createElement("span"), { textContent: title }), Object.assign(document.createElement("strong"), { textContent: value }));
      tip.hidden = false;
      const w = wrap.clientWidth, tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(w - tw, x - tw / 2)) + "px";
      tip.style.top = Math.max(0, y - tip.offsetHeight - 10) + "px";
    },
    hide() { tip.hidden = true; },
  };
}

// Line chart for one series of [day, value]. Optional 7-day average drawn as the main line.
export function lineChart({ points, unit = "", digits = 0, color = "var(--gold)", smooth = 7, goal = null, height = 150 }) {
  const wrap = document.createElement("div"); wrap.className = "chart";
  if (!points || points.length < 2) { wrap.append(Object.assign(document.createElement("p"), { className: "empty", textContent: "Not enough data yet" })); return wrap; }
  const W = Math.round(Math.max(260, Math.min(640, (document.getElementById("main")?.clientWidth || 400) - 66))), H = height, pl = 40, pr = 8, pt = 10, pb = 22;
  const t0 = Date.parse(points[0][0]), t1 = Date.parse(points[points.length - 1][0]) || t0 + 1;
  const avg = points.map((p, i) => { const s = points.slice(Math.max(0, i - smooth + 1), i + 1); return [p[0], s.reduce((a, q) => a + q[1], 0) / s.length]; });
  const vals = points.map((p) => p[1]).concat(goal != null ? [goal] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals); const padv = (hi - lo) * 0.12 || 1; lo -= padv; hi += padv;
  const x = (d) => pl + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const g = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", preserveAspectRatio: "none" });
  for (let i = 0; i <= 3; i++) {
    const v = lo + ((hi - lo) * i) / 3, yy = y(v);
    g.append(svg("line", { x1: pl, x2: W - pr, y1: yy, y2: yy, class: "grid" }));
    const t = svg("text", { x: pl - 6, y: yy + 4, class: "axis", "text-anchor": "end" }); t.textContent = niceNum(v, digits); g.append(t);
  }
  [points[0][0], points[points.length - 1][0]].forEach((d, i) => { const t = svg("text", { x: i ? W - pr : pl, y: H - 6, class: "axis", "text-anchor": i ? "end" : "start" }); t.textContent = fmtDay(d); g.append(t); });
  if (goal != null) g.append(svg("line", { x1: pl, x2: W - pr, y1: y(goal), y2: y(goal), class: "goal" }));
  const dots = points.map((p) => `M${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}h0.01`).join("");
  g.append(svg("path", { d: dots, class: "raw", stroke: color }));
  const line = avg.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1)).join("");
  g.append(svg("path", { d: line + `L${x(avg[avg.length - 1][0]).toFixed(1)},${H - pb}L${x(avg[0][0]).toFixed(1)},${H - pb}Z`, class: "area", fill: color }));
  g.append(svg("path", { d: line, class: "line", stroke: color }));
  const cross = svg("line", { y1: pt, y2: H - pb, class: "cross", visibility: "hidden" });
  const dot = svg("circle", { r: 4.5, class: "hoverdot", fill: color, visibility: "hidden" });
  g.append(cross, dot); wrap.append(g);
  const tip = tooltip(wrap);
  const move = (ev) => {
    const r = g.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity; points.forEach((p, i) => { const dd = Math.abs(x(p[0]) - px); if (dd < bd) { bd = dd; best = i; } });
    const p = points[best], a = avg[best];
    cross.setAttribute("x1", x(p[0])); cross.setAttribute("x2", x(p[0])); cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", x(p[0])); dot.setAttribute("cy", y(a[1])); dot.setAttribute("visibility", "visible");
    tip.show(((x(p[0])) / W) * r.width, (y(a[1]) / H) * r.height, fmtDay(p[0]), niceNum(p[1], digits) + (unit ? " " + unit : "") + (smooth > 1 ? ` · ${smooth}-day avg ${niceNum(a[1], digits)}` : ""));
  };
  g.addEventListener("pointermove", move); g.addEventListener("pointerdown", move);
  g.addEventListener("pointerleave", () => { tip.hide(); cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); });
  return wrap;
}

// Calendar heatmap: weeks as columns, one gold ramp for the day's overall score.
export function heatmap({ days, valueOf, from, to, label }) {
  const wrap = document.createElement("div"); wrap.className = "chart heat";
  const start = new Date(from + "T12:00:00"); start.setDate(start.getDate() - ((start.getDay() + 1) % 7)); // weeks start Saturday
  const end = new Date(to + "T12:00:00");
  const cols = Math.ceil((end - start) / 86400000 / 7) + 1, cell = 12, gap = 2;
  const W = cols * (cell + gap) + 24, H = 7 * (cell + gap) + 4;
  const g = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": label });
  ["Sa", "", "Mo", "", "We", "", "Fr"].forEach((t, i) => { if (!t) return; const tx = svg("text", { x: 0, y: i * (cell + gap) + cell - 2, class: "axis" }); tx.textContent = t; g.append(tx); });
  const tip = tooltip(wrap);
  const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  for (let d = new Date(start), i = 0; d <= end; d.setDate(d.getDate() + 1), i++) {
    const k = ymd(d), v = valueOf(k), col = Math.floor(i / 7), row = i % 7;
    const r = svg("rect", { x: 24 + col * (cell + gap), y: row * (cell + gap), width: cell, height: cell, rx: 3, class: "cell" + (v == null ? " none" : ""), "data-l": v == null ? "" : Math.min(4, Math.floor(v * 5)) });
    if (k < from) r.setAttribute("opacity", "0");
    r.addEventListener("pointerenter", () => { const bb = r.getBoundingClientRect(), wb = wrap.getBoundingClientRect(); tip.show(bb.left - wb.left + bb.width / 2, bb.top - wb.top, fmtDay(k), v == null ? "Not logged" : Math.round(v * 100) + "% of the agenda"); });
    r.addEventListener("pointerleave", () => tip.hide());
    g.append(r);
  }
  wrap.append(g);
  const legend = document.createElement("div"); legend.className = "heatlegend";
  legend.append("Less", ...[0, 1, 2, 3, 4].map((l) => { const i = document.createElement("i"); i.className = "cell"; i.setAttribute("data-l", l); return i; }), "More");
  wrap.append(legend);
  return wrap;
}

// Horizontal bars, one per minister, directly labelled; a tick marks the impeachment line.
export function ministerBars({ items, threshold }) {
  const wrap = document.createElement("div"); wrap.className = "mbars";
  for (const it of items) {
    const row = document.createElement("div"); row.className = "mbar";
    row.innerHTML = `<div class="mbar-l"><span class="ar"></span><span class="en"></span></div><div class="mbar-t"><span class="fill"></span><i class="line"></i></div><strong></strong>`;
    row.querySelector(".ar").textContent = it.ar; row.querySelector(".en").textContent = it.en;
    const f = row.querySelector(".fill"); f.style.background = `var(--m-${it.color})`; f.style.width = Math.round((it.value || 0) * 100) + "%";
    row.querySelector(".line").style.left = threshold + "%";
    row.querySelector("strong").textContent = it.value == null ? "—" : Math.round(it.value * 100) + "%";
    wrap.append(row);
  }
  return wrap;
}
