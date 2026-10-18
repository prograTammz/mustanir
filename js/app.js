// Al-Mustanir: the palace UI.
import {
  S, PRAYERS, MINISTERS, DECREE_ORDER, AYAH, addDays, diff, today, fmt, hijri, range, syncBed, termEnd, termLength, termDay,
  periods, intervalFor, TRAINED, manual, lastMastBefore, violation, day, dayMinisters, score, verdict, currentApproval,
  dayXP, totals, rankFor, streak, bestStreak, T, medals, pct,
} from "./logic.js";
import { SESSION, LS, HEALTH_URL, setRenderer, setStatus, saveDay, saveSettings, load, flushOutbox, loadHealth, newShortcutKey, signIn, signUp, signOut,
  pushSupported, pushState, enablePush, disablePush, testPush, newCalendarLink, loadReviews } from "./store.js";
import { lineChart, heatmap, ministerBars } from "./charts.js";
import { xpFloat, levelUp, burst } from "./fx.js";

S.selected = today();
const main = document.getElementById("main");
const M = Object.fromEntries(MINISTERS.map((m) => [m.key, m]));

/* ---------- helpers ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (k === "class") el.className = v; else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else if (v === true) el.setAttribute(k, ""); else if (v !== false && v != null) el.setAttribute(k, v);
  }
  kids.flat().forEach((c) => { if (c == null || c === false) return; el.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return el;
}
const ar = (t, cls = "") => h("span", { class: "ar " + cls, lang: "ar", dir: "rtl" }, t);
let lastPt = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener("pointerdown", (e) => { lastPt = { x: e.clientX, y: e.clientY }; }, true);

function rec() { return S.days[S.selected] || (S.days[S.selected] = {}); }
// Every change to a day goes through here, so the reward is always honest: XP shown is the real delta.
function set(k, v) {
  const before = dayXP(S.selected), lvBefore = totals().level;
  rec()[k] = v; saveDay(S.selected);
  const after = dayXP(S.selected), t = totals();
  render();
  if (after !== before) xpFloat(lastPt.x, lastPt.y - 10, after - before);
  if (t.level > lvBefore) setTimeout(() => levelUp(t.level, rankFor(t.level)), 500);
}
function chip(label, on, fn, cls) { return h("button", { class: "chip" + (cls ? " " + cls : ""), "aria-pressed": on ? "true" : "false", onclick: fn }, label); }
function yesNo(k, yes, no) { const v = rec()[k]; return [chip(yes, v === true, () => set(k, v === true ? null : true)), chip(no, v === false, () => set(k, v === false ? null : false), "no")]; }
function toggle(k, label) { const v = !!rec()[k]; return chip(label, v, () => set(k, !v)); }
function stepper(k, step) {
  const v = rec()[k] || 0;
  return h("div", { class: "stepper" },
    h("button", { "aria-label": "Less", onclick: () => set(k, Math.max(0, v - step)) }, "−"),
    h("input", { type: "number", inputmode: "numeric", min: "0", value: String(v), "aria-label": k, onchange: (e) => set(k, Math.max(0, parseInt(e.target.value, 10) || 0)) }),
    h("button", { "aria-label": "More", onclick: () => set(k, v + step) }, "+"));
}
function numIn(k, step, ph, after) {
  const v = rec()[k];
  return h("input", { class: "txt num", type: "number", inputmode: "decimal", step, min: "0", value: v != null ? String(v) : "", placeholder: ph, "aria-label": k, onchange: (e) => { const n = parseFloat(e.target.value); const val = isNaN(n) ? null : n; if (after) after(val); set(k, val); } });
}
const row = (label, ...kids) => h("div", { class: "row" }, label ? h("div", { class: "lbl" }, label) : null, ...kids);
const fromHealth = (r, k) => (String(r.source || "").startsWith("Apple Health") && r[k] != null ? h("span", { class: "hk", title: "Filled by Apple Health" }, "Health") : null);

function ring(frac, color, size = 44, label = "") {
  const r = size / 2 - 4, c = 2 * Math.PI * r;
  const wrap = h("div", { class: "ring", style: { width: size + "px", height: size + "px" }, role: "img", "aria-label": label });
  wrap.innerHTML = `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, frac)))}"/></svg>`;
  wrap.append(h("span", null, Math.round(frac * 100)));
  return wrap;
}
function emblemSVG(key) {
  const paths = {
    body: '<path d="M4 12h16M7 8v8M17 8v8M4.5 10v4M19.5 10v4"/>',
    knowledge: '<path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13"/>',
    faith: '<path d="M15.5 4.5a8 8 0 1 0 4 11 6.5 6.5 0 1 1-4-11z"/><path d="M17.5 8.5l.6 1.6 1.7.1-1.3 1 .4 1.7-1.4-.9-1.4.9.4-1.7-1.3-1 1.7-.1z"/>',
    habits: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
    purity: '<path d="M12 3.5c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.5 6-10.5z"/>',
    president: '<path d="M12 2l2.4 4.2 4.7-1-1 4.7L22 12l-4.2 2.4 1 4.7-4.7-1L12 22l-2.4-4.2-4.7 1 1-4.7L2 12l4.2-2.4-1-4.7 4.7 1z"/>',
  };
  const s = h("span", { class: "emb", style: { color: key === "president" ? "var(--gold)" : `var(--m-${key})` }, "aria-hidden": "true" });
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[key]}</svg>`;
  return s;
}

/* ---------- header ---------- */
function header() {
  const st = S.settings.termStart, t = today(), total = termLength(), dn = termDay(t);
  document.getElementById("hijri").textContent = hijri(t);
  document.getElementById("greg").textContent = fmt(t, { weekday: "long", day: "numeric", month: "long" });
  document.getElementById("termline").textContent = dn < 1 ? `Term I begins ${fmt(st, { day: "numeric", month: "long" })} · ${-dn + 1} days` : dn > total ? "Term I complete" : `Term I · day ${dn} of ${total}`;
  document.getElementById("termbar").style.width = Math.max(0, Math.min(100, ((dn - 1) / total) * 100)) + "%";
  document.querySelectorAll(".nav button").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === S.tab ? "page" : "false"));
}

