// Turn engine, damage pipeline, kill/spawn, skills UI
// ---- Turn engine ---------------------------------------------
// The old rAF loop advanced two attack timers by dt. That is an initiative
// gauge driven by wall-clock. Here the same gauges are advanced in discrete
// jumps to whoever fills next, so attackSpeed keeps its exact meaning:
// 2.30 against 0.52 is still ~4 actions to their 1. No new speed rule.
function startCombatLoop() {
  stopCombatLoop();
  state.combatActive = true;
  updateTurnInfo();
  if (state.awaitingInput) { renderSkills(); return; }   // waiting on the player
  if (state.pendingEnemyAct) { scheduleTurn(enemyAct, turnDelay(380)); return; }
  if (state.awaitingSpawn)   { scheduleTurn(doSpawn, turnDelay(220)); return; }
  scheduleTurn(nextTurn, 30);
}
function stopCombatLoop() {
  state.combatActive = false;
  _pendingStep = null;
  clearRevealTimers();
  // A SCENE BELONGS TO A FIGHT, so it does not outlive one. Nothing tore it
  // down except its own two exits, and the ways OUT of a run — new game, quit
  // to menu, the run ending — all come through here instead: quitting from a
  // scene and starting a fresh run left the scientist's portrait and dialogue
  // box on screen over the new fight, `scene-on` still hiding both fighters and
  // the skill row, and `_scene` still holding the spacebar. Measured on
  // 2026-08-02ae by quitting mid-scene: the new run came up inside the old one.
  teardownScene();
  if (state.turnTimer) { clearTimeout(state.turnTimer); state.turnTimer = null; }
}
// FAST TURNS setting just compresses the pacing between actions.
const turnDelay = ms => Math.round(ms * BALANCE.turnPace);
function scheduleTurn(fn, ms) {
  // Headless: hand the step to the pump instead of the clock. Same ordering,
  // none of the waiting.
  if (HEADLESS.on) { _pendingStep = fn; return; }
  if (state.turnTimer) clearTimeout(state.turnTimer);
  state.turnTimer = setTimeout(() => { state.turnTimer = null; fn(); }, ms);
}

// Whose turn it is now, then who is queued behind them. Your half is white and
// the enemy's is enemy red, so the line is readable at a glance without parsing
// the words — and stays the same colour whichever strain you are playing.
function updateTurnInfo() {
  if (HEADLESS.on) return;
  const ti = document.getElementById('turn-info');
  if (!ti) return;
  const plain = txt => { ti.textContent = txt; };
  if (!state.combatActive) return plain('STANDING BY');
  if (state.awaitingSpawn) return plain('INCOMING');

  const foeWord = (state.enemy && state.enemy.isBoss) ? 'BOSS' : 'ENEMY';
  const add = (text, cls) => {
    const s = document.createElement('span');
    if (cls) s.className = cls;
    s.textContent = text;
    ti.appendChild(s);
    return s;
  };
  const side = (text, who) => add(text, 'turn-side ' + (who === 'you' ? 'you' : 'enemy'));

  ti.textContent = '';
  // Turn-based: the turn belongs to somebody at all times, so this is a
  // straight either/or. It deliberately still reads YOUR TURN during the beat
  // where your action is resolving — the turn is still yours until the next
  // actor is picked, and there is no third state to name.
  if (state.active && !state.active.isPlayer) {
    side(foeWord + ' TURN', 'foe').classList.add('turn-now');
  } else {
    side('YOUR TURN', 'you').classList.add('turn-now');
  }

  const fc = forecastTurns(3);
  if (!fc.length) return;
  add('·', 'turn-sep');
  add('UPCOMING:', 'turn-upcoming');
  fc.forEach((who, i) => {
    if (i) add('→', 'turn-arrow');
    side(who === 'you' ? 'YOU' : foeWord, who);
  });
}

// Read the initiative gauges forward without mutating them, so the player
// always knows whether another turn is coming before the enemy's — the
// difference between racing a windup and answering it.
function forecastTurns(n) {
  const p = state.player, e = state.enemy;
  if (!p || !e || e._defeated || e.hp <= 0 || p.hp <= 0) return [];
  let pm = p.meter || 0, em = e.meter || 0;
  const ps = effectiveAps(p), es = effectiveAps(e);
  // Returns neutral 'you'/'foe' tokens; updateTurnInfo owns the wording and the
  // colour, so the label exists in exactly one place.
  const out = [];
  for (let i = 0; i < n; i++) {
    const tp = (1 - pm) / ps, te = (1 - em) / es;
    if (tp <= te + 1e-9) { out.push('you'); em += tp * es; pm = 0; }   // ties to the player
    else { out.push('foe'); pm += te * ps; em = 0; }
  }
  return out;
}

function advanceToNextActor() {
  const units = [state.player, state.enemy].filter(u => u && u.hp > 0 && !u._defeated);
  if (!units.length) return null;
  let best = null, bestT = Infinity;
  for (const u of units) {
    const t = (1 - (u.meter || 0)) / effectiveAps(u);
    if (t < bestT - 1e-9) { bestT = t; best = u; }
    else if (Math.abs(t - bestT) < 1e-9 && u.isPlayer) best = u;   // ties to the player
  }
  for (const u of units) u.meter = (u.meter || 0) + bestT * effectiveAps(u);
  best.meter -= 1;
  return best;
}

function nextTurn() {
  if (!state.combatActive) return;
  const p = state.player;
  if (!p || p.hp <= 0) { stopCombatLoop(); endRun(); return; }
  if (state.awaitingSpawn) { scheduleTurn(doSpawn, turnDelay(BALANCE.spawnDelay * 1000)); return; }
  const e = state.enemy;
  if (!e || e._defeated) return;

  const actor = advanceToNextActor();
  if (!actor) return;
  state.active = actor;

  // Header BEFORE the start-of-turn tick, so a poison that kills lands under
  // the turn it belonged to instead of orphaned above the next one.
  state.turnNo++;
  logTurn(actor);

  if (tickTurnStart(actor)) return;          // poison finished someone off

  // Stun is spent here rather than by the generic duration tick above: the turn
  // it eats IS its tick, so a 1-turn stun costs exactly one turn no matter how
  // the initiative gauges happen to line up.
  const stun = getStatus(actor, 'stun');
  if (stun) {
    stun.duration--;
    // The event before the removal it causes, so the transcript reads in the
    // order things happened rather than reporting the consequence first.
    logEvent('STUNNED', actor, 'turn lost',
             [stun.duration > 0 ? Math.ceil(stun.duration) + 't left' : 'last turn']);
    if (stun.duration <= 0) removeStatus(actor, 'stun', 'duration spent');
    updateUnitCard(actor); updateTurnInfo(); renderSkills();
    scheduleTurn(nextTurn, turnDelay(480));
    return;
  }

  if (actor.isPlayer) {
    state.awaitingInput = true;
    state.pendingEnemyAct = false;
    setCharPose(actor, 'ready');
  } else {
    state.awaitingInput = false;
    state.pendingEnemyAct = true;
    setCharPose(state.player, 'ready');
    scheduleTurn(enemyAct, turnDelay(480));
  }
  updateTurnInfo(); renderSkills();
}

// Start of a unit's own turn: statuses bite (poison, regen, anything with an
// onTurnStart), durations drop, player cooldowns tick and regen lands.
// Everything that used to be per-second is per-turn here.
function tickTurnStart(unit) {
  if (tickStatuses(unit)) {                  // a tick was lethal
    if (!unit.isPlayer) onEnemyDefeated();
    else { stopCombatLoop(); endRun(); }
    return true;
  }

  // THE SECOND CLOCK: what this unit has DONE to the other one. Marks tick on
  // the turn of whoever planted them (see tickStatuses), so bio's rot and
  // base's wound run on the player's turns — the same clock psy's siphon has
  // always used — and an elite's venom runs on the enemy's. Ailment damage is
  // metered by the attacker's tempo now, which is what makes Speed mean the
  // same thing for a DoT class as it does for everyone else.
  const foe = unit.isPlayer ? state.enemy : state.player;
  if (foe && foe.hp > 0 && !foe._defeated && tickStatuses(foe, 'inflicted')) {
    if (!foe.isPlayer) onEnemyDefeated();
    else { stopCombatLoop(); endRun(); }
    return true;
  }

  // ENRAGE: the race clock ticks on its OWN turns — stunning it does not slow
  // the rage, which is the point: control buys turns, never time.
  if (!unit.isPlayer && unit.verb === 'enrage') {
    unit._enrageTicks = (unit._enrageTicks || 0) + 1;
    const V = ENEMY_VERBS.enrage;
    if (unit._enrageTicks % V.every === 0) {
      applyStatus(unit, 'enrage', { stacks: 1, power: V.perStack });
      floatText(unit, 'ENRAGED', 'note');
    }
  }

  if (unit.isPlayer) {
    unit.skills.forEach(s => { if (!s.basic && s.cd > 0) s.cd--; });
    state.fightTurns++;
    state.runTurns = (state.runTurns || 0) + 1;
    // High-water mark of the strain number, for the result screen. Sampled at
    // the top of your turn, which is the moment the readout shows.
    const sn = strainNumberNow(unit);
    if (sn > (state.peakStrain || 0)) state.peakStrain = sn;
    // VITALITY'S FAUCET. A share of the anchor per turn, from points above the
    // starting sheet — silent at full HP, a floater and a line when it works,
    // the same shape REGEN follows.
    if (unit.regen > 0 && unit.hp < unit.maxHp) {
      const heal = Math.max(1, Math.floor(healAnchorFor(unit) * unit.regen));
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + heal);
      floatText(unit, unit.hp - before, 'heal');
      logHeal('RECOVERY', unit, unit.hp - before,
              [Math.round(unit.regen * 100) + '% of ' + logNum(healAnchorFor(unit)) + ' per turn']);
    }
    // THE SIPHON — psy feeds on fear while it sits on the enemy: each DREAD
    // stack drips a share of max HP at the start of your turn. Ticks on YOUR
    // turns so it scales with the turn advantage the slow already bought.
    // Follows REGEN's shape: skipped silently at full HP, a floater and a log
    // line when it drinks, so the drip is visible without being noise.
    const foe = state.enemy;
    if (unit.class === 'psy' && unit.hp < unit.maxHp && foe && foe.hp > 0 && !foe._defeated) {
      const stacks = statusStacks(foe, 'dread');
      if (stacks > 0) {
        const heal = Math.max(1, Math.floor(healAnchorFor(unit) * (P().dreadSiphonFrac || 0) * stacks));
        const before = unit.hp;
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        floatText(unit, unit.hp - before, 'heal');
        logHeal('SIPHON', unit, unit.hp - before, [
          'DREAD ×' + stacks,
          logNum(unit.hp) + '/' + logNum(unit.maxHp)
        ]);
      }
    }
  }
  updateUnitCard(unit);
  return false;
}

