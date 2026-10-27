// Raccordo R3 · «I nove dischi» — fine Atto II
//
// Il copione sta in `docs/storia/04-atto-2.md`. Notte, la luce dei monitor, il 피시방: il
// raccordo che chiude l'atto e dice **cos'è** 까치 — e, con la sua ultima riga, **di chi è la
// voce** che il giocatore ascolta da otto ore. Come R1 e R2 è una missione come le altre:
// qualche fase per arrivarci, e i pannelli.
//
// Tre cose che non sono nel copione, e vanno dichiarate:
//
//   · **ci si va di notte.** «Notte, luce dei monitor» è nella tavola, e il blip porta dove si
//     aspetta (decisione 3 di `08-domande-aperte.md`): chi arriva di giorno aspetta le 23:00
//     senza guardare l'orologio girare, come in M6 e M8;
//   · **la scena è di quattro pannelli e non di tre.** La battuta di Mi-rae sulla natura di
//     까치 è più lunga di un riquadro con sotto altre due frasi: si divide in due tavole, come
//     si divide ogni tavola troppo piena (§5.33). Le ultime tre righe sono quelle che «servono»
//     secondo il copione, e stanno insieme;
//   · **l'ultimo pannello è il quadrante** — la frequenza `91.45` ferma, cinque secondi, senza
//     nessuno che parli (`hold`). Il fruscio sotto è quello di sempre (`bed`, §5.37): è tutto
//     quello che 까치 ha al posto di una voce, e qui è l'unica cosa che c'è.
import { panelPhase } from '../core/missions.js';
import { findShop } from './places.js';
import { dist } from '../core/math.js';
import {
  AMBER, CYAN,
  px, py, flat, wash, vignette, glow, hexA, hash,
  dial, narrator, speech,
} from '../render/panelkit.js';
import { figure, unitScale } from '../render/pixelkit.js';

const ARRIVO = 260;
/** Le 23:00: dopo i turni, quando la sala è mezza vuota e lei ha tempo. */
const NOTTE = 23;
const NOTTE_DA = 22.5;
const NOTTE_A = 27;   // fino alle 03:00: il 피시방 chiude alle 04:00

function sites(game) {
  if (R3._sites) return R3._sites;
  // **Lo stesso 피시방 di M8**, trovato con la stessa ricerca: sono due scene nella stessa sala.
  R3._sites = { pc: findShop(game, 'pcbang', { district: 'hongdae', near: game.city.spawn, level: 2 }) };
  return R3._sites;
}

const ora = (h) => (h < NOTTE_A - 24 ? h + 24 : h);

// --- i pannelli ------------------------------------------------------------------------------

/** Le cuffie al collo, come in M8: stesso disegno, altro file perché sono due missioni. */
function cuffie(P, f) {
  const ctx = P.ctx;
  const k = f.k;
  ctx.fillStyle = '#10141c';
  ctx.fillRect(f.x + 6 * k, f.y + 23 * k, 12 * k, 2 * k);
  ctx.fillStyle = CYAN;
  ctx.fillRect(f.x + 4 * k, f.y + 24 * k, 4 * k, 6 * k);
  ctx.fillRect(f.x + 16 * k, f.y + 24 * k, 4 * k, 6 * k);
}

/** La stanza dietro la sala: un muro scuro e la luce che viene dai monitor di là. */
function retro(P) {
  wash(P, '#0b0f16', '#05070b', 0.6);
  glow(P, px(P, 0.04), py(P, 0.4), P.h * 0.9, CYAN, 0.1);
}

/** Un hard disk di quelli vecchi: scatola d'acciaio, etichetta, led verde che respira. */
function disco(P, x, y, w, h, i) {
  const ctx = P.ctx;
  ctx.fillStyle = '#2a2f38';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#9aa3b0';
  ctx.fillRect(x + w * 0.04, y + h * 0.1, w * 0.92, h * 0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + w * 0.04, y + h * 0.4, w * 0.92, h * 0.04);
  ctx.fillStyle = '#e8e2cc';
  ctx.fillRect(x + w * 0.1, y + h * 0.16, w * 0.4, h * 0.22);
  const on = 0.55 + 0.45 * Math.abs(Math.sin(P.t * (1.4 + hash(i * 3.3)) + i));
  ctx.fillStyle = hexA('#5fe0a8', on);
  ctx.fillRect(x + w * 0.78, y + h * 0.7, w * 0.1, h * 0.12);
}

/** La forma d'onda di una voce: un inviluppo che respira, e una portante fitta. */
function onda(P, x, y, w, h, ampiezza) {
  const ctx = P.ctx;
  ctx.strokeStyle = hexA(CYAN, 0.9);
  ctx.lineWidth = Math.max(1.5, P.h * 0.004);
  ctx.beginPath();
  const n = 140;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const env = (Math.sin(u * 7 + P.t * 2.1) * 0.5 + 0.5) * (0.4 + 0.6 * Math.sin(u * 3 - P.t * 1.2) ** 2);
    const v = Math.sin(u * 160 + P.t * 14) * env * ampiezza;
    const X = x + u * w;
    const Y = y + h / 2 + v * (h / 2);
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  ctx.stroke();
}

