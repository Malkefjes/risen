# Roadmap

Where things stand and what comes next. Written 2026-07-29 so the context does
not have to be rebuilt from memory.

---

## Immediate: Psychological is non-functional

Not a tuning problem — the class cannot use its own kit.

Momentum is **+1 per landed hit, −2 per hit taken** (`momentumLossPerHit: 2`).
At the 1:1 turn anchor you land roughly one hit per hit taken, so every exchange
is **net −1** and the bank drains. It needs a turn ratio above 2.0 just to break
even. Three of psy's four skills are gated behind it — Traumatize needs 3,
Nerve Drain 2, Flow State 3 — so none of them fire.

Measured over 40 runs (`node tools/bank-usage.mjs 40`):

| strain | bank | cap | peak held | "not paid" per run | median wave | wins |
|---|---|---|---|---|---|---|
| bio | — | 0 | 0.0 | 0.0 | 5 | 11/40 |
| **psy** | MOMENTUM | 5 | **3.2** | **13.8** | **5** | **0/40** |
| sym | SPORES | 6 | 4.0 | 0.0 | 16 | 39/40 |
| base | RESOLVE | 6 | 6.0 | 0.0 | 5 | 0/40 |

It was already negative before the 1:1 anchor (−0.57/exchange at the old 1.43×
head start). The anchor did not create the flaw, it removed the free margin
hiding it.

One-constant option, if a full overhaul is not wanted yet: `momentumLossPerHit`
2 → 1. That is net-zero at parity and net-positive as soon as Speed is bought —
at ×2 rate it is +1 per exchange. Psy's card says "SPEED · MOMENTUM", and this
would make that a real mechanical relationship rather than flavour text.

A full overhaul is the stated preference. Either way, `tools/bank-usage.mjs` is
the instrument: watch "not paid" fall and "peak held" rise.

---

## Next steps, in order

### 1. Balance lab inside the game

`simulateRun` exists and is fast (~2ms per full run). What is missing is a way
to reach it **without a terminal** — the tools currently need node and a browser
driver, which is not available on the machine the game is actually played on.

A dev screen that runs N runs per strain and shows win rate, median wave, HP
curves, skill usage and bank uptime. Everything it needs is already in
`simulateRun`'s return value; this is presentation, not new mechanics.

Reach it from the title screen behind a key combo or a `?dev` URL flag so it
never appears during normal play.

### 2. Skill-effect registry

Adding a genuinely new skill behaviour currently means editing the damage
pipeline. About 20 hardcoded flags branch inside `applyPlayerDamage` and
`fireSkill`:

```
consumesResolve  consumesSpores  festers      sporeFuel     thornsScale
thornsBurst      buildsResolve   stunCost     healCost      resolveHealBonus
selfDmgFrac      thornsBoost     lifesteal    poison        requiresCharges  ...
```

Compare `STATUSES`, where a new effect is one entry and zero code. Skills
deserve the same: an effect registry keyed by name, so a new mechanic is data.

This is the one that most directly speeds up class iteration, which is the
next big stretch of work.

### 3. Enemy move-sets

The biggest pure game-design gap. The player has four skills, a bank, statuses,
cooldowns and telegraphs. **The enemy has "attack" and "wind up".** The four
archetypes differ only by hp/dmg/aps/evade multipliers — a brute and a warden
play identically, one just has bigger numbers.

Most of the machinery already exists and is unused:

- `STATUSES` is symmetric — an enemy can carry `weak`, `fortify`, `regen`,
  `haste` today; nothing applies them.
- `enemyIntent` already says: *"Add branches here when enemies gain moves beyond
  attacking (block, buff, debuff, multi-hit, …)"*.

Give each archetype 2–3 moves with distinct intents and the fights stop being
the same fight at different scales.

### 4. Split the sprites out of the source (low priority)

3.9 MB of the 4.0 MB file is base64 sprites. It does not hurt the game, but it
makes diffs enormous and the file awkward to read in one pass. A source split
with a tiny inline step would keep distribution as one self-contained file while
making development lighter. Nice-to-have, not a blocker.

---

## Also known, deliberately parked

- **Sym wins 24–30 of 30 under every allocation strategy** (`all STR`,
  `all INS`, `all SPD`, `all VIT`, `balanced`). A class whose outcome does not
  respond to the stat system is not being tested by it. Worth a look once psy
  is fixed.
- **Unmutated wins 0–1 of 30 under the scripted bot** while holding a full
  Resolve bank. That reads as the bot not banking for Last Stand rather than
  the class being broken — but it is unverified either way, so treat the base
  numbers as unmeasured rather than as evidence.
- **`ARCH_ORDER`'s fifth entry is dead code.** Index 4 is always
  `wave % 5 === 0`, which is always a boss, which forces `brute`. The `'grunt'`
  in that slot can never be selected.
- **Instinct feeds crit chance and nothing else.** Noted in the BALANCE header
  as a known thin spot.
- **Cooldown reduction is a live seam with no source.** `t.cdrBonus` still feeds
  `p.cdr` and `fireSkill` still divides by it; its readout row stays hidden
  until something grants it.
- **`goToMenu` does not clear `state.player`.** Harmless — nothing reads it
  outside combat and every run start replaces it — but it means "is a run in
  progress" cannot be answered by checking that field.

---

## Working notes

**Save versions.** `BALANCE.saveKey` is bumped only when a change makes an old
saved sheet wrong — saves store raw stats and recompute everything derived, so a
rules change silently re-reads an old run under economics it was never allocated
for. Bumping drops old saves; add the outgoing prefix to `BALANCE.oldSaveKeys`
so it is purged rather than left orphaned. **This is separate from `BUILD`**,
which is just a date so two downloads can be told apart. Never derive one from
the other.

**localStorage is keyed by origin, not by file.** Every `file://` page shares one
bucket, so a freshly downloaded copy reads the same save slots as the old one.
That is why a "new" build can show filled slots.

**The RNG has two streams.** Rules use `Math.random`; anything cosmetic uses
`cosmeticRandom()`. Keep it that way — when they were shared, drawing a damage
number shifted the next crit roll, and headless and on-screen runs of the same
fight diverged for a purely visual reason.

**Before trusting a balance change, run:**

```
npm test                        124 assertions, all suites
node tools/bank-usage.mjs 40    can each bank fill
node tools/balance-sweep.mjs 30 is a stat a build or a garnish
node tools/transcript.mjs psy   read one run turn by turn
```

The bot is deliberately naive — it fires whatever special is off cooldown. Read
the columns comparatively. What it is good for is spotting a mechanic that never
engages at all, which is exactly how psy's problem surfaced.