// The player spends their turn. Every action ends it — there is no auto-attack.
function playerAct(skill) {
  const p = state.player;
  if (!state.combatActive || !state.awaitingInput) return;
  if (!p || p.hp <= 0 || !skill) return;
  if (!skill.basic && skill.cd > 0) return;
  const needsEnemy = skill.target !== 'self';
  if (needsEnemy && (!state.enemy || state.enemy.hp <= 0 || state.enemy._defeated)) return;

  state.awaitingInput = false;
  // Counted here rather than in fireSkill: this is the point a press has passed
  // every guard and is definitely spending the turn, so the tally matches what
  // the player experienced pressing.
  state.skillUses = state.skillUses || {};
  state.skillUses[skill.id] = (state.skillUses[skill.id] || 0) + 1;
  fireSkill(p, skill, needsEnemy ? state.enemy : p);
  updateTurnInfo(); renderSkills();

  if (p.hp <= 0) return;                                   // endRun already fired
  if (!state.enemy || state.enemy._defeated) return;       // spawn already scheduled
  scheduleTurn(nextTurn, turnDelay(480));
}

function enemyAct() {
  if (!state.combatActive) return;
  state.pendingEnemyAct = false;
  const e = state.enemy, p = state.player;
  if (!p || p.hp <= 0) { stopCombatLoop(); endRun(); return; }
  if (!e || e._defeated) { scheduleTurn(nextTurn, turnDelay(200)); return; }

  // Boss telegraph: every Nth action is a windup instead of a swing. The
  // windup turn deals nothing — it exists to hand the player a decision:
  // cancel it (stun), brace for it (heal/spines), or race it (attack anyway).
  // Stunned turns never reach this code (nextTurn consumes them), so the
  // cadence pauses under stun rather than skipping a windup.
  if (e.windupEvery > 0 && !e.windup) {
    e.actionCount = (e.actionCount || 0) + 1;
    if (e.actionCount % (e.windupEvery || BALANCE.enemy.windupEvery) === 0) {
      e.windup = true;
      e.windupSpoiled = false;               // a fresh charge is a whole one
      logEvent('WINDUP', e, 'next strike ×' + windupMultFor(e),
               ['action ' + e.actionCount + ' of every ' + e.windupEvery]);
      // GUARD: it charges behind its shield — the free turn a telegraph hands
      // you costs double to spend on damage. Duration 1 on its own clock, so
      // the fortify expires exactly as the heavy lands.
      if (e.verb === 'guard')
        applyStatus(e, 'fortify', { duration: 1, power: ENEMY_VERBS.guard.power });
      const fig = getFigureForUnit(e);
      if (fig) fig.style.filter = 'brightness(1.35)';
      updateUnitCard(e); updateTurnInfo(); renderSkills();
      scheduleTurn(nextTurn, turnDelay(480));
      return;
    }
  }

  // FLURRY: every Nth ordinary action is several smaller strikes — more total
  // damage and twice the on-hit economy, on both sides of the exchange. Never
  // on a heavy: the telegraph stays one blow with one answer.
  const V = ENEMY_VERBS.flurry;
  if (e.verb === 'flurry' && !e.windup && e.actionCount % V.every === 0) {
    for (let i = 0; i < V.hits; i++) {
      if (!state.combatActive || p.hp <= 0 || e.hp <= 0 || e._defeated) break;
      enemySwing(e, { scale: V.scale });
    }
  } else {
    enemySwing(e);
  }
  updateTurnInfo(); renderSkills();

  if (p.hp <= 0) return;
  if (e._defeated) return;                                 // thorns killed it
  scheduleTurn(nextTurn, turnDelay(480));
}

function doSpawn() {
  if (!state.combatActive) return;
  spawnEnemy();
  if (!state.player || state.player.hp <= 0) return;
  if (state.enemy && state.enemy._defeated) return;        // overflow killed it too
  scheduleTurn(nextTurn, turnDelay(260));
}

// WHAT A TELEGRAPH IS WORTH. Three things can set it, most specific first: the
// ACT it happens in, then whether it is an elite rather than a boss, then the
// table's default. A boss telegraph is the fight; an elite telegraph is a skill
// check you meet a dozen times a run; and an act-2 telegraph lands on a bar
// that stopped growing while enemy damage did not — see the act-2 windupMult
// note in ZONES for the measurement that forced the override.
function windupMultFor(e) {
  const E = BALANCE.enemy;
  const zone = (e && e.zone) ? ZONES.find(z => z.num === e.zone) : null;
  if (e && e.elite && !e.isBoss)
    return (zone && zone.eliteWindupMult) || E.eliteWindupMult || E.windupMult;
  return (zone && zone.windupMult) || E.windupMult;
}

// opts carries what a PROVOKED swing changes: it cannot be evaded, and (when
// the charge was successfully baited) it does not carry the windup multiplier
// either — see provokeSwing.
function enemySwing(e, opts) {
  const p = state.player;
  if (!p || p.hp <= 0) return;
  state.enemyActions = (state.enemyActions || 0) + 1;   // real swings only; windup/stun turns never reach here
  let mult = 1;
  let spoiled = false;
  if (e.windup && !(opts && opts.ordinary)) {
    // A SPOILED CHARGE STILL COMES, SMALLER. Answering a telegraph into an
    // armed stagger resist used to buy nothing at all; now it knocks a share
    // out of the blow. The resist keeps its one job — the heavy is still on
    // its way and no amount of CC stops it — without the answer being deleted.
    spoiled = !!e.windupSpoiled;
    mult = windupMultFor(e) * (spoiled ? (BALANCE.enemy.windupSpoilFrac || 1) : 1);
    e.windup = false;
    e.windupSpoiled = false;
    const fig = getFigureForUnit(e);
    if (fig) fig.style.filter = '';
  }
  const dealt = applyEnemyDamage(e, p, mult * ((opts && opts.scale) || 1), Object.assign({}, opts, { spoiled }));
  if (dealt > 0) playAttackAnim(e, p, true);

  if (e.elite && e.elite.lifesteal && dealt > 0) {
    const heal = Math.floor(dealt * e.elite.lifesteal);
    if (heal > 0) { e.hp = Math.min(e.maxHp, e.hp + heal); floatText(e, heal, 'heal'); }
  }
  // `poisonHits` is the unit-level twin of the venomous affix: an enemy that
  // rots you without being an elite. The scientist works in toxins.
  if ((e.poisonHits || (e.elite && e.elite.poison)) && dealt > 0) {
    applyStatus(p, 'poison', { stacks:1, perStack: Math.max(1, Math.floor(e.damage*0.20)) });
  }

  updateUnitCard(p); updateUnitCard(e);
  if (p.hp <= 0) { stopCombatLoop(); endRun(); return; }
  if (e.hp <= 0 && !e._defeated) onEnemyDefeated();
}

// ---- Damage --------------------------------------------------
// BIO'S RAMP, VALUED. What the rot on a target is ticking for right now — the
// same number the pile pays each of your turns, so a card that reads a share of
// it cannot disagree with what the player watches land.
function getPoisonDamage(e) {
  const st = getStatus(e, 'poison');
  if (!st) return 0;
  return Math.floor((st.perStack || 1) * (st.stacks || 0));
}

function getThornsDamage(p) {
  if (!p || !(p.thorns > 0)) return 0;
  return Math.floor(p.thorns * statusMult(p, 'thornsMult'));
}

// SYM'S RAMP. Thorns is the number and it grows — every hit taken feeds it,
// permanently, for the rest of the run. Routed through one function for the
// same reason gainResolve exists beside it: a number that climbs silently is one the
// owner cannot feel climbing, so every gain is a floater and a log line naming
// what fed it. Recomputes the sheet immediately, which is what lets the spines
// that fire back on THIS exchange already be the bigger ones.
function growThorns(p, amount, why) {
  if (!p || p.class !== 'sym' || !(amount > 0) || p.hp <= 0) return 0;
  p.thornsGrown = (p.thornsGrown || 0) + amount;
  applyDerivedStats(p);
  floatText(p, '+' + amount + ' THORNS', 'tally');
  logEvent('THORNS +' + amount, null, '(' + formatNum(p.thorns) + ')', [why]);
  updateUnitCard(p);
  return amount;
}

// POISON ON THE PLAYER HAD NO EXIT. It is permanent and uncapped by design —
// bio needs that — but nothing in the game removed a stack, so a venomous elite
// was a death sentence you could only outrun. Measured 2026-08-02af: top killer
// for base (70% of its elite deaths), sym (56%), bio (50%), psy's second (39%).
// Every strain's sustain button is now also the way off it.
//
// PLAYER ONLY. Bio's rot lives on the enemy and must never be cleansed by one
// of these.
function cleansePoison(unit, n, why) {
  if (!unit || !unit.isPlayer || !(n > 0)) return 0;
  if (statusStacks(unit, 'poison') <= 0) return 0;
  const took = shedStacks(unit, 'poison', n, why);
  if (took > 0) floatText(unit, '−' + took + ' POISON', 'tally');
  return took;
}

