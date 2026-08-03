// Generazione procedurale (deterministica) di Seoul: strade, fiume Han, isolati,
// edifici estrusi, container, arredo urbano, rilievo del terreno.
import { Rng } from '../core/rng.js';
import { SpatialGrid } from '../core/spatial.js';
import { clamp, smoothstep } from '../core/math.js';
import { DISTRICTS, districtAtNorm, RIVER, NAMSAN, SIGN_WORDS } from './districts.js';
import { buildRoadGraph } from './roadgraph.js';

export const WORLD = { w: 4200, h: 4200, margin: 150 };
export const SIDEWALK = 20; // profondità marciapiede attorno a ogni isolato

// ---------------------------------------------------------------------------
// RILIEVO
// ---------------------------------------------------------------------------
// Campo di quota deterministico, campionabile ovunque e senza allocazioni: lo
// usano il hillshade del terreno, l'altezza di proiezione dei volumi e la fisica
// delle salite. Il terreno *disegnato* resta in pianta (deformarlo vorrebbe dire
// rinunciare alla cache dei tile): il rilievo si legge dall'ombreggiatura e da
// quanto i palazzi si "aprono".

function hashNoise(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smoothstep(x - xi);
  const v = smoothstep(y - yi);
  const a = hashNoise(xi, yi, s);
  const b = hashNoise(xi + 1, yi, s);
  const c = hashNoise(xi, yi + 1, s);
  const d = hashNoise(xi + 1, yi + 1, s);
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return top + (bot - top) * v;
}

/** Quota del terreno in un punto, 0 sul Han e fino a ~145 sul Namsan. */
export function makeElevation(w, h, seed) {
  const ry0 = RIVER.y0 * h;
  const ry1 = RIVER.y1 * h;
  const nsx = NAMSAN.x * w;
  const nsy = NAMSAN.y * h;
  const nsr = NAMSAN.r * w * 2.8;
  const s1 = seed & 0xffff;
  const s2 = (seed >> 5) & 0xffff;
  return function elevationAt(x, y) {
    // Il Han è la quota zero e resta il punto più basso: il terreno sale allontanandosene.
    const d = y < ry0 ? ry0 - y : y > ry1 ? y - ry1 : 0;
    if (d <= 0) return 0;
    const t = smoothstep(clamp(d / 1250, 0, 1));
    let e = 34 * t;
    e += (valueNoise(x / 940, y / 940, s1) - 0.5) * 46 * t;
    e += (valueNoise(x / 380, y / 380, s2) - 0.5) * 16 * t;
    const dn = Math.hypot(x - nsx, y - nsy) / nsr;
    if (dn < 1) e += 110 * smoothstep(1 - dn);
    return e < 0 ? 0 : e;
  };
}

// ---------------------------------------------------------------------------
// MAGLIA STRADALE
// ---------------------------------------------------------------------------

/**
 * Parametri di maglia lungo un asse. Il passo globale segue il distretto **più
 * fitto** attraversato dalla linea: una maglia fitta si può diradare togliendo
 * tratti (superblocchi), una larga non si può infittire a posteriori.
 */
function meshAt(n, axis) {
  const probes = [0.12, 0.28, 0.44, 0.74, 0.9];
  let lo = Infinity;
  let hi = Infinity;
  let jog = 0;
  for (const t of probes) {
    const d = axis === 'v' ? districtAtNorm(n, t) : districtAtNorm(t, n);
    if (d.grid.step[0] < lo) lo = d.grid.step[0];
    if (d.grid.step[1] < hi) hi = d.grid.step[1];
    jog += d.grid.jog;
  }
  return { lo, hi, jog: jog / probes.length };
}

/** Genera l'asse stradale: linee con centro, larghezza e flag arteriale. */
function genLines(rng, extent, margin, axis) {
  const lines = [];
  let pos = margin;
  let i = 0;
  while (pos < extent - margin - 260) {
    const arterial = i % 3 === 2;
    const width = arterial ? 144 : 76;
    lines.push({ c: pos + width / 2, width, arterial, segments: [], on: null });
    const m = meshAt(pos / extent, axis);
    const step = rng.range(m.lo, m.hi);
    pos += width + (arterial ? step * 1.24 : step);
    i++;
  }
  // Chiude la maglia con un'ultima arteria perimetrale. Le linee che le finirebbero
  // addosso vengono tolte: una cella di larghezza zero produce isolati degeneri.
  const pc = extent - margin - 72;
  while (lines.length && lines[lines.length - 1].c + lines[lines.length - 1].width / 2 > pc - 162) lines.pop();
  lines.push({ c: pc, width: 144, arterial: true, segments: [], on: null });
  return lines;
}

/**
 * Disassamenti: una via secondaria si interrompe a una certa quota e riprende
 * spostata di lato. Non serve un caso speciale nella geometria: basta affiancarle
 * una gemella e spegnere l'una dove l'altra è accesa (vedi `carveMesh`). Serve
 * spazio per due isolati decenti, quindi succede solo dove la maglia è larga.
 */
function planDoglegs(rng, lines, extent, axis, forbid) {
  const plans = [];
  const takenGaps = new Set(); // un varco ospita una sola gemella
  const MIN_BLOCK = 62; // i due isolati che restano ai lati della gemella
  for (let i = 1; i < lines.length - 1; i++) {
    const l = lines[i];
    if (l.arterial) continue;
    if (!rng.chance(meshAt(l.c / extent, axis).jog)) continue;
    const gapNext = lines[i + 1].c - lines[i + 1].width / 2 - (l.c + l.width / 2);
    const gapPrev = l.c - l.width / 2 - (lines[i - 1].c + lines[i - 1].width / 2);
    // Si prova prima il lato più largo, poi l'altro.
    for (const dir of gapNext >= gapPrev ? [1, -1] : [-1, 1]) {
      const gi = dir > 0 ? i : i - 1;
      const gap = dir > 0 ? gapNext : gapPrev;
      // La gemella lascia due isolati: largo `off - width` da una parte e `gap - off`
      // dall'altra. Sotto questa soglia resterebbero fessure, non isolati.
      if (gap < l.width + MIN_BLOCK * 2 || takenGaps.has(gi)) continue;
      const off = dir * rng.range(l.width + MIN_BLOCK, gap - MIN_BLOCK);
      if (forbid && forbid(l.c + off)) continue;
      takenGaps.add(gi);
      plans.push({ line: l, off, at: rng.range(0.28, 0.72) * extent });
      break;
    }
  }
  return plans;
}

