// Storage, settings, menu navigation, save slots
// ---- Storage --------------------------------------------------
// Falls back to an in-memory store when localStorage is blocked (e.g. a
// sandboxed preview frame), so nothing throws and the run still persists
// for the current session.
const Store = (function () {
  let ok = true;
  try { localStorage.setItem('__risen_t', '1'); localStorage.removeItem('__risen_t'); }
  catch (e) { ok = false; }
  const mem = {};
  return {
    persistent: ok,
    get(k)    { try { return ok ? localStorage.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { try { if (ok) localStorage.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } },
    remove(k) { try { if (ok) localStorage.removeItem(k); else delete mem[k]; } catch (e) { delete mem[k]; } }
  };
})();

// ---- Settings -------------------------------------------------
const SETTINGS_KEY = 'risen_settings_v1';
const DEFAULT_SETTINGS = { shake: true, floaters: true, fastTurns: false, backdrop: true,
                           statColors: true };
let SETTINGS = Object.assign({}, DEFAULT_SETTINGS);

function showBuildVersion() {
  const el = document.getElementById('build-tag');
  if (el) el.textContent = BUILD;
}

function loadSettings() {
  try {
    const raw = Store.get(SETTINGS_KEY);
    if (raw) SETTINGS = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
  } catch (e) { SETTINGS = Object.assign({}, DEFAULT_SETTINGS); }
  syncSettingsUI();
}
function saveSettings() { Store.set(SETTINGS_KEY, JSON.stringify(SETTINGS)); }
function toggleSetting(key) {
  SETTINGS[key] = !SETTINGS[key];
  saveSettings();
  syncSettingsUI();
}
function syncSettingsUI() {
  Object.keys(DEFAULT_SETTINGS).forEach(k => {
    const el = document.getElementById('set-' + k);
    if (el) el.classList.toggle('on', !!SETTINGS[k]);
  });
  // The backdrop is a class on the arena, not a re-render: toggling scenery
  // must never touch the fight.
  const arena = document.getElementById('arena-card');
  if (arena) arena.classList.toggle('backdrop-on', !!SETTINGS.backdrop);
  // Stat colours are pure CSS behind one class, for the same reason the
  // backdrop is: a look the owner may not keep should be one flag to kill, and
  // must never be something the rules or the render path can see.
  document.body.classList.toggle('stat-colors-on', !!SETTINGS.statColors);
}

// ---- Menu / pause navigation ----------------------------------
function newGame() {
  leaveMenuTab(); closeSettings();
  // Starting a run never asks where to put itself: the first free slot is
  // claimed silently, and with every slot full, slot 1 is overwritten. The
  // owner's explicit call — the old picker screen cost a click at the start
  // of every run to guard a decision they never wanted to be asked. The slot
  // is only claimed when startGame commits, so backing out of the intro
  // still leaves every existing save untouched.
  _pendingSlot = firstFreeSlot() || 1;
  showScreen('intro-screen');
}

// ---- DEV TOOLS -----------------------------------------------
// The owner's test rig, reachable from the title screen. SKIP TO ACT 2: the
// skilled bot plays act 1 headlessly — the real rules, in milliseconds — and
// the run is handed over on-screen exactly where the sim stopped: wave 16
// already spawned, the player's turn, whatever sheet the bot earned. No
// respawn on handover, so the between-fight heal is not paid twice. Dev runs
// save to slot 0, outside the 1..saveSlots window, so the LOAD screen never
// lists them and no real run is ever eaten. (On a saveKey bump, list _s0
// beside _s1/_s2 in oldSaveKeys.)
function openDevTools() { showScreen('dev-screen'); }

// Shared handover: the run in `state` goes on-screen, mid-run style.
function devEnterCombat(handoverLine) {
  state.saveSlot = 0;
  const zn = document.getElementById('zone-name');
  if (zn) zn.textContent = getZoneName(state.wave);
  const an = document.getElementById('act-name');
  if (an) an.textContent = getActLabel(state.wave);
  const ac = document.getElementById('arena-card');
  if (ac) ac.dataset.act = actForWave(state.wave).num;
  updateHud(); refreshTalentUI(); renderCombat(true); renderSkills(); updateTurnInfo();
  showScreen('combat-screen');
  document.getElementById('combat-screen').classList.remove('staged', 'reveal');
  log(handoverLine, 'important');
  startCombatLoop();
  saveRun();
}

function devSkipToAct2(classId) {
  if (!CLASSES[classId]) return;
  const gate = ACTS[0].endWave;
  const status = document.getElementById('dev-status');
  // First choice: the bot EARNS the sheet — act 1 played by the real rules.
  // 20 tries separates bad dice from "the bot cannot do it".
  for (let attempt = 1; attempt <= 20; attempt++) {
    simulateRun(classId, Object.assign({}, BOTS.skilled, { stopWhen: s => s.wave > gate }));
    if (state.runOver || state.wave <= gate) continue;
    devEnterCombat('DEV · the bot played act 1 (cleared on try ' + attempt
      + ') · handed over at wave ' + state.wave + ' · level ' + state.player.level);
    return;
  }
  // Fallback: a STANDARD act-1 graduate, synthesized — level 7, the act's
  // ~18 points spent along the class's skilled plan, full bar. Less organic
  // than an earned sheet, but a dev tool that sometimes refuses to open the
  // door is worse than one that hands you a template. The bot failing 20
  // straight is itself a reading: act 1 is currently harder than the
  // competence floor, and the log line below says so out loud.
  resetRunState(classId);
  state.saveSlot = 0;
  const p = freshPlayer(classId);
  state.player = p;
  p.level = 7;
  p.xp = 0; p.xpNext = xpForLevel(7);
  const plan = (typeof SKILLED_PLANS !== 'undefined' && SKILLED_PLANS[classId]) || ROTATE_STATS;
  for (let i = 0; i < 6 * P().pointsPerLevel; i++) p[plan[i % plan.length]] += 1;
  recalcPlayerStats();
  p.hp = p.maxHp;
  state.wave = ACTS[1].startWave;
  state.kills = ACTS[0].endWave;
  state.runStart = Date.now();
  state.combatActive = true;
  spawnEnemy();
  devEnterCombat('DEV · synthetic act-1 graduate (the bot went 0 for 20 on act 1 — '
    + 'worth knowing) · wave ' + state.wave + ' · level ' + p.level);
  if (status) status.textContent = 'Note: the bot could not clear act 1 as '
    + CLASSES[classId].name + ' in 20 tries, so you got a standard level-7 sheet instead.';
}

// RESIST MUTATION: a quiet transition beat, then drop into the run as base Sonny.
function resistMutation() {
  leaveMenuTab(); closeSettings();
  showScreen('resist-screen');
  // Restart the fade each time (the animation only plays once with fill: forwards).
  const line = document.querySelector('#resist-screen .resist-line');
  if (line) { line.style.animation = 'none'; void line.offsetWidth; line.style.animation = ''; }
  // Black hold 1.8s, then fade in / hold / fade out over 5s, then a beat -> run.
  // Both start points name 'base' outright rather than leaning on a stored
  // choice. This one waits ~7 seconds before it fires, and a delayed start that
  // reads shared state is precisely how the wrong strain got launched.
  const t = setTimeout(() => { offerSkip(null); startGame(false, 'base'); }, 7100);
  // Skipping here goes straight into a playable fight: cancel the transition
  // and start the run with its reveal already finished.
  offerSkip(() => { clearTimeout(t); startGame(true, 'base'); });
}

function goToMenu() {
  leaveMenuTab(); closeSettings();
  stopCombatLoop();
  showScreen('title-screen');
  refreshContinueButton();
}

function quitToMenu() {
  saveRun();
  goToMenu();
}

// Still a modal: SETTINGS is reachable from the title screen too, where there
// is no sidebar to host it.
function openSettings() {
  syncSettingsUI();
  document.getElementById('settings-modal').classList.add('show');
}
function closeSettings() {
  document.getElementById('settings-modal').classList.remove('show');
}

// ESC toggles the MENU tab during combat, and steps back out of SETTINGS first.
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (document.getElementById('settings-modal').classList.contains('show')) { closeSettings(); return; }
  if (!document.getElementById('combat-screen').classList.contains('active')) return;
  switchTab(activeTabId() === 'menu' ? _tabBeforeMenu : 'menu');
});