// UNAUGMENTED'S RAMP, and growThorns' sibling — the strain's number going up.
// Resolve is a status now rather than a pipped wallet (see the RESOLVE block in
// BALANCE), so applyStatus does all the accounting, the stacking and the log
// line, exactly as it does for DREAD and POISON. What this adds is the FLOATER:
// base gains Resolve on almost every turn of a fight, and a ramp the player
// cannot see climbing is a ramp they do not feel. The pipped bank used to carry
// that job.
function gainResolve(p, amount, why) {
  if (!p || p.class !== 'base' || !(amount > 0) || p.hp <= 0) return 0;
  applyStatus(p, 'resolve', { stacks: amount });
  // Recomputed because the sheet DEPENDS on the number that just moved: bleed
  // depth rides held Resolve, so without this the readout would advertise a
  // shallower cut than the next Strike is about to make.
  applyDerivedStats(p);
  floatText(p, '+' + amount + ' RESOLVE', 'tally');
  return amount;
}

// What one hit is worth. Flat growth plus one more per big-hit slice of max HP,
// capped — so a x5 telegraph eaten on purpose is a feast without being a
// jackpot that makes every other exchange pointless.
function thornsGrowthFor(p, damage) {
  const B = P();
  // WHAT THE HIT COST YOU, not that it happened. Counting hits fed a 279-damage
  // blow at wave 45 exactly as much as a 36-damage one at wave 5, so the ramp
  // sat flat while enemy damage grew 4.5x across the run: measured on
  // 2026-08-02af, a real sym banked ~80 thorns by wave 20 and needed ~300 to
  // beat the wave-35 boss. Reading the share of the bar is what makes eating a
  // telegraph on purpose still pay at wave 40.
  const share = Math.max(0, damage) / Math.max(1, p.maxHp);
  // Sym's second term reads VITALITY: a bigger frame carries more spine.
  const bonus = statBonusStacks(p, 'vit', B.thornsPerVit);
  return Math.max(B.thornsPerHit, Math.round(B.thornsPerHit + share * B.thornsPerBar)) + bonus;
}

// SHED — sym's sustain, and the one place a run-permanent ramp can be spent.
// THE FRACTION IS A CEILING, NOT A PRICE: the shed takes only as many thorns as
// the heal actually needed, so a number that has run away makes Shed cheap in
// proportion instead of absurd (a percentage of a huge number would buy healing
// that max HP cannot hold — see the balance header). Only GROWN thorns are
// spendable; the innate share of max HP is a floor, so shedding can never leave
// you blunt.
function shedForHeal(p, skill, already, notes, critMult) {
  // What is still standing THIS FIGHT: grown minus already torn. Torn spines
  // regrow at the next spawn (2026-08-03f) — the cost is per-fight, so the
  // heal never eats the run's progression.
  const grown = Math.max(0, (p.thornsGrown || 0) - (p.thornsShedded || 0));
  if (grown <= 0) { notes.push('nothing standing to shed'); return 0; }
  // What a thorn is WORTH is sustain, so it prices off the anchor. What you are
  // MISSING is a fact about your actual bar and stays on maxHp — a wide sym
  // still has a wide hole to fill, it just no longer fills it faster for being
  // wide.
  // The crit rides the exchange RATE, not the count: each spine is worth more,
  // so the wound needs fewer of them. Passed in rather than rolled again — one
  // press is one roll.
  const perThorn = Math.max(1, Math.floor(healAnchorFor(p) * (skill.hpPerThorn || 0) * (critMult || 1)));
  const missing = Math.max(0, p.maxHp - p.hp - already);
  // At least one whenever anything is grown: floor()ing the cap alone would
  // make Shed a plain heal for the whole of zone 1, which reads as the skill
  // being broken rather than as sustain being tight.
  const cap = Math.max(1, Math.floor(grown * (skill.capFrac || 0.25)));
  const shed = Math.max(0, Math.min(Math.ceil(missing / perThorn), cap, grown));
  if (shed <= 0) { notes.push('no THORNS needed'); return 0; }
  p.thornsShedded = (p.thornsShedded || 0) + shed;
  applyDerivedStats(p);
  notes.push('SHED ' + shed + ' THORNS (' + formatNum(p.thorns) + ' left, regrow next fight)');
  return shed * perThorn;
}

// PROVOKE — the class's verb, and the only button in the game that spends your
// turn to buy the ENEMY a turn. You bare your guard: the swing lands (no evade
// roll — you do not dodge a hit you invited), the spikes take it, and you grow.
//
// Against a charged telegraph it is sym's answer to the windup, and a different
// one from psy's on purpose: a stun DELETES the heavy swing, Provoke goads it
// out early so it comes as an ordinary one. It shares stun's stagger-resist rule
// so it cannot lock a boss out of its telegraph forever.
function provokeSwing(p, e, skill) {
  if (!e || e.hp <= 0 || e._defeated) return;
  // ordinary: a BAITED charge comes out as a plain swing. A SPOILED one does
  // not — see below.
  let ordinary = true;
  if (e.windup && !e.stunImmune) {
    e.windup = false;
    e.windupSpoiled = false;
    const fig = getFigureForUnit(e);
    if (fig) fig.style.filter = '';
    e.stunImmune = true;
    floatText(e, 'BAITED', 'note');
    logEvent('BAITED', e, 'windup spent early', ['stagger resist now armed']);
  } else if (e.windup) {
    // THE SHRUG USED TO PUNISH TWICE. The charge held AND the swing you bought
    // came anyway, so a resisted Provoke fed the enemy a free ordinary hit and
    // left the heavy still on its way — you paid a turn to be hit an extra
    // time before the thing that kills you. Now the resist SPOILS the charge
    // and drags it out right here: you eat the heavy at the moment you chose,
    // at a share of its size, with your spines already up and the blow
    // feeding growth as a big hit. The class asked to be hit; being hit is the
    // answer, not a bill on top of it.
    e.stunImmune = false;
    e.windupSpoiled = true;
    ordinary = false;
    floatText(e, 'SPOILED', 'note');
    logEvent('CHARGE SPOILED', e, 'dragged out early, and smaller',
             ['resist consumed', '×' + BALANCE.enemy.windupSpoilFrac + ' of the telegraph']);
  }
  // Grow BEFORE the swing: you raise yourself to meet it, so the thorns that
  // answer this hit are already the bigger ones.
  growThorns(p, skill.growBonus || 0, skill.name);
  enemySwing(e, { unevadable: true, ordinary });

  // THE LASH (2026-08-03f). The invited swing is answered with the whole wall:
  // full THORNS × lashMult, on top of the passive spines that already fired.
  // This is the ramp's on-demand payoff — read, never spent — and it rides
  // getThornsDamage, so Raise Spines' ×2 flows straight into it. No crit roll:
  // like Counterpunch's counter, a triggered answer is not an action.
  if (skill.lashMult && p.hp > 0 && e.hp > 0 && !e._defeated) {
    const lash = Math.max(1, Math.floor(getThornsDamage(p) * skill.lashMult));
    const before = e.hp;
    e.hp = Math.max(0, e.hp - lash);
    creditDamage('Provoke', lash);
    if (e.hp <= 0) state._lastOverkill = Math.max(0, lash - before);
    floatText(e, lash, 'damage');
    logDamage('LASH', e, lash, [
      'THORNS ×' + skill.lashMult,
      logNum(e.hp) + '/' + logNum(e.maxHp) + ' left'
    ]);
    playAttackAnim(p, e, true, skill);
    updateUnitCard(e);
    // A lash kill falls through to fireSkill's tail, which already asks
    // whether the enemy died during the cast.
  }
}

