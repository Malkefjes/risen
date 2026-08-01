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
  if (state.turnTimer) { clearTimeout(state.turnTimer); state.turnTimer = null; }
}
// FAST TURNS setting just compresses the pacing between actions.
const turnDelay = ms => SETTINGS.fastTurns ? Math.round(ms * 0.45) : ms;
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
             [stun.duration > 0 ? Math.ceil(stun.duration) + 't left' : 'last turn'], 'damage');
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

  if (unit.isPlayer) {
    unit.skills.forEach(s => { if (!s.basic && s.cd > 0) s.cd--; });
    state.fightTurns++;
    state.runTurns = (state.runTurns || 0) + 1;
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
               ['action ' + e.actionCount + ' of every ' + e.windupEvery], 'damage');
      const fig = getFigureForUnit(e);
      if (fig) fig.style.filter = 'brightness(1.35)';
      shake(6);
      updateUnitCard(e); updateTurnInfo(); renderSkills();
      scheduleTurn(nextTurn, turnDelay(480));
      return;
    }
  }

  enemySwing(e);
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

// WHAT A TELEGRAPH IS WORTH, and it is not one number any more: a boss
// telegraph is the fight, an elite telegraph is a skill check you meet a dozen
// times a run. See the eliteWindupMult note in the enemy table.
function windupMultFor(e) {
  const E = BALANCE.enemy;
  if (e && e.elite && !e.isBoss && E.eliteWindupMult) return E.eliteWindupMult;
  return E.windupMult;
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
  const dealt = applyEnemyDamage(e, p, mult, Object.assign({}, opts, { spoiled }));
  if (dealt > 0) playAttackAnim(e, p, true);

  if (e.elite && e.elite.lifesteal && dealt > 0) {
    const heal = Math.floor(dealt * e.elite.lifesteal);
    if (heal > 0) { e.hp = Math.min(e.maxHp, e.hp + heal); floatText(e, heal, 'heal'); }
  }
  if (e.elite && e.elite.poison && dealt > 0) {
    applyStatus(p, 'poison', { stacks:1, perStack: Math.max(1, Math.floor(e.damage*0.20)) });
  }

  updateUnitCard(p); updateUnitCard(e);
  if (p.hp <= 0) { stopCombatLoop(); endRun(); return; }
  if (e.hp <= 0 && !e._defeated) onEnemyDefeated();
}

// ---- Damage --------------------------------------------------
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
  logEvent('THORNS +' + amount, null, '(' + formatNum(p.thorns) + ')', [why], 'heal');
  updateUnitCard(p);
  return amount;
}

// UNMUTATED'S RAMP, and growThorns' sibling — the strain's number going up.
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
  const slice = Math.max(1, p.maxHp * B.thornsBigHitFrac);
  return Math.min(B.thornsGrowMax, B.thornsPerHit + Math.floor(damage / slice));
}

// SHED — sym's sustain, and the one place a run-permanent ramp can be spent.
// THE FRACTION IS A CEILING, NOT A PRICE: the shed takes only as many thorns as
// the heal actually needed, so a number that has run away makes Shed cheap in
// proportion instead of absurd (a percentage of a huge number would buy healing
// that max HP cannot hold — see the balance header). Only GROWN thorns are
// spendable; the innate share of max HP is a floor, so shedding can never leave
// you blunt.
function shedForHeal(p, skill, already, notes, critMult) {
  const grown = p.thornsGrown || 0;
  if (grown <= 0) { notes.push('nothing grown to shed'); return 0; }
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
  // make Shed a plain heal for the whole of act 1, which reads as the skill
  // being broken rather than as sustain being tight.
  const cap = Math.max(1, Math.floor(grown * (skill.capFrac || 0.25)));
  const shed = Math.max(0, Math.min(Math.ceil(missing / perThorn), cap, grown));
  if (shed <= 0) { notes.push('no THORNS needed'); return 0; }
  p.thornsGrown = grown - shed;
  applyDerivedStats(p);
  notes.push('SHED ' + shed + ' THORNS (' + formatNum(p.thorns) + ' left)');
  return shed * perThorn;
}

