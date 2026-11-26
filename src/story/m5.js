// M5 · «Il cortile del Bue Giallo» — 황소의 마당
//
// Il copione sta in `docs/storia/04-atto-2.md`. Un cortile di Gangnam, primo
// pomeriggio, sereno: Pyo Man-deok non presta soldi — presta **un mese in cui nessuno
// viene a bussare** — e in cambio vuole indietro tre cortili che si è lasciato portare
// via dal 철마파.
//
// Questa missione **non scrive niente di quello che fa una `claim`** (§5.31): il tag a
// terra, il banco che cambia mestiere, la busta che si mette da parte e il salvataggio
// sono di `turfs.claim`. Quello che fa M5 è **contare fino a tre** e scegliere come si
// arriva a ciascuna. Delle tre strade del copione le prime due sono già meccanica di
// città — sgombrare il cortile e restarci sei secondi (`force`), comprare il
// capocortile (`deal`) — e la terza, **portargli via il lavoro**, è una fase di questa
// missione che finisce con una `claim` (`work`):
//
//   · nel cortile compaiono tre auto, ferme, di quelle che il 철마파 stava smontando;
//   · chi le porta via e le **rivende** (al 전당포, o a un banco dei 철마파: è lo stesso
//     `sellVehicle`, che dal §5.40 manda `vehicleSold` sul bus) le toglie dal cortile;
//   · alla terza il cortile resta senza lavoro e il padrone se ne va da solo.
//
// Tre scelte che non sono nel copione, e vanno dichiarate:
//
//   · **i tre cortili non esistono come «del 철마파».** Seoul ne ha uno solo di quella
//     banda (la seed è quella, e la maglia non si tocca): gli altri due che la storia
//     chiama «del 철마파» sono i due degli 흑사파 e li prende il 철마파 **all'inizio
//     della missione**, con una `claim` di tipo `war` — la stessa che farebbe una guerra
//     fra bande. È la stessa cosa che dice Pyo («me li sono lasciati prendere») e non
//     costa un `rng`;
//   · **Pyo non paga in contanti**, e il copione dice «Soldi non te ne do»: quello che
//     «paga» è la proroga, una ricevuta (flag `proroga`). Nessuna missione la legge,
//     ancora: è un fatto della storia come `busta` e `bara`;
//   · **il cortile di Pyo sta dov'è la seed lo mette**, che a Seoul è Myeongdong e non
//     Gangnam come scrive il copione: la storia cerca, non piazza (§5.29).
import { panelPhase } from '../core/missions.js';
import { findShop, findTurf } from './places.js';
import { PLAYER_GANG } from '../entities/turfs.js';
import { createVehicle } from '../entities/vehicle.js';
import { dist } from '../core/math.js';
import {
  px, py, wash, vignette, glow, hexA, hash,
  block, sign, narrator, speech,
} from '../render/panelkit.js';
import { figure, head, crowd, unitScale } from '../render/pixelkit.js';

/** I cortili da riprendere: il numero su cui conta la missione. */
const CORTILI = 3;
/** Quante auto «da smontare» sta dentro ogni cortile del 철마파. */
const AUTO_PER_CORTILE = 3;
/** A che distanza dal cortile nascono le auto. Più vicino di questo non si vede nascere. */
const RAGGIO_AUTO = 900;
/** Da dove comincia la scena con Pyo. */
const INGRESSO = 170;
/** Quanto bisogna allontanarsi dal cortile perché il ragazzo ti saluti. */
const USCITA = 210;
/** Quante volte si può morire nella fase dei cortili prima che Pyo se ne accorga. */
const MORTI_PER_PYO = 3;
const KINDS = ['sedan', 'hatch', 'suv'];

function sites(game) {
  if (M5._sites) return M5._sites;
  const from = game.city.spawn;
  // Lo stesso 당구장 di M1 e R1: Chun-sik sta lì, ed è lì che finisce l'Atto I.
  const pool = findShop(game, 'billiards', { district: 'hongdae', near: from });
  const pyo = findTurf(game, 'hwangso', from);
  M5._sites = { pool, pyo };
  return M5._sites;
}

// --- i tre cortili -------------------------------------------------------------------

/**
 * Quelli che **potrebbero** essere del 철마파: nati di un'altra banda che non sia né la
 * Tigre Bianca (quelli non rispondono a Jae-min, §5.31) né il Bue Giallo (è il cortile
 * di Pyo). Si ordinano per distanza da Pyo: sono tre, e la scelta si ricorda nel
 * taccuino della missione, così una ripresa o un caricamento non ne cambiano uno.
 */
