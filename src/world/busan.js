// Busan (부산): una città stretta fra i monti e il mare. Rifatta nel §5.41.
//
// Prima era una scacchiera con la costa a ovest e un fiume dritto. Adesso la
// terra è un cuneo che punta a sud-est — larga a nord dove entra la Gyeongbu,
// sempre più stretta fino al capo di Taejongdae — con dentro:
//  - la **costa** frastagliata: la foce del Nakdong a ovest, il porto con l'isola
//    di Yeongdo a sud-ovest, la baia di Suyeong (con il ponte Gwangan) e la lunga
//    spiaggia di Haeundae a est;
//  - i **monti** (Geumjeongsan, Hwangnyeongsan, Jangsan, Baekyangsan) che
//    spezzano la scacchiera: le strade seguono i fondovalle, e i quartieri sui
//    pendii stanno su gradoni;
//  - i **luoghi** dell'Atto III: l'ingresso con il posto di blocco, il piazzale
//    di Seomyeon, il mercato di Jagalchi, i moli di Nampo, l'officina di Sasang,
//    il terminal dei traghetti, il porto dei container, la baia sotto il ponte.
import { Rng } from '../core/rng.js';
import { createMask, blobPoly, roughen, valueNoise, smooth, densify, contour } from './coastmask.js';
import { pathLegs, staircase, buildNetwork, makeRoadHit, farmRoads, clipLegs, horizontalAt } from './netgen.js';
import * as kit from './regionkit.js';

export const BUSAN_SEED = 20260807;
export const BUSAN_WORLD = { w: 6400, h: 5600, margin: 170 };

export const REGION = 'busan';
// Dove il mare del mondo (`korea.js`) incontra i bordi ovest ed est di Busan.
export const SEAM = { westY: 1000, eastY: 2140 };


// ---------------------------------------------------------------------------
// GEOGRAFIA
// ---------------------------------------------------------------------------

/** Poligono a mano: i punti sono (x, y) locali, in senso orario. */
const P = (...v) => { const out = []; for (let i = 0; i < v.length; i += 2) out.push([v[i], v[i + 1]]); return out; };

// Le coordinate del cuneo e delle baie sono scritte a mano: sono la parte della
// mappa su cui si è più liberi di cambiare idea, e la sola che si guarda dall'alto.
const LAND = P(
  -400, -400, 6900, -400, 6900, 2000, 6500, 2130, 6180, 2350, 5880, 2610, 5600, 2860, 5420, 3110,
  5360, 3380, 5440, 3640, 5330, 3900, 5120, 4180, 4780, 4470, 4400, 4760, 4020, 5000, 3680, 5170,
  3420, 5200, 3230, 5080, 3050, 4900, 2780, 4640, 2480, 4380, 2220, 4120, 2020, 3820, 1830, 3500,
  1560, 3240, 1250, 2960, 900, 2620, 560, 2250, 300, 1850, 130, 1450, -60, 1000, -400, 600,
);
// Baie e foci: poligoni d'acqua sottratti alla terra.
const SUYEONG_BAY = P(4160, 3260, 4420, 3140, 4700, 3190, 4820, 3450, 4850, 3900, 4900, 4300, 5000, 5000, 3980, 5000, 4000, 4300, 4050, 3750, 4100, 3480);
const HARBOR_MOUTH = P(2150, 4180, 2460, 4120, 2760, 4330, 3050, 4650, 3260, 5000, 2700, 5100, 2480, 4700, 2260, 4450);
const NAKDONG_MOUTH = P(-200, 1500, 350, 1480, 800, 1380, 1350, 1520, 1500, 1700, 1250, 1900, 700, 2000, -200, 2100);
const YEONGDO = P(2240, 4520, 2560, 4480, 2900, 4800, 3150, 5120, 3000, 5330, 2650, 5280, 2330, 4980);

export function makeBusanCoast(seed) {
  const { w, h } = BUSAN_WORLD;
  const mask = createMask(w, h, 8);
  mask.paint(roughen(LAND, seed ^ 0x71, { depth: 3, amp: 0.13 }), 1);
  mask.paint(roughen(SUYEONG_BAY, seed ^ 0x72, { depth: 3, amp: 0.1 }), 0);
  mask.paint(roughen(HARBOR_MOUTH, seed ^ 0x73, { depth: 3, amp: 0.1 }), 0);
  mask.paint(roughen(NAKDONG_MOUTH, seed ^ 0x74, { depth: 3, amp: 0.14 }), 0);
  mask.paint(roughen(YEONGDO, seed ^ 0x75, { depth: 3, amp: 0.1 }), 1);
  // Isolotti sparsi davanti a Haeundae e al capo: le Oryukdo.
  [[4780, 4880, 70, 50], [5200, 4650, 50, 40], [6050, 3000, 90, 60]].forEach(([x, y, rx, ry], i) => mask.paint(roughen(blobPoly(x, y, rx, ry, seed ^ (0x80 + i), { n: 24, rough: 0.15 }), seed ^ (0x90 + i), { depth: 2, amp: 0.2 }), 1));
  // Le **cuciture** con il resto della Corea. Fuori dal rettangolo la geografia di
  // `korea.js` ha il suo mare: sul bordo ovest, est e sud la costa di Busan deve
  // arrivare dove arriva quella, o la maschera si interrompe su una riga dritta.
  // Il mare d'ovest comincia a `SEAM.westY`, quello d'est a `SEAM.eastY`, a sud è
  // tutto mare; a nord è terra (il corridoio dell'autostrada).
  mask.rect(0, 0, 80, SEAM.westY, 1).rect(0, SEAM.westY, 80, h - SEAM.westY, 0);
  mask.rect(w - 80, 0, 80, SEAM.eastY, 1).rect(w - 80, SEAM.eastY, 80, h - SEAM.eastY, 0);
  mask.rect(0, h - 90, w, 90, 0);
  mask.rect(0, 0, w, 60, 1);
  return mask;
}

