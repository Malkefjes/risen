// MODIFICATIONS — what the Laboratory does to the suit between fights
// ============================================================
// A MODIFICATION IS A PATCH, NOT A NUMBER. Every entry rewrites what a BUTTON
// does; none of them add stats. That line is the whole system: levels and gear
// already feed the stat sheet, and a third source of "+15% damage" would be a
// third helping of the same meal. A Modification has to be describable as a
// sentence about a PRESS.
//
// AND EVERY ONE HAS A COST. A pick that is strictly better is not a decision,
// it is a delay before a decision. Assembled, broken-feeling combos are where
// the fun lives — but they should be assembled by the player out of visible
// trades, never handed over.
//
// SHAPE. A mod names the fields it overwrites on the run's skill copies (which
// are per-run already — see freshPlayer), plus optional player-level overrides:
//
//   { id, name, text,
//     skills: { <skillId>: { field: value, ... }, ... },
//     player: { field: value, ... } }
//
// Declarative on purpose: a patch serializes as its id, re-applies cleanly onto
// fresh skill copies on load, and the skill CARDS re-read the patched fields
// through fmtDesc, so a modified button describes itself with no extra work.
//
// PER STRAIN, NEVER SHARED. A pool bio and base both draw from is a pool that
// makes them the same class.
//
// FILED UNDER THE BUTTON THEY REWRITE, three each, so "every ability has three"
// is a fact about the shape of this table rather than something to go and
// count. A mod may still touch a second skill (the COST often lives on one) —
// the key it sits under is the button it is ABOUT. The offer takes one from
// each of three different abilities, so a choice is never three flavours of the
// same press.
const MODIFICATIONS = {
  // ---- BIOLOGICAL ---------------------------------------------------------
  bio: {
    slash: [
      { id: 'bio_sl_1', name: 'DOSAGE',
        text: 'POISON 3, damage \u00d70.15.',
        skills: { slash: { poison: 3, power: 0.15 } } },
      { id: 'bio_sl_2', name: 'STERILE EDGE',
        text: 'Damage \u00d71.50, no POISON.',
        skills: { slash: { power: 1.5, poison: 0 } } },
      { id: 'bio_sl_3', name: 'ABSORPTION',
        text: 'Damage \u00d70.70, recovers 25% of damage dealt.',
        skills: { slash: { lifesteal: 0.25, power: 0.7 } } }
    ],
    infest: [
      { id: 'bio_in_1', name: 'NECROSIS',
        text: 'Cooldown 2t, damage \u00d70.10.',
        skills: { infest: { cdTurns: 2, power: 0.1 } } },
      { id: 'bio_in_2', name: 'SATURATION',
        text: 'POISON 8, cooldown 5t.',
        skills: { infest: { poison: 8, cdTurns: 5 } } },
      { id: 'bio_in_3', name: 'SEPSIS',
        text: 'Applies WEAK 30% for 3t, damage \u00d70.10.',
        skills: { infest: { power: 0.1, applies: [{ id: 'weak', power: 0.30, duration: 3 }] } } }
    ],
    chitin: [
      { id: 'bio_ch_1', name: 'THIN PLATING',
        text: 'Duration 5t, damage taken \u221215%.',
        skills: { chitin: { duration: 5, power: 0.15 } } },
      { id: 'bio_ch_2', name: 'DENSE PLATING',
        text: 'Duration 1t, damage taken \u221270%.',
        skills: { chitin: { duration: 1, power: 0.70 } } },
      { id: 'bio_ch_3', name: 'PURGE CYCLE',
        text: 'Duration 2t, removes 3 POISON on cast.',
        skills: { chitin: { duration: 2, cleanse: 3 } } }
    ],
    miasma: [
      { id: 'bio_mi_1', name: 'CONCENTRATE',
        text: 'Duration 3t, regenerates 40% per turn.',
        skills: { miasma: { duration: 3, power: 0.40 } } },
      { id: 'bio_mi_2', name: 'VIRULENCE',
        text: 'POISON carried to the next enemy 100%. No POISON cleanse.',
        player: { modCarryFrac: 1.0 },
        skills: { miasma: { tickCleanse: 0 } } },
      { id: 'bio_mi_3', name: 'AEROSOL',
        text: 'Cooldown 3t, duration 3t, regenerates 6% per turn, WEAK 25% for 6t.',
        skills: { miasma: { cdTurns: 3, power: 0.06, duration: 3,
                            applies: [{ id: 'weak', power: 0.25, duration: 6 }] } } }
    ]
  },

  // ---- PSYCHOLOGICAL ------------------------------------------------------
  psy: {
    hunt: [
      { id: 'psy_hu_1', name: 'IMPRINT',
        text: 'DREAD 2, damage \u00d70.50.',
        skills: { hunt: { dread: 2, power: 0.5 } } },
      { id: 'psy_hu_2', name: 'SUPPRESSED',
        text: 'Damage \u00d71.60, no DREAD.',
        skills: { hunt: { power: 1.6, dread: 0 } } },
      { id: 'psy_hu_3', name: 'FEEDBACK',
        text: 'Damage \u00d70.60, recovers 20% of damage dealt.',
        skills: { hunt: { lifesteal: 0.20, power: 0.6 } } }
    ],
    terrify: [
      { id: 'psy_te_1', name: 'PANIC',
        text: 'DREAD 8, cooldown 5t.',
        skills: { terrify: { dread: 8, cdTurns: 5 } } },
      { id: 'psy_te_2', name: 'SUSTAINED',
        text: 'Cooldown 2t, DREAD 2.',
        skills: { terrify: { cdTurns: 2, dread: 2 } } },
      { id: 'psy_te_3', name: 'EXPOSURE',
        text: 'Applies VULNERABLE 35% for 4t, damage \u00d70.10.',
        skills: { terrify: { power: 0.1, applies: [{ id: 'vulnerable', power: 0.35, duration: 4 }] } } }
    ],
    traumatize: [
      { id: 'psy_tr_1', name: 'DEEP TRAUMA',
        text: 'Stun 2t, requires 5 DREAD.',
        skills: { traumatize: { stun: 2, dreadNeed: 5 } } },
      { id: 'psy_tr_2', name: 'LOW THRESHOLD',
        text: 'Requires 1 DREAD, damage \u00d70.40.',
        skills: { traumatize: { dreadNeed: 1, power: 0.4 } } },
      { id: 'psy_tr_3', name: 'CONCUSSION',
        text: 'Damage \u00d71.90, no stun.',
        skills: { traumatize: { power: 1.9, stun: 0 } } }
    ],
    kill: [
      { id: 'psy_ki_1', name: 'FULL CONSUMPTION',
        text: 'Consumes 100% of DREAD, cooldown 4t.',
        skills: { kill: { consumeFrac: 1.0, cdTurns: 4 } } },
      { id: 'psy_ki_2', name: 'PARTIAL INTAKE',
        text: 'Consumes 25% of DREAD, \u00d70.35 damage per DREAD, cooldown 3t.',
        skills: { kill: { consumeFrac: 0.25, perDreadPower: 0.35, cdTurns: 3 } } },
      { id: 'psy_ki_3', name: 'OVERFEED',
        text: '\u00d71.20 damage per DREAD, base damage \u00d70.50, cooldown 6t.',
        skills: { kill: { perDreadPower: 1.2, power: 0.5, cdTurns: 6 } } }
    ]
  },

  // ---- SYMBIOTIC ----------------------------------------------------------
  sym: {
    latch: [
      { id: 'sym_la_1', name: 'FULL DRAW',
        text: 'Adds 100% of THORNS, damage \u00d70.50.',
        skills: { latch: { thornsScale: 1.0, power: 0.5 } } },
      { id: 'sym_la_2', name: 'SEVERED',
        text: 'Damage \u00d71.50, adds no THORNS.',
        skills: { latch: { power: 1.5, thornsScale: 0 } } },
      { id: 'sym_la_3', name: 'UPTAKE',
        text: 'Damage \u00d70.70, recovers 15% of damage dealt.',
        skills: { latch: { lifesteal: 0.15, power: 0.7 } } }
    ],
    spines: [
      { id: 'sym_sp_1', name: 'DENSE GROWTH',
        text: 'THORNS \u00d73, duration 2t.',
        skills: { spines: { duration: 2, power: 3 } } },
      { id: 'sym_sp_2', name: 'REACTIVE GROWTH',
        text: 'THORNS \u00d71.5, +5 THORNS per hit taken.',
        skills: { spines: { power: 1.5, growBonus: 5 } } },
      { id: 'sym_sp_3', name: 'RAPID CYCLE',
        text: 'Cooldown 3t, duration 2t, THORNS \u00d71.5.',
        skills: { spines: { cdTurns: 3, duration: 2, power: 1.5 } } }
    ],
    shed: [
      { id: 'sym_sh_1', name: 'SEALED',
        text: 'Heals 16%, converts no THORNS.',
        skills: { shed: { healFrac: 0.16, shedFuel: false } } },
      { id: 'sym_sh_2', name: 'HARVEST',
        text: 'Heals 1%, spends up to 60% of grown THORNS.',
        skills: { shed: { healFrac: 0.01, capFrac: 0.60 } } },
      { id: 'sym_sh_3', name: 'RAPID SHED',
        text: 'Cooldown 3t, heals 6%, no POISON cleanse.',
        skills: { shed: { cdTurns: 3, cleanse: 0, healFrac: 0.06 } } }
    ],
    provoke: [
      { id: 'sym_pr_1', name: 'BARBED',
        text: 'Lash \u00d72.5 THORNS, +0 THORNS.',
        skills: { provoke: { lashMult: 2.5, growBonus: 0 } } },
      { id: 'sym_pr_2', name: 'BAIT',
        text: '+8 THORNS, no lash.',
        skills: { provoke: { growBonus: 8, lashMult: 0 } } },
      { id: 'sym_pr_3', name: 'REPEAT CYCLE',
        text: 'Cooldown 2t, lash \u00d70.75 THORNS, +0 THORNS.',
        skills: { provoke: { cdTurns: 2, growBonus: 0, lashMult: 0.75 } } }
    ]
  },

  // ---- UNAUGMENTED --------------------------------------------------------
  base: {
    jab: [
      { id: 'base_ja_1', name: 'BRACED FORM',
        text: '+2 RESOLVE, no BLEED.',
        skills: { jab: { buildsResolve: 2, bleed: 0 } } },
      { id: 'base_ja_2', name: 'COMMITTED',
        text: 'Damage \u00d71.40, no RESOLVE.',
        skills: { jab: { power: 1.4, buildsResolve: 0 } } },
      { id: 'base_ja_3', name: 'DEFENSIVE FORM',
        text: '+3 RESOLVE, damage \u00d70.50.',
        skills: { jab: { buildsResolve: 3, power: 0.5 } } }
    ],
    bandage: [
      { id: 'base_ba_1', name: 'SUTURE',
        text: 'Heals 4%, +5% per held RESOLVE.',
        skills: { bandage: { healFrac: 0.04, resolveHealBonus: 0.05 } } },
      { id: 'base_ba_2', name: 'TOURNIQUET',
        text: 'Heals 22%, cooldown 6t.',
        skills: { bandage: { healFrac: 0.22, cdTurns: 6 } } },
      { id: 'base_ba_3', name: 'FIELD DRESSING',
        text: 'Cooldown 3t, heals 9%, no POISON cleanse.',
        skills: { bandage: { cdTurns: 3, healFrac: 0.09, cleanse: 0 } } }
    ],
    counter: [
      { id: 'base_co_1', name: 'EXTENDED GUARD',
        text: 'Duration 3t, cooldown 5t.',
        skills: { counter: { duration: 3, cdTurns: 5 } } },
      { id: 'base_co_2', name: 'AGGRESSIVE GUARD',
        text: 'Damage taken \u221225%, counter \u00d72.50.',
        skills: { counter: { power: 0.25, counterPower: 2.5 } } },
      { id: 'base_co_3', name: 'HARD GUARD',
        text: 'Duration 1t, damage taken \u221285%, cooldown 3t.',
        skills: { counter: { duration: 1, power: 0.85, cdTurns: 3 } } }
    ],
    laststand: [
      { id: 'base_ls_1', name: 'FULL COMMIT',
        text: 'Spends 100% of RESOLVE, \u00d70.70 damage per RESOLVE.',
        skills: { laststand: { consumeFrac: 1.0, perResolvePower: 0.70 } } },
      { id: 'base_ls_2', name: 'MEASURED',
        text: 'Spends 35% of RESOLVE, cooldown 3t.',
        skills: { laststand: { consumeFrac: 0.35, cdTurns: 3 } } },
      { id: 'base_ls_3', name: 'FLAT STRIKE',
        text: 'Base damage \u00d72.50, \u00d70.15 damage per RESOLVE.',
        skills: { laststand: { power: 2.5, perResolvePower: 0.15 } } }
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

// Flat view of a strain's whole table, each entry stamped with the button it
// is filed under — every read below goes through this rather than knowing the
// table is two levels deep.
function modsFor(classId) {
  const bySkill = MODIFICATIONS[classId] || {};
  const out = [];
  for (const sid of Object.keys(bySkill))
    for (const m of bySkill[sid]) out.push(Object.assign({ skill: sid }, m));
  return out;
}
function modById(classId, id) { return modsFor(classId).find(m => m.id === id) || null; }
// The display name of the button a mod is about.
function modSkillName(classId, sid) {
  const sk = (CLASSES[classId] && CLASSES[classId].skills.find(s => s.id === sid)) || null;
  return sk ? sk.name : '';
}

// Applies one patch. Called on pick AND on load, always onto fresh skill copies.
function applyMod(p, mod) {
  if (!p || !mod) return;
  if (mod.skills) {
    for (const sid of Object.keys(mod.skills)) {
      const sk = p.skills.find(s => s.id === sid);
      if (sk) Object.assign(sk, mod.skills[sid]);
    }
  }
  if (mod.player) Object.assign(p, mod.player);
}

// Re-applies everything the run has taken, in the order it was taken — later
// picks overwrite earlier ones on the same field, which is the same result the
// live run produced.
function applyTakenMods(p) {
  if (!p || !Array.isArray(p.mods)) return;
  for (const id of p.mods) applyMod(p, modById(p.class, id));
}

// Three from what this strain has not taken, ONE PER BUTTON — a choice between
// three ways to change the same press is not really three choices. Rules RNG,
// because a run's offer is part of the run: headless draws the identical three.
function offerMods(p) {
  const taken = p.mods || [];
  const bySkill = {};
  for (const m of modsFor(p.class)) {
    if (taken.includes(m.id)) continue;
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

// id null (or unknown) is a DECLINE, and that is a real option: three picks
// that all cut against the build you are assembling is a worse offer than
// none, and being forced to take one of them would make the run worse for
// having reached the wave.
function takeMod(id) {
  const st = state.pendingMods;
  if (!st) return;
  const p = state.player;
  const mod = id ? modById(p.class, id) : null;
  state.pendingMods = null;
  if (!HEADLESS.on) {
    const m = document.getElementById('mod-modal');
    if (m) m.classList.remove('show');
  }
  if (mod) {
    p.mods = (p.mods || []).concat(mod.id);
    applyMod(p, mod);
    applyDerivedStats(p);
    logEvent('MODIFICATION', null, mod.name,
             [modSkillName(p.class, mod.skill), mod.text]);
    floatText(p, mod.name, 'tally');
    // forceRebuild: a patched card can change its own text AND the row can
    // change shape, so the skill bar is rebuilt rather than refreshed.
    updateHud(); renderSkills(true);
  } else {
    logEvent('MODIFICATION', null, 'declined');
  }
  saveRun();
  // resumeAfterKill, NOT proceedAfterKill: coming back through the entry point
  // would offer this wave a modification again, forever.
  resumeAfterKill(st.killedWave);
}

// The bot's hand: always the first offered. Deterministic on purpose — the
// OFFER is a rules draw, the choice must not be a second one, or a bot and a
// player would consume different amounts of the stream.
function botTakesMod(offer) { return offer[0] ? offer[0].id : null; }

function presentMods(offer, killedWave) {
  state.pendingMods = { offer, killedWave };
  logEvent('LABORATORY', null, 'offering ' + offer.length + ' modifications',
           offer.map(m => m.name));
  if (HEADLESS.on) return;
  renderModModal(offer);
  const m = document.getElementById('mod-modal');
  if (m) m.classList.add('show');
}

function abandonMods() {
  if (!state.pendingMods) return;
  state.pendingMods = null;
  if (!HEADLESS.on) {
    const m = document.getElementById('mod-modal');
    if (m) m.classList.remove('show');
  }
}

// ---- UI ---------------------------------------------------------
function renderModModal(offer) {
  const el = document.getElementById('mod-body');
  if (!el) return;
  const cls = state.player ? state.player.class : '';
  el.innerHTML = offer.map(m =>
    '<button class="mod-card strain-' + cls + '" type="button" onclick="takeMod(\'' + m.id + '\')">' +
      '<div class="mod-head">' +
        '<span class="mod-name">' + m.name + '</span>' +
        '<span class="mod-on">' + modSkillName(cls, m.skill) + '</span>' +
      '</div>' +
      '<div class="mod-text">' + highlightKeywords(m.text) + '</div>' +
    '</button>').join('')
    + '<button class="ui-btn is-quiet mod-skip" type="button" onclick="takeMod(null)">'
    + 'DECLINE</button>';
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
  el.innerHTML = taken.map(id => {
    const m = modById(p.class, id);
    if (!m) return '';
    return '<div class="mod-entry">'
      + '<div class="mod-head"><span class="mod-name">' + m.name + '</span>'
      + '<span class="mod-on">' + modSkillName(p.class, m.skill) + '</span></div>'
      + '<div class="mod-text">' + highlightKeywords(m.text) + '</div></div>';
  }).join('');
}