/**
 * Decide, cella per cella, dove ogni linea *esiste davvero*: superblocchi,
 * disassamenti e interruzione sul fiume. `l.on[j]` vale per il tratto compreso
 * fra la perpendicolare j e la j+1; da qui derivano segmenti, isolati e grafo.
 */
function carveMesh(rng, city, W, H) {
  const ry0 = city.river.y0;
  const ry1 = city.river.y1;

  // 1) Gemelle dei disassamenti: entrano nell'array prima di allocare le celle,
  //    la quota del salto è in coordinate di mondo perché gli indici slittano.
  const splits = [];
  // Una trasversale non può finire dentro il Han: il varco fra le due rive è
  // largo abbastanza da tentare il generatore.
  const inRiver = (c) => c > ry0 - 60 && c < ry1 + 60;
  for (const axis of ['v', 'h']) {
    const lines = axis === 'v' ? city.vLines : city.hLines;
    const perp = axis === 'v' ? city.hLines : city.vLines;
    const extent = axis === 'v' ? W : H;
    // Il salto avviene su un'arteria: è lì che succede in una città vera, e le
    // arterie sono le uniche linee continue, quindi la gemella non nasce cieca.
    const hinges = perp.filter((p) => p.arterial && p.c > extent * 0.25 && p.c < extent * 0.75);
    if (!hinges.length) continue;
    for (const p of planDoglegs(rng, lines, extent, axis, axis === 'h' ? inRiver : null)) {
      let at = hinges[0].c;
      for (const x of hinges) if (Math.abs(x.c - p.at) < Math.abs(at - p.at)) at = x.c;
      const twin = { c: p.line.c + p.off, width: p.line.width, arterial: false, segments: [], on: null };
      lines.push(twin);
      splits.push({ head: p.line, tail: twin, at, axis });
    }
    lines.sort((a, b) => a.c - b.c);
  }

  const cellCenter = (perp, j) => (perp[j].c + perp[j + 1].c) / 2;

  for (const axis of ['v', 'h']) {
    const lines = axis === 'v' ? city.vLines : city.hLines;
    const perp = axis === 'v' ? city.hLines : city.vLines;
    const cells = perp.length - 1;
    for (const l of lines) {
      l.on = new Array(cells).fill(true);
      if (l.arterial) continue;
      // Superblocchi: la probabilità è campionata sul distretto della cella, così
      // Gangnam e i moli si diradano davvero e Hongdae resta fitta.
      let j = 0;
      while (j < cells) {
        const mid = cellCenter(perp, j);
        const d = axis === 'v' ? districtAtNorm(l.c / W, mid / H) : districtAtNorm(mid / W, l.c / H);
        if (rng.chance(d.grid.superblock)) {
          const run = rng.chance(0.3) ? 2 : 1;
          for (let k = 0; k < run && j + k < cells; k++) l.on[j + k] = false;
          j += run + 1; // almeno una cella di strada prima del buco successivo
        } else {
          j++;
        }
      }
    }
  }

  // 2) Metà linea per ogni gemella del disassamento.
  for (const s of splits) {
    const perp = s.axis === 'v' ? city.hLines : city.vLines;
    for (let j = 0; j < s.head.on.length; j++) {
      const after = cellCenter(perp, j) > s.at;
      if (after) s.head.on[j] = false;
      else s.tail.on[j] = false;
    }
  }
  city.doglegs = splits.length;

  // 3) Il fiume: solo i ponti attraversano la cella che lo contiene.
  let riverCell = -1;
  for (let j = 0; j < city.hLines.length - 1; j++) {
    if (city.hLines[j].c < ry0 && city.hLines[j + 1].c > ry1) riverCell = j;
  }
  if (riverCell >= 0) {
    for (const l of city.vLines) l.on[riverCell] = !!l.isBridge;
  }
}

/**
 * Niente vicoli ciechi: un tratto che finisce dove non passa nessuna trasversale
 * costringerebbe l'AI a inversioni a U. Si accorcia fino al primo vero incrocio,
 * iterando perché accorciare una linea può lasciarne cieca un'altra. I monconi
 * verso il bordo mappa restano: lì c'è la cintura invalicabile.
 */
