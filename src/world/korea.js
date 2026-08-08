// La Corea di Seoul Crashers è **una mappa sola**. Seoul, Busan e Jeju non sono
// più tre mondi che si escludono: sono tre porzioni dello stesso spazio di
// coordinate, disposte come stanno davvero (Seoul a nord-ovest, Busan a
// sud-est, Jeju al largo, a sud), collegate dall'autostrada Gyeongbu e separate
// dal mare dove il mare c'è per davvero.
//
// I tre generatori restano intatti e continuano a lavorare in coordinate locali:
// qui si traslano i **dati** (edifici, isolati, maglia, grafo) nello spazio di
// mondo e si lasciano invece **locali** i pochi campi che le loro funzioni
// geografiche leggono per riferimento (`piers`, `river`, `coastAt`, `w`, `h`).
// È l'unico modo di riusare `isWater` e `elevationAt` di ciascuna regione senza
// riscriverli: le funzioni composte qui sotto convertono mondo → locale e
// delegano. Tradurre anche quei campi le romperebbe in silenzio.
import { Rng } from '../core/rng.js';
import { SpatialGrid } from '../core/spatial.js';
import { generateCity } from './citygen.js';
import { DISTRICTS as SEOUL_DISTRICTS } from './districts.js';
import { expandSeoul } from './seoul_expansion.js';
import { createBusanCity } from './busan.js';
import { createJejuCity } from './jeju.js';

// Dimensione del mondo unificato. Le tre città conservano la taglia che avevano;
// quello che si aggiunge è la campagna del corridoio e il mare del sud.
export const KOREA = { w: 16800, h: 24000 };

// Le origini rispettano gli orientamenti reali: Busan è a sud-est di Seoul, Jeju
// è a sud-ovest di Busan e staccata dalla terraferma. Le distanze sono
// compresse — come tutto il resto del gioco, dove 12 px valgono un metro — ma i
// rapporti restano leggibili su una carta.
export const AREAS = [
  { id: 'seoul', name: 'Seoul', hangul: '서울', x: 0, y: 0 },
  { id: 'busan', name: 'Busan', hangul: '부산', x: 9600, y: 10400 },
  { id: 'jeju', name: 'Jeju', hangul: '제주', x: 3200, y: 17800 },
];

// Quota dell'autostrada Gyeongbu nel corridoio: sta fra il bordo sud di Seoul
// (7200) e il bordo nord di Busan (10400), cioè in aperta campagna.
const EXPRESSWAY_Y = 9200;
const EXPRESSWAY_W = 144;

const sm = (t) => { const u = t < 0 ? 0 : t > 1 ? 1 : t; return u * u * (3 - 2 * u); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function hashNoise(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = sm(x - xi);
  const v = sm(y - yi);
  const a = hashNoise(xi, yi, s);
  const b = hashNoise(xi + 1, yi, s);
  const c = hashNoise(xi, yi + 1, s);
  const d = hashNoise(xi + 1, yi + 1, s);
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return top + (bot - top) * v;
}

// ---------------------------------------------------------------------------
// TRASLAZIONE
// ---------------------------------------------------------------------------

/**
 * Sposta nello spazio di mondo tutto quello che il gioco *disegna e interroga*
 * di una regione. Non tocca `piers`, `river`, `coastAt`, `waterX/quayX`, `w/h`:
 * sono i riferimenti che le closure geografiche della regione leggono a ogni
 * chiamata, e restano in coordinate locali per costruzione (vedi l'intestazione).
 * Il `WeakSet` serve perché il grafo di oggetti è pieno di alias — il cortile di
 * un isolato è anche uno dei suoi `yards`, il territorio di una banda è il
 * cortile su cui è dipinto — e spostarne uno due volte lo manderebbe altrove.
 */
function shiftCity(city, dx, dy) {
  const seen = new WeakSet();
  const mv = (o) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (typeof o.x === 'number') o.x += dx;
    if (typeof o.y === 'number') o.y += dy;
  };
  const mvAll = (arr) => { for (const o of arr || []) mv(o); };

  mvAll(city.buildings);
  mvAll(city.props);
  mvAll(city.landmarks);
  mvAll(city.hospitals);
  mvAll(city.stations);
  mvAll(city.shops);
  mvAll(city.runways);
  mvAll(city.taxiways);
  mvAll(city.aprons);
  mvAll(city.helipads);
  mvAll(city.airSpots);
  mvAll(city.boatSpots);
  mvAll(city.stairs);
  mvAll(city.crosswalks);
  mvAll(city.intersections);
  mv(city.spawn);

  for (const b of city.blocks || []) {
    mv(b);
    mvAll(b.yards);
    mvAll(b.alleys);
    mvAll(b.fields);
    mv(b.courtyard);
  }
  for (const t of city.turfs || []) { mv(t); t.cx += dx; t.cy += dy; }
  for (const g of city.garages || []) { mv(g); g.cx += dx; g.cy += dy; mv(g.door); }
  for (const s of city.transitStations || []) {
    mv(s);
    if (typeof s.arrivalX === 'number') { s.arrivalX += dx; s.arrivalY += dy; }
  }
  for (const e of city.metroEntrances || []) {
    mv(e);
    if (typeof e.approachX === 'number') { e.approachX += dx; e.approachY += dy; }
  }

  // `marks` viaggia con `segments`: sono le stesse coordinate lungo la linea.
  // Dimenticarne uno dei due lascia la segnaletica dove la città *era*, cioè
  // sparsa in mezzo alla campagna e sul mare, senza un pixel di asfalto sotto.
  for (const l of city.vLines || []) {
    l.c += dx;
    for (const s of l.segments) { s[0] += dy; s[1] += dy; }
    for (const m of l.marks || []) { m[0] += dy; m[1] += dy; }
  }
  for (const l of city.hLines || []) {
    l.c += dy;
    for (const s of l.segments) { s[0] += dx; s[1] += dx; }
    for (const m of l.marks || []) { m[0] += dx; m[1] += dx; }
  }

  for (const n of city.graph.nodes) { n.x += dx; n.y += dy; }
  for (const e of city.graph.edges) { e.ax += dx; e.ay += dy; e.bx += dx; e.by += dy; }
}

