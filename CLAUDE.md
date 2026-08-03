# RISEN — project conventions

A turn-based browser roguelite. Personal project, built for enjoyment.

## Why any of this exists

**THE GAME IS FOR THE PLAYER, AND FOR A LONG TIME.** Nothing here is an end in
itself. Tests, instruments, balance headers, the bots — each exists to protect a
play experience, and any of them that stops doing that is overhead to delete
rather than maintain.

Two words carry it. **PLAYER** is the owner, who actually plays this — not a
hypothetical audience whose preferences can be argued about instead of observed.
**LONG TERM** rules out the cheap version: a build that solves the allocation
screen, a number that trivialises a boss, a rotation pressed the same way every
fight are all fun once and then never again.

The test, and it must produce NOs or it is steering nothing: **would a player
ever feel this?** If nobody could, it is overhead — unless it protects something
they would feel later, which is the entire job of the five suites. Nobody feels
a save-format bump; everybody feels a corrupted run.

Fun is felt, not argued, so it is judged by PLAYING. Everything below about
tools that never conclude and tests with no opinion about a balance number is
not a separate policy. It is this one, applied.

Expect this to bite hardest on TOOLING, because that is where time sinks
actually live: a sharper instrument only serves the player at one remove, and
the second remove is where work goes to die.

## The comments are not law

**Almost every comment in `js/` was written by Claude, not by the owner** —
about 1,900 full-line comments in 5,300 lines, a third of the codebase
(re-counted 2026-08-02an). The owner has never read any of
it. Neither did he write this file. All of it is FINDINGS AND REASONING, and
none of it is permission granted or withheld.

This is not a small caveat. Prose written confidently by one session gets read
as settled law by the next, and the next one cites it — so an offhand judgment
compounds into a constraint nobody chose and the owner cannot see. It has
already cost real work: a line reading *"Nothing else may do this without the
same argument"* was quoted at the owner as though it were his own rule, and
nearly talked him out of a change to his own game. He shipped it anyway. The
line was wrong, and it is now also FALSE — base's bleed is quadratic in
Strength as of build `2026-08-01c`.

Three rules, and they are the whole of it:

1. **Never quote a code comment to the owner as if it were his rule.** He did
   not write it. If a constraint is worth raising, re-derive it or re-measure
   it and say it in your OWN voice as your OWN recommendation — something he
   can weigh and overrule, not a wall he has to argue with.
2. **A comment that forbids a design is one past session's opinion.** If the
   owner asks for the thing it forbids, the comment is what is wrong. Change
   the comment.
3. **A measurement in a comment is only as true as the build it was taken on.**
   The enemy table claimed the dumb bot won ~98% long after it had dropped to
   a median of wave 5-10. Re-run it before you repeat it.

**The line that matters is CHECKABLE vs UNFALSIFIABLE**, not old vs new. "Two
RNG streams, or seeded replays diverge" and "headless must match on-screen" are
load-bearing because you can RUN them and watch them fail — they earn their
authority every time CI passes. "A break must be possible but must not be
normal" cannot be checked by anything, so it is taste wearing a rule's voice.
Both kinds are useful. Only one kind gets to end an argument.

**Writing new notes:** record what was MEASURED and WHEN, not what is
FORBIDDEN. If a note has to constrain something, name what it protects and what
would show it had stopped mattering. A constraint with no failure condition is
scripture — it can only ever accumulate.

**`OWNER:` Do not add much prose to the code.** Asked for outright. Half this
codebase is already agent-written comment, and a one-line fix does not need a
paragraph explaining itself. A short note or none; the commit message is where
the reasoning goes.

**`OWNER:` marks a decision the owner actually made**, in his words, and is the
only tag that outranks a measurement. It is rare on purpose; everything
unmarked is agent reasoning and is open season. Never add it for something he
did not say.

## How this project works

- **`OWNER:` The owner plays the game and gives feedback. They never read
  code** and don't care about repo internals. Confirmed by him directly: *"i
  didnt write none of the comments or 'rules' in the code."* Translate feel into mechanics yourself;
  never ask them to look at a diff, a file, or a stack trace.
- **`OWNER:` Push to main by default.** The owner plays the published build, so work
  that is finished belongs on main without being asked — do the work on a
  branch, then fast-forward main and say so. Don't ask each time. Anything you
  would not want him to play yet is the only reason to hold it on a branch, and
  say that out loud when you do.
