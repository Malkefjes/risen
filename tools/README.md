Read-only instruments. They observe the game and print numbers; none of them
assert anything and none run as part of `npm test`.

    node tools/bank-usage.mjs        can each strain's bank actually fill?
    node tools/balance-sweep.mjs     how far does each allocation strategy get?
    node tools/transcript.mjs bio    dump one run's combat log

They drive the real game in a headless browser, which is slow — a sweep takes
minutes. That is the argument for moving this capability inside the game as a
proper balance lab; these are the prototype of what it should report.

The bot is deliberately naive: it fires whatever special is off cooldown and
allocates points to a fixed plan. Read the columns comparatively, never as a
verdict on how a class plays in human hands.
