// Jeju (제주): un'isola vulcanica. Rifatta nel §5.41.
//
// Prima era un rettangolo con gli angoli arrotondati su un reticolo uniforme, con
// un fiume dritto che lo tagliava in due. Adesso:
//  - la **costa** è un poligono rugoso (maschera a 8 px, `coastmask.js`), più gli
//    isolotti (Udo, Chagwido, Gapado, Marado) che non si raggiungono su gomma;
//  - **Hallasan** è un cono al centro: sopra la sua quota alta non c'è una strada, e
//    ai suoi piedi corre un anello interno collegato alla costa da raggi di campagna;
//  - la **strada costiera** (일주도로) è un anello a gradini che segue la riva a
//    distanza, e dove attraversa Jeju-si e Seogwipo resta dritta;
//  - **Jeju-si** a nord (con l'aeroporto e il porto), **Seogwipo** a sud e una
//    manciata di villaggi sul litorale; in mezzo, campagna con mandarini e
//    muretti di pietra lavica.
// La geografia sta qui; edifici, vetrine e landmark sono in `regionkit.js`.
import { Rng } from '../core/rng.js';
import { createMask, blobPoly, roughen, valueNoise, smooth } from './coastmask.js';
import { pathLegs, staircase, buildNetwork, makeRoadHit, clipLegs, farmRoads, horizontalAt } from './netgen.js';
import * as kit from './regionkit.js';

export const JEJU_SEED = 20260808;
export const JEJU_WORLD = { w: 7200, h: 4800, margin: 220 };

const REGION = 'jeju';
// Il centro dell'isola e il cono. Il cono è un'ellisse più larga che alta, come la
// vera Hallasan: il lato lungo corre est-ovest.
const CENTER = { x: 3600, y: 2400 };
const HALLA = { x: 3600, y: 2480, rx: 1500, ry: 600, h: 300 };

