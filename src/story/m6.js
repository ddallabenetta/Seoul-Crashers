// M6 · «Chi ha firmato per te» — 누가 네 이름을 썼나
//
// Il copione sta in `docs/storia/04-atto-2.md`. La torre di 한성개발 a Gangnam, **ore
// d'ufficio, `14:00`**: è l'unica missione che si può fare solo di giorno, e per il
// motivo giusto — di notte il palazzo è vuoto e non serve a niente entrarci. È la
// missione di **lettura**: sette faldoni, e in uno una riga del 1992 che ribalta chi è
// Jae-min senza che nessuno la metta in fila al posto del giocatore.
//
// Ha **un'ora e un pedinamento**, e non scrive né l'una né l'altro:
//
//   · l'ora è un appuntamento (`ctx.waitUntil`, §5.33) come per M3: il blip porta dove
//     si aspetta, e chi arriva alle nove di sera passa la notte e rientra alle 14 del
//     giorno dopo senza guardare l'orologio girare;
//   · il pedinamento è `core/tail.js`, acceso con `game.tail.begin` e ascoltato con
//     `tailLost` / `tailSpotted`. È una delle **due strade** per entrare — l'altra è la
//     porta principale in completo — e cosa voglia dire fallire (la berlina ripassa, si
//     ricomincia) lo decide questo file.
//
// Le due strade, perché il copione ne dà tre («la scelta conta perché cambia chi ti
// vede») e Seoul non ha un tetto da cui entrare:
//
//   · **la porta**, con il completo comprato al 옷가게 (`HERO_OUTFITS`, `suit`): chi
//     arriva con il bomber riceve la risposta del portiere e si ritrova in strada;
//   · **la rampa**, dietro una berlina della torre: nasce dal parcheggio, va al 편의점 di
//     Itaewon — lo stesso giro del martedì e del venerdì di M3 — e **ritorna**, e quando
//     ritorna la sbarra si alza per lei e per chi le sta dietro.
//
// Una torre in cui si sale davvero non c'è (il copione lo segnala: «Chiederebbe»): le
// piante di Seoul hanno al più quattro piani. Quindi **l'ottavo e il ventesimo sono lo
// stesso piano** — quello dell'ufficio, dove stanno i faldoni — e la stanza di Ryu è
// in fondo al corridoio. Le scritte del riquadro dicono «8층» perché è quello che
// c'è sul biglietto.
import { panelPhase } from '../core/missions.js';
import { findShop, findTower, freeSpot, mandaA, arrivata } from './places.js';
import { createPed } from '../entities/pedestrians.js';
import { HERO_OUTFITS } from '../render/sprites.js';
import { dist } from '../core/math.js';
import {
  AMBER, BLOOD,
  px, py, flat, wash, vignette, glow, hash,
  sign, dial, narrator, speech,
} from '../render/panelkit.js';
import { figure, crowd, unitScale } from '../render/pixelkit.js';

/** L'ora dell'appuntamento: le due del pomeriggio. */
const APPUNTAMENTO = 14;
/** Quanto in largo si concede l'appuntamento prima di far aspettare. */
const FINESTRA = 0.6;
/** Alle cinque l'ufficio ha già smesso di ricevere: oltre, si passa alla mattina dopo. */
const CHIUSURA_ORE = 17;
/** Quanto si sta in silenzio dopo la riga del 1992: il ribaltamento non ha un pannello. */
const SILENZIO = 3;
/** A che distanza dalla torre comincia la fase della porta. */
const ARRIVO = 170;
/** Quanto la berlina si ferma al 편의점 prima di tornare. */
const SOSTA = 3;

function sites(game) {
  if (M6._sites) return M6._sites;
  const from = game.city.spawn;
  const conv = findShop(game, 'conv', { district: 'itaewon', near: from });
  // **La stessa torre di M3**, trovata con la stessa ricerca (`places.findTower`): se
  // fossero due, la busta scenderebbe in un palazzo e i faldoni sarebbero in un altro.
  const torre = findTower(game, conv || from);
  M6._sites = { conv, torre };
  return M6._sites;
}

// --- il pedinamento, e l'auto che si segue ---------------------------------------------

function sgomberaBerlina(game) {
  const v = M6._berlina;
  if (!v) return;
  const i = game.vehicles.indexOf(v);
  if (i >= 0) game.vehicles.splice(i, 1);
  M6._berlina = null;
}

/** Tornare a una fase precedente: serve al fallimento dell'archivio (§5.29 non lo dà). */
function torna(game, id) {
  const M = game.missions;
  const i = M.def.phases.findIndex((p) => p.id === id);
  if (i < 0) return;
  M.leavePhase(game);
  M.phase = i;
  M.enterPhase(game);
}

/** Il giro: dalla rampa al 편의점 e ritorno. Parte quando il giocatore lo chiede. */
function avviaGiro(ctx) {
  const game = ctx.game;
  const st = ctx.state;
  const s = sites(game);
  const meta = s.conv || game.city.spawn;
  // Esce dalla rampa, non dal punto in cui sei: due isolati più in là, sulla corsia
  // più vicina, e **non** sotto il paraurti — il pedinamento ti vede da 132 px.
  const v = mandaA(game, 'sedan', { x: s.torre.x - 260, y: s.torre.y + 140 }, meta, {
    colorIndex: 0, speed: 112, radius: 600,
  });
  if (!v) {
    // Le strade non ci arrivano: non si mente al giocatore e non lo si blocca. La
    // sbarra si alza e basta.
    st.passa = true;
    ctx.toast('La sbarra della rampa è alzata', 3.2);
    return;
  }
  M6._berlina = v;
  st.via = 1;
  st.t = 0;
  game.tail.begin(game, v, { label: 'la berlina della torre' });
  ctx.toast('Una berlina nera esce dalla rampa: seguila', 4);
}

