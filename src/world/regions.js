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
    const p = freeArrival(station);
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
