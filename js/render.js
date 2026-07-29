// Rendering: arena, banks, enemy intent, juice, combat log
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

// ---- Class banks (Momentum / Spores / Resolve) -------------------
// One bank per strain, all rendered identically as filled/empty pips with the
// cap visible. Every change routes through bankAdjust so nothing moves silently:
// clamp, float text and a log line, then repaint the pips.
function bankOf(cls) {
  if (cls === 'psy')  return { field:'charges', name:'MOMENTUM', cap:P().chargeCap,  tone:'momentum' };
  if (cls === 'sym')  return { field:'spores',  name:'SPORES',   cap:P().sporeCap,   tone:'spores'   };
  if (cls === 'base') return { field:'resolve', name:'RESOLVE',  cap:P().resolveCap, tone:'resolve'  };
  return null;
}
// `why` is the REASON, not a replacement line. It used to be the whole message,
// which let each caller invent its own wording and drop the numbers — "Momentum
// slips (−2)" never said what you were left holding. Now the amount and the
// new total are always printed the same way and `why` is appended as a
// qualifier, so every bank line is comparable and the cap is always in view.
function bankAdjust(unit, delta, why) {
  if (!unit || !unit.isPlayer) return 0;
  const b = bankOf(unit.class); if (!b || !delta) return 0;
  const before = unit[b.field] || 0;
  const after = Math.max(0, Math.min(b.cap, before + delta));
  const d = after - before;
  if (d === 0) return 0;
  unit[b.field] = after;
  floatText(unit, (d > 0 ? '+' : '') + d + ' ' + b.name, 'bank');
  // No "→ You": banks are the player's only, so naming the target every time
  // would be a column of the same word.
  logEvent(b.name + ' ' + (d > 0 ? '+' : '−') + Math.abs(d),
           null, '(' + after + '/' + b.cap + ')', [why], d > 0 ? 'heal' : '');
  updateUnitCard(unit);
  return d;
}
function bankPipsHtml(p) {
  const b = bankOf(p.class); if (!b) return '';
  const cur = Math.max(0, Math.min(b.cap, p[b.field] || 0));
  let pips = '';
  for (let i = 0; i < b.cap; i++) pips += '<i class="pip' + (i < cur ? ' full' : '') + '"></i>';
  // Charge-up tension: one-away invites (the empty pip shimmers), full hums
  // until spent. The almost-there and the ready-now must read at a glance.
  const charge = cur >= b.cap ? ' brim' : (cur === b.cap - 1 ? ' near' : '');
  return '<div class="bank bank-' + b.tone + charge + '"><span class="bank-label">' + b.name
    + '</span><span class="bank-pips">' + pips + '</span></div>';
}

// ---- Enemy intent (Slay-the-Spire style next-move telegraph) ----
// Pure prediction that MIRRORS enemyAct/enemySwing exactly, so the badge can
// never lie about what is coming. Add branches here when enemies gain moves
// beyond attacking (block, buff, debuff, multi-hit, ...).
function enemyIntent(e) {
  if (!e || e.isPlayer || e.hp <= 0 || e._defeated) return null;
  if (hasStatus(e, 'stun'))
    return { kind:'stunned', icon:'💫', label:'Stunned', tone:'stunned' };
  if (e.windup)   // already charged — the very next swing is the heavy hit
    return { kind:'heavy', icon:'💥', label:'Heavy',
             dmg: Math.max(1, Math.floor(e.damage * BALANCE.enemy.windupMult)), tone:'heavy' };
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
  let k = ('C'+(u.charges||0)) + ('R'+(u.resolve||0)) + (u.thorns>0?'T'+getThornsDamage(u):'');
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
    const bankRow = panel.querySelector('.bank-row');
    if (bankRow) { const bh = bankPipsHtml(unit); if (bankRow.dataset.k !== bh) { bankRow.dataset.k = bh; bankRow.innerHTML = bh; } }
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
  const foeSize = unit.isPlayer ? '' : (unit.isBoss ? ' foe-boss' : (unit.elite ? ' foe-elite' : ' foe'));
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
      (unit.isPlayer ? '<div class="bank-row">' + bankPipsHtml(unit) + '</div>' : '') +
      '<div class="status-effects">' + buildStatusesHtml(unit) + '</div>' +
    '</div>' +
    '<div class="char-figure ' + (unit.hp>0?'alive':'') + foeSize + '">' +
      makeCharSVG(type, colorClass, hasPoseSet(unit) ? 'ready' : 'idle', unit) +
      '<div class="ground-shadow"></div></div>';
  return div;
}

