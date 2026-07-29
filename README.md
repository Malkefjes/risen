# RISEN

A turn-based roguelite. You are Sonny, a lucid mutant hunted through fifteen
waves of containment. Pick a strain — or refuse the infection entirely — and
see how far the run goes.

## The game

`index.html` plus `css/`, `js/` and `assets/` — plain files, no build step, no
dependencies. Serve the directory (or play the published GitHub Pages URL) and
it runs. The js files are ordinary scripts sharing one global scope, loaded in
order; they are chapters of one program, not modules.

Everything else in this repo exists only to test and measure the game.

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

## Measuring

The game can run itself with no DOM and no timers — `simulateRun(classId, opts)`
plays a whole run in about two milliseconds. It is not a second implementation:
every rule runs exactly as it does on screen, and `npm test headless` proves it
by seeding the RNG and requiring a headless run and an on-screen run of the same
fight to agree exactly.

    simulateRun('psy')                          one run, greedy bot
    simulateRun('sym', { keepLog: true })       ...and its transcript
    simulateRun('bio', { allocate: () => 'vit' })

`tools/` holds instruments built on it — see `tools/README.md`.
