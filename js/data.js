const BUILD = '2026-08-04pm19';

const BALANCE = {
  player: {

    apsPerSpeed: 0.20,

    sheetAnchor: 5,
    apsGain: 2.00, apsHalfPoints: 10,
    apsCap: 6.00,

    damagePerStr: 5,
    hpPerVit: 20,

    pointsPerLevel: 3,

    defenseK: 45,
    defenseCap: 0.90,

    regenPerVit: 0.002,

    critBase: 0.00, critPerInstinct: 0.02, critCap: 1.00,

    critMultBase: 1.0, critMultPerInstinct: 0.25,

    critHealMult: 2.0,

    ailmentDamageFrac: 0.20,
    thornsFrac: 0.05,

    poisonCarryFrac: 0.5,

    poisonPerStr: 2,

    poisonWeakenPerStack: 0.008,
    poisonWeakenCap: 0.30,

    dreadPerSpeed: 14,

    thornsPerVit: 6,

    bleedBase: 2,
    bleedPerStr: 5,
    bleedPerResolve: 0.10,

    thornsFrac: 0.05,

    thornsPerHit: 2,
    thornsBigHitFrac: 0.15,
    thornsPerBar: 12,

    thornsWardPerPoint: 0.0004,
    thornsWardCap: 0.25,

    thornsSiphonFrac: 0.00008,
    thornsSiphonCap: 0.10,
    thornsSpinesGrow: 2,

    shedCapFrac: 0.35,
    shedHpPerThorn: 0.04,
    reflectFrac: 0.20, reflectSpinesMult: 2,

    pressurePerHit: 4,

    critPerPressure: 0.06,
    critChancePerPressure: 0.006,

    pressureWardPerPoint: 0.005,
    pressureWardCap: 0.35,

    pressureSiphonFrac: 0.002,
    pressureSiphonCap: 0.12,
    levelUpHealFrac: 0.15, recoverHpFrac: 0.08,

    healAnchorPerLevel: 0.30,

    dreadSlowPerStack: 0.05,

    dreadSlowFloor: 0.75,

    dreadVulnPerStack: 0.04,
    dreadVulnPerIns: 0.03,
    dreadLossPerHit: 1,

    dreadFeedFrac: 0.03,

    dreadSiphonFrac: 0.005,

    resolveDR: 0.03,
    resolvePerHit: 3,
    reloadHpFloor: 0.15
  },
  enemy: {

    hpBase: 280, tierGrowth: 1.85, withinStep: 0.06,

    hpExp: 0.75,

    dmgBase: 8, dmgExp: 1.00,

    apsBase: 1.00,

    apsPerTier: 0.070,
    apsCap: 2.15,
    crit: 0.10, critMult: 1.5,

    bossHp: 5.0, bossDmg: 1.82, bossAps: 1.00, bossXp: 5.0,

    firstBossMult: 1.0,
    trashDmgMult: 1.45,

    windupEvery: 3, windupMult: 4.0,
    finalWindupEvery: 2,
    eliteWindupEvery: 3,

    eliteWindupMult: 3.0,

    windupSpoilFrac: 0.5,
    eliteBaseChance: 0.16, eliteChancePerWave: 0.006, eliteChanceCap: 0.40,

    packHp:  { 2: 0.58, 3: 0.42 },
    packDmg: { 2: 0.55, 3: 0.40 }
  },

  xp: { firstCost: 58, base: 485, pow: 2, powScale: 35,
        killBase: 46, killWave: 15, killTier: 36 },
  combo: { maxEnemyActionsPerKill: 3, xpPerStack: 0.05, maxStack: 20 },
  bossEvery: 10,

  finalWave: 60,
  spawnDelay: 0.16,

  turnPace: 1,

  saveKey: 'risen_run_v14',

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
                'risen_run_v12_s3', 'risen_run_v12_s4',
                'risen_run_v13', 'risen_run_v13_s0', 'risen_run_v13_s1', 'risen_run_v13_s2',
                'risen_run_v13_s3', 'risen_run_v13_s4'],
  saveSlots: 4
};

function pressureGain(p, def) {
  return Math.max(1, Math.round((def.pressure || 0) * pressureRate(p)));
}