// ---- Juice ----------------------------------------------------
let _shakeTimer = null;
function shake(intensity) {
  if (HEADLESS.on) return;
  const arena = document.getElementById('arena-card');
  if (!SETTINGS.shake) return;
  if (!arena || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  arena.style.setProperty('--shake', Math.min(14, intensity).toFixed(1) + 'px');
  arena.classList.add('shaking');
  clearTimeout(_shakeTimer);
  _shakeTimer = setTimeout(()=>arena.classList.remove('shaking'), 180);
}
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
  const lunge = isP?'lunge-right':'lunge-left', swing = isP?'swing-right':'swing-left';
  fig.classList.remove('lunge-right','lunge-left','swing-right','swing-left','lunging');
  void fig.offsetWidth;
  fig.classList.add('lunging', lunge, swing);
  if (hasPoseSet(caster)) setCharPose(caster, 'strike', skill);
  setTimeout(() => {
    fig.classList.remove('lunging', lunge, swing);
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
  if (!SETTINGS.floaters) return;
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
// The log is the fight's TRANSCRIPT, not its narration. It exists so that a
// turn which has already scrolled past can be reconstructed exactly: what
// acted, what it hit, for how much, and which modifiers were in play. Damage
// numbers otherwise live for 1.3s as a floater and are gone, which makes
// "why did that hit for 198?" unanswerable after the fact.
//
// THE RULES, so a new line cannot invent its own dialect:
//
//  1. STRUCTURE. Two levels only — headers (wave, turn) and the events
//     underneath them. Every event goes through logEvent and comes out
//     indented; a header is the only thing flush to the rail.
//
//  2. GRAMMAR. Every event line is
//         <what> → <to whom>   <amount>   <qualifiers>
//     in that order, always, so a column of them reads down like a table.
//     The ACTOR is deliberately absent: the turn header above already says
//     who is acting, and repeating it on every line doubles the width for
//     nothing. Only the target moves between lines, so only the target is
//     named.
//
//  3. NUMBERS ARE THE ONES THE FIGHT USED. Every amount is the exact integer
//     applied to hp, taken from the same variable the damage pipeline wrote —
//     never recomputed for display, because a recomputed number is a number
//     that can disagree.
//
//  4. QUALIFIERS EXPLAIN THE AMOUNT. CRIT ×2.0, BLOCK −50%, WEAK −25% — the
//     things that made the number what it is, not commentary about it. If a
//     qualifier did not move the number, it does not belong on the line.
//
//  5. NO PROSE. "The rot festers" told the player nothing they could act on;
//     "POISON ×4 → TOXIN +32%" tells them the trade they just made. Flavour
//     belongs on the skill cards, which have room for it.
const LOG_MAX = 400;

function log(msg, type) {
  // Headless keeps the transcript — it is the cheapest way to see why a
  // simulated run went the way it did — just not in the DOM.
  if (HEADLESS.on) {
    HEADLESS.log.push(msg);
    if (HEADLESS.log.length > HEADLESS.logCap) HEADLESS.log.shift();
    return;
  }
  const el = document.getElementById('combat-log'); if (!el) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + (type || '');
  entry.textContent = msg;
  el.appendChild(entry);
  while (el.children.length > LOG_MAX) el.removeChild(el.firstChild);
  el.scrollTop = el.scrollHeight;
}

// Units name themselves the same way everywhere in the log. The player is
// "You" rather than "Sonny" because the log is read from behind their eyes,
// and it is two characters instead of five on every line that mentions them.
function logName(u) { return !u ? '—' : (u.isPlayer ? 'You' : u.name); }

// Amounts are integers, formatted the way every other number in the game is.
function logNum(n) { return formatNum(Math.max(0, Math.floor(n))); }

// The one event-line builder. `notes` is the qualifier list; anything falsy in
// it is dropped, so a caller can pass conditions inline without assembling the
// array first.
function logEvent(what, target, amount, notes, type) {
  const parts = [what];
  if (target) parts.push('→ ' + logName(target));
  if (amount != null && amount !== '') parts.push(' ' + amount);
  const q = (notes || []).filter(Boolean);
  if (q.length) parts.push(' ' + q.join(', '));
  log(parts.join(' '), 'ev ' + (type || ''));
}

// Damage and healing are the two events with a fixed shape, so they get their
// own front doors rather than every call site remembering the sign convention.
function logDamage(what, target, amount, notes) {
  logEvent(what, target, logNum(amount), notes, 'damage');
}
function logHeal(what, target, amount, notes) {
  logEvent(what, target, '+' + logNum(amount) + ' HP', notes, 'heal');
}
// An action that resolved without dealing damage still costs a turn, so it is
// still an event worth a line.
function logMiss(what, target, why) { logEvent(what, target, why, null, ''); }

// A status arriving or leaving. The text comes from the registry's own
// label() — the same string the badge on the unit shows — so the log and the
// badge cannot describe the same effect two different ways.
function logStatus(unit, st, gone) {
  const def = STATUSES[st.type]; if (!def) return;
  logEvent(gone ? '− ' + def.name + ' ended' : '+ ' + statusLabel(def, st, unit),
           unit, null, null, gone ? '' : (def.kind === 'buff' ? 'heal' : 'damage'));
}

// Turn header. Everything logged after it belongs to that unit's turn, which
// is what lets the event lines drop the actor entirely.
function logTurn(unit) {
  log('T' + state.turnNo + ' · ' + logName(unit).toUpperCase(),
      'turn ' + (unit && unit.isPlayer ? 'you' : 'foe'));
}
function clearLog(){ const el=document.getElementById('combat-log'); if(el) el.innerHTML=''; }

// Pause when the tab is hidden so nothing accumulates in the background.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (state.combatActive) stopCombatLoop(); }
  else if (state.player && state.player.hp > 0 && document.getElementById('combat-screen').classList.contains('active')) {
    startCombatLoop();
  }
});


