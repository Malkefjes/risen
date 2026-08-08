function statusDef(id) { return STATUSES[id] || null; }
function getStatus(unit, id) { return (unit && unit.statuses) ? unit.statuses.find(s => s.type === id) : null; }
function hasStatus(unit, id) { return !!getStatus(unit, id); }
function statusStacks(unit, id) { const s = getStatus(unit, id); return s ? (s.stacks || 0) : 0; }
function statusPower(unit, id) { const s = getStatus(unit, id); return s ? (s.power || 0) : 0; }

function shedStacks(unit, id, n, why) {
  const st = getStatus(unit, id);
  if (!st || !(n > 0)) return 0;
  const shed = Math.min(st.stacks || 1, n);
  st.stacks = (st.stacks || 1) - shed;
  if (st.stacks <= 0) { removeStatus(unit, id, why); }
  else {

    const def = STATUSES[id];
    logEvent((def ? def.name : id) + ' −' + shed, unit, '(×' + st.stacks + ' left)', [why]);
    updateUnitCard(unit);
  }
  return shed;
}

function removeStatus(unit, id, why) {
  const st = getStatus(unit, id);
  if (!st) return false;
  unit.statuses = unit.statuses.filter(s => s !== st);
  const def = STATUSES[id];
  if (def) logEvent('− ' + statusLabel(def, st, unit) + ' removed', unit, null, [why]);
  if (def && def.onExpire) def.onExpire(unit, st);
  return true;
}

function applyStatus(unit, id, opts) {
  const def = STATUSES[id];
  if (!unit || !def) return null;
  if (!unit.statuses) unit.statuses = [];
  const fresh = Object.assign({ type:id }, def.defaults || {}, opts || {});
  if (def.permanent) fresh.duration = Infinity;
  const cap = typeof def.maxStacks === 'function' ? def.maxStacks(unit) : def.maxStacks;
  const existing = getStatus(unit, id);
  let st;

  if (!existing) {
    st = fresh;
    if (cap != null && st.stacks != null) st.stacks = Math.min(cap, st.stacks);
    unit.statuses.push(st);
  } else {
    st = existing;
    switch (def.stacking) {
      case 'stack': {
        const want = (st.stacks || 0) + (fresh.stacks || 0);
        const limit = (cap == null) ? want : cap;
        const extra = Math.max(0, want - limit);
        st.stacks = Math.min(limit, want);
        st.duration = fresh.duration;

        if (fresh.perStack != null)
          st.perStack = def.perStackRule === 'newest'
            ? fresh.perStack
            : Math.max(st.perStack || 0, fresh.perStack);
        if (fresh.power != null) st.power = Math.max(st.power || 0, fresh.power);
        if (extra > 0 && def.onOverflow) def.onOverflow(unit, st, extra);
        break;
      }
      case 'amplify':

        st.power = Math.round((st.power || 1) * (fresh.power || 1) * 100) / 100;
        st.duration = Math.max(st.duration, fresh.duration);
        break;
      case 'extend': {
        const total = st.duration + fresh.duration;
        Object.assign(st, fresh);
        st.duration = total;
        break;
      }
      case 'longest': {
        const longest = Math.max(st.duration, fresh.duration);
        Object.assign(st, fresh);
        st.duration = longest;
        break;
      }
      default:
        Object.assign(st, fresh);
    }
  }

  logStatus(unit, st);
  if (def.onApply) def.onApply(unit, st);
  return st;
}

function skillStatusOpts(skill) {
  const opts = {};
  if (skill.duration != null) opts.duration = skill.duration;
  if (skill.power != null) opts.power = skill.power;
  if (skill.counterPower != null) opts.counter = skill.counterPower;
  if (skill.counterBleed != null) opts.counterBleed = skill.counterBleed;
  if (skill.stacks != null) opts.stacks = skill.stacks;
  if (skill.perStack != null) opts.perStack = skill.perStack;
  if (skill.tickCleanse != null) opts.cleanse = skill.tickCleanse;
  if (skill.tickBonus != null) opts.tickBonus = skill.tickBonus;
  if (skill.touchPoison != null) opts.touchPoison = skill.touchPoison;
  if (skill.hitHealFrac != null) opts.hitHealFrac = skill.hitHealFrac;
  if (skill.regenStrike != null) opts.regenStrike = skill.regenStrike;
  if (skill.regenPerPoison != null) opts.regenPerPoison = skill.regenPerPoison;
  return opts;
}

