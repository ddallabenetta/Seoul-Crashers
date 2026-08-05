// Interni degli edifici: catalogo delle attività e generazione della pianta.
//
// Tre scelte reggono tutto il resto.
//
// **Gli interni non sono in scala.** Un negozio di Hongdae è largo 70 px in pianta:
// dentro non ci si girerebbe, il giocatore è largo 18. La pianta nasce dal footprint
// moltiplicato per 1.7 e poi limitata a una taglia giocabile. È la stessa bugia che
// raccontano tutti i giochi con gli interni, e si nota solo se la si va a cercare.
//
// **Coordinate locali.** Ogni piano vive in uno spazio suo, da (0,0) a (w,h). Fuori
// dalla porta non c'è niente: quando il giocatore è dentro, la città non gira. Così
// i solidi del piano stanno in una `SpatialGrid` identica a quella della città e
// collisioni, raggi e linee di tiro funzionano senza sapere dove si trovano.
//
// **Un edificio alto è una pila di attività.** A Seoul l'insegna non è una: è una
// colonna, una per piano — 편의점 al piano terra, 피시방 al secondo, 노래방 al terzo.
// Il numero di piani viene dall'altezza del volume, e la colonna di insegne che si
// legge dalla strada dice davvero cosa c'è dentro (vedi `placeShops` in citygen).
import { Rng } from '../core/rng.js';
import { SpatialGrid } from '../core/spatial.js';
import { clamp, rectsOverlap } from '../core/math.js';

export const WALL = 12;      // spessore dei muri perimetrali
const DOOR_W = 54;           // varco d'ingresso al piano terra
export const BACK_W = 44;    // varco di servizio sul retro, sempre al piano terra
const STAIR_W = 58;
const STAIR_H = 78;

/**
 * Catalogo delle attività. `where` dice a che piano può stare: 'ground' vuole la
 * strada (un'armeria al quarto piano non la trova nessuno), 'upper' è quello che a
 * Seoul sta di sopra proprio perché l'affitto costa meno.
 * `shop` è la voce del listino in `entities/shops.js`; senza, è un posto da
 * esplorare e basta — ma la cassa da svuotare ce l'hanno quasi tutti.
 *
 * `open: [apre, chiude]` è l'orario in ore di gioco. Se la chiusura è **minore**
 * dell'apertura la fascia scavalca la mezzanotte: `[17, 4]` apre alle cinque del
 * pomeriggio e tira fino alle quattro. `[0, 24]` non chiude mai — e sono tre casi
 * scelti, non una scorciatoia: il 편의점 a Seoul è davvero aperto ventiquattr'ore,
 * il 병원 è anche il punto di risveglio dopo la morte (chiuderlo chiude la
 * partita) e il 주택 è casa di qualcuno, non un esercizio con una saracinesca.
 */
