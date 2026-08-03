// Pedoni: camminano sull'anello di marciapiede degli isolati, attraversano sulle
// strisce, entrano in panico se un'auto li sfiora e vengono investiti se non fanno in tempo.
import { PED_KINDS } from '../render/sprites.js';
import { SIDEWALK } from '../world/citygen.js';
import { DISTRICT_BY_ID } from '../world/districts.js';
import { angleDiff, approachAngle, clamp, dist, damp, circleRectPush } from '../core/math.js';
import { WEAPONS, shoot, meleeSwing, hasLineOfSight } from './weapons.js';

const BASE_MAX = 62;
// Distanza a cui un teppista armato apre il fuoco, e quella a cui uno disarmato
// smette di correre e comincia a menare.
const GUN_RANGE = 330;
const FIST_RANGE = 34;

/** Anello di streaming: i pedoni nascono appena oltre il bordo dello schermo. */
function ringFor(game) {
  const cam = game.camera;
  const viewR = Math.hypot(cam.viewW, cam.viewH) / (2 * cam.zoom);
  return { min: 0, max: Math.max(viewR + 380, viewR * 1.7), despawn: Math.max(viewR + 760, viewR * 2.4) };
}

/** True se il punto è fuori dal rettangolo inquadrato (con margine). */
function outsideView(game, x, y, margin = 60) {
  const b = game.camera.bounds(margin);
  return x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h;
}


let nextId = 1;

export function createPed(kind, x, y, rng) {
  const k = PED_KINDS[kind] || PED_KINDS.civil;
  // Solo chi reagisce può essere armato: un impiegato che estrae la pistola in
  // mezzo alla folla non è il tono che vogliamo, un teppista di Baekho sì.
  const armed = !!k.fights && rng.chance(0.45);
  return {
    id: nextId++,
    kind,
    x, y,
    angle: rng.range(-3.14, 3.14),
    vx: 0, vy: 0,
    animT: rng.range(0, 8),
    colorIndex: rng.int(0, k.coats.length - 1),
    baseSpeed: k.speed * rng.range(0.85, 1.15),
    state: 'walk',
    block: null,
    side: 0,
    t: 0,
    dirSign: rng.chance(0.5) ? 1 : -1,
    panic: 0,
    idleT: 0,
    hp: k.hp || 30,
    maxHp: k.hp || 30,
    dead: false,
    deadT: 0,
    spin: 0,
    hostile: false,
    armed,
    fireT: 0,
    bleedT: 0,
    crossX: 0,
    crossY: 0,
  };
}

/** Punto centrale del marciapiede per lato/t di un isolato. */
function sidewalkPoint(block, side, t, out = {}) {
  const m = SIDEWALK * 0.78;
  switch (side) {
    case 0: out.x = block.x + t * block.w; out.y = block.y + m; break;
    case 1: out.x = block.x + block.w - m; out.y = block.y + t * block.h; break;
    case 2: out.x = block.x + t * block.w; out.y = block.y + block.h - m; break;
    default: out.x = block.x + m; out.y = block.y + t * block.h; break;
  }
  return out;
}

function sideLength(block, side) {
  return side === 0 || side === 2 ? block.w : block.h;
}

export class PedestrianSystem {
  constructor(city, rng, peds) {
    this.city = city;
    this.rng = rng;
    this.peds = peds;
    this.tmp = {};
    this.spawnTimer = 0;
  }

  update(dt, game) {
    this.stream(dt, game);
    for (const p of this.peds) this.updatePed(p, dt, game);
  }

  /** Riempie i marciapiedi al primo avvio, anche in campo visivo. */
  prewarm(game, count = 60) {
    for (let i = 0; i < count * 4 && this.peds.length < count; i++) {
      this.spawnNear(game.player, game, { min: 60, max: 1200, allowVisible: true });
    }
  }

  stream(dt, game) {
    const pl = game.player;
    const ring = ringFor(game);
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      if (p.dead) {
        p.deadT += dt;
        if (p.deadT > 30) { this.peds.splice(i, 1); continue; }
      }
      if (dist(p.x, p.y, pl.x, pl.y) > ring.despawn) this.peds.splice(i, 1);
    }

