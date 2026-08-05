function showScreen(id) {
  if (HEADLESS.on) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

let _pendingClass = null;

function claimPendingClass() {
  const id = _pendingClass;
  _pendingClass = null;
  return id;
}

let _pendingKit = null;

function setPendingKit(k) { _pendingKit = Array.isArray(k) ? k.slice() : null; }
function claimPendingKit() {
  const k = _pendingKit;
  _pendingKit = null;
  return k;
}

function openClassSelect() {
  _pendingClass = null;
  _pendingKit = null;
  document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
  const btn = document.getElementById('start-btn');
  if (btn) { btn.disabled = true; btn.className = 'ui-btn is-primary'; }
  renderKitPicker(null);
  showScreen('class-screen');
}

function selectClass(id) {
  if (!CLASSES[id]) return;
  _pendingClass = id;
  _pendingKit = defaultKit(id);
  document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
  document.querySelector('.class-card.' + id).classList.add('selected');
  renderKitPicker(id);
  syncStartBtn();
}

function toggleKitSkill(sid) {
  const cls = _pendingClass;
  if (!cls || !kitPool(cls).some(s => s.id === sid)) return;
  const kit = _pendingKit || (_pendingKit = []);
  const i = kit.indexOf(sid);
  if (i >= 0) kit.splice(i, 1);
  else if (kit.length < KIT_SLOTS) kit.push(sid);
  renderKitPicker(cls);
  syncStartBtn();
}

function syncStartBtn() {
  const btn = document.getElementById('start-btn');
  if (!btn) return;
  const id = _pendingClass;
  const ready = !!id && (_pendingKit || []).length === Math.min(KIT_SLOTS, kitPool(id).length);
  btn.disabled = !ready;
  btn.className = 'ui-btn is-primary' + (id ? ' strain-' + id : '');
}

function renderKitPicker(classId) {
  const el = document.getElementById('kit-picker');
  if (!el) return;
  if (!classId || !CLASSES[classId]) { el.innerHTML = ''; el.classList.remove('on'); return; }
  const pool = kitPool(classId), kit = _pendingKit || [];
  const choosing = pool.length > KIT_SLOTS;
  const basic = CLASSES[classId].skills.find(s => s.basic);
  const card = (s, tag, on) => {
    const body = '<div class="kit-name">' + s.name + (tag ? '<i>' + tag + '</i>' : '') + '</div>'
      + '<div class="kit-desc">' + fmtDesc(s) + '</div>';
    if (!choosing) return '<div class="kit-card locked strain-' + classId + '">' + body + '</div>';
    return '<button type="button" class="kit-card strain-' + classId + (on ? ' fitted' : '')
      + '" onclick="toggleKitSkill(\'' + s.id + '\')">' + body + '</button>';
  };
  el.classList.add('on');
  el.innerHTML =
    '<div class="kit-head"><b>ABILITIES</b>' +
      (choosing ? '<span>FIT ' + KIT_SLOTS + ' — ' + kit.length + '/' + KIT_SLOTS + ' fitted</span>' : '') +
    '</div>' +
    '<div class="kit-cards">' +
      (basic ? card(basic, choosing ? 'ALWAYS' : '', false) : '') +
      pool.map(s => card(s, choosing && kit.includes(s.id) ? 'FITTED' : '', kit.includes(s.id))).join('') +
    '</div>';
}
function recalcPlayerStats(){ if (state.player) applyDerivedStats(state.player); }

const KIT_SLOTS = 3;
function kitPool(classId) {
  const cls = CLASSES[classId];
  return cls ? cls.skills.filter(s => !s.basic) : [];
}
function defaultKit(classId) {
  return kitPool(classId).slice(0, KIT_SLOTS).map(s => s.id);
}

function normalizeKit(classId, kit) {
  const pool = kitPool(classId).map(s => s.id);
  const out = [];
  for (const id of (Array.isArray(kit) ? kit : []))
    if (pool.includes(id) && !out.includes(id) && out.length < KIT_SLOTS) out.push(id);
  for (const id of pool) { if (out.length >= KIT_SLOTS) break; if (!out.includes(id)) out.push(id); }
  return out;
}

function freshPlayer(classId, kit) {
  const cls = CLASSES[classId], b = cls.base;
  const fitted = normalizeKit(classId, kit || defaultKit(classId));
  const p = {
    id:'player', name:'Sonny', class:classId, level:1, xp:0, xpNext:xpForLevel(1), points:0,
    str:b.str, instinct:b.instinct, speed:b.speed, vit:b.vit,
    dmgMult:1, hpMult:1, apsMult:1,
    hp:0, maxHp:0,

    pending:{ str:0, instinct:0, speed:0, vit:0 },

    skills: cls.skills.filter(s => s.basic || fitted.includes(s.id))
                      .map(s => Object.assign({cd:0}, s)),

    gear: issueGear(classId),

    mods: [],

    weights: { str: 0, instinct: 0, speed: 0, vit: 0 },
    allocCarry: { str: 0, instinct: 0, speed: 0, vit: 0 },
    statuses:[], isPlayer:true, meter:0, thornsGrown:0, thornsShedded:0,
    poisonCarry:0, _statusKey:''
  };
  p.basicSkill = p.skills.find(s => s.basic) || p.skills[0];
  return p;
}

function rebuildSkills(p) {
  if (!p || !CLASSES[p.class]) return;
  const kit = p.skills.filter(s => !s.basic).map(s => s.id);
  const cds = {};
  p.skills.forEach(s => { cds[s.id] = s.cd || 0; });
  p.skills = CLASSES[p.class].skills
    .filter(s => s.basic || kit.includes(s.id))
    .map(s => Object.assign({ cd: cds[s.id] || 0 }, s));
  p.basicSkill = p.skills.find(s => s.basic) || p.skills[0];
  applyTakenMods(p);
  applyGearPatches(p);
}

function resetRunState(classId) {
  stopCombatLoop();
  abandonDrop(); abandonMods();
  state.classId = classId;
  state.player = null;
  state.enemy = null;
  state.enemies = [];
  state.wave = 1;
  state.kills = 0;
  state.awaitingSpawn = false;
  state.awaitingInput = false;
  state.pendingEnemyAct = false;
  state.active = null;
  state.combo = 0;
  state.bestCombo = 0;
  state.fightTurns = 0;
  state.enemyActions = 0;
  state.actionsSinceKill = 0;
  state.turnNo = 0;
  state.damageDealt = 0;

  state.runTurns = 0;
  state.damageTaken = 0;
  state.critsLanded = 0;
  state.damagePrevented = 0;

  state.dmgBySource = {};
  state.skillUses = {};
  state.peakStrain = 0;
  state.uniqueSeen = [];
  state._fightFlags = {};
  state._waveCleared = false;
  state.deaths = 0;
  state.diedAt = 0;
  state.checkpoint = 1;
  state.queuedSkillId = null;
  state.hazard = null;
  state.hazardOffer = null;
  state.atCamp = false;
  state.killedBy = null;
  state.runStart = Date.now();
  state._defeatLock = false;
  state._lastOverkill = 0;
  state.runOver = false;
  state.won = false;

  updateCombo();
  clearLog();
  clearFloaters();
  if (!HEADLESS.on) {
    const cp = document.getElementById('camp-panel');
    if (cp) { cp.classList.remove('on', 'log-open'); cp.innerHTML = ''; }
  }

  log('RISEN · build ' + BUILD);
}

function playStrainIntro(classId, line) {
  if (!CLASSES[classId]) return;
  leaveMenuTab(); closeSettings();
  const el = document.querySelector('#resist-screen .resist-line');
  if (el) {
    el.textContent = line;

    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }
  showScreen('resist-screen');

  const t = setTimeout(() => { offerSkip(null); startGame(false, classId); }, 7100);

  offerSkip(() => { clearTimeout(t); startGame(true, classId); });
}

function startGameFromSelect() {
  playStrainIntro(claimPendingClass(), 'The package comes online…');
}

function startGame(skipReveal, classId) {
  const cls = classId || claimPendingClass();
  if (!CLASSES[cls]) return;
  resetRunState(cls);
  state.saveSlot = claimSaveSlot();
  state.player = freshPlayer(cls, claimPendingKit());
  recalcPlayerStats();
  state.player.hp = state.player.maxHp;
  clearSavedRun();
  updateHud();
  showScreen('combat-screen');
  spawnEnemy();
  saveRun();

  if (skipReveal) { revealCombatNow(); offerSkip(null); startCombatLoop(); }
  else stageCombatReveal(startCombatLoop);
}

let _skipIntro = null;
function offerSkip(fn) {
  _skipIntro = fn || null;
  const btn = document.getElementById('skip-btn');
  if (btn) btn.style.display = _skipIntro ? '' : 'none';
}
function skipIntro() {
  const fn = _skipIntro;
  offerSkip(null);
  if (fn) fn();
}

document.addEventListener('keydown', ev => {
  if (ev.code !== 'Space') return;
  if (!_skipIntro) return;
  ev.preventDefault();
  skipIntro();
});

const REVEAL_HOLD_MS = 700;
const REVEAL_LAST_MS = 2500;
let _revealTimers = [];
function clearRevealTimers() { _revealTimers.forEach(clearTimeout); _revealTimers = []; }

function revealCombatNow() {
  clearRevealTimers();
  const cs = document.getElementById('combat-screen');
  if (cs) cs.classList.remove('staged', 'reveal');
}

function stageCombatReveal(onDone) {
  const cs = document.getElementById('combat-screen');
  if (!cs) { if (onDone) onDone(); return; }
  clearRevealTimers();
  cs.classList.remove('staged', 'reveal');
  void cs.offsetWidth;
  cs.classList.add('staged');
  offerSkip(() => { revealCombatNow(); if (onDone) onDone(); });
  _revealTimers.push(setTimeout(() => {
    cs.classList.add('reveal');
    _revealTimers.push(setTimeout(() => { offerSkip(null); if (onDone) onDone(); }, REVEAL_LAST_MS));
  }, REVEAL_HOLD_MS));
}

function getZoneName(wave) {
  if (wave > BALANCE.finalWave)
    return 'DEPTH ' + (Math.floor((wave - BALANCE.finalWave - 1) / 10) + 1);
  return zoneForWave(wave).label;
}


function spawnEnemy() {
  state.enemies = makeWave(state.wave);
  state.enemy = state.enemies[0];
  const p = state.player;

  const zn = document.getElementById('zone-name');
  const haz = hazardFor(state.wave);
  if (zn) zn.textContent = getZoneName(state.wave) + (haz ? ' · ' + haz.name : '');

  const ac = document.getElementById('arena-card');
  if (ac) {
    ac.dataset.zone = zoneForWave(state.wave).num;

  }

  const pack = state.enemies;
  log('WAVE ' + state.wave + (pack.length > 1 ? ' · PACK ×' + pack.length : ''));
  pack.forEach(e => {
    const tags = enemyTags(e);
    log(e.name + (tags.length ? ' · ' + tags.join(' ') : '')
      + ' · HP ' + logNum(e.maxHp) + ' · DMG ' + logNum(e.damage)
      + ' · RATE ' + e.attackSpeed.toFixed(2) + '×'
      + (e.windupEvery ? ' · WINDUP every ' + e.windupEvery + ' (×' + windupMultFor(e) + ')' : '')
      + (e.xpMult !== 1 ? ' · XP ×' + e.xpMult.toFixed(1) : ''));

    if (e.verb && ENEMY_VERBS[e.verb]) {
      log('TRAIT · ' + ENEMY_VERBS[e.verb].tag + ' — ' + ENEMY_VERBS[e.verb].blurb);
      if (e.verb === 'regrow')
        applyStatus(e, 'regrow', { below: ENEMY_VERBS.regrow.below, power: ENEMY_VERBS.regrow.power });
    }
  });

  if (state.wave > 1) {
    const before = p.hp;
    const recover = P().recoverHpFrac * (haz && haz.id === 'relentless' ? 0.5 : 1);
    p.hp = Math.min(p.maxHp, p.hp + Math.floor(healAnchorFor(p) * recover));
    if (p.hp > before) logHeal('RECOVER', p, p.hp - before,
      [Math.round(recover*100) + '% of ' + logNum(healAnchorFor(p)) + ' between fights']);

    const lost = p.statuses.filter(s => { const dd = STATUSES[s.type]; return !(dd && dd.persists); });
    p.statuses = survivingStatuses(p);
    lost.forEach(s => { const dd = STATUSES[s.type]; if (dd) logEvent('− ' + dd.name + ' ended', p, 'fight over'); });

    if (p.thornsShedded > 0) {
      const back = p.thornsShedded;
      p.thornsShedded = 0;
      applyDerivedStats(p);
      logEvent('THORNS regrown', null, '+' + back + ' (' + formatNum(p.thorns) + ')', ['shed last fight']);
    }
  }

  if (p.class === 'bio' && p.poisonCarry > 0) {
    const n = p.poisonCarry;
    p.poisonCarry = 0;
    applyStatus(state.enemy, 'poison', { stacks: n, perStack: p.poisonPerStack });
    floatText(state.enemy, '+' + n + ' POISON', 'tally');
    logEvent('THE ROT SPREADS', state.enemy, '×' + n + ' POISON', ['carried from the last host']);
  }

  state.player.meter = 0;
  pack.forEach(e => { e.meter = 0; });

  const tp = 1 / effectiveAps(state.player);
  const te = Math.min.apply(null, pack.map(e => 1 / effectiveAps(e)));
  if (te < tp - 1e-9) state.player.meter = 1;
  state.fightTurns = 0;
  state.enemyActions = 0;
  state.actionsSinceKill = 0;
  state.turnNo = 0;
  state._fightFlags = {};
  state._waveCleared = false;
  state.awaitingSpawn = false;
  state.awaitingInput = false;
  state.pendingEnemyAct = false;
  updateHud(); renderCombat(true); renderSkills(); updateTurnInfo();
}

const CAMP_LINES = [
  'Sit. Nothing follows this far in — the lights hold and the door holds. You are the first thing to come up that corridor in a long while.',
  'Your breathing has settled. That puts you ahead of most of what comes through here.',
  'Survey filed this room as a shelter. It was a storeroom. It holds, which is more than the filing ever did.',
  'You are past where the first team stopped. I would call that good news if I still used the phrase.',
  'The signal is louder at this depth. You will have noticed. Rest anyway — it does not get quieter further down.',
  'You reached the source and walked back out of it. I have stopped writing predictions.'
];

const CAMP_DEEP_LINES = [
  'The instruments stopped agreeing with each other some time ago. Sit down. I will patch what I can.',
  'You keep coming back up that corridor and I keep the lights on. That is the arrangement we have.',
  'Nothing at this depth is catalogued any more. Neither are you, strictly speaking. Rest.'
];

function campLine(wave) {
  if (wave <= BALANCE.finalWave)
    return CAMP_LINES[Math.min(CAMP_LINES.length - 1, Math.max(0, Math.floor(wave / 10) - 1))];
  return CAMP_DEEP_LINES[Math.floor((wave - BALANCE.finalWave - 1) / 10) % CAMP_DEEP_LINES.length];
}

function showCamp() {
  if (HEADLESS.on) return;
  const cleared = state.wave - 1;
  document.getElementById('camp-title').textContent = 'SHELTER · ' + getZoneName(cleared) + ' CLEARED';
  document.getElementById('camp-sub').textContent =
    'Wave ' + cleared + ' behind you · next contact at wave ' + state.wave;

  const p = state.player;
  const fig = document.getElementById('camp-player');
  if (fig && p) {
    const set = POSE_SPRITES[p.class] || {};
    fig.innerHTML = '<img src="' + (set.idle || set.ready || PLAYER_SPRITES[p.class])
      + '" alt="' + p.class + '" draggable="false">';
  }

  const line = document.getElementById('camp-line');
  if (line) {
    line.textContent = campLine(cleared);
    line.style.animation = 'none'; void line.offsetWidth; line.style.animation = '';
  }
  renderCampPanel();
  showScreen('camp-screen');
}

function campBusy() {
  return !!(state.hazardOffer || nextDrop() || nextModOffer());
}

function hazardOfferHtml() {
  const offer = state.hazardOffer;
  if (!offer) return '';
  const depth = Math.floor((state.wave - BALANCE.finalWave - 1) / 10) + 1;
  return '<div class="camp-panel-head">DEPTH ' + depth + ' · CHOOSE THE TOLL</div>'
    + '<div class="hazard-list">'
    + offer.map(id => {
        const h = HAZARDS[id];
        return '<button class="hazard-card" type="button" onclick="pickHazard(\'' + id + '\')">'
          + '<span class="hazard-name">' + h.name + '</span>'
          + '<span class="hazard-text">' + h.text + '</span>'
          + '<span class="hazard-reward">+' + Math.round((h.xpMult - 1) * 100) + '% XP</span>'
          + '</button>';
      }).join('')
    + '</div>'
    + '<div class="hazard-foot">Any toll doubles LEGENDARY drops for this Depth.</div>';
}

function renderCampPanel() {
  if (HEADLESS.on) return;
  const el = document.getElementById('camp-panel');
  const move = document.getElementById('camp-move');
  if (!el) return;
  if (el.classList.contains('log-open')) return;

  const parts = [dropHaulHtml(), modOfferHtml(), hazardOfferHtml()].filter(Boolean);
  if (!parts.length) {
    el.classList.remove('on');
    el.innerHTML = '';
    if (move) { move.disabled = false; move.textContent = 'MOVE OUT'; }
    return;
  }
  el.classList.add('on');
  el.innerHTML = parts.join('<div class="camp-rule"></div>');
  if (move) {
    move.disabled = true;
    move.textContent = state.hazardOffer && parts.length === 1 ? 'CHOOSE A TOLL' : 'SORT THE HAUL';
  }
}

function talkToScientist() {
  if (HEADLESS.on) return;
  const p = state.player;
  const line = document.getElementById('camp-line');
  const el = document.getElementById('camp-panel');
  if (!p || !el) return;
  if (el.classList.contains('log-open')) {
    el.classList.remove('log-open');
    renderCampPanel();
    return;
  }
  if (line) {
    line.textContent = 'I keep a log. Habit — nobody reads it but me, and now you.';
    line.style.animation = 'none'; void line.offsetWidth; line.style.animation = '';
  }
  const row = (k, v) => '<div class="camp-log-row"><span>' + k + '</span><b>' + v + '</b></div>';
  el.classList.add('on', 'log-open');
  el.innerHTML = '<div class="camp-panel-head">FIELD LOG</div>'
    + '<div class="camp-log">'
    + row('Deepest wave', state.wave - 1)
    + row('Level', p.level)
    + row('Kills', formatNum(state.kills))
    + row('Best chain', (state.bestCombo || 0) + '×')
    + row('Times down', state.deaths || 0)
    + row('Damage dealt', formatNum(Math.floor(state.damageDealt)))
    + row('Damage taken', formatNum(Math.floor(state.damageTaken || 0)))
    + row('Peak ' + (STRAIN_LABEL[p.class] || 'strain'), formatNum(state.peakStrain || 0))
    + row('Legendaries found', (state.uniqueSeen || []).length)
    + '</div>'
    + '<button class="ui-btn is-quiet camp-log-close" type="button" onclick="talkToScientist()">CLOSE</button>';
}

function enterCamp() {
  const p = state.player;
  if (!p) return;
  state.atCamp = true;
  const before = p.hp;
  p.hp = p.maxHp;
  if (p.hp > before)
    logHeal('FIELD REPAIR', p, p.hp - before, ['patched up at the shelter']);
  saveRun();
}

function moveOut() {
  if (!state.atCamp || campBusy()) return;
  state.atCamp = false;
  saveRun();
  if (HEADLESS.on) { scheduleTurn(doSpawn, 0); return; }
  const el = document.getElementById('camp-panel');
  if (el) el.classList.remove('log-open');
  showScreen('combat-screen');
  revealCombatNow();
  startCombatLoop();
}

function updateHud() {
  if (HEADLESS.on) return;
  const p = state.player; if (!p) return;

  document.getElementById('level-badge').textContent = 'LEVEL ' + p.level;
  const strainEl = document.getElementById('strain-word');
  if (strainEl) {
    const cls = CLASSES[p.class];
    strainEl.textContent = cls ? cls.name : '';
    strainEl.className = 'strain-word' + (p.class ? ' ' + p.class : '');
  }
  document.getElementById('xp-fill').style.width = Math.min(100,(p.xp/p.xpNext)*100) + '%';
  const cs = document.getElementById('combat-screen');
  if (cs) cs.dataset.strain = p.class || '';

  const statsTab = document.querySelector('.sidebar-tab[data-tab="stats"]');
  if (statsTab) statsTab.classList.toggle('points-alert', p.points > 0 || pendingTotal(p) > 0);
  refreshSidebarStats();
  renderSuitPanel();
  renderModPanel();

  updateUnitCard(p);
}

function updateCombo() {
  if (HEADLESS.on) return;
  const el = document.getElementById('combo-meter');
  if (!el) return;
  if (state.combo >= 2) {
    el.style.display = 'block';
    el.textContent = state.combo + '× CHAIN';
    el.classList.toggle('hot', state.combo >= 8);
  } else {

    el.style.display = 'none';
    el.textContent = '';
    el.classList.remove('hot');
  }
}

function gainXP(amount, bonus) {
  const p = state.player;
  p.xp += amount;
  floatText(p, amount, bonus ? 'xp-bonus' : 'xp');
  const gained = [];
  while (p.xp >= p.xpNext) {

    const grant = P().pointsPerLevel;
    p.xp -= p.xpNext; p.level++; p.xpNext = xpForLevel(p.level);
    if (autoMode(p)) autoAllocate(p, grant); else p.points += grant;
    recalcPlayerStats();

    p.hp = Math.min(p.maxHp, p.hp + Math.floor(healAnchorFor(p) * P().levelUpHealFrac));

    floatText(p, 'LEVEL ' + p.level, 'xp-bonus');

    setCharPose(p, 'ready');
    logEvent('LEVEL ' + p.level, null, '+' + grant + ' points',
             ['next at ' + logNum(p.xpNext) + ' XP']);
    gained.push(p.level);
  }
  if (gained.length) {
    const badge = document.getElementById('level-badge');
    if (badge) {
      badge.classList.add('level-up');
      setTimeout(() => badge.classList.remove('level-up'), 520);
    }
  }
  updateHud();
}

function showSidebarTab(tabId) {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabId));
}
function activeTabId() {
  const t = document.querySelector('.sidebar-tab.active');
  return t ? t.dataset.tab : null;
}

