// M10 · «자갈치» — Jagalchi
//
// Il copione sta in `docs/storia/05-atto-3.md`. Busan, di giorno: il mercato del pesce, un'officina
// di Sasang e **la corsa in baia sotto il ponte 광안대교**, con le motovedette dietro e l'elicottero
// sopra — «il momento più bello del gioco da guardare», e va costruito come tale: niente dialoghi, solo
// motori. Chiude con i nove oggetti di Nam allineati sul cemento e la prima volta che 까치 si corregge.
//
// Quello che la missione chiede al motore, e che il motore adesso sa (§5.43):
//
//   · **un carico che si porta in barca.** `core/carry.js` c'era (i fogli di M4 si portano in mano e si
//     perdono morendo), ma lasciava cadere l'oggetto **dov'era il giocatore**: in mezzo alla baia, dove
//     nessuno lo raccoglie più. Adesso cade sul punto asciutto più vicino (`carry.landNear`) — per
//     tutte le missioni, non per questa;
//   · **le motovedette che girano attorno alla costa.** `police.driveBoat` inseguiva in linea retta e
//     una prova con la polizia vera ha trovato quello che la T9d non aveva potuto vedere: davanti a
//     una penisola la motovedetta si incastra e il giocatore le semina in tre secondi. Adesso ogni
//     scafo sceglie fra tre rotte quella che ha acqua davanti e lo avvicina di più;
//   · **la chiamata al telefono** (`passenger.say(..., { phone: true })`): è la risata di Jae-min, che
//     arriva dal telefono in barca e non da un sedile.
//
// Scelte che il copione non dice, e vanno dichiarate:
//
//   · **l'ordine delle fasi.** Il copione elenca il prezzo di Nam, poi Ko, poi la corsa. Il carico
//     «dal molo alla baia» **è** la corsa, quindi l'ordine giocato è: il mercato e il prezzo, **Ko**
//     (che vuole essere vista alle quattro e non prima), il carico al molo, la barca, la corsa;
//   · **il carico è la cassa dei nove oggetti** e il resto del carico di Nam: viaggiano insieme, la cassa
//     la ritira chi consegna. È l'unico modo in cui i nove oggetti arrivano su un molo bagnato senza che
//     nessuno li porti in mano per un mare intero;
//   · **«sono le quattro»**: Ko lo dice davvero. L'officina riceve tra le 15:30 e le 17:00, e chi arriva
//     prima o dopo aspetta (`F`) come in M6 — dopo le cinque, il giorno dopo. La corsa comincia quindi
//     sempre in tarda luce, e la baia di giorno è quello che il copione chiede;
//   · **le motovedette sono due, e quattro stelle** (`police`: una per stella oltre la terza). L'elicottero
//     si alza da sé a tre; il ricercato lo mette la missione appena si lascia il molo con la cassa;
//   · **la risata è una chiamata al telefono** e non una cutscene: parte a mille duecento passi dal ponte,
//     dura tre secondi di testo e tre di attesa, e **un colpo prende il motore** quando si è sull'impalcato. Il motore fuori uso è `hp` al 25%: fumo e un quarto di
//     velocità in meno (`topSpeedOf`), che è quanto il motore sa già fare di «colpito»;
//   · **la darsena è il fondo della baia di Suyeong**, a ottocento passi a nord del ponte (il Gwangan
//     separa l'oceano dalla baia): per arrivarci si passa *sotto* l'impalcato, ed è il solo modo. Il blip
//     la dice con una linea retta (come la foce di M4) perché per mare non c'è un itinerario;
//   · **morire in acqua rimette la fase al molo.** La cassa cade a riva (`landNear`), il blip la
//     indica, e si ricomincia dal carico: la corsa non si riprende a metà del mare.
import { panelPhase } from '../core/missions.js';
import { findBusan } from './places.js';
import { createVehicle } from '../entities/vehicle.js';
import { VEHICLE_TYPES } from '../render/sprites.js';
import { dist } from '../core/math.js';
import { oraDetta } from './m9.js';
import {
  CYAN, AMBER,
  px, py, flat, wash, vignette, glow, hexA, hash,
  block, skyline, sign, dial, narrator, speech,
} from '../render/panelkit.js';
import { figure, crowd, unitScale } from '../render/pixelkit.js';

