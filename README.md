# Al-Mustanir

Ahmed 2.0's daily record: a PWA hosted on GitHub Pages at https://mustanir.ahmed-elmahdy.com, backed by Supabase.

## How it fits together

- **App** (`src/`, `public/`): React 18 + Vite, Tailwind CSS v4 and shadcn/ui (Radix primitives, vaul drawers, Recharts, lucide icons), with light, dark and system themes. Screens live in `src/screens/`, shared pieces in `src/components/`, the game and data layer in `src/lib/` (`logic.js`, `store.js`). GitHub Actions builds on every push and deploys `main` to Pages (`public/CNAME` keeps the domain). It talks to Supabase's REST API with `fetch`, keeps a copy on the phone, and queues entries offline until they sync.
- **Terms**: three months each from `termStart`. I and II are the cut; III (summer) holds the line at maintenance; IV makes slow progress. Each term switches the deficit, protein, sessions and step targets on its own. Away days (travel, illness, summer interruptions) swap in floor goals so a streak survives one off day; two in a row is flagged.
- **Database** (Supabase project `mustanir`):
  - `days`: one row per user per day; the day's entries are in `data` (jsonb), scores in `scores`.
  - `settings`: one row per user, targets in `data`.
  - `ingest_tokens`: SHA-256 hashes of Apple Shortcuts keys.
  - Row-level security on every table: you only ever see your own rows.