function trimDeadEnds(city) {
  const axes = [
    { lines: city.vLines, perp: city.hLines },
    { lines: city.hLines, perp: city.vLines },
  ];
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const { lines, perp } of axes) {
      const nl = lines.length;
      for (let li = 0; li < nl; li++) {
        const l = lines[li];
        if (l.arterial) continue;
        const cells = l.on.length;
        const served = (pj) => {
          const p = perp[pj];
          return (li > 0 && p.on[li - 1]) || (li < nl - 1 && p.on[li]);
        };
        for (let j = 0; j < cells; j++) {
          if (!l.on[j]) continue;
          if ((j === 0 || !l.on[j - 1]) && j > 0 && !served(j)) {
            l.on[j] = false;
            changed = true;
            continue;
          }
          if ((j === cells - 1 || !l.on[j + 1]) && j < cells - 1 && !served(j + 1)) {
            l.on[j] = false;
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }
}

/** Ricostruisce i tratti percorribili di ogni linea a partire da `on`. */
function buildSegments(lines, perp, lo, hi) {
  for (const l of lines) {
    l.segments.length = 0;
    let start = null;
    for (let j = 0; j < l.on.length; j++) {
      if (l.on[j]) {
        if (start === null) start = j === 0 ? lo : perp[j].c;
      } else if (start !== null) {
        l.segments.push([start, perp[j].c]);
        start = null;
      }
    }
    if (start !== null) l.segments.push([start, hi]);
  }
}

function lineSpan(l) {
  return { a: l.c - l.width / 2, b: l.c + l.width / 2 };
}

/** Suddivide una lunghezza in lotti di dimensione variabile. */
function splitStrip(rng, start, length, minLot, maxLot) {
  const out = [];
  let p = 0;
  while (length - p > minLot * 0.7) {
    let lot = rng.range(minLot, maxLot);
    if (length - p - lot < minLot * 0.7) lot = length - p;
    out.push({ a: start + p, len: lot });
    p += lot + rng.range(0, 3);
  }
  return out;
}

function pickHeight(rng, district, onArterial, corner) {
  const [lo, hi] = district.heights;
  let t = Math.abs(rng.bell());
  if (onArterial) t = Math.min(1, t + 0.32);
  if (corner) t = Math.min(1, t + 0.18);
  return Math.round(lo + (hi - lo) * t);
}

function makeBuilding(rng, district, x, y, w, h, opts = {}) {
  const style = opts.style || rng.pick(district.styles);
  const b = {
    x, y, w, h,
    h3d: opts.h3d ?? pickHeight(rng, district, opts.arterial, opts.corner),
    elev: 0,
    style,
    color: opts.color || rng.pick(district.facade),
    roofColor: district.roof,
    variant: rng.int(0, 3),
    litSeed: rng.int(0, 9999),
    district: district.id,
    solid: true,
    signs: [],
    landmark: !!opts.landmark,
    ac: rng.int(0, 3), // unità di condizionamento sul tetto
    water: rng.chance(0.2), // serbatoio d'acqua
  };
  // Insegne verticali sulle facciate che guardano la strada.
  const sd = opts.signChance ?? district.signDensity;
  if (b.h3d > 30) {
    for (const edge of opts.streetEdges || []) {
      if (!rng.chance(sd)) continue;
      const word = rng.pick(SIGN_WORDS);
      b.signs.push({
        edge,
        t: rng.range(0.18, 0.82),
        word: word.ko,
        color: rng.chance(0.55) ? district.accent : district.accent2,
        vertical: rng.chance(0.6),
        h: rng.range(0.35, 0.8),
      });
    }
  }
  return b;
}

/**
 * Riempie un isolato urbano. Gli isolati larghi vengono attraversati da un vicolo
 * (골목): non è una strada del grafo, è una fessura di asfalto che spezza il
 * blocco unico e si vede benissimo dall'alto.
 */
function fillUrbanBlock(rng, city, block, district) {
  // Sugli isolati stretti — la fila di negozi lasciata da un disassamento — il
  // marciapiede si assottiglia invece di mangiarsi tutto lo spazio edificabile.
  const pad = Math.min(SIDEWALK, Math.max(7, (Math.min(block.w, block.h) - 46) / 2));
  const area = {
    x: block.x + pad,
    y: block.y + pad,
    w: block.w - pad * 2,
    h: block.h - pad * 2,
  };
  if (area.w < 40 || area.h < 40) return;

  if (Math.max(area.w, area.h) > 320 && rng.chance(0.68)) {
    const aw = rng.range(38, 54);
    if (area.w >= area.h) {
      const cut = area.x + area.w * rng.range(0.34, 0.66) - aw / 2;
      // `through`: va da strada a strada. È l'unico varco che può diventare una
      // scalinata senza tagliare fuori i parcheggi del cortile.
      const alley = { x: cut, y: block.y, w: aw, h: block.h, through: true };
      block.yards.push(alley);
      fillUrbanArea(rng, city, block, district, { x: area.x, y: area.y, w: cut - area.x - 4, h: area.h });
      fillUrbanArea(rng, city, block, district, { x: cut + aw + 4, y: area.y, w: area.x + area.w - cut - aw - 4, h: area.h });
    } else {
      const cut = area.y + area.h * rng.range(0.34, 0.66) - aw / 2;
      const alley = { x: block.x, y: cut, w: block.w, h: aw, through: true };
      block.yards.push(alley);
      fillUrbanArea(rng, city, block, district, { x: area.x, y: area.y, w: area.w, h: cut - area.y - 4 });
      fillUrbanArea(rng, city, block, district, { x: area.x, y: cut + aw + 4, w: area.w, h: area.y + area.h - cut - aw - 4 });
    }
    return;
  }
  fillUrbanArea(rng, city, block, district, area);
}

function fillUrbanArea(rng, city, block, district, area) {
  const bx = area.x;
  const by = area.y;
  const bw = area.w;
  const bh = area.h;
  if (bw < 40 || bh < 40) return;

  const { minLot, maxLot, gapChance } = district.block;
  const perimeterMode = bw > 150 && bh > 150 && rng.chance(0.88);
  // I lotti si stringono con l'isolato: su un blocco fitto i lotti "da manuale"
  // ci starebbero una volta sola e il risultato sarebbe uno scatolone al posto di
  // una fila di negozi. Sui blocchi larghi il vincolo non morde.
  // Il pavimento a 34/46 evita che una striscia stretta venga affettata in lastre
  // sottili: lì serve una fila sola di edifici, profonda quanto l'isolato.
  const lot = (span) => [
    Math.min(minLot, Math.max(span * 0.32, 34)),
    Math.min(maxLot, Math.max(span * 0.55, 46)),
  ];

  const push = (x, y, w, h, edges, corner) => {
    if (w < 26 || h < 26) return;
    if (rng.chance(gapChance)) {
      block.yards.push({ x, y, w, h });
      return;
    }
    const bld = makeBuilding(rng, district, x, y, w, h, {
      streetEdges: edges,
      arterial: block.onArterial,
      corner,
    });
    city.buildings.push(bld);
  };

  if (perimeterMode) {
    let depthT = rng.range(56, Math.max(62, Math.min(118, bh * 0.4)));
    let depthB = rng.range(56, Math.max(62, Math.min(118, bh * 0.4)));
    const depthL = rng.range(56, Math.max(62, Math.min(118, bw * 0.4)));
    const depthR = rng.range(56, Math.max(62, Math.min(118, bw * 0.4)));
    const hasCourtyard = bh - depthT - depthB - 4 > minLot * 0.7;
    // Senza spazio per un cortile le due fasce si dividono tutto l'isolato: la
    // striscia rimasta in mezzo sarebbe solo marciapiede vuoto.
    if (!hasCourtyard) {
      depthT = bh * 0.5 - 2;
      depthB = bh - depthT - 4;
    }
    const innerY = by + depthT + 2;
    const innerH = bh - depthT - depthB - 4;

    // Le quattro strisce perimetrali, ognuna suddivisa in lotti.
    const [wLo, wHi] = lot(bw);
    const [iLo, iHi] = lot(innerH);
    const strips = [
      { side: 'top', lots: splitStrip(rng, bx, bw, wLo, wHi), rect: (l) => [l.a, by, l.len, depthT] },
      { side: 'bottom', lots: splitStrip(rng, bx, bw, wLo, wHi), rect: (l) => [l.a, by + bh - depthB, l.len, depthB] },
    ];
    if (hasCourtyard) {
      strips.push(
        { side: 'left', lots: splitStrip(rng, innerY, innerH, iLo, iHi), rect: (l) => [bx, l.a, depthL, l.len] },
        { side: 'right', lots: splitStrip(rng, innerY, innerH, iLo, iHi), rect: (l) => [bx + bw - depthR, l.a, depthR, l.len] }
      );
    }

    // Uno o due lotti restano vuoti: sono i vicoli (골목) che portano al cortile.
    // Senza di loro le auto parcheggiate all'interno sarebbero inaccessibili.
    const alleyMap = new Map();
    if (hasCourtyard) {
      const count = rng.chance(0.35) ? 2 : 1;
      const used = new Set();
      for (let k = 0; k < count; k++) {
        const si = rng.int(0, strips.length - 1);
        if (used.has(si)) continue;
        used.add(si);
        const lots = strips[si].lots;
        if (lots.length < 2) continue;
        alleyMap.set(si, rng.int(0, lots.length - 1));
      }
    }

    strips.forEach((strip, si) => {
      const alleyIdx = alleyMap.get(si);
      strip.lots.forEach((lot, li) => {
        const [x, y, w, h] = strip.rect(lot);
        if (li === alleyIdx) {
          // Vicolo: asfalto passante, nessun edificio.
          const narrow = Math.min(w, h) === w ? { x, y, w: Math.min(w, 58), h } : { x, y, w, h: Math.min(h, 58) };
          block.yards.push(narrow);
          block.alleys.push(narrow);
          return;
        }
        push(x, y, w, h, [strip.side], li === 0);
      });
    });

    if (hasCourtyard) {
      // Cortile interno: parcheggio, generatori, cassonetti.
      const cy = { x: bx + depthL + 2, y: innerY, w: bw - depthL - depthR - 4, h: innerH };
      if (cy.w > 30) {
        block.yards.push(cy);
        block.courtyard = cy;
        if (alleyMap.size > 0) block.reachable = true;
      }
    }
  } else {
    // Isolato piccolo: griglia piena.
    const [cLo, cHi] = lot(bw);
    const [rLo, rHi] = lot(bh);
    const cols = splitStrip(rng, bx, bw, cLo, cHi);
    for (const col of cols) {
      const rows = splitStrip(rng, by, bh, rLo, rHi);
      for (const row of rows) {
        const edges = [];
        if (row.a <= by + 4) edges.push('top');
        if (row.a + row.len >= by + bh - 6) edges.push('bottom');
        if (col.a <= bx + 4) edges.push('left');
        if (col.a + col.len >= bx + bw - 6) edges.push('right');
        push(col.a, row.a, col.len - 3, row.len - 3, edges, edges.length >= 2);
      }
    }
  }
}

/** Moli e magazzini: pochi volumi enormi, file di container, gru. */
function fillDockBlock(rng, city, block, district) {
  const bx = block.x + SIDEWALK;
  const by = block.y + SIDEWALK;
  const bw = block.w - SIDEWALK * 2;
  const bh = block.h - SIDEWALK * 2;
  if (bw < 60 || bh < 60) return;

  const mode = rng.next();
  if (mode < 0.3) {
    // Magazzino unico con tetto a shed.
    const w = bw * rng.range(0.62, 0.95);
    const h = bh * rng.range(0.6, 0.92);
    const x = bx + (bw - w) / 2;
    const y = by + (bh - h) / 2;
    city.buildings.push(
      makeBuilding(rng, district, x, y, w, h, {
        style: 'warehouse',
        h3d: rng.int(38, 70),
        streetEdges: ['top', 'bottom'],
        signChance: 0.3,
      })
    );
    block.yards.push({ x: bx, y: by, w: bw, h: bh });
  } else if (mode < 0.82) {
    // Piazzale container.
    block.yards.push({ x: bx, y: by, w: bw, h: bh });
    const cw = 40, cl = 92;
    const cols = Math.floor(bw / (cw + 12));
    const rows = Math.floor(bh / (cl + 16));
    const palette = ['#c8493a', '#3f7ea8', '#cf9a2f', '#4a8f5e', '#8f5aa8', '#b7532f', '#4f6f8f'];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (rng.chance(0.22)) continue;
        const x = bx + 8 + i * (cw + 12);
        const y = by + 10 + j * (cl + 16);
        const stack = rng.int(1, 3);
        city.buildings.push({
          x, y, w: cw, h: cl,
          h3d: 26 * stack,
          elev: 0,
          style: 'container',
          color: rng.pick(palette),
          roofColor: '#2c3336',
          variant: stack,
          litSeed: rng.int(0, 9999),
          district: district.id,
          solid: true,
          signs: [],
          landmark: false,
          ac: 0,
          water: false,
        });
      }
    }
    if (rng.chance(0.75)) {
      city.props.push({ type: 'crane', x: bx + bw * rng.range(0.2, 0.8), y: by + bh * rng.range(0.2, 0.8), rot: rng.chance(0.5) ? 0 : Math.PI / 2, z: 150, solid: true, r: 26 });
    }
  } else {
    block.yards.push({ x: bx, y: by, w: bw, h: bh });
    // Piazzale vuoto con cisterne.
    const n = rng.int(2, 5);
    for (let i = 0; i < n; i++) {
      const r = rng.range(26, 46);
      city.props.push({
        type: 'tank',
        x: bx + rng.range(r, bw - r),
        y: by + rng.range(r, bh - r),
        rot: 0, z: r * 1.5, solid: true, r,
      });
    }
  }
}