// I monti: cupole ellittiche (x, y, raggio, quota). Lasciano passare i fondovalle.
export const HILLS = [
  { x: 2500, y: 150, rx: 1250, ry: 620, h: 235, name: 'Geumjeongsan', hangul: '금정산' },
  { x: 4750, y: 1350, rx: 760, ry: 620, h: 175, name: 'Hwangnyeongsan', hangul: '황령산' },
  { x: 5900, y: 1450, rx: 620, ry: 560, h: 195, name: 'Jangsan', hangul: '장산' },
  { x: 2050, y: 2350, rx: 520, ry: 560, h: 135, name: 'Baekyangsan', hangul: '백양산' },
  { x: 2750, y: 4900, rx: 380, ry: 300, h: 125, name: 'Bongnaesan', hangul: '봉래산' },
  { x: 5330, y: 3130, rx: 280, ry: 230, h: 95, name: 'Dalmaji', hangul: '달맞이' },
  { x: 2250, y: 3300, rx: 270, ry: 270, h: 95, name: 'Gudeoksan', hangul: '구덕산' },
  { x: 2500, y: 3790, rx: 190, ry: 170, h: 70, name: 'Yongdusan', hangul: '용두산' },
];

// Gli id restano quelli che gli altri sistemi conoscono. Tutto il resto è locale:
// nomi, semi, colori, **mix di negozi** e parole delle insegne descrivono Busan e
// non scrivono mai nei distretti condivisi di Seoul.
const DISTRICTS = [
  {
    id: 'hongdae', name: 'Seomyeon', hangul: '서면', subtitle: 'Nightlife, neon e il crocevia del metro',
    seed: { x: 0.55, y: 0.36 }, block: { minLot: 58, maxLot: 116, gapChance: 0.12 }, grid: { step: [128, 222], superblock: 0.12, jog: 0.32 },
    heights: [70, 230], styles: ['brick', 'concrete', 'panel', 'glass'], facade: ['#6e5a8c', '#8f4f70', '#4f7f9c', '#9a7b50', '#5a6a9a'], roof: '#3c3846',
    accent: '#ff4fa8', accent2: '#4fe0ff', ground: '#2c2d36', sidewalk: '#565a66', signDensity: 0.95, treeDensity: 0.12,
    signWords: ['서면', '돼지국밥', '노래방', '술집', '밀면', 'PC방', '호프', '치킨', '편의점'],
    mix: {
      ground: ['gukbap', 'gukbap', 'bar', 'bar', 'bunsik', 'conv', 'conv', 'clothes', 'pharma', 'pawn'],
      upper: ['noraebang', 'noraebang', 'pcbang', 'pcbang', 'billiards', 'bar', 'home', 'office'],
    },
    trafficDensity: 1.15, pedDensity: 1.8, pedMix: ['student', 'student', 'office', 'tourist', 'gangster', 'civil'], vehicleMix: ['hatch', 'sedan', 'taxi', 'scooter', 'van', 'bus'],
  },
  {
    id: 'myeongdong', name: 'Gwangalli', hangul: '광안리', subtitle: 'Spiaggia, caffè e il ponte illuminato',
    seed: { x: 0.575, y: 0.66 }, block: { minLot: 72, maxLot: 150, gapChance: 0.1 }, grid: { step: [150, 248], superblock: 0.16, jog: 0.24 },
    heights: [48, 170], styles: ['panel', 'concrete', 'glass'], facade: ['#e4d0b8', '#b6d4e4', '#e4b6c2', '#c6e4b6', '#d8c8e8'], roof: '#46424a',
    accent: '#ffcb48', accent2: '#ff5d72', ground: '#2d2c33', sidewalk: '#5d5a60', signDensity: 0.95, treeDensity: 0.1,
    signWords: ['광안리', '회', '카페', '호프', '횟집', '펜션', '맥주', '편의점'],
    mix: {
      ground: ['hoe', 'hoe', 'cafe', 'cafe', 'bar', 'bar', 'conv', 'clothes', 'bunsik'],
      upper: ['bar', 'noraebang', 'home', 'home', 'cafe', 'pcbang'],
    },
    trafficDensity: 1.1, pedDensity: 1.85, pedMix: ['tourist', 'tourist', 'office', 'civil', 'student'], vehicleMix: ['sedan', 'taxi', 'suv', 'sport', 'bus', 'scooter'],
  },
  {
    id: 'itaewon', name: 'Nampo-dong', hangul: '남포동', subtitle: 'Busan Tower, il porto vecchio e i mercati',
    seed: { x: 0.37, y: 0.705 }, block: { minLot: 62, maxLot: 136, gapChance: 0.16 }, grid: { step: [134, 236], superblock: 0.2, jog: 0.4 },
    heights: [34, 120], styles: ['brick', 'concrete', 'brick', 'panel'], facade: ['#8b684e', '#7d5e50', '#94735a', '#6b6258', '#a07a5a'], roof: '#473a31',
    accent: '#ff922d', accent2: '#49e0a9', ground: '#2e2a27', sidewalk: '#554d46', signDensity: 0.88, treeDensity: 0.15,
    signWords: ['남포동', '씨앗호떡', '국제시장', '회', '어묵', '국밥', '시장', '약국'],
    mix: {
      ground: ['hoe', 'bunsik', 'bunsik', 'gukbap', 'pawn', 'pawn', 'clothes', 'clothes', 'bar', 'conv'],
      upper: ['home', 'home', 'bar', 'billiards', 'noraebang', 'office'],
    },
    trafficDensity: 0.9, pedDensity: 1.6, pedMix: ['tourist', 'civil', 'civil', 'gangster', 'student', 'worker'], vehicleMix: ['sedan', 'suv', 'hatch', 'taxi', 'van', 'scooter'],
  },
  {
    id: 'gangnam', name: 'Haeundae', hangul: '해운대', subtitle: 'Spiaggia, hotel e le torri di Centum City',
    seed: { x: 0.78, y: 0.47 }, block: { minLot: 118, maxLot: 254, gapChance: 0.06 }, grid: { step: [264, 420], superblock: 0.28, jog: 0.08 },
    heights: [92, 360], styles: ['glass', 'glass', 'panel', 'concrete'], facade: ['#3f6c8c', '#3a5f82', '#5a8aa8', '#4a8a9a', '#2f5878'], roof: '#2a3e4e',
    accent: '#48ddff', accent2: '#b78cff', ground: '#252a31', sidewalk: '#4e5964', signDensity: 0.58, treeDensity: 0.2,
    signWords: ['해운대', '센텀', '호텔', '리조트', '카페', '백화점', '레지던스'],
    mix: {
      ground: ['cafe', 'cafe', 'hoe', 'conv', 'pharma', 'clothes', 'bar', 'pawn'],
      upper: ['office', 'office', 'office', 'home', 'noraebang', 'cafe', 'pcbang'],
    },
    trafficDensity: 1.3, pedDensity: 1.2, pedMix: ['office', 'office', 'civil', 'tourist', 'tourist'], vehicleMix: ['sedan', 'sedan', 'suv', 'sport', 'taxi', 'bus'],
  },
  {
    id: 'docks', name: 'Jagalchi', hangul: '자갈치', subtitle: 'Il mercato del pesce, i moli e il contrabbando',
    seed: { x: 0.27, y: 0.58 }, block: { minLot: 190, maxLot: 350, gapChance: 0.3 }, grid: { step: [320, 540], superblock: 0.44, jog: 0.1 },
    heights: [24, 72], styles: ['warehouse', 'warehouse', 'panel'], facade: ['#59676a', '#4f5e61', '#6b7066', '#555b58', '#5f7d86'], roof: '#394443',
    accent: '#ffd34c', accent2: '#49d7a0', ground: '#24282b', sidewalk: '#494f50', signDensity: 0.3, treeDensity: 0.035,
    signWords: ['자갈치', '수산', '냉동', '물류', '컨테이너', '세관', '어시장', '활어'],
    mix: { ground: ['hoe', 'hoe', 'pawn', 'guns', 'bar', 'gukbap', 'conv'], upper: ['home', 'office', 'billiards', 'bar'] },
    trafficDensity: 0.62, pedDensity: 0.55, pedMix: ['worker', 'worker', 'gangster', 'civil'], vehicleMix: ['truck', 'truck', 'van', 'suv', 'sedan'],
  },
  {
    id: 'gimpo', name: 'Sasang', hangul: '사상', subtitle: 'Il Nakdong, le officine e lo scalo ferroviario',
    seed: { x: 0.34, y: 0.2 }, block: { minLot: 90, maxLot: 190, gapChance: 0.2 }, grid: { step: [310, 520], superblock: 0.38, jog: 0.08 },
    heights: [22, 62], styles: ['warehouse', 'panel', 'warehouse', 'concrete'], facade: ['#65727a', '#586872', '#727a7d', '#7a6a58', '#8a5a48'], roof: '#424d55',
    accent: '#59c9ff', accent2: '#ffe879', ground: '#2b322f', sidewalk: '#505856', signDensity: 0.22, treeDensity: 0.2,
    signWords: ['사상', '철마', '공업사', '정비', '카센터', '철강', '타이어'],
    mix: { ground: ['pawn', 'guns', 'gukbap', 'bar', 'conv', 'bunsik'], upper: ['office', 'home', 'billiards'] },
    trafficDensity: 0.68, pedDensity: 0.6, pedMix: ['worker', 'worker', 'civil', 'office', 'gangster'], vehicleMix: ['van', 'truck', 'sedan', 'bus', 'suv'],
  },
  {
    id: 'gyeonggi', name: 'Dongnae', hangul: '동래', subtitle: 'Colline, terme e case basse',
    seed: { x: 0.56, y: 0.14 }, block: { minLot: 80, maxLot: 170, gapChance: 0.2 }, grid: { step: [300, 560], superblock: 0.46, jog: 0.12 },
    heights: [22, 80], styles: ['panel', 'brick', 'concrete', 'stone'], facade: ['#7f745d', '#6d6c57', '#857963', '#596a55', '#8a7a68'], roof: '#494638',
    accent: '#a6df52', accent2: '#ffbd4c', ground: '#333722', sidewalk: '#504f43', signDensity: 0.2, treeDensity: 0.45,
    signWords: ['동래', '온천', '파전', '민박', '약국', '한의원'],
    mix: { ground: ['gukbap', 'bunsik', 'pharma', 'pawn', 'conv', 'bar'], upper: ['home', 'home', 'billiards', 'office'] },
    trafficDensity: 0.5, pedDensity: 0.45, pedMix: ['worker', 'civil', 'civil', 'gangster'], vehicleMix: ['tractor', 'truck', 'van', 'hatch', 'sedan'],
  },
];