/* ---------- standing ---------- */
function standing() {
  const { r, period } = currentApproval();
  const out = {};
  for (const m of MINISTERS) { const v = r ? r[m.key] : null; const [cls] = verdict(v, m.immune); out[m.key] = { approval: v, status: r && r.logged ? cls : "", period }; }
  return { out, r, period };
}

/* ---------- the advisor (weekly review) ---------- */
let reviewsLoading = false, reviewsTried = false;
function advisorCard(full) {
  if (!reviewsTried && SESSION) { reviewsTried = true; reviewsLoading = true; loadReviews().then(() => { reviewsLoading = false; render(); }).catch(() => { reviewsLoading = false; }); }
  const r = (S.reviews || [])[0];
  const card = h("section", { class: "card advisor" }, h("div", { class: "card-h" }, h("h2", null, "The advisor’s report"), ar("تقرير المستشار")));
  if (!r) { card.append(h("p", { class: "hint" }, reviewsLoading ? "Loading…" : "Every Friday the advisor reviews your week and writes here.")); }
  else {
    card.append(h("p", { class: "muted" }, "Week of " + fmt(r.week_start, { day: "numeric", month: "long" })), h("h3", { class: "adv-title" }, r.title));
    if (full) {
      card.append(h("p", null, r.summary));
      if ((r.recommendations || []).length) card.append(h("ol", { class: "recs" }, ...r.recommendations.map((x) => h("li", null, typeof x === "string" ? x : x.text || ""))));
      if ((r.changes || []).length) card.append(h("p", { class: "hint" }, "Changes made to the app this week:"), h("ul", { class: "recs" }, ...r.changes.map((x) => h("li", null, typeof x === "string" ? x : x.text || ""))));
    } else card.append(h("button", { class: "chip wide", onclick: () => go("council") }, "Read the full report"));
  }
  if (full) card.append(h("div", { class: "row" }, h("div", { class: "lbl" }, "Notes to the advisor: what to change in your plan or in this app. Read every Friday."),
    h("textarea", { class: "txt", placeholder: "e.g. Move reading to after Isha. Add a water counter to the Body decree.", oninput: (e) => { S.settings.advisorNotes = e.target.value; clearTimeout(S.timers.adv); S.timers.adv = setTimeout(saveSettings, 600); } }, S.settings.advisorNotes || "")));
  return card;
}

/* ---------- palace ---------- */
let palace3d = null, palaceHost = null, palaceTried = false;
function palaceStage() {
  if (!palaceHost) {
    palaceHost = h("div", { class: "stage", "aria-label": "The palace: the president and five ministers. Tap one to open their file." });
    palaceHost.append(h("div", { class: "stage-fallback" }, ...["body", "knowledge", "president", "faith", "habits", "purity"].map((k) => h("button", { class: "fb", onclick: () => openMinister(k), "aria-label": k === "president" ? "The president" : M[k].en }, emblemSVG(k)))));
  }
  if (!palaceTried) {
    palaceTried = true;
    import("./palace3d.js").then(({ createPalace }) => {
      palace3d = createPalace(palaceHost, { onPick: openMinister });
      if (palace3d) { palaceHost.classList.add("live"); palace3d.update(standing().out); }
    }).catch(() => { /* no WebGL or offline without the 3D library: the emblem row stays */ });
  } else if (palace3d) palace3d.update(standing().out);
  return palaceHost;
}

