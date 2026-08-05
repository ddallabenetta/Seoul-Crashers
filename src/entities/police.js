// Polizia (Fase 2, tappa B): pattuglie, volanti, speronamenti, posti di blocco,
// chiodi, SWAT ed elicottero con riflettore.
//
// Tre scelte che spiegano tutto il file:
//
// 1. **Le unità sono le entità che ci sono già.** Un poliziotto è un pedone di tipo
//    `cop` in `game.peds` con lo stato `duty`: eredita gratis steering, pendenza,
//    collisioni, sangue e ragdoll. Una volante è un veicolo in `game.vehicles` con
//    `driver === 'cop'`: la fisica gliela fa girare `traffic.update` come a tutti
//    gli altri, qui si scrivono solo gas e sterzo.
// 2. **Niente pathfinding.** A ogni incrocio si sceglie l'arco che avvicina di più
//    all'obiettivo (greedy sul grafo). Su una maglia ortogonale porta a destinazione
//    quasi sempre, costa una decina di confronti, e quando sbaglia c'è l'anti-incastro
//    che manovra in retromarcia — lo stesso rimedio del traffico civile.
// 3. **Il posto di blocco è geometria che esiste già.** Volanti ferme di traverso
//    più due transenne `vehicleOnly`: fermano le ruote, lasciano passare i piedi e i
//    proiettili. Identiche alle scalinate, e i ponti sul Han sono il posto giusto
//    dove metterle perché sono gli unici passaggi obbligati della mappa.
import { createVehicle } from './vehicle.js';
import { createPed } from './pedestrians.js';
import { VEHICLE_TYPES } from '../render/sprites.js';
import { PROJ } from '../render/camera.js';
import { lanePoint, laneCount } from '../world/roadgraph.js';
import { WEAPONS, shoot, hasLineOfSight } from './weapons.js';
import { angleDiff, clamp, damp, dist, pointSegment } from '../core/math.js';

// Cosa scende in strada a ogni livello di ricercato.
const TIERS = [
  { cars: 0, cops: 0 },
  { cars: 0, cops: 3, weapon: 'pistol' },
  { cars: 2, cops: 2, weapon: 'pistol' },
  { cars: 3, cops: 2, weapon: 'pistol', ram: true, driveby: true },
  { cars: 3, cops: 2, weapon: 'pistol', ram: true, driveby: true, blocks: 2, spikes: 2 },
  { cars: 3, cops: 2, swat: 2, weapon: 'smg', ram: true, driveby: true, blocks: 3, spikes: 2, chopper: true },
];

// A che distanza una pattuglia ti riconosce. Serve la linea di vista: dietro un
// palazzo non ti vede nessuno, ed è così che si semina la polizia.
const SEE_FOOT = 470;
const SEE_CAR = 640;
const COP_FIRE_RANGE = 340;

// Riflettore dell'elicottero.
const BEAM_R = 118;
const CHOPPER_Z = 210;
const CHOPPER_HP = 260;

const MAX_COPS = 10;

/** True se il punto è fuori dal rettangolo inquadrato (con margine). */
function outsideView(game, x, y, margin = 60) {
  const b = game.camera.bounds(margin);
  return x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h;
}

