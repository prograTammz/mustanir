// Numbered releases (scripts/release.mjs): which commits are an update, what the notes say, and the tag round trip.
import { describe, expect, test } from "bun:test";
import { ships, plain, commitNote, prNotes, tagMessage, parseTag, minimumOf, notesFor, releaseMarkdown, slim } from "../scripts/release.mjs";

describe("what reaches the phone", () => {
  test("app code and assets are an update", () => {
    expect(ships(["src/lib/logic.js"])).toBe(true);
    expect(ships(["public/sw.js", "README.md"])).toBe(true);
    expect(ships(["index.html"])).toBe(true);
    expect(ships(["vite.config.ts"])).toBe(true);
  });
  test("docs, tests, Edge Functions and CI are not", () => {
    expect(ships(["docs/handoff/2026-11-07.md", "README.md", "CLAUDE.md"])).toBe(false);
    expect(ships(["tests/engine.test.js"])).toBe(false);
    expect(ships(["supabase/functions/game/logic.js"])).toBe(false);
    expect(ships([".github/workflows/deploy.yml"])).toBe(false);
    expect(ships([])).toBe(false);
  });
});

describe("commit notes", () => {
  test("the subject is the note", () => {
    expect(commitNote({ subject: "Sleep: judged by WHOOP's sleep score, not hours", body: "Long reasoning.\n\nCo-Authored-By: x" }))
      .toEqual({ text: "Sleep: judged by WHOOP's sleep score, not hours", urgent: false });
  });
  test("Release-Note replaces it, none drops it", () => {
    expect(commitNote({ subject: "Refactor the store", body: "Release-Note: Saves are faster offline\nCo-Authored-By: x" }).text).toBe("Saves are faster offline");
    expect(commitNote({ subject: "Rename a helper", body: "Release-Note: none" }).text).toBeNull();
  });
  test("Update: urgent marks the release", () => {
    expect(commitNote({ subject: "Fix the save RPC", body: "Why.\n\nUpdate: urgent\nCo-Authored-By: x" }).urgent).toBe(true);
  });
  test("only the last paragraph's trailers count, never wrapped prose", () => {
    const body = "A commit body that explains how\nRelease-Note: <text> overrides the note, and\nUpdate: urgent\nmakes phones install it.\n\nCo-Authored-By: x";
    expect(commitNote({ subject: "Updates: numbered", body })).toEqual({ text: "Updates: numbered", urgent: false });
  });
  test("markdown becomes plain text", () => {
    expect(plain("Use **bold**, `code` and [a link](https://x.y) in _one_ line")).toBe("Use bold, code and a link in one line");
    expect(plain("keep snake_case_names")).toBe("keep snake_case_names");
  });
});

describe("pull request notes", () => {
  const body = "## Summary\n- Numbered updates in **Settings**\n  - a nested detail\n- A Check for updates button\n\n## Test plan\n- [ ] run it\n";
  test("the summary's top-level bullets", () => {
    expect(prNotes({ title: "Updates", body })).toEqual({ notes: ["Numbered updates in Settings", "A Check for updates button"], urgent: false });
  });
  test("a Release notes section wins over the summary", () => {
    const b = "## Summary\n- internal wording\n\n## Release notes\n- What you'll notice\n";
    expect(prNotes({ title: "x", body: b }).notes).toEqual(["What you'll notice"]);
  });
  test("prose without bullets is one note; no section falls back to the title", () => {
    expect(prNotes({ title: "x", body: "## What's new\nThe palace has a new gate.\n" }).notes).toEqual(["The palace has a new gate."]);
    expect(prNotes({ title: "Palace: a new gate", body: "Some text with no headings." }).notes).toEqual(["Palace: a new gate"]);
    expect(prNotes({ title: "Palace: a new gate", body: null }).notes).toEqual(["Palace: a new gate"]);
  });
  test("Release-Note in a PR body, and comments are ignored", () => {
    expect(prNotes({ title: "x", body: "<!-- ## Summary\n- hidden -->\nRelease-Note: none" }).notes).toEqual([]);
  });
});

describe("a release's notes", () => {
  const c = (sha, subject, body = "") => ({ sha: sha.padEnd(40, "0"), subject, body, files: ["src/a.js"] });
  test("commits from one PR give the PR's notes once; others their subjects", () => {
    const commits = [c("aaa", "Second PR commit"), c("bbb", "First PR commit"), c("ccc", "Today: direct fix")];
    const pr = { number: 12, title: "Palace gate", body: "## Summary\n- The verse over a pointed arch\n" };
    const { items, urgent } = notesFor(commits, { [commits[0].sha]: pr, [commits[1].sha]: pr });
    expect(items).toEqual([{ text: "The verse over a pointed arch", ref: "#12" }, { text: "Today: direct fix", ref: "ccc0000" }]);
    expect(urgent).toBe(false);
  });
  test("the same sentence twice is one note, and urgency carries", () => {
    const { items, urgent } = notesFor([c("a1", "Fix sync"), c("b2", "fix sync", "Update: urgent")]);
    expect(items.length).toBe(1);
    expect(urgent).toBe(true);
  });
});

describe("the tag is the record", () => {
  const r = { number: 15, version: "2.15", tag: "v2.15", sha: "abc", date: "2026-11-07T16:41:17+02:00", notes: ["One", "Two: with a colon"], urgent: true };
  test("message and back", () => {
    const back = parseTag({ tag: "v2.15", sha: "abc", date: "2026-11-08T00:00:00Z", message: tagMessage(r) });
    expect(back).toEqual(r);
  });
  test("tags that aren't releases are skipped", () => {
    expect(parseTag({ tag: "palace-gate", message: "" })).toBeNull();
    expect(parseTag({ tag: "v2.15.1", message: "" })).toBeNull();
  });
  test("the minimum is the newest urgent release at or below", () => {
    const h = [{ number: 16 }, { number: 15, urgent: true }, { number: 14 }, { number: 12, urgent: true }];
    expect(minimumOf(h, 16)).toBe(15);
    expect(minimumOf(h, 14)).toBe(12);
    expect(minimumOf(h, 11)).toBe(0);
  });
  test("the app gets only what it shows", () => {
    expect(slim({ ...r, urgent: false, items: [] })).toEqual({ number: 15, version: "2.15", date: r.date, notes: r.notes });
  });
});

describe("the GitHub release", () => {
  test("links each note, and the compare range", () => {
    const md = releaseMarkdown({ number: 15, version: "2.15", tag: "v2.15", previous: "v2.14", date: "2026-11-07T16:41:17+02:00", notes: [], urgent: false, items: [{ text: "A", ref: "#12" }, { text: "B", ref: "abc1234" }] }, { repo: "o/r" });
    expect(md).toContain("**Update 15** · v2.15 · 2026-11-07");
    expect(md).toContain("- A ([#12](https://github.com/o/r/pull/12))");
    expect(md).toContain("- B ([abc1234](https://github.com/o/r/commit/abc1234))");
    expect(md).toContain("[v2.14...v2.15](https://github.com/o/r/compare/v2.14...v2.15)");
    expect(md).not.toContain("Urgent");
  });
});
