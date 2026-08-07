// Registro delle regioni giocabili. Ogni città usa lo stesso contratto del
// generatore originale, così traffico, polizia, negozi e renderer non hanno rami.
import { SpatialGrid } from '../core/spatial.js';
import { generateCity } from './citygen.js';
import { DISTRICTS } from './districts.js';
import { expandSeoul } from './seoul_expansion.js';
import { createBusanCity } from './busan.js';
import { createJejuCity } from './jeju.js';

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

  // L'icona sulla mappa non basta: ogni fermata riceve un accesso fisico sul
  // marciapiede, spostato dal centro dell'incrocio e lontano dai volumi solidi.
  // Gli adattatori regionali possono proporre una posizione; qui viene validata
  // con lo stesso criterio per tutte le città e resa nel formato comune.
  if (!Array.isArray(city.metroEntrances)) city.metroEntrances = [];
  if (!Array.isArray(city.props)) city.props = [];
  const overlapsBuilding = (x, y, w, h) => city.buildings.some((b) =>
    b.solid !== false && x < b.x + b.w + 8 && x + w > b.x - 8
      && y < b.y + b.h + 8 && y + h > b.y - 8);
  const dryRect = (x, y, w, h) => {
    if (x < 28 || y < 28 || x + w > city.w - 28 || y + h > city.h - 28) return false;
    for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2]]) {
      if (city.isWater(px, py)) return false;
    }
    return !overlapsBuilding(x, y, w, h);
  };
  const entranceSpot = (station) => {
    const W = 72, H = 46;
    const supplied = city.metroEntrances.find((e) => e.stationId === station.id);
    const tries = [];
    if (supplied) tries.push({ x: supplied.x, y: supplied.y });
    for (const r of [54, 76, 98, 122]) {
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 4 * i;
        tries.push({ x: station.x + Math.cos(a) * r, y: station.y + Math.sin(a) * r });
      }
    }
    for (const p of tries) {
      const x = p.x - W / 2;
      const y = p.y - H / 2;
      if (dryRect(x, y, W, H)) return { x: p.x, y: p.y, w: W, h: H };
    }
    return { x: station.x, y: station.y, w: W, h: H };
  };
  for (const station of city.transitStations || []) {
    const spot = entranceSpot(station);
    let entrance = city.metroEntrances.find((e) => e.stationId === station.id);
    if (!entrance) {
      entrance = { id: `${station.id}-entrance`, stationId: station.id };
      city.metroEntrances.push(entrance);
    }
    Object.assign(entrance, spot, {
      kind: 'metro-entrance', hangul: '지하철', visible: true,
      angle: Math.atan2(station.y - spot.y, station.x - spot.x),
    });
    station.entrance = entrance;
    let prop = city.props.find((p) => p.stationId === station.id);
    if (!prop) {
      prop = { stationId: station.id, metroEntrance: true };
      city.props.push(prop);
    }
    Object.assign(prop, {
      type: 'metro_entrance', x: spot.x, y: spot.y, rot: entrance.angle,
      z: 44, solid: false, r: 38, word: 'M', accent: '#54d7ff',
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
    if (p.solid) city.solidGrid.insertRect({ ...box, solid: true });
  }
  for (const s of city.stairs || []) city.solidGrid.insertRect(s);

  const freeArrival = (station) => {
    const clear = (x, y) => {
      if (x < 24 || y < 24 || x > city.w - 24 || y > city.h - 24 || city.isWater(x, y)) return false;
      return !city.solidGrid.queryCircle(x, y, 12).some((o) =>
        x > o.x - 12 && x < o.x + o.w + 12 && y > o.y - 12 && y < o.y + o.h + 12);
    };
    for (let r = 24; r <= 120; r += 24) {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
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
  }

  city.blockGrid = new SpatialGrid(city.w, city.h, 400);
  for (const b of city.blocks) city.blockGrid.insertRect(b);
  if (city.stats) {
    city.stats.buildings = city.buildings.length;
    city.stats.props = city.props.length;
    city.stats.landmarks = city.landmarks.length;
    city.stats.transitStations = city.transitStations?.length || 0;
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
