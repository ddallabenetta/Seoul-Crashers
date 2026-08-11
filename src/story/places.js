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

/**
 * Un indirizzo di missione: la vetrina e **a che piano** sta l'attività cercata.
 * Sono due cose diverse e vanno tenute insieme — il 당구장 è al primo piano di un
 * palazzo la cui insegna al pianterreno è un'altra.
 */
function addr(shop, level) {
  return { shop, id: shop.id, level, x: shop.x, y: shop.y };
}

function seoul(game, s) {
  return game.city.areaAt?.(s.x, s.y)?.id === 'seoul';
}

/**
 * La vetrina più vicina a `near` che abbia `biz` a un piano qualunque.
 *
 * `district` restringe al quartiere e **non è un vincolo duro**: se in quel
 * quartiere non c'è (succede, la maglia cambia con la seed), si riprova su tutta
 * Seoul. Meglio un 당구장 due strade più in là che una fase senza blip.
 */
export function findShop(game, biz, opts = {}) {
  const { district = null, near = game.city.spawn, avoid = [], minDist = 0 } = opts;
  const skip = new Set(avoid);
  const pick = (wantDistrict, wantMin) => {
    let best = null;
    let bestD = Infinity;
    for (const s of game.city.shops) {
      if (skip.has(s.id) || !seoul(game, s)) continue;
      if (wantDistrict && s.district !== wantDistrict) continue;
      const level = s.biz.indexOf(biz);
      if (level < 0) continue;
      const d = dist(s.x, s.y, near.x, near.y);
      if (d < wantMin || d >= bestD) continue;
      bestD = d;
      best = addr(s, level);
    }
    return best;
  };
  return pick(district, minDist) || pick(district, 0) || pick(null, minDist) || pick(null, 0);
}

/**
 * Il cortile di una banda più vicino a `near`, dentro Seoul.
 *
 * Dal §5.31 un cortile può aver cambiato padrone, e una missione che cerca «il
 * cortile del 철마파» non deve restare senza obiettivo perché il giocatore se
 * l'era preso il giorno prima: se nessuno è più di quella banda si ripiega sul
 * **padrone di nascita**, che è dove la storia lo colloca comunque.
 */
export function findTurf(game, gangId, near = game.city.spawn) {
  const pick = (of) => {
    let best = null;
    let bestD = Infinity;
    for (const t of game.city.turfs || []) {
      if (of(t) !== gangId) continue;
      const cx = t.cx;
      const cy = t.cy;
      if (game.city.areaAt?.(cx, cy)?.id !== 'seoul') continue;
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