function renderPalace() {
  const t = totals(), rank = rankFor(t.level), { out, r } = standing();
  const dm = dayMinisters(today()), done = Object.values(dm).filter((v) => v >= 0.9).length;
  const office = streak(T.office);
  const kids = [];
  kids.push(palaceStage());
  kids.push(h("section", { class: "card president" },
    h("button", { class: "pres-top", onclick: () => openMinister("president") },
      h("div", { class: "seal-sm" }, emblemSVG("president"), h("b", null, t.level)),
      h("div", { class: "pres-id" }, ar("المُستنير", "big"), h("span", null, `${rank.en} · `, ar(rank.ar)))),
    h("div", { class: "xpbar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": t.need, "aria-valuenow": t.into, "aria-label": "Progress to next level" }, h("span", { style: { width: Math.round(t.frac * 100) + "%" } })),
    h("div", { class: "xpline" }, h("span", null, `${t.xp.toLocaleString("en")} XP`), h("span", null, `${(t.to - t.xp).toLocaleString("en")} to level ${t.level + 1}`)),
    h("div", { class: "stats3" },
      h("div", null, h("strong", null, office), h("span", null, "days in office")),
      h("div", null, h("strong", null, `${done}/5`), h("span", null, "decrees sealed today")),
      h("div", null, h("strong", null, r ? pct(r.overall) : "—"), h("span", null, "approval this month"))),
    h("button", { class: "btn", onclick: () => go("decrees") }, done === 5 ? "Today is sealed · review decrees" : "Issue today’s decrees")));

  kids.push(h("section", { class: "card" },
    h("div", { class: "card-h" }, h("h2", null, "The cabinet"), ar("مجلس الوزراء")),
    ...MINISTERS.map((m) => {
      const s = out[m.key], [cls, txt] = verdict(s.approval, m.immune);
      return h("button", { class: "minrow", onclick: () => openMinister(m.key) },
        emblemSVG(m.key),
        h("div", { class: "minrow-id" }, ar(m.ar), h("span", null, m.en)),
        h("div", { class: "minrow-s" }, h("strong", null, pct(s.approval)), h("span", { class: "st " + cls }, !s.status ? "Awaiting days" : m.immune ? (cls === "ok" ? "Strong" : "Needs attention") : txt)));
    })));

  kids.push(advisorCard(false));
  const ms = medals(), won = ms.filter((m) => m.won).length;
  kids.push(h("section", { class: "card" },
    h("div", { class: "card-h" }, h("h2", null, "Medals"), h("span", { class: "muted" }, `${won} of ${ms.length}`)),
    h("div", { class: "medals" }, ...ms.map((m) => h("div", { class: "medal" + (m.won ? " won" : ""), title: m.how },
      h("div", { class: "medal-i", "aria-hidden": "true" }), ar(m.ar), h("span", null, m.won ? m.en : m.how))))));

  kids.push(h("figure", { class: "ayah" }, h("blockquote", { lang: "ar", dir: "rtl" }, AYAH.ar), h("figcaption", null, AYAH.en, h("cite", null, " · " + AYAH.ref))));
  return kids;
}

/* ---------- minister file (sheet) ---------- */
function openMinister(key) {
  const { r, period } = currentApproval();
  const sheet = h("div", { class: "sheet-bg", onclick: (e) => { if (e.target === sheet) sheet.remove(); } });
  const close = h("button", { class: "x", "aria-label": "Close", onclick: () => sheet.remove() }, "×");
  let body;
  if (key === "president") {
    const t = totals(), rank = rankFor(t.level);
    body = [h("div", { class: "sheet-h" }, emblemSVG("president"), h("div", null, ar("الرئيس المُستنير", "big"), h("span", null, "The President"))), close,
      h("p", null, `Level ${t.level}, ${rank.en}. ${t.logged} days logged, ${t.perfect} perfect.`),
      h("div", { class: "ranks" }, ...[1, 3, 6, 9, 12].map((L) => { const rk = rankFor(L); return h("div", { class: "rk" + (t.level >= L ? " got" : "") }, ar(rk.ar), h("span", null, `${rk.en} · level ${L}`)); })),
      h("p", { class: "muted" }, "Every minister can earn up to 20 XP a day, and a perfect day adds 25 more.")];
  } else {
    const m = M[key], v = r ? r[key] : null, [cls, txt] = verdict(v, m.immune);
    const detail = r ? {
      body: `Training ${pct(r.training)} (${r.sessions} of ${Math.round(r.planned * 10) / 10} sessions), diet on target ${pct(r.diet)} of days.`,
      faith: "Average share of the five prayers kept; a made-up prayer counts half.",
      knowledge: `Days at ${S.settings.pagesPerDay} pages or more.`,
      purity: `Porn-free ${pct(r.porn)} of days, within the spacing schedule ${pct(r.plan)}.`,
      habits: "Up for Fajr and seven hours asleep count double; bedtime, routines and the watch once each.",
    }[key] : "No days in this council period yet.";
    const st = { body: null, faith: ["All five prayers", streak(T.prayers), bestStreak(T.prayers)], knowledge: ["Reading", streak(T.read), bestStreak(T.read)], purity: ["Porn-free", streak(T.pure), bestStreak(T.pure)], habits: ["Up for Fajr", streak(T.fajr), bestStreak(T.fajr)] }[key];
    body = [h("div", { class: "sheet-h" }, emblemSVG(key), h("div", null, ar(m.ar, "big"), h("span", null, `${m.en} · ${m.agenda}`))), close,
      h("div", { class: "sheet-score" }, ring(v || 0, `var(--m-${m.color})`, 72, "Approval"), h("div", null, h("strong", { class: "st " + cls }, txt), h("p", { class: "muted" }, period ? `${period.label} of the term` : "Last 30 days"))),
      h("p", null, detail),
      st ? h("p", null, `${st[0]} streak: ${st[1]} days now, best ${st[2]}.`) : null,
      m.immune ? h("p", { class: "muted" }, "The prayer is the foundation: this minister can never be impeached.") : h("p", { class: "muted" }, `Below ${S.settings.threshold}% at a council review, the strategy is impeached and replaced. The agenda stays.`),
      h("button", { class: "btn", onclick: () => { sheet.remove(); go("decrees"); setTimeout(() => document.getElementById("dec-" + key)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); } }, "Go to today’s decree")];
  }
  sheet.append(h("div", { class: "sheet", role: "dialog", "aria-modal": "true" }, ...body));
  document.body.append(sheet); close.focus();
}

