// Headless mode — simulateRun, no DOM, no timers
// ---- Headless mode -------------------------------------------
// Runs the real rules with no DOM and no timers, so a whole 15-wave run
// finishes in milliseconds instead of the minutes it takes to watch one.
//
// This is NOT a second implementation of combat. Every rule — initiative,
// damage, statuses, banks, cooldowns, XP — runs exactly as it does on screen.
// The only things suppressed are the ones that draw or wait. A balance number
// measured here is therefore a number about the game, not about a model of it.
//
// Two costs are being removed, and the second one dominates:
//
//   DRAWING   floatText alone creates a DOM node and a 1.3s timer per number;
//             renderCombat rebuilds fighter panels whose <img> src is a
//             megabyte of base64. Thousands of those per run.
//   WAITING   the turn engine paces itself through setTimeout. Browsers clamp
//             nested timeouts to ~4ms, so a run with several hundred turns
//             cannot finish faster than seconds no matter how fast the rules
//             are. Headless replaces scheduling with a PUMP: a scheduled step
//             is stored, and simulateRun drains it in a loop. Iterative, not
//             recursive, so a long run cannot overflow the stack.
//
// Guarded functions return early rather than being swapped out, so reading any
// one of them shows why it is skipped without knowing this block exists.
const HEADLESS = {
  on: false,
  log: [],            // transcript captured in memory instead of the DOM
  logCap: 4000
};

// The step the turn engine has queued. Headless replaces the timer with this.
let _pendingStep = null;

// Drain queued steps until the run needs the player, ends, or stalls.
function pumpSteps(limit) {
  let n = 0;
  while (_pendingStep && n++ < (limit || 10000)) {
    const fn = _pendingStep;
    _pendingStep = null;
    fn();
    if (state.awaitingInput || state.runOver) break;
  }
  return n;
}

// Greedy default: spend the strongest thing available, else swing. Beats no
// policy at all and is deliberately unclever — a bot that plays well would
// hide exactly the weaknesses a balance sweep is looking for.
function greedyPolicy(p) {
  const usable = p.skills.filter(s => !s.basic && s.cd <= 0
    && !(s.requiresCharges && (p.charges || 0) < s.requiresCharges));
  return usable[0] || p.skills[0];
}
// Round-robin allocation, for the same reason.
const ROTATE_STATS = ['str', 'instinct', 'speed', 'vit'];
function rotateAllocate(p) { return ROTATE_STATS[p.level % ROTATE_STATS.length]; }

// One full run, start to death-or-victory.
//
//   simulateRun('psy')
//   simulateRun('sym', { allocate: () => 'vit', keepLog: true })
//
// opts.policy(player)   -> the skill to use on the player's turn
// opts.allocate(player) -> which stat to put the next point in
// opts.keepLog          -> return the transcript as an array of lines
// opts.stopWhen(state)  -> end early; for measuring a slice of a run rather
//                          than all of it (an act, the first boss, ...)
function simulateRun(classId, opts) {
  opts = opts || {};
  const policy = opts.policy || greedyPolicy;
  const allocate = opts.allocate || rotateAllocate;
  const maxSteps = opts.maxSteps || 100000;

  // Checked before anything is touched. startGame declines an unknown strain by
  // returning early, which leaves the PREVIOUS run's player in place — so
  // testing state.player afterwards would report the last simulation's result
  // as this one's.
  if (!CLASSES[classId]) return null;

  const wasOn = HEADLESS.on;
  HEADLESS.on = true;
  HEADLESS.log.length = 0;
  _pendingStep = null;
  try {
    startGame(true, classId);
    let steps = 0;
    // ADVANCE FIRST, THEN ACT. The bot only touches anything while the game is
    // waiting on the player, because that is the only moment a human can. An
    // earlier version spent level-up points at the top of the loop, which let
    // them land BEFORE the next wave spawned instead of after — and since the
    // between-fight heal is a share of max HP, allocating Vitality a moment
    // early changed how much it healed. The rules were identical; the driver
    // was playing at a moment no player can reach.
    while (!state.runOver && steps++ < maxSteps) {
      pumpSteps();
      if (state.runOver) break;
      if (opts.stopWhen && opts.stopWhen(state)) break;
      if (!state.awaitingInput) {
        if (!_pendingStep) break;                // nothing queued, nobody to ask
        continue;
      }
      const p = state.player;
      // One decision per pass, cheapest first, so each is taken with the sheet
      // the previous one produced.
      if (p.points > 0) { adjustStat(allocate(p), 1); continue; }
      if (pendingTotal(p) > 0) { commitStats(); continue; }
      if (state.talentOffers && state.talentOffers.picks && state.talentOffers.picks.length) {
        pickTalent(state.talentOffers.picks[0].id); continue;
      }
      const skill = policy(p);
      if (!skill) break;
      playerAct(skill);
    }
    const p = state.player;
    return {
      classId, won: !!state.won, wave: state.wave, kills: state.kills,
      level: p.level, turns: state.turnNo, damageDealt: Math.floor(state.damageDealt),
      bestCombo: state.bestCombo,
      stats: { str: p.str, instinct: p.instinct, speed: p.speed, vit: p.vit },
      derived: { atk: attackDamage(p), maxHp: p.maxHp, rate: +p.attackSpeed.toFixed(2) },
      bank: (function () { const b = bankOf(p.class); return b ? { name: b.name, cap: b.cap } : null; })(),
      steps,
      log: opts.keepLog ? HEADLESS.log.slice() : undefined
    };
  } finally {
    HEADLESS.on = wasOn;
    _pendingStep = null;
    stopCombatLoop();
  }
}

