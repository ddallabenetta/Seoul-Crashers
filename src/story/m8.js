// M8 · «Il volto in mezzo alla folla» — 인파 속의 얼굴
//
// Il copione sta in `docs/storia/04-atto-2.md`. Myeongdong, il pomeriggio del nove: **un
// bomber identico al tuo, nella folla, e nessun marcatore** — chi lo cerca deve riconoscere
// la banda rossa sulla schiena. È il secondo ribaltamento dell'Atto II: c'è un altro uomo che
// porta il suo nome, e ha la sua faccia.
//
// Quello che la missione chiede al motore, e che il motore adesso sa:
//
//   · **un pedinamento a piedi** (`core/tail.js` non vuole più un veicolo: il bersaglio è
//     un pedone). Le soglie sono altre — qui «troppo vicino» è un marciapiede, non una
//     strada a quattro corsie — e le passa questo file; M3 e M6 non sono cambiate di una riga;
//   · **un pedone che segue una fila di punti** (`state: 'goto'`, `entities/pedestrians.js`):
//     l'altro Jae-min fa il giro dell'isolato sulla fascia dei passanti, poi, quando si accorge,
//     la stessa fascia di corsa fino a una porta. Non è un attore (`entities/actors.js`): vive
//     nella folla, e **la folla l'ho messa io** — sedici passanti e quattro teppisti in nero,
//     che hanno la giacca ma non la banda: è quello che fa del riconoscerlo una scelta;
//   · **un cortile cieco** dietro una porta vera. La città non ha vicoli in cui ci si perda a
//     Myeongdong (le piante con un cortile raggiungibile sono dodici in tutta Seoul, e nessuna
//     è lì): la porta di un 분식 di Myeongdong, **per questa missione**, dà sul cortile
//     (`shops.stageShop`) — stessa insegna, altra stanza. Finita la missione la porta torna
//     quella di prima.
//
// Scelte che il copione non dice, e vanno dichiarate:
//
//   · **a piedi, e basta.** Il copione manda l'inseguimento sui tetti, poi in macchina, poi in
//     metro («se il giocatore è lento»). Qui si corre per le strade dell'isolato fino al
//     portone: i tetti non esistono, l'auto è un'altra missione (M6) e con le stelle addosso i
//     tornelli restano chiusi (`metro.enterStation`). Si perde chi resta indietro (lo stesso
//     fallimento di M3 e M6: la fase riparte), non chi è lento a trovare una macchina;
//   · **la polizia è dietro a te.** Alla rottura il ricercato sale a due stelle e il toast della
//     radio dà il nome — **il tuo**: è il momento in cui la storia e il sistema di ricercato
//     diventano la stessa cosa. Nel cortile il ricercato resta congelato (§5.8), e fuori si
//     ritrovano le volanti;
//   · **non c'è la scelta di sparare.** `10-continuita.md` conta il cortile cieco fra le tre
//     occasioni di uccidere Dulchae: qui la scena è un fatto di pannelli, e quella decisione
//     resta ai finali (tappa H), dove il conto dell'«Altro» ha il suo posto;
//   · **la sorella arriva da un messaggio**, perché è un messaggio che il copione dice (un
//     numero non in rubrica). Il 피시방 sta aperto **per la missione** (`shops.hold`): alle
//     undici del mattino non apre mai, e l'orario si aspetta come quello di M6.
import { panelPhase } from '../core/missions.js';
import { findShop, findTurf, anelloMarciapiede } from './places.js';
import { createPed } from '../entities/pedestrians.js';
import { dist } from '../core/math.js';
import {
  CYAN, BLOOD, PAPER,
  px, py, wash, vignette, glow, hexA, hash,
  narrator, speech,
} from '../render/panelkit.js';
import { figure, head, unitScale } from '../render/pixelkit.js';

/** Le undici del mattino: Mi-rae, e un 피시방 vuoto. */
const MATTINA = 11;
const MATTINA_DA = 10.5;
const MATTINA_A = 12;
/** Le due del pomeriggio: l'ora della busta. Si parte un quarto d'ora prima. */
const BUSTA = 13.75;
const BUSTA_A = 15.5;
const ARRIVO = 260;
/** Da che distanza Dulchae è «in vista»: comincia il pedinamento. */
const IN_VISTA = 320;
/** Le due soglie a piedi: sotto SPOT ti ha visto, sopra LOSE l'hai perso. */
const SPOT = 62;
const LOSE = 360;
/** Quanto dura il pedinamento riuscito prima che l'altro si accorga lo stesso. */
const PEDINA_TEMPO = 36;
/** Velocità: a passeggio come la folla, e di corsa un po' meno dello scatto di Jae-min (126). */
const CAMMINA = 50;
const CORRE = 86;
/** Chi resta oltre questa distanza per questo tempo, lo perde. */
const SFUGGITO = 470;
const SFUGGITO_TEMPO = 6.5;
const PASSANTI = 16;
const TEPPISTI = 4;

function sites(game) {
  if (M8._sites) return M8._sites;
  const from = game.city.spawn;
  // **Terzo piano**, se esiste: il copione lo dice, e chi guarda la colonna di insegne lo vede.
  const pc = findShop(game, 'pcbang', { district: 'hongdae', near: from, level: 2 });
  // La porta del cortile: un 분식 di Myeongdong, aperto a ora di pranzo e di pomeriggio.
  // `visible`: quello che dice l'HUD. A Myeongdong i bordi fra i distretti non coincidono con le
  // etichette di generazione. Si parte dal cortile del 황소파, che sta lì per costruzione.
  const centro = findTurf(game, 'hwangso') || game.city.spawn;
  const porta = findShop(game, 'bunsik', { district: 'myeongdong', near: centro, visible: true });
  const giro = porta ? anelloMarciapiede(game, porta.shop) : null;
  M8._sites = { pc, porta, giro };
  return M8._sites;
}

/** La vetrina che sta dietro la porta per questa missione: stesso `id`, un'altra pianta. */
function cortile(shop) {
  return {
    ...shop,
    // Senza `building`: la pianta non ha l'uscita sul retro, ed è **cieca** — è il suo nome.
    building: null,
    biz: ['yard'], w: 200, h: 170, name: 'Cortile cieco', hangul: '막다른 골목',
    seed: (shop.seed ^ 0xc07715) >>> 0,
  };
}

