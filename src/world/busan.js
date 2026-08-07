// Busan (부산) è una regione generata qui, non una variante della maglia di Seoul.
// La costa frastagliata, il Nakdong e le colline cambiano proprio la topologia del
// mondo: il contratto finale resta però quello che usano traffico, polizia, negozi
// e renderer.
import { Rng } from '../core/rng.js';
import { SpatialGrid } from '../core/spatial.js';
import { buildRoadGraph } from './roadgraph.js';
import { BUSINESSES, DISTRICT_MIX } from './interiors.js';

export const BUSAN_SEED = 20260807;
export const BUSAN_WORLD = { w: 6400, h: 5600, margin: 170 };
const SIDEWALK = 22;
const DOOR_OUT = 11;

// Gli id restano quelli che gli altri sistemi conoscono. Tutto il resto è locale:
// nomi, semi, colori e densità non scrivono mai nei distretti condivisi di Seoul.
const BUSAN_DISTRICTS = [
  {
    id: 'hongdae', name: 'Seomyeon', hangul: '서면', subtitle: 'Metro, vicoli e vita notturna', seed: { x: 0.49, y: 0.47 },
    block: { minLot: 58, maxLot: 116, gapChance: 0.12 }, grid: { step: [128, 222], superblock: 0.12, jog: 0.32 },
    heights: [42, 142], styles: ['brick', 'concrete', 'glass'], facade: ['#7b6682', '#9a6f6a', '#597d8e', '#8f7c66'], roof: '#403b48',
    accent: '#58dcff', accent2: '#ff6b9e', ground: '#292d35', sidewalk: '#515661', signDensity: 0.9, treeDensity: 0.12,
    trafficDensity: 1.1, pedDensity: 1.7, pedMix: ['student', 'student', 'office', 'tourist', 'gangster'], vehicleMix: ['hatch', 'sedan', 'taxi', 'scooter', 'van'],
  },
  {
    id: 'myeongdong', name: 'Gwangalli', hangul: '광안리', subtitle: 'Spiaggia, neon e il ponte sulla baia', seed: { x: 0.68, y: 0.54 },
    block: { minLot: 72, maxLot: 150, gapChance: 0.1 }, grid: { step: [150, 248], superblock: 0.16, jog: 0.24 },
    heights: [58, 186], styles: ['concrete', 'glass', 'panel'], facade: ['#7a6670', '#806f63', '#5f7687', '#9a735e'], roof: '#423c43',
    accent: '#ffcb48', accent2: '#ff5d72', ground: '#2d2b31', sidewalk: '#5a5559', signDensity: 0.95, treeDensity: 0.1,
    trafficDensity: 1.15, pedDensity: 1.8, pedMix: ['tourist', 'office', 'civil', 'student'], vehicleMix: ['sedan', 'taxi', 'suv', 'sport', 'bus'],
  },
  {
    id: 'itaewon', name: 'Nampo-dong', hangul: '남포동', subtitle: 'Busan Tower, porto vecchio e mercati', seed: { x: 0.32, y: 0.56 },
    block: { minLot: 62, maxLot: 136, gapChance: 0.16 }, grid: { step: [134, 236], superblock: 0.2, jog: 0.4 },
    heights: [38, 126], styles: ['brick', 'concrete', 'panel'], facade: ['#8b684e', '#7d5e50', '#94735a', '#6b6258'], roof: '#473a31',
    accent: '#ff922d', accent2: '#49e0a9', ground: '#2e2a27', sidewalk: '#554d46', signDensity: 0.84, treeDensity: 0.15,
    trafficDensity: 0.88, pedDensity: 1.5, pedMix: ['tourist', 'civil', 'gangster', 'student'], vehicleMix: ['sedan', 'suv', 'hatch', 'taxi', 'van', 'scooter'],
  },
  {
    id: 'gangnam', name: 'Haeundae', hangul: '해운대', subtitle: 'Spiaggia, hotel e skyline di Centum City', seed: { x: 0.82, y: 0.58 },
    block: { minLot: 118, maxLot: 254, gapChance: 0.06 }, grid: { step: [264, 420], superblock: 0.28, jog: 0.08 },
    heights: [92, 356], styles: ['glass', 'glass', 'panel'], facade: ['#456b87', '#3f607e', '#577995', '#5c7a90'], roof: '#2e414f',
    accent: '#48ddff', accent2: '#b78cff', ground: '#252a31', sidewalk: '#4e5964', signDensity: 0.54, treeDensity: 0.2,
    trafficDensity: 1.3, pedDensity: 1.15, pedMix: ['office', 'office', 'civil', 'tourist'], vehicleMix: ['sedan', 'sedan', 'suv', 'sport', 'taxi', 'bus'],
  },
  {
    id: 'docks', name: 'Jagalchi', hangul: '자갈치', subtitle: 'Mercato del pesce, moli e contrabbando', seed: { x: 0.22, y: 0.72 },
    block: { minLot: 190, maxLot: 350, gapChance: 0.3 }, grid: { step: [320, 540], superblock: 0.44, jog: 0.1 },
    heights: [24, 72], styles: ['warehouse', 'warehouse', 'panel'], facade: ['#59676a', '#4f5e61', '#6b7066', '#555b58'], roof: '#394443',
    accent: '#ffd34c', accent2: '#49d7a0', ground: '#24282b', sidewalk: '#494f50', signDensity: 0.28, treeDensity: 0.035,
    trafficDensity: 0.62, pedDensity: 0.5, pedMix: ['worker', 'worker', 'gangster', 'civil'], vehicleMix: ['truck', 'truck', 'van', 'suv', 'sedan'],
  },
  {
    id: 'gimpo', name: 'Sasang', hangul: '사상', subtitle: 'Il Nakdong, officine e scali ferroviari', seed: { x: 0.12, y: 0.43 },
    block: { minLot: 154, maxLot: 292, gapChance: 0.28 }, grid: { step: [310, 520], superblock: 0.38, jog: 0.08 },
    heights: [22, 62], styles: ['warehouse', 'panel', 'warehouse'], facade: ['#65727a', '#586872', '#727a7d', '#596467'], roof: '#424d55',
    accent: '#59c9ff', accent2: '#ffe879', ground: '#2b322f', sidewalk: '#505856', signDensity: 0.2, treeDensity: 0.2,
    trafficDensity: 0.66, pedDensity: 0.58, pedMix: ['worker', 'tourist', 'civil', 'office'], vehicleMix: ['van', 'truck', 'sedan', 'bus', 'suv'],
  },
  {
    id: 'gyeonggi', name: 'Dongnae', hangul: '동래', subtitle: 'Colline, terme e case basse', seed: { x: 0.54, y: 0.17 },
    block: { minLot: 150, maxLot: 320, gapChance: 0.34 }, grid: { step: [300, 560], superblock: 0.46, jog: 0.12 },
    heights: [24, 88], styles: ['panel', 'brick', 'concrete'], facade: ['#7f745d', '#6d6c57', '#857963', '#596a55'], roof: '#494638',
    accent: '#a6df52', accent2: '#ffbd4c', ground: '#333722', sidewalk: '#504f43', signDensity: 0.18, treeDensity: 0.45,
    trafficDensity: 0.5, pedDensity: 0.42, pedMix: ['worker', 'civil', 'civil', 'gangster'], vehicleMix: ['tractor', 'truck', 'van', 'hatch', 'sedan'],
  },
];
const DISTRICT_BY_ID = Object.fromEntries(BUSAN_DISTRICTS.map((d) => [d.id, d]));

