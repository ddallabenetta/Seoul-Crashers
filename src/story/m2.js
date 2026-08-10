// M2 · «Quello che resta in pegno» — 저당
//
// Il copione sta in `docs/storia/03-atto-1.md`. 전당포 di Hongdae, pomeriggio,
// sereno: **la sola missione dell'atto con la luce piena**, ed è voluto — è la
// missione in cui si guarda.
//
// Fa tre lavori, e conviene sapere quali prima di toccarla:
//
//   1. dice **una volta e in chiaro** cos'è il registro del quartiere — la cosa
//      per cui si ammazzano tutti, e che fino a qui nessuno aveva nominato;
//   2. insegna la città **a piedi**: tre pegni sparsi, uno in un vicolo, uno nel
//      cortile di una banda, uno in un appartamento vuoto;
//   3. semina la rivelazione 2 con un nome inciso — 구만기 — che il giocatore non
//      ha ancora nessun motivo di legare a sé. **Non va spiegato qui**, e i
//      pannelli di chiusura sono scritti apposta per non farlo (regola 6).
//
// Jo Ok-bun è il primo personaggio nominato del gioco che **sta dentro un
// edificio**: `actors.define` con `indoor`, ed è il piano a metterla in scena e
// non lo streaming (§5.29).
import { panelPhase } from '../core/missions.js';
import { findShop, findTurf, freeSpot } from './places.js';
import { won } from '../entities/shops.js';
import { createPed } from '../entities/pedestrians.js';
import {
  PAPER, AMBER,
  px, py, flat, wash, vignette, glow, hash,
  block, sign, narrator, speech,
} from '../render/panelkit.js';
import { figure, unitScale } from '../render/pixelkit.js';

/** Quanto vuole il capocortile del 철마파 per una cassetta che non è sua. */
const PREZZO_CASSETTA = 120000;

function sites(game) {
  if (M2._sites) return M2._sites;
  const from = game.city.spawn;
  const pawn = findShop(game, 'pawn', { district: 'hongdae', near: from });
  const nore = findShop(game, 'noraebang', { district: 'hongdae', near: from, avoid: [pawn?.id] });
  const flat_ = findShop(game, 'home', {
    district: 'hongdae', near: from, minDist: 420, avoid: [pawn?.id, nore?.id],
  });
  const yard = findTurf(game, 'cheolma', from);
  M2._sites = { pawn, nore, flat: flat_, yard };
  return M2._sites;
}

// --- i tre pegni ---------------------------------------------------------------------
//
// Sono una tabella e non tre fasi: la decisione presa con l'utente è **un blip
// solo**, quindi l'ordine lo sceglie il giocatore e la fase è una sola con tre
// caselle da spuntare. Il blip si sposta sul più vicino di quelli che restano.

const PEGNI = [
  { id: 'giradischi', label: 'un giradischi', hangul: '노래방' },
  { id: 'cassetta', label: 'una cassetta di attrezzi', hangul: '철마파' },
  { id: 'scatola', label: 'una scatola di latta', hangul: '철거예정' },
];

function taken(ctx, id) {
  return (ctx.state.pegni || []).includes(id);
}

function collect(ctx, id, label) {
  // Il punto se ne va con l'oggetto: lasciarlo lì vorrebbe dire un suggerimento
  // che offre una scatola di latta che è già in tasca.
  ctx.drop(id);
  ctx.state.pegni = [...(ctx.state.pegni || []), id];
  const n = ctx.state.pegni.length;
  ctx.toast(`Pegno recuperato: ${label} · ${n}/3`, 3);
  ctx.game.audio?.ui('ok');
  if (n >= PEGNI.length) { ctx.next(); return; }
  aimAtNext(ctx);
}

/** Il blip sul pegno rimasto più vicino. Non è una comodità: è la decisione §3. */
function aimAtNext(ctx) {
  const game = ctx.game;
  const s = sites(game);
  const where = { giradischi: s.nore, cassetta: s.yard, scatola: s.flat };
  const pl = game.player;
  let best = null;
  let bestD = Infinity;
  for (const p of PEGNI) {
    if (taken(ctx, p.id)) continue;
    const w = where[p.id];
    if (!w) continue;
    const d = Math.hypot(w.x - pl.x, w.y - pl.y);
    if (d >= bestD) continue;
    bestD = d;
    best = { p, w };
  }
  if (!best) return;
  ctx.mark(best.w.x, best.w.y, { label: best.p.hangul });
  const left = PEGNI.filter((p) => !taken(ctx, p.id)).map((p) => p.label).join(', ');
  ctx.say(`Tre pegni scaduti — mancano: ${left}`);
}