const CLASSES = {
  bio: {
    name: 'Vector', color: 'bio',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [

      { id:'inject', name:'Inject', desc:'Deal {power!} damage + {poisonScale%} of what the rot is ticking for. +{poisonStacks} POISON', type:'attack', power:1.0, poison:1, poisonScale:1.0, poisonStacks:(p,s) => poisonStacks(p,s), target:'enemy', basic:true },

      { id:'distribute', name:'Distribute', desc:'Deal {power!} damage to EVERY enemy. +{poisonStacks} POISON each. When a host dies, {carry%} of its rot jumps to a living one.', type:'attack', shape:'all', power:0.50, poison:4, poisonStacks:(p,s) => poisonStacks(p,s), carry:BALANCE.player.poisonCarryFrac, target:'enemy', cdTurns:3 },

      { id:'biofilm', name:'Biofilm', desc:'For {duration#turn}: take −{power%} damage. POISON on the enemy ticks twice per turn', type:'buff', buff:'chitin', duration:3, power:0.40, target:'self', cdTurns:4 },

      { id:'regenerate', name:'Regenerate', desc:'For {duration#turn}: regenerate {power+} and shed {tickCleanse} POISON each turn. Every enemy is WEAK for {weak.duration#turn}', type:'buff', buff:'regen', duration:5, power:0.20, tickCleanse:1, applies:[{ id:'weak', power:0.25, duration:3 }], target:'self', cdTurns:5 }
    ]
  },

  psy: {
    name: 'Void', color: 'psy',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [

      { id:'hunt', name:'Hunt', desc:'Deal {power!} damage. +{dreadStacks} DREAD', type:'attack', power:1.0, dread:1, dreadStacks:(p,s) => dreadStacks(p,s), target:'enemy', basic:true },

      { id:'terrify', name:'Terrify', desc:'Deal {power!} damage to EVERY enemy and plant +{dreadStacks} DREAD in each. Every stack slows them and opens their guard.', type:'attack', shape:'all', power:0.50, dread:4, dreadStacks:(p,s) => dreadStacks(p,s), target:'enemy', cdTurns:3 },
      { id:'traumatize', name:'Traumatize', desc:'Deal {power!} damage. Against {dreadNeed}+ DREAD the mind breaks: stunned for {stun#turn}.', type:'attack', power:0.95, stun:1, dreadNeed:3, target:'enemy', cdTurns:4 },

      { id:'kill', name:'Kill', desc:'Deal {killTotal} damage. Tears away HALF the enemy’s DREAD — +{perDreadPower!} damage and {feedPerDread+} healed for each. Sheds {cleanse} POISON.', type:'attack', power:2.00, perDreadPower:0.60, consumesDread:true, consumeFrac:0.5, feedPerDread:BALANCE.player.dreadFeedFrac, cleanse:2, target:'enemy', cdTurns:5,
        killTotal: (p, s) => {
          const e = state.enemy;
          const held = (e && e.hp > 0 && !e._defeated) ? statusStacks(e, 'dread') : 0;
          const spent = Math.ceil(held * (s.consumeFrac || 1));
          return formatNum(Math.max(1, Math.floor(p.atkPower * ((s.power || 1) + (s.perDreadPower || 0) * spent))));
        } }
    ]
  },

  hyd: {
    name: 'Kinetic', color: 'hyd',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [

      { id:'piston', name:'Piston', desc:'Deal {power!} damage. +{gain} PRESSURE', type:'attack', power:1.25, pressure:BALANCE.player.pressurePerHit, gain:pressureGain, target:'enemy', basic:true },

      { id:'surge', name:'Surge', desc:'Deal {power!} damage. +{gain} PRESSURE', type:'attack', power:1.7, pressure:10, gain:pressureGain, target:'enemy', cdTurns:3 },

      { id:'dampen', name:'Dampen', desc:'For {duration#turn}: take \u2212{power%} damage and regenerate {regen.power+} each turn.', type:'buff', buff:'dampen', duration:3, power:0.45, applies:[{ id:'regen', power:0.25, duration:3 }], target:'self', cdTurns:4 },

      { id:'rupture', name:'Rupture', desc:'Vent everything into EVERY enemy: {power!} damage +{perPressurePower!} per PRESSURE spent. Always CRITS.', type:'attack', shape:'all', power:1.4, alwaysCrit:true, consumesPressure:true, perPressurePower:0.16, target:'enemy', cdTurns:5 }
    ]
  },

  sym: {
    name: 'Bastion', color: 'sym',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [

      { id:'latch', name:'Latch', desc:'Deal {power!} damage + {thornsScale%} of your THORNS.', type:'attack', power:1.0, thornsScale:0.55, target:'enemy', basic:true },
      { id:'raisespines', name:'Raise Spines', desc:'THORNS ×{power} and pain reflect doubled for {duration#turn}. Every hit taken grows +{growBonus} extra THORNS.', type:'buff', buff:'spines', duration:3, power:2, growBonus:BALANCE.player.thornsSpinesGrow, target:'self', cdTurns:4 },

      { id:'shed', name:'Shed', desc:'Heal {healFrac+}, then tear off up to {capFrac%} of your grown THORNS for {hpPerThorn+} each — only as many as the wound needs. They regrow next fight. Sheds {cleanse} POISON.', type:'heal', healFrac:0.08, shedFuel:true, cleanse:2, hpPerThorn:BALANCE.player.shedHpPerThorn, capFrac:BALANCE.player.shedCapFrac, target:'self', cdTurns:4 },
      { id:'provoke', name:'Provoke', desc:'Bare your guard: EVERY enemy strikes at once and cannot miss. Every spine answers — ×{lashMult} THORNS each. +{growBonus} THORNS, and charged telegraphs spend themselves now.', type:'provoke', growBonus:3, lashMult:1.5, target:'enemy', cdTurns:4 }
    ]
  },

  base: {
    name: 'Baseline', color: 'base',
    base: { str: 5, instinct: 5, speed: 5, vit: 5 },
    skills: [

      { id:'strike', name:'Strike', desc:'Deal {power!} damage. +{buildsResolve} RESOLVE, and open a wound: +{bleedStacks} BLEED. Every turn, BLEED deals {bleedTick} a stack and loses one.', type:'attack', power:1.0, buildsResolve:1, bleed:1, bleedStacks:p => bleedStacks(p), bleedTick:p => bleedDepth(p), target:'enemy', basic:true },
      { id:'bandage', name:'Bandage', desc:'Heal {healFrac+} and +{resolveHealBonus%} per held RESOLVE. Sheds {cleanse} POISON', type:'heal', healFrac:0.14, resolveHealBonus:0.02, cleanse:2, target:'self', cdTurns:4 },

      { id:'counterpunch', name:'Counterpunch', desc:'Brace for {duration#turn}: −{power%} damage taken, stacking with RESOLVE. A hit taken while braced counters {counterPower!} damage and opens a wound: +{bleedStacks} BLEED', type:'buff', buff:'brace', duration:2, power:0.60, counterPower:1.20, counterBleed:1, bleedStacks:p => bleedStacks(p), holdFor:'windup', target:'self', cdTurns:4 },
      { id:'laststand', name:'Last Stand', desc:'Deal {power!} damage, +{perResolvePower!} per RESOLVE spent. Spends {consumeFrac%} of your RESOLVE', type:'attack', power:1.20, perResolvePower:0.40, consumesResolve:true, consumeFrac:0.7, target:'enemy', cdTurns:5 }
    ]
  }
};

