// Armi e risoluzione dei colpi.
//
// Tutte le bocche da fuoco sono hitscan: a 500-900 px di gittata un proiettile
// vero arriverebbe comunque nello stesso frame, e il tracciante disegnato si legge
// meglio di uno sprite che vola. I proiettili veri li vogliono solo gli esplosivi
// (`thrown: true`), che volano lenti e in alto: lì il tempo di volo *è* l'arma, e
// li gestisce `projectiles.js`.
import { VEHICLE_TYPES } from '../render/sprites.js';
import { PROJ } from '../render/camera.js';
import { angleDiff, clamp, wrapAngle } from '../core/math.js';

// spread è in radianti di deviazione standard; rate è il tempo fra due colpi.
// `slot` è la fila della barra armi (tasto 1-6): dentro una fila si scorre premendo
// di nuovo lo stesso tasto. `driveby: false` = non si usa dal finestrino.
export const WEAPONS = {
  fists: {
    id: 'fists', label: 'pugni', hangul: '맨주먹', melee: true, slot: 0,
    damage: 15, rate: 0.34, range: 36, arc: 1.15, knock: 130, infinite: true,
  },
  bat: {
    id: 'bat', label: 'mazza', hangul: '방망이', melee: true, slot: 0,
    damage: 46, rate: 0.52, range: 50, arc: 1.35, knock: 260, infinite: true,
  },
  katana: {
    id: 'katana', label: 'katana', hangul: '일본도', melee: true, slot: 0,
    damage: 92, rate: 0.4, range: 64, arc: 1.55, knock: 230, infinite: true,
  },
  pistol: {
    id: 'pistol', label: 'pistola', hangul: '권총', slot: 1,
    damage: 27, rate: 0.22, range: 640, spread: 0.028, pellets: 1,
    shake: 1.6, maxAmmo: 180, pickup: 34,
  },
  shotgun: {
    id: 'shotgun', label: 'pompa', hangul: '산탄총', slot: 2,
    damage: 13, rate: 0.84, range: 330, spread: 0.105, pellets: 8,
    shake: 4.4, knock: 210, maxAmmo: 60, pickup: 14,
  },
  smg: {
    id: 'smg', label: 'SMG', hangul: '기관단총', auto: true, slot: 3,
    damage: 15, rate: 0.075, range: 520, spread: 0.075, pellets: 1,
    shake: 1.1, maxAmmo: 420, pickup: 90,
  },
  rifle: {
    id: 'rifle', label: 'fucile d\'assalto', hangul: '돌격소총', auto: true, slot: 3,
    damage: 24, rate: 0.105, range: 780, spread: 0.042, pellets: 1,
    shake: 2, maxAmmo: 300, pickup: 75, driveby: false,
  },
  // Il mirino (tasto destro) allarga il campo inquadrato invece di stringerlo: in
  // una visuale dall'alto "zoomare" su un bersaglio a 1500 px vorrebbe dire non
  // vederlo proprio. `pierce` è quello che rende la palla da cecchino diversa da
  // una pallottola grossa: passa da parte a parte e prende chi c'è dietro.
  sniper: {
    id: 'sniper', label: 'fucile di precisione', hangul: '저격총', slot: 4,
    damage: 145, rate: 1.35, range: 1900, spread: 0.004, pellets: 1, pierce: 2,
    shake: 6.5, maxAmmo: 30, pickup: 8, scope: 2.3, driveby: false,
  },
  minigun: {
    id: 'minigun', label: 'minigun', hangul: '미니건', auto: true, slot: 4,
    damage: 12, rate: 0.045, range: 660, spread: 0.115, pellets: 1,
    shake: 1.4, maxAmmo: 600, pickup: 180, spinUp: 0.8, heavy: 0.56, driveby: false,
  },
  // Esplosivi: `thrown` li manda a `projectiles.js`. `fuse: 0` significa "esplode
  // (o si rompe) al primo contatto".
  molotov: {
    id: 'molotov', label: 'molotov', hangul: '화염병', slot: 5, thrown: true,
    rate: 1.05, range: 460, fuse: 0, shake: 3,
    fire: { r: 78, life: 9.5, dps: 26 }, maxAmmo: 20, pickup: 5,
  },
  grenade: {
    id: 'grenade', label: 'granata', hangul: '수류탄', slot: 5, thrown: true,
    rate: 1, range: 480, fuse: 2.2, shake: 3,
    blast: { r: 155, dmg: 190 }, maxAmmo: 20, pickup: 5,
  },
  mine: {
    id: 'mine', label: 'mina', hangul: '지뢰', slot: 5, thrown: true, placed: true,
    rate: 0.85, range: 60, shake: 0,
    blast: { r: 140, dmg: 220 }, maxAmmo: 10, pickup: 3,
  },
};

