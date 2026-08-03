// Rendering: arena, class mechanics, enemy intent, juice, combat log
// ---- Rendering ------------------------------------------------
function renderCombat(forceFull) {
  if (HEADLESS.on) return;
  const ps=document.getElementById('player-slot'), es=document.getElementById('enemy-slot');
  if(!ps||!es||!state.player) return;
  const pPanel=ps.querySelector('.fighter'), ePanel=es.querySelector('.fighter');
  if (forceFull || !pPanel) { ps.innerHTML=''; ps.appendChild(createFighterPanel(state.player)); }
  else updateUnitCard(state.player);
  if (!state.enemy) es.innerHTML='';
  else if (forceFull || !ePanel || ePanel.dataset.unitId !== state.enemy.id) {
    es.innerHTML=''; es.appendChild(createFighterPanel(state.enemy));
  } else updateUnitCard(state.enemy);
}

// ---- Class mechanics --------------------------------------------
// THERE ARE NO BANKS. Every strain runs on ONE UNCAPPED NUMBER, worn as a
// status badge under a health bar:
//
//   bio   POISON   on the enemy, uncapped, dies with it
//   psy   DREAD    on the enemy, uncapped count (the slow saturates, not the
//                  stack), dies with it
//   sym   THORNS   on the player, uncapped, the one ramp that is RUN-permanent
//   base  RESOLVE  on the player, uncapped, rebuilt every fight
//
// What went was the pipped wallet: a cap is a place where a mechanic stops being
// interesting, and pips cannot draw a number with no ceiling, so the UI was
// quietly the thing forcing the ceiling to exist. Nothing replaced bankAdjust —
// applyStatus clamps nothing, stacks correctly, logs at one choke point and
// repaints the badge.

// ---- Enemy intent (Slay-the-Spire style next-move telegraph) ----
// Pure prediction that MIRRORS enemyAct/enemySwing exactly, so the badge can
// never lie about what is coming. Add branches here when enemies gain moves
// beyond attacking (block, buff, debuff, multi-hit, ...).
function enemyIntent(e) {
  if (!e || e.isPlayer || e.hp <= 0 || e._defeated) return null;
  if (hasStatus(e, 'stun'))
    return { kind:'stunned', icon:'💫', label:'Stunned', tone:'stunned' };
  if (e.windup) { // already charged — the very next swing is the heavy hit
    // A SPOILED CHARGE MUST READ AS SPOILED. The badge is the only place the
    // player sees the number before it lands, so an answer that halved the
    // blow has to show up here or it looks like it did nothing (which is
    // exactly the complaint the spoil rule exists to answer).
    const spoiled = !!e.windupSpoiled;
    const mult = windupMultFor(e) * (spoiled ? (BALANCE.enemy.windupSpoilFrac || 1) : 1);
    return { kind:'heavy', icon:'💥', label: spoiled ? 'Spoiled' : 'Heavy',
             dmg: Math.max(1, Math.floor(e.damage * mult)), tone:'heavy' };
  }
  if (e.windupEvery > 0 && ((e.actionCount || 0) + 1) % e.windupEvery === 0)
    return { kind:'charge', icon:'⚡', label:'Winding up', tone:'charge' };
  const riders = [];
  if (e.elite && e.elite.poison) riders.push('☠');       // applies poison on hit
  if (e.elite && e.elite.lifesteal) riders.push('🩸');   // heals itself on hit
  return { kind:'attack', icon:'⚔', label:'Attack',
           dmg: Math.max(1, Math.floor(e.damage)), riders, tone:'attack' };
}
function intentBadge(e) {
  const it = enemyIntent(e);
  if (!it) return { cls:'intent-badge empty', html:'' };
  let inner = '<span class="intent-icon">' + it.icon + '</span>';
  inner += (it.dmg != null)
    ? '<span class="intent-num">' + formatNum(it.dmg) + '</span>'
    : '<span class="intent-txt">' + it.label + '</span>';
  if (it.riders && it.riders.length)
    inner += '<span class="intent-riders">' + it.riders.join('') + '</span>';
  return { cls: 'intent-badge tone-' + it.tone, html: inner };
}

