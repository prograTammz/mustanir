// The council chamber: a sculpture, not a game. The president is a gold piece crowned by the
// Rub el Hizb; the five ministers are ceramic pillars whose height is their approval, each with a
// gold emblem floating above and a ring at its foot that fills with its standing.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const COLORS = { body: 0xd9604a, knowledge: 0x4c8fd6, faith: 0x2e9e6b, habits: 0xc4892a, purity: 0x9c74cf };
const STATUS = { ok: null, warn: 0xe2a336, bad: 0xe0533d };
const GOLD = 0xd9b45f;
const ORDER = ["body", "knowledge", "faith", "habits", "purity"];
const THEMES = {
  light: { dais: 0xf4efe6, inlay: 0xe6dccb, line: 0xb8934a, lineOpacity: 0.55, shadow: 0.16, exposure: 1.0, key: 2.4, env: 0.9, dust: 0xb8934a },
  dark: { dais: 0x1b2a35, inlay: 0x223441, line: GOLD, lineOpacity: 0.5, shadow: 0.45, exposure: 1.05, key: 2.2, env: 0.55, dust: 0xf3dfa8 },
};

function rubElHizb(r = 1, depth = 0.12) {
  const s = new THREE.Shape();
  for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8 + Math.PI / 16, rr = i % 2 ? r * 0.74 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.34, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 4, curveSegments: 32 });
  g.center(); return g;
}

// A smooth gold glyph per ministry.
function emblem(kind, mat) {
  const g = new THREE.Group(), add = (geo, f) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; f && f(m); g.add(m); };
  if (kind === "body") {
    add(new THREE.CapsuleGeometry(0.025, 0.36, 6, 16), (m) => (m.rotation.z = Math.PI / 2));
    for (const x of [-0.17, 0.17]) add(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 32), (m) => { m.rotation.z = Math.PI / 2; m.position.x = x; });
  } else if (kind === "knowledge") {
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.17, 0.018, 0.23), (m) => { m.position.x = s * 0.085; m.rotation.z = s * -0.32; });
  } else if (kind === "faith") {
    const sh = new THREE.Shape(); sh.absarc(0, 0, 0.15, 0, Math.PI * 2, false);
    const cut = new THREE.Path(); cut.absarc(0.06, 0.03, 0.125, 0, Math.PI * 2, true); sh.holes.push(cut);
    add(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 48 }), (m) => m.geometry.center());
  } else if (kind === "habits") {
    const p = [[0, -0.15], [0.11, -0.15], [0.11, -0.13], [0.02, 0], [0.11, 0.13], [0.11, 0.15], [0, 0.15]].map(([x, y]) => new THREE.Vector2(x, y));
    add(new THREE.LatheGeometry(p, 40));
  } else {
    const p = []; for (let i = 0; i <= 24; i++) { const t = i / 24, a = t * Math.PI; p.push(new THREE.Vector2(Math.sin(a) * 0.09 * Math.pow(Math.sin(a / 2), 0.6) * 1.15, -Math.cos(a) * 0.13 - t * 0.04)); }
    add(new THREE.LatheGeometry(p.reverse(), 40));
  }
  return g;
}

// A ring at the pillar's foot that fills with approval.
const arcGeo = (frac) => new THREE.TorusGeometry(0.5, 0.022, 12, 96, Math.max(0.001, frac) * Math.PI * 2);

