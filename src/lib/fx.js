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

// The level-up moment (Claude Design: "Level up"): deep emerald, sixteen rays, the gold seal, the new rank in both languages.
export function levelUp(level, rank, line = "A new rank in office.") {
  const el = document.createElement("div"); el.className = "levelup"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", `Level ${level}, ${rank.en}`);
  const rays = Array.from({ length: 16 }, (_, i) => `<i style="transform:rotate(${i * 22.5}deg);opacity:${i % 2 ? 0.5 : 1}"></i>`).join("");
  el.innerHTML = `<div class="rays" aria-hidden="true">${rays}</div><p class="kicker">Level up</p><div class="seal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 4.2 4.7-1-1 4.7L22 12l-4.2 2.4 1 4.7-4.7-1L12 22l-2.4-4.2-4.7 1 1-4.7L2 12l4.2-2.4-1-4.7 4.7 1z"/></svg><span class="lv"></span></div><p class="ar"></p><p class="en"></p><p class="line"></p><button class="btn">Continue</button>`;
  el.querySelector(".lv").textContent = level;
  el.querySelector(".ar").textContent = rank.ar;
  el.querySelector(".en").textContent = rank.en;
  el.querySelector(".line").textContent = line;
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 250); };
  el.querySelector("button").addEventListener("click", close);
  document.body.append(el);
  el.querySelector("button").focus();
  const r = el.querySelector(".seal").getBoundingClientRect();
  setTimeout(() => { burst(r.left + r.width / 2, r.top + r.height / 2, 50, ["#F1D896", "#D6AF5F", "#5CCB9F", "#FFFFFF"]); }, reduced() ? 0 : 450);
}
