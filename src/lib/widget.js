// The home-screen and lock-screen widget, as a Scriptable script (iOS gives web apps no widgets of their own).
// It reads player_state through the game function with a private key; iOS refreshes it about every 15 minutes.
import { SB_URL } from "./store.js";

export function widgetScript(key) {
  return `// Al-Mustanir · home-screen and lock-screen widget for Scriptable.
// Keep this private: the key below reads your game (level, XP, streak, what's open today) and nothing else.
const KEY = "${key}";
const API = "${SB_URL}/functions/v1/game/widget";
const APP = "https://mustanir.ahmed-elmahdy.com/#today";

const req = new Request(API);
req.headers = { Authorization: "Bearer " + KEY };
let d = null;
try { d = await req.loadJSON(); } catch (e) {}

const gold = new Color("#E6C77E"), white = Color.white(), dim = new Color("#FFFFFF", 0.7);
const family = config.widgetFamily || "small";
const w = new ListWidget();
w.url = APP;
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

function bar(width, frac) {
  const c = new DrawContext(); c.size = new Size(width, 6); c.opaque = false; c.respectScreenScale = true;
  const track = new Path(); track.addRoundedRect(new Rect(0, 0, width, 6), 3, 3); c.addPath(track); c.setFillColor(new Color("#FFFFFF", 0.16)); c.fillPath();
  const fill = new Path(); fill.addRoundedRect(new Rect(0, 0, Math.max(6, width * Math.min(1, frac)), 6), 3, 3); c.addPath(fill); c.setFillColor(gold); c.fillPath();
  return c.getImage();
}
function openLine(o) {
  const left = [];
  if (o && o.prayers && o.prayers.length) left.push(o.prayers.length + (o.prayers.length === 1 ? " prayer" : " prayers"));
  if (o && o.pagesLeft) left.push(o.pagesLeft + " pages");
  if (o && o.tasks) left.push(o.tasks + (o.tasks === 1 ? " task" : " tasks"));
  return left.length ? "Open: " + left.join(" · ") : "Every decree sealed";
}

if (!d || !d.ok) {
  const t = w.addText("المُستنير"); t.font = Font.boldSystemFont(16); t.textColor = gold;
  w.addSpacer(4);
  const e = w.addText(d && d.error ? d.error : "Offline"); e.font = Font.systemFont(12); e.textColor = dim;
} else if (family.startsWith("accessory")) {
  // Lock screen: one line of the game.
  const t = w.addText("Lv " + d.level + " · " + d.today.xp + " XP · " + d.streak + "-day streak"); t.font = Font.semiboldSystemFont(13);
  if (family === "accessoryRectangular") { const o = w.addText(openLine(d.today.open)); o.font = Font.systemFont(12); }
} else {
  const g = new LinearGradient(); g.colors = [new Color("#17604F"), new Color("#0A3128")]; g.locations = [0, 1]; w.backgroundGradient = g;
  w.setPadding(14, 14, 14, 14);
  const top = w.addStack(); top.centerAlignContent();
  const lv = top.addText("Lv " + d.level); lv.font = Font.boldRoundedSystemFont(14); lv.textColor = gold;
  top.addSpacer(6);
  const rk = top.addText(d.rank.ar); rk.font = Font.mediumSystemFont(14); rk.textColor = gold;
  top.addSpacer();
  const fl = top.addImage(SFSymbol.named("flame.fill").image); fl.imageSize = new Size(12, 12); fl.tintColor = new Color("#F0A23B");
  top.addSpacer(2);
  const st = top.addText(String(d.streak)); st.font = Font.boldRoundedSystemFont(13); st.textColor = white;
  w.addSpacer(8);
  const xp = w.addText(d.today.xp + " XP"); xp.font = Font.boldRoundedSystemFont(family === "small" ? 28 : 32); xp.textColor = white; xp.minimumScaleFactor = 0.6;
  const of = w.addText("of " + d.today.max + " today"); of.font = Font.systemFont(12); of.textColor = dim;
  w.addSpacer(8);
  const img = w.addImage(bar(family === "small" ? 120 : 280, d.today.xp / Math.max(1, d.today.max))); img.resizable = false;
  w.addSpacer();
  const foot = w.addText(openLine(d.today.open)); foot.font = Font.mediumSystemFont(11); foot.textColor = dim; foot.lineLimit = 1; foot.minimumScaleFactor = 0.8;
  if (family !== "small" && d.medals && d.medals.next) {
    const m = w.addText("Next medal: " + d.medals.next.en + " · " + Math.round(d.medals.next.frac * 100) + "%"); m.font = Font.systemFont(11); m.textColor = dim;
  }
}

if (config.runsInWidget) Script.setWidget(w); else await w.presentSmall();
Script.complete();
`;
}
