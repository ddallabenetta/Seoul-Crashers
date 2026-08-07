// Contenuti fissi per la Seoul allargata. Il modulo non importa il generatore:
// può quindi essere applicato subito dopo `generateCity` senza creare cicli e
// senza consumare lo stato del generatore pseudo-casuale.

const DEFAULT_WORLD_W = 7200;
const DEFAULT_WORLD_H = 7200;

// I punti sono frazioni della mappa (ovest -> est, nord -> sud). Le coordinate
// sono intenzionalmente lontane dal Han e dalla costa: i palazzi sono volumi
// solidi, mentre i marker regionali possono stare ai margini della mappa.
const LANDMARK_BUILDINGS = [
  {
    // Il generatore storico prova ad assegnarla a un isolato del Namsan, ma con
    // alcune maglie nessun isolato cade abbastanza vicino al centro: l'espansione
    // la rende un landmark garantito, senza duplicarla quando è già presente.
    name: 'N Seoul Tower',
    hangul: 'N서울타워',
    x: 0.585,
    y: 0.335,
    w: 74,
    h: 74,
    h3d: 470,
    style: 'tower',
    color: '#8d9099',
    roofColor: '#c9ccd4',
    districtHint: 'itaewon',
  },
  {
    name: 'Gyeongbokgung Palace',
    hangul: '경복궁',
    x: 0.625,
    y: 0.23,
    w: 246,
    h: 166,
    h3d: 26,
    style: 'stone',
    color: '#9a8c72',
    roofColor: '#4d594f',
    districtHint: 'myeongdong',
  },
  {
    name: 'Dongdaemun Design Plaza',
    hangul: '동대문디자인플라자',
    x: 0.775,
    y: 0.255,
    w: 188,
    h: 126,
    h3d: 58,
    style: 'concrete',
    color: '#9299a4',
    roofColor: '#636b76',
    districtHint: 'myeongdong',
  },
  {
    // Un mall riconoscibile a sud del Han: il riferimento commerciale di
    // Gangnam è COEX Mall (코엑스몰), non un nome inventato per la mappa.
    name: 'COEX Mall',
    hangul: '코엑스몰',
    x: 0.78,
    y: 0.79,
    w: 266,
    h: 156,
    h3d: 46,
    style: 'glass',
    color: '#4d7891',
    roofColor: '#304c60',
    districtHint: 'gangnam',
  },
  {
    name: 'Lotte World Tower',
    hangul: '롯데월드타워',
    x: 0.84,
    y: 0.70,
    w: 112,
    h: 112,
    h3d: 555,
    style: 'tower',
    color: '#8097aa',
    roofColor: '#d3e0e9',
    districtHint: 'gangnam',
  },
  {
    name: 'Seoul City Hall',
    hangul: '서울시청',
    x: 0.65,
    y: 0.27,
    w: 138,
    h: 90,
    h3d: 96,
    style: 'glass',
    color: '#7390a1',
    roofColor: '#4b5d69',
    districtHint: 'myeongdong',
  },
];

// Marker senza volume: oltre ai monumenti in città, rendono leggibili i luoghi
// che circondano Seoul (인천, 수원, 경기도) sulla mappa a tutto schermo.
const LANDMARK_MARKERS = [
  { name: 'Bukchon Hanok Village', hangul: '북촌한옥마을', x: 0.67, y: 0.22 },
  { name: 'Gwanghwamun Gate', hangul: '광화문', x: 0.625, y: 0.245 },
  { name: 'Changdeokgung Palace', hangul: '창덕궁', x: 0.70, y: 0.215 },
  { name: 'Cheonggyecheon Stream', hangul: '청계천', x: 0.715, y: 0.30 },
  { name: 'Banpo Bridge', hangul: '반포대교', x: 0.58, y: 0.685 },
  { name: 'Hangang Park', hangul: '한강공원', x: 0.53, y: 0.69 },
  { name: 'Lotte World Mall', hangul: '롯데월드몰', x: 0.855, y: 0.70 },
  { name: 'Seoul Forest', hangul: '서울숲', x: 0.81, y: 0.31 },
];

