// Seoul Crashers — bootstrap e game loop.
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { Rng } from './core/rng.js';
import { DynamicGrid } from './core/spatial.js';
import { KMH, clamp, dist } from './core/math.js';
import { generateCity } from './world/citygen.js';
import { buildMapTexture } from './world/maptexture.js';
import { Camera } from './render/camera.js';
import { Scene } from './render/scene.js';
import { Fx } from './render/fx.js';
import { preloadSprites, VEHICLE_TYPES } from './render/sprites.js';
import { Player } from './entities/player.js';
import { TrafficSystem } from './entities/traffic.js';
import { PedestrianSystem } from './entities/pedestrians.js';
import { PickupSystem } from './entities/pickups.js';
import { ProjectileSystem } from './entities/projectiles.js';
import { WantedSystem } from './entities/wanted.js';
import { PoliceSystem } from './entities/police.js';
import { Hud } from './ui/hud.js';
import { MapView } from './ui/mapview.js';
import { PauseMenu } from './ui/menu.js';

const MAX_PIXELS = 2_900_000;

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.camera = new Camera();
    this.input = new Input(canvas);
    this.rng = new Rng(20260730);
    this.time = 0;
    this.debug = false;
    this.paused = false;
    this.isNight = false;
    this.trafficScale = 1;
    this.pedScale = 1;
    this.vehicles = [];
    this.peds = [];
    this.markers = [];
    this.fx = new Fx();
    this.audio = null; // sintetizzatore WebAudio: arriva nella fase 3
    this.stats = {
      distance: 0,
      topSpeed: 0,
      stolen: 0,
      crashes: 0,
      pedsHit: 0,
      kills: 0,
      deaths: 0,
      copsKilled: 0,
      maxWanted: 0,
      choppers: 0,
      blasts: 0,
      districts: new Set(),
    };
    this._skidT = 0;
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let s = Math.min(window.devicePixelRatio || 1, 2);
    if (w * h * s * s > MAX_PIXELS) s = Math.max(1, Math.sqrt(MAX_PIXELS / (w * h)));
    this.canvas.width = Math.round(w * s);
    this.canvas.height = Math.round(h * s);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.camera.resize(w, h);
    this.camera.dpr = s;
  }

  async boot(onProgress) {
    this.resize();
    await onProgress('Disegno le strade di Seoul…', 0.05);
    this.city = generateCity(20260730);

    await onProgress('Verniciano le carrozzerie…', 0.45);
    preloadSprites();

    await onProgress('Stampo le mappe turistiche…', 0.72);
    this.mapTexture = buildMapTexture(this.city);

    await onProgress('Accendo i semafori…', 0.88);
    this.scene = new Scene(this.city);
    this.player = new Player(this.city.spawn.x, this.city.spawn.y);
    this.player.district = this.city.districtAt(this.player.x, this.player.y);
    this.camera.snapTo(this.player.x, this.player.y);
    this.vehicleGrid = new DynamicGrid(this.city.w, this.city.h, 150);
    this.pedGrid = new DynamicGrid(this.city.w, this.city.h, 120);
    this.traffic = new TrafficSystem(this.city, this.rng, this.vehicles);
    this.pedSystem = new PedestrianSystem(this.city, this.rng, this.peds);
    this.pickups = new PickupSystem(this.city, this.rng);
    this.projectiles = new ProjectileSystem();
    this.wanted = new WantedSystem();
    this.police = new PoliceSystem(this.city, this.rng);
    this.hud = new Hud(this.city, this.mapTexture);
    this.mapView = new MapView(this.city, this.mapTexture);
    this.menu = new PauseMenu(this.mapView);

    // Riempie subito la scena, così il giocatore non parte in una città deserta.
    this.traffic.prewarm(this, 72, 32);
    this.pedSystem.prewarm(this, 64);

    this.hud.showDistrict(this.player.district);
    this.stats.districts.add(this.player.district.id);
    this.hud.toast('E per rubare un\'auto · M per la mappa', 5);
    this.hud.toast('Mouse per mirare e sparare · 1-6 per l\'arma', 6.5);

    await onProgress('Pronti.', 1);
    this.loop = new Loop((dt) => this.update(dt), () => this.render());
    this.loop.start();
  }

  // --- callback dal mondo ----------------------------------------------------
  onDistrictChange(d) {
    this.hud.showDistrict(d);
    this.stats.districts.add(d.id);
  }

  onEnterVehicle(v) {
    this.stats.stolen++;
    v.protect = true;
    this.hud.toast(`${VEHICLE_TYPES[v.kind].label} acquisita`, 1.8);
    // Rubare un'auto vuota in un vicolo non lo denuncia nessuno; strapparla dalle
    // mani di qualcuno sotto gli occhi di un testimone sì, e a una pattuglia ancora di più.
    if (!v.occupiedTheft) return;
    const cop = this.police.cops.some((p) => !p.dead && dist(p.x, p.y, v.x, v.y) < 420);
    if (cop) this.wanted.report('copTheft', this);
    else if (this.pedGrid.queryCircle(v.x, v.y, 320).some((p) => !p.dead)) {
      this.wanted.report('theft', this);
    }
  }

  onExitVehicle(v) {
    v.protect = false;
  }

  onVehicleImpact(v, impact) {
    const isPlayer = v.driver === 'player';
    if (impact > 90) {
      this.fx.addSparks(v.x, v.y, -v.vx, -v.vy, Math.min(14, impact / 22));
      if (isPlayer) {
        this.camera.addShake(Math.min(14, impact / 26));
        this.stats.crashes++;
      }
    }
    if (impact > 40) this.fx.addDust(v.x, v.y, v.vx, v.vy, 3);
  }

  onVehicleDestroyed(v) {
    this.fx.addExplosion(v.x, v.y);
    if (dist(v.x, v.y, this.player.x, this.player.y) < 900) {
      this.camera.addShake(18);
    }
    if (v.driver === 'player') {
      this.player.exitVehicle(this, true);
      this.player.damage(42, 0, 0, this);
    }
    // Onda d'urto: chi è troppo vicino non se la racconta.
    for (const p of this.pedGrid.queryCircle(v.x, v.y, 100)) {
      if (p.dead) continue;
      const d = dist(p.x, p.y, v.x, v.y) || 1;
      if (d > 100) continue;
      this.pedSystem.hurt(p, 130 - d, (p.x - v.x) / d, (p.y - v.y) / d, this, null, 300);
    }
    const pd = dist(this.player.x, this.player.y, v.x, v.y);
    if (this.player.onFoot && pd < 110) {
      this.player.damage(60 - pd * 0.3, (this.player.x - v.x) / (pd || 1), (this.player.y - v.y) / (pd || 1), this);
    }
    this.pedSystem.alarm(v.x, v.y, 700, this, null);
    // Far saltare una macchina è un reato solo se l'hai fatta saltare tu: le
    // carambole del traffico non devono mandare la centrale in allarme.
    if (v.lastAttacker === this.player) this.wanted.report('wreck', this);
    v.protect = false;
  }

  onPedKilled(p, v, speed, source) {
    this.stats.pedsHit++;
    if (source === this.player) this.stats.kills++;
    if (source === this.player || (v && v.driver === 'player')) {
      if (p.cop) {
        this.stats.copsKilled++;
        this.wanted.report('copKill', this);
      } else {
        this.wanted.report('kill', this);
      }
    }
    this.fx.addBlood(p.x, p.y, clamp(speed / 220, 0.5, 1.6));
    if (v) {
      this.fx.addDust(p.x, p.y, v.vx, v.vy, 3);
      if (v.driver === 'player') this.camera.addShake(6);
    }
  }

  onPlayerDeath() {
    this.stats.deaths++;
    this.camera.addShake(16);
  }

  // --- combattimento ---------------------------------------------------------
  damagePed(p, dmg, dx, dy, source, knock = 0) {
    this.pedSystem.hurt(p, dmg, dx, dy, this, source, knock);
  }

  damagePlayer(dmg, dx, dy) {
    this.player.damage(dmg, dx, dy, this);
  }

  damageVehicle(v, dmg, x, y, source) {
    this.fx.addSparks(x, y, -v.vx, -v.vy, 2);
    if (v.dead) return;
    if (source) v.lastAttacker = source;
    v.hp -= dmg;
    v.awake = true;
    if (v.hp <= 0) {
      v.dead = true;
      this.onVehicleDestroyed(v);
    }
  }

  /** Uno sparo si sente: i pedoni nel raggio reagiscono. */
  alarm(x, y, r, source) {
    this.pedSystem.alarm(x, y, r, this, source);
  }

  /** Risveglio all'ospedale del distretto più vicino, senza arsenale. */
  respawnPlayer() {
    const pl = this.player;
    let best = this.city.hospitals[0];
    let bestD = Infinity;
    for (const h of this.city.hospitals) {
      const d = dist(h.x, h.y, pl.x, pl.y);
      if (d < bestD) { bestD = d; best = h; }
    }
    pl.revive(best.x, best.y);
    pl.angle = Math.PI / 2;
    // In corsia il ricercato si azzera: è il prezzo già pagato con la morte, e
    // svegliarsi con quattro stelle addosso sarebbe una condanna senza uscita.
    this.wanted.reset();
    this.police.standDown(this, true);
    this.camera.snapTo(pl.x, pl.y);
    this.fx.clear();
    // Le mine restano armate anche dopo la morte di chi le ha messe: al risveglio
    // in corsia si troverebbe il quartiere minato e nessun modo di saperlo.
    this.projectiles.clear();
    pl.district = this.city.districtAt(pl.x, pl.y);
    this.hud.showDistrict(pl.district);
    this.hud.toast(`Ospedale di ${best.name}: ti hanno ricucito, l'arsenale no`, 4);
  }

  // --- ciclo ----------------------------------------------------------------
  update(dt) {
    const input = this.input;

    if (input.wasPressed('Escape')) {
      if (this.mapView.open) this.mapView.open = false;
      else this.menu.toggle();
    }
    if (input.wasPressed('KeyM')) {
      if (this.menu.open) this.menu.open = false;
      this.mapView.toggle();
    }
    if (input.wasPressed('F3')) this.debug = !this.debug;

    this.paused = this.menu.open || this.mapView.open;
    const cursor = this.paused ? 'default' : 'none';
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;

    if (this.paused) {
      this.menu.update(dt, this);
      this.mapView.update(dt, this);
      this.hud.update(dt);
      input.endFrame();
      return;
    }

    this.time += dt;
    this.vehicleGrid.rebuild(this.vehicles);
    this.pedGrid.rebuild(this.peds);

    const prevX = this.player.x;
    const prevY = this.player.y;

    this.player.update(dt, this);
    // Il ricercato legge l'avvistamento calcolato dalla polizia, la polizia scrive
    // gas e sterzo delle volanti: la fisica di quei veicoli la integra `traffic`,
    // che deve girare dopo.
    this.wanted.update(dt, this);
    this.police.update(dt, this);
    this.traffic.update(dt, this);
    this.pedSystem.update(dt, this);
    this.pickups.update(dt, this);
    this.projectiles.update(dt, this);
    this.fx.update(dt);
    this.hud.update(dt);

    // Statistiche di guida
    this.stats.distance += dist(prevX, prevY, this.player.x, this.player.y);
    const sp = this.player.onFoot ? 0 : Math.abs(this.player.vehicle?.speed || 0);
    if (sp > this.stats.topSpeed) this.stats.topSpeed = sp;

    this.emitSkids(dt);

    // Col mirino del fucile di precisione la camera non sta più addosso al
    // giocatore: se lo decide `player.cameraTarget`.
    this.camera.follow(this.player.cameraTarget(), dt, this.player.onFoot ? 0.2 : 0.4);

    input.endFrame();
  }

  /** Tracce di gomma per i veicoli che slittano nei paraggi. */
  emitSkids(dt) {
    this._skidT -= dt;
    if (this._skidT > 0) return;
    this._skidT = 0.035;
    for (const v of this.vehicles) {
      if (v.dead || v.slip < 42) continue;
      if (dist(v.x, v.y, this.player.x, this.player.y) > 800) continue;
      const spec = VEHICLE_TYPES[v.kind];
      const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
      const bx = v.x - cos * spec.len * 0.3;
      const by = v.y - sin * spec.len * 0.3;
      const strength = clamp((v.slip - 42) / 160, 0, 1);
      for (const s of [-1, 1]) {
        this.fx.addSkid(
          bx - sin * spec.wid * 0.42 * s,
          by + cos * spec.wid * 0.42 * s,
          v.angle,
          strength
        );
      }
      if (strength > 0.5 && Math.random() < 0.4) {
        this.fx.addSmoke(bx, by, 1, 0.5);
      }
    }
    // Cerchioni sull'asfalto: chi ha preso i chiodi lascia una scia di scintille.
    for (const v of this.vehicles) {
      if (!v.flatTires || v.dead || Math.abs(v.speed) < 35) continue;
      if (dist(v.x, v.y, this.player.x, this.player.y) > 700) continue;
      const spec = VEHICLE_TYPES[v.kind];
      const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
      this.fx.addSparks(v.x - cos * spec.len * 0.3, v.y - sin * spec.len * 0.3, -v.vx, -v.vy, 2);
    }
  }

  render() {
    const ctx = this.ctx;
    this.scene.render(ctx, this);
    this.camera.applyUI(ctx);
    this.hud.draw(ctx, this);
    this.mapView.draw(ctx, this);
    this.menu.draw(ctx, this);
  }
}

// --- avvio ------------------------------------------------------------------
const canvas = document.getElementById('game');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const loadingBar = document.getElementById('loading-bar');

const game = new Game(canvas);
window.game = game; // comodo per ispezionare da console

function progress(text, value) {
  loadingText.textContent = text;
  loadingBar.style.width = `${Math.round(value * 100)}%`;
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

game.boot(progress).then(() => {
  loading.classList.add('done');
  setTimeout(() => loading.remove(), 700);
}).catch((err) => {
  loadingText.textContent = `Errore: ${err.message}`;
  console.error(err);
});