// Badge text for one status. A definition can spell out its own label; anything
// that doesn't gets NAME ×stacks  Nt, which is enough for most of them — so a
// new status renders correctly the moment it exists.
function statusLabel(def, st, unit) {
  if (def.label) return def.label(st, unit);
  const d = Math.ceil(st.duration || 0);
  return def.name
    + ((st.stacks || 1) > 1 ? ' ×' + st.stacks : '')
    + (isFinite(d) ? '  ' + d + 't' : '');
}
function buildStatusesHtml(unit) {
  // Timed effects first, all of them off the registry, then the standing
  // readouts that aren't statuses at all: the windup telegraph and the
  // player's permanent thorns.
  let html = unit.statuses.map(st => {
    const def = STATUSES[st.type];
    if (!def) return '<span class="status">' + String(st.type).toUpperCase() + '</span>';
    return '<span class="status ' + (def.tone || def.kind || '') + '">' + statusLabel(def, st, unit) + '</span>';
  }).join('');
  // The windup deliberately does NOT appear here: the intent badge is the one
  // source of truth about the enemy's future — statuses are present state.
  if (unit.isPlayer && unit.thorns > 0) html += '<span class="status spines">THORNS ' + formatNum(getThornsDamage(unit)) + '</span>';
  return html;
}
// Cheap fingerprint of everything the badge row shows, so the row is only
// rebuilt when it would actually look different. Power is part of it: Spines
// amplifying from ×2.2 to ×3.3 changes the badge without changing its duration.
function buildStatusKey(u) {
  let k = (u.thorns>0?'T'+getThornsDamage(u):'');
  u.statuses.forEach(s => k += '|' + s.type + (isFinite(s.duration) ? Math.ceil(s.duration) : '*') + (s.stacks||'') + (s.power||''));
  return k;
}
function getFighterPanel(unit) {
  if (!unit) return null;
  return document.querySelector('.fighter[data-unit-id="' + unit.id + '"]');
}
function updateUnitCard(unit) {
  if (HEADLESS.on) return;
  if (!unit) return;
  const panel = getFighterPanel(unit); if (!panel) return;
  panel.classList.toggle('dead', unit.hp <= 0);
  const fig = panel.querySelector('.char-figure');
  if (fig) fig.classList.toggle('alive', unit.hp > 0);
  const pct = Math.max(0, Math.min(100, (unit.hp/Math.max(1,unit.maxHp))*100));
  const fill = panel.querySelector('.bar-fill.hp');
  const ghost = panel.querySelector('.bar-ghost');
  const text = panel.querySelector('.bar-text');
  if (fill) fill.style.width = pct + '%';
  if (ghost) {
    const cur = parseFloat(ghost.dataset.pct || '100');
    if (pct < cur) { ghost.dataset.pct = pct; setTimeout(()=>{ ghost.style.width = pct + '%'; }, 120); }
    else { ghost.dataset.pct = pct; ghost.style.width = pct + '%'; }
  }
  if (text) text.textContent = formatNum(Math.max(0,Math.floor(unit.hp))) + ' / ' + formatNum(Math.floor(unit.maxHp));
  const st = panel.querySelector('.status-effects');
  if (st) { const k = buildStatusKey(unit); if (k !== unit._statusKey) { unit._statusKey = k; st.innerHTML = buildStatusesHtml(unit); } }
  if (unit.isPlayer) {
    // The sidebar reads off the same sheet as this card, so it is refreshed
    // from the same hook rather than from each damage and healing site — the
    // two HP numbers on screen can then never disagree.
    refreshReadoutValues();
  }
  if (!unit.isPlayer) {
    const badge = panel.querySelector('.intent-badge');
    if (badge) { const ib = intentBadge(unit); if (badge.className !== ib.cls || badge.innerHTML !== ib.html) { badge.className = ib.cls; badge.innerHTML = ib.html; } }
  }
  const side = unit.isPlayer ? document.getElementById('player-side') : document.getElementById('enemy-side');
  if (side) side.classList.toggle('dead', unit.hp <= 0);
}

