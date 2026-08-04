// MODIFICATIONS — what the Laboratory does to the suit between fights
// ============================================================
// EVERY MODIFICATION IS A STRAIGHT UPGRADE TO ONE BUTTON, AND THEY STACK.
// (Owner's call, 2026-08-03q, and it overturns how this file used to work.)
//
// The first version gave every pick a COST — a trade, so that no offer was
// automatic. It read well and it failed the only test that matters: he skipped
// most of the choices, because a pick that takes something away is a pick you
// decline. What is actually wanted here is INVESTMENT.
//
// So a Modification adds to a skill and takes nothing. The decision is no
// longer "is this worth the cost" but "WHICH BUTTON DO I KEEP FEEDING" — and
// because every entry is a DELTA rather than a fixed value, the same one can be
// taken again. Eleven picks across eight upgrades per strain is a run that goes
// DEEP on two or three buttons, and two runs of the same strain stop looking
// alike without a single downside being written.
//
// STILL NOT NUMBERS ON THE SHEET. Items grant general power (js/items.js);
// these change what a PRESS does — more stacks planted, a shorter cooldown, a
// longer window. If a pick would read as "+15% damage" on the character sheet
// it belongs in items, not here.
//
// SHAPE
//   { id, name, text,
//     add: { field: delta },      additive, applied to the CURRENT value
//     mul: { field: factor },     multiplicative
//     min / max: { field: bound } clamps, so a stack cannot run somewhere silly
//     player: { field: value } }  rare: a player-level override
//
// Filed under the button they upgrade, TWO each, so "every ability has some"
// is a property of the table's shape. Two rather than three because they stack
// now: depth per button is where a run's identity comes from, and a wider
// table would only thin it.
//
// PER STRAIN, NEVER SHARED — a pool bio and base both draw from is a pool that
// makes them the same class.
const MODIFICATIONS = {
  // ---- BIOLOGICAL ---------------------------------------------------------
  bio: {
    slash: [
      { id: 'bio_sl_a', name: 'DOSAGE',      text: 'Slash: +1 POISON.',
        add: { poison: 1 } },
      { id: 'bio_sl_b', name: 'HONED EDGE',  text: 'Slash: +20% damage.',
        mul: { power: 1.20 } }
    ],
    infest: [
      { id: 'bio_in_a', name: 'SATURATION',  text: 'Infest: +2 POISON.',
        add: { poison: 2 } },
      { id: 'bio_in_b', name: 'RAPID ONSET', text: 'Infest: cooldown −1 turn, to a minimum of 2.',
        add: { cdTurns: -1 }, min: { cdTurns: 2 } }
    ],
    chitin: [
      { id: 'bio_ch_a', name: 'DENSE PLATING', text: 'Chitin: +8% damage blunted, to a maximum of 70%.',
        add: { power: 0.08 }, max: { power: 0.70 } },
      { id: 'bio_ch_b', name: 'SET CARAPACE',  text: 'Chitin: +1 turn duration, to a maximum of 4.',
        add: { duration: 1 }, max: { duration: 4 } }
    ],
    miasma: [
      { id: 'bio_mi_a', name: 'CONCENTRATE',  text: 'Miasma: +5% regeneration per turn, to a maximum of 50%.',
        add: { power: 0.05 }, max: { power: 0.50 } },
      { id: 'bio_mi_b', name: 'SCRUBBERS',    text: 'Miasma: +1 POISON removed per turn.',
        add: { tickCleanse: 1 } }
    ]
  },

  // ---- PSYCHOLOGICAL ------------------------------------------------------
  psy: {
    hunt: [
      { id: 'psy_hu_a', name: 'IMPRINT',      text: 'Hunt: +1 DREAD.',
        add: { dread: 1 } },
      { id: 'psy_hu_b', name: 'CLEAN STRIKE', text: 'Hunt: +20% damage.',
        mul: { power: 1.20 } }
    ],
    terrify: [
      { id: 'psy_te_a', name: 'PANIC',        text: 'Terrify: +2 DREAD.',
        add: { dread: 2 } },
      { id: 'psy_te_b', name: 'SUSTAINED',    text: 'Terrify: cooldown −1 turn, to a minimum of 2.',
        add: { cdTurns: -1 }, min: { cdTurns: 2 } }
    ],
    traumatize: [
      { id: 'psy_tr_a', name: 'DEEP TRAUMA',  text: 'Traumatize: +1 turn of stun, to a maximum of 3.',
        add: { stun: 1 }, max: { stun: 3 } },
      { id: 'psy_tr_b', name: 'LOW THRESHOLD', text: 'Traumatize: −1 DREAD required, to a minimum of 1.',
        add: { dreadNeed: -1 }, min: { dreadNeed: 1 } }
    ],
    kill: [
      { id: 'psy_ki_a', name: 'APPETITE',     text: 'Kill: +0.15 damage per DREAD consumed.',
        add: { perDreadPower: 0.15 } },
      { id: 'psy_ki_b', name: 'QUICK FEED',   text: 'Kill: cooldown −1 turn, to a minimum of 3.',
        add: { cdTurns: -1 }, min: { cdTurns: 3 } }
    ]
  },

  // ---- SYMBIOTIC ----------------------------------------------------------
  // NO DURATION UPGRADE ON RAISE SPINES: it stacks by 'amplify', so a duration
  // at or past its cooldown would let the multiplier ladder on itself forever.
  hyd: {
    piston: [
      { id: 'hyd_pi_a', name: 'BORE',        text: 'Piston: +25% damage.',
        mul: { power: 1.25 } },
      { id: 'hyd_pi_b', name: 'TWIN STROKE', text: 'Piston: +1 PRESSURE per hit.',
        add: { pressure: 1 } }
    ],
    surge: [
      { id: 'hyd_su_a', name: 'PRECHARGE',   text: 'Surge: +3 PRESSURE.',
        add: { pressure: 3 } },
      { id: 'hyd_su_b', name: 'WIDE BORE',   text: 'Surge: +30% damage.',
        mul: { power: 1.30 } }
    ],
    dampen: [
      { id: 'hyd_da_a', name: 'HEAVY GAUGE', text: 'Dampen: +8% reduction, to a maximum of 75%.',
        add: { power: 0.08 }, max: { power: 0.75 } },
      { id: 'hyd_da_b', name: 'LONG SEAL',   text: 'Dampen: +1 turn.',
        add: { duration: 1 } }
    ],
    rupture: [
      { id: 'hyd_ru_a', name: 'FULL VENT',   text: 'Rupture: +0.04 damage per PRESSURE spent.',
        add: { perPressurePower: 0.04 } },
      { id: 'hyd_ru_b', name: 'BLOWOUT',     text: 'Rupture: +40% base damage.',
        mul: { power: 1.40 } }
    ]
  },

  sym: {
    latch: [
      { id: 'sym_la_a', name: 'DEEP DRAW',    text: 'Latch: +10% of your THORNS added to the blow.',
        add: { thornsScale: 0.10 } },
      { id: 'sym_la_b', name: 'HARD LATCH',   text: 'Latch: +20% damage.',
        mul: { power: 1.20 } }
    ],
    spines: [
      { id: 'sym_sp_a', name: 'IRON SPINES',  text: 'Raise Spines: +0.5 to the THORNS multiplier.',
        add: { power: 0.5 } },
      { id: 'sym_sp_b', name: 'REACTIVE BARBS', text: 'Raise Spines: +2 THORNS per hit taken while up.',
        add: { growBonus: 2 } }
    ],
    shed: [
      { id: 'sym_sh_a', name: 'CLEAN TEAR',   text: 'Shed: +4% base heal, to a maximum of 30%.',
        add: { healFrac: 0.04 }, max: { healFrac: 0.30 } },
      { id: 'sym_sh_b', name: 'DEEP HARVEST', text: 'Shed: +8% of grown THORNS spendable, to a maximum of 75%.',
        add: { capFrac: 0.08 }, max: { capFrac: 0.75 } }
    ],
    provoke: [
      { id: 'sym_pr_a', name: 'BARBED HOST',  text: 'Provoke: +0.4 to the lash multiplier.',
        add: { lashMult: 0.4 } },
      { id: 'sym_pr_b', name: 'OPEN GUARD',   text: 'Provoke: +2 THORNS growth.',
        add: { growBonus: 2 } }
    ],
    // Two per button for the rest of the pool, so a kit built out of the new
    // three still fills a three-card offer.
    harden: [
      { id: 'sym_ha_a', name: 'PLATE STACK',  text: 'Harden: +8% reduction, to a maximum of 75%.',
        add: { power: 0.08 }, max: { power: 0.75 } },
      { id: 'sym_ha_b', name: 'SLOW SET',     text: 'Harden: +1 turn.',
        add: { duration: 1 } }
    ],
    impale: [
      { id: 'sym_im_a', name: 'BARBED POINT', text: 'Impale: +0.3 to the THORNS multiplier.',
        add: { thornsBurst: 0.3 } },
      { id: 'sym_im_b', name: 'DRIVEN HOME',  text: 'Impale: +25% damage.',
        mul: { power: 1.25 } }
    ],
    bristle: [
      { id: 'sym_br_a', name: 'QUICK GROWTH', text: 'Bristle: +3 THORNS.',
        add: { growBonus: 3 } },
      { id: 'sym_br_b', name: 'SHARP EDGE',   text: 'Bristle: +30% damage.',
        mul: { power: 1.30 } }
    ]
  },

  // ---- UNAUGMENTED --------------------------------------------------------
  base: {
    jab: [
      { id: 'base_ja_a', name: 'BRACED FORM', text: 'Strike: +1 RESOLVE.',
        add: { buildsResolve: 1 } },
      { id: 'base_ja_b', name: 'CLEAN FORM',  text: 'Strike: +20% damage.',
        mul: { power: 1.20 } }
    ],
    bandage: [
      { id: 'base_ba_a', name: 'FIELD SUTURE', text: 'Bandage: +4% base heal, to a maximum of 35%.',
        add: { healFrac: 0.04 }, max: { healFrac: 0.35 } },
      { id: 'base_ba_b', name: 'PRESSURE',     text: 'Bandage: +1% heal per held RESOLVE, to a maximum of 8%.',
        add: { resolveHealBonus: 0.01 }, max: { resolveHealBonus: 0.08 } }
    ],
    counter: [
      { id: 'base_co_a', name: 'IRON GUARD',  text: 'Counterpunch: +1 turn of brace, to a maximum of 4.',
        add: { duration: 1 }, max: { duration: 4 } },
      { id: 'base_co_b', name: 'HEAVY RETURN', text: 'Counterpunch: +0.4 counter damage.',
        add: { counterPower: 0.4 } }
    ],
    laststand: [
      { id: 'base_ls_a', name: 'BLOOD DEBT',  text: 'Last Stand: +0.1 damage per RESOLVE spent.',
        add: { perResolvePower: 0.1 } },
      { id: 'base_ls_b', name: 'SECOND WIND', text: 'Last Stand: cooldown −1 turn, to a minimum of 3.',
        add: { cdTurns: -1 }, min: { cdTurns: 3 } }
    ]
  }
};

