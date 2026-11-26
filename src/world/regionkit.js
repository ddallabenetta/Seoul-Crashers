// Attrezzi comuni a Busan e Jeju (§5.41): edifici, isolati riempiti, vetrine, officine,
// ospedali, fermate, landmark e indici. Prima ogni regione aveva la sua copia di
// queste funzioni (e le due copie avevano cominciato a divergere); adesso c'è una
// sola implementazione e quello che cambia da una regione all'altra sta nei
// **distretti** — palette, mix di negozi, parole delle insegne — e non nel codice.
import { Rng } from '../core/rng.js';
import { SpatialGrid } from '../core/spatial.js';
import { BUSINESSES, DISTRICT_MIX } from './interiors.js';
import { rectIntersectsRoad, rectsOverlap } from './roadclearance.js';
import { carveBlocks, sideProfile, roadRects } from './netgen.js';

export const SIDEWALK = 20;
const DOOR_OUT = 11;
const SIGN_WORDS_DEFAULT = ['노래방', '치킨', '편의점', '술집', '호텔', '분식'];

export function cloneDistrict(d, region) {
  return {
    ...d,
    seed: { ...d.seed }, block: { ...d.block }, grid: { ...d.grid, step: [...d.grid.step] },
    heights: [...d.heights], styles: [...d.styles], facade: [...d.facade], pedMix: [...d.pedMix], vehicleMix: [...d.vehicleMix],
    signWords: d.signWords ? [...d.signWords] : undefined,
    mix: d.mix ? { ground: [...d.mix.ground], upper: [...d.mix.upper] } : undefined,
    regionId: region,
  };
}

export function mixOf(d) {
  return d.mix || DISTRICT_MIX[d.id] || DISTRICT_MIX.hongdae;
}

// ---------------------------------------------------------------------------
// EDIFICI E PROP
// ---------------------------------------------------------------------------

export function makeBuilding(rng, district, region, x, y, w, h, opts = {}) {
  const style = opts.style || rng.pick(district.styles);
  const b = {
    x, y, w, h,
    h3d: opts.h3d ?? Math.round(district.heights[0] + rng.next() * (district.heights[1] - district.heights[0])),
    elev: 0, style, color: opts.color || rng.pick(district.facade), roofColor: opts.roofColor || district.roof,
    variant: rng.int(0, 3), litSeed: rng.int(0, 9999), district: district.id, districtName: district.name, districtHangul: district.hangul,
    solid: opts.solid !== false, signs: [], edges: opts.streetEdges || [], landmark: !!opts.landmark,
    ac: opts.ac ?? rng.int(0, 2), water: opts.water ?? rng.chance(0.18), region,
  };
  const sd = opts.signChance ?? district.signDensity;
  if (b.h3d > 30 && b.edges.length && !b.landmark) {
    const words = district.signWords || SIGN_WORDS_DEFAULT;
    for (const edge of b.edges) if (rng.chance(sd)) {
      b.signs.push({ edge, t: rng.range(0.18, 0.82), word: rng.pick(words), color: rng.chance(0.5) ? district.accent : district.accent2, vertical: rng.chance(0.6), h: rng.range(0.35, 0.8) });
    }
  }
  return b;
}

export function addProp(city, type, x, y, opts = {}) {
  city.props.push({ type, x, y, rot: opts.rot || 0, z: opts.z ?? 20, solid: !!opts.solid, r: opts.r ?? 12, ...opts });
}

function splitSpan(rng, start, len, lo, hi) {
  const out = [];
  let p = 0;
  while (len - p > lo * 0.72) {
    let n = rng.range(lo, hi);
    if (len - p - n < lo * 0.72) n = len - p;
    out.push({ a: start + p, len: n });
    p += n + rng.range(2, 6);
  }
  return out;
}

// ---------------------------------------------------------------------------
// ISOLATI
// ---------------------------------------------------------------------------

/**
 * Isolato urbano. Gli edifici stanno solo sui lati che **guardano una strada**
 * (`sides.x.road`): un lato sul mare o sul bosco non ha porte, e la striscia che
 * resterebbe diventa cortile (e sul lungomare, spiaggia). Il corpo è una corona di
 * lotti con un cortile in mezzo, come a Seoul.
 */
