// Al-Mustanir: the palace UI.
import {
  S, PRAYERS, MINISTERS, DECREE_ORDER, AYAH, addDays, diff, today, fmt, hijri, range, syncBed, termEnd, termLength, termDay,
  periods, intervalFor, TRAINED, manual, lastMastBefore, violation, day, dayMinisters, score, verdict, currentApproval,
  dayXP, totals, rankFor, streak, bestStreak, T, medals, pct,
  SPORTS, DOW, hmMin, minHM, slotName, slotsOn, matchDay, checklistFor, hasSchedule, MAX_DAY_XP,
  VITALS, vitalityFor, VITALITY_XP, bioAge, ageOn, bioInputs, DEFAULTS,
} from "./logic.js";
import { SESSION, LS, HEALTH_URL, setRenderer, setStatus, saveDay, saveSettings, load, flushOutbox, loadHealth, newShortcutKey, signIn, signUp, signOut,
  pushSupported, pushState, enablePush, disablePush, testPush, newCalendarLink, loadReviews, loadMeals, addMeal, deleteMeal, PALACE_URL,
  loadHealthSummary, loadMetricSeries } from "./store.js";
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
  document.getElementById("termline").textContent = dn < 1 ? `in ${-dn + 1} d` : dn > total ? "Term done" : `${dn}/${total}`;
  document.getElementById("ctitle").textContent = (TITLES[S.tab] || TITLES.palace)[0];
  document.getElementById("termbar").style.width = Math.max(0, Math.min(100, ((dn - 1) / total) * 100)) + "%";
  document.querySelectorAll(".nav button").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === S.tab ? "page" : "false"));
}

const TITLES = {
  palace: ["Palace", "القصر"], decrees: ["Decrees", "المراسيم"], records: ["Records", "السجلات"], council: ["Council", "المجلس"], diwan: ["Diwan", "الديوان"],
};
function largeTitle(tab) {
  const [en, a] = TITLES[tab] || TITLES.palace, t = today(), dn = termDay(t);
  const sub = tab === "palace" ? fmt(t, { weekday: "long", day: "numeric", month: "long" }) + (dn >= 1 && dn <= termLength() ? ` · Term I, day ${dn}` : dn < 1 ? ` · Term I in ${-dn + 1} days` : "") : null;
  return h("header", { class: "ltitle" }, h("div", null, h("h1", null, en), sub ? h("p", null, sub) : null), ar(a));
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
      body: `Training ${pct(r.training)} (${r.sessions} of ${Math.round(r.planned * 10) / 10} sessions${r.plannedMin ? `, ${fmtMin(r.trainMin)} of ${fmtMin(r.plannedMin)} on court and in the gym` : ""}), diet on target ${pct(r.diet)} of days.`,
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
  const panel = h("div", { class: "sheet", role: "dialog", "aria-modal": "true" }, h("div", { class: "grabber", "aria-hidden": "true" }), ...body);
  sheet.append(panel);
  document.body.append(sheet); close.focus();
  swipeToClose(panel, () => sheet.remove());
}

// Drag a sheet down from its top to dismiss it, like a native sheet.
function swipeToClose(panel, done) {
  let y0 = null, dy = 0;
  panel.addEventListener("touchstart", (e) => { if (panel.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; panel.style.transition = "none"; } }, { passive: true });
  panel.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); if (dy > 0) panel.style.transform = `translateY(${dy}px)`; }, { passive: true });
  panel.addEventListener("touchend", () => {
    if (y0 == null) return; y0 = null; panel.style.transition = "transform .35s cubic-bezier(.3,1.35,.55,1)";
    if (dy > 110) { panel.style.transform = "translateY(100%)"; setTimeout(done, 220); } else panel.style.transform = "";
  });
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
  kids.push(h("div", { class: "dayxp" }, h("strong", null, `${xp} XP`), h("span", null, `earned this day · up to ${MAX_DAY_XP}`), h("span", { class: "status", id: "status" })));

  // faith
  const pr = r.prayers || {};
  const cyc = (k) => { const cur = pr[k]; const nx = cur == null ? "on" : cur === "on" ? "late" : null; const p = { ...pr }; if (nx) p[k] = nx; else delete p[k]; set("prayers", p); };
  kids.push(decree("faith", `${Math.round(day(s).faith * 50) / 10} of 5 prayers`,
    h("div", { class: "prayers" }, ...PRAYERS.map(([k, l, a]) => h("button", { class: "prayer" + (pr[k] === "late" ? " late" : ""), "aria-pressed": pr[k] ? "true" : "false", onclick: () => cyc(k) }, ar(a), h("span", null, pr[k] === "late" ? l + " · qada" : l)))),
    h("p", { class: "hint" }, "Tap once for on time, twice for made up, a third time to clear. Combined prayers while travelling count as on time.")));

  // body
  kids.push(bodyDecree(s, r, dn));

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

  kids.push(checklistCard(s));
  kids.push(vitalityCard(s));

  // reflection
  const note = (k, label, ph) => row(label, h("textarea", { class: "txt", placeholder: ph, oninput: (e) => { rec()[k] = e.target.value; saveDay(S.selected); } }, r[k] || ""));
  kids.push(h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "The president’s journal"), ar("مذكرات الرئيس")),
    note("good", "What went well today?", "e.g. Prayed Fajr on time, hit 30 pages"),
    note("fix", "What got in the way, and what changes tomorrow?", "e.g. Slept late after a call; phone stays outside the bedroom")));
  return kids;
}