/** L'oggetto che si porta in mano. */
export const CARICO = { id: 'cassa', label: 'la cassa di Nam' };

/** Ko riceve fra le 15:30 e le 17:00: «sono le quattro». */
const KO_DA = 15.5;
const KO_A = 17;
const KO_ORA = 16;
const ARRIVO = 240;
/** Da quanto lontano dal molo si può caricare la cassa. */
const MOLO = 78;
/** Dalla darsena: arrivati. */
const DARSENA = 230;
/** Dopo il colpo lo scafo non scende sotto questi punti: arriva in darsena, fumando. */
const SOGLIA_SCAFO = 22;
/** La risata parte a questa distanza dal ponte, **da sud**: il colpo cade tre secondi dopo, sull'impalcato. */
const RISATA_A = 1250;
/** Da quanto lontano dal molo le motovedette ti vedono. */
const PARTENZA = 380;
/** Tre secondi dopo la risata, un colpo prende il motore. */
const COLPO_DOPO = 3.2;

let ORA = '17:10';

function sites(game) {
  if (M10._sites) return M10._sites;
  const c = game.city;
  const mercato = findBusan(game, 'mercato');
  const officina = findBusan(game, 'officina');
  const moli = findBusan(game, 'moli');
  const ponte = findBusan(game, 'ponte');
  const baia = findBusan(game, 'baia');
  // La darsena: **il fondo della baia di Suyeong**, a nord del ponte. Si parte dall'impalcato e si sale
  // finché c'è acqua; l'ultimo punto bagnato, con un margine di centocinquanta passi dalla riva, è dove la
  // baia è abbastanza larga da girare una barca. La storia non inventa un molo che la baia non ha.
  let darsena = null;
  if (ponte) {
    let y = ponte.y - 120;
    while (y > ponte.y - 1600 && c.isWater(ponte.x, y)) y -= 20;
    const fondo = y + 20 + 150;
    if (c.isWater(ponte.x, fondo)) darsena = { x: ponte.x, y: fondo };
  }
  M10._sites = { mercato, officina, moli, ponte, baia, darsena };
  return M10._sites;
}

const ok = (s) => s.mercato && s.officina && s.moli && s.ponte && s.darsena;

/**
 * Il motoscafo **ormeggiato** più vicino al molo, non un battello: il copione chiede una barca che
 * corra. Ormeggiato perché è l'unico che si raggiunge a piedi — quello con cui si è fallito è rimasto
 * alla deriva in mezzo alla baia.
 */
function barcaVicina(game, near) {
  let best = null;
  let bestD = Infinity;
  for (const v of game.vehicles) {
    if (v.dead || v.kind !== 'boat' || !v.moored) continue;
    const d = (v.x - near.x) ** 2 + (v.y - near.y) ** 2;
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

function sulMare(game) {
  const pl = game.player;
  return !pl.onFoot && !!pl.vehicle && !!VEHICLE_TYPES[pl.vehicle.kind]?.marine;
}

// --- i pannelli ----------------------------------------------------------------------------------

/**
 * I nove oggetti. **Gemelli di quelli di Jo** (`m2.js`, pannello 5): stesse tinte, stessa fila, ma non le
 * stesse forme — sono altri nove, e il giocatore deve poterli confrontare. `lineup` li mette in fila su
 * un piano; senza, stanno dentro una cassa.
 */
const OGGETTI = ['#8fa3b8', '#a8895c', '#c8b98d', '#7d8b6a', '#b06a5c', '#9a94a2', '#c9a24a', '#6f7d90', '#a39178'];

function oggetto(P, x, y, w, h, i) {
  const ctx = P.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 3, y + 4, w, h);
  ctx.fillStyle = OGGETTI[i];
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x, y, w * 0.3, h);
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  // Ognuno ha il suo segno: non sono nove scatole.
  if (i % 3 === 0) ctx.fillRect(x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.12);
  else if (i % 3 === 1) ctx.fillRect(x + w * 0.4, y, w * 0.2, h);
  else { ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.4, w * 0.22, 0, Math.PI * 2); ctx.fill(); }
}