const REGIONAL_MARKERS = [
  { name: 'Incheon Chinatown', hangul: '인천 차이나타운', x: 0.23, y: 0.82 },
  { name: 'Suwon Hwaseong Fortress', hangul: '수원화성', x: 0.87, y: 0.94 },
  { name: 'Bukhansan National Park', hangul: '북한산국립공원', x: 0.84, y: 0.105 },
  { name: 'Gyeonggi-do', hangul: '경기도', x: 0.94, y: 0.48 },
  { name: 'Namyangju', hangul: '남양주', x: 0.95, y: 0.20 },
];

// Le fermate sono volutamente una rete piccola ma con interscambi reali. Le
// linee sono stringhe, così l'integrazione può associare a piacere colori o
// grafo senza dover reinterpretare numeri magici.
const TRANSIT_STATIONS = [
  { id: 'gimpo-airport', name: 'Gimpo Airport', hangul: '김포공항', x: 0.37, y: 0.28, lines: ['5', '9', 'AREX'] },
  { id: 'hongik-univ', name: 'Hongik University', hangul: '홍대입구', x: 0.45, y: 0.22, lines: ['2', 'AREX', 'Gyeongui-Jungang'] },
  { id: 'seoul-station', name: 'Seoul Station', hangul: '서울역', x: 0.56, y: 0.30, lines: ['1', '4', 'AREX', 'Gyeongui-Jungang'] },
  { id: 'city-hall', name: 'City Hall', hangul: '시청', x: 0.65, y: 0.27, lines: ['1', '2'] },
  { id: 'myeongdong', name: 'Myeongdong', hangul: '명동', x: 0.70, y: 0.24, lines: ['4'] },
  { id: 'dongdaemun', name: 'Dongdaemun History & Culture Park', hangul: '동대문역사문화공원', x: 0.775, y: 0.255, lines: ['2', '4', '5'] },
  { id: 'wangsimni', name: 'Wangsimni', hangul: '왕십리', x: 0.81, y: 0.34, lines: ['2', '5', 'Gyeongui-Jungang'] },
  { id: 'bukhansan', name: 'Bukhansan', hangul: '북한산우이', x: 0.84, y: 0.13, lines: ['Ui-Sinseol'] },
  { id: 'yeouido', name: 'Yeouido', hangul: '여의도', x: 0.50, y: 0.69, lines: ['5', '9'] },
  { id: 'gangnam', name: 'Gangnam', hangul: '강남', x: 0.72, y: 0.76, lines: ['2', 'Shinbundang'] },
  { id: 'samseong', name: 'Samseong (COEX)', hangul: '삼성', x: 0.78, y: 0.79, lines: ['2'] },
  { id: 'jamsil', name: 'Jamsil', hangul: '잠실', x: 0.85, y: 0.70, lines: ['2', '8'] },
  { id: 'seoul-national-univ', name: 'Seoul National University', hangul: '서울대입구', x: 0.77, y: 0.88, lines: ['2'] },
  { id: 'suseo', name: 'Suseo', hangul: '수서', x: 0.90, y: 0.80, lines: ['3', 'SRT'] },
  { id: 'incheon', name: 'Incheon', hangul: '인천', x: 0.23, y: 0.82, lines: ['1', 'Suin-Bundang'] },
  { id: 'suwon', name: 'Suwon', hangul: '수원', x: 0.87, y: 0.94, lines: ['1', 'Suin-Bundang'] },
];

