// The patch model behind saves (ADR-0001): only what you changed goes to the server, and null removes a key.
import { describe, expect, test } from "bun:test";

globalThis.location ??= { origin: "https://mustanir.test", pathname: "/" };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { applyPatch, diffDay } = await import("../src/lib/store.js");

describe("patches", () => {
  const server = { steps: 9000, source: "WHOOP 2026-11-01T10:00:00Z", prayers: { fajr: "on" } };
  test("a check-in sends only the keys it touched, never the watch's", () => {
    const shown = { ...structuredClone(server), pages: 20, prayers: { fajr: "on", dhuhr: "on" } };
    expect(diffDay(server, shown)).toEqual({ pages: 20, prayers: { fajr: "on", dhuhr: "on" } });
  });
  test("removing a key sends null, and applying the patch removes it", () => {
    const base = { ...server, note: "x" }, shown = structuredClone(server);
    const patch = diffDay(base, shown);
    expect(patch).toEqual({ note: null });
    expect(applyPatch(base, patch)).toEqual(server);
  });
  test("a WHOOP write and a check-in to the same day both survive", () => {
    const mine = diffDay(server, { ...server, pages: 10 });
    const whoopLater = { ...server, steps: 12000 }; // the server's copy moved on meanwhile
    expect(applyPatch(whoopLater, mine)).toEqual({ ...server, steps: 12000, pages: 10 });
  });
  test("nothing changed, nothing sent", () => {
    expect(diffDay(server, structuredClone(server))).toEqual({});
  });
});
