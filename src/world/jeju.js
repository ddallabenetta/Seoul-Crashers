// Jeju (제주) è una regione generata da una topologia propria: un'isola vulcanica
// con una strada anulare, due insediamenti costieri e un interno rurale.
import { Rng } from '../core/rng.js';
import { SpatialGrid } from '../core/spatial.js';
import { buildRoadGraph } from './roadgraph.js';
import { BUSINESSES, DISTRICT_MIX } from './interiors.js';

export const JEJU_SEED = 20260808;

const WORLD = { w: 5400, h: 5400, margin: 220 };
const SIDEWALK = 20;
// Un torrente più basso del cono sommitale: Hallasan resta il centro asciutto
// dell'isola, mentre tre ponti tengono insieme i due versanti agricoli.
const RIVER = { y0: 3030, y1: 3150 };
const ISLAND = { cx: WORLD.w * 0.5, cy: WORLD.h * 0.5, rx: 2460, ry: 2380, power: 8 };

// Gli id sono compatibili con traffico, pedoni, negozi e salvataggi. Posizioni,
// colori e pesi, però, descrivono solo Jeju e non copiano i distretti di Seoul.
const DISTRICTS = [
  {
    id: 'hongdae', name: 'Jeju City', hangul: '제주시', subtitle: 'Dongmun, porto e vicoli pieni di lanterne',
    seed: { x: 0.31, y: 0.2 }, block: { minLot: 56, maxLot: 118, gapChance: 0.11 }, grid: { step: [150, 245], superblock: 0.14, jog: 0.2 },
    heights: [36, 128], styles: ['brick', 'concrete', 'panel'], facade: ['#a56e57', '#8d6574', '#73849b', '#b4875a'], roof: '#4b3c3a',
    accent: '#ff9b5f', accent2: '#7cf3ff', ground: '#30333b', sidewalk: '#57545d', signDensity: 0.86, treeDensity: 0.16,
    trafficDensity: 1, pedDensity: 1.55, pedMix: ['student', 'tourist', 'civil', 'civil', 'gangster'], vehicleMix: ['hatch', 'sedan', 'taxi', 'scooter', 'van', 'bus'],
  },
  {
    id: 'myeongdong', name: 'Seongsan', hangul: '성산', subtitle: 'Il cratere dell’alba e la costa orientale',
    seed: { x: 0.81, y: 0.23 }, block: { minLot: 72, maxLot: 154, gapChance: 0.12 }, grid: { step: [170, 280], superblock: 0.2, jog: 0.12 },
    heights: [30, 112], styles: ['concrete', 'panel', 'brick'], facade: ['#a47a61', '#7a8d91', '#b08a6a', '#6f777d'], roof: '#4b4744',
    accent: '#ffd36a', accent2: '#ff7a6a', ground: '#33342f', sidewalk: '#5a554b', signDensity: 0.68, treeDensity: 0.24,
    trafficDensity: 0.82, pedDensity: 1.05, pedMix: ['tourist', 'civil', 'worker', 'student'], vehicleMix: ['hatch', 'sedan', 'suv', 'taxi', 'van', 'bus'],
  },
  {
    id: 'itaewon', name: 'Aewol', hangul: '애월', subtitle: 'Caffè sul mare, muretti di pietra e surfisti',
    seed: { x: 0.19, y: 0.44 }, block: { minLot: 64, maxLot: 142, gapChance: 0.19 }, grid: { step: [190, 330], superblock: 0.3, jog: 0.16 },
    heights: [28, 96], styles: ['brick', 'panel', 'concrete'], facade: ['#8c765d', '#6c8278', '#a07868', '#6b6f82'], roof: '#403b34',
    accent: '#4ad9d1', accent2: '#ffad5e', ground: '#2f3530', sidewalk: '#555a4e', signDensity: 0.62, treeDensity: 0.33,
    trafficDensity: 0.7, pedDensity: 0.9, pedMix: ['tourist', 'civil', 'student', 'worker'], vehicleMix: ['hatch', 'suv', 'scooter', 'van', 'sedan'],
  },
  {
    id: 'gangnam', name: 'Seogwipo', hangul: '서귀포', subtitle: 'Cascate, alberghi e il lungomare del sud',
    seed: { x: 0.72, y: 0.79 }, block: { minLot: 92, maxLot: 198, gapChance: 0.08 }, grid: { step: [220, 360], superblock: 0.33, jog: 0.08 },
    heights: [56, 210], styles: ['glass', 'concrete', 'panel'], facade: ['#4d7185', '#597e89', '#55708f', '#708b98'], roof: '#314553',
    accent: '#5fe3ff', accent2: '#d49aff', ground: '#2d3337', sidewalk: '#53616b', signDensity: 0.57, treeDensity: 0.25,
    trafficDensity: 1.08, pedDensity: 1.2, pedMix: ['office', 'tourist', 'civil', 'civil'], vehicleMix: ['sedan', 'suv', 'sport', 'taxi', 'bus', 'van'],
  },
  {
    id: 'docks', name: 'Jeju Port', hangul: '제주항', subtitle: 'Traghetti, container e carichi senza domande',
    seed: { x: 0.12, y: 0.2 }, block: { minLot: 180, maxLot: 330, gapChance: 0.3 }, grid: { step: [300, 520], superblock: 0.5, jog: 0.04 },
    heights: [24, 70], styles: ['warehouse', 'warehouse', 'panel'], facade: ['#65736d', '#53676d', '#72736a', '#52605a'], roof: '#39453f',
    accent: '#ffd15a', accent2: '#63e0aa', ground: '#292e30', sidewalk: '#4a5351', signDensity: 0.25, treeDensity: 0.04,
    trafficDensity: 0.55, pedDensity: 0.42, pedMix: ['worker', 'worker', 'gangster', 'civil'], vehicleMix: ['truck', 'truck', 'van', 'suv', 'sedan'],
  },
  {
    id: 'gimpo', name: 'Jeju Airport', hangul: '제주공항', subtitle: 'Piste, hangar e la porta dell’isola',
    seed: { x: 0.2, y: 0.14 }, block: { minLot: 150, maxLot: 290, gapChance: 0.35 }, grid: { step: [320, 560], superblock: 0.52, jog: 0.04 },
    heights: [22, 62], styles: ['warehouse', 'panel', 'warehouse'], facade: ['#70818b', '#5f707a', '#7f8589', '#66766f'], roof: '#46525a',
    accent: '#6fd8ff', accent2: '#ffe77c', ground: '#30362e', sidewalk: '#4e5a55', signDensity: 0.2, treeDensity: 0.18,
    trafficDensity: 0.6, pedDensity: 0.52, pedMix: ['worker', 'tourist', 'civil', 'office'], vehicleMix: ['van', 'truck', 'sedan', 'bus', 'suv'],
  },
  {
    id: 'gyeonggi', name: 'Hallasan', hangul: '한라산', subtitle: 'Boschi, sentieri e pendici vulcaniche',
    seed: { x: 0.5, y: 0.51 }, block: { minLot: 170, maxLot: 340, gapChance: 0.46 }, grid: { step: [380, 680], superblock: 0.62, jog: 0.02 },
    heights: [18, 58], styles: ['warehouse', 'brick', 'panel'], facade: ['#73775a', '#617255', '#847a61', '#5d6d54'], roof: '#454b38',
    accent: '#a7e45a', accent2: '#ffd05a', ground: '#343b28', sidewalk: '#4f5542', signDensity: 0.1, treeDensity: 0.58,
    trafficDensity: 0.32, pedDensity: 0.25, pedMix: ['worker', 'civil', 'civil', 'tourist'], vehicleMix: ['tractor', 'truck', 'van', 'hatch', 'suv'],
  },
];
const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));

