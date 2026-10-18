// The palace gate: a pointed-arch portal with the verse inscribed above it, as the old builders
// placed a verse over the entrance. Its doors swing open when you arrive; tap to close or open them.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const GOLD = 0xd9b45f;
const THEMES = {
  light: { stone: 0xefe6d6, trim: 0xe3d6bf, step: 0xe8dfcf, shadow: 0.18, env: 0.9, key: 2.2, exposure: 1.0 },
  dark: { stone: 0x1d2e3a, trim: 0x243949, step: 0x1a2833, shadow: 0.5, env: 0.5, key: 1.8, exposure: 1.05 },
};

// Outline of a pointed arch: up the left jamb, over the two arcs to the apex, down the right jamb.
function archPoints(W, Hs, R, seg = 32) {
  const pts = [], cx = -W / 2 + R, aEnd = Math.acos(-cx / R);
  pts.push(new THREE.Vector2(-W / 2, 0));
  for (let i = 0; i <= seg; i++) { const a = Math.PI - (Math.PI - aEnd) * (i / seg); pts.push(new THREE.Vector2(cx + R * Math.cos(a), Hs + R * Math.sin(a))); }
  const left = pts.slice(1, -1).reverse();
  for (const p of left) pts.push(new THREE.Vector2(-p.x, p.y));
  pts.push(new THREE.Vector2(W / 2, Hs), new THREE.Vector2(W / 2, 0));
  return pts;
}
const apexOf = (W, Hs, R) => Hs + Math.sqrt(R * R - (R - W / 2) ** 2);

function starShape(r, inner = 0.74, rot = Math.PI / 16) {
  const s = new THREE.Shape();
  for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8 + rot, rr = i % 2 ? r * inner : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath(); return s;
}

// The inscription: gold naskh on a deep tile, two lines.
function inscription(lines) {
  const c = document.createElement("canvas"); c.width = 2048; c.height = 700;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const draw = () => {
    const g = c.getContext("2d"), W = c.width, H = c.height;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0f4a3c"); bg.addColorStop(1, "#0a3229"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // a fine geometric lattice in the tile
    g.strokeStyle = "rgba(230,195,122,0.10)"; g.lineWidth = 2;
    for (let x = -H; x < W + H; x += 70) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke(); g.beginPath(); g.moveTo(x + H, 0); g.lineTo(x, H); g.stroke(); }
    g.strokeStyle = "#e6c37a"; g.lineWidth = 10; g.strokeRect(26, 26, W - 52, H - 52);
    g.lineWidth = 3; g.strokeRect(50, 50, W - 100, H - 100);
    g.fillStyle = "#f0d48f"; g.textAlign = "center"; g.textBaseline = "middle"; g.direction = "rtl";
    g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = 14; g.shadowOffsetY = 4;
    g.font = '700 168px "Amiri", "Geeza Pro", "Noto Naskh Arabic", serif';
    lines.forEach((l, i) => g.fillText(l, W / 2, H * (0.33 + i * 0.36)));
    tex.needsUpdate = true;
  };
  draw();
  if (document.fonts?.load) document.fonts.load('700 168px "Amiri"', lines.join(" ")).then(draw).catch(() => {});
  return tex;
}