export function fillUrban(city, rng, block, d, region, sides, opts = {}) {
  const roadSide = (s) => sides[s].road >= 0.3;
  const pad = Math.min(SIDEWALK, Math.max(8, (Math.min(block.w, block.h) - 48) / 2));
  const x = block.x + pad;
  const y = block.y + pad;
  const w = block.w - pad * 2;
  const h = block.h - pad * 2;
  if (w < 42 || h < 42) return false;
  const gap = (opts.gapChance ?? d.block.gapChance) * (d.gapScale ?? 1);
  const push = (bx, by, bw, bh, edges, corner = false) => {
    if (bw < 30 || bh < 28) return;
    if (rng.chance(gap)) { block.yards.push({ x: bx, y: by, w: bw, h: bh }); return; }
    city.buildings.push(makeBuilding(rng, d, region, bx, by, bw, bh, { streetEdges: edges, arterial: block.onArterial, corner }));
  };
  const rt = roadSide('top');
  const rb = roadSide('bottom');
  const rl = roadSide('left');
  const rr = roadSide('right');
  if (!(rt || rb || rl || rr)) return false;
  // Isolato grande: corona di lotti attorno a un cortile. Isolato piccolo: le
  // strisce si dividono la profondità (una fila sola se c'è un lato solo).
  const ring = w > 120 && h > 140;
  let dt = 0;
  let db = 0;
  let dl = 0;
  let dr = 0;
  if (ring) {
    dt = rt ? Math.min(h * 0.34, rng.range(48, 100)) : 0;
    db = rb ? Math.min(h * 0.34, rng.range(48, 100)) : 0;
    dl = rl ? Math.min(w * 0.32, rng.range(48, 100)) : 0;
    dr = rr ? Math.min(w * 0.32, rng.range(48, 100)) : 0;
  } else if (rt || rb) {
    if (rt && rb) { dt = h / 2 - 2; db = h - dt - 4; } else if (rt) dt = h; else db = h;
  } else if (rl && rr) { dl = w / 2 - 2; dr = w - dl - 4; } else if (rl) dl = w; else dr = w;
  // `lotScale`: i distretti di mare hanno lotti più stretti di quelli di Seoul.
  const lo = d.block.minLot * (d.lotScale ?? 1);
  const hi = d.block.maxLot * (d.lotScale ?? 1);
  if (dt > 0) splitSpan(rng, x, w, lo, hi).forEach((q, i) => push(q.a, y, q.len - 3, dt, ['top'], i === 0));
  if (db > 0) splitSpan(rng, x, w, lo, hi).forEach((q, i) => push(q.a, y + h - db, q.len - 3, db, ['bottom'], i === 0));
  const iy = y + (dt > 0 ? dt + 3 : 0);
  const ih = h - (dt > 0 ? dt + 3 : 0) - (db > 0 ? db + 3 : 0);
  if (ih > 34) {
    if (dl > 0) splitSpan(rng, iy, ih, lo, hi).forEach((q, i) => push(x, q.a, dl, q.len - 3, ['left'], i === 0));
    if (dr > 0) splitSpan(rng, iy, ih, lo, hi).forEach((q, i) => push(x + w - dr, q.a, dr, q.len - 3, ['right'], i === 0));
  }
  if (ring) {
    const cx = x + (dl > 0 ? dl + 3 : 0);
    const cw = w - (dl > 0 ? dl + 3 : 0) - (dr > 0 ? dr + 3 : 0);
    if (cw > 30 && ih > 30) {
      block.courtyard = { x: cx, y: iy, w: cw, h: ih };
      block.yards.push(block.courtyard);
      // Qualche edificio nel cortile: le città di mare sono fitte, pensioni e
      // magazzini dietro le fasce di negozi.
      if (opts.inner && cw > 90 && ih > 80) {
        // Il cuore dell'isolato: due o tre file di edifici bassi e alti fra le fasce di negozi.
        const cols = Math.max(1, Math.round(cw / 110));
        const rows = Math.max(1, Math.round(ih / 100));
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          if (rng.chance(0.12)) continue;
          const iw = cw / cols - 8;
          const ih2 = ih / rows - 8;
          if (iw < 34 || ih2 < 30) continue;
          city.buildings.push(makeBuilding(rng, d, region, cx + (i * cw) / cols + 4, iy + (j * ih) / rows + 4, iw, ih2, { streetEdges: [], signChance: 0.06 }));
        }
      }
      if (rng.chance(0.55)) {
        const aw = Math.min(48, cw * 0.35);
        const alley = { x: block.x + block.w / 2 - aw / 2, y: block.y, w: aw, h: block.h, through: true };
        block.alleys.push(alley);
        block.yards.push(alley);
        block.reachable = true;
      }
    }
  }
  return true;
}