function createFighterPanel(unit) {
  const div = document.createElement('div');
  div.className = 'fighter unit' + (unit.hp<=0?' dead':'') + (unit.isBoss?' boss':'')
    + (!unit.isBoss && unit.elite ? ' elite' : '');
  div.dataset.unitId = unit.id;
  unit._statusKey = '';
  const colorClass = unit.isPlayer ? unit.class : 'enemy';
  const type = unit.isBoss ? 'boss' : (unit.isPlayer ? 'player' : 'enemy');
  const pct = Math.max(0, (unit.hp/Math.max(1,unit.maxHp))*100);
  const tags = unit.isPlayer ? [] : enemyTags(unit);
  const tagHtml = tags.map(t => '<span class="unit-tag ' + t.toLowerCase() + '">' + t + '</span>').join('');
  const foeSize = unit.isPlayer ? ' hero' : (unit.isBoss ? ' foe-boss' : (unit.elite ? ' foe-elite' : ' foe'));
  // The act's art scale rides on top of the size tier rather than replacing it,
  // so an elite Experiment is still visibly bigger than a plain one. Written
  // only when it isn't 1, so the common case leaves no style attribute behind.
  const artScale = foeArtScale(unit);
  const foeStyle = artScale !== 1 ? ' style="--foe-art:' + artScale + '"' : '';
  // Art drawn facing right has to be flipped to face the player — see the
  // `mirror` note in sprites.js.
  const foeFlip = artMirrored(unit) ? ' art-mirrored' : '';
  div.innerHTML =
    '<div class="fighter-info">' +
      (unit.isPlayer ? '' : (function(){ const ib = intentBadge(unit); return '<div class="' + ib.cls + '">' + ib.html + '</div>'; })()) +
      '<div class="unit-name">' + unit.name + '</div>' +
      (tagHtml ? '<div class="unit-tags">' + tagHtml + '</div>' : '') +
      '<div class="bars"><div class="bar-row"><div class="bar-track">' +
        '<div class="bar-ghost" data-pct="' + pct + '" style="width:' + pct + '%"></div>' +
        '<div class="bar-fill hp' + (unit.isPlayer?' player-hp':'') + '" style="width:' + pct + '%"></div>' +
        '<div class="bar-text">' + formatNum(Math.floor(unit.hp)) + ' / ' + formatNum(Math.floor(unit.maxHp)) + '</div>' +
      '</div></div></div>' +
      '<div class="status-effects">' + buildStatusesHtml(unit) + '</div>' +
    '</div>' +
    '<div class="char-figure ' + (unit.hp>0?'alive':'') + foeSize + foeFlip + '"' + foeStyle + '>' +
      makeCharSVG(type, colorClass, hasPoseSet(unit) ? 'ready' : 'idle', unit) +
      '<div class="ground-shadow"></div></div>';
  return div;
}

// ---- Juice ----------------------------------------------------
function killFlash(unit) {
  if (HEADLESS.on) return;
  const panel = getFighterPanel(unit);
  if (!panel) return;
  panel.classList.add('killed');
  // arena kill-burst flash removed
}
function getFigureForUnit(unit){ const p=getFighterPanel(unit); return p?p.querySelector('.char-figure'):null; }

// `skill` is optional; pass one (or its id) and the caster wears that skill's
// own art for the beat, falling back to the generic strike pose without it.
function playAttackAnim(caster, target, hit, skill) {
  if (HEADLESS.on) return;
  const fig = getFigureForUnit(caster); if (!fig) return;
  const isP = !!caster.isPlayer;
  const lunge = isP?'lunge-right':'lunge-left';
  fig.classList.remove('lunge-right','lunge-left','lunging');
  void fig.offsetWidth;
  fig.classList.add('lunging', lunge);
  if (hasPoseSet(caster)) setCharPose(caster, 'strike', skill);
  setTimeout(() => {
    fig.classList.remove('lunging', lunge);
    if (hasPoseSet(caster)) setCharPose(caster, 'ready');
  }, 260);
  if (hit && target) {
    setTimeout(()=>spawnImpact(caster), 80);
    setTimeout(()=>playRecoil(target), 95);
  }
}

