# Home Game Pack — progress

Branch: `feature/home-game-pack` (based on `claude/felt-academy-scaffold-0z4908`, i.e. PR #2's postflop work).
Resume rule: work the first unchecked box. After each phase: `npm test`, `npm run typecheck`, `npm run build`, then commit.

Baseline (before starting): 462 tests pass, typecheck clean, build OK.

## Phase 1: Home game preflop spots (limpers, squeezes, straddles)
- [x] Engine: spot kinds vsLimpers / squeeze / vsLimpRaise / vs4bet in charts.ts
- [x] Ranges for the new spots in all three chart JSON files (home-40bb most careful), with principle comments
- [x] Sizing: iso and squeeze sizes with reasons (reuse sizing.ts)
- [x] Straddle support (table setting, seat shift, straddler = "big blind" for spot purposes) (engine: preflop/straddle.ts + holdem straddle post/option; Play setting; coach reads straddled seats)
- [x] solverImport: new spot keys, parser, aliases, tests
- [x] reasons.ts: one-line reason for every new answer
- [x] Engine tests (coverage of seats/limper counts, combo counts, iso nesting, squeeze ⊆ 3-bet width, straddle shift, import round-trip)
- [x] Drills preflop.limpers / preflop.squeeze / preflop.vs4bet + trainer screen, routes, skills, daily, warm-up (home weights limpers)
- [x] Range Editor and Paint the Range support new spots
- [x] Play: limping bots (station, efls, gambler); coach uses new charts
- [x] Hand logger preflop grading uses new charts
- [x] Leak finder: overlimping iso hands, iso too small, limp-calling raises
- [x] Learn: limpers lesson example + drill links; new "Squeezing" and "Straddles" lessons; glossary terms

## Phase 2: Logging hands with more than one opponent
- [x] Engine: N-player LoggedHand shape, actor = player id, straddle/limpers context
- [x] Versioned migration + old-record test + backup import of both shapes
- [x] replayAmounts for N players (blinds, straddle, turn order, investment, all-ins, side pots, estimates flagged)
- [x] Per-opponent range narrowing, multiway equity in worker, pot odds, verdicts
- [x] Shown cards: "At the time" vs "What they actually had"
- [x] Decision tags: opponent count, archetype/profile
- [x] Tests: 3/4-way pots, side pots, migration, multiway equity sanity
- [x] App: seat-picker table, profile quick-assign, legal next-actor entry, shown cards, street timeline

## Phase 3: Live table tracker
- [x] Engine src/engine/live: LiveSession, events with undo, computeObservedStats, applySession + tests
- [x] /review/live screen; Start Live Session on Home and Review
- [x] Setup, tracking view (discreet, wake lock, offline), bookmark hand → logger prefill
- [x] End session: cash-out/rebuys → session record; review with before/after profiles and reads; confirm
- [x] Exploit Lab "Player cards"

## Phase 4: Bots that react to table image
- [x] Engine src/engine/image: ImageState, decay, labels, reactivity, modifiers + tests
- [x] botDecision applies image; Home Game preset (Tight and Feared start)
- [x] Image meter (setting), coach mentions image, hand review / session summary notes
- [x] Exploit Lab "Image Shifts" drill pack
- [x] Learn: Table image lesson interactive example

## Phase 5: Range Lab
- [x] /train/lab screen + Train card (keep /debug/equity)
- [x] 2–6 players, hand or range (paint / notation / chart spot / profile)
- [x] Board stepping, dead cards
- [x] Results: equity, buckets, beats/ties/loses list, range & nut advantage, blockers, next-card heat grid
- [x] Guess mode with XP + "equity intuition" in radar
- [x] Save named scenarios; share by URL
- [x] Tests for pure parts

## Phase 6: Confidence and source labels, postflop solver import
- [x] Confidence (clear / close / model-dependent) on postflop, exploit, hand-review grades
- [x] Source labels (Solver data / Chart (approximation) / Model estimate)
- [x] Postflop solver import format (JSON/CSV), suit isomorphism, grading from frequencies, FORMAT EXAMPLE file, README docs
- [x] FeedbackBanner badges; XP and leaks weight by confidence
- [x] Postflop import screen
- [x] `npm run audit:strategy` → reports/strategy-audit.md

## Phase 7: Tie together and check
- [x] Wiring: routes, skills, SRS, daily, quick drill, warm-ups, achievements, profile
- [x] Glossary / lesson links; content tests pass
- [x] CLAUDE.md updated
- [x] Hardcoded-number audit
- [x] 390px screenshots of every new screen
- [x] Final test / typecheck / build; push branch (no merge)

## Decisions
- Branched from the PR #2 branch (postflop section, not yet merged) because the stated 462-test baseline includes it. Merging this branch into main also brings in PR #2's changes.

- New spot data lives in each chart JSON under `vsLimpers`, `squeeze`, `vsLimpRaise`, `vs4bet`, keyed by a seat **group** (`groups`: EP, MP, CO, BTN, SB, BB) so 9-handed seats reuse 6-max data. Limper counts are 1, 2, 3 (3 = 3+); squeeze callers 1, 2 (2 = 2+).
- JSON has no comments, so each chart has a `notes` object with the principle behind every section (shown in the Range Editor).
- vsLimpers actions: `raise` = iso-raise, `limp` = overlimp (complete from the SB). The BB's leftover action is `check`, not fold (`ActionRanges.rest`).
- Limp-raise calls are kept inside the 1-limper overlimp range of the group, so they are valid for every seat in the group (a test enforces it).
- Straddle mapping: each non-blind seat reads as the chart seat with the same number of players left to act (one seat tighter); both real blinds read as SB; the straddler reads as BB; stacks are measured in straddles.

- Loose-passive archetypes (station, EFLS, gambler) now open-limp part of their raising hands too (`OPEN_LIMP_SHARE` in game/bots.ts), so limper spots come up at the Play table.
- Hand logger: a new optional `limpers` field on a logged hand counts limpers who weren't logged as players; preflop spots are classified by the shared `classifyPreflopDecision` (preflop/line.ts), which Phase 2 reuses for N players.

- Logged hands v2: `players[]` (hero flagged, optional profile, name, own stack, shown cards) and `actor` = player id. v1 hands migrate with ids 'hero' / 'villain' (store `version: 2` + `migrate`, and backup import runs the same migration via `storage/migrations.ts`).
- Multi-way hand analysis: each opponent's preflop range comes from their own actions (charts, or VPIP/PFR ranges for tagged profiles), narrowed postflop with their own model; hero is graded against everyone still in (the analyser takes a model per villain). Side pots only show once someone is all-in.
- The logger only needs the players who were involved; players who folded without investing can be skipped. "Other limpers" adds unlogged limpers to the preflop context.

- Live tracker: VPIP/PFR use hands dealt while seated as the denominator; fold-to stats use folds ÷ (folds + calls [+ raises]); WTSD uses hands played (we don't track who saw the flop) and aggression uses (raises + 3-bets + c-bet raises) ÷ (limps + calls). Both are labelled approximations in code. A player with no taps is treated as untracked (no observations). Stats move by their own sample size (n / (n + 20)); under 10 samples are marked low-confidence. Profiles now store per-stat sample counts (optional field, no migration needed).
- The live screen is discreet: dark low-glare surfaces, button sounds off, and level-up/achievement celebrations are held until you leave it. A new `live` store is included in backups.

- Table image (src/engine/image): moving averages over ~30 hands (VPIP, aggression, pots won) plus decaying counts of big hands and weak winners shown; a shown bluff makes you Wild for 12 hands; 12 folds in a row reads Card Dead. Only what the table can see counts (bluffs that win without showdown are invisible).
- Image changes opponents through a per-street "stickiness" s: continue chance p → p^(1/s) (stays in 0..1, a monster never folds). Tight and Feared = fold more preflop/flop, stickier turn/river. Reactivity scales the shift (0 = none); archetype defaults: station 0.3, maniac 0.5, gambler 0.6, TAG 1, EFLS 1.2, nit 1.5. All in `IMAGE_STICKINESS` / `ARCHETYPE_REACTIVITY` — assumptions, not solver data.
- Bots apply image only when responding to hero's bet (or betting into hero); the coach and range narrowing use the same imaged models so advice matches what the bots do.
- Play setup gains "Table image meter" (on by default) and "Hard mode" (no coach, no meter). Table config isn't persisted, so no migration. `HandReview.imageShift` is a new optional field in saved Play sessions (older records simply lack it).

- Range Lab (/train/lab): pure engine in src/engine/lab (runLab, nextCardGrid, bucketBreakdown, showdownVsRange, blockerEffect, chartRangeOptions, encode/decodeScenario); runs in the engine worker. Player 1 is "you". Range/nut advantage is shown when players 1 and 2 are both ranges (nut advantage = share of each range in the monster bucket). "What beats you" compares made hands right now; equity covers the run-outs.
- The next-card explorer uses Monte Carlo (6,000 run-outs per card) for speed; best/worst lists quote those numbers.
- A 6th radar area, "Equity Intuition", counts Range Lab guesses (`lab.guess`, Best within 5 points, Acceptable within 10) and a new multiple-choice drill "Equity Eye" (`equity.guess`: your hand vs a real opening range on a random flop), which sessions, warm-ups and Daily Training use. Warm-up shares were rebalanced to make room (10% each venue). New `lab` store (saved scenarios, guess history) is included in backups; it's new, so no migration.

- Confidence (src/engine/strategy/confidence.ts): Clear = best beats runner-up by ≥ 10% of the pot (`CLEAR_MARGIN_POT`) and survives the re-runs; Close = smaller margin; Depends on reads = the best action (action + size class) changes when re-analysed with villains looser (stickiness 1.25) + full realization, or tighter (0.8) + low realization (IP 0.9 / OOP 0.8), or the c-bet rule and EV estimate disagree. Two extra `analyzeSpot` runs ≈ 3× cost (~130 ms per drill question). Preflop: Clear when the chart plays the hand one way ≥ 75% (`PREFLOP_CLEAR_FREQ`), else Close.
- Source labels: preflop = "Chart (approximation)" unless the spot's ranges came from a solver import (tracked per override key via `Chart.sourceOf`); postflop/exploit/review = "Model estimate" unless a flop spot matches imported postflop data ("Solver data").
- Mistakes in Close / Depends-on-reads spots count half (`MISTAKE_WEIGHT`): XP moves halfway from Mistake to Acceptable, and leaks rank by weighted cost (`weightedCost`, `severity`).
- Postflop solver import: format `felt-postflop-v1` (JSON or CSV; documented in README). Suit isomorphism: canonical flop = lexicographically smallest relabelling over all 24 suit permutations; exact combos use the smallest relabelling among the flop's minimising permutations, so every equivalent (flop, combo) pair maps to one key. Solver bet sizes map to the nearest size the drill offers. Heads-up flop spots only. New store `postflop-solver` (in backups; new, so no migration). The FORMAT EXAMPLE files carry `"example": true` and the importer refuses them.
- `npm run audit:strategy` loads the TypeScript engine through Vite's SSR loader (no new dependency) and writes reports/strategy-audit.md.

## Open questions for Matt
- Home-game limper / squeeze / 4-bet ranges (src/data/ranges/home-40bb.json) are my best judgment for a loose-passive 40bb game. Please sanity-check especially: iso ranges vs 1 limper from the button (44+, A7s+, …) and the value-only squeeze ranges.
- Table image sizes (how much tighter/looser people get and how long a shown bluff is remembered) are my guesses about live home games. Tune `IMAGE_STICKINESS`, `BLUFF_MEMORY_HANDS` and `ARCHETYPE_REACTIVITY` in src/engine/image/image.ts if they feel off at your table.
- Postflop solver import: I don't know the exact export formats of commercial solvers (PioSOLVER, GTO Wizard, etc.), so I designed a simple documented format (README) instead of guessing theirs. If you tell me which solver you use and share a sample export, a converter can be added.
- The preflop Solver Import screen (older, from before this pack) has "CSV example" / "JSON example" buttons that fill in placeholder frequencies (e.g. A5s 50%). They're only format examples, but if you apply one, those spots get labelled "Solver data". Should I remove the buttons or make them un-importable like the postflop examples?

## Final report

### 1. What was built

**Phase 1: home-game preflop.** The charts now cover the spots home games are made of:
- facing 1, 2 or 3+ limpers (iso-raise, overlimp, or complete from the small blind),
- squeezing after an open and callers,
- facing a raise after you limped,
- facing a 4-bet.

Each has its own drill (Limpers, Squeeze, Facing 4-bets). There are sizing rules for iso-raises and squeezes, and every answer comes with a one-line reason.

Straddles work at the Play table and in the hand logger: seats read one position tighter, and stacks are measured in straddles.

This preflop work is wired into:
- the Range Editor and Paint the Range,
- the Play bots (loose players now limp) and the coach,
- the hand logger and the leak finder (three new leaks),
- three new lessons, and new glossary terms.

**Phase 2: hands with several opponents.** The hand logger records any number of opponents, each with their own stack, profile and shown cards. It knows the turn order (including the straddle), all-ins and side pots.

Analysis narrows each opponent's range separately and grades you against everyone still in the hand. It also shows "at the time" (against their ranges) next to "what they actually had". Old saved hands migrate automatically, including in backups.

**Phase 3: live table tracker.** At `/review/live`, you tap VPIP, raises, c-bets, folds and showdowns for each player during a real game. It has:
- undo,
- a dark, discreet screen that keeps the phone awake and works offline,
- a bookmark for any hand, which opens the logger later with the details already filled in.

When you end a session, it saves your cash-out and updates each player's profile, weighted by sample size. The Exploit Lab gains "Player cards" with the top reads per player.

**Phase 4: bots react to your table image.** The table sees what you show it: how many pots you play, how often you bet, big hands and bluffs shown at showdown, and long folding streaks. Your image is one of Tight and Feared, Solid, Loose, Wild / Bluffer or Card Dead, and it fades over about 30 hands.

Each bot's reactivity scales how it responds to your bets:
- Tight and Feared: they fold more early, but are stickier on the turn and river.
- Wild: they call much wider.

The Home Game preset starts you as Tight and Feared. Play options add an image meter, plus a hard mode that hides the meter and the coach. The coach adds a one-line image tip, and the hand review and session summary note when your image changes. There is a new Exploit Lab pack, "Image Shifts", and the Table image lesson has an interactive example.

**Phase 5: Range Lab** (`/train/lab`, the top card on Train).
- **Setup:** 2–6 players, each a hand or a range. A range can be typed, painted, or taken from any chart spot or player profile. The board steps through flop, turn and river, and dead cards are optional.
- **Results, computed in the worker:**
  - equity, win % and tie %,
  - how each range splits into hand buckets,
  - what beats you, as a tappable list,
  - blockers, with combo counts before and after,
  - range and nut advantage in one plain sentence,
  - a 52-card next-card heat grid with the best and worst cards.
- **Guess mode:** guess your equity first to earn XP. It feeds a new sixth radar area, **Equity Intuition**, together with a new multiple-choice drill, **Equity Eye**, which sessions and Daily Training use.
- **Saving:** scenarios can be saved by name and shared as links.

**Phase 6: how sure each grade is.**
- **Confidence:** every graded postflop, exploit and review decision is labelled **Clear**, **Close spot** or **Depends on reads**. "Depends on reads" means the best play changes when villains are made a bit looser or tighter, or when equity realization moves to the ends of its range. Preflop answers get Clear or Close, based on how mixed the chart is.
- **Source:** every answer says where it comes from: **Solver data**, **Chart (approximation)** or **Model estimate**.
- **Weighting:** a mistake in a close or read-dependent spot costs half as much XP and counts half in the leak finder.
- **Postflop solver import** (`/train/postflop/import`):
  - a documented JSON/CSV format (see README),
  - suit-isomorphic flops are treated as the same spot,
  - matching drill and review spots are graded from the imported frequencies,
  - hand-made FORMAT EXAMPLE files that the importer refuses.
- **Audit:** `npm run audit:strategy` writes a 200-spot grading report to `reports/strategy-audit.md`.

**Phase 7: tying it together.**
- Wiring: every new drill kind is in routes, the skill map, spaced repetition (through its skill keys), Daily Training, Quick Drill and both warm-ups.
- New achievements: Iso King, Scout and Equity Eye.
- The Profile screen has quick stats that link to the new tools.
- New glossary terms (Table image, Solver, Suit isomorphism) and Range Lab links from three lessons.
- CLAUDE.md is updated.
- The hardcoded-number audit fixed three "2bb" straddle labels.
- Screenshots of all 22 new or changed screens at 390×844: no console errors and no horizontal scrolling.

Tests went from 462 to 616. Typecheck and build are clean.

### 2. Approximations and judgment calls (and where to change them)

| What | Where |
|---|---|
| Home-game limper, squeeze, limp-raise and 4-bet ranges | `src/data/ranges/*.json` (see each file's `notes`) |
| Iso and squeeze sizes | `src/engine/preflop/sizing.ts` |
| Straddle seat mapping | `src/engine/preflop/straddle.ts` |
| How often loose bots open-limp | `OPEN_LIMP_SHARE` in `src/engine/game/bots.ts` |
| Leak thresholds | `src/engine/review/leaks.ts` (`ISO_SMALL_MARGIN_BB`) |
| Live-tracker stat definitions (WTSD uses hands played; aggression uses raises ÷ calls) | `src/engine/live/session.ts` |
| Profile update speed (n / (n + 20)) and the 10-sample confidence mark | `src/engine/live/session.ts`, `exploit/profiles.ts` |
| Table image window, thresholds, shifts per street, bot reactivity | `src/engine/image/image.ts` (`IMAGE_WINDOW_HANDS`, `IMAGE_THRESHOLDS`, `IMAGE_STICKINESS`, `ARCHETYPE_REACTIVITY`, `BLUFF_MEMORY_HANDS`, `CARD_DEAD_HANDS`) |
| Confidence margin and alternate assumptions | `src/engine/strategy/confidence.ts` (`CLEAR_MARGIN_POT`, `ALTERNATES`, `MISTAKE_WEIGHT`) |
| Preflop "clear" threshold | `PREFLOP_CLEAR_FREQ` in `src/engine/preflop/drills.ts` |
| Solver grading thresholds | `src/engine/postflop/solverImport.ts` (`SOLVER_ACCEPTABLE_FREQ`, `SOLVER_CLEAR_FREQ`, `FACING_MATCH_TOLERANCE`) |
| Guess-mode bands | `src/engine/lab/lab.ts` (`EQUITY_GUESS_BEST`, `EQUITY_GUESS_OK`) |
| Next-card explorer accuracy (Monte Carlo, 6,000 run-outs per card) | `src/engine/lab/lab.ts` (`nextCardGrid`) |
| Warm-up time shares, including the new Equity Intuition area | `src/engine/meta/sessions.ts` (`WARMUP_SHARES`) |

All postflop grades are still one-street model estimates (`villainModel.ts` + `rules.ts`). No solver numbers were invented anywhere.

### 3. Open questions for Matt

See "Open questions for Matt" above:
- home-game ranges to sanity-check,
- table-image strength,
- which solver you use (so a real converter can be added),
- whether to remove the preflop importer's placeholder example buttons.

### 4. What looks questionable in the strategy audit (`reports/strategy-audit.md`)

- **C-bets are never "Clear".** In 14 of 23 c-bet spots, the c-bet rule's Best and the one-street EV estimate disagree. The EV estimate almost always prefers a bigger bet than the rule. Those spots are labelled "Depends on reads", which is honest, but it means c-bet grades rest on the rules in `rules.ts`, not the EV.
  - The one-street EV ignores later streets and range protection, so I'd trust the rule.
  - Imported solver data would settle it.
- **About 39% of spots are "Close".** The top options are often within 10% of the pot. Mistake grades there, whose tolerance is 4% of the pot, are now softened. You may want a wider `evTolerance` if close-spot mistakes feel harsh.
- **"Monster" is a category, not relative strength.** The audit flagged river spots where Best is Check with two pair or better, for example AK with two pair on K-4-5-A-2 facing a possible wheel (62% equity; check beat a half-pot bet by only about 1bb).
  - Multi-way examples had a straight with 29% equity on a paired, three-flush board.
  - These grades are defensible from the equity, but the "Your hand: Monster" label can read oddly. Consider relabelling by equity on scary boards.
- **Facing-bet spots are almost all Clear** (19 of 22), and none depends on reads. That is plausible, because pot odds dominate those decisions.

### 5. How to try it and how to merge

- **Branch:** `feature/home-game-pack`, pushed to GitHub as draft PR 3. Vercel preview: https://poker-training-git-feature-home-game-pack-mpindoleys-projects.vercel.app
- **Locally:** `git checkout feature/home-game-pack && npm install && npm run dev`, then open the printed LAN address on your phone. `npm test`, `npm run typecheck` and `npm run audit:strategy` also work.
- **Base:** the branch was built on top of PR #2 (the bigger postflop section), so merging it also brings in PR #2.
  - Simplest path: merge PR #2 first, then the Home Game Pack pull request. It shows only this pack once PR #2 is in.
  - Alternatively, merge the Home Game Pack pull request straight into `main`; that includes both.
- **To merge:** open the draft pull request on GitHub → "Ready for review" → "Merge". From the command line: `git checkout main && git merge --no-ff feature/home-game-pack && git push`.
- **After merging:** Vercel deploys `main` to https://poker-training-xi.vercel.app/. On your iPhone, reopen the home-screen app once to pick up the update.