function tickStatuses(unit, which) {
  if (!unit || !unit.statuses || !unit.statuses.length) return false;

  const both = st => !!(STATUSES[st.type] && STATUSES[st.type].bothClocks);
  const mine = which === 'inflicted'
    ? st => both(st) || !!(STATUSES[st.type] && STATUSES[st.type].inflicted)
    : st => both(st) || !(STATUSES[st.type] && STATUSES[st.type].inflicted);

  for (const st of unit.statuses.slice()) {
    if (!mine(st)) continue;
    const def = STATUSES[st.type];
    if (def && def.onTurnStart && def.onTurnStart(unit, st)) return true;
  }
  const expired = [];
  unit.statuses = unit.statuses.filter(st => {
    const def = STATUSES[st.type];
    if (!mine(st) || both(st)) return true;
    if (def && (def.permanent || def.manual)) return true;
    st.duration--;
    if (st.duration > 0) return true;
    expired.push(st);
    return false;
  });
  expired.forEach(st => {
    const def = STATUSES[st.type];
    logStatus(unit, st, true);
    if (def && def.onExpire) def.onExpire(unit, st);
  });
  return false;
}

function statusMult(unit, hook, ctx) {
  if (!unit || !unit.statuses) return 1;
  let m = 1;
  for (const st of unit.statuses) {
    const def = STATUSES[st.type];
    if (def && def[hook]) m *= def[hook](unit, st, ctx);
  }
  return m;
}
function statusSum(unit, hook, ctx) {
  if (!unit || !unit.statuses) return 0;
  let n = 0;
  for (const st of unit.statuses) {
    const def = STATUSES[st.type];
    if (def && def[hook]) n += def[hook](unit, st, ctx);
  }
  return n;
}

function statusNotes(unit, hook, ctx) {
  const out = [];
  if (!unit || !unit.statuses) return out;
  for (const st of unit.statuses) {
    const def = STATUSES[st.type];
    if (!def || !def[hook]) continue;
    const m = def[hook](unit, st, ctx);
    if (!isFinite(m) || Math.abs(m - 1) < 1e-9) continue;
    out.push(def.name + ' ' + (m > 1 ? '+' : '−') + Math.round(Math.abs(m - 1) * 100) + '%');
  }
  return out;
}

function statusEach(unit, hook, ctx) {
  if (!unit || !unit.statuses) return;
  for (const st of unit.statuses.slice()) {
    const def = STATUSES[st.type];
    if (def && def[hook]) def[hook](unit, st, ctx);
  }
}

function effectiveAps(unit) {
  const base = Math.max(0.05, (unit && unit.attackSpeed) || 0.5);
  return Math.max(0.05, base * statusMult(unit, 'apsMult'));
}

function survivingStatuses(unit) {
  if (!unit || !unit.statuses) return [];
  return unit.statuses.filter(s => { const d = STATUSES[s.type]; return d && d.persists; });
}

let state = {
  classId:null, player:null, enemy:null, enemies:[], wave:1,
  kills:0,
  combatActive:false, turnTimer:null,

  saveSlot:1,
  awaitingSpawn:false, awaitingInput:false, active:null, pendingEnemyAct:false,

  dropQueue:[], modQueue:[],
  combo:0, fightTurns:0, enemyActions:0, bestCombo:0,
  runOver:false, won:false,

  turnNo:0,
  runStart:0, damageDealt:0, _defeatLock:false, _lastOverkill:0
};

const P = () => BALANCE.player;

