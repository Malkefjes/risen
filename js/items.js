// Suit hardware — slots, rarities, affixes, drops, the suit panel
// Items are plain JSON data: they ride in the save (player.gear) and must stay
// serializable — no functions on an item, display text comes off the tables.
// Every roll here uses Math.random: a drop is a rule, and headless must roll
// the identical item at the identical point in the stream.

const ITEM_STATS = ['str', 'instinct', 'speed', 'vit'];
const ITEM_STAT_NAMES = { str: 'STRENGTH', instinct: 'INSTINCT', speed: 'SPEED', vit: 'VITALITY' };

// `home` biases which stat a slot tends to roll (60%, first affix only) so a
// slot feels like itself without being locked. Repair has no home stat — its
// identity is its mod pool (healing), not a stat. The art is the owner's — the
// five suit pieces he drew name the slots.
const SLOTS = {
  optics:    { id: 'optics',    name: 'Helmet',        label: 'HELMET',    home: 'instinct', lot: 'H',
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

// Tier decides SHAPE, the drop wave decides SIZE: a late STANDARD ISSUE
// outrolls an early REFINED on raw points.
const RARITIES = {
  standard: { id: 'standard', name: 'STANDARD ISSUE', statAffixes: 1, mods: 0 },
  refined:  { id: 'refined',  name: 'REFINED',        statAffixes: 2, mods: 1 }
};

// Stat points per affix, banded by the zone the item dropped in. Points feed
// the same pipe as allocation (see applyDerivedStats), so nothing else scales.
const ITEM_STAT_BANDS = [[1, 2], [2, 4], [3, 6]];

// Modifier affixes (REFINED only). `ranges` is per zone; `step` keeps rolls on
// readable increments. Where each one lands in the rules:
//   critCh/critDmg/evade/block/apsBoost  applyDerivedStats
//   heavyDR                              applyEnemyDamage, telegraphed hits only
//   healBoost                            healAnchorFor — every anchored heal
//   xpBoost                              the kill XP in onEnemyDefeated
const ITEM_MODS = {
  critCh:    { id: 'critCh',    ranges: [[0.02, 0.04], [0.04, 0.06], [0.06, 0.09]], step: 0.01,
               text: v => '+' + Math.round(v * 100) + '% crit chance' },
  critDmg:   { id: 'critDmg',   ranges: [[0.15, 0.25], [0.25, 0.45], [0.45, 0.70]], step: 0.05,
               text: v => '+' + v.toFixed(2) + '× crit damage' },
  evade:     { id: 'evade',     ranges: [[0.02, 0.04], [0.04, 0.06], [0.06, 0.08]], step: 0.01,
               text: v => '+' + Math.round(v * 100) + '% evade' },
  block:     { id: 'block',     ranges: [[0.02, 0.04], [0.04, 0.07], [0.07, 0.10]], step: 0.01,
               text: v => '+' + Math.round(v * 100) + '% block' },
  heavyDR:   { id: 'heavyDR',   ranges: [[0.10, 0.16], [0.16, 0.24], [0.24, 0.32]], step: 0.02,
               text: v => '−' + Math.round(v * 100) + '% from telegraphed heavies' },
  healBoost: { id: 'healBoost', ranges: [[0.10, 0.16], [0.16, 0.26], [0.26, 0.38]], step: 0.02,
               text: v => '+' + Math.round(v * 100) + '% to all healing' },
  xpBoost:   { id: 'xpBoost',   ranges: [[0.08, 0.12], [0.12, 0.18], [0.18, 0.25]], step: 0.01,
               text: v => '+' + Math.round(v * 100) + '% XP' },
  apsBoost:  { id: 'apsBoost',  ranges: [[0.04, 0.06], [0.06, 0.10], [0.10, 0.14]], step: 0.02,
               text: v => '+' + Math.round(v * 100) + '% turn rate' }
};
const SLOT_MODS = {
  optics:    ['critCh', 'critDmg', 'xpBoost'],
  gauntlets: ['critDmg', 'critCh'],
  armor:     ['block', 'heavyDR'],
  repair:    ['healBoost'],
  boots:     ['apsBoost', 'evade']
};

// Who drops, how often, and how often it comes out REFINED. First pass is
// deliberately generous — a 45-wave run with a loot drought is a boring run.
const DROPS = {
  trash:    { chance: 0.08, refined: 0.15 },
  elite:    { chance: 0.40, refined: 0.50 },
  champion: { chance: 1.00, refined: 1.00 },
  boss:     { chance: 1.00, refined: 1.00 }
};

// ---- Generation ------------------------------------------------
function makeItem(wave, rarityId) {
  const zone = zoneForWave(wave).num;
  const slotIds = Object.keys(SLOTS);
  const slot = SLOTS[slotIds[Math.floor(Math.random() * slotIds.length)]];
  const rar = RARITIES[rarityId] || RARITIES.standard;
  const band = ITEM_STAT_BANDS[zone - 1] || ITEM_STAT_BANDS[0];

  const statPool = ITEM_STATS.slice();
  const stats = {};
  for (let i = 0; i < rar.statAffixes; i++) {
    let k;
    if (i === 0 && slot.home && Math.random() < 0.6) k = slot.home;
    else k = statPool[Math.floor(Math.random() * statPool.length)];
    statPool.splice(statPool.indexOf(k), 1);
    stats[k] = band[0] + Math.floor(Math.random() * (band[1] - band[0] + 1));
  }

  const mods = [];
  for (let i = 0; i < rar.mods; i++) {
    const pool = SLOT_MODS[slot.id] || [];
    const def = ITEM_MODS[pool[Math.floor(Math.random() * pool.length)]];
    if (!def) continue;
    const r = def.ranges[zone - 1] || def.ranges[0];
    const raw = r[0] + Math.random() * (r[1] - r[0]);
    mods.push({ id: def.id, v: +(Math.round(raw / def.step) * def.step).toFixed(4) });
  }

  // The lot number is deterministic (wave + slot letter): flavor, never a roll.
  return { slot: slot.id, rarity: rar.id, wave, name: slot.name,
           lot: wave + '-' + slot.lot, stats, mods };
}

function rollDrop(e, wave) {
  if (!e) return null;
  const kind = e.isBoss ? 'boss' : e.champion ? 'champion' : e.elite ? 'elite' : 'trash';
  const d = DROPS[kind];
  if (!d || Math.random() >= d.chance) return null;
  return makeItem(wave, Math.random() < d.refined ? 'refined' : 'standard');
}

// ---- Reading the suit ------------------------------------------
function emptyGear() {
  const g = {};
  Object.keys(SLOTS).forEach(k => { g[k] = null; });
  return g;
}
function gearList(p) {
  return (p && p.gear) ? Object.values(p.gear).filter(Boolean) : [];
}
// Stat points from fitted gear — the one seam the derived sheet reads.
function gearStat(p, key) {
  let n = 0;
  for (const it of gearList(p)) n += (it.stats && it.stats[key]) || 0;
  return n;
}
// Summed value of one modifier across the whole suit.
function gearMod(p, id) {
  let n = 0;
  for (const it of gearList(p)) for (const m of (it.mods || [])) if (m.id === id) n += m.v;
  return n;
}

// Naive worth for the bots and nothing else: total points, a mod counts as one.
function itemScore(it) {
  if (!it) return 0;
  let n = 0;
  Object.values(it.stats || {}).forEach(v => { n += v; });
  return n + (it.mods ? it.mods.length : 0);
}
function botTakesDrop(p, it) {
  return itemScore(it) > itemScore(p && p.gear ? p.gear[it.slot] : null);
}

function itemAffixLines(it) {
  const out = [];
  for (const k of ITEM_STATS)
    if (it.stats && it.stats[k]) out.push('+' + it.stats[k] + ' ' + ITEM_STAT_NAMES[k]);
  for (const m of (it.mods || [])) {
    const def = ITEM_MODS[m.id];
    if (def) out.push(def.text(m.v));
  }
  return out;
}
function itemLogName(it) {
  return RARITIES[it.rarity].name + ' ' + it.name + ' · LOT ' + it.lot;
}

// Gear restored from a save: only shapes the tables still recognize.
function loadGear(saved) {
  const g = emptyGear();
  if (saved) Object.keys(g).forEach(k => {
    const it = saved[k];
    if (it && it.slot === k && RARITIES[it.rarity]) g[k] = it;
  });
  return g;
}

// ---- Equip / drop flow -----------------------------------------
// Equip-or-leave, no inventory: fitting replaces the slot, leaving is forever.
function equipItem(p, it) {
  if (!p || !it || !SLOTS[it.slot]) return;
  if (!p.gear) p.gear = emptyGear();
  const old = p.gear[it.slot];
  p.gear[it.slot] = it;
  applyDerivedStats(p);
  logEvent('FITTED', null, itemLogName(it),
    itemAffixLines(it).concat(old ? ['replaces ' + itemLogName(old)] : []));
  floatText(p, 'FITTED', 'tally');
  updateHud(); renderSkills();
}

// The pause between fights while the card is up. state.pendingDrop is the
// gate: startCombatLoop and doSpawn refuse to move past it, and resolveDrop is
// the only way through — the sim answers it with botTakesDrop.
function presentDrop(item, killedWave) {
  state.pendingDrop = { item, killedWave };
  logEvent('RECOVERED', null, itemLogName(item), itemAffixLines(item));
  if (HEADLESS.on) return;
  renderDropModal(item);
  const m = document.getElementById('drop-modal');
  if (m) m.classList.add('show');
}

function resolveDrop(take) {
  const d = state.pendingDrop;
  if (!d) return;
  state.pendingDrop = null;
  if (!HEADLESS.on) {
    const m = document.getElementById('drop-modal');
    if (m) m.classList.remove('show');
  }
  if (take) equipItem(state.player, d.item);
  else logEvent('LEFT BEHIND', null, itemLogName(d.item));
  saveRun();
  proceedAfterKill(d.killedWave);
}

// Leaving the run mid-card (menu, new game) forfeits the drop — the item is
// deliberately not serialized, so there is nothing to hand back.
function abandonDrop() {
  if (!state.pendingDrop) return;
  state.pendingDrop = null;
  if (!HEADLESS.on) {
    const m = document.getElementById('drop-modal');
    if (m) m.classList.remove('show');
  }
}

// ---- UI ---------------------------------------------------------
function itemCardHtml(it, headline) {
  if (!it) return '<div class="drop-card empty"><div class="drop-card-body">'
    + '<div class="drop-card-head">' + headline + '</div>'
    + '<div class="drop-empty">— the mount is bare —</div></div></div>';
  const s = SLOTS[it.slot];
  return '<div class="drop-card rar-' + it.rarity + '">'
    + (s.art ? '<img class="drop-art" src="' + s.art + '" alt="" draggable="false">' : '')
    + '<div class="drop-card-body">'
    + '<div class="drop-card-head">' + headline + '</div>'
    + '<div class="drop-rarity">' + RARITIES[it.rarity].name + '</div>'
    + '<div class="drop-name">' + it.name + ' <span class="drop-lot">LOT ' + it.lot + '</span></div>'
    + itemAffixLines(it).map(l => '<div class="drop-affix">' + l + '</div>').join('')
    + '</div></div>';
}
function renderDropModal(it) {
  const el = document.getElementById('drop-body');
  if (!el) return;
  const cur = state.player && state.player.gear ? state.player.gear[it.slot] : null;
  el.innerHTML = itemCardHtml(it, 'RECOVERED · ' + SLOTS[it.slot].label)
    + itemCardHtml(cur, 'CURRENTLY FITTED');
}

function renderSuitPanel() {
  if (HEADLESS.on) return;
  const el = document.getElementById('suit-list');
  if (!el) return;
  const p = state.player;
  el.innerHTML = Object.keys(SLOTS).map(sid => {
    const s = SLOTS[sid];
    const it = p && p.gear ? p.gear[sid] : null;
    // A bare mount still shows the piece, ghosted — what goes there is part
    // of what the panel says.
    const thumb = s.art
      ? '<img class="suit-thumb' + (it ? '' : ' ghost') + '" src="' + s.art + '" alt="" draggable="false">'
      : '';
    if (!it) return '<div class="suit-slot empty">' + thumb
      + '<div class="suit-slot-body"><div class="suit-slot-label">' + s.label + '</div>'
      + '<div class="suit-slot-name">NOT FITTED</div></div></div>';
    return '<div class="suit-slot rar-' + it.rarity + '">' + thumb
      + '<div class="suit-slot-body">'
      + '<div class="suit-slot-label">' + s.label + ' · ' + RARITIES[it.rarity].name + '</div>'
      + '<div class="suit-slot-name">' + it.name + ' <span class="drop-lot">LOT ' + it.lot + '</span></div>'
      + itemAffixLines(it).map(l => '<div class="suit-affix">' + l + '</div>').join('')
      + '</div></div>';
  }).join('');
}