/**
 * I tratti su cui va disegnata la segnaletica: fra un incrocio e il successivo,
 * non da capo a fondo linea. Prima li ricavava il renderer leggendo `on[]` con
 * l'indice della perpendicolare — un'informazione che smette di avere senso
 * appena le maglie di tre città finiscono nello stesso array. Si calcolano qui,
 * finché gli indici sono ancora quelli della regione, e poi viaggiano con la
 * linea come i suoi `segments`.
 */
function buildLaneMarks(city) {
  const axis = (lines, perp) => {
    for (const l of lines) {
      l.marks = [];
      if (!l.on) { for (const [a, b] of l.segments) l.marks.push([a, b]); continue; }
      for (let j = 0; j < l.on.length && j < perp.length - 1; j++) {
        if (!l.on[j]) continue;
        const a = perp[j].c + perp[j].width / 2;
        const b = perp[j + 1].c - perp[j + 1].width / 2;
        if (b > a) l.marks.push([a, b]);
      }
    }
  };
  axis(city.vLines, city.hLines);
  axis(city.hLines, city.vLines);
}

// ---------------------------------------------------------------------------
// GEOGRAFIA FUORI DALLE CITTÀ
// ---------------------------------------------------------------------------
// Fuori dai tre rettangoli non c'è un generatore: c'è un profilo di coste
// scritto a mano. Vale la stessa regola della sagoma di Seoul (§3, «la forma
// della città è un campo»): a valle nessuno sa niente di forme, si legge solo
// questa maschera. Le curve sono scelte perché combacino con il bordo delle
// città — una costa che sconfina di mille pixel si vede subito come un taglio.