const ENEMY_VERBS = {

  guard:  { id:'guard',  tag:'GUARD',  power:0.5,
            blurb:'braces while winding up: takes −50% until the heavy lands' },

  regrow: { id:'regrow', tag:'REGROW', below:0.5, power:0.06,
            blurb:'below half HP, knits 6% of its frame each of its turns' },

  flurry: { id:'flurry', tag:'FLURRY', every:2, hits:2, scale:0.65,
            blurb:'every 2nd action strikes twice at 65%' },

  enrage: { id:'enrage', tag:'ENRAGE', every:3, perStack:0.12,
            blurb:'every 3rd of its turns, swings harden +12% forever' }
};
const CHAMPION_VERBS = ['guard', 'regrow', 'flurry', 'enrage'];

const ELITES = {

  frenzied: { id:'frenzied', tag:'FRENZIED', xp:1.7, apsMult:1.60 },
  vampiric: { id:'vampiric', tag:'VAMPIRIC', xp:1.7, lifesteal:0.30 },

  venomous: { id:'venomous', tag:'VENOMOUS', xp:1.7, poison:true },
  volatile: { id:'volatile', tag:'VOLATILE', xp:1.8, deathNova:0.14 }
};

const HAZARDS = {
  swarm:      { id:'swarm',      name:'SWARM',      text:'Every wave is a full pack of three.', xpMult:1.40 },
  frenzy:     { id:'frenzy',     name:'FRENZY',     text:'Enemies act 15% faster.', xpMult:1.30 },
  brutes:     { id:'brutes',     name:'BRUTES',     text:'Enemies hit 20% harder.', xpMult:1.35 },
  virulent:   { id:'virulent',   name:'VIRULENT',   text:'More elites, and every one of them VENOMOUS.', xpMult:1.35 },
  charged:    { id:'charged',    name:'CHARGED',    text:'Elites and bosses wind up every second action.', xpMult:1.30 },
  relentless: { id:'relentless', name:'RELENTLESS', text:'Half recovery between fights.', xpMult:1.30 }
};

