# Al-Mustanir

Ahmed 2.0's daily record: a PWA hosted on GitHub Pages at https://mustanir.ahmed-elmahdy.com, backed by Supabase.

## How it fits together

- **App** (`index.html`, `sw.js`, `manifest.webmanifest`, `icons/`): no build step, no dependencies. It talks to Supabase's REST API with `fetch`, keeps a copy on the phone, and queues entries offline until they sync.
- **Database** (Supabase project `mustanir`):
  - `days`: one row per user per day; the day's entries are in `data` (jsonb), scores in `scores`.
  - `settings`: one row per user, targets in `data`.
  - `ingest_tokens`: SHA-256 hashes of Apple Shortcuts keys.
  - Row-level security on every table: you only ever see your own rows.
- **Apple Health** (`supabase/functions/health`): an Edge Function your Shortcut posts to with `Authorization: Bearer <key>`. It merges Health data into one day without overwriting anything logged by hand.

The publishable key in `index.html` is meant to be public; the data is protected by sign-in and row-level security.

## First-time setup

1. Open https://mustanir.ahmed-elmahdy.com in Safari → Share → **Add to Home Screen**.
2. Open it from the icon → **First time? Create account** → confirm the email → sign in.
3. In Supabase → Authentication → Sign In / Providers, turn off **Allow new users to sign up** so nobody else can register.
4. Settings → **Create Shortcut key**, copy it into your Shortcut (below).

## Apple Shortcut

POST to `https://qanzhisoxueaizscdial.supabase.co/functions/v1/health`
Headers: `Authorization: Bearer <your key>`, `Content-Type: application/json`

Body fields (all optional except what you have):

| Field | Meaning |
|---|---|
| `date` | `yyyy-MM-dd`, defaults to today in Cairo |
| `sleepMinutes` / `sleepSeconds` / `sleepH` | time asleep |
| `sleepStart`, `sleepEnd` | `yyyy-MM-dd HH:mm` |
| `activeKcal`, `basalKcal`, `dietaryKcal` | energy; deficit is computed when dietary is present |
| `workouts` | workout type names, e.g. `Traditional Strength Training, Tennis` |
| `walkMin` | walking-pad minutes |
| `weight` | kg |

Run it daily at 05:30: send last night's sleep for today, and yesterday's energy, workouts and weight for yesterday.
