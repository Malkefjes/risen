// Screens, intros, HUD, sidebar, stat allocation
// ---- Screens & setup ----------------------------------------
function showScreen(id) {
  if (HEADLESS.on) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
// THE STRAIN A NEW RUN WILL USE, kept separate from state.classId.
//
// These were one field, and that was a bug you could hit in ordinary play: pick
// BIO, later load an Unmutated save, then NEW GAME -> MUTATE and press EVOLVE,
// and the run started as Unmutated while the screen showed BIO.
//
// _pendingClass is the MENU's answer and nothing else writes it; state.classId
// is the LOADED RUN's answer and the menu never reads it. openClassSelect clears
// the selection on every visit, so a choice belongs to the visit that made it.
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

// Every run-scoped field back to its starting value, in ONE place. startGame and
// continueRun both go through this, so a field cannot be reset in one and
// forgotten in the other.
//
// Zeroing a field is not the same as clearing what it left on screen: anything
// added to `state` belongs here, and anything that renders from `state` outside
// the per-turn repaint has to be cleared here too.
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
  state.inScene = false;
  state.rescued = false;

  // The transient combat UI does not rebuild itself: the fighter panels are
  // replaced by spawnEnemy, but these three only change when something happens
  // to change them, so a new run inherits whatever the last one left behind.
  updateCombo();
  clearLog();
  clearFloaters();
  // First line of every transcript. A log pasted into a bug report then carries
  // the build that produced it without anyone having to remember to add it.
  log('RISEN · build ' + BUILD);
}

// THE ONE WAY INTO A RUN. Both doors — EVOLVE and RESIST MUTATION — come
// through here, so the beat before a run is the same beat whichever strain you
// picked; only the sentence differs.
//
// The strain is passed in and captured, never read back off shared state when
// the timer fires. A delayed start that reads a stored choice is precisely how
// the wrong strain got launched.
function playStrainIntro(classId, line) {
  if (!CLASSES[classId]) return;
  leaveMenuTab(); closeSettings();
  const el = document.querySelector('#resist-screen .resist-line');
  if (el) {
    el.textContent = line;
    // Restart the fade each time (the animation only plays once with fill: forwards).
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }
  showScreen('resist-screen');
  // Black hold 1.8s, then fade in / hold / fade out over 5s, then a beat -> run.
  const t = setTimeout(() => { offerSkip(null); startGame(false, classId); }, 7100);
  // Skipping goes straight into a playable fight: cancel the transition and
  // start the run with its reveal already finished.
  offerSkip(() => { clearTimeout(t); startGame(true, classId); });
}

function startGameFromSelect() {
  playStrainIntro(claimPendingClass(), 'You have chosen to embrace your new powers…');
}

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
// SPACEBAR, and it means whatever is in front of you. A scene owns it while one
// is up — finish the line, then walk on, exactly as a click in the panel does,
// including refusing to walk past a step that is asking you something. Failing
// that it is SKIP, bound to the offer rather than the button.
//
// Inert otherwise, which is the point: it can never scroll the page, re-click a
// focused button, or leak into combat as an accidental action.
document.addEventListener('keydown', ev => {
  if (ev.code !== 'Space') return;
  if (_scene) { ev.preventDefault(); onScenePanelClick(); return; }
  if (!_skipIntro) return;
  ev.preventDefault();
  skipIntro();
});

// The run's first frame assembles out of the black one piece at a time, arena
// first. onDone fires once the LAST piece is up, so the fight never begins
// behind a control still fading in.
// Timers are tracked so stopCombatLoop() can cancel a pending start (menu, reload, tests).
//
// The order and spacing live in CSS as transition-delay under .staged.reveal,
// so re-ordering the pieces is a CSS edit alone — but REVEAL_LAST_MS has to
// stay matched to the bottom delay plus its duration, or combat starts early.
const REVEAL_HOLD_MS = 700;    // black before the arena arrives
const REVEAL_LAST_MS = 2500;   // sidebar: 1600ms delay + 900ms fade
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
  _revealTimers.push(setTimeout(() => {
    cs.classList.add('reveal');            // arena, header, action panel, sidebar
    _revealTimers.push(setTimeout(() => { offerSkip(null); if (onDone) onDone(); }, REVEAL_LAST_MS));
  }, REVEAL_HOLD_MS));
}

function getZoneName(wave) { return zoneForWave(wave).label; }

// A one-shot override for the next spawn, so an enemy that arrives outside the
// wave table (the scientist, out of a scene) still goes through all of
// spawnEnemy's bookkeeping instead of a second, thinner spawn path.
let _nextFoe = null;