const LANDMARK_SPECS = [
  { id: 'busan-tower', name: 'Busan Tower', hangul: '부산타워', label: 'Torre di Busan', kind: 'tower', district: 'itaewon', target: [0.34, 0.54], style: 'tower', w: 82, h: 82, h3d: 490, color: '#8e929b', roofColor: '#c9ccd5' },
  { id: 'jagalchi-market', name: 'Jagalchi Market', hangul: '자갈치시장', label: 'Mercato di Jagalchi', kind: 'market', district: 'docks', target: [0.23, 0.72], style: 'warehouse', w: 290, h: 176, h3d: 78, color: '#a96950', roofColor: '#4e4039' },
  { id: 'centum-city', name: 'Centum City', hangul: '센텀시티', label: 'Centum City', kind: 'district', district: 'gangnam', target: [0.77, 0.55], style: 'glass', w: 176, h: 176, h3d: 372, color: '#4e7996', roofColor: '#2d4659' },
];
const TRANSIT_SPECS = [
  { id: 'busan-nampo', name: 'Nampo Station', label: 'Stazione Nampo', hangul: '남포역', target: [0.34, 0.54], lines: ['1'] },
  { id: 'busan-jagalchi', name: 'Jagalchi Station', label: 'Stazione Jagalchi', hangul: '자갈치역', target: [0.24, 0.70], lines: ['1'] },
  { id: 'busan-seomyeon', name: 'Seomyeon Station', label: 'Stazione Seomyeon', hangul: '서면역', target: [0.5, 0.48], lines: ['1', '2'] },
  { id: 'busan-gwangalli', name: 'Gwangalli Station', label: 'Stazione Gwangalli', hangul: '광안역', target: [0.68, 0.54], lines: ['2'] },
  { id: 'busan-haeundae', name: 'Haeundae Station', label: 'Stazione Haeundae', hangul: '해운대역', target: [0.84, 0.58], lines: ['2'] },
  { id: 'busan-centum', name: 'Centum City Station', label: 'Stazione Centum City', hangul: '센텀시티역', target: [0.77, 0.55], lines: ['2', 'Donghae'] },
  { id: 'busan-sasang', name: 'Sasang Station', label: 'Stazione Sasang', hangul: '사상역', target: [0.14, 0.43], lines: ['2', 'Gimhae'] },
];
const GANGS = [
  { id: 'baekho', name: 'Tigre Bianca', hangul: '백호파', color: '#e8e2d0', trade: 'armi' },
  { id: 'heuksa', name: 'Serpe Nera', hangul: '흑사파', color: '#7d5ce0', trade: 'contrabbando' },
  { id: 'cheolma', name: 'Cavallo di Ferro', hangul: '철마파', color: '#ff7a29', trade: 'auto rubate' },
  { id: 'hwangso', name: 'Bue Giallo', hangul: '황소파', color: '#ffd23f', trade: 'usura' },
];

function hashNoise(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const ux = x - xi, uy = y - yi;
  const smooth = (t) => t * t * (3 - 2 * t);
  const a = hashNoise(xi, yi, seed), b = hashNoise(xi + 1, yi, seed);
  const c = hashNoise(xi, yi + 1, seed), d = hashNoise(xi + 1, yi + 1, seed);
  const p = a + (b - a) * smooth(ux), q = c + (d - c) * smooth(ux);
  return p + (q - p) * smooth(uy);
}
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function hashSeed(seed, text) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function weightedPick(rng, arr) { return arr[Math.floor(rng.next() * arr.length)]; }

function cloneDistrict(d) {
  return {
    ...d,
    seed: { ...d.seed }, block: { ...d.block }, grid: { ...d.grid, step: [...d.grid.step] },
    heights: [...d.heights], styles: [...d.styles], facade: [...d.facade], pedMix: [...d.pedMix], vehicleMix: [...d.vehicleMix],
  };
}

function line(c, width, arterial = false) {
  return { c, width, arterial, segments: [], on: [] };
}
function lineSpan(l) { return { a: l.c - l.width / 2, b: l.c + l.width / 2 }; }

function makeBuilding(rng, district, x, y, w, h, opts = {}) {
  const b = {
    x, y, w, h,
    h3d: opts.h3d ?? Math.max(24, Math.round(district.heights[0] + rng.next() * (district.heights[1] - district.heights[0]))),
    elev: 0,
    style: opts.style || weightedPick(rng, district.styles),
    color: opts.color || weightedPick(rng, district.facade),
    roofColor: opts.roofColor || district.roof,
    variant: opts.variant ?? rng.int(0, 3),
    litSeed: opts.litSeed ?? rng.int(0, 9999),
    district: district.id,
    solid: opts.solid !== false,
    signs: [],
    edges: opts.streetEdges || [],
    landmark: !!opts.landmark,
    ac: opts.ac ?? rng.int(0, 3),
    water: opts.water ?? rng.chance(0.18),
    region: 'busan',
  };
  if (opts.name) { b.name = opts.name; b.hangul = opts.hangul; b.label = opts.label; }
  if (b.h3d > 32 && opts.signChance !== 0) {
    const chance = opts.signChance ?? district.signDensity;
    for (const edge of b.edges) if (rng.chance(chance)) {
      b.signs.push({ edge, t: rng.range(0.18, 0.82), word: weightedPick(rng, ['노래방', '치킨', '편의점', '술집', '호텔', '분식']), color: district.accent, vertical: rng.chance(0.62), h: rng.range(0.35, 0.8) });
    }
  }
  return b;
}