function finiteDimension(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function worldPoint(def, w, h) {
  return { x: def.x * w, y: def.y * h };
}

function pointIsSafe(city, x, y) {
  if (x < 0 || y < 0 || x > city.w || y > city.h) return false;
  return typeof city.isWater !== 'function' || !city.isWater(x, y);
}

function rectsOverlap(a, b, pad = 0) {
  return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad
    && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
}

// Liang–Barsky segment clipping. Roadgraph edges are axis-aligned today, but
// keeping this generic makes the placement rule safe for regional adapters too.
function segmentIntersectsRect(edge, rect, pad = 0) {
  const left = rect.x - pad;
  const right = rect.x + rect.w + pad;
  const top = rect.y - pad;
  const bottom = rect.y + rect.h + pad;
  const ax = Number(edge.ax), ay = Number(edge.ay);
  const bx = Number(edge.bx), by = Number(edge.by);
  if (![ax, ay, bx, by].every(Number.isFinite)) return false;
  const dx = bx - ax;
  const dy = by - ay;
  let lo = 0;
  let hi = 1;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > hi) return false;
      if (t > lo) lo = t;
    } else {
      if (t < lo) return false;
      if (t < hi) hi = t;
    }
    return true;
  };
  return clip(-dx, ax - left) && clip(dx, right - ax)
    && clip(-dy, ay - top) && clip(dy, bottom - ay);
}

function propRect(prop) {
  const r = Number.isFinite(prop.r) ? Math.max(0, prop.r) : 0;
  return { x: prop.x - r, y: prop.y - r, w: r * 2, h: r * 2 };
}

function nearbyEdges(city, cx, cy, radius) {
  const graph = city.graph;
  if (!graph) return [];
  if (typeof graph.edgesNear === 'function') return graph.edgesNear(cx, cy, radius, []);
  return graph.edges || [];
}

function rectIsSafe(city, x, y, w, h) {
  const rect = { x, y, w, h };
  const edgePad = 6;
  if (x < 10 || y < 10 || x + w > city.w - 10 || y + h > city.h - 10) return false;

  // Sample the perimeter as well as the centre; this catches a landmark that
  // straddles the Han/coast even when all four corners happen to be dry.
  const samples = [];
  for (const fy of [0.04, 0.5, 0.96]) {
    for (const fx of [0.04, 0.5, 0.96]) samples.push([x + w * fx, y + h * fy]);
  }
  if (samples.some(([px, py]) => !pointIsSafe(city, px, py))) return false;

  // Existing generated buildings and solid props are authoritative. The gap is
  // intentional: a landmark must not touch another solid after broad-phase
  // insertion, otherwise the player can still become wedged at its corner.
  for (const building of city.buildings || []) {
    if (building && building.solid !== false && rectsOverlap(rect, building, 6)) return false;
  }
  for (const prop of city.props || []) {
    if (prop && prop.solid && rectsOverlap(rect, propRect(prop), 4)) return false;
  }
  for (const stair of city.stairs || []) {
    if (stair && rectsOverlap(rect, stair, 4)) return false;
  }

  // Keep a small clearance from each navigable graph segment. The generated
  // building lots already leave the road width outside the graph centreline;
  // expanding by a few pixels prevents exact-touching edge cases without
  // ejecting a landmark from its recognizable district.
  const radius = Math.hypot(w, h) * 0.5 + 90;
  for (const edge of nearbyEdges(city, x + w / 2, y + h / 2, radius)) {
    if (segmentIntersectsRect(edge, rect, edgePad)) return false;
  }
  return true;
}

/**
 * Restituisce un rettangolo vicino all'ancora. Le alternative sono fisse, non
 * casuali: si preferisce il punto più vicino che non tocchi acqua, edifici,
 * props solidi o il corridoio di un arco navigabile. Così le ancore restano
 * riconoscibili senza lasciare volumi che tappano il grafo stradale.
 */
