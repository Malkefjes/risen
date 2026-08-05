const MODIFICATIONS = {

  bio: {
    inject: [
      { id: 'bio_inject_vir',   name: 'VIRULENCE',   text: '+50% of what the rot is ticking for added to the blow.',
        add: { poisonScale: 0.50 } },
      { id: 'bio_inject_cat',   name: 'CATALYST',    text: 'each blow makes the rot on the target tick immediately.',
        add: { procTicks: 1 } },
      { id: 'bio_inject_leech', name: 'TRANSFUSION', text: 'heal 10% of the damage dealt.',
        add: { lifesteal: 0.10 } },
      { id: 'bio_inject_film',  name: 'MEMBRANE',    text: 'each blow leaves a film: −8% damage taken for 1 turn, to a maximum of 40%.',
        add: { guardFrac: 0.08 }, max: { guardFrac: 0.40 } },
      { id: 'bio_inject_spore', name: 'SPORE BURST', text: '15% of the damage splashes onto every other enemy, to a maximum of 75%.',
        add: { splash: 0.15 }, max: { splash: 0.75 } }
    ],
    distribute: [
      { id: 'bio_distribute_meta', name: 'METASTASIS', text: 'when a host dies, 50% of its rot jumps to a living one, up to all of it.',
        add: { carry: 0.50 }, max: { carry: 1.0 } },
      { id: 'bio_distribute_cont', name: 'CONTAGION',  text: '+2% damage per POISON on the target.',
        add: { perPoisonPower: 0.02 } },
      { id: 'bio_distribute_out',  name: 'OUTBREAK',   text: 'every kill hurries it: cooldown −2 turns.',
        add: { killCd: 2 } },
      { id: 'bio_distribute_tap',  name: 'TAPROOT',    text: 'heal 8% of the damage dealt.',
        add: { lifesteal: 0.08 } },
      { id: 'bio_distribute_wit',  name: 'WITHER',     text: 'every enemy struck is WEAK for +1 turn.',
        add: { weakOnHit: 1 } }
    ],
    biofilm: [
      { id: 'bio_biofilm_fever', name: 'FEVER',          text: 'while it holds, POISON ticks one extra time per turn.',
        add: { tickBonus: 1 } },
      { id: 'bio_biofilm_shell', name: 'INFECTED SHELL', text: 'while it holds, attackers take +4 POISON.',
        add: { touchPoison: 4 } },
      { id: 'bio_biofilm_cloud', name: 'SPORE CLOUD',    text: 'casting it seeds +3 POISON in every enemy.',
        add: { castPoison: 3 } },
      { id: 'bio_biofilm_abs',   name: 'ABSORPTION',     text: 'while it holds, every hit taken heals 5% of the frame, to a maximum of 15%.',
        add: { hitHealFrac: 0.05 }, max: { hitHealFrac: 0.15 } }
    ],
    regenerate: [
      { id: 'bio_regenerate_supp',   name: 'SUPPRESSION', text: 'on cast, every enemy is WEAK for +1 turn.',
        add: { weakTurns: 1 } },
      { id: 'bio_regenerate_triage', name: 'TRIAGE',      text: 'on cast, instantly heal 8%, to a maximum of 40%.',
        add: { burstHeal: 0.08 }, max: { burstHeal: 0.40 } },
      { id: 'bio_regenerate_sep',    name: 'SEPSIS',      text: 'the current enemy takes whatever you regenerate as damage.',
        add: { regenStrike: 1 } },
      { id: 'bio_regenerate_blood',  name: 'CULTURED BLOOD', text: 'regeneration grows +2% per POISON on the current enemy.',
        add: { regenPerPoison: 0.02 } }
    ]
  },

  psy: {
    hunt: [
      { id: 'psy_hunt_a', name: 'IMPRINT',      text: '+1 DREAD.',
        add: { dread: 1 } },
      { id: 'psy_hunt_b', name: 'CLEAN STRIKE', text: '+20% damage.',
        mul: { power: 1.20 } }
    ],
    terrify: [
      { id: 'psy_terrify_a', name: 'PANIC',        text: '+2 DREAD.',
        add: { dread: 2 } },
      { id: 'psy_terrify_b', name: 'SUSTAINED',    text: 'cooldown −1 turn, to a minimum of 2.',
        add: { cdTurns: -1 }, min: { cdTurns: 2 } }
    ],
    traumatize: [
      { id: 'psy_traumatize_a', name: 'DEEP TRAUMA',  text: '+1 turn of stun, to a maximum of 3.',
        add: { stun: 1 }, max: { stun: 3 } },
      { id: 'psy_traumatize_b', name: 'LOW THRESHOLD', text: '−1 DREAD required, to a minimum of 1.',
        add: { dreadNeed: -1 }, min: { dreadNeed: 1 } }
    ],
    kill: [
      { id: 'psy_kill_a', name: 'APPETITE',     text: '+0.15 damage per DREAD consumed.',
        add: { perDreadPower: 0.15 } },
      { id: 'psy_kill_b', name: 'QUICK FEED',   text: 'cooldown −1 turn, to a minimum of 3.',
        add: { cdTurns: -1 }, min: { cdTurns: 3 } }
    ]
  },

  hyd: {
    piston: [
      { id: 'hyd_piston_a', name: 'BORE',        text: '+25% damage.',
        mul: { power: 1.25 } },
      { id: 'hyd_piston_b', name: 'TWIN STROKE', text: '+1 PRESSURE per hit.',
        add: { pressure: 1 } }
    ],
    surge: [
      { id: 'hyd_surge_a', name: 'PRECHARGE',   text: '+3 PRESSURE.',
        add: { pressure: 3 } },
      { id: 'hyd_surge_b', name: 'WIDE BORE',   text: '+30% damage.',
        mul: { power: 1.30 } }
    ],
    dampen: [
      { id: 'hyd_dampen_a', name: 'HEAVY GAUGE', text: '+8% reduction, to a maximum of 75%.',
        add: { power: 0.08 }, max: { power: 0.75 } },
      { id: 'hyd_dampen_b', name: 'LONG SEAL',   text: '+1 turn.',
        add: { duration: 1 } }
    ],
    rupture: [
      { id: 'hyd_rupture_a', name: 'FULL VENT',   text: '+0.04 damage per PRESSURE spent.',
        add: { perPressurePower: 0.04 } },
      { id: 'hyd_rupture_b', name: 'BLOWOUT',     text: '+40% base damage.',
        mul: { power: 1.40 } }
    ]
  },

  sym: {
    latch: [
      { id: 'sym_latch_a', name: 'DEEP DRAW',    text: '+10% of your THORNS added to the blow.',
        add: { thornsScale: 0.10 } },
      { id: 'sym_latch_b', name: 'HARD LATCH',   text: '+20% damage.',
        mul: { power: 1.20 } }
    ],
    raisespines: [
      { id: 'sym_raisespines_a', name: 'IRON SPINES',  text: '+0.5 to the THORNS multiplier.',
        add: { power: 0.5 } },
      { id: 'sym_raisespines_b', name: 'REACTIVE BARBS', text: '+2 THORNS per hit taken while up.',
        add: { growBonus: 2 } }
    ],
    shed: [
      { id: 'sym_shed_a', name: 'CLEAN TEAR',   text: '+4% base heal, to a maximum of 30%.',
        add: { healFrac: 0.04 }, max: { healFrac: 0.30 } },
      { id: 'sym_shed_b', name: 'DEEP HARVEST', text: '+8% of grown THORNS spendable, to a maximum of 75%.',
        add: { capFrac: 0.08 }, max: { capFrac: 0.75 } }
    ],
    provoke: [
      { id: 'sym_provoke_a', name: 'BARBED HOST',  text: '+0.4 to the lash multiplier.',
        add: { lashMult: 0.4 } },
      { id: 'sym_provoke_b', name: 'OPEN GUARD',   text: '+2 THORNS growth.',
        add: { growBonus: 2 } }
    ]
  },

  base: {
    strike: [
      { id: 'base_strike_a', name: 'BRACED FORM', text: '+1 RESOLVE.',
        add: { buildsResolve: 1 } },
      { id: 'base_strike_b', name: 'CLEAN FORM',  text: '+20% damage.',
        mul: { power: 1.20 } }
    ],
    bandage: [
      { id: 'base_bandage_a', name: 'FIELD SUTURE', text: '+4% base heal, to a maximum of 35%.',
        add: { healFrac: 0.04 }, max: { healFrac: 0.35 } },
      { id: 'base_bandage_b', name: 'PRESSURE',     text: '+1% heal per held RESOLVE, to a maximum of 8%.',
        add: { resolveHealBonus: 0.01 }, max: { resolveHealBonus: 0.08 } }
    ],
    counterpunch: [
      { id: 'base_counterpunch_a', name: 'IRON GUARD',  text: '+1 turn of brace, to a maximum of 4.',
        add: { duration: 1 }, max: { duration: 4 } },
      { id: 'base_counterpunch_b', name: 'HEAVY RETURN', text: '+0.4 counter damage.',
        add: { counterPower: 0.4 } }
    ],
    laststand: [
      { id: 'base_laststand_a', name: 'BLOOD DEBT',  text: '+0.1 damage per RESOLVE spent.',
        add: { perResolvePower: 0.1 } },
      { id: 'base_laststand_b', name: 'SECOND WIND', text: 'cooldown −1 turn, to a minimum of 3.',
        add: { cdTurns: -1 }, min: { cdTurns: 3 } }
    ]
  }
};


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
  const focus = state.focusSkill;
  if (focus && bySkill[focus]) {
    const bag = bySkill[focus];
    picked.push(bag[Math.floor(Math.random() * bag.length)]);
    skills.splice(skills.indexOf(focus), 1);
  }
  while (picked.length < MODS_OFFERED && skills.length) {
    const sid = skills.splice(Math.floor(Math.random() * skills.length), 1)[0];
    const bag = bySkill[sid];
    picked.push(bag[Math.floor(Math.random() * bag.length)]);
  }
  return picked;
}

