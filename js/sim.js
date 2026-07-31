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

// ---- The three bots ------------------------------------------
// THE POINT IS THE BRACKET, NOT ANY ONE NUMBER. One bot gives a single reading
// that stops discriminating the moment it saturates — when the greedy bot won
// 40/40 on three classes no enemy tuning could move, that number had stopped
// measuring the game. A floor and a ceiling say much more than either alone:
//
//   dumb high, skilled high   too easy — the run is winnable on autopilot
//   dumb low,  skilled high   skill-expressive, which is the target
//   dumb low,  skilled low    too hard
//   dumb ≈ skilled            NO SKILL EXPRESSION — the class plays itself,
//                             and this is the case a single bot cannot see
//
// Two rules keep the instrument honest. GREEDY IS FROZEN: every balance number
// in this repo's history was measured with it, so changing it would silently
// invalidate the comparisons in old commit messages. And SKILLED IS NOT
// OPTIMAL — deliberately. A searching bot would be a second implementation of
// the game's strategy that breaks on every kit change, and worse, it would
// encode one theory of how a class should be played and then confirm it.
// Skilled is a short list of things a human obviously does, readable in one
// screen. It is a floor on competence, not a model of mastery.
//
// A bot's choices come off Math.random (the rules stream), never
// cosmeticRandom: what the player does decides the outcome, so it belongs to
// the same stream every other rule reads.

// The four stats, declared here because two of the three allocators read it.
const ROTATE_STATS = ['str', 'instinct', 'speed', 'vit'];

// DUMB — mashes. Any ready skill at random, no reading of the fight at all,
// and points thrown wherever. The floor: whatever this wins, the game gives
// away for free.
function dumbPolicy(p) {
  const ready = p.skills.filter(s => !s.basic && s.cd <= 0);
  const pool = ready.concat(p.skills.filter(s => s.basic));
  return pool[Math.floor(Math.random() * pool.length)] || p.skills[0];
}
function dumbAllocate() { return ROTATE_STATS[Math.floor(Math.random() * ROTATE_STATS.length)]; }

// GREEDY — the original, and FROZEN (see above): spend the strongest thing
// available, else swing. Deliberately unclever, which is what lets it expose
// weaknesses a competent bot would paper over.
function greedyPolicy(p) {
  const usable = p.skills.filter(s => !s.basic && s.cd <= 0);
  return usable[0] || p.skills[0];
}
// Round-robin allocation, for the same reason.
function rotateAllocate(p) { return ROTATE_STATS[p.level % ROTATE_STATS.length]; }

