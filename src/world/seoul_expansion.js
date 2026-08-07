// Contenuti fissi per la Seoul allargata. Il modulo non importa il generatore:
// può quindi essere applicato subito dopo `generateCity` senza creare cicli e
// senza consumare lo stato del generatore pseudo-casuale.

const DEFAULT_WORLD_W = 5400;
const DEFAULT_WORLD_H = 5400;

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

function rectIsSafe(city, x, y, w, h) {
  const pad = 4;
  const points = [
    [x + pad, y + pad],
    [x + w - pad, y + pad],
    [x + pad, y + h - pad],
    [x + w - pad, y + h - pad],
    [x + w / 2, y + h / 2],
  ];
  return points.every(([px, py]) => pointIsSafe(city, px, py));
}

/**
 * Restituisce un rettangolo vicino all'ancora. Le alternative sono fisse, non
 * casuali: se una seed mette un isolato sull'acqua il landmark resta comunque
 * in terra senza rendere il risultato dipendente da Math.random().
 */
function placeBuilding(city, def) {
  const w = finiteDimension(city.w, DEFAULT_WORLD_W);
  const h = finiteDimension(city.h, DEFAULT_WORLD_H);
  const wanted = worldPoint(def, w, h);
  const offsets = [
    [0, 0],
    [-180, 0],
    [180, 0],
    [0, -180],
    [0, 180],
    [-180, -180],
    [180, -180],
    [-180, 180],
    [180, 180],
  ];
  const margin = 8;
  let chosen = null;
  for (const [ox, oy] of offsets) {
    const cx = wanted.x + ox;
    const cy = wanted.y + oy;
    const x = Math.max(margin, Math.min(w - def.w - margin, cx - def.w / 2));
    const y = Math.max(margin, Math.min(h - def.h - margin, cy - def.h / 2));
    if (rectIsSafe(city, x, y, def.w, def.h)) {
      chosen = { x, y };
      break;
    }
  }
  // Le ancore sopra sono su terra nella mappa di Seoul; questo fallback serve
  // solo a città mock prive di una funzione d'acqua o a rettangoli minuscoli.
  if (!chosen) {
    chosen = {
      x: Math.max(margin, Math.min(w - def.w - margin, wanted.x - def.w / 2)),
      y: Math.max(margin, Math.min(h - def.h - margin, wanted.y - def.h / 2)),
    };
  }
  return { ...def, x: chosen.x, y: chosen.y, cx: chosen.x + def.w / 2, cy: chosen.y + def.h / 2 };
}

function districtIdAt(city, x, y, hint) {
  if (typeof city.districtAt === 'function') {
    const d = city.districtAt(x, y);
    if (d && typeof d.id === 'string') return d.id;
  }
  return hint || 'myeongdong';
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
    appendMarker(city, def);
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
    city.transitStations.push({
      id: station.id,
      name: station.name,
      hangul: station.hangul,
      x: Math.max(0, Math.min(w, p.x)),
      y: Math.max(0, Math.min(h, p.y)),
      lines: [...station.lines],
    });
    stationIds.add(station.id);
  }

  return city;
}
