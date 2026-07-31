Read-only instruments. They print numbers and assert nothing — no thresholds,
no verdicts, no "the target". None of them run as part of `npm test`.

That was not always true: `bot-bracket` used to print TOO EASY / TOO HARD /
"skill-expressive, the target" off numbers nobody chose. A tool that hands you a
conclusion is competing with the person whose job the conclusion is, and the
same rule now holds in `tests/` — see the note above `tracker()` in
`tests/harness.mjs` for where the line sits between a check and a measurement.

    node tools/bot-bracket.mjs [runs]     how much does playing well change a run?
    node tools/bank-usage.mjs [runs]      can each strain's bank actually fill?
    node tools/balance-sweep.mjs [runs]   is a stat a build or a garnish?
    node tools/transcript.mjs [strain]    dump one run's combat log

All three go through `simulateRun` inside the game, so a few hundred runs
finish in the time it takes to start a browser. They used to drive the real UI
one turn at a time and took minutes per run.

There are TWO bots, defined as `BOTS` in `js/sim.js`, and one difference
between them that matters. **dumb** presses a button at random — cooldowns
included, it does not know what a cooldown is — and throws its stat points
anywhere. **smart** presses everything the moment it is available, spreads its
points evenly one at a time, and holds whatever answers a telegraph (a stun, a
Provoke, a brace, a damage-reducing buff), spending it on the telegraph and
never on anything else. Either drops straight into `simulateRun(cls,
BOTS.smart)`.

So the gap between the columns is close to one question: what is reading the
windup worth, in waves? Measured when they were built, smart answers 79-93% of
the telegraphs it faces with no whiffs, against 0-44% for dumb.

There used to be a third, "greedy", frozen so that balance numbers quoted in
old commit messages stayed comparable. It is gone, and so are the per-strain
allocation plans the old "skilled" bot used — those turned out to decide more
about a run than the piloting did, which made the bracket a table about the
plans.

The value is the SPREAD, not any single number — a lone win rate stops saying
anything the moment it saturates. Read the columns comparatively, and remember
that a class a bot cannot pilot is not necessarily one a person cannot. What
these numbers are good for is spotting a mechanic that never engages at all,
which is how old psy's Momentum problem surfaced: the bank drained faster than
it filled, so its gated skills reported "not paid" a dozen times a run and never
fired — the finding that led to the DREAD rework.
