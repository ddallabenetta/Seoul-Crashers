// Vita negli isolati (§5.39).
//
// Parchi, campi, moli e marciapiedi nascevano tutti uguali: venti alberi e un
// sentiero, quattro file di container, un lampione ogni tanto. Qui ogni blocco
// sceglie una **tipologia** (stagno, campo da basket, 정자, area giochi, mercato,
// orti, serre, frutteto, risaia…) e le strade ricevono l'arredo che gli mancava.
//
// Vincolo che governa tutto: questo passo gira **dopo** la generazione, sui dati
// già pronti, e ha rng suoi — uno per blocco, derivato dalla posizione. Non
// consuma un numero dell'rng principale (new Rng(20260730)) né di `placeShops`,
// quindi maglia, negozi e indirizzi delle missioni restano dove sono. Nessuna
// funzione conosce coordinate di una regione: lavorano su qualunque blocco, così
// valgono anche per Busan, Jeju e la campagna quando verranno rifatte.
import { Rng } from '../core/rng.js';
import { SpatialGrid } from '../core/spatial.js';
import { rectIntersectsRoad } from './roadclearance.js';
import { SIGN_WORDS } from './districts.js';

const SALT = 0x5eb1fe;
const SIDEWALK = 20; // come citygen: la fascia di marciapiede attorno a un isolato

const mix = (a, b) => Math.imul((a ^ (b + 0x9e3779b9 + (a << 6) + (a >>> 2))) >>> 0, 2654435761) >>> 0;
/** Un rng per blocco: dipende dalla posizione, non dall'ordine di visita. */
function blockRng(b, salt) {
  return new Rng(mix(mix(SALT, Math.round(b.x)), mix(Math.round(b.y), salt)));
}

// Insegne nuove, per regione. Le parole generiche sono quelle di Seoul.
const PORT_WORDS = ['물류', '창고', '해운', '냉동창고', '수산', '세관', '택배', '컨테이너'];
const REGION_WORDS = {
  busan: ['횟집', '돼지국밥', '밀면', '수산', '씨앗호떡', '노래방', '편의점', '호텔'],
  jeju: ['흑돼지', '감귤', '해녀', '전복', '카페', '편의점', '민박', '렌터카'],
};
const NO_SIGN_STYLES = new Set(['container', 'greenhouse', 'wall', 'hill', 'tower']);

const FURNITURE = new Set(['bin', 'hydrant', 'bench', 'vending', 'kiosk', 'busstop', 'mailbox', 'bikerack', 'planter', 'barrier']);

// ---------------------------------------------------------------------------
// CONTESTO: verifiche di spazio e inserimenti
// ---------------------------------------------------------------------------

