// Balance, build stamp, classes, statuses — the numbers and tables
// ============================================================
// Facts and pointers, not a rulebook. Measurements go stale — re-run before
// repeating one.
//
//  * THE STARTING SHEET IS THE ANCHOR: every strain begins 5/5/5/5 with 25
//    Attack Damage, 100 HP, 1.00 turn rate, 10% evade/crit/block. One point is
//    5 damage or 20 HP. Enemies are fitted to it, so a fight that feels wrong
//    has one place to look.
//
//  * PLAYER AND ENEMY STATS ARE COMPUTED BY SEPARATE FUNCTIONS, and must stay
//    that way. Enemies once ran through the player's derived-stat formulas and
//    by wave 30 sat at capped evade/block/crit.
//
//  * COOLDOWNS TICK ON YOUR TURNS, not on a clock, so turn advantage never
//    speeds up your rotation — it only decides how much the enemy does inside
//    it, which makes turn rate a mitigation stat in an offensive costume.
//
//  * HEALING IS A SHARE OF THE HEAL ANCHOR, NOT OF MAX HP — healAnchorFor() in
//    stats.js. Damage-proportional healing (lifesteal, thorns-feed) is separate
//    and is not routed through it.
//
//  * Strains differ only by their skills. Damage, HP, turn rate and every
//    percentage are identical across all four. A strain that should be fast
//    wants a MULTIPLIER on the rate, never an additive base.
// ============================================================

// ---- Build ----------------------------------------------------
// A date: the only question it answers is which of two files is newer. Suffix a
// letter for a second build the same day. Shown under the logo, first line of
// every combat log, and stored in the save.
//
// OWNER: BUMP THIS ON EVERY PUSH TO MAIN, with no exception for a change that
// touches no rules. It is the one version the owner can see from inside the
// game, and it is how he knows the tab in front of him is the build he was just
// told about. A stamp that only sometimes moves cannot answer that.
//
// KEEP SEPARATE FROM BALANCE.saveKey, which answers "are saved runs still
// valid". Deriving one from the other would wipe every save on a typo fix.
const BUILD = '2026-08-03ah';

