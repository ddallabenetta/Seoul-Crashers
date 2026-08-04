// I distretti di Seoul Crashers. Le posizioni sono normalizzate (0..1) sulla mappa.
// Il fiume Han taglia la città in orizzontale; il mare (서해) chiude la mappa a
// ovest. Fra i due c'è la fascia che rende la mappa non quadrata: aeroporto,
// campagna e porto occupano il terzo occidentale, la città vera sta a est.

export const RIVER = { y0: 0.565, y1: 0.655 }; // frazione dell'altezza mappa
// Mare a ovest. `x1` è dove finisce l'acqua *nel senso della maglia stradale*: la
// battigia disegnata sta un po' più a ovest (vedi `coastAt` in citygen), così fra
// l'ultima strada e l'acqua resta la banchina.
export const SEA = { x1: 0.185 };

// Rilievi: cupole di quota. Il Namsan sta in mezzo alla città, il massiccio a
// nord-est è la cintura verde che chiude Seoul e le dà un profilo invece di un bordo.
export const NAMSAN = { x: 0.585, y: 0.335, r: 0.058 };
export const HILLS = [
  NAMSAN,
  { x: 0.90, y: 0.09, r: 0.13, h: 150, name: 'Bukhansan' },
  { x: 0.47, y: 0.045, r: 0.09, h: 96 },
];

/**
 * La sagoma di Seoul, scritta a mano. Sono le macchie dentro cui esiste il tessuto
 * urbano: una fascia larga a nord del Han (la città vecchia) e un lobo a sud
 * (Gangnam), con un cuneo di campagna che entra da ovest fra le due. Non coincide
 * con i centri dei distretti — un distretto è un'identità, questa è una superficie —
 * e sono queste otto macchie, non un rettangolo, a decidere dove finisce la città.
 */
export const URBAN_BLOBS = [
  { x: 0.47, y: 0.20, r: 0.185 },
  { x: 0.655, y: 0.15, r: 0.19 },
  { x: 0.825, y: 0.225, r: 0.15 },
  { x: 0.59, y: 0.42, r: 0.175 },
  { x: 0.755, y: 0.455, r: 0.145 },
  { x: 0.76, y: 0.80, r: 0.195 },
  { x: 0.59, y: 0.775, r: 0.14 },
  { x: 0.895, y: 0.635, r: 0.13 },
];