let _tabBeforeMenu = 'stats';
function switchTab(tabId) {
  const from = activeTabId();
  if (tabId === 'menu' && from !== 'menu') _tabBeforeMenu = from || 'stats';
  showSidebarTab(tabId);
}

function leaveMenuTab() {
  showSidebarTab('stats');
  offerSkip(null);
}

const STAT_KEYS = ['str','instinct','speed','vit'];

function pendingTotal(p) {
  const pend = p && p.pending; if (!pend) return 0;
  return STAT_KEYS.reduce((n, k) => n + (pend[k] || 0), 0);
}
function pendingOf(p, stat) { return (p && p.pending && p.pending[stat]) || 0; }

function canConfirmStats(p) { return !!p && p.points <= 0 && pendingTotal(p) > 0; }

function pendingView(p, extraStat) {
  if (!p) return p;
  if (!extraStat && !pendingTotal(p)) return p;
  const view = Object.assign({}, p);
  STAT_KEYS.forEach(k => {
    view[k] = p[k] + pendingOf(p, k) + (k === extraStat ? 1 : 0);
  });
  applyDerivedStats(view);
  return view;
}

function resetPending() {
  const p = state.player; if (!p) return;
  STAT_KEYS.forEach(k => { p.points += pendingOf(p, k); p.pending[k] = 0; });
  updateHud(); saveRun();
}