function makeGeography(seoul) {
  const seoulCoastEnd = seoul.coastAt(seoul.h - 1);
  const busan = AREAS[1];
  const hanMid = (seoul.river.y0 + seoul.river.y1) / 2;
  const hanHalf = (seoul.river.y1 - seoul.river.y0) / 2;

  // Costa occidentale: riprende esattamente la battigia di Seoul dove la mappa
  // della capitale finisce, poi scende verso sud allargandosi.
  const westCoast = (y) => seoulCoastEnd + 1000 * sm((y - seoul.h) / 6500)
    + 280 * Math.sin((y - seoul.h) / 950);
  // Costa meridionale: la penisola finisce qui, e sotto c'è solo il mare che
  // separa la terraferma da Jeju.
  const southCoast = (x) => 14200 + 1900 * sm((x - 1500) / 11000) + 400 * Math.sin(x / 1600 + 0.7);
  // Costa orientale (Mar dell'Est): stretta a nord, larga all'altezza di Busan.
  const eastCoast = (y) => Math.min(KOREA.w - 120, 13000 + 3400 * sm((y - 1000) / 9000)
    + 320 * Math.sin(y / 1300));
  // La baia di Jinhae, a ovest di Busan: senza, l'acqua che Busan ha sul proprio
  // bordo occidentale finirebbe contro una parete di terra dritta.
  const bayWest = (y) => busan.x - (300 + 1500 * sm((y - busan.y) / 2600));

  const seaAt = (x, y) => {
    if (x < westCoast(y)) return true;
    if (y > southCoast(x)) return true;
    if (x > eastCoast(y)) return true;
    if (y > busan.y && x < busan.x && x > bayWest(y)) return true;
    // La coda del Han a est di Seoul: il fiume non può interrompersi sul bordo
    // di un rettangolo, quindi si assottiglia fino a sparire fra le colline.
    if (x >= seoul.w && x < seoul.w + 1300) {
      const half = hanHalf * (1 - (x - seoul.w) / 1300);
      if (Math.abs(y - hanMid) < half) return true;
    }
    return false;
  };

  // Rilievo di campagna: la dorsale dei Taebaek segue la costa orientale, ed è
  // quello che rende il corridoio Seoul-Busan un viaggio invece di una pianura.
  const ruralElevation = (x, y) => {
    const ridge = eastCoast(y) - 1900;
    const dn = Math.abs(x - ridge) / 1500;
    let e = 34 + (valueNoise(x / 900, y / 900, 0x51a3) - 0.5) * 44;
    if (dn < 1) e += 210 * sm(1 - dn);
    e += (valueNoise(x / 380, y / 380, 0x7c1f) - 0.5) * 18;
    return e < 0 ? 0 : e;
  };

  const ruralUrbanity = (x, y) => clamp(0.05 + (valueNoise(x / 1100, y / 1100, 0x2b71) - 0.5) * 0.08, 0, 1);

  return { seaAt, ruralElevation, ruralUrbanity, westCoast, southCoast, eastCoast };
}

// Tre identità per la campagna. L'`id` resta uno dei sette canonici perché è la
// chiave con cui i mercati e le statistiche indicizzano il mondo: quello che
// cambia è il nome che il giocatore legge sul cartello.
function countryDistricts() {
  const base = {
    id: 'gyeonggi',
    block: { minLot: 150, maxLot: 320, gapChance: 0.4 },
    grid: { step: [340, 620], superblock: 0.6, jog: 0.05 },
    heights: [20, 56], styles: ['brick', 'warehouse', 'greenhouse'],
    facade: ['#7c7358', '#6a6f54', '#847a61', '#5d6d54'], roof: '#454b38',
    signDensity: 0.08, treeDensity: 0.5,
    trafficDensity: 0.34, pedDensity: 0.12,
    pedMix: ['worker', 'civil', 'civil', 'tourist'],
    vehicleMix: ['truck', 'truck', 'van', 'sedan', 'bus', 'tractor'],
  };
  return [
    {
      ...base, name: 'Chungcheong', hangul: '충청', subtitle: 'Il corridoio della Gyeongbu, fra risaie e caselli',
      accent: '#a7e45a', accent2: '#ffd05a', ground: '#333a26', sidewalk: '#4f5542',
      seed: { x: 7600 / KOREA.w, y: 9200 / KOREA.h },
    },
    {
      ...base, name: 'Honam', hangul: '호남', subtitle: 'Pianure, serre e strade bianche verso il mare',
      accent: '#8fd07a', accent2: '#ffc04c', ground: '#31391f', sidewalk: '#4c5240',
      seed: { x: 3200 / KOREA.w, y: 12200 / KOREA.h },
    },
    {
      ...base, name: 'Gangwon', hangul: '강원', subtitle: 'La dorsale dei Taebaek e i passi verso l’est',
      accent: '#7fd3c0', accent2: '#e0e6a0', ground: '#2c3728', sidewalk: '#4a5347',
      seed: { x: 12600 / KOREA.w, y: 4200 / KOREA.h },
    },
  ];
}

// ---------------------------------------------------------------------------
// GRAFO UNIFICATO
// ---------------------------------------------------------------------------

function mergeGraphs(parts, w, h) {
  const nodes = [];
  const edges = [];
  for (const part of parts) {
    for (const n of part.city.graph.nodes) { n.id = nodes.length; nodes.push(n); }
  }
  for (const part of parts) {
    for (const e of part.city.graph.edges) {
      // `a`/`b` erano indici nella numerazione della regione: si rileggono dai
      // nodi, che hanno appena ricevuto quella del mondo.
      e.a = part.city.graph.nodes[e.a].id;
      e.b = part.city.graph.nodes[e.b].id;
      e.id = edges.length;
      edges.push(e);
    }
  }
  return finishGraph(nodes, edges, w, h);
}