// ---- Save / load ----------------------------------------------
function serializeRun() {
  const p = state.player; if (!p) return null;
  return { v:2, build:BUILD, classId:state.classId, wave:state.wave, kills:state.kills,
    overkillCarry:state.overkillCarry, talentQueue:state.talentQueue,
    bestCombo:state.bestCombo, damageDealt:state.damageDealt, runStart:state.runStart,
    // The result card's run-lifetime counters. Additive fields: a save written
    // before they existed loads them as 0, counted from the reload on.
    runTurns:state.runTurns||0, damageTaken:state.damageTaken||0,
    critsLanded:state.critsLanded||0, dodges:state.dodges||0,
    // An unconfirmed allocation is not saved — it is refunded. The stats
    // written here are the committed ones, so the points sitting in pending
    // would otherwise vanish with it; reloading puts you back at "N to place,
    // nothing placed", which is the one state that cannot be half-applied.
    player:{ level:p.level, xp:p.xp, xpNext:p.xpNext, points:p.points + pendingTotal(p),
      str:p.str, instinct:p.instinct, speed:p.speed, vit:p.vit,
      dmgMult:p.dmgMult, hpMult:p.hpMult, apsMult:p.apsMult,
      talents:p.talents, talentIds:p.talentIds, hp:p.hp, maxHp:p.maxHp,
      // thornsGrown is the one raw value that is NOT a stat: sym's ramp, banked
      // across the whole run by being hit. The derived sheet recomputes thorns
      // from it on load (see applyDerivedStats), so losing it would silently
      // hand back a wave-20 sym with a wave-1 body.
      thornsGrown:p.thornsGrown||0,
      // Only the statuses marked to persist — the same set that survives into
      // the next fight, so a reload lands you in the shape a kill left you in.
      statuses:survivingStatuses(p),
      skillCds:p.skills.map(s => s.cd) } };
}
// ---- Save slots -----------------------------------------------
// A slot is nothing but its own storage key. No part of a run knows or cares
// which slot it lives in — the key IS the identity, so the saved payload needs
// no slot field and BALANCE.saveSlots is the only thing a third slot would
// change.
const slotKey = n => BALANCE.saveKey + '_s' + n;
const slotNumbers = () => Array.from({ length: BALANCE.saveSlots }, (_, i) => i + 1);

