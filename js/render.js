function renderCombat(forceFull) {
  if (HEADLESS.on) return;
  const ps=document.getElementById('player-slot'), es=document.getElementById('enemy-slot');
  if(!ps||!es||!state.player) return;
  const pPanel=ps.querySelector('.fighter');
  if (forceFull || !pPanel) { ps.innerHTML=''; ps.appendChild(createFighterPanel(state.player)); }
  else updateUnitCard(state.player);

  const foes = state.enemies || [];
  const side = document.getElementById('enemy-side');
  if (side) side.dataset.pack = foes.length;
  const have = Array.from(es.querySelectorAll('.fighter'));
  const same = !forceFull && have.length === foes.length
    && foes.every((e, i) => have[i].dataset.unitId === e.id);
  if (!foes.length) es.innerHTML='';
  else if (same) foes.forEach(e => updateUnitCard(e));
  else { es.innerHTML=''; foes.forEach(e => es.appendChild(createFighterPanel(e))); }
}

function enemyIntent(e) {
  if (!e || e.isPlayer || e.hp <= 0 || e._defeated) return null;
  if (hasStatus(e, 'stun'))
    return { kind:'stunned', icon:'💫', label:'Stunned', tone:'stunned' };
  if (e.windup) {

    const spoiled = !!e.windupSpoiled;
    const mult = windupMultFor(e) * (spoiled ? (BALANCE.enemy.windupSpoilFrac || 1) : 1);
    return { kind:'heavy', icon:'💥', label: spoiled ? 'Spoiled' : 'Heavy',
             dmg: Math.max(1, Math.floor(e.damage * mult)), tone:'heavy' };
  }
  if (e.windupEvery > 0 && ((e.actionCount || 0) + 1) % e.windupEvery === 0)

    return { kind:'charge', icon:'⚡', label:'Winding up', tone:'charge',
             riders: e.verb === 'guard' ? ['🛡'] : [] };
  const riders = [];
  if (e.elite && e.elite.poison) riders.push('☠');
  if (e.elite && e.elite.lifesteal) riders.push('🩸');

  const FV = ENEMY_VERBS.flurry;
  if (e.verb === 'flurry' && ((e.actionCount || 0) + 1) % FV.every === 0) {
    riders.push('×' + FV.hits);
    return { kind:'attack', icon:'⚔', label:'Flurry',
             dmg: Math.max(1, Math.floor(e.damage * FV.scale)) * FV.hits, riders, tone:'attack' };
  }
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

function statusLabel(def, st, unit) {
  if (def.label) return def.label(st, unit);
  const d = Math.ceil(st.duration || 0);
  return def.name
    + ((st.stacks || 1) > 1 ? ' ×' + st.stacks : '')
    + (isFinite(d) ? '  ' + d + 't' : '');
}
function buildStatusesHtml(unit) {

  let html = unit.statuses.map(st => {
    const def = STATUSES[st.type];
    if (!def) return '<span class="status">' + String(st.type).toUpperCase() + '</span>';
    return '<span class="status ' + (def.tone || def.kind || '') + '">' + statusLabel(def, st, unit) + '</span>';
  }).join('');

  if (unit.isPlayer && unit.thorns > 0) html += '<span class="status spines">THORNS ' + formatNum(getThornsDamage(unit)) + '</span>';
  return html;
}

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

    refreshReadoutValues();
  }
  if (!unit.isPlayer) {
    const badge = panel.querySelector('.intent-badge');
    if (badge) { const ib = intentBadge(unit); if (badge.className !== ib.cls || badge.innerHTML !== ib.html) { badge.className = ib.cls; badge.innerHTML = ib.html; } }
  }
  const side = unit.isPlayer ? document.getElementById('player-side') : document.getElementById('enemy-side');
  if (side) side.classList.toggle('dead', unit.isPlayer ? unit.hp <= 0 : !livingEnemies().length);
}

