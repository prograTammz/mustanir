// Numbered releases. Every deploy to main that changes the app is "Update N": version <major>.<N>, git tag v<major>.<N>.
// The major comes from package.json (2: Ahmed 2.0) and N counts up by one per release, forever.
//
// The record is the annotated tag. Its message holds the notes, so any clone with the tags (CI, or a laptop after
// `git fetch --tags`) can rebuild the whole history, and GitHub Releases mirror the tags for reading. A push whose
// commits only touch what never reaches the phone (docs, tests, Edge Functions, CI) is not a release: the build stays
// byte-for-byte the last one and phones download nothing.
//
// Notes, newest first:
//   - A commit that came in through a pull request gives the PR's "## Release notes", "## What's new" or "## Summary"
//     bullets (or the PR's title). This needs GITHUB_TOKEN; without it, the commit's subject is used.
//   - Any other commit gives its subject line, which this repo already writes as a summary for the user.
//   - In a commit body or PR body, `Release-Note: <text>` replaces the note, `Release-Note: none` drops it, and
//     `Update: urgent` makes phones apply the release as soon as it downloads, rather than when the app is next left.
//
// The vite plugin (vite.config.ts) calls describeRelease() and bakes the result into the app, sw.js and
// dist/version.json. CI runs the CLI below:
//   node scripts/release.mjs                         prints the release this checkout would build (JSON)
//   node scripts/release.mjs --summary  <version.json>   prints the GitHub release notes (Markdown)
//   node scripts/release.mjs --publish  <version.json>   tags, pushes the tag, creates the GitHub Release, comments on PRs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEP = "\x1f", END = "\x1e";
export const HISTORY_SIZE = 40;

/* ---------- pure parts (tests/release.test.js) ---------- */

