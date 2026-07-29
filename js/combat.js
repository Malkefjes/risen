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
    // The windup telegraph is the one thing worth interrupting the line for,
    // and only while you can actually answer it.
    if (state.awaitingInput && state.enemy && state.enemy.windup) {
      add(foeWord + ' CHARGING', 'turn-warn');
    }
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

  if (unit.isPlayer) {
    unit.skills.forEach(s => { if (!s.basic && s.cd > 0) s.cd--; });
    state.fightTurns++;
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
  if (skill.requiresCharges && (p.charges || 0) < skill.requiresCharges) return;
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
      logEvent('WINDUP', e, 'next strike ×' + BALANCE.enemy.windupMult,
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

function enemySwing(e) {
  const p = state.player;
  if (!p || p.hp <= 0) return;
  state.enemyActions = (state.enemyActions || 0) + 1;   // real swings only; windup/stun turns never reach here
  let mult = 1;
  if (e.windup) {
    mult = BALANCE.enemy.windupMult;
    e.windup = false;
    const fig = getFigureForUnit(e);
    if (fig) fig.style.filter = '';
  }
  const dealt = applyEnemyDamage(e, p, mult);
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

// Enemy -> player. Enemies use a flat designed damage number, not a stat formula.
// mult carries the boss windup multiplier; evade and block still apply, so
// every strain's defenses answer the big hit in its own way.
function applyEnemyDamage(e, p, mult) {
  // Anything on the attacker that changes what it hits for (weak, empower)
  // lands before the roll; anything on the defender that changes what it takes
  // (vulnerable, fortify) lands after the crit, alongside the other mitigation.
  const notes = [];
  const label = (mult && mult > 1) ? 'HEAVY ×' + mult : 'Attack';
  notes.push(...statusNotes(e, 'outgoingMult', { target: p }));
  let dmg = Math.max(1, Math.floor(e.damage * (mult || 1) * statusMult(e, 'outgoingMult', { target: p })));
  if (Math.random() < p.evadeChance) {
    logMiss(label, p, 'EVADED (' + Math.round(p.evadeChance * 100) + '%)');
    if (p.class === 'psy') bankAdjust(p, 1, 'attack evaded');   // speed → evade → streak
    floatText(p, 'EVADE', 'xp'); playAttackAnim(e, p, false); return 0;
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
    const dr = Math.min(0.85, (p.resolve||0)*P().resolveDR + statusPower(p, 'brace'));
    if (dr > 0) {
      dmg = Math.floor(dmg * (1 - dr));
      // Reported as one number because it IS one number — the sum is what the
      // cap applies to, so splitting it in the log would imply two reductions.
      notes.push('GUARD −' + Math.round(dr * 100) + '%'
        + ' (RESOLVE ×' + (p.resolve || 0) + (hasStatus(p, 'brace') ? ' + BRACE' : '') + ')');
    }
  }
  dmg = Math.max(1, dmg);
  p.hp = Math.max(0, p.hp - dmg);
  logDamage(label, p, dmg, notes.concat([logNum(p.hp) + '/' + logNum(p.maxHp) + ' left']));
  // Psy: a landed hit trims Momentum by 2 — a slip, not a reset.
  if (p.class === 'psy') {
    if (hasStatus(p, 'flow')) logEvent('MOMENTUM', p, 'held', ['FLOW blocks the loss'], 'heal');
    else bankAdjust(p, -P().momentumLossPerHit, 'hit taken');
  }
  // Unmutated: every hit taken steadies you, and Brace banks an extra.
  if (p.class === 'base') bankAdjust(p, (P().resolvePerHit||1) + statusSum(p, 'bankOnHitTaken'), 'hit taken');
  // Whatever the player is carrying that answers a hit — Spines planting a
  // Spore, Brace punching back — fires here, in one place, for any status.
  statusEach(p, 'onHitTaken', { attacker: e, damage: dmg });
  floatText(p, dmg, 'damage');
  if (blocked) floatText(p, 'BLOCK', 'xp');
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
    const healPct = p.talents.thornsHeal || 0.25;
    const feed = Math.max(1, Math.floor(thorns * healPct));
    const hpBefore = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + feed);
    if (p.hp > hpBefore) logHeal('THORNS FEED', p, p.hp - hpBefore, [Math.round(healPct * 100) + '% of thorns']);
  }
  return dmg;
}

// Player -> enemy.
function applyPlayerDamage(p, e, skill) {
  let dmg = p.atkPower * (skill.power || 1);
  // Qualifiers for the log line, collected as the number is built so each one
  // is recorded by the branch that actually applied it. A modifier that does
  // not fire adds nothing, so the line only ever lists real contributors.
  const notes = [];
  if ((skill.power || 1) !== 1) notes.push('power ×' + (skill.power || 1).toFixed(2));

  // Held Momentum is offense: psy deals more while the streak is alive, and
  // Flow multiplies what each held charge is worth.
  if (p.class === 'psy' && (p.charges || 0) > 0) {
    const flow = getStatus(p, 'flow');
    const bonus = (p.charges || 0) * P().momentumDmg * (flow ? (flow.power || 2) : 1);
    dmg *= (1 + bonus);
    notes.push('MOMENTUM ×' + p.charges + ' +' + Math.round(bonus * 100) + '%');
  }
  // Resolve (base): Last Stand scales with everything you endured.
  const resolveSpent = skill.consumesResolve ? (p.resolve || 0) : 0;
  if (resolveSpent > 0) {
    dmg += p.atkPower * (skill.perResolvePower || 0) * resolveSpent;
    notes.push('RESOLVE ×' + resolveSpent + ' spent');
  }
  // Spores (sym): Bloom Eruption scales with the harvest.
  const sporesSpent = skill.consumesSpores ? (p.spores || 0) : 0;
  if (sporesSpent > 0) {
    dmg += p.atkPower * (skill.perSporePower || 0) * sporesSpent;
    notes.push('SPORES ×' + sporesSpent + ' spent');
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
  if (skill.thornsScale) {                                  // Latch: thorns floor
    const t = getThornsDamage(p) * skill.thornsScale;
    dmg += t;
    notes.push('THORNS +' + logNum(t));
  }

  // Nothing misses. An attack is only ever avoided by the target getting out of
  // the way, so this is the enemy's evade and nothing else — there is no
  // accuracy stat on either side to roll against.
  if (Math.random() < e.evadeChance) {
    playAttackAnim(p, e, false, skill);
    floatText(e, 'EVADE', 'xp');
    // The evade chance is named because it is the whole explanation, and it is
    // the one number the player cannot see on the enemy anywhere else.
    logMiss(skill.name, e, 'EVADED (' + Math.round(e.evadeChance * 100) + '%)');
    // Psy's nemesis made visible: an evade starves the streak.
    if (p.class === 'psy') logEvent('MOMENTUM', p, 'not gained', ['attack evaded'], '');
    return false;
  }

  let isCrit = Math.random() < p.critChance;
  if (isCrit) { dmg *= p.critMult; notes.push('CRIT ×' + p.critMult.toFixed(1)); }

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
    bankAdjust(p, -resolveSpent, 'spent by ' + skill.name);
  if (skill.consumesSpores && sporesSpent > 0)
    bankAdjust(p, -sporesSpent, 'spent by ' + skill.name);
  if (skill.consumesSpines) removeStatus(p, 'spines', 'consumed by ' + skill.name);
  // Build the bank: every landed hit builds Momentum.
  if (p.class === 'psy') bankAdjust(p, 1, 'attack landed');
  // Resolve (base): landing a hit steadies you.
  if (skill.buildsResolve) bankAdjust(p, skill.buildsResolve, skill.name);

  if (skill.poison && p.class === 'bio')
    applyStatus(e, 'poison', { stacks: skill.poison, perStack: p.poisonPerStack });

  // Every POISON stack still on the target becomes a permanent TOXIN stack.
  // Deliberately NOT a detonation: it trades damage you were going to get for
  // damage you keep for the rest of the fight. The class that cannot burst
  // needs a spender that makes it weaker now, not stronger now.
  if (skill.festers) {
    const stacks = statusStacks(e, 'poison');
    if (stacks > 0) {
      // removeStatus and applyStatus each log, so the conversion reads as the
      // two halves it actually is rather than a summary line on top of them.
      removeStatus(e, 'poison', 'converted by ' + skill.name);
      applyStatus(e, 'toxin', { stacks });
    } else logEvent(skill.name, e, 'no effect', ['no POISON on target'], '');
  }

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
    // Priced CC: a stun with a stunCost only fires if the charges are there,
    // and consumes them. Mashing the spender leaves nothing for the windup.
    if (skill.stunCost) {
      if ((p.charges || 0) < skill.stunCost) {
        logEvent('STUN', null, 'not paid',
                 ['needs ' + skill.stunCost + ' MOMENTUM, have ' + (p.charges || 0)], '');
        return dmg;
      }
      bankAdjust(p, -skill.stunCost, 'spent to stun');
    }
    if (e.windup && !e.stunImmune) {
      // Interrupt: breaks the charge instead of stunning, and ARMS stagger
      // resist — the next windup cannot be canceled and must be answered
      // differently (heal, brace, tank). One rule everywhere: bosses
      // alternate CC resistance. No second action is lost, so no stun-lock.
      e.windup = false;
      const fig = getFigureForUnit(e);
      if (fig) fig.style.filter = '';
      e.stunImmune = true;
      logEvent('INTERRUPT', e, 'windup broken', ['stagger resist now armed'], 'heal');
    } else if (e.windup && e.stunImmune) {
      // The shrug clears the resist but the strike still comes.
      e.stunImmune = false;
      logEvent('STAGGER RESISTED', e, 'windup holds', ['resist consumed'], 'damage');
    } else {
      if (e.stunImmune) {
        // Without this, a 1-turn stun on a ~3-turn cooldown locks an enemy that acts
        // once per 3-4 of your turns out of the fight entirely.
        e.stunImmune = false;
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
  if (skill.requiresCharges && (caster.charges || 0) < skill.requiresCharges) return;
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
      const bonus = skill.resolveHealBonus * (caster.resolve || 0);
      frac += bonus;
      if (bonus > 0) notes.push('RESOLVE ×' + (caster.resolve || 0) + ' +' + Math.round(bonus * 100) + '%');
    }
    // Sym: Feed runs on the harvest — a Spore buys the real heal and the
    // thorns boost; starved, it's a thin patch and nothing more.
    let fed = true;
    if (skill.sporeFuel) {
      fed = (caster.spores || 0) > 0;
      if (fed) { bankAdjust(caster, -1, 'spent by ' + skill.name); frac = skill.healFracFed || frac; }
      else notes.push('STARVED, no spore');
    }
    notes.push(Math.round(frac * 100) + '% max HP');
    const amount = Math.max(1, Math.floor(caster.maxHp * frac));
    const before = caster.hp;
    caster.hp = Math.min(caster.maxHp, caster.hp + amount);
    const restored = caster.hp - before;
    floatText(caster, amount, 'heal');
    // The amount RESTORED, not the amount rolled: healing into a nearly-full
    // bar is the case where those two differ, and the restored number is the
    // one that actually happened. The overheal is named so the gap is not a
    // mystery.
    logHeal(skill.name, caster, restored,
      notes.concat([restored < amount ? 'overheal ' + logNum(amount - restored) : null,
                    logNum(caster.hp) + '/' + logNum(caster.maxHp)]));
    playCastAnim(caster, skill);
    if (skill.thornsBoost && fed)
      applyStatus(caster, 'spines', { power: skill.thornsBoost, duration: skill.thornsBoostDur || 3 });
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
        // Priced lifesteal: the hit always lands, but the heal only fires if the
        // bank can pay for it (Nerve Drain feeds on Momentum).
        if (skill.healCost && (caster.charges || 0) < skill.healCost) {
          logEvent('LIFESTEAL', null, 'not paid',
                   ['needs ' + skill.healCost + ' MOMENTUM, have ' + (caster.charges || 0)], '');
        } else {
          if (skill.healCost) bankAdjust(caster, -skill.healCost, 'spent to drain');
          const heal = Math.max(1, Math.floor(dealt * skill.lifesteal));
          const before = caster.hp;
          caster.hp = Math.min(caster.maxHp, caster.hp + heal);
          floatText(caster, heal, 'heal');
          logHeal('LIFESTEAL', caster, caster.hp - before,
                  [Math.round(skill.lifesteal * 100) + '% of ' + logNum(dealt) + ' dealt',
                   logNum(caster.hp) + '/' + logNum(caster.maxHp)]);
        }
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

  if (e.elite && e.elite.deathNova) {
    const nova = Math.max(1, Math.floor(p.maxHp * e.elite.deathNova));
    p.hp = Math.max(0, p.hp - nova);
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
    const heal = Math.floor(p.maxHp * p.talents.harvest);
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    floatText(p, heal, 'heal');
    if (p.hp > before) logHeal('HARVEST', p, p.hp - before, [Math.round(p.talents.harvest * 100) + '% max HP']);
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
  gainXP(xp);

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
  const p = state.player;
  const mins = Math.max(1, Math.round((Date.now()-state.runStart)/60000));
  showScreen('result-screen');
  const title = document.getElementById('result-title');
  title.textContent = won ? 'RISEN' : 'DEFEATED';
  title.className = 'result-title ' + (won ? 'win' : 'lose');
  const finalAct = actForWave(BALANCE.finalWave);
  const opening = won
    ? 'Act ' + finalAct.num + ': ' + finalAct.name + ' — all ' + BALANCE.finalWave + ' waves cleared. You rose.<br>'
    : 'You fell on <b>Wave ' + state.wave + '</b> in ' + getZoneName(state.wave) + '.<br>';
  document.getElementById('result-stats').innerHTML =
    opening +
    'Level ' + p.level + ' &middot; ' + state.kills + ' kills &middot; best chain ' + state.bestCombo + '&times;<br>' +
    formatNum(Math.floor(state.damageDealt)) + ' total damage over ~' + mins + ' min<br><br>' +
    '<span class="result-build">' + CLASSES[p.class].name + ' — Str ' + p.str + ' · Ins ' + p.instinct +
    ' · Spd ' + p.speed + ' · Vit ' + p.vit + '</span><br>' +
    '<span class="result-build">' + p.talentIds.length + ' mutations acquired</span>';
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
      const lacking = skill.requiresCharges && (p.charges || 0) < skill.requiresCharges;
      btn.disabled = !yourTurn || lacking;
      // The one thing left worth saying: a card that looks usable but is not,
      // and the reason why. READY and the cooldown length both described a
      // state the card already wears.
      costEl.textContent = lacking ? ('NEEDS ' + skill.requiresCharges + ' MOMENTUM') : '';
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