const GANGS = [
  { id: 'baekho', name: 'Tigre Bianca', hangul: '백호파', color: '#e8e2d0', trade: 'armi' },
  { id: 'heuksa', name: 'Serpe Nera', hangul: '흑사파', color: '#7d5ce0', trade: 'contrabbando' },
  { id: 'cheolma', name: 'Cavallo di Ferro', hangul: '철마파', color: '#ff7a29', trade: 'auto rubate' },
  { id: 'hwangso', name: 'Bue Giallo', hangul: '황소파', color: '#ffd23f', trade: 'usura' },
];

const LANDMARKS = [
  { id: 'busan-tower', name: 'Busan Tower', hangul: '부산타워', label: 'Torre di Busan', kind: 'tower', district: 'itaewon', target: [0.385, 0.675], style: 'tower', w: 82, h: 82, h3d: 490, color: '#8e929b', roofColor: '#c9ccd5', types: ['urban', 'park'] },
  { id: 'centum-city', name: 'Centum City', hangul: '센텀시티', label: 'Centum City', kind: 'district', district: 'gangnam', target: [0.77, 0.47], style: 'glass', w: 150, h: 150, h3d: 372, color: '#4e7996', roofColor: '#2d4659', types: ['urban'] },
];

const TRANSIT = [
  { id: 'busan-nampo', name: 'Nampo Station', label: 'Stazione Nampo', hangul: '남포역', target: [0.37, 0.69], lines: ['1'] },
  { id: 'busan-jagalchi', name: 'Jagalchi Station', label: 'Stazione Jagalchi', hangul: '자갈치역', target: [0.325, 0.655], lines: ['1'] },
  { id: 'busan-seomyeon', name: 'Seomyeon Station', label: 'Stazione Seomyeon', hangul: '서면역', target: [0.55, 0.36], lines: ['1', '2'] },
  { id: 'busan-gwangalli', name: 'Gwangalli Station', label: 'Stazione Gwangalli', hangul: '광안역', target: [0.575, 0.66], lines: ['2'] },
  { id: 'busan-haeundae', name: 'Haeundae Station', label: 'Stazione Haeundae', hangul: '해운대역', target: [0.82, 0.5], lines: ['2'] },
  { id: 'busan-centum', name: 'Centum City Station', label: 'Stazione Centum City', hangul: '센텀시티역', target: [0.76, 0.46], lines: ['2', 'Donghae'] },
  { id: 'busan-sasang', name: 'Sasang Station', label: 'Stazione Sasang', hangul: '사상역', target: [0.34, 0.2], lines: ['2', 'Gimhae'] },
];

