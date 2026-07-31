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
    npm test hud      # only suites whose name matches

Four suites, and the list is short on purpose. A test here earns its place by
guarding a SEAM — somewhere the game can break without the rules being wrong —
and nothing else. It never has an opinion about a balance number: what a class
should clear, how deep a wound should run and how much of your bar a boss may
take are the owner's to judge by playing, and a threshold in a test only turns
that judgement into an argument with a machine. Numbers get measured in
`tools/`, where they are printed and nothing concludes anything.

| suite | guards |
|---|---|
| `saveversion` | a save-format bump drops older saves rather than migrating them |
| `build` | the build stamp reaches the title, the log and the save |
| `hud` | the screen never disagrees with the sheet |
| `headless` | a headless run and an on-screen run play the identical game |

The last one is the load-bearing one: every balance number in this repo is
measured through `simulateRun`, so if it ever stopped matching the real game,
every measurement would quietly become fiction.

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
