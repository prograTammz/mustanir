# ADR-0001: One game engine on both sides, patch writes and live sync on Supabase

**Status:** Accepted
**Date:** 2026-11-01
**Deciders:** Tammz

## Context

Al-Mustanir is a single-user PWA on GitHub Pages with Supabase (Postgres, Auth, Edge Functions, pg_cron, pg_net)
behind it. WHOOP and FatSecret write to `days` from Edge Functions; the phone writes check-ins to the same rows.
The audit ([2026-11-01](../audit/2026-11-01-tech-debt.md)) found four structural problems:

1. The game (XP, levels, streaks, medals) lives only in the browser, so nothing server-side can use it.
2. Saves are read-merge-write from the phone and race with WHOOP writes.
3. Every open downloads every day since 2023 and rewrites them all to `localStorage`.
4. Nothing is live: the app learns about WHOOP data only when it reloads.

Constraints: no new paid services, no SDKs that bloat the bundle, iOS Safari as the main runtime, the game rules must
stay identical everywhere, and existing data must survive.

## Decision

1. **One engine, two runtimes.** `src/lib/logic.js` stays pure (no DOM, clock injectable) and is deployed as-is next to a
   new `game` Edge Function. A statement-level trigger on `days` calls it through `pg_net` with the touched user. It
   recomputes the player and writes **`player_state`** (level, XP, rank, today's XP and open items, streaks, closest
   medals) and **`medal_awards`** (one row per medal, with the moment it was won). Level-ups and medals won from
   WHOOP or FatSecret data (not from your own taps) become **`game_events`** that the notifier sends as pushes.
   A test fails if the deployed copy of the engine differs from `src/lib/logic.js`.
2. **Patch writes.** The phone sends only what changed to a `save_day(date, patch, scores)` RPC that merges in
   Postgres (`data || patch`, nulls removed) in one statement. No more reading first, and no `MEASURED` list.
3. **Incremental, local-first reads.** Days live in IndexedDB on the phone. A load asks only for rows changed since
   the last cursor (`updated_at > cursor`). The first paint comes from IndexedDB.
4. **Live sync.** `days` and `player_state` join the `supabase_realtime` publication. The app holds one Realtime
   websocket (a ~2 kB client, not the 25 kB SDK) filtered to your rows, so WHOOP steps, workouts and meals land on screen
   seconds after they reach the database.
5. **Lean front end.** Rooms load on demand. Charts are hand-drawn SVG (recharts is removed). Fonts don't block paint.

## Options considered

### A. Keep the game in the browser (status quo)
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | None |
| Capability | No server-side game: no level-up pushes, no widget data |

**Pros:** nothing to build. **Cons:** problems 1–4 remain.

### B. Re-implement the game in SQL (PL/pgSQL views and functions)
| Dimension | Assessment |
|---|---|
| Complexity | High: 47 medals, streaks, slot matching |
| Drift risk | High: two implementations of every rule |

**Pros:** no extra function hop. **Cons:** every rule is written twice and will diverge.

### C. Shared JS engine in an Edge Function, triggered by the database (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Medium: one function, one trigger, three tables |
| Cost | Free tier: one invocation per write statement |
| Drift risk | Low: the same file, guarded by a test |

**Pros:** one source of truth; the server can push and serve widgets. **Cons:** a redeploy is needed when the rules
change; a few hundred milliseconds of lag on server-side state.

For live sync, **polling more often** (cheap, but still laggy and battery-hungry) and the **full `supabase-js` SDK**
(+25 kB gzipped for one feature) were rejected in favour of a minimal websocket client.

## Consequences

- Easier: pushes that know the game ("3 prayers open, 52 XP on the table"); a Scriptable widget reading
  `player_state`; WHOOP-earned level-ups celebrated even with the app closed; opening the app costs a few rows,
  not 1 MB.
- Harder: rule changes need the `game` function redeployed (the sync test catches forgetting).
- Revisit: per-room state subscriptions (audit item 11); TypeScript for the engine (item 12).

## Action items
1. [x] Migration: `player_state`, `medal_awards`, `game_events`, `save_day` RPC, statement trigger, Realtime publication,
   advisor fixes and indexes.
2. [x] `game` Edge Function deployed with the engine; `palace` sends `game_events`.
3. [x] Client: IndexedDB store, incremental load, patch saves, Realtime client, lazy rooms, SVG charts.
4. [x] `bun test` for the engine and the sync guard, run in CI before every deploy.
