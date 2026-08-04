const ITEM_STAT_NAMES = { str: 'STRENGTH', instinct: 'INSTINCT', speed: 'SPEED', vit: 'VITALITY' };

const SLOTS = {
  optics:    { id: 'optics',    name: 'Optics',        label: 'OPTICS',    home: 'instinct', lot: 'O',
               art: 'assets/sprites/mcp helmet.png' },
  gauntlets: { id: 'gauntlets', name: 'Gauntlets',     label: 'GAUNTLETS', home: 'str',      lot: 'G',
               art: 'assets/sprites/mcp gauntlets.png' },
  armor:     { id: 'armor',     name: 'Body Armor',    label: 'ARMOR',     home: 'vit',      lot: 'A',
               art: 'assets/sprites/mcp body armor.png' },
  repair:    { id: 'repair',    name: 'Repair Module', label: 'REPAIR',    home: null,       lot: 'R',
               art: 'assets/sprites/mcp repair module.png' },
  boots:     { id: 'boots',     name: 'Boots',         label: 'BOOTS',     home: 'speed',    lot: 'B',
               art: 'assets/sprites/mcp boots.png' }
};

const RARITIES = {
  standard:  { id: 'standard',  name: 'STANDARD ISSUE', prefixes: 1, suffixes: 0 },
  refined:   { id: 'refined',   name: 'REFINED',        prefixes: 1, suffixes: 1 },
  prototype: { id: 'prototype', name: 'PROTOTYPE',      prefixes: 2, suffixes: 1 },
  unique:    { id: 'unique',    name: 'UNCATALOGUED',   prefixes: 0, suffixes: 0 }
};

const UNIQUES = {
  apexlens: {
    id: 'apexlens', slot: 'optics', name: 'Apex Lens', minWave: 5,
    stats: { instinct: 4 }, rule: 'firstCrit',
    ruleText: 'Your first landed strike each fight is always a CRIT.' },
  culling: {
    id: 'culling', slot: 'optics', name: 'Culling Optics', minWave: 21,
    stats: { instinct: 7 }, rule: 'cullCrit', ruleVal: 0.15,
    ruleText: '+15% crit chance against enemies below half HP.' },
  fieldbreaker: {
    id: 'fieldbreaker', slot: 'gauntlets', name: 'Fieldbreaker Gauntlets', minWave: 11,
    stats: { str: 6 }, patch: { basic: true, set: { shape: 'all' }, mul: { power: 0.65 } },
    ruleText: 'Your basic attack strikes EVERY enemy, at 65% power.' },
  momentum: {
    id: 'momentum', slot: 'gauntlets', name: 'Momentum Gauntlets', minWave: 8,
    stats: { str: 4 }, rule: 'overspill',
    ruleText: 'Overkill damage on a killing blow spills onto the next enemy.' },
  huskplate: {
    id: 'huskplate', slot: 'armor', name: 'Husk Plate', minWave: 11,
    stats: { vit: 6 }, rule: 'reflect10', ruleVal: 0.10,
    ruleText: 'Reflects 10% of damage taken back at the attacker.' },
  bulwark: {
    id: 'bulwark', slot: 'armor', name: 'Bulwark Plate', minWave: 20,
    stats: { vit: 8 }, rule: 'bigHitHalve', ruleVal: 0.25,
    ruleText: 'Once per fight: the first hit that would take a quarter of your HP is halved.' },
  autosuture: {
    id: 'autosuture', slot: 'repair', name: 'Autosuture Module', minWave: 6,
    mods: { healBoost: 0.15 }, rule: 'autosuture', ruleVal: 0.20,
    ruleText: 'Once per fight: falling below 35% HP triggers an instant heal.' },
  bivouac: {
    id: 'bivouac', slot: 'repair', name: 'Bivouac Module', minWave: 15,
    stats: { vit: 5 }, rule: 'bivouac',
    ruleText: 'Recover twice as much HP between fights.' },
  skitter: {
    id: 'skitter', slot: 'boots', name: 'Skitter Greaves', minWave: 9,
    stats: { speed: 5 }, rule: 'hasteKill',
    ruleText: 'Every kill grants HASTE for 2 turns.' },
  redline: {
    id: 'redline', slot: 'boots', name: 'Redline Servos', minWave: 31,
    mods: { apsBoost: 0.25 }, rule: 'redline', ruleVal: 0.10,
    ruleText: '+25% turn rate — but you take 10% more damage.' }
};

