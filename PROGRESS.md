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
- [ ] Engine src/engine/live: LiveSession, events with undo, computeObservedStats, applySession + tests
- [ ] /review/live screen; Start Live Session on Home and Review
- [ ] Setup, tracking view (discreet, wake lock, offline), bookmark hand → logger prefill
- [ ] End session: cash-out/rebuys → session record; review with before/after profiles and reads; confirm
- [ ] Exploit Lab "Player cards"

## Phase 4: Bots that react to table image
- [ ] Engine src/engine/image: ImageState, decay, labels, reactivity, modifiers + tests
- [ ] botDecision applies image; Home Game preset (Tight and Feared start)
- [ ] Image meter (setting), coach mentions image, hand review / session summary notes
- [ ] Exploit Lab "Image Shifts" drill pack
- [ ] Learn: Table image lesson interactive example

## Phase 5: Range Lab
- [ ] /train/lab screen + Train card (keep /debug/equity)
- [ ] 2–6 players, hand or range (paint / notation / chart spot / profile)
- [ ] Board stepping, dead cards
- [ ] Results: equity, buckets, beats/ties/loses list, range & nut advantage, blockers, next-card heat grid
- [ ] Guess mode with XP + "equity intuition" in radar
- [ ] Save named scenarios; share by URL
- [ ] Tests for pure parts

## Phase 6: Confidence and source labels, postflop solver import
- [ ] Confidence (clear / close / model-dependent) on postflop, exploit, hand-review grades
- [ ] Source labels (Solver data / Chart (approximation) / Model estimate)
- [ ] Postflop solver import format (JSON/CSV), suit isomorphism, grading from frequencies, FORMAT EXAMPLE file, README docs
- [ ] FeedbackBanner badges; XP and leaks weight by confidence
- [ ] Postflop import screen
- [ ] `npm run audit:strategy` → reports/strategy-audit.md

## Phase 7: Tie together and check
- [ ] Wiring: routes, skills, SRS, daily, quick drill, warm-ups, achievements, profile
- [ ] Glossary / lesson links; content tests pass
- [ ] CLAUDE.md updated
- [ ] Hardcoded-number audit
- [ ] 390px screenshots of every new screen
- [ ] Final test / typecheck / build; push branch (no merge)

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

## Open questions for Matt
- Home-game limper / squeeze / 4-bet ranges (src/data/ranges/home-40bb.json) are my best judgment for a loose-passive 40bb game. Please sanity-check especially: iso ranges vs 1 limper from the button (44+, A7s+, …) and the value-only squeeze ranges.

## Final report
(written at the end)
