const HEADLESS = {
  on: false,
  log: [],
  logCap: 4000
};

let _pendingStep = null;

function pumpSteps(limit) {
  let n = 0;
  const d0 = state.deaths || 0;
  while (_pendingStep && n++ < (limit || 10000)) {
    const fn = _pendingStep;
    _pendingStep = null;
    fn();
    if (state.awaitingInput || state.runOver || (state.deaths || 0) > d0
        || state.atCamp || state.hazardOffer) break;
  }
  return n;
}

const ROTATE_STATS = ['str', 'instinct', 'speed', 'vit'];

function dumbPolicy(p) {
  const pressable = s => s.basic || s.cd <= 0;
  for (let jab = 0; jab < 40; jab++) {
    const btn = p.skills[Math.floor(Math.random() * p.skills.length)];
    if (btn && pressable(btn)) return btn;
  }
  return p.skills.find(s => s.basic) || p.skills[0];
}

function dumbAllocate() { return ROTATE_STATS[Math.floor(Math.random() * ROTATE_STATS.length)]; }

function rotateAllocate(p) {
  p._alloc = ((p._alloc || 0) + 1) % ROTATE_STATS.length;
  return ROTATE_STATS[p._alloc];
}

const SMART = {
  healLands: 0.80,
  healPanic: 0.35,
  spendMin: 3,
  spendDeep: 15
};

function healAmount(s, p) {
  if (s.healFrac == null) return 0;
  return Math.max(1, Math.floor(healAnchorFor(p) * s.healFrac));
}

function healWorthIt(s, p) {
  if (p.hp / Math.max(1, p.maxHp) <= SMART.healPanic) return true;
  return (p.maxHp - p.hp) >= healAmount(s, p) * SMART.healLands;
}

function spendStacks(s, p, e) {
  if (s.consumesDread) return e ? statusStacks(e, 'dread') : 0;
  if (s.consumesResolve) return statusStacks(p, 'resolve');
  if (s.consumesPressure) return statusStacks(p, 'pressure');
  return 0;
}
function spenderDamage(s, p, e) {
  let mult = s.power || 1;
  if (s.consumesDread)
    mult += (s.perDreadPower || 0) * Math.ceil(spendStacks(s, p, e) * (s.consumeFrac || 1));
  if (s.consumesResolve) mult += (s.perResolvePower || 0) * spendStacks(s, p, e);
  if (s.consumesPressure) mult += (s.perPressurePower || 0) * spendStacks(s, p, e);
  return p.atkPower * mult * (s.alwaysCrit ? (p.critMult || 1) : 1);
}
function spenderWorthIt(s, p, e) {
  if (!s.consumesDread && !s.consumesResolve && !s.consumesPressure) return true;
  const stacks = spendStacks(s, p, e);
  if (stacks < SMART.spendMin) return false;
  if (e && spenderDamage(s, p, e) >= e.hp) return true;

  if (e && statusMult(e, 'incomingMult', { attacker: p }) < 1) return false;
  return stacks >= SMART.spendDeep;
}

function worthPressing(s, p, e) {
  if (s.healFrac != null && !healWorthIt(s, p)) return false;
  return spenderWorthIt(s, p, e);
}

function smartPolicy(p) {
  const foes = livingEnemies();
  const ready = p.skills.filter(s => !s.basic && s.cd <= 0);
  const basic = p.skills.find(s => s.basic) || p.skills[0];
  if (!foes.length) return basic;

  const focus = foes.reduce((a, b) => (b.hp < a.hp ? b : a));
  setTarget(focus);
  const e = state.enemy;

  if (foes.length > 1) {
    const aoe = ready.find(s => s.shape === 'all' && worthPressing(s, p, e));
    if (aoe) return aoe;
  }

  return ready.find(s => worthPressing(s, p, e)) || basic;
}

const BOTS = {
  dumb:  { name: 'dumb',  policy: dumbPolicy,  allocate: dumbAllocate },
  smart: { name: 'smart', policy: smartPolicy, allocate: rotateAllocate }
};

function simulateRun(classId, opts) {
  opts = opts || {};

  const policy = opts.policy || smartPolicy;
  const allocate = opts.allocate || rotateAllocate;
  const maxSteps = opts.maxSteps || 100000;

  if (!CLASSES[classId]) return null;

  const wasOn = HEADLESS.on;
  HEADLESS.on = true;
  HEADLESS.log.length = 0;
  _pendingStep = null;
  try {

    setPendingKit(opts.kit || null);
    startGame(true, classId);
    if (opts.weights) Object.assign(state.player.weights, opts.weights);
    let steps = 0;

    while (!state.runOver && (state.deaths || 0) < (opts.maxDeaths || 1) && steps++ < maxSteps) {

      pumpSteps();
      if (state.runOver) break;
      if (opts.each) opts.each(state);
      if (opts.stopWhen && opts.stopWhen(state)) break;
      if (state.atCamp) {
        if (nextDrop()) { resolveDrop(botTakesDrop(state.player, nextDrop())); continue; }
        if (nextModOffer()) { takeMod(botTakesMod(nextModOffer())); continue; }
        if (state.hazardOffer) { pickHazard(state.hazardOffer[0]); continue; }
        moveOut();
        continue;
      }
      if (!state.awaitingInput) {
        if (!_pendingStep) break;
        continue;
      }
      const p = state.player;

      if (p.points > 0) { adjustStat(allocate(p), 1); continue; }
      if (pendingTotal(p) > 0) { commitStats(); continue; }
      const skill = policy(p);
      if (!skill) break;
      playerAct(skill);
    }
    const p = state.player;
    return {
      classId, won: !!state.won, wave: state.diedAt || state.wave,
      deaths: state.deaths || 0, kills: state.kills,

      level: p.level, turns: state.runTurns, damageDealt: Math.floor(state.damageDealt),
      bestCombo: state.bestCombo,
      stats: { str: p.str, instinct: p.instinct, speed: p.speed, vit: p.vit },
      derived: { atk: attackDamage(p), maxHp: p.maxHp, rate: +p.attackSpeed.toFixed(2) },
      steps,
      log: opts.keepLog ? HEADLESS.log.slice() : undefined
    };
  } finally {
    HEADLESS.on = wasOn;
    _pendingStep = null;
    stopCombatLoop();
  }
}