/** Lampioni e alberi sul bordo dei lati che guardano la strada. */
export function decorateEdges(city, rng, block, d, sides) {
  const inset = 20;
  const defs = [
    ['top', block.x, block.y + inset, 1, 0, block.w],
    ['bottom', block.x, block.y + block.h - inset, 1, 0, block.w],
    ['left', block.x + inset, block.y, 0, 1, block.h],
    ['right', block.x + block.w - inset, block.y, 0, 1, block.h],
  ];
  for (const [side, sx, sy, dx, dy, len] of defs) {
    if (sides[side].road < 0.5) continue;
    for (let i = 70; i < len - 20; i += 132) {
      const px = sx + dx * i;
      const py = sy + dy * i;
      const roll = rng.next();
      const rot = dx ? 0 : Math.PI / 2;
      if (roll < 0.42) city.props.push({ type: 'lamp', x: px, y: py, rot, z: 96, solid: false, r: 6 });
      else if (roll < 0.42 + d.treeDensity) city.props.push({ type: 'tree', x: px, y: py, rot: rng.range(0, 6.28), z: 64, solid: false, r: 12, tint: rng.int(0, 2) });
      else if (roll < 0.62) city.props.push({ type: 'vending', x: px, y: py, rot, z: 34, solid: true, r: 12 });
      else if (roll < 0.72) city.props.push({ type: 'bench', x: px, y: py, rot, z: 14, solid: false, r: 14 });
      else if (roll < 0.86) city.props.push({ type: 'busstop', x: px, y: py, rot, z: 44, solid: false, r: 20 });
      else city.props.push({ type: 'bin', x: px, y: py, rot: 0, z: 22, solid: false, r: 9 });
    }
  }
}

export function fillPark(city, rng, block) {
  block.yards.push({ x: block.x, y: block.y, w: block.w, h: block.h });
  const n = Math.min(40, Math.floor((block.w * block.h) / 5200));
  for (let i = 0; i < n; i++) {
    city.props.push({ type: 'tree', x: block.x + rng.range(18, Math.max(19, block.w - 18)), y: block.y + rng.range(18, Math.max(19, block.h - 18)), rot: rng.range(0, 6.28), z: rng.range(48, 82), solid: false, r: 13, tint: rng.int(0, 2) });
  }
}

export function fillRural(city, rng, block, d, region) {
  const pad = 14;
  const x = block.x + pad;
  const y = block.y + pad;
  const w = block.w - pad * 2;
  const h = block.h - pad * 2;
  block.fields = [];
  if (w < 70 || h < 70) { block.yards.push({ x, y, w, h }); return; }
  const cols = Math.max(1, Math.round(w / 250));
  const rows = Math.max(1, Math.round(h / 230));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const f = { x: x + (i * w) / cols + 5, y: y + (j * h) / rows + 5, w: w / cols - 10, h: h / rows - 10, wet: rng.chance(0.4) };
    block.fields.push(f);
    if (rng.chance(0.24)) city.props.push({ type: 'tree', x: f.x + f.w * rng.range(0.15, 0.85), y: f.y + f.h * rng.range(0.15, 0.85), rot: rng.range(0, 6.28), z: 58, solid: false, r: 13, tint: rng.int(0, 2) });
    if (rng.chance(0.12) && f.w > 80 && f.h > 80) city.buildings.push(makeBuilding(rng, d, region, f.x + f.w * 0.22, f.y + f.h * 0.22, f.w * 0.56, f.h * 0.42, { style: rng.chance(0.55) ? 'greenhouse' : 'warehouse', h3d: rng.int(24, 50), signChance: 0, streetEdges: [] }));
  }
  block.yards.push({ x, y, w, h });
}

/**
 * Isolato portuale. Capannoni sul lato lontano dall'acqua, container nel piazzale,
 * una gru. `waterSide` dice da che parte sta il mare così la gru e il molo guardano
 * l'acqua; il passo `blocklife` aggiunge gru a portale, muletti e insegne.
 */
