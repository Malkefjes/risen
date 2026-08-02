// Character art — sprite tables pointing into assets/
// ---- Character art ----
// Four poses per strain: `idle` is the strain-select card, `ready` is standing
// in a fight, `strike` is the basic swing, and `skill` is every non-basic press
// (see skillArtFor — the basic deliberately never takes it).
const BIO_SPRITES = {
  idle:   'assets/sprites/bio idle new.png',
  ready:  'assets/sprites/bio ready new.png',
  strike: 'assets/sprites/bio attack new.png',
  skill:  'assets/sprites/bio skill new.png'
};

// OWNER: psy has no attack sprite of its own — the skill art carries both the
// basic swing and every skill.
const PSY_SKILL = 'assets/sprites/psy skill new.png';
const PSY_SPRITES = {
  idle:   'assets/sprites/psy idle new.png',
  ready:  'assets/sprites/psy ready new.png',
  strike: PSY_SKILL,
  skill:  PSY_SKILL
};

const SYM_SPRITES = {
  idle:   'assets/sprites/sym idle new.png',
  ready:  'assets/sprites/sym ready new.png',
  strike: 'assets/sprites/sym attack new.png',
  skill:  'assets/sprites/sym skill new.png'
};

// No idle and no skill art, and neither is missing by accident: base is reached
// through RUN CLEAN rather than a strain card, so nothing ever draws his
// idle, and no skill sprite was made for him. His buttons keep the ready stance.
const BASE_SPRITES = {
  ready:  'assets/sprites/sonny ready new.png',
  strike: 'assets/sprites/sonny attack new.png'
};

// ---- Zone rosters ---------------------------------------------------------
// Each zone fields a LIST of trash types and one boss. makeEnemy stamps every
// enemy with its zone number and its roster id, and spriteSrcFor looks the art
// up from both — so adding a face to a zone is a name in ZONES (js/data.js) and
// an entry here, and nothing else in the game has to know.
//
// A trash type is ART AND A NAME ONLY. All three encampment soldiers share one
// stat line, because they are the same wave-N enemy wearing different faces —
// if one should ever hit differently, that is a design decision to make out
// loud in the enemy table, not something to smuggle in with a sprite.
const EXPERIMENT_STANCE = 'assets/sprites/experiment-stance.png';
const EXPERIMENT_SPRITES = {
  idle: EXPERIMENT_STANCE,
  ready: EXPERIMENT_STANCE,
  strike: 'assets/sprites/experiment-strike.png'
};
const SYMBIOTE_SPRITES = {
  ready: 'assets/sprites/symbiote-ready.png',
  strike: 'assets/sprites/symbiote-strike.png'
};
// The encampment: three soldiers and the Grenadier. Each has a ready stance and
// a strike; `idle` falls back to `ready` in spriteSrcFor, so it is not repeated.
//
// mirror: THE ART IS DRAWN FACING RIGHT and the enemy stands on the right, so
// without this every soldier aims off the edge of the screen away from the
// player. Declared per SET rather than fixed in the files: it costs nothing,
// it is reversible in one word, and it never touches the owner's art — a
// redraw that already faces left just drops the flag. A boolean on purpose,
// not the string 'left'/'right': preloadSprites walks these tables treating
// every string as an image URL, and a word here would be requested as a file.
const ENFORCER_SPRITES = {
  ready: 'assets/sprites/enforcer-ready.png',
  strike: 'assets/sprites/enforcer-strike.png',
  mirror: true
};
const COMBATANT_SPRITES = {
  ready: 'assets/sprites/combatant-ready.png',
  strike: 'assets/sprites/combatant-strike.png',
  mirror: true
};
const RIFLEMAN_SPRITES = {
  ready: 'assets/sprites/rifleman-ready.png',
  strike: 'assets/sprites/rifleman-strike.png',
  mirror: true
};
const GRENADIER_SPRITES = {
  ready: 'assets/sprites/grenadier-ready.png',
  strike: 'assets/sprites/grenadier-strike.png',
  mirror: true
};
// City Streets: the Mercenary on the street and the Brute who runs it.
const MERCENARY_SPRITES = {
  ready: 'assets/sprites/mercenary-ready.png',
  strike: 'assets/sprites/mercenary-strike.png',
  mirror: true
};
const BRUTE_SPRITES = {
  ready: 'assets/sprites/brute-ready.png',
  strike: 'assets/sprites/brute-strike.png',
  mirror: true
};