export const BUSINESSES = {
  guns: {
    id: 'guns', hangul: '총포상', label: 'armeria', where: 'ground', layout: 'counter',
    shop: 'guns', keeper: 'gangster', crowd: 0, blip: '#ff6b5a', open: [10, 20],
    pal: { floor: '#39332b', wall: '#4b4238', trim: '#6d5a42', accent: '#ffd23f' },
  },
  pawn: {
    id: 'pawn', hangul: '전당포', label: 'banco dei pegni', where: 'ground', layout: 'counter',
    shop: 'pawn', keeper: 'civil', crowd: 1, blip: '#c9a24a', open: [10, 21],
    pal: { floor: '#3b352f', wall: '#4e453a', trim: '#7a6440', accent: '#c9a24a' },
  },
  clothes: {
    id: 'clothes', hangul: '옷가게', label: 'negozio di vestiti', where: 'ground', layout: 'counter',
    shop: 'clothes', keeper: 'student', crowd: 2, blip: '#b48cff', open: [11, 22],
    pal: { floor: '#46414a', wall: '#5a5360', trim: '#8f7fa0', accent: '#b48cff' },
  },
  conv: {
    id: 'conv', hangul: '편의점', label: 'minimarket', where: 'ground', layout: 'market',
    shop: 'conv', keeper: 'student', crowd: 2, blip: '#4ad98a', open: [0, 24],
    pal: { floor: '#4a4a4e', wall: '#5c5c62', trim: '#7f8189', accent: '#4ad98a' },
  },
  pharma: {
    id: 'pharma', hangul: '약국', label: 'farmacia', where: 'ground', layout: 'market',
    shop: 'pharma', keeper: 'office', crowd: 1, blip: '#e8595e', open: [9, 20],
    pal: { floor: '#4e5054', wall: '#62656b', trim: '#8b9099', accent: '#e8595e' },
  },
  bunsik: {
    id: 'bunsik', hangul: '분식', label: 'tavola calda', where: 'any', layout: 'eatery',
    // Apre presto, e non è pignoleria: la partita comincia alle 8:24 e il 분식 è
    // l'unico posto dove si mangia, cioè l'unico modo di curarsi che si può pagare.
    shop: 'food', keeper: 'civil', crowd: 3, open: [8, 22],
    pal: { floor: '#4b3f36', wall: '#5d4c3e', trim: '#8a6a4a', accent: '#ffa229' },
  },
  bar: {
    id: 'bar', hangul: '술집', label: 'bar', where: 'any', layout: 'eatery',
    shop: 'food', keeper: 'gangster', crowd: 4, open: [17, 4],
    pal: { floor: '#33292c', wall: '#43353a', trim: '#6b4a52', accent: '#ff5fa2' },
  },
  pcbang: {
    id: 'pcbang', hangul: '피시방', label: 'internet café', where: 'upper', layout: 'desks',
    keeper: 'student', crowd: 5, open: [14, 4],
    pal: { floor: '#2b2f38', wall: '#373d48', trim: '#4c5566', accent: '#38d6ff' },
  },
  office: {
    id: 'office', hangul: '사무실', label: 'ufficio', where: 'upper', layout: 'desks',
    keeper: 'office', crowd: 3, open: [9, 19],
    pal: { floor: '#4c4e52', wall: '#5e6167', trim: '#7c818a', accent: '#8fb6e8' },
  },
  noraebang: {
    id: 'noraebang', hangul: '노래방', label: 'karaoke', where: 'upper', layout: 'rooms',
    keeper: 'civil', crowd: 3, open: [16, 5],
    pal: { floor: '#2e2733', wall: '#3d3244', trim: '#5d4a6b', accent: '#ff5fa2' },
  },
  home: {
    id: 'home', hangul: '주택', label: 'appartamenti', where: 'upper', layout: 'rooms',
    crowd: 2, open: [0, 24],
    pal: { floor: '#4a4238', wall: '#5a5044', trim: '#7d6d55', accent: '#ffcf4a' },
  },
  billiards: {
    id: 'billiards', hangul: '당구장', label: 'sala biliardo', where: 'upper', layout: 'hall',
    keeper: 'gangster', crowd: 4, open: [15, 3],
    pal: { floor: '#39413c', wall: '#47514a', trim: '#5e6b62', accent: '#41e0a3' },
  },
  clinic: {
    id: 'clinic', hangul: '병원', label: 'ospedale', where: 'ground', layout: 'hall',
    shop: 'clinic', keeper: 'office', crowd: 2, blip: '#eef2f8', open: [0, 24],
    pal: { floor: '#5a5f66', wall: '#6c727a', trim: '#8f959e', accent: '#e8595e' },
  },
};

/** Un tipo di attività è aperto a quell'ora? Fascia chiusa a sinistra, aperta a destra. */
export function bizOpenAt(bizId, hour) {
  const b = BUSINESSES[bizId];
  if (!b || !b.open) return true;
  const [a, z] = b.open;
  const h = ((hour % 24) + 24) % 24;
  return z > a ? h >= a && h < z : h >= a || h < z;
}

/**
 * Quanta gente di passaggio c'è dentro, ora per ora, in frazione di `biz.crowd`.
 * È una tabella come le chiavi della luce (`daycycle.KEYS`) e per lo stesso
 * motivo: un 술집 non si riempie seguendo una sinusoide, si riempie alle undici.
 * Le fasce che scavalcano la mezzanotte si scrivono come gli orari (`[23, 2]`).
 *
 * Fuori dall'orario di apertura non serve: un locale chiuso è vuoto comunque.
 */