function fallitoGiro(ctx, perche) {
  const game = ctx.game;
  game.tail.stop();
  sgomberaBerlina(game);
  ctx.toast(perche, 4);
  // **Non è un game over.** Il giro si ripete a ogni ora: la fase riparte e un'altra
  // berlina esce dalla rampa quando il giocatore lo chiede di nuovo.
  game.missions.replay(game);
}

function ammesso(ctx) {
  const game = ctx.game;
  return ctx.state.passa || HERO_OUTFITS[game.player.outfit]?.id === 'suit';
}

// --- i faldoni ------------------------------------------------------------------------------

/**
 * Sette documenti, di cui **tre inutili**. Quattro contano: i primi tre del copione (la
 * perizia, l'atto di cessione, la pagina del 1992) e un quarto che il copione di
 * `00-soggetto.md` chiede per M11 — i contratti dell'Atto II sono firmati a mano. Per
 * andare avanti ne bastano due: la perizia e la pagina; la pagina **esce solo dopo
 * l'atto di cessione**, perché è «allegata come prova» a quello.
 *
 * Il narratore dice solo cose verificabili (README, regola 5): date, numeri, nomi.
 */
const DOCS = [
  {
    id: 'perizia', chiave: true,
    text: 'perizia del mercato di Myeongdong',
    lines: () => [
      { text: 'Perizia del mercato di Myeongdong, quella dei sigilli. Firma di un dirigente, e sotto una controfirma.' },
      { text: 'Controfirma del privato: 서재민 · Seo Jae-min. Data: 14 settembre 2025.', note: 'Il 14 settembre 2025 Jae-min era a Los Angeles.' },
    ],
  },
  {
    id: 'cessione', chiave: true,
    text: 'atto di cessione di crediti',
    lines: () => [
      { text: 'Atto di cessione di crediti. Nove anni fa 한성개발 ha comprato i libri dei debiti dello 황소파.' },
      { text: 'Millequattrocento posizioni, dal 1988 al 2010, pagate in contanti.', note: 'Il registro del quartiere non è stato rubato. È stato comprato, con una fattura.' },
    ],
  },
  {
    id: 'pagina', chiave: true, dopo: 'cessione',
    text: 'la pagina fotocopiata allegata all\'atto',
    lines: () => [
      { text: 'Allegata come prova, una pagina fotocopiata del vecchio libro dello 황소파. Tre righe. L\'ultima:' },
      { text: '구만기 · 미수금 정리 · 유아 1 · 백호 인수' },
      { text: 'Ku Man-gi · saldo del credito · un bambino · rilevato dal 백호파.' },
      { text: 'Libro dello 황소파, 1992. Seo Jae-min ha trentaquattro anni.' },
    ],
  },
  {
    id: 'firma',
    text: 'un contratto di cantiere',
    lines: () => [
      { text: 'Contratto di cantiere, Hongdae. Firmato a penna, non a timbro. Data: 8 agosto.', note: 'Anche gli altri cinque contratti del faldone sono firmati a penna.' },
    ],
  },
  {
    id: 'ascensori',
    text: 'manutenzione degli ascensori',
    lines: () => [{ text: 'Manutenzione degli ascensori, secondo trimestre. Tutto in regola.' }],
  },
  {
    id: 'mensa',
    text: 'il menù della mensa',
    lines: () => [{ text: 'Menù della mensa aziendale: riso, zuppa di alghe, kimchi. Il giovedì c\'è il pesce.' }],
  },
  {
    id: 'condominio',
    text: 'un verbale di condominio',
    lines: () => [{ text: 'Verbale di condominio: il parcheggio interrato chiude alle 22.' }],
  },
];

const letto = (st, id) => (st.letti || []).includes(id);

/**
 * Il posto libero più vicino a un'ancora che **non** sia sulle scale e non pesti un posto già
 * preso. `E` sulle scale è già occupato («scendi al piano terra»): un faldone lì davanti
 * si leggerebbe a caso o non si leggerebbe mai.
 */
function liberoFuoriScale(f, ancora, presi = []) {
  const scale = [f.stairUp, f.stairDown].filter(Boolean);
  const male = (p) => scale.some((q) => p.x > q.x - 60 && p.x < q.x + q.w + 60 && p.y > q.y - 60 && p.y < q.y + q.h + 60)
    || presi.some((q) => dist(q.x, q.y, p.x, p.y) < 44);
  let best = freeSpot(f, ancora);
  for (let g = 0; g < 14 && male(best); g++) {
    best = freeSpot(f, { x: ancora.x + (g % 2 ? 1 : -1) * (g + 1) * 22, y: ancora.y + 24 * ((g % 3) + 1) });
  }
  return best;
}

/**
 * Posti per i sette faldoni: la pianta è generata e non si sa dov'è niente, quindi si
 * campiona attorno a sette punti sparsi. **Sempre gli stessi**, a parità di pianta:
 * tornare sul piano non rimescola.
 */
