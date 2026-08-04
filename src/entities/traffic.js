// Traffico: streaming di veicoli attorno al giocatore, guida AI su grafo stradale,
// rispetto dei semafori, distanza di sicurezza, auto parcheggiate.
import { createVehicle, updateVehicle } from './vehicle.js';
import { VEHICLE_TYPES } from '../render/sprites.js';
import { lanePoint, laneCount, canPass } from '../world/roadgraph.js';
import { DISTRICT_BY_ID } from '../world/districts.js';
import { angleDiff, clamp, circleRectPush, dist, pointSegment } from '../core/math.js';
import { createPed } from './pedestrians.js';

const MAX_TRAFFIC = 54;
const MAX_PARKED = 24;

/** Anello di streaming legato al viewport: le auto nascono appena fuori vista. */
function ringFor(game) {
  const cam = game.camera;
  const viewR = Math.hypot(cam.viewW, cam.viewH) / (2 * cam.zoom);
  return { min: 0, max: Math.max(viewR + 620, viewR * 2.1), despawn: Math.max(viewR + 1100, viewR * 2.9) };
}

/** True se il punto è fuori dal rettangolo inquadrato (con margine). */
function outsideView(game, x, y, margin = 60) {
  const b = game.camera.bounds(margin);
  return x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h;
}


export class TrafficSystem {
  constructor(city, rng, vehicles) {
    this.city = city;
    this.rng = rng;
    this.vehicles = vehicles;
    this.parkingSpots = this.collectParkingSpots();
    this.spawnTimer = 0;
    this.tmp = {};
  }

  /**
   * Stalli solo dove un'auto può davvero entrare e uscire: piazzali dei moli,
   * vicoli e cortili collegati alla strada da un vicolo.
   */
  collectParkingSpots() {
    const spots = [];
    const STEP = 46;
    for (const b of this.city.blocks) {
      const areas = [];
      if (b.type === 'dock') areas.push(...b.yards);
      else {
        if (b.courtyard && b.reachable) areas.push(b.courtyard);
        for (const a of b.alleys) areas.push(a);
      }
      for (const y of areas) {
        if (y.w < 62 || y.h < 52) continue;
        const alongX = y.w >= y.h;
        const count = Math.min(5, Math.floor((alongX ? y.w : y.h) / STEP));
        for (let i = 0; i < count; i++) {
          if (!this.rng.chance(0.6)) continue;
          spots.push({
            x: alongX ? y.x + STEP * 0.5 + i * STEP : y.x + Math.min(24, y.w * 0.35),
            y: alongX ? y.y + Math.min(24, y.h * 0.35) : y.y + STEP * 0.5 + i * STEP,
            angle: alongX ? Math.PI / 2 : 0,
            district: b.district,
            taken: false,
          });
        }
      }
    }
    return this.rng.shuffle(spots);
  }

  update(dt, game) {
    this.stream(dt, game);
    for (const v of this.vehicles) {
      if (v.driver === 'player') continue;
      if (v.driver === 'ai') this.driveAI(v, dt, game);
      updateVehicle(v, dt, game);
    }
  }

  /**
   * Velivoli sul piazzale e imbarcazioni all'ormeggio. Non passano dallo streaming:
   * nascono una volta al boot e restano lì per sempre (`protect`), perché un
   * aeroporto senza aerei o un porto senza barche sono due piazzali vuoti — e
   * perché sono l'unico modo di raggiungerli, quindi non possono sparire mentre
   * ci si arriva. Dormono come le auto in sosta: `moored` fa uscire subito
   * `updateVehicle`, quindi ventiquattro mezzi fermi non costano niente.
   */
  placeSpecialVehicles(game) {
    const rng = this.rng;
    const put = (kind, x, y, angle) => {
      const v = createVehicle(kind, x, y, angle, rng.int(0, 9));
      v.driver = null;
      v.handbrake = true;
      v.moored = true;
      v.protect = true;
      this.vehicles.push(v);
      return v;
    };
    for (const s of this.city.airSpots) put(s.kind, s.x, s.y, s.angle);
    for (const s of this.city.boatSpots) put(s.kind, s.x, s.y, s.angle);
  }