// Barra armi: una fila per tasto (1-6). Ripremendo il tasto si scorre la fila —
// da cinque armi in su i tasti singoli non bastano più, e una rotella sola su
// undici voci è ingiocabile.
export const WEAPON_SLOTS = [
  ['fists', 'bat', 'katana'],
  ['pistol'],
  ['shotgun'],
  ['smg', 'rifle'],
  ['sniper', 'minigun'],
  ['molotov', 'grenade', 'mine'],
];

// Ordine della rotella: la barra letta da sinistra a destra.
export const WEAPON_ORDER = WEAPON_SLOTS.flat();

const PED_HIT_R = 11;
const PLAYER_HIT_R = 10;

// --- geometria dei raggi -----------------------------------------------------

/** Primo t>=0 in cui il raggio entra nell'AABB, oppure null (metodo delle slab). */
function rayAabb(ox, oy, dx, dy, r) {
  let tmin = 0;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-8) {
    if (ox < r.x || ox > r.x + r.w) return null;
  } else {
    let t1 = (r.x - ox) / dx;
    let t2 = (r.x + r.w - ox) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
  }
  if (Math.abs(dy) < 1e-8) {
    if (oy < r.y || oy > r.y + r.h) return null;
  } else {
    let t1 = (r.y - oy) / dy;
    let t2 = (r.y + r.h - oy) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
  }
  if (tmax < tmin) return null;
  return tmin;
}

/** Primo t>=0 in cui il raggio tocca il cerchio, oppure null. */
function rayCircle(ox, oy, dx, dy, cx, cy, rad) {
  const mx = ox - cx;
  const my = oy - cy;
  const b = mx * dx + my * dy;
  const c = mx * mx + my * my - rad * rad;
  if (c > 0 && b > 0) return null;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t < 0 ? 0 : t;
}

/** I tre cerchi di ingombro di un veicolo, gli stessi usati dalla fisica. */
function vehicleCircles(v, spec, out) {
  const cos = Math.cos(v.angle);
  const sin = Math.sin(v.angle);
  const r = spec.wid * 0.46;
  const half = spec.len * 0.5 - r * 0.75;
  out[0] = v.x + cos * half; out[1] = v.y + sin * half;
  out[2] = v.x; out[3] = v.y;
  out[4] = v.x - cos * half; out[5] = v.y - sin * half;
  return r;
}

const _circ = new Float64Array(6);

/**
 * Traccia un raggio nel mondo e restituisce il primo bersaglio incontrato.
 * `ignore` è l'entità che spara (e il suo veicolo), che non deve auto-colpirsi.
 * `skip` è l'insieme di chi il raggio ha già trapassato (proiettili perforanti).
 */
