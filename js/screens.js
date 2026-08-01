// Screens, intros, HUD, sidebar, stat allocation
// ---- Screens & setup ----------------------------------------
function showScreen(id) {
  if (HEADLESS.on) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
// THE STRAIN A NEW RUN WILL USE, kept separate from state.classId.
//
// This pair used to be one field, and that was a bug you could hit in ordinary
// play: pick BIO once, later load an Unmutated save, then NEW GAME -> MUTATE
// and press EVOLVE. The run started as Unmutated while the screen showed BIO.
//
// Three things had to line up, which is why it looked intermittent:
//   1. state.classId meant two different things — "the strain picked in the
//      menu" and "the strain of the run that is loaded". continueRun and
//      resistMutation write the second; startGame read it as the first.
//   2. selectClass enabled #start-btn and nothing ever disabled it again, so
//      a later visit to strain select arrived with EVOLVE already live.
//   3. .class-card.selected was never cleared either, so the screen still
//      showed the strain chosen earlier in the session.
// Together: the screen displayed BIO, EVOLVE was lit, and pressing it read a
// state.classId that a save had quietly overwritten. Nothing about the input
// was wrong — the screen was lying.
//
// The fix is to stop sharing the field. _pendingClass is the MENU's answer and
// nothing else writes it; state.classId is the LOADED RUN's answer and the
// menu never reads it. openClassSelect clears the selection on every visit, so
// a choice belongs to the visit that made it rather than to the session.
let _pendingClass = null;

function claimPendingClass() {
  const id = _pendingClass;
  _pendingClass = null;
  return id;
}

// Entering strain select always starts from nothing chosen. Re-disabling
// EVOLVE is the load-bearing half: while it stayed enabled between visits it
// was possible to start a run without making a choice at all.
function openClassSelect() {
  _pendingClass = null;
  document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
  const btn = document.getElementById('start-btn');
  if (btn) { btn.disabled = true; btn.className = 'ui-btn is-primary'; }
  showScreen('class-screen');
}

function selectClass(id) {
  if (!CLASSES[id]) return;
  _pendingClass = id;
  document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
  document.querySelector('.class-card.' + id).classList.add('selected');
  const btn = document.getElementById('start-btn');
  btn.disabled = false;
  // EVOLVE takes the chosen strain's colour.
  btn.className = 'ui-btn is-primary strain-' + id;
}
function recalcPlayerStats(){ if (state.player) applyDerivedStats(state.player); }

function freshPlayer(classId) {
  const cls = CLASSES[classId], b = cls.base;
  const p = {
    id:'player', name:'Sonny', class:classId, level:1, xp:0, xpNext:xpForLevel(1), points:0,
    str:b.str, instinct:b.instinct, speed:b.speed, vit:b.vit,
    dmgMult:1, hpMult:1, apsMult:1,
    hp:0, maxHp:0,
    // Points moved onto a stat but not yet committed. They are NOT in str /
    // instinct / speed / vit, so nothing in combat can see them until you
    // confirm — the sidebar renders them by previewing a copy. See adjustStat.
    pending:{ str:0, instinct:0, speed:0, vit:0 },
    skills: cls.skills.map(s => Object.assign({cd:0}, s)),
    // thornsGrown starts at 0 for everyone and only sym ever moves it: the
    // ramp is run-scoped, so a fresh player is a fresh organism.
    statuses:[], isPlayer:true, meter:0, thornsGrown:0, _statusKey:''
  };
  p.basicSkill = p.skills.find(s => s.basic) || p.skills[0];
  return p;
}

// Every run-scoped field back to its starting value, in ONE place. startGame
// and continueRun both go through this, so a field cannot be reset in one and
// forgotten in the other — which is exactly how a finished run's chain counter
// used to survive into the next run: `state.combo` was zeroed, but the meter
// that displays it is a DOM element, and the only thing that repaints it is a
// kill. The old "2× CHAIN" therefore sat on the combat card for the whole first
// fight of the new run, until the first kill happened to redraw it.
//
// The lesson generalises past the combo meter: zeroing a field is not the same
// as clearing what it left on screen. Anything added to `state` belongs here,
// and anything that renders from `state` outside the per-turn repaint (the log,
// the floaters, the combo meter) has to be cleared here too.
function resetRunState(classId) {
  stopCombatLoop();              // also cancels a turn or reveal still scheduled
  state.classId = classId;
  state.player = null;
  state.enemy = null;
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
  state.turnNo = 0;
  state.damageDealt = 0;
  // Run-lifetime counters for the result card. turnNo above resets per fight
  // (the log's T-numbers), so the run's total is its own count; the rest are
  // tallied at the one site each event actually happens.
  state.runTurns = 0;
  state.damageTaken = 0;
  state.critsLanded = 0;
  state.dodges = 0;
  // THE RUN LEDGER, for the result screen and its COPY block. Four things a
  // total cannot say: where the damage came from, which buttons were actually
  // pressed, how big the strain number ever got, and what finally did it.
  state.dmgBySource = {};      // label -> damage the PLAYER dealt through it
  state.skillUses = {};        // skill id -> presses that resolved
  state.peakStrain = 0;        // high-water mark of the strain number
  state.killedBy = null;       // { name, heavy } — set by the fatal blow
  state.runStart = Date.now();
  state._defeatLock = false;
  state._lastOverkill = 0;
  state.runOver = false;
  state.won = false;

  // The transient combat UI does not rebuild itself: the fighter panels are
  // replaced by spawnEnemy, but these three only change when something happens
  // to change them, so a new run inherits whatever the last one left behind.
  updateCombo();
  clearLog();
  clearFloaters();
  // First line of every transcript. A log pasted into a bug report then carries
  // the build that produced it without anyone having to remember to add it.
  log('RISEN · build ' + BUILD, 'important');
}

// `classId` is optional: the EVOLVE button omits it and the menu's pending
// choice is used, while resistMutation passes 'base' outright so its delayed
// start cannot depend on a variable something else might have cleared in the
// seconds it was waiting.
//
// If neither yields a real strain the run does NOT start. Falling back to
// state.classId is exactly the behaviour that produced the wrong-strain bug —
// better to do nothing visible than to silently start the wrong run.
function startGame(skipReveal, classId) {
  const cls = classId || claimPendingClass();
  if (!CLASSES[cls]) return;
  resetRunState(cls);
  state.saveSlot = claimSaveSlot();
  state.player = freshPlayer(cls);
  recalcPlayerStats();
  state.player.hp = state.player.maxHp;
  clearSavedRun();
  updateHud();
  showScreen('combat-screen');
  spawnEnemy();
  saveRun();
  // Staged reveal: arena fades in, hold, then the rest of the UI; combat waits.
  // skipReveal comes from skipping the RESIST transition, so one press drops
  // you all the way into a playable fight rather than into a second fade.
  if (skipReveal) { revealCombatNow(); offerSkip(null); startCombatLoop(); }
  else stageCombatReveal(startCombatLoop);
}

// ---- Skippable intros ----------------------------------------------------
// The RESIST MUTATION transition and the combat fade-in are atmospheric but
// cost ~10s before you can act, which is tedious when testing. While either is
// running, a SKIP button is offered that jumps straight to the end state.
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
// Spacebar is SKIP. Bound to the offer, not the button: inert unless an intro
// sequence is actually running, so it can never scroll the page, re-click a
// focused button, or leak into combat as an accidental action.
document.addEventListener('keydown', ev => {
  if (ev.code !== 'Space' || !_skipIntro) return;
  ev.preventDefault();
  skipIntro();
});

// Arena card fades in first, then (after a beat) the rest of the UI eases in.
// onDone fires once the UI is up, so the fight doesn't begin behind hidden controls.
// Timers are tracked so stopCombatLoop() can cancel a pending start (menu, reload, tests).
let _revealTimers = [];
function clearRevealTimers() { _revealTimers.forEach(clearTimeout); _revealTimers = []; }

// Drop the staging entirely: with .staged gone the opacity rules stop applying,
// so everything is simply visible at once.
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
  void cs.offsetWidth;                     // restart the arena fade-in
  cs.classList.add('staged');
  offerSkip(() => { revealCombatNow(); if (onDone) onDone(); });
  // Black ~1s, arena fades in over 1.3s (in by ~2.3s), brief hold, then the UI.
  _revealTimers.push(setTimeout(() => {
    cs.classList.add('reveal');            // the rest of the UI fades in (1s)
    _revealTimers.push(setTimeout(() => { offerSkip(null); if (onDone) onDone(); }, 1000));
  }, 2600));
}