const BALANCE = {
  player: {
    // Every stat is (5 + points) / 5 times its starting value: 20% a point,
    // no flat bases anywhere. A base hands out value nobody paid for.
    apsPerSpeed: 0.20,
    // Turn rate is the one stat on a curve rather than a line: exactly x1.00 at
    // 5 Speed, and points above it buy a shrinking share of apsGain, which is
    // the asymptote and THE DIAL. apsHalfPoints is where you have bought half of
    // what the curve will ever give. Full investment lands near x2.5. It
    // replaced a hard x4.00 cap reached at 20 Speed — a ceiling you hit at the
    // halfway mark is a target, not a ceiling.
    sheetAnchor: 5,          // the starting sheet, in every stat
    apsGain: 2.00, apsHalfPoints: 10,
    apsCap: 6.00,            // backstop AFTER apsMult; the curve tops near x3 alone
    // 5 Strength is 25 Attack Damage, 5 Vitality is 100 HP. No flat base and no
    // per-level HP: max HP must stay exactly Vitality x 20.
    damagePerStr: 5,
    hpPerVit: 20,
    // Three is the smallest grant where allocation still has shape — commit all
    // three or lean 2-1.
    pointsPerLevel: 3,
    // Set so a starting sheet reads 10 / 10 / 10 at 5 in every stat. Evade and
    // block look odd alone because each is "10% minus the starting 5 points".
    // ---- DEFENCE ----------------------------------------------------------
    // Block and evade were CHANCE, and chance does not scale: both capped
    // (40% / 35%), so past ~41 Vitality a point bought no defence at all, and
    // a coin flip is worth less the bigger a hit gets — you live until two
    // land in a row. Replaced with reductions on one curve:
    //
    //   ARMOR    (Strength)  every hit
    //   EVASION  (Speed)     every hit
    //
    // X / (X + defenseK): no cap, always worth another point, never immunity.
    // One shared K so the two are directly comparable, and 5 points reads 10%
    // exactly like the old pair did. THEY MULTIPLY, so two at 50% is 4x
    // effective HP, not 2x.
    //
    // A third layer, READ (Instinct, against telegraphed heavies only), was cut
    // 2026-08-03w — the owner was not pressing it and did not want a stat for
    // it. A telegraph is answered by the button that answers it. Vitality buys
    // HP and recovery; Instinct is now offence alone.
    defenseK: 45,
    defenseCap: 0.90,        // per layer, after gear — a backstop, not a target
    // Vitality's second job. Zero at the starting sheet (it reads points ABOVE
    // the anchor), so it rewards investment rather than handing every build a
    // free faucet. A share of the heal anchor per turn.
    regenPerVit: 0.002,
    // ---- INSTINCT ---------------------------------------------------------
    // Buys crit CHANCE and crit DAMAGE from the same points, so it is quadratic
    // in its own points. It has to be: crit chance against a FIXED multiplier is
    // bounded, and a bounded stat cannot chase an unbounded linear one.
    //
    // Both rates are picked so Instinct and Strength LAND TOGETHER at full
    // investment, which puts the crossing near the end deliberately:
    // half-investing really is worse than not. What it costs is variance. When
    // re-deriving, remember a Strength build crits too — it keeps the starting 5
    // Instinct, so both columns are gain over the SAME starting sheet.
    // critCap 0.90 -> 1.00 on 2026-08-03ae (owner: "uncap crit"). The ceiling
    // was the only thing stopping Instinct from finishing what it buys; the
    // MULTIPLIER was already uncapped and grows +0.25x a point forever, so past
    // 50 Instinct every further point still pays, just all of it into size
    // rather than frequency.
    critBase: 0.00, critPerInstinct: 0.02, critCap: 1.00,
    // Capped at 0.90, not 1.00: one plain hit in ten keeps the gold CRIT floater
    // naming an event. Points past the cap still buy crit damage.
    critMultBase: 1.0, critMultPerInstinct: 0.25,   // crit damage = x(1 + 0.25 x Instinct)
    // A heal you PRESS can crit, on the same chance as a blow but on its own
    // flat multiplier, never critMult. Ticks do not crit, actions do — the same
    // rule poison and bleed already follow.
    critHealMult: 2.0,
    // Ailment damage is a SHARE OF ATTACK DAMAGE and thorns a share of max HP,
    // so both track the anchors instead of carrying their own curves. The
    // fractions are the smallest ones that step cleanly: every point is +1
    // exactly, with nothing lost to rounding.
    ailmentDamageFrac: 0.20,
    thornsFrac: 0.05,
    // POISON (bio) is permanent and UNCAPPED — the stack count is bio's ramp,
    // and the ramp is the class: no burst, the enemy's remaining life is a clock.
    // ---- THE ROT OUTLIVES ITS HOST (2026-08-03l) ---------------------------
    // BIO'S ONE DISTINCT VERB, and the answer to the thing every measurement
    // this week said about it: its ramp reset to zero every fight and rebuilt
    // too slowly to matter, which is why shortening fights (hpExp) helped every
    // strain but this one. Half the stacks on a corpse move to whatever comes
    // in next.
    //
    // Distinct because nothing else crosses the fight boundary on the ENEMY's
    // side — sym's ramp is run-permanent but worn by the player, psy's fear
    // dies with its host, base's wound closes. And it makes the END of a fight
    // a decision for the first time: finish it now, or spend one more turn on
    // Infest so the pile you carry is bigger.
    //
    // SELF-LIMITING, not a snowball: carrying half converges at roughly twice
    // what one fight accumulates (S = S/2 + G solves to S = 2G), so it doubles
    // bio's working stack count and then holds there.
    poisonCarryFrac: 0.5,
    // ---- STRENGTH'S SECOND TERM (2026-08-03i) ------------------------------
    // STRENGTH DRIVES MORE OF THE MARK IN. Measured: every strain's damage is
    // 57-80% its ramp, and a ramp's size is STACKS (bought with turns and with
    // staying alive) while attack damage only sets what one stack is WORTH. So
    // Strength multiplied the smallest term in the equation and bought nothing
    // that keeps you alive — at 32 runs a cell it won 3% of runs, and TRIPLING
    // damagePerStr left it at 3% while SPD+VIT went 63% -> 78%. Not a tuning
    // problem: a stat with one linear term in a game decided by attrition.
    //
    // The answer is the one Instinct already got — a SECOND term, so the stat
    // is quadratic in its own points: more stacks AND a bigger stack. base has
    // worked this way all along (bleedPerStr), which is the precedent.
    //
    // Each is "one extra stack per N Strength" and DELIBERATELY GIVES NOTHING
    // AT THE STARTING SHEET (floor(5/N) = 0 for N > 5): this must reward
    // INVESTMENT, not hand every build a free stack it never bought.
    // 8 -> 2 on 2026-08-03ad, so STRENGTH is bio's stat rather than a stat it
    // tolerates (owner: bio STR, psy SPD, sym VIT, hyd INS). Measured, bio's
    // wins per 100 on STR+VIT against SPD+VIT: at 8 it was 12 v 30, at 5 14 v
    // 37, at 3 35 v 33 (a tie inside the noise), at 2 51 v 38. Speed is hard to
    // beat here because POISON ticks on YOUR turn, so rate multiplies bio's
    // biggest damage source directly — the stack term has to out-pull that.
    poisonPerStr: 2,           // bio: extra POISON per application, per this much Strength
    // THE ROT WEAKENS WHAT IT IS IN (2026-08-03aa). Bio was the one strain
    // whose ramp did nothing defensive: measured, 53% of what was aimed at it
    // got stopped against base's 73% on the same allocation, because RESOLVE
    // grows all fight and buys reduction while Chitin is a flat -40% worth the
    // same at wave 1 and wave 60. So POISON now does two jobs like every other
    // strain number does — it eats their health AND takes the edge off their
    // swing. Uncapped count, bounded effect, the shape DREAD and RESOLVE use.
    // SATURATES LATE ON PURPOSE: at 0.008 the cap needs ~37 stacks, against a
    // median peak of 57, so most of a fight is spent below it and stacking
    // more still pays. DREAD's slow saturating at 9 out of 30-44 is exactly
    // the mistake this avoids.
    poisonWeakenPerStack: 0.008,
    poisonWeakenCap: 0.30,
    // PSY PAYS THE MOST PER STACK, so it buys them at the worst rate: a DREAD
    // stack slows, opens the guard, feeds the siphon AND prices Kill, where a
    // POISON stack only ticks.
    dreadPerSpeed: 14,         // psy: extra DREAD planted, per this much Speed
    // 10 -> 6 on 2026-08-03ad so VITALITY is decisively sym's stat rather than
    // marginally so. Measured, sym's wins per 100 pure VIT against SPD+VIT: at
    // 10 it was 47 v 38 (a 9-point gap, inside the noise floor), at 6 59 v 35,
    // at 4 48 v 51, at 2 74 v 65. 6 is the one that separates.
    thornsPerVit: 6,           // sym: extra THORNS per hit taken, per this much Vitality
    // ---- BLEED (Unaugmented) ------------------------------------------------
    // Base's second number. IT MUST NOT BECOME BIO IN RED, and three differences
    // keep them apart: a wound ticks on EVERY turn, both sides, and eats a stack
    // doing it, where the rot ticks once a turn forever; a tick hits for what the
    // pile HAS, so 8 stacks pay 8+7+6+... and double the stacks is four times the
    // damage; and depth rides the RESOLVE behind the cut, snapshotted
    // newest-wins, so spending Resolve on Last Stand makes later wounds
    // shallower. Application has to clear two a turn-cycle or the pile drains
    // faster than it is fed.
    bleedBase: 2,
    bleedPerStr: 5,                          // one extra stack per this much Strength
    bleedPerResolve: 0.10,                   // each held RESOLVE deepens a NEW cut by this share of the ailment base
    // ---- THORNS (sym) -----------------------------------------------------
    // ONE NUMBER THAT GROWS, and the only RUN-PERMANENT mechanic in the game.
    // Forced by measurement: a trash fight gives ~5 enemy swings and a boss
    // ~10-13, so a per-fight ramp could only ever reach 5 before being wiped.
    // PAID OUT THREE WAYS, which is what makes one number enough: the enemy
    // takes it when they swing, Latch reads a share of it back on your turns,
    // and Shed converts it to healing.
    thornsFrac: 0.05,          // INNATE thorns: a twentieth of max HP, and the floor Shed can never eat into
    // 1 -> 2 with the 30-wave restructure: the run feeds sym a third fewer
    // hits than the 45-wave one did, and this is the only run-permanent ramp.
    // Derived, not measured — judge by play.
    thornsPerHit: 2,           // every hit taken grows thorns by this, no window and no condition
    thornsBigHitFrac: 0.15,    // what counts as a BIG hit — the log line only; growth reads the share directly
    thornsPerBar: 12,          // ...plus this many for a hit that took your WHOLE bar, pro rata. No ceiling: the share is its own bound
    // THE SPINES ALSO BLUNT WHAT LANDS (2026-08-03ac). Sym was the last strain
    // whose ramp did nothing defensive: THORNS paid out three ways — reflect,
    // Latch, Shed's heal — and every one of them was offence. Measured, 45-47%
    // of what was aimed at sym got stopped against 61% for bio and 62% for
    // base, the worst in the game, on a class whose damage REQUIRES being hit.
    // Same fix that worked on bio's rot: uncapped count, bounded effect.
    // The cap needs ~625 thorns against a median run peak of 493, so it
    // saturates just past where a run ends and another thorn keeps paying.
    thornsWardPerPoint: 0.0004,
    thornsWardCap: 0.25,
    thornsSpinesGrow: 2,       // extra growth per hit while Spines is up
    // SHED TAKES ONLY AS MANY THORNS AS THE HEAL NEEDED, capped by the fraction
    // below. A percentage cost against a runaway number would grow without bound
    // while its payout (bounded by max HP) does not, so the button would stop
    // being worth pressing exactly when you had played best.
    // TORN SPINES REGROW AT THE NEXT SPAWN (2026-08-03f): the cost is
    // per-fight, never the run's. Sym was the only strain whose sustain ate
    // its own progression, and a heal that shrinks the class's number is why
    // the class felt weak to play.
    shedCapFrac: 0.35,         // Shed never takes more than this share of GROWN thorns in one press
    shedHpPerThorn: 0.04,      // one thorn shed is worth this share of the heal anchor
    reflectFrac: 0.20, reflectSpinesMult: 2,   // sym: share of damage taken reflected back; doubled while Spines is up
    // ---- PRESSURE (Hydraulic) ---------------------------------------------
    // The fourth strain's number, and the only one that pays into SINGLE HITS
    // rather than into a tick, a reflect or a debuff (owner: "big crits, big
    // single hits as opposed to ramping dots"). Two jobs, like every other
    // strain number: the lines drive the servos harder (crit DAMAGE, which is
    // the uncapped half of crit) and they brace the frame (reduction, bounded).
    // Uncapped count, bounded effect.
    // What a blow packs in AT THE STARTING SHEET. INSTINCT DECIDES HOW MUCH,
    // on the (5 + points) / 5 rule every other stat already follows — measured
    // 2026-08-03ag, a flat rate meant every build got the same pile off the same
    // presses and Instinct could only ever tilt it, so STR (which multiplies all
    // of an attack class's output, and buys armor besides) won every row.
    pressurePerHit: 4,
    // THE PER-LINE VALUES ARE FLAT, and stay that way: Instinct scales the PILE,
    // so anything that also scaled per line would count the stat twice. Rebased
    // 2026-08-03ag against the piles the new rate actually produces — measured at
    // 55 held / 262 peak on an INS build, 30 / 93 on a STR one.
    critPerPressure: 0.06,         // each line of it: +0.06x crit damage
    critChancePerPressure: 0.006,  // ...and this much crit chance
    // Both wards saturate just past where the INS pile lives, so most of a fight
    // is spent under them and another line still pays. DREAD's slow saturating at
    // 9 against a peak of 30-44 is the mistake this is avoiding.
    pressureWardPerPoint: 0.005,   // ...and this much off what lands
    pressureWardCap: 0.35,
    // THE FRAME BLEEDS OFF HEAT. Hyd's only faucet was welded to Dampen, which
    // is also its only brace — so the bot correctly held it for telegraphs and
    // the class went through every exam fight with no sustain at all: measured
    // 43-45% of deaths to telegraphs, against 3-25% for everyone else. Ticks on
    // your turn per line held, the shape psy's SIPHON already uses, and Rupture
    // vents it with everything else: holding the pile is what keeps you alive.
    // Capped for the same reason the ward is — the pile has no ceiling.
    pressureSiphonFrac: 0.002,     // heal per PRESSURE held, per player turn, as a share of the heal anchor
    pressureSiphonCap: 0.12,       // ...never more than this share of the anchor in one turn
    levelUpHealFrac: 0.15, recoverHpFrac: 0.08,
    // ---- THE HEAL ANCHOR --------------------------------------------------
    // EVERY HEAL FRACTION IN THE GAME IS A SHARE OF THE ANCHOR, NOT OF MAX HP.
    // When heals were a share of max HP, Vitality bought the bar AND the
    // multiplier on the refill, and out-damaged Strength in all four strains.
    //
    // The anchor is the bar you would have at 5 Vitality, grown by LEVEL — a
    // schedule nobody buys. healAnchorPerLevel IS THE DIAL: 0 freezes healing at
    // 100 forever and every heal button dies by zone 2.
    healAnchorPerLevel: 0.30,
    // ---- DREAD (psy) ------------------------------------------------------
    // Psy's mechanic LIVES ON THE ENEMY, so it ramps fresh and fast every fight
    // and dies with its host: bio's mark eats the enemy's HEALTH, psy's eats
    // their TURNS.
    //
    // EACH STACK DOES TWO THINGS, and it needs both: the enemy hesitates (−rate)
    // and its guard opens (+damage taken). Slow alone is mitigation in an
    // offensive costume. The count is uncapped; the slow saturates at a floor,
    // because an unbounded slow is a stun nobody paid for.
    dreadSlowPerStack: 0.05, // each stack: −5% enemy turn rate
    // FLOOR 0.55 -> 0.75 (2026-08-03y, owner's call on feel). Measured before:
    // the slow saturates at 9 stacks and psy's median PEAK is 30-44 on EVERY
    // allocation, so a permanent -45% on enemy tempo arrived free and regardless
    // of build. Multiplied against psy's own rate that put it at 3.8 turns to
    // the enemy's 1 at wave 20 — at which point three of every four presses
    // answer nothing, and the read-and-answer loop has no enemy turn to read.
    dreadSlowFloor: 0.75,    // ...but never below this share of its rate: the slow saturates, the count does not
    // PSY'S DAMAGE PIPE IS INSTINCT, and it is the one strain whose potency
    // does not read Attack Damage. Every ramp in the game priced its per-unit
    // value as a share of attack damage, which meant all four strains scaled
    // damage through Strength underneath and the flavour was cosmetic. Fear's
    // bite is perception, so the guard it opens widens with Instinct: each
    // stack's vulnerability grows by dreadVulnPerIns for every point above the
    // starting sheet.
    dreadVulnPerStack: 0.04, // each stack: +4% damage the enemy takes — terror opens the guard, uncapped
    dreadVulnPerIns: 0.03,   // ...and that 4% grows by this share per Instinct above the anchor
    dreadLossPerHit: 1,      // an enemy that lands a hit on psy steadies: sheds this many stacks
    // PSY'S FAUCET IS DEVOUR. HP carries across fights, so a class without a
    // faucet does not lose fights, it loses RUNS to arithmetic. Whenever DREAD
    // is consumed — by Kill, or left on an enemy as it dies — each stack heals
    // this share of the anchor. Stacks SHED when the enemy steadies feed
    // nothing: fear lost is not fear eaten.
    dreadFeedFrac: 0.03,     // heal per DREAD consumed, as a share of the heal anchor
    // THE SIPHON is the drip half, and it ticks on YOUR turns rather than the
    // enemy's, so it scales with the turn advantage the stacks already bought.
    // Bio's mark ticks damage out of the enemy; psy's ticks health into you.
    dreadSiphonFrac: 0.005,  // heal per DREAD on the enemy, per player turn
    // ---- RESOLVE (Unaugmented) ----------------------------------------------
    // UNCAPPED, AND A STATUS RATHER THAN A WALLET, so it is a ramp: the longer
    // the fight runs the harder you are to move and the bigger Last Stand gets.
    // PER FIGHT, NOT PER RUN — carried across a run it would pass the reduction
    // cap in zone 1 and sit there. The reduction is linear per stack and its SUM
    // with Brace is capped in applyEnemyDamage: uncapped number, bounded effect.
    //
    // THE BUILD RATE IS THE LEVER, NOT THE PAYOUT. Swept on base: resolveDR x0
    // to x5 moved the spread build 10w -> 15w, while resolvePerHit 1 -> 8 moved
    // it 12w -> 23w. Speed does not benefit — more of your turns is fewer of
    // theirs, and theirs are the food.
    // What the scientist leaves you with when he pulls you out of the first
    // boss. Not a full bar: being saved has to cost something, and the boss's
    // XP is already gone with it.
    rescueHpFrac: 0.5,
    resolveDR: 0.03,       // Unaugmented: each held Resolve = 3% flat damage reduction
    resolvePerHit: 3,      // Unaugmented: Resolve gained whenever you take a hit
    reloadHpFloor: 0.15    // deliberate mercy: continuing a run never puts you below this
  },
  enemy: {
    // THIS TABLE IS A LATE LEVER, NOT A FIRST ONE: proportional sustain cancels
    // proportional damage at any multiplier, so raising these only reorders who
    // drowns first. The heal anchor moved more than any enemy number ever has.
    //
    // A TIER BOUNDARY HAS TO BE A STEP — keep withinStep x 4 well BELOW
    // tierGrowth - 1, or the drift across a tier's five waves cancels the jump.
    //
    // HP AND DAMAGE ARE DIFFERENT JOBS: HP when a fight should have ROOM, damage
    // and rate when it should have TEETH.
    // hpBase 160 -> 240 (2026-08-03ab, owner's call): *"i need bigger bars to
    // sink that scaling dmg into."* A flat multiplier on every pool at every
    // wave — hpExp rides the growth factor, not the base — so wave 1 trash
    // goes from 7 basic attacks to 10 and wave 60 scales with it.
    hpBase: 240, tierGrowth: 1.85, withinStep: 0.06,
    // ---- HOW LONG A FIGHT IS, AS OPPOSED TO HOW DANGEROUS ------------------
    // hpExp is dmgExp's twin and the two are deliberately DIFFERENT: pools
    // grow sublinearly in the growth factor while the threat grows linearly,
    // so late fights get SHORTER without getting SAFER.
    //
    // Measured 2026-08-03i: at hpExp 1.00 a wave-30 boss took ~106 basic
    // attacks, which is long enough that no damage build can shorten a fight
    // enough for offence to become defence — kill speed stopped converting
    // into survival, which is why Strength could not compete at any damage
    // number (see the STRENGTH note in CLAUDE.md). Shrinking pools was the
    // one lever that moved it: STR+VIT base 20% -> 92%.
    //
    // AN EXPONENT, NOT A SMALLER hpBase, because the problem is late and not
    // early: g is 1.00 at wave 1, so this leaves the opening fights exactly as
    // they were (6-7 hits) and takes ~25% off wave 10 and ~50% off wave 30,
    // where the tedium actually lives. A flat cut would have made zone 1 trash
    // die in two hits.
    hpExp: 0.75,
    // dmgExp 1.00: damage tracks the growth factor exactly. Below 1 it grows
    // SUBLINEARLY while player HP grows linearly in allocated points.
    dmgBase: 8, dmgExp: 1.00,
    // apsBase MATCHES THE PLAYER'S STARTING RATE, so wave 1 is one turn each and
    // rate multipliers read directly as turns-per-player-turn.
    apsBase: 1.00,
    // RATE COUNTS FROM THE RUN'S START, NOT THE ZONE'S — the one place the
    // zone-local rule is deliberately broken. Everything else about an enemy
    // restarts per zone, but tempo is the one axis the player never resets, so
    // it is the one the enemy cannot afford to either. 1.00 -> 1.35 across 30
    // waves — the range this rate was originally fitted for; the 45-wave run
    // overshot it to 1.56, and the restructure walks that back for free.
    apsPerTier: 0.070,
    apsCap: 2.15,
    crit: 0.10, critMult: 1.5,
    // bossHp came DOWN from 5.27 to soften the FIRST boss; bossDmg and bossAps
    // are the old brute chassis, folded in when archetypes were removed.
    // bossXp 3.0 -> 5.0 with the 30-wave restructure: a zone has ONE boss now
    // where it had three, so the one kill carries the weight the three shared.
    // bossAps 0.72 -> 1.00 on 2026-08-03x: a boss traded so much rate for pool
    // that it was the SAFEST fight in its zone — 227 DPS at wave 30 against
    // 235-387 for the trash beside it, so the exam was the breather. It acts as
    // often as its trash now and hits 26% harder for it.
    // bossHp 4.5 -> 3.6 came with that, and went back UP to 5.0 on 2026-08-03ab
    // (owner's call, same ask as hpBase): a boss pool is 5.1x the trash standing
    // beside it, measured at waves 30 and 60. It was already 3.7x, so this is
    // the difference between tanky and a wall worth building into.
    bossHp: 5.0, bossDmg: 1.82, bossAps: 1.00, bossXp: 5.0,
    // THE FIRST BOSS IS MEANT TO KILL YOU. It is the one fight in the run with
    // a scripted answer to losing — the scientist pulls you out — so it hits
    // above an ordinary boss at its wave. Was 2 when the first boss stood at
    // wave 5 on a near-starting sheet; at wave 10 the same bump compounds on
    // ten waves of growth, so 1.5 aims for the same "usually kills you, but
    // answerable" — derived, not measured. Applied at wave bossEvery alone.
    firstBossMult: 1.5,
    trashDmgMult: 1.45,                // trash hits harder so fights cost real HP (bosses use bossDmg)
    // THE TELEGRAPH MULTIPLIER IS FLAT ACROSS ALL THREE BOSSES, so the SHARE of
    // your bar it takes is what moves — and enemy damage grows faster than the
    // pool does, so that share climbs all run. IF IT SHOULD BITE HARDER, ADD
    // POOL RATHER THAN MULTIPLIER: raising this hits wave 5 hardest, where the
    // pool is smallest.
    windupEvery: 3, windupMult: 4.0,   // boss telegraph: every Nth action winds up; next strike hits xN
    finalWindupEvery: 2,               // the final boss keeps you under constant telegraph pressure
    eliteWindupEvery: 3,               // elites telegraph too: the mid-run skill check
    // ELITES TELEGRAPH SMALLER THAN BOSSES, and the reason is frequency, not
    // fairness: three bosses in a run against a dozen elites. An elite
    // telegraph is a skill check; a boss telegraph is the fight.
    eliteWindupMult: 3.0,
    // THE SHRUG IS NO LONGER FREE. Bosses alternate stagger resistance so a stun
    // or a Provoke cannot lock them out of their telegraph forever — but a
    // resisted answer SPOILS the charge (the boss keeps this share of it)
    // rather than doing nothing, so no class has a button that is dead on every
    // second telegraph.
    windupSpoilFrac: 0.5,
    eliteBaseChance: 0.16, eliteChancePerWave: 0.006, eliteChanceCap: 0.40
  },
  // TWO XP REGIMES: firstCost sits just under the wave-1 kill's 61 XP so the
  // first kill still levels you, then the curve restarts fat and quadratic from
  // level 2. One formula could not price both ends of a 10x cliff.
  //
  // Measured median level per wave ON THE 45-WAVE BUILD (pre-2026-08-03d,
  // pre-items): L2 at 5, L4 at 10, L6 at 15, L8 at 20, L11 at 30, L15 at 45.
  // The 30-wave restructure keeps this table as-is — fewer kills but a 5.0
  // boss XP and champion XP partly refill the pool. Not re-measured.
  //
  // OPEN THREAD (measured on the 45-wave build): across the back half the
  // enemy grew 5.1x to the player's 2.35x — the reason telegraphs shrink per
  // zone. The restructure's growth refit AIMS at closing this; unverified.
  xp: { firstCost: 58, base: 485, pow: 2, powScale: 35,
        killBase: 46, killWave: 15, killTier: 36 },
  combo: { maxEnemyActionsPerKill: 3, xpPerStack: 0.05, maxStack: 20 },   // chain continues if the kill let the enemy act <= N times (speed-fair)
  bossEvery: 10,         // boss on every Nth wave — ONE per zone, its finale
  // Beating this wave's boss wins the run. Zones 1-3 are the run proper (30
  // waves); zone 4 is the ENDGAME and carries the last 30 on its own terms —
  // see the note on it in ZONES.
  finalWave: 60,
  spawnDelay: 0.16,
  // ONE DIAL FOR THE WHOLE GAME'S TEMPO: every pause between turns is a raw ms
  // figure multiplied by this. Purely how it is watched — cooldowns tick on
  // turns, not on a clock, so no number in a fight moves with it.
  turnPace: 0.75,
  // saveKey is a PREFIX, not a key: each slot stores under `<saveKey>_s<n>`.
  //
  // BUMP IT WHENEVER A CHANGE INVALIDATES A SAVED SHEET, and add the outgoing
  // prefix to oldSaveKeys so it gets purged. A save stores raw stats and
  // recomputes everything derived on load, so a rules change does not corrupt
  // an old run — it silently RE-READS it under economics it was never
  // allocated for.
  //
  // ONCE PER SHIPPED CHANGE, NOT ONCE PER EDIT: what it answers is whether a
  // sheet saved by a build people PLAYED can still be read. Old saves are
  // DROPPED, never migrated. (Full bump history is in git.)
  //
  // v11 -> v12 is the three-zone run — 30 waves across two acts became 45 across
  // three zones, every enemy carries a `zone` stamp where it carried `act`, and
  // the wave a save stores describes a different place in a different structure.
  // v12 -> v13 is the 30-wave restructure: zones of 10, one boss per zone. A
  // saved wave 37 has nowhere to exist, and a saved wave 14 is a different
  // place — the same argument that forced v12.
  saveKey: 'risen_run_v13',
  // Storage keys from older versions, cleared once on load so they cannot
  // accumulate invisibly. Oldest first. Slot keys are listed explicitly because
  // the purge removes literal keys — on a bump, list _s0 through _s<saveSlots>.
  oldSaveKeys: ['risen_run_v3', 'risen_run_v3_s1', 'risen_run_v3_s2',
                'risen_run_v4', 'risen_run_v4_s1', 'risen_run_v4_s2',
                'risen_run_v5', 'risen_run_v5_s1', 'risen_run_v5_s2',
                'risen_run_v6', 'risen_run_v6_s1', 'risen_run_v6_s2',
                'risen_run_v7', 'risen_run_v7_s1', 'risen_run_v7_s2',
                'risen_run_v8', 'risen_run_v8_s1', 'risen_run_v8_s2',
                'risen_run_v9', 'risen_run_v9_s0', 'risen_run_v9_s1', 'risen_run_v9_s2',
                'risen_run_v10', 'risen_run_v10_s0', 'risen_run_v10_s1', 'risen_run_v10_s2',
                'risen_run_v11', 'risen_run_v11_s0', 'risen_run_v11_s1', 'risen_run_v11_s2',
                'risen_run_v12', 'risen_run_v12_s0', 'risen_run_v12_s1', 'risen_run_v12_s2',
                'risen_run_v12_s3', 'risen_run_v12_s4'],
  saveSlots: 4
};

