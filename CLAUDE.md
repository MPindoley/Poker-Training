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

## App structure (bottom tab bar)
- **Home** (`/`): daily drills, streak, level, quick-start buttons.
- **Train** (`/train`): trainer modules — Math, Preflop, Postflop, Exploit Lab.
- **Play** (`/play`): simulated table vs bots with a coach.
- **Review** (`/review`): log real hands and sessions, see leaks.
- **Learn** (`/learn`): lessons and glossary.
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
- `npm test` — Vitest. `npm run typecheck` — TypeScript.
- `node scripts/make-icons.mjs` — regenerate PNG app icons from `public/icon-source.svg`
  (needs Chromium; set `CHROMIUM=/path/to/chromium`).

## Gotchas
- Don't set `initial={false}` on the route-level `AnimatePresence` in `App.tsx`: it propagates to every
  descendant and silently disables all mount animations (confetti, dealt cards, toasts).
- Service workers only register on `localhost` or HTTPS, so offline mode can't be tested over plain LAN HTTP.