// trashScale: how big this zone's rank-and-file stands relative to the player.
// A DRAWING HAS A SIZE IT WANTS TO BE READ AT and it is not always eye-to-eye:
// the Escaped Experiment is drawn hunched and heavy, and at 1.0 it read as a
// man rather than as the thing that got out. 1.25 puts it clearly above the
// player and clearly below the boss (1.56), which is the whole ladder — you
// can tell what you are looking at by how much of the arena it takes up.
// Omitted means 1.0. The encampment sat there at first, on the theory that its
// soldiers ARE men and should stand eye to eye — but drawn armoured and narrow
// they read as SMALLER than Sonny rather than equal to him, which is a silhouette
// effect and not a height one (measured: both figures render at exactly the same
// pixel height, and all this art fills 98.5-100% of its own canvas). 1.15 buys
// back the presence the drawing loses to being slim.
const ZONE_SPRITES = {
  1: { trash: { experiment: EXPERIMENT_SPRITES }, boss: SYMBIOTE_SPRITES,
       trashScale: 1.25 },
  2: { trash: { enforcer: ENFORCER_SPRITES, combatant: COMBATANT_SPRITES,
                rifleman: RIFLEMAN_SPRITES },
       boss: GRENADIER_SPRITES, trashScale: 1.15 },
  3: { trash: { mercenary: MERCENARY_SPRITES }, boss: BRUTE_SPRITES,
       trashScale: 1.15 }
};

// The scientist fights in his own coat: his portrait is the stance, and the
// upload beside it is the swing. He is not on any zone's roster — he is reached
// through a scene, not a wave — so he travels as art ON THE UNIT (see artSet
// below) rather than as an entry in the table above.
const SCIENTIST_SPRITES = {
  ready:  'assets/sprites/rogue lab scientist.png',
  strike: 'assets/sprites/rogue lab scientist attack.png'
};

// Last resort when a unit carries no act stamp or an unknown roster id — an old
// save, a hand-built enemy in a tool. The encampment's Enforcer stands in.
const ENEMY_SPRITE = ENFORCER_SPRITES.ready;

// The art set for one enemy: its act's boss, or its act's roster entry.
function enemyArtSet(unit) {
  // A unit may carry its own art. Anything that arrives outside the wave table
  // has nowhere else to declare it.
  if (unit && unit.artSet) return unit.artSet;
  const zone = ZONE_SPRITES[unit && unit.zone];
  if (!zone) return ENFORCER_SPRITES;
  if (unit.isBoss) return zone.boss || GRENADIER_SPRITES;
  const pool = zone.trash || {};
  return pool[unit.rosterId] || Object.values(pool)[0] || ENFORCER_SPRITES;
}

// Does this enemy's art need flipping to face the player? See the `mirror`
// note above. Cosmetic; no rule reads it.
function artMirrored(unit) {
  if (!unit || unit.isPlayer) return false;
  const set = enemyArtSet(unit);
  return !!(set && set.mirror);
}

// The art scale for one foe, as a multiplier on whatever size tier it already
// wears (plain / elite / boss). Purely cosmetic — no rule reads it.
function foeArtScale(unit) {
  if (!unit || unit.isPlayer || unit.isBoss) return 1;
  const roster = ZONE_SPRITES[unit.zone];
  return (roster && roster.trashScale) || 1;
}

const PLAYER_SPRITES = {
  bio: BIO_SPRITES.idle,
  psy: PSY_SPRITES.idle,
  sym: SYM_SPRITES.idle,
  base: BASE_SPRITES.ready,
};

// Strains with a full pose set (idle/ready/strike). Others fall back to their
// single PLAYER_SPRITES image regardless of pose.
const POSE_SPRITES = { bio: BIO_SPRITES, psy: PSY_SPRITES, sym: SYM_SPRITES, base: BASE_SPRITES };

// The art set a unit is wearing right now. NO STRAIN DECLARES `stages` today —
// psy did and will again — so this returns the strain's one set, and the level
// branch below is the seam that makes an evolving strain a data change.
function poseSetFor(unit) {
  const base = POSE_SPRITES[unit && unit.class] || null;
  if (!base || !base.stages) return base;
  const level = (unit && unit.level) || 1;
  let out = base.stages[0];
  base.stages.forEach(st => { if (level >= st.from) out = st; });
  return out;
}