function cloneDistrict(d) {
  return {
    ...d,
    seed: { ...d.seed }, block: { ...d.block }, grid: { ...d.grid, step: [...d.grid.step] },
    heights: [...d.heights], styles: [...d.styles], facade: [...d.facade], pedMix: [...d.pedMix], vehicleMix: [...d.vehicleMix],
  };
}

const GANGS = [
  { id: 'baekho', name: 'Tigre Bianca', hangul: '백호파', color: '#e8e2d0', trade: 'armi' },
  { id: 'heuksa', name: 'Serpe Nera', hangul: '흑사파', color: '#7d5ce0', trade: 'contrabbando' },
  { id: 'cheolma', name: 'Cavallo di Ferro', hangul: '철마파', color: '#ff7a29', trade: 'auto rubate' },
  { id: 'hwangso', name: 'Bue Giallo', hangul: '황소파', color: '#ffd23f', trade: 'usura' },
];

const LANDMARKS = [
  // I landmark occupano celle libere fra gli assi stradali: restano ampi e
  // leggibili, ma nessun volume solido si sovrappone al grafo navigabile.
  { id: 'hallasan', name: 'Hallasan', hangul: '한라산', label: 'Monte Hallasan', kind: 'mountain', district: 'gyeonggi', target: [0.5093, 0.5278], style: 'hill', w: 280, h: 210, h3d: 360, color: '#3d6746', roofColor: '#294231' },
  { id: 'dongmun-market', name: 'Dongmun Market', hangul: '동문시장', label: 'Mercato Dongmun', kind: 'market', district: 'hongdae', target: [0.3, 0.2074], style: 'warehouse', w: 240, h: 160, h3d: 82, color: '#ae7152', roofColor: '#554139' },
  { id: 'seongsan-ilchulbong', name: 'Seongsan Ilchulbong', hangul: '성산일출봉', label: 'Picco dell’alba di Seongsan', kind: 'coastal', district: 'myeongdong', target: [0.8407, 0.2074], style: 'hill', w: 230, h: 180, h3d: 210, color: '#527b58', roofColor: '#38543c' },
  { id: 'jusangjeolli', name: 'Jusangjeolli Coast', hangul: '주상절리', label: 'Scogliere di Jusangjeolli', kind: 'coastal', district: 'gangnam', target: [0.8407, 0.7778], style: 'hill', w: 230, h: 220, h3d: 124, color: '#4e6664', roofColor: '#364b4c' },
  { id: 'jeju-city', name: 'Jeju City', hangul: '제주시', label: 'Città di Jeju', kind: 'city', district: 'hongdae', target: [0.2519, 0.163], style: 'tower', w: 180, h: 170, h3d: 185, color: '#6e8a94', roofColor: '#394e57' },
  { id: 'seogwipo', name: 'Seogwipo', hangul: '서귀포', label: 'Città di Seogwipo', kind: 'city', district: 'gangnam', target: [0.7315, 0.7796], style: 'glass', w: 240, h: 220, h3d: 210, color: '#527b95', roofColor: '#304654' },
];

const TRANSIT = [
  { id: 'jeju-city', name: 'Jeju City Station', label: 'Stazione Jeju City', hangul: '제주시청역', target: [0.28, 0.18], lines: ['Jeju-1'] },
  { id: 'dongmun', name: 'Dongmun Market Station', label: 'Stazione Dongmun Market', hangul: '동문시장역', target: [0.32, 0.2], lines: ['Jeju-1', 'Port'] },
  { id: 'jeju-airport', name: 'Jeju Airport Station', label: 'Stazione Aeroporto di Jeju', hangul: '제주공항역', target: [0.2, 0.14], lines: ['Airport', 'Jeju-1'] },
  { id: 'aewol', name: 'Aewol Station', label: 'Stazione costiera di Aewol', hangul: '애월역', target: [0.17, 0.43], lines: ['West Coast'] },
  { id: 'hallasan', name: 'Hallasan Trailhead', label: 'Capolinea sentieri Hallasan', hangul: '한라산입구', target: [0.5, 0.5], lines: ['Mountain'] },
  { id: 'seogwipo', name: 'Seogwipo Terminal', label: 'Terminal degli autobus di Seogwipo', hangul: '서귀포버스터미널', target: [0.72, 0.8], lines: ['Jeju-Express'] },
  { id: 'seongsan', name: 'Seongsan Station', label: 'Stazione Seongsan', hangul: '성산역', target: [0.82, 0.2], lines: ['East Coast'] },
];

const XS = [520, 760, 1000, 1240, 1480, 1760, 2040, 2320, 2600, 2900, 3200, 3500, 3800, 4100, 4400, 4680, 4900];
const YS = [520, 760, 1000, 1240, 1480, 1760, 2040, 2320, 2600, 2730, 2960, 3250, 3550, 3800, 4050, 4350, 4680, 4900];
const AIRPORT = { x: 820, y: 620, w: 900, h: 520 };
const PORT = { x: 540, y: 900, w: 520, h: 520 };

function near(a, b, e = 1) { return Math.abs(a - b) < e; }

function hashNoise(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = x - xi, v = y - yi;
  const s = (n) => n * n * (3 - 2 * n);
  const a = hashNoise(xi, yi, seed), b = hashNoise(xi + 1, yi, seed);
  const c = hashNoise(xi, yi + 1, seed), d = hashNoise(xi + 1, yi + 1, seed);
  return (a + (b - a) * s(u)) + ((c + (d - c) * s(u)) - (a + (b - a) * s(u))) * s(v);
}

function islandRatio(x, y) {
  const nx = Math.abs((x - ISLAND.cx) / ISLAND.rx);
  const ny = Math.abs((y - ISLAND.cy) / ISLAND.ry);
  return nx ** ISLAND.power + ny ** ISLAND.power;
}

function insideIsland(x, y) { return islandRatio(x, y) <= 1; }

function coastAt(y) {
  const ny = Math.abs((y - ISLAND.cy) / ISLAND.ry);
  if (ny >= 1) return ISLAND.cx;
  const span = ISLAND.rx * Math.pow(Math.max(0, 1 - ny ** ISLAND.power), 1 / ISLAND.power);
  return ISLAND.cx - span;
}