export function fillDock(city, rng, block, d, region, waterSide = null) {
  const pad = 18;
  const area = { x: block.x + pad, y: block.y + pad, w: block.w - pad * 2, h: block.h - pad * 2 };
  block.yards.push(area);
  if (area.w < 90 || area.h < 90) return;
  const horizontalShed = area.w >= area.h;
  const shedW = horizontalShed ? Math.min(260, area.w * 0.34) : Math.min(area.w * 0.6, 220);
  const shedH = horizontalShed ? Math.min(area.h * 0.6, 150) : Math.min(150, area.h * 0.34);
  // Il capannone sta sul lato opposto all'acqua.
  const sx = waterSide === 'left' ? area.x + area.w - shedW : waterSide === 'right' ? area.x : area.x + area.w - shedW;
  const sy = horizontalShed ? area.y + (area.h - shedH) / 2 : (waterSide === 'top' ? area.y + area.h - shedH : area.y);
  city.buildings.push(makeBuilding(rng, d, region, sx, sy, shedW, shedH, { style: 'warehouse', h3d: rng.int(46, 76), streetEdges: horizontalShed ? [sx > area.x ? 'right' : 'left'] : [sy > area.y ? 'bottom' : 'top'], signChance: 0.35 }));
  const palette = ['#c8493a', '#3f7ea8', '#cf9a2f', '#4a8f5e', '#8f5aa8'];
  const free = horizontalShed
    ? { x: sx > area.x ? area.x : area.x + shedW + 40, y: area.y, w: area.w - shedW - 40, h: area.h }
    : { x: area.x, y: sy > area.y ? area.y : area.y + shedH + 40, w: area.w, h: area.h - shedH - 40 };
  const cols = Math.max(0, Math.floor((free.w - 24) / 58));
  const rows = Math.max(0, Math.floor((free.h - 24) / 110));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (rng.chance(0.74)) {
    city.buildings.push({ x: free.x + 12 + i * 58, y: free.y + 12 + j * 110, w: 40, h: 92, h3d: 26 * rng.int(1, 3), elev: 0, style: 'container', color: rng.pick(palette), roofColor: '#2c3336', variant: 1, litSeed: rng.int(0, 9999), district: d.id, districtName: d.name, districtHangul: d.hangul, solid: true, signs: [], edges: [], landmark: false, ac: 0, water: false, region });
  }
  city.props.push({ type: 'crane', x: area.x + area.w * 0.5, y: area.y + area.h * 0.5, rot: 0, z: 150, solid: true, r: 26 });
}

/**
 * Dal tessuto stradale agli isolati riempiti: ritaglia lo spazio libero
 * (`netgen.carveBlocks`), dà a ogni rettangolo un tipo (`classify`, che decide la
 * regione: quale zona è città, quale bosco, quale porto) e lo riempie. L'ordine è
 * quello di lettura della mappa, non quello di generazione, così l'aggiunta di una
 * strada non rimescola l'rng di tutto quello che sta più a est.
 */
export function makeBlocks(city, rng, { reserved = [], land, hit, classify, districtAt, byId, region, carve = {}, fillOpts = {} }) {
  const rects = carveBlocks(city, { roads: roadRects(city), reserved, land, ...carve });
  rects.sort((p, q) => p.y - q.y || p.x - q.x);
  const made = [];
  for (const r of rects) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const sides = sideProfile(r, hit, land);
    const roadSides = ['top', 'bottom', 'left', 'right'].filter((s) => sides[s].road >= 0.3).length;
    const info = { rect: r, cx, cy, sides, roadSides };
    const d = districtAt(cx, cy);
    const b = { x: r.x, y: r.y, w: r.w, h: r.h, type: classify(info, d), district: d.id, onArterial: false, yards: [], alleys: [], sides };
    made.push(b);
  }
  city.blocks.push(...made);
  for (const b of made) {
    const d = byId[b.district];
    if (b.type === 'urban') {
      if (!fillUrban(city, rng, b, d, region, b.sides, { inner: true, ...fillOpts })) { b.type = 'park'; fillPark(city, rng, b); } else decorateEdges(city, rng, b, d, b.sides);
    } else if (b.type === 'dock') {
      const waterSide = ['top', 'bottom', 'left', 'right'].find((k) => b.sides[k].water >= 0.5) || null;
      fillDock(city, rng, b, d, region, waterSide);
    } else if (b.type === 'rural') {
      fillRural(city, rng, b, d, region);
    } else fillPark(city, rng, b);
  }
  return made;
}

