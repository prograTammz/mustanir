// Diwan: settings. Appearance, targets, body profile, training, checklist, schedule, notifications, calendar, Apple Health, account.
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, X, ArrowUp, Copy, Check, Plus } from "lucide-react";
import { S, DEFAULTS, VITALS, SPORTS, today, addDays, fmt, syncBed, hmMin, slotName } from "@/lib/logic.js";
import { SESSION, HEALTH_URL, PALACE_URL, saveSettings, signOut, newShortcutKey, newCalendarLink, pushSupported, pushState, enablePush, disablePush, testPush } from "@/lib/store.js";
import { bump, themePref, setTheme } from "@/lib/app-state.js";
import { openSheet } from "@/components/sheets.jsx";
import { Section, Hint, Subhead, Row, Ar, fmtMin } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
    <div className="grid gap-1.5 border-t py-3 first:border-t-0">
      <Label htmlFor={"f-" + k} className="text-[14px] font-normal">{label}</Label>
      <Input id={"f-" + k} key={k + String(v)} type={type} defaultValue={String(v)} inputMode={type === "number" ? "decimal" : undefined} {...attrs}
        onBlur={(e) => { let x = e.target.value; if (type === "number") x = Math.max(0, parseFloat(x) || 0); if (String(x) !== String(v)) setSetting(k, x); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

export default function Diwan() {
  return (
    <>
      <Appearance />
      <Section title="Targets" ar="الأهداف" desc="The body plan sets the deficit, protein, sessions and steps when each term begins.">
        <Field label="First term starts" k="termStart" type="date" />
        <Field label="Strength sessions per week" k="sessionsPerWeek" type="number" min="1" max="14" />
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
        <Field label="Evening decrees reminder" k="checkinTime" type="time" />
        <Hint className="mt-2">Tonight: wind-down {toHM(hmOf(S.settings.bedtime) - Number(S.settings.windDownMin || 0))}, lights out {S.settings.bedtime}, up for Fajr {S.settings.wake}.</Hint>
      </Section>
      <Notifications />
      <Calendar />
      <AppleHealth />
      <Section title="Account" ar="الحساب">
        <Row label="Signed in as"><span className="text-[15px] font-medium">{SESSION?.email || ""}</span></Row>
        <Button variant="outline" className="mt-3 w-full" onClick={() => { signOut(); S.tab = "palace"; bump(); }}>Sign out</Button>
      </Section>
      <Hint className="text-center">Al-Mustanir · Ahmed 2.0</Hint>
    </>
  );
}

function Appearance() {
  const p = themePref();
  return (
    <Section title="Appearance" ar="المظهر">
      <ToggleGroup type="single" value={p} onValueChange={(v) => v && setTheme(v)}>
        <ToggleGroupItem value="system"><Monitor className="size-4" />System</ToggleGroupItem>
        <ToggleGroupItem value="light"><Sun className="size-4" />Light</ToggleGroupItem>
        <ToggleGroupItem value="dark"><Moon className="size-4" />Dark</ToggleGroupItem>
      </ToggleGroup>
    </Section>
  );
}

function Profile() {
  const g = { ...DEFAULTS.vitality, ...(S.settings.vitality || {}) };
  const setG = (k, v) => { S.settings.vitality = { ...g, [k]: Math.max(0, parseFloat(v) || 0) }; saveSettings(); bump(); };
  return (
    <Section title="Body profile & vitals" ar="الملف الصحي">
      <Field label="Birth date (for biological age)" k="birthDate" type="date" />
      <div className="grid gap-1.5 border-t py-3">
        <Label className="text-[14px] font-normal">Sex (for the fitness norms)</Label>
        <ToggleGroup type="single" value={S.settings.sex || "male"} onValueChange={(v) => v && setSetting("sex", v)}>
          <ToggleGroupItem value="male">Male</ToggleGroupItem><ToggleGroupItem value="female">Female</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Subhead>Daily vitals</Subhead>
      <div className="grid grid-cols-2 gap-3">
        {VITALS.map((x) => (
          <div key={x.k} className="grid gap-1.5">
            <Label htmlFor={"v-" + x.k} className="text-[13px] font-normal text-muted-foreground">{x.en}{x.unit ? ` (${x.unit})` : ""}</Label>
            <Input id={"v-" + x.k} key={x.k + g[x.k]} type="number" inputMode="decimal" min="0" step={x.k === "sleepH" ? "0.5" : "1"} defaultValue={String(g[x.k])}
              onBlur={(e) => { if (+e.target.value !== g[x.k]) setG(x.k, e.target.value); }} />
          </div>
        ))}
      </div>
      <Hint className="mt-3">On an away day (travel, illness, summer interruptions) the floor goals apply instead, so the streak survives.</Hint>
    </Section>
  );
}

const DOWN = { SAT: "Sat", SUN: "Sun", MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri" };
function Training() {
  const weekly = S.settings.training || [];
  const once = (S.settings.trainingOnce || []).filter((x) => x.date >= addDays(today(), -1)).sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1));
  const remove = (key, id) => { S.settings[key] = (S.settings[key] || []).filter((x) => x.id !== id); saveSettings(); bump(); };
  const bySport = {};
  for (const x of weekly) (bySport[x.sport] ||= []).push(x);
  const perWeek = weekly.reduce((a, x) => a + x.days.length, 0), minWeek = weekly.reduce((a, x) => a + x.days.length * ((hmMin(x.end) - hmMin(x.start) + 1440) % 1440), 0);
  const SlotRow = ({ title, sub, onRemove }) => (
    <div className="flex items-center gap-3 border-t py-2.5 first:border-t-0">
      <div className="min-w-0 flex-1"><div className="text-[15px] font-medium tnum">{title}</div><div className="text-xs text-muted-foreground">{sub}</div></div>
      <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={onRemove}><X /></Button>
    </div>
  );
  return (
    <Section title="Training schedule" ar="جدول التدريب" desc={perWeek ? `${perWeek} sessions, ${fmtMin(minWeek)} a week. The watch checks each one.` : "Add your weekly slots. The watch checks each one, and they show up in Apple Calendar."}>
      {Object.entries(bySport).map(([sport, list]) => (
        <div key={sport} className="mb-2">
          <Subhead className="mt-2 flex items-center justify-between">{(SPORTS[sport] || SPORTS.other).en}<Ar className="text-base normal-case">{(SPORTS[sport] || SPORTS.other).ar}</Ar></Subhead>
          {list.map((x) => <SlotRow key={x.id} title={`${x.start}–${x.end}`} sub={x.days.map((d) => DOWN[d]).join(", ") + (x.label ? " · " + x.label : "")} onRemove={() => remove("training", x.id)} />)}
        </div>
      ))}
      {once.length > 0 && (
        <div className="mb-2">
          <Subhead className="mt-2">One-off sessions</Subhead>
          {once.map((x) => <SlotRow key={x.id} title={`${slotName(x)} · ${x.start}–${x.end}`} sub={fmt(x.date, { weekday: "short", day: "numeric", month: "short" })} onRemove={() => remove("trainingOnce", x.id)} />)}
        </div>
      )}
      <Button className="mt-2 w-full" onClick={() => openSheet({ type: "slot" })}><Plus />Add training slot</Button>
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
        <div key={x.id} className="flex items-center gap-1 border-t py-2 first:border-t-0">
          <span className="min-w-0 flex-1 text-[15px]">{x.text}</span>
          {i > 0 && <Button variant="ghost" size="icon-sm" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp /></Button>}
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => save(list.filter((y) => y.id !== x.id))}><X /></Button>
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
    ["morning", "Morning decrees", toHM(wake + 20)],
    ["reading", "Reading block", S.settings.readingTime],
    ["training", "Training, 30 minutes before", "on training days"],
    ["evening", "Evening decrees, only if something’s open", S.settings.checkinTime],
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
        <Button variant="secondary" size="icon" aria-label="Copy" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* the field is selectable */ } }}>{done ? <Check /> : <Copy />}</Button>
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