/** Spiagge e rive: sabbia a Haeundae e a Gwangalli, cemento e roccia scura altrove. */
export function shoreKind(x, y) {
  if (x > 5150 && y > 2250 && y < 3700) return 'sand';
  if (x > 3850 && x < 4450 && y > 3150 && y < 4150) return 'sand';
  return 'basalt';
}

// Gradoni: sui pendii dei quartieri alti la quota non sale liscia ma per terrazze
// (i villaggi sul colle di Gamcheon, le case di Dongnae). Il peso dice quanto
// ogni punto è «a gradoni»; la quota mescola quella liscia con quella a scalini.
const TERRACES = [
  { x: 2080, y: 3430, r: 560 },
  { x: 3250, y: 900, r: 520 },
  { x: 5330, y: 3140, r: 340 },
  { x: 2780, y: 4880, r: 360 },
];

function makeElevation(city, mask, seed) {
  const STEP = 22;
  return (x, y) => {
    if (!mask.land(x, y)) return 0;
    const s = mask.shoreDist(x, y);
    let e = (10 + 26 * smooth(s / 1300)) * smooth(s / 150);
    for (const h of HILLS) {
      const d = Math.hypot((x - h.x) / h.rx, (y - h.y) / h.ry);
      if (d < 1) e += h.h * Math.pow(1 - d, 1.5);
    }
    e += (valueNoise(x / 460, y / 460, seed ^ 0x2a7) - 0.5) * 12 * smooth(s / 300);
    let w = 0;
    for (const t of TERRACES) w = Math.max(w, 1 - Math.hypot(x - t.x, y - t.y) / t.r);
    if (w > 0 && e > 26) {
      const t = e / STEP;
      const f = Math.floor(t);
      const stepped = (f + smooth((t - f - 0.68) / 0.32)) * STEP;
      e += (stepped - e) * smooth(w * 1.6);
    }
    return Math.max(0, e);
  };
}

// ---------------------------------------------------------------------------
// TRACCIATI
// ---------------------------------------------------------------------------