const RUSH = {
  bar:       [[17, 20, 0.4], [20, 23, 1], [23, 2, 1.2], [2, 4, 0.35]],
  bunsik:    [[8, 11, 0.4], [11, 14, 1.2], [14, 17, 0.5], [17, 21, 1], [21, 22, 0.5]],
  conv:      [[0, 5, 0.25], [5, 8, 0.5], [8, 12, 0.8], [12, 14, 1.1], [14, 18, 0.8], [18, 23, 1.1], [23, 24, 0.5]],
  pharma:    [[9, 12, 0.9], [12, 14, 0.6], [14, 20, 1]],
  guns:      [[10, 14, 0.7], [14, 20, 0.9]],
  pawn:      [[10, 14, 0.9], [14, 21, 0.7]],
  clothes:   [[11, 15, 0.8], [15, 20, 1.1], [20, 22, 0.6]],
  office:    [[9, 12, 1.1], [12, 14, 0.5], [14, 18, 1], [18, 19, 0.15]],
  pcbang:    [[14, 18, 0.6], [18, 23, 1.1], [23, 3, 1.2], [3, 4, 0.4]],
  noraebang: [[16, 20, 0.4], [20, 24, 1.1], [0, 3, 1.2], [3, 5, 0.4]],
  billiards: [[15, 19, 0.6], [19, 24, 1.1], [0, 3, 0.7]],
  // Un 주택 è pieno quando la gente è a casa, cioè quando tutto il resto è chiuso.
  home:      [[0, 7, 1.2], [7, 9, 0.8], [9, 18, 0.2], [18, 22, 1], [22, 24, 1.2]],
  clinic:    [[0, 8, 0.4], [8, 12, 1.2], [12, 18, 1], [18, 24, 0.6]],
};

export function rushAt(bizId, hour) {
  const table = RUSH[bizId];
  if (!table) return 0.8;
  const h = ((hour % 24) + 24) % 24;
  for (const [a, z, f] of table) {
    if (z > a ? h >= a && h < z : h >= a || h < z) return f;
  }
  return 0.4;
}

/** Quanti clienti ci sono su questo piano a quest'ora. */
export function crowdAt(biz, hour) {
  return Math.round((biz.crowd || 0) * rushAt(biz.id, hour));
}

/** Sempre aperto: `[0, 24]`, l'unica fascia che non ha senso scrivere su un cartello. */
export function bizAlwaysOpen(bizId) {
  const b = BUSINESSES[bizId];
  return !b || !b.open || (b.open[0] === 0 && b.open[1] === 24);
}

/** Ora da cartello: `9.5` → `09:30`. */
export function clockLabel(h) {
  const t = ((h % 24) + 24) % 24;
  const hh = Math.floor(t);
  return `${String(hh).padStart(2, '0')}:${String(Math.round((t - hh) * 60)).padStart(2, '0')}`;
}

/**
 * Che cosa apre, e dove. Le ripetizioni sono i pesi: a Itaewon si beve, a Gangnam
 * si lavora, ai moli non c'è niente che non sia utile a chi non fa domande.
 * Il piano terra vuole la strada, i piani alti sono quelli che a Seoul costano meno.
 */