function finishGraph(nodes, edges, w, h) {
  const usable = nodes.filter((n) => n.out.length > 0);
  const edgeGrid = new SpatialGrid(w, h, 320);
  for (const e of edges) {
    edgeGrid.insertRect({
      x: Math.min(e.ax, e.bx) - 20,
      y: Math.min(e.ay, e.by) - 20,
      w: Math.abs(e.bx - e.ax) + 40,
      h: Math.abs(e.by - e.ay) + 40,
      edge: e,
    });
  }
  // Il nodo più vicino serve allo sbloccaggio del traffico e agli inseguimenti:
  // su un mondo lungo 24.000 px una scansione lineare di tutti i nodi comincia a
  // pesare, quindi si passa dallo stesso indice spaziale degli archi.
  const nodeGrid = new SpatialGrid(w, h, 320);
  for (const n of usable) nodeGrid.insertRect({ x: n.x - 2, y: n.y - 2, w: 4, h: 4, node: n });

  return {
    nodes,
    usableNodes: usable,
    edges,
    edgeGrid,
    nodeById: (id) => nodes[id],

    edgesNear(x, y, r, out = []) {
      const hits = edgeGrid.queryRect(x - r, y - r, r * 2, r * 2);
      out.length = 0;
      for (const hit of hits) out.push(hit.edge);
      return out;
    },

    randomLane(rng) {
      const edge = rng.pick(edges);
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = rng.int(0, (edge.arterial ? 2 : 1) - 1);
      return { edge, dir, lane };
    },

    nextLane(node, fromEdge, rng) {
      const opts = node.out.filter((o) => o.edge !== fromEdge);
      if (opts.length === 0) {
        const back = node.out.find((o) => o.edge === fromEdge);
        return back ? { edge: back.edge, dir: back.dir } : null;
      }
      const straight = opts.filter((o) => o.edge.axis === fromEdge.axis);
      const pool = straight.length && rng.chance(0.62) ? straight : opts;
      const o = rng.pick(pool);
      return { edge: o.edge, dir: o.dir };
    },

    nearestNode(x, y) {
      for (let r = 400; r <= 4800; r *= 2) {
        const hits = nodeGrid.queryRect(x - r, y - r, r * 2, r * 2);
        let best = null;
        let bd = Infinity;
        for (const hit of hits) {
          const d = (hit.node.x - x) ** 2 + (hit.node.y - y) ** 2;
          if (d < bd) { bd = d; best = hit.node; }
        }
        if (best) return best;
      }
      return usable[0];
    },
  };
}

function makeNode(id, x, y) {
  return {
    id, x, y, vi: -1, hi: -1,
    vWidth: EXPRESSWAY_W, hWidth: EXPRESSWAY_W,
    arterial: true,
    // Niente lanterne in autostrada: un semaforo su una carreggiata a scorrimento
    // veloce fermerebbe il traffico in mezzo alla campagna, senza nessuno che
    // debba attraversare.
    signal: false,
    tOffset: 0,
    claimAxis: null,
    claimT: -99,
    out: [],
  };
}

function connect(edges, na, nb, axis) {
  const dxRaw = nb.x - na.x;
  const dyRaw = nb.y - na.y;
  const len = Math.hypot(dxRaw, dyRaw);
  if (len < 1) return null;
  const edge = {
    id: edges.length,
    a: na.id, b: nb.id,
    ax: na.x, ay: na.y, bx: nb.x, by: nb.y,
    dx: dxRaw / len, dy: dyRaw / len,
    len,
    angle: Math.atan2(dyRaw, dxRaw),
    axis,
    arterial: true,
    width: EXPRESSWAY_W,
  };
  edges.push(edge);
  na.out.push({ edge, dir: 1, angle: edge.angle });
  nb.out.push({ edge, dir: -1, angle: edge.angle + Math.PI });
  return edge;
}

/**
 * Nodo d'innesto dell'autostrada su una regione: il più vicino al bordo dentro
 * una finestra di ascisse, **e** con lo stub verso la campagna libero da
 * landmark. Sui volumi ordinari il casello passa sopra e `regions.reindex` li
 * toglie — è quello che succede quando si buca una città con un'autostrada — ma
 * un landmark non si demolisce: lì l'innesto si sposta di una linea.
 */
