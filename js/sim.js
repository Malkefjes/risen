// Headless mode — simulateRun, no DOM, no timers
// ---- Headless mode -------------------------------------------
// Runs the real rules with no DOM and no timers, so a whole 15-wave run
// finishes in milliseconds instead of the minutes it takes to watch one.
//
// This is NOT a second implementation of combat. Every rule — initiative,
// damage, statuses, cooldowns, XP — runs exactly as it does on screen.
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

// ---- The two bots --------------------------------------------
// A FLOOR AND A CEILING, and nothing in between. There were three; the middle
// one ("greedy") was a frozen baseline kept so old commit messages stayed
// comparable, which meant carrying a third set of numbers forever to protect
// the readability of numbers nobody re-reads. Gone, along with the per-strain
// allocation plans that turned out to be deciding more than the piloting did.
//
// What is left is one question asked two ways: how far does this game go when
// nobody is thinking, and how far when somebody is? The gap is the reading.
//
//   DUMB     mashes. Presses a button at random with no idea what any of them
//            do, and throws its stat points wherever.
//   SMART    presses everything the moment it is available, spreads its points
//            evenly, and does exactly ONE clever thing: it holds whatever
//            answers a telegraph, and spends it on the telegraph.
//
// That one clever thing is the whole experiment. If holding an answer for the
// windup is worth a lot, this pair says so; if it is worth nothing, this pair
// says that too, and neither of them can say anything about whether the answer
// is GOOD, which is not a machine's call.
//
// A bot's choices come off Math.random (the rules stream), never
// cosmeticRandom: what the player does decides the outcome, so it belongs to
// the same stream every other rule reads.

// The four stats. A level grants BALANCE.player.pointsPerLevel (3) of them, and
// both allocators are called once PER POINT, not once per level.
const ROTATE_STATS = ['str', 'instinct', 'speed', 'vit'];

// ---- DUMB ----------------------------------------------------------------
// PRESSES A BUTTON AT RANDOM, cooldowns included. It does not look at the
// cards, so a dark button is as likely a target as a lit one — the press just
// does nothing when it lands on one, exactly as it does for a person jabbing
// at a disabled button, and the turn is still there to spend. Re-rolling the
// dead press is what the real UI does to you, so that is what this does.
//
// (Rejection-sampling a uniform pick until it lands on something usable is
// uniform over the usable buttons — written the long way anyway, because the
// short way reads as "picks a ready skill", which is a bot that knows what a
// cooldown is.)
function dumbPolicy(p) {
  const pressable = s => s.basic || s.cd <= 0;
  for (let jab = 0; jab < 40; jab++) {
    const btn = p.skills[Math.floor(Math.random() * p.skills.length)];
    if (btn && pressable(btn)) return btn;      // the press landed on a live button
  }
  return p.skills.find(s => s.basic) || p.skills[0];
}
// Points thrown wherever, one at a time.
function dumbAllocate() { return ROTATE_STATS[Math.floor(Math.random() * ROTATE_STATS.length)]; }

// ---- SMART ---------------------------------------------------------------
// Spends every point evenly and presses everything on cooldown, with ONE
// exception that it plays properly.
//
// Round-robin PER POINT, so a level's three points land on three different
// stats and the sheet stays even the whole way up. The old per-strain plan
// tables allocated per LEVEL against a 4-stat order, which meant a class whose
// plan named Vitality last had none of it until its fifth level — psy played
// all of zone 1 on a 100 HP bar and the bracket read that as psy being weak.
// A plan that decides the run more than the piloting does is not a bot, it is
// a build, and it belongs to whoever is playing.
function rotateAllocate(p) {
  p._alloc = ((p._alloc || 0) + 1) % ROTATE_STATS.length;
  return ROTATE_STATS[p._alloc];
}

// WHAT ANSWERS A TELEGRAPH. Read off the card, never by class name — four
// shapes, and the fourth was missed on the first pass with a measurable cost:
//
//   a stun          deletes the charge outright
//   a provoke       drags it out early, ordinary or spoiled
//   holdFor:'windup'  the card says so itself (base's brace)
//   a buff that SOFTENS INCOMING DAMAGE — bio's Chitin. Not declared as an
//     answer anywhere and easy to miss because it is also bio's poison
//     doubler, so the first version of this bot held nothing for bio and
//     answered 0% of 42 telegraphs while every other class answered 83-97%.
//     Found by measuring the answer rate rather than by reading the code,
//     which is the only way that gap shows up at all.
//
// Detected by asking the STATUS what it does (incomingMult below 1 means it
// takes the edge off a hit), so a defensive buff added later is held without
// touching this. These are the ONLY skills smart withholds, and it withholds
// them completely — never filler, at any health, against any enemy.
function softensIncoming(s) {
  const def = s.buff && STATUSES[s.buff];
  if (!def || typeof def.incomingMult !== 'function') return false;
  // Probed with the status as the skill would apply it; anything under 1 is
  // mitigation. A status whose power comes from elsewhere reads as 1 and is
  // correctly not treated as an answer.
  return def.incomingMult(null, Object.assign({}, def.defaults, { power: s.power })) < 1;
}
function isAnswer(s) {
  return !!(s.stun || s.type === 'provoke' || s.holdFor === 'windup' || softensIncoming(s));
}

