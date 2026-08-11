// Raccordo R1 · «Il tè freddo» — dopo M4
//
// Il copione sta in `docs/storia/03-atto-1.md`, in fondo. Tre pannelli e nessun
// gioco: si va dietro al 당구장, e lì finisce l'Atto I.
//
// **Il raccordo è una missione come le altre**, e non un caso speciale del
// motore: ha un id, una fila di fasi (una sola, più i pannelli) e finisce
// alzando un flag. È la forma che avranno anche R2, R3 e R4, e vale la pena che
// sia questa — un raccordo che avesse un impianto suo sarebbe un secondo motore
// da mantenere per quattro scene.
//
// Quello che questa scena fa davvero sta in **una parola**: Chun-sik dice «dice»
// invece di «diceva», e non lo corregge nessuno. Il pannello 3 non spiega cosa
// significhi — dice solo che è la terza volta in tre giorni, che è quanto basta
// per smettere di crederlo un refuso. Chi tocca queste battute stia attento a
// quel verbo: è la rivelazione dell'Atto III, messa sul tavolo qui.
import { panelPhase } from '../core/missions.js';
import { findShop } from './places.js';
import {
  px, py, wash, vignette, glow, hash,
  block, narrator, speech,
} from '../render/panelkit.js';
import { figure, unitScale } from '../render/pixelkit.js';

function sites(game) {
  if (R1._sites) return R1._sites;
  // Lo stesso 당구장 di M1, ritrovato con la stessa ricerca deterministica: la
  // storia non piazza niente e non si ricorda niente, cerca (§5.29).
  R1._sites = { pool: findShop(game, 'billiards', { district: 'hongdae', near: game.city.spawn }) };
  return R1._sites;
}

// --- i pannelli -------------------------------------------------------------------

