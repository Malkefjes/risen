// Balance, build stamp, classes, talents, statuses — the numbers and tables
// ============================================================
// RISEN — balance & systems
//
// Design notes for future-you:
//
//  * A LENS, NOT A LAW, and first because it is the loosest thing here: stat
//    allocation is only a choice while you can reason about it but not solve it.
//    Too little to go on and it is a shrug; a known equation over a known run
//    and it is a preplanned button you click to get past. The dial that keeps
//    it alive is UNKNOWABILITY — a future you cannot see (which boss, which
//    draft, which drop) and picks whose worth depends on what you already took.
//    That is what mutations and items are for; the base sheet stays legible on
//    purpose so their breaks read clearly against it. But hold this loosely:
//    sometimes a flat, boring-on-paper number is exactly right because it is
//    the anchor everything else is judged against, and feel outranks the lens
//    every time the two disagree. Reach for it when a choice feels flat, not as
//    a gate every number has to pass.
//
//  * THE PLAYER IS HAND-TUNED FIRST; ENEMIES ARE FITTED TO IT. Enemy numbers
//    are a free variable — nothing constrains them but how the fight feels —
//    so they are derived from the player rather than designed alongside. It
//    also means a fight that feels wrong has one place to look instead of two.
//
//  * THE STARTING SHEET IS THE ANCHOR, and it is deliberately round: every
//    strain begins 5/5/5/5 with 25 Attack Damage, 100 HP, 1.00 turn rate and
//    10% evade / crit / block. One point is 5 damage or 20 HP. The whole point
//    is that "that hit me for 25" is legible as a Vitality point and a bit,
//    which is what makes it possible to judge an enemy by feel later.
//
//  * ONE TURN EACH IS THE DEFAULT. A baseline enemy acts at exactly the
//    player's starting rate, so wave 1 is 1:1 and the turn-rate readout means
//    something: 1.00x is even, and anything above it was BOUGHT. Every extra
//    turn now comes from a place you can point at — Speed (1.00 -> 1.79 vs a
//    baseline enemy, fully invested), or the boss/elite in front of you being
//    slow by its own stated numbers. Neither is free.
//
//    This matters more than it looks, because a kill costs a fixed number of
//    YOUR turns: skill cooldowns tick on your own turns rather than a clock,
//    so turn advantage never speeds up your rotation. All it does is decide
//    how much the enemy gets to do inside it. Turn rate is therefore a
//    mitigation stat wearing an offensive costume, and handing out +43% of it
//    on a fresh sheet was handing out free damage reduction on top of block.
//    (psy leans on this harder than anyone — its DREAD slows the enemy's side
//    of the ratio, so the class literally plays the mitigation-in-costume
//    game as its kit — but the rule itself holds for all four.)
//
//  * ANYTHING DERIVED HANGS OFF THOSE ANCHORS rather than carrying its own
//    curve. Ailment damage is a fifth of Attack Damage, thorns a twentieth of
//    max HP — chosen as the smallest fractions that move by exactly 1 per
//    point. Retuning an anchor carries them along instead of leaving them
//    behind, which is exactly how they drifted before.
//
//  * Player and enemy stats are computed by SEPARATE functions. Enemies used
//    to run through the player's derived-stat formulas, which meant that by
//    wave 30 every enemy sat at capped evade/block/crit and roughly two thirds
//    of your damage vanished before it landed.
//
//  * Damage is LINEAR in Strength, for every strain. Speed raises attack rate
//    but saturates. INSTINCT IS THE ONE SANCTIONED QUADRATIC: it buys crit
//    chance and crit damage with the same points, so its expected damage goes
//    as the square of the stat. That is the only way a crit stat can reach a
//    linear damage stat at all — crit chance against a fixed multiplier is
//    bounded by that multiplier, so it can never chase Strength no matter the
//    rate. The exception is bounded in practice by the crit-chance cap and by
//    the point budget: the two land together at full investment rather than
//    Instinct running away. The numbers, and the crossover, are in the INSTINCT
//    block below. Nothing else may do this without the same argument.
//
//  * Strains currently differ ONLY by their skills and banks. Damage, HP,
//    turn rate and every percentage are identical across all four — the
//    per-strain damage and attack-rate scalars were retired when the sheet was
//    anchored, and the per-strain apsBase went with them when turn rate became
//    a pure stat. A strain that should be fast again wants a MULTIPLIER on the
//    rate, never an additive base: a base hands out speed nobody paid for,
//    which is exactly what the 1:1 anchor exists to prevent.
//
//  * Mutations prefer to scale p.dmgMult / p.hpMult / p.apsMult over touching
//    a raw stat, so one pick cannot quietly buy two things. Bumping a raw stat
//    is allowed where that stat is a single axis — Strength is, since Attack
//    Damage was unified — but it is the exception and wants saying out loud.
//
//  * EVERY STAT OWNS A VERB, and they are deliberately different ones:
//    Strength hits harder and steadily, Vitality survives, Speed acts more
//    often than the thing in front of you, Instinct hits harder but spikily.
//    Instinct's is the weakest of the four as a VERB, because it shares an axis
//    with Strength rather than owning one, and that is knowingly temporary — the
//    two notes below are where it goes. What it must never go back to is what
//    killed it: feeding crit chance alone against a fixed multiplier, which made
//    it a strictly worse Strength that no rate could rescue.
//
//  * TWO THINGS ARE PARKED FOR INSTINCT, both waiting on the same thing: the
//    strains being finished. Neither is a to-do, and neither should be picked up
//    because it is written down here — they land when the classes feel right.
//
//      1. A CRIT FEEDS YOUR STRAIN — built, wired, and switched off at
//         critBankGain: 0 for sym, base and bio. PSY ALREADY LIVES THIS RULE:
//         its crits plant DREAD on the enemy, as the kit itself rather than the
//         parked scaffold (see creditCrit). Psy is the proof of concept the
//         others can be judged against before the knob turns for them.
//      2. INSTINCT SCALING WHAT A CHARGE IS WORTH — not built. The DREAD slow
//         per stack, reduction per Resolve, the thorns multiplier, poison per
//         stack: the magnitudes that are flat constants today (dreadSlowPerStack,
//         resolveDR, thornsFrac, ailmentDamageFrac).
//
//    They stack rather than compete — the first is how fast a bank FILLS, the
//    second is what a charge PAYS — and both are off for the same reason: a stat
//    that accelerates or inflates a mechanic makes that mechanic impossible to
//    judge. Two cautions for whenever the second one lands: it must not make
//    Instinct mandatory for every strain (a stat you must take is as dead as one
//    you never take), and thorns and poison are shares of the HP and damage
//    anchors, so scaling them by a stat means those anchors stop carrying them
//    for free.
//
//  * Known soft spots, in case they read as bugs rather than gaps: cooldown
//    reduction is a live seam with no source yet (no talent sets cdrBonus, so
//    its readout row stays hidden); and healing outside class kits is down to
//    two 8% trickles — between fights and on level-up — since regen and the
//    door's RECOVER both went.
// ============================================================

// ---- Build ----------------------------------------------------
// A date, because the only question it has to answer is "which of these files
// is the newer one". No changelog and no semantic versioning: this is a
// personal project under heavy change, nothing is settled, and a list of every
// tweak would be a chore to write and a thing nobody reads. Git already holds
// the detail. For a second build on the same day, suffix a letter.
//
// Shown under the logo, written as the first line of every run's combat log,
// and stored in the save — so a file, a pasted transcript and a save can each
// say what produced them.
//
// KEEP THIS SEPARATE FROM BALANCE.saveKey. That one answers "are saved runs
// still valid" and is bumped only when a change makes an old sheet wrong.
// Deriving it from this would wipe every save on a typo fix.
const BUILD = '2026-07-30j';

