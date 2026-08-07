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
// 4. **Dentro un negozio la caccia non si ferma, si sposta sulla porta.** Il
//    ricercato resta congelato (la porta non è un nascondiglio, §5.8), ma le unità
//    continuano ad arrivare e si dispongono attorno all'uscita: `siege` è la sola
//    parte di questo file che gira mentre la città è ferma, e per farlo muove le
//    unità da sé (vedi lì il perché).
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

// Commissariati: entro questo raggio le unità nuove partono da lì invece che da un
// punto a caso dell'anello. Più largo di così e la volante ci mette mezzo minuto ad
// arrivare, più stretto e nell'inseguimento medio il commissariato non si usa mai.
const STATION_REACH = 1600;

// Equipaggio sbarcato che risale in macchina. `RECALL_FAR` è la distanza oltre la
// quale un giocatore in auto non lo si prende più a piedi; `RECALL_LOST` i secondi
// senza contatto dopo i quali si rinuncia comunque.
const RECALL_FAR = 750;
const RECALL_LOST = 5;
const RECALL_R = 260;    // chi è più lontano ha già preso un'altra strada
const BOARD_R = 30;
const RECALL_GIVEUP = 12;

// Motovedette (경비정): quante al massimo, e da che stella in su.
const MAX_BOATS = 2;
const MARINE_LEVEL = 3;

// Granate della SWAT. Sotto i 200 px si prenderebbe in pieno anche chi la tira,
// sopra i 430 non arriva; una ogni 9 s per agente, e mai due in volo insieme.
// `NADE_GAP` è la pausa che la squadra si prende dopo uno scoppio, e non è un
// doppione del tetto per agente: a cinque stelle in strada ci sono fino a sei
// uomini della SWAT, e con la sola regola "una in volo" ne arrivava una ogni 2,5 s
// (misurato) — che è esattamente la condanna senza uscita che si voleva evitare.
const NADE_MIN = 200;
const NADE_MAX = 430;

// Arresto. La divisa ammanetta invece di sparare in due situazioni sole: il
// giocatore è **a mani vuote o con una mazza** — sparare a chi non ha una bocca
// da fuoco non è quello che fa una pattuglia — oppure è quasi a terra, e allora
// il fermo è la strada corta. In tutti gli altri casi si spara come prima.
//
// Sopra le tre stelle non arresta più nessuno: a quel punto in strada ci sono
// speronamenti, chiodi e SWAT, e fermarsi ad ammanettare sarebbe un passo
// indietro nell'escalation. È anche l'unico modo di rendere l'arresto una scelta
// del giocatore: mettere via la pistola con una stella è una resa, con cinque no.
const BUST_R = 46;
const BUST_TIME = 1.4;
const BUST_HP = 25;
const ARREST_LEVEL = 3;
const NADE_CD = 9;
const NADE_GAP = 5;

