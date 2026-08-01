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
//  * A BREAK MUST BE POSSIBLE, AND MUST NOT BE NORMAL. The runs worth
//    remembering are the ones where something got away from the game: a number
//    that scaled past anything it was fitted against, an assembled combo doing
//    what no single pick promised. That outcome is WANTED, and the ceiling
//    stays open for it — a ramp is not capped merely because it could get big,
//    and "this could get out of hand" is not by itself an argument against a
//    mechanic. What keeps a break rare is that it must be ASSEMBLED: several
//    picks agreeing, drafted across a run that could have gone otherwise. Never
//    the default line of play, and never an accident of two things stacking
//    quietly. Mutations are the main engine of this, so expect the ceiling to
//    rise as their pool fills.
//
//    A COST THAT RIDES A RUNAWAY NUMBER HAS A TRAP IN IT, worth naming because
//    it was nearly walked into while designing sym's sustain. A PERCENTAGE cost
//    against an uncapped ramp grows without bound while its payout does not —
//    healing is bounded by max HP, so past a certain size you pay a fortune for
//    a heal you cannot hold, and the trade stops being expensive and becomes
//    absurd. The fix is to take only what the payout was actually worth, which
//    leaves scaling making a cost EFFICIENT rather than unpayable. Costs should
//    scale; they must not outrun their own exchange rate.
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
//         critStrainGain: 0 for every strain. Psy used to be the living proof
//         of it, planting DREAD on a crit as the kit itself rather than through
//         the parked scaffold — that came out when Hunt started planting on
//         hit, so there is nothing standing on the idea now. Switch it on
//         deliberately for a strain that wants it; do not inherit it.
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
//  * HEALING IS A SHARE OF THE HEAL ANCHOR, NEVER OF YOUR MAX HP, and this is
//    the newest default here — it is what finally let Strength and Instinct be
//    looked at honestly. Every heal used to scale with the bar, so Vitality
//    bought the bar AND the multiplier on the refill, and the refill turned out
//    to be 68-91% of all the punishment any build absorbed. One stat owned most
//    of the game's effective health, and no damage number could chase it,
//    because damage pays inside one fight while a bigger bar compounds across
//    thirty. The anchor is the bar you would have at 5 Vitality, grown by LEVEL
//    instead of by allocation. Full argument under healAnchorPerLevel; the one
//    read is healAnchorFor() in stats.js. Damage-proportional healing
//    (lifesteal, thorns-feed) is a different mechanic and was never coupled.
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
const BUILD = '2026-08-01b';

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
    // SPEED DIMINISHES INSTEAD OF CAPPING, and the wall it replaces was the
    // single biggest balance fault measured in this game.
    //
    // It used to be flat 0.20 a point into a hard ceiling of x4.00 — reached at
    // 20 Speed, which is 15 points of a run's 33. A ceiling you hit at the
    // halfway mark is not a ceiling, it is a TARGET: you max the stat by wave
    // 15 and every point after it is free to pour into Vitality, which is
    // exactly the Speed+Vitality build that wins 20 runs out of 20 while an
    // even spread wins none. And turn rate is the one stat that buys offence
    // and defence at once (it multiplies both halves of "your turns before
    // their hits add up"), so it was roughly three times the per-point value of
    // Strength or Vitality right up until it stopped being worth anything.
    //
    // The new shape: the anchor is still exactly x1.00 at 5 Speed — nothing
    // about that moves — and every point above it buys a share of apsGain that
    // shrinks as you go. apsHalfPoints is where you have bought HALF of what
    // the curve will ever give. Picked so the first point still feels like the
    // old one (+0.18 against +0.20) while a full run's investment lands near
    // x2.5 instead of slamming into x4 at the midpoint.
    //
    // NOTHING IS EVER WASTED AND NOTHING IS EVER SOLVED, which is the property
    // a stat needs to stay a decision: the curve has no number where Speed
    // stops mattering, and no number where you are done buying it. Instinct
    // already lives this rule from the other side — its crit chance caps but
    // crit damage keeps climbing, so overinvestment still pays.
    //
    // apsGain is THE DIAL. It is the asymptote above the anchor: raise it and
    // full investment gets faster without the early points changing much, since
    // apsHalfPoints holds the opening slope.
    // The sheet everything is anchored to starts every stat at 5, so that is
    // where "points above the anchor" counts from. Named rather than a literal
    // 5 in the formula: the anchor is a design fact, not a magic number.
    //
    // It was speedAnchor until the heal anchor needed the same 5 — one number
    // meaning "the starting sheet" is the point of naming it, and two copies
    // of it under different names would be the thing this line exists to stop.
    sheetAnchor: 5,
    apsGain: 2.00, apsHalfPoints: 10,
    //   apsCap  absolute ceiling AFTER apsMult, and now the only cap left. It
    //           does not bind the stat (the curve tops out near x3 on its own);
    //           it is the backstop for whatever earned multiplier arrives.
    apsCap: 6.00,
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
    // ---- CRIT HEALS -------------------------------------------------------
    // A HEAL YOU PRESS CAN CRIT, on the same chance as a blow. This is JUICE
    // AND IS PRICED AS JUICE, which is worth stating because it was measured
    // first as an Instinct fix and does not work as one.
    //
    // Measured before it was built, 30-40 runs a cell: running heals through
    // the full DAMAGE crit formula — ~76% chance of x10.5 at a run's end, an
    // 8x average multiplier on all sustain — bought an all-Instinct build
    // +0 to +3 waves and left it last in every strain. At x1.5 or x2 the gain
    // was zero to one. Healing throughput is simply not what is killing a
    // build that is thin everywhere else, which is the same lesson the heal
    // anchor taught from the other side. Instinct's real answer is the parked
    // note in the header: scaling what a CHARGE is worth.
    //
    // So it gets its OWN flat multiplier and never touches critMult. A crit
    // that scaled with Instinct would quietly rebuild the coupling the anchor
    // just removed, in a stat that has an even steeper curve than Vitality
    // did. Flat means the gold number is a moment, not an economy.
    //
    // TICKS DO NOT CRIT, ACTIONS DO — already true of damage (poison and bleed
    // tick flat) and now true of healing, so REGEN, SIPHON and HARVEST stay
    // steady while Bandage, Shed and DEVOUR can spike. It keeps the CRIT tag
    // an event: a drip that crits every third turn teaches you to stop reading
    // it.
    critHealMult: 2.0,
    // A CRIT FEEDS YOUR STRAIN — PARKED AT 0 FOR ALL FOUR STRAINS. Psy was the
    // exception and is not any more: its fear rode crits, which meant the
    // strain's number was fed by a roll on top of an attack rather than by the
    // attack, and its basic's card had to describe the class instead of the
    // button. Hunt plants on hit now (see its note in CLASSES).
    //
    // The rule, whenever it is switched on: a crit banks a charge of whatever
    // the strain runs on — a poison stack, Resolve, thorns. It is still the
    // better long-term answer for this stat, because "my mechanic is online" is
    // a verb Strength cannot buy at any price.
    //
    // Off everywhere because the designs are still being judged. A stat that
    // accelerates a mechanic makes that mechanic harder to read, so Instinct
    // pays in crit alone until each strain stands up on its own.
    //
    // Set this back to 1 to switch it on for them. Nothing else needs touching —
    // creditCrit and its call site in applyPlayerDamage are still wired, and
    // the readouts are unaffected.
    critStrainGain: 0,
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
    // ---- BLEED (Unmutated) ------------------------------------------------
    // Poison's twin, and UNCAPPED for the same reason it is. It is Unmutated's
    // second number, and the ONLY strain given two: he is the one who refused
    // the infection, so his mechanic is just the ordinary consequence of a long
    // fight — you get harder to move, they get cut. Two halves of one exchange.
    //
    // IT MUST NOT BECOME BIO IN RED. A stacking tick on the enemy is bio's
    // whole identity, and "a worse version of another class in a different
    // colour" is precisely the failure the sym pass just finished undoing. Two
    // rules keep them apart, and both have to hold:
    //
    //   POISON IS PERMANENT; BLEED IS ON A TIMER that each new stack refreshes.
    //   Bio infects and waits — the rot is a clock that never stops. Base has
    //   to keep cutting, and four turns of not attacking closes the wound
    //   entirely. One class ramps and coasts; the other cannot stop working.
    //
    //   POISON IS FREE; BLEED IS BOUGHT WITH PUNISHMENT. The rot ticks whether
    //   or not bio is ever touched. A cut is only as deep as the RESOLVE behind
    //   it, and Resolve comes from landing hits and taking them — so base's
    //   damage-over-time is paid for in damage absorbed.
    //
    // The depth is snapshotted when the cut is made, NEWEST-wins (see
    // perStackRule on the bleed status): spend your Resolve on Last Stand and
    // the wounds you open afterwards are shallower. That is the cost that makes
    // hold-vs-spend a real question rather than a formality.
    bleedDuration: 4,                        // TURNS — refreshed by each new stack
    bleedPerResolve: 0.10,                   // each held RESOLVE deepens a NEW cut by this share of the ailment base
    // ---- THORNS (sym) -----------------------------------------------------
    // SYM'S MECHANIC IS ONE NUMBER THAT GROWS, and thorns is that number —
    // not a bank beside it. The old kit had both: thorns as a passive share of
    // max HP, and Spores as a wallet filled by being hit and spent on a heal or
    // a burst. The wallet was Unmutated's identity wearing a coat (gain, hold,
    // spend), and the part that was actually sym — the enemy hurting itself on
    // you — merely happened. Collapsing the two is the whole rework: a growth
    // stat that raises thorns IS thorns with an extra step, and two numbers
    // doing one job means reading both to know how big you are.
    //
    // Growth is RUN-PERMANENT, and that is forced by measurement rather than
    // taste. A trash fight gives the player about 5 enemy swings and a boss
    // about 10-13 (~52 across a whole run), so a per-fight ramp could only ever
    // reach 5 before being wiped — DREAD-sized, and DREAD is a mark that gets
    // to reset because it lives on a corpse. Carried across the run the number
    // is genuinely big, which is the point: "everything you do to me makes me
    // stronger" is a RUN sentence, not a fight sentence.
    //
    // It also fixes the direction of travel. Swings-per-player-turn FALLS as a
    // run goes (0.44 early, 0.17 late) because Speed and slow bosses both cut
    // it, so a per-fight ramp would have gotten weaker exactly as the game got
    // harder. Banked across the run, early fights pay for late ones.
    //
    // THORNS IS PAID OUT THREE WAYS, which is what makes one number enough:
    // the enemy takes it when they swing (here), Latch reads a share of it back
    // on your own turns, and Shed converts it to healing. Grow one thing and
    // everything gets better.
    thornsFrac: 0.05,          // INNATE thorns: a twentieth of max HP, and the floor Shed can never eat into
    thornsPerHit: 1,           // every hit taken grows thorns by this, no window and no condition
    thornsBigHitFrac: 0.15,    // ...plus one more per this share of max HP taken in a single blow
    thornsGrowMax: 4,          // ceiling on what ONE hit can grow, so a x5 telegraph is a feast, not a jackpot
    thornsSpinesGrow: 2,       // extra growth per hit while Spines is up — the window is an INVITATION now
    // SHED: THE CEILING IS NOT THE PRICE. A percentage cost against a number
    // allowed to run away grows without bound while its payout does not —
    // healing is bounded by max HP — so past a certain size you would pay a
    // fortune for a heal you cannot hold, and the button stops being worth
    // pressing at exactly the moment you have played best. So the shed takes
    // only as many thorns as the heal actually NEEDED, and the fraction below
    // is a ceiling on top of that. Growing huge therefore makes Shed cheap in
    // proportion rather than unpayable. See "a cost that rides a runaway
    // number" in the header.
    // Both numbers were first set a third of this and MEASURED too thin: Shed
    // healed 24 of a 100 HP bar, which is not a sustain button, it is a
    // rounding error with a cooldown. Cutting the old passive thorns lifesteal
    // (see the note at its call site) took ~875 HP a run out of the class, and
    // that has to come back through the button you press on purpose rather
    // than through a drip that asks nothing.
    shedCapFrac: 0.35,         // Shed never takes more than this share of GROWN thorns in one press
    shedHpPerThorn: 0.04,      // one thorn shed is worth this share of max HP
    reflectFrac: 0.20, reflectSpinesMult: 2,   // sym: share of damage taken reflected back; doubled while Spines is up
    // The level-up heal is load-bearing sustain and has tracked the level
    // curve through both compressions: 16 levels x 8% was ~128% of max HP a
    // run, and 8 x 15% kept that economy whole (~120%). At ~6 levels the
    // fraction deliberately STAYS 15% (~90% a run): the point-scarcity pass
    // wants the whole run poorer, and free healing is part of the shower.
    levelUpHealFrac: 0.15, recoverHpFrac: 0.08,
    // ---- THE HEAL ANCHOR --------------------------------------------------
    // EVERY FRACTION ABOVE, AND EVERY ONE IN THE KITS, IS A SHARE OF THE HEAL
    // ANCHOR RATHER THAN OF YOUR MAX HP. That coupling was the single largest
    // distortion ever measured in this game, so it is worth writing down what
    // it did rather than only what replaced it.
    //
    // Measured, all-in on one stat, 40 runs each: healing was 68-91% of ALL
    // the punishment every build absorbed. Your bar was the rounding error and
    // your refill was the real health pool — and since every heal in the game
    // was a share of max HP, Vitality bought the bar AND the multiplier on the
    // refill. One stat, two jobs, and the second one compounded across thirty
    // waves. Strength shortens the fight you are in; nothing carried it to the
    // next one, because your HP persists between waves and the enemy's does
    // not. All-in Strength reached wave 7-8 with 55 Attack Damage against 25,
    // killing 40% faster and buying nothing. All-in Vitality reached 12-25.
    // Per wave reached, VITALITY OUT-DAMAGED STRENGTH IN ALL FOUR STRAINS.
    //
    // So the stats were never the bug. No damage number can chase a stat that
    // compounds; making Strength competitive by its own scalar would have
    // meant fights ending in a turn or two, which is the cheap way to a game
    // that is beaten once and never again.
    //
    // THE ANCHOR IS THE BAR YOU WOULD HAVE AT 5 VITALITY, grown by LEVEL. A
    // level arrives on a fixed schedule nobody buys, so sustain keeps pace
    // with the enemy curve while allocation no longer touches it. At the
    // starting sheet the anchor and the bar are the same 100, which is the
    // property that keeps the sheet legible: a 14% Bandage is still 14 on
    // wave 1, exactly as it always was.
    //
    // healAnchorPerLevel IS THE DIAL, and it is the only one here. It sets how
    // fast sustain tracks a run: 0 freezes healing at 100 HP forever (every
    // heal button dies by act 2), high values hand the old economy back to
    // everyone at once. At 0.30 a level is +30 HP of anchor, so L11 is ~400 —
    // between an even spread's ~250 bar and an all-Vitality ~700. That is the
    // redistribution on purpose: non-Vitality builds get MORE sustain than
    // they had, Vitality stacking gets much less.
    //
    // hpMult still rides the anchor. A mutation that widens the whole body
    // should widen what closes a wound on it — a visible pick doing a visible
    // thing is the sanctioned way to break a default, and the only way.
    healAnchorPerLevel: 0.30,
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
    // the ratio climbing — dominance you can watch.
    // Each stack does TWO things, named on one badge: the enemy hesitates
    // (−rate) and its guard opens (+damage taken). The pair is what makes
    // DREAD offense and defense at once — slow alone was mitigation wearing
    // an offensive costume (see the turn-rate note above), and a terror class
    // with no teeth measured exactly like it sounds: first pass shipped slow
    // only, and psy's own best-stat builds died on wave 3 doing 25s into a
    // 900 HP boss. Fear has to make the kill faster, not just later.
    //
    // THE STACK COUNT IS UNCAPPED; THE TWO HALVES ARE BOUNDED DIFFERENTLY, and
    // that split is the whole reason the ceiling could come off. The cap used
    // to exist for ONE reason — an unbounded slow walks an enemy toward never
    // acting, which is a stun nobody paid for — so the floor below bounds the
    // slow directly and the count is free. Vulnerability keeps climbing with
    // no ceiling at all: it is psy's damage, it costs stacks that a single
    // landed hit sheds, and fear dies with the enemy, so it cannot follow you
    // into the next fight the way sym's thorns do.
    dreadSlowPerStack: 0.05, // each stack: −5% enemy turn rate
    dreadSlowFloor: 0.55,    // ...but never below this share of its rate: the slow saturates, the count does not
    dreadVulnPerStack: 0.04, // each stack: +4% damage the enemy takes — terror opens the guard, uncapped
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
    // Sustain through the mechanic means sustain through TEMPO. Fear is planted
    // by landing Hunt and by casting Terrify, so more of your turns is more
    // fear, which is more food — Speed feeds the faucet directly. It used to be
    // Instinct and Speed both, when crits and dodges planted; Instinct is a
    // pure damage stat for psy now, and whether that is right is a play call.
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
    dreadSiphonFrac: 0.005,  // heal per DREAD on the enemy, per player turn
    // ---- RESOLVE (Unmutated) ----------------------------------------------
    // UNCAPPED, AND A STATUS RATHER THAN A WALLET. It was a 6-pip bank, which
    // made it the one mechanic in the game you finished thinking about: six
    // turns in you were full, and "hold or spend" collapsed into "spend,
    // because the next point is being thrown away". Off the leash it is a
    // genuine ramp — the longer the fight runs the harder you are to move and
    // the bigger Last Stand gets, which is the class's sentence (endure, then
    // everything at once) finally being a curve instead of a plateau.
    //
    // PER FIGHT, NOT PER RUN, and that is forced arithmetic rather than taste.
    // Resolve comes +1 a landed hit and resolvePerHit a hit TAKEN, so it
    // accrues every single turn; carried across a run it would pass the
    // reduction cap somewhere in act 1 and sit there for the rest of the game,
    // which is not a break, it is an off switch. Per fight it starts at nothing
    // and has to be rebuilt every time — the same shape as DREAD, and the
    // reason sym's THORNS stays the only mechanic in the game that is
    // run-permanent.
    //
    // The reduction is linear per stack and the SUM with Brace is capped hard
    // in applyEnemyDamage — uncapped number, bounded effect. Overinvestment is
    // never wasted, because everything past the cap still cashes out through
    // Last Stand.
    //
    // ---- THE BUILD RATE IS THE LEVER, NOT THE PAYOUT ----------------------
    // Both halves were swept before this moved, base only, 40 runs a cell.
    // What a stack PAYS barely matters: resolveDR from x0 to x5 took the spread
    // build 10w -> 15w, and most of that arrives past x3. How fast the pile
    // BUILDS is where the class lives: resolvePerHit 1 -> 8 took it 12w -> 23w,
    // still climbing at the end of the sweep.
    //
    // That asymmetry is the class stating what it is. Enduring is the verb, so
    // the number that answers to being hit is the one with the class in it —
    // and raising it sharpens base's sentence rather than blurring it, because
    // a landed hit still gives exactly +1 through Strike's buildsResolve. At +3
    // taking the blow is worth three times dealing one.
    //
    // 1 -> 3 because base was the outlier and nothing else was close: at +1 the
    // spread build reached 12w against 13/17/15 for bio/psy/sym, and at +3 it
    // reaches 14w — INSIDE the pack, not past it. The rest of the measured
    // curve, if this wants moving: +2 13w, +4 15w, +6 20w, +8 23w.
    //
    // THE CAP IS NOT THE CONSTRAINT, which was worth checking before touching
    // the rate: RESOLVE measured at the moment of every enemy hit sits at a
    // median of 4 stacks (12% reduction) at +3, and 0% of hits land against a
    // capped guard. Even +8 only pins 10% of them. The ramp stays a ramp at
    // every value here — the plateau this mechanic was rebuilt to escape is
    // nowhere near.
    //
    // ONE INTERACTION WORTH KNOWING, and it is a happy one: Speed does not
    // benefit. More of your turns means fewer of the enemy's, and the enemy's
    // turns are what feed this — so an all-Speed base sat at 12-15w across the
    // WHOLE sweep while spread and Vitality climbed. Enduring and evading pull
    // against each other, which is thematically right and means this lever
    // cannot feed the build that is already strongest.
    resolveDR: 0.03,       // Unmutated: each held Resolve = 3% flat damage reduction
    resolvePerHit: 3,      // Unmutated: Resolve gained whenever you take a hit
    reloadHpFloor: 0.15    // deliberate mercy: continuing a run never puts you below this
  },
  enemy: {
    // ---- WHY THIS TABLE IS NOT THE LEVER (a read, not a plan) -------------
    // KEPT BECAUSE IT WAS RIGHT ABOUT THE MECHANISM, and the fix it pointed at
    // eventually landed somewhere else entirely. The numbers below describe a
    // build nobody plays any more — the dumb bot won ~98% then and medians
    // wave 5-10 now — so read them as a worked example, not as today's game.
    //
    // The bracket used to call bio, psy and sym TOO EASY, and no knob in this
    // table could change that, because the margin it would have to eat was
    // sustain, and strain sustain was a share of max HP that did not care when
    // it was cast. Measured then (dumb bot, per run): bio took ~740 damage and
    // healed ~550 back, sym took ~1320 and healed ~875, psy took ~500 and
    // siphoned ~375. Both obvious raises were tried and reverted:
    //   - elites at 2x chance, windup on the 2nd action: win rates unmoved.
    //     Heavies land on full bars the loop refills — and elite XP at 1.7x
    //     is itself a buff, so more elites made base EASIER, not harder.
    //   - trashDmgMult 1.45 -> 1.75 on top: the three strains' dumb bots
    //     still won 83-96% while base skilled sank to 38% — the one class
    //     whose sustain is flat and rare drowns first, every time.
    //
    // THE STANDING LESSON, which outlived every number in it: PROPORTIONAL
    // SUSTAIN CANCELS PROPORTIONAL DAMAGE AT ANY MULTIPLIER. Raising this
    // table only reorders who drowns first. That is why the heal anchor —
    // which took sustain off max HP entirely — moved more than any enemy
    // number ever did, and why reaching for this table should stay a late
    // move rather than a first one.
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
    // hpBase carries the general buff (132 -> 160). One measurement worth
    // keeping beside it: +60% enemy HP, on its own, left bio, psy and sym
    // winning 30/30. HP alone did not decide those fights — damage and rate
    // did.
    //
    // That is a fact about the game AS IT WAS WHEN MEASURED, not a rule about
    // HP. A big pool only reads as padding while there is nothing to do inside
    // the extra turns it buys; once a run has real scaling to spend them on, a
    // long fight is a stage rather than a wall, and a wide health bar is the
    // room those systems need to happen in. Reach for HP when you want a fight
    // to have ROOM, and for damage and rate when you want it to have TEETH —
    // they are different jobs, not a better and a worse lever.
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
    // unfeelable. At 0.070 it climbs 1.00 -> 1.35 across a full run — still
    // small beside what Speed can buy (up to 4x), which is the point: Speed
    // remains the answer, but now there is a question. It also gives the tier
    // step a second dimension, so a new rank is faster AND heavier.
    //
    // RATE COUNTS FROM THE RUN'S START, NOT THE ACT'S, and that is the one
    // place the act-local rule is deliberately broken. Everything else about an
    // enemy restarts per act — that is what lets act 2 field its own roster at
    // its own floor — but rate restarting meant the Encampment's opening
    // enforcers acted at 1.00 while the Laboratory's closing experiments acted
    // at 1.14. The enemy got SLOWER at the boundary the game sells as stepping
    // up a weight class, while the player's rate climbed straight through it.
    // Tempo is the one axis where the player never resets, so it is the one
    // axis the enemy cannot afford to.
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
    // 5.0 stood on a thinner premise than when it was set.
    //
    // NOW 4.0, AND THE FIRST BOSS WAS NEVER THE PROBLEM — THE LAST ONE WAS.
    // Every note above reasons about wave 5, where the pool is smallest, and
    // concluded the multiplier was safe because the pool grows. It does, but
    // ENEMY DAMAGE GROWS FASTER, so the telegraph's share of the bar it lands
    // on climbs all run. Measured at 5.0, median bar the skilled bot actually
    // arrives with, both allocation plans:
    //
    //                     telegraph    spread build      all-Vitality
    //     wave  5 boss         90       160   56%         160   56%
    //     wave 10 boss        165       160  103%         280   59%
    //     wave 13 elite       235       160  147%         340   69%
    //     wave 15 boss        310       220  141%         400   78%
    //
    // Read the SPREAD column: from wave 10 on, the telegraph was a clean
    // one-shot on any sheet that had not poured everything into Vitality — and
    // 78% on one that had, which is a hit you survive only from full. So the
    // rule this table has always stated ("a telegraph costs you half your bar
    // and a turn spent reacting, not the run") was true at wave 5 and false
    // everywhere after it.
    //
    // At 4.0 the invested bar pays 45% / 47% / 62% across the three bosses.
    // The spread build still loses its last-boss bar to one blow (113%), and
    // that stays: a player who bought no Vitality has made a decision, and the
    // decision has to be allowed to be wrong. What is fixed is the other case,
    // the one no decision answers — investing in survival and dying anyway.
    windupEvery: 3, windupMult: 4.0,   // boss telegraph: every Nth action winds up; next strike hits xN
    finalWindupEvery: 2,               // the final boss keeps you under constant telegraph pressure
    eliteWindupEvery: 3,               // elites telegraph too: the mid-run skill check
    // ELITES TELEGRAPH SMALLER THAN BOSSES, and the reason is frequency, not
    // fairness. You meet three bosses in a run and a dozen elites, so a shared
    // multiplier means the rare scripted moment and the routine one cost the
    // same — and since elite damage already carries trashDmgMult, the routine
    // one was landing at 147% of a spread build's bar (the table above), worse
    // than either boss around it. An elite telegraph is a skill check; a boss
    // telegraph is the fight. They should not hit for the same multiple.
    eliteWindupMult: 3.0,
    // THE SHRUG IS NO LONGER FREE. Bosses alternate stagger resistance so a
    // stun or a Provoke cannot lock them out of their telegraph forever — but
    // a TOTAL shrug meant psy and sym had their only answer deleted on every
    // second telegraph, while bio's Chitin and base's Brace (mitigation, not
    // stagger) answered every one. Two classes played the game the enemy table
    // describes; two played a coin flip.
    //
    // A resisted answer now SPOILS the charge instead of doing nothing: the
    // boss keeps its windup, but this share of it. You did not break the
    // charge — you knocked something out of it. The resist still does its one
    // job (the heavy blow is still coming, and no amount of CC stops it), and
    // no class has a button that does literally nothing every other turn.
    windupSpoilFrac: 0.5,
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
  //
  // "~6 LEVELS x 3 POINTS" DESCRIBES A RUN THAT DIES, and that is worth saying
  // out loud now that runs finish. It was written when reaching wave 15 was a
  // good run, so the budget it names is the budget of a LOSS. Measured across
  // all four strains, median level at the moment each boss wave begins:
  //
  //     wave  5    L2    3 points on top of 5/5/5/5
  //     wave 10    L4    9
  //     wave 15    L6   15      <- the ~18-20 the balance notes assume
  //     wave 20    L8   21
  //     wave 25   L10   27
  //     wave 30   L11   30
  //     finished  L12   33
  //
  // So the enemy table is fitted against a sheet holding ~15 points and meets
  // one holding 21-33 for the whole second half of the run. Chains drag it
  // earlier still — an owner's winning psy finished L12 with 23 Strength, which
  // is more Strength alone than the budget the curve was drawn against.
  // Reported, not acted on: whether act 2 should be met with double the sheet
  // is a design question, and the levers (this cost curve, the kill income
  // beside it, or act 2's growth) are all still where they were.
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
  // v8 -> v9 is the sym rework. A saved sym holds a Spore count for a bank
  // that no longer exists and, worse, holds NO grown thorns — so a mid-run
  // sheet would load with the whole ramp its wave count was earned on reset to
  // zero, which is a harder re-read than any stat drift: the class would be
  // unplayably weak rather than merely mistuned. Two of its four skills are
  // also gone by id. Every other strain rides along, as always.
  //
  // v9 -> v10 is the end of banks. Resolve moved off the player as a raw
  // capped field and became an uncapped status, so a v9 Unmutated save carries
  // `resolve: 4` in a field nothing reads any more — it would load holding
  // nothing, which is a live mechanic silently reset to zero rather than a
  // number merely mistuned.
  //
  // v10 -> v11 is the heal anchor. Every heal in the game was a share of max
  // HP and is now a share of a baseline body that grows with LEVEL, so a v10
  // sheet was allocated under an economy where a Vitality point bought the bar
  // and the refill both. A wide v10 sym or bio would load back healing at a
  // fraction of what its wave count was earned on — the same silent re-read as
  // every bump before it, and the largest one yet, because healing was 68-91%
  // of all the punishment a build absorbed.
  //
  // Bumping also gives every player empty slots on the next load, which is the
  // honest outcome — those runs are not playable as the game now works.
  saveKey: 'risen_run_v11',
  // Storage keys from older versions, cleared once on load so they cannot
  // accumulate invisibly. Oldest first; add the outgoing prefix here on a bump.
  // Slot keys are listed explicitly because the purge removes literal keys.
  oldSaveKeys: ['risen_run_v3', 'risen_run_v3_s1', 'risen_run_v3_s2',
                'risen_run_v4', 'risen_run_v4_s1', 'risen_run_v4_s2',
                'risen_run_v5', 'risen_run_v5_s1', 'risen_run_v5_s2',
                'risen_run_v6', 'risen_run_v6_s1', 'risen_run_v6_s2',
                'risen_run_v7', 'risen_run_v7_s1', 'risen_run_v7_s2',
                'risen_run_v8', 'risen_run_v8_s1', 'risen_run_v8_s2',
                'risen_run_v9', 'risen_run_v9_s0', 'risen_run_v9_s1', 'risen_run_v9_s2',
                'risen_run_v10', 'risen_run_v10_s0', 'risen_run_v10_s1', 'risen_run_v10_s2'],
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
      { id:'slash', name:'Slash', desc:'Deal {power!} damage. +{poison} POISON', type:'attack', power:1.0, poison:1, target:'enemy', basic:true },
      { id:'infest', name:'Infest', desc:'Deal {power!} damage. +{poison} POISON', type:'attack', power:0.50, poison:4, target:'enemy', cdTurns:3 },
      { id:'chitin', name:'Chitin', desc:'For {duration#turn}: take −{power%} damage. POISON on the enemy ticks twice per turn', type:'buff', buff:'chitin', duration:3, power:0.40, target:'self', cdTurns:5 },
      // MIASMA IS BIO'S ONLY FAUCET, and at 10% x 4 turns on a 5-turn
      // cooldown it was handing back 40% of a bar across the five turns a
      // wave-6 enemy needs ~2.5 of to take a third of it. Owner-measured the
      // honest way: died just past the first boss, holding the button that is
      // supposed to be the answer to attrition. 13% is the same shape (four
      // ticks, one press, still worth timing) paying 52% of a bar per cast.
      { id:'miasma', name:'Miasma', desc:'For {duration#turn}: regenerate {power+} each turn. The enemy is WEAK for {weak.duration#turn}', type:'buff', buff:'regen', duration:4, power:0.13, applies:[{ id:'weak', power:0.25, duration:3 }], target:'self', cdTurns:5 }
    ]
  },
  // THE TERROR MUTANT. Psy's mechanic is DREAD, a mark stacked ON THE ENEMY —
  // see the DREAD block in BALANCE for why the number moved off the player and
  // what killed Momentum. The kit is four verbs in order: Hunt (land a hit,
  // plant fear), Terrify (seize control — a burst of stacks, each one
  // slowing the enemy's turn rate), Traumatize (at 3+ DREAD the mind breaks:
  // stun), Kill (cash every stack in as damage — and with the fear spent, the
  // enemy speeds back up, so the finisher is a real decision, not a rotation
  // button). Its sentence: "you were beaten before I ever touched you."
  //
  // THE CLASS'S STAT IS SPEED, and it used to be Speed and Instinct. Fear came
  // from crits and from dodges, so Instinct was the engine and Speed was both
  // halves of the ratio. Hunt plants on hit now, so tempo is the engine on its
  // own — more turns is more fear is more slow is more turns. Instinct is a
  // pure damage stat for psy, which is a real loss of identity for the stat and
  // is left standing to be judged by play rather than patched over here.
  //
  // Still squishy by choice: every point of Vit is a point the engine didn't
  // get, not because the sheet says so.
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
      // HUNT PLANTS FEAR BY LANDING, full stop. It used to plant none at all:
      // the card read "your crits and your dodges plant +1 DREAD", which is a
      // CLASS mechanic parked on a button that had no part in it. Measured —
      // pressing Hunt without a crit gave zero, a critting TRAUMATIZE gave one,
      // and a dodge on the enemy's turn gave one. The card explained the strain
      // while lying about the skill, and the strain's number came from two
      // rolls the player does not make instead of the button they press most.
      //
      // On-hit now, like bio's Slash and base's Strike: a basic in this game is
      // the mechanic's trickle, every turn, for free.
      { id:'hunt', name:'Hunt', desc:'Deal {power!} damage. +{dread} DREAD', type:'attack', power:1.0, dread:1, target:'enemy', basic:true },
      // Plants 4, one MORE than Traumatize needs, so the advertised combo
      // survives one steadying hit: at the 1:1 anchor the enemy usually lands
      // a blow between your Terrify and your Traumatize, shedding a stack —
      // at +3 the threshold arrived already broken and the stun read as a
      // skill that didn't work.
      { id:'terrify', name:'Terrify', desc:'Deal {power!} damage and plant +{dread} DREAD. Every stack slows the enemy and opens its guard.', type:'attack', power:0.50, dread:4, target:'enemy', cdTurns:3 },
      { id:'traumatize', name:'Traumatize', desc:'Deal {power!} damage. Against {dreadNeed}+ DREAD the mind breaks: stunned for {stun#turn}.', type:'attack', power:0.95, stun:1, dreadNeed:3, target:'enemy', cdTurns:4 },
      // KILL TAKES HALF THE FEAR, NOT ALL OF IT, and the old version was a
      // button that was correct to never press. Every stack is doing three
      // things while it sits there — slowing their turn, opening their guard
      // (+4% damage taken, uncapped), and dripping the siphon into you — so
      // "spend the whole pile for one hit" was a trade against a fight's worth
      // of compounding value. In a boss fight, which is where DREAD actually
      // piles up, the arithmetic said hold, every single time. A decision that
      // resolves the same way at every count is not a decision; it is a dead
      // card taking up a slot.
      //
      // Half (rounded up, so a lone stack is still edible) keeps the shape the
      // card promised — cashing out costs you control, and the enemy speeds
      // back up as you do it — while leaving an engine to keep running. The
      // finisher is now "how deep do I cut into my own advantage", asked every
      // five turns, instead of "do I delete my class".
      // THE CARD SHOWS THE WHOLE BLOW, not its parts. Every other card can
      // state one number because one number is all it deals; Kill's depends on
      // what is standing in front of you, and "1.2x Attack Damage plus 0.6x per
      // stack, of half the pile rounded up" is arithmetic no one should be
      // doing mid-fight. killTotal computes exactly what the next press will
      // hit for — including that only HALF the stacks are torn away, which is
      // the part that would otherwise be silently double-counted by eye.
      //
      // It reads the same fields the damage pipeline reads, off its own card,
      // so the number cannot drift from the hit when one of them is retuned.
      //
      // Deliberately NOT modelling DREAD's vulnerability, crits, or WEAK: every
      // other card states what the skill produces and lets the fight modify it,
      // and a card that folded in some multipliers but not others would be
      // lying more precisely. The blow lands HARDER than this against a marked
      // enemy, which is the right direction to be wrong in.
      //
      // Base power 1.20 -> 2.00: exactly twice Attack Damage, so the floor of
      // the finisher is legible without a pile behind it.
      { id:'kill', name:'Kill', desc:'Deal {killTotal} damage. Tears away HALF the enemy’s DREAD — +{perDreadPower!} damage and {feedPerDread+} healed for each.', type:'attack', power:2.00, perDreadPower:0.60, consumesDread:true, consumeFrac:0.5, feedPerDread:BALANCE.player.dreadFeedFrac, target:'enemy', cdTurns:5,
        killTotal: (p, s) => {
          const e = state.enemy;
          const held = (e && e.hp > 0 && !e._defeated) ? statusStacks(e, 'dread') : 0;
          const spent = Math.ceil(held * (s.consumeFrac || 1));
          return formatNum(Math.max(1, Math.floor(p.atkPower * ((s.power || 1) + (s.perDreadPower || 0) * spent))));
        } }
    ]
  },
  // THE ORGANISM. Sym's mechanic is THORNS — one number, worn on the player,
  // that GROWS every time it is hit and keeps growing for the whole run. See
  // the THORNS block in BALANCE for why the wallet died and why the ramp is
  // run-permanent. Its sentence: "everything you do to me makes me stronger."
  //
  // THE OTHER THREE ANSWER A HIT; SYM WANTS ONE. Base accepts the hit and
  // trades, bio outlasts it, psy refuses it outright — sym is the only strain
  // in the game that is PAID for being struck, and the kit now says so with a
  // verb instead of a passive. Provoke is that verb, and it is the only button
  // here that spends your turn to buy the ENEMY a turn: suicide for anyone
  // else, correct for you. It doubles as sym's answer to the telegraph, and
  // deliberately a different answer from psy's: a stun DELETES the heavy swing,
  // Provoke goads it out early so it lands as an ordinary one. You do not dodge
  // the hit — you take it small, and you eat for it.
  //
  // RAISE SPINES + PROVOKE IS THE COMBO, and it stays two cards on purpose:
  // raise the spikes, then make them swing into you. It asks a question no
  // other combo in the game asks, because you have to be healthy enough to eat
  // what you invited — and it degrades honestly, since Provoke bare (Spines
  // still cooling) is the wrong way to use it and still works.
  //
  // Sustain is SHED, and it is the one place a run-permanent ramp can be spent:
  // healing costs you growth you cannot get back this fight. There is no burst
  // finisher and that is the point — Bloom Eruption was the most base-shaped
  // card in the kit (spend the bank, hit once, start over) and it was carrying
  // 42% of sym's damage while thorns carried 22%. Cutting it is what forces the
  // thorns half to actually be the class.
  //
  // The class's stats are Vitality and Strength, but SPEED IS THE INTERESTING
  // ONE: more of your turns means proportionally FEWER enemy swings, and swings
  // are food. Speed makes you faster and smaller. It is the only stat in the
  // game with a real cost attached, and it lands here on purpose — sym is the
  // strain whose allocation had nothing to say.
  sym: {
    name: 'Symbiotic', color: 'sym',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      // 0.35 -> 0.55: with THORNS as the ramp, the basic is where the number
      // gets read back on your OWN turns, and it has to carry the share Bloom
      // used to. A grown sym should feel its size every time it swings.
      { id:'latch', name:'Latch', desc:'Deal {power!} damage + {thornsScale%} of your THORNS.', type:'attack', power:1.0, thornsScale:0.55, target:'enemy', basic:true },
      { id:'spines', name:'Raise Spines', desc:'THORNS ×{power} and pain reflect doubled for {duration#turn}. Every hit taken grows +{growBonus} extra THORNS.', type:'buff', buff:'spines', duration:3, power:2, growBonus:BALANCE.player.thornsSpinesGrow, target:'self', cdTurns:4 },
      // THE OLD WORDING DESCRIBED THE IMPLEMENTATION, not the decision. "Shed
      // THORNS for the rest — 4% each, never past 35% of your growth" is three
      // clauses, two of which are internal accounting, and the important half
      // (it takes only what the heal needed, so a huge number makes it CHEAP
      // rather than expensive) was the half not said. Now the first sentence
      // is what you get, the second is what it costs, in that order.
      { id:'shed', name:'Shed', desc:'Heal {healFrac+}, then tear off THORNS to heal {hpPerThorn+} more each. Takes only as many as the wound needed, up to {capFrac%} of what you have grown.', type:'heal', healFrac:0.08, shedFuel:true, hpPerThorn:BALANCE.player.shedHpPerThorn, capFrac:BALANCE.player.shedCapFrac, target:'self', cdTurns:3 },
      { id:'provoke', name:'Provoke', desc:'Bare your guard: the enemy strikes at once and cannot miss. +{growBonus} THORNS, and a charged telegraph comes out now — ordinary, or half-strength if it shrugs you off.', type:'provoke', growBonus:3, target:'enemy', cdTurns:4 }
    ]
  },
  // Base Sonny, reached via "RESIST MUTATION". Refused the infection, so he has
  // no strain mechanic and never drafts mutations. His damage comes off
  // Strength like everyone else's; the "scales off your highest stat" rule went
  // when Attack Damage was unified.
  //
  // THE ONLY STRAIN WITH TWO NUMBERS, and it is the refusal that earns them.
  // RESOLVE on himself, BLEED on them — not two mechanics but two halves of one
  // exchange, because a man with no venom and no fear has nothing to fight with
  // except what an ordinary long fight does to both bodies. Resolve is bought by
  // landing hits and taking them; the cut is only as deep as the Resolve behind
  // it. One number feeds the other, which is what keeps it from reading as a
  // second currency to manage.
  //
  // BLEED IS WHY THE KIT NEEDED ANYTHING AT ALL. Measured before the pass, base
  // died at the first boss with 57% of its bar untouched — it needed roughly
  // twice the damage — and 48% of everything it dealt was locked in Last Stand,
  // a 5-turn cooldown. Between spikes it swung for 25 and nothing else happened.
  // A wound that keeps working across those turns is exactly the shape of the
  // hole, which is why the fix is a rider on the basic rather than a rebalance.
  //
  // The sentence is unchanged and now actually true: endure, then everything at
  // once — except the enduring is doing damage the whole time.
  base: {
    name: 'Unmutated', color: 'base',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      // "AS DEEP AS THE RESOLVE BEHIND IT" SAID NOTHING. It is a true sentence
      // about the rules and a useless one on a card: it names a relationship
      // when the player wants a NUMBER, and the number was already knowable —
      // bleedDepth computes it from the sheet every time a cut lands. A desc
      // field may be a function now (see fmtDesc), so the card prints what the
      // next Strike will actually open, and it moves as Resolve stacks up.
      { id:'jab', name:'Strike', desc:'Deal {power!} damage. +{buildsResolve} RESOLVE, and open a wound: +{bleedTick} BLEED a turn for {bleedTurns#turn}', type:'attack', power:1.0, buildsResolve:1, bleed:1, bleedTick:p => bleedDepth(p), bleedTurns:BALANCE.player.bleedDuration, target:'enemy', basic:true },
      { id:'bandage', name:'Bandage', desc:'Heal {healFrac+} and +{resolveHealBonus%} per held RESOLVE', type:'heal', healFrac:0.14, resolveHealBonus:0.02, target:'self', cdTurns:4 },
      // BRACE LASTS TWO TURNS, NOT ONE, and the reason is measured. This is
      // base's answer to the telegraph, and it was the only answer in the game
      // that had to be timed to the exact turn — one turn of cover on a 4-turn
      // cooldown, against a windup every ~4 player turns, so it was a coin flip
      // whether it was even available, and using it as filler (the obvious
      // thing to do with an off-cooldown button) guaranteed it was not. 60% of
      // base's deaths were a heavy landing.
      //
      // Perfect timing was measured first, before the number moved: holding it
      // and casting it on the exact pre-heavy turn took base's first-boss clear
      // from 20% to 100% with nothing rebalanced. So the ANSWER was never
      // insufficient — the window was. Two turns keeps the read (you still have
      // to see the telegraph and act on it) while forgiving a turn of
      // misjudgement, which is the difference between strict and broken.
      // `holdFor` tells the bot the same thing the card tells the player.
      { id:'counter', name:'Counterpunch', desc:'Brace for {duration#turn}: −{power%} damage taken, stacking with RESOLVE. A hit taken while braced counters {counterPower!} damage and opens a wound: +{bleedTick} BLEED a turn', type:'buff', buff:'brace', duration:2, power:0.60, counterPower:1.20, counterBleed:1, bleedTick:p => bleedDepth(p), holdFor:'windup', target:'self', cdTurns:4 },
      { id:'laststand', name:'Last Stand', desc:'Deal {power!} damage, +{perResolvePower!} per RESOLVE consumed. Spends all RESOLVE', type:'attack', power:1.20, perResolvePower:0.40, consumesResolve:true, target:'enemy', cdTurns:5 }
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
  // COLOSSAL went the way of ARMORED, and for a narrower reason than it was
  // once written up with: x2.2 HP at x0.8 rate changed nothing the player DID
  // with the extra turns, because at the time there was nothing to do with
  // them. The affix was removed, not the idea. An elite tag is a one-line
  // modifier, and "big" wants moves to go with it — so BIG comes back as a
  // bespoke enemy that does something with the room its health buys, whenever
  // there is something to do.
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
    // enemies: the act's trash ROSTER. Each entry is an id (the key its art is
    // filed under in sprites.js) and the name that appears on the card. One
    // face here is a perfectly good roster — the Laboratory has exactly one
    // thing loose in it.
    enemies: [{ id: 'experiment', name: 'Escaped Experiment' }],
    bossName: 'Prime Symbiote',
    growthMult: 1 },
  { num: 2, name: 'MCP Encampment', startWave: 16, endWave: 30,
    zones: ['MCP ENCAMPMENT'],
    // THREE FACES, ONE STAT LINE. The encampment fields soldiers rather than
    // one repeated silhouette, and they rotate by wave (see makeEnemy) so a
    // stretch of act 2 shows you all of them. They are deliberately identical
    // in numbers: a wave-N enemy is a wave-N enemy, and if a rifleman should
    // ever fight differently from a combatant that is a decision for the enemy
    // table to make out loud, not something a sprite quietly implies.
    enemies: [{ id: 'enforcer',  name: 'MCP Enforcer'  },
              { id: 'combatant', name: 'MCP Combatant' },
              { id: 'rifleman',  name: 'MCP Rifleman'  }],
    bossName: 'MCP Grenadier',
    // TIERGROWTH 1.25 -> 1.45. At 1.25 act 2 grew 1.81x across its fifteen
    // waves while the player's sheet grew about 1.9x in survivability over the
    // same stretch — so the second half of the game got flatter the further you
    // went, and the danger curve (your own turns before its hits add up to your
    // bar) sat between 5 and 7 from wave 11 to the end. Measured: the most
    // dangerous wave in the game was 11, not 30.
    //
    // Still gentler than act 1's 1.85, and deliberately: the player's growth
    // slows in act 2 too (points arrive at the same rate but land on a much
    // bigger base), so the enemy curve should slow with it. What it must not do
    // is slow down MORE than the player does, which is what 1.25 did.
    growthMult: 4.5, tierGrowth: 1.45, withinStep: 0.04 }
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
//   resolveOnHitTaken(unit, st)    extra RESOLVE gained from being hit (base).
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
    // A MARK TICKS ON THE TURN OF WHOEVER PUT IT THERE — see the `inflicted`
    // note in tickStatuses. It used to tick on the turn of whoever CARRIED it,
    // which metered bio's whole damage output by how often the ENEMY acted:
    // buying Speed bought fewer enemy turns, so the fastest bio was the one
    // whose rot ticked least. The stat was worse than dead, it was negative.
    // Psy's siphon already lived on this rule and the comment beside it called
    // poison its mirror; the mirror is real now.
    inflicted: true,
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
        // AN AILMENT TICK IS DAMAGE THE PLAYER DEALT, and it was not being
        // counted — so the result screen, and every balance measurement taken
        // through simulateRun, has been under-reporting bio by most of its
        // output for as long as poison has been its ramp. Guarded on the
        // target, because an elite's venom ticking on YOU is not yours.
        if (!unit.isPlayer) state.damageDealt += dmg;
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

  // UNMUTATED'S WOUND. Poison's twin in shape and its opposite in source: the
  // rot is alien and free, a cut is ordinary and paid for. See the BLEED block
  // in BALANCE for the two rules that keep this from being bio in red.
  //
  // Deliberately plainer than poison: no double-tick interaction (that is bio's
  // trick, not a property of damage-over-time) and it does not persist between
  // fights.
  //
  // THE TIMER IS THE POINT, not an oversight — it is half of what separates
  // this from the rot. Each new stack refreshes the whole wound, so bleeding
  // an enemy out means never stopping; four turns of not cutting and it closes.
  bleed: {
    id:'bleed', name:'BLEED', tone:'bleed', kind:'debuff',
    // No maxStacks, exactly like poison: the twin shares the shape.
    stacking:'stack', defaults:{ duration:4, stacks:1, perStack:1 },
    // Ticks on the cutter's turn, like the rot — and here the timer makes it
    // matter twice, because the duration counts down on the same clock. Four
    // turns of BLEED is four of YOUR turns now, however fast either of you is.
    inflicted: true,
    // The wound is as deep as the LAST cut, not the deepest one ever made —
    // which is what gives spending Resolve a price. See applyStatus.
    perStackRule:'newest',
    label: st => 'BLEED ×' + (st.stacks||1) + '  ' + Math.ceil(st.duration) + 't',
    onTurnStart(unit, st) {
      const dmg = Math.max(1, Math.floor((st.perStack||1) * (st.stacks||1)));
      unit.hp = Math.max(0, unit.hp - dmg);
      if (!unit.isPlayer) state.damageDealt += dmg;   // see the note on poison's tick
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
    // Boosts multiply and refresh, never overwrite: a x1.5 landing on top of
    // Raised Spines is x2 * x1.5 = x3, not a downgrade to x1.5. The duration
    // is shorter than Spines' cooldown, so it can't ladder on itself forever.
    stacking:'amplify', defaults:{ duration:3, power:2 }, persists:true,
    label: st => 'SPINES ' + Math.ceil(st.duration) + 't',
    thornsMult: (u, st) => st.power || 1,
    // Sym: the window is an INVITATION, not the gate it used to be. Every hit
    // grows thorns whether the spines are up or not (see growThorns); raising
    // them makes each hit worth MORE. Before, growth only happened inside this
    // window — three turns in every seven — so the class that wants to be hit
    // spent most of the fight not being paid for it.
    onHitTaken(unit, st, ctx) {
      if (unit.class !== 'sym' || !(ctx.damage > 0)) return;
      growThorns(unit, P().thornsSpinesGrow, 'SPINES, hit taken');
    }
  },

  // Unmutated's mechanic, and a STATUS rather than a wallet since the banks
  // came out. See the RESOLVE block in BALANCE for why the ceiling went and why
  // it does not persist between fights.
  //
  // Not permanent-with-a-duration but PERMANENT: nothing times it out inside a
  // fight, only Last Stand spends it. It is deliberately missing `persists`, so
  // the between-fight sweep drops it and every fight is rebuilt from nothing.
  //
  // The reduction is NOT an incomingMult here, for the same reason Brace's
  // isn't: applyEnemyDamage sums the two and caps the sum once, so a generic
  // hook would multiply them into a different (and quietly weaker) number.
  resolve: {
    id:'resolve', name:'RESOLVE', tone:'resolve', kind:'buff',
    stacking:'stack', permanent:true, defaults:{ stacks:1 },
    label: st => 'RESOLVE ×' + (st.stacks||1)
  },

  brace: {
    id:'brace', name:'BRACE', tone:'brace', kind:'buff',
    stacking:'replace', defaults:{ duration:1, power:0.60, counter:1.20 },
    label: st => 'BRACE ' + Math.ceil(st.duration) + 't',
    // Deliberately NOT an incomingMult: Unmutated adds Brace to held Resolve
    // and caps the sum (applyEnemyDamage), so the two are one reduction rather
    // than two multiplied ones. Splitting it into a generic hook would quietly
    // halve the skill.
    // No resolveOnHitTaken: a braced hit banks exactly what any hit banks.
    // Brace used to add a second point on top, which made a hit worth more for
    // being absorbed — the skill pays out in mitigation and the counter, not in
    // a quietly better exchange rate.
    onHitTaken(unit, st, ctx) {
      const e = ctx.attacker;
      if (!e || unit.hp <= 0 || e.hp <= 0) return;
      const cdmg = Math.max(1, Math.floor(unit.atkPower * (st.counter||1.2)));
      const before = e.hp;
      e.hp = Math.max(0, e.hp - cdmg);
      state.damageDealt += cdmg;
      if (e.hp <= 0) state._lastOverkill = Math.max(0, cdmg - before);
      floatText(e, cdmg, 'damage');
      // The counter draws blood. Base's defensive turn used to produce one flat
      // number and nothing lasting; now bracing is part of the offence, which
      // is the whole reason a class built on absorbing hits can afford to spend
      // a turn not attacking.
      if (st.counterBleed && unit.class === 'base' && e.hp > 0)
        applyStatus(e, 'bleed', { stacks: st.counterBleed, perStack: bleedDepth(unit), duration: P().bleedDuration });
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
    label: st => 'DREAD ×' + (st.stacks||1),
    // The slow saturates where the count does not: past the floor a stack buys
    // no further hesitation, only an opener guard. Without this an unbounded
    // count would walk the enemy toward never acting at all, which is the one
    // thing the old stack ceiling was there to prevent.
    apsMult: (u, st) => Math.max(P().dreadSlowFloor, 1 - (st.stacks||0) * P().dreadSlowPerStack),
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
      // Anchored for the player, still off max HP for anybody else — see
      // healAnchorFor(). A regenerating enemy has no anchor to read.
      const heal = Math.max(1, Math.floor(healAnchorFor(unit) * (st.power||0)));
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + heal);
      floatText(unit, heal, 'heal');
      logHeal('REGEN', unit, unit.hp - before, [
        Math.round((st.power||0)*100) + '% of ' + logNum(healAnchorFor(unit)),
        logNum(unit.hp) + '/' + logNum(unit.maxHp)
      ]);
      updateUnitCard(unit);
      return false;
    }
  }
};

