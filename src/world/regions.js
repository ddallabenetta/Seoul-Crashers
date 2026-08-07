// Registro delle regioni giocabili. Ogni città usa lo stesso contratto del
// generatore originale, così traffico, polizia, negozi e renderer non hanno rami.
import { SpatialGrid } from '../core/spatial.js';
import { generateCity } from './citygen.js';
import { DISTRICTS } from './districts.js';
import { expandSeoul } from './seoul_expansion.js';
import { createBusanCity } from './busan.js';
import { createJejuCity } from './jeju.js';
import { nearestActiveLine, rectIntersectsRoad, rectsOverlap } from './roadclearance.js';

const ENTRANCE_W = 86;
const ENTRANCE_H = 58;
const BOUNDARY_DEPTH = 64;

function reindex(city) {
  // Le coordinate editoriali delle fermate indicano il quartiere; l'ingresso
  // effettivo viene agganciato al nodo stradale più vicino, così l'arrivo non
  // finisce mai dentro il volume del landmark che dà il nome alla stazione.
  const nodes = city.graph?.usableNodes || [];
  for (const station of city.transitStations || []) {
    let best = null;
    let bestD = Infinity;
    for (const n of nodes) {
      const d = (n.x - station.x) ** 2 + (n.y - station.y) ** 2;
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best) { station.x = best.x; station.y = best.y; }
  }

  // Ultima rete di sicurezza editoriale: i generatori possono fondere celle o
  // aggiungere arredo dopo aver costruito la maglia. Se un volume ordinario
  // invade la carreggiata reale viene scartato prima degli indici; landmark e
  // infrastrutture invece devono essere corretti alla fonte e fanno fallire il
  // bootstrap, così non perdiamo silenziosamente un luogo importante.
  const removedBuildings = new Set();
  for (const building of city.buildings || []) {
    if (building.solid === false || building.isBelt || building.isBank
      || (building.style === 'wall' && building.flat)) continue;
    if (!rectIntersectsRoad(city, building, 0)) continue;
    if (building.landmark) throw new Error(`Landmark sulla carreggiata: ${building.name || building.style}`);
    removedBuildings.add(building);
  }
  if (removedBuildings.size) {
    city.buildings = city.buildings.filter((b) => !removedBuildings.has(b));
    city.garages = (city.garages || []).filter((g) => !removedBuildings.has(g.building));
    city.shops = (city.shops || []).filter((s) => !removedBuildings.has(s.building));
  }
  city.props = (city.props || []).filter((p) => p.stationId || !p.solid
    || !rectIntersectsRoad(city, { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 }, 0));

  // L'icona sulla mappa non basta: ogni fermata riceve un accesso fisico sul
  // marciapiede, spostato dal centro dell'incrocio e lontano dai volumi solidi.
  // Gli adattatori regionali possono proporre una posizione; qui viene validata
  // con lo stesso criterio per tutte le città e resa nel formato comune.
  if (!Array.isArray(city.metroEntrances)) city.metroEntrances = [];
  if (!Array.isArray(city.props)) city.props = [];
  const entranceProps = new Set((city.props || []).filter((p) => p.stationId));
  const usedEntranceRects = [];
  const structurallyClear = (x, y, w, h) => {
    const rect = { x, y, w, h };
    if (x < BOUNDARY_DEPTH + 8 || y < BOUNDARY_DEPTH + 8
      || x + w > city.w - BOUNDARY_DEPTH - 8 || y + h > city.h - BOUNDARY_DEPTH - 8) return false;
    for (const [px, py] of [
      [x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2],
      [x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2],
    ]) {
      if (city.isWater(px, py)) return false;
    }
    if (rectIntersectsRoad(city, rect, 4)) return false;
    if ((city.stairs || []).some((s) => rectsOverlap(rect, s, 6))) return false;
    // Due stazioni vicine non diventano una doppia scala indistinguibile: fra i
    // vani resta una piccola piazza pedonale, non soltanto un pixel di aria.
    return !usedEntranceRects.some((other) => rectsOverlap(rect, other, 48));
  };
  const dryRect = (x, y, w, h) => {
    const rect = { x, y, w, h };
    if (!structurallyClear(x, y, w, h)) return false;
    if (city.buildings.some((b) => b.solid !== false && rectsOverlap(rect, b, 8))) return false;
    if ((city.props || []).some((p) => {
      if (!p || entranceProps.has(p) || !p.solid) return false;
      const r = Math.max(4, p.r || 0);
      return rectsOverlap(rect, { x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 }, 3);
    })) return false;
    return true;
  };
  const reserveRect = (x, y, w, h) => {
    const rect = { x, y, w, h };
    if (!structurallyClear(x, y, w, h)) return false;
    const blockers = city.buildings.filter((b) => b.solid !== false && rectsOverlap(rect, b, 10));
    if (blockers.length > 2 || blockers.some((b) => b.landmark || b.isBank || b.isBelt || b.flat
      || b.shop || b.garage || b.hospital || b.station)) return false;
    const removed = new Set(blockers);
    city.buildings = city.buildings.filter((b) => !removed.has(b));
    city.shops = (city.shops || []).filter((s) => !removed.has(s.building));
    city.garages = (city.garages || []).filter((g) => !removed.has(g.building));
    city.props = city.props.filter((p) => {
      if (entranceProps.has(p)) return true;
      const r = Math.max(4, p.r || 0);
      return !rectsOverlap(rect, { x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 }, 5);
    });
    return true;
  };
  const entranceSpot = (station) => {
    // La collisione è quadrata e copre anche il totem laterale dello sprite.
    // Le proposte sono sugli angoli dell'incrocio o lungo un singolo asse: mai
    // in mezzo alle corsie, anche quando la fermata editoriale è un nodo.
    const W = ENTRANCE_W, H = ENTRANCE_H;
    const supplied = city.metroEntrances.find((e) => e.stationId === station.id);
    const tries = [];
    if (supplied) tries.push({ x: supplied.x, y: supplied.y, rot: supplied.rot || 0 });
    const v = nearestActiveLine(city, 'v', station.x, station.y);
    const h = nearestActiveLine(city, 'h', station.x, station.y);
    const gap = 12;
    if (h) {
      const corner = v ? v.width / 2 + W / 2 + gap : 0;
      const tangents = v
        ? [-corner, corner, -corner - 72, corner + 72, -corner - 144, corner + 144]
        : [0, -76, 76, -152, 152, -228, 228];
      for (const side of [-1, 1]) for (const tangent of tangents) {
        tries.push({
          x: station.x + tangent,
          y: h.c + side * (h.width / 2 + H / 2 + gap),
          rot: side > 0 ? Math.PI : 0,
          w: W, h: H,
        });
      }
    }
    if (v) {
      const corner = h ? h.width / 2 + W / 2 + gap : 0;
      const tangents = h
        ? [-corner, corner, -corner - 72, corner + 72, -corner - 144, corner + 144]
        : [0, -76, 76, -152, 152, -228, 228];
      for (const side of [-1, 1]) for (const tangent of tangents) {
        tries.push({
          x: v.c + side * (v.width / 2 + H / 2 + gap),
          y: station.y + tangent,
          rot: side > 0 ? -Math.PI / 2 : Math.PI / 2,
          w: H, h: W,
        });
      }
    }
    for (const p of tries) {
      const pw = p.w || W, ph = p.h || H;
      const x = p.x - pw / 2;
      const y = p.y - ph / 2;
      if (dryRect(x, y, pw, ph)) return { x: p.x, y: p.y, w: pw, h: ph, rot: p.rot || 0 };
    }
    // Nelle zone più fitte una vera uscita metro occupa il piano terra di un
    // lotto d'angolo. Se entro il primo isolato non esiste un vuoto, riserviamo
    // quel piccolo fronte eliminando al massimo due volumi procedurali; landmark
    // e infrastrutture restano intoccabili.
    for (const p of tries) {
      const pw = p.w || W, ph = p.h || H;
      const x = p.x - pw / 2;
      const y = p.y - ph / 2;
      if (reserveRect(x, y, pw, ph)) return { x: p.x, y: p.y, w: pw, h: ph, rot: p.rot || 0 };
    }
    // Una fermata in una geografia personalizzata può non avere un incrocio
    // completo. Il fallback allarga la ricerca, ma conserva il veto stradale.
    for (let r = 96; r <= 1200; r += 24) {
      for (let i = 0; i < 24; i++) {
        const a = Math.PI * 2 * i / 24;
        const x = station.x + Math.cos(a) * r - W / 2;
        const y = station.y + Math.sin(a) * r - H / 2;
        if (dryRect(x, y, W, H)) return { x: x + W / 2, y: y + H / 2, w: W, h: H, rot: a + Math.PI };
      }
    }
    throw new Error(`Nessun marciapiede libero per l'accesso ${station.id}`);
  };
  for (const station of city.transitStations || []) {
    const spot = entranceSpot(station);
    usedEntranceRects.push({ x: spot.x - spot.w / 2, y: spot.y - spot.h / 2, w: spot.w, h: spot.h });
    let entrance = city.metroEntrances.find((e) => e.stationId === station.id);
    if (!entrance) {
      entrance = { id: `${station.id}-entrance`, stationId: station.id };
      city.metroEntrances.push(entrance);
    }
    Object.assign(entrance, spot, {
      kind: 'metro-entrance', hangul: '지하철', visible: true,
      angle: spot.rot,
    });
    station.entrance = entrance;
    let prop = city.props.find((p) => p.stationId === station.id);
    if (!prop) {
      prop = { stationId: station.id, metroEntrance: true };
      city.props.push(prop);
    }
    Object.assign(prop, {
      type: 'metro_entrance', x: spot.x, y: spot.y, rot: entrance.angle,
      z: 44, solid: true, r: ENTRANCE_W / 2, collisionW: spot.w, collisionH: spot.h,
      word: 'M', accent: '#54d7ff',
      metroEntrance: true,
    });
  }
  // Alias regionale storico: da qui in poi entrambi i nomi indicano gli stessi
  // oggetti, così mappa e interazione non possono divergere.
  city.transitEntrances = city.metroEntrances;

  // Gli adattatori regionali aggiungono volumi dopo `generateCity`. Un solo
  // rebuild qui evita indici parziali e rende subito solidi tutti i landmark.
  city.buildingGrid = new SpatialGrid(city.w, city.h, 300);
  city.solidGrid = new SpatialGrid(city.w, city.h, 260);
  for (const b of city.buildings) {
    if (!b.flat && city.elevationAt) {
      b.elev = city.elevationAt(b.x + b.w / 2, b.y + b.h / 2);
    }
    city.buildingGrid.insertRect(b);
    if (b.solid !== false) city.solidGrid.insertRect(b);
  }

  city.propGrid = new SpatialGrid(city.w, city.h, 220);
  for (const p of city.props || []) {
    const box = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2, prop: p };
    city.propGrid.insertRect(box);
    if (p.solid) {
      const cw = p.collisionW || p.r * 2;
      const ch = p.collisionH || p.r * 2;
      city.solidGrid.insertRect({ x: p.x - cw / 2, y: p.y - ch / 2, w: cw, h: ch, prop: p, solid: true });
    }
  }
  for (const s of city.stairs || []) city.solidGrid.insertRect(s);
  city.boundaryColliders = [
    { x: 0, y: 0, w: city.w, h: BOUNDARY_DEPTH, solid: true, isBoundary: true },
    { x: 0, y: city.h - BOUNDARY_DEPTH, w: city.w, h: BOUNDARY_DEPTH, solid: true, isBoundary: true },
    { x: 0, y: BOUNDARY_DEPTH, w: BOUNDARY_DEPTH, h: city.h - BOUNDARY_DEPTH * 2, solid: true, isBoundary: true },
    { x: city.w - BOUNDARY_DEPTH, y: BOUNDARY_DEPTH, w: BOUNDARY_DEPTH, h: city.h - BOUNDARY_DEPTH * 2, solid: true, isBoundary: true },
  ];
  for (const boundary of city.boundaryColliders) city.solidGrid.insertRect(boundary);

  const freeArrival = (station) => {
    const clear = (x, y) => {
      if (x < 24 || y < 24 || x > city.w - 24 || y > city.h - 24 || city.isWater(x, y)) return false;
      return !city.solidGrid.queryCircle(x, y, 12).some((o) =>
        x > o.x - 12 && x < o.x + o.w + 12 && y > o.y - 12 && y < o.y + o.h + 12);
    };
    const besideRoad = (x, y) => typeof city.isOnRoad !== 'function' || !city.isOnRoad(x, y);
    for (let r = 56; r <= 144; r += 16) {
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        const x = station.x + Math.cos(a) * r;
        const y = station.y + Math.sin(a) * r;
        if (clear(x, y) && besideRoad(x, y)) return { x, y };
      }
    }
    for (let r = 56; r <= 168; r += 16) {
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        const x = station.x + Math.cos(a) * r;
        const y = station.y + Math.sin(a) * r;
        if (clear(x, y)) return { x, y };
      }
    }
    return { x: station.x, y: station.y };
  };
  for (const station of city.transitStations || []) {
    const p = freeArrival(station.entrance || station);
    station.arrivalX = p.x;
    station.arrivalY = p.y;
    station.entrance.approachX = p.x;
    station.entrance.approachY = p.y;
  }

  city.blockGrid = new SpatialGrid(city.w, city.h, 400);
  for (const b of city.blocks) city.blockGrid.insertRect(b);
  if (city.stats) {
    city.stats.buildings = city.buildings.length;
    city.stats.props = city.props.length;
    city.stats.landmarks = city.landmarks.length;
    city.stats.transitStations = city.transitStations?.length || 0;
    city.stats.shops = city.shops?.length || 0;
    city.stats.venues = (city.shops || []).reduce((n, s) => n + (s.biz?.length || 0), 0);
    city.stats.garages = city.garages?.length || 0;
  }
  return city;
}

export function createRegion(id = 'seoul') {
  let city;
  if (id === 'busan') city = createBusanCity();
  else if (id === 'jeju') city = createJejuCity();
  else {
    city = generateCity(20260730);
    city.region = { id: 'seoul', name: 'Seoul', hangul: '서울' };
    city.name = 'Seoul';
    city.hangul = '서울';
    city.districts = DISTRICTS;
    city.districtById = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
    expandSeoul(city);
  }
  return reindex(city);
}

export const REGION_IDS = ['seoul', 'busan', 'jeju'];