function apparecchia(game) {
  const s = sites(game);
  if (!s.porta) return;
  game.shops.hold(s.porta.id);
  game.shops.stageShop(s.porta.id, cortile(s.porta.shop));
}

function sgombera(game) {
  const s = sites(game);
  if (s.porta) {
    game.shops.release(s.porta.id);
    game.shops.unstage(s.porta.id);
  }
  game.actors.undefine('dulchae-cortile');
  tolgo(game);
}

// --- Dulchae, e la folla --------------------------------------------------------------------

/** L'altro Jae-min, se c'è ancora. */
const dulchae = () => (M8._d && !M8._d.gone && !M8._d.dead ? M8._d : null);

function tolgo(game) {
  const d = M8._d;
  if (d) {
    d.gone = true;
    const i = game.pedSystem.peds.indexOf(d);
    if (i >= 0) game.pedSystem.peds.splice(i, 1);
  }
  M8._d = null;
  for (const p of M8._folla || []) {
    p.gone = true;
    const i = game.pedSystem.peds.indexOf(p);
    if (i >= 0) game.pedSystem.peds.splice(i, 1);
  }
  M8._folla = [];
  game.pedGrid.rebuild(game.peds);
}

/**
 * Lo mette in strada. Parte da un punto dell'anello **lontano da chi guarda** (almeno 300 px
 * dal giocatore) e cammina in senso orario. `hp` alto: non è lui che si deve poter
 * ammazzare in strada, e un pugno non fa la differenza.
 */
function mettiDulchae(game) {
  const s = sites(game);
  const { ring, idx } = s.giro;
  const pl = game.player;
  let best = 0;
  let bd = -1;
  ring.forEach((p, i) => {
    const d = dist(p.x, p.y, pl.x, pl.y);
    if (d > bd && d < 700) { bd = d; best = i; }
  });
  // Lui è già un po' avanti rispetto al punto: così il primo bersaglio è l'angolo dopo.
  const p0 = ring[best];
  const next = (best + 1) % ring.length;
  const p = createPed('civil', p0.x, p0.y, game.actors.rng);
  p.look = 'hero';
  p.actor = 'dulchae';
  p.hp = 9999;
  p.maxHp = 9999;
  p.state = 'goto';
  p.goto = { path: ring, i: next, loop: true, speed: CAMMINA };
  p.baseSpeed = CAMMINA;
  game.pedSystem.peds.push(p);
  M8._d = p;
  return best;
}

/** La folla attorno all'isolato: passanti normali, e quattro in nero senza la banda. */
function mettiFolla(game) {
  const s = sites(game);
  const { block: b, corners } = s.giro;
  const rng = game.actors.rng;
  const out = [];
  const lati = [0, 1, 2, 3];
  for (let i = 0; i < PASSANTI + TEPPISTI; i++) {
    const side = lati[i % 4];
    const t = 0.08 + ((i * 0.37 + rng.next() * 0.3) % 0.84);
    const a = corners[side];
    const c = corners[(side + 1) % 4];
    const x = a.x + (c.x - a.x) * t;
    const y = a.y + (c.y - a.y) * t;
    const kind = i < TEPPISTI ? 'gangster' : ['civil', 'office', 'student', 'tourist'][i % 4];
    const ped = createPed(kind, x, y, rng);
    ped.armed = false;
    ped.block = b;
    ped.side = side;
    ped.t = Math.min(0.95, Math.max(0.05, t));
    ped.dirSign = i % 3 === 0 ? -1 : 1;
    game.pedSystem.peds.push(ped);
    out.push(ped);
  }
  M8._folla = out;
}

/** Il percorso di corsa: da dove sta, in avanti sull'anello, fino alla porta. */
function percorsoFuga(game) {
  const s = sites(game);
  const d = dulchae();
  const { ring, idx, door } = s.giro;
  const g = d.goto;
  const path = [];
  let i = g.i;
  for (let n = 0; n < ring.length + 1; n++) {
    path.push(ring[i]);
    if (i === idx) break;
    i = (i + 1) % ring.length;
  }
  path.push({ x: door.x, y: door.y });
  return path;
}

/** Quanto manca alla porta, in px, se continua a camminare in senso orario. */
function manca(game) {
  const s = sites(game);
  const d = dulchae();
  if (!d || !d.goto) return Infinity;
  const { ring, idx } = s.giro;
  let tot = dist(d.x, d.y, ring[d.goto.i].x, ring[d.goto.i].y);
  let i = d.goto.i;
  for (let n = 0; n < ring.length && i !== idx; n++) {
    const j = (i + 1) % ring.length;
    tot += dist(ring[i].x, ring[i].y, ring[j].x, ring[j].y);
    i = j;
  }
  return tot;
}

// --- i pannelli ----------------------------------------------------------------------------------

/** Le cuffie al collo di Mi-rae: la fascia dietro il collo e due padiglioni ciano. */
function cuffie(P, f) {
  const ctx = P.ctx;
  const k = f.k;
  ctx.fillStyle = '#10141c';
  ctx.fillRect(f.x + 6 * k, f.y + 23 * k, 12 * k, 2 * k);
  ctx.fillStyle = CYAN;
  ctx.fillRect(f.x + 4 * k, f.y + 24 * k, 4 * k, 6 * k);
  ctx.fillRect(f.x + 16 * k, f.y + 24 * k, 4 * k, 6 * k);
  ctx.fillStyle = '#0a2c38';
  ctx.fillRect(f.x + 5 * k, f.y + 25 * k, 2 * k, 4 * k);
  ctx.fillRect(f.x + 17 * k, f.y + 25 * k, 2 * k, 4 * k);
}