export function createPalace(container, { onPick, dark = true } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(3.5, 7, 4.5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ec3ff, 0.9); rim.position.set(-5, 3, -4); scene.add(rim);

  // The dais: one soft-edged disc with a recessed gold inlay.
  const daisProfile = [[0, 0], [3.0, 0], [3.12, 0.04], [3.18, 0.14], [3.14, 0.24], [3.02, 0.28], [0, 0.28]].map(([x, y]) => new THREE.Vector2(x, y));
  const daisMat = new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const dais = new THREE.Mesh(new THREE.LatheGeometry(daisProfile, 128), daisMat); dais.receiveShadow = true; scene.add(dais);
  const inlayMat = new THREE.MeshPhysicalMaterial({ roughness: 0.5 });
  const inlay = new THREE.Mesh(new THREE.CircleGeometry(2.55, 128), inlayMat); inlay.rotation.x = -Math.PI / 2; inlay.position.y = 0.281; inlay.receiveShadow = true; scene.add(inlay);
  const lineMat = new THREE.MeshBasicMaterial({ transparent: true });
  for (const r of [2.55, 1.05]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.012, r + 0.012, 160), lineMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.283; scene.add(ring); }
  // An eight-pointed star drawn into the floor.
  const starLine = new THREE.Shape(); for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, rr = i % 2 ? 0.74 : 0.95; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? starLine.lineTo(x, y) : starLine.moveTo(x, y); }
  const floorStar = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(starLine.getPoints()), new THREE.LineBasicMaterial({ transparent: true }));
  floorStar.rotation.x = -Math.PI / 2; floorStar.position.y = 0.284; scene.add(floorStar);
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.3 }));
  shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = -0.001; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);

  // A slender arch drawn as a single gold line behind the council.
  const archCurve = new THREE.CurvePath(), w = 2.7, h = 2.7;
  archCurve.add(new THREE.LineCurve3(new THREE.Vector3(-w, 0, 0), new THREE.Vector3(-w, h, 0)));
  archCurve.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w, h, 0), new THREE.Vector3(-w, h + 1.6, 0), new THREE.Vector3(0, h + 2.3, 0)));
  archCurve.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, h + 2.3, 0), new THREE.Vector3(w, h + 1.6, 0), new THREE.Vector3(w, h, 0)));
  archCurve.add(new THREE.LineCurve3(new THREE.Vector3(w, h, 0), new THREE.Vector3(w, 0, 0)));
  const goldMat = new THREE.MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.24, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const arch = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 200, 0.03, 12, false), goldMat); arch.position.set(0, 0.28, -2.35); scene.add(arch);

  // Floating motes of light.
  const n = 90, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 3.2; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.6 + Math.random() * 4.5; pos[i * 3 + 2] = Math.sin(a) * r - 0.5; }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dot = document.createElement("canvas"); dot.width = dot.height = 64; const dc = dot.getContext("2d"), gr = dc.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)"); dc.fillStyle = gr; dc.fillRect(0, 0, 64, 64);
  const dustMat = new THREE.PointsMaterial({ size: 0.09, map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dustG, dustMat); scene.add(dust);

  const picks = [];

  // The president: the star hovering over a low gold seat at the centre of the floor.
  const pres = new THREE.Group(); pres.position.set(0, 0.28, 0.95); pres.userData = { key: "president" };
  const seatP = [[0, 0], [0.5, 0], [0.53, 0.04], [0.52, 0.09], [0.46, 0.12], [0, 0.12]].map(([x, y]) => new THREE.Vector2(x, y));
  const seat = new THREE.Mesh(new THREE.LatheGeometry(seatP, 96), goldMat); seat.castShadow = true; seat.receiveShadow = true; pres.add(seat);
  const star = new THREE.Mesh(rubElHizb(0.4), goldMat); star.castShadow = true; star.position.y = 0.78; pres.add(star);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.008, 8, 128), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.55 })); halo.position.y = 0.78; pres.add(halo);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.7, 64, 1, true), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 0.47; pres.add(beam);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 12), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.65; pres.add(hit);
  scene.add(pres); picks.push(pres);

  // The cabinet: ceramic pillars in an arc behind the president.
  const ministers = {};
  ORDER.forEach((k, i) => {
    const a = (-1 + (i / (ORDER.length - 1)) * 2) * 1.15;
    const g = new THREE.Group(); g.position.set(Math.sin(a) * 2.0, 0.28, -Math.cos(a) * 1.55 - 0.1);
    const mat = new THREE.MeshPhysicalMaterial({ color: COLORS[k], roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color(0xffffff) });
    const pillar = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1, 12, 48), mat); pillar.castShadow = true; g.add(pillar);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.06, 64), goldMat); base.position.y = 0.03; base.castShadow = true; base.receiveShadow = true; g.add(base);
    const track = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.01, 8, 96), new THREE.MeshBasicMaterial({ color: COLORS[k], transparent: true, opacity: 0.25 }));
    track.rotation.x = -Math.PI / 2; track.position.y = 0.012; g.add(track);
    const ringMat = new THREE.MeshBasicMaterial({ color: COLORS[k], transparent: true, opacity: 0.95 });
    const ring = new THREE.Mesh(arcGeo(0.5), ringMat); ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 2; ring.position.y = 0.014; g.add(ring);
    const em = emblem(k, goldMat); em.scale.setScalar(1.45); g.add(em);
    g.userData = { key: k, pillar, ring, ringMat, mat, em, phase: i * 1.2, h: 1.0, target: 1.0, status: "ok", frac: 0.5 };
    scene.add(g); picks.push(g); ministers[k] = g;
  });
  const setHeight = (u, h) => {
    u.h = h; const len = Math.max(0.01, h - 0.6);
    u.pillar.geometry.dispose(); u.pillar.geometry = new THREE.CapsuleGeometry(0.3, len, 12, 48);
    u.pillar.position.y = 0.06 + 0.3 + len / 2;
  };
  for (const k of ORDER) setHeight(ministers[k].userData, 1.0);

  function applyTheme(isDark) {
    const t = THEMES[isDark ? "dark" : "light"];
    daisMat.color.setHex(t.dais); inlayMat.color.setHex(t.inlay);
    lineMat.color.setHex(t.line); lineMat.opacity = t.lineOpacity;
    floorStar.material.color.setHex(t.line); floorStar.material.opacity = t.lineOpacity * 0.8;
    shadowCatcher.material.opacity = t.shadow; renderer.toneMappingExposure = t.exposure;
    key.intensity = t.key; scene.environmentIntensity = t.env; dustMat.color.setHex(t.dust);
    dustMat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending; dustMat.opacity = isDark ? 0.8 : 0.45; dustMat.needsUpdate = true;
  }
  applyTheme(dark);

  // Camera: a slow drift; drag to look around.
  let az = 0, targetAz = 0, dragging = false, lastX = 0, moved = 0;
  const placeCamera = () => { const r = 8.7; camera.position.set(Math.sin(az) * r, 3.3, Math.cos(az) * r); camera.lookAt(0, 0.8, -0.5); };
  const el = renderer.domElement;
  el.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; moved = 0; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx); targetAz = Math.max(-0.8, Math.min(0.8, targetAz - dx * 0.006)); if (!running) frame(); });
  el.addEventListener("pointerup", (e) => {
    dragging = false;
    if (moved > 6 || !onPick) return;
    const r = el.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(picks, true)[0];
    if (hit) { let o = hit.object; while (o && !o.userData.key) o = o.parent; if (o) onPick(o.userData.key); }
  });

  const size = () => {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1.2 ? 34 : 28; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(() => { size(); if (!running) frame(); }); ro.observe(container);

  let running = false, raf = 0, visible = true;
  const clock = new THREE.Clock();
  function frame() {
    const time = clock.getElapsedTime(), still = reduced;
    for (const k of ORDER) {
      const u = ministers[k].userData;
      if (Math.abs(u.target - u.h) > 0.002) setHeight(u, still ? u.target : u.h + (u.target - u.h) * 0.08);
      const top = 0.06 + u.h;
      u.em.position.y = top + 0.38 + (still ? 0 : Math.sin(time * 1.4 + u.phase) * 0.04);
      if (!still) u.em.rotation.y = time * 0.8 + u.phase;
      const pulse = u.status === "bad" ? 0.55 + 0.45 * Math.sin(time * 4) : 1;
      u.ringMat.opacity = 0.95 * pulse;
    }
    if (!still) {
      star.rotation.y = time * 0.45; star.position.y = 0.78 + Math.sin(time * 0.9) * 0.05; beam.material.opacity = 0.06 + 0.03 * Math.sin(time * 1.3);
      halo.rotation.x = Math.PI / 2 + Math.sin(time * 0.5) * 0.15; halo.rotation.y = time * 0.2;
      dust.rotation.y = time * 0.02; dust.position.y = Math.sin(time * 0.3) * 0.08;
      if (!dragging) targetAz += (Math.sin(time * 0.1) * 0.22 - targetAz) * 0.003;
    }
    az += (targetAz - az) * 0.08; placeCamera();
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }
  const start = () => { if (running || reduced || !visible || document.hidden) return; running = true; clock.start(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }); io.observe(container);
  const vis = () => (document.hidden ? stop() : start()); document.addEventListener("visibilitychange", vis);
  size(); placeCamera(); frame(); start();

  return {
    // standing: { key: { approval: 0..1 | null, status: "ok" | "warn" | "bad" | "" } }
    update(standing) {
      for (const k of ORDER) {
        const u = ministers[k].userData, s = standing[k] || {};
        const a = s.approval == null ? 0.5 : Math.max(0, Math.min(1, s.approval));
        u.status = s.status || "ok"; u.target = 0.75 + 1.25 * a;
        if (Math.abs(a - u.frac) > 0.001) { u.frac = a; u.ring.geometry.dispose(); u.ring.geometry = arcGeo(a); }
        u.ringMat.color.setHex(STATUS[u.status] ?? COLORS[k]);
      }
      if (!running) frame();
    },
    setTheme(isDark) { applyTheme(isDark); if (!running) frame(); },
    destroy() { stop(); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", vis); pmrem.dispose(); renderer.dispose(); el.remove(); },
  };
}