export const DISTRICT_MIX = {
  hongdae: {
    ground: ['conv', 'conv', 'bunsik', 'bunsik', 'bar', 'clothes', 'pawn', 'pharma', 'guns'],
    upper: ['pcbang', 'pcbang', 'noraebang', 'noraebang', 'billiards', 'home', 'bar', 'bunsik'],
  },
  myeongdong: {
    ground: ['conv', 'conv', 'clothes', 'clothes', 'pharma', 'bunsik', 'bar', 'pawn'],
    upper: ['pcbang', 'noraebang', 'office', 'home', 'billiards', 'bunsik'],
  },
  itaewon: {
    ground: ['bar', 'bar', 'bunsik', 'pawn', 'pawn', 'guns', 'conv', 'clothes'],
    upper: ['bar', 'noraebang', 'noraebang', 'home', 'billiards', 'office'],
  },
  gangnam: {
    ground: ['conv', 'pharma', 'clothes', 'bunsik', 'bar', 'pawn'],
    upper: ['office', 'office', 'office', 'pcbang', 'noraebang', 'home'],
  },
  docks: {
    ground: ['pawn', 'guns', 'bar', 'conv', 'bunsik'],
    upper: ['home', 'office', 'billiards'],
  },
  gimpo: {
    ground: ['conv', 'bunsik', 'bar', 'pharma', 'pawn'],
    upper: ['office', 'home', 'pcbang'],
  },
  gyeonggi: {
    ground: ['conv', 'bunsik', 'pawn', 'guns', 'bar'],
    upper: ['home', 'home', 'billiards'],
  },
};

// ---------------------------------------------------------------------------
// GENERAZIONE
// ---------------------------------------------------------------------------

/**
 * Interno completo di un edificio: una pianta per piano, dal terra in su.
 * `back` dice se il piano terra ha l'uscita di servizio: lo decide chi conosce il
 * mondo fuori (`shops.backDoorSpot`), perché dietro un edificio attaccato al
 * palazzo accanto non c'è nessun posto in cui sbucare.
 */
export function buildInterior(shop, back = false) {
  const rng = new Rng(shop.seed);
  const w = clamp(Math.round(shop.w * 1.8), 300, 470);
  const h = clamp(Math.round(shop.h * 1.8), 260, 390);
  const floors = shop.biz.map((id, i) => buildFloor(rng, BUSINESSES[id], i, shop.biz.length, w, h, back));
  return { shop, floors, cur: 0, name: shop.name };
}

