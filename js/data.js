// Balance, build stamp, classes, talents, statuses — the numbers and tables
// ============================================================
// RISEN — balance & systems
//
// Design notes for future-you:
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
//    turn now comes from one of two places you can point at — Speed (1.00 ->
//    1.79 vs a baseline enemy, fully invested), or the archetype in front of
//    you being slow. Neither is free.
//
//    This matters more than it looks, because a kill costs a fixed number of
//    YOUR turns: skill cooldowns tick on your own turns rather than a clock,
//    so turn advantage never speeds up your rotation. All it does is decide
//    how much the enemy gets to do inside it. Turn rate is therefore a
//    mitigation stat wearing an offensive costume, and handing out +43% of it
//    on a fresh sheet was handing out free damage reduction on top of block.
//    (psy is the one exception, where more turns really is more damage: its
//    Momentum builds per landed hit.)
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
//    but saturates, so no single stat can scale quadratically.
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
//  * Known soft spots, in case they read as bugs rather than gaps: Instinct
//    feeds crit chance and nothing else; cooldown reduction is a live seam with
//    no source yet (no talent sets cdrBonus, so its readout row stays hidden);
//    and healing outside class kits is down to two 8% trickles — between fights
//    and on level-up — since regen and the door's RECOVER both went.
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
const BUILD = '2026-07-29b';

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
    pointsPerLevel: 3,
    // The percentage stats are set so a starting sheet reads 10 / 10 / 10 / 0
    // at 5 in every stat — the same round-number treatment as 25 damage and
    // 100 HP. The bases look odd on their own (0.075, 0.045, 0.065) because
    // each is "10% minus whatever the starting 5 points already contribute";
    // the per-point rates are untouched, since Speed and Instinct want defining
    // before they want retuning. Once they are defined, moving every rate to a
    // flat 1%/point would let all three bases sit at a tidy 5%.
    evadeBase: 0.075, evadePerSpeed: 0.005, evadeCap: 0.40,
    blockBase: 0.065, blockPerVit: 0.007, blockCap: 0.35, blockReduction: 0.5,
    critBase: 0.045, critPerInstinct: 0.011, critCap: 0.70,
    critMult: 2.0,          // flat: a crit is always double, on every strain
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
    levelUpHealFrac: 0.08, recoverHpFrac: 0.08,
    chargeCap: 5,          // Momentum (psy) bank ceiling
    momentumDmg: 0.10,     // psy: +10% damage per held Momentum — the streak IS the build
    momentumLossPerHit: 2, // psy: taking a hit trims Momentum by this (not a full reset)
    sporeCap: 6,           // sym: Spore bank ceiling
    resolveCap: 6,         // Unmutated: Resolve bank ceiling
    resolveDR: 0.03,       // Unmutated: each held Resolve = 3% flat damage reduction (18% at cap)
    resolvePerHit: 1,      // Unmutated: Resolve gained whenever you take a hit
    reloadHpFloor: 0.15    // deliberate mercy: continuing a run never puts you below this
  },
  enemy: {
    hpBase: 132, tierGrowth: 1.52, withinStep: 0.13,
    dmgBase: 8, dmgExp: 0.88,
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
    // player sheet round (25 damage, 100 HP, 1.00 rate) AND makes the
    // ARCHETYPES table below read directly as turns-per-player-turn.
    //
    // PREVIOUS VALUES, if this wants reverting as one block:
    //   apsBase 0.70, apsPerTier 0.018, apsCap 1.5,
    //   bossDmg 2.0, trashDmgMult 1.9, ARCHETYPES.skirmisher.aps 1.55
    apsBase: 1.00,
    // Scaled with the base (0.018 x 1/0.7) so tier growth stays the same
    // FRACTION of the base it always was: a baseline enemy drifts 1.00 -> 1.05
    // across the run, so standing still on Speed slowly loses you the tempo.
    apsPerTier: 0.026,
    apsCap: 2.15,                      // same base-to-cap headroom as the old 0.70 / 1.5
    crit: 0.10, critMult: 1.5,
    // bossDmg and trashDmgMult were both fitted against a player taking ~1.5
    // turns per enemy turn. With the anchor at 1:1 the enemy now acts far more
    // often per fight, so both come down to keep a wave costing what it cost.
    // These are the compensation for the anchor, not a difficulty change: total
    // unmitigated HP spent clearing all 15 waves lands within 2% of before.
    bossHp: 3.4, bossDmg: 1.40, bossXp: 3.0,
    trashDmgMult: 1.33,                // trash hits harder so fights cost real HP (bosses use bossDmg)
    windupEvery: 3, windupMult: 6.5,   // boss telegraph: every Nth action winds up; next strike hits xN
    finalWindupEvery: 2,               // the final boss keeps you under constant telegraph pressure
    eliteWindupEvery: 3,               // elites telegraph too: the mid-run skill check
    eliteBaseChance: 0.16, eliteChancePerWave: 0.006, eliteChanceCap: 0.40
  },
  xp: { base: 40, linear: 24, pow: 1.30, powScale: 9,
        killBase: 46, killWave: 15, killTier: 36 },
  combo: { maxEnemyActionsPerKill: 3, xpPerStack: 0.05, maxStack: 20 },   // chain continues if the kill let the enemy act <= N times (speed-fair)
  bossEvery: 5,          // boss on every Nth wave
  talentEvery: 5,        // choose a mutation every Nth level
  finalWave: 15,         // beating this wave's boss wins the run
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
  // Bumping also gives every player empty slots on the next load, which is the
  // honest outcome — those runs are not playable as the game now works.
  saveKey: 'risen_run_v4',
  // Storage keys from older versions, cleared once on load so they cannot
  // accumulate invisibly. Oldest first; add the outgoing prefix here on a bump.
  oldSaveKeys: ['risen_run_v3', 'risen_run_v3_s1', 'risen_run_v3_s2'],
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
  psy: {
    name: 'Psychological', color: 'psy',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [
      { id:'shock', name:'Shock', desc:'Auto. Attack the enemy for your Attack Damage.', type:'attack', power:1.0, target:'enemy', basic:true },
      { id:'traumatize', name:'Traumatize', desc:'{power%} Attack Damage. Consumes {stunCost} Momentum to stun {stun#turn}.', type:'attack', power:0.95, stun:1, stunCost:3, target:'enemy', cdTurns:3 },
      { id:'drain', name:'Nerve Drain', desc:'{power%} Attack Damage. Consumes {healCost} Momentum to heal {lifesteal%} of damage dealt.', type:'attack', power:0.90, lifesteal:0.30, healCost:2, target:'enemy', cdTurns:3 },
      { id:'storm', name:'Flow State', desc:'Needs {requiresCharges}+ Momentum. For {duration#turn}: Momentum cannot be lost, and every held stack deals double damage.', type:'buff', buff:'flow', duration:3, requiresCharges:3, target:'self', cdTurns:6 }
    ]
  },
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
const ARCHETYPES = {
  grunt:      { id:'grunt',      tag:null,      hp:1.00, dmg:1.00, aps:1.00, evade:0.00 },
  skirmisher: { id:'skirmisher', tag:'SWIFT',   hp:0.68, dmg:0.78, aps:1.18, evade:0.15 },
  brute:      { id:'brute',      tag:'HEAVY',   hp:1.55, dmg:1.30, aps:0.72, evade:0.00 },
  warden:     { id:'warden',     tag:'PLATED',  hp:1.25, dmg:0.90, aps:0.90, evade:0.00 }
};
const ARCH_ORDER = ['grunt','skirmisher','brute','warden','grunt'];

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

// Act structure — the content framework for a run. Act 1 is the 15-wave slice.
// Each act owns its zones and enemy naming; future acts append to this list.
const ACTS = [
  { num: 1, name: 'Containment', startWave: 1, endWave: 15,
    zones: ['THE SHIP','THE DOCKS','THE LAB'],
    enemyName: 'MCP Enforcer', bossName: 'MCP Captain' }
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

  flow: {
    id:'flow', name:'FLOW', tone:'flow', kind:'buff',
    stacking:'replace', defaults:{ duration:3, power:2 },
    label: st => 'FLOW ' + Math.ceil(st.duration) + 't',
    // Its two effects stay as reads at their sites rather than hooks, because
    // both touch psy's Momentum bank rather than a generic damage number:
    // applyEnemyDamage skips the loss while it is up, and applyPlayerDamage
    // multiplies the per-charge bonus by this power.
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