// WHEN ONE IS OFFERED. The 5-wave heartbeat the run already keeps: a champion
// on every zone's wave 5, a boss on its wave 10. The FINAL boss is deliberately
// absent — a pick handed over as the run ends is not a pick.
function modWaves() {
  const out = [];
  for (let w = 5; w < BALANCE.finalWave; w += 5) out.push(w);
  return out;
}
function modDueAfter(wave) { return modWaves().indexOf(wave) >= 0; }

const MODS_OFFERED = 3;

// Flat view of a strain's table, each entry stamped with the button it
// upgrades — every read goes through this rather than knowing the table is
// two levels deep.
function modsFor(classId) {
  const bySkill = MODIFICATIONS[classId] || {};
  const out = [];
  for (const sid of Object.keys(bySkill))
    for (const m of bySkill[sid]) out.push(Object.assign({ skill: sid }, m));
  return out;
}
function modById(classId, id) { return modsFor(classId).find(m => m.id === id) || null; }
function modSkillName(classId, sid) {
  const sk = (CLASSES[classId] && CLASSES[classId].skills.find(s => s.id === sid)) || null;
  return sk ? sk.name : '';
}
function modCount(p, id) {
  return ((p && p.mods) || []).filter(x => x === id).length;
}

// Applies one upgrade to the run's skill copy. DELTAS ON THE CURRENT VALUE, so
// taking the same one twice is twice the upgrade — and so re-applying the whole
// list on load reproduces the run exactly, in order.
function applyMod(p, mod) {
  if (!p || !mod) return;
  const sk = p.skills.find(s => s.id === mod.skill);
  if (!sk) return;
  const clamp = (key, v) => {
    if (mod.min && mod.min[key] != null) v = Math.max(mod.min[key], v);
    if (mod.max && mod.max[key] != null) v = Math.min(mod.max[key], v);
    // Rounded so a long stack of fractional deltas cannot drift into float noise.
    return +v.toFixed(4);
  };
  for (const k of Object.keys(mod.add || {}))
    sk[k] = clamp(k, (Number(sk[k]) || 0) + mod.add[k]);
  for (const k of Object.keys(mod.mul || {}))
    sk[k] = clamp(k, (Number(sk[k]) || 0) * mod.mul[k]);
  if (mod.player) Object.assign(p, mod.player);
}