function buildFloor(rng, biz, idx, total, w, h, back) {
  const f = {
    idx, biz, w, h,
    // `npcs` è il ruolino (chi lavora qui, sempre gli stessi), `guests` sono i
    // posti in cui *può* esserci un cliente: quanti se ne occupano davvero lo
    // decide l'ora, a ogni visita (vedi `crowdAt` e `shops.refreshCrowd`).
    walls: [], furni: [], npcs: [], guests: [],
    stairUp: null, stairDown: null,
    entry: null, till: null, robbed: false,
    grid: null,
  };

  // Muri: perimetro chiuso, con il varco della porta solo al piano terra.
  const gap = idx === 0 ? { a: w / 2 - DOOR_W / 2, b: w / 2 + DOOR_W / 2 } : null;
  // Porta di servizio sul retro, anche lei solo al piano terra: è il contrappeso
  // all'assedio della porta principale — senza una seconda uscita un negozio è una
  // trappola, con la porta sul retro è una scelta. Sta all'**estremo** del muro di
  // fondo e non in mezzo: quello è il muro dell'arredo (frigoriferi, rastrelliere,
  // cucina), e un varco al centro lo spezzerebbe in due tronconi troppo corti per
  // starci qualcosa. `band` si accorcia di conseguenza, e le piante la rispettano
  // da sole perché usano solo quella.
  f.back = back && idx === 0 ? { x: WALL + 14, w: BACK_W } : null;
  if (f.back) {
    f.walls.push({ x: 0, y: 0, w: f.back.x, h: WALL });
    f.walls.push({ x: f.back.x + f.back.w, y: 0, w: w - f.back.x - f.back.w, h: WALL });
  } else {
    f.walls.push({ x: 0, y: 0, w, h: WALL });               // fondo (retro)
  }
  f.walls.push({ x: 0, y: 0, w: WALL, h });                 // sinistra
  f.walls.push({ x: w - WALL, y: 0, w: WALL, h });           // destra
  if (gap) {
    f.walls.push({ x: 0, y: h - WALL, w: gap.a, h: WALL });
    f.walls.push({ x: gap.b, y: h - WALL, w: w - gap.b, h: WALL });
  } else {
    f.walls.push({ x: 0, y: h - WALL, w, h: WALL });
  }

  // I due vani scala stanno sempre negli stessi angoli: si imparano in due visite,
  // ed è l'unica cosa che deve restare uguale fra attività diversissime.
  if (idx < total - 1) f.stairUp = { x: w - WALL - STAIR_W, y: WALL, w: STAIR_W, h: STAIR_H, dir: 1 };
  if (idx > 0) f.stairDown = { x: WALL, y: WALL, w: STAIR_W, h: STAIR_H, dir: -1 };

  // Dove ci si ritrova entrando: sulla porta al piano terra, sul pianerottolo sopra.
  f.entry = idx === 0
    ? { x: w / 2, y: h - WALL - 28, angle: -Math.PI / 2 }
    : { x: WALL + STAIR_W / 2, y: WALL + STAIR_H + 22, angle: Math.PI / 2 };

  // Dove si esce sul retro, visto da dentro.
  f.backExit = f.back ? { x: f.back.x + f.back.w / 2, y: WALL + 26, angle: -Math.PI / 2 } : null;

  // Zone da non ingombrare: scale, pianerottoli e i corridoi delle due porte.
  const keep = [];
  if (f.stairUp) keep.push(pad(f.stairUp, 16));
  if (f.stairDown) keep.push(pad(f.stairDown, 16));
  if (idx === 0) keep.push({ x: w / 2 - 36, y: h - WALL - 76, w: 72, h: 76 });
  else keep.push({ x: WALL, y: WALL, w: STAIR_W + 26, h: STAIR_H + 46 });
  if (f.back) keep.push({ x: f.back.x - 10, y: WALL, w: f.back.w + 20, h: 62 });
  f.keep = keep;

  const area = { x: WALL + 6, y: WALL + 6, w: w - WALL * 2 - 12, h: h - WALL * 2 - 12 };
  // Due regioni, e le piante usano solo queste. `band` è la striscia libera lungo
  // il muro di fondo (frigoriferi, rastrelliere, cucina), `body` è il resto della
  // sala. Senza, ai piani alti i due vani scala mangiano tutto il muro di fondo e
  // le attività di sopra restano stanze vuote: è successo, e si vedeva.
  f.band = backBand(f, area);
  f.body = f.stairDown
    ? { x: area.x, y: WALL + STAIR_H + 12, w: area.w, h: area.y + area.h - WALL - STAIR_H - 12 }
    : area;
  LAYOUTS[biz.layout](rng, f, area, biz);

  // Indice dei solidi: stessa struttura della città, così `player.resolveCollisions`
  // e `weapons.rayCast` non sanno nemmeno di essere dentro un edificio.
  f.grid = new SpatialGrid(w, h, 56);
  for (const s of f.walls) f.grid.insertRect(s);
  for (const o of f.furni) if (o.solid) f.grid.insertRect(o);
  return f;
}

function pad(r, m) {
  return { x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 };
}

/** Tratto di muro di fondo non occupato dai vani scala né dalla porta sul retro. */
function backBand(f, a) {
  let x0 = a.x;
  let x1 = a.x + a.w;
  if (f.stairDown) x0 = Math.max(x0, f.stairDown.x + f.stairDown.w + 16);
  if (f.back) x0 = Math.max(x0, f.back.x + f.back.w + 14);
  if (f.stairUp) x1 = Math.min(x1, f.stairUp.x - 16);
  return { x: x0, w: Math.max(0, x1 - x0) };
}

/** Aggiunge un mobile se non pesta niente di già messo né le zone riservate. */
function put(f, o) {
  if (o.w < 5 || o.h < 5) return null;
  if (o.x < WALL || o.y < WALL || o.x + o.w > f.w - WALL || o.y + o.h > f.h - WALL) return null;
  for (const k of f.keep) if (rectsOverlap(o, k)) return null;
  for (const q of f.furni) if (rectsOverlap(pad(o, 2), q)) return null;
  o.z = o.z ?? 22;
  o.solid = o.solid !== false;
  f.furni.push(o);
  return o;
}

function npc(f, kind, x, y, role = 'idle') {
  f.npcs.push({ kind, x, y, role });
}

/** Un posto da cliente: esiste sempre, ma è occupato solo a certe ore. */
function guest(f, kind, x, y, role = 'wander') {
  f.guests.push({ kind, x, y, role });
}