  /** Popola la città al primo avvio, anche a vista del giocatore. */
  prewarm(game, cars = 70, parked = 30) {
    for (let i = 0; i < cars * 3 && this.countTraffic() < cars; i++) {
      this.spawnTrafficNear(game.player, game, { min: 130, max: 1500, allowVisible: true });
    }
    for (let i = 0; i < parked * 3 && this.countParked() < parked; i++) {
      this.spawnParkedNear(game.player, game, 90);
    }
  }

  countTraffic() {
    let n = 0;
    for (const v of this.vehicles) if (v.driver === 'ai') n++;
    return n;
  }

  countParked() {
    let n = 0;
    for (const v of this.vehicles) if (v.spot) n++;
    return n;
  }

  /** Un mezzo speciale (aereo, elicottero, barca) rubato non torna all'ormeggio. */
  releaseMoored(v) {
    if (!v.moored) return;
    v.moored = false;
    v.protect = false;
  }

  // --- streaming -------------------------------------------------------------
  stream(dt, game) {
    const p = game.player;
    const vehicles = this.vehicles;
    const ring = ringFor(game);

    for (let i = vehicles.length - 1; i >= 0; i--) {
      const v = vehicles[i];
      if (v.dead) v.deadT = (v.deadT || 0) + dt;
      if (v.driver === 'player' || v.protect) continue;
      const d = dist(v.x, v.y, p.x, p.y);
      const hopeless = v.ai && v.ai.jamCount > 1 && outsideView(game, v.x, v.y, 90);
      if (d > ring.despawn || (v.dead && v.deadT > 22) || hopeless) {
        if (v.spot) v.spot.taken = false;
        vehicles.splice(i, 1);
      }
    }

    const traffic = this.countTraffic();
    const parked = this.countParked();

    this.spawnTimer -= dt;
    const district = game.city.districtAt(p.x, p.y);
    const wanted = Math.round(MAX_TRAFFIC * (district.trafficDensity || 1) * game.trafficScale);

    if (this.spawnTimer <= 0 && traffic < wanted) {
      this.spawnTimer = 0.1;
      // Più siamo lontani dalla quota, più auto immettiamo per frame.
      const burst = traffic < wanted * 0.6 ? 3 : 1;
      for (let i = 0; i < burst; i++) this.spawnTrafficNear(p, game, ring);
    }
    if (parked < MAX_PARKED) this.spawnParkedNear(p, game);
  }

  spawnTrafficNear(p, game, ring = ringFor(game)) {
    const graph = this.city.graph;
    const rng = this.rng;
    const near = graph.edgesNear(p.x, p.y, ring.max);
    if (!near.length) return null;
    for (let attempt = 0; attempt < 22; attempt++) {
      const edge = rng.pick(near);
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = rng.int(0, laneCount(edge) - 1);
      const s = rng.range(18, Math.max(22, edge.len - 18));
      const pt = lanePoint(edge, dir, lane, s, this.tmp);
      const d = dist(pt.x, pt.y, p.x, p.y);
      if (d > ring.max || d < ring.min) continue;
      if (!ring.allowVisible && !outsideView(game, pt.x, pt.y, 70)) continue;
      // Non far comparire un'auto addosso a un'altra
      let clear = true;
      for (const v of this.vehicles) {
        if (dist(v.x, v.y, pt.x, pt.y) < 88) { clear = false; break; }
      }
      if (!clear) continue;

      const district = DISTRICT_BY_ID[this.city.districtAt(pt.x, pt.y).id];
      let kind = rng.pick(district.vehicleMix);
      // Autobus e camion solo sui boulevard: negli incroci stretti si incastrano.
      if ((kind === 'bus' || kind === 'truck') && !edge.arterial) {
        kind = rng.pick(district.vehicleMix.filter((k) => k !== 'bus' && k !== 'truck'));
      }
      const v = createVehicle(kind, pt.x, pt.y, pt.angle, rng.int(0, 9));
      v.driver = 'ai';
      v.lightsOn = game.isNight;
      v.ai = {
        edge, dir, lane, s,
        target: this.cruiseSpeed(edge, kind, rng),
        nextChoice: null,
        waitT: 0,
        jamT: 0,
        recoverT: 0,
        recoverSteer: 0,
        aggression: rng.range(0.75, 1.2),
        honkT: 0,
      };
      this.vehicles.push(v);
      return v;
    }
    return null;
  }