// Enemy -> player. Enemies use a flat designed damage number, not a stat formula.
// mult carries the boss windup multiplier; evade and block still apply, so
// every strain's defenses answer the big hit in its own way.
function applyEnemyDamage(e, p, mult, opts) {
  // Anything on the attacker that changes what it hits for (weak, empower)
  // lands before the roll; anything on the defender that changes what it takes
  // (vulnerable, fortify) lands after the crit, alongside the other mitigation.
  const notes = [];
  // A spoiled heavy says so in the log AND on the floater: the number is
  // smaller than the telegraph advertised, and the player has to be able to
  // tell "my answer worked partially" from "the boss rolled low".
  const heavyN = mult % 1 ? mult.toFixed(1) : mult;
  const label = (mult && mult > 1)
    ? ((opts && opts.spoiled ? 'SPOILED ×' : 'HEAVY ×') + heavyN)
    : 'Attack';
  notes.push(...statusNotes(e, 'outgoingMult', { target: p }));
  let dmg = Math.max(1, Math.floor(e.damage * (mult || 1) * statusMult(e, 'outgoingMult', { target: p })));
  if (opts && opts.unevadable) notes.push('GUARD BARED');
  if (Math.random() < e.critChance) { dmg = Math.floor(dmg * e.critMult); notes.push('CRIT ×' + e.critMult.toFixed(1)); }
  notes.push(...statusNotes(p, 'incomingMult', { attacker: e }));
  dmg = Math.floor(dmg * statusMult(p, 'incomingMult', { attacker: e }));
  // THE DEFENSIVE LAYERS, multiplied. ARMOR (Strength) and EVASION (Speed)
  // both answer every hit, heavy or not. READ was a third layer on Instinct,
  // against telegraphed heavies only, and it is gone (owner, 2026-08-03w) — a
  // telegraph is answered by PRESSING the answer, not by a stat.
  const layers = [['ARMOR', p.armor || 0], ['EVASION', p.evasion || 0]];
  // Sym's ramp, doing its defensive half. Multiplies with the other two like
  // everything else here, so it is worth more the more you already have.
  const ward = thornsWard(p);
  if (ward > 0) layers.push(['CARAPACE', ward]);
  let kept = 1;
  for (const [name, r] of layers) {
    if (!(r > 0)) continue;
    kept *= (1 - r);
    notes.push(name + ' −' + Math.round(r * 100) + '%');
  }
  if (kept < 1) {
    const before = dmg;
    dmg = Math.floor(dmg * kept);
    state.damagePrevented = (state.damagePrevented || 0) + (before - dmg);
  }
  // Unaugmented: held Resolve is flat mitigation and Counterpunch braces on top
  // of it. The two are summed under one cap on purpose — see the note on the
  // brace status for why it is not a generic incomingMult.
  if (p.class === 'base') {
    // UNCAPPED NUMBER, BOUNDED EFFECT. Resolve has no stack ceiling any more,
    // so this cap is the only thing standing between a long fight and outright
    // immunity — and everything past it still pays out through Last Stand, so
    // the stacks above the cap are banked damage rather than waste.
    const held = statusStacks(p, 'resolve');
    const dr = Math.min(0.85, held*P().resolveDR + statusPower(p, 'brace'));
    if (dr > 0) {
      dmg = Math.floor(dmg * (1 - dr));
      // Reported as one number because it IS one number — the sum is what the
      // cap applies to, so splitting it in the log would imply two reductions.
      notes.push('GUARD −' + Math.round(dr * 100) + '%'
        + ' (RESOLVE ×' + held + (hasStatus(p, 'brace') ? ' + BRACE' : '') + ')');
    }
  }
  dmg = Math.max(1, dmg);
  p.hp = Math.max(0, p.hp - dmg);
  state.damageTaken = (state.damageTaken || 0) + dmg;
  // WHAT FINALLY DID IT, recorded at the blow rather than reconstructed after.
  // A telegraphed heavy and an ordinary swing are the same event to a total but
  // completely different readings — one is a turn you failed to answer, the
  // other is an economy you were losing anyway.
  if (p.hp <= 0) state.killedBy = { name: e ? e.name : 'unknown', heavy: mult > 1, dmg };
  logDamage(label, p, dmg, notes.concat([logNum(p.hp) + '/' + logNum(p.maxHp) + ' left']));
  // Psy: an enemy that gets its hands on you regains its nerve — the mark
  // eases instead of a player-side number draining. Same pressure, honest owner: being
  // hit still costs psy its dominance, but as the ENEMY's recovery, which is
  // both truer to the theme and visible on the card it happens to.
  if (p.class === 'psy' && e && e.hp > 0)
    shedStacks(e, 'dread', P().dreadLossPerHit, 'nerve steadied — its blow landed');
  // Unaugmented: every hit taken steadies you.
  if (p.class === 'base')
    gainResolve(p, (P().resolvePerHit||1) + statusSum(p, 'resolveOnHitTaken'), 'hit taken');
  // Sym: EVERY hit feeds the organism, with no window and no condition. This
  // is the half that used to live inside Raise Spines, which meant the strain
  // that wants to be hit was only paid for it three turns in every seven.
  // Spines still pays extra on top (its onHitTaken, just below).
  if (p.class === 'sym' && dmg > 0)
    growThorns(p, thornsGrowthFor(p, dmg), 'hit taken' + (dmg >= p.maxHp * P().thornsBigHitFrac ? ' (big hit)' : ''));
  // Whatever the player is carrying that answers a hit — Spines feeding the
  // growth, Brace punching back — fires here, in one place, for any status.
  statusEach(p, 'onHitTaken', { attacker: e, damage: dmg });
  floatText(p, dmg, 'damage');

  let thorns = getThornsDamage(p);
  const tNotes = [];
  if (thorns > 0) tNotes.push('thorns ' + logNum(thorns));
  // Sym: pain is fuel — a share of the damage actually taken comes back,
  // doubled while Spines is up. A windup eaten on purpose is the harvest.
  if (p.class === 'sym' && dmg > 0) {
    const spined = hasStatus(p, 'spines');
    const reflected = Math.floor(dmg * P().reflectFrac * (spined ? P().reflectSpinesMult : 1));
    thorns += reflected;
    tNotes.push('reflect ' + logNum(reflected)
      + ' (' + Math.round(P().reflectFrac * (spined ? P().reflectSpinesMult : 1) * 100) + '% taken'
      + (spined ? ', SPINES doubled' : '') + ')');
  }
  if (thorns > 0 && e.hp > 0) {
    const tBefore = e.hp;
    e.hp = Math.max(0, e.hp - thorns);
    creditDamage('Thorns', thorns);
    if (e.hp <= 0) state._lastOverkill = Math.max(0, thorns - tBefore);
    floatText(e, thorns, 'damage');
    logDamage('THORNS', e, thorns, tNotes);
    // NO THORNS FEED. It used to lifesteal a flat 25% of every thorns tick,
    // which against a number that grows all run is sustain that scales with the
    // ramp and asks nothing — timing-immune healing. Sym's faucet is SHED, on a
    // cooldown, paid for out of the ramp itself.
  }
  return dmg;
}

// CONSUMED FEAR FEEDS YOU — psy's sustain, one path for both meals: Kill
// eating the stacks it spends, and an enemy dying with fear still on it (the
// death-devour is what answers HP carrying across fights). Stacks SHED when
// the enemy steadies feed nothing — fear lost is not fear eaten — which is
// why shedStacks never comes near this. Loud on purpose: sustain the player
// doesn't notice is sustain that doesn't feel good, so every drink is a
// floater and a log line even when it lands on a full bar.
function devour(p, stacks, why) {
  if (!p || p.class !== 'psy' || !(stacks > 0) || p.hp <= 0) return;
  // The burst half of psy's sustain is an ACTION — Kill spending the pile, or
  // the pile cashing out on a death — so it crits. The SIPHON drip beside it
  // does not; that is the tick.
  const critMult = healCritMult(p);
  const heal = Math.max(1, Math.floor(healAnchorFor(p) * (P().dreadFeedFrac || 0) * stacks * critMult));
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  const gained = p.hp - before;
  if (gained > 0) floatText(p, gained, 'heal', critMult > 1);
  logHeal('DEVOUR', p, gained, [
    'DREAD ×' + stacks + ' @ ' + Math.round((P().dreadFeedFrac || 0) * 100) + '% of ' + logNum(healAnchorFor(p)),
    critMult > 1 ? 'CRIT ×' + critMult : null,
    why,
    gained < heal ? 'overheal ' + (heal - gained) : null,
    logNum(p.hp) + '/' + logNum(p.maxHp)
  ]);
  updateUnitCard(p);
}

