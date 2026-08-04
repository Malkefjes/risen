const MODIFICATIONS = {

  bio: {
    slash: [
      { id: 'bio_sl_a', name: 'DOSAGE',      text: '+1 POISON.',
        add: { poison: 1 } },
      { id: 'bio_sl_b', name: 'HONED EDGE',  text: '+20% damage.',
        mul: { power: 1.20 } }
    ],
    infest: [
      { id: 'bio_in_a', name: 'SATURATION',  text: '+2 POISON.',
        add: { poison: 2 } },
      { id: 'bio_in_b', name: 'RAPID ONSET', text: 'cooldown −1 turn, to a minimum of 2.',
        add: { cdTurns: -1 }, min: { cdTurns: 2 } }
    ],
    chitin: [
      { id: 'bio_ch_a', name: 'DENSE PLATING', text: '+8% damage blunted, to a maximum of 70%.',
        add: { power: 0.08 }, max: { power: 0.70 } },
      { id: 'bio_ch_b', name: 'SET CARAPACE',  text: '+1 turn duration, to a maximum of 4.',
        add: { duration: 1 }, max: { duration: 4 } }
    ],
    miasma: [
      { id: 'bio_mi_a', name: 'CONCENTRATE',  text: '+5% regeneration per turn, to a maximum of 50%.',
        add: { power: 0.05 }, max: { power: 0.50 } },
      { id: 'bio_mi_b', name: 'SCRUBBERS',    text: '+1 POISON removed per turn.',
        add: { tickCleanse: 1 } }
    ]
  },

  psy: {
    hunt: [
      { id: 'psy_hu_a', name: 'IMPRINT',      text: '+1 DREAD.',
        add: { dread: 1 } },
      { id: 'psy_hu_b', name: 'CLEAN STRIKE', text: '+20% damage.',
        mul: { power: 1.20 } }
    ],
    terrify: [
      { id: 'psy_te_a', name: 'PANIC',        text: '+2 DREAD.',
        add: { dread: 2 } },
      { id: 'psy_te_b', name: 'SUSTAINED',    text: 'cooldown −1 turn, to a minimum of 2.',
        add: { cdTurns: -1 }, min: { cdTurns: 2 } }
    ],
    traumatize: [
      { id: 'psy_tr_a', name: 'DEEP TRAUMA',  text: '+1 turn of stun, to a maximum of 3.',
        add: { stun: 1 }, max: { stun: 3 } },
      { id: 'psy_tr_b', name: 'LOW THRESHOLD', text: '−1 DREAD required, to a minimum of 1.',
        add: { dreadNeed: -1 }, min: { dreadNeed: 1 } }
    ],
    kill: [
      { id: 'psy_ki_a', name: 'APPETITE',     text: '+0.15 damage per DREAD consumed.',
        add: { perDreadPower: 0.15 } },
      { id: 'psy_ki_b', name: 'QUICK FEED',   text: 'cooldown −1 turn, to a minimum of 3.',
        add: { cdTurns: -1 }, min: { cdTurns: 3 } }
    ]
  },

  hyd: {
    piston: [
      { id: 'hyd_pi_a', name: 'BORE',        text: '+25% damage.',
        mul: { power: 1.25 } },
      { id: 'hyd_pi_b', name: 'TWIN STROKE', text: '+1 PRESSURE per hit.',
        add: { pressure: 1 } }
    ],
    surge: [
      { id: 'hyd_su_a', name: 'PRECHARGE',   text: '+3 PRESSURE.',
        add: { pressure: 3 } },
      { id: 'hyd_su_b', name: 'WIDE BORE',   text: '+30% damage.',
        mul: { power: 1.30 } }
    ],
    dampen: [
      { id: 'hyd_da_a', name: 'HEAVY GAUGE', text: '+8% reduction, to a maximum of 75%.',
        add: { power: 0.08 }, max: { power: 0.75 } },
      { id: 'hyd_da_b', name: 'LONG SEAL',   text: '+1 turn.',
        add: { duration: 1 } }
    ],
    rupture: [
      { id: 'hyd_ru_a', name: 'FULL VENT',   text: '+0.04 damage per PRESSURE spent.',
        add: { perPressurePower: 0.04 } },
      { id: 'hyd_ru_b', name: 'BLOWOUT',     text: '+40% base damage.',
        mul: { power: 1.40 } }
    ]
  },

  sym: {
    latch: [
      { id: 'sym_la_a', name: 'DEEP DRAW',    text: '+10% of your THORNS added to the blow.',
        add: { thornsScale: 0.10 } },
      { id: 'sym_la_b', name: 'HARD LATCH',   text: '+20% damage.',
        mul: { power: 1.20 } }
    ],
    spines: [
      { id: 'sym_sp_a', name: 'IRON SPINES',  text: '+0.5 to the THORNS multiplier.',
        add: { power: 0.5 } },
      { id: 'sym_sp_b', name: 'REACTIVE BARBS', text: '+2 THORNS per hit taken while up.',
        add: { growBonus: 2 } }
    ],
    shed: [
      { id: 'sym_sh_a', name: 'CLEAN TEAR',   text: '+4% base heal, to a maximum of 30%.',
        add: { healFrac: 0.04 }, max: { healFrac: 0.30 } },
      { id: 'sym_sh_b', name: 'DEEP HARVEST', text: '+8% of grown THORNS spendable, to a maximum of 75%.',
        add: { capFrac: 0.08 }, max: { capFrac: 0.75 } }
    ],
    provoke: [
      { id: 'sym_pr_a', name: 'BARBED HOST',  text: '+0.4 to the lash multiplier.',
        add: { lashMult: 0.4 } },
      { id: 'sym_pr_b', name: 'OPEN GUARD',   text: '+2 THORNS growth.',
        add: { growBonus: 2 } }
    ],

    harden: [
      { id: 'sym_ha_a', name: 'PLATE STACK',  text: '+8% reduction, to a maximum of 75%.',
        add: { power: 0.08 }, max: { power: 0.75 } },
      { id: 'sym_ha_b', name: 'SLOW SET',     text: '+1 turn.',
        add: { duration: 1 } }
    ],
    impale: [
      { id: 'sym_im_a', name: 'BARBED POINT', text: '+0.3 to the THORNS multiplier.',
        add: { thornsBurst: 0.3 } },
      { id: 'sym_im_b', name: 'DRIVEN HOME',  text: '+25% damage.',
        mul: { power: 1.25 } }
    ],
    bristle: [
      { id: 'sym_br_a', name: 'QUICK GROWTH', text: '+3 THORNS.',
        add: { growBonus: 3 } },
      { id: 'sym_br_b', name: 'SHARP EDGE',   text: '+30% damage.',
        mul: { power: 1.30 } }
    ]
  },

  base: {
    jab: [
      { id: 'base_ja_a', name: 'BRACED FORM', text: '+1 RESOLVE.',
        add: { buildsResolve: 1 } },
      { id: 'base_ja_b', name: 'CLEAN FORM',  text: '+20% damage.',
        mul: { power: 1.20 } }
    ],
    bandage: [
      { id: 'base_ba_a', name: 'FIELD SUTURE', text: '+4% base heal, to a maximum of 35%.',
        add: { healFrac: 0.04 }, max: { healFrac: 0.35 } },
      { id: 'base_ba_b', name: 'PRESSURE',     text: '+1% heal per held RESOLVE, to a maximum of 8%.',
        add: { resolveHealBonus: 0.01 }, max: { resolveHealBonus: 0.08 } }
    ],
    counter: [
      { id: 'base_co_a', name: 'IRON GUARD',  text: '+1 turn of brace, to a maximum of 4.',
        add: { duration: 1 }, max: { duration: 4 } },
      { id: 'base_co_b', name: 'HEAVY RETURN', text: '+0.4 counter damage.',
        add: { counterPower: 0.4 } }
    ],
    laststand: [
      { id: 'base_ls_a', name: 'BLOOD DEBT',  text: '+0.1 damage per RESOLVE spent.',
        add: { perResolvePower: 0.1 } },
      { id: 'base_ls_b', name: 'SECOND WIND', text: 'cooldown −1 turn, to a minimum of 3.',
        add: { cdTurns: -1 }, min: { cdTurns: 3 } }
    ]
  }
};

