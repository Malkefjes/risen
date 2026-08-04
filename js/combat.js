function startCombatLoop() {
  stopCombatLoop();
  state.combatActive = true;
  updateTurnInfo();
  if (state.awaitingInput) { renderSkills(); return; }
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

function livingEnemies() {
  return (state.enemies || []).filter(e => e && e.hp > 0 && !e._defeated);
}

function setTarget(e) {
  if (state.enemy === e) return;
  state.enemy = e || null;
  if (HEADLESS.on) return;
  document.querySelectorAll('#enemy-slot .fighter').forEach(f =>
    f.classList.toggle('targeted', !!e && f.dataset.unitId === e.id));
  renderSkills();
  refreshReadoutValues();
}

function retarget() {
  const t = state.enemy;
  if (t && t.hp > 0 && !t._defeated) return t;
  const next = livingEnemies()[0] || null;
  setTarget(next);
  return next;
}

const turnDelay = ms => Math.round(ms * BALANCE.turnPace);
function scheduleTurn(fn, ms) {

  if (HEADLESS.on) { _pendingStep = fn; return; }
  if (SETTINGS.fastTurns) ms = 0;
  if (state.turnTimer) clearTimeout(state.turnTimer);
  state.turnTimer = setTimeout(() => { state.turnTimer = null; fn(); }, ms);
}

function updateTurnInfo() {
  if (HEADLESS.on) return;
  const ti = document.getElementById('turn-info');
  if (!ti) return;
  const plain = txt => { ti.textContent = txt; };
  if (!state.combatActive) return plain('STANDING BY');
  if (state.awaitingSpawn) return plain('INCOMING');

  const packSize = (state.enemies || []).length;
  const unitWord = u => {
    if (!u || u.isPlayer) return 'YOU';
    const word = u.isBoss ? 'BOSS' : 'ENEMY';
    if (packSize < 2) return word;
    return word + '·' + ((state.enemies || []).indexOf(u) + 1);
  };
  const add = (text, cls) => {
    const s = document.createElement('span');
    if (cls) s.className = cls;
    s.textContent = text;
    ti.appendChild(s);
    return s;
  };
  const side = (text, who) => add(text, 'turn-side ' + (who === 'you' ? 'you' : 'enemy'));

  ti.textContent = '';

  if (state.active && !state.active.isPlayer) {
    side(unitWord(state.active) + ' TURN', 'foe').classList.add('turn-now');
  } else {
    side('YOUR TURN', 'you').classList.add('turn-now');
  }

  const fc = forecastTurns(3);
  if (!fc.length) return;
  add('·', 'turn-sep');
  add('UPCOMING:', 'turn-upcoming');
  fc.forEach((u, i) => {
    if (i) add('→', 'turn-arrow');
    side(unitWord(u), u.isPlayer ? 'you' : 'foe');
  });
}

function forecastTurns(n) {
  const p = state.player;
  const foes = livingEnemies();
  if (!p || p.hp <= 0 || !foes.length) return [];
  const rows = [p].concat(foes).map(u => ({ u, m: u.meter || 0, s: effectiveAps(u) }));

  const out = [];
  for (let i = 0; i < n; i++) {
    let best = null, bestT = Infinity;
    for (const r of rows) {
      const t = (1 - r.m) / r.s;
      if (t < bestT - 1e-9) { bestT = t; best = r; }
      else if (Math.abs(t - bestT) < 1e-9 && r.u.isPlayer) best = r;
    }
    for (const r of rows) r.m += bestT * r.s;
    best.m -= 1;
    out.push(best.u);
  }
  return out;
}

function advanceToNextActor() {
  const units = [state.player].concat(livingEnemies()).filter(u => u && u.hp > 0 && !u._defeated);
  if (!units.length) return null;
  let best = null, bestT = Infinity;
  for (const u of units) {
    const t = (1 - (u.meter || 0)) / effectiveAps(u);
    if (t < bestT - 1e-9) { bestT = t; best = u; }
    else if (Math.abs(t - bestT) < 1e-9 && u.isPlayer) best = u;
  }
  for (const u of units) u.meter = (u.meter || 0) + bestT * effectiveAps(u);
  best.meter -= 1;
  return best;
}

function nextTurn() {
  if (!state.combatActive) return;
  if (nextDrop() || nextModOffer()) { scheduleTurn(nextTurn, turnDelay(240)); return; }
  const p = state.player;
  if (!p || p.hp <= 0) { stopCombatLoop(); endRun(); return; }
  if (state.awaitingSpawn) { scheduleTurn(doSpawn, turnDelay(BALANCE.spawnDelay * 1000)); return; }
  if (!livingEnemies().length) return;

  const actor = advanceToNextActor();
  if (!actor) return;
  state.active = actor;

  state.turnNo++;
  logTurn(actor);

  if (tickTurnStart(actor)) return;

  const stun = getStatus(actor, 'stun');
  if (stun) {
    stun.duration--;

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
    retarget();
    setCharPose(actor, 'ready');
  } else {
    state.awaitingInput = false;
    state.pendingEnemyAct = true;
    setCharPose(state.player, 'ready');
    scheduleTurn(enemyAct, turnDelay(480));
  }
  updateTurnInfo(); renderSkills();
}

function tickTurnStart(unit) {
  if (tickStatuses(unit)) {
    if (!unit.isPlayer) {
      onEnemyDefeated(unit);
      if (livingEnemies().length) scheduleTurn(nextTurn, turnDelay(200));
      return true;
    }
    stopCombatLoop(); endRun();
    return true;
  }

  if (unit.isPlayer) {
    for (const e of livingEnemies().slice())
      if (tickStatuses(e, 'inflicted')) onEnemyDefeated(e);
    if (unit.hp <= 0) { stopCombatLoop(); endRun(); return true; }
    if (!livingEnemies().length) return true;
  } else if (unit === livingEnemies()[0]) {
    const p = state.player;
    if (p && p.hp > 0 && tickStatuses(p, 'inflicted')) {
      stopCombatLoop(); endRun();
      return true;
    }
  }

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

    const sn = strainNumberNow(unit);
    if (sn > (state.peakStrain || 0)) state.peakStrain = sn;

    if (unit.regen > 0 && unit.hp < unit.maxHp) {
      const heal = Math.max(1, Math.floor(healAnchorFor(unit) * unit.regen));
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + heal);
      floatText(unit, unit.hp - before, 'heal');
      logHeal('RECOVERY', unit, unit.hp - before,
              [Math.round(unit.regen * 100) + '% of ' + logNum(healAnchorFor(unit)) + ' per turn']);
    }

    if (unit.class === 'psy' && unit.hp < unit.maxHp) {
      const stacks = livingEnemies().reduce((n, e) => n + statusStacks(e, 'dread'), 0);
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

    if (unit.class === 'sym' && unit.hp < unit.maxHp && unit.thorns > 0) {
      const frac = Math.min(P().thornsSiphonCap || 0, unit.thorns * (P().thornsSiphonFrac || 0));
      const heal = Math.max(1, Math.floor(healAnchorFor(unit) * frac));
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + heal);
      floatText(unit, unit.hp - before, 'heal');
      logHeal('GRAFT', unit, unit.hp - before, [
        'THORNS ×' + formatNum(unit.thorns),
        logNum(unit.hp) + '/' + logNum(unit.maxHp)
      ]);
    }

    if (unit.class === 'hyd' && unit.hp < unit.maxHp) {
      const held = statusStacks(unit, 'pressure');
      if (held > 0) {
        const frac = Math.min(P().pressureSiphonCap || 0, held * (P().pressureSiphonFrac || 0));
        const heal = Math.max(1, Math.floor(healAnchorFor(unit) * frac));
        const before = unit.hp;
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        floatText(unit, unit.hp - before, 'heal');
        logHeal('BLEED-OFF', unit, unit.hp - before, [
          'PRESSURE ×' + held,
          logNum(unit.hp) + '/' + logNum(unit.maxHp)
        ]);
      }
    }
  }
  updateUnitCard(unit);
  return false;
}

