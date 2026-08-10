// M1 · «Il cappotto di un altro» — 남의 옷
//
// Il copione sta in `docs/storia/03-atto-1.md` e comanda lui. Hongdae →
// Myeongdong, mattina dell'11 agosto, `08:24`. È la missione che insegna: nessun
// timer, nessuna pressione, e **nessun fallimento** — morire o farsi arrestare
// rimette il giocatore all'inizio della fase in cui era, che è quello che fa
// l'impianto per tutte (`core/missions.js`).
//
// Tre cose di questa missione non sono decorazione:
//
//   · **il secondo punto** dice la riga che vale tutta la missione — qualcuno con
//     quel giubbotto ha riscosso a Myeongdong *ieri sera*, mentre Jae-min era al
//     funerale. È il primo indizio dei due Jae-min e torna in M3 e M8;
//   · **il terzo punto non paga**, e non è una punizione: è il primo muro della
//     storia. La serranda col sigillo di perizia resta sigillata per il resto
//     della partita (`shops.seal`, e sta nel salvataggio);
//   · **il 당구장 apre alle 15** e qui sono le otto e mezza. Non è una svista del
//     copione: la sala è aperta perché è martedì e si conta, e il gioco lo dice
//     con `shops.hold` — l'indirizzo è aperto perché lo dice la storia.
import { panelPhase } from '../core/missions.js';
import { findShop } from './places.js';
import { won } from '../entities/shops.js';
import {
  CYAN, AMBER, BLOOD,
  px, py, flat, wash, vignette, glow, hash,
  block, sign, poster, wetFloor, car, dial, narrator, speech,
} from '../render/panelkit.js';
import { figure, unitScale } from '../render/pixelkit.js';

const PIZZO_BILIARDO = 210000;
const PIZZO_BAR = 260000;
const SIGILLO = '한성개발 · 감정 중 — perizia in corso';

/**
 * I tre indirizzi, cercati una volta per sessione.
 *
 * Non stanno nel salvataggio: la città nasce da una seed fissa e la ricerca è
 * deterministica, quindi ricavarli è più sicuro che ricordarseli — un indirizzo
 * salvato sopravviverebbe a una modifica della generazione e punterebbe a un
 * palazzo che nel frattempo è diventato un altro (§4).
 */
function sites(game) {
  if (M1._sites) return M1._sites;
  const from = game.city.spawn;
  const pool = findShop(game, 'billiards', { district: 'hongdae', near: from });
  const bar = findShop(game, 'bar', { district: 'myeongdong', near: from, avoid: [pool?.id] });
  // Il banco del mercato: una tavola calda di quartiere, abbastanza lontana dalla
  // sala da essere un terzo viaggio e non un secondo passo.
  const stall = findShop(game, 'bunsik', {
    district: 'hongdae', near: from, minDist: 700, avoid: [pool?.id, bar?.id],
  });
  M1._sites = { pool, bar, stall };
  return M1._sites;
}

