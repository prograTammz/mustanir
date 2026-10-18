// Reward moments: +XP float with a burst of eight-pointed stars, and the level-up seal.
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let canvas, ctx, parts = [], raf = 0;
function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement("canvas"); canvas.className = "fx"; document.body.append(canvas);
  ctx = canvas.getContext("2d");
  const size = () => { const r = devicePixelRatio || 1; canvas.width = innerWidth * r; canvas.height = innerHeight * r; ctx.setTransform(r, 0, 0, r, 0, 0); };
  size(); addEventListener("resize", size);
}
function star8(x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, rr = i % 2 ? r * 0.55 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life > 0);
  for (const p of parts) {
    p.life -= 1; p.vy += 0.12; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.c; star8(p.x, p.y, p.r, p.rot);
  }
  ctx.globalAlpha = 1;
  raf = parts.length ? requestAnimationFrame(tick) : 0;
}
export function burst(x, y, n = 18, colors = ["#E7C36A", "#F4DFA0", "#C9A04A"]) {
  if (reduced()) return;
  ensureCanvas();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4, max = 40 + Math.random() * 30;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2.5, r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: max, max, c: colors[i % colors.length] });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

export function xpFloat(x, y, amount) {
  if (!amount) return;
  const el = document.createElement("div");
  el.className = "xpfloat" + (amount < 0 ? " neg" : "");
  el.textContent = (amount > 0 ? "+" : "") + amount + " XP";
  el.style.left = x + "px"; el.style.top = y + "px";
  document.body.append(el);
  setTimeout(() => el.remove(), reduced() ? 900 : 1300);
  if (amount > 0) burst(x, y, Math.min(30, 8 + amount));
}

export function levelUp(level, rank) {
  const el = document.createElement("div"); el.className = "levelup"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Level up");
  el.innerHTML = `<div class="seal"><svg viewBox="0 0 100 100" aria-hidden="true"><path d=""/></svg><span class="lv"></span></div><p class="ar"></p><p class="en"></p><button class="btn">Continue</button>`;
  const path = [];
  for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8 - Math.PI / 2, r = i % 2 ? 38 : 48; path.push((i ? "L" : "M") + (50 + Math.cos(a) * r).toFixed(1) + "," + (50 + Math.sin(a) * r).toFixed(1)); }
  el.querySelector("path").setAttribute("d", path.join("") + "Z");
  el.querySelector(".lv").textContent = level;
  el.querySelector(".ar").textContent = rank.ar;
  el.querySelector(".en").textContent = `Level ${level} · ${rank.en}`;
  const close = () => el.remove();
  el.querySelector("button").addEventListener("click", close);
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  document.body.append(el);
  el.querySelector("button").focus();
  const r = el.querySelector(".seal").getBoundingClientRect();
  setTimeout(() => burst(r.left + r.width / 2, r.top + r.height / 2, 40), reduced() ? 0 : 450);
}
