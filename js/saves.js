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

  const arena = document.getElementById('arena-card');
  if (arena) arena.classList.toggle('backdrop-on', !!SETTINGS.backdrop);
}

function newGame() {
  leaveMenuTab(); closeSettings();

  _pendingSlot = firstFreeSlot() || 1;
  showScreen('intro-screen');
}

function openDevTools() { showScreen('dev-screen'); }

function devEnterCombat(handoverLine) {
  state.saveSlot = 0;

  while (nextDrop()) resolveDrop(botTakesDrop(state.player, nextDrop()));
  while (nextModOffer()) takeMod(botTakesMod(nextModOffer()));
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

function devSkipToFirstBoss() {
  const classId = 'psy';
  const gate = BALANCE.bossEvery - 1;
  for (let attempt = 1; attempt <= 20; attempt++) {
    simulateRun(classId, Object.assign({}, BOTS.smart, { stopWhen: s => s.wave > gate }));
    if (state.deaths > 0 || state.wave <= gate) continue;

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

  for (let attempt = 1; attempt <= 20; attempt++) {
    simulateRun(classId, Object.assign({}, BOTS.smart, { stopWhen: s => s.wave > gate }));
    if (state.deaths > 0 || state.wave <= gate) continue;
    devEnterCombat('DEV · the bot played waves 1-' + gate + ' (cleared on try ' + attempt
      + ') · handed over at wave ' + state.wave + ' · level ' + state.player.level);
    return;
  }

  const level = z.num === 2 ? 5 : z.num === 3 ? 9 : 13;
  resetRunState(classId);
  state.saveSlot = 0;
  const p = freshPlayer(classId);
  state.player = p;
  p.level = level;
  p.xp = 0; p.xpNext = xpForLevel(level);

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

function sp0Kit(d) { return d && d.player && Array.isArray(d.player.kit) ? d.player.kit : null; }

function runClean() {
  playStrainIntro('base', 'You go down in the rig as issued…');
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

function openSettings() {
  syncSettingsUI();
  document.getElementById('settings-modal').classList.add('show');
}
function closeSettings() {
  document.getElementById('settings-modal').classList.remove('show');
}

document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (document.getElementById('settings-modal').classList.contains('show')) { closeSettings(); return; }
  if (!document.getElementById('combat-screen').classList.contains('active')) return;
  switchTab(activeTabId() === 'menu' ? _tabBeforeMenu : 'menu');
});

function serializeRun() {
  const p = state.player; if (!p) return null;
  return { v:2, build:BUILD, classId:state.classId, wave:state.wave,
    damageDealt:state.damageDealt, runStart:state.runStart,

    runTurns:state.runTurns||0, damageTaken:state.damageTaken||0,
    critsLanded:state.critsLanded||0, damagePrevented:state.damagePrevented||0,

    dmgBySource:state.dmgBySource||{}, skillUses:state.skillUses||{},
    peakStrain:state.peakStrain||0,


    dropQueue:(state.dropQueue||[]).slice(),
    modQueue:(state.modQueue||[]).map(o => o.map(m => m.id)),
    uniqueSeen:(state.uniqueSeen||[]).slice(),
    checkpoint:state.checkpoint||1, deaths:state.deaths||0, won:!!state.won,
    hazard:state.hazard||null, hazardOffer:state.hazardOffer||null,
    atCamp:!!state.atCamp,

    player:{ level:p.level, xp:p.xp, xpNext:p.xpNext, points:p.points + pendingTotal(p),
      str:p.str, instinct:p.instinct, speed:p.speed, vit:p.vit,
      dmgMult:p.dmgMult, hpMult:p.hpMult, apsMult:p.apsMult,
      hp:p.hp, maxHp:p.maxHp,

      thornsGrown:p.thornsGrown||0,

      thornsShedded:p.thornsShedded||0,

      poisonCarry:p.poisonCarry||0,
      weights:p.weights||null, allocCarry:p.allocCarry||null,

      mods:Array.isArray(p.mods)?p.mods.slice():[],

      gear:p.gear||null,

      statuses:survivingStatuses(p),

      kit:p.skills.filter(s => !s.basic).map(s => s.id),
      skillCds:p.skills.map(s => s.cd) } };
}

const slotKey = n => BALANCE.saveKey + '_s' + n;
const slotNumbers = () => Array.from({ length: BALANCE.saveSlots }, (_, i) => i + 1);

function purgeOldSaves() {
  (BALANCE.oldSaveKeys || []).forEach(k => Store.remove(k));
}

function slotData(n) {
  let d = null;
  try { const r = Store.get(slotKey(n)); d = r ? JSON.parse(r) : null; } catch (e) { return null; }
  return (d && d.player && CLASSES[d.classId]) ? d : null;
}
function occupiedSlots() { return slotNumbers().filter(n => !!slotData(n)); }
function firstFreeSlot() { return slotNumbers().find(n => !slotData(n)) || null; }

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

function openLoadScreen(){
  _armedDelete = null;
  renderSlotList('save-list');
  showScreen('load-screen');
}
function slotSummary(d){
  return 'LV ' + d.player.level + ' · Wave ' + d.wave + ' · ' + getZoneName(d.wave);
}

let _armedDelete = null;

function renderSlotList(listId){
  const list = document.getElementById(listId);
  if(!list) return;
  list.innerHTML = '';
  slotNumbers().forEach(n => {
    const d = slotData(n);
    const row = document.createElement('div');

    row.className = 'save-slot' + (d ? ' strain-' + d.classId : ' empty');

    const body = document.createElement('button');
    body.type = 'button';
    body.className = 'save-slot-body';

    body.disabled = !d;

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
  const p=freshPlayer(d.classId, sp0Kit(d)), sp=d.player;
  Object.assign(p,{ level:sp.level||1, xp:sp.xp||0, xpNext:sp.xpNext||xpForLevel(sp.level||1),
    points:sp.points||0, str:sp.str, instinct:sp.instinct, speed:sp.speed, vit:sp.vit,
    dmgMult:sp.dmgMult||1, hpMult:sp.hpMult||1, apsMult:sp.apsMult||1,
    thornsGrown:sp.thornsGrown||0, thornsShedded:sp.thornsShedded||0,
    poisonCarry:sp.poisonCarry||0,
    weights:sp.weights||{ str:0, instinct:0, speed:0, vit:0 },
    allocCarry:sp.allocCarry||{ str:0, instinct:0, speed:0, vit:0 } });
  p.gear = loadGear(sp.gear);

  p.mods = Array.isArray(sp.mods) ? sp.mods.filter(id => modById(d.classId, id)) : [];
  applyTakenMods(p);
  applyGearPatches(p);
  state.player=p;

  if (Array.isArray(sp.statuses))
    p.statuses = sp.statuses
      .filter(s => s && STATUSES[s.type])
      .map(s => STATUSES[s.type].permanent ? Object.assign({}, s, { duration: Infinity }) : s);
  if (Array.isArray(sp.skillCds))
    p.skills.forEach((s,i) => { if (!s.basic) s.cd = sp.skillCds[i] || 0; });

  state.wave=d.wave||1;

  state.dropQueue=loadDropQueue(d.dropQueue);

  state.modQueue=(Array.isArray(d.modQueue)?d.modQueue:[])
    .map(o => (Array.isArray(o)?o:[]).map(id => modById(d.classId, id)).filter(Boolean))
    .filter(o => o.length);
  state.uniqueSeen=Array.isArray(d.uniqueSeen)?d.uniqueSeen.filter(id => UNIQUES[id]):[];
  state.checkpoint=d.checkpoint||(Math.floor(((d.wave||1)-1)/10)*10+1);
  state.deaths=d.deaths||0;
  state.won=!!d.won;
  state.diedAt=0;
  state.hazard=(d.hazard && HAZARDS[d.hazard.id])?d.hazard:null;
  state.hazardOffer=Array.isArray(d.hazardOffer)?d.hazardOffer.filter(id => HAZARDS[id]):null;
  if (state.hazardOffer && !state.hazardOffer.length) state.hazardOffer=null;
  state.atCamp=!!d.atCamp;
  if (!state.atCamp) { state.dropQueue=[]; state.modQueue=[]; }
  state.damageDealt=d.damageDealt||0;
  state.runTurns=d.runTurns||0; state.damageTaken=d.damageTaken||0;
  state.critsLanded=d.critsLanded||0; state.damagePrevented=d.damagePrevented||0;
  state.dmgBySource=d.dmgBySource||{}; state.skillUses=d.skillUses||{};
  state.peakStrain=d.peakStrain||0;
  state.runStart=d.runStart||Date.now();
  recalcPlayerStats();
  p.hp = (sp.hp && sp.maxHp) ? Math.max(1, Math.floor(p.maxHp * Math.min(1, Math.max(P().reloadHpFloor, sp.hp/sp.maxHp)))) : p.maxHp;
  updateHud();
  showScreen('combat-screen');
  document.getElementById('combat-screen').classList.remove('staged', 'reveal');
  state.combatActive = true;
  log('RUN RESUMED · slot ' + n + ' · wave ' + state.wave + ' · level ' + p.level);
  if (state.atCamp) { state.awaitingSpawn = true; showCamp(); return; }
  spawnEnemy();
  startCombatLoop();
}