// What a hyd card prints for the lines it packs in: the skill's own figure
// (mods add to it) at the sheet's rate. Reads through pressureRate in js/stats.js.
function pressureGain(p, def) {
  return Math.max(1, Math.round((def.pressure || 0) * pressureRate(p)));
}

// Each strain: linear damage off Strength scaled by its own `power`, its own
// base attack rate, and one signature mechanic that is NOT a hidden damage
// multiplier.
//
// Editing a skill: every `desc` is an fmtDesc template, never prose with the
// numbers typed in. Put the value in a field and reference it ({power%},
// {poison#poison stack}) so the card cannot contradict the skill when it gets
// retuned. The card fits roughly two to four lines.
const CLASSES = {
  bio: {
    name: 'Biological', color: 'bio',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      // The card prints what the next application will actually plant, off the
      // live sheet — Strength moves it (see poisonPerStr), so a stated "+1"
      // would contradict the hit as soon as a point landed.
      // BIO'S SECOND DAMAGE PIPE (2026-08-03z). Measured before: 89% of a bio
      // run's damage was POISON and its attack button was 6% — the only strain
      // routing almost everything through one number, where psy/sym/base each
      // have two to four that add up. Slash now reads the pile back the way
      // Latch reads THORNS, so stacking and attacking feed each other instead
      // of competing for the same turns, and the fight has a decision in it:
      // stack once more, or start cashing in.
      { id:'slash', name:'Slash', desc:'Deal {power!} damage + {poisonScale%} of what the rot is ticking for. +{poisonStacks} POISON', type:'attack', power:1.0, poison:1, poisonScale:1.0, poisonStacks:(p,s) => poisonStacks(p,s), target:'enemy', basic:true },
      // The carry is a property of the ROT rather than of any one button, but
      // it is named on this card because Infest is where the pile comes from —
      // the player has to know that stacking before a kill is worth something.
      { id:'infest', name:'Infest', desc:'Deal {power!} damage. +{poisonStacks} POISON. When they die, {carry%} of the rot moves to whatever comes next.', type:'attack', power:0.50, poison:4, poisonStacks:(p,s) => poisonStacks(p,s), carry:BALANCE.player.poisonCarryFrac, target:'enemy', cdTurns:3 },
      // CHITIN IS ON THE SAME CLOCK AS EVERY OTHER TELEGRAPH ANSWER (5 -> 4,
      // 2026-08-03k). Traumatize, Provoke and Counterpunch are all 4; bio's
      // was the only answer on a 5, and it is also the only one doing TWO jobs
      // — the mitigation and the class's damage doubler — so bio paid the
      // longest wait for a card it has to spend two ways.
      { id:'chitin', name:'Chitin', desc:'For {duration#turn}: take −{power%} damage. POISON on the enemy ticks twice per turn', type:'buff', buff:'chitin', duration:3, power:0.40, target:'self', cdTurns:4 },
      // MIASMA IS BIO'S ONLY FAUCET. At 10% x 4 turns on a 5-turn cooldown it
      // handed back 40% of a bar and still lost to attrition past the first
      // boss; 13% is the same shape, paying 52% of a bar per cast.
      // BIO'S SUSTAIN IS THE CLASS, not a bandage bolted on: rot on them, mend
      // on you, both on a clock. Was 13% x 4 turns and it still lost to
      // attrition — 20% x 5 pays roughly a bar per cast on a 5-turn cooldown,
      // which is near-continuous uptime by design. The tick also scrubs 1 POISON,
      // making bio the best answer to venom in the game.
      { id:'miasma', name:'Miasma', desc:'For {duration#turn}: regenerate {power+} and shed {tickCleanse} POISON each turn. The enemy is WEAK for {weak.duration#turn}', type:'buff', buff:'regen', duration:5, power:0.20, tickCleanse:1, applies:[{ id:'weak', power:0.25, duration:3 }], target:'self', cdTurns:5 }
    ]
  },
  // THE TERROR EXTRACTION. Psy's mechanic is DREAD, a mark stacked ON THE ENEMY —
  // see the DREAD block in BALANCE. Four verbs in order: Hunt (land a hit, plant
  // fear), Terrify (a burst of stacks), Traumatize (at 3+ the mind breaks:
  // stun), Kill (cash stacks in as damage — and with the fear spent the enemy
  // speeds back up, so the finisher is a decision, not a rotation button).
  //
  // THE CLASS'S STAT IS SPEED: more turns is more fear is more slow is more
  // turns. Squishy by choice — every point of Vit is a point the engine didn't
  // get. Sustain is DEVOUR, never a bandage, and the failure state bites: an
  // enemy that steadies itself sheds fear without feeding you.
  psy: {
    name: 'Psychological', color: 'psy',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      // HUNT PLANTS FEAR BY LANDING, full stop — like bio's Slash and base's
      // Strike, a basic in this game is the mechanic's trickle, every turn, for
      // free. It used to plant only on crits and dodges: a CLASS mechanic parked
      // on a button that had no part in it.
      { id:'hunt', name:'Hunt', desc:'Deal {power!} damage. +{dreadStacks} DREAD', type:'attack', power:1.0, dread:1, dreadStacks:(p,s) => dreadStacks(p,s), target:'enemy', basic:true },
      // Plants 4, one MORE than Traumatize needs, so the advertised combo
      // survives one steadying hit.
      { id:'terrify', name:'Terrify', desc:'Deal {power!} damage and plant +{dreadStacks} DREAD. Every stack slows the enemy and opens its guard.', type:'attack', power:0.50, dread:4, dreadStacks:(p,s) => dreadStacks(p,s), target:'enemy', cdTurns:3 },
      { id:'traumatize', name:'Traumatize', desc:'Deal {power!} damage. Against {dreadNeed}+ DREAD the mind breaks: stunned for {stun#turn}.', type:'attack', power:0.95, stun:1, dreadNeed:3, target:'enemy', cdTurns:4 },
      // KILL TAKES HALF THE FEAR, NOT ALL OF IT. Every stack is doing three
      // things while it sits there — slowing their turn, opening their guard,
      // dripping the siphon into you — so spending the whole pile for one hit
      // lost at every count, and a decision that resolves the same way every
      // time is a dead card. Half, rounded up so a lone stack is still edible.
      //
      // THE CARD SHOWS THE WHOLE BLOW via killTotal, reading the same fields the
      // damage pipeline reads so the number cannot drift from the hit. It
      // deliberately does NOT model vulnerability, crits or WEAK — the blow lands
      // HARDER than stated, which is the right direction to be wrong in.
      { id:'kill', name:'Kill', desc:'Deal {killTotal} damage. Tears away HALF the enemy’s DREAD — +{perDreadPower!} damage and {feedPerDread+} healed for each. Sheds {cleanse} POISON.', type:'attack', power:2.00, perDreadPower:0.60, consumesDread:true, consumeFrac:0.5, feedPerDread:BALANCE.player.dreadFeedFrac, cleanse:2, target:'enemy', cdTurns:5,
        killTotal: (p, s) => {
          const e = state.enemy;
          const held = (e && e.hp > 0 && !e._defeated) ? statusStacks(e, 'dread') : 0;
          const spent = Math.ceil(held * (s.consumeFrac || 1));
          return formatNum(Math.max(1, Math.floor(p.atkPower * ((s.power || 1) + (s.perDreadPower || 0) * spent))));
        } }
    ]
  },
  // THE ORGANISM. Sym's mechanic is THORNS — one number, worn on the player,
  // that grows every time it is hit and keeps growing for the whole run. See the
  // THORNS block in BALANCE.
  //
  // THE OTHER THREE ANSWER A HIT; SYM WANTS ONE. Provoke is that verb, the only
  // button that spends your turn to buy the ENEMY a turn, and it doubles as
  // sym's telegraph answer — deliberately a different one from psy's: a stun
  // DELETES the heavy swing, Provoke goads it out early so it lands as an
  // ordinary one. Raise Spines + Provoke is the combo, and it asks a question no
  // other combo asks: you have to be healthy enough to eat what you invited.
  //
  // 2026-08-03f: PROVOKE LASHES BACK — the invited swing is answered with the
  // full wall (THORNS × lashMult), so the ramp has an on-demand payoff on the
  // player's own initiative without spending a single spine. And SHED's torn
  // spines regrow at the next spawn: blunter for the rest of THIS fight, never
  // poorer for the run.
  //
  // SPEED IS THE INTERESTING STAT: more of your turns means proportionally FEWER
  // enemy swings, and swings are food. The only stat in the game with a real cost
  // attached, landed on the strain whose allocation had nothing to say.
  hyd: {
    name: 'Hydraulic', color: 'hyd',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      // {gain}, not {pressure}: the rate reads Instinct, so the card has to
      // print what the blow actually packs in rather than the starting figure.
      { id:'piston', name:'Piston', desc:'Deal {power!} damage. +{gain} PRESSURE', type:'attack', power:1.25, pressure:BALANCE.player.pressurePerHit, gain:pressureGain, target:'enemy', basic:true },
      // The feeder AND the setup: pressure to spend later, and the next blow
      // lands as a crit whatever the dice say. Cooldown 3, the ramp feeder's
      // clock (see the cooldown grammar in CLAUDE.md).
      // The feeder, and it ATTACKS. Measured 2026-08-03ae: with this as a pure
      // buff, hyd spent 58% of its turns not dealing damage — survivable for
      // bio, whose rot ticks anyway, and fatal for a strain whose whole output
      // is attacks. It died at wave 4.
      { id:'surge', name:'Surge', desc:'Deal {power!} damage. +{gain} PRESSURE', type:'attack', power:1.7, pressure:10, gain:pressureGain, target:'enemy', cdTurns:3 },
      // The telegraph answer. It softens incoming rather than baiting or
      // stunning, which is the shape the bot reads off the card by itself.
      // HYD'S ONLY FAUCET as well as its telegraph answer, and it has to be
      // both: with no sustain at all it died at wave 6 on every allocation
      // tested — the only class in the game with nothing that heals. The
      // mitigation stays on `buff` so the bot still reads it as an answer off
      // the card; the regen rides `applies`, which routes a buff to the caster.
      { id:'dampen', name:'Dampen', desc:'For {duration#turn}: take \u2212{power%} damage and regenerate {regen.power+} each turn.', type:'buff', buff:'dampen', duration:3, power:0.45, applies:[{ id:'regen', power:0.25, duration:3 }], target:'self', cdTurns:4 },
      // The payoff. Spends the WHOLE pile in one blow, which also gives back
      // the bracing it was buying — that is the decision the class is built on.
      // ALWAYS CRITS, which is where the class's fantasy actually lives: the one
      // blow that cashes the pile is never left to the dice, and it multiplies
      // by a crit number PRESSURE has been inflating all fight.
      { id:'rupture', name:'Rupture', desc:'Vent everything: {power!} damage +{perPressurePower!} per PRESSURE spent. Always CRITS.', type:'attack', power:1.4, alwaysCrit:true, consumesPressure:true, perPressurePower:0.16, target:'enemy', cdTurns:5 }
    ]
  },

  sym: {
    name: 'Symbiotic', color: 'sym',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      // 0.35 -> 0.55: with THORNS as the ramp, the basic is where the number
      // gets read back on your OWN turns, carrying the share Bloom used to.
      { id:'latch', name:'Latch', desc:'Deal {power!} damage + {thornsScale%} of your THORNS.', type:'attack', power:1.0, thornsScale:0.55, target:'enemy', basic:true },
      { id:'spines', name:'Raise Spines', desc:'THORNS ×{power} and pain reflect doubled for {duration#turn}. Every hit taken grows +{growBonus} extra THORNS.', type:'buff', buff:'spines', duration:3, power:2, growBonus:BALANCE.player.thornsSpinesGrow, target:'self', cdTurns:4 },
      // 3 -> 4 (2026-08-03k): sym healed every third turn where bio heals every
      // fifth and base every fourth — the most frequent sustain in the game,
      // on the strain that measured strongest, and its cost regrows now too.
      { id:'shed', name:'Shed', desc:'Heal {healFrac+}, then tear off THORNS to heal {hpPerThorn+} more each — they regrow by the next fight. Takes only as many as the wound needs, up to {capFrac%} of what you have grown. Sheds {cleanse} POISON.', type:'heal', healFrac:0.08, shedFuel:true, cleanse:2, hpPerThorn:BALANCE.player.shedHpPerThorn, capFrac:BALANCE.player.shedCapFrac, target:'self', cdTurns:4 },
      { id:'provoke', name:'Provoke', desc:'Bare your guard: the enemy strikes at once and cannot miss — then every spine answers: ×{lashMult} THORNS as damage. +{growBonus} THORNS, and a charged telegraph comes out now, ordinary or half-strength.', type:'provoke', growBonus:3, lashMult:1.5, target:'enemy', cdTurns:4 }
    ]
  },
  // Base Sonny, reached via RUN CLEAN. The suit as issued, no extraction in the
  // lining, so he has no strain mechanic — and is THE ONLY STRAIN WITH TWO NUMBERS instead.
  // RESOLVE on himself, BLEED on them: not two mechanics but two halves of one
  // exchange, since Resolve is bought by landing hits AND taking them, and the
  // cut is only as deep as the Resolve behind it. Endure, then everything at
  // once — except the enduring is doing damage the whole time.
  base: {
    name: 'Unaugmented', color: 'base',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      // The card prints what the next Strike will actually open, and it moves as
      // Resolve stacks up (a desc field may be a function — see fmtDesc). "As
      // deep as the Resolve behind it" names a relationship when the player
      // wants a NUMBER.
      { id:'jab', name:'Strike', desc:'Deal {power!} damage. +{buildsResolve} RESOLVE, and open a wound: +{bleedStacks} BLEED. Every turn, BLEED deals {bleedTick} a stack and loses one.', type:'attack', power:1.0, buildsResolve:1, bleed:1, bleedStacks:p => bleedStacks(p), bleedTick:p => bleedDepth(p), target:'enemy', basic:true },
      { id:'bandage', name:'Bandage', desc:'Heal {healFrac+} and +{resolveHealBonus%} per held RESOLVE. Sheds {cleanse} POISON', type:'heal', healFrac:0.14, resolveHealBonus:0.02, cleanse:2, target:'self', cdTurns:4 },
      // BRACE LASTS TWO TURNS, NOT ONE. Measured: holding it and casting it on
      // the exact pre-heavy turn took base's first-boss clear from 20% to 100%
      // with nothing rebalanced, so the ANSWER was never insufficient — the
      // WINDOW was. At one turn it was a coin flip whether it was even
      // available, and 60% of base's deaths were a heavy landing. Two turns
      // forgives a turn of misjudgement: strict, not broken.
      // `holdFor` tells the bot the same thing the card tells the player.
      { id:'counter', name:'Counterpunch', desc:'Brace for {duration#turn}: −{power%} damage taken, stacking with RESOLVE. A hit taken while braced counters {counterPower!} damage and opens a wound: +{bleedStacks} BLEED', type:'buff', buff:'brace', duration:2, power:0.60, counterPower:1.20, counterBleed:1, bleedStacks:p => bleedStacks(p), holdFor:'windup', target:'self', cdTurns:4 },
      { id:'laststand', name:'Last Stand', desc:'Deal {power!} damage, +{perResolvePower!} per RESOLVE spent. Spends {consumeFrac%} of your RESOLVE', type:'attack', power:1.20, perResolvePower:0.40, consumesResolve:true, consumeFrac:0.7, target:'enemy', cdTurns:5 }
    ]
  }
};