/** Scalinate: un vicolo che attraversa un isolato in forte pendenza non è per le auto. */
export function markStairs(city, elevationAt) {
  for (const b of city.blocks) for (const a of b.alleys || []) {
    if (!a.through || (a.h < 130 && a.w < 130)) continue;
    const vertical = a.h > a.w;
    const len = vertical ? a.h : a.w;
    const x0 = vertical ? a.x + a.w / 2 : a.x;
    const y0 = vertical ? a.y : a.y + a.h / 2;
    const x1 = vertical ? x0 : a.x + a.w;
    const y1 = vertical ? a.y + a.h : y0;
    if (Math.abs(elevationAt(x1, y1) - elevationAt(x0, y0)) / len > 0.03) {
      a.stairs = true;
      city.stairs.push({ x: a.x, y: a.y, w: a.w, h: a.h, vehicleOnly: true });
    }
  }
}

// ---------------------------------------------------------------------------
// VETRINE, OSPEDALI, OFFICINE, BANDE
// ---------------------------------------------------------------------------

export function doorPoint(b, edge) {
  const nx = edge === 'left' ? -1 : edge === 'right' ? 1 : 0;
  const ny = edge === 'top' ? -1 : edge === 'bottom' ? 1 : 0;
  const x = edge === 'left' ? b.x : edge === 'right' ? b.x + b.w : b.x + b.w / 2;
  const y = edge === 'top' ? b.y : edge === 'bottom' ? b.y + b.h : b.y + b.h / 2;
  return { x: x + nx * DOOR_OUT, y: y + ny * DOOR_OUT, nx, ny, edge };
}

export function shopCandidate(b) {
  return b.edges?.length && !b.landmark && !b.flat && !b.transitEntrance && b.w >= 40 && b.h >= 40 && b.style !== 'container';
}

function makeShop(city, rng, b, edge, id, mix) {
  const door = doorPoint(b, edge);
  const levels = Math.max(1, Math.min(4, 1 + Math.floor((b.h3d - 30) / 46)));
  const biz = [id];
  for (let i = 1; i < levels; i++) biz.push(rng.pick(mix.upper));
  const first = BUSINESSES[id] || BUSINESSES.conv;
  const s = {
    id: city.shops.length, x: door.x, y: door.y, nx: door.nx, ny: door.ny, edge, w: b.w, h: b.h, building: b,
    district: b.district, districtName: b.districtName, districtHangul: b.districtHangul, biz, name: first.label, hangul: first.hangul,
    blip: first.blip || null, seed: (city.seed + b.x * 7919 + b.y * 104729 + city.shops.length * 31) >>> 0,
  };
  b.shop = s;
  city.shops.push(s);
  return s;
}

function retitleShop(s, id) {
  const b = BUSINESSES[id];
  if (!b) return;
  s.biz[0] = id; s.name = b.label; s.hangul = b.hangul; s.blip = b.blip || null;
}

export function placeShops(city, districts) {
  const byId = Object.fromEntries(districts.map((d) => [d.id, d]));
  const rng = new Rng((city.seed ^ 0x5e0c1) >>> 0);
  const doors = new SpatialGrid(city.w, city.h, 160);
  const near = [];
  city.shops = [];
  for (const b of city.buildings) {
    if (!shopCandidate(b)) continue;
    const d = byId[b.district];
    if (!d || !rng.chance((d.signDensity || 0.4) * 0.9 * (d.shopScale ?? 1))) continue;
    const mix = mixOf(d);
    const edge = rng.pick(b.edges);
    const p = doorPoint(b, edge);
    doors.queryCircle(p.x, p.y, 80, near);
    if (near.some((q) => (q.px - p.x) ** 2 + (q.py - p.y) ** 2 < 80 * 80)) continue;
    const s = makeShop(city, rng, b, edge, rng.pick(mix.ground), mix);
    doors.insertRect({ x: p.x - 1, y: p.y - 1, w: 2, h: 2, px: s.x, py: s.y });
  }
  for (const h of city.hospitals) {
    let best = null;
    let bd = Infinity;
    for (const b of city.buildings) {
      if (!shopCandidate(b) || b.district !== h.district) continue;
      const dd = (b.x + b.w / 2 - h.x) ** 2 + (b.y + b.h / 2 - h.y) ** 2;
      if (dd < bd) { bd = dd; best = b; }
    }
    if (!best) continue;
    if (best.shop) retitleShop(best.shop, 'clinic');
    else makeShop(city, rng, best, rng.pick(best.edges), 'clinic', mixOf(byId[best.district]));
    h.x = best.shop.x; h.y = best.shop.y; h.shop = best.shop;
  }
  const have = new Set(city.shops.filter((s) => s.biz[0] === 'pawn').map((s) => s.district));
  for (const d of districts) {
    if (have.has(d.id)) continue;
    // Prima si prova a cambiare mestiere a una vetrina che c'è, poi se ne apre una.
    const cand = city.shops.filter((s) => s.district === d.id && s.biz[0] !== 'clinic' && s.biz[0] !== 'guns');
    if (cand.length) { retitleShop(cand[0], 'pawn'); continue; }
    const b = city.buildings.find((q) => shopCandidate(q) && !q.shop && q.district === d.id);
    if (b) makeShop(city, rng, b, rng.pick(b.edges), 'pawn', mixOf(d));
  }
}