/** Griglia chiusa di una zona urbana: il perimetro è strada, quindi niente vicoli ciechi. */
function townGrid(rng, { x0, y0, x1, y1, sx, sy, artX = [], artY = [] }) {
  const lines = (from, to, step) => {
    const out = [from];
    for (let v = from + step; v < to - step * 0.55; v += step + Math.round(rng.range(-12, 12))) out.push(Math.round(v / 20) * 20);
    out.push(to);
    return out;
  };
  const xs = lines(x0, x1, sx);
  const ys = lines(y0, y1, sy);
  const legs = [];
  xs.forEach((x, i) => legs.push({ axis: 'v', c: x, a: y0, b: y1, arterial: artX.includes(i) }));
  ys.forEach((y, j) => legs.push({ axis: 'h', c: y, a: x0, b: x1, arterial: artY.includes(j) }));
  return { legs, xs, ys };
}

// Le griglie dei quartieri, con le coordinate scritte a mano: le strade principali
// si attaccano a queste linee, quindi devono stare esattamente dove le si cerca.
// Le griglie dei quartieri, con le coordinate scritte a mano: le strade principali
// si attaccano a queste linee, quindi devono stare esattamente dove le si cerca.
const GRIDS = [
  // Le celle sono grandi (350-500 px): un centro denso è fatto di palazzi pieni e di
  // pochi incroci, non di un incrocio ogni 80 px.
  { id: 'seomyeon', xs: [2880, 3300, 3680, 4120], ys: [1640, 2120, 2560], artX: [3300], artY: [2120] },
  { id: 'dongnae', xs: [3200, 3700, 4200], ys: [440, 830, 1220], artX: [3700], artY: [] },
  { id: 'oncheon', xs: [4200, 4640, 5080, 5520], ys: [300, 660, 1020], artX: [], artY: [] },
  { id: 'sasang', xs: [1700, 2190, 2680], ys: [720, 1110, 1500], artX: [], artY: [1110] },
  { id: 'jungang', xs: [2660, 3300], ys: [2780, 3200, 3640], artX: [3300], artY: [] },
  { id: 'suyeong', xs: [3300, 3640, 3960], ys: [2780, 3200, 3620, 4120], artX: [], artY: [4120] },
  { id: 'yeonje', xs: [4120, 4390, 4660], ys: [2120, 2640], artX: [4660], artY: [2120] },
  { id: 'centum', xs: [4660, 4990, 5320], ys: [2320, 2640, 2980], artX: [], artY: [2640] },
  { id: 'marine', xs: [4980, 5160], ys: [3400, 3760, 4120], artX: [], artY: [] },
  { id: 'gaya', xs: [2330, 2880], ys: [1880, 2220, 2560], artX: [], artY: [] },
  { id: 'gimhae', xs: [1000, 1350, 1700], ys: [500, 880, 1240], artX: [], artY: [] },
  { id: 'daeyeon', xs: [3300, 3600, 3880], ys: [4120, 4480, 4840], artX: [], artY: [] },
  { id: 'nampo', xs: [2340, 2660, 2980], ys: [3640, 3880, 4120], artX: [], artY: [3640, 4120] },
];

function gridLegs(g) {
  const legs = [];
  const y0 = g.ys[0];
  const y1 = g.ys[g.ys.length - 1];
  const x0 = g.xs[0];
  const x1 = g.xs[g.xs.length - 1];
  for (const x of g.xs) legs.push({ axis: 'v', c: x, a: y0, b: y1, arterial: g.artX.includes(x) });
  for (const y of g.ys) legs.push({ axis: 'h', c: y, a: x0, b: x1, arterial: g.artY.includes(y) });
  return legs;
}

// ---------------------------------------------------------------------------
// GENERAZIONE
// ---------------------------------------------------------------------------

