// Generates src/styles/m3-tokens.css: Material 3 color roles (light and dark), the ministers' custom colors, and the
// M3 Expressive motion springs as CSS linear() easings. No dependencies:  node scripts/m3-tokens.mjs
//
// Color follows the M3 tonal system: every role is a tone (L*, CIE lightness, 0 black to 100 white) of one of six
// palettes, so contrast between roles is exactly the spec's. Each palette is a hue and chroma in CIE LCh, kept in the
// sRGB gamut by lowering chroma at the tone (never the tone, never the hue).
import { writeFileSync } from "node:fs";

/* ---------- color math: CIE Lab (D65) <-> sRGB ---------- */
const WHITE = [0.95047, 1, 1.08883];
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function hexToLch(hex) {
  const n = parseInt(hex.slice(1), 16), [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => lin(x / 255));
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X / WHITE[0]), fy = f(Y / WHITE[1]), fz = f(Z / WHITE[2]);
  const L = 116 * fy - 16, a = 500 * (fx - fy), bb = 200 * (fy - fz);
  return { L, C: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}
function lchToRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const X = WHITE[0] * inv(fx), Y = L > 8 ? fy ** 3 : L / (24389 / 27), Z = WHITE[2] * inv(fz);
  return [3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, -0.969266 * X + 1.8760108 * Y + 0.041556 * Z, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z].map(gam);
}
const inGamut = (rgb) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);
function tone(h, C, T) { // the most colorful in-gamut color at this hue and tone, up to chroma C
  if (T <= 0) return "#000000"; if (T >= 100) return "#ffffff";
  let lo = 0, hi = C, rgb = lchToRgb(T, C, h);
  if (!inGamut(rgb)) { for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (inGamut(lchToRgb(T, m, h))) lo = m; else hi = m; } rgb = lchToRgb(T, lo, h); }
  return "#" + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");
}
const palette = (hex, C) => { const { h } = hexToLch(hex); return (T) => tone(h, C, T); };

/* ---------- the brand palettes ---------- */
const EMERALD = "#1F8C5A", GOLD = "#D6AF5F", RED = "#C8382B";
const P = palette(EMERALD, 58), S = palette(EMERALD, 18), T = palette(GOLD, 62), N = palette(EMERALD, 3.5), NV = palette(EMERALD, 8), E = palette(RED, 70);
// The M3 role-to-tone table (light, dark).
const ROLES = {
  primary: [P, 40, 80], "on-primary": [P, 100, 20], "primary-container": [P, 90, 30], "on-primary-container": [P, 10, 90],
  "inverse-primary": [P, 80, 40], "primary-fixed": [P, 90, 90], "primary-fixed-dim": [P, 80, 80], "on-primary-fixed": [P, 10, 10], "on-primary-fixed-variant": [P, 30, 30],
  secondary: [S, 40, 80], "on-secondary": [S, 100, 20], "secondary-container": [S, 90, 30], "on-secondary-container": [S, 10, 90],
  tertiary: [T, 40, 80], "on-tertiary": [T, 100, 20], "tertiary-container": [T, 90, 30], "on-tertiary-container": [T, 10, 90],
  "tertiary-fixed": [T, 90, 90], "tertiary-fixed-dim": [T, 80, 80], "on-tertiary-fixed": [T, 10, 10], "on-tertiary-fixed-variant": [T, 30, 30],
  error: [E, 40, 80], "on-error": [E, 100, 20], "error-container": [E, 90, 30], "on-error-container": [E, 10, 90],
  background: [N, 98, 6], "on-background": [N, 10, 90], surface: [N, 98, 6], "on-surface": [N, 10, 90],
  "surface-variant": [NV, 90, 30], "on-surface-variant": [NV, 30, 80], outline: [NV, 50, 60], "outline-variant": [NV, 80, 30],
  "surface-dim": [N, 87, 6], "surface-bright": [N, 98, 24], "surface-container-lowest": [N, 100, 4], "surface-container-low": [N, 96, 10],
  "surface-container": [N, 94, 12], "surface-container-high": [N, 92, 17], "surface-container-highest": [N, 90, 22],
  "inverse-surface": [N, 20, 90], "inverse-on-surface": [N, 95, 20], "surface-tint": [P, 40, 80], shadow: [N, 0, 0], scrim: [N, 0, 0],
};
// Custom colors (M3 "custom colors"): the five ministers, plus success, warning and the streak's fire. Each with its
// color, on-color, container and on-container, and a vivid tone for rings and fills that reads on any surface.
const CUSTOM = { body: ["#D5573B", 62], knowledge: ["#3B7BD5", 56], faith: ["#1F9D63", 54], habits: ["#D59A1F", 60], purity: ["#8E62D0", 58], success: ["#2BA562", 56], warning: ["#E0A33A", 62], fire: ["#F07A1A", 80] };
const CUSTOM_TONES = { "": [40, 80], "on-": [100, 20], container: [90, 30], "on-container": [10, 90], vivid: [55, 72] };

/* ---------- M3 Expressive springs (damping ratio, stiffness) -> linear() ---------- */
function spring(zeta, k) {
  const c = 2 * zeta * Math.sqrt(k), dt = 1 / 2000, pts = [];
  let x = 0, v = 0, t = 0, calm = 0;
  while (t < 3) {
    v += (-k * (x - 1) - c * v) * dt; x += v * dt; t += dt; pts.push([t, x]);
    if (Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.05) { calm += dt; if (calm > 0.016) break; } else calm = 0;
  }
  const end = t, n = 40, ys = [];
  for (let i = 0; i <= n; i++) { const at = (i / n) * end; ys.push(pts[Math.min(pts.length - 1, Math.round(at / dt))][1]); }
  ys[0] = 0; ys[n] = 1;
  return { ease: `linear(${ys.map((y) => +y.toFixed(3)).join(", ")})`, ms: Math.round(end * 1000) };
}
const SPRINGS = { "fast-spatial": [0.6, 800], "default-spatial": [0.8, 380], "slow-spatial": [0.8, 200], "fast-effects": [1, 3800], "default-effects": [1, 1600], "slow-effects": [1, 800] };

/* ---------- write ---------- */
function vars(dark) {
  const i = dark ? 2 : 1, out = {};
  for (const [k, r] of Object.entries(ROLES)) out[`--md-sys-color-${k}`] = r[0](r[i]);
  for (const [k, [hex, C]] of Object.entries(CUSTOM)) {
    const p = palette(hex, C);
    for (const [suffix, tones] of Object.entries(CUSTOM_TONES)) {
      const name = suffix === "" ? k : suffix === "on-" ? `on-${k}` : suffix === "on-container" ? `on-${k}-container` : `${k}-${suffix}`;
      out[`--md-custom-color-${name}`] = p(tones[dark ? 1 : 0]);
    }
  }
  return out;
}
const motion = {};
for (const [k, [z, s]] of Object.entries(SPRINGS)) { const sp = spring(z, s); motion[`--md-sys-motion-spring-${k}`] = sp.ease; motion[`--md-sys-motion-spring-${k}-duration`] = sp.ms + "ms"; }
const block = (sel, o) => `${sel} {\n${Object.entries(o).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}\n`;
const css = `/* Generated by scripts/m3-tokens.mjs (node scripts/m3-tokens.mjs). Material 3 tonal roles from emerald ${EMERALD} and gold ${GOLD}; do not edit by hand. */\n`
  + block(":root", { ...vars(false), ...motion }) + block(".dark", vars(true));
writeFileSync(new URL("../src/styles/m3-tokens.css", import.meta.url), css);
console.log(`${css.length} bytes`);