function playerAct(skill) {
  const p = state.player;
  if (!state.combatActive || !state.awaitingInput) return;
  if (!p || p.hp <= 0 || !skill) return;
  if (!skill.basic && skill.cd > 0) return;
  const needsEnemy = skill.target !== 'self';
  if (needsEnemy && !retarget()) return;

  state.awaitingInput = false;

  state.skillUses = state.skillUses || {};
  state.skillUses[skill.id] = (state.skillUses[skill.id] || 0) + 1;
  fireSkill(p, skill, needsEnemy ? state.enemy : p);
  updateTurnInfo(); renderSkills();

  if (p.hp <= 0) return;
  if (state.awaitingSpawn || !livingEnemies().length) return;
  scheduleTurn(nextTurn, turnDelay(480));
}

function enemyAct() {
  if (!state.combatActive) return;
  state.pendingEnemyAct = false;
  const e = state.active, p = state.player;
  if (!p || p.hp <= 0) { stopCombatLoop(); endRun(); return; }
  if (!e || e.isPlayer || e.hp <= 0 || e._defeated) { scheduleTurn(nextTurn, turnDelay(200)); return; }

  if (e.windupEvery > 0 && !e.windup) {
    e.actionCount = (e.actionCount || 0) + 1;
    if (e.actionCount % (e.windupEvery || BALANCE.enemy.windupEvery) === 0) {
      e.windup = true;
      e.windupSpoiled = false;
      logEvent('WINDUP', e, 'next strike ×' + windupMultFor(e),
               ['action ' + e.actionCount + ' of every ' + e.windupEvery]);

      if (e.verb === 'guard')
        applyStatus(e, 'fortify', { duration: 1, power: ENEMY_VERBS.guard.power });
      const fig = getFigureForUnit(e);
      if (fig) fig.style.filter = 'brightness(1.35)';
      updateUnitCard(e); updateTurnInfo(); renderSkills();
      scheduleTurn(nextTurn, turnDelay(480));
      return;
    }
  }

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
  if (state.awaitingSpawn) return;
  scheduleTurn(nextTurn, turnDelay(480));
}