// Gli id sono compatibili con traffico, pedoni, negozi e salvataggi. Posizioni,
// colori, pesi e **mix di negozi** descrivono solo Jeju.
const DISTRICTS = [
  {
    id: 'hongdae', name: 'Jeju City', hangul: '제주시', subtitle: 'Dongmun, il mercato e i vicoli sotto il vulcano',
    seed: { x: 0.45, y: 0.25 }, block: { minLot: 56, maxLot: 118, gapChance: 0.11 }, grid: { step: [150, 245], superblock: 0.14, jog: 0.2 },
    heights: [34, 120], styles: ['stone', 'concrete', 'panel'], facade: ['#b4a58c', '#8f8b82', '#a58f7a', '#7d8c90', '#c0b090'], roof: '#52443d',
    accent: '#ff9b5f', accent2: '#7cf3ff', ground: '#30333b', sidewalk: '#5a575a', signDensity: 0.86, treeDensity: 0.16,
    signWords: ['동문시장', '흑돼지', '감귤', '카페', '편의점', '해산물', '민박', '렌터카'],
    mix: {
      ground: ['conv', 'conv', 'heuk', 'heuk', 'hoe', 'cafe', 'cafe', 'bunsik', 'pharma', 'pawn', 'clothes', 'bar'],
      upper: ['home', 'home', 'pcbang', 'noraebang', 'office', 'bar', 'cafe'],
    },
    trafficDensity: 1, pedDensity: 1.5, pedMix: ['tourist', 'tourist', 'civil', 'civil', 'student', 'worker'], vehicleMix: ['hatch', 'sedan', 'taxi', 'suv', 'van', 'bus'],
  },
  {
    id: 'myeongdong', name: 'Seongsan', hangul: '성산', subtitle: 'Il cratere dell’alba e le case di pietra',
    seed: { x: 0.86, y: 0.36 }, block: { minLot: 72, maxLot: 154, gapChance: 0.14 }, grid: { step: [170, 280], superblock: 0.2, jog: 0.12 },
    heights: [26, 78], styles: ['stone', 'stone', 'panel'], facade: ['#6c6a64', '#7a766c', '#5f6460', '#8a806e'], roof: '#3a3633',
    accent: '#ffd36a', accent2: '#ff7a6a', ground: '#33342f', sidewalk: '#5a554b', signDensity: 0.6, treeDensity: 0.26,
    signWords: ['해녀', '전복', '민박', '일출봉', '성게', '카페', '편의점'],
    mix: { ground: ['hoe', 'hoe', 'heuk', 'cafe', 'conv', 'bunsik', 'pawn'], upper: ['home', 'home', 'home', 'bar'] },
    trafficDensity: 0.78, pedDensity: 1, pedMix: ['tourist', 'tourist', 'civil', 'worker'], vehicleMix: ['hatch', 'suv', 'suv', 'taxi', 'van', 'bus'],
  },
  {
    id: 'itaewon', name: 'Aewol', hangul: '애월', subtitle: 'Caffè sul mare, muretti di pietra e surfisti',
    seed: { x: 0.14, y: 0.42 }, block: { minLot: 64, maxLot: 142, gapChance: 0.19 }, grid: { step: [190, 330], superblock: 0.3, jog: 0.16 },
    heights: [26, 84], styles: ['panel', 'stone', 'brick'], facade: ['#9fc4bd', '#e0b8a0', '#b4c8d8', '#d8d0a8', '#c8a0a8'], roof: '#4a4440',
    accent: '#4ad9d1', accent2: '#ffad5e', ground: '#2f3530', sidewalk: '#555a4e', signDensity: 0.64, treeDensity: 0.33,
    signWords: ['카페', '서핑', '펜션', '브런치', '바다', '감귤', '민박', '편의점'],
    mix: { ground: ['cafe', 'cafe', 'cafe', 'bar', 'clothes', 'conv', 'bunsik', 'hoe'], upper: ['home', 'home', 'bar', 'cafe'] },
    trafficDensity: 0.7, pedDensity: 0.95, pedMix: ['tourist', 'tourist', 'student', 'civil', 'worker'], vehicleMix: ['hatch', 'suv', 'scooter', 'van', 'sedan'],
  },
  {
    id: 'gangnam', name: 'Seogwipo', hangul: '서귀포', subtitle: 'Cascate, alberghi e il lungomare del sud',
    seed: { x: 0.56, y: 0.78 }, block: { minLot: 92, maxLot: 198, gapChance: 0.08 }, grid: { step: [220, 360], superblock: 0.33, jog: 0.08 },
    heights: [50, 190], styles: ['glass', 'concrete', 'panel'], facade: ['#dfe4e2', '#c9d6d8', '#a6c4cc', '#e4d4b8', '#96b4bc'], roof: '#3b5058',
    accent: '#5fe3ff', accent2: '#d49aff', ground: '#2d3337', sidewalk: '#53616b', signDensity: 0.58, treeDensity: 0.25,
    signWords: ['호텔', '리조트', '감귤', '카페', '폭포', '렌터카', '횟집', '편의점'],
    mix: { ground: ['cafe', 'hoe', 'hoe', 'conv', 'clothes', 'pharma', 'bar', 'pawn', 'heuk'], upper: ['office', 'home', 'home', 'noraebang', 'cafe', 'pcbang'] },
    trafficDensity: 1.05, pedDensity: 1.25, pedMix: ['tourist', 'tourist', 'office', 'civil', 'civil'], vehicleMix: ['sedan', 'suv', 'sport', 'taxi', 'bus', 'van'],
  },
  {
    id: 'docks', name: 'Jeju Port', hangul: '제주항', subtitle: 'Traghetti, container e carichi senza domande',
    seed: { x: 0.68, y: 0.22 }, block: { minLot: 120, maxLot: 230, gapChance: 0.25 }, grid: { step: [300, 520], superblock: 0.5, jog: 0.04 },
    heights: [24, 70], styles: ['warehouse', 'warehouse', 'panel'], facade: ['#5c7a80', '#4d6a72', '#6f7a70', '#58666a'], roof: '#34464a',
    accent: '#ffd15a', accent2: '#63e0aa', ground: '#292e30', sidewalk: '#4a5351', signDensity: 0.25, treeDensity: 0.04,
    signWords: ['여객터미널', '물류', '냉동창고', '수산', '해운', '세관'],
    mix: { ground: ['pawn', 'guns', 'bar', 'conv', 'hoe'], upper: ['home', 'office', 'billiards'] },
    trafficDensity: 0.55, pedDensity: 0.42, pedMix: ['worker', 'worker', 'gangster', 'civil'], vehicleMix: ['truck', 'truck', 'van', 'suv', 'sedan'],
  },
  {
    id: 'gimpo', name: 'Jeju Airport', hangul: '제주공항', subtitle: 'Piste, hangar e la porta dell’isola',
    seed: { x: 0.33, y: 0.3 }, block: { minLot: 90, maxLot: 190, gapChance: 0.25 }, grid: { step: [320, 560], superblock: 0.52, jog: 0.04 },
    heights: [22, 62], styles: ['warehouse', 'panel', 'warehouse'], facade: ['#c8d0d4', '#aab4ba', '#8d99a0', '#b4bcc0'], roof: '#46525a',
    accent: '#6fd8ff', accent2: '#ffe77c', ground: '#30362e', sidewalk: '#4e5a55', signDensity: 0.2, treeDensity: 0.18,
    signWords: ['공항', '렌터카', '택시', '주차', '면세점'],
    mix: { ground: ['conv', 'cafe', 'bunsik', 'pharma', 'pawn'], upper: ['office', 'home', 'pcbang'] },
    trafficDensity: 0.6, pedDensity: 0.52, pedMix: ['worker', 'tourist', 'tourist', 'civil', 'office'], vehicleMix: ['van', 'truck', 'sedan', 'bus', 'suv', 'taxi'],
  },
  {
    id: 'gyeonggi', name: 'Hallasan', hangul: '한라산', subtitle: 'Mandarini, muretti di basalto e boschi di cedro',
    seed: { x: 0.5, y: 0.52 }, block: { minLot: 80, maxLot: 170, gapChance: 0.25 }, grid: { step: [380, 680], superblock: 0.62, jog: 0.02 },
    heights: [18, 52], styles: ['stone', 'stone', 'greenhouse'], facade: ['#6a6c5a', '#5f705a', '#7c7462', '#586a54'], roof: '#3f4a36',
    accent: '#a7e45a', accent2: '#ffd05a', ground: '#343b28', sidewalk: '#4f5542', signDensity: 0.1, treeDensity: 0.58,
    signWords: ['감귤', '농장', '민박', '흑돼지'],
    mix: { ground: ['conv', 'bunsik', 'heuk', 'pawn', 'cafe'], upper: ['home', 'home', 'billiards'] },
    trafficDensity: 0.32, pedDensity: 0.25, pedMix: ['worker', 'civil', 'civil', 'tourist'], vehicleMix: ['tractor', 'truck', 'van', 'hatch', 'suv'],
  },
];