  cruiseSpeed(edge, kind, rng) {
    const spec = VEHICLE_TYPES[kind];
    const base = edge.arterial ? 205 : 148;
    return Math.min(spec.topSpeed * 0.82, base * rng.range(0.86, 1.14));
  }

  spawnParkedNear(p, game, minD = 200) {
    const rng = this.rng;
    for (let attempt = 0; attempt < 14; attempt++) {
      const spot = rng.pick(this.parkingSpots);
      if (!spot || spot.taken) continue;
      const d = dist(spot.x, spot.y, p.x, p.y);
      if (d < minD || d > 1100) continue;
      // Lo spazio deve essere libero da arredo urbano
      let blocked = false;
      const solids = this.city.solidGrid.queryRect(spot.x - 40, spot.y - 40, 80, 80);
      for (const s of solids) {
        if (circleRectPush(spot.x, spot.y, 22, s)) { blocked = true; break; }
      }
      if (blocked) continue;
      const district = DISTRICT_BY_ID[spot.district] || DISTRICT_BY_ID.hongdae;
      const kind = rng.pick(district.vehicleMix.filter((k) => k !== 'bus'));
      const v = createVehicle(kind, spot.x, spot.y, spot.angle + rng.range(-0.05, 0.05), rng.int(0, 9));
      v.driver = null;
      v.handbrake = true;
      v.spot = spot;
      spot.taken = true;
      this.vehicles.push(v);
      return v;
    }
    return null;
  }

  /** Il guidatore AI viene sbalzato fuori e scappa a piedi. */
  ejectDriver(v, game) {
    const spec = VEHICLE_TYPES[v.kind];
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    const ped = createPed(
      'civil',
      v.x - sin * spec.wid * 0.8,
      v.y + cos * spec.wid * 0.8,
      this.rng
    );
    ped.panic = 6;
    ped.angle = v.angle + Math.PI / 2;
    game.peds.push(ped);
    v.ai = null;
    v.driver = null;
  }

  /**
   * Riaggancia un veicolo alla corsia più sensata: serve dopo un tamponamento,
   * quando l'auto si ritrova storta o fuori carreggiata.
   */
  reacquireLane(v) {
    const graph = this.city.graph;
    const near = graph.edgesNear(v.x, v.y, 260);
    if (!near.length) return false;
    const cos = Math.cos(v.angle);
    const sin = Math.sin(v.angle);
    let best = null;
    let bestScore = -Infinity;
    for (const e of near) {
      const p = pointSegment(v.x, v.y, e.ax, e.ay, e.bx, e.by);
      const dot = cos * e.dx + sin * e.dy;
      const dir = dot >= 0 ? 1 : -1;
      // Preferisce la strada vicina e il senso di marcia compatibile col muso.
      const score = -p.dist * 0.6 + Math.abs(dot) * 90;
      if (score > bestScore) {
        bestScore = score;
        best = { edge: e, dir, s: dir > 0 ? p.t * e.len : (1 - p.t) * e.len };
      }
    }
    if (!best) return false;
    v.ai.edge = best.edge;
    v.ai.dir = best.dir;
    v.ai.lane = Math.min(v.ai.lane, laneCount(best.edge) - 1);
    v.ai.s = best.s;
    v.ai.nextChoice = null;
    v.ai.jamT = 0;
    v.ai.recoverT = 0;
    return true;
  }

