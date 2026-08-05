// Grafo stradale: nodi negli incroci, archi lungo i segmenti, corsie e semafori.
// La Corea guida a destra: in un sistema con y verso il basso il vettore "destra"
// di una direzione (dx,dy) è (-dy, dx).
import { SpatialGrid } from '../core/spatial.js';

// Il giallo è un intervallo di sicurezza, non una leva di capacità: resta fisso e
// il verde si prende quello che avanza, così la durata del ciclo è una manopola sola.
export const SIGNAL_CYCLE = 15.5;
const YELLOW = 1;
const GREEN = (SIGNAL_CYCLE - YELLOW * 2) / 2;

export function laneCount(edge) {
  return edge.arterial ? 2 : 1;
}

export function laneOffset(edge, lane) {
  if (edge.arterial) return lane === 0 ? 18 : 54;
  return 19;
}

/** Punto di una corsia: s = distanza percorsa nel senso di marcia. */
export function lanePoint(edge, dir, lane, s, out = {}) {
  const off = laneOffset(edge, lane);
  if (dir > 0) {
    out.x = edge.ax + edge.dx * s - edge.dy * off;
    out.y = edge.ay + edge.dy * s + edge.dx * off;
    out.angle = edge.angle;
  } else {
    out.x = edge.bx - edge.dx * s + edge.dy * off;
    out.y = edge.by - edge.dy * s - edge.dx * off;
    out.angle = edge.angle + Math.PI;
  }
  return out;
}

/** Fase del semaforo: 'v' se il traffico verticale ha verde. */
export function signalAxis(node, time) {
  const p = (time + node.tOffset) % SIGNAL_CYCLE;
  if (p < GREEN) return 'v';
  if (p < GREEN + YELLOW) return 'v-yellow';
  if (p < GREEN * 2 + YELLOW) return 'h';
  return 'h-yellow';
}

export function canPass(node, axis, time) {
  if (!node.signal) return true;
  const ph = signalAxis(node, time);
  if (axis === 'v') return ph === 'v' || ph === 'v-yellow';
  return ph === 'h' || ph === 'h-yellow';
}

export function buildRoadGraph(city) {
  const { vLines, hLines } = city;
  const nodes = [];
  const edges = [];
  const idOf = new Map(); // "vi,hi" -> node

  for (let vi = 0; vi < vLines.length; vi++) {
    for (let hi = 0; hi < hLines.length; hi++) {
      const v = vLines[vi];
      const h = hLines[hi];
      const node = {
        id: nodes.length,
        x: v.c,
        y: h.c,
        vi, hi,
        vWidth: v.width,
        hWidth: h.width,
        arterial: v.arterial && h.arterial,
        signal: v.arterial || h.arterial,
        tOffset: ((vi * 7 + hi * 11) % 8) * (SIGNAL_CYCLE / 8),
        // Prenotazione dell'incrocio: quale asse lo sta attraversando e da quando.
        // Senza questo, agli incroci non semaforizzati nessuno cede e il traffico
        // si blocca a vicenda in pochi secondi.
        claimAxis: null,
        claimT: -99,
        out: [],
      };
      nodes.push(node);
      idOf.set(`${vi},${hi}`, node);
    }
  }

  const addEdge = (na, nb, axis, arterial, width) => {
    const dxRaw = nb.x - na.x;
    const dyRaw = nb.y - na.y;
    const len = Math.hypot(dxRaw, dyRaw);
    if (len < 1) return;
    const edge = {
      id: edges.length,
      a: na.id, b: nb.id,
      ax: na.x, ay: na.y, bx: nb.x, by: nb.y,
      dx: dxRaw / len, dy: dyRaw / len,
      len,
      angle: Math.atan2(dyRaw, dxRaw),
      axis,
      arterial,
      width,
    };
    edges.push(edge);
    na.out.push({ edge, dir: 1, angle: edge.angle });
    nb.out.push({ edge, dir: -1, angle: edge.angle + Math.PI });
  };

  // Archi verticali. `l.on[j]` dice se la linea esiste davvero fra la trasversale
  // j e la j+1: dopo superblocchi, disassamenti e fiume molti tratti non ci sono.
  for (let vi = 0; vi < vLines.length; vi++) {
    const v = vLines[vi];
    for (let hi = 0; hi < hLines.length - 1; hi++) {
      if (!v.on[hi]) continue;
      addEdge(idOf.get(`${vi},${hi}`), idOf.get(`${vi},${hi + 1}`), 'v', v.arterial, v.width);
    }
  }

  // Archi orizzontali
  for (let hi = 0; hi < hLines.length; hi++) {
    const h = hLines[hi];
    for (let vi = 0; vi < vLines.length - 1; vi++) {
      if (!h.on[vi]) continue;
      addEdge(idOf.get(`${vi},${hi}`), idOf.get(`${vi + 1},${hi}`), 'h', h.arterial, h.width);
    }
  }

  // Un nodo dove passa un asse solo non è un incrocio: è un punto in mezzo alla
  // strada. Lasciargli il semaforo farebbe fermare le auto senza motivo.
  for (const n of nodes) {
    if (!n.signal) continue;
    let hasV = false, hasH = false;
    for (const o of n.out) {
      if (o.edge.axis === 'v') hasV = true;
      else hasH = true;
    }
    n.signal = hasV && hasH;
  }

  // Scarta i nodi isolati (possono nascere ai bordi del fiume).
  const usable = nodes.filter((n) => n.out.length > 0);

  // Indice spaziale degli archi: lo streaming del traffico deve trovare in fretta
  // le strade vicine al giocatore, non frugare in tutta la città.
  const edgeGrid = new SpatialGrid(city.w, city.h, 320);
  for (const e of edges) {
    edgeGrid.insertRect({
      x: Math.min(e.ax, e.bx) - 20,
      y: Math.min(e.ay, e.by) - 20,
      w: Math.abs(e.bx - e.ax) + 40,
      h: Math.abs(e.by - e.ay) + 40,
      edge: e,
    });
  }

  const graph = {
    nodes,
    usableNodes: usable,
    edges,
    edgeGrid,
    nodeById: (id) => nodes[id],

    /** Archi che intersecano un intorno quadrato del punto dato. */
    edgesNear(x, y, r, out = []) {
      const hits = edgeGrid.queryRect(x - r, y - r, r * 2, r * 2);
      out.length = 0;
      for (const h of hits) out.push(h.edge);
      return out;
    },

    /** Arco casuale con direzione e corsia, per lo spawn del traffico. */
    randomLane(rng) {
      const edge = rng.pick(edges);
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = rng.int(0, laneCount(edge) - 1);
      return { edge, dir, lane };
    },

    /** Prossimo arco a un incrocio: evita l'inversione a U, preferisce andare dritto. */
    nextLane(node, fromEdge, rng) {
      const opts = node.out.filter((o) => o.edge !== fromEdge);
      if (opts.length === 0) {
        const back = node.out.find((o) => o.edge === fromEdge);
        return back ? { edge: back.edge, dir: back.dir } : null;
      }
      const inAngle = fromEdge.axis;
      const straight = opts.filter((o) => o.edge.axis === inAngle);
      const pool = straight.length && rng.chance(0.62) ? straight : opts;
      const o = rng.pick(pool);
      return { edge: o.edge, dir: o.dir };
    },

    nearestNode(x, y) {
      let best = usable[0];
      let bd = Infinity;
      for (const n of usable) {
        const d = (n.x - x) ** 2 + (n.y - y) ** 2;
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    },
  };

  return graph;
}