const GANGS = [
  { id: 'baekho', name: 'Tigre Bianca', hangul: '백호파', color: '#e8e2d0', trade: 'armi' },
  { id: 'heuksa', name: 'Serpe Nera', hangul: '흑사파', color: '#7d5ce0', trade: 'contrabbando' },
  { id: 'cheolma', name: 'Cavallo di Ferro', hangul: '철마파', color: '#ff7a29', trade: 'auto rubate' },
  { id: 'hwangso', name: 'Bue Giallo', hangul: '황소파', color: '#ffd23f', trade: 'usura' },
];

// I landmark cercano un lotto vicino all'ancora (normalizzata) fra gli isolati.
const LANDMARKS = [
  { id: 'dongmun-market', name: 'Dongmun Market', hangul: '동문시장', label: 'Mercato Dongmun', kind: 'market', district: 'hongdae', target: [0.45, 0.25], style: 'warehouse', w: 150, h: 110, h3d: 70, color: '#ae7152', roofColor: '#554139', types: ['urban'] },
  { id: 'jeju-city', name: 'Jeju City', hangul: '제주시', label: 'Città di Jeju', kind: 'city', district: 'hongdae', target: [0.5, 0.27], style: 'tower', w: 100, h: 100, h3d: 175, color: '#6e8a94', roofColor: '#394e57', types: ['urban'] },
  { id: 'seongsan-ilchulbong', name: 'Seongsan Ilchulbong', hangul: '성산일출봉', label: 'Picco dell’alba di Seongsan', kind: 'coastal', district: 'myeongdong', target: [0.91, 0.31], style: 'hill', w: 170, h: 140, h3d: 190, color: '#527b58', roofColor: '#38543c' },
  { id: 'jusangjeolli', name: 'Jusangjeolli Coast', hangul: '주상절리', label: 'Scogliere di Jusangjeolli', kind: 'coastal', district: 'gangnam', target: [0.46, 0.79], style: 'hill', w: 170, h: 120, h3d: 110, color: '#4e6664', roofColor: '#364b4c' },
  { id: 'seogwipo', name: 'Seogwipo', hangul: '서귀포', label: 'Città di Seogwipo', kind: 'city', district: 'gangnam', target: [0.57, 0.75], style: 'glass', w: 100, h: 100, h3d: 190, color: '#527b95', roofColor: '#304654', types: ['urban'] },
  { id: 'hallasan', name: 'Hallasan', hangul: '한라산', label: 'Monte Hallasan', kind: 'mountain', district: 'gyeonggi', target: [0.5, 0.5], style: 'hill', w: 150, h: 104, h3d: 360, color: '#3d6746', roofColor: '#294231', types: ['park'] },
];

const TRANSIT = [
  { id: 'jeju-city', name: 'Jeju City Station', label: 'Stazione Jeju City', hangul: '제주시청역', target: [0.44, 0.27], lines: ['Jeju-1'] },
  { id: 'dongmun', name: 'Dongmun Market Station', label: 'Stazione Dongmun Market', hangul: '동문시장역', target: [0.5, 0.26], lines: ['Jeju-1', 'Port'] },
  { id: 'jeju-airport', name: 'Jeju Airport Station', label: 'Stazione Aeroporto di Jeju', hangul: '제주공항역', target: [0.32, 0.375], lines: ['Airport', 'Jeju-1'] },
  { id: 'aewol', name: 'Aewol Station', label: 'Stazione costiera di Aewol', hangul: '애월역', target: [0.14, 0.42], lines: ['West Coast'] },
  { id: 'hallasan', name: 'Hallasan Trailhead', label: 'Capolinea sentieri Hallasan', hangul: '한라산입구', target: [0.5, 0.37], lines: ['Mountain'] },
  { id: 'seogwipo', name: 'Seogwipo Terminal', label: 'Terminal degli autobus di Seogwipo', hangul: '서귀포버스터미널', target: [0.56, 0.78], lines: ['Jeju-Express'] },
  { id: 'seongsan', name: 'Seongsan Station', label: 'Stazione Seongsan', hangul: '성산역', target: [0.86, 0.36], lines: ['East Coast'] },
];

// ---------------------------------------------------------------------------
// GEOGRAFIA
// ---------------------------------------------------------------------------

function makeCoast(seed) {
  const { w, h } = JEJU_WORLD;
  const mask = createMask(w, h, 8);
  // L'isola principale: un'ellisse lunga e stretta (73×31 km veri) con la
  // rugosità di una costa lavica; poi il promontorio di Seongsan a est.
  const main = roughen(blobPoly(CENTER.x, CENTER.y, 3040, 1640, seed ^ 0x11, { n: 120, rough: 0.07, rot: -0.04 }), seed ^ 0x12, { depth: 3, amp: 0.15 });
  mask.paint(main, 1);
  mask.paint(roughen(blobPoly(6560, 1470, 300, 210, seed ^ 0x13, { n: 36, rough: 0.12 }), seed ^ 0x14, { depth: 2, amp: 0.2 }), 1);
  // Isolotti: Udo (nord-est), Chagwido (nord-ovest), Gapado e Marado (sud).
  const islets = [[6820, 1010, 120, 90], [900, 900, 70, 55], [2250, 4300, 95, 70], [2020, 4560, 55, 40]];
  islets.forEach(([x, y, rx, ry], i) => mask.paint(roughen(blobPoly(x, y, rx, ry, seed ^ (0x20 + i), { n: 24, rough: 0.15 }), seed ^ (0x30 + i), { depth: 2, amp: 0.2 }), 1));
  return mask;
}