const xpForLevel = lv => Math.floor(lv <= 1 ? BALANCE.xp.firstCost
  : BALANCE.xp.base + Math.pow(lv - 1, BALANCE.xp.pow) * BALANCE.xp.powScale);

function formatNum(n) {
  if (n == null || isNaN(n)) return '0';
  const sign = n < 0 ? '-' : '';
  n = Math.abs(Number(n));
  if (n < 1000) return sign + Math.floor(n).toString();
  const tiers = [{v:1e12,s:'t'},{v:1e9,s:'b'},{v:1e6,s:'m'},{v:1e3,s:'k'}];
  for (const t of tiers) {
    if (n >= t.v) {
      const val = n/t.v;
      return sign + (val>=100 ? Math.floor(val).toString() : val.toFixed(1).replace(/\.0$/,'')) + t.s;
    }
  }
  return sign + Math.floor(n).toString();
}

const DESC_KEYWORDS = { RESOLVE: 'base', POISON: 'bio', CHITIN: 'bio', WEAK: 'weak',
                        THORNS: 'sym', BLEED: 'bleed', DREAD: 'dread',
                        PRESSURE: 'hyd', CRIT: 'hyd' };
const KEYWORD_RE = new RegExp('\\b(' + Object.keys(DESC_KEYWORDS).join('|') + ')\\b', 'g');
function highlightKeywords(html) {
  return html.replace(KEYWORD_RE, w => '<span class="kw kw-' + DESC_KEYWORDS[w] + '">' + w + '</span>');
}

function descField(def, key) {
  const dot = key.indexOf('.');
  if (dot < 0) return def[key];
  const entry = (def.applies || []).find(a => a.id === key.slice(0, dot));
  return entry ? entry[key.slice(dot + 1)] : undefined;
}

