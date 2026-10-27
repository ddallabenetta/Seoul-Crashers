// Dove succedono le cose.
//
// Il copione dice «un 당구장 a Hongdae, un 술집 a Myeongdong, un banco al mercato»
// e non può dire di più: la città nasce da una seed e nessuno ha scelto a mano
// quale palazzo. La regola del progetto è che **la storia non inventa una Seoul
// nuova** (`docs/storia/README.md`, regola 3), quindi una missione non piazza
// niente — cerca.
//
// **Si cerca in modo deterministico, e non si tira nessun dado.** La stessa seed
// dà gli stessi indirizzi a ogni partita, il che è l'unica cosa che rende
// riproducibile una segnalazione su una missione. Il rischio vero non è trovare
// l'indirizzo sbagliato: è **non trovarne nessuno** e lasciare una fase senza
// obiettivo, quindi ogni ricerca ha un ripiego che allarga il criterio invece di
// restituire `null`.
import { dist } from '../core/math.js';
import { SIDEWALK } from '../world/citygen.js';

/**
 * Un indirizzo di missione: la vetrina e **a che piano** sta l'attività cercata.
 * Sono due cose diverse e vanno tenute insieme — il 당구장 è al primo piano di un
 * palazzo la cui insegna al pianterreno è un'altra.
 */
function addr(shop, level) {
  return { shop, id: shop.id, level, x: shop.x, y: shop.y };
}

function seoul(game, s, area = 'seoul') {
  return game.city.areaAt?.(s.x, s.y)?.id === area;
}

/**
 * La vetrina più vicina a `near` che abbia `biz` a un piano qualunque.
 *
 * `district` restringe al quartiere e **non è un vincolo duro**: se in quel
 * quartiere non c'è (succede, la maglia cambia con la seed), si riprova su tutta
 * Seoul. Meglio un 당구장 due strade più in là che una fase senza blip.
 */
export function findShop(game, biz, opts = {}) {
  // `area` cambia la città in cui si cerca (Atto III: 'busan'); di default Seoul.
  const { district = null, near = game.city.spawn, avoid = [], minDist = 0, level: wantLevel = null, visible = false, area = 'seoul' } = opts;
  const skip = new Set(avoid);
  // `district` è l'etichetta con cui la generazione ha marcato la vetrina; `visible` chiede il
  // quartiere **che il giocatore legge a schermo** (`districtAt`), che sui bordi fra due
  // distretti non è lo stesso. Chi manda in un posto e lo scrive nell'HUD vuole il secondo.
  const where = (s) => (visible ? game.city.districtAt(s.x, s.y)?.id : s.district);
  const pick = (wantDistrict, wantMin, lv) => {
    let best = null;
    let bestD = Infinity;
    for (const s of game.city.shops) {
      if (skip.has(s.id) || !seoul(game, s, area)) continue;
      if (wantDistrict && where(s) !== wantDistrict) continue;
      const level = s.biz.indexOf(biz);
      if (level < 0) continue;
      if (lv !== null && level !== lv) continue;
      const d = dist(s.x, s.y, near.x, near.y);
      if (d < wantMin || d >= bestD) continue;
      bestD = d;
      best = addr(s, level);
    }
    return best;
  };
  // Il piano (`level`) è una **preferenza**: il copione dice «terzo piano», e se in quel quartiere non
  // c'è, meglio un altro piano **nel quartiere giusto** che il piano giusto in un altro quartiere.
  const nel = (lv) => pick(district, minDist, lv) || pick(district, 0, lv);
  return nel(wantLevel) || nel(null)
    || pick(null, minDist, wantLevel) || pick(null, 0, wantLevel)
    || pick(null, minDist, null) || pick(null, 0, null);
}

/**
 * Il cortile di una banda più vicino a `near`, dentro Seoul.
 *
 * Dal §5.31 un cortile può aver cambiato padrone, e una missione che cerca «il
 * cortile del 철마파» non deve restare senza obiettivo perché il giocatore se
 * l'era preso il giorno prima: se nessuno è più di quella banda si ripiega sul
 * **padrone di nascita**, che è dove la storia lo colloca comunque.
 */