function setFocus(sid) {
  state.focusSkill = state.focusSkill === sid ? null : sid;
  saveRun();
  renderModList();
}

function requisitionHtml() {
  const p = state.player;
  if (!p) return '';
  const focused = p.skills.find(s => s.id === state.focusSkill);
  return '<div class="derived-subhead">REQUISITION</div>'
    + '<div class="req-row">'
    + p.skills.map(s => '<button class="req-btn' + (state.focusSkill === s.id ? ' on' : '')
        + '" type="button" onclick="setFocus(\'' + s.id + '\')">' + s.name.toUpperCase() + '</button>').join('')
    + '</div>'
    + '<div class="req-note">' + (focused
        ? 'salvage always offers one ' + focused.name + ' modification'
        : 'mark a button and salvage always offers one modification for it') + '</div>';
}

function queueMods(offer) {
  (state.modQueue = state.modQueue || []).push(offer);
  logEvent('SALVAGE', null, 'offering ' + offer.length + ' modifications',
           offer.map(m => m.name));
}
function nextModOffer() { return (state.modQueue && state.modQueue[0]) || null; }

function takeMod(id) {
  const q = state.modQueue || [];
  const offer = q.shift();
  if (!offer) return;
  if (id && !offer.some(m => m.id === id)) { q.unshift(offer); return; }
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
  if (!HEADLESS.on) { renderCampPanel(); updateHud(); }
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

function modOfferHtml() {
  const offer = nextModOffer();
  if (!offer) return '';
  const p = state.player;
  const cls = p ? p.class : '';
  return '<div class="camp-panel-head">SALVAGE · ONE MODIFICATION</div>'
    + '<div class="mod-offer-row">'
    + offer.map(m => {
        const held = modCount(p, m.id);
        return '<button class="mod-card strain-' + cls + '" type="button" onclick="takeMod(\'' + m.id + '\')">'
          + '<div class="mod-head">'
          + '<span class="mod-name">' + m.name + (held ? ' <i class="mod-held">×' + held + '</i>' : '') + '</span>'
          + '<span class="mod-on">' + modSkillName(cls, m.skill) + '</span></div>'
          + '<div class="mod-text">' + highlightKeywords(m.text) + '</div></button>';
      }).join('')
    + '</div>'
    + '<button class="ui-btn is-quiet mod-skip" type="button" onclick="takeMod(null)">DECLINE</button>';
}

function renderModPanel() {
  if (HEADLESS.on) return;
  renderModList();
}

function renderModList() {
  if (HEADLESS.on) return;
  const el = document.getElementById('mod-list');
  if (!el) return;
  const p = state.player;
  const taken = (p && p.mods) || [];
  if (!taken.length) {
    el.innerHTML = requisitionHtml()
      + '<div class="derived-subhead">INSTALLED</div>'
      + '<div class="suit-slot empty"><div class="suit-slot-body">'
      + '<div class="suit-slot-name">NOTHING INSTALLED</div></div></div>';
    return;
  }

  const seen = [];
  taken.forEach(id => { if (seen.indexOf(id) < 0) seen.push(id); });
  el.innerHTML = requisitionHtml()
    + '<div class="derived-subhead">INSTALLED</div>'
    + seen.map(id => {
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