// Heals and buffs have no lunge, but they can still have their own art. Only
// poses when the strain actually defines a sprite for the skill, so strains
// without per-skill art are completely unaffected.
function playCastAnim(unit, skill) {
  if (HEADLESS.on) return;
  triggerHeal(unit);
  if (!hasSkillArt(unit, skill)) return;
  setCharPose(unit, 'ready', skill);
  setTimeout(() => setCharPose(unit, 'ready'), 260);
}
function playRecoil(unit) {
  if (HEADLESS.on) return;
  const fig = getFigureForUnit(unit); if (!fig) return;
  const cls = unit.isPlayer?'recoil-left':'recoil-right';
  fig.classList.remove('recoil-left','recoil-right','recoiling');
  void fig.offsetWidth;
  fig.classList.add('recoiling', cls);
  setTimeout(()=>fig.classList.remove('recoiling',cls), 220);
}
function triggerHeal(unit) {
  if (HEADLESS.on) return;
  const fig = getFigureForUnit(unit); if (!fig) return;
  fig.style.filter='brightness(1.3)';
  setTimeout(()=>{ fig.style.filter=''; }, 170);
}
function spawnImpact(caster) {
  if (HEADLESS.on) return;
  const arena=document.getElementById('arena-card'); if(!arena) return;
  const color = caster.isPlayer
    ? (caster.class==='bio'?'#7dffa0':caster.class==='psy'?'#c084fc':caster.class==='sym'?'#fb923c':'#eaf2ff')
    : '#fb7185';
  const el=document.createElement('div');
  el.className='impact-mark';
  el.innerHTML='<svg viewBox="0 0 56 28" xmlns="http://www.w3.org/2000/svg">'
    +'<line x1="4" y1="14" x2="52" y2="14" stroke="'+color+'" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>'
    +'<line x1="12" y1="8" x2="44" y2="20" stroke="'+color+'" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>'
    +'<line x1="12" y1="20" x2="44" y2="8" stroke="'+color+'" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>'
    +'<circle cx="28" cy="14" r="5" fill="none" stroke="'+color+'" stroke-width="1.8" opacity="0.7"/></svg>';
  arena.appendChild(el);
  setTimeout(()=>el.remove(), 380);
}

// Cosmetic randomness draws from its OWN stream, never Math.random.
//
// Everything the RULES roll — evade, crit, block, elite selection — shares one
// sequence. A floater's horizontal jitter used to draw from that same
// sequence, which meant DRAWING A DAMAGE NUMBER SHIFTED THE NEXT CRIT ROLL.
// Invisible in normal play because nothing is seeded, but it made an on-screen
// run and a headless run of the same fight diverge for a purely visual reason,
// and it would quietly break any seeded replay or deterministic test later.
let _cosmeticSeed = 1;
function cosmeticRandom() {
  _cosmeticSeed = (_cosmeticSeed * 1664525 + 1013904223) >>> 0;
  return _cosmeticSeed / 4294967296;
}

let _floaters = 0;
function floatText(unit, value, type, isCrit) {
  if (HEADLESS.on) return;
  if (_floaters > 26) return;
  const card = getFighterPanel(unit); if (!card) return;
  const el = document.createElement('div');
  let cls = 'float-dmg ' + type + (isCrit?' crit':'');
  // Damage you DEAL reads white-hot; damage you TAKE stays red; green belongs
  // to healing alone. Dealt numbers briefly wore the strain color, but bio's
  // green damage read as healing at a glance — color means the EVENT, not you.
  if (type === 'damage' && unit && !unit.isPlayer) cls += ' dealt';
  el.className = cls;
  if (typeof value === 'string') el.textContent = value;
  else {
    const n = formatNum(value);
    const isXp = type === 'xp' || type === 'xp-bonus';
    el.textContent = (type==='heal'||isXp) ? '+'+n+(isXp?' XP':'') : '-'+n;
    // Crits read as class-colored number + a small yellow CRIT tag, not an outline.
    if (isCrit) {
      const tag = document.createElement('span');
      tag.className = 'crit-tag';
      tag.textContent = 'CRIT';
      el.appendChild(tag);
    }
  }
  el.style.left = (18 + cosmeticRandom()*46) + '%';
  // Stack concurrent floaters up the body so a number and its status label
  // (e.g. "-123" and "BLOCK") never overlap; sit them over the torso, not the feet.
  const active = card.querySelectorAll('.float-dmg').length;
  el.style.bottom = (98 + (active % 4) * 26) + 'px';
  card.appendChild(el);
  _floaters++;
  // Floored at 0 so the timers left over from a clearFloaters() cannot drive the
  // count negative and quietly raise the concurrency cap for the next run.
  setTimeout(()=>{ el.remove(); _floaters = Math.max(0, _floaters - 1); }, 1300);
}

// Floaters remove themselves on a 1.3s timer, so a run that ends or restarts
// mid-animation leaves numbers hanging over the arena as the next one fades in.
function clearFloaters() {
  document.querySelectorAll('.float-dmg').forEach(el => el.remove());
  _floaters = 0;
}

