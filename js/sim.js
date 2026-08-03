// Headless mode — simulateRun, no DOM, no timers
// ---- Headless mode -------------------------------------------
// Runs the real rules with no DOM and no timers, so a whole run finishes in
// milliseconds instead of the minutes it takes to watch one.
//
// This is NOT a second implementation of combat. Every rule — initiative,
// damage, statuses, cooldowns, XP — runs exactly as it does on screen, and only
// the things that draw or wait are suppressed. A balance number measured here is
// a number about the game, not about a model of it.
//
// The cost that dominates is WAITING: the turn engine paces itself through
// setTimeout, and browsers clamp nested timeouts to ~4ms, so a run of several
// hundred turns cannot finish faster than seconds however fast the rules are.
// Headless replaces scheduling with a PUMP — a scheduled step is stored and
// simulateRun drains it in a loop, iteratively, so a long run cannot overflow
// the stack.
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

// Drain queued steps until the run needs the player, ends, or stalls. A queued
// drop or offer counts as needing the player: on screen the spawn is a timer
// the mouse beats to the sidebar, so draining through it here would fit an item
// a whole wave later than a player does.
function pumpSteps(limit) {
  let n = 0;
  while (_pendingStep && n++ < (limit || 10000)) {
    const fn = _pendingStep;
    _pendingStep = null;
    fn();
    if (state.awaitingInput || state.runOver || nextDrop() || nextModOffer()) break;
  }
  return n;
}

// ---- The two bots --------------------------------------------
// A FLOOR AND A CEILING, and nothing in between — one question asked two ways:
// how far does this game go when nobody is thinking, and how far when somebody
// is? The gap is the reading.
//
//   DUMB     mashes. Presses a button at random with no idea what any of them
//            do, and throws its stat points wherever.
//   SMART    spreads its points evenly and presses what is worth pressing: it
//            holds a telegraph answer for the telegraph — but only against
//            something that can actually telegraph — it does not heal a full
//            bar, and it does not cash out a finisher with nothing banked.
//
// Neither can say whether the answer is GOOD, which is not a machine's call.
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
// does nothing when it lands on one, and the turn is still there to spend.
//
// (Rejection-sampling until the pick lands on something usable is uniform over
// the usable buttons — written the long way anyway, because the short way reads
// as a bot that knows what a cooldown is.)
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
// tables allocated per LEVEL against a 4-stat order, so a class whose plan named
// Vitality last had none of it until its fifth level. A plan that decides the
// run more than the piloting does is not a bot, it is a build.
function rotateAllocate(p) {
  p._alloc = ((p._alloc || 0) + 1) % ROTATE_STATS.length;
  return ROTATE_STATS[p._alloc];
}

// WHAT ANSWERS A TELEGRAPH. Read off the card, never by class name — four
// shapes:
//
//   a stun            deletes the charge outright
//   a provoke         drags it out early, ordinary or spoiled
//   holdFor:'windup'  the card says so itself (base's brace)
//   a buff that SOFTENS INCOMING DAMAGE — bio's Chitin. Detected by asking the
//     STATUS what it does (incomingMult below 1), so a defensive buff added
//     later is held without touching this. Missing this shape cost bio 0% of 42
//     telegraphs answered while every other class answered 83-97%.
//
// These are the ONLY skills smart withholds, and it withholds them completely —
// never filler, at any health, against any enemy.
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

// AND WHETHER IT WOULD ACTUALLY CONNECT. An answer that whiffs is worse than one
// never held: the hold cost every turn it sat unused AND the blow still lands.
// Three ways each can whiff, all checkable before the press:
//
//   a gated stun under its threshold  Traumatize below its DREAD count is a
//                                     plain attack wearing an answer's name.
//   a brace cast too early            initiative often hands you two turns
//                                     inside one telegraph, and a brace thrown
//                                     on the first has expired by the swing.
//   a Provoke you cannot afford       it buys the enemy its swing on the spot,
//                                     which is worth taking, but not on a bar
//                                     that cannot hold it.
//
// A stun into an armed resist is NOT a whiff: it spoils the charge, which is
// half the blow removed, and it is why this bot never simply stands there.
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

// ---- WHEN A CARD IS WORTH PRESSING ---------------------------------------
// Pressing everything the moment it lights up throws two cards away, and both
// are checkable off the card rather than by knowing which class you are:
//
//   A HEAL INTO A FULL BAR restores nothing and takes its cooldown with it, so
//   the heal is missing later when the bar is not full. Healing was measured at
//   68-91% of all the punishment any build absorbs, and 68-95% of deaths are
//   ordinary hits rather than telegraphs — attrition is what kills these runs,
//   and this is the button that answers attrition.
//
//   A SPENDER WITH NOTHING BANKED. Kill and Last Stand price themselves off a
//   pile they consume (perDreadPower per DREAD, perResolvePower per RESOLVE);
//   at zero stacks they are an ordinary hit on a five-turn cooldown.
//
// Neither is an attempt to find the optimal press. They are the two mistakes a
// person would never make, which is the whole difference the smart column is
// supposed to be measuring.