export function rayCast(game, ox, oy, dx, dy, maxDist, ignore = null, ignoreVehicle = null, skip = null) {
  let bd = maxDist;
  let hit = null;
  let type = null;

  const ex = ox + dx * maxDist;
  const ey = oy + dy * maxDist;
  const qx = Math.min(ox, ex) - 30;
  const qy = Math.min(oy, ey) - 30;
  const qw = Math.abs(ex - ox) + 60;
  const qh = Math.abs(ey - oy) + 60;

  // Muri, edifici e arredo solido. I solidi `vehicleOnly` (gradini, transenne)
  // fermano le auto ma non i proiettili: si spara sopra.
  for (const s of game.city.solidGrid.queryRect(qx, qy, qw, qh)) {
    if (s.vehicleOnly) continue;
    const t = rayAabb(ox, oy, dx, dy, s);
    if (t !== null && t < bd) { bd = t; hit = s; type = 'solid'; }
  }

  for (const p of game.pedGrid.queryRect(qx, qy, qw, qh)) {
    if (p === ignore || p.dead || (skip && skip.has(p))) continue;
    const t = rayCircle(ox, oy, dx, dy, p.x, p.y, PED_HIT_R);
    if (t !== null && t < bd) { bd = t; hit = p; type = 'ped'; }
  }

  for (const v of game.vehicleGrid.queryRect(qx, qy, qw, qh)) {
    if (v === ignoreVehicle || (skip && skip.has(v))) continue;
    const spec = VEHICLE_TYPES[v.kind];
    const r = vehicleCircles(v, spec, _circ);
    for (let i = 0; i < 6; i += 2) {
      const t = rayCircle(ox, oy, dx, dy, _circ[i], _circ[i + 1], r);
      if (t !== null && t < bd) { bd = t; hit = v; type = 'vehicle'; }
    }
  }

  const pl = game.player;
  if (ignore !== pl && pl.onFoot && !pl.dying) {
    const t = rayCircle(ox, oy, dx, dy, pl.x, pl.y, PLAYER_HIT_R);
    if (t !== null && t < bd) { bd = t; hit = pl; type = 'player'; }
  }

  // Elicottero: si colpisce dove lo si *vede*, cioè alla sua posizione proiettata.
  // In una visuale 2.5D mirare alla sua verticale a terra sarebbe incomprensibile.
  const chop = game.police && game.police.chopper;
  if (chop && ignore === pl) {
    const f = chop.z / PROJ;
    const cx = chop.x + (chop.x - game.camera.cx) * f;
    const cy = chop.y + (chop.y - game.camera.cy) * f;
    const t = rayCircle(ox, oy, dx, dy, cx, cy, 24);
    if (t !== null && t < bd) { bd = t; hit = chop; type = 'chopper'; }
  }

  return { dist: bd, x: ox + dx * bd, y: oy + dy * bd, hit, type };
}

/** Linea di tiro libera fra due punti (solo muri). */
export function hasLineOfSight(game, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const qx = Math.min(ax, bx) - 8;
  const qy = Math.min(ay, by) - 8;
  for (const s of game.city.solidGrid.queryRect(qx, qy, Math.abs(dx) + 16, Math.abs(dy) + 16)) {
    if (s.vehicleOnly) continue;
    const t = rayAabb(ax, ay, dx / len, dy / len, s);
    if (t !== null && t < len - 4) return false;
  }
  return true;
}

/**
 * Magnetismo di mira: la direzione richiesta viene piegata di pochi gradi verso
 * il bersaglio più allineato al cursore. Senza, con la parallasse 2.5D e i pedoni
 * larghi 20 px, mancare uno a 400 px è la norma; con un aggancio duro, invece,
 * si smette di mirare del tutto.
 */
const ASSIST_WINDOW = 0.17; // cono di ricerca (~10°)
const ASSIST_BEND = 0.09;   // correzione massima (~5°)

export function assistAim(game, ox, oy, ang, maxDist, ignore = null) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const ex = ox + dx * maxDist;
  const ey = oy + dy * maxDist;
  let bestDev = Infinity;
  let bestScore = -Infinity;
  for (const p of game.pedGrid.queryRect(
    Math.min(ox, ex) - 40, Math.min(oy, ey) - 40, Math.abs(ex - ox) + 80, Math.abs(ey - oy) + 80
  )) {
    if (p === ignore || p.dead) continue;
    const d = Math.hypot(p.x - ox, p.y - oy);
    if (d > maxDist || d < 12) continue;
    const dev = angleDiff(ang, Math.atan2(p.y - oy, p.x - ox));
    if (Math.abs(dev) > ASSIST_WINDOW) continue;
    if (!hasLineOfSight(game, ox, oy, p.x, p.y)) continue;
    // Chi ti sta sparando addosso ha la precedenza sul passante che gli sta dietro.
    const score = (p.hostile ? 2 : 0) - Math.abs(dev) * 4 - d / 4000;
    if (score > bestScore) { bestScore = score; bestDev = dev; }
  }
  if (bestDev === Infinity) return ang;
  return wrapAngle(ang + clamp(bestDev, -ASSIST_BEND, ASSIST_BEND));
}

// --- fuoco -------------------------------------------------------------------

/** Deviazione gaussiana (Box-Muller ridotto): la coda larga è la sensazione giusta. */
function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
}

/**
 * Spara un colpo (o una rosa) dalla posizione data. `owner` è chi spara: serve a
 * non colpirsi da soli e a decidere chi si prende la colpa del cadavere.
 */