/* ---------- decrees (daily log) ---------- */
function decree(key, side, ...rows) {
  const m = M[key], v = dayMinisters(S.selected)[key];
  return h("section", { class: "card decree", id: "dec-" + key, style: { "--mc": `var(--m-${m.color})` } },
    h("div", { class: "decree-h" }, emblemSVG(key), h("div", { class: "decree-id" }, ar(m.ar), h("span", null, side)), ring(v, `var(--m-${m.color})`, 44, m.en + " today")),
    ...rows);
}
function renderDecrees() {
  const s = S.selected, r = rec(), dn = termDay(s);
  const kids = [];
  const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  if (!standalone && !LS.get("a2-hide-install", false)) kids.push(h("div", { class: "banner" }, "Install Al-Mustanir: in Safari tap Share, then Add to Home Screen. ", h("button", { class: "chip sm", onclick: () => { LS.set("a2-hide-install", true); render(); } }, "Hide")));
  if (S.mode === "error") kids.push(h("div", { class: "banner" }, "Offline. Keep logging; your decrees sync when you’re back."));
  const xp = dayXP(s);
  kids.push(h("div", { class: "datebar" },
    h("button", { "aria-label": "Previous day", onclick: () => { S.selected = addDays(s, -1); render(); } }, "‹"),
    h("div", { class: "d" }, h("strong", null, fmt(s)), ar(hijri(s), "sm"), h("span", null, dn < 1 ? "Rehearsal day" : dn > termLength() ? "After term I" : `Day ${dn} · week ${Math.floor((dn - 1) / 7) + 1}`)),
    h("button", { "aria-label": "Next day", disabled: s >= today(), onclick: () => { if (s < today()) { S.selected = addDays(s, 1); render(); } } }, "›")));
  kids.push(h("div", { class: "dayxp" }, h("strong", null, `${xp} XP`), h("span", null, "earned this day · up to 125"), h("span", { class: "status", id: "status" })));

  // faith
  const pr = r.prayers || {};
  const cyc = (k) => { const cur = pr[k]; const nx = cur == null ? "on" : cur === "on" ? "late" : null; const p = { ...pr }; if (nx) p[k] = nx; else delete p[k]; set("prayers", p); };
  kids.push(decree("faith", `${Math.round(day(s).faith * 50) / 10} of 5 prayers`,
    h("div", { class: "prayers" }, ...PRAYERS.map(([k, l, a]) => h("button", { class: "prayer" + (pr[k] === "late" ? " late" : ""), "aria-pressed": pr[k] ? "true" : "false", onclick: () => cyc(k) }, ar(a), h("span", null, pr[k] === "late" ? l + " · qada" : l)))),
    h("p", { class: "hint" }, "Tap once for on time, twice for made up, a third time to clear. Combined prayers while travelling count as on time.")));

  // body
  const wkStart = dn >= 1 ? addDays(S.settings.termStart, Math.floor((dn - 1) / 7) * 7) : addDays(s, -6);
  const wk = range(wkStart, addDays(s, 1)).filter((k) => TRAINED.includes((S.days[k] || {}).train)).length;
  kids.push(decree("body", `${wk} of ${S.settings.sessionsPerWeek} sessions this week`,
    row("Training today", ...[["gym", "Gym"], ["tennis", "Tennis"], ["walk", "Walking pad"], ["rest", "Rest"]].map(([k, l]) => chip(l, r.train === k, () => set("train", r.train === k ? null : k)))),
    row("Walking pad (minutes)", stepper("walkMin", 10), fromHealth(r, "walkMin")),
    row("Calorie deficit (kcal)", numIn("deficit", "50", "e.g. 600", (v) => { if (v != null) rec().diet = v >= S.settings.deficitMin; }), fromHealth(r, "deficit")),
    row("On my deficit target", ...yesNo("diet", "Yes", "No")),
    h("p", { class: "hint" }, `Target ${S.settings.deficitMin} kcal or more.` + (r.dietaryKcal ? ` Burned ${((r.activeKcal || 0) + (r.basalKcal || 0)).toLocaleString("en")}, ate ${r.dietaryKcal.toLocaleString("en")} kcal.` : " Apple Health fills this after midnight if your food is logged.")),
    row("Weight (kg)", numIn("weight", "0.1", "e.g. 89.4"), fromHealth(r, "weight"), r.steps ? h("span", { class: "hint inline" }, `${r.steps.toLocaleString("en")} steps`) : null)));

  // knowledge
  kids.push(decree("knowledge", `${r.pages || 0} of ${S.settings.pagesPerDay} pages`,
    row("Pages read" + (S.settings.book ? ` in ${S.settings.book}` : ""), stepper("pages", 5)),
    row("Margin learning (minutes, not scored)", stepper("margin", 15))));

  // purity
  const last = lastMastBefore(s), iv = intervalFor(s), viol = violation(s);
  let allow;
  if (!last) allow = `Allowed today. Current spacing: every ${iv} days.`;
  else { const next = addDays(last, iv); allow = next <= s ? `Allowed today. Current spacing: every ${iv} days.` : `Next allowed ${fmt(next, { weekday: "short", day: "numeric", month: "short" })}. Current spacing: every ${iv} days.`; }
  kids.push(decree("purity", r.pornFree === true ? (viol ? "Outside the schedule" : `Clean · ${streak(T.pure)}-day streak`) : r.pornFree === false ? "Slip logged" : "Not confirmed",
    row("No porn today", ...yesNo("pornFree", "Confirmed", "Slipped")),
    row("Masturbation today", chip("No", r.mast === false, () => set("mast", r.mast === false ? null : false)), chip("Yes", r.mast === true, () => set("mast", r.mast === true ? null : true), viol ? "no" : "")),
    h("div", { class: "allow" }, viol ? "This was inside the spacing window. Log the trigger and carry on: a slip is data, not defeat." : allow),
    r.pornFree === false || viol ? row("What triggered it? Time, mood, place", h("input", { class: "txt", type: "text", value: r.note || "", placeholder: "e.g. 1am, bored, phone in bed", onchange: (e) => set("note", e.target.value.trim()) })) : null));

  // habits
  kids.push(decree("habits", `Window ${S.settings.bedtime} to ${S.settings.wake} · aim ${S.settings.sleepTarget} h`,
    row("Sleep", toggle("bed", "In bed by " + S.settings.bedtime), toggle("wake", "Up for Fajr by " + S.settings.wake)),
    row("Hours slept", numIn("sleepH", "0.25", "e.g. 7.2"), fromHealth(r, "sleepH"), h("span", { class: "hint inline" }, (r.sleepH || 0) >= S.settings.sleepTarget ? "Target met" : `Target ${S.settings.sleepTarget} h`)),
    row("Morning", toggle("hair", "Hair"), toggle("skinAm", "Skin"), toggle("teethAm", "Teeth")),
    row("Night", toggle("skinPm", "Skin"), toggle("teethPm", "Teeth")),
    row("Tracking", toggle("watch", "Watch worn and charged"))));

  // reflection
  const note = (k, label, ph) => row(label, h("textarea", { class: "txt", placeholder: ph, oninput: (e) => { rec()[k] = e.target.value; saveDay(S.selected); } }, r[k] || ""));
  kids.push(h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "The president’s journal"), ar("مذكرات الرئيس")),
    note("good", "What went well today?", "e.g. Prayed Fajr on time, hit 30 pages"),
    note("fix", "What got in the way, and what changes tomorrow?", "e.g. Slept late after a call; phone stays outside the bedroom")));
  return kids;
}

