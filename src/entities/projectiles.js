// Esplosivi (Fase 2, tappa C): granate, molotov e mine.
//
// Sono gli unici oggetti del gioco che *non* sono raycast. Non per precisione — a
// queste distanze un raggio arriverebbe comunque nello stesso frame — ma perché per
// un esplosivo il tempo di volo **è** l'arma: la granata che rimbalza dietro l'angolo
// e la molotov che cade corta sono la ragione per cui esistono. Quindi hanno posizione,
// velocità e una quota `z` che serve a due cose: farli passare sopra le transenne e
// dare loro un'ombra che dice al giocatore dove atterreranno.
//
// Tre comportamenti, un solo integratore:
//   granata — miccia a tempo, rimbalza su muri e asfalto, esplode dove si trova;
//   molotov — miccia zero: si rompe al primo contatto e lascia una pozza che brucia;
//   mina    — non vola: si posa a terra, si arma e aspetta.
//
// L'onda d'urto è la stessa per tutti (`explode`) ed è la stessa cosa che fa saltare
// un'auto in `main.onVehicleDestroyed`: raggio, caduta lineare col raggio, e i veicoli
// presi dentro possono a loro volta saltare — le catene di esplosioni vengono gratis.
import { circleRectPush, clamp, dist } from '../core/math.js';

const GRAV = 620;        // px/s² sulla quota
const THROW_Z = 150;     // spinta verticale del lancio
const START_Z = 18;      // parte dalla mano, non da terra
const AIR = 0.16;        // attrito dell'aria sul piano
const ROLL = 2.6;        // attrito di rotolamento a terra
const PR = 5;            // raggio in pianta del proiettile
const MAX_SPEED = 980;

// Ogni quanto una pozza di fuoco fa danno. A ogni tick brucia `dps * FIRE_TICK`:
// controllare ogni frame chi sta dentro costerebbe una query per pozza per frame,
// e la differenza non si vede.
const FIRE_TICK = 0.34;

export class ProjectileSystem {
  constructor() {
    this.items = [];   // granate e molotov in volo o che rotolano
    this.mines = [];
    this.fires = [];   // pozze di fuoco
    this._q = [];
  }

  clear() {
    this.items.length = 0;
    this.mines.length = 0;
    this.fires.length = 0;
  }

  get count() {
    return this.items.length + this.mines.length + this.fires.length;
  }

  /**
   * Lancio verso un punto. La velocità orizzontale è calcolata dal tempo di volo,
   * così l'oggetto cade *dove punti* invece che a una distanza fissa: è l'unico modo
   * di rendere mirabile un'arma che vola in una visuale dall'alto.
   */
  throwItem(game, owner, spec, x, y, ang, reach) {
    const want = clamp(reach, 60, spec.range);
    const flight = (THROW_Z + Math.sqrt(THROW_Z * THROW_Z + 2 * GRAV * START_Z)) / GRAV;
    const speed = Math.min(MAX_SPEED, want / flight);
    const it = {
      spec, owner,
      x, y, z: START_Z,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      vz: THROW_Z,
      spin: (Math.random() - 0.5) * 14,
      angle: ang,
      fuse: spec.fuse || 0,
      rest: false,
      t: 0,
    };
    this.items.push(it);
    return it;
  }

  /** Mina posata a terra. Si arma quando chi l'ha messa si allontana. */
  place(game, owner, spec, x, y) {
    const m = { spec, owner, x, y, t: 0, armed: false };
    this.mines.push(m);
    return m;
  }

  addFire(game, x, y, spec, owner) {
    const f = spec.fire;
    this.fires.push({
      x, y, r: f.r, dps: f.dps, owner,
      life: f.life, maxLife: f.life, tick: 0, seed: Math.random() * 100,
    });
    // La bruciatura resta sull'asfalto anche dopo che il fuoco si è spento: è il
    // segno che dice "qui è passata una molotov" mezz'ora dopo.
    game.fx.addScorch(x, y, f.r * 0.78);
    // Una pozza in fiamme svuota il marciapiede: è metà dell'effetto della molotov.
    game.alarm(x, y, 320, owner);
  }

  update(dt, game) {
    this.updateFlying(dt, game);
    this.updateMines(dt, game);
    this.updateFires(dt, game);
  }

  updateFlying(dt, game) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;

