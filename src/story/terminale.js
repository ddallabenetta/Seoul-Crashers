// «Le sedie arancioni» — l'incontro facoltativo di Busan, fra M10 e M11.
//
// Il copione sta in `docs/storia/05-atto-3.md`. **Non è una missione, non ha un blip, e non lo segnala
// nessuno**: chi va al terminal dei traghetti di 부산항 prima delle 04:10 e si siede ad aspettare trova
// qualcuno che aspetta già. È la seconda delle tre occasioni su Dulchae (`story/dulchae.js`), e la sola
// in cui non c'è nessuno a guardare: il gioco non fa niente per impedirlo e niente per suggerirlo.
//
// Scelte che il copione non dice, prese con l'utente e da dichiarare:
//
//   · **la porta.** Il terminal è un edificio di `world/busan.js`, e i landmark non hanno vetrine. Come
//     la cella di M7, la sala è una **vetrina inventata** (`id: 'busan-attesa'`) sul lato dell'edificio
//     che guarda la strada, sempre aperta come il molo. Ci si entra anche prima di M10: è vuota;
//   · **chi aspetta già.** Fra le 02:30 e le 04:10, a M10 finita, Dulchae è seduto sulla fila di mezzo
//     (un attore d'interno). Chi entra prima delle 02:30 trova la sala vuota, e **la sedia** a tre posti
//     dalla sua: sedersi fa passare l'orologio fino alle 03:31, l'ora che dice il narratore, e quando la
//     tendina si alza lui c'è. Chi entra dopo le 03:31 si siede e basta;
//   · **dopo i pannelli se ne va camminando** fino alla porta, e lì sparisce. È il momento in cui gli si
//     può sparare, ma lo si può fare anche prima di sedersi: la scena allora non c'è, ed è il prezzo;
//   · **«fra M10 e M11»**: la sedia c'è da M10 finita in poi. Quando arriverà M11 (tappa G2) andrà
//     aggiunto che chi si è già imbarcato non lo trova più.
import { WALL } from '../world/interiors.js';
import { findBusan } from './places.js';
import { dist } from '../core/math.js';
import { dulchaeVivo } from './dulchae.js';
import {
  CYAN,
  px, py, wash, vignette, glow, hexA,
  narrator, speech,
} from '../render/panelkit.js';
import { figure, unitScale } from '../render/pixelkit.js';

const SALA = 'busan-attesa';
const ATTORE = 'dulchae-terminale';
/** Da quando Dulchae è già seduto, l'ora del narratore e l'unico traghetto della giornata. */
const DA = 2.5;
const ORA = 3 + 31 / 60;
const IMBARCO = 4 + 10 / 60;
/** La fila di mezzo, e i due posti: tre sedie di distanza. Sono quelli di `layouts.waiting`. */
const FILA = 1;
const SUO = 1;
const MIO = 4;
const ORANGE = '#f08a2a';

/** Il centro di una sedia della sala, in coordinate della pianta (`interiors.js`, `waiting`). */
function sedia(f, fila, posto) {
  const sw = 22;
  const gap = 9;
  const x0 = Math.round((f.w - (6 * sw + 5 * gap)) / 2);
  return { x: x0 + posto * (sw + gap) + sw / 2, y: WALL + 62 + fila * 50 + 10 };
}

let _sala;
/**
 * La vetrina che non c'è, sul lato del terminal più vicino alla strada. Torna `null` se Busan non c'è.
 * Si ricava e non si salva, come tutti gli indirizzi della storia (§4).
 */
function sala(game) {
  if (_sala?.city === game.city) return _sala.shop;
  const t = findBusan(game, 'traghetti');
  const b = t?.landmark?.building;
  let shop = null;
  if (b) {
    const a = t.approach;
    const lati = [
      { x: b.x + b.w / 2, y: b.y + b.h + 16, nx: 0, ny: 1, edge: 'bottom' },
      { x: b.x + b.w / 2, y: b.y - 16, nx: 0, ny: -1, edge: 'top' },
      { x: b.x - 16, y: b.y + b.h / 2, nx: -1, ny: 0, edge: 'left' },
      { x: b.x + b.w + 16, y: b.y + b.h / 2, nx: 1, ny: 0, edge: 'right' },
    ].filter((l) => !game.city.isWater(l.x, l.y));
    lati.sort((p, q) => dist(p.x, p.y, a.x, a.y) - dist(q.x, q.y, a.x, a.y));
    const l = lati[0];
    if (l) {
      shop = {
        id: SALA, x: l.x, y: l.y, nx: l.nx, ny: l.ny, edge: l.edge,
        w: 280, h: 230, building: null, district: 'docks',
        biz: ['waiting'], name: 'Sala d\'attesa', hangul: '대합실', blip: null, seed: 0x5ed1e,
      };
    }
  }
  _sala = { city: game.city, shop };
  return shop;
}

