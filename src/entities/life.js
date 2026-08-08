// La vita della Corea: quello che gli abitanti fanno quando non è il giocatore a
// farlo succedere. Cinque cose, e vivono tutte qui dentro — traffico aereo e
// marittimo con qualcuno ai comandi, campagna che lavora e rincasa, capannelli di
// gente che chiacchiera, rapine e guerre fra bande con la volante che arriva a
// rovinare la festa a tutti.
//
// Tre scelte spiegano il file:
//
// 1. **Nessuna entità nuova.** Un pilota è un veicolo di `game.vehicles` con un
//    `ai.mode`; un rapinatore è un pedone di `game.peds` con lo stato `errand`.
//    Un secondo tipo di abitante avrebbe voluto dire rifare rendering, collisioni,
//    ordinamento radiale, audio e streaming — e nessuna delle cinque cose qui
//    sopra ha bisogno di qualcosa che un pedone o un veicolo non sappiano già fare.
// 2. **Un solo stato per chi ha un compito.** `errand` non sa niente di rapine:
//    chiede a `LifeSystem.order` dove andare e a che velocità, esattamente come lo
//    stato `duty` lo chiede a `police.copBehavior`. Le quattro figure di questo
//    file (rapinatore, incursore, difensore, agente di quartiere) stanno tutte lì
//    dentro, e `pedestrians.js` non sa che esistono.
// 3. **La polizia degli eventi non è la polizia del giocatore.** `PoliceSystem`
//    lavora su un bersaglio solo — te — e allargarla a N bersagli avrebbe rimesso
//    in gioco ricercato, assedio, arresto, chiodi e sirene. Qui si riusa solo
//    quello che è già generico (`followRoads`, `snapToRoad`) e si tiene una lista
//    di unità a parte: la centrale non sa nemmeno che esistono.
import { Rng } from '../core/rng.js';
import { createVehicle } from './vehicle.js';
import { createPed } from './pedestrians.js';
import { VEHICLE_TYPES } from '../render/sprites.js';
import { GANGS } from '../world/districts.js';
import { lanePoint, laneCount } from '../world/roadgraph.js';
import { WEAPONS, shoot, meleeSwing, hasLineOfSight } from './weapons.js';
import { circleRectPush, clamp, dist } from '../core/math.js';

// Quanti mezzi con un pilota a bordo. Sono tetti bassi apposta: un aereo che
// passa è un evento, tre aerei insieme sono un aeroporto militare.
const MAX_AIR = 2;
const MAX_BOATS = 3;
// Raduni e fatti di cronaca contemporaneamente in piedi. Due sono già tanti: il
// giocatore ne può guardare uno solo per volta.
const MAX_CROWDS = 2;
const MAX_EVENTS = 2;
// Braccianti nei campi, in tutto. La campagna è vuota per mestiere: riempirla
// come un marciapiede di Myeongdong la trasformerebbe in periferia.
const MAX_FARMERS = 8;

// Quote di crociera. Il velivolo vive nella proiezione dei palazzi (§3), quindi
// la quota è anche quanto lo si vede staccato dalla propria ombra: sotto i 260 px
// un aereo di linea sembra un modellino appoggiato sui tetti.
const PLANE_Z = [300, 400];
const HELI_Z = [165, 235];

// Distanze di regia. Un fatto che succede oltre i 1500 px non lo vede nessuno e
// costa lo stesso; sotto i 400 px compare in faccia.
const EVENT_MIN = 420;
const EVENT_MAX = 1200;

const TAU = Math.PI * 2;

/** True se il punto è fuori dal rettangolo inquadrato (con margine). */
function outsideView(game, x, y, margin = 60) {
  const b = game.camera.bounds(margin);
  return x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h;
}

/** Vivo, presente e ancora nella parte: chiunque riceva un bersaglio passa di qui. */
function alive(p) {
  return !!p && !p.dead && !p.gone;
}

export class LifeSystem {
  constructor(city, rng) {
    this.city = city;
    // Un rng suo: pescare da quello del gioco sposterebbe lo streaming di
    // traffico e pedoni ogni volta che decolla un aereo.
    this.rng = rng || new Rng(20260808);
    this.air = [];
    this.boats = [];
    this.farmers = [];
    this.tractors = [];
    this.crowds = [];
    this.events = [];
    // Le volanti degli eventi. È un elenco piatto di veicoli — e non di unità —
    // perché `audio.updatePolice` ci passa sopra per farci sentire la sirena.
    this.units = [];
    this.airT = 6;
    this.boatT = 3;
    this.crowdT = 5;
    this.eventT = 22;
    this.ruralT = 0;
    this.chatT = 0;
    this.tmp = {};
    this._foes = [];   // scratch: l'elenco dei nemici, chiesto da ognuno ogni frame
    this._pt = { x: 0, y: 0, onFoot: true };
  }

  // --- ciclo -----------------------------------------------------------------
  update(dt, game) {
    this.updateAir(dt, game);
    this.updateMarine(dt, game);
    this.updateRural(dt, game);
    this.updateCrowds(dt, game);
    this.updateEvents(dt, game);
    this.updateUnits(dt, game);
  }

  /**
   * Comando di guida per un veicolo di questo file. La chiama `traffic.driveAI`
   * quando trova un `ai.mode`: la fisica resta quella di tutti gli altri, cambia
   * solo chi scrive gas e sterzo.
   */
  drive(v, dt, game) {
    switch (v.ai.mode) {
      case 'air': this.driveAir(v, dt, game); break;
      case 'marine': this.driveMarine(v, dt, game); break;
      case 'field': this.driveField(v, dt, game); break;
      case 'flee': this.driveFlee(v, dt, game); break;
      default: v.throttle = 0; v.steer = 0; break;
    }
  }

  /**
   * Svuotato il mondo (partita nuova, salvataggio caricato, treno) non resta
   * niente in piedi: le liste tengono riferimenti a veicoli e pedoni che stanno
   * per non esistere più, e un evento sopravvissuto continuerebbe a dare ordini
   * a dei fantasmi.
   */
  clear(game) {
    for (const v of [...this.air, ...this.boats, ...this.tractors, ...this.units]) {
      this.removeVehicle(v, game);
    }
    this.air.length = 0;
    this.boats.length = 0;
    this.tractors.length = 0;
    this.units.length = 0;
    for (const p of this.farmers) p.gone = true;
    this.farmers.length = 0;
    for (const c of this.crowds) this.dissolve(c);
    this.crowds.length = 0;
    for (const ev of this.events) this.endEvent(ev, game, true);
    this.events.length = 0;
    this.airT = 6;
    this.boatT = 3;
    this.crowdT = 5;
    this.eventT = 22;
  }

  removeVehicle(v, game) {
    if (!v) return;
    v.protect = false;
    v.siren = false;
    if (v.driver === 'player') return;
    this.freeSpot(v);
    const i = game.vehicles.indexOf(v);
    if (i >= 0) game.vehicles.splice(i, 1);
  }

  /** Uno stallo di sosta lasciato occupato da un fantasma non si libera più (§4). */
  freeSpot(v) {
    if (!v || !v.spot) return;
    v.spot.taken = false;
    v.spot = null;
  }

  /** Riga per il pannello di debug (F3). */
  get info() {
    return `vita ${this.air.length}a ${this.boats.length}b ${this.farmers.length}c`
      + ` · ${this.crowds.length}rad ${this.events.length}ev ${this.units.length}u`;
  }

  // --- volo ------------------------------------------------------------------
  /**
   * Traffico aereo. Due cose diverse con la stessa fisica: un **sorvolo**, che
   * attraversa il campo visivo a quota di crociera e non tocca terra, e il
   * **movimento d'aeroporto**, che esiste solo se una pista è a portata. Il primo
   * serve a dare un cielo alla mappa, il secondo a far vedere che quella striscia
   * di asfalto in mezzo alle risaie è una pista.
   */
  updateAir(dt, game) {
    const pl = game.player;
    for (let i = this.air.length - 1; i >= 0; i--) {
      const v = this.air[i];
      const lost = v.dead || v.driver !== 'ai' || dist(v.x, v.y, pl.x, pl.y) > 4200;
      if (lost) {
        this.air.splice(i, 1);
        // Un velivolo rubato a mezz'aria non si cancella da sotto i piedi del
        // giocatore: si lascia com'è e se ne perde solo il controllo.
        if (v.driver !== 'player') this.removeVehicle(v, game);
      }
    }
    this.airT -= dt;
    if (this.airT > 0 || this.air.length >= MAX_AIR || game.indoors) return;
    this.airT = this.rng.range(14, 34);
    const rw = this.nearestRunway(pl.x, pl.y);
    if (rw && dist(rw.cx, rw.cy, pl.x, pl.y) < 3000 && this.rng.chance(0.65)) {
      this.spawnAirportMove(game, rw);
    } else {
      this.spawnOverflight(game);
    }
  }