/** Le cuffie **in testa**: i due padiglioni sulle orecchie e l'archetto sopra i capelli. */
function cuffieInTesta(P, f) {
  const ctx = P.ctx;
  const k = f.k;
  ctx.fillStyle = '#10141c';
  ctx.fillRect(f.x + 3 * k, f.y + 1 * k, 18 * k, 2 * k);
  ctx.fillRect(f.x + 3 * k, f.y + 2 * k, 2 * k, 11 * k);
  ctx.fillRect(f.x + 19 * k, f.y + 2 * k, 2 * k, 11 * k);
  ctx.fillStyle = CYAN;
  ctx.fillRect(f.x + 1 * k, f.y + 10 * k, 4 * k, 7 * k);
  ctx.fillRect(f.x + 19 * k, f.y + 10 * k, 4 * k, 7 * k);
}

/** Trenta schermi in tre file: la sala di un 피시방 vista da chi entra. */
function sala(P, accesi = 30) {
  const ctx = P.ctx;
  wash(P, '#0a1019', '#05080d', 0.6);
  let n = 0;
  for (let r = 0; r < 3; r++) {
    ctx.fillStyle = '#10161f';
    ctx.fillRect(P.x, py(P, 0.2 + r * 0.17), P.w, P.h * 0.012);
    for (let c = 0; c < 10; c++) {
      const x = px(P, 0.03 + c * 0.097);
      const y = py(P, 0.1 + r * 0.17);
      const w = P.w * 0.07;
      const h = P.h * 0.085;
      const on = n++ < accesi;
      ctx.fillStyle = '#0c1118';
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      ctx.fillStyle = on ? hexA(CYAN, 0.35 + hash(n * 3.3) * 0.4) : '#0e141b';
      ctx.fillRect(x, y, w, h);
      if (on) glow(P, x + w / 2, y + h / 2, P.h * 0.1, CYAN, 0.16);
      ctx.fillStyle = '#0c1118';
      ctx.fillRect(x + w * 0.4, y + h + 3, w * 0.2, P.h * 0.012);
    }
  }
}

