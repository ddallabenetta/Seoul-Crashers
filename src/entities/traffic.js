// Traffico: streaming di veicoli attorno al giocatore, guida AI su grafo stradale,
// rispetto dei semafori, distanza di sicurezza, auto parcheggiate.
import { createVehicle, updateVehicle, airborne } from './vehicle.js';
import { VEHICLE_TYPES } from '../render/sprites.js';
import { lanePoint, laneCount, laneOffset, canPass } from '../world/roadgraph.js';
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

// Sorpasso e scelta della corsia in funzione della svolta (§5.34). Con `false` la
// guida è identica a quella di prima: la corsia si sceglie a caso alla nascita e
// non si cambia mai.
export const OVERTAKE = true;
const LANE = {
  slide: 1.1,       // corsie al secondo: 36 px in poco più di 0,9 s
  mandatory: 700,   // da quanto prima dell'incrocio ci si porta sulla corsia della svolta (le arterie hanno archi da ~290 px: di fatto subito)
  noOptional: 200,  // negli ultimi px non si sorpassa: è lì che ci si ritrova affiancati
  minBetween: 3,    // secondi fra due cambi facoltativi: senza, si fa ping-pong
  minMandatory: 0.3,
  slower: 75,       // quanto più lento del proprio target dev'essere il leader
  optional: true,   // sorpasso facoltativo (oltre alla corsia della svolta)
  window: 26,       // larghezza (px dal centro) in cui un'auto occupa una corsia
};

// Cedere il passo alle sirene (§5.36). Un oggetto e non costanti sciolte: `on` spegne
// tutto, anche il sorpasso delle volanti in `police.followRoads`.
export const YIELD = {
  on: true,
  range: 430,       // px: da quanto dietro (o davanti, contromano) una volante a sirena si fa sentire
  band: 60,         // px di scarto laterale entro cui la volante è «sulla mia strada»
  hold: 1.4,        // s di cortesia dopo l'ultima volta che era in vista: niente sfarfallio
  slow: 100,        // px/s: tetto di chi cede, perché la volante abbia il tempo di passare
  bias: 7,          // px verso il cordolo su una strada a corsia singola
  biasRate: 36,     // px/s
  nodeR: 330,       // una volante a sirena entro questo raggio dall'incrocio ferma chi sta per ripartire
  nodeHold: 4,      // s oltre i quali si riparte comunque: la cortesia non deve incastrare un incrocio
};