function uniqueDef(it) {
  return (it && it.uniqueId && UNIQUES[it.uniqueId]) || null;
}

function hasRule(p, rule) {
  for (const it of gearList(p)) {
    const u = uniqueDef(it);
    if (u && u.rule === rule) return true;
  }
  return false;
}

function ruleVal(p, rule, fallback) {
  for (const it of gearList(p)) {
    const u = uniqueDef(it);
    if (u && u.rule === rule) return u.ruleVal != null ? u.ruleVal : fallback;
  }
  return fallback;
}

function applyUniquePatch(p, it) {
  const u = uniqueDef(it);
  if (!u || !u.patch) return;
  const sk = u.patch.basic ? p.skills.find(s => s.basic) : p.skills.find(s => s.id === u.patch.skill);
  if (!sk) return;
  if (u.patch.set) Object.assign(sk, u.patch.set);
  for (const k of Object.keys(u.patch.mul || {})) sk[k] = +((Number(sk[k]) || 0) * u.patch.mul[k]).toFixed(4);
  for (const k of Object.keys(u.patch.add || {})) sk[k] = +((Number(sk[k]) || 0) + u.patch.add[k]).toFixed(4);
}

function applyGearPatches(p) {
  for (const it of gearList(p)) applyUniquePatch(p, it);
}

function makeUniqueItem(id, wave) {
  const u = UNIQUES[id];
  if (!u) return null;
  const slot = SLOTS[u.slot];
  const impDef = SLOT_IMPLICIT[slot.id];
  const impTier = rollTier(wave);
  const implicit = impDef.stats
    ? { stats: impDef.stats.slice(), tier: impTier, v: rollRange(impDef.tiers[impTier], 1) }
    : { mod: impDef.mod, tier: impTier,
        v: rollRange(impDef.tiers[impTier], ITEM_MODS[impDef.mod].step) };
  return { slot: slot.id, rarity: 'unique', uniqueId: id, wave, name: u.name,
           lot: wave + '-' + slot.lot, implicit, prefixes: [], suffixes: [] };
}

const TIER_MIN_WAVE = [46, 31, 21, 11, 1];

const TIER_WEIGHTS = [3, 3, 2, 1, 1];

function tiersFor(wave) {
  const out = [];
  for (let i = 0; i < TIER_MIN_WAVE.length; i++) if (wave >= TIER_MIN_WAVE[i]) out.push(i);
  return out.length ? out : [TIER_MIN_WAVE.length - 1];
}
function rollTier(wave) {
  const avail = tiersFor(wave);
  let total = 0;
  for (let i = 0; i < avail.length; i++) total += TIER_WEIGHTS[i] || 1;
  let r = Math.random() * total;
  for (let i = 0; i < avail.length; i++) {
    r -= (TIER_WEIGHTS[i] || 1);
    if (r < 0) return avail[i];
  }
  return avail[avail.length - 1];
}

const ITEM_PREFIXES = [
  { id: 'p_str', stats: ['str'],      groups: ['str'],
    tiers: [[7, 10], [6, 9], [5, 7], [3, 5], [2, 3]] },
  { id: 'p_ins', stats: ['instinct'], groups: ['instinct'],
    tiers: [[7, 10], [6, 9], [5, 7], [3, 5], [2, 3]] },
  { id: 'p_spd', stats: ['speed'],    groups: ['speed'],
    tiers: [[7, 10], [6, 9], [5, 7], [3, 5], [2, 3]] },
  { id: 'p_vit', stats: ['vit'],      groups: ['vit'],
    tiers: [[7, 10], [6, 9], [5, 7], [3, 5], [2, 3]] },

  { id: 'p_str_vit', stats: ['str', 'vit'],      groups: ['str', 'vit'],
    tiers: [[4, 6], [4, 5], [3, 4], [2, 3], [1, 2]] },
  { id: 'p_spd_ins', stats: ['speed', 'instinct'], groups: ['speed', 'instinct'],
    tiers: [[4, 6], [4, 5], [3, 4], [2, 3], [1, 2]] },
  { id: 'p_str_ins', stats: ['str', 'instinct'], groups: ['str', 'instinct'],
    tiers: [[4, 6], [4, 5], [3, 4], [2, 3], [1, 2]] },
  { id: 'p_spd_vit', stats: ['speed', 'vit'],    groups: ['speed', 'vit'],
    tiers: [[4, 6], [4, 5], [3, 4], [2, 3], [1, 2]] }
];