function districtAtNorm(nx, ny) {
  let best = DISTRICTS[0], bd = Infinity;
  for (const d of DISTRICTS) {
    const dx = nx - d.seed.x, dy = ny - d.seed.y;
    let dd = dx * dx + dy * dy;
    if (d.id === 'gyeonggi') dd *= 0.75;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

function urbanityAt(x, y) {
  const nx = x / WORLD.w, ny = y / WORLD.h;
  const blobs = [
    { x: 0.3, y: 0.2, r: 0.23, w: 1 }, { x: 0.81, y: 0.22, r: 0.15, w: 0.7 },
    { x: 0.72, y: 0.79, r: 0.2, w: 1 }, { x: 0.18, y: 0.44, r: 0.12, w: 0.56 },
  ];
  let u = 0;
  for (const b of blobs) {
    const d = Math.hypot(nx - b.x, ny - b.y) / b.r;
    if (d < 1) u += (1 - d) * (1 - d) * (3 - 2 * (1 - d)) * b.w;
  }
  u += (valueNoise(x / 620, y / 620, 0x4a39) - 0.5) * 0.16;
  return Math.max(0, Math.min(1, u));
}

function elevationAt(x, y) {
  if (!insideIsland(x, y) || (y > RIVER.y0 && y < RIVER.y1)) return 0;
  const dx = (x - ISLAND.cx) / 1120, dy = (y - ISLAND.cy) / 1080;
  const peak = Math.max(0, 1 - Math.hypot(dx, dy));
  const foothill = Math.max(0, 1 - Math.hypot((x - ISLAND.cx) / 2200, (y - ISLAND.cy) / 2050));
  const n = (valueNoise(x / 480, y / 480, 0x8b1d) - 0.5) * 22;
  return Math.max(0, 24 * foothill + 295 * peak * peak + n * Math.min(1, foothill));
}

function districtFor(city, x, y) {
  const id = districtAtNorm(x / city.w, y / city.h).id;
  return city.districtById?.[id] || DISTRICT_BY_ID[id];
}

function makeBuilding(rng, district, x, y, w, h, opts = {}) {
  const style = opts.style || rng.pick(district.styles);
  const b = {
    x, y, w, h, h3d: opts.h3d ?? Math.round(district.heights[0] + rng.next() * (district.heights[1] - district.heights[0])),
    elev: 0, style, color: opts.color || rng.pick(district.facade), roofColor: opts.roofColor || district.roof,
    variant: rng.int(0, 3), litSeed: rng.int(0, 9999), district: district.id, districtName: district.name, districtHangul: district.hangul,
    solid: opts.solid !== false, signs: [], edges: opts.streetEdges || [], landmark: !!opts.landmark,
    ac: opts.ac ?? rng.int(0, 2), water: opts.water ?? rng.chance(0.18), region: 'jeju',
  };
  const sd = opts.signChance ?? district.signDensity;
  if (b.h3d > 30 && b.edges.length && !b.landmark) {
    for (const edge of b.edges) if (rng.chance(sd)) b.signs.push({ edge, t: rng.range(0.18, 0.82), word: rng.pick(['동문', '카페', '편의점', '분식', '호텔', '시장']), color: rng.chance(0.5) ? district.accent : district.accent2, vertical: rng.chance(0.6), h: rng.range(0.35, 0.8) });
  }
  return b;
}

function splitSpan(rng, start, len, lo, hi) {
  const out = []; let p = 0;
  while (len - p > lo * 0.72) {
    let n = rng.range(lo, hi);
    if (len - p - n < lo * 0.72) n = len - p;
    out.push({ a: start + p, len: n }); p += n + rng.range(2, 6);
  }
  return out;
}

function fillUrban(rng, city, block, d) {
  const pad = Math.min(SIDEWALK, Math.max(8, (Math.min(block.w, block.h) - 48) / 2));
  const x = block.x + pad, y = block.y + pad, w = block.w - pad * 2, h = block.h - pad * 2;
  if (w < 42 || h < 42) return;
  const push = (bx, by, bw, bh, edges, corner = false) => {
    if (bw < 30 || bh < 28) return;
    if (rng.chance(d.block.gapChance)) { block.yards.push({ x: bx, y: by, w: bw, h: bh }); return; }
    city.buildings.push(makeBuilding(rng, d, bx, by, bw, bh, { streetEdges: edges, arterial: block.onArterial, corner, h3d: undefined }));
  };
  const courtyard = w > 145 && h > 145;
  const dt = courtyard ? rng.range(48, Math.min(100, h * 0.34)) : h * 0.5 - 2;
  const db = courtyard ? rng.range(48, Math.min(100, h * 0.34)) : h - dt - 4;
  const dl = courtyard ? rng.range(48, Math.min(100, w * 0.32)) : 0;
  const dr = courtyard ? rng.range(48, Math.min(100, w * 0.32)) : 0;
  const top = splitSpan(rng, x, w, d.block.minLot, d.block.maxLot);
  const bot = splitSpan(rng, x, w, d.block.minLot, d.block.maxLot);
  top.forEach((q, i) => push(q.a, y, q.len - 3, dt, ['top'], i === 0));
  bot.forEach((q, i) => push(q.a, y + h - db, q.len - 3, db, ['bottom'], i === 0));
  if (courtyard) {
    const iy = y + dt + 3, ih = h - dt - db - 6;
    const left = splitSpan(rng, iy, ih, d.block.minLot, d.block.maxLot);
    const right = splitSpan(rng, iy, ih, d.block.minLot, d.block.maxLot);
    left.forEach((q, i) => push(x, q.a, dl, q.len - 3, ['left'], i === 0));
    right.forEach((q, i) => push(x + w - dr, q.a, dr, q.len - 3, ['right'], i === 0));
    block.courtyard = { x: x + dl + 3, y: iy, w: w - dl - dr - 6, h: ih };
    block.yards.push(block.courtyard);
    if (rng.chance(0.68)) {
      const aw = Math.min(48, block.courtyard.w * 0.35);
      const alley = { x: block.x + block.w / 2 - aw / 2, y: block.y, w: aw, h: block.h, through: true };
      block.alleys.push(alley); block.yards.push(alley); block.reachable = true;
    }
  } else {
    const cols = Math.max(1, Math.floor(w / 100)), rows = Math.max(1, Math.floor(h / 100));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const bw = w / cols - 5, bh = h / rows - 5;
      const edges = [];
      if (j === 0) edges.push('top'); if (j === rows - 1) edges.push('bottom'); if (i === 0) edges.push('left'); if (i === cols - 1) edges.push('right');
      push(x + i * w / cols, y + j * h / rows, bw, bh, edges, edges.length > 1);
    }
  }
}

function decorateEdges(rng, city, block, d) {
  const sides = [
    { x: block.x, y: block.y + 10, dx: 1, dy: 0, len: block.w }, { x: block.x, y: block.y + block.h - 10, dx: 1, dy: 0, len: block.w },
    { x: block.x + 10, y: block.y, dx: 0, dy: 1, len: block.h }, { x: block.x + block.w - 10, y: block.y, dx: 0, dy: 1, len: block.h },
  ];
  for (const e of sides) {
    for (let i = 70; i < e.len - 20; i += 132) {
      const x = e.x + e.dx * i, y = e.y + e.dy * i, roll = rng.next();
      if (roll < 0.42) city.props.push({ type: 'lamp', x, y, rot: e.dx ? 0 : Math.PI / 2, z: 96, solid: false, r: 6 });
      else if (roll < 0.42 + d.treeDensity) city.props.push({ type: 'tree', x, y, rot: rng.range(0, 6.28), z: 64, solid: false, r: 12, tint: rng.int(0, 2) });
      else if (roll < 0.62) city.props.push({ type: 'vending', x, y, rot: e.dx ? 0 : Math.PI / 2, z: 34, solid: true, r: 12 });
      else if (roll < 0.72) city.props.push({ type: 'bench', x, y, rot: e.dx ? 0 : Math.PI / 2, z: 14, solid: false, r: 14 });
      else if (roll < 0.86) city.props.push({ type: 'busstop', x, y, rot: e.dx ? 0 : Math.PI / 2, z: 44, solid: false, r: 20 });
      else city.props.push({ type: 'bin', x, y, rot: 0, z: 22, solid: false, r: 9 });
    }
  }
}

function decorateYards(rng, city, block) {
  for (const y of block.yards) {
    const n = Math.min(8, Math.floor((y.w * y.h) / 9000));
    for (let i = 0; i < n; i++) {
      const x = y.x + rng.range(12, Math.max(13, y.w - 12)), py = y.y + rng.range(12, Math.max(13, y.h - 12));
      const roll = rng.next();
      if (roll < 0.32) city.props.push({ type: 'bin', x, y: py, rot: rng.range(0, 6.28), z: 24, solid: false, r: 10 });
      else if (roll < 0.58) city.props.push({ type: 'pallet', x, y: py, rot: rng.range(0, 6.28), z: 10, solid: false, r: 12 });
      else if (roll < 0.78) city.props.push({ type: 'ac_unit', x, y: py, rot: rng.range(0, 6.28), z: 26, solid: true, r: 11 });
      else city.props.push({ type: 'barrier', x, y: py, rot: rng.range(0, 6.28), z: 20, solid: false, r: 13 });
    }
  }
}

function fillRural(rng, city, block, d) {
  const pad = 14, x = block.x + pad, y = block.y + pad, w = block.w - pad * 2, h = block.h - pad * 2;
  block.fields = [];
  if (w < 70 || h < 70) { block.yards.push({ x, y, w, h }); return; }
  const cols = Math.max(1, Math.round(w / 270)), rows = Math.max(1, Math.round(h / 250));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const f = { x: x + i * w / cols + 5, y: y + j * h / rows + 5, w: w / cols - 10, h: h / rows - 10, wet: rng.chance(0.52) };
    block.fields.push(f);
    if (rng.chance(0.26)) city.props.push({ type: 'tree', x: f.x + f.w * rng.range(0.15, 0.85), y: f.y + f.h * rng.range(0.15, 0.85), rot: rng.range(0, 6.28), z: 58, solid: false, r: 13, tint: rng.int(0, 2) });
    if (rng.chance(0.15) && f.w > 80 && f.h > 80) city.buildings.push(makeBuilding(rng, d, f.x + f.w * 0.22, f.y + f.h * 0.22, f.w * 0.56, f.h * 0.42, { style: rng.chance(0.55) ? 'greenhouse' : 'warehouse', h3d: rng.int(24, 50), signChance: 0, streetEdges: [] }));
  }
  block.yards.push({ x, y, w, h });
}

