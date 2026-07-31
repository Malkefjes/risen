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
  ships on a syntax check and CI catches the rest. The whole run is four
  suites now and takes under a minute, so "run it locally" is cheap when a
  change touches saves, the HUD or the sim.
  **What the suites no longer cover is the rules themselves.** Statuses,
  skills, damage math and balance have no automated guard at all — that is
  deliberate (see below), and it means a rules change is verified by
  MEASURING it with `tools/` and reporting the numbers, then by the owner
  playing it. Don't reach for a new test instead.
- **FOUR SUITES, AND THAT IS THE POINT. Do not add a fifth without being
  asked.** What survives guards a SEAM — a place the game can break while the
  rules are perfectly correct: a save format, a build stamp, two HP readouts
  drawn on different schedules, and headless matching on-screen. Ten other
  suites were deleted outright, and they were not deleted for being wrong.
- **NO TEST MAY HAVE AN OPINION ABOUT A BALANCE NUMBER**, which is why those
  ten went. A test that demands "base clears the first boss 50% of the time" is
  a design decision wearing a test's clothes, and it does real damage: the
  number moves, something goes red, and the change gets made — to the game or
  to the threshold — before the owner has seen the number at all. The
  measurement never arrives; a verdict arrives, already acted on. It happened
  in the session that led to this rule.
  **How the owner develops this game: we change something, we measure what
  happened, HE decides what it means.** Nothing in the repo gets a vote. Same
  for `tools/` — they print, they never conclude. Never edit a threshold to
  make a run green; if you find a threshold, it is the bug, not the number that
  tripped it. `tracker()` in `tests/harness.mjs` has `say()` for reporting a
  number if a new suite ever needs one.
- **Measure in `tools/`, not in `tests/`.** A question like "is this class too
  hard" belongs in an instrument the owner runs when he wants it, not in
  something CI runs on every push. Don't unit-test private internals; drive the
  game through its real surfaces.
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
  it, stacks slow the enemy and open its guard, and fear feeds psy — a SIPHON
  drip per stack each player turn, a DEVOUR burst when stacks are consumed by
  Kill or death) — the numbers are early and owner-tuned by play. Kill takes
  HALF the fear rather than all of it: spending the pile cost the slow, the
  guard opening and the drip at once, so holding was correct at every count and
  the finisher was a card you never pressed.
  **Do not read the bracket's psy column as a statement about psy.** The
  skilled bot's plan table names Vitality last and a level grants ~6 points at
  once, so psy plays all of act 1 on a 100 HP bar and reports median wave 5.
  Same policy on a plain round-robin allocator reaches wave 12. The measurement
  and why it was not quietly fixed are written above SKILLED_PLANS in
  `js/sim.js`.
- Cooldown reduction is a live seam with no source.
- Sym was reworked around THORNS as a growing, run-permanent number (every hit
  taken feeds it, Shed spends it to heal, Provoke buys a swing to eat and baits
  a telegraph out as an ordinary hit). Its numbers are early and owner-tuned by
  play. Speed is deliberately a COST for this class — more of your turns means
  fewer enemy swings, and swings are food.
- **Base was never underpowered — it was unforgiving of one mistake.** 60% of
  its deaths were the ×5 heavy landing, and its answer (Counterpunch's brace)
  was fired as filler the moment it came off cooldown, so it met 3% of heavies.
  Measured before anything moved: hold the brace and cast it on the exact
  pre-heavy turn and the first-boss clear went 20% -> 100% with no balance
  number touched. Bleed was NOT the fix — it is a real damage source (31-40% of
  base's boss damage) but sweeping its depth dial did almost nothing, because
  killing faster cannot help when one blow is what kills you.
  Now: brace lasts 2 turns (strict, not broken) and the skilled bot holds it for
  the telegraph. Skilled clears the first boss 100% of the time; GREEDY, which
  is frozen and deliberately unclever, still spends the brace as filler and
  clears 48% (200 runs). That gap IS the class working — for the one strain
  whose identity is reading a telegraph, mashing should fail — so nothing
  asserts a floor under it. `tools/bot-bracket.mjs` prints both if you want to
  see whether it still holds.
- **A skill can declare how it wants to be played**, and the bot reads it off
  the card rather than learning classes by name: `spendAt` (the count at which a
  spender is worth pressing) and `holdFor: 'windup'` (do not burn this as
  filler; it answers the telegraph). Reach for a declared field before adding a
  class check to `js/sim.js`.
- **No banks, and no stack ceilings.** Every strain runs on ONE UNCAPPED NUMBER
  worn as a status badge: bio POISON and psy DREAD on the enemy, sym THORNS and
  base RESOLVE on the player. Only THORNS is run-permanent; the other three
  rebuild every fight. Effects stay bounded where an unbounded one would end the
  game (the DREAD slow saturates, the RESOLVE reduction is capped at 85%) — the
  rule is uncapped number, bounded effect. Nothing guards this any more — the
  suite that did was deleted with the rest — so a ceiling reintroduced in a
  status definition is one line and nobody will notice. Check by eye.