function addProp(city, type, x, y, opts = {}) {
  city.props.push({ type, x, y, rot: opts.rot || 0, z: opts.z ?? 20, solid: !!opts.solid, r: opts.r ?? 12, ...opts });
}

function fillPark(city, rng, block, district) {
  block.yards.push({ x: block.x, y: block.y, w: block.w, h: block.h });
  const count = Math.max(8, Math.floor((block.w * block.h) / 6200));
  for (let i = 0; i < count; i++) addProp(city, 'tree', block.x + rng.range(18, Math.max(19, block.w - 18)), block.y + rng.range(18, Math.max(19, block.h - 18)), { z: rng.range(42, 80), r: 13, tint: rng.int(0, 2) });
  if (rng.chance(0.5)) addProp(city, 'bench', block.x + block.w * rng.range(0.25, 0.75), block.y + block.h * rng.range(0.25, 0.75), { r: 14 });
}

function fillDock(city, rng, block, district) {
  const pad = 18;
  const area = { x: block.x + pad, y: block.y + pad, w: block.w - pad * 2, h: block.h - pad * 2 };
  block.yards.push(area);
  const shedW = Math.min(260, area.w * 0.34), shedH = Math.min(150, area.h * 0.58);
  city.buildings.push(makeBuilding(rng, district, area.x + area.w - shedW, area.y + (area.h - shedH) / 2, shedW, shedH, { style: 'warehouse', h3d: rng.int(46, 76), streetEdges: ['right'], signChance: 0.35 }));
  const cols = Math.max(2, Math.floor((area.w - shedW - 44) / 58));
  // Le ultime celle costiere possono essere basse: forzare una riga da 92 px
  // in un piazzale più sottile la faceva uscire sulla strada di confine.
  const rows = Math.max(0, Math.floor((area.h - 24) / 110));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (rng.chance(0.74)) {
    const palette = ['#c8493a', '#3f7ea8', '#cf9a2f', '#4a8f5e', '#8f5aa8'];
    city.buildings.push({ x: area.x + 12 + i * 58, y: area.y + 12 + j * 110, w: 40, h: 92, h3d: 26 * rng.int(1, 3), elev: 0, style: 'container', color: weightedPick(rng, palette), roofColor: '#2c3336', variant: 1, litSeed: rng.int(0, 9999), district: district.id, solid: true, signs: [], landmark: false, ac: 0, water: false, region: 'busan' });
  }
  addProp(city, 'crane', area.x + area.w * 0.5, area.y + area.h * 0.5, { z: 150, solid: true, r: 26, rot: Math.PI / 2 });
}

function fillRural(city, rng, block, district) {
  const pad = 14;
  const area = { x: block.x + pad, y: block.y + pad, w: block.w - pad * 2, h: block.h - pad * 2 };
  block.fields = [];
  const cols = Math.max(1, Math.floor(area.w / 180)), rows = Math.max(1, Math.floor(area.h / 170));
  const fw = area.w / cols - 8, fh = area.h / rows - 8;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) block.fields.push({ x: area.x + i * (fw + 8), y: area.y + j * (fh + 8), w: fw, h: fh, wet: rng.chance(0.3), crop: rng.int(0, 3) });
  if (rng.chance(0.4) && area.w > 100 && area.h > 100) city.buildings.push(makeBuilding(rng, district, area.x + area.w * 0.2, area.y + area.h * 0.2, Math.min(120, area.w * 0.55), Math.min(88, area.h * 0.42), { style: 'greenhouse', h3d: rng.int(24, 48), streetEdges: [] }));
  for (let i = 0; i < Math.floor(area.w * area.h / 12000); i++) addProp(city, 'tree', area.x + rng.range(18, Math.max(19, area.w - 18)), area.y + rng.range(18, Math.max(19, area.h - 18)), { z: 52, r: 13, tint: rng.int(0, 2) });
}

