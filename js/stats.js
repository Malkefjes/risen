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

// Shed N stacks from a stacking status, removing it when the last one goes.
// The partial sibling of removeStatus, with the same logging duty: DREAD
// easing as the enemy steadies must show in the transcript, or fear would
// look like it evaporates for no reason. Returns how many stacks came off.
function shedStacks(unit, id, n, why) {
  const st = getStatus(unit, id);
  if (!st || !(n > 0)) return 0;
  const shed = Math.min(st.stacks || 1, n);
  st.stacks = (st.stacks || 1) - shed;
  if (st.stacks <= 0) { removeStatus(unit, id, why); }
  else {
    // The delta and what remains, in that order — logging only the label
    // printed the new total ("− DREAD ×3") and read as losing three.
    const def = STATUSES[id];
    logEvent((def ? def.name : id) + ' −' + shed, unit, '(×' + st.stacks + ' left)', [why]);
    updateUnitCard(unit);
  }
  return shed;
}

// `why` names whatever stripped it. Without a line here a status could vanish
// mid-fight with nothing in the transcript to show for it — a purge eating a
// four-stack POISON looked like the rot simply stopped existing.
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
        // WHAT ONE STACK TICKS FOR, when a new stack lands on an old pile. The
        // default is the HIGHEST ever applied, which is right for poison: its
        // per-stack value only ever climbs, and taking the max means a WEAK
        // debuff cannot retroactively thin rot already in the blood.
        //
        // 'newest' exists for bleed, where they deliberately disagree: a cut is
        // as deep as the RESOLVE behind it, so spending that Resolve has to
        // shallow the cuts that come after.
        if (fresh.perStack != null)
          st.perStack = def.perStackRule === 'newest'
            ? fresh.perStack
            : Math.max(st.perStack || 0, fresh.perStack);
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
  if (skill.counterBleed != null) opts.counterBleed = skill.counterBleed;
  if (skill.stacks != null) opts.stacks = skill.stacks;
  if (skill.perStack != null) opts.perStack = skill.perStack;
  if (skill.tickCleanse != null) opts.cleanse = skill.tickCleanse;
  return opts;
}

// Start of a unit's turn: every onTurnStart fires, then everything that runs on
// a clock counts down and expires. Returns true if a tick was lethal, so the
// caller can stop rather than resolve a turn for a corpse.
//
// A MARK TICKS ON THE TURN OF WHOEVER PUT IT THERE. Statuses come in two clocks
// and this is the split: what you are CARRYING (regen, chitin, brace, resolve)
// runs on your own turn, and what has been DONE TO YOU (poison, bleed — anything
// flagged `inflicted`) runs on the turn of whoever did it. tickTurnStart calls
// this twice per turn, once per clock, and `which` says which pass this is.
//
// A single clock metered every ailment by how often its VICTIM acted, which made
// Speed a negative stat for the two classes whose damage is an ailment.
// Durations move with the ticks for the same reason.
function tickStatuses(unit, which) {
  if (!unit || !unit.statuses || !unit.statuses.length) return false;
  // BOTH CLOCKS is a third option, and BLEED is the only thing that wants it:
  // it fires on EVERY turn, yours and theirs, which is what makes a wound burn
  // down twice as fast as a rot does. It is exempt from the duration sweep
  // below because it has no duration — its stack count IS its clock.
  const both = st => !!(STATUSES[st.type] && STATUSES[st.type].bothClocks);
  const mine = which === 'inflicted'
    ? st => both(st) || !!(STATUSES[st.type] && STATUSES[st.type].inflicted)
    : st => both(st) || !(STATUSES[st.type] && STATUSES[st.type].inflicted);
  // Snapshot: a hook may add or remove statuses mid-loop.
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
  kills:0,
  combatActive:false, turnTimer:null,
  // Which save slot the live run writes to. Set when a run starts (claimSaveSlot)
  // or is loaded (continueRun); every saveRun/clearSavedRun targets it.
  saveSlot:1,
  awaitingSpawn:false, awaitingInput:false, active:null, pendingEnemyAct:false,
  // Decisions waiting in the sidebar — recovered items, Modification offers.
  // Neither holds the fight; the run carries on until they are answered
  // (js/items.js, js/mods.js).
  dropQueue:[], modQueue:[],
  combo:0, fightTurns:0, enemyActions:0, bestCombo:0,
  runOver:false, won:false,
  // Turns taken by EITHER side this fight, purely so the log can number them.
  // fightTurns counts only the player's, which makes it the wrong clock for a
  // transcript that has to interleave both.
  turnNo:0,
  runStart:0, damageDealt:0, _defeatLock:false, _lastOverkill:0
};

