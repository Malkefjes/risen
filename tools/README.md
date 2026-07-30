Read-only instruments. They print numbers and assert nothing, and none run as
part of `npm test`.

    node tools/bot-bracket.mjs [runs]     too easy, too hard, or skill-expressive?
    node tools/bank-usage.mjs [runs]      can each strain's bank actually fill?
    node tools/balance-sweep.mjs [runs]   is a stat a build or a garnish?
    node tools/transcript.mjs [strain]    dump one run's combat log

All three go through `simulateRun` inside the game, so a few hundred runs
finish in the time it takes to start a browser. They used to drive the real UI
one turn at a time and took minutes per run.

There are three bots, defined as `BOTS` in `js/sim.js`: **dumb** mashes a random
ready skill and allocates at random, **greedy** fires the strongest thing off
cooldown on a round-robin spread, and **skilled** plays four stated habits
(answer a telegraph that actually threatens you, heal only when low, hold a stun
for a windup, spend a bank at its payoff). Any of them drops straight into
`simulateRun(cls, BOTS.skilled)`.

Two rules keep them honest. **greedy is frozen** — every balance number in this
repo's history was measured with it, so changing it would invalidate the
comparisons in old commit messages. And **skilled is not optimal** on purpose: a
searching bot would be a second implementation of the game's strategy, breaking
on every kit change, and it would encode one theory of how a class should play
and then confirm it. Skilled is a floor on competence, not a model of mastery.

The value is the SPREAD, not any single number — a lone win rate stops saying
anything the moment it saturates. Read the columns comparatively, and remember
that a class a bot cannot pilot is not necessarily one a person cannot. What
these numbers are good for is spotting a mechanic that never engages at all,
which is how old psy's Momentum problem surfaced: the bank drained faster than
it filled, so its gated skills reported "not paid" a dozen times a run and never
fired — the finding that led to the DREAD rework.
