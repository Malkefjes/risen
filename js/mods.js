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
// makes them the same class. Adding a mod is one entry here and nothing else.

const MODIFICATIONS = {
  bio: [
    { id: 'virulent', name: 'VIRULENT CULTURE',
      text: 'The rot carries in FULL to the next host instead of half — but Miasma no longer scrubs it off you.',
      player: { modCarryFrac: 1.0 },
      skills: { miasma: { tickCleanse: 0 } } },
    { id: 'necrosis', name: 'NECROSIS',
      text: 'Infest comes every 2 turns instead of 3. Slash plants nothing.',
      skills: { infest: { cdTurns: 2 }, slash: { poison: 0 } } },
    { id: 'carapace', name: 'THIN CARAPACE',
      text: 'Chitin lasts 5 turns instead of 3, but blunts only 15% instead of 40%.',
      skills: { chitin: { duration: 5, power: 0.15 } } }
  ],
  psy: [
    { id: 'consume', name: 'TOTAL CONSUMPTION',
      text: 'Kill tears away ALL the fear instead of half, and comes every 4 turns — the enemy gets its whole tempo back with it.',
      skills: { kill: { consumeFrac: 1.0, cdTurns: 4 } } },
    { id: 'creeping', name: 'CREEPING DREAD',
      text: 'Hunt plants 2 fear instead of 1. Terrify comes every 5 turns instead of 3.',
      skills: { hunt: { dread: 2 }, terrify: { cdTurns: 5 } } },
    { id: 'shatter', name: 'SHATTERED MIND',
      text: 'Traumatize breaks a mind for 2 turns instead of 1, but needs 5 fear rather than 3.',
      skills: { traumatize: { stun: 2, dreadNeed: 5 } } }
  ],
  sym: [
    { id: 'barbed', name: 'BARBED HOST',
      text: 'Provoke lashes for ×2.5 THORNS instead of ×1.5, and no longer grows any.',
      skills: { provoke: { lashMult: 2.5, growBonus: 0 } } },
    { id: 'parasite', name: 'PARASITIC LATCH',
      text: 'Latch reads your WHOLE wall back instead of half, but its own blow is halved.',
      skills: { latch: { thornsScale: 1.0, power: 0.5 } } },
    { id: 'scarred', name: 'SCAR TISSUE',
      text: 'Shed heals twice as much on its own, but tears no spines to do it.',
      skills: { shed: { healFrac: 0.16, shedFuel: false } } }
  ],
  base: [
    { id: 'blooddebt', name: 'BLOOD DEBT',
      text: 'Last Stand spends ALL your RESOLVE, and pays far more for each — you keep none of the guard it was buying.',
      skills: { laststand: { consumeFrac: 1.0, perResolvePower: 0.70 } } },
    { id: 'ironguard', name: 'IRON GUARD',
      text: 'Counterpunch braces for 3 turns instead of 2, but comes every 5 turns instead of 4.',
      skills: { counter: { duration: 3, cdTurns: 5 } } },
    { id: 'steady', name: 'STEADY HANDS',
      text: 'Strike steadies you twice as hard, and opens no wound at all.',
      skills: { jab: { buildsResolve: 2, bleed: 0 } } }
  ]
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

function modsFor(classId) { return MODIFICATIONS[classId] || []; }
function modById(classId, id) { return modsFor(classId).find(m => m.id === id) || null; }

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

// Three from what this strain has not taken. Rules RNG — a run's offer is part
// of the run, so headless draws the identical three.
function offerMods(p) {
  const pool = modsFor(p.class).filter(m => !(p.mods || []).includes(m.id));
  const picked = [];
  const bag = pool.slice();
  while (picked.length < MODS_OFFERED && bag.length)
    picked.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
  return picked;
}

function takeMod(id) {
  const st = state.pendingMods;
  if (!st) return;
  const p = state.player;
  const mod = modById(p.class, id);
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
    updateHud(); renderSkills(true);
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
      '<div class="mod-name">' + m.name + '</div>' +
      '<div class="mod-text">' + highlightKeywords(m.text) + '</div>' +
    '</button>').join('');
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
    return '<div class="mod-entry"><div class="mod-name">' + m.name + '</div>'
      + '<div class="mod-text">' + highlightKeywords(m.text) + '</div></div>';
  }).join('');
}