// Paths that never reach the phone. Anything else (src, public, index.html, the build config, packages) is the app.
const INTERNAL = [/^docs\//, /^tests\//, /^supabase\//, /^\.github\//, /^\.claude\//, /\.md$/i, /^\.gitignore$/, /^LICENSE/];
export const ships = (files) => files.some((f) => !INTERNAL.some((re) => re.test(f)));

// Markdown down to the plain sentence the app shows.
export function plain(s) {
  return String(s || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

const NONE = /^(none|skip|no|-)$/i;
// In a PR body, a line of its own anywhere.
const urgentIn = (body) => /^Update:\s*urgent\s*$/im.test(String(body || ""));
const noteIn = (body) => (String(body || "").match(/^Release-Note:\s*(.+?)\s*$/im) || [])[1];

/** A commit's git trailers: its last paragraph, when every line of it is "Key: value" (so wrapped prose never counts). */
export function trailers(body) {
  const paras = String(body || "").replace(/\r/g, "").trim().split(/\n\s*\n/);
  const lines = (paras[paras.length - 1] || "").split("\n").filter((l) => l.trim());
  if (!lines.length || !lines.every((l) => /^[A-Za-z][\w-]*:\s*\S/.test(l))) return {};
  return Object.fromEntries(lines.map((l) => [l.slice(0, l.indexOf(":")).toLowerCase(), l.slice(l.indexOf(":") + 1).trim()]));
}

/** One commit's note: { text, urgent }. text is null when the commit asks to be left out. */
export function commitNote({ subject, body }) {
  const t = trailers(body), own = t["release-note"];
  return { text: own && NONE.test(own) ? null : plain(own || subject) || null, urgent: /^urgent$/i.test(t.update || "") };
}

const SECTIONS = ["release notes", "whats new", "summary", "changes"];
/** A pull request's notes: the bullets of its release-notes section (or summary), else its title. */
export function prNotes({ title, body }) {
  const b = String(body || "").replace(/\r/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const urgent = urgentIn(b), own = noteIn(b);
  if (own) return { notes: NONE.test(own) ? [] : [plain(own)], urgent };
  const sections = {};
  let cur = null;
  for (const line of b.split("\n")) {
    const h = line.match(/^#{1,4}\s+(.+?)\s*#*\s*$/);
    if (h) { cur = h[1].toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim(); sections[cur] ??= []; continue; }
    if (cur) sections[cur].push(line);
  }
  const key = SECTIONS.find((k) => sections[k]?.some((l) => l.trim()));
  if (!key) return { notes: [plain(title)].filter(Boolean), urgent };
  const lines = sections[key];
  // Top-level bullets only: an indented bullet is a detail of the one above it.
  const bullets = lines.filter((l) => /^ ?([-*+]|\d+[.)])\s+\S/.test(l)).map((l) => plain(l.replace(/^\s*([-*+]|\d+[.)])\s+/, "")));
  const text = bullets.length ? bullets : [plain(lines.join(" "))];
  return { notes: text.filter((t) => t && !/^\[[ x]\]/i.test(t)), urgent };
}

/** The annotated tag's message: readable on GitHub, and parsed back by parseTag. */
export function tagMessage(r) {
  return [`Update ${r.number}`, "", ...r.notes.map((n) => `- ${n}`), "", `Release-Date: ${r.date}`, ...(r.urgent ? ["Release-Urgent: yes"] : [])].join("\n") + "\n";
}

/** A tag back into a release. null for tags that aren't releases (v<major>.<N>). */
export function parseTag({ tag, sha, date, message }) {
  const m = String(tag).match(/^v(\d+)\.(\d+)$/);
  if (!m) return null;
  const msg = String(message || "");
  const notes = msg.split("\n").filter((l) => /^- \S/.test(l)).map((l) => l.slice(2).trim());
  const when = (msg.match(/^Release-Date:\s*(\S+)/m) || [])[1] || date || "";
  return { number: +m[2], version: `${m[1]}.${m[2]}`, tag, sha, date: when, notes, urgent: /^Release-Urgent:\s*yes/im.test(msg) };
}

/** The lowest release that may keep running: a phone below it applies the update as soon as it has it. */
export const minimumOf = (history, n) => history.reduce((m, r) => (r.urgent && r.number <= n && r.number > m ? r.number : m), 0);

/** Notes for a set of commits (newest first). prOf maps a commit sha to its merged PR, when known. */
export function notesFor(commits, prOf = {}) {
  const items = [], seen = new Set(), prs = new Set();
  let urgent = false;
  const add = (text, ref) => { if (text && !seen.has(text.toLowerCase())) { seen.add(text.toLowerCase()); items.push({ text, ref }); } };
  for (const c of commits) {
    const pr = prOf[c.sha];
    if (pr) {
      if (prs.has(pr.number)) continue;
      prs.add(pr.number);
      const n = prNotes(pr);
      urgent ||= n.urgent;
      n.notes.forEach((t) => add(t, "#" + pr.number));
      continue;
    }
    const n = commitNote(c);
    urgent ||= n.urgent;
    add(n.text, c.sha.slice(0, 7));
  }
  return { items, urgent };
}

/** The GitHub release body. */
export function releaseMarkdown(v, { repo = process.env.GITHUB_REPOSITORY, server = process.env.GITHUB_SERVER_URL || "https://github.com" } = {}) {
  const base = repo ? `${server}/${repo}` : "";
  const link = (ref) => (!base || !ref ? "" : ref.startsWith("#") ? ` ([${ref}](${base}/pull/${ref.slice(1)}))` : ` ([${ref}](${base}/commit/${ref}))`);
  const items = v.items?.length ? v.items : v.notes.map((text) => ({ text }));
  const out = [`**Update ${v.number}** · v${v.version} · ${String(v.date).slice(0, 10)}`, ""];
  if (v.urgent) out.push("> [!IMPORTANT]", "> Urgent: phones apply this update as soon as it downloads.", "");
  out.push(...items.map((i) => `- ${i.text}${link(i.ref)}`), "");
  if (base && v.previous) out.push(`Changes: [${v.previous}...${v.tag}](${base}/compare/${v.previous}...${v.tag})`, "");
  out.push("<sub>Phones pick this up on their own: it downloads in the background and installs when the app is next left. Settings → Updates lists these notes.</sub>");
  return out.join("\n") + "\n";
}

/** What the app is told about one release (the history list in Settings and version.json). */
export const slim = (r) => ({ number: r.number, version: r.version, date: r.date, notes: r.notes, ...(r.urgent ? { urgent: true } : {}) });

/* ---------- git and GitHub ---------- */

const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 }).trim();
const isCommit = (sha, cwd) => { if (!sha || /^0+$/.test(sha)) return false; try { git(["cat-file", "-e", `${sha}^{commit}`], cwd); return true; } catch { return false; } };

export function readTags(cwd) {
  let out = "";
  try { out = git(["for-each-ref", "refs/tags/v*", `--format=%(refname:short)${SEP}%(objectname)${SEP}%(*objectname)${SEP}%(creatordate:iso-strict)${SEP}%(contents)${END}`], cwd); } catch { return []; }
  return out.split(END).map((s) => s.replace(/^\s+/, "")).filter(Boolean)
    .map((rec) => { const [tag, obj, peeled, date, message] = rec.split(SEP); return parseTag({ tag, sha: peeled || obj, date, message }); })
    .filter(Boolean).sort((a, b) => b.number - a.number);
}

function readCommits(base, cwd) {
  const range = base ? [`${base}..HEAD`] : ["-1", "HEAD"];
  const out = git(["log", "--no-merges", "--name-only", `--format=${END}%H${SEP}%s${SEP}%b${SEP}`, ...range], cwd);
  return out.split(END).filter((s) => s.trim()).map((rec) => {
    const [sha, subject, body, files] = rec.split(SEP);
    return { sha: sha.trim(), subject, body, files: (files || "").split("\n").map((f) => f.trim()).filter(Boolean) };
  });
}

// The merged pull request each commit came in through (one API call per commit; a release is a handful of them).
async function pullRequests(commits, { token, repo, preview }) {
  const prOf = {};
  if (!token || !repo) return prOf;
  for (const c of commits) {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/commits/${c.sha}/pulls`, {
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "mustanir-release" },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) continue;
      const list = await r.json();
      const pr = list.find((p) => p.merged_at) || (preview ? list[0] : null);
      if (pr) prOf[c.sha] = { number: pr.number, title: pr.title, body: pr.body || "" };
    } catch { /* the commit's own subject stands in */ }
  }
  return prOf;
}

/** What a build of this checkout is: the release, whether it's a new one, and the history before it. */
export async function describeRelease({ cwd = process.cwd(), env = process.env } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
  const major = parseInt(pkg.version, 10) || 1;
  const tags = readTags(cwd), last = tags[0] || null;
  const channel = env.GITHUB_ACTIONS ? (env.GITHUB_REF === "refs/heads/main" ? "live" : "preview") : "local";
  // Before the first tag, the release is what this push brought (CI passes the commit main was on before it).
  const base = last ? last.tag : isCommit(env.RELEASE_SINCE, cwd) ? env.RELEASE_SINCE : null;
  const shipped = readCommits(base, cwd).filter((c) => ships(c.files));
  const forced = env.RELEASE_NUMBER ? parseInt(env.RELEASE_NUMBER, 10) : 0;
  const fresh = !!forced || !last || shipped.length > 0;

  let current;
  if (fresh) {
    const prOf = await pullRequests(shipped, { token: env.GITHUB_TOKEN, repo: env.GITHUB_REPOSITORY, preview: channel === "preview" });
    const { items, urgent } = notesFor(shipped, prOf);
    const number = forced || (last ? last.number : 0) + 1;
    if (!items.length) items.push({ text: "Fixes and polish." });
    current = { number, version: `${major}.${number}`, tag: `v${major}.${number}`, sha: git(["rev-parse", "HEAD"], cwd), date: git(["log", "-1", "--format=%cI"], cwd), notes: items.map((i) => i.text), urgent, items };
  } else current = { ...last, items: last.notes.map((text) => ({ text })) };

  const history = [current, ...tags.filter((t) => t.number !== current.number)].sort((a, b) => b.number - a.number).slice(0, HISTORY_SIZE);
  return { ...current, fresh, channel, previous: fresh ? last?.tag || null : tags[1]?.tag || null, minimum: minimumOf(history, current.number), history: history.map(slim) };
}

/** A build with no git to read (a source tarball): it still runs, as "dev". */
export const devRelease = () => ({ number: 0, version: "dev", tag: "", sha: "", date: "", notes: [], urgent: false, items: [], fresh: false, channel: "local", previous: null, minimum: 0, history: [] });

/* ---------- CI ---------- */

function publish(v, cwd) {
  if (v.channel !== "live" || !v.fresh) return console.log(`Update ${v.number}: no new release (${v.channel}, ${v.fresh ? "new" : "unchanged"}).`);
  if (readTags(cwd).some((t) => t.tag === v.tag)) return console.log(`${v.tag} already exists.`);
  const run = (cmd, args, input) => execFileSync(cmd, args, { cwd, input, stdio: [input == null ? "ignore" : "pipe", "inherit", "inherit"] });
  run("git", ["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "tag", "-a", v.tag, v.sha, "-F", "-"], tagMessage(v));
  run("git", ["push", "origin", `refs/tags/${v.tag}`]);
  run("gh", ["release", "create", v.tag, "--verify-tag", "--latest", "--title", `Update ${v.number}`, "--notes-file", "-"], releaseMarkdown(v));
  const url = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}/releases/tag/${v.tag}`;
  for (const pr of new Set((v.items || []).filter((i) => i.ref?.startsWith("#")).map((i) => i.ref.slice(1)))) {
    try { run("gh", ["pr", "comment", pr, "--body", `Shipped in [Update ${v.number}](${url}) · v${v.version}.`]); } catch { /* a closed or locked PR */ }
  }
  console.log(`Released Update ${v.number} (${v.tag}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [flag, file] = process.argv.slice(2);
  const read = () => JSON.parse(fs.readFileSync(file, "utf8"));
  if (flag === "--summary") process.stdout.write(`### Update ${read().number}${read().fresh ? "" : " (unchanged)"}\n\n` + releaseMarkdown(read()));
  else if (flag === "--publish") publish(read(), process.cwd());
  else console.log(JSON.stringify(await describeRelease(), null, 2));
}