export const DISTRICTS = [
  {
    id: 'hongdae',
    name: 'Hongdae',
    hangul: '홍대',
    subtitle: 'Vicoli, murales, indie club',
    seed: { x: 0.45, y: 0.22 },
    // Tessuto urbano: lotti piccoli, edifici bassi e coloratissimi.
    block: { minLot: 62, maxLot: 130, gapChance: 0.16, alleyChance: 0.45 },
    // Maglia stradale. `step` è il passo fra due linee, `superblock` la probabilità
    // che una via secondaria salti un tratto (isolati fusi), `jog` quella di un
    // disassamento. Vedi `meshAt` in citygen: il passo globale segue il distretto
    // più fitto attraversato, i distretti larghi si ottengono togliendo linee.
    grid: { step: [126, 196], superblock: 0.20, jog: 0.60 },
    heights: [34, 104],
    styles: ['brick', 'panel', 'concrete'],
    facade: ['#8d6b7a', '#a8737a', '#7c6d92', '#9a8360', '#6f8390'],
    roof: '#4a4048',
    accent: '#ff5fa2', // neon dominante
    accent2: '#7cf3ff',
    ground: '#2c2a31',
    sidewalk: '#4c4954',
    signDensity: 0.85,
    treeDensity: 0.12,
    trafficDensity: 0.9,
    pedDensity: 1.5,
    pedMix: ['student', 'student', 'tourist', 'civil', 'gangster'],
    vehicleMix: ['hatch', 'hatch', 'sedan', 'taxi', 'scooter', 'scooter', 'van'],
  },
  {
    id: 'myeongdong',
    name: 'Myeongdong',
    hangul: '명동',
    subtitle: 'Insegne, folla, denaro contante',
    seed: { x: 0.70, y: 0.185 },
    block: { minLot: 80, maxLot: 170, gapChance: 0.1, alleyChance: 0.3 },
    grid: { step: [148, 236], superblock: 0.27, jog: 0.55 },
    heights: [52, 178],
    styles: ['concrete', 'panel', 'glass'],
    facade: ['#8a7264', '#96796a', '#7d7472', '#a08a6f', '#6e6b74'],
    roof: '#463f3c',
    accent: '#ff3b3b',
    accent2: '#ffcf4a',
    ground: '#2f2c2c',
    sidewalk: '#565059',
    signDensity: 1.0,
    treeDensity: 0.08,
    trafficDensity: 1.15,
    pedDensity: 1.8,
    pedMix: ['office', 'tourist', 'civil', 'civil', 'student'],
    vehicleMix: ['sedan', 'taxi', 'taxi', 'suv', 'bus', 'van', 'hatch'],
  },
  {
    id: 'itaewon',
    name: 'Itaewon',
    hangul: '이태원',
    subtitle: 'Bar internazionali, favori e debiti',
    seed: { x: 0.555, y: 0.465 },
    block: { minLot: 70, maxLot: 145, gapChance: 0.18, alleyChance: 0.4 },
    grid: { step: [140, 252], superblock: 0.31, jog: 0.62 },
    heights: [38, 126],
    styles: ['brick', 'concrete', 'panel'],
    facade: ['#8e6a4e', '#7a5f4c', '#96775a', '#6d6154', '#8a6e66'],
    roof: '#463a30',
    accent: '#ffa229',
    accent2: '#41e0a3',
    ground: '#2e2a26',
    sidewalk: '#514a44',
    signDensity: 0.8,
    treeDensity: 0.2,
    trafficDensity: 0.8,
    pedDensity: 1.3,
    pedMix: ['tourist', 'civil', 'gangster', 'student', 'office'],
    vehicleMix: ['sedan', 'suv', 'hatch', 'taxi', 'van', 'sport', 'scooter'],
  },
  {
    id: 'gangnam',
    name: 'Gangnam',
    hangul: '강남',
    subtitle: 'Vetro, chaebol, soldi puliti',
    seed: { x: 0.765, y: 0.815 },
    block: { minLot: 130, maxLot: 260, gapChance: 0.08, alleyChance: 0.12 },
    // Maglia larga e rigorosamente ortogonale: pochi disassamenti, molti superblocchi.
    grid: { step: [300, 470], superblock: 0.55, jog: 0.08 },
    heights: [90, 330],
    styles: ['glass', 'glass', 'panel'],
    facade: ['#4d6b86', '#3f5f7d', '#5a7590', '#46617a', '#6a8296'],
    roof: '#2f3d4a',
    accent: '#38d6ff',
    accent2: '#b48cff',
    ground: '#26292f',
    sidewalk: '#4a5260',
    signDensity: 0.5,
    treeDensity: 0.22,
    trafficDensity: 1.25,
    pedDensity: 1.1,
    pedMix: ['office', 'office', 'civil', 'tourist'],
    vehicleMix: ['sedan', 'sedan', 'suv', 'sport', 'sport', 'taxi', 'bus'],
  },
  {
    id: 'docks',
    name: 'Porto di Incheon',
    hangul: '인천항',
    subtitle: 'Container, gru, niente testimoni',
    seed: { x: 0.145, y: 0.795 },
    block: { minLot: 190, maxLot: 340, gapChance: 0.34, alleyChance: 0.06 },
    grid: { step: [330, 480], superblock: 0.60, jog: 0.12 },
    heights: [22, 62],
    styles: ['warehouse', 'warehouse', 'panel'],
    facade: ['#5c6660', '#4f5a5e', '#6a6f63', '#565d5a', '#484f4c'],
    roof: '#39403d',
    accent: '#ffd23f',
    accent2: '#4ad9a0',
    ground: '#24272a',
    sidewalk: '#454b4a',
    signDensity: 0.25,
    treeDensity: 0.03,
    trafficDensity: 0.5,
    pedDensity: 0.45,
    pedMix: ['worker', 'worker', 'gangster', 'civil'],
    vehicleMix: ['truck', 'truck', 'van', 'van', 'suv', 'sedan'],
  },
  {
    id: 'gimpo',
    name: 'Gimpo',
    hangul: '김포',
    subtitle: 'Piste, hangar e risaie',
    // Aeroporto e campi: a Gimpo le due cose si toccano davvero.
    seed: { x: 0.175, y: 0.255 },
    block: { minLot: 150, maxLot: 300, gapChance: 0.4, alleyChance: 0.05 },
    grid: { step: [360, 560], superblock: 0.62, jog: 0.06 },
    heights: [20, 54],
    styles: ['warehouse', 'panel', 'warehouse'],
    facade: ['#6b7079', '#5d6670', '#767b81', '#616a6e', '#7c8189'],
    roof: '#454b53',
    accent: '#5ec8ff',
    accent2: '#ffe66d',
    ground: '#2b3029',
    sidewalk: '#4d5250',
    signDensity: 0.2,
    treeDensity: 0.16,
    trafficDensity: 0.55,
    pedDensity: 0.5,
    pedMix: ['worker', 'tourist', 'civil', 'office'],
    vehicleMix: ['van', 'truck', 'sedan', 'bus', 'suv', 'tractor'],
  },
  {
    id: 'gyeonggi',
    name: 'Gyeonggi',
    hangul: '경기도',
    subtitle: 'Risaie, serre, capannoni senza nome',
    seed: { x: 0.325, y: 0.545 },
    block: { minLot: 170, maxLot: 340, gapChance: 0.5, alleyChance: 0.04 },
    // Maglia larghissima: in campagna esistono solo le provinciali.
    grid: { step: [420, 640], superblock: 0.7, jog: 0.05 },
    heights: [18, 44],
    styles: ['warehouse', 'brick', 'panel'],
    facade: ['#7a7059', '#6d6a54', '#87795f', '#5f6b52', '#7f7563'],
    roof: '#4a4536',
    accent: '#9ad84a',
    accent2: '#ffbf4a',
    ground: '#33361f',
    sidewalk: '#4a4a3f',
    signDensity: 0.12,
    treeDensity: 0.5,
    trafficDensity: 0.4,
    pedDensity: 0.3,
    pedMix: ['worker', 'civil', 'civil', 'gangster'],
    vehicleMix: ['tractor', 'truck', 'van', 'hatch', 'sedan', 'scooter'],
  },
];