// Saves from a previous version are DROPPED, not migrated.
//
// Migrating them was the obvious thing and is the wrong thing: a save holds raw
// stats and recomputes the derived sheet on load, so carrying one across a
// rules change hands the player a character allocated under economics that no
// longer exist — a build that was correct and now is not, with nothing on
// screen to say so. An empty slot is honest; a silently rebalanced run is not.
//
// This also answers a confusing symptom: localStorage is keyed by ORIGIN, not
// by file, and every file:// page shares one bucket in Chrome and Firefox. So
// downloading a fresh copy of the game does NOT give a fresh start — the new
// file reads the same two slots the old one wrote. Clearing on a version bump
// is what makes a new build actually feel new.
function purgeOldSaves() {
  (BALANCE.oldSaveKeys || []).forEach(k => Store.remove(k));
}

// A slot counts as occupied only if what is in it can actually be loaded, so a
// truncated or stale-class payload reads as empty everywhere at once rather
// than listing as a run that fails when clicked.
function slotData(n) {
  let d = null;
  try { const r = Store.get(slotKey(n)); d = r ? JSON.parse(r) : null; } catch (e) { return null; }
  return (d && d.player && CLASSES[d.classId]) ? d : null;
}
function occupiedSlots() { return slotNumbers().filter(n => !!slotData(n)); }
function firstFreeSlot() { return slotNumbers().find(n => !slotData(n)) || null; }

// The slot the next run will take. newGame sets it — to the first free slot, or
// to whichever one the player chose to overwrite — and startGame claims it. The
// fallbacks matter because startGame is reachable without newGame in a reload
// or a test: prefer a free slot, and only then slot 1.
let _pendingSlot = null;
function claimSaveSlot() {
  const n = _pendingSlot || firstFreeSlot() || 1;
  _pendingSlot = null;
  return n;
}

function saveRun(){ if (HEADLESS.on) return; try { const d=serializeRun(); if(d) Store.set(slotKey(state.saveSlot), JSON.stringify(d)); } catch(e){} }
function clearSavedRun(){ if (HEADLESS.on) return; clearSlot(state.saveSlot); }
function clearSlot(n){
  Store.remove(slotKey(n));
  refreshContinueButton();
}
function refreshContinueButton(){
  const b=document.getElementById('continue-btn');
  if(!b) return;
  const has = occupiedSlots().length > 0;
  b.classList.toggle('is-disabled', !has);
  b.disabled = !has;
}

// LOAD GAME screen: lists the slots so each save's identity lives here, not on
// the main menu.
function openLoadScreen(){
  _armedDelete = null;
  renderSlotList('save-list');
  showScreen('load-screen');
}
function slotSummary(d){
  return 'LV ' + d.player.level + ' · Wave ' + d.wave + ' · ' + getZoneName(d.wave) +
    ' · ' + d.kills + ' kills' + (d.bestCombo ? ' · best chain ' + d.bestCombo + '×' : '');
}

// Deleting is two clicks rather than a window.confirm(): a run is hours of play,
// and native modals are blocked outright in a sandboxed embed frame — which
// would turn the guard into a silent delete on the first click. The armed slot
// resets whenever the list is re-rendered or the screen is opened.
let _armedDelete = null;

