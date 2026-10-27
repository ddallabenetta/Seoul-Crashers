// M7 · «Sei ore» — 여섯 시간
//
// Il copione sta in `docs/storia/04-atto-2.md`. La sera, e un obiettivo che il gioco
// ha insegnato a evitare per otto ore: **farsi arrestare**. È la sola missione in cui la
// polizia è un mezzo di trasporto, e per questo **non scrive niente di quello che fa un
// arresto**: la sequenza in volante (§5.35) è quella di sempre, e termina in
// `game.bustPlayer()` come sempre — cauzione, arsenale, sei ore, evento `busted`. La
// missione fa una cosa sola, che il motore non sapeva fare: **prendere quell'evento per
// sé** invece di rimettere la fase (`phase.busted`, `core/missions.js`).
//
// Quello che M7 aggiunge è tutto *dopo* il `busted`:
//
//   · **una cella percorribile** (`jail` in `world/interiors.js`): due celle affiancate e un
//     corridoio. Non è una vetrina della città — i commissariati sono un punto sul
//     marciapiede, non un edificio — ma una **vetrina inventata** (`id: 'm7-cella'`) che
//     la missione mette davanti al punto in cui il commissariato ti ha lasciato. Le sbarre
//     sono solide: dentro la cella non si esce, e non serve nessuna serratura;
//   · **niente di niente.** Nessuna radio (non c'è `radio: true` sulla pianta, e 까치 non
//     parla dentro un edificio), nessuna musica, nessun riquadro di missione (`quiet`
//     sulla fase) e nemmeno il campanello della porta. L'orologio è fermo: le sei ore sono
//     già passate nel `bustPlayer`, e alla fine si porta dritto alle 06:10;
//   · **Byeon**, nella cella accanto, è un attore d'interno: non è nella città e non esiste
//     dopo la fase.
//
// Cinque scelte che il copione non dice, e vanno dichiarate:
//
//   · **il fermo si fa di sera.** `Sera` è nel copione, e le cifre dopo vogliono che si
//     esca alle 06:10 (`10-continuita.md`): con le sei ore del `bustPlayer` questo vale se
//     ci si fa prendere fra le 20 e la mezzanotte. Prima, la fase aspetta la sera come M6
//     aspetta le 14:00; oltre mezzanotte, «per stanotte il fermo è chiuso» e si riparte da
//     domani sera. **Fallimento** non c'è, come da copione: è una fase che riprova;
//   · **il commissariato è quello che ti porta il 112.** Il copione dice 종로, che non è un
//     distretto di Seoul: il blip va al commissariato di Myeongdong, che è il centro, e il
//     `bustPlayer` ti porta nel più vicino a dove ti prendono. La cella è la stessa;
//   · **«Là dentro non c'è una macchina accesa»** si lascia dire a 까치 e basta: la chiamata 13
//     (la metro) ne è la copia, e **non ci sono più chiamate in cella** perché 까치 non
//     parla dove non c'è una radio — non una regola nuova, la sesta delle sue sei;
//   · **«Qui si demolisce senza gru»** (chiamata 9) l'origine è Byeon e non Ryu: il copione
//     la dava a Ryu in M6, ma Ryu in M6 non la dice, e un capocantiere che si rifiuta di
//     parlare è il posto giusto per dirla. Vedi `story/kkachi.js`;
//   · **l'alba si attraversa a piedi fino al cancello e basta.** L'auto è dove ti hanno
//     preso, e sapere dov'è non è compito di una missione: la chiusura parte appena si è
//     fuori dal cortile del commissariato.
import { panelPhase } from '../core/missions.js';
import { dist } from '../core/math.js';
import { WALL } from '../world/interiors.js';
import {
  BLOOD,
  px, py, flat, wash, vignette, glow, hexA, hash,
  block, sign, wetFloor, car, dial, narrator, speech,
} from '../render/panelkit.js';
import { figure, unitScale } from '../render/pixelkit.js';