function commitStats() {
  const p = state.player; if (!p || !canConfirmStats(p)) return;

  const placed = STAT_KEYS.filter(k => pendingOf(p, k))
    .map(k => k.toUpperCase() + ' +' + pendingOf(p, k)).join(' ');
  STAT_KEYS.forEach(k => { p[k] += pendingOf(p, k); p.pending[k] = 0; });
  recalcPlayerStats();
  logEvent('STATS committed', null, placed, ['ATK ' + logNum(attackDamage(p)) + ' · HP ' + logNum(p.maxHp)]);
  updateHud(); renderSkills(); saveRun();
}

function refreshReadoutValues() {
  if (HEADLESS.on) return;
  const p = state.player; if (!p) return;
  readouts(p).forEach(r => {
    const el = document.getElementById('d-' + r.id);
    if (el) el.textContent = r.text;
  });
}

function refreshSidebarStats() {
  if (HEADLESS.on) return;
  const p = state.player; if (!p) return;
  const confirming = canConfirmStats(p);

  STAT_KEYS.forEach(k => {
    const el = document.getElementById('stat-' + k);
    if (!el) return;

    const g = gearStat(p, k);
    el.innerHTML = (p[k] + pendingOf(p, k))
      + (g ? '<i class="gear-plus">+' + g + '</i>' : '');
    el.classList.toggle('pending', pendingOf(p, k) > 0);

    const bar = document.getElementById('bar-' + k);
    if (bar) bar.style.width = Math.round(weightShare(p, k) * 100) + '%';
  });

  const auto = autoMode(p);
  document.querySelectorAll('.side-stat-controls .stat-btn.plus').forEach(b => {
    b.disabled = auto ? (p.weights[b.dataset.stat] || 0) >= 100 : p.points <= 0;
    b.textContent = '+';
    b.classList.remove('confirm');
    b.title = '';
  });
  document.querySelectorAll('.side-stat-controls .stat-btn.minus').forEach(b => {
    b.style.display = auto ? 'none' : '';
    b.disabled = pendingOf(p, b.dataset.stat) <= 0;
  });
  document.querySelectorAll('.side-stat-controls .weight-pct').forEach(s => {
    s.style.display = auto ? '' : 'none';
    if (auto) s.textContent = Math.round(weightShare(p, s.dataset.stat) * 100) + '%';
  });

  const strip = document.getElementById('stat-commit');
  if (strip) {
    const staged = pendingTotal(p);
    if (auto || (!staged && p.points <= 0)) {
      strip.classList.remove('on');
      strip.innerHTML = '';
    } else {
      strip.classList.add('on');
      strip.innerHTML = '<span>'
        + (p.points > 0 ? p.points + ' to place' : '')
        + (p.points > 0 && staged ? ' · ' : '')
        + (staged ? staged + ' staged' : '')
        + '</span>'
        + (confirming ? '<button class="ui-btn" type="button" onclick="commitStats()">CONFIRM</button>' : '')
        + (staged ? '<button class="ui-btn is-quiet" type="button" onclick="resetPending()">RESET</button>' : '');
    }
  }

  const rows = readouts(p);
  const shown = {};
  rows.forEach(r => { shown[r.id] = true; });
  ['strain','guard'].forEach(id => {
    const row = document.getElementById('row-' + id);
    if (row) row.style.display = shown[id] ? '' : 'none';
  });
  const st = strainReadout(p), g = guardReadout(p);
  if (st) { const l = document.getElementById('label-strain'); if (l) l.textContent = st.label; }
  if (g)  { const l = document.getElementById('label-guard');  if (l) l.textContent = g.label; }

  refreshReadoutValues();

  renderDeltas(pendingView(p));
  STAT_KEYS.forEach(k => {
    const note = document.getElementById('preview-' + k);
    if (note) { note.textContent = ''; note.classList.remove('on'); }
  });
}