function borderNode(city, { minX, maxX, south, edgeY, water }) {
  const inWindow = city.graph.usableNodes.filter((n) => n.x >= minX && n.x <= maxX);
  // L'innesto va su un'**arteria**. Attaccare una carreggiata da 144 px a una via
  // secondaria da 76 produce esattamente lo scalino che si vede a schermo, e le
  // corsie della corsia esterna (offset 54) finirebbero fuori dall'asfalto.
  const arterials = inWindow.filter((n) => n.vWidth >= 120);
  const ranked = (arterials.length ? arterials : inWindow)
    .sort((a, b) => (south ? b.y - a.y : a.y - b.y));
  for (const n of ranked) {
    const y0 = Math.min(n.y, edgeY);
    const stub = { x: n.x - EXPRESSWAY_W / 2, y: y0, w: EXPRESSWAY_W, h: Math.abs(edgeY - n.y) + 2 };
    const hitsLandmark = city.buildings.some((b) => b.landmark && b.solid !== false
      && stub.x < b.x + b.w && stub.x + stub.w > b.x && stub.y < b.y + b.h && stub.y + stub.h > b.y);
    if (hitsLandmark) continue;
    if (water && water(n.x, (n.y + edgeY) / 2)) continue;
    return n;
  }
  return ranked[0] || null;
}

/**
 * L'autostrada Gyeongbu (경부고속도로). È fatta di tre rettilinei ortogonali
 * perché tutta la geometria del gioco lo è: una diagonale non avrebbe né
 * carreggiata disegnata (`vLines`/`hLines` sono assi) né corsie. Non è una
 * scorciatoia fra due menu — è un arco del grafo come tutti gli altri, quindi ci
 * passano il traffico civile, le volanti e chiunque insegua qualcuno.
 */
function addExpressway(korea, parts) {
  const seoul = parts[0];
  const busan = parts[1];
  const wet = (x, y) => korea.isWater(x, y);
  const exit = borderNode(seoul.city, {
    minX: seoul.x + 3400, maxX: seoul.x + 6200, south: true, edgeY: seoul.y + seoul.city.h, water: wet,
  });
  const entry = borderNode(busan.city, {
    minX: busan.x + 1500, maxX: busan.x + 4600, south: false, edgeY: busan.y, water: wet,
  });
  if (!exit || !entry) return null;

  const nodes = korea.graph.nodes;
  const edges = korea.graph.edges;
  const bendA = makeNode(nodes.length, exit.x, EXPRESSWAY_Y);
  nodes.push(bendA);
  const bendB = makeNode(nodes.length, entry.x, EXPRESSWAY_Y);
  nodes.push(bendB);

  connect(edges, exit, bendA, 'v');
  connect(edges, bendA, bendB, 'h');
  connect(edges, bendB, entry, 'v');

  // Ogni tratto **sborda di mezza carreggiata dentro l'altro**: senza, all'angolo
  // resta un quadrante di terra grande quanto un quarto di incrocio, ed è la
  // giunzione sfasata che si vede guidando. La larghezza la detta la città a cui
  // il tratto si attacca, così non c'è nessuno scalino sul bordo.
  const wExit = exit.vWidth || EXPRESSWAY_W;
  const wEntry = entry.vWidth || EXPRESSWAY_W;
  const half = EXPRESSWAY_W / 2;
  const line = (c, width, from, to, markPad) => {
    const a = Math.min(from, to);
    const b = Math.max(from, to);
    return {
      c, width, arterial: true, keep: true, expressway: true,
      segments: [[a, b]],
      // La segnaletica si ferma prima dell'angolo, come in ogni altro incrocio.
      marks: b - a > markPad * 2 ? [[a + markPad, b - markPad]] : [],
      on: null,
    };
  };
  korea.vLines.push(line(exit.x, wExit, exit.y, EXPRESSWAY_Y + half, half + 8));
  korea.hLines.push(line(
    EXPRESSWAY_Y, EXPRESSWAY_W,
    Math.min(exit.x, entry.x) - wExit / 2, Math.max(exit.x, entry.x) + wEntry / 2,
    Math.max(wExit, wEntry) / 2 + 8
  ));
  korea.vLines.push(line(entry.x, wEntry, EXPRESSWAY_Y - half, entry.y, half + 8));

  return { exit, entry, bendA, bendB };
}

/**
 * Due aree di servizio (휴게소) lungo la Gyeongbu. Un'autostrada di settemila
 * pixel senza niente da guardare è un corridoio, non un viaggio: bastano un
 * piazzale, un edificio e qualche albero perché il corridoio abbia due punti in
 * cui si può accostare.
 */