export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));

/** Distretto più vicino (Voronoi) a coordinate normalizzate. */
export function districtAtNorm(nx, ny) {
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    // Il fiume è una barriera percettiva: penalizza chi sta sull'altra sponda.
    const crossRiver = (ny > RIVER.y1) !== (d.seed.y > RIVER.y1);
    const dx = nx - d.seed.x;
    const dy = ny - d.seed.y;
    let dd = dx * dx + dy * dy;
    if (crossRiver) dd += 0.35;
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

// Toponimi per le insegne: usati sia sui muri sia sulla mappa.
export const SIGN_WORDS = [
  { ko: '노래방', it: 'karaoke' },
  { ko: '치킨', it: 'pollo fritto' },
  { ko: '편의점', it: 'minimarket' },
  { ko: '피시방', it: 'internet cafè' },
  { ko: '삼겹살', it: 'griglia' },
  { ko: '포장마차', it: 'chiosco' },
  { ko: '전당포', it: 'banco dei pegni' },
  { ko: '세탁소', it: 'lavanderia' },
  { ko: '약국', it: 'farmacia' },
  { ko: '당구장', it: 'sala biliardo' },
  { ko: '목욕탕', it: 'bagni pubblici' },
  { ko: '분식', it: 'street food' },
  { ko: '술집', it: 'bar' },
  { ko: '호텔', it: 'hotel' },
  { ko: '은행', it: 'banca' },
  { ko: '중고차', it: 'auto usate' },
  { ko: '철물점', it: 'ferramenta' },
  { ko: '냉동창고', it: 'magazzino frigo' },
];

// Le bande. Ognuna occupa una o due zone (§ turf in citygen): il colore serve al
// tag dipinto a terra, al blip sulla mappa e all'anello sotto i piedi dei suoi.
export const GANGS = [
  { id: 'baekho', name: 'Tigre Bianca', hangul: '백호파', color: '#e8e2d0', trade: 'armi' },
  { id: 'heuksa', name: 'Serpe Nera', hangul: '흑사파', color: '#7d5ce0', trade: 'contrabbando' },
  { id: 'cheolma', name: 'Cavallo di Ferro', hangul: '철마파', color: '#ff7a29', trade: 'auto rubate' },
  { id: 'hwangso', name: 'Bue Giallo', hangul: '황소파', color: '#ffd23f', trade: 'usura' },
];
