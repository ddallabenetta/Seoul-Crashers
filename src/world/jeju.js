// Regione di Jeju (제주): la stessa maglia procedurale di Seoul, riletta come
// un'isola vulcanica con città portuale, mercati e costa orientale.
import { generateCity } from './citygen.js';
import { DISTRICTS } from './districts.js';

/** Seed distinto dalla città principale e dalle altre regioni. */
export const JEJU_SEED = 20260808;

// Gli id restano quelli usati da negozi, traffico, bande e salvataggi. Cambiare
// solo la presentazione permette alla regione di conservare l'API della città.
const DISTRICT_PRESENTATION = {
  hongdae: {
    name: 'Jeju City',
    hangul: '제주시',
    subtitle: 'Porto, Dongmun Market e vicoli sempre aperti',
  },
  myeongdong: {
    name: 'Seongsan',
    hangul: '성산',
    subtitle: 'Alba sul cratere e costa orientale',
  },
  itaewon: {
    name: 'Aewol',
    hangul: '애월',
    subtitle: 'Caffè sul mare, muretti di pietra e surfisti',
  },
  gangnam: {
    name: 'Seogwipo',
    hangul: '서귀포',
    subtitle: 'Cascate, hotel e lungomare del sud',
  },
  docks: {
    name: 'Jeju Port',
    hangul: '제주항',
    subtitle: 'Traghetti, container e carichi senza domande',
  },
  gimpo: {
    name: 'Jeju Airport',
    hangul: '제주공항',
    subtitle: 'Piste, hangar e la porta dell’isola',
  },
  gyeonggi: {
    name: 'Hallasan',
    hangul: '한라산',
    subtitle: 'Boschi, sentieri e pendici vulcaniche',
  },
};

const LANDMARKS = {
  hallasan: {
    id: 'hallasan',
    name: 'Hallasan',
    hangul: '한라산',
    label: 'Monte Hallasan',
    kind: 'mountain',
    district: 'gyeonggi',
    target: [0.56, 0.73],
    style: 'hill',
    w: 190,
    h: 170,
    h3d: 230,
    color: '#3c6546',
    roofColor: '#304a36',
  },
  dongmun: {
    id: 'dongmun-market',
    name: 'Dongmun Market',
    hangul: '동문시장',
    label: 'Mercato Dongmun',
    kind: 'market',
    district: 'hongdae',
    target: [0.48, 0.22],
    style: 'warehouse',
    w: 238,
    h: 132,
    h3d: 76,
    color: '#a86b4d',
    roofColor: '#4e3e37',
  },
  seongsan: {
    id: 'seongsan-ilchulbong',
    name: 'Seongsan Ilchulbong',
    hangul: '성산일출봉',
    label: 'Picco dell’alba di Seongsan',
    kind: 'coastal',
    district: 'myeongdong',
    target: [0.87, 0.23],
    style: 'hill',
    w: 174,
    h: 142,
    h3d: 154,
    color: '#587b57',
    roofColor: '#38533b',
  },
  jejuCity: {
    id: 'jeju-city',
    name: 'Jeju City',
    hangul: '제주시',
    label: 'Città di Jeju',
    kind: 'city',
    district: 'hongdae',
    target: [0.42, 0.25],
  },
};

const TRANSIT_STATIONS = [
  { id: 'jeju-city', name: 'Jeju City Station', label: 'Stazione Jeju City', hangul: '제주시청역', target: [0.45, 0.25], lines: ['Jeju-1'] },
  { id: 'dongmun', name: 'Dongmun Market Station', label: 'Stazione Dongmun Market', hangul: '동문시장역', target: [0.48, 0.22], lines: ['Jeju-1', 'Port'] },
  { id: 'jeju-airport', name: 'Jeju Airport Station', label: 'Stazione Aeroporto di Jeju', hangul: '제주공항역', target: [0.19, 0.25], lines: ['Airport', 'Jeju-1'] },
  { id: 'seogwipo', name: 'Seogwipo Terminal', label: 'Terminal degli autobus di Seogwipo', hangul: '서귀포버스터미널', target: [0.76, 0.78], lines: ['Jeju-Express'] },
  { id: 'seongsan', name: 'Seongsan Station', label: 'Stazione Seongsan', hangul: '성산역', target: [0.86, 0.24], lines: ['East Coast'] },
  { id: 'hallasan', name: 'Hallasan Trailhead', label: 'Capolinea sentieri Hallasan', hangul: '한라산입구', target: [0.56, 0.73], lines: ['Mountain'] },
  { id: 'aewol', name: 'Aewol Station', label: 'Stazione costiera di Aewol', hangul: '애월역', target: [0.34, 0.46], lines: ['West Coast'] },
];