const WEIGHT_STEP = 5;
function weightTotal(p) {
  return STAT_KEYS.reduce((n, k) => n + Math.max(0, (p.weights && p.weights[k]) || 0), 0);
}

function autoMode(p) { return !!p && !!p.weights && weightTotal(p) > 0; }
function weightShare(p, stat) {
  const t = weightTotal(p);
  if (!t) return 0;
  return Math.max(0, p.weights[stat] || 0) / t;
}
function autoAllocate(p, points) {
  if (!p || !(points > 0)) return;
  if (!p.allocCarry) p.allocCarry = { str:0, instinct:0, speed:0, vit:0 };
  const want = {}, given = {};
  let placed = 0;
  STAT_KEYS.forEach(k => {
    want[k] = p.allocCarry[k] + points * weightShare(p, k);
    given[k] = Math.floor(want[k]);
    placed += given[k];
  });

  while (placed < points) {
    let best = STAT_KEYS[0];
    STAT_KEYS.forEach(k => { if ((want[k]-given[k]) > (want[best]-given[best])) best = k; });
    given[best]++; placed++;
  }
  STAT_KEYS.forEach(k => { p[k] += given[k]; p.allocCarry[k] = want[k] - given[k]; });
  logEvent('POINTS', null, '+' + points,
           STAT_KEYS.filter(k => given[k]).map(k => k.toUpperCase() + ' +' + given[k]));
}