/** Una carta d'identità: foto con la testa del cast, il nome e il numero velato. */
function carta(P, x, y, w, h) {
  const ctx = P.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x + 4, y + 5, w, h);
  ctx.fillStyle = '#e9ecef';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2f4f8c';
  ctx.fillRect(x, y, w, h * 0.13);
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(h * 0.085)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
  ctx.fillText('주민등록증', x + w * 0.05, y + h * 0.1);
  // La foto: **la stessa testa**, in tutte e due le carte. È il punto del pannello.
  ctx.fillStyle = '#cfd6df';
  ctx.fillRect(x + w * 0.05, y + h * 0.2, w * 0.3, h * 0.6);
  head(P, 'jaemin', x + w * 0.2, y + h * 0.28, Math.max(1, Math.floor((h * 0.4) / 24)), {});
  ctx.fillStyle = '#15181e';
  ctx.font = `800 ${Math.round(h * 0.2)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
  ctx.fillText('서재민', x + w * 0.4, y + h * 0.42);
  ctx.font = `600 ${Math.round(h * 0.085)}px ui-monospace, monospace`;
  ctx.fillStyle = 'rgba(21,24,30,0.78)';
  ctx.fillText('920***-1******', x + w * 0.4, y + h * 0.62);
  ctx.fillStyle = 'rgba(21,24,30,0.3)';
  ctx.fillRect(x + w * 0.4, y + h * 0.72, w * 0.5, h * 0.035);
  ctx.fillRect(x + w * 0.4, y + h * 0.8, w * 0.38, h * 0.035);
}

/** Il cortile cieco visto da dentro: quattro muri alti e il cielo di un pomeriggio. */
function muri(P) {
  const ctx = P.ctx;
  wash(P, '#5a5f6b', '#8c8576', 0.55);
  ctx.fillStyle = '#3a3733';                                    // i palazzi tutt'attorno
  ctx.fillRect(P.x, P.y, P.w * 0.2, P.h * 0.62);
  ctx.fillRect(px(P, 0.8), P.y, P.w * 0.2, P.h * 0.62);
  ctx.fillStyle = '#4a4640';
  ctx.fillRect(px(P, 0.2), py(P, 0.04), P.w * 0.6, P.h * 0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < 6; i++) ctx.fillRect(px(P, 0.22 + i * 0.095), py(P, 0.08), P.w * 0.05, P.h * 0.07);
  ctx.fillStyle = '#6e6a60';                                    // il selciato
  ctx.fillRect(P.x, py(P, 0.62), P.w, P.h * 0.38);
  ctx.fillStyle = 'rgba(30,28,24,0.2)';
  for (let i = 0; i < 50; i++) ctx.fillRect(px(P, hash(i * 2.7)), py(P, 0.64 + hash(i * 6.1) * 0.34), P.w * 0.012, 2);
  // Casse e un fusto, dalla parte.
  ctx.fillStyle = '#6b5436';
  ctx.fillRect(px(P, 0.06), py(P, 0.5), P.w * 0.08, P.h * 0.12);
  ctx.fillStyle = '#33424f';
  ctx.fillRect(px(P, 0.88), py(P, 0.5), P.w * 0.045, P.h * 0.12);
}

/** Una telecamera sul muro, con il led e il cono che guarda in basso. */
function telecamera(P, x, y, verso, color = '#ff4a3a') {
  const ctx = P.ctx;
  ctx.fillStyle = hexA(color, 0.12);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(verso.x - P.w * 0.05, verso.y);
  ctx.lineTo(verso.x + P.w * 0.05, verso.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1c2026';
  ctx.fillRect(x - P.w * 0.014, y - P.h * 0.014, P.w * 0.028, P.h * 0.028);
  ctx.fillStyle = color;
  ctx.fillRect(x + P.w * 0.004, y - P.h * 0.008, P.w * 0.006, P.w * 0.006);
}

/** Nove fermi immagine di videosorveglianza, appesi con lo scotch. */
const FOTOGRAMMI = [
  ['2014-10-09 14:02', '#4a5568'], ['2015-03-09 14:11', '#5d6270'], ['2016-12-09 13:58', '#3f4a5c'],
  ['2018-06-09 14:07', '#596071'], ['2019-11-09 14:00', '#464e60'], ['2021-04-09 14:05', '#5a5f6c'],
  ['2024-05-09 14:09', '#4d5566'], ['2025-09-14 14:03', '#3d4658'], ['2026-07-22 09:41', '#525a6c'],
];

export const APERTURA = [
  {
    // Il 피시방 alle undici del mattino: **trenta schermi accesi e nessun cliente**. Mi-rae
    // sta a destra, fuori dalla fascia del narratore; le cuffie sono al collo.
    id: 'm8-1',
    draw(P) {
      sala(P);
      vignette(P, 0.45);
      const f = figure(P, 'mirae', px(P, 0.8), py(P, 0.64), unitScale(P, 0.5, 32), 'stand', { crop: 32, mood: 'parla' });
      cuffie(P, f);
      figure(P, 'jaemin', px(P, 0.5), py(P, 0.62), unitScale(P, 0.42, 36), 'back', { crop: 36 });
      narrator(P, '서미래 · Seo Mi-rae, 19 anni. Tiene questo 피시방 — la sala computer — e ci fa il turno di notte.');
      speech(P, [
        { who: 'Mi-rae', text: '«Sei più vecchio della foto.»' },
        { who: 'Jae-min', text: '«Quale foto.»' },
        { who: 'Mi-rae', text: '«Quella del ventidue luglio. Quella dell\'anno scorso. E quella di due anni fa a Busan.»' },
      ]);
    },
  },
  {
    // Nove fermi immagine appesi con lo scotch. **Nove volte lo stesso bomber**, nove posti,
    // dodici anni: la riga in basso è una data per foto. Tre di queste sono quelle del
    // pannello dopo (22 luglio 2026, 14 settembre 2025 e 9 maggio 2024).
    id: 'm8-2',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#2c2a27', '#1d1b19', 0.6);
      ctx.fillStyle = '#3a3733';
      ctx.fillRect(px(P, 0.1), py(P, 0.2), P.w * 0.8, P.h * 0.78);
      const cw = P.w * 0.23;
      const ch = P.h * 0.23;
      FOTOGRAMMI.forEach(([data, tint], i) => {
        const c = i % 3;
        const r = Math.floor(i / 3);
        const x = px(P, 0.17 + c * 0.27) + (hash(i * 3.1) - 0.5) * P.w * 0.012;
        const y = py(P, 0.24 + r * 0.25);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x + 3, y + 4, cw, ch);
        ctx.fillStyle = tint;
        ctx.fillRect(x, y, cw, ch);
        // Un fondo qualunque: la linea di un marciapiede e il bordo di un palazzo.
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y + ch * 0.66, cw, ch * 0.34);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + cw * (0.1 + hash(i * 7.7) * 0.5), y, cw * 0.2, ch * 0.66);
        const k = Math.max(1, Math.round(P.h / 330));
        figure(P, 'dulchae', x + cw * (0.35 + hash(i * 5.1) * 0.3), y + ch * 0.97, k, 'back', { crop: 36, pocket: 1 });
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x, y + ch - P.h * 0.036, cw, P.h * 0.036);
        ctx.fillStyle = '#e8ecd8';
        ctx.font = `600 ${Math.round(P.h * 0.026)}px ui-monospace, monospace`;
        ctx.fillText(data, x + cw * 0.04, y + ch - P.h * 0.01);
        ctx.fillStyle = 'rgba(232,228,206,0.7)';                // lo scotch
        ctx.fillRect(x + cw * 0.38, y - P.h * 0.012, cw * 0.24, P.h * 0.03);
      });
      vignette(P, 0.4);
      narrator(P, 'Nove fotogrammi, nove date.');
    },
  },
  {
    // Il passaporto aperto, e **tre timbri che coincidono con tre di quelle date**. Non è una
    // prova che il copione chiede di capire: è un fatto, e si legge.
    id: 'm8-3',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#1e2127', '#101216', 0.5);
      const w = P.w * 0.46;
      const h = P.h * 0.58;
      const x0 = px(P, 0.5) - w;
      const y0 = py(P, 0.26);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x0 + 6, y0 + 8, w * 2, h);
      ctx.fillStyle = '#e5dcc4';
      ctx.fillRect(x0, y0, w * 2, h);
      ctx.fillStyle = 'rgba(60,50,30,0.35)';
      ctx.fillRect(px(P, 0.5) - 1.5, y0, 3, h);
      ctx.fillStyle = '#2a3b57';
      ctx.fillRect(x0, y0, w * 0.04, h);
      // I timbri, sulla pagina destra: tre, storti, in tre inchiostri.
      const timbri = [['LAX', '2026.07.22', '#2f4f9a', -0.08], ['LAX', '2025.09.14', '#9a2f3b', 0.05], ['LAX', '2024.05.09', '#2f7a4a', -0.03]];
      timbri.forEach(([luogo, data, col, tilt], i) => {
        ctx.save();
        ctx.translate(px(P, 0.5) + w * 0.5, y0 + h * (0.22 + i * 0.28));
        ctx.rotate(tilt);
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = Math.max(2, P.h * 0.006);
        ctx.strokeRect(-w * 0.3, -h * 0.09, w * 0.6, h * 0.18);
        ctx.textAlign = 'center';
        ctx.font = `800 ${Math.round(P.h * 0.04)}px ui-monospace, monospace`;
        ctx.fillText(luogo, 0, -h * 0.015);
        ctx.font = `700 ${Math.round(P.h * 0.03)}px ui-monospace, monospace`;
        ctx.fillText(data, 0, h * 0.06);
        ctx.restore();
      });
      // La pagina sinistra: la foto e il nome, e **sotto, tre fotogrammi** con le stesse date.
      ctx.fillStyle = '#c9ced8';
      ctx.fillRect(x0 + w * 0.12, y0 + h * 0.1, w * 0.34, h * 0.4);
      head(P, 'jaemin', x0 + w * 0.29, y0 + h * 0.14, Math.max(1, Math.floor((h * 0.3) / 24)), {});
      ctx.fillStyle = '#15181e';
      ctx.font = `800 ${Math.round(P.h * 0.04)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.fillText('SEO JAE MIN', x0 + w * 0.12, y0 + h * 0.62);
      ctx.textAlign = 'left';
      for (let i = 0; i < 3; i++) {
        const fx = x0 + w * (0.08 + i * 0.3);
        ctx.fillStyle = FOTOGRAMMI[6 + i][1];
        ctx.fillRect(fx, y0 + h * 0.74, w * 0.26, h * 0.2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(fx, y0 + h * 0.74 + h * 0.2 - P.h * 0.03, w * 0.26, P.h * 0.03);
        ctx.fillStyle = '#e8ecd8';
        ctx.font = `600 ${Math.round(P.h * 0.02)}px ui-monospace, monospace`;
        ctx.fillText(FOTOGRAMMI[6 + i][0].slice(0, 10), fx + w * 0.012, y0 + h * 0.74 + h * 0.2 - P.h * 0.008);
      }
      vignette(P, 0.4);
      narrator(P, 'In tre di quelle date era a Los Angeles. Ci sono i timbri.');
    },
  },
  {
    // **Il telefono**, e la prima metà della battuta. Il copione la tiene in una tavola sola:
    // è lunga per un riquadro, e si divide in tre (§5.33: si taglia o si divide).
    id: 'm8-4',
    draw(P) {
      const ctx = P.ctx;
      sala(P, 24);
      vignette(P, 0.5);
      const f = figure(P, 'mirae', px(P, 0.7), py(P, 0.64), unitScale(P, 0.5, 32), 'stand', { crop: 32, mood: 'parla' });
      cuffie(P, f);
      // Il braccio teso verso sinistra, con il telefono in mano: lo si offre a chi guarda.
      const k = f.k;
      ctx.fillStyle = '#4a6180';
      ctx.fillRect(f.x - 12 * k, f.y + 29 * k, 14 * k, 3 * k);
      ctx.fillStyle = '#d3a37c';
      ctx.fillRect(f.x - 15 * k, f.y + 28 * k, 4 * k, 4 * k);
      ctx.fillStyle = '#0b0e13';
      ctx.fillRect(f.x - 22 * k, f.y + 24 * k, 8 * k, 12 * k);
      ctx.fillStyle = '#7fb2d8';
      ctx.fillRect(f.x - 21 * k, f.y + 25 * k, 6 * k, 10 * k);
      speech(P, [
        { who: 'Mi-rae', text: '«Oggi è il nove. Alle due del pomeriggio uno con il tuo giubbotto ritira una busta a 명동. Lo fa il nove di ogni mese, da sempre.»' },
        { who: 'Jae-min', text: '«Perché mi aiuti?»' },
      ]);
    },
  },
  {
    id: 'm8-5',
    draw(P) {
      sala(P, 24);
      vignette(P, 0.5);
      const f = figure(P, 'mirae', px(P, 0.74), py(P, 0.5), unitScale(P, 0.3, 32), 'stand', { crop: 32, mood: 'giu' });
      cuffie(P, f);
      figure(P, 'jaemin', px(P, 0.28), py(P, 0.5), unitScale(P, 0.3, 32), 'back', { crop: 32 });
      speech(P, [
        { who: 'Mi-rae', text: '«Perché il nove di ogni mese arrivavano dei soldi anche a me, sempre dallo stesso conto. Il mese scorso non sono arrivati. O mio padre è morto, o ha smesso di volermi bene, e voglio sapere quale delle due.»' },
      ]);
    },
  },
  {
    // La terza metà. **È così che il giocatore scopre di avere una sorella**: da una battuta
    // pratica, in mezzo a un orario, senza musica. Le cuffie tornano in testa.
    id: 'm8-6',
    draw(P) {
      sala(P, 24);
      vignette(P, 0.5);
      const f = figure(P, 'mirae', px(P, 0.74), py(P, 0.5), unitScale(P, 0.3, 32), 'stand', { crop: 32, mood: 'parla' });
      cuffieInTesta(P, f);
      figure(P, 'jaemin', px(P, 0.28), py(P, 0.5), unitScale(P, 0.3, 32), 'back', { crop: 32 });
      speech(P, [
        { who: 'Jae-min', text: '«Tuo padre.»' },
        { who: 'Mi-rae', text: '«Seo Dong-hyeok. Non mi ha mai riconosciuta e io non gliel\'ho mai chiesto.» (si rimette le cuffie) «Quindi sì: buongiorno, ciao, sono tua sorella. Vai che sono le undici e mezza.»' },
      ]);
    },
  },
];

