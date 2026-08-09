// Il 병원 «성심» — quello che succede ogni volta che muori.
//
// Il copione sta in `docs/storia/09-ospedale.md`, ed è il pezzo di campagna più
// economico del gioco: **non chiede niente al motore.** Il risveglio in corsia
// esiste dal §5.16 e dal §5.27 emette già `respawn`; qui sopra ci sta appeso solo
// del testo.
//
// **Perché sta fuori dalla fila delle tappe.** È l'unico contenuto della campagna
// che si accumula per tutta la partita: se arrivasse alla fine, tutte le morti
// fatte prima sarebbero state mute per niente — e il conto che M12 stampa sulle
// fatture non avrebbe niente da contare.
//
// Tre regole del copione sono cablate qui e vanno rispettate da chi le tocca:
//
//   · **quasi tutti i risvegli sono una riga sola**, in coda al messaggio che
//     l'ospedale già stampa. Un pannello a ogni morte, in un gioco in cui si
//     muore, è una punizione — e la punizione l'ha già data il gioco;
//   · **quattro risvegli sono un pannello**: il primo, il terzo, il decimo e il
//     primo dopo M12. Sono i quattro punti in cui il personaggio cambia registro,
//     e i pannelli **si chiudono da soli** (`hold`), o diventano una cosa da
//     saltare a memoria;
//   · **le battute non si ripetono mai.** Quando finiscono si passa alla forma
//     con il numero, che è l'unico modo in cui una gag regge trenta ripetizioni.
//
// Jeong Han-su non commenta mai come sei morto. Non lo sa, non lo chiede, e
// questo è il personaggio: per lui non è una storia, è un turno.
import {
  PAPER,
  px, py, flat, wash, vignette, glow, hash,
  narrator, speech,
} from '../render/panelkit.js';
import { figure, unitScale } from '../render/pixelkit.js';

/**
 * Il conto delle morti **non è un contatore nuovo**: è `stats.deaths`, che il
 * gioco tiene dal §5.15 e che il salvataggio porta già. Averne due vorrebbe dire
 * averne uno sbagliato, e la scena di M12 poggia su questo numero.
 */
function count(game) {
  return game.stats.deaths || 0;
}

// Le righe che escono nel messaggio dell'ospedale, in ordine di risveglio. Il 1,
// il 3 e il 10 non sono qui: sono pannelli.
const RIGHE = {
  2: '«Bentornato. Non è un modo di dire.»',
  4: '«Ha una milza sola. Glielo dico perché la tratta come se ne avesse due.»',
  5: '«Il caffè della macchina al secondo piano è pessimo. Glielo dico perché ormai lo conosce.»',
  6: '«Di lato è meglio che davanti. Non è una consolazione, è una statistica.»',
  7: '«La signora del letto accanto ha chiesto se lei è un poliziotto. Le ho detto di no e mi ha risposto: peccato.»',
  8: '«I suoi vestiti li buttiamo ogni volta. Quello nero con la tigre no: quello me lo fanno rimettere a posto. Non ho chiesto da chi.»',
  9: '«Ho smesso di scrivere la causa per esteso. Adesso scrivo *come sopra*.»',
};

// Dopo M12 le battute non tornano quelle di prima: restano tre, in rotazione, e
// sono tutte e tre la stessa cosa detta in tre modi.
const DOPO = [
  (n) => `«${n}. L'indirizzo l'ho sbagliato di nuovo.»`,
  () => '«Le hanno telefonato per chiedere se lei era passato. Ho detto che non mi risulta.»',
  () => '«Vada. Qui dentro lei non risulta più, e le assicuro che è la cosa più cara che le ho dato.»',
];

// --- la corsia ---------------------------------------------------------------------

/**
 * Il fondo di tutti i pannelli del 병원, ed è sempre lo stesso apposta: la corsia
 * non cambia mai, ed è metà di quello che dice questo filo. Cambia solo quanti
 * letti si vedono, cioè quanto è lontana la camera.
 */
