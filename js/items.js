// Suit hardware — slots, rarities, affixes, drops, the suit panel
// ============================================================
// ITEMS ARE STAT STICKS AND THAT IS THE DESIGN (owner's call, 2026-08-03o):
// MODIFICATIONS change what a button does, items grant general power. One
// system for what you do, one for how much of it you do. Nothing in this file
// should ever change a rule — if a drop wants to rewrite a press, it is a
// Modification and it belongs in mods.js.
//
// STRUCTURE, after the PoE-shaped spec the owner brought in:
//
//   IMPLICIT   fixed to the SLOT, always present, never rolled away. This is
//              what makes a mount feel like itself before any affix lands.
//   PREFIXES   STAT POINTS. +STR / +INS / +SPD / +VIT, and hybrids that grant
//              two at a lower value each.
//   SUFFIXES   PERCENTAGES. Crit, evade, block, tempo, healing, XP, telegraph
//              resistance.
//
// The split is already latent in the game — points feed the same pipe as
// allocation, percentages feed the derived sheet — so formalising it costs
// nothing and gives the deferred REFINEMENT system something to act on ("this
// has an open suffix" becomes a real statement).
//
// TIERS T1-T5, T1 BEST, AND INVISIBLE. The drop wave sets the ceiling and the
// roll is weighted toward the top of what is unlocked, so late drops are
// usually good and a T1 is still a moment — but the tier itself never reaches
// the card (owner's call): the rolled VALUE already says how good a line is,
// and a tier beside it is a second number to decode for the same answer.
//
// Items are plain JSON: they ride in the save (player.gear) and must stay
// serializable. Every roll uses Math.random — a drop is a rule, and headless
// must roll the identical item at the identical point in the stream.

const ITEM_STAT_NAMES = { str: 'STRENGTH', instinct: 'INSTINCT', speed: 'SPEED', vit: 'VITALITY' };

// `home` biases which stat a slot's prefix tends to roll (60%, first prefix
// only). The IMPLICIT is what actually fixes a slot's identity. Art is the
// owner's five suit pieces.
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

// Rarity is AFFIX COUNT and nothing else — no hidden multipliers. Four lines
// is the ceiling on purpose: the drop card is read between fights with no
// inventory to retreat to, so it has to stay scannable in a few seconds.
const RARITIES = {
  standard:  { id: 'standard',  name: 'STANDARD ISSUE', prefixes: 1, suffixes: 0 },
  refined:   { id: 'refined',   name: 'REFINED',        prefixes: 1, suffixes: 1 },
  prototype: { id: 'prototype', name: 'PROTOTYPE',      prefixes: 2, suffixes: 1 }
};

// ---- Tiers ------------------------------------------------------
// Index 0 is T1 (best). A wave unlocks a tier once it reaches its minimum.
const TIER_MIN_WAVE = [46, 31, 21, 11, 1];
// Weights from the BEST unlocked tier downward. It has to DESCEND: a bell was
// tried and it skewed the mid-game badly, because with only three tiers
// unlocked the peak landed on the two WORST of them. Flat-topped instead —
// the best two share the weight, the tail falls away.
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
// The tier is NOT shown on a card — see affixLine. It still decides what a
// line rolls and the bots still price by it; the player reads the value.

// ---- Prefixes: stat points --------------------------------------
// `groups` is what the no-duplicates rule reads: a hybrid claims BOTH of its
// stats, so it can never sit beside the single that grants one of them.
// Tier ranges run T1 first.
const ITEM_PREFIXES = [
  { id: 'p_str', stats: ['str'],      groups: ['str'],
    tiers: [[7, 10], [6, 9], [5, 7], [3, 5], [2, 3]] },
  { id: 'p_ins', stats: ['instinct'], groups: ['instinct'],
    tiers: [[7, 10], [6, 9], [5, 7], [3, 5], [2, 3]] },
  { id: 'p_spd', stats: ['speed'],    groups: ['speed'],
    tiers: [[7, 10], [6, 9], [5, 7], [3, 5], [2, 3]] },
  { id: 'p_vit', stats: ['vit'],      groups: ['vit'],
    tiers: [[7, 10], [6, 9], [5, 7], [3, 5], [2, 3]] },
  // Hybrids: two stats at one rolled value each. Lower per stat, more total.
  { id: 'p_str_vit', stats: ['str', 'vit'],      groups: ['str', 'vit'],
    tiers: [[4, 6], [4, 5], [3, 4], [2, 3], [1, 2]] },
  { id: 'p_spd_ins', stats: ['speed', 'instinct'], groups: ['speed', 'instinct'],
    tiers: [[4, 6], [4, 5], [3, 4], [2, 3], [1, 2]] },
  { id: 'p_str_ins', stats: ['str', 'instinct'], groups: ['str', 'instinct'],
    tiers: [[4, 6], [4, 5], [3, 4], [2, 3], [1, 2]] },
  { id: 'p_spd_vit', stats: ['speed', 'vit'],    groups: ['speed', 'vit'],
    tiers: [[4, 6], [4, 5], [3, 4], [2, 3], [1, 2]] }
];