function candidati(game) {
  const s = sites(game);
  return (game.city.turfs || [])
    .filter((t) => game.city.areaAt?.(t.cx, t.cy)?.id === 'seoul'
      && t.gang0 !== 'baekho' && t.gang0 !== 'hwangso' && t !== s.pyo?.turf)
    .sort((a, b) => (s.pyo ? dist(a.cx, a.cy, s.pyo.x, s.pyo.y) - dist(b.cx, b.cy, s.pyo.x, s.pyo.y) : 0));
}

function scegli(game, st) {
  if (st.targets) return;
  st.targets = candidati(game).slice(0, CORTILI).map((t) => t.key);
}

function bersagli(game, st) {
  return (st.targets || []).map((k) => game.city.turfs.find((t) => t.key === k)).filter(Boolean);
}

const presa = (st, key) => (st.presi || []).includes(key);

/** Il cortile più vicino a `pl` fra quelli che restano. */
function prossimo(game, st) {
  const pl = game.player;
  let best = null;
  let bestD = Infinity;
  for (const t of bersagli(game, st)) {
    if (presa(st, t.key)) continue;
    const d = dist(pl.x, pl.y, t.cx, t.cy);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

/** Il blip sul cortile rimasto più vicino: la decisione §3, con tre obiettivi. */
function mira(ctx) {
  const t = prossimo(ctx.game, ctx.state);
  if (!t) return;
  ctx.mark(t.cx, t.cy, { label: '철마파' });
  const n = (ctx.state.presi || []).length;
  ctx.say(`Tre cortili del 철마파: con la forza, comprandoli o portandogli via le auto — ${n}/${CORTILI}`);
}

// --- le auto da smontare (la terza strada) ----------------------------------------------

/** Toglie le auto che il giocatore non ha toccato. Una missione non lascia lamiere. */
function sgombera(game, key = null) {
  for (const k of Object.keys(M5._auto)) {
    if (key && k !== key) continue;
    for (const v of M5._auto[k]) {
      if (v.driver === 'player') continue;
      const i = game.vehicles.indexOf(v);
      if (i >= 0) game.vehicles.splice(i, 1);
    }
    delete M5._auto[k];
  }
}

/**
 * Le auto ferme nel cortile, fra i due fianchi e **mai nello stesso posto**: tre
 * sagome in fila nel mezzo, di quelle che tengono il lavoro di una banda. Nascono
 * quando il giocatore si avvicina, e se una viene rovinata o abbandonata lontano ne
 * nasce un'altra finché non ne sono state **vendute** tre: il conto è delle vendite,
 * non delle auto, o chi ne distrugge una resterebbe senza modo di finire.
 */
function curaAuto(ctx) {
  const game = ctx.game;
  const st = ctx.state;
  const pl = game.player;
  if (game.indoors) return;
  st.pezzi = st.pezzi || {};
  for (const t of bersagli(game, st)) {
    if (presa(st, t.key) || dist(pl.x, pl.y, t.cx, t.cy) > RAGGIO_AUTO) continue;
    const vive = (M5._auto[t.key] || []).filter((v) => !v.dead && game.vehicles.includes(v));
    M5._auto[t.key] = vive;
    const manca = AUTO_PER_CORTILE - (st.pezzi[t.key] || 0) - vive.length;
    for (let i = 0; i < manca; i++) {
      // Il primo posto libero: se la prima è stata portata via, la nuova non nasce
      // dentro la seconda.
      let slot = 0;
      while (slot < 3 && vive.some((v) => !v.driver && Math.abs(v.x - (t.cx + (slot - 1) * 40)) < 22)) slot++;
      const v = createVehicle(KINDS[slot % KINDS.length], t.cx + (slot - 1) * 40, t.cy + 4, Math.PI / 2, 2 + slot * 3);
      // Ferma e **protetta dallo streaming**: lo stesso patto di un'auto della storia
      // (`traffic.spawnScripted`). Il freno a mano la tiene lì finché non sale qualcuno.
      v.driver = null;
      v.handbrake = true;
      v.protect = true;
      v._chop = t.key;
      game.vehicles.push(v);
      vive.push(v);
    }
  }
}

// --- i pannelli -------------------------------------------------------------------------

/** Una tenda da sole a strisce, vista di fronte: la macchia gialla del pannello. */
function tenda(P, u, v, w, h, lit = 1) {
  const ctx = P.ctx;
  const x = px(P, u);
  const y = py(P, v);
  const n = 10;
  const sw = (P.w * w) / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? '#d9a82c' : '#f3d45f';
    // Il bordo a festone: un semicerchio sotto ogni striscia.
    ctx.fillRect(x + i * sw, y, sw + 1, P.h * h);
    ctx.beginPath();
    ctx.arc(x + i * sw + sw / 2, y + P.h * h, sw / 2, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(30,16,0,${0.2 * lit})`;
  ctx.fillRect(x, y + P.h * h * 0.78, P.w * w, P.h * h * 0.22);
}

/** Il ventilatore su stelo: le pale girano con il tempo del pannello. */
function ventilatore(P, u, v, s) {
  const ctx = P.ctx;
  const x = px(P, u);
  const y = py(P, v);
  ctx.fillStyle = '#4a4e57';
  ctx.fillRect(x - s * 0.04, y, s * 0.08, s * 1.25);
  ctx.fillRect(x - s * 0.28, y + s * 1.22, s * 0.56, s * 0.06);
  ctx.fillStyle = '#2b2e35';
  ctx.beginPath();
  ctx.arc(x, y, s * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b7380';
  const a0 = P.t * 9;
  for (let i = 0; i < 4; i++) {
    const a = a0 + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, s * 0.42, a, a + 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#99a2b0';
  ctx.beginPath();
  ctx.arc(x, y, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

/** Il ventaglio. `r` è il raggio, `open` quanto è aperto (1 = mezzo disco). */
function ventaglio(P, x, y, r, open = 0.9, tilt = 0) {
  const ctx = P.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const half = (Math.PI * open) / 2;
  const a0 = -Math.PI / 2 - half;
  const a1 = -Math.PI / 2 + half;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.moveTo(4, 5);
  ctx.arc(4, 5, r, a0, a1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ead9a2';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, a0, a1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,76,28,0.75)';
  ctx.lineWidth = Math.max(1.2, r * 0.018);
  for (let i = 0; i <= 9; i++) {
    const a = a0 + ((a1 - a0) * i) / 9;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.strokeStyle = '#7a4a1c';
  ctx.lineWidth = Math.max(2, r * 0.04);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.985, a0, a1);
  ctx.stroke();
  // Il bue, in due tratti: un segno giallo-ocra sul ventaglio, non un disegno.
  ctx.fillStyle = 'rgba(150,100,20,0.85)';
  ctx.font = `800 ${Math.round(r * 0.3)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('황소', 0, -r * 0.5);
  ctx.textAlign = 'left';
  ctx.restore();
}

/** Un bicchiere visto di tre quarti. `pieno` lo riempie di liquido chiaro. */
function bicchiere(P, u, v, s, pieno) {
  const ctx = P.ctx;
  const x = px(P, u);
  const y = py(P, v);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.18, y + s * 0.52, s * 0.52, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(205,225,235,0.55)';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.42, y - s * 0.5);
  ctx.lineTo(x + s * 0.42, y - s * 0.5);
  ctx.lineTo(x + s * 0.32, y + s * 0.5);
  ctx.lineTo(x - s * 0.32, y + s * 0.5);
  ctx.closePath();
  ctx.fill();
  if (pieno) {
    ctx.fillStyle = 'rgba(220,240,235,0.85)';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.37, y - s * 0.12);
    ctx.lineTo(x + s * 0.37, y - s * 0.12);
    ctx.lineTo(x + s * 0.32, y + s * 0.5);
    ctx.lineTo(x - s * 0.32, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(x - s * 0.3, y - s * 0.46, s * 0.06, s * 0.82);
  ctx.strokeStyle = 'rgba(235,245,250,0.8)';
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.5, s * 0.42, s * 0.1, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * La fotografia: un uomo sui trent'anni con un bambino in braccio. **Non ha
 * cicatrici**, ed è la sola cosa che il narratore dice di lui — quindi la guancia
 * destra si vede, ed è pulita. Piccola apposta: è una foto dentro un ventaglio.
 */
function foto(P, x, y, w, h, tilt = 0) {
  const ctx = P.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
  ctx.fillStyle = '#eee6d2';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  const m = w * 0.07;
  const iw = w - m * 2;
  const ih = h - m * 2.8;
  const ix = -w / 2 + m;
  const iy = -h / 2 + m;
  // Il fondo di uno studio fotografico del 1992: un telo azzurro sbiadito.
  const g = ctx.createLinearGradient(0, iy, 0, iy + ih);
  g.addColorStop(0, '#8fa6b8');
  g.addColorStop(1, '#6b8296');
  ctx.fillStyle = g;
  ctx.fillRect(ix, iy, iw, ih);
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  const sub = { ctx, x: ix, y: iy, w: iw, h: ih, t: P.t };
  const k = Math.max(1, Math.floor((ih * 0.5) / 24));
  // Le spalle, poi la testa; il bambino sta in braccio, davanti al petto, più piccolo.
  ctx.fillStyle = '#6b5a3a';
  ctx.fillRect(ix + iw * 0.14, iy + ih * 0.66, iw * 0.72, ih * 0.4);
  head(sub, 'kumangi', ix + iw * 0.42, iy + ih * 0.1, k, { mood: 'ride' });
  ctx.fillStyle = '#e8d58a';
  ctx.fillRect(ix + iw * 0.6, iy + ih * 0.78, iw * 0.26, ih * 0.3);
  head(sub, 'bambino', ix + iw * 0.72, iy + ih * 0.44, Math.max(1, Math.floor(k * 0.8)), { mood: 'fermo' });
  ctx.restore();
  ctx.fillStyle = 'rgba(255,240,200,0.12)';
  ctx.fillRect(ix, iy, iw, ih);
  ctx.restore();
}

export const APERTURA = [
  {
    // Il cortile. Il pannello dice una cosa sola: **ci sono sei uomini e nessuno
    // parla**. Il tavolo sotto la tenda è apparecchiato e la sedia è vuota: Pyo non
    // si è ancora seduto, e quando lo fa il pannello dopo è tutto per lui.
    id: 'm5-1',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#a9c4d8', '#d7d2b6', 0.55);
      // I palazzi attorno al cortile: facciate di giorno, finestre spente.
      block(P, px(P, 0.0), py(P, 0.02), P.w * 0.26, P.h * 0.62, '#7a766c');
      block(P, px(P, 0.74), py(P, 0.0), P.w * 0.26, P.h * 0.66, '#6f6c62');
      block(P, px(P, 0.26), py(P, 0.14), P.w * 0.48, P.h * 0.5, '#8a8576');
      ctx.fillStyle = 'rgba(40,36,28,0.35)';
      for (let i = 0; i < 6; i++) ctx.fillRect(px(P, 0.3 + i * 0.07), py(P, 0.2), P.w * 0.04, P.h * 0.07);
      // Il terreno: cemento battuto e il tag giallo dipinto, appena leggibile.
      ctx.fillStyle = '#a49d88';
      ctx.fillRect(P.x, py(P, 0.62), P.w, P.h * 0.38);
      sign(P, '황소파', px(P, 0.5), py(P, 0.9), { size: P.h * 0.09, color: '#d9a82c', glowR: 1 });
      // La tenda, e sotto la sua ombra il tavolino.
      tenda(P, 0.3, 0.2, 0.4, 0.09);
      ctx.fillStyle = 'rgba(40,30,0,0.22)';
      ctx.fillRect(px(P, 0.3), py(P, 0.29), P.w * 0.4, P.h * 0.33);
      ctx.fillStyle = '#5a4630';
      ctx.fillRect(px(P, 0.42), py(P, 0.5), P.w * 0.16, P.h * 0.04);
      ctx.fillRect(px(P, 0.43), py(P, 0.54), P.w * 0.012, P.h * 0.1);
      ctx.fillRect(px(P, 0.565), py(P, 0.54), P.w * 0.012, P.h * 0.1);
      // La sedia vuota, di spalle, con un cuscino giallo.
      ctx.fillStyle = '#3d3a33';
      ctx.fillRect(px(P, 0.46), py(P, 0.52), P.w * 0.07, P.h * 0.025);
      ctx.fillRect(px(P, 0.465), py(P, 0.41), P.w * 0.012, P.h * 0.12);
      ctx.fillRect(px(P, 0.52), py(P, 0.41), P.w * 0.012, P.h * 0.12);
      ctx.fillStyle = '#e0b53a';
      ctx.fillRect(px(P, 0.463), py(P, 0.495), P.w * 0.07, P.h * 0.03);
      ventilatore(P, 0.82, 0.38, P.h * 0.12);
      // Sei uomini, in due gruppi di tre, a distanza: **nessuno è girato verso il
      // tavolo**, ed è lì che si legge che aspettano.
      const k = unitScale(P, 0.38, 50);
      crowd(P, px(P, 0.17), py(P, 0.88), k, 3, { tint: '#3c3020', spread: 15, seed: 5 });
      crowd(P, px(P, 0.8), py(P, 0.9), k, 3, { tint: '#3c3020', spread: 15, seed: 8 });
      vignette(P, 0.32);
    },
  },
  {
    // Pyo. Il corpo è in secondo piano e il ventaglio in primo: quello che il
    // pannello deve far leggere è **come tiene le mani**, non la faccia — la faccia
    // è mezza chiusa dalle palpebre, ed è già tutto il personaggio.
    id: 'm5-2',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#e8cf7a', '#9a7b34', 0.7);
      tenda(P, 0.0, 0.0, 1.0, 0.1);
      glow(P, px(P, 0.74), py(P, 0.2), P.h * 0.6, '#fff3b8', 0.2);
      ctx.fillStyle = '#7b6a46';
      ctx.fillRect(P.x, py(P, 0.62), P.w, P.h * 0.38);
      // Jae-min, **di spalle in primo piano**, a sinistra: quello che vede Pyo.
      figure(P, 'jaemin', px(P, 0.13), py(P, 0.7), unitScale(P, 0.5, 38), 'back', { crop: 38 });
      // Lui, seduto. Sopra il riquadro delle battute: ha tre voci e un narratore.
      figure(P, 'pyo', px(P, 0.76), py(P, 0.58), unitScale(P, 0.42, 30), 'seat', { crop: 30, mood: 'parla' });
      ventaglio(P, px(P, 0.6), py(P, 0.52), P.h * 0.15, 0.9, 0.15);
      vignette(P, 0.38);
      narrator(P, '표만덕 · Pyo Man-deok, 66 anni. Presta soldi a Gangnam da trentaquattro.\n황소파, il Bue Giallo: è l\'usura.');
      speech(P, [
        { who: 'Pyo', text: '«Il cane che torna al villaggio abbaia con l\'accento sbagliato.»' },
        { who: 'Jae-min', text: '«Non è così che fa il proverbio.»' },
        { who: 'Pyo', text: '(soddisfatto) «No. Ma tu lo sai, e questo è già qualcosa.»' },
        { text: 'Li sbaglia apposta. È il modo in cui conta chi lo sta ascoltando davvero.', note: true },
      ]);
    },
  },
  {
    // Il tavolino, a due palmi dagli occhi. **Due bicchieri e una bottiglia che ne
    // riempie uno solo**: la scena è tutta qui, e non porta testo — chi l'ha capita ha
    // già capito Pyo.
    id: 'm5-3',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#6b5238', '#3d2e1d', 0.8);
      // Le assi del tavolo, in prospettiva piatta.
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,230,180,0.05)';
        ctx.fillRect(P.x, py(P, i * 0.17), P.w, P.h * 0.17);
        ctx.fillStyle = 'rgba(20,12,4,0.5)';
        ctx.fillRect(P.x, py(P, i * 0.17), P.w, Math.max(2, P.h * 0.008));
      }
      glow(P, px(P, 0.5), py(P, 0.4), P.h * 0.75, '#ffe9a8', 0.22);
      bicchiere(P, 0.36, 0.62, P.h * 0.2, false);
      bicchiere(P, 0.64, 0.62, P.h * 0.2, true);
      // La bottiglia, inclinata sul bicchiere di destra, e il filo di liquido.
      ctx.save();
      ctx.translate(px(P, 0.7), py(P, 0.22));
      ctx.rotate(-0.62);
      ctx.fillStyle = '#2f6b4a';
      ctx.fillRect(-P.w * 0.03, -P.h * 0.08, P.w * 0.06, P.h * 0.34);
      ctx.fillRect(-P.w * 0.012, -P.h * 0.2, P.w * 0.024, P.h * 0.13);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(-P.w * 0.024, -P.h * 0.05, P.w * 0.008, P.h * 0.26);
      ctx.restore();
      ctx.strokeStyle = 'rgba(220,240,235,0.7)';
      ctx.lineWidth = Math.max(2, P.h * 0.007);
      ctx.beginPath();
      ctx.moveTo(px(P, 0.61), py(P, 0.38));
      ctx.lineTo(px(P, 0.635), py(P, 0.53));
      ctx.stroke();
      // La mano che regge la bottiglia: una manica gialla, e il dorso della mano.
      ctx.fillStyle = '#b8942f';
      ctx.fillRect(px(P, 0.76), py(P, 0.0), P.w * 0.12, P.h * 0.2);
      ctx.fillStyle = '#d3a37c';
      ctx.fillRect(px(P, 0.745), py(P, 0.17), P.w * 0.11, P.h * 0.07);
      ventaglio(P, px(P, 0.16), py(P, 0.82), P.h * 0.2, 0.9, -0.4);
      vignette(P, 0.5);
    },
  },
];

export const CHIUSURA = [
  {
    // Lo stesso cortile, la sera. Le insegne accese e la gente che mangia: il
    // quartiere che Pyo tiene fermo per un mese. Il giallo della tenda è l'unica
    // tinta calda del pannello, come il neon in un vicolo.
    id: 'm5-4',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#1d1a30', '#0b0a12', 0.8);
      block(P, px(P, 0.0), py(P, 0.0), P.w * 0.28, P.h * 0.64, '#17151f', { lit: 0.5, seed: 4 });
      block(P, px(P, 0.72), py(P, 0.0), P.w * 0.28, P.h * 0.64, '#14121b', { lit: 0.55, seed: 9 });
      ctx.fillStyle = '#26232c';
      ctx.fillRect(P.x, py(P, 0.62), P.w, P.h * 0.38);
      sign(P, '황소파', px(P, 0.5), py(P, 0.2), { size: P.h * 0.12, color: '#ffd23f', glowR: P.h * 0.6 });
      tenda(P, 0.26, 0.26, 0.48, 0.09, 0.4);
      // Le lanterne: sei cerchi caldi sotto la tenda, tre rossi e tre gialli.
      for (let i = 0; i < 6; i++) {
        const lx = px(P, 0.3 + i * 0.08);
        const c = i % 2 ? '#ffd23f' : '#ff7a4a';
        glow(P, lx, py(P, 0.42), P.h * 0.12, c, 0.55);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(lx, py(P, 0.42), P.h * 0.016, P.h * 0.022, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // I tavoli e chi ci mangia: sagome, sedute dietro il piano.
      const k = unitScale(P, 0.34, 50);
      for (let t = 0; t < 3; t++) {
        const tx = 0.27 + t * 0.23;
        // Seduti: si vedono testa e busto sopra il piano, e il tavolo li taglia.
        crowd(P, px(P, tx), py(P, 0.8), k, 2, { tint: '#5b4f66', spread: 11, seed: 3 + t * 7, crop: 34 });
        ctx.fillStyle = '#6a5233';
        ctx.fillRect(px(P, tx - 0.09), py(P, 0.7), P.w * 0.18, P.h * 0.045);
        ctx.fillStyle = hexA('#ffd23f', 0.55);
        ctx.fillRect(px(P, tx - 0.04), py(P, 0.7), P.w * 0.03, P.h * 0.012);
        // Il vapore di una pentola: due righe chiare che salgono.
        for (let s = 0; s < 3; s++) {
          ctx.fillStyle = `rgba(235,235,230,${0.12 + hash(t * 5 + s) * 0.12})`;
          ctx.fillRect(px(P, tx + (s - 1) * 0.02), py(P, 0.62 - s * 0.03 - ((P.t * 0.05) % 0.04)), P.w * 0.006, P.h * 0.04);
        }
      }
      vignette(P, 0.5);
    },
  },
  {
    // Pyo solo. Il ventaglio chiuso a metà, e **fra le stecche una foto**: è la sola
    // cosa del pannello che il narratore dica, e dice solo quello che si vede.
    id: 'm5-5',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#2a2218', '#0d0a07', 0.9);
      glow(P, px(P, 0.62), py(P, 0.52), P.h * 0.7, '#ffd98a', 0.18);
      figure(P, 'pyo', px(P, 0.25), py(P, 0.94), unitScale(P, 0.7, 36), 'seat', { crop: 36, mood: 'giu', dim: 0.15 });
      ventaglio(P, px(P, 0.62), py(P, 0.78), P.h * 0.34, 0.62, 0.35);
      foto(P, px(P, 0.64), py(P, 0.5), P.w * 0.22, P.h * 0.4, 0.12);
      // Due stecche del ventaglio sopra il bordo sinistro della foto: è «dentro».
      ctx.strokeStyle = 'rgba(120,76,28,0.9)';
      ctx.lineWidth = Math.max(3, P.h * 0.012);
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(px(P, 0.62), py(P, 0.78));
        ctx.lineTo(px(P, 0.535 + i * 0.012), py(P, 0.34 + i * 0.03));
        ctx.stroke();
      }
      vignette(P, 0.5);
      narrator(P, 'L\'uomo nella foto non ha cicatrici. Non è Seo Dong-hyeok.');
    },
  },
];