export function findTurf(game, gangId, near = game.city.spawn, area = 'seoul') {
  const pick = (of) => {
    let best = null;
    let bestD = Infinity;
    for (const t of game.city.turfs || []) {
      if (of(t) !== gangId) continue;
      const cx = t.cx;
      const cy = t.cy;
      if (game.city.areaAt?.(cx, cy)?.id !== area) continue;
      const d = dist(cx, cy, near.x, near.y);
      if (d >= bestD) continue;
      bestD = d;
      best = { turf: t, x: cx, y: cy };
    }
    return best;
  };
  return pick((t) => t.gang) || pick((t) => t.gang0);
}

/**
 * I luoghi di Busan che l'Atto III chiede (`docs/storia/05-atto-3.md`), per nome.
 *
 * A Seoul la storia **cerca** un indirizzo fra le vetrine generate; a Busan la
 * geografia è disegnata (§5.41), quindi i luoghi non si cercano: **esistono**, con un
 * id fisso in `city.landmarks` (li crea `world/busan.js`, sempre negli stessi punti
 * perché la città ha una seed sua). Questa funzione è l'unico posto in cui la storia
 * li nomina. Ogni chiave ha un ripiego che allarga il criterio — una stazione, un nodo
 * di strada, il centro della regione — così una fase non resta mai senza obiettivo.
 *
 *  - `ingresso`  M9: il posto di blocco dove la Gyeongbu entra in città
 *  - `piazzale`  M9: il piazzale di 서면 dove Chun-sik scende
 *  - `mercato`   M10: il mercato del pesce di 자갈치
 *  - `moli`      M10: i moli di 남포동 (il carico di contrabbando)
 *  - `officina`  M10: l'officina di 철마파 a 사상 (Ko Eun-bi)
 *  - `baia`      M10: l'acqua sotto il ponte, per la corsa con le motovedette
 *  - `ponte`     M10: il ponte 광안대교 (impalcato percorribile; le barche passano sotto)
 *  - `traghetti` M11 e l'incontro facoltativo: il terminal di 부산항
 *  - `container` M10: il porto dei container
 *  - `spiaggia`  la spiaggia di 해운대
 * Restituisce `{ id, x, y, landmark }` oppure `null` se Busan non c'è (un albero senza la mappa unica).
 */
export const BUSAN_PLACES = {
  ingresso: 'busan-checkpoint',
  piazzale: 'seomyeon-square',
  mercato: 'jagalchi-market',
  moli: 'nampo-piers',
  officina: 'sasang-workshop',
  baia: 'busan-bay',
  ponte: 'gwangan-bridge',
  traghetti: 'busan-ferry-terminal',
  container: 'busan-container-port',
  spiaggia: 'haeundae-beach',
};
const BUSAN_FALLBACK = {
  ingresso: (c) => ({ x: c.expressway?.entry?.x ?? 0, y: (c.expressway?.entry?.y ?? 0) + 200 }),
  piazzale: (c) => c.transitStations.find((t) => t.id === 'busan-seomyeon'),
  officina: (c) => c.garages.find((g) => c.areaAt?.(g.cx, g.cy)?.id === 'busan' && g.district === 'gimpo'),
  traghetti: (c) => c.transitStations.find((t) => t.id === 'busan-nampo'),
  mercato: (c) => c.transitStations.find((t) => t.id === 'busan-jagalchi'),
};

/** Il punto asciutto e libero da solidi più vicino a (x, y), a spirale. */
function freeNear(city, x, y) {
  const ok = (px, py) => !city.isWater(px, py)
    && !city.solidGrid.queryCircle(px, py, 18).some((o) => px > o.x - 16 && px < o.x + o.w + 16 && py > o.y - 16 && py < o.y + o.h + 16);
  if (ok(x, y)) return { x, y };
  for (let r = 24; r <= 240; r += 24) {
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (ok(px, py)) return { x: px, y: py };
    }
  }
  return { x, y };
}