function getZoneName(wave) { return zoneForWave(wave).label; }

function spawnEnemy() {
  state.enemy = makeEnemy(state.wave);
  const p = state.player;

  const zn = document.getElementById('zone-name');
  if (zn) zn.textContent = getZoneName(state.wave);
  // The zone stamp is what lets CSS dress the arena per zone (the Laboratory
  // painting keys off it); scenery stays a class/attr concern, never a
  // re-render, same contract as backdrop-on.
  const ac = document.getElementById('arena-card');
  if (ac) ac.dataset.zone = zoneForWave(state.wave).num;

  // Every wave gets a header, not just bosses and elites. A transcript with
  // silent waves in it cannot be read back — the reader has no way to tell
  // which fight a turn belonged to. The second line is the enemy's actual
  // sheet, which is the thing you want when asking why a fight went badly and
  // the only place those numbers are ever visible.
  const e = state.enemy;
  const tags = enemyTags(e);
  log('WAVE ' + state.wave + ' · ' + e.name + (tags.length ? ' · ' + tags.join(' ') : ''),
      'wave' + (e.isBoss ? ' boss' : ''));
  log('HP ' + logNum(e.maxHp) + ' · DMG ' + logNum(e.damage)
    + ' · RATE ' + e.attackSpeed.toFixed(2) + '×'
    + (e.evadeChance ? ' · EVADE ' + Math.round(e.evadeChance*100) + '%' : '')
    + (e.windupEvery ? ' · WINDUP every ' + e.windupEvery + ' (×' + windupMultFor(e) + ')' : '')
    + (e.xpMult !== 1 ? ' · XP ×' + e.xpMult.toFixed(1) : ''), 'spec');

  // Everything that lands on the fight before the first turn is logged under
  // that header, in the order it applies, so an enemy that arrives already
  // wounded is explained rather than just odd.
  // "not the opening fight of the run". Reads the wave rather than the kill
  // count — a kill is what advances a wave, so the two say the same thing, and
  // the wave is a number the save actually keeps.
  if (state.wave > 1) {
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + Math.floor(healAnchorFor(p) * P().recoverHpFrac));
    if (p.hp > before) logHeal('RECOVER', p, p.hp - before,
      [Math.round(P().recoverHpFrac*100) + '% of ' + logNum(healAnchorFor(p)) + ' between fights']);
    // Statuses that do not persist are dropped here; say which, or a buff
    // silently missing from the next fight looks like it stopped working.
    const lost = p.statuses.filter(s => { const dd = STATUSES[s.type]; return !(dd && dd.persists); });
    p.statuses = survivingStatuses(p);
    lost.forEach(s => { const dd = STATUSES[s.type]; if (dd) logEvent('− ' + dd.name + ' ended', p, 'fight over', null, ''); });
  }

  // THE PLAYER ALWAYS OPENS. Both gauges used to start empty with ties going to
  // the player, which meant you opened the exchange only when the rates were
  // equal — any enemy quicker than you swung before you had acted at all.
  //
  // That is a UI problem before it is a balance one. A kill can level you, the
  // next enemy spawns immediately, and the only moment you have to spend those
  // points is a turn of your own. Lose the opening turn and the game takes a
  // swing at you while the thing it is asking you to do is still undone —
  // punished for reading your own level-up. A guaranteed first turn is the
  // window, and it costs nothing to explain: you get the first move, then the
  // gauges run exactly as they always have.
  //
  // Implemented as a FULL gauge rather than a special case in the turn loop, so
  // there is one initiative rule in this game and not two. A full meter reaches
  // the threshold in zero time, so the player is next by the ordinary
  // comparison; acting spends it back to empty and the fight proceeds normally
  // from two empty gauges.
  state.player.meter = 1;
  state.enemy.meter = 0;
  state.fightTurns = 0;
  state.enemyActions = 0;
  state.turnNo = 0;
  state.awaitingSpawn = false;
  state.awaitingInput = false;
  state.pendingEnemyAct = false;
  updateHud(); renderCombat(true); renderSkills(); updateTurnInfo();

  if (state.enemy.hp <= 0 && !state.enemy._defeated) onEnemyDefeated();
}