function posti(f, n) {
  const ancore = [
    [0.22, 0.4], [0.5, 0.3], [0.78, 0.4], [0.2, 0.72], [0.5, 0.74], [0.8, 0.7], [0.5, 0.52],
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const [u, v] = ancore[i % ancore.length];
    out.push(liberoFuoriScale(f, { x: f.w * u, y: f.h * v }, out));
  }
  return out;
}

function apparecchia(ctx, f) {
  const game = ctx.game;
  const st = ctx.state;
  const s = sites(game);
  const spots = posti(f, DOCS.length);
  DOCS.forEach((d, i) => {
    ctx.drop(`doc-${d.id}`);
    if (letto(st, d.id)) return;
    if (d.dopo && !letto(st, d.dopo)) return;
    ctx.point({
      id: `doc-${d.id}`,
      shop: s.torre.id,
      level: s.torre.level,
      key: 'E',
      text: `leggi ${d.text}`,
      reach: 48,
      x: spots[i].x,
      y: spots[i].y,
      run: (c) => {
        if (letto(c.state, d.id)) return;
        c.talk(d.lines(), () => registraLetto(c, d));
      },
    });
  });
}

/** Un faldone letto. Quello della riga del 1992 chiude la lettura, ma **in silenzio**. */
function registraLetto(ctx, d) {
  const game = ctx.game;
  const st = ctx.state;
  st.letti = [...(st.letti || []), d.id];
  ctx.drop(`doc-${d.id}`);
  game.audio?.ui('ok');
  if (d.id === 'cessione' && game.shops.floor) apparecchia(ctx, game.shops.floor);
  if (d.id === 'pagina') {
    // Kkachi ne parlerà quando il giocatore sale in macchina (chiamata 14).
    game.kkachi.mark('riga1992', game);
  }
  const chiave = DOCS.filter((q) => q.chiave && q.id !== 'cessione');
  if (chiave.every((q) => letto(st, q.id))) {
    // Il ribaltamento. **Nessun pannello e nessuna battuta**: i tre numeri — il nome
    // inciso, l'anno del libro, l'età — sono tutti in scena, e metterli in fila
    // sarebbe farlo al posto del giocatore. Un lungo silenzio, e poi l'allarme.
    st.fine = 0;
    ctx.say('…');
  } else {
    const mancano = chiave.filter((q) => !letto(st, q.id)).map((q) => q.text).join(', ');
    ctx.say(`Faldoni dell'archivio, 8층 — manca: ${mancano}`);
  }
}

// --- Ryu --------------------------------------------------------------------------------------

/**
 * Un uomo solo, in fondo al corridoio. Come i due rapinatori di M2 è un pedone normale
 * messo nella gente del piano: la storia non ha una stanza sua, ha un punto libero
 * lontano dalle scale. **Non è armato e non chiama nessuno**: è tutta la scena.
 */
function mettiRyu(game, f) {
  const at = liberoFuoriScale(f, { x: f.w * 0.5, y: f.h * 0.2 });
  const p = createPed('office', at.x, at.y, game.actors.rng);
  p.indoor = true;
  p.armed = false;
  p.role = 'keeper';
  p.state = 'post';
  p.home = { x: at.x, y: at.y };
  p.angle = Math.PI / 2;
  p.faceA = p.angle;
  f.people.push(p);
  game.pedGrid.rebuild(game.peds);
  return p;
}

// --- i pannelli ---------------------------------------------------------------------------------

/** Il soffitto della caffetteria: una griglia di pannelli con le plafoniere. */
function soffitto(P, x, y, w, h) {
  const ctx = P.ctx;
  ctx.fillStyle = '#d9d6cc';
  ctx.fillRect(x, y, w, h);
  const cols = 6;
  const rows = 3;
  ctx.strokeStyle = 'rgba(90,86,76,0.5)';
  ctx.lineWidth = Math.max(1, P.h * 0.003);
  for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(x + (w * i) / cols, y); ctx.lineTo(x + (w * i) / cols, y + h); ctx.stroke(); }
  for (let j = 0; j <= rows; j++) { ctx.beginPath(); ctx.moveTo(x, y + (h * j) / rows); ctx.lineTo(x + w, y + (h * j) / rows); ctx.stroke(); }
  for (let i = 0; i < 3; i++) {
    const lx = x + w * (0.17 + i * 0.33);
    glow(P, lx, y + h * 0.5, h * 0.7, '#fff7d8', 0.5);
    ctx.fillStyle = '#fffbe9';
    ctx.fillRect(lx - w * 0.07, y + h * 0.4, w * 0.14, h * 0.2);
  }
}

