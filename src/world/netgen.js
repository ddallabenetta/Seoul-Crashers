// Rete stradale e isolati da tracciati liberi (Busan e Jeju, §5.41).
//
// La maglia di Seoul è un reticolo: `vLines`/`hLines` con un array `on[]`, e il
// grafo nasce dagli incroci di tutte le linee con tutte. Funziona finché la città
// è una scacchiera; una strada costiera che segue la riva, o che cala da un passo
// di montagna, in un reticolo vorrebbe un'ottantina di linee quasi tutte spente.
// Qui il punto di partenza è l'opposto: **tracciati** (poligonali con lati
// assiali) e il grafo nasce dai loro incroci, con un nodo solo dove serve.
//
// Il contratto verso il resto del gioco non cambia — è lo stesso che `buildRoadGraph`
// produce per Seoul:
//  - `city.vLines` / `city.hLines`: una linea per tratto rettilineo, con `c`,
//    `width`, `arterial`, `segments` (l'asfalto, già prolungato di mezza carreggiata
//    perché negli angoli non resti un quadrante di terra) e `marks` (la segnaletica,
//    che si ferma prima degli incroci). Niente `on[]`: `korea.buildLaneMarks` lascia
//    stare le linee che i `marks` li portano già.
//  - `city.graph`, `city.intersections`, `city.crosswalks`.
// Larghezze e corsie non si discutono (§3): boulevard 144 px (due corsie per
// senso), strada 76 px (una).
import { SpatialGrid } from '../core/spatial.js';
import { graphFromParts, SIGNAL_CYCLE } from './roadgraph.js';

export const W_STREET = 76;
export const W_BLVD = 144;

const R = Math.round;

/** Poligonale con lati assiali → tratti. */
export function pathLegs(pts, arterial = false) {
  const legs = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (Math.abs(x0 - x1) < 0.5 && Math.abs(y0 - y1) < 0.5) continue;
    if (Math.abs(x0 - x1) < 0.5) legs.push({ axis: 'v', c: x0, a: Math.min(y0, y1), b: Math.max(y0, y1), arterial });
    else if (Math.abs(y0 - y1) < 0.5) legs.push({ axis: 'h', c: y0, a: Math.min(x0, x1), b: Math.max(x0, x1), arterial });
    else throw new Error(`lato non assiale: ${x0},${y0} → ${x1},${y1}`);
  }
  return legs;
}

/**
 * Costruisce linee, grafo, incroci e strisce pedonali dai tratti. Modifica `city`
 * e restituisce i tratti normalizzati (utili a chi vuole controllare il disegno).
 */