// ---- Suffixes: percentages --------------------------------------
// Where each lands in the rules:
//   critCh / critDmg / evade / block / apsBoost / dmgMult   applyDerivedStats
//   heavyDR                       applyEnemyDamage, telegraphed hits only
//   healBoost                     healAnchorFor — every anchored heal
//   xpBoost                       the kill XP in onEnemyDefeated
const ITEM_MODS = {
  critCh:    { id: 'critCh',    step: 0.01, text: v => '+' + Math.round(v * 100) + '% crit chance' },
  critDmg:   { id: 'critDmg',   step: 0.05, text: v => '+' + v.toFixed(2) + '× crit damage' },
  evade:     { id: 'evade',     step: 0.01, text: v => '+' + Math.round(v * 100) + '% evade' },
  block:     { id: 'block',     step: 0.01, text: v => '+' + Math.round(v * 100) + '% block' },
  heavyDR:   { id: 'heavyDR',   step: 0.02, text: v => '−' + Math.round(v * 100) + '% from telegraphed heavies' },
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
  { id: 's_evade',     mod: 'evade',     groups: ['evade'],
    tiers: [[0.08, 0.10], [0.06, 0.08], [0.04, 0.06], [0.03, 0.04], [0.02, 0.03]] },
  { id: 's_block',     mod: 'block',     groups: ['block'],
    tiers: [[0.10, 0.13], [0.07, 0.10], [0.05, 0.07], [0.03, 0.05], [0.02, 0.03]] },
  { id: 's_heavyDR',   mod: 'heavyDR',   groups: ['heavyDR'],
    tiers: [[0.30, 0.38], [0.24, 0.30], [0.18, 0.24], [0.12, 0.18], [0.08, 0.12]] },
  { id: 's_healBoost', mod: 'healBoost', groups: ['healBoost'],
    tiers: [[0.38, 0.50], [0.28, 0.38], [0.20, 0.28], [0.14, 0.20], [0.08, 0.14]] },
  { id: 's_xpBoost',   mod: 'xpBoost',   groups: ['xpBoost'],
    tiers: [[0.25, 0.32], [0.19, 0.25], [0.14, 0.19], [0.10, 0.14], [0.06, 0.10]] },
  { id: 's_apsBoost',  mod: 'apsBoost',  groups: ['apsBoost'],
    tiers: [[0.13, 0.17], [0.10, 0.13], [0.07, 0.10], [0.05, 0.07], [0.03, 0.05]] },
  { id: 's_dmgMult',   mod: 'dmgMult',   groups: ['dmgMult'],
    tiers: [[0.20, 0.26], [0.15, 0.20], [0.11, 0.15], [0.08, 0.11], [0.05, 0.08]] }
];

// Which suffixes a slot can carry. A mount only grants what it plausibly could.
const SLOT_SUFFIXES = {
  optics:    ['s_critCh', 's_critDmg', 's_xpBoost'],
  gauntlets: ['s_dmgMult', 's_critDmg', 's_critCh'],
  armor:     ['s_block', 's_heavyDR', 's_healBoost'],
  repair:    ['s_healBoost', 's_heavyDR', 's_xpBoost'],
  boots:     ['s_apsBoost', 's_evade', 's_critCh']
};

// The slot's own line, always present, roughly half a suffix roll — identity
// rather than power.
const SLOT_IMPLICIT = {
  optics:    { mod: 'critCh',    tiers: [[0.06, 0.08], [0.05, 0.06], [0.04, 0.05], [0.03, 0.04], [0.02, 0.03]] },
  gauntlets: { mod: 'dmgMult',   tiers: [[0.14, 0.20], [0.11, 0.14], [0.08, 0.11], [0.06, 0.08], [0.04, 0.06]] },
  armor:     { mod: 'block',     tiers: [[0.06, 0.09], [0.05, 0.06], [0.04, 0.05], [0.03, 0.04], [0.02, 0.03]] },
  repair:    { mod: 'healBoost', tiers: [[0.20, 0.28], [0.16, 0.20], [0.12, 0.16], [0.09, 0.12], [0.06, 0.09]] },
  boots:     { mod: 'apsBoost',  tiers: [[0.08, 0.11], [0.06, 0.08], [0.05, 0.06], [0.04, 0.05], [0.02, 0.04]] }
};

// Who drops, how often, and what it comes out as. Rarity weights are
// [standard, refined, prototype]; champions and bosses never roll standard.
const DROPS = {
  trash:    { chance: 0.08, weights: [75, 25, 0] },
  elite:    { chance: 0.40, weights: [40, 50, 10] },
  champion: { chance: 1.00, weights: [0, 70, 30] },
  boss:     { chance: 1.00, weights: [0, 50, 50] }
};