/**
 * Cassa: sta *sopra* il bancone, quindi entra nell'elenco senza passare dal
 * controllo di sovrapposizione — è l'unico mobile che deve pestarne un altro.
 */
function till(f, x, y, cash) {
  f.till = { x, y, cash };
  f.furni.push({ x: x - 9, y: y - 7, w: 18, h: 14, type: 'till', z: 30, solid: false });
}

/**
 * Sparpaglia i **posti** dei clienti nello spazio ancora libero. Se ne prepara
 * qualcuno in più di quanti ne servano a regime: nell'ora di punta un locale è più
 * pieno del suo `crowd`, e cercare un posto libero a runtime vorrebbe dire rifare
 * il campionamento a ogni visita — questi invece sono sempre gli stessi, e la sala
 * non si riarreda ogni volta che si apre la porta.
 */
function crowd(rng, f, area, biz, role = 'wander') {
  const kinds = ['civil', 'student', 'office', 'tourist'];
  const n = biz.crowd || 0;
  if (!n) return;
  for (let i = 0; i < n + 2; i++) {
    for (let a = 0; a < 12; a++) {
      const x = area.x + rng.range(20, area.w - 20);
      const y = area.y + rng.range(20, area.h - 20);
      const box = { x: x - 11, y: y - 11, w: 22, h: 22 };
      if (f.keep.some((k) => rectsOverlap(box, k))) continue;
      if (f.furni.some((q) => q.solid && rectsOverlap(box, q))) continue;
      if (f.guests.some((g) => (g.x - x) ** 2 + (g.y - y) ** 2 < 40 * 40)) continue;
      guest(f, rng.pick(kinds), x, y, role);
      break;
    }
  }
}

// --- piante ------------------------------------------------------------------