const nellOra = (h) => h >= DA && h < IMBARCO;
/** L'incontro è ancora da fare: M10 finita, la scena mai vista, lui vivo. */
const possibile = (game) => game.missions.isDone('m10') && !game.missions.flag('sedie') && dulchaeVivo(game);

function definisci(game) {
  game.actors.define(ATTORE, {
    indoor: true, shop: SALA, level: 0, kind: 'civil', look: 'hero', name: 'Dulchae', hangul: '둘째',
    state: 'post', role: 'keeper', angle: Math.PI / 2,
    place: (f) => sedia(f, FILA, SUO),
  });
}

/** Il suo pedone sul piano, se c'è; altrimenti lo mette (è «già lì» quando la tendina si alza). */
function inSala(game, f) {
  let d = f.people.find((p) => p.actor === ATTORE);
  if (d) return d;
  definisci(game);
  for (const p of game.actors.populate(SALA, 0, f, game)) if (!f.people.includes(p)) f.people.push(p);
  game.pedGrid.rebuild(game.peds);
  return f.people.find((p) => p.actor === ATTORE) || null;
}

export function attachTerminale(game) {
  const M = game.missions;

  // La porta. Sempre aperta: è un terminal, e di notte c'è la luce accesa.
  const porta = {
    id: 'sala-porta', key: 'E', text: 'entra nel 대합실 · sala d\'attesa', reach: 44, x: 0, y: 0,
    when: (g) => {
      const s = sala(g);
      if (!s) return false;
      porta.x = s.x;
      porta.y = s.y;
      return true;
    },
    run: () => {
      const s = sala(game);
      // **Prima** di entrare: è `showFloor` che mette in sala i personaggi nominati.
      if (possibile(game) && nellOra(game.dayCycle.hour)) definisci(game);
      else if (!game.actors.isDead(ATTORE)) game.actors.undefine(ATTORE);
      game.shops.enter(s, game);
    },
  };
  M.standing(porta);

  const posto = {
    id: 'sala-sedia', shop: SALA, level: 0, key: 'E', text: 'siediti ad aspettare', reach: 26, x: 0, y: 0,
    when: (g) => possibile(g) && !via.d,
    run: () => {
      const f = game.shops.floor;
      if (!f) return;
      const h = game.dayCycle.hour;
      // Fra le 03:31 e l'imbarco ci si siede e basta; prima, l'orologio gira fino alle 03:31.
      if (!(h >= ORA && h < IMBARCO)) {
        const wait = (((ORA - h) % 24) + 24) % 24;
        game.dayCycle.advance(wait);
        game.shops.fade = 2.4;
      }
      const me = sedia(f, FILA, MIO);
      game.shops.placeOnFloor(game, { x: me.x, y: me.y, angle: Math.PI / 2 });
      const d = inSala(game, f);
      if (!d || d.dead) return;
      M.playOnce(game, 'sedie', PANNELLI, () => {
        M.setFlag('sedie');
        // Se ne va camminando, prima che aprano l'imbarco: adesso è un uomo qualunque.
        d.home = { x: f.entry.x, y: f.entry.y - 12 };
        d.baseSpeed = 52;
        via.d = d;
      });
    },
  };
  M.standing(posto);
  game.on('floorShown', (shop, idx, f) => {
    if (shop.id !== SALA) return;
    const p = sedia(f, FILA, MIO);
    posto.x = p.x;
    posto.y = p.y;
  });

  // Chi se ne va. Arrivato alla porta sparisce: non esce in strada, perché non lo si rivede più fino a M12.
  const via = {
    id: 'sala-uscita', d: null, when: () => false,
    tick: () => {
      const d = via.d;
      if (!d) return;
      const f = game.shops.floor;
      const qui = game.indoors && game.shops.active?.shop.id === SALA && f?.people.includes(d);
      if (d.dead || !qui) { via.d = null; if (!d.dead) game.actors.undefine(ATTORE); return; }
      if (dist(d.x, d.y, d.home.x, d.home.y) > 16) return;
      f.people.splice(f.people.indexOf(d), 1);
      game.pedGrid.rebuild(game.peds);
      game.actors.undefine(ATTORE);
      via.d = null;
    },
  };
  M.standing(via);
}