export function findBusan(game, key) {
  const city = game.city;
  const id = BUSAN_PLACES[key] || key;
  const lm = city.landmarks.find((l) => l.id === id && l.region === 'busan');
  const out = (x, y, landmark) => {
    // `approach` è il nodo stradale più vicino: i landmark con un edificio (il mercato, il
    // terminal) hanno il centro dentro un solido, e il blip va messo sulla strada davanti.
    const n = city.graph?.nearestNode?.(x, y);
    return { id, x, y, landmark, approach: n ? { x: n.x, y: n.y } : { x, y } };
  };
  if (lm) {
    // Sul posto può esserci un solido arrivato dopo (l'ingresso del metro nel piazzale,
    // un albergo sulla spiaggia): per i luoghi all'aperto si cerca il punto libero più vicino.
    const open = ['square', 'beach', 'checkpoint', 'workshop'].includes(lm.kind);
    const f = open ? freeNear(city, lm.x, lm.y) : { x: lm.x, y: lm.y };
    return out(f.x, f.y, lm);
  }
  const fb = BUSAN_FALLBACK[key]?.(city);
  if (fb) return out(fb.cx ?? fb.x, fb.cy ?? fb.y, null);
  const a = city.areas?.find((q) => q.id === 'busan');
  return a ? out((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2, null) : null;
}

/**
 * Il punto davanti al bancone di un piano, apparecchiato appena quel piano viene
 * aperto. Serve a mezza campagna — si riscuote, si compra, si chiede — e sta qui
 * e non in una missione perché l'hanno già chiesto in due: `floorShown` è il
 * varco unico per sapere dove sei (§5.29), e nessuno deve riscriverlo.
 *
 * Il punto si toglie e si rimette a ogni ingresso (`drop` prima di `point`): una
 * missione ripresa tre volte lascerebbe altrimenti tre punti sullo stesso banco.
 */
export function tillPoint(ctx, id, addr, text, run) {
  if (!addr) return;
  const game = ctx.game;
  const place = (shop, idx, f) => {
    if (shop.id !== addr.id || idx !== addr.level || !f.till) return;
    ctx.drop(id);
    ctx.point({ id, shop: addr.id, level: addr.level, key: 'E', text, run, reach: 52,
      x: f.till.x, y: f.till.y + 26 });
  };
  ctx.on('floorShown', place);
  const it = game.shops.active;
  if (it && game.shops.floor) place(it.shop, it.cur, game.shops.floor);
}

/**
 * Un punto libero di una pianta, il più vicino possibile a dove lo si vorrebbe.
 *
 * Serve a mettere in piedi un personaggio nominato senza sapere com'è arredata la
 * sala: le piante sono generate e un 당구장 con tre tavoli e uno con uno hanno il
 * bancone in posti diversi. Si campiona a scacchiera e si scarta quello che pesta
 * un muro o un mobile — è la stessa cosa che fa `crowd` in `interiors.js`, con la
 * differenza che qui il posto **deve** uscire, quindi in fondo c'è l'ingresso.
 */
export function freeSpot(f, prefer) {
  const anchor = prefer || (f.till ? { x: f.till.x, y: f.till.y + 26 } : f.entry);
  let best = null;
  let bestD = Infinity;
  for (let y = 26; y < f.h - 26; y += 12) {
    for (let x = 26; x < f.w - 26; x += 12) {
      const d = dist(x, y, anchor.x, anchor.y);
      if (d >= bestD) continue;
      const box = { x: x - 11, y: y - 11, w: 22, h: 22 };
      if (f.grid.queryRect(box.x, box.y, box.w, box.h).some((o) => overlap(box, o))) continue;
      bestD = d;
      best = { x, y };
    }
  }
  return best || { x: f.entry.x, y: f.entry.y };
}

/** Dietro il bancone, guardando la sala: il posto di chi tiene un banco. */
export function behindTill(f) {
  if (!f.till) return { ...freeSpot(f), angle: Math.PI / 2 };
  const p = freeSpot(f, { x: f.till.x, y: f.till.y - 24 });
  return { ...p, angle: Math.PI / 2 };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * La torre di 한성개발 a Gangnam. È **una sola per tutta la campagna** — M3 ci scende
 * con la busta, M6 ci sale a leggere i faldoni — e la ricerca vuole gli stessi
 * argomenti in tutti e due i posti, o sarebbero due torri. Per questo sta qui e non in
 * una missione. `near` è il 편의점 di Itaewon da cui M3 la cerca.
 */
export function findTower(game, near = null) {
  const from = near || findShop(game, 'conv', { district: 'itaewon', near: game.city.spawn }) || game.city.spawn;
  return findShop(game, 'office', { district: 'gangnam', near: from });
}

/**
 * Un'auto che arriva in un posto. Nasce fuori vista, sulla corsia più vicina a un
 * punto a un paio di isolati di distanza, e ci va davvero (`traffic.sendTo`).
 * Quando le strade non ci arrivano — non succede a Seoul, ma una missione non può
 * dipendere da questo — si restituisce `null` e la fase si chiude lo stesso.
 *
 * Sta qui e non in M3 perché la usa anche M6: un'auto della storia che arriva è
 * un fatto di traffico, non di una missione.
 */
export function mandaA(game, kind, from, to, opts = {}) {
  const v = game.traffic.spawnScripted(kind, from.x, from.y, game, {
    lightsOn: true, speed: opts.speed || 120, radius: opts.radius || 900, colorIndex: opts.colorIndex ?? 0,
  });
  if (!v) return null;
  if (!game.traffic.sendTo(v, to.x, to.y, game)) {
    const i = game.vehicles.indexOf(v);
    if (i >= 0) game.vehicles.splice(i, 1);
    return null;
  }
  return v;
}

/** Vera quando l'auto mandata è arrivata, o quando non c'era nessuna auto. */
export function arrivata(v, to) {
  if (!v) return true;
  if (v.dead) return true;
  return !!v.ai?.arrived || Math.hypot(v.x - to.x, v.y - to.y) < 70;
}

/**
 * L'isolato che sta attorno a una porta, e **il giro che ci fa un pedone**: i quattro angoli
 * della fascia di marciapiede (`SIDEWALK * 0.78` dal bordo, la stessa di `pedestrians.js`) in
 * senso orario, con la porta proiettata sul suo lato nel posto che le compete. Serve a chi
 * deve far camminare qualcuno **attorno a un palazzo** senza sapere com'è fatta la maglia
 * (M8): i punti sono sulla strada dei passanti, quindi nessuno li trova dentro un muro.
 *
 * `corners` sono i quattro angoli senza la porta (per spargere la folla); `door` è la porta vera, a
 * due passi dall'anello; `idx` dice a che punto del giro sta la sua proiezione. Torna `null` se la porta non cade in nessun isolato — non succede a Seoul, ma
 * una missione non deve dipendere da questo.
 */
const LATO = { top: 0, right: 1, bottom: 2, left: 3 };

export function anelloMarciapiede(game, shop) {
  if (!shop) return null;
  const blocks = game.city.blockGrid.queryRect(shop.x - 2, shop.y - 2, 4, 4);
  const block = blocks.find((b) => shop.x >= b.x && shop.x <= b.x + b.w && shop.y >= b.y && shop.y <= b.y + b.h);
  if (!block) return null;
  const m = SIDEWALK * 0.78;
  const x0 = block.x + m;
  const y0 = block.y + m;
  const x1 = block.x + block.w - m;
  const y1 = block.y + block.h - m;
  const corners = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  const side = LATO[shop.edge] ?? 0;
  // La proiezione della porta sul suo lato, tenuta lontana dagli angoli.
  const proj = { x: clampTo(shop.x, x0 + 24, x1 - 24), y: clampTo(shop.y, y0 + 24, y1 - 24) };
  const door = side === 0 ? { x: proj.x, y: y0 } : side === 2 ? { x: proj.x, y: y1 }
    : side === 1 ? { x: x1, y: proj.y } : { x: x0, y: proj.y };
  const ring = [];
  let idx = 0;
  corners.forEach((c, i) => {
    ring.push(c);
    if (i === side) { idx = ring.length; ring.push(door); }
  });
  return { block, ring, corners, idx, door: { x: shop.x, y: shop.y }, side };
}

function clampTo(v, lo, hi) {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}
