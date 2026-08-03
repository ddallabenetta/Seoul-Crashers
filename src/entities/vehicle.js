// Fisica arcade dei veicoli: velocità longitudinale + slittamento laterale.
// Il grip laterale governa il drift; il freno a mano lo azzera quasi del tutto.
import { VEHICLE_TYPES } from '../render/sprites.js';
import { circleRectPush, clamp, sign, TAU } from '../core/math.js';

let nextId = 1;

// Gravità lungo il muso, in px/s² per unità di pendenza. Su una salita del 10%
// vale ~78 px/s², cioè un terzo abbondante dell'accelerazione di una berlina.
const SLOPE_G = 780;
const MAX_SLOPE = 0.14;

export function createVehicle(kind, x, y, angle = 0, colorIndex = 0) {
  const spec = VEHICLE_TYPES[kind] || VEHICLE_TYPES.sedan;
  return {
    id: nextId++,
    kind,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    steer: 0,
    throttle: 0,
    handbrake: false,
    braking: false,
    lightsOn: false,
    siren: false,
    hp: spec.hp,
    maxHp: spec.hp,
    dead: false,
    burning: 0,
    colorIndex,
    driver: null, // 'player' | 'ai' | null
    ai: null,
    honkT: 0,
    lastHitT: 0,
    slip: 0,
  };
}

/** Cerchi di collisione lungo l'asse longitudinale. */
function collisionCircles(v, spec) {
  const cos = Math.cos(v.angle);
  const sin = Math.sin(v.angle);
  const r = spec.wid * 0.46;
  const half = spec.len * 0.5 - r * 0.75;
  return [
    { x: v.x + cos * half, y: v.y + sin * half, r, at: 1 },
    { x: v.x, y: v.y, r, at: 0 },
    { x: v.x - cos * half, y: v.y - sin * half, r, at: -1 },
  ];
}

export function vehicleTopSpeed(v) {
  const spec = VEHICLE_TYPES[v.kind];
  return spec.topSpeed * (v.hp < spec.hp * 0.4 ? 0.75 : 1);
}

export function updateVehicle(v, dt, world) {
  const spec = VEHICLE_TYPES[v.kind];
  // In sosta e non toccata da nessuno: resta immobile.
  if (v.spot && !v.awake && v.driver === null && !v.dead) {
    v.vx = 0; v.vy = 0; v.speed = 0; v.slip = 0;
    return;
  }
  if (v.dead) {
    v.vx *= 1 - 3 * dt;
    v.vy *= 1 - 3 * dt;
    v.x += v.vx * dt;
    v.y += v.vy * dt;
    v.speed = 0;
    return;
  }

  const top = vehicleTopSpeed(v);
  const throttle = clamp(v.throttle, -1, 1);

  // Accelerazione / frenata
  if (throttle > 0.01) {
    const boost = v.speed < 0 ? 2.2 : 1; // frenata da retro più decisa
    v.speed += spec.accel * throttle * boost * dt;
  } else if (throttle < -0.01) {
    if (v.speed > 6) {
      v.speed += spec.accel * throttle * 2.1 * dt; // freno
      v.braking = true;
    } else {
      v.speed += spec.accel * throttle * 0.75 * dt; // retromarcia
    }
  } else {
    v.braking = false;
    v.speed -= sign(v.speed) * Math.min(Math.abs(v.speed), 42 * dt);
  }
  if (throttle >= -0.01) v.braking = false;

  if (v.handbrake) {
    v.speed -= sign(v.speed) * Math.min(Math.abs(v.speed), 190 * dt);
    v.braking = true;
  }

  // Pendenza: componente longitudinale della gravità. In salita si perde velocità,
  // in discesa si guadagna. Da fermo e senza gas non si applica, altrimenti le auto
  // in coda al semaforo rotolerebbero all'indietro.
  const elev = world && world.city && world.city.elevationAt;
  if (elev && !v.handbrake && (Math.abs(v.speed) > 3 || Math.abs(throttle) > 0.01)) {
    const c0 = Math.cos(v.angle);
    const s0 = Math.sin(v.angle);
    const p = 46;
    const rise = elev(v.x + c0 * p, v.y + s0 * p) - elev(v.x - c0 * p, v.y - s0 * p);
    v.speed -= SLOPE_G * clamp(rise / (2 * p), -MAX_SLOPE, MAX_SLOPE) * dt;
  }

  // Resistenza aerodinamica
  v.speed *= 1 - 0.42 * dt;
  v.speed = clamp(v.speed, -top * 0.42, top);

  // Sterzo: perde efficacia con la velocità, si annulla da fermo
  const speedAbs = Math.abs(v.speed);
  const speedFrac = Math.min(1, speedAbs / top);
  const steerAuth = Math.min(1, speedAbs / 55);
  const rate = 3.0 * (1 - 0.52 * speedFrac) * (v.handbrake ? 1.35 : 1);
  v.angle += v.steer * rate * steerAuth * sign(v.speed || 1) * dt;
  if (v.angle > Math.PI) v.angle -= TAU;
  if (v.angle < -Math.PI) v.angle += TAU;

  // Il vettore velocità insegue la direzione del muso: la differenza è il drift
  const cos = Math.cos(v.angle);
  const sin = Math.sin(v.angle);
  const targetVx = cos * v.speed;
  const targetVy = sin * v.speed;
  const grip = (v.handbrake ? 1.5 : 8.5) * spec.grip;
  const k = 1 - Math.exp(-grip * dt);
  v.vx += (targetVx - v.vx) * k;
  v.vy += (targetVy - v.vy) * k;

  // Componente laterale: alimenta le tracce di gomma e lo stridore
  const lateral = -sin * v.vx + cos * v.vy;
  v.slip = Math.abs(lateral);

  v.x += v.vx * dt;
  v.y += v.vy * dt;

  resolveVehicleCollisions(v, spec, world, dt);

  // Solo dopo un urto la velocità del motore viene riallineata a quella reale:
  // farlo ogni frame smorzerebbe l'accelerazione (il vettore inseguе il muso
  // con un ritardo, e quel ritardo verrebbe sottratto a ogni passo).
  if (v._hit) {
    v.speed = Math.cos(v.angle) * v.vx + Math.sin(v.angle) * v.vy;
    v._hit = false;
  }
}

