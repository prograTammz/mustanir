// Reward moments: the +XP chip that rises from your finger with a burst of M3 shapes, and the level-up screen.
import { shapePath } from "@/components/m3/shapes.js";
import { haptic } from "@/components/m3/index.jsx";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const token = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const palette = () => ["--md-sys-color-tertiary", "--md-sys-color-tertiary-fixed-dim", "--md-sys-color-primary", "--md-custom-color-faith-vivid", "--md-custom-color-knowledge-vivid", "--md-custom-color-purity-vivid", "--md-custom-color-body-vivid"].map(token).filter(Boolean);

const CONFETTI = ["verySunny", "cookie4", "flower", "clover4", "gem", "circle", "burst"];
let paths = null;
const pathFor = (n) => { paths ||= Object.fromEntries(CONFETTI.map((k) => [k, new Path2D(shapePath(k))])); return paths[n]; };

let canvas, ctx, parts = [], raf = 0;
function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement("canvas"); canvas.className = "fx"; document.body.append(canvas);
  ctx = canvas.getContext("2d");
  const size = () => { const r = devicePixelRatio || 1; canvas.width = innerWidth * r; canvas.height = innerHeight * r; ctx.setTransform(r, 0, 0, r, 0, 0); };
  size(); addEventListener("resize", size);
}
function tick() {
  const r = devicePixelRatio || 1;
  ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life > 0);
  for (const p of parts) {
    p.life -= 1; p.vy += 0.14; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    const k = p.life / p.max, s = p.r / 50 * (k < 0.25 ? k / 0.25 : 1);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(s, s); ctx.translate(-50, -50);
    ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = p.c; ctx.fill(pathFor(p.shape)); ctx.restore();
  }
  ctx.globalAlpha = 1;
  raf = parts.length ? requestAnimationFrame(tick) : 0;
}
export function burst(x, y, n = 18, colors) {
  if (reduced()) return;
  ensureCanvas();
  const cs = colors || palette();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 2.5 + Math.random() * 5, max = 46 + Math.random() * 34;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, r: 4 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: max, max, c: cs[i % cs.length], shape: CONFETTI[i % CONFETTI.length] });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

export function xpFloat(x, y, amount) {
  if (!amount) return;
  const el = document.createElement("div");
  el.className = "xpfloat" + (amount < 0 ? " neg" : "");
  el.textContent = (amount > 0 ? "+" : "") + amount + " XP";
  el.style.left = Math.max(48, Math.min(innerWidth - 48, x)) + "px"; el.style.top = y + "px";
  document.body.append(el);
  setTimeout(() => el.remove(), reduced() ? 900 : 1300);
  if (amount > 0) { burst(x, y, Math.min(28, 8 + amount)); haptic(12); }
}

// The level-up moment: the seal springs in and keeps morphing between the brand's star shapes, the new rank in both languages.
export function levelUp(level, rank, line = "A new rank in office.") {
  const el = document.createElement("div"); el.className = "levelup"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", `Level ${level}, ${rank.en}`);
  const seq = ["verySunny", "burst", "softBurst", "verySunny"].map((n) => shapePath(n)).join(";");
  el.innerHTML = `<p class="kicker">Level up</p>
    <div class="seal"><svg viewBox="0 0 100 100" aria-hidden="true" class="spin-slow" style="animation-duration:24s"><path d="${shapePath("burst")}" style="fill:color-mix(in srgb, var(--md-sys-color-tertiary) 22%, transparent)" transform="translate(-14 -14) scale(1.28)"/></svg>
    <svg viewBox="0 0 100 100" aria-hidden="true"><path d="${shapePath("verySunny")}" style="fill:var(--md-sys-color-tertiary-fixed-dim)">${reduced() ? "" : `<animate attributeName="d" values="${seq}" dur="6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.33;0.66;1" keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"/>`}</path></svg><span class="lv"></span></div>
    <p class="ar"></p><p class="en"></p><p class="line"></p><button class="btn">Continue</button>`;
  el.querySelector(".lv").textContent = level;
  el.querySelector(".ar").textContent = rank.ar;
  el.querySelector(".en").textContent = rank.en;
  el.querySelector(".line").textContent = line;
  const close = () => { haptic(); el.classList.add("out"); setTimeout(() => el.remove(), 250); };
  el.querySelector("button").addEventListener("click", close);
  document.body.append(el);
  el.querySelector("button").focus();
  haptic(30);
  const r = el.querySelector(".seal").getBoundingClientRect();
  setTimeout(() => { burst(r.left + r.width / 2, r.top + r.height / 2, 60); }, reduced() ? 0 : 450);
}