// Units that pose-swap (idle/ready/strike): players with a strain set, and bosses.
function hasPoseSet(unit) {
  if (!unit) return false;
  if (unit.isPlayer) return !!POSE_SPRITES[unit.class];
  return !!enemyArtSet(unit);
}

// Art for a skill press. A set may name one `skill` image for the whole strain,
// and may also carry a `skills` map keyed by skill id for anything that wants
// its own; absent both, the caller falls back to the generic pose.
//
// THE BASIC IS EXCLUDED ON PURPOSE. It is passed down the same path as every
// other press, so without this it would wear the skill art and the attack
// sprites would never be seen.
function skillArtFor(unit, skill) {
  if (!unit || !unit.isPlayer || !skill || skill.basic) return null;
  const id = skill.id || skill;                       // accepts a skill or its id
  // Per-skill art lives on the strain, not on a stage: a skill looks like
  // itself whatever body is casting it.
  const base = POSE_SPRITES[unit.class] || null;
  if (!base) return null;
  return (base.skills && base.skills[id]) || base.skill || null;
}
function hasSkillArt(unit, skill) { return !!skillArtFor(unit, skill); }

// Resolve the sprite src for a unit's current pose. A skill takes precedence
// over the generic pose when the strain has art for it.
function spriteSrcFor(unit, pose, skill) {
  if (!unit.isPlayer) {
    // Trash and bosses both pose-swap; the act and the roster id decide which
    // art, falling back to the set's ready stance for any pose it doesn't
    // define (nothing draws a separate idle for an enemy).
    const set = enemyArtSet(unit);
    return (set && set[pose]) || (set && set.ready) || ENEMY_SPRITE;
  }
  const art = skillArtFor(unit, skill);
  if (art) return art;
  const base = poseSetFor(unit);
  if (base && base[pose]) return base[pose];
  return PLAYER_SPRITES[unit.class] || PLAYER_SPRITES.bio;
}

function makeCharSVG(type, colorClass, pose, unit) {
  pose = pose || 'idle';
  if (colorClass === 'enemy') {
    const src = unit ? spriteSrcFor(unit, pose) : ENEMY_SPRITE;
    return '<img class="char-svg" src="' + src + '" alt="enemy" data-pose="' + pose + '" draggable="false">';
  }
  let src;
  if (unit && unit.isPlayer) {
    src = spriteSrcFor(unit, pose);
  } else {
    const set = POSE_SPRITES[colorClass];
    src = (set && set[pose]) ? set[pose] : (PLAYER_SPRITES[colorClass] || PLAYER_SPRITES.bio);
  }
  return '<img class="char-svg" src="' + src + '" alt="' + colorClass + '" data-pose="' + pose + '" draggable="false">';
}

// `skill` is optional: pass one to show that skill's own art instead of the
// generic pose, when the strain has art for it.
function setCharPose(unit, pose, skill) {
  if (HEADLESS.on) return;
  if (!hasPoseSet(unit)) return;
  const fig = getFigureForUnit(unit);
  if (!fig) return;
  const img = fig.querySelector('img.char-svg');
  if (!img) return;
  const src = spriteSrcFor(unit, pose, skill);
  const key = pose + (skill ? ':' + (skill.id || skill) : '');
  if (img.dataset.pose === key && img.getAttribute('src') === src) return;
  img.src = src;
  img.dataset.pose = key;
}

function renderPreview(id, classId) {
  const el = document.getElementById(id);
  if (!el) return;
  // Bio uses idle only on the strain select screen; combat uses ready/strike.
  el.innerHTML = `
    <div class="char-figure alive">
      ${makeCharSVG('player', classId, 'idle')}
      <div class="ground-shadow"></div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  renderPreview('preview-bio', 'bio');
  renderPreview('preview-psy', 'psy');
  renderPreview('preview-sym', 'sym');
  showBuildVersion();
  loadSettings();
  purgeOldSaves();
  refreshContinueButton();
});


// Sprites load over the network now instead of being inlined; warm the cache at
// boot so the first pose swap in combat does not flicker. Headless never draws,
// but preloading is harmless there — it only touches the image cache.
(function preloadSprites() {
  const seen = new Set();
  const walk = v => {
    if (typeof v === 'string') { if (!seen.has(v)) { seen.add(v); new Image().src = v; } }
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  [ZONE_SPRITES, POSE_SPRITES].forEach(walk);
})();

