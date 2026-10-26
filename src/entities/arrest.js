// L'arresto in scena (§5.35): ti ammanettano, ti portano a una volante, ti
// caricano e la volante parte. Prima la barra del fermo arrivava in fondo e il
// giocatore si ritrovava in cella; adesso quel momento si vede.
//
// Scelte che spiegano il file:
//
// 1. **È in-world.** Il mondo e il traffico continuano a girare (modalità
//    `arrest` in `core/modes.js`: `worldRuns` sì, `playerRuns` no). Non c'è uno
//    stacco nero, c'è una dissolvenza *alla fine*.
// 2. **Non è un'entrata in veicolo.** `player.enterVehicle` conta come un furto
//    ed emette `onEnterVehicle`; qui il giocatore resta `onFoot` con
//    `vehicle === null` (radio e tachimetro non si accendono) e semplicemente
//    non si disegna, come l'agente che sale (`police.boardCop`). Dentro la
//    volante le sue coordinate seguono quelle dell'auto: è così che la camera
//    la insegue senza un ramo in `cameraTarget`.
// 3. **Si chiude sempre in `game.bustPlayer()`**, che resta il punto unico di
//    chiusura (cauzione, commissariato, `wanted.reset`, evento `busted`,
//    autosave). Qui dentro non si scrive niente di quello che fa lui.
// 4. **Ogni anomalia è un arresto frettoloso, non un blocco.** Agente morto,
//    volante distrutta o sparita, un timeout, `ESC`: si chiude con
//    `bustPlayer` e basta. L'unica eccezione è il giocatore che muore mentre è
//    ammanettato: lì la sequenza si annulla e comanda la morte.
import { VEHICLE_TYPES } from '../render/sprites.js';
import { hasLineOfSight } from './weapons.js';
import { approachAngle, clamp, damp, dist, pointSegment, smoothstep } from '../core/math.js';

const CUFF_T = 0.8;      // le manette: tempo per vederle
const WAIT_CAR = 5;      // quanto si aspetta la volante prima di rinunciare
const WALK_MAX = 4;      // quanto può durare il tragitto a piedi
const BOARD_T = 0.95;    // portiera, giocatore dentro, agente al volante
const DRIVE_T = 2.0;     // la volante parte e si allontana
const FADE_T = 0.7;      // dissolvenza prima della cella
const FADE_IN = 0.9;     // e da nero al commissariato
const TIMEOUT = 12;      // oltre questo, qualcosa è andato storto
const CAR_REACH = 380;   // una volante già lì: entro questa distanza si usa
const KERB_REACH = 300;  // oltre questa distanza da una strada non si chiama nessuno
const WALK = 74;         // passo dell'accompagnamento: quello del giocatore
const ZOOM_SCENE = 1.8;   // si devono leggere due persone e le manette
const ZOOM_DRIVE = 2.0;   // e poi si stringe sulla volante che parte

export class ArrestSequence {
  constructor() {
    this.fade = 0;
    this.reset();
  }

  /** Tutto a riposo. Lo chiama anche `clearWorld`: un caricamento annulla la scena. */
  reset() {
    this.active = false;
    this.phase = '';
    this.t = 0;
    this.total = 0;
    this.cop = null;
    this.car = null;
    this.hidden = false;   // il giocatore è già dentro la volante
    this.copA = 0;
    this.why = '';
    this.mode = 'short';   // 'car' se c'è una volante, 'short' se non c'è modo
    this.copIn = false;
    this.front = { x: 0, y: 0 };
    this.rear = { x: 0, y: 0 };
    this._walkT = 0;
  }

  // --- avvio ------------------------------------------------------------------
  /** Parte la sequenza. Torna `false` se non può, e chi chiama chiude da sé. */
  start(game, cop) {
    if (this.active) return true;
    const pl = game.player;
    if (!cop) return false;
    this.reset();
    this.active = true;
    this.phase = 'cuff';
    this.cop = cop;
    // Da che parte sta l'agente: all'inizio gli è addosso (ti ha raggiunto), e due
    // sagome sovrapposte non si leggono.
    this.copA = Math.hypot(cop.x - pl.x, cop.y - pl.y) > 3 ? Math.atan2(cop.y - pl.y, cop.x - pl.x) : pl.angle;
    pl.vx = 0;
    pl.vy = 0;
    pl.swingT = 0;
    pl.angle = Math.atan2(cop.y - pl.y, cop.x - pl.x) + Math.PI;
    this.pickCar(game);
    game.audio?.handcuffs();
    game.hud.toast('체포 · In manette', 2.4);
    return true;
  }