function doSpawn() {
  if (!state.combatActive) return;
  if (nextDrop() || nextModOffer()) { scheduleTurn(doSpawn, turnDelay(240)); return; }
  spawnEnemy();
  if (!state.player || state.player.hp <= 0) return;
  if (!livingEnemies().length) return;
  scheduleTurn(nextTurn, turnDelay(260));
}

function windupMultFor(e) {
  const E = BALANCE.enemy;
  const zone = (e && e.zone) ? ZONES.find(z => z.num === e.zone) : null;
  if (e && e.elite && !e.isBoss)
    return (zone && zone.eliteWindupMult) || E.eliteWindupMult || E.windupMult;
  return (zone && zone.windupMult) || E.windupMult;
}

function enemySwing(e, opts) {
  const p = state.player;
  if (!p || p.hp <= 0) return;
  state.enemyActions = (state.enemyActions || 0) + 1;
  state.actionsSinceKill = (state.actionsSinceKill || 0) + 1;
  let mult = 1;
  let spoiled = false;
  if (e.windup && !(opts && opts.ordinary)) {

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

  if ((e.poisonHits || (e.elite && e.elite.poison)) && dealt > 0) {
    applyStatus(p, 'poison', { stacks:1, perStack: Math.max(1, Math.floor(e.damage*0.20)) });
  }

  updateUnitCard(p); updateUnitCard(e);
  if (p.hp <= 0) { stopCombatLoop(); endRun(); return; }
  if (e.hp <= 0 && !e._defeated) onEnemyDefeated(e);
}

function getPoisonDamage(e) {
  const st = getStatus(e, 'poison');
  if (!st) return 0;
  return Math.floor((st.perStack || 1) * (st.stacks || 0));
}

function getThornsDamage(p) {
  if (!p || !(p.thorns > 0)) return 0;
  return Math.floor(p.thorns * statusMult(p, 'thornsMult'));
}

function growThorns(p, amount, why) {
  if (!p || p.class !== 'sym' || !(amount > 0) || p.hp <= 0) return 0;
  p.thornsGrown = (p.thornsGrown || 0) + amount;
  applyDerivedStats(p);
  floatText(p, '+' + amount + ' THORNS', 'tally');
  logEvent('THORNS +' + amount, null, '(' + formatNum(p.thorns) + ')', [why]);
  updateUnitCard(p);
  return amount;
}

function cleansePoison(unit, n, why) {
  if (!unit || !unit.isPlayer || !(n > 0)) return 0;
  if (statusStacks(unit, 'poison') <= 0) return 0;
  const took = shedStacks(unit, 'poison', n, why);
  if (took > 0) floatText(unit, '−' + took + ' POISON', 'tally');
  return took;
}

function gainPressure(p, amount) {
  if (!p || p.class !== 'hyd' || !(amount > 0) || p.hp <= 0) return 0;
  amount = Math.max(1, Math.round(amount * pressureRate(p)));
  applyStatus(p, 'pressure', { stacks: amount });
  applyDerivedStats(p);
  floatText(p, '+' + amount + ' PRESSURE', 'tally');
  return amount;
}

function gainResolve(p, amount, why) {
  if (!p || p.class !== 'base' || !(amount > 0) || p.hp <= 0) return 0;
  applyStatus(p, 'resolve', { stacks: amount });

  applyDerivedStats(p);
  floatText(p, '+' + amount + ' RESOLVE', 'tally');
  return amount;
}

function thornsGrowthFor(p, damage) {
  const B = P();

  const share = Math.max(0, damage) / Math.max(1, p.maxHp);

  const bonus = statBonusStacks(p, 'vit', B.thornsPerVit);
  return Math.max(B.thornsPerHit, Math.round(B.thornsPerHit + share * B.thornsPerBar)) + bonus;
}

function shedForHeal(p, skill, already, notes, critMult) {

  const grown = Math.max(0, (p.thornsGrown || 0) - (p.thornsShedded || 0));
  if (grown <= 0) { notes.push('nothing standing to shed'); return 0; }

  const perThorn = Math.max(1, Math.floor(healAnchorFor(p) * (skill.hpPerThorn || 0) * (critMult || 1)));
  const missing = Math.max(0, p.maxHp - p.hp - already);

  const cap = Math.max(1, Math.floor(grown * (skill.capFrac || 0.25)));
  const shed = Math.max(0, Math.min(Math.ceil(missing / perThorn), cap, grown));
  if (shed <= 0) { notes.push('no THORNS needed'); return 0; }
  p.thornsShedded = (p.thornsShedded || 0) + shed;
  applyDerivedStats(p);
  notes.push('SHED ' + shed + ' THORNS (' + formatNum(p.thorns) + ' left, regrow next fight)');
  return shed * perThorn;
}

function provokeSwing(p, e, skill) {
  if (!e || e.hp <= 0 || e._defeated) return;

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

    e.stunImmune = false;
    e.windupSpoiled = true;
    ordinary = false;
    floatText(e, 'SPOILED', 'note');
    logEvent('CHARGE SPOILED', e, 'dragged out early, and smaller',
             ['resist consumed', '×' + BALANCE.enemy.windupSpoilFrac + ' of the telegraph']);
  }

  enemySwing(e, { unevadable: true, ordinary });

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

  }
}

