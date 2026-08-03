Read-only instruments. They print numbers and assert nothing — no thresholds,
no verdicts, no "the target". None of them run as part of `npm test`.

That was not always true: `bot-bracket` used to print TOO EASY / TOO HARD /
"skill-expressive, the target" off numbers nobody chose. A tool that hands you a
conclusion is competing with the person whose job the conclusion is, and the
same rule now holds in `tests/` — see the note above `tracker()` in
`tests/harness.mjs` for where the line sits between a check and a measurement.

    node tools/autopsy.mjs [runs]         what is the state of the game?
    node tools/bot-bracket.mjs [runs]     how much does playing well change a run?
    node tools/single-stat.mjs [runs]     is a stat a build or a garnish?
    node tools/double-stat.mjs [runs]     which PAIRS of stats actually work?
    node tools/transcript.mjs [strain]    dump one run's combat log

All of them go through `simulateRun` inside the game, so a few hundred runs
finish in the time it takes to start a browser. They used to drive the real UI
one turn at a time and took minutes per run.

There are TWO bots, defined as `BOTS` in `js/sim.js`. **dumb** presses a button
at random — cooldowns included, it does not know what a cooldown is — and
throws its stat points anywhere. **smart** spreads its points evenly one at a
time and presses what is worth pressing: it holds a telegraph answer (a stun, a
Provoke, a brace, a damage-reducing buff) for the telegraph, but only against an
enemy that can actually telegraph; it does not heal a full bar; and it does not
cash a finisher that spends a resource with nothing banked behind it. Either
drops straight into `simulateRun(cls, BOTS.smart)`.

It also holds a finisher against a raised GUARD, read off the status rather
than the verb's name, because a pile you cannot get back should not be spent
into a halved blow.

BOTH BOTS ALSO ANSWER THE TWO BETWEEN-FIGHT CARDS, because a run cannot
continue past them. A drop is taken when it outscores what is fitted (stat
points, with percentage lines priced by tier). A Modification is scored on the
fields its patch actually moves against the sheet the bot is holding, with
ZEROING an effect priced far below reducing one — that single rule is what
stops a bot deleting the mechanic its strain is made of, which it did when it
simply took the first offer. Neither choice draws RNG: the OFFER is the rules
draw, so a second one would desync a bot from a player.

Those last three came out of measuring what the bot was throwing away rather
than from taste, and the sizes are in the comments beside them. The largest was
base: pressing Last Stand on cooldown dumped the RESOLVE that is also its damage
reduction, and holding it took base's median from 15 to 24.

The gap between the columns is no longer one question — it is now "what is
playing the cards properly worth", of which reading the windup is one part. The
telegraph answer-rates quoted here previously (79-93% smart against 0-44% dumb)
were taken before that, and have not been re-measured since.

There used to be a third, "greedy", frozen so that balance numbers quoted in
old commit messages stayed comparable. It is gone, and so are the per-strain
allocation plans the old "skilled" bot used — those turned out to decide more
about a run than the piloting did, which made the bracket a table about the
plans.

AUTOPSY IS THE ONE TO RUN FIRST. The bracket prices piloting and the two stat
sweeps price builds; autopsy answers "what is the state of the game" with four
readings a win rate cannot give you — where runs end (as a p10/median/p90 band,
because a narrow band is a wall and a wide one is a game that varies), what
killed them (attrition against telegraphs, which is what points at a lever),
which skills actually fire, and the danger curve wave by wave.

It handles the allocation problem by SCOUTING rather than assuming: a cheap
sweep finds whichever allocation currently gets furthest for each class, then it
autopsies that alongside the even spread. Hardcoding today's best build would
bake a verdict into an instrument meant to outlive it.

The value is the SPREAD, not any single number — a lone win rate stops saying
anything the moment it saturates. Read the columns comparatively, and remember
that a class a bot cannot pilot is not necessarily one a person cannot. What
these numbers are good for is spotting a mechanic that never engages at all,
which is how the problem that led to psy's DREAD rework surfaced: the resource
it ran on drained faster than it filled, so its gated skills reported "not paid"
a dozen times a run and never fired.