// Re-applies everything the run has taken, in the order it was taken.
function applyTakenMods(p) {
  if (!p || !Array.isArray(p.mods)) return;
  for (const id of p.mods) applyMod(p, modById(p.class, id));
}

// Three upgrades from three DIFFERENT buttons. Nothing is filtered out for
// having been taken — repeats are the point, and an offer that could only ever
// show new things would run dry and stop being a choice.
// EQUIPPED BUTTONS ONLY. The catalogue is bigger than the bar now, and an
// upgrade to a card you did not fit is a dead offer — one of three, on a screen
// that only appears eleven times a run.
function offerMods(p) {
  const bySkill = {};
  const fitted = new Set((p.skills || []).map(s => s.id));
  for (const m of modsFor(p.class)) {
    if (!fitted.has(m.skill)) continue;
    (bySkill[m.skill] = bySkill[m.skill] || []).push(m);
  }
  const skills = Object.keys(bySkill);
  const picked = [];
  while (picked.length < MODS_OFFERED && skills.length) {
    const sid = skills.splice(Math.floor(Math.random() * skills.length), 1)[0];
    const bag = bySkill[sid];
    picked.push(bag[Math.floor(Math.random() * bag.length)]);
  }
  return picked;
}

// QUEUED into the MODS tab, same as a drop — the fight does not stop for it.
function queueMods(offer) {
  (state.modQueue = state.modQueue || []).push(offer);
  logEvent('LABORATORY', null, 'offering ' + offer.length + ' modifications',
           offer.map(m => m.name));
  if (HEADLESS.on) return;
  floatText(state.player, 'LABORATORY', 'tally');
  notifyTab('mods');
  updateHud();
}
function nextModOffer() { return (state.modQueue && state.modQueue[0]) || null; }