function corsia(P, opts = {}) {
  const ctx = P.ctx;
  const { beds = 3, close = false } = opts;
  wash(P, '#8d949c', '#5b6169', 0.55);
  // Il pavimento, chiaro e lucido: è l'unica cosa che dice «ospedale» prima dei letti.
  ctx.fillStyle = '#767d85';
  ctx.fillRect(P.x, py(P, 0.62), P.w, P.h * 0.38);
  ctx.fillStyle = 'rgba(232,238,246,0.1)';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(px(P, 0.04 + i * 0.21), py(P, 0.62), P.w * 0.03, P.h * 0.38);
  }
  // I neon del soffitto, in fila verso il fondo.
  for (let i = 0; i < 3; i++) {
    const u = 0.2 + i * 0.3;
    glow(P, px(P, u), py(P, 0.08), P.h * 0.22, PAPER, 0.16);
    ctx.fillStyle = 'rgba(238,242,248,0.55)';
    ctx.fillRect(px(P, u - 0.06), py(P, 0.06), P.w * 0.12, P.h * 0.016);
  }
  // I letti, allineati a sinistra. Una tendina, un materasso, un piantone.
  for (let i = 0; i < beds; i++) {
    const u = close ? -0.1 + i * 0.34 : 0.02 + i * 0.24;
    ctx.fillStyle = '#aeb6c0';
    ctx.fillRect(px(P, u), py(P, 0.44), P.w * 0.17, P.h * 0.2);
    ctx.fillStyle = '#c8d0da';
    ctx.fillRect(px(P, u), py(P, 0.44), P.w * 0.17, P.h * 0.05);
    ctx.fillStyle = '#6c737c';
    ctx.fillRect(px(P, u), py(P, 0.64), P.w * 0.17, P.h * 0.03);
    ctx.fillStyle = 'rgba(180,200,220,0.28)';
    ctx.fillRect(px(P, u + 0.17), py(P, 0.16), P.w * 0.02, P.h * 0.48);
    // La flebo: un'asta e una sacca. Costa due rettangoli e riempie la corsia.
    ctx.fillStyle = '#8f979f';
    ctx.fillRect(px(P, u + 0.15), py(P, 0.3), P.w * 0.005, P.h * 0.16);
    ctx.fillStyle = `rgba(226,236,248,${0.5 + hash(i * 3.1) * 0.3})`;
    ctx.fillRect(px(P, u + 0.142), py(P, 0.3), P.w * 0.02, P.h * 0.05);
  }
  vignette(P, 0.42);
}

/** Un pannello della corsia: fondo, Jeong in piedi, e quello che dice. */
function ward(id, lines, opts = {}) {
  return {
    id,
    // Si chiude da solo. Sette secondi sono una battuta letta con calma, e il
    // primo tasto la chiude prima: nessuno deve imparare a saltarla a memoria.
    hold: opts.hold || 7,
    draw(P) {
      corsia(P, opts);
      figure(P, 'jeong', px(P, opts.at ?? 0.68), py(P, 0.78), unitScale(P, 0.56, 34), 'stand', {
        crop: 34, mood: opts.mood || 'parla',
      });
      // La cartellina: un rettangolo chiaro all'altezza delle mani. È l'oggetto
      // del personaggio, e nell'ultima scena è l'unica cosa che cambia.
      const ctx = P.ctx;
      ctx.fillStyle = opts.folder === false ? 'transparent' : '#e6e9ee';
      if (opts.folder !== false) {
        ctx.fillRect(px(P, (opts.at ?? 0.68) - 0.05), py(P, 0.56), P.w * 0.1, P.h * 0.09);
        ctx.fillStyle = 'rgba(80,90,104,0.6)';
        ctx.fillRect(px(P, (opts.at ?? 0.68) - 0.04), py(P, 0.585), P.w * 0.08, P.h * 0.008);
        ctx.fillRect(px(P, (opts.at ?? 0.68) - 0.04), py(P, 0.605), P.w * 0.06, P.h * 0.008);
      }
      if (opts.narrator) narrator(P, opts.narrator);
      speech(P, lines);
    },
  };
}

export const PRIMO = [ward('osp-1', [
  { who: 'Jeong', text: '«Signor Seo. Le spiego come funziona qui: lei arriva, noi la rimettiamo insieme, lei paga, e poi ci ripensiamo tutti e due.»' },
], {
  beds: 3,
  narrator: '병원 «성심» · Jeong Han-su, direttore.',
})];

export const TERZO = [ward('osp-3', [
  { who: 'Jeong', text: '«Tre. Da medico le dico una cosa sola, poi non gliela ripeto: il corpo tiene il conto anche quando lo dimentica lei.»' },
], { beds: 2, close: true })];

export const DECIMO = [ward('osp-10', [
  { who: 'Jeong', text: '«Signor Seo. Dieci.»' },
  { who: 'Jae-min', text: '«Lo sta contando?»' },
  { who: 'Jeong', text: '«Lo conta qualcun altro. Io lo leggo.» (guarda la cartellina, poi lui) «Non glielo dico per rimproverarla. Glielo dico perché io le voglio bene, e qualcuno le vuole bene meno di me e paga lo stesso.»' },
], { beds: 2, close: true, hold: 11 })];