// ---- HUD -----------------------------------------------------
function updateHud() {
  if (HEADLESS.on) return;
  const p = state.player; if (!p) return;
  // Level on the left, strain on the right, same type on both — only the
  // strain word is tinted by class.
  document.getElementById('level-badge').textContent = 'LEVEL ' + p.level;
  const strainEl = document.getElementById('strain-word');
  if (strainEl) {
    const cls = CLASSES[p.class];
    strainEl.textContent = cls ? cls.name : '';
    strainEl.className = 'strain-word' + (p.class ? ' ' + p.class : '');
  }
  document.getElementById('xp-fill').style.width = Math.min(100,(p.xp/p.xpNext)*100) + '%';
  // Soft alert on STATS tab while anything is outstanding — points still to
  // place, or points placed and waiting on a confirm.
  const statsTab = document.querySelector('.sidebar-tab[data-tab="stats"]');
  if (statsTab) statsTab.classList.toggle('points-alert', p.points > 0 || pendingTotal(p) > 0);
  refreshSidebarStats();
  // AND THE FIGHTER CARD, which shows the same HP this just redrew in the
  // sidebar. updateHud fires on the run-scale beats — a level, a commit, a
  // resume — and every one of them can move max HP or current HP, so leaving
  // the card out let a committed Vitality point raise the sidebar's Health
  // row while the bar above the sprite kept the old number until the next
  // hit landed. Harmless before the arena exists: updateUnitCard finds no
  // panel and returns.
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
    // Text and class cleared as well as hidden: a hidden element still carries
    // its contents, and the next thing to show it should not flash the last
    // run's number before it is overwritten.
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
    // The grant reads off BALANCE rather than being typed here and again in the
    // log line, so the number the player is told is the number they get.
    const grant = P().pointsPerLevel;
    p.xp -= p.xpNext; p.level++; p.xpNext = xpForLevel(p.level); p.points += grant;
    recalcPlayerStats();
    // recalcPlayerStats above has already moved the anchor to the NEW level, so
    // the level-up heal pays at the size the level you just earned is worth.
    p.hp = Math.min(p.maxHp, p.hp + Math.floor(healAnchorFor(p) * P().levelUpHealFrac));
    // A level is a rare event now (~6 a run), so it announces itself in
    // the arena, not just on the badge: amber, because a level-up is the XP
    // family's loudest member — see the floater vocabulary in the CSS.
    floatText(p, 'LEVEL ' + p.level, 'xp-bonus');
    logEvent('LEVEL ' + p.level, null, '+' + grant + ' points',
             ['next at ' + logNum(p.xpNext) + ' XP'], 'level');
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

// Low-level swap: which tab looks active and which panel is visible. No side
// effects, so leaving a run can park the sidebar without waking the fight.
function showSidebarTab(tabId) {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabId));
}
function activeTabId() {
  const t = document.querySelector('.sidebar-tab.active');
  return t ? t.dataset.tab : null;
}