// SKILLED — four habits, each one a thing any player picks up in a session.
// Nothing here knows a class by name; it reads the same fields the skill cards
// show, so a new kit is piloted without touching this.
//
// Is this spender worth firing yet? A bank exists to be spent at a payoff, and
// dumping Kill on one DREAD stack or Last Stand on one Resolve is how a good
// skill reads as a bad one. Under 60% of cap it waits — except on a nearly
// dead enemy, where everything goes in.
function bankUnderfed(p, skill, e) {
  if (e && e.maxHp > 0 && e.hp / e.maxHp < 0.25) return false;   // execute: dump it
  const enough = cap => Math.max(1, Math.ceil(cap * 0.6));
  if (skill.consumesDread)   return statusStacks(e, 'dread') < enough(P().dreadCap);
  if (skill.consumesResolve) return (p.resolve || 0) < enough(P().resolveCap);
  // Sym is deliberately absent: THORNS is not a wallet with a payoff to wait
  // for. Shed takes only what the heal needed, so there is no "too early" —
  // it is gated by rule 4 (never heal a full bar) like any other heal.
  return false;
}
function skilledPolicy(p) {
  const e = state.enemy;
  const ready = p.skills.filter(s => !s.basic && s.cd <= 0);
  const basic = p.skills.find(s => s.basic) || p.skills[0];
  const pick = f => ready.find(f);

  // 1. ANSWER THE TELEGRAPH — BUT ONLY IF IT ACTUALLY THREATENS YOU. A windup
  //    is the biggest hit in the game, and interrupting it deletes the hit
  //    outright, so a stun spent here beats a stun spent anywhere else. What a
  //    player does NOT do is burn a turn guarding a blow they can shrug: they
  //    read the telegraph against their own bar and keep attacking when it is
  //    survivable. Defending unconditionally is how the first version of this
  //    bot managed to play worse than one that mashed.
  if (e && e.windup) {
    const incoming = (e.damage || 0) * (BALANCE.enemy.windupMult || 1);
    const scary = incoming > p.hp * 0.35;
    // BAITING IS THE OTHER WAY TO ANSWER A TELEGRAPH — sym's way. Provoke does
    // not delete the heavy swing the way a stun does; it goads the charge out
    // early so it lands as an ordinary hit.
    //
    // THE TEST IS THE ORDINARY HIT AGAINST YOUR BAR, NOT AGAINST HALF OF IT.
    // Written as `damage < hp * 0.5` first, and it read as cowardice in the
    // transcript: at 28 HP the bot refused to bait an 18-damage swing, healed
    // to 52 instead, and ate the x5 for 90 on the next turn. Whenever you
    // survive the small hit, taking it is strictly better than letting the
    // heavy one land — the margin here is for a crit landing on top, and
    // nothing else.
    const canBait = !e.stunImmune && (e.damage || 0) * 1.5 < p.hp;
    const answer = (!e.stunImmune && pick(s => s.stun))
                || (canBait && pick(s => s.type === 'provoke'))
                || (scary && (pick(s => s.type === 'buff') || pick(s => s.type === 'heal')));
    if (answer) return answer;
  }

  // 2. DON'T DIE. Below a third, healing outranks damage — but not above it:
  //    a heal thrown at a nearly full bar is a turn the enemy got for free.
  if (p.hp / Math.max(1, p.maxHp) < 0.33) {
    const heal = pick(s => s.type === 'heal');
    if (heal) return heal;
  }

  // 3. HOLD THE STUN FOR THE TELEGRAPH, if this enemy telegraphs at all. This
  //    is the single habit that most separates a player from the greedy bot,
  //    which fires the stun on cooldown and has it unavailable when the heavy
  //    lands. Against trash that never winds up there is nothing to save for.
  //    A stun into an armed stagger resist is also just thrown away.
  const holdStun = !!(e && e.windupEvery > 0);
  const usable = ready.filter(s => {
    // 4. NEVER HEAL A FULL BAR. Heals are reached only by the two rules above,
    //    which is the difference between a heal and a filler: left in the
    //    general list, whatever sat earliest in the kit got cast on cooldown
    //    forever — Unmutated bandaged itself at full health every fourth turn
    //    and never won a run.
    if (s.type === 'heal') return false;
    if (s.stun && (holdStun || (e && e.stunImmune))) return false;
    // 5. SPEND A BANK AT ITS PAYOFF, not on arrival.
    if (bankUnderfed(p, s, e)) return false;
    // 6. DON'T INVITE A HIT YOU CANNOT AFFORD. Provoke buys the enemy a free
    //    swing, which is a trade only a healthy fighter should take. Rule 1 is
    //    the deliberate exception: there the swing is coming regardless, and
    //    baiting it out is what makes it smaller.
    if (s.type === 'provoke' && p.hp / Math.max(1, p.maxHp) < 0.5) return false;
    return true;
  });
  return usable[0] || basic;
}
// A declared plan per strain rather than a spread: the stats each class
// actually converts. Stated out loud so it can be argued with, which is the
// point of writing it down instead of hiding it in a heuristic.
//
// EVERY PLAN BUYS ALL FOUR STATS, leaning rather than specialising, and both
// halves of that were learned the hard way by this bracket:
//   - the first table skipped INSTINCT, written from pre-rework habit when it
//     meant 1.1% crit a point. Instinct is quadratic now, so skipping it cost
//     bio half its win rate.
//   - the second skipped SPEED, and that was worse: turn rate is a mitigation
//     stat wearing an offensive costume (see the balance header), so a plan
//     with no Speed hands the enemy every turn it wants. Unmutated went to 0%.
// Two rounds of the "skilled" bot losing to the one that mashes, which is the
// instrument doing its job — and a standing hint that a balanced spread is
// simply strong in this game.
const SKILLED_PLANS = {
  bio:  ['vit', 'str', 'instinct', 'speed'],      // outlast, and poison rides Attack Damage
  psy:  ['instinct', 'speed', 'str', 'vit'],      // fear comes from crits and dodges
  // Sym leans Vit first for two reasons at once: max HP is the innate share of
  // THORNS, and surviving longer is literally how the ramp gets fed. Speed is
  // last on purpose and it is the one plan where the last slot is a genuine
  // COST — more of your turns means proportionally fewer enemy swings, and
  // swings are food. It is still bought (see the note above), just last.
  sym:  ['vit', 'str', 'instinct', 'speed'],
  base: ['vit', 'str', 'instinct', 'speed']       // endure, then Last Stand
};
// THE FIRST ENTRY IN EVERY PLAN WAS DEAD, and had been since the plans were
// written. Points arrive with level 2 — level 1 grants none — so indexing by
// `level - 1` handed the first allocation to plan[1] and plan[0] was never
// reached at all. Every plan here has therefore been running one slot rotated:
// the three that read 'vit' first were spending their opening points on
// Strength, which is why a measured sym sat at vit 5 / 100 max HP through the
// whole of act 1 and read as a class that could not afford to be hit.
//
// Indexing off level - 2 puts the FIRST allocation on the FIRST named stat, so
// a plan finally means what it says. This moves skilled's historical numbers
// (greedy is the frozen one, deliberately — see tools/README.md), and it moves
// them for all four classes at once.
function skilledAllocate(p) {
  const plan = SKILLED_PLANS[p.class] || ROTATE_STATS;
  return plan[Math.max(0, p.level - 2) % plan.length];
}

// The registry, shaped so a bot IS a simulateRun opts object: pass it straight
// through as simulateRun('psy', BOTS.skilled).
const BOTS = {
  dumb:    { name: 'dumb',    policy: dumbPolicy,    allocate: dumbAllocate },
  greedy:  { name: 'greedy',  policy: greedyPolicy,  allocate: rotateAllocate },
  skilled: { name: 'skilled', policy: skilledPolicy, allocate: skilledAllocate }
};

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
      // runTurns, NOT turnNo: turnNo resets on every spawn, so reporting it
      // here labelled a run's length with the LAST FIGHT's turn count — the
      // bracket's "turns to win" column was measuring the final fight alone.
      // runTurns is the run-level counter the result screen already shows.
      level: p.level, turns: state.runTurns, damageDealt: Math.floor(state.damageDealt),
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