export const APERTURA = [
  {
    // Il mercato. Le vasche, il ghiaccio, le luci gialle e le donne che urlano i prezzi: tante
    // sagome, nessuna faccia, e sopra le vasche le insegne.
    id: 'm10-1',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#3a3320', '#17130c', 1);
      glow(P, px(P, 0.5), py(P, 0.1), P.h * 0.8, '#ffd36a', 0.42);
      // Le lampade gialle, in fila, e i teli sopra i banchi.
      for (let i = 0; i < 6; i++) {
        glow(P, px(P, 0.08 + i * 0.17), py(P, 0.13), P.h * 0.22, '#ffe08a', 0.55);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillRect(px(P, 0.08 + i * 0.17) - 4, py(P, 0.12), 8, 5);
      }
      // Le vasche: rettangoli d'acqua verde con le sagome dei pesci.
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < 4; i++) {
          const x = px(P, 0.04 + i * 0.24);
          const y = py(P, 0.3 + r * 0.22);
          const w = P.w * 0.2;
          const h = P.h * 0.15;
          ctx.fillStyle = '#d9d4c4';
          ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
          ctx.fillStyle = r ? '#2f7d86' : '#2a6f7a';
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(x, y, w, h * 0.2);
          for (let f = 0; f < 5; f++) {
            ctx.fillStyle = hexA(['#e9e4d2', '#d9a05a', '#8ab6b8', '#c4605a'][f % 4], 0.8);
            ctx.beginPath();
            ctx.ellipse(x + w * (0.12 + hash(i * 7 + r * 3 + f) * 0.76), y + h * (0.3 + hash(f * 5 + i) * 0.5), w * 0.05, h * 0.09, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // Il ghiaccio, in basso: una fascia bianca e sfaldata.
      ctx.fillStyle = '#d8e4ea';
      ctx.fillRect(P.x, py(P, 0.78), P.w, P.h * 0.22);
      ctx.fillStyle = 'rgba(160,190,205,0.5)';
      for (let i = 0; i < 30; i++) ctx.fillRect(px(P, hash(i * 3.3)), py(P, 0.78 + hash(i * 7.1) * 0.2), P.w * 0.03, P.h * 0.012);
      // Le insegne.
      sign(P, '자갈치', px(P, 0.5), py(P, 0.2), { size: Math.round(P.h * 0.07), color: '#ffcf4a', glowR: 80 });
      sign(P, '횟집', px(P, 0.14), py(P, 0.2), { size: Math.round(P.h * 0.045), color: '#ff7a5a', glowR: 40 });
      // La gente, a mezza altezza: sagome senza faccia che urlano un prezzo.
      crowd(P, px(P, 0.5), py(P, 1.04), unitScale(P, 0.3, 36), 9, { tint: '#3c3022', spread: 17, seed: 9, crop: 30 });
      vignette(P, 0.4);
      narrator(P, 'Il mercato del pesce di 자갈치, a Busan.');
    },
  },
  {
    // Nam, **in fondo, che pulisce un coltello e non alza la testa**. Il narratore lo presenta una volta
    // sola e in chiaro; poi le prime due battute.
    id: 'm10-2',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#2e291c', '#0f0d08', 1);
      glow(P, px(P, 0.7), py(P, 0.3), P.h * 0.6, '#ffd36a', 0.3);
      // Il banco di lavoro, di zinco, con il ghiaccio.
      ctx.fillStyle = '#7e8a90';
      ctx.fillRect(px(P, 0.4), py(P, 0.5), P.w * 0.58, P.h * 0.1);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(px(P, 0.4), py(P, 0.5), P.w * 0.58, P.h * 0.02);
      const k = unitScale(P, 0.5, 42);
      const f = figure(P, 'nam', px(P, 0.82), py(P, 0.58), k, 'stand', { crop: 42, mood: 'giu' });
      // Il coltello, in mano, a lama in giù: un tratto chiaro e il panno.
      ctx.fillStyle = '#d7dde4';
      ctx.fillRect(f.x + k * 2, f.y + k * 36, k * 12, k * 1.2);
      ctx.fillStyle = '#9a7a4a';
      ctx.fillRect(f.x + k * 14, f.y + k * 35.4, k * 4, k * 2.4);
      vignette(P, 0.5);
      narrator(P, '남지욱 · Nam Ji-uk, 흑사파, il Serpente Nero.\nA Busan il contrabbando è suo.');
      speech(P, [
        { who: 'Nam', text: '«Suo padre mi ha mandato una cassa nove anni fa e mi ha detto di non aprirla.»' },
        { who: 'Jae-min', text: '«L\'ha aperta?»' },
      ]);
    },
  },
  {
    // La risposta di Nam. Una battuta sola, lunga, e il suo viso: è la frase che dice chi è.
    id: 'm10-3',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#2e291c', '#0f0d08', 1);
      glow(P, px(P, 0.5), py(P, 0.28), P.h * 0.6, '#ffd36a', 0.28);
      const k = unitScale(P, 0.52, 36);
      figure(P, 'nam', px(P, 0.5), py(P, 0.55), k, 'stand', { crop: 36, mood: 'parla' });
      vignette(P, 0.5);
      speech(P, [
        { who: 'Nam', text: '«Certo che l\'ho aperta. Sono un contrabbandiere, non un santo. L\'ho aperta, ho letto, l\'ho richiusa e da nove anni dormo peggio.»' },
      ]);
    },
  },
  {
    // **La cassa**, di legno, con i nove oggetti dentro. La nota dice dove guardare.
    id: 'm10-4',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#241f17', '#0c0a07', 1);
      // La cassa vista dall'alto e di tre quarti: il bordo di assi, e dentro la paglia.
      const x = px(P, 0.14);
      const y = py(P, 0.44);
      const w = P.w * 0.72;
      const h = P.h * 0.26;
      ctx.fillStyle = '#7a5a36';
      ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
      ctx.fillStyle = '#a07a48';
      for (let i = 0; i < 4; i++) ctx.fillRect(x - 10, y - 10 + i * (h + 20) / 4, w + 20, 2);
      ctx.fillStyle = '#c9b68a';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 26; i++) ctx.fillRect(x + hash(i * 3.7) * w, y + hash(i * 9.1) * h, w * 0.04, 2);
      // I nove oggetti, **in tre file da tre**: si devono poter contare.
      for (let i = 0; i < 9; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const ow = w * 0.2;
        const oh = h * 0.2 + hash(i * 5.3) * h * 0.08;
        oggetto(P, x + w * (0.08 + col * 0.31), y + h * (0.07 + row * 0.3), ow, oh, i);
      }
      vignette(P, 0.45);
      narrator(P, 'Nove oggetti. Sono i gemelli dei nove che Jo Ok-bun tiene in fondo allo scaffale, a Hongdae.');
      speech(P, [{ text: 'Uno per uno non valgono niente. Sono diciotto in tutto, e nessuno dei due mazzi da solo si legge.', note: true }]);
    },
  },
];