// Player -> enemy.
function applyPlayerDamage(p, e, skill) {
  let dmg = p.atkPower * (skill.power || 1);
  // Qualifiers for the log line, collected as the number is built so each one
  // is recorded by the branch that actually applied it. A modifier that does
  // not fire adds nothing, so the line only ever lists real contributors.
  const notes = [];
  if ((skill.power || 1) !== 1) notes.push('power ×' + (skill.power || 1).toFixed(2));

  // DREAD (psy): Kill cashes the enemy's fear in. Same shape as Last Stand —
  // spend the pile for damage per unit — but the pile lives
  // on the ENEMY, so spending it also hands their turn rate back: the fight
  // speeds up the moment you cash out, which is what makes Kill a decision
  // instead of a rotation button.
  // consumeFrac: what share of the pile the skill actually takes, rounded UP so
  // a single stack is still edible. Kill takes half — see the note on the card
  // for why taking all of it made the button correct to never press.
  const dreadHeld = skill.consumesDread ? statusStacks(e, 'dread') : 0;
  const dreadSpent = Math.ceil(dreadHeld * (skill.consumeFrac || 1));
  if (dreadSpent > 0) {
    dmg += p.atkPower * (skill.perDreadPower || 0) * dreadSpent;
    notes.push('DREAD ×' + dreadSpent + ' torn away'
      + (dreadSpent < dreadHeld ? ' (×' + (dreadHeld - dreadSpent) + ' left)' : ''));
  }
  // Resolve (base): Last Stand scales with everything you endured.
  // HALF, NOT ALL — the same shape psy's Kill settled on. Spending the whole pile
  // cost the damage reduction AND made every later wound shallower (bleedDepth
  // rides held Resolve), so holding was correct at every count and the finisher
  // was the least-pressed button in the game at 7 per 100 turns. THE FRACTION IS
  // THE DIAL and it is steep — measured 2026-08-02ag, 70 runs a cell, median
  // reach and wins: 100% -> 32 / 0%, 80% -> 37 / 3%, 70% -> 37 / 6%, 60% -> 41 /
  // 24%, 50% -> 43 / 34%. Tearing an extra wound worth the Resolve spent was
  // tried in the same sweep and made it WORSE, so it is not here.
  const resolveHeld = skill.consumesResolve ? statusStacks(p, 'resolve') : 0;
  const resolveSpent = Math.ceil(resolveHeld * (skill.consumeFrac || 1));
  if (resolveSpent > 0) {
    dmg += p.atkPower * (skill.perResolvePower || 0) * resolveSpent;
    notes.push('RESOLVE ×' + resolveSpent + ' spent'
      + (resolveSpent < resolveHeld ? ' (×' + (resolveHeld - resolveSpent) + ' left)' : ''));
  }
  // Both sides' statuses meet here: what the player is carrying that raises the
  // hit (Predator, Empower) and what the enemy is carrying that softens or
  // opens it up (Fortify, Vulnerable).
  notes.push(...statusNotes(p, 'outgoingMult', { target: e }));
  notes.push(...statusNotes(e, 'incomingMult', { attacker: p }));
  dmg *= statusMult(p, 'outgoingMult', { target: e }) * statusMult(e, 'incomingMult', { attacker: p });
  if (skill.thornsBurst) {
    const t = getThornsDamage(p) * skill.thornsBurst;
    dmg += t;
    notes.push('THORNS +' + logNum(t));
  }
  if (skill.poisonScale) {                                  // Slash: reads the rot back
    const t = getPoisonDamage(e) * skill.poisonScale;
    if (t > 0) {
      dmg += t;
      notes.push('+' + logNum(t) + ' from POISON');
    }
  }
  if (skill.thornsScale) {                                  // Latch: reads the ramp back
    const t = getThornsDamage(p) * skill.thornsScale;
    dmg += t;
    // "from THORNS", not "THORNS +": the growth lines in this same transcript
    // read "THORNS +2", and two different meanings under one prefix is how a
    // log stops being reconstructable.
    notes.push('+' + logNum(t) + ' from THORNS');
  }

  // Nothing misses. An attack is only ever avoided by the target getting out of
  // the way, so this is the enemy's evade and nothing else — there is no
  // accuracy stat on either side to roll against.
  if (Math.random() < e.evadeChance) {
    playAttackAnim(p, e, false, skill);
    floatText(e, 'EVADE', 'note');
    // The evade chance is named because it is the whole explanation, and it is
    // the one number the player cannot see on the enemy anywhere else.
    logMiss(skill.name, e, 'EVADED (' + Math.round(e.evadeChance * 100) + '%)');
    return false;
  }

  let isCrit = Math.random() < p.critChance;
  // Printed the same way the Crit damage readout prints it — two decimals only
  // when there is a fraction to show — so the log and the sheet cannot report
  // the same x2.05 as two different numbers now that Instinct moves it.
  if (isCrit) {
    dmg *= p.critMult;
    state.critsLanded = (state.critsLanded || 0) + 1;
    notes.push('CRIT ×' + (p.critMult % 1 ? p.critMult.toFixed(2) : p.critMult));
  }

  dmg = Math.max(1, Math.floor(dmg));
  const before = e.hp;
  e.hp = Math.max(0, e.hp - dmg);
  creditDamage(skill.name, dmg);
  if (e.hp <= 0 && before > 0) state._lastOverkill = Math.max(0, dmg - before);

  // The hit itself, with the remaining HP: the number that says whether the
  // next one finishes it, which is the decision the player is actually making.
  logDamage(skill.name, e, dmg, notes.concat([logNum(e.hp) + '/' + logNum(e.maxHp) + ' left']));

  floatText(e, dmg, 'damage', isCrit);

  if (skill.consumesResolve && resolveSpent > 0)
    shedStacks(p, 'resolve', resolveSpent, 'spent by ' + skill.name);
  if (skill.consumesSpines) removeStatus(p, 'spines', 'consumed by ' + skill.name);
  // DREAD spent is DREAD gone: the enemy's fear breaks with the blow and its
  // turn rate recovers with it. After logDamage, so the hit line reports the
  // fear that paid for it before the removal line reports the cost. Partial by
  // default, so shedStacks rather than removeStatus. Fear TAKEN is fear eaten —
  // this is the one path where stacks coming off feed DEVOUR, as against the
  // enemy steadying itself, which feeds nothing.
  if (skill.consumesDread && dreadSpent > 0) {
    shedStacks(e, 'dread', dreadSpent, 'torn away by ' + skill.name);
    devour(p, dreadSpent, 'torn away by ' + skill.name);
  }
  // Resolve (base): landing a hit steadies you.
  if (skill.buildsResolve) gainResolve(p, skill.buildsResolve, skill.name);

  if (skill.poison && p.class === 'bio')
    // The count comes off the sheet so Strength reaches it — skill.poison is
    // the card's base, not the whole application. Same shape as bleed.
    applyStatus(e, 'poison', { stacks: poisonStacks(p, skill), perStack: p.poisonPerStack });
  // Unaugmented opens a wound. On-hit like the rot, so an evade costs the cut as
  // well as the damage — and the depth is read HERE, at the moment of the
  // swing, off the Resolve standing behind it. gainResolve fires earlier in
  // this same function, so a Strike is cut with the Resolve it just earned.
  if (skill.bleed && p.class === 'base' && e.hp > 0)
    // skill.bleed is a FLAG (this attack opens a wound), not a count — the
    // count comes off the sheet so Strength reaches it. No duration: stacks are
    // the clock.
    applyStatus(e, 'bleed', { stacks: bleedStacks(p), perStack: bleedDepth(p) });
  // Terrify's burst of fear, the planted counterpart of Slash's poison. On-hit
  // rather than on-use, so the enemy dodging costs the fear along with the
  if (skill.dread && e.hp > 0)
    applyStatus(e, 'dread', { stacks: dreadStacks(p, skill) });

  applySkillStatuses(p, skill, e);

  if (skill.stun) {
    const stunTurns = skill.stun;
    // Gated CC, threshold not spend: Traumatize breaks a mind that is already
    // frightened enough, and BREAKING IT DOES NOT SPEND THE FEAR — the stacks
    // stay, still slowing. The attack lands either way; only the break is gated.
    // Every way the break can fail gets a FLOATER, not just a log line, because
    // three silent outcomes (threshold missed, stagger resist, windup interrupt)
    // stacked up into "Traumatize doesn't work".
    if (skill.dreadNeed) {
      const held = statusStacks(e, 'dread');
      if (held < skill.dreadNeed) {
        floatText(e, 'MIND HOLDS ' + held + '/' + skill.dreadNeed, 'note');
        logEvent('STUN', null, 'mind holds',
                 ['needs ' + skill.dreadNeed + ' DREAD, it holds ' + held]);
        return dmg;
      }
    }
    if (e.windup && !e.stunImmune) {
      // Interrupt: breaks the charge instead of stunning, and ARMS stagger
      // resist — the next windup cannot be canceled and must be answered
      // differently (heal, brace, tank). One rule everywhere: bosses
      // alternate CC resistance. No second action is lost, so no stun-lock.
      e.windup = false;
      e.windupSpoiled = false;
      const fig = getFigureForUnit(e);
      if (fig) fig.style.filter = '';
      e.stunImmune = true;
      floatText(e, 'INTERRUPTED', 'note');
      logEvent('INTERRUPT', e, 'windup broken', ['stagger resist now armed']);
    } else if (e.windup && e.stunImmune) {
      // The shrug clears the resist and the strike still comes — but it comes
      // SPOILED. This branch used to be psy's only defensive button doing
      // nothing whatsoever on every second telegraph, against a blow the class
      // has no mitigation to eat. You did not break the charge; you knocked a
      // share out of it.
      e.stunImmune = false;
      e.windupSpoiled = true;
      floatText(e, 'SPOILED', 'note');
      logEvent('CHARGE SPOILED', e, 'the charge holds, and it is smaller',
               ['resist consumed', '×' + BALANCE.enemy.windupSpoilFrac + ' of the telegraph']);
    } else {
      if (e.stunImmune) {
        // Without this, a 1-turn stun on a ~3-turn cooldown locks an enemy that acts
        // once per 3-4 of your turns out of the fight entirely.
        e.stunImmune = false;
        floatText(e, 'RESISTED', 'note');
        logEvent('STAGGER RESISTED', e, 'no stun', ['resist consumed']);
      } else {
        applyStatus(e, 'stun', { duration: stunTurns });
        e.stunImmune = true;
      }
    }
  }
  return dmg;
}

// Statuses a skill hangs on the fight when it resolves, taken straight from the
// STATUSES registry. A 'buff' lands on the
// caster and anything else on the enemy, so a skill lists WHAT it applies and
// never has to say which way round. Called from the damage path for attacks
// (on-hit, so an evade costs them) and from fireSkill for heals and buffs,
// which always resolve.
function applySkillStatuses(caster, skill, foe) {
  if (!Array.isArray(skill.applies)) return;
  for (const a of skill.applies) {
    const def = statusDef(a.id);
    if (!def) continue;
    const unit = def.kind === 'buff' ? caster : (foe || state.enemy);
    if (!unit || unit.hp <= 0) continue;
    applyStatus(unit, a.id, { power: a.power, duration: a.duration });
  }
}

function fireSkill(caster, skill, target) {
  if (!caster || !skill || !target) return;
  if (!skill.basic && skill.cd > 0) return;
  const fullCd = (!skill.basic && skill.cdTurns) ? skill.cdTurns : 0;
  if (fullCd) skill.cd = fullCd;

  if (skill.selfDmgFrac) {
    const cost = Math.max(1, Math.floor(caster.hp * skill.selfDmgFrac));
    caster.hp = Math.max(1, caster.hp - cost);
    floatText(caster, cost, 'damage');
    playRecoil(caster);
  }

  let bankLanded = true;   // heal/buff always resolve; attacks must connect
  if (skill.type === 'heal') {
    let frac = skill.healFrac || 0.1;
    const notes = [];
    // Unaugmented: Bandage patches better the deeper you're dug in.
    if (skill.resolveHealBonus) {
      const bonus = skill.resolveHealBonus * statusStacks(caster, 'resolve');
      frac += bonus;
      if (bonus > 0) notes.push('RESOLVE ×' + statusStacks(caster, 'resolve') + ' +' + Math.round(bonus * 100) + '%');
    }
    notes.push(Math.round(frac * 100) + '% of ' + logNum(healAnchorFor(caster)));
    // Rolled BEFORE the amount so the crit is priced into everything below it,
    // Shed's thorn cost included — a crit patch closes the same wound with
    // half the spines, rather than tearing off the usual handful and wasting
    // the surplus on a bar that cannot hold it.
    const critMult = healCritMult(caster);
    if (critMult > 1) notes.push('CRIT ×' + critMult);
    let amount = Math.max(1, Math.floor(healAnchorFor(caster) * frac * critMult));
    // Sym: SHED covers whatever the base patch did not, out of grown thorns —
    // computed after the base amount so it only ever pays for the remainder.
    if (skill.shedFuel) amount += shedForHeal(caster, skill, amount, notes, critMult);
    const before = caster.hp;
    caster.hp = Math.min(caster.maxHp, caster.hp + amount);
    const restored = caster.hp - before;
    floatText(caster, amount, 'heal', critMult > 1);
    // The amount RESTORED, not the amount rolled: healing into a nearly-full
    // bar is the case where those two differ, and the restored number is the
    // one that actually happened. The overheal is named so the gap is not a
    // mystery.
    logHeal(skill.name, caster, restored,
      notes.concat([restored < amount ? 'overheal ' + logNum(amount - restored) : null,
                    logNum(caster.hp) + '/' + logNum(caster.maxHp)]));
    playCastAnim(caster, skill);
  } else if (skill.type === 'provoke') {
    // The invitation. No damage of its own on purpose — every point on the
    // board comes from the enemy's own swing landing on your spikes, which is
    // the whole claim the class makes.
    logEvent(skill.name, null, 'guard bared');
    playCastAnim(caster, skill);
    provokeSwing(caster, target, skill);
  } else if (skill.type === 'buff') {
    // Any buff at all: the skill names a status id and hands over whichever
    // fields it wants to override. Stacking and duration come from the
    // definition, so a new buff skill needs no code here — and applyStatus
    // logs it, so there is no line to write either. The old applyMsg prose
    // ("raises living spines") said less than the status badge it produced.
    logEvent(skill.name, null, 'cast');
    applyStatus(caster, skill.buff, skillStatusOpts(skill));
    applySkillStatuses(caster, skill);
    playCastAnim(caster, skill);
  } else {
    const dealt = applyPlayerDamage(caster, target, skill);
    bankLanded = !!dealt;
    if (dealt) {
      playAttackAnim(caster, target, true, skill);
      if (skill.lifesteal) {
        // No skill carries this since Nerve Drain went with the psy rework.
        // Kept generic: the vampiric elite's lifesteal runs through its own
        // path, so this seam is for a future player source.
        const heal = Math.max(1, Math.floor(dealt * skill.lifesteal));
        const before = caster.hp;
        caster.hp = Math.min(caster.maxHp, caster.hp + heal);
        floatText(caster, heal, 'heal');
        logHeal('LIFESTEAL', caster, caster.hp - before,
                [Math.round(skill.lifesteal * 100) + '% of ' + logNum(dealt) + ' dealt',
                 logNum(caster.hp) + '/' + logNum(caster.maxHp)]);
      }
    } else if (fullCd) {
      // A miss already cost the turn; don't also charge the full cooldown.
      skill.cd = 1;
      logEvent(skill.name, null, 'cooldown reduced to 1t', ['attack missed']);
    }
  }


  // Declared on the card, resolved in one place: a strain's sustain button says
  // how much rot it scrubs and needs no code of its own.
  if (skill.cleanse) cleansePoison(caster, skill.cleanse, skill.name);

  updateUnitCard(caster); updateUnitCard(target); renderSkills();
  if (state.enemy && state.enemy.hp <= 0 && !state.enemy._defeated) onEnemyDefeated();
}