function spawnEnemy() {
  state.enemy = _nextFoe || makeEnemy(state.wave);
  _nextFoe = null;
  const p = state.player;

  const zn = document.getElementById('zone-name');
  if (zn) zn.textContent = getZoneName(state.wave);
  // The zone stamp is what lets CSS dress the arena per zone; scenery stays a
  // class/attr concern, never a re-render, same contract as backdrop-on.
  const ac = document.getElementById('arena-card');
  if (ac) {
    ac.dataset.zone = zoneForWave(state.wave).num;
    // His lab lasts exactly as long as he does.
    ac.classList.toggle('scene', !!state.enemy.sceneFoe);
  }
  // Every wave gets a header, not just bosses and elites. A transcript with
  // silent waves in it cannot be read back — the reader has no way to tell
  // which fight a turn belonged to. The second line is the enemy's actual
  // sheet, which is the thing you want when asking why a fight went badly and
  // the only place those numbers are ever visible.
  const e = state.enemy;
  const tags = enemyTags(e);
  log('WAVE ' + state.wave + ' · ' + e.name + (tags.length ? ' · ' + tags.join(' ') : ''));
  log('HP ' + logNum(e.maxHp) + ' · DMG ' + logNum(e.damage)
    + ' · RATE ' + e.attackSpeed.toFixed(2) + '×'
    + (e.evadeChance ? ' · EVADE ' + Math.round(e.evadeChance*100) + '%' : '')
    + (e.windupEvery ? ' · WINDUP every ' + e.windupEvery + ' (×' + windupMultFor(e) + ')' : '')
    + (e.xpMult !== 1 ? ' · XP ×' + e.xpMult.toFixed(1) : ''));

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
    lost.forEach(s => { const dd = STATUSES[s.type]; if (dd) logEvent('− ' + dd.name + ' ended', p, 'fight over'); });
  }

  // THE PLAYER ALWAYS OPENS. Both gauges used to start empty, so any enemy
  // quicker than you swung before you had acted at all — a UI problem before it
  // is a balance one, because a kill can level you and the only moment to spend
  // those points is a turn of your own.
  //
  // Implemented as a FULL gauge rather than a special case in the turn loop, so
  // there is one initiative rule in this game and not two: a full meter reaches
  // the threshold in zero time, acting spends it back to empty, and the fight
  // proceeds from two empty gauges.
  //
  // ONLY WHEN THE GAUGES WOULD NOT ALREADY GIVE IT TO YOU — unconditionally it
  // paid a fast player twice. The guarantee is a floor, not a bonus.
  state.player.meter = 0;
  state.enemy.meter = 0;
  // The same comparison advanceToNextActor makes from empty gauges, ties to the
  // player. If the enemy is strictly faster it takes the opening, so buy it back.
  const tp = 1 / effectiveAps(state.player), te = 1 / effectiveAps(state.enemy);
  if (te < tp - 1e-9) state.player.meter = 1;
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
  const cs = document.getElementById('combat-screen');
  if (cs) cs.dataset.strain = p.class || '';
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
    // A strain whose body changes with the level changes it HERE, rather than
    // waiting for the next pose swap to notice the src had moved.
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
// Points land in p.pending first. Nothing in combat reads pending, so an
// unconfirmed point buys you nothing, and the minus can only take back what is
// still pending — never a point already committed. Once the pool is empty the
// plus becomes the confirm, which folds pending into the real stats and locks
// the row until the next level. It replaced instant, reversible spending, which
// let a run be re-specced mid-fight to answer whatever was in front of you.
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
  logEvent('STATS committed', null, placed, ['ATK ' + logNum(attackDamage(p)) + ' · HP ' + logNum(p.maxHp)]);
  updateHud(); renderSkills(); saveRun();
}