    const district = this.city.districtAt(pl.x, pl.y);
    const max = Math.round(BASE_MAX * (district.pedDensity || 1) * game.pedScale);
    this.spawnTimer -= dt;
    if (this.peds.length < max && this.spawnTimer <= 0) {
      this.spawnTimer = 0.06;
      const burst = this.peds.length < max * 0.6 ? 3 : 1;
      for (let i = 0; i < burst; i++) this.spawnNear(pl, game, ring);
    }
  }

  spawnNear(pl, game, ring = ringFor(game)) {
    const rng = this.rng;
    const r = ring.max;
    const blocks = this.city.blockGrid.queryRect(pl.x - r, pl.y - r, r * 2, r * 2);
    if (!blocks.length) return null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const block = rng.pick(blocks);
      if (!block || (block.type === 'dock' && rng.chance(0.6))) continue;
      const side = rng.int(0, 3);
      const t = rng.next();
      const pt = sidewalkPoint(block, side, t, {});
      const d = dist(pt.x, pt.y, pl.x, pl.y);
      if (d > ring.max || d < ring.min) continue;
      if (!ring.allowVisible && !outsideView(game, pt.x, pt.y, 40)) continue;
      // Mai far comparire un pedone sotto le ruote di qualcuno.
      if (game.vehicleGrid) {
        const cars = game.vehicleGrid.queryCircle(pt.x, pt.y, 46);
        if (cars.some((v) => !v.spot)) continue;
      }
      const district = DISTRICT_BY_ID[block.district] || DISTRICT_BY_ID.hongdae;
      const ped = createPed(rng.pick(district.pedMix), pt.x, pt.y, rng);
      ped.block = block;
      ped.side = side;
      ped.t = t;
      if (rng.chance(0.12)) {
        ped.state = 'idle';
        ped.idleT = rng.range(2, 9);
      }
      this.peds.push(ped);
      return ped;
    }
    return null;
  }

  updatePed(p, dt, game) {
    if (p.dead) {
      // Ragdoll povero ma efficace: scivola, gira su se stesso e lascia la scia.
      p.vx = damp(p.vx, 0, 0.12, dt);
      p.vy = damp(p.vy, 0, 0.12, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.spin = damp(p.spin, 0, 0.1, dt);
      if (p.deadT < 0.8 && Math.random() < 0.3) game.fx.addBlood(p.x, p.y, 0.5);
      return;
    }
    if (p.bleedT > 0) {
      p.bleedT -= dt;
      if (Math.random() < 0.25) game.fx.addBlood(p.x, p.y, 0.25);
    }

    // Pericolo: veicoli veloci nei paraggi
    const threats = game.vehicleGrid.queryCircle(p.x, p.y, 130);
    for (const v of threats) {
      const sp = Math.hypot(v.vx, v.vy);
      if (sp < 70) continue;
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const d = Math.hypot(dx, dy);
      // Solo se il veicolo sta puntando verso il pedone
      const towards = (v.vx * dx + v.vy * dy) / (sp * (d || 1));
      if (d < 120 && towards > 0.55) {
        p.panic = Math.max(p.panic, 2.4);
        p.fleeFromX = v.x;
        p.fleeFromY = v.y;
      }
      // Investimento
      if (d < 22 && sp > 85) this.knockDown(p, v, game);
    }

    if (p.panic > 0 && !p.hostile) {
      p.panic -= dt;
      p.state = p.panic > 0 ? 'flee' : 'walk';
    }

    let targetSpeed = p.baseSpeed;
    let tx = p.x, ty = p.y;

    switch (p.state) {
      case 'idle': {
        p.idleT -= dt;
        targetSpeed = 0;
        if (p.idleT <= 0) p.state = 'walk';
        break;
      }
      case 'flee': {
        targetSpeed = p.baseSpeed * 2.1;
        const dx = p.x - (p.fleeFromX ?? p.x);
        const dy = p.y - (p.fleeFromY ?? p.y);
        const l = Math.hypot(dx, dy) || 1;
        tx = p.x + (dx / l) * 90;
        ty = p.y + (dy / l) * 90;
        break;
      }
      case 'hostile': {
        const pl = game.player;
        const d = dist(p.x, p.y, pl.x, pl.y);
        const aim = Math.atan2(pl.y - p.y, pl.x - p.x);
        p.fireT -= dt;
        // Chi si è messo al riparo dentro un'auto, o è già lontano, non vale la pena.
        if (!pl.onFoot || pl.dying || d > 900) {
          p.hostile = false;
          p.state = 'walk';
          p.panic = 2;
          break;
        }
        if (p.armed) {
          // Tiene la distanza di tiro, ma solo se un tiro ce l'ha: con un muro in
          // mezzo si sbriga a girarci intorno invece di restare lì a mirare il nulla.
          const los = hasLineOfSight(game, p.x, p.y, pl.x, pl.y);
          const hold = los && d < 130;
          targetSpeed = p.baseSpeed * (!los || d > GUN_RANGE ? 1.7 : hold ? 1.1 : 0.3);
          const reach = hold ? -110 : 110;
          tx = p.x + Math.cos(aim) * reach;
          ty = p.y + Math.sin(aim) * reach;
          if (los && d < GUN_RANGE && p.fireT <= 0) {
            p.fireT = 0.5 + Math.random() * 0.8;
            p.angle = aim;
            shoot(game, p, WEAPONS.pistol, p.x + Math.cos(aim) * 13, p.y + Math.sin(aim) * 13, aim, { spreadMul: 2.8 });
          }
        } else {
          targetSpeed = p.baseSpeed * 1.9;
          tx = pl.x;
          ty = pl.y;
          if (d < FIST_RANGE + 12 && p.fireT <= 0) {
            p.fireT = WEAPONS.fists.rate * 2.4;
            p.angle = aim;
            meleeSwing(game, p, WEAPONS.fists, p.x, p.y, aim);
          }
        }
        break;
      }
      case 'crossing': {
        targetSpeed = p.baseSpeed * 1.45;
        tx = p.crossX;
        ty = p.crossY;
        if (dist(p.x, p.y, tx, ty) < 12) {
          // Si aggancia al marciapiede dell'isolato raggiunto
          const near = this.city.blockGrid.queryRect(p.x - 40, p.y - 40, 80, 80);
          let best = null, bd = Infinity;
          for (const b of near) {
            const cx = clamp(p.x, b.x, b.x + b.w);
            const cy = clamp(p.y, b.y, b.y + b.h);
            const d = dist(p.x, p.y, cx, cy);
            if (d < bd) { bd = d; best = b; }
          }
          if (best) {
            p.block = best;
            const side = this.nearestSide(best, p.x, p.y);
            p.side = side;
            p.t = this.tOnSide(best, side, p.x, p.y);
            p.state = 'walk';
          } else {
            p.state = 'walk';
          }
        }
        break;
      }
      default: {
        if (!p.block) {
          const near = this.city.blockGrid.queryRect(p.x - 200, p.y - 200, 400, 400);
          if (near.length) {
            p.block = near[0];
            p.side = this.nearestSide(p.block, p.x, p.y);
            p.t = this.tOnSide(p.block, p.side, p.x, p.y);
          }
          break;
        }
        const len = sideLength(p.block, p.side);
        p.t += (p.dirSign * targetSpeed * dt) / Math.max(1, len);
        if (p.t > 1 || p.t < 0) {
          // Angolo dell'isolato: gira, oppure attraversa la strada
          const wantCross = this.rng.chance(0.16);
          if (wantCross && this.crossingIsSafe(p, game)) {
            this.startCrossing(p);
          } else {
            const turn = p.t > 1 ? 1 : -1;
            p.side = (p.side + (p.dirSign > 0 ? turn : turn) + 4) % 4;
            p.t = p.t > 1 ? 0.02 : 0.98;
            if (this.rng.chance(0.18)) p.dirSign *= -1;
          }
        }
        p.t = clamp(p.t, 0, 1);
        const pt = sidewalkPoint(p.block, p.side, p.t, this.tmp);
        tx = pt.x;
        ty = pt.y;
        if (this.rng.chance(0.0016)) {
          p.state = 'idle';
          p.idleT = this.rng.range(1.5, 6);
        }
        break;
      }
    }

    // Steering verso il punto obiettivo
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5 && targetSpeed > 1) {
      // Stessa pendenza dei veicoli, molto più leggera: in salita si arranca.
      const el = this.city.elevationAt;
      if (el) {
        const slope = (el(tx, ty) - el(p.x, p.y)) / d;
        targetSpeed *= clamp(1 - slope * 3.2, 0.62, 1.3);
      }
      const nvx = (dx / d) * targetSpeed;
      const nvy = (dy / d) * targetSpeed;
      p.vx = damp(p.vx, nvx, 0.07, dt);
      p.vy = damp(p.vy, nvy, 0.07, dt);
    } else {
      p.vx = damp(p.vx, 0, 0.08, dt);
      p.vy = damp(p.vy, 0, 0.08, dt);
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 4) {
      p.angle = approachAngle(p.angle, Math.atan2(p.vy, p.vx), 10 * dt);
      p.animT += sp * dt * 0.2;
    }

    // Non attraversano i muri. I solidi `vehicleOnly` (le scalinate) sì: sono
    // fatti apposta per lasciar passare chi va a piedi.
    if (p.state === 'flee' || p.state === 'crossing' || p.state === 'hostile') {
      const solids = this.city.solidGrid.queryRect(p.x - 24, p.y - 24, 48, 48);
      for (const s of solids) {
        if (s.vehicleOnly) continue;
        const push = circleRectPush(p.x, p.y, 7, s);
        if (!push) continue;
        p.x += push.nx * push.depth;
        p.y += push.ny * push.depth;
      }
    }
  }

  /**
   * Danno a un pedone. `dx,dy` è la direzione del colpo: decide lo schizzo e la
   * spinta. Chi sa reagire (teppisti, poliziotti) si volta contro il giocatore,
   * tutti gli altri scappano.
   */
  hurt(p, dmg, dx, dy, game, source, knock = 0) {
    if (p.dead) return;
    p.hp -= dmg;
    game.fx.addBloodSpray(p.x, p.y, dx, dy, clamp(dmg / 30, 0.4, 1.5));
    p.vx += dx * (knock || 45);
    p.vy += dy * (knock || 45);
    if (p.hp <= 0) {
      this.kill(p, dx, dy, game, source);
      return;
    }
    p.bleedT = 0.4;
    if (source === game.player && PED_KINDS[p.kind]?.fights) {
      p.hostile = true;
      p.state = 'hostile';
      p.panic = 0;
    } else {
      p.panic = Math.max(p.panic, 5);
      p.fleeFromX = p.x - dx * 90;
      p.fleeFromY = p.y - dy * 90;
      p.state = 'flee';
    }
  }

  kill(p, dx, dy, game, source) {
    p.dead = true;
    p.deadT = 0;
    p.hostile = false;
    p.vx += dx * 95;
    p.vy += dy * 95;
    p.spin = (Math.random() - 0.5) * 9;
    game.fx.addBlood(p.x, p.y, 1.3);
    game.onPedKilled?.(p, null, Math.hypot(p.vx, p.vy), source);
  }

  /**
   * Uno sparo (o una rissa) si sente: chi è nel raggio scappa. I teppisti che
   * sono vicini al giocatore, invece, se la legano al dito.
   */
  alarm(x, y, r, game, source) {
    const r2 = r * r;
    const near2 = (r * 0.55) ** 2;
    for (const p of this.peds) {
      if (p.dead || p.hostile) continue;
      const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d2 > r2) continue;
      if (source === game.player && PED_KINDS[p.kind]?.fights && d2 < near2) {
        p.hostile = true;
        p.state = 'hostile';
        continue;
      }
      p.panic = Math.max(p.panic, 3.5);
      p.fleeFromX = x;
      p.fleeFromY = y;
      p.state = 'flee';
    }
  }

  nearestSide(b, x, y) {
    const dTop = Math.abs(y - b.y);
    const dBottom = Math.abs(b.y + b.h - y);
    const dLeft = Math.abs(x - b.x);
    const dRight = Math.abs(b.x + b.w - x);
    const min = Math.min(dTop, dBottom, dLeft, dRight);
    if (min === dTop) return 0;
    if (min === dRight) return 1;
    if (min === dBottom) return 2;
    return 3;
  }

  tOnSide(b, side, x, y) {
    if (side === 0 || side === 2) return clamp((x - b.x) / b.w, 0, 1);
    return clamp((y - b.y) / b.h, 0, 1);
  }

  /** Guarda se arriva qualcuno prima di scendere dal marciapiede. */
  crossingIsSafe(p, game) {
    if (!game.vehicleGrid) return true;
    const near = game.vehicleGrid.queryCircle(p.x, p.y, 190);
    for (const v of near) {
      const sp = Math.hypot(v.vx, v.vy);
      if (sp < 45) continue;
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const d = Math.hypot(dx, dy) || 1;
      // Il veicolo si sta avvicinando frontalmente al pedone?
      if ((v.vx * dx + v.vy * dy) / (sp * d) > 0.6 && d < 60 + sp * 0.9) return false;
    }
    return true;
  }

  /** Attraversamento: punta al marciapiede oltre la carreggiata. */
  startCrossing(p) {
    const b = p.block;
    const pt = sidewalkPoint(b, p.side, clamp(p.t, 0, 1), {});
    let nx = 0, ny = 0;
    if (p.side === 0) ny = -1;
    else if (p.side === 1) nx = 1;
    else if (p.side === 2) ny = 1;
    else nx = -1;
    const reach = 110;
    p.crossX = pt.x + nx * reach;
    p.crossY = pt.y + ny * reach;
    p.state = 'crossing';
    p.t = clamp(p.t, 0.02, 0.98);
  }

  knockDown(p, v, game) {
    if (p.dead) return;
    p.dead = true;
    p.deadT = 0;
    const sp = Math.hypot(v.vx, v.vy);
    p.vx = v.vx * 0.85 + (Math.random() - 0.5) * 40;
    p.vy = v.vy * 0.85 + (Math.random() - 0.5) * 40;
    p.spin = (Math.random() - 0.5) * 11;
    game.onPedKilled?.(p, v, sp, v.driver === 'player' ? game.player : null);
  }
}