// Kept so the 1/2/3 keybinds and the skill buttons share one path.
function selectSkill(skill) { playerAct(skill); }

// ---- Kill / spawn --------------------------------------------
function onEnemyDefeated() {
  const e = state.enemy;
  if (!e || e._defeated || state._defeatLock) return;
  state._defeatLock = true;
  e._defeated = true;

  const p = state.player;
  const overkill = state._lastOverkill || 0;
  state._lastOverkill = 0;

  state.kills++;
  // A chain is "killed it fast", measured in the enemy's actions — counting the
  // player's own turns biased chains by attack speed. Windup/stun turns don't count.
  const chained = (state.enemyActions || 0) <= BALANCE.combo.maxEnemyActionsPerKill;
  if (chained) state.combo++;
  else state.combo = 1;
  if (state.combo > state.bestCombo) state.bestCombo = state.combo;
  updateCombo();

  // The kill itself. Turns and enemy actions are on the line because they are
  // exactly what the chain rule reads, so a chain that broke explains itself
  // instead of looking arbitrary.
  logEvent('DEFEATED', e, null, [
    state.turnNo + ' turns',
    state.enemyActions + ' enemy actions',
    chained ? 'CHAIN ' + state.combo + '×'
            : 'CHAIN reset (over ' + BALANCE.combo.maxEnemyActionsPerKill + ')',
    overkill > 0 ? 'overkill ' + logNum(overkill) : null
  ]);

  // The death-devour: fear still riding the enemy when it dies is drunk whole.
  // This is psy's between-fight sustain — it fires exactly where wave-to-wave
  // attrition is tallied — and it is the other exit for the same meal Kill
  // eats early, which is what makes end-of-fight play a choice: cash the
  // stacks as burst, or finish with Hunt and drink them off the corpse.
  devour(p, statusStacks(e, 'dread'), 'drunk from the dying');

  // THE ROT OUTLIVES ITS HOST — bio's carry, taken off the corpse here and
  // planted on the next spawn (spawnEnemy). Read BEFORE the wave advances so
  // it is the stacks this fight actually ended with. Replaces rather than
  // accumulates: it is half of what is on THIS body, not a running total.
  if (p && p.class === 'bio') {
    const left = statusStacks(e, 'poison');
    // modCarryFrac is a Modification's override (VIRULENT CULTURE).
    const frac = p.modCarryFrac != null ? p.modCarryFrac : (P().poisonCarryFrac || 0);
    const carry = Math.floor(left * frac);
    p.poisonCarry = carry;
    if (carry > 0)
      logEvent('THE ROT HOLDS', null, '×' + carry + ' POISON',
               ['half of ×' + left + ' on the body', 'moves to the next host']);
  }

  if (e.elite && e.elite.deathNova) {
    const nova = Math.max(1, Math.floor(p.maxHp * e.elite.deathNova));
    p.hp = Math.max(0, p.hp - nova);
    state.damageTaken = (state.damageTaken || 0) + nova;
    floatText(p, nova, 'damage');
    logDamage('DEATH NOVA', p, nova, [
      'VOLATILE ' + Math.round(e.elite.deathNova * 100) + '% max HP',
      logNum(p.hp) + '/' + logNum(p.maxHp) + ' left'
    ]);
  }

  const tier = Math.floor((state.wave-1)/5);
  const comboBonus = 1 + Math.min(BALANCE.combo.maxStack, state.combo) * BALANCE.combo.xpPerStack;
  const gearXp = 1 + gearMod(p, 'xpBoost');
  const xp = Math.floor((BALANCE.xp.killBase + state.wave*BALANCE.xp.killWave + tier*BALANCE.xp.killTier)
    * e.xpMult * comboBonus * gearXp);
  logEvent('XP', null, '+' + logNum(xp), [
    e.xpMult !== 1 ? 'enemy ×' + e.xpMult.toFixed(1) : null,
    comboBonus > 1 ? 'chain ×' + comboBonus.toFixed(2) : null,
    gearXp > 1 ? 'suit ×' + gearXp.toFixed(2) : null
  ]);

  killFlash(e);
  const killedWave = state.wave;
  state.wave++;
  // A multiplied payout (elite, boss, chain) floats as the big gold number —
  // the elite's "juice" is XP, so the bonus must be unmissable when it lands.
  gainXP(xp, e.xpMult !== 1 || comboBonus > 1);

  if (p.hp <= 0) { state._defeatLock = false; stopCombatLoop(); endRun(); return; }

  // Beating the final wave's boss wins the run.
  //
  // AND IT DROPS NOTHING, deliberately: this returns before the loot roll
  // below, because there is no next fight to fit an item for. Making it drop
  // would put an equip-or-leave card between the last blow and the result
  // screen, and the item could never be worn.
  if (killedWave >= BALANCE.finalWave) {
    state._defeatLock = false;
    stopCombatLoop();
    endRun(true);
    return;
  }

  state.awaitingSpawn = true;
  state.awaitingInput = false;
  state.pendingEnemyAct = false;
  state._defeatLock = false;
  saveRun();
  updateTurnInfo(); renderSkills();

  // LOOT AND THE LABORATORY'S OFFER. Both are ROLLED here, on the rules stream,
  // in both paths — so headless rolls the identical item and the identical
  // three. Neither STOPS the run any more: they queue into the sidebar and the
  // fight walks on, because a modal over the arena breaks the one flow this
  // game has (owner, 2026-08-03t). Answering them is mouse work on the right
  // while the left hand keeps playing.
  const drop = rollDrop(e, killedWave);
  if (drop) queueDrop(drop);
  if (modDueAfter(killedWave) && p) {
    const offer = offerMods(p);
    if (offer.length) queueMods(offer);
  }
  resumeAfterKill(killedWave);
}

function resumeAfterKill(killedWave) {
  // A BOSS EARNS A BEAT. Wave-to-wave the next enemy is already walking in by
  // design, but dropping straight from a boss into the next grunt gives the
  // kill nowhere to land — so a scene, if one belongs here, gets a full second
  // of quiet room first and then takes the card over — and it goes through
  // black rather than swapping the room on a lit frame.
  //
  // HEADLESS NEVER SEES IT. A scene changes no rule and no number, so the sim
  // goes straight on to the next wave: the fight the bot plays and the fight on
  // screen stay the identical fight.
  const scene = HEADLESS.on ? null : sceneAfterWave(killedWave);
  if (scene) {
    scheduleTurn(() => openScene(scene, doSpawn), turnDelay(SCENE_HOLD_MS));
    return;
  }
  scheduleTurn(doSpawn, turnDelay(BALANCE.spawnDelay * 1000 + 320));
}

// HOW LONG A FIGHT'S LAST MOMENT IS HELD before a scene takes the card. A boss
// kill and a death both need it, and the death needs it more: without one the
// player is revived on the same frame they fell, so the death they are being
// rescued from never visibly happens.
const SCENE_HOLD_MS = 2200;    // after a boss kill
const RESCUE_HOLD_MS = 2000;   // after the first boss kills you

// Pulled out of the fight you lost. The boss is behind you rather than beaten,
// so its XP is gone with it; what you keep is the run.
//
// The rules half is in applyRescue and runs BEHIND THE BLACKOUT, not before it.
// Reviving in the open was the abrupt part: you died, and were instantly on
// half a bar with a scene starting, so the moment being rescued from was never
// on screen.
function applyRescue() {
  const p = state.player;
  state.wave++;
  if (p) {
    p.hp = Math.max(1, Math.floor(p.maxHp * (P().rescueHpFrac || 0.5)));
    logEvent('RESCUED', p, null, ['the first boss is behind you', logNum(p.hp) + '/' + logNum(p.maxHp)]);
  }
  // From here on this IS a wave ending, so it mirrors the tail of onEnemyDefeated.
  state.awaitingSpawn = true;
  state.awaitingInput = false;
  state.pendingEnemyAct = false;
  state._defeatLock = false;
  saveRun();
  updateHud(); renderSkills();
  if (p) updateUnitCard(p);
}