  /**
   * La volante: la più vicina già lì, altrimenti una nuova che arriva da fuori
   * campo e accosta. Se non c'è una strada abbastanza vicina o non si trova un
   * punto dove farla nascere, **nessuna volante**: si resta ammanettati sul posto
   * e si va alla dissolvenza (`mode: 'short'`). È il fallback onesto.
   */
  pickCar(game) {
    const P = game.police;
    const pl = game.player;
    this.mode = 'short';

    let best = null;
    let fresh = false;
    let bd = CAR_REACH;
    for (const v of P.cars) {
      if (v.dead || v.driver !== 'cop' || VEHICLE_TYPES[v.kind].marine) continue;
      const d = dist(v.x, v.y, pl.x, pl.y);
      if (d < bd && hasLineOfSight(game, pl.x, pl.y, v.x, v.y)) { bd = d; best = v; }
    }

    const kerb = this.nearestRoadPoint(game);
    if (!best && kerb) {
      const near = P.city.graph.edgesNear(pl.x, pl.y, 1000);
      const graph = P.city.graph;
      const goal = graph.nearestNode(kerb.x, kerb.y);
      fresh = true;
      best = P.trySpawnCar(game, 'police', P.tier, near, (pt, edge, dir) => {
        const dx = pl.x - pt.x;
        const dy = pl.y - pt.y;
        const d = Math.hypot(dx, dy);
        // Appena fuori dall'inquadratura (`trySpawnCar` esclude già quello che si
        // vede) e col muso dalla parte giusta: sono ~2 s di strada, e la scena
        // deve stare in sei-otto secondi in tutto.
        if (d > 780 || Math.cos(pt.angle) * dx + Math.sin(pt.angle) * dy < d * 0.3) return false;
        // Niente auto ferme davanti: una coda al semaforo la volante non la salta.
        const c = Math.cos(pt.angle);
        const s = Math.sin(pt.angle);
        for (const o of game.vehicles) {
          const fx = (o.x - pt.x) * c + (o.y - pt.y) * s;
          if (fx > 0 && fx < 280 && Math.abs(-(o.x - pt.x) * s + (o.y - pt.y) * c) < 34) return false;
        }
        // E una strada che ci arrivi senza giri: l'A* dal prossimo incrocio non
        // deve essere molto più lungo della linea d'aria (misurato: senza questo
        // una volante su tre faceva il giro dell'isolato e la scena scadeva).
        const chain = game.route.solve(graph, graph.nodeById(dir > 0 ? edge.b : edge.a), goal);
        if (!chain) return false;
        let len = Math.hypot(chain[0].x - pt.x, chain[0].y - pt.y);
        for (let i = 1; i < chain.length; i++) len += Math.hypot(chain[i].x - chain[i - 1].x, chain[i].y - chain[i - 1].y);
        return len < d * 1.35 + 120;
      }, 160);
    }
    if (!best) return;

    this.car = best;
    this.mode = 'car';
    const t = kerb || { x: pl.x, y: pl.y };
    const copAi = best.copAi;
    // Una volante già lì può essere ferma storta: la si riaggancia alla corsia.
    // Una appena nata ha già la sua.
    if (!fresh) copAi.edge = null;
    copAi.jamT = 0;
    copAi.recoverT = 0;
    best.siren = true;
    best.lightsOn = true;
    best.handbrake = false;
    const still = Math.abs(best.speed) < 20 && dist(best.x, best.y, pl.x, pl.y) < 260;
    const goalGraph = game.police.city.graph;
    best.escort = {
      state: still ? 'hold' : 'approach', x: t.x, y: t.y, minD: Infinity,
      goal: goalGraph.nearestNode(t.x, t.y), edge: null, dir: 0, next: null,
    };
  }

  /** Il punto della strada più vicino al giocatore, se ce n'è uno ragionevole. */
  nearestRoadPoint(game) {
    const pl = game.player;
    let best = null;
    let bd = KERB_REACH;
    for (const e of game.police.city.graph.edgesNear(pl.x, pl.y, KERB_REACH)) {
      const q = pointSegment(pl.x, pl.y, e.ax, e.ay, e.bx, e.by);
      if (q.dist < bd) {
        bd = q.dist;
        best = { x: e.ax + (e.bx - e.ax) * q.t, y: e.ay + (e.by - e.ay) * q.t };
      }
    }
    return best;
  }

  // --- uscite -----------------------------------------------------------------
  /** `ESC`, o qualunque cosa vada storta: si chiude subito, nel solito modo. */
  skip(game) {
    this.finish(game, 'esc');
  }

  /** Rimette a posto quello che la sequenza ha toccato, senza chiudere niente. */
  release(game) {
    if (this.car) {
      this.car.escort = null;
      // Se qualcuno la vuole ancora, la polizia la guida come una volante qualsiasi.
      this.car.handbrake = false;
    }
    if (this.active) game.camera.releaseZoom();
    if (this.cop) this.cop.escort = false;
    this.active = false;
    this.hidden = false;
    this.car = null;
    this.cop = null;
  }