function cloneDistrict(base, patch = {}) {
  // Le copie profonde dei campi modificabili impediscono a una regione di
  // cambiare per errore le preferenze di Seoul condivise dal generatore.
  return {
    ...base,
    ...patch,
    seed: { ...base.seed },
    block: { ...base.block },
    grid: { ...base.grid, step: [...base.grid.step] },
    heights: [...base.heights],
    styles: [...base.styles],
    facade: [...base.facade],
    pedMix: [...base.pedMix],
    vehicleMix: [...base.vehicleMix],
  };
}

function localDistricts() {
  return DISTRICTS.map((base) => cloneDistrict(base, DISTRICT_PRESENTATION[base.id] || {}));
}

function hashSeed(seed, text) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clampPoint(city, x, y) {
  return {
    x: Math.max(0, Math.min(city.w, x)),
    y: Math.max(0, Math.min(city.h, y)),
  };
}

function nearestRoadPoint(city, target) {
  const tx = target[0] * city.w;
  const ty = target[1] * city.h;
  const nodes = city.graph && city.graph.usableNodes;
  if (!nodes || !nodes.length) return clampPoint(city, tx, ty);
  let best = nodes[0];
  let bestD = Infinity;
  for (const n of nodes) {
    const d = (n.x - tx) ** 2 + (n.y - ty) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return { x: best.x, y: best.y };
}

function nearestBlock(city, target, district, type) {
  const tx = target[0] * city.w;
  const ty = target[1] * city.h;
  const all = city.blocks.filter((b) => b.w >= 58 && b.h >= 58);
  const preferred = all.filter((b) => {
    if (type && b.type !== type) return false;
    if (district && b.district !== district) return false;
    return true;
  });
  const candidates = preferred.length ? preferred : all;
  let best = candidates[0] || null;
  let bestD = Infinity;
  for (const b of candidates) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const typePenalty = type && b.type !== type ? 900 * 900 : 0;
    const districtPenalty = district && b.district !== district ? 700 * 700 : 0;
    const d = (cx - tx) ** 2 + (cy - ty) ** 2 + typePenalty + districtPenalty;
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function makeLandmarkBuilding(city, spec, opts = {}) {
  const block = nearestBlock(city, spec.target, spec.district, opts.type);
  const target = { x: spec.target[0] * city.w, y: spec.target[1] * city.h };
  const maxW = block ? Math.max(46, block.w * 0.72) : spec.w;
  const maxH = block ? Math.max(46, block.h * 0.72) : spec.h;
  const w = Math.min(spec.w || 72, maxW);
  const h = Math.min(spec.h || 72, maxH);
  let x = target.x - w / 2;
  let y = target.y - h / 2;
  if (block) {
    x = block.x + (block.w - w) / 2;
    y = block.y + (block.h - h) / 2;
  }
  ({ x, y } = clampPoint(city, x, y));
  x = Math.min(x, Math.max(0, city.w - w));
  y = Math.min(y, Math.max(0, city.h - h));
  const center = { x: x + w / 2, y: y + h / 2 };
  const b = {
    x, y, w, h,
    h3d: spec.h3d || 64,
    elev: city.elevationAt ? city.elevationAt(center.x, center.y) : 0,
    style: spec.style || 'warehouse',
    color: spec.color || '#68737a',
    roofColor: spec.roofColor || '#3e484d',
    variant: hashSeed(city.seed, spec.id) % 4,
    litSeed: hashSeed(city.seed, `${spec.id}:lights`) % 10000,
    district: spec.district,
    districtName: (city.districtById[spec.district] || {}).name,
    districtHangul: (city.districtById[spec.district] || {}).hangul,
    region: 'jeju',
    solid: true,
    signs: [],
    landmark: true,
    ac: 0,
    water: false,
    name: spec.name,
    hangul: spec.hangul,
    label: spec.label,
    kind: spec.kind,
  };
  if (block) block.jejuLandmark = spec.id;
  // Il chiamante monta le nuove geometrie e ricostruisce le griglie una sola
  // volta: qui si aggiorna solo l'elenco canonico degli edifici.
  city.buildings.push(b);
  return b;
}

function landmarkEntry(spec, x, y, building) {
  return {
    id: spec.id,
    name: spec.name,
    hangul: spec.hangul,
    label: spec.label,
    kind: spec.kind,
    district: spec.district,
    region: 'jeju',
    x,
    y,
    ...(building ? { building } : {}),
  };
}

function rethemeExistingLandmarks(city) {
  for (const lm of city.landmarks || []) {
    lm.region = 'jeju';
    if (lm.name === 'Aeroporto di Gimpo') {
      lm.id = 'jeju-airport';
      lm.name = 'Jeju International Airport';
      lm.hangul = '제주국제공항';
      lm.label = 'Aeroporto Internazionale di Jeju';
      lm.kind = 'airport';
      lm.district = 'gimpo';
    } else if (lm.name === 'N Seoul Tower') {
      lm.id = LANDMARKS.hallasan.id;
      lm.name = LANDMARKS.hallasan.name;
      lm.hangul = LANDMARKS.hallasan.hangul;
      lm.label = LANDMARKS.hallasan.label;
      lm.kind = LANDMARKS.hallasan.kind;
      lm.district = LANDMARKS.hallasan.district;
    } else if (lm.name === 'Terminal container') {
      lm.id = 'jeju-port-terminal';
      lm.name = 'Jeju Port Ferry Terminal';
      lm.hangul = '제주항 여객터미널';
      lm.label = 'Terminal dei traghetti di Jeju';
      lm.kind = 'port';
      lm.district = 'docks';
    }
  }
}

function rethemeExistingTower(city) {
  const tower = city.buildings.find((b) => b.style === 'tower' && (b.name === 'N Seoul Tower' || b.name === LANDMARKS.hallasan.name));
  if (!tower) return null;
  tower.name = LANDMARKS.hallasan.name;
  tower.hangul = LANDMARKS.hallasan.hangul;
  tower.label = LANDMARKS.hallasan.label;
  tower.kind = LANDMARKS.hallasan.kind;
  const cx = tower.x + tower.w / 2;
  const cy = tower.y + tower.h / 2;
  tower.w = LANDMARKS.hallasan.w;
  tower.h = LANDMARKS.hallasan.h;
  tower.x = cx - tower.w / 2;
  tower.y = cy - tower.h / 2;
  tower.h3d = LANDMARKS.hallasan.h3d;
  tower.style = LANDMARKS.hallasan.style;
  tower.color = LANDMARKS.hallasan.color;
  tower.roofColor = LANDMARKS.hallasan.roofColor;
  tower.region = 'jeju';
  tower.district = LANDMARKS.hallasan.district;
  tower.districtName = city.districtById[LANDMARKS.hallasan.district]?.name;
  tower.districtHangul = city.districtById[LANDMARKS.hallasan.district]?.hangul;
  tower.landmark = true;
  const lm = city.landmarks.find((q) => q.id === LANDMARKS.hallasan.id || q.name === 'N Seoul Tower' || q.name === LANDMARKS.hallasan.name);
  if (lm) {
    lm.id = LANDMARKS.hallasan.id;
    lm.name = LANDMARKS.hallasan.name;
    lm.hangul = LANDMARKS.hallasan.hangul;
    lm.label = LANDMARKS.hallasan.label;
    lm.kind = LANDMARKS.hallasan.kind;
    lm.district = LANDMARKS.hallasan.district;
    lm.region = 'jeju';
    lm.building = tower;
  }
  return tower;
}

function adaptDistricts(city) {
  const districts = localDistricts();
  const byId = Object.fromEntries(districts.map((d) => [d.id, d]));
  city.districts = districts;
  city.districtById = byId;
  city.getDistrict = (id) => byId[id] || null;

  // Le coordinate restano quelle usate dal generatore: si cambia l'identità
  // restituita senza duplicare la logica Voronoi o disallineare i blocchi.
  const generatedDistrictAt = city.districtAt;
  city.districtAt = (x, y) => {
    const generated = generatedDistrictAt(x, y);
    return byId[generated.id] || districts[0];
  };

  for (const collection of [city.blocks, city.buildings, city.shops, city.hospitals, city.stations, city.turfs]) {
    for (const item of collection || []) {
      if (!item || !item.district) continue;
      const d = byId[item.district];
      if (!d) continue;
      item.districtName = d.name;
      item.districtHangul = d.hangul;
      const source = DISTRICTS.find((q) => q.id === item.district);
      if (item.name === d.name || item.name === source?.name) item.name = d.name;
    }
  }
}

function adaptWater(city) {
  const river = city.river;
  river.id = 'hancheon-stream';
  river.name = 'Hancheon Stream';
  river.hangul = '한천';
  river.label = 'Torrente Hancheon';
  river.region = 'jeju';

  // La maglia conserva il canale rettangolare per la compatibilità fisica, mentre
  // questi alias raccontano alla UI che l'acqua appartiene a un'isola vulcanica.
  const coast = {
    id: 'jeju-coast',
    name: 'Jeju Coast',
    hangul: '제주 해안',
    label: 'Costa di Jeju',
    kind: 'island',
    type: 'island',
    island: true,
    isIsland: true,
    region: 'jeju',
    x: city.waterX,
    coastAt: city.coastAt,
  };
  const island = {
    id: 'jeju-do',
    name: 'Jeju Island',
    hangul: '제주도',
    label: 'Isola di Jeju',
    kind: 'island',
    type: 'island',
    island: true,
    isIsland: true,
    region: 'jeju',
  };
  city.water = coast;
  city.sea = coast;
  city.coast = coast;
  city.coastline = coast;
  city.island = island;
  city.isIsland = true;
  city.waterIdentity = {
    id: island.id,
    name: island.name,
    hangul: island.hangul,
    label: island.label,
    kind: island.kind,
    island: true,
    island,
    coast: { id: coast.id, name: coast.name, hangul: coast.hangul, label: coast.label },
    river: { id: river.id, name: river.name, hangul: river.hangul, label: river.label },
  };
}

function adaptTransit(city) {
  city.transitStations = TRANSIT_STATIONS.map((station) => {
    const p = nearestRoadPoint(city, station.target);
    return {
      id: station.id,
      name: station.name,
      hangul: station.hangul,
      x: p.x,
      y: p.y,
      lines: [...station.lines],
      label: station.label,
      region: 'jeju',
      intercity: station.id === 'seogwipo' || station.id === 'jeju-airport',
    };
  });
  // Alias utile ai sistemi che distinguono i terminal dai nodi della metropolitana.
  city.intercityStations = city.transitStations.filter((s) => s.intercity);
}

function addJejuLandmarks(city) {
  rethemeExistingLandmarks(city);
  const existingHallasan = rethemeExistingTower(city);
  const hallasan = existingHallasan || makeLandmarkBuilding(city, LANDMARKS.hallasan, { type: 'park' });
  const hallasanEntry = city.landmarks.find((lm) => lm.id === LANDMARKS.hallasan.id);
  if (!hallasanEntry) {
    city.landmarks.push(landmarkEntry(LANDMARKS.hallasan, hallasan.x + hallasan.w / 2, hallasan.y + hallasan.h / 2, hallasan));
  } else {
    hallasanEntry.building = hallasan;
  }

  const dongmun = makeLandmarkBuilding(city, LANDMARKS.dongmun, { type: 'urban' });
  city.landmarks.push(landmarkEntry(LANDMARKS.dongmun, dongmun.x + dongmun.w / 2, dongmun.y + dongmun.h / 2, dongmun));

  const seongsan = makeLandmarkBuilding(city, LANDMARKS.seongsan, { type: 'park' });
  city.landmarks.push(landmarkEntry(LANDMARKS.seongsan, seongsan.x + seongsan.w / 2, seongsan.y + seongsan.h / 2, seongsan));

  const cityPoint = nearestRoadPoint(city, LANDMARKS.jejuCity.target);
  city.landmarks.push(landmarkEntry(LANDMARKS.jejuCity, cityPoint.x, cityPoint.y));

  // Un punto di riferimento costiero rende leggibile anche la parte sud senza
  // aggiungere volumi sull'acqua: la collisione resta affidata a strade e moli.
  const seogwipo = nearestRoadPoint(city, [0.76, 0.78]);
  city.landmarks.push({
    id: 'seogwipo-coast',
    name: 'Seogwipo Coast',
    hangul: '서귀포 해안',
    label: 'Costa di Seogwipo',
    kind: 'coastal',
    district: 'gangnam',
    region: 'jeju',
    x: seogwipo.x,
    y: seogwipo.y,
  });
}

/**
 * Genera la regione giocabile di Jeju.
 *
 * Tutti i campi prodotti da `generateCity` restano disponibili. I nuovi edifici
 * landmark vengono aggiunti dopo gli indici spaziali: il parent li reindicizza
 * insieme alla regione attiva, evitando più ricostruzioni della stessa griglia.
 */
export function createJejuCity(seed = JEJU_SEED) {
  const city = generateCity(seed);
  city.region = { id: 'jeju', name: 'Jeju', hangul: '제주' };
  city.name = 'Jeju';
  city.nameIt = 'Jeju';
  city.hangul = '제주';

  adaptDistricts(city);
  adaptWater(city);
  adaptTransit(city);
  addJejuLandmarks(city);

  if (city.stats) {
    city.stats.buildings = city.buildings.length;
    city.stats.landmarks = city.landmarks.length;
    city.stats.transitStations = city.transitStations.length;
  }
  return city;
}