const inRect = (x, y, r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

/** Rettangoli d'impalcato dove una strada attraversa l'acqua: sono terra per auto e pedoni. */
function bridgeDecks(city, mask) {
  const out = [];
  out.pylons = [];
  for (const l of [...city.vLines, ...city.hLines]) {
    const leg = l.leg;
    const vert = leg.axis === 'v';
    const push = (a, b) => {
      a -= 28; b += 28;
      out.push(vert ? { x: leg.c - l.width / 2 - 18, y: a, w: l.width + 36, h: b - a } : { x: a, y: leg.c - l.width / 2 - 18, w: b - a, h: l.width + 36 });
    };
    // Piloni: quadrati di cemento ai due bordi dell'impalcato ogni 260 px di campata.
    // Sono terra solo per chi naviga: le barche passano **fra** un pilone e l'altro.
    const pyl = (a, b) => {
      const n = Math.max(1, Math.round((b - a) / 260));
      for (let k = 0; k <= n; k++) {
        const t = a + ((b - a) * k) / n;
        for (const side of [-1, 1]) {
          const o = side * (l.width / 2 + 10);
          out.pylons.push(vert ? { x: leg.c + o - 14, y: t - 14, w: 28, h: 28 } : { x: t - 14, y: leg.c + o - 14, w: 28, h: 28 });
        }
      }
    };
    let run = null;
    for (let t = leg.a - 40; t <= leg.b + 40; t += 8) {
      const wet = !mask.land(vert ? leg.c : t, vert ? t : leg.c);
      if (wet && run === null) run = t;
      if (!wet && run !== null) { push(run, t); if (t - run > 120) pyl(run, t); run = null; }
    }
    if (run !== null) push(run, leg.b + 40);
  }
  return out;
}

/** Crea la mappa autonoma di Busan (부산), con topologia e seed propri. */
export function createBusanCity(seed = BUSAN_SEED) {
  const rng = new Rng(seed);
  const { w: W, h: H, margin: M } = BUSAN_WORLD;
  const districts = DISTRICTS.map((d) => kit.cloneDistrict(d, REGION));
  // Lotti più stretti e meno vuoti di quelli di Seoul: sulla costa si costruisce fitto.
  const LOT = { hongdae: 0.6, myeongdong: 0.62, itaewon: 0.6, gangnam: 0.8, docks: 0.9, gimpo: 0.85, gyeonggi: 0.85 };
  for (const d of districts) { d.lotScale = (LOT[d.id] ?? 0.85) * 0.78; d.gapScale = 0.5; }
  const byId = Object.fromEntries(districts.map((d) => [d.id, d]));
  const city = {
    w: W, h: H, margin: M, seed, region: { id: 'busan', name: 'Busan', hangul: '부산' }, name: 'Busan', nameIt: 'Busan', hangul: '부산',
    districts, districtById: byId, getDistrict: (id) => byId[id] || null,
    vLines: [], hLines: [], river: { id: 'nakdong-river', name: 'Nakdong River', hangul: '낙동강', label: 'Fiume Nakdong', y0: 0, y1: 0, bridges: [], region: REGION },
    blocks: [], buildings: [], props: [], landmarks: [], crosswalks: [], intersections: [], runways: [], taxiways: [], aprons: [], helipads: [], piers: [], airSpots: [], boatSpots: [], stairs: [], bridges: [],
  };
  const mask = makeBusanCoast(seed);
  city.mask = mask;
  city.hills = HILLS;

  // --- acqua, quota, distretti ---------------------------------------------
  // Moli e ponti sono terra calpestabile (e percorribile in auto) sull'acqua.
  city.isWater = (x, y) => {
    for (const p of city.piers) if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return false;
    for (const b of city.bridges) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
    return !mask.land(x, y);
  };
  const onDeck = (x, y) => city.bridges.some((b) => x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6);
  city.shoreDist = (x, y) => (onDeck(x, y) ? undefined : mask.shoreDist(x, y));
  city.shoreKind = shoreKind;
  city.elevationAt = makeElevation(city, mask, seed);
  const seeds = districts.map((d) => ({ d, x: d.seed.x * W, y: d.seed.y * H, k: d.id === 'gyeonggi' ? 0.6 : 1 }));
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
    for (const z of city.urbanZones) if (inRect(x, y, z)) return 0.85;
    return 0.14;
  };

  // --- strade --------------------------------------------------------------
  const legs = [];
  const arterial = (pts) => legs.push(...pathLegs(pts, true));
  const street = (pts) => legs.push(...pathLegs(pts, false));
  // I tracciati liberi seguono una curva: la valle, la riva. `via` sono punti di
  // passaggio; l'ultimo è l'attacco a una linea di griglia, e ci si arriva esatti.
  const route = (via, opts = {}) => staircase(densify(via, 40), { thr: 250, snap: 20, exactEnd: true, ...opts });
  for (const g of GRIDS) legs.push(...gridLegs(g));

  // L'asse nord-sud: dall'ingresso sulla Gyeongbu giù per la valle di Dongnae,
  // attraverso Seomyeon e Jungang, fino al porto di Nampo.
  arterial([[3700, 0], [3700, 440]]);
  arterial(route([[3700, 1220], [3500, 1420], [3300, 1640]], { start: 'v' }));
  arterial([[3300, 2560], [3300, 2780]]);
  arterial([[2980, 3640], [3300, 3640]]);
  // L'asse est-ovest: Seomyeon → Centum, poi il lungomare di Haeundae.
  const beachSamples = [[5320, 2640], ...contour(mask, { px: 4700, py: 3000, a0: -0.4, a1: 0.45, n: 70, inset: 250 }), [5160, 3400]];
  arterial(route(beachSamples, { start: 'h' }));
  // La litoranea del sud: Nampo → Suyeong → il ponte di Gwangan → Marine City.
  arterial([[2980, 4120], [2980, 4120]].slice(0, 0));
  arterial([[3960, 4120], [5160, 4120]]);
  // Da Seomyeon a Sasang, e il raccordo Dongnae-Sasang.
  arterial(route([[2880, 1880], [2780, 1700], [2680, 1500]], { start: 'h' }));
  street([[2680, 980], [3200, 980]]);
  // Il lungomare del porto: parallelo alla riva occidentale, da Sasang a Nampo.
  const harborSamples = [[2030, 1500], [2030, 1700], [1600, 2250], ...contour(mask, { px: 3300, py: 2600, a0: 2.88, a1: 2.25, n: 40, inset: 470 }), [2340, 3880]];
  arterial(route(harborSamples, { start: 'v' }));
  // Il capo di Taejongdae e il ponte di Yeongdo.
  street([[3300, 4120], [3300, 4960]]);
  arterial([[2540, 4120], [2540, 4850]]);
  // Dongnae ↔ Oncheon: il raccordo dei quartieri del nord.
  street([[4200, 830], [4200, 660]]);
  street([[2540, 4850], [2800, 4850]]);

  buildNetwork(city, legs);
  city.isOnRoad = makeRoadHit(city);
  city.debugLegs = legs;
  city.bridges = bridgeDecks(city, mask);
  city.pylons = city.bridges.pylons;
  // Sotto l'impalcato c'è acqua per chi naviga (fuori dai piloni): `isWater` resta falso per chi guida.
  city.underDeck = (x, y) => !mask.land(x, y) && city.bridges.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)
    && !city.pylons.some((q) => x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h);
  // --- moli ------------------------------------------------------------------
  // Banchine che escono dalla riva occidentale nel porto: container a nord,
  // i moli di Jagalchi e di Nampo, e il molo dei traghetti.
  const westCoastX = (y) => { for (let x = 0; x < W; x += 8) if (mask.land(x, y)) return x; return W / 2; };
  const quay = (y, len, h, kind, name) => {
    const p = { x: westCoastX(y) - len, y: y - h / 2, w: len + 40, h, name };
    city.piers.push(p);
    for (let k = 70; k < len; k += 100) city.props.push({ type: 'bollard', x: p.x + k, y: p.y + 8, rot: 0, z: 16, solid: false, r: 7 });
    for (const [dy, kd] of [[-46, 'boat'], [h + 46, kind]]) {
      const bx = p.x + 90;
      const by = p.y + dy;
      if (!mask.land(bx, by) && !mask.land(bx - 80, by)) city.boatSpots.push({ x: bx, y: by, angle: Math.PI, kind: kd });
    }
    return p;
  };
  const piers = {
    container1: quay(2990, 640, 120, 'ferry', 'Busan container terminal 1'),
    container2: quay(3190, 560, 110, 'boat', 'Busan container terminal 2'),
    ferry: quay(3520, 600, 100, 'ferry', 'Busan ferry pier'),
    fish: quay(3730, 500, 92, 'boat', 'Jagalchi pier'),
    nampo: quay(3960, 420, 90, 'ferry', 'Nampo pier'),
  };

  // --- isolati ---------------------------------------------------------------
  const urbanRects = GRIDS.map((g) => ({ x0: g.xs[0] - 130, x1: g.xs[g.xs.length - 1] + 130, y0: g.ys[0] - 130, y1: g.ys[g.ys.length - 1] + 130 }));
  urbanRects.push({ x0: 4100, x1: 5650, y0: 170, y1: 1150 }, { x0: 5320, x1: 6100, y0: 2250, y1: 3500 }, { x0: 4880, x1: 5450, y0: 3000, y1: 4250 }, { x0: 2300, x1: 3050, y0: 4450, y1: 5000 });
  city.urbanZones = urbanRects;
  const PORT = { x0: 1000, x1: 2350, y0: 2750, y1: 4250 };
  const PLAZA = { x0: 3320, x1: 3540, y0: 2140, y1: 2320 };
  const landFn = (x, y) => mask.land(x, y);
  // Due luoghi dell'Atto III stanno a ridosso dei moli, in strisce di terra che gli
  // isolati ordinari non coprirebbero: il lotto si riserva prima di ritagliare.
  const MARKET = { x: westCoastX(3690) + 80, y: 3620, w: 200, h: 130 };
  const FERRY = { x: westCoastX(3560) + 80, y: 3480, w: 170, h: 90 };
  kit.makeBlocks(city, rng, {
    reserved: [MARKET, FERRY], land: landFn, hit: city.isOnRoad, districtAt: city.districtAt, byId, region: REGION,
    carve: { steps: [200, 100], minSize: 72, maxW: 700, maxH: 700, inset: 100 },
    classify: ({ cx, cy, rect, roadSides }) => {
      const e = city.elevationAt(cx, cy);
      const sh = mask.shoreDist(cx, cy);
      if (inRect(cx, cy, PLAZA) && roadSides >= 2) return 'park';
      if (roadSides >= 1 && inRect(cx, cy, PORT) && sh < 650 && rect.w >= 90 && rect.h >= 90) return 'dock';
      if (roadSides >= 1 && urbanRects.some((r) => inRect(cx, cy, r)) && e < 130 && rect.w >= 70 && rect.h >= 60) return 'urban';
      if (e > 70 || sh < 240) return 'park';
      return 'rural';
    },
  });
  // Il piazzale di Seomyeon: l'isolato che la classificazione ha lasciato come parco
  // si riconosce dal tema, e il passo `blocklife` ne fa una piazza.
  const plaza = city.blocks.find((b) => b.type === 'park' && inRect(b.x + b.w / 2, b.y + b.h / 2, PLAZA));
  if (plaza) { plaza.theme = 'plaza'; plaza.plaza = true; }
  kit.markStairs(city, city.elevationAt);
  for (const b of city.blocks) if (b.type === 'urban' && city.elevationAt(b.x + b.w / 2, b.y + b.h / 2) > 36) b.terrace = true;

  // --- luoghi nominati --------------------------------------------------------
  kit.addLandmarks(city, LANDMARKS, REGION);
  kit.addLandmarks(city, [
    { id: 'jagalchi-market', name: 'Jagalchi Market', hangul: '자갈치시장', label: 'Mercato di Jagalchi', kind: 'market', district: 'docks', rect: MARKET, style: 'warehouse', h3d: 78, color: '#a96950', roofColor: '#4e4039' },
    { id: 'busan-ferry-terminal', name: 'Busan Port International Ferry Terminal', hangul: '부산항 국제여객터미널', label: 'Terminal dei traghetti di Busan', kind: 'port', district: 'docks', rect: FERRY, style: 'glass', h3d: 58, color: '#7d97a6', roofColor: '#34505e' },
  ], REGION);
  const lm = (id, name, hangul, label, kind, district, x, y) => city.landmarks.push({ id, name, hangul, label, kind, district, region: REGION, x, y });
  lm('haeundae-beach', 'Haeundae Beach', '해운대해수욕장', 'Spiaggia di Haeundae', 'beach', 'gangnam', 5560, 2800);
  lm('gwangalli-beach', 'Gwangalli Beach', '광안리해수욕장', 'Spiaggia di Gwangalli', 'beach', 'myeongdong', 4030, 3560);
  const gb = city.bridges.find((b) => b.w > 500 && b.y > 4000 && b.y < 4200);
  lm('gwangan-bridge', 'Gwangan Bridge', '광안대교', 'Ponte Gwangan', 'bridge', 'myeongdong', gb ? gb.x + gb.w / 2 : 4500, 4120);
  lm('busan-bay', 'Busan Bay', '부산만', 'La baia sotto il ponte', 'bay', 'myeongdong', gb ? gb.x + gb.w / 2 : 4500, 4420);
  lm('busan-checkpoint', 'Busan Checkpoint', '부산 톨게이트', 'Ingresso di Busan', 'checkpoint', 'gyeonggi', 3700, 300);
  lm('nampo-piers', 'Nampo Piers', '남포동 부두', 'I moli di Nampo', 'pier', 'itaewon', piers.nampo.x + piers.nampo.w / 2, piers.nampo.y + piers.nampo.h / 2);
  lm('busan-container-port', 'Busan Container Terminal', '부산 컨테이너부두', 'Il porto dei container', 'port', 'docks', piers.container1.x + piers.container1.w - 120, piers.container1.y + piers.container1.h / 2);
  if (plaza) lm('seomyeon-square', 'Seomyeon Square', '서면 광장', 'Il piazzale di Seomyeon', 'square', 'hongdae', plaza.x + plaza.w / 2, plaza.y + plaza.h / 2);
  city.regionalLandmarks = city.landmarks;
  city.regionLandmarks = city.landmarks;
  kit.addTransit(city, TRANSIT, REGION);
  kit.placeHospitalsAndPolice(city, districts);
  kit.placeShops(city, districts);
  kit.placeGarages(city, districts);
  kit.placeTurfs(city, GANGS, [
    ['heuksa', 'docks', 'Il piazzale dei container'], ['cheolma', 'gimpo', 'Il cortile dell’officina'], ['baekho', 'hongdae'],
    ['hwangso', 'itaewon'], ['heuksa', 'myeongdong'], ['baekho', 'gangnam'],
  ]);
  // L'officina di Ko Eun-bi (철마파, Sasang): la porta della piazzola di Sasang.
  const workshop = city.garages.find((g) => g.district === 'gimpo');
  if (workshop) lm('sasang-workshop', 'Sasang Workshop', '사상 정비소', 'L’officina di Sasang', 'workshop', 'gimpo', workshop.door.x, workshop.door.y);

  // Eliporto: sul prato più grande di Haeundae.
  const heliBlock = city.blocks.filter((b) => b.type === 'park' && b.district === 'gangnam' && b.w >= 150 && b.h >= 150).sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (heliBlock) {
    const hp = { x: heliBlock.x + heliBlock.w / 2, y: heliBlock.y + heliBlock.h / 2, r: 45 };
    city.helipads.push(hp);
    city.airSpots.push({ x: hp.x, y: hp.y, angle: -Math.PI / 2, kind: 'heli' });
    heliBlock.heliport = true;
  }

  // --- compatibilità con chi legge i campi dell'acqua ---------------------------------
  city.coastAt = (y) => westCoastX(y);
  city.waterX = city.coastAt(H * 0.4);
  city.quayX = city.waterX + 470;
  city.coastLine = { c: city.quayX, width: 132, arterial: true, keep: true };
  city.coastIdx = 0;
  city.riverCell = -1;
  city.doglegs = 0;
  city.airport = null;
  city.port = { x: PORT.x0, y: PORT.y0, w: PORT.x1 - PORT.x0, h: PORT.y1 - PORT.y0, district: 'docks', name: 'Busan Port' };
  const bay = { id: 'busan-bay', name: 'Busan Bay', hangul: '부산만', label: 'Baia di Busan', kind: 'bay', type: 'bay', region: REGION, x: city.waterX, coastAt: city.coastAt };
  city.water = bay; city.sea = bay; city.coast = bay; city.coastline = bay;
  city.waterIdentity = { id: bay.id, name: bay.name, hangul: bay.hangul, label: bay.label, river: { id: 'nakdong-river', name: 'Nakdong River', hangul: '낙동강', label: 'Fiume Nakdong' }, coast: bay };
  city.waterBoundary = { type: 'polygon-mask', res: mask.res };
  const stSeo = city.transitStations.find((s) => s.id === 'busan-seomyeon') || city.transitStations[0];
  city.spawn = { x: stSeo.arrivalX, y: stSeo.arrivalY, angle: 0 };
  kit.indexCity(city, city.elevationAt);
  city.stats = kit.makeStats(city);
  void farmRoads; void clipLegs; void horizontalAt;
  return city;
}
