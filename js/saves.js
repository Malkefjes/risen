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
const DEFAULT_SETTINGS = { backdrop: true };
let SETTINGS = Object.assign({}, DEFAULT_SETTINGS);

function showBuildVersion() {
  const el = document.getElementById('build-tag');
  if (el) el.textContent = BUILD;
}

function loadSettings() {
  try {
    const raw = Store.get(SETTINGS_KEY);
    // Only keys that still exist are read back, so a setting that is deleted
    // stops being carried around by everyone who ever had it switched.
    const saved = raw ? JSON.parse(raw) : {};
    SETTINGS = Object.assign({}, DEFAULT_SETTINGS);
    Object.keys(DEFAULT_SETTINGS).forEach(k => { if (k in saved) SETTINGS[k] = saved[k]; });
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
// The owner's test rig, reachable from the title screen. SKIP TO ZONE 2: the
// smart bot plays zone 1 headlessly and the run is handed over on-screen exactly
// where the sim stopped, with no respawn on handover so the between-fight heal
// is not paid twice. Dev runs save to slot 0, outside the 1..saveSlots window,
// so the LOAD screen never lists them. (On a saveKey bump, list _s0 beside the
// others in oldSaveKeys.)
function openDevTools() { showScreen('dev-screen'); }

// Shared handover: the run in `state` goes on-screen, mid-run style.
function devEnterCombat(handoverLine) {
  state.saveSlot = 0;
  // The bot may have stopped mid-drop; answer it its own way before handover,
  // or the pendingDrop gate would hold a card that was never drawn on screen.
  if (state.pendingDrop) resolveDrop(botTakesDrop(state.player, state.pendingDrop.item));
  if (state.pendingMods) takeMod(botTakesMod(state.pendingMods.offer));
  const zn = document.getElementById('zone-name');
  if (zn) zn.textContent = getZoneName(state.wave);
  const ac = document.getElementById('arena-card');
  if (ac) ac.dataset.zone = zoneForWave(state.wave).num;
  updateHud(); renderCombat(true); renderSkills(); updateTurnInfo();
  showScreen('combat-screen');
  document.getElementById('combat-screen').classList.remove('staged', 'reveal');
  log(handoverLine);
  startCombatLoop();
  saveRun();
}

// Straight to the fight that now has a scripted answer to losing. Psy only,
// because it exists to test the first boss and its rescue rather than to be a
// second way into a run.
function devSkipToFirstBoss() {
  const classId = 'psy';
  const gate = BALANCE.bossEvery - 1;
  for (let attempt = 1; attempt <= 20; attempt++) {
    simulateRun(classId, Object.assign({}, BOTS.smart, { stopWhen: s => s.wave > gate }));
    if (state.runOver || state.wave <= gate) continue;
    // The bot's own rescue must not carry into the handover, or the fight this
    // button exists to reach would arrive with its answer already spent.
    state.rescued = false;
    devEnterCombat('DEV · the bot played waves 1-' + gate + ' (cleared on try ' + attempt
      + ') · handed over at the first boss · level ' + state.player.level);
    return;
  }
}

function devSkipToZone(classId, zoneNum) {
  if (!CLASSES[classId]) return;
  const z = ZONES.find(x => x.num === (zoneNum || 2));
  if (!z || z.num < 2) return;
  const gate = z.startWave - 1;
  // First choice: the bot EARNS the sheet — everything before the gate played
  // by the real rules. 20 tries separates bad dice from "the bot cannot do it".
  for (let attempt = 1; attempt <= 20; attempt++) {
    simulateRun(classId, Object.assign({}, BOTS.smart, { stopWhen: s => s.wave > gate }));
    if (state.runOver || state.wave <= gate) continue;
    devEnterCombat('DEV · the bot played waves 1-' + gate + ' (cleared on try ' + attempt
      + ') · handed over at wave ' + state.wave + ' · level ' + state.player.level);
    return;
  }
  // Fallback: a synthesized graduate at the level a run of that length reaches.
  // Less organic than an earned sheet, but a dev tool that sometimes refuses to
  // open the door is worse than one that hands you a template. The bot failing
  // 20 straight is itself a reading, and the handover line says so out loud.
  // Levels re-guessed for the 10-wave zones; not measured.
  const level = z.num === 2 ? 5 : 9;
  resetRunState(classId);
  state.saveSlot = 0;
  const p = freshPlayer(classId);
  state.player = p;
  p.level = level;
  p.xp = 0; p.xpNext = xpForLevel(level);
  // An even spread, the same shape the smart bot allocates in. (This used to
  // consult SKILLED_PLANS, a per-strain plan table deleted with the old bots —
  // the guard meant it had silently been the even spread for a long time.)
  for (let i = 0; i < (level - 1) * P().pointsPerLevel; i++)
    p[ROTATE_STATS[i % ROTATE_STATS.length]] += 1;
  recalcPlayerStats();
  p.hp = p.maxHp;
  state.wave = z.startWave;
  state.runStart = Date.now();
  state.combatActive = true;
  spawnEnemy();
  devEnterCombat('DEV · synthetic wave-' + z.startWave + ' graduate (the bot went 0 for 20 '
    + 'on waves 1-' + gate + ' — worth knowing) · wave ' + state.wave + ' · level ' + p.level);
}

// RUN CLEAN: a quiet transition beat, then drop into the run as base
// Sonny. 'base' is named outright rather than leaning on a stored choice.
function runClean() {
  playStrainIntro('base', 'You have chosen to go out in the suit as issued…');
}

function goToMenu() {
  leaveMenuTab(); closeSettings();
  abandonDrop(); abandonMods();
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
  return { v:2, build:BUILD, classId:state.classId, wave:state.wave,
    damageDealt:state.damageDealt, runStart:state.runStart,
    // The result card's run-lifetime counters. Additive fields: a save written
    // before they existed loads them as 0, counted from the reload on.
    runTurns:state.runTurns||0, damageTaken:state.damageTaken||0,
    critsLanded:state.critsLanded||0, dodges:state.dodges||0,
    // The run ledger rides along, or a reloaded run's result screen would
    // report a breakdown that starts from the moment you pressed CONTINUE.
    dmgBySource:state.dmgBySource||{}, skillUses:state.skillUses||{},
    peakStrain:state.peakStrain||0,
    // The one-shot rescue. Saved because it is spent, not because it is a
    // counter: without it a reload would hand the first boss's answer back.
    rescued:!!state.rescued,
    // An unconfirmed allocation is not saved — it is refunded. The stats
    // written here are the committed ones, so the points sitting in pending
    // would otherwise vanish with it; reloading puts you back at "N to place,
    // nothing placed", which is the one state that cannot be half-applied.
    player:{ level:p.level, xp:p.xp, xpNext:p.xpNext, points:p.points + pendingTotal(p),
      str:p.str, instinct:p.instinct, speed:p.speed, vit:p.vit,
      dmgMult:p.dmgMult, hpMult:p.hpMult, apsMult:p.apsMult,
      hp:p.hp, maxHp:p.maxHp,
      // thornsGrown is the one raw value that is NOT a stat: sym's ramp, banked
      // across the whole run by being hit. The derived sheet recomputes thorns
      // from it on load (see applyDerivedStats), so losing it would silently
      // hand back a wave-20 sym with a wave-1 body.
      thornsGrown:p.thornsGrown||0,
      // ...and what Shed tore off THIS fight, so the save round-trips the
      // player's real state rather than silently handing the spines back.
      // Between fights it is zeroed by the regrow in spawnEnemy, which is what
      // a reload lands in anyway — so this only bites where it should: a
      // reload inside the run's first fight keeps the cost.
      thornsShedded:p.thornsShedded||0,
      // Bio's carry lives BETWEEN fights, so a reload mid-run would otherwise
      // drop the pile the last kill earned.
      poisonCarry:p.poisonCarry||0,
      // Modifications ride as IDS, never as the patched skills — the patch is
      // re-applied onto fresh copies on load, so retuning a mod reaches runs
      // already carrying it instead of freezing at the version it was taken on.
      mods:Array.isArray(p.mods)?p.mods.slice():[],
      // The suit. Items are plain data; an unresolved drop card is NOT saved —
      // leaving mid-decision forfeits the item.
      gear:p.gear||null,
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

// Saves from a previous version are DROPPED, not migrated. A save holds raw
// stats and recomputes the derived sheet on load, so carrying one across a rules
// change hands the player a character allocated under economics that no longer
// exist. An empty slot is honest; a silently rebalanced run is not.
//
// It also answers a confusing symptom: localStorage is keyed by ORIGIN, so every
// file:// page shares one bucket — downloading a fresh copy of the game does NOT
// give a fresh start.
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
  return 'LV ' + d.player.level + ' · Wave ' + d.wave + ' · ' + getZoneName(d.wave);
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
    // The strain class drives the row's border, glow and title colour from CSS.
    row.className = 'save-slot' + (d ? ' strain-' + d.classId : ' empty');

    const body = document.createElement('button');
    body.type = 'button';
    body.className = 'save-slot-body';
    // An empty slot has nothing behind it to open.
    body.disabled = !d;
    // Spans, not divs: the body is a <button>, whose content model is phrasing
    // content. The two are blocks by CSS instead.
    body.innerHTML =
      '<span class="save-slot-num">SLOT ' + n + '</span>' +
      '<span class="save-slot-title">' + (d ? CLASSES[d.classId].name : 'EMPTY') + '</span>' +
      '<span class="save-slot-meta">' + (d ? slotSummary(d) : 'No run saved') + '</span>';
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
    thornsGrown:sp.thornsGrown||0, thornsShedded:sp.thornsShedded||0,
    poisonCarry:sp.poisonCarry||0 });
  p.gear = loadGear(sp.gear);
  // Only ids the tables still recognise; a deleted Modification drops out
  // rather than being trusted, exactly as a deleted status does.
  p.mods = Array.isArray(sp.mods) ? sp.mods.filter(id => modById(d.classId, id)) : [];
  applyTakenMods(p);
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
  state.wave=d.wave||1;
  // kills and bestCombo are not saved. They stay at resetRunState's 0 and count
  // from the reload on; the end-of-run report is the only thing that reads them.
  state.rescued=!!d.rescued;
  state.damageDealt=d.damageDealt||0;
  state.runTurns=d.runTurns||0; state.damageTaken=d.damageTaken||0;
  state.critsLanded=d.critsLanded||0; state.dodges=d.dodges||0;
  state.dmgBySource=d.dmgBySource||{}; state.skillUses=d.skillUses||{};
  state.peakStrain=d.peakStrain||0;
  state.runStart=d.runStart||Date.now();
  recalcPlayerStats();
  p.hp = (sp.hp && sp.maxHp) ? Math.max(1, Math.floor(p.maxHp * Math.min(1, Math.max(P().reloadHpFloor, sp.hp/sp.maxHp)))) : p.maxHp;
  updateHud();
  showScreen('combat-screen');
  document.getElementById('combat-screen').classList.remove('staged', 'reveal');
  state.combatActive = true;
  spawnEnemy();
  startCombatLoop();
  log('RUN RESUMED · slot ' + n + ' · wave ' + state.wave + ' · level ' + p.level);
}