/** Spiagge e scogliere: bassa frequenza, deterministica. Sabbia chiara o basalto scuro. */
export function shoreKind(x, y) {
  return valueNoise(x / 900, y / 900, 0x5ea) > 0.5 ? 'sand' : 'basalt';
}

/** Campiona un anello a distanza `inset` dalla riva lungo raggi dal centro. */
function ringSamples(mask, { inset, n = 720, rx = 3040, ry = 1640, from = -Math.PI / 2, erode = 7, blur = 9 }) {
  const rad = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = from + (i / n) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    let r = 1.35;
    while (r > 0.2) {
      const x = CENTER.x + c * rx * r;
      const y = CENTER.y + s * ry * r;
      if (mask.land(x, y) && mask.shoreDist(x, y) >= inset) break;
      r -= 0.004;
    }
    rad[i] = r;
  }
  // Erosione (minimo) per non seguire le baie piccole, poi media per ammorbidire.
  const er = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = Infinity;
    for (let k = -erode; k <= erode; k++) m = Math.min(m, rad[(i + k + n) % n]);
    er[i] = m;
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -blur; k <= blur; k++) sum += er[(i + k + n) % n];
    const r = sum / (2 * blur + 1);
    const t = from + (i / n) * Math.PI * 2;
    out.push([CENTER.x + Math.cos(t) * rx * r, CENTER.y + Math.sin(t) * ry * r]);
  }
  return out;
}

function makeElevation(city, mask, seed) {
  return (x, y) => {
    if (!mask.land(x, y)) return 0;
    const s = mask.shoreDist(x, y);
    // Rampa costiera: l'isola sale dolcemente dalla riva, senza gradino sulla battigia.
    let e = (12 + 34 * smooth(s / 1500)) * smooth(s / 170);
    const d = Math.hypot((x - HALLA.x) / HALLA.rx, (y - HALLA.y) / HALLA.ry);
    if (d < 1) {
      e += HALLA.h * Math.pow(1 - d, 1.35);
      // Il cratere: una conca sommitale.
      if (d < 0.07) e -= 28 * (1 - d / 0.07);
    }
    for (const o of city.oreums || []) {
      const dd = Math.hypot(x - o.x, y - o.y) / o.r;
      if (dd < 1) e += o.h * (1 - dd) * (1 - dd);
    }
    e += (valueNoise(x / 420, y / 420, seed ^ 0x8b1d) - 0.5) * 14 * smooth(s / 300);
    return Math.max(0, e);
  };
}

// ---------------------------------------------------------------------------
// TRACCIATI DI SERVIZIO
// ---------------------------------------------------------------------------

/** Villaggio: una piccola griglia addossata a un tratto dell'anello, sul lato dell'isola. */
function villageLegs(legs, target, { cols = 3, spacing = 300, depth = 380 }, ok) {
  let best = null;
  let bd = Infinity;
  for (const l of legs) {
    if (!l.arterial || l.b - l.a < cols * spacing + 120) continue;
    const half = (cols * spacing) / 2 + 60;
    const along = Math.max(l.a + half, Math.min(l.b - half, l.axis === 'h' ? target.x : target.y));
    const px = l.axis === 'h' ? along : l.c;
    const py = l.axis === 'h' ? l.c : along;
    const d = Math.hypot(px - target.x, py - target.y);
    if (d < bd) { bd = d; best = { l, along }; }
  }
  if (!best) return null;
  const { l, along } = best;
  const p0 = Math.round((along - (cols * spacing) / 2) / 20) * 20;
  const toward = l.axis === 'h' ? (CENTER.y > l.c ? 1 : -1) : (CENTER.x > l.c ? 1 : -1);
  const far = l.c + toward * depth;
  const out = [];
  for (let k = 0; k <= cols; k++) {
    const p = p0 + k * spacing;
    out.push({ axis: l.axis === 'h' ? 'v' : 'h', c: p, a: Math.min(l.c, far), b: Math.max(l.c, far), arterial: false });
  }
  out.push({ axis: l.axis, c: far, a: p0, b: p0 + cols * spacing, arterial: false });
  out.push({ axis: l.axis, c: Math.round((l.c + far) / 40) * 20, a: p0, b: p0 + cols * spacing, arterial: false });
  const lo = Math.min(l.c, far) - 80;
  const hi = Math.max(l.c, far) + 80;
  const rect = l.axis === 'h'
    ? { x0: p0 - 80, x1: p0 + cols * spacing + 80, y0: lo, y1: hi }
    : { x0: lo, x1: hi, y0: p0 - 80, y1: p0 + cols * spacing + 80 };
  for (const o of out) if (!ok(o.axis, o.c, o.a, o.b)) return null;
  return { legs: out, rect };
}

// ---------------------------------------------------------------------------
// GENERAZIONE
// ---------------------------------------------------------------------------