// id null (or unknown) declines. Kept even though every pick is an upgrade:
// a player who wants none of the three should not be made to install one.
function takeMod(id) {
  const q = state.modQueue || [];
  const offer = q.shift();
  if (!offer) return;
  const p = state.player;
  const mod = id ? modById(p.class, id) : null;
  if (mod) {
    p.mods = (p.mods || []).concat(mod.id);
    applyMod(p, mod);
    applyDerivedStats(p);
    const n = modCount(p, mod.id);
    logEvent('MODIFICATION', null, mod.name + (n > 1 ? ' \u00d7' + n : ''),
             [modSkillName(p.class, mod.skill), mod.text]);
    floatText(p, mod.name, 'tally');
    renderSkills(true);
  } else {
    logEvent('MODIFICATION', null, 'declined');
  }
  saveRun();
  updateHud();
}

// The bot's hand: every pick is an upgrade, so what is left is which BUTTON to
// feed, and it feeds the one it presses most. Draws no RNG — the OFFER was the
// rules draw.
function botTakesMod(offer, p) {
  p = p || state.player;
  if (!offer || !offer.length || !p) return null;
  const uses = state.skillUses || {};
  let best = offer[0], bestN = -1;
  for (const m of offer) {
    const n = uses[m.skill] || 0;
    if (n > bestN) { bestN = n; best = m; }
  }
  return best.id;
}

