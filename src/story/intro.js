// «12년» — la cutscene iniziale. Ventotto pannelli, tre stacchi neri, un titolo.
//
// Il copione sta in `docs/storia/02-cutscene-iniziale.md` e **comanda lui**: qui
// non si inventa niente, si disegna. Un pannello = una funzione, come uno sprite;
// le primitive condivise stanno in `render/panelkit.js`.
//
// **Sui testi.** La prima stesura era scritta per chi conosceva già la storia: una
// voce che conta numeri senza dire che è una radio, un manifesto in hangul che è la
// minaccia di tutto il gioco e nessuno traduce, un morto di cui non si dice mai che
// è il padre. A schermo non era ellittica, era illeggibile. Adesso valgono tre
// regole, e chi aggiunge un pannello le rispetta:
//
//   1. **Ogni fatto che serve a capire si dice una volta, in chiaro.** Chi è
//      Jae-min, chi è il morto, cos'è 한성개발, cosa c'è scritto sul manifesto.
//   2. **Il narratore traduce l'hangul che porta trama** (le insegne decorative no)
//      e continua a dire solo cose verificabili: ore, altezze, targhe, date.
//   3. **Gli indizi restano indizi**: si rendono *visibili*, mai spiegati. La
//      cicatrice specchiata, la mano in tasca e il «di nuovo?» del commesso si
//      notano e non si capiscono — che è esattamente il loro mestiere.
//
// Tre pannelli non sono decorazione e non vanno «semplificati» da nessuno:
//   · 11 — la cicatrice del ritratto è a **sinistra**. In tutti i pannelli di
//     ricordo dei tre atti è a destra. È il primo indizio del gioco (torna in M4).
//   · 19 — la **mano destra resta in tasca**. È Dulchae, e torna in M7 e M8.
//   · 26 — la prima frase di Kkachi. Torna in M4 e in R4.
// Chi salta la cutscene arriva agli stessi ribaltamenti da un'altra porta: per
// questo si può saltare sempre, e per questo i tre indizi sono ripetuti altrove.
import {
  PAPER, PINK, CYAN, AMBER, GREEN, BLOOD,
  px, py, flat, wash, vignette, glow, hexA, hash,
  block, skyline, sign, poster, rain, wetFloor,
  car, dial, narrator, speech, slate,
} from '../render/panelkit.js';
import {
  head, figure, crowd, dog, unitScale, HEAD_UNITS, FIGURE_UNITS,
} from '../render/pixelkit.js';
import { createVehicle } from '../entities/vehicle.js';
import { circleRectPush } from '../core/math.js';
import { nearestActiveLine } from '../world/roadclearance.js';

// Il nero della notte bagnata di Hongdae, che torna in mezza scena.
const DEEP = '#05070b';

/**
 * Un mezzo busto per un pannello che parla.
 *
 * `base` è dove il busto **finisce**, e sta sopra il riquadro delle battute: al
 * primo provino i personaggi erano centrati nella tavola e la loro faccia finiva
 * dietro al testo. In un pannello muto si può scendere; in uno con tre battute
 * no, e questa funzione è il posto in cui quel numero sta scritto una volta sola.
 */
function bust(P, id, u, opts = {}) {
  const { pose = 'stand', crop = 32, frac = 0.46, base = 0.62, ...rest } = opts;
  figure(P, id, px(P, u), py(P, base), unitScale(P, frac, crop), pose, { crop, ...rest });
}

/** Grana da pellicola. Tiene insieme il nero, che altrimenti è uno schermo spento. */
function grain(P, amount = 0.05) {
  const ctx = P.ctx;
  for (let i = 0; i < 120; i++) {
    const k = hash(i * 5.7 + Math.floor(P.t * 12) * 0.37);
    ctx.fillStyle = `rgba(180,196,220,${k * amount})`;
    ctx.fillRect(px(P, hash(i * 3.1 + Math.floor(P.t * 12))), py(P, k), 2, 2);
  }
}

