# Al-Mustanir

Ahmed 2.0's daily record: a PWA hosted on GitHub Pages at https://mustanir.ahmed-elmahdy.com, backed by Supabase.

## How it fits together

- **App** (`index.html`, `sw.js`, `manifest.webmanifest`, `icons/`): no build step, no dependencies. It talks to Supabase's REST API with `fetch`, keeps a copy on the phone, and queues entries offline until they sync.
- **Database** (Supabase project `mustanir`):
  - `days`: one row per user per day; the day's entries are in `data` (jsonb), scores in `scores`.
  - `settings`: one row per user, targets in `data`.
  - `ingest_tokens`: SHA-256 hashes of Apple Shortcuts keys.
  - Row-level security on every table: you only ever see your own rows.
- **Apple Health** (`supabase/functions/health`): an Edge Function your Shortcut posts batches to with `Authorization: Bearer <key>`. Raw samples go to `health_samples`, workouts to `health_workouts`, per-day totals to `health_daily` (recomputed after each sync), and a log line to `health_syncs`. Resending overlapping data is safe. Measured values flow into the day's record; judgements are only filled on daily syncs and never overwrite what you logged by hand.
- **Game** (`js/logic.js`): each minister earns up to 20 XP a day, a perfect day adds 25. Levels need 50·L·(L−1) XP; ranks go Candidate → Elected → Statesman → Reformer → Al-Mustanir. Only days with something logged by hand count, so Health history never inflates the score.

The publishable key in `index.html` is meant to be public; the data is protected by sign-in and row-level security.

## First-time setup

1. Open https://mustanir.ahmed-elmahdy.com in Safari → Share → **Add to Home Screen**.
2. Open it from the icon → **First time? Create account** → confirm the email → sign in.
3. In Supabase → Authentication → Sign In / Providers, turn off **Allow new users to sign up** so nobody else can register.
4. Settings → **Create Shortcut key**, copy it into your Shortcut (below).

## Apple Health

Three formats are accepted at `POST https://qanzhisoxueaizscdial.supabase.co/functions/v1/health` with `Authorization: Bearer <key>` (create the key in the app's Diwan). The full step-by-step guide is in the app: Diwan → Apple Health.

**1. Flat daily totals (the free Shortcut).** One number per field, built with Shortcuts' JSON body, no loops:

```json
{ "date": "2026-11-03", "steps": 9120, "activeKcal": 612, "basalKcal": 1850, "dietaryKcal": 1900,
  "exerciseMin": 42, "standHours": 11, "restingHR": 58, "hrv": 46, "weight": 89.4,
  "sleepSeconds": 24720, "sleepStart": "2026-11-02T21:12:00+02:00", "sleepEnd": "2026-11-03T04:58:00+02:00",
  "workouts": "Tennis, Indoor Walk", "walkMin": 30 }
```

Run nightly at 23:59 (Shortcuts → Automation → Time of Day → Run Immediately), optionally again at 05:30. Resending a day overwrites its totals.

**2. Health Auto Export** (third-party app, REST automation): its JSON (`{ "data": { "metrics": [...], "workouts": [...] } }`) is read as-is, including day-aggregated sleep. Best for the two-year history.

**3. Raw batches** for custom tooling:

```json
{ "kind": "backfill",
  "samples": [ { "type": "Step Count", "start": "2026-10-18T09:00:00+03:00", "end": "2026-10-18T09:10:00+03:00", "value": 812 },
               { "type": "Sleep", "value": "Core", "start": "2026-10-17 23:40", "end": "2026-10-18 01:05" } ],
  "workouts": [ { "activity": "Tennis", "start": "2026-10-18T18:00:00+03:00", "end": "2026-10-18T19:10:00+03:00", "energy": 540 } ] }
```

Rules for all three:
- Apple's names ("Step Count", "Resting Heart Rate", "step_count", …) and short keys both work; unknown types are stored as sent.
- Sleep counts toward the morning you wake. Dates without an offset are read as Cairo time (Egypt's DST is handled).
- A range longer than three days is treated as history: stored and charted, never scored.
- Autofill on daily syncs, only into blank fields: in bed on time (30-min grace), up for Fajr (10-min grace), training type from workout names, diet on target from the deficit, watch worn from stand hours or overnight sleep. Measured values (sleep hours, steps, energy, weight, walking minutes, exercise, resting HR) are always refreshed.