/** Namsan: collina boscosa, sentieri e N Seoul Tower. */
function fillParkBlock(rng, city, block, district, isTowerBlock) {
  block.yards.push({ x: block.x, y: block.y, w: block.w, h: block.h });
  const n = Math.floor((block.w * block.h) / 5200);
  const mx = Math.min(14, block.w * 0.3);
  const my = Math.min(14, block.h * 0.3);
  for (let i = 0; i < n; i++) {
    const x = block.x + rng.range(mx, block.w - mx);
    const y = block.y + rng.range(my, block.h - my);
    city.props.push({ type: 'tree', x, y, rot: rng.range(0, 6.28), z: rng.range(46, 82), solid: false, r: 13, tint: rng.int(0, 2) });
  }
  if (isTowerBlock) {
    const w = 74, h = 74;
    const x = block.x + block.w / 2 - w / 2;
    const y = block.y + block.h / 2 - h / 2;
    city.buildings.push({
      x, y, w, h,
      h3d: 470,
      elev: 0,
      style: 'tower',
      color: '#8d9099',
      roofColor: '#c9ccd4',
      variant: 0,
      litSeed: 1,
      district: district.id,
      solid: true,
      signs: [],
      landmark: true,
      ac: 0,
      water: false,
      name: 'N Seoul Tower',
    });
    city.landmarks.push({ name: 'N Seoul Tower', hangul: 'N서울타워', x: x + w / 2, y: y + h / 2 });
  }
}

