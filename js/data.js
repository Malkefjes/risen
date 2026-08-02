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
const BUILD = '2026-08-02z';

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
    evadeBase: 0.075, evadePerSpeed: 0.005, evadeCap: 0.40,
    blockBase: 0.065, blockPerVit: 0.007, blockCap: 0.35, blockReduction: 0.5,
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
    critBase: 0.00, critPerInstinct: 0.02, critCap: 0.90,
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
    // ---- BLEED (Unmutated) ------------------------------------------------
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
    thornsPerHit: 1,           // every hit taken grows thorns by this, no window and no condition
    thornsBigHitFrac: 0.15,    // ...plus one more per this share of max HP taken in a single blow
    thornsGrowMax: 4,          // ceiling on what ONE hit can grow, so a x5 telegraph is a feast, not a jackpot
    thornsSpinesGrow: 2,       // extra growth per hit while Spines is up
    // SHED TAKES ONLY AS MANY THORNS AS THE HEAL NEEDED, capped by the fraction
    // below. A percentage cost against a runaway number would grow without bound
    // while its payout (bounded by max HP) does not, so the button would stop
    // being worth pressing exactly when you had played best.
    shedCapFrac: 0.35,         // Shed never takes more than this share of GROWN thorns in one press
    shedHpPerThorn: 0.04,      // one thorn shed is worth this share of the heal anchor
    reflectFrac: 0.20, reflectSpinesMult: 2,   // sym: share of damage taken reflected back; doubled while Spines is up
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
    dreadSlowFloor: 0.55,    // ...but never below this share of its rate: the slow saturates, the count does not
    dreadVulnPerStack: 0.04, // each stack: +4% damage the enemy takes — terror opens the guard, uncapped
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
    // ---- RESOLVE (Unmutated) ----------------------------------------------
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
    resolveDR: 0.03,       // Unmutated: each held Resolve = 3% flat damage reduction
    resolvePerHit: 3,      // Unmutated: Resolve gained whenever you take a hit
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
    hpBase: 160, tierGrowth: 1.85, withinStep: 0.06,
    // dmgExp 1.00: damage tracks the growth factor exactly. Below 1 it grows
    // SUBLINEARLY while player HP grows linearly in allocated points.
    dmgBase: 8, dmgExp: 1.00,
    // apsBase MATCHES THE PLAYER'S STARTING RATE, so wave 1 is one turn each and
    // rate multipliers read directly as turns-per-player-turn.
    apsBase: 1.00,
    // RATE COUNTS FROM THE RUN'S START, NOT THE ZONE'S — the one place the
    // zone-local rule is deliberately broken. Everything else about an enemy
    // restarts per zone, but tempo is the one axis the player never resets, so
    // it is the one the enemy cannot afford to either. 1.00 -> 1.56 across 45
    // waves; fitted when a run was 30, so the last zone meets a tempo nobody
    // chose. Flagged, not changed.
    apsPerTier: 0.070,
    apsCap: 2.15,
    crit: 0.10, critMult: 1.5,
    // bossHp came DOWN from 5.27 to soften the FIRST boss; bossDmg and bossAps
    // are the old brute chassis, folded in when archetypes were removed.
    bossHp: 4.5, bossDmg: 1.82, bossAps: 0.72, bossXp: 3.0,
    // THE FIRST BOSS IS MEANT TO KILL YOU. It is the one fight in the run with
    // a scripted answer to losing — the scientist pulls you out — so it hits
    // for twice the HP and twice the damage of an ordinary boss at its wave.
    // Applied at wave 5 alone; every later boss is the plain bossHp/bossDmg.
    firstBossMult: 2,
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
  // Measured median level at each boss wave: L2 at 5, L4 at 10, L6 at 15, L8 at
  // 20, L10 at 25, L11 at 30, L12 at 35, L14 at 40, L15 at 45. Waves past 30
  // were sampled with survivability inflated so a bot could reach them, so they
  // read the XP curve, not the difficulty.
  //
  // OPEN THREAD: across waves 15-45 the enemy grows 5.1x and the player 2.35x.
  // That is why the telegraph multiplier has to shrink every zone.
  xp: { firstCost: 58, base: 485, pow: 2, powScale: 35,
        killBase: 46, killWave: 15, killTier: 36 },
  combo: { maxEnemyActionsPerKill: 3, xpPerStack: 0.05, maxStack: 20 },   // chain continues if the kill let the enemy act <= N times (speed-fair)
  bossEvery: 5,          // boss on every Nth wave
  finalWave: 45,         // beating this wave's boss wins the run (zone 3's finale)
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
  saveKey: 'risen_run_v12',
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
                'risen_run_v11', 'risen_run_v11_s0', 'risen_run_v11_s1', 'risen_run_v11_s2'],
  saveSlots: 4
};

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
      { id:'slash', name:'Slash', desc:'Deal {power!} damage. +{poison} POISON', type:'attack', power:1.0, poison:1, target:'enemy', basic:true },
      { id:'infest', name:'Infest', desc:'Deal {power!} damage. +{poison} POISON', type:'attack', power:0.50, poison:4, target:'enemy', cdTurns:3 },
      { id:'chitin', name:'Chitin', desc:'For {duration#turn}: take −{power%} damage. POISON on the enemy ticks twice per turn', type:'buff', buff:'chitin', duration:3, power:0.40, target:'self', cdTurns:5 },
      // MIASMA IS BIO'S ONLY FAUCET. At 10% x 4 turns on a 5-turn cooldown it
      // handed back 40% of a bar and still lost to attrition past the first
      // boss; 13% is the same shape, paying 52% of a bar per cast.
      { id:'miasma', name:'Miasma', desc:'For {duration#turn}: regenerate {power+} each turn. The enemy is WEAK for {weak.duration#turn}', type:'buff', buff:'regen', duration:4, power:0.13, applies:[{ id:'weak', power:0.25, duration:3 }], target:'self', cdTurns:5 }
    ]
  },
  // THE TERROR MUTANT. Psy's mechanic is DREAD, a mark stacked ON THE ENEMY —
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
      { id:'hunt', name:'Hunt', desc:'Deal {power!} damage. +{dread} DREAD', type:'attack', power:1.0, dread:1, target:'enemy', basic:true },
      // Plants 4, one MORE than Traumatize needs, so the advertised combo
      // survives one steadying hit.
      { id:'terrify', name:'Terrify', desc:'Deal {power!} damage and plant +{dread} DREAD. Every stack slows the enemy and opens its guard.', type:'attack', power:0.50, dread:4, target:'enemy', cdTurns:3 },
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
  // THORNS block in BALANCE.
  //
  // THE OTHER THREE ANSWER A HIT; SYM WANTS ONE. Provoke is that verb, the only
  // button that spends your turn to buy the ENEMY a turn, and it doubles as
  // sym's telegraph answer — deliberately a different one from psy's: a stun
  // DELETES the heavy swing, Provoke goads it out early so it lands as an
  // ordinary one. Raise Spines + Provoke is the combo, and it asks a question no
  // other combo asks: you have to be healthy enough to eat what you invited.
  //
  // Sustain is SHED, the one place a run-permanent ramp can be spent — healing
  // costs growth you cannot get back this fight. No burst finisher, on purpose.
  //
  // SPEED IS THE INTERESTING STAT: more of your turns means proportionally FEWER
  // enemy swings, and swings are food. The only stat in the game with a real cost
  // attached, landed on the strain whose allocation had nothing to say.
  sym: {
    name: 'Symbiotic', color: 'sym',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      // 0.35 -> 0.55: with THORNS as the ramp, the basic is where the number
      // gets read back on your OWN turns, carrying the share Bloom used to.
      { id:'latch', name:'Latch', desc:'Deal {power!} damage + {thornsScale%} of your THORNS.', type:'attack', power:1.0, thornsScale:0.55, target:'enemy', basic:true },
      { id:'spines', name:'Raise Spines', desc:'THORNS ×{power} and pain reflect doubled for {duration#turn}. Every hit taken grows +{growBonus} extra THORNS.', type:'buff', buff:'spines', duration:3, power:2, growBonus:BALANCE.player.thornsSpinesGrow, target:'self', cdTurns:4 },
      { id:'shed', name:'Shed', desc:'Heal {healFrac+}, then tear off THORNS to heal {hpPerThorn+} more each. Takes only as many as the wound needed, up to {capFrac%} of what you have grown.', type:'heal', healFrac:0.08, shedFuel:true, hpPerThorn:BALANCE.player.shedHpPerThorn, capFrac:BALANCE.player.shedCapFrac, target:'self', cdTurns:3 },
      { id:'provoke', name:'Provoke', desc:'Bare your guard: the enemy strikes at once and cannot miss. +{growBonus} THORNS, and a charged telegraph comes out now — ordinary, or half-strength if it shrugs you off.', type:'provoke', growBonus:3, target:'enemy', cdTurns:4 }
    ]
  },
  // Base Sonny, reached via "RESIST MUTATION". Refused the infection, so he has
  // no strain mechanic — and is THE ONLY STRAIN WITH TWO NUMBERS instead.
  // RESOLVE on himself, BLEED on them: not two mechanics but two halves of one
  // exchange, since Resolve is bought by landing hits AND taking them, and the
  // cut is only as deep as the Resolve behind it. Endure, then everything at
  // once — except the enduring is doing damage the whole time.
  base: {
    name: 'Unmutated', color: 'base',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      // The card prints what the next Strike will actually open, and it moves as
      // Resolve stacks up (a desc field may be a function — see fmtDesc). "As
      // deep as the Resolve behind it" names a relationship when the player
      // wants a NUMBER.
      { id:'jab', name:'Strike', desc:'Deal {power!} damage. +{buildsResolve} RESOLVE, and open a wound: +{bleedStacks} BLEED. Every turn, BLEED deals {bleedTick} a stack and loses one.', type:'attack', power:1.0, buildsResolve:1, bleed:1, bleedStacks:p => bleedStacks(p), bleedTick:p => bleedDepth(p), target:'enemy', basic:true },
      { id:'bandage', name:'Bandage', desc:'Heal {healFrac+} and +{resolveHealBonus%} per held RESOLVE', type:'heal', healFrac:0.14, resolveHealBonus:0.02, target:'self', cdTurns:4 },
      // BRACE LASTS TWO TURNS, NOT ONE. Measured: holding it and casting it on
      // the exact pre-heavy turn took base's first-boss clear from 20% to 100%
      // with nothing rebalanced, so the ANSWER was never insufficient — the
      // WINDOW was. At one turn it was a coin flip whether it was even
      // available, and 60% of base's deaths were a heavy landing. Two turns
      // forgives a turn of misjudgement: strict, not broken.
      // `holdFor` tells the bot the same thing the card tells the player.
      { id:'counter', name:'Counterpunch', desc:'Brace for {duration#turn}: −{power%} damage taken, stacking with RESOLVE. A hit taken while braced counters {counterPower!} damage and opens a wound: +{bleedStacks} BLEED', type:'buff', buff:'brace', duration:2, power:0.60, counterPower:1.20, counterBleed:1, bleedStacks:p => bleedStacks(p), holdFor:'windup', target:'self', cdTurns:4 },
      { id:'laststand', name:'Last Stand', desc:'Deal {power!} damage, +{perResolvePower!} per RESOLVE consumed. Spends all RESOLVE', type:'attack', power:1.20, perResolvePower:0.40, consumesResolve:true, target:'enemy', cdTurns:5 }
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

// ZONE STRUCTURE. The whole run is ACT 1; a zone is the unit that actually
// shapes it. Three zones of 15 waves, three bosses each, 45 waves total. Each
// zone owns its label, its enemy roster (names here, art in sprites.js keyed by
// zone number), its difficulty floor, and its telegraph.
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
const ZONES = [
  { num: 1, name: 'The Laboratory', label: 'THE LABORATORY',
    startWave: 1, endWave: 15,
    // enemies: the zone's trash ROSTER — an id (the key its art is filed under
    // in sprites.js) and the name that appears on the card.
    enemies: [{ id: 'experiment', name: 'Escaped Experiment' }],
    bossName: 'Prime Symbiote',
    growthMult: 1 },

  { num: 2, name: 'The Laboratory: Mutant Pest Control', label: 'THE LABORATORY: MUTANT PEST CONTROL',
    startWave: 16, endWave: 30,
    // THREE FACES, ONE STAT LINE. They rotate by wave (see makeEnemy) and are
    // deliberately identical in numbers: a wave-N enemy is a wave-N enemy. If a
    // rifleman should fight differently, the enemy table says so out loud.
    enemies: [{ id: 'enforcer',  name: 'MCP Enforcer'  },
              { id: 'combatant', name: 'MCP Combatant' },
              { id: 'rifleman',  name: 'MCP Rifleman'  }],
    bossName: 'MCP Grenadier',
    growthMult: 4.5, tierGrowth: 1.45, withinStep: 0.04,
    // A FLAT TELEGRAPH MULTIPLIER CROSSES THE BAR EVENTUALLY, and that is
    // arithmetic rather than tuning: enemy damage grows far faster across a run
    // than the biggest bar anyone can buy. At the shared x4.0 it crossed in zone
    // 2 and never came back — measured on a real run, base died on wave 25 to a
    // 426 telegraph on a 340 bar. At x2.5 that same sheet pays 81%, and 32% with
    // Counterpunch up, so the ANSWER works and the window was what was missing.
    // Elites keep a 0.75 ratio to the zone's boss rather than being picked
    // again.
    windupMult: 2.5, eliteWindupMult: 2.0 },

  { num: 3, name: 'City Streets', label: 'CITY STREETS',
    startWave: 31, endWave: 45,
    enemies: [{ id: 'mercenary', name: 'Mercenary' }],
    bossName: 'Mercenary Brute',
    // ---- FITTED, BUT NOTHING HAS PLAYED IT -------------------------------
    // growthMult starts where zone 2 ends (~10.97), so the seam between zones is
    // a +5% step rather than a cliff. tierGrowth continues the flattening each
    // zone has followed — 4.25x across zone 1, 2.44x across zone 2, 1.67x here —
    // because points arrive at a fixed rate onto an ever-bigger base.
    //
    // The first pass was 1.30 and was measured and thrown out: it put the
    // wave-45 boss at 15,672 HP and 317 damage against a spread build's 310 bar,
    // so an ORDINARY hit was a one-shot and the kill took ~200 turns.
    //
    // THE TELEGRAPH KEEPS SHRINKING PER ZONE — 4.0, 2.5, now 1.6 — and that is a
    // symptom worth naming rather than a tuning choice. The real fix is pricing a
    // telegraph against the PLAYER's bar; until then, each zone gets its own.
    growthMult: 11.5, tierGrowth: 1.22, withinStep: 0.03,
    windupMult: 1.6, eliteWindupMult: 1.2 }
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

  // UNMUTATED'S WOUND. Poison's twin in shape and its opposite in source: the
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

  // Unmutated's mechanic, and a STATUS rather than a wallet since the banks came
  // out. See the RESOLVE block in BALANCE.
  //
  // PERMANENT inside a fight — nothing times it out, only Last Stand spends it —
  // and deliberately missing `persists`, so the between-fight sweep drops it and
  // every fight is rebuilt from nothing.
  //
  // The reduction is NOT an incomingMult here, for the same reason Brace's
  // isn't: applyEnemyDamage sums the two and caps the sum once.
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