const ITEM_MODS = {
  critCh:    { id: 'critCh',    step: 0.01, text: v => '+' + Math.round(v * 100) + '% crit chance' },
  critDmg:   { id: 'critDmg',   step: 0.05, text: v => '+' + v.toFixed(2) + '× crit damage' },
  evasion:   { id: 'evasion',   step: 0.01, text: v => '+' + Math.round(v * 100) + '% evasion' },
  armor:     { id: 'armor',     step: 0.01, text: v => '+' + Math.round(v * 100) + '% armor' },
  healBoost: { id: 'healBoost', step: 0.02, text: v => '+' + Math.round(v * 100) + '% healing' },
  xpBoost:   { id: 'xpBoost',   step: 0.01, text: v => '+' + Math.round(v * 100) + '% XP' },
  apsBoost:  { id: 'apsBoost',  step: 0.01, text: v => '+' + Math.round(v * 100) + '% turn rate' },
  dmgMult:   { id: 'dmgMult',   step: 0.01, text: v => '+' + Math.round(v * 100) + '% attack damage' }
};

const ITEM_SUFFIXES = [
  { id: 's_critCh',    mod: 'critCh',    groups: ['critCh'],
    tiers: [[0.09, 0.12], [0.07, 0.09], [0.05, 0.07], [0.03, 0.05], [0.02, 0.03]] },
  { id: 's_critDmg',   mod: 'critDmg',   groups: ['critDmg'],
    tiers: [[0.70, 0.95], [0.50, 0.70], [0.35, 0.50], [0.22, 0.35], [0.15, 0.22]] },
  { id: 's_evasion',   mod: 'evasion',   groups: ['evasion'],
    tiers: [[0.08, 0.10], [0.06, 0.08], [0.04, 0.06], [0.03, 0.04], [0.02, 0.03]] },
  { id: 's_armor',     mod: 'armor',     groups: ['armor'],
    tiers: [[0.10, 0.13], [0.07, 0.10], [0.05, 0.07], [0.03, 0.05], [0.02, 0.03]] },
  { id: 's_healBoost', mod: 'healBoost', groups: ['healBoost'],
    tiers: [[0.38, 0.50], [0.28, 0.38], [0.20, 0.28], [0.14, 0.20], [0.08, 0.14]] },
  { id: 's_xpBoost',   mod: 'xpBoost',   groups: ['xpBoost'],
    tiers: [[0.25, 0.32], [0.19, 0.25], [0.14, 0.19], [0.10, 0.14], [0.06, 0.10]] },
  { id: 's_apsBoost',  mod: 'apsBoost',  groups: ['apsBoost'],
    tiers: [[0.13, 0.17], [0.10, 0.13], [0.07, 0.10], [0.05, 0.07], [0.03, 0.05]] },
  { id: 's_dmgMult',   mod: 'dmgMult',   groups: ['dmgMult'],
    tiers: [[0.20, 0.26], [0.15, 0.20], [0.11, 0.15], [0.08, 0.11], [0.05, 0.08]] }
];

const SLOT_SUFFIXES = {
  optics:    ['s_critCh', 's_critDmg', 's_xpBoost'],
  gauntlets: ['s_dmgMult', 's_critDmg', 's_critCh'],
  armor:     ['s_armor', 's_evasion', 's_healBoost'],
  repair:    ['s_healBoost', 's_armor', 's_xpBoost'],
  boots:     ['s_apsBoost', 's_evasion', 's_critCh']
};

const SLOT_IMPLICIT = {
  optics:    { mod: 'critCh',    tiers: [[0.06, 0.08], [0.05, 0.06], [0.04, 0.05], [0.03, 0.04], [0.02, 0.03]] },
  gauntlets: { mod: 'dmgMult',   tiers: [[0.14, 0.20], [0.11, 0.14], [0.08, 0.11], [0.06, 0.08], [0.04, 0.06]] },
  armor:     { stats: ['vit'],   tiers: [[9, 13], [7, 10], [6, 8], [4, 6], [2, 4]] },
  repair:    { mod: 'healBoost', tiers: [[0.20, 0.28], [0.16, 0.20], [0.12, 0.16], [0.09, 0.12], [0.06, 0.09]] },
  boots:     { stats: ['speed'], tiers: [[9, 13], [7, 10], [6, 8], [4, 6], [2, 4]] }
};