function applyImpact(v, nx, ny, at, world) {
  const vn = v.vx * nx + v.vy * ny;
  if (vn < 0) {
    v._hit = true;
    const impactAbs = Math.abs(vn);
    // Tamponamento lento: quasi nessun rimbalzo. Schianto: rimbalzo pieno.
    const restitution = Math.min(0.45, 0.04 + impactAbs / 600);
    v.vx -= nx * vn * (1 + restitution);
    v.vy -= ny * vn * (1 + restitution);
    // La coda o il muso rimbalzano: il veicolo ruota
    const cross = Math.cos(v.angle) * ny - Math.sin(v.angle) * nx;
    v.angle += cross * at * Math.min(0.11, impactAbs / 2400);
    const impact = Math.abs(vn);
    if (impact > 60) {
      const dmg = (impact - 60) * 0.09;
      v.hp -= dmg;
      if (world && world.onVehicleImpact) world.onVehicleImpact(v, impact);
    }
  }
}

function resolveVehicleCollisions(v, spec, world, dt) {
  if (!world || !world.city) return;
  const circles = collisionCircles(v, spec);
  const pad = spec.len;
  const solids = world.city.solidGrid.queryRect(v.x - pad, v.y - pad, pad * 2, pad * 2);

  for (const c of circles) {
    for (const s of solids) {
      const push = circleRectPush(c.x, c.y, c.r, s);
      if (!push) continue;
      v.x += push.nx * push.depth;
      v.y += push.ny * push.depth;
      c.x += push.nx * push.depth;
      c.y += push.ny * push.depth;
      applyImpact(v, push.nx, push.ny, c.at, world);
    }
  }

  // Veicolo contro veicolo: tre cerchi per scafo, altrimenti due auto in colonna
  // si compenetrano di mezza lunghezza.
  if (world.vehicleGrid) {
    const others = world.vehicleGrid.queryCircle(v.x, v.y, spec.len + 60);
    for (const o of others) {
      if (o === v) continue;
      const ospec = VEHICLE_TYPES[o.kind];
      if ((o.x - v.x) ** 2 + (o.y - v.y) ** 2 > ((spec.len + ospec.len) * 0.62) ** 2) continue;
      const mine = collisionCircles(v, spec);
      const theirs = collisionCircles(o, ospec);
      const massRatio = ospec.mass / (spec.mass + ospec.mass);

      // Solo la coppia di cerchi più compenetrata viene risolta: sommare tutte
      // le coppie sparava i veicoli via.
      let best = null;
      for (const a of mine) {
        for (const b of theirs) {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const minD = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 > minD * minD || d2 < 1e-4) continue;
          const d = Math.sqrt(d2);
          const overlap = minD - d;
          if (!best || overlap > best.overlap) {
            best = { overlap, nx: -dx / d, ny: -dy / d, at: a.at, bat: b.at };
          }
        }
      }
      if (best) {
        v.x += best.nx * best.overlap * massRatio;
        v.y += best.ny * best.overlap * massRatio;
        o.x -= best.nx * best.overlap * (1 - massRatio);
        o.y -= best.ny * best.overlap * (1 - massRatio);
        applyImpact(v, best.nx, best.ny, best.at, world);
        applyImpact(o, -best.nx, -best.ny, best.bat, world);
        v.awake = true;
        o.awake = true;
      }
    }
  }

  if (v.hp <= 0 && !v.dead) {
    v.dead = true;
    if (world.onVehicleDestroyed) world.onVehicleDestroyed(v);
  }
}

/** Punto di ingresso lato guida (per l'animazione di salita). */
export function vehicleDoorPoint(v) {
  const spec = VEHICLE_TYPES[v.kind];
  const cos = Math.cos(v.angle);
  const sin = Math.sin(v.angle);
  const side = spec.wid * 0.62;
  return { x: v.x - sin * side, y: v.y + cos * side };
}