/** Da che ora il fermo è aperto: da qui al mezzanotte sono quattro ore. */
const SERA = 20;
/** L'ora dell'uscita. `10-continuita.md`: Byeon muore alle 06:40, mezz'ora dopo. */
const USCITA = 6 + 10 / 60;
/** A che distanza dal commissariato comincia la fase dell'attesa. */
const ARRIVO = 170;
/** Quanto si cammina via dal cancello prima che la chiusura cominci. */
const LONTANO = 130;
/** Da quanto si è liberi, in secondi, prima che Ha-eun mandi la riga sola. */
const ATTESA_HAEUN = 45;
const CELLA = 'm7-cella';
const NUMERI = ['', 'una', 'due', 'tre', 'quattro'];

function sites(game) {
  if (M7._sites) return M7._sites;
  const sts = (game.city.stations || []).filter((s) => game.city.areaAt?.(s.x, s.y)?.id === 'seoul');
  // Il centro di Seoul: Myeongdong è il distretto più vicino a 종로 che abbia un commissariato.
  const st = sts.find((s) => s.district === 'myeongdong') || sts[0] || game.city.spawn;
  M7._sites = { st };
  return M7._sites;
}

/**
 * La vetrina che non c'è. Sta davanti al punto in cui il commissariato ti ha lasciato —
 * `shops.leave` ci riporta a quel punto, un passo più in là — e ha il suo interno
 * (`jail`) come ogni altra: nessuna cella è stata aggiunta alla città.
 */
function cella(game) {
  const { st } = sites(game);
  return {
    id: CELLA, x: st.x, y: st.y - 16, nx: 0, ny: 1, edge: 'bottom',
    w: 210, h: 150, building: null, district: st.district,
    biz: ['jail'], name: 'Camera di sicurezza', hangul: '유치장', blip: null, seed: 0x7e11a,
  };
}

/** Dove sta in piedi Byeon, e dove sta la branda. Coordinate della pianta. */
const BYEON = (f) => ({ x: Math.round(f.w / 2) + 52, y: WALL + 70 });

/** Ore da qui a quando suona `hour`, per sapere quanto si fa girare l'orologio. */
function finoAlle(dc, hour) {
  return (((hour - dc.hour) % 24) + 24) % 24;
}

// --- i pannelli ---------------------------------------------------------------------------

/** La volante di profilo, con la barra spenta: **quattro in fila, tutte ferme**. */
function volante(P, x, y, s, flip) {
  const ctx = P.ctx;
  car(P, x, y, s, '#dfe5ee', { flip, glass: '#1c2736' });
  ctx.fillStyle = '#1c3f9a';
  ctx.fillRect(x - s * 0.04 + (flip ? -s * 0.1 : 0), y - s * 0.36, s * 0.09, s * 0.035);
  ctx.fillStyle = '#7a2328';
  ctx.fillRect(x + s * 0.05 + (flip ? -s * 0.1 : 0), y - s * 0.36, s * 0.09, s * 0.035);
  ctx.fillStyle = '#143a8a';
  ctx.fillRect(x - s * 0.5, y - s * 0.1, s, s * 0.06);   // la fascia blu sulla fiancata
}