// Enemies get their own bodies, not a mirror of a maxed player. Because
// enemy.apsBase matches the player's starting rate, `aps` READS DIRECTLY AS
// TURNS PER PLAYER TURN: a grunt acts once for each of your turns, a brute 0.72
// times.
//
// ARCHETYPES ARE GONE — no hidden chassis cycling stats under one name and one
// sprite. A thing that fights differently must LOOK different and be NAMED
// differently, so new types arrive as name + sprite + behavior together.

// ---- Enemy verbs ------------------------------------------------
// THE QUESTION A NAMED FIGHT ASKS (2026-08-03g). Bosses carry ONE authored
// verb each (ZONES.bossVerb); champions ROLL one — fixed face, rolled
// question, same promise as their rolled affix. Trash never carries one:
// trash is the rhythm section, the exams are where questions live.
//
// THE FILTER FOR A NEW VERB: it must change which button the player presses.
// If it never changes a press, it is a stat in a costume — delete it.
// Every verb must announce itself through the intent badge (enemyIntent
// mirrors enemyAct) — verbs multiply the read-and-answer skill, never
// bypass it. Numbers here are derived, not measured; owner tunes by play.
const ENEMY_VERBS = {
  // Braces while winding up: the free turn a telegraph hands you costs double
  // to spend on damage. Rides the windup cadence; the fortify expires exactly
  // as the heavy lands.
  guard:  { id:'guard',  tag:'GUARD',  power:0.5,
            blurb:'braces while winding up: takes −50% until the heavy lands' },
  // Below half it knits itself back every turn: a throughput check — burst
  // the second half of the bar or grind forever.
  regrow: { id:'regrow', tag:'REGROW', below:0.5, power:0.06,
            blurb:'below half HP, knits 6% of its frame each of its turns' },
  // Every 2nd action is two strikes: more total damage, and twice the on-hit
  // economy — a feast for sym, a bleed on psy's steadying rule.
  flurry: { id:'flurry', tag:'FLURRY', every:2, hits:2, scale:0.65,
            blurb:'every 2nd action strikes twice at 65%' },
  // The race clock: swings harden permanently, uncapped, every 3rd of its
  // turns. The anti-turtle — deliberately unbounded, doom is the point.
  enrage: { id:'enrage', tag:'ENRAGE', every:3, perStack:0.12,
            blurb:'every 3rd of its turns, swings harden +12% forever' }
};
const CHAMPION_VERBS = ['guard', 'regrow', 'flurry', 'enrage'];

