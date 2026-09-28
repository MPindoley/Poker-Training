# Felt Academy

A mobile-first poker training PWA for No-Limit Hold'em: odds, equity, ranges, bet sizing and value betting,
built to feel like a mobile game. See `CLAUDE.md` for the full brief.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 plus a Network URL for your phone
npm test           # engine unit tests
npm run build && npm run preview   # production build with offline support
```

### Open it on your phone (same Wi-Fi)
1. Run `npm run dev` on your computer. Vite prints a line like `Network: http://192.168.1.23:5173/`.
2. On the iPhone (same Wi-Fi), open that URL in Safari.
3. If it doesn't load, allow Node through your computer's firewall (macOS: System Settings → Network → Firewall).

Offline mode and the service worker only work on `localhost` or over HTTPS. To install it properly
(home screen + offline), deploy the `dist/` folder to any static HTTPS host (Netlify, Vercel, GitHub Pages,
Cloudflare Pages), open it in Safari, then Share → **Add to Home Screen**.

## Deploy

See [DEPLOY.md](DEPLOY.md) for free hosting on Vercel and installing to an iPhone home screen.

## Postflop solver import (flop strategies)

Train → Postflop → **Postflop solver import** (`/train/postflop/import`) takes flop strategies you export
from a solver. When a drill or a reviewed hand reaches a matching heads-up flop spot, it is graded from
your frequencies instead of the model, and the answer is labelled **Solver data**:

- the most frequent action is **Best**,
- any action played at least 20% of the time (`SOLVER_ACCEPTABLE_FREQ`) is **Acceptable**,
- everything else is a **Mistake**, and the frequencies are shown in the explanation.

A spot is: pot type, positions, stack depth and flop (plus the player to act and the bet they face).
Suit-isomorphic flops are the same spot, so `As7h2c` also covers `Ad7s2h`, `Kc…` boards with the same
suit pattern, and so on; exact combos are relabelled the same way.

**JSON**

```json
{
  "format": "felt-postflop-v1",
  "name": "BTN vs BB single-raised pots",
  "spots": [
    {
      "pot": "srp",
      "positions": "BB-BTN",
      "stack": 100,
      "flop": "As7h2c",
      "actor": "BTN",
      "facing": null,
      "strategy": { "AKo": { "check": …, "bet33": … }, "AhKd": { "bet75": … } }
    }
  ]
}
```

**CSV** (header required, one row per hand and action):

```
pot,positions,stack,flop,actor,facing,hand,action,frequency
srp,BB-BTN,100,As7h2c,BTN,,AKo,bet33,…
srp,BB-BTN,100,As7h2c,BB,33,77,raise3x,…
```

| Field | Meaning |
|---|---|
| `pot` | `srp` (single-raised), `3bet`, or `limped` |
| `positions` | `OOP-IP`: the player who acts first postflop, then the other (e.g. `BB-BTN`) |
| `stack` | effective stack in big blinds (must equal the drill's stack, e.g. 40 or 100) |
| `flop` | three cards, e.g. `As7h2c` |
| `actor` | whose strategy this is (one of the two positions) |
| `facing` | the bet the actor faces, in % of the pot; blank / `null` / `none` when first to act or checked to. Matches within 10 points. |
| `hand` | a class (`AKs`, `QQ`, `T9o`) or an exact combo (`AhKd`); an exact combo wins over its class |
| `action` | `check`, `fold`, `call`, `betNN` (NN = % of pot: `bet33`, `bet75`, `bet150`), `raise` or `raiseNNx` (raise-to as a multiple of the bet) |
| `frequency` | 0–1, 0–100, or `40%` |

Solver bet sizes are mapped onto the nearest size the drill offers. Frequencies that add up to more than
100% are scaled down (with a warning). Every error names the spot or line it came from.

`public/examples/postflop-FORMAT-EXAMPLE.json` and `.csv` show the layout. They are **hand-made format
examples with placeholder numbers, not solver output**, and the app refuses to import them. Only heads-up
flop spots are supported; turn and river strategies and multi-way pots are not.

Preflop solver output has its own importer at Train → Preflop → Solver import (`/train/preflop/import`).

## Confidence and source labels

Every graded postflop, exploit and hand-review answer shows how sure the grade is:

- **Clear**: the best option beats the next by at least 10% of the pot (`CLEAR_MARGIN_POT`) and stays best
  when the spot is re-run with villains looser/tighter and equity realization at the ends of its range.
- **Close spot**: the margin is smaller than that.
- **Depends on reads**: the best action changes under those alternate assumptions (or the c-bet rule and the
  EV estimate disagree).

…and where it comes from: **Solver data** (imported), **Chart (approximation)** (preflop charts) or
**Model estimate** (the villain model). Mistakes in close or read-dependent spots cost half as much XP and
count half in the leak finder (`MISTAKE_WEIGHT` in `src/engine/strategy/confidence.ts`).

Run `npm run audit:strategy` to write `reports/strategy-audit.md`: 200 seeded postflop spots with every
option's EV, grade, confidence and source, for spot-checking the grading.
