// Diwan: settings. Appearance, targets, body profile, training, checklist, schedule, notifications, calendar, WHOOP, FatSecret, account.
import { useEffect, useState } from "react";
import { S, DEFAULTS, vitalsFor, usesWhoop, SPORTS, today, addDays, fmt, syncBed, hmMin, slotName } from "@/lib/logic.js";
import { SESSION, PALACE_URL, loadWhoop, whoopConnect, whoopSync, loadFatsecret, fatsecretConnect, fatsecretSync, saveSettings, signOut, newCalendarLink, newShortcutKey, pushSupported, pushState, enablePush, disablePush, testPush } from "@/lib/store.js";
import { bump, themePref, setTheme } from "@/lib/app-state.js";
import { widgetScript } from "@/lib/widget.js";
import { openSheet } from "@/components/sheets.jsx";
import { Section, Hint, Subhead, Row, Ar, LargeTitle, fmtMin, Icon } from "@/components/kit";
import { Connected, IconButton, Shape } from "@/components/m3/index.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const hmOf = (s) => { const m = String(s || "").match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : 0; };
const toHM = (m) => { const x = ((m % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"); };

function setSetting(k, v) {
  S.settings[k] = v;
  if (k === "wake" || k === "windowHours") syncBed();
  if (k === "termStart") S.period = null;
  saveSettings(); bump();
}

// One settings field: a label and an input that saves on change.
function Field({ label, k, type = "text", hint, ...attrs }) {
  const v = S.settings[k] ?? "";
  return (
    <div className="py-1.5">
      <div className="flex min-h-12 items-center gap-3">
        <Label htmlFor={"f-" + k} className="min-w-0 flex-1 type-body-l text-on-surface">{label}</Label>
        <Input id={"f-" + k} key={k + String(v)} type={type} defaultValue={String(v)} inputMode={type === "number" ? "decimal" : undefined} {...attrs}
          className={cn("h-10 shrink-0 rounded-xl border-0 bg-surface-container-highest px-3 text-right type-title-m tnum focus-visible:shadow-[inset_0_0_0_2px_var(--md-sys-color-primary)]", type === "text" ? "w-44" : type === "date" || type === "time" ? "w-36" : "w-28")}
        onBlur={(e) => { let x = e.target.value; if (type === "number") x = Math.max(0, parseFloat(x) || 0); if (String(x) !== String(v)) setSetting(k, x); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      </div>
      {hint && <Hint className="mt-1">{hint}</Hint>}
    </div>
  );
}

export default function Diwan() {
  return (
    <>
      <LargeTitle title="Settings" ar="الديوان" caption="The diwan: targets, schedule, connections" />
      <Appearance />
      <Section title="Targets" ar="الأهداف" desc="The body plan sets the deficit, protein, sessions and steps when each term begins.">
        <Field label="First term starts" k="termStart" type="date" />
        <Field label="Training sessions per week" k="sessionsPerWeek" type="number" min="1" max="14" />
        <Field label="Minimum calorie deficit (kcal)" k="deficitMin" type="number" min="0" step="50" />
        <Field label="Protein a day (g)" k="proteinTarget" type="number" min="0" step="5" />
        <Field label="Daily reading minimum (pages)" k="pagesPerDay" type="number" min="1" />
        <Field label="Sleep target (hours)" k="sleepTarget" type="number" min="1" max="12" step="0.5" />
        <Field label="Wake for Fajr" k="wake" type="time" />
        <Field label="Sleep window (hours)" k="windowHours" type="number" min="6" max="10" step="0.5" hint={`Bedtime, set by the window: ${S.settings.bedtime}.`} />
        <Field label="Impeachment line (%)" k="threshold" type="number" min="0" max="100" />
        <Field label="Current book" k="book" placeholder="Book title" />
      </Section>
      <Profile />
      <Training />
      <ChecklistEdit />
      <Section title="The daily schedule" ar="جدول اليوم" desc="Drives your reminders and the Apple Calendar blocks.">
        <Field label="Reading block starts" k="readingTime" type="time" />
        <Field label="Reading length (minutes)" k="readingMin" type="number" min="10" step="5" />
        <Field label="Wind-down before bed (minutes)" k="windDownMin" type="number" min="0" step="15" />
        <Field label="Evening check-in reminder" k="checkinTime" type="time" />
        <Hint className="mt-2">Tonight: wind-down {toHM(hmOf(S.settings.bedtime) - Number(S.settings.windDownMin || 0))}, lights out {S.settings.bedtime}, up for Fajr {S.settings.wake}.</Hint>
      </Section>
      <Notifications />
      <Calendar />
      <Widget />
      <Whoop />
      <FatSecret />
      <Section title="Account" ar="الحساب">
        <Row label="Signed in as"><span className="type-title-s">{SESSION?.email || ""}</span></Row>
        <Button variant="outline" className="mt-3 w-full" onClick={() => { signOut(); S.tab = "palace"; bump(); }}><Icon name="logout" size={20} />Sign out</Button>
      </Section>
      <div className="flex flex-col items-center gap-2 py-4"><Shape name="verySunny" size={28} color="var(--md-sys-color-tertiary)" /><Hint className="text-center">Al-Mustanir · Ahmed 2.0</Hint></div>
    </>
  );
}

function Appearance() {
  const p = themePref();
  return (
    <Section title="Appearance" ar="المظهر">
      <Connected value={p} onChange={setTheme} label="Appearance" options={[{ value: "system", label: "System", icon: "brightness_auto" }, { value: "light", label: "Light", icon: "light_mode" }, { value: "dark", label: "Dark", icon: "dark_mode" }]} />
    </Section>
  );
}

function Profile() {
  const g = { ...DEFAULTS.vitality, ...(S.settings.vitality || {}) };
  const setG = (k, v) => { S.settings.vitality = { ...g, [k]: Math.max(0, parseFloat(v) || 0) }; saveSettings(); bump(); };
  return (
    <Section title="Daily vitals" ar="الحيوية" desc="WHOOP fills these in; each one met is worth XP.">
      <div className="flex flex-col">
        {vitalsFor(today()).map((x) => (
          <div key={x.k} className="flex min-h-12 items-center gap-3 py-1.5">
            <Label htmlFor={"v-" + x.k} className="min-w-0 flex-1 type-body-l text-on-surface">{x.en}{x.unit ? <span className="text-on-surface-variant"> ({x.unit})</span> : ""}</Label>
            <Input id={"v-" + x.k} key={x.k + g[x.k]} type="number" inputMode="decimal" min="0" step={x.k === "sleepH" ? "0.5" : "1"} defaultValue={String(g[x.k])}
              className="h-10 w-28 shrink-0 rounded-xl border-0 bg-surface-container-highest px-3 text-right type-title-m tnum focus-visible:shadow-[inset_0_0_0_2px_var(--md-sys-color-primary)]"
              onBlur={(e) => { if (+e.target.value !== g[x.k]) setG(x.k, e.target.value); }} />
          </div>
        ))}
      </div>
      <Hint className="mt-3">On an away day (travel, illness, summer interruptions) the floor goals apply instead, so the streak survives.</Hint>
    </Section>
  );
}

const WEEK = [["SAT", "Saturday"], ["SUN", "Sunday"], ["MON", "Monday"], ["TUE", "Tuesday"], ["WED", "Wednesday"], ["THU", "Thursday"], ["FRI", "Friday"]];
// The week, day by day: every session that day (two tennis sessions on Saturday are two rows), each removable, and a "+"
// that opens the sheet with that day already picked.
function Training() {
  const weekly = S.settings.training || [];
  const once = (S.settings.trainingOnce || []).filter((x) => x.date >= addDays(today(), -1)).sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1));
  const remove = (key, id) => { S.settings[key] = (S.settings[key] || []).filter((x) => x.id !== id); saveSettings(); bump(); };
  // A slot on several days: removing it from one day keeps it on the others.
  const removeDay = (x, day) => {
    if ((x.days || []).length <= 1) return remove("training", x.id);
    S.settings.training = weekly.map((y) => (y.id === x.id ? { ...y, days: y.days.filter((d) => d !== day) } : y)); saveSettings(); bump();
  };
  const len = (x) => (hmMin(x.end) - hmMin(x.start) + 1440) % 1440;
  const perWeek = weekly.reduce((a, x) => a + x.days.length, 0), minWeek = weekly.reduce((a, x) => a + x.days.length * len(x), 0);
  return (
    <Section title="Training schedule" ar="جدول التدريب" desc={perWeek ? `${perWeek} sessions, ${fmtMin(minWeek)} a week. WHOOP checks each one.` : "Add your weekly sessions. WHOOP checks each one, and they show up in Apple Calendar."}>
      <div className="flex flex-col">
        {WEEK.map(([d, name]) => {
          const list = weekly.filter((x) => (x.days || []).includes(d)).sort((a, b) => hmMin(a.start) - hmMin(b.start));
          return (
            <div key={d} className="py-2">
              <div className="flex items-center gap-3">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full type-label-l em", list.length ? "bg-primary-container text-on-primary-container" : "bg-surface-container-highest text-on-surface-variant")}>{name.slice(0, 2)}</span>
                <span className={cn("min-w-0 flex-1 type-title-m", !list.length && "font-normal text-on-surface-variant")}>
                  {name}{!list.length && <span className="type-body-m"> · rest</span>}{list.length > 1 && <span className="type-body-m text-on-surface-variant"> · {list.length} sessions</span>}
                </span>
                <IconButton icon="add" variant="tonal" size="xs" label={`Add a session on ${name}`} onClick={() => openSheet({ type: "slot", day: d })} />
              </div>
              {list.length > 0 && (
                <div className="mt-2 ml-[52px] flex flex-col gap-1.5">
                  {list.map((x) => (
                    <div key={x.id} className="flex items-center gap-2 rounded-2xl bg-surface-container-high py-1 pr-1 pl-3">
                      <span className="min-w-0 flex-1 truncate type-body-m"><b className="font-bold">{slotName(x)}</b> <span className="text-on-surface-variant tnum">{x.start}–{x.end} · {fmtMin(len(x))}</span></span>
                      <IconButton icon="close" size="xs" label={`Remove ${slotName(x)} ${x.start} on ${name}`} onClick={() => removeDay(x, d)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {once.length > 0 && (
        <div className="mt-2">
          <Subhead className="mt-2">One-off sessions</Subhead>
          {once.map((x) => (
            <div key={x.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1"><div className="type-title-s tnum">{slotName(x)} · {x.start}–{x.end}</div><div className="type-body-s text-on-surface-variant">{fmt(x.date, { weekday: "short", day: "numeric", month: "short" })}</div></div>
              <IconButton icon="close" size="xs" label="Remove" onClick={() => remove("trainingOnce", x.id)} />
            </div>
          ))}
        </div>
      )}
      <Button className="mt-3 w-full" size="lg" onClick={() => openSheet({ type: "slot" })}><Icon name="add" size={24} />Add training</Button>
    </Section>
  );
}

function ChecklistEdit() {
  const list = S.settings.checklist || [];
  const [txt, setTxt] = useState("");
  const save = (next) => { S.settings.checklist = next; saveSettings(); bump(); };
  const move = (i, d) => { const n = [...list]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); save(n); };
  const add = () => { const text = txt.trim(); if (text) { save([...list, { id: "c" + Date.now().toString(36), text }]); setTxt(""); } };
  return (
    <Section title="Daily checklist" ar="قائمة الإنجاز" desc="What a productive day means for you. Each day’s score is the share you tick.">
      {list.map((x, i) => (
        <div key={x.id} className="flex min-h-12 items-center gap-1">
          <Icon name="task_alt" size={20} className="mr-2 text-tertiary" />
          <span className="min-w-0 flex-1 type-body-l">{x.text}</span>
          {i > 0 && <IconButton icon="arrow_upward" size="xs" label="Move up" onClick={() => move(i, -1)} />}
          <IconButton icon="close" size="xs" label="Remove" onClick={() => save(list.filter((y) => y.id !== x.id))} />
        </div>
      ))}
      <div className="mt-3 flex gap-2">
        <Input placeholder="Add a standing item" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <Button variant="secondary" onClick={add}>Add</Button>
      </div>
    </Section>
  );
}

let pushStatus = null;
function Notifications() {
  const [st, setSt] = useState(pushStatus || "…"), [msg, setMsg] = useState("");
  useEffect(() => { pushState().then((s) => { pushStatus = s; setSt(s); }).catch(() => {}); }, []);
  const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  const n = S.settings.notify || {};
  const wake = hmOf(S.settings.wake), bed = hmOf(S.settings.bedtime);
  const prefs = [
    ["morning", "Morning check-in", toHM(wake + 20)],
    ["reading", "Reading block", S.settings.readingTime],
    ["training", "Training, 30 minutes before", "on training days"],
    ["evening", "Evening check-in, only if something’s open", S.settings.checkinTime],
    ["windDown", "Wind-down", toHM(bed - Number(S.settings.windDownMin || 0))],
    ["advisor", "The advisor’s weekly report", "Fridays"],
  ];
  if (!pushSupported() || (!standalone && /iPhone|iPad/.test(navigator.userAgent))) return (
    <Section title="Notifications" ar="التنبيهات"><Hint>On iPhone, notifications work once Al-Mustanir is on your home screen: Safari → Share → Add to Home Screen, then open it from the icon and come back here.</Hint></Section>
  );
  return (
    <Section title="Notifications" ar="التنبيهات">
      {st === "denied" ? <Hint>Notifications are blocked. Allow them in iOS Settings → Notifications → Mustanir.</Hint>
        : st === "on" ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={async () => { setMsg("Sending…"); try { const d = await testPush(); setMsg(`Sent to ${d} device${d > 1 ? "s" : ""}.`); } catch (e) { setMsg(e.message); } }}>Send a test</Button>
            <Button variant="outline" size="sm" onClick={async () => { await disablePush(); pushStatus = "off"; setSt("off"); }}>Turn off on this device</Button>
          </div>
        ) : <Button className="w-full" onClick={async () => { setMsg("Asking…"); try { await enablePush(); pushStatus = "on"; setSt("on"); setMsg(""); } catch (e) { setMsg(e.message); } }}>Turn on notifications</Button>}
      {msg && <Hint className="mt-2">{msg}</Hint>}
      <div className="mt-3">
        {prefs.map(([k, label, when]) => (
          <Row key={k} label={<label htmlFor={"n-" + k}>{label}</label>} sub={when}>
            <Switch id={"n-" + k} checked={!!n[k]} onCheckedChange={(c) => { S.settings.notify = { ...n, [k]: c }; saveSettings(); bump(); }} />
          </Row>
        ))}
      </div>
    </Section>
  );
}

function CopyField({ value, label }) {
  const [done, setDone] = useState(false);
  return (
    <div className="grid gap-1.5">
      {label && <Label className="text-[13px] font-normal text-muted-foreground">{label}</Label>}
      <div className="flex gap-2">
        <Input readOnly value={value} onFocus={(e) => e.target.select()} className="font-mono text-[13px]" />
        <Button variant="secondary" size="icon" aria-label="Copy" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* the field is selectable */ } }}>{done ? <Icon name="check" size={20} /> : <Icon name="content_copy" size={20} />}</Button>
      </div>
    </div>
  );
}

function Calendar() {
  const [link, setLink] = useState(""), [msg, setMsg] = useState("");
  const make = async () => {
    setMsg("Creating…");
    try { setLink(await newCalendarLink()); setMsg("Tap “Add to Apple Calendar”, then Subscribe. Any older link stops working."); }
    catch (e) { setMsg("Couldn’t create the link: " + e.message); }
  };
  return (
    <Section title="Apple Calendar" ar="التقويم" desc="Training slots, reading, wind-down, sleep and council days, kept in sync with any change here.">
      {link ? (
        <div className="flex flex-col gap-3">
          <Button asChild className="w-full"><a href={link}>Add to Apple Calendar</a></Button>
          <CopyField value={link} />
        </div>
      ) : <Button className="w-full" onClick={make}>Create calendar link</Button>}
      {msg && <Hint className="mt-2">{msg}</Hint>}
    </Section>
  );
}

// The widget: iOS gives web apps none, so the free Scriptable app draws one from the game function's data.
function Widget() {
  const [script, setScript] = useState(""), [msg, setMsg] = useState(""), [copied, setCopied] = useState(false);
  const make = async () => {
    setMsg("Creating…");
    try {
      const s = widgetScript(await newShortcutKey("Widget"));
      setScript(s); setMsg("");
      try { await navigator.clipboard.writeText(s); setCopied(true); } catch { /* the button below copies it */ }
    } catch (e) { setMsg("Couldn’t create the widget key: " + e.message); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(script); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setMsg("Copy didn’t work here. Try again from the home-screen app."); } };
  return (
    <Section title="Home-screen widget" ar="الأداة" desc="Your level, today’s XP, streak and what’s still open, on the home screen or the lock screen. Refreshes about every 15 minutes.">
      {script ? (
        <div className="flex flex-col gap-3">
          <Button className="w-full" onClick={copy}>{copied ? <><Icon name="check" size={20} />Script copied</> : <><Icon name="content_copy" size={20} />Copy the widget script</>}</Button>
          <ol className="ml-5 list-decimal space-y-1.5 text-[14px] leading-relaxed">
            <li>Install <a className="underline" href="https://apps.apple.com/app/scriptable/id1405459188">Scriptable</a> (free).</li>
            <li>In Scriptable, tap <b>+</b>, paste, and name the script <b>Mustanir</b>.</li>
            <li>Long-press the home screen → <b>Edit</b> → <b>Add Widget</b> → Scriptable. Tap the new widget and choose <b>Mustanir</b>. On the lock screen, pick the rectangular size.</li>
          </ol>
          <Hint>The script holds a private key that can only read your game. Making a new one doesn’t turn this one off.</Hint>
        </div>
      ) : <Button className="w-full" onClick={make}>Create the widget</Button>}
      {msg && <Hint className="mt-2">{msg}</Hint>}
    </Section>
  );
}

const C = ({ children }) => <code className="rounded bg-surface-container-highest px-1 py-0.5 font-mono text-[12.5px]">{children}</code>;
function Guide({ title, children }) {
  return (
    <details className="group border-t py-1 first-of-type:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between py-2.5 type-title-m">{title}<Icon name="add" size={20} className="text-on-surface-variant transition-transform group-open:rotate-45" /></summary>
      <div className="flex flex-col gap-2 pb-3 text-[14px] leading-relaxed [&_li]:pl-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2">{children}</div>
    </details>
  );
}

let whoopLoading = false;
function Whoop() {
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const w = S.whoop;
  useEffect(() => {
    if (!w && !whoopLoading && SESSION) { whoopLoading = true; loadWhoop().finally(() => { whoopLoading = false; bump(); }); }
  }, [w]);
  const run = async (fn, ok) => { setBusy(true); setMsg(""); try { const r = await fn(); setMsg(ok(r)); } catch (e) { setMsg(e.message); } finally { setBusy(false); bump(); } };
  const on = !!w?.connected_at;
  const when = (t) => new Date(t).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <Section title="WHOOP" ar="ووب" desc="Sleep, recovery, HRV, resting heart rate, strain, steps, energy burned and every workout with its heart-rate zones. Prayers, reading and purity stay yours to log.">
      {on ? (
        <>
          <Hint className="mb-2">Connected {when(w.connected_at)}{w.last_sync_at ? ` · last update ${when(w.last_sync_at)}` : ""}. Everything syncs on its own every 10 minutes; new sleeps and workouts usually arrive sooner.</Hint>
          {w.last_error && <Hint className="mb-2 text-warn">Last problem: {w.last_error}</Hint>}
          <Button className="w-full" disabled={busy} onClick={() => run(() => whoopSync(30), (r) => `Updated ${r.days} days from ${r.records} WHOOP records.`)}>Sync now</Button>
        </>
      ) : (
        <>
          {w?.last_error && <Hint className="mb-2 text-warn">{w.last_error}</Hint>}
          <Button className="w-full" disabled={busy} onClick={() => run(whoopConnect, () => "Opening WHOOP…")}>Connect WHOOP</Button>
          <Hint className="mt-2">You’ll sign in on WHOOP’s page and come back here. Connecting imports your last 30 days.</Hint>
        </>
      )}
      {msg && <Hint className="mt-2">{msg}</Hint>}
    </Section>
  );
}

let fsLoading = false;
function FatSecret() {
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const f = S.fatsecret;
  useEffect(() => {
    if (!f && !fsLoading && SESSION) { fsLoading = true; loadFatsecret().finally(() => { fsLoading = false; bump(); }); }
  }, [f]);
  const run = async (fn, ok) => { setBusy(true); setMsg(""); try { const r = await fn(); setMsg(ok(r)); } catch (e) { setMsg(e.message); } finally { setBusy(false); bump(); } };
  const on = !!f?.connected_at;
  const when = (t) => new Date(t).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <Section title="FatSecret" ar="الطعام" desc="Log meals in the FatSecret app (photo, barcode or search). They arrive here every 10 minutes and count against what WHOOP says you burned.">
      {on ? (
        <>
          <Hint className="mb-2">Connected {when(f.connected_at)}{f.last_sync_at ? ` · last update ${when(f.last_sync_at)}` : ""}. Meals sync on its own every 10 minutes; edits and deletions carry over.</Hint>
          {f.last_error && <Hint className="mb-2 text-warn">Last problem: {f.last_error}</Hint>}
          <Button className="w-full" disabled={busy} onClick={() => run(() => fatsecretSync(7), (r) => `Updated ${r.days} days · ${r.meals} meals.`)}>Sync now</Button>
        </>
      ) : (
        <>
          {f?.last_error && <Hint className="mb-2 text-warn">{f.last_error}</Hint>}
          <Button className="w-full" disabled={busy} onClick={() => run(fatsecretConnect, () => "Opening FatSecret…")}>Connect FatSecret</Button>
          <Hint className="mt-2">You’ll sign in with your FatSecret account and come back here. Your last 14 days come in.</Hint>
        </>
      )}
      {msg && <Hint className="mt-2">{msg}</Hint>}
    </Section>
  );
}