/** Arredo urbano lungo i bordi di un isolato. */
function decorateBlockEdges(rng, city, block, district) {
  const step = 132;
  // Il marciapiede è la fascia interna dell'isolato: l'arredo va lì, non sull'asfalto.
  const m = SIDEWALK * 0.5;
  const edges = [
    { x0: block.x, y0: block.y + m, dx: 1, dy: 0, len: block.w },
    { x0: block.x, y0: block.y + block.h - m, dx: 1, dy: 0, len: block.w },
    { x0: block.x + m, y0: block.y, dx: 0, dy: 1, len: block.h },
    { x0: block.x + block.w - m, y0: block.y, dx: 0, dy: 1, len: block.h },
  ];
  for (const e of edges) {
    const count = Math.floor(e.len / step);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = e.x0 + e.dx * e.len * t;
      const y = e.y0 + e.dy * e.len * t;
      const roll = rng.next();
      if (roll < 0.46) {
        city.props.push({ type: 'lamp', x, y, rot: e.dx ? 0 : Math.PI / 2, z: 96, solid: false, r: 6 });
      } else if (roll < 0.46 + district.treeDensity) {
        city.props.push({ type: 'tree', x, y, rot: rng.range(0, 6.28), z: rng.range(52, 78), solid: false, r: 12, tint: rng.int(0, 2) });
      } else if (roll < 0.62) {
        city.props.push({ type: 'vending', x, y, rot: e.dx ? 0 : Math.PI / 2, z: 34, solid: true, r: 12 });
      } else if (roll < 0.7) {
        city.props.push({ type: 'bin', x, y, rot: 0, z: 22, solid: false, r: 9 });
      } else if (roll < 0.76) {
        city.props.push({ type: 'hydrant', x, y, rot: 0, z: 16, solid: false, r: 6 });
      } else if (roll < 0.82) {
        city.props.push({ type: 'bench', x, y, rot: e.dx ? 0 : Math.PI / 2, z: 14, solid: false, r: 14 });
      } else if (roll < 0.87 && district.signDensity > 0.6) {
        city.props.push({ type: 'kiosk', x, y, rot: e.dx ? 0 : Math.PI / 2, z: 40, solid: true, r: 18, word: rng.pick(SIGN_WORDS).ko, accent: district.accent });
      } else if (roll < 0.9) {
        city.props.push({ type: 'busstop', x, y, rot: e.dx ? 0 : Math.PI / 2, z: 44, solid: false, r: 20 });
      }
    }
  }
}

/** Props nei cortili: cassonetti, generatori, pallet, auto abbandonate. */
function decorateYards(rng, city, block) {
  for (const y of block.yards) {
    const n = Math.floor((y.w * y.h) / 9000);
    for (let i = 0; i < n; i++) {
      const px = y.x + rng.range(12, Math.max(13, y.w - 12));
      const py = y.y + rng.range(12, Math.max(13, y.h - 12));
      const roll = rng.next();
      if (roll < 0.3) city.props.push({ type: 'bin', x: px, y: py, rot: rng.range(0, 6.28), z: 24, solid: false, r: 10 });
      else if (roll < 0.5) city.props.push({ type: 'pallet', x: px, y: py, rot: rng.range(0, 6.28), z: 10, solid: false, r: 12 });
      else if (roll < 0.66) city.props.push({ type: 'ac_unit', x: px, y: py, rot: rng.range(0, 6.28), z: 26, solid: true, r: 11 });
      else if (roll < 0.76) city.props.push({ type: 'barrier', x: px, y: py, rot: rng.range(0, 6.28), z: 20, solid: false, r: 13 });
    }
  }
}