// Opt-in risk: elites hit harder but pay far more XP.
const ELITES = {
  // ARMORED went with armor itself — its only effect was armorAdd, so without
  // it the affix was a tag and an XP multiplier attached to nothing.
  frenzied: { id:'frenzied', tag:'FRENZIED', xp:1.7, apsMult:1.60 },
  vampiric: { id:'vampiric', tag:'VAMPIRIC', xp:1.7, lifesteal:0.30 },
  // COLOSSAL went the same way: x2.2 HP at x0.8 rate changed nothing the player
  // DID with the extra turns. The affix was removed, not the idea — "big" wants
  // moves to go with it.
  venomous: { id:'venomous', tag:'VENOMOUS', xp:1.7, poison:true },
  volatile: { id:'volatile', tag:'VOLATILE', xp:1.8, deathNova:0.14 }
};

// ZONE STRUCTURE. A zone is the unit that actually shapes the run: three of
// TEN waves — nine fights and ONE boss each, with a named CHAMPION on every
// zone's wave 5 — and then a fourth of THIRTY, the endgame, which keeps none
// of that shape (see its own note below). 60 waves in all. Each zone owns its
// label, its enemy roster (names here, art in sprites.js keyed by zone number),
// its difficulty floor, its telegraph, and how its bosses are decided.
//
//   growthMult   the zone's DIFFICULTY FLOOR — enemy hp/dmg growth restarts from
//                here, so within a zone the tier curve retraces at a higher
//                altitude instead of compounding forever. Rank and rate are
//                zone-local for the same reason: a roster debuts at Rank I.
//   tierGrowth / withinStep   per-zone steepness. Each zone climbs more gently
//                than the last, because the player's own growth flattens as
//                points arrive at a fixed rate onto an ever bigger base. What a
//                zone must NOT do is flatten faster than the player does.
//   windupMult / eliteWindupMult   the zone's telegraph. Per-zone because a flat
//                multiplier on a number that outruns your bar is a one-shot
//                eventually — see the note on zone 2.
//   bossVerb     the question this zone's boss asks, from ENEMY_VERBS. One
//                authored verb per boss; champions roll theirs.
//   champion     the zone's named elite: { at, id, name }. `at` is an absolute
//                wave — the one number to move if a zone's shape changes.
//   randomRoster / bossSegment / extraBossChance / rollBossVerb /
//   eliteBaseChance / eliteChanceCap   the endgame's overrides. Absent on
//                zones 1-3, which take the table's defaults.
const ZONES = [
  // ZONES 1-3, restructured 2026-08-03d: nine fights and one boss each, with
  // wave 5 a guaranteed named CHAMPION (elite chassis, affix still rolled).
  // One boss per zone instead of the same face three times — the champion is
  // the midterm, the boss the final, an exam every fifth wave.
  //
  // GROWTH WAS DERIVED, NOT MEASURED (owner's call — tune by play): each
  // zone's end is the old 45-wave wall scaled by the smaller sheet a 30-wave
  // player brings (~0.8x), floors chain at a +5% seam, and each zone climbs
  // more gently than the last because points land on an ever-bigger base.
  // Zone ends: ~3.2 / ~8.3 / ~16.1. Nothing has played these numbers yet.
  //
  // THE TELEGRAPH MULTIPLIERS CARRY OVER from the 45-wave fit (4.0 / 2.5 /
  // 1.6) — a flat multiplier crosses the bar eventually, so each zone prices
  // its own. Re-judge by play.
  { num: 1, name: 'The Laboratory', label: 'THE LABORATORY',
    startWave: 1, endWave: 10,
    // enemies: the zone's trash ROSTER — an id (the key its art is filed under
    // in sprites.js) and the name that appears on the card.
    enemies: [{ id: 'experiment', name: 'Escaped Experiment' }],
    bossName: 'Prime Symbiote',
    bossVerb: 'regrow',      // the one that won't stay down
    champion: { at: 5, id: 'experiment', name: 'Apex Specimen' },
    growthMult: 1, tierGrowth: 2.4, withinStep: 0.08 },

  { num: 2, name: 'The Laboratory: Asset Recovery', label: 'THE LABORATORY: ASSET RECOVERY',
    startWave: 11, endWave: 20,
    enemies: [{ id: 'enforcer', name: 'MCP Enforcer' }],
    bossName: 'MCP Captain',
    bossVerb: 'guard',       // shield discipline: answers cost more here
    champion: { at: 15, id: 'lieutenant', name: 'MCP Lieutenant' },
    growthMult: 3.33, tierGrowth: 2.6, withinStep: 0.06,
    windupMult: 2.5, eliteWindupMult: 2.0 },

  { num: 3, name: 'City Streets', label: 'CITY STREETS',
    startWave: 21, endWave: 30,
    enemies: [{ id: 'mercenary', name: 'Mercenary' }],
    bossName: 'Mercenary Brute',
    // ENRAGE on the finale compounds with its every-2 windup cadence: the
    // hand-checked two-mechanic exam, authored rather than rolled.
    bossVerb: 'enrage',
    champion: { at: 25, id: 'mercenary', name: 'Veteran Mercenary' },
    growthMult: 11.3, tierGrowth: 2.1, withinStep: 0.04,
    windupMult: 1.6, eliteWindupMult: 1.2 },

  // ---- THE ENDGAME (2026-08-03n, owner's design) --------------------------
  // Thirty waves at Pest Control's own gate, and the zone breaks three of the
  // rules the first three keep — deliberately, because it is the part of the
  // run meant to end most of them.
  //
  //   RANDOM ROSTER     four faces drawn per spawn instead of rotated. It costs
  //                     the property the rotation was chosen for (reload a save
  //                     and a different soldier is standing there) — cosmetic,
  //                     and worth it for a zone whose identity is not knowing
  //                     what walks in.
  //   ROLLED BOSSES     one is GUARANTEED to close every 10-wave stretch
  //                     (40 / 50 / 60), and every other wave can roll one at
  //                     extraBossChance — a floor with no ceiling. They all
  //                     wear one face and ROLL their verb rather than carrying
  //                     an authored one: six-plus bosses cannot each be a
  //                     hand-written exam.
  //   ELITES EVERYWHERE the base chance more than doubles, and so does the cap.
  //
  // SCALING IS DERIVED, NOT MEASURED, and tierGrowth is the dial: 1.22 across
  // six tiers puts wave 60 near 53x growth against zone 3's 16x, so an ordinary
  // boss blow lands near a full bar. The telegraph multiplier is the lowest in
  // the game for exactly that reason — at this damage a big one is a one-shot.
  { num: 4, name: 'Mutant Pest Control', label: 'MUTANT PEST CONTROL',
    startWave: 31, endWave: 60,
    enemies: [{ id: 'trooper',  name: 'MCP Trooper' },
              { id: 'medic',    name: 'MCP Field Medic' },
              { id: 'demo',     name: 'MCP Demolition Unit' },
              { id: 'sentinel', name: 'MCP Sentinel' }],
    bossName: 'MCP Reclaimer',
    randomRoster: true,
    rollBossVerb: true,
    bossSegment: 10, extraBossChance: 0.12,
    eliteBaseChance: 0.35, eliteChanceCap: 0.65,
    growthMult: 28.9, tierGrowth: 1.22, withinStep: 0.04,
    // ---- THE WALL (2026-08-03r) -------------------------------------------
    // HARDER, NOT LONGER, and that is the only shape of difficulty worth
    // adding here. Measured before: a zone-4 boss took 116-134 basic attacks
    // at every depth, so the endgame was a GRIND that also happened to be
    // dangerous. These three move the danger and shorten the grind:
    //   dmgMult  every enemy in the zone swings harder
    //   apsMult  and acts more often, which is where attrition actually comes
    //            from — 87-96% of deaths all session have been ordinary hits
    //   hpExp    while pools grow slower than the rest of the game's 0.75, so
    //            the wall is SHARP rather than long
    // Re-fitted 2026-08-03s, after the defensive rework roughly TRIPLED
    // effective HP (three stacking layers where there had been two capped
    // coin flips). At the old 1.18/1.25 every strain cleared 88-100% of
    // runs; these put the best build back near a quarter.
    dmgMult: 1.13, dmgMultEnd: 1.32,
    apsMult: 1.00, apsMultEnd: 1.45, hpExp: 0.70,
    windupMult: 1.35, eliteWindupMult: 1.15 }
];
function zoneForWave(wave) {
  return ZONES.find(a => wave >= a.startWave && wave <= a.endWave) || ZONES[ZONES.length - 1];
}