function makeCtx(city) {
  const keep = new SpatialGrid(city.w, city.h, 200);
  const keepRect = (x, y, w, h, pad = 0) => keep.insertRect({ x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 });
  const keepCircle = (x, y, r) => keepRect(x - r, y - r, r * 2, r * 2);

  // Tutto quello che una missione, un negozio o il traffico va a cercare per
  // nome o per posizione: l'arredo nuovo ci sta lontano.
  for (const s of city.shops || []) keepCircle(s.x, s.y, 40);
  for (const e of city.metroEntrances || []) {
    keepRect(e.x - (e.w || 86) / 2, e.y - (e.h || 58) / 2, e.w || 86, e.h || 58, 44);
    if (typeof e.approachX === 'number') keepCircle(e.approachX, e.approachY, 40);
  }
  for (const s of city.transitStations || []) {
    keepCircle(s.x, s.y, 44);
    if (typeof s.arrivalX === 'number') keepCircle(s.arrivalX, s.arrivalY, 48);
  }
  for (const g of city.garages || []) {
    keepRect(g.x, g.y, g.w, g.h, 24);
    if (g.door) keepCircle(g.door.x, g.door.y, 40);
  }
  // Il cortile di una banda si tiene libero **al centro**, dove si sgombra e si resta
  // sei secondi (§5.31); sui margini l'arredo può starci.
  for (const t of city.turfs || []) keepRect(t.x + t.w * 0.22, t.y + t.h * 0.22, t.w * 0.56, t.h * 0.56, 4);
  for (const h of city.hospitals || []) keepCircle(h.x, h.y, 90);
  for (const l of city.landmarks || []) keepCircle(l.x, l.y, 60);
  for (const a of city.airSpots || []) keepCircle(a.x, a.y, 70);
  for (const a of city.boatSpots || []) keepCircle(a.x, a.y, 60);
  for (const c of city.crosswalks || []) keepRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 16);
  for (const s of city.stairs || []) keepRect(s.x, s.y, s.w, s.h, 14);

  // Stalli del traffico: stessa formula di `traffic.collectParkingSpots`, ma si
  // riservano **tutte** le posizioni possibili (lì ne sopravvive il 60%).
  for (const b of city.blocks) {
    const areas = [];
    if (b.type === 'dock') areas.push(...b.yards);
    else {
      if (b.courtyard && b.reachable) areas.push(b.courtyard);
      for (const a of b.alleys || []) areas.push(a);
    }
    for (const y of areas) {
      if (y.w < 62 || y.h < 52) continue;
      const alongX = y.w >= y.h;
      const count = Math.min(5, Math.floor((alongX ? y.w : y.h) / 46));
      for (let i = 0; i < count; i++) {
        const sx = alongX ? y.x + 23 + i * 46 : y.x + Math.min(24, y.w * 0.35);
        const sy = alongX ? y.y + Math.min(24, y.h * 0.35) : y.y + 23 + i * 46;
        keepCircle(sx, sy, 30);
      }
    }
  }

  const added = { props: [], buildings: [] };
  const buf = [];
  const ctx = {
    city, added,
    gone: new Set(),
    keep,
    /** Rettangolo libero per qualcosa di solido o ingombrante? */
    rectFree(x, y, w, h, { pad = 2, ignoreKeep = false } = {}) {
      if (x < 100 || y < 100 || x + w > city.w - 100 || y + h > city.h - 100) return false;
      const cx = x + w / 2, cy = y + h / 2;
      if (city.isWater(cx, cy) || city.isWater(x, y) || city.isWater(x + w, y + h)) return false;
      if (rectIntersectsRoad(city, { x, y, w, h }, 2)) return false;
      for (const b of city.buildingGrid.queryRect(x - pad, y - pad, w + pad * 2, h + pad * 2, buf)) {
        if (b.solid === false || b.isBelt) continue;
        if (x < b.x + b.w + pad && x + w > b.x - pad && y < b.y + b.h + pad && y + h > b.y - pad) return false;
      }
      if (!ignoreKeep) {
        for (const k of keep.queryRect(x, y, w, h, buf)) {
          if (x < k.x + k.w && x + w > k.x && y < k.y + k.h && y + h > k.y) return false;
        }
      }
      return true;
    },
    /** Posto per un prop circolare di raggio r: libero da edifici, strade e altri prop. */
    room(x, y, r, { shrink = 1, ignoreKeep = false } = {}) {
      const rr = r * shrink;
      if (!this.rectFree(x - rr, y - rr, rr * 2, rr * 2, { pad: 1, ignoreKeep })) return false;
      for (const o of city.propGrid.queryRect(x - r - 14, y - r - 14, r * 2 + 28, r * 2 + 28, buf)) {
        const p = o.prop;
        if (!p || this.gone.has(p)) continue;
        const pr = p.type === 'lamp' ? 4 : p.r;
        if (Math.hypot(p.x - x, p.y - y) < (r + pr) * 0.85 + 1) return false;
      }
      return true;
    },
    addProp(type, x, y, r, opts = {}) {
      const p = { type, x, y, rot: opts.rot || 0, z: opts.z ?? 20, solid: !!opts.solid, r, life: true };
      for (const k of ['tint', 'word', 'accent']) if (opts[k] !== undefined) p[k] = opts[k];
      city.props.push(p);
      city.propGrid.insertRect({ x: x - r, y: y - r, w: r * 2, h: r * 2, prop: p });
      if (p.solid) city.solidGrid.insertRect({ x: x - r, y: y - r, w: r * 2, h: r * 2, prop: p, solid: true });
      added.props.push(p);
      return p;
    },
    /** Prop se c'è posto, altrimenti niente. */
    tryProp(type, x, y, r, opts = {}) {
      if (!this.room(x, y, r, opts)) return null;
      return this.addProp(type, x, y, r, opts);
    },
    addBuilding(b) {
      b.elev = city.elevationAt ? city.elevationAt(b.x + b.w / 2, b.y + b.h / 2) : 0;
      city.buildings.push(b);
      city.buildingGrid.insertRect(b);
      city.solidGrid.insertRect(b);
      added.buildings.push(b);
      return b;
    },
    /** Toglie dal blocco i prop ordinari che stanno sotto una tipologia. */
    clearRect(x, y, w, h, field = false) {
      for (const o of city.propGrid.queryRect(x, y, w, h, [])) {
        const p = o.prop;
        if (!p || this.gone.has(p)) continue;
        // In un campo un condizionatore non ha senso: le unità dei cortili di Jeju
        // finivano in mezzo ai frutteti.
        const ok = field ? ['tree', 'bin', 'pallet', 'barrier', 'ac_unit'] : ['tree', 'bench', 'bin', 'pallet', 'barrier', 'bush'];
        if (p.solid && p.type !== 'ac_unit') continue;
        if (!ok.includes(p.type)) continue;
        if (p.x > x && p.x < x + w && p.y > y && p.y < y + h) this.gone.add(p);
      }
    },
    /** Qualcosa di solido già dentro il rettangolo (esclusi gli alberi)? */
    hasSolid(x, y, w, h, withProps = true) {
      for (const b of city.buildingGrid.queryRect(x, y, w, h, [])) {
        if (b.solid === false || b.isBelt) continue;
        if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return true;
      }
      if (!withProps) return false;
      for (const o of city.propGrid.queryRect(x, y, w, h, [])) {
        const p = o.prop;
        if (!p || !p.solid || this.gone.has(p)) continue;
        if (p.x > x - p.r && p.x < x + w + p.r && p.y > y - p.r && p.y < y + h + p.r) return true;
      }
      return false;
    },
  };
  return ctx;
}

function litBuilding(rng, block, x, y, w, h, style, h3d, color) {
  const d = block.districtRef;
  return {
    x, y, w, h, h3d, elev: 0, style, color,
    roofColor: d?.roof || '#4a4f56',
    variant: rng.int(0, 3), litSeed: rng.int(0, 9999),
    district: block.district, solid: true, signs: [], edges: [],
    landmark: false, ac: 0, water: false, life: true,
  };
}

const areaOf = (city, b) => city.areaAt?.(b.x + b.w / 2, b.y + b.h / 2)?.id || 'campagna';

// ---------------------------------------------------------------------------
// PARCHI
// ---------------------------------------------------------------------------

/** Alberi sparsi nell'area interna, fuori dai rettangoli già dipinti. */
function scatterTrees(ctx, rng, I, avoid, n) {
  let guard = n * 6;
  while (n > 0 && guard-- > 0) {
    const x = I.x + rng.range(10, I.w - 10);
    const y = I.y + rng.range(10, I.h - 10);
    if (avoid.some((a) => x > a.x - 12 && x < a.x + a.w + 12 && y > a.y - 12 && y < a.y + a.h + 12)) continue;
    if (ctx.tryProp('tree', x, y, 13, { rot: rng.range(0, 6.28), z: rng.range(46, 82), tint: rng.int(0, 2) })) n--;
  }
}

function ringPath(cx, cy, rx, ry) {
  const pts = [];
  for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return pts;
}

/** Sentiero dal bordo del blocco più vicino al punto dato fino al punto. */
function spur(B, x, y) {
  const d = [[Math.abs(x - B.x), [B.x, y]], [Math.abs(B.x + B.w - x), [B.x + B.w, y]], [Math.abs(y - B.y), [x, B.y]], [Math.abs(B.y + B.h - y), [x, B.y + B.h]]];
  d.sort((a, b) => a[0] - b[0]);
  return { kind: 'path', pts: [d[0][1], [x, y]], w: 8 };
}