// The readout VALUES alone, split out of refreshSidebarStats so the combat path
// can keep them honest without dragging the allocation UI along for every hit.
//
// THIS EXISTS BECAUSE THE SIDEBAR USED TO LIE: damage and healing redraw the
// fighter card every exchange, but the sidebar's rows were only rewritten at
// run-scale beats, so the Health row sat at whatever it read when the wave began
// while the bar above the sprite told the truth.
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

  // The build profile: each stat as a share of the biggest of the four, so a
  // lopsided sheet is visible before any number is read. Pending points are in
  // it, so a staged allocation shows what the build is about to become.
  const spread = STAT_KEYS.map(k => p[k] + pendingOf(p, k));
  const top = Math.max(1, ...spread);
  STAT_KEYS.forEach((k, i) => {
    const bar = document.getElementById('bar-' + k);
    if (bar) bar.style.width = Math.round(spread[i] / top * 100) + '%';
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
  ['strain','guard'].forEach(id => {
    const row = document.getElementById('row-' + id);
    if (row) row.style.display = shown[id] ? '' : 'none';
  });
  const st = strainReadout(p), g = guardReadout(p);
  if (st) { const l = document.getElementById('label-strain'); if (l) l.textContent = st.label; }
  if (g)  { const l = document.getElementById('label-guard');  if (l) l.textContent = g.label; }

  refreshReadoutValues();

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


// ---- Scenes ---------------------------------------------------
// A BEAT BETWEEN FIGHTS, played inside the arena card. Combat is spawn-to-spawn
// and deliberately quick, so the only way an encounter reads as an EVENT rather
// than as another enemy is to change what the card is: the room becomes
// somewhere else, the UI around it steps back, and nothing on screen can be
// pressed except the scene's own choices.
//
// It is data, not code. A scene is a speaker, a portrait, a line per visit and
// a set of choices — so a second character, or a different thing to say at
// wave 30 than at wave 5, costs an entry here and nothing else.
//
// PLACEHOLDER, and knowingly so: the only choice is to leave. The shape is what
// is being built, so that whatever this becomes — a trade, a boon with a price,
// a branch — drops into `choices` without touching the wiring.
const SCENES = {
  scientist: {
    speaker: 'ROGUE LAB SCIENTIST',
    portrait: 'assets/sprites/rogue lab scientist.png',
    // What his name is written in. Teal to match his own art — the coat, the
    // goggles and the room he stands in are all the same cyan.
    tint: '#45dfe0',
    // STEPS, not lines. A step is a sentence plus how it can be left: nothing
    // at all, which offers a continue, or a set of choices. A choice with no
    // `act` simply walks to the next step, so branching costs an entry rather
    // than a mechanism.
    steps: [
      { text: '…You are not following the behavioral template...' },
      { text: 'Most either converge on the nearest uninfected mass or collapse into pure stimulus loops.' },
      { text: 'You have been systematically eliminating specimens since the containment breach.' },
      { text: 'I am authorized to complete specimen termination.',
        choices: [{ label: 'wait…' }, { label: 'attack', go: 6 }] },
      { text: '…Language. Coherent.' },
      // PLACEHOLDER END. The conversation stops here until there is more of it;
      // MOVE ON is standing in for whatever it becomes.
      { text: 'The cascade was designed to erase residual cognition. Speak now or be terminated',
        choices: [{ label: 'MOVE ON', act: 'leave' }] },
      // 6 — where `attack` goes. A TERMINAL STEP: no continue and no choices,
      // it says its line and then does the thing itself.
      { text: 'So be it…', act: 'fight' }
    ]
  }
};

// HIS NUMBERS ARE THE FIRST BOSS'S, because that is the fight you have just won
// or just lost — attacking him is a rematch against the same wall rather than a
// softer option. He carries his own art and his own venom; nothing else about
// him needs a table of its own.
function makeScientistFoe() {
  const e = makeEnemy(BALANCE.bossEvery);
  e.name = 'Rogue Lab Scientist';
  e.artSet = SCIENTIST_SPRITES;
  e.poisonHits = true;
  e.sceneFoe = true;          // keeps his lab up for the length of the fight
  return e;
}

// THE FIRST BOSS DOES NOT GET TO END THE RUN. It hits for double (see
// firstBossMult) precisely so it usually wins, and losing to it is the one
// death in the game with an answer: he pulls you out, you lose the boss and its
// XP, and you come round on the next wave at half a bar.
//
// ONCE ONLY, and the flag rides in the save so a reload cannot re-arm it.
// It applies in HEADLESS too — it is a rule, not a cutscene, and a rule the sim
// does not play would break the one invariant that keeps every measured number
// honest. Only the scene around it is skipped there.
function rescueAvailable(won) {
  return !won && !state.rescued && state.wave === BALANCE.bossEvery;
}

// WHICH BOSS HAS SOMETHING WAITING AFTER IT. Still the per-boss hook the
// scaffolding was built as — a second scene is another wave answered here, not
// a flag — but there is exactly one conversation written, so it plays at the
// one boss it was written for.
//
// It used to answer every boss, and that was wrong twice over. The scientist is
// working out that you can talk ("…Language. Coherent."), so you met him for
// the first time at waves 5, 10, 15, 20, 25, 30, 35 and 40. And makeScientistFoe
// builds him at bossEvery whatever wave you are on, so taking `attack` at wave
// 40 was a doubled wave-5 boss paying wave-40 XP — the XP a kill grants reads
// off state.wave, never off the enemy.
function sceneAfterWave(wave) {
  if (wave !== BALANCE.bossEvery) return null;
  return 'scientist';
}

// The veil's own transition, in one place so the JS waits exactly as long as
// the CSS takes. Out of step in either direction is the abruptness coming back:
// too short and the swap happens on a visible frame, too long and the card sits
// dead. Keep it matched to .arena-veil's transition.
const SCENE_FADE_MS = 700;
// How long the figure takes to resolve. The dialogue waits it out — keep it
// matched to .scene-layer's transition.
const SCENE_FIGURE_MS = 1400;

// ---- Playing a scene ------------------------------------------
// The typing is the only thing here that needs state: a line arrives a
// character at a time, and every way out of a step waits on it finishing.
const TYPE_MS = 26;
// How long a finished line is left standing before a step acts on its own.
const SCENE_BEAT_MS = 900;
let _typing = null;    // the line currently arriving
let _scene = null;     // { def, step, onDone } while a scene is up

// Finish the sentence now. Returns whether there was one to finish, so a click
// can ask "did that press get used up here".
function finishTyping() {
  if (!_typing) return false;
  const t = _typing;
  clearTimeout(t.timer);
  _typing = null;
  t.el.textContent = t.text;
  const cs = document.getElementById('combat-screen');
  if (cs) cs.classList.remove('scene-typing');
  t.done();
  return true;
}

function typeLine(el, text, done) {
  if (_typing) clearTimeout(_typing.timer);
  const t = _typing = { el, text, i: 0, timer: null, done };
  el.textContent = '';
  const cs = document.getElementById('combat-screen');
  if (cs) cs.classList.add('scene-typing');
  const tick = () => {
    if (_typing !== t) return;                  // superseded, or finished early
    t.i++;
    el.textContent = text.slice(0, t.i);
    if (t.i >= text.length) { finishTyping(); return; }
    t.timer = setTimeout(tick, TYPE_MS);
  };
  t.timer = setTimeout(tick, TYPE_MS);
}

// One step: he says it, and the way out appears only once he has finished.
function showSceneStep(i) {
  if (!_scene) return;
  const step = _scene.def.steps[i];
  if (!step) { closeScene(_scene.onDone); return; }
  _scene.step = i;
  const choices = document.getElementById('scene-choices');
  const cont = document.getElementById('scene-continue');
  choices.innerHTML = '';
  cont.hidden = true;
  typeLine(document.getElementById('scene-line'), step.text, () => {
    // A terminal step answers for itself. The beat after the line is the whole
    // point of it — the words have to land before the room changes.
    if (step.act) {
      _revealTimers.push(setTimeout(() => takeSceneChoice(step), SCENE_BEAT_MS));
      return;
    }
    if (!step.choices) { cont.hidden = false; return; }
    step.choices.forEach(c => {
      const b = document.createElement('button');
      b.className = 'ui-btn' + (c.quiet ? ' is-quiet' : '');
      b.type = 'button';
      b.textContent = c.label;
      b.addEventListener('click', ev => { ev.stopPropagation(); takeSceneChoice(c); });
      choices.appendChild(b);
    });
  });
}

function advanceScene() { if (_scene) showSceneStep(_scene.step + 1); }

function takeSceneChoice(c) {
  if (c.act === 'leave') { closeScene(_scene && _scene.onDone); return; }
  if (c.act === 'fight') { sceneToFight(); return; }
  if (c.go != null) { showSceneStep(c.go); return; }
  advanceScene();
}

// A click in the panel finishes the sentence, and a second walks on — but only
// where walking on is what the step offers. Buttons stop their own clicks
// before they reach here.
function onScenePanelClick() {
  if (finishTyping()) return;
  const step = _scene && _scene.def.steps[_scene.step];
  if (step && !step.choices) advanceScene();
}

function openScene(id, onDone, onBlack) {
  const sc = SCENES[id];
  const layer = document.getElementById('scene-layer');
  const panel = document.getElementById('scene-panel');
  const card = document.getElementById('arena-card');
  const screen = document.getElementById('combat-screen');
  // onBlack still has to run with no scene to play it behind — it carries the
  // rules half of whatever the scene is dressing up, and headless plays rules.
  if (HEADLESS.on || !sc || !layer || !panel || !card) {
    if (onBlack) onBlack();
    if (onDone) onDone();
    return;
  }

  state.inScene = true;

  document.getElementById('scene-speaker').textContent = sc.speaker;
  panel.style.setProperty('--scene-tint', sc.tint || 'var(--text)');
  document.getElementById('scene-line').textContent = '';
  document.getElementById('scene-choices').innerHTML = '';
  document.getElementById('scene-continue').hidden = true;
  const portrait = document.getElementById('scene-portrait');
  if (portrait) portrait.src = sc.portrait;
  panel.onclick = onScenePanelClick;

  // THROUGH BLACK, NOT ACROSS. The first pass swapped the backdrop on a lit
  // frame while the old room was still up, which is the abrupt part — a room
  // does not become another room, it goes dark and you are somewhere else.
  //
  // The UI around the card leaves on the same beat as the veil arriving, so the
  // world recedes and the card blacks out as one movement rather than two.
  const veil = document.getElementById('arena-veil');
  if (screen) screen.classList.add('scene-on');
  if (veil) veil.classList.add('on');

  // Everything that would be seen changing happens while the veil is opaque —
  // including the caller's own change, which is what onBlack is for.
  _revealTimers.push(setTimeout(() => {
    if (onBlack) onBlack();
    card.classList.add('scene');
    layer.hidden = false;
    void layer.offsetWidth;
    layer.classList.add('in');
    // He speaks once he is all the way here.
    _revealTimers.push(setTimeout(() => {
      panel.hidden = false;
      void panel.offsetWidth;
      panel.classList.add('in');
      // _scene IS THE INPUT GATE, so it is set here and not when the scene was
      // asked for. Held at the top of openScene, a spacebar mashed during the
      // fade walked steps 1, 2 and 3 in a room that was still arriving — and
      // then the deferred first step landed and dropped it back to 0.
      _scene = { def: sc, step: 0, onDone: onDone };
      showSceneStep(0);
    }, SCENE_FIGURE_MS));
    // A held beat on full black before the lab arrives. Without it the veil
    // reads as a flicker rather than as a cut.
    _revealTimers.push(setTimeout(() => { if (veil) veil.classList.remove('on'); }, 220));
  }, SCENE_FADE_MS));
}


// Everything a scene leaves behind, whichever way it is left — out to the next
// wave, or sideways into a fight with the man who was talking.
function teardownScene() {
  // Headless never opens one, and stopCombatLoop — which a sim calls constantly
  // — comes through here now. Same guard every other drawing function in the
  // chapter carries, for the same reason: a sim must not move the screen.
  if (HEADLESS.on) return;
  finishTyping();
  _scene = null;
  const layer = document.getElementById('scene-layer');
  const panel = document.getElementById('scene-panel');
  const screen = document.getElementById('combat-screen');
  if (layer) { layer.classList.remove('in'); layer.hidden = true; }
  if (panel) { panel.classList.remove('in'); panel.hidden = true; panel.onclick = null; }
  if (screen) { screen.classList.remove('scene-on', 'scene-typing'); }
  state.inScene = false;
}

// TALKING STOPS, THE FIGHT DOES NOT MOVE ROOMS. His lab stays up — the card
// keeps `scene` until a wave that is not him spawns — so the rematch happens
// where the conversation did rather than cutting back to the corridor.
function sceneToFight() {
  const veil = document.getElementById('arena-veil');
  if (veil) veil.classList.add('on');
  _revealTimers.push(setTimeout(() => {
    teardownScene();
    _nextFoe = makeScientistFoe();
    state.awaitingSpawn = true;
    state.awaitingInput = false;
    state.pendingEnemyAct = false;
    // He is spawned behind the black and revealed with it, so the fight opens
    // on two figures already standing rather than on the room changing under
    // one of them.
    startCombatLoop();
    _revealTimers.push(setTimeout(() => { if (veil) veil.classList.remove('on'); }, 300));
  }, SCENE_FADE_MS));
}

function closeScene(onDone) {
  const layer = document.getElementById('scene-layer');
  const card = document.getElementById('arena-card');
  const screen = document.getElementById('combat-screen');
  const veil = document.getElementById('arena-veil');
  // Out the way it came in: black first, then the lab goes and the fight's own
  // room comes back underneath it.
  if (veil) veil.classList.add('on');
  _revealTimers.push(setTimeout(() => {
    teardownScene();
    if (card) card.classList.remove('scene');
    // The next enemy is spawned behind the veil and revealed with it, so the
    // wave does not start with a figure appearing out of nothing.
    if (onDone) onDone();
    _revealTimers.push(setTimeout(() => { if (veil) veil.classList.remove('on'); }, 260));
  }, SCENE_FADE_MS));
}
