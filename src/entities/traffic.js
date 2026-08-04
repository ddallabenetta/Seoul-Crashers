// Traffico: streaming di veicoli attorno al giocatore, guida AI su grafo stradale,
// rispetto dei semafori, distanza di sicurezza, auto parcheggiate.
import { createVehicle, updateVehicle, airborne } from './vehicle.js';
import { VEHICLE_TYPES } from '../render/sprites.js';
import { lanePoint, laneCount, canPass } from '../world/roadgraph.js';
import { DISTRICT_BY_ID } from '../world/districts.js';
import { angleDiff, clamp, circleRectPush, dist, pointSegment } from '../core/math.js';
import { createPed } from './pedestrians.js';

const MAX_TRAFFIC = 54;
const MAX_PARKED = 24;

/**
 * Ingombro di un veicolo proiettato sugli assi di chi lo guarda, data la
 * differenza fra i due musi. Serve a misurare lo spazio **fra i paraurti**
 * invece che fra i centri: un autobus è lungo 158 px, e chi misura dai centri
 * non vede mai la coda della fila davanti a sé. Vale anche per chi attraversa
 * di traverso, che di lato ingombra per tutta la sua lunghezza.
 * Riusa un oggetto solo: gira per ogni candidato di ogni veicolo, ogni frame.
 */