export const INTRO = [
  // --- Parte prima — la frequenza -------------------------------------------
  {
    id: 1,
    // Nessuna immagine: solo il fruscio e una donna che conta in coreano. Il cane
    // che abbaia sotto la terza conta torna nel 27.
    draw(P) {
      flat(P, '#000000');
      grain(P, 0.09);
      const ctx = P.ctx;
      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.round(P.h * 0.05)}px ui-monospace, monospace`;
      const beat = Math.floor(P.t * 1.6) % 6;
      ctx.fillStyle = hexA(AMBER, 0.42 + 0.14 * Math.sin(P.t * 3));
      ctx.fillText('공.  하나.  하나.  넷.  아홉.'.slice(0, 6 + beat * 4), px(P, 0.5), py(P, 0.42));
      ctx.textAlign = 'left';
      // Senza questa riga il gioco si apre su una voce che conta al buio e nessuno
      // sa che sta guardando una radio.
      narrator(P, 'Nessuna immagine. Una radio accesa, e una voce che conta in coreano:\nzero, uno, uno, quattro, nove.');
      speech(P, [{ who: '', kkachi: true, text: '«…quattro. Nove. Non toccare la manopola.»' }]);
    },
  },
  {
    id: 2,
    draw(P) {
      flat(P, '#000000');
      grain(P, 0.03);
      slate(P, 'Dodici anni fa un uomo ha venduto un quartiere che non era suo.\nGli hanno dato dodici anni di tempo.\nMartedì il tempo è finito.');
    },
  },
  {
    id: 3,
    // L'oblò: fuori il 서해 nero e una riga arancione. Del riflesso si vede solo
    // la sagoma di una testa — la faccia non c'è, e per tutta la scena non ci sarà.
    draw(P) {
      const ctx = P.ctx;
      // La cabina: grigio medio, o l'oblò non si stacca da niente.
      wash(P, '#232830', '#12151b');
      ctx.fillStyle = '#1a1e26';
      ctx.fillRect(P.x, py(P, 0.72), P.w, P.h * 0.28);          // lo schienale davanti
      const cx = px(P, 0.52), cy = py(P, 0.46);
      const rx = P.w * 0.17, ry = P.h * 0.36;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();
      // Fuori: cielo notturno sopra, mare nero sotto, e in mezzo la riga.
      const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry * 0.3);
      g.addColorStop(0, '#0c1424');
      g.addColorStop(1, '#241a1a');
      ctx.fillStyle = g;
      ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 1.3);
      glow(P, cx, cy + ry * 0.28, ry * 0.7, AMBER, 0.45);
      ctx.fillStyle = hexA(AMBER, 0.95);
      ctx.fillRect(cx - rx, cy + ry * 0.26, rx * 2, ry * 0.045);
      ctx.fillStyle = '#010204';                                 // il 서해
      ctx.fillRect(cx - rx, cy + ry * 0.305, rx * 2, ry);
      // Il riflesso sul vetro. È la prima volta che si vede la faccia di Jae-min,
      // ed è giusto che sia così: mezza spenta, in un finestrino, di notte. Chi
      // la riconoscerà nel pannello 5 avrà già capito chi sta guardando.
      const kr = unitScale(P, 0.42, HEAD_UNITS);
      head(P, 'jaemin', cx - rx * 0.34, cy - ry * 0.62, kr, { mood: 'giu', dim: 0.62, rim: false });
      ctx.restore();
      // La cornice dell'oblò, chiara: è quello che dice «aereo».
      ctx.strokeStyle = '#39404c';
      ctx.lineWidth = P.h * 0.045;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#4b5260';
      ctx.lineWidth = P.h * 0.012;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + P.h * 0.03, ry + P.h * 0.03, 0, 0, Math.PI * 2);
      ctx.stroke();
      vignette(P, 0.55);
      // «Fra un'ora», non due: al pannello 5 è alle 08:10 in sala arrivi, e con
      // due ore ci sarebbe prima dell'atterraggio.
      narrator(P, '06:41 · 12.000 metri sopra il Mar Giallo.\nVolo da Los Angeles. Atterra fra un\'ora.');
    },
  },
  {
    id: 4,
    // La stessa inquadratura, sotto: è la mappa del gioco vista da dodicimila
    // metri. Chi ci tornerà alla fine riconoscerà il taglio del fiume.
    draw(P) {
      const ctx = P.ctx;
      flat(P, DEEP);
      // L'ala, in alto a sinistra.
      ctx.fillStyle = '#171b23';
      ctx.beginPath();
      ctx.moveTo(P.x, py(P, -0.05));
      ctx.lineTo(px(P, 0.46), py(P, 0.1));
      ctx.lineTo(px(P, 0.4), py(P, 0.26));
      ctx.lineTo(P.x, py(P, 0.2));
      ctx.closePath();
      ctx.fill();
      // La griglia delle luci. Fitta: da dodicimila metri Seoul è un tappeto, non
      // un cielo stellato — e il pannello 4 deve somigliare alla mappa del gioco.
      for (let i = 0; i < 700; i++) {
        const u = hash(i * 2.3);
        const v = 0.3 + hash(i * 7.1) * 0.68;
        const onRiver = Math.abs(v - (0.56 + Math.sin(u * 3.4) * 0.05)) < 0.05;
        if (onRiver) continue;
        ctx.fillStyle = hexA(hash(i) > 0.82 ? CYAN : AMBER, 0.25 + hash(i * 3.7) * 0.65);
        ctx.fillRect(px(P, u), py(P, v), 2.2, 2.2);
      }
      // Il taglio nero del 한강, e sopra tre ponti accesi.
      ctx.strokeStyle = '#02030a';
      ctx.lineWidth = P.h * 0.055;
      ctx.beginPath();
      for (let u = 0; u <= 1.001; u += 0.02) {
        const v = 0.56 + Math.sin(u * 3.4) * 0.05;
        if (u === 0) ctx.moveTo(px(P, u), py(P, v)); else ctx.lineTo(px(P, u), py(P, v));
      }
      ctx.stroke();
      for (const u of [0.24, 0.52, 0.78]) {
        const v = 0.56 + Math.sin(u * 3.4) * 0.05;
        glow(P, px(P, u), py(P, v), P.h * 0.06, AMBER, 0.55);
        ctx.fillStyle = hexA(AMBER, 0.9);
        ctx.fillRect(px(P, u) - 1, py(P, v) - P.h * 0.032, 2.4, P.h * 0.064);
      }
      vignette(P, 0.5);
      // Qui il gioco dice per la prima volta chi si sta guardando. Prima era
      // sottinteso per ventotto pannelli, e restava sottinteso.
      narrator(P, 'Seoul. Ventitré milioni di persone, tre ponti.\nSeo Jae-min ci è nato. Manca da dodici anni.');
    },
  },

  // --- Parte seconda — l'arrivo ---------------------------------------------
  {
    id: 5,
    // Jae-min è l'unico fermo mentre tutti si muovono. Da qui alla fine della
    // scena è **sempre** l'unico fermo: è il modo in cui si riconosce senza faccia.
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#1a1e26', '#0d1016');
      ctx.fillStyle = '#0f131a';
      ctx.fillRect(P.x, py(P, 0.72), P.w, P.h * 0.28);
      // Nastro bagagli.
      ctx.fillStyle = '#22272f';
      ctx.fillRect(P.x, py(P, 0.66), P.w, P.h * 0.08);
      ctx.fillStyle = '#171b22';
      for (let i = 0; i < 7; i++) {
        const u = ((i * 0.16) + P.t * 0.03) % 1.1 - 0.05;
        ctx.fillRect(px(P, u), py(P, 0.6), P.w * 0.05, P.h * 0.06);
      }
      sign(P, '김포국제공항', px(P, 0.5), py(P, 0.15), { size: P.h * 0.055, color: CYAN, glowR: P.h * 0.26 });
      // La folla resta sagoma e resta **dietro**: serve a far vedere che lui è
      // l'unico fermo, non a farsi guardare.
      const kc = unitScale(P, 0.44, FIGURE_UNITS);
      crowd(P, px(P, 0.24), py(P, 0.8), kc, 4, { pose: 'walk', seed: 4 });
      crowd(P, px(P, 0.82), py(P, 0.82), kc, 3, { pose: 'walk', seed: 11 });
      // Lui, davanti e grande: è il pannello in cui il giocatore vede in faccia
      // il proprio personaggio per la prima volta, e deve poterlo guardare.
      figure(P, 'jaemin', px(P, 0.52), py(P, 1.04), unitScale(P, 0.86, FIGURE_UNITS), 'stand');
      vignette(P, 0.45);
      narrator(P, 'Aeroporto di Gimpo, 08:10. Nessuno è venuto a prenderlo.');
    },
  },
  {
    id: 6,
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#0a0c11');
      // La mano che regge il telefono.
      ctx.fillStyle = '#171b23';
      ctx.beginPath();
      ctx.moveTo(px(P, 0.18), py(P, 1.05));
      ctx.lineTo(px(P, 0.3), py(P, 0.5));
      ctx.lineTo(px(P, 0.72), py(P, 0.52));
      ctx.lineTo(px(P, 0.8), py(P, 1.05));
      ctx.closePath();
      ctx.fill();
      const sx = px(P, 0.31), sy = py(P, 0.16), sw = P.w * 0.38, sh = P.h * 0.72;
      ctx.fillStyle = '#e9eef5';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = 'rgba(20,24,32,0.5)';
      ctx.font = `600 ${Math.round(P.h * 0.032)}px system-ui, sans-serif`;
      ctx.fillText('삼촌', sx + sw * 0.06, sy + sh * 0.11);
      ctx.fillText('3일 전', sx + sw * 0.72, sy + sh * 0.11);
      // Un solo messaggio. Niente sopra, niente sotto.
      ctx.fillStyle = '#dbe4ef';
      ctx.beginPath();
      ctx.roundRect(sx + sw * 0.06, sy + sh * 0.18, sw * 0.8, sh * 0.16, 8);
      ctx.fill();
      ctx.fillStyle = '#161a22';
      ctx.font = `500 ${Math.round(P.h * 0.03)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.fillText('장례식장. 홍대.', sx + sw * 0.11, sy + sh * 0.25);
      ctx.fillText('오면 알아본다.', sx + sw * 0.11, sy + sh * 0.31);
      vignette(P, 0.5);
      speech(P, [
        { who: 'Zio', text: '«La camera ardente è a Hongdae. Se vieni, sanno chi sei.»' },
        { note: true, text: 'Tre giorni fa, e non c\'è altro: niente sopra, niente sotto. In rubrica ha quattro nomi.' },
      ]);
    },
  },
  {
    id: 7,
    // Taxi, pioggia. Fuori: l'autostrada, i capannoni di 김포, le risaie.
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#0a0d13');
      // Il finestrino, in alto: fa da fondo ai due che parlano invece di
      // prendersi mezzo pannello. Prima l'inquadratura era da fuori e i due
      // erano due bastoncini in un angolo.
      const wx = px(P, 0.08), wy = py(P, 0.05), ww = P.w * 0.84, wh = P.h * 0.44;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(wx, wy, ww, wh, 10);
      ctx.clip();
      wash(P, '#1b2532', '#0e141c');
      ctx.fillStyle = '#0b1119';
      ctx.fillRect(wx, wy + wh * 0.52, ww, wh * 0.5);
      for (let i = 0; i < 8; i++) {                       // capannoni
        const u = hash(i * 4.4);
        ctx.fillStyle = '#141a24';
        ctx.fillRect(wx + u * ww, wy + wh * (0.34 + hash(i * 9) * 0.1), ww * 0.13, wh * 0.2);
      }
      ctx.strokeStyle = 'rgba(226,236,248,0.16)';         // risaie
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(wx, wy + wh * (0.6 + i * 0.09));
        ctx.lineTo(wx + ww, wy + wh * (0.56 + i * 0.1));
        ctx.stroke();
      }
      const inner = { ...P, x: wx, y: wy, w: ww, h: wh };
      rain(inner, 0.75, { angle: 0.42, speed: 2.6 });
      ctx.restore();
      ctx.strokeStyle = '#191d26';
      ctx.lineWidth = P.h * 0.03;
      ctx.beginPath();
      ctx.roundRect(wx, wy, ww, wh, 10);
      ctx.stroke();
      // L'abitacolo sotto il finestrino, e i due sedili.
      ctx.fillStyle = '#161b23';
      ctx.fillRect(P.x, py(P, 0.49), P.w, P.h * 0.51);
      ctx.fillStyle = '#1e242e';
      ctx.fillRect(P.x, py(P, 0.49), P.w, P.h * 0.03);
      // Il quadrante della radio sul cruscotto: piccolo, ma è il filo della scena
      // e nel pannello 8 diventa tutto lo schermo.
      dial(P, px(P, 0.4), py(P, 0.53), P.w * 0.2, P.h * 0.09,
        { mark: 91.3, from: 90.5, to: 92.5, ticks: false });
      // I due che parlano, mezzo busto: il tassista a sinistra, Jae-min a destra.
      // È una licenza da fumetto — in un taxi non si vedrebbero così — e vale la
      // pena, perché è il primo scambio del gioco.
      bust(P, 'tassista', 0.24, { frac: 0.42, base: 0.6, mood: 'parla' });
      bust(P, 'jaemin', 0.75, { frac: 0.42, base: 0.6, mood: 'giu', flip: true });
      speech(P, [
        { who: 'Tassista', text: '«Da quanto tempo è via?»' },
        { who: 'Jae-min', text: '«Dodici anni.»' },
        { who: 'Tassista', text: '«Allora non riconosce più niente.»' },
        { who: 'Jae-min', text: '«Riconosco l\'odore.»' },
      ]);
    },
  },
  {
    id: 8,
    // Prima apparizione della frequenza, e nessuno la nomina. La lancetta si ferma
    // **fra le due tacche**: è tutto quello che c'è da vedere, e a schermo, piccola
    // com'è, non si vede — per questo lo dice il narratore.
    draw(P) {
      flat(P, '#080a0f');
      const ctx = P.ctx;
      ctx.fillStyle = '#12161d';
      ctx.fillRect(px(P, 0.08), py(P, 0.22), P.w * 0.84, P.h * 0.5);
      dial(P, px(P, 0.14), py(P, 0.3), P.w * 0.72, P.h * 0.34,
        { from: 90.5, to: 92.5, mark: 91.37, color: AMBER });
      // Fruscio sul quadrante.
      for (let i = 0; i < 40; i++) {
        const k = hash(i * 3.3 + Math.floor(P.t * 20));
        ctx.fillStyle = hexA(AMBER, k * 0.18);
        ctx.fillRect(px(P, 0.14 + hash(i * 7.7) * 0.72), py(P, 0.3 + k * 0.34), 2, 1.5);
      }
      vignette(P, 0.55);
      narrator(P, 'La lancetta scorre e si ferma fra 91.4 e 91.5. Fra due tacche.');
      speech(P, [
        { who: 'Tassista', text: '«Fa così da anni. È rotta.»' },
        { note: true, text: 'Non si volta a guardare.' },
      ]);
    },
  },
  {
    id: 9,
    // L'ingresso di Hongdae. Neon rosa, cavi in cielo, e sul muro il manifesto
    // grande, nuovo, incollato male.
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#160d18', '#08060c');
      block(P, px(P, -0.02), py(P, 0.05), P.w * 0.3, P.h * 0.95, '#11101a', { lit: 0.3, seed: 2, window: PINK });
      block(P, px(P, 0.72), py(P, -0.02), P.w * 0.32, P.h, '#0f0e17', { lit: 0.26, seed: 8, window: CYAN });
      sign(P, '홍대', px(P, 0.14), py(P, 0.3), { size: P.h * 0.09, color: PINK, glowR: P.h * 0.45 });
      sign(P, '노래방', px(P, 0.84), py(P, 0.22), { size: P.h * 0.055, color: CYAN, glowR: P.h * 0.3 });
      sign(P, '치킨', px(P, 0.83), py(P, 0.46), { size: P.h * 0.05, color: AMBER, glowR: P.h * 0.26 });
      // Cavi in cielo.
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(px(P, 0.24), py(P, 0.06 + i * 0.035));
        ctx.quadraticCurveTo(px(P, 0.5), py(P, 0.14 + i * 0.05), px(P, 0.76), py(P, 0.05 + i * 0.04));
        ctx.stroke();
      }
      ctx.fillStyle = '#06070c';
      ctx.fillRect(P.x, py(P, 0.76), P.w, P.h * 0.24);
      wetFloor(P, py(P, 0.76), [PINK, CYAN, AMBER], { alpha: 0.34 });
      car(P, px(P, 0.5), py(P, 0.9), P.w * 0.3, '#c9a227', { lights: true, wipers: true });
      poster(P, px(P, 0.62), py(P, 0.36), P.w * 0.15, P.h * 0.26,
        [{ text: '철거예정' }, { text: '한성개발' }], { tilt: 0.06 });
      rain(P, 1, { angle: 0.3, speed: 2.4 });
      vignette(P, 0.5);
      // La traduzione del manifesto è la trama di tutto il gioco: senza, resta un
      // rettangolo bianco con dei segni sopra.
      narrator(P, '홍대, Hongdae. Piove da tre giorni.\nSul muro un manifesto nuovo: 철거예정 — demolizione prevista.');
    },
  },
  {
    id: 10,
    draw(P) {
      flat(P, '#0b0910');
      const ctx = P.ctx;
      ctx.fillStyle = '#181521';
      ctx.fillRect(P.x, P.y, P.w, P.h);
      poster(P, px(P, 0.16), py(P, 0.1), P.w * 0.68, P.h * 0.78,
        [
          { text: '철거예정', at: 0.28, size: P.h * 0.17 },
          { text: '한성개발', at: 0.5, size: P.h * 0.09 },
          { text: '2026. 09. 21.', at: 0.78, size: P.h * 0.11, color: BLOOD },
        ], { tilt: 0.03 });
      rain(P, 0.5, { angle: 0.24 });
      vignette(P, 0.45);
      narrator(P, '한성개발 · Hanseong Development.\nDemolizione prevista: 21 settembre. Fra sei settimane.');
    },
  },

  // --- Parte terza — il funerale ---------------------------------------------
  {
    id: 11,
    // PRIMO INDIZIO. Nella foto la cicatrice è a **sinistra**; in tutti e sette i
    // pannelli di ricordo dei tre atti è a destra. Nessuno lo nota prima di M4.
    draw(P) {
      const ctx = P.ctx;
      // La sala è **chiara**: le sagome inginocchiate davanti sono nere, e senza
      // un fondo che le stacchi il pannello resta una macchia (già pagato).
      wash(P, '#2a2731', '#1a1820');
      ctx.fillStyle = '#141219';
      ctx.fillRect(P.x, py(P, 0.7), P.w, P.h * 0.3);
      // Il ritratto. **Grande**: la cicatrice specchiata è il primo indizio del
      // gioco, e in una fotografia larga un sesto di pannello non la vede
      // nessuno. Sotto il narratore, non dietro.
      const rw = P.w * 0.26, rh = rw * 1.14;
      const rx = px(P, 0.5) - rw / 2, ry = py(P, 0.13);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(rx + 6, ry + 7, rw, rh);
      ctx.fillStyle = '#0e0c12';                              // cornice
      ctx.fillRect(rx - rw * 0.045, ry - rh * 0.04, rw * 1.09, rh * 1.08);
      ctx.fillStyle = '#7c8698';                              // la stampa
      ctx.fillRect(rx, ry, rw, rh);
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      // La faccia del padre. Si vede una volta sola, in tutto il gioco, e da
      // morto: va guardata bene. La cicatrice sta a destra di chi guarda perché
      // **la stampa è specchiata** — è nel disegno della griglia, non qui.
      figure(P, 'donghyeok', rx + rw * 0.5, ry + rh * 1.02,
        Math.max(1, Math.floor(rh / 34)), 'stand', { crop: 32 });
      ctx.restore();
      // La fascia nera, di traverso sull'angolo. Ritagliata sulla cornice: senza,
      // esce dalla foto e diventa un'asta appoggiata al muro.
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx - rw * 0.05, ry - rh * 0.04, rw * 1.1, rh * 1.08);
      ctx.clip();
      ctx.fillStyle = '#05060a';
      ctx.translate(rx + rw * 1.05, ry - rh * 0.04);
      ctx.rotate(Math.PI * 0.75);
      ctx.fillRect(-rw * 0.1, 0, rw * 0.9, rh * 0.11);
      ctx.restore();
      // Crisantemi: due file, con lo stelo, ai lati del ritratto.
      for (const [row, a] of [[0.6, 0.95], [0.66, 0.75]]) {
        for (let i = 0; i < 16; i++) {
          const u = 0.04 + i * 0.06;
          if (u > 0.4 && u < 0.6) continue;                    // il ritratto sta in mezzo
          const x = px(P, u + (row > 0.62 ? 0.03 : 0));
          ctx.strokeStyle = `rgba(96,120,96,${a * 0.6})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, py(P, row));
          ctx.lineTo(x, py(P, row + 0.06));
          ctx.stroke();
          ctx.fillStyle = `rgba(240,244,250,${a})`;
          ctx.beginPath();
          ctx.arc(x, py(P, row), P.h * 0.019, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Il tavolino delle offerte, a destra, con le buste in piedi.
      ctx.fillStyle = '#1e1b24';
      ctx.fillRect(px(P, 0.72), py(P, 0.62), P.w * 0.24, P.h * 0.03);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#eef1f6';
        ctx.fillRect(px(P, 0.75 + i * 0.06), py(P, 0.56), P.w * 0.045, P.h * 0.06);
      }
      // Chi è inginocchiato: davanti, in ombra, e senza faccia — sono la sala,
      // non delle persone.
      crowd(P, px(P, 0.44), py(P, 1.06), unitScale(P, 0.5, FIGURE_UNITS), 7,
        { pose: 'kneel', seed: 21, tint: '#15171f', spread: 17 });
      vignette(P, 0.5);
      // «Suo padre» va detto qui. Nella prima stesura la parola non compariva in
      // tutta la scena, e il funerale poteva essere di chiunque.
      narrator(P, '서동혁 · Seo Dong-hyeok. 1968-2026.\nSuo padre. Incidente sul lavoro, molo 7, porto di Incheon.');
    },
  },
  {
    id: 12,
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#2b2530', '#171319');
      ctx.fillStyle = '#3a3038';                        // il piano del tavolino
      ctx.fillRect(P.x, py(P, 0.48), P.w, P.h * 0.52);
      ctx.fillStyle = '#241d24';
      ctx.fillRect(P.x, py(P, 0.48), P.w, P.h * 0.02);
      // Tre buste, viste di tre quarti: lo **spessore** è tutto il pannello, e si
      // legge solo se ognuna ha una faccia laterale.
      const specs = [
        { u: 0.1, w: 0.22, th: 0.045, label: null },
        { u: 0.38, w: 0.22, th: 0.04, label: null },
        { u: 0.66, w: 0.24, th: 0.115, label: '한성개발' },
      ];
      for (const s of specs) {
        const x = px(P, s.u), w = P.w * s.w, top = py(P, 0.62) - P.h * s.th;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x + 6, py(P, 0.62), w, P.h * 0.02);
        ctx.fillStyle = '#b9c0cc';                      // il fianco: è lo spessore
        ctx.fillRect(x, top, w, P.h * s.th);
        ctx.fillStyle = '#f2f5f9';                      // il piano di sopra
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x + w * 0.12, top - P.h * 0.07);
        ctx.lineTo(x + w * 1.12, top - P.h * 0.07);
        ctx.lineTo(x + w, top);
        ctx.closePath();
        ctx.fill();
        if (!s.label) continue;
        ctx.fillStyle = '#1b1b22';
        ctx.font = `700 ${Math.round(P.h * 0.05)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(s.label, x + w / 2, top + P.h * s.th * 0.7);
        ctx.textAlign = 'left';
      }
      vignette(P, 0.5);
      // Tre buste bianche su un tavolino non dicono niente a chi non è mai stato a
      // un funerale coreano. Che la più spessa sia di chi demolisce il quartiere,
      // invece, si capisce ovunque.
      narrator(P, 'Buste di condoglianze. Sono tre.\nLa più spessa è di 한성개발.');
    },
  },
  {
    id: 13,
    // «Dice». Al presente. Lo farà per tutto l'Atto I, ed è il seme del quarto
    // ribaltamento: la nota lo rende **notabile**, non lo spiega.
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#2a2731', '#191720');
      ctx.fillStyle = '#141219';
      ctx.fillRect(P.x, py(P, 0.72), P.w, P.h * 0.28);
      // I sei del 백호파 che non si alzano: sagome, in secondo piano, piccole.
      crowd(P, px(P, 0.78), py(P, 0.72), unitScale(P, 0.4, FIGURE_UNITS), 5,
        { pose: 'kneel', seed: 33, tint: '#262b38', spread: 15 });
      // Chun-sik che apre le braccia, **ridendo**: è l'unico momento caldo di
      // tutta la scena, e l'unica faccia che il giocatore vede sorridere.
      bust(P, 'chunsik', 0.33, { pose: 'hug', frac: 0.54, base: 0.63, mood: 'ride' });
      vignette(P, 0.5);
      speech(P, [
        { who: 'Lo zio Chun-sik', text: '«Ragazzo. Ragazzo. Guardati. Mangi?»' },
        { who: 'Jae-min', text: '«Zio.»' },
        { who: 'Chun-sik', text: '«Tuo padre dice sempre che in America si mangia male.»' },
        { note: true, text: 'Dice. Al presente. Nessuno lo corregge.' },
      ]);
    },
  },
  {
    id: 14,
    // Qui la scena è a due colori soli: il retro della sala è un'altra stanza.
    draw(P) {
      const ctx = P.ctx;
      // Due colori soli, come dice il copione: il retro della sala è un'altra
      // stanza. Ma i due colori devono essere **distanti**, o non è un pannello.
      flat(P, '#39414d');
      ctx.fillStyle = '#2a313b';
      ctx.fillRect(P.x, py(P, 0.68), P.w, P.h * 0.32);
      ctx.fillStyle = '#20262e';                       // la porta verso la sala
      ctx.fillRect(P.x, P.y, P.w * 0.22, P.h);
      crowd(P, px(P, 0.08), py(P, 0.66), unitScale(P, 0.26, FIGURE_UNITS), 3,
        { pose: 'kneel', seed: 44, tint: '#2a313c', spread: 14 });
      // Il carrello con il tè, fra i due: si disegna **prima**, così i due lo
      // coprono ai lati e la scena ha una profondità invece di tre file.
      ctx.fillStyle = '#0d1015';
      ctx.fillRect(px(P, 0.44), py(P, 0.56), P.w * 0.14, P.h * 0.03);
      ctx.fillRect(px(P, 0.455), py(P, 0.59), P.w * 0.009, P.h * 0.2);
      ctx.fillRect(px(P, 0.555), py(P, 0.59), P.w * 0.009, P.h * 0.2);
      ctx.fillStyle = '#e6ebf2';                       // la teiera
      ctx.fillRect(px(P, 0.475), py(P, 0.5), P.w * 0.045, P.h * 0.06);
      // I due, uno di fronte all'altro: Jae-min chiede, Chun-sik non risponde.
      // `giu` su Chun-sik è tutto il pannello — è l'unico posto della scena in
      // cui smette di parlare, e nel copione è quello che significa qualcosa.
      bust(P, 'jaemin', 0.25, { frac: 0.44, base: 0.6, mood: 'parla' });
      bust(P, 'chunsik', 0.74, { frac: 0.46, base: 0.6, mood: 'giu', flip: true });
      vignette(P, 0.45);
      speech(P, [
        { who: 'Jae-min', text: '«Com\'è successo?»' },
        { who: 'Chun-sik', text: '«Un container, al molo 7. Di notte lì non c\'è nessuno.»' },
        { who: 'Jae-min', text: '«E allora lui cosa ci faceva, al molo 7, di notte?»' },
        { note: true, text: 'Chun-sik non risponde. Versa il tè.' },
      ]);
    },
  },
  {
    id: 15,
    // Ne riempie **tre**. Se ne accorge, e non toglie la terza.
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#1c1f26', '#0e1015');
      ctx.fillStyle = '#0a0c10';
      ctx.fillRect(P.x, py(P, 0.66), P.w, P.h * 0.34);
      const cup = (u, full) => {
        const x = px(P, u), y = py(P, 0.62), r = P.w * 0.055;
        ctx.fillStyle = '#e6ebf2';
        ctx.beginPath();
        ctx.moveTo(x - r, y - P.h * 0.14);
        ctx.lineTo(x + r, y - P.h * 0.14);
        ctx.lineTo(x + r * 0.72, y);
        ctx.lineTo(x - r * 0.72, y);
        ctx.closePath();
        ctx.fill();
        if (!full) return;
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(x - r * 0.86, y - P.h * 0.115, r * 1.72, P.h * 0.022);
      };
      cup(0.28, true);
      cup(0.5, true);
      cup(0.72, true);
      vignette(P, 0.5);
      narrator(P, 'Tre tazze. Al tavolo sono in due.');
      speech(P, [{ note: true, text: 'Chun-sik se ne accorge a metà. Non toglie la terza.' }]);
    },
  },
  {
    id: 16,
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#2c3039', '#161a20');
      ctx.fillStyle = '#1b1f26';
      ctx.fillRect(P.x, py(P, 0.74), P.w, P.h * 0.26);
      bust(P, 'chunsik', 0.28, { pose: 'lean', frac: 0.5, base: 0.68, mood: 'parla' });
      // Il sacchetto del 편의점 che gli porge: quello che c'è dentro è il bomber,
      // ed è l'oggetto-tema di tutto il gioco.
      ctx.fillStyle = 'rgba(232,238,246,0.92)';
      ctx.beginPath();
      ctx.moveTo(px(P, 0.6), py(P, 0.3));
      ctx.lineTo(px(P, 0.79), py(P, 0.3));
      ctx.lineTo(px(P, 0.82), py(P, 0.72));
      ctx.lineTo(px(P, 0.57), py(P, 0.72));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(20,24,32,0.28)';
      ctx.fillRect(px(P, 0.6), py(P, 0.44), P.w * 0.19, P.h * 0.24);
      ctx.fillStyle = GREEN;
      ctx.font = `700 ${Math.round(P.h * 0.04)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.fillText('편의점', px(P, 0.62), py(P, 0.4));
      vignette(P, 0.5);
      speech(P, [
        { who: 'Chun-sik', text: '«Prendi. Era di tuo padre. A me non entra da vent\'anni.»' },
      ]);
    },
  },
  {
    id: 17,
    // Il bomber. Il colletto è consumato in un punto solo, **a destra**.
    draw(P) {
      const ctx = P.ctx;
      // Il tavolo è chiaro: un bomber nero su un tavolo nero è un rettangolo.
      wash(P, '#4a4038', '#2c2620');
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px(P, 0.16), py(P, 0.28), P.w * 0.72, P.h * 0.6);
      const jx = px(P, 0.26), jy = py(P, 0.16), jw = P.w * 0.48, jh = P.h * 0.62;
      // Le maniche, aperte ai lati: senza, il giubbotto è un cuscino.
      ctx.fillStyle = '#0a0b0f';
      ctx.beginPath();
      ctx.roundRect(jx - jw * 0.26, jy + jh * 0.06, jw * 0.3, jh * 0.42, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(jx + jw * 0.96, jy + jh * 0.06, jw * 0.3, jh * 0.42, 8);
      ctx.fill();
      ctx.beginPath();                                  // il corpo
      ctx.roundRect(jx, jy, jw, jh, 12);
      ctx.fill();
      ctx.fillStyle = '#c2384a';                        // la banda rossa, lungo la schiena
      ctx.fillRect(jx, jy + jh * 0.44, jw, jh * 0.13);
      // L'artigliata bianca della tigre, sopra la banda.
      ctx.strokeStyle = '#eef2f8';
      ctx.lineWidth = Math.max(2.5, jh * 0.032);
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(jx + jw * (0.26 + i * 0.16), jy + jh * 0.1);
        ctx.quadraticCurveTo(
          jx + jw * (0.38 + i * 0.16), jy + jh * 0.24,
          jx + jw * (0.3 + i * 0.16), jy + jh * 0.4
        );
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      // Il polsino e l'elastico in vita, che è quello che lo fa leggere «bomber».
      ctx.fillStyle = '#191b21';
      ctx.fillRect(jx, jy + jh * 0.9, jw, jh * 0.1);
      // Il colletto: consumato in un punto solo, **a destra**.
      ctx.fillStyle = '#191b21';
      ctx.fillRect(jx + jw * 0.24, jy - jh * 0.06, jw * 0.52, jh * 0.09);
      ctx.fillStyle = '#6d747f';
      ctx.fillRect(jx + jw * 0.62, jy - jh * 0.052, jw * 0.11, jh * 0.074);
      vignette(P, 0.45);
      // Senza questa riga lo scambio dopo non ha senso: è un giubbotto qualunque, e
      // non si capisce perché a Gangnam dovrebbero riconoscerlo.
      narrator(P, 'Sulla schiena, l\'artigliata della tigre bianca:\nil segno del 백호파, la banda di suo padre.');
      speech(P, [
        { who: 'Chun-sik', text: '«Non metterlo a Gangnam.»' },
        { who: 'Jae-min', text: '«Perché?»' },
        { who: 'Chun-sik', text: '«Perché a Gangnam sanno cos\'è.»' },
      ]);
    },
  },
  {
    id: 18,
    // Tre berline nere in doppia fila, motore acceso. Nessuno scende.
    draw(P) {
      const ctx = P.ctx;
      // Le berline sono nere: quello che le fa vedere è il muro dietro e l'asfalto
      // bagnato sotto, non le auto. Se il fondo è nero, il pannello è vuoto.
      wash(P, '#323844', '#1c212a');
      ctx.fillStyle = '#0e1116';                        // la tettoia
      ctx.fillRect(P.x, P.y, P.w, P.h * 0.16);
      ctx.fillStyle = '#171c25';                        // l'asfalto
      ctx.fillRect(P.x, py(P, 0.66), P.w, P.h * 0.34);
      wetFloor(P, py(P, 0.66), ['#a8bcd4', AMBER], { alpha: 0.3, seed: 12 });
      car(P, px(P, 0.22), py(P, 0.78), P.w * 0.3, '#07080c', { lights: true, wipers: true, glass: '#1b2531' });
      car(P, px(P, 0.54), py(P, 0.84), P.w * 0.32, '#07080c', { lights: true, wipers: true, glass: '#1b2531' });
      car(P, px(P, 0.87), py(P, 0.91), P.w * 0.34, '#07080c', { lights: true, wipers: true, glass: '#1b2531' });
      rain(P, 0.9, { angle: 0.26, speed: 2.2 });
      vignette(P, 0.5);
      narrator(P, 'Fuori dalla camera ardente, in doppia fila.\nTre berline nere, motore acceso. Non scende nessuno.');
    },
  },
  {
    id: 19,
    // SECONDO INDIZIO. È Dulchae. La **mano destra resta in tasca** — il giocatore
    // lo rivedrà con la stessa mano in tasca in M8. La faccia non si vede mai.
    draw(P) {
      const ctx = P.ctx;
      // La fiancata lucida di un'auto sotto la pioggia: grigio medio, non nero. La
      // fessura del finestrino è l'unica cosa nera del pannello, ed è il punto.
      wash(P, '#39414d', '#1e2229');
      const wx = px(P, 0.12), wy = py(P, 0.22), ww = P.w * 0.76, wh = P.h * 0.5;
      ctx.fillStyle = '#252b34';                        // il montante attorno al vetro
      ctx.fillRect(wx - ww * 0.03, wy - wh * 0.06, ww * 1.06, wh * 1.12);
      ctx.fillStyle = '#2f3742';                        // il vetro, risalito per 9/10
      ctx.fillRect(wx, wy + wh * 0.3, ww, wh * 0.7);
      ctx.fillStyle = '#020305';                        // i dieci centimetri di buio
      ctx.fillRect(wx, wy, ww, wh * 0.3);
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx, wy, ww, wh * 0.3);
      ctx.clip();
      // LA MANO DESTRA RESTA IN TASCA. È Dulchae, e torna così in M7 e M8.
      ctx.fillStyle = '#151a21';                        // la spalla, appena fuori dal nero
      ctx.fillRect(wx + ww * 0.06, wy + wh * 0.12, ww * 0.26, wh * 0.22);
      ctx.fillStyle = '#eef1f7';                        // la cartellina, in piena luce
      ctx.fillRect(wx + ww * 0.5, wy + wh * 0.05, ww * 0.32, wh * 0.24);
      ctx.fillStyle = '#1b1b22';
      ctx.font = `700 ${Math.round(P.h * 0.034)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.fillText('한성개발', wx + ww * 0.545, wy + wh * 0.21);
      ctx.fillStyle = '#454d59';                        // la sinistra che la regge
      ctx.fillRect(wx + ww * 0.43, wy + wh * 0.12, ww * 0.09, wh * 0.15);
      ctx.restore();
      // Il riflesso delle insegne sulla lamiera bagnata.
      wetFloor(P, py(P, 0.74), ['#9fb4cc', AMBER], { alpha: 0.16, seed: 31 });
      rain(P, 0.6, { angle: 0.3 });
      vignette(P, 0.55);
      narrator(P, 'Un vetro scende di dieci centimetri. Dentro non si vede una faccia.');
      speech(P, [
        { note: true, text: 'Una mano regge la cartellina di 한성개발. L\'altra resta in tasca. Il vetro risale, e le tre auto partono insieme.' },
      ]);
    },
  },

  // --- Parte quarta — la notte ------------------------------------------------
  {
    id: 20,
    hold: 1.1,                                          // un secondo pieno, e basta
    draw(P) { flat(P, '#000000'); },
  },
  {
    id: 21,
    // Il bomber addosso, di spalle. In fondo al vicolo l'unica insegna accesa.
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#0e0b14', '#06050a');
      block(P, P.x, P.y, P.w * 0.3, P.h * 0.86, '#0c0a12', { lit: 0.14, seed: 6, window: AMBER });
      block(P, px(P, 0.72), P.y, P.w * 0.3, P.h * 0.86, '#0b0910', { lit: 0.1, seed: 14, window: AMBER });
      sign(P, '편의점', px(P, 0.5), py(P, 0.42), { size: P.h * 0.048, color: GREEN, glowR: P.h * 0.34 });
      ctx.fillStyle = '#05060a';
      ctx.fillRect(P.x, py(P, 0.62), P.w, P.h * 0.38);
      wetFloor(P, py(P, 0.62), [GREEN, PINK, AMBER], { alpha: 0.28, seed: 7 });
      // Di spalle, col bomber addosso: è l'unico pannello in cui è giusto non
      // vederlo in faccia, perché quello che si guarda è il giubbotto.
      figure(P, 'jaemin', px(P, 0.46), py(P, 1.04), unitScale(P, 0.62, FIGURE_UNITS), 'back',
        { coat: '#141118' });
      rain(P, 0.55, { angle: 0.22 });
      vignette(P, 0.55);
      // 편의점 torna in quattro pannelli e in tutto il gioco: si traduce qui, una
      // volta sola, e da qui in poi è una parola che il giocatore conosce.
      narrator(P, '01:12. Un vicolo di Hongdae, con il bomber addosso.\nL\'unica insegna accesa è quella del 편의점, il minimarket.');
    },
  },
  {
    id: 22,
    // TERZO INDIZIO, e il più leggero: qualcuno lo ha già visto. Ieri.
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#0d1a16');
      ctx.fillStyle = '#12261f';                         // la luce verde del 편의점
      ctx.fillRect(P.x, P.y, P.w, P.h * 0.86);
      glow(P, px(P, 0.5), py(P, 0.08), P.h * 0.7, GREEN, 0.16);
      for (let i = 0; i < 4; i++) {                      // scaffali
        ctx.fillStyle = 'rgba(9,20,16,0.75)';
        ctx.fillRect(px(P, 0.06 + i * 0.13), py(P, 0.2), P.w * 0.1, P.h * 0.44);
      }
      // Il commesso dietro il banco, che alza gli occhi dal telefono e si
      // irrigidisce un attimo di troppo. La faccia serve tutta: il pannello è il
      // terzo indizio del gioco e sta in un'espressione.
      bust(P, 'commesso', 0.66, { frac: 0.44, base: 0.62, mood: 'parla' });
      ctx.fillStyle = '#0a1512';                         // il banco, davanti a lui
      ctx.fillRect(px(P, 0.46), py(P, 0.62), P.w * 0.54, P.h * 0.38);
      ctx.fillStyle = '#12261f';
      ctx.fillRect(px(P, 0.46), py(P, 0.62), P.w * 0.54, P.h * 0.018);
      // Il telefono da cui ha appena alzato gli occhi.
      ctx.fillStyle = hexA(CYAN, 0.55);
      ctx.fillRect(px(P, 0.57), py(P, 0.55), P.w * 0.022, P.h * 0.045);
      // Jae-min di spalle, in primo piano a sinistra: è lui che sta chiedendo, ma
      // la scena è la faccia del commesso.
      figure(P, 'jaemin', px(P, 0.17), py(P, 1.12), unitScale(P, 0.62, FIGURE_UNITS), 'back',
        { coat: '#141118' });
      vignette(P, 0.5);
      speech(P, [
        { who: 'Commesso', text: '«…di nuovo?»' },
        { who: 'Jae-min', text: '«Come, scusi?»' },
        { who: 'Commesso', text: '(torna al telefono) «Niente. Mi scusi. Milleottocento.»' },
        { note: true, text: 'Ha detto «di nuovo» a uno sceso da un aereo stamattina.' },
      ]);
    },
  },
  {
    id: 23,
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#0c0a11', '#060509');
      ctx.fillStyle = '#101019';                        // la tettoia
      ctx.fillRect(P.x, P.y, P.w, P.h * 0.16);
      sign(P, '편의점', px(P, 0.24), py(P, 0.12), { size: P.h * 0.04, color: GREEN, glowR: P.h * 0.22 });
      ctx.fillStyle = '#08070c';
      ctx.fillRect(P.x, py(P, 0.7), P.w, P.h * 0.3);
      ctx.fillStyle = '#0e0d15';                        // il cordolo
      ctx.fillRect(P.x, py(P, 0.72), P.w * 0.56, P.h * 0.05);
      figure(P, 'jaemin', px(P, 0.24), py(P, 0.98), unitScale(P, 0.62, FIGURE_UNITS), 'curb',
        { coat: '#141118', mood: 'giu' });
      ctx.fillStyle = 'rgba(232,238,246,0.8)';          // il sacchetto accanto
      ctx.fillRect(px(P, 0.38), py(P, 0.6), P.w * 0.055, P.h * 0.12);
      // La volante che rallenta e non si ferma.
      car(P, px(P, 0.74), py(P, 0.88), P.w * 0.3, '#e8edf4', { lights: true });
      ctx.fillStyle = hexA(CYAN, 0.75);
      ctx.fillRect(px(P, 0.71), py(P, 0.79), P.w * 0.025, P.h * 0.018);
      glow(P, px(P, 0.722), py(P, 0.795), P.h * 0.1, CYAN, 0.5);
      poster(P, px(P, 0.56), py(P, 0.24), P.w * 0.13, P.h * 0.22,
        [{ text: '철거예정' }, { text: '한성개발' }], { tilt: -0.05 });
      wetFloor(P, py(P, 0.7), [GREEN, CYAN], { alpha: 0.22, seed: 19 });
      vignette(P, 0.5);
      narrator(P, 'Mangia seduto sul cordolo. Passa una volante, rallenta, non si ferma.');
    },
  },
  {
    id: 24,
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#0d0b12', '#07060a');
      ctx.fillStyle = '#0a0910';
      ctx.fillRect(P.x, py(P, 0.72), P.w, P.h * 0.28);
      // Parcheggiata storta, e con la polvere. Le coordinate passate a `car` sono
      // già ruotate dal contesto, quindi partono da zero: `glow` lavora nello
      // spazio corrente e verrebbe fuori posto con le assolute.
      ctx.save();
      ctx.translate(px(P, 0.5), py(P, 0.78));
      ctx.rotate(0.07);
      car(P, 0, 0, P.w * 0.56, '#1d2733', { dusty: true });
      ctx.restore();
      // La targa.
      const tx = px(P, 0.38), ty = py(P, 0.84);
      ctx.fillStyle = '#e9edf3';
      ctx.fillRect(tx, ty, P.w * 0.16, P.h * 0.058);
      ctx.fillStyle = '#14181f';
      ctx.font = `700 ${Math.round(P.h * 0.036)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('서울 12 나 3104', tx + P.w * 0.08, ty + P.h * 0.042);
      ctx.textAlign = 'left';
      vignette(P, 0.5);
      narrator(P, 'L\'auto di suo padre, ferma da mesi.\nLe chiavi erano nel sacchetto. Il bollo è scaduto da undici.');
    },
  },
  {
    id: 25,
    // La lancetta si sposta **da sola** di mezza tacca. Nessuno la tocca.
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#07090d');
      // Il parabrezza in alto: senza, il cruscotto galleggia nel vuoto.
      wash(P, '#181f2b', '#0c1119', 0.3);
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(P.x, py(P, 0.06), P.w, P.h * 0.06);   // il montante
      sign(P, '편의점', px(P, 0.72), py(P, 0.06), { size: P.h * 0.026, color: GREEN, glowR: P.h * 0.14 });
      ctx.fillStyle = '#2a3038';                         // il cruscotto, grigio medio
      ctx.beginPath();
      ctx.moveTo(P.x, py(P, 0.36));
      ctx.lineTo(px(P, 1), py(P, 0.3));
      ctx.lineTo(px(P, 1), py(P, 1));
      ctx.lineTo(P.x, py(P, 1));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#161b22';                         // la conca degli strumenti
      ctx.fillRect(px(P, 0.08), py(P, 0.38), P.w * 0.36, P.h * 0.28);
      // Il quadro che si accende.
      for (const u of [0.17, 0.33]) {
        ctx.strokeStyle = hexA(AMBER, 0.7);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px(P, u), py(P, 0.52), P.h * 0.09, 0, Math.PI * 2);
        ctx.stroke();
        glow(P, px(P, u), py(P, 0.52), P.h * 0.15, AMBER, 0.3);
        ctx.strokeStyle = hexA(AMBER, 0.9);              // la lancetta a fondo scala
        ctx.beginPath();
        ctx.moveTo(px(P, u), py(P, 0.52));
        ctx.lineTo(px(P, u) - P.h * 0.05, py(P, 0.48));
        ctx.stroke();
      }
      // La radio, e la lancetta che scivola da 91.3 a mezza tacca più in là.
      const slide = Math.min(1, Math.max(0, (P.t - 1.1) / 1.6));
      dial(P, px(P, 0.54), py(P, 0.42), P.w * 0.38, P.h * 0.2,
        { from: 90.5, to: 92.5, mark: 91.3 + slide * 0.05, color: AMBER });
      for (let i = 0; i < 30; i++) {                    // fruscio
        const k = hash(i * 4.1 + Math.floor(P.t * 24));
        ctx.fillStyle = hexA(AMBER, k * 0.14);
        ctx.fillRect(px(P, 0.54 + hash(i * 8.3) * 0.38), py(P, 0.42 + k * 0.2), 2, 1.4);
      }
      vignette(P, 0.55);
      // La lancetta si muove di mezza tacca su un quadrante largo un terzo di
      // pannello: è vero che si vede, ma solo se qualcuno ha detto di guardare.
      narrator(P, 'Chiave girata. Il quadro si accende, e con lui la radio: 91.3.\nPoi la lancetta si sposta di mezza tacca. Nessuno la tocca.');
    },
  },
  {
    id: 26,
    // TERZO INDIZIO SEMINATO QUI, ed è il più pesante: la prima frase di Kkachi.
    // Torna in M4 e in R4. Le sue righe non hanno un nome davanti — hanno il
    // quadrante — e stanno da sole nel pannello.
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#05070a');
      glow(P, px(P, 0.5), py(P, 0.34), P.h * 0.6, AMBER, 0.14);
      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.round(P.h * 0.2)}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = hexA(AMBER, 0.16);
      ctx.fillText('91.45', px(P, 0.5), py(P, 0.36) + 4);
      ctx.fillStyle = AMBER;
      ctx.fillText('91.45', px(P, 0.5), py(P, 0.36));
      ctx.textAlign = 'left';
      for (let i = 0; i < 60; i++) {                    // fruscio a tutto schermo
        const k = hash(i * 2.7 + Math.floor(P.t * 18));
        ctx.fillStyle = hexA(AMBER, k * 0.1);
        ctx.fillRect(px(P, hash(i * 6.1 + Math.floor(P.t * 18))), py(P, 0.08 + k * 0.34), 3, 1.5);
      }
      vignette(P, 0.5);
      // La rivelazione va capita **qui**, non a M4: il referto dice da dove viene
      // il numero, e i due numeri messi in fila dicono il resto senza spiegarlo.
      speech(P, [
        { who: '91.45', kkachi: true, text: '«Seo Jae-min. Sei in Corea da diciotto ore e quaranta minuti.»' },
        { who: 'Jae-min', text: '«Chi parla?»' },
        { who: '91.45', kkachi: true, text: '«Ho detto qualcosa di sbagliato? No. Allora non è quella la domanda.»' },
        { who: 'Jae-min', text: '«…Chi parla.»' },
        { who: '91.45', kkachi: true, text: '«Uno che ha letto il referto.\nNella bara c\'è un uomo di un metro e settantuno. Tuo padre era alto un metro e ottantatré.»' },
      ]);
    },
  },

  // --- Parte quinta — il titolo -----------------------------------------------
  {
    id: 27,
    // I fari accesi, e non parte. In fondo al vicolo il cane del pannello 1.
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#191424', '#0a0812');
      block(P, P.x, P.y, P.w * 0.28, P.h * 0.88, '#0f0b16', { lit: 0.18, seed: 51, window: AMBER });
      block(P, px(P, 0.74), P.y, P.w * 0.28, P.h * 0.88, '#0d0a14', { lit: 0.14, seed: 57, window: AMBER });
      sign(P, '편의점', px(P, 0.5), py(P, 0.34), { size: P.h * 0.038, color: GREEN, glowR: P.h * 0.3 });
      ctx.fillStyle = '#0b0912';
      ctx.fillRect(P.x, py(P, 0.62), P.w, P.h * 0.38);
      // I fari accesi sull'asfalto: sono loro a illuminare il fondo del vicolo, ed
      // è la ragione per cui il cane si vede passare.
      glow(P, px(P, 0.5), py(P, 0.76), P.h * 0.55, AMBER, 0.22);
      wetFloor(P, py(P, 0.62), [GREEN, AMBER, '#8f9fc4'], { alpha: 0.34, seed: 23 });
      car(P, px(P, 0.4), py(P, 0.94), P.w * 0.28, '#0b0e14', { lights: true, glass: '#1c2530' });
      // Il cane, che attraversa in fondo e sparisce. È lo stesso del pannello 1.
      const u = 0.34 + ((P.t * 0.09) % 0.36);
      dog(P, px(P, u), py(P, 0.66), Math.max(1, Math.round(P.h * 0.011)));
      rain(P, 0.6, { angle: 0.24 });
      vignette(P, 0.55);
      narrator(P, 'La frequenza cade. Sulla 91.3 torna una canzone del 1994.\nI fari sono accesi. L\'auto non parte.');
    },
  },
  {
    id: 28,
    // Sopra la sagoma di Seoul all'alba: il Namsan a sinistra, le gru di Gangnam
    // a destra. È lo stesso profilo che il giocatore vedrà dal ponte.
    music: 1.35,                                        // il tema sale: è il titolo
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#20161f', '#3a2430', 0.7);
      ctx.fillStyle = '#4a2b33';
      ctx.fillRect(P.x, py(P, 0.5), P.w, P.h * 0.5);
      glow(P, px(P, 0.68), py(P, 0.56), P.h * 0.6, AMBER, 0.3);
      // Il Namsan, a sinistra.
      ctx.fillStyle = '#150f18';
      ctx.beginPath();
      ctx.moveTo(P.x, py(P, 0.72));
      ctx.quadraticCurveTo(px(P, 0.16), py(P, 0.3), px(P, 0.33), py(P, 0.72));
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(px(P, 0.155), py(P, 0.24), P.w * 0.008, P.h * 0.12);   // la torre
      skyline(P, py(P, 0.74), { color: '#130e16', min: 0.08, max: 0.3, step: 0.05, from: 0.3, to: 1, seed: 61 });
      // Le gru di Gangnam, a destra.
      ctx.strokeStyle = '#130e16';
      ctx.lineWidth = Math.max(2, P.h * 0.008);
      for (const u of [0.78, 0.88]) {
        ctx.beginPath();
        ctx.moveTo(px(P, u), py(P, 0.74));
        ctx.lineTo(px(P, u), py(P, 0.36));
        ctx.lineTo(px(P, u + 0.07), py(P, 0.4));
        ctx.stroke();
      }
      ctx.fillStyle = '#0b070d';
      ctx.fillRect(P.x, py(P, 0.74), P.w, P.h * 0.26);
      ctx.textAlign = 'center';
      ctx.fillStyle = PAPER;
      ctx.font = `900 ${Math.round(P.h * 0.15)}px system-ui, sans-serif`;
      ctx.fillText('SEOUL', px(P, 0.5), py(P, 0.52));
      ctx.fillStyle = PINK;
      ctx.fillText('CRASHERS', px(P, 0.5), py(P, 0.68));
      ctx.fillStyle = hexA(CYAN, 0.85);
      ctx.font = `600 ${Math.round(P.h * 0.042)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.fillText('백호 없는 산 — la montagna senza tigre', px(P, 0.5), py(P, 0.85));
      ctx.textAlign = 'left';
    },
  },
];