/** Svolta di `choice` rispetto all'arco da cui si arriva: dritto, destra, sinistra, inversione. */
export function turnOf(edge, dir, choice) {
  if (!choice) return 'dritto';
  const c = choice.edge;
  if (c.axis === edge.axis) return choice.dir === dir ? 'dritto' : 'inversione';
  const fx = dir > 0 ? edge.dx : -edge.dx, fy = dir > 0 ? edge.dy : -edge.dy;
  const gx = choice.dir > 0 ? c.dx : -c.dx, gy = choice.dir > 0 ? c.dy : -c.dy;
  // y verso il basso: il prodotto vettoriale positivo è una svolta a destra.
  return fx * gy - fy * gx > 0 ? 'destra' : 'sinistra';
}

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
    this.sirens = [];   // le volanti a sirena in moto, rifatte a ogni frame (§5.36)
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
    const sir = this.sirens;
    sir.length = 0;
    if (YIELD.on) {
      // Un posto di blocco ha la sirena ma non viene da nessuna parte; una volante
      // sbarcata nemmeno.
      for (const v of this.vehicles) {
        if (v.siren && v.driver === 'cop' && !v.dead && !v.deployed && !v.blockCar && Math.abs(v.speed) > 30) sir.push(v);
      }
    }
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
    for (const v of this.vehicles) if (v.driver === 'ai' && !(v.ai && (v.ai.mode || v.ai.scripted))) n++;
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
    if (v.ai.laneF !== undefined) v.ai.laneF = v.ai.lane;
    v.ai.s = best.s;
    v.ai.nextChoice = null;
    v.ai.jamT = 0;
    v.ai.recoverT = 0;
    return true;
  }

  // --- auto in servizio per la storia ------------------------------------------
  //
  // Il traffico sceglie a caso a ogni incrocio, ed è giusto così: nessuno di quei
  // guidatori sta andando da qualche parte. Una missione invece ha bisogno di
  // un'auto che **arrivi** — il corriere di M3 parte da un 편의점 di Itaewon e
  // scende in un parcheggio di Gangnam, e il pedinamento è tutta la scena.
  //
  // Il conto è lo stesso A* che disegna l'itinerario sulla carta (§5.30): si fa
  // **una volta** alla partenza, e da lì l'auto non cerca più niente — a ogni
  // incrocio guarda quale nodo viene dopo nella fila e prende l'arco che ci porta.
  // Quello che resta del traffico (semafori, distanza di sicurezza, code, urti)
  // vale per lei come per tutte, ed è quello che la fa sembrare un'auto e non un
  // binario: se qualcuno le si mette davanti, frena.

  /**
   * Un'auto guidata dalla storia, messa sulla corsia più vicina a un punto.
   *
   * Nasce `protect`: lo streaming toglie di mezzo chi è lontano (§5.10), e chi
   * sta pedinando **deve** poter restare indietro trecento metri senza che la
   * macchina davanti svanisca. Toccherà a chi l'ha creata levarla di mezzo.
   */
  spawnScripted(kind, x, y, game, opts = {}) {
    const graph = this.city.graph;
    const near = graph.edgesNear(x, y, opts.radius || 420);
    if (!near.length) return null;
    let best = null;
    let bestD = Infinity;
    for (const e of near) {
      const p = pointSegment(x, y, e.ax, e.ay, e.bx, e.by);
      if (p.dist >= bestD) continue;
      bestD = p.dist;
      best = { edge: e, t: p.t };
    }
    if (!best) return null;
    const dir = opts.dir || 1;
    const lane = Math.min(opts.lane || 0, laneCount(best.edge) - 1);
    const s = Math.max(20, Math.min(best.edge.len - 20, (dir > 0 ? best.t : 1 - best.t) * best.edge.len));
    const pt = lanePoint(best.edge, dir, lane, s, {});
    const v = createVehicle(kind, pt.x, pt.y, pt.angle, opts.colorIndex ?? this.rng.int(0, 9));
    v.driver = 'ai';
    v.protect = true;
    v.lightsOn = opts.lightsOn ?? game.isNight;
    v.ai = {
      edge: best.edge, dir, lane, s,
      target: opts.speed || this.cruiseSpeed(best.edge, kind, this.rng),
      nextChoice: null,
      waitT: 0,
      jamT: 0,
      recoverT: 0,
      recoverSteer: 0,
      aggression: opts.aggression || 1,
      honkT: 0,
      scripted: true,
    };
    this.vehicles.push(v);
    return v;
  }

  /**
   * «Vai lì.» Calcola la fila di incroci una volta e la lascia scritta sull'auto.
   * Senza grafo — o con una meta in un'altra componente, che a Jeju succede — non
   * si mente: si restituisce `false`, e chi ha chiamato sa di non avere un'auto
   * che arriva.
   */
  sendTo(v, x, y, game) {
    const graph = this.city.graph;
    if (!v.ai || !graph || !game.route) return false;
    const chain = game.route.solve(graph, graph.nearestNode(v.x, v.y), graph.nearestNode(x, y));
    if (!chain) return false;
    v.ai.plan = chain.map((n) => n.id);
    v.ai.planI = 0;
    v.ai.arrive = { x, y };
    v.ai.arrived = false;
    v.ai.nextChoice = null;
    v.ai.scripted = true;
    return true;
  }

  /**
   * Il prossimo arco a un incrocio. Senza itinerario è quello di sempre (a caso,
   * con la preferenza per il dritto); con un itinerario è quello che porta al
   * nodo dopo.
   *
   * **Un itinerario si perde, e non è un guasto**: basta un tamponamento che
   * gira l'auto e `reacquireLane` la rimette su una strada che nella fila non
   * c'era. Allora si ricalcola da dove si è finiti — una volta, e verso la stessa
   * meta. Se nemmeno quello riesce, l'auto torna traffico: meglio un corriere che
   * sbaglia strada di un corriere piantato in mezzo a un incrocio.
   */
  chooseNext(v, node, fromEdge, game) {
    const ai = v.ai;
    const graph = this.city.graph;
    if (ai.plan) {
      const lane = this.planLane(ai, node);
      if (lane) return lane;
      if (ai.arrive && game && this.sendTo(v, ai.arrive.x, ai.arrive.y, game)) {
        const retry = this.planLane(ai, node);
        if (retry) return retry;
      }
      ai.plan = null;
    }
    return graph.nextLane(node, fromEdge, this.rng);
  }

  /** L'arco che da `node` porta al nodo dopo nella fila, o `null`. */
  planLane(ai, node) {
    const plan = ai.plan;
    if (!plan) return null;
    // I nodi già passati si consumano qui: la fila è un percorso, non una coda di
    // ordini, e l'incrocio in cui siamo può essere il terzo come il primo.
    while (ai.planI < plan.length && plan[ai.planI] === node.id) ai.planI++;
    const want = plan[ai.planI];
    if (want === undefined) return null;
    for (const o of node.out) {
      if ((o.dir > 0 ? o.edge.b : o.edge.a) === want) return { edge: o.edge, dir: o.dir };
    }
    return null;
  }

  // --- corsia e sorpasso (§5.34) ----------------------------------------------
  //
  // Il pezzo che mancava al primo tentativo (docs/storico/04-traffico.md) era scegliere la
  // corsia **in funzione della svolta**: la corsia a destra serve a chi svolta a
  // destra, quella a sinistra a chi svolta a sinistra, e chi va dritto sta dove c'è
  // posto. La svolta si decide appena si entra nell'arco, non all'incrocio.

  /**
   * C'è posto, in questo istante, sulla corsia `want`? Davanti e dietro, con uno
   * spazio che cresce con la velocità relativa: chi arriva da dietro più veloce
   * di noi ha bisogno di più strada di chi ci sta alla pari.
   * Restituisce `null` se è occupata, altrimenti il gap davanti e la velocità di chi lo chiude.
   */
  laneProbe(v, spec, ai, want, game, eager = false) {
    // Chi deve per forza spostarsi (la svolta è vicina) si accontenta di meno spazio.
    const k = eager ? 0.6 : 1;
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    const delta = laneOffset(ai.edge, want) - laneOffset(ai.edge, ai.laneF);
    const mySpeed = Math.max(0, v.speed);
    let gapAhead = Infinity, speedAhead = Infinity;
    for (const o of game.vehicleGrid.queryCircle(v.x, v.y, 300)) {
      if (o === v || airborne(o)) continue;
      const dx = o.x - v.x, dy = o.y - v.y;
      const lat = -dx * sin + dy * cos;
      if (Math.abs(lat - delta) > LANE.window) continue;
      const fwd = dx * cos + dy * sin;
      const ospec = VEHICLE_TYPES[o.kind];
      const half = (spec.len + ospec.len) * 0.5;
      const oSp = Math.max(0, o.vx * cos + o.vy * sin);
      if (fwd >= 0) {
        const gap = fwd - half;
        if (gap < GAP_STOP + (eager ? 2 : 12) + Math.max(0, mySpeed - oSp) * 0.9 * k) return null;
        if (gap < gapAhead) { gapAhead = gap; speedAhead = oSp; }
      } else {
        const gap = -fwd - half;
        if (gap < (eager ? 10 : 16) + Math.max(0, oSp - mySpeed) * 1.1 * k + oSp * 0.1 * k) return null;
      }
    }
    return { gap: gapAhead, speed: speedAhead };
  }

  /** Sceglie la corsia desiderata e la fa scivolare. Solo per il traffico libero. */
  laneLogic(v, spec, dt, game, edge, endNode, nodeHalf) {
    const ai = v.ai;
    if (ai.laneF === undefined) { ai.laneF = ai.lane; ai.lcAge = 99; }
    ai.lcAge += dt;
    const maxLane = laneCount(edge) - 1;
    if (maxLane < 1) { ai.lane = 0; ai.laneF = 0; return; }
    // Scivolamento: l'offset cambia in modo continuo, mai a salti.
    if (ai.laneF !== ai.lane) {
      const step = LANE.slide * dt;
      ai.laneF = Math.abs(ai.lane - ai.laneF) <= step ? ai.lane : ai.laneF + Math.sign(ai.lane - ai.laneF) * step;
      return;
    }
    // Una volante a sirena alle spalle: dalla corsia interna ci si porta su quella
    // esterna (se c'è posto) e basta, nessun'altra decisione finché dura la cortesia.
    if (ai.yieldT > 0) {
      if (ai.lane === 0 && this.laneProbe(v, spec, ai, 1, game, true)) { ai.lane = 1; ai.lcAge = 0; }
      return;
    }
    if (!ai.nextChoice) ai.nextChoice = this.chooseNext(v, endNode, edge, game);
    const turn = turnOf(edge, ai.dir, ai.nextChoice);
    const toEnd = edge.len - nodeHalf - ai.s;
    let want = ai.lane;
    let forced = false;
    if (turn === 'destra') want = 1;
    else if (turn === 'sinistra' || turn === 'inversione') want = 0;
    if (want !== ai.lane && toEnd < LANE.mandatory && ai.lcAge > LANE.minMandatory) forced = true;
    else want = ai.lane;
    // Sorpasso facoltativo: solo se si va dritto, il leader è sensibilmente più
    // lento di quanto vorremmo andare e dall'altra parte si sta meglio.
    let probe = null;
    if (!forced && LANE.optional && turn === 'dritto' && toEnd > LANE.noOptional && ai.lcAge > LANE.minBetween
        && ai.leadGap < 120 && ai.leadSpeed < ai.target * ai.aggression - LANE.slower) {
      want = 1 - ai.lane;
      probe = this.laneProbe(v, spec, ai, want, game);
      if (!probe || probe.gap < Math.max(180, ai.leadGap + 100) || probe.speed < ai.leadSpeed + 40) return;
    } else if (!forced) return;
    else probe = this.laneProbe(v, spec, ai, want, game, true);
    if (!probe) return;
    ai.lane = want;
    ai.lcAge = 0;
  }

  // --- sirene (§5.36) ----------------------------------------------------------

  /**
   * C'è una volante a sirena sulla mia strada — alle spalle nello stesso verso, o
   * contromano davanti? Ne tiene il conto in `ai.yieldT`, che dura `YIELD.hold` dopo
   * l'ultima volta che la si è vista (altrimenti si cede e si riprende a ogni frame
   * in cui la volante esce dalla fascia). Ritorna la distanza della più vicina.
   */
  sirenWatch(v, ai, dt) {
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    let near = Infinity;
    for (const c of this.sirens) {
      const dx = c.x - v.x, dy = c.y - v.y;
      const lat = -dx * sin + dy * cos;
      if (Math.abs(lat) > YIELD.band) continue;
      const fwd = dx * cos + dy * sin;
      const same = Math.cos(c.angle - v.angle);
      let d = Infinity;
      if (same > 0.7 && fwd < 40 && fwd > -YIELD.range) d = Math.max(0, -fwd);
      else if (same < -0.7 && fwd > 20 && fwd < YIELD.range * 0.7) d = fwd;
      if (d < near) near = d;
    }
    if (near < Infinity) ai.yieldT = YIELD.hold;
    else if (ai.yieldT > 0) ai.yieldT = Math.max(0, ai.yieldT - dt);
    return near;
  }

  /**
   * Una volante a sirena sta per attraversare l'incrocio davanti a me, da un'altra
   * strada o contromano? Allora non si riparte (le volanti non guardano i semafori).
   */
  sirenCrossing(v, node) {
    for (const c of this.sirens) {
      const dx = node.x - c.x, dy = node.y - c.y;
      if (dx * dx + dy * dy > YIELD.nodeR * YIELD.nodeR) continue;
      if (c.vx * dx + c.vy * dy <= 0) continue;   // si sta allontanando
      if (Math.cos(c.angle - v.angle) > 0.7) continue;   // stesso verso: è un caso di `sirenWatch`
      return true;
    }
    return false;
  }

  /** Il waypoint davanti al muso, spostato verso il cordolo se si sta cedendo il passo. */
  wayPoint(ai, look) {
    const wp = lanePoint(ai.edge, ai.dir, ai.laneF ?? ai.lane, ai.s + look, this.tmp);
    if (ai.bias) {
      wp.x -= Math.sin(wp.angle) * ai.bias;
      wp.y += Math.cos(wp.angle) * ai.bias;
    }
    return wp;
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
      ai.nextChoice = this.chooseNext(v, endNode, edge, game);
    }

    // Transizione all'arco successivo. Il progresso va riproiettato subito sul
    // nuovo arco, altrimenti il waypoint finisce fuori strada e l'auto si pianta.
    if (ai.s > edge.len - nodeHalf * 0.35) {
      const choice = ai.nextChoice || this.chooseNext(v, endNode, edge, game);
      if (choice) {
        const turn = OVERTAKE && !ai.scripted ? turnOf(edge, ai.dir, choice) : null;
        ai.edge = choice.edge;
        ai.dir = choice.dir;
        ai.lane = Math.min(ai.lane, laneCount(choice.edge) - 1);
        if (turn) {
          // Si entra nella corsia che la svolta stessa indica: a destra quella
          // esterna, a sinistra quella interna. È la geometria a deciderlo.
          if (laneCount(choice.edge) > 1 && (turn === 'destra' || turn === 'sinistra')) ai.lane = turn === 'destra' ? 1 : 0;
          ai.laneF = ai.laneF === undefined || ai.lane !== Math.round(ai.laneF) ? ai.lane : Math.min(ai.laneF, laneCount(choice.edge) - 1);
          ai.lcAge = 0;
        }
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

    // Cedere il passo a una volante a sirena (§5.36): stato, e scostamento verso il
    // cordolo dove la corsia è una sola (sulle arterie ci si sposta di corsia, in
    // `laneLogic`).
    if (YIELD.on && !ai.scripted) {
      if (this.sirens.length) this.sirenWatch(v, ai, dt);
      else if (ai.yieldT > 0) ai.yieldT = Math.max(0, ai.yieldT - dt);
      const wantBias = ai.yieldT > 0 && laneCount(edge) === 1 ? YIELD.bias : 0;
      if (ai.bias || wantBias) {
        const step = YIELD.biasRate * dt;
        const cur = ai.bias || 0;
        ai.bias = Math.abs(wantBias - cur) <= step ? wantBias : cur + Math.sign(wantBias - cur) * step;
      }
    } else if (ai.bias || ai.yieldT) {
      ai.bias = 0;
      ai.yieldT = 0;
    }

    if (OVERTAKE && !ai.scripted) this.laneLogic(v, spec, dt, game, edge, endNode, nodeHalf);

    // Waypoint davanti al muso, sul centro della corsia (frazionaria se si sta
    // scivolando da una all'altra)
    const look = 34 + Math.abs(v.speed) * 0.34;
    let wp = this.wayPoint(ai, look);
    let heading = angleDiff(v.angle, Math.atan2(wp.y - v.y, wp.x - v.x));

    // Girato di traverso o spinto fuori strada: riaggancia la corsia e ricalcola.
    // Non si esce dalla funzione: il comando di gas va sempre aggiornato.
    if (Math.abs(heading) > 1.85 || Math.hypot(wp.x - v.x, wp.y - v.y) > 240) {
      if (this.reacquireLane(v)) {
        edge = ai.edge;
        endNode = graph.nodeById(ai.dir > 0 ? edge.b : edge.a);
        nodeHalf = (edge.axis === 'v' ? endNode.hWidth : endNode.vWidth) / 2;
        wp = this.wayPoint(ai, look);
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
    // Chi cede il passo rallenta: la volante deve avere il tempo di infilarsi.
    if (ai.yieldT > 0) target = Math.min(target, YIELD.slow);

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

    // Una volante a sirena in arrivo sull'incrocio (le volanti non guardano i
    // semafori): non si riparte verso di lei. La cortesia ha un tetto, o due
    // volanti in fila terrebbero fermo un incrocio per sempre.
    if (this.sirens.length && !waitingAtLight && stopDist < 120 && stopDist > -4 && !ai.scripted) {
      if ((ai.sirenHold || 0) < YIELD.nodeHold && this.sirenCrossing(v, endNode)) {
        ai.sirenHold = (ai.sirenHold || 0) + dt;
        target = stopDist < 22 ? 0 : Math.min(target, stopDist * 1.5);
        waitingAtLight = true;
      }
    } else if (ai.sirenHold > 0 && (stopDist > 130 || stopDist < -4 || !this.sirens.length)) {
      ai.sirenHold = 0;   // il tetto vale per un incrocio alla volta
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

    // Arrivata. Un'auto della storia non svanisce a destinazione e non ci passa
    // sopra: rallenta negli ultimi cento metri e si ferma dov'era diretta, che è
    // l'unico modo perché la scena dopo (una busta che scende, una donna che
    // ritira) succeda in un posto e non in mezzo alla strada.
    if (ai.arrive) {
      const dArr = dist(v.x, v.y, ai.arrive.x, ai.arrive.y);
      if (dArr < 160) target = Math.min(target, Math.max(0, (dArr - 24) * 1.1));
      if (dArr < 34) ai.arrived = true;
    }

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
    if (Math.abs(v.speed) < 12 && !waitingAtLight && !queued && !ai.arrived) {
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
    // Durante un cambio corsia si guarda anche quella di destinazione: la
    // carrozzeria sta a metà strada fra le due, e chi ha davanti può essere in
    // una qualunque. `leadGap`/`leadSpeed` servono a decidere se vale un sorpasso.
    const ai = v.ai;
    const slideD = ai.laneF !== undefined && ai.laneF !== ai.lane
      ? laneOffset(ai.edge, ai.lane) - laneOffset(ai.edge, ai.laneF) : 0;
    ai.leadGap = Infinity;
    ai.leadSpeed = 0;
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
      const lat = -dx * sin + dy * cos;
      if (Math.abs(lat) > side && !(slideD && Math.abs(lat - slideD) <= side)) continue;
      const gap = forward - (spec.len + ospec.len) * 0.5;
      // Si punta alla velocità di chi sta davanti, corretta dall'errore di
      // distanza. Ridurre invece la velocità *desiderata* in proporzione allo
      // spazio mancante (quello che si faceva prima) innesca le onde di
      // stop-and-go: chi frena troppo fa frenare di più chi ha dietro, e la coda
      // si ferma da sola senza che davanti ci sia niente.
      const lead = Math.max(0, o.vx * cos + o.vy * sin);
      if (gap < ai.leadGap && Math.abs(lat) <= side) { ai.leadGap = gap; ai.leadSpeed = lead; }
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
          game.emit('honk', v);
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
    const choice = ai.nextChoice || (ai.nextChoice = this.chooseNext(v, endNode, ai.edge, game));
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