function fillPark(rng, city, block, d) {
  block.yards.push({ x: block.x, y: block.y, w: block.w, h: block.h });
  const n = Math.min(34, Math.floor((block.w * block.h) / 5200));
  for (let i = 0; i < n; i++) city.props.push({ type: 'tree', x: block.x + rng.range(18, Math.max(19, block.w - 18)), y: block.y + rng.range(18, Math.max(19, block.h - 18)), rot: rng.range(0, 6.28), z: rng.range(48, 82), solid: false, r: 13, tint: rng.int(0, 2) });
}

function fillDock(rng, city, block, d, opts = {}) {
  const x = block.x + SIDEWALK, y = block.y + SIDEWALK, w = block.w - SIDEWALK * 2, h = block.h - SIDEWALK * 2;
  block.yards.push({ x, y, w, h, turfSafe: opts.roadSafe ? false : undefined });
  if (w < 70 || h < 70) return;
  // Il piazzale del porto interseca volutamente gli assi della griglia. Per il
  // suo sotto-blocco usiamo solo la cella interna (760..1000, 1000..1240):
  // i container restano visibili senza diventare ostacoli ad archi stradali.
  if (opts.roadSafe) {
    const palette = ['#c8493a', '#3f7ea8', '#cf9a2f', '#4a8f5e', '#8f5aa8'];
    const cols = Math.min(3, Math.floor((w - 20) / 58));
    const rows = Math.min(2, Math.floor((h - 180) / 116));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (rng.chance(0.27)) continue;
      city.buildings.push({ x: x + 10 + i * 58, y: y + 82 + j * 102, w: 40, h: 90, h3d: 26 * rng.int(1, 3), elev: 0, style: 'container', color: rng.pick(palette), roofColor: '#2c3336', variant: rng.int(1, 3), litSeed: rng.int(0, 9999), district: d.id, districtName: d.name, districtHangul: d.hangul, solid: true, signs: [], edges: [], landmark: false, ac: 0, water: false, region: 'jeju' });
    }
    city.props.push({ type: 'crane', x: x + w * 0.55, y: y + h * 0.45, rot: 0, z: 150, solid: true, r: 26 });
    return;
  }
  if (rng.chance(0.52)) city.buildings.push(makeBuilding(rng, d, x + w * 0.18, y + h * 0.2, w * 0.62, h * 0.54, { style: 'warehouse', h3d: rng.int(38, 68), streetEdges: ['top', 'bottom'], signChance: 0.25 }));
  const palette = ['#c8493a', '#3f7ea8', '#cf9a2f', '#4a8f5e', '#8f5aa8'];
  for (let i = 0; i < Math.floor(w / 58); i++) for (let j = 0; j < Math.floor(h / 116); j++) {
    if (rng.chance(0.27)) continue;
    city.buildings.push({ x: x + 10 + i * 58, y: y + 10 + j * 116, w: 40, h: 90, h3d: 26 * rng.int(1, 3), elev: 0, style: 'container', color: rng.pick(palette), roofColor: '#2c3336', variant: rng.int(1, 3), litSeed: rng.int(0, 9999), district: d.id, districtName: d.name, districtHangul: d.hangul, solid: true, signs: [], edges: [], landmark: false, ac: 0, water: false, region: 'jeju' });
  }
  city.props.push({ type: 'crane', x: x + w * 0.55, y: y + h * 0.45, rot: 0, z: 150, solid: true, r: 26 });
}