function applyEnemyDamage(e, p, mult, opts) {

  const notes = [];

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

  if (hasRule(p, 'redline')) {
    dmg = Math.floor(dmg * (1 + ruleVal(p, 'redline', 0.10)));
    notes.push('REDLINE +' + Math.round(ruleVal(p, 'redline', 0.10) * 100) + '%');
  }

  const layers = [['ARMOR', p.armor || 0], ['EVASION', p.evasion || 0]];

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

  if (p.class === 'base') {

    const held = statusStacks(p, 'resolve');
    const dr = Math.min(0.85, held*P().resolveDR + statusPower(p, 'brace'));
    if (dr > 0) {
      dmg = Math.floor(dmg * (1 - dr));

      notes.push('GUARD −' + Math.round(dr * 100) + '%'
        + ' (RESOLVE ×' + held + (hasStatus(p, 'brace') ? ' + BRACE' : '') + ')');
    }
  }
  dmg = Math.max(1, dmg);

  const ff = (state._fightFlags = state._fightFlags || {});
  if (!ff.bulwark && dmg >= p.maxHp * ruleVal(p, 'bigHitHalve', 0.25) && hasRule(p, 'bigHitHalve')) {
    const blunted = dmg;
    dmg = Math.max(1, Math.floor(dmg / 2));
    ff.bulwark = true;
    state.damagePrevented = (state.damagePrevented || 0) + (blunted - dmg);
    notes.push('BULWARK PLATE −50%');
  }
  p.hp = Math.max(0, p.hp - dmg);
  state.damageTaken = (state.damageTaken || 0) + dmg;

  if (p.hp <= 0) state.killedBy = { name: e ? e.name : 'unknown', heavy: mult > 1, dmg };
  logDamage(label, p, dmg, notes.concat([logNum(p.hp) + '/' + logNum(p.maxHp) + ' left']));

  if (p.hp > 0 && p.hp < p.maxHp * 0.35 && !ff.autosuture && hasRule(p, 'autosuture')) {
    ff.autosuture = true;
    const heal = Math.max(1, Math.floor(healAnchorFor(p) * ruleVal(p, 'autosuture', 0.20)));
    const hb = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    floatText(p, p.hp - hb, 'heal');
    logHeal('AUTOSUTURE', p, p.hp - hb, ['once per fight', logNum(p.hp) + '/' + logNum(p.maxHp)]);
  }

  if (p.class === 'psy' && e && e.hp > 0)
    shedStacks(e, 'dread', P().dreadLossPerHit, 'nerve steadied — its blow landed');

  if (p.class === 'base')
    gainResolve(p, (P().resolvePerHit||1) + statusSum(p, 'resolveOnHitTaken'), 'hit taken');

  if (p.class === 'sym' && dmg > 0)
    growThorns(p, thornsGrowthFor(p, dmg), 'hit taken' + (dmg >= p.maxHp * P().thornsBigHitFrac ? ' (big hit)' : ''));

  statusEach(p, 'onHitTaken', { attacker: e, damage: dmg });
  floatText(p, dmg, 'damage');

  let thorns = getThornsDamage(p);
  const tNotes = [];
  if (thorns > 0) tNotes.push('thorns ' + logNum(thorns));

  if (dmg > 0 && hasRule(p, 'reflect10')) {
    const r = Math.max(1, Math.floor(dmg * ruleVal(p, 'reflect10', 0.10)));
    thorns += r;
    tNotes.push('husk plate ' + logNum(r));
  }

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

  }
  return dmg;
}

