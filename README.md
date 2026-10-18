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

## Apple Shortcut contract

POST `https://qanzhisoxueaizscdial.supabase.co/functions/v1/health`
Headers: `Authorization: Bearer <your key>`, `Content-Type: application/json`

```json
{
  "kind": "daily",
  "samples": [
    { "type": "Step Count", "start": "2026-10-18T09:00:00+03:00", "end": "2026-10-18T09:10:00+03:00", "value": 812, "unit": "count", "source": "Apple Watch" },
    { "type": "Sleep", "value": "Core", "start": "2026-10-17 23:40", "end": "2026-10-18 01:05" }
  ],
  "workouts": [
    { "activity": "Tennis", "start": "2026-10-18T18:00:00+03:00", "end": "2026-10-18T19:10:00+03:00", "energy": 540, "avgHR": 138 }
  ]
}
```

- `type` accepts Apple's names ("Step Count", "Heart Rate", "Active Energy", "Resting Heart Rate", "Heart Rate Variability", "Weight", "Dietary Energy", …) or the short keys in `health_metrics`. Unknown types are stored as sent.
- Sleep samples use `type: "Sleep"` with the stage as `value` (Core, Deep, REM, Awake, In Bed, Asleep); duration comes from start and end, and sleep counts toward the morning you wake.
- Dates: ISO 8601 with offset, or `yyyy-MM-dd HH:mm` read as Cairo time.
- Up to 50,000 items per request. For the two-year backfill use `"kind": "backfill"` and send one month per request.
- Nightly: a personal automation at 23:59 sends the day just ending as `"kind": "daily"`; the 05:30 run is no longer needed.