  /** Pista più vicina, con centro e asse già calcolati. */
  nearestRunway(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const r of this.city.runways || []) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { r, cx, cy, horiz: r.horiz, len: r.horiz ? r.w : r.h };
      }
    }
    return best;
  }

  makeAircraft(game, kind, x, y, angle, z) {
    const v = createVehicle(kind, x, y, angle, this.rng.int(0, 9));
    v.driver = 'ai';
    v.z = z;
    v.protect = true;   // lo streaming del traffico non tocca chi vola
    v.lightsOn = game.isNight;
    v.ai = { mode: 'air', phase: 'cruise', course: angle, t: 0, apron: null, cruiseZ: z };
    game.vehicles.push(v);
    this.air.push(v);
    return v;
  }

  /** Un aereo (o un elicottero) che passa e basta: entra da un lato ed esce dall'altro. */
  spawnOverflight(game) {
    const pl = game.player;
    const heli = this.rng.chance(0.4);
    const kind = heli ? 'heli' : 'plane';
    const a = this.rng.range(0, TAU);
    const R = 2600;
    const x = pl.x + Math.cos(a) * R;
    const y = pl.y + Math.sin(a) * R;
    if (x < 200 || y < 200 || x > this.city.w - 200 || y > this.city.h - 200) return null;
    // Rotta che passa *di lato* al giocatore invece che addosso: una traiettoria
    // che punta la camera si legge come un attacco, non come traffico.
    const off = this.rng.range(-700, 700);
    const course = Math.atan2(pl.y - y + Math.cos(a) * off, pl.x - x - Math.sin(a) * off);
    const z = heli ? this.rng.range(HELI_Z[0], HELI_Z[1]) : this.rng.range(PLANE_Z[0], PLANE_Z[1]);
    const v = this.makeAircraft(game, kind, x, y, course, z);
    const spec = VEHICLE_TYPES[kind];
    v.speed = spec.topSpeed * (heli ? 0.55 : 0.72);
    v.vx = Math.cos(course) * v.speed;
    v.vy = Math.sin(course) * v.speed;
    return v;
  }

  /**
   * Decollo o atterraggio. Sono la stessa retta — l'asse della pista — percorsa
   * nei due sensi: quello che cambia è chi comanda la quota. In decollo si tiene
   * il muso dritto finché la velocità di rotazione non arriva; in atterraggio si
   * scende sull'asse e si frena, poi si rulla al piazzale e si parcheggia.
   */
  spawnAirportMove(game, rw) {
    const horiz = rw.horiz;
    const axis = horiz ? 0 : Math.PI / 2;
    const half = rw.len / 2;
    const dirSign = this.rng.chance(0.5) ? 1 : -1;
    const course = axis + (dirSign > 0 ? 0 : Math.PI);
    const ux = Math.cos(course);
    const uy = Math.sin(course);
    const departure = this.rng.chance(0.5);

    if (departure) {
      const v = this.makeAircraft(game, 'plane', rw.cx - ux * half * 0.92, rw.cy - uy * half * 0.92, course, 0);
      v.ai.phase = 'roll';
      v.ai.course = course;
      v.ai.rw = rw;
      // Chi decolla non si ferma alla quota a cui ha smesso di cabrare: sale fino
      // alla crociera come chiunque altro, e solo lì diventa un puntino.
      v.ai.cruiseZ = this.rng.range(PLANE_Z[0], PLANE_Z[1]);
      return v;
    }
    // In finale: fuori pista, alto e già allineato. La discesa la fa `driveAir`.
    const v = this.makeAircraft(game, 'plane', rw.cx - ux * (half + 1900), rw.cy - uy * (half + 1900), course, 250);
    v.ai.phase = 'final';
    v.ai.course = course;
    v.ai.rw = rw;
    v.speed = VEHICLE_TYPES.plane.rotate * 1.25;
    v.vx = ux * v.speed;
    v.vy = uy * v.speed;
    return v;
  }

  driveAir(v, dt, game) {
    const ai = v.ai;
    const spec = VEHICLE_TYPES[v.kind];
    ai.t += dt;
    // Il muso insegue sempre la rotta: nessuna di queste fasi vira.
    let diff = ai.course - v.angle;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    v.steer = clamp(diff * 2.2, -1, 1);
    v.handbrake = false;

    switch (ai.phase) {
      case 'roll': {
        // Corsa di decollo: gas a tavoletta finché non porta, poi cabra.
        v.throttle = 1;
        v.climb = Math.abs(v.speed) > spec.rotate ? 1 : 0;
        if (v.z > 200) { ai.phase = 'cruise'; ai.rw = null; }
        break;
      }
      case 'final': {
        // Discesa sull'asse: si punta la soglia e si tiene la velocità di
        // avvicinamento. Sotto i 12 px di quota si è atterrati.
        const target = spec.rotate * 1.15;
        v.throttle = v.speed < target ? 0.5 : -0.2;
        v.climb = v.z > 4 ? -1 : 0;
        if (v.z <= 4) {
          ai.phase = 'rollout';
          ai.apron = this.apronPoint(ai.rw);
        }
        break;
      }
      case 'rollout': {
        v.throttle = -1;
        v.climb = 0;
        if (Math.abs(v.speed) < 55) ai.phase = 'taxi';
        break;
      }
      case 'taxi': {
        // Rullaggio al piazzale: dritto, piano e senza cerimonie. Arrivato, il
        // velivolo smette di essere di questo file e diventa uno dei mezzi fermi
        // che chiunque può rubare — esattamente come quelli messi al boot.
        const ap = ai.apron;
        if (!ap) { this.park(v, game); break; }
        const d = dist(v.x, v.y, ap.x, ap.y);
        let a = Math.atan2(ap.y - v.y, ap.x - v.x) - v.angle;
        while (a > Math.PI) a -= TAU;
        while (a < -Math.PI) a += TAU;
        v.steer = clamp(a * 2, -1, 1);
        v.throttle = Math.abs(v.speed) < 70 ? 0.35 : 0;
        v.climb = 0;
        if (d < 90 || ai.t > 150) this.park(v, game);
        break;
      }
      default: {
        // Crociera: si sale finché non si è arrivati in quota, poi si tiene tutto
        // e si esce di scena da soli.
        v.throttle = Math.abs(v.speed) < spec.topSpeed * 0.66 ? 0.6 : 0.1;
        v.climb = v.z < ai.cruiseZ - 20 ? 1 : 0;
        break;
      }
    }
  }

  /** Centro del piazzale servito da una pista, se ce n'è uno vicino. */
  apronPoint(rw) {
    if (!rw) return null;
    let best = null;
    let bestD = Infinity;
    for (const a of this.city.aprons || []) {
      const cx = a.x + a.w / 2;
      const cy = a.y + a.h / 2;
      const d = (cx - rw.cx) ** 2 + (cy - rw.cy) ** 2;
      if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
    }
    return bestD < 3000 * 3000 ? best : null;
  }

  /** Fine corsa: il velivolo resta lì fermo, come quelli messi al boot. */
  park(v, game) {
    const i = this.air.indexOf(v);
    if (i >= 0) this.air.splice(i, 1);
    v.driver = null;
    v.ai = null;
    v.throttle = 0;
    v.steer = 0;
    v.climb = 0;
    v.handbrake = true;
    v.moored = true;
    v.protect = true;
  }

  // --- acqua -----------------------------------------------------------------
  /**
   * Imbarcazioni con qualcuno al timone. Non c'è grafo in acqua, quindi non c'è
   * niente da seguire: si naviga a vista, tastando l'acqua davanti alla prua e
   * puntando un waypoint che è stato scelto **perché ci si arriva** — la rotta si
   * verifica campionando `isWater` lungo il segmento, che è l'unica cartina
   * nautica che questo gioco abbia.
   */
  updateMarine(dt, game) {
    const pl = game.player;
    for (let i = this.boats.length - 1; i >= 0; i--) {
      const v = this.boats[i];
      const lost = v.dead || v.driver !== 'ai' || dist(v.x, v.y, pl.x, pl.y) > 3400;
      if (lost) {
        this.boats.splice(i, 1);
        if (v.driver !== 'player') this.removeVehicle(v, game);
      }
    }
    this.boatT -= dt;
    if (this.boatT > 0 || this.boats.length >= MAX_BOATS || game.indoors) return;
    this.boatT = this.rng.range(6, 16);
    this.spawnBoat(game);
  }

  spawnBoat(game) {
    const pl = game.player;
    const spot = this.waterNear(game, pl.x, pl.y, 900, 2000, 26);
    if (!spot) return null;
    if (!outsideView(game, spot.x, spot.y, 120)) return null;
    const kind = this.rng.chance(0.3) ? 'ferry' : 'boat';
    const v = createVehicle(kind, spot.x, spot.y, this.rng.range(0, TAU), this.rng.int(0, 9));
    v.driver = 'ai';
    v.protect = true;
    v.lightsOn = game.isNight;
    v.ai = { mode: 'marine', wpX: 0, wpY: 0, t: 0, jamT: 0, recoverT: 0, turn: this.rng.chance(0.5) ? 1 : -1 };
    game.vehicles.push(v);
    this.boats.push(v);
    this.marineWaypoint(v, game);
    return v;
  }

  /** Un punto d'acqua a distanza utile da (x,y), o null. */
  waterNear(game, x, y, minD, maxD, tries = 18) {
    const city = this.city;
    for (let i = 0; i < tries; i++) {
      const a = this.rng.range(0, TAU);
      const d = this.rng.range(minD, maxD);
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (px < 120 || py < 120 || px > city.w - 120 || py > city.h - 120) continue;
      if (!city.isWater(px, py)) continue;
      return { x: px, y: py };
    }
    return null;
  }

  /** La rotta è navigabile? Otto campioni: una secca larga meno di così non esiste. */
  waterPath(x0, y0, x1, y1) {
    const city = this.city;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      if (!city.isWater(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  marineWaypoint(v, game) {
    const ai = v.ai;
    ai.t = 0;
    // Si preferisce tirare dritto: quattordici candidati ordinati per scarto dalla
    // prua, e si prende il primo che porta da qualche parte. Scegliere il più
    // lontano darebbe rotte perfette e virate impossibili.
    for (let i = 0; i < 14; i++) {
      const spread = i === 0 ? 0 : this.rng.range(-1.5, 1.5);
      const a = v.angle + spread;
      const d = this.rng.range(600, 1100);
      const px = v.x + Math.cos(a) * d;
      const py = v.y + Math.sin(a) * d;
      if (px < 120 || py < 120 || px > this.city.w - 120 || py > this.city.h - 120) continue;
      if (!this.waterPath(v.x, v.y, px, py)) continue;
      ai.wpX = px;
      ai.wpY = py;
      return;
    }
    // Nessuna via d'uscita davanti: si vira di bordo e si riprova al giro dopo.
    ai.wpX = v.x - Math.cos(v.angle) * 200;
    ai.wpY = v.y - Math.sin(v.angle) * 200;
  }

  driveMarine(v, dt, game) {
    const ai = v.ai;
    const city = this.city;
    ai.t += dt;
    if (ai.recoverT > 0) {
      ai.recoverT -= dt;
      v.throttle = -0.7;
      v.steer = ai.turn;
      if (ai.recoverT <= 0) this.marineWaypoint(v, game);
      return;
    }
    if (!ai.wpX || dist(v.x, v.y, ai.wpX, ai.wpY) < 140 || ai.t > 26) this.marineWaypoint(v, game);

    const cos = Math.cos(v.angle);
    const sin = Math.sin(v.angle);
    let aim = Math.atan2(ai.wpY - v.y, ai.wpX - v.x);
    // La riva non sta nel grafo: si tasta. Davanti terra, si vira dal lato che ha
    // ancora acqua — e se non ce l'ha nessuno dei due si insiste sempre dallo
    // stesso, o si oscilla in mezzo a un'insenatura senza uscirne mai.
    // Quanto avanti si tasta la riva. Corto apposta: il Han è largo 300 px, e un
    // sensore lungo mezzo fiume trova sempre l'altra sponda — la barca passa la
    // vita a scansare una riva che non stava per toccare, e non arriva mai in
    // velocità (misurato: 112 px/s contro i 208 di crociera).
    const look = 130 + Math.abs(v.speed) * 0.35;
    if (!city.isWater(v.x + cos * look, v.y + sin * look)) {
      const left = city.isWater(v.x + Math.cos(v.angle - 1) * look, v.y + Math.sin(v.angle - 1) * look);
      const right = city.isWater(v.x + Math.cos(v.angle + 1) * look, v.y + Math.sin(v.angle + 1) * look);
      if (left && !right) ai.turn = -1;
      else if (right && !left) ai.turn = 1;
      aim = v.angle + ai.turn * 1.3;
    }
    let diff = aim - v.angle;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    v.steer = clamp(diff * 2, -1, 1);
    const spec = VEHICLE_TYPES[v.kind];
    const target = spec.topSpeed * (Math.abs(diff) > 0.8 ? 0.3 : 0.62);
    v.throttle = v.speed < target ? 0.8 : 0;
    v.handbrake = false;

    // Incastrata sulla riva: in acqua non passa nessuno a spostarla.
    if (Math.abs(v.speed) < 16) {
      ai.jamT += dt;
      if (ai.jamT > 2.2) {
        ai.jamT = 0;
        ai.recoverT = 1.4;
        ai.turn = -ai.turn;
      }
    } else {
      ai.jamT = 0;
    }
  }

  // --- campagna --------------------------------------------------------------
  /**
   * Braccianti. Un campo è un rettangolo dipinto (`block.fields`), non un solido:
   * ci si può stare dentro, ed è tutto quello che serve a farci lavorare qualcuno.
   * Il turno lo detta l'orologio — di giorno si sta nel campo, la sera si rincasa
   * e si sparisce dietro la porta della cascina — e questo è anche l'unico modo di
   * far sentire il ciclo giorno-notte fuori dalla città, dove non ci sono insegne
   * che si accendono.
   */
  updateRural(dt, game) {
    const pl = game.player;
    for (let i = this.farmers.length - 1; i >= 0; i--) {
      const p = this.farmers[i];
      if (!alive(p) || (p.state !== 'work' && p.state !== 'commute')) {
        if (alive(p)) this.release(p);
        this.farmers.splice(i, 1);
      }
    }
    const working = this.workHours(game);
    // Fine turno: si rincasa. Chi è già a casa lo toglie `pedestrians.updatePed`.
    if (!working) {
      for (const p of this.farmers) if (p.state === 'work') p.state = 'commute';
    }
    this.updateTractors(dt, game, working);

    this.ruralT -= dt;
    if (this.ruralT > 0) return;
    this.ruralT = 1.1;
    if (!working || this.farmers.length >= MAX_FARMERS || game.indoors) return;

    const R = 1500;
    const blocks = this.city.blockGrid.queryRect(pl.x - R, pl.y - R, R * 2, R * 2);
    for (const b of blocks) {
      if (b.type !== 'rural' || !b.fields || !b.fields.length) continue;
      let here = 0;
      for (const p of this.farmers) if (p.job && p.job.block === b) here++;
      if (here >= 3) continue;
      const f = this.rng.pick(b.fields);
      const x = f.x + this.rng.range(10, Math.max(11, f.w - 10));
      const y = f.y + this.rng.range(10, Math.max(11, f.h - 10));
      const d = dist(x, y, pl.x, pl.y);
      // Un campo è grande e sgombro: comparirci dentro a vista si nota. Si accetta
      // solo fuori inquadratura, oppure abbastanza lontano da non essere un lampo.
      if (d > R || (!outsideView(game, x, y, 60) && d < 800)) continue;
      const p = createPed(this.rng.chance(0.6) ? 'worker' : 'civil', x, y, this.rng);
      p.job = { block: b, field: f };
      p.home = this.homeOf(b);
      p.state = 'work';
      p.idleT = this.rng.range(0, 3);
      game.peds.push(p);
      this.farmers.push(p);
      return;
    }
  }

  /** Ore di lavoro: si comincia col sole e si smonta quando cala. */
  workHours(game) {
    const h = game.dayCycle ? game.dayCycle.hour : 12;
    return h >= 6 && h < 19;
  }

  /**
   * Dove torna la sera. Un fabbricato dell'isolato — la cascina o il fienile — e
   * il punto è **davanti** alla sua sagoma, non dentro: da lì il pedone sparisce,
   * ed è la porta di casa raccontata senza costruirne una.
   */
  homeOf(block) {
    if (block._home) return block._home;
    const near = this.city.buildingGrid.queryRect(block.x, block.y, block.w, block.h);
    let best = null;
    let bestD = Infinity;
    const cx = block.x + block.w / 2;
    const cy = block.y + block.h / 2;
    for (const b of near) {
      if (b.w > 170 || b.h > 170) continue;
      const d = (b.x + b.w / 2 - cx) ** 2 + (b.y + b.h / 2 - cy) ** 2;
      if (d < bestD) { bestD = d; best = b; }
    }
    block._home = best
      ? { x: best.x + best.w / 2, y: best.y + best.h + 15 }
      : { x: cx, y: cy };
    return block._home;
  }

  /**
   * Il trattore nel campo. Non vaga: fa i solchi, avanti e indietro lungo il lato
   * lungo, spostandosi di una fila a ogni testata. Un trattore che gira a caso in
   * un campo non si legge come lavoro, si legge come un guasto.
   */
  updateTractors(dt, game, working) {
    const pl = game.player;
    for (let i = this.tractors.length - 1; i >= 0; i--) {
      const v = this.tractors[i];
      // A fine turno il trattore smonta, ma non davanti a chi lo sta guardando: un
      // mezzo che si smaterializza in mezzo a un campo è peggio di un mezzo che
      // lavora un quarto d'ora di troppo.
      const lost = v.dead || v.driver !== 'ai'
        || dist(v.x, v.y, pl.x, pl.y) > 2400
        || (!working && outsideView(game, v.x, v.y, 140));
      if (lost) {
        this.tractors.splice(i, 1);
        if (v.driver !== 'player') this.removeVehicle(v, game);
      }
    }
    if (!working || this.tractors.length >= 1 || game.indoors) return;
    const R = 1400;
    for (const b of this.city.blockGrid.queryRect(pl.x - R, pl.y - R, R * 2, R * 2)) {
      if (b.type !== 'rural' || !b.fields) continue;
      for (const f of b.fields) {
        if (f.w < 200 || f.h < 160) continue;
        const d = dist(f.x + f.w / 2, f.y + f.h / 2, pl.x, pl.y);
        if (d > R || d < 300) continue;
        const horiz = f.w >= f.h;
        const v = createVehicle('tractor', f.x + 30, f.y + 30, horiz ? 0 : Math.PI / 2, this.rng.int(0, 9));
        v.driver = 'ai';
        v.protect = true;
        v.lightsOn = game.isNight;
        v.ai = { mode: 'field', field: f, horiz, row: 0, end: 1, rows: Math.max(2, Math.floor((horiz ? f.h : f.w) / 46)) };
        game.vehicles.push(v);
        this.tractors.push(v);
        return;
      }
    }
  }

  driveField(v, dt, game) {
    const ai = v.ai;
    const f = ai.field;
    const span = ai.horiz ? f.h : f.w;
    const lane = f[ai.horiz ? 'y' : 'x'] + 24 + (ai.row % ai.rows) * ((span - 48) / ai.rows);
    const along = ai.end > 0
      ? (ai.horiz ? f.x + f.w - 26 : f.y + f.h - 26)
      : (ai.horiz ? f.x + 26 : f.y + 26);
    const tx = ai.horiz ? along : lane;
    const ty = ai.horiz ? lane : along;
    if (dist(v.x, v.y, tx, ty) < 44) {
      ai.end = -ai.end;
      ai.row++;
    }
    let diff = Math.atan2(ty - v.y, tx - v.x) - v.angle;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    v.steer = clamp(diff * 2.2, -1, 1);
    v.throttle = Math.abs(v.speed) < (Math.abs(diff) > 0.9 ? 42 : 78) ? 0.7 : 0;
    v.handbrake = false;
  }

  // --- raduni ----------------------------------------------------------------
  /**
   * Capannelli. Nessuno di questi pedoni è nuovo: si prende gente che stava già
   * passando di lì e le si dà un posto in cerchio (o in fila davanti a una porta)
   * e qualcosa da dire. È il motivo per cui un raduno costa quanto tre pedoni
   * fermi e non si vede mai comparire dal nulla.
   */
  updateCrowds(dt, game) {
    const pl = game.player;
    for (let i = this.crowds.length - 1; i >= 0; i--) {
      const c = this.crowds[i];
      c.t += dt;
      for (let k = c.members.length - 1; k >= 0; k--) {
        const p = c.members[k];
        if (alive(p) && p.state === 'gather') continue;
        // Chi se ne va smette anche di parlare: solo lo stato `gather` scala
        // `talkT`, e un pedone strappato via da uno spavento resterebbe con la
        // nuvoletta sopra la testa per il resto della partita.
        if (p) p.talkT = 0;
        c.members.splice(k, 1);
      }
      if (c.members.length < 2 || c.t > c.life || dist(c.x, c.y, pl.x, pl.y) > 2200) {
        this.dissolve(c);
        this.crowds.splice(i, 1);
        continue;
      }
      this.chatter(c, dt, game);
    }
    this.crowdT -= dt;
    if (this.crowdT > 0 || this.crowds.length >= MAX_CROWDS || game.indoors) return;
    this.crowdT = this.rng.range(9, 20);
    this.startCrowd(game);
  }

  dissolve(c) {
    for (const p of c.members) {
      if (!alive(p) || p.state !== 'gather') continue;
      p.state = 'walk';
      p.talkT = 0;
      p.idleT = 0;
    }
    c.members.length = 0;
  }

  /**
   * Chi parla. Uno per volta e mai a lungo: due nuvolette contemporanee dall'alto
   * si leggono come un errore di disegno, e una conversazione in cui parlano tutti
   * insieme non è una conversazione.
   */
  chatter(c, dt, game) {
    c.talkT -= dt;
    if (c.talkT > 0) return;
    c.talkT = this.rng.range(1.6, 3.4);
    const p = this.rng.pick(c.members);
    if (!alive(p)) return;
    for (const o of c.members) o.talkT = 0;
    p.talkT = this.rng.range(1.1, 2.2);
    // Qualche parola si sente, non tutte: una folla che borbotta a ogni battuta
    // diventa un letto continuo, e questo è un colpo secco.
    this.chatT -= dt;
    if (this.chatT <= 0 && dist(p.x, p.y, game.player.x, game.player.y) < 620) {
      this.chatT = this.rng.range(1.5, 4);
      game.audio?.chatter(p.x, p.y, p.voice);
    }
    // Piccolo assestamento: in un capannello nessuno resta piantato sul suo pixel.
    for (const o of c.members) {
      if (o.slotA === undefined) continue;
      const r = c.r + this.rng.range(-4, 4);
      o.spotX = c.x + Math.cos(o.slotA) * r;
      o.spotY = c.y + Math.sin(o.slotA) * r;
    }
  }

  startCrowd(game) {
    let spot = null;
    if (this.rng.chance(0.4)) spot = this.queueSpot(game);
    if (!spot) spot = this.circleSpot(game);
    if (!spot) return null;

    // Si recluta chi sta già passando di lì e non ha di meglio da fare. Il raggio
    // è corto apposta: da trecento pixel ci si mette sei secondi ad arrivare, e
    // per sei secondi il capannello è tre persone che camminano verso un punto.
    // Sotto i 250 però non si trova più nessuno da reclutare e i capannelli non
    // si formano affatto: 260 è il punto in cui le due cose stanno insieme.
    const members = [];
    for (const p of game.pedGrid.queryCircle(spot.x, spot.y, 260)) {
      if (!alive(p) || p.cop || p.turf || p.hostile || p.panic > 0) continue;
      if (p.state !== 'walk' && p.state !== 'idle') continue;
      members.push(p);
      if (members.length >= 6) break;
    }
    if (members.length < 3) return null;

    const c = {
      x: spot.x, y: spot.y, r: spot.r, kind: spot.kind,
      members, t: 0, talkT: 1, life: this.rng.range(28, 70),
    };
    for (let i = 0; i < members.length; i++) {
      const p = members[i];
      p.state = 'gather';
      p.talkT = 0;
      if (spot.kind === 'queue') {
        // In fila: uno dietro l'altro lungo la normale della vetrina, tutti
        // rivolti alla porta. La coda è l'unico raduno che ha un davanti.
        p.slotA = undefined;
        p.spotX = spot.x + spot.nx * (i * 26) - spot.ny * this.rng.range(-5, 5);
        p.spotY = spot.y + spot.ny * (i * 26) + spot.nx * this.rng.range(-5, 5);
        p.faceA = Math.atan2(-spot.ny, -spot.nx);
      } else {
        p.slotA = (i / members.length) * TAU + this.rng.range(-0.2, 0.2);
        p.spotX = spot.x + Math.cos(p.slotA) * spot.r;
        p.spotY = spot.y + Math.sin(p.slotA) * spot.r;
        p.faceA = p.slotA + Math.PI;
      }
    }
    this.crowds.push(c);
    return c;
  }

  /** Una fila davanti a una vetrina aperta. */
  queueSpot(game) {
    const pl = game.player;
    let best = null;
    let bestD = Infinity;
    for (const s of this.city.shops || []) {
      const d = dist(s.x, s.y, pl.x, pl.y);
      if (d < 260 || d > 900 || d > bestD) continue;
      bestD = d;
      best = s;
    }
    if (!best) return null;
    return {
      kind: 'queue',
      x: best.x + best.nx * 26, y: best.y + best.ny * 26,
      nx: best.nx, ny: best.ny, r: 0,
    };
  }

  /** Un crocchio: un pezzo di marciapiede libero, o il bidone acceso di un cortile. */
  circleSpot(game) {
    const pl = game.player;
    const R = 900;
    const blocks = this.city.blockGrid.queryRect(pl.x - R, pl.y - R, R * 2, R * 2);
    for (let i = 0; i < 14; i++) {
      const b = this.rng.pick(blocks);
      if (!b || b.type === 'rural' || b.type === 'airport') continue;
      const side = this.rng.int(0, 3);
      const t = this.rng.range(0.2, 0.8);
      const m = 16;
      const x = side === 1 ? b.x + b.w - m : side === 3 ? b.x + m : b.x + t * b.w;
      const y = side === 0 ? b.y + m : side === 2 ? b.y + b.h - m : b.y + t * b.h;
      const d = dist(x, y, pl.x, pl.y);
      if (d < 220 || d > R) continue;
      return { kind: 'circle', x, y, r: this.rng.range(26, 34) };
    }
    return null;
  }

  // --- cronaca nera ----------------------------------------------------------
  updateEvents(dt, game) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const ev = this.events[i];
      ev.t += dt;
      const far = dist(ev.x, ev.y, game.player.x, game.player.y) > 3000;
      if (ev.over || far || ev.t > ev.life) {
        this.endEvent(ev, game, far);
        this.events.splice(i, 1);
        continue;
      }
      if (ev.kind === 'rob') this.updateRobbery(ev, dt, game);
      else this.updateWar(ev, dt, game);
    }
    this.eventT -= dt;
    if (this.eventT > 0 || this.events.length >= MAX_EVENTS || game.indoors) return;
    this.eventT = this.rng.range(26, 55);
    if (this.rng.chance(0.45) && this.startWar(game)) return;
    this.startRobbery(game);
  }

  /** Chi era dentro un evento e ne è uscito torna a essere un passante qualunque. */
  release(p) {
    p.ev = null;
    p.role = null;
    p.aggro = null;
    p.job = null;
    p.home = null;
    p.talkT = 0;
    if (p.state === 'errand' || p.state === 'work' || p.state === 'commute' || p.state === 'gather') {
      p.state = p.turf ? 'guard' : 'walk';
    }
  }

  endEvent(ev, game, hard) {
    ev.over = true;
    for (const p of ev.crew || []) {
      if (!alive(p)) continue;
      this.release(p);
      if (hard) p.gone = true;
      else p.panic = 3;
    }
    for (const p of ev.guards || []) {
      if (alive(p)) this.release(p);
    }
    for (const u of ev.units || []) this.dropUnit(u, game, hard);
    if (ev.car && ev.car.driver !== 'player') {
      // L'auto della fuga resta in strada come qualunque altra lamiera: cancellarla
      // sotto gli occhi di chi la stava inseguendo sarebbe peggio del contrario.
      ev.car.protect = false;
      if (ev.car.ai && ev.car.ai.mode === 'flee') {
        ev.car.ai = null;
        ev.car.driver = null;
        ev.car.handbrake = true;
      }
      if (hard) this.removeVehicle(ev.car, game);
    }
  }

  // --- rapina ----------------------------------------------------------------
  /**
   * 강도. Quattro tempi: si arriva alla vetrina, si spara un colpo in aria (ed è
   * quel colpo a far scappare la strada, senza una riga di codice apposta), si
   * torna all'auto e si scappa. La volante arriva mentre sei ancora dentro il
   * negozio, che è l'unico modo di far vedere al giocatore *tutta* la scena
   * invece del solo finale.
   */
  startRobbery(game) {
    const pl = game.player;
    let shop = null;
    let bestD = Infinity;
    for (const s of this.city.shops || []) {
      const d = dist(s.x, s.y, pl.x, pl.y);
      if (d < EVENT_MIN || d > EVENT_MAX || d > bestD) continue;
      if (!outsideView(game, s.x, s.y, 40)) continue;
      bestD = d;
      shop = s;
    }
    if (!shop) return null;

    const road = this.getawaySpot(game, shop);
    if (!road) return null;
    const car = createVehicle(this.rng.chance(0.5) ? 'van' : 'sedan', road.x, road.y, road.angle, this.rng.int(0, 9));
    car.driver = null;
    car.handbrake = true;
    car.protect = true;
    car.lightsOn = game.isNight;
    if (road.spot) { car.spot = road.spot; road.spot.taken = true; }
    game.vehicles.push(car);

    const ev = {
      kind: 'rob', x: shop.x, y: shop.y, shop, car,
      crew: [], units: [], phase: 'arrive', t: 0, phaseT: 0, life: 150, over: false,
      dispatched: false, told: false,
    };
    const n = this.rng.int(1, 2);
    for (let i = 0; i < n; i++) {
      const p = createPed('gangster', car.x + this.rng.range(-26, 26), car.y + this.rng.range(-26, 26), this.rng);
      p.armed = true;
      p.role = 'robber';
      p.ev = ev;
      p.state = 'errand';
      p.fireT = this.rng.range(0.3, 1);
      game.peds.push(p);
      ev.crew.push(p);
    }
    this.events.push(ev);
    return ev;
  }

  updateRobbery(ev, dt, game) {
    ev.phaseT += dt;
    const live = ev.crew.filter((p) => alive(p) && p.state === 'errand');
    if (!live.length) { ev.over = true; return; }

    switch (ev.phase) {
      case 'arrive': {
        const door = ev.shop;
        const at = live.every((p) => dist(p.x, p.y, door.x + door.nx * 20, door.y + door.ny * 20) < 46);
        if (at || ev.phaseT > 25) {
          ev.phase = 'rob';
          ev.phaseT = 0;
          // Il colpo in aria: `shoot` chiama già `game.alarm`, quindi la strada si
          // svuota da sola. È anche il momento in cui il giocatore capisce, da
          // due isolati, che sta succedendo qualcosa.
          const p = live[0];
          const a = Math.atan2(door.ny, door.nx);
          p.angle = a;
          shoot(game, p, WEAPONS.pistol, p.x + Math.cos(a) * 13, p.y + Math.sin(a) * 13, a, { spreadMul: 3 });
          // Il nome dell'attività si mette dopo i due punti e non dentro la frase:
          // `BUSINESSES` ha etichette di genere diverso («tavola calda», «banco dei
          // pegni»), e qualunque articolo scritto qui sarebbe sbagliato per metà.
          this.tell(game, ev, `강도 — rapina in corso: ${ev.shop.hangul} ${ev.shop.name}`);
        }
        break;
      }
      case 'rob': {
        if (ev.phaseT > 2 && !ev.dispatched) {
          ev.dispatched = true;
          this.spawnUnit(game, ev);
        }
        if (ev.phaseT > this.robTime(ev)) {
          ev.phase = 'escape';
          ev.phaseT = 0;
        }
        break;
      }
      case 'escape': {
        // Se la fuga non parte entro mezzo minuto non partirà più: chi è rimasto
        // molla il colpo e scappa a piedi come chiunque altro.
        if (ev.phaseT > 30) { ev.over = true; break; }
        // Chi arriva alla portiera sale e sparisce: la scena è l'auto che riparte,
        // non due sagome che si infilano dentro una carrozzeria.
        for (const p of live) {
          if (!ev.car || ev.car.dead || dist(p.x, p.y, ev.car.x, ev.car.y) > 34) continue;
          p.gone = true;
          ev.boarded = (ev.boarded || 0) + 1;
        }
        const still = ev.crew.filter((p) => alive(p) && p.state === 'errand');
        if (!still.length) {
          if (ev.boarded && ev.car && !ev.car.dead && ev.car.driver === null) {
            ev.car.driver = 'ai';
            ev.car.handbrake = false;
            // Lo stallo si libera adesso, non quando l'auto sparirà: finché resta
            // `taken` il traffico non ci parcheggia più nessuno, e `countParked`
            // conta come in sosta una macchina che sta scappando.
            this.freeSpot(ev.car);
            ev.car.ai = { mode: 'flee', t: 0 };
            ev.car.copAi = { edge: null, dir: 1, lane: 0, s: 0, jamT: 0, recoverT: 0, recoverSteer: 1, fireT: 0 };
            ev.phase = 'chase';
            ev.phaseT = 0;
            ev.life = Math.min(ev.life, ev.t + 60);
          } else {
            ev.over = true;
          }
        }
        break;
      }
      default: {
        // In fuga con la volante dietro: l'evento vive finché l'auto è viva e a
        // portata di sguardo. Poi la strada se la riprende.
        if (!ev.car || ev.car.dead || ev.car.driver === 'player') ev.over = true;
        break;
      }
    }
  }

  /**
   * Dove aspetta l'auto della fuga. **Non in mezzo alla corsia**: una lamiera
   * ferma su una via da 76 px chiude la strada, il traffico civile le frena
   * dietro (`senseAhead`) e in venti secondi c'è la coda di mezzo quartiere —
   * visto a schermo, ed è il modo peggiore in cui una scena di regia può
   * rovinare il gioco che ci sta attorno.
   *
   * Prima gli stalli veri che il traffico usa già (cortili e vicoli): sono fuori
   * carreggiata per costruzione, e un'auto che aspetta nel vicolo dietro il
   * negozio è anche la scena giusta. Solo se non ce n'è si ripiega su un
   * **boulevard**, dove restano tre corsie libere.
   */
  getawaySpot(game, shop) {
    const spots = game.traffic ? game.traffic.parkingSpots : null;
    if (spots) {
      let best = null;
      let bestD = 520 * 520;
      for (const s of spots) {
        if (s.taken) continue;
        const d = (s.x - shop.x) ** 2 + (s.y - shop.y) ** 2;
        if (d >= bestD) continue;
        // Lo stallo dev'essere anche sgombro da arredo, come in `spawnParkedNear`:
        // la lista dice dove *ci sta* un'auto, non che lì non ci sia un fusto.
        let blocked = false;
        for (const o of this.city.solidGrid.queryRect(s.x - 40, s.y - 40, 80, 80)) {
          if (circleRectPush(s.x, s.y, 22, o)) { blocked = true; break; }
        }
        if (blocked) continue;
        bestD = d;
        best = s;
      }
      if (best) return { x: best.x, y: best.y, angle: best.angle, spot: best };
    }
    const near = this.city.graph.edgesNear(shop.x, shop.y, 340);
    for (let i = 0; i < 14; i++) {
      const edge = this.rng.pick(near);
      if (!edge || !edge.arterial) continue;
      const dir = this.rng.chance(0.5) ? 1 : -1;
      const s = this.rng.range(20, Math.max(24, edge.len - 20));
      const pt = lanePoint(edge, dir, laneCount(edge) - 1, s, this.tmp);
      if (dist(pt.x, pt.y, shop.x, shop.y) > 340) continue;
      return { x: pt.x, y: pt.y, angle: pt.angle, spot: null };
    }
    return null;
  }

  robTime(ev) {
    if (ev.robT === undefined) ev.robT = this.rng.range(5, 9);
    return ev.robT;
  }

  /** Ordini per un rapinatore. */
  orderRobber(p, dt, game, ev) {
    const running = ev.phase === 'escape' || ev.phase === 'chase';
    // Chi sta scappando spara solo a chi gli si mette davanti. Con la stessa
    // portata dell'attesa (380 px) i due si piantavano a duellare con l'agente da
    // un capo all'altro della strada, e la fuga non partiva più: misurato, un
    // minuto pieno di colpi e nessuno a terra.
    const foe = this.pickFoe(p, game, ev, running ? 190 : 380);
    if (foe) return this.engage(p, foe, game, 150, 340);
    if (running) {
      if (!ev.car || ev.car.dead) { this.release(p); p.panic = 4; return null; }
      return { x: ev.car.x, y: ev.car.y, speed: p.baseSpeed * 2 };
    }
    const door = ev.shop;
    const tx = door.x + door.nx * 20;
    const ty = door.y + door.ny * 20;
    const d = dist(p.x, p.y, tx, ty);
    if (ev.phase === 'rob' && d < 40) {
      p.angle = Math.atan2(door.ny, door.nx);
      return { x: p.x, y: p.y, speed: 0 };
    }
    return { x: tx, y: ty, speed: p.baseSpeed * (d > 90 ? 1.8 : 1) };
  }

  // --- guerra fra bande ------------------------------------------------------
  /**
   * 전쟁. Un territorio esiste già, con i suoi uomini dentro (`pedestrians.spawnTurf`):
   * la guerra è quello che succede quando ne arriva una manciata di un'altra
   * banda. Le guardie non diventano nemiche del giocatore — restano quello che
   * erano — cambiano solo bersaglio per il tempo della sparatoria, e a cose fatte
   * chi è rimasto in piedi torna al suo giro di ronda.
   */
  startWar(game) {
    const pl = game.player;
    let turf = null;
    let bestD = Infinity;
    for (const t of this.city.turfs || []) {
      const d = dist(t.cx, t.cy, pl.x, pl.y);
      if (d < 400 || d > 1700 || d > bestD) continue;
      bestD = d;
      turf = t;
    }
    if (!turf) return null;
    const guards = game.peds.filter((p) => alive(p) && p.turf === turf && p.state === 'guard');
    if (guards.length < 2) return null;
    const rival = GANGS.filter((g) => g.id !== turf.gang);
    const gang = this.rng.pick(rival);

    const ev = {
      kind: 'war', x: turf.cx, y: turf.cy, turf, gang,
      crew: [], guards: [], units: [], t: 0, life: 110, over: false,
      dispatched: false, told: false,
    };
    // Gli incursori arrivano da un lato solo: due gruppetti che convergono da
    // punti opposti si leggono come uno spawn, non come un'incursione.
    const a = this.rng.range(0, TAU);
    const rad = Math.max(turf.w, turf.h) * 0.6 + 130;
    for (let i = 0; i < this.rng.int(2, 3); i++) {
      const x = turf.cx + Math.cos(a) * rad + this.rng.range(-34, 34);
      const y = turf.cy + Math.sin(a) * rad + this.rng.range(-34, 34);
      const p = createPed('gangster', x, y, this.rng);
      p.armed = true;
      p.gang = gang.id;
      p.role = 'raider';
      p.ev = ev;
      p.state = 'errand';
      p.fireT = this.rng.range(0.2, 1.2);
      game.peds.push(p);
      ev.crew.push(p);
    }
    for (const g of guards) {
      g.role = 'defender';
      g.ev = ev;
      g.state = 'errand';
      g.armed = true;
      g.fireT = this.rng.range(0.4, 1.4);
      ev.guards.push(g);
    }
    this.events.push(ev);
    this.tell(game, ev, `전쟁 — ${gang.hangul} contro ${turf.hangul}`);
    return ev;
  }

  updateWar(ev, dt, game) {
    // La chiamata parte **prima** di guardare chi è ancora in piedi: una guerra
    // fra due bande si decide in una decina di secondi, e mettendo il controllo
    // dopo la volante non partiva mai — quando c'era qualcuno da arrestare era
    // già tutto finito (misurato: zero volanti su tre prove).
    if (!ev.dispatched && ev.t > 4) {
      ev.dispatched = true;
      this.spawnUnit(game, ev);
    }
    const raiders = ev.crew.filter((p) => alive(p) && p.state === 'errand');
    const guards = ev.guards.filter((p) => alive(p) && p.state === 'errand');
    if (!raiders.length || !guards.length) {
      // Una parte è a terra: chi resta si prende qualche secondo e poi si scioglie.
      // Se però la volante è già per strada le si lascia il tempo di arrivare: una
      // sparatoria che si smonta un istante prima che la polizia svolti l'angolo è
      // una scena buttata.
      ev.calmT = (ev.calmT || 0) + dt;
      if (ev.calmT > (ev.units.length ? 16 : 5)) ev.over = true;
      return;
    }
  }

  /** Ordini per chi combatte in una guerra: incursore o difensore, stesso mestiere. */
  orderFighter(p, dt, game, ev) {
    const foe = this.pickFoe(p, game, ev, 700);
    if (!foe) {
      if (p.role === 'defender' && p.turf) {
        return { x: p.turf.cx, y: p.turf.cy, speed: p.baseSpeed * 0.7 };
      }
      return { x: ev.x, y: ev.y, speed: p.baseSpeed * 1.2 };
    }
    return this.engage(p, foe, game, p.role === 'defender' ? 190 : 140, 330);
  }

  // --- volanti degli eventi --------------------------------------------------
  /**
   * Un'unità di quartiere: una volante e il suo equipaggio. Non entra in
   * `police.cars` — quella lista è la caccia al giocatore, e ci finisce dentro
   * ricercato, assedio e arresto. Qui si riusa solo `followRoads`, che di
   * bersagli non sa niente: gli si dà un punto e guida.
   */
  spawnUnit(game, ev) {
    const spot = this.roadPointNear(ev.x, ev.y, 1100, 520);
    if (!spot) return null;
    const v = createVehicle('police', spot.x, spot.y, spot.angle, 0);
    v.driver = 'cop';
    v.copUnit = true;
    v.siren = true;
    v.protect = true;
    v.lightsOn = game.isNight;
    v.copWeapon = 'pistol';
    v.copAi = { edge: spot.edge, dir: spot.dir, lane: spot.lane, s: spot.s, jamT: 0, recoverT: 0, recoverSteer: 1, fireT: 1 };
    v.unit = { ev, cops: [], deployed: false, arrestT: 0 };
    game.vehicles.push(v);
    this.units.push(v);
    ev.units.push(v);
    return v;
  }

  updateUnits(dt, game) {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const v = this.units[i];
      const u = v.unit;
      const ev = u ? u.ev : null;
      const dead = v.dead || v.driver !== 'cop' || !ev || ev.over;
      if (dead) {
        this.units.splice(i, 1);
        if (ev) {
          const k = ev.units.indexOf(v);
          if (k >= 0) ev.units.splice(k, 1);
        }
        this.dropUnit(v, game, false);
        continue;
      }
      this.driveUnit(v, u, ev, dt, game);
    }
  }

  driveUnit(v, u, ev, dt, game) {
    const target = this.suspectPoint(ev);
    if (!target) { v.throttle = 0; v.steer = 0; v.handbrake = true; return; }

    if (u.deployed) {
      // Sbarcato l'equipaggio la volante resta ferma coi lampeggianti accesi: una
      // volante vuota che continua a inseguire è la trappola già pagata in §4.
      v.throttle = 0;
      v.steer = 0;
      v.handbrake = true;
      u.cops = u.cops.filter((p) => alive(p) && p.state === 'errand');
      if (!u.cops.length) u.deployed = false;
      return;
    }

    const ai = v.copAi;
    if (ai.recoverT > 0) {
      ai.recoverT -= dt;
      v.throttle = -0.6;
      v.steer = ai.recoverSteer;
      v.handbrake = false;
      if (ai.recoverT <= 0) game.police.snapToRoad(v);
      return;
    }

    const d = dist(v.x, v.y, target.x, target.y);
    // Sospetti a piedi e siamo addosso: da qui in poi è un problema dei due agenti.
    if (target.onFoot && d < 240) {
      v.throttle = -1;
      v.steer = 0;
      if (Math.abs(v.speed) < 55) this.deployUnit(v, u, ev, game);
      return;
    }
    game.police.followRoads(v, dt, game, target.x, target.y);

    if (Math.abs(v.speed) < 12) {
      ai.jamT += dt;
      if (ai.jamT > 1.8) {
        ai.jamT = 0;
        ai.recoverT = 0.9;
        ai.recoverSteer = this.rng.chance(0.5) ? 1 : -1;
      }
    } else {
      ai.jamT = 0;
    }
  }

  deployUnit(v, u, ev, game) {
    const spec = VEHICLE_TYPES[v.kind];
    const cos = Math.cos(v.angle);
    const sin = Math.sin(v.angle);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const p = createPed('cop', v.x - sin * spec.wid * 0.9 * side, v.y + cos * spec.wid * 0.9 * side, this.rng);
      // `cop` vero: prende l'anello blu, non scappa davanti alle auto e se gli
      // spari sei tu a finire sul registro della centrale. Quello che *non* fa è
      // passare da `copBehavior`, perché il suo stato è `errand` e non `duty`: la
      // caccia al giocatore è un'altra cosa e ha un altro file.
      p.cop = true;
      p.armed = true;
      p.copWeapon = 'pistol';
      p.role = 'lawman';
      p.ev = ev;
      p.state = 'errand';
      p.fireT = this.rng.range(0.3, 1);
      game.peds.push(p);
      u.cops.push(p);
    }
    v.handbrake = true;
    v.throttle = 0;
    u.deployed = true;
  }

  dropUnit(v, game, hard) {
    const u = v.unit;
    if (u) {
      for (const p of u.cops) {
        if (!alive(p)) continue;
        this.release(p);
        if (hard) p.gone = true;
        else { p.cop = false; p.armed = false; }
      }
      u.cops.length = 0;
    }
    v.unit = null;
    v.siren = false;
    v.copUnit = false;
    v.protect = false;
    // Se al volante c'è finito il giocatore la volante non è più roba nostra:
    // scriverle freno a mano e gas addosso gliela pianterebbe per un frame.
    if (v.driver === 'player') return;
    if (v.driver === 'cop') v.driver = null;
    v.handbrake = true;
    v.throttle = 0;
    if (hard) this.removeVehicle(v, game);
  }

  /** Ordini per un agente di quartiere: chiudere la distanza e, se serve, sparare. */
  orderLawman(p, dt, game, ev) {
    const foe = this.pickFoe(p, game, ev, 900);
    if (!foe) {
      const t = this.suspectPoint(ev);
      if (!t) return { x: p.x, y: p.y, speed: 0 };
      return { x: t.x, y: t.y, speed: p.baseSpeed * 1.8 };
    }
    // Fermo invece che fuoco: chi è quasi a terra si porta via, non si finisce.
    if (foe.hp < foe.maxHp * 0.45) {
      const d = dist(p.x, p.y, foe.x, foe.y);
      if (d < 30) {
        p.arrestT = (p.arrestT || 0) + dt;
        p.angle = Math.atan2(foe.y - p.y, foe.x - p.x);
        if (p.arrestT > 1.4) {
          p.arrestT = 0;
          foe.gone = true;
          this.tell(game, ev, '체포 — se lo portano via', 2);
        }
        return { x: p.x, y: p.y, speed: 0 };
      }
      p.arrestT = 0;
      return { x: foe.x, y: foe.y, speed: p.baseSpeed * 1.9 };
    }
    return this.engage(p, foe, game, 160, 340);
  }

  // --- meccanica comune degli scontri ----------------------------------------
  /**
   * Chiamata da `pedestrians.updatePed` per ogni pedone in stato `errand`:
   * restituisce dove andare e quanto forte, esattamente come `police.copBehavior`
   * per la divisa in servizio. Sparare lo fa direttamente qui.
   */
  order(p, dt, game) {
    const ev = p.ev;
    if (!ev || ev.over) { this.release(p); return null; }
    p.fireT -= dt;
    switch (p.role) {
      case 'robber': return this.orderRobber(p, dt, game, ev);
      case 'raider':
      case 'defender': return this.orderFighter(p, dt, game, ev);
      case 'lawman': return this.orderLawman(p, dt, game, ev);
      default: this.release(p); return null;
    }
  }

  /**
   * Chi si ha di fronte. Prima chi ci ha appena sparato (`aggro`, lo scrive
   * `pedestrians.hurt`): rispondere a chi ti colpisce viene prima di qualunque
   * piano, ed è anche quello che impedisce a due gruppi di ignorarsi mentre si
   * fanno fuori a vicenda.
   */
  pickFoe(p, game, ev, reach) {
    if (alive(p.aggro) && p.aggro.state === 'errand' && dist(p.x, p.y, p.aggro.x, p.aggro.y) < reach) {
      return p.aggro;
    }
    p.aggro = null;
    let best = null;
    let bestD = reach;
    for (const o of this.foes(ev, p.role)) {
      if (!alive(o) || o.state !== 'errand') continue;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  /**
   * Chi sta dall'altra parte. La legge è contro tutti, gli altri due solo fra
   * loro (più la legge). L'elenco si riempie in un array riusato: è una lista
   * chiesta da ogni combattente a ogni frame, e restituirne una nuova ogni volta
   * vorrebbe dire allocare per il solo gusto di scrivere `concat`.
   */
  foes(ev, role) {
    const out = this._foes;
    out.length = 0;
    if (role !== 'lawman') {
      for (const u of ev.units || []) if (u.unit) for (const c of u.unit.cops) out.push(c);
    }
    if (role !== 'defender') for (const p of ev.guards || []) out.push(p);
    if (role !== 'raider') for (const p of ev.crew || []) out.push(p);
    return out;
  }

  /**
   * Ingaggio: la stessa manovra per tutti e tre i mestieri. Si tiene la distanza
   * di tiro se il tiro c'è, ci si sbriga a girare l'angolo se in mezzo c'è un
   * muro. È lo stesso ragionamento dello stato `hostile` dei pedoni, con un
   * bersaglio che non è per forza il giocatore.
   */
  engage(p, foe, game, hold, range) {
    const d = dist(p.x, p.y, foe.x, foe.y);
    const aim = Math.atan2(foe.y - p.y, foe.x - p.x);
    const los = hasLineOfSight(game, p.x, p.y, foe.x, foe.y);
    if (!p.armed) {
      if (d < 40 && p.fireT <= 0) {
        p.fireT = WEAPONS.fists.rate * 2.6;
        p.angle = aim;
        meleeSwing(game, p, WEAPONS.fists, p.x, p.y, aim);
      }
      return { x: foe.x, y: foe.y, speed: p.baseSpeed * 1.9 };
    }
    const spec = WEAPONS[p.copWeapon] || WEAPONS.pistol;
    if (los && d < range && p.fireT <= 0) {
      p.fireT = spec.rate * 2.8 + Math.random() * 0.7;
      p.angle = aim;
      shoot(game, p, spec, p.x + Math.cos(aim) * 13, p.y + Math.sin(aim) * 13, aim, { spreadMul: 3 });
    }
    const stay = los && d < hold;
    const speed = p.baseSpeed * (!los || d > range ? 1.7 : stay ? 0.9 : 0.35);
    const reach = stay ? -100 : 110;
    return { x: p.x + Math.cos(aim) * reach, y: p.y + Math.sin(aim) * reach, speed };
  }

  /**
   * Dove sta il fatto adesso: l'auto in fuga, oppure il primo sospetto ancora in
   * piedi. Scrive in un oggetto riusato — lo chiedono le volanti e gli agenti a
   * ogni frame, e un punto è tre numeri, non un'allocazione.
   */
  suspectPoint(ev) {
    const out = this._pt;
    if (ev.car && !ev.car.dead && ev.car.driver === 'ai') {
      out.x = ev.car.x;
      out.y = ev.car.y;
      out.onFoot = false;
      return out;
    }
    out.onFoot = true;
    const suspects = this.foes(ev, 'lawman');
    for (const p of suspects) {
      if (!alive(p) || p.state !== 'errand') continue;
      out.x = p.x;
      out.y = p.y;
      return out;
    }
    if (ev.over) return null;
    out.x = ev.x;
    out.y = ev.y;
    return out;
  }

  /** Un punto di corsia attorno a (x,y): serve alle auto della fuga e alle volanti. */
  roadPointNear(x, y, reach, minD = 0) {
    const near = this.city.graph.edgesNear(x, y, reach);
    if (!near.length) return null;
    for (let i = 0; i < 16; i++) {
      const edge = this.rng.pick(near);
      const dir = this.rng.chance(0.5) ? 1 : -1;
      const lane = this.rng.int(0, laneCount(edge) - 1);
      const s = this.rng.range(20, Math.max(24, edge.len - 20));
      const pt = lanePoint(edge, dir, lane, s, this.tmp);
      const d = dist(pt.x, pt.y, x, y);
      if (d < minD || d > reach) continue;
      return { x: pt.x, y: pt.y, angle: pt.angle, edge, dir, lane, s };
    }
    return null;
  }

  /** Il cartello che dice cosa sta succedendo. Una volta per evento, e solo se sei lì. */
  tell(game, ev, text, secs = 3) {
    if (ev.told && ev.told === text) return;
    ev.told = text;
    if (dist(ev.x, ev.y, game.player.x, game.player.y) > 1400) return;
    game.hud.toast(text, secs);
  }

  /**
   * Guida dell'auto in fuga. Nessun grafo dedicato: si riusa il segui-strade
   * greedy della polizia, puntando un punto lontano *davanti* al muso. Su una
   * maglia ortogonale è quello che produce una fuga vera — dritti finché si può,
   * svolta dove capita — senza un pathfinding che non esiste in questo gioco.
   */
  driveFlee(v, dt, game) {
    const ai = v.ai;
    ai.t += dt;
    if (!v.copAi) {
      v.copAi = { edge: null, dir: 1, lane: 0, s: 0, jamT: 0, recoverT: 0, recoverSteer: 1, fireT: 0 };
    }
    const cAi = v.copAi;
    if (cAi.recoverT > 0) {
      cAi.recoverT -= dt;
      v.throttle = -0.6;
      v.steer = cAi.recoverSteer;
      v.handbrake = false;
      if (cAi.recoverT <= 0) game.police.snapToRoad(v);
      return;
    }
    // Si scappa da chi si ha dietro: se non c'è nessuno, dritti per la propria strada.
    let ax = v.x + Math.cos(v.angle) * 1400;
    let ay = v.y + Math.sin(v.angle) * 1400;
    let chaser = null;
    let bestD = Infinity;
    for (const u of this.units) {
      const d = dist(u.x, u.y, v.x, v.y);
      if (d < bestD) { bestD = d; chaser = u; }
    }
    if (chaser && bestD < 1200) {
      const dx = v.x - chaser.x;
      const dy = v.y - chaser.y;
      const l = Math.hypot(dx, dy) || 1;
      ax = v.x + (dx / l) * 1400;
      ay = v.y + (dy / l) * 1400;
    }
    game.police.followRoads(v, dt, game, ax, ay);

    if (Math.abs(v.speed) < 12) {
      cAi.jamT += dt;
      if (cAi.jamT > 1.8) {
        cAi.jamT = 0;
        cAi.recoverT = 0.9;
        cAi.recoverSteer = this.rng.chance(0.5) ? 1 : -1;
      }
    } else {
      cAi.jamT = 0;
    }
  }
}