const PARK_TYPES = {
  pond: {
    w: 1.0, min: [140, 120],
    build(ctx, rng, B, I, out) {
      const rw = Math.min(I.w * 0.6, 150), rh = Math.min(I.h * 0.5, 110);
      const cx = I.x + I.w / 2 + rng.range(-I.w * 0.08, I.w * 0.08), cy = I.y + I.h / 2 + rng.range(-I.h * 0.08, I.h * 0.08);
      const pond = { kind: 'pond', x: cx - rw / 2, y: cy - rh / 2, w: rw, h: rh, seed: Math.round(cx + cy) };
      const area = { x: pond.x - 14, y: pond.y - 14, w: rw + 28, h: rh + 28 };
      ctx.clearRect(area.x - 30, area.y - 30, area.w + 60, area.h + 60);
      out.decor.push(spur(B, cx, cy - rh / 2 - 24), { kind: 'path', pts: ringPath(cx, cy, rw / 2 + 22, rh / 2 + 22), w: 7 }, pond);
      out.avoid.push({ x: pond.x - 10, y: pond.y - 10, w: rw + 20, h: rh + 20 });
      const nR = rng.int(5, 8);
      for (let i = 0; i < nR; i++) {
        const a = rng.range(0, 6.28);
        ctx.tryProp('rock', cx + Math.cos(a) * (rw / 2 + 6), cy + Math.sin(a) * (rh / 2 + 6), 9, { rot: a, z: 12, shrink: 0.6 });
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.28 + rng.range(-0.3, 0.3);
        ctx.tryProp('bush', cx + Math.cos(a) * (rw / 2 + 36), cy + Math.sin(a) * (rh / 2 + 34), 12, { z: 18, tint: rng.int(0, 2) });
      }
      for (const s of [-1, 1]) ctx.tryProp('bench', cx + s * (rw / 2 + 24), cy + rng.range(-8, 8), 14, { rot: Math.PI / 2, z: 14 });
      return 5;
    },
  },
  court: {
    w: 1.2, min: [120, 84],
    build(ctx, rng, B, I, out) {
      const football = I.w >= 190 && I.h >= 130 && rng.chance(0.5);
      let cw = football ? Math.min(I.w - 50, 170) : 98, ch = football ? Math.min(I.h - 50, 100) : 58;
      if (!football && I.h > I.w * 1.15) [cw, ch] = [ch, cw]; // un blocco alto ha il campo in piedi
      const cx = I.x + I.w / 2, cy = I.y + I.h / 2;
      const court = { kind: 'court', x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch, sport: football ? 'football' : 'basket', tint: rng.chance(0.5) ? 1 : 0 };
      const apron = { kind: 'plaza', x: court.x - 14, y: court.y - 14, w: cw + 28, h: ch + 28, col: '#74736f', tile: 14 };
      ctx.clearRect(apron.x - 10, apron.y - 10, apron.w + 20, apron.h + 20);
      out.decor.push(apron, court);
      out.avoid.push(apron);
      const horiz = cw >= ch;
      const end = (s) => (horiz ? [court.x + (s > 0 ? cw - 4 : 4), cy, s > 0 ? Math.PI : 0] : [cx, court.y + (s > 0 ? ch - 4 : 4), s > 0 ? -Math.PI / 2 : Math.PI / 2]);
      for (const s of [-1, 1]) {
        const [x, y, a] = end(s);
        // Il tabellone resta nel campo, non sulla rete: shrink alto, è un oggetto sottile.
        const type = football ? 'goal' : 'hoop';
        ctx.addProp(type, x + (horiz ? (s > 0 ? -6 : 6) : 0), y + (horiz ? 0 : (s > 0 ? -6 : 6)), 12, { rot: a, z: football ? 14 : 44 });
      }
      for (const s of [-1, 1]) {
        ctx.tryProp('bench', cx + (horiz ? s * cw * 0.25 : s * (cw / 2 + 24)), cy + (horiz ? s * (ch / 2 + 24) : s * ch * 0.25), 14, { rot: horiz ? 0 : Math.PI / 2, z: 14 });
      }
      ctx.tryProp('bin', court.x - 20, court.y - 20, 9, { z: 22 });
      ctx.tryProp('bin', court.x + cw + 20, court.y + ch + 20, 9, { z: 22 });
      return 4;
    },
  },
  pavilion: {
    w: 0.9, min: [130, 130],
    build(ctx, rng, B, I, out) {
      const s = Math.min(I.w * 0.75, I.h * 0.75, 150);
      const cx = I.x + I.w / 2, cy = I.y + I.h / 2;
      const plaza = { kind: 'plaza', x: cx - s / 2, y: cy - s / 2, w: s, h: s, col: '#8b8678', tile: 18, ring: true };
      ctx.clearRect(plaza.x - 14, plaza.y - 14, s + 28, s + 28);
      out.decor.push(spur(B, cx, cy), plaza);
      out.avoid.push(plaza);
      ctx.addProp('pavilion', cx, cy, 40, { z: 46, rot: 0 });
      for (const [dx, dy, a] of [[0, -s / 2 + 8, 0], [0, s / 2 - 8, 0], [-s / 2 + 8, 0, Math.PI / 2], [s / 2 - 8, 0, Math.PI / 2]]) {
        ctx.tryProp('bench', cx + dx, cy + dy, 14, { rot: a, z: 14, shrink: 0.6 });
      }
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ctx.tryProp('planter', cx + dx * (s / 2 + 8), cy + dy * (s / 2 + 8), 11, { z: 14, tint: rng.int(0, 2) });
      return 6;
    },
  },
  playground: {
    w: 1.1, min: [120, 100],
    build(ctx, rng, B, I, out) {
      const w = Math.min(I.w * 0.8, 124), h = Math.min(I.h * 0.7, 88);
      const cx = I.x + I.w / 2, cy = I.y + I.h / 2;
      const pit = { kind: 'sandpit', x: cx - w / 2, y: cy - h / 2, w, h, tint: rng.int(0, 1), seed: Math.round(cx) };
      const fence = { kind: 'fence', x: pit.x - 12, y: pit.y - 12, w: w + 24, h: h + 24 };
      ctx.clearRect(fence.x - 10, fence.y - 10, fence.w + 20, fence.h + 20);
      out.decor.push(spur(B, cx, cy + h / 2 + 12), fence, pit);
      out.avoid.push(fence);
      ctx.addProp('swing', pit.x + 30, pit.y + 22, 20, { z: 30 });
      ctx.addProp('slide', pit.x + w - 34, pit.y + h * 0.62, 24, { z: 24, rot: rng.chance(0.5) ? 0 : Math.PI });
      ctx.addProp('seesaw', cx, pit.y + h - 14, 22, { z: 14 });
      for (const s of [-1, 1]) ctx.tryProp('bench', cx + s * w * 0.3, fence.y + fence.h + 12, 14, { z: 14 });
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ctx.tryProp('bush', cx + dx * (w / 2 + 22), cy + dy * (h / 2 + 22), 12, { z: 18, tint: rng.int(0, 2) });
      return 5;
    },
  },
  market: {
    w: 0.8, min: [190, 130],
    build(ctx, rng, B, I, out) {
      const w = Math.min(I.w - 8, 300), h = Math.min(I.h - 8, 176);
      const cx = I.x + I.w / 2, cy = I.y + I.h / 2;
      const plaza = { kind: 'plaza', x: cx - w / 2, y: cy - h / 2, w, h, col: '#6d6c68', tile: 22 };
      ctx.clearRect(plaza.x - 6, plaza.y - 6, w + 12, h + 12);
      out.decor.push(spur(B, cx, cy), plaza);
      out.avoid.push(plaza);
      const n = Math.max(2, Math.floor((w - 20) / 50));
      const x0 = plaza.x + (w - n * 50) / 2 + 25;
      for (let i = 0; i < n; i++) {
        // File affacciate: la merce guarda il corridoio centrale.
        if (rng.chance(0.88)) ctx.tryProp('stall', x0 + i * 50, plaza.y + 22, 16, { rot: Math.PI / 2, z: 26, solid: true, tint: rng.int(0, 3), shrink: 0.9 });
        if (rng.chance(0.88)) ctx.tryProp('stall', x0 + i * 50, plaza.y + h - 22, 16, { rot: -Math.PI / 2, z: 26, solid: true, tint: rng.int(0, 3), shrink: 0.9 });
      }
      // Un angolo di tavoli e ombrelloni per chi mangia.
      for (let i = 0; i < 3; i++) {
        const x = cx + (i - 1) * 62 + rng.range(-8, 8);
        ctx.tryProp('bedplat', x, cy, 22, { z: 14, shrink: 0.7 });
        if (rng.chance(0.7)) ctx.tryProp('parasol', x, cy - 2, 14, { z: 30, tint: rng.int(0, 3), ignoreKeep: false });
      }
      ctx.tryProp('crate', plaza.x + 10, cy - 14, 13, { z: 22, solid: true, rot: rng.range(0, 6.28) });
      ctx.tryProp('bin', plaza.x + w - 10, cy + 14, 9, { z: 22 });
      return 3;
    },
  },
  allotment: {
    w: 1.0, min: [120, 92],
    build(ctx, rng, B, I, out) {
      const w = Math.min(I.w - 14, 180), h = Math.min(I.h - 14, 124);
      const cols = Math.max(2, Math.floor(w / 44)), rows = Math.max(2, Math.floor(h / 34));
      const cx = I.x + I.w / 2, cy = I.y + I.h / 2;
      const plots = { kind: 'plots', x: cx - w / 2, y: cy - h / 2, w, h, cols, rows, seed: Math.round(cx) };
      ctx.clearRect(plots.x - 8, plots.y - 8, w + 16, h + 16);
      out.decor.push(spur(B, cx, cy), plots);
      out.avoid.push({ x: plots.x - 6, y: plots.y - 6, w: w + 12, h: h + 12 });
      ctx.tryProp('bedplat', plots.x + w + 18, cy - 10, 24, { z: 14, shrink: 0.7 });
      for (let i = 0; i < 3; i++) ctx.tryProp('drum', plots.x - 12, plots.y + 14 + i * (h / 3), 10, { z: 22 });
      ctx.tryProp('bush', plots.x + w + 14, plots.y + h + 12, 12, { z: 18, tint: rng.int(0, 2) });
      ctx.tryProp('orchard', plots.x - 18, plots.y + h + 14, 12, { z: 52, tint: 1 });
      return 5;
    },
  },
  plaza: {
    w: 0.8, min: [110, 100],
    build(ctx, rng, B, I, out) {
      const w = Math.min(I.w * 0.82, 190), h = Math.min(I.h * 0.8, 150);
      const cx = I.x + I.w / 2, cy = I.y + I.h / 2;
      const plaza = { kind: 'plaza', x: cx - w / 2, y: cy - h / 2, w, h, col: rng.chance(0.5) ? '#82807a' : '#7a7f86', tile: 16, ring: true };
      ctx.clearRect(plaza.x - 10, plaza.y - 10, w + 20, h + 20);
      out.decor.push(spur(B, cx, cy), plaza);
      out.avoid.push(plaza);
      const n = rng.int(4, 6);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28;
        const rx = w * 0.32, ry = h * 0.32;
        ctx.tryProp('bench', cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 14, { rot: a + Math.PI / 2, z: 14, shrink: 0.6 });
      }
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ctx.tryProp('planter', cx + dx * (w / 2 - 12), cy + dy * (h / 2 - 12), 11, { z: 14, tint: rng.int(0, 2) });
      ctx.tryProp('bikerack', cx + w / 2 - 28, cy, 18, { rot: Math.PI / 2, z: 12, shrink: 0.5 });
      ctx.tryProp('mailbox', cx - w / 2 + 12, cy + 4, 7, { z: 24 });
      ctx.tryProp('tree', cx, cy, 13, { z: 70, tint: rng.int(0, 2) });
      return 3;
    },
  },
  grove: {
    w: 0.25, min: [60, 60],
    build(ctx, rng, B, I, out) {
      // Il bosco resta bosco (alberi e sentiero di sempre), con macchie di cespugli
      // fioriti e qualche masso: niente `decor`, quindi il sentiero base resta.
      const n = Math.max(4, Math.floor((I.w * I.h) / 5000));
      for (let i = 0; i < n; i++) ctx.tryProp('bush', I.x + rng.range(10, I.w - 10), I.y + rng.range(10, I.h - 10), 12, { z: 18, tint: rng.int(0, 2) });
      for (let i = 0; i < 3; i++) ctx.tryProp('rock', I.x + rng.range(10, I.w - 10), I.y + rng.range(10, I.h - 10), 9, { z: 12, rot: rng.range(0, 6.28), shrink: 0.6 });
      out.keepPath = true;
      return 0;
    },
  },
};