const ZONES = [

  { num: 1, name: 'The Drop', label: 'THE DROP',
    startWave: 1, endWave: 10,

    enemies: [{ id: 'experiment', name: 'FAUNA-01 Skitter' }],
    bossName: 'Sporemother',
    bossVerb: 'regrow',
    champion: { at: 5, id: 'experiment', name: 'FAUNA-01 Apex' },
    soloUntil: 4, packWeights: [55, 45, 0],
    growthMult: 1, tierGrowth: 2.4, withinStep: 0.08 },

  { num: 2, name: 'The Bloom', label: 'THE BLOOM',
    startWave: 11, endWave: 20,
    enemies: [{ id: 'enforcer', name: 'FAUNA-12 Husk' }],
    bossName: 'Bulwark',
    bossVerb: 'guard',
    champion: { at: 15, id: 'lieutenant', name: 'FAUNA-12 Warden' },
    packWeights: [30, 45, 25],
    growthMult: 3.33, tierGrowth: 2.9, withinStep: 0.06,
    dmgMult: 1.05,
    windupMult: 2.5, eliteWindupMult: 2.0 },

  { num: 3, name: 'Survey Camp One', label: 'SURVEY CAMP ONE',
    startWave: 21, endWave: 30,
    enemies: [{ id: 'mercenary', name: 'Survey Remnant' }],
    bossName: 'Survey Chief',

    bossVerb: 'enrage',
    champion: { at: 25, id: 'mercenary', name: 'Survey Veteran' },
    packWeights: [25, 45, 30],
    growthMult: 11.3, tierGrowth: 2.4, withinStep: 0.04,
    dmgMult: 1.10,
    windupMult: 1.6, eliteWindupMult: 1.2 },

  { num: 4, name: 'The Source', label: 'THE SOURCE',
    startWave: 31, endWave: 60,
    enemies: [{ id: 'trooper',  name: 'Source Vessel' },
              { id: 'medic',    name: 'Source Mender' },
              { id: 'demo',     name: 'Source Breaker' },
              { id: 'sentinel', name: 'Source Sentinel' }],
    bossName: 'Reclaimer',
    randomRoster: true,
    rollBossVerb: true,
    bossSegment: 10, extraBossChance: 0.12,
    packWeights: [15, 45, 40],
    eliteBaseChance: 0.35, eliteChanceCap: 0.65,
    growthMult: 28.9, tierGrowth: 1.22, withinStep: 0.04,

    dmgMult: 1.13, dmgMultEnd: 1.45,
    apsMult: 1.00, apsMultEnd: 1.45, hpExp: 0.70,
    windupMult: 1.35, eliteWindupMult: 1.15 }
];
function zoneForWave(wave) {
  return ZONES.find(a => wave >= a.startWave && wave <= a.endWave) || ZONES[ZONES.length - 1];
}

const DEPTH_ROSTER = [
  { id: 'experiment', name: 'FAUNA-01 Skitter', artZone: 1 },
  { id: 'enforcer',   name: 'FAUNA-12 Husk',    artZone: 2 },
  { id: 'mercenary',  name: 'Survey Remnant',   artZone: 3 },
  { id: 'trooper',    name: 'Source Vessel',    artZone: 4 },
  { id: 'medic',      name: 'Source Mender',    artZone: 4 },
  { id: 'demo',       name: 'Source Breaker',   artZone: 4 },
  { id: 'sentinel',   name: 'Source Sentinel',  artZone: 4 }
];

const DEPTH_CHAMPIONS = [
  { id: 'experiment', name: 'FAUNA-01 Apex',  artZone: 1 },
  { id: 'lieutenant', name: 'FAUNA-12 Warden', artZone: 2 },
  { id: 'mercenary',  name: 'Survey Veteran',  artZone: 3 }
];

const DEPTH_BOSSES = [
  { name: 'Sporemother',  artZone: 1 },
  { name: 'Bulwark',      artZone: 2 },
  { name: 'Survey Chief', artZone: 3 },
  { name: 'Reclaimer',    artZone: 4 }
];

