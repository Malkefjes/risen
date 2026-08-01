// Balance, build stamp, classes, statuses — the numbers and tables
// ============================================================
// RISEN — balance & systems
//
// Facts about the game and pointers into the code. Not a rulebook: see
// "The comments are not law" in CLAUDE.md before treating anything here as a
// constraint. Measurements are dated because they go stale.
//
//  * THE STARTING SHEET IS THE ANCHOR: every strain begins 5/5/5/5 with 25
//    Attack Damage, 100 HP, 1.00 turn rate, 10% evade/crit/block. One point is
//    5 damage or 20 HP. Enemies are fitted to this rather than designed
//    alongside it, so a fight that feels wrong has one place to look.
//
//  * ONE TURN EACH AT WAVE 1. A baseline enemy acts at exactly the player's
//    starting rate, so 1.00x is even and anything above it was bought.
//
//    NON-OBVIOUS, AND EASY TO GET WRONG: cooldowns tick on YOUR turns, not on a
//    clock, so turn advantage never speeds up your rotation. It only decides how
//    much the enemy does inside it — which makes turn rate a mitigation stat in
//    an offensive costume. It also means more of your turns is more healing per
//    enemy swing, since heal cooldowns tick on the same clock.
//
//  * DERIVED VALUES HANG OFF THE ANCHORS instead of carrying their own curves:
//    ailment damage is a fifth of Attack Damage, innate thorns a twentieth of
//    max HP. Retuning an anchor carries them along.
//
//  * PLAYER AND ENEMY STATS ARE COMPUTED BY SEPARATE FUNCTIONS, and must stay
//    that way. Enemies once ran through the player's derived-stat formulas and
//    by wave 30 sat at capped evade/block/crit, eating two thirds of your damage.
//
//  * HEALING IS A SHARE OF THE HEAL ANCHOR, NOT OF MAX HP. One read:
//    healAnchorFor() in stats.js. Damage-proportional healing (lifesteal,
//    thorns-feed) is a separate mechanic and is not routed through it.
//
//  * WHAT SCALES HOW, measured on build 2026-08-01c:
//      basic attack damage   linear in Strength, every strain
//      turn rate             Speed, saturating (see apsGain)
//      Instinct              quadratic — crit chance and crit damage off the
//                            same points; bounded by the chance cap and the
//                            point budget, which land together
//      base's BLEED          quadratic in Strength — depth rides Attack Damage,
//                            stack count rides Strength. Owner-decided.
//
//  * Strains differ only by their skills. Damage, HP, turn rate and every
//    percentage are identical across all four. A strain that should be fast
//    wants a MULTIPLIER on the rate, never an additive base — a base hands out
//    speed nobody paid for.
//
//  * SWITCHED OFF, NOT MISSING, so it does not read as a bug: critStrainGain is
//    0 for every strain (a crit feeding your strain is built and wired but
//    inert). Cooldown reduction is not a seam any more — p.cdr is 0 and nothing
//    can set it, so the readout row stays hidden.
// ============================================================

// ---- Build ----------------------------------------------------
// A date: the only question it answers is which of two files is newer. Suffix
// a letter for a second build the same day. Shown under the logo, first line of
// every combat log, and stored in the save.
//
// KEEP SEPARATE FROM BALANCE.saveKey — that answers "are saved runs still
// valid". Deriving one from the other would wipe every save on a typo fix.
const BUILD = '2026-08-01bx';