const LAYOUTS = {
  /** Bancone di traverso, merce alle pareti: armeria, pegni, vestiti. */
  counter(rng, f, a, biz) {
    const b = f.body;
    const cy = b.y + b.h * 0.36;
    const cw = b.w * rng.range(0.5, 0.66);
    const cx = b.x + (biz.id === 'clothes' ? b.w - cw : 0);
    put(f, { x: cx, y: cy, w: cw, h: 17, type: 'counter', z: 26 });
    till(f, cx + cw - 22, cy + 8, rng.int(3, 9) * 10000);
    npc(f, biz.keeper, cx + cw - 46, cy - 20, 'keeper');

    // Dietro il bancone: rastrelliere a muro. Ai lati: merce lungo le pareti, che
    // è come sono fatti davvero i negozi stretti — il centro resta per camminarci.
    const rackType = biz.id === 'guns' ? 'rack' : biz.id === 'clothes' ? 'rail' : 'shelf';
    for (let x = f.band.x; x < f.band.x + f.band.w - 40; x += 62) {
      put(f, { x, y: WALL, w: Math.min(54, f.band.x + f.band.w - x), h: 15, type: rackType, z: 34 });
    }
    const lowY = cy + 40;
    const lowH = a.y + a.h - lowY - 8;
    if (lowH > 40) {
      for (const side of [0, 1]) {
        const x = side ? a.x + a.w - 17 : a.x;
        put(f, { x, y: lowY + rng.range(0, 14), w: 17, h: lowH * rng.range(0.55, 0.9), type: rackType, z: 30 });
      }
      // Un'isola per lato del corridoio d'ingresso, mai davanti alla porta.
      for (const side of [-1, 1]) {
        const w = rng.range(40, 62);
        const x = side < 0 ? a.x + 26 : a.x + a.w - 26 - w;
        put(f, { x, y: lowY + lowH * 0.42, w, h: 17, type: rackType, z: 28 });
      }
    }
    put(f, { x: a.x + 2, y: cy - 30, w: 18, h: 18, type: 'plant', z: 30, solid: false });
    crowd(rng, f, a, biz);
  },

  /** Corsie e frigo a muro: minimarket e farmacia. */
  market(rng, f, a, biz) {
    const b = f.body;
    const rows = clamp(Math.floor(b.h / 48) - 1, 2, 4);
    for (let r = 0; r < rows; r++) {
      const y = b.y + 26 + r * 48;
      const w = b.w * rng.range(0.55, 0.82);
      put(f, { x: b.x + (r % 2 ? b.w - w : 0), y, w, h: 19, type: 'shelf', z: 30 });
    }
    // Il muro di frigoriferi in fondo è la firma di un 편의점 visto dall'alto.
    for (let x = f.band.x; x < f.band.x + f.band.w - 40; x += 50) {
      put(f, { x, y: WALL, w: Math.min(44, f.band.x + f.band.w - x), h: 18, type: 'fridge', z: 40 });
    }
    const cw = 74;
    const cx = a.x + a.w - cw;
    const cy = a.y + a.h - 46;
    put(f, { x: cx, y: cy, w: cw, h: 16, type: 'counter', z: 26 });
    till(f, cx + cw - 18, cy + 8, rng.int(2, 6) * 10000);
    npc(f, biz.keeper, cx + cw - 30, cy - 20, 'keeper');
    crowd(rng, f, a, biz);
  },

  /** Cucina lungo un muro, tavolini e sgabelli: 분식 e 술집. */
  eatery(rng, f, a, biz) {
    const band = f.band;
    const kw = band.w * 0.6;
    put(f, { x: band.x, y: WALL, w: kw, h: 20, type: 'kitchen', z: 32 });
    const bx = band.x + kw + 6;
    put(f, { x: bx, y: WALL, w: band.x + band.w - bx, h: 16, type: 'counter', z: 26 });
    till(f, band.x + band.w - 14, WALL + 8, rng.int(2, 7) * 10000);
    npc(f, biz.keeper, band.x + band.w * 0.5, WALL + 32, 'keeper');

    const b = f.body;
    const cols = clamp(Math.floor(b.w / 74), 1, 4);
    const rowsN = clamp(Math.floor((b.h - 30) / 66), 1, 3);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rowsN; j++) {
        const x = b.x + 12 + i * 74;
        const y = b.y + 26 + j * 66;
        if (!put(f, { x, y, w: 44, h: 34, type: 'table', z: 22 })) continue;
        put(f, { x: x - 14, y: y + 8, w: 13, h: 13, type: 'stool', z: 16 });
        put(f, { x: x + 45, y: y + 8, w: 13, h: 13, type: 'stool', z: 16 });
      }
    }
    crowd(rng, f, a, biz);
  },

  /** File di postazioni: 피시방 e uffici. */
  desks(rng, f, a, biz) {
    const pc = biz.id === 'pcbang';
    const b = f.body;
    const rowsN = clamp(Math.floor(b.h / 62), 2, 4);
    for (let r = 0; r < rowsN; r++) {
      const y = b.y + 14 + r * 58;
      for (let x = b.x + 6; x < b.x + b.w - 46; x += 52) {
        if (!put(f, { x, y, w: 46, h: 24, type: pc ? 'pc' : 'desk', z: 24 })) continue;
        put(f, { x: x + 15, y: y + 28, w: 14, h: 14, type: 'chair', z: 16 });
      }
    }
    const cw = 66;
    put(f, { x: a.x + a.w - cw, y: a.y + a.h - 40, w: cw, h: 16, type: 'counter', z: 26 });
    till(f, a.x + a.w - 16, a.y + a.h - 32, rng.int(2, 5) * 10000);
    if (biz.keeper) npc(f, biz.keeper, a.x + a.w - 30, a.y + a.h - 62, 'keeper');
    crowd(rng, f, a, biz);
  },

  /** Corridoio e stanzette: karaoke e appartamenti. */
  rooms(rng, f, a, biz) {
    const home = biz.id === 'home';
    // Il corridoio corre in orizzontale a metà altezza: le stanze si aprono sopra
    // e sotto, con una porta ciascuna. È come sono fatti davvero.
    const b = f.body;
    const hallY = b.y + b.h * 0.5;
    const n = clamp(Math.floor(b.w / 86), 2, 4);
    const rw = (b.w - 8) / n;
    for (let i = 0; i < n; i++) {
      const rx = b.x + i * rw;
      for (const side of [-1, 1]) {
        const ry = side < 0 ? b.y : hallY + 26;
        const rh = side < 0 ? hallY - 26 - b.y : b.y + b.h - hallY - 26;
        if (rh < 44) continue;
        // Tramezzi: due lati e il muro verso il corridoio bucato da una porta.
        if (i > 0) f.walls.push({ x: rx - 3, y: ry, w: 6, h: rh });
        const dw = 26;
        const dx = rx + rw * 0.5 - dw / 2;
        const wy = side < 0 ? ry + rh - 6 : ry;
        f.walls.push({ x: rx, y: wy, w: dx - rx, h: 6 });
        f.walls.push({ x: dx + dw, y: wy, w: rx + rw - dx - dw, h: 6 });

        const inner = { x: rx + 8, y: ry + 8, w: rw - 16, h: rh - 16 };
        if (home) {
          put(f, { x: inner.x, y: inner.y, w: Math.min(46, inner.w), h: 30, type: 'bed', z: 18 });
          put(f, { x: inner.x + inner.w - 26, y: inner.y + inner.h - 18, w: 24, h: 14, type: 'tv', z: 22, solid: false });
        } else {
          put(f, { x: inner.x, y: inner.y + inner.h - 20, w: Math.min(52, inner.w), h: 18, type: 'sofa', z: 20 });
          put(f, { x: inner.x + inner.w * 0.5 - 12, y: inner.y + 4, w: 24, h: 16, type: 'tv', z: 26, solid: false });
        }
        // Una stanzetta occupata è un posto da cliente come gli altri: alle tre di
        // notte un 노래방 ne ha una sola accesa, alle undici tutte.
        if (rng.chance(0.8)) guest(f, rng.pick(['student', 'civil', 'office']), inner.x + inner.w * 0.5, inner.y + inner.h * 0.5, 'sit');
      }
    }
    if (!home) {
      put(f, { x: b.x + b.w - 70, y: hallY - 8, w: 62, h: 16, type: 'counter', z: 26 });
      till(f, b.x + b.w - 18, hallY, rng.int(3, 8) * 10000);
      npc(f, biz.keeper || 'civil', b.x + b.w - 34, hallY + 26, 'keeper');
    }
  },

  /** Sala aperta con oggetti grandi: biliardo e corsia d'ospedale. */
  hall(rng, f, a, biz) {
    const med = biz.id === 'clinic';
    const ow = med ? 34 : 62;
    const oh = med ? 52 : 36;
    // Passo stretto: ai piani alti il corpo della sala è alto ~140 px, e con un
    // passo largo ci sta una fila sola — una sala biliardo con due tavoli.
    const gapX = med ? 24 : 20;
    const gapY = med ? 30 : 22;
    const b = f.body;
    const cols = clamp(Math.floor(b.w / (ow + gapX)), 1, 4);
    const rowsN = clamp(Math.floor(b.h / (oh + gapY)), 1, 3);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rowsN; j++) {
        const x = b.x + 12 + i * (ow + gapX);
        const y = b.y + 8 + j * (oh + gapY);
        put(f, { x, y, w: ow, h: oh, type: med ? 'bed' : 'pool', z: med ? 18 : 24 });
        if (med) put(f, { x: x + ow + 4, y: y + 6, w: 14, h: 14, type: 'stool', z: 16 });
      }
    }
    // Stecche e sedie a muro: riempiono la striscia di fondo, che qui resterebbe vuota.
    for (let x = f.band.x; x < f.band.x + f.band.w - 30; x += 44) {
      put(f, { x, y: WALL, w: 36, h: 14, type: med ? 'shelf' : 'rack', z: 30 });
    }
    const cw = 78;
    put(f, { x: a.x + a.w - cw - 4, y: a.y + a.h - 36, w: cw, h: 16, type: 'counter', z: 26 });
    till(f, a.x + a.w - 22, a.y + a.h - 28, rng.int(3, 9) * 10000);
    npc(f, biz.keeper || 'civil', a.x + a.w - 40, a.y + a.h - 58, 'keeper');
    crowd(rng, f, a, biz);
  },
};
