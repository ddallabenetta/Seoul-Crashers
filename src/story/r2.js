// Raccordo R2 · «La cucina» — dopo M6
//
// Il copione sta in `docs/storia/04-atto-2.md`. Due pannelli e nessun gioco, ed è
// **una missione come le altre** (come R1): una fase di soli pannelli che alza un
// flag. Un raccordo con un impianto suo sarebbe un secondo motore da mantenere per
// quattro scene.
//
// **Un ricordo, e il gioco non dice che è un ricordo.** Lo dice l'ultima battuta di
// M6, che è appena finita («C'era la radio accesa»): qui non c'è nessuna didascalia
// del tipo «anni Novanta», solo il pannello. Il secondo pannello è **lo stesso
// identico disegno** con una funzione sola (`cucina`), a cui si tolgono il bambino,
// l'uomo e la luce della radio: non è un'altra stanza, è la stessa vista di oggi, ed è
// questo che dice la riga.
//
// Due cose da non «sistemare»:
//   · **la cicatrice sta sulla guancia destra di lui**, e lui è di spalle: sul
//     pannello compare dal lato destro di chi guarda, come una striscia di guancia che
//     sborda dalla nuca. È l'unica cosa del disegno che dice chi è, e il narratore la
//     nomina perché a questa scala non si indovina;
//   · **la radio c'è anche nel secondo pannello**, spenta. È la riga che Kkachi
//     ripeterà parola per parola in M10 (chiamata 20): il giocatore deve averla vista
//     senza sapere che gli servirà.
import { panelPhase } from '../core/missions.js';
import {
  AMBER,
  px, py, wash, vignette, glow, hexA,
  poster, narrator, speech,
} from '../render/panelkit.js';
import { figure, unitScale, CAST } from '../render/pixelkit.js';

/**
 * La cucina. `ricordo` mette il bambino, l'uomo e la radio accesa; senza, è la
 * stanza com'è adesso: colori spenti, la radio muta sul frigo e il sigillo sulla
 * porta. **Tutto il resto è identico**, a partire dai pixel: è il punto.
 */