const BALANCE = {
  player: {
    // TURN RATE IS PURELY A STAT, exactly like damage and HP. 5 Speed is 1.00,
    // one point is +0.20, and there is NO FLAT BASE — the strain's old 0.85
    // apsBase is gone.
    //
    // That base was the whole problem. It meant a starting 1.00 rate was
    // 0.85 given + 0.15 earned, so a Speed point moved your rate by 3% of its
    // starting value where a Strength point moves damage by 20% and a Vitality
    // point moves HP by 20%. Speed points were worth a seventh of everyone
    // else's, and a full run's 36 points could only take the rate to x1.55
    // against x8.2 for either of the others. Speed was a garnish, not a build.
    //
    // With the base gone every stat obeys ONE rule: a stat is (5 + points) / 5
    // times its starting value. 20% per point, across the sheet.
    apsPerSpeed: 0.20,
    // TWO CEILINGS, doing different jobs:
    //   speedApsCap  what SPEED POINTS alone can buy. Reached at 20 Speed (15
    //                points), and deliberately x4 rather than the x8.2 parity
    //                would allow: boss windups fire every 3 ENEMY actions, so
    //                at x4 you already get 12 turns to answer one, and past
    //                that the telegraph stops being a decision.
    //   apsCap       absolute ceiling AFTER apsMult. Leaves headroom so any
    //                earned multiplier still pays out for a player who has
    //                capped the stat itself. Nothing sets apsMult today; this
    //                is the room for whatever does.
    // Points past 20 are not wasted: they keep buying evade below, so
    // overinvestment degrades gently instead of hitting a wall.
    speedApsCap: 4.00, apsCap: 6.00,
    // The two anchors the rest of the player is tuned against, both chosen to be
    // legible rather than derived: 5 Strength is 25 Attack Damage, 5 Vitality is
    // 100 HP. Everything reads off one point being worth 5 damage or 20 HP, so
    // "that hit me for 25" is a Vitality point and a bit, not an abstract number.
    //
    // No flat base and no per-level HP on purpose. Both would make max HP stop
    // being Vitality x 20 the moment you levelled, which is the whole property
    // worth having here. Turn rate now follows the same rule above.
    damagePerStr: 5,
    hpPerVit: 20,
    // Three, and this time the TOTAL shrank on purpose: ~6 levels x 3 is
    // ~18 points across act 1 against the ~48 the old one-act game gave
    // (a full two-act run reaches ~L10 — 27 points — the last three levels
    // arriving one per act-2 rank). The
    // shower was the imbalance — at 48 points the sanctioned Instinct
    // quadratic was landing 600-damage crits at level 9 against a captain
    // swinging 62, power no half-hour of play had earned — so the sheet
    // comes down to meet the enemies, and the enemies are deliberately NOT
    // softened to chase it back up. Three is the smallest grant where
    // allocation still has shape (commit all three, or lean 2-1; one point
    // would collapse the choice to "whose turn is it"), and a level still
    // buys a legible jump: +15 damage, or +60 HP.
    pointsPerLevel: 3,
    // The percentage stats are set so a starting sheet reads 10 / 10 / 10 / 0
    // at 5 in every stat — the same round-number treatment as 25 damage and
    // 100 HP. Evade and block still look odd on their own (0.075, 0.065)
    // because each is "10% minus whatever the starting 5 points already
    // contribute"; their per-point rates are untouched, since Speed's second
    // axis wants defining before it wants retuning. Crit no longer needs the
    // trick — see below.
    evadeBase: 0.075, evadePerSpeed: 0.005, evadeCap: 0.40,
    blockBase: 0.065, blockPerVit: 0.007, blockCap: 0.35, blockReduction: 0.5,
    // ---- INSTINCT ---------------------------------------------------------
    // INSTINCT IS THE COMMIT STAT: it buys crit CHANCE and crit DAMAGE at the
    // same time, which makes it the one stat that is quadratic in its own
    // points. That is a DELIBERATE, SANCTIONED exception to the header rule
    // against quadratic stats — see the note up there — and it exists because
    // nothing else could make Instinct worth taking.
    //
    // The arithmetic that forced it. Crit chance against a FIXED multiplier is
    // bounded: at any cap below 1.0 the whole stat can only ever add its
    // multiplier's worth of damage, so at x2 and a 70% cap Instinct's entire
    // lifetime contribution was x1.70 — roughly three and a half Strength
    // points. Strength is unbounded and linear, so a bounded stat cannot chase
    // it at any rate. To match Strength, crit has to be a real multiplier on
    // both terms, and two linear terms multiplied is a square.
    //
    // Both rates are picked so the two stats LAND TOGETHER at full investment.
    // The table below is what a point actually buys, and the one trap to avoid
    // when re-deriving it: A STRENGTH BUILD CRITS TOO. It keeps the starting 5
    // Instinct, so it swings at x1.125 expected before it spends anything, and
    // comparing raw expected damage against Strength's x9.0 double-counts that.
    // Both columns are therefore GAIN OVER THE SAME STARTING SHEET, which is
    // the only comparison a player could feel.
    //
    //     Instinct   crit%   crit dmg   its gain    all-Strength, same points
    //        5        10%      x2.25      x1.00           x1.00
    //       15        30%      x4.75      x1.89           x3.00
    //       25        50%      x7.25      x3.67           x5.00
    //       35        70%      x9.75      x6.33           x7.00
    //       40        80%     x11.00      x8.00           x8.00   <- dead level
    //       45        90%     x12.25      x9.89           x9.00
    //
    // So Strength is the better buy for the first 35 points, the two are exactly
    // level at 40, and Instinct ends a full run about 10% ahead. That shape is
    // the point: a square and a line cross ONCE, so wherever the crossing is
    // put, one stat is behind on one side of it. Putting it near the end makes
    // Instinct a commitment that pays rather than a garnish or a trap —
    // half-investing really is worse than not, and that is allowed to be true
    // as long as the sheet shows both numbers climbing while you do it.
    //
    // WHAT IT COSTS: variance. By the end of an Instinct run one hit in ten
    // lands for a twelfth of the others, which can lose a boss. That is the
    // trade being sold, and it is why Strength stays the safe pick.
    critBase: 0.00, critPerInstinct: 0.02, critCap: 0.90,
    // THE CAP IS 0.90 AND NOT 1.00 ON PURPOSE. A crit that always happens is
    // not a crit: the gold CRIT floater is the loudest thing on screen, and if
    // every hit wore it the colour would stop naming an event (see the floater
    // vocabulary above .float-dmg in the CSS). One plain hit in ten is what
    // keeps the gold meaning something.
    //
    // The cap arrives at 45 Instinct, which is about what a full run can reach,
    // so it is a ceiling you touch rather than one you sit against. Points past
    // it still buy crit damage below, so nothing is ever wasted.
    critMultBase: 1.0, critMultPerInstinct: 0.25,   // crit damage = x(1 + 0.25 x Instinct)
    // A CRIT FEEDS YOUR STRAIN — PARKED AT 0 for sym, base and bio; LIVE for
    // psy, whose crits plant DREAD as the kit itself (Hunt's dreadOnCrit, not
    // this knob — see creditCrit for how the two routes share one function).
    //
    // The rule: a crit banks a charge of whatever the strain runs on — a Spore,
    // Resolve, or a poison stack. It is the better long-term answer for this
    // stat, because "my mechanic is online" is a verb Strength cannot buy at
    // any price, and psy is now the living argument for it.
    //
    // Off for the other three because THEIR designs are still being judged. A
    // stat that accelerates a mechanic makes that mechanic harder to read, so
    // Instinct pays them in crit alone until each stands up on its own.
    //
    // Set this back to 1 to switch it on for them. Nothing else needs touching —
    // creditCrit and its call site in applyPlayerDamage are still wired, and
    // the readouts are unaffected.
    critBankGain: 0,
    // COOLDOWN REDUCTION IS NO LONGER A STAT. Speed does not feed it and
    // nothing else does yet, so cdrPerSpeed is gone rather than sitting at 0.
    //
    // Speed was the obvious home for it and is the wrong one, because Speed
    // already covers the feeling by another route. Cooldowns tick on the
    // PLAYER'S OWN turns (see tickTurnStart), so rate never changes your
    // rotation — a 4-turn cooldown is 4 of your turns at x1 and at x4. What
    // rate changes is how much the enemy does while you wait: 4 enemy actions
    // at x1, one at x4. Stacking real CDR on top would be paying twice.
    //
    // The mechanic itself stays as a live seam: cdrCap and t.cdrBonus still
    // feed p.cdr, and fireSkill still divides cooldowns by it. The readout row
    // renders only when cdr > 0 (same conditional treatment as the strain and
    // guard rows), so it shows nothing today and appears by itself the moment
    // a mutation grants some.
    cdrCap: 0.55,
    // Ailment damage is a SHARE OF ATTACK DAMAGE rather than its own curve off
    // Strength, and thorns a share of max HP. Both were fractions-per-stat
    // tuned against the old base, which at 5 left them floored at 1 and needing
    // three levels of pure Strength to move at all.
    //
    // The fractions are the smallest ones that step cleanly: Attack Damage
    // moves in 5s, so a fifth of it moves in exact 1s; max HP moves in 20s, so
    // a twentieth moves in exact 1s. Every point is worth exactly +1, and
    // nothing is lost to rounding. They also track the anchors for free —
    // retune damage or HP and the ailments follow instead of drifting.
    ailmentDamageFrac: 0.20,
    thornsFrac: 0.05,
    // POISON is permanent and UNCAPPED — the stack count is bio's ramp, and
    // the ramp is the class: no burst, the enemy's remaining life is a clock.
    // (It was capped at 6 with an overflow-to-TOXIN amplifier; the cap
    // flatlined the ramp by turn 3 and TOXIN was an invisible 8%-of-a-
    // modifier. Both retired in favor of the visible number going up.
    // Chitin's numbers live on the skill card, like Miasma's.)
    // Bleed: the same damage-over-time shape as poison, its own knobs so the
    // two can be tuned apart. Nothing applies bleed yet.
    bleedStackCap: 6, bleedDuration: 4,      // TURNS
    reflectFrac: 0.20, reflectSpinesMult: 2,   // sym: share of damage taken reflected back; doubled while Spines is up
    sporeBigHitFrac: 0.15, sporeHitMax: 3,     // sym: every 15% of max HP lost in one hit plants an extra Spore (cap per hit)
    // The level-up heal is load-bearing sustain and has tracked the level
    // curve through both compressions: 16 levels x 8% was ~128% of max HP a
    // run, and 8 x 15% kept that economy whole (~120%). At ~6 levels the
    // fraction deliberately STAYS 15% (~90% a run): the point-scarcity pass
    // wants the whole run poorer, and free healing is part of the shower.
    levelUpHealFrac: 0.15, recoverHpFrac: 0.08,
    // ---- DREAD (psy) ------------------------------------------------------
    // Psy's mechanic LIVES ON THE ENEMY, not on the player — the one bank in
    // the game that is a mark, not a wallet. Momentum (a player-side bank of
    // +1 per hit landed, −2 per hit taken) died of an identity contradiction:
    // the kit punished being hit in a game whose 1:1 anchor guarantees being
    // hit, so the bank mathematically drained no matter how well you played.
    // Flipping the number onto the enemy resolves every piece of it at once:
    //   - the theme reads true (you are not "in flow", THEY are coming apart);
    //   - taking a hit still hurts psy — the enemy that lands a blow regains
    //     its nerve — but as the enemy's recovery, not your tax;
    //   - fear dies with the enemy, so psy ramps fresh and fast every fight
    //     where bio ramps slow and permanent. Two infections, two speeds:
    //     bio's mark eats the enemy's HEALTH, psy's mark eats their TURNS.
    // Each stack slows the enemy's rate, which the turn-rate readout shows as
    // the ratio climbing — dominance you can watch. The slow is capped by the
    // stack cap; without one an enemy could be slowed toward never acting,
    // which is a stun without the stun's price.
    // Each stack does TWO things, named on one badge: the enemy hesitates
    // (−rate) and its guard opens (+damage taken). The pair is what makes
    // DREAD offense and defense at once — slow alone was mitigation wearing
    // an offensive costume (see the turn-rate note above), and a terror class
    // with no teeth measured exactly like it sounds: first pass shipped slow
    // only, and psy's own best-stat builds died on wave 3 doing 25s into a
    // 900 HP boss. Fear has to make the kill faster, not just later.
    dreadCap: 6,             // stack ceiling — bounds the slow at 30% and the open guard at 24%
    dreadSlowPerStack: 0.05, // each stack: −5% enemy turn rate
    dreadVulnPerStack: 0.04, // each stack: +4% damage the enemy takes — terror opens the guard
    dreadLossPerHit: 1,      // an enemy that lands a hit on psy steadies: sheds this many stacks
    // PSY'S SUSTAIN: CONSUMED FEAR FEEDS YOU. HP carries across fights in this
    // game, so a class without a faucet doesn't lose fights, it loses RUNS to
    // arithmetic — every kit needs one (owner's rule, learned by psy bleeding
    // out across waves with only the two 8% trickles). Psy's faucet is DEVOUR:
    // whenever DREAD is consumed — by Kill, or left on an enemy at the moment
    // it dies — each stack heals this share of max HP. One rule, two exits for
    // the same meal, chosen per fight: Kill eats the fear early as burst AND
    // food, or you let it ride and drink it whole off the corpse.
    //
    // Stacks SHED when the enemy steadies itself feed nothing: fear lost is
    // not fear eaten. Getting hit costs psy the meal along with the control,
    // which is the class's "don't get hit" pole enforced a third way.
    //
    // Sustain through the mechanic means sustain through the class stats —
    // Instinct and Speed plant the fear, so they now buy staying power too,
    // which is what finally lets a teeth-first psy live without renting Vit.
    dreadFeedFrac: 0.03,     // heal per DREAD consumed, as a share of max HP (18% for a full 6)
    // THE SIPHON: fear feeds you passively while it sits on them — each stack
    // heals this share of max HP at the start of each of YOUR turns. On the
    // player's turns, not the enemy's, deliberately: the slow means a marked
    // enemy gives you MORE turns, so the siphon scales with the turn advantage
    // the stacks already bought instead of being starved by it. The mirror of
    // poison completes: bio's mark ticks damage out of the enemy on a clock,
    // psy's mark ticks health into you on one. DEVOUR stays the burst half —
    // the siphon is the drip that keeps a marked fight from being pure
    // attrition against a class with no bandage.
    dreadSiphonFrac: 0.005,  // heal per DREAD on the enemy, per player turn (3%/turn at a full 6)
    sporeCap: 6,           // sym: Spore bank ceiling
    resolveCap: 6,         // Unmutated: Resolve bank ceiling
    resolveDR: 0.03,       // Unmutated: each held Resolve = 3% flat damage reduction (18% at cap)
    resolvePerHit: 1,      // Unmutated: Resolve gained whenever you take a hit
    reloadHpFloor: 0.15    // deliberate mercy: continuing a run never puts you below this
  },
  enemy: {
    // ---- WHY THIS TABLE CANNOT OPEN THE BRACKET (a read, not a plan) ------
    // The bot bracket calls bio, psy and sym TOO EASY — the DUMB bot wins
    // ~98% — and no knob in this table can change that verdict, because the
    // margin it would have to eat is sustain, and strain sustain is a share
    // of max HP that does not care when it is cast. Measured (dumb bot, per
    // run): bio takes ~740 damage and heals ~550 back (Miasma's regen is
    // ~475 of it, full value on cooldown-mash), sym takes ~1320 and heals
    // ~875, psy takes ~500 and siphons/devours ~375. Every loss any bot
    // suffers is at wave 15; waves 1-14 kill nobody. Proportional sustain
    // cancels proportional damage at any multiplier, so raising this table
    // only reorders who drowns first. Both obvious raises were tried and
    // measured before being reverted:
    //   - elites at 2x chance, windup on the 2nd action: win rates unmoved.
    //     Heavies land on full bars the loop refills — and elite XP at 1.7x
    //     is itself a buff, so more elites made base EASIER, not harder.
    //   - trashDmgMult 1.45 -> 1.75 on top: the three strains' dumb bots
    //     still won 83-96% while base skilled sank to 38% — the one class
    //     whose sustain is flat and rare drowns first, every time.
    // If autopilot wins should stop, the seam is in the KITS: sustain has to
    // care about timing before enemy numbers can matter. Base already lives
    // this (Bandage is all it has), which is why base is the only class the
    // bracket calls hard — the enemy table is fitted against timing-immune
    // healing three of the four classes carry.
    //
    // ---- THE TIER STEP ----------------------------------------------------
    // A TIER BOUNDARY MUST BE A STEP, AND IT USED TO BE FLAT — arithmetically,
    // not just in feel. With withinStep 0.13 the drift across a tier's five
    // waves came to 4 x 0.13 = 0.52, which is EXACTLY tierGrowth 1.52 minus
    // one, so wave 5 and wave 6 had identical growth factors (g = 1.520), as
    // did 10 and 11 (2.310). Rank II walked in carrying precisely the numbers
    // Rank I walked out with. The boss was the only thing between them.
    //
    // Now the drift is gentle (+6% a wave) and the boundary is a real jump:
    // wave 4 to wave 6 is +57%. Within a tier you are grinding down a known
    // quantity; the wave after a boss is a heavier CLASS of thing, which is
    // what the rank in its name has been promising. Set withinStep x 4 well
    // BELOW tierGrowth - 1 or the step flattens again.
    //
    // hpBase carries the general buff (132 -> 160) but HP is the weakest
    // difficulty lever there is: measured, +60% enemy HP left bio, psy and sym
    // winning 30/30 — a sponge is a longer fight, not a harder one, which is
    // the same lesson that retired COLOSSAL. Damage and rate below are what
    // actually threaten a class that sustains.
    hpBase: 160, tierGrowth: 1.85, withinStep: 0.06,
    // dmgExp WAS 0.88 — enemy damage grew SUBLINEARLY in the growth factor
    // while player HP grows linearly in allocated points, so every wave the
    // enemy fell further behind the pool it was hitting. At 1.00 damage tracks
    // growth exactly and a late trash mob stays a real cost. trashDmgMult
    // 1.33 -> 1.45 on top, because the level compression handed players a
    // bigger pool per wave to spend.
    dmgBase: 8, dmgExp: 1.00,
    // ---- TURN-RATE ANCHOR -------------------------------------------------
    // apsBase MATCHES THE PLAYER'S STARTING RATE ON PURPOSE. A fresh sheet is
    // 0.85 + 0.15 from its 5 Speed = 1.00, and a baseline enemy is 1.00, so
    // wave 1 is one turn each. It used to be 0.70, which handed every new
    // character a free +43% action economy before they had spent anything —
    // and since a kill costs a fixed number of YOUR turns (cooldowns tick on
    // your own turns, not a clock), that advantage was really 30% free damage
    // mitigation stapled to the starting sheet.
    //
    // Anchoring here rather than by lowering the player's apsBase keeps the
    // player sheet round (25 damage, 100 HP, 1.00 rate), and rate multipliers
    // read directly as turns-per-player-turn.
    //
    // PREVIOUS VALUES, if this wants reverting as one block:
    //   apsBase 0.70, apsPerTier 0.018, apsCap 1.5,
    //   bossDmg 2.0, trashDmgMult 1.9
    apsBase: 1.00,
    // WAS 0.026, which was a rounding error dressed as a mechanic: a baseline
    // enemy drifted 1.00 -> 1.05 across an entire run, so "standing still on
    // Speed loses you the tempo" was technically true and completely
    // unfeelable. At 0.070 a Rank III enemy acts 1.14x per player turn — still
    // small beside what Speed can buy (up to 4x), which is the point: Speed
    // remains the answer, but now there is a question. It also gives the tier
    // step a second dimension, so a new rank is faster AND heavier.
    apsPerTier: 0.070,
    apsCap: 2.15,                      // same base-to-cap headroom as the old 0.70 / 1.5
    crit: 0.10, critMult: 1.5,
    // bossDmg and trashDmgMult were both fitted against a player taking ~1.5
    // turns per enemy turn. With the anchor at 1:1 the enemy now acts far more
    // often per fight, so both come down to keep a wave costing what it cost.
    // These are the compensation for the anchor, not a difficulty change: total
    // unmitigated HP spent clearing all 15 waves lands within 2% of before.
    // bossHp/bossDmg/bossAps once carried the boss's old brute chassis (x1.55
    // hp, x1.30 dmg, x0.72 rate), folded in when archetypes were removed. HP has
    // since come DOWN from that 5.27 to soften the FIRST boss specifically — see
    // the windup note below for why wave 5 was the wall — which shortens every
    // boss fight a little; bossDmg and bossAps are still the old chassis.
    bossHp: 4.5, bossDmg: 1.82, bossAps: 0.72, bossXp: 3.0,
    trashDmgMult: 1.45,                // trash hits harder so fights cost real HP (bosses use bossDmg)
    // WINDUP WAS 6.5 AND IT MADE WAVE 5 A WALL. The multiplier is flat across
    // all three bosses, but the player's HP pool is SMALLEST at the first one,
    // so the same multiple bites hardest exactly where you have the least to
    // spend it against: at 6.5 the wave-5 telegraph hit for 137 against a
    // starting pool of 100, i.e. a near-certain one-shot on a hit you could see
    // coming but rarely fully answer that early. A telegraph should cost you
    // half your bar and a turn spent reacting, not the run. At 4.5 it landed
    // for ~95 and base's wave-5 clear rate went 18% -> 80% (greedy bot).
    //
    // NOW 5.0, and the reasoning above is exactly why it can move: that note
    // said the honest way to make the telegraph bite harder is a bigger pool to
    // spend it against, and the level compression delivered one — six points a
    // level means a player arrives at wave 5 holding more Vitality than the
    // 4.5 tuning assumed. This is that promised adjustment, not a reversal of
    // it. The ceiling still stands: if it ever needs to be scarier again, add
    // pool, not multiplier.
    //
    // THE POINT-SCARCITY PASS THEN SHRANK THE WAVE-5 POOL AGAIN (a player
    // reaches the first boss at L3 with ~6 points now, not L5 with ~24), so
    // 5.0 stands on a thinner premise than when it was set. Deliberate: the
    // whole pass makes the run poorer and the game harder. But if the first
    // boss reads as a wall again in play, this multiplier comes back down
    // FIRST, before any other lever moves.
    windupEvery: 3, windupMult: 5.0,   // boss telegraph: every Nth action winds up; next strike hits xN
    finalWindupEvery: 2,               // the final boss keeps you under constant telegraph pressure
    eliteWindupEvery: 3,               // elites telegraph too: the mid-run skill check
    eliteBaseChance: 0.16, eliteChancePerWave: 0.006, eliteChanceCap: 0.40
  },
  // FEWER STILL, AND POORER — the second compression. The first (16 levels
  // -> 8) fixed the BEAT: a level became rarer than a kill. But it kept the
  // ~48-point budget, and the budget was the remaining lie — see the note on
  // pointsPerLevel. This one fixes the BUDGET: ~6 levels x 3 points. Income
  // knobs are untouched, as before — pacing lives in the cost curve only, so
  // the XP readout on a kill still means what it meant.
  //
  // TWO REGIMES, because the first level is a HOOK and the rest are EARNED.
  // firstCost sits just under the wave-1 kill's 61 XP so the first kill
  // still levels you — that beat is cheap to keep and teaches the loop —
  // and then the curve restarts fat and quadratic from level 2. One formula
  // could not price both: the gap between "one kill" and "the first boss"
  // is a 10x cliff no smooth curve crosses without wrecking one end.
  //
  // Sighted against the income timeline (cumulative trash+boss XP by wave,
  // no chain): L2 on the first kill, L3 lands ON the first boss, L4 ~w8,
  // L5 ON the second boss, L6 ~w13, L7 paid by the act-1 finale. Act 2
  // breathes slower on the same curve — L8 ~w19, L9 ~w23, L10 ~w26,
  // roughly one level per rank — and L11 sits beyond the run's income, by
  // curve rather than by cap. Chains and elites drag every beat earlier,
  // which stays the right reward.
  xp: { firstCost: 58, base: 485, pow: 2, powScale: 35,
        killBase: 46, killWave: 15, killTier: 36 },
  combo: { maxEnemyActionsPerKill: 3, xpPerStack: 0.05, maxStack: 20 },   // chain continues if the kill let the enemy act <= N times (speed-fair)
  bossEvery: 5,          // boss on every Nth wave
  talentEvery: 5,        // choose a mutation every Nth level
  finalWave: 30,         // beating this wave's boss wins the run (act 2's finale)
  spawnDelay: 0.16,
  // saveKey is a PREFIX, not a key: each slot stores under `<saveKey>_s<n>`.
  //
  // BUMP THE VERSION WHENEVER A CHANGE INVALIDATES A SAVED SHEET. A save stores
  // raw stats and recomputes everything derived on load, so a rules change does
  // not corrupt an old run — it silently RE-READS it under economics it was
  // never allocated for. v3 -> v4 covers the 1:1 turn anchor, turn rate
  // becoming a pure stat, and the mutation pool being cleared: a sheet with 7
  // Speed saved under v3 loaded back at 1.40x where it was built at ~1.06x.
  //
  // v4 -> v5 is Instinct: crit chance became a flat 2%/point off no base with
  // the cap raised to 90%, and crit damage started climbing with the same
  // points instead of sitting at a flat x2. A v4 sheet with 20 Instinct was
  // allocated for 26% crit at x2 and would load back at 40% crit at x6 — the
  // same shape of silent re-read the Speed bump was, and a much bigger one.
  //
  // Only ONE bump for the whole of the Instinct work, deliberately. The crit
  // numbers moved twice while it was being tuned, but v5 was never a build
  // anybody played, so a second bump would have purged nothing and cost every
  // player another set of empty slots. What a save key answers is "can a sheet
  // saved by a build people PLAYED still be read", so it moves once per shipped
  // change in economics, not once per edit.
  //
  // v5 -> v6 is the level compression: the cost curve went quadratic, a level
  // now grants 6 points instead of 3, and a full run lands ~8 levels instead
  // of ~16. A v5 sheet leveled and allocated on the old cadence — its level
  // number, banked points and xpNext all describe a progression that no
  // longer exists.
  //
  // v6 -> v7 is the point-scarcity pass: 3 points a level instead of 6 and
  // the cost curve stretched to ~6 levels a run, so a v6 sheet carries
  // roughly twice the allocated points the new economy can ever grant — the
  // same silent re-read as every bump before it, in the richer direction.
  //
  // v7 -> v8 is the two-act world: the run doubled to 30 waves and the act
  // structure moved under every wave a save stores, so a v7 run describes a
  // game that ended where act 1 now hands over to the Encampment.
  //
  // Bumping also gives every player empty slots on the next load, which is the
  // honest outcome — those runs are not playable as the game now works.
  saveKey: 'risen_run_v8',
  // Storage keys from older versions, cleared once on load so they cannot
  // accumulate invisibly. Oldest first; add the outgoing prefix here on a bump.
  // Slot keys are listed explicitly because the purge removes literal keys.
  oldSaveKeys: ['risen_run_v3', 'risen_run_v3_s1', 'risen_run_v3_s2',
                'risen_run_v4', 'risen_run_v4_s1', 'risen_run_v4_s2',
                'risen_run_v5', 'risen_run_v5_s1', 'risen_run_v5_s2',
                'risen_run_v6', 'risen_run_v6_s1', 'risen_run_v6_s2',
                'risen_run_v7', 'risen_run_v7_s1', 'risen_run_v7_s2'],
  saveSlots: 2
};