const SUBURBS = [
  { x0: 1000, x1: 2400, y0: 1850, y1: 3200 }, { x0: 4700, x1: 6300, y0: 1750, y1: 3300 }, { x0: 1900, x1: 4900, y0: 3050, y1: 3700 }, { x0: 2000, x1: 3100, y0: 1750, y1: 2500 }, { x0: 4700, x1: 6000, y0: 3300, y1: 3800 },
];
const inRect = (x, y, r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

export function createJejuCity(seed = JEJU_SEED) {
  const rng = new Rng(seed);
  const { w: W, h: H } = JEJU_WORLD;
  const districts = DISTRICTS.map((d) => kit.cloneDistrict(d, REGION));
  // Lotti più stretti e meno vuoti di quelli di Seoul: sulla costa si costruisce fitto.
  const LOT = { hongdae: 0.6, myeongdong: 0.62, itaewon: 0.6, gangnam: 0.7, docks: 0.9, gimpo: 0.85, gyeonggi: 0.85 };
  for (const d of districts) { d.lotScale = (LOT[d.id] ?? 0.85) * 0.78; d.gapScale = 0.5; d.shopScale = 1.6; }
  const byId = Object.fromEntries(districts.map((d) => [d.id, d]));
  const city = {
    w: W, h: H, margin: JEJU_WORLD.margin, seed, region: { id: 'jeju', name: 'Jeju', hangul: '제주' }, name: 'Jeju', nameIt: 'Jeju', hangul: '제주',
    vLines: [], hLines: [], river: { id: 'hancheon-stream', name: 'Hancheon Stream', hangul: '한천', label: 'Torrente Hancheon', y0: 0, y1: 0, bridges: [] },
    blocks: [], buildings: [], props: [], landmarks: [], crosswalks: [], intersections: [], runways: [], taxiways: [], aprons: [], helipads: [], piers: [], airSpots: [], boatSpots: [], stairs: [],
    districts, districtById: byId, getDistrict: (id) => byId[id] || null, oreums: [],
  };
  const mask = makeCoast(seed);
  city.mask = mask;

  // --- acqua, quota, distretti ---------------------------------------------
  // I moli sono terra calpestabile dentro l'acqua: l'eccezione si legge al volo.
  city.isWater = (x, y) => {
    for (const p of city.piers) if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return false;
    return !mask.land(x, y);
  };
  city.elevationAt = makeElevation(city, mask, seed);
  city.shoreDist = (x, y) => mask.shoreDist(x, y);
  city.shoreKind = shoreKind;
  const seeds = districts.map((d) => ({ d, x: d.seed.x * W, y: d.seed.y * H, k: d.id === 'gyeonggi' ? 0.55 : 1 }));
  city.districtAt = (x, y) => {
    let best = seeds[0].d;
    let bd = Infinity;
    for (const s of seeds) {
      const dd = ((x - s.x) ** 2 + (y - s.y) ** 2) * s.k;
      if (dd < bd) { bd = dd; best = s.d; }
    }
    return best;
  };
  city.urbanZones = [];
  city.urbanAt = (x, y) => {
    if (!mask.land(x, y)) return 0;
    for (const z of city.urbanZones) if (inRect(x, y, z)) return 0.8;
    return 0.12;
  };
  const scan = {
    north: (x) => { for (let y = 0; y < H; y += 8) if (mask.land(x, y)) return y; return null; },
    south: (x) => { for (let y = H - 1; y > 0; y -= 8) if (mask.land(x, y)) return y; return null; },
  };
  const spanMin = (f, a, b, step = 40) => { let m = Infinity; for (let v = a; v <= b; v += step) m = Math.min(m, f(v)); return m; };
  void spanMin;

  // --- strade --------------------------------------------------------------
  // Gli assi delle due cittadine: la strada costiera vi passa **dritta**, a quota fissa.
  const AIRPORT_ZONE = { lo: 1400, hi: 3040, ringY: 1800 };
  const JEJU_SI = { lo: 3040, hi: 5400, ringY: 1290, x0: 3160, x1: 5300 };
  const SEOGWIPO = { lo: 3000, hi: 4700 };
  const overrides = [
    { lo: AIRPORT_ZONE.lo, hi: AIRPORT_ZONE.hi, value: AIRPORT_ZONE.ringY, north: true },
    { lo: JEJU_SI.lo, hi: JEJU_SI.hi, value: JEJU_SI.ringY, north: true },
  ];
  const samples = ringSamples(mask, { inset: 380 }).map(([x, y]) => {
    for (const o of overrides) if (x >= o.lo && x <= o.hi && (o.north ? y < CENTER.y : y > CENTER.y)) return [x, o.value, true];
    return [x, y];
  });
  const ring = staircase(samples, { thr: 230, snap: 20, closed: true });
  const legs = pathLegs(ring, true);
  const ringLegsAll = legs.slice();
  const loopSamples = [];
  for (let i = 0; i < 360; i++) {
    const t = -Math.PI / 2 + (i / 360) * Math.PI * 2;
    loopSamples.push([HALLA.x + Math.cos(t) * HALLA.rx * 0.9, HALLA.y + Math.sin(t) * HALLA.ry * 0.9]);
  }
  const loopLegs = pathLegs(staircase(loopSamples, { thr: 200, snap: 20, closed: true }), false);
  legs.push(...loopLegs);
  const loopY = (x, north) => {
    let best = null;
    for (const l of loopLegs) if (l.axis === 'h' && x >= l.a + 30 && x <= l.b - 30 && (north ? l.c < HALLA.y : l.c > HALLA.y)) if (best === null || (north ? l.c < best : l.c > best)) best = l.c;
    return best;
  };

  const sampleOk = (axis, c, a, b) => {
    for (let t = a; t <= b; t += 70) {
      const x = axis === 'v' ? c : t;
      const y = axis === 'v' ? t : c;
      if (!mask.land(x, y) || mask.shoreDist(x, y) < 150) return false;
      if (Math.hypot((x - HALLA.x) / HALLA.rx, (y - HALLA.y) / HALLA.ry) < 0.8) return false;
    }
    return true;
  };

  // Jeju-si: lungomare (a gradini, segue la riva), tre file di isolati attorno alla
  // strada costiera e una via che chiude a sud. Le verticali attraversano l'anello.
  const wfSamples = [];
  for (let x = JEJU_SI.x0; x <= JEJU_SI.x1; x += 40) wfSamples.push([x, scan.north(x) + 190]);
  const xsN = [];
  for (let x = JEJU_SI.x0 + 100; x <= JEJU_SI.x1 - 60; x += 290 + Math.round(rng.range(-25, 30))) xsN.push(Math.round(x / 20) * 20);
  const wfN = clipLegs(pathLegs(staircase(wfSamples, { thr: 200, snap: 20 }), false), xsN[0], xsN[xsN.length - 1]);
  legs.push(...wfN);
  const townRowY = JEJU_SI.ringY + 340;
  const townSouthY = JEJU_SI.ringY + 560;
  xsN.forEach((x, i) => {
    const wf = horizontalAt(wfN, x);
    if (!wf) return;
    // La verticale scende fino all'anello interno se lo incontra, altrimenti si ferma
    // alla seconda fila: oltre, il cono.
    const ly = loopY(x, true);
    const end = ly !== null && ly - JEJU_SI.ringY < 700 ? ly : townRowY;
    legs.push({ axis: 'v', c: x, a: wf.c, b: end, arterial: i === Math.floor(xsN.length * 0.35) });
  });
  legs.push({ axis: 'h', c: townRowY, a: xsN[0], b: xsN[xsN.length - 1], arterial: false });

  // Seogwipo: specchio a sud. L'anello interno fa da limite settentrionale.
  const wfSSamples = [];
  for (let x = SEOGWIPO.lo + 100; x <= SEOGWIPO.hi - 100; x += 40) wfSSamples.push([x, scan.south(x) - 190]);
  const xsS = [];
  for (let x = SEOGWIPO.lo + 200; x <= SEOGWIPO.hi - 220; x += 290 + Math.round(rng.range(-25, 30))) xsS.push(Math.round(x / 20) * 20);
  const wfS = clipLegs(pathLegs(staircase(wfSSamples, { thr: 200, snap: 20 }), false), xsS[0], xsS[xsS.length - 1]);
  legs.push(...wfS);
  const ringSouth = (x) => { let best = null; for (const l of ringLegsAll) if (l.axis === 'h' && l.c > HALLA.y && x >= l.a + 30 && x <= l.b - 30) best = l; return best; };
  xsS.forEach((x, i) => {
    const wf = horizontalAt(wfS, x);
    if (!wf) return;
    const ly = loopY(x, false);
    const rs = ringSouth(x);
    const start = ly !== null && rs && rs.c - ly < 700 ? ly : (rs ? rs.c - 280 : wf.c - 560);
    legs.push({ axis: 'v', c: x, a: start, b: wf.c, arterial: i === Math.floor(xsS.length * 0.5) });
  });

  // Aeroporto: il rettangolo sta fra la costa e la strada costiera, e quella è la
  // sua strada d'accesso (il terminale ha la facciata sul lato dell'anello).
  const AP = { x: 1900, y: 1290, w: 880, h: 380 };
  const keepOut = [AP];
  const okFarm = (axis, c, a, b) => sampleOk(axis, c, a, b) && !keepOut.some((r) => (axis === 'v'
    ? c > r.x - 120 && c < r.x + r.w + 120 && b > r.y && a < r.y + r.h
    : c > r.y - 120 && c < r.y + r.h + 120 && b > r.x && a < r.x + r.w));

  // Villaggi sul litorale.
  const villages = [];
  const VILLAGES = [
    { id: 'aewol', at: { x: 1050, y: 2000 }, cols: 3 },
    { id: 'hallim', at: { x: 1150, y: 2900 }, cols: 3 },
    { id: 'seongsan', at: { x: 6150, y: 1800 }, cols: 3 },
    { id: 'pyoseon', at: { x: 5600, y: 3300 }, cols: 3 },
    { id: 'jungmun', at: { x: 2300, y: 3350 }, cols: 3 },
    { id: 'gujwa', at: { x: 5700, y: 1620 }, cols: 2 },
  ];
  const ringLegs = legs.filter((l) => l.arterial);
  for (const v of VILLAGES) {
    const free = (axis, c, a, b) => sampleOk(axis, c, a, b)
      && !legs.some((l) => l.axis === axis && !l.arterial && Math.abs(l.c - c) < 200 && Math.min(b, l.b) - Math.max(a, l.a) > 60);
    const g = villageLegs(ringLegs, v.at, { cols: v.cols + 1, spacing: 280, depth: 560 }, free)
      || villageLegs(ringLegs, v.at, { cols: v.cols, spacing: 300, depth: 560 }, free)
      || villageLegs(ringLegs, v.at, { cols: v.cols, spacing: 300, depth: 400 }, free)
      || villageLegs(ringLegs, v.at, { cols: 2, spacing: 300, depth: 400 }, free);
    if (!g) continue;
    legs.push(...g.legs);
    villages.push({ id: v.id, rect: g.rect });
  }

  // La strada del promontorio di Seongsan: dall'anello al piede dell'Ilchulbong.
  {
    let ringE = null;
    for (const l of ringLegsAll) if (l.axis === 'v' && l.a < 1560 && l.b > 1440 && (!ringE || l.c > ringE.c)) ringE = l;
    if (ringE) {
      let xEnd = ringE.c;
      for (let x = ringE.c; x < 6760; x += 20) { if (!mask.land(x, 1500) || mask.shoreDist(x, 1500) < 90) break; xEnd = x; }
      if (xEnd - ringE.c > 240) legs.push({ axis: 'h', c: 1500, a: ringE.c, b: xEnd, arterial: false });
    }
  }

  // Strade di campagna: reticolo largo fra anello e anello interno.
  const lat = (from, to, step) => { const out = []; for (let v = from; v <= to; v += step) out.push(v); return out; };
  legs.push(...farmRoads(legs, { axis: 'v', lattice: lat(1000, 6400, 360), ok: okFarm, clearance: 170, minGap: 330 }));
  legs.push(...farmRoads(legs, { axis: 'h', lattice: lat(1700, 3400, 420), ok: okFarm, clearance: 190, minGap: 380 }));

  buildNetwork(city, legs);
  city.isOnRoad = makeRoadHit(city);

  // --- oreum: i piccoli coni parassiti ------------------------------------------
  const roadHit = city.isOnRoad;
  for (let tries = 0; tries < 400 && city.oreums.length < 14; tries++) {
    const x = rng.range(600, W - 600);
    const y = rng.range(900, H - 700);
    const r = rng.range(110, 210);
    if (!mask.land(x, y) || mask.shoreDist(x, y) < 420) continue;
    if (Math.hypot((x - HALLA.x) / HALLA.rx, (y - HALLA.y) / HALLA.ry) < 1.05) continue;
    if (city.oreums.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 260)) continue;
    let clear = !roadHit(x, y, 120);
    for (let a = 0; a < 8 && clear; a++) for (const k of [0.6, 1.2]) if (roadHit(x + Math.cos(a * 0.785) * r * k, y + Math.sin(a * 0.785) * r * k, 90)) clear = false;
    if (!clear || inRect(x, y, { x0: AP.x - 200, x1: AP.x + AP.w + 200, y0: AP.y - 200, y1: AP.y + AP.h + 200 })) continue;
    city.oreums.push({ x, y, r, h: rng.range(40, 84) });
  }

  // --- isolati ---------------------------------------------------------------
  const townN = { x0: xsN[0] - 160, x1: xsN[xsN.length - 1] + 160, y0: 0, y1: townSouthY + 60 };
  const townS = { x0: xsS[0] - 160, x1: xsS[xsS.length - 1] + 160, y0: 3000, y1: H };
  city.urbanZones = [townN, townS, ...villages.map((v) => v.rect)];
  const DOCK_X0 = 4700;
  const landFn = (x, y) => mask.land(x, y);
  // L'aeroporto è un isolato a parte.
  const apBlock = { ...AP, type: 'airport', district: 'gimpo', onArterial: true, yards: [], alleys: [] };
  city.blocks.push(apBlock);
  city.airport = { ...AP, district: 'gimpo' };
  kit.makeBlocks(city, rng, {
    reserved: [AP], land: landFn, hit: roadHit, districtAt: city.districtAt, byId, region: REGION,
    carve: { steps: [200, 100], minSize: 56, maxW: 480, maxH: 480, inset: 120 },
    classify: ({ cx, cy, rect, roadSides }) => {
      const d = Math.hypot((cx - HALLA.x) / HALLA.rx, (cy - HALLA.y) / HALLA.ry);
      const town = inRect(cx, cy, townN) || inRect(cx, cy, townS) || villages.some((v) => inRect(cx, cy, v.rect));
      // Periferia: dove le strade di campagna chiudono due lati la campagna si fa abitata.
      if (SUBURBS.some((z) => inRect(cx, cy, z)) && roadSides >= 2 && rect.w >= 110 && rect.h >= 100 && d > 1.0) return 'urban';
      if (town && roadSides >= 1 && rect.w >= 70 && rect.h >= 60) return inRect(cx, cy, townN) && cx > DOCK_X0 ? 'dock' : 'urban';
      if (d < 0.97 || mask.shoreDist(cx, cy) < 280) return 'park';
      return 'rural';
    },
  });
  for (const b of city.blocks) if (b.type === 'rural') b.stoneWalls = true;

  // Aeroporto: pista, raccordo, piazzale, eliporto, terminale sul lato della strada.
  {
    const r = AP;
    city.runways.push({ x: r.x + 30, y: r.y + 28, w: r.w - 60, h: 90, horiz: true, name: '07/25' });
    city.taxiways.push({ x: r.x + 90, y: r.y + 140, w: r.w - 180, h: 34, horiz: true });
    city.aprons.push({ x: r.x + 150, y: r.y + 190, w: r.w - 300, h: 100 });
    city.helipads.push({ x: r.x + r.w * 0.84, y: r.y + 240, r: 40 });
    for (let i = 0; i < 4; i++) city.airSpots.push({ x: r.x + 220 + i * 150, y: r.y + 240, angle: -Math.PI / 2, kind: i === 2 ? 'heli' : 'plane' });
    const d = byId.gimpo;
    city.buildings.push(kit.makeBuilding(rng, d, REGION, r.x + r.w / 2 - 70, r.y + r.h - 62, 140, 52, { style: 'glass', h3d: 60, signChance: 0.9, streetEdges: ['bottom'] }));
    city.props.push({ type: 'windsock', x: r.x + 100, y: r.y + 125, rot: 0, z: 62, solid: false, r: 9 });
    city.props.push({ type: 'windsock', x: r.x + r.w - 100, y: r.y + 125, rot: 0, z: 62, solid: false, r: 9 });
    apBlock.yards.push({ x: r.x + 140, y: r.y + 180, w: r.w - 280, h: 120 });
  }

  // Moli: il porto di Jeju-si e il pontile di Seogwipo.
  const pier = (x, yShore, w, depth, kind, side = 'n') => {
    const y0 = side === 'n' ? yShore - depth : yShore - 30;
    const p = { x, y: y0, w, h: depth + 30, islandPier: true };
    city.piers.push(p);
    for (let k = 1; k < Math.floor(p.h / 90); k++) city.props.push({ type: 'bollard', x: x + 8, y: p.y + k * 90, rot: 0, z: 16, solid: false, r: 7 });
    city.boatSpots.push({ x: x + w / 2, y: side === 'n' ? p.y - 44 : p.y + p.h + 44, angle: side === 'n' ? -Math.PI / 2 : Math.PI / 2, kind });
  };
  for (const [x, kind] of [[4780, 'ferry'], [4960, 'boat'], [5160, 'ferry']]) pier(x, scan.north(x + 50), 110, 250, kind, 'n');
  pier(4160, scan.south(4200), 100, 230, 'boat', 's');
  pier(3320, scan.north(3360), 90, 200, 'boat', 'n');

  // --- luoghi nominati --------------------------------------------------------
  kit.addLandmarks(city, LANDMARKS, REGION);
  city.landmarks.push({ id: 'jeju-international-airport', name: 'Jeju International Airport', hangul: '제주국제공항', label: 'Aeroporto Internazionale di Jeju', kind: 'airport', district: 'gimpo', region: REGION, x: AP.x + AP.w / 2, y: AP.y + 240 });
  city.landmarks.push({ id: 'jeju-port', name: 'Jeju Port Ferry Terminal', hangul: '제주항 여객터미널', label: 'Terminale dei traghetti di Jeju', kind: 'port', district: 'docks', region: REGION, x: 4960, y: scan.north(5000) + 60 });
  city.regionalLandmarks = city.landmarks;
  city.regionLandmarks = city.landmarks;
  kit.addTransit(city, TRANSIT, REGION);
  kit.placeHospitalsAndPolice(city, districts);
  kit.placeShops(city, districts);
  kit.placeGarages(city, districts);
  kit.placeTurfs(city, GANGS, [
    ['baekho', 'hongdae', 'Il cortile dietro il mercato'], ['hwangso', 'myeongdong'], ['heuksa', 'docks', 'Il piazzale dei container'],
    ['cheolma', 'gangnam'], ['heuksa', 'itaewon'], ['hwangso', 'hongdae'],
  ]);

  // --- compatibilità con chi legge i campi dell'acqua ---------------------------------
  city.coastAt = (y) => { for (let x = 0; x < W; x += 8) if (mask.land(x, y)) return x; return W / 2; };
  city.waterX = city.coastAt(H / 2);
  city.quayX = city.waterX + 170;
  city.coastLine = { c: city.quayX, width: 132, arterial: true, keep: true };
  city.coastIdx = 0;
  city.riverCell = -1;
  city.doglegs = 0;
  city.port = { x: 4700, y: 700, w: 700, h: 450, district: 'docks' };
  city.water = { id: 'jeju-coast', name: 'Jeju Coast', hangul: '제주 해안', label: 'Costa di Jeju', kind: 'island', type: 'island', isIsland: true, island: true, region: REGION, x: city.waterX, coastAt: city.coastAt };
  city.sea = city.water; city.coast = city.water; city.coastline = city.water;
  city.island = { id: 'jeju-do', name: 'Jeju Island', hangul: '제주도', label: 'Isola di Jeju', kind: 'island', type: 'island', isIsland: true, island: true, region: REGION };
  city.isIsland = true;
  city.waterIdentity = { id: 'jeju-do', name: 'Jeju Island', hangul: '제주도', label: 'Isola di Jeju', island: city.island, coast: city.water, river: city.river };
  city.waterBoundary = { type: 'polygon-mask', res: mask.res };
  city.spawn = { x: city.transitStations[0].arrivalX, y: city.transitStations[0].arrivalY, angle: 0 };
  kit.indexCity(city, city.elevationAt);
  city.stats = kit.makeStats(city);
  return city;
}