const DROPS = {
  trash:    { chance: 0.08, weights: [75, 25, 0], unique: 0 },
  elite:    { chance: 0.40, weights: [40, 50, 10], unique: 0.03 },
  champion: { chance: 1.00, weights: [0, 70, 30], unique: 0.10 },
  boss:     { chance: 1.00, weights: [0, 50, 50], unique: 0.15 }
};

function uniquePool(wave) {
  const p = state.player;
  const worn = new Set(gearList(p).map(it => it.uniqueId).filter(Boolean));
  const seen = new Set(state.uniqueSeen || []);
  return Object.keys(UNIQUES).filter(id =>
    UNIQUES[id].minWave <= wave && !worn.has(id) && !seen.has(id));
}

function rollRange(range, step) {
  const raw = range[0] + Math.random() * (range[1] - range[0]);
  if (!step) return Math.round(raw);
  return +(Math.round(raw / step) * step).toFixed(4);
}
function pickWeighted(weights) {
  let total = 0;
  for (const w of weights) total += w;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}

function makeItem(wave, rarityId) {
  const slotIds = Object.keys(SLOTS);
  const slot = SLOTS[slotIds[Math.floor(Math.random() * slotIds.length)]];
  const rar = RARITIES[rarityId] || RARITIES.standard;

  const impDef = SLOT_IMPLICIT[slot.id];
  const impTier = rollTier(wave);
  const implicit = impDef.stats
    ? { stats: impDef.stats.slice(), tier: impTier, v: rollRange(impDef.tiers[impTier], 1) }
    : { mod: impDef.mod, tier: impTier,
        v: rollRange(impDef.tiers[impTier], ITEM_MODS[impDef.mod].step) };

  const used = impDef.stats ? impDef.stats.slice() : [impDef.mod];
  const free = a => a.groups.every(g => used.indexOf(g) < 0);

  const prefixes = [];
  for (let i = 0; i < rar.prefixes; i++) {
    let pool = ITEM_PREFIXES.filter(free);

    if (i === 0 && slot.home && Math.random() < 0.6) {
      const homed = pool.filter(a => a.stats.indexOf(slot.home) >= 0);
      if (homed.length) pool = homed;
    }
    if (!pool.length) break;
    const def = pool[Math.floor(Math.random() * pool.length)];
    const tier = rollTier(wave);
    prefixes.push({ id: def.id, stats: def.stats.slice(), tier,
                    v: rollRange(def.tiers[tier]) });
    def.groups.forEach(g => used.push(g));
  }

  const suffixes = [];
  for (let i = 0; i < rar.suffixes; i++) {
    const allowed = SLOT_SUFFIXES[slot.id] || [];
    const pool = ITEM_SUFFIXES.filter(a => allowed.indexOf(a.id) >= 0 && free(a));
    if (!pool.length) break;
    const def = pool[Math.floor(Math.random() * pool.length)];
    const tier = rollTier(wave);
    suffixes.push({ id: def.id, mod: def.mod, tier,
                    v: rollRange(def.tiers[tier], ITEM_MODS[def.mod].step) });
    def.groups.forEach(g => used.push(g));
  }

  return { slot: slot.id, rarity: rar.id, wave, name: slot.name,
           lot: wave + '-' + slot.lot, implicit, prefixes, suffixes };
}

function rollDrop(e, wave) {
  if (!e) return null;
  const kind = e.isBoss ? 'boss' : e.champion ? 'champion' : e.elite ? 'elite' : 'trash';
  const d = DROPS[kind];
  if (!d) return null;
  if (d.unique > 0 && Math.random() < d.unique) {
    const pool = uniquePool(wave);
    if (pool.length) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      (state.uniqueSeen = state.uniqueSeen || []).push(id);
      return makeUniqueItem(id, wave);
    }
  }
  if (Math.random() >= d.chance * (e.dropMult || 1)) return null;
  const rarities = ['standard', 'refined', 'prototype'];
  return makeItem(wave, rarities[pickWeighted(d.weights)]);
}