// Each strain: linear damage off Strength scaled by its own `power`, its own
// base attack rate,
// and one signature mechanic that is NOT a hidden damage multiplier.
//
// Editing a skill: every `desc` is an fmtDesc template, never prose with the
// numbers typed in. Put the value in a field and reference it ({power%},
// {poison#poison stack}) so the card cannot contradict the skill when it gets
// retuned. The card is sized for roughly two to four lines of description —
// shorter leaves a gap above the status line, longer grows the whole row
// (.skill-btn has a min-height floor, so nothing is ever clipped).
const CLASSES = {
  bio: {
    name: 'Biological', color: 'bio',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      { id:'slash', name:'Slash', desc:'Attack the enemy for {power!} damage. +{poison} POISON', type:'attack', power:1.0, poison:1, target:'enemy', basic:true },
      { id:'infest', name:'Infest', desc:'Attack the enemy for {power!} damage. +{poison} POISON', type:'attack', power:0.50, poison:4, target:'enemy', cdTurns:3 },
      { id:'chitin', name:'Chitin', desc:'For {duration#turn}: take −{power%} damage. POISON on the enemy ticks twice per turn', type:'buff', buff:'chitin', duration:3, power:0.40, target:'self', cdTurns:5 },
      { id:'miasma', name:'Miasma', desc:'For {duration#turn}: regenerate {power%} of max HP each turn. The enemy is WEAK for {weak.duration#turn}', type:'buff', buff:'regen', duration:4, power:0.10, applies:[{ id:'weak', power:0.25, duration:3 }], target:'self', cdTurns:5 }
    ]
  },
  // THE TERROR MUTANT. Psy's mechanic is DREAD, a mark stacked ON THE ENEMY —
  // see the DREAD block in BALANCE for why the number moved off the player and
  // what killed Momentum. The kit is four verbs in order: Hunt (crits and
  // dodges plant fear), Terrify (seize control — a burst of stacks, each one
  // slowing the enemy's turn rate), Traumatize (at 3+ DREAD the mind breaks:
  // stun), Kill (cash every stack in as damage — and with the fear spent, the
  // enemy speeds back up, so the finisher is a real decision, not a rotation
  // button). Its sentence: "you were beaten before I ever touched you."
  //
  // The class's stats are Speed and Instinct, enforced by hunger rather than
  // by a discount: Instinct is the engine (crits plant DREAD), Speed is both
  // halves of the ratio (your rate up, their whiffs planting more fear via
  // dodges), and every point of Vit is a point the engine didn't get. Squishy
  // because you chose teeth over hide, not because the sheet says so.
  //
  // Sustain is DEVOUR, never a bandage: consumed fear feeds you (see
  // dreadFeedFrac). The first pass shipped no heal at all on the theory that
  // control was enough — wrong for this game, because HP carries across
  // fights, so kit-less sustain means losing runs to arithmetic rather than
  // to fights. The failure state still bites: an enemy that steadies itself
  // sheds fear without feeding you, so getting hit costs control AND dinner.
  psy: {
    name: 'Psychological', color: 'psy',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      { id:'hunt', name:'Hunt', desc:'Auto. Attack the enemy for your Attack Damage. Your crits and your dodges plant +{dreadOnCrit} DREAD.', type:'attack', power:1.0, dreadOnCrit:1, dreadOnEvade:1, target:'enemy', basic:true },
      // Plants 4, one MORE than Traumatize needs, so the advertised combo
      // survives one steadying hit: at the 1:1 anchor the enemy usually lands
      // a blow between your Terrify and your Traumatize, shedding a stack —
      // at +3 the threshold arrived already broken and the stun read as a
      // skill that didn't work.
      { id:'terrify', name:'Terrify', desc:'Attack for {power!} damage and plant +{dread} DREAD. Every stack slows the enemy and opens its guard.', type:'attack', power:0.50, dread:4, target:'enemy', cdTurns:3 },
      { id:'traumatize', name:'Traumatize', desc:'Attack for {power!} damage. Against {dreadNeed}+ DREAD the mind breaks: stunned for {stun#turn}.', type:'attack', power:0.95, stun:1, dreadNeed:3, target:'enemy', cdTurns:4 },
      { id:'kill', name:'Kill', desc:'Attack for {power!} damage, +{perDreadPower!} per DREAD consumed, and DEVOUR the fear: heal {feedPerDread%} of max HP per stack. Spends ALL the enemy’s DREAD.', type:'attack', power:1.20, perDreadPower:0.60, consumesDread:true, feedPerDread:BALANCE.player.dreadFeedFrac, target:'enemy', cdTurns:5 }
    ]
  },
  // WHY SYM FEELS OFF, for whenever its pass comes (a read, not a plan): its
  // bank is Resolve wearing a coat. Spores are gained by taking hits, held,
  // and spent for a heal (Feed) or a burst (Erupt) — that is Unmutated's loop,
  // and hold-vs-spend is HIS identity. Meanwhile the part of sym that is
  // actually unique — thorns, the enemy hurting itself on you — is passive and
  // merely happens. So sym plays like a worse base with a passive stapled on.
  // The direction worth trying: bio ramps a number on the ENEMY (poison); sym
  // should ramp a number on ITSELF — the organism grows over the fight, every
  // hit fed to it making it bigger, spikier, harder. Spores as growth, not as
  // a wallet. Erupt is the most base-shaped thing in the kit (spend bank for
  // burst) and is the first thing to question. Its sentence: "everything you
  // do to me makes me stronger."
  sym: {
    name: 'Symbiotic', color: 'sym',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      { id:'latch', name:'Latch', desc:'Auto. Attack the enemy for your Attack Damage + {thornsScale%} of your thorns.', type:'attack', power:1.0, thornsScale:0.35, target:'enemy', basic:true },
      { id:'spines', name:'Raise Spines', desc:'Thorns ×{power} and pain reflect doubled for {duration#turn}. Hits taken plant Spores — big hits plant more.', type:'buff', buff:'spines', duration:3, power:2.2, target:'self', cdTurns:4 },
      { id:'feed', name:'Symbiote Feed', desc:'Consume 1 Spore: heal {healFracFed%} max HP and Thorns ×{thornsBoost} for {thornsBoostDur#turn}. Starved (no Spore): heal {healFrac%} only.', type:'heal', healFrac:0.08, healFracFed:0.16, sporeFuel:true, thornsBoost:1.5, thornsBoostDur:2, target:'self', cdTurns:3 },
      { id:'erupt', name:'Bloom Eruption', desc:'{power%} Attack Damage +{perSporePower%} per Spore consumed.', type:'attack', power:1.50, perSporePower:0.70, consumesSpores:true, target:'enemy', cdTurns:5 }
    ]
  },
  // Base Sonny, reached via "RESIST MUTATION". Refused the infection, so he has
  // no strain mechanic and never drafts mutations. He runs on RESOLVE — a bank
  // built by landing hits and by taking them, worth flat damage reduction while
  // held and burst when spent. The defiant human: endure, then everything at
  // once. His damage comes off Strength like everyone else's; the "scales off
  // your highest stat" rule went when Attack Damage was unified.
  base: {
    name: 'Unmutated', color: 'base',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      { id:'jab', name:'Strike', desc:'Attack the enemy for {power!} damage. +{buildsResolve} RESOLVE', type:'attack', power:1.0, buildsResolve:1, target:'enemy', basic:true },
      { id:'bandage', name:'Bandage', desc:'Heal {healFrac%} of max HP and +{resolveHealBonus%} per held RESOLVE', type:'heal', healFrac:0.14, resolveHealBonus:0.02, target:'self', cdTurns:4 },
      { id:'counter', name:'Counterpunch', desc:'Brace for {duration#turn}: −{power%} damage taken, stacking with RESOLVE. A hit taken while braced strikes back for {counterPower!} damage', type:'buff', buff:'brace', duration:1, power:0.60, counterPower:1.20, target:'self', cdTurns:4 },
      { id:'laststand', name:'Last Stand', desc:'Attack the enemy for {power!} damage, +{perResolvePower!} per RESOLVE consumed. Spends all RESOLVE', type:'attack', power:1.20, perResolvePower:0.40, consumesResolve:true, target:'enemy', cdTurns:5 }
    ]
  }
};