export const APERTURA = [
  {
    // L'ingresso di notte. **Quattro volanti, nessuna con le luci accese**: è il fatto che il
    // narratore può dire (regola 5), e la tavola lo fa vedere prima di dirlo.
    id: 'm7-1',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#090e18', '#131b29', 0.62);
      block(P, px(P, 0.04), py(P, 0.2), P.w * 0.92, P.h * 0.44, '#18202d', { lit: 0.2, seed: 5, window: '#dfe8f5' });
      ctx.fillStyle = '#0e131c';                                   // il corpo centrale
      ctx.fillRect(px(P, 0.34), py(P, 0.2), P.w * 0.32, P.h * 0.44);
      ctx.fillStyle = '#dfe9f6';                                   // la vetrata dell'ingresso
      ctx.fillRect(px(P, 0.42), py(P, 0.46), P.w * 0.16, P.h * 0.18);
      ctx.fillStyle = 'rgba(20,30,46,0.55)';
      ctx.fillRect(px(P, 0.495), py(P, 0.46), P.w * 0.01, P.h * 0.18);
      glow(P, px(P, 0.5), py(P, 0.56), P.h * 0.5, '#cfe3ff', 0.3);
      for (const u of [0.385, 0.615]) {                            // le due lampade blu
        glow(P, px(P, u), py(P, 0.46), P.h * 0.13, '#4aa3ff', 0.8);
        ctx.fillStyle = '#7bbcff';
        ctx.beginPath();
        ctx.arc(px(P, u), py(P, 0.46), P.h * 0.022, 0, Math.PI * 2);
        ctx.fill();
      }
      sign(P, '종로경찰서', px(P, 0.5), py(P, 0.4), { size: P.h * 0.058, color: '#9ccbff', glowR: P.h * 0.32 });
      ctx.fillStyle = '#0d1118';
      ctx.fillRect(P.x, py(P, 0.64), P.w, P.h * 0.36);
      wetFloor(P, py(P, 0.64), ['#4aa3ff', '#dfe8f5'], { alpha: 0.2, seed: 4 });
      [0.15, 0.39, 0.63, 0.87].forEach((u, i) => volante(P, px(P, u), py(P, 0.9 - (i % 2) * 0.03), P.w * 0.23, i % 2 === 1));
      vignette(P, 0.5);
      narrator(P, 'Commissariato. Quattro volanti in fila, tutte con la barra spenta.');
    },
  },
  {
    // Kkachi, per l'ultima volta prima di sparire dal pannello. Le tre righe che dicono
    // **dove vive**: la regola che il giocatore ha imparato per abitudine, detta in chiaro.
    id: 'm7-2',
    bed: { kkachi: 0.03 },
    draw(P) {
      flat(P, '#080b10');
      glow(P, px(P, 0.5), py(P, 0.3), P.h * 0.5, '#ffb163', 0.14);
      dial(P, px(P, 0.16), py(P, 0.14), P.w * 0.68, P.h * 0.26, { from: 90, to: 93, mark: 91.45, label: '91.45' });
      vignette(P, 0.4);
      speech(P, [
        { who: '91.45', kkachi: true, text: '«Ti lascio qui.»' },
        { who: 'Jae-min', text: '«Non entri?»' },
        { who: '91.45', kkachi: true, text: '«Là dentro non c\'è una macchina accesa. Io sto dove c\'è una radio accesa: non è una scelta mia.»' },
      ]);
    },
  },
  {
    // **La seconda metà è una tavola sua**: l'unica domanda a cui Kkachi non ha una
    // risposta pronta si sente solo se la prima cosa è stata detta, e merita uno schermo che
    // non è pieno di un'altra battuta. Il fruscio è appena più alto: è la sillaba mangiata.
    id: 'm7-3',
    bed: { kkachi: 0.045 },
    draw(P) {
      flat(P, '#06080c');
      glow(P, px(P, 0.5), py(P, 0.3), P.h * 0.5, '#ffb163', 0.1);
      dial(P, px(P, 0.16), py(P, 0.14), P.w * 0.68, P.h * 0.26, { from: 90, to: 93, mark: 91.45, label: '91.45' });
      vignette(P, 0.45);
      speech(P, [
        { who: 'Jae-min', text: '«E se ti chiedessi di aspettarmi?»' },
        { note: true, text: 'Due secondi di fruscio.' },
        { who: '91.45', kkachi: true, text: '«Non me l\'ha mai chiesto nessuno.»' },
      ]);
    },
  },
];

/** Una cancellata di ferro, vista da dentro il cortile. */
function cancellata(P, x0, x1, top, bottom) {
  const ctx = P.ctx;
  ctx.fillStyle = '#1b1f27';
  ctx.fillRect(x0, top, x1 - x0, P.h * 0.018);
  ctx.fillRect(x0, bottom - P.h * 0.012, x1 - x0, P.h * 0.012);
  const n = Math.max(3, Math.floor((x1 - x0) / (P.w * 0.018)));
  for (let i = 0; i <= n; i++) ctx.fillRect(x0 + ((x1 - x0) * i) / n, top, P.w * 0.004, bottom - top);
}