function rescueRun() {
  state.rescued = true;
  stopCombatLoop();
  // Headless plays the rule and nothing else: no hold, no scene, no timers —
  // the sim has no clock to wait on.
  if (HEADLESS.on) { applyRescue(); startCombatLoop(); return; }

  // The blow lands, and is allowed to have landed. Same beat endRun gives a
  // real defeat before the result screen replaces it, and the same drained
  // arena, because for these two seconds this IS a defeat.
  const cs = document.getElementById('combat-screen');
  if (cs) cs.classList.add('defeat-beat');
  if (state.player) updateUnitCard(state.player);
  _revealTimers.push(setTimeout(() => {
    if (cs) cs.classList.remove('defeat-beat');
    // startCombatLoop, not doSpawn — every path into endRun has already stopped
    // the loop, and doSpawn refuses to run while combatActive is false.
    // The same conversation either way — whether he pulled you out of the boss
    // or you walked away from it, this is the first time he speaks to you.
    openScene('scientist', startCombatLoop, applyRescue);
  }, RESCUE_HOLD_MS));
}

// ---- The run ledger -------------------------------------------
// ONE FUNNEL FOR EVERY POINT OF DAMAGE THE PLAYER DEALS, so the run total and
// the per-source breakdown cannot disagree — the total is the sum of the sources
// by construction. The label is what the result screen groups by, so it should
// read as the thing the player pressed or grew: a skill name, 'Bleed', 'Thorns'.
// A source that forgets to come through here is invisible in the breakdown AND
// missing from the total.
function creditDamage(source, amount) {
  if (!(amount > 0)) return;
  state.damageDealt += amount;
  const t = (state.dmgBySource = state.dmgBySource || {});
  t[source] = (t[source] || 0) + Math.floor(amount);
}

// The strain number, whichever one this class runs on — sym and base wear it,
// bio and psy stack it on the enemy. Sampled rather than hooked into each
// mechanic so a new strain gets a peak for free.
function strainNumberNow(p) {
  if (!p) return 0;
  const e = state.enemy, live = e && e.hp > 0 && !e._defeated;
  if (p.class === 'sym')  return p.thorns || 0;
  if (p.class === 'base') return statusStacks(p, 'resolve');
  if (p.class === 'psy')  return live ? statusStacks(e, 'dread') : 0;
  if (p.class === 'bio')  return live ? statusStacks(e, 'poison') : 0;
  return 0;
}

function endRun(won) {
  // Re-entry guarded by state rather than by asking the result screen whether
  // it is visible — headless never shows it, and a run ending is a fact about
  // the run either way.
  if (state.runOver) return;
  // Losing the first boss is survivable exactly once — see rescueAvailable.
  if (rescueAvailable(won)) { rescueRun(); return; }
  state.runOver = true;
  state.won = !!won;
  stopCombatLoop();
  clearSavedRun();
  if (HEADLESS.on) return;                 // nothing to draw

  // The killing blow gets to exist before the verdict replaces it. The result
  // screen used to land on the same frame as the fatal hit — the HP bar never
  // visibly reached zero. Hold the arena (drained of color on defeat, flushed
  // on a win) long enough for the last floater and the bar to finish saying
  // what happened, then show the screen. Rules are already settled above;
  // playerAct refuses input once hp <= 0, so the pause cannot be acted in.
  updateHud();
  if (state.player) updateUnitCard(state.player);
  const combatScreen = document.getElementById('combat-screen');
  if (combatScreen && combatScreen.classList.contains('active')) {
    combatScreen.classList.add(won ? 'won-beat' : 'defeat-beat');
    setTimeout(showResultScreen, won ? 900 : 1500);
  } else {
    showResultScreen();
  }
}

// THE WAVE THE RUN ACTUALLY REACHED. state.wave is incremented the moment a
// kill lands and BEFORE the win is checked, so a finished run leaves it sitting
// one past the end — the result screen read "WAVE 46 of 45" and the copy block
// said "Wave 46/45". Clamped here rather than by not incrementing, because the
// increment is what spawns the next wave on every other kill in the game.
function waveReached() {
  return state.won ? BALANCE.finalWave : state.wave;
}

// The four strains wear their number under different names, and the result
// screen has to say which one it is reporting.
const STRAIN_LABEL = { bio:'POISON', psy:'DREAD', sym:'THORNS', base:'RESOLVE' };

// Damage by source, biggest first, with each share of the run's total. Returns
// [] when a run predates the ledger (an old save mid-run), so the section can
// drop out rather than render an empty frame.
function damageBreakdown() {
  const t = state.dmgBySource || {};
  const rows = Object.keys(t).map(k => ({ name: k, dmg: t[k] })).filter(r => r.dmg > 0);
  const total = rows.reduce((a, r) => a + r.dmg, 0);
  rows.sort((a, b) => b.dmg - a.dmg);
  rows.forEach(r => { r.pct = total ? r.dmg / total : 0; });
  return rows;
}

// Presses per button, in the order the class lists them, so a card that was
// never pressed still shows — a zero is the whole point of this section.
function buttonUsage(p) {
  const u = state.skillUses || {};
  return (p.skills || []).map(sk => ({ name: sk.name, uses: u[sk.id] || 0 }));
}

// ---- The COPY block -------------------------------------------
// PLAIN TEXT, PASTEABLE, AND COMPLETE ENOUGH TO DIAGNOSE A RUN WITHOUT THE
// PLAYER DESCRIBING IT. The owner does not read code and should never have to
// summarise a run by hand — this is the whole conversation in one paste.
//
// Ordered by what gets asked first: verdict, then the sheet that produced it,
// then what actually killed him, then the breakdown. The build stamp leads,
// because a number measured on a build nobody can name is not a measurement.
function runReport() {
  const p = state.player, won = state.won;
  // EXACT NUMBERS, not formatNum's "6.6k". On screen the abbreviation is what
  // makes the card skimmable; in a report it throws away the precision the
  // report exists to carry — 6.6k and 6,649 are the same glance and different
  // evidence.
  const N = n => Math.floor(Number(n) || 0).toLocaleString('en-US');
  const mins = Math.max(1, Math.round((Date.now() - state.runStart) / 60000));
  const zone = zoneForWave(waveReached());
  const L = [];
  const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));

  L.push('RISEN run report — build ' + BUILD);
  L.push((won ? 'RISEN (won)' : 'DEFEATED') + ' · Wave ' + waveReached() + '/' + BALANCE.finalWave
         + ' · Zone ' + zone.num + ': ' + zone.name);
  L.push(CLASSES[p.class].name + ' · Level ' + p.level + ' · ~' + mins + ' min');
  L.push('');
  if (!won && state.killedBy) {
    L.push('Killed by: ' + state.killedBy.name
           + (state.killedBy.heavy ? ' — TELEGRAPHED HEAVY' : ' — ordinary hit')
           + ' for ' + N(state.killedBy.dmg));
  }
  L.push('Sheet: STR ' + p.str + ' · INS ' + p.instinct + ' · SPD ' + p.speed + ' · VIT ' + p.vit
         + '  ->  ' + N(attackDamage(p)) + ' dmg · ' + N(p.maxHp) + ' HP · '
         + p.attackSpeed.toFixed(2) + 'x rate');
  L.push('Peak ' + (STRAIN_LABEL[p.class] || 'strain') + ': ' + N(state.peakStrain || 0));
  const worn = gearList(p);
  if (worn.length) {
    L.push('');
    L.push('Suit');
    worn.forEach(it => L.push('  ' + pad(SLOTS[it.slot].label, 11)
      + itemLogName(it) + ' — '
      + [itemImplicitLine(it)].concat(itemAffixLines(it)).filter(Boolean).join(' · ')));
  }
  L.push('');
  L.push('Turns ' + N(state.runTurns || 0)
         + ' · Kills ' + N(state.kills)
         + ' · Best chain ' + (state.bestCombo || 0) + 'x'
         + ' · Crits ' + N(state.critsLanded || 0)
         + ' · Prevented ' + N(state.damagePrevented || 0));
  L.push('Damage dealt ' + N(Math.floor(state.damageDealt))
         + ' · taken ' + N(Math.floor(state.damageTaken || 0)));

  const brk = damageBreakdown();
  if (brk.length) {
    L.push('');
    L.push('Damage by source');
    brk.forEach(r => L.push('  ' + pad(r.name, 16) + pad(N(r.dmg), 9)
                            + Math.round(r.pct * 100) + '%'));
  }
  const btn = buttonUsage(p);
  if (btn.length) {
    L.push('');
    L.push('Buttons pressed');
    btn.forEach(b => L.push('  ' + pad(b.name, 16) + N(b.uses)));
  }
  return L.join('\n');
}

// Clipboard with a fallback, because navigator.clipboard is unavailable on
// insecure origins and the file:// case is exactly how this game gets opened.
function copyRunReport(btn) {
  const text = runReport();
  const done = ok => {
    if (!btn) return;
    btn.classList.toggle('copied', ok);
    btn.textContent = ok ? 'COPIED TO CLIPBOARD' : 'PRESS Ctrl+C';
    setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'COPY RUN REPORT'; }, 2000);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  done(ok);
}