function abandonMods() { state.modQueue = []; }

// ---- UI ---------------------------------------------------------
// The offer, in the MODS tab. Three cards and a decline, and the fight keeps
// running behind them.
function renderModPanel() {
  if (HEADLESS.on) return;
  renderModList();
  const el = document.getElementById('mod-offer');
  if (!el) return;
  const offer = nextModOffer();
  if (!offer) { el.innerHTML = ''; el.classList.remove('on'); return; }
  el.classList.add('on');
  const p = state.player;
  const cls = p ? p.class : '';
  const more = (state.modQueue || []).length - 1;
  el.innerHTML = '<div class="pending-head">LABORATORY'
      + (more > 0 ? ' <i>+' + more + ' waiting</i>' : '') + '</div>'
    + offer.map(m => {
        const held = modCount(p, m.id);
        return '<button class="mod-card strain-' + cls + '" type="button" onclick="takeMod(\'' + m.id + '\')">'
          + '<div class="mod-head">'
          + '<span class="mod-name">' + m.name + (held ? ' <i class="mod-held">×' + held + '</i>' : '') + '</span>'
          + '<span class="mod-on">' + modSkillName(cls, m.skill) + '</span></div>'
          + '<div class="mod-text">' + highlightKeywords(m.text) + '</div></button>';
      }).join('')
    + '<button class="ui-btn is-quiet mod-skip" type="button" onclick="takeMod(null)">DECLINE</button>';
}

function renderModList() {
  if (HEADLESS.on) return;
  const el = document.getElementById('mod-list');
  if (!el) return;
  const p = state.player;
  const taken = (p && p.mods) || [];
  if (!taken.length) {
    el.innerHTML = '<div class="suit-slot empty"><div class="suit-slot-body">'
      + '<div class="suit-slot-name">NOTHING INSTALLED</div></div></div>';
    return;
  }
  // Grouped, in the order each was first taken, with the stack count — a list
  // repeating "DOSAGE" four times says less than "DOSAGE ×4".
  const seen = [];
  taken.forEach(id => { if (seen.indexOf(id) < 0) seen.push(id); });
  el.innerHTML = seen.map(id => {
    const m = modById(p.class, id);
    if (!m) return '';
    const n = taken.filter(x => x === id).length;
    return '<div class="mod-entry">'
      + '<div class="mod-head"><span class="mod-name">' + m.name
      + (n > 1 ? ' <i class="mod-held">×' + n + '</i>' : '') + '</span>'
      + '<span class="mod-on">' + modSkillName(p.class, m.skill) + '</span></div>'
      + '<div class="mod-text">' + highlightKeywords(m.text) + '</div></div>';
  }).join('');
}