function devour(p, stacks, why) {
  if (!p || p.class !== 'psy' || !(stacks > 0) || p.hp <= 0) return;

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

function applyPlayerDamage(p, e, skill, opts) {
  let dmg = p.atkPower * (skill.power || 1);

  const notes = [];
  if ((skill.power || 1) !== 1) notes.push('power ×' + (skill.power || 1).toFixed(2));

  const dreadHeld = skill.consumesDread ? statusStacks(e, 'dread') : 0;
  const dreadSpent = Math.ceil(dreadHeld * (skill.consumeFrac || 1));
  if (dreadSpent > 0) {
    dmg += p.atkPower * (skill.perDreadPower || 0) * dreadSpent;
    notes.push('DREAD ×' + dreadSpent + ' torn away'
      + (dreadSpent < dreadHeld ? ' (×' + (dreadHeld - dreadSpent) + ' left)' : ''));
  }

  const pressureHeld = skill.consumesPressure ? statusStacks(p, 'pressure') : 0;
  if (pressureHeld > 0) {
    dmg += p.atkPower * (skill.perPressurePower || 0) * pressureHeld;
    notes.push('PRESSURE \u00d7' + pressureHeld + ' vented');
  }
  const resolveHeld = skill.consumesResolve ? statusStacks(p, 'resolve') : 0;
  const resolveSpent = Math.ceil(resolveHeld * (skill.consumeFrac || 1));
  if (resolveSpent > 0) {
    dmg += p.atkPower * (skill.perResolvePower || 0) * resolveSpent;
    notes.push('RESOLVE ×' + resolveSpent + ' spent'
      + (resolveSpent < resolveHeld ? ' (×' + (resolveHeld - resolveSpent) + ' left)' : ''));
  }

  notes.push(...statusNotes(p, 'outgoingMult', { target: e }));
  notes.push(...statusNotes(e, 'incomingMult', { attacker: p }));
  dmg *= statusMult(p, 'outgoingMult', { target: e }) * statusMult(e, 'incomingMult', { attacker: p });
  if (skill.thornsBurst) {
    const t = getThornsDamage(p) * skill.thornsBurst;
    dmg += t;
    notes.push('THORNS +' + logNum(t));
  }
  if (skill.poisonScale) {
    const t = getPoisonDamage(e) * skill.poisonScale;
    if (t > 0) {
      dmg += t;
      notes.push('+' + logNum(t) + ' from POISON');
    }
  }
  if (skill.thornsScale) {
    const t = getThornsDamage(p) * skill.thornsScale;
    dmg += t;

    notes.push('+' + logNum(t) + ' from THORNS');
  }

  if (Math.random() < e.evadeChance) {
    playAttackAnim(p, e, false, skill);
    floatText(e, 'EVADE', 'note');

    logMiss(skill.name, e, 'EVADED (' + Math.round(e.evadeChance * 100) + '%)');
    return false;
  }

  const cullBonus = (e.maxHp && e.hp < e.maxHp * 0.5 && hasRule(p, 'cullCrit'))
    ? ruleVal(p, 'cullCrit', 0.15) : 0;
  const rolled = Math.random() < p.critChance + cullBonus;
  let isCrit = rolled || !!skill.alwaysCrit;

  const ff = (state._fightFlags = state._fightFlags || {});
  if (!ff.firstCrit && hasRule(p, 'firstCrit')) {
    if (!isCrit) notes.push('APEX LENS: first strike');
    isCrit = true;
  }
  ff.firstCrit = true;

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

  if (e.hp <= 0 && hasRule(p, 'overspill')) {
    const spill = Math.max(0, dmg - before);
    const next = livingEnemies().find(x => x !== e);
    if (spill > 0 && next) {
      const nb = next.hp;
      next.hp = Math.max(0, next.hp - spill);
      creditDamage('Momentum', spill);
      if (next.hp <= 0) state._lastOverkill = Math.max(0, spill - nb);
      floatText(next, spill, 'damage');
      logDamage('OVERSPILL', next, spill,
        ['MOMENTUM GAUNTLETS', logNum(next.hp) + '/' + logNum(next.maxHp) + ' left']);
      updateUnitCard(next);
    }
  }

  logDamage(skill.name, e, dmg, notes.concat([logNum(e.hp) + '/' + logNum(e.maxHp) + ' left']));

  floatText(e, dmg, 'damage', isCrit);

  if (!opts || !opts.holdConsume) {
    if (skill.consumesResolve && resolveSpent > 0)
      shedStacks(p, 'resolve', resolveSpent, 'spent by ' + skill.name);
    if (pressureHeld > 0) {
      removeStatus(p, 'pressure', 'vented');
      applyDerivedStats(p);
    }
    if (skill.consumesSpines) removeStatus(p, 'spines', 'consumed by ' + skill.name);
  }

  if (skill.consumesDread && dreadSpent > 0) {
    shedStacks(e, 'dread', dreadSpent, 'torn away by ' + skill.name);
    devour(p, dreadSpent, 'torn away by ' + skill.name);
  }

  if (skill.buildsResolve) gainResolve(p, skill.buildsResolve, skill.name);

  if (skill.growBonus) growThorns(p, skill.growBonus, skill.name);

  if (skill.pressure) gainPressure(p, skill.pressure);
  if (skill.poison && p.class === 'bio')

    applyStatus(e, 'poison', { stacks: poisonStacks(p, skill), perStack: p.poisonPerStack });

  if (skill.bleed && p.class === 'base' && e.hp > 0)

    applyStatus(e, 'bleed', { stacks: bleedStacks(p), perStack: bleedDepth(p) });

  if (skill.dread && e.hp > 0)
    applyStatus(e, 'dread', { stacks: dreadStacks(p, skill) });

  applySkillStatuses(p, skill, e);

  if (skill.stun) {
    const stunTurns = skill.stun;

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

      e.windup = false;
      e.windupSpoiled = false;
      const fig = getFigureForUnit(e);
      if (fig) fig.style.filter = '';
      e.stunImmune = true;
      floatText(e, 'INTERRUPTED', 'note');
      logEvent('INTERRUPT', e, 'windup broken', ['stagger resist now armed']);
    } else if (e.windup && e.stunImmune) {

      e.stunImmune = false;
      e.windupSpoiled = true;
      floatText(e, 'SPOILED', 'note');
      logEvent('CHARGE SPOILED', e, 'the charge holds, and it is smaller',
               ['resist consumed', '×' + BALANCE.enemy.windupSpoilFrac + ' of the telegraph']);
    } else {
      if (e.stunImmune) {

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

function applySkillStatuses(caster, skill, foe) {
  if (!Array.isArray(skill.applies)) return;
  for (const a of skill.applies) {
    const def = statusDef(a.id);
    if (!def) continue;
    if (def.kind === 'buff') {
      if (caster.hp > 0) applyStatus(caster, a.id, { power: a.power, duration: a.duration });
      continue;
    }
    const foes = caster.isPlayer ? (foe ? [foe] : livingEnemies()) : [state.player];
    for (const u of foes)
      if (u && u.hp > 0) applyStatus(u, a.id, { power: a.power, duration: a.duration });
  }
}

function spendHeldPiles(p, skill) {
  if (skill.consumesPressure && statusStacks(p, 'pressure') > 0) {
    removeStatus(p, 'pressure', 'vented');
    applyDerivedStats(p);
  }
  if (skill.consumesResolve) {
    const held = statusStacks(p, 'resolve');
    const spent = Math.ceil(held * (skill.consumeFrac || 1));
    if (spent > 0) shedStacks(p, 'resolve', spent, 'spent by ' + skill.name);
  }
  if (skill.consumesSpines) removeStatus(p, 'spines', 'consumed by ' + skill.name);
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

  let bankLanded = true;
  if (skill.type === 'heal') {
    let frac = skill.healFrac || 0.1;
    const notes = [];

    if (skill.resolveHealBonus) {
      const bonus = skill.resolveHealBonus * statusStacks(caster, 'resolve');
      frac += bonus;
      if (bonus > 0) notes.push('RESOLVE ×' + statusStacks(caster, 'resolve') + ' +' + Math.round(bonus * 100) + '%');
    }
    notes.push(Math.round(frac * 100) + '% of ' + logNum(healAnchorFor(caster)));

    const critMult = healCritMult(caster);
    if (critMult > 1) notes.push('CRIT ×' + critMult);
    let amount = Math.max(1, Math.floor(healAnchorFor(caster) * frac * critMult));

    if (skill.shedFuel) amount += shedForHeal(caster, skill, amount, notes, critMult);
    const before = caster.hp;
    caster.hp = Math.min(caster.maxHp, caster.hp + amount);
    const restored = caster.hp - before;
    floatText(caster, amount, 'heal', critMult > 1);

    logHeal(skill.name, caster, restored,
      notes.concat([restored < amount ? 'overheal ' + logNum(amount - restored) : null,
                    logNum(caster.hp) + '/' + logNum(caster.maxHp)]));
    playCastAnim(caster, skill);
  } else if (skill.type === 'provoke') {

    logEvent(skill.name, null, 'guard bared');
    playCastAnim(caster, skill);
    growThorns(caster, skill.growBonus || 0, skill.name);
    for (const foe of livingEnemies().slice()) {
      if (caster.hp <= 0) break;
      provokeSwing(caster, foe, skill);
    }
  } else if (skill.type === 'buff') {

    logEvent(skill.name, null, 'cast');
    applyStatus(caster, skill.buff, skillStatusOpts(skill));
    applySkillStatuses(caster, skill);

    if (skill.pressure) gainPressure(caster, skill.pressure);
    playCastAnim(caster, skill);
  } else {
    const targets = (skill.shape === 'all' && caster.isPlayer)
      ? livingEnemies().slice() : [target];
    const hold = targets.length > 1;
    let landed = false;
    for (const t of targets) {
      if (!t || t.hp <= 0 || t._defeated) continue;
      const dealt = applyPlayerDamage(caster, t, skill, hold ? { holdConsume: true } : null);
      if (dealt) {
        landed = true;
        playAttackAnim(caster, t, true, skill);
        if (skill.lifesteal) {

          const heal = Math.max(1, Math.floor(dealt * skill.lifesteal));
          const before = caster.hp;
          caster.hp = Math.min(caster.maxHp, caster.hp + heal);
          floatText(caster, heal, 'heal');
          logHeal('LIFESTEAL', caster, caster.hp - before,
                  [Math.round(skill.lifesteal * 100) + '% of ' + logNum(dealt) + ' dealt',
                   logNum(caster.hp) + '/' + logNum(caster.maxHp)]);
        }
      }
      if (caster.hp <= 0) break;
    }
    if (hold && landed) spendHeldPiles(caster, skill);
    bankLanded = landed;
    if (!landed && fullCd) {

      skill.cd = 1;
      logEvent(skill.name, null, 'cooldown reduced to 1t', ['attack missed']);
    }
  }

  if (skill.cleanse) cleansePoison(caster, skill.cleanse, skill.name);

  updateUnitCard(caster); updateUnitCard(target); renderSkills();
  for (const e2 of (state.enemies || []))
    if (e2 && e2.hp <= 0 && !e2._defeated) onEnemyDefeated(e2);
}

function selectSkill(skill) { playerAct(skill); }

function onEnemyDefeated(e) {
  e = e || state.enemy;
  if (!e || e._defeated) return;
  e._defeated = true;

  const killedWave = e.waveNo || state.wave;
  const p = state.player;
  const overkill = state._lastOverkill || 0;
  state._lastOverkill = 0;

  state.kills++;

  const chained = (state.actionsSinceKill || 0) <= BALANCE.combo.maxEnemyActionsPerKill;
  state.actionsSinceKill = 0;
  if (chained) state.combo++;
  else state.combo = 1;
  if (state.combo > state.bestCombo) state.bestCombo = state.combo;
  updateCombo();

  logEvent('DEFEATED', e, null, [
    state.turnNo + ' turns',
    state.enemyActions + ' enemy actions',
    chained ? 'CHAIN ' + state.combo + '×'
            : 'CHAIN reset (over ' + BALANCE.combo.maxEnemyActionsPerKill + ')',
    overkill > 0 ? 'overkill ' + logNum(overkill) : null
  ]);

  devour(p, statusStacks(e, 'dread'), 'drunk from the dying');

  if (p && p.hp > 0 && hasRule(p, 'hasteKill'))
    applyStatus(p, 'haste', { duration: 2, power: 0.30 });

  if (p && p.class === 'bio') {
    const left = statusStacks(e, 'poison');

    const frac = p.modCarryFrac != null ? p.modCarryFrac : (P().poisonCarryFrac || 0);
    const carry = Math.floor(left * frac);
    const host = livingEnemies()[0] || null;
    if (carry > 0 && host) {
      applyStatus(host, 'poison', { stacks: carry, perStack: p.poisonPerStack });
      floatText(host, '+' + carry + ' POISON', 'tally');
      logEvent('THE ROT JUMPS', host, '×' + carry + ' POISON',
               ['half of ×' + left + ' on the dying host']);
    } else {
      p.poisonCarry = carry;
      if (carry > 0)
        logEvent('THE ROT HOLDS', null, '×' + carry + ' POISON',
                 ['half of ×' + left + ' on the body', 'moves to the next host']);
    }
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

  const tier = Math.floor((killedWave-1)/5);
  const comboBonus = 1 + Math.min(BALANCE.combo.maxStack, state.combo) * BALANCE.combo.xpPerStack;
  const gearXp = 1 + gearMod(p, 'xpBoost');
  const xp = Math.floor((BALANCE.xp.killBase + killedWave*BALANCE.xp.killWave + tier*BALANCE.xp.killTier)
    * e.xpMult * comboBonus * gearXp);
  logEvent('XP', null, '+' + logNum(xp), [
    e.xpMult !== 1 ? 'enemy ×' + e.xpMult.toFixed(1) : null,
    comboBonus > 1 ? 'chain ×' + comboBonus.toFixed(2) : null,
    gearXp > 1 ? 'suit ×' + gearXp.toFixed(2) : null
  ]);

  killFlash(e);

  gainXP(xp, e.xpMult !== 1 || comboBonus > 1);

  if (p.hp <= 0) { stopCombatLoop(); endRun(); return; }

  const drop = rollDrop(e, killedWave);
  if (drop) queueDrop(drop);

  if (livingEnemies().length) {
    if (state.enemy === e) retarget();
    saveRun();
    updateTurnInfo(); renderSkills();
    return;
  }

  if (state._waveCleared) return;
  state._waveCleared = true;
  state.wave = killedWave + 1;

  if (killedWave >= BALANCE.finalWave) {
    stopCombatLoop();
    endRun(true);
    return;
  }

  state.awaitingSpawn = true;
  state.awaitingInput = false;
  state.pendingEnemyAct = false;
  saveRun();
  updateTurnInfo(); renderSkills();

  if (modDueAfter(killedWave) && p) {
    const offer = offerMods(p);
    if (offer.length) queueMods(offer);
  }
  resumeAfterKill();
}

function resumeAfterKill() {

  scheduleTurn(doSpawn, turnDelay(BALANCE.spawnDelay * 1000 + 320));
}


function creditDamage(source, amount) {
  if (!(amount > 0)) return;
  state.damageDealt += amount;
  const t = (state.dmgBySource = state.dmgBySource || {});
  t[source] = (t[source] || 0) + Math.floor(amount);
}

function strainNumberNow(p) {
  if (!p) return 0;
  if (p.class === 'sym')  return p.thorns || 0;
  if (p.class === 'base') return statusStacks(p, 'resolve');
  if (p.class === 'hyd')  return statusStacks(p, 'pressure');
  if (p.class === 'psy')  return livingEnemies().reduce((n, e) => n + statusStacks(e, 'dread'), 0);
  if (p.class === 'bio')  return livingEnemies().reduce((n, e) => n + statusStacks(e, 'poison'), 0);
  return 0;
}

function endRun(won) {

  if (state.runOver) return;

  state.runOver = true;
  state.won = !!won;
  stopCombatLoop();
  clearSavedRun();
  if (HEADLESS.on) return;

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

function waveReached() {
  return state.won ? BALANCE.finalWave : state.wave;
}

const STRAIN_LABEL = { bio:'POISON', psy:'DREAD', sym:'THORNS', hyd:'PRESSURE', base:'RESOLVE' };

function damageBreakdown() {
  const t = state.dmgBySource || {};
  const rows = Object.keys(t).map(k => ({ name: k, dmg: t[k] })).filter(r => r.dmg > 0);
  const total = rows.reduce((a, r) => a + r.dmg, 0);
  rows.sort((a, b) => b.dmg - a.dmg);
  rows.forEach(r => { r.pct = total ? r.dmg / total : 0; });
  return rows;
}

function buttonUsage(p) {
  const u = state.skillUses || {};
  return (p.skills || []).map(sk => ({ name: sk.name, uses: u[sk.id] || 0 }));
}

function runReport() {
  const p = state.player, won = state.won;

  const N = n => Math.floor(Number(n) || 0).toLocaleString('en-US');
  const mins = Math.max(1, Math.round((Date.now() - state.runStart) / 60000));
  const zone = zoneForWave(waveReached());
  const L = [];
  const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));

  L.push('RISEN run report — build ' + BUILD);
  L.push((won ? 'EXTRACTED (won)' : 'LOST') + ' · Wave ' + waveReached() + '/' + BALANCE.finalWave
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

function showResultScreen() {

  if (!state.runOver) return;
  const won = state.won;
  const combatScreen = document.getElementById('combat-screen');
  if (combatScreen) combatScreen.classList.remove('won-beat', 'defeat-beat');
  const p = state.player;
  const mins = Math.max(1, Math.round((Date.now() - state.runStart) / 60000));
  showScreen('result-screen');

  const esc = t => String(t).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const zone = zoneForWave(waveReached());

  const story = won
    ? 'All ' + BALANCE.finalWave + ' waves cleared. You reached the source.'
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
        (won ? 'EXTRACTED' : 'LOST') + '</div>' +
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

      costEl.textContent = '';
      return;
    }
    const maxCd = skill.cdTurns;
    if (skill.cd > 0) {
      btn.classList.add('on-cd'); btn.classList.remove('ready');
      btn.disabled = true;

      costEl.textContent = '';
      overlay.style.display = 'flex';
      overlay.textContent = skill.cd;
      if (sweep) sweep.style.height = Math.min(100, (skill.cd/maxCd)*100) + '%';
    } else {
      btn.classList.remove('on-cd'); btn.classList.add('ready');
      btn.disabled = !yourTurn;

      costEl.textContent = '';
      overlay.style.display = 'none';
      if (sweep) sweep.style.height = '0%';
    }
  });
}

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

  if (p.skills[n - 1]) selectSkill(p.skills[n - 1]);
});