const P = () => BALANCE.player;
// Two regimes on purpose: level 1 is priced as the HOOK (one kill levels
// you), and the earned curve starts at level 2 — the sighting lives on the
// xp block in BALANCE. (lv - 1) so the curve's first step costs its base
// rather than base plus a head start.
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

// Skill blurbs are templates, not prose: every number in a description is pulled
// straight off the definition that owns it, so a card can never drift from the
// value it describes. Tokens:
//   {key}        raw value              power: 2.2   -> "2.2"
//   {key%}       as a percentage        power: 0.85  -> "85%"
//   {key#noun}   count + plural noun    stun: 1      -> "1 turn", 2 -> "2 turns"
// An unknown key is left in the text on purpose, so a typo is visible instead of
// silently rendering as a blank.
//
// EVERY MECHANIC NAMED ON A CARD WEARS ITS BADGE'S COLOUR — read "+1 BLEED" on
// the card, then find BLEED on the enemy in the same red. A mechanic named here
// but not coloured reads as ordinary prose, which is how DREAD and BLEED went
// unnoticed. The value is the CSS variable suffix, so an entry plus a matching
// `.kw-<x>` rule is the whole cost of adding one; keep it matched to the status'
// `tone` in STATUSES.
const DESC_KEYWORDS = { RESOLVE: 'base', POISON: 'bio', CHITIN: 'bio', WEAK: 'weak',
                        THORNS: 'sym', BLEED: 'bleed', DREAD: 'dread' };
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
  return highlightKeywords(def.desc.replace(/\{([\w.]+)(%|!|\+|#[^}]+)?\}/g, (token, key, mode) => {
    let v = descField(def, key);
    // A FIELD MAY BE A FUNCTION, read off the live sheet. Constants cover most
    // of a card, but some numbers are computed — a cut's depth rides held
    // RESOLVE and moves every turn — and stating the relationship instead of
    // the number ("as deep as the RESOLVE behind it") tells the player nothing
    // they can act on. Menus can render a card with no run in progress, so a
    // computed field with no player falls back to leaving the token alone
    // rather than printing a number from an imaginary sheet.
    if (typeof v === 'function') {
      if (!state.player) return token;
      // The card itself is passed too: a computed field that needs the skill's
      // other numbers (Kill's total reads its own power and per-stack rate)
      // should read them off the card rather than restate them and drift.
      v = v(state.player, def);
    }
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
    // '+' is '!' for healing: the field is a share of the HEAL ANCHOR and the
    // card prints the HP it restores right now. It exists because the honest
    // answer changed — "14% of max HP" was at least a number the player could
    // work out from a bar they can see, and "14% of the heal anchor" is not,
    // so the card states the HP instead. Same read as the heal pipeline, so a
    // card cannot drift from the button. The sign matches the floater
    // vocabulary: healing is a green +.
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

// ---- Player stats -------------------------------------------
function applyDerivedStats(p) {
  if (!p) return p;
  // CLASSES is no longer consulted here: apsBase was the last per-strain
  // number in the derived sheet, and it went when turn rate became a pure stat.
  const B = P();

  p.dmgMult = p.dmgMult || 1;
  p.hpMult  = p.hpMult  || 1;
  p.apsMult = p.apsMult || 1;

  // SUIT HARDWARE FEEDS THE SAME PIPE AS ALLOCATION: effective stats are
  // allocated points plus fitted gear (js/items.js), so every derived rule
  // below just works and item points stack with earned ones transparently.
  const str      = p.str      + gearStat(p, 'str');
  const instinct = p.instinct + gearStat(p, 'instinct');
  const speed    = p.speed    + gearStat(p, 'speed');
  const vit      = p.vit      + gearStat(p, 'vit');

  // ATTACK DAMAGE. One rule for every strain, Unaugmented included: Strength and
  // nothing else. Damage used to come off each strain's own primary, which meant
  // Strength was worth literally nothing to two of the four. 5 damage per point,
  // so the 5 everyone starts with is 25 Attack Damage. There is no per-strain
  // damage weight any more — dmgMult already covers earned multipliers.
  // gearMod('dmgMult') is the Gauntlets implicit and its matching suffix — a
  // percentage on top of what Strength buys, never a replacement for it.
  p.atkPower = str * B.damagePerStr * p.dmgMult * (1 + gearMod(p, 'dmgMult'));

  // TURN RATE. Speed and nothing else, the same shape as damage off Strength and
  // HP off Vitality: 5 Speed is 1.00, one point is +0.20. No per-strain base —
  // every strain starts at the same rate by design, so an additive base could
  // only reintroduce the free head start the anchor removed. A strain that
  // should be fast wants a MULTIPLIER here. Points never saturate; the curve
  // flattens without stopping, and apsCap applies after apsMult as a backstop
  // for that multiplier alone.
  const anchor = BALANCE.player.sheetAnchor * B.apsPerSpeed;
  const above = Math.max(0, speed - BALANCE.player.sheetAnchor);
  const earned = B.apsGain * above / (above + B.apsHalfPoints);
  p.attackSpeed = Math.min(B.apsCap, (anchor + earned) * p.apsMult * (1 + gearMod(p, 'apsBoost')));

  // Max HP is Vitality x 20, full stop. Symbiotic used to take a reduced rate to
  // pay for its thorns; that came out with the flat base and the per-level
  // trickle, because any of the three makes the readout stop being a straight
  // read of the stat above it. If sym needs paying for again, the place is its
  // thorns numbers, not a hidden discount on the shared rule.
  const newMax = Math.max(1, Math.floor(vit * B.hpPerVit * p.hpMult));
  if (p.maxHp > 0 && p.hp != null) {
    // Raising max HP raises current HP with it: what you are MISSING stays
    // constant, so a Vitality point is felt the moment it
    // is taken instead of arriving as empty headroom. It used to preserve the
    // RATIO, which quietly taxed the grant by your missing fraction. A shrink
    // subtracts the same way and clamps at 1. Reloads pass through unchanged:
    // the recomputed max equals the saved max, so the delta is zero.
    p.hp = Math.min(newMax, Math.max(1, p.hp + (newMax - p.maxHp)));
    p.maxHp = newMax;
  } else p.maxHp = newMax;

  // WHAT HEALING IS A SHARE OF, and it is deliberately NOT the line above.
  // The starting bar (5 Vitality x 20 = 100), grown by LEVEL instead of by
  // allocation, so Vitality buys the bar and nothing else. The full argument,
  // and the measurements that forced it, live under healAnchorPerLevel in
  // BALANCE — this is only the arithmetic.
  //
  // Read through healAnchorFor(), never directly: REGEN is a unit-generic
  // status and an enemy carrying it has no anchor to read.
  p.healAnchor = Math.max(1, Math.floor(
    BALANCE.player.sheetAnchor * B.hpPerVit * p.hpMult *
    (1 + Math.max(0, (p.level || 1) - 1) * (B.healAnchorPerLevel || 0))
  ));

  // THE THREE DEFENSIVE LAYERS, one curve, one K — see the block above
  // defenseK. Gear adds to the reduction directly and the cap is a backstop.
  const K = B.defenseK || 45, cap = B.defenseCap || 0.90;
  const layer = (pts, mod) => Math.min(cap, pts / (pts + K) + gearMod(p, mod));
  p.armor   = layer(str, 'armor');        // every hit
  p.evasion = layer(speed, 'evasion');    // ordinary swings
  p.read    = layer(instinct, 'read');    // telegraphed heavies
  // Vitality's faucet: a share of the anchor per turn, from points above the
  // starting sheet only.
  p.regen = Math.max(0, vit - BALANCE.player.sheetAnchor) * (B.regenPerVit || 0);
  p.critChance = Math.min(B.critCap, B.critBase + instinct*B.critPerInstinct + gearMod(p, 'critCh'));
  // CRIT DAMAGE CLIMBS WITH THE SAME POINTS, from point one rather than as an
  // overflow past the chance cap. Both terms rising at once is what makes
  // Instinct quadratic and what lets it reach Strength at all — the balance
  // header carries the arithmetic. No cap of its own and it needs none: Instinct
  // is the only source, the chance it multiplies is capped, and points past that
  // cap keep landing here, so overinvestment bends instead of hitting a wall.
  p.critMult = B.critMultBase + instinct * (B.critMultPerInstinct || 0) + gearMod(p, 'critDmg');

  // A fifth of Attack Damage and a twentieth of max HP — both already carry
  // dmgMult / hpMult through those two, so neither is applied again here.
  // Rounded rather than floored: at these fractions the result is exact, and
  // rounding keeps it exact if the anchors ever stop being multiples of 5.
  const ailmentDmg = Math.max(1, Math.round(attackDamage(p) * B.ailmentDamageFrac));
  p.poisonPerStack = p.class === 'bio'
    ? Math.max(1, ailmentDmg) : 0;
  // THORNS IS THE ONE DERIVED NUMBER THAT REMEMBERS. Everything else on this
  // sheet is a pure function of the stats above it, recomputed from scratch —
  // thorns is stat-derived PLUS p.thornsGrown, a raw value the run accumulates
  // by being hit (see growThorns). The innate share of max HP is the floor Shed
  // can never eat into, so a sym who has spent everything is still spiky; the
  // grown part is the class.
  // Grown minus torn-this-fight: Shed's cost is per-fight (the offset clears
  // at the next spawn), so the run's ramp is read here but never reduced.
  p.thorns = p.class === 'sym'
    ? Math.max(0, Math.round((p.maxHp * B.thornsFrac
        + Math.max(0, (p.thornsGrown || 0) - (p.thornsShedded || 0))))) : 0;

  // ---- Ailments ----
  // What one stack of each ticks for. There is no CHANCE beside them: both
  // apply on every landed basic that carries them, so the row could only ever
  // read 100% or 0% and never moved.
  p.poisonDamage = p.poisonPerStack;
  // What a cut opened RIGHT NOW would tick for. Live rather than baked, because
  // the depth rides held RESOLVE — the readout has to move when the number it
  // depends on moves, or the sheet would disagree with the next Strike.
  p.bleedDamage = bleedDepth(p);
  return p;
}

// HOW DEEP A CUT GOES: the ailment base, deepened by the RESOLVE behind the
// swing. Snapshotted into the stack at application (perStackRule 'newest'), so
// spending Resolve costs you the depth of every wound you open afterwards.
// Non-base strains still get a number rather than a zero — it is what a stack
// WOULD tick for, the same way crit damage reads while crit chance is 0.
// HOW MANY STACKS ONE CUT OPENS. See bleedBase / bleedPerStr in BALANCE for why
// it can never go near 1: the pile loses two a turn-cycle.
function bleedStacks(p) {
  if (!p) return 1;
  const B = P();
  const per = B.bleedPerStr || 5;
  return Math.max(1, (B.bleedBase || 2) + Math.floor(((p.str || 0) + gearStat(p, 'str')) / per));
}

// STRENGTH'S SECOND TERM, the same shape for every strain: one extra stack per
// N Strength on top of whatever the card plants. See the block above
// poisonPerStr in BALANCE for the measurement that forced it. Gear Strength
// counts, exactly as it does for bleedStacks.
function strBonusStacks(p, per) {
  if (!p || !(per > 0)) return 0;
  return Math.floor(((p.str || 0) + gearStat(p, 'str')) / per);
}
// bio: what one application of a POISON skill actually plants.
function poisonStacks(p, skill) {
  const base = (skill && skill.poison) || 1;
  return Math.max(1, base + strBonusStacks(p, P().poisonPerStr));
}
// psy: what one application of a DREAD skill actually plants.
function dreadStacks(p, skill) {
  const base = (skill && skill.dread) || 1;
  return Math.max(1, base + strBonusStacks(p, P().dreadPerStr));
}

function bleedDepth(p) {
  if (!p) return 1;
  const B = P();
  const ail = Math.max(1, Math.round(attackDamage(p) * B.ailmentDamageFrac));
  const held = p.class === 'base' ? statusStacks(p, 'resolve') : 0;
  return Math.max(1, Math.round(ail * (1 + held * (B.bleedPerResolve || 0))));
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

// THE ONE READ FOR EVERY HEAL IN THE GAME. Every "% of max HP" in a kit, a
// status or a between-fight trickle goes through here instead of touching
// unit.maxHp, which is what stops Vitality from quietly owning most of the
// game's effective health (see healAnchorPerLevel in BALANCE).
//
// Enemies fall through to their own bar on purpose: the anchor is a fact about
// the player sheet. Damage-proportional healing (lifesteal, thorns-feed) never
// comes here — those are shares of a blow, not of a body.
function healAnchorFor(unit) {
  if (!unit) return 1;
  if (!unit.isPlayer) return unit.maxHp;
  // A fitted healBoost mod lands here, the one read every anchored heal makes.
  return Math.max(1, Math.floor((unit.healAnchor || unit.maxHp) * (1 + gearMod(unit, 'healBoost'))));
}

// Rolls a heal crit and returns the MULTIPLIER, so a caller can price the whole
// heal before spending anything on it — which is what lets a crit Shed cost
// FEWER thorns instead of overhealing with the same handful. Math.random, not
// cosmeticRandom: this moves HP. Enemies never crit-heal; the vampiric elite's
// lifesteal is already a share of a blow it landed.
function healCritMult(unit) {
  if (!unit || !unit.isPlayer) return 1;
  const chance = Math.min(1, Math.max(0, unit.critChance || 0));
  return Math.random() < chance ? (BALANCE.player.critHealMult || 1) : 1;
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
  // Held RESOLVE, now that it is a status rather than a row of pips. The pips
  // were the only place the count was ever written down; without a row here the
  // sidebar would be the one pane that cannot answer "how much do I have".
  if (p.class === 'base') {
    const held = statusStacks(p, 'resolve');
    return { id:'strain', label:'Resolve', text: formatNum(held), num: held };
  }
  // NO PSY ROW, for the same reason bio has none. The other two strain rows
  // answer "how much do I have" about a number worn on the PLAYER — thorns,
  // held Resolve — which nothing else on screen reports. DREAD is worn on the
  // ENEMY, where its count is already a badge under their health bar, so the
  // row could only restate the per-stack rates: three percentages that never
  // move, in a pane whose every other entry is a live value off the sheet.
  // Constants belong on the cards that spend them, not in the readout.
  return null;
}
function guardReadout(p) {
  if (p.class !== 'base') return null;
  return { id:'guard', label:'Per Resolve', text: '\u2212' + Math.round(P().resolveDR*100) + '% taken' };
}

// Rows carry a `num` (and its unit) as well as their text wherever a difference
// between two sheets means something, so a delta can be reported as the amount
// it ADDS \u2014 "+15" \u2014 rather than as the value it would become. Rows with no
// sensible number (Per Resolve) simply omit it and fall back to
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
  // Ailments — what one stack of each ticks for.
  rows.push(
    { id:'bleeddmg',   text: formatNum(p.bleedDamage) + '/turn', num: p.bleedDamage, unit:'/turn' },
    { id:'poisondmg',  text: formatNum(p.poisonDamage) + '/turn', num: p.poisonDamage, unit:'/turn' }
  );
  rows.push(
    // MAX HP, not current. This is a sheet number sitting beside two other
    // sheet numbers (attack damage, turn rate), and the delta was always on max
    // anyway — showing "122 / 160" put a live value under a preview that meant
    // the ceiling. What you have right now is on the bar over the sprite.
    { id:'hp',    text: formatNum(Math.floor(p.maxHp)), num: Math.floor(p.maxHp) },
    pct('armor', p.armor),
    pct('evasion', p.evasion),
    pct('read', p.read),
    { id:'regen', text: p.regen > 0 ? formatNum(Math.floor(healAnchorFor(p) * p.regen)) + '/turn' : '\u2014',
      num: Math.floor(healAnchorFor(p) * p.regen), unit:'/turn' }
  );
  const g = guardReadout(p); if (g) rows.push(g);
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

// ---- Enemy stats (fully independent of the player's formulas) ----
function makeEnemy(wave) {
  const E = BALANCE.enemy;
  const zone = zoneForWave(wave);
  // DIFFICULTY IS ZONE-LOCAL. Each zone retraces the tier curve from its own
  // floor (zone.growthMult), at its own steepness if it declares one — see
  // the note on ZONES for why one curve cannot span the whole run.
  // Tier, and everything that hangs off it (growth, rank, rate), counts
  // from the zone's first wave; only XP income keeps the global count.
  const w = wave - zone.startWave;
  const tier = Math.floor(w/5), within = w%5;
  // Rate alone counts from the RUN's start — see the apsPerTier note. Rank and
  // growth stay zone-local so each roster still debuts plain at its own floor.
  const rateTier = Math.floor((wave - 1) / 5);
  const g = Math.pow(zone.tierGrowth || E.tierGrowth, tier)
          * (1 + within*(zone.withinStep != null ? zone.withinStep : E.withinStep))
          * (zone.growthMult || 1);
  // WHICH WAVES ARE BOSSES. Zones 1-3 keep the flat rule — one boss, on the
  // zone's tenth. A zone with `bossSegment` (the endgame) instead guarantees
  // one on every segment boundary and lets any other wave roll an extra, so
  // the stretch has a floor and no ceiling. The roll is the FIRST draw
  // makeEnemy takes on those waves; both paths run this code, so the stream
  // stays identical.
  let isBoss;
  if (zone.bossSegment) {
    const inZone = wave - zone.startWave + 1;
    isBoss = (inZone % zone.bossSegment === 0)
          || (Math.random() < (zone.extraBossChance || 0));
  } else {
    isBoss = wave % BALANCE.bossEvery === 0;
  }
  // The first boss only — see firstBossMult in BALANCE.enemy.
  const bossBump = (isBoss && wave === BALANCE.bossEvery) ? (BALANCE.enemy.firstBossMult || 1) : 1;
  const isFinal = wave === BALANCE.finalWave;

  // A ZONE'S CHAMPION IS A GUARANTEED ELITE, so the stretch between bosses has a
  // landmark instead of only a dice roll. Its AFFIX is still rolled: the fight
  // is one you learn the shape of without learning the answer.
  // The wave-4 gate is deliberately GLOBAL: only the run's opening ramp is
  // elite-free, not the start of every act.
  const champ = (!isBoss && zone.champion && zone.champion.at === wave) ? zone.champion : null;
  let elite = null;
  if (!isBoss && (champ || wave > 4)) {
    const keys = Object.keys(ELITES);
    // A zone may run hotter than the table's default — the endgame does.
    const chance = Math.min(zone.eliteChanceCap != null ? zone.eliteChanceCap : E.eliteChanceCap,
      (zone.eliteBaseChance != null ? zone.eliteBaseChance : E.eliteBaseChance)
        + wave*E.eliteChancePerWave);
    if (champ || Math.random() < chance) {
      elite = ELITES[keys[Math.floor(Math.random()*keys.length)]];
    }
  }

  // RANK, not level. Levels are the player's growth currency and nobody
  // else's; giving enemies the same word would promise a comparison ("level 5
  // vs level 5 is fair") that every future retune would then have to honor.
  // Rank is the enemy's own scale and it is HONEST: it is the tier, which is
  // exactly where an enemy changes weight class (the tier jump lands right
  // after each boss). Act-local like the tier, so every roster debuts plain
  // and earns its numerals — the Enforcer walks in as Enforcer, not as "IV".
  // The numeral list has to outlast the longest zone: a 30-wave zone reaches
  // rank VI, and a five-entry table printed " undefined" past V.
  const rank = tier + 1;
  const NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const rankTag = rank > 1 ? ' ' + (NUMERALS[rank] || rank) : '';

  // WHICH FACE OF THE ROSTER. Rotated by wave rather than rolled, for two
  // reasons. It touches no RNG at all, so adding a second trash type to an act
  // cannot shift a single rules draw and desync a seeded replay — and a wave's
  // identity is then STABLE: reload a save mid-act and the same soldier is
  // standing there, where a roll would swap him for a different one.
  // Boss waves consume a slot in the rotation, which is why the cycle is not
  // perfectly even; that is cosmetic and not worth code to avoid.
  // A zone may declare `randomRoster` and draw instead of rotate — see the
  // endgame's note in ZONES for what that trades away.
  const pool = zone.enemies || [{ id: 'trash', name: zone.enemyName }];
  const face = champ || (zone.randomRoster
    ? pool[Math.floor(Math.random() * pool.length)]
    : pool[((w % pool.length) + pool.length) % pool.length]);
  // NO RANK NUMERAL ON A CHAMPION. Rank says which weight class a face is in on
  // its second and third outing; a champion only ever appears once, so a numeral
  // would be claiming a history it does not have.
  const name = champ ? champ.name : (isBoss ? zone.bossName : face.name) + rankTag;

  const e = {
    id: 'enemy-' + wave + '-' + Math.floor(Math.random()*99999),
    name, class:'enemy', isPlayer:false, isBoss, isFinal, elite, rank,
    champion: !!champ,     // the zone's named elite — read by the drop table
    // THE FIGHT'S QUESTION (see ENEMY_VERBS): bosses carry their zone's
    // authored verb, champions roll one. Trash never carries one.
    // A zone whose bosses are rolled rather than authored rolls their question
    // too — the endgame's Reclaimers are one face asking a different thing.
    verb: isBoss
        ? (zone.rollBossVerb
            ? CHAMPION_VERBS[Math.floor(Math.random() * CHAMPION_VERBS.length)]
            : (zone.bossVerb || null))
        : champ ? CHAMPION_VERBS[Math.floor(Math.random() * CHAMPION_VERBS.length)]
        : null,
    zone: zone.num,        // which zone's roster (and art) this enemy belongs to
    rosterId: face.id,     // which face of that roster — art only, never a rule
    windupEvery: isBoss ? (isFinal ? E.finalWindupEvery : E.windupEvery) : (elite ? E.eliteWindupEvery : 0),
    // Pools ride hpExp, damage rides dmgExp — see the note on hpExp for why
    // the two are deliberately different exponents on the same growth factor.
    // A zone may override either, and may scale damage and tempo outright:
    // that trio is how a zone gets HARDER without getting LONGER, which is the
    // only shape of difficulty worth adding (see the endgame's note in ZONES).
    maxHp: Math.max(1, Math.round(E.hpBase
      * Math.pow(g, zone.hpExp != null ? zone.hpExp : (E.hpExp != null ? E.hpExp : 1))
      * (isBoss?E.bossHp:1) * bossBump * (elite&&elite.hpMult?elite.hpMult:1))),
    damage: Math.max(1, Math.round(E.dmgBase * Math.pow(g, E.dmgExp)
      * (zone.dmgMult || 1) * (isBoss?E.bossDmg:E.trashDmgMult) * bossBump)),
    attackSpeed: Math.min(E.apsCap, (E.apsBase + rateTier*E.apsPerTier)
      * (zone.apsMult || 1) * (isBoss?E.bossAps:1) * (elite&&elite.apsMult?elite.apsMult:1)),
    evadeChance: 0,
    critChance: E.crit, critMult: E.critMult,
    xpMult: (isBoss?E.bossXp:1) * (elite?elite.xp:1),
    hp:0, statuses:[], meter:0, stunImmune:false,
    actionCount:0, windup:false,
    _defeated:false, _statusKey:''
  };
  e.hp = e.maxHp;
  return e;
}

// ?plates — display-only dev flag: every enemy panel shows the full plate set
// (boss + all elites) so their colors can be judged side by side. Rules never
// read this; an enemy still HAS whatever it rolled.
const DEV_ALL_PLATES = typeof location !== 'undefined' && /[?&]plates\b/.test(location.search);
function enemyTags(e) {
  if (DEV_ALL_PLATES)
    return ['BOSS'].concat(Object.values(ELITES).map(el => el.tag));
  const out = [];
  if (e.isBoss) out.push('BOSS');
  if (e.elite) out.push(e.elite.tag);
  // The verb is worn as a plate like an affix: the question is announced
  // before the first swing, never discovered mid-fight.
  if (e.verb && ENEMY_VERBS[e.verb]) out.push(ENEMY_VERBS[e.verb].tag);
  return out;
}