/* ---------- records (statistics) ---------- */
let healthLoading = false, healthFailedAt = 0;
const healthDue = () => !S.health && !healthLoading && SESSION && Date.now() - healthFailedAt > 60000;
const fetchHealth = (tab) => { healthLoading = true; loadHealth().then(() => { healthLoading = false; if (S.tab === tab) render(); }).catch(() => { healthLoading = false; healthFailedAt = Date.now(); if (S.tab === tab) render(); }); };
function renderRecords() {
  const kids = [];
  if (healthDue()) fetchHealth("records");
  const t = totals(), to = today(), days = S.range, from = addDays(to, -days + 1);
  kids.push(h("div", { class: "seg", role: "group", "aria-label": "Range" }, ...[[30, "30 days"], [90, "90 days"], [365, "1 year"], [730, "2 years"]].map(([n, l]) => chip(l, S.range === n, () => { S.range = n; render(); }))));

  const win = range(from, addDays(to, 1));
  const loggedDays = win.filter((k) => manual(S.days[k]));
  const prayerAvg = loggedDays.length ? loggedDays.reduce((a, k) => a + day(k).faith, 0) / loggedDays.length : null;
  const sleepVals = win.map((k) => (S.days[k] || {}).sleepH).filter((v) => v > 0);
  kids.push(h("div", { class: "tiles" },
    h("div", { class: "tile" }, h("strong", null, t.xp.toLocaleString("en")), h("span", null, "total XP")),
    h("div", { class: "tile" }, h("strong", null, bestStreak(T.office)), h("span", null, "longest run in office")),
    h("div", { class: "tile" }, h("strong", null, pct(prayerAvg)), h("span", null, "prayers kept")),
    h("div", { class: "tile" }, h("strong", null, sleepVals.length ? (sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(1) : "—"), h("span", null, "avg hours asleep"))));

  const sc = score(win);
  kids.push(h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Approval by minister"), h("span", { class: "muted" }, `last ${days} days`)),
    ministerBars({ items: MINISTERS.map((m) => ({ ...m, value: sc && sc.logged ? sc[m.key] : null })), threshold: S.settings.threshold }),
    h("p", { class: "hint" }, `The tick marks the impeachment line at ${S.settings.threshold}%.`)));

  const yearFrom = addDays(to, -Math.min(days, 365) + 1);
  kids.push(h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Days in office"), ar("سجل الأيام")),
    heatmap({ days: S.days, from: yearFrom, to, label: "Daily share of the agenda kept", valueOf: (k) => (manual(S.days[k]) ? dayXP(k) / 125 : null) })));

  const H = S.health?.byMetric || {};
  const series = (k, fromTracker) => {
    const map = new Map((H[k] || []).filter(([d]) => d >= from).map(([d, v]) => [d, v]));
    if (fromTracker) for (const d of win) { const v = (S.days[d] || {})[fromTracker]; if (v > 0 && !map.has(d)) map.set(d, v); }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  };
  const prayersSeries = win.filter((k) => manual(S.days[k])).map((k) => [k, day(k).faith * 5]);
  const charts = [
    ["Weight", "kg", 1, series("weight", "weight"), "var(--m-body)", null],
    ["Hours asleep", "h", 1, series("sleepH", "sleepH"), "var(--m-habits)", S.settings.sleepTarget],
    ["Prayers kept", "of 5", 1, prayersSeries, "var(--m-faith)", 5],
    ["Steps", "", 0, series("steps", "steps"), "var(--m-knowledge)", null],
    ["Active energy", "kcal", 0, series("activeKcal", "activeKcal"), "var(--m-body)", null],
    ["Resting heart rate", "bpm", 0, series("restingHR"), "var(--m-purity)", null],
    ["Heart rate variability", "ms", 0, series("hrv"), "var(--m-purity)", null],
  ];
  for (const [title, unit, digits, pts, color, goal] of charts) {
    kids.push(h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, title), h("span", { class: "muted" }, pts.length ? `${pts.length} days` : "")),
      lineChart({ points: pts, unit, digits, color, goal, smooth: pts.length > 60 ? 7 : 1 })));
  }
  const ls = S.health?.lastSync;
  kids.push(h("p", { class: "hint center" }, ls ? `Apple Health last synced ${new Date(ls.received_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.` : healthLoading ? "Loading Apple Health…" : healthFailedAt ? "Couldn’t load Apple Health data right now." : "Apple Health hasn’t synced yet. Set up the Shortcut in the Diwan."));
  return kids;
}

