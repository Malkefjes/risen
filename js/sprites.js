// Character art — sprite tables pointing into assets/
// ---- Character art ----
const ENEMY_STANCE = 'assets/sprites/enemy-stance.png';
const ENEMY_SPRITES = {
  idle: ENEMY_STANCE,
  ready: ENEMY_STANCE,
  strike: 'assets/sprites/enemy-strike.png'
};
// Single-sprite fallback for callers that just want "the enemy look".
const ENEMY_SPRITE = ENEMY_STANCE;
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

const BOSS_SPRITES = {
  ready: 'assets/sprites/boss-ready.png',
  strike: 'assets/sprites/boss-strike.png'
};

// ---- Act rosters ---------------------------------------------------------
// Each act fields its own trash and boss art; makeEnemy stamps every enemy
// with its act number and spriteSrcFor reads the roster off it. The
// Laboratory's four files currently HOLD PLACEHOLDER COPIES of the
// encampment art — overwrite experiment-stance/strike and
// symbiote-ready/strike in assets/sprites/ with the real drawings and the
// game wears them with no code change.
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
const ACT_SPRITES = {
  1: { trash: EXPERIMENT_SPRITES, boss: SYMBIOTE_SPRITES },
  2: { trash: ENEMY_SPRITES, boss: BOSS_SPRITES }
};

const PLAYER_SPRITES = {
  bio: BIO_SPRITES.idle,
  psy: PSY_SPRITES.idle,
  sym: SYM_SPRITES.idle,
  base: BASE_SPRITES.idle,
};

// Strains with a full pose set (idle/ready/strike). Others fall back to their
// single PLAYER_SPRITES image regardless of pose.
const POSE_SPRITES = { bio: BIO_SPRITES, psy: PSY_SPRITES, sym: SYM_SPRITES, base: BASE_SPRITES };

// Some strains change appearance once they mutate. Keyed by how many mutations
// unlock the look; a mutated set can be partial (e.g. combat + attack only) and
// falls back to the base pose set for anything it doesn't define.
const MUTATED_SPRITES = {};

// Units that pose-swap (idle/ready/strike): players with a strain set, and bosses.
function hasPoseSet(unit) {
  if (!unit) return false;
  if (unit.isPlayer) return !!POSE_SPRITES[unit.class];
  return !!(unit.isBoss ? BOSS_SPRITES : ENEMY_SPRITES);
}

// The mutation tier whose art a player is currently wearing, if any.
function mutatedSetFor(unit) {
  const tiers = MUTATED_SPRITES[unit.class];
  if (!tiers) return null;
  const muts = (unit.talentIds || []).length;
  let chosen = null;
  for (const t of tiers) if (muts >= t.minMutations) chosen = t.set;   // highest matching tier
  return chosen;
}

// Art for one specific skill, if the strain defines any. A sprite set may carry
// a `skills` map keyed by skill id (see BASE_SPRITES.skills); anything absent
// simply falls back to the generic pose, so a strain with no per-skill art
// behaves exactly as it always did.
function skillArtFor(unit, skill) {
  if (!unit || !unit.isPlayer || !skill) return null;
  const id = skill.id || skill;                       // accepts a skill or its id
  const mutated = mutatedSetFor(unit);
  const base = POSE_SPRITES[unit.class] || null;
  return (mutated && mutated.skills && mutated.skills[id])
      || (base && base.skills && base.skills[id])
      || null;
}
function hasSkillArt(unit, skill) { return !!skillArtFor(unit, skill); }

// Resolve the sprite src for a unit's current pose, honoring mutation tier.
// A skill takes precedence over the generic pose when the strain has art for it.
function spriteSrcFor(unit, pose, skill) {
  if (!unit.isPlayer) {
    // Trash and bosses both pose-swap; the act's roster decides which art,
    // falling back to the encampment sets for any unit with no act stamp,
    // and to the set's ready stance for any pose it doesn't define.
    const roster = ACT_SPRITES[unit.act];
    const set = (roster && (unit.isBoss ? roster.boss : roster.trash))
             || (unit.isBoss ? BOSS_SPRITES : ENEMY_SPRITES);
    return (set && set[pose]) || (set && set.ready) || ENEMY_SPRITE;
  }
  const art = skillArtFor(unit, skill);
  if (art) return art;
  const base = POSE_SPRITES[unit.class] || null;
  const chosen = mutatedSetFor(unit);
  if (chosen && chosen[pose]) return chosen[pose];
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
  // Re-check src too: after a mutation the ready sprite changes while the pose
  // name stays 'ready', so a name-only guard would never swap in the new look.
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
  [ENEMY_SPRITES, BOSS_SPRITES, ACT_SPRITES, POSE_SPRITES, MUTATED_SPRITES].forEach(walk);
})();