/** Il punto in cui si riscuote, davanti al bancone del piano giusto. */
function tillPoint(ctx, id, addr, text, run) {
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

function pay(ctx, amount, reason) {
  ctx.game.player.money += amount;
  ctx.toast(`${reason} · ${won(amount)}`, 3);
  ctx.game.audio?.ui('ok');
}

// --- i pannelli -------------------------------------------------------------------

export const APERTURA = [
  {
    // Il vicolo di Hongdae di giorno, che è la stessa inquadratura della fine
    // dell'apertura vista con la luce: le insegne spente sono la differenza.
    id: 'm1-1',
    draw(P) {
      const ctx = P.ctx;
      // Cielo di mattina fra due muri: è **la stessa inquadratura** dell'ultimo
      // pannello dell'apertura, e l'unica differenza è che adesso si vede. Il
      // cielo va lasciato scoperto in mezzo, o il vicolo torna la notte di ieri.
      wash(P, '#b9c4d2', '#7d8794', 0.5);
      block(P, P.x, py(P, -0.02), P.w * 0.27, P.h * 0.82, '#3c424e');
      block(P, px(P, 0.75), py(P, -0.06), P.w * 0.25, P.h * 0.86, '#454b58');
      block(P, px(P, 0.27), py(P, 0.1), P.w * 0.2, P.h * 0.58, '#4d5461');
      block(P, px(P, 0.55), py(P, 0.16), P.w * 0.2, P.h * 0.52, '#565d6b');
      // Le insegne ci sono e non sono accese: nessun alone, tinta smorta. È il
      // solo modo in cui un neon dice «giorno» senza spegnerlo.
      sign(P, '노래방', px(P, 0.13), py(P, 0.26), { size: P.h * 0.075, color: '#b08aa8', glowR: 0 });
      sign(P, '분식', px(P, 0.87), py(P, 0.22), { size: P.h * 0.07, color: '#b3a68e', glowR: 0 });
      poster(P, px(P, 0.3), py(P, 0.3), P.w * 0.13, P.h * 0.26, [
        { text: '철거예정' }, { text: '9. 21.' },
      ], { tilt: 0.07 });
      poster(P, px(P, 0.58), py(P, 0.34), P.w * 0.12, P.h * 0.24, [
        { text: '철거예정' }, { text: '한성개발' },
      ], { tilt: -0.09, paper: '#cfc8b8' });
      // L'asfalto, e sopra l'auto del padre: ha piovuto tutta la notte e i
      // riflessi delle insegne spente sono l'unica cosa rimasta di quella scena.
      ctx.fillStyle = '#3a4049';
      ctx.fillRect(P.x, py(P, 0.68), P.w, P.h * 0.32);
      wetFloor(P, py(P, 0.68), ['#b9c4d2', '#7b6478'], { alpha: 0.3 });
      car(P, px(P, 0.5), py(P, 0.92), P.w * 0.46, '#2f3742', { glass: '#5a6d80' });
      vignette(P, 0.4);
      narrator(P, '백호파, la Tigre Bianca. È la banda di suo padre,\ne riscuote in questo quartiere da trent\'anni.');
    },
  },
  {
    // Il quadrante. Kkachi non ha una voce (i pannelli sono solo testo): ha una
    // frequenza, ed è per questo che il pannello è la radio e non una faccia.
    id: 'm1-2',
    draw(P) {
      flat(P, '#0b0e14');
      glow(P, px(P, 0.5), py(P, 0.3), P.h * 0.5, AMBER, 0.16);
      dial(P, px(P, 0.14), py(P, 0.16), P.w * 0.72, P.h * 0.26, {
        from: 90, to: 93, mark: 91.45, label: '91.45',
      });
      speech(P, [
        { who: '91.45', kkachi: true, text: '«Il 백호파 riscuote il pizzo di martedì, sempre negli stessi tre posti.\nOggi è martedì e non è andato nessuno.»' },
        { who: 'Jae-min', text: '«Non sono affari miei.»' },
        { who: '91.45', kkachi: true, text: '«Hai addosso il giubbotto di chi li riscuoteva. Per il quartiere basta quello.»' },
      ]);
    },
  },
  {
    // La mappa a mano. È l'unico pannello del gioco disegnato da un personaggio e
    // non dalla camera: righe storte, cerchi ripassati due volte, niente scala.
    id: 'm1-3',
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#d9d2c0');
      // La grana della carta.
      for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(90,78,60,${hash(i * 3.7) * 0.12})`;
        ctx.fillRect(px(P, hash(i * 1.9)), py(P, hash(i * 5.1)), 2, 2);
      }
      ctx.strokeStyle = '#2b2a26';
      ctx.lineWidth = Math.max(2, P.h * 0.006);
      const road = (x1, y1, x2, y2) => {
        ctx.beginPath();
        ctx.moveTo(px(P, x1), py(P, y1));
        ctx.lineTo(px(P, x2), py(P, y2));
        ctx.stroke();
      };
      road(0.06, 0.3, 0.94, 0.26);
      road(0.1, 0.62, 0.9, 0.66);
      road(0.24, 0.12, 0.3, 0.8);
      road(0.66, 0.1, 0.6, 0.82);
      // Il fiume, tratteggiato: chi ha disegnato questo foglio non ci passa sopra.
      ctx.setLineDash([P.w * 0.02, P.w * 0.015]);
      ctx.strokeStyle = '#4a5f6b';
      road(0.04, 0.88, 0.96, 0.8);
      ctx.setLineDash([]);

      // I tre punti, cerchiati due volte a mano. L'etichetta sta **sotto** il
      // cerchio e non dentro: dentro, alla scala del pannello, il nome del posto
      // e il segno rosso diventano una macchia sola.
      const spot = (u, v, label) => {
        ctx.strokeStyle = BLOOD;
        ctx.lineWidth = Math.max(2, P.h * 0.009);
        for (const r of [0.075, 0.064]) {
          ctx.beginPath();
          ctx.ellipse(px(P, u), py(P, v), P.w * r * 0.6, P.h * r, 0.2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.font = `700 ${Math.round(P.h * 0.062)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
        ctx.textAlign = 'center';
        // Un velo di carta sotto la scritta: sopra una strada nera non si legge.
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(217,210,192,0.85)';
        ctx.fillRect(px(P, u) - tw / 2 - 4, py(P, v + 0.1), tw + 8, P.h * 0.08);
        ctx.fillStyle = '#22211d';
        ctx.fillText(label, px(P, u), py(P, v + 0.16));
        ctx.textAlign = 'left';
      };
      spot(0.25, 0.32, '당구장');
      spot(0.7, 0.26, '술집');
      spot(0.55, 0.62, '시장');

      ctx.save();
      ctx.translate(px(P, 0.08), py(P, 0.94));
      ctx.rotate(-0.09);
      ctx.fillStyle = '#22211d';
      ctx.font = `800 ${Math.round(P.h * 0.11)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.fillText('화요일', 0, 0);
      ctx.restore();
      narrator(P, '당구장, sala biliardo. 술집, bar.\nIn fondo al foglio: 화요일, martedì.');
    },
  },
];

export const CHIUSURA = [
  {
    // Il panno, i soldi, e quanto sono pochi. Nessuno in questo pannello: è la
    // somma a parlare, e va vista da sola.
    id: 'm1-4',
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#141a17');
      // Il tavolo, di tre quarti: sponda di legno e panno.
      ctx.fillStyle = '#4a3524';
      ctx.fillRect(px(P, 0.06), py(P, 0.2), P.w * 0.88, P.h * 0.66);
      ctx.fillStyle = '#2f6b4d';
      ctx.fillRect(px(P, 0.1), py(P, 0.26), P.w * 0.8, P.h * 0.54);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(px(P, 0.1), py(P, 0.26), P.w * 0.8, P.h * 0.08);
      // Tre bilie: due bianche e una rossa, che è il gioco coreano.
      const ball = (u, v, c) => {
        glow(P, px(P, u), py(P, v), P.h * 0.05, '#000000', 0.3);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(px(P, u), py(P, v), P.h * 0.032, 0, Math.PI * 2);
        ctx.fill();
      };
      ball(0.22, 0.66, '#e9e3d4');
      ball(0.3, 0.72, '#d8d2c2');
      ball(0.78, 0.4, BLOOD);
      // Le mazzette. Poche e contate, ma **grandi**: sono il soggetto del
      // pannello, e su un panno verde tre pile basse spariscono.
      for (let i = 0; i < 3; i++) {
        const u = 0.36 + i * 0.14;
        const alte = 3 + i;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(px(P, u) + P.w * 0.006, py(P, 0.56) + P.h * 0.012, P.w * 0.12, P.h * 0.05);
        for (let k = 0; k < alte; k++) {
          ctx.fillStyle = k % 2 ? '#c8b98d' : '#ded0a4';
          ctx.fillRect(px(P, u), py(P, 0.56) - k * P.h * 0.026, P.w * 0.12, P.h * 0.05);
          ctx.fillStyle = 'rgba(70,58,34,0.4)';
          ctx.fillRect(px(P, u), py(P, 0.56) - k * P.h * 0.026, P.w * 0.12, P.h * 0.008);
          ctx.fillStyle = 'rgba(70,58,34,0.25)';
          ctx.fillRect(px(P, u + 0.045), py(P, 0.565) - k * P.h * 0.026, P.w * 0.03, P.h * 0.036);
        }
      }
      vignette(P, 0.6);
      narrator(P, `Contati sul panno: ${won(PIZZO_BILIARDO + PIZZO_BAR)}.\nDei tre posti sul foglio, uno non ha aperto.`);
    },
  },
  {
    // Chun-sik e il telefono. La luce viene dallo schermo, dal basso: è l'unica
    // fonte del pannello, e serve a far vedere che sta guardando una fotografia.
    id: 'm1-5',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#1d2420', '#0d110f');
      block(P, px(P, 0.02), py(P, 0.3), P.w * 0.24, P.h * 0.5, '#182220');
      block(P, px(P, 0.78), py(P, 0.24), P.w * 0.22, P.h * 0.56, '#16201e');
      // La luce viene dal telefono, dal basso e da destra: è l'unica fonte del
      // pannello, ed è quello che dice che sta guardando una fotografia.
      glow(P, px(P, 0.66), py(P, 0.5), P.h * 0.38, CYAN, 0.34);
      figure(P, 'chunsik', px(P, 0.38), py(P, 0.66), unitScale(P, 0.56, 32), 'lean', {
        crop: 32, mood: 'parla',
      });
      // Il telefono, di taglio, fuori dalla sagoma: dentro sparisce.
      ctx.fillStyle = '#1b2228';
      ctx.fillRect(px(P, 0.6), py(P, 0.32), P.w * 0.12, P.h * 0.3);
      ctx.fillStyle = '#9fd8ef';
      ctx.fillRect(px(P, 0.612), py(P, 0.335), P.w * 0.096, P.h * 0.27);
      // Il sigillo fotografato: la serranda e la carta bianca sopra.
      ctx.fillStyle = 'rgba(20,26,30,0.55)';
      ctx.fillRect(px(P, 0.612), py(P, 0.42), P.w * 0.096, P.h * 0.185);
      ctx.fillStyle = '#e8e2d4';
      ctx.fillRect(px(P, 0.632), py(P, 0.45), P.w * 0.056, P.h * 0.09);
      ctx.fillStyle = BLOOD;
      ctx.fillRect(px(P, 0.632), py(P, 0.45), P.w * 0.056, P.h * 0.014);
      vignette(P, 0.55);
      speech(P, [
        { who: 'Chun-sik', text: '«Funziona così: prima mettono il sigillo, poi sgomberano, poi arriva la gru.\nTre anni fa erano due strade. L\'anno scorso sei. Adesso è il mercato.»' },
        { who: 'Jae-min', text: '«E il 백호파 che fa?»' },
        { who: 'Chun-sik', text: '«Il 백호파 riscuote il martedì, ragazzo.»' },
      ]);
    },
  },
];

// --- la missione --------------------------------------------------------------------

export const M1 = {
  id: 'm1',
  title: 'Il cappotto di un altro',
  hangul: '남의 옷',
  act: 1,

  /**
   * Quello che deve essere vero **prima** di ogni fase, e che va rifatto anche
   * quando si riprende da un salvataggio: i due indirizzi tenuti aperti fuori
   * orario e la serranda del mercato, che da qui in poi non riapre più.
   */
  prepare(game) {
    const s = sites(game);
    if (s.pool) game.shops.hold(s.pool.id);
    if (s.bar) game.shops.hold(s.bar.id);
    if (s.stall) game.shops.seal(s.stall.id, `Serranda sigillata · ${SIGILLO}`);
  },

  phases: [
    {
      // L'innesco è lo stesso della riga di Kkachi in fondo all'apertura: il
      // motore acceso. Chi scende e va a piedi non comincia niente, ed è il modo
      // in cui il gioco insegna che quella voce sta nel cruscotto.
      id: 'motore',
      hint: 'L\'auto di tuo padre è lì davanti',
      enter(ctx) {
        ctx.unmark();
        ctx.on('enterVehicle', () => ctx.next());
        ctx.on('radioOn', (inCar) => { if (inCar) ctx.next(); });
      },
    },

    panelPhase('m1-apertura', APERTURA),

    {
      id: 'biliardo',
      hint: 'Il 당구장 di Hongdae — oggi è martedì',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.pool.x, s.pool.y, { label: '당구장' });
        ctx.state.t = ctx.state.t || 0;
        ctx.on('shopEnter', (shop) => { if (shop.id === s.pool.id) ctx.next(); });
      },
      tick(dt, ctx) {
        // La riga dei ponti arriva dopo un pezzo di strada, non subito: è un
        // commento a quello che il giocatore sta guardando, e se parte a motore
        // appena acceso commenta un vicolo fermo.
        ctx.state.t += dt;
        if (ctx.state.t < 14 || ctx.state.said) return;
        ctx.state.said = 1;
        ctx.radio({ kkachi: true, text: '«Tre ponti da qui a Myeongdong. Hongdae l\'hanno periziata a marzo.»' });
      },
    },

    {
      id: 'pizzo1',
      hint: 'Sali in sala e riscuoti',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.pool.x, s.pool.y, { label: '당구장' });
        tillPoint(ctx, 'pizzo1', s.pool, 'riscuoti il pizzo di martedì', () => {
          ctx.talk([
            { text: 'Quattro giocano e non alzano gli occhi dal tavolo. Il quinto posa la stecca, apre un cassetto sotto il bancone e conta.' },
            { who: 'Il quinto', text: '«Martedì.»' },
            { who: 'Jae-min', text: '«Martedì.»' },
          ], () => {
            pay(ctx, PIZZO_BILIARDO, '당구장 — riscosso');
            ctx.next();
          });
        });
      },
    },

    {
      id: 'bar',
      hint: 'Il 술집 di Myeongdong',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.bar.x, s.bar.y, { label: '술집' });
        ctx.on('shopEnter', (shop) => { if (shop.id === s.bar.id) ctx.next(); });
      },
    },

    {
      id: 'pizzo2',
      hint: 'Il padrone è al bancone',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.bar.x, s.bar.y, { label: '술집' });
        tillPoint(ctx, 'pizzo2', s.bar, 'riscuoti il pizzo di martedì', () => {
          ctx.talk([
            { who: 'Padrone', text: '«Ma ha già ritirato ieri sera. Lei. Ieri. Stesso giubbotto.»' },
            { who: 'Jae-min', text: '«Ieri sera ero al funerale di mio padre.»' },
            {
              who: 'Padrone',
              text: '«Certo, certo.» (ride) «…Certo.»',
              note: 'Ieri sera qualcuno con quel giubbotto ha riscosso a Myeongdong.',
            },
          ], () => {
            pay(ctx, PIZZO_BAR, '술집 — riscosso');
            ctx.next();
          });
        });
      },
    },

    {
      id: 'mercato',
      hint: 'Il terzo posto: il banco al mercato',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.stall.x, s.stall.y, { label: '시장' });
        ctx.point({
          id: 'sigillo',
          key: 'E',
          text: 'leggi il sigillo sulla serranda',
          reach: 46,
          x: s.stall.x,
          y: s.stall.y,
          run: () => {
            ctx.talk([
              { text: 'Sulla serranda un sigillo di 한성개발: 감정 중 — perizia in corso.\nIl banco è chiuso da nove giorni.' },
            ], () => ctx.next());
          },
        });
      },
    },

    {
      id: 'ritorno',
      hint: 'Torna al 당구장: Chun-sik aspetta',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        ctx.mark(s.pool.x, s.pool.y, { label: '당구장' });
        // Adesso, e non a inizio missione: la prima volta la sala era di chi
        // gioca, e Chun-sik seduto lì dentro sarebbe stato uno dei quattro.
        game.actors.define('chunsik', {
          indoor: true, shop: s.pool.id, level: s.pool.level,
          kind: 'gangster', name: 'Chun-sik', hangul: '안춘식',
          angle: Math.PI / 2,
          place: (f) => ({ x: f.till.x - 62, y: f.till.y + 8 }),
        });
        ctx.on('shopEnter', (shop) => { if (shop.id === s.pool.id) ctx.next(); });
      },
    },

    panelPhase('m1-chiusura', CHIUSURA),
  ],

  /** Fine. Il pizzo è in tasca, il mercato resta sigillato, e M2 parte da sé. */
  finish(game) {
    game.hud.toast('남의 옷 — completata', 3.2);
  },
};
