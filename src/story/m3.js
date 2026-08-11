// M3 · «Il turno di notte» — 야간 근무
//
// Il copione sta in `docs/storia/03-atto-1.md`. Itaewon, un 편의점 all'incrocio:
// **comincia alle `03:20`, il consegnatario arriva alle `04:00`**, e piove. È la
// missione che insegna l'orologio e il meteo, ed è la prima in cui il gioco
// chiede di **non** fare niente — guardare, e stare dietro.
//
// Tre cose non sono decorazione:
//
//   · **il pedinamento** (`core/tail.js`) è la meccanica nuova dell'atto e torna
//     in M6 e M9. Qui è a fari spenti e sotto l'acqua, che sono i due modi in cui
//     il gioco dice «piano» senza mettere un timer;
//   · **il volume scende davvero.** Quando Kkachi dice «abbassa», il gioco abbassa
//     la manopola vera — quella del mixer — e **non la rialza**. È il pezzo di
//     `00-soggetto.md` §6, ed è l'unica scena in cui stare zitti *è* la meccanica;
//   · **l'ora è un appuntamento, non un vincolo.** Chi arriva all'incrocio alle
//     tre del pomeriggio non aspetta dodici minuti veri: si mette lì e passa la
//     notte (`ctx.waitUntil`, la decisione 3 di `08-domande-aperte.md`).
//
// La busta che parte da Itaewon e scende in un parcheggio di Gangnam è **il fatto
// dell'Atto I**: da qui in poi il giocatore sa che il 백호파 non riscuote da
// 한성개발, la paga. La riga di Kkachi che lo dice (`a1-itaewon`) era già scritta
// nella tappa D e aspettava solo questa missione per avverarsi.
import { panelPhase } from '../core/missions.js';
import { findShop, tillPoint } from './places.js';
import {
  AMBER, PAPER, BLOOD,
  px, py, flat, wash, vignette, glow, hash,
  block, sign, rain, wetFloor, car, narrator, speech,
} from '../render/panelkit.js';
import { figure, unitScale } from '../render/pixelkit.js';

/** L'ora dell'appuntamento e quella della consegna: le due del copione. */
const APPUNTAMENTO = 3 + 20 / 60;
const CONSEGNA = 4;
const RITIRO = 4 + 6 / 60;
/** Quanto in largo si concede l'appuntamento prima di far aspettare. */
const FINESTRA = 0.6;
/** Il caffè del 편의점, allo stesso prezzo del listino di quartiere. */
const CAFFE = 1200;
/** Dove scende il volume quando Kkachi chiede di abbassare. */
const ABBASSATO = 0.12;

function sites(game) {
  if (M3._sites) return M3._sites;
  const from = game.city.spawn;
  // Il minimarket all'incrocio di Itaewon: aperto ventiquattr'ore, quindi è
  // l'unico posto della campagna che non ha bisogno di `shops.hold`.
  const conv = findShop(game, 'conv', { district: 'itaewon', near: from });
  // La torre di vetro di Gangnam. Il copione dice «un parcheggio interrato sotto
  // una torre con l'insegna 한성개발»: il parcheggio non esiste come luogo
  // percorribile, la torre sì, e la rampa è la sua porta — è dove la berlina si
  // ferma e dove finisce il pedinamento.
  const torre = findShop(game, 'office', { district: 'gangnam', near: conv || from });
  M3._sites = { conv, torre };
  return M3._sites;
}

/**
 * «Abbassa.» E il volume scende davvero, su tutte e due le manopole che possono
 * star suonando: la stazione coreana (`mix.radio`) e la musica del gioco
 * (`mix.music`). **Non risale da sola** — chi la rivuole se la rialza dal mixer,
 * ed è tutto il senso della scena.
 */
function abbassa(game) {
  const a = game.audio;
  if (!a) return;
  a.setVolume('radio', Math.min(a.mix.radio, ABBASSATO));
  a.setVolume('music', Math.min(a.mix.music, ABBASSATO));
}

/** Toglie di mezzo le due auto della scena. Una missione non lascia lamiere. */
function sgombera(game) {
  for (const key of ['_furgone', '_berlina']) {
    const v = M3[key];
    if (!v) continue;
    const i = game.vehicles.indexOf(v);
    if (i >= 0) game.vehicles.splice(i, 1);
    M3[key] = null;
  }
}