export const PANNELLI = [
  {
    // **Nove hard disk** — nove, come i nove oggetti di Jo — collegati male, e un ventilatore da
    // tavolo che li tiene freddi. Mi-rae ha appena aperto l'armadio: sta a sinistra, con la mano
    // sull'anta. Il fruscio è appena sopra il silenzio: i dischi ronzano.
    id: 'r3-1',
    bed: { kkachi: 0.02 },
    draw(P) {
      const ctx = P.ctx;
      retro(P);
      const x0 = px(P, 0.34);
      const y0 = py(P, 0.1);
      const w = P.w * 0.5;
      const h = P.h * 0.62;
      ctx.fillStyle = '#4a5260';                                   // l'armadio, di metallo
      ctx.fillRect(x0 - 8, y0 - 8, w + 16, h + 16);
      ctx.fillStyle = '#090c11';
      ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = '#3a4150';
      for (let r = 1; r < 3; r++) ctx.fillRect(x0, y0 + (h * r) / 3 - 2, w, 4);
      // Tre ripiani da tre dischi: nove. Storti, perché collegati male.
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const i = r * 3 + c;
          const dw = w * 0.26;
          const dh = h * 0.2;
          const dx = x0 + w * (0.06 + c * 0.31) + (hash(i * 5.1) - 0.5) * w * 0.02;
          const dy = y0 + (h * r) / 3 + h * 0.1;
          disco(P, dx, dy, dw, dh, i);
        }
      }
      // I cavi: matasse che scendono dai dischi alla ciabatta in fondo.
      ctx.strokeStyle = 'rgba(20,24,30,0.9)';
      ctx.lineWidth = Math.max(2, P.h * 0.006);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(x0 + w * (0.12 + i * 0.15), y0 + h * 0.3);
        ctx.quadraticCurveTo(x0 + w * (0.1 + i * 0.16), y0 + h * 0.98, x0 + w * (0.2 + i * 0.12), y0 + h + 12);
        ctx.stroke();
      }
      // Il ventilatore da tavolo, **sul ripiano più alto**, rivolto ai dischi.
      const fx = x0 + w * 0.92;
      const fy = y0 - P.h * 0.04;
      ctx.fillStyle = '#d6d2c4';
      ctx.fillRect(fx - P.w * 0.012, fy + P.h * 0.04, P.w * 0.024, P.h * 0.05);
      ctx.strokeStyle = '#b9b5a8';
      ctx.lineWidth = Math.max(2, P.h * 0.005);
      ctx.beginPath();
      ctx.arc(fx, fy, P.h * 0.07, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(210,206,190,0.35)';
      for (let b = 0; b < 3; b++) {
        const a = P.t * 18 + (b * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.arc(fx, fy, P.h * 0.064, a, a + 0.9);
        ctx.closePath();
        ctx.fill();
      }
      // Lei, a sinistra, con la mano sull'anta.
      const f = figure(P, 'mirae', px(P, 0.16), py(P, 0.7), unitScale(P, 0.5, 36), 'stand', { crop: 36, mood: 'fermo' });
      cuffie(P, f);
      vignette(P, 0.45);
      narrator(P, 'Nove hard disk, collegati male. Sopra, un ventilatore da tavolo.');
    },
  },
  {
    // Il monitor con la forma d'onda **che si muove mentre 까치 parla**. Mi-rae a destra; le tre
    // battute sono la prima metà della scena: la risposta più lunga ha il suo riquadro intero.
    id: 'r3-2',
    bed: { kkachi: 0.035 },
    draw(P) {
      const ctx = P.ctx;
      retro(P);
      const x = px(P, 0.08);
      const y = py(P, 0.1);
      const w = P.w * 0.6;
      const h = P.h * 0.4;
      ctx.fillStyle = '#12161d';
      ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
      ctx.fillStyle = '#05080c';
      ctx.fillRect(x, y, w, h);
      glow(P, x + w / 2, y + h / 2, P.h * 0.5, CYAN, 0.12);
      ctx.strokeStyle = 'rgba(56,214,255,0.14)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(x, y + (h * i) / 5); ctx.lineTo(x + w, y + (h * i) / 5); ctx.stroke();
      }
      onda(P, x + w * 0.04, y + h * 0.12, w * 0.92, h * 0.7, 0.9);
      ctx.fillStyle = 'rgba(56,214,255,0.7)';
      ctx.font = `600 ${Math.round(P.h * 0.03)}px ui-monospace, monospace`;
      ctx.fillText('91.45 · 까치', x + w * 0.04, y + h * 0.09);
      ctx.fillStyle = '#1b2029';                                   // il piede del monitor
      ctx.fillRect(x + w * 0.44, y + h + 8, w * 0.12, P.h * 0.05);
      const f = figure(P, 'mirae', px(P, 0.82), py(P, 0.62), unitScale(P, 0.46, 32), 'stand', { crop: 32, mood: 'parla' });
      cuffie(P, f);
      vignette(P, 0.4);
      speech(P, [
        { who: 'Jae-min', text: '«Chi è?»' },
        { who: 'Mi-rae', text: '«Non è un chi. Sono trent\'anni di roba registrata: citofoni, cimici, telefonate al minimarket, videocassette di famiglia. Qualcuno l\'ha messa insieme e le ha insegnato a rispondere. Io la tengo accesa e ogni tanto le spiego le cose nuove.»' },
        { who: 'Jae-min', text: '«E la voce di chi è?»' },
      ]);
    },
  },
  {
    // **L'unica cosa che fa male**, e il copione dice di dirla: di chi è la voce che il
    // giocatore ascolta da otto ore. Un fatto, non un indizio, e i fatti si dicono una volta.
    id: 'r3-3',
    bed: { kkachi: 0.03 },
    draw(P) {
      retro(P);
      figure(P, 'jaemin', px(P, 0.28), py(P, 0.68), unitScale(P, 0.46, 34), 'back', { crop: 34 });
      const f = figure(P, 'mirae', px(P, 0.74), py(P, 0.62), unitScale(P, 0.5, 32), 'stand', { crop: 32, mood: 'giu' });
      cuffie(P, f);
      vignette(P, 0.5);
      speech(P, [
        { who: 'Mi-rae', text: '«Di quello che parlava di più.»' },
        { who: 'Jae-min', text: '«Cioè?»' },
        { who: 'Mi-rae', text: '«Cioè tuo padre. Lo sapevi già, secondo me.»' },
      ]);
    },
  },
  {
    // Il quadrante, **fermo, e nessuno che dica niente per cinque secondi buoni**. Il fruscio è
    // la stazione accesa: è quello che c'è al posto di una voce.
    id: 'r3-4',
    hold: 5,
    bed: { kkachi: 0.04 },
    draw(P) {
      flat(P, '#06080c');
      glow(P, px(P, 0.5), py(P, 0.4), P.h * 0.55, AMBER, 0.12);
      dial(P, px(P, 0.16), py(P, 0.28), P.w * 0.68, P.h * 0.3, { from: 90, to: 93, mark: 91.45, label: '91.45' });
      vignette(P, 0.45);
      narrator(P, 'Fine del secondo atto.');
    },
  },
];