  // --- guida AI --------------------------------------------------------------
  driveAI(v, dt, game) {
    const ai = v.ai;
    if (!ai) return;
    const graph = this.city.graph;

    // Recupero: manovra in retromarcia dopo essere rimasti incastrati.
    if (ai.recoverT > 0) {
      ai.recoverT -= dt;
      v.throttle = -0.55;
      v.steer = ai.recoverSteer;
      v.handbrake = false;
      if (ai.recoverT <= 0) this.reacquireLane(v);
      return;
    }

    // Progresso lungo l'arco corrente: proiezione della posizione sull'asse.
    const projectS = () => {
      const e = ai.edge;
      ai.s = ai.dir > 0
        ? (v.x - e.ax) * e.dx + (v.y - e.ay) * e.dy
        : (e.bx - v.x) * e.dx + (e.by - v.y) * e.dy;
    };
    projectS();

    let edge = ai.edge;
    let endNode = graph.nodeById(ai.dir > 0 ? edge.b : edge.a);
    let nodeHalf = (edge.axis === 'v' ? endNode.hWidth : endNode.vWidth) / 2;

    // Scelta anticipata del prossimo arco
    if (!ai.nextChoice && ai.s > edge.len - 150) {
      ai.nextChoice = graph.nextLane(endNode, edge, this.rng);
    }

    // Transizione all'arco successivo. Il progresso va riproiettato subito sul
    // nuovo arco, altrimenti il waypoint finisce fuori strada e l'auto si pianta.
    if (ai.s > edge.len - nodeHalf * 0.35) {
      const choice = ai.nextChoice || graph.nextLane(endNode, edge, this.rng);
      if (choice) {
        ai.edge = choice.edge;
        ai.dir = choice.dir;
        ai.lane = Math.min(ai.lane, laneCount(choice.edge) - 1);
        ai.nextChoice = null;
        ai.target = this.cruiseSpeed(choice.edge, v.kind, this.rng);
        if (endNode.claimAxis === edge.axis) endNode.claimAxis = null;
        projectS();
        edge = ai.edge;
        endNode = graph.nodeById(ai.dir > 0 ? edge.b : edge.a);
        nodeHalf = (edge.axis === 'v' ? endNode.hWidth : endNode.vWidth) / 2;
      }
    }

    // Waypoint davanti al muso, sul centro della corsia
    const look = 34 + Math.abs(v.speed) * 0.34;
    let wp = lanePoint(ai.edge, ai.dir, ai.lane, ai.s + look, this.tmp);
    let heading = angleDiff(v.angle, Math.atan2(wp.y - v.y, wp.x - v.x));

    // Girato di traverso o spinto fuori strada: riaggancia la corsia e ricalcola.
    // Non si esce dalla funzione: il comando di gas va sempre aggiornato.
    if (Math.abs(heading) > 1.85 || Math.hypot(wp.x - v.x, wp.y - v.y) > 240) {
      if (this.reacquireLane(v)) {
        edge = ai.edge;
        endNode = graph.nodeById(ai.dir > 0 ? edge.b : edge.a);
        nodeHalf = (edge.axis === 'v' ? endNode.hWidth : endNode.vWidth) / 2;
        wp = lanePoint(ai.edge, ai.dir, ai.lane, ai.s + look, this.tmp);
        heading = angleDiff(v.angle, Math.atan2(wp.y - v.y, wp.x - v.x));
      }
      if (Math.abs(heading) > 2.4) {
        ai.recoverT = 1.0;
        ai.recoverSteer = heading > 0 ? -1 : 1;
        v.throttle = -0.5;
        v.steer = ai.recoverSteer;
        return;
      }
    }
    v.steer = clamp(heading * 2.3, -1, 1);

    let target = ai.target * ai.aggression;

    // Curva imminente: rallenta per davvero. A 90 px/s un'auto taglia l'angolo
    // e finisce sul marciapiede, dove resta piantata.
    if (ai.nextChoice && ai.nextChoice.edge.axis !== edge.axis && ai.s > edge.len - 175) {
      target = Math.min(target, 64);
    }
    // Anche subito dopo la svolta la velocità va tenuta bassa finché non si è
    // riallineati alla nuova corsia.
    if (Math.abs(heading) > 0.5) target = Math.min(target, 96);

    // Semaforo
    let waitingAtLight = false;
    const stopDist = edge.len - nodeHalf - 10 - ai.s;
    if (endNode.signal && stopDist < 130 && stopDist > -4) {
      if (!canPass(endNode, edge.axis, game.time)) {
        target = stopDist < 22 ? 0 : Math.min(target, stopDist * 1.5);
        waitingAtLight = true;
      }
    }

    // Prenotazione dell'incrocio: un asse per volta. La fila che sta già passando
    // rinnova la prenotazione, l'asse perpendicolare aspetta il suo turno.
    if (!waitingAtLight && stopDist < 44) {
      const insideJunction = stopDist < 4;
      const free = endNode.claimAxis === null
        || endNode.claimAxis === edge.axis
        || game.time - endNode.claimT > 1.1;
      if (free) {
        endNode.claimAxis = edge.axis;
        endNode.claimT = game.time;
      } else if (!insideJunction) {
        target = stopDist < 24 ? 0 : Math.min(target, stopDist * 1.4);
        waitingAtLight = true;
      }
    }

    // Distanza di sicurezza
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    const probe = 30 + Math.abs(v.speed) * 0.6;
    const ahead = game.vehicleGrid.queryCircle(v.x + cos * probe * 0.6, v.y + sin * probe * 0.6, probe * 0.75);
    let blocked = 0;
    for (const o of ahead) {
      if (o === v) continue;
      const dx = o.x - v.x;
      const dy = o.y - v.y;
      const forward = dx * cos + dy * sin;
      const lateral = Math.abs(-dx * sin + dy * cos);
      if (forward > 4 && forward < probe && lateral < 24) {
        blocked = Math.max(blocked, 1 - (forward - 4) / probe);
      }
    }
    // Pedoni (e il giocatore a piedi) davanti al muso: frenata d'emergenza
    const walkers = game.pedGrid
      ? game.pedGrid.queryCircle(v.x + cos * probe * 0.5, v.y + sin * probe * 0.5, probe * 0.7)
      : [];
    for (const w of walkers) {
      if (w.dead) continue;
      const dx = w.x - v.x;
      const dy = w.y - v.y;
      const forward = dx * cos + dy * sin;
      const lateral = Math.abs(-dx * sin + dy * cos);
      if (forward > 0 && forward < probe * 0.95 && lateral < 18) {
        blocked = Math.max(blocked, 0.82);
      }
    }
    const pl = game.player;
    if (pl.onFoot) {
      const dx = pl.x - v.x;
      const dy = pl.y - v.y;
      const forward = dx * cos + dy * sin;
      const lateral = Math.abs(-dx * sin + dy * cos);
      if (forward > 0 && forward < probe * 0.9 && lateral < 26) {
        blocked = Math.max(blocked, 1);
        ai.honkT -= dt;
        if (ai.honkT <= 0) {
          ai.honkT = 2.2;
          game.audio?.honk(v);
        }
      }
    }
    if (blocked > 0) target *= 1 - Math.min(1, blocked * 1.35);

    // Etichetta diagnostica (visibile in debug): perché questo veicolo rallenta.
    ai.why = waitingAtLight ? 'incrocio' : blocked > 0.5 ? 'coda' : target < 20 ? 'curva' : 'libero';

    // Comando finale
    const diff = target - v.speed;
    if (diff > 6) v.throttle = clamp(diff / 60, 0.15, 1);
    else if (diff < -6) v.throttle = clamp(diff / 90, -1, -0.1);
    else v.throttle = 0.05;
    v.handbrake = false;

    if (target <= 1 && v.speed < 12) {
      v.throttle = -0.4;
      ai.waitT += dt;
    } else {
      ai.waitT = 0;
    }

    // Anti-ingorgo: fermo senza motivo (verde libero, nessuno davanti) -> manovra.
    if (Math.abs(v.speed) < 12 && !waitingAtLight && blocked < 0.5) {
      ai.jamT = (ai.jamT || 0) + dt;
      if (ai.jamT > 1.7) {
        ai.jamT = 0;
        ai.jamCount = (ai.jamCount || 0) + 1;
        // Fermo contro un ostacolo: manovra in retromarcia, poi riprende la corsia.
        ai.recoverT = 0.9;
        ai.recoverSteer = this.rng.chance(0.5) ? 1 : -1;
      }
    } else {
      ai.jamT = 0;
    }
  }
}
