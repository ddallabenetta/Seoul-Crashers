// Fisica arcade dei veicoli: velocità longitudinale + slittamento laterale.
// Il grip laterale governa il drift; il freno a mano lo azzera quasi del tutto.
import { VEHICLE_TYPES } from '../render/sprites.js';
import { circleRectPush, clamp, sign, TAU } from '../core/math.js';

let nextId = 1;

// Gravità lungo il muso, in px/s² per unità di pendenza. Su una salita del 10%
// vale ~78 px/s², cioè un terzo abbondante dell'accelerazione di una berlina.
const SLOPE_G = 780;
const MAX_SLOPE = 0.14;

// Volo. La quota è in pixel e vive nella stessa proiezione dei palazzi: a `z` 210
// un velivolo passa sopra tutta Seoul tranne le torri di Gangnam e la N Seoul Tower,
// che restano solide — ed è quello che rende il volo una scorciatoia, non un cheat.
const GRAV_AIR = 210;   // caduta quando l'ala non porta più
const HARD_LANDING = 150; // px/s di caduta oltre i quali si rompe qualcosa

export function createVehicle(kind, x, y, angle = 0, colorIndex = 0) {
  const spec = VEHICLE_TYPES[kind] || VEHICLE_TYPES.sedan;
  return {
    id: nextId++,
    kind,
    x, y, angle,
    z: 0,      // quota: 0 = a terra o in acqua
    vz: 0,
    climb: 0,  // comando di salita/discesa, -1..1
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
    flatTires: false, // gomme squarciate dai chiodi della polizia
    flatPull: 0,
  };
}

/** Cerchi di collisione lungo l'asse longitudinale. */
export function collisionCircles(v, spec = VEHICLE_TYPES[v.kind]) {
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
  return spec.topSpeed * (v.hp < spec.hp * 0.4 ? 0.75 : 1) * (v.flatTires ? 0.6 : 1);
}

/** Un velivolo è "in volo" quando ha staccato: sopra questa quota niente lo tocca. */
export function airborne(v) {
  return v.z > 6;
}

/**
 * Quota di sommità di un solido. Serve solo al volo: un velivolo attraversa quello
 * che gli passa sotto e si schianta su quello che gli sta davanti.
 */
function solidTop(s) {
  if (s.prop) return s.prop.z || 0;
  return (s.h3d || 0) + (s.elev || 0);
}