function fillUrban(city, rng, block, district) {
  const pad = Math.min(SIDEWALK, Math.max(8, (Math.min(block.w, block.h) - 42) / 2));
  const x0 = block.x + pad, y0 = block.y + pad, bw = block.w - pad * 2, bh = block.h - pad * 2;
  if (bw < 42 || bh < 42) return;
  const push = (x, y, w, h, edges, corner = false) => {
    if (w < 30 || h < 30 || rng.chance(district.block.gapChance)) { block.yards.push({ x, y, w, h }); return; }
    city.buildings.push(makeBuilding(rng, district, x, y, w, h, { streetEdges: edges, arterial: block.onArterial, corner, signChance: district.signDensity }));
  };
  const topCount = Math.max(1, Math.floor(bw / rng.range(district.block.minLot, district.block.maxLot)));
  const topW = bw / topCount;
  for (let i = 0; i < topCount; i++) {
    const ww = topW - 4;
    push(x0 + i * topW, y0, ww, Math.min(88, bh * 0.36), ['top'], i === 0);
    push(x0 + i * topW, y0 + bh - Math.min(88, bh * 0.36), ww, Math.min(88, bh * 0.36), ['bottom'], i === topCount - 1);
  }
  if (bh > 160 && bw > 120) {
    const sideH = Math.max(38, bh - Math.min(88, bh * 0.36) * 2 - 6);
    const sideW = Math.min(92, bw * 0.3);
    const n = Math.max(1, Math.floor(sideH / rng.range(district.block.minLot, district.block.maxLot)));
    for (let i = 0; i < n; i++) {
      const hh = sideH / n - 4;
      push(x0, y0 + Math.min(88, bh * 0.36) + 3 + i * (hh + 4), sideW, hh, ['left'], i === 0);
      push(x0 + bw - sideW, y0 + Math.min(88, bh * 0.36) + 3 + i * (hh + 4), sideW, hh, ['right'], i === n - 1);
    }
    const yard = { x: x0 + sideW + 6, y: y0 + Math.min(88, bh * 0.36) + 4, w: Math.max(30, bw - sideW * 2 - 12), h: Math.max(28, sideH - 8) };
    block.yards.push(yard);
    block.courtyard = yard;
    // Isolati di Busan spesso hanno un edificio interno oltre alle fasce di
    // negozi: piccoli studi, pensioni e magazzini che rendono la trama densa
    // anche quando la strada costiera lascia un cortile profondo.
    const innerCount = bw > 310 && bh > 280 ? 5 : 4;
    for (let i = 0; i < innerCount; i++) {
      const iw = Math.min(108, Math.max(54, yard.w * 0.34));
      const ih = Math.min(92, Math.max(48, yard.h * 0.38));
      const ix = yard.x + yard.w * (innerCount === 1 ? 0.5 : (i ? 0.7 : 0.3)) - iw / 2;
      const iy = yard.y + yard.h * 0.5 - ih / 2;
      city.buildings.push(makeBuilding(rng, district, ix, iy, iw, ih, { streetEdges: [], arterial: block.onArterial, signChance: 0.08 }));
      addProp(city, 'ac_unit', ix + iw * 0.5, iy + ih * 0.5, { solid: true, r: 11, z: 26 });
    }
    if (rng.chance(0.68)) addProp(city, 'bench', yard.x + yard.w * rng.range(0.25, 0.75), yard.y + yard.h * rng.range(0.25, 0.75), { r: 14 });
  }
  for (const side of [
    { x: block.x + 18, y: block.y + 12, dx: block.w - 36, dy: 0 },
    { x: block.x + 18, y: block.y + block.h - 12, dx: block.w - 36, dy: 0 },
    { x: block.x + 12, y: block.y + 18, dx: 0, dy: block.h - 36 },
    { x: block.x + block.w - 12, y: block.y + 18, dx: 0, dy: block.h - 36 },
  ]) {
    const len = Math.hypot(side.dx, side.dy);
    const step = len > 220 ? 128 : 168;
    for (let t = step * 0.5; t < len; t += step) {
      const u = t / len;
      addProp(city, rng.chance(0.72) ? 'lamp' : 'tree', side.x + side.dx * u, side.y + side.dy * u, { z: rng.chance(0.72) ? 44 : 54, r: rng.chance(0.72) ? 8 : 13, tint: rng.int(0, 2) });
    }
  }
}