function decoratePark(ctx, b, placed) {
  const city = ctx.city;
  if (b.hospital || b.station || b.restStop || b.life) return;
  // Un parco con un edificio dentro (N Seoul Tower) ha già il suo protagonista.
  if (ctx.hasSolid(b.x + 6, b.y + 6, b.w - 12, b.h - 12)) return;
  const rng = blockRng(b, 1);
  const m = 20;
  const I = { x: b.x + m, y: b.y + m, w: b.w - m * 2, h: b.h - m * 2 };
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;

  const names = Object.keys(PARK_TYPES).filter((k) => I.w + m >= PARK_TYPES[k].min[0] && I.h + m >= PARK_TYPES[k].min[1]);
  if (!names.length) names.push('grove');
  // Un parco accanto a uno stagno non fa uno stagno: pesa meno ogni vicino uguale.
  const weights = names.map((k) => {
    const same = placed.filter((q) => q.type === k && Math.hypot(q.cx - cx, q.cy - cy) < 900).length;
    return PARK_TYPES[k].w / (1 + 3 * same);
  });
  let pick = rng.next() * weights.reduce((a, c) => a + c, 0);
  let kind = names[names.length - 1];
  for (let i = 0; i < names.length; i++) { pick -= weights[i]; if (pick <= 0) { kind = names[i]; break; } }
  // Un isolato che una regione ha scelto come luogo (il piazzale di Seomyeon) non lo
  // decide il caso: `b.theme` vince, se la taglia lo permette.
  if (b.theme && names.includes(b.theme)) kind = b.theme;

  const out = { decor: [], avoid: [], keepPath: false };
  const nTrees = PARK_TYPES[kind].build(ctx, rng, b, I, out);
  if (out.decor.length && !out.keepPath) b.decor = out.decor;
  b.life = kind;
  placed.push({ type: kind, cx, cy });
  if (nTrees) scatterTrees(ctx, rng, I, out.avoid, Math.max(2, Math.floor((I.w * I.h) / 14000)) + nTrees - 4);
}

