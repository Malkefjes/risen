const ITEM_STAT_NAMES = { str: 'STRENGTH', instinct: 'INSTINCT', speed: 'SPEED', vit: 'VITALITY' };

const SLOTS = {
  optics:    { id: 'optics',    name: 'Optics',        label: 'OPTICS',    home: 'instinct',
               art: 'assets/sprites/mcp helmet.png' },
  gauntlets: { id: 'gauntlets', name: 'Gauntlets',     label: 'GAUNTLETS', home: 'str',
               art: 'assets/sprites/mcp gauntlets.png' },
  armor:     { id: 'armor',     name: 'Body Armor',    label: 'ARMOR',     home: 'vit',
               art: 'assets/sprites/mcp body armor.png' },
  boots:     { id: 'boots',     name: 'Boots',         label: 'BOOTS',     home: 'speed',
               art: 'assets/sprites/mcp boots.png' }
};

const RARITIES = {
  standard:  { id: 'standard',  name: 'STANDARD ISSUE', prefixes: 1 },
  refined:   { id: 'refined',   name: 'REFINED',        prefixes: 2 },
  prototype: { id: 'prototype', name: 'PROTOTYPE',      prefixes: 3 },
  unique:    { id: 'unique',    name: 'UNCATALOGUED',   prefixes: 0 }
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
  skitter: {
    id: 'skitter', slot: 'boots', name: 'Skitter Greaves', minWave: 9,
    stats: { speed: 5 }, rule: 'hasteKill',
    ruleText: 'Every kill grants HASTE for 2 turns.' },
  redline: {
    id: 'redline', slot: 'boots', name: 'Redline Servos', minWave: 31,
    mods: { apsBoost: 0.25 }, rule: 'redline', ruleVal: 0.10,
    ruleText: 'The price of the tempo: you take 10% more damage.' }
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
    ? { stats: impDef.stats.slice(), tier: impTier,
        v: Math.max(1, Math.round(rollRange(impDef.tiers[impTier], 1) * depthStatMult(wave))) }
    : { mod: impDef.mod, tier: impTier,
        v: rollRange(impDef.tiers[impTier], ITEM_MODS[impDef.mod].step) };
  return { slot: slot.id, rarity: 'unique', uniqueId: id, wave, name: u.name,
           implicit, prefixes: [], suffixes: [] };
}

const TIER_MIN_WAVE = [46, 31, 21, 11, 1];

const TIER_WEIGHTS = [3, 3, 2, 1, 1];

function tiersFor(wave) {
  const out = [];
  for (let i = 0; i < TIER_MIN_WAVE.length; i++) if (wave >= TIER_MIN_WAVE[i]) out.push(i);
  return out.length ? out : [TIER_MIN_WAVE.length - 1];
}

