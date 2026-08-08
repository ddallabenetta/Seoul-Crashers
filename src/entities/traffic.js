// Traffico: streaming di veicoli attorno al giocatore, guida AI su grafo stradale,
// rispetto dei semafori, distanza di sicurezza, auto parcheggiate.
import { createVehicle, updateVehicle, airborne } from './vehicle.js';
import { VEHICLE_TYPES } from '../render/sprites.js';
import { lanePoint, laneCount, canPass } from '../world/roadgraph.js';
import { DISTRICT_BY_ID } from '../world/districts.js';
import { angleDiff, clamp, circleRectPush, dist, pointSegment } from '../core/math.js';
import { createPed } from './pedestrians.js';

// Quante auto in circolazione attorno al giocatore. Sceso da 54 a 44 con la
// revisione della guida (§5.10): con una distanza di sicurezza vera la domanda
// superava quello che gli incroci semaforizzati riescono a smaltire, e le code
// crescevano fino a non smaltirsi più. Misurato: a 48 il flusso mediano cala del
// 23%, a 44 del 6%. Il limite di capacità sta lì in mezzo.
const MAX_TRAFFIC = 44;
const MAX_PARKED = 24;

// Spazio libero fra i paraurti che un'auto vuole trovarsi davanti da ferma. Tutte
// le distanze di sicurezza partono da qui e si misurano **fra le carrozzerie**:
// un confronto fra i centri farebbe cominciare la frenata quando i due mezzi si
// stanno già toccando (una berlina è lunga 78 px).
const GAP_STOP = 13;

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

  /**
   * Quante auto in circolazione. Un pilota di `life.js` ha `ai.mode` e non è
   * traffico: contarlo vorrebbe dire che ogni aereo che passa toglie una berlina
   * dalla strada sotto.
   */
  countTraffic() {
    let n = 0;
    for (const v of this.vehicles) if (v.driver === 'ai' && !(v.ai && v.ai.mode)) n++;
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
      // Non far comparire un'auto addosso a un'altra. Lo spazio richiesto è quello
      // che l'AI terrà comunque: 88 px fissi vanno bene fra due berline e sono
      // *dentro* un autobus lungo 158. Il grumo che ne usciva prima si scioglieva
      // a spintoni; adesso che le auto si cedono il passo, non si scioglie più —
      // e il `prewarm` può generare anche in campo visivo.
      let clear = true;
      for (const v of this.vehicles) {
        const need = 54 + VEHICLE_TYPES[v.kind].len * 0.5 + GAP_STOP;
        if (dist(v.x, v.y, pt.x, pt.y) < need) { clear = false; break; }
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
      // Il bonus di continuità è quello che evita l'inversione di senso dopo un
      // urto che ha girato l'auto: cambiare corsia vuol dire attraversare quella
      // opposta, e per due secondi si guida contromano.
      let score = -p.dist * 0.6 + Math.abs(dot) * 90;
      if (e === v.ai.edge && dir === v.ai.dir) score += 120;
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
    // Chi ha un `mode` non guida su questa maglia: vola, naviga, ara un campo o
    // sta scappando. La fisica resta questa, a cambiare è solo chi scrive gas e
    // sterzo (vedi `life.js`).
    if (ai.mode) {
      if (game.life) game.life.drive(v, dt, game);
      return;
    }
    const graph = this.city.graph;
    const spec = VEHICLE_TYPES[v.kind];

    // Sgombero dell'incrocio appena attraversato. La prenotazione **non** si può
    // liberare al cambio d'arco: lì il muso è già sulla strada nuova ma la coda è
    // ancora in mezzo alla giunzione, e l'asse perpendicolare parte addosso a chi
    // sta ancora attraversando. È da qui che nascevano gli incastri a croce, con
    // due mezzi fermi dentro l'incrocio ognuno davanti all'altro.
    if (ai.clearing) {
      const c = ai.clearing;
      if ((v.x - c.node.x) ** 2 + (v.y - c.node.y) ** 2 > c.r * c.r) {
        if (c.node.claimAxis === c.axis) c.node.claimAxis = null;
        ai.clearing = null;
      } else if (c.node.claimAxis === c.axis) {
        c.node.claimT = game.time;
      }
    }

    // Recupero: manovra in retromarcia dopo essere rimasti incastrati.
    if (ai.recoverT > 0) {
      ai.recoverT -= dt;
      v.throttle = -(ai.recoverPower || 0.42);
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
        ai.clearing = endNode.claimAxis === edge.axis
          ? { node: endNode, axis: edge.axis, r: nodeHalf + spec.len * 0.15 }
          : null;
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

    // --- percezione ------------------------------------------------------------
    // Prima si guarda, poi si decide. `cap` è la velocità massima compatibile con
    // quello che c'è davanti; `queued` distingue "incolonnato" da "piantato", ed è
    // la differenza che decide se ha senso tentare una manovra.
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    const cap = this.senseAhead(v, spec, cos, sin, dt, game);
    const queued = cap < 42;

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

    // Incrocio. Due regole distinte, e servono entrambe:
    //   1. non entrare se non si esce (`boxBlocked`): decide *se c'è posto*;
    //   2. la prenotazione per asse: decide *di chi è il turno*.
    // La prima è quella che impedisce l'ingorgo: senza, la coda ferma dell'asse
    // verde si allunga dentro l'incrocio e tappa quello rosso, e da lì non si
    // esce più. La seconda vale **solo dove non c'è semaforo**: dove c'è, il
    // turno lo assegna già la lanterna, e sommarci una prenotazione significa
    // rifiutare il passaggio a chi ha il verde perché l'altro asse — che ha il
    // rosso — non ha ancora liberato la sua prenotazione.
    ai.forceT = Math.max(0, (ai.forceT || 0) - dt);
    let forcing = false;
    if (!waitingAtLight && stopDist < 70 && stopDist >= 4) {
      const boxFull = ai.forceT <= 0 && this.boxBlocked(v, spec, endNode, game);
      ai.boxT = boxFull ? (ai.boxT || 0) + dt : 0;
      // Cedere il passo a chi sta a sua volta cedendo il passo è un blocco che non
      // si scioglie da solo: su una maglia fitta l'uscita di un incrocio è già la
      // coda di quello dopo, e la cortesia si propaga all'indietro per mezza città.
      // Dopo qualche secondo qualcuno entra lo stesso.
      if (boxFull && ai.boxT < 3.5) {
        target = stopDist < 26 ? 0 : Math.min(target, (stopDist - 20) * 1.4);
        waitingAtLight = true;
      } else if (!endNode.signal && stopDist < 44) {
        const free = endNode.claimAxis === null
          || endNode.claimAxis === edge.axis
          || game.time - endNode.claimT > 0.6;
        if (free || ai.forceT > 0) {
          forcing = !free;
          endNode.claimAxis = edge.axis;
          endNode.claimT = game.time;
        } else {
          target = stopDist < 24 ? 0 : Math.min(target, stopDist * 1.4);
          waitingAtLight = true;
        }
      }
    }

    if (cap < target) target = Math.max(0, cap);

    // Etichetta diagnostica (visibile in debug): perché questo veicolo rallenta.
    ai.why = forcing ? 'sblocco'
      : waitingAtLight ? 'incrocio'
      : queued ? 'coda'
      : target < 20 ? 'curva' : 'libero';

    // Comando finale
    const diff = target - v.speed;
    if (diff > 6) v.throttle = clamp(diff / 60, 0.15, 1);
    else if (diff < -6) v.throttle = clamp(diff / 90, -1, -0.1);
    else v.throttle = 0.05;
    v.handbrake = false;

    if (target <= 1) {
      ai.waitT += dt;
      // Fermo vuol dire fermo: `throttle` negativo a velocità nulla è retromarcia,
      // e una coda che indietreggia si tampona da sola.
      if (v.speed > 3) v.throttle = -1;
      else { v.throttle = 0; v.handbrake = true; }
    } else {
      ai.waitT = 0;
    }

    // Anti-ingorgo: fermo senza motivo (verde libero, nessuno davanti) -> manovra.
    if (Math.abs(v.speed) < 12 && !waitingAtLight && !queued) {
      ai.jamT = (ai.jamT || 0) + dt;
      if (ai.jamT > 1.7) {
        ai.jamT = 0;
        ai.jamCount = (ai.jamCount || 0) + 1;
        this.startRecovery(v, heading, game);
      }
    } else {
      ai.jamT = 0;
    }

    // Backstop contro lo stallo: qualunque sia la ragione dichiarata, nove secondi
    // fermi non sono mai una situazione sana — il rosso più lungo dura 7,7 s. Serve
    // perché adesso le code sono vere, e il capo di una coda ferma può benissimo
    // essere un'auto incastrata sull'angolo di un isolato: chi le sta dietro dice
    // 'coda' in perfetta buona fede e l'anti-ingorgo non lo guarda nemmeno.
    // `startRecovery` decide da sé quale delle due situazioni è.
    if (Math.abs(v.speed) < 6) {
      ai.stallT = (ai.stallT || 0) + dt;
      if (ai.stallT > 9) {
        ai.stallT = 0;
        ai.jamCount = (ai.jamCount || 0) + 1;
        this.startRecovery(v, heading, game);
      }
    } else {
      ai.stallT = 0;
    }
  }

  /**
   * La velocità massima compatibile con quello che c'è davanti al muso —
   * `Infinity` se la strada è libera, 0 se c'è un pedone. **Tutte le distanze sono
   * fra le carrozzerie**: il confronto fra i centri faceva cominciare la frenata
   * quando le due auto si toccavano già, ed è da lì che veniva metà degli incidenti.
   */
  senseAhead(v, spec, cos, sin, dt, game) {
    const half = spec.len * 0.5;
    const speed = Math.abs(v.speed);
    const reach = half + GAP_STOP + speed * 0.85 + 40;
    const ahead = game.vehicleGrid.queryCircle(v.x + cos * reach * 0.5, v.y + sin * reach * 0.5, reach * 0.5 + 44);
    let cap = Infinity;
    for (const o of ahead) {
      if (o === v || airborne(o)) continue;
      const ospec = VEHICLE_TYPES[o.kind];
      const dx = o.x - v.x;
      const dy = o.y - v.y;
      const forward = dx * cos + dy * sin;
      if (forward <= 0) continue;
      // La finestra laterale è la somma delle due carrozzerie, non un numero fisso:
      // un autobus è largo il doppio di uno scooter. Il tetto la tiene sotto la
      // distanza fra le due corsie (38 px), o si frenerebbe per chi arriva in senso
      // opposto sulla sua corsia.
      const side = Math.min(31, (spec.wid + ospec.wid) * 0.5 + 5);
      if (Math.abs(-dx * sin + dy * cos) > side) continue;
      const gap = forward - (spec.len + ospec.len) * 0.5;
      // Si punta alla velocità di chi sta davanti, corretta dall'errore di
      // distanza. Ridurre invece la velocità *desiderata* in proporzione allo
      // spazio mancante (quello che si faceva prima) innesca le onde di
      // stop-and-go: chi frena troppo fa frenare di più chi ha dietro, e la coda
      // si ferma da sola senza che davanti ci sia niente.
      const lead = Math.max(0, o.vx * cos + o.vy * sin);
      const want = GAP_STOP + speed * 0.16;
      cap = Math.min(cap, Math.max(0, lead + (gap - want) * 2.6));
    }
    // Pedoni (e il giocatore a piedi) davanti al muso: frenata d'emergenza
    const walkReach = half + 26 + speed * 0.6;
    const walkers = game.pedGrid
      ? game.pedGrid.queryCircle(v.x + cos * walkReach * 0.5, v.y + sin * walkReach * 0.5, walkReach * 0.5 + 30)
      : [];
    for (const w of walkers) {
      if (w.dead) continue;
      const dx = w.x - v.x;
      const dy = w.y - v.y;
      const forward = dx * cos + dy * sin - half;
      if (forward > -6 && forward < 20 + speed * 0.55 && Math.abs(-dx * sin + dy * cos) < 18) cap = 0;
    }
    const pl = game.player;
    if (pl.onFoot) {
      const dx = pl.x - v.x;
      const dy = pl.y - v.y;
      const forward = dx * cos + dy * sin - half;
      if (forward > -6 && forward < 24 + speed * 0.5 && Math.abs(-dx * sin + dy * cos) < 26) {
        cap = 0;
        v.ai.honkT -= dt;
        if (v.ai.honkT <= 0) {
          v.ai.honkT = 2.2;
          game.audio?.honk(v);
        }
      }
    }
    return cap;
  }

  /**
   * C'è posto **oltre** l'incrocio per la nostra carrozzeria? Il punto guardato è
   * sulla corsia di uscita, appena fuori dal quadrilatero dell'incrocio: se lì c'è
   * un mezzo fermo, entrare significa restare in mezzo alla giunzione con il muso
   * fuori e la coda dentro, e da quel momento l'asse perpendicolare non passa più.
   */
  boxBlocked(v, spec, endNode, game) {
    const ai = v.ai;
    const choice = ai.nextChoice || (ai.nextChoice = this.city.graph.nextLane(endNode, ai.edge, this.rng));
    if (!choice) return false;
    const e = choice.edge;
    const exitHalf = (e.axis === 'v' ? endNode.hWidth : endNode.vWidth) / 2;
    const fx = choice.dir > 0 ? e.dx : -e.dx;
    const fy = choice.dir > 0 ? e.dy : -e.dy;
    // Lo spazio che serve per essere davvero *fuori* dall'incrocio: metà giunzione
    // più tutta la carrozzeria più il respiro di una coda ferma.
    const need = exitHalf + spec.len + GAP_STOP;
    const lane = Math.min(ai.lane, laneCount(e) - 1);
    const p = lanePoint(e, choice.dir, lane, need * 0.6, this.tmp);
    for (const o of game.vehicleGrid.queryCircle(p.x, p.y, need * 0.6 + 50)) {
      // Solo chi è *fermo* tappa l'uscita: una coda che striscia si sgombra da
      // sola prima che ci arriviamo. E solo chi è nella corsia d'uscita: senza il
      // filtro laterale contava anche il traffico fermo in senso opposto, a 38 px.
      if (o === v || airborne(o) || Math.abs(o.speed) > 14) continue;
      const dx = o.x - endNode.x;
      const dy = o.y - endNode.y;
      const along = dx * fx + dy * fy;
      if (along <= 0 || Math.abs(-dx * fy + dy * fx) > 34) continue;
      if (along - VEHICLE_TYPES[o.kind].len * 0.5 < need) return true;
    }
    return false;
  }

  /**
   * Manovra di sblocco. Lo sterzo non è più a caso: si va indietro dalla parte da
   * cui si deve ripartire, e se qualcuno è incollato dietro non si indietreggia
   * affatto — è così che una manovra di recupero innescava la carambola successiva.
   */
  startRecovery(v, heading, game) {
    const ai = v.ai;
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    const spec = VEHICLE_TYPES[v.kind];
    const half = spec.len * 0.5;
    // Alla terza volta che si resta piantati nello stesso posto, la prudenza ha
    // già fallito due volte: si indietreggia comunque, ma piano. Una spinta
    // gentile a chi sta dietro costa un urto leggero; restare incastrati costa
    // quella strada per il resto della partita.
    const stubborn = (ai.jamCount || 0) >= 3;
    let penned = false;
    for (const o of game.vehicleGrid.queryCircle(v.x - cos * half, v.y - sin * half, spec.len + 24)) {
      if (o === v || airborne(o)) continue;
      const back = -((o.x - v.x) * cos + (o.y - v.y) * sin);
      const side = Math.abs(-(o.x - v.x) * sin + (o.y - v.y) * cos);
      if (back > 0 && back - (spec.len + VEHICLE_TYPES[o.kind].len) * 0.5 < 22 && side < 30) {
        penned = true;
        break;
      }
    }
    // Dietro non c'è solo il traffico, c'è anche il muro. Indietreggiare contro un
    // palazzo rompe la macchina e la lascia incastrata lo stesso: i solidi
    // `vehicleOnly` (gradini, transenne) invece si possono strusciare.
    if (!penned) {
      const bx = v.x - cos * spec.len * 0.9;
      const by = v.y - sin * spec.len * 0.9;
      for (const s of game.city.solidGrid.queryRect(bx - 32, by - 32, 64, 64)) {
        if (s.vehicleOnly) continue;
        if (circleRectPush(bx, by, spec.wid * 0.5, s)) { penned = true; break; }
      }
    }
    if (penned && !stubborn) {
      // Nessuno spazio dietro: si forza il passaggio invece di indietreggiare.
      ai.forceT = 2;
      return;
    }
    ai.recoverT = 0.8;
    ai.recoverPower = penned ? 0.22 : 0.42;
    ai.recoverSteer = heading > 0 ? -1 : 1;
  }
}
