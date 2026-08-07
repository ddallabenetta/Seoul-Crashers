// Regione di Busan (부산): stesso tessuto procedurale di Seoul, con identità,
// toponimi e luoghi riconoscibili della costa sud. Il generatore di base resta
// volutamente intatto: qui si adatta il risultato e si aggiungono soltanto i
// volumi che rendono leggibili i landmark della regione.
import { generateCity } from './citygen.js';
import { DISTRICTS } from './districts.js';

/** Seed di default distinto da quello della città principale. */
export const BUSAN_SEED = 20260807;

// Gli id sono quelli già usati da traffico, negozi, bande e salvataggi. Cambiare
// gli id per usare nomi nuovi (nampo, haeundae, ...) romperebbe quei sistemi; la
// presentazione, invece, è locale alla città e non tocca `DISTRICTS`.
const DISTRICT_PRESENTATION = {
  hongdae: {
    name: 'Seomyeon',
    hangul: '서면',
    subtitle: 'Metro, vicoli e vita notturna',
  },
  myeongdong: {
    name: 'Gwangalli',
    hangul: '광안리',
    subtitle: 'Spiaggia, neon e il ponte sulla baia',
  },
  itaewon: {
    name: 'Nampo-dong',
    hangul: '남포동',
    subtitle: 'Busan Tower, porto vecchio e mercati',
  },
  gangnam: {
    name: 'Haeundae',
    hangul: '해운대',
    subtitle: 'Spiaggia, hotel e skyline di Centum City',
  },
  docks: {
    name: 'Jagalchi',
    hangul: '자갈치',
    subtitle: 'Mercato del pesce, moli e contrabbando',
  },
  gimpo: {
    name: 'Sasang',
    hangul: '사상',
    subtitle: 'Il Nakdong, officine e scali ferroviari',
  },
  gyeonggi: {
    name: 'Dongnae',
    hangul: '동래',
    subtitle: 'Colline, terme e case basse',
  },
};

const LANDMARKS = {
  busanTower: {
    id: 'busan-tower',
    name: 'Busan Tower',
    hangul: '부산타워',
    label: 'Torre di Busan',
    kind: 'tower',
    district: 'itaewon',
    target: [0.6, 0.34],
    style: 'tower',
    w: 78,
    h: 78,
    h3d: 470,
    color: '#8d9099',
    roofColor: '#c9ccd4',
  },
  jagalchi: {
    id: 'jagalchi-market',
    name: 'Jagalchi Market',
    hangul: '자갈치시장',
    label: 'Mercato di Jagalchi',
    kind: 'market',
    district: 'docks',
    target: [0.29, 0.75],
    style: 'warehouse',
    w: 250,
    h: 150,
    h3d: 78,
    color: '#a86550',
    roofColor: '#51413c',
  },
  centum: {
    id: 'centum-city',
    name: 'Centum City',
    hangul: '센텀시티',
    label: 'Centum City',
    kind: 'district',
    district: 'gangnam',
    target: [0.76, 0.81],
    style: 'glass',
    w: 150,
    h: 150,
    h3d: 340,
    color: '#4f7894',
    roofColor: '#2d4558',
  },
};

const TRANSIT_STATIONS = [
  { id: 'busan-nampo', name: 'Nampo Station', label: 'Stazione Nampo', hangul: '남포역', target: [0.60, 0.34], lines: ['1'] },
  { id: 'busan-jagalchi', name: 'Jagalchi Station', label: 'Stazione Jagalchi', hangul: '자갈치역', target: [0.31, 0.73], lines: ['1'] },
  { id: 'busan-seomyeon', name: 'Seomyeon Station', label: 'Stazione Seomyeon', hangul: '서면역', target: [0.50, 0.43], lines: ['1', '2'] },
  { id: 'busan-gwangalli', name: 'Gwangalli Station', label: 'Stazione Gwangalli', hangul: '광안역', target: [0.66, 0.55], lines: ['2'] },
  { id: 'busan-haeundae', name: 'Haeundae Station', label: 'Stazione Haeundae', hangul: '해운대역', target: [0.80, 0.74], lines: ['2'] },
  { id: 'busan-centum', name: 'Centum City Station', label: 'Stazione Centum City', hangul: '센텀시티역', target: [0.76, 0.81], lines: ['2', 'Donghae'] },
  { id: 'busan-sasang', name: 'Sasang Station', label: 'Stazione Sasang', hangul: '사상역', target: [0.22, 0.54], lines: ['2', 'Gimhae'] },
];