function flushPoolOnSwitch(p, wasManual) {
  if (!wasManual || weightTotal(p) === 0) return;
  const pool = p.points + pendingTotal(p);
  STAT_KEYS.forEach(k => { p.pending[k] = 0; });
  p.points = 0;
  if (pool > 0) { autoAllocate(p, pool); recalcPlayerStats(); }
}
function clampWeight(p, stat, value) {
  p.weights[stat] = Math.max(0, Math.min(100, Math.round(value)));
}
function setWeight(stat, value) {
  const p = state.player;
  if (!p || !p.weights) return;
  const wasManual = weightTotal(p) === 0;
  clampWeight(p, stat, value);
  flushPoolOnSwitch(p, wasManual);
  updateHud(); saveRun();
}
function adjustWeight(stat, delta) {
  const p = state.player;
  if (!p || !p.weights) return;
  setWeight(stat, (p.weights[stat] || 0) + delta);
}

let _dragStat = null, _dragWasManual = false;
function weightAtPointer(ev, el) {
  const box = el.getBoundingClientRect();
  const raw = ((ev.clientX - box.left) / Math.max(1, box.width)) * 100;
  return Math.round(raw / WEIGHT_STEP) * WEIGHT_STEP;
}
function startWeightDrag(ev, stat) {
  const p = state.player;
  if (!p || !p.weights || ev.button > 0) return;
  ev.preventDefault();
  const el = ev.currentTarget;
  _dragStat = stat;
  _dragWasManual = weightTotal(p) === 0;
  if (el.setPointerCapture) el.setPointerCapture(ev.pointerId);
  clampWeight(p, stat, weightAtPointer(ev, el));
  refreshSidebarStats();
}