export function buildNetwork(city, input) {
  // --- 1. normalizza e fondi i tratti collineari -----------------------------
  // Si fondono solo tratti con la stessa gerarchia: un boulevard che incontra in
  // linea retta una strada da 76 resta due tratti, perché la larghezza cambia.
  const groups = new Map();
  for (const l0 of input) {
    const l = { axis: l0.axis, c: R(l0.c), a: R(Math.min(l0.a, l0.b)), b: R(Math.max(l0.a, l0.b)), arterial: !!l0.arterial };
    if (l.b - l.a < 1) continue;
    l.width = l0.width || (l.arterial ? W_BLVD : W_STREET);
    const key = `${l.axis}${l.c}:${l.width}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  const legs = [];
  for (const arr of groups.values()) {
    arr.sort((p, q) => p.a - q.a);
    let cur = { ...arr[0] };
    for (let i = 1; i < arr.length; i++) {
      const n = arr[i];
      if (n.a <= cur.b) cur.b = Math.max(cur.b, n.b);
      else { legs.push(cur); cur = { ...n }; }
    }
    legs.push(cur);
  }
  const vLegs = legs.filter((l) => l.axis === 'v');
  const hLegs = legs.filter((l) => l.axis === 'h');
  for (const l of legs) l.nodes = [];

  // --- 2. nodi: estremi di ogni tratto e incroci fra tratti di assi diversi ----
  const nodes = [];
  const byPos = new Map();
  const nodeAt = (x, y) => {
    const key = `${x}|${y}`;
    let n = byPos.get(key);
    if (!n) {
      n = {
        id: nodes.length, x, y, vi: -1, hi: -1, vWidth: 0, hWidth: 0,
        arterial: false, signal: false, tOffset: 0, claimAxis: null, claimT: -99, out: [],
        vLeg: null, hLeg: null,
      };
      nodes.push(n);
      byPos.set(key, n);
    }
    return n;
  };
  const attach = (leg, n) => {
    if (leg.nodes.includes(n)) return;
    leg.nodes.push(n);
    if (leg.axis === 'v') { if (!n.vLeg || leg.width > n.vLeg.width) n.vLeg = leg; }
    else if (!n.hLeg || leg.width > n.hLeg.width) n.hLeg = leg;
  };
  for (const l of legs) {
    if (l.axis === 'v') { attach(l, nodeAt(l.c, l.a)); attach(l, nodeAt(l.c, l.b)); }
    else { attach(l, nodeAt(l.a, l.c)); attach(l, nodeAt(l.b, l.c)); }
  }
  for (const v of vLegs) for (const h of hLegs) {
    if (v.c < h.a || v.c > h.b || h.c < v.a || h.c > v.b) continue;
    const n = nodeAt(v.c, h.c);
    attach(v, n);
    attach(h, n);
  }

  // --- 3. archi ------------------------------------------------------------
  const edges = [];
  for (const l of legs) {
    const along = l.axis === 'v' ? (n) => n.y : (n) => n.x;
    l.nodes.sort((p, q) => along(p) - along(q));
    for (let i = 0; i + 1 < l.nodes.length; i++) {
      const na = l.nodes[i];
      const nb = l.nodes[i + 1];
      const dxRaw = nb.x - na.x;
      const dyRaw = nb.y - na.y;
      const len = Math.hypot(dxRaw, dyRaw);
      if (len < 1) continue;
      const edge = {
        id: edges.length, a: na.id, b: nb.id,
        ax: na.x, ay: na.y, bx: nb.x, by: nb.y,
        dx: dxRaw / len, dy: dyRaw / len, len,
        angle: Math.atan2(dyRaw, dxRaw),
        axis: l.axis, arterial: l.arterial, width: l.width,
      };
      edges.push(edge);
      na.out.push({ edge, dir: 1, angle: edge.angle });
      nb.out.push({ edge, dir: -1, angle: edge.angle + Math.PI });
    }
  }

  // --- 4. linee per il renderer ---------------------------------------------
  const vLines = [];
  const hLines = [];
  for (const l of legs) {
    const line = { c: l.c, width: l.width, arterial: l.arterial, segments: [], marks: [], leg: l };
    (l.axis === 'v' ? vLines : hLines).push(line);
    l.line = line;
  }
  // Un tratto che finisce contro un altro asse **sborda di mezza carreggiata** oltre il
  // nodo: senza, in un angolo resta un quadrante di terra (la stessa giunzione sfasata
  // che si vedeva guidando l'autostrada, §5.25). Un vicolo cieco non sborda: ci pensa
  // la testata (`korea.accorciaStrade`).
  const crossWidth = (n, axis) => (axis === 'v' ? n.hWidth : n.vWidth);
  for (const n of nodes) {
    n.vWidth = n.vLeg ? n.vLeg.width : 0;
    n.hWidth = n.hLeg ? n.hLeg.width : 0;
    n.vi = n.vLeg ? vLines.indexOf(n.vLeg.line) : -1;
    n.hi = n.hLeg ? hLines.indexOf(n.hLeg.line) : -1;
    n.arterial = !!(n.vLeg?.arterial && n.hLeg?.arterial);
    const hasV = n.out.some((o) => o.edge.axis === 'v');
    const hasH = n.out.some((o) => o.edge.axis === 'h');
    // Il semaforo serve dove due assi si incrociano davvero e almeno uno è una
    // arteria: un angolo con due soli rami non ha traffico trasversale da regolare.
    n.signal = hasV && hasH && n.out.length >= 3 && !!(n.vLeg?.arterial || n.hLeg?.arterial);
    n.tOffset = (((Math.max(0, n.vi) * 7 + Math.max(0, n.hi) * 11) % 8) * (SIGNAL_CYCLE / 8));
  }
  for (const l of legs) {
    const first = l.nodes[0];
    const last = l.nodes[l.nodes.length - 1];
    const pad = (n) => (n.out.length > 1 ? crossWidth(n, l.axis) / 2 : 0);
    const a = l.a - pad(first);
    const b = l.b + pad(last);
    l.line.segments.push([a, b]);
    // Segnaletica: da un nodo al successivo, ritirata di mezza carreggiata trasversale
    // agli incroci. Dove un nodo è solo un punto lungo la via (nessun asse
    // trasversale) le strisce continuano.
    const along = l.axis === 'v' ? (n) => n.y : (n) => n.x;
    for (let i = 0; i + 1 < l.nodes.length; i++) {
      const p = l.nodes[i];
      const q = l.nodes[i + 1];
      const from = along(p) + (crossWidth(p, l.axis) > 0 ? crossWidth(p, l.axis) / 2 : 0);
      const to = along(q) - (crossWidth(q, l.axis) > 0 ? crossWidth(q, l.axis) / 2 : 0);
      if (to - from > 24) l.line.marks.push([from, to]);
    }
  }

  // --- 5. incroci e strisce pedonali -----------------------------------------
  const intersections = [];
  const crosswalks = [];
  for (const n of nodes) {
    if (n.out.length < 3) continue;
    intersections.push({ x: n.x, y: n.y, vw: n.vWidth, hw: n.hWidth, arterial: n.arterial, vi: n.vi, hi: n.hi });
    for (const o of n.out) {
      if (o.edge.len < 120) continue;
      const e = o.edge;
      const vertical = e.axis === 'v';
      const off = (vertical ? n.hWidth : n.vWidth) / 2 + 8;
      // Direzione uscente dal nodo lungo l'asse: il segno dice da che lato sta il braccio.
      const sgn = o.dir > 0 ? Math.sign(vertical ? e.dy : e.dx) : -Math.sign(vertical ? e.dy : e.dx);
      if (vertical) crosswalks.push({ x: n.x, y: n.y + sgn * off, w: e.width, h: 16, horiz: true });
      else crosswalks.push({ x: n.x + sgn * off, y: n.y, w: 16, h: e.width, horiz: false });
    }
  }

  city.vLines = vLines;
  city.hLines = hLines;
  city.graph = graphFromParts(nodes, edges, city.w, city.h);
  city.intersections = intersections;
  city.crosswalks = crosswalks;
  return legs;
}

/** Rettangoli d'asfalto di una rete già costruita, nel formato che usa `roadIndex`. */
export function roadRects(city) {
  const out = [];
  for (const l of city.vLines) for (const [a, b] of l.segments) out.push({ x: l.c - l.width / 2, y: a, w: l.width, h: b - a });
  for (const l of city.hLines) for (const [a, b] of l.segments) out.push({ x: a, y: l.c - l.width / 2, w: b - a, h: l.width });
  return out;
}

/** Indice «questo punto è su una carreggiata?» per il solo tempo di generazione. */
export function makeRoadHit(city) {
  const grid = new SpatialGrid(city.w, city.h, 320);
  for (const r of roadRects(city)) grid.insertRect(r);
  const buf = [];
  const hit = (x, y, pad = 0) => {
    for (const r of grid.queryRect(x - pad, y - pad, pad * 2 + 1, pad * 2 + 1, buf)) {
      if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return true;
    }
    return false;
  };
  hit.grid = grid;
  return hit;
}

// ---------------------------------------------------------------------------
// ISOLATI
// ---------------------------------------------------------------------------

const lowerBound = (arr, v) => {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] < v - 0.01) lo = m + 1; else hi = m;
  }
  return lo;
};

/**
 * Isolati = **spazio libero** fra le strade, ritagliato in rettangoli.
 *
 * Seoul li ottiene fondendo le celle libere di un reticolo; qui la griglia non c'è,
 * quindi si costruisce una griglia *comprimessa* sulle sole coordinate che contano
 * (i bordi di ogni carreggiata e di ogni isolato già fatto, più un passo fisso che
 * serve alla riva), si marcano le celle occupate e si fondono quelle libere in
 * rettangoli più grandi possibile. Più passate con passo decrescente: la prima copre
 * la terraferma, le successive riempiono le fasce rimaste lungo la costa, e ogni
 * isolato nuovo è fatto solo di celle asciutte — quindi **niente isolato in acqua e
 * niente isolato su una strada**, per costruzione.
 *
 * `reserved` sono rettangoli già assegnati (aeroporto, porto, landmark) e contano
 * come occupati. `land(x, y)` è la maschera: il bordo di un isolato non si ritira
 * sulla riva, ci arriva (la battigia disegnata ha il suo spessore).
 */
export function carveBlocks(city, { roads, reserved = [], land, steps = [200, 100], minSize = 56, maxW = 720, maxH = 720, inset = 0 }) {
  const blocks = [];
  const occupied = [...roads, ...reserved];
  for (const step of steps) {
    const xsSet = new Set([inset, city.w - inset]);
    const ysSet = new Set([inset, city.h - inset]);
    const addRect = (r) => {
      xsSet.add(R(r.x)); xsSet.add(R(r.x + r.w));
      ysSet.add(R(r.y)); ysSet.add(R(r.y + r.h));
    };
    for (const r of occupied) addRect(r);
    for (let x = Math.ceil(inset / step) * step; x < city.w - inset; x += step) xsSet.add(x);
    for (let y = Math.ceil(inset / step) * step; y < city.h - inset; y += step) ysSet.add(y);
    const clean = (set, lo, hi) => {
      const arr = [...set].filter((v) => v >= lo && v <= hi).sort((p, q) => p - q);
      const out = [];
      for (const v of arr) if (!out.length || v - out[out.length - 1] >= 3) out.push(v);
      return out;
    };
    const xs = clean(xsSet, inset, city.w - inset);
    const ys = clean(ysSet, inset, city.h - inset);
    const nx = xs.length - 1;
    const ny = ys.length - 1;
    const occ = new Uint8Array(nx * ny);
    for (const r of occupied) {
      const i0 = lowerBound(xs, r.x + 1.5);
      const i1 = lowerBound(xs, r.x + r.w - 1.5);
      const j0 = lowerBound(ys, r.y + 1.5);
      const j1 = lowerBound(ys, r.y + r.h - 1.5);
      // La cella i sta fra xs[i] e xs[i+1]: è dentro il rettangolo se il suo bordo
      // sinistro è >= r.x e il destro <= r.x+w. `lowerBound` restituisce l'indice
      // del primo bordo >= valore, quindi le celle coperte sono [i0-1 .. i1-1] al
      // netto dell'arrotondamento: si ricontrolla sulle coordinate vere.
      for (let j = Math.max(0, j0 - 1); j <= Math.min(ny - 1, j1); j++) {
        if (ys[j + 1] <= r.y + 1.5 || ys[j] >= r.y + r.h - 1.5) continue;
        for (let i = Math.max(0, i0 - 1); i <= Math.min(nx - 1, i1); i++) {
          if (xs[i + 1] <= r.x + 1.5 || xs[i] >= r.x + r.w - 1.5) continue;
          occ[j * nx + i] = 1;
        }
      }
    }
    const free = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (occ[j * nx + i]) continue;
      const x0 = xs[i], x1 = xs[i + 1], y0 = ys[j], y1 = ys[j + 1];
      const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      // Nove campioni: una cella appena lambita dall'acqua non è terra.
      if (land(x0 + 1, y0 + 1) && land(x1 - 1, y0 + 1) && land(x0 + 1, y1 - 1) && land(x1 - 1, y1 - 1)
        && land(xm, ym) && land(xm, y0 + 1) && land(xm, y1 - 1) && land(x0 + 1, ym) && land(x1 - 1, ym)) free[j * nx + i] = 1;
    }
    const used = new Uint8Array(nx * ny);
    const fresh = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const q = j * nx + i;
      if (!free[q] || used[q]) continue;
      let i2 = i;
      while (i2 + 1 < nx && free[j * nx + i2 + 1] && !used[j * nx + i2 + 1] && xs[i2 + 2] - xs[i] <= maxW) i2++;
      let j2 = j;
      for (;;) {
        const jj = j2 + 1;
        if (jj >= ny || ys[jj + 1] - ys[j] > maxH) break;
        let ok = true;
        for (let k = i; k <= i2; k++) if (!free[jj * nx + k] || used[jj * nx + k]) { ok = false; break; }
        if (!ok) break;
        j2 = jj;
      }
      for (let b = j; b <= j2; b++) for (let a = i; a <= i2; a++) used[b * nx + a] = 1;
      const rect = { x: xs[i], y: ys[j], w: xs[i2 + 1] - xs[i], h: ys[j2 + 1] - ys[j] };
      if (rect.w >= minSize && rect.h >= minSize) fresh.push(rect);
    }
    for (const r of fresh) { blocks.push(r); occupied.push(r); }
  }
  return blocks;
}

/**
 * Quanto di ciascun lato di un isolato confina con una strada, con l'acqua o con
 * niente (terra aperta). Serve a decidere dove un palazzo può avere la porta e
 * dove invece c'è il retro, la spiaggia o il bosco.
 */
export function sideProfile(b, hit, land) {
  const sample = (px, py) => (hit(px, py) ? 'road' : !land(px, py) ? 'water' : 'open');
  const out = {};
  const N = 12;
  for (const side of ['top', 'bottom', 'left', 'right']) {
    const c = { road: 0, water: 0, open: 0 };
    for (let k = 0; k < N; k++) {
      const t = (k + 0.5) / N;
      const px = side === 'left' ? b.x - 14 : side === 'right' ? b.x + b.w + 14 : b.x + b.w * t;
      const py = side === 'top' ? b.y - 14 : side === 'bottom' ? b.y + b.h + 14 : b.y + b.h * t;
      c[sample(px, py)]++;
    }
    out[side] = { road: c.road / N, water: c.water / N, open: c.open / N };
  }
  return out;
}

// ---------------------------------------------------------------------------
// TRACCIATI CHE SEGUONO UNA CURVA
// ---------------------------------------------------------------------------

/**
 * Poligonale assiale che **segue una curva** campionata (`samples`): è il modo in cui
 * una strada costiera o di fondovalle esiste in un mondo di sole strade ortogonali.
 * L'isteresi decide dove si piega: la gamba orizzontale tiene la sua quota finché lo
 * scarto verticale dalla curva non supera `thr`, poi scatta una gamba verticale (e
 * viceversa). Dove la curva è quasi retta le gambe sono lunghe, dove corre in
 * diagonale i gradini valgono `thr` — che quindi **non deve scendere sotto la somma
 * delle mezze carreggiate** (144 per un'arteria), o due gambe parallele si mangiano
 * l'asfalto. `closed` chiude l'anello con due lati assiali.
 */
export function staircase(samples, { thr = 220, snap = 20, closed = false, start = 'h', exactEnd = false } = {}) {
  const q = (v) => Math.round(v / snap) * snap;
  const first = [q(samples[0][0]), q(samples[0][1])];
  const pts = [first];
  let mode = start;
  let fixed = mode === 'h' ? first[1] : first[0];
  let curX = first[0];
  let curY = first[1];
  for (let i = 1; i < samples.length; i++) {
    const sx = q(samples[i][0]);
    const sy = q(samples[i][1]);
    if (mode === 'h') {
      if (Math.abs(sy - fixed) > (samples[i][2] ? 0 : thr)) {
        pts.push([curX, fixed]);
        mode = 'v';
        fixed = curX;
        curY = sy;
      } else curX = sx;
    } else if (Math.abs(sx - fixed) > (samples[i][2] ? 0 : thr)) {
      pts.push([fixed, curY]);
      mode = 'h';
      fixed = curY;
      curX = sx;
    } else curY = sy;
  }
  const last = mode === 'h' ? [curX, fixed] : [fixed, curY];
  pts.push(last);
  if (exactEnd && !closed) {
    // L'ultimo campione è un punto d'attacco (un incrocio con un'altra strada): ci si
    // arriva esattamente, con un lato assiale in più se serve.
    const t = [q(samples[samples.length - 1][0]), q(samples[samples.length - 1][1])];
    if (mode === 'h') { pts.push([t[0], fixed]); if (fixed !== t[1]) pts.push(t); } else { pts.push([fixed, t[1]]); if (fixed !== t[0]) pts.push(t); }
  }
  if (closed) {
    if (last[0] !== first[0] && last[1] !== first[1]) pts.push(mode === 'h' ? [first[0], last[1]] : [last[0], first[1]]);
    pts.push(first);
  }
  const out = [];
  for (const p of pts) {
    const a = out[out.length - 1];
    if (a && a[0] === p[0] && a[1] === p[1]) continue;
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// STRADE DI SERVIZIO
// ---------------------------------------------------------------------------

/** Taglia i tratti di un tracciato a una finestra di ascisse: via i tronconi che sporgono. */
export function clipLegs(legs, x0, x1) {
  const out = [];
  for (const l of legs) {
    if (l.axis === 'h') {
      const a = Math.max(l.a, x0);
      const b = Math.min(l.b, x1);
      if (b - a > 40) out.push({ ...l, a, b });
    } else if (l.c >= x0 && l.c <= x1) out.push(l);
  }
  return out;
}

export const horizontalAt = (legs, x) => {
  let best = null;
  for (const l of legs) if (l.axis === 'h' && x >= l.a - 2 && x <= l.b + 2) if (!best || l.b - l.a > best.b - best.a) best = l;
  return best;
};

/**
 * Strade di campagna: ponti fra due tratti ortogonali già esistenti, su un
 * reticolo largo. Ogni candidata si scarta se esce dalla terra, sale sul cono,
 * corre parallela a un'altra strada più vicina di `clearance`, o attraversa una
 * zona riservata.
 */
export function farmRoads(legs, { axis, lattice, ok, minGap = 420, maxGap = 1900, clearance = 230 }) {
  const out = [];
  const cross = legs.filter((l) => l.axis !== axis);
  for (const c of lattice) {
    const hits = cross.filter((l) => c > l.a + 80 && c < l.b - 80).sort((p, q) => p.c - q.c);
    for (let i = 0; i + 1 < hits.length; i++) {
      const a = hits[i].c;
      const b = hits[i + 1].c;
      if (b - a < minGap || b - a > maxGap) continue;
      const near = legs.concat(out).some((l) => l.axis === axis && Math.abs(l.c - c) < clearance && Math.min(b, l.b) - Math.max(a, l.a) > 80);
      if (near || !ok(axis, c, a, b)) continue;
      out.push({ axis, c, a, b, arterial: false });
    }
  }
  return out;
}

