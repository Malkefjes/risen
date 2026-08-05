# RISEN

Turn-based browser ARPG. Personal project. `index.html` + `css/` + `js/` +
`assets/`, no build step; the js files share one global scope and load in order
(data → items → mods → stats → screens → sim → combat → saves → render → sprites).

## How to work here

- **The owner plays the game and never reads code.** Translate feel into
  mechanics yourself. Never ask him to look at a diff, a file or a stack trace.
- **Keep the code bare.** He asked for this outright: no explanatory prose, no
  paragraphs above functions, no notes recording why. The commit message is
  where reasoning goes. A comment has to earn its line and almost none do.
- **No planning documents, no changelogs, no TODO lists.** Git history is the
  record. He decides what is next by playing.
- **Push to main by default,** and bump `BUILD` on every push — that stamp is
  how he knows he is playing the new build. Say the live stamp when reporting.
- **Don't run the suites for cosmetic changes.** CI runs them on every push.
  Run them locally when a change touches saves, the HUD or the sim.

## Rules that break things if forgotten

- **Two RNG streams.** Rules use `Math.random`, cosmetics use
  `cosmeticRandom()`. Shared, drawing a damage number shifts the next crit roll
  and seeded replays diverge.
- **Headless equivalence is a gate.** `simulateRun` is not a second
  implementation — `tests/headless.test.mjs` requires a headless run and an
  on-screen run to match exactly.
- **Cards never pause combat, and bots resolve them only at the top of a
  player turn.** A drop or mod resolved anywhere else in a harness loop
  desyncs headless from live. A human may resolve whenever; their mouse is
  not the sim's business.
- **Death respawns, never deletes.** `playerDown()` returns the player to
  `state.checkpoint` with statuses, piles and cooldowns cleared; levels, gear
  and mods persist. Only the owner deletes a character.
- **A wave is one to three enemies.** Members are budget shares
  (`packHp`/`packDmg`); champions and bosses stay solo. Kill bookkeeping runs
  per member; the wave-clear block runs once, guarded by `_waveCleared`.
- **`BUILD` and `BALANCE.saveKey` are independent.** `saveKey` bumps ONLY when
  a change makes an old saved sheet wrong; add the outgoing prefix to
  `oldSaveKeys`. Old saves are dropped, never migrated.
- **The player sheet is the anchor:** 5/5/5/5, 25 damage, 100 HP, 1.00 turn
  rate. Every stat is `(5 + points) / 5` times its starting value. Enemies are
  fitted to it.
- **Read the wave count off `BALANCE.finalWave`,** never a literal.
- **Uncapped number, bounded effect.** Each strain runs on one uncapped status
  (bio POISON, psy DREAD, sym THORNS, hyd PRESSURE, base RESOLVE). Effects that
  would end the game if unbounded are capped; the counts never are.
- **Skills declare how they want to be played.** The bot reads `stun`,
  `type:'provoke'`, `holdFor:'windup'`, or a `buff` whose status has
  `incomingMult < 1` to find a telegraph answer. Add a declared field rather
  than a class check in `js/sim.js`.
- **A class's `skills` is a catalogue, not a bar.** The basic is always fitted;
  `KIT_SLOTS` of the rest are chosen at select. Saves carry the kit as ids
  because `skillCds` is positional against it. Mod offers filter to fitted
  buttons.

## Five suites, and that is the point

Do not add a sixth without being asked. Each guards a SEAM — a place the game
breaks while the rules are perfectly correct: a save format, a build stamp, two
HP readouts on different schedules, headless matching on-screen, a new run
inheriting the last one's screen.

**No test may have an opinion about a balance number.** Ten suites were deleted
for having one. A test that demands a win rate is a design decision wearing a
test's clothes: the number moves, something goes red, and the change gets made
before the owner has seen the number at all.

Balance is verified by MEASURING with `tools/` and reporting the numbers, then
by him playing it. Tools print; they never conclude. Never edit a threshold to
make a run green.

## Owner's decisions

- **Hard is the point,** and the frame is REACH — the deepest wave a character
  gets before its first death, plus how often it breaches the source. Death
  costs the replay from the last boss, never the character.
- **Simple beats clever.** A mechanic he cannot hold in his head is worse than
  a shallower one he can.
- **An item gives attributes and nothing else; LEGENDARY uniques bend
  exactly one rule each,** declared in the `UNIQUES` table and read through
  `hasRule` or a skill patch. Rarity is how many attribute lines a piece
  carries — COMMON 1, UNCOMMON 2, RARE 3, EPIC 4, LEGENDARY the rule-bender —
  and the rarity a boss can pay opens up by zone: blue, then yellow, then pink
  with a chance at orange. Every class starts in a full set of UNCOMMON gear
  and COMMON never drops. Modifications are straight
  upgrades to one button and they stack — no costs, no downsides — and keep
  coming in the Depths, every tenth wave.
- **Defence is reduction, not chance.** ARMOR (Strength) and EVASION (Speed) on
  one curve, `X / (X + defenseK)`. They multiply. Instinct is offence alone.
- **Each strain scales best with one stat:** bio STRENGTH, psy SPEED, sym
  VITALITY, hyd INSTINCT. Base is the generalist.
- **Gear carries the baseline** so the bars can be a choice: armor implies
  +VITALITY, boots +SPEED, as stat points.
- **The game is silent.** Do not add or propose audio. Spend the budget on
  visuals.
- **Floater colors name the event, never the class:** damage dealt white, taken
  red, crits gold, XP amber, notes gray. Green is nature's alone — healing and
  poison share it, the sign carries the meaning.
- **The run is 60 waves, then the DEPTHS:** three zones of ten, a 30-wave
  endgame, and past the source an endless run of 10-wave Depths on zone 4's
  math. Wave 5 of each zone is a champion, wave 10 a boss; every boss kill
  moves the death checkpoint. Breaching wave 60 is a milestone, not an ending —
  every character dies somewhere in the Depths, and that wave is its score.
- **The premise.** Sonny is a scout for OUTWARD SURVEY, dropped from the survey
  vessel *Meridian* onto an unnamed alien world. The first team stopped
  answering and a signal did not. He goes down, and nothing comes back up until
  he reaches the source. The five strains are PACKAGES the ship fits on the
  standard rig, one per drop — which is why the select screen is a loadout.
  Copy is clinical and the horror is in the euphemism. `FAUNA-nn` designations
  go to catalogued fauna (zones 1-2) and not to the people Survey left behind
  (zones 3-4). *strain* stays internal; class keys are `bio` `psy` `sym` `hyd`
  `base`.

## Comments in this repo

Almost every comment that used to be here was written by an agent, not the
owner. He has never read any of it, and in 2026-08 he had it all deleted — the
code is bare on purpose. If you are about to write a comment explaining your
reasoning, put it in the commit message instead.

A note that survives has to be a fact you can check, not a judgment. "Two RNG
streams or seeded replays diverge" earns its place because you can run it and
watch it fail. "A break must be possible but must not be normal" cannot be
checked by anything, and that kind of line accumulates into rules nobody chose.