function placeBuilding(city, def) {
  const w = finiteDimension(city.w, DEFAULT_WORLD_W);
  const h = finiteDimension(city.h, DEFAULT_WORLD_H);
  const wanted = worldPoint(def, w, h);
  const margin = 10;
  const candidate = (cx, cy) => {
    if (cx < margin + def.w / 2 || cy < margin + def.h / 2
      || cx > w - margin - def.w / 2 || cy > h - margin - def.h / 2) return null;
    const x = cx - def.w / 2;
    const y = cy - def.h / 2;
    return rectIsSafe(city, x, y, def.w, def.h) ? { x, y } : null;
  };

  // Rings are deterministic and ordered by distance, so equal seeds always
  // choose exactly the same replacement. A 24 px radial step is finer than a
  // player width while keeping the one-time bootstrap inexpensive.
  for (let radius = 0; radius <= 1600; radius += 24) {
    const count = radius === 0 ? 1 : Math.max(16, Math.ceil((Math.PI * 2 * radius) / 32));
    for (let i = 0; i < count; i++) {
      const angle = radius === 0 ? 0 : (Math.PI * 2 * i) / count;
      const found = candidate(wanted.x + radius * Math.cos(angle), wanted.y + radius * Math.sin(angle));
      if (found) return { ...def, ...found, cx: found.x + def.w / 2, cy: found.y + def.h / 2 };
    }
  }

  // Pathological/custom cities can fill the rings. A coarse deterministic scan
  // is preferable to placing a solid landmark on a road; it is reached only if
  // no nearby block has a legal footprint.
  const step = 48;
  for (let y = margin + def.h / 2; y <= h - margin - def.h / 2; y += step) {
    for (let x = margin + def.w / 2; x <= w - margin - def.w / 2; x += step) {
      const found = candidate(x, y);
      if (found) return { ...def, ...found, cx: found.x + def.w / 2, cy: found.y + def.h / 2 };
    }
  }

  // A city with no graph/solids (e.g. a small unit-test fixture) still gets a
  // useful landmark at its editorial anchor; generated Seoul takes one of the
  // safe branches above.
  const x = Math.max(margin, Math.min(w - def.w - margin, wanted.x - def.w / 2));
  const y = Math.max(margin, Math.min(h - def.h - margin, wanted.y - def.h / 2));
  return { ...def, x, y, cx: x + def.w / 2, cy: y + def.h / 2 };
}

function districtIdAt(city, x, y, hint) {
  if (typeof city.districtAt === 'function') {
    const d = city.districtAt(x, y);
    if (d && typeof d.id === 'string') return d.id;
  }
  return hint || 'myeongdong';
}

function nearestRoadPoint(city, x, y) {
  const nodes = city.graph && city.graph.usableNodes;
  if (!nodes || !nodes.length) return { x, y };
  let best = null;
  let bestD = Infinity;
  for (const node of nodes) {
    if (typeof city.isWater === 'function' && city.isWater(node.x, node.y)) continue;
    const d = (node.x - x) ** 2 + (node.y - y) ** 2;
    if (d < bestD) { bestD = d; best = node; }
  }
  return best ? { x: best.x, y: best.y } : { x, y };
}

function makeBuilding(city, placed, index) {
  const elev = typeof city.elevationAt === 'function' ? city.elevationAt(placed.cx, placed.cy) : 0;
  return {
    x: placed.x,
    y: placed.y,
    w: placed.w,
    h: placed.h,
    h3d: placed.h3d,
    elev: Number.isFinite(elev) ? elev : 0,
    style: placed.style,
    color: placed.color,
    roofColor: placed.roofColor,
    variant: index % 3,
    litSeed: 7000 + index,
    district: districtIdAt(city, placed.cx, placed.cy, placed.districtHint),
    solid: true,
    signs: [],
    edges: [],
    landmark: true,
    ac: 0,
    water: false,
    name: placed.name,
  };
}

function appendMarker(city, marker, extra = {}) {
  if (!Array.isArray(city.landmarks)) city.landmarks = [];
  if (city.landmarks.some((item) => item && item.name === marker.name)) return false;
  const w = finiteDimension(city.w, DEFAULT_WORLD_W);
  const h = finiteDimension(city.h, DEFAULT_WORLD_H);
  const p = worldPoint(marker, w, h);
  city.landmarks.push({
    name: marker.name,
    hangul: marker.hangul,
    x: Math.max(0, Math.min(w, p.x)),
    y: Math.max(0, Math.min(h, p.y)),
    ...extra,
  });
  return true;
}

/**
 * Estende una città appena generata con riferimenti reali di Seoul e della sua
 * cintura. La funzione è idempotente per nome/id e non ricostruisce alcuna
 * SpatialGrid: il chiamante può reindicizzare una sola volta a fine bootstrap.
 */