export function placeGarages(city, districts) {
  city.garages = [];
  for (const d of districts) {
    let best = null;
    let edge = null;
    let bd = Infinity;
    for (const b of city.buildings) {
      if (!shopCandidate(b) || b.shop || b.garage || b.district !== d.id) continue;
      for (const e of b.edges) {
        const span = e === 'top' || e === 'bottom' ? b.w : b.h;
        if (span < 84) continue;
        const dd = (b.x + b.w / 2 - d.seed.x * city.w) ** 2 + (b.y + b.h / 2 - d.seed.y * city.h) ** 2;
        if (dd < bd) { bd = dd; best = b; edge = e; }
      }
    }
    if (!best) continue;
    best.garage = true;
    const p = doorPoint(best, edge);
    const horiz = edge === 'top' || edge === 'bottom';
    const w = horiz ? 78 : 56;
    const h = horiz ? 56 : 78;
    const cx = p.x + p.nx * 16;
    const cy = p.y + p.ny * 16;
    city.garages.push({ x: cx - w / 2, y: cy - h / 2, w, h, cx, cy, edge, horiz, door: { x: p.x, y: p.y }, building: best, district: d.id, name: d.name });
  }
}

export function placeHospitalsAndPolice(city, districts) {
  city.hospitals = [];
  city.stations = [];
  for (const d of districts) {
    const pool = city.buildings.filter((b) => b.district === d.id && b.edges?.length && !b.landmark && b.w >= 70 && b.h >= 60);
    if (!pool.length) continue;
    const tx = d.seed.x * city.w;
    const ty = d.seed.y * city.h;
    pool.sort((a, b) => ((a.x + a.w / 2 - tx) ** 2 + (a.y + a.h / 2 - ty) ** 2) - ((b.x + b.w / 2 - tx) ** 2 + (b.y + b.h / 2 - ty) ** 2));
    const hospital = pool[0];
    hospital.hospital = true;
    const hp = doorPoint(hospital, hospital.edges[0]);
    city.hospitals.push({ x: hp.x, y: hp.y, district: d.id, name: d.name, districtName: d.name, districtHangul: d.hangul });
    const police = pool.find((b) => b !== hospital && (b.x - hospital.x) ** 2 + (b.y - hospital.y) ** 2 > 320 * 320) || pool[1];
    if (police) {
      police.station = true;
      const pp = doorPoint(police, police.edges[police.edges.length - 1]);
      city.stations.push({ x: pp.x, y: pp.y, district: d.id, name: d.name, districtName: d.name, districtHangul: d.hangul });
    }
  }
}

/**
 * Cortili delle bande. `anchors` = [gangId, districtId, luogo]. Il cortile è lo
 * yard più grande del distretto che sia sicuro (non tagli strade, non sia un
 * vicolo): il passo `blocklife` lo conosce e ne tiene libero il centro.
 */
export function placeTurfs(city, gangs, anchors) {
  city.turfs = [];
  const rng = new Rng((city.seed ^ 0x9a11d) >>> 0);
  const taken = new Set();
  for (const [gangId, districtId, place] of anchors) {
    const g = gangs.find((q) => q.id === gangId);
    if (!g) continue;
    let best = null;
    let by = null;
    let bs = 0;
    for (const b of city.blocks) {
      if (b.district !== districtId || taken.has(b)) continue;
      if (b.type !== 'urban' && b.type !== 'dock') continue;
      for (const y of b.yards) {
        if (y.turfSafe === false || y.through) continue;
        if (y.w < 100 || y.h < 74) continue;
        const s = Math.min(y.w, 260) * Math.min(y.h, 200);
        if (s > bs) { bs = s; best = b; by = y; }
      }
    }
    if (!best) continue;
    taken.add(best);
    const t = {
      x: by.x, y: by.y, w: by.w, h: by.h, cx: by.x + by.w / 2, cy: by.y + by.h / 2,
      gang: g.id, name: g.name, hangul: g.hangul, color: g.color, trade: g.trade,
      place: place || (best.type === 'dock' ? 'Il piazzale dei container' : 'Il cortile dietro il locale'),
      district: districtId, tag: rng.int(0, 3),
    };
    best.turf = t;
    city.turfs.push(t);
    for (let i = 0; i < 4; i++) city.props.push({ type: i % 2 ? 'crate' : 'drum', x: by.x + rng.range(16, Math.max(17, by.w - 16)), y: by.y + rng.range(16, Math.max(17, by.h - 16)), rot: rng.range(0, 6.28), z: 26, solid: true, r: 12 });
  }
}