// ---------------------------------------------------------------------------
// CAMPAGNA
// ---------------------------------------------------------------------------

const RURAL_THEMES = {
  orchard: { seoul: 1, busan: 1.6, jeju: 3.2, campagna: 1.5 },
  greenhouse: { seoul: 1.2, busan: 2.2, jeju: 1.4, campagna: 1.5 },
  farm: { seoul: 1, busan: 1, jeju: 1, campagna: 1.5 },
  hay: { seoul: 1, busan: 0.8, jeju: 1, campagna: 1.2 },
  pasture: { seoul: 0.8, busan: 0.6, jeju: 1.6, campagna: 1.2 },
  paddy: { seoul: 1.4, busan: 1, jeju: 0.4, campagna: 2 },
};

function parcelOrchard(ctx, rng, b, f, area) {
  const vert = rng.chance(0.5);
  b.decor.push({ kind: 'grass', x: f.x + 3, y: f.y + 3, w: f.w - 6, h: f.h - 6, col: '#506f38', vert, step: 14 });
  const tint = area === 'jeju' ? 0 : rng.chance(0.5) ? 1 : 2;
  const sx = 40, sy = 38;
  const nx = Math.max(1, Math.floor((f.w - 20) / sx)), ny = Math.max(1, Math.floor((f.h - 20) / sy));
  const ox = f.x + (f.w - (nx - 1) * sx) / 2, oy = f.y + (f.h - (ny - 1) * sy) / 2;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (rng.chance(0.06)) continue;
    ctx.tryProp('orchard', ox + i * sx, oy + j * sy, 11, { z: 52, tint, shrink: 0.7 });
  }
}

function parcelGreenhouse(ctx, rng, b, f) {
  const n = Math.min(4, Math.max(2, Math.floor(f.h / 40)));
  const gh = Math.min(26, f.h / n - 9);
  if (gh < 14) return false;
  const y0 = f.y + (f.h - n * (gh + 9)) / 2 + 3;
  for (let k = 0; k < n; k++) {
    const x = f.x + 8, w = f.w - 16, y = y0 + k * (gh + 9);
    if (!ctx.rectFree(x, y, w, gh, { pad: 1 })) continue;
    ctx.addBuilding(litBuilding(rng, b, x, y, w, gh, 'greenhouse', rng.int(16, 24), '#c6d3c8'));
  }
  ctx.tryProp('drum', f.x + f.w - 8, f.y + f.h - 6, 10, { z: 22 });
  return true;
}

function parcelFarm(ctx, rng, b, f) {
  if (f.w < 110 || f.h < 90) return false;
  b.decor.push({ kind: 'dirt', x: f.x + 6, y: f.y + f.h * 0.45, w: f.w - 12, h: f.h * 0.5 - 6, seed: Math.round(f.x) });
  const hw = rng.range(52, Math.min(86, f.w * 0.42)), hh = rng.range(40, Math.min(60, f.h * 0.36));
  const hx = f.x + rng.range(8, f.w - hw - 8), hy = f.y + 10;
  if (ctx.rectFree(hx, hy, hw, hh, { pad: 2 })) ctx.addBuilding(litBuilding(rng, b, hx, hy, hw, hh, 'brick', rng.int(24, 34), '#a8715a'));
  const bw = rng.range(56, Math.min(100, f.w * 0.5)), bh = rng.range(34, 50);
  const bx = f.x + rng.range(8, Math.max(9, f.w - bw - 8)), by = f.y + f.h - bh - 10;
  if (ctx.rectFree(bx, by, bw, bh, { pad: 2 })) ctx.addBuilding(litBuilding(rng, b, bx, by, bw, bh, 'warehouse', rng.int(26, 40), '#8a8f94'));
  ctx.tryProp('silo', f.x + f.w - 20, f.y + f.h * 0.5, 16, { z: 74, solid: true });
  for (let i = 0; i < rng.int(1, 3); i++) ctx.tryProp('hay', f.x + rng.range(14, f.w - 14), f.y + f.h * rng.range(0.46, 0.7), 12, { z: 20, solid: true, tint: rng.int(0, 1) });
  ctx.tryProp('tree', f.x + 14, f.y + f.h * 0.55, 13, { z: 64, tint: rng.int(0, 2) });
  return true;
}

function parcelHay(ctx, rng, b, f) {
  // Stoppia falciata a strisce, con le balle lasciate dove la macchina le ha sputate.
  b.decor.push({ kind: 'grass', x: f.x + 3, y: f.y + 3, w: f.w - 6, h: f.h - 6, col: '#74703a', vert: rng.chance(0.5), step: 10 });
  const n = rng.int(3, 7);
  for (let i = 0; i < n; i++) ctx.tryProp('hay', f.x + rng.range(18, f.w - 18), f.y + rng.range(18, f.h - 18), 12, { z: 20, solid: true, tint: rng.chance(0.7) ? 0 : 1, shrink: 0.9 });
}

