// Generazione procedurale (deterministica) di Seoul: strade, fiume Han, isolati,
// edifici estrusi, container, arredo urbano, rilievo del terreno.
import { Rng } from '../core/rng.js';
import { SpatialGrid } from '../core/spatial.js';
import { clamp, smoothstep } from '../core/math.js';
import {
  DISTRICTS, DISTRICT_BY_ID, districtAtNorm, RIVER, SEA, NAMSAN, HILLS,
  SIGN_WORDS, GANGS, URBAN_BLOBS,
} from './districts.js';
import { buildRoadGraph } from './roadgraph.js';
import { BUSINESSES, DISTRICT_MIX } from './interiors.js';

// La Seoul allargata conserva le stesse distanze stradali in pixel, ma cresce in
// entrambe le direzioni: 7200² è 1,78 volte la superficie della mappa originale
// (5400²). Le coordinate normalizzate di distretti, Han e rilievi restano quindi
// compatibili, mentre maglia, isolati e contenuto procedurale riempiono davvero
// il territorio nuovo invece di lasciare una cornice vuota.
export const WORLD = { w: 7200, h: 7200, margin: 200 };
export const SIDEWALK = 20; // profondità marciapiede attorno a ogni isolato
// Sotto questa "urbanità" (vedi `makeUrbanity`) non c'è più città: restano le
// provinciali e i campi. È la soglia che dà la sagoma a Seoul.
const RURAL_U = 0.26;
// Larghezza della banchina fra l'ultima strada e l'acqua, sulla costa ovest.
const QUAY_W = 128;

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

/** Quota del terreno: 0 sull'acqua, ~34 in pianura, fino a ~150 sui rilievi. */
export function makeElevation(w, h, seed, seaX = SEA.x1 * w) {
  const ry0 = RIVER.y0 * h;
  const ry1 = RIVER.y1 * h;
  const s1 = seed & 0xffff;
  const s2 = (seed >> 5) & 0xffff;
  const hills = HILLS.map((k) => ({
    x: k.x * w, y: k.y * h, r: k.r * w * 2.8, h: k.h ?? 110,
  }));
  return function elevationAt(x, y) {
    // **Tutta** l'acqua è quota zero — il Han e il mare a ovest — e il terreno sale
    // allontanandosi dalla riva più vicina. È questo, più le cupole dei rilievi, a
    // dare alla mappa un profilo geografico invece di un bordo quadrato.
    const dr = y < ry0 ? ry0 - y : y > ry1 ? y - ry1 : 0;
    const d = Math.min(dr, x - seaX);
    if (d <= 0) return 0;
    const t = smoothstep(clamp(d / 1250, 0, 1));
    let e = 34 * t;
    e += (valueNoise(x / 940, y / 940, s1) - 0.5) * 46 * t;
    e += (valueNoise(x / 380, y / 380, s2) - 0.5) * 16 * t;
    for (const k of hills) {
      const dn = Math.hypot(x - k.x, y - k.y) / k.r;
      if (dn < 1) e += k.h * smoothstep(1 - dn);
    }
    return e < 0 ? 0 : e;
  };
}

/**
 * Quanto un punto è "città", da 0 a 1. Le quattro centrali urbane sono cupole che
 * si sommano, il rumore ne sfrangia il bordo: quello che resta sotto `RURAL_U` non
 * riceve la maglia fitta e diventa campagna. È l'unico posto in cui è deciso *dove*
 * finisce Seoul — a valle nessuno sa niente di forme, si legge solo questo campo.
 */