// ---- Generation -------------------------------------------------
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

  // The implicit: the slot's own line, at its own rolled tier.
  const impDef = SLOT_IMPLICIT[slot.id];
  const impTier = rollTier(wave);
  const implicit = { mod: impDef.mod, tier: impTier,
                     v: rollRange(impDef.tiers[impTier], ITEM_MODS[impDef.mod].step) };

  // NO DUPLICATE GROUPS, across prefixes and suffixes alike: an affix is only
  // eligible if none of its groups is already claimed.
  //
  // THE IMPLICIT CLAIMS ITS GROUP TOO, which is a deliberate divergence from
  // the spec this was built off — PoE lets an implicit and an explicit grant
  // the same thing. Here the drop card is a three-second read with no
  // inventory behind it, and "+3% block / +5% block" spends two of its four
  // lines saying one thing. Every item now shows two different percentages.
  const used = [impDef.mod];
  const free = a => a.groups.every(g => used.indexOf(g) < 0);

  const prefixes = [];
  for (let i = 0; i < rar.prefixes; i++) {
    let pool = ITEM_PREFIXES.filter(free);
    // The home stat leans the FIRST prefix only, so a slot reads like itself
    // without ever being locked to one stat.
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

  // The lot number is deterministic (wave + slot letter): flavour, never a roll.
  return { slot: slot.id, rarity: rar.id, wave, name: slot.name,
           lot: wave + '-' + slot.lot, implicit, prefixes, suffixes };
}

function rollDrop(e, wave) {
  if (!e) return null;
  const kind = e.isBoss ? 'boss' : e.champion ? 'champion' : e.elite ? 'elite' : 'trash';
  const d = DROPS[kind];
  if (!d || Math.random() >= d.chance) return null;
  const rarities = ['standard', 'refined', 'prototype'];
  return makeItem(wave, rarities[pickWeighted(d.weights)]);
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
// Stat points from fitted gear — prefixes only. The one seam the derived
// sheet reads for allocation-style points.
function gearStat(p, key) {
  let n = 0;
  for (const it of gearList(p))
    for (const pre of (it.prefixes || []))
      if (pre.stats.indexOf(key) >= 0) n += pre.v;
  return n;
}
// Summed percentage for one modifier: the implicit plus any suffix granting it.
function gearMod(p, id) {
  let n = 0;
  for (const it of gearList(p)) {
    if (it.implicit && it.implicit.mod === id) n += it.implicit.v;
    for (const s of (it.suffixes || [])) if (s.mod === id) n += s.v;
  }
  return n;
}

// Naive worth for the bots and nothing else: stat points, with a percentage
// line counted as a couple of points so a rarity is never worth less than a
// plain one.
// Stat points, plus percentage lines priced by TIER rather than counted — a
// T1 suffix and a T5 suffix are not the same line, and scoring them as one
// had the bots swapping a good item for a worse one of the same rarity.
function itemScore(it) {
  if (!it) return 0;
  let n = 0;
  for (const pre of (it.prefixes || [])) n += pre.v * pre.stats.length;
  for (const s of (it.suffixes || [])) n += (5 - s.tier);
  if (it.implicit) n += (5 - it.implicit.tier) * 0.5;
  return n;
}
function botTakesDrop(p, it) {
  return itemScore(it) > itemScore(p && p.gear ? p.gear[it.slot] : null);
}

// ---- Display ----------------------------------------------------
// `tier` is taken and deliberately unused: it stays in the data (generation
// reads it, itemScore prices by it) and off the card, where "T4" is a second
// number to decode beside the one that already says how good the line is.
function affixLine(tier, text) { return text; }
function itemImplicitLine(it) {
  if (!it || !it.implicit) return '';
  const def = ITEM_MODS[it.implicit.mod];
  return def ? affixLine(it.implicit.tier, def.text(it.implicit.v)) : '';
}
// Explicits only — the implicit is rendered in its own block above them.
function itemAffixLines(it) {
  const out = [];
  for (const pre of (it.prefixes || []))
    out.push(affixLine(pre.tier,
      pre.stats.map(s => '+' + pre.v + ' ' + ITEM_STAT_NAMES[s]).join(', ')));
  for (const s of (it.suffixes || [])) {
    const def = ITEM_MODS[s.mod];
    if (def) out.push(affixLine(s.tier, def.text(s.v)));
  }
  return out;
}
function itemLogName(it) {
  return RARITIES[it.rarity].name + ' ' + it.name + ' · LOT ' + it.lot;
}

// Gear restored from a save: only shapes the tables still recognise. An item
// written before the affix restructure has no `prefixes` and is dropped rather
// than half-read — the run survives, the gear does not.
function loadGear(saved) {
  const g = emptyGear();
  if (saved) Object.keys(g).forEach(k => {
    const it = saved[k];
    if (it && it.slot === k && RARITIES[it.rarity] && Array.isArray(it.prefixes)) g[k] = it;
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
    [itemImplicitLine(it)].concat(itemAffixLines(it))
      .concat(old ? ['replaces ' + itemLogName(old)] : []));
  floatText(p, 'FITTED', 'tally');
  updateHud(); renderSkills();
}

// The pause between fights while the card is up. state.pendingDrop is the
// gate: startCombatLoop and doSpawn refuse to move past it, and resolveDrop is
// the only way through — the sim answers it with botTakesDrop.
function presentDrop(item, killedWave) {
  state.pendingDrop = { item, killedWave };
  logEvent('RECOVERED', null, itemLogName(item),
           [itemImplicitLine(item)].concat(itemAffixLines(item)));
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