// --- i pannelli --------------------------------------------------------------------

export const APERTURA = [
  {
    // L'insegna e il buio dietro il vetro. Il neon ronza: qui il ronzio è una
    // pulsazione dell'alone, perché i pannelli non hanno suono.
    id: 'm2-1',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#7d8492', '#2c3038', 0.5);
      block(P, P.x, py(P, 0.0), P.w, P.h * 0.46, '#3d3a36');
      // La vetrina: nera, e dentro le colonne degli scaffali fino al soffitto.
      ctx.fillStyle = '#0a0b0e';
      ctx.fillRect(px(P, 0.1), py(P, 0.34), P.w * 0.8, P.h * 0.5);
      for (let i = 0; i < 7; i++) {
        const u = 0.14 + i * 0.106;
        ctx.fillStyle = `rgba(80,72,58,${0.22 + hash(i * 7.3) * 0.3})`;
        ctx.fillRect(px(P, u), py(P, 0.38), P.w * 0.075, P.h * 0.42);
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = `rgba(150,132,96,${0.1 + hash(i * 3.1 + k) * 0.22})`;
          ctx.fillRect(px(P, u), py(P, 0.4 + k * 0.082), P.w * 0.075, P.h * 0.012);
        }
      }
      ctx.fillStyle = 'rgba(150,180,210,0.06)';
      ctx.fillRect(px(P, 0.1), py(P, 0.34), P.w * 0.8, P.h * 0.5);
      // Il ronzio: l'alone respira, la scritta no.
      const buzz = 0.72 + 0.28 * Math.abs(Math.sin(P.t * 9));
      sign(P, '전당포', px(P, 0.5), py(P, 0.26), {
        size: P.h * 0.13, color: '#c9a24a', glowR: P.h * 0.7 * buzz,
      });
      ctx.fillStyle = 'rgba(6,8,11,0.55)';
      ctx.fillRect(P.x, py(P, 0.84), P.w, P.h * 0.16);
      vignette(P, 0.5);
      narrator(P, '전당포, il banco dei pegni.');
    },
  },
  {
    // Jo Ok-bun. La faccia è tutta la scena: occhi chiusi, e l'accendino in mano
    // pesato come se pesasse davvero.
    id: 'm2-2',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#312a24', '#14100d');
      // Il banco, in primo piano, e la parete di scaffali dietro.
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(96,84,62,${0.2 + hash(i * 4.7) * 0.2})`;
        ctx.fillRect(px(P, 0.04 + i * 0.16), py(P, 0.06), P.w * 0.12, P.h * 0.5);
      }
      glow(P, px(P, 0.42), py(P, 0.28), P.h * 0.5, '#c9a24a', 0.22);
      // Lei **dietro** il banco, e quindi disegnata prima: al primo provino il
      // bancone le arrivava alla fronte e del personaggio restava un cappello.
      figure(P, 'jo', px(P, 0.42), py(P, 0.6), unitScale(P, 0.62, 30), 'stand', {
        crop: 30, mood: 'parla',
      });
      ctx.fillStyle = '#4a3a26';
      ctx.fillRect(P.x, py(P, 0.6), P.w, P.h * 0.4);
      ctx.fillStyle = '#6b5436';
      ctx.fillRect(P.x, py(P, 0.6), P.w, P.h * 0.018);
      // L'accendino, sul banco, sotto la sua mano: piccolo e con l'ottone acceso,
      // perché è l'unica cosa che si muove in tutto il pannello.
      glow(P, px(P, 0.66), py(P, 0.625), P.h * 0.1, AMBER, 0.45);
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(px(P, 0.645), py(P, 0.605), P.w * 0.028, P.h * 0.045);
      ctx.fillStyle = '#8a6c2e';
      ctx.fillRect(px(P, 0.645), py(P, 0.605), P.w * 0.028, P.h * 0.012);
      vignette(P, 0.55);
      narrator(P, '조옥분 · Jo Ok-bun, 78 anni. Tiene questo banco\nda quarantun anni. Cieca da nove.');
      speech(P, [
        { who: 'Jo', text: '«Passo pesante a destra. Scarpa nuova. Uomo di novanta chili che ne dichiara ottanta.»' },
        { who: 'Jae-min', text: '«Sono—»' },
        { who: 'Jo', text: '«So chi sei. Cammini come tuo padre e ti fermi come un altro.»' },
        { note: true, text: 'Non ha alzato la testa e non ha aperto gli occhi.' },
      ]);
    },
  },
];

export const CHIUSURA = [
  {
    // L'orologio nella mano. Un primo piano vero: niente stanza, niente sfondo.
    id: 'm2-3',
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#181410');
      glow(P, px(P, 0.5), py(P, 0.55), P.h * 0.65, AMBER, 0.2);
      // Il palmo aperto, visto dall'alto, e le quattro dita che si aprono verso
      // l'alto. Le dita **prima** del palmo: escono da sotto, non ci stanno sopra.
      for (let i = 0; i < 4; i++) {
        const x = px(P, 0.31 + i * 0.11);
        const w = P.w * 0.085;
        ctx.fillStyle = i % 2 ? '#b98c60' : '#c9a074';
        ctx.fillRect(x, py(P, 0.3), w, P.h * 0.26);
        // Il polpastrello arrotondato: senza, quattro rettangoli in fila sono uno
        // steccato, ed è quello che erano al primo provino.
        ctx.beginPath();
        ctx.arc(x + w / 2, py(P, 0.3), w / 2, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = 'rgba(90,62,40,0.3)';
        ctx.fillRect(x, py(P, 0.36), w, P.h * 0.012);
      }
      // Il pollice, di lato: è l'unica cosa che distingue una mano da una fila di dita.
      ctx.fillStyle = '#b98c60';
      ctx.fillRect(px(P, 0.19), py(P, 0.54), P.w * 0.11, P.h * 0.1);
      ctx.beginPath();
      ctx.arc(px(P, 0.19), py(P, 0.59), P.h * 0.05, Math.PI / 2, -Math.PI / 2);
      ctx.fill();
      ctx.fillStyle = '#c19468';
      ctx.fillRect(px(P, 0.26), py(P, 0.5), P.w * 0.48, P.h * 0.26);
      ctx.fillStyle = '#a97c53';
      ctx.fillRect(px(P, 0.26), py(P, 0.72), P.w * 0.48, P.h * 0.04);
      // Il cinturino consumato, che scavalca il palmo: due segmenti scuri.
      ctx.fillStyle = '#3a2a1e';
      ctx.fillRect(px(P, 0.34), py(P, 0.5), P.w * 0.07, P.h * 0.24);
      ctx.fillRect(px(P, 0.59), py(P, 0.5), P.w * 0.07, P.h * 0.24);
      ctx.fillStyle = '#54402f';
      ctx.fillRect(px(P, 0.34), py(P, 0.5), P.w * 0.07, P.h * 0.02);
      // La cassa, appoggiata sul palmo.
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(px(P, 0.5) + P.h * 0.012, py(P, 0.6) + P.h * 0.012, P.h * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8a06a';
      ctx.beginPath();
      ctx.arc(px(P, 0.5), py(P, 0.6), P.h * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e2d0';
      ctx.beginPath();
      ctx.arc(px(P, 0.5), py(P, 0.6), P.h * 0.145, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2b2a26';
      ctx.lineWidth = Math.max(2, P.h * 0.011);
      ctx.beginPath();
      ctx.moveTo(px(P, 0.5), py(P, 0.6));
      ctx.lineTo(px(P, 0.5), py(P, 0.49));
      ctx.moveTo(px(P, 0.5), py(P, 0.6));
      ctx.lineTo(px(P, 0.562), py(P, 0.64));
      ctx.stroke();
      vignette(P, 0.6);
      narrator(P, 'L\'orologio che ha impegnato qui a diciannove anni\nper quattrocentomila won.');
    },
  },
  {
    // Il retro della cassa, girato verso lo schermo. Il nome inciso è **grande**:
    // il giocatore deve poterlo rileggere fra sei ore di gioco e riconoscerlo.
    id: 'm2-4',
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#121016');
      glow(P, px(P, 0.5), py(P, 0.46), P.h * 0.55, PAPER, 0.1);
      ctx.fillStyle = '#9a8f78';
      ctx.beginPath();
      ctx.arc(px(P, 0.5), py(P, 0.46), P.h * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b2a68c';
      ctx.beginPath();
      ctx.arc(px(P, 0.5), py(P, 0.46), P.h * 0.26, 0, Math.PI * 2);
      ctx.fill();
      // I graffi del fondello: righe concentriche **solo attorno** al nome. Sotto
      // l'incisione erano rumore, e a schermo il nome non si leggeva più — che è
      // l'unica cosa che questo pannello deve fare.
      ctx.strokeStyle = 'rgba(60,54,44,0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(px(P, 0.5), py(P, 0.46), P.h * (0.17 + i * 0.02), 0, Math.PI * 2);
        ctx.stroke();
      }
      // L'incisione, a punta: il solco scuro e una lumeggiatura **sopra**, di un
      // pixel. Le due passate sovrapposte facevano una macchia.
      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.round(P.h * 0.19)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.fillStyle = 'rgba(226,220,202,0.55)';
      ctx.fillText('구만기', px(P, 0.5), py(P, 0.53) - Math.max(1, P.h * 0.006));
      ctx.fillStyle = '#2b251c';
      ctx.fillText('구만기', px(P, 0.5), py(P, 0.53));
      ctx.textAlign = 'left';
      narrator(P, 'Un nome inciso sul retro: 구만기 · Ku Man-gi.\nNon è Seo.');
    },
  },
  {
    // I nove oggetti sullo scaffale. Sono **nove** e vanno contati: tornano in
    // M10 e in M12, dove diventano diciotto (`10-continuita.md`).
    id: 'm2-5',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#2c2620', '#141110');
      // Lo scaffale sta in alto e le cose sono **grandi**: sono nove e si devono
      // poter contare, perché in M10 ne arrivano altri nove e in M12 fanno
      // diciotto (`10-continuita.md`).
      const shelfY = py(P, 0.52);
      glow(P, px(P, 0.5), py(P, 0.34), P.h * 0.55, '#c9a24a', 0.14);
      const things = ['#8fa3b8', '#a8895c', '#c8b98d', '#7d8b6a', '#b06a5c',
        '#9a94a2', '#c9a24a', '#6f7d90', '#a39178'];
      things.forEach((c, i) => {
        const u = 0.07 + i * 0.098;
        const w = P.w * (0.045 + hash(i * 5.9) * 0.03);
        const h = P.h * (0.15 + hash(i * 3.3) * 0.18);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(px(P, u) + 3, shelfY - h + 4, w, h);
        ctx.fillStyle = c;
        ctx.fillRect(px(P, u), shelfY - h, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(px(P, u), shelfY - h, w * 0.3, h);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(px(P, u), shelfY - h * 0.34, w, P.h * 0.014);
      });
      ctx.fillStyle = '#4a3a26';
      ctx.fillRect(px(P, 0.02), shelfY, P.w * 0.96, P.h * 0.03);
      ctx.fillStyle = '#6b5436';
      ctx.fillRect(px(P, 0.02), shelfY, P.w * 0.96, P.h * 0.007);
      // Jo di spalle davanti allo scaffale: la scena è lo scaffale, ma senza di
      // lei nessuno sa **chi** sta rimettendo a posto.
      figure(P, 'jo', px(P, 0.84), py(P, 1.06), unitScale(P, 0.62, 40), 'back');
      vignette(P, 0.5);
      speech(P, [
        { who: 'Jae-min', text: '«Chi è 구만기?»' },
        { who: 'Jo', text: '«Uno che ha smesso di poter pagare.»' },
        { who: 'Jae-min', text: '«Quando?»' },
        { who: 'Jo', text: '«Tanto tempo fa. Torna quando sai fare la domanda giusta.»' },
        { note: true, text: 'Non ha detto che non sa. Ha detto che la domanda è un\'altra.' },
      ]);
    },
  },
];

// --- la missione ----------------------------------------------------------------------

export const M2 = {
  id: 'm2',
  title: 'Quello che resta in pegno',
  hangul: '저당',
  act: 1,

  prepare(game) {
    const s = sites(game);
    // Tre indirizzi tenuti aperti: il banco chiude alle 21 e il 노래방 apre alle
    // 16, e una missione che si può cominciare a qualunque ora non può dipendere
    // dalla saracinesca di nessuno (vedi `shops.hold`).
    for (const a of [s.pawn, s.nore, s.flat]) if (a) game.shops.hold(a.id);
    if (!s.pawn) return;
    game.actors.define('jo', {
      indoor: true, shop: s.pawn.id, level: s.pawn.level,
      kind: 'civil', name: 'Jo Ok-bun', hangul: '조옥분',
      angle: Math.PI / 2,
      place: (f) => (f.till
        ? { x: f.till.x - 26, y: f.till.y - 20 }
        : freeSpot(f)),
    });
  },

  phases: [
    {
      // Kkachi, in macchina. Una riga sola, e la missione comincia da lì.
      id: 'innesco',
      hint: 'Rimettiti in strada',
      enter(ctx) {
        ctx.unmark();
        const go = () => {
          ctx.radio({ kkachi: true, text: '«Prima di chiedere a un vivo, chiedi a uno scaffale.»' });
          ctx.next();
        };
        ctx.on('enterVehicle', go);
        ctx.on('radioOn', (inCar) => { if (inCar) go(); });
      },
    },

    {
      id: 'banco',
      hint: 'Il 전당포 di Hongdae',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.pawn.x, s.pawn.y, { label: '전당포' });
        ctx.on('shopEnter', (shop) => { if (shop.id === s.pawn.id) ctx.next(); });
      },
    },

    panelPhase('m2-apertura', APERTURA),

    {
      // La scena del registro. È l'unica volta in tutto il gioco in cui si dice in
      // chiaro cos'è, e non si ripete mai più (regola 4).
      id: 'richiesta',
      hint: 'Parla con Jo Ok-bun',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.pawn.x, s.pawn.y, { label: '전당포' });
        joPoint(ctx, 'chiedi del molo 7', () => {
          ctx.talk([
            { who: 'Jae-min', text: '«Voglio sapere del molo 7.»' },
            { who: 'Jo', text: '«Io non so. Io tengo.» (batte la mano sullo scaffale) «Ogni cosa qui sopra è uno che a un certo punto non ha più potuto pagare. Mi ricordo chi, quanto, e a chi.»' },
            { who: 'Jae-min', text: '«E sta scritto dove?»' },
            { who: 'Jo', text: '«Da nessuna parte. Nel quartiere non c\'è un libro dei debiti: ci sono gli scaffali, e ci sono io. Chi si ricorda comanda, ed è per questo che sono ancora aperta.»' },
            { who: 'Jae-min', text: '«E il molo 7?»' },
            { who: 'Jo', text: '«Il molo 7 non è roba mia. Riportami tre cose e vediamo di chi è.»' },
          ], () => ctx.next());
        });
      },
    },

    {
      // I tre recuperi. Una fase sola con tre caselle: l'ordine lo sceglie chi
      // gioca, e il blip segue quello che gli è rimasto più vicino.
      id: 'pegni',
      hint: 'Tre pegni scaduti, in giro per Hongdae',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        ctx.state.pegni = ctx.state.pegni || [];
        aimAtNext(ctx);

        // 1 · il giradischi, al 노래방. Il padrone ha imparato la canzone.
        floorPoint(ctx, 'giradischi', s.nore, 'riprenditi il giradischi', () => {
          if (taken(ctx, 'giradischi')) return;
          ctx.talk([
            { who: 'Padrone', text: '«Me lo riprende adesso? Adesso che ho imparato la canzone?»' },
            { who: 'Jae-min', text: '«Quale canzone?»' },
            { who: 'Padrone', text: '(piange) «Una sola. Sempre quella.»' },
          ], () => collect(ctx, 'giradischi', 'il giradischi'));
        });

        // 2 · la cassetta, nel cortile del 철마파. Tre strade, stesso esito: si
        // paga, si minaccia, o la si prende a chi non è in condizione di dire di no.
        if (s.yard) {
          ctx.point({
            id: 'cassetta',
            key: 'E',
            text: 'la cassetta di attrezzi del cortile',
            reach: 70,
            x: s.yard.x,
            y: s.yard.y,
            run: () => {
              if (taken(ctx, 'cassetta')) return;
              const pl = game.player;
              const ostile = game.wanted.level > 0
                || game.peds.some((p) => p.turf === s.yard.turf && (p.dead || p.state === 'hostile'));
              if (ostile) {
                ctx.talk([
                  { text: 'Nel cortile non c\'è più nessuno con cui trattare. La cassetta è dove l\'hanno lasciata.' },
                ], () => collect(ctx, 'cassetta', 'la cassetta'));
                return;
              }
              const paga = pl.money >= PREZZO_CASSETTA;
              ctx.talk([
                { who: 'Capocortile', hangul: '철마파', text: '«Quella cassetta è di uno che non viene più a prendersela.»' },
                { who: 'Jae-min', text: '«Infatti vengo io.»' },
                paga
                  ? { who: 'Capocortile', text: `«E allora costa ${won(PREZZO_CASSETTA)}. Se la porti via prima che cambi idea.»` }
                  : { who: 'Capocortile', text: '«…Con quel giubbotto addosso, prenditela e vattene. Non è roba che vale una serata.»' },
              ], () => {
                if (paga) {
                  pl.money -= PREZZO_CASSETTA;
                  ctx.toast(`Pagata al 철마파 · ${won(PREZZO_CASSETTA)}`, 2.8);
                }
                collect(ctx, 'cassetta', 'la cassetta');
              });
            },
          });
        }

        // 3 · la scatola di latta, nell'appartamento vuoto. Nessuno con cui
        // parlare: è il punto della scena, quindi il pannello è una riga sola.
        floorPoint(ctx, 'scatola', s.flat, 'la scatola di latta sul davanzale', () => {
          if (taken(ctx, 'scatola')) return;
          ctx.talk([
            { text: 'Sulla porta un adesivo di 한성개발: 철거예정 — demolizione prevista. Dentro non è rimasto niente, tranne una scatola di latta sul davanzale.' },
          ], () => collect(ctx, 'scatola', 'la scatola'));
        });
      },
    },

    {
      id: 'consegna',
      hint: 'Riporta i tre pegni al 전당포',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.pawn.x, s.pawn.y, { label: '전당포' });
        ctx.on('shopEnter', (shop) => { if (shop.id === s.pawn.id) ctx.next(); });
      },
    },

    {
      // La rapina. Non è una scena nuova: è quello che il gioco fa già da solo
      // (§5.26), messo in scena qui. Il giocatore può sparare, menare o lasciar
      // fare — e i due se ne vanno comunque, perché la scena non è la rapina: è
      // quello che Jo dice dopo.
      id: 'rapina',
      hint: 'Consegna a Jo',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(ctx.game);
        ctx.mark(s.pawn.x, s.pawn.y, { label: '전당포' });
        ctx.state.rapina = 0;
        const stage = (shop, idx, f) => {
          if (shop.id !== s.pawn.id || idx !== s.pawn.level) return;
          ctx.state.rapina = 0;
          M2._robbers = spawnRobbers(game, f);
        };
        ctx.on('floorShown', stage);
        const it = game.shops.active;
        if (it && game.shops.floor) stage(it.shop, it.cur, game.shops.floor);
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const s = sites(game);
        const it = game.shops.active;
        if (!it || it.shop.id !== s.pawn.id) return;
        const two = M2._robbers || [];
        if (!two.length) return;
        const f = game.shops.floor;
        ctx.state.rapina += dt;
        // Tre secondi al banco, poi via. Chi li ferma li ferma in quei tre secondi.
        if (ctx.state.rapina > 3) {
          for (const p of two) {
            if (p.dead || p.state === 'flee' || !f.people.includes(p)) continue;
            p.state = 'flee';
            p.home = { x: f.entry.x, y: f.entry.y };
          }
        }
        // **Chi esce dalla porta esce davvero**: `shops.spillOutside` lo passa ai
        // pedoni di città e gli rimette `gone` a falso (§5.21). Quindi la scena non
        // finisce quando i due sono «spariti» — finisce quando non sono più nella
        // sala, che è l'unica cosa che qui dentro vuol dire «se ne sono andati».
        if (two.some((p) => !p.dead && f.people.includes(p))) return;
        M2._robbers = null;
        ctx.talk([
          { who: 'Jo', text: '«Hanno preso i soldi del cassetto e non hanno guardato gli scaffali. Sanno cosa vale. Qui non è mai venuto nessuno a caso.»' },
        ], () => ctx.next());
      },
      leave() { M2._robbers = null; },
    },

    {
      id: 'pagamento',
      hint: 'Jo tira fuori qualcosa dal fondo',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.pawn.x, s.pawn.y, { label: '전당포' });
        joPoint(ctx, 'consegna i tre pegni', () => {
          ctx.talk([
            { text: 'Jo pesa le tre cose una per volta, poi si volta verso il fondo e ne tira fuori una quarta che nessuno le ha chiesto.' },
            { who: 'Jo', text: '«Quindici anni sullo scaffale. Nessuno l\'ha chiesto e io non l\'ho dato.»' },
            { who: 'Jae-min', text: '«Perché?»' },
            { who: 'Jo', text: '«Perché era già di qualcuno.»' },
          ], () => ctx.next());
        });
      },
    },

    panelPhase('m2-chiusura', CHIUSURA),
  ],

  finish(game) {
    // Il nome inciso è la sola cosa che questa missione lascia in mano, ed è un
    // fatto della storia: da qui in poi altre scene possono chiedere se lo si sa.
    game.missions.setFlag('kumangi');
    game.hud.toast('저당 — completata', 3.2);
  },
};

// --- attrezzi della missione ------------------------------------------------------------

/** Il punto davanti a Jo. Lei sta dove `actors` l'ha messa, non dove pare a noi. */
function joPoint(ctx, text, run) {
  const game = ctx.game;
  const s = sites(game);
  const place = (shop, idx) => {
    if (shop.id !== s.pawn.id || idx !== s.pawn.level) return;
    const p = game.actors.get('jo');
    ctx.drop('jo');
    ctx.point({
      id: 'jo', shop: s.pawn.id, level: s.pawn.level, key: 'E', text, run, reach: 56,
      x: p ? p.x : game.shops.floor.entry.x,
      y: p ? p.y + 22 : game.shops.floor.entry.y,
    });
  };
  ctx.on('floorShown', place);
  const it = game.shops.active;
  if (it && game.shops.floor) place(it.shop, it.cur);
}

/** Un oggetto da raccogliere su un piano, messo dove il piano ha posto. */
function floorPoint(ctx, id, addr, text, run) {
  if (!addr) return;
  const game = ctx.game;
  const place = (shop, idx, f) => {
    if (shop.id !== addr.id || idx !== addr.level) return;
    const at = freeSpot(f, { x: f.w * 0.3, y: f.h * 0.4 });
    ctx.drop(id);
    ctx.point({ id, shop: addr.id, level: addr.level, key: 'E', text, run, reach: 48, x: at.x, y: at.y });
  };
  ctx.on('floorShown', place);
  const it = game.shops.active;
  if (it && game.shops.floor) place(it.shop, it.cur, game.shops.floor);
}

/**
 * I due che entrano a rapinare. Sono pedoni normali messi nella gente del piano —
 * `game.peds` **è** `floor.people` mentre si è dentro (§3), quindi da qui in poi
 * mischia, raggi, magnetismo di mira e onda d'urto li trovano senza sapere niente
 * di questa scena. L'unica cosa scritta a mano è dove vanno.
 */
function spawnRobbers(game, f) {
  const out = [];
  for (let i = 0; i < 2; i++) {
    const p = createPed('gangster', f.entry.x + (i ? 26 : -26), f.entry.y - 30, game.actors.rng);
    p.indoor = true;
    p.armed = true;
    p.role = 'keeper';
    // Il banco, non il giocatore: non sono venuti per lui, e Jo non urla.
    p.home = f.till ? { x: f.till.x, y: f.till.y + 24 } : { x: f.w / 2, y: f.h / 2 };
    p.state = 'post';
    f.people.push(p);
    out.push(p);
  }
  f.robbed = true;
  game.pedGrid.rebuild(game.peds);
  game.audio?.ui('deny');
  game.hud.toast('Due entrano dietro di te, e non guardano gli scaffali', 3.4);
  return out;
}