- **`OWNER:` Bump `BUILD` on every push to main, and always say what is live.**
  Both asked for outright. Bump the stamp even when the change touches no rules
  — *"that line is how i know for sure im playing the updated version"* — and
  name the live stamp every time you push or report where things stand. A stamp
  that only sometimes moves cannot answer the one question it exists for.
  `BALANCE.saveKey` is unaffected; bumping the build never costs a save.
- **`OWNER:` Hard is the point, and the frame is REACH plus WIN RATE.** In his
  words: *"i want my game to be hard... how far can each class get into the
  game + what percent of runs can they win is more interesting to me."* A
  difficult game raises the ingenuity needed to beat it — but a thing can also
  just be straight up broken, and telling those apart is his call, not a
  measurement's.
- **`OWNER:` Simple beats clever.** *"i dont want an overly complicated game, i
  want a fun game."* A mechanic he cannot hold in his head is worse than a
  shallower one he can. If explaining a design takes more than a breath, that
  is the design's problem.
- **`OWNER:` The premise, as of `2026-08-02an`.** Sonny is a MAN IN A CYBERNETIC
  SUIT — not infected, not a mutant. Mutant Pest Control built the suit to clear
  its own laboratory, and the Laboratory keeps it strong with EXTRACTIONS refined
  from its subjects: the ones that mutated, and the ones that were people first.
  He has started asking what he is made of, which is why MCP now wants him back.
  The three strains are extraction types; UNAUGMENTED is the suit as issued, with
  nothing in the lining. Write copy in that voice — clinical, and the horror is
  in the euphemism ("inventory", "recovered in pieces"). The word *strain* is
  kept everywhere internal (CSS, save format, `strainNumberNow`) and reads fine
  as a strain of extracted material; only player-facing text says EXTRACTION.
- **Design by feel, not by plan.** There is deliberately no roadmap. Don't
  create planning documents; don't accumulate TODO lists in the repo. The
  owner decides what's next by playing.
- **`OWNER:` The game is silent by choice.** The owner plays without sound (a
  neurological condition makes noise a burden). Don't add or propose audio;
  spend the juice budget on visuals instead. Revisit only if the owner
  raises it themselves.
- **Floater colors are a fixed vocabulary** — color names the event, never
  the class: dealt damage white, taken damage red, crits gold, XP amber,
  notes muted gray. Green is nature's alone: healing (+) and poison (−) share
  it, the sign carrying the meaning. See the comment above `.float-dmg` in
  `css/risen.css` before adding a floater type.
- **`OWNER:` Do not run the suites for simple changes — sometimes speed is the
  priority.** In his words: *"we can run it later if we need to."* CI runs
  everything on every push, so a cosmetic tweak or a keybind
  ships on a syntax check and CI catches the rest. The whole run is five
  suites and takes about a minute, so "run it locally" is cheap when a
  change touches saves, the HUD or the sim.
  **What the suites no longer cover is the rules themselves.** Statuses,
  skills, damage math and balance have no automated guard at all — that is
  deliberate (see below), and it means a rules change is verified by
  MEASURING it with `tools/` and reporting the numbers, then by the owner
  playing it. Don't reach for a new test instead.
- **FIVE SUITES, AND THAT IS THE POINT. Do not add a sixth without being
  asked.** (`restart` was the fifth, added on request 2026-08-02.) What
  survives guards a SEAM — a place the game can break while the rules are
  perfectly correct: a save format, a build stamp, two HP readouts drawn on
  different schedules, headless matching on-screen, and a new run inheriting
  the last one's screen. Ten other suites were deleted outright, and they were
  not deleted for being wrong.
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
  (data → items → mods → stats → screens → sim → combat → saves → render → sprites); they
  are chapters of one program, not modules. Keep new code in the chapter
  where it belongs; keep load order in mind for top-level statements.
- `tests/` — playwright suites driving the real game (`npm test`). One
  dependency (playwright). `RISEN_CHROMIUM=<path>` points the suite at a
  pre-installed browser; in this remote environment use
  `RISEN_CHROMIUM=/opt/pw-browsers/chromium`.