function cloneDistrict(base, patch = {}) {
  // I campi annidati sono copiati anche quando non cambiano: un renderer può
  // aggiungere una preferenza locale senza mai scrivere nell'oggetto globale.
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
  const x = target[0] * city.w;
  const y = target[1] * city.h;
  const nodes = city.graph && city.graph.usableNodes;
  if (!nodes || !nodes.length) return clampPoint(city, x, y);
  let best = nodes[0];
  let bestD = Infinity;
  for (const n of nodes) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
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
  const pool = city.blocks.filter((b) => {
    if (type && b.type !== type) return false;
    if (district && b.district !== district) return false;
    return b.w >= 58 && b.h >= 58;
  });
  // A Busan landmark should still exist when a different seed happens not to
  // produce a block of the preferred district/type. The fallback keeps the
  // adapter useful for previews and deterministic alternate maps.
  const candidates = pool.length ? pool : city.blocks.filter((b) => b.w >= 58 && b.h >= 58);
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
  const w = Math.min(spec.w, maxW);
  const h = Math.min(spec.h, maxH);
  let x = target.x - w / 2;
  let y = target.y - h / 2;
  if (block) {
    x = block.x + (block.w - w) / 2;
    y = block.y + (block.h - h) / 2;
  }
  ({ x, y } = clampPoint(city, x, y));
  x = Math.min(x, city.w - w);
  y = Math.min(y, city.h - h);
  const center = { x: x + w / 2, y: y + h / 2 };
  const b = {
    x, y, w, h,
    h3d: spec.h3d,
    elev: city.elevationAt ? city.elevationAt(center.x, center.y) : 0,
    style: spec.style,
    color: spec.color,
    roofColor: spec.roofColor,
    variant: hashSeed(city.seed, spec.id) % 4,
    litSeed: hashSeed(city.seed, `${spec.id}:lights`) % 10000,
    district: spec.district,
    districtName: (city.districtById[spec.district] || {}).name,
    districtHangul: (city.districtById[spec.district] || {}).hangul,
    region: 'busan',
    solid: true,
    signs: [],
    landmark: true,
    ac: 0,
    water: false,
    name: spec.name,
    hangul: spec.hangul,
    label: spec.label,
  };
  if (block) block.busanLandmark = spec.id;
  // Deliberately do not insert this volume into `buildingGrid`/`solidGrid`:
  // callers that switch regions own the one spatial reindex after construction.
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
    region: 'busan',
    x,
    y,
    ...(building ? { building } : {}),
  };
}

function rethemeExistingLandmarks(city) {
  for (const lm of city.landmarks) {
    lm.region = 'busan';
    if (lm.name === 'Aeroporto di Gimpo') {
      lm.id = 'gimhae-airport';
      lm.name = 'Gimhae International Airport';
      lm.hangul = '김해국제공항';
      lm.label = 'Aeroporto Internazionale di Gimhae';
      lm.kind = 'airport';
    } else if (lm.name === 'N Seoul Tower') {
      lm.id = LANDMARKS.busanTower.id;
      lm.name = LANDMARKS.busanTower.name;
      lm.hangul = LANDMARKS.busanTower.hangul;
      lm.label = LANDMARKS.busanTower.label;
      lm.kind = LANDMARKS.busanTower.kind;
      lm.district = LANDMARKS.busanTower.district;
    } else if (lm.name === 'Terminal container') {
      lm.id = 'busan-port-terminal';
      lm.name = 'Busan Port Container Terminal';
      lm.hangul = '부산항 컨테이너 터미널';
      lm.label = 'Terminal container del porto di Busan';
      lm.kind = 'port';
    }
  }
}

function rethemeExistingTower(city) {
  const tower = city.buildings.find((b) => b.name === 'N Seoul Tower' && b.style === 'tower');
  if (!tower) return null;
  tower.name = LANDMARKS.busanTower.name;
  tower.hangul = LANDMARKS.busanTower.hangul;
  tower.label = LANDMARKS.busanTower.label;
  tower.region = 'busan';
  tower.districtName = city.districtById[LANDMARKS.busanTower.district]?.name;
  tower.districtHangul = city.districtById[LANDMARKS.busanTower.district]?.hangul;
  tower.landmark = true;
  const lm = city.landmarks.find((q) => q.id === LANDMARKS.busanTower.id || q.name === 'Busan Tower');
  if (lm) {
    lm.id = LANDMARKS.busanTower.id;
    lm.name = LANDMARKS.busanTower.name;
    lm.hangul = LANDMARKS.busanTower.hangul;
    lm.label = LANDMARKS.busanTower.label;
    lm.kind = LANDMARKS.busanTower.kind;
    lm.district = LANDMARKS.busanTower.district;
    lm.region = 'busan';
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

  // `generateCity` already made this query deterministic. Wrapping it avoids
  // duplicating Voronoi logic and changes only the object returned to callers.
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
      if (item.name === d.name || item.name === DISTRICTS.find((q) => q.id === item.district)?.name) item.name = d.name;
    }
  }
}