// ---------------------------------------------------------------------------
// LANDMARK E FERMATE
// ---------------------------------------------------------------------------

/** Il nodo stradale utilizzabile più vicino a un punto, libero da solidi. */
export function nearestRoadPoint(city, tx, ty, { avoid = null, minGap = 22 } = {}) {
  let best = null;
  let bd = Infinity;
  let fallback = null;
  let fd = Infinity;
  for (const n of city.graph.usableNodes) {
    if (city.isWater(n.x, n.y)) continue;
    if (avoid && avoid.has(n)) continue;
    const dd = (n.x - tx) ** 2 + (n.y - ty) ** 2;
    if (dd < fd) { fd = dd; fallback = n; }
    const blocked = city.buildings.some((b) => b.solid && n.x > b.x - minGap && n.x < b.x + b.w + minGap && n.y > b.y - minGap && n.y < b.y + b.h + minGap);
    if (!blocked && dd < bd) { bd = dd; best = n; }
  }
  const chosen = best || fallback;
  return chosen ? { x: chosen.x, y: chosen.y, node: chosen } : { x: tx, y: ty, node: null };
}

/**
 * Lotto per un landmark: il più vicino all'ancora fra gli isolati che lo contengono
 * senza toccare strade né acqua; si liberano solo gli edifici procedurali che
 * stanno sotto. Se nessun isolato basta si cerca a spirale un vuoto.
 */
export function landmarkSite(city, spec) {
  const wanted = { x: spec.target[0] * city.w, y: spec.target[1] * city.h };
  const lots = city.blocks
    .filter((b) => b.type !== 'airport' && b.type !== 'port' && b.w >= spec.w + 20 && b.h >= spec.h + 20 && (!spec.types || spec.types.includes(b.type)))
    .map((b) => ({ block: b, score: (b.x + b.w / 2 - wanted.x) ** 2 + (b.y + b.h / 2 - wanted.y) ** 2 + (b.district === spec.district || !spec.district ? 0 : 900 * 900) }))
    .sort((a, b) => a.score - b.score);
  const dry = (rect) => {
    for (const fy of [0.04, 0.5, 0.96]) for (const fx of [0.04, 0.5, 0.96]) if (city.isWater(rect.x + rect.w * fx, rect.y + rect.h * fy)) return false;
    return true;
  };
  for (const { block } of lots) {
    const rect = { x: block.x + (block.w - spec.w) / 2, y: block.y + (block.h - spec.h) / 2, w: spec.w, h: spec.h };
    if (rectIntersectsRoad(city, rect, 12) || !dry(rect)) continue;
    if (city.buildings.some((b) => b.landmark && rectsOverlap(rect, b, 18))) continue;
    city.buildings = city.buildings.filter((b) => b.landmark || !rectsOverlap(rect, b, 14));
    city.props = city.props.filter((p) => !rectsOverlap(rect, { x: p.x - (p.r || 0), y: p.y - (p.r || 0), w: (p.r || 0) * 2, h: (p.r || 0) * 2 }, 10));
    block.landmarkId = spec.id;
    return rect;
  }
  const candidate = (cx, cy) => {
    const rect = { x: cx - spec.w / 2, y: cy - spec.h / 2, w: spec.w, h: spec.h };
    if (rect.x < 72 || rect.y < 72 || rect.x + rect.w > city.w - 72 || rect.y + rect.h > city.h - 72) return null;
    if (!dry(rect) || rectIntersectsRoad(city, rect, 12)) return null;
    if (city.buildings.some((b) => b.solid && rectsOverlap(rect, b, 8))) return null;
    if (city.props.some((p) => p.solid && rectsOverlap(rect, { x: p.x - (p.r || 0), y: p.y - (p.r || 0), w: (p.r || 0) * 2, h: (p.r || 0) * 2 }, 5))) return null;
    return rect;
  };
  for (let radius = 0; radius <= 1800; radius += 24) {
    const count = radius ? Math.max(16, Math.ceil((Math.PI * 2 * radius) / 32)) : 1;
    for (let i = 0; i < count; i++) {
      const a = radius ? (Math.PI * 2 * i) / count : 0;
      const found = candidate(wanted.x + Math.cos(a) * radius, wanted.y + Math.sin(a) * radius);
      if (found) return found;
    }
  }
  throw new Error(`Nessun lotto libero per il landmark ${spec.id}`);
}