/* ---------- Ministry of Body: sessions, walking pad, food ---------- */
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} m` : `${m} min`);
const sportEn = (k) => (SPORTS[k] || SPORTS.other).en;
function weekWindow(s, dn) { return dn >= 1 ? addDays(S.settings.termStart, Math.floor((dn - 1) / 7) * 7) : addDays(s, -6); }
function bodyDecree(s, r, dn) {
  const ms = matchDay(s);
  const wk = range(weekWindow(s, dn), addDays(s, 1)).flatMap((k) => matchDay(k));
  const wkPlanned = wk.length, wkDone = wk.filter((m) => m.status === "done").length;
  const mark = (id, val, sport) => {
    const marks = { ...(rec().slotMarks || {}) };
    if (val) marks[id] = val; else delete marks[id];
    if (val === "done" && sport) rec().train = sport;
    set("slotMarks", marks);
  };
  const statusLine = (m) => ({
    done: m.done ? `${fmtMin(m.done)} active${m.kcal ? ` · ${m.kcal} kcal` : ""}` : "Done",
    partial: `${fmtMin(m.done)} of ${fmtMin(m.planned)}${m.kcal ? ` · ${m.kcal} kcal` : ""}`,
    live: `${fmtMin(m.done)} so far`, missed: "No activity recorded", upcoming: "Upcoming", skipped: "Skipped",
  }[m.status]);
  const marked = (m) => ((rec().slotMarks || {})[m.slot.id]);
  const sessions = ms.length ? ms.map((m) => h("div", { class: "slot st-" + m.status },
      h("div", { class: "slot-main" },
        h("strong", null, slotName(m.slot)), h("span", { class: "muted" }, `${m.slot.start}–${m.slot.end}${m.slot.date ? " · one-off" : ""}`),
        h("span", { class: "slot-status" }, h("i", { class: "dot", "aria-hidden": "true" }), statusLine(m), m.source && !marked(m) ? h("span", { class: "hk" }, "Watch") : null)),
      h("div", { class: "slot-act" },
        marked(m) ? h("button", { class: "chip sm", onclick: () => mark(m.slot.id, null) }, "Undo")
          : [m.status !== "done" ? h("button", { class: "chip sm", onclick: () => mark(m.slot.id, "done", m.slot.sport) }, "Done") : null,
             m.status === "upcoming" || m.status === "missed" ? h("button", { class: "chip sm", onclick: () => mark(m.slot.id, "skipped") }, "Skip") : null])))
    : [h("p", { class: "hint" }, hasSchedule() ? "Rest day. Nothing scheduled." : "No training schedule yet. Add your slots in the Diwan.")];

  // food
  if (SESSION && !(S.meals || {})[s] && !mealsLoading.has(s)) { mealsLoading.add(s); loadMeals(s).then(() => { mealsLoading.delete(s); render(); }).catch(() => mealsLoading.delete(s)); }
  const meals = (S.meals || {})[s] || [];
  const pending = meals.filter((m) => !m.exported_at).reduce((a, m) => a + Number(m.kcal), 0);
  const eaten = (r.dietaryKcal || 0) + pending, burned = (r.activeKcal || 0) + (r.basalKcal || 0);
  const deficit = burned && eaten ? burned - eaten : null;
  const foodMsg = (t) => { const el = document.getElementById("foodmsg"); if (el) el.textContent = t; };
  const addFood = async () => {
    const kcal = parseFloat(document.getElementById("f-kcal").value), name = document.getElementById("f-name").value.trim(), protein = parseFloat(document.getElementById("f-prot").value);
    if (!(kcal > 0)) { foodMsg("Enter the calories."); return; }
    try { await addMeal(s, { kcal, name, protein: isNaN(protein) ? null : protein }); render(); }
    catch { foodMsg("Couldn’t save the meal. Food needs a connection."); }
  };

  return decree("body", wkPlanned ? `${wkDone} of ${wkPlanned} sessions this week` : "Training and diet",
    h("div", { class: "subhead" }, "Today’s sessions"),
    ...sessions,
    h("button", { class: "chip wide", onclick: () => openSlotSheet({ date: s }) }, "Add a session today"),
    h("div", { class: "subhead" }, "Walking pad"),
    row(null, stepper("walkMin", 10), h("span", { class: "hint inline" }, r.walkMin && String(r.source || "").startsWith("Apple Health") ? "Logged by the watch or the Walking Pad shortcut" : "minutes · logs itself with the Walking Pad shortcut")),
    h("div", { class: "subhead" }, "Food"),
    ...meals.map((m) => h("div", { class: "meal" },
      h("div", null, h("strong", null, `${Math.round(m.kcal)} kcal`), h("span", { class: "muted" }, ` ${m.name || "Meal"} · ${new Date(m.eaten_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}${m.protein ? ` · ${Math.round(m.protein)} g protein` : ""}`)),
      m.exported_at ? h("span", { class: "hk ok" }, "In Health") : h("button", { class: "x-del", "aria-label": "Remove meal", onclick: async () => { await deleteMeal(s, m.id).catch(() => {}); render(); } }, "×"))),
    h("div", { class: "foodadd" },
      h("input", { id: "f-kcal", class: "txt", type: "number", inputmode: "numeric", placeholder: "kcal", min: "0" }),
      h("input", { id: "f-name", class: "txt", type: "text", placeholder: "What (optional)" }),
      h("input", { id: "f-prot", class: "txt", type: "number", inputmode: "numeric", placeholder: "Protein g", min: "0" }),
      h("button", { class: "chip", onclick: addFood }, "Add")),
    h("p", { class: "hint", id: "foodmsg" }, eaten || burned ? `Eaten ${Math.round(eaten).toLocaleString("en")} · burned ${Math.round(burned).toLocaleString("en")} kcal` + (deficit != null ? ` · deficit ${Math.round(deficit).toLocaleString("en")} (target ${S.settings.deficitMin})` : "") : "Meals go to Apple Health with the nightly Shortcut."),
    row("On my deficit target", ...yesNo("diet", "Yes", "No")),
    row("Weight (kg)", numIn("weight", "0.1", "e.g. 89.4"), fromHealth(r, "weight"), r.steps ? h("span", { class: "hint inline" }, `${r.steps.toLocaleString("en")} steps`) : null));
}
const mealsLoading = new Set();

/* ---------- productivity checklist ---------- */
function checklistCard(s) {
  const c = checklistFor(s), r = rec();
  const toggleCheck = (id) => set("checks", { ...(r.checks || {}), [id]: !(r.checks || {})[id] });
  const addTask = () => { const el = document.getElementById("t-new"); const text = el.value.trim(); if (!text) return; set("extraTasks", [...(r.extraTasks || []), { id: "x" + Date.now().toString(36), text }]); };
  return h("section", { class: "card decree", style: { "--mc": "var(--gold)" } },
    h("div", { class: "decree-h" }, emblemSVG("president"), h("div", { class: "decree-id" }, ar("قائمة الإنجاز"), h("span", null, `Daily checklist · ${c.done} of ${c.total}`)), ring(c.frac || 0, "var(--gold)", 44, "Productivity today")),
    ...c.items.map((x) => h("div", { class: "check" + (c.checks[x.id] ? " on" : "") },
      h("button", { class: "tick", role: "checkbox", "aria-checked": c.checks[x.id] ? "true" : "false", "aria-label": x.text, onclick: () => toggleCheck(x.id) }),
      h("span", { onclick: () => toggleCheck(x.id) }, x.text),
      (r.extraTasks || []).some((t) => t.id === x.id) ? h("button", { class: "x-del", "aria-label": "Remove task", onclick: () => set("extraTasks", r.extraTasks.filter((t) => t.id !== x.id)) }, "×") : null)),
    h("div", { class: "foodadd two" }, h("input", { id: "t-new", class: "txt", type: "text", placeholder: "Add a task for today only", onkeydown: (e) => { if (e.key === "Enter") addTask(); } }), h("button", { class: "chip", onclick: addTask }, "Add")),
    h("p", { class: "hint" }, `Productivity counts up to ${20} XP a day. Edit the standing list in the Diwan.`));
}

/* ---------- vitality ---------- */
function vitalityCard(s) {
  const v = vitalityFor(s);
  return h("section", { class: "card decree", style: { "--mc": "var(--m-body)" } },
    h("div", { class: "decree-h" }, emblemSVG("body"), h("div", { class: "decree-id" }, ar("الحيوية"), h("span", null, v.seen ? `Vitality · ${v.hits} of ${v.total}` : "Vitality · waiting for the watch")),
      ring(v.frac || 0, "var(--m-body)", 44, "Vitality today")),
    h("div", { class: "vitals" }, ...v.items.map((x) => h("div", { class: "vital" + (x.hit ? " on" : "") },
      ring(x.frac, x.hit ? "var(--ok)" : "var(--m-body)", 40, x.en),
      h("strong", null, x.val == null ? "—" : x.fmt(x.val)),
      h("span", null, `${x.en} · ${x.goal}${x.unit ? " " + x.unit : ""}`)))),
    h("p", { class: "hint" }, `Filled by the watch. Each vital you keep is worth ${VITALITY_XP / VITALS.length} XP on days you log; 4 of 5 for 7 days wins the Vitality medal. Goals are in the Diwan.`));
}

/* ---------- sheets ---------- */
function openSheet(title, arTitle, nodes) {
  const bg = h("div", { class: "sheet-bg", onclick: (e) => { if (e.target === bg) close(); } });
  const close = () => bg.remove();
  const panel = h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": title }, h("div", { class: "grabber", "aria-hidden": "true" }),
    h("div", { class: "sheet-h plain" }, h("div", null, h("strong", { class: "sheet-title" }, title), arTitle ? ar(arTitle) : null)),
    h("button", { class: "x", "aria-label": "Close", onclick: close }, "×"), ...nodes(close));
  bg.append(panel); document.body.append(bg); swipeToClose(panel, close);
  return close;
}
function openSlotSheet(pre = {}) {
  const st = { sport: pre.sport || "tennis", label: "", mode: pre.date ? "once" : "weekly", days: [], date: pre.date || today(), start: "19:00", end: "20:30" };
  const DAYS = [["SAT", "Sat"], ["SUN", "Sun"], ["MON", "Mon"], ["TUE", "Tue"], ["WED", "Wed"], ["THU", "Thu"], ["FRI", "Fri"]];
  let body;
  const draw = () => {
    body.replaceChildren(...[
      h("div", { class: "subhead" }, "Sport"),
      h("div", { class: "row tight" }, ...Object.entries(SPORTS).map(([k, v]) => chip(v.en, st.sport === k, () => { st.sport = k; draw(); }))),
      st.sport === "other" ? h("input", { class: "txt", placeholder: "Name, e.g. Padel", value: st.label, oninput: (e) => (st.label = e.target.value) }) : null,
      h("div", { class: "subhead" }, "Repeats"),
      h("div", { class: "seg" }, chip("Every week", st.mode === "weekly", () => { st.mode = "weekly"; draw(); }), chip("One date", st.mode === "once", () => { st.mode = "once"; draw(); })),
      st.mode === "weekly" ? h("div", { class: "row tight" }, ...DAYS.map(([k, l]) => chip(l, st.days.includes(k), () => { st.days = st.days.includes(k) ? st.days.filter((x) => x !== k) : [...st.days, k]; draw(); })))
        : h("div", { class: "field" }, h("label", null, "Date"), h("input", { type: "date", value: st.date, onchange: (e) => (st.date = e.target.value) })),
      h("div", { class: "field" }, h("label", null, "Starts"), h("input", { type: "time", value: st.start, onchange: (e) => (st.start = e.target.value) })),
      h("div", { class: "field" }, h("label", null, "Ends"), h("input", { type: "time", value: st.end, onchange: (e) => (st.end = e.target.value) })),
      h("p", { class: "hint", id: "slotmsg" }),
      h("button", { class: "btn", onclick: () => save() }, "Add to schedule")].filter(Boolean));
  };
  let closeFn;
  const save = () => {
    const msg = document.getElementById("slotmsg");
    if (st.mode === "weekly" && !st.days.length) { msg.textContent = "Pick at least one day."; return; }
    if (hmMin(st.start) == null || hmMin(st.end) == null || hmMin(st.end) === hmMin(st.start)) { msg.textContent = "Set a start and end time."; return; }
    const slot = { id: st.sport + "-" + Date.now().toString(36), sport: st.sport, start: st.start, end: st.end, ...(st.sport === "other" && st.label.trim() ? { label: st.label.trim() } : {}) };
    if (st.mode === "weekly") S.settings.training = [...(S.settings.training || []), { ...slot, days: DAYS.map((d) => d[0]).filter((d) => st.days.includes(d)) }];
    else S.settings.trainingOnce = [...(S.settings.trainingOnce || []), { ...slot, date: st.date }];
    saveSettings(); closeFn(); render();
  };
  closeFn = openSheet("Add a training slot", "موعد تدريب", () => { body = h("div"); draw(); return [body]; });
}

/* ---------- records (statistics) ---------- */
let healthLoading = false, healthFailedAt = 0;
const healthDue = () => !S.health && !healthLoading && SESSION && Date.now() - healthFailedAt > 60000;
const fetchHealth = (tab) => { healthLoading = true; loadHealth().then(() => { healthLoading = false; if (S.tab === tab) render(); }).catch(() => { healthLoading = false; healthFailedAt = Date.now(); if (S.tab === tab) render(); }); };
function renderRecords() {
  if (healthDue()) fetchHealth("records");
  const sw = h("div", { class: "seg", role: "group", "aria-label": "View" }, ...[["agenda", "Agenda"], ["health", "Health"]].map(([k, l]) => chip(l, (S.recTab || "agenda") === k, () => { S.recTab = k; render(); })));
  if (S.recTab === "health") return [sw, ...renderHealth()];
  return [sw, ...renderAgenda()];
}
function renderAgenda() {
  const kids = [];
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
    heatmap({ days: S.days, from: yearFrom, to, label: "Daily share of the agenda kept", valueOf: (k) => (manual(S.days[k]) ? dayXP(k) / MAX_DAY_XP : null) })));

  const H = S.health?.byMetric || {};
  const series = (k, fromTracker) => {
    const map = new Map((H[k] || []).filter(([d]) => d >= from).map(([d, v]) => [d, v]));
    if (fromTracker) for (const d of win) { const v = (S.days[d] || {})[fromTracker]; if (v > 0 && !map.has(d)) map.set(d, v); }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  };
  const prayersSeries = win.filter((k) => manual(S.days[k])).map((k) => [k, day(k).faith * 5]);
  const prodSeries = win.filter((k) => manual(S.days[k]) && checklistFor(k).total).map((k) => [k, Math.round((checklistFor(k).frac || 0) * 100)]);
  const trainSeries = win.map((k) => [k, matchDay(k).reduce((a, m) => a + (m.status === "skipped" ? 0 : m.done), 0)]).filter(([k, v]) => v > 0 || slotsOn(k).length);
  const charts = [
    ["Weight", "kg", 1, series("weight", "weight"), "var(--m-body)", null],
    ["Hours asleep", "h", 1, series("sleepH", "sleepH"), "var(--m-habits)", S.settings.sleepTarget],
    ["Prayers kept", "of 5", 1, prayersSeries, "var(--m-faith)", 5],
    ["Productivity", "%", 0, prodSeries, "var(--gold)", 80],
    ["Training minutes (watch)", "min", 0, trainSeries, "var(--m-body)", null],
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

/* ---------- health: biological age, vitals, every metric ---------- */
const SHORT = { day: "numeric", month: "short", year: "numeric" };
let summaryLoading = false, summaryFailedAt = 0;
const CATS = [["activity", "Activity", "النشاط"], ["heart", "Heart", "القلب"], ["sleep", "Sleep", "النوم"], ["body", "Body", "الجسم"], ["mobility", "Mobility", "الحركة"],
  ["vitals", "Vitals", "الحيوية"], ["environment", "Environment", "البيئة"], ["nutrition", "Nutrition", "التغذية"], ["sport", "Sport", "الرياضة"], ["mind", "Mind", "العقل"]];
function fmtVal(v, unit, key) {
  if (v == null || !isFinite(v)) return "—";
  if (unit === "min" && /^sleep/.test(key || "")) return fmtMin(Math.round(v));
  const a = Math.abs(v);
  const n = a >= 1000 ? Math.round(v).toLocaleString("en") : a >= 100 ? String(Math.round(v)) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2).replace(/0$/, "") : v.toFixed(3).replace(/0+$/, "");
  return unit ? `${n} ${unit}` : n;
}
function renderHealth() {
  const kids = [];
  if (!S.healthSummary && !summaryLoading && SESSION && Date.now() - summaryFailedAt > 60000) {
    summaryLoading = true;
    loadHealthSummary().then(() => { summaryLoading = false; if (S.tab === "records") render(); }).catch(() => { summaryLoading = false; summaryFailedAt = Date.now(); if (S.tab === "records") render(); });
  }
  kids.push(bioCard());
  kids.push(vitalityHistoryCard());
  kids.push(explorerCard());
  return kids;
}

function bioCard() {
  const H = S.health?.byMetric;
  const card = (...k) => h("section", { class: "card bio" }, h("div", { class: "card-h" }, h("h2", null, "Biological age"), ar("العمر البيولوجي")), ...k);
  if (!S.settings.birthDate) {
    return card(h("p", null, "Your watch data can estimate how old your body behaves. Add your birth date to see it."),
      h("div", { class: "foodadd two" }, h("input", { id: "f-birth", class: "txt", type: "date" }),
        h("button", { class: "chip", onclick: () => { const v = document.getElementById("f-birth").value; if (v) { S.settings.birthDate = v; saveSettings(); render(); } } }, "Save")));
  }
  if (!H) return card(h("p", { class: "hint" }, healthLoading ? "Reading three years of Apple Health…" : "No Apple Health data yet."));
  const t = today(), age = ageOn(S.settings.birthDate, t);
  const b = bioAge(age, bioInputs(H, t), S.settings.sex);
  if (!b || !b.factors.length) return card(h("p", { class: "hint" }, "Not enough recent watch data for an estimate yet."));
  const younger = b.delta < 0;
  const max = Math.max(4, ...b.factors.map((f) => Math.abs(f.years)));
  const bar = (y) => {
    const w = (Math.abs(y) / max) * 50;
    return h("div", { class: "dbar", role: "img", "aria-label": `${y > 0 ? "+" : ""}${y} years` },
      h("i", { class: "mid" }), h("b", { class: y > 0 ? "older" : "younger", style: { width: w + "%", [y > 0 ? "left" : "right"]: "50%" } }));
  };
  // month by month: the gap between body and calendar
  const first = (H.steps || [])[0]?.[0] || t;
  const trend = [];
  for (let d = new Date(first + "T12:00:00"); ; d.setMonth(d.getMonth() + 1)) {
    let k = d.toISOString().slice(0, 10); if (k > t) k = t;
    const x = bioAge(ageOn(S.settings.birthDate, k), bioInputs(H, k), S.settings.sex);
    if (x && x.factors.length >= 3) trend.push([k, Math.round(x.delta * 10) / 10]);
    if (k === t) break;
  }
  return card(
    h("div", { class: "bio-hero" },
      h("div", null, h("strong", { class: "bio-num" }, b.bio.toFixed(1)), h("span", null, "body age")),
      h("div", null, h("strong", { class: "bio-num muted" }, age.toFixed(1)), h("span", null, "calendar age")),
      h("span", { class: "bio-delta " + (younger ? "good" : "bad") }, `${younger ? "▼" : "▲"} ${Math.abs(b.delta).toFixed(1)} years ${younger ? "younger" : "older"}`)),
    b.fitnessAge ? h("p", { class: "hint" }, `Fitness age from VO₂ max: ${b.fitnessAge.toFixed(0)}.`) : null,
    h("div", { class: "subhead" }, "What moves it"),
    ...b.factors.map((f) => h("div", { class: "factor" },
      h("div", { class: "factor-t" }, h("strong", null, f.en), h("span", { class: "fy " + (f.years > 0 ? "older" : f.years < 0 ? "younger" : "") }, f.years === 0 ? "±0" : `${f.years > 0 ? "+" : "−"}${Math.abs(f.years).toFixed(1)} y`)),
      bar(f.years), h("span", { class: "muted small" }, f.note))),
    h("div", { class: "legend" }, h("span", null, h("i", { class: "sw younger" }), "makes you younger"), h("span", null, h("i", { class: "sw older" }), "makes you older")),
    trend.length > 2 ? [h("div", { class: "subhead" }, "Years older than your age, month by month"), lineChart({ points: trend, unit: "y", digits: 1, color: "var(--m-purity)", goal: 0, smooth: 1 })] : null,
    h("p", { class: "hint" }, "Estimate from your last 60 days: each measure's link to long-term health in large studies, converted to years. It shows direction, not a diagnosis."));
}

function vitalityHistoryCard() {
  const t = today(), days = range(addDays(t, -29), addDays(t, 1));
  const pts = days.map((k) => [k, vitalityFor(k)]).filter(([, v]) => v.seen).map(([k, v]) => [k, v.hits]);
  const avg = (k) => { const v = days.map((d) => (S.days[d] || {})[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const goals = { ...DEFAULTS.vitality, ...(S.settings.vitality || {}) };
  return h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Vitality"), h("span", { class: "muted" }, "last 30 days")),
    lineChart({ points: pts, unit: "of 5", digits: 0, color: "var(--m-body)", goal: 4, smooth: 7 }),
    h("div", { class: "tiles five" }, ...VITALS.map((x) => { const a = avg(x.k); return h("div", { class: "tile" + (a != null && a >= goals[x.k] ? " ok" : "") }, h("strong", null, a == null ? "—" : x.fmt(a)), h("span", null, `${x.en} avg`)); })));
}

function explorerCard() {
  const sum = S.healthSummary;
  const cat = S.hcat || "activity";
  const head = h("div", { class: "card-h" }, h("h2", null, "Every measure"), ar("كل المقاييس"));
  if (!sum) return h("section", { class: "card" }, head, h("p", { class: "hint" }, summaryLoading ? "Loading…" : "Couldn’t load the measures right now."));
  const rows = new Map(sum.rows.map((r) => [r.metric, r]));
  const metas = sum.catalog.filter((m) => m.category !== "private" && rows.has(m.key));
  const cats = CATS.filter(([k]) => metas.some((m) => m.category === k));
  const list = metas.filter((m) => m.category === cat);
  return h("section", { class: "card" }, head,
    h("p", { class: "hint" }, `${metas.length} measures from Apple Health · ${sum.rows.reduce((a, r) => a + r.days, 0).toLocaleString("en")} daily records.`),
    h("div", { class: "seg scroll" }, ...cats.map(([k, l]) => chip(l, k === cat, () => { S.hcat = k; render(); }))),
    ...list.map((m) => {
      const r = rows.get(m.key);
      const ch = r.avg30 != null && r.prev30 ? (r.avg30 - r.prev30) / Math.abs(r.prev30) : null;
      const good = ch == null || !m.better || Math.abs(ch) < 0.02 ? null : (ch > 0) === (m.better > 0);
      return h("button", { class: "metric", onclick: () => openMetric(m, r) },
        h("div", null, h("strong", null, m.label), h("span", { class: "muted small" },
          r.avg30 != null ? `30-day avg ${fmtVal(r.avg30, m.unit, m.key)}` : `last on ${fmt(r.latest_day, SHORT)}`,
          ch != null && Math.abs(ch) >= 0.02 ? h("span", { class: "chg " + (good == null ? "" : good ? "good" : "bad") }, ` ${ch > 0 ? "▲" : "▼"} ${Math.abs(ch * 100).toFixed(0)}%${good == null ? "" : good ? " better" : " worse"}`) : null)),
        h("span", { class: "metric-v" }, fmtVal(r.latest, m.unit, m.key)));
    }));
}

function openMetric(m, r) {
  openSheet(m.label, null, (close) => {
    const body = h("div", null, h("p", { class: "hint" }, "Loading…"));
    loadMetricSeries(m.key).then((pts) => {
      const unitShown = m.unit === "min" && /^sleep/.test(m.key) ? "h" : m.unit;
      const p = unitShown === "h" ? pts.map(([d, v]) => [d, v / 60]) : pts;
      body.replaceChildren(
        lineChart({ points: p, unit: unitShown, digits: Math.abs(p.at(-1)?.[1] || 0) >= 100 ? 0 : 1, color: "var(--m-knowledge)", smooth: p.length > 60 ? 7 : 1 }),
        h("div", { class: "tiles" },
          h("div", { class: "tile" }, h("strong", null, fmtVal(r.latest, m.unit, m.key)), h("span", null, `latest · ${fmt(r.latest_day, SHORT)}`)),
          h("div", { class: "tile" }, h("strong", null, fmtVal(r.avg30, m.unit, m.key)), h("span", null, "30-day average")),
          h("div", { class: "tile" }, h("strong", null, fmtVal(r.avg365, m.unit, m.key)), h("span", null, "1-year average")),
          h("div", { class: "tile" }, h("strong", null, r.days.toLocaleString("en")), h("span", null, `days since ${fmt(r.first_day, SHORT)}`))));
    }).catch(() => body.replaceChildren(h("p", { class: "hint" }, "Couldn’t load this measure.")));
    return [body];
  });
}

function profileCard() {
  const g = { ...DEFAULTS.vitality, ...(S.settings.vitality || {}) };
  const setG = (k, v) => { S.settings.vitality = { ...g, [k]: Math.max(0, parseFloat(v) || 0) }; saveSettings(); render(); };
  return h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Body profile & vitals"), ar("الملف الصحي")),
    h("div", { class: "field" }, h("label", { for: "f-birthDate" }, "Birth date (for biological age)"),
      h("input", { id: "f-birthDate", type: "date", value: S.settings.birthDate || "", onchange: (e) => { S.settings.birthDate = e.target.value; saveSettings(); render(); } })),
    h("div", { class: "field" }, h("label", null, "Sex (for the fitness norms)"),
      h("div", { class: "seg" }, ...[["male", "Male"], ["female", "Female"]].map(([k, l]) => chip(l, (S.settings.sex || "male") === k, () => { S.settings.sex = k; saveSettings(); render(); })))),
    ...VITALS.map((x) => h("div", { class: "field" }, h("label", { for: "v-" + x.k }, `Daily ${x.en.toLowerCase()} goal${x.unit ? ` (${x.unit})` : ""}`),
      h("input", { id: "v-" + x.k, type: "number", inputmode: "decimal", min: "0", step: x.k === "sleepH" ? "0.5" : "1", value: String(g[x.k]), onchange: (e) => setG(x.k, e.target.value) }))));
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
    profileCard(),
    trainingCard(),
    checklistEditCard(),
    scheduleCard(f),
    notifyCard(),
    calendarCard(),
    healthCard(),
    h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Account"), ar("الحساب")),
      h("div", { class: "field" }, h("label", null, "Signed in as"), h("strong", null, (SESSION && SESSION.email) || "")),
      h("button", { class: "chip wide", onclick: () => { signOut(); S.tab = "palace"; render(); } }, "Sign out")),
  ];
}

function trainingCard() {
  const DOWN = { SAT: "Sat", SUN: "Sun", MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri" };
  const weekly = S.settings.training || [], once = (S.settings.trainingOnce || []).filter((x) => x.date >= addDays(today(), -1)).sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1));
  const remove = (key, id) => { S.settings[key] = (S.settings[key] || []).filter((x) => x.id !== id); saveSettings(); render(); };
  const bySport = {};
  for (const x of weekly) (bySport[x.sport] ||= []).push(x);
  const perWeek = weekly.reduce((a, x) => a + x.days.length, 0), minWeek = weekly.reduce((a, x) => a + x.days.length * ((hmMin(x.end) - hmMin(x.start) + 1440) % 1440), 0);
  return h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Training schedule"), ar("جدول التدريب")),
    h("p", { class: "hint" }, perWeek ? `${perWeek} sessions, ${fmtMin(minWeek)} a week. The watch checks each one, Apple Calendar shows them, and you get a reminder 30 minutes before.` : "Add your weekly slots. The watch checks each one, and they show up in Apple Calendar."),
    ...Object.entries(bySport).map(([sport, list]) => h("div", { class: "sportgrp" }, h("div", { class: "subhead" }, sportEn(sport), ar((SPORTS[sport] || SPORTS.other).ar, "sm")),
      ...list.map((x) => h("div", { class: "slotrow" }, h("div", null, h("strong", null, `${x.start}–${x.end}`), h("span", { class: "muted" }, ` ${x.days.map((d) => DOWN[d]).join(", ")}${x.label ? " · " + x.label : ""}`)),
        h("button", { class: "x-del", "aria-label": "Remove slot", onclick: () => remove("training", x.id) }, "×"))))),
    once.length ? h("div", { class: "sportgrp" }, h("div", { class: "subhead" }, "One-off sessions"), ...once.map((x) => h("div", { class: "slotrow" },
      h("div", null, h("strong", null, `${slotName(x)} · ${x.start}–${x.end}`), h("span", { class: "muted" }, " " + fmt(x.date, { weekday: "short", day: "numeric", month: "short" }))),
      h("button", { class: "x-del", "aria-label": "Remove session", onclick: () => remove("trainingOnce", x.id) }, "×")))) : null,
    h("button", { class: "btn", onclick: () => openSlotSheet() }, "Add training slot"));
}
function checklistEditCard() {
  const list = S.settings.checklist || [];
  const save = (next) => { S.settings.checklist = next; saveSettings(); render(); };
  const move = (i, d) => { const n = [...list]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); save(n); };
  const add = () => { const el = document.getElementById("cl-new"); const text = el.value.trim(); if (text) save([...list, { id: "c" + Date.now().toString(36), text }]); };
  return h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Daily checklist"), ar("قائمة الإنجاز")),
    h("p", { class: "hint" }, "What a productive day means for you. Each day’s score is the share you tick."),
    ...list.map((x, i) => h("div", { class: "slotrow" }, h("span", null, x.text), h("div", { class: "row tight", style: { margin: 0 } },
      i > 0 ? h("button", { class: "x-del", "aria-label": "Move up", onclick: () => move(i, -1) }, "↑") : null,
      h("button", { class: "x-del", "aria-label": "Remove", onclick: () => save(list.filter((y) => y.id !== x.id)) }, "×")))),
    h("div", { class: "foodadd two" }, h("input", { id: "cl-new", class: "txt", placeholder: "Add a standing item", onkeydown: (e) => { if (e.key === "Enter") add(); } }), h("button", { class: "chip", onclick: add }, "Add")));
}

function scheduleCard(f) {
  return h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "The daily schedule"), ar("جدول اليوم")),
    h("p", { class: "hint" }, "Drives your reminders and the Apple Calendar blocks."),
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
  const pref = (k, label, when) => {
    const sw = h("input", { type: "checkbox", class: "switch", switch: true, role: "switch", id: "n-" + k, "aria-label": label, onchange: (e) => { S.settings.notify = { ...n, [k]: e.target.checked }; saveSettings(); } });
    sw.checked = !!n[k];
    return h("div", { class: "field" }, h("label", { for: "n-" + k }, label, h("small", { class: "when" }, when)), sw);
  };
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

function copyBtn(get) {
  return h("button", { class: "chip", onclick: async (e) => { try { await navigator.clipboard.writeText(get()); e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy"), 1500); } catch { /* select instead */ } } }, "Copy");
}
let healthKey = "";
function healthCard() {
  const ls = S.health?.lastSync;
  const keyMsg = (t) => { const el = document.getElementById("keymsg"); if (el) el.textContent = t; };
  const makeKey = async () => {
    keyMsg("Creating…");
    try { healthKey = await newShortcutKey(); render(); setTimeout(() => keyMsg("Copy it now: it’s shown only once. Creating another key keeps old ones working."), 0); }
    catch (e) { keyMsg("Couldn’t create a key: " + e.message); }
  };
  const code = (t) => h("code", null, t);
  const li = (...k) => h("li", null, ...k);
  const fields = [["date", "Text · the Formatted Date (yyyy-MM-dd)"], ["steps", "Number · Sum of Step Count"], ["activeKcal", "Number · Sum of Active Energy"],
    ["basalKcal", "Number · Sum of Resting Energy"], ["dietaryKcal", "Number · Sum of Dietary Energy (if you log food)"], ["exerciseMin", "Number · Sum of Exercise Minutes"],
    ["standHours", "Number · Sum of Stand Hours"], ["restingHR", "Number · Average of Resting Heart Rate"], ["hrv", "Number · Average of Heart Rate Variability"],
    ["weight", "Number · latest Weight (kg)"], ["sleepSeconds", "Number · Sum of sleep Durations"], ["sleepStart", "Text · first sleep sample’s Start Date (ISO 8601)"],
    ["sleepEnd", "Text · last sleep sample’s End Date (ISO 8601)"], ["exerciseByHour", "Text · hour=minutes pairs, e.g. 19=34,20=41 (step 4b)"], ["activeByHour", "Text · hour=kcal pairs, built the same way"]];
  return h("section", { class: "card" }, h("div", { class: "card-h" }, h("h2", null, "Apple Health"), ar("الصحة")),
    h("p", { class: "hint" }, "Your watch fills in sleep, bedtime, waking for Fajr, steps, calories, the deficit, workouts, weight and whether the watch was worn. You keep logging prayers, reading and purity yourself."),
    h("p", { class: "hint" }, ls ? `Last sync ${new Date(ls.received_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · ${ls.samples.toLocaleString("en")} samples, ${ls.workouts} workouts.` : "No sync received yet."),
    h("div", { class: "row" }, h("div", { class: "lbl" }, "Address"), h("div", { class: "copyrow", style: { width: "100%" } }, h("input", { class: "txt", readonly: true, value: HEALTH_URL }), copyBtn(() => HEALTH_URL))),
    healthKey ? h("div", { class: "row" }, h("div", { class: "lbl" }, "Your key"), h("div", { class: "copyrow", style: { width: "100%" } }, h("input", { class: "txt", readonly: true, value: healthKey }), copyBtn(() => healthKey)))
      : h("button", { class: "btn", onclick: makeKey }, "Create a key"),
    h("p", { class: "hint", id: "keymsg" }),

    h("details", { class: "more" }, h("summary", null, "Option 1 · Apple Shortcuts (free)"),
      h("p", { class: "hint" }, "One shortcut sends today’s totals; an automation runs it every night at 23:59. Building it takes about 15 minutes."),
      h("ol", { class: "steps" },
        li(h("b", null, "Create the shortcut. "), "Shortcuts → + → name it ", code("Mustanir Sync"), "."),
        li(h("b", null, "Today’s date. "), "Add ", h("b", null, "Current Date"), ", then ", h("b", null, "Format Date"), " → Custom → ", code("yyyy-MM-dd"), "."),
        li(h("b", null, "Each total. "), "Add ", h("b", null, "Find Health Samples"), ": Type ", code("Step Count"), ", Start Date ", code("is today"), ", Group By ", code("Day"), ". Then ", h("b", null, "Calculate Statistics"), " → ", code("Sum"),
          ". Repeat for Active Energy, Resting Energy, Exercise Minutes, Stand Hours and (if you log food) Dietary Energy. For Resting Heart Rate and Heart Rate Variability use ", code("Average"), ". For Weight, sort Latest First, limit 1."),
        li(h("b", null, "When you trained (4b). "), "This is how the app checks each training slot. ", h("b", null, "Find Health Samples"), ": Type ", code("Exercise Minutes"), ", Start Date ", code("is today"), ", Group By ", code("Hour"),
          ". Add ", h("b", null, "Repeat with Each"), "; inside it add ", h("b", null, "Text"), ": ", code("[Repeat Item’s Start Date, formatted HH]=[Repeat Item’s Value]"), ". After the repeat, ", h("b", null, "Combine Text"), " with ", code(","),
          ". That’s ", code("exerciseByHour"), ". Do the same with Active Energy for ", code("activeByHour"), " (it replaces the activeKcal total)."),
        li(h("b", null, "Sleep. "), h("b", null, "Find Health Samples"), ": Type ", code("Sleep Analysis"), ", Start Date ", code("is in the last 16 hours"), ", Value ", code("is not In Bed"), " and ", code("is not Awake"), ", sorted Oldest First. Then ",
          h("b", null, "Get Details"), " → Duration → ", h("b", null, "Calculate Statistics"), " → Sum. Take the samples’ first item’s Start Date and last item’s End Date, each through Format Date → ", code("ISO 8601"), "."),
        li(h("b", null, "Send it. "), "Add ", h("b", null, "Get Contents of URL"), " with the address above. Method ", code("POST"), ". Header ", code("Authorization"), " = ", code("Bearer YOUR-KEY"), ". Request Body ", code("JSON"), ", with these fields, each set to the matching result:",
          h("div", { class: "fieldmap" }, ...fields.flatMap(([k, d]) => [code(k), h("span", { class: "muted" }, d)]))),
        li(h("b", null, "Test. "), "Add ", h("b", null, "Show Result"), " and run it. You should see ", code('"ok":true'), " and the fields it filled. If sleep looks 60× too big or small, rename ", code("sleepSeconds"), " to ", code("sleepMinutes"), "."),
        li(h("b", null, "Every night. "), "Shortcuts → Automation → + → ", h("b", null, "Time of Day"), " ", code("23:59"), " Daily → ", h("b", null, "Run Immediately"), " → Mustanir Sync. Optional: a second one at ", code("05:30"), " so last night’s sleep shows in the morning.")),
      h("p", { class: "hint" }, "The last two years: duplicate the shortcut as Mustanir Backfill, wrap everything in ", h("b", null, "Repeat"), " 730 times, use ", h("b", null, "Adjust Date"), " (subtract Repeat Index days) for the day, and swap “is today” for “is between the start and end of that day”. Run it once with the phone charging. History is stored but never scored.")),

    h("details", { class: "more" }, h("summary", null, "Write your meals to Apple Health"),
      h("p", { class: "hint" }, "Food you log in the app goes into Apple Health as Dietary Energy and Protein. Put these steps at the start of Mustanir Sync, so the totals it reads afterwards already include them."),
      h("ol", { class: "steps" },
        li(h("b", null, "Get Contents of URL"), ": ", code(PALACE_URL + "/export"), ", Method ", code("GET"), ", header ", code("Authorization"), " = ", code("Bearer YOUR-KEY"), "."),
        li(h("b", null, "Get Dictionary Value"), " ", code("meals"), " → ", h("b", null, "Repeat with Each"), ". Inside: ", h("b", null, "Get Dictionary Value"), " ", code("kcal"), " and ", code("at"), ", then ", h("b", null, "Log Health Sample"), ": Type ", code("Dietary Energy"), ", Value = kcal, Date = at. Optional: the same for ", code("protein"), " with Type ", code("Protein"), "."),
        li("After the repeat: ", h("b", null, "Get Contents of URL"), " ", code(PALACE_URL + "/export/ack"), ", Method ", code("POST"), ", same header, JSON body ", code("batch"), " = the first response’s ", code("batch"), ". That marks the meals as written so they’re never logged twice.")),
      h("p", { class: "hint" }, "Logging food somewhere else too, like a nutrition app that writes to Apple Health? That’s fine: the app counts Apple Health’s total plus anything not yet written.")),

    h("details", { class: "more" }, h("summary", null, "Walking Pad shortcut (one tap)"),
      h("p", { class: "hint" }, "Tap when you step on, tap when you step off. The minutes land in today’s Body decree. Put it on your Apple Watch, the Action button or ask Siri “Walking pad”."),
      h("ol", { class: "steps" },
        li("New shortcut ", code("Walking Pad"), ". Add ", h("b", null, "Get Contents of URL"), ": ", code(PALACE_URL + "/walkpad"), ", Method ", code("POST"), ", header ", code("Authorization"), " = ", code("Bearer YOUR-KEY"), "."),
        li("Add ", h("b", null, "Get Dictionary Value"), " ", code("message"), " → ", h("b", null, "Show Notification"), ". You’ll see “started” or “32 min logged”."),
        li("Shortcut details: turn on ", h("b", null, "Show on Apple Watch"), ". Optional: assign it to the Action button in Settings."))),

    h("details", { class: "more" }, h("summary", null, "Option 2 · Health Auto Export (no building)"),
      h("p", { class: "hint" }, "A third-party iPhone app that sends Health data on a schedule, including your two-year history in one go. It also sends each workout with its sport and exact times, which makes training matching exact. Its scheduled sending needs the paid upgrade."),
      h("ol", { class: "steps" },
        li("Install ", h("b", null, "Health Auto Export – JSON+CSV"), " and allow Health access."),
        li("Automations → New → ", h("b", null, "REST API"), ". URL: the address above. Header ", code("Authorization"), " = ", code("Bearer YOUR-KEY"), ". Format ", code("JSON"), "."),
        li("Data: Health Metrics + Workouts. Aggregation ", code("Day"), ". Pick sleep, steps, energy, heart rate, HRV, weight, exercise and stand."),
        li("Sync daily (or hourly). For the history, run a manual export of the last 2 years to the same automation."))));
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
let lastTab = null;
const tabChanged = () => { const c = lastTab !== S.tab; lastTab = S.tab; return c; };
function go(tab) { S.tab = tab; history.replaceState(null, "", "#" + tab); render(); scrollTo(0, 0); }
function render() {
  header();
  const signin = S.mode === "signin" && !SESSION;
  document.body.classList.toggle("signed-out", signin);
  const views = { palace: renderPalace, decrees: renderDecrees, records: renderRecords, council: renderCouncil, diwan: renderDiwan };
  const view = h("div", { class: tabChanged() ? "view" : "" }, ...(signin ? renderSignIn() : [largeTitle(S.tab), ...(views[S.tab] || renderPalace)()]));
  main.replaceChildren(view);
}
setRenderer(render);
document.querySelectorAll(".nav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
// Native feel: the top bar turns to glass once content passes under it; no pinch or double-tap zoom.
const topEl = document.getElementById("top");
addEventListener("scroll", () => topEl.classList.toggle("scrolled", scrollY > 24), { passive: true });
["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

const fromHash = () => { const t = location.hash.slice(1); if (["palace", "decrees", "records", "council", "diwan"].includes(t)) S.tab = t; };
fromHash(); addEventListener("hashchange", () => { fromHash(); render(); });
syncBed(); render(); load();
addEventListener("online", () => { flushOutbox().then(load); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && !S.dirty.size) load(); });
if ("serviceWorker" in navigator) addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
export { burst };