/* ---------- council (monthly review) ---------- */
function renderCouncil() {
  const t = today(), ps = periods();
  if (S.period == null) { const cur = ps.find((p) => t >= p.start && t < p.end); S.period = cur ? cur.i : t < ps[0].start ? 0 : 2; }
  const p = ps[S.period], endCount = t < p.end ? addDays(t, 1) : p.end;
  const dates = p.start < endCount ? range(p.start, endCount) : [];
  const r = score(dates), revDate = fmt(p.end, { day: "numeric", month: "long" });
  const kids = [h("div", { class: "seg" }, ...ps.map((x) => chip(`${x.label} · ${fmt(x.start, { month: "short" })}`, x.i === S.period, () => { S.period = x.i; render(); })))];
  kids.push(h("section", { class: "card council-h" }, ar("مجلس الشورى", "big"), h("p", null, `The council sits on ${revDate}. Each minister is judged on adherence, never on the scale.`)));
  if (!r) kids.push(h("section", { class: "card" }, h("p", null, t < p.start ? `This month starts ${fmt(p.start, { day: "numeric", month: "long" })}.` : "No days counted yet.")));
  else {
    const left = diff(t, p.end);
    kids.push(h("section", { class: "card" }, h("div", { class: "hero" }, h("strong", null, pct(r.overall)), h("span", null, `overall approval · ${r.logged} of ${r.n} days logged · ${left > 0 ? `council in ${left} day${left > 1 ? "s" : ""}` : "council is due"}`)),
      ministerBars({ items: MINISTERS.map((m) => ({ ...m, value: r[m.key] })), threshold: S.settings.threshold }),
      ...MINISTERS.map((m) => { const [cls, txt] = verdict(r[m.key], m.immune); return h("div", { class: "verdict" }, emblemSVG(m.key), h("span", null, m.en), h("strong", { class: "st " + cls }, txt)); })));
    const ws = Object.keys(S.days).filter((k) => k >= S.settings.termStart && S.days[k].weight != null).sort();
    if (ws.length > 1) {
      const a = S.days[ws[0]].weight, b = S.days[ws[ws.length - 1]].weight, dlt = Math.round((b - a) * 10) / 10;
      kids.push(h("section", { class: "card" }, h("div", { class: "kv" }, h("span", null, "Weight since the term began · the result, not the measure"), h("strong", null, `${dlt > 0 ? "+" : ""}${dlt} kg`))));
    }
  }
  kids.push(advisorCard(true));
  const notes = S.settings.revNotes || {};
  kids.push(h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "The council’s verdict"), ar("قرار المجلس")),
    h("p", { class: "hint" }, "Who keeps their seat, who is replaced, and the new strategy."),
    h("textarea", { class: "txt tall", placeholder: "e.g. Body holds. Knowledge impeached: reading moves to right after Fajr.", oninput: (e) => { S.settings.revNotes = { ...(S.settings.revNotes || {}), [p.i]: e.target.value }; clearTimeout(S.timers.rev); S.timers.rev = setTimeout(saveSettings, 600); } }, notes[p.i] || "")));
  return kids;
}