function emptyGear() {
  const g = {};
  Object.keys(SLOTS).forEach(k => { g[k] = null; });
  return g;
}
function gearList(p) {
  return (p && p.gear) ? Object.values(p.gear).filter(Boolean) : [];
}

function gearStat(p, key) {
  let n = 0;
  for (const it of gearList(p))
    for (const pre of (it.prefixes || []))
      if (pre.stats.indexOf(key) >= 0) n += pre.v;

  for (const it of gearList(p)) {
    if (it.implicit && it.implicit.stats && it.implicit.stats.indexOf(key) >= 0)
      n += it.implicit.v;
    const u = uniqueDef(it);
    if (u && u.stats && u.stats[key]) n += u.stats[key];
  }
  return n;
}

function gearMod(p, id) {
  let n = 0;
  for (const it of gearList(p)) {
    if (it.implicit && it.implicit.mod === id) n += it.implicit.v;
    for (const s of (it.suffixes || [])) if (s.mod === id) n += s.v;
    const u = uniqueDef(it);
    if (u && u.mods && u.mods[id]) n += u.mods[id];
  }
  return n;
}

function itemScore(it) {
  if (!it) return 0;
  let n = 0;
  for (const pre of (it.prefixes || [])) n += pre.v * pre.stats.length;
  for (const s of (it.suffixes || [])) n += (5 - s.tier);

  if (it.implicit) n += it.implicit.stats
    ? it.implicit.v * it.implicit.stats.length
    : (5 - it.implicit.tier) * 0.5;
  const u = uniqueDef(it);
  if (u) {
    n += 8;
    for (const k of Object.keys(u.stats || {})) n += u.stats[k];
  }
  return n;
}
function botTakesDrop(p, it) {
  return itemScore(it) > itemScore(p && p.gear ? p.gear[it.slot] : null);
}

function affixLine(tier, text) { return text; }
function itemImplicitLine(it) {
  if (!it || !it.implicit) return '';
  if (it.implicit.stats)
    return affixLine(it.implicit.tier,
      it.implicit.stats.map(k => '+' + it.implicit.v + ' ' + ITEM_STAT_NAMES[k]).join(', '));
  const def = ITEM_MODS[it.implicit.mod];
  return def ? affixLine(it.implicit.tier, def.text(it.implicit.v)) : '';
}

function itemAffixLines(it) {
  const out = [];
  for (const pre of (it.prefixes || []))
    out.push(affixLine(pre.tier,
      pre.stats.map(s => '+' + pre.v + ' ' + ITEM_STAT_NAMES[s]).join(', ')));
  for (const s of (it.suffixes || [])) {
    const def = ITEM_MODS[s.mod];
    if (def) out.push(affixLine(s.tier, def.text(s.v)));
  }
  const u = uniqueDef(it);
  if (u) {
    for (const k of Object.keys(u.stats || {})) out.push('+' + u.stats[k] + ' ' + ITEM_STAT_NAMES[k]);
    for (const k of Object.keys(u.mods || {})) {
      const def = ITEM_MODS[k];
      if (def) out.push(def.text(u.mods[k]));
    }
    out.push('◆ ' + u.ruleText);
  }
  return out;
}
function itemLogName(it) {
  return RARITIES[it.rarity].name + ' ' + it.name + ' · LOT ' + it.lot;
}

function loadGear(saved) {
  const g = emptyGear();
  if (saved) Object.keys(g).forEach(k => {
    const it = saved[k];
    if (it && it.slot === k && RARITIES[it.rarity] && Array.isArray(it.prefixes)) g[k] = it;
  });
  return g;
}

function loadDropQueue(saved) {
  if (!Array.isArray(saved)) return [];
  return saved.filter(it => it && SLOTS[it.slot] && RARITIES[it.rarity] && Array.isArray(it.prefixes));
}

function equipItem(p, it) {
  if (!p || !it || !SLOTS[it.slot]) return;
  if (!p.gear) p.gear = emptyGear();
  const old = p.gear[it.slot];
  p.gear[it.slot] = it;
  rebuildSkills(p);
  applyDerivedStats(p);
  logEvent('FITTED', null, itemLogName(it),
    [itemImplicitLine(it)].concat(itemAffixLines(it))
      .concat(old ? ['replaces ' + itemLogName(old)] : []));
  floatText(p, 'FITTED', 'tally');
  updateHud(); renderSkills(true);
}

