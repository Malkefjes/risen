# RISEN

A turn-based roguelite. You are Sonny, a lucid mutant hunted through fifteen
waves of containment. Pick a strain — or refuse the infection entirely — and
see how far the run goes.

## The game

`risen.html` — one self-contained file. No build step, no dependencies, no
server. Open it in a browser and it runs; the sprites are embedded.

Everything else in this repo exists only to test and measure that one file.

## Tests

    npm run setup     # once: installs playwright + chromium
    npm test          # all suites
    npm test strain   # only suites whose name matches

The suites drive the real game in a headless browser and click real buttons.
Each one encodes a bug that actually happened, so a failure names the
behaviour that regressed rather than an internal detail:

| suite | guards |
|---|---|
| `saves` | run state resets between runs; two save slots stay independent |
| `strain` | a new run starts as the strain you picked |
| `saveversion` | a save-format bump drops older saves rather than migrating them |
| `mutations` | the mutation system works while its content pool is empty |
| `refinements` | refinements stay removed, and drafting still works without them |
| `build` | the build stamp reaches the title, the log and the save |

## Tools

`tools/` holds read-only instruments that print numbers instead of asserting
them — see `tools/README.md`. They are slow, because they drive the real game
through a browser one turn at a time.
