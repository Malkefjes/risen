Read-only instruments. They print numbers and assert nothing — no thresholds,
no verdicts, no "the target". None of them run as part of `npm test`, and no
test may hold an opinion about a balance number. Ten suites were deleted for
that once; the rule stands.

# The balance philosophy

The game is an ARPG. The unit of experience being balanced is a CHARACTER'S
LIFE — a persistent build that levels, gears, breaches the source and dies
somewhere in the Depths — not a run's win or loss. Wave 60 is a milestone
statistic, not a target.

## Worth balancing (the owner's levers, informed by measurement)

1. THE CEILING CURVE. Investment must move ceilings. A better allocation, a
   worn unique, a taken toll, another life of levels — each should push a
   character's deepest wave. If optimizing doesn't move reach, progression
   is decoration.
2. BUILD DIVERGENCE. Two players on the same class should end up with
   different ceilings, different textures, different best-in-slot answers.
   Convergence is the failure state.
3. THE PRICE OF DYING. Death costs the replay from the last boss. That price
   is paid in minutes, and walls should yield to growth and play, not to
   patience alone. How fast a wall breaks is a knob, not an accident.
4. COUNTERPLAY VALUE. Reading telegraphs, answering windups, and focusing
   packs must out-earn pressing buttons at random. The smart-vs-dumb reach
   gap prices this.
5. CHOICE LIVELINESS. Every toll must be pickable by someone, every unique
   wearable by some build, every trade-off buyable in some situation. A
   dead option is an imbalance even if no number looks wrong.
6. THE POWER ARC. Becoming powerful requires having been weak. Enemies must
   cost real effort before the build comes together, and the campaign must
   hold pressure the whole way — effort per enemy starts real and falls as
   the build assembles; danger visits every band. A wave-1 one-tap and a
   life that never sees half HP are both failures the ceiling cannot see.

## Explicitly not balanced, not targeted

- CLASS PARITY. Classes are textures, not tournament seats. A band of
  ceilings across classes is healthy; flattening it is not a goal.
- BREACH RATE. What percent of first lives clear wave 60 is reported,
  never tuned toward.
- ANY SINGLE NUMBER AS PASS/FAIL. Tools print; the owner concludes by
  playing. Never edit a threshold to make a run green — there are no
  thresholds.
- FEEL. Pacing, hit-stop, floater sizes, animation weight — playtest
  domain. Simulation has nothing to say about it.
- BOT-VS-HUMAN SKILL. The bots price RELATIVE differences (build vs build,
  toll vs toll, smart vs dumb). A class a bot cannot pilot is not
  necessarily one a person cannot.

# The instruments

All of them drive `simulateRun` inside the real game; a few hundred lives
finish in minutes. Two bots (`BOTS` in js/sim.js): dumb presses random
buttons; smart answers telegraphs, focuses the lowest bar, reaches for
sweeps against packs, holds finishers and heals. Both resolve drop and mod
cards at player-turn boundaries and take the first toll offered.

    node tools/ceiling.mjs [runs]    the flagship: where lives end, what
                                     kills them, what piloting is worth,
                                     what a second and third life buy,
                                     which buttons never get pressed
    node tools/builds.mjs [runs]     the divergence matrix: every allocation
                                     plan x every class, first-death reach
    node tools/arc.mjs [runs]        the power arc: player turns per kill,
                                     damage pressure and lowest HP touched,
                                     per wave band — where danger lives and
                                     where effort collapses into one-taps
    node tools/uniques.mjs [runs]    equip-lift per unique: reach with it
                                     granted vs without, per class
    node tools/tolls.mjs [runs]      hazard economics: depth reach and level
                                     under each toll, forced for the whole
                                     descent
    node tools/loot.mjs [runs]       drop cadence: recovered / fitted / left
                                     by wave band, uniques per life, how
                                     deep loot stays live
    node tools/transcript.mjs [cls]  dump one life's combat log

Superseded and deleted: autopsy (split into ceiling + builds), bot-bracket
(its piloting question lives in ceiling), single-stat and double-stat
(subsumed by builds), kit-bracket (every class now fields one fixed bar, so
there are no kit combinations left to price). Their old numbers in commit
messages predate softcore and the Depths and are not comparable to anything
these print.
