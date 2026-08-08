const HEADLESS = {
  on: false,
  log: [],
  logCap: 4000
};

const ROTATE_STATS = ['str', 'instinct', 'speed', 'vit'];

function dumbAllocate() { return ROTATE_STATS[Math.floor(Math.random() * ROTATE_STATS.length)]; }

function rotateAllocate(p) {
  p._alloc = ((p._alloc || 0) + 1) % ROTATE_STATS.length;
  return ROTATE_STATS[p._alloc];
}

const BOTS = {
  dumb:  { name: 'dumb',  allocate: dumbAllocate },
  smart: { name: 'smart', allocate: rotateAllocate }
};

function simulateRun(classId, opts) {
  opts = opts || {};

  const allocate = opts.allocate || rotateAllocate;
  const maxTicks = opts.maxTicks || opts.maxSteps || 2000000;

  if (!CLASSES[classId]) return null;

  const wasOn = HEADLESS.on;
  HEADLESS.on = true;
  HEADLESS.log.length = 0;
  try {

    setPendingKit(opts.kit || null);
    startGame(true, classId);
    if (opts.weights) Object.assign(state.player.weights, opts.weights);
    let steps = 0;

    while (!state.runOver && (state.deaths || 0) < (opts.maxDeaths || 1) && steps++ < maxTicks) {

      if (opts.each) opts.each(state);
      if (opts.stopWhen && opts.stopWhen(state)) break;
      if (state.atCamp) {
        if (nextDrop()) { resolveDrop(botTakesDrop(state.player, nextDrop())); continue; }
        if (nextModOffer()) { takeMod(botTakesMod(nextModOffer())); continue; }
        if (state.hazardOffer) { pickHazard(state.hazardOffer[0]); continue; }
        moveOut();
        continue;
      }
      const p = state.player;

      if (p.points > 0) { adjustStat(allocate(p), 1); continue; }
      if (pendingTotal(p) > 0) { commitStats(); continue; }
      if (!state.combatActive) break;
      combatTick(SIM_DT);
    }
    const p = state.player;
    return {
      classId, won: !!state.won, wave: state.diedAt || state.wave,
      deaths: state.deaths || 0, kills: state.kills,

      level: p.level, turns: state.runTurns, damageDealt: Math.floor(state.damageDealt),
      stats: { str: p.str, instinct: p.instinct, speed: p.speed, vit: p.vit },
      derived: { atk: attackDamage(p), maxHp: p.maxHp, rate: +p.attackSpeed.toFixed(2) },
      steps,
      log: opts.keepLog ? HEADLESS.log.slice() : undefined
    };
  } finally {
    HEADLESS.on = wasOn;
    stopCombatLoop();
  }
}
