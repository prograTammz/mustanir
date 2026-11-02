# Al-Mustanir on Material 3 Expressive

The app follows Google's Material 3 (Expressive) system, tuned to feel like a game.

## Tokens
- **Color**: `scripts/m3-tokens.mjs` (no dependencies, `npm run tokens`) writes `src/styles/m3-tokens.css`. Every role is an M3 tone
  (CIE L*) of one of six palettes: primary from the emerald of the seal, tertiary from the gold of the crown (XP, levels,
  rewards), error, neutral and neutral variant. The five ministers, success, warning and the streak's fire are M3 custom
  colors: color, on-color, container, on-container, plus a vivid tone for rings and fills.
- **Type**: Google Sans Flex (OFL), subset to Latin with weight 300–900 and the ROND axis, in `public/fonts`. The M3 type
  scale is `type-display-l` … `type-label-s`; `em` / `em-x` are the emphasized styles (heavier, fully rounded).
  Arabic stays in Reem Kufi and Amiri.
- **Shape**: the M3 corner scale, and the expressive shape library in `src/components/m3/shapes.js` (cookies, sunny, burst,
  flower, clover, gem…). Every shape is the same 72-point curve, so any shape morphs into any other.
- **Motion**: M3 Expressive springs, precomputed as CSS `linear()` easings (`--spring-fast`, `--spring`, `--effect`…).

## Components (`src/components/m3`)
Buttons whose corners morph on press, icon buttons, connected button groups, filter chips, the M3 switch and checkbox,
cards, wavy linear and circular progress, the loading indicator, shapes, Material Symbols Rounded (`icons.js`, from
`scripts/icons.txt`), haptics.

## The game layer
- **HUD** (top app bar): your seal and level, XP to the next level, the streak, the live link to WHOOP.
- **Today** is a quest board: the day's run (XP ring, the five ministers as stats, the perfect-day chest), quest cards that
  show what they pay, what WHOOP and FatSecret track for you, medals within reach.
- **Palace**: the hero card, the road of ranks, streaks, the trophy room, the council.
- **Moments**: +XP chips with a burst of M3 shapes, quest-complete and medal snackbars on gold, the level-up screen.
