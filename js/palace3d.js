// The palace scene: the president and five ministers before an arch, around a turning Rub el Hizb.
// Low-poly characters built from primitives; each minister's floor ring shows their standing.
import * as THREE from "three";

const COLORS = { body: 0xd9604a, knowledge: 0x4c8fd6, faith: 0x2e9e6b, habits: 0xbc8120, purity: 0xa57ad4 };
const GOLD = 0xd8b25a, IVORY = 0xf1eadb, SKIN = 0xc99a73, NIGHT = 0x0e2230;

function rubElHizb(r = 1, depth = 0.18) {
  const s = new THREE.Shape();
  for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, rr = i % 2 ? r * 0.72 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.32, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 24 });
  g.center(); return g;
}
function arch(w = 3.2, h = 4.4, t = 0.35) {
  const s = new THREE.Shape(), hw = w / 2;
  s.moveTo(-hw - t, 0); s.lineTo(-hw - t, h * 0.55);
  s.quadraticCurveTo(-hw - t, h + t * 0.6, 0, h + t * 1.4);
  s.quadraticCurveTo(hw + t, h + t * 0.6, hw + t, h * 0.55); s.lineTo(hw + t, 0); s.lineTo(hw, 0); s.lineTo(hw, h * 0.55);
  s.quadraticCurveTo(hw, h, 0, h + t * 0.2); s.quadraticCurveTo(-hw, h, -hw, h * 0.55); s.lineTo(-hw, 0); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false, curveSegments: 20 });
}
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, flatShading: true, ...extra });

function emblem(kind, color) {
  const g = new THREE.Group(), m = std(GOLD, { metalness: 0.7, roughness: 0.3, emissive: color, emissiveIntensity: 0.25 });
  if (kind === "body") { // dumbbell
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), m); bar.rotation.z = Math.PI / 2; g.add(bar);
    for (const x of [-0.2, 0.2]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 10), m); w.rotation.z = Math.PI / 2; w.position.x = x; g.add(w); }
  } else if (kind === "knowledge") { // open book
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.26), m); p.position.x = s * 0.1; p.rotation.z = s * -0.35; g.add(p); }
  } else if (kind === "faith") { // crescent
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 24, Math.PI * 1.35), m); c.rotation.z = Math.PI * 0.32; g.add(c);
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), m); st.position.set(0.07, 0.02, 0); g.add(st);
  } else if (kind === "habits") { // hourglass
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 10), m); c.position.y = s * 0.08; c.rotation.x = s > 0 ? Math.PI : 0; g.add(c); }
  } else { // purity: water drop
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), m); g.add(b);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.16, 12), m); tip.position.y = 0.11; g.add(tip);
  }
  return g;
}

function figure({ robe, trim, turban, scale = 1, bisht = false }) {
  const g = new THREE.Group();
  const profile = [[0, 0], [0.34, 0], [0.32, 0.25], [0.26, 0.8], [0.22, 1.05], [0.15, 1.18], [0, 1.2]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 10), std(robe)); g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.27, 0.06, 10), std(trim, { metalness: 0.6, roughness: 0.35 })); band.position.y = 0.72; g.add(band);
  if (bisht) {
    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.38, 1.1, 12, 1, true, Math.PI * 0.18, Math.PI * 1.64), std(0x2a1d12, { side: THREE.DoubleSide }));
    cloak.position.y = 0.6; cloak.rotation.y = Math.PI; g.add(cloak);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 16, Math.PI * 1.64), std(GOLD, { metalness: 0.8, roughness: 0.25 }));
    edge.position.y = 1.15; edge.rotation.x = Math.PI / 2; edge.rotation.z = Math.PI * 0.68; g.add(edge);
  }
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), std(SKIN)); head.position.y = 1.38; g.add(head);
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 8), std(0x2b2018)); beard.position.set(0, 1.25, 0.08); beard.rotation.x = Math.PI; g.add(beard);
  const tur = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.07, 8, 16), std(turban)); tur.position.y = 1.5; tur.rotation.x = Math.PI / 2; g.add(tur);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(turban)); cap.position.y = 1.52; g.add(cap);
  g.scale.setScalar(scale);
  return g;
}