  /** Il giocatore è morto mentre era ammanettato: comanda la morte, non l'arresto. */
  abort(game) {
    this.release(game);
  }

  /** **L'unica uscita**: la dissolvenza è già al massimo e si va in cella. */
  finish(game, why = 'fine') {
    if (!this.active) return;
    this.why = why;   // come è finita: serve a chi prova, non al gioco
    this.release(game);
    this.fade = 1;
    game.bustPlayer();
  }

  // --- ciclo ------------------------------------------------------------------
  /** A fine frame, dopo che la fisica ha integrato l'auto. Gira sempre: la dissolvenza decade da sola. */
  update(dt, game) {
    if (!this.active) {
      this.fade = Math.max(0, this.fade - dt / FADE_IN);
      return;
    }
    const pl = game.player;
    if (pl.dying) return this.abort(game);
    if (game.indoors || !game.started) return this.abort(game);

    this.t += dt;
    this.total += dt;
    if (this.total > TIMEOUT) return this.finish(game, 'timeout');

    const cop = this.cop;
    const car = this.car;
    // Anomalie: l'agente è caduto prima di salire, o la volante non c'è più.
    if (!this.copIn && (cop.dead || cop.gone)) return this.finish(game, cop.dead ? 'agenteMorto' : 'agenteSparito');
    if (this.mode === 'car' && (car.dead || !game.vehicles.includes(car))) return this.finish(game, car.dead ? 'volanteDistrutta' : 'volanteSparita');

    const cam = game.camera;
    switch (this.phase) {
      case 'cuff':
        cam.setZoomTarget(ZOOM_SCENE);
        this.freeze(pl);
        if (this.t >= CUFF_T) this.go(this.mode === 'car' ? 'wait' : 'short');
        break;

      case 'short':
        // Nessuna volante raggiungibile: le manette e basta, poi la dissolvenza.
        this.freeze(pl);
        if (this.t >= 0.7) this.go('fade');
        break;

      case 'wait':
        this.freeze(pl);
        if (car.escort.state === 'hold') {
          this.planDoors(car, pl);
          this.go('walk');
        } else if (this.total > WAIT_CAR) {
          // Non è arrivata: se è vicina si ferma lì, altrimenti non si aspetta oltre.
          if (dist(car.x, car.y, pl.x, pl.y) < 420) car.escort.state = 'hold';
          else this.go('fade');
        }
        break;

      case 'walk': {
        this._walkT += dt;
        this.walkPlayer(dt, game);
        const atFront = dist(cop.x, cop.y, this.front.x, this.front.y) < 14;
        const atRear = dist(pl.x, pl.y, this.rear.x, this.rear.y) < 14;
        if (atFront && atRear) this.go('board');
        else if (this._walkT > WALK_MAX) this.go('fade');   // intoppo: niente teletrasporti
        break;
      }

      case 'board':
        // Il giocatore scivola nella portiera e sparisce; poi sale l'agente.
        this.freeze(pl);
        if (this.t >= 0.25 && !this.hidden) {
          this.hidden = true;
          game.audio?.doorClose(car.x, car.y);
        }
        if (this.t >= 0.6 && !this.copIn) {
          this.copIn = true;
          game.police.boardCop(cop, car, game);
          game.audio?.doorClose(car.x, car.y);
        }
        if (this.t >= BOARD_T) {
          car.copAi.edge = null;
          car.copAi.recoverT = 0;
          car.escort.state = 'leave';
          cam.holdZoom(ZOOM_DRIVE, DRIVE_T + 1.2);
          this.go('drive');
        }
        break;

      case 'drive':
        this.ride(car, pl);
        if (this.t >= DRIVE_T) this.go('fade');
        break;

      case 'fade':
        if (this.hidden) this.ride(car, pl);
        else this.freeze(pl);
        this.fade = clamp(this.fade + dt / FADE_T, 0, 1);
        if (this.fade >= 1) this.finish(game, 'dissolvenza');
        break;
      default:
        break;
    }
  }

  go(phase) {
    this.phase = phase;
    this.t = 0;
  }

  freeze(pl) {
    pl.vx = 0;
    pl.vy = 0;
  }

  /** Dentro la volante il giocatore è dove è l'auto: la camera la segue da sola. */
  ride(car, pl) {
    pl.x = car.x;
    pl.y = car.y;
    pl.vx = car.vx;
    pl.vy = car.vy;
  }