// La scena dopo M12. Due pannelli, e il secondo è la cartellina da sola: da lì in
// poi il giocatore sa chi paga, e le battute dei risvegli non tornano più indietro.
export const DOPO_M12 = [
  ward('osp-m12-1', [
    { who: 'Jeong', text: '«Lo ha scoperto.»' },
    { who: 'Jae-min', text: '«Da quanto lo sa lei?»' },
    { who: 'Jeong', text: '«Da sempre. Sono le fatture: non è che uno le nasconda, uno le manda.»' },
    { who: 'Jae-min', text: '«E ha continuato.»' },
    { who: 'Jeong', text: '«Ho continuato a rimetterla in piedi, sì. Non mi hanno mai chiesto di fare altro, e se me lo avessero chiesto avrei detto di no.» (pausa) «Credo.»' },
  ], { beds: 2, close: true, mood: 'fermo', hold: 13 }),
  {
    id: 'osp-m12-2',
    hold: 8,
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#5f666e');
      glow(P, px(P, 0.5), py(P, 0.4), P.h * 0.6, PAPER, 0.14);
      // Il letto sotto, e la cartellina appoggiata sopra, girata verso lo schermo.
      ctx.fillStyle = '#aeb6c0';
      ctx.fillRect(P.x, py(P, 0.6), P.w, P.h * 0.4);
      ctx.fillStyle = '#e8ebf0';
      ctx.fillRect(px(P, 0.18), py(P, 0.14), P.w * 0.64, P.h * 0.56);
      ctx.fillStyle = '#cfd4dc';
      ctx.fillRect(px(P, 0.18), py(P, 0.14), P.w * 0.64, P.h * 0.1);
      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.round(P.h * 0.06)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.fillStyle = '#232830';
      ctx.fillText('한성개발', px(P, 0.5), py(P, 0.215));
      ctx.font = `600 ${Math.round(P.h * 0.038)}px ui-monospace, monospace`;
      ctx.fillStyle = 'rgba(35,40,48,0.7)';
      ctx.fillText('병원 «성심» · 청구서', px(P, 0.5), py(P, 0.29));
      ctx.textAlign = 'left';
      // Le righe della fattura: quante ne servono, e non si leggono.
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = `rgba(60,68,80,${0.28 + hash(i * 4.3) * 0.16})`;
        ctx.fillRect(px(P, 0.23), py(P, 0.35 + i * 0.045), P.w * (0.3 + hash(i * 2.7) * 0.2), P.h * 0.012);
        ctx.fillRect(px(P, 0.68), py(P, 0.35 + i * 0.045), P.w * 0.09, P.h * 0.012);
      }
      vignette(P, 0.4);
      speech(P, [
        { who: 'Jae-min', text: '«Può smettere di mandarle?»' },
        { who: 'Jeong', text: '«No.» (la riprende) «Posso sbagliare l\'indirizzo.»' },
      ]);
    },
  },
];

// --- l'aggancio -----------------------------------------------------------------------

/**
 * Un solo iscritto a `respawn`, e tutto il filo sta lì dentro. L'ordine conta per
 * una cosa: `respawnPlayer` emette **dopo** aver spostato il giocatore e stampato
 * i suoi due messaggi, quindi la battuta del direttore arriva in coda a quelli,
 * che è esattamente come è scritta nel copione.
 */
export function attachHospital(game) {
  game.on('respawn', () => {
    const n = count(game);
    const m = game.missions;
    const dopoM12 = m.flag('m12');

    if (dopoM12 && m.playOnce(game, 'ospedale-m12', DOPO_M12)) return;
    if (dopoM12) {
      say(game, DOPO[(n - 1) % DOPO.length](n));
      return;
    }
    if (n === 1 && m.playOnce(game, 'ospedale-1', PRIMO)) return;
    if (n === 3 && m.playOnce(game, 'ospedale-3', TERZO)) return;
    if (n === 10 && m.playOnce(game, 'ospedale-10', DECIMO)) return;
    // Dal decimo in poi dice il numero, e basta. È il momento in cui smette di
    // far finta, e da lì la riga è sempre la stessa forma con il numero vero.
    say(game, n >= 10 ? `«Signor Seo. ${n}.»` : (RIGHE[n] || `«Signor Seo. ${n}.»`));
  });
}

function say(game, line) {
  game.hud.toast(`Jeong Han-su — ${line}`, 5);
}