// The LOAD screen's slot list: a filled slot opens, an empty slot is inert,
// and delete is offered behind a two-click arm. (This used to double as an
// overwrite picker for NEW GAME; that screen is gone — new runs claim a slot
// silently in newGame.)
function renderSlotList(listId){
  const list = document.getElementById(listId);
  if(!list) return;
  list.innerHTML = '';
  slotNumbers().forEach(n => {
    const d = slotData(n);
    const row = document.createElement('div');
    row.className = 'save-slot' + (d ? '' : ' empty');

    const body = document.createElement('button');
    body.type = 'button';
    body.className = 'save-slot-body';
    // An empty slot has nothing behind it to open.
    body.disabled = !d;
    const colorVar = d ? (d.classId === 'base' ? 'var(--text)' : 'var(--' + d.classId + ')') : '';
    // Spans, not divs: the body is a <button>, whose content model is phrasing
    // content. The two are blocks by CSS instead.
    body.innerHTML =
      '<span class="save-slot-title"' + (d ? ' style="color:' + colorVar + '"' : '') + '>' +
        (d ? CLASSES[d.classId].name : 'EMPTY') +
        '<span class="save-slot-num">SLOT ' + n + '</span>' +
      '</span>' +
      '<span class="save-slot-meta">' +
        (d ? slotSummary(d) : 'No run saved') +
      '</span>';
    if (d) body.addEventListener('click', () => continueRun(n));
    row.appendChild(body);

    if (d) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'save-slot-del' + (_armedDelete === n ? ' armed' : '');
      del.textContent = _armedDelete === n ? 'SURE?' : '×';
      del.title = _armedDelete === n ? 'Click again to delete this run' : 'Delete this run';
      del.addEventListener('click', () => deleteSlot(n));
      row.appendChild(del);
    }
    list.appendChild(row);
  });
}

function deleteSlot(n){
  if(!slotData(n)) return;
  if(_armedDelete !== n){ _armedDelete = n; renderSlotList('save-list'); return; }
  _armedDelete = null;
  clearSlot(n);
  renderSlotList('save-list');
}

function continueRun(slot){
  const n = slot || occupiedSlots()[0];
  const d = n ? slotData(n) : null;
  if(!d){ refreshContinueButton(); renderSlotList('save-list'); return; }
  leaveMenuTab(); closeSettings();
  resetRunState(d.classId);
  state.saveSlot = n;
  const p=freshPlayer(d.classId), sp=d.player;
  Object.assign(p,{ level:sp.level||1, xp:sp.xp||0, xpNext:sp.xpNext||xpForLevel(sp.level||1),
    points:sp.points||0, str:sp.str, instinct:sp.instinct, speed:sp.speed, vit:sp.vit,
    dmgMult:sp.dmgMult||1, hpMult:sp.hpMult||1, apsMult:sp.apsMult||1,
    talents:sp.talents||{}, talentIds:sp.talentIds||[],
    thornsGrown:sp.thornsGrown||0 });
  state.player=p;
  // Saves written before statuses were persisted simply have none; anything
  // whose definition has since been removed is dropped rather than trusted.
  // A permanent status gets its duration restored because JSON turns the
  // Infinity it was saved with into null.
  if (Array.isArray(sp.statuses))
    p.statuses = sp.statuses
      .filter(s => s && STATUSES[s.type])
      .map(s => STATUSES[s.type].permanent ? Object.assign({}, s, { duration: Infinity }) : s);
  if (Array.isArray(sp.skillCds))
    p.skills.forEach((s,i) => { if (!s.basic) s.cd = sp.skillCds[i] || 0; });
  // Only what the save carries; everything else is already at its starting
  // value from resetRunState above. The chain is deliberately not restored —
  // it is not serialized, and a chain is a property of an unbroken streak of
  // kills rather than of a run.
  state.overkillCarry=d.overkillCarry||0;
  state.talentQueue=d.talentQueue||[]; state.wave=d.wave||1; state.kills=d.kills||0;
  state.bestCombo=d.bestCombo||0; state.damageDealt=d.damageDealt||0;
  state.runTurns=d.runTurns||0; state.damageTaken=d.damageTaken||0;
  state.critsLanded=d.critsLanded||0; state.dodges=d.dodges||0;
  state.runStart=d.runStart||Date.now();
  recalcPlayerStats();
  p.hp = (sp.hp && sp.maxHp) ? Math.max(1, Math.floor(p.maxHp * Math.min(1, Math.max(P().reloadHpFloor, sp.hp/sp.maxHp)))) : p.maxHp;
  updateHud(); refreshTalentUI();
  showScreen('combat-screen');
  document.getElementById('combat-screen').classList.remove('staged', 'reveal');
  state.combatActive = true;
  spawnEnemy();
  startCombatLoop();
  log('RUN RESUMED · slot ' + n + ' · wave ' + state.wave + ' · level ' + p.level, 'important');
}

