# Felt Academy — project brief for Claude

## Goal
Felt Academy is a poker training app for **No-Limit Texas Hold'em**. The player plays live home games
($20 buy-ins, ~**40 big blinds** deep) and sometimes casinos (~**100 big blinds** deep). They want to master
the statistical side of poker (odds, equity, ranges, bet sizing, value betting) so at the table they can
focus on reading people.

Target: the most thorough, accurate and fun poker trainer to use **on a phone**. It must feel like a
polished mobile game, not a textbook.

## Tech stack
- React + TypeScript + Vite, Tailwind CSS v4 (`@tailwindcss/vite`, theme tokens in `src/index.css`),
  Framer Motion for animation, Zustand for state, React Router for screens.
- Progressive Web App via `vite-plugin-pwa`: installable to the iPhone home screen, works offline.
  Fonts are bundled with `@fontsource` (no network needed).
- All progress is saved **on-device** in IndexedDB through the small wrapper in `src/storage/db.ts`
  (Zustand `persist` uses `idbStateStorage`). No backend.
- Vitest for unit tests (`npm test`). Type-check with `npm run typecheck`.
- **Pure poker logic lives in `src/engine` with zero React imports** so it can be tested in isolation.
  Every engine module gets a `*.test.ts` beside it.
- Mobile-first: design for a **390px-wide portrait** screen (app column is capped at 430px).
  Primary controls sit at the bottom, within thumb reach. Respect iOS safe areas (`pt-safe`, `pb-safe`).

## Visual style (original art only)
- Feel of a top mobile strategy game: chunky, glossy, bright, rewarding.
- Thick dark outlines (`border-ink`, 3px) on buttons and panels, soft top highlights (`.gloss`),
  bold drop shadows (`shadow-chunky`), rounded corners.
- Big bouncy buttons that squash when tapped, springy transitions, confetti and coin bursts on wins
  (`Celebration`), gentle shake on mistakes.
- Rich felt-green table, warm wood rails (`.wood-grain`), gold accents, saturated suit and chip colours.
- Fonts: **Lilita One** (`font-display`) for headings and numbers; **Nunito** (`font-body`) for text.
- **All illustrations, icons and characters must be original.** Never copy characters, logos or assets
  from any existing game. Suit glyphs are custom SVG (`SuitIcon`) so iOS never renders them as emoji.

## Design system (`src/components/ui`)
Reuse these; extend them rather than restyling ad hoc. All are shown on the `/styleguide` screen.
- `GameButton` — colours green/gold/blue/red/purple/cream, sizes sm/md/lg, squash on tap.
- `Panel` — tones cream/wood/felt/night, optional gold ribbon title.
- `CardView` — playing card; honours the saved 4-colour deck setting (or `fourColor` prop).
- `ChipStack` — exact amount label + greedy chip breakdown from `engine/chips`.
- `ProgressBar`, `XPBadge` — level/XP from `engine/progression`.
- `RangeGrid` — 13x13 hand matrix, tap/drag to paint; stats from `engine/hands`.
- `FeedbackBanner` (grade + why + worked math) and `ToastHost` / `toast()` for transient messages.
- `Celebration` — confetti + coins burst.
- `Toggle` — on/off switch for settings.
- `ActionDock` — sticky bottom bar for a screen's current actions so they never need a scroll
  (`tabs` lifts it above the tab bar). Put answer choices, Next, Run and Save buttons in it.

## Engine map (`src/engine`)
- `cards` (Card, parse, integer indices 0..51 = rank*4+suit), `rng` (seedable Mulberry32, shuffle).
- `evaluator` — 5/6/7-card evaluator; `evaluateIndices` is the fast path (comparable int score),
  `evaluateHand` adds category, best five cards and a description.
- `range` — weighted 1326-combo ranges: `parseRange` notation, card removal, grid and notation conversion.
- `equity` — `calculateEquity(players, { board, dead, iterations, seed })`: exact enumeration up to
  `maxExactBoards`, else Monte Carlo with a 95% margin. UI must call it via `src/workers/equityClient`
  (`runEquity`) so it runs in a Web Worker.
- `outs` (clean/dirty outs vs a range), `texture` (board classifier + `rangeAdvantage`),
  `odds` (pot odds, MDF, bluff breakeven, EV, implied odds, SPR).