/** Una tazza di ceramica vista di tre quarti. Tre uguali, e una piena. */
function tazza(P, u, v, s, piena) {
  const ctx = P.ctx;
  const x = px(P, u);
  const y = py(P, v);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.1, y + s * 0.34, s * 0.6, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d7d2c6';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y - s * 0.4);
  ctx.lineTo(x + s * 0.5, y - s * 0.4);
  ctx.lineTo(x + s * 0.38, y + s * 0.3);
  ctx.lineTo(x - s * 0.38, y + s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f0ece2';
  ctx.fillRect(x - s * 0.5, y - s * 0.44, s, s * 0.06);
  // Il tè, e **niente vapore**: è freddo, ed è tutto quello che il pannello deve
  // dire. Un filo di fumo qui sarebbe una bugia da mezzo secondo.
  ctx.fillStyle = piena ? '#6b5a33' : 'rgba(120,112,96,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.36, s * 0.46, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
}

export const PANNELLI = [
  {
    // Il retro del 당구장, di mattina. Tre tazze su un tavolo: due vuote e una
    // piena. Chi le ha contate sa già che manca qualcuno, e nessuno lo dice.
    id: 'r1-1',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#ded6bf', '#8d8a7c', 0.5);
      // La luce viene da una porta aperta a sinistra: mattina vera, non neon.
      glow(P, px(P, 0.08), py(P, 0.3), P.h * 0.9, '#ffe6b8', 0.26);
      block(P, px(P, 0.66), py(P, -0.04), P.w * 0.36, P.h * 0.62, '#5c594e');
      // Lui **prima** del tavolo: chi mette un personaggio dietro un mobile
      // disegna il mobile per secondo, sempre — è la lezione di Jo Ok-bun (§5.29),
      // che al primo provino si era ritrovata il bancone in fronte.
      figure(P, 'chunsik', px(P, 0.5), py(P, 0.78), unitScale(P, 0.52, 30), 'seat', {
        crop: 30, mood: 'giu',
      });
      // Il tavolo, di tre quarti, che prende il terzo basso del pannello.
      ctx.fillStyle = '#6b5136';
      ctx.fillRect(px(P, 0.04), py(P, 0.68), P.w * 0.92, P.h * 0.26);
      ctx.fillStyle = '#8a6c48';
      ctx.fillRect(px(P, 0.04), py(P, 0.68), P.w * 0.92, P.h * 0.035);
      // Le tre tazze, sul tavolo e **tutte e tre visibili**: sono la battuta del
      // pannello, e una nascosta dietro una spalla è una tazza che non c'è.
      tazza(P, 0.2, 0.73, P.h * 0.11, false);
      tazza(P, 0.4, 0.75, P.h * 0.11, false);
      tazza(P, 0.74, 0.73, P.h * 0.11, true);
      vignette(P, 0.3);
      narrator(P, 'Retro del 당구장, 09:05. Tre tazze.\nDue sono vuote da ieri sera. La terza è piena, e fredda.');
    },
  },
  {
    // In piedi, con i fogli in mano. **Non li posa**, e la posa lo dice: braccia
    // basse, niente tavolo. È l'unico pannello dell'atto in cui i due si parlano
    // senza che nessuno dei due guardi l'altro.
    id: 'r1-2',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#c9c2ad', '#6e6b60', 0.5);
      glow(P, px(P, 0.1), py(P, 0.22), P.h * 0.8, '#ffe6b8', 0.2);
      block(P, px(P, 0.0), py(P, 0.02), P.w * 0.14, P.h * 0.56, '#5a574d');
      // **Tutti e due sopra il riquadro delle battute.** Tre voci si prendono
      // quasi metà pannello, e una figura intera che finisce a terra finisce
      // dentro il testo: si taglia il corpo a mezza coscia e si sale.
      figure(P, 'chunsik', px(P, 0.76), py(P, 0.54), unitScale(P, 0.44, 30), 'seat', {
        crop: 30, mood: 'parla',
      });
      figure(P, 'jaemin', px(P, 0.3), py(P, 0.56), unitScale(P, 0.52, 40), 'stand', {
        crop: 40, mood: 'fermo',
      });
      // I fogli, in mano, all'altezza della coscia: piegati in due e ancora umidi.
      ctx.save();
      ctx.translate(px(P, 0.4), py(P, 0.36));
      ctx.rotate(0.22);
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(3, 4, P.w * 0.09, P.h * 0.17);
      ctx.fillStyle = '#d9d3c2';
      ctx.fillRect(0, 0, P.w * 0.09, P.h * 0.17);
      ctx.fillStyle = 'rgba(90,100,110,0.24)';
      ctx.fillRect(0, P.h * 0.11, P.w * 0.09, P.h * 0.06);
      ctx.fillStyle = 'rgba(40,38,34,0.4)';
      for (let i = 0; i < 4; i++) ctx.fillRect(P.w * 0.012, P.h * (0.025 + i * 0.022), P.w * (i % 2 ? 0.055 : 0.035), P.h * 0.007);
      ctx.restore();
      vignette(P, 0.4);
      speech(P, [
        { who: 'Jae-min', text: '«Sapevi che non era lui.»' },
        { who: 'Chun-sik', text: '«Sapevo che dovevo seppellire qualcuno. Chi fosse non me l\'hanno detto e non l\'ho chiesto.»' },
        { who: 'Jae-min', text: '«Zio.»' },
      ]);
    },
  },
  {
    // Il verbo. Chun-sik se ne accorge — la faccia lo dice, gli occhi bassi — e
    // **non lo corregge**. Il pannello è vuoto apposta: una tazza, una mano, e
    // due righe. Chi ci mette dentro qualcos'altro copre l'unica cosa che c'è.
    id: 'r1-3',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#a9a493', '#54524a', 0.45);
      glow(P, px(P, 0.12), py(P, 0.24), P.h * 0.7, '#ffe6b8', 0.14);
      ctx.fillStyle = '#6b5136';
      ctx.fillRect(P.x, py(P, 0.74), P.w, P.h * 0.26);
      ctx.fillStyle = '#7d6142';
      ctx.fillRect(P.x, py(P, 0.74), P.w, P.h * 0.035);
      // La grana del legno: tre righe scure e basta.
      ctx.fillStyle = 'rgba(60,44,28,0.35)';
      for (let i = 0; i < 3; i++) ctx.fillRect(P.x, py(P, 0.8 + i * 0.06), P.w, P.h * 0.01 * (1 + hash(i * 5.5)));
      figure(P, 'chunsik', px(P, 0.46), py(P, 0.98), unitScale(P, 0.82, 36), 'seat', {
        crop: 36, mood: 'giu',
      });
      tazza(P, 0.62, 0.7, P.h * 0.13, true);
      vignette(P, 0.5);
      speech(P, [
        { who: 'Chun-sik', text: '«Ragazzo, tuo padre dice sempre una cosa: che a Seoul si mente per rispetto.»' },
        { who: 'Jae-min', text: '(molto piano) «Dice.»' },
        { text: 'È la terza volta in tre giorni che ne parla al presente.', note: true },
      ]);
      narrator(P, 'Fine del primo atto.');
    },
  },
];

// --- il raccordo --------------------------------------------------------------------

export const R1 = {
  id: 'r1',
  title: 'Il tè freddo',
  hangul: '식은 차',
  act: 1,

  prepare(game) {
    const s = sites(game);
    // La sala apre alle 15 e questa scena è di mattina: la porta la tiene aperta
    // la storia, come in M1 (`shops.hold`).
    if (s.pool) game.shops.hold(s.pool.id);
  },

  phases: [
    {
      id: 'ritrovo',
      hint: 'Chun-sik aspetta dietro al 당구장',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!s.pool) { ctx.next(); return; }
        ctx.mark(s.pool.x, s.pool.y, { label: '당구장' });
        ctx.on('shopEnter', (shop) => { if (shop.id === s.pool.id) ctx.next(); });
      },
    },

    panelPhase('r1', PANNELLI),
  ],

  /**
   * L'atto è chiuso. I due fogli escono di mano qui e non prima: da adesso sono
   * un **fatto della storia** (`atto1`) e non un oggetto, perché un distintivo
   * fisso nell'HUD per otto missioni sarebbe rumore, non memoria.
   */
  finish(game) {
    game.carry.clear();
    game.missions.setFlag('atto1');
    game.hud.toast('상속 — Atto I completato', 4);
  },
};