const STATUSES = {

  poison: {
    id:'poison', name:'POISON', tone:'poison', kind:'debuff',

    stacking:'stack', permanent:true, defaults:{ stacks:1, perStack:1 },

    inflicted: true,

    label: st => 'POISON ×' + (st.stacks||1),

    outgoingMult: (u, st) => (u && u.isPlayer) ? 1
      : 1 - Math.min(P().poisonWeakenCap, (st.stacks || 0) * P().poisonWeakenPerStack),
    onTurnStart(unit, st) {

      const foe = unit.isPlayer ? null : state.player;
      const ticks = (foe && foe.hp > 0 && hasStatus(foe, 'chitin')) ? 2 : 1;
      for (let i = 0; i < ticks; i++) {
        if (unit.hp <= 0) break;
        const dmg = Math.max(1, Math.floor((st.perStack||1) * (st.stacks||1)));
        unit.hp = Math.max(0, unit.hp - dmg);

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

  chitin: {
    id:'chitin', name:'BIOFILM', tone:'buff', kind:'buff',
    stacking:'longest', defaults:{ duration:3, power:0.40 },
    label: st => 'CHITIN ' + Math.ceil(st.duration) + 't',
    incomingMult: (u, st) => 1 - (st.power || 0)
  },

  bleed: {
    id:'bleed', name:'BLEED', tone:'bleed', kind:'debuff',

    stacking:'stack', defaults:{ stacks:1, perStack:1 },

    bothClocks: true,
    inflicted: true,

    perStackRule:'newest',
    label: st => 'BLEED ×' + (st.stacks||1),
    onTurnStart(unit, st) {

      const dmg = Math.max(1, Math.floor((st.perStack||1) * (st.stacks||1)));
      unit.hp = Math.max(0, unit.hp - dmg);
      if (!unit.isPlayer) creditDamage('Bleed', dmg);
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

    stacking:'amplify', defaults:{ duration:3, power:2 }, persists:true,
    label: st => 'SPINES ' + Math.ceil(st.duration) + 't',
    thornsMult: (u, st) => st.power || 1,

    onHitTaken(unit, st, ctx) {
      if (unit.class !== 'sym' || !(ctx.damage > 0)) return;
      growThorns(unit, P().thornsSpinesGrow, 'SPINES, hit taken');
    }
  },

  pressure: {
    id:'pressure', name:'PRESSURE', tone:'pressure', kind:'buff',
    stacking:'stack', permanent:true, defaults:{ stacks:1 },
    label: st => 'PRESSURE \u00d7' + (st.stacks||1),

    incomingMult: (u, st) => (u && u.isPlayer)
      ? 1 - Math.min(P().pressureWardCap || 0, (st.stacks || 0) * (P().pressureWardPerPoint || 0))
      : 1
  },

  harden: {
    id:'harden', name:'HARDEN', tone:'spines', kind:'buff',
    stacking:'replace', defaults:{ duration:2, power:0.45 },
    label: st => 'HARDEN ' + Math.ceil(st.duration) + 't',
    incomingMult: (u, st) => 1 - (st.power || 0)
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

    onHitTaken(unit, st, ctx) {
      const e = ctx.attacker;
      if (!e || unit.hp <= 0 || e.hp <= 0) return;
      const cdmg = Math.max(1, Math.floor(unit.atkPower * (st.counter||1.2)));
      const before = e.hp;
      e.hp = Math.max(0, e.hp - cdmg);
      creditDamage('Counterpunch', cdmg);
      if (e.hp <= 0) state._lastOverkill = Math.max(0, cdmg - before);
      floatText(e, cdmg, 'damage');

      if (st.counterBleed && unit.class === 'base' && e.hp > 0)
        applyStatus(e, 'bleed', { stacks: bleedStacks(unit), perStack: bleedDepth(unit) });
      logDamage('COUNTER', e, cdmg, [
        'BRACE ×' + (st.counter||1.2).toFixed(2) + ' Attack Damage',
        logNum(e.hp) + '/' + logNum(e.maxHp) + ' left'
      ]);
      playAttackAnim(unit, e, true, 'counter');
    }
  },

  dread: {
    id:'dread', name:'DREAD', tone:'dread', kind:'debuff',
    stacking:'stack', permanent:true, defaults:{ stacks:1 },
    label: st => 'DREAD ×' + (st.stacks||1),

    apsMult: (u, st) => Math.max(P().dreadSlowFloor, 1 - (st.stacks||0) * P().dreadSlowPerStack),

    incomingMult(u, st) {
      const p = state.player;
      const ins = (p && p.class === 'psy')
        ? Math.max(0, (p.instinct + gearStat(p, 'instinct')) - BALANCE.player.sheetAnchor) : 0;
      const per = P().dreadVulnPerStack * (1 + ins * (P().dreadVulnPerIns || 0));
      return 1 + (st.stacks || 0) * per;
    }
  },

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

  stun: {
    id:'stun', name:'STUNNED', tone:'stun', kind:'debuff',
    stacking:'longest', manual:true, defaults:{ duration:1 },
    label: () => 'STUNNED'
  },

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

      cleansePoison(unit, st.cleanse || 0, 'REGEN');
      if (unit.hp >= unit.maxHp) return false;

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