// Enemies get their own bodies now, not a mirror of a maxed player.
//
// Now that enemy.apsBase matches the player's starting rate, `aps` READS
// DIRECTLY AS TURNS PER PLAYER TURN at level 1: a grunt acts once for each of
// your turns, a brute 0.72 times, a skirmisher 1.18. That is the whole point of
// the anchor — before it, these multipliers were relative to a base the player
// never matched, so 0.72 described nothing you could feel.
//
// skirmisher was 1.55 (see the revert list in BALANCE.enemy). Against a 1:1
// baseline that meant it took more than three turns to your two, which turned
// wave 2 into a wall rather than a change of pace. 1.18 still reads as SWIFT —
// it out-paces you until you buy Speed — without being the hardest fight in
// the act.
// ARCHETYPES are gone. The game HAS four enemies — two per act: the
// Laboratory's Escaped Experiment and Prime Symbiote, the Encampment's MCP
// Enforcer and MCP Captain — and the code agrees: no hidden chassis cycling
// stats under one name and one sprite. The owner's rule for enemy variety:
// a thing that fights differently must LOOK different and be NAMED
// differently, so new enemy types arrive as name + sprite + behavior
// together, or not at all. (The act-1 roster is currently name + sprite on
// the shared chassis — its own behavior is the open half of that promise.)
// The boss's old brute chassis (x1.55 hp, x1.30 dmg, x0.72 rate) is folded
// into bossHp / bossDmg / bossAps so bosses fight exactly as before.