      if (!it.rest) {
        it.vz -= GRAV * dt;
        it.z += it.vz * dt;
        const drag = 1 - (it.z > 1 ? AIR : ROLL) * dt;
        it.vx *= drag;
        it.vy *= drag;
        it.angle += it.spin * dt;

        const nx = it.x + it.vx * dt;
        const ny = it.y + it.vy * dt;
        this.bounceOnSolids(it, nx, ny, game);

        if (it.z <= 0) {
          it.z = 0;
          if (!it.spec.fuse) { // molotov: si rompe e basta
            this.breakItem(it, game);
            this.items.splice(i, 1);
            continue;
          }
          it.vz = -it.vz * 0.3;
          it.vx *= 0.62;
          it.vy *= 0.62;
          it.spin *= 0.5;
          if (it.vz < 34) { it.vz = 0; it.rest = true; }
        }
      } else {
        // A terra continua a rotolare finché non si ferma: una granata che si pianta
        // di colpo dove l'hai lanciata non si legge come una granata.
        const k = 1 - ROLL * dt;
        it.vx *= k;
        it.vy *= k;
        this.bounceOnSolids(it, it.x + it.vx * dt, it.y + it.vy * dt, game);
        it.angle += it.spin * dt;
        it.spin *= k;
      }

      if (it.spec.fuse) {
        it.fuse -= dt;
        if (it.fuse <= 0) {
          explode(game, it.x, it.y, it.spec, it.owner);
          this.items.splice(i, 1);
        }
      }
    }
  }

  /**
   * Spostamento con rimbalzo sui solidi. Sotto i 14 px di quota contano anche i
   * solidi `vehicleOnly` (transenne, gradini); sopra ci si passa sopra — lanciare
   * la molotov oltre il posto di blocco deve funzionare.
   */
  bounceOnSolids(it, nx, ny, game) {
    it.x = nx;
    it.y = ny;
    // `game.area()` è la città o la pianta del piano: una granata rimbalza sui muri
    // di un negozio esattamente come su quelli di un palazzo.
    const area = game.area();
    const solids = area.grid.queryRect(it.x - 20, it.y - 20, 40, 40, this._q);
    for (const s of solids) {
      if (s.vehicleOnly && it.z > 14) continue;
      const push = circleRectPush(it.x, it.y, PR, s);
      if (!push) continue;
      it.x += push.nx * push.depth;
      it.y += push.ny * push.depth;
      const vn = it.vx * push.nx + it.vy * push.ny;
      if (vn < 0) {
        it.vx -= push.nx * vn * 1.42;
        it.vy -= push.ny * vn * 1.42;
        it.spin = (Math.random() - 0.5) * 12;
        // Una molotov contro un muro si rompe lì, non rimbalza.
        if (!it.spec.fuse) { it.z = 0; }
      }
    }
    it.x = clamp(it.x, area.x0, area.x1);
    it.y = clamp(it.y, area.y0, area.y1);
  }

  breakItem(it, game) {
    if (it.spec.fire) {
      this.addFire(game, it.x, it.y, it.spec, it.owner);
      game.fx.addExplosion(it.x, it.y);
      game.camera.addShake(4);
    } else {
      explode(game, it.x, it.y, it.spec, it.owner);
    }
  }

  updateMines(dt, game) {
    const pl = game.player;
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.t += dt;
      // Armata quando chi l'ha posata si è tolto di mezzo: piazzarne una ai propri
      // piedi e saltare in aria non è una meccanica, è un incidente.
      if (!m.armed && (m.t > 1.2 && dist(m.x, m.y, pl.x, pl.y) > 62)) m.armed = true;
      if (m.t > 150) { this.mines.splice(i, 1); continue; }
      if (!m.armed) continue;

      let trigger = null;
      for (const v of game.vehicleGrid.queryCircle(m.x, m.y, 34, this._q)) {
        if (v.dead) continue;
        if (dist(v.x, v.y, m.x, m.y) < 32) { trigger = v; break; }
      }
      if (!trigger) {
        for (const p of game.pedGrid.queryCircle(m.x, m.y, 20, this._q)) {
          if (!p.dead && dist(p.x, p.y, m.x, m.y) < 18) { trigger = p; break; }
        }
      }
      if (!trigger && pl.onFoot && !pl.dying && dist(pl.x, pl.y, m.x, m.y) < 18) trigger = pl;
      if (trigger) {
        explode(game, m.x, m.y, m.spec, m.owner);
        this.mines.splice(i, 1);
      }
    }
  }

  updateFires(dt, game) {
    const pl = game.player;
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.life -= dt;
      if (f.life <= 0) { this.fires.splice(i, 1); continue; }

      // Fiamme: poche particelle per pozza, ma continue.
      if (Math.random() < dt * 26) {
        const a = Math.random() * 6.283;
        const rr = Math.sqrt(Math.random()) * f.r * 0.85;
        game.fx.addParticle({
          type: 'fire',
          x: f.x + Math.cos(a) * rr, y: f.y + Math.sin(a) * rr,
          vx: (Math.random() - 0.5) * 24, vy: (Math.random() - 0.5) * 24,
          r: 4 + Math.random() * 9,
          life: 0.3 + Math.random() * 0.45, maxLife: 0.75,
          color: Math.random() < 0.3 ? '255,220,120' : '255,140,44',
        });
      }

      f.tick -= dt;
      if (f.tick > 0) continue;
      f.tick = FIRE_TICK;
      const bite = f.dps * FIRE_TICK * clamp(f.life / 2, 0.35, 1);
      for (const p of game.pedGrid.queryCircle(f.x, f.y, f.r, this._q)) {
        if (p.dead) continue;
        const d = dist(p.x, p.y, f.x, f.y);
        if (d > f.r) continue;
        const dx = (p.x - f.x) / (d || 1);
        const dy = (p.y - f.y) / (d || 1);
        game.damagePed(p, bite, dx, dy, f.owner, 0);
      }
      for (const v of game.vehicleGrid.queryCircle(f.x, f.y, f.r + 30, this._q)) {
        if (v.dead || dist(v.x, v.y, f.x, f.y) > f.r + 24) continue;
        game.damageVehicle(v, bite * 0.85, v.x, v.y, f.owner);
      }
      const d = dist(pl.x, pl.y, f.x, f.y);
      if (pl.onFoot && !pl.dying && d < f.r) {
        game.damagePlayer(bite, (pl.x - f.x) / (d || 1), (pl.y - f.y) / (d || 1), f.owner);
      }
    }
  }
}

