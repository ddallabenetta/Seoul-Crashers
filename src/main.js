// Seoul Crashers — bootstrap e game loop.
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { Rng } from './core/rng.js';
import { AudioSystem } from './core/audio.js';
import { Radio } from './core/radio.js';
import { DynamicGrid } from './core/spatial.js';
import { KMH, clamp, dist } from './core/math.js';
import { generateCity } from './world/citygen.js';
import { buildMapTexture } from './world/maptexture.js';
import { DayCycle } from './world/daycycle.js';
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
import { ShopSystem, won } from './entities/shops.js';
import { usedSlots } from './core/save.js';
import { InteriorScene } from './render/interiorscene.js';
import { Hud } from './ui/hud.js';
import { MapView } from './ui/mapview.js';
import { PauseMenu } from './ui/menu.js';
import { ShopMenu } from './ui/shopmenu.js';

const MAX_PIXELS = 2_900_000;
// Dentro un edificio non c'è traffico: la griglia dei veicoli si ricostruisce vuota
// invece di aggiungere un ramo a ogni query.
const NO_VEHICLES = [];

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
    // Il meteo ha un rng suo: pescare da `this.rng` sposterebbe tutto quello che
    // ci pesca dopo (spawn del traffico, dei pedoni) a ogni cambio di tempo.
    this.dayCycle = new DayCycle(new Rng(20260731));
    this.trafficScale = 1;
    this.pedScale = 1;
    this._wasNight = this.dayCycle.isNight;
    this.vehicles = [];
    this.peds = [];
    this.markers = [];
    this.fx = new Fx();
    this.audio = new AudioSystem();
    // La radio è l'unica cosa del gioco che parla con la rete, e non lo fa
    // finché il giocatore non la accende (§5.14).
    this.radio = new Radio(this.audio);
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
      robberies: 0,
      visits: 0,
      districts: new Set(),
    };
    this._skidT = 0;
    window.addEventListener('resize', () => this.resize());
    this.armAudio();
  }

  /**
   * L'audio non può partire prima che l'utente tocchi qualcosa: è una regola dei
   * browser, non una scelta. Il contesto si crea al primo tasto o al primo click e
   * fino a lì `AudioSystem` non fa niente. La scheda nascosta va sospesa a mano:
   * il loop si ferma con `requestAnimationFrame`, i letti continui no.
   */
  armAudio() {
    const start = () => {
      this.audio.unlock();
      if (!this.audio.ready) return;
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    document.addEventListener('visibilitychange', () => {
      this.audio.setActive(!document.hidden);
    });
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
    this.shops = new ShopSystem(this.city);
    this.interiorScene = new InteriorScene(this.scene);
    this.hud = new Hud(this.city, this.mapTexture);
    this.mapView = new MapView(this.city, this.mapTexture);
    this.menu = new PauseMenu(this.mapView);
    this.shopMenu = new ShopMenu();

    // Riempie subito la scena, così il giocatore non parte in una città deserta.
    this.traffic.placeSpecialVehicles(this);
    this.traffic.prewarm(this, 72, 32);
    this.pedSystem.prewarm(this, 64);

    this.hud.showDistrict(this.player.district);
    this.stats.districts.add(this.player.district.id);
    this.hud.toast('E per rubare un\'auto · M per la mappa', 5);
    this.hud.toast('Mouse per mirare e sparare · 1-6 per l\'arma', 6.5);
    this.hud.toast('E sulla porta di un negozio per entrare · F svuota la cassa', 8);
    // Il gioco parte in strada, senza schermata iniziale: se non lo si dice qui,
    // una partita salvata resta invisibile finché non si apre il menu per caso.
    if (usedSlots() > 0) this.hud.toast('Hai una partita salvata · ESC → Salvataggi', 9.5);

    await onProgress('Pronti.', 1);
    this.loop = new Loop((dt) => this.update(dt), () => this.render());
    this.loop.start();
  }

  /** True quando il giocatore è dentro un edificio: la città è ferma. */
  get indoors() {
    return !!(this.shops && this.shops.active);
  }

  /** Notte di gioco: la decide l'orologio, e da lì scendono fari, lampioni e insegne. */
  get isNight() {
    return this.dayCycle.isNight;
  }

  /**
   * Il rettangolo giocabile e i suoi solidi: la città, oppure la pianta del piano
   * in cui si è entrati. Collisioni a piedi e raggi delle armi passano di qui e
   * non hanno bisogno di sapere dove si trova il giocatore.
   */
  area() {
    if (this.indoors) {
      const f = this.shops.floor;
      return { grid: f.grid, x0: 10, y0: 10, x1: f.w - 10, y1: f.h - 10 };
    }
    return { grid: this.city.solidGrid, x0: 40, y0: 40, x1: this.city.w - 40, y1: this.city.h - 40 };
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
    // Sotto i 30 px/s è lo strisciare di un paraurti in coda: farlo suonare
    // riempirebbe la strada di lamiere a ogni semaforo.
    if (impact > 30) this.audio.impact(v.x, v.y, impact);
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
    this.audio.explosion(v.x, v.y, 1.15);
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

  /**
   * Un mezzo di terra finito in acqua. Non è un'esplosione: è uno spruzzo, il
   * relitto che cala e chi era al volante che annega. La macchina va tolta subito
   * dalla lista, altrimenti resta a galleggiare in fondo al Han per tutta la partita.
   */
  onVehicleSunk(v) {
    this.fx.addSplash(v.x, v.y, 22, 1.6);
    this.audio.splash(v.x, v.y, 1.6);
    if (v.driver === 'player') {
      this.player.exitVehicle(this, true);
      this.hud.toast('Sei finito in acqua', 2.4);
      this.player.die(this);
    }
    v.dead = true;
    v.deadT = 24;      // lo streaming lo raccoglie al prossimo giro
    v.protect = false;
    // Togliere il veicolo dalla lista non libera il suo stallo di sosta: senza
    // questo, il posto resta occupato da un fantasma per il resto della partita.
    if (v.spot) v.spot.taken = false;
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
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
    this.audio.bodyFall(p.x, p.y);
    // Investito, non colpito: il grido è quello di chi ha visto la macchina
    // arrivare. Chi muore di piombo cade e basta.
    if (v && Math.random() < 0.6) this.audio.scream(p.x, p.y, 1.1);
    if (v) {
      this.fx.addDust(p.x, p.y, v.vx, v.vy, 3);
      if (v.driver === 'player') this.camera.addShake(6);
    }
  }

  /**
   * Manopola della radio. Sta qui e non in `player` perché si usa in due posti —
   * al volante e dentro un locale — e in nessuno dei due è un'azione del
   * personaggio. Premerla dove non si sentirebbe niente lo dice, invece di
   * aprire uno stream muto.
   */
  updateRadioKeys() {
    if (!this.input.wasPressed('KeyR') || this.paused) return;
    const shift = this.input.anyDown('ShiftLeft', 'ShiftRight');
    const inCar = !this.player.onFoot && this.player.vehicle;
    const inShop = this.indoors && this.shops.floor?.openNow && this.shops.floor?.biz.radio;
    if (!inCar && !inShop) {
      this.hud.toast('La radio è in macchina (o in un locale che ce l\'ha)', 1.8);
      return;
    }
    if (shift) this.radio.off(this);
    else this.radio.next(this);
  }

  onPlayerDeath() {
    this.stats.deaths++;
    this.camera.addShake(16);
    this.audio.playerDown();
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

  /** Uno sparo si sente: i pedoni nel raggio reagiscono — quelli del piano, se dentro. */
  alarm(x, y, r, source) {
    if (this.indoors) this.shops.alarm(x, y, r, this, source);
    else this.pedSystem.alarm(x, y, r, this, source);
  }

  /** Risveglio all'ospedale del distretto più vicino, senza arsenale. */
  respawnPlayer() {
    const pl = this.player;
    // Se si muore dentro un negozio la barella arriva lo stesso: l'interno si
    // chiude prima di spostare il giocatore, o resterebbe in un limbo con le
    // coordinate della pianta.
    if (this.indoors) this.shops.forceExit(this);
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
    // In corsia si paga: un quarto dei contanti. È il costo della morte adesso che
    // i soldi servono a qualcosa, e non svuota le tasche a chi ha appena cominciato.
    const bill = Math.round(pl.money * 0.25);
    pl.money -= bill;
    this.hud.toast(`Ospedale di ${best.name}: ti hanno ricucito, l'arsenale no`, 4);
    if (bill > 0) this.hud.toast(`Conto della clinica: ${won(bill)}`, 4);
  }

  // --- ciclo ----------------------------------------------------------------
  update(dt) {
    const input = this.input;

    if (input.wasPressed('Escape')) {
      // `backOut` è il pannello audio del menu: ESC lì dentro torna alle voci
      // invece di chiudere tutto.
      if (this.shopMenu.open) this.shopMenu.close(this);
      else if (this.mapView.open) { this.mapView.open = false; this.audio.ui('close'); }
      else if (!this.menu.backOut()) { this.menu.toggle(); this.audio.ui(this.menu.open ? 'open' : 'close'); }
      else this.audio.ui('close');
    }
    // La mappa della città non serve dentro un negozio: le coordinate sono quelle
    // della pianta, e il puntino finirebbe in un angolo di Seoul a caso.
    if (input.wasPressed('KeyM') && !this.shopMenu.open && !this.indoors) {
      if (this.menu.open) this.menu.open = false;
      this.mapView.toggle();
      this.audio.ui(this.mapView.open ? 'open' : 'close');
    }
    if (input.wasPressed('F3')) this.debug = !this.debug;
    if (input.wasPressed('F4')) {
      this.hud.toast(this.audio.toggleMute() ? 'Audio: muto' : 'Audio: acceso', 1.6);
    }

    this.paused = this.menu.open || this.mapView.open || this.shopMenu.open;
    this.updateRadioKeys();
    // L'audio gira anche in pausa: i letti si abbassano invece di spegnersi (uno
    // stacco netto suona come un guasto) e i suoni dei menu restano a volume pieno.
    this.audio.update(dt, this);
    this.radio.update(dt, this);
    const cursor = this.paused ? 'default' : 'none';
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;

    if (this.paused) {
      this.menu.update(dt, this);
      this.mapView.update(dt, this);
      this.shopMenu.update(dt, this);
      this.hud.update(dt);
      input.endFrame();
      return;
    }

    this.time += dt;
    // L'orologio è l'unico sistema che gira anche dentro un negozio. Un orologio
    // che si ferma è un orologio a cui il giocatore smette di credere, e restare
    // al riparo aspettando che faccia giorno deve poter funzionare.
    this.dayCycle.update(dt);
    this.trafficScale = this.dayCycle.trafficScale;
    this.pedScale = this.dayCycle.pedScale;
    if (this.dayCycle.isNight !== this._wasNight) this.switchLights();

    this.vehicleGrid.rebuild(this.indoors ? NO_VEHICLES : this.vehicles);
    this.pedGrid.rebuild(this.peds);

    const prevX = this.player.x;
    const prevY = this.player.y;

    // I negozi girano per primi: decidono se il frame si svolge in strada o dentro
    // un edificio, e il giocatore deve muoversi già nello spazio giusto.
    this.shops.update(dt, this);
    this.player.update(dt, this);
    // Dentro un edificio la città si ferma — traffico, pedoni, raccolte — e il
    // ricercato **resta congelato**: se si raffreddasse, la porta diventerebbe il
    // nascondiglio che §5.8 non vuole. La polizia è l'unica eccezione: continua a
    // lavorare, ma sulla porta invece che sul giocatore (`police.siege`), perché
    // uscire dopo un minuto e ritrovare la strada com'era è la scena che manca.
    if (!this.indoors) {
      // Il ricercato legge l'avvistamento calcolato dalla polizia, la polizia scrive
      // gas e sterzo delle volanti: la fisica di quei veicoli la integra `traffic`,
      // che deve girare dopo.
      this.wanted.update(dt, this);
      this.police.update(dt, this);
      this.traffic.update(dt, this);
      this.pedSystem.update(dt, this);
      this.pickups.update(dt, this);
    } else {
      this.police.siege(dt, this);
    }
    // Gli esplosivi girano anche dentro: una granata in un 노래방 rimbalza sui
    // tramezzi e fa danno a chi c'è. Quello che *non* può fare è sopravvivere alla
    // porta, e infatti `shops` svuota la lista a ogni passaggio (mine comprese).
    this.projectiles.update(dt, this);
    this.fx.update(dt, this);
    this.hud.update(dt);

    // Statistiche di guida. Entrare e uscire da una porta è un salto di coordinate,
    // non un chilometro percorso: durante lo stacco non si conta.
    if (!this.indoors && this.shops.fade < 0.5) {
      this.stats.distance += dist(prevX, prevY, this.player.x, this.player.y);
    }
    const sp = this.player.onFoot ? 0 : Math.abs(this.player.vehicle?.speed || 0);
    if (sp > this.stats.topSpeed) this.stats.topSpeed = sp;

    if (!this.indoors) this.emitSkids(dt);

    // Col mirino del fucile di precisione la camera non sta più addosso al
    // giocatore: se lo decide `player.cameraTarget`.
    this.camera.follow(this.player.cameraTarget(this), dt, this.player.onFoot ? 0.2 : 0.4);

    input.endFrame();
  }

  /**
   * Cala la sera: si accendono i fari di quello che è già in strada. Si fa al
   * cambio di fase e non a ogni frame perché `lightsOn` è anche una scelta del
   * giocatore (`player.updateDriving`), e riscriverla di continuo gliela toglierebbe.
   */
  switchLights() {
    this._wasNight = this.dayCycle.isNight;
    for (const v of this.vehicles) {
      if (v.driver !== 'player') v.lightsOn = this._wasNight;
    }
    this.hud.toast(this._wasNight ? 'Cala la sera su Seoul' : 'Sorge il sole', 3);
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
    if (this.indoors) this.interiorScene.render(ctx, this);
    else this.scene.render(ctx, this);
    this.camera.applyUI(ctx);
    this.hud.draw(ctx, this);
    this.mapView.draw(ctx, this);
    this.menu.draw(ctx, this);
    this.shopMenu.draw(ctx, this);
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
