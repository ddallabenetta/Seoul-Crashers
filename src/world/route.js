// L'itinerario verso il blip: A* sul grafo stradale, e la regola di quando rifarlo.
//
// Il grafo c'era già (`world/roadgraph.js`) ma **nessuno ci aveva mai cercato un
// percorso**: il traffico sceglie a ogni incrocio e la polizia va greedy verso il
// bersaglio (§3), che è tutto quello che serve a chi insegue. Una strada da
// *mostrare* invece deve arrivare davvero, e su una maglia con dentro un fiume e
// due coste il greedy si infila nei moncherini e resta lì.
//
// Il conto è piccolo per costruzione: il grafo della Corea intera è sotto il
// migliaio di nodi, e con l'insieme chiuso ognuno si espande al più una volta. Il
// costo vero non è l'A*, è **quante volte lo si rifà**: le tre soglie qui sotto
// sono quelle che tengono il ricalcolo a due o tre volte al secondo mentre si
// guida, e a zero mentre si sta fermi a parlare.
import { dist } from '../core/math.js';

/** Secondi minimi fra due calcoli. Sotto, si tiene quello che c'è. */
const RECALC = 0.4;
/** Px percorsi dal giocatore che rendono vecchio l'itinerario. */
const MOVED = 45;
/** Px di spostamento del blip: sotto, è lo stesso posto. */
const TARGET_MOVED = 12;

/** Coda di priorità minima: due array paralleli, nessuna allocazione per nodo. */
class Heap {
  constructor() { this.id = []; this.f = []; }
  get size() { return this.id.length; }
  clear() { this.id.length = 0; this.f.length = 0; }

  push(id, f) {
    const ids = this.id, fs = this.f;
    let i = ids.length;
    ids.push(id); fs.push(f);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fs[p] <= fs[i]) break;
      const ti = ids[p]; ids[p] = ids[i]; ids[i] = ti;
      const tf = fs[p]; fs[p] = fs[i]; fs[i] = tf;
      i = p;
    }
  }

  pop() {
    const ids = this.id, fs = this.f;
    const top = ids[0];
    const lastId = ids.pop();
    const lastF = fs.pop();
    const n = ids.length;
    if (n > 0) {
      ids[0] = lastId; fs[0] = lastF;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && fs[r] < fs[l] ? r : l;
        if (fs[c] >= fs[i]) break;
        const ti = ids[c]; ids[c] = ids[i]; ids[i] = ti;
        const tf = fs[c]; fs[c] = fs[i]; fs[i] = tf;
        i = c;
      }
    }
    return top;
  }
}

export class RouteGuide {
  constructor(city) {
    this.city = city;
    /** Il percorso in coordinate mondo: giocatore, gli incroci, il blip. */
    this.points = [];
    /** Una copia del marcatore verso cui punta, o `null`. */
    this.target = null;
    /** Lunghezza del percorso in px di mondo: la carta la scrive in metri. */
    this.length = 0;
    /** Vero quando le strade non ci arrivano: Jeju, o un blip in mezzo al mare. */
    this.direct = false;
    this.t = RECALC;
    this._fromX = 0;
    this._fromY = 0;
    this._heap = new Heap();
    this._gen = 0;
  }

  clear() {
    this.points.length = 0;
    this.target = null;
    this.length = 0;
    this.direct = false;
  }

  /** Il blip da raggiungere: il più vicino, se un giorno ce ne sarà più d'uno. */
  pick(game) {
    let best = null;
    let bd = Infinity;
    for (const mk of game.markers || []) {
      if (mk.route === false) continue;
      const d = dist(game.player.x, game.player.y, mk.x, mk.y);
      if (d < bd) { bd = d; best = mk; }
    }
    return best;
  }