/**
 * Un'auto che arriva in un posto. Nasce fuori vista, sulla corsia più vicina a un
 * punto a un paio di isolati di distanza, e ci va davvero (`traffic.sendTo`).
 * Quando le strade non ci arrivano — non succede a Seoul, ma una missione non può
 * dipendere da questo — si restituisce `null` e la fase si chiude lo stesso.
 */
function mandaA(game, kind, from, to, opts = {}) {
  const v = game.traffic.spawnScripted(kind, from.x, from.y, game, {
    lightsOn: true, speed: opts.speed || 120, radius: 900, colorIndex: opts.colorIndex ?? 0,
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
function arrivata(v, to) {
  if (!v) return true;
  if (v.dead) return true;
  return !!v.ai?.arrived || Math.hypot(v.x - to.x, v.y - to.y) < 70;
}

// --- i pannelli -------------------------------------------------------------------

export const APERTURA = [
  {
    // L'incrocio, e una sola insegna accesa. Il pannello ha un lavoro solo: dire
    // che a quest'ora, in questo posto, **non c'è nessuno** — quindi le finestre
    // sono spente e il verde del 편의점 è l'unica cosa che illumina l'asfalto.
    id: 'm3-1',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#0a0f16', '#05070b', 0.55);
      // I palazzi attorno, spenti. Due sole finestre accese in tutto il pannello:
      // una città sveglia alle tre di notte è una città che non fa paura.
      block(P, P.x, py(P, 0.04), P.w * 0.3, P.h * 0.66, '#141a24');
      block(P, px(P, 0.72), py(P, -0.02), P.w * 0.28, P.h * 0.7, '#121822');
      block(P, px(P, 0.31), py(P, 0.16), P.w * 0.18, P.h * 0.5, '#161d28');
      ctx.fillStyle = 'rgba(255,209,120,0.5)';
      ctx.fillRect(px(P, 0.05), py(P, 0.22), P.w * 0.024, P.h * 0.035);
      ctx.fillRect(px(P, 0.84), py(P, 0.3), P.w * 0.02, P.h * 0.03);
      // Il minimarket. Al primo provino era un rettangolo chiaro appeso a un
      // muro: sembrava un manifesto, non un negozio. Quello che lo fa leggere
      // sono tre cose messe in fila — la fascia dell'insegna sopra il vetro, i
      // montanti che dividono la vetrina, e **due scaffali in controluce**
      // dentro: senza qualcosa di scuro dietro il vetro, la luce non ha una
      // stanza in cui stare.
      glow(P, px(P, 0.6), py(P, 0.5), P.h * 0.62, '#4ad98a', 0.28);
      ctx.fillStyle = '#1b232a';
      ctx.fillRect(px(P, 0.44), py(P, 0.24), P.w * 0.36, P.h * 0.44);
      // La fascia dell'insegna, e sotto il vetro.
      ctx.fillStyle = '#20342c';
      ctx.fillRect(px(P, 0.44), py(P, 0.24), P.w * 0.36, P.h * 0.09);
      ctx.fillStyle = 'rgba(190,245,215,0.72)';
      ctx.fillRect(px(P, 0.46), py(P, 0.35), P.w * 0.32, P.h * 0.3);
      // Dentro: due scaffalature e il bancone, in controluce. Gli scaffali
      // vogliono i **ripiani**: un rettangolo scuro e alto dentro una vetrina è
      // una porta, tre righe orizzontali dentro sono una fila di scatolette.
      for (const u of [0.485, 0.585]) {
        ctx.fillStyle = 'rgba(18,32,26,0.62)';
        ctx.fillRect(px(P, u), py(P, 0.39), P.w * 0.035, P.h * 0.2);
        ctx.fillStyle = 'rgba(140,215,175,0.5)';
        for (let i = 0; i < 3; i++) ctx.fillRect(px(P, u), py(P, 0.42 + i * 0.06), P.w * 0.035, P.h * 0.008);
      }
      ctx.fillStyle = 'rgba(18,32,26,0.8)';
      ctx.fillRect(px(P, 0.46), py(P, 0.605), P.w * 0.32, P.h * 0.045);
      // I montanti del vetro e la porta a destra.
      ctx.fillStyle = '#16211d';
      for (const u of [0.545, 0.63]) ctx.fillRect(px(P, u), py(P, 0.35), P.w * 0.008, P.h * 0.3);
      ctx.fillRect(px(P, 0.7), py(P, 0.35), P.w * 0.008, P.h * 0.3);
      ctx.fillStyle = 'rgba(150,225,190,0.5)';
      ctx.fillRect(px(P, 0.708), py(P, 0.36), P.w * 0.06, P.h * 0.29);
      sign(P, '편의점', px(P, 0.62), py(P, 0.32), { size: P.h * 0.075, color: '#4ad98a', glowR: P.h * 0.44 });
      // L'incrocio. Il marciapiede è una fascia con il cordolo chiaro, e le
      // strisce sono **grosse e orizzontali**: sottili diventano trattini che
      // galleggiano, e a quel punto non c'è nessuna strada sotto.
      ctx.fillStyle = '#1b2129';
      ctx.fillRect(P.x, py(P, 0.68), P.w, P.h * 0.07);
      ctx.fillStyle = 'rgba(190,205,220,0.22)';
      ctx.fillRect(P.x, py(P, 0.745), P.w, P.h * 0.008);
      ctx.fillStyle = '#12171d';
      ctx.fillRect(P.x, py(P, 0.753), P.w, P.h * 0.247);
      for (let i = 0; i < 5; i++) {
        const v = 0.79 + i * 0.05;
        ctx.fillStyle = `rgba(205,218,232,${0.1 + i * 0.03})`;
        ctx.fillRect(P.x, py(P, v), P.w, P.h * (0.012 + i * 0.004));
      }
      wetFloor(P, py(P, 0.753), ['#4ad98a'], { alpha: 0.16 });
      rain(P, 0.7);
      vignette(P, 0.62);
      narrator(P, '03:20. Itaewon, l\'incrocio del minimarket.\nÈ l\'unica insegna accesa in tutta la strada.');
    },
  },
  {
    // L'altra macchina. Il soggetto del pannello è **il vetro appannato**: dice da
    // solo che è ferma da un pezzo, e che dentro c'è qualcuno che respira. Chi ci
    // sta non si vede, e non deve vedersi fino al pannello 4.
    id: 'm3-2',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#0b1017', '#06080c', 0.5);
      glow(P, px(P, 0.14), py(P, 0.3), P.h * 0.6, '#4ad98a', 0.16);
      block(P, px(P, 0.66), py(P, 0.02), P.w * 0.34, P.h * 0.52, '#131923');
      ctx.fillStyle = '#141920';
      ctx.fillRect(P.x, py(P, 0.52), P.w, P.h * 0.48);
      wetFloor(P, py(P, 0.52), ['#4ad98a'], { alpha: 0.22 });
      // L'auto, grande e di profilo: è il soggetto, quindi prende mezzo pannello.
      // Il colore non può essere quasi-nero: su una notte senza lampioni una
      // carrozzeria scura è un buco, e il pannello resta senza soggetto.
      const s = P.w * 0.72;
      const cx = px(P, 0.5);
      const cy = py(P, 0.82);
      car(P, cx, cy, s, '#232a35', { glass: '#9fb3c4' });
      // Il riflesso verde dell'insegna sulla fiancata: è la sola cosa che dice
      // che questa macchina sta dall'altra parte della strada e non qui.
      ctx.fillStyle = 'rgba(74,217,138,0.13)';
      ctx.fillRect(cx - s * 0.3, cy - s * 0.14, s * 0.58, s * 0.035);
      // La condensa: **la stessa finestra che disegna `car()`**, e non un
      // rettangolo messo a occhio lì vicino. Al primo provino stava sotto, e
      // sembrava un vetro rotto con un pezzo di compensato al posto suo.
      const gx = cx - s * 0.045;
      const gy = cy - s * 0.31;
      const gw = s * 0.19;
      const gh = s * 0.12;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#dfe9f3';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.restore();
      // I rivoli, dentro il vetro: verticali, corti, appesi al bordo di sotto.
      ctx.fillStyle = 'rgba(70,84,100,0.75)';
      for (let i = 0; i < 6; i++) {
        const u = gx + gw * (0.08 + hash(i * 6.1) * 0.84);
        const l = gh * (0.25 + hash(i * 2.3) * 0.5);
        ctx.fillRect(u, gy + gh - l, 1.5, l);
      }
      rain(P, 0.75);
      vignette(P, 0.6);
      narrator(P, 'Dall\'altra parte della strada, un\'auto ferma.\nMotore spento. I vetri sono appannati da dentro.');
      speech(P, [
        { text: 'È lì da un pezzo, e guarda lo stesso posto che stai guardando tu.', note: true },
      ]);
    },
  },
];

export const CHIUSURA = [
  {
    // La rampa. Due auto muso a muso e i fari accesi: il pannello è tutto
    // controluce, e le due sagome nere sono la scena.
    id: 'm3-3',
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#070a0f');
      // La bocca del parcheggio: il cemento sopra, il buio davanti, e l'acqua che
      // entra dallo spigolo. Il soffitto basso è quello che dice «interrato».
      ctx.fillStyle = '#1a1f27';
      ctx.fillRect(P.x, P.y, P.w, P.h * 0.22);
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(P.x, py(P, 0.22), P.w, P.h * 0.04);
      ctx.fillStyle = '#12161d';
      ctx.fillRect(P.x, py(P, 0.7), P.w, P.h * 0.3);
      // I due fasci, incrociati. Vanno disegnati prima delle auto: sono la luce
      // in cui le auto stanno, non una vernice sopra.
      glow(P, px(P, 0.34), py(P, 0.62), P.h * 0.6, AMBER, 0.34);
      glow(P, px(P, 0.68), py(P, 0.6), P.h * 0.55, '#dfe8f5', 0.26);
      car(P, px(P, 0.3), py(P, 0.78), P.w * 0.44, '#0e1116', { lights: true, glass: '#1c242e', wipers: true });
      car(P, px(P, 0.74), py(P, 0.74), P.w * 0.42, '#0b0e13', { flip: true, lights: true, glass: '#1c242e' });
      wetFloor(P, py(P, 0.7), ['#ffb163', '#dfe8f5'], { alpha: 0.3 });
      rain(P, 0.5, { angle: 0.5 });
      vignette(P, 0.66);
      narrator(P, 'Rampa del parcheggio, 04:41. L\'uscita è larga una macchina.');
    },
  },
  {
    // Ha-eun. Il pannello ha **un** lavoro: farla riconoscere fra cinque mesi, in
    // M8. Quindi è vicina, il finestrino è abbassato di dieci centimetri e il
    // tesserino sul cruscotto è girato verso di lui — non verso di noi.
    id: 'm3-4',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#10151d', '#070a0e', 0.55);
      glow(P, px(P, 0.3), py(P, 0.5), P.h * 0.7, '#8fb6e8', 0.18);
      // L'abitacolo attorno: montante a sinistra, tetto sopra.
      ctx.fillStyle = '#0c1015';
      ctx.fillRect(P.x, P.y, P.w * 0.12, P.h);
      ctx.fillRect(P.x, P.y, P.w, P.h * 0.08);
      // Lei, **in alto a destra**: il riquadro delle battute si mangia il terzo
      // basso del pannello e il narratore i due quinti in alto a sinistra, quindi
      // l'unico posto in cui una faccia si vede è questo. Al primo provino stava
      // in mezzo, a figura intera, e non se ne vedeva un pixel.
      figure(P, 'haeun', px(P, 0.79), py(P, 0.62), unitScale(P, 0.46, 27), 'seat', {
        crop: 27, mood: 'parla',
      });
      // Il vetro abbassato di dieci centimetri: il velo di riflesso sta **sopra**
      // di lei ma si ferma alla riga del finestrino, o le copre la faccia.
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#9fb8d4';
      ctx.fillRect(px(P, 0.6), py(P, 0.08), P.w * 0.4, P.h * 0.14);
      ctx.restore();
      ctx.fillStyle = '#05070a';
      ctx.fillRect(px(P, 0.6), py(P, 0.22), P.w * 0.4, P.h * 0.022);
      // Il telefono che fotografa: piccolo, alla sua altezza, verso di noi.
      ctx.fillStyle = '#0f141b';
      ctx.fillRect(px(P, 0.6), py(P, 0.28), P.w * 0.07, P.h * 0.13);
      ctx.fillStyle = 'rgba(190,225,255,0.9)';
      ctx.fillRect(px(P, 0.607), py(P, 0.29), P.w * 0.056, P.h * 0.11);
      // Il tesserino sul cruscotto, girato verso di lui: sta a sinistra, sopra il
      // riquadro delle battute, che è l'ultima striscia di pannello libera.
      ctx.fillStyle = PAPER;
      ctx.fillRect(px(P, 0.17), py(P, 0.25), P.w * 0.2, P.h * 0.13);
      ctx.fillStyle = '#2b3a52';
      ctx.fillRect(px(P, 0.17), py(P, 0.25), P.w * 0.2, P.h * 0.035);
      ctx.fillStyle = 'rgba(40,48,60,0.7)';
      ctx.fillRect(px(P, 0.185), py(P, 0.305), P.w * 0.08, P.h * 0.014);
      ctx.fillRect(px(P, 0.185), py(P, 0.33), P.w * 0.12, P.h * 0.014);
      ctx.fillStyle = '#8fb6e8';
      ctx.fillRect(px(P, 0.325), py(P, 0.29), P.w * 0.03, P.h * 0.06);
      rain(P, 0.35);
      vignette(P, 0.55);
      narrator(P, '윤하은 · Yoon Ha-eun, omicidi di 종로.\nDiciassette anni di servizio.');
      speech(P, [
        { who: 'Ha-eun', text: '«Bel giubbotto. Le sta grande.»' },
        { who: 'Jae-min', text: '«Era di mio padre.»' },
        { who: 'Ha-eun', text: '«Lo so di chi era. E so che il giorno del funerale era a Myeongdong, addosso a uno che camminava.» (risale il vetro) «Se ne vada.»' },
        { text: 'Il giorno del funerale quel giubbotto era in un sacchetto, alla camera ardente di Hongdae, e gliel\'ha messo in mano suo zio.', note: true },
      ]);
    },
  },
  {
    // La cartellina. Il pannello deve far leggere **una cosa sola** — che quella
    // non è una mappa di reati, è una mappa di case — quindi la planimetria è
    // grande, dritta, e i numeri civici si contano.
    id: 'm3-5',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#141a22', '#0a0d12', 0.6);
      // Il sedile del passeggero, visto da fuori dal finestrino: una fascia scura
      // in basso e la cartellina aperta sopra, inclinata.
      ctx.fillStyle = '#191f28';
      ctx.fillRect(P.x, py(P, 0.62), P.w, P.h * 0.38);
      glow(P, px(P, 0.5), py(P, 0.52), P.h * 0.6, '#dfe8f5', 0.12);
      ctx.save();
      ctx.translate(px(P, 0.5), py(P, 0.52));
      ctx.rotate(-0.05);
      const w = P.w * 0.66;
      const h = P.h * 0.52;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-w / 2 + 6, -h / 2 + 8, w, h);
      ctx.fillStyle = '#cfc8b8';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#e6e0d2';
      ctx.fillRect(-w / 2 + w * 0.03, -h / 2 + h * 0.05, w * 0.94, h * 0.9);
      // La maglia delle strade: dritta, a squadra, senza niente di cerchiato. La
      // differenza con la mappa a mano di M1 è tutta qui, ed è il punto.
      ctx.strokeStyle = 'rgba(60,64,74,0.55)';
      ctx.lineWidth = Math.max(1, P.h * 0.004);
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + w * 0.05, -h / 2 + h * (0.12 + i * 0.14));
        ctx.lineTo(w / 2 - w * 0.05, -h / 2 + h * (0.12 + i * 0.14));
        ctx.stroke();
      }
      for (let i = 1; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + w * (0.06 + i * 0.13), -h / 2 + h * 0.08);
        ctx.lineTo(-w / 2 + w * (0.06 + i * 0.13), h / 2 - h * 0.08);
        ctx.stroke();
      }
      // I lotti, e sopra ognuno un numero. Sono la cosa da leggere: pochi e grandi.
      ctx.font = `600 ${Math.round(P.h * 0.038)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      for (let i = 0; i < 12; i++) {
        const u = -w / 2 + w * (0.12 + (i % 6) * 0.13);
        const v = -h / 2 + h * (0.2 + Math.floor(i / 6) * 0.28);
        ctx.fillStyle = 'rgba(120,112,98,0.35)';
        ctx.fillRect(u - w * 0.045, v - h * 0.05, w * 0.09, h * 0.1);
        ctx.fillStyle = '#2b2a26';
        ctx.fillText(`${44 + i * 3}`, u, v + h * 0.02);
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = BLOOD;
      ctx.fillRect(-w / 2 + w * 0.03, -h / 2 + h * 0.05, w * 0.94, Math.max(2, h * 0.014));
      ctx.restore();
      vignette(P, 0.5);
      narrator(P, 'Dentro la cartellina, una planimetria di Hongdae.\nStrada per strada, con i numeri civici e i nomi di chi ci abita.');
      speech(P, [
        { text: 'Non è una mappa di reati. È una mappa di case.', note: true },
      ]);
    },
  },
];

// --- la missione --------------------------------------------------------------------

export const M3 = {
  id: 'm3',
  title: 'Il turno di notte',
  hangul: '야간 근무',
  act: 1,

  prepare(game) {
    const s = sites(game);
    // Il 편의점 è aperto ventiquattr'ore e non ha bisogno di niente; la torre di
    // Gangnam sì: a quest'ora un ufficio è chiuso, e la rampa è la sua porta.
    if (s.torre) game.shops.hold(s.torre.id);
  },

  phases: [
    {
      // Kkachi dà un posto e un'ora, e nient'altro. Chi non ha la radio accesa
      // legge lo stesso dove andare nel riquadro della missione: la voce commenta,
      // non comanda (§5.32).
      id: 'innesco',
      hint: 'Itaewon, l\'incrocio del minimarket — per le quattro',
      enter(ctx) {
        ctx.unmark();
        const go = () => {
          ctx.radio([
            { kkachi: true, text: '«Alle quattro, all\'incrocio di Itaewon, quello del minimarket. Guarda e basta: non entrare.»' },
          ]);
          ctx.next();
        };
        ctx.on('enterVehicle', go);
        ctx.on('radioOn', (inCar) => { if (inCar) go(); });
      },
    },

    {
      id: 'incrocio',
      hint: 'L\'incrocio di Itaewon',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!s.conv) { ctx.next(); return; }
        ctx.mark(s.conv.x, s.conv.y, { label: '편의점' });
        ctx.on('shopEnter', (shop) => { if (shop.id === s.conv.id) ctx.next(); });
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        const pl = ctx.game.player;
        if (ctx.game.indoors || !s.conv) return;
        if (Math.hypot(pl.x - s.conv.x, pl.y - s.conv.y) < 150) ctx.next();
      },
    },

    {
      // L'appuntamento. Chi ci arriva di notte non aspetta niente; chi ci arriva
      // di giorno si siede e passa la notte lì — è un punto, quindi lo decide lui.
      id: 'ora',
      hint: 'Aspetta l\'ora: le quattro',
      enter(ctx) {
        const s = sites(ctx.game);
        if (s.conv) ctx.mark(s.conv.x, s.conv.y, { label: '편의점' });
        ctx.point({
          id: 'aspetta',
          key: 'F',
          // Si aspetta anche seduti in macchina: il copione dice esplicitamente
          // che quei quaranta minuti si passano come si vuole.
          onFoot: false,
          text: 'aspetta qui che sia l\'ora',
          reach: 170,
          x: s.conv ? s.conv.x : ctx.game.player.x,
          y: s.conv ? s.conv.y : ctx.game.player.y,
          run: (c) => {
            c.waitUntil(APPUNTAMENTO);
            // Piove, e lo dice il copione. Il meteo si **imposta**, non si spera:
            // è l'unica missione dell'atto in cui l'acqua è una meccanica (sul
            // bagnato si frena peggio, §5.11) e non un fondale.
            c.game.dayCycle.setWeather('rain', 900);
            c.next();
          },
        });
      },
      tick(dt, ctx) {
        const h = ctx.game.dayCycle.hour;
        if (h >= APPUNTAMENTO - FINESTRA && h < CONSEGNA) {
          ctx.game.dayCycle.setWeather('rain', 900);
          ctx.next();
        }
      },
    },

    panelPhase('m3-apertura', APERTURA),

    {
      // «Guarda e basta.» Quaranta minuti di gioco, poco più di un minuto vero: si
      // possono passare come si vuole, e chi entra a comprare un caffè si sente
      // dire dal commesso la seconda «ma se l'ho vista ieri» della storia.
      id: 'attesa',
      hint: 'Guarda e basta — non entrare',
      enter(ctx) {
        const s = sites(ctx.game);
        if (s.conv) ctx.mark(s.conv.x, s.conv.y, { label: '편의점' });
        tillPoint(ctx, 'caffe', s.conv, 'un caffè caldo', (c) => {
          if (c.state.caffe) return;
          c.state.caffe = 1;
          c.game.player.money = Math.max(0, c.game.player.money - CAFFE);
          c.talk([
            { who: 'Commesso', text: '«Il caffè caldo l\'ha già preso stanotte, no? Alle due.»' },
            { who: 'Jae-min', text: '«Alle due dormivo.»' },
            {
              who: 'Commesso',
              text: '«Sì sì.» (pausa) «Comunque uguale, sono milleduecento.»',
              note: 'Stanotte, alle due, qualcuno con quel giubbotto ha comprato un caffè qui.',
            },
          ]);
        });
      },
      tick(dt, ctx) {
        if (ctx.game.dayCycle.hour >= CONSEGNA) ctx.next();
      },
    },

    {
      // Le quattro: arriva il furgone del 백호파 e lascia la busta sul banco.
      // Nessuno dice niente, ed è il punto — è una consegna, non un incontro.
      id: 'consegna',
      hint: 'Sono le quattro',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        if (s.conv) ctx.mark(s.conv.x, s.conv.y, { label: '편의점' });
        ctx.state.t = 0;
        sgombera(game);
        if (!s.conv) return;
        M3._furgone = mandaA(game, 'van', { x: s.conv.x + 620, y: s.conv.y - 180 }, s.conv, { colorIndex: 3 });
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        ctx.state.t += dt;
        if (!s.conv) { ctx.next(); return; }
        if (!arrivata(M3._furgone, s.conv) && ctx.state.t < 70) return;
        ctx.state.t = -999;
        ctx.talk([
          { text: 'Il furgone accosta col motore acceso. Scende un uomo con un giubbotto uguale al tuo, entra nel 편의점, appoggia una busta sul banco e torna fuori.' },
          { text: 'Non ha detto niente al commesso, e il commesso non ha alzato la testa.', note: 'Nessuno dei due ha guardato l\'altro. Lo fanno da un pezzo.' },
        ], () => ctx.next());
      },
      leave() { M3._furgone = null; },
    },

    {
      // 04:06. La berlina nera, la donna in completo, il caffè pagato con la carta.
      id: 'ritiro',
      hint: 'Qualcuno viene a ritirarla',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        if (s.conv) ctx.mark(s.conv.x, s.conv.y, { label: '편의점' });
        ctx.state.t = 0;
        if (!s.conv) return;
        // La berlina nasce **dall'altra parte** rispetto al furgone: due auto che
        // arrivano dallo stesso capo della strada sembrano la stessa auto.
        M3._berlina = mandaA(game, 'sedan', { x: s.conv.x - 700, y: s.conv.y + 240 }, s.conv, { colorIndex: 0, speed: 110 });
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        ctx.state.t += dt;
        if (!s.conv) { ctx.next(); return; }
        // Prima delle 04:06 non succede niente anche se la berlina è già lì: sei
        // minuti di orologio sono sei secondi veri, e sono quelli in cui il
        // giocatore capisce che le due auto non si incontrano mai.
        if (ctx.game.dayCycle.hour < RITIRO && ctx.state.t < 60) return;
        if (!arrivata(M3._berlina, s.conv) && ctx.state.t < 90) return;
        ctx.state.t = -999;
        ctx.talk([
          { text: 'Berlina nera, pulita, targa nuova. Scende una donna in completo, entra, prende la busta dal banco e paga un caffè con la carta.' },
          { who: 'Jae-min', text: '«Con la carta.»', note: 'Chi ritira una busta al buio non lascia il proprio nome sullo scontrino. Lei sì.' },
        ], () => ctx.next());
      },
    },

    {
      // Il pedinamento. La berlina va a Gangnam per la sua strada; il giocatore
      // deve starle dietro senza starle addosso (`core/tail.js`).
      //
      // **Perderla non è un game over**: il giro si ripete il martedì e il
      // venerdì, quindi la fase riparte e la berlina si rifà viva all'incrocio. È
      // la stessa regola dell'impianto (si riprende dall'ultima fase), detta con
      // una battuta invece che con una schermata.
      id: 'pedinamento',
      hint: 'Stalle dietro — e a fari spenti',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        if (s.conv) ctx.mark(s.conv.x, s.conv.y, { label: '편의점' });
        // **La berlina è ferma davanti al minimarket, e ci resta.** Quella del
        // ritiro è arrivata *lì*, quindi ha `ai.arrived` alzato: senza azzerarlo
        // questa fase la crederebbe già a Gangnam e finirebbe nel frame in cui
        // comincia (è successo, e la scena del pedinamento non si vedeva).
        ctx.state.via = 0;
        game.tail.stop();
        const v = M3._berlina;
        if (v && v.ai) { v.ai.arrived = false; v.ai.arrive = null; v.ai.plan = null; }
        const fallito = (perche) => {
          game.tail.stop();
          sgombera(game);
          ctx.toast(perche, 4);
          ctx.radio([{ kkachi: true, text: '«Martedì e venerdì. Ne passa un\'altra: rimettiti all\'incrocio.»' }]);
          game.missions.replay(game);
        };
        ctx.on('tailLost', () => fallito('L\'hai persa di vista'));
        ctx.on('tailSpotted', () => fallito('Ti ha visto: ha cambiato strada'));
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const s = sites(game);
        if (!s.conv || !s.torre) { ctx.next(); return; }
        if (!ctx.state.via) {
          // La berlina riparte quando il giocatore è lì: farla partire mentre lui
          // è dall'altra parte di Seoul vorrebbe dire perderla nel frame in cui
          // comincia. Vale anche per la ripresa dopo un pedinamento fallito, che
          // rimette in scena il giro del martedì dopo.
          const pl = game.player;
          if (game.indoors) return;
          let v = M3._berlina;
          const dove = v || s.conv;
          if (Math.hypot(pl.x - dove.x, pl.y - dove.y) > 420) return;
          if (!v || v.dead || !game.vehicles.includes(v)) {
            v = mandaA(game, 'sedan', { x: s.conv.x - 300, y: s.conv.y + 120 }, s.torre, { colorIndex: 0, speed: 118 });
            if (!v) { ctx.next(); return; }
            M3._berlina = v;
          } else if (!game.traffic.sendTo(v, s.torre.x, s.torre.y, game)) {
            ctx.next();
            return;
          }
          ctx.state.via = 1;
          game.tail.begin(game, v, { label: 'la berlina nera' });
          // «Abbassa.» La manopola scende adesso, che la radio sia accesa o no:
          // Kkachi lo chiede, ma il volume è un fatto del mondo e non una battuta.
          abbassa(game);
          ctx.radio([
            { kkachi: true, text: '«Abbassa.»' },
            { who: 'Jae-min', text: '«Sei una radio. Non ti sente nessuno.»' },
            { kkachi: true, text: '«Abbassa lo stesso.»' },
          ]);
          return;
        }
        if (!arrivata(M3._berlina, s.torre)) return;
        game.tail.stop();
        ctx.next();
      },
      leave(ctx) { ctx.game.tail.stop(); },
    },

    {
      // La torre. Qui la missione dice la sua unica cosa importante, e la dice
      // piana: la busta parte da noi e arriva a loro.
      id: 'torre',
      hint: 'La torre di vetro: guarda dove entra la busta',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!s.torre) { ctx.next(); return; }
        ctx.mark(s.torre.x, s.torre.y, { label: '한성개발' });
        ctx.point({
          id: 'rampa',
          key: 'E',
          onFoot: false,
          text: 'guarda dove scende la berlina',
          reach: 90,
          x: s.torre.x,
          y: s.torre.y,
          run: (c) => {
            c.talk([
              { text: 'La berlina scende la rampa del parcheggio interrato. Sopra l\'ingresso, l\'insegna della torre: 한성개발.' },
              { who: 'Jae-min', text: '«Il 백호파 non gli sta chiedendo il pizzo.»' },
              { who: '91.45', text: '«No.»' },
              { who: 'Jae-min', text: '«Glielo sta pagando. La busta parte da noi e arriva a loro.»' },
              { who: '91.45', text: '«Ogni martedì e ogni venerdì. Da dodici anni.»' },
              { who: 'Jae-min', text: '«Perché?»' },
              { who: '91.45', text: '«Perché quello che paga non lo demoliscono.»' },
            ], () => c.next());
          },
        });
      },
    },

    panelPhase('m3-chiusura', CHIUSURA),
  ],

  /**
   * Fine. Il fatto acquisito è quello che regge il resto dell'atto — e la riga
   * `a1-itaewon` di Kkachi, scritta nella tappa D con il predicato già definitivo,
   * da adesso è vera.
   */
  finish(game) {
    sgombera(game);
    game.missions.setFlag('busta');
    game.hud.toast('야간 근무 — completata', 3.2);
  },
};
