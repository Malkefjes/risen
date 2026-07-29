// Status API + player/enemy derived stats — the rules math
// ---- Status API ----------------------------------------------
// Every read and write of unit.statuses goes through one of these. Combat code
// asks questions ("is Spines up?", "how much does this hit get multiplied?")
// instead of walking the array and knowing what lives in it.
function statusDef(id) { return STATUSES[id] || null; }
function getStatus(unit, id) { return (unit && unit.statuses) ? unit.statuses.find(s => s.type === id) : null; }
function hasStatus(unit, id) { return !!getStatus(unit, id); }
function statusStacks(unit, id) { const s = getStatus(unit, id); return s ? (s.stacks || 0) : 0; }
function statusPower(unit, id) { const s = getStatus(unit, id); return s ? (s.power || 0) : 0; }

// `why` names whatever stripped it. Without a line here a status could vanish
// mid-fight with nothing in the transcript to show for it — a purge eating a
// four-stack POISON looked like the rot simply stopped existing.
function removeStatus(unit, id, why) {
  const st = getStatus(unit, id);
  if (!st) return false;
  unit.statuses = unit.statuses.filter(s => s !== st);
  const def = STATUSES[id];
  if (def) logEvent('− ' + statusLabel(def, st, unit) + ' removed', unit, null, [why], '');
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
        if (fresh.perStack != null) st.perStack = Math.max(st.perStack || 0, fresh.perStack);
        if (fresh.power != null) st.power = Math.max(st.power || 0, fresh.power);
        if (extra > 0 && def.onOverflow) def.onOverflow(unit, st, extra);
        break;
      }
      case 'amplify':
        // Rounded to 2dp so a long chain of boosts can't drift into float noise.
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
      default:                       // 'replace'
        Object.assign(st, fresh);
    }
  }
  // Logged HERE, at the one choke point every status passes through, rather
  // than at each caller. That is what makes the transcript complete: a rider,
  // an elite affix and a skill all report the same way, on either side of the
  // fight, and a status added later is logged without touching this at all.
  logStatus(unit, st);
  if (def.onApply) def.onApply(unit, st);
  return st;
}

// A skill's own numbers, translated into status fields. Anything the skill
// leaves out falls through to the definition's defaults, so a skill only spells
// out what it actually changes. Add a line here when a status grows a field a
// skill should be able to set.
function skillStatusOpts(skill) {
  const opts = {};
  if (skill.duration != null) opts.duration = skill.duration;
  if (skill.power != null) opts.power = skill.power;
  if (skill.counterPower != null) opts.counter = skill.counterPower;
  if (skill.stacks != null) opts.stacks = skill.stacks;
  if (skill.perStack != null) opts.perStack = skill.perStack;
  return opts;
}