export class PoliceSystem {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.cops = [];
    this.cars = [];
    this.blocks = [];
    this.spikes = [];
    this.chopper = null;
    this.chopperCd = 0;
    this.spotted = false;
    this.spawnT = 0;
    this.blockT = 0;
    this.tmp = {};
  }

  get tier() {
    return TIERS[this._level] || TIERS[0];
  }

  // --- ciclo -----------------------------------------------------------------
  update(dt, game) {
    this._level = game.wanted.level;
    const tier = this.tier;
    this.prune(game);

    if (this._level > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 0.9;
        this.reinforce(game, tier);
      }
      this.manageObstacles(dt, game, tier);
    } else if (this.cars.length || this.cops.length || this.blocks.length) {
      this.standDown(game);
    }

    for (const v of this.cars) this.driveCar(v, dt, game);
    this.updateChopper(dt, game, tier);
    this.updateSpikes(game);
    this.spotted = this.computeSpotted(game);
  }

  /** Unità perse per strada: morti, despawnate dallo streaming, o troppo lontane. */
  prune(game) {
    const pl = game.player;
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const p = this.cops[i];
      if (p.dead || p.gone || dist(p.x, p.y, pl.x, pl.y) > 2200) this.cops.splice(i, 1);
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const v = this.cars[i];
      const far = dist(v.x, v.y, pl.x, pl.y) > 2600;
      if (v.driver !== 'cop' || (v.dead && v.deadT > 18) || far) {
        this.dropVehicle(v, game, !v.dead && far);
        this.cars.splice(i, 1);
      }
    }
  }

  /** Rimette in pari il numero di unità previsto dal livello. */
  reinforce(game, tier) {
    // Le volanti che hanno già sbarcato l'equipaggio non contano più come unità
    // in caccia: altrimenti bastano due sbarchi e non arriva più nessuno.
    const alive = this.cars.filter((v) => !v.dead && !v.deployed);
    // Il tetto sul totale conta anche le volanti vuote: restando fermo in mezzo
    // alla strada se ne accumulerebbero all'infinito, una per ogni sbarco.
    if (alive.length < tier.cars && this.cars.length < tier.cars + 3) {
      const swatQuota = tier.swat || 0;
      const swatOut = alive.filter((v) => v.kind === 'swat').length;
      this.spawnCar(game, swatOut < swatQuota ? 'swat' : 'police', tier);
      return;
    }
    // I poliziotti a piedi hanno senso solo se il giocatore è a piedi: dietro a
    // un'auto in corsa non arriverebbero mai, e resterebbero fermi a ingombrare.
    const onFootHunt = game.player.onFoot || this.cops.length < 2;
    if (onFootHunt && this.cops.length < Math.min(MAX_COPS, tier.cops + tier.cars)) {
      this.spawnFootCop(game, tier);
    }
  }

  /** Cessato allarme: le unità in vista se ne vanno da sole, le altre spariscono. */
  standDown(game, hard = false) {
    for (const b of this.blocks) this.removeBlock(b, game);
    this.blocks.length = 0;
    this.spikes.length = 0;
    for (const v of this.cars) this.dropVehicle(v, game, !hard);
    this.cars.length = 0;
    for (const p of this.cops) {
      p.state = 'walk';
      p.cop = false;
      p.armed = false;
      if (hard) p.gone = true;
    }
    this.cops.length = 0;
    if (this.chopper) this.chopper = null;
    this.chopperCd = hard ? 0 : 25;
  }

  /**
   * Toglie una volante dal controllo della polizia. Se `leave` è vero resta in
   * strada come relitto/auto abbandonata, altrimenti la si rimuove del tutto.
   */
  dropVehicle(v, game, leave = true) {
    v.siren = false;
    v.copUnit = false;
    if (v.driver === 'cop') v.driver = null;
    v.protect = false;
    if (!leave) {
      const i = game.vehicles.indexOf(v);
      if (i >= 0) game.vehicles.splice(i, 1);
    } else {
      v.handbrake = true;
      v.throttle = 0;
    }
  }

  /** Il giocatore ha rubato una volante: l'unità è persa, l'agente scende. */
  releaseVehicle(v, game) {
    const i = this.cars.indexOf(v);
    if (i >= 0) this.cars.splice(i, 1);
    v.siren = false;
    v.copUnit = false;
    if (v.crew > 0) {
      this.deployCrew(v, game, true);
    }
  }

  // --- spawn -----------------------------------------------------------------
  spawnCar(game, kind, tier) {
    const graph = this.city.graph;
    const pl = game.player;
    const rng = this.rng;
    const near = graph.edgesNear(pl.x, pl.y, 1500);
    if (!near.length) return null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const edge = rng.pick(near);
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = rng.int(0, laneCount(edge) - 1);
      const s = rng.range(20, Math.max(24, edge.len - 20));
      const pt = lanePoint(edge, dir, lane, s, this.tmp);
      const d = dist(pt.x, pt.y, pl.x, pl.y);
      // Non troppo addosso (comparirebbe a vista) né troppo lontana (non arriva mai).
      if (d < 520 || d > 1500) continue;
      if (!outsideView(game, pt.x, pt.y, 80)) continue;
      let clear = true;
      for (const o of game.vehicles) {
        if (dist(o.x, o.y, pt.x, pt.y) < 90) { clear = false; break; }
      }
      if (!clear) continue;

      const v = createVehicle(kind, pt.x, pt.y, pt.angle, 0);
      v.driver = 'cop';
      v.copUnit = true;
      v.siren = true;
      v.protect = true;
      v.lightsOn = game.isNight;
      v.crew = kind === 'swat' ? 3 : 2;
      // La SWAT è passata al fucile d'assalto con la tappa C: se il giocatore
      // arriva a cinque stelle con la minigun, dall'altra parte non può esserci
      // ancora la stessa SMG di due stelle fa.
      v.copWeapon = kind === 'swat' ? 'rifle' : (tier.weapon || 'pistol');
      v.copAi = { edge, dir, lane, s, jamT: 0, recoverT: 0, recoverSteer: 1, fireT: 0.6 };
      game.vehicles.push(v);
      this.cars.push(v);
      return v;
    }
    return null;
  }

  spawnFootCop(game, tier) {
    const graph = this.city.graph;
    const w = game.wanted;
    const rng = this.rng;
    // Arrivano da dove ti hanno visto l'ultima volta, non da dove sei adesso.
    const near = graph.edgesNear(w.lastX, w.lastY, 900);
    if (!near.length) return null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const edge = rng.pick(near);
      const s = rng.range(20, Math.max(24, edge.len - 20));
      const side = rng.chance(0.5) ? 1 : -1;
      const off = edge.width / 2 + 16;
      const x = edge.ax + edge.dx * s - edge.dy * off * side;
      const y = edge.ay + edge.dy * s + edge.dx * off * side;
      const d = dist(x, y, game.player.x, game.player.y);
      if (d < 380 || d > 1100) continue;
      if (!outsideView(game, x, y, 50)) continue;
      const swat = (tier.swat || 0) > 0 && rng.chance(0.4);
      return this.addCop(game, x, y, swat ? 'swat' : 'cop', swat ? 'rifle' : (tier.weapon || 'pistol'));
    }
    return null;
  }

  addCop(game, x, y, kind = 'cop', weapon = 'pistol') {
    // Tetto duro: i posti di blocco portano agenti propri, e senza un limite
    // complessivo un inseguimento lungo riempirebbe la strada di divise.
    if (this.cops.length >= MAX_COPS + 6) return null;
    const p = createPed(kind, x, y, this.rng);
    p.cop = true;
    p.armed = true;
    p.copWeapon = weapon;
    p.state = 'duty';
    p.hostile = false;
    p.fireT = this.rng.range(0.2, 1);
    game.peds.push(p);
    this.cops.push(p);
    return p;
  }

  /** L'equipaggio scende dalla volante e continua a piedi. */
  deployCrew(v, game, panic = false) {
    const spec = VEHICLE_TYPES[v.kind];
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    const n = v.crew;
    v.crew = 0;
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const back = (i >> 1) * 18;
      const p = this.addCop(
        game,
        v.x - sin * spec.wid * 0.9 * side - cos * back,
        v.y + cos * spec.wid * 0.9 * side - sin * back,
        v.kind === 'swat' ? 'swat' : 'cop',
        v.copWeapon || 'pistol'
      );
      if (p && panic) p.fireT = 1.6;
    }
    v.handbrake = true;
    v.throttle = 0;
    v.deployed = true;
  }

  // --- poliziotti a piedi ----------------------------------------------------
  /**
   * Chiamata da `pedestrians.updatePed` per ogni agente in servizio: restituisce
   * dove andare e quanto forte. Sparare lo fa direttamente qui, come per i teppisti.
   */
  copBehavior(p, dt, game) {
    const pl = game.player;
    const w = game.wanted;
    p.fireT -= dt;

    if (w.level === 0 || pl.dying) {
      // Cessato allarme: si rimette a camminare per i fatti suoi.
      return { x: p.x + Math.cos(p.angle) * 70, y: p.y + Math.sin(p.angle) * 70, speed: p.baseSpeed * 0.7 };
    }

    const spec = WEAPONS[p.copWeapon] || WEAPONS.pistol;
    const d = dist(p.x, p.y, pl.x, pl.y);
    const los = d < SEE_FOOT && hasLineOfSight(game, p.x, p.y, pl.x, pl.y);

    if (los) {
      const aim = Math.atan2(pl.y - p.y, pl.x - p.x);
      if (d < COP_FIRE_RANGE && p.fireT <= 0) {
        p.fireT = spec.rate * (spec.auto ? 6 : 2.6) + Math.random() * 0.5;
        p.angle = aim;
        shoot(game, p, spec, p.x + Math.cos(aim) * 13, p.y + Math.sin(aim) * 13, aim, { spreadMul: 2.6 });
      }
      // Distanza di ingaggio: se sei troppo vicino arretrano, se sei lontano avanzano.
      const push = d < 120 ? -1 : d > 240 ? 1 : 0;
      if (push === 0) return { x: p.x, y: p.y, speed: 0 };
      return {
        x: p.x + Math.cos(aim) * 130 * push,
        y: p.y + Math.sin(aim) * 130 * push,
        speed: p.baseSpeed * 1.35,
      };
    }
    // Non ti vedono: rastrellano l'ultima posizione nota.
    return { x: w.lastX, y: w.lastY, speed: p.baseSpeed * 1.9 };
  }

  // --- volanti ---------------------------------------------------------------
  driveCar(v, dt, game) {
    if (v.dead || v.driver !== 'cop') return;
    const ai = v.copAi;
    const pl = game.player;
    const w = game.wanted;
    ai.fireT -= dt;

    // Sbarcato l'equipaggio la volante ha finito il suo lavoro: resta lì coi
    // lampeggianti accesi. Una volante vuota che continua a speronare non si spiega.
    if (v.deployed) {
      v.throttle = 0;
      v.steer = 0;
      v.handbrake = true;
      return;
    }

    if (ai.recoverT > 0) {
      ai.recoverT -= dt;
      v.throttle = -0.6;
      v.steer = ai.recoverSteer;
      v.handbrake = false;
      if (ai.recoverT <= 0) this.snapToRoad(v);
      return;
    }

    const tx = w.seen ? pl.x : w.lastX;
    const ty = w.seen ? pl.y : w.lastY;
    const d = dist(v.x, v.y, pl.x, pl.y);
    const los = d < SEE_CAR && hasLineOfSight(game, v.x, v.y, pl.x, pl.y);
    const tier = this.tier;

    // Sbarco: il giocatore è a piedi e siamo addosso. Da qui in poi è un problema
    // dei due agenti, la volante resta ferma coi lampeggianti accesi.
    if (v.crew > 0 && pl.onFoot && !pl.dying && los && d < 230) {
      v.throttle = -1;
      v.steer = 0;
      if (Math.abs(v.speed) < 50) this.deployCrew(v, game);
      return;
    }

    if (tier.ram && !pl.onFoot && los && d < 460) {
      // Speronamento: si punta dove sarà, non dove è.
      const aim = Math.atan2(pl.y + pl.vy * 0.3 - v.y, pl.x + pl.vx * 0.3 - v.x);
      v.steer = clamp(angleDiff(v.angle, aim) * 2.6, -1, 1);
      v.throttle = 1;
      v.handbrake = false;
      ai.edge = null; // alla fine dello speronamento si riaggancia da capo
    } else {
      this.followRoads(v, dt, game, tx, ty);
    }

    if (tier.driveby && v.crew > 0 && los && d < COP_FIRE_RANGE && ai.fireT <= 0) {
      ai.fireT = 0.8 + Math.random() * 0.8;
      const a = Math.atan2(pl.y - v.y, pl.x - v.x);
      const spec = WEAPONS[v.copWeapon] || WEAPONS.pistol;
      shoot(game, v, spec, v.x + Math.cos(a) * 26, v.y + Math.sin(a) * 26, a, {
        spreadMul: 3.4,
        ignoreVehicle: v,
      });
    }

    // Anti-incastro, come per il traffico civile: fermo senza motivo -> retromarcia.
    if (Math.abs(v.speed) < 12) {
      ai.jamT += dt;
      if (ai.jamT > 1.6) {
        ai.jamT = 0;
        ai.recoverT = 0.9;
        ai.recoverSteer = this.rng.chance(0.5) ? 1 : -1;
      }
    } else {
      ai.jamT = 0;
    }
  }

  followRoads(v, dt, game, tx, ty) {
    const ai = v.copAi;
    const graph = this.city.graph;
    if (!ai.edge && !this.snapToRoad(v)) {
      // Nessuna strada nei paraggi: si punta dritti al bersaglio.
      const aim = Math.atan2(ty - v.y, tx - v.x);
      v.steer = clamp(angleDiff(v.angle, aim) * 2.4, -1, 1);
      v.throttle = 0.8;
      return;
    }

    const project = () => {
      const e = ai.edge;
      ai.s = ai.dir > 0
        ? (v.x - e.ax) * e.dx + (v.y - e.ay) * e.dy
        : (e.bx - v.x) * e.dx + (e.by - v.y) * e.dy;
    };
    project();

    // Al nodo si prende l'arco che avvicina di più all'obiettivo. La riproiezione
    // di `s` sul nuovo arco è obbligatoria: senza, il waypoint finisce fuori strada
    // e la volante si pianta (è la trappola già pagata dal traffico civile).
    if (ai.s > ai.edge.len - 40) {
      const node = graph.nodeById(ai.dir > 0 ? ai.edge.b : ai.edge.a);
      const next = this.chooseEdge(node, ai.edge, tx, ty);
      if (next) {
        ai.edge = next.edge;
        ai.dir = next.dir;
        ai.lane = Math.min(ai.lane, laneCount(next.edge) - 1);
        project();
      }
    }

    const look = 44 + Math.abs(v.speed) * 0.36;
    let wp = lanePoint(ai.edge, ai.dir, ai.lane, ai.s + look, this.tmp);
    let heading = angleDiff(v.angle, Math.atan2(wp.y - v.y, wp.x - v.x));

    if (Math.abs(heading) > 1.9 || Math.hypot(wp.x - v.x, wp.y - v.y) > 280) {
      if (this.snapToRoad(v)) {
        project();
        wp = lanePoint(ai.edge, ai.dir, ai.lane, ai.s + look, this.tmp);
        heading = angleDiff(v.angle, Math.atan2(wp.y - v.y, wp.x - v.x));
      }
      if (Math.abs(heading) > 2.4) {
        ai.recoverT = 0.9;
        ai.recoverSteer = heading > 0 ? -1 : 1;
        v.throttle = -0.5;
        v.steer = ai.recoverSteer;
        return;
      }
    }

    v.steer = clamp(heading * 2.4, -1, 1);
    // I semafori non li guardano: è metà del carattere di un inseguimento.
    let target = ai.edge.arterial ? 330 : 260;
    if (Math.abs(heading) > 0.5) target = Math.min(target, 110);

    // Chi è fermo davanti si evita, ma senza la prudenza del traffico civile: la
    // distanza si misura **fra i paraurti** come nel traffico (§4 dell'HANDOFF),
    // altrimenti per una volante lunga 82 px il freno arriva a contatto avvenuto.
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    const spec = VEHICLE_TYPES[v.kind];
    const probe = 34 + Math.abs(v.speed) * 0.4;
    const reach = spec.len * 0.5 + probe;
    for (const o of game.vehicleGrid.queryCircle(v.x + cos * reach * 0.5, v.y + sin * reach * 0.5, reach * 0.5 + 40)) {
      if (o === v || o.driver === 'player') continue;
      const forward = (o.x - v.x) * cos + (o.y - v.y) * sin;
      const lateral = Math.abs(-(o.x - v.x) * sin + (o.y - v.y) * cos);
      const gap = forward - (spec.len + VEHICLE_TYPES[o.kind].len) * 0.5;
      if (forward > 0 && gap < probe && lateral < 26) target = Math.min(target, 60);
    }

    const diff = target - v.speed;
    if (diff > 6) v.throttle = clamp(diff / 60, 0.2, 1);
    else if (diff < -6) v.throttle = clamp(diff / 90, -1, -0.15);
    else v.throttle = 0.1;
    v.handbrake = false;
  }

  /** Arco più sensato verso il bersaglio, evitando l'inversione a U. */
  chooseEdge(node, fromEdge, tx, ty) {
    let best = null;
    let bestD = Infinity;
    for (const o of node.out) {
      if (o.edge === fromEdge && node.out.length > 1) continue;
      const ex = o.dir > 0 ? o.edge.bx : o.edge.ax;
      const ey = o.dir > 0 ? o.edge.by : o.edge.ay;
      const d = (ex - tx) ** 2 + (ey - ty) ** 2;
      if (d < bestD) { bestD = d; best = o; }
    }
    return best ? { edge: best.edge, dir: best.dir } : null;
  }

  /** Riaggancia il veicolo alla corsia più compatibile col muso. */
  snapToRoad(v) {
    const near = this.city.graph.edgesNear(v.x, v.y, 280);
    if (!near.length) return false;
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    let best = null;
    let bestScore = -Infinity;
    for (const e of near) {
      const p = pointSegment(v.x, v.y, e.ax, e.ay, e.bx, e.by);
      const dot = cos * e.dx + sin * e.dy;
      const score = -p.dist * 0.6 + Math.abs(dot) * 90;
      if (score > bestScore) {
        bestScore = score;
        best = { edge: e, dir: dot >= 0 ? 1 : -1, s: dot >= 0 ? p.t * e.len : (1 - p.t) * e.len };
      }
    }
    if (!best) return false;
    const ai = v.copAi;
    ai.edge = best.edge;
    ai.dir = best.dir;
    ai.lane = Math.min(ai.lane, laneCount(best.edge) - 1);
    ai.s = best.s;
    return true;
  }

  // --- posti di blocco e chiodi ----------------------------------------------
  manageObstacles(dt, game, tier) {
    this.blockT -= dt;
    // Ripulisce quello che il giocatore si è lasciato alle spalle.
    const pl = game.player;
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      b.t += dt;
      if (dist(b.x, b.y, pl.x, pl.y) > 2600 || b.t > 120) {
        this.removeBlock(b, game);
        this.blocks.splice(i, 1);
      }
    }
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const s = this.spikes[i];
      s.t += dt;
      if (dist(s.cx, s.cy, pl.x, pl.y) > 2600 || s.t > 120) this.spikes.splice(i, 1);
    }
    if (this.blockT > 0) return;
    this.blockT = 7;
    // Si alternano: mettendo prima tutti i blocchi, i chiodi non arriverebbero
    // mai a comparire in un inseguimento di durata normale.
    this._altBlock = !this._altBlock;
    const wantBlock = (tier.blocks || 0) > this.blocks.length;
    const wantSpike = (tier.spikes || 0) > this.spikes.length;
    if (wantBlock && (this._altBlock || !wantSpike)) this.makeRoadblock(game);
    else if (wantSpike) this.makeSpikes(game);
  }

  /**
   * Punto di posa davanti al giocatore: si guarda dove sta andando, non dove è.
   * I ponti sul Han hanno la precedenza — sono gli unici passaggi obbligati.
   */
  findAheadEdge(game, reach, minGap) {
    const pl = game.player;
    const sp = Math.hypot(pl.vx, pl.vy);
    const dx = sp > 40 ? pl.vx / sp : Math.cos(pl.angle);
    const dy = sp > 40 ? pl.vy / sp : Math.sin(pl.angle);
    const ax = pl.x + dx * reach;
    const ay = pl.y + dy * reach;
    const near = this.city.graph.edgesNear(ax, ay, reach * 0.45);
    let best = null;
    let bestScore = -Infinity;
    for (const e of near) {
      const mx = (e.ax + e.bx) / 2;
      const my = (e.ay + e.by) / 2;
      if (dist(mx, my, pl.x, pl.y) < minGap) continue;
      if (e.len < 180) continue;
      const bridge = e.axis === 'v' && this.isBridge(e);
      const score = (bridge ? 1200 : 0) - dist(mx, my, ax, ay);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  isBridge(edge) {
    for (const b of this.city.river.bridges) {
      if (Math.abs(edge.ax - b.x) < 4) return true;
    }
    return false;
  }

  makeRoadblock(game) {
    const edge = this.findAheadEdge(game, 1150, 620);
    if (!edge) return null;
    const vertical = edge.axis === 'v';
    // Posa a metà del tratto, dove la carreggiata è dritta di sicuro.
    const px = (edge.ax + edge.bx) / 2;
    const py = (edge.ay + edge.by) / 2;
    const half = edge.width / 2;
    const block = { x: px, y: py, vertical, cars: [], barriers: [], t: 0 };

    // Volanti di traverso: una basta su una strada normale, due su un boulevard.
    const slots = edge.arterial ? [-0.26, 0.26] : [0];
    for (const s of slots) {
      const cx = vertical ? px + half * 2 * s : px;
      const cy = vertical ? py : py + half * 2 * s;
      const v = createVehicle('police', cx, cy, vertical ? 0 : Math.PI / 2, 0);
      v.driver = null;
      v.handbrake = true;
      v.siren = true;
      v.lightsOn = game.isNight;
      v.protect = true;
      v.blockCar = true;
      game.vehicles.push(v);
      block.cars.push(v);
    }

    // Transenne agli estremi della carreggiata: `vehicleOnly`, come le scalinate.
    for (const s of [-1, 1]) {
      const bx = vertical ? px + s * (half - 12) - 12 : px - 12;
      const by = vertical ? py - 12 : py + s * (half - 12) - 12;
      const barrier = { x: bx, y: by, w: 24, h: 24, vehicleOnly: true, roadblock: true };
      this.city.solidGrid.insertRect(barrier);
      block.barriers.push(barrier);
    }

    // Due agenti al riparo dietro il blocco, dal lato opposto al giocatore.
    const away = Math.sign((vertical ? py - game.player.y : px - game.player.x)) || 1;
    for (const s of [-1, 1]) {
      const cx = vertical ? px + s * 34 : px + away * 40;
      const cy = vertical ? py + away * 40 : py + s * 34;
      this.addCop(game, cx, cy, 'cop', this.tier.weapon || 'pistol');
    }

    this.blocks.push(block);
    game.hud.toast('Posto di blocco davanti a te', 2.4);
    return block;
  }

  removeBlock(b, game) {
    for (const barrier of b.barriers) this.city.solidGrid.removeRect(barrier);
    for (const v of b.cars) {
      v.blockCar = false;
      v.siren = false;
      v.protect = false;
      const i = game.vehicles.indexOf(v);
      if (i >= 0 && v.driver !== 'player') game.vehicles.splice(i, 1);
    }
    b.barriers.length = 0;
    b.cars.length = 0;
  }

  makeSpikes(game) {
    const edge = this.findAheadEdge(game, 760, 420);
    if (!edge) return null;
    const vertical = edge.axis === 'v';
    const px = (edge.ax + edge.bx) / 2;
    const py = (edge.ay + edge.by) / 2;
    const half = edge.width / 2;
    const strip = vertical
      ? { x: px - half, y: py - 11, w: half * 2, h: 22, horiz: true }
      : { x: px - 11, y: py - half, w: 22, h: half * 2, horiz: false };
    strip.cx = px;
    strip.cy = py;
    strip.t = 0;
    this.spikes.push(strip);
    game.hud.toast('Chiodi sull\'asfalto', 2.2);
    return strip;
  }

  /** Le gomme a terra le prende solo chi guida: il traffico civile le schiva. */
  updateSpikes(game) {
    const pl = game.player;
    const v = pl.vehicle;
    if (!v || v.flatTires || Math.abs(v.speed) < 20) return;
    for (const s of this.spikes) {
      if (v.x < s.x || v.x > s.x + s.w || v.y < s.y || v.y > s.y + s.h) continue;
      v.flatTires = true;
      v.flatPull = (Math.random() - 0.5) * 0.5;
      game.fx.addSparks(v.x, v.y, -v.vx, -v.vy, 12);
      game.camera.addShake(7);
      game.hud.toast('Gomme a terra', 2.6);
      break;
    }
  }

  // --- elicottero ------------------------------------------------------------
  updateChopper(dt, game, tier) {
    const c = this.chopper;
    if (!tier.chopper) {
      if (c) this.chopper = null;
      return;
    }
    if (!c) {
      this.chopperCd -= dt;
      if (this.chopperCd > 0) return;
      const pl = game.player;
      this.chopper = {
        x: pl.x - 900, y: pl.y - 700, z: CHOPPER_Z, angle: 0,
        beamX: pl.x, beamY: pl.y, lit: false,
        hp: CHOPPER_HP, fireT: 3, t: 0,
      };
      game.hud.toast('Elicottero in arrivo', 2.6);
      return;
    }

    const pl = game.player;
    c.t += dt;
    // Orbita larga sopra il giocatore, con ritardo: un inseguimento perfetto
    // sarebbe una scatola incollata alla camera.
    const orbit = 120;
    const tx = pl.x + Math.cos(c.t * 0.42) * orbit;
    const ty = pl.y + Math.sin(c.t * 0.42) * orbit;
    c.x = damp(c.x, tx, 0.85, dt);
    c.y = damp(c.y, ty, 0.85, dt);
    const heading = Math.atan2(ty - c.y, tx - c.x);
    if (Math.hypot(tx - c.x, ty - c.y) > 24) c.angle = heading;

    // Il riflettore insegue più lento del velivolo: si può uscire dal cono.
    c.beamX = damp(c.beamX, pl.x, 0.62, dt);
    c.beamY = damp(c.beamY, pl.y, 0.62, dt);
    c.lit = !pl.dying && dist(pl.x, pl.y, c.beamX, c.beamY) < BEAM_R;

    if (c.lit) {
      c.fireT -= dt;
      if (c.fireT <= 0) {
        c.fireT = 2.4;
        this.chopperBurst(game, c);
      }
    }
  }

  /**
   * Raffica dall'alto. Non passa dal raycast: il tiratore è a 210 px di quota, e
   * un raggio radente tirato sul piano si pianterebbe nel primo palazzo in mezzo.
   * Si tira a stima attorno al bersaglio, e chi è troppo vicino al centro incassa.
   */
  chopperBurst(game, c) {
    const pl = game.player;
    const cam = game.camera;
    const ox = c.x + (c.x - cam.cx) * (c.z / PROJ);
    const oy = c.y + (c.y - cam.cy) * (c.z / PROJ);
    for (let i = 0; i < 3; i++) {
      const dx = (Math.random() - 0.5) * 54;
      const dy = (Math.random() - 0.5) * 54;
      game.fx.addTracer(ox, oy, pl.x + dx, pl.y + dy, false);
      const off = Math.hypot(dx, dy);
      if (off < 13) {
        const l = off || 1;
        game.damagePlayer(11, -dx / l, -dy / l);
      } else {
        game.fx.addSparks(pl.x + dx, pl.y + dy, -dx, -dy, 2);
      }
    }
    game.alarm(pl.x, pl.y, 320, null);
  }

  /** Danno all'elicottero (dal raycast delle armi). */
  damageChopper(dmg, game) {
    const c = this.chopper;
    if (!c) return;
    c.hp -= dmg;
    if (c.hp > 0) return;
    const cam = game.camera;
    game.fx.addExplosion(c.x + (c.x - cam.cx) * (c.z / PROJ), c.y + (c.y - cam.cy) * (c.z / PROJ));
    game.fx.addExplosion(c.x, c.y);
    game.camera.addShake(22);
    game.hud.toast('Elicottero abbattuto', 3);
    game.stats.choppers = (game.stats.choppers || 0) + 1;
    this.chopper = null;
    this.chopperCd = 40;
    game.wanted.report('copKill', game);
  }

  // --- avvistamento ----------------------------------------------------------
  computeSpotted(game) {
    const pl = game.player;
    if (pl.dying) return false;
    if (this.chopper && this.chopper.lit) return true;
    for (const p of this.cops) {
      if (p.dead) continue;
      if (dist(p.x, p.y, pl.x, pl.y) > SEE_FOOT) continue;
      if (hasLineOfSight(game, p.x, p.y, pl.x, pl.y)) return true;
    }
    for (const v of this.cars) {
      if (v.dead) continue;
      if (dist(v.x, v.y, pl.x, pl.y) > SEE_CAR) continue;
      if (hasLineOfSight(game, v.x, v.y, pl.x, pl.y)) return true;
    }
    return false;
  }

  /** Numero di unità in campo, per il pannello di debug. */
  get unitCount() {
    return this.cops.length + this.cars.length + (this.chopper ? 1 : 0);
  }
}