// --- la missione -------------------------------------------------------------------------------

export const R3 = {
  id: 'r3',
  title: 'I nove dischi',
  hangul: '아홉 개의 디스크',
  act: 2,

  phases: [
    {
      id: 'viaggio',
      hint: 'Il 피시방 di Hongdae — stanotte',
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
      // La notte. Come M6: il blip porta dove si aspetta, e l'ora non si guarda girare.
      id: 'notte',
      hint: 'Aspetta la notte: Mi-rae risponde dopo le 23:00',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.pc.x, s.pc.y, { label: '피시방' });
        ctx.point({
          id: 'aspetta', key: 'F', onFoot: false, text: 'aspetta che sia notte', reach: 230,
          x: s.pc.x, y: s.pc.y,
          run: (c) => {
            c.waitUntil(NOTTE);
            c.next();
          },
        });
      },
      tick(dt, ctx) {
        const h = ora(ctx.game.dayCycle.hour);
        if (h >= NOTTE_DA && h < NOTTE_A) ctx.next();
      },
    },

    {
      id: 'pcbang',
      hint: 'Il 피시방: entra',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        ctx.mark(s.pc.x, s.pc.y, { label: '피시방' });
        // Il locale è aperto fino alle quattro, ma chi ci entra alle 03:30 lo trova chiuso: lo
        // si tiene aperto per la scena, e `finish` lo rilascia.
        game.shops.hold(s.pc.id);
        ctx.on('floorShown', (shop, idx) => {
          if (shop.id === s.pc.id && idx === s.pc.level) ctx.next();
        });
        const it = game.shops.active;
        if (it && it.shop.id === s.pc.id && it.cur === s.pc.level) ctx.next();
      },
    },

    panelPhase('r3', PANNELLI),
  ],

  finish(game) {
    const s = sites(game);
    if (s.pc) game.shops.release(s.pc.id);
    // **L'Atto II è finito.** Nessuna missione resta in corso: la prossima è dell'Atto III.
    game.missions.setFlag('dischi');
    game.missions.setFlag('atto2');
    game.hud.toast('이름 — Atto II completato', 4);
  },
};