function adaptWater(city) {
  const river = city.river;
  river.id = 'nakdong-river';
  river.name = 'Nakdong River';
  river.hangul = '낙동강';
  river.label = 'Fiume Nakdong';
  river.region = 'busan';

  // Keep `waterX`, `coastAt` and all navigation math intact. These aliases are
  // descriptive metadata consumed by region-aware UI; no water geometry is
  // regenerated here.
  const bay = {
    id: 'busan-bay',
    name: 'Busan Bay',
    hangul: '부산만',
    label: 'Baia di Busan',
    kind: 'bay',
    region: 'busan',
    x: city.waterX,
    coastAt: city.coastAt,
  };
  city.water = bay;
  city.sea = bay;
  city.waterIdentity = {
    river: { id: river.id, name: river.name, hangul: river.hangul, label: river.label },
    coast: { id: bay.id, name: bay.name, hangul: bay.hangul, label: bay.label },
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
      region: 'busan',
    };
  });
}

function addBusanLandmarks(city) {
  rethemeExistingLandmarks(city);
  const existingTower = rethemeExistingTower(city);
  const tower = existingTower || makeLandmarkBuilding(city, LANDMARKS.busanTower, { type: 'park' });

  const towerEntry = city.landmarks.find((lm) => lm.id === LANDMARKS.busanTower.id);
  if (!towerEntry) {
    city.landmarks.push(landmarkEntry(LANDMARKS.busanTower, tower.x + tower.w / 2, tower.y + tower.h / 2, tower));
  } else {
    towerEntry.building = tower;
  }

  const jagalchi = makeLandmarkBuilding(city, LANDMARKS.jagalchi, { type: 'port' });
  city.landmarks.push(landmarkEntry(LANDMARKS.jagalchi, jagalchi.x + jagalchi.w / 2, jagalchi.y + jagalchi.h / 2, jagalchi));

  const centum = makeLandmarkBuilding(city, LANDMARKS.centum, { type: 'urban' });
  city.landmarks.push(landmarkEntry(LANDMARKS.centum, centum.x + centum.w / 2, centum.y + centum.h / 2, centum));

  const haeundae = nearestRoadPoint(city, [0.80, 0.74]);
  const gwangalli = nearestRoadPoint(city, [0.66, 0.55]);
  city.landmarks.push({
    id: 'haeundae-beach', name: 'Haeundae Beach', hangul: '해운대해수욕장',
    label: 'Spiaggia di Haeundae', kind: 'beach', district: 'gangnam', region: 'busan',
    x: haeundae.x, y: haeundae.y,
  });
  city.landmarks.push({
    id: 'gwangalli-beach', name: 'Gwangalli Beach', hangul: '광안리해수욕장',
    label: 'Spiaggia di Gwangalli', kind: 'beach', district: 'myeongdong', region: 'busan',
    x: gwangalli.x, y: gwangalli.y,
  });

  const bridges = city.river.bridges || [];
  const bridge = bridges.length ? bridges[Math.floor(bridges.length / 2)] : null;
  city.landmarks.push({
    id: 'gwangan-bridge', name: 'Gwangan Bridge', hangul: '광안대교',
    label: 'Ponte Gwangan', kind: 'bridge', district: 'myeongdong', region: 'busan',
    x: bridge ? bridge.x : city.w * 0.66,
    y: (city.river.y0 + city.river.y1) / 2,
  });
}

/**
 * Genera la regione giocabile di Busan.
 *
 * La città restituita conserva ogni campo prodotto da `generateCity`: strade,
 * grafo, edifici, negozi, griglie e API fisiche. L'adattamento è deterministico;
 * i tre nuovi volumi landmark sono lasciati fuori dagli indici spaziali perché
 * il chiamante che monta una regione può reindicizzare una sola volta, dopo aver
 * scelto la città attiva.
 */
export function createBusanCity(seed = BUSAN_SEED) {
  const city = generateCity(seed);
  city.region = { id: 'busan', name: 'Busan', hangul: '부산' };
  city.name = 'Busan';
  city.nameIt = 'Busan';
  city.hangul = '부산';

  adaptDistricts(city);
  adaptWater(city);
  adaptTransit(city);
  addBusanLandmarks(city);

  // Gli edifici landmark sono aggiunti dopo il calcolo degli indici del
  // generatore; aggiorniamo solo i contatori descrittivi, senza ricostruire le
  // griglie che il parent può fondere/reindicizzare insieme al resto del mondo.
  if (city.stats) {
    city.stats.buildings = city.buildings.length;
    city.stats.landmarks = city.landmarks.length;
    city.stats.transitStations = city.transitStations.length;
  }
  return city;
}
