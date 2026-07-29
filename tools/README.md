Read-only instruments. They print numbers and assert nothing, and none run as
part of `npm test`.

    node tools/bank-usage.mjs [runs]      can each strain's bank actually fill?
    node tools/balance-sweep.mjs [runs]   is a stat a build or a garnish?
    node tools/transcript.mjs [strain]    dump one run's combat log

All three go through `simulateRun` inside the game, so a few hundred runs
finish in the time it takes to start a browser. They used to drive the real UI
one turn at a time and took minutes per run.

The bot is deliberately naive: it fires whatever special is off cooldown and
allocates points on a fixed plan. Read the columns comparatively — a class the
bot cannot pilot is not necessarily a class a person cannot pilot. What the
numbers are good for is spotting a mechanic that never engages at all, which
is how psy's Momentum problem surfaced: the bank drains faster than it fills,
so its gated skills report "not paid" a dozen times a run and never fire.