export function expandSeoul(city) {
  if (!city || typeof city !== 'object') throw new TypeError('expandSeoul richiede una città generata');
  if (!Array.isArray(city.buildings)) city.buildings = [];
  if (!Array.isArray(city.landmarks)) city.landmarks = [];

  const buildingNames = new Set(city.buildings.map((b) => b && b.name).filter(Boolean));
  for (let i = 0; i < LANDMARK_BUILDINGS.length; i++) {
    const def = LANDMARK_BUILDINGS[i];
    if (buildingNames.has(def.name)) continue;
    const placed = placeBuilding(city, def);
    city.buildings.push(makeBuilding(city, placed, i));
    buildingNames.add(def.name);
    // Keep the map label on the physical volume after a collision-avoidance
    // offset; the landmark remains recognizable instead of leaving its marker
    // on the road where the editorial anchor started.
    const w = finiteDimension(city.w, DEFAULT_WORLD_W);
    const h = finiteDimension(city.h, DEFAULT_WORLD_H);
    appendMarker(city, {
      ...def,
      x: placed.cx / w,
      y: placed.cy / h,
    });
  }

  for (const marker of LANDMARK_MARKERS) appendMarker(city, marker);

  if (!Array.isArray(city.regionalLandmarks)) city.regionalLandmarks = [];
  for (const marker of REGIONAL_MARKERS) {
    if (!city.regionalLandmarks.some((item) => item && item.name === marker.name)) {
      const w = finiteDimension(city.w, DEFAULT_WORLD_W);
      const h = finiteDimension(city.h, DEFAULT_WORLD_H);
      const p = worldPoint(marker, w, h);
      city.regionalLandmarks.push({
        name: marker.name,
        hangul: marker.hangul,
        x: Math.max(0, Math.min(w, p.x)),
        y: Math.max(0, Math.min(h, p.y)),
      });
    }
    appendMarker(city, marker, { kind: 'regional', region: true });
  }
  // Alias leggibile per sistemi UI che usano il singolare "region".
  city.regionLandmarks = city.regionalLandmarks;

  if (!Array.isArray(city.transitStations)) city.transitStations = [];
  const stationIds = new Set(city.transitStations.map((s) => s && s.id).filter(Boolean));
  const w = finiteDimension(city.w, DEFAULT_WORLD_W);
  const h = finiteDimension(city.h, DEFAULT_WORLD_H);
  for (const station of TRANSIT_STATIONS) {
    if (stationIds.has(station.id)) continue;
    const p = worldPoint(station, w, h);
    const road = nearestRoadPoint(city, p.x, p.y);
    city.transitStations.push({
      id: station.id,
      name: station.name,
      hangul: station.hangul,
      x: Math.max(0, Math.min(w, road.x)),
      y: Math.max(0, Math.min(h, road.y)),
      lines: [...station.lines],
    });
    stationIds.add(station.id);
  }

  // Un piccolo elemento di arredo rende visibile l'accesso in strada senza
  // introdurre una seconda collisione: il parent può reindicizzare i props e
  // associare l'entrata al nodo metro attraverso `stationId`.
  if (!Array.isArray(city.metroEntrances)) city.metroEntrances = [];
  if (!Array.isArray(city.props)) city.props = [];
  const entranceIds = new Set(city.metroEntrances.map((entry) => entry && entry.stationId).filter(Boolean));
  for (const station of city.transitStations) {
    if (entranceIds.has(station.id)) continue;
    const entrance = {
      id: `${station.id}-entrance`,
      stationId: station.id,
      x: station.x,
      y: station.y,
      w: 34,
      h: 22,
      kind: 'metro-entrance',
      hangul: '지하철',
      visible: true,
    };
    city.metroEntrances.push(entrance);
    city.props.push({
      type: 'kiosk',
      x: station.x,
      y: station.y,
      rot: 0,
      z: 40,
      solid: false,
      r: 18,
      word: '지하철',
      accent: '#54d7ff',
      stationId: station.id,
      metroEntrance: true,
    });
    entranceIds.add(station.id);
  }

  return city;
}