// AND WHETHER IT WOULD ACTUALLY CONNECT. The point of holding an answer is
// spending it on the blow; an answer that whiffs is worse than one never held,
// because the hold cost every turn it sat unused AND the blow still lands.
// Three ways each answer can whiff, all of them checkable before the press:
//
//   a gated stun under its threshold  Traumatize below its DREAD count does not
//                                     stun, does not interrupt, and does not
//                                     even consume the stagger resist — the
//                                     gate returns before any of that. It is a
//                                     plain attack wearing an answer's name.
//   a brace cast too early            The brace covers the turns it is up for,
//                                     and the initiative gauges often hand you
//                                     two turns inside one telegraph. Thrown on
//                                     the first, it has expired by the swing.
//   a Provoke you cannot afford       Provoke buys the enemy its swing on the
//                                     spot. Into an armed resist that swing is
//                                     the telegraph itself, spoiled — worth
//                                     taking, but not on a bar that cannot
//                                     hold it.
//
// A stun into an armed resist is NOT a whiff: it spoils the charge, which is
// half the blow removed. It is the correct press when the clean one is
// unavailable, and it is the reason this bot never simply stands there.
function answerConnects(s, p, e) {
  if (s.stun) {
    if (s.dreadNeed && statusStacks(e, 'dread') < s.dreadNeed) return false;
    return true;                       // clean interrupt, or a spoil if resisted
  }
  if (s.type === 'provoke') {
    const incoming = e.stunImmune
      ? (e.damage || 0) * windupMultFor(e) * (BALANCE.enemy.windupSpoilFrac || 1)  // spoiled, now
      : (e.damage || 0);                                                          // baited, ordinary
    return incoming * 1.5 < p.hp;      // margin is for a crit landing on top
  }
  // Anything that answers by being UP when the blow lands — the brace, Chitin
  // — is cast on the turn the enemy actually swings, not the moment the charge
  // appears. The gauges often hand you two turns inside one telegraph, and a
  // 2-turn cover thrown on the first of them has expired by the swing.
  return forecastTurns(1)[0] === 'foe';
}

function smartPolicy(p) {
  const e = state.enemy;
  const ready = p.skills.filter(s => !s.basic && s.cd <= 0);
  const basic = p.skills.find(s => s.basic) || p.skills[0];

  // 1. ANSWER THE TELEGRAPH. The one habit this bot has. A charge is up, an
  //    answer is off cooldown, and it would connect — press it, whatever else
  //    is available, because nothing else on the bar is worth more than the
  //    biggest hit in the game not landing.
  if (e && e.windup) {
    const answer = ready.filter(isAnswer).find(s => answerConnects(s, p, e));
    if (answer) return answer;
  }

  // 2. EVERYTHING ELSE, ON COOLDOWN — except an answer, which is never spent
  //    on anything but rule 1. Held through a full bar, held at one HP, held
  //    against trash that has no telegraph at all. That is the experiment:
  //    what the discipline alone is worth.
  return ready.find(s => !isAnswer(s)) || basic;
}

// The registry, shaped so a bot IS a simulateRun opts object: pass it straight
// through as simulateRun('psy', BOTS.smart).
const BOTS = {
  dumb:  { name: 'dumb',  policy: dumbPolicy,  allocate: dumbAllocate },
  smart: { name: 'smart', policy: smartPolicy, allocate: rotateAllocate }
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
  // Defaults to SMART, which is the honest default now that there are only
  // two: a bare simulateRun('psy') should show what the class does when it is
  // played, not what it does when the buttons are mashed. Mashing is a
  // deliberate choice you pass in.
  const policy = opts.policy || smartPolicy;
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
      steps,
      log: opts.keepLog ? HEADLESS.log.slice() : undefined
    };
  } finally {
    HEADLESS.on = wasOn;
    _pendingStep = null;
    stopCombatLoop();
  }
}