export function makeUrbanity(w, h, seed) {
  const cores = URBAN_BLOBS.map((b) => ({ x: b.x * w, y: b.y * h, r: b.r * w }));
  const s = (seed >> 9) & 0xffff;
  return function urbanAt(x, y) {
    let u = 0;
    for (const c of cores) {
      const dn = Math.hypot(x - c.x, y - c.y) / c.r;
      // Profilo volutamente piatto: `smoothstep(1 - dn)` da solo si spegne quasi
      // subito e lascerebbe città solo attorno al centro esatto di ogni macchia.
      if (dn < 1) u += smoothstep(clamp((1 - dn) * 1.9, 0, 1));
    }
    // Rumore a bassa frequenza e ampiezza contenuta: serve a sfrangiare il bordo,
    // non a bucare la città. Con più ampiezza nascono risaie in mezzo a Gangnam.
    u += (valueNoise(x / 950, y / 950, s) - 0.5) * 0.34;
    return u < 0 ? 0 : u > 1 ? 1 : u;
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

  // Le gemelle dei disassamenti hanno appena spostato tutti gli indici: da qui in
  // poi l'ordine delle linee è definitivo, ed è l'unico momento in cui ha senso
  // scegliere le campate di aeroporto e porto.
  let riverCell = -1;
  for (let j = 0; j < city.hLines.length - 1; j++) {
    if (city.hLines[j].c < ry0 && city.hLines[j + 1].c > ry1) riverCell = j;
  }
  const coast = city.vLines.indexOf(city.coastLine);
  if (coast >= 0) {
    const gimpo = DISTRICT_BY_ID.gimpo;
    const docks = DISTRICT_BY_ID.docks;
    city.airport = planPlatform(city, coast, gimpo.seed.y * H, 2, riverCell);
    city.port = planPlatform(city, coast, docks.seed.y * H, 1, riverCell);
    // Se le due campate si sovrappongono vince l'aeroporto: il porto scende di una.
    if (city.airport && city.port && city.port.j0 < city.airport.j1 && city.port.j1 > city.airport.j0) {
      city.port = null;
    }
  }

  for (const axis of ['v', 'h']) {
    const lines = axis === 'v' ? city.vLines : city.hLines;
    const perp = axis === 'v' ? city.hLines : city.vLines;
    const cells = perp.length - 1;
    let art = 0;
    for (const l of lines) {
      l.on = new Array(cells).fill(true);
      // Le linee `keep` sono continue per definizione: lungomare, argini e ponti.
      // Sono le stesse che tengono insieme il grafo quando tutto il resto si dirada.
      const artIdx = l.arterial ? art++ : -1;
      if (l.keep) continue;
      let j = 0;
      while (j < cells) {
        const mid = cellCenter(perp, j);
        const cx = axis === 'v' ? l.c : mid;
        const cy = axis === 'v' ? mid : l.c;
        const u = city.urbanAt(cx, cy);
        if (u < RURAL_U) {
          // Fuori città sopravvive **una provinciale ogni due arterie** più qualche
          // strada bianca. È questo che toglie il reticolo dalla campagna: senza,
          // la maglia arriva identica fino al bordo mappa e Seoul non ha una forma.
          l.on[j] = l.arterial ? artIdx % 2 === 0 : rng.chance(0.06);
          j++;
          continue;
        }
        if (l.arterial) { j++; continue; }
        // Superblocchi: la probabilità è campionata sul distretto della cella, così
        // Gangnam e i moli si diradano davvero e Hongdae resta fitta.
        const d = districtAtNorm(cx / W, cy / H);
        // La periferia si dirada per gradi: senza questo il confine fra città e
        // campagna sarebbe una riga netta, che dall'alto si legge come un errore.
        const p = clamp(d.grid.superblock + (RURAL_U + 0.34 - u) * 0.9, 0, 0.9);
        if (rng.chance(p)) {
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
  if (riverCell >= 0) {
    for (const l of city.vLines) l.on[riverCell] = !!l.isBridge;
  }
  city.riverCell = riverCell;

  // 4) Il mare: a ovest del lungomare non passa più niente. Il lungomare è già
  //    stato promosso ad arteria (come gli argini del Han) proprio perché nessuna
  //    trasversale finisca cieca sulla battigia.
  city.coastIdx = coast;
  if (coast > 0) {
    for (let i = 0; i < coast; i++) city.vLines[i].on.fill(false);
    for (const l of city.hLines) l.on.fill(false, 0, coast);
  }

  // 5) Aeroporto e porto: due piattaforme grandi quanto una campata fra arterie.
  //    Non sono un caso speciale della geometria — si spegne quello che c'è dentro
  //    e la fusione degli isolati restituisce da sola un unico rettangolo, chiuso
  //    dalle quattro arterie che lo bordano.
  for (const r of [city.airport, city.port]) {
    if (!r) continue;
    // Le quattro arterie di bordo vanno riaccese: se il diradamento della campagna
    // ne ha spenta una, la fusione degli isolati non si ferma più lì e la
    // piattaforma si mangia mezza provincia.
    city.vLines[r.i0].on.fill(true, r.j0, r.j1);
    city.vLines[r.i1].on.fill(true, r.j0, r.j1);
    city.hLines[r.j0].on.fill(true, r.i0, r.i1);
    city.hLines[r.j1].on.fill(true, r.i0, r.i1);
    for (let i = r.i0 + 1; i < r.i1; i++) city.vLines[i].on.fill(false, r.j0, r.j1);
    for (let j = r.j0 + 1; j < r.j1; j++) city.hLines[j].on.fill(false, r.i0, r.i1);
  }
}

/**
 * Sceglie la campata fra arterie che ospiterà una piattaforma (aeroporto, porto).
 * `bands` dice quante campate prendere in verticale: una pista vuole lunghezza,
 * un terminal vuole anche profondità. Restituisce indici di linea, non coordinate:
 * le coordinate si ricavano dopo, quando le larghezze sono definitive.
 */
function planPlatform(city, i0, nearY, bands, avoidCell) {
  const vArt = [];
  for (let i = 0; i < city.vLines.length; i++) if (city.vLines[i].arterial) vArt.push(i);
  const hArt = [];
  for (let j = 0; j < city.hLines.length; j++) if (city.hLines[j].arterial) hArt.push(j);
  const i1 = vArt.find((i) => i > i0);
  if (i1 === undefined) return null;

  let k = -1;
  let bestD = Infinity;
  for (let n = 1; n < hArt.length - bands; n++) {
    const j0 = hArt[n - 1];
    const j1 = hArt[n - 1 + bands];
    // Una piattaforma non può inghiottire la cella del fiume: lì non ci sono
    // isolati da fondere e il rettangolo si spezzerebbe in due.
    if (avoidCell >= 0 && avoidCell >= j0 && avoidCell < j1) continue;
    const mid = (city.hLines[j0].c + city.hLines[j1].c) / 2;
    const d = Math.abs(mid - nearY);
    if (d < bestD) { bestD = d; k = n; }
  }
  if (k < 0) return null;
  return { i0, i1, j0: hArt[k - 1], j1: hArt[k - 1 + bands] };
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
        if (l.keep) continue;
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
    // Lati che danno sulla strada: servono alle insegne e, dalla fase 3, a sapere
    // dove può stare la porta di un negozio.
    edges: opts.streetEdges || [],
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

/**
 * Campagna (경기도): campi, serre e cascine. Un isolato rurale è enorme — nasce
 * dalla fusione di parecchie celle senza strade — quindi non si riempie di lotti:
 * si divide in appezzamenti, e solo qualcuno di questi è costruito. I campi non
 * sono edifici né cortili: sono un elenco a parte (`block.fields`) che il terreno
 * disegna, perché non devono né fermare nessuno né entrare negli indici dei solidi.
 */
function fillRuralBlock(rng, city, block, district) {
  const pad = 14;
  const area = { x: block.x + pad, y: block.y + pad, w: block.w - pad * 2, h: block.h - pad * 2 };
  if (area.w < 70 || area.h < 70) {
    block.yards.push(area);
    return;
  }
  block.fields = [];
  const cols = Math.max(1, Math.round(area.w / rng.range(210, 340)));
  const rows = Math.max(1, Math.round(area.h / rng.range(190, 310)));
  const cw = area.w / cols;
  const ch = area.h / rows;

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const fx = area.x + i * cw + 6;
      const fy = area.y + j * ch + 6;
      const fw = cw - 12;
      const fh = ch - 12;
      if (fw < 40 || fh < 40) continue;
      const roll = rng.next();

      if (roll < 0.13 && fw > 110 && fh > 90) {
        // Cascina: casa bassa più un fienile, staccati e non allineati.
        const hw = rng.range(52, Math.min(96, fw * 0.5));
        const hh = rng.range(44, Math.min(80, fh * 0.5));
        city.buildings.push(makeBuilding(rng, district, fx + rng.range(4, fw - hw - 4), fy + rng.range(4, fh - hh - 4), hw, hh, {
          style: 'brick', h3d: rng.int(24, 38), signChance: 0,
        }));
        const bw = rng.range(60, Math.min(120, fw * 0.6));
        const bh = rng.range(38, Math.min(64, fh * 0.4));
        city.buildings.push(makeBuilding(rng, district, fx + rng.range(4, Math.max(5, fw - bw - 4)), fy + fh - bh - rng.range(4, 20), bw, bh, {
          style: 'warehouse', h3d: rng.int(28, 46), signChance: 0,
        }));
        city.props.push({ type: 'silo', x: fx + fw - 22, y: fy + 24, rot: 0, z: 74, solid: true, r: 16 });
        block.yards.push({ x: fx, y: fy + fh * 0.5, w: fw, h: fh * 0.5 });
      } else if (roll < 0.30 && fw > 130 && fh > 70) {
        // Serre (비닐하우스): file di tunnel in plastica, il segno più riconoscibile
        // della campagna coreana vista dall'alto.
        const n = Math.min(5, Math.max(2, Math.floor(fh / 38)));
        const gh = Math.min(26, fh / n - 8);
        for (let k = 0; k < n; k++) {
          city.buildings.push(makeBuilding(rng, district, fx + 6, fy + k * (gh + 10), fw - 12, gh, {
            style: 'greenhouse', h3d: rng.int(16, 24), color: '#c6d3c8', signChance: 0,
          }));
        }
      } else {
        block.fields.push({
          x: fx, y: fy, w: fw, h: fh,
          crop: rng.int(0, 3),
          rows: rng.chance(0.5),
          wet: rng.chance(0.45), // risaia allagata
        });
        if (rng.chance(0.4)) {
          city.props.push({
            type: 'tree', x: fx + rng.range(6, fw - 6), y: fy + (rng.chance(0.5) ? 4 : fh - 4),
            rot: rng.range(0, 6.28), z: rng.range(48, 76), solid: false, r: 12, tint: rng.int(0, 2),
          });
        }
      }
    }
  }
}

/**
 * Aeroporto di Gimpo. Pista, raccordo e piazzale non sono edifici: sono superfici
 * dipinte (`city.runways` / `city.aprons`), come le strisce pedonali — così non
 * fermano niente e non entrano nell'ordinamento radiale. Quello che si vede in
 * volume è il terminal, la torre e gli hangar.
 */
function fillAirportBlock(rng, city, block, district) {
  const horiz = block.w >= block.h;
  const L = horiz ? block.w : block.h; // lunghezza, lungo la pista
  const D = horiz ? block.h : block.w; // profondità, dal lato pista al terminal
  const at = (u, v, uw, vh) => (horiz
    ? { x: block.x + u, y: block.y + v, w: uw, h: vh }
    : { x: block.x + v, y: block.y + u, w: vh, h: uw });

  const rwLen = L * 0.9;
  const rwOff = (L - rwLen) / 2;
  const rw = at(rwOff, D * 0.06, rwLen, Math.min(104, D * 0.2));
  city.runways.push({ ...rw, horiz, name: horiz ? '14R/32L' : '18/36' });
  const tw = at(rwOff + 30, D * 0.32, rwLen - 60, Math.min(46, D * 0.09));
  city.taxiways.push({ ...tw, horiz });
  // Due raccordi che collegano pista e piazzale: senza, l'aereo parcheggiato
  // sembra atterrato in mezzo al prato.
  for (const t of [0.16, 0.74]) {
    city.taxiways.push({ ...at(rwOff + rwLen * t, D * 0.16, 44, D * 0.2), horiz: !horiz });
  }
  const apron = at(rwOff + 40, D * 0.44, rwLen * 0.72, D * 0.26);
  city.aprons.push(apron);

  // Piazzole: una fila lungo il piazzale. Gli aerei ci vengono messi al boot
  // (`traffic.placeSpecialVehicles`), non qui: la generazione non conosce i veicoli.
  const slots = Math.max(3, Math.floor((horiz ? apron.w : apron.h) / 190));
  for (let i = 0; i < slots; i++) {
    const t = (i + 0.5) / slots;
    const sx = horiz ? apron.x + apron.w * t : apron.x + apron.w * 0.5;
    const sy = horiz ? apron.y + apron.h * 0.5 : apron.y + apron.h * t;
    city.airSpots.push({
      x: sx, y: sy,
      angle: horiz ? -Math.PI / 2 : Math.PI, // muso verso il raccordo
      kind: i % 3 === 1 ? 'heli' : 'plane',
    });
  }

  // Terminal, torre di controllo, hangar: tutto sul lato lontano dalla pista.
  const term = at(rwOff + rwLen * 0.24, D * 0.76, rwLen * 0.44, Math.max(60, D * 0.17));
  city.buildings.push(makeBuilding(rng, district, term.x, term.y, term.w, term.h, {
    style: 'glass', h3d: 62, color: '#7f8b96', signChance: 0,
  }));
  city.landmarks.push({ name: 'Aeroporto di Gimpo', hangul: '김포공항', x: term.x + term.w / 2, y: term.y + term.h / 2 });
  const tower = at(rwOff + rwLen * 0.2, D * 0.78, 46, 46);
  city.buildings.push(makeBuilding(rng, district, tower.x, tower.y, tower.w, tower.h, {
    style: 'tower', h3d: 172, color: '#9aa3ad', signChance: 0,
  }));
  for (let i = 0; i < 3; i++) {
    const hg = at(rwOff + rwLen * (0.72 + i * 0.1), D * 0.66, rwLen * 0.085, Math.max(56, D * 0.15));
    city.buildings.push(makeBuilding(rng, district, hg.x, hg.y, hg.w, hg.h, {
      style: 'warehouse', h3d: rng.int(52, 68), signChance: 0,
    }));
  }
  // Manica a vento e fari: due segni che dicono "qui si vola" anche da lontano.
  for (const t of [0.08, 0.92]) {
    const p = at(rwOff + rwLen * t, D * 0.26, 0, 0);
    city.props.push({ type: 'windsock', x: p.x, y: p.y, rot: 0, z: 62, solid: false, r: 9 });
  }
  const fuel = at(rwOff + rwLen * 0.8, D * 0.5, 0, 0);
  for (let i = 0; i < 3; i++) {
    city.props.push({ type: 'tank', x: fuel.x + (horiz ? i * 74 : 0), y: fuel.y + (horiz ? 0 : i * 74), rot: 0, z: 54, solid: true, r: 30 });
  }
  block.yards.push({ x: apron.x, y: apron.y, w: apron.w, h: apron.h });
}

/**
 * Porto di Incheon: piazzale container, capannoni, gru. I moli veri (`city.piers`)
 * escono dalla banchina verso il mare e nascono in `generateCity`, perché vivono
 * *fuori* dall'isolato — a ovest del lungomare non ci sono più celle.
 */
function fillPortBlock(rng, city, block, district) {
  const bx = block.x + SIDEWALK;
  const by = block.y + SIDEWALK;
  const bw = block.w - SIDEWALK * 2;
  const bh = block.h - SIDEWALK * 2;
  block.yards.push({ x: bx, y: by, w: bw, h: bh });

  // Capannoni doganali sul lato di terra, container e gru verso l'acqua.
  const shedW = Math.min(230, bw * 0.22);
  for (let i = 0; i < 3; i++) {
    const y = by + bh * (0.12 + i * 0.3);
    const h = Math.min(150, bh * 0.22);
    city.buildings.push(makeBuilding(rng, district, bx + bw - shedW - 20, y, shedW, h, {
      style: 'warehouse', h3d: rng.int(44, 68), streetEdges: ['right'], signChance: 0.4,
    }));
  }

  const palette = ['#c8493a', '#3f7ea8', '#cf9a2f', '#4a8f5e', '#8f5aa8', '#b7532f', '#4f6f8f'];
  const cw = 40, cl = 92;
  const yardW = bw - shedW - 70;
  const cols = Math.floor(yardW / (cw + 14));
  const rows = Math.floor(bh / (cl + 18));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (rng.chance(0.3)) continue;
      city.buildings.push({
        x: bx + 14 + i * (cw + 14), y: by + 12 + j * (cl + 18), w: cw, h: cl,
        h3d: 26 * rng.int(1, 3), elev: 0, style: 'container', color: rng.pick(palette),
        roofColor: '#2c3336', variant: rng.int(1, 3), litSeed: rng.int(0, 9999),
        district: district.id, solid: true, signs: [], landmark: false, ac: 0, water: false,
      });
    }
  }
  for (let i = 0; i < 3; i++) {
    city.props.push({
      type: 'crane', x: bx + 30, y: by + bh * (0.2 + i * 0.3),
      rot: Math.PI / 2, z: 168, solid: true, r: 28,
    });
  }
  city.landmarks.push({ name: 'Terminal container', hangul: '컨테이너 터미널', x: bx + bw * 0.4, y: by + bh / 2 });
}

/** Arredo urbano lungo i bordi di un isolato. */
function decorateBlockEdges(rng, city, block, district) {
  const step = 132;
  // Il marciapiede è la fascia interna dell'isolato: l'arredo va lì, non sull'asfalto.
  // Chioschi e distributori arrivano a 18 px di raggio: al centro della fascia
  // da 20 px restavano fisicamente sull'asfalto. Il centro va sul margine
  // interno del marciapiede, con tutto l'ingombro fuori dalla carreggiata.
  const m = SIDEWALK;
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

// ---------------------------------------------------------------------------
// NEGOZI E ATTIVITÀ
// ---------------------------------------------------------------------------
// Tutto quello che segue gira **dopo** la generazione e con un rng suo: una sola
// `rng.*` in più sulla sequenza principale ridisegnerebbe l'intera città (vedi
// HANDOFF, determinismo). Qui si decide solo *chi* sta dietro a una facciata già
// disegnata — la pianta degli interni nasce a runtime, alla prima visita.

const OUTWARD = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
const DOOR_OUT = 11; // quanto la porta sporge dalla facciata, sul marciapiede

/** Punto d'ingresso sul lato `edge` di un edificio, già sul marciapiede. */
function doorPoint(b, edge) {
  const [nx, ny] = OUTWARD[edge];
  const cx = edge === 'left' ? b.x : edge === 'right' ? b.x + b.w : b.x + b.w / 2;
  const cy = edge === 'top' ? b.y : edge === 'bottom' ? b.y + b.h : b.y + b.h / 2;
  return { x: cx + nx * DOOR_OUT, y: cy + ny * DOOR_OUT, nx, ny, edge };
}

/** Un edificio può ospitare un'attività solo se ha una facciata sulla strada. */
function shopCandidate(b) {
  return b.edges && b.edges.length > 0 && !b.landmark && !b.flat
    && b.w >= 40 && b.h >= 40 && b.style !== 'container';
}

function makeShop(city, rng, b, edge, groundId, mix) {
  const door = doorPoint(b, edge);
  // Quanti piani: l'altezza del volume, non un tiro di dado. Un palazzo di Gangnam
  // ha davvero quattro insegne in colonna, una casetta di Hongdae ne ha una.
  const levels = clamp(1 + Math.floor((b.h3d - 30) / 46), 1, 4);
  const biz = [groundId];
  for (let i = 1; i < levels; i++) biz.push(rng.pick(mix.upper));
  const first = BUSINESSES[groundId];
  const shop = {
    id: city.shops.length,
    x: door.x, y: door.y, nx: door.nx, ny: door.ny, edge,
    w: b.w, h: b.h,
    building: b,
    district: b.district,
    biz,
    name: first.label,
    hangul: first.hangul,
    blip: first.blip || null,
    seed: (city.seed + b.x * 7919 + b.y * 104729 + city.shops.length * 31) >>> 0,
  };
  b.shop = shop;
  city.shops.push(shop);
  return shop;
}

function placeShops(city) {
  const rng = new Rng((city.seed ^ 0x5e0c1) >>> 0);
  city.shops = [];
  // Una porta ogni 80 px: due vetrine attaccate diventerebbero un suggerimento
  // illeggibile e una fila di insegne sovrapposte.
  const doors = new SpatialGrid(city.w, city.h, 160);
  const near = [];

  for (const b of city.buildings) {
    if (!shopCandidate(b)) continue;
    const district = DISTRICT_BY_ID[b.district] || DISTRICTS[0];
    const mix = DISTRICT_MIX[b.district] || DISTRICT_MIX.hongdae;
    if (!rng.chance(district.signDensity * 0.55)) continue;
    const edge = rng.pick(b.edges);
    const door = doorPoint(b, edge);
    doors.queryCircle(door.x, door.y, 80, near);
    if (near.some((d) => (d.px - door.x) ** 2 + (d.py - door.y) ** 2 < 80 * 80)) continue;
    const shop = makeShop(city, rng, b, edge, rng.pick(mix.ground), mix);
    doors.insertRect({ x: door.x - 1, y: door.y - 1, w: 2, h: 2, px: shop.x, py: shop.y });
  }

  // L'ospedale del distretto diventa un posto in cui si entra davvero: la corsia
  // c'era già come punto di risveglio, mancava la porta.
  for (const hsp of city.hospitals) {
    let best = null;
    let bestD = Infinity;
    for (const b of city.buildings) {
      if (b.district !== hsp.district || !shopCandidate(b)) continue;
      const d = (b.x + b.w / 2 - hsp.x) ** 2 + (b.y + b.h / 2 - hsp.y) ** 2;
      if (d < bestD) { bestD = d; best = b; }
    }
    if (!best) continue;
    const mix = DISTRICT_MIX[best.district] || DISTRICT_MIX.hongdae;
    if (best.shop) retitle(best.shop, 'clinic');
    else makeShop(city, rng, best, rng.pick(best.edges), 'clinic', mix);
    // Il blip (e il risveglio dopo la morte) si spostano sulla porta.
    hsp.x = best.shop.x;
    hsp.y = best.shop.y;
    hsp.shop = best.shop;
  }

  ensurePawnShops(city, rng);
}

/** Cambia il mestiere del piano terra di una vetrina già piazzata. */
function retitle(shop, id) {
  const biz = BUSINESSES[id];
  shop.biz[0] = id;
  shop.name = biz.label;
  shop.hangul = biz.hangul;
  shop.blip = biz.blip || null;
}

/**
 * Un banco dei pegni per distretto. `shops.MARKETS` dà a ognuno dei sette
 * quartieri una percentuale di ricompra sua — 0,34 al porto, 0,50 a Gangnam — ma
 * `pawn` era una voce del mix come le altre e il caso ne lasciava tre distretti
 * senza. Le tre righe più caratterizzate della tabella (armi a 0,68 e auto a 1,35
 * al porto, munizioni a 1,40 in campagna) si potevano toccare solo attraverso il
 * prezzo dell'officina, e il mercato non si vedeva tutto (§6).
 *
 * Stessa forma delle officine e della clinica: si guarda cosa è già uscito dal
 * caso e **si riempie solo il buco**, così un distretto che ne ha già tre resta
 * com'è. Prima si prova a cambiare mestiere a una vetrina esistente: una porta in
 * più vuol dire un'insegna in più su una facciata che ne aveva già la sua.
 * Cliniche e 총포상 sono intoccabili — sono le due attività di cui il distretto
 * non può restare senza.
 */
function ensurePawnShops(city, rng) {
  const have = new Set();
  for (const s of city.shops) if (s.biz[0] === 'pawn') have.add(s.district);
  for (const d of DISTRICTS) {
    if (have.has(d.id)) continue;
    const dx = d.seed.x * city.w;
    const dy = d.seed.y * city.h;
    let shop = null;
    let bestD = Infinity;
    for (const s of city.shops) {
      if (s.district !== d.id || s.biz[0] === 'clinic' || s.biz[0] === 'guns') continue;
      const dd = (s.x - dx) ** 2 + (s.y - dy) ** 2;
      if (dd < bestD) { bestD = dd; shop = s; }
    }
    if (shop) { retitle(shop, 'pawn'); continue; }
    // Nessuna vetrina convertibile in tutto il distretto (succede in campagna e
    // all'aeroporto, dove le case sono poche): se ne apre una.
    let b = null;
    bestD = Infinity;
    for (const q of city.buildings) {
      if (q.district !== d.id || !shopCandidate(q) || q.shop || q.garage) continue;
      const dd = (q.x + q.w / 2 - dx) ** 2 + (q.y + q.h / 2 - dy) ** 2;
      if (dd < bestD) { bestD = dd; b = q; }
    }
    if (b) makeShop(city, rng, b, rng.pick(b.edges), 'pawn', DISTRICT_MIX[d.id] || DISTRICT_MIX.hongdae);
  }
}

/**
 * Officine di verniciatura (도색), una per distretto. La piazzola è **sulla strada**,
 * davanti a una saracinesca: i cortili interni sarebbero il posto giusto ma in tutta
 * Seoul ce ne sono undici, e solo quattro abbastanza larghi per una macchina.
 * Una per distretto è il compromesso: di più e il ricercato diventa una formalità,
 * di meno e ci si arriva con quattro stelle attaccate al paraurti.
 */
const BAY = { len: 56, wid: 78 };

function placeGarages(city) {
  city.garages = [];
  for (const d of DISTRICTS) {
    const dx = d.seed.x * city.w;
    const dy = d.seed.y * city.h;
    let best = null;
    let bestEdge = null;
    let bestD = Infinity;
    for (const b of city.buildings) {
      if (!shopCandidate(b) || b.shop || b.garage) continue;
      for (const edge of b.edges) {
        // La saracinesca deve starci: sul lato corto di un negozietto non entra.
        const span = edge === 'top' || edge === 'bottom' ? b.w : b.h;
        if (span < BAY.wid + 8) continue;
        const dd = (b.x + b.w / 2 - dx) ** 2 + (b.y + b.h / 2 - dy) ** 2;
        if (dd < bestD) { bestD = dd; best = b; bestEdge = edge; }
      }
    }
    if (!best) continue;
    best.garage = true;
    const door = doorPoint(best, bestEdge);
    const horiz = bestEdge === 'top' || bestEdge === 'bottom';
    const w = horiz ? BAY.wid : BAY.len;
    const h = horiz ? BAY.len : BAY.wid;
    const cx = door.x + door.nx * (BAY.len / 2 - DOOR_OUT);
    const cy = door.y + door.ny * (BAY.len / 2 - DOOR_OUT);
    city.garages.push({
      x: cx - w / 2, y: cy - h / 2, w, h,
      cx, cy, edge: bestEdge, horiz,
      door: { x: door.x, y: door.y },
      building: best,
      district: d.id,
      name: d.name,
    });
  }
}

// ---------------------------------------------------------------------------
// TERRITORI DELLE BANDE
// ---------------------------------------------------------------------------
// Come le vetrine: girano dopo la generazione, con un rng loro, e leggono solo
// dati già prodotti. Un territorio non è geometria nuova — è un cortile, un
// piazzale o un capannone che già esistevano, con un padrone e un tag a terra.

const TURF_ANCHORS = [
  { gang: 'baekho', district: 'hongdae' },
  { gang: 'hwangso', district: 'myeongdong' },
  { gang: 'heuksa', district: 'docks' },
  { gang: 'cheolma', district: 'gyeonggi' },
  { gang: 'heuksa', district: 'gimpo' },
  { gang: 'baekho', district: 'itaewon' },
];

// Come si chiama il posto. Dipende da *cosa* è, non da dove il piano voleva
// metterlo: il distretto preferito spesso non ha cortili buoni e la ricerca
// finisce altrove, e un "cortile dietro il club" in mezzo ai container stona.
const TURF_PLACES = {
  urban: ['Il cortile dietro il club', 'Il vicolo dei debiti', 'Il retro del mercato'],
  dock: ['Magazzino 7', 'Il piazzale dei container'],
  port: ['Magazzino 7', 'La banchina nord'],
  rural: ['Il capannone sulla provinciale', 'Il deposito fra i campi'],
};

function placeTurfs(city) {
  const rng = new Rng((city.seed ^ 0x9a11d) >>> 0);
  city.turfs = [];

  // Candidati: spazi già chiusi e già scomodi da attraversare. Un affare losco
  // vuole un posto dove non passa nessuno, non una piazza.
  const spots = [];
  for (const b of city.blocks) {
    if (b.turf || b.type === 'airport') continue;
    if (b.type === 'urban') {
      if (b.courtyard && b.courtyard.w > 110 && b.courtyard.h > 80) spots.push({ block: b, area: b.courtyard });
      else {
        for (const y of b.yards) {
          if (y.w > 100 && y.h > 74) { spots.push({ block: b, area: y }); break; }
        }
      }
    } else if (b.type === 'dock' || b.type === 'port' || b.type === 'rural') {
      for (const y of b.yards) {
        if (y.w > 200 && y.h > 150) { spots.push({ block: b, area: y }); break; }
      }
    }
  }

  for (const a of TURF_ANCHORS) {
    const g = GANGS.find((q) => q.id === a.gang);
    const d = DISTRICT_BY_ID[a.district];
    if (!g || !d) continue;
    const ax = d.seed.x * city.w;
    const ay = d.seed.y * city.h;
    // Il distretto giusto viene prima della distanza: una banda che tiene i moli
    // non può ritrovarsi con un cortile di Gangnam perché era due metri più vicino.
    // Solo se in quel distretto non c'è proprio niente si allarga la ricerca.
    let best = null;
    for (const strict of [true, false]) {
      let bestD = Infinity;
      for (const s of spots) {
        if (s.taken) continue;
        if (strict && s.block.district !== a.district) continue;
        const cx = s.area.x + s.area.w / 2;
        const cy = s.area.y + s.area.h / 2;
        // A parità di distanza vince lo spazio più grande: in un fazzoletto di
        // cento pixel non ci sta né il tag a terra né chi dovrebbe difenderlo.
        const dd = ((cx - ax) ** 2 + (cy - ay) ** 2) / (1 + (s.area.w * s.area.h) / 26000);
        if (dd < bestD) { bestD = dd; best = s; }
      }
      if (best) break;
    }
    if (!best) continue;
    best.taken = true;
    const area = best.area;
    const turf = {
      x: area.x, y: area.y, w: area.w, h: area.h,
      cx: area.x + area.w / 2, cy: area.y + area.h / 2,
      gang: g.id, name: g.name, hangul: g.hangul, color: g.color, trade: g.trade,
      place: (TURF_PLACES[best.block.type] || TURF_PLACES.urban)[city.turfs.length % 2],
      district: best.block.district,
      tag: rng.int(0, 3),
    };
    best.block.turf = turf;
    city.turfs.push(turf);

    // L'arredo è quello che rende leggibile il traffico losco: fusti, casse
    // accatastate, un faro puntato verso l'ingresso e un bidone che brucia.
    const n = 3 + rng.int(0, 3);
    for (let i = 0; i < n; i++) {
      const px = area.x + rng.range(18, Math.max(19, area.w - 18));
      const py = area.y + rng.range(18, Math.max(19, area.h - 18));
      const roll = rng.next();
      if (roll < 0.4) city.props.push({ type: 'drum', x: px, y: py, rot: rng.range(0, 6.28), z: 26, solid: true, r: 11 });
      else if (roll < 0.75) city.props.push({ type: 'crate', x: px, y: py, rot: rng.range(0, 6.28), z: 24, solid: true, r: 13 });
      else city.props.push({ type: 'floodlight', x: px, y: py, rot: rng.range(0, 6.28), z: 58, solid: true, r: 9 });
    }
    city.props.push({ type: 'brazier', x: turf.cx + rng.range(-30, 30), y: turf.cy + rng.range(-30, 30), rot: 0, z: 26, solid: false, r: 10 });
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
    // Superfici dipinte dell'aeroporto e del porto: non sono volumi né solidi.
    runways: [],
    taxiways: [],
    aprons: [],
    helipads: [],
    piers: [],
    // Dove nascono velivoli e imbarcazioni (li mette il traffico al boot).
    airSpots: [],
    boatSpots: [],
  };

  city.elevationAt = makeElevation(W, H, seed, SEA.x1 * W);
  city.urbanAt = makeUrbanity(W, H, seed);

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
      if (!l) continue;
      if (!l.arterial) { l.arterial = true; l.width = 144; }
      l.keep = true;
    }
  }

  // --- Mare (서해) e lungomare ------------------------------------------------
  // Stesso meccanismo degli argini del Han: la prima strada al di qua dell'acqua
  // diventa arteria, così è continua e nessuna trasversale finisce cieca sulla
  // battigia. A ovest di lei, in `carveMesh`, non resta più niente.
  {
    const seaX = SEA.x1 * W;
    let coast = null;
    for (const l of city.vLines) {
      // 72 = mezza arteria: la linea sta per essere allargata, e il conto va fatto
      // sulla larghezza che avrà, non su quella che ha.
      if (l.c - 72 > seaX) { coast = l; break; }
    }
    if (coast) {
      coast.arterial = true;
      coast.width = 144;
      coast.keep = true;
      city.coastLine = coast;
      city.quayX = coast.c - coast.width / 2;     // bordo strada lato acqua
      city.waterX = city.quayX - QUAY_W;          // dove comincia il mare "pieno"
    } else {
      city.quayX = 0;
      city.waterX = -1;
    }
  }

  // Tre ponti: ovest, centro, est, scelti tra le arterie verticali.
  const arterials = city.vLines.filter((l) => l.arterial && l.c > city.quayX);
  for (const frac of [0.32, 0.58, 0.86]) {
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

  // Le campate di aeroporto e porto in coordinate di mondo. Vanno lette adesso:
  // prima le larghezze non erano definitive, dopo servono a decidere il tipo di
  // isolato che la fusione greedy sta per produrre.
  for (const r of [city.airport, city.port]) {
    if (!r) continue;
    r.x = city.vLines[r.i0].c + city.vLines[r.i0].width / 2;
    r.y = city.hLines[r.j0].c + city.hLines[r.j0].width / 2;
    r.w = city.vLines[r.i1].c - city.vLines[r.i1].width / 2 - r.x;
    r.h = city.hLines[r.j1].c - city.hLines[r.j1].width / 2 - r.y;
  }
  const inside = (r, x, y) => r && x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;

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
  const peaks = HILLS.map((k) => ({ x: k.x * W, y: k.y * H, r: k.r * W }));
  let towerAssigned = false;

  // La cella a ovest del lungomare è mare: niente isolati, come per il fiume.
  if (city.coastIdx > 0) {
    for (let j = 0; j < cellsY; j++) {
      for (let i = 0; i < city.coastIdx; i++) used[at(i, j)] = 1;
    }
  }

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
      const onHill = peaks.some((k) => Math.hypot(cx - k.x, cy - k.y) < k.r);
      const nearRiver = Math.abs(cy - ry0) < 260 || Math.abs(cy - ry1) < 260;
      const u = city.urbanAt(cx, cy);

      let type = 'urban';
      if (inside(city.airport, cx, cy)) type = 'airport';
      else if (inside(city.port, cx, cy)) type = 'port';
      else if (onHill) type = 'park';
      // Ritaglio troppo stretto anche per una fila di negozi: fazzoletto verde
      // (쌈지공원), che è quello che ci starebbe davvero.
      else if (w < 64 || h < 64) type = 'park';
      // Fuori città l'isolato non è un isolato: è campagna, e ogni tanto un bosco.
      else if (u < RURAL_U) type = rng.chance(0.16) ? 'park' : 'rural';
      else if (district.id === 'docks' && (nearRiver || rng.chance(0.55))) type = 'dock';
      else if (rng.chance(0.045)) type = 'park';

      const block = { x, y, w, h, type, district: district.id, onArterial, yards: [], alleys: [] };
      city.blocks.push(block);

      if (type === 'urban') fillUrbanBlock(rng, city, block, district);
      else if (type === 'dock') fillDockBlock(rng, city, block, district);
      else if (type === 'rural') fillRuralBlock(rng, city, block, district);
      else if (type === 'airport') fillAirportBlock(rng, city, block, district);
      else if (type === 'port') fillPortBlock(rng, city, block, district);
      else {
        const isTower = inNamsan && !towerAssigned && Math.hypot(cx - namsanCx, cy - namsanCy) < namsanR * 0.45;
        if (isTower) towerAssigned = true;
        fillParkBlock(rng, city, block, district, isTower);
      }

      // Lampioni, panchine e chioschi vogliono un marciapiede: sulla pista, in
      // mezzo alle risaie e sul piazzale container non ci sono marciapiedi.
      if (type !== 'airport' && type !== 'rural') decorateBlockEdges(rng, city, block, district);
      if (type !== 'airport') decorateYards(rng, city, block);
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
        // Il lungofiume finisce dove comincia il mare: senza questa riga il Han
        // Park continua sull'acqua e ci si ritrova un filare di alberi al largo.
        if (x < city.quayX) continue;
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

  // --- Costa, moli e ormeggi -------------------------------------------------
  // La battigia è ondulata (`coastAt`) ma **sempre a ovest di `waterX`**: la maglia
  // stradale è già stata tagliata su quel valore, e una costa che sconfinasse a est
  // annegherebbe il lungomare. I moli sono terra dentro l'acqua, quindi `isWater`
  // deve conoscerli: è l'unica eccezione oltre ai ponti.
  if (city.waterX > 0) {
    const cs = (seed >> 3) & 0xffff;
    // La battigia oscilla parecchio — fino a mezzo chilometro di piana di marea
    // (갯벌) fra l'acqua e la banchina. È l'unico bordo davvero irregolare della
    // mappa, e va tenuto **sempre a ovest di `waterX`**: la maglia stradale è già
    // stata tagliata su quel valore, e una costa che sconfinasse annegherebbe il
    // lungomare.
    city.coastAt = (y) => city.waterX - 40 - 520 * valueNoise(y / 620, 11.5, cs);

    const band = city.port
      ? { y0: city.port.y, y1: city.port.y + city.port.h }
      : { y0: H * 0.58, y1: H * 0.88 };
    const nPiers = 4;
    for (let i = 0; i < nPiers; i++) {
      const t = (i + 0.5) / nPiers;
      const len = rng.range(260, 420);
      const wid = rng.range(76, 108);
      const py = band.y0 + (band.y1 - band.y0) * t - wid / 2;
      // Il molo parte dalla banchina e arriva `len` px dentro l'acqua: la battigia
      // qui può essere lontana mezzo chilometro, quindi la lunghezza si misura da lei.
      const shore = city.coastAt(py + wid / 2);
      const pier = { x: shore - len, y: py, w: len + (city.quayX - shore), h: wid, index: i };
      city.piers.push(pier);
      // Bitte lungo il molo e una gru ogni tanto: senza, è una lingua di cemento.
      const bolls = Math.floor(pier.w / 90);
      for (let k = 1; k < bolls; k++) {
        city.props.push({ type: 'bollard', x: pier.x + k * 90, y: pier.y + 8, rot: 0, z: 16, solid: false, r: 7 });
        city.props.push({ type: 'bollard', x: pier.x + k * 90, y: pier.y + pier.h - 8, rot: 0, z: 16, solid: false, r: 7 });
      }
      if (rng.chance(0.6)) {
        city.props.push({ type: 'crane', x: pier.x + pier.w * 0.4, y: pier.y + pier.h / 2, rot: 0, z: 150, solid: true, r: 26 });
      }
      // Ormeggi: due imbarcazioni per molo, una per lato, in acqua vera.
      for (const side of [-1, 1]) {
        city.boatSpots.push({
          x: pier.x + len * 0.45,
          y: pier.y + (side < 0 ? -36 : pier.h + 36),
          angle: Math.PI, // muso al largo: ormeggiata verso terra non parte
          kind: i % 2 ? 'ferry' : 'boat',
        });
      }
    }

    // Banchina: bitte e casse lungo tutto il lungomare, non solo al porto.
    for (let y = M + 200; y < H - M - 200; y += 260) {
      city.props.push({ type: 'bollard', x: city.quayX - 26, y, rot: 0, z: 16, solid: false, r: 7 });
      if (rng.chance(0.35)) {
        city.props.push({ type: 'crate', x: city.quayX - 64, y: y + 30, rot: rng.range(0, 6.28), z: 22, solid: true, r: 13 });
      }
    }
  }

  // Scali fluviali sul Han: pontili corti da cui si prende una barca senza dover
  // arrivare fino al porto. Il fiume attraversa tutta la mappa, ed è la scorciatoia
  // più veloce che esista fra le due sponde.
  for (const frac of [0.34, 0.62, 0.86]) {
    const px = frac * W;
    if (px < city.quayX + 200) continue;
    for (const bankY of [ry0, ry1]) {
      const up = bankY === ry0;
      const pier = { x: px - 46, y: up ? ry0 : ry1 - 78, w: 92, h: 78, river: true };
      city.piers.push(pier);
      city.boatSpots.push({
        x: px + 78, y: up ? ry0 + 52 : ry1 - 52,
        angle: 0, kind: 'boat',
      });
    }
  }

  // Eliporti: uno sul piazzale dell'aeroporto, uno al porto, uno sul lungofiume.
  if (city.airport) {
    city.helipads.push({ x: city.airport.x + city.airport.w * 0.86, y: city.airport.y + city.airport.h * 0.55, r: 46 });
  }
  if (city.port) {
    const pad = { x: city.port.x + city.port.w * 0.5, y: city.port.y + city.port.h * 0.9, r: 44 };
    city.helipads.push(pad);
    city.airSpots.push({ x: pad.x, y: pad.y, angle: -Math.PI / 2, kind: 'heli' });
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
      // Una corsia vuole un edificio con una porta sulla strada: in mezzo ai campi
      // e sulla pista non ce n'è, e chi muore lì si sveglia nel distretto vicino.
      if (b.district !== d.id || b.type !== 'urban') continue;
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

  // --- Commissariati ---------------------------------------------------------
  // Stesso metodo degli ospedali, e per la stessa ragione: si sceglie fra isolati
  // che esistono già, quindi **non si pesca un solo numero dall'rng** e la città
  // resta identica a quella collaudata. Uno per distretto urbano — dove non ci
  // sono isolati di città (campagna, aeroporto) non ce n'è nessuno, e la polizia
  // arriva da fuori come faceva prima.
  city.stations = [];
  for (const d of DISTRICTS) {
    const hsp = city.hospitals.find((h) => h.district === d.id);
    const cx = d.seed.x * W;
    const cy = d.seed.y * H;
    let best = null;
    let bestD = Infinity;
    for (const b of city.blocks) {
      if (b.district !== d.id || b.type !== 'urban' || b.hospital) continue;
      if (b.w < 150 || b.h < 150) continue;
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;
      // Lontano dall'ospedale: due blip a due passi sulla minimappa sono un blip solo.
      if (hsp && (bx - hsp.x) ** 2 + (by - hsp.y) ** 2 < 420 * 420) continue;
      const dd = (bx - cx) ** 2 + (by - cy) ** 2;
      if (dd < bestD) { bestD = dd; best = b; }
    }
    if (!best) continue;
    best.station = true;
    // Sul marciapiede a sud, mentre l'ospedale sta su quello a nord: quando i due
    // finiscono sullo stesso isolato restano comunque due posti diversi.
    city.stations.push({
      x: best.x + best.w / 2,
      y: best.y + best.h - SIDEWALK * 0.78,
      district: d.id,
      name: d.name,
    });
  }

  // --- Negozi, attività ai piani e officine ----------------------------------
  placeShops(city);
  placeGarages(city);
  // Deve girare prima degli indici spaziali: aggiunge props.
  placeTurfs(city);

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
      for (let [a, b] of pieces) {
        // Alla foce l'argine non c'è: il Han si apre nel mare. Senza questo taglio
        // il muretto continua sull'acqua e una barca che risale la costa ci sbatte.
        a = Math.max(a, city.quayX);
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

  if (!city.coastAt) city.coastAt = () => -1e9;

  /**
   * Acqua navigabile: il Han e il mare a ovest. Ponti e moli sono le due sole
   * eccezioni — sopra ci si cammina e ci si guida. Ci passano il rilevamento di
   * annegamento, la fisica delle imbarcazioni e il disegno del terreno, quindi
   * deve restare senza allocazioni.
   */
  city.isWater = (x, y) => {
    const inRiver = y > ry0 && y < ry1;
    const inSea = x < city.coastAt(y);
    if (!inRiver && !inSea) return false;
    if (inRiver) {
      for (const b of city.river.bridges) if (Math.abs(x - b.x) < b.w / 2) return false;
    }
    for (const p of city.piers) {
      if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return false;
    }
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
    shops: city.shops.length,
    venues: city.shops.reduce((n, s) => n + s.biz.length, 0),
    garages: city.garages.length,
    rural: city.blocks.filter((b) => b.type === 'rural').length,
    piers: city.piers.length,
    turfs: city.turfs.length,
  };

  return city;
}