function fillAirport(rng, city, block, d) {
  const r = AIRPORT;
  const runway = { x: r.x + 30, y: r.y + r.h * 0.08, w: r.w - 60, h: 100, horiz: true, name: '07/25' };
  city.runways.push(runway);
  city.taxiways.push({ x: r.x + 80, y: r.y + r.h * 0.3, w: r.w - 160, h: 40, horiz: true });
  city.aprons.push({ x: r.x + 150, y: r.y + r.h * 0.48, w: r.w - 300, h: r.h * 0.28 });
  city.helipads.push({ x: r.x + r.w * 0.82, y: r.y + r.h * 0.67, r: 44 });
  for (let i = 0; i < 4; i++) city.airSpots.push({ x: r.x + 200 + i * 170, y: r.y + r.h * 0.62, angle: -Math.PI / 2, kind: i === 2 ? 'heli' : 'plane' });
  // Il terminale resta fra le linee x=1240/1480 e y=760/1000; la pista e
  // l'apron conservano l'impronta grande dello scalo senza bloccare il grafo.
  city.buildings.push(makeBuilding(rng, d, r.x + 440, r.y + 165, 200, 180, { style: 'glass', h3d: 70, signChance: 0 }));
  city.props.push({ type: 'windsock', x: r.x + 100, y: r.y + r.h * 0.26, rot: 0, z: 62, solid: false, r: 9 });
  city.props.push({ type: 'windsock', x: r.x + r.w - 100, y: r.y + r.h * 0.26, rot: 0, z: 62, solid: false, r: 9 });
  block.yards.push({ x: r.x + 140, y: r.y + r.h * 0.45, w: r.w - 280, h: r.h * 0.32 });
}

function addPier(city, x, y, w, h, kind = 'ferry') {
  const p = { x, y, w, h, islandPier: true };
  city.piers.push(p);
  for (let k = 1; k < Math.floor(w / 90); k++) city.props.push({ type: 'bollard', x: x + k * 90, y: y + 8, rot: 0, z: 16, solid: false, r: 7 });
  city.boatSpots.push({ x: x + w * 0.25, y: y + h + 36, angle: Math.PI, kind });
}

function fillPort(rng, city, block, d) {
  const r = PORT;
  // Il rettangolo complessivo resta disponibile al renderer, ma non è un
  // cortile valido per i props: contiene gli assi x=760/1000 e y=1000/1240.
  block.yards.push({ x: r.x + 20, y: r.y + 20, w: r.w - 40, h: r.h - 40, turfSafe: false });
  // Zona libera a sud del molo: anche il margine del prop (r=12) resta nella
  // cella x=520..760, y=1000..1240, lontano dai centri degli archi.
  block.yards.push({ x: r.x + 20, y: r.y + 120, w: 170, h: 190, turfSafe: true });
  // Magazzino sul lato sud-ovest, nella cella x=520..760/y=1240..1480.
  city.buildings.push(makeBuilding(rng, d, r.x + 42, r.y + 360, 170, 130, { style: 'warehouse', h3d: 58, streetEdges: [], signChance: 0.3 }));
  city.helipads.push({ x: r.x + r.w * 0.72, y: r.y + r.h * 0.78, r: 42 });
  fillDock(rng, city, { x: r.x + 240, y: r.y + 30, w: r.w - 260, h: r.h - 60, yards: block.yards }, d, { roadSafe: true });
}

function lineIsOn(axis, c, mid) {
  if (!insideIsland(axis === 'v' ? c : mid, axis === 'v' ? mid : c)) return false;
  if (axis === 'v' && mid > RIVER.y0 && mid < RIVER.y1 && ![1240, 2600, 4100].some((x) => near(c, x, 2))) return false;
  const north = c >= 700 && c <= 3000 && mid >= 500 && mid <= 1800;
  const south = c >= 2450 && c <= 4920 && mid >= 3450 && mid <= 4920;
  const west = c >= 480 && c <= 1550 && mid >= 1650 && mid <= 4380;
  const east = c >= 3700 && c <= 4920 && mid >= 800 && mid <= 2550;
  const ring = axis === 'v'
    ? ((near(c, 520) || near(c, 4900)) && mid >= 520 && mid <= 4900) || ((near(c, 1000) || near(c, 4400)) && mid >= 1000 && mid <= 4400)
    : ((near(c, 520) || near(c, 4900)) && mid >= 520 && mid <= 4900) || ((near(c, 1000) || near(c, 4400)) && mid >= 1000 && mid <= 4400);
  const spine = axis === 'v' ? (near(c, 2600) || near(c, 2320) || near(c, 2900)) : (near(c, 2600) || near(c, 2960) || near(c, 3250));
  const coastal = axis === 'h' && (near(c, 760) || near(c, 4550)) && mid >= 520 && mid <= 4900;
  return ring || spine || north || south || west || east || coastal;
}

function buildLines() {
  const make = (coords, axis) => coords.map((c) => {
    const arterial = near(c, 520) || near(c, 4900) || near(c, 1000) || near(c, 4400) || near(c, 2600);
    const line = { c, width: arterial ? 132 : 72, arterial, segments: [], on: new Array((axis === 'v' ? YS : XS).length - 1).fill(false) };
    const perp = axis === 'v' ? YS : XS;
    for (let i = 0; i < perp.length - 1; i++) line.on[i] = lineIsOn(axis, c, (perp[i] + perp[i + 1]) / 2);
    let start = null;
    for (let i = 0; i < line.on.length; i++) {
      if (line.on[i] && start === null) start = perp[i];
      if ((!line.on[i] || i === line.on.length - 1) && start !== null) {
        const end = line.on[i] && i === line.on.length - 1 ? perp[i + 1] : perp[i];
        line.segments.push([start, end]); start = null;
      }
    }
    return line;
  });
  return { vLines: make(XS, 'v'), hLines: make(YS, 'h') };
}

function doorPoint(b, edge) {
  const nx = edge === 'left' ? -1 : edge === 'right' ? 1 : 0;
  const ny = edge === 'top' ? -1 : edge === 'bottom' ? 1 : 0;
  const x = edge === 'left' ? b.x : edge === 'right' ? b.x + b.w : b.x + b.w / 2;
  const y = edge === 'top' ? b.y : edge === 'bottom' ? b.y + b.h : b.y + b.h / 2;
  return { x: x + nx * 11, y: y + ny * 11, nx, ny, edge };
}

function shopCandidate(b) { return b.edges?.length && !b.landmark && !b.flat && !b.transitEntrance && b.w >= 40 && b.h >= 40 && b.style !== 'container'; }

function makeShop(city, rng, b, edge, id, mix) {
  const door = doorPoint(b, edge), levels = Math.max(1, Math.min(4, 1 + Math.floor((b.h3d - 30) / 46)));
  const biz = [id]; for (let i = 1; i < levels; i++) biz.push(rng.pick(mix.upper));
  const first = BUSINESSES[id] || BUSINESSES.conv;
  const s = { id: city.shops.length, x: door.x, y: door.y, nx: door.nx, ny: door.ny, edge, w: b.w, h: b.h, building: b, district: b.district, districtName: b.districtName, districtHangul: b.districtHangul, biz, name: first.label, hangul: first.hangul, blip: first.blip || null, seed: (city.seed + b.x * 7919 + b.y * 104729 + city.shops.length * 31) >>> 0 };
  b.shop = s; city.shops.push(s); return s;
}

function retitleShop(s, id) { const b = BUSINESSES[id]; if (!b) return; s.biz[0] = id; s.name = b.label; s.hangul = b.hangul; s.blip = b.blip || null; }

