# RISEN — project conventions

A turn-based browser roguelite. Personal project, built for enjoyment.

## How this project works

- **The owner plays the game and gives feedback. They never read code** and
  don't care about repo internals. Translate feel into mechanics yourself;
  never ask them to look at a diff, a file, or a stack trace.
- **Design by feel, not by plan.** There is deliberately no roadmap. Don't
  create planning documents; don't accumulate TODO lists in the repo. The
  owner decides what's next by playing.
- **The game is silent by choice.** The owner plays without sound (a
  neurological condition makes noise a burden). Don't add or propose audio;
  spend the juice budget on visuals instead. Revisit only if the owner
  raises it themselves.
- **Floater colors are a fixed vocabulary** — color names the event, never
  the class: dealt damage white, taken damage red, crits gold, XP amber,
  notes muted gray. Green is nature's alone: healing (+) and poison (−) share
  it, the sign carrying the meaning. See the comment above `.float-dmg` in
  `css/risen.css` before adding a floater type.
- **Scale verification to the change — do not run the full suite for small
  stuff.** CI runs everything on every push, so a cosmetic tweak or a keybind
  ships on a syntax check and CI catches the rest. Run suites locally only
  when the change touches what they guard (rules, saves, balance, the sim),
  and prefer `npm test <name>` for one suite over the whole run. Suggest a
  full local run only when it's genuinely advisable; the owner accepts
  finding the occasional break by playing.
- **Tests come in two speeds, pick by what broke historically.** Browser
  suites (clicking real buttons) guard UI seams — every early bug was a gap
  between the rules and the screen. Pure-rules behaviour (statuses, skills,
  banks, damage math) should instead get fast suites through `simulateRun`:
  hundreds of assertions in seconds, no browser. Don't unit-test private
  internals in either style; drive the game through its real surfaces.
- **The balance header's rules are defaults with named levers, not laws.**
  "Strains share one baseline", "damage is linear in Strength" bind the
  BASE sheet so feel stays judgeable — but talents and mutations may
  deliberately break them; assembled, broken-feeling combos are where the
  fun lives. Break loudly (a visible pick doing a visible thing), never by
  accident of stacking, and update the header comment when a default moves.

## Layout

- `index.html` + `css/` + `js/` + `assets/` — the game. No build step. The
  js files are ordinary scripts sharing one global scope, loaded in order
  (data → stats → screens → sim → combat → saves → render → sprites); they
  are chapters of one program, not modules. Keep new code in the chapter
  where it belongs; keep load order in mind for top-level statements.
- `tests/` — playwright suites driving the real game (`npm test`). One
  dependency (playwright). `RISEN_CHROMIUM=<path>` points the suite at a
  pre-installed browser; in this remote environment use
  `RISEN_CHROMIUM=/opt/pw-browsers/chromium`.
- `tools/` — read-only balance instruments built on `simulateRun`
  (bank-usage, balance-sweep, transcript). They print numbers, not verdicts.

## Invariants (learned the hard way — do not rediscover)

- **Two RNG streams.** Rules use `Math.random`; anything cosmetic uses
  `cosmeticRandom()`. When they were shared, drawing a damage number shifted
  the next crit roll and seeded replays diverged. Never mix them.
- **Headless equivalence is a gate.** `simulateRun` is not a second
  implementation — the seeded test in `tests/headless.test.mjs` requires a
  headless run and an on-screen run to match exactly. If a change breaks
  that test, the change is wrong (or must consciously update both paths).
- **`BALANCE.saveKey` vs `BUILD` are independent.** `BUILD` is a date stamp
  so two copies can be told apart. `saveKey` is bumped ONLY when a change
  makes an old saved sheet wrong (saves store raw stats and recompute the
  derived sheet, so a rules change silently re-reads an old run under new
  economics). On a bump, add the outgoing prefix to `BALANCE.oldSaveKeys`
  so it gets purged. Old saves are dropped, never migrated.
- **The player sheet is the anchor** (5/5/5/5, 25 dmg, 100 HP, 1.00 turn
  rate); enemies are fitted to it and computed by separate functions. See
  the header comment in `js/data.js` before touching balance.
- **No changelog files.** Git history is the changelog; commit messages
  carry the detail.

## Known soft spots (context, not a to-do list)

- Psy was reworked around DREAD (a mark on the enemy: crits and dodges plant
  it, stacks slow the enemy, Kill cashes it in) — the numbers are first-pass
  and untested by real play. The bot can finally play psy honestly (no bank
  to manage), so its psy numbers now measure the class.
- Cooldown reduction is a live seam with no source.
- Sym barely responds to stat allocation (a read on why sits above its class
  entry in `js/data.js`); Unmutated's bot numbers are unmeasured rather than
  bad.