function fmtDesc(def) {
  if (!def || !def.desc) return '';
  return highlightKeywords(def.desc.replace(/\{([\w.]+)(%|!|\+|#[^}]+)?\}/g, (token, key, mode) => {
    let v = descField(def, key);

    if (typeof v === 'function') {
      if (!state.player) return token;

      v = v(state.player, def);
    }
    if (v == null) return token;
    if (mode === '%') return Math.round(v * 100) + '%';

    if (mode === '!') {
      const p = state.player;
      if (!p) return Math.round(v * 100) + '%';
      return formatNum(Math.max(1, Math.floor(p.atkPower * v)));
    }

    if (mode === '+') {
      const p = state.player;
      if (!p) return Math.round(v * 100) + '%';
      return formatNum(Math.max(1, Math.floor(healAnchorFor(p) * v)));
    }
    if (mode && mode[0] === '#') {
      const noun = mode.slice(1);
      return v + ' ' + noun + (v === 1 ? '' : 's');
    }
    return String(v);
  }));
}

function applyDerivedStats(p) {
  if (!p) return p;

  const B = P();

  p.dmgMult = p.dmgMult || 1;
  p.hpMult  = p.hpMult  || 1;
  p.apsMult = p.apsMult || 1;

  const str      = p.str      + gearStat(p, 'str');
  const instinct = p.instinct + gearStat(p, 'instinct');
  const speed    = p.speed    + gearStat(p, 'speed');
  const vit      = p.vit      + gearStat(p, 'vit');

  p.atkPower = str * B.damagePerStr * p.dmgMult * (1 + gearMod(p, 'dmgMult'));

  const anchor = BALANCE.player.sheetAnchor * B.apsPerSpeed;
  const above = Math.max(0, speed - BALANCE.player.sheetAnchor);
  const earned = B.apsGain * above / (above + B.apsHalfPoints);
  p.attackSpeed = Math.min(B.apsCap, (anchor + earned) * p.apsMult * (1 + gearMod(p, 'apsBoost')));

  const newMax = Math.max(1, Math.floor(vit * B.hpPerVit * p.hpMult));
  if (p.maxHp > 0 && p.hp != null) {

    p.hp = Math.min(newMax, Math.max(1, p.hp + (newMax - p.maxHp)));
    p.maxHp = newMax;
  } else p.maxHp = newMax;

  p.healAnchor = Math.max(1, Math.floor(
    BALANCE.player.sheetAnchor * B.hpPerVit * p.hpMult *
    (1 + Math.max(0, (p.level || 1) - 1) * (B.healAnchorPerLevel || 0))
  ));

  const K = B.defenseK || 45, cap = B.defenseCap || 0.90;
  const layer = (pts, mod) => Math.min(cap, pts / (pts + K) + gearMod(p, mod));
  p.armor   = layer(str, 'armor');
  p.evasion = layer(speed, 'evasion');

  p.regen = Math.max(0, vit - BALANCE.player.sheetAnchor) * (B.regenPerVit || 0);
  p.critChance = Math.min(B.critCap, B.critBase + instinct*B.critPerInstinct + gearMod(p, 'critCh')
    + (p.class === 'hyd' ? statusStacks(p, 'pressure') * (B.critChancePerPressure || 0) : 0));

  p.critMult = B.critMultBase + instinct * (B.critMultPerInstinct || 0) + gearMod(p, 'critDmg')
    + (p.class === 'hyd' ? statusStacks(p, 'pressure') * (B.critPerPressure || 0) : 0);

  const ailmentDmg = Math.max(1, Math.round(attackDamage(p) * B.ailmentDamageFrac));
  p.poisonPerStack = p.class === 'bio'
    ? Math.max(1, ailmentDmg) : 0;

  p.thorns = p.class === 'sym'
    ? Math.max(0, Math.round((p.maxHp * B.thornsFrac
        + Math.max(0, (p.thornsGrown || 0) - (p.thornsShedded || 0))))) : 0;

  p.poisonDamage = p.poisonPerStack;

  p.bleedDamage = bleedDepth(p);
  return p;
}

function bleedStacks(p) {
  if (!p) return 1;
  const B = P();
  const per = B.bleedPerStr || 5;
  return Math.max(1, (B.bleedBase || 2) + Math.floor(((p.str || 0) + gearStat(p, 'str')) / per));
}

function statBonusStacks(p, stat, per) {
  if (!p || !(per > 0)) return 0;
  return Math.floor((((p[stat] || 0) + gearStat(p, stat))) / per);
}

function poisonStacks(p, skill) {
  const base = (skill && skill.poison) || 1;
  return Math.max(1, base + statBonusStacks(p, 'str', P().poisonPerStr));
}

function dreadStacks(p, skill) {
  const base = (skill && skill.dread) || 1;
  return Math.max(1, base + statBonusStacks(p, 'speed', P().dreadPerSpeed));
}

function bleedDepth(p) {
  if (!p) return 1;
  const B = P();
  const ail = Math.max(1, Math.round(attackDamage(p) * B.ailmentDamageFrac));
  const held = p.class === 'base' ? statusStacks(p, 'resolve') : 0;
  return Math.max(1, Math.round(ail * (1 + held * (B.bleedPerResolve || 0))));
}

function attackDamage(p) {
  return Math.max(1, Math.floor(p.atkPower));
}

function healAnchorFor(unit) {
  if (!unit) return 1;
  if (!unit.isPlayer) return unit.maxHp;

  return Math.max(1, Math.floor((unit.healAnchor || unit.maxHp) * (1 + gearMod(unit, 'healBoost'))));
}

function healCritMult(unit) {
  if (!unit || !unit.isPlayer) return 1;
  const chance = Math.min(1, Math.max(0, unit.critChance || 0));
  return Math.random() < chance ? (BALANCE.player.critHealMult || 1) : 1;
}

function turnRateValue(p) {
  const e = state.enemy;
  if (!e || e._defeated || e.hp <= 0) return effectiveAps(p);
  return effectiveAps(p) / effectiveAps(e);
}
function turnRateText(p) { return turnRateValue(p).toFixed(2) + '\u00d7'; }

function strainReadout(p) {

  if (p.class === 'sym') return { id:'strain', label:'Thorns', text: formatNum(p.thorns), num: p.thorns };
  if (p.class === 'hyd') {
    const held = statusStacks(p, 'pressure');
    return { id:'strain', label:'Pressure', text: formatNum(held), num: held };
  }

  if (p.class === 'base') {
    const held = statusStacks(p, 'resolve');
    return { id:'strain', label:'Resolve', text: formatNum(held), num: held };
  }

  return null;
}

function pressureWard(p) {
  if (!p || p.class !== 'hyd') return 0;
  const held = statusStacks(p, 'pressure');
  return Math.min(P().pressureWardCap || 0, held * (P().pressureWardPerPoint || 0));
}

function pressureRate(p) {
  if (!p || p.class !== 'hyd') return 1;
  const ins = (p.instinct || 0) + gearStat(p, 'instinct');
  return Math.max(1, ins / BALANCE.player.sheetAnchor);
}

function thornsWard(p) {
  if (!p || p.class !== 'sym' || !(p.thorns > 0)) return 0;
  return Math.min(P().thornsWardCap || 0, p.thorns * (P().thornsWardPerPoint || 0));
}

function guardReadout(p) {
  if (p.class === 'base')
    return { id:'guard', label:'Per Resolve', text: '\u2212' + Math.round(P().resolveDR*100) + '% taken' };

  if (p.class === 'bio')
    return { id:'guard', label:'Per Poison',
             text: '\u2212' + (P().poisonWeakenPerStack * 100).toFixed(1) + '% dealt' };

  if (p.class === 'sym')
    return { id:'guard', label:'Carapace', text: Math.round(thornsWard(p) * 100) + '%' };
  if (p.class === 'hyd')
    return { id:'guard', label:'Servos', text: Math.round(pressureWard(p) * 100) + '%' };
  return null;
}

function readouts(p) {
  const pct = (id, v) => ({ id, text: Math.round(v*100) + '%', num: v*100, unit:'%' });
  const rows = [
    { id:'hit',      text: formatNum(attackDamage(p)), num: attackDamage(p) },
    pct('crit', p.critChance),
    { id:'critmult', text: '\u00d7' + (p.critMult % 1 ? p.critMult.toFixed(2) : p.critMult),
      num: p.critMult, unit:'\u00d7', dp: 2 },
    { id:'turns',    text: turnRateText(p), num: turnRateValue(p), unit:'\u00d7', dp: 2 }
  ];
  const st = strainReadout(p); if (st) rows.push(st);

  rows.push(
    { id:'bleeddmg',   text: formatNum(p.bleedDamage) + '/turn', num: p.bleedDamage, unit:'/turn' },
    { id:'poisondmg',  text: formatNum(p.poisonDamage) + '/turn', num: p.poisonDamage, unit:'/turn' }
  );
  rows.push(

    { id:'hp',    text: formatNum(Math.floor(p.maxHp)), num: Math.floor(p.maxHp) },
    pct('armor', p.armor),
    pct('evasion', p.evasion),
    { id:'regen', text: p.regen > 0 ? formatNum(Math.floor(healAnchorFor(p) * p.regen)) + '/turn' : '\u2014',
      num: Math.floor(healAnchorFor(p) * p.regen), unit:'/turn' }
  );
  const g = guardReadout(p); if (g) rows.push(g);
  return rows;
}

function deltaLabel(before, after) {
  if (!before || before.text === after.text) return '';
  if (before.num == null || after.num == null) return '\u2192 ' + after.text;
  const d = after.num - before.num;
  if (!d) return '';
  const mag = after.dp ? Math.abs(d).toFixed(after.dp) : formatNum(Math.round(Math.abs(d)));
  return (d > 0 ? '+' : '\u2212') + mag + (after.unit || '');
}

function renderDeltas(view) {
  const p = state.player; if (!p) return 0;
  const before = readouts(p), after = readouts(view);
  let changed = 0;
  after.forEach((r, i) => {
    const el = document.getElementById('p-' + r.id);
    if (!el) return;
    const label = deltaLabel(before[i], r);
    el.textContent = label;
    el.classList.toggle('on', !!label);
    if (label) changed++;
  });
  return changed;
}

function hazardFor(wave) {
  const h = state.hazard;
  if (!h || !HAZARDS[h.id]) return null;
  return (wave >= h.from && wave <= h.until) ? HAZARDS[h.id] : null;
}

function rollHazardOffer() {
  const pool = Object.keys(HAZARDS);
  const out = [];
  while (out.length < 3 && pool.length)
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

function pickHazard(id) {
  const offer = state.hazardOffer;
  if (!offer || offer.indexOf(id) < 0) return;
  state.hazardOffer = null;
  state.hazard = { id, from: state.wave, until: state.wave + 9 };
  logEvent('THE TOLL', null, HAZARDS[id].name,
           [HAZARDS[id].text, 'through wave ' + (state.wave + 9)]);
  saveRun();
  if (HEADLESS.on) return;
  renderCampPanel();
  updateHud();
}

function rollWaveKind(wave) {
  const zone = zoneForWave(wave);
  let isBoss;
  if (zone.bossSegment) {
    const inZone = wave - zone.startWave + 1;
    isBoss = (inZone % zone.bossSegment === 0)
          || (Math.random() < (zone.extraBossChance || 0));
  } else {
    isBoss = wave % BALANCE.bossEvery === 0;
  }
  let champ = (!isBoss && zone.champion && zone.champion.at === wave) ? zone.champion : null;
  if (!isBoss && !champ && wave > BALANCE.finalWave && (wave - BALANCE.finalWave) % 10 === 5)
    champ = DEPTH_CHAMPIONS[Math.floor(Math.random() * DEPTH_CHAMPIONS.length)];
  return { isBoss, champ };
}

function makeWave(wave) {
  const zone = zoneForWave(wave);
  const kind = rollWaveKind(wave);

  let size = 1;
  const haz = hazardFor(wave);
  if (!kind.isBoss && !kind.champ && wave > (zone.soloUntil || 0) && zone.packWeights)
    size = (haz && haz.id === 'swarm') ? 3 : pickWeighted(zone.packWeights) + 1;

  const members = [];
  let eliteTaken = false;
  for (let i = 0; i < size; i++) {
    const e = makeEnemy(wave, { isBoss: kind.isBoss, champ: kind.champ,
                                size, index: i, noElite: eliteTaken });
    if (e.elite) eliteTaken = true;
    members.push(e);
  }
  return members;
}

function makeEnemy(wave, ctx) {
  const E = BALANCE.enemy;
  const zone = zoneForWave(wave);

  const w = wave - zone.startWave;
  const tier = Math.floor(w/5);

  const base = Math.min(wave, BALANCE.finalWave) - 1;
  const deep = Math.max(0, wave - BALANCE.finalWave);
  const hpCurve  = Math.pow(E.hpRate, base)  * Math.pow(E.depthHpRate, deep);
  const dmgCurve = Math.pow(E.dmgRate, base) * Math.pow(E.depthDmgRate, deep);

  const kind = ctx || rollWaveKind(wave);
  const isBoss = kind.isBoss;
  const champ = kind.champ || null;
  const size = (ctx && ctx.size) || 1;
  const hpShare  = size > 1 ? (E.packHp[size]  || 1) : 1;
  const dmgShare = size > 1 ? (E.packDmg[size] || 1) : 1;
  const xpShare  = size > 1 ? 1 / size : 1;

  const bossBump = (isBoss && wave === BALANCE.bossEvery) ? (BALANCE.enemy.firstBossMult || 1) : 1;
  const isFinal = wave === BALANCE.finalWave;

  const haz = hazardFor(wave);
  let elite = null;
  if (!isBoss && (champ || wave > 4) && !(ctx && ctx.noElite)) {
    const keys = Object.keys(ELITES);

    const chance = Math.min(zone.eliteChanceCap != null ? zone.eliteChanceCap : E.eliteChanceCap,
      (zone.eliteBaseChance != null ? zone.eliteBaseChance : E.eliteBaseChance)
        + wave*E.eliteChancePerWave)
      + (haz && haz.id === 'virulent' ? 0.25 : 0);
    if (champ || Math.random() < chance) {
      elite = ELITES[keys[Math.floor(Math.random()*keys.length)]];
      if (haz && haz.id === 'virulent') elite = ELITES.venomous;
    }
  }

  const rank = tier + 1;
  const NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const rankTag = rank > 1 ? ' ' + (NUMERALS[rank] || rank) : '';

  const inDepths = wave > BALANCE.finalWave;
  const pool = inDepths ? DEPTH_ROSTER : (zone.enemies || [{ id: 'trash', name: zone.enemyName }]);
  const face = champ || (zone.randomRoster
    ? pool[Math.floor(Math.random() * pool.length)]
    : pool[((w % pool.length) + pool.length) % pool.length]);

  const depthBoss = (isBoss && inDepths)
    ? DEPTH_BOSSES[Math.floor(Math.random() * DEPTH_BOSSES.length)] : null;

  const name = champ ? champ.name + (inDepths ? rankTag : '')
    : (isBoss ? (depthBoss ? depthBoss.name : zone.bossName) : face.name) + rankTag;

  const e = {
    id: 'enemy-' + wave + '-' + ((ctx && ctx.index) || 0) + '-' + Math.floor(Math.random()*99999),
    name, class:'enemy', isPlayer:false, isBoss, isFinal, elite, rank,
    champion: !!champ,

    verb: isBoss
        ? (zone.rollBossVerb
            ? CHAMPION_VERBS[Math.floor(Math.random() * CHAMPION_VERBS.length)]
            : (zone.bossVerb || null))
        : champ ? CHAMPION_VERBS[Math.floor(Math.random() * CHAMPION_VERBS.length)]
        : null,
    zone: zone.num,
    artZone: depthBoss ? depthBoss.artZone : (champ && champ.artZone) || face.artZone || zone.num,
    waveNo: wave,
    rosterId: face.id,
    maxHp: Math.max(1, Math.round(E.hpBase * hpCurve
      * hpShare
      * (isBoss?E.bossHp:1) * bossBump * (elite&&elite.hpMult?elite.hpMult:1))),
    damage: Math.max(1, Math.round(E.dmgBase * dmgCurve
      * dmgShare * (isBoss?E.bossDmg:E.trashDmgMult) * bossBump
      * (haz && haz.id === 'brutes' ? 1.2 : 1))),
    attackSpeed: Math.min(E.apsCap, (E.apsBase + (wave-1)*E.apsPerWave)
      * (isBoss?E.bossAps:1) * (elite&&elite.apsMult?elite.apsMult:1))
      * (haz && haz.id === 'frenzy' ? 1.15 : 1),
    evadeChance: 0,
    critChance: E.crit, critMult: E.critMult,
    xpMult: (isBoss?E.bossXp:1) * (elite?elite.xp:1) * xpShare,
    dropMult: (size > 1 && !elite) ? 1 / size : 1,
    hp:0, statuses:[], meter:0, stunImmune:false,
    actionCount:0,
    _defeated:false, _statusKey:''
  };
  e.hp = e.maxHp;
  return e;
}

const DEV_ALL_PLATES = typeof location !== 'undefined' && /[?&]plates\b/.test(location.search);
function enemyTags(e) {
  if (DEV_ALL_PLATES)
    return ['BOSS'].concat(Object.values(ELITES).map(el => el.tag));
  const out = [];
  if (e.isBoss) out.push('BOSS');
  if (e.elite) out.push(e.elite.tag);

  if (e.verb && ENEMY_VERBS[e.verb]) out.push(ENEMY_VERBS[e.verb].tag);
  return out;
}