function addRestStops(korea, route, district) {
  if (!route) return;
  const rng = new Rng(0x9e5701);
  const x0 = Math.min(route.bendA.x, route.bendB.x);
  const x1 = Math.max(route.bendA.x, route.bendB.x);
  for (const t of [0.3, 0.68]) {
    const cx = x0 + (x1 - x0) * t;
    const side = t < 0.5 ? -1 : 1;
    const y = EXPRESSWAY_Y + side * (EXPRESSWAY_W / 2 + 150);
    const block = {
      x: cx - 300, y: y - 110, w: 600, h: 220,
      type: 'urban', district: district.id, districtRef: district,
      onArterial: true, yards: [], alleys: [], restStop: true,
    };
    block.yards.push({ x: block.x + 16, y: block.y + 16, w: block.w - 32, h: block.h - 32 });
    korea.blocks.push(block);
    korea.buildings.push({
      x: cx - 110, y: y - 52, w: 220, h: 104,
      h3d: 46, elev: 0, style: 'glass', color: '#6f7d85', roofColor: '#3c464d',
      variant: 1, litSeed: rng.int(0, 9999), district: district.id, districtRef: district,
      solid: true, edges: [side < 0 ? 'bottom' : 'top'], landmark: false, ac: 1, water: false,
      signs: [{ edge: side < 0 ? 'bottom' : 'top', t: 0.5, word: '휴게소', color: '#ffd05a', vertical: false, h: 0.6 }],
      region: 'korea',
    });
    for (let i = 0; i < 6; i++) {
      korea.props.push({
        type: 'lamp', x: block.x + 60 + i * 96, y: y + side * 88, rot: 0, z: 96, solid: false, r: 6,
      });
      korea.props.push({
        type: 'tree', x: block.x + 40 + i * 104, y: y - side * 92, rot: rng.range(0, 6.28),
        z: rng.range(52, 78), solid: false, r: 12, tint: rng.int(0, 2),
      });
    }
    korea.props.push({ type: 'vending', x: cx + 140, y, rot: 0, z: 34, solid: true, r: 12 });
    korea.props.push({ type: 'bin', x: cx + 168, y, rot: 0, z: 22, solid: false, r: 9 });
    korea.landmarks.push({
      id: `gyeongbu-rest-${t}`, name: 'Area di servizio Gyeongbu', hangul: '경부고속도로 휴게소',
      label: 'Area di servizio', kind: 'service', district: district.id, region: 'korea', x: cx, y,
    });
  }
}

// ---------------------------------------------------------------------------
// COSTRUZIONE
// ---------------------------------------------------------------------------

function buildSeoul() {
  const city = generateCity(20260730);
  city.region = { id: 'seoul', name: 'Seoul', hangul: '서울' };
  city.name = 'Seoul';
  city.hangul = '서울';
  city.districts = SEOUL_DISTRICTS;
  city.districtById = Object.fromEntries(SEOUL_DISTRICTS.map((d) => [d.id, d]));
  expandSeoul(city);
  return city;
}

function cloneDistrict(d, area, subW, subH) {
  return {
    ...d,
    // Il seme di un distretto adesso è normalizzato **sul mondo**: è la
    // coordinata con cui la carta ci scrive sopra l'etichetta.
    seed: { x: (area.x + d.seed.x * subW) / KOREA.w, y: (area.y + d.seed.y * subH) / KOREA.h },
    region: area.id,
    regionName: area.name,
    regionHangul: area.hangul,
  };
}

const CONCAT = [
  'buildings', 'props', 'blocks', 'landmarks', 'hospitals', 'stations', 'shops',
  'garages', 'turfs', 'crosswalks', 'intersections', 'runways', 'taxiways',
  'aprons', 'helipads', 'airSpots', 'boatSpots', 'stairs', 'transitStations',
  'metroEntrances',
];