// Opt-in risk: elites hit harder but pay far more XP.
const ELITES = {
  // ARMORED went with armor itself — its only effect was armorAdd, so without
  // it the affix was a tag and an XP multiplier attached to nothing.
  frenzied: { id:'frenzied', tag:'FRENZIED', xp:1.7, apsMult:1.60 },
  vampiric: { id:'vampiric', tag:'VAMPIRIC', xp:1.7, lifesteal:0.30 },
  // COLOSSAL went the way of ARMORED: x2.2 HP at x0.8 rate changed nothing the
  // player DOES, only how long it takes — a sponge, not a question. The test
  // for this table: an affix must change the correct play, not the duration.
  // "Big" as an IDEA belongs to a future bespoke enemy with moves to match.
  venomous: { id:'venomous', tag:'VENOMOUS', xp:1.7, poison:true },
  volatile: { id:'volatile', tag:'VOLATILE', xp:1.8, deathNova:0.14 }
};

// Act structure — the content framework for a run. Two acts of 15 waves,
// three bosses each. Each act owns its zone label, its enemy roster (names
// here, art in sprites.js keyed by act), and its DIFFICULTY FLOOR:
//
//   growthMult   the act's floor — enemy hp/dmg growth restarts from here,
//                so within an act the familiar tier curve retraces at a
//                higher altitude instead of compounding forever. Without
//                this, extending the old 1.85^tier ride to wave 30 put the
//                last boss at ~390 damage against a ~300 HP pool: not hard,
//                unwinnable. Rank and rate are act-local for the same
//                reason — the roster debuts at Rank I, not Rank IV.
//   tierGrowth / withinStep   optional per-act steepness overrides. Act 2
//                climbs much more gently than act 1 because the player's
//                own growth flattens with the stretched level curve (~9
//                points across the whole act against act 1's ~18).
//
// Act 2's numbers are a FIRST GUESS at extrapolation, not a tuning: act 1
// wave-for-wave carries exactly the numbers the game has been played on,
// and the encampment gets fitted the way everything here does — by play.
const ACTS = [
  { num: 1, name: 'The Laboratory', startWave: 1, endWave: 15,
    zones: ['THE LABORATORY'],
    enemyName: 'Escaped Experiment', bossName: 'Prime Symbiote',
    growthMult: 1 },
  { num: 2, name: 'MCP Encampment', startWave: 16, endWave: 30,
    zones: ['MCP ENCAMPMENT'],
    enemyName: 'MCP Enforcer', bossName: 'MCP Captain',
    growthMult: 4.5, tierGrowth: 1.25, withinStep: 0.04 }
];
function actForWave(wave) {
  return ACTS.find(a => wave >= a.startWave && wave <= a.endWave) || ACTS[ACTS.length - 1];
}