// MENU is an ordinary tab — it does not pause anything. A turn-based fight
// already waits on awaitingInput whenever it is your move, and the
// visibilitychange handler below stops the loop if you leave the browser, so
// there is nothing for a pause to protect.
let _tabBeforeMenu = 'stats';
function switchTab(tabId) {
  const from = activeTabId();
  if (tabId === 'menu' && from !== 'menu') _tabBeforeMenu = from || 'stats';
  showSidebarTab(tabId);
  if (tabId === 'log') { const el = document.getElementById('combat-log'); if (el) el.scrollTop = el.scrollHeight; }
}

// Changing runs: park the sidebar back on STATS so the next run does not open
// on the menu, and drop any pending SKIP so the button cannot outlive the intro
// it belonged to. Callers that then start an intro re-offer it afterwards.
function leaveMenuTab() {
  showSidebarTab('stats');
  offerSkip(null);
}
// ---- Sidebar -------------------------------------------------
const STAT_KEYS = ['str','instinct','speed','vit'];

// ---- Pending allocation --------------------------------------
// Spending a point used to be instant and reversible: the stat went up, and the
// minus walked it back down to the class base, so a run could be re-specced at
// any moment — including mid-fight, to answer whatever was in front of you.
//
// Points now land in p.pending first. Nothing in combat reads pending, so an
// unconfirmed point buys you nothing; the minus can only take back what is
// still pending, never a point you already committed. Once the pool is empty
// the plus becomes the confirm, and confirming folds pending into the real
// stats and locks the row until the next level.
function pendingTotal(p) {
  const pend = p && p.pending; if (!pend) return 0;
  return STAT_KEYS.reduce((n, k) => n + (pend[k] || 0), 0);
}
function pendingOf(p, stat) { return (p && p.pending && p.pending[stat]) || 0; }
// Confirming is only offered once every point is placed, so there is never a
// half-spent pool sitting behind a locked panel.
function canConfirmStats(p) { return !!p && p.points <= 0 && pendingTotal(p) > 0; }