/** Costruisce la mappa unica: tre città, un corridoio, un mare solo. */
export function createKorea() {
  const parts = [
    { ...AREAS[0], city: buildSeoul() },
    { ...AREAS[1], city: createBusanCity() },
    { ...AREAS[2], city: createJejuCity() },
  ];

  const geo = makeGeography(parts[0].city);

  // I distretti si clonano prima di traslare: quelli di Seoul sono gli oggetti
  // globali di `districts.js`, e riscriverne il seme corromperebbe il modulo.
  const districtOf = new Map();
  const districts = [];
  for (const part of parts) {
    for (const d of part.city.districts) {
      const clone = cloneDistrict(d, part, part.city.w, part.city.h);
      districtOf.set(d, clone);
      districts.push(clone);
    }
  }
  const country = countryDistricts();
  districts.push(...country);

  // `citygen` chiude Seoul con una cintura di volumi solidi sui quattro margini:
  // era il limite del mondo quando Seoul *era* il mondo. Qui a sud e a est di
  // quel bordo c'è la campagna, e la cintura diventa un muro invisibile che
  // impedisce di uscire dalla capitale in auto — che è esattamente quello che
  // questa tappa esiste per permettere. Il limite del mondo adesso è uno solo, e
  // lo mette `regions.reindex` ai bordi della Corea.
  const seoulCity = parts[0].city;
  seoulCity.buildings = seoulCity.buildings.filter((b) => !b.isBelt);

  for (const part of parts) {
    buildLaneMarks(part.city);
    shiftCity(part.city, part.x, part.y);
  }

  const areas = parts.map((p) => ({
    id: p.id, name: p.name, hangul: p.hangul, city: p.city,
    x0: p.x, y0: p.y, x1: p.x + p.city.w, y1: p.y + p.city.h,
  }));
  const areaAt = (x, y) => {
    for (let i = 0; i < areas.length; i++) {
      const a = areas[i];
      if (x >= a.x0 && x < a.x1 && y >= a.y0 && y < a.y1) return a;
    }
    return null;
  };

  const korea = {
    w: KOREA.w, h: KOREA.h, seed: 20260730,
    region: { id: 'korea', name: 'Corea', hangul: '대한민국' },
    name: 'Corea', hangul: '대한민국',
    areas, areaAt,
    districts,
    districtById: {},
    vLines: [], hLines: [],
    riverCell: -1, coastIdx: 0, doglegs: 0,
  };
  for (const d of districts) if (!korea.districtById[d.id]) korea.districtById[d.id] = d;
  korea.getDistrict = (id) => korea.districtById[id] || null;

  for (const key of CONCAT) korea[key] = [];
  for (const part of parts) {
    for (const key of CONCAT) {
      for (const item of part.city[key] || []) korea[key].push(item);
    }
    for (const l of part.city.vLines) korea.vLines.push(l);
    for (const l of part.city.hLines) korea.hLines.push(l);
  }

  // `piers`, `river` e i limiti dell'acqua di ogni regione restano locali perché
  // le loro `isWater` li leggono: al mondo servono delle copie già traslate.
  korea.piers = [];
  for (const part of parts) {
    for (const p of part.city.piers || []) {
      korea.piers.push({ ...p, x: p.x + part.x, y: p.y + part.y, region: part.id });
    }
  }
  const seoulPart = parts[0];
  const seoulRiver = seoulPart.city.river;
  korea.river = {
    ...seoulRiver,
    y0: seoulRiver.y0 + seoulPart.y,
    y1: seoulRiver.y1 + seoulPart.y,
    bridges: (seoulRiver.bridges || []).map((b) => ({ ...b, x: b.x + seoulPart.x })),
  };
  // Seoul conserva il disegno editoriale del Han e del mare occidentale: il
  // renderer lo usa solo dentro questo rettangolo, e altrove campiona `isWater`.
  korea.seoulArea = {
    x0: seoulPart.x, y0: seoulPart.y,
    x1: seoulPart.x + seoulPart.city.w, y1: seoulPart.y + seoulPart.city.h,
    river: korea.river,
    coastAt: (y) => seoulPart.city.coastAt(y - seoulPart.y) + seoulPart.x,
    quayX: seoulPart.city.quayX + seoulPart.x,
    waterX: seoulPart.city.waterX + seoulPart.x,
  };
  korea.coastAt = korea.seoulArea.coastAt;
  korea.quayX = korea.seoulArea.quayX;
  korea.waterX = korea.seoulArea.waterX;
  korea.airport = null;
  korea.port = null;

  // --- campi geografici composti ---------------------------------------------
  korea.isWater = (x, y) => {
    const a = areaAt(x, y);
    return a ? a.city.isWater(x - a.x0, y - a.y0) : geo.seaAt(x, y);
  };
  korea.elevationAt = (x, y) => {
    const a = areaAt(x, y);
    if (a) return a.city.elevationAt(x - a.x0, y - a.y0);
    if (geo.seaAt(x, y)) return 0;
    let e = geo.ruralElevation(x, y);
    // Raccordo con il bordo delle città: senza, l'hillshade disegnerebbe una
    // riga netta tutt'attorno a ogni rettangolo.
    for (const b of areas) {
      const dx = Math.max(b.x0 - x, 0, x - b.x1);
      const dy = Math.max(b.y0 - y, 0, y - b.y1);
      const d = Math.hypot(dx, dy);
      if (d >= 560) continue;
      const w = sm(d / 560);
      const cx = clamp(x, b.x0 + 6, b.x1 - 6);
      const cy = clamp(y, b.y0 + 6, b.y1 - 6);
      e = e * w + b.city.elevationAt(cx - b.x0, cy - b.y0) * (1 - w);
    }
    return e;
  };
  korea.urbanAt = (x, y) => {
    const a = areaAt(x, y);
    return a ? a.city.urbanAt(x - a.x0, y - a.y0) : geo.ruralUrbanity(x, y);
  };
  korea.districtAt = (x, y) => {
    const a = areaAt(x, y);
    if (a) return districtOf.get(a.city.districtAt(x - a.x0, y - a.y0)) || districts[0];
    if (x > geo.eastCoast(y) - 2600) return country[2];
    if (y > 11200 || x < 3200) return country[1];
    return country[0];
  };
  korea.districtAtNorm = (nx, ny) => korea.districtAt(nx * KOREA.w, ny * KOREA.h);
  // Su tre maglie messe insieme la scansione lineare delle linee smette di
  // essere gratis: la stessa domanda («questo rettangolo invade una strada?»)
  // arriva una volta per edificio e una per prop. Le carreggiate finiscono
  // quindi in un indice spaziale, e `roadclearance` lo usa se c'è.
  korea.isOnRoad = (x, y) => {
    const hits = korea.roadIndex.queryRect(x - 1, y - 1, 2, 2);
    for (const r of hits) {
      if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
    }
    return false;
  };

  // --- grafo, autostrada, aree di servizio -----------------------------------
  korea.graph = mergeGraphs(parts, KOREA.w, KOREA.h);
  const route = addExpressway(korea, parts);
  addRestStops(korea, route, country[0]);
  korea.expressway = route ? { y: EXPRESSWAY_Y, exit: route.exit, entry: route.entry } : null;
  // Gli archi nuovi vanno indicizzati insieme agli altri.
  korea.graph = finishGraph(korea.graph.nodes, korea.graph.edges, KOREA.w, KOREA.h);

  korea.roadIndex = new SpatialGrid(KOREA.w, KOREA.h, 420);
  for (const l of korea.vLines) {
    for (const [a, b] of l.segments) {
      korea.roadIndex.insertRect({ x: l.c - l.width / 2, y: a, w: l.width, h: b - a });
    }
  }
  for (const l of korea.hLines) {
    for (const [a, b] of l.segments) {
      korea.roadIndex.insertRect({ x: a, y: l.c - l.width / 2, w: b - a, h: l.width });
    }
  }

  // --- riferimenti diretti che tolgono ricerche a ogni frame -----------------
  for (const part of parts) {
    const byCell = new Map();
    for (const n of part.city.graph.nodes) byCell.set(`${n.vi},${n.hi}`, n);
    for (const i of part.city.intersections || []) i.node = byCell.get(`${i.vi},${i.hi}`) || null;
  }
  for (const b of korea.blocks) {
    if (!b.districtRef) b.districtRef = korea.districtAt(b.x + b.w / 2, b.y + b.h / 2);
  }
  for (const part of parts) {
    for (const s of part.city.transitStations || []) {
      s.region = part.id;
      s.regionName = part.name;
      s.regionHangul = part.hangul;
    }
  }

  korea.spawn = { ...parts[0].city.spawn };
  korea.stats = {
    buildings: korea.buildings.length,
    props: korea.props.length,
    blocks: korea.blocks.length,
    nodes: korea.graph.usableNodes.length,
    edges: korea.graph.edges.length,
    doglegs: parts.reduce((n, p) => n + (p.city.doglegs || 0), 0),
    stairs: korea.stairs.length,
    shops: korea.shops.length,
    venues: korea.shops.reduce((n, s) => n + (s.biz?.length || 0), 0),
    garages: korea.garages.length,
    rural: korea.blocks.filter((b) => b.type === 'rural').length,
    piers: korea.piers.length,
    turfs: korea.turfs.length,
    landmarks: korea.landmarks.length,
    transitStations: korea.transitStations.length,
    areas: areas.length,
  };
  return korea;
}