export function generateCity(seed = 20260730) {
  const rng = new Rng(seed);
  const W = WORLD.w, H = WORLD.h, M = WORLD.margin;

  const city = {
    w: W, h: H, seed,
    vLines: [], hLines: [],
    river: null,
    blocks: [],
    buildings: [],
    props: [],
    landmarks: [],
    crosswalks: [],
    intersections: [],
  };

  city.elevationAt = makeElevation(W, H, seed);

  city.vLines = genLines(rng, W, M, 'v');
  city.hLines = genLines(rng, H, M, 'h');

  // --- Fiume Han + ponti -----------------------------------------------------
  const ry0 = RIVER.y0 * H;
  const ry1 = RIVER.y1 * H;
  city.hLines = city.hLines.filter((l) => l.c + l.width / 2 < ry0 - 30 || l.c - l.width / 2 > ry1 + 30);
  city.river = { y0: ry0, y1: ry1, bridges: [] };

  // Le due strade che costeggiano il Han sono lungofiume, quindi arterie: continue
  // per definizione. Senza questo le arterie verticali finirebbero contro l'argine
  // in un punto dove un superblocco ha tolto la trasversale — vicolo cieco.
  {
    const above = city.hLines.filter((l) => l.c < ry0);
    const below = city.hLines.filter((l) => l.c > ry1);
    for (const l of [above[above.length - 1], below[0]]) {
      if (!l || l.arterial) continue;
      l.arterial = true;
      l.width = 144;
    }
  }

  // Tre ponti: ovest, centro, est, scelti tra le arterie verticali.
  const arterials = city.vLines.filter((l) => l.arterial);
  for (const frac of [0.16, 0.5, 0.84]) {
    let best = null;
    let bestD = Infinity;
    for (const a of arterials) {
      if (a.isBridge) continue;
      const d = Math.abs(a.c - frac * W);
      if (d < bestD) { bestD = d; best = a; }
    }
    if (best) best.isBridge = true;
  }

  // --- Maglia: superblocchi, disassamenti, interruzione sul fiume -------------
  carveMesh(rng, city, W, H);
  trimDeadEnds(city);
  for (const l of city.vLines) {
    if (l.isBridge) city.river.bridges.push({ x: l.c, w: l.width });
  }

  buildSegments(city.vLines, city.hLines, M * 0.5, H - M * 0.5);
  buildSegments(city.hLines, city.vLines, M * 0.5, W - M * 0.5);
  // Le verticali non-ponte arrivano fino all'argine, non all'ultima trasversale:
  // altrimenti il lungofiume resterebbe senza strade.
  for (const l of city.vLines) {
    if (l.isBridge) continue;
    for (const s of l.segments) {
      if (s[1] < ry0 && s[1] > ry0 - 700) s[1] = ry0;
      if (s[0] > ry1 && s[0] < ry1 + 700) s[0] = ry1;
    }
  }

  // --- Isolati ---------------------------------------------------------------
  const vSpans = city.vLines.map(lineSpan);
  const hSpans = city.hLines.map(lineSpan);
  const NV = city.vLines.length;
  const NH = city.hLines.length;
  const cellsX = NV - 1;
  const cellsY = NH - 1;
  const used = new Uint8Array(cellsX * cellsY);
  const at = (i, j) => j * cellsX + i;

  // La cella che contiene il fiume non genera isolati e non si fonde con le altre.
  for (let j = 0; j < cellsY; j++) {
    if (city.hLines[j].c < ry1 && city.hLines[j + 1].c > ry0) {
      for (let i = 0; i < cellsX; i++) used[at(i, j)] = 1;
    }
  }

  const namsanCx = NAMSAN.x * W;
  const namsanCy = NAMSAN.y * H;
  const namsanR = NAMSAN.r * W;
  let towerAssigned = false;

  // Fusione greedy delle celle senza strada in isolati **rettangolari**: restando
  // rettangoli non serve toccare collisioni, tile o pedoni. L'ordine di crescita
  // parte dal lato corto: crescere sempre prima in orizzontale trasformava la
  // fessura lasciata da un disassamento in una striscia lunga mezza città.
  for (let j = 0; j < cellsY; j++) {
    for (let i = 0; i < cellsX; i++) {
      if (used[at(i, j)]) continue;
      let i1 = i;
      let j1 = j;

      // Annettere la colonna `c` richiede che sia libera su tutte le righe già prese.
      const canRight = (c) => {
        for (let r = j; r <= j1; r++) {
          if (used[at(c, r)] || city.vLines[c].on[r]) return false;
          if (r < j1 && city.hLines[r + 1].on[c]) return false;
        }
        return true;
      };
      const canDown = (r) => {
        for (let c = i; c <= i1; c++) {
          if (used[at(c, r)] || city.hLines[r].on[c]) return false;
          if (c < i1 && city.vLines[c + 1].on[r]) return false;
        }
        return true;
      };
      const right = () => { while (i1 + 1 < cellsX && canRight(i1 + 1)) i1++; };
      const down = () => { while (j1 + 1 < cellsY && canDown(j1 + 1)) j1++; };

      if (hSpans[j + 1].a - hSpans[j].b < vSpans[i + 1].a - vSpans[i].b) {
        down(); right();
      } else {
        right(); down();
      }

      for (let jj = j; jj <= j1; jj++) {
        for (let ii = i; ii <= i1; ii++) used[at(ii, jj)] = 1;
      }

      const x = vSpans[i].b;
      const y = hSpans[j].b;
      const w = vSpans[i1 + 1].a - x;
      const h = hSpans[j1 + 1].a - y;
      if (w < 30 || h < 30) continue;

      const cx = x + w / 2;
      const cy = y + h / 2;
      const district = districtAtNorm(cx / W, cy / H);
      const onArterial =
        city.vLines[i].arterial || city.vLines[i1 + 1].arterial ||
        city.hLines[j].arterial || city.hLines[j1 + 1].arterial;

      const inNamsan = Math.hypot(cx - namsanCx, cy - namsanCy) < namsanR;
      const nearRiver = Math.abs(cy - ry0) < 260 || Math.abs(cy - ry1) < 260;

      let type = 'urban';
      if (inNamsan) type = 'park';
      // Ritaglio troppo stretto anche per una fila di negozi: fazzoletto verde
      // (쌈지공원), che è quello che ci starebbe davvero.
      else if (w < 64 || h < 64) type = 'park';
      else if (district.id === 'docks' && (nearRiver || rng.chance(0.55))) type = 'dock';
      else if (rng.chance(0.045)) type = 'park';

      const block = { x, y, w, h, type, district: district.id, onArterial, yards: [], alleys: [] };
      city.blocks.push(block);

      if (type === 'urban') fillUrbanBlock(rng, city, block, district);
      else if (type === 'dock') fillDockBlock(rng, city, block, district);
      else {
        const isTower = inNamsan && !towerAssigned && Math.hypot(cx - namsanCx, cy - namsanCy) < namsanR * 0.45;
        if (isTower) towerAssigned = true;
        fillParkBlock(rng, city, block, district, isTower);
      }

      decorateBlockEdges(rng, city, block, district);
      decorateYards(rng, city, block);
    }
  }

  // --- Han River Park: la fascia tra l'ultima strada e l'argine --------------
  {
    const above = city.hLines.filter((l) => l.c < ry0);
    const below = city.hLines.filter((l) => l.c > ry1);
    const lastAbove = above[above.length - 1];
    const firstBelow = below[0];
    const strips = [];
    if (lastAbove) {
      const y = lastAbove.c + lastAbove.width / 2;
      strips.push({ y, h: ry0 - 24 - y });
    }
    if (firstBelow) {
      const y = ry1 + 24;
      strips.push({ y, h: firstBelow.c - firstBelow.width / 2 - y });
    }
    for (const strip of strips) {
      if (strip.h < 26) continue;
      for (let i = 0; i < vSpans.length - 1; i++) {
        const x = vSpans[i].b;
        const w = vSpans[i + 1].a - x;
        if (w < 45) continue;
        const district = districtAtNorm((x + w / 2) / W, (strip.y + strip.h / 2) / H);
        const block = {
          x, y: strip.y, w, h: strip.h,
          type: 'park', district: district.id, onArterial: false,
          yards: [], alleys: [], riverside: true,
        };
        city.blocks.push(block);
        fillParkBlock(rng, city, block, district, false);
      }
    }
  }

  // --- Attraversamenti pedonali e incroci ------------------------------------
  // Solo sui rami che esistono davvero: dopo i superblocchi molti nodi della
  // maglia sono diventati incroci a T o non esistono più.
  for (let i = 0; i < NV; i++) {
    for (let j = 0; j < NH; j++) {
      const v = city.vLines[i], hl = city.hLines[j];
      const up = v.on[j > 0 ? j - 1 : 0];
      const down = v.on[j < NH - 1 ? j : NH - 2];
      const left = hl.on[i > 0 ? i - 1 : 0];
      const right = hl.on[i < NV - 1 ? i : NV - 2];
      if (!(up || down) || !(left || right)) continue;
      city.intersections.push({
        x: v.c, y: hl.c,
        vw: v.width, hw: hl.width,
        arterial: v.arterial && hl.arterial,
        vi: i, hi: j,
      });
      // Strisce sui quattro rami dell'incrocio.
      const off = 8;
      if (up) city.crosswalks.push({ x: v.c, y: hl.c - hl.width / 2 - off, w: v.width, h: 16, horiz: true });
      if (down) city.crosswalks.push({ x: v.c, y: hl.c + hl.width / 2 + off, w: v.width, h: 16, horiz: true });
      if (left) city.crosswalks.push({ x: v.c - v.width / 2 - off, y: hl.c, w: 16, h: hl.width, horiz: false });
      if (right) city.crosswalks.push({ x: v.c + v.width / 2 + off, y: hl.c, w: 16, h: hl.width, horiz: false });
    }
  }

  // --- Scalinate (계단) ------------------------------------------------------
  // Una scalinata non è geometria nuova: è un vicolo passante troppo ripido per
  // le auto. Stessa fessura di prima più un solido `vehicleOnly`, che ferma le
  // ruote e lascia passare i piedi — la scorciatoia con cui si semina chi ti
  // insegue. Solo i vicoli `through` sono candidati: quelli di cortile portano ai
  // parcheggi, murarli lascerebbe le auto in sosta senza uscita.
  // Soglia bassa di proposito: i vicoli passanti in tutta la città sono 14, e
  // sopra il 3% ne restano 6. Il collo di bottiglia è il numero di varchi, non la
  // pendenza — per averne di più va toccato `fillUrbanBlock`, che però consuma
  // rng diverso e ridisegna tutta la città.
  const STAIR_GRADE = 0.018;
  city.stairs = [];
  for (const b of city.blocks) {
    for (const y of b.yards) {
      if (!y.through) continue;
      const vertical = y.h > y.w;
      const len = vertical ? y.h : y.w;
      if (len < 130) continue;
      const ax = vertical ? y.x + y.w / 2 : y.x;
      const ay = vertical ? y.y : y.y + y.h / 2;
      const bx = vertical ? ax : y.x + y.w;
      const by = vertical ? y.y + y.h : ay;
      const dz = city.elevationAt(bx, by) - city.elevationAt(ax, ay);
      if (Math.abs(dz) / len < STAIR_GRADE) continue;
      y.stairs = true;
      y.vertical = vertical;
      y.steps = Math.max(6, Math.round(len / 26));
      city.stairs.push({ x: y.x, y: y.y, w: y.w, h: y.h, vehicleOnly: true });
    }
  }

  // --- Ospedali --------------------------------------------------------------
  // Uno per distretto, sul marciapiede dell'isolato grande più vicino al centro:
  // è il punto in cui ci si risveglia dopo un pestaggio finito male.
  city.hospitals = [];
  for (const d of DISTRICTS) {
    const cx = d.seed.x * W;
    const cy = d.seed.y * H;
    let best = null;
    let bestD = Infinity;
    for (const b of city.blocks) {
      if (b.district !== d.id || b.type === 'park') continue;
      if (b.w < 150 || b.h < 150) continue;
      const dd = (b.x + b.w / 2 - cx) ** 2 + (b.y + b.h / 2 - cy) ** 2;
      if (dd < bestD) { bestD = dd; best = b; }
    }
    if (!best) continue;
    best.hospital = true;
    city.hospitals.push({
      x: best.x + best.w / 2,
      y: best.y + SIDEWALK * 0.78,
      district: d.id,
      name: d.name,
    });
  }

  // --- Parapetti dei ponti (volumi bassi, estrusi come i muri) ---------------
  for (const b of city.river.bridges) {
    const rw = 10;
    for (const side of [-1, 1]) {
      city.buildings.push({
        x: b.x + side * (b.w / 2) - rw / 2, y: ry0 - 6,
        w: rw, h: ry1 - ry0 + 12,
        h3d: 18, elev: 0, style: 'wall', color: '#6e7480', roofColor: '#8d94a0',
        variant: 0, litSeed: 0, district: 'gangnam', solid: true, signs: [],
        landmark: false, ac: 0, water: false, flat: true,
      });
    }
  }

  // --- Argini del fiume: muretti continui, interrotti solo dai ponti ---------
  {
    const gates = city.river.bridges
      .map((b) => ({ a: b.x - b.w / 2 - 2, b: b.x + b.w / 2 + 2 }))
      .sort((p, q) => p.a - q.a);
    const wallH = 16;
    for (const bank of [ry0 - 14, ry1 - 2]) {
      let cursor = 0;
      const pieces = [];
      for (const gate of gates) {
        if (gate.a > cursor) pieces.push([cursor, gate.a]);
        cursor = Math.max(cursor, gate.b);
      }
      if (cursor < W) pieces.push([cursor, W]);
      for (const [a, b] of pieces) {
        if (b - a < 8) continue;
        city.buildings.push({
          x: a, y: bank, w: b - a, h: wallH,
          h3d: 20, elev: 0, style: 'wall', color: '#5f656e', roofColor: '#7d848e',
          variant: 0, litSeed: 0, district: 'itaewon', solid: true, signs: [],
          landmark: false, ac: 0, water: false, isBank: true, flat: true,
        });
      }
    }
  }

  // --- Cintura invalicabile ai margini della mappa ---------------------------
  const belt = 90;
  const edges = [
    { x: -belt, y: -belt, w: W + belt * 2, h: belt + M * 0.4 },
    { x: -belt, y: H - M * 0.4, w: W + belt * 2, h: belt + M * 0.4 },
    { x: -belt, y: -belt, w: belt + M * 0.4, h: H + belt * 2 },
    { x: W - M * 0.4, y: -belt, w: belt + M * 0.4, h: H + belt * 2 },
  ];
  for (const e of edges) {
    city.buildings.push({
      ...e, h3d: 120, elev: 0, style: 'hill', color: '#2d3a2f', roofColor: '#38492f',
      variant: 0, litSeed: 0, district: 'hongdae', solid: true, signs: [],
      landmark: false, ac: 0, water: false, isBelt: true, flat: true,
    });
  }

  // --- Quota dei volumi ------------------------------------------------------
  // Calcolata una volta sola: `buildingShadow` la mette in cache assieme ad h3d,
  // se la ricalcolassimo a runtime ombra e volume divergerebbero. I muri lunghi
  // (argini, cintura, parapetti) restano a zero: il loro centro non significa nulla.
  for (const b of city.buildings) {
    if (b.flat) continue;
    b.elev = city.elevationAt(b.x + b.w / 2, b.y + b.h / 2);
  }

  // --- Indici spaziali -------------------------------------------------------
  city.buildingGrid = new SpatialGrid(W, H, 300);
  for (const b of city.buildings) city.buildingGrid.insertRect(b);

  city.propGrid = new SpatialGrid(W, H, 220);
  for (const p of city.props) city.propGrid.insertRect({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2, prop: p });

  city.solidGrid = new SpatialGrid(W, H, 260);
  for (const b of city.buildings) city.solidGrid.insertRect(b);
  for (const p of city.props) {
    if (!p.solid) continue;
    city.solidGrid.insertRect({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2, prop: p, solid: true });
  }
  // Solidi `vehicleOnly`: fermano i veicoli, non i pedoni né i proiettili. Chi
  // interroga la griglia a piedi deve saltarli (player.js, pedestrians.js).
  for (const s of city.stairs) city.solidGrid.insertRect(s);

  city.blockGrid = new SpatialGrid(W, H, 400);
  for (const b of city.blocks) city.blockGrid.insertRect(b);

  // --- Grafo stradale --------------------------------------------------------
  city.graph = buildRoadGraph(city);

  // --- API di interrogazione -------------------------------------------------
  city.districtAt = (x, y) => districtAtNorm(x / W, y / H);

  const onSegment = (l, p) => {
    for (const s of l.segments) if (p >= s[0] && p <= s[1]) return true;
    return false;
  };

  city.isOnRoad = (x, y) => {
    for (const l of city.vLines) {
      if (Math.abs(x - l.c) < l.width / 2 && onSegment(l, y)) return true;
    }
    for (const l of city.hLines) {
      if (Math.abs(y - l.c) < l.width / 2 && onSegment(l, x)) return true;
    }
    return false;
  };

  city.isWater = (x, y) => {
    if (y <= ry0 || y >= ry1) return false;
    for (const b of city.river.bridges) if (Math.abs(x - b.x) < b.w / 2) return false;
    return true;
  };

  // Punto di partenza: davanti alla safehouse a Hongdae, su un incrocio.
  const hong = DISTRICTS.find((d) => d.id === 'hongdae');
  let spawnNode = city.graph.usableNodes[0];
  let bestD = Infinity;
  for (const n of city.graph.usableNodes) {
    const d = Math.hypot(n.x - hong.seed.x * W, n.y - hong.seed.y * H);
    if (d < bestD) { bestD = d; spawnNode = n; }
  }
  city.spawn = { x: spawnNode.x + 30, y: spawnNode.y + 30, angle: 0 };

  city.stats = {
    buildings: city.buildings.length,
    props: city.props.length,
    blocks: city.blocks.length,
    nodes: city.graph.usableNodes.length,
    edges: city.graph.edges.length,
    doglegs: city.doglegs,
    stairs: city.stairs.length,
  };

  return city;
}