// PROVOKE — the class's verb, and the only button in the game that spends your
// turn to buy the ENEMY a turn. You bare your guard: the swing lands (no evade
// roll — you do not dodge a hit you invited), the spikes take it, and you grow.
//
// Against a charged telegraph it is sym's answer to the windup, and a different
// answer from psy's on purpose. A stun DELETES the heavy swing; Provoke goads
// it out early so it comes as an ordinary one — you still get hit, you just get
// hit small, and you eat for it. It shares stun's stagger-resist rule so it
// cannot lock a boss out of its telegraph forever, and the shrug is honest:
// the resist is consumed, the swing still comes, but the charge HOLDS and the
// heavy blow is still on its way.
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
    logEvent('BAITED', e, 'windup spent early', ['stagger resist now armed'], 'heal');
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
             ['resist consumed', '×' + BALANCE.enemy.windupSpoilFrac + ' of the telegraph'], 'heal');
  }
  // Grow BEFORE the swing: you raise yourself to meet it, so the thorns that
  // answer this hit are already the bigger ones.
  growThorns(p, skill.growBonus || 0, skill.name);
  enemySwing(e, { unevadable: true, ordinary });
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
  // A provoked swing skips the evade roll entirely rather than rolling and
  // discarding: you do not dodge a hit you invited, and a wasted roll would
  // shift every rules draw after it.
  if (opts && opts.unevadable) notes.push('GUARD BARED');
  else if (Math.random() < p.evadeChance) {
    state.dodges = (state.dodges || 0) + 1;
    logMiss(label, p, 'EVADED (' + Math.round(p.evadeChance * 100) + '%)');
    // A dodge used to plant DREAD for psy — the second mouth of the mechanic,
    // beside crits. Both went when Hunt started planting on hit: fear should
    // come from the button, not from two rolls the player does not make.
    floatText(p, 'EVADE', 'note'); playAttackAnim(e, p, false); return 0;
  }
  if (Math.random() < e.critChance) { dmg = Math.floor(dmg * e.critMult); notes.push('CRIT ×' + e.critMult.toFixed(1)); }
  notes.push(...statusNotes(p, 'incomingMult', { attacker: e }));
  dmg = Math.floor(dmg * statusMult(p, 'incomingMult', { attacker: e }));
  let blocked = false;
  if (Math.random() < p.blockChance) {
    blocked = true;
    dmg = Math.floor(dmg * (1 - p.blockReduction));
    notes.push('BLOCK −' + Math.round(p.blockReduction * 100) + '%');
  }
  // Unmutated: held Resolve is flat mitigation and Counterpunch braces on top
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
  logDamage(label, p, dmg, notes.concat([logNum(p.hp) + '/' + logNum(p.maxHp) + ' left']));
  // Psy: an enemy that gets its hands on you regains its nerve — the mark
  // eases instead of a player-side number draining. Same pressure, honest owner: being
  // hit still costs psy its dominance, but as the ENEMY's recovery, which is
  // both truer to the theme and visible on the card it happens to.
  if (p.class === 'psy' && e && e.hp > 0)
    shedStacks(e, 'dread', P().dreadLossPerHit, 'nerve steadied — its blow landed');
  // Unmutated: every hit taken steadies you.
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
  if (blocked) floatText(p, 'BLOCK', 'note');
  shake(Math.min(10, 2 + dmg/Math.max(1,p.maxHp)*40));

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
    state.damageDealt += thorns;
    if (e.hp <= 0) state._lastOverkill = Math.max(0, thorns - tBefore);
    floatText(e, thorns, 'damage');
    logDamage('THORNS', e, thorns, tNotes);
    // THORNS FEED IS OFF BY DEFAULT NOW, and the default is the whole change:
    // it used to lifesteal a flat 25% of every thorns tick. That was fine when
    // thorns were a static twentieth of max HP, but against a number that grows
    // all run it becomes sustain that scales with the ramp and asks nothing —
    // timing-immune healing, which the enemy-table note names as the exact
    // reason enemy numbers cannot make this game hard. Sym's faucet is SHED,
    // on a cooldown, paid for out of the ramp itself. The hook stays live so a
    // talent or mutation can hand the drip back as a visible pick.
    const healPct = p.talents.thornsHeal || 0;
    if (healPct > 0) {
      const feed = Math.max(1, Math.floor(thorns * healPct));
      const hpBefore = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + feed);
      if (p.hp > hpBefore) logHeal('THORNS FEED', p, p.hp - hpBefore, [Math.round(healPct * 100) + '% of thorns']);
    }
  }
  return dmg;
}