function modWaves() {
  const out = [];
  for (let w = 5; w < BALANCE.finalWave; w += 5) out.push(w);
  return out;
}
function modDueAfter(wave) { return modWaves().indexOf(wave) >= 0; }

const MODS_OFFERED = 3;

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

function applyMod(p, mod) {
  if (!p || !mod) return;
  const sk = p.skills.find(s => s.id === mod.skill);
  if (!sk) return;
  const clamp = (key, v) => {
    if (mod.min && mod.min[key] != null) v = Math.max(mod.min[key], v);
    if (mod.max && mod.max[key] != null) v = Math.min(mod.max[key], v);

    return +v.toFixed(4);
  };
  for (const k of Object.keys(mod.add || {}))
    sk[k] = clamp(k, (Number(sk[k]) || 0) + mod.add[k]);
  for (const k of Object.keys(mod.mul || {}))
    sk[k] = clamp(k, (Number(sk[k]) || 0) * mod.mul[k]);
  if (mod.player) Object.assign(p, mod.player);
}

function applyTakenMods(p) {
  if (!p || !Array.isArray(p.mods)) return;
  for (const id of p.mods) applyMod(p, modById(p.class, id));
}

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

function queueMods(offer) {
  (state.modQueue = state.modQueue || []).push(offer);
  logEvent('SALVAGE', null, 'offering ' + offer.length + ' modifications',
           offer.map(m => m.name));
  if (HEADLESS.on) return;
  floatText(state.player, 'SALVAGE', 'tally');
  notifyTab('mods');
  updateHud();
}
function nextModOffer() { return (state.modQueue && state.modQueue[0]) || null; }

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
  el.innerHTML = '<div class="pending-head">SALVAGE'
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