function placeShops(city) {
  const rng = new Rng((city.seed ^ 0x5e0c1) >>> 0), doors = new SpatialGrid(city.w, city.h, 160), near = [];
  city.shops = [];
  for (const b of city.buildings) {
    if (!shopCandidate(b)) continue;
    const d = DISTRICT_BY_ID[b.district], mix = DISTRICT_MIX[b.district] || DISTRICT_MIX.hongdae;
    if (!rng.chance((d.signDensity || 0.4) * 0.58)) continue;
    const edge = rng.pick(b.edges), p = doorPoint(b, edge);
    doors.queryCircle(p.x, p.y, 80, near);
    if (near.some((q) => (q.px - p.x) ** 2 + (q.py - p.y) ** 2 < 80 * 80)) continue;
    const s = makeShop(city, rng, b, edge, rng.pick(mix.ground), mix);
    doors.insertRect({ x: p.x - 1, y: p.y - 1, w: 2, h: 2, px: s.x, py: s.y });
  }
  for (const h of city.hospitals) {
    let best = null, bd = Infinity;
    for (const b of city.buildings) if (shopCandidate(b) && b.district === h.district) {
      const dd = (b.x + b.w / 2 - h.x) ** 2 + (b.y + b.h / 2 - h.y) ** 2;
      if (dd < bd) { bd = dd; best = b; }
    }
    if (!best) continue;
    if (best.shop) retitleShop(best.shop, 'clinic'); else makeShop(city, rng, best, rng.pick(best.edges), 'clinic', DISTRICT_MIX[best.district] || DISTRICT_MIX.hongdae);
    h.x = best.shop.x; h.y = best.shop.y; h.shop = best.shop;
  }
  const have = new Set(city.shops.filter((s) => s.biz[0] === 'pawn').map((s) => s.district));
  for (const d of DISTRICTS) {
    if (have.has(d.id)) continue;
    const candidates = city.buildings.filter((b) => shopCandidate(b) && !b.shop && b.district === d.id);
    const b = candidates[0];
    if (b) makeShop(city, rng, b, rng.pick(b.edges), 'pawn', DISTRICT_MIX[d.id] || DISTRICT_MIX.hongdae);
  }
}

function placeGarages(city) {
  city.garages = [];
  for (const d of DISTRICTS) {
    let best = null, edge = null, bd = Infinity;
    for (const b of city.buildings) {
      if (!shopCandidate(b) || b.shop || b.garage || b.district !== d.id) continue;
      for (const e of b.edges) {
        const span = e === 'top' || e === 'bottom' ? b.w : b.h;
        if (span < 84) continue;
        const dd = (b.x + b.w / 2 - d.seed.x * city.w) ** 2 + (b.y + b.h / 2 - d.seed.y * city.h) ** 2;
        if (dd < bd) { bd = dd; best = b; edge = e; }
      }
    }
    if (!best) continue;
    best.garage = true;
    const p = doorPoint(best, edge), horiz = edge === 'top' || edge === 'bottom', w = horiz ? 78 : 56, h = horiz ? 56 : 78;
    const cx = p.x + p.nx * 16, cy = p.y + p.ny * 16;
    city.garages.push({ x: cx - w / 2, y: cy - h / 2, w, h, cx, cy, edge, horiz, door: { x: p.x, y: p.y }, building: best, district: d.id, name: d.name });
  }
}

function placeHospitalsAndPolice(city) {
  city.hospitals = []; city.stations = [];
  for (const d of DISTRICTS) {
    const pool = city.buildings.filter((b) => b.district === d.id && b.edges?.length && !b.landmark && b.w >= 100 && b.h >= 80);
    if (!pool.length) continue;
    const target = d.seed.x * city.w, ty = d.seed.y * city.h;
    pool.sort((a, b) => ((a.x + a.w / 2 - target) ** 2 + (a.y + a.h / 2 - ty) ** 2) - ((b.x + b.w / 2 - target) ** 2 + (b.y + b.h / 2 - ty) ** 2));
    const hospital = pool[0]; hospital.hospital = true;
    const hp = doorPoint(hospital, hospital.edges[0]);
    city.hospitals.push({ x: hp.x, y: hp.y, district: d.id, name: d.name, districtName: d.name, districtHangul: d.hangul });
    const police = pool.find((b) => b !== hospital && (b.x - hospital.x) ** 2 + (b.y - hospital.y) ** 2 > 320 * 320) || pool[1];
    if (police) {
      police.station = true;
      const pp = doorPoint(police, police.edges[police.edges.length - 1]);
      city.stations.push({ x: pp.x, y: pp.y, district: d.id, name: d.name, districtName: d.name, districtHangul: d.hangul });
    }
  }
}

function placeTurfs(city) {
  city.turfs = [];
  const anchors = [
    ['baekho', 'hongdae'], ['hwangso', 'myeongdong'], ['heuksa', 'docks'], ['cheolma', 'gangnam'], ['heuksa', 'itaewon'],
  ];
  const rng = new Rng((city.seed ^ 0x9a11d) >>> 0);
  for (const [gangId, districtId] of anchors) {
    const g = GANGS.find((q) => q.id === gangId), candidates = city.blocks.filter((b) => b.district === districtId && b.yards.some((y) => y.turfSafe !== false && y.w > 100 && y.h > 74));
    if (!g || !candidates.length) continue;
    const b = candidates[city.turfs.length % candidates.length], a = b.yards.find((y) => y.turfSafe !== false && y.w > 100 && y.h > 74);
    const t = { x: a.x, y: a.y, w: a.w, h: a.h, cx: a.x + a.w / 2, cy: a.y + a.h / 2, gang: g.id, name: g.name, hangul: g.hangul, color: g.color, trade: g.trade, place: b.type === 'dock' ? 'Piazzale dei container' : 'Cortile dietro il mercato', district: districtId, tag: rng.int(0, 3) };
    b.turf = t; city.turfs.push(t);
    for (let i = 0; i < 4; i++) city.props.push({ type: i % 2 ? 'crate' : 'drum', x: a.x + rng.range(16, Math.max(17, a.w - 16)), y: a.y + rng.range(16, Math.max(17, a.h - 16)), rot: rng.range(0, 6.28), z: 26, solid: true, r: 12 });
  }
}

function nearestRoadPoint(city, target) {
  const tx = target[0] * city.w, ty = target[1] * city.h;
  let best = null, bd = Infinity, fallback = null, fd = Infinity;
  for (const n of city.graph.usableNodes) {
    if (!insideIsland(n.x, n.y) || city.isWater(n.x, n.y)) continue;
    const dd = (n.x - tx) ** 2 + (n.y - ty) ** 2;
    if (dd < fd) { fd = dd; fallback = n; }
    const blocked = city.buildings.some((b) => b.solid && n.x > b.x - 22 && n.x < b.x + b.w + 22 && n.y > b.y - 22 && n.y < b.y + b.h + 22);
    if (!blocked && dd < bd) { bd = dd; best = n; }
  }
  const chosen = best || fallback;
  return chosen ? { x: chosen.x, y: chosen.y } : { x: ISLAND.cx, y: ISLAND.cy };
}