export const APERTURA = [
  {
    // L'atrio dalla strada: vetro, marmo, un albero vero dentro. Il pannello dice una
    // cosa sola, **quanto costa questo posto** — e la dice con l'albero, non con la
    // scritta. La gente che passa non lo guarda.
    id: 'm6-1',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#a8c2d6', '#d4dde4', 0.5);
      // La torre: una lastra di vetro che esce dal pannello, con i montanti.
      const g = ctx.createLinearGradient(0, P.y, 0, P.y + P.h * 0.62);
      g.addColorStop(0, '#506a80');
      g.addColorStop(1, '#8fa8bc');
      ctx.fillStyle = g;
      ctx.fillRect(px(P, 0.08), py(P, -0.02), P.w * 0.84, P.h * 0.64);
      ctx.strokeStyle = 'rgba(15,25,35,0.35)';
      ctx.lineWidth = Math.max(1, P.h * 0.003);
      for (let i = 1; i < 14; i++) {
        ctx.beginPath(); ctx.moveTo(px(P, 0.08 + i * 0.06), py(P, -0.02)); ctx.lineTo(px(P, 0.08 + i * 0.06), py(P, 0.62)); ctx.stroke();
      }
      for (let j = 1; j < 7; j++) {
        ctx.beginPath(); ctx.moveTo(px(P, 0.08), py(P, j * 0.09)); ctx.lineTo(px(P, 0.92), py(P, j * 0.09)); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(px(P, 0.08), py(P, -0.02), P.w * 0.2, P.h * 0.64);
      // L'insegna, bianca, sulla fascia scura sopra l'atrio.
      ctx.fillStyle = '#20262e';
      ctx.fillRect(px(P, 0.08), py(P, 0.5), P.w * 0.84, P.h * 0.07);
      sign(P, '한성개발', px(P, 0.28), py(P, 0.555), { size: P.h * 0.05, color: '#eef2f8', glowR: P.h * 0.25 });
      // L'atrio: pavimento di marmo e **un albero vero**, con il tronco e la chioma.
      ctx.fillStyle = '#e6e2d6';
      ctx.fillRect(px(P, 0.08), py(P, 0.57), P.w * 0.84, P.h * 0.2);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 9; i++) ctx.fillRect(px(P, 0.08 + i * 0.1), py(P, 0.57), P.w * 0.004, P.h * 0.2);
      ctx.fillStyle = '#5a4630';
      ctx.fillRect(px(P, 0.605), py(P, 0.65), P.w * 0.03, P.h * 0.12);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 ? '#3f7a45' : '#56934f';
        ctx.beginPath();
        ctx.arc(px(P, 0.56 + hash(i * 3.3) * 0.12), py(P, 0.61 + hash(i * 7.1) * 0.05), P.h * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      // La porta girevole a destra, e il bancone a sinistra: scuri, di taglio.
      ctx.fillStyle = '#2d3138';
      ctx.fillRect(px(P, 0.14), py(P, 0.7), P.w * 0.2, P.h * 0.06);
      ctx.strokeStyle = 'rgba(20,30,40,0.7)';
      ctx.lineWidth = Math.max(2, P.h * 0.006);
      ctx.beginPath(); ctx.arc(px(P, 0.8), py(P, 0.69), P.h * 0.06, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(P, 0.8) - P.h * 0.06, py(P, 0.69)); ctx.lineTo(px(P, 0.8) + P.h * 0.06, py(P, 0.69)); ctx.stroke();
      // Il marciapiede e la gente che passa: sagome in movimento, **nessuna guarda**.
      ctx.fillStyle = '#b8b4a8';
      ctx.fillRect(P.x, py(P, 0.77), P.w, P.h * 0.23);
      // La gente che passa: poca, piccola, **ai due lati**, o copre l'albero che è il soggetto.
      crowd(P, px(P, 0.16), py(P, 0.95), unitScale(P, 0.3, 50), 3, { pose: 'walk', tint: '#3a4150', spread: 22, seed: 11 });
      crowd(P, px(P, 0.85), py(P, 0.96), unitScale(P, 0.3, 50), 3, { pose: 'walk', tint: '#454c5b', spread: 22, seed: 4 });
      vignette(P, 0.3);
    },
  },
  {
    // Ha-eun, in borghese, che fotografa il soffitto. Il pannello è **il suo modo di
    // lavorare**: guarda in alto perché non vuole farsi vedere mentre guarda in basso.
    id: 'm6-2',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#d8cdb4', '#8b8068', 0.7);
      soffitto(P, px(P, 0.0), py(P, 0.0), P.w, P.h * 0.15);
      // La vetrata della caffetteria a destra, con la luce del pomeriggio.
      ctx.fillStyle = '#cfe0ea';
      ctx.fillRect(px(P, 0.78), py(P, 0.17), P.w * 0.22, P.h * 0.45);
      ctx.fillStyle = 'rgba(30,40,50,0.35)';
      ctx.fillRect(px(P, 0.887), py(P, 0.17), P.w * 0.008, P.h * 0.45);
      glow(P, px(P, 0.88), py(P, 0.38), P.h * 0.6, '#fff2c8', 0.22);
      ctx.fillStyle = '#7a6d55';
      ctx.fillRect(P.x, py(P, 0.62), P.w, P.h * 0.38);
      // Jae-min di spalle, in primo piano a sinistra.
      figure(P, 'jaemin', px(P, 0.14), py(P, 0.7), unitScale(P, 0.5, 38), 'back', { crop: 38 });
      // Lei. La figura sta sopra il riquadro delle battute; il braccio alzato regge il telefono.
      const k = unitScale(P, 0.4, 30);
      const fig = figure(P, 'haeun', px(P, 0.56), py(P, 0.6), k, 'seat', { crop: 30, mood: 'parla' });
      // Il braccio sale **a lato della testa** (la crocchia sborda a destra: si passa fuori)
      // e il telefono sta sopra, inclinato verso il soffitto.
      ctx.fillStyle = '#4d5768';
      ctx.fillRect(fig.x + 22 * k, fig.y + 1 * k, 4 * k, 24 * k);
      ctx.fillStyle = '#26303f';
      ctx.fillRect(fig.x + 22.5 * k, fig.y + 2 * k, 3 * k, 22 * k);
      ctx.fillStyle = '#d3a37c';
      ctx.fillRect(fig.x + 22.5 * k, fig.y - 0.5 * k, 3 * k, 2.5 * k);
      ctx.save();
      ctx.translate(fig.x + 24 * k, fig.y - 4 * k);
      ctx.rotate(-0.25);
      ctx.fillStyle = '#1b1d24';
      ctx.fillRect(-3 * k, -5 * k, 6 * k, 9 * k);
      ctx.fillStyle = '#7fb2d8';
      ctx.fillRect(-2.4 * k, -4.4 * k, 4.8 * k, 7.8 * k);
      ctx.restore();
      vignette(P, 0.4);
      speech(P, [
        { who: 'Ha-eun', text: '«Diciassette anni di indagini. Sa dove vanno a finire?»' },
        { who: 'Jae-min', text: '«Nei fascicoli.»' },
        { who: 'Ha-eun', text: '«Nei fascicoli di 한성개발. Per interrogare la gente devo prima sapere chi abita dove, chi possiede cosa, chi deve a chi.»' },
      ]);
    },
  },
  {
    // **La seconda metà della battuta, in una tavola sua.** Una sola voce e due frasi
    // erano troppo per stare sotto la faccia di Ha-eun (§5.33: «se un pannello risulta
    // pieno di testo si taglia la battuta, o si divide in due tavole»). Qui lo schermo
    // è il telefono: lo stesso soffitto, visto da dentro.
    id: 'm6-3',
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#1a1c22');
      const w = P.w * 0.36;
      const h = P.h * 0.56;
      const x = px(P, 0.5) - w / 2;
      const y = py(P, 0.06);
      ctx.fillStyle = '#0c0d11';
      ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
      soffitto(P, x, y, w, h);
      // Il mirino: quattro angoli, e il pulsante dello scatto.
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = Math.max(2, P.h * 0.005);
      const c = w * 0.1;
      for (const [cx, cy, dx, dy] of [[x + 14, y + 14, 1, 1], [x + w - 14, y + 14, -1, 1], [x + 14, y + h - 14, 1, -1], [x + w - 14, y + h - 14, -1, -1]]) {
        ctx.beginPath(); ctx.moveTo(cx + dx * c, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * c); ctx.stroke();
      }
      ctx.fillStyle = '#eef2f8';
      ctx.beginPath(); ctx.arc(px(P, 0.5), y + h + P.h * 0.07, P.h * 0.028, 0, Math.PI * 2); ctx.fill();
      vignette(P, 0.5);
      speech(P, [
        { who: 'Ha-eun', text: '«Quando ho finito, loro comprano la perizia e si portano via il mio lavoro già fatto.» (fotografa di nuovo lo stesso soffitto) «Ho censito mezza Seoul per chi la deve buttare giù. Sono il loro geometra.»' },
      ]);
    },
  },
  {
    // La planimetria di Hongdae sul tavolino. **In fondo a destra una sigla sola**,
    // grande e dentro un riquadro: è la cosa da leggere, e il narratore la traduce
    // perché è un nome (regola 5).
    id: 'm6-4',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#6a5a42', '#3b3023', 0.8);
      ctx.save();
      ctx.translate(px(P, 0.5), py(P, 0.5));
      ctx.rotate(-0.04);
      const w = P.w * 0.7;
      const h = P.h * 0.62;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-w / 2 + 6, -h / 2 + 8, w, h);
      ctx.fillStyle = '#e6e0d0';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(60,64,74,0.55)';
      ctx.lineWidth = Math.max(1, P.h * 0.004);
      for (let i = 1; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(-w / 2 + w * 0.04, -h / 2 + h * (0.1 + i * 0.14)); ctx.lineTo(w / 2 - w * 0.04, -h / 2 + h * (0.1 + i * 0.14)); ctx.stroke();
      }
      for (let i = 1; i < 9; i++) {
        ctx.beginPath(); ctx.moveTo(-w / 2 + w * (0.04 + i * 0.1), -h / 2 + h * 0.06); ctx.lineTo(-w / 2 + w * (0.04 + i * 0.1), h / 2 - h * 0.06); ctx.stroke();
      }
      ctx.font = `600 ${Math.round(P.h * 0.032)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      for (let i = 0; i < 16; i++) {
        const u = -w / 2 + w * (0.13 + (i % 8) * 0.1);
        const v = -h / 2 + h * (0.2 + Math.floor(i / 8) * 0.28);
        ctx.fillStyle = 'rgba(120,112,98,0.32)';
        ctx.fillRect(u - w * 0.035, v - h * 0.06, w * 0.07, h * 0.12);
        ctx.fillStyle = '#2b2a26';
        ctx.fillText(`${12 + i * 5}`, u, v + h * 0.03);
      }
      // Il cartiglio in basso a destra, con la sigla.
      ctx.fillStyle = '#f2eddf';
      ctx.fillRect(w / 2 - w * 0.2, h / 2 - h * 0.2, w * 0.18, h * 0.17);
      ctx.strokeStyle = BLOOD;
      ctx.lineWidth = Math.max(2, P.h * 0.006);
      ctx.strokeRect(w / 2 - w * 0.2, h / 2 - h * 0.2, w * 0.18, h * 0.17);
      ctx.font = `800 ${Math.round(P.h * 0.07)}px system-ui, sans-serif`;
      ctx.fillStyle = BLOOD;
      ctx.fillText('윤', w / 2 - w * 0.11, h / 2 - h * 0.07);
      ctx.textAlign = 'left';
      ctx.restore();
      vignette(P, 0.5);
      narrator(P, 'In fondo alla planimetria una sigla sola: 윤 · Yoon. La sua.');
    },
  },
];

export const CHIUSURA = [
  {
    // Il marciapiede davanti alla torre. **Lui è l'unico fermo**: la gente gli passa
    // attorno e non lo guarda, ed è lo stesso modo in cui la cutscene iniziale diceva
    // «Jae-min non è da nessuna parte» (pannello 3).
    id: 'm6-5',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#a9c0d2', '#cdd3d6', 0.55);
      const g = ctx.createLinearGradient(0, P.y, 0, P.y + P.h * 0.6);
      g.addColorStop(0, '#4d6679');
      g.addColorStop(1, '#8ea5b8');
      ctx.fillStyle = g;
      ctx.fillRect(px(P, 0.0), py(P, -0.02), P.w, P.h * 0.62);
      ctx.strokeStyle = 'rgba(15,25,35,0.3)';
      ctx.lineWidth = Math.max(1, P.h * 0.003);
      for (let i = 1; i < 18; i++) { ctx.beginPath(); ctx.moveTo(px(P, i * 0.058), py(P, 0)); ctx.lineTo(px(P, i * 0.058), py(P, 0.6)); ctx.stroke(); }
      ctx.fillStyle = '#b6b2a6';
      ctx.fillRect(P.x, py(P, 0.6), P.w, P.h * 0.4);
      // La folla, due file, **che attraversa**; lui in mezzo, fermo, con un foglio.
      crowd(P, px(P, 0.2), py(P, 0.82), unitScale(P, 0.42, 50), 4, { pose: 'walk', tint: '#454c5b', spread: 18, seed: 2 });
      crowd(P, px(P, 0.8), py(P, 0.84), unitScale(P, 0.44, 50), 4, { pose: 'walk', tint: '#3b4250', spread: 18, seed: 6 });
      const k = unitScale(P, 0.62, 44);
      figure(P, 'jaemin', px(P, 0.5), py(P, 0.97), k, 'stand', { crop: 44, mood: 'giu' });
      // La fotocopia, in mano, all'altezza del petto.
      ctx.save();
      ctx.translate(px(P, 0.54), py(P, 0.62));
      ctx.rotate(0.08);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(3, 4, P.w * 0.07, P.h * 0.12);
      ctx.fillStyle = '#d8d6cf';
      ctx.fillRect(0, 0, P.w * 0.07, P.h * 0.12);
      ctx.fillStyle = 'rgba(40,40,40,0.4)';
      for (let i = 0; i < 3; i++) ctx.fillRect(P.w * 0.008, P.h * (0.02 + i * 0.03), P.w * 0.05, P.h * 0.006);
      ctx.restore();
      vignette(P, 0.35);
    },
  },
  {
    // La riga del 1992, tutto lo schermo, **in hangul e senza traduzione**: il
    // narratore l'ha già tradotta nel faldone, e qui è un'immagine, non un documento.
    // Tre secondi, poi si passa da soli (`hold`): è il «silenzio» del copione.
    id: 'm6-6',
    hold: 3.2,
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#b9b6ad');
      // Il grigio della fotocopia: grana, e una banda più scura dove la lastra non ha toccato.
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(30,30,30,${hash(i * 1.9) * 0.1})`;
        ctx.fillRect(px(P, hash(i * 3.1)), py(P, hash(i * 7.7)), P.w * 0.012, 2);
      }
      ctx.fillStyle = 'rgba(40,40,40,0.18)';
      ctx.fillRect(P.x, P.y, P.w * 0.05, P.h);
      // Le prime due righe: barre di inchiostro, **illeggibili** (non sono la trama).
      ctx.fillStyle = 'rgba(35,35,35,0.4)';
      ctx.fillRect(px(P, 0.12), py(P, 0.2), P.w * 0.62, P.h * 0.035);
      ctx.fillRect(px(P, 0.12), py(P, 0.3), P.w * 0.5, P.h * 0.035);
      // L'ultima, grande.
      ctx.fillStyle = '#17171a';
      ctx.font = `800 ${Math.round(P.h * 0.1)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('구만기 · 미수금 정리', px(P, 0.5), py(P, 0.58));
      ctx.fillText('유아 1 · 백호 인수', px(P, 0.5), py(P, 0.76));
      ctx.textAlign = 'left';
      vignette(P, 0.4);
    },
  },
  {
    // Il quadrante. Le due battute di Jae-min e le due di 까치 stanno in **una tavola
    // sola** perché sono quattro righe brevi: l'ultima è la riga che R2 mette in scena.
    id: 'm6-7',
    bed: { kkachi: 0.03 },
    draw(P) {
      flat(P, '#080b10');
      glow(P, px(P, 0.5), py(P, 0.3), P.h * 0.5, AMBER, 0.14);
      dial(P, px(P, 0.16), py(P, 0.14), P.w * 0.68, P.h * 0.26, {
        from: 90, to: 93, mark: 91.45, label: '91.45',
      });
      speech(P, [
        { who: 'Jae-min', text: '«Tu lo sapevi.»' },
        { who: '91.45', kkachi: true, text: '«So quello che è stato detto ad alta voce.»' },
        { who: 'Jae-min', text: '«E che io sono stato comprato è stato detto ad alta voce?»' },
        { who: '91.45', kkachi: true, text: '«Una volta. In cucina. C\'era la radio accesa.»' },
      ]);
    },
  },
];

// --- la missione ------------------------------------------------------------------------------------

export const M6 = {
  id: 'm6',
  title: 'Chi ha firmato per te',
  hangul: '누가 네 이름을 썼나',
  act: 2,
  _berlina: null,

  phases: [
    {
      // Ha-eun lascia un biglietto sul parabrezza: un piano e un'ora, niente firma. Si
      // scopre salendo in macchina, e non c'è altro modo di scoprirlo.
      id: 'biglietto',
      hint: 'Un biglietto sul parabrezza — sali in macchina',
      enter(ctx) {
        ctx.unmark();
        const go = () => {
          ctx.talk([
            { text: 'Sul parabrezza c\'è un biglietto piegato in quattro. Una riga a penna, senza firma: 8층 · 14:00. Ottavo piano, le due del pomeriggio.' },
            { text: 'Sul retro, l\'indirizzo della torre di 한성개발.' },
          ], () => ctx.next());
        };
        if (ctx.game.player.vehicle) { go(); return; }
        ctx.on('enterVehicle', go);
      },
    },

    {
      id: 'torre',
      hint: 'La torre di 한성개발, a Gangnam — alle 14:00',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!s.torre) { ctx.next(); return; }
        ctx.mark(s.torre.x, s.torre.y, { label: '한성개발' });
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        const pl = ctx.game.player;
        if (ctx.game.indoors || !s.torre) return;
        if (dist(pl.x, pl.y, s.torre.x, s.torre.y) < ARRIVO) ctx.next();
      },
    },

    {
      // L'appuntamento. **Ore d'ufficio**: chi arriva dopo le cinque o prima di pranzo si
      // mette lì e passa il tempo che manca (`ctx.waitUntil`). Chi ha fallito l'archivio
      // sparando deve aspettare **il giorno dopo**, non la prossima volta che sono le 14.
      id: 'ora',
      hint: 'Aspetta le 14:00 — ore d\'ufficio',
      enter(ctx) {
        const s = sites(ctx.game);
        if (s.torre) ctx.mark(s.torre.x, s.torre.y, { label: '한성개발' });
        ctx.point({
          id: 'aspetta',
          key: 'F',
          onFoot: false,
          text: 'aspetta che sia l\'ora',
          reach: 210,
          x: s.torre ? s.torre.x : ctx.game.player.x,
          y: s.torre ? s.torre.y : ctx.game.player.y,
          run: (c) => {
            c.waitUntil(APPUNTAMENTO);
            const dc = c.game.dayCycle;
            if (c.state.chiuso !== undefined && dc.day <= c.state.chiuso) dc.advance(24);
            c.next();
          },
        });
      },
      tick(dt, ctx) {
        const dc = ctx.game.dayCycle;
        const st = ctx.state;
        const aperto = st.chiuso === undefined || dc.day > st.chiuso;
        if (aperto && dc.hour >= APPUNTAMENTO - FINESTRA && dc.hour < CHIUSURA_ORE) ctx.next();
      },
    },

    panelPhase('m6-apertura', APERTURA),

    {
      id: 'ingresso',
      hint: 'La torre: dalla porta in completo, o dal parcheggio dietro una berlina',
      enter(ctx) {
        const game = ctx.game;
        const st = ctx.state;
        const s = sites(game);
        if (!s.torre) { ctx.next(); return; }
        ctx.mark(s.torre.x, s.torre.y, { label: '한성개발' });
        st.passa = false;
        st.via = 0;
        st.cacciato = false;
        game.tail.stop();
        sgomberaBerlina(game);

        // **La rampa.** Una berlina della torre esce, va a ritirare e ritorna; chi le sta
        // dietro entra con lei. È la seconda volta che il giocatore fa quel giro.
        ctx.point({
          id: 'rampa',
          key: 'E',
          onFoot: false,
          text: 'aspetta una berlina della torre e seguila',
          reach: 190,
          x: s.torre.x,
          y: s.torre.y,
          run: (c) => { if (!c.state.via) avviaGiro(c); },
        });

        ctx.on('floorShown', (shop, idx) => {
          if (shop.id !== s.torre.id) return;
          // **La porta**: senza completo e senza berlina davanti, il portiere non ti fa
          // salire. Si ritorna in strada nel frame dopo: fare uscire il giocatore da
          // dentro l'evento che lo ha messo dentro lascerebbe `shops.enter` a metà.
          if (!ammesso(ctx)) { st.cacciato = true; return; }
          if (idx === s.torre.level) ctx.next();
        });
        ctx.on('tailLost', () => fallitoGiro(ctx, 'L\'hai persa di vista'));
        ctx.on('tailSpotted', () => fallitoGiro(ctx, 'Ti ha visto: non ti aspetta nessuno'));
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const st = ctx.state;
        const s = sites(game);
        if (st.cacciato && game.shops.active) {
          st.cacciato = false;
          game.shops.leave(game);
          ctx.talk([
            { who: 'Portiere', text: '«Lei è atteso?»' },
            { who: 'Jae-min', text: '«All\'ottavo.»' },
            { who: 'Portiere', text: '«Con quel giubbotto no. All\'ottavo si sale in completo, o dal parcheggio.»' },
          ]);
          return;
        }
        const v = M6._berlina;
        if (!v || !s.torre) return;
        if (st.via === 1) {
          // Andata: finché non è arrivata al 편의점 non succede niente.
          const meta = s.conv || game.city.spawn;
          if (!arrivata(v, meta)) return;
          st.via = 2;
          st.t = 0;
          if (v.ai) { v.ai.arrived = false; v.ai.arrive = null; v.ai.plan = null; }
        } else if (st.via === 2) {
          // Sosta: tre secondi fermi, e poi si riparte verso la torre.
          st.t += dt;
          if (st.t < SOSTA) return;
          st.via = 3;
          if (!game.traffic.sendTo(v, s.torre.x, s.torre.y, game)) {
            game.tail.stop();
            sgomberaBerlina(game);
            st.passa = true;
            ctx.toast('La sbarra della rampa è alzata', 3.2);
          }
        } else if (st.via === 3) {
          if (!arrivata(v, s.torre)) return;
          // **Scende la rampa e sparisce.** Dietro di lei la sbarra resta su.
          game.tail.stop();
          sgomberaBerlina(game);
          st.via = 4;
          st.passa = true;
          ctx.toast('La sbarra si alza per la berlina, e per chi la segue', 3.6);
        }
      },
      leave(ctx) {
        ctx.game.tail.stop();
        sgomberaBerlina(ctx.game);
      },
    },

    {
      // La lettura. Qui il gioco **rallenta**: sette faldoni sul piano, tre inutili.
      id: 'archivio',
      hint: 'Archivio contratti, 8층 — sette faldoni',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        ctx.state.letti = ctx.state.letti || [];
        delete ctx.state.fine;
        ctx.mark(s.torre.x, s.torre.y, { label: '한성개발' });
        const place = (shop, idx, f) => {
          if (shop.id === s.torre.id && idx === s.torre.level) apparecchia(ctx, f);
        };
        ctx.on('floorShown', place);
        const it = game.shops.active;
        if (it && game.shops.floor) place(it.shop, it.cur, game.shops.floor);
      },
      tick(dt, ctx) {
        if (controllaTorre(ctx)) return;
        if (ctx.state.fine === undefined) return;
        // **Il silenzio dopo la riga del 1992.** Niente pannello, niente battuta, niente
        // musica: il giocatore ha ancora il faldone in mano.
        ctx.state.fine += dt;
        if (ctx.state.fine >= SILENZIO) ctx.next();
      },
    },

    {
      // L'allarme parte, e non per colpa del giocatore. Il narratore dice solo quello che
      // si vede dal piano: dove suona, e cosa fanno gli ascensori.
      id: 'allarme',
      hint: 'L\'allarme è partito',
      enter(ctx) {
        const game = ctx.game;
        game.audio?.ui('deny');
        ctx.talk([
          { text: 'Un allarme, dal piano terra. Tutti gli ascensori scendono, e uno solo sale.' },
        ], () => ctx.next());
      },
    },

    {
      id: 'stanza',
      hint: 'In fondo al corridoio una porta è rimasta aperta',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        ctx.state.ryu = null;
        const stage = (shop, idx, f) => {
          if (shop.id !== s.torre.id || idx !== s.torre.level) return;
          const p = mettiRyu(game, f);
          ctx.drop('ryu');
          ctx.point({
            id: 'ryu', shop: s.torre.id, level: s.torre.level, key: 'E', text: 'entra nella stanza con la porta aperta',
            reach: 64, x: p.x, y: p.y + 24,
            run: (c) => {
              c.talk([
                { text: '류광호 · Ryu Gwang-ho, presidente di 한성개발.' },
                { who: 'Ryu', text: '«Lei è più basso di come la immaginavo.»' },
                { who: 'Jae-min', text: '«Ci siamo già visti?»' },
                {
                  who: 'Ryu',
                  text: '«Lei firma le nostre carte da dodici anni, signor Seo. Sempre in fondo a destra, e senza mai leggere la seconda pagina.» (rimette gli occhiali) «Prenda l\'ascensore di servizio. Quello grande ha le telecamere, e io preferisco non doverla far cercare.»',
                  note: 'Si è tolto gli occhiali per la prima frase e li ha rimessi per l\'ultima.',
                },
              ], () => c.next());
            },
          });
        };
        ctx.on('floorShown', stage);
        const it = game.shops.active;
        if (it && game.shops.floor) stage(it.shop, it.cur, game.shops.floor);
      },
      tick(dt, ctx) { controllaTorre(ctx); },
    },

    {
      id: 'uscita',
      hint: 'L\'ascensore di servizio: esci dalla torre',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.torre.x, s.torre.y, { label: '한성개발' });
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        const game = ctx.game;
        if (controllaTorre(ctx)) return;
        if (game.indoors) return;
        if (dist(game.player.x, game.player.y, s.torre.x, s.torre.y) > 120) ctx.next();
      },
    },

    panelPhase('m6-chiusura', CHIUSURA),
  ],

  finish(game) {
    sgomberaBerlina(game);
    game.tail.stop();
    game.hud.toast('누가 네 이름을 썼나 — completata', 3.4);
  },
};

/**
 * **Sparare dentro la torre** chiude l'archivio per la giornata di gioco: tre stelle
 * mentre si è dentro e si torna alla fase dell'appuntamento, con il giorno segnato nel
 * taccuino. Non è una morte e non rimette i pannelli (`seen`): si rientra e basta.
 */
function controllaTorre(ctx) {
  const game = ctx.game;
  const s = sites(game);
  const it = game.shops.active;
  if (!game.indoors || !it || it.shop.id !== s.torre.id || game.wanted.level < 3) return false;
  ctx.state.chiuso = game.dayCycle.day;
  delete ctx.state.fine;
  ctx.toast('L\'archivio è chiuso per oggi: torna domani alle 14:00', 4.4);
  torna(game, 'ora');
  return true;
}
