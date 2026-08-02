// Character art — sprite tables pointing into assets/
// ---- Character art ----
const BIO_STANCE = 'assets/sprites/bio-stance.png';
const BIO_SPRITES = {
  idle: BIO_STANCE,
  ready: BIO_STANCE,
  strike: 'assets/sprites/bio-strike.png'
};

const PSY_STANCE = 'assets/sprites/psy-stance.png';
const PSY_SPRITES = {
  idle: PSY_STANCE,
  ready: PSY_STANCE,
  strike: 'assets/sprites/psy-strike.png'
};

const BASE_SPRITES = {
  ready: 'assets/sprites/base-ready.png',
  strike: 'assets/sprites/base-strike.png'
};

// Per-skill art for base Sonny, keyed by skill id. Slot a data URI in beside a
// key and that skill wears its own sprite for the beat of its animation:
// attacks instead of the generic "strike" pose, heals and buffs instead of
// standing in "ready". Any key left out just uses the generic pose, so this
// can be filled in one skill at a time.
//
// Kept as a separate assignment purely so the ids stay readable next to each
// other rather than buried after a megabyte of base64.
//
// Ids come straight from CLASSES.base.skills:
// Base has one standing pose, so idle and ready are the same art. Assigned by
// reference rather than embedded twice. Without this, asking for base's idle
// fell through PLAYER_SPRITES (which had no 'base' key) all the way to the bio
// sprite — an unmutated Sonny rendered as a green mutant.
BASE_SPRITES.idle = BASE_SPRITES.ready;

BASE_SPRITES.skills = {
  // jab deliberately absent: the basic Strike IS the generic strike
  // pose above, so it resolves there rather than storing it twice.
  bandage:   'assets/sprites/base-skill-bandage.png',
  counter:   'assets/sprites/base-skill-counter.png',
  laststand: 'assets/sprites/base-skill-laststand.png'
};

// Any strain can do the same; bio/psy/sym simply define no "skills" map yet.

const SYM_STANCE = 'assets/sprites/sym-stance.png';
const SYM_SPRITES = {
  idle: SYM_STANCE,
  ready: SYM_STANCE,
  strike: 'assets/sprites/sym-strike.png'
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
  base: BASE_SPRITES.idle,
};

// Strains with a full pose set (idle/ready/strike). Others fall back to their
// single PLAYER_SPRITES image regardless of pose.
const POSE_SPRITES = { bio: BIO_SPRITES, psy: PSY_SPRITES, sym: SYM_SPRITES, base: BASE_SPRITES };

// Units that pose-swap (idle/ready/strike): players with a strain set, and bosses.
function hasPoseSet(unit) {
  if (!unit) return false;
  if (unit.isPlayer) return !!POSE_SPRITES[unit.class];
  return !!enemyArtSet(unit);
}

// Art for one specific skill, if the strain defines any. A sprite set may carry
// a `skills` map keyed by skill id (see BASE_SPRITES.skills); anything absent
// simply falls back to the generic pose, so a strain with no per-skill art
// behaves exactly as it always did.
function skillArtFor(unit, skill) {
  if (!unit || !unit.isPlayer || !skill) return null;
  const id = skill.id || skill;                       // accepts a skill or its id
  const base = POSE_SPRITES[unit.class] || null;
  return (base && base.skills && base.skills[id]) || null;
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
  const base = POSE_SPRITES[unit.class] || null;
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