// A CRIT FEEDS YOUR STRAIN — PARKED FOR EVERY STRAIN, and psy was the last one
// standing in it.
//
// One sentence, four meanings, because every strain runs on something that
// wants filling: DREAD for psy, THORNS for sym, Resolve for Unmutated, and for
// bio the rot itself. Instinct buys the same sentence for everyone ("my
// mechanic is online when I need it") and cashes out as whatever the strain in
// front of you is made of.
//
// Psy's branch was live and is gone: its fear rode crits, so the strain's
// number was fed by a roll rather than by a press, and the card had to explain
// a class mechanic instead of a button. Hunt plants on hit now. What is left
// here is scaffolding — critStrainGain sits at 0 — kept because the idea is
// still the best long-term answer for Instinct, and switching it on is one
// number when a strain wants it.
//
// Every enemy-side branch guards on the enemy still standing: a killing crit
// has nothing left to frighten or rot, and a permanent status stacked onto a
// corpse would log a number that never comes due.
function creditCrit(p, e) {
  const gain = P().critStrainGain || 0;
  if (!gain) return;
  if (p.class === 'bio') {
    if (e && e.hp > 0)
      applyStatus(e, 'poison', { stacks: gain, perStack: p.poisonPerStack });
    return;
  }
  // Sym has no wallet any more — its charge IS the thorns number, so the same
  // sentence cashes out as growth rather than as a pip.
  if (p.class === 'sym') { growThorns(p, gain, 'CRIT'); return; }
  if (p.class === 'base') { gainResolve(p, gain, 'CRIT'); return; }
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
  const resolveSpent = skill.consumesResolve ? statusStacks(p, 'resolve') : 0;
  if (resolveSpent > 0) {
    dmg += p.atkPower * (skill.perResolvePower || 0) * resolveSpent;
    notes.push('RESOLVE ×' + resolveSpent + ' spent');
  }
  // Both sides' statuses meet here: what the player is carrying that raises the
  // hit (Predator, Empower) and what the enemy is carrying that softens or
  // opens it up (Fortify, Vulnerable).
  notes.push(...statusNotes(p, 'outgoingMult', { target: e }));
  notes.push(...statusNotes(e, 'incomingMult', { attacker: p }));
  dmg *= statusMult(p, 'outgoingMult', { target: e }) * statusMult(e, 'incomingMult', { attacker: p });
  if (p.talents.adrenaline && p.hp/p.maxHp < 0.35) {
    dmg *= (1 + p.talents.adrenaline);
    notes.push('ADRENALINE +' + Math.round(p.talents.adrenaline * 100) + '%');
  }
  if (p.talents.execute && e.hp/e.maxHp < 0.30) {
    dmg *= (1 + p.talents.execute);
    notes.push('EXECUTE +' + Math.round(p.talents.execute * 100) + '%');
  }
  if (p.talents.momentum) {
    const m = Math.min(0.40, state.combo * p.talents.momentum);
    dmg *= (1 + m);
    if (m > 0) notes.push('CHAIN +' + Math.round(m * 100) + '%');
  }
  if (skill.thornsBurst) {
    const t = getThornsDamage(p) * skill.thornsBurst;
    dmg += t;
    notes.push('THORNS +' + logNum(t));
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
    // Psy's nemesis made visible: an evade starves the streak.
    if (p.class === 'psy') logEvent('MOMENTUM', p, 'not gained', ['attack evaded'], '');
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
  state.damageDealt += dmg;
  if (e.hp <= 0 && before > 0) state._lastOverkill = Math.max(0, dmg - before);

  // The hit itself, with the remaining HP: the number that says whether the
  // next one finishes it, which is the decision the player is actually making.
  logDamage(skill.name, e, dmg, notes.concat([logNum(e.hp) + '/' + logNum(e.maxHp) + ' left']));

  floatText(e, dmg, 'damage', isCrit);
  if (isCrit) shake(7);

  if (skill.consumesResolve && resolveSpent > 0)
    removeStatus(p, 'resolve', 'spent by ' + skill.name);
  if (skill.consumesSpines) removeStatus(p, 'spines', 'consumed by ' + skill.name);
  // DREAD spent is DREAD gone: the enemy's fear breaks with the blow, and its
  // turn rate recovers with it. Deliberately after logDamage, so the hit line
  // reports the fear that paid for it before the removal line reports the cost.
  // And spent fear is eaten — Kill's half of DEVOUR (the death-devour in
  // onEnemyDefeated is the other; a Kill that kills consumed the stacks here,
  // so the corpse holds none and no meal is counted twice).
  // Partial by default now, so shedStacks rather than removeStatus: it takes
  // exactly what was paid for and removes the status only when the last stack
  // goes. Fear TAKEN is fear eaten — this is the one path where stacks coming
  // off feed DEVOUR, as against the enemy steadying itself, which feeds
  // nothing (see shedStacks' other callers).
  if (skill.consumesDread && dreadSpent > 0) {
    shedStacks(e, 'dread', dreadSpent, 'torn away by ' + skill.name);
    devour(p, dreadSpent, 'torn away by ' + skill.name);
  }
  // Resolve (base): landing a hit steadies you.
  if (skill.buildsResolve) gainResolve(p, skill.buildsResolve, skill.name);
  // A crit feeds your strain — parked for every strain now. See creditCrit.
  if (isCrit) creditCrit(p, e);

  if (skill.poison && p.class === 'bio')
    applyStatus(e, 'poison', { stacks: skill.poison, perStack: p.poisonPerStack });
  // Unmutated opens a wound. On-hit like the rot, so an evade costs the cut as
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
  // damage. Lands after creditCrit: a critting Terrify plants its crit stack
  // first, then the burst — same total either way, but the log reads in the
  // order the fear arrived.
  if (skill.dread && e.hp > 0)
    applyStatus(e, 'dread', { stacks: skill.dread });

  applySkillStatuses(p, skill, e);

  // Basic-attack riders (see the TALENTS block). They resolve here, after the
  // damage, so the swing that applies one is not also the swing that benefits
  // from it — the rider pays off on the next exchange, the way poison does.
  // On-hit, not on-use: an evade costs you the rider along with the damage.
  if (skill.basic && p.talents.basicRiders) {
    for (const rider of p.talents.basicRiders) {
      const def = statusDef(rider.id);
      if (!def) continue;
      applyStatus(def.kind === 'buff' ? p : e, rider.id, { power: rider.power, duration: rider.duration });
    }
  }

  if (skill.stun) {
    const stunTurns = skill.stun;
    // Gated CC, threshold not spend: Traumatize breaks a mind that is already
    // frightened enough, and BREAKING IT DOES NOT SPEND THE FEAR — the stacks
    // stay, still slowing. A threshold keeps hold-vs-spend as base's tension,
    // not psy's: psy's only cash-out is Kill. The attack still lands either
    // way; only the break is gated, and the log names what was missing.
    // Every way the break can fail gets a FLOATER, not just a log line: the
    // owner plays without reading the transcript, and three silent outcomes
    // (threshold missed, stagger resist, windup interrupt) stacked up into
    // "Traumatize doesn't work". A muted note names which rule ate the stun
    // at the moment it happens.
    if (skill.dreadNeed) {
      const held = statusStacks(e, 'dread');
      if (held < skill.dreadNeed) {
        floatText(e, 'MIND HOLDS ' + held + '/' + skill.dreadNeed, 'note');
        logEvent('STUN', null, 'mind holds',
                 ['needs ' + skill.dreadNeed + ' DREAD, it holds ' + held], '');
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
      logEvent('INTERRUPT', e, 'windup broken', ['stagger resist now armed'], 'heal');
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
               ['resist consumed', '×' + BALANCE.enemy.windupSpoilFrac + ' of the telegraph'], 'heal');
    } else {
      if (e.stunImmune) {
        // Without this, a 1-turn stun on a ~3-turn cooldown locks an enemy that acts
        // once per 3-4 of your turns out of the fight entirely.
        e.stunImmune = false;
        floatText(e, 'RESISTED', 'note');
        logEvent('STAGGER RESISTED', e, 'no stun', ['resist consumed'], 'damage');
      } else {
        applyStatus(e, 'stun', { duration: stunTurns });
        e.stunImmune = true;
      }
    }
  }
  return dmg;
}

// Statuses a skill hangs on the fight when it resolves, taken straight from the
// STATUSES registry. Same rule as the mutation riders: a 'buff' lands on the
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
  // Turn cooldowns. ceil, not round: with round, 49% CDR turned Overclock into
  // a 2-turn nuke. Floored at 1 so nothing ever becomes free.
  const fullCd = (!skill.basic && skill.cdTurns)
    ? Math.max(1, Math.ceil(skill.cdTurns * (1 - (caster.cdr||0)))) : 0;
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
    // Unmutated: Bandage patches better the deeper you're dug in.
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
    logEvent(skill.name, null, 'guard bared', null, '');
    playCastAnim(caster, skill);
    provokeSwing(caster, target, skill);
  } else if (skill.type === 'buff') {
    // Any buff at all: the skill names a status id and hands over whichever
    // fields it wants to override. Stacking and duration come from the
    // definition, so a new buff skill needs no code here — and applyStatus
    // logs it, so there is no line to write either. The old applyMsg prose
    // ("raises living spines") said less than the status badge it produced.
    logEvent(skill.name, null, 'cast', null, '');
    applyStatus(caster, skill.buff, skillStatusOpts(skill));
    applySkillStatuses(caster, skill);
    playCastAnim(caster, skill);
  } else {
    const dealt = applyPlayerDamage(caster, target, skill);
    bankLanded = !!dealt;
    if (dealt) {
      playAttackAnim(caster, target, true, skill);
      if (skill.lifesteal) {
        // No skill carries this since Nerve Drain went with the psy rework
        // (its healCost pricing went too — that read the Momentum bank, which
        // no longer exists). Kept generic: the vampiric elite's lifesteal runs
        // through its own path, so this seam is for a future player source.
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
      logEvent(skill.name, null, 'cooldown reduced to 1t', ['attack missed'], '');
    }
  }


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
  ], 'xp');

  // The death-devour: fear still riding the enemy when it dies is drunk whole.
  // This is psy's between-fight sustain — it fires exactly where wave-to-wave
  // attrition is tallied — and it is the other exit for the same meal Kill
  // eats early, which is what makes end-of-fight play a choice: cash the
  // stacks as burst, or finish with Hunt and drink them off the corpse.
  devour(p, statusStacks(e, 'dread'), 'drunk from the dying');

  if (e.elite && e.elite.deathNova) {
    const nova = Math.max(1, Math.floor(p.maxHp * e.elite.deathNova));
    p.hp = Math.max(0, p.hp - nova);
    state.damageTaken = (state.damageTaken || 0) + nova;
    floatText(p, nova, 'damage');
    logDamage('DEATH NOVA', p, nova, [
      'VOLATILE ' + Math.round(e.elite.deathNova * 100) + '% max HP',
      logNum(p.hp) + '/' + logNum(p.maxHp) + ' left'
    ]);
    shake(12);
  }

  if (p.talents.overflow && overkill > 0) {
    state.overkillCarry = Math.floor(overkill * p.talents.overflow);
    if (state.overkillCarry > 0)
      logEvent('OVERFLOW', null, logNum(state.overkillCarry) + ' carried',
               [Math.round(p.talents.overflow * 100) + '% of overkill'], 'xp');
  }
  if (p.talents.harvest) {
    const heal = Math.floor(healAnchorFor(p) * p.talents.harvest);
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    floatText(p, heal, 'heal');
    if (p.hp > before) logHeal('HARVEST', p, p.hp - before, [Math.round(p.talents.harvest * 100) + '% of ' + logNum(healAnchorFor(p))]);
  }

  const tier = Math.floor((state.wave-1)/5);
  const comboBonus = 1 + Math.min(BALANCE.combo.maxStack, state.combo) * BALANCE.combo.xpPerStack;
  const xp = Math.floor((BALANCE.xp.killBase + state.wave*BALANCE.xp.killWave + tier*BALANCE.xp.killTier)
    * e.xpMult * comboBonus);
  logEvent('XP', null, '+' + logNum(xp), [
    e.xpMult !== 1 ? 'enemy ×' + e.xpMult.toFixed(1) : null,
    comboBonus > 1 ? 'chain ×' + comboBonus.toFixed(2) : null
  ], 'xp');

  killFlash(e);
  const killedWave = state.wave;
  state.wave++;
  // A multiplied payout (elite, boss, chain) floats as the big gold number —
  // the elite's "juice" is XP, so the bonus must be unmissable when it lands.
  gainXP(xp, e.xpMult !== 1 || comboBonus > 1);

  if (p.hp <= 0) { state._defeatLock = false; stopCombatLoop(); endRun(); return; }

  // Beating the final wave's boss wins the run.
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
  scheduleTurn(doSpawn, turnDelay(BALANCE.spawnDelay * 1000 + 320));
}