const BALANCE = {
  player: {
    // Every stat is (5 + points) / 5 times its starting value: 20% a point,
    // no flat bases anywhere. A base hands out value nobody paid for.
    apsPerSpeed: 0.20,
    // Turn rate is the one stat on a curve rather than a line. The anchor is
    // exactly x1.00 at 5 Speed; points above it buy a shrinking share of
    // apsGain, which is the asymptote and THE DIAL. apsHalfPoints is where you
    // have bought half of what the curve will ever give, and holds the opening
    // slope when apsGain moves. Full investment lands near x2.5.
    //
    // It replaced a hard x4.00 cap reached at 20 Speed — 15 points of a run's
    // 33. A ceiling you hit at the halfway mark is a target, not a ceiling:
    // Speed+Vitality won 20 runs of 20 while an even spread won none.
    sheetAnchor: 5,          // the starting sheet, in every stat
    apsGain: 2.00, apsHalfPoints: 10,
    apsCap: 6.00,            // backstop AFTER apsMult; the curve tops near x3 alone
    // 5 Strength is 25 Attack Damage, 5 Vitality is 100 HP. No flat base and no
    // per-level HP: max HP must stay exactly Vitality x 20.
    damagePerStr: 5,
    hpPerVit: 20,
    // Three is the smallest grant where allocation still has shape — commit all
    // three or lean 2-1; one point would collapse it to "whose turn is it".
    pointsPerLevel: 3,
    // Set so a starting sheet reads 10 / 10 / 10 at 5 in every stat. Evade and
    // block look odd alone (0.075, 0.065) because each is "10% minus what the
    // starting 5 points already contribute".
    evadeBase: 0.075, evadePerSpeed: 0.005, evadeCap: 0.40,
    blockBase: 0.065, blockPerVit: 0.007, blockCap: 0.35, blockReduction: 0.5,
    // ---- INSTINCT ---------------------------------------------------------
    // Buys crit CHANCE and crit DAMAGE from the same points, so it is quadratic
    // in its own points. It has to be: crit chance against a FIXED multiplier is
    // bounded — at x2 and a 70% cap the whole stat could only ever add x1.70,
    // about three and a half Strength points — and a bounded stat cannot chase
    // an unbounded linear one at any rate.
    //
    // Both rates are picked so the two stats LAND TOGETHER at full investment.
    // The trap when re-deriving this: A STRENGTH BUILD CRITS TOO — it keeps the
    // starting 5 Instinct and swings at x1.125 expected before spending
    // anything. Both columns are therefore GAIN OVER THE SAME STARTING SHEET.
    //
    //     Instinct   crit%   crit dmg   its gain    all-Strength, same points
    //        5        10%      x2.25      x1.00           x1.00
    //       15        30%      x4.75      x1.89           x3.00
    //       25        50%      x7.25      x3.67           x5.00
    //       35        70%      x9.75      x6.33           x7.00
    //       40        80%     x11.00      x8.00           x8.00   <- dead level
    //       45        90%     x12.25      x9.89           x9.00
    //
    // A square and a line cross ONCE, so one stat is behind on one side of it.
    // The crossing sits near the end deliberately: half-investing really is
    // worse than not. What it costs is variance — one hit in ten landing for a
    // twelfth of the others can lose a boss, and that is the trade being sold.
    critBase: 0.00, critPerInstinct: 0.02, critCap: 0.90,
    // Capped at 0.90, not 1.00: the gold CRIT floater is the loudest thing on
    // screen, and if every hit wore it the colour would stop naming an event.
    // One plain hit in ten keeps the gold meaning something. Points past the cap
    // still buy crit damage, so nothing is wasted.
    critMultBase: 1.0, critMultPerInstinct: 0.25,   // crit damage = x(1 + 0.25 x Instinct)
    // A heal you PRESS can crit, on the same chance as a blow. Juice, and priced
    // as juice: its own flat multiplier, never critMult. Measured before
    // building — heals through the full damage crit formula (an 8x average
    // multiplier on sustain) bought an all-Instinct build +0 to +3 waves and
    // left it last in every strain, so this is not an Instinct fix.
    //
    // Ticks do not crit, actions do — the same rule poison and bleed already
    // follow. REGEN, SIPHON and HARVEST stay steady; Bandage, Shed and DEVOUR
    // spike.
    critHealMult: 2.0,
    // SWITCHED OFF, NOT MISSING: a crit banking a charge of whatever the strain
    // runs on. creditCrit and its call site in applyPlayerDamage are still
    // wired — set this to 1 to switch it on for a strain that wants it.
    critStrainGain: 0,
    // Speed deliberately does not feed it. Cooldowns tick on the player's own
    // turns, so rate never changes your rotation — a 4-turn cooldown is 4 of
    // your turns at x1 and at x4. Stacking CDR on Speed would pay twice.
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
    // POISON (bio) is permanent and UNCAPPED — the stack count is bio's ramp,
    // and the ramp is the class: no burst, the enemy's remaining life is a clock.
    // ---- BLEED (Unmutated) ------------------------------------------------
    // Base's second number, and he is the only strain with two: he refused the
    // infection, so his mechanic is the ordinary consequence of a long fight —
    // you get harder to move, they get cut.
    //
    // IT MUST NOT BECOME BIO IN RED, which is the one thing to hold onto here.
    // Three differences keep them apart:
    //   POISON IS A RATE; BLEED IS A PILE THAT BURNS DOWN. The rot ticks once a
    //   turn forever and never loses a stack. A wound ticks on EVERY turn, both
    //   sides, and eats a stack doing it — gone unless you keep cutting.
    //   A PILE IS WORTH MORE THAN ITS PARTS. A tick hits for what the pile HAS,
    //   so 8 stacks pay 8+7+6+... — double the stacks is four times the damage.
    //   Poison rewards time; bleed rewards SIZE.
    //   POISON IS FREE; BLEED IS BOUGHT WITH PUNISHMENT. Depth rides the RESOLVE
    //   behind the cut, snapshotted newest-wins, so spending Resolve on Last
    //   Stand makes the wounds you open afterwards shallower.
    //
    // APPLICATION HAS TO CLEAR TWO A TURN-CYCLE or the pile drains faster than
    // it is fed — measured, at 1 stack a cut bleed fell from 29% of base's
    // damage to 9%. Every number here is chosen against that floor.
    //
    // Measured, base, 40 runs a cell (bleed's share of damage / wave reached):
    //   flat 3      45% / 41%     15w / 12w
    //   2 + STR/5   46% / 52%     15w / 14w   <- shipped
    //   flat 5      64% / 62%     22w / 15w
    //   3 + STR/3   67% / 70%     25w / 15w
    // The last two are the dial, not rejects: both make bleed most of the class
    // and push base past the other three strains.
    bleedBase: 2,
    bleedPerStr: 5,                          // one extra stack per this much Strength
    bleedPerResolve: 0.10,                   // each held RESOLVE deepens a NEW cut by this share of the ailment base
    // ---- THORNS (sym) -----------------------------------------------------
    // ONE NUMBER THAT GROWS, and it is RUN-PERMANENT — the only mechanic in the
    // game that is. Forced by measurement: a trash fight gives ~5 enemy swings
    // and a boss ~10-13 (~52 a run), so a per-fight ramp could only ever reach 5
    // before being wiped. Swings-per-player-turn also FALLS as a run goes (0.44
    // early, 0.17 late), so a per-fight ramp would weaken exactly as the game got
    // harder. Banked across the run, early fights pay for late ones.
    //
    // PAID OUT THREE WAYS, which is what makes one number enough: the enemy takes
    // it when they swing, Latch reads a share of it back on your turns, and Shed
    // converts it to healing.
    thornsFrac: 0.05,          // INNATE thorns: a twentieth of max HP, and the floor Shed can never eat into
    thornsPerHit: 1,           // every hit taken grows thorns by this, no window and no condition
    thornsBigHitFrac: 0.15,    // ...plus one more per this share of max HP taken in a single blow
    thornsGrowMax: 4,          // ceiling on what ONE hit can grow, so a x5 telegraph is a feast, not a jackpot
    thornsSpinesGrow: 2,       // extra growth per hit while Spines is up
    // SHED: THE CEILING IS NOT THE PRICE. A percentage cost against a runaway
    // number grows without bound while its payout does not (healing is bounded
    // by max HP), so the button would stop being worth pressing exactly when you
    // had played best. Shed takes only as many thorns as the heal NEEDED, and
    // the fraction below caps that — growing huge makes it cheap in proportion.
    shedCapFrac: 0.35,         // Shed never takes more than this share of GROWN thorns in one press
    shedHpPerThorn: 0.04,      // one thorn shed is worth this share of the heal anchor
    reflectFrac: 0.20, reflectSpinesMult: 2,   // sym: share of damage taken reflected back; doubled while Spines is up
    levelUpHealFrac: 0.15, recoverHpFrac: 0.08,
    // ---- THE HEAL ANCHOR --------------------------------------------------
    // EVERY HEAL FRACTION IN THE GAME IS A SHARE OF THE ANCHOR, NOT OF MAX HP.
    //
    // Measured all-in per stat, 40 runs each: healing was 68-91% of ALL the
    // punishment every build absorbed. The bar was the rounding error and the
    // refill was the real health pool — and since every heal was a share of max
    // HP, Vitality bought the bar AND the multiplier on the refill. Per wave
    // reached, Vitality out-damaged Strength in all four strains.
    //
    // The anchor is the bar you would have at 5 Vitality, grown by LEVEL — a
    // schedule nobody buys. At the starting sheet anchor and bar are both 100,
    // so a 14% Bandage is still 14 on wave 1.
    //
    // healAnchorPerLevel IS THE DIAL: 0 freezes healing at 100 forever (every
    // heal button dies by zone 2); high values hand the old economy back to
    // everyone. At 0.30, L11 is ~400 — between an even spread's ~250 bar and an
    // all-Vitality ~700. hpMult still rides it, so anything that scales HP widens what
    // closes a wound on the body it widened.
    healAnchorPerLevel: 0.30,
    // ---- DREAD (psy) ------------------------------------------------------
    // Psy's mechanic LIVES ON THE ENEMY — the one bank that is a mark, not a
    // wallet. Fear dies with the enemy, so psy ramps fresh and fast every fight
    // where bio ramps slow and permanent: bio's mark eats the enemy's HEALTH,
    // psy's eats their TURNS.
    //
    // EACH STACK DOES TWO THINGS, and it needs both: the enemy hesitates (−rate)
    // and its guard opens (+damage taken). Slow alone is mitigation in an
    // offensive costume — the first pass shipped slow only and psy's best builds
    // died on wave 3 doing 25s into a 900 HP boss. Fear has to make the kill
    // faster, not just later.
    //
    // THE COUNT IS UNCAPPED; THE TWO HALVES ARE BOUNDED DIFFERENTLY. An unbounded
    // slow walks an enemy toward never acting, which is a stun nobody paid for —
    // so the floor below bounds the slow and leaves the count free. Vulnerability
    // has no ceiling: it is psy's damage, it costs stacks a landed hit sheds, and
    // it cannot follow you into the next fight.
    dreadSlowPerStack: 0.05, // each stack: −5% enemy turn rate
    dreadSlowFloor: 0.55,    // ...but never below this share of its rate: the slow saturates, the count does not
    dreadVulnPerStack: 0.04, // each stack: +4% damage the enemy takes — terror opens the guard, uncapped
    dreadLossPerHit: 1,      // an enemy that lands a hit on psy steadies: sheds this many stacks
    // PSY'S FAUCET IS DEVOUR. HP carries across fights in this game, so a class
    // without one doesn't lose fights, it loses RUNS to arithmetic — every kit
    // needs a faucet (owner's rule, learned by psy bleeding out across waves on
    // the two 8% trickles alone). Whenever DREAD is consumed — by Kill, or left
    // on an enemy as it dies — each stack heals this share of the anchor. One
    // rule, two exits: eat the fear early as burst AND food, or let it ride and
    // drink it whole off the corpse.
    //
    // Stacks SHED when the enemy steadies feed nothing: fear lost is not fear
    // eaten. Getting hit costs psy the meal along with the control.
    dreadFeedFrac: 0.03,     // heal per DREAD consumed, as a share of the heal anchor
    // THE SIPHON is the drip half — it ticks on YOUR turns, not the enemy's, so
    // it scales with the turn advantage the stacks already bought instead of
    // being starved by it. Completes the mirror with poison: bio's mark ticks
    // damage out of the enemy, psy's ticks health into you.
    dreadSiphonFrac: 0.005,  // heal per DREAD on the enemy, per player turn
    // ---- RESOLVE (Unmutated) ----------------------------------------------
    // UNCAPPED, AND A STATUS RATHER THAN A WALLET. As a 6-pip bank it was the
    // one mechanic you finished thinking about — six turns in you were full and
    // "hold or spend" collapsed into "spend". Off the leash it is a ramp: the
    // longer the fight runs the harder you are to move and the bigger Last Stand
    // gets.
    //
    // PER FIGHT, NOT PER RUN. It accrues every single turn, so carried across a
    // run it would pass the reduction cap in zone 1 and sit there — an off switch,
    // not a break. The reduction is linear per stack and its SUM with Brace is
    // capped hard in applyEnemyDamage: uncapped number, bounded effect.
    //
    // THE BUILD RATE IS THE LEVER, NOT THE PAYOUT — swept, base only, 40 runs a
    // cell. What a stack PAYS barely matters (resolveDR x0 to x5 moved the spread
    // build 10w -> 15w). How fast the pile BUILDS is where the class lives
    // (resolvePerHit 1 -> 8 moved it 12w -> 23w, still climbing off the end).
    // The curve, if this wants moving: +2 13w, +3 14w, +4 15w, +6 20w, +8 23w.
    //
    // A landed hit still gives exactly +1 through Strike's buildsResolve, so at
    // +3 taking the blow is worth three times dealing one — the class's sentence
    // stated in a number.
    //
    // THE CAP IS NOT THE CONSTRAINT, checked before the rate moved: sampled at
    // every enemy hit, RESOLVE sits at a median of 4 stacks (12% reduction) at
    // +3, with 0% of hits landing against a capped guard. Even +8 pins only 10%.
    //
    // Speed does not benefit, and that falls out of the mechanic: more of your
    // turns is fewer of theirs, and theirs are the food. All-Speed base sat at
    // 12-15w across the whole sweep. Enduring and evading pull against each
    // other, so this lever cannot feed the build that is already strongest.
    resolveDR: 0.03,       // Unmutated: each held Resolve = 3% flat damage reduction
    resolvePerHit: 3,      // Unmutated: Resolve gained whenever you take a hit
    reloadHpFloor: 0.15    // deliberate mercy: continuing a run never puts you below this
  },
  enemy: {
    // THIS TABLE IS A LATE LEVER, NOT A FIRST ONE, and the reason outlived every
    // number that taught it: PROPORTIONAL SUSTAIN CANCELS PROPORTIONAL DAMAGE AT
    // ANY MULTIPLIER. Raising these only reorders who drowns first. Two obvious
    // raises were tried and reverted (double elite chance; trashDmgMult 1.45 ->
    // 1.75) and neither moved a win rate. The heal anchor, which took sustain off
    // max HP entirely, moved more than any enemy number ever has.
    //
    // A TIER BOUNDARY HAS TO BE A STEP. Keep withinStep x 4 well BELOW
    // tierGrowth - 1, or the drift across a tier's five waves cancels the jump
    // and rank II walks in carrying exactly what rank I walked out with. Today
    // the drift is +6% a wave and wave 4 to wave 6 is +57%.
    //
    // HP AND DAMAGE ARE DIFFERENT JOBS: reach for HP when a fight should have
    // ROOM, and for damage and rate when it should have TEETH. +60% enemy HP on
    // its own once left three strains winning 30/30.
    hpBase: 160, tierGrowth: 1.85, withinStep: 0.06,
    // dmgExp 1.00: damage tracks the growth factor exactly. It was 0.88, which
    // grew SUBLINEARLY while player HP grows linearly in allocated points, so
    // every wave the enemy fell further behind the pool it was hitting.
    dmgBase: 8, dmgExp: 1.00,
    // apsBase MATCHES THE PLAYER'S STARTING RATE, so wave 1 is one turn each and
    // rate multipliers read directly as turns-per-player-turn. It was 0.70, which
    // handed every new character a free +43% action economy — and since cooldowns
    // tick on your own turns, that was really free damage mitigation.
    apsBase: 1.00,
    // RATE COUNTS FROM THE RUN'S START, NOT THE ACT'S — the one place the
    // act-local rule is deliberately broken. Everything else about an enemy
    // restarts per zone so a later zone can field its own roster at its own floor, but
    // rate restarting meant the Encampment's opening enforcers acted SLOWER than
    // the Laboratory's closing experiments, at the boundary the game sells as a
    // step up. Tempo is the one axis the player never resets, so it is the one
    // the enemy cannot afford to either.
    // 1.00 -> 1.56 across a 45-wave run. This was fitted when a run was 30
    // waves and topped out at 1.35, so the last zone meets a tempo nobody chose
    // — it arrived with the run getting longer. Flagged, not changed.
    apsPerTier: 0.070,
    apsCap: 2.15,
    crit: 0.10, critMult: 1.5,
    // bossHp came DOWN from 5.27 to soften the FIRST boss; bossDmg and bossAps
    // are still the old brute chassis, folded in when archetypes were removed.
    bossHp: 4.5, bossDmg: 1.82, bossAps: 0.72, bossXp: 3.0,
    trashDmgMult: 1.45,                // trash hits harder so fights cost real HP (bosses use bossDmg)
    // THE TELEGRAPH MULTIPLIER IS FLAT ACROSS ALL THREE BOSSES, so the SHARE of
    // your bar it takes is what actually moves — and enemy damage grows faster
    // than the pool does, so that share climbs all run. Measured at 5.0, against
    // the median bar the smart bot arrives with:
    //
    //                     telegraph    spread build      all-Vitality
    //     wave  5 boss         90       160   56%         160   56%
    //     wave 10 boss        165       160  103%         280   59%
    //     wave 15 boss        310       220  141%         400   78%
    //
    // From wave 10 on it was a clean one-shot on anything but an all-Vitality
    // sheet. At 4.0 the invested bar pays 45% / 47% / 62%. The spread build still
    // loses its last-boss bar to one blow, and that stays — buying no Vitality is
    // a decision, and a decision has to be allowed to be wrong. What is fixed is
    // the case no decision answers: investing in survival and dying anyway.
    //
    // IF IT SHOULD BITE HARDER, ADD POOL RATHER THAN MULTIPLIER — raising this
    // hits wave 5 hardest, where the pool is smallest, which is the wall it was
    // lowered off in the first place.
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
  // TWO XP REGIMES, because the first level is a HOOK and the rest are EARNED.
  // firstCost sits just under the wave-1 kill's 61 XP so the first kill still
  // levels you, then the curve restarts fat and quadratic from level 2. One
  // formula could not price both: the gap between "one kill" and "the first
  // boss" is a 10x cliff no smooth curve crosses without wrecking one end.
  // Pacing lives in the cost curve only — income knobs are untouched, so the XP
  // readout on a kill still means what it meant.
  //
  // MEASURED, median level at the moment each boss wave begins, all four
  // strains. The balance notes that say "~18-20 points" describe a run that
  // ENDS around wave 15 — they were written when that was a good run:
  //
  //     wave  5    L2    3 points on top of 5/5/5/5
  //     wave 10    L4    9
  //     wave 15    L6   15        end of zone 1
  //     wave 20    L8   21
  //     wave 25   L10   27
  //     wave 30   L11   30        end of zone 2
  //     wave 35   L12   33
  //     wave 40   L14   39
  //     wave 45   L15   42        the win
  //
  // Waves past 30 were measured with survivability inflated so a bot could
  // reach them at all — that reads the XP CURVE, not the difficulty, which is
  // the only honest way to sample a stretch nothing survives yet.
  //
  // THE MISMATCH THIS EXPOSES, reported and not acted on: across waves 15 to 45
  // the enemy grows 5.1x while the player grows 2.35x. The enemy table is
  // fitted against a sheet holding ~15 points and meets one holding 21-42 for
  // two thirds of the run. That is why the telegraph multiplier has to shrink
  // every zone (4.0 / 2.5 / 1.6) just to stay survivable. The levers are all
  // still where they were: this cost curve, the kill income beside it, or a
  // zone's own growth.
  xp: { firstCost: 58, base: 485, pow: 2, powScale: 35,
        killBase: 46, killWave: 15, killTier: 36 },
  combo: { maxEnemyActionsPerKill: 3, xpPerStack: 0.05, maxStack: 20 },   // chain continues if the kill let the enemy act <= N times (speed-fair)
  bossEvery: 5,          // boss on every Nth wave
  finalWave: 45,         // beating this wave's boss wins the run (zone 3's finale)
  spawnDelay: 0.16,
  // ONE DIAL FOR THE WHOLE GAME'S TEMPO. Every pause between turns is a raw ms
  // figure multiplied by this: 1 is the pace the game has always run at, 0.5 is
  // twice as fast, 1.5 is slower. Purely how it is watched — cooldowns tick on
  // turns, not on a clock, so no number in a fight moves with it.
  turnPace: 0.75,
  // saveKey is a PREFIX, not a key: each slot stores under `<saveKey>_s<n>`.
  //
  // BUMP IT WHENEVER A CHANGE INVALIDATES A SAVED SHEET, and add the outgoing
  // prefix to oldSaveKeys so it gets purged. A save stores raw stats and
  // recomputes everything derived on load, so a rules change does not corrupt an
  // old run — it silently RE-READS it under economics it was never allocated
  // for. The v10 -> v11 case is the clearest example: every heal became a share
  // of the anchor rather than max HP, so a wide v10 sheet would load back
  // healing at a fraction of what its wave count was earned on.
  //
  // ONCE PER SHIPPED CHANGE, NOT ONCE PER EDIT. What it answers is "can a sheet
  // saved by a build people PLAYED still be read" — bumping for a version nobody
  // played purges nothing and costs every player another set of empty slots.
  //
  // Old saves are DROPPED, never migrated. Every player gets empty slots on the
  // next load, which is the honest outcome: those runs are not playable as the
  // game now works. (Full bump history is in git.)
  // v11 -> v12 is the three-zone run. The run went from 30 waves across two
  // acts to 45 across three zones, every enemy now carries a `zone` stamp where
  // it carried `act`, and the wave a save stores describes a different place in
  // a different structure. A v11 run saved at wave 25 was two thirds through
  // its game and would load back as barely half of this one.
  saveKey: 'risen_run_v12',
  // Storage keys from older versions, cleared once on load so they cannot
  // accumulate invisibly. Oldest first; add the outgoing prefix here on a bump.
  // Slot keys are listed explicitly because the purge removes literal keys.
  // On a bump, list _s0 through _s<saveSlots> for the outgoing prefix.
  oldSaveKeys: ['risen_run_v3', 'risen_run_v3_s1', 'risen_run_v3_s2',
                'risen_run_v4', 'risen_run_v4_s1', 'risen_run_v4_s2',
                'risen_run_v5', 'risen_run_v5_s1', 'risen_run_v5_s2',
                'risen_run_v6', 'risen_run_v6_s1', 'risen_run_v6_s2',
                'risen_run_v7', 'risen_run_v7_s1', 'risen_run_v7_s2',
                'risen_run_v8', 'risen_run_v8_s1', 'risen_run_v8_s2',
                'risen_run_v9', 'risen_run_v9_s0', 'risen_run_v9_s1', 'risen_run_v9_s2',
                'risen_run_v10', 'risen_run_v10_s0', 'risen_run_v10_s1', 'risen_run_v10_s2',
                'risen_run_v11', 'risen_run_v11_s0', 'risen_run_v11_s1', 'risen_run_v11_s2'],
  saveSlots: 4
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
  // see the DREAD block in BALANCE. Four verbs in order: Hunt (land a hit,
  // plant fear), Terrify (a burst of stacks), Traumatize (at 3+ the mind breaks:
  // stun), Kill (cash stacks in as damage — and with the fear spent the enemy
  // speeds back up, so the finisher is a decision, not a rotation button).
  // Its sentence: "you were beaten before I ever touched you."
  //
  // THE CLASS'S STAT IS SPEED: more turns is more fear is more slow is more
  // turns. Instinct is a pure damage stat for psy since Hunt started planting on
  // hit — a real loss of identity for the stat, left standing to be judged by
  // play rather than patched over here. Squishy by choice: every point of Vit is
  // a point the engine didn't get.
  //
  // Sustain is DEVOUR, never a bandage. The failure state bites: an enemy that
  // steadies itself sheds fear without feeding you, so getting hit costs control
  // AND dinner.
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
      // KILL TAKES HALF THE FEAR, NOT ALL OF IT. Every stack is doing three
      // things while it sits there — slowing their turn, opening their guard,
      // dripping the siphon into you — so spending the whole pile for one hit
      // lost against a fight's worth of compounding value at every count. A
      // decision that resolves the same way every time is a dead card. Half
      // (rounded up, so a lone stack is still edible) makes it "how deep do I
      // cut into my own advantage".
      //
      // THE CARD SHOWS THE WHOLE BLOW via killTotal, because this is the one
      // skill whose damage depends on what is standing in front of you, and
      // "1.2x plus 0.6x per stack, of half the pile rounded up" is not
      // arithmetic to do mid-fight. It reads the same fields the damage pipeline
      // reads, off its own card, so the number cannot drift from the hit.
      // Deliberately NOT modelling vulnerability, crits or WEAK — the blow lands
      // HARDER than stated against a marked enemy, which is the right direction
      // to be wrong in.
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
  // that grows every time it is hit and keeps growing for the whole run. See the
  // THORNS block in BALANCE. Its sentence: "everything you do to me makes me
  // stronger."
  //
  // THE OTHER THREE ANSWER A HIT; SYM WANTS ONE. It is the only strain PAID for
  // being struck, and Provoke is that verb — the only button that spends your
  // turn to buy the ENEMY a turn. It doubles as sym's telegraph answer, and
  // deliberately a different one from psy's: a stun DELETES the heavy swing,
  // Provoke goads it out early so it lands as an ordinary one.
  //
  // RAISE SPINES + PROVOKE IS THE COMBO, two cards on purpose: raise the spikes,
  // then make them swing into you. It asks a question no other combo asks —
  // you have to be healthy enough to eat what you invited.
  //
  // Sustain is SHED, the one place a run-permanent ramp can be spent: healing
  // costs you growth you cannot get back this fight. No burst finisher, on
  // purpose — Bloom Eruption carried 42% of sym's damage while thorns carried
  // 22%, and cutting it is what forces the thorns half to be the class.
  //
  // SPEED IS THE INTERESTING STAT: more of your turns means proportionally FEWER
  // enemy swings, and swings are food. Speed makes you faster and smaller — the
  // only stat in the game with a real cost attached, landed on the strain whose
  // allocation had nothing to say.
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
  // no strain mechanic.
  //
  // THE ONLY STRAIN WITH TWO NUMBERS, and the refusal is what earns them.
  // RESOLVE on himself, BLEED on them — not two mechanics but two halves of one
  // exchange, because a man with no venom and no fear has nothing to fight with
  // except what an ordinary long fight does to both bodies. Resolve is bought by
  // landing hits and taking them; the cut is only as deep as the Resolve behind
  // it. One number feeds the other, which keeps it from reading as a second
  // currency to manage.
  //
  // Its sentence: endure, then everything at once — except the enduring is
  // doing damage the whole time.
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
      { id:'jab', name:'Strike', desc:'Deal {power!} damage. +{buildsResolve} RESOLVE, and open a wound: +{bleedStacks} BLEED. Every turn, BLEED deals {bleedTick} a stack and loses one.', type:'attack', power:1.0, buildsResolve:1, bleed:1, bleedStacks:p => bleedStacks(p), bleedTick:p => bleedDepth(p), target:'enemy', basic:true },
      { id:'bandage', name:'Bandage', desc:'Heal {healFrac+} and +{resolveHealBonus%} per held RESOLVE', type:'heal', healFrac:0.14, resolveHealBonus:0.02, target:'self', cdTurns:4 },
      // BRACE LASTS TWO TURNS, NOT ONE. Measured: holding it and casting it on
      // the exact pre-heavy turn took base's first-boss clear from 20% to 100%
      // with nothing rebalanced, so the ANSWER was never insufficient — the
      // WINDOW was. At one turn on a 4-turn cooldown against a windup every ~4
      // player turns it was a coin flip whether it was even available, and 60%
      // of base's deaths were a heavy landing. Two turns keeps the read while
      // forgiving a turn of misjudgement: strict, not broken.
      // `holdFor` tells the bot the same thing the card tells the player.
      { id:'counter', name:'Counterpunch', desc:'Brace for {duration#turn}: −{power%} damage taken, stacking with RESOLVE. A hit taken while braced counters {counterPower!} damage and opens a wound: +{bleedStacks} BLEED', type:'buff', buff:'brace', duration:2, power:0.60, counterPower:1.20, counterBleed:1, bleedStacks:p => bleedStacks(p), holdFor:'windup', target:'self', cdTurns:4 },
      { id:'laststand', name:'Last Stand', desc:'Deal {power!} damage, +{perResolvePower!} per RESOLVE consumed. Spends all RESOLVE', type:'attack', power:1.20, perResolvePower:0.40, consumesResolve:true, target:'enemy', cdTurns:5 }
    ]
  }
};