export function updateVehicle(v, dt, world) {
  const spec = VEHICLE_TYPES[v.kind];
  // In sosta o all'ormeggio e non toccata da nessuno: resta immobile.
  if ((v.spot || v.moored) && !v.awake && v.driver === null && !v.dead) {
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

  if (spec.air) {
    updateAircraft(v, spec, dt, world);
    return;
  }

  const top = vehicleTopSpeed(v);
  const throttle = clamp(v.throttle, -1, 1);
  // Asfalto bagnato: è l'unico effetto del meteo che si sente col volante in
  // mano, ed è la ragione per cui la pioggia non è solo una decorazione. Resta
  // volutamente modesto: il traffico civile frena a distanze tarate a secco
  // (§5.10 dell'HANDOFF) e non sa che piove — raddoppiare lo spazio di frenata
  // rimetterebbe in strada i tamponamenti che sono costati una sessione.
  const wet = !spec.marine && world && world.dayCycle ? world.dayCycle.wet : 0;

  // Accelerazione / frenata
  if (throttle > 0.01) {
    const boost = v.speed < 0 ? 2.2 : 1; // frenata da retro più decisa
    v.speed += spec.accel * throttle * boost * dt;
  } else if (throttle < -0.01) {
    if (v.speed > 6) {
      v.speed += spec.accel * throttle * 2.1 * (1 - wet * 0.14) * dt; // freno
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
  const elev = !spec.marine && world && world.city && world.city.elevationAt;
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
  // Gomme a terra (chiodi): tira da un lato e non si tiene la traiettoria.
  if (v.flatTires) v.angle += v.flatPull * speedFrac * dt;
  if (v.angle > Math.PI) v.angle -= TAU;
  if (v.angle < -Math.PI) v.angle += TAU;

  // Il vettore velocità insegue la direzione del muso: la differenza è il drift
  const cos = Math.cos(v.angle);
  const sin = Math.sin(v.angle);
  const targetVx = cos * v.speed;
  const targetVy = sin * v.speed;
  const grip = (v.handbrake ? 1.5 : 8.5) * spec.grip * (v.flatTires ? 0.72 : 1) * (1 - wet * 0.17);
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

/**
 * Velivoli. A terra si rullano come un mezzo goffo e si scontrano con tutto; in
 * volo restano solo i palazzi più alti della quota. Le due differenze fra rotore
 * e ala sono tutte qui: il rotore stacca da fermo e **tiene la quota da solo**
 * (in una visuale dall'alto un elicottero che cala mentre miri è ingiocabile),
 * l'ala pretende di aver preso velocità e scende se la perde.
 */
function updateAircraft(v, spec, dt, world) {
  const top = spec.topSpeed;
  const throttle = clamp(v.throttle, -1, 1);
  const flying = airborne(v);
  const rotor = spec.air === 'rotor';

  if (throttle > 0.01) v.speed += spec.accel * throttle * dt;
  else if (throttle < -0.01) v.speed += spec.accel * throttle * (v.speed > 20 ? 1.6 : 0.5) * dt;
  else v.speed -= sign(v.speed) * Math.min(Math.abs(v.speed), (flying ? 26 : 60) * dt);
  v.speed *= 1 - (flying ? 0.2 : 0.5) * dt;
  v.speed = clamp(v.speed, rotor ? -top * 0.3 : -top * 0.1, top);

  // Imbardata. In volo l'elicottero gira anche fermo (è il suo mestiere), l'ala no.
  const speedAbs = Math.abs(v.speed);
  const auth = flying && rotor ? 1 : Math.min(1, speedAbs / (flying ? 150 : 70));
  const rate = (rotor ? 1.5 : 0.85) * (1 - 0.45 * Math.min(1, speedAbs / top));
  v.angle += v.steer * rate * auth * sign(flying ? 1 : (v.speed || 1)) * dt;
  if (v.angle > Math.PI) v.angle -= TAU;
  if (v.angle < -Math.PI) v.angle += TAU;

  // Quota. `climb` è il comando; il resto è portanza o mancanza di portanza.
  const canLift = rotor || speedAbs > spec.rotate;
  if (v.climb > 0.01 && canLift && v.z < spec.ceiling) v.vz += spec.climb * 2.6 * dt;
  else if (v.climb < -0.01) v.vz -= spec.climb * 2.6 * dt;
  else if (flying) {
    // Senza comando: l'elicottero resta dov'è, l'ala plana e cade se è in stallo.
    const hold = rotor || speedAbs > spec.rotate * 0.8;
    v.vz += (hold ? -v.vz * 3.4 : -GRAV_AIR) * dt;
  }
  v.vz = clamp(v.vz, -spec.climb * 2.2, spec.climb * 1.6);
  // Effetto suolo: chi *sceglie* di scendere si posa, sempre. A rompere il carrello
  // dev'essere la caduta — motore piantato o discesa non comandata — non l'atterraggio
  // normale, che altrimenti costerebbe un terzo della fusoliera ogni volta.
  if (v.climb < -0.01 && v.vz < 0 && v.z < 60) v.vz = Math.max(v.vz, -HARD_LANDING + 10);
  v.z += v.vz * dt;
  if (v.z > spec.ceiling) { v.z = spec.ceiling; v.vz = Math.min(0, v.vz); }

  // Traiettoria: in volo il muso comanda quasi tutto, ma un filo di inerzia
  // laterale serve a far *sentire* la virata.
  const cos = Math.cos(v.angle);
  const sin = Math.sin(v.angle);
  const grip = (flying ? 2.6 : 8.5) * spec.grip;
  const k = 1 - Math.exp(-grip * dt);
  v.vx += (cos * v.speed - v.vx) * k;
  v.vy += (sin * v.speed - v.vy) * k;
  v.slip = 0;
  v.x += v.vx * dt;
  v.y += v.vy * dt;

  if (v.z <= 0) {
    // Atterraggio: sotto i 150 px/s di caduta non succede niente, sopra si paga.
    if (v.vz < -HARD_LANDING) {
      const dmg = (-v.vz - HARD_LANDING) * 0.5;
      v.hp -= dmg;
      if (world && world.onVehicleImpact) world.onVehicleImpact(v, -v.vz);
    }
    v.z = 0;
    v.vz = 0;
    // Un velivolo che tocca l'acqua è finito: non è una barca.
    if (world && world.city && world.city.isWater(v.x, v.y)) sink(v, dt, world);
    else resolveVehicleCollisions(v, spec, world, dt);
  } else {
    resolveAirCollisions(v, spec, world);
  }

  if (v.hp <= 0 && !v.dead) {
    v.dead = true;
    if (world.onVehicleDestroyed) world.onVehicleDestroyed(v);
  }
  if (v._hit) {
    v.speed = cos * v.vx + sin * v.vy;
    v._hit = false;
  }
}

/** In volo contano solo i solidi più alti della quota: il resto passa sotto. */
function resolveAirCollisions(v, spec, world) {
  if (!world || !world.city) return;
  const pad = spec.len;
  const solids = world.city.solidGrid.queryRect(v.x - pad, v.y - pad, pad * 2, pad * 2);
  const r = spec.wid * 0.4;
  for (const s of solids) {
    if (s.vehicleOnly || solidTop(s) < v.z + 8) continue;
    const push = circleRectPush(v.x, v.y, r, s);
    if (!push) continue;
    v.x += push.nx * push.depth;
    v.y += push.ny * push.depth;
    applyImpact(v, push.nx, push.ny, 0, world);
  }
}

/**
 * Un mezzo di terra finito in acqua. Non esplode: si pianta, cala e sparisce —
 * e chi era al volante annega. Serve a rendere l'acqua un confine vero adesso
 * che il mare e il fiume sono grandi quanto un quarto della mappa.
 */
function sink(v, dt, world) {
  v.sinkT = (v.sinkT || 0) + dt;
  v.speed *= 1 - 2.6 * dt;
  v.vx *= 1 - 2.6 * dt;
  v.vy *= 1 - 2.6 * dt;
  if (v.sinkT > 0.75 && !v.sunk) {
    v.sunk = true;
    if (world.onVehicleSunk) world.onVehicleSunk(v);
  }
}

/**
 * Imbarcazioni: la terraferma è il muro. Si campiona l'acqua attorno al punto
 * asciutto e si spinge da quella parte — bastano tre punti sullo scafo, e il
 * campo `isWater` conosce già ponti e moli.
 */
function resolveMarine(v, spec, world, dt) {
  const city = world.city;
  const cos = Math.cos(v.angle);
  const sin = Math.sin(v.angle);
  const half = spec.len * 0.44;
  const probes = [
    { x: v.x + cos * half, y: v.y + sin * half, at: 1 },
    { x: v.x, y: v.y, at: 0 },
    { x: v.x - cos * half, y: v.y - sin * half, at: -1 },
  ];
  for (const p of probes) {
    if (city.isWater(p.x, p.y)) continue;
    let nx = 0;
    let ny = 0;
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      if (city.isWater(p.x + Math.cos(ang) * 46, p.y + Math.sin(ang) * 46)) {
        nx += Math.cos(ang);
        ny += Math.sin(ang);
      }
    }
    const l = Math.hypot(nx, ny);
    if (l < 0.001) {
      // Incastrata a secco: si ferma e basta, senza sapere da che parte tornare.
      v.vx *= 1 - 6 * dt;
      v.vy *= 1 - 6 * dt;
      v.speed *= 1 - 6 * dt;
      continue;
    }
    nx /= l;
    ny /= l;
    v.x += nx * 190 * dt;
    v.y += ny * 190 * dt;
    applyImpact(v, nx, ny, p.at, world);
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

  if (spec.marine) {
    // Per una barca non esistono edifici: esiste la riva.
    resolveMarine(v, spec, world, dt);
  } else {
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
    // Fuoristrada nel senso peggiore: un mezzo di terra in acqua affonda.
    if (!spec.air && world.city.isWater(v.x, v.y)) sink(v, dt, world);
    else if (v.sinkT) v.sinkT = 0;
  }

  // Veicolo contro veicolo: tre cerchi per scafo, altrimenti due auto in colonna
  // si compenetrano di mezza lunghezza.
  if (world.vehicleGrid) {
    const others = world.vehicleGrid.queryCircle(v.x, v.y, spec.len + 60);
    for (const o of others) {
      // `vehicleGrid` è piatta: non sa niente di quota. Senza questa riga la prima
      // berlina che passa sotto un elicottero in volo lo prende in pieno.
      if (o === v || airborne(o)) continue;
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
