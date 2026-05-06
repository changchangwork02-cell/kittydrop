# KITTY DROP

One-button endless arcade game. Dodge the falling cats.

## How to play

| Input | Action |
|---|---|
| **Click / Tap / Space / Enter / Arrow keys** | Flip between floor and ceiling |

Survive as long as possible. One hit = game over.

## Scoring

| Event | Points |
|---|---|
| Surviving each second | +1 |
| Each cat dodged cleanly | +5 |
| Every 10-second milestone | +10 |

High score is saved in `localStorage` and persists between sessions.

## Difficulty

Cats spawn more frequently over time:

| Time | Spawn interval |
|---|---|
| 0 – 10 s | every 2.5 s |
| 10 – 25 s | every 1.8 s |
| 25 – 45 s | every 1.2 s |
| 45 – 60 s | every 0.8 s |
| 60 s+ | every 0.5 s (cap) |

After 20 seconds, cats can also spawn at the ceiling.

## Running locally

Open `index.html` directly in any modern browser — no build step, no dependencies, no external assets.

```
open index.html
```

Or serve with any static server:

```
npx serve .
python3 -m http.server
```

## Files

```
index.html   — game shell
style.css    — centering and canvas scaling
script.js    — all game logic (~330 lines)
README.md    — this file
```

Based on the Kitty Drop GDD v2.