export const CHIUSURA = [
  {
    // Il cortile all'alba, con la busta degli effetti personali. **Dentro c'è solo
    // l'orologio**: è l'unico oggetto che gli è rimasto, e il narratore lo dice perché a
    // questa scala non si vede cosa sia.
    id: 'm7-4',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#6c7ea6', '#e6c7a3', 0.55);
      glow(P, px(P, 0.82), py(P, 0.42), P.h * 0.7, '#ffd9a3', 0.32);
      ctx.fillStyle = '#2b2f3a';                                   // il muro di cinta
      ctx.fillRect(P.x, py(P, 0.34), P.w * 0.55, P.h * 0.3);
      ctx.fillStyle = '#1d212b';
      for (let i = 0; i < 9; i++) ctx.fillRect(px(P, i * 0.062), py(P, 0.34), P.w * 0.004, P.h * 0.3);
      cancellata(P, px(P, 0.58), px(P, 0.98), py(P, 0.22), py(P, 0.64));
      ctx.fillStyle = '#9d9788';                                   // il selciato
      ctx.fillRect(P.x, py(P, 0.64), P.w, P.h * 0.36);
      ctx.fillStyle = 'rgba(40,36,30,0.18)';
      for (let i = 0; i < 40; i++) ctx.fillRect(px(P, hash(i * 2.1)), py(P, 0.66 + hash(i * 5.3) * 0.32), P.w * 0.01, 2);
      const k = unitScale(P, 0.62, 44);
      const f = figure(P, 'jaemin', px(P, 0.4), py(P, 0.97), k, 'stand', { crop: 44, mood: 'giu' });
      // La busta: carta marrone aperta in cima, tenuta all'altezza del petto, con **l'orologio**
      // che fa capolino. Un cerchio chiaro con due lancette basta.
      const bx = f.x + 18 * k;
      const by = f.y + 31 * k;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(bx + 3, by + 4, P.w * 0.075, P.h * 0.13);
      ctx.fillStyle = '#b79463';
      ctx.fillRect(bx, by, P.w * 0.075, P.h * 0.13);
      ctx.fillStyle = '#8f7048';
      ctx.fillRect(bx, by, P.w * 0.075, P.h * 0.02);
      ctx.fillStyle = '#e8e2cc';
      ctx.beginPath();
      ctx.arc(bx + P.w * 0.037, by + P.h * 0.012, P.h * 0.028, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a2a30';
      ctx.lineWidth = Math.max(1.5, P.h * 0.004);
      ctx.beginPath();
      ctx.moveTo(bx + P.w * 0.037, by + P.h * 0.012);
      ctx.lineTo(bx + P.w * 0.037, by - P.h * 0.008);
      ctx.moveTo(bx + P.w * 0.037, by + P.h * 0.012);
      ctx.lineTo(bx + P.w * 0.047, by + P.h * 0.016);
      ctx.stroke();
      vignette(P, 0.35);
      narrator(P, 'Effetti personali restituiti: un orologio.\nIl resto è sotto sequestro.');
    },
  },
  {
    // **La mano destra in tasca**, per mezzo pannello. La berlina nera esce dal cancello alle
    // spalle di Jae-min, e quello che si vede dal finestrino è una manica e una tasca: è
    // la stessa mano della camera ardente (pannello 19 della cutscene), e non si vede
    // mai una faccia.
    id: 'm7-5',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#7d8cb0', '#c9b9a4', 0.5);
      cancellata(P, px(P, 0.02), px(P, 0.4), py(P, 0.2), py(P, 0.6));
      ctx.fillStyle = '#8f8a7c';
      ctx.fillRect(P.x, py(P, 0.6), P.w, P.h * 0.4);
      // Lui, di spalle, davanti alla cancellata: piccolo, e **sopra** il riquadro del testo.
      figure(P, 'jaemin', px(P, 0.2), py(P, 0.64), unitScale(P, 0.34, 44), 'back', { crop: 44 });
      // La fiancata nera, a destra, e il finestrino posteriore in primo piano.
      ctx.fillStyle = '#0c0e13';
      ctx.fillRect(px(P, 0.42), py(P, 0.06), P.w * 0.58, P.h * 0.94);
      ctx.fillStyle = '#1b1f27';
      ctx.fillRect(px(P, 0.42), py(P, 0.06), P.w * 0.58, P.h * 0.02);
      const wx = px(P, 0.46);
      const wy = py(P, 0.12);
      const ww = P.w * 0.5;
      const wh = P.h * 0.46;
      ctx.fillStyle = '#2c3340';                                   // il montante
      ctx.fillRect(wx - P.w * 0.012, wy - P.h * 0.016, ww + P.w * 0.024, wh + P.h * 0.032);
      ctx.fillStyle = '#56627a';                                   // il vetro, con l'alba dentro
      ctx.fillRect(wx, wy, ww, wh);
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx, wy, ww, wh);
      ctx.clip();
      // Il busto **senza testa**: il montante taglia sopra il colletto. Spalla, fianco,
      // l'avambraccio che scende, e la tasca con **il polso che ci entra**.
      ctx.fillStyle = '#131820';
      ctx.beginPath();
      ctx.moveTo(wx + ww * 0.08, wy + wh);
      ctx.lineTo(wx + ww * 0.08, wy + wh * 0.4);
      ctx.quadraticCurveTo(wx + ww * 0.1, wy + wh * 0.1, wx + ww * 0.3, wy + wh * 0.06);
      ctx.lineTo(wx + ww * 0.56, wy);
      ctx.lineTo(wx + ww * 0.74, wy + wh * 0.04);
      ctx.quadraticCurveTo(wx + ww * 0.88, wy + wh * 0.12, wx + ww * 0.9, wy + wh * 0.5);
      ctx.lineTo(wx + ww * 0.9, wy + wh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c9ced8';                                   // il colletto della camicia
      ctx.fillRect(wx + ww * 0.4, wy, ww * 0.12, wh * 0.07);
      // L'avambraccio: una manica più chiara, dal gomito alla tasca.
      ctx.fillStyle = '#2a3342';
      ctx.beginPath();
      ctx.moveTo(wx + ww * 0.1, wy + wh * 0.2);
      ctx.lineTo(wx + ww * 0.26, wy + wh * 0.16);
      ctx.lineTo(wx + ww * 0.42, wy + wh * 0.66);
      ctx.lineTo(wx + ww * 0.3, wy + wh * 0.74);
      ctx.lineTo(wx + ww * 0.1, wy + wh * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#46556b';
      ctx.lineWidth = Math.max(2, P.h * 0.005);
      ctx.stroke();
      // La tasca: una fessura scura sul fianco, e il polso che ci sparisce dentro.
      ctx.fillStyle = '#05070a';
      ctx.fillRect(wx + ww * 0.3, wy + wh * 0.72, ww * 0.2, wh * 0.06);
      ctx.fillStyle = '#d3a37c';
      ctx.fillRect(wx + ww * 0.35, wy + wh * 0.68, ww * 0.08, wh * 0.06);
      ctx.fillStyle = '#e4e8f0';
      ctx.fillRect(wx + ww * 0.34, wy + wh * 0.62, ww * 0.1, wh * 0.06);
      ctx.restore();
      ctx.fillStyle = 'rgba(210,220,236,0.1)';                     // il riflesso sul vetro
      ctx.beginPath();
      ctx.moveTo(wx + ww * 0.62, wy);
      ctx.lineTo(wx + ww * 0.94, wy);
      ctx.lineTo(wx + ww * 0.58, wy + wh);
      ctx.lineTo(wx + ww * 0.3, wy + wh);
      ctx.closePath();
      ctx.fill();
      vignette(P, 0.4);
      speech(P, [
        { note: true, text: 'Un\'auto nera esce dal cancello, dietro di lui. Al finestrino posteriore, una mano destra in tasca. La stessa mano della berlina davanti alla camera ardente.' },
      ]);
    },
  },
  {
    // Le nove. **Il telefono è l'unica cosa del pannello**: una notizia, un'ora, e un conto
    // che il narratore fa al posto di nessuno — 06:10 e 06:40 sono tutti e due nel
    // calendario di `10-continuita.md`.
    id: 'm7-6',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#1a1f2a', '#0b0e14', 0.6);
      glow(P, px(P, 0.78), py(P, 0.4), P.h * 0.62, '#7fb2d8', 0.22);
      const w = P.w * 0.24;
      const h = P.h * 0.62;
      const x = px(P, 0.78) - w / 2;
      const y = py(P, 0.14);
      ctx.fillStyle = '#05070a';
      ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
      // La mano che lo regge: il palmo sotto, e le dita che girano sul bordo sinistro.
      ctx.fillStyle = '#d3a37c';
      ctx.fillRect(x + w * 0.18, y + h + 6, w * 0.64, P.h * 0.16);
      for (let i = 0; i < 3; i++) ctx.fillRect(x - 15, y + h * (0.56 + i * 0.1), 12, h * 0.07);
      ctx.fillStyle = '#e9edf3';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = BLOOD;
      ctx.fillRect(x, y, w, h * 0.09);
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${Math.round(P.h * 0.032)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.fillText('속보', x + w * 0.06, y + h * 0.065);
      ctx.fillStyle = '#15181e';
      ctx.font = `800 ${Math.round(P.h * 0.04)}px system-ui, sans-serif`;
      const righe = ['Detenuto', 'trovato morto', 'in cella.', 'Cause naturali.'];
      righe.forEach((t, i) => ctx.fillText(t, x + w * 0.07, y + h * (0.24 + i * 0.11)));
      ctx.fillStyle = 'rgba(21,24,30,0.4)';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + w * 0.07, y + h * (0.74 + i * 0.05), w * (0.86 - i * 0.12), 3);
      ctx.fillStyle = 'rgba(238,242,248,0.55)';
      ctx.font = `600 ${Math.round(P.h * 0.03)}px ui-monospace, monospace`;
      ctx.fillText('09:00', x + w * 0.07, y + h * 0.955);
      vignette(P, 0.5);
      narrator(P, 'Ora del decesso: 06:40.\nSeo Jae-min è uscito da quel cancello alle 06:10.');
    },
  },
];