- `strategy/villainModel` — fold / call / raise model per hand bucket (`actionProbs`; raises include
  check-raises). Bots, the coach and every postflop trainer use it. Bet sizes are read as
  call ÷ pot-before (`betFractionFacing`). `strategy/analyze` scores each option, including being raised.
- `postflop` — spot generator (heads-up to 4-way, barrel lines, facing a bet after callers, facing a
  check-raise), `turnCard` (what a new card changed), drill packs incl. check-raises, turn, river, multi-way.
- `preflop/solverImport` — JSON/CSV solver output → chart overrides (`/train/preflop/import`); imported
  spots replace the built-in charts everywhere (drills, coach, Play). `Chart.sourceOf(path)` says whether a
  spot's ranges came from an import (source label "Solver data") or the chart.
- `preflop` home-game spots: `vsLimpers` (iso-raise / overlimp by 1, 2, 3+ limpers), `squeeze` (1 / 2+ callers),
  `vsLimpRaise`, `vs4bet`, keyed by seat group in each chart JSON (with a `notes` object explaining each
  section); `sizing` (`isoSize`, `squeezeSize`), `straddle` (`straddleView`: seats read one tighter, stack in
  straddles), `line` (`classifyPreflopDecision`).
- `review/handLog` — logged hands v2: `players[]` (hero + any number of opponents, optional profile),
  `replayAmounts` (turn order, straddle, all-ins, side pots), `analyzeLoggedHand` (per-opponent ranges and
  models, multi-way equity, "what they actually had"). Old v1 hands migrate (`migrateLoggedHand`).
- `live/session` — live table tracker: tap events with undo, `computeObservedStats` (sample sizes,
  `CONFIDENT_SAMPLES`), `applySession` (moves profiles by n/(n+20)), `liveRead`.
- `image` — hero's table image (moving averages over ~30 hands, shown bluffs, fold streaks) → label
  (Tight and Feared, Solid, Loose, Wild, Card Dead); `applyImage` shifts a bot's model per street by
  `IMAGE_STICKINESS` × its `imageReactivity` (0 = none). `imageEventsFromHand` reads only what the table saw.
- `lab` — Range Lab: `runLab` (equity, bucket breakdowns, what beats you, blockers, range/nut advantage),
  `nextCardGrid`, `chartRangeOptions`, share links (`encodeScenario` / `decodeScenario`), guess grading;
  `lab/drills` = Equity Eye multiple-choice drill (`equity.guess`).
- `strategy/confidence` — Clear / Close spot / Depends on reads (`CLEAR_MARGIN_POT`, `ALTERNATES` re-runs via
  `analyzeSpot(..., { confidence: true })`), source labels (Solver data / Chart (approximation) / Model
  estimate), `MISTAKE_WEIGHT` (XP and leak weighting).
- `postflop/solverImport` — `felt-postflop-v1` flop strategies (JSON/CSV, documented in README), suit
  isomorphism (`canonicalFlop`, `canonicalHand`), `lookupSolverSpot`, `applySolverGrades` (Best = most
  frequent, Acceptable ≥ `SOLVER_ACCEPTABLE_FREQ`). `public/examples/postflop-FORMAT-EXAMPLE.*` are hand-made
  layout examples (`"example": true`) that the importer refuses.

## Progression (`src/engine/meta`, pure)
- `skills` (6 radar areas incl. Equity Intuition; each drill kind maps to one; smoothed accuracy), `xp` (answer XP × difficulty,
  round accuracy bonus), `arenas` (level-gated, each unlocks a table theme), `cosmetics` (card backs, felts,
  chip sets, themes; rarities common/rare/epic/mythic with `CHEST_ODDS`; `openChest` falls back to a lower
  rarity when a tier is fully owned; `resolveLoadout`), `daily` (3 tasks from the weakest areas, seeded by day),
  `sessions` (Quick Drill / Warm-Up plans), `achievements` (pure checks over a snapshot).
- State: `rewardsStore` (cosmetics, chests, achievements, daily counts), `eventsStore` (level-up queue).
  `ProgressionHost` (mounted in App) turns milestones into chests and celebrations; it waits for
  `useProgressHydrated()` so it never acts on empty pre-IndexedDB state. Other stores: `labStore` (saved
  Range Lab scenarios, guess history), `liveStore` (live tracker), `postflopSolverStore` (flop imports).
  Achievements include Iso King, Scout and Equity Eye.