// Chiodi: quanti veicoli AI si controllano per frame, e fin dove. Uno alla volta
// sarebbe troppo rado (a 250 px/s una striscia larga 22 px si attraversa in 0,09 s),
// tutti sarebbero un test per veicolo per frame per una cosa che capita due volte
// a partita. Si guarda una fetta a rotazione, e solo dove il giocatore può vedere.
const SPIKE_WATCH = 700;
const SPIKE_SLICE = 6;

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
    this.boats = [];
    this.blocks = [];
    this.spikes = [];
    this.chopper = null;
    this.chopperCd = 0;
    this.spotted = false;
    this.spawnT = 0;
    this.blockT = 0;
    this.boatT = 0;
    this.offT = 0;      // da quanto il giocatore è fuori dalla portata della strada
    this.nade = null;   // la granata della SWAT in volo: una per tutta la squadra
    this.nadeCd = 0;
    this.siegeDoor = null;
    this.siegeEdge = null;
    // Arresto in corso: `arresting` è la condizione del frame (la legge anche
    // `copBehavior`), `bustT` il cronometro con cui l'agente ti tiene fermo.
    this.arresting = false;
    this.bustT = 0;
    this._bustCd = 0;
    this._spikeI = 0;
    this._boarded = [];
    this.tmp = {};
  }

  get tier() {
    return TIERS[this._level] || TIERS[0];
  }

  /**
   * Punto verso cui lavora la polizia. È il giocatore, tranne mentre lui è dentro
   * un edificio: lì le sue coordinate sono quelle della pianta (200-470 px) e in
   * città cadono nell'angolo nord-ovest della mappa. Chiunque legga `player.x/y`
   * per decidere *dove andare* deve passare di qui.
   */
  focus(game) {
    return this.siegeDoor || game.player;
  }

  // --- ciclo -----------------------------------------------------------------
  update(dt, game) {
    // Si è appena usciti da una porta assediata: le volanti vanno rimesse in
    // carreggiata prima che `traffic.update` torni a integrarne la fisica.
    if (this.siegeDoor) this.endSiege(game);
    this._level = game.wanted.level;
    const tier = this.tier;
    this.nadeCd = Math.max(0, this.nadeCd - dt);
    this.prune(game);

    if (this._level > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 0.9;
        this.reinforce(game, tier);
      }
      this.manageObstacles(dt, game, tier);
    } else if (this.cars.length || this.cops.length || this.blocks.length || this.boats.length) {
      this.standDown(game);
    }

    for (const v of this.cars) this.driveCar(v, dt, game);
    this.updateMarine(dt, game, tier);
    this.updateChopper(dt, game, tier);
    this.updateSpikes(dt, game);
    this.updateArrest(dt, game);
    this.spotted = this.computeSpotted(game);
  }

  /**
   * Arresto. Non è un'unità nuova né uno stato nuovo: è la stessa divisa che, in
   * due situazioni sole, smette di sparare e chiude la distanza. Il cronometro
   * sta qui e non sull'agente perché la condizione è del giocatore — che si
   * arrenda o no non dipende da *quale* pattuglia gli è addosso.
   *
   * Si spezza in quattro modi, e sono tutti azioni: allontanarsi, salire in
   * macchina, tirare fuori una bocca da fuoco, stendere l'agente. È quello che
   * rende il fermo una scelta e non un incidente.
   */
  updateArrest(dt, game) {
    const pl = game.player;
    const w = game.wanted;
    this._bustCd = Math.max(0, this._bustCd - dt);
    this.arresting = w.level > 0 && w.level <= ARREST_LEVEL && pl.onFoot && !pl.dying
      && !game.indoors && (WEAPONS[pl.weapon].melee || pl.hp <= BUST_HP);
    if (!this.arresting) {
      this.bustT = 0;
      return;
    }
    const near = this.cops.some(
      (p) => !p.dead && p.kind === 'cop' && dist(p.x, p.y, pl.x, pl.y) < BUST_R
    );
    if (!near) {
      // Si perde il contatto più in fretta di quanto lo si guadagni: due passi
      // indietro devono bastare a togliersi dalle mani di un agente.
      this.bustT = Math.max(0, this.bustT - dt * 2);
      return;
    }
    if (this.bustT === 0 && this._bustCd === 0) {
      this._bustCd = 6;
      game.hud.toast('«Fermo! Mani in alto»', 2);
      game.audio?.ui('deny');
    }
    this.bustT += dt;
    if (this.bustT >= BUST_TIME) {
      this.bustT = 0;
      game.bustPlayer();
    }
  }

  /** Quanto manca alle manette, in [0,1]. La disegna l'HUD. */
  get bustProgress() {
    return this.arresting ? Math.min(1, this.bustT / BUST_TIME) : 0;
  }

  /** Unità perse per strada: morti, despawnate dallo streaming, o troppo lontane. */
  prune(game) {
    const f = this.focus(game);
    // Chi è risalito in macchina il frame scorso (vedi `boardCop`).
    if (this._boarded.length) {
      const list = game.pedSystem.peds;
      for (const p of this._boarded) {
        const i = list.indexOf(p);
        if (i >= 0) list.splice(i, 1);
      }
      this._boarded.length = 0;
    }
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const p = this.cops[i];
      if (p.dead || p.gone || dist(p.x, p.y, f.x, f.y) > 2200) {
        p.board = null;
        this.cops.splice(i, 1);
      }
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const v = this.cars[i];
      const far = dist(v.x, v.y, f.x, f.y) > 2600;
      if (v.driver !== 'cop' || (v.dead && v.deadT > 18) || far) {
        this.dropVehicle(v, game, !v.dead && far);
        this.cars.splice(i, 1);
      }
    }
    for (let i = this.boats.length - 1; i >= 0; i--) {
      const v = this.boats[i];
      const far = dist(v.x, v.y, f.x, f.y) > 3000;
      if (v.driver !== 'cop' || (v.dead && v.deadT > 18) || far) {
        this.dropVehicle(v, game, false);
        this.boats.splice(i, 1);
      }
    }
    // La granata in volo è una sola per tutta la squadra: finché non è scoppiata
    // (o non è sparita dietro una porta) nessun altro ne tira una, e dopo lo
    // scoppio la squadra si prende `NADE_GAP` secondi di solo piombo.
    if (this.nade && !game.projectiles.items.includes(this.nade)) {
      this.nade = null;
      this.nadeCd = NADE_GAP;
    }
  }

  // --- assedio della porta ---------------------------------------------------
  /**
   * Gira **al posto di** `update` mentre il giocatore è dentro un negozio, ed è
   * l'unico pezzo di città che continua a muoversi. Tre cose la rendono diversa
   * dal ciclo normale, e sono tutte obbligate:
   *
   * - **Il riferimento è la porta**, non il giocatore (vedi `focus`).
   * - **Le unità le muove questo metodo.** Dentro un edificio `traffic.update` non
   *   gira (nessuno integra la fisica delle volanti) e `game.peds` è stato
   *   scambiato con la gente del piano (nessuno chiama `updatePed` sugli agenti):
   *   senza questo, arriverebbero rinforzi che restano immobili dove sono nati.
   *   Lo steering è elementare — punto e velocità, nessuna collisione, nessun
   *   grafo — perché il giocatore non sta guardando e la città *non deve* tornare
   *   a girare per il minuto che passa a comprare munizioni.
   * - **`outsideView` non vuol dire niente**: la camera inquadra la stanza, quindi
   *   qualunque punto della città è "fuori vista". Il criterio diventa la distanza
   *   dalla porta, e sta in `spawnCar`/`spawnFootCop`.
   *
   * Il ricercato invece resta congelato: `wanted.update` non gira nemmeno qui,
   * altrimenti la porta diventerebbe il nascondiglio che §5.8 non vuole.
   */
  siege(dt, game) {
    const shop = game.shops.active && game.shops.active.shop;
    if (!shop) return;
    if (this.siegeDoor !== shop) {
      this.siegeDoor = shop;
      this.planSiege(shop);
    }
    this._level = game.wanted.level;
    const tier = this.tier;
    if (this._level <= 0) {
      if (this.cars.length || this.cops.length || this.blocks.length || this.boats.length) {
        this.standDown(game);
      }
      return;
    }

    this.prune(game);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      // Più lento del ciclo normale: da fuori non si vede niente, e riempire la
      // strada di divise mentre compri sarebbe una punizione per aver aperto un menu.
      this.spawnT = 1.4;
      this.reinforce(game, tier);
    }
    for (const p of this.cops) this.siegeCop(p, dt, shop);
    for (let i = 0; i < this.cars.length; i++) this.siegeCar(this.cars[i], i, dt, shop);
    this.updateChopper(dt, game, tier);
  }

  /** La strada davanti alla porta: è lì che si mettono le volanti. */
  planSiege(shop) {
    const near = this.city.graph.edgesNear(shop.x, shop.y, 620);
    let best = null;
    let bestD = Infinity;
    for (const e of near) {
      const p = pointSegment(shop.x, shop.y, e.ax, e.ay, e.bx, e.by);
      if (p.dist < bestD) { bestD = p.dist; best = { edge: e, t: p.t }; }
    }
    this.siegeEdge = best;
  }

  siegeCop(p, dt, shop) {
    if (p.siegeA === undefined) {
      // Attorno alla porta ma dal lato della strada: `shop.nx/ny` è la normale
      // uscente della vetrina, e un agente piazzato dentro il palazzo non lo
      // vedrebbe nessuno. Fra 60 e 220 px: più vicino si esce addosso a uno, più
      // lontano non si legge come un'attesa.
      p.siegeA = Math.atan2(shop.ny, shop.nx) + (Math.random() - 0.5) * 2.6;
      p.siegeR = 60 + Math.random() * 160;
    }
    const tx = shop.x + Math.cos(p.siegeA) * p.siegeR;
    const ty = shop.y + Math.sin(p.siegeA) * p.siegeR;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) {
      const sp = Math.min(p.baseSpeed * 1.7, d * 3);
      p.x += (dx / d) * sp * dt;
      p.y += (dy / d) * sp * dt;
      p.animT += sp * dt * 0.2;
    }
    p.vx = 0;
    p.vy = 0;
    p.angle = Math.atan2(shop.y - p.y, shop.x - p.x);
  }

  siegeCar(v, i, dt, shop) {
    const se = this.siegeEdge;
    let tx;
    let ty;
    let ta;
    if (se) {
      // In fila sulla carreggiata, a cavallo della porta e nei due sensi: uscire e
      // trovarne una di traverso sul marciapiede sarebbe la stessa scena, ma sbagliata.
      const e = se.edge;
      const dir = i % 2 ? -1 : 1;
      const s0 = dir > 0 ? se.t * e.len : (1 - se.t) * e.len;
      const pt = lanePoint(e, dir, 0, clamp(s0 + 52 + (i >> 1) * 78, 14, e.len - 14), this.tmp);
      tx = pt.x; ty = pt.y; ta = pt.angle;
    } else {
      tx = shop.x + shop.nx * 150;
      ty = shop.y + shop.ny * 150;
      ta = Math.atan2(-shop.ny, -shop.nx);
    }
    const dx = tx - v.x;
    const dy = ty - v.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) {
      const sp = Math.min(210, d * 2.2);
      v.x += (dx / d) * sp * dt;
      v.y += (dy / d) * sp * dt;
    }
    v.angle = d > 44 ? Math.atan2(dy, dx) : ta;
    // La fisica non gira: azzerare velocità e comandi è quello che impedisce alla
    // volante di ripartire con lo slancio dell'assedio quando la città riparte.
    v.vx = 0; v.vy = 0; v.speed = 0; v.slip = 0;
    v.throttle = 0; v.steer = 0; v.handbrake = true;
  }

  /** Si torna in strada: le volanti si riagganciano alla corsia su cui sono ferme. */
  endSiege(game) {
    this.siegeDoor = null;
    this.siegeEdge = null;
    for (const v of this.cars) {
      v.vx = 0; v.vy = 0; v.speed = 0;
      v.copAi.edge = null;
      this.snapToRoad(v);
      v.copAi.jamT = 0;
      v.copAi.recoverT = 0;
    }
    for (const p of this.cops) p.siegeA = undefined;
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
    this.arresting = false;
    this.bustT = 0;
    for (const b of this.blocks) this.removeBlock(b, game);
    this.blocks.length = 0;
    this.spikes.length = 0;
    for (const v of this.cars) this.dropVehicle(v, game, !hard);
    this.cars.length = 0;
    // Le motovedette spariscono sempre: una lasciata alla deriva in mezzo al Han
    // non se la riprende nessuno e resta lì per tutta la partita.
    for (const v of this.boats) this.dropVehicle(v, game, false);
    this.boats.length = 0;
    for (const p of this.cops) {
      p.state = 'walk';
      p.cop = false;
      p.armed = false;
      p.board = null;
      p.siegeA = undefined;
      if (hard) p.gone = true;
    }
    this.cops.length = 0;
    if (this.chopper) this.chopper = null;
    this.chopperCd = hard ? 0 : 25;
    this.offT = 0;
    this.nade = null;
    this.nadeCd = 0;
  }

  /**
   * Toglie una volante dal controllo della polizia. Se `leave` è vero resta in
   * strada come relitto/auto abbandonata, altrimenti la si rimuove del tutto.
   */
  dropVehicle(v, game, leave = true) {
    v.siren = false;
    v.copUnit = false;
    // `deployed` va spento con l'unità: chi era stato richiamato a bordo
    // continuerebbe a camminare verso una macchina che non è più di nessuno.
    v.recall = false;
    v.deployed = false;
    for (const p of this.cops) if (p.board === v) p.board = null;
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
    const j = this.boats.indexOf(v);
    if (j >= 0) this.boats.splice(j, 1);
    v.siren = false;
    v.copUnit = false;
    v.recall = false;
    v.deployed = false;
    for (const p of this.cops) if (p.board === v) p.board = null;
    // Da una motovedetta l'equipaggio non "sbarca": finisce a mare, e due agenti
    // che camminano sull'acqua sarebbero peggio di due agenti che spariscono.
    if (v.crew > 0 && !VEHICLE_TYPES[v.kind].marine) this.deployCrew(v, game, true);
    else v.crew = 0;
  }

  // --- spawn -----------------------------------------------------------------
  /** Commissariato più vicino a un punto, se la città ne ha uno. */
  nearestStation(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const s of this.city.stations || []) {
      const d = dist(s.x, s.y, x, y);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best && bestD < STATION_REACH ? best : null;
  }

  /**
   * Una volante in più. Se c'è un commissariato entro `STATION_REACH` parte da lì:
   * è quello che rende credibile *da dove* arriva la polizia, invece di farla
   * comparire su un arco a caso dell'anello attorno al giocatore. Se attorno al
   * commissariato non c'è un punto buono (troppo addosso, o in campo visivo) si
   * ricade sull'anello di prima — che resta il comportamento in campagna, dove
   * commissariati non ce ne sono.
   */
  spawnCar(game, kind, tier) {
    const f = this.focus(game);
    const st = this.nearestStation(f.x, f.y);
    if (st) {
      const v = this.trySpawnCar(game, kind, tier, this.city.graph.edgesNear(st.x, st.y, 460));
      if (v) return v;
    }
    return this.trySpawnCar(game, kind, tier, this.city.graph.edgesNear(f.x, f.y, 1500));
  }

  trySpawnCar(game, kind, tier, near) {
    const rng = this.rng;
    const f = this.focus(game);
    if (!near.length) return null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const edge = rng.pick(near);
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = rng.int(0, laneCount(edge) - 1);
      const s = rng.range(20, Math.max(24, edge.len - 20));
      const pt = lanePoint(edge, dir, lane, s, this.tmp);
      const d = dist(pt.x, pt.y, f.x, f.y);
      // Non troppo addosso (comparirebbe a vista) né troppo lontana (non arriva mai).
      if (d < 520 || d > 1500) continue;
      // Sotto assedio la camera inquadra una stanza: `outsideView` direbbe di sì
      // ovunque, e la distanza dalla porta è l'unico criterio che resta.
      if (!this.siegeDoor && !outsideView(game, pt.x, pt.y, 80)) continue;
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
    // Arrivano da dove ti hanno visto l'ultima volta, non da dove sei adesso —
    // e sotto assedio "l'ultima volta" è la porta in cui sei sparito.
    const f = this.focus(game);
    const from = this.siegeDoor || { x: w.lastX, y: w.lastY };
    const near = graph.edgesNear(from.x, from.y, 900);
    if (!near.length) return null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const edge = rng.pick(near);
      const s = rng.range(20, Math.max(24, edge.len - 20));
      const side = rng.chance(0.5) ? 1 : -1;
      const off = edge.width / 2 + 16;
      const x = edge.ax + edge.dx * s - edge.dy * off * side;
      const y = edge.ay + edge.dy * s + edge.dx * off * side;
      const d = dist(x, y, f.x, f.y);
      if (d < 380 || d > 1100) continue;
      if (!this.siegeDoor && !outsideView(game, x, y, 50)) continue;
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
    p.nadeT = this.rng.range(3, NADE_CD);
    p.board = null;
    // Mentre il giocatore è dentro un negozio `game.peds` è la gente del piano
    // (§5.8): un agente spinto lì comparirebbe fra gli scaffali del 편의점.
    (game.indoors ? game.pedSystem.peds : game.peds).push(p);
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
    p.nadeT -= dt;

    // Richiamato a bordo: torna alla sua volante e ci sale. Ha la precedenza su
    // tutto il resto, altrimenti bastava un colpo sparato a farlo tornare indietro.
    if (p.board) {
      const v = p.board;
      if (v.dead || !v.deployed || w.level === 0) p.board = null;
      else if (dist(p.x, p.y, v.x, v.y) < BOARD_R) {
        this.boardCop(p, v, game);
        return { x: p.x, y: p.y, speed: 0 };
      } else {
        return { x: v.x, y: v.y, speed: p.baseSpeed * 1.9 };
      }
    }

    if (w.level === 0 || pl.dying) {
      // Cessato allarme: si rimette a camminare per i fatti suoi.
      return { x: p.x + Math.cos(p.angle) * 70, y: p.y + Math.sin(p.angle) * 70, speed: p.baseSpeed * 0.7 };
    }

    const spec = WEAPONS[p.copWeapon] || WEAPONS.pistol;
    const d = dist(p.x, p.y, pl.x, pl.y);
    const los = d < SEE_FOOT * this.visionScale(game) && hasLineOfSight(game, p.x, p.y, pl.x, pl.y);

    if (los) {
      // Fermo invece che fuoco: chiude la distanza e basta. Vale solo per la
      // divisa — la SWAT non ammanetta nessuno (vedi `updateArrest`).
      if (this.arresting && p.kind === 'cop') {
        p.angle = Math.atan2(pl.y - p.y, pl.x - p.x);
        return { x: pl.x, y: pl.y, speed: p.baseSpeed * (d > 90 ? 1.9 : 1.15) };
      }
      const aim = Math.atan2(pl.y - p.y, pl.x - p.x);
      // Granata della SWAT: è la risposta di livello 5 a un giocatore che si è
      // imboscato dietro un riparo e non si muove più. Vuole distanza (sotto i
      // 200 px salterebbe in aria anche chi la tira) e **una sola in volo per
      // tutta la squadra**: due insieme sono una condanna senza uscita.
      if (p.kind === 'swat' && this._level >= 5 && !this.nade && this.nadeCd <= 0 &&
          p.nadeT <= 0 && d > NADE_MIN && d < NADE_MAX && !pl.dying) {
        p.nadeT = NADE_CD + Math.random() * 2;
        p.angle = aim;
        this.nade = game.projectiles.throwItem(
          game, p, WEAPONS.grenade,
          p.x + Math.cos(aim) * 14, p.y + Math.sin(aim) * 14, aim, d
        );
        game.hud.toast('Granata in arrivo', 1.6);
        game.audio?.throwItem(p.x, p.y);
        return { x: p.x, y: p.y, speed: 0 };
      }
      if (d < COP_FIRE_RANGE && p.fireT <= 0) {
        p.fireT = spec.rate * (spec.auto ? 6 : 2.6) + Math.random() * 0.5;
        p.angle = aim;
        shoot(game, p, spec, p.x + Math.cos(aim) * 13, p.y + Math.sin(aim) * 13, aim, { spreadMul: 2.6 });
      }
      // Distanza di ingaggio: se sei troppo vicino arretrano, se sei lontano avanzano.
      // La SWAT la tiene più larga di un agente in divisa: col fucile d'assalto ci
      // arriva lo stesso, e senza quello stacco la finestra della granata non
      // esisterebbe (misurato: parcheggiati fra 120 e 240 px ne tiravano una ogni
      // 40 s, perché chi era pronto era sempre troppo vicino).
      const swat = p.kind === 'swat';
      const push = d < (swat ? 190 : 120) ? -1 : d > (swat ? 320 : 240) ? 1 : 0;
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

    // Sbarcato l'equipaggio la volante resta ferma coi lampeggianti accesi: una
    // volante *vuota* che continua a speronare non si spiega (§4). Non è però più
    // per sempre — vedi `manageDeployed`.
    if (v.deployed) {
      v.throttle = 0;
      v.steer = 0;
      v.handbrake = true;
      this.manageDeployed(v, dt, game);
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
    const los = d < SEE_CAR * this.visionScale(game) && hasLineOfSight(game, v.x, v.y, pl.x, pl.y);
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

  /**
   * Equipaggio che risale in macchina. Due sole ragioni per richiamarlo: il
   * giocatore è risalito in auto e se n'è andato (a piedi non lo prendi più), o
   * l'hanno perso di vista da qualche secondo. Il richiamo non è istantaneo — gli
   * agenti tornano a piedi alla loro volante, e chi è troppo lontano non torna.
   *
   * **Se non risale nessuno la volante non riparte.** Una volante vuota che ti
   * sperona è la trappola già pagata in §4, e riaprirla per far ripartire prima
   * l'inseguimento sarebbe un pessimo affare.
   */
  manageDeployed(v, dt, game) {
    const ai = v.copAi;
    const pl = game.player;
    if (game.wanted.level === 0) return;

    if (!v.recall) {
      ai.lostT = this.spotted ? 0 : (ai.lostT || 0) + dt;
      const away = !pl.onFoot && dist(v.x, v.y, pl.x, pl.y) > RECALL_FAR;
      if (!away && ai.lostT < RECALL_LOST) return;
      const crew = [];
      for (const p of this.cops) {
        if (p.dead || p.board || dist(p.x, p.y, v.x, v.y) > RECALL_R) continue;
        crew.push(p);
        if (crew.length >= (v.kind === 'swat' ? 3 : 2)) break;
      }
      // Nessuno abbastanza vicino: la volante resta dov'è e ci si riprova dopo.
      if (!crew.length) { ai.lostT = 0; return; }
      for (const p of crew) p.board = v;
      v.recall = true;
      ai.recallT = 0;
      return;
    }

    ai.recallT += dt;
    let waiting = false;
    for (const p of this.cops) if (p.board === v && !p.dead) { waiting = true; break; }
    if (waiting && ai.recallT < RECALL_GIVEUP) return;
    for (const p of this.cops) if (p.board === v) p.board = null;
    v.recall = false;
    ai.lostT = 0;
    if (v.crew > 0) {
      v.deployed = false;
      v.handbrake = false;
      ai.jamT = 0;
      ai.edge = null;
      this.snapToRoad(v);
    }
  }

  /** Un agente sale a bordo: sparisce dalla strada e torna equipaggio. */
  boardCop(p, v, game) {
    v.crew++;
    p.board = null;
    p.gone = true;   // chi tiene un riferimento (posti di blocco, raggi) lo scarta
    const i = this.cops.indexOf(p);
    if (i >= 0) this.cops.splice(i, 1);
    // Toglierlo da `peds` adesso vorrebbe dire tagliare l'array su cui
    // `pedSystem.update` sta iterando proprio in questo istante: si rimanda al
    // `prune` del frame dopo, e per un frame lo si vede fermo alla portiera.
    this._boarded.push(p);
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

  /**
   * Chi passa sui chiodi buca. Il mezzo del giocatore si controlla ogni frame; il
   * traffico civile **a rotazione**, una fetta per frame e solo nei paraggi (un
   * test per veicolo per frame costerebbe più di quanto rende, e una gomma a terra
   * fuori campo non la guarda nessuno). Con un campionamento così rado il centro
   * del veicolo salterebbe la striscia una volta su due: si guardano i due assi
   * oltre al centro, che è poi dove stanno davvero le gomme.
   */
  updateSpikes(dt, game) {
    if (!this.spikes.length) return;
    const pl = game.player;
    if (pl.vehicle) this.spikeTest(pl.vehicle, game, true);

    const list = game.vehicles;
    if (!list.length) return;
    for (let k = 0; k < SPIKE_SLICE; k++) {
      this._spikeI = (this._spikeI + 1) % list.length;
      const o = list[this._spikeI];
      if (!o || o.driver !== 'ai' || o.dead || o.flatTires) continue;
      if (dist(o.x, o.y, pl.x, pl.y) > SPIKE_WATCH) continue;
      this.spikeTest(o, game, false);
    }
  }

  spikeTest(v, game, isPlayer) {
    if (v.flatTires || Math.abs(v.speed) < 20) return;
    const spec = VEHICLE_TYPES[v.kind];
    if (spec.marine || spec.air) return;
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    const half = spec.len * 0.4;
    for (const s of this.spikes) {
      let on = false;
      for (const at of [half, 0, -half]) {
        const x = v.x + cos * at;
        const y = v.y + sin * at;
        if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) { on = true; break; }
      }
      if (!on) continue;
      v.flatTires = true;
      v.flatPull = (Math.random() - 0.5) * 0.5;
      game.fx.addSparks(v.x, v.y, -v.vx, -v.vy, isPlayer ? 12 : 6);
      if (isPlayer) {
        game.camera.addShake(7);
        game.hud.toast('Gomme a terra', 2.6);
      }
      break;
    }
  }

  // --- acqua e cielo ---------------------------------------------------------
  /**
   * Il giocatore è su qualcosa che la strada non raggiunge? In volo o in barca
   * volanti, blocchi e chiodi non contano niente: è la sola ragione per cui
   * l'elicottero si alza già a tre stelle e per cui esistono le motovedette.
   */
  offRoad(game) {
    const pl = game.player;
    const v = pl.vehicle;
    if (v) {
      const spec = VEHICLE_TYPES[v.kind];
      return !!(spec.air || spec.marine);
    }
    return this.city.isWater(pl.x, pl.y);
  }

  /**
   * Motovedette (경비정). Dalle tre stelle in su e solo se il giocatore è in acqua
   * o su una barca: in mare non c'è grafo da seguire, quindi l'inseguimento è
   * diretto e la fisica è già quella delle imbarcazioni (`vehicle.resolveMarine`).
   * Tetto duro a due — un branco di scafi in un fiume largo 300 px non lascia
   * scampo, ed è la stessa ragione per cui le volanti sono tre.
   */
  updateMarine(dt, game, tier) {
    const want = this._level >= MARINE_LEVEL && this.offRoad(game)
      ? Math.min(MAX_BOATS, this._level - MARINE_LEVEL + 1)
      : 0;
    if (!want) {
      if (this.boats.length) {
        for (const v of this.boats) this.dropVehicle(v, game, false);
        this.boats.length = 0;
      }
      return;
    }
    this.boatT -= dt;
    if (this.boats.length < want && this.boatT <= 0) {
      this.boatT = 4;
      this.spawnBoat(game, tier);
    }
    for (const v of this.boats) this.driveBoat(v, dt, game);
  }

  spawnBoat(game, tier) {
    const pl = game.player;
    let pier = null;
    let bestD = Infinity;
    for (const p of this.city.piers) {
      const d = dist(p.x + p.w / 2, p.y + p.h / 2, pl.x, pl.y);
      if (d < bestD) { bestD = d; pier = p; }
    }
    if (!pier || bestD > 3200) return null;
    // Accanto alla testata del molo, ma **in acqua**: un mezzo marino nato sul
    // cemento resta lì a farsi respingere finché non gira il muso (§4).
    const cx = pier.x + pier.w / 2;
    const cy = pier.y + pier.h / 2;
    const reach = Math.max(pier.w, pier.h) * 0.6 + 70;
    let spot = null;
    let spotD = Infinity;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const x = cx + Math.cos(a) * reach;
      const y = cy + Math.sin(a) * reach;
      if (!this.city.isWater(x, y)) continue;
      const d = dist(x, y, pl.x, pl.y);
      if (d < 300 || d > spotD) continue;
      spotD = d;
      spot = { x, y };
    }
    if (!spot) return null;

    const v = createVehicle('patrol', spot.x, spot.y, Math.atan2(pl.y - spot.y, pl.x - spot.x), 0);
    v.driver = 'cop';
    v.copUnit = true;
    v.siren = true;
    v.protect = true;
    v.lightsOn = game.isNight;
    v.crew = 2;
    v.copWeapon = tier.weapon || 'pistol';
    v.copAi = { edge: null, dir: 1, lane: 0, s: 0, jamT: 0, recoverT: 0, recoverSteer: 1, fireT: 1.2 };
    game.vehicles.push(v);
    this.boats.push(v);
    game.hud.toast('경비정 — motovedetta in arrivo', 2.6);
    return v;
  }

  /**
   * Guida di una motovedetta: inseguimento diretto, niente grafo. Non sperona —
   * uno scafo che ti affonda in mezzo al Han è una morte senza appello, e il
   * mestiere della motovedetta è tenerti sotto tiro finché non tocchi terra.
   */
  driveBoat(v, dt, game) {
    if (v.dead || v.driver !== 'cop') return;
    const ai = v.copAi;
    const pl = game.player;
    ai.fireT -= dt;

    // Anti-incastro, come per le volanti: una motovedetta che si pianta contro un
    // molo ci resta per sempre — in acqua non passa nessuno a spostarla.
    if (ai.recoverT > 0) {
      ai.recoverT -= dt;
      v.throttle = -0.8;
      v.steer = ai.recoverSteer;
      v.handbrake = false;
      return;
    }

    const d = dist(v.x, v.y, pl.x, pl.y);
    const aim = Math.atan2(pl.y - v.y, pl.x - v.x);
    v.steer = clamp(angleDiff(v.angle, aim) * 2.2, -1, 1);
    v.throttle = d > 300 ? 1 : d > 170 ? 0.3 : -0.35;
    v.handbrake = false;

    if (Math.abs(v.speed) < 14 && d > 190) {
      ai.jamT += dt;
      if (ai.jamT > 1.8) {
        ai.jamT = 0;
        ai.recoverT = 1.1;
        ai.recoverSteer = this.rng.chance(0.5) ? 1 : -1;
      }
    } else {
      ai.jamT = 0;
    }

    if (v.crew > 0 && d < COP_FIRE_RANGE && ai.fireT <= 0 && !pl.dying) {
      ai.fireT = 0.9 + Math.random() * 0.8;
      const spec = WEAPONS[v.copWeapon] || WEAPONS.pistol;
      shoot(game, v, spec, v.x + Math.cos(aim) * 28, v.y + Math.sin(aim) * 28, aim, {
        spreadMul: 3.4,
        ignoreVehicle: v,
      });
    }
  }

  // --- elicottero ------------------------------------------------------------
  updateChopper(dt, game, tier) {
    const c = this.chopper;
    // In volo o in barca l'elicottero è l'unica unità che ti segue davvero: da
    // roba di cinque stelle diventa roba di tre. La memoria di qualche secondo
    // (`offT`) serve a non farlo sparire ogni volta che una barca tocca la riva.
    this.offT = this.offRoad(game) ? 6 : Math.max(0, this.offT - dt);
    const wanted = tier.chopper || (this._level >= MARINE_LEVEL && this.offT > 0);
    if (!wanted) {
      if (c) this.chopper = null;
      return;
    }
    // Sotto assedio la porta è l'unico riferimento valido: `player.x/y` è la pianta.
    const f = this.focus(game);
    if (!c) {
      this.chopperCd -= dt;
      if (this.chopperCd > 0) return;
      this.chopper = {
        x: f.x - 900, y: f.y - 700, z: CHOPPER_Z, angle: 0,
        beamX: f.x, beamY: f.y, lit: false,
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
    const tx = f.x + Math.cos(c.t * 0.42) * orbit;
    const ty = f.y + Math.sin(c.t * 0.42) * orbit;
    c.x = damp(c.x, tx, 0.85, dt);
    c.y = damp(c.y, ty, 0.85, dt);
    const heading = Math.atan2(ty - c.y, tx - c.x);
    if (Math.hypot(tx - c.x, ty - c.y) > 24) c.angle = heading;

    // Il riflettore insegue più lento del velivolo: si può uscire dal cono. Sotto
    // assedio non c'è niente da illuminare: il giocatore è sotto un tetto.
    c.beamX = damp(c.beamX, f.x, 0.62, dt);
    c.beamY = damp(c.beamY, f.y, 0.62, dt);
    c.lit = !this.siegeDoor && !pl.dying && dist(pl.x, pl.y, c.beamX, c.beamY) < BEAM_R;

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
    const ox = c.x + (c.x - cam.projX) * (c.z / PROJ);
    const oy = c.y + (c.y - cam.projY) * (c.z / PROJ);
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
    game.fx.addExplosion(c.x + (c.x - cam.projX) * (c.z / PROJ), c.y + (c.y - cam.projY) * (c.z / PROJ));
    game.fx.addExplosion(c.x, c.y);
    game.camera.addShake(22);
    game.audio?.explosion(c.x, c.y, 1.3);
    game.hud.toast('Elicottero abbattuto', 3);
    game.stats.choppers = (game.stats.choppers || 0) + 1;
    this.chopper = null;
    this.chopperCd = 40;
    game.wanted.report('copKill', game);
  }

  // --- avvistamento ----------------------------------------------------------
  /**
   * Quanto lontano vede una pattuglia adesso. Al buio e sotto l'acqua si vede
   * meno, ed è quello che dà un senso di gioco al ciclo giorno-notte: seminare
   * una caccia di notte con la pioggia è davvero più facile, non solo più bello.
   * Il riflettore dell'elicottero però resta assoluto — è fatto apposta per
   * vedere di notte, e togliergli quel privilegio lo renderebbe un ornamento.
   */
  visionScale(game) {
    const dc = game.dayCycle;
    if (!dc) return 1;
    return (1 - dc.light.lamps * 0.26) * (1 - dc.rain * 0.2);
  }

  computeSpotted(game) {
    const pl = game.player;
    if (pl.dying) return false;
    if (this.chopper && this.chopper.lit) return true;
    const k = this.visionScale(game);
    const foot = SEE_FOOT * k;
    const car = SEE_CAR * k;
    for (const p of this.cops) {
      if (p.dead) continue;
      if (dist(p.x, p.y, pl.x, pl.y) > foot) continue;
      if (hasLineOfSight(game, p.x, p.y, pl.x, pl.y)) return true;
    }
    for (const v of this.cars) {
      if (v.dead) continue;
      if (dist(v.x, v.y, pl.x, pl.y) > car) continue;
      if (hasLineOfSight(game, v.x, v.y, pl.x, pl.y)) return true;
    }
    // Anche la motovedetta ha due occhi: senza questa riga il ricercato si
    // raffredda mentre te la ritrovi a cinquanta metri di poppa.
    for (const v of this.boats) {
      if (v.dead) continue;
      if (dist(v.x, v.y, pl.x, pl.y) > car) continue;
      if (hasLineOfSight(game, v.x, v.y, pl.x, pl.y)) return true;
    }
    return false;
  }

  /** Numero di unità in campo, per il pannello di debug. */
  get unitCount() {
    return this.cops.length + this.cars.length + this.boats.length + (this.chopper ? 1 : 0);
  }
}