// ---- The result screen ----------------------------------------
// SKIMMABLE FIRST, COMPLETE SECOND. It reads in three passes: the verdict and
// one sentence of what happened, then four HERO numbers big enough to take in at
// a glance, then the sections you only read when you want them. Every value is a
// counter the rules incremented as the event happened — nothing is recomputed.
function showResultScreen() {
  // A new run can start during the beat (menu shortcuts); if the ended run is
  // no longer the current fact, the verdict belongs to nobody — skip it.
  if (!state.runOver) return;
  const won = state.won;
  const combatScreen = document.getElementById('combat-screen');
  if (combatScreen) combatScreen.classList.remove('won-beat', 'defeat-beat');
  const p = state.player;
  const mins = Math.max(1, Math.round((Date.now() - state.runStart) / 60000));
  showScreen('result-screen');

  const esc = t => String(t).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const zone = zoneForWave(waveReached());

  // ONE SENTENCE, and on a loss it names the blow. "Wave 14" and "wave 14 to a
  // heavy you did not answer" are different readings, and the second one is the
  // one that says what to do about it.
  const story = won
    ? 'All ' + BALANCE.finalWave + ' waves cleared. You rose.'
    : 'Fell on wave ' + state.wave + ' in ' + esc(getZoneName(state.wave))
      + (state.killedBy
          ? ' — ' + (state.killedBy.heavy
              ? '<b class="rs-heavy">a telegraphed heavy</b>'
              : 'an ordinary hit')
            + ' from ' + esc(state.killedBy.name) + ' for ' + formatNum(state.killedBy.dmg)
          : '');

  const hero = (label, value, sub) =>
    '<div class="rs-hero"><span class="rs-hero-k">' + label + '</span>' +
      '<b class="rs-hero-v">' + value + '</b>' +
      (sub ? '<span class="rs-hero-s">' + sub + '</span>' : '') + '</div>';

  const stat = (label, value) =>
    '<div class="rs-stat"><span>' + label + '</span><b>' + value + '</b></div>';

  const brk = damageBreakdown();
  const bars = brk.map(r =>
    '<div class="rs-bar">' +
      '<span class="rs-bar-k">' + esc(r.name) + '</span>' +
      '<span class="rs-bar-track"><i style="width:' + Math.max(2, r.pct * 100).toFixed(1) + '%"></i></span>' +
      '<b class="rs-bar-v">' + formatNum(r.dmg) + '</b>' +
      '<span class="rs-bar-p">' + Math.round(r.pct * 100) + '%</span>' +
    '</div>').join('');

  const btn = buttonUsage(p);
  const maxUse = Math.max(1, ...btn.map(b => b.uses));
  const buttons = btn.map(b =>
    '<div class="rs-bar' + (b.uses ? '' : ' rs-bar-dead') + '">' +
      '<span class="rs-bar-k">' + esc(b.name) + '</span>' +
      '<span class="rs-bar-track"><i style="width:' + Math.max(2, b.uses / maxUse * 100).toFixed(1) + '%"></i></span>' +
      '<b class="rs-bar-v">' + formatNum(b.uses) + '</b>' +
    '</div>').join('');

  const sheet = [['STR', p.str], ['INS', p.instinct], ['SPD', p.speed], ['VIT', p.vit]];
  const maxStat = Math.max(...sheet.map(s => s[1]));
  const sheetHtml = sheet.map(([k, v]) =>
    '<div class="rs-sheet-cell"><span>' + k + '</span><b>' + v + '</b>' +
      '<i style="width:' + (v / maxStat * 100).toFixed(0) + '%"></i></div>').join('');

  document.getElementById('result-stats').innerHTML =
    '<div class="rs-card ' + p.class + '">' +
      '<div class="rs-verdict ' + (won ? 'win' : 'lose') + '">' +
        (won ? 'RISEN' : 'DEFEATED') + '</div>' +
      '<div class="rs-head">' +
        '<span class="rs-class">' + esc(CLASSES[p.class].name) + '</span>' +
        '<span class="rs-story">' + story + '</span>' +
      '</div>' +

      '<div class="rs-heroes">' +
        hero('WAVE', waveReached(), 'of ' + BALANCE.finalWave) +
        hero('LEVEL', p.level, formatNum((p.level - 1) * P().pointsPerLevel) + ' pts') +
        hero('TURNS', formatNum(state.runTurns || 0), '~' + mins + ' min') +
        hero('KILLS', formatNum(state.kills), (state.bestCombo || 0) + '× chain') +
      '</div>' +

      '<div class="rs-body">' +
        '<section class="rs-sec">' +
          '<h4>SHEET</h4>' +
          '<div class="rs-sheet">' + sheetHtml + '</div>' +
          '<div class="rs-stats">' +
            stat('Attack damage', formatNum(attackDamage(p))) +
            stat('Max HP', formatNum(p.maxHp)) +
            stat('Turn rate', p.attackSpeed.toFixed(2) + '×') +
            stat('Peak ' + (STRAIN_LABEL[p.class] || 'strain'), formatNum(state.peakStrain || 0)) +
          '</div>' +
        '</section>' +

        '<section class="rs-sec">' +
          '<h4>COMBAT</h4>' +
          '<div class="rs-stats">' +
            stat('Damage dealt', formatNum(Math.floor(state.damageDealt))) +
            stat('Damage taken', formatNum(Math.floor(state.damageTaken || 0))) +
            stat('Crits landed', formatNum(state.critsLanded || 0)) +
            stat('Damage prevented', formatNum(state.damagePrevented || 0)) +
          '</div>' +
        '</section>' +

        (bars ? '<section class="rs-sec rs-wide">' +
          '<h4>DAMAGE BY SOURCE</h4>' + bars + '</section>' : '') +

        (buttons ? '<section class="rs-sec rs-wide">' +
          '<h4>BUTTONS PRESSED</h4>' + buttons + '</section>' : '') +
      '</div>' +

      '<div class="rs-foot">' +
        '<button class="rs-copy" onclick="copyRunReport(this)">COPY RUN REPORT</button>' +
        '<span class="rs-build">build ' + BUILD + '</span>' +
      '</div>' +
      '<div class="rs-actions">' +
        '<button class="ui-btn is-quiet" onclick="goToMenu()">MAIN MENU</button>' +
      '</div>' +
    '</div>';
}

// ---- Skills UI ------------------------------------------------
function renderSkills(forceRebuild) {
  if (HEADLESS.on) return;
  const container = document.getElementById('skills');
  const p = state.player;
  if (!container || !p) return;
  const needsBuild = forceRebuild || container.dataset.builtFor !== p.class
    || container.querySelectorAll('.skill-btn').length !== p.skills.length;

  if (needsBuild) {
    container.innerHTML = '';
    container.dataset.builtFor = p.class;
    p.skills.forEach((skill, idx) => {
      const btn = document.createElement('button');
      btn.className = 'skill-btn' + (skill.basic ? ' basic' : '');
      btn.dataset.skillId = skill.id;
      btn.type = 'button';
      // Order matters: the status line renders last so `margin-top: auto` can
      // pin it to the bottom of the card.
      btn.innerHTML =
        '<div class="skill-name">' + skill.name + '</div>'
        + '<div class="skill-desc">' + fmtDesc(skill) + '</div>'
        + '<div class="skill-cost"></div>'
        + '<div class="cd-sweep"></div>'
        + '<div class="cd-overlay" style="display:none"></div>';
      btn.addEventListener('click', ev => { ev.preventDefault(); playerAct(skill); });
      container.appendChild(btn);
    });
  }

  p.skills.forEach(skill => {
    const btn = container.querySelector('.skill-btn[data-skill-id="' + skill.id + '"]');
    if (!btn) return;
    // THE CARDS WERE WRITTEN ONCE AND NEVER REWRITTEN, so every damage number
    // on them was frozen at whatever the sheet said when the fight screen was
    // first built — a run that had doubled its Attack Damage still read "25
    // damage" on Strike while the sidebar read 40. fmtDesc has always resolved
    // {power!} against the LIVE sheet; nothing was ever asking it again.
    // Compared before writing, so the common case (nothing moved) touches no
    // DOM and a mid-fight rebuild can't fight the cooldown overlay.
    const descEl = btn.querySelector('.skill-desc');
    if (descEl) {
      const html = fmtDesc(skill);
      if (descEl.innerHTML !== html) descEl.innerHTML = html;
    }
    const costEl = btn.querySelector('.skill-cost');
    const overlay = btn.querySelector('.cd-overlay');
    const sweep = btn.querySelector('.cd-sweep');
    const yourTurn = !!state.awaitingInput && state.combatActive;
    if (skill.basic) {
      btn.classList.toggle('auto-on', yourTurn);
      btn.classList.toggle('auto-off', !yourTurn);
      btn.disabled = !yourTurn;
      // No status word. Whether a card is live is already said by its own
      // state — lit or dimmed, clickable or not — so ATTACK and WAIT were
      // labelling something the card was showing anyway, in a colour that now
      // competes with the keywords in the description above.
      costEl.textContent = '';
      return;
    }
    const maxCd = skill.cdTurns;
    if (skill.cd > 0) {
      btn.classList.add('on-cd'); btn.classList.remove('ready');
      btn.disabled = true;
      // The turn count is already the big number centred on the card.
      costEl.textContent = '';
      overlay.style.display = 'flex';
      overlay.textContent = skill.cd;
      if (sweep) sweep.style.height = Math.min(100, (skill.cd/maxCd)*100) + '%';
    } else {
      btn.classList.remove('on-cd'); btn.classList.add('ready');
      btn.disabled = !yourTurn;
      // Nothing gates a ready card any more (Traumatize's DREAD threshold
      // gates its STUN, not the cast). The cost line stays as the seam for the
      // next card that is usable-but-not, so the reason can be said where the
      // player is looking.
      costEl.textContent = '';
      overlay.style.display = 'none';
      if (sweep) sweep.style.height = '0%';
    }
  });
}

// Keyboard: 1-4 fire the skill in that slot.
// A clicked <button> keeps focus, and a focused button natively activates on
// Space/Enter — neither of which this handler claims. That let a stray Space
// re-fire the last skill you clicked, or re-open the pause menu. Dropping focus
// after a pointer click closes that path (and stops the focus ring lingering).
// Keyboard activation is untouched: tabbing to a button fires no pointer event,
// so it keeps focus and its ring.
document.addEventListener('pointerup', ev => {
  const el = ev.target;
  if (!el || !el.closest) return;
  const btn = el.closest('button');
  if (btn) btn.blur();
});

document.addEventListener('keydown', ev => {
  const n = parseInt(ev.key, 10);
  if (!(n >= 1 && n <= 4)) return;
  const p = state.player;
  if (!p || !state.combatActive) return;
  // Straight 1:1 with the four buttons; basic attack is always slot 0.
  if (p.skills[n - 1]) selectSkill(p.skills[n - 1]);
});

