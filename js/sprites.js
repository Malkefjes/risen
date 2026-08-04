const BIO_SPRITES = {
  idle:   'assets/sprites/bio idle new.png',
  ready:  'assets/sprites/bio ready new.png',
  strike: 'assets/sprites/bio attack new.png',
  skill:  'assets/sprites/bio skill new.png'
};

const PSY_SKILL = 'assets/sprites/psy skill new.png';
const PSY_SPRITES = {
  idle:   'assets/sprites/psy idle new.png',
  ready:  'assets/sprites/psy ready new.png',
  strike: PSY_SKILL,
  skill:  PSY_SKILL
};

const HYD_SPRITES = {
  idle:   'assets/sprites/hyd idle.png',
  ready:  'assets/sprites/hyd ready.png',
  strike: 'assets/sprites/hyd attack.png',
  skill:  'assets/sprites/hyd skill.png'
};

const SYM_SPRITES = {
  idle:   'assets/sprites/sym idle new.png',
  ready:  'assets/sprites/sym ready new.png',
  strike: 'assets/sprites/sym attack new.png',
  skill:  'assets/sprites/sym skill new.png'
};

const BASE_SPRITES = {
  ready:  'assets/sprites/sonny ready new.png',
  strike: 'assets/sprites/sonny attack new.png'
};

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

const ENFORCER_SPRITES = {
  ready: 'assets/sprites/mcp enforcer ready new.png',
  strike: 'assets/sprites/mcp enforcer attack new.png',
  mirror: true
};

const LIEUTENANT_SPRITES = {
  ready: 'assets/sprites/mcp liutenant ready.png',
  strike: 'assets/sprites/mcp liutenant attack.png',
  mirror: true
};

const CAPTAIN_SPRITES = {
  ready: 'assets/sprites/mcp captain ready update.png',
  strike: 'assets/sprites/mcp captain attack new.png',
  mirror: true
};

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

const MCP_TROOPER_SPRITES  = { ready: 'assets/sprites/enemy 1.png', mirror: true };
const MCP_MEDIC_SPRITES    = { ready: 'assets/sprites/enemy 2.png', mirror: true };
const MCP_DEMO_SPRITES     = { ready: 'assets/sprites/enemy 3.png', mirror: true };
const MCP_SENTINEL_SPRITES = { ready: 'assets/sprites/enemy 4.png', mirror: true };

const MCP_RECLAIMER_SPRITES = { ready: 'assets/sprites/boss enemy.png', mirror: true };

const ZONE_SPRITES = {
  1: { trash: { experiment: EXPERIMENT_SPRITES }, boss: SYMBIOTE_SPRITES,
       trashScale: 1.25 },
  2: { trash: { enforcer: ENFORCER_SPRITES, lieutenant: LIEUTENANT_SPRITES },
       boss: CAPTAIN_SPRITES, trashScale: 1.15 },
  3: { trash: { mercenary: MERCENARY_SPRITES }, boss: BRUTE_SPRITES,
       trashScale: 1.15 },
  4: { trash: { trooper: MCP_TROOPER_SPRITES, medic: MCP_MEDIC_SPRITES,
                demo: MCP_DEMO_SPRITES, sentinel: MCP_SENTINEL_SPRITES },
       boss: MCP_RECLAIMER_SPRITES, trashScale: 1.15 }
};

const SCIENTIST_SPRITES = {
  ready:  'assets/sprites/rogue lab scientist.png',
  strike: 'assets/sprites/rogue lab scientist attack.png'
};

const ENEMY_SPRITE = ENFORCER_SPRITES.ready;

function enemyArtSet(unit) {

  if (unit && unit.artSet) return unit.artSet;
  const zone = ZONE_SPRITES[unit && unit.zone];
  if (!zone) return ENFORCER_SPRITES;
  if (unit.isBoss) return zone.boss || CAPTAIN_SPRITES;
  const pool = zone.trash || {};
  return pool[unit.rosterId] || Object.values(pool)[0] || ENFORCER_SPRITES;
}

function artMirrored(unit) {
  if (!unit || unit.isPlayer) return false;
  const set = enemyArtSet(unit);
  return !!(set && set.mirror);
}

function foeArtScale(unit) {
  if (!unit || unit.isPlayer || unit.isBoss) return 1;
  const roster = ZONE_SPRITES[unit.zone];
  return (roster && roster.trashScale) || 1;
}

const PLAYER_SPRITES = {
  bio: BIO_SPRITES.idle,
  psy: PSY_SPRITES.idle,
  sym: SYM_SPRITES.idle,
  hyd: HYD_SPRITES.idle,
  base: BASE_SPRITES.ready,
};

const POSE_SPRITES = { bio: BIO_SPRITES, psy: PSY_SPRITES, sym: SYM_SPRITES, hyd: HYD_SPRITES, base: BASE_SPRITES };

function poseSetFor(unit) {
  const base = POSE_SPRITES[unit && unit.class] || null;
  if (!base || !base.stages) return base;
  const level = (unit && unit.level) || 1;
  let out = base.stages[0];
  base.stages.forEach(st => { if (level >= st.from) out = st; });
  return out;
}

function hasPoseSet(unit) {
  if (!unit) return false;
  if (unit.isPlayer) return !!POSE_SPRITES[unit.class];
  return !!enemyArtSet(unit);
}

function skillArtFor(unit, skill) {
  if (!unit || !unit.isPlayer || !skill || skill.basic) return null;
  const id = skill.id || skill;

  const base = POSE_SPRITES[unit.class] || null;
  if (!base) return null;
  return (base.skills && base.skills[id]) || base.skill || null;
}
function hasSkillArt(unit, skill) { return !!skillArtFor(unit, skill); }

function spriteSrcFor(unit, pose, skill) {
  if (!unit.isPlayer) {

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
  renderPreview('preview-hyd', 'hyd');
  showBuildVersion();
  loadSettings();
  purgeOldSaves();
  refreshContinueButton();
});

(function preloadSprites() {
  const seen = new Set();
  const walk = v => {
    if (typeof v === 'string') { if (!seen.has(v)) { seen.add(v); new Image().src = v; } }
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  [ZONE_SPRITES, POSE_SPRITES].forEach(walk);
})();