export function addLandmarks(city, specs, region) {
  city.landmarks = city.landmarks || [];
  for (const spec of specs) {
    const site = spec.rect || landmarkSite(city, spec);
    const d = city.districtById[spec.district];
    const rng = new Rng((city.seed ^ (spec.id.length * 811 + spec.id.charCodeAt(0) * 31)) >>> 0);
    const b = makeBuilding(rng, d, region, site.x, site.y, site.w, site.h, { style: spec.style, h3d: spec.h3d, color: spec.color, roofColor: spec.roofColor, landmark: true, signChance: 0, ac: 0, water: false, solid: spec.solid !== false, streetEdges: [] });
    b.name = spec.name; b.hangul = spec.hangul; b.label = spec.label; b.kind = spec.kind;
    if (spec.flat) { b.flat = true; b.h3d = spec.h3d; }
    city.buildings.push(b);
    city.landmarks.push({ id: spec.id, name: spec.name, hangul: spec.hangul, label: spec.label, kind: spec.kind, district: spec.district, region, x: b.x + b.w / 2, y: b.y + b.h / 2, building: b });
  }
}

/** Fermate: ognuna sul nodo stradale più vicino alla posizione editoriale. */
export function addTransit(city, specs, region) {
  city.transitStations = [];
  city.metroEntrances = [];
  const used = new Set();
  for (const spec of specs) {
    const p = nearestRoadPoint(city, spec.target[0] * city.w, spec.target[1] * city.h, { avoid: used });
    if (p.node) used.add(p.node);
    const station = { id: spec.id, name: spec.name, label: spec.label, hangul: spec.hangul, x: p.x, y: p.y, arrivalX: p.x, arrivalY: p.y, lines: [...spec.lines], region };
    city.transitStations.push(station);
    // x/y sono il centro: `regions.reindex` sposta poi il vano sul marciapiede.
    city.metroEntrances.push({ x: p.x, y: p.y, w: 56, h: 36, stationId: station.id, name: spec.name, hangul: spec.hangul, region });
    city.props.push({ type: 'busstop', x: p.x, y: p.y - 34, rot: 0, z: 44, solid: false, r: 20, stationId: station.id, transit: true });
  }
  city.transitEntrances = city.metroEntrances;
}

export function indexCity(city, elevationAt) {
  city.buildingGrid = new SpatialGrid(city.w, city.h, 300);
  city.solidGrid = new SpatialGrid(city.w, city.h, 260);
  for (const b of city.buildings) {
    if (!b.flat && elevationAt) b.elev = elevationAt(b.x + b.w / 2, b.y + b.h / 2);
    city.buildingGrid.insertRect(b);
    if (b.solid !== false) city.solidGrid.insertRect(b);
  }
  city.propGrid = new SpatialGrid(city.w, city.h, 220);
  for (const p of city.props) {
    const box = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2, prop: p };
    city.propGrid.insertRect(box);
    if (p.solid) city.solidGrid.insertRect({ ...box, solid: true });
  }
  for (const s of city.stairs || []) city.solidGrid.insertRect(s);
  city.blockGrid = new SpatialGrid(city.w, city.h, 400);
  for (const b of city.blocks) city.blockGrid.insertRect(b);
}

export function makeStats(city) {
  return {
    buildings: city.buildings.length, props: city.props.length, blocks: city.blocks.length, nodes: city.graph.usableNodes.length, edges: city.graph.edges.length,
    doglegs: city.doglegs || 0, stairs: city.stairs.length, shops: city.shops.length, venues: city.shops.reduce((n, s) => n + s.biz.length, 0), garages: city.garages.length,
    rural: city.blocks.filter((b) => b.type === 'rural').length, piers: city.piers.length, turfs: city.turfs.length, landmarks: city.landmarks.length, transitStations: city.transitStations.length,
  };
}