// --- i pannelli --------------------------------------------------------------------------------

/** Il pavimento lucido della sala: grigio-azzurro, con il riflesso della luce del soffitto. */
function sala3(P, horizon) {
  const ctx = P.ctx;
  wash(P, '#2d343e', '#1a1f27', horizon);
  const g = ctx.createLinearGradient(0, py(P, horizon), 0, P.y + P.h);
  g.addColorStop(0, '#4c5560');
  g.addColorStop(1, '#2a3038');
  ctx.fillStyle = g;
  ctx.fillRect(P.x, py(P, horizon), P.w, P.h * (1 - horizon));
  // Le piastrelle: righe che si allargano verso chi guarda.
  ctx.strokeStyle = 'rgba(200,215,230,0.07)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 7; i++) {
    const y = py(P, horizon + (1 - horizon) * (i / 7) ** 1.6);
    ctx.beginPath();
    ctx.moveTo(P.x, y);
    ctx.lineTo(P.x + P.w, y);
    ctx.stroke();
  }
  // Le lampade al soffitto, riflesse sul pavimento.
  for (const u of [0.22, 0.5, 0.78]) {
    ctx.fillStyle = 'rgba(232,240,248,0.75)';
    ctx.fillRect(px(P, u - 0.06), py(P, 0.04), P.w * 0.12, P.h * 0.012);
    ctx.fillStyle = 'rgba(232,240,248,0.06)';
    ctx.fillRect(px(P, u - 0.05), py(P, horizon + 0.08), P.w * 0.1, P.h * 0.3);
  }
}

/** Una fila di sedie di plastica, vista di fronte: schienale e seduta in un pezzo solo. */
function filaSedie(P, x0, y, n, w, gap) {
  const ctx = P.ctx;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (w + gap);
    ctx.fillStyle = '#b85f17';
    ctx.fillRect(x, y - w * 0.95, w, w * 0.95);            // lo schienale
    ctx.fillStyle = ORANGE;
    ctx.fillRect(x + w * 0.06, y - w * 0.9, w * 0.88, w * 0.8);
    ctx.fillStyle = '#d0741f';
    ctx.fillRect(x - w * 0.04, y - w * 0.12, w * 1.08, w * 0.22); // la seduta
  }
  // La trave d'acciaio sotto, che le tiene in fila.
  ctx.fillStyle = '#6d7682';
  ctx.fillRect(x0 - w * 0.1, y + w * 0.1, n * (w + gap) - gap + w * 0.2, w * 0.08);
  for (const u of [0.1, 0.9]) ctx.fillRect(x0 + (n * (w + gap)) * u, y + w * 0.18, w * 0.1, w * 0.45);
}

/** Il distributore acceso: l'unica luce calda della sala. */
function distributore(P, x, y, w, h) {
  const ctx = P.ctx;
  glow(P, x + w / 2, y + h * 0.4, w * 1.6, '#d8f0ff', 0.18);
  ctx.fillStyle = '#c23a3a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#e8f4ff';
  ctx.fillRect(x + w * 0.1, y + h * 0.08, w * 0.62, h * 0.55);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = ['#3a7bd5', '#f0c33c', '#4fb06a', '#e2584a'][(r + c) % 4];
      ctx.fillRect(x + w * (0.15 + c * 0.19), y + h * (0.12 + r * 0.13), w * 0.12, h * 0.08);
    }
  }
  ctx.fillStyle = '#1a1d22';
  ctx.fillRect(x + w * 0.78, y + h * 0.2, w * 0.12, h * 0.2);
  ctx.fillRect(x + w * 0.15, y + h * 0.75, w * 0.5, h * 0.1);
}