/** La darsena, vista di lato: cemento, acqua nera d'olio, e il ponte lontano. */
function darsenaFondo(P, ora) {
  const ctx = P.ctx;
  wash(P, '#8fb0c8', '#d8cdb4', 0.55);
  // Il ponte in lontananza: l'impalcato e due piloni, sfocati.
  ctx.fillStyle = hexA('#c9d3da', 0.7);
  ctx.fillRect(px(P, 0.0), py(P, 0.4), P.w, P.h * 0.016);
  for (const u of [0.22, 0.58]) ctx.fillRect(px(P, u), py(P, 0.2), P.w * 0.012, P.h * 0.2);
  skyline(P, py(P, 0.5), { color: '#667781', min: 0.05, max: 0.14, step: 0.045, seed: 17 });
  ctx.fillStyle = '#2f5668';
  ctx.fillRect(P.x, py(P, 0.5), P.w, P.h * 0.3);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let i = 0; i < 14; i++) ctx.fillRect(px(P, hash(i * 3.1)), py(P, 0.52 + hash(i * 5.3) * 0.26), P.w * 0.05, 2);
}

export const CHIUSURA = [
  {
    // **La barca che entra in una darsena, storta, con il fumo.** Il fumo è il motore: un pennacchio nero
    // che sale dalla poppa, e la scia che non è dritta.
    id: 'm10-5',
    draw(P) {
      const ctx = P.ctx;
      darsenaFondo(P);
      // Il molo di cemento a destra, con una bitta.
      ctx.fillStyle = '#9b968a';
      ctx.fillRect(px(P, 0.62), py(P, 0.66), P.w * 0.38, P.h * 0.34);
      ctx.fillStyle = '#6e6a60';
      ctx.fillRect(px(P, 0.62), py(P, 0.66), P.w * 0.38, P.h * 0.03);
      // Lo scafo, di taglio e **inclinato**: sta imbarcando da una parte.
      ctx.save();
      ctx.translate(px(P, 0.4), py(P, 0.6));
      ctx.rotate(-0.2);
      ctx.fillStyle = '#e8e6df';
      ctx.beginPath();
      ctx.moveTo(-P.w * 0.2, -P.h * 0.02);
      ctx.lineTo(P.w * 0.22, -P.h * 0.05);
      ctx.lineTo(P.w * 0.17, P.h * 0.07);
      ctx.lineTo(-P.w * 0.16, P.h * 0.07);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c0463a';
      ctx.fillRect(-P.w * 0.16, P.h * 0.03, P.w * 0.33, P.h * 0.012);
      ctx.fillStyle = '#2c3c4a';
      ctx.fillRect(-P.w * 0.02, -P.h * 0.12, P.w * 0.12, P.h * 0.08);
      ctx.restore();
      // Il fumo del motore: cerchi grigi che si allargano e si schiariscono.
      for (let i = 0; i < 9; i++) {
        const t = i / 9;
        const wob = Math.sin(P.t * 1.4 + i) * P.w * 0.01;
        ctx.fillStyle = `rgba(${40 + t * 90},${40 + t * 90},${44 + t * 90},${(0.7 - t * 0.55).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(px(P, 0.2) - t * P.w * 0.08 + wob, py(P, 0.5) - t * P.h * 0.34, P.h * (0.04 + t * 0.07), 0, Math.PI * 2);
        ctx.fill();
      }
      vignette(P, 0.4);
      narrator(P, `${ORA}. La darsena sotto il 광안대교.`);
    },
  },
  {
    // I nove oggetti **allineati sul cemento, bagnati**. Nessuna persona: soltanto la fila.
    id: 'm10-6',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#3b4047', '#1a1d22', 1);
      // Il cemento, con le pozze.
      ctx.fillStyle = '#4a4f57';
      ctx.fillRect(P.x, py(P, 0.42), P.w, P.h * 0.58);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(120,150,175,0.22)';
        ctx.beginPath();
        ctx.ellipse(px(P, 0.12 + i * 0.19), py(P, 0.8 + hash(i * 3) * 0.1), P.w * 0.08, P.h * 0.03, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 9; i++) {
        const w = P.w * 0.074;
        const h = P.h * (0.1 + hash(i * 5.3) * 0.09);
        const x = px(P, 0.07 + i * 0.1);
        const y = py(P, 0.62);
        oggetto(P, x, y - h, w, h, i);
        // L'acqua addosso: un velo lucido e il riflesso sotto.
        ctx.fillStyle = 'rgba(190,215,235,0.2)';
        ctx.fillRect(x, y - h, w, h * 0.4);
        ctx.fillStyle = 'rgba(190,215,235,0.1)';
        ctx.fillRect(x, y + 2, w, h * 0.5);
      }
      vignette(P, 0.5);
      narrator(P, 'Nove oggetti sul cemento. Sono bagnati.');
    },
  },
  {
    // Il quadrante, che **prende male**: il fruscio è più alto del solito (`bed`), e il segnale non
    // tiene la tacca. Le battute sono tre in due tavole, la stessa regola di tutto il copione.
    id: 'm10-7',
    bed: { kkachi: 0.055 },
    draw(P) {
      flat(P, '#06080c');
      glow(P, px(P, 0.5), py(P, 0.34), P.h * 0.55, AMBER, 0.12);
      // Il segnale ballerino: la lancetta fuori di poco, sempre.
      const mark = 91.45 + Math.sin(P.t * 3.1) * 0.05 + Math.sin(P.t * 11) * 0.02;
      dial(P, px(P, 0.16), py(P, 0.1), P.w * 0.68, P.h * 0.26, { from: 90, to: 93, mark, label: '91.45' });
      // Il fruscio, in barre che saltano.
      const ctx = P.ctx;
      ctx.fillStyle = hexA(CYAN, 0.4);
      for (let i = 0; i < 24; i++) {
        const x = px(P, 0.16) + hash(i * 7.7 + Math.floor(P.t * 12)) * P.w * 0.68;
        ctx.fillRect(x, py(P, 0.4) + hash(i * 3.1) * P.h * 0.02, P.w * 0.02 * (1 + hash(i)), 2);
      }
      vignette(P, 0.4);
      speech(P, [
        // origine: Jo, M2 — «Mi ricordo chi, quanto, e a chi». Il peso, e l'ordine, sono suoi: Kkachi li ripete.
        { who: '91.45', kkachi: true, text: '«Mettili in fila. Prima quello che pesa meno.»' },
        { who: 'Jae-min', text: '«E in fila cosa vengono?»' },
        // origine: Jo, M2 («Nel quartiere non c\'è un libro dei debiti: ci sono gli scaffali, e ci sono io»).
        { who: '91.45', kkachi: true, text: '«Un indirizzo. È così che si tiene un registro che non si può sequestrare: gli oggetti stanno da una parte e l\'ordine sta in testa a qualcuno.»' },
      ]);
    },
  },
  {
    // **La correzione.** La voce si accorge di aver detto «io» al posto di «lui»: è la prima volta, e
    // lo fa altre quattro, sempre più spesso. Il silenzio dopo «io» è tenuto (`hold`).
    id: 'm10-8',
    hold: 3.5,
    bed: { kkachi: 0.05 },
    draw(P) {
      flat(P, '#06080c');
      glow(P, px(P, 0.5), py(P, 0.34), P.h * 0.55, AMBER, 0.1);
      dial(P, px(P, 0.16), py(P, 0.1), P.w * 0.68, P.h * 0.26, { from: 90, to: 93, mark: 91.45, label: '91.45' });
      vignette(P, 0.45);
      speech(P, [
        { who: 'Jae-min', text: '«E l\'ordine come lo sai tu?»' },
        // origine: Dong-hyeok, 12 visite al banco di Jo — i nove oggetti li ha portati lui (`01-personaggi.md`).
        { who: '91.45', kkachi: true, text: '«Perché li ho portati io.»' },
        { text: '(pausa)', note: true },
        { who: '91.45', kkachi: true, text: '«Perché li ha portati lui.»' },
      ]);
    },
  },
];

// --- la corsa -------------------------------------------------------------------------------------

/**
 * La corsa comincia: quattro stelle (due motovedette e, da sole, l'elicottero), il blip sulla darsena e
 * una linea retta — per mare non c'è un itinerario (§5.30). Si fa una volta sola per tentativo.
 */
function partiti(ctx) {
  const game = ctx.game;
  const st = ctx.state;
  const s = sites(game);
  game.wanted.add(Math.max(0, 92 - game.wanted.heat), game);
  game.audio?.ui('deny');
  ctx.toast('경비정 — le motovedette ti hanno visto', 3.4);
  ctx.mark(s.darsena.x, s.darsena.y, { label: '부두' });
}

// --- la missione ----------------------------------------------------------------------------------

export const M10 = {
  id: 'm10',
  title: 'Jagalchi',
  hangul: '자갈치',
  act: 3,
  _sites: null,

  prepare(game) {
    const s = sites(game);
    // Ko sta davanti alla sua officina, come Pyo davanti al suo cortile: un attore di strada.
    if (s.officina) {
      game.actors.define('ko', {
        x: s.officina.x + 46, y: s.officina.y + 20, kind: 'civil', name: 'Ko Eun-bi', hangul: '고은비', angle: Math.PI,
      });
    }
  },

  phases: [
    {
      // Il messaggio. **Una cassa che non è pesce**: è il copione, parola per parola.
      id: 'messaggio',
      hint: 'Un messaggio di Nam Ji-uk',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!ok(s)) { ctx.next(); return; }
        ctx.unmark();
        ctx.talk([
          { text: 'Un messaggio, da un numero di Busan. Nessun nome.' },
          { who: 'Messaggio', text: '«Ho una cassa che non è pesce. 자갈치, quando vuole. N.»' },
        ], () => ctx.next());
      },
    },

    {
      id: 'viaggio',
      hint: 'Il mercato di 자갈치',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.mercato.approach.x, s.mercato.approach.y, { label: '자갈치' });
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        const pl = ctx.game.player;
        if (ctx.game.indoors) return;
        if (dist(pl.x, pl.y, s.mercato.approach.x, s.mercato.approach.y) < ARRIVO) ctx.next();
      },
    },

    panelPhase('m10-apertura', APERTURA),

    {
      // **Il prezzo di Nam.** Non vuole soldi: vuole che il carico di stasera arrivi.
      id: 'prezzo',
      hint: 'Nam Ji-uk',
      enter(ctx) {
        ctx.unmark();
        ctx.talk([
          { who: 'Nam', text: '«Non voglio soldi, signor Seo. Voglio che il carico di stasera arrivi.»' },
          { who: 'Jae-min', text: '«Dove?»' },
          { who: 'Nam', text: '«Dal molo di 남포동 alla darsena sotto il ponte. Poche miglia d\'acqua e un ponte in mezzo: la guardia costiera lo sa quanto lo so io.»' },
          { who: 'Nam', text: '«La cassa di suo padre viaggia con il resto. La ritira là, e non prima.»' },
          { who: 'Nam', text: '«Prima passi da Ko, a 사상. Monta le gomme come vende le notizie: a chiunque. Non le dica niente che non vuole sapere a Seoul.»' },
        ], () => ctx.next());
      },
    },

    {
      // **Ko Eun-bi.** L'officina che smonta un'auto in undici minuti e che non tradisce nessuno — il che
      // la rende inutilizzabile: vende a tutti, quindi entro sera anche Hanseong sa che Jae-min è a Busan.
      id: 'officina',
      hint: 'L\'officina di Ko Eun-bi, a 사상 — alle quattro',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        ctx.mark(s.officina.x, s.officina.y, { label: '사상' });
        const nellaFinestra = (g) => g.dayCycle.hour >= KO_DA && g.dayCycle.hour < KO_A;
        // Si aspetta l'ora con un tasto, come per Mi-rae e per Ryu: il blip porta dove si aspetta.
        ctx.point({
          id: 'aspetta', key: 'F', onFoot: false, text: 'aspetta che sia ora: Ko riceve alle quattro', reach: 360,
          x: s.officina.x, y: s.officina.y,
          when: (g) => !nellaFinestra(g),
          // `waitUntil` porta sempre **alla prossima** ora indicata: dopo le cinque è quella di domani.
          run: (c) => { c.waitUntil(KO_ORA); },
        });
        ctx.point({
          id: 'ko', key: 'E', text: 'parla con Ko', reach: 96,
          x: s.officina.x + 46, y: s.officina.y + 56,
          when: nellaFinestra,
          run: (c) => {
            c.talk([
              { text: '고은비 · Ko Eun-bi, 철마파. Compra e vende informazioni come le gomme: a chiunque paghi.' },
              { text: 'Ha già sollevato la berlina sul ponte e smonta una ruota prima che si dica niente.' },
              { who: 'Ko', text: '«Alle sei devo dire a 한성개발 che lei è a Busan. Pagano come paga lei, e io non scelgo.» (avvita) «Sono le quattro. Vada piano verso una cosa veloce.»' },
            ], () => {
              c.flag('hanseongSa');
              c.next();
            });
          },
        });
      },
    },

    {
      // **Il carico.** Il molo di Nampo, la cassa: si carica a piedi e si porta in mano, come i fogli di M4.
      id: 'carico',
      hint: 'Il carico di stasera, al molo di 남포동',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        const dropped = game.carry.dropped;
        if (dropped && dropped.item.id === CARICO.id) {
          ctx.mark(dropped.x, dropped.y, { label: '상자' });
          ctx.say('La cassa è rimasta a riva: torna a prenderla');
          return;
        }
        ctx.mark(s.moli.x, s.moli.y, { label: '남포동' });
        ctx.point({
          id: 'carica', key: 'E', text: 'carica la cassa', reach: MOLO,
          x: s.moli.x, y: s.moli.y,
          run: (c) => {
            if (c.game.carry.has(CARICO.id)) return;
            c.game.carry.take(c.game, CARICO);
          },
        });
      },
      tick(dt, ctx) {
        const game = ctx.game;
        if (game.carry.has(CARICO.id)) ctx.next();
      },
    },

    {
      // La barca. Un motoscafo ormeggiato lì vicino; se non c'è, ne spunta uno alla testata del molo.
      id: 'barca',
      hint: 'Prendi una barca: la cassa è in mano',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        let b = barcaVicina(game, s.moli);
        if (!b || Math.hypot(b.x - s.moli.x, b.y - s.moli.y) > 900) {
          // Nessun motoscafo ormeggiato nei paraggi (o rovinato): se ne mette uno alla testata del molo,
          // in acqua, e ci si sale come sugli altri.
          const spot = [[0, -120], [0, 120], [140, -110], [-140, 110]]
            .map(([dx, dy]) => ({ x: s.moli.x + dx, y: s.moli.y + dy }))
            .find((p) => game.city.isWater(p.x, p.y));
          if (spot) {
            b = createVehicle('boat', spot.x, spot.y, 0, 0);
            b.moored = true;
            game.vehicles.push(b);
          }
        }
        M10._barca = b;
        if (b) ctx.mark(b.x, b.y, { label: '배' });
      },
      tick(dt, ctx) {
        const game = ctx.game;
        if (!game.carry.has(CARICO.id)) { ctx.goto('carico'); return; }
        const b = M10._barca;
        if (!sulMare(game) && b && !b.dead) ctx.mark(b.x, b.y, { label: '배' });
        if (sulMare(game)) ctx.next();
      },
    },

    {
      // **La corsa in baia.** Niente dialoghi, solo motori. Sotto il ponte, con le motovedette dietro e
      // l'elicottero sopra. Chi perde la cassa (morendo) torna al molo.
      id: 'corsa',
      hint: 'Alla darsena sotto il ponte: passa sotto il 광안대교',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        ctx.state.risata = 0;
        ctx.state.colpo = 0;
        ctx.state.stelle = false;
        ctx.mark(s.darsena.x, s.darsena.y, { label: '부두' });
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const st = ctx.state;
        const s = sites(game);
        const pl = game.player;
        if (!game.carry.has(CARICO.id)) { ctx.goto('carico'); return; }
        if (game.indoors) return;
        // Se si è scesi dalla barca (a riva), la corsa non è finita: si risale.
        if (!sulMare(game)) { ctx.goto('barca'); return; }
        // Le motovedette si accorgono di te **fuori dal molo**, non sulla soglia: le volanti nascono alla
        // testata più vicina (`police.spawnBoat`), e a due isolati d'acqua dalla partenza sarebbero
        // davanti e non dietro. A quattrocento passi dal molo comincia la corsa.
        if (!st.stelle && dist(pl.x, pl.y, s.moli.x, s.moli.y) > PARTENZA) { st.stelle = true; partiti(ctx); }
        // **La risata**: appena si è sotto l'impalcato Chun-sik chiama e chiede se ha mangiato. Jae-min
        // ride — è la seconda e ultima volta nel gioco. Tre secondi dopo, un colpo prende il motore.
        if (!st.risata && pl.y > s.ponte.y - 120 && dist(pl.x, pl.y, s.ponte.x, s.ponte.y) < RISATA_A) {
          st.risata = 1;
          st.t = 0;
          game.passenger.say([
            { who: 'Chun-sik', text: '«Ragazzo. Hai mangiato?»' },
            { who: 'Jae-min', text: '(ride)', hold: 3.2 },
          ], { phone: true, front: true });
        } else if (st.risata === 1) {
          st.t += dt;
          if (st.t > COLPO_DOPO) {
            st.risata = 2;
            const v = pl.vehicle;
            if (v) {
              const tetto = v.maxHp * 0.25;
              if (v.hp > tetto) game.damageVehicle(v, v.hp - tetto, v.x, v.y, null);
              game.camera.addShake(10);
            }
          }
        }
        // **Il colpo è del copione, e la barca arriva.** Dopo, con due motovedette e un elicottero addosso,
        // un motore al 25% non reggerebbe tre secondi: la scena chiede una darsena e una barca storta con
        // il fumo, non un secondo fallimento. Lo scafo resta sopra la soglia finché non si arriva.
        if (st.risata === 2 && pl.vehicle && pl.vehicle.hp < SOGLIA_SCAFO) pl.vehicle.hp = SOGLIA_SCAFO;
        // Arrivati: il motore tace, le stelle cadono, e i pannelli sono quelli della tavola dopo.
        if (dist(pl.x, pl.y, s.darsena.x, s.darsena.y) < DARSENA) {
          game.wanted.reset();
          game.police.standDown(game, true);
          ORA = oraDetta(game.dayCycle);
          ctx.next();
        }
      },
    },

    panelPhase('m10-chiusura', CHIUSURA),
  ],

  finish(game) {
    game.carry.clear();
    game.actors.undefine('ko');
    game.missions.setFlag('nove');
    game.hud.toast('자갈치 — completata', 3.4);
  },
};