function createFighterPanel(unit) {
  const div = document.createElement('div');
  div.className = 'fighter unit' + (unit.hp<=0?' dead':'') + (unit.isBoss?' boss':'')
    + (!unit.isBoss && unit.elite ? ' elite' : '');
  div.dataset.unitId = unit.id;
  unit._statusKey = '';
  if (!unit.isPlayer) {
    div.classList.toggle('targeted', state.enemy === unit);
    div.addEventListener('click', () => {
      if (unit.hp > 0 && !unit._defeated) setTarget(unit);
    });
  }
  const colorClass = unit.isPlayer ? unit.class : 'enemy';
  const type = unit.isBoss ? 'boss' : (unit.isPlayer ? 'player' : 'enemy');
  const pct = Math.max(0, (unit.hp/Math.max(1,unit.maxHp))*100);
  const tags = unit.isPlayer ? [] : enemyTags(unit);
  const tagHtml = tags.map(t => '<span class="unit-tag ' + t.toLowerCase() + '">' + t + '</span>').join('');
  const foeSize = unit.isPlayer ? ' hero' : (unit.isBoss ? ' foe-boss' : (unit.elite ? ' foe-elite' : ' foe'));

  const artScale = foeArtScale(unit);
  const foeStyle = artScale !== 1 ? ' style="--foe-art:' + artScale + '"' : '';

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

function killFlash(unit) {
  if (HEADLESS.on) return;
  const panel = getFighterPanel(unit);
  if (!panel) return;
  panel.classList.add('killed');

}
function getFigureForUnit(unit){ const p=getFighterPanel(unit); return p?p.querySelector('.char-figure'):null; }

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

  if (type === 'damage' && unit && !unit.isPlayer) cls += ' dealt';
  el.className = cls;
  if (typeof value === 'string') el.textContent = value;
  else {
    const n = formatNum(value);
    const isXp = type === 'xp' || type === 'xp-bonus';
    el.textContent = (type==='heal'||isXp) ? '+'+n+(isXp?' XP':'') : '-'+n;

    if (isCrit) {
      const tag = document.createElement('span');
      tag.className = 'crit-tag';
      tag.textContent = 'CRIT';
      el.appendChild(tag);
    }
  }
  el.style.left = (18 + cosmeticRandom()*46) + '%';

  const active = card.querySelectorAll('.float-dmg').length;
  el.style.bottom = (98 + (active % 4) * 26) + 'px';
  card.appendChild(el);
  _floaters++;

  setTimeout(()=>{ el.remove(); _floaters = Math.max(0, _floaters - 1); }, 1300);
}

function clearFloaters() {
  document.querySelectorAll('.float-dmg').forEach(el => el.remove());
  _floaters = 0;
}

function log(msg) {
  if (!HEADLESS.on) return;
  HEADLESS.log.push(msg);
  if (HEADLESS.log.length > HEADLESS.logCap) HEADLESS.log.shift();
}

function logName(u) { return !u ? '—' : (u.isPlayer ? 'You' : u.name); }

function logNum(n) { return formatNum(Math.max(0, Math.floor(n))); }

function logEvent(what, target, amount, notes) {
  const parts = [what];
  if (target) parts.push('→ ' + logName(target));
  if (amount != null && amount !== '') parts.push(' ' + amount);
  const q = (notes || []).filter(Boolean);
  if (q.length) parts.push(' ' + q.join(', '));
  log(parts.join(' '));
}

function logDamage(what, target, amount, notes) {
  logEvent(what, target, logNum(amount), notes);
}
function logHeal(what, target, amount, notes) {
  logEvent(what, target, '+' + logNum(amount) + ' HP', notes);
}

function logMiss(what, target, why) { logEvent(what, target, why); }

function logStatus(unit, st, gone) {
  const def = STATUSES[st.type]; if (!def) return;
  logEvent(gone ? '− ' + def.name + ' ended' : '+ ' + statusLabel(def, st, unit),
           unit);
}

function logTurn(unit) {
  log('T' + state.turnNo + ' · ' + logName(unit).toUpperCase());
}
function clearLog(){ if (HEADLESS.on) HEADLESS.log.length = 0; }

document.addEventListener('visibilitychange', () => {

  if (document.hidden) { if (state.combatActive) stopCombatLoop(); }
  else if (state.player && state.player.hp > 0 && document.getElementById('combat-screen').classList.contains('active')) {
    startCombatLoop();
  }
});