// Enemies get their own bodies, not a mirror of a maxed player. Because
// enemy.apsBase matches the player's starting rate, `aps` READS DIRECTLY AS
// TURNS PER PLAYER TURN: a grunt acts once for each of your turns, a brute 0.72
// times, a skirmisher 1.18.
//
// ARCHETYPES ARE GONE. The game HAS four enemies — two per act — and the code
// agrees: no hidden chassis cycling stats under one name and one sprite. The
// owner's rule for variety: a thing that fights differently must LOOK different
// and be NAMED differently, so new types arrive as name + sprite + behavior
// together, or not at all. (The act-1 roster is currently name + sprite on the
// shared chassis — its own behavior is the open half of that promise.)

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

// ZONE STRUCTURE. The whole run is ACT 1; a zone is the unit that actually
// shapes it. Three zones of 15 waves, three bosses each, 45 waves total. Each
// zone owns its label, its enemy roster (names here, art in sprites.js keyed by
// zone number), its difficulty floor, and its telegraph.
//
//   growthMult   the zone's DIFFICULTY FLOOR — enemy hp/dmg growth restarts
//                from here, so within a zone the tier curve retraces at a
//                higher altitude instead of compounding forever. Without it,
//                extending zone 1's 1.85^tier ride across the whole run puts
//                the last boss somewhere unwinnable rather than hard. Rank and
//                rate are zone-local for the same reason — a roster debuts at
//                Rank I, not Rank IV.
//   tierGrowth / withinStep   per-zone steepness. Each zone climbs more gently
//                than the last, because the player's own growth flattens as the
//                run goes: points arrive at a fixed rate onto an ever bigger
//                base. What a zone must NOT do is flatten faster than the
//                player does — that is what made wave 11 the most dangerous
//                wave in the game back when zone 2 sat at 1.25.
//   windupMult / eliteWindupMult   the zone's telegraph. Per-zone because a
//                flat multiplier on a number that outruns your bar is a
//                one-shot eventually — see the table on zone 2.
const ZONES = [
  { num: 1, name: 'The Laboratory', label: 'THE LABORATORY',
    startWave: 1, endWave: 15,
    // enemies: the zone's trash ROSTER. Each entry is an id (the key its art is
    // filed under in sprites.js) and the name that appears on the card. One
    // face is a perfectly good roster — the Laboratory has exactly one thing
    // loose in it.
    enemies: [{ id: 'experiment', name: 'Escaped Experiment' }],
    bossName: 'Prime Symbiote',
    growthMult: 1 },

  { num: 2, name: 'The Laboratory: Mutant Pest Control', label: 'THE LABORATORY: MUTANT PEST CONTROL',
    startWave: 16, endWave: 30,
    // THREE FACES, ONE STAT LINE. The encampment fields soldiers rather than
    // one repeated silhouette, and they rotate by wave (see makeEnemy). They
    // are deliberately identical in numbers: a wave-N enemy is a wave-N enemy,
    // and if a rifleman should ever fight differently from a combatant that is
    // a decision for the enemy table to make out loud, not something a sprite
    // quietly implies.
    enemies: [{ id: 'enforcer',  name: 'MCP Enforcer'  },
              { id: 'combatant', name: 'MCP Combatant' },
              { id: 'rifleman',  name: 'MCP Rifleman'  }],
    bossName: 'MCP Grenadier',
    growthMult: 4.5, tierGrowth: 1.45, withinStep: 0.04,
    // ---- WHY A TELEGRAPH IS PER-ZONE -------------------------------------
    // A FLAT MULTIPLIER ON A NUMBER THAT OUTRUNS YOUR BAR IS A ONE-SHOT
    // EVENTUALLY, and that is arithmetic rather than tuning: enemy damage grows
    // far faster across a run than the biggest bar anyone can buy. At the
    // shared x4.0 the telegraph crossed the bar in zone 2 and never came back.
    //
    // Measured on a real run (owner's, build 2026-08-01d): base died on wave 25
    // to a 426 telegraph on a 340 bar — 125%, dead from full, no build and no
    // play answering it. Bars for waves 20+ are read off the level schedule,
    // because too few runs reach those waves to sample.
    //
    //   telegraph, and its share of bar (spread / all-VIT / SPD+VIT)
    //   mult    wave 20              wave 25              wave 30
    //   x4.0    304  152/58/98%      440  187/69/119%     640  256/91/160%
    //   x2.5    190   95/37/61%      275  117/43/74%      400  160/57/100%
    //
    // 2.5 puts the owner's actual sheet at 81% on wave 25 — a blow that nearly
    // ends you from full and does end you from anywhere else. With Counterpunch
    // up it is 32%, so the ANSWER works and the window was what was missing.
    // Zone 1 stays at the table default 4.0: it pays 45-72% of bar at waves
    // 5-10, which is what this game says a telegraph is for.
    //
    // Elites keep the 0.75 ratio to the zone's boss rather than being picked
    // again — an elite telegraph is a skill check you meet a dozen times a run,
    // a boss telegraph is the fight.
    windupMult: 2.5, eliteWindupMult: 2.0 },

  { num: 3, name: 'City Streets', label: 'CITY STREETS',
    startWave: 31, endWave: 45,
    enemies: [{ id: 'mercenary', name: 'Mercenary' }],
    bossName: 'Mercenary Brute',
    // ---- FITTED, NOT GUESSED, BUT NOTHING HAS PLAYED IT ------------------
    // growthMult starts where zone 2 ends (its wave-30 ceiling is g ~10.97), so
    // the seam between zones is a +5% step rather than a cliff.
    //
    // tierGrowth continues the pattern each zone has followed, and the pattern
    // is the player flattening: internal growth ran 4.25x across zone 1 and
    // 2.44x across zone 2, because points arrive at a fixed rate onto an
    // ever-bigger base. 1.22 puts zone 3 at 1.67x, which is the next step in
    // that sequence.
    //
    // The first pass here was 1.30, and it was measured and thrown out. Across
    // waves 15 to 45 it grew the enemy 5.1x while the player grows 2.35x — the
    // enemy outrunning the sheet by 2.2x — which put the wave-45 boss at 15,672
    // HP and 317 damage against a spread build's 310 bar. An ORDINARY hit was a
    // one-shot and the kill took ~200 turns: not hard, unwinnable, which is
    // exactly what the zone-2 note warns a single unchecked curve does.
    //
    // Measured progression, so the fit can be re-derived when it moves (bots
    // driven to each wave with survivability inflated — this measures the XP
    // curve, not difficulty):
    //   wave 15  L6  15 pts     wave 30  L11  30 pts     wave 45  L15  42 pts
    //
    // THE TELEGRAPH KEEPS SHRINKING PER ZONE — 4.0, 2.5, now 1.6 — and that is
    // a symptom worth naming rather than a tuning choice. A telegraph is a
    // multiple of ENEMY damage, and enemy damage outruns the biggest bar anyone
    // can buy, so the multiplier has to fall every zone just to stay survivable.
    // The real fix is for a telegraph to be priced against the PLAYER's bar
    // instead; until then, each zone gets its own number.
    growthMult: 11.5, tierGrowth: 1.22, withinStep: 0.03,
    windupMult: 1.6, eliteWindupMult: 1.2 }
];
function zoneForWave(wave) {
  return ZONES.find(a => wave >= a.startWave && wave <= a.endWave) || ZONES[ZONES.length - 1];
}

