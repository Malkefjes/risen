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
      { id: 'bio_sl_1', name: 'WEEPING EDGE',
        text: 'Slash plants 3 POISON instead of 1 — but the blade barely cuts.',
        skills: { slash: { poison: 3, power: 0.15 } } },
      { id: 'bio_sl_2', name: 'CLEAN STEEL',
        text: 'Slash hits for half again as much, and plants nothing at all.',
        skills: { slash: { power: 1.5, poison: 0 } } },
      { id: 'bio_sl_3', name: 'FEEDING WOUND',
        text: 'Slash drinks a quarter of what it deals — a weaker cut that keeps you standing.',
        skills: { slash: { lifesteal: 0.25, power: 0.7 } } }
    ],
    infest: [
      { id: 'bio_in_1', name: 'NECROSIS',
        text: 'Infest comes every 2 turns instead of 3, and stops doing damage of its own.',
        skills: { infest: { cdTurns: 2, power: 0.1 } } },
      { id: 'bio_in_2', name: 'BLOOM',
        text: 'Infest plants 8 POISON instead of 4, but comes only every 5 turns.',
        skills: { infest: { poison: 8, cdTurns: 5 } } },
      { id: 'bio_in_3', name: 'SEPSIS',
        text: 'Infest leaves the host WEAK for 3 turns, and its own blow becomes a formality.',
        skills: { infest: { power: 0.1, applies: [{ id: 'weak', power: 0.30, duration: 3 }] } } }
    ],
    chitin: [
      { id: 'bio_ch_1', name: 'THIN CARAPACE',
        text: 'Chitin lasts 5 turns instead of 3, but blunts only 15% instead of 40%.',
        skills: { chitin: { duration: 5, power: 0.15 } } },
      { id: 'bio_ch_2', name: 'DEEP SHELL',
        text: 'Chitin blunts 70% instead of 40% — for a single turn.',
        skills: { chitin: { duration: 1, power: 0.70 } } },
      { id: 'bio_ch_3', name: 'PURGING SHELL',
        text: 'Chitin scrubs 3 POISON off you as it hardens, and holds only 2 turns.',
        skills: { chitin: { duration: 2, cleanse: 3 } } }
    ],
    miasma: [
      { id: 'bio_mi_1', name: 'CONCENTRATE',
        text: 'Miasma mends twice as hard over 3 turns rather than 5.',
        skills: { miasma: { duration: 3, power: 0.40 } } },
      { id: 'bio_mi_2', name: 'VIRULENT CULTURE',
        text: 'The rot carries to the next host in FULL instead of half — but Miasma stops scrubbing it off you.',
        player: { modCarryFrac: 1.0 },
        skills: { miasma: { tickCleanse: 0 } } },
      { id: 'bio_mi_3', name: 'CHOKING FOG',
        text: 'Miasma comes every 3 turns and leaves them WEAK far longer — it barely mends you now.',
        skills: { miasma: { cdTurns: 3, power: 0.06, duration: 3,
                            applies: [{ id: 'weak', power: 0.25, duration: 6 }] } } }
    ]
  },

  // ---- PSYCHOLOGICAL ------------------------------------------------------
  psy: {
    hunt: [
      { id: 'psy_hu_1', name: 'CREEPING DREAD',
        text: 'Hunt plants 2 DREAD instead of 1, and strikes at half strength.',
        skills: { hunt: { dread: 2, power: 0.5 } } },
      { id: 'psy_hu_2', name: 'SILENT APPROACH',
        text: 'Hunt hits for 60% more, and leaves no fear behind it.',
        skills: { hunt: { power: 1.6, dread: 0 } } },
      { id: 'psy_hu_3', name: 'PARASITIC HUNT',
        text: 'Hunt drinks a fifth of what it deals, at a weaker blow.',
        skills: { hunt: { lifesteal: 0.20, power: 0.6 } } }
    ],
    terrify: [
      { id: 'psy_te_1', name: 'PANIC',
        text: 'Terrify plants 8 DREAD instead of 4, but comes only every 5 turns.',
        skills: { terrify: { dread: 8, cdTurns: 5 } } },
      { id: 'psy_te_2', name: 'STEADY WHISPER',
        text: 'Terrify comes every 2 turns, and plants 2 fear rather than 4.',
        skills: { terrify: { cdTurns: 2, dread: 2 } } },
      { id: 'psy_te_3', name: 'EXPOSED NERVE',
        text: 'Terrify leaves them VULNERABLE for 4 turns; its own blow becomes a formality.',
        skills: { terrify: { power: 0.1, applies: [{ id: 'vulnerable', power: 0.35, duration: 4 }] } } }
    ],
    traumatize: [
      { id: 'psy_tr_1', name: 'SHATTERED MIND',
        text: 'Traumatize breaks a mind for 2 turns instead of 1, but needs 5 DREAD rather than 3.',
        skills: { traumatize: { stun: 2, dreadNeed: 5 } } },
      { id: 'psy_tr_2', name: 'HAIRLINE CRACK',
        text: 'Traumatize breaks a mind at a single DREAD — and hits for far less.',
        skills: { traumatize: { dreadNeed: 1, power: 0.4 } } },
      { id: 'psy_tr_3', name: 'BLUNT TRAUMA',
        text: 'Traumatize becomes a heavy blow and breaks nothing at all.',
        skills: { traumatize: { power: 1.9, stun: 0 } } }
    ],
    kill: [
      { id: 'psy_ki_1', name: 'TOTAL CONSUMPTION',
        text: 'Kill tears away ALL the fear instead of half — the enemy gets its whole tempo back with it.',
        skills: { kill: { consumeFrac: 1.0, cdTurns: 4 } } },
      { id: 'psy_ki_2', name: 'PATIENT APPETITE',
        text: 'Kill takes a quarter of the pile every 3 turns, and pays less for each.',
        skills: { kill: { consumeFrac: 0.25, perDreadPower: 0.35, cdTurns: 3 } } },
      { id: 'psy_ki_3', name: 'GORGE',
        text: 'Kill pays double for every stack it eats, but its own blow is a quarter of what it was, and it comes every 6 turns.',
        skills: { kill: { perDreadPower: 1.2, power: 0.5, cdTurns: 6 } } }
    ]
  },

  // ---- SYMBIOTIC ----------------------------------------------------------
  sym: {
    latch: [
      { id: 'sym_la_1', name: 'PARASITIC LATCH',
        text: 'Latch reads your WHOLE wall back instead of half, but its own blow is halved.',
        skills: { latch: { thornsScale: 1.0, power: 0.5 } } },
      { id: 'sym_la_2', name: 'BARE HANDS',
        text: 'Latch hits half again as hard, and stops reading THORNS entirely.',
        skills: { latch: { power: 1.5, thornsScale: 0 } } },
      { id: 'sym_la_3', name: 'ROOTED',
        text: 'Latch drinks a share of what it deals, at a weaker blow.',
        skills: { latch: { lifesteal: 0.15, power: 0.7 } } }
    ],
    spines: [
      { id: 'sym_sp_1', name: 'IRON SPINES',
        text: 'Raise Spines multiplies THORNS ×3 — for two turns instead of three.',
        skills: { spines: { duration: 2, power: 3 } } },
      { id: 'sym_sp_2', name: 'FEEDING SPINES',
        text: 'Every hit taken under Spines grows +5 THORNS rather than +2, and the wall only ×1.5.',
        skills: { spines: { power: 1.5, growBonus: 5 } } },
      { id: 'sym_sp_3', name: 'QUICK GROWTH',
        text: 'Raise Spines comes every 3 turns, holds 2, and multiplies only ×1.5.',
        skills: { spines: { cdTurns: 3, duration: 2, power: 1.5 } } }
    ],
    shed: [
      { id: 'sym_sh_1', name: 'SCAR TISSUE',
        text: 'Shed heals twice as much on its own, but tears no spines to do it.',
        skills: { shed: { healFrac: 0.16, shedFuel: false } } },
      { id: 'sym_sh_2', name: 'DEEP HARVEST',
        text: 'Shed tears far more of the wall at once, and its own mend all but disappears.',
        skills: { shed: { healFrac: 0.01, capFrac: 0.60 } } },
      { id: 'sym_sh_3', name: 'CLOSED WOUND',
        text: 'Shed comes every 3 turns and scrubs nothing off you.',
        skills: { shed: { cdTurns: 3, cleanse: 0, healFrac: 0.06 } } }
    ],
    provoke: [
      { id: 'sym_pr_1', name: 'BARBED HOST',
        text: 'Provoke lashes for ×2.5 THORNS instead of ×1.5, and no longer grows any.',
        skills: { provoke: { lashMult: 2.5, growBonus: 0 } } },
      { id: 'sym_pr_2', name: 'OPEN INVITATION',
        text: 'Provoke grows +8 THORNS rather than +3, and the spines no longer lash back.',
        skills: { provoke: { growBonus: 8, lashMult: 0 } } },
      { id: 'sym_pr_3', name: 'STANDING TARGET',
        text: 'Provoke comes every 2 turns, grows nothing, and lashes for half.',
        skills: { provoke: { cdTurns: 2, growBonus: 0, lashMult: 0.75 } } }
    ]
  },

  // ---- UNAUGMENTED --------------------------------------------------------
  base: {
    jab: [
      { id: 'base_ja_1', name: 'STEADY HANDS',
        text: 'Strike steadies you twice as hard, and opens no wound at all.',
        skills: { jab: { buildsResolve: 2, bleed: 0 } } },
      { id: 'base_ja_2', name: 'CLEAN FORM',
        text: 'Strike hits 40% harder and steadies you not at all.',
        skills: { jab: { power: 1.4, buildsResolve: 0 } } },
      { id: 'base_ja_3', name: 'DUG IN',
        text: 'Strike steadies you three times over — and lands like a tap.',
        skills: { jab: { buildsResolve: 3, power: 0.5 } } }
    ],
    bandage: [
      { id: 'base_ba_1', name: 'FIELD SUTURE',
        text: 'Bandage patches far better per held RESOLVE, and almost nothing without it.',
        skills: { bandage: { healFrac: 0.04, resolveHealBonus: 0.05 } } },
      { id: 'base_ba_2', name: 'TOURNIQUET',
        text: 'Bandage closes a third of you at once, but comes only every 6 turns.',
        skills: { bandage: { healFrac: 0.22, cdTurns: 6 } } },
      { id: 'base_ba_3', name: 'QUICK PATCH',
        text: 'Bandage comes every 3 turns, mends less, and scrubs no rot.',
        skills: { bandage: { cdTurns: 3, healFrac: 0.09, cleanse: 0 } } }
    ],
    counter: [
      { id: 'base_co_1', name: 'IRON GUARD',
        text: 'Counterpunch braces for 3 turns instead of 2, but comes every 5.',
        skills: { counter: { duration: 3, cdTurns: 5 } } },
      { id: 'base_co_2', name: 'OPEN GUARD',
        text: 'The counter hits for double — the brace behind it barely blunts anything.',
        skills: { counter: { power: 0.25, counterPower: 2.5 } } },
      { id: 'base_co_3', name: 'SHORT BRACE',
        text: 'Counterpunch blunts 85% for a single turn, every 3 turns.',
        skills: { counter: { duration: 1, power: 0.85, cdTurns: 3 } } }
    ],
    laststand: [
      { id: 'base_ls_1', name: 'BLOOD DEBT',
        text: 'Last Stand spends ALL your RESOLVE and pays far more for each — you keep none of the guard it was buying.',
        skills: { laststand: { consumeFrac: 1.0, perResolvePower: 0.70 } } },
      { id: 'base_ls_2', name: 'MEASURED',
        text: 'Last Stand spends only a third of the pile, every 3 turns.',
        skills: { laststand: { consumeFrac: 0.35, cdTurns: 3 } } },
      { id: 'base_ls_3', name: 'HAYMAKER',
        text: 'Last Stand opens with twice the blow and cares far less what you endured.',
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
    logEvent('MODIFICATION', null, mod.name, [mod.text]);
    floatText(p, mod.name, 'tally');
    // forceRebuild: a patched card can change its own text AND the row can
    // change shape, so the skill bar is rebuilt rather than refreshed.
    updateHud(); renderSkills(true);
  } else {
    logEvent('MODIFICATION', null, 'declined', ['the suit goes back as it was']);
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
    + 'DECLINE — LEAVE THE SUIT AS IT IS</button>';
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