// The thresholds, in one object so they can be swept from outside without
// editing this file. Every one of them was picked by measuring, not by taste.
const SMART = {
  healLands: 0.80,   // this share of a heal must land...
  healPanic: 0.35,   // ...unless the bar is under this, where waste beats dying
  spendMin: 3,       // never cash a finisher at less than this
  spendDeep: 15      // ...and otherwise only when the pile is at least this deep
};

// What the heal would restore. Only the declared share of the anchor counts:
// sym's Shed tops up out of THORNS as well, but shedForHeal tears off only as
// many as the wound still needs, so that half can never be wasted.
function healAmount(s, p) {
  if (s.healFrac == null) return 0;
  return Math.max(1, Math.floor(healAnchorFor(p) * s.healFrac));
}
// SWEPT, AND IT MOVES NOTHING at today's heal numbers: eager (0.5/0.55) and
// strict (1.3/0.20) both landed within a wave of this, on every strain. Kept
// because a bot that heals a full bar is not a proxy for anybody, but do not
// credit it with a number — re-run the sweep before assuming it earns one.
function healWorthIt(s, p) {
  if (p.hp / Math.max(1, p.maxHp) <= SMART.healPanic) return true;
  return (p.maxHp - p.hp) >= healAmount(s, p) * SMART.healLands;
}

// A FINISHER IS FOR FINISHING, and that is the whole of this rule. Measured on
// the bot that pressed them on cooldown: base cashed Last Stand 17.7 times per
// 100 turns against a five-turn cooldown — nine opportunities in ten — and Last
// Stand spends ALL of its RESOLVE. RESOLVE is not a damage counter, it is base's
// damage reduction and the depth of every wound it opens, so the bot was
// resetting the class's own ramp every five turns for one big hit.
//
// So a spender is pressed on one of two conditions: the blow would drop the
// enemy, or the pile is deep enough that cashing it beats holding it.
//
// The damage estimate mirrors the pipeline's shape rather than calling into it
// — a bot's guess about its own next press, not a number shown to anybody, so
// it is allowed to be approximate in a way a card is not.
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
  return p.atkPower * mult;
}
function spenderWorthIt(s, p, e) {
  if (!s.consumesDread && !s.consumesResolve && !s.consumesPressure) return true;
  const stacks = spendStacks(s, p, e);
  if (stacks < SMART.spendMin) return false;
  if (e && spenderDamage(s, p, e) >= e.hp) return true;   // it finishes — take it
  // NOT INTO A RAISED GUARD. A finisher spends a pile it cannot get back, so
  // cashing it while the target is braced (the GUARD verb's fortify) throws
  // away the half the guard eats. Read off the STATUS, not the verb's name,
  // so anything that softens incoming damage is respected for free.
  if (e && statusMult(e, 'incomingMult', { attacker: p }) < 1) return false;
  return stacks >= SMART.spendDeep;
}

function worthPressing(s, p, e) {
  if (s.healFrac != null && !healWorthIt(s, p)) return false;
  return spenderWorthIt(s, p, e);
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

  // 2. AGAINST SOMETHING THAT NEVER TELEGRAPHS, AN ANSWER IS JUST A CARD.
  //    Trash carries windupEvery 0 — it has no charge to interrupt, ever — so
  //    holding a stun or a brace against one is hoarding against a threat that
  //    cannot arrive. The discipline is kept exactly where it is paid for:
  //    bosses and elites do telegraph, and they still never see these cards
  //    spent on anything but rule 1.
  //
  //    Measured, even spread, 60 runs a cell: psy 12 -> 19, base 22 -> 27,
  //    bio 12 -> 13, sym unchanged. Spending answers against EVERYTHING instead
  //    was tried and thrown out — it cost base 8 waves and sym 5, because a
  //    brace spent early and a Provoke that buys a swing for nothing are both
  //    straight losses.
  const neverTelegraphs = !e || !(e.windupEvery > 0);
  const pool = neverTelegraphs ? ready : ready.filter(s => !isAnswer(s));

  //    A card held back by worthPressing is NOT skipped for the turn — the
  //    search falls through to the next ready card and then to the basic, which
  //    is what a person does while waiting for a finisher to be worth cashing.
  return pool.find(s => worthPressing(s, p, e)) || basic;
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
      // THE QUEUES COME BEFORE THE CLOCK. Neither holds the fight any more, so
      // on screen they are answered in the gap between the kill and the next
      // spawn — the mouse is already on the sidebar. Draining a scheduled step
      // first would fit the item one wave later than a player does, and fitting
      // it changes the sheet the next fight opens on.
      // The bot answers a drop the naive way (take it if it outscores what is
      // fitted) and always takes the first Modification: the OFFER is a rules
      // draw, the choice must not be a second one. Neither draws RNG, so both
      // bots share them — see botTakesDrop / botTakesMod.
      if (nextDrop()) {
        resolveDrop(botTakesDrop(state.player, nextDrop()));
        continue;
      }
      if (nextModOffer()) {
        takeMod(botTakesMod(nextModOffer()));
        continue;
      }
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