export const CHIUSURA = [
  {
    // I due, uno di fronte all'altro, nel cortile. **Stesso bomber, stessa altezza.** Quello
    // dalla parte dello spettatore è di spalle: ha la mano destra in tasca, e nessuno lo dice.
    id: 'm8-7',
    draw(P) {
      muri(P);
      vignette(P, 0.4);
      const k = unitScale(P, 0.6, 50);
      figure(P, 'dulchae', px(P, 0.34), py(P, 0.97), k, 'back', { crop: 50, pocket: 1 });
      figure(P, 'jaemin', px(P, 0.66), py(P, 0.97), k, 'stand', { crop: 50, mood: 'giu' });
      narrator(P, 'Stesso bomber. Stessa altezza.');
    },
  },
  {
    // **Non c'è una pistola: c'è un portafoglio.** Una mano, e una carta. Il nome è la prima
    // cosa che si legge, e il narratore lo dice nel pannello dopo.
    id: 'm8-8',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#2b2a28', '#14130f', 0.5);
      glow(P, px(P, 0.5), py(P, 0.4), P.h * 0.7, '#ffe6b8', 0.14);
      // Il portafoglio, aperto, tenuto da una mano che viene dal basso a destra.
      const x = px(P, 0.28);
      const y = py(P, 0.3);
      const w = P.w * 0.42;
      const h = P.h * 0.34;
      ctx.fillStyle = '#2a1d16';
      ctx.fillRect(x - w * 0.04, y - h * 0.08, w * 1.08, h * 1.2);
      ctx.fillStyle = '#3b2a1f';
      ctx.fillRect(x, y, w, h * 1.04);
      carta(P, x + w * 0.06, y + h * 0.08, w * 0.88, h * 0.84);
      // La mano: il palmo dal basso, il pollice sul bordo, e le dita che sbucano da sotto.
      ctx.fillStyle = '#d3a37c';
      ctx.fillRect(px(P, 0.56), py(P, 0.6), P.w * 0.22, P.h * 0.4);
      ctx.fillRect(px(P, 0.5), py(P, 0.58), P.w * 0.08, P.h * 0.1);
      ctx.fillStyle = '#a4714b';
      for (let i = 0; i < 3; i++) ctx.fillRect(px(P, 0.575 + i * 0.065), py(P, 0.6), P.w * 0.004, P.h * 0.12);
      ctx.fillStyle = '#232a35';
      ctx.fillRect(px(P, 0.54), py(P, 0.86), P.w * 0.3, P.h * 0.14);
      vignette(P, 0.4);
      narrator(P, 'Stesso nome, stessa data di nascita, stesso numero di registro.');
    },
  },
  {
    // Due carte, **una accanto all'altra**. Tutte e due con la stessa faccia: nel cast quella
    // testa è una sola, e qui deve esserlo.
    id: 'm8-9',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#1f1d1a', '#11100e', 0.5);
      ctx.fillStyle = '#6a5a42';
      ctx.fillRect(px(P, 0.08), py(P, 0.2), P.w * 0.84, P.h * 0.7);
      carta(P, px(P, 0.15), py(P, 0.34), P.w * 0.34, P.h * 0.4);
      carta(P, px(P, 0.52), py(P, 0.34), P.w * 0.34, P.h * 0.4);
      ctx.fillStyle = BLOOD;
      ctx.beginPath();
      ctx.arc(px(P, 0.505), py(P, 0.54), P.h * 0.03, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.font = `800 ${Math.round(P.h * 0.04)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('=', px(P, 0.505), py(P, 0.555));
      ctx.textAlign = 'left';
      vignette(P, 0.45);
      narrator(P, 'Due carte d\'identità. Un numero solo, per due persone.');
    },
  },
  {
    id: 'm8-10',
    draw(P) {
      muri(P);
      vignette(P, 0.4);
      figure(P, 'dulchae', px(P, 0.3), py(P, 0.5), unitScale(P, 0.3, 38), 'back', { crop: 38, pocket: 1 });
      figure(P, 'jaemin', px(P, 0.74), py(P, 0.5), unitScale(P, 0.3, 38), 'stand', { crop: 38, mood: 'giu' });
      narrator(P, 'A 한성개발 lo chiamano 둘째 · Dulchae, «il secondo». Un nome suo non ce l\'ha.');
      speech(P, [
        { who: 'Dulchae', text: '«Hyung.»' },
        { who: 'Jae-min', text: '«Non chiamarmi così.»' },
        { who: 'Dulchae', text: '«È l\'unica parola che ho di mio. Il resto è tuo, e non l\'ho chiesto io.»' },
        { note: true, text: 'Hyung è «fratello maggiore». Chi lo dice sta dicendo anche chi dei due è il maggiore.' },
      ]);
    },
  },
  {
    id: 'm8-11',
    draw(P) {
      muri(P);
      vignette(P, 0.45);
      figure(P, 'dulchae', px(P, 0.3), py(P, 0.5), unitScale(P, 0.3, 38), 'back', { crop: 38, pocket: 1 });
      figure(P, 'jaemin', px(P, 0.74), py(P, 0.5), unitScale(P, 0.3, 38), 'stand', { crop: 38, mood: 'giu' });
      speech(P, [
        { who: 'Dulchae', text: '«Ti hanno mandato in America perché non ricordassi niente. Hanno tenuto me perché qualcuno doveva esserci, quando serviva una firma. Tu sei il nome pulito. Io sono il nome usato. Siamo la stessa riga su due fogli.»' },
      ]);
    },
  },
  {
    id: 'm8-12',
    draw(P) {
      muri(P);
      vignette(P, 0.45);
      figure(P, 'dulchae', px(P, 0.3), py(P, 0.54), unitScale(P, 0.34, 38), 'back', { crop: 38, pocket: 1 });
      figure(P, 'jaemin', px(P, 0.74), py(P, 0.54), unitScale(P, 0.34, 38), 'stand', { crop: 38, mood: 'parla' });
      speech(P, [
        { who: 'Jae-min', text: '«Chi ti ha tenuto?»' },
        { who: 'Dulchae', text: '«Gli stessi che ogni mese mandano i soldi a tua sorella. Chiedi a lei da che conto arrivano, poi guarda l\'intestazione.»' },
      ]);
    },
  },
  {
    // **Potrebbe sparare**: sono soli, non c'è nessuno. Non lo fa. Se ne va camminando, e non
    // si volta: Jae-min lo guarda andare, e la mano resta in tasca fino in fondo.
    id: 'm8-13',
    draw(P) {
      muri(P);
      vignette(P, 0.5);
      figure(P, 'dulchae', px(P, 0.26), py(P, 0.46), unitScale(P, 0.24, 38), 'back', { crop: 38, pocket: 1 });
      figure(P, 'jaemin', px(P, 0.74), py(P, 0.5), unitScale(P, 0.3, 38), 'stand', { crop: 38, mood: 'giu' });
      speech(P, [
        { note: true, text: 'Potrebbe sparare: sono soli, e non c\'è nessuno. Non lo fa. Se ne va camminando.' },
        { who: 'Dulchae', text: '(di spalle, senza voltarsi) «Se muori tu, sul registro resta solo un nome. E un nome da solo non è nessuno.»' },
      ]);
    },
  },
  {
    // Jae-min solo. **Quattro telecamere, tutte e quattro puntate lì**: una per angolo, e il
    // cono di ognuna arriva a lui. Nessuno dei due è arrivato in questo cortile per caso.
    id: 'm8-14',
    draw(P) {
      muri(P);
      const c = { x: px(P, 0.5), y: py(P, 0.7) };
      telecamera(P, px(P, 0.08), py(P, 0.14), c);
      telecamera(P, px(P, 0.92), py(P, 0.14), c);
      telecamera(P, px(P, 0.24), py(P, 0.38), c);
      telecamera(P, px(P, 0.76), py(P, 0.38), c);
      figure(P, 'jaemin', c.x, py(P, 0.84), unitScale(P, 0.36, 50), 'stand', { crop: 50, mood: 'giu' });
      vignette(P, 0.5);
      speech(P, [{ note: true, text: 'Nessuno dei due è arrivato in questo cortile per caso.' }]);
    },
  },
];

// --- la missione -------------------------------------------------------------------------------

export const M8 = {
  id: 'm8',
  title: 'Il volto in mezzo alla folla',
  hangul: '인파 속의 얼굴',
  act: 2,
  _d: null,
  _folla: [],

  prepare(game) {
    const s = sites(game);
    // Alle undici del mattino il 피시방 non apre: lo apre la storia, come M1 col 당구장.
    if (s.pc) game.shops.hold(s.pc.id);
  },

  phases: [
    {
      // **Un numero che non è in rubrica**, e una cosa che sa: cos'ha mangiato. Il copione la
      // dice così, e il giocatore non ha modo di capire come.
      id: 'messaggio',
      hint: 'Un messaggio da un numero sconosciuto',
      enter(ctx) {
        ctx.unmark();
        ctx.talk([
          { who: 'Numero sconosciuto', text: '«Non mi conosci. Stamattina hai mangiato un 삼각김밥 in piedi, davanti a un 편의점.»' },
          { who: 'Numero sconosciuto', text: '«Non ti sto seguendo: ho solo la tua faccia, e ne ho nove. Vieni al 피시방 di Hongdae.»' },
        ], () => ctx.next());
      },
    },

    {
      id: 'viaggio-pc',
      hint: 'Il 피시방 di Hongdae',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!s.pc) { ctx.next(); return; }
        ctx.mark(s.pc.x, s.pc.y, { label: '피시방' });
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        const pl = ctx.game.player;
        if (ctx.game.indoors || !s.pc) return;
        if (dist(pl.x, pl.y, s.pc.x, s.pc.y) < ARRIVO) ctx.next();
      },
    },

    {
      // Le undici. **Non apre prima**: come M6, chi arriva alle tre del pomeriggio aspetta
      // l'orario senza guardare l'orologio girare.
      id: 'mattina',
      hint: 'Aspetta le 11:00: Mi-rae non apre prima',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.pc.x, s.pc.y, { label: '피시방' });
        ctx.point({
          id: 'aspetta', key: 'F', onFoot: false, text: 'aspetta che sia mattina', reach: 220,
          x: s.pc.x, y: s.pc.y,
          run: (c) => {
            c.waitUntil(MATTINA);
            c.next();
          },
        });
      },
      tick(dt, ctx) {
        const h = ctx.game.dayCycle.hour;
        if (h >= MATTINA_DA && h < MATTINA_A) ctx.next();
      },
    },

    {
      id: 'pcbang',
      hint: 'Il 피시방 di Hongdae',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        ctx.mark(s.pc.x, s.pc.y, { label: '피시방' });
        ctx.say(`Il 피시방 di Hongdae, ${['primo', 'secondo', 'terzo', 'quarto'][s.pc.level] || 'terzo'} piano`);
        ctx.on('floorShown', (shop, idx) => {
          if (shop.id === s.pc.id && idx === s.pc.level) ctx.next();
        });
        const it = game.shops.active;
        if (it && it.shop.id === s.pc.id && it.cur === s.pc.level) ctx.next();
      },
    },

    panelPhase('m8-apertura', APERTURA),

    {
      id: 'viaggio',
      hint: 'Myeongdong, le due del pomeriggio',
      enter(ctx) {
        const s = sites(ctx.game);
        const g = s.giro;
        if (!g) { ctx.next(); return; }
        const b = g.block;
        ctx.mark(b.x + b.w / 2, b.y + b.h / 2, { label: '명동' });
        // Il 피시방 torna a fare il suo orario: chi è dentro ci resta, ma da stanotte è un locale.
        if (s.pc) ctx.game.shops.release(s.pc.id);
      },
      tick(dt, ctx) {
        const g = sites(ctx.game).giro;
        const pl = ctx.game.player;
        if (ctx.game.indoors || !g) return;
        const b = g.block;
        if (dist(pl.x, pl.y, b.x + b.w / 2, b.y + b.h / 2) < ARRIVO) ctx.next();
      },
    },

    {
      id: 'ora',
      hint: 'Aspetta le 14:00: la busta si ritira alle due',
      enter(ctx) {
        const g = sites(ctx.game).giro;
        const b = g.block;
        ctx.mark(b.x + b.w / 2, b.y + b.h / 2, { label: '명동' });
        ctx.point({
          id: 'aspetta', key: 'F', onFoot: false, text: 'aspetta che sia ora', reach: 280,
          x: b.x + b.w / 2, y: b.y + b.h / 2,
          run: (c) => {
            c.waitUntil(BUSTA);
            c.next();
          },
        });
      },
      tick(dt, ctx) {
        const h = ctx.game.dayCycle.hour;
        if (h >= BUSTA - 0.2 && h < BUSTA_A) ctx.next();
      },
    },

    {
      // **Nessun marcatore.** Il blip si spegne: la folla è piena, e quello che si cerca è una
      // banda rossa su una schiena nera. Dulchae fa il giro dell'isolato, e tutt'attorno ci
      // sono quattro in nero senza la banda.
      id: 'cerca',
      hint: 'Cerca il bomber con la banda rossa sulla schiena: fa il giro dell\'isolato',
      enter(ctx) {
        const game = ctx.game;
        ctx.unmark();
        game.tail.stop();
        apparecchia(game);
        tolgo(game);
        ctx.state.t = 0;
        ctx.state.lag = 0;
        mettiFolla(game);
        mettiDulchae(game);
        game.pedGrid.rebuild(game.peds);
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const d = dulchae();
        if (!d) { ctx.goto('cerca'); return; }
        if (game.indoors) return;
        const pl = game.player;
        if (dist(pl.x, pl.y, d.x, d.y) < IN_VISTA) {
          game.tail.begin(game, d, { label: 'il bomber con la banda rossa', lose: LOSE, spot: SPOT });
          ctx.next();
        }
      },
    },

    {
      // Il pedinamento. **A piedi nella folla**: le soglie sono quelle di un marciapiede. Perdere
      // è un'altra scena (`cerca`, di nuovo); farsi vedere, o stare dietro fino in fondo, è la
      // rottura.
      id: 'pedina',
      hint: 'Stagli dietro: non troppo lontano, non troppo vicino',
      enter(ctx) {
        const game = ctx.game;
        ctx.state.t = 0;
        apparecchia(game);
        if (!game.tail.active && dulchae()) {
          game.tail.begin(game, dulchae(), { label: 'il bomber con la banda rossa', lose: LOSE, spot: SPOT });
        }
        ctx.on('tailLost', () => {
          ctx.toast('L\'hai perso nella folla', 3.6);
          ctx.goto('cerca');
        });
        ctx.on('tailSpotted', () => rottura(ctx));
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const d = dulchae();
        if (!d) { ctx.goto('cerca'); return; }
        if (game.indoors) return;
        ctx.state.t += dt;
        // Dopo il tempo giusto, **quando la porta è vicina**, si accorge comunque: un
        // pedinamento perfetto non è una via d'uscita dalla scena.
        if (ctx.state.t >= PEDINA_TEMPO && manca(game) < 520) rottura(ctx);
      },
      leave(ctx) { ctx.game.tail.stop(); },
    },

    {
      // La corsa. **La polizia arriva su di lui e resta addosso a te**: due stelle, e le radio
      // dicono il nome.
      id: 'inseguimento',
      hint: 'Non farlo scappare: segui il bomber fino al portone',
      enter(ctx) {
        ctx.state.lag = 0;
        apparecchia(ctx.game);
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const st = ctx.state;
        const d = dulchae();
        if (!d) {
          // È entrato (o non c'è più: una ripresa, un'altra partita). Se non è entrato **da solo**
          // la scena riparte dall'inizio.
          if (st.dentro) { ctx.next(); return; }
          ctx.goto('cerca');
          return;
        }
        if (d.goto?.arrived) {
          // Il portone si chiude dietro di lui: il pedone esce di scena, e la porta è il blip.
          st.dentro = true;
          d.gone = true;
          const i = game.pedSystem.peds.indexOf(d);
          if (i >= 0) game.pedSystem.peds.splice(i, 1);
          M8._d = null;
          ctx.next();
          return;
        }
        if (game.indoors) return;
        const pl = game.player;
        if (dist(pl.x, pl.y, d.x, d.y) > SFUGGITO) st.lag += dt;
        else st.lag = Math.max(0, st.lag - dt * 2);
        if (st.lag > SFUGGITO_TEMPO) {
          ctx.toast('Ti è sfuggito', 3.6);
          ctx.goto('cerca');
        }
      },
    },

    {
      // Il portone. **Dentro c'è il cortile cieco** (`shops.stageShop`): quando il giocatore ci
      // mette piede, dopo un secondo per guardarsi attorno, comincia la scena.
      id: 'portone',
      hint: 'È entrato nel portone: seguilo',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        apparecchia(game);
        ctx.state.dentro = true;
        ctx.state.t = 0;
        ctx.state.visto = false;
        ctx.mark(s.porta.x, s.porta.y, { label: '골목' });
        // Dulchae è già lì: un attore d'interno, in fondo al cortile e rivolto alla porta.
        game.actors.define('dulchae-cortile', {
          indoor: true, shop: s.porta.id, level: 0, kind: 'civil', look: 'hero', name: 'Dulchae', hangul: '둘째',
          state: 'post', role: 'keeper', angle: Math.PI / 2,
          place: (f) => ({ x: Math.round(f.w / 2), y: Math.round(f.h * 0.28) }),
        });
        ctx.on('floorShown', (shop, idx, f) => {
          if (shop.id !== s.porta.id || f.biz.id !== 'yard') return;
          ctx.state.visto = true;
          ctx.state.t = 0;
          ctx.unmark();
        });
        ctx.on('shopLeave', () => { ctx.state.visto = false; ctx.state.t = 0; ctx.mark(s.porta.x, s.porta.y, { label: '골목' }); });
        const it = game.shops.active;
        if (it && it.shop.id === s.porta.id && game.shops.floor?.biz.id === 'yard') ctx.state.visto = true;
      },
      tick(dt, ctx) {
        const st = ctx.state;
        if (!st.visto || !ctx.game.indoors) return;
        st.t += dt;
        if (st.t > 1.3) ctx.next();
      },
    },

    panelPhase('m8-chiusura', CHIUSURA),

    {
      // Il cortile è vuoto: lui se n'è andato camminando, e le telecamere restano. Si esce dalla
      // stessa porta, con le stelle che aspettano fuori.
      id: 'fuori',
      hint: 'Esci dal cortile: fuori c\'è la polizia',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        ctx.unmark();
        game.actors.undefine('dulchae-cortile');
        const f = game.shops.floor;
        if (game.indoors && f?.biz.id === 'yard') {
          for (const p of f.people.slice()) {
            if (p.actor !== 'dulchae-cortile') continue;
            const i = f.people.indexOf(p);
            if (i >= 0) f.people.splice(i, 1);
          }
          game.pedGrid.rebuild(game.peds);
        }
        ctx.on('shopLeave', (shop) => { if (shop.id === s.porta.id) ctx.next(); });
        if (!game.indoors) ctx.next();
      },
    },
  ],

  finish(game) {
    sgombera(game);
    const s = sites(game);
    if (s.pc) game.shops.release(s.pc.id);
    game.missions.setFlag('dulchae');
    game.missions.setFlag('sorella');
    game.hud.toast('인파 속의 얼굴 — completata', 3.4);
  },
};

/**
 * La rottura: **l'altro si accorge**. Il pedinamento si spegne, lui corre verso il portone
 * lungo la stessa fascia, e il ricercato sale — il nome che dà la radio è il tuo.
 */
function rottura(ctx) {
  const game = ctx.game;
  const d = dulchae();
  if (!d || !sites(game).giro) { ctx.goto('cerca'); return; }
  game.tail.stop();
  d.goto = { path: percorsoFuga(game), i: 0, loop: false, speed: CORRE };
  d.baseSpeed = CORRE;
  d.state = 'goto';
  game.wanted.add(26 - game.wanted.heat, game);
  game.audio?.ui('deny');
  ctx.toast('Radio della polizia: «…ricercato Seo Jae-min, trentaquattro anni, bomber nero con la fascia rossa. È a piedi, in 명동…»', 6);
  ctx.next();
}