const EXT = { fwd: 0, side: 0 };
function halfExtents(spec, da) {
  const c = Math.abs(Math.cos(da));
  const s = Math.abs(Math.sin(da));
  EXT.fwd = spec.len * 0.5 * c + spec.wid * 0.5 * s;
  EXT.side = spec.len * 0.5 * s + spec.wid * 0.5 * c;
  return EXT;
}

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
    this._q = [];
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

      const district = DISTRICT_BY_ID[this.city.districtAt(pt.x, pt.y).id];
      let kind = rng.pick(district.vehicleMix);
      // Autobus e camion solo sui boulevard: negli incroci stretti si incastrano.
      if ((kind === 'bus' || kind === 'truck') && !edge.arterial) {
        kind = rng.pick(district.vehicleMix.filter((k) => k !== 'bus' && k !== 'truck'));
      }
      // Non far comparire un'auto addosso a un'altra. La distanza dipende da cosa
      // si immette: 88 px fissi facevano nascere un autobus (158 px) dentro la
      // berlina che aveva davanti, e la carambola partiva già dallo spawn.
      const spec = VEHICLE_TYPES[kind];
      let clear = true;
      for (const o of this.vehicles) {
        const room = (spec.len + VEHICLE_TYPES[o.kind].len) * 0.6 + 14;
        if (dist(o.x, o.y, pt.x, pt.y) < room) { clear = false; break; }
      }
      if (!clear) continue;

      const v = createVehicle(kind, pt.x, pt.y, pt.angle, rng.int(0, 9));
      v.driver = 'ai';
      v.lightsOn = game.isNight;
      v.ai = {
        edge, dir, lane, s,
        target: this.cruiseSpeed(edge, kind, rng),
        nextChoice: null,
        waitT: 0,
        jamT: 0,
        deadlockT: 0,
        skewT: 0,
        recoverT: 0,
        recoverSteer: 0,
        claimNode: null,   // incrocio prenotato, finché non se ne è usciti
        claimAxis: null,
        claimT: 0,
        // Forbice stretta: su strada a una corsia non si sorpassa, quindi chi va
        // piano detta il passo a tutta la fila e ogni punto di dispersione in più
        // si paga in congestione. Con 0.75-1.2 non si vedeva, perché senza
        // distanza di sicurezza le auto si attraversavano invece di accodarsi.
        aggression: rng.range(0.9, 1.15),
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
      // Il senso di marcia lo decide **da che parte della strada ci si trova**,
      // non dove punta il muso: si tiene la destra, quindi il lato è il dato
      // affidabile. Dopo un testacoda il muso guarda indietro, ed è così che si
      // finiva a ripartire contromano. Sulla mezzeria decide il muso.
      const side = (v.x - e.ax) * -e.dy + (v.y - e.ay) * e.dx;
      const dir = Math.abs(side) > 10 ? (side >= 0 ? 1 : -1) : (dot >= 0 ? 1 : -1);
      // Preferisce la strada vicina e quella allineata col nostro asse.
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
    v.ai.deadlockT = 0;
    v.ai.skewT = 0;
    v.ai.recoverT = 0;
    v.ai.claimNode = null;
    return true;
  }

  /** Qualcuno attaccato alla coda: in retromarcia lo si prende in pieno. */
  blockedBehind(v, spec, game) {
    const cos = Math.cos(v.angle);
    const sin = Math.sin(v.angle);
    const reach = spec.len * 0.5 + 120;
    const near = game.vehicleGrid.queryCircle(
      v.x - cos * reach * 0.5, v.y - sin * reach * 0.5, reach * 0.5 + 82, this._q
    );
    for (const o of near) {
      if (o === v || airborne(o)) continue;
      const dx = o.x - v.x;
      const dy = o.y - v.y;
      const back = -(dx * cos + dy * sin);
      if (back <= 0) continue;
      const ext = halfExtents(VEHICLE_TYPES[o.kind], o.angle - v.angle);
      if (Math.abs(-dx * sin + dy * cos) - spec.wid * 0.5 - ext.side > -5) continue;
      if (back - spec.len * 0.5 - ext.fwd < 40) return true;
    }
    return false;
  }

  /**
   * Svolta a sinistra: taglia la corsia di chi arriva di fronte, e va ceduta.
   * La prenotazione dell'incrocio è per **asse**, quindi due auto che escono
   * dallo stesso asse in direzioni opposte hanno via libera tutte e due e si
   * incrociano dentro l'incrocio: è la seconda fonte di urti dopo i tamponamenti.
   * (Con y verso il basso, il prodotto vettoriale negativo è la svolta a sinistra.)
   */
  mustYieldTurn(v, edge, node, game) {
    const ai = v.ai;
    const next = ai.nextChoice;
    if (!next) return false;
    const d1x = edge.dx * ai.dir, d1y = edge.dy * ai.dir;
    const d2x = next.edge.dx * next.dir, d2y = next.edge.dy * next.dir;
    if (d1x * d2y - d1y * d2x > -0.5) return false; // dritto o a destra: non incrocia
    for (const o of game.vehicleGrid.queryCircle(node.x, node.y, 190, this._q)) {
      if (o === v || !o.ai) continue;
      // Fermo non arriva: senza questa riga due che svoltano opposti si cedono la
      // strada a vicenda per sempre.
      if (Math.abs(o.speed) < 30) continue;
      const oe = o.ai.edge;
      const ox = oe.dx * o.ai.dir, oy = oe.dy * o.ai.dir;
      if (ox * d1x + oy * d1y > -0.7) continue;                       // non è di fronte
      if ((node.x - o.x) * ox + (node.y - o.y) * oy <= 0) continue;   // ha già passato
      // Sulla nostra strada, non su una parallela un isolato più in là.
      if (Math.abs((o.x - node.x) * -d1y + (o.y - node.y) * d1x) > 80) continue;
      return true;
    }
    return false;
  }

  // --- guida AI --------------------------------------------------------------
  driveAI(v, dt, game) {
    const ai = v.ai;
    if (!ai) return;
    const graph = this.city.graph;
    const spec = VEHICLE_TYPES[v.kind];
    const halfLen = spec.len * 0.5;

    // Recupero: manovra in retromarcia dopo essere rimasti incastrati. Alla cieca
    // no: dietro c'è quasi sempre la coda che ci ha spinti fin lì, e la manovra
    // di recupero era il tamponamento successivo.
    if (ai.recoverT > 0) {
      ai.recoverT -= dt;
      if (this.blockedBehind(v, spec, game)) {
        v.throttle = 0;
        v.steer = 0;
        v.handbrake = true;
      } else {
        v.throttle = -0.55;
        v.steer = ai.recoverSteer;
        v.handbrake = false;
      }
      if (ai.recoverT <= 0) this.reacquireLane(v);
      return;
    }

    // Rinnovo della prenotazione: l'incrocio resta di chi lo sta attraversando
    // finché la coda non ne è uscita. Con una scadenza a tempo fisso un autobus,
    // che ci mette il doppio di una berlina, se la vedeva scadere addosso e il
    // perpendicolare gli entrava nella fiancata. Dopo 3,5 s si molla comunque:
    // a quel punto siamo incastrati, e tenere fermo anche l'altro asse non aiuta.
    if (ai.claimNode) {
      const cn = ai.claimNode;
      ai.claimT += dt;
      const box = Math.max(cn.vWidth, cn.hWidth) * 0.5 + halfLen + 10;
      if (ai.claimT > 3.5 || dist(v.x, v.y, cn.x, cn.y) > box) ai.claimNode = null;
      else if (cn.claimAxis === ai.claimAxis) cn.claimT = game.time;
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
    // e finisce sul marciapiede, dove resta piantata. L'anticipo però va misurato
    // sulla velocità, non fisso: 175 px sono più lunghi di un isolato di Hongdae
    // (passo 126-196), quindi chi doveva svoltare viaggiava a 64 px/s per tutto
    // il tratto — e con lui tutta la fila dietro.
    const turnLead = Math.min(175, 40 + Math.abs(v.speed) * 1.1);
    if (ai.nextChoice && ai.nextChoice.edge.axis !== edge.axis && ai.s > edge.len - turnLead) {
      target = Math.min(target, 64);
    }
    // Anche subito dopo la svolta la velocità va tenuta bassa finché non si è
    // riallineati alla nuova corsia.
    if (Math.abs(heading) > 0.5) target = Math.min(target, 96);

    const stopDist = edge.len - nodeHalf - 10 - ai.s;

    // Distanza di sicurezza. Si misura **fra i paraurti**, non fra i centri: con
    // la sola distanza dei centri chi si accodava a un autobus (158 px) non
    // vedeva niente davanti a sé, si dava "libero", riaccelerava e lo tamponava —
    // e poi l'anti-ingorgo lo mandava pure in retromarcia. Era la prima causa di
    // urti di tutto il traffico. Dell'altro si prende l'ingombro **longitudinale**
    // proiettato sul nostro muso, così vale anche per chi è messo di traverso.
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    const gapWant = 16 + Math.abs(v.speed) * 0.45;
    // Vicino a un incrocio si guarda più lontano: serve a sapere se **oltre**
    // l'incrocio c'è posto per noi, non solo se la strada qui è libera.
    const scan = halfLen + 82 + (stopDist < 60 ? Math.max(gapWant, nodeHalf * 2 + 70) : gapWant);
    const ahead = game.vehicleGrid.queryCircle(
      v.x + cos * scan * 0.5, v.y + sin * scan * 0.5, scan * 0.5 + 82
    );
    let blocked = 0;
    let follow = Infinity;     // velocità che il gap davanti concede
    let queueGap = Infinity;   // spazio libero davanti, anche oltre l'incrocio
    let queueSlow = false;
    for (const o of ahead) {
      if (o === v || airborne(o)) continue;
      const dx = o.x - v.x;
      const dy = o.y - v.y;
      const forward = dx * cos + dy * sin;
      if (forward <= 0) continue;
      const ospec = VEHICLE_TYPES[o.kind];
      // Di lato la tolleranza è sulle **larghezze**: si frena per chi occupa la
      // nostra corsia, non per chi è di traverso. Frenare anche per quello sembra
      // prudente e invece ferma la città — agli incroci ognuno vede la fila
      // perpendicolare in attesa dentro il proprio cono e non riparte più nessuno.
      // Chi attraversa lo tiene fuori la prenotazione, che è il posto giusto.
      if (Math.abs(-dx * sin + dy * cos) > (spec.wid + ospec.wid) * 0.5 - 2) continue;
      const gap = forward - halfLen - halfExtents(ospec, o.angle - v.angle).fwd;
      if (gap < queueGap) {
        queueGap = gap;
        queueSlow = Math.abs(o.speed) < 12;
      }
      if (gap > gapWant) continue;
      // Velocità concessa: **quella di chi è davanti** più quella che lo spazio
      // libero consente in più. Senza il primo termine una colonna lanciata a
      // 120 px/s dovrebbe strisciare a 30 solo perché sta vicina, e ogni coda
      // diventa una fisarmonica che in una città densa non riparte.
      const lead = Math.max(0, o.speed * Math.cos(o.angle - v.angle));
      follow = Math.min(follow, lead + Math.max(0, gap - 12) * 1.9);
      blocked = Math.max(blocked, gap <= 2 ? 1 : 1 - gap / gapWant);
    }
    target = Math.min(target, follow);

    // Semaforo
    let waitingAtLight = false;
    let redLight = false;
    if (endNode.signal && stopDist < 130 && stopDist > -4) {
      if (!canPass(endNode, edge.axis, game.time)) {
        target = stopDist < 22 ? 0 : Math.min(target, stopDist * 1.5);
        waitingAtLight = true;
        redLight = true;
      }
    }

    // Prenotazione dell'incrocio: un asse per volta. La fila che sta già passando
    // rinnova la prenotazione, l'asse perpendicolare aspetta il suo turno.
    let whyJunction = 'incrocio';
    if (!waitingAtLight && stopDist < 44) {
      const insideJunction = stopDist < 4;
      const free = endNode.claimAxis === null
        || endNode.claimAxis === edge.axis
        || game.time - endNode.claimT > 0.8;
      // Non entrare in un incrocio se dall'altra parte non c'è posto: è così che
      // una coda ferma si mangia l'incrocio e blocca anche l'asse perpendicolare,
      // che a quel punto non ha nessun modo di sbloccarsi da solo.
      const exitJammed = queueSlow && queueGap < nodeHalf + halfLen + 20;
      const yieldTurn = !exitJammed && free && this.mustYieldTurn(v, edge, endNode, game);
      if (!insideJunction && (!free || exitJammed || yieldTurn)) {
        target = stopDist < 24 ? 0 : Math.min(target, stopDist * 1.4);
        waitingAtLight = true;
        whyJunction = exitJammed ? 'sbocco' : yieldTurn ? 'precedenza' : 'incrocio';
      } else if (free && (insideJunction || Math.abs(v.speed) > 8)) {
        // Prenota solo chi ci sta entrando davvero. Un'auto ferma prima della
        // linea che tenesse la prenotazione la rinnoverebbe ogni frame senza mai
        // usarla, e l'asse perpendicolare non passerebbe più.
        if (ai.claimNode !== endNode) {
          ai.claimNode = endNode;
          ai.claimAxis = edge.axis;
          ai.claimT = 0;
        }
        endNode.claimAxis = edge.axis;
        endNode.claimT = game.time;
      }
    }

    // Pedoni (e il giocatore a piedi) davanti al muso: frenata d'emergenza. Qui
    // il taglio secco del gas ci sta — chi attraversa non si "segue", si evita.
    const probe = 30 + Math.abs(v.speed) * 0.6;
    let hazard = 0;
    const walkers = game.pedGrid
      ? game.pedGrid.queryCircle(v.x + cos * probe * 0.5, v.y + sin * probe * 0.5, probe * 0.7)
      : [];
    for (const w of walkers) {
      if (w.dead) continue;
      const dx = w.x - v.x;
      const dy = w.y - v.y;
      const forward = dx * cos + dy * sin;
      const lateral = Math.abs(-dx * sin + dy * cos);
      if (forward > 0 && forward < probe * 0.95 && lateral < 18) hazard = Math.max(hazard, 0.82);
    }
    const pl = game.player;
    if (pl.onFoot) {
      const dx = pl.x - v.x;
      const dy = pl.y - v.y;
      const forward = dx * cos + dy * sin;
      const lateral = Math.abs(-dx * sin + dy * cos);
      if (forward > 0 && forward < probe * 0.9 && lateral < 26) {
        hazard = 1;
        ai.honkT -= dt;
        if (ai.honkT <= 0) {
          ai.honkT = 2.2;
          game.audio?.honk(v);
        }
      }
    }
    if (hazard > 0) target *= 1 - Math.min(1, hazard * 1.35);
    blocked = Math.max(blocked, hazard);

    // Etichetta diagnostica (visibile in debug e in `ai.why`): perché questo
    // veicolo rallenta. Distinguere i motivi non è pignoleria — è l'unico modo di
    // sapere se un ingorgo è una coda, una precedenza o un incastro.
    ai.why = redLight ? 'semaforo'
      : waitingAtLight ? whyJunction
      : blocked > 0.5 ? 'coda'
      : target < 20 ? 'curva' : 'libero';

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

    // Anti-ingorgo. Due tempi diversi per due situazioni diverse: fermo *senza
    // motivo* (nessuno davanti, nessuno a cui cedere) è un incastro fisico e si
    // manovra subito; fermo in coda o a un incrocio è normale e si smaltisce da
    // solo — a meno che non sia un incastro vero, e per saperlo bisogna aspettare
    // più di un rosso, che dura 7,7 s (`SIGNAL_CYCLE`) più il tempo della fila.
    // Il conteggio lungo esclude **solo** il rosso: un'attesa all'incrocio che non
    // finisce mai è esattamente il caso da sbloccare, non da tollerare.
    const still = Math.abs(v.speed) < 12 && !redLight;
    if (still && !waitingAtLight && blocked < 0.5) {
      ai.jamT += dt;
      ai.deadlockT = 0;
    } else if (still) {
      ai.deadlockT += dt;
      ai.jamT = 0;
    } else {
      ai.jamT = 0;
      ai.deadlockT = 0;
    }
    // Fermo **e di traverso** non è mai una coda: è un'auto che un urto ha girato
    // e che adesso tappa la carreggiata a tutti quelli dietro. È quello che si
    // vede a schermo quando un incrocio "si riempie di macchine messe di sbieco",
    // e va sciolto in fretta, non dopo il timeout dell'incastro.
    if (still && Math.abs(heading) > 0.9) ai.skewT += dt;
    else ai.skewT = 0;
    if (ai.jamT > 1.7 || ai.skewT > 2.6 || ai.deadlockT > 14) {
      ai.skewT = 0;
      ai.jamT = 0;
      ai.deadlockT = 0;
      ai.jamCount = (ai.jamCount || 0) + 1;
      // Manovra in retromarcia, poi riprende la corsia. Lo sterzo non è a caso:
      // si gira dalla parte che riporta il muso verso la corsia (in retromarcia
      // il verso di rotazione è invertito). Tirandolo a sorte, in una coda densa
      // la manovra peggiorava la situazione una volta su due.
      ai.recoverT = 0.9;
      ai.recoverSteer = heading > 0 ? -1 : 1;
    }
  }
}