// The player as it WOULD be with pending applied, plus optionally one more
// point on a stat for the hover preview. Always a copy: refreshSidebarStats
// runs on every turn, and mutating the real player just to read a number back
// would drift its HP through the ratio rescale in applyDerivedStats.
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

// Fold pending into the real stats. This is the only place a stat point becomes
// permanent, and the only place combat can see the change.
function commitStats() {
  const p = state.player; if (!p || !canConfirmStats(p)) return;
  // Read the allocation BEFORE folding it in — pendingOf is zero afterwards,
  // which is what made this line print an empty list.
  const placed = STAT_KEYS.filter(k => pendingOf(p, k))
    .map(k => k.toUpperCase() + ' +' + pendingOf(p, k)).join(' ');
  STAT_KEYS.forEach(k => { p[k] += pendingOf(p, k); p.pending[k] = 0; });
  recalcPlayerStats();
  logEvent('STATS committed', null, placed, ['ATK ' + logNum(attackDamage(p)) + ' · HP ' + logNum(p.maxHp)], 'level');
  updateHud(); renderSkills(); saveRun();
}

// Which pane each readout belongs to. Declared once here so the markup, the
// group switcher and the pending-point indicator can never disagree about
// where a row lives.
const STAT_GROUPS = {
  combat: ['hit','crit','critmult','turns','strain','hp','evade','block','guard'],
  other:  ['bleedchance','bleeddmg','poisonchance','poisondmg','cdr']
};
const groupOfRow = id => Object.keys(STAT_GROUPS).find(g => STAT_GROUPS[g].indexOf(id) >= 0);

let _statGroup = 'combat';
function showStatGroup(group) {
  if (!STAT_GROUPS[group]) return;
  _statGroup = group;
  Object.keys(STAT_GROUPS).forEach(g => {
    const pane = document.getElementById('group-' + g);
    if (pane) pane.hidden = (g !== group);
  });
  document.querySelectorAll('.stat-subtab')
    .forEach(b => b.classList.toggle('active', b.dataset.group === group));
}