function dragWeight(ev) {
  const p = state.player;
  if (_dragStat === null || !p || !p.weights) return;
  clampWeight(p, _dragStat, weightAtPointer(ev, ev.currentTarget));
  refreshSidebarStats();
}
function endWeightDrag() {
  if (_dragStat === null) return;
  _dragStat = null;
  const p = state.player; if (!p) return;
  flushPoolOnSwitch(p, _dragWasManual);
  _dragWasManual = false;
  updateHud(); saveRun();
}

function statPlus(stat) {
  const p = state.player; if (!p) return;
  if (autoMode(p)) adjustWeight(stat, WEIGHT_STEP); else adjustStat(stat, 1);
}
function statMinus(stat) {
  const p = state.player; if (!p) return;
  if (autoMode(p)) adjustWeight(stat, -WEIGHT_STEP); else adjustStat(stat, -1);
}

function previewStat(stat, show) {
  const p = state.player; if (!p) return;
  const note = document.getElementById('preview-' + stat);
  const hovering = show && p.points > 0;
  renderDeltas(hovering ? pendingView(p, stat) : pendingView(p));

  if (!note) return;

  let dead = false;
  if (hovering) {
    const staged = readouts(pendingView(p));
    const withIt = readouts(pendingView(p, stat));
    dead = !withIt.some((r, i) => staged[i] && staged[i].text !== r.text);
  }
  note.textContent = dead ? 'no combat effect' : '';
  note.classList.toggle('on', dead);
}

function adjustStat(stat, delta) {
  const p = state.player; if (!p) return;
  if (delta > 0) {

    if (p.points <= 0) return;
    p.points--; p.pending[stat]++;
  } else {

    if (pendingOf(p, stat) <= 0) return;
    p.pending[stat]--; p.points++;
  }

  updateHud(); saveRun();
}