export function createPalace(container, { onPick } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
  catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(NIGHT, 9, 18);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1a120a, 0.9));
  const key = new THREE.DirectionalLight(0xffe2b0, 1.6); key.position.set(3, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fa8ff, 0.8); rim.position.set(-4, 3, -4); scene.add(rim);
  const glow = new THREE.PointLight(GOLD, 6, 6, 1.6); glow.position.set(0, 2.8, -0.9); scene.add(glow);

  // floor: dark disc, gold rings
  const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 48), std(0x0c1b25, { roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  for (const [r, w] of [[4.6, 0.03], [3.3, 0.02], [1.2, 0.03]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r - w, r + w, 64), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.35 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; scene.add(ring); }

  // the arch and its gold edge
  const archG = arch(); const archM = new THREE.Mesh(archG, std(0x123447, { roughness: 0.7 })); archM.position.set(0, 0, -2.6); scene.add(archM);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(archG, 30), new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.7 })); edges.position.copy(archM.position); scene.add(edges);

  // the star
  const star = new THREE.Mesh(rubElHizb(0.62), std(GOLD, { metalness: 0.85, roughness: 0.25, emissive: 0x6a4a10, emissiveIntensity: 0.4 }));
  star.position.set(0, 2.95, -1.25); scene.add(star);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.5, 8), std(0x173a4d)); ped.position.set(0, 0.25, -1.25); scene.add(ped);
  const pedRim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.025, 6, 32), std(GOLD, { metalness: 0.8, roughness: 0.3 })); pedRim.position.set(0, 0.5, -1.25); pedRim.rotation.x = Math.PI / 2; scene.add(pedRim);

  // sky dust
  const n = 400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 10; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 1 + Math.random() * 9; pos[i * 3 + 2] = -2.5 - Math.abs(Math.sin(a)) * r; }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustG, new THREE.PointsMaterial({ color: 0xf3e2b0, size: 0.05, transparent: true, opacity: 0.8 })); scene.add(dust);

  // cast
  const picks = [];
  const president = figure({ robe: IVORY, trim: GOLD, turban: 0xf7f3ea, scale: 1.18, bisht: true });
  president.position.set(0, 0, 1.0); president.userData = { key: "president", baseY: 0, phase: 0 }; scene.add(president); picks.push(president);
  const ministers = {};
  const order = ["body", "knowledge", "faith", "habits", "purity"];
  order.forEach((k, i) => {
    const a = (-0.62 + (i / (order.length - 1)) * 1.24) * Math.PI * 0.62; // arc behind the president
    const c = COLORS[k];
    const f = figure({ robe: c, trim: GOLD, turban: k === "purity" ? 0xf2eef9 : new THREE.Color(c).multiplyScalar(0.6).getHex() });
    const raised = k === "faith" ? 0.5 : 0;
    f.position.set(Math.sin(a) * 2.3, raised, k === "faith" ? -1.25 : -Math.cos(a) * 1.3 + 0.2); f.lookAt(0, raised, 3.5);
    const em = emblem(k, c); em.position.y = 1.95; f.add(em);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.46, 32), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; f.add(ring);
    f.userData = { key: k, baseY: raised, phase: i * 1.3, emblem: em, ring, status: "ok", strength: 0.7 };
    scene.add(f); picks.push(f); ministers[k] = f;
  });

  // camera: slow sway, drag to look around
  let az = 0, targetAz = 0, dragging = false, lastX = 0, moved = 0;
  const placeCamera = () => { const r = 7.2; camera.position.set(Math.sin(az) * r, 2.6, Math.cos(az) * r); camera.lookAt(0, 1.15, 0); };
  const el = renderer.domElement;
  el.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; moved = 0; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx); targetAz = Math.max(-0.9, Math.min(0.9, targetAz - dx * 0.006)); });
  el.addEventListener("pointerup", (e) => {
    dragging = false;
    if (moved > 6 || !onPick) return;
    const r = el.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(picks, true)[0];
    if (hit) { let o = hit.object; while (o && !o.userData.key) o = o.parent; if (o) onPick(o.userData.key); }
  });

  const size = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 480 ? 44 : 36; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(() => { size(); if (!running) frame(0); }); ro.observe(container);

  let running = false, raf = 0, visible = true;
  const clock = new THREE.Clock();
  function frame(t) {
    const time = clock.getElapsedTime();
    if (!reduced) {
      if (!dragging) targetAz += (Math.sin(time * 0.12) * 0.25 - targetAz) * 0.002;
      star.rotation.y = time * 0.5; star.position.y = 2.95 + Math.sin(time * 1.1) * 0.06;
      dust.rotation.y = time * 0.01;
      for (const f of picks) {
        const u = f.userData, bob = Math.sin(time * 1.6 + u.phase) * 0.02;
        f.position.y = u.baseY + bob;
        if (u.emblem) { u.emblem.rotation.y = time * 1.2 + u.phase; u.emblem.position.y = 1.95 + Math.sin(time * 2 + u.phase) * 0.04; }
        if (u.ring) {
          const pulse = u.status === "bad" ? 0.5 + 0.5 * Math.sin(time * 5) : u.status === "warn" ? 0.75 + 0.2 * Math.sin(time * 2.5) : 1;
          u.ring.material.opacity = 0.25 + 0.6 * pulse * u.strength;
          u.ring.scale.setScalar(u.status === "bad" ? 1 + 0.08 * Math.sin(time * 5) : 1);
        }
      }
      glow.intensity = 5 + Math.sin(time * 1.3) * 1;
    }
    az += (targetAz - az) * 0.08; placeCamera();
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }
  const start = () => { if (running || reduced || !visible || document.hidden) return; running = true; clock.start(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }); io.observe(container);
  const vis = () => (document.hidden ? stop() : start()); document.addEventListener("visibilitychange", vis);
  size(); placeCamera(); frame(0); start();

  return {
    // standing: { key: { approval: 0..1 | null, status: "ok" | "warn" | "bad" | "" } }
    update(standing) {
      for (const k of order) {
        const u = ministers[k].userData, s = standing[k] || {};
        u.status = s.status || "ok"; u.strength = s.approval == null ? 0.5 : 0.35 + 0.65 * s.approval;
        u.ring.material.color.setHex(u.status === "bad" ? 0xe0533d : COLORS[k]);
        u.emblem.children.forEach((m) => { m.material.emissiveIntensity = 0.1 + 0.6 * u.strength; });
      }
      if (!running) frame(0);
    },
    destroy() { stop(); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", vis); renderer.dispose(); el.remove(); },
  };
}