// --- il passaggio di consegne --------------------------------------------------

/**
 * Quello che succede appena i pannelli finiscono, saltati o guardati che siano.
 * Il copione lo scrive in fondo a `02-cutscene-iniziale.md`: **stessa auto, stesso
 * vicolo, mattina dopo, `08:24`**. L'ora è già quella con cui la partita comincia
 * (`DayCycle.startHour`), quindi qui restano l'asfalto ancora bagnato, l'auto del
 * padre e la prima riga di Kkachi.
 *
 * La riga arriva **solo se il giocatore accende la radio o sale in macchina**: chi
 * scende e va a piedi non la sente, ed è il modo in cui la scena insegna senza
 * scriverlo da nessuna parte che quella voce sta nel motore.
 */
export function handoff(game) {
  // Ha appena smesso di piovere: l'asfalto si asciuga piano, ed è quello che fa
  // restare i riflessi per i primi minuti di gioco.
  game.dayCycle.wet = 0.6;
  parkFathersCar(game);

  let said = false;
  const say = () => {
    if (said) return;
    said = true;
    offRadio();
    offCar();
    // Kkachi non ha ancora un posto suo in cui parlare: la tabella con predicato e
    // la stazione 91.45 sono la tappa D. Per adesso è un toast, ed è l'unico punto
    // della cutscene che quella tappa dovrà tornare a toccare.
    game.hud.toast('91.45 — «Bene. Adesso mettiamo in ordine. Guida.»', 6);
  };
  const offRadio = game.on('radioOn', (inCar) => { if (inCar) say(); });
  const offCar = game.on('enterVehicle', say);
}