  /**
   * Le portiere, dal lato in cui il giocatore è già: attraversare la strada o
   * fare il giro dell'auto è una scena che non serve e una fonte di incastri.
   * L'agente va a quella davanti, il giocatore a quella dietro.
   */
  planDoors(car, pl) {
    const spec = VEHICLE_TYPES[car.kind];
    const cos = Math.cos(car.angle);
    const sin = Math.sin(car.angle);
    const side = (pl.x - car.x) * -sin + (pl.y - car.y) * cos >= 0 ? 1 : -1;
    const off = spec.wid * 0.5 + 12;
    const at = (along) => ({
      x: car.x + cos * along - sin * off * side,
      y: car.y + sin * along + cos * off * side,
    });
    this.front = at(spec.len * 0.16);
    this.rear = at(-spec.len * 0.1);
  }

  /** Il giocatore segue l'agente, che gli sta davanti; l'ultimo tratto è la sua portiera. */
  walkPlayer(dt, game) {
    const pl = game.player;
    const cop = this.cop;
    let tx;
    let ty;
    if (dist(cop.x, cop.y, this.front.x, this.front.y) < 42) {
      tx = this.rear.x;
      ty = this.rear.y;
    } else {
      tx = cop.x - Math.cos(cop.angle) * 17;
      ty = cop.y - Math.sin(cop.angle) * 17;
    }
    // Le altre lamiere si aggirano come fa ogni passante (`deflectAroundCars`);
    // quella della volante no, perché è lì che si va.
    if (dist(pl.x, pl.y, this.rear.x, this.rear.y) > 60) {
      const cars = game.vehicleGrid.queryCircle(pl.x, pl.y, 90).filter((v) => v !== this.car);
      if (cars.length) {
        const g = game.pedSystem.deflectAroundCars(pl, tx, ty, cars);
        if (g) { tx = g.x; ty = g.y; }
      }
    }
    const dx = tx - pl.x;
    const dy = ty - pl.y;
    const d = Math.hypot(dx, dy);
    const sp = d > 3 ? Math.min(WALK * 1.1, d * 4) : 0;
    pl.vx = damp(pl.vx, d > 0.1 ? (dx / d) * sp : 0, 0.06, dt);
    pl.vy = damp(pl.vy, d > 0.1 ? (dy / d) * sp : 0, 0.06, dt);
    pl.x += pl.vx * dt;
    pl.y += pl.vy * dt;
    const v = Math.hypot(pl.vx, pl.vy);
    if (v > 6) {
      pl.angle = approachAngle(pl.angle, Math.atan2(pl.vy, pl.vx), 9 * dt);
      pl.animT += v * dt * 0.16;
    }
    // Stessi muri e stesse lamiere di quando cammina da solo.
    pl.resolveCollisions(game, dt);
  }

  /**
   * L'ordine che `police.copBehavior` dà a un agente mentre dura la scena.
   * Quello che accompagna sta fermo accanto al giocatore finché la volante non è
   * lì, poi va alla portiera davanti e si ferma ad aspettare chi lo segue; gli
   * altri guardano e basta, senza sparare.
   */
  copOrder(p, game) {
    const pl = game.player;
    if (p !== this.cop || this.copIn) {
      p.angle = Math.atan2(pl.y - p.y, pl.x - p.x);
      return { x: p.x, y: p.y, speed: 0 };
    }
    if (this.phase === 'walk') {
      // Se il giocatore è rimasto indietro (un angolo, un lampione) lo si aspetta.
      const lag = dist(p.x, p.y, pl.x, pl.y);
      const atDoor = dist(p.x, p.y, this.front.x, this.front.y) < 42;
      // Scansare le lamiere va bene finché non si è vicini alla volante: lì si
      // va *contro* una lamiera, che è la portiera (vedi `pedestrians.js`).
      p.escort = dist(p.x, p.y, this.front.x, this.front.y) < 70;
      return { x: this.front.x, y: this.front.y, speed: lag > 52 && !atDoor ? 0 : WALK };
    }
    if (this.phase === 'board') return { x: this.front.x, y: this.front.y, speed: 0 };
    if (this.phase === 'cuff' || this.phase === 'wait' || this.phase === 'short') {
      // Si mette a fianco del giocatore e lo guarda.
      const gx = pl.x + Math.cos(this.copA) * 26;
      const gy = pl.y + Math.sin(this.copA) * 26;
      if (dist(p.x, p.y, gx, gy) > 4) return { x: gx, y: gy, speed: 40 };
      p.angle = Math.atan2(pl.y - p.y, pl.x - p.x);
    }
    return { x: p.x, y: p.y, speed: 0 };
  }

  // --- disegno ----------------------------------------------------------------
  /** La dissolvenza: sopra l'HUD e sotto i menu. */
  draw(ctx, game) {
    if (this.fade <= 0.001) return;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${smoothstep(this.fade).toFixed(3)})`;
    ctx.fillRect(0, 0, game.camera.viewW, game.camera.viewH);
    ctx.restore();
  }
}