- **WHOOP** (`supabase/functions/whoop`, since November 2026 the only body-data source): connect in Settings (OAuth; the client id and secret live in `app_secrets` as `whoop_client_id` / `whoop_client_secret`, or as the function secrets `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET`). Webhooks (`/whoop/webhook`, HMAC-checked) bring sleeps, recoveries and workouts within minutes; pg_cron calls `/whoop/poll` every 10 minutes for cycles (strain, steps, energy) and anything missed. Raw records are kept in `whoop_records`; each day gets sleep stages and hours (naps included, counted to the morning you wake), sleep performance, consistency, efficiency and need, recovery, HRV, resting HR, SpO₂, skin temperature, respiratory rate, strain, steps, energy burned, and every workout with its heart-rate zones. Deficit = WHOOP's energy burned − meals logged in the app. Hours slept and weight are never typed in: sleep comes from WHOOP's scored sleeps, and weight from WHOOP's body measurement (your scale writes to Apple Health, which WHOOP reads), stored on the day it's read and in `health_daily`. Up for Fajr is decided from the sleeps alone, every day: awake at some point from 10 minutes before Fajr to 45 after (Fajr computed for New Cairo, Egyptian method, 19.5°). There is no bedtime check. Other verdicts (training type, diet, tracker worn) fill blanks only, from the connect date (`settings.whoopFrom`). Connecting sets `settings.healthSource = 'whoop'`: database triggers then drop anything Apple Health still sends. Biological age is read in the WHOOP app (WHOOP Age isn't in its API).
- **Apple Health** (history, and before WHOOP) (`supabase/functions/health`): an Edge Function your Shortcut posts batches to with `Authorization: Bearer <key>`. Raw samples go to `health_samples`, workouts to `health_workouts`, per-day totals to `health_daily` (recomputed after each sync), and a log line to `health_syncs`. Resending overlapping data is safe. Measured values flow into the day's record; judgements are only filled on daily syncs and never overwrite what you logged by hand.
- **Training** (`settings.training`, `settings.trainingOnce`): weekly and one-off slots per sport, edited in Settings. Each slot is matched against the watch: exact workouts (Health Auto Export) or hour-by-hour Exercise Minutes (the Shortcut), with 30 minutes of slack each side. Half the planned time or more counts as done; you can mark a slot done or skipped by hand. The slots drive the calendar feed and the 30-minute reminders.
- **Food** (`meals` table): logged in the FatSecret app (photo, barcode or search) and pulled in every 10 minutes by `supabase/functions/fatsecret` (OAuth 1.0; keys in `app_secrets` as `fatsecret_key` / `fatsecret_secret`; meals carry `source = 'fatsecret'` and FatSecret's entry id, so edits and deletions carry over). Meals can still be typed in the app. Intake = all meals; deficit = WHOOP's energy burned − intake.
- **Walking pad**: `POST /palace/walkpad` with the Shortcut key toggles a timer; stopping it logs the minutes.
- **Health catalog** (`health_metrics`): every column Health Auto Export knows (124 measures) with its unit, how a day is totalled (sum, average, last, min, max, minutes), category and which direction is better. Incoming names are matched through its aliases; kJ, lb, mi and °F are converted on arrival. A day exported as a daily summary (`source = 'HAE history'`) is Apple's own de-duplicated total and wins over finer samples for that day. `health_summary()` and `health_series()` feed the Health page. The full history (Sept 2023 onward) was imported from the Health Auto Export CSV export.
- **Vitality** (Today → Measured for you, and Progress): steps, exercise, sleep, sleep consistency and day strain (all from WHOOP) against goals set in Settings and reset by each term's plan; up to 20 XP a day on days you log, and the Vitality medals for 4 of 5 kept 7 or 30 days running. Days before the first WHOOP day (`settings.whoopFrom`) are judged on steps, exercise and sleep only (3 of 3). Stand hours and daylight are gone; the raw Apple samples stay in `health_samples`.
- **Biological age** (Progress → All health data, history only): from the last 60 days of VO₂ max, resting heart rate, steps, sleep, BMI, HRV and walking speed. Each measure's link to all-cause mortality in large studies is converted to years with the Gompertz law (risk doubles about every 8 years). An estimate, not a diagnosis. Needs the birth date in the Diwan.
- **Daily checklist** (`settings.checklist`, per-day `checks` and `extraTasks`): productivity = share ticked, worth up to 20 XP a day.
- **Game** (`src/lib/logic.js`): only days from `settings.termStart` (2026-11-01, the first day in office) count; everything before was the transition. Habits: up for Fajr, hours slept and sleep consistency (all WHOOP) count double, routines once. Sunday weigh-in: a lower weight than last Sunday earns 40 XP. Levels need 60·(L−1)^2.2 XP; ten ranks from Candidate to The Enlightened (level 30); 50 medals across office, faith, sleep, body, purity and knowledge. each minister earns up to 20 XP a day, a perfect day adds 25, the checklist up to 20, vitality up to 20, and a day with no masturbation and no porn adds 10 (175 max). Purity is the one decree that runs the other way: every day starts at full marks and only a logged slip (porn or masturbation) takes them away and the Self-mastery medals at 7 and 30 days. Levels need 50·L·(L−1) XP; ranks go Candidate → Elected → Statesman → Reformer → Al-Mustanir. Only days with something logged by hand count, so Health history never inflates the score.

The publishable key in `src/lib/store.js` is meant to be public; the data is protected by sign-in and row-level security.

## The app

Three rooms, built to check in in under a minute:

- **Today**: a score ring and level, then *Check in* (the five prayers, pages read, morning and night routines, today's tasks, and purity, which starts clean and only changes if you log a slip). Below, *Measured for you* is read-only: up for Fajr, sleep, consistency, steps, exercise and strain from WHOOP; the deficit (WHOOP burned − FatSecret eaten) with the meals; training slots and workouts; weight and the Sunday weigh-in. Then *Reflect* (the journal) and *Away or interrupted*.
- **Progress**: level, rank and streaks; this month's council (approval per minister, tap for its file; the council's verdict notes); the advisor's weekly report; medals; one trend chart (weight, sleep, deficit, steps, prayers, recovery, tasks over 7, 30 or 90 days); and all health data folded away.
- **Settings**: appearance, targets, vitals, training schedule, checklist, daily schedule, notifications, calendar feed, WHOOP and FatSecret (Sync now), account.

Old links (`#palace`, `#decrees`, `#records`, `#council`, `#diwan`) redirect to the matching room.

**PWA**: an emerald boot screen with the emblem (shown at least 0.6 s, lifted on the first frame), matching iOS launch images for twelve iPhone sizes (`public/splash/`), a full manifest (id, shortcuts to *Check in* and *Progress*, install screenshots, maskable icon, portrait), and a service worker that precaches every built file (the list and a build id are written into `dist/sw.js` by the `mustanir-precache` plugin in `vite.config.ts`). The app opens instantly from cache and works offline; a new version installs in the background and a toast offers *Update*. The home-screen badge shows what's still open today (prayers not marked, reading not started). Storage is marked persistent.

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

**Maintenance.** `POST /functions/v1/health` with the `x-cron-token` header and `{ "user", "from", "to" }` recomputes daily totals and the tracker for a range (used after imports).
