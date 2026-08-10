// Navigazione degli obiettivi sul grafo stradale.
//
// Il percorso non muove nessuno e non cambia la guida AI: legge lo stesso grafo
// delle auto e restituisce una polilinea che HUD e carta possono disegnare. La
// ricerca si rifà solo quando il giocatore passa a un altro nodo o il blip si
// sposta; fra due incroci cambia soltanto il breve raccordo iniziale.

class MinHeap {
  constructor() { this.items = []; }

  push(id, score) {
    const a = this.items;
    let i = a.length;
    a.push({ id, score });
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].score <= score) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = { id, score };
  }

  pop() {
    const a = this.items;
    if (!a.length) return null;
    const root = a[0];
    const tail = a.pop();
    if (!a.length) return root;
    let i = 0;
    while (true) {
      const l = i * 2 + 1;
      if (l >= a.length) break;
      const r = l + 1;
      const c = r < a.length && a[r].score < a[l].score ? r : l;
      if (a[c].score >= tail.score) break;
      a[i] = a[c];
      i = c;
    }
    a[i] = tail;
    return root;
  }

  get length() { return this.items.length; }
}

function otherNode(edge, from) {
  return edge.a === from ? edge.b : edge.a;
}

/** A* fra due nodi. `null` significa che le due componenti non sono collegate. */
export function shortestRoadPath(graph, start, goal) {
  if (!graph || !start || !goal) return null;
  if (start.id === goal.id) return [start];

  const n = graph.nodes.length;
  const cost = new Float64Array(n);
  cost.fill(Infinity);
  const came = new Int32Array(n);
  came.fill(-1);
  const closed = new Uint8Array(n);
  const open = new MinHeap();
  const estimate = (node) => Math.hypot(goal.x - node.x, goal.y - node.y);

  cost[start.id] = 0;
  open.push(start.id, estimate(start));

  while (open.length) {
    const item = open.pop();
    if (closed[item.id]) continue;
    if (item.id === goal.id) break;
    closed[item.id] = 1;
    const node = graph.nodeById(item.id);
    for (const out of node.out) {
      const nextId = otherNode(out.edge, item.id);
      if (closed[nextId]) continue;
      const nextCost = cost[item.id] + out.edge.len;
      if (nextCost >= cost[nextId]) continue;
      cost[nextId] = nextCost;
      came[nextId] = item.id;
      open.push(nextId, nextCost + estimate(graph.nodeById(nextId)));
    }
  }

  if (came[goal.id] < 0) return null;
  const ids = [];
  for (let id = goal.id; id >= 0; id = came[id]) {
    ids.push(id);
    if (id === start.id) break;
  }
  if (ids[ids.length - 1] !== start.id) return null;
  ids.reverse();
  return ids.map((id) => graph.nodeById(id));
}

/**
 * Cache del percorso dell'obiettivo principale. Il risultato comprende il
 * giocatore e il blip, così il primo e l'ultimo tratto restano leggibili anche
 * quando porta e carreggiata non coincidono esattamente.
 */
export class MissionRoute {
  constructor(city) {
    this.city = city;
    this.key = '';
    this.road = null;
  }

  clear() {
    this.key = '';
    this.road = null;
  }

  get(game) {
    const marker = (game.markers || []).find((m) => m.primary || m.id === 'mission');
    if (!marker || marker.route === false || game.indoors) {
      this.clear();
      return null;
    }
    const graph = this.city?.graph;
    if (!graph?.nearestNode) return null;
    const start = graph.nearestNode(game.player.x, game.player.y);
    const goal = graph.nearestNode(marker.x, marker.y);
    if (!start || !goal) return null;
    const key = `${start.id}:${goal.id}:${marker.id}:${Math.round(marker.x)}:${Math.round(marker.y)}`;
    if (key !== this.key) {
      this.key = key;
      this.road = shortestRoadPath(graph, start, goal);
    }
    if (!this.road) return null;
    return [
      { x: game.player.x, y: game.player.y },
      ...this.road,
      { x: marker.x, y: marker.y },
    ];
  }
}