/** Un avambraccio sul bracciolo, con la mano: la manica nera del bomber e la pelle. */
function braccio(P, x, y, w, flip) {
  const ctx = P.ctx;
  const s = flip ? -1 : 1;
  ctx.fillStyle = '#15171d';
  ctx.fillRect(flip ? x - w : x, y - w * 0.14, w, w * 0.28);
  ctx.fillStyle = '#2a2d36';
  ctx.fillRect(flip ? x - w : x, y - w * 0.14, w, w * 0.06);
  // Il polsino a coste.
  ctx.fillStyle = '#23262e';
  ctx.fillRect(x + s * w * 0.02 - (flip ? w * 0.08 : 0), y - w * 0.15, w * 0.08, w * 0.3);
  // La mano, aperta e ferma sul bracciolo.
  ctx.fillStyle = '#d9a982';
  const hx = flip ? x - w - w * 0.34 : x + w;
  ctx.fillRect(hx, y - w * 0.12, w * 0.34, w * 0.24);
  ctx.fillStyle = '#b9876a';
  ctx.fillRect(hx, y + w * 0.06, w * 0.34, w * 0.06);
}

export const PANNELLI = [
  {
    // La sala, di fronte. Le tre file di sedie, il distributore acceso in fondo, e due uomini sulla
    // stessa fila **a tre sedie di distanza**, con lo stesso bomber. Sono piccoli apposta: si contano
    // le sedie prima di guardarli in faccia.
    id: 'sedie-1',
    draw(P) {
      sala3(P, 0.42);
      const ctx = P.ctx;
      // La vetrata sul molo, buia: di là c'è solo il traghetto con le luci di posizione.
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(px(P, 0.04), py(P, 0.1), P.w * 0.62, P.h * 0.28);
      ctx.fillStyle = '#3c4654';
      for (let i = 0; i <= 6; i++) ctx.fillRect(px(P, 0.04 + i * 0.1033), py(P, 0.1), 2, P.h * 0.28);
      glow(P, px(P, 0.3), py(P, 0.33), P.h * 0.05, '#ffcf6b', 0.4);
      ctx.fillStyle = '#ffcf6b';
      ctx.fillRect(px(P, 0.3), py(P, 0.33), 3, 3);
      ctx.fillStyle = '#e8595e';
      ctx.fillRect(px(P, 0.48), py(P, 0.34), 3, 3);
      distributore(P, px(P, 0.8), py(P, 0.14), P.w * 0.09, P.h * 0.3);
      const w = P.w * 0.055;
      const gap = P.w * 0.012;
      const x0 = px(P, 0.5) - (6 * w + 5 * gap) / 2;
      filaSedie(P, x0 + w * 0.3, py(P, 0.52), 6, w * 0.8, gap * 0.8);
      // La fila di mezzo, e loro due: al secondo posto e al quinto.
      const k = unitScale(P, 0.24, 40);
      const yy = py(P, 0.7);
      filaSedie(P, x0, yy, 6, w, gap);
      const posto = (i) => x0 + i * (w + gap) + w / 2;
      figure(P, 'dulchae', posto(1), yy + w * 0.1, k, 'seat', { crop: 40, mood: 'fermo' });
      figure(P, 'jaemin', posto(4), yy + w * 0.1, k, 'seat', { crop: 40, mood: 'fermo' });
      filaSedie(P, x0 - w * 0.4, py(P, 0.95), 6, w * 1.2, gap * 1.2);
      vignette(P, 0.45);
      narrator(P, '03:31. Il traghetto delle 04:10 è l\'unico della giornata.');
    },
  },
  {
    // A mezzo busto, tutti e due di fronte, **nessuno voltato verso l'altro**: guardano la vetrata.
    // È lo stesso pannello due volte, e l'unica differenza è chi parla.
    id: 'sedie-2',
    draw(P) {
      sala3(P, 0.62);
      const ctx = P.ctx;
      ctx.fillStyle = ORANGE;
      ctx.fillRect(P.x, py(P, 0.6), P.w, P.h * 0.08);
      const k = unitScale(P, 0.5, 36);
      figure(P, 'dulchae', px(P, 0.27), py(P, 0.66), k, 'stand', { crop: 36, mood: 'parla' });
      figure(P, 'jaemin', px(P, 0.73), py(P, 0.66), k, 'stand', { crop: 36, mood: 'fermo' });
      // Lo spazio vuoto in mezzo: le tre sedie fra loro.
      ctx.fillStyle = hexA('#000000', 0.18);
      ctx.fillRect(px(P, 0.42), py(P, 0.2), P.w * 0.16, P.h * 0.46);
      vignette(P, 0.5);
      speech(P, [
        { who: 'Jae-min', text: '«Mi hai seguito.»' },
        { who: 'Dulchae', text: '«Sapevo l\'orario. Non è la stessa cosa.»' },
        { who: 'Jae-min', text: '«E come lo sapevi.»' },
        { who: 'Dulchae', text: '«Perché è l\'unico traghetto, hyung. Chi va là va con quello.»' },
      ]);
    },
  },
  {
    // I braccioli. Quattro mani appoggiate, due per uomo, e **nessuna destra è in tasca**: è la sola
    // tavola del gioco in cui la mano di Dulchae si vede.
    id: 'sedie-3',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#3a414b', '#22272f', 1);
      const y1 = py(P, 0.2);
      const y2 = py(P, 0.38);
      // Due braccioli d'acciaio su plastica arancione, a sinistra e a destra.
      for (const [x, w] of [[px(P, 0.04), P.w * 0.4], [px(P, 0.56), P.w * 0.4]]) {
        ctx.fillStyle = ORANGE;
        ctx.fillRect(x, py(P, 0.1), w, P.h * 0.4);
        ctx.fillStyle = '#c96a1c';
        ctx.fillRect(x, py(P, 0.46), w, P.h * 0.04);
        ctx.fillStyle = '#7b8592';
        ctx.fillRect(x, y1 + P.h * 0.03, w, P.h * 0.03);
        ctx.fillRect(x, y2 + P.h * 0.03, w, P.h * 0.03);
      }
      const a = P.w * 0.2;
      braccio(P, px(P, 0.06), y1, a, false);
      braccio(P, px(P, 0.06), y2, a, false);
      braccio(P, px(P, 0.94), y1, a, true);
      braccio(P, px(P, 0.94), y2, a, true);
      vignette(P, 0.4);
      speech(P, [
        { note: true, text: 'Nessuna delle due destre è in tasca.' },
        { who: 'Jae-min', text: '«Perché non mi fermi?»' },
        { who: 'Dulchae', text: '«Perché quando torni avrai visto una cosa che io vedo da dodici anni.» (pausa) «E per la prima volta la sapremo in due.»' },
        { who: 'Jae-min', text: '«E se poi la racconto?»' },
        { who: 'Dulchae', text: '«A chi? Il nome che serve per raccontarla ce l\'ho io.»' },
      ]);
    },
  },
  {
    // Lui che se ne va prima che aprano l'imbarco, di spalle verso la porta: la banda rossa è l'ultima
    // cosa. Jae-min resta seduto, piccolo, in mezzo alla fila arancione.
    id: 'sedie-4',
    draw(P) {
      sala3(P, 0.46);
      const ctx = P.ctx;
      // La porta in fondo, aperta sulla notte del molo.
      ctx.fillStyle = '#0a0f18';
      ctx.fillRect(px(P, 0.62), py(P, 0.12), P.w * 0.14, P.h * 0.34);
      ctx.strokeStyle = '#8b96a5';
      ctx.lineWidth = 2;
      ctx.strokeRect(px(P, 0.62), py(P, 0.12), P.w * 0.14, P.h * 0.34);
      ctx.fillStyle = CYAN;
      ctx.font = `700 ${Math.round(P.h * 0.03)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('출구', px(P, 0.69), py(P, 0.1));
      ctx.textAlign = 'left';
      figure(P, 'dulchae', px(P, 0.69), py(P, 0.5), unitScale(P, 0.26, 50), 'back', { crop: 50 });
      const w = P.w * 0.07;
      const gap = P.w * 0.012;
      const x0 = px(P, 0.04);
      filaSedie(P, x0, py(P, 0.8), 6, w, gap);
      figure(P, 'jaemin', x0 + 4 * (w + gap) + w / 2, py(P, 0.8) + w * 0.1, unitScale(P, 0.3, 40), 'seat', { crop: 40, mood: 'giu' });
      vignette(P, 0.5);
      speech(P, [
        { who: 'Dulchae', text: '(senza voltarsi) «Portati una giacca. A Jeju piove poco, ma di notte tira.»' },
        { note: true, text: 'Jae-min non ha detto dove va.' },
      ]);
    },
  },
];