function parcelPasture(ctx, rng, b, f) {
  b.decor.push({ kind: 'grass', x: f.x + 3, y: f.y + 3, w: f.w - 6, h: f.h - 6, col: '#4a7a3c', vert: rng.chance(0.5), step: 18 });
  b.decor.push({ kind: 'fence', x: f.x + 6, y: f.y + 6, w: f.w - 12, h: f.h - 12 });
  ctx.tryProp('trough', f.x + f.w * 0.3, f.y + f.h * 0.5, 17, { z: 12, shrink: 0.6 });
  if (f.w > 140) ctx.tryProp('trough', f.x + f.w * 0.7, f.y + f.h * 0.35, 17, { z: 12, shrink: 0.6, rot: Math.PI / 2 });
  for (let i = 0; i < rng.int(2, 4); i++) ctx.tryProp('tree', f.x + rng.range(18, f.w - 18), f.y + rng.range(18, f.h - 18), 13, { z: 62, tint: rng.int(0, 2) });
  ctx.tryProp('hay', f.x + f.w - 22, f.y + f.h - 22, 12, { z: 20, solid: true, tint: 1 });
}

function parcelPaddy(ctx, rng, b, f) {
  b.decor.push({ kind: 'paddy', x: f.x + 2, y: f.y + 2, w: f.w - 4, h: f.h - 4 });
  b.decor.push({ kind: 'dirt', x: f.x + 2, y: f.y + f.h - 12, w: f.w - 4, h: 8, seed: Math.round(f.y) });
  if (rng.chance(0.4)) ctx.tryProp('bedplat', f.x + f.w - 28, f.y + f.h - 28, 22, { z: 14, shrink: 0.7 });
  if (rng.chance(0.5)) ctx.tryProp('rock', f.x + 12, f.y + 12, 9, { z: 12, shrink: 0.6 });
}

function decorateRural(ctx, b, placed) {
  const city = ctx.city;
  if (b.life || !b.fields || !b.fields.length) return;
  const rng = blockRng(b, 2);
  const area = areaOf(city, b);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const names = Object.keys(RURAL_THEMES);
  const weights = names.map((k) => {
    const same = placed.filter((q) => q.type === k && Math.hypot(q.cx - cx, q.cy - cy) < 1100).length;
    return (RURAL_THEMES[k][area] ?? 1) / (1 + 2.5 * same);
  });
  let pick = rng.next() * weights.reduce((a, c) => a + c, 0);
  let theme = names[0];
  for (let i = 0; i < names.length; i++) { pick -= weights[i]; if (pick <= 0) { theme = names[i]; break; } }
  b.decor = [];
  b.life = theme;
  placed.push({ type: theme, cx, cy });
  // Jeju: ogni campo è chiuso da un muretto di basalto (§5.41).
  if (area === 'jeju') {
    for (const f of b.fields) if (f.w >= 56 && f.h >= 56) b.decor.push({ kind: 'stonewall', x: f.x, y: f.y, w: f.w, h: f.h, seed: Math.round(f.x * 3 + f.y) });
  }

  for (const f of b.fields) {
    if (f.w < 56 || f.h < 56) continue;
    if (ctx.hasSolid(f.x, f.y, f.w, f.h, false)) continue; // cascina o serra già sul posto
    const roll = rng.next();
    const kind = roll < 0.66 ? theme : roll < 0.86 ? names[rng.int(0, names.length - 1)] : null;
    if (!kind) continue;
    ctx.clearRect(f.x, f.y, f.w, f.h, true);
    if (kind === 'orchard') parcelOrchard(ctx, rng, b, f, area);
    else if (kind === 'greenhouse') parcelGreenhouse(ctx, rng, b, f);
    else if (kind === 'farm') parcelFarm(ctx, rng, b, f);
    else if (kind === 'hay') parcelHay(ctx, rng, b, f);
    else if (kind === 'pasture') parcelPasture(ctx, rng, b, f);
    else parcelPaddy(ctx, rng, b, f);
  }
  if (!b.decor.length) delete b.decor;
}

// ---------------------------------------------------------------------------
// MOLI
// ---------------------------------------------------------------------------

const BOX_COLORS = ['#c8493a', '#3f7ea8', '#cf9a2f', '#4a8f5e', '#8f5aa8', '#b7532f', '#4f6f8f'];

function waterSide(city, b) {
  // Il lato che guarda l'acqua: si campiona appena fuori dal bordo.
  for (const d of [80, 160, 280]) {
    const probes = [
      ['right', b.x + b.w + d, b.y + b.h / 2], ['left', b.x - d, b.y + b.h / 2],
      ['bottom', b.x + b.w / 2, b.y + b.h + d], ['top', b.x + b.w / 2, b.y - d],
    ];
    for (const [side, x, y] of probes) if (city.isWater(x, y)) return side;
  }
  return null;
}