function landmarkBuilding(city, spec) {
  const x = spec.target[0] * city.w - spec.w / 2, y = spec.target[1] * city.h - spec.h / 2;
  const d = city.districtById[spec.district], b = makeBuilding(new Rng((city.seed ^ spec.id.length * 811) >>> 0), d, Math.max(40, Math.min(city.w - spec.w - 40, x)), Math.max(40, Math.min(city.h - spec.h - 40, y)), spec.w, spec.h, { style: spec.style, h3d: spec.h3d, color: spec.color, roofColor: spec.roofColor, landmark: true, signChance: 0, ac: 0, water: false, solid: true, streetEdges: [] });
  b.name = spec.name; b.hangul = spec.hangul; b.label = spec.label; b.kind = spec.kind; b.region = 'jeju'; b.districtName = d.name; b.districtHangul = d.hangul;
  city.buildings.push(b);
  return b;
}

function addLandmarks(city) {
  city.landmarks = [];
  for (const spec of LANDMARKS) {
    const b = landmarkBuilding(city, spec);
    city.landmarks.push({ id: spec.id, name: spec.name, hangul: spec.hangul, label: spec.label, kind: spec.kind, district: spec.district, region: 'jeju', x: b.x + b.w / 2, y: b.y + b.h / 2, building: b });
  }
  city.landmarks.push({ id: 'jeju-international-airport', name: 'Jeju International Airport', hangul: '제주국제공항', label: 'Aeroporto Internazionale di Jeju', kind: 'airport', district: 'gimpo', region: 'jeju', x: AIRPORT.x + AIRPORT.w * 0.66, y: AIRPORT.y + AIRPORT.h * 0.84 });
  city.landmarks.push({ id: 'jeju-port', name: 'Jeju Port Ferry Terminal', hangul: '제주항 여객터미널', label: 'Terminal dei traghetti di Jeju', kind: 'port', district: 'docks', region: 'jeju', x: PORT.x + PORT.w * 0.55, y: PORT.y + PORT.h * 0.35 });
  city.regionalLandmarks = city.landmarks;
}

function addTransit(city) {
  city.transitStations = [];
  city.metroEntrances = [];
  for (const spec of TRANSIT) {
    const p = nearestRoadPoint(city, spec.target);
    const station = { id: spec.id, name: spec.name, label: spec.label, hangul: spec.hangul, x: p.x, y: p.y, arrivalX: p.x, arrivalY: p.y, lines: [...spec.lines], region: 'jeju' };
    city.transitStations.push(station);
    // x/y sono il centro: il registro delle regioni può poi spostare il vano
    // sul marciapiede senza reinterpretare la coordinata editoriale.
    const entrance = { x: p.x, y: p.y, w: 56, h: 36, stationId: station.id, name: spec.name, hangul: spec.hangul, region: 'jeju' };
    city.metroEntrances.push(entrance);
    // L'accesso visibile è il prop normalizzato da `regions.reindex`: un secondo
    // volume edilizio qui verrebbe estruso con la quota di Hallasan e resterebbe
    // sul nodo originario anche se la scala viene spostata sul marciapiede.
    city.props.push({ type: 'busstop', x: p.x, y: p.y - 34, rot: 0, z: 44, solid: false, r: 20, stationId: station.id, transit: true });
  }
  city.transitEntrances = city.metroEntrances;
}

function addIntersections(city) {
  city.intersections = []; city.crosswalks = [];
  for (let i = 0; i < city.vLines.length; i++) for (let j = 0; j < city.hLines.length; j++) {
    const v = city.vLines[i], h = city.hLines[j];
    const up = j > 0 && v.on[j - 1], down = j < city.hLines.length - 1 && v.on[j];
    const left = i > 0 && h.on[i - 1], right = i < city.vLines.length - 1 && h.on[i];
    if (!(up || down) || !(left || right)) continue;
    city.intersections.push({ x: v.c, y: h.c, vw: v.width, hw: h.width, arterial: v.arterial && h.arterial, vi: i, hi: j });
    const off = 8;
    if (up) city.crosswalks.push({ x: v.c, y: h.c - h.width / 2 - off, w: v.width, h: 16, horiz: true });
    if (down) city.crosswalks.push({ x: v.c, y: h.c + h.width / 2 + off, w: v.width, h: 16, horiz: true });
    if (left) city.crosswalks.push({ x: v.c - v.width / 2 - off, y: h.c, w: 16, h: h.width, horiz: false });
    if (right) city.crosswalks.push({ x: v.c + v.width / 2 + off, y: h.c, w: 16, h: h.width, horiz: false });
  }
}

function indexCity(city) {
  city.buildingGrid = new SpatialGrid(city.w, city.h, 300);
  for (const b of city.buildings) { b.elev = b.elev || elevationAt(b.x + b.w / 2, b.y + b.h / 2); city.buildingGrid.insertRect(b); }
  city.propGrid = new SpatialGrid(city.w, city.h, 220);
  for (const p of city.props) city.propGrid.insertRect({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2, prop: p });
  city.solidGrid = new SpatialGrid(city.w, city.h, 260);
  for (const b of city.buildings) if (b.solid) city.solidGrid.insertRect(b);
  for (const p of city.props) if (p.solid) city.solidGrid.insertRect({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2, prop: p, solid: true });
  for (const s of city.stairs) city.solidGrid.insertRect(s);
  city.blockGrid = new SpatialGrid(city.w, city.h, 400);
  for (const b of city.blocks) city.blockGrid.insertRect(b);
}

function addPiers(city) {
  city.piers = []; city.boatSpots = [];
  addPier(city, Math.max(40, coastAt(1080) - 260), 1030, 300, 76, 'ferry');
  addPier(city, Math.max(40, coastAt(1240) - 220), 1190, 250, 72, 'boat');
  // La costa sud-est resta acqua anche senza l'helper grafico della battigia ovest.
  city.piers.push({ x: 4070, y: 4800, w: 84, h: 300, islandPier: true });
  city.boatSpots.push({ x: 4110, y: 5160, angle: Math.PI / 2, kind: 'boat' });
}