- Rewards are cosmetic only. Sounds are synthesised (`lib/sound.ts`), haptics in `lib/haptics.ts`;
  `GameButton` clicks and `FeedbackBanner` grades play them automatically.

## App structure (bottom tab bar)
- **Home** (`/`): level, arena, streak, Daily Training (3 tasks), chests, Quick Drill / Pre-Game Warm-Up /
  Log Last Night's Hands.
- **Train** (`/train`): Range Lab card (`/train/lab`, share links carry the spot in the query; `?guess=1`
  opens guess mode) and trainer modules — Math (incl. Equity Eye), Preflop (incl. limpers / squeeze / 4-bets,
  solver import), Postflop (incl. `/train/postflop/import`), Exploit Lab (incl. Image Shifts pack and
  `/train/exploit/cards` player cards).
- **Play** (`/play`): simulated table vs bots with a coach. Options: Home Game preset (starts you Tight and
  Feared), UTG straddle, table-image meter, hard mode (no coach, no meter).
- **Review** (`/review`): log real hands (any number of opponents) and sessions, see leaks; live table tracker
  at `/review/live` (immersive: no tab bar, celebrations held until you leave).
- **Learn** (`/learn`): lessons and glossary.
- `/profile`: skill radar, arenas, achievements, cosmetics locker, settings (linked from Home).
- `/train/session?type=quick|warmup&venue=home|casino`: mixed sessions built from existing drills.
- `/styleguide`: design-system showcase (linked from Home, no tab).
- `/debug/equity`: hidden equity sanity-check screen (no link anywhere).

## Accuracy rules (non-negotiable)
1. **Every number shown to the player must come from computation in `src/engine`**, never hardcoded
   guesses — including example numbers in copy, explanations and the styleguide.
2. **Every trainer answer must include a short explanation of WHY, with the math shown**
   (use `FeedbackBanner`'s `math` lines, e.g. `potOdds().working`).
3. Where strategy is a judgment call, grade answers as **Best / Acceptable / Mistake**
   (`engine/grading.ts`) instead of pretending there is one right answer.
4. Engine functions need unit tests that check against independently known values
   (e.g. 1326 starting combos, 9-outer on the flop = 1 − C(38,2)/C(47,2)).

## Commands
- `npm run dev` — dev server on the LAN (port 5173) for testing on a phone.
- `npm run build` / `npm run preview` — production build with service worker (port 4173).
- `npm test` — Vitest (includes a 50-spot exact-vs-Monte-Carlo equity cross-check). `npm run audit:strategy` —
  200-spot postflop grading report. `npm run test:coverage` —
  engine coverage. `npm run typecheck` — TypeScript.
- Deploy: see `DEPLOY.md` (Vercel, `vercel.json` has SPA rewrites; iPhone Add to Home Screen steps).
- `node scripts/make-icons.mjs` — regenerate PNG app icons from `public/icon-source.svg`
  (needs Chromium; set `CHROMIUM=/path/to/chromium`).

## Gotchas
- Don't set `initial={false}` on the route-level `AnimatePresence` in `App.tsx`: it propagates to every
  descendant and silently disables all mount animations (confetti, dealt cards, toasts).
- Tap targets must be ≥ 44px (`GameButton` sm is 44px tall; `ChipGroup` chips have `min-w-11`).
- Service workers only register on `localhost` or HTTPS, so offline mode can't be tested over plain LAN HTTP.
- Persisted shapes are versioned: bump the store `version`, add a migrator in `src/storage/migrations.ts`
  (`STORE_VERSIONS` / `MIGRATORS`, also used by backup import) and a test that migrates an old record. New
  stores must be added to `STORE_KEYS` in `storage/backup.ts` and to `APP_STORES` in `state/progression.ts`.
- `analyzeSpot` with `confidence: true` costs ~3× (two alternate re-runs); keep it off in hot loops that
  don't show grades.
- Engine code must not import from `src/content` (tests for content links live in `src/content`).
- `npm run audit:strategy` loads the engine through Vite's SSR loader (`scripts/audit-strategy.mjs`) and
  writes `reports/strategy-audit.md`.