function decorateDock(ctx, b) {
  const city = ctx.city;
  if (b.life) return;
  const rng = blockRng(b, 3);
  b.life = 'dock';
  const pad = 14;
  const A = { x: b.x + pad, y: b.y + pad, w: b.w - pad * 2, h: b.h - pad * 2 };
  if (A.w < 70 || A.h < 70) return;
  b.decor = b.decor || [];

  // Insegne sui magazzini che ne sono privi: da fuori un capannone anonimo non
  // dice che cosa c'è dentro, un nome sì. Sul fronte e sul retro, perché la
  // faccia che si vede dipende da dove sta la camera.
  for (const o of city.buildingGrid.queryRect(b.x, b.y, b.w, b.h, [])) {
    if (o.style !== 'warehouse' || o.signs.length || o.h3d < 32 || o.life) continue;
    const sr = new Rng(mix(mix(SALT, Math.round(o.x)), Math.round(o.y) + 11));
    const edges = o.edges && o.edges.length ? o.edges : ['top', 'bottom'];
    const d = city.districtById?.[o.district];
    for (const edge of edges) {
      o.signs.push({ edge, t: sr.range(0.3, 0.7), word: sr.pick(PORT_WORDS), color: d?.accent || '#ffd23f', vertical: false, h: sr.range(0.45, 0.7) });
    }
    // Fascia a righe davanti ai portoni di carico.
    b.decor.push({ kind: 'stripes', x: o.x, y: o.y + o.h + 3, w: o.w, h: 6 });
  }

  // Gru a portale sul lato che guarda l'acqua (mai 'crane': M4 cerca il più vicino).
  // Si prova in più punti lungo il lato: il primo è spesso occupato dai container.
  const side = waterSide(city, b);
  if (side && rng.chance(0.85) && b.w > 150 && b.h > 150) {
    const L = 70;
    for (let k = 0; k < 10; k++) {
      const u = rng.range(0.15, 0.85);
      const spot = {
        right: [b.x + b.w - L, b.y + b.h * u, 0],
        left: [b.x + L, b.y + b.h * u, Math.PI],
        bottom: [b.x + b.w * u, b.y + b.h - L, Math.PI / 2],
        top: [b.x + b.w * u, b.y + L, -Math.PI / 2],
      }[side];
      if (ctx.tryProp('harborcrane', spot[0], spot[1], 22, { rot: spot[2], z: 60, shrink: 0.4 })) break;
    }
  }

  // Container impilati negli spazi che il reticolo originale lasciava vuoti:
  // gli stessi passi (40x92 + corsie), e anche di traverso. Mai sugli stalli.
  let boxes = 0;
  for (let i = 0; i < 12 && boxes < 12; i++) {
    for (let j = 0; j < 8 && boxes < 12; j++) {
      const horiz = rng.chance(0.3);
      const w = horiz ? 92 : 40, h = horiz ? 40 : 92;
      const x = A.x + 8 + i * 52, y = A.y + 10 + j * 108;
      if (x + w > A.x + A.w || y + h > A.y + A.h) continue;
      if (!rng.chance(0.55)) continue;
      if (!ctx.rectFree(x, y, w, h, { pad: 6 })) continue;
      const stack = rng.int(1, 3);
      const box = litBuilding(rng, b, x, y, w, h, 'container', 26 * stack, rng.pick(BOX_COLORS));
      box.roofColor = '#2c3336'; box.variant = stack;
      ctx.addBuilding(box);
      boxes++;
    }
  }

  // Mezzi e merce di piazzale: più numerosi su un molo grande, e si cerca il posto
  // (un piazzale pieno di container ne offre pochi, ma ne offre).
  const place = (type, r, opts) => {
    for (let k = 0; k < 14; k++) {
      const x = A.x + rng.range(20, A.w - 20), y = A.y + rng.range(20, A.h - 20);
      if (ctx.tryProp(type, x, y, r, opts())) return true;
    }
    return false;
  };
  const scale = Math.min(3, Math.max(1, Math.round((A.w * A.h) / 150000)));
  for (let i = 0; i < rng.int(2, 3) * scale; i++) {
    const t = rng.pick(['forklift', 'trolley', 'forklift', 'trolley', 'mobilecrane']);
    place(t, t === 'mobilecrane' ? 30 : 18, () => ({ rot: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), z: t === 'mobilecrane' ? 30 : 20, tint: rng.int(0, 2), shrink: 0.55 }));
  }
  for (let i = 0; i < rng.int(3, 6) * scale; i++) {
    const t = rng.pick(['pallet', 'crate', 'drum', 'barrier']);
    place(t, 12, () => ({ rot: rng.range(0, 6.28), z: t === 'pallet' ? 10 : 22, solid: t === 'crate' || t === 'drum' }));
  }
  if (!b.decor.length) delete b.decor;
}

// ---------------------------------------------------------------------------
// ARREDO URBANO E INSEGNE
// ---------------------------------------------------------------------------

/** Densità di arredo (oggetti per 1000 px di marciapiede) di una regione. */
function furnitureDensity(city, blocks) {
  const byArea = {};
  const edgeLen = {};
  for (const b of blocks) {
    const a = areaOf(city, b);
    edgeLen[a] = (edgeLen[a] || 0) + (b.w + b.h) * 2;
  }
  for (const p of city.props) {
    if (!FURNITURE.has(p.type) || p.life) continue;
    const a = city.areaAt?.(p.x, p.y)?.id || 'campagna';
    byArea[a] = (byArea[a] || 0) + 1;
  }
  const out = {};
  for (const a of Object.keys(edgeLen)) out[a] = ((byArea[a] || 0) / edgeLen[a]) * 1000;
  return out;
}

function signDensity(city) {
  const s = {};
  for (const b of city.buildings) {
    if (b.flat || b.isBelt || b.isBank || NO_SIGN_STYLES.has(b.style)) continue;
    const a = city.areaAt?.(b.x, b.y)?.id || 'campagna';
    const e = (s[a] ||= { n: 0, signs: 0 });
    e.n++; e.signs += b.signs.length;
  }
  const out = {};
  for (const [a, e] of Object.entries(s)) out[a] = e.signs / Math.max(1, e.n);
  return out;
}

const STREET_MIX = [
  ['bin', 0.2], ['hydrant', 0.13], ['bench', 0.13], ['mailbox', 0.1], ['bikerack', 0.1],
  ['planter', 0.1], ['vending', 0.1], ['busstop', 0.07], ['kiosk', 0.05], ['barrier', 0.02],
];
const STREET_SPEC = {
  bin: { r: 9, z: 22 }, hydrant: { r: 6, z: 16 }, bench: { r: 14, z: 14 }, mailbox: { r: 7, z: 24 },
  bikerack: { r: 17, z: 12 }, planter: { r: 11, z: 14 }, vending: { r: 12, z: 34, solid: true },
  busstop: { r: 20, z: 44 }, kiosk: { r: 18, z: 40, solid: true }, barrier: { r: 13, z: 20 },
};