const C = ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12.5px]">{children}</code>;
function Guide({ title, children }) {
  return (
    <details className="group border-t py-1 first-of-type:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between py-2.5 text-[15px] font-medium">{title}<Plus className="size-4 text-muted-foreground transition-transform group-open:rotate-45" /></summary>
      <div className="flex flex-col gap-2 pb-3 text-[14px] leading-relaxed [&_li]:pl-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2">{children}</div>
    </details>
  );
}

let healthKey = "";
function AppleHealth() {
  const [key, setKey] = useState(healthKey), [msg, setMsg] = useState("");
  const ls = S.health?.lastSync;
  const makeKey = async () => {
    setMsg("Creating…");
    try { healthKey = await newShortcutKey(); setKey(healthKey); setMsg("Copy it now: it’s shown only once. Creating another key keeps old ones working."); }
    catch (e) { setMsg("Couldn’t create a key: " + e.message); }
  };
  return (
    <Section title="Apple Health" ar="الصحة" desc="Your watch fills in sleep, waking for Fajr, steps, energy, workouts, weight and 120+ more measures. Prayers, reading and purity stay yours to log.">
      <Hint className="mb-3">{ls ? `Last sync ${new Date(ls.received_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · ${Number(ls.samples || 0).toLocaleString("en")} samples, ${ls.workouts || 0} workouts.` : "No sync received yet."}</Hint>
      <div className="flex flex-col gap-3">
        <CopyField label="Address" value={HEALTH_URL} />
        {key ? <CopyField label="Your key" value={key} /> : <Button className="w-full" onClick={makeKey}>Create a key</Button>}
        {msg && <Hint>{msg}</Hint>}
      </div>
      <div className="mt-4">
        <Guide title="Health Auto Export (recommended)">
          <p className="text-muted-foreground">A third-party iPhone app that sends every Health measure, sleep stages and each workout with its sport and exact times. Scheduled sending needs its paid upgrade.</p>
          <ol>
            <li>Install <b>Health Auto Export – JSON+CSV</b> and allow access to all Health categories.</li>
            <li>Automations → New → <b>REST API</b>. URL: the address above. Header <C>Authorization</C> = <C>Bearer YOUR-KEY</C>. Format <C>JSON</C>, batch requests on.</li>
            <li>Data type <b>Health Metrics</b>: select all. Turn <b>Summarize data</b> on, time grouping <C>Day</C>. Sleep arrives as stages per night.</li>
            <li>A second automation with data type <b>Workouts</b> (same URL and key) so training slots are matched exactly.</li>
            <li>Sync cadence: <C>every hour</C>, date range <C>Today</C> (or since last sync). It keeps today fresh; last night’s sleep shows by morning.</li>
            <li>For your history, run a manual export of the last years to the same automation once, with the phone charging.</li>
          </ol>
        </Guide>
        <Guide title="Apple Shortcuts (free)">
          <p className="text-muted-foreground">One shortcut sends today’s totals; an automation runs it every night at 23:59.</p>
          <ol>
            <li>Shortcuts → + → name it <C>Mustanir Sync</C>. Add <b>Current Date</b> → <b>Format Date</b> → Custom <C>yyyy-MM-dd</C>.</li>
            <li>For each total: <b>Find Health Samples</b> (type, start date <C>is today</C>, group by <C>Day</C>) → <b>Calculate Statistics</b> <C>Sum</C>. Steps, Active Energy, Resting Energy, Exercise Minutes, Stand Hours, Dietary Energy. Use <C>Average</C> for Resting Heart Rate and HRV; Weight sorted latest first, limit 1.</li>
            <li>Sleep: <b>Find Health Samples</b> Sleep Analysis in the last 16 hours, not In Bed and not Awake, oldest first → sum of Durations as <C>sleepSeconds</C>, first start as <C>sleepStart</C>, last end as <C>sleepEnd</C> (ISO 8601).</li>
            <li><b>Get Contents of URL</b>: the address above, <C>POST</C>, header <C>Authorization</C> = <C>Bearer YOUR-KEY</C>, JSON body with <C>date</C>, <C>steps</C>, <C>activeKcal</C>, <C>basalKcal</C>, <C>dietaryKcal</C>, <C>exerciseMin</C>, <C>standHours</C>, <C>restingHR</C>, <C>hrv</C>, <C>weight</C> and the sleep fields.</li>
            <li>Automation → Time of Day <C>23:59</C> daily → Run Immediately → Mustanir Sync.</li>
          </ol>
        </Guide>
        <Guide title="Write your meals to Apple Health">
          <ol>
            <li><b>Get Contents of URL</b> <C>{PALACE_URL + "/export"}</C>, <C>GET</C>, same Authorization header.</li>
            <li><b>Get Dictionary Value</b> <C>meals</C> → <b>Repeat with Each</b> → <b>Log Health Sample</b> Dietary Energy (value <C>kcal</C>, date <C>at</C>); optionally Protein.</li>
            <li>Then <C>POST</C> to <C>{PALACE_URL + "/export/ack"}</C> with JSON <C>batch</C> = the first response’s <C>batch</C>, so meals are never logged twice.</li>
          </ol>
        </Guide>
        <Guide title="Walking Pad shortcut (one tap)">
          <ol>
            <li>New shortcut <C>Walking Pad</C>: <b>Get Contents of URL</b> <C>{PALACE_URL + "/walkpad"}</C>, <C>POST</C>, same header.</li>
            <li><b>Get Dictionary Value</b> <C>message</C> → <b>Show Notification</b>: “started” or “32 min logged”.</li>
            <li>Turn on <b>Show on Apple Watch</b>; optionally assign it to the Action button.</li>
          </ol>
        </Guide>
      </div>
    </Section>
  );
}