function endRun(won) {
  // Re-entry guarded by state rather than by asking the result screen whether
  // it is visible — headless never shows it, and a run ending is a fact about
  // the run either way.
  if (state.runOver) return;
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

function showResultScreen() {
  // A new run can start during the beat (menu shortcuts); if the ended run is
  // no longer the current fact, the verdict belongs to nobody — skip it.
  if (!state.runOver) return;
  const won = state.won;
  const combatScreen = document.getElementById('combat-screen');
  if (combatScreen) combatScreen.classList.remove('won-beat', 'defeat-beat');
  const p = state.player;
  const mins = Math.max(1, Math.round((Date.now()-state.runStart)/60000));
  showScreen('result-screen');
  const title = document.getElementById('result-title');
  title.textContent = won ? 'RISEN' : 'DEFEATED';
  title.className = 'result-title ' + (won ? 'win' : 'lose');
  const finalAct = actForWave(BALANCE.finalWave);
  const opening = won
    ? 'Act ' + finalAct.num + ': ' + finalAct.name + ' — all ' + BALANCE.finalWave + ' waves cleared. You rose.'
    : 'You fell on <b>Wave ' + state.wave + '</b> in ' + getZoneName(state.wave) + '.';

  // The run's ledger, as a card in the save-slot family: same panel, same
  // rounded border, stats as labelled rows rather than a sentence with the
  // numbers baked in. Every value is a counter the rules incremented at the
  // moment the event happened — nothing here is recomputed or estimated.
  const row = (label, value) =>
    '<div class="result-row"><span>' + label + '</span><b>' + value + '</b></div>';
  document.getElementById('result-stats').innerHTML =
    '<div class="result-card">' +
      '<div class="result-card-head">' +
        '<span class="result-card-class ' + p.class + '">' + CLASSES[p.class].name +
          ' <i>· Level ' + p.level + '</i></span>' +
        '<span class="result-card-sub">' + opening + '</span>' +
      '</div>' +
      '<div class="result-grid">' +
        row(won ? 'Turns to win' : 'Turns survived', formatNum(state.runTurns || 0)) +
        row('Time', '~' + mins + ' min') +
        row('Damage dealt', formatNum(Math.floor(state.damageDealt))) +
        row('Damage taken', formatNum(Math.floor(state.damageTaken || 0))) +
        row('Kills', formatNum(state.kills)) +
        row('Best chain', state.bestCombo + '×') +
        row('Crits landed', formatNum(state.critsLanded || 0)) +
        row('Dodges', formatNum(state.dodges || 0)) +
      '</div>' +
      '<div class="result-card-foot">' +
        '<span class="result-build">Str ' + p.str + ' · Ins ' + p.instinct +
          ' · Spd ' + p.speed + ' · Vit ' + p.vit + '</span>' +
        '<span class="result-build">' + p.talentIds.length + ' mutation' +
          (p.talentIds.length === 1 ? '' : 's') + '</span>' +
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
    const maxCd = Math.max(1, Math.ceil(skill.cdTurns * (1 - (p.cdr||0))));
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
      // Nothing gates a ready card any more — the bank-priced skills went with
      // Momentum (Traumatize's DREAD threshold gates its STUN, not the cast).
      // The cost line stays as the seam for the next card that is usable-but-
      // not, so the reason can be said where the player is looking.
      costEl.textContent = '';
      overlay.style.display = 'none';
      if (sweep) sweep.style.height = '0%';
    }
  });
}

// Keyboard: 1-3 fire specials. When the TALENTS tab is open and a choice is waiting, 1-3 pick instead.
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
  // 1-3 still pick a mutation while that tab is open and a choice is waiting.
  const talentsTab = document.getElementById('tab-talents');
  if (n <= 3 && talentsTab && talentsTab.classList.contains('active') && state.talentOffers && state.talentOffers.picks) {
    const picks = state.talentOffers.picks;
    if (picks[n - 1]) pickTalent(picks[n - 1].id);
    return;
  }
  const p = state.player;
  if (!p || !state.combatActive) return;
  // Straight 1:1 with the four buttons; basic attack is always slot 0.
  if (p.skills[n - 1]) selectSkill(p.skills[n - 1]);
});