export function createGate(container, { dark = true, lines } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

  const key = new THREE.DirectionalLight(0xfff0d8, 2.2); key.position.set(4, 7, 8); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 5; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 8, bottom: -2, near: 1, far: 30 }); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9ec3ff, 0.5); fill.position.set(-6, 3, 4); scene.add(fill);

  const goldMat = new THREE.MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const stoneMat = new THREE.MeshPhysicalMaterial({ roughness: 0.55, clearcoat: 0.15 });
  const trimMat = new THREE.MeshPhysicalMaterial({ roughness: 0.5 });
  const stepMat = new THREE.MeshPhysicalMaterial({ roughness: 0.6 });
  const woodMat = new THREE.MeshPhysicalMaterial({ color: 0x3b2417, roughness: 0.48, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  const add = (mesh, cast = true, receive = true) => { mesh.castShadow = cast; mesh.receiveShadow = receive; return mesh; };

  // Proportions of the portal.
  const FW = 5.2, FH = 6.9, FD = 0.7, W = 2.6, Hs = 2.7, R = 1.7, apex = apexOf(W, Hs, R);
  const gate = new THREE.Group(); scene.add(gate);

  // The frame: a tall block with the arch cut through it.
  const portal = new THREE.Shape(); portal.moveTo(-FW / 2, 0); portal.lineTo(FW / 2, 0); portal.lineTo(FW / 2, FH); portal.lineTo(-FW / 2, FH); portal.closePath();
  portal.holes.push(new THREE.Path(archPoints(W, Hs, R)));
  const frameGeo = new THREE.ExtrudeGeometry(portal, { depth: FD, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 48 });
  gate.add(add(new THREE.Mesh(frameGeo, stoneMat)));

  // A stepped reveal around the opening and a gold line tracing the arch.
  const reveal = new THREE.Shape(archPoints(W + 0.5, Hs, R + 0.25)); reveal.holes.push(new THREE.Path(archPoints(W, Hs, R)));
  const rv = add(new THREE.Mesh(new THREE.ExtrudeGeometry(reveal, { depth: 0.08, bevelEnabled: false, curveSegments: 48 }), trimMat)); rv.position.z = FD + 0.04; gate.add(rv);
  const curve = new THREE.CatmullRomCurve3(archPoints(W + 0.5, Hs, R + 0.25, 48).map((p) => new THREE.Vector3(p.x, p.y, FD + 0.13)));
  gate.add(add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.025, 10, false), goldMat), false, false));

  // The inscription band above the arch, framed in gold.
  const bandW = 4.5, bandH = 1.54, bandY = apex + 0.38 + bandH / 2;
  const insTex = inscription(lines);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(bandW, bandH), new THREE.MeshStandardMaterial({ map: insTex, roughness: 0.35, metalness: 0.15, emissive: 0xffffff, emissiveMap: insTex, emissiveIntensity: 0.22 }));
  band.position.set(0, bandY, FD + 0.05); gate.add(band);
  const bf = new THREE.Shape(); bf.moveTo(-bandW / 2 - 0.08, -bandH / 2 - 0.08); bf.lineTo(bandW / 2 + 0.08, -bandH / 2 - 0.08); bf.lineTo(bandW / 2 + 0.08, bandH / 2 + 0.08); bf.lineTo(-bandW / 2 - 0.08, bandH / 2 + 0.08); bf.closePath();
  const bh = new THREE.Path(); bh.moveTo(-bandW / 2, -bandH / 2); bh.lineTo(-bandW / 2, bandH / 2); bh.lineTo(bandW / 2, bandH / 2); bh.lineTo(bandW / 2, -bandH / 2); bh.closePath(); bf.holes.push(bh);
  const bfm = add(new THREE.Mesh(new THREE.ExtrudeGeometry(bf, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }), goldMat)); bfm.position.set(0, bandY, FD + 0.02); gate.add(bfm);

  // Rosettes in the spandrels.
  for (const s of [-1, 1]) {
    const ros = add(new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.32), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), goldMat));
    ros.position.set(s * (W / 2 + 0.72), Hs + 1.05, FD + 0.05); gate.add(ros);
  }
  // A cornice and a crest of small pointed merlons along the top.
  const cornice = add(new THREE.Mesh(new THREE.BoxGeometry(FW + 0.3, 0.14, FD + 0.3), trimMat)); cornice.position.set(0, FH + 0.07, FD / 2); gate.add(cornice);
  const goldLine = add(new THREE.Mesh(new THREE.BoxGeometry(FW + 0.31, 0.03, FD + 0.31), goldMat), false); goldLine.position.set(0, FH + 0.02, FD / 2); gate.add(goldLine);
  const merlonShape = new THREE.Shape(archPoints(0.42, 0.22, 0.3, 12));
  const merlonGeo = new THREE.ExtrudeGeometry(merlonShape, { depth: 0.3, bevelEnabled: false });
  for (let i = 0; i < 9; i++) { const m = add(new THREE.Mesh(merlonGeo, stoneMat)); m.position.set(-FW / 2 + 0.29 + i * ((FW - 0.58) / 8), FH + 0.14, FD / 2 - 0.15); gate.add(m); }

  // Warm light inside, seen through the doors as they open.
  const glowTex = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, "#fff3d0"); gr.addColorStop(0.6, "#f2c46d"); gr.addColorStop(1, "#b9822f"); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const inner = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(archPoints(W, Hs, R))), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0 }));
  inner.geometry.computeBoundingBox(); { const uv = inner.geometry.attributes.uv, p = inner.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, p.getY(i) / apex); }
  inner.scale.set(1.5, 1.3, 1); inner.position.set(0, -0.1, -1.6); gate.add(inner);
  const spill = new THREE.PointLight(0xffc874, 0, 9, 1.6); spill.position.set(0, 1.4, -0.6); gate.add(spill);

  // The two door leaves, hinged at the jambs, studded and starred.
  const half = archPoints(W, Hs, R).filter((p) => p.x <= 0.0001);
  const leafShape = new THREE.Shape([...half.map((p) => new THREE.Vector2(p.x + W / 2, p.y)), new THREE.Vector2(W / 2, 0)]);
  const leafGeo = new THREE.ExtrudeGeometry(leafShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 32 });
  const archY = (x) => { const cx = -W / 2 + R, dx = x - cx; return Hs + Math.sqrt(Math.max(0, R * R - dx * dx)); }; // left arc height at x (x <= 0)
  const studGeo = new THREE.SphereGeometry(0.035, 12, 8);
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.32), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
  const ringGeo = new THREE.TorusGeometry(0.11, 0.02, 10, 40);
  const leaves = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(side * W / 2, 0, FD * 0.35); gate.add(hinge);
    const leaf = new THREE.Group(); if (side > 0) leaf.scale.x = -1; hinge.add(leaf);
    leaf.add(add(new THREE.Mesh(leafGeo, woodMat)));
    for (let x = 0.16; x < W / 2 - 0.08; x += 0.25) for (let y = 0.22; y < archY(x - W / 2) - 0.14; y += 0.32) {
      if (Math.abs(y - 1.75) < 0.42 && Math.abs(x - W / 4) < 0.42) continue;
      const s = new THREE.Mesh(studGeo, goldMat); s.position.set(x, y, 0.14); s.castShadow = true; leaf.add(s);
    }
    const st = add(new THREE.Mesh(starGeo, goldMat)); st.position.set(W / 4, 1.75, 0.12); leaf.add(st);
    const knock = add(new THREE.Mesh(ringGeo, goldMat)); knock.position.set(W / 2 - 0.17, 1.15, 0.19); leaf.add(knock);
    hinge.userData.side = side; leaves.push(hinge);
  }

  // Steps and a floor that only shows shadow.
  for (const [i, [w, d]] of [[FW + 0.6, 1.2], [FW + 1.2, 1.9]].entries()) {
    const s = add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), stepMat)); s.position.set(0, 0.08 - i * 0.16, FD / 2 + d / 2 - 0.25); gate.add(s);
  }
  gate.position.y = 0.32;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.3 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  function applyTheme(isDark) {
    const t = THEMES[isDark ? "dark" : "light"];
    stoneMat.color.setHex(t.stone); trimMat.color.setHex(t.trim); stepMat.color.setHex(t.step);
    ground.material.opacity = t.shadow; scene.environmentIntensity = t.env; key.intensity = t.key; renderer.toneMappingExposure = t.exposure;
  }
  applyTheme(dark);

  // Camera: frame the whole portal; a slow breath of movement.
  let az = 0, targetAz = 0, dragging = false, lastX = 0, moved = 0;
  const placeCamera = () => { const r = 19; camera.position.set(Math.sin(az) * r, 3.9, Math.cos(az) * r); camera.lookAt(0, 3.75, 0); };
  const size = () => {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const needW = FW + 1.4, needH = FH + 1.6, d = 19, fovH = 2 * Math.atan(needH / 2 / d), fovW = 2 * Math.atan(needW / 2 / d / camera.aspect);
    camera.fov = THREE.MathUtils.radToDeg(Math.max(fovH, fovW)); camera.updateProjectionMatrix();
  };

  let open = 0, target = reduced ? 1 : 0, opening = !reduced;
  const OPEN = 1.05; // radians at full open
  const el = renderer.domElement;
  el.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; moved = 0; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx); targetAz = Math.max(-0.5, Math.min(0.5, targetAz - dx * 0.004)); wake(); });
  el.addEventListener("pointerup", () => { dragging = false; if (moved < 6) { target = target > 0.5 ? 0 : 1; wake(); } });

  const setDoors = (v) => {
    for (const h of leaves) h.rotation.y = h.userData.side < 0 ? v * OPEN : -v * OPEN;
    inner.material.opacity = Math.min(1, v * 1.6); spill.intensity = v * 18;
  };
  setDoors(reduced ? 1 : 0);

  let running = false, raf = 0, visible = true, idleSince = 0;
  const clock = new THREE.Clock();
  const t0 = performance.now();
  function frame() {
    const time = clock.getElapsedTime();
    if (opening && performance.now() - t0 > 700) { target = 1; opening = false; }
    if (Math.abs(target - open) > 0.001) { open += (target - open) * 0.035; setDoors(open); idleSince = time; }
    if (!reduced && !dragging) targetAz += (Math.sin(time * 0.15) * 0.12 - targetAz) * 0.004;
    az += (targetAz - az) * 0.08; placeCamera();
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!running) start(); }
  const start = () => { if (running || !visible || document.hidden) return; running = true; clock.start(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const ro = new ResizeObserver(() => { size(); if (!running) frame(); }); ro.observe(container);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? (reduced ? frame() : start()) : stop(); }); io.observe(container);
  const vis = () => (document.hidden ? stop() : reduced ? frame() : start()); document.addEventListener("visibilitychange", vis);
  size(); placeCamera(); frame(); if (!reduced) start();

  return {
    setTheme(isDark) { applyTheme(isDark); if (!running) frame(); },
    destroy() { stop(); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", vis); pmrem.dispose(); renderer.dispose(); el.remove(); },
  };
}