- `tools/` — read-only balance instruments built on `simulateRun`
  (autopsy, bot-bracket, single-stat, double-stat, transcript). They print
  numbers, never verdicts. TWO bots live in `js/sim.js`: **dumb** mashes random
  buttons and allocates at random; **smart** spreads points evenly and skips the
  presses that throw a card away — it holds a telegraph answer for the telegraph
  (but only against something that telegraphs), never heals a full bar, and
  never cashes a finisher on an empty pile.

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
- **`OWNER:` The run is 60 waves: three ZONES of ten, then a 30-wave ENDGAME**
  (restructured 2026-08-03d, endgame added 2026-08-03n, both his design) — The
  Laboratory, The Laboratory: Asset Recovery, City Streets, then MUTANT PEST
  CONTROL. Zones 1-3 are nine fights and ONE boss each, with wave 5 of every
  zone a guaranteed named CHAMPION (elite chassis, rolled affix): the champion
  is the midterm, the boss the final, an exam every fifth wave.
  **ZONE 4 BREAKS THAT SHAPE ON PURPOSE** and is where most runs end. Its
  roster of four is DRAWN per spawn rather than rotated (so a reload shows a
  different face — cosmetic, and the trade the zone is named for), elites run
  at 35-65% instead of 16-40%, and bosses are ROLLED: one guaranteed on every
  10-wave boundary (40/50/60) plus `extraBossChance` on any other wave, about
  6 a run, all wearing one face and rolling their VERB rather than carrying an
  authored one. WINNING MEANS CLEARING WAVE 60.
  Read the count off `BALANCE.finalWave`, never from a literal: a hardcoded 30
  in `tools/autopsy.mjs` went on reporting a 30-wave game after the run grew.
  A level grants exactly 3 stat points (`pointsPerLevel`).
  **The restructure's growth numbers are DERIVED, not measured** (owner's
  call): zone-end multipliers ~3.2 / ~8.3 / ~16.1, fitted to the old 45-wave
  walls scaled ~0.8x for the smaller sheet a 30-wave run earns. Nothing has
  played or measured them; the first autopsy on this build supersedes the
  paragraph below.
  **Stale but instructive, all measured on the 45-wave pre-item build:**
  median level was L6 at wave 15, L8 at 20, L11 at 30, L15 at 45; across the
  back half the enemy grew 5.1x to the player's 2.35x (the reason telegraphs
  shrink per zone, 4.0 / 2.5 / 1.6 — kept); per axis the gap was in DAMAGE
  and HP, not tempo. The refit plus items AIMS at closing that gap.
- **No changelog files.** Git history is the changelog; commit messages
  carry the detail.

## Known soft spots (context, not a to-do list)