function cucina(P, ricordo) {
  const ctx = P.ctx;
  const pal = ricordo
    ? { wall: '#b9a56d', wall2: '#8f7c4b', floor: '#6d5a38', floor2: '#5a4a2e', fridge: '#e6e0c8', door: '#6a4a2a' }
    : { wall: '#8d8a7d', wall2: '#6f6d64', floor: '#5e5d56', floor2: '#4f4e48', fridge: '#b6b3a6', door: '#4e4a42' };
  const horizon = 0.5;

  wash(P, pal.wall, pal.wall2, horizon);
  // Il pavimento: linoleo a scacchi, che nel 1992 si trovava in ogni cucina.
  ctx.fillStyle = pal.floor;
  ctx.fillRect(P.x, py(P, horizon), P.w, P.h * (1 - horizon));
  const cw = P.w / 14;
  ctx.fillStyle = pal.floor2;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 15; c++) {
      if ((r + c) % 2) continue;
      ctx.fillRect(P.x + c * cw - (r % 2 ? cw / 2 : 0), py(P, horizon) + r * P.h * 0.082, cw, P.h * 0.082);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(P.x, py(P, horizon) - 2, P.w, 4);                  // lo zoccolo

  // La finestra a destra del tavolo: una luce di giorno, fredda se la stanza è vuota.
  ctx.fillStyle = ricordo ? '#d9e4ea' : '#a9b2b8';
  ctx.fillRect(px(P, 0.5), py(P, 0.14), P.w * 0.12, P.h * 0.24);
  ctx.fillStyle = hexA('#05070b', 0.35);
  ctx.fillRect(px(P, 0.555), py(P, 0.14), P.w * 0.008, P.h * 0.24);
  ctx.fillRect(px(P, 0.5), py(P, 0.255), P.w * 0.12, P.h * 0.008);
  glow(P, px(P, 0.56), py(P, 0.26), P.h * 0.5, '#fff6d8', ricordo ? 0.16 : 0.07);

  // La porta, a sinistra. Nel pannello di oggi porta il sigillo di 한성개발.
  ctx.fillStyle = pal.door;
  ctx.fillRect(px(P, 0.04), py(P, 0.1), P.w * 0.15, P.h * 0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(px(P, 0.04), py(P, 0.1), P.w * 0.15, P.h * 0.012);
  ctx.fillStyle = '#a58a4a';
  ctx.fillRect(px(P, 0.17), py(P, 0.36), P.w * 0.008, P.h * 0.04);     // la maniglia
  if (!ricordo) {
    poster(P, px(P, 0.065), py(P, 0.2), P.w * 0.1, P.h * 0.17, [
      { text: '철거예정' }, { text: '한성개발' },
    ], { tilt: -0.03 });
  }

  // Il telefono a muro, col filo a spirale che scende. Ha il filo anche vuoto.
  const phx = px(P, 0.3);
  const phy = py(P, 0.3);
  ctx.fillStyle = ricordo ? '#d8cfae' : '#aaa797';
  ctx.fillRect(phx - P.w * 0.014, phy - P.h * 0.04, P.w * 0.028, P.h * 0.09);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.arc(phx, phy + P.h * 0.012, P.h * 0.018, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,26,20,0.7)';
  ctx.lineWidth = Math.max(1.5, P.h * 0.004);
  ctx.beginPath();
  ctx.moveTo(phx, phy + P.h * 0.05);
  for (let i = 0; i < 9; i++) ctx.lineTo(phx + (i % 2 ? -1 : 1) * P.w * 0.006, phy + P.h * (0.06 + i * 0.012));
  ctx.stroke();

  // Il frigo, con la radio sopra. È l'oggetto del pannello: acceso nel ricordo (il
  // quadrante ha una luce e l'alone respira, come fa il neon in M2), muto adesso.
  const fx = px(P, 0.72);
  const fy = py(P, 0.17);
  const fw = P.w * 0.16;
  const fh = P.h * 0.42;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(fx + 5, fy + 6, fw, fh);
  ctx.fillStyle = pal.fridge;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(fx, fy + fh * 0.32, fw, P.h * 0.006);
  ctx.fillStyle = '#7d7a6d';
  ctx.fillRect(fx + fw * 0.82, fy + fh * 0.08, P.w * 0.005, fh * 0.16);
  ctx.fillRect(fx + fw * 0.82, fy + fh * 0.4, P.w * 0.005, fh * 0.3);

  const rx = fx + fw * 0.08;
  const ry = fy - P.h * 0.085;
  const rw = fw * 0.84;
  const rh = P.h * 0.085;
  ctx.fillStyle = '#2b2a28';
  ctx.fillRect(rx, ry, rw, rh);
  ctx.fillStyle = '#4a4742';
  ctx.fillRect(rx + rw * 0.06, ry + rh * 0.18, rw * 0.5, rh * 0.5);          // la griglia dell'altoparlante
  ctx.fillStyle = ricordo ? '#e9a44a' : '#3a3834';
  ctx.fillRect(rx + rw * 0.62, ry + rh * 0.22, rw * 0.32, rh * 0.26);        // il quadrante
  ctx.fillStyle = ricordo ? '#fff1c8' : '#4d4a44';
  ctx.fillRect(rx + rw * 0.8, ry + rh * 0.22, Math.max(1.5, rw * 0.02), rh * 0.26);
  ctx.strokeStyle = '#2b2a28';
  ctx.lineWidth = Math.max(1.5, P.h * 0.004);
  ctx.beginPath();
  ctx.moveTo(rx + rw * 0.9, ry);
  ctx.lineTo(rx + rw * 1.0, ry - rh * 0.9);
  ctx.stroke();
  if (ricordo) {
    const breath = 0.8 + 0.2 * Math.abs(Math.sin(P.t * 2.2));
    glow(P, rx + rw * 0.78, ry + rh * 0.35, P.h * 0.14 * breath, AMBER, 0.42);
  }

  if (!ricordo) return;

  // **Il bambino**, seduto per terra davanti al frigo, con le gambe in avanti.
  figure(P, 'bambino', px(P, 0.62), py(P, 0.69), unitScale(P, 0.27, 46), 'seat', {
    crop: 46, mood: 'fermo',
  });

  // **L'uomo**, di spalle, con la cornetta all'orecchio. Il corpo è quello di Dong-hyeok.
  const km = unitScale(P, 0.5, 44);
  const fig = figure(P, 'donghyeok', px(P, 0.42), py(P, 0.6), km, 'back', { crop: 44, accent: '#3a2e33' });
  // La striscia di guancia che sborda dalla nuca, **a destra di chi guarda**: è la sua
  // guancia destra, vista dal lato in cui ha girato appena la testa verso il telefono.
  // La cicatrice è una riga chiara di una cella sulla pelle (`accent`, lo stesso
  // colore del ritratto del funerale).
  const cheekX = fig.x + 21 * km;
  const cheekY = fig.y + 10 * km;
  ctx.fillStyle = '#4d5768';
  ctx.fillRect(cheekX - km, cheekY - km, 3 * km, 9 * km);
  ctx.fillStyle = '#d3a37c';
  ctx.fillRect(cheekX, cheekY, 2 * km, 7 * km);
  ctx.fillStyle = CAST.donghyeok.accent;
  ctx.fillRect(cheekX + km * 0.5, cheekY + km, km, 5 * km);
  // La cornetta: un rettangolo scuro all'altezza dell'orecchio sinistro, e il filo
  // che torna al telefono a muro.
  ctx.fillStyle = '#2a2724';
  ctx.fillRect(fig.x + 1 * km, fig.y + 9 * km, 3 * km, 9 * km);
  ctx.strokeStyle = 'rgba(30,26,20,0.75)';
  ctx.lineWidth = Math.max(1.5, P.h * 0.004);
  ctx.beginPath();
  ctx.moveTo(fig.x + 2 * km, fig.y + 18 * km);
  ctx.quadraticCurveTo(px(P, 0.33), py(P, 0.52), phx, phy + P.h * 0.1);
  ctx.stroke();
}

export const PANNELLI = [
  {
    // Il ricordo. La radio sul frigo è accesa, e sotto la voce dell'uomo c'è il fruscio
    // (§5.37): è lo stesso letto che il giocatore sente in macchina, e **lo deve
    // riconoscere senza che nessuno glielo dica**.
    id: 'r2-1',
    bed: { kkachi: 0.03 },
    draw(P) {
      cucina(P, true);
      vignette(P, 0.4);
      narrator(P, 'L\'uomo di spalle ha la cicatrice sulla guancia destra.');
      speech(P, [
        { who: 'Voce', text: '«Il conto di Man-gi è chiuso. Il bambino l\'ho preso io.»' },
        { text: '«…No. Non lo tocca nessuno. Cresce qui.»' },
        { text: '«…Perché se cresce qui, un giorno vale.»' },
      ]);
    },
  },
  {
    // **Lo stesso pannello**, senza nessuno. Nessun letto: il silenzio è l'unica cosa
    // che cambia dal primo, oltre ai colori, e va tenuto — è la regola del copione
    // (`08-domande-aperte.md`, punto 1) applicata a una stanza vuota.
    id: 'r2-2',
    hold: 5,
    draw(P) {
      cucina(P, false);
      vignette(P, 0.45);
    },
  },
];

export const R2 = {
  id: 'r2',
  title: 'La cucina',
  hangul: '부엌',
  act: 2,

  phases: [
    panelPhase('r2', PANNELLI),
  ],

  finish(game) {
    game.missions.setFlag('cucina');
  },
};