function decorateStreet(ctx, b, deficit, region) {
  const city = ctx.city;
  if (b.hospital || b.station || b.restStop || b.life === 'street') return;
  const rng = blockRng(b, 4);
  b.life = b.life || 'street';
  const d = b.districtRef || city.districtById?.[b.district];
  const edges = [
    { x0: b.x, y0: b.y + 14, dx: 1, dy: 0, len: b.w },
    { x0: b.x, y0: b.y + b.h - 14, dx: 1, dy: 0, len: b.w },
    { x0: b.x + 14, y0: b.y, dx: 0, dy: 1, len: b.h },
    { x0: b.x + b.w - 14, y0: b.y, dx: 0, dy: 1, len: b.h },
  ];
  const p = Math.min(0.9, deficit * 1.1);
  for (const e of edges) {
    for (let t = 62 + rng.range(0, 30); t < e.len - 62; t += 74) {
      if (!rng.chance(p)) continue;
      let roll = rng.next();
      let type = STREET_MIX[0][0];
      for (const [k, w] of STREET_MIX) { roll -= w; if (roll <= 0) { type = k; break; } }
      if (type === 'busstop' && !b.onArterial) type = 'bench';
      if (type === 'kiosk' && !(d?.signDensity > 0.4)) type = 'vending';
      const s = STREET_SPEC[type];
      const x = e.x0 + e.dx * t, y = e.y0 + e.dy * t;
      const opts = { rot: e.dx ? 0 : Math.PI / 2, z: s.z, solid: s.solid, shrink: s.solid ? 1 : 0.5, tint: rng.int(0, 2) };
      if (type === 'kiosk') {
        opts.word = rng.pick(region.words).ko;
        opts.accent = d?.accent;
      }
      ctx.tryProp(type, x, y, s.r, opts);
    }
  }
}

function addSigns(ctx, deficit, area) {
  const city = ctx.city;
  const words = REGION_WORDS[area] || [];
  const p = Math.min(0.9, deficit * 1.5);
  if (p <= 0) return;
  for (const b of city.buildings) {
    if (b.flat || b.isBelt || b.isBank || b.life || NO_SIGN_STYLES.has(b.style) || b.landmark || b.h3d <= 30) continue;
    if ((city.areaAt?.(b.x, b.y)?.id || 'campagna') !== area) continue;
    const rng = new Rng(mix(mix(SALT, Math.round(b.x)), Math.round(b.y) + 7));
    // Un palazzo sulla strada porta fino a due insegne, uno nel cortile una sola
    // (si legge dal cortile e dai tetti vicini): è la proporzione che ha Seoul.
    const edged = b.edges && b.edges.length > 0;
    const sides = edged ? b.edges : ['top', 'bottom', 'left', 'right'];
    const max = edged ? 2 : 1;
    const d = city.districtById?.[b.district];
    for (let k = b.signs.length; k < max; k++) {
      if (!rng.chance(k === 0 ? (edged ? p : p * 0.6) : p * 0.6)) break;
      const free = sides.filter((e) => !b.signs.some((q) => q.edge === e));
      if (!free.length) break;
      const pool = b.style === 'warehouse' ? PORT_WORDS : words;
      const word = pool.length && rng.chance(0.6) ? rng.pick(pool) : rng.pick(SIGN_WORDS).ko;
      b.signs.push({
        edge: rng.pick(free), t: rng.range(0.2, 0.8), word,
        color: rng.chance(0.55) ? (d?.accent || '#ffd23f') : (d?.accent2 || '#ff7ab8'),
        vertical: rng.chance(0.62), h: rng.range(0.35, 0.8),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// INDICI E PUNTO D'INGRESSO
// ---------------------------------------------------------------------------

/** Gli stessi indici di `regions.reindex`, rifatti dopo aver tolto e aggiunto prop. */
function rebuildIndices(city) {
  city.buildingGrid = new SpatialGrid(city.w, city.h, 300);
  city.solidGrid = new SpatialGrid(city.w, city.h, 260);
  for (const b of city.buildings) {
    city.buildingGrid.insertRect(b);
    if (b.solid !== false) city.solidGrid.insertRect(b);
  }
  city.propGrid = new SpatialGrid(city.w, city.h, 220);
  for (const p of city.props) {
    city.propGrid.insertRect({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2, prop: p });
    if (p.solid) {
      const cw = p.collisionW || p.r * 2, ch = p.collisionH || p.r * 2;
      city.solidGrid.insertRect({ x: p.x - cw / 2, y: p.y - ch / 2, w: cw, h: ch, prop: p, solid: true });
    }
  }
  for (const s of city.stairs || []) city.solidGrid.insertRect(s);
  for (const c of city.boundaryColliders || []) city.solidGrid.insertRect(c);
}

/**
 * Il passo. Va chiamato **dopo** `regions.reindex` (accessi metro, stalli e negozi
 * sono già al loro posto e il passo li rispetta) e prima di ogni uso del mondo.
 */
export function vitaNegliIsolati(city) {
  const base = { buildings: city.buildings.length, props: city.props.length };
  const ctx = makeCtx(city);
  const blocks = [...city.blocks].sort((a, b) => a.y - b.y || a.x - b.x);
  const placedParks = [];
  const placedRural = [];

  for (const b of blocks) {
    if (b.type === 'park') decoratePark(ctx, b, placedParks);
    else if (b.type === 'rural') decorateRural(ctx, b, placedRural);
    else if (b.type === 'dock' || b.type === 'port') decorateDock(ctx, b);
  }

  // Arredo e insegne dove la regione è più povera di Seoul. Seoul è il riferimento:
  // per lei il deficit è zero per costruzione, e non si tocca.
  const urban = city.blocks.filter((b) => b.type === 'urban' || b.type === 'dock');
  const dens = furnitureDensity(city, urban);
  const sdens = signDensity(city);
  const refF = dens.seoul ?? Math.max(...Object.values(dens), 1);
  const refS = sdens.seoul ?? 1;
  const areas = city.areas ? city.areas.map((a) => a.id) : ['seoul'];
  for (const b of blocks) {
    if (b.type !== 'urban' && b.type !== 'dock') continue;
    const a = areaOf(city, b);
    if (a === 'seoul') continue;
    const deficit = Math.max(0, 1 - (dens[a] ?? 0) / refF);
    decorateStreet(ctx, b, deficit, { words: REGION_WORDS[a] ? SIGN_WORDS.concat(REGION_WORDS[a].map((ko) => ({ ko }))) : SIGN_WORDS });
  }
  for (const a of areas) {
    if (a === 'seoul') continue;
    addSigns(ctx, Math.max(0, 1 - (sdens[a] ?? 0) / refS), a);
  }

  if (ctx.gone.size) city.props = city.props.filter((p) => !ctx.gone.has(p));
  rebuildIndices(city);

  const decorBlocks = city.blocks.filter((b) => b.decor).length;
  if (city.stats) {
    city.stats.base = base;
    city.stats.buildings = city.buildings.length;
    city.stats.props = city.props.length;
    city.stats.vita = {
      props: ctx.added.props.length, buildings: ctx.added.buildings.length,
      tolti: ctx.gone.size, blocchi: decorBlocks,
    };
  }
  return city;
}