function doorPoint(b, edge) {
  const cx = edge === 'left' ? b.x : edge === 'right' ? b.x + b.w : b.x + b.w / 2;
  const cy = edge === 'top' ? b.y : edge === 'bottom' ? b.y + b.h : b.y + b.h / 2;
  const normal = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[edge];
  return { x: cx + normal[0] * DOOR_OUT, y: cy + normal[1] * DOOR_OUT, nx: normal[0], ny: normal[1], edge };
}
function shopCandidate(b) { return b.edges?.length && !b.landmark && b.style !== 'container' && !b.flat && b.w >= 40 && b.h >= 40; }
function makeShop(city, rng, b, edge, groundId, mix) {
  const d = doorPoint(b, edge);
  const levels = Math.max(1, Math.min(4, 1 + Math.floor((b.h3d - 30) / 46)));
  const biz = [groundId]; for (let i = 1; i < levels; i++) biz.push(weightedPick(rng, mix.upper));
  const spec = BUSINESSES[groundId] || BUSINESSES.conv;
  const shop = { id: city.shops.length, x: d.x, y: d.y, nx: d.nx, ny: d.ny, edge, w: b.w, h: b.h, building: b, district: b.district, biz, name: spec.label, hangul: spec.hangul, blip: spec.blip || null, seed: (city.seed + b.x * 7919 + b.y * 104729 + city.shops.length * 31) >>> 0 };
  b.shop = shop; city.shops.push(shop); return shop;
}
function placeShops(city) {
  const rng = new Rng((city.seed ^ 0x5e0c1) >>> 0); city.shops = [];
  const doors = new SpatialGrid(city.w, city.h, 160);
  for (const b of city.buildings) {
    if (!shopCandidate(b)) continue;
    const d = DISTRICT_BY_ID[b.district], mix = DISTRICT_MIX[b.district] || DISTRICT_MIX.hongdae;
    if (!rng.chance((d?.signDensity || 0.6) * 0.62)) continue;
    const edge = weightedPick(rng, b.edges), p = doorPoint(b, edge);
    const near = doors.queryCircle(p.x, p.y, 80);
    if (near.some((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < 80 * 80)) continue;
    const s = makeShop(city, rng, b, edge, weightedPick(rng, mix.ground), mix);
    doors.insertRect({ x: s.x - 1, y: s.y - 1, w: 2, h: 2, x0: s.x, y0: s.y });
  }
  for (const h of city.hospitals) {
    const best = city.buildings.filter((b) => b.district === h.district && shopCandidate(b)).sort((a, b) => ((a.x - h.x) ** 2 + (a.y - h.y) ** 2) - ((b.x - h.x) ** 2 + (b.y - h.y) ** 2))[0];
    if (!best) continue;
    if (best.shop) { best.shop.biz[0] = 'clinic'; best.shop.name = BUSINESSES.clinic.label; best.shop.hangul = BUSINESSES.clinic.hangul; best.shop.blip = BUSINESSES.clinic.blip; h.x = best.shop.x; h.y = best.shop.y; h.shop = best.shop; }
    else { const s = makeShop(city, rng, best, best.edges[0], 'clinic', DISTRICT_MIX[best.district] || DISTRICT_MIX.hongdae); h.x = s.x; h.y = s.y; h.shop = s; }
  }
  for (const d of BUSAN_DISTRICTS) {
    if (city.shops.some((s) => s.district === d.id && s.biz[0] === 'pawn')) continue;
    const b = city.buildings.find((q) => q.district === d.id && shopCandidate(q) && !q.shop);
    if (b) makeShop(city, rng, b, b.edges[0], 'pawn', DISTRICT_MIX[d.id] || DISTRICT_MIX.hongdae);
  }
}
function placeGarages(city) {
  city.garages = [];
  for (const d of BUSAN_DISTRICTS) {
    const b = city.buildings.filter((q) => q.district === d.id && shopCandidate(q) && !q.shop && !q.garage && q.w >= 70).sort((a, z) => (a.x - d.seed.x * city.w) ** 2 + (a.y - d.seed.y * city.h) ** 2 - ((z.x - d.seed.x * city.w) ** 2 + (z.y - d.seed.y * city.h) ** 2))[0];
    if (!b) continue;
    b.garage = true; const edge = b.edges[0], p = doorPoint(b, edge); const horiz = edge === 'top' || edge === 'bottom';
    const w = horiz ? 78 : 56, h = horiz ? 56 : 78;
    city.garages.push({ x: p.x - w / 2, y: p.y - h / 2, w, h, cx: p.x, cy: p.y, edge, horiz, door: p, building: b, district: d.id, name: d.name });
  }
}
function placeTurfs(city) {
  const rng = new Rng((city.seed ^ 0x9a11d) >>> 0); city.turfs = [];
  const blocks = city.blocks.filter((b) => b.courtyard?.w > 80 && b.courtyard?.h > 70 || b.type === 'dock');
  for (let i = 0; i < Math.min(6, blocks.length); i++) {
    const b = blocks[(i * 17 + 3) % blocks.length], g = GANGS[i % GANGS.length], a = b.courtyard || b.yards[0] || b;
    const t = { x: a.x, y: a.y, w: a.w, h: a.h, cx: a.x + a.w / 2, cy: a.y + a.h / 2, gang: g.id, name: g.name, hangul: g.hangul, color: g.color, trade: g.trade, place: b.type === 'dock' ? 'Il piazzale dei container' : 'Il cortile dietro il locale', district: b.district, tag: rng.int(0, 3) };
    b.turf = t; city.turfs.push(t);
    for (let k = 0; k < 4; k++) addProp(city, k % 2 ? 'crate' : 'drum', a.x + rng.range(14, Math.max(15, a.w - 14)), a.y + rng.range(14, Math.max(15, a.h - 14)), { solid: true, r: 12, z: 24 });
  }
}

function buildSegments(lines, perp, lo, hi) {
  for (const l of lines) {
    l.segments.length = 0; let start = null;
    for (let i = 0; i < l.on.length; i++) {
      if (l.on[i]) { if (start === null) start = i === 0 ? lo : perp[i].c; }
      else if (start !== null) { l.segments.push([start, perp[i].c]); start = null; }
    }
    if (start !== null) l.segments.push([start, hi]);
  }
}

function nearestNode(city, nx, ny, used = null) {
  const tx = nx * city.w, ty = ny * city.h; let best = city.graph.usableNodes[0], bd = Infinity;
  for (const n of city.graph.usableNodes) {
    if (used && used.has(n)) continue;
    const d = (n.x - tx) ** 2 + (n.y - ty) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best || { x: tx, y: ty };
}

function safeNear(city, point, distance = 34) {
  const options = [
    { x: point.x + distance, y: point.y + distance },
    { x: point.x - distance, y: point.y + distance },
    { x: point.x + distance, y: point.y - distance },
    { x: point.x - distance, y: point.y - distance },
    { x: point.x + distance, y: point.y },
    { x: point.x, y: point.y + distance },
    { x: point.x, y: point.y },
  ];
  return options.find((p) => p.x >= 24 && p.y >= 24 && p.x <= city.w - 24 && p.y <= city.h - 24 && !city.isWater(p.x, p.y)) || options[options.length - 1];
}

function addLandmarkBuilding(city, spec) {
  const d = DISTRICT_BY_ID[spec.district];
  let best = null, bd = Infinity;
  for (const block of city.blocks) {
    if (block.district !== spec.district || block.type === 'rural' || block.w < spec.w * 0.9 || block.h < spec.h * 0.9) continue;
    const dd = (block.x + block.w / 2 - spec.target[0] * city.w) ** 2 + (block.y + block.h / 2 - spec.target[1] * city.h) ** 2;
    if (dd < bd) { bd = dd; best = block; }
  }
  const w = Math.min(spec.w, best ? best.w * 0.72 : spec.w), h = Math.min(spec.h, best ? best.h * 0.72 : spec.h);
  const x = best ? best.x + (best.w - w) / 2 : spec.target[0] * city.w - w / 2;
  const y = best ? best.y + (best.h - h) / 2 : spec.target[1] * city.h - h / 2;
  const b = makeBuilding(new Rng(hashSeed(city.seed, spec.id)), d, Math.max(0, Math.min(city.w - w, x)), Math.max(0, Math.min(city.h - h, y)), w, h, { style: spec.style, h3d: spec.h3d, color: spec.color, roofColor: spec.roofColor, landmark: true, name: spec.name, hangul: spec.hangul, label: spec.label, signChance: 0, streetEdges: [] });
  b.kind = spec.kind; b.region = 'busan'; city.buildings.push(b); if (best) best.busanLandmark = spec.id;
  city.landmarks.push({ id: spec.id, name: spec.name, hangul: spec.hangul, label: spec.label, kind: spec.kind, district: spec.district, region: 'busan', x: b.x + b.w / 2, y: b.y + b.h / 2, building: b });
  return b;
}

function adaptWater(city) {
  const river = city.river;
  river.id = 'nakdong-river'; river.name = 'Nakdong River'; river.hangul = '낙동강'; river.label = 'Fiume Nakdong'; river.region = 'busan';
  const bay = { id: 'busan-bay', name: 'Busan Bay', hangul: '부산만', label: 'Baia di Busan', kind: 'bay', type: 'bay', region: 'busan', x: city.waterX, coastAt: city.coastAt };
  city.water = bay; city.sea = bay; city.coast = bay; city.coastline = bay;
  city.waterIdentity = { id: bay.id, name: bay.name, hangul: bay.hangul, label: bay.label, river: { id: river.id, name: river.name, hangul: river.hangul, label: river.label }, coast: bay };
  city.waterBoundary = { type: 'curved-estuary-bay', coastAt: city.coastAt, river: { y0: river.y0, y1: river.y1, start: river.start, end: river.end } };
}

function addTransit(city) {
  city.transitStations = [];
  city.transitEntrances = [];
  // `regions.reindex` consumes the shared `metroEntrances` name; retaining the
  // descriptive alias keeps direct callers of this module fully playable too.
  city.metroEntrances = [];
  const used = new Set();
  for (const spec of TRANSIT_SPECS) {
    const n = nearestNode(city, spec.target[0], spec.target[1], used);
    used.add(n);
    const station = { id: spec.id, name: spec.name, hangul: spec.hangul, x: n.x, y: n.y, arrivalX: n.x, arrivalY: n.y, lines: [...spec.lines], label: spec.label, region: 'busan' };
    city.transitStations.push(station);
    const entrancePoint = safeNear(city, n);
    const entrance = { id: `${spec.id}-entrance`, stationId: spec.id, x: entrancePoint.x, y: entrancePoint.y, w: 56, h: 36, name: spec.name, hangul: spec.hangul, kind: 'metro-entrance', visible: true };
    city.transitEntrances.push(entrance);
    city.metroEntrances.push(entrance);
    addProp(city, 'kiosk', entrance.x, entrance.y, { z: 42, solid: true, r: 18, word: 'METRO', accent: '#64c7ff', stationId: spec.id, metroEntrance: true });
  }
}

function addHospitalsAndStations(city) {
  city.hospitals = []; city.stations = [];
  for (const d of BUSAN_DISTRICTS) {
    const blocks = city.buildings.filter((b) => b.district === d.id && b.edges?.length && !b.landmark).sort((a, z) => (a.x + a.w / 2 - d.seed.x * city.w) ** 2 + (a.y + a.h / 2 - d.seed.y * city.h) ** 2 - ((z.x + z.w / 2 - d.seed.x * city.w) ** 2 + (z.y + z.h / 2 - d.seed.y * city.h) ** 2));
    const h = blocks[0], s = blocks.find((b) => b !== h) || blocks[1];
    if (h) { h.hospital = true; const p = doorPoint(h, h.edges[0]); city.hospitals.push({ x: p.x, y: p.y, district: d.id, name: d.name, hangul: d.hangul }); }
    if (s) { s.station = true; const p = doorPoint(s, s.edges[0]); city.stations.push({ x: p.x, y: p.y, district: d.id, name: d.name, hangul: d.hangul }); }
  }
}

function addBridgesAndLandmarks(city) {
  for (const spec of LANDMARK_SPECS) addLandmarkBuilding(city, spec);
  const haeundae = nearestNode(city, 0.86, 0.58), gwangalli = nearestNode(city, 0.7, 0.54);
  const beaches = [
    { id: 'haeundae-beach', name: 'Haeundae Beach', hangul: '해운대해수욕장', label: 'Spiaggia di Haeundae', district: 'gangnam', point: haeundae, color: '#d4bd83' },
    { id: 'gwangalli-beach', name: 'Gwangalli Beach', hangul: '광안리해수욕장', label: 'Spiaggia di Gwangalli', district: 'myeongdong', point: gwangalli, color: '#c7b27d' },
  ];
  for (const beach of beaches) {
    const d = DISTRICT_BY_ID[beach.district];
    const w = 320, h = 108;
    const b = makeBuilding(new Rng(hashSeed(city.seed, beach.id)), d, beach.point.x - w / 2, beach.point.y - h / 2, w, h, { style: 'wall', h3d: 5, color: beach.color, roofColor: '#e7d398', landmark: true, solid: false, name: beach.name, hangul: beach.hangul, label: beach.label, signChance: 0, streetEdges: [] });
    b.kind = 'beach'; city.buildings.push(b);
    city.landmarks.push({ id: beach.id, name: beach.name, hangul: beach.hangul, label: beach.label, kind: 'beach', district: beach.district, region: 'busan', x: beach.point.x, y: beach.point.y, building: b });
  }
  const bridge = city.river.bridges[Math.floor(city.river.bridges.length / 2)];
  if (bridge) {
    const bridgeLandmark = { id: 'gwangan-bridge', name: 'Gwangan Bridge', hangul: '광안대교', label: 'Ponte Gwangan', kind: 'bridge', district: 'myeongdong', region: 'busan', x: bridge.x, y: (city.river.y0 + city.river.y1) / 2 };
    city.landmarks.push(bridgeLandmark);
    const d = DISTRICT_BY_ID.myeongdong;
    const bridgeBuilding = makeBuilding(new Rng(hashSeed(city.seed, 'gwangan-bridge')), d, bridge.x - bridge.w / 2, city.river.y0, bridge.w, city.river.y1 - city.river.y0, { style: 'wall', h3d: 17, color: '#8d7270', roofColor: '#a88c82', landmark: true, name: 'Gwangan Bridge', hangul: '광안대교', label: 'Ponte Gwangan', solid: false, signChance: 0, streetEdges: [] });
    bridgeBuilding.kind = 'bridge'; city.buildings.push(bridgeBuilding); bridgeLandmark.building = bridgeBuilding;
  }
}

function buildSpatialIndexes(city) {
  city.buildingGrid = new SpatialGrid(city.w, city.h, 300);
  city.solidGrid = new SpatialGrid(city.w, city.h, 260);
  for (const b of city.buildings) {
    if (!b.flat && city.elevationAt) b.elev = city.elevationAt(b.x + b.w / 2, b.y + b.h / 2);
    city.buildingGrid.insertRect(b);
    if (b.solid !== false) city.solidGrid.insertRect(b);
  }
  city.propGrid = new SpatialGrid(city.w, city.h, 220);
  for (const p of city.props) {
    const box = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2, prop: p };
    city.propGrid.insertRect(box); if (p.solid) city.solidGrid.insertRect({ ...box, solid: true });
  }
  city.blockGrid = new SpatialGrid(city.w, city.h, 400);
  for (const b of city.blocks) city.blockGrid.insertRect(b);
}

function addIntersections(city) {
  city.intersections = []; city.crosswalks = [];
  for (let i = 0; i < city.vLines.length; i++) for (let j = 0; j < city.hLines.length; j++) {
    const v = city.vLines[i], h = city.hLines[j];
    const up = j > 0 && v.on[j - 1], down = j < city.hLines.length - 1 && v.on[j];
    const left = i > 0 && h.on[i - 1], right = i < city.vLines.length - 1 && h.on[i];
    if (!(up || down) || !(left || right)) continue;
    city.intersections.push({ x: v.c, y: h.c, vw: v.width, hw: h.width, arterial: v.arterial && h.arterial, vi: i, hi: j });
    if (up) city.crosswalks.push({ x: v.c, y: h.c - h.width / 2 - 8, w: v.width, h: 16, horiz: true });
    if (down) city.crosswalks.push({ x: v.c, y: h.c + h.width / 2 + 8, w: v.width, h: 16, horiz: true });
    if (left) city.crosswalks.push({ x: v.c - v.width / 2 - 8, y: h.c, w: 16, h: h.width, horiz: false });
    if (right) city.crosswalks.push({ x: v.c + v.width / 2 + 8, y: h.c, w: 16, h: h.width, horiz: false });
  }
}

function createTopology(city, rng) {
  // Irregular spacing, a broad estuary and four elevated crossings: unlike the
  // orthogonal Seoul grid this is a coastal spine with a river bottleneck.
  const vx = [250, 560, 900, 1260, 1640, 2040, 2470, 2910, 3380, 3860, 4380, 4920, 5480, 6000, 6300];
  const hy = [220, 560, 930, 1320, 1710, 2110, 2470, 2950, 3290, 3650, 4050, 4500, 5000, 5360, 5530];
  city.vLines = vx.map((x, i) => line(x, i % 3 === 0 ? 132 : 78, i % 3 === 0));
  city.hLines = hy.map((y, i) => line(y, i % 4 === 0 ? 132 : 78, i % 4 === 0));
  const bridgesAt = [1260, 2470, 3860, 5480];
  for (const v of city.vLines) {
    const bridgeIndex = bridgesAt.indexOf(v.c);
    if (bridgeIndex < 0) continue;
    v.isBridge = true;
    city.river.bridges.push({ x: v.c, w: v.width, name: bridgeIndex === 2 ? 'Gwangan Bridge' : 'Nakdong crossing' });
  }
  const vSpans = city.vLines.map(lineSpan), hSpans = city.hLines.map(lineSpan);
  for (const v of city.vLines) {
    v.on = new Array(city.hLines.length - 1).fill(true);
    for (let j = 0; j < v.on.length; j++) {
      const mid = (hSpans[j].b + hSpans[j + 1].a) / 2;
      if (city.isWater(v.c, mid)) v.on[j] = !!(v.isBridge && mid > city.river.y0 - 80 && mid < city.river.y1 + 80);
      if (!v.arterial && rng.chance(0.07 + ((j + v.c) % 4) * 0.01)) v.on[j] = false;
    }
  }
  for (const h of city.hLines) {
    h.on = new Array(city.vLines.length - 1).fill(true);
    for (let i = 0; i < h.on.length; i++) {
      const mid = (vSpans[i].b + vSpans[i + 1].a) / 2;
      if (city.isWater(mid, h.c)) h.on[i] = false;
      if (!h.arterial && rng.chance(0.06 + ((i + h.c) % 5) * 0.008)) h.on[i] = false;
    }
  }

  // La costa è curva, quindi il solo centro della cella non basta: un tratto
  // verticale può entrare in acqua fra due incroci asciutti (e viceversa un
  // nodo costiero può restare collegato a un bordo bagnato). Verifichiamo ogni
  // campata lungo il segmento stradale, lasciando passare solo ponti davvero
  // asciutti secondo `isWater`.
  const drySegment = (x0, y0, x1, y1) => {
    const samples = 64;
    for (let k = 0; k <= samples; k++) {
      const t = k / samples;
      if (city.isWater(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  };
  for (const v of city.vLines) {
    for (let j = 0; j < city.hLines.length - 1; j++) {
      if (v.on[j] && !drySegment(v.c, city.hLines[j].c, v.c, city.hLines[j + 1].c)) v.on[j] = false;
    }
  }
  for (const h of city.hLines) {
    for (let i = 0; i < city.vLines.length - 1; i++) {
      if (h.on[i] && !drySegment(city.vLines[i].c, h.c, city.vLines[i + 1].c, h.c)) h.on[i] = false;
    }
  }
  buildSegments(city.vLines, city.hLines, city.margin * 0.5, city.h - city.margin * 0.5);
  buildSegments(city.hLines, city.vLines, city.margin * 0.5, city.w - city.margin * 0.5);
  city.topology = { id: 'busan-coastal-spine', layout: 'estuary-bay-hills', verticalLines: city.vLines.length, horizontalLines: city.hLines.length, bridges: city.river.bridges.length, irregularSpacing: true };
}

/** Crea la mappa autonoma di Busan (부산), con topologia e seed propri. */
export function createBusanCity(seed = BUSAN_SEED) {
  const rng = new Rng(seed);
  const { w: W, h: H, margin: M } = BUSAN_WORLD;
  const districts = BUSAN_DISTRICTS.map(cloneDistrict);
  const byId = Object.fromEntries(districts.map((d) => [d.id, d]));
  const city = {
    w: W, h: H, margin: M, seed, region: { id: 'busan', name: 'Busan', hangul: '부산' }, name: 'Busan', nameIt: 'Busan', hangul: '부산',
    districts, districtById: byId, vLines: [], hLines: [], river: { id: 'nakdong-river', name: 'Nakdong River', hangul: '낙동강', y0: 2580, y1: 2920, bridges: [] },
    blocks: [], buildings: [], props: [], landmarks: [], crosswalks: [], intersections: [], runways: [], taxiways: [], aprons: [], helipads: [], piers: [], airSpots: [], boatSpots: [], stairs: [],
  };
  const coastAt = (y) => {
    const t = clamp01((y - H * 0.46) / (H * 0.54));
    const bulge = 180 * Math.sin(y / 620 + (seed & 31));
    return Math.max(320, Math.min(3660, 700 + 2300 * t * t + bulge));
  };
  city.coastAt = coastAt; city.waterX = coastAt(H * 0.1); city.quayX = city.waterX + 470;
  city.river.start = 1080; city.river.end = 5400; city.river.region = 'busan'; city.river.label = 'Fiume Nakdong';
  city.piers = [
    { x: 560, y: 3460, w: 760, h: 112, name: 'Jagalchi pier' },
    { x: 770, y: 3850, w: 620, h: 98, name: 'Busan fish quay' },
    { x: 1080, y: 4300, w: 540, h: 92, name: 'Nampo pier' },
  ];
  city.isWater = (x, y) => {
    let water = x < city.coastAt(y);
    if (y > city.river.y0 && y < city.river.y1 && x > city.river.start && x < city.river.end) water = true;
    for (const b of city.river.bridges) if (water && Math.abs(x - b.x) < b.w / 2 + 4 && y > city.river.y0 - 8 && y < city.river.y1 + 8) water = false;
    for (const p of city.piers) if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) water = false;
    return water;
  };
  const hills = [
    { x: 0.54 * W, y: 0.14 * H, r: 760, h: 220, name: 'Geumjeongsan' },
    { x: 0.62 * W, y: 0.36 * H, r: 610, h: 155, name: 'Hwangnyeongsan' },
    { x: 0.9 * W, y: 0.42 * H, r: 720, h: 190, name: 'Jangsan' },
    { x: 0.42 * W, y: 0.74 * H, r: 540, h: 105, name: 'Bongnaesan' },
  ];
  city.hills = hills;
  city.elevationAt = (x, y) => {
    if (city.isWater(x, y)) return 0;
    const edge = Math.min(Math.abs(x - city.coastAt(y)), Math.abs(y - city.river.y0), Math.abs(y - city.river.y1));
    let e = 18 + 30 * clamp01(edge / 1100) + (valueNoise(x / 520, y / 520, seed) - 0.5) * 34;
    for (const hill of hills) { const d = Math.hypot(x - hill.x, y - hill.y) / hill.r; if (d < 1) e += hill.h * (1 - d) * (1 - d); }
    return Math.max(0, e);
  };
  city.urbanAt = (x, y) => {
    if (city.isWater(x, y)) return 0;
    let u = 0;
    for (const d of districts) { const q = Math.hypot(x / W - d.seed.x, y / H - d.seed.y) / 0.27; if (q < 1) u = Math.max(u, clamp01(1 - q)); }
    return clamp01(u + 0.22 + (valueNoise(x / 950, y / 950, seed ^ 9) - 0.5) * 0.12);
  };
  city.districtAt = (x, y) => {
    let best = districts[0], bd = Infinity;
    for (const d of districts) { const dx = x / W - d.seed.x, dy = y / H - d.seed.y; const dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = d; } }
    return best;
  };
  // Coastal spine first: its on/off segments are what make the graph and blocks.
  createTopology(city, rng);
  const onSegment = (l, p) => l.segments.some((s) => p >= s[0] && p <= s[1]);
  city.isOnRoad = (x, y) => {
    for (const l of city.vLines) if (Math.abs(x - l.c) < l.width / 2 && onSegment(l, y)) return true;
    for (const l of city.hLines) if (Math.abs(y - l.c) < l.width / 2 && onSegment(l, x)) return true;
    return false;
  };
  city.graph = buildRoadGraph(city);
  addIntersections(city);

  const vSpans = city.vLines.map(lineSpan), hSpans = city.hLines.map(lineSpan);
  for (let j = 0; j < city.hLines.length - 1; j++) for (let i = 0; i < city.vLines.length - 1; i++) {
    const x = vSpans[i].b, y = hSpans[j].b, w = vSpans[i + 1].a - x, h = hSpans[j + 1].a - y;
    if (w < 42 || h < 42 || city.isWater(x + w / 2, y + h / 2)) continue;
    const block = { x, y, w, h, district: city.districtAt(x + w / 2, y + h / 2).id, type: 'urban', onArterial: city.vLines[i].arterial || city.vLines[i + 1].arterial || city.hLines[j].arterial || city.hLines[j + 1].arterial, yards: [], alleys: [] };
    const d = byId[block.district];
    const u = city.urbanAt(x + w / 2, y + h / 2), hill = city.elevationAt(x + w / 2, y + h / 2);
    const nearBay = x < city.quayX + 720 || y > H * 0.78;
    if (nearBay && (d.id === 'docks' || rng.chance(0.28))) block.type = 'dock';
    else if (hill > 120 || rng.chance(0.06)) block.type = 'park';
    else if (u < 0.4 || rng.chance(0.08)) block.type = 'rural';
    city.blocks.push(block);
    if (block.type === 'dock') fillDock(city, rng, block, d);
    else if (block.type === 'park') fillPark(city, rng, block, d);
    else if (block.type === 'rural') fillRural(city, rng, block, d);
    else fillUrban(city, rng, block, d);
  }
  // Bay infrastructure and boats are real navigable geometry, not decoration.
  for (const p of city.piers) {
    for (let k = 70; k < p.w - 20; k += 100) addProp(city, 'bollard', p.x + k, p.y + 8, { r: 7, z: 16 });
    const northY = p.y - 42, southY = p.y + p.h + 42;
    city.boatSpots.push({ x: Math.max(80, city.coastAt(northY) - 80), y: northY, angle: Math.PI, kind: 'boat' });
    city.boatSpots.push({ x: Math.max(80, city.coastAt(southY) - 80), y: southY, angle: Math.PI, kind: 'ferry' });
  }
  city.boatSpots.push({ x: 2140, y: 2760, angle: 0, kind: 'boat' });
  city.helipads.push({ x: 0.78 * W, y: 0.72 * H, r: 45 });
  city.airSpots.push({ x: 0.78 * W, y: 0.72 * H, angle: -Math.PI / 2, kind: 'heli' });

  addHospitalsAndStations(city);
  addTransit(city);
  addBridgesAndLandmarks(city);
  placeShops(city);
  placeGarages(city);
  placeTurfs(city);
  city.spawn = (() => { const n = nearestNode(city, 0.49, 0.47); const p = safeNear(city, n); return { x: p.x, y: p.y, angle: 0 }; })();
  city.coastLine = { c: city.quayX, width: 132, arterial: true, keep: true };
  city.coastIdx = 0;
  city.riverCell = -1;
  city.doglegs = 0;
  city.airport = null;
  city.port = { x: city.quayX - 120, y: H * 0.62, w: 1040, h: 720, district: 'docks', name: 'Busan Port' };
  city.getDistrict = (id) => byId[id] || null;
  city.districtAtNorm = (nx, ny) => city.districtAt(nx * W, ny * H);
  city.regionalLandmarks = city.landmarks;
  city.regionLandmarks = city.landmarks;
  adaptWater(city);
  buildSpatialIndexes(city);

  city.stats = {
    buildings: city.buildings.length, props: city.props.length, blocks: city.blocks.length, nodes: city.graph.usableNodes.length, edges: city.graph.edges.length,
    doglegs: 0, stairs: 0, shops: city.shops.length, venues: city.shops.reduce((n, s) => n + s.biz.length, 0), garages: city.garages.length, rural: city.blocks.filter((b) => b.type === 'rural').length,
    piers: city.piers.length, turfs: city.turfs.length, landmarks: city.landmarks.length, transitStations: city.transitStations.length,
  };
  return city;
}