export function createJejuCity(seed = JEJU_SEED) {
  const rng = new Rng(seed);
  const localDistricts = DISTRICTS.map(cloneDistrict);
  const localDistrictById = Object.fromEntries(localDistricts.map((d) => [d.id, d]));
  const city = {
    w: WORLD.w, h: WORLD.h, seed, region: { id: 'jeju', name: 'Jeju', hangul: '제주' }, name: 'Jeju', nameIt: 'Jeju', hangul: '제주',
    vLines: [], hLines: [], river: { id: 'hancheon-stream', name: 'Hancheon Stream', hangul: '한천', label: 'Torrente Hancheon', y0: RIVER.y0, y1: RIVER.y1, bridges: [{ x: 1240, w: 132 }, { x: 2600, w: 132 }, { x: 4100, w: 132 }] },
    blocks: [], buildings: [], props: [], landmarks: [], crosswalks: [], intersections: [], runways: [], taxiways: [], aprons: [], helipads: [], piers: [], airSpots: [], boatSpots: [], stairs: [],
    districts: localDistricts, districtById: localDistrictById, getDistrict: (id) => localDistrictById[id] || null,
  };
  city.elevationAt = elevationAt;
  city.urbanAt = urbanityAt;
  city.districtAt = (x, y) => districtFor(city, x, y);
  city.coastAt = coastAt;
  city.waterX = coastAt(ISLAND.cy);
  city.quayX = city.waterX + 170;
  city.coastLine = { c: city.quayX, width: 132, arterial: true, keep: true };
  city.coastIdx = 0;
  city.water = { id: 'jeju-coast', name: 'Jeju Coast', hangul: '제주 해안', label: 'Costa di Jeju', kind: 'island', type: 'island', isIsland: true, island: true, region: 'jeju', x: city.waterX, coastAt };
  city.sea = city.water;
  city.coast = city.water;
  city.coastline = city.water;
  city.island = { id: 'jeju-do', name: 'Jeju Island', hangul: '제주도', label: 'Isola di Jeju', kind: 'island', type: 'island', isIsland: true, island: true, region: 'jeju' };
  city.isIsland = true;
  city.waterIdentity = { id: 'jeju-do', name: 'Jeju Island', hangul: '제주도', label: 'Isola di Jeju', island: city.island, coast: city.water, river: city.river };
  city.waterBoundary = { type: 'superellipse', cx: ISLAND.cx, cy: ISLAND.cy, rx: ISLAND.rx, ry: ISLAND.ry, power: ISLAND.power };

  ({ vLines: city.vLines, hLines: city.hLines } = buildLines());
  city.riverCell = -1; city.doglegs = 0;
  city.airport = { ...AIRPORT, district: 'gimpo' };
  city.port = { ...PORT, district: 'docks' };

  // La maschera d'acqua è definita prima di creare i blocchi: così nessun
  // isolato viene allocato nel torrente o oltre la sagoma dell'isola.
  city.isWater = (x, y) => {
    if (city.piers.some((p) => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h)) return false;
    if (y > RIVER.y0 && y < RIVER.y1) {
      if (city.river.bridges.some((b) => Math.abs(x - b.x) < b.w / 2)) return false;
      return true;
    }
    return !insideIsland(x, y);
  };

  // Le celle sovrapposte ai due grandi scali vengono sostituite da un unico
  // rettangolo: il resto della rete conserva una maglia irregolare e anulare.
  for (let i = 0; i < XS.length - 1; i++) for (let j = 0; j < YS.length - 1; j++) {
    const x = XS[i] + city.vLines[i].width / 2, y = YS[j] + city.hLines[j].width / 2;
    const w = XS[i + 1] - city.vLines[i + 1].width / 2 - x, h = YS[j + 1] - city.hLines[j + 1].width / 2 - y;
    if (w < 36 || h < 36) continue;
    const cx = x + w / 2, cy = y + h / 2;
    if (!insideIsland(cx, cy) || city.isWater(cx, cy)) continue;
    const r = { x, y, w, h };
    if (rectOverlap(r, AIRPORT) || rectOverlap(r, PORT)) continue;
    const d = districtFor(city, cx, cy), u = city.urbanAt(cx, cy);
    const nearHill = Math.hypot(cx - ISLAND.cx, cy - ISLAND.cy) < 920;
    const settlement = u > 0.45 || (cx < 1600 && cy < 1800) || (cx > 2450 && cy > 3450) || (cx > 3700 && cy < 2550) || (cx < 1550 && cy > 1650);
    let type = nearHill ? 'park' : settlement ? 'urban' : (rng.chance(0.18) ? 'park' : 'rural');
    if (d.id === 'docks' && (cx < 1150 && cy < 1500)) type = 'dock';
    const block = { ...r, type, district: d.id, onArterial: city.vLines[i].arterial || city.vLines[i + 1].arterial || city.hLines[j].arterial || city.hLines[j + 1].arterial, yards: [], alleys: [] };
    city.blocks.push(block);
    if (type === 'urban') fillUrban(rng, city, block, d);
    else if (type === 'park') fillPark(rng, city, block, d);
    else if (type === 'dock') fillDock(rng, city, block, d);
    else fillRural(rng, city, block, d);
    if (type !== 'rural') decorateEdges(rng, city, block, d);
    decorateYards(rng, city, block);
  }
  const airportBlock = { ...AIRPORT, type: 'airport', district: 'gimpo', onArterial: true, yards: [], alleys: [] };
  city.blocks.push(airportBlock); fillAirport(rng, city, airportBlock, DISTRICT_BY_ID.gimpo);
  const portBlock = { ...PORT, type: 'port', district: 'docks', onArterial: true, yards: [], alleys: [] };
  city.blocks.push(portBlock); fillPort(rng, city, portBlock, DISTRICT_BY_ID.docks);
  addPiers(city);

  addIntersections(city);
  city.graph = buildRoadGraph(city);
  addLandmarks(city);
  addTransit(city);
  placeHospitalsAndPolice(city);
  placeShops(city);
  placeGarages(city);
  placeTurfs(city);

  for (const b of city.blocks) for (const a of b.alleys) {
    if (!a.through || a.h < 130 && a.w < 130) continue;
    const vertical = a.h > a.w, len = vertical ? a.h : a.w;
    const a0 = vertical ? { x: a.x + a.w / 2, y: a.y } : { x: a.x, y: a.y + a.h / 2 };
    const a1 = vertical ? { x: a0.x, y: a.y + a.h } : { x: a.x + a.w, y: a0.y };
    if (Math.abs(elevationAt(a1.x, a1.y) - elevationAt(a0.x, a0.y)) / len > 0.018) {
      a.stairs = true; city.stairs.push({ x: a.x, y: a.y, w: a.w, h: a.h, vehicleOnly: true });
    }
  }

  city.isWater = (x, y) => {
    if (city.piers.some((p) => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h)) return false;
    if (y > RIVER.y0 && y < RIVER.y1) {
      if (city.river.bridges.some((b) => Math.abs(x - b.x) < b.w / 2)) return false;
      return true;
    }
    return !insideIsland(x, y);
  };
  city.isOnRoad = (x, y) => {
    for (const l of city.vLines) if (Math.abs(x - l.c) < l.width / 2 && l.segments.some((s) => y >= s[0] && y <= s[1])) return true;
    for (const l of city.hLines) if (Math.abs(y - l.c) < l.width / 2 && l.segments.some((s) => x >= s[0] && x <= s[1])) return true;
    return false;
  };
  city.coastAt = coastAt;
  city.spawn = { x: city.transitStations[0].arrivalX, y: city.transitStations[0].arrivalY, angle: 0 };
  indexCity(city);
  city.stats = {
    buildings: city.buildings.length, props: city.props.length, blocks: city.blocks.length, nodes: city.graph.usableNodes.length, edges: city.graph.edges.length,
    doglegs: city.doglegs, stairs: city.stairs.length, shops: city.shops.length, venues: city.shops.reduce((n, s) => n + s.biz.length, 0), garages: city.garages.length,
    rural: city.blocks.filter((b) => b.type === 'rural').length, piers: city.piers.length, turfs: city.turfs.length, landmarks: city.landmarks.length, transitStations: city.transitStations.length,
  };
  return city;
}

function rectOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