// --- la missione ------------------------------------------------------------------------------

export const M7 = {
  id: 'm7',
  title: 'Sei ore',
  hangul: '여섯 시간',
  act: 2,

  phases: [
    {
      // **Un messaggio**, e non un luogo. Ha-eun non può interrogare Byeon (le hanno tolto
      // il fascicolo) e lo dice con i numeri, come parla lei: il nome, l'ora, il perché.
      id: 'messaggio',
      hint: 'Un messaggio di Ha-eun',
      enter(ctx) {
        ctx.unmark();
        ctx.talk([
          { who: 'Ha-eun', text: '«Byeon Gi-tae, 변기태. Capocantiere di 한성개발. È in camera di sicurezza a 종로 per il crollo del mercato del ventidue luglio: due operai morti.»' },
          { who: 'Ha-eun', text: '«Domattina alle nove lo tirano fuori gli avvocati. A me hanno tolto il fascicolo: non posso interrogarlo.»' },
          { who: 'Ha-eun', text: '«Lei sì, se ci finisce dentro. Stasera.»' },
        ], () => ctx.next());
      },
    },

    {
      id: 'commissariato',
      hint: 'Il commissariato, a 종로 — questa sera',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.st.x, s.st.y, { label: '경찰서' });
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        const pl = ctx.game.player;
        if (ctx.game.indoors) return;
        if (dist(pl.x, pl.y, s.st.x, s.st.y) < ARRIVO) ctx.next();
      },
    },

    {
      // La sera. Come M6 aspetta le 14:00, e per la stessa ragione: il blip porta dove si
      // aspetta, e chi arriva alle tre del pomeriggio non guarda l'orologio girare.
      id: 'sera',
      hint: 'Aspetta la sera: il fermo si fa dopo le 20:00',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.st.x, s.st.y, { label: '경찰서' });
        ctx.point({
          id: 'aspetta',
          key: 'F',
          onFoot: false,
          text: 'aspetta che sia sera',
          reach: 230,
          x: s.st.x,
          y: s.st.y,
          run: (c) => {
            c.waitUntil(SERA);
            c.next();
          },
        });
      },
      tick(dt, ctx) {
        const h = ctx.game.dayCycle.hour;
        if (h >= SERA) ctx.next();
      },
    },

    panelPhase('m7-apertura', APERTURA),

    {
      // **L'obiettivo è l'opposto di quello che si è imparato.** Il gioco chiede quello che il
      // §5.16 già fa — una o due stelle e niente pistola in mano — e dice solo questo: tutto
      // il resto è la sequenza di §5.35, che termina in `busted` e che questa fase prende.
      id: 'arresto',
      hint: 'Fatti arrestare: una o due stelle, a mani nude — lasciati ammanettare',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.st.x, s.st.y, { label: '경찰서' });
        ctx.state.libero = 0;
        ctx.state.avvisata = false;
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const st = ctx.state;
        const dc = game.dayCycle;
        // Oltre mezzanotte il fermo è chiuso: le sei ore di cella finirebbero dopo le 06:10, e
        // l'ora in cui esce Jae-min è un numero della storia. Si riparte da domani sera.
        if (dc.hour < SERA) {
          ctx.toast('Per stanotte il fermo è chiuso. Domani sera.', 4.4);
          ctx.goto('sera');
          return;
        }
        st.libero += dt;
        if (!st.avvisata && st.libero > ATTESA_HAEUN) {
          st.avvisata = true;
          const left = Math.max(1, Math.min(4, Math.round(24 - dc.hour)));
          // **Una riga sola**, come dice il copione.
          ctx.toast(`Ha-eun: «Le mancano ${NUMERI[left]} ore.»`, 4.6);
        }
      },
      // L'arresto è stato **fatto**: `bustPlayer` ha già tolto l'arsenale, pagato la cauzione e
      // fatto passare le sei ore. Qui si va in cella invece di rientrare nella fase.
      busted(ctx) { ctx.next(); },
    },

    {
      // La cella. **Nessun riquadro di missione**: `quiet` lo toglie dall'HUD, e la fase non
      // ha nemmeno un suggerimento. L'orologio è fermo per tutto il tempo.
      id: 'cella',
      quiet: true,
      enter(ctx) {
        const game = ctx.game;
        const st = ctx.state;
        const shop = cella(game);
        ctx.unmark();
        game.dayCycle.paused = true;
        // Byeon: un attore d'interno, nella cella accanto. **Prima** di entrare: è
        // `showFloor` che mette in sala i personaggi nominati.
        game.actors.define('byeon', {
          indoor: true, shop: CELLA, level: 0, kind: 'worker', name: 'Byeon Gi-tae', hangul: '변기태',
          state: 'post', role: 'keeper', angle: Math.PI,
          place: (fl) => BYEON(fl),
        });
        if (!game.indoors) game.shops.enter(shop, game, { silent: true });
        const f = game.shops.floor;
        if (!f || f.biz.id !== 'jail') return;
        // **La tua cella**, non il corridoio: la porta d'ingresso della pianta è dall'altra
        // parte delle sbarre.
        game.shops.placeOnFloor(game, { x: Math.round(f.w / 2) - 56, y: WALL + 86, angle: 0 });
        const b = BYEON(f);
        ctx.point({
          id: 'byeon', shop: CELLA, level: 0, key: 'E', text: 'parla con l\'uomo della cella accanto',
          reach: 52, x: Math.round(f.w / 2) - 30, y: b.y,
          run: (c) => {
            if (c.state.parlato) return;
            c.talk([
              { text: '변기태 · Byeon Gi-tae, capocantiere di 한성개발. È dentro per il crollo del mercato: due operai morti. Domattina alle nove lo tirano fuori gli avvocati.' },
              { who: 'Byeon', text: '«Non parlo senza l\'avvocato. E non parlo con chi mi mettono in cella accanto.»' },
              // **Origine della chiamata 9** (`story/kkachi.js`): il copione la dà a Ryu, che in
              // M6 non la dice; un capocantiere che rifiuta di parlare è il posto giusto.
              { who: 'Byeon', text: '«Il muro non è crollato. Qui si demolisce senza gru: basta smettere di riparare le strade e aspettare sei anni. Il mio muro aveva sei anni.»' },
              { who: 'Byeon', text: '(guarda meglio, e smette di parlare di muri) «Lei era al cantiere. Il ventidue luglio. Con la cartellina.»' },
              { who: 'Jae-min', text: '«Non ero io.»' },
              { who: 'Byeon', text: '«Era lei. Ha firmato il verbale e ha detto ai ragazzi di scendere sotto il muro. Poi il muro è venuto giù e lei era già in macchina.»' },
              { who: 'Jae-min', text: '«Che macchina.»' },
              {
                who: 'Byeon',
                text: '«Una nera, con l\'autista. E teneva la mano destra in tasca, così, tutto il tempo. Anche mentre firmava.»',
                note: 'Il ventidue luglio Jae-min era a Los Angeles. È atterrato il dieci agosto.',
              },
            ], () => {
              c.state.parlato = true;
              c.unmark();
              apparecchiaBranda(c);
            });
          },
        });
        if (st.parlato) apparecchiaBranda(ctx);
      },
      leave(ctx) {
        // Se la fase finisce per un'altra strada (una ripresa), l'orologio riparte comunque.
        ctx.game.dayCycle.paused = false;
        ctx.game.actors.undefine('byeon');
      },
    },

    {
      // Fuori, all'alba. Non c'è un blip: il copione dice «il ritorno a piedi verso l'auto,
      // all'alba, è parte della scena», e l'auto è dove ti hanno preso.
      id: 'alba',
      hint: 'È l\'alba. Esci dal cancello e torna alla macchina',
      enter(ctx) { ctx.unmark(); },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        const pl = ctx.game.player;
        if (ctx.game.indoors) return;
        if (dist(pl.x, pl.y, s.st.x, s.st.y) > LONTANO) ctx.next();
      },
    },

    panelPhase('m7-chiusura', CHIUSURA),
  ],

  finish(game) {
    // Le nove: il pannello 6 dice che è mattina, e l'orologio non deve dire di no.
    const dc = game.dayCycle;
    const wait = finoAlle(dc, 9);
    if (wait > 0.02) {
      dc.advance(wait);
      game.shops.fade = 2.4;
    }
    game.missions.setFlag('cella');
    game.hud.toast('여섯 시간 — completata', 3.4);
  },
};

/**
 * La branda: compare solo dopo aver parlato con Byeon, perché **non si dorme prima di
 * sapere cosa c'è da sapere**. Alzarsi dalla branda è l'alba: l'orologio riparte, si porta
 * alle 06:10, e chi è di guardia apre.
 */
function apparecchiaBranda(ctx) {
  const game = ctx.game;
  ctx.say('Aspetta l\'alba, sulla branda');
  ctx.drop('branda');
  ctx.point({
    id: 'branda', shop: CELLA, level: 0, key: 'E', text: 'siediti sulla branda e aspetta l\'alba',
    reach: 44, x: WALL + 36, y: WALL + 34,
    run: (c) => {
      if (c.state.alba) return;
      c.state.alba = true;
      game.dayCycle.paused = false;
      c.waitUntil(USCITA);
      game.audio?.ui('move');
      c.talk([
        { who: 'Agente', text: '«Seo Jae-min. Cauzione versata. Le restituiamo i suoi effetti personali.»' },
        { text: 'Una busta di carta marrone. Dentro c\'è un orologio, e basta.', note: 'L\'arsenale resta sotto sequestro, come da regolamento.' },
      ], () => {
        game.shops.leave(game);
        c.next();
      });
    },
  });
}