/* ---------- diwan (settings) ---------- */
function renderDiwan() {
  const f = (label, k, type, attrs) => h("div", { class: "field" }, h("label", { for: "f-" + k }, label), h("input", Object.assign({ id: "f-" + k, type, value: String(S.settings[k] ?? ""), onchange: (e) => { let v = e.target.value; if (type === "number") v = Math.max(0, parseFloat(v) || 0); S.settings[k] = v; if (k === "wake" || k === "windowHours") syncBed(); S.period = null; saveSettings(); render(); } }, attrs || {})));
  const keyMsg = (t) => { const el = document.getElementById("keymsg"); if (el) el.textContent = t; };
  const makeKey = async () => {
    keyMsg("Creating…");
    try { const key = await newShortcutKey(); const box = document.getElementById("keybox"); box.hidden = false; box.value = key; box.select(); keyMsg("Copy this key into your Shortcut now. It’s shown only once."); }
    catch (e) { keyMsg("Couldn’t create a key: " + e.message); }
  };
  const ls = S.health?.lastSync;
  if (healthDue()) fetchHealth("diwan");
  return [
    h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Targets"), ar("الأهداف")),
      f("Term start", "termStart", "date"),
      f("Training sessions per week", "sessionsPerWeek", "number", { min: "1", max: "14" }),
      f("Minimum calorie deficit (kcal)", "deficitMin", "number", { min: "0", step: "50" }),
      f("Daily reading minimum (pages)", "pagesPerDay", "number", { min: "1" }),
      f("Sleep target (hours)", "sleepTarget", "number", { min: "1", max: "12", step: "0.5" }),
      f("Wake for Fajr", "wake", "time"),
      f("Sleep window (hours)", "windowHours", "number", { min: "6", max: "10", step: "0.5" }),
      h("div", { class: "field" }, h("label", null, "Bedtime, set by the window"), h("strong", null, S.settings.bedtime)),
      f("Impeachment line (%)", "threshold", "number", { min: "0", max: "100" }),
      f("Current book", "book", "text", { placeholder: "Book title" })),
    scheduleCard(f),
    notifyCard(),
    calendarCard(),
    h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Apple Health"), ar("الصحة")),
      h("p", { class: "hint" }, "Your Shortcut sends Health data here every night at 23:59, and once for the last two years. Create a key, then paste it into the Shortcut."),
      h("div", { class: "field" }, h("label", null, "Address"), h("input", { class: "txt", readonly: true, value: HEALTH_URL, onclick: (e) => e.target.select() })),
      h("textarea", { id: "keybox", class: "txt mono", readonly: true, hidden: true }),
      h("button", { class: "btn", onclick: makeKey }, "Create Shortcut key"),
      h("p", { class: "hint", id: "keymsg" }),
      h("p", { class: "hint" }, ls ? `Last sync: ${new Date(ls.received_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · ${ls.samples.toLocaleString("en")} samples, ${ls.workouts} workouts (${ls.kind}).` : "No sync received yet.")),
    h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Account"), ar("الحساب")),
      h("div", { class: "field" }, h("label", null, "Signed in as"), h("strong", null, (SESSION && SESSION.email) || "")),
      h("button", { class: "chip wide", onclick: () => { signOut(); S.tab = "palace"; render(); } }, "Sign out")),
  ];
}