- **STRENGTH IS THE WEAKEST STAT, and it is not a tuning problem** (measured
  2026-08-03i). Every strain's damage is 57-80% its RAMP, and a ramp's size is
  STACKS — bought with turns and with staying alive — while attack damage only
  sets what one stack is worth. So Strength multiplied the smallest term and
  bought nothing that keeps you alive. Pure STR won 3% of runs; TRIPLING
  `damagePerStr` left it at 3% while SPD+VIT went 63% -> 78%, because every
  stat gives 20% of its own starting value per point, so scaling the number
  moves the base and the margin together. It is a global difficulty dial, not
  a stat-balance one.
  **Strength now has a SECOND term** (`poisonPerStr` / `dreadPerStr` /
  `thornsPerStr`, mirroring the `bleedPerStr` base always had): an extra stack
  per N Strength, worth nothing at the starting sheet so it rewards investment
  rather than handing every build a free stack. Measured at 100 runs a cell
  with base as the control (noise floor ±8): STR+VIT bio 1% -> 10%, psy
  1% -> 14%, sym unmoved. Real, and modest.
  **What moved it was ENEMY HP, not damage** — and that became `hpExp`
  (2026-08-03j, owner's call to try it). LENGTH AND DANGER ARE NOW SEPARATE
  DIALS: pools grow sublinearly in the growth factor (`hpExp` 0.75) while the
  threat still grows linearly (`dmgExp` 1.00), so late fights got shorter
  without getting safer. Measured, basic attacks to drop the wave-30 boss:
  90 -> 49, with wave 1 untouched at 7 (an exponent, not a smaller `hpBase`,
  because g is 1.00 at wave 1 — a flat cut would have made zone 1 die in two
  hits). The STR gap closed for sym (46 -> 24) and base (54 -> 30) and did NOT
  close for bio or psy, whose ramps need TURNS to pay out — shortening a fight
  helps their Speed builds instead. If difficulty needs to come back, reach
  for enemy DAMAGE or RATE, never pools: those restore threat without
  restoring tedium.

- **Enemy VERBS (2026-08-03g): the six named fights each ask a question.**
  Bosses carry one AUTHORED verb (`ZONES.bossVerb`: REGROW / GUARD / ENRAGE);
  champions ROLL one of four (`CHAMPION_VERBS`, includes FLURRY) beside their
  rolled affix — fixed face, rolled question. Trash never carries one, on
  purpose. The filter for a new verb: IT MUST CHANGE WHICH BUTTON THE PLAYER
  PRESSES, and it must announce itself through the intent badge and a plate —
  verbs multiply the read-and-answer skill, never bypass it. Verbs never
  stack by roll; a hand-authored compound is allowed (the finale's ENRAGE
  rides its every-2 windup). All numbers derived, none measured.

- **Bio's distinct verb is THE ROT OUTLIVES ITS HOST** (2026-08-03l): half the
  POISON on a corpse moves to the next spawn (`poisonCarryFrac`). It exists
  because bio was the one strain with no press only it makes — Chitin-on-
  telegraph is Counterpunch-on-telegraph — and because every measurement this
  week said the same thing: its ramp reset each fight and rebuilt too slowly,
  which is why `hpExp` helped every strain but this one. Nothing else in the
  game crosses the fight boundary on the ENEMY's side, and it makes the END of
  a fight a decision (finish, or stack once more for the pile you carry).
  Self-limiting rather than a snowball: S = S/2 + G solves to S = 2G, so it
  doubles the working stack count and holds. Derived, unmeasured.
- Psy was reworked around DREAD (a mark on the enemy: Hunt plants it on hit,
  stacks slow the enemy and open its guard, and fear feeds psy — a SIPHON
  drip per stack each player turn, a DEVOUR burst when stacks are consumed by
  Kill or death) — the numbers are early and owner-tuned by play. Kill takes
  HALF the fear rather than all of it: spending the pile cost the slow, the
  guard opening and the drip at once, so holding was correct at every count and
  the finisher was a card you never pressed.
  Psy's old bracket column was an artefact of the bot, not the class — the
  retired per-strain plan tables named Vitality last, so psy played all of zone 1
  on a 100 HP bar. Both bots spread points evenly now and the column is about
  psy again.
- **Balance pass 2026-08-02ag, measured before and after with `tools/autopsy.mjs`
  at 150 runs a row.** Median reach on the best allocation: bio 22 -> 31,
  psy 29 -> 32, sym 15 -> 26, base 30 -> 39. Runs won out of 150: bio 0 -> 5,
  base 0 -> 6; psy and sym still 0. Four changes — every strain's sustain also
  cleanses POISON (nothing removed a stack before, and venomous elites were the
  top killer for three of four); Miasma to 20% x 5; sym's THORNS growth reads
  the SHARE OF THE BAR a hit took rather than counting hits; Last Stand spends
  70% of RESOLVE rather than all. The Last Stand fraction is steep and is one
  number: 100% -> 32 median / 0 wins, 70% -> 37 / 6%, 50% -> 43 / 34%.
- Sym was reworked around THORNS as a growing, run-permanent number (every hit
  taken feeds it). Reworked again 2026-08-03f after the owner said he felt weak
  playing it: PROVOKE LASHES BACK (the invited swing is answered with full
  THORNS × 1.5 — the ramp's on-demand payoff, read rather than spent) and
  SHED'S torn spines REGROW at the next spawn (per-fight cost; it was the only
  sustain in the game that ate its own class's progression). thornsPerHit also
  1 -> 2, because the 30-wave restructure feeds the ramp a third fewer hits.
  All derived, none measured, owner judges by play. Speed is deliberately a
  COST for this class — more of your turns means fewer enemy swings, and
  swings are food.
- **Base was never underpowered — it was unforgiving of one mistake.** 60% of
  its deaths were the ×5 heavy landing, and its answer (Counterpunch's brace)
  was fired as filler the moment it came off cooldown, so it met 3% of heavies.
  Measured before anything moved: hold the brace and cast it on the exact
  pre-heavy turn and the first-boss clear went 20% -> 100% with no balance
  number touched. Bleed was NOT the fix — it is a real damage source (31-40% of
  base's boss damage) but sweeping its depth dial did almost nothing, because
  killing faster cannot help when one blow is what kills you.
  Now: brace lasts 2 turns (strict, not broken) and the smart bot holds it for
  the telegraph — it covers ~93% of the heavies it faces, against ~16% when
  mashed. That gap IS the class working: for the one strain whose identity is
  reading a telegraph, mashing should fail. Nothing asserts a floor under it;
  `tools/bot-bracket.mjs` prints both columns if you want to see it still holds.
- **`OWNER:` ITEMS ARE STAT STICKS, and that is the design.** In his words:
  *"items are stat sticks, thats simple, understandable and thats what i want.
  mods change behaviour, items grant you general power."* One system for what
  you do, one for how much of it you do — so nothing in `js/items.js` may ever
  change a rule; a drop that wants to rewrite a press is a Modification.
  Structured after a PoE-shaped spec he brought in (2026-08-03o): an IMPLICIT
  fixed to the slot, PREFIXES that are stat POINTS (singles and hybrids),
  SUFFIXES that are PERCENTAGES, no two affixes sharing a group (the implicit
  claims its own, so a card never spends two of four lines saying one thing),
  and T1-T5 tiers gated by the drop wave and PRINTED on every line — the tier
  is what makes a drop legible without arithmetic. Rarity is affix count and
  nothing else: STANDARD 1 prefix, REFINED 1+1, PROTOTYPE 2+1. FOUR LINES IS
  THE CEILING, because the drop card is a three-second read with no inventory
  behind it. Measured after: gear supplies 39% of the stat sheet at wave 30
  (47% before the restructure) and 48% at wave 45, so it was re-shaped rather
  than nerfed.
- **MODIFICATIONS are patches on BUTTONS, never numbers on the sheet**
  (`js/mods.js`, 2026-08-03m). Levels and gear already feed the stat sheet; a
  third source of "+15% damage" would be a third helping of the same meal, and
  we measured what that produces — items alone took win rates 0% -> 88% without
  making one fight more interesting. So a Modification must be describable as a
  sentence about a PRESS, and **every one carries a cost**: a pick that is
  strictly better is a delay before a decision, not a decision.
  Declared as a PATCH (`skills: { <id>: {...} }`, plus `player:` overrides), so
  it serializes as an id, re-applies onto fresh skill copies on load — retuning
  a mod reaches runs already carrying it — and the cards re-read the patched
  fields through fmtDesc for free. PER STRAIN, never a shared pool: a pool bio
  and base both draw from is a pool that makes them the same class.
  Offered after every 5th wave EXCEPT the last (`modWaves`) — the champion and
  boss rhythm, five picks a run, and nothing handed over as the run ends.
  FILED UNDER THE BUTTON THEY REWRITE, three per ability (48 total), so "every
  ability has three" is a property of the table's shape rather than something
  to count; an offer takes one from each of three DIFFERENT abilities, because
  three ways to change the same press is not three choices. DECLINING is a real
  option (`takeMod(null)`) — three picks that all cut against the build you are
  assembling is a worse offer than none.
- **Cooldowns follow a grammar, discovered rather than designed** (surveyed
  2026-08-03k). `cdTurns` reads directly as "once every N of YOUR turns" — Speed
  never accelerates a rotation, only the number of turns — and the twelve
  cooldown cards sort into **3 = the ramp feeder** (Infest, Terrify), **4 = the
  answer or the buff** (Traumatize, Provoke, Spines, Counterpunch, Bandage,
  now Chitin and Shed), **5 = the payoff or the faucet** (Miasma, Kill, Last
  Stand). A second axis holds in the buffs: uptime falls as mitigation rises —
  Miasma 5/5, Spines 3/4, Chitin 3/4, Brace 2/4. Only Miasma's (deliberate
  100% uptime) and Spines' (duration must stay under the cooldown or an
  amplifying buff ladders on itself) were ever written down; the rest was
  taste that happened to be consistent. Put a new card on the clock its ROLE
  implies, or say why not.
- **A skill can declare how it wants to be played**, and the bot reads it off
  the card rather than learning classes by name. What the smart bot looks for,
  to decide a skill answers a telegraph: `stun` (plus `dreadNeed`, so it never
  fires a gated stun under its threshold), `type: 'provoke'`, an explicit
  `holdFor: 'windup'` (base's brace), or a `buff` whose status has an
  `incomingMult` under 1 (bio's Chitin). Add a declared field before adding a
  class check to `js/sim.js`. `spendAt` used to live here and was deleted with
  the old bots — nothing read it any more.
- **No banks, and no stack ceilings.** Every strain runs on ONE UNCAPPED NUMBER
  worn as a status badge: bio POISON and psy DREAD on the enemy, sym THORNS and
  base RESOLVE on the player. Only THORNS is run-permanent; the other three
  rebuild every fight. Effects stay bounded where an unbounded one would end the
  game (the DREAD slow saturates, the RESOLVE reduction is capped at 85%) — the
  rule is uncapped number, bounded effect. Nothing guards this any more — the
  suite that did was deleted with the rest — so a ceiling reintroduced in a
  status definition is one line and nobody will notice. Check by eye.
