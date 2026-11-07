# Al-Mustanir: notes for Claude Code

Ahmed 2.0's self-improvement PWA, run as a game. Hosted at https://mustanir.ahmed-elmahdy.com (GitHub Pages), backed by the
Supabase project `qanzhisoxueaizscdial`. Read `README.md` for how everything fits together, `docs/adr/0001-*.md` for the
server engine and live sync, `docs/design/material-3.md` for the design system, and the newest file in `docs/handoff/`
for where the work last stood.

## Commands
- `npm install`, then `npm run dev` (Vite) and `npm run build`.
- `TZ=Africa/Cairo bun test`: the engine and store tests. CI runs them before every build.
- `npm run tokens`: regenerates `src/styles/m3-tokens.css` from `scripts/m3-tokens.mjs` (Material 3 color roles and springs).

## Shipping
- A push to `main` deploys to Pages through `.github/workflows/deploy.yml`.
- A push to `redesign` publishes a preview build to the `build-preview` branch.
- Check a deploy: `gh api repos/prograTammz/mustanir/deployments -q '.[0]'`.
- Edge Functions live in `supabase/functions/` (game, palace, whoop, fatsecret, health). Deploy them with
  `supabase functions deploy <name> --no-verify-jwt`, or through the Supabase MCP server.

## Rules of the codebase
- `src/lib/logic.js` is the one game engine. `supabase/functions/game/logic.js` must be an identical copy, and a test fails
  if they differ. After changing the engine, copy it and redeploy `game`.
- Days save as patches through the `save_day` RPC (`src/lib/store.js`); never overwrite a whole day from the client.
- UI is Material 3 Expressive: use `src/components/m3` (Button, IconButton, Connected, Chip, Switch, Checkbox, Card,
  Progress, Ring, Shape, Icon, XP) and the M3 color roles (`bg-surface-container`, `text-on-surface-variant`,
  `bg-tertiary-container`…), not raw colors. Icons are Material Symbols: add a name to `scripts/icons.txt` and regenerate
  `src/components/m3/icons.js` from google/material-design-icons.
- Secrets live in Supabase (`app_secrets`, function secrets). Never commit or paste them.

## Product decisions Tammz has made
- Gamification first: XP, levels, ranks, medals lead the experience. The term started 2026-11-01.
- WHOOP is the only body-data source (sleep, Fajr wake, strain, steps, workouts, weight); food comes only from FatSecret.
  No manual entry for food or exercise; everything syncs on its own every 10 minutes.
- A day with no masturbation and no porn is rewarded every day; purity starts at full marks and only a logged slip costs it: porn −15, masturbation −5 of its 20.
- Sleep is judged by WHOOP's sleep score alone, not hours: it pays half of Order's 20 XP in whole points (75% → 8 of 10).
  Up for Fajr and consistency no longer pay there; no bedtime check. Vitality's five are steps, exercise, sleep score,
  recovery and strain (4 of 5 for the medal). Every Sunday weight drop pays XP.
- A training session can be cancelled from Today: it isn't judged, gets no reminder, and leaves the calendar feed.