// ---- Statuses ------------------------------------------------
// ---- Statuses ------------------------------------------------
// One registry for every timed effect that can sit on a unit, player or enemy.
// A status is a DEFINITION here plus an instance object { type, duration,
// stacks, power, ... } on the unit. Stacking, ticking, expiry, the badge and the
// damage hooks all run off the definition, so a new buff or debuff is one entry
// and nothing else — and it works on either side of the fight, because nothing
// here knows whether the unit carrying it is the player.
//
// DEFINITION FIELDS (only id/name/tone are required)
//   id, name       id matches the key; name is the default badge text
//   tone           CSS class on the badge (.status.<tone>). 'buff' and
//                  'debuff' always exist, so a new entry needs no CSS.
//   kind           'buff' | 'debuff', from the perspective of the unit
//                  carrying it. Read when a skill's buff picks its target, and
//                  as the badge's fallback tone.
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
//                                  No status implements it today; kept as the
//                                  seam for the next one that wants it.
const STATUSES = {

  // --- Strain mechanics ---------------------------------------------------
  poison: {
    id:'poison', name:'POISON', tone:'poison', kind:'debuff',
    // Permanent: once applied, rot does not wash out. Nothing about bio works
    // if its damage can be waited out.
    stacking:'stack', permanent:true, defaults:{ stacks:1, perStack:1 },
    // A MARK TICKS ON THE TURN OF WHOEVER PUT IT THERE — see the `inflicted`
    // note in tickStatuses. Ticking on the turn of whoever CARRIED it metered
    // bio's whole output by how often the ENEMY acted, so buying Speed made the
    // rot tick less: the stat was worse than dead, it was negative.
    inflicted: true,
    // No timer on the badge — there is nothing left to count down.
    label: st => 'POISON ×' + (st.stacks||1),
    // Only the rot BIO plants weakens its host. A venomous elite's poison on
    // the player is the same status, and giving it this hook would quietly
    // hand every strain a damage debuff nobody built for.
    outgoingMult: (u, st) => (u && u.isPlayer) ? 1
      : 1 - Math.min(P().poisonWeakenCap, (st.stacks || 0) * P().poisonWeakenPerStack),
    onTurnStart(unit, st) {
      // CHITIN on the opponent quickens the rot: two full ticks, two floaters,
      // two log lines, so what was paid is exactly what shows.
      const foe = unit.isPlayer ? null : state.player;
      const ticks = (foe && foe.hp > 0 && hasStatus(foe, 'chitin')) ? 2 : 1;
      for (let i = 0; i < ticks; i++) {
        if (unit.hp <= 0) break;
        const dmg = Math.max(1, Math.floor((st.perStack||1) * (st.stacks||1)));
        unit.hp = Math.max(0, unit.hp - dmg);
        // An ailment tick is damage the PLAYER dealt, and it counts as such.
        // Guarded on the target, because an elite's venom ticking on YOU is
        // not yours.
        if (!unit.isPlayer) creditDamage('Poison', dmg);
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

  // Bio: harden to outlast — the sustain half and the rot half of the class in
  // one decision. Its own entry so poison can ask "is the player hardened" by
  // name and the badge reads CHITIN.
  chitin: {
    id:'chitin', name:'CHITIN', tone:'buff', kind:'buff',
    stacking:'longest', defaults:{ duration:3, power:0.40 },
    label: st => 'CHITIN ' + Math.ceil(st.duration) + 't',
    incomingMult: (u, st) => 1 - (st.power || 0)
  },

  // UNAUGMENTED'S WOUND. Poison's twin in shape and its opposite in source: the
  // rot is alien and free, a cut is ordinary and paid for. Deliberately plainer
  // than poison — no double-tick interaction, and it does not persist between
  // fights.
  //
  // THE TIMER IS THE POINT, not an oversight. Each new stack refreshes the whole
  // wound, so bleeding an enemy out means never stopping.
  bleed: {
    id:'bleed', name:'BLEED', tone:'bleed', kind:'debuff',
    // No maxStacks, exactly like poison: the twin shares the shape.
    stacking:'stack', defaults:{ stacks:1, perStack:1 },
    // TICKS ON EVERY TURN, AND EATS ITSELF DOING IT: one tick a turn from each
    // side, and a stack gone each time, so a wound bleeds twice as fast as the
    // rot and is gone twice as fast too. More BLEED is more damage, and that is
    // the entire rule.
    bothClocks: true,
    inflicted: true,
    // The wound is as deep as the LAST cut, not the deepest one ever made —
    // which is what gives spending Resolve a price. See applyStatus.
    perStackRule:'newest',
    label: st => 'BLEED ×' + (st.stacks||1),
    onTurnStart(unit, st) {
      // Hits for what it HAS, then loses one. A pile of 8 pays 8, then 7, then
      // 6 — so stacking hard is the play rather than topping up.
      const dmg = Math.max(1, Math.floor((st.perStack||1) * (st.stacks||1)));
      unit.hp = Math.max(0, unit.hp - dmg);
      if (!unit.isPlayer) creditDamage('Bleed', dmg);   // see the note on poison's tick
      floatText(unit, dmg, 'damage');
      logDamage('BLEED', unit, dmg, [
        '×' + (st.stacks||1) + ' @ ' + logNum(st.perStack||1) + '/stack',
        logNum(unit.hp) + '/' + logNum(unit.maxHp) + ' left'
      ]);
      st.stacks = (st.stacks||1) - 1;
      if (st.stacks <= 0) {
        unit.statuses = unit.statuses.filter(x => x !== st);
        logStatus(unit, st, true);
      }
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
    // them makes each hit worth MORE.
    onHitTaken(unit, st, ctx) {
      if (unit.class !== 'sym' || !(ctx.damage > 0)) return;
      growThorns(unit, P().thornsSpinesGrow, 'SPINES, hit taken');
    }
  },

  // Unaugmented's mechanic, and a STATUS rather than a wallet since the banks came
  // out. See the RESOLVE block in BALANCE.
  //
  // PERMANENT inside a fight — nothing times it out, only Last Stand spends it —
  // and deliberately missing `persists`, so the between-fight sweep drops it and
  // every fight is rebuilt from nothing.
  //
  // The reduction is NOT an incomingMult here, for the same reason Brace's
  // isn't: applyEnemyDamage sums the two and caps the sum once.
  pressure: {
    id:'pressure', name:'PRESSURE', tone:'pressure', kind:'buff',
    stacking:'stack', permanent:true, defaults:{ stacks:1 },
    label: st => 'PRESSURE \u00d7' + (st.stacks||1),
    // The bracing half. The crit half rides applyDerivedStats, because crit
    // damage is a SHEET number the sidebar has to be able to show.
    incomingMult: (u, st) => (u && u.isPlayer)
      ? 1 - Math.min(P().pressureWardCap || 0, (st.stacks || 0) * (P().pressureWardPerPoint || 0))
      : 1
  },

  dampen: {
    id:'dampen', name:'DAMPEN', tone:'pressure', kind:'buff',
    stacking:'replace', defaults:{ duration:2, power:0.45 },
    label: st => 'DAMPEN ' + Math.ceil(st.duration) + 't',
    incomingMult: (u, st) => 1 - (st.power || 0)
  },

  resolve: {
    id:'resolve', name:'RESOLVE', tone:'resolve', kind:'buff',
    stacking:'stack', permanent:true, defaults:{ stacks:1 },
    label: st => 'RESOLVE ×' + (st.stacks||1)
  },

  brace: {
    id:'brace', name:'BRACE', tone:'brace', kind:'buff',
    stacking:'replace', defaults:{ duration:1, power:0.60, counter:1.20 },
    label: st => 'BRACE ' + Math.ceil(st.duration) + 't',
    // Deliberately NOT an incomingMult: Unaugmented adds Brace to held Resolve
    // and caps the sum (applyEnemyDamage), so the two are one reduction rather
    // than two multiplied ones. Splitting it into a generic hook would quietly
    // halve the skill.
    onHitTaken(unit, st, ctx) {
      const e = ctx.attacker;
      if (!e || unit.hp <= 0 || e.hp <= 0) return;
      const cdmg = Math.max(1, Math.floor(unit.atkPower * (st.counter||1.2)));
      const before = e.hp;
      e.hp = Math.max(0, e.hp - cdmg);
      creditDamage('Counterpunch', cdmg);
      if (e.hp <= 0) state._lastOverkill = Math.max(0, cdmg - before);
      floatText(e, cdmg, 'damage');
      // The counter draws blood, so bracing is part of the offence — which is
      // the whole reason a class built on absorbing hits can afford to spend a
      // turn not attacking.
      if (st.counterBleed && unit.class === 'base' && e.hp > 0)
        applyStatus(e, 'bleed', { stacks: bleedStacks(unit), perStack: bleedDepth(unit) });
      logDamage('COUNTER', e, cdmg, [
        'BRACE ×' + (st.counter||1.2).toFixed(2) + ' Attack Damage',
        logNum(e.hp) + '/' + logNum(e.maxHp) + ' left'
      ]);
      playAttackAnim(unit, e, true, 'counter');
    }
  },

  // Psy's mark, worn on the enemy's card the way poison is. Permanent for the
  // same reason — fear does not wash out on a timer; only the enemy's own landed
  // hits steady it (see shedStacks) and Kill consumes it. Dies with the enemy,
  // so psy's ramp is fast and per-fight where bio's is slow and permanent.
  //
  // The slow rides the generic apsMult hook, so effectiveAps and the turn-rate
  // readout pick it up with no special case.
  dread: {
    id:'dread', name:'DREAD', tone:'dread', kind:'debuff',
    stacking:'stack', permanent:true, defaults:{ stacks:1 },
    label: st => 'DREAD ×' + (st.stacks||1),
    // The slow saturates where the count does not: past the floor a stack buys
    // no further hesitation, only an opened guard. Unbounded, it would walk the
    // enemy toward never acting at all.
    apsMult: (u, st) => Math.max(P().dreadSlowFloor, 1 - (st.stacks||0) * P().dreadSlowPerStack),
    // Terror opens the guard: the enemy takes more from EVERY source while
    // marked, including the Kill that consumes the stacks (consumption happens
    // after the damage resolves). This half is psy's offense; the slow is its
    // skin.
    // Widened by the hunter's Instinct — see dreadVulnPerIns. Read off the
    // live player rather than snapshotted, so a point taken mid-fight is felt
    // on the next blow.
    incomingMult(u, st) {
      const p = state.player;
      const ins = (p && p.class === 'psy')
        ? Math.max(0, (p.instinct + gearStat(p, 'instinct')) - BALANCE.player.sheetAnchor) : 0;
      const per = P().dreadVulnPerStack * (1 + ins * (P().dreadVulnPerIns || 0));
      return 1 + (st.stacks || 0) * per;
    }
  },

  // --- Enemy verbs (see ENEMY_VERBS) ---------------------------------------
  // REGROW: the zone-1 boss's verb, worn from spawn so the fight's question is
  // visible before the first swing. Heals off its OWN max HP — healAnchorFor
  // falls through to maxHp for non-players.
  regrow: {
    id:'regrow', name:'REGROW', tone:'buff', kind:'buff',
    stacking:'replace', permanent:true, defaults:{ below:0.5, power:0.06 },
    label: () => 'REGROW',
    onTurnStart(unit, st) {
      if (unit.hp <= 0 || unit.hp >= unit.maxHp * (st.below || 0.5)) return false;
      const heal = Math.max(1, Math.floor(unit.maxHp * (st.power || 0)));
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + heal);
      floatText(unit, unit.hp - before, 'heal');
      logHeal('REGROW', unit, unit.hp - before, [
        Math.round((st.power || 0) * 100) + '% of frame, below ' + Math.round((st.below || 0) * 100) + '%',
        logNum(unit.hp) + '/' + logNum(unit.maxHp)
      ]);
      updateUnitCard(unit);
      return false;
    }
  },
  // ENRAGE: the race clock. Uncapped on purpose — this is the one place an
  // unbounded effect is the design: the anti-turtle, and doom if you stall.
  enrage: {
    id:'enrage', name:'ENRAGE', tone:'debuff', kind:'buff',
    stacking:'stack', permanent:true, defaults:{ stacks:1, power:0.12 },
    label: st => 'ENRAGE ×' + (st.stacks || 1),
    outgoingMult: (u, st) => 1 + (st.stacks || 0) * (st.power || 0)
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
    stacking:'longest', defaults:{ duration:3, power:0.05, cleanse:0 },
    label: st => 'REGEN ' + Math.ceil(st.duration) + 't',
    onTurnStart(unit, st) {
      if (unit.hp <= 0) return false;
      // THE MEND SCRUBS THE ROT, a tick at a time. Bio is the only strain whose
      // sustain is a duration rather than a press, so it is the only one whose
      // cleanse arrives spread out — which is what makes it the best answer to
      // venom in the game rather than merely an answer.
      cleansePoison(unit, st.cleanse || 0, 'REGEN');
      if (unit.hp >= unit.maxHp) return false;
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