// ---- Statuses ------------------------------------------------
// One registry for every timed effect that can sit on a unit, player or enemy.
// A status is a DEFINITION here plus a small instance object
// { type, duration, stacks, power, ... } on the unit. Stacking, ticking, expiry,
// the badge and the damage hooks are all driven off the definition, so a new
// buff or debuff is one entry in this object and nothing else — and it works on
// either side of the fight, because nothing here knows or cares whether the unit
// carrying it is the player.
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
    stacking:'stack', defaults:{ stacks:1, perStack:1 },
    // TICKS ON EVERY TURN, AND EATS ITSELF DOING IT. One tick a turn from each
    // side, and a stack gone each time — so a wound bleeds twice as fast as the
    // rot and is gone twice as fast too, unless you keep cutting.
    //
    // The whole mechanic is three sentences: apply a lot, it hits for what it
    // has, it counts down. More BLEED is more damage, and that is the entire
    // rule — no timer to track, nothing to read off a second number.
    bothClocks: true,
    inflicted: true,
    // The wound is as deep as the LAST cut, not the deepest one ever made —
    // which is what gives spending Resolve a price. See applyStatus.
    perStackRule:'newest',
    label: st => 'BLEED ×' + (st.stacks||1),
    onTurnStart(unit, st) {
      // Hits for what it HAS, then loses one. A pile of 8 pays 8, then 7, then
      // 6 — so a big pile is worth much more than twice a small one, and
      // stacking hard is the play rather than topping up.
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
      creditDamage('Counterpunch', cdmg);
      if (e.hp <= 0) state._lastOverkill = Math.max(0, cdmg - before);
      floatText(e, cdmg, 'damage');
      // The counter draws blood. Base's defensive turn used to produce one flat
      // number and nothing lasting; now bracing is part of the offence, which
      // is the whole reason a class built on absorbing hits can afford to spend
      // a turn not attacking.
      if (st.counterBleed && unit.class === 'base' && e.hp > 0)
        applyStatus(e, 'bleed', { stacks: bleedStacks(unit), perStack: bleedDepth(unit) });
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