/**
 * Onda d'urto. Il danno cala linearmente col raggio e vale per pedoni, giocatore e
 * veicoli: un'auto presa in pieno salta a sua volta, e le catene nascono da sole.
 */
export function explode(game, x, y, spec, source = null) {
  const r = spec.blast ? spec.blast.r : 120;
  const dmg = spec.blast ? spec.blast.dmg : 120;
  const pl = game.player;

  game.fx.addExplosion(x, y);
  game.fx.addScorch(x, y, r * 0.6);
  game.fx.addSmoke(x, y, 10, 2.6);
  const pd = dist(x, y, pl.x, pl.y);
  if (pd < 1100) game.camera.addShake(clamp(24 * (1 - pd / 1100), 3, 24));

  for (const p of game.pedGrid.queryCircle(x, y, r)) {
    if (p.dead) continue;
    const d = dist(p.x, p.y, x, y);
    if (d > r) continue;
    const f = 1 - d / r;
    const l = d || 1;
    game.damagePed(p, dmg * f, (p.x - x) / l, (p.y - y) / l, source, 240 * f + 60);
  }

  for (const v of game.vehicleGrid.queryCircle(x, y, r + 40)) {
    if (v.dead) continue;
    const d = dist(v.x, v.y, x, y);
    if (d > r + 30) continue;
    const f = 1 - d / (r + 30);
    v.awake = true;
    // Spinta sull'auto: una berlina investita dall'onda si sposta davvero.
    const l = d || 1;
    v.vx += ((v.x - x) / l) * 210 * f;
    v.vy += ((v.y - y) / l) * 210 * f;
    v._hit = true;
    game.damageVehicle(v, dmg * f * 0.95, v.x, v.y, source);
  }

  if (!pl.dying && pd < r) {
    const f = 1 - pd / r;
    const l = pd || 1;
    // Chiuso in macchina si incassa meno: la lamiera qualcosa la ferma.
    game.damagePlayer(dmg * f * (pl.onFoot ? 1 : 0.45), (pl.x - x) / l, (pl.y - y) / l, source);
  }

  game.alarm(x, y, 900, source);
  game.stats.blasts = (game.stats.blasts || 0) + 1;
}