// ---- Talents -------------------------------------------------
// Damage talents scale dmgMult. Defensive talents scale hpMult or flat traits.
// Nothing scales a raw stat, so no talent can quietly buy two things at once.
//
// Every mutation is available to every strain — there is no strain gating and
// no per-strain pool. Write each entry to be worth taking whoever draws it; if
// one only makes sense for a single strain, that is a sign it wants to be a
// skill on that strain rather than a mutation.
//
// Entry contract:
//   id    matches the key; this is what lands in player.talentIds
//   tag   short label shown on the choice card
//   desc  a fmtDesc template, not prose — put the number in a field and
//         reference it ({key}, {key%}, {key#noun}) so the card can never
//         disagree with what apply() actually does. Write apply() as a method
//         and read the field off `this` so the number lives exactly once —
//         `power:0.20, desc:'-{power%} damage', apply(p){ ...this.power... }`.
//   apply(p)  scale p.dmgMult / p.hpMult / p.apsMult, bump a raw stat, or set
//         a flag under p.talents. These p.talents hooks are all wired into the
//         combat code and lie inert until an entry sets one:
//           overflow, bloodMemory, harvest, cdrBonus, adrenaline, execute,
//           momentum, evadeFlat, thornsMult, thornsHeal, poisonStackBonus,
//           poisonMult, critFlat
//
// BASIC-ATTACK RIDERS
// The first family of mutations hangs a status off the basic attack — the swing
// you always have, on no cooldown, that otherwise stops mattering once the
// specials come online. Each rider is one line of data: name a status from
// STATUSES and the values to apply it with. Whether it lands on you or on the
// enemy is not stored, because the registry already knows — a 'buff' goes to
// the caster and a 'debuff' goes to the target, so the two can never disagree.
//
// Adding another is one entry here and nothing else; applyPlayerDamage already
// walks whatever this leaves on p.talents.basicRiders.
function addBasicRider(p, id, opts) {
  p.talents.basicRiders = (p.talents.basicRiders || []).concat([Object.assign({ id }, opts)]);
}