export function shoot(game, owner, spec, ox, oy, ang, opts = {}) {
  const spreadMul = opts.spreadMul || 1;
  const fromPlayer = owner === game.player;
  const ignoreVehicle = opts.ignoreVehicle || null;

  game.fx.addMuzzle(ox, oy, ang);
  for (let i = 0; i < (spec.pellets || 1); i++) {
    const a = ang + gauss() * spec.spread * spreadMul;
    const dx = Math.cos(a);
    const dy = Math.sin(a);

    // Un colpo perforante non è un colpo che fa più danno: è un colpo che *non si
    // ferma*. Si rilancia il raggio da dove ha trapassato, tenendo memoria di chi
    // ha già bucato, finché non finisce la perforazione o la gittata.
    let x = ox, y = oy;
    let left = spec.range;
    let pierce = spec.pierce || 0;
    const passed = pierce ? new Set() : null;

    for (;;) {
      const h = rayCast(game, x, y, dx, dy, left, owner, ignoreVehicle, passed);
      game.fx.addTracer(x, y, h.x, h.y, fromPlayer);

      switch (h.type) {
        case 'ped':
          game.damagePed(h.hit, spec.damage, dx, dy, owner, spec.knock || 0);
          break;
        case 'player':
          game.damagePlayer(spec.damage, dx, dy, owner);
          break;
        case 'vehicle':
          // La lamiera assorbe: servono parecchi colpi per far saltare un'auto.
          game.damageVehicle(h.hit, spec.damage * 0.55, h.x, h.y, owner);
          // Un po' di piombo passa dal finestrino: sotto inseguimento restare in
          // macchina non deve essere gratis.
          if (h.hit.driver === 'player' && !fromPlayer) game.damagePlayer(spec.damage * 0.16, dx, dy);
          break;
        case 'chopper':
          game.police.damageChopper(spec.damage, game);
          game.fx.addSparks(h.x, h.y, -dx, -dy, 4);
          break;
        default:
          game.fx.addSparks(h.x, h.y, -dx, -dy, 3);
          game.fx.addDust(h.x, h.y, -dx * 30, -dy * 30, 2);
      }

      // Solo la carne si trapassa: un muro ferma anche il calibro grosso.
      if (pierce <= 0 || h.type !== 'ped') break;
      pierce--;
      passed.add(h.hit);
      left -= h.dist + 3;
      if (left < 20) break;
      x = h.x + dx * 3;
      y = h.y + dy * 3;
    }
  }
  game.alarm(ox, oy, 460, owner);
}

/** Colpo in mischia: cono davanti al personaggio, il primo bersaglio incassa. */
export function meleeSwing(game, owner, spec, ox, oy, ang) {
  const fromPlayer = owner === game.player;
  game.fx.addSwing(ox, oy, ang, spec.range);
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);

  let target = null;
  let bestD = spec.range;
  for (const p of game.pedGrid.queryCircle(ox, oy, spec.range + 16)) {
    if (p === owner || p.dead) continue;
    const d = Math.hypot(p.x - ox, p.y - oy);
    if (d > spec.range + PED_HIT_R) continue;
    if (Math.abs(angleDiff(ang, Math.atan2(p.y - oy, p.x - ox))) > spec.arc / 2) continue;
    if (d < bestD) { bestD = d; target = p; }
  }
  const pl = game.player;
  if (!fromPlayer && pl.onFoot && !pl.dying) {
    const d = Math.hypot(pl.x - ox, pl.y - oy);
    if (d < spec.range + PLAYER_HIT_R
      && Math.abs(angleDiff(ang, Math.atan2(pl.y - oy, pl.x - ox))) <= spec.arc / 2) {
      game.damagePlayer(spec.damage, cos, sin, owner);
      return true;
    }
  }
  if (target) {
    game.damagePed(target, spec.damage, cos, sin, owner, spec.knock);
    return true;
  }

  // Niente pedoni: si prende a mazzate la carrozzeria.
  for (const v of game.vehicleGrid.queryCircle(ox, oy, spec.range + 60)) {
    if (v === owner) continue;
    const spec2 = VEHICLE_TYPES[v.kind];
    const r = vehicleCircles(v, spec2, _circ);
    for (let i = 0; i < 6; i += 2) {
      const d = Math.hypot(_circ[i] - ox, _circ[i + 1] - oy);
      if (d > spec.range + r) continue;
      if (Math.abs(angleDiff(ang, Math.atan2(_circ[i + 1] - oy, _circ[i] - ox))) > spec.arc / 2) continue;
      game.damageVehicle(v, spec.damage * 0.5, ox + cos * spec.range, oy + sin * spec.range, owner);
      v.awake = true;
      return true;
    }
  }
  return false;
}