function depthStatMult(wave) {
  if (wave <= BALANCE.finalWave) return 1;
  return 1 + 0.2 * Math.ceil((wave - BALANCE.finalWave) / 10);
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

const SGN = v => v < 0 ? '−' : '+';
const PCT = (v, word) => SGN(v) + Math.abs(Math.round(v * 100)) + '% ' + word;

const ITEM_MODS = {
  critCh:    { id: 'critCh',    step: 0.01, text: v => PCT(v, 'crit chance') },
  critDmg:   { id: 'critDmg',   step: 0.05, text: v => SGN(v) + Math.abs(v).toFixed(2) + '× crit damage' },
  evasion:   { id: 'evasion',   step: 0.01, text: v => PCT(v, 'evasion') },
  armor:     { id: 'armor',     step: 0.01, text: v => PCT(v, 'armor') },
  healBoost: { id: 'healBoost', step: 0.02, text: v => PCT(v, 'healing') },
  xpBoost:   { id: 'xpBoost',   step: 0.01, text: v => PCT(v, 'XP') },
  apsBoost:  { id: 'apsBoost',  step: 0.01, text: v => PCT(v, 'turn rate') },
  dmgMult:   { id: 'dmgMult',   step: 0.01, text: v => PCT(v, 'attack damage') }
};

const IMPLICIT_TIERS = [[9, 13], [7, 10], [6, 8], [4, 6], [2, 4]];

const SLOT_IMPLICIT = {
  optics:    { stats: ['instinct'], tiers: IMPLICIT_TIERS },
  gauntlets: { stats: ['str'],      tiers: IMPLICIT_TIERS },
  armor:     { stats: ['vit'],      tiers: IMPLICIT_TIERS },
  boots:     { stats: ['speed'],    tiers: IMPLICIT_TIERS }
};

const BOSS_HAUL = { min: 2, max: 3 };

const HAUL_BANDS = [
  { until: 10,       weights: [85, 15,   0], unique: 0    },
  { until: 20,       weights: [ 0, 85,  15], unique: 0    },
  { until: Infinity, weights: [ 0,  0, 100], unique: 0.12 }
];
function haulBand(wave) { return HAUL_BANDS.find(b => wave <= b.until); }

function uniquePool(wave) {
  const p = state.player;
  const worn = new Set(gearList(p).map(it => it.uniqueId).filter(Boolean));
  const eligible = Object.keys(UNIQUES).filter(id =>
    UNIQUES[id].minWave <= wave && !worn.has(id));
  const seen = new Set(state.uniqueSeen || []);
  const fresh = eligible.filter(id => !seen.has(id));
  return fresh.length ? fresh : eligible;
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

  const deep = depthStatMult(wave);
  const impDef = SLOT_IMPLICIT[slot.id];
  const impTier = rollTier(wave);
  const implicit = { stats: impDef.stats.slice(), tier: impTier,
                     v: Math.max(1, Math.round(rollRange(impDef.tiers[impTier], 1) * deep)) };

  const used = impDef.stats.slice();
  const free = a => a.groups.every(g => used.indexOf(g) < 0);

  const prefixes = [];
  for (let i = 0; i < rar.prefixes; i++) {
    let pool = ITEM_PREFIXES.filter(free);

    if (!pool.length) pool = ITEM_PREFIXES;
    if (i === 0 && slot.home && Math.random() < 0.6) {
      const homed = pool.filter(a => a.stats.indexOf(slot.home) >= 0);
      if (homed.length) pool = homed;
    }
    const def = pool[Math.floor(Math.random() * pool.length)];
    const tier = rollTier(wave);
    prefixes.push({ id: def.id, stats: def.stats.slice(), tier,
                    v: Math.max(1, Math.round(rollRange(def.tiers[tier]) * deep)) });
    def.groups.forEach(g => used.push(g));
  }

  return { slot: slot.id, rarity: rar.id, wave, name: slot.name,
           implicit, prefixes, suffixes: [] };
}

function rollBossHaul(wave) {
  const d = haulBand(wave);
  const n = BOSS_HAUL.min + Math.floor(Math.random() * (BOSS_HAUL.max - BOSS_HAUL.min + 1));
  const rarities = ['standard', 'refined', 'prototype'];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (Math.random() < d.unique * (hazardFor(wave) ? 2 : 1)) {
      const pool = uniquePool(wave);
      if (pool.length) {
        const id = pool[Math.floor(Math.random() * pool.length)];
        state.uniqueSeen = state.uniqueSeen || [];
        if (state.uniqueSeen.indexOf(id) < 0) state.uniqueSeen.push(id);
        out.push(makeUniqueItem(id, wave));
        continue;
      }
    }
    out.push(makeItem(wave, rarities[pickWeighted(d.weights)]));
  }
  return out;
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
  for (const it of gearList(p)) {
    for (const pre of (it.prefixes || []))
      if (pre.stats.indexOf(key) >= 0) n += pre.v;
    for (const s of (it.suffixes || []))
      if (s.stats && s.stats.indexOf(key) >= 0) n += s.v;
  }

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
  for (const s of (it.suffixes || [])) {
    if (s.stats) { n += s.v * s.stats.length; continue; }
    n += (s.v < 0 ? -1 : 1) * (5 - s.tier);
  }

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

function itemImplicitLine(it) {
  if (!it || !it.implicit) return '';
  if (it.implicit.stats)
    return it.implicit.stats.map(k => '+' + it.implicit.v + ' ' + ITEM_STAT_NAMES[k]).join(', ');
  const def = ITEM_MODS[it.implicit.mod];
  return def ? def.text(it.implicit.v) : '';
}
function botTakesDrop(p, it) {
  return itemScore(it) > itemScore(p && p.gear ? p.gear[it.slot] : null);
}

const STAT_ORDER = ['str', 'instinct', 'speed', 'vit'];

function itemAffixLines(it) {
  const tally = {};
  const add = (k, v) => { tally[k] = (tally[k] || 0) + v; };
  for (const pre of (it.prefixes || [])) pre.stats.forEach(s => add(s, pre.v));
  for (const s of (it.suffixes || [])) if (s.stats) s.stats.forEach(k => add(k, s.v));
  const u = uniqueDef(it);
  if (u) for (const k of Object.keys(u.stats || {})) add(k, u.stats[k]);

  const out = STAT_ORDER.filter(k => tally[k])
    .map(k => SGN(tally[k]) + Math.abs(tally[k]) + ' ' + ITEM_STAT_NAMES[k]);

  for (const s of (it.suffixes || [])) {
    if (s.stats) continue;
    const def = ITEM_MODS[s.mod];
    if (def) out.push(def.text(s.v));
  }
  if (u) {
    for (const k of Object.keys(u.mods || {})) {
      const def = ITEM_MODS[k];
      if (def) out.push(def.text(u.mods[k]));
    }
    out.push('◆ ' + u.ruleText);
  }
  return out;
}
function itemLogName(it) {
  return RARITIES[it.rarity].name + ' ' + it.name;
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
}
function nextDrop() { return (state.dropQueue && state.dropQueue[0]) || null; }

function resolveDropAt(i, take) {
  const q = state.dropQueue || [];
  if (i < 0 || i >= q.length) return;
  const item = q.splice(i, 1)[0];
  if (take) equipItem(state.player, item);
  else logEvent('LEFT BEHIND', null, itemLogName(item));
  saveRun();
  if (!HEADLESS.on) { renderCampPanel(); updateHud(); }
}

function resolveDrop(take) { resolveDropAt(0, take); }

function abandonDrop() { state.dropQueue = []; }

function itemCardHtml(it) {
  if (!it) return '<div class="drop-card empty"><div class="drop-card-body">'
    + '<div class="drop-empty">— the mount is bare —</div></div></div>';
  const s = SLOTS[it.slot];
  const imp = itemImplicitLine(it);
  return '<div class="drop-card rar-' + it.rarity + '">'
    + (s.art ? '<img class="drop-art" src="' + s.art + '" alt="" draggable="false">' : '')
    + '<div class="drop-card-body">'
    + '<div class="drop-rarity">' + RARITIES[it.rarity].name + '</div>'
    + '<div class="drop-name">' + it.name + '</div>'
    + (imp ? '<div class="drop-implicit">' + imp + '</div>' : '')
    + itemAffixLines(it).map(l => '<div class="drop-affix">' + l + '</div>').join('')
    + '</div></div>';
}

function itemDeltas(it) {
  const p = state.player;
  if (!p || !it) return [];
  const view = Object.assign({}, p);
  view.gear = Object.assign({}, p.gear, { [it.slot]: it });
  applyDerivedStats(view);

  const out = [];
  const push = (label, d, mag, unit) => {
    if (!mag) return;
    out.push({ up: d > 0, text: (d > 0 ? '+' : '−') + mag + (unit || '') + ' ' + label });
  };
  const num = d => { const r = Math.round(Math.abs(d)); return r ? formatNum(r) : ''; };
  const pct = d => { const r = Math.round(Math.abs(d) * 100); return r ? String(r) : ''; };

  const atk = attackDamage(view) - attackDamage(p);
  push('ATK', atk, num(atk));
  push('HP', view.maxHp - p.maxHp, num(view.maxHp - p.maxHp));
  push('CRIT', view.critChance - p.critChance, pct(view.critChance - p.critChance), '%');
  const cm = view.critMult - p.critMult;
  push('CRIT DMG', cm, Math.abs(cm) >= 0.005 ? Math.abs(cm).toFixed(2) : '', '×');
  const rate = (view.attackSpeed - p.attackSpeed) / Math.max(0.01, p.attackSpeed);
  push('RATE', rate, pct(rate), '%');
  push('ARMOR', view.armor - p.armor, pct(view.armor - p.armor), '%');
  push('EVASION', view.evasion - p.evasion, pct(view.evasion - p.evasion), '%');
  const hb = gearMod(view, 'healBoost') - gearMod(p, 'healBoost');
  push('HEALING', hb, pct(hb), '%');
  const xb = gearMod(view, 'xpBoost') - gearMod(p, 'xpBoost');
  push('XP', xb, pct(xb), '%');
  return out;
}

function dropHaulHtml() {
  const q = state.dropQueue || [];
  if (!q.length) return '';
  const p = state.player;
  return '<div class="camp-panel-head">RECOVERED · ' + q.length + ' TO SORT</div>'
    + '<div class="haul-list">' + q.map((it, i) => {
        const worn = p && p.gear ? p.gear[it.slot] : null;
        const deltas = itemDeltas(it);
        return '<div class="haul-row">'
          + itemCardHtml(it)
          + (deltas.length
              ? '<div class="drop-deltas">' + deltas.map(d =>
                  '<span class="' + (d.up ? 'up' : 'down') + '">' + d.text + '</span>').join('') + '</div>'
              : '')
          + '<div class="haul-worn">' + (worn
              ? 'replaces ' + RARITIES[worn.rarity].name + ' ' + worn.name
              : 'the mount is bare') + '</div>'
          + '<div class="pending-actions">'
          + '<button class="ui-btn" type="button" onclick="resolveDropAt(' + i + ', true)">FIT</button>'
          + '<button class="ui-btn is-quiet" type="button" onclick="resolveDropAt(' + i + ', false)">LEAVE</button>'
          + '</div></div>';
      }).join('') + '</div>';
}

function renderSuitPanel() {
  if (HEADLESS.on) return;
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
      + '<div class="suit-slot-label">' + RARITIES[it.rarity].name + '</div>'
      + '<div class="suit-slot-name">' + it.name + '</div>'
      + (imp ? '<div class="suit-affix suit-implicit">' + imp + '</div>' : '')
      + itemAffixLines(it).map(l => '<div class="suit-affix">' + l + '</div>').join('')
      + '</div></div>';
  }).join('');
}