// The readout VALUES alone, split out of refreshSidebarStats so the combat
// path can keep them honest without dragging the allocation UI — buttons,
// deltas, hover previews — along for every hit landed.
//
// THIS EXISTS BECAUSE THE SIDEBAR USED TO LIE. Damage and healing redraw the
// fighter card (updateUnitCard) on every exchange, but the sidebar's rows were
// only rewritten by updateHud, which runs at run-scale beats — a level, a
// spawn, an allocation. So the Health row sat at whatever it read when the
// wave began while the bar above the sprite told the truth: two HP numbers on
// one screen disagreeing, with the authoritative-looking one wrong.
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

  // Stat values show what you WOULD have, marked while it is still pending so
  // an uncommitted number is never mistaken for a real one.
  STAT_KEYS.forEach(k => {
    const el = document.getElementById('stat-' + k);
    if (!el) return;
    el.textContent = p[k] + pendingOf(p, k);
    el.classList.toggle('pending', pendingOf(p, k) > 0);
  });

  // The plus adds a point while there are points, becomes the confirm when the
  // pool runs dry, and goes dark once there is nothing left to do. The minus
  // only lights for a stat that actually has something pending to give back.
  document.querySelectorAll('.side-stat-controls .stat-btn.plus').forEach(b => {
    b.disabled = p.points <= 0 && !confirming;
    b.textContent = confirming ? 'V' : '+';
    b.classList.toggle('confirm', confirming);
    b.title = confirming ? 'Confirm allocation — this cannot be undone' : '';
  });
  document.querySelectorAll('.side-stat-controls .stat-btn.minus').forEach(b => {
    b.disabled = pendingOf(p, b.dataset.stat) <= 0;
  });

  // Values stay on the COMMITTED sheet. A staged allocation shows up as a
  // delta beside them — "25  +15" — rather than replacing them with the total,
  // so what you have and what you are buying are both readable at once.

  // Rows the current strain does not own are hidden outright rather than shown
  // empty, so the panel never lists a stat that cannot move.
  const rows = readouts(p);
  const shown = {};
  rows.forEach(r => { shown[r.id] = true; });
  ['strain','guard','cdr'].forEach(id => {
    const row = document.getElementById('row-' + id);
    if (row) row.style.display = shown[id] ? '' : 'none';
  });
  const st = strainReadout(p), g = guardReadout(p);
  if (st) { const l = document.getElementById('label-strain'); if (l) l.textContent = st.label; }
  if (g)  { const l = document.getElementById('label-guard');  if (l) l.textContent = g.label; }

  refreshReadoutValues();

  showStatGroup(_statGroup);
  // The staged allocation is the resting state of the delta column; hovering a
  // plus adds its point on top, and leaving drops back to exactly this.
  renderDeltas(pendingView(p));
  STAT_KEYS.forEach(k => {
    const note = document.getElementById('preview-' + k);
    if (note) { note.textContent = ''; note.classList.remove('on'); }
  });
}

// Hovering a plus adds its point on top of whatever is already staged, so the
// delta grows as you allocate: +5, then +10, then +15. Leaving the button falls
// back to the staged total rather than blanking it — an allocation you already
// made stays on screen.
function previewStat(stat, show) {
  const p = state.player; if (!p) return;
  const note = document.getElementById('preview-' + stat);
  const hovering = show && p.points > 0;
  renderDeltas(hovering ? pendingView(p, stat) : pendingView(p));

  if (!note) return;
  // The note is about THIS point, not the staged stack, so it compares the
  // sheet with and without the hovered point rather than counting changed rows.
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
    // The plus turns into the confirm once the pool is empty, so the same click
    // target commits the allocation rather than adding a point that isn't there.
    if (p.points <= 0) { commitStats(); return; }
    p.points--; p.pending[stat]++;
  } else {
    // Only pending points come back. A committed stat is committed.
    if (pendingOf(p, stat) <= 0) return;
    p.pending[stat]--; p.points++;
  }
  // No recalcPlayerStats: pending is not in the real stats, so nothing derived
  // has changed yet. The sidebar previews it off a copy instead.
  updateHud(); saveRun();
}