  update(dt, game) {
    this.t += dt;
    // Dentro un edificio le coordinate del giocatore sono quelle della pianta e in
    // città cadono nell'angolo nord-ovest (§3): un itinerario calcolato da lì
    // partirebbe da Gimpo. Resta quello con cui si è entrati, che è anche quello
    // che serve appena si riesce.
    if (game.indoors) return;
    const mk = this.pick(game);
    if (!mk) {
      if (this.target) this.clear();
      return;
    }
    const p = game.player;
    const moved = dist(p.x, p.y, this._fromX, this._fromY);
    const changed = !this.target
      || this.target.id !== mk.id
      || dist(this.target.x, this.target.y, mk.x, mk.y) > TARGET_MOVED;
    const stale = changed || this.points.length < 2 || moved > MOVED;
    if (!stale) return;
    // Un blip nuovo si traccia subito: mezzo secondo di ritardo su un cambio di
    // fase si vede. Il resto passa dalla soglia.
    if (!changed && this.t < RECALC) return;
    this.build(game, mk);
  }

  build(game, mk) {
    const p = game.player;
    this.t = 0;
    this._fromX = p.x;
    this._fromY = p.y;
    this.target = { id: mk.id, x: mk.x, y: mk.y, color: mk.color, label: mk.label };

    const pts = this.points;
    pts.length = 0;
    pts.push({ x: p.x, y: p.y });

    const graph = this.city.graph;
    const chain = graph
      ? this.solve(graph, graph.nearestNode(p.x, p.y), graph.nearestNode(mk.x, mk.y))
      : null;
    this.direct = !chain;
    if (chain) {
      // Il primo nodo può essere l'incrocio appena superato e l'ultimo quello
      // oltre la porta: due segmenti all'indietro che su una carta si vedono
      // benissimo e sembrano un errore del percorso.
      if (chain.length > 1 && dist(p.x, p.y, chain[1].x, chain[1].y) < dist(chain[0].x, chain[0].y, chain[1].x, chain[1].y)) {
        chain.shift();
      }
      const n = chain.length;
      if (n > 1 && dist(mk.x, mk.y, chain[n - 2].x, chain[n - 2].y) < dist(chain[n - 1].x, chain[n - 1].y, chain[n - 2].x, chain[n - 2].y)) {
        chain.pop();
      }
      for (const nd of chain) pts.push({ x: nd.x, y: nd.y });
    }
    pts.push({ x: mk.x, y: mk.y });

    let px = 0;
    for (let i = 1; i < pts.length; i++) px += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    this.length = px;
  }

  /**
   * A* fra due nodi. I quattro buffer sono indicizzati per `node.id` e vivono
   * quanto l'oggetto: la generazione (`gen`) li marca validi invece di azzerarli,
   * così un calcolo non tocca mai mille celle per riscriverne dieci.
   *
   * Restituisce `null` quando la meta è in un'altra componente del grafo — Jeju
   * non ha nessun arco che la raggiunga (§3), ed è giusto che la carta lo dica
   * con una retta invece di inventarsi una strada.
   */
  solve(graph, start, goal) {
    if (!start || !goal) return null;
    const nodes = graph.nodes;
    const n = nodes.length;
    if (!this._g || this._g.length !== n) {
      this._g = new Float64Array(n);
      this._from = new Int32Array(n);
      this._seen = new Int32Array(n);
      this._closed = new Int32Array(n);
      this._gen = 0;
    }
    const g = this._g, from = this._from, seen = this._seen, closed = this._closed;
    const gen = ++this._gen;
    const open = this._heap;
    open.clear();

    g[start.id] = 0;
    from[start.id] = -1;
    seen[start.id] = gen;
    open.push(start.id, dist(start.x, start.y, goal.x, goal.y));

    while (open.size) {
      const cur = open.pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === goal.id) {
        const chain = [];
        for (let id = cur; id >= 0; id = from[id]) chain.push(nodes[id]);
        chain.reverse();
        return chain;
      }
      const node = nodes[cur];
      const base = g[cur];
      for (const o of node.out) {
        // `out` guarda l'arco dal proprio capo: con `dir` 1 l'altro estremo è `b`.
        const nb = o.dir > 0 ? o.edge.b : o.edge.a;
        if (closed[nb] === gen) continue;
        const ng = base + o.edge.len;
        if (seen[nb] === gen && g[nb] <= ng) continue;
        seen[nb] = gen;
        g[nb] = ng;
        from[nb] = cur;
        open.push(nb, ng + dist(nodes[nb].x, nodes[nb].y, goal.x, goal.y));
      }
    }
    return null;
  }
}