function queueDrop(item) {
  (state.dropQueue = state.dropQueue || []).push(item);
  logEvent('RECOVERED', null, itemLogName(item),
           [itemImplicitLine(item)].concat(itemAffixLines(item)));
  if (HEADLESS.on) return;
  floatText(state.player, 'SALVAGE', 'tally');
  notifyTab('suit');
  updateHud();
}
function nextDrop() { return (state.dropQueue && state.dropQueue[0]) || null; }

function resolveDrop(take) {
  const q = state.dropQueue || [];
  const item = q.shift();
  if (!item) return;
  if (take) equipItem(state.player, item);
  else logEvent('LEFT BEHIND', null, itemLogName(item));
  saveRun();
  updateHud();
}

function abandonDrop() { state.dropQueue = []; }

function itemCardHtml(it, headline) {
  if (!it) return '<div class="drop-card empty"><div class="drop-card-body">'
    + '<div class="drop-card-head">' + headline + '</div>'
    + '<div class="drop-empty">— the mount is bare —</div></div></div>';
  const s = SLOTS[it.slot];
  const imp = itemImplicitLine(it);
  return '<div class="drop-card rar-' + it.rarity + '">'
    + (s.art ? '<img class="drop-art" src="' + s.art + '" alt="" draggable="false">' : '')
    + '<div class="drop-card-body">'
    + '<div class="drop-card-head">' + headline + '</div>'
    + '<div class="drop-rarity">' + RARITIES[it.rarity].name + '</div>'
    + '<div class="drop-name">' + it.name + ' <span class="drop-lot">LOT ' + it.lot + '</span></div>'
    + (imp ? '<div class="drop-implicit">' + imp + '</div>' : '')
    + itemAffixLines(it).map(l => '<div class="drop-affix">' + l + '</div>').join('')
    + '</div></div>';
}

function renderPendingDrop() {
  if (HEADLESS.on) return;
  const el = document.getElementById('drop-pending');
  if (!el) return;
  const it = nextDrop();
  if (!it) { el.innerHTML = ''; el.classList.remove('on'); return; }
  el.classList.add('on');
  const p = state.player;
  const worn = p && p.gear ? p.gear[it.slot] : null;
  const more = (state.dropQueue || []).length - 1;
  el.innerHTML = '<div class="pending-head">FIELD RECOVERY'
      + (more > 0 ? ' <i>+' + more + ' waiting</i>' : '') + '</div>'
    + itemCardHtml(it, SLOTS[it.slot].label + ' · RECOVERED')
    + itemCardHtml(worn, 'CURRENTLY FITTED')
    + '<div class="pending-actions">'
    + '<button class="ui-btn" type="button" onclick="resolveDrop(true)">FIT</button>'
    + '<button class="ui-btn is-quiet" type="button" onclick="resolveDrop(false)">LEAVE</button>'
    + '</div>';
}

function renderSuitPanel() {
  if (HEADLESS.on) return;
  renderPendingDrop();
  const el = document.getElementById('suit-list');
  if (!el) return;
  const p = state.player;
  el.innerHTML = Object.keys(SLOTS).map(sid => {
    const s = SLOTS[sid];
    const it = p && p.gear ? p.gear[sid] : null;
    const thumb = s.art
      ? '<img class="suit-thumb' + (it ? '' : ' ghost') + '" src="' + s.art + '" alt="" draggable="false">'
      : '';
    if (!it) return '<div class="suit-slot empty">' + thumb
      + '<div class="suit-slot-body"><div class="suit-slot-label">' + s.label + '</div>'
      + '<div class="suit-slot-name">NOT FITTED</div></div></div>';
    const imp = itemImplicitLine(it);
    return '<div class="suit-slot rar-' + it.rarity + '">' + thumb
      + '<div class="suit-slot-body">'
      + '<div class="suit-slot-label">' + s.label + ' · ' + RARITIES[it.rarity].name + '</div>'
      + '<div class="suit-slot-name">' + it.name + ' <span class="drop-lot">LOT ' + it.lot + '</span></div>'
      + (imp ? '<div class="suit-affix suit-implicit">' + imp + '</div>' : '')
      + itemAffixLines(it).map(l => '<div class="suit-affix">' + l + '</div>').join('')
      + '</div></div>';
  }).join('');
}