/**
 * La berlina vecchia del pannello 24. Deve stare **dove si sveglia**, non in un
 * vicolo dall'altra parte del quartiere: ci ha dormito dentro.
 *
 * Prima si prova uno stallo di sosta vero e vicino, che è il posto più bello;
 * quasi sempre però i due stalli a portata se li è già presi il `prewarm` del
 * traffico, e il terzo è a un chilometro e mezzo. Allora si accosta al bordo
 * della carreggiata accanto al giocatore, che è quello che fa una macchina
 * lasciata lì la notte prima.
 */
function parkFathersCar(game) {
  const pl = game.player;
  const free = (x, y) => {
    const solids = game.city.solidGrid.queryRect(x - 40, y - 40, 80, 80);
    if (solids.some((o) => circleRectPush(x, y, 22, o))) return false;
    return !game.vehicles.some((v) => Math.hypot(v.x - x, v.y - y) < 74);
  };

  for (const s of game.traffic?.parkingSpots || []) {
    if (s.taken || Math.hypot(s.x - pl.x, s.y - pl.y) > 420 || !free(s.x, s.y)) continue;
    const v = createVehicle('sedan', s.x, s.y, s.angle, 3);
    v.spot = s;
    s.taken = true;
    game.vehicles.push(v);
    return;
  }

  // Accostata al bordo: si cerca la corsia più vicina e ci si mette a fianco.
  const vLine = nearestActiveLine(game.city, 'v', pl.x, pl.y, 260);
  const hLine = nearestActiveLine(game.city, 'h', pl.x, pl.y, 260);
  const tries = [];
  if (vLine) {
    for (const s of [-1, 1]) for (const d of [0, 90, -90]) {
      tries.push({ x: vLine.c + s * (vLine.width * 0.5 - 17), y: pl.y + d, angle: Math.PI / 2 });
    }
  }
  if (hLine) {
    for (const s of [-1, 1]) for (const d of [0, 90, -90]) {
      tries.push({ x: pl.x + d, y: hLine.c + s * (hLine.width * 0.5 - 17), angle: 0 });
    }
  }
  for (const t of tries) {
    if (!free(t.x, t.y)) continue;
    const v = createVehicle('sedan', t.x, t.y, t.angle, 3);
    // Senza `awake` resta addormentata come un'auto in sosta, che va benissimo:
    // è ferma da una notte. Ma senza uno `spot` nessuno la considera occupata,
    // quindi la si lascia sveglia e in mano allo streaming come le altre.
    v.awake = true;
    game.vehicles.push(v);
    return;
  }
}