const TALENTS = {
  // DELIBERATELY EMPTY. The mutation SYSTEM is intact — drafting, picking,
  // stacking, the MUTATIONS tab, persistence through a save, and every
  // p.talents hook listed above are all still wired. There is simply no
  // content in the pool, so levels pass without offering a draft
  // (rollTalentOffers returns nothing and queueTalentOffer declines).
  //
  // The seven basic-attack riders that lived here were cleared while the
  // strains and the starting sheet are being tuned: a draft that hands out
  // WEAK, HASTE or REGEN changes what a class feels like, which makes it
  // impossible to judge whether the class itself is fun. They come back once
  // the four strains stand up on their own.
  //
  // Adding one is a single entry, nothing else. The rider family read:
  //
  //   atrophy: {
  //     id:'atrophy', name:'Atrophic Strike', tag:'Basic Attack',
  //     power:0.20, duration:2,
  //     desc:'Your basic attack also rots what it touches: WEAK for ' +
  //          '{duration#turn}, -{power%} to its damage.',
  //     apply(p){ addBasicRider(p, 'weak', { power:this.power, duration:this.duration }); }
  //   }
  //
  // — one line of data naming a status from STATUSES and the values to apply
  // it with. addBasicRider below is still here for exactly that.
};

// ---- Statuses ------------------------------------------------
// One registry for every timed effect that can sit on a unit, player or enemy.
//
// Before this, a status was an ad-hoc object pushed into unit.statuses whose
// field names only the function that created it knew, and the rules for what
// happened when it was re-applied, ticked, expired, rendered or read by the
// damage pipeline each lived somewhere else: stacking in applyPoison, refresh
// in applyThornsBoost, application in a three-branch if inside fireSkill,
// ticking in tickTurnStart, mitigation in applyEnemyDamage, the badge in a
// chain of type checks. "Enemies can be weakened" meant touching six places and
// inventing a seventh convention.
//
// Now a status is a DEFINITION here plus a small instance object
// { type, duration, stacks, power, ... } on the unit. Stacking, ticking,
// expiry, the badge and the damage hooks are all driven off the definition, so
// a new buff or debuff is one entry in this object and nothing else — and it
// works on either side of the fight, because nothing here knows or cares
// whether the unit carrying it is the player.
//
// DEFINITION FIELDS (only id/name/tone are required)
//   id, name       id matches the key; name is the default badge text
//   tone           CSS class on the badge (.status.<tone>). 'buff' and
//                  'debuff' always exist, so a new entry needs no CSS.
//   kind           'buff' | 'debuff', from the perspective of the unit
//                  carrying it. Nothing reads it mechanically yet; it is what
//                  a dispel, cleanse or immunity would filter on.
//   stacking       how a second application merges with the one already there:
//                    'replace' (default)  drop the old, take the new
//                    'longest'            take the new, keep the longer duration
//                    'stack'              add stacks (to maxStacks), take the
//                                         new duration, keep the larger power
//                    'amplify'            multiply power, keep the longer duration
//                    'extend'             add the durations together
//   maxStacks      ceiling for 'stack'; a number, or fn(unit) for a target-
//                  dependent cap
//   defaults       field values used when applyStatus leaves them out
//   permanent      never expires on its own; duration is ignored (poison)
//   manual         the generic turn tick does NOT count it down — the system
//                  that owns it spends it instead (stun, spent by the turn
//                  engine when it eats a turn)
//   persists       survives into the next fight and is written to the save
//   (applyMsg was a prose log line for fireSkill's buff branch. It is gone:
//    applyStatus logs every status through logStatus using label() below, so a
//    buff is reported by the same text as its badge instead of a second,
//    hand-written sentence that could drift from it.)
//   label(st,unit) badge text; defaults to NAME ×stacks  Nt
//
// HOOKS — all optional, all reached through the helpers below, so no caller
// ever pokes at a status object's fields directly:
//   onApply(unit, st)              applied or re-applied
//   onExpire(unit, st)             duration ran out
//   onOverflow(unit, st, extra)    'stack' only: applied beyond maxStacks
//   onTurnStart(unit, st)          the unit's turn began. Return true if this
//                                  killed them — the engine stops there.
//   onHitTaken(unit, st, ctx)      the unit was hit; ctx {attacker, damage}
//   incomingMult(unit, st, ctx)    multiplies damage the unit RECEIVES
//   outgoingMult(unit, st, ctx)    multiplies damage the unit DEALS
//   apsMult(unit, st)              multiplies the unit's initiative rate
//   thornsMult(unit, st)           multiplies the unit's thorns damage
//   bankOnHitTaken(unit, st)       extra bank charges gained from being hit.
//                                  Nothing implements this today — Brace was
//                                  the only user and gave that up — so the
//                                  fold in applyEnemyDamage adds 0. Kept as
//                                  the seam for the next status that wants it.
const STATUSES = {

  // --- Strain mechanics ---------------------------------------------------
  poison: {
    id:'poison', name:'POISON', tone:'poison', kind:'debuff',
    // Permanent: once applied, rot does not wash out. Nothing about bio works
    // if its damage can be waited out — the class trades every other advantage
    // for the fact that what it has already done keeps happening.
    stacking:'stack', permanent:true, defaults:{ stacks:1, perStack:1 },
    // No timer on the badge — there is nothing left to count down.
    label: st => 'POISON ×' + (st.stacks||1),
    onTurnStart(unit, st) {
      // CHITIN on the opponent quickens the rot: the poison runs its tick
      // twice on this unit's turn — two full ticks, two floaters, two log
      // lines, so what was paid is exactly what shows.
      const foe = unit.isPlayer ? null : state.player;
      const ticks = (foe && foe.hp > 0 && hasStatus(foe, 'chitin')) ? 2 : 1;
      for (let i = 0; i < ticks; i++) {
        if (unit.hp <= 0) break;
        const dmg = Math.max(1, Math.floor((st.perStack||1) * (st.stacks||1)));
        unit.hp = Math.max(0, unit.hp - dmg);
        floatText(unit, dmg, 'poison');
        logDamage('POISON', unit, dmg, [
          '×' + (st.stacks||1) + ' @ ' + logNum(st.perStack||1) + '/stack',
          ticks === 2 ? 'CHITIN: second tick' : null,
          logNum(unit.hp) + '/' + logNum(unit.maxHp) + ' left'
        ]);
      }
      updateUnitCard(unit);
      return unit.hp <= 0;
    }
  },

  // Bio: harden to outlast — the sustain half and the rot half of the class
  // in one decision. Reuses fortify's shape; its own entry so poison can ask
  // "is the player hardened" by name and the badge reads CHITIN.
  chitin: {
    id:'chitin', name:'CHITIN', tone:'buff', kind:'buff',
    stacking:'longest', defaults:{ duration:3, power:0.40 },
    label: st => 'CHITIN ' + Math.ceil(st.duration) + 't',
    incomingMult: (u, st) => 1 - (st.power || 0)
  },

  // Bleed is poison with different flavour: a stacking tick on whatever you hit.
  // Kept as its own entry rather than a re-skin of poison so the two can stack
  // independently and be raised by different sources — an AILMENT is the shared
  // idea, not the shared object.
  //
  // Deliberately plainer than poison: no double-tick interaction (that is bio's
  // trick, not a property of damage-over-time) and it does not persist between
  // fights. Nothing applies it yet; applyStatus(e, 'bleed', {...}) is all it
  // takes when something should.
  bleed: {
    id:'bleed', name:'BLEED', tone:'bleed', kind:'debuff',
    stacking:'stack', defaults:{ duration:4, stacks:1, perStack:1 },
    maxStacks: unit => unit.isPlayer ? 99 : ((state.player && state.player.bleedStackCap) || 99),
    label: st => 'BLEED ×' + (st.stacks||1) + '  ' + Math.ceil(st.duration) + 't',
    onTurnStart(unit, st) {
      const dmg = Math.max(1, Math.floor((st.perStack||1) * (st.stacks||1)));
      unit.hp = Math.max(0, unit.hp - dmg);
      floatText(unit, dmg, 'damage');
      logDamage('BLEED', unit, dmg, [
        '×' + (st.stacks||1) + ' @ ' + logNum(st.perStack||1) + '/stack',
        logNum(unit.hp) + '/' + logNum(unit.maxHp) + ' left'
      ]);
      updateUnitCard(unit);
      return unit.hp <= 0;
    }
  },

  spines: {
    id:'spines', name:'SPINES', tone:'spines', kind:'buff',
    // Boosts multiply and refresh, never overwrite: Feed on top of Raised
    // Spines is x2.2 * x1.5 = x3.3, not a downgrade to x1.5. The duration is
    // shorter than Spines' cooldown, so it can't ladder on itself forever.
    stacking:'amplify', defaults:{ duration:3, power:2.2 }, persists:true,
    label: st => 'SPINES ' + Math.ceil(st.duration) + 't',
    thornsMult: (u, st) => st.power || 1,
    // Sym: a hit landed while the spines are up plants a Spore for later
    // Bloom, and a big hit plants more.
    onHitTaken(unit, st, ctx) {
      if (unit.class !== 'sym' || !(ctx.damage > 0)) return;
      const planted = Math.min(P().sporeHitMax, 1 + Math.floor(ctx.damage / Math.max(1, unit.maxHp * P().sporeBigHitFrac)));
      bankAdjust(unit, planted, 'SPINES, hit taken' + (planted > 1 ? ' (big hit)' : ''));
    }
  },

  brace: {
    id:'brace', name:'BRACE', tone:'brace', kind:'buff',
    stacking:'replace', defaults:{ duration:1, power:0.60, counter:1.20 },
    label: st => 'BRACE ' + Math.ceil(st.duration) + 't',
    // Deliberately NOT an incomingMult: Unmutated adds Brace to held Resolve
    // and caps the sum (applyEnemyDamage), so 18% Resolve + 60% Brace is one
    // 78% reduction, not two multiplied ones. Splitting it into a generic hook
    // would quietly halve the skill.
    // No bankOnHitTaken: a braced hit banks exactly what any hit banks. Brace
    // used to add a second point on top, which made a hit worth more for being
    // absorbed — the skill pays out in mitigation and the counter, not in a
    // quietly better exchange rate.
    onHitTaken(unit, st, ctx) {
      const e = ctx.attacker;
      if (!e || unit.hp <= 0 || e.hp <= 0) return;
      const cdmg = Math.max(1, Math.floor(unit.atkPower * (st.counter||1.2)));
      const before = e.hp;
      e.hp = Math.max(0, e.hp - cdmg);
      state.damageDealt += cdmg;
      if (e.hp <= 0) state._lastOverkill = Math.max(0, cdmg - before);
      floatText(e, cdmg, 'damage');
      logDamage('COUNTER', e, cdmg, [
        'BRACE ×' + (st.counter||1.2).toFixed(2) + ' Attack Damage',
        logNum(e.hp) + '/' + logNum(e.maxHp) + ' left'
      ]);
      playAttackAnim(unit, e, true, 'counter');
    }
  },

  // Psy's mark — the mind coming apart, worn on the enemy's card the way
  // poison is. Permanent like poison and for the same reason: fear does not
  // wash out on a timer, only the enemy's own landed hits steady it (see
  // shedStacks in applyEnemyDamage) and Kill consumes it. Dies with the enemy,
  // so psy re-establishes dominance fresh each fight — the ramp is fast and
  // per-fight where bio's is slow and permanent.
  //
  // The slow rides the generic apsMult hook, so effectiveAps and the turn-rate
  // ratio readout pick it up with no special case: as the stacks climb the
  // player literally watches their ratio rise.
  dread: {
    id:'dread', name:'DREAD', tone:'dread', kind:'debuff',
    stacking:'stack', permanent:true, defaults:{ stacks:1 },
    maxStacks: () => P().dreadCap,
    label: st => 'DREAD ×' + (st.stacks||1),
    apsMult: (u, st) => 1 - (st.stacks||0) * P().dreadSlowPerStack,
    // Terror opens the guard: the enemy takes more from EVERY source while
    // marked — including the Kill that consumes the stacks, which strikes
    // into the open guard before the fear breaks (consumption happens after
    // the damage resolves). This half is psy's offense; the slow is its skin.
    incomingMult: (u, st) => 1 + (st.stacks||0) * P().dreadVulnPerStack
  },

  predator: {
    id:'predator', name:'PREDATOR', tone:'predator', kind:'buff',
    stacking:'replace', defaults:{ duration:5, power:1.45 }, persists:true,
    label: st => 'PREDATOR ' + Math.ceil(st.duration) + 't',
    outgoingMult: (u, st) => st.power || 1
  },

  // Spent by the turn engine (nextTurn), not by the generic duration tick —
  // the turn it eats IS its tick. stunImmune stays an engine flag beside it:
  // it is a resist that gets armed and shrugged off by the interrupt dance in
  // applyPlayerDamage, not something that runs on a clock.
  stun: {
    id:'stun', name:'STUNNED', tone:'stun', kind:'debuff',
    stacking:'longest', manual:true, defaults:{ duration:1 },
    label: () => 'STUNNED'
  },

  // --- Generic library ----------------------------------------------------
  // Nothing applies these yet — they are the reason the scaffolding exists.
  // Each one is symmetrical: hand it to a skill, an elite affix or an enemy
  // move and it behaves the same whichever side is carrying it.
  //   applyStatus(state.enemy, 'weak', { duration: 2 })
  //   applyStatus(state.player, 'haste', { duration: 3, power: 0.5 })
  weak: {
    id:'weak', name:'WEAK', tone:'weak', kind:'debuff',
    stacking:'longest', defaults:{ duration:2, power:0.25 },
    label: st => 'WEAK ' + Math.ceil(st.duration) + 't',
    outgoingMult: (u, st) => 1 - (st.power || 0)
  },
  vulnerable: {
    id:'vulnerable', name:'VULNERABLE', tone:'debuff', kind:'debuff',
    stacking:'longest', defaults:{ duration:2, power:0.30 },
    label: st => 'VULN ' + Math.ceil(st.duration) + 't',
    incomingMult: (u, st) => 1 + (st.power || 0)
  },
  empower: {
    id:'empower', name:'EMPOWER', tone:'buff', kind:'buff',
    stacking:'longest', defaults:{ duration:2, power:0.25 },
    label: st => 'EMPOWER ' + Math.ceil(st.duration) + 't',
    outgoingMult: (u, st) => 1 + (st.power || 0)
  },
  fortify: {
    id:'fortify', name:'FORTIFY', tone:'buff', kind:'buff',
    stacking:'longest', defaults:{ duration:2, power:0.25 },
    label: st => 'FORTIFY ' + Math.ceil(st.duration) + 't',
    incomingMult: (u, st) => 1 - (st.power || 0)
  },
  haste: {
    id:'haste', name:'HASTE', tone:'buff', kind:'buff',
    stacking:'longest', defaults:{ duration:2, power:0.30 },
    label: st => 'HASTE ' + Math.ceil(st.duration) + 't',
    apsMult: (u, st) => 1 + (st.power || 0)
  },
  slow: {
    id:'slow', name:'SLOW', tone:'debuff', kind:'debuff',
    stacking:'longest', defaults:{ duration:2, power:0.30 },
    label: st => 'SLOW ' + Math.ceil(st.duration) + 't',
    apsMult: (u, st) => 1 - (st.power || 0)
  },
  regen: {
    id:'regen', name:'REGEN', tone:'buff', kind:'buff',
    stacking:'longest', defaults:{ duration:3, power:0.05 },
    label: st => 'REGEN ' + Math.ceil(st.duration) + 't',
    onTurnStart(unit, st) {
      if (unit.hp <= 0 || unit.hp >= unit.maxHp) return false;
      const heal = Math.max(1, Math.floor(unit.maxHp * (st.power||0)));
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + heal);
      floatText(unit, heal, 'heal');
      logHeal('REGEN', unit, unit.hp - before, [
        Math.round((st.power||0)*100) + '% max HP',
        logNum(unit.hp) + '/' + logNum(unit.maxHp)
      ]);
      updateUnitCard(unit);
      return false;
    }
  }
};

