// The M3 Expressive shape library, drawn as polar curves: every shape is the same 72-point closed curve, so any shape can
// morph into any other (SVG <animate> on `d`, which Safari and Chrome both run). viewBox 0 0 100 100.
const K = 72;
const bump = (n, a, p) => (t) => 1 - a + a * ((1 + Math.cos(n * t)) / 2) ** p; // n lobes; p > 1 pointy tips, p < 1 round lobes
const poly = (n, round = 0.18, rot = 0) => (t) => { // a polygon with soft corners
  const s = (2 * Math.PI) / n, x = (((t - rot) % s) + s) % s - s / 2;
  const r = Math.cos(Math.PI / n) / Math.cos(x);
  return r * (1 - round) + round * Math.cos(Math.PI / n) * 1.04;
};
const superellipse = (e) => (t) => (Math.abs(Math.cos(t)) ** e + Math.abs(Math.sin(t)) ** e) ** (-1 / e);

export const SHAPES = {
  circle: () => 1,
  square: superellipse(4.2),
  slanted: superellipse(3.4),
  cookie4: bump(4, 0.12, 1),
  cookie6: bump(6, 0.11, 1),
  cookie7: bump(7, 0.1, 1),
  cookie9: bump(9, 0.085, 1),
  cookie12: bump(12, 0.07, 1),
  sunny: bump(8, 0.1, 1.4),
  verySunny: bump(8, 0.2, 2.4),
  burst: bump(12, 0.2, 3.2),
  softBurst: bump(10, 0.14, 1.8),
  flower: bump(8, 0.2, 0.55),
  clover4: bump(4, 0.34, 0.5),
  clover8: bump(8, 0.24, 0.6),
  puffy: bump(6, 0.16, 0.7),
  pentagon: poly(5, 0, 0),
  triangle: poly(3, 0, 0),
  diamond: poly(4, 0, 0),
  gem: poly(6, 0, 0),
};
// How much each shape is softened (passes of neighbour averaging): polygons need their corners rounded.
const SOFT = { pentagon: 7, triangle: 9, diamond: 7, gem: 6, square: 2, slanted: 2 };

// Smooth closed path through the points (Catmull-Rom as cubic Béziers): always 72 "C" segments.
function pathOf(pts) {
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + K) % K], p1 = pts[i], p2 = pts[(i + 1) % K], p3 = pts[(i + 2) % K];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(2)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(2)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(2)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + "Z";
}
const cache = new Map();
/** The SVG path of a shape, fitted to the 100×100 box, rotated by `rot` degrees. */
export function shapePath(name = "circle", rot = 0) {
  const key = name + "@" + rot;
  if (cache.has(key)) return cache.get(key);
  const f = SHAPES[name] || SHAPES.circle, r0 = (rot * Math.PI) / 180;
  let rs = Array.from({ length: K }, (_, i) => f((i / K) * 2 * Math.PI - r0));
  // Soften: average each radius with its neighbours, so polygon corners and lobe tips come out rounded like M3's.
  for (let n = 0; n < (SOFT[name] ?? 1); n++) rs = rs.map((r, i) => (rs[(i - 1 + K) % K] + 2 * r + rs[(i + 1) % K]) / 4);
  const max = Math.max(...rs), pts = rs.map((r, i) => { const t = (i / K) * 2 * Math.PI - Math.PI / 2; return [50 + (48 * r * Math.cos(t)) / max, 50 + (48 * r * Math.sin(t)) / max]; });
  const d = pathOf(pts);
  cache.set(key, d);
  return d;
}