// ---- Combat log -----------------------------------------------
// The log is the fight's TRANSCRIPT, not its narration: it exists so a turn that
// has already scrolled past can be reconstructed exactly. THE LOG IS AN
// INSTRUMENT, NOT A PANEL — there is no on-screen log, and what these calls feed
// is the headless transcript that tools/autopsy.mjs parses and
// tools/transcript.mjs dumps. On screen this is a no-op.
//
// The rules, so a new line cannot invent its own dialect:
//
//  1. STRUCTURE. Two levels only — headers (wave, turn) and the events under
//     them. Every event goes through logEvent and comes out indented.
//  2. GRAMMAR. Every event line is <what> → <to whom> <amount> <qualifiers>, in
//     that order. The ACTOR is absent: the turn header already says who acted.
//  3. NUMBERS ARE THE ONES THE FIGHT USED — the exact integer applied to hp,
//     never recomputed for display, because a recomputed number can disagree.
//  4. QUALIFIERS EXPLAIN THE AMOUNT. CRIT ×2.0, BLOCK −50%, WEAK −25%. If a
//     qualifier did not move the number, it does not belong on the line.
//  5. NO PROSE. Flavour belongs on the skill cards, which have room for it.
function log(msg) {
  if (!HEADLESS.on) return;
  HEADLESS.log.push(msg);
  if (HEADLESS.log.length > HEADLESS.logCap) HEADLESS.log.shift();
}

// Units name themselves the same way everywhere in the transcript.
function logName(u) { return !u ? '—' : (u.isPlayer ? 'You' : u.name); }

// Amounts are integers, formatted the way every other number in the game is.
function logNum(n) { return formatNum(Math.max(0, Math.floor(n))); }

// The one event-line builder. `notes` is the qualifier list; anything falsy in
// it is dropped, so a caller can pass conditions inline without assembling the
// array first.
function logEvent(what, target, amount, notes) {
  const parts = [what];
  if (target) parts.push('→ ' + logName(target));
  if (amount != null && amount !== '') parts.push(' ' + amount);
  const q = (notes || []).filter(Boolean);
  if (q.length) parts.push(' ' + q.join(', '));
  log(parts.join(' '));
}

// Damage and healing are the two events with a fixed shape, so they get their
// own front doors rather than every call site remembering the sign convention.
function logDamage(what, target, amount, notes) {
  logEvent(what, target, logNum(amount), notes);
}
function logHeal(what, target, amount, notes) {
  logEvent(what, target, '+' + logNum(amount) + ' HP', notes);
}
// An action that resolved without dealing damage still costs a turn, so it is
// still an event worth a line.
function logMiss(what, target, why) { logEvent(what, target, why); }

// A status arriving or leaving. The text comes from the registry's own
// label() — the same string the badge on the unit shows — so the log and the
// badge cannot describe the same effect two different ways.
function logStatus(unit, st, gone) {
  const def = STATUSES[st.type]; if (!def) return;
  logEvent(gone ? '− ' + def.name + ' ended' : '+ ' + statusLabel(def, st, unit),
           unit);
}

// Turn header. Everything logged after it belongs to that unit's turn, which
// is what lets the event lines drop the actor entirely.
function logTurn(unit) {
  log('T' + state.turnNo + ' · ' + logName(unit).toUpperCase());
}
function clearLog(){ if (HEADLESS.on) HEADLESS.log.length = 0; }

// Pause when the tab is hidden so nothing accumulates in the background.
//
// A SCENE IS EXEMPT BOTH WAYS. Nothing accumulates during one — it is waiting
// on a click, not on a clock — and pausing it was destructive rather than
// idle: stopCombatLoop clears the timers a scene is built out of, so tabbing
// away mid-conversation froze the scientist half-arrived, and coming back
// restarted the fight underneath him. Leaving it alone is the whole fix; the
// click it is waiting for is just as valid two minutes later.
document.addEventListener('visibilitychange', () => {
  // A drop card is a scene in this one respect: it waits on a click, not on a
  // clock, and resolveDrop is what resumes the run — not startCombatLoop.
  if (state.inScene || state.pendingDrop) return;
  if (document.hidden) { if (state.combatActive) stopCombatLoop(); }
  else if (state.player && state.player.hp > 0 && document.getElementById('combat-screen').classList.contains('active')) {
    startCombatLoop();
  }
});