function scheduleCard(f) {
  const DAYS = [["SAT", "Sat"], ["SUN", "Sun"], ["MON", "Mon"], ["TUE", "Tue"], ["WED", "Wed"], ["THU", "Thu"], ["FRI", "Fri"]];
  const sel = String(S.settings.trainingDays || "").split(",").filter(Boolean);
  const togDay = (k) => { const s = new Set(sel); s.has(k) ? s.delete(k) : s.add(k); S.settings.trainingDays = DAYS.map((d) => d[0]).filter((x) => s.has(x)).join(","); saveSettings(); render(); };
  return h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "The daily schedule"), ar("جدول اليوم")),
    h("p", { class: "hint" }, "Drives your reminders and the Apple Calendar blocks."),
    h("div", { class: "field col" }, h("label", null, "Training days"), h("div", { class: "row tight" }, ...DAYS.map(([k, l]) => chip(l, sel.includes(k), () => togDay(k))))),
    f("Training starts", "trainingTime", "time"),
    f("Training length (minutes)", "trainingMin", "number", { min: "15", step: "15" }),
    f("Reading block starts", "readingTime", "time"),
    f("Reading length (minutes)", "readingMin", "number", { min: "10", step: "5" }),
    f("Wind-down before bed (minutes)", "windDownMin", "number", { min: "0", step: "15" }),
    f("Evening decrees reminder", "checkinTime", "time"),
    h("p", { class: "hint" }, `Tonight: wind-down ${toHM(hmOf(S.settings.bedtime) - Number(S.settings.windDownMin || 0))}, lights out ${S.settings.bedtime}, up for Fajr ${S.settings.wake}.`));
}
const hmOf = (s) => { const m = String(s || "").match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : 0; };
const toHM = (m) => { const x = ((m % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"); };

let pushStatus = null;
function notifyCard() {
  const msg = (t) => { const el = document.getElementById("pushmsg"); if (el) el.textContent = t; };
  if (pushStatus === null) { pushStatus = "…"; pushState().then((s) => { pushStatus = s; if (S.tab === "diwan") render(); }); }
  const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  const n = S.settings.notify || {};
  const pref = (k, label, when) => h("div", { class: "field" }, h("label", null, label, h("small", { class: "when" }, when)),
    chip(n[k] ? "On" : "Off", !!n[k], () => { S.settings.notify = { ...n, [k]: !n[k] }; saveSettings(); render(); }));
  const card = h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Notifications"), ar("التنبيهات")));
  if (!pushSupported() || (!standalone && /iPhone|iPad/.test(navigator.userAgent))) {
    card.append(h("p", { class: "hint" }, "On iPhone, notifications work once Al-Mustanir is on your home screen: Safari → Share → Add to Home Screen, then open it from the icon and come back here."));
    return card;
  }
  if (pushStatus === "denied") card.append(h("p", { class: "hint" }, "Notifications are blocked. Allow them in iOS Settings → Notifications → Mustanir."));
  else if (pushStatus === "on") card.append(h("p", { class: "hint" }, "This device receives reminders."),
    h("div", { class: "row" }, h("button", { class: "chip", onclick: async () => { msg("Sending…"); try { const d = await testPush(); msg(`Sent to ${d} device${d > 1 ? "s" : ""}.`); } catch (e) { msg(e.message); } } }, "Send a test"),
      h("button", { class: "chip", onclick: async () => { await disablePush(); pushStatus = "off"; render(); } }, "Turn off on this device")));
  else card.append(h("button", { class: "btn", onclick: async () => { msg("Asking…"); try { await enablePush(); pushStatus = "on"; render(); } catch (e) { msg(e.message); } } }, "Turn on notifications"));
  card.append(h("p", { class: "hint", id: "pushmsg" }));
  const wake = hmOf(S.settings.wake), bed = hmOf(S.settings.bedtime);
  card.append(
    pref("morning", "Morning decrees", toHM(wake + 20)),
    pref("reading", "Reading block", S.settings.readingTime),
    pref("training", "Training, 30 minutes before", toHM(hmOf(S.settings.trainingTime) - 30) + " on training days"),
    pref("evening", "Evening decrees, only if something’s open", S.settings.checkinTime),
    pref("windDown", "Wind-down", toHM(bed - Number(S.settings.windDownMin || 0))),
    pref("advisor", "The advisor’s weekly report", "Fridays"));
  return card;
}

function calendarCard() {
  const msg = (t) => { const el = document.getElementById("calmsg"); if (el) el.textContent = t; };
  const make = async () => {
    msg("Creating…");
    try {
      const link = await newCalendarLink();
      const box = document.getElementById("calbox"); box.hidden = false; box.value = link;
      const a = document.getElementById("caladd"); a.href = link; a.hidden = false;
      msg("Tap “Add to Apple Calendar”, then Subscribe. Any older link stops working.");
    } catch (e) { msg("Couldn’t create the link: " + e.message); }
  };
  return h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Apple Calendar"), ar("التقويم")),
    h("p", { class: "hint" }, "Subscribe once and your training slots, reading block, wind-down, sleep and council days appear in Apple Calendar, and follow any change you make here."),
    h("button", { class: "btn", onclick: make }, "Create calendar link"),
    h("a", { id: "caladd", class: "chip wide center", hidden: true }, "Add to Apple Calendar"),
    h("textarea", { id: "calbox", class: "txt mono", readonly: true, hidden: true, onclick: (e) => e.target.select() }),
    h("p", { class: "hint", id: "calmsg" }));
}

/* ---------- sign in ---------- */
function renderSignIn() {
  const msg = (t) => { const el = document.getElementById("authmsg"); if (el) el.textContent = t; };
  const val = (id) => document.getElementById(id).value.trim();
  const goAuth = async (create) => {
    const email = val("a-email"), password = document.getElementById("a-pass").value;
    LS.set("a2-email", email);
    if (!email || password.length < 8) { msg("Enter your email and a password of at least 8 characters."); return; }
    msg(create ? "Creating your account…" : "Signing in…");
    try {
      if (create) { if (!(await signUp(email, password))) { msg("Check your email and tap the confirmation link, then come back and sign in."); return; } }
      else await signIn(email, password);
      S.loaded = false; msg(""); await load(); saveSettings();
    } catch (e) { msg(e.message); }
  };
  return [h("section", { class: "card oath" },
    h("div", { class: "oath-star", "aria-hidden": "true" }),
    ar("بسم الله الرحمن الرحيم", "basmala"),
    h("h2", null, "Take the oath of office"),
    h("p", { class: "hint" }, "One account keeps your record synced between your phone, laptop and Apple Health."),
    h("div", { class: "row" }, h("div", { class: "lbl" }, "Email"), h("input", { id: "a-email", class: "txt", type: "email", autocomplete: "username", inputmode: "email", value: LS.get("a2-email", "") })),
    h("div", { class: "row" }, h("div", { class: "lbl" }, "Password"), h("input", { id: "a-pass", class: "txt", type: "password", autocomplete: "current-password" })),
    h("button", { class: "btn", onclick: () => goAuth(false) }, "Enter the palace"),
    h("button", { class: "chip wide", onclick: () => goAuth(true) }, "First time? Create account"),
    h("p", { class: "hint", id: "authmsg" }))];
}

/* ---------- render ---------- */
function go(tab) { S.tab = tab; history.replaceState(null, "", "#" + tab); render(); scrollTo(0, 0); }
function render() {
  header();
  const signin = S.mode === "signin" && !SESSION;
  document.body.classList.toggle("signed-out", signin);
  const views = { palace: renderPalace, decrees: renderDecrees, records: renderRecords, council: renderCouncil, diwan: renderDiwan };
  main.replaceChildren(...(signin ? renderSignIn() : (views[S.tab] || renderPalace)()));
}
setRenderer(render);
document.querySelectorAll(".nav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
const fromHash = () => { const t = location.hash.slice(1); if (["palace", "decrees", "records", "council", "diwan"].includes(t)) S.tab = t; };
fromHash(); addEventListener("hashchange", () => { fromHash(); render(); });
syncBed(); render(); load();
addEventListener("online", () => { flushOutbox().then(load); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && !S.dirty.size) load(); });
if ("serviceWorker" in navigator) addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
export { burst };