// Start of a unit's turn: every onTurnStart fires, then everything that runs on
// a clock counts down and expires. Returns true if a tick was lethal, so the
// caller can stop rather than resolve a turn for a corpse.
function tickStatuses(unit) {
  if (!unit || !unit.statuses || !unit.statuses.length) return false;
  // Snapshot: a hook may add or remove statuses mid-loop.
  for (const st of unit.statuses.slice()) {
    const def = STATUSES[st.type];
    if (def && def.onTurnStart && def.onTurnStart(unit, st)) return true;
  }
  const expired = [];
  unit.statuses = unit.statuses.filter(st => {
    const def = STATUSES[st.type];
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

// Fold every status' contribution to one hook. statusMult multiplies (damage,
// rates), statusSum adds (flat bonuses), statusEach is for pure side effects.
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
// Which statuses actually moved a number, phrased as log qualifiers. It folds
// the SAME hooks the damage pipeline folds, so a line can name the reason a hit
// landed for what it did instead of just asserting the total — and a status
// added later shows up here for free. Anything that resolved to ×1 is dropped:
// a modifier that changed nothing is not an explanation.
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

// The rate a unit actually fills its initiative gauge at. Everything that reads
// a unit's tempo goes through this, so a haste or slow lands everywhere at once
// — turn order, the forecast and per-round regen alike.
function effectiveAps(unit) {
  const base = Math.max(0.05, (unit && unit.attackSpeed) || 0.5);
  return Math.max(0.05, base * statusMult(unit, 'apsMult'));
}

// Between fights the player keeps only what is marked to persist; the save file
// carries the same set, so reloading mid-run lands you in the same shape.
function survivingStatuses(unit) {
  if (!unit || !unit.statuses) return [];
  return unit.statuses.filter(s => { const d = STATUSES[s.type]; return d && d.persists; });
}

let state = {
  classId:null, player:null, enemy:null, wave:1,
  talentOffers:null, talentQueue:[], overkillCarry:0, kills:0,
  combatActive:false, turnTimer:null,
  // Which save slot the live run writes to. Set when a run starts (claimSaveSlot)
  // or is loaded (continueRun); every saveRun/clearSavedRun targets it.
  saveSlot:1,
  awaitingSpawn:false, awaitingInput:false, active:null, pendingEnemyAct:false,
  combo:0, fightTurns:0, enemyActions:0, bestCombo:0,
  runOver:false, won:false,
  // Turns taken by EITHER side this fight, purely so the log can number them.
  // fightTurns counts only the player's, which makes it the wrong clock for a
  // transcript that has to interleave both.
  turnNo:0,
  runStart:0, damageDealt:0, _defeatLock:false, _lastOverkill:0
};

const P = () => BALANCE.player;
const xpForLevel = lv => Math.floor(BALANCE.xp.base + lv*BALANCE.xp.linear + Math.pow(lv,BALANCE.xp.pow)*BALANCE.xp.powScale);

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

// Skill and mutation blurbs are templates, not prose. Every number in a
// description is pulled straight off the definition that owns it, so a card can
// never drift from the value it describes — retune a skill and its text follows.
// Tokens:
//   {key}        raw value              power: 2.2   -> "2.2"
//   {key%}       as a percentage        power: 0.85  -> "85%"
//   {key#noun}   count + plural noun    stun: 1      -> "1 turn", 2 -> "2 turns"
// An unknown key is left in the text on purpose, so a typo is visible instead
// of silently rendering as a blank.
// Mechanic names wear the colour that mechanic already wears on the fighter, so
// RESOLVE on a card and the RESOLVE bank under the health bar read as one
// thing rather than as a word that happens to be capitalised.
//
// The value is the CSS variable suffix, so an entry and a matching `.kw-<x>`
// rule are the whole cost of adding MOMENTUM ('psy'), SPORES ('sym') or
// POISON ('bio') when their cards get the same treatment.
const DESC_KEYWORDS = { RESOLVE: 'base', POISON: 'bio', CHITIN: 'bio', WEAK: 'weak' };
const KEYWORD_RE = new RegExp('\\b(' + Object.keys(DESC_KEYWORDS).join('|') + ')\\b', 'g');
function highlightKeywords(html) {
  return html.replace(KEYWORD_RE, w => '<span class="kw kw-' + DESC_KEYWORDS[w] + '">' + w + '</span>');
}

// A dotted key reads a status the skill applies: {weak.power%} comes from the
// `applies` entry with that id, so the number lives once — in the entry that
// actually drives the effect — instead of being copied into the sentence too.
function descField(def, key) {
  const dot = key.indexOf('.');
  if (dot < 0) return def[key];
  const entry = (def.applies || []).find(a => a.id === key.slice(0, dot));
  return entry ? entry[key.slice(dot + 1)] : undefined;
}

function fmtDesc(def) {
  if (!def || !def.desc) return '';
  return highlightKeywords(def.desc.replace(/\{([\w.]+)(%|!|#[^}]+)?\}/g, (token, key, mode) => {
    const v = descField(def, key);
    if (v == null) return token;
    if (mode === '%') return Math.round(v * 100) + '%';
    // '!' reads the field as a multiplier on Attack Damage and prints the
    // damage it deals RIGHT NOW, so a card says "30 damage" instead of "120%"
    // of a number you have to go and look up. Same source as the combat
    // pipeline (atkPower x power), so the card cannot drift from the hit.
    // Falls back to the percentage when there is no player yet — menus can
    // render a card before a run exists.
    if (mode === '!') {
      const p = state.player;
      if (!p) return Math.round(v * 100) + '%';
      return formatNum(Math.max(1, Math.floor(p.atkPower * v)));
    }
    if (mode && mode[0] === '#') {
      const noun = mode.slice(1);
      return v + ' ' + noun + (v === 1 ? '' : 's');
    }
    return String(v);
  }));
}

// ---- Player stats -------------------------------------------
function applyDerivedStats(p) {
  if (!p) return p;
  // CLASSES is no longer consulted here: apsBase was the last per-strain
  // number in the derived sheet, and it went when turn rate became a pure stat.
  const B = P();
  const t = p.talents || {};

  p.dmgMult = p.dmgMult || 1;
  p.hpMult  = p.hpMult  || 1;
  p.apsMult = p.apsMult || 1;

  // ATTACK DAMAGE. One rule for every strain, Unmutated included: Strength and
  // nothing else. Damage used to come off each strain's own primary — Speed for
  // psy, Vitality for sym, the highest stat for Unmutated — which meant
  // Strength was worth literally nothing to two of the four, and "which stat
  // makes me hit harder" had a different answer per strain.
  //
  // The per-strain `power` scalar stays, so a strain still hits its own weight
  // (bio heavy, psy light and fast); what changed is only which stat feeds it.
  // 5 damage per point of Strength, so the 5 everyone starts with is 25 Attack
  // Damage. There is no per-strain damage weight any more — the old `power`
  // scalar multiplied this by a different number per strain (bio 1.30, psy
  // 0.77, Unmutated 1.9) so that hitting hard could be traded against hitting
  // often. It went to 1.0 everywhere when Attack Damage was anchored, at which
  // point it was multiplying by one; dmgMult already covers earned multipliers.
  p.atkPower = p.str * B.damagePerStr * p.dmgMult;

  // TURN RATE. Speed and nothing else, the same shape as damage off Strength
  // and HP off Vitality: 5 Speed is 1.00, one point is +0.20. There is no
  // per-strain base any more — every strain starts at the same rate by design,
  // so an additive base could only reintroduce the free head start the anchor
  // removed. If a strain should be fast again it wants a MULTIPLIER here, not
  // a base, so that it scales the earned rate instead of replacing it.
  //
  // The two caps are applied in order and mean different things: points
  // saturate at speedApsCap, then earned multipliers apply, then apsCap is the
  // absolute ceiling. Capping the stat contribution BEFORE apsMult is what
  // lets a player who has maxed Speed still gain from an earned multiplier
  // rather than drawing something that does nothing.
  const fromPoints = Math.min(B.speedApsCap, p.speed * B.apsPerSpeed);
  p.attackSpeed = Math.min(B.apsCap, fromPoints * p.apsMult);

  // Max HP is Vitality x 20, full stop. Symbiotic used to take a reduced rate to
  // pay for its thorns; that came out with the flat base and the per-level
  // trickle, because any of the three makes the readout stop being a straight
  // read of the stat above it. If sym needs paying for again, the place is its
  // thorns numbers, not a hidden discount on the shared rule.
  const newMax = Math.max(1, Math.floor(p.vit * B.hpPerVit * p.hpMult));
  if (p.maxHp > 0 && p.hp != null) {
    const ratio = p.hp / Math.max(1, p.maxHp);
    p.maxHp = newMax;
    p.hp = Math.min(newMax, Math.max(1, Math.floor(newMax * ratio)));
  } else p.maxHp = newMax;

  p.evadeChance = Math.min(B.evadeCap, B.evadeBase + p.speed*B.evadePerSpeed + (t.evadeFlat||0));
  p.blockChance = Math.min(B.blockCap, B.blockBase + p.vit*B.blockPerVit);
  p.blockReduction = B.blockReduction;
  p.critChance = Math.min(B.critCap, B.critBase + p.instinct*B.critPerInstinct + (t.critFlat||0));
  // Flat, and the same for everyone: Instinct decides how often you crit, not
  // how hard. One less number that drifts with a stat nobody can see moving.
  p.critMult = B.critMult;
  // Cooldowns answer to Speed, not Instinct: acting more often and acting
  // again sooner are the same idea, and it gives Speed somewhere to go once
  // the attack-rate term saturates at 23 points.
  // Earned sources only — Speed does not feed this (see the note in BALANCE).
  p.cdr = Math.min(B.cdrCap, t.cdrBonus || 0);

  // A fifth of Attack Damage and a twentieth of max HP — both already carry
  // dmgMult / hpMult through those two, so neither is applied again here.
  // Rounded rather than floored: at these fractions the result is exact, and
  // rounding keeps it exact if the anchors ever stop being multiples of 5.
  const ailmentDmg = Math.max(1, Math.round(attackDamage(p) * B.ailmentDamageFrac));
  p.poisonPerStack = p.class === 'bio'
    ? Math.max(1, Math.round(ailmentDmg * (t.poisonMult||1))) : 0;
  p.thorns = p.class === 'sym'
    ? Math.max(0, Math.round(p.maxHp * B.thornsFrac * (t.thornsMult||1))) : 0;

  // ---- Ailments ----
  // Bleed and poison are one mechanic wearing two coats: a stacking tick on
  // whatever you hit. Each reports a CHANCE (how often a landed hit applies it)
  // and a DAMAGE (what one stack ticks for), so the pair reads the same way for
  // both and there is one shape to extend later.
  //
  // Chance is honest about today rather than reporting a placeholder zero: bio
  // poisons on every landed basic, which is a 100% chance, and saying 0% while
  // Slash visibly poisons would be a readout disagreeing with the game. Nothing
  // applies bleed at all yet, so it sits at 0 until a source raises it — its
  // damage is what a stack WOULD tick for if one landed, the same way crit
  // damage reads while crit chance is 0.
  const basicPoisons = p.class === 'bio' && !!(p.basicSkill && p.basicSkill.poison > 0);
  p.poisonChance = Math.min(1, (basicPoisons ? 1 : 0) + (t.poisonChance || 0));
  p.poisonDamage = p.poisonPerStack;
  p.bleedStackCap = B.bleedStackCap + (t.bleedStackBonus || 0);
  p.bleedChance = Math.min(1, (t.bleedChance || 0));
  p.bleedDamage = Math.max(1, Math.round(ailmentDmg * (t.bleedMult || 1)));
  return p;
}

// What the sidebar reads. Every entry is an exact value the fight actually
// uses — no modelled averages, no "assume your bank is full" estimates. The
// list is ordered and rendered as-is, and previewStat diffs two of these to
// show what a stat point buys, so a readout and its delta can never disagree.
// Attack Damage: what a basic attack deals, and the base every other skill
// multiplies by its own power. Every strain's basic carries power 1.0, so the
// readout and the skill card are the same number rather than two that agree by
// coincidence — if a basic ever stops being 1.0, that is the thing to revisit.
function attackDamage(p) {
  return Math.max(1, Math.floor(p.atkPower));
}

// Turn rate is the one number that had no meaning in a turn-based game: "1.15x"
// of what? It is a RATIO — your turns per turn of whoever you are facing — so
// that is what it reports, falling back to the raw gauge rate when there is
// nobody to compare against.
function turnRateValue(p) {
  const e = state.enemy;
  if (!e || e._defeated || e.hp <= 0) return effectiveAps(p);
  return effectiveAps(p) / effectiveAps(e);
}
function turnRateText(p) { return turnRateValue(p).toFixed(2) + '\u00d7'; }

// One optional row per strain, so the mechanic you actually play with is a
// readout rather than something you infer from the skill cards.
function strainReadout(p) {
  // No bio row: its poison is now reported by the Ailments pair, and listing
  // "Poison per stack" beside an identical "Poison damage" would be the same
  // number printed twice in one pane.
  if (p.class === 'sym') return { id:'strain', label:'Thorns', text: formatNum(p.thorns), num: p.thorns };
  if (p.class === 'psy') return { id:'strain', label:'Per Momentum', text: '+' + Math.round(P().momentumDmg*100) + '% dmg' };
  return null;
}
function guardReadout(p) {
  if (p.class !== 'base') return null;
  return { id:'guard', label:'Per Resolve', text: '\u2212' + Math.round(P().resolveDR*100) + '% taken' };
}

// Rows carry a `num` (and its unit) as well as their text wherever a difference
// between two sheets means something, so a delta can be reported as the amount
// it ADDS \u2014 "+15" \u2014 rather than as the value it would become. Rows with no
// sensible number (Per Momentum, Per Resolve) simply omit it and fall back to
// showing the replacement value.
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
  // Ailments — the two damage-over-time effects, each as chance + damage so the
  // pair reads identically and a third one would slot in the same way.
  rows.push(
    pct('bleedchance', p.bleedChance),
    { id:'bleeddmg',   text: formatNum(p.bleedDamage) + '/turn', num: p.bleedDamage, unit:'/turn' },
    pct('poisonchance', p.poisonChance),
    { id:'poisondmg',  text: formatNum(p.poisonDamage) + '/turn', num: p.poisonDamage, unit:'/turn' }
  );
  rows.push(
    // The delta is on max HP: current HP moving with it is a consequence, not
    // the thing a point buys.
    { id:'hp',    text: formatNum(Math.floor(p.hp)) + ' / ' + formatNum(Math.floor(p.maxHp)),
      num: Math.floor(p.maxHp) },
    pct('evade', p.evadeChance),
    { id:'block', text: Math.round(p.blockChance*100) + '% (\u2212' + Math.round(p.blockReduction*100) + '%)',
      num: p.blockChance*100, unit:'%' }
  );
  const g = guardReadout(p); if (g) rows.push(g);
  // Cooldown reduction only exists once something grants it. Omitted rather
  // than reported as a permanent 0%, the same way the strain and guard rows
  // are omitted for classes that do not own them — a readout that cannot move
  // is not information. p.cdr is constant across a pending allocation (Speed
  // no longer feeds it), so omitting it cannot desync the two readouts()
  // renderDeltas zips together.
  if (p.cdr > 0) rows.push(pct('cdr', p.cdr));
  return rows;
}

// One row's delta between two sheets. Signed and in the row's own unit, so it
// reads as what you are buying.
function deltaLabel(before, after) {
  if (!before || before.text === after.text) return '';
  if (before.num == null || after.num == null) return '\u2192 ' + after.text;
  const d = after.num - before.num;
  if (!d) return '';
  const mag = after.dp ? Math.abs(d).toFixed(after.dp) : formatNum(Math.round(Math.abs(d)));
  return (d > 0 ? '+' : '\u2212') + mag + (after.unit || '');
}

// The single place the delta column is written, whatever is driving it: the
// staged allocation on its own, or staged plus the point under the cursor.
// Values themselves are never touched here \u2014 they stay on the committed sheet,
// so you always see what you have beside what you would gain.
function renderDeltas(view) {
  const p = state.player; if (!p) return 0;
  const before = readouts(p), after = readouts(view);
  const touched = {};
  let changed = 0;
  after.forEach((r, i) => {
    const el = document.getElementById('p-' + r.id);
    if (!el) return;
    const label = deltaLabel(before[i], r);
    el.textContent = label;
    el.classList.toggle('on', !!label);
    if (label) { changed++; const g = groupOfRow(r.id); if (g) touched[g] = true; }
  });
  // Mark every pane a change lands in, including ones not on screen.
  document.querySelectorAll('.stat-subtab')
    .forEach(el => el.classList.toggle('has-delta', !!touched[el.dataset.group]));
  return changed;
}

// ---- Enemy stats (fully independent of the player's formulas) ----
function makeEnemy(wave) {
  const E = BALANCE.enemy;
  const tier = Math.floor((wave-1)/5), within = (wave-1)%5;
  const g = Math.pow(E.tierGrowth, tier) * (1 + within*E.withinStep);
  const isBoss = wave % BALANCE.bossEvery === 0;
  const isFinal = wave === BALANCE.finalWave;
  const arch = isBoss ? ARCHETYPES.brute : ARCHETYPES[ARCH_ORDER[(wave-1) % ARCH_ORDER.length]];

  // Elites are purely a roll now. The door used to be able to force one for
  // its HUNT branch, which is what the removed forceElite argument was for.
  let elite = null;
  if (!isBoss && wave > 4) {
    const keys = Object.keys(ELITES);
    const chance = Math.min(E.eliteChanceCap, E.eliteBaseChance + wave*E.eliteChancePerWave);
    if (Math.random() < chance) {
      elite = ELITES[keys[Math.floor(Math.random()*keys.length)]];
    }
  }

  const act = actForWave(wave);
  const name = isBoss ? act.bossName : act.enemyName;

  const e = {
    id: 'enemy-' + wave + '-' + Math.floor(Math.random()*99999),
    name, class:'enemy', isPlayer:false, isBoss, isFinal, arch, elite,
    windupEvery: isBoss ? (isFinal ? E.finalWindupEvery : E.windupEvery) : (elite ? E.eliteWindupEvery : 0),
    level: Math.max(1, tier+1+Math.floor(within/2)),
    maxHp: Math.max(1, Math.round(E.hpBase * g * arch.hp * (isBoss?E.bossHp:1) * (elite&&elite.hpMult?elite.hpMult:1))),
    damage: Math.max(1, Math.round(E.dmgBase * Math.pow(g, E.dmgExp) * arch.dmg * (isBoss?E.bossDmg:E.trashDmgMult))),
    attackSpeed: Math.min(E.apsCap, (E.apsBase + tier*E.apsPerTier) * arch.aps * (elite&&elite.apsMult?elite.apsMult:1)),
    evadeChance: arch.evade,
    critChance: E.crit, critMult: E.critMult,
    xpMult: (isBoss?E.bossXp:1) * (elite?elite.xp:1),
    hp:0, statuses:[], meter:0, stunImmune:false,
    actionCount:0, windup:false,
    _defeated:false, _statusKey:''
  };
  e.hp = e.maxHp;
  return e;
}

function enemyTags(e) {
  const out = [];
  if (e.isBoss) out.push('BOSS');
  else if (e.arch && e.arch.tag) out.push(e.arch.tag);
  if (e.elite) out.push(e.elite.tag);
  return out;
}