// --- la missione -------------------------------------------------------------------------

export const M5 = {
  id: 'm5',
  title: 'Il cortile del Bue Giallo',
  hangul: '황소의 마당',
  act: 2,
  /** Le auto da smontare, per cortile. Stato di scena: non va nel salvataggio. */
  _auto: {},

  prepare(game) {
    const st = game.missions.state;
    const s = sites(game);
    scegli(game, st);
    // **Il 철마파 si prende i cortili all'inizio.** Idempotente: il ripristino
    // rientra qui, e quelli già ripresi sono tuoi (`held`) e non si toccano.
    for (const t of bersagli(game, st)) {
      if (!t.held && t.gang !== 'cheolma') game.turfs.claim(t, 'cheolma', game, 'war');
    }
    if (s.pool) game.shops.hold(s.pool.id);
    if (s.pyo) {
      game.actors.define('pyo', {
        x: s.pyo.x, y: s.pyo.y, kind: 'civil', name: 'Pyo Man-deok', hangul: '표만덕',
        angle: Math.PI / 2,
      });
    }
  },

  phases: [
    {
      // Chun-sik, dove l'atto I è finito. Se il giocatore è già dentro — ed è così
      // quando R1 si chiude — la scena parte subito, altrimenti parte entrando.
      id: 'chunsik',
      hint: 'Chun-sik ti aspetta al 당구장',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        if (!s.pool) { ctx.next(); return; }
        ctx.mark(s.pool.x, s.pool.y, { label: '당구장' });
        const parla = () => {
          if (ctx.state.parlato) return;
          ctx.state.parlato = true;
          ctx.talk([
            { who: 'Chun-sik', text: '«Ragazzo, la busta di martedì non si riempie. Il 백호파 non ha più i soldi.»' },
            { who: 'Jae-min', text: '«Quella che va a 한성개발.»' },
            { who: 'Chun-sik', text: '«Quella. Se martedì il furgone parte vuoto, la torre se lo ricorda.»' },
            { who: 'Jae-min', text: '«E chi presta a chi non può restituire?»' },
            { who: 'Chun-sik', text: '«Uno solo, a Gangnam: Pyo Man-deok. Non fargli fretta.»' },
          ], () => ctx.next());
        };
        // Basta l'edificio, non il piano: R1 si chiude appena si entra dalla porta, e
        // chi è ancora al pianterreno non deve salire per sentire la prima riga.
        ctx.on('floorShown', (shop) => { if (shop.id === s.pool.id) parla(); });
        const it = game.shops.active;
        if (it && it.shop.id === s.pool.id) parla();
      },
    },

    {
      id: 'viaggio',
      hint: 'Il cortile del 황소파 — a mani vuote e senza stelle',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!s.pyo) { ctx.next(); return; }
        ctx.mark(s.pyo.x, s.pyo.y, { label: '황소파' });
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        const pl = ctx.game.player;
        if (ctx.game.indoors || !s.pyo) return;
        if (dist(pl.x, pl.y, s.pyo.x, s.pyo.y) < INGRESSO) ctx.next();
      },
    },

    panelPhase('m5-apertura', APERTURA),

    {
      // **Il prezzo.** Pyo non presta soldi: presta un mese. Il «cosa vuole in
      // cambio» è la frase che mette in moto la fase dopo, e **non** dice come: i tre
      // modi sono del giocatore.
      id: 'prezzo',
      hint: 'Parla con Pyo',
      enter(ctx) {
        const s = sites(ctx.game);
        if (s.pyo) ctx.mark(s.pyo.x, s.pyo.y, { label: '황소파' });
        ctx.talk([
          { who: 'Pyo', text: '«Soldi non te ne do, non li rivedrei. Ti do un mese in cui nessuno viene a bussare. Un mese, qui dentro, è la cosa più cara che c\'è.»' },
          { who: 'Jae-min', text: '«E in cambio?»' },
          { who: 'Pyo', text: '«Tre cortili. Erano miei fino al 2025. Adesso ci lavora il 철마파, quelli che smontano le auto, e me li sono lasciati prendere mentre guardavo da un\'altra parte.»' },
        ], () => ctx.next());
      },
    },

    {
      id: 'cortili',
      hint: 'Tre cortili del 철마파',
      enter(ctx) {
        const game = ctx.game;
        const st = ctx.state;
        scegli(game, st);
        st.presi = st.presi || [];
        st.pezzi = st.pezzi || {};
        st.persi = st.persi || 0;
        // Un cortile che era già tuo prima di cominciare conta: la missione chiede tre
        // cortili in mano, non tre giornate di lavoro.
        for (const t of bersagli(game, st)) if (t.held && !presa(st, t.key)) st.presi.push(t.key);
        if (st.presi.length >= CORTILI) { ctx.next(); return; }
        mira(ctx);

        ctx.on('turfClaimed', (t, gang) => {
          if (!(st.targets || []).includes(t.key) || gang !== PLAYER_GANG || !t.held || presa(st, t.key)) return;
          st.presi.push(t.key);
          sgombera(game, t.key);
          const n = st.presi.length;
          ctx.toast(`Pyo — cortili ripresi: ${n}/${CORTILI}`, 3.2);
          if (n >= CORTILI) ctx.next();
          else mira(ctx);
        });

        // **La terza strada.** Le auto portate via e vendute si contano per cortile, e
        // la terza lo svuota: la `claim` la fa il sistema dei cortili, qui si conta e
        // basta. Un'auto che non è di nessun cortile non c'entra.
        ctx.on('vehicleSold', (v) => {
          const key = v._chop;
          if (!key || !(st.targets || []).includes(key) || presa(st, key)) return;
          st.pezzi[key] = (st.pezzi[key] || 0) + 1;
          const t = bersagli(game, st).find((q) => q.key === key);
          if (!t) return;
          if (st.pezzi[key] >= AUTO_PER_CORTILE) {
            ctx.toast(`${t.place} — il 철마파 non ha più niente da smontare`, 3.4);
            game.turfs.claim(t, PLAYER_GANG, game, 'work');
          } else {
            ctx.toast(`${t.place} — auto portate via: ${st.pezzi[key]}/${AUTO_PER_CORTILE}`, 3);
          }
        });

        // Morire nella fase non la rifà da capo (§5.29): si conta soltanto, perché Pyo
        // se ne accorge. Il conto sta nel taccuino e quindi nel salvataggio.
        ctx.on('respawn', () => { st.persi++; });
      },
      tick(dt, ctx) {
        curaAuto(ctx);
      },
      leave(ctx) { sgombera(ctx.game); },
    },

    {
      id: 'ritorno',
      hint: 'Torna da Pyo',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!s.pyo) { ctx.next(); return; }
        ctx.mark(s.pyo.x, s.pyo.y, { label: '황소파' });
        ctx.state.pagato = false;
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        const game = ctx.game;
        const pl = game.player;
        if (ctx.state.pagato || game.indoors || !s.pyo) return;
        if (dist(pl.x, pl.y, s.pyo.x, s.pyo.y) > INGRESSO) return;
        ctx.state.pagato = true;
        const tardi = (ctx.state.persi || 0) >= MORTI_PER_PYO;
        ctx.talk([
          tardi && { who: 'Pyo', text: '«Ci hai messo più del previsto. Ho dovuto contare i giorni due volte.»' },
          { text: 'Pyo firma una ricevuta e la fa scivolare sul tavolo: un mese, trenta giorni, nessuno che bussa.' },
          { who: 'Pyo', text: '«Tieni, figlio di Man-gi.» (mezzo secondo) «…di Dong-hyeok. Figlio di Dong-hyeok.»' },
          { who: 'Jae-min', text: '«Chi è Man-gi?»' },
          { who: 'Pyo', text: '«Uno che comandava qui prima di me. Morto prima che tu nascessi.» (chiude il ventaglio) «Quasi prima.»', note: 'Si è corretto sul nome. Non sulla data.' },
        ].filter(Boolean), () => ctx.next());
      },
    },

    {
      // Il terzo e ultimo «ma se ti ho visto ieri» dell'atto, ed è una cosa piccola:
      // un ragazzo che saluta con la mano. Parte quando si esce dal cortile, non
      // prima, perché è quello che dice il copione — «all'uscita».
      id: 'uscita',
      hint: 'Esci dal cortile',
      enter(ctx) {
        ctx.unmark();
        ctx.state.visto = false;
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        const game = ctx.game;
        const pl = game.player;
        if (ctx.state.visto || game.indoors || !s.pyo) return;
        if (dist(pl.x, pl.y, s.pyo.x, s.pyo.y) < USCITA) return;
        ctx.state.visto = true;
        ctx.talk([
          { who: 'Ragazzo', text: '«Ci vediamo giovedì come sempre, hyung!»' },
          { who: 'Jae-min', text: '«…Giovedì.»', note: 'Hyung è «fratello maggiore», e lo si dice a chi si vede spesso. Jae-min non ha mai visto questo ragazzo.' },
        ], () => ctx.next());
      },
    },

    panelPhase('m5-chiusura', CHIUSURA),
  ],

  finish(game) {
    sgombera(game);
    // Pyo non ha pagato in contanti: ha messo per iscritto un mese. È un fatto della
    // storia, come `busta` e `bara`, e per ora lo legge solo chi vuole sapere se è stato
    // fatto.
    game.missions.setFlag('proroga');
    game.hud.toast('황소의 마당 — completata', 3.2);
  },
};
