// M9 · «Gyeongbu» — 경부
//
// Il copione sta in `docs/storia/05-atto-3.md`. L'autostrada da Seoul all'ingresso di Busan, **all'alba,
// `05:10`**, con Chun-sik sul sedile del passeggero. È la missione fatta di una conversazione: le
// fasi sono tre tratte, e in ognuna **la cosa che conta è quello che lui dice** — il quarto ribaltamento
// (ha consegnato lui Dong-hyeok, perché lui glielo ha chiesto) arriva «senza pannello, senza musica,
// con l'auto a duecento».
//
// Quello che la missione chiede al motore, e che il motore adesso sa (§5.43):
//
//   · **un passeggero che parla mentre si guida** (`core/passenger.js`). Chun-sik non ferma il mondo:
//     la sua coda di righe scorre da sola, si ferma se si scende dall'auto e riprende se si risale. Con
//     lui a bordo la radio di 까치 tace — è la ragione per cui la chiamata 17 si innesca «da solo»;
//   · **la nebbia bassa** (`dayCycle.fogTarget`): un velo che si addensa verso i bordi, fitta alla prima
//     area di servizio e via via più rada fino a sparire a metà strada («sole pieno nella seconda
//     metà»). Non è un meteo: non tocca luce, traffico né asfalto;
//   · **il silenzio** (`passenger.hush`): per la confessione la musica della caccia e la radio vera si
//     fermano. È quello che il copione chiede, e il solo posto del gioco in cui lo chiede.
//
// Scelte che il copione non dice, e vanno dichiarate:
//
//   · **si parte alla prima area di servizio della Gyeongbu** (`휴게소`, a un terzo del corridoio): il
//     copione dice «all'uscita di Seoul», e la Gyeongbu non ha altre aree di servizio che le due che ha.
//     Il blip porta lì e si aspetta l'alba come in M6 e R3;
//   · **«morire riporta all'ultima area di servizio»** vale alla lettera: chi muore (o si fa arrestare)
//     riparte dall'area che ha superato per ultima, **con un'auto nuova e Chun-sik già a bordo** — la
//     concessione artificiale che il copione dichiara. Lo stesso se l'auto salta con lui ancora in
//     piedi: dopo due secondi la tratta ricomincia, **e la conversazione dall'inizio della tratta**;
//   · **il convoglio è fatto di quattro mezzi** (tre furgoni e un SUV di scorta) che partono davanti a
//     chi guida a ~150 px/s. Sparano quando si è a tiro e il SUV prova a speronare: nessuno chiama il
//     112 per un convoglio privato, quindi **sulla Gyeongbu non ci sono stelle** finché non si arriva
//     al blocco (le azzera la fase);
//   · **il blocco è a quattro stelle**, e al blocco c'è la polizia vera (`police.makeRoadblock`): si
//     passa, si aggira o si lascia l'auto. Arrivati al piazzale di 서면 le stelle cadono — come in M4,
//     è la tavola dopo, e con le volanti addosso quella scena non si guarda;
//   · **la radio non cambia stazione con i chilometri**: le stazioni sono stream veri (§5.14) e il gioco
//     non sa quali siano. Chun-sik commenta quella che trova accesa, una volta;
//   · **a piedi non parla**: se si lascia l'auto la coda si ferma, e al piazzale quello che manca lo
//     dice in un dialogo.
import { panelPhase } from '../core/missions.js';
import { createVehicle } from '../entities/vehicle.js';
import { WEAPONS, shoot } from '../entities/weapons.js';
import { findBusan } from './places.js';
import { dist, clamp } from '../core/math.js';
import {
  px, py, wash, vignette, glow, hash,
  block, skyline, sign, car, narrator, speech,
} from '../render/panelkit.js';
import { figure, unitScale } from '../render/pixelkit.js';

/** Le 05:10. */
const ALBA = 5 + 10 / 60;
const ALBA_DA = ALBA - 0.15;
const ALBA_A = 9;
/** A che distanza dall'area di servizio comincia l'attesa dell'alba. */
const ARRIVO = 420;
/** Dove finisce la nebbia: a metà fra le due aree di servizio. */
const NEBBIA_FINE = 0.5;
/** Da dove (x) comincia il convoglio: è la seconda metà del primo tratto. */
const CONVOGLIO_X = 9300;
/** Quanto davanti al giocatore nasce il convoglio, e a che velocità va. */
const CONVOGLIO_DAVANTI = 950;
const CONVOGLIO_VEL = 150;
/** Il convoglio è «passato» quando l'ultimo mezzo è così indietro. */
const SUPERATO = 620;
/** A che distanza dal blocco il ricercato sale a quattro stelle. */
const BLOCCO_RAGGIO = 1500;
/** Arrivo al piazzale. */
const PIAZZALE = 230;
/** Quanto dopo lo scoppio dell'auto la tratta ricomincia. */
const RIPARTE_DOPO = 2.2;

const BOSS = { who: 'Chun-sik' };

function sites(game) {
  if (M9._sites) return M9._sites;
  const c = game.city;
  const ex = c.expressway || null;
  const rest = (c.landmarks || []).filter((l) => l.kind === 'service').sort((a, b) => a.x - b.x);
  M9._sites = {
    ex, A: rest[0] || null, B: rest[1] || rest[0] || null,
    ing: findBusan(game, 'ingresso'), piaz: findBusan(game, 'piazzale'),
  };
  return M9._sites;
}

const ok = (s) => s.ex && s.A && s.B && s.ing && s.piaz;

/** L'ora come la scrive un orologio: serve al narratore del pannello 4. */
export function oraDetta(dc) {
  return `${String(Math.floor(dc.hour)).padStart(2, '0')}:${String(dc.minutes).padStart(2, '0')}`;
}
let ORA = '09:40';

// --- la conversazione ---------------------------------------------------------------------------

/**
 * Le tre tratte. **Chun-sik parla al presente di chi è assente** (`01-personaggi.md`, il suo tic):
 * «tuo padre dice», mai «diceva». Lo dice ogni volta ed è l'unico indizio che il giocatore ha avuto
 * fino a qui, e che questa tratta rende — con la confessione — una cosa che si capisce.
 */
const NEBBIA = [
  { text: '«Trent\'anni fa il quartiere era due strade e un cane. Il cane comandava, ragazzo.»' },
  { text: '«Tuo padre dice che il cane aveva più autorità del sindaco, e che il sindaco lo sapeva.»' },
  { text: '«Una volta gli ha dato del lei. Al cane. Per rispetto. Il cane gli ha mangiato una scarpa.»' },
  { text: '«Il giorno dopo il cane gli ha riportato la scarpa. Una. Tuo padre dice che è così che si tratta: ti restituiscono metà e tu sei grato.»' },
  { text: '«Il cane è morto vecchio, d\'inverno. Sono venuti in trecento al funerale e metà non sapeva di chi.»' },
];

const CONVOGLIO = [
  { text: '«Eccoli. Tre furgoni e uno che li accompagna per sentirsi utile.»' },
  { text: '«Dicevo. Il fornaio di 마포 aveva un figlio che sapeva a memoria tutti i prezzi, e nessuno gli ha mai chiesto di fare le divisioni.»' },
  { text: '«Abbassati un po\', ragazzo. Il parabrezza costa meno di te.»' },
  { text: '«Tuo padre dice che a un furgone non si spara al motore. Si spara a chi sta guidando, e si dice scusi.»' },
];

/**
 * **La confessione.** Il copione la scrive in sei battute da leggere una volta sola a duecento
 * all'ora, quindi **ognuna dice una cosa e una sola**: chi l'ha consegnato, quanto ha preso, chi
 * gliel'ha chiesto, cosa ha comprato, perché non si è mai difeso, perché ne parla adesso. Non c'è
 * un pannello, non c'è musica: c'è la coda del passeggero e il silenzio che `hush` fa fare al resto.
 */
const CONFESSIONE = [
  { text: '«L\'ho consegnato io, tuo padre. A loro. Dodici anni fa.»' },
  { who: 'Jae-min', text: '(non risponde)', hold: 2.6 },
  { text: '«Vuoi sapere quanto mi hanno dato? Niente. Non ho preso niente, ragazzo, e questa è la parte che nessuno mi crede da dodici anni.»' },
  { text: '«Me lo ha chiesto lui. In un parcheggio a 김포, di notte, con la macchina accesa. Mi ha detto: consegnami a Hanseong, e loro lasciano stare il quartiere finché io resto sparito. Gli ho detto di no per due ore. Poi ho detto di sì.»' },
  { who: 'Jae-min', text: '«E la gente cosa ha capito?»' },
  { text: '«Che ho venduto il mio capo. Va bene così: per difendermi dovevo spiegare, e a spiegarlo il patto si rompeva. Quel patto ha tenuto in piedi tremila persone per dodici anni.»' },
  { who: 'Jae-min', text: '«Perché me lo dici adesso?»' },
  { text: '«Perché i dodici anni sono finiti martedì. E perché tu mi credi una carogna, e io ti ho tenuto in braccio.»' },
];

/** Quello che Chun-sik dice di una stazione che trova accesa. Una volta sola, e a tratta pulita. */
const RADIO = { text: '«Questa la conosco. La mettevano al 당구장 quando il padrone voleva che la gente andasse a casa.»' };

/** Il passeggero dice una coda di righe, dall'inizio: è la punizione del tratto. */
function parla(ctx, righe) {
  ctx.game.passenger.say(righe.map((r) => ({ who: BOSS.who, ...r })), { front: true });
}

// --- dove sta il giocatore sulla strada -----------------------------------------------------------

/** La nebbia: 0,8 alla prima area di servizio, zero a metà dei due tratti di pianura. */
function nebbia(game) {
  const s = sites(game);
  if (!s.ex) return;
  const pl = game.player;
  // Solo sull'autostrada: chi è ancora a Seoul, o in un'altra città, non è nella nebbia delle risaie.
  const sulla = pl.y > s.ex.y - 900 && pl.y < s.ex.y + 700 && pl.x > s.ex.exit.x - 400;
  if (!sulla || game.indoors) return;
  const a = s.A.x;
  const b = s.A.x + (s.B.x - s.A.x) * NEBBIA_FINE + (s.B.x - s.A.x) * 0.3;
  const k = clamp(1 - (pl.x - a) / Math.max(1, b - a), 0, 1);
  game.dayCycle.fogTarget = 0.82 * k;
}

// --- auto nuova, e l'area di servizio da cui si riparte -----------------------------------------

function rimuovi(game, v) {
  const i = game.vehicles.indexOf(v);
  if (i >= 0) game.vehicles.splice(i, 1);
}

/**
 * «Morire riporta all'ultima area di servizio.» **Un'auto nuova, e lui è già a bordo**: la sola
 * concessione artificiale del copione. L'area è l'ultima che si è superata (`state.check`: 0 la prima,
 * 1 la seconda), e l'auto nasce sulla corsia verso est — in Corea si guida a destra, quindi a sud — un
 * paio di isolati prima del parcheggio, con la strada libera davanti e dietro.
 */
function riparti(ctx, motivo) {
  const game = ctx.game;
  const st = ctx.state;
  const s = sites(game);
  const pl = game.player;
  const stop = st.check ? s.B : s.A;
  const x = stop.x - 330;
  const y = s.ex.y + 38;
  if (game.indoors && game.shops.active) game.shops.leave(game);
  for (const v of game.vehicles.slice()) {
    if (v.driver === 'player') continue;
    if (dist(v.x, v.y, x, y) < 260) rimuovi(game, v);
  }
  M9._auto = null;
  game.tail.stop();
  game.wanted.reset();
  game.police.standDown(game, true);
  const v = createVehicle('sedan', x, y, 0, 1);
  v.protect = true;
  game.vehicles.push(v);
  if (pl.vehicle && pl.vehicle !== v) pl.exitVehicle(game, true);
  pl.x = x; pl.y = y; pl.vx = 0; pl.vy = 0;
  pl.enterVehicle(v, game);
  game.camera.snapTo(x, y);
  M9._auto = v;
  st.crollo = 0;
  if (motivo) ctx.toast(motivo, 4);
}

/** Su quale area si riparte, secondo dove si è arrivati. */
function aggiornaArea(ctx) {
  const s = sites(ctx.game);
  if (!ctx.state.check && ctx.game.player.x > s.B.x && ctx.game.player.y < s.ex.y + 900) ctx.state.check = 1;
}

/**
 * Quello che ogni tratta fa ogni frame: la nebbia, l'area superata, e l'auto. **Se l'auto salta con
 * il giocatore ancora in piedi** la tratta ricomincia dopo due secondi, con una nuova. Se invece muore
 * lui, ci pensa la ripresa della fase (`enter` → `ripresa`).
 */
function comune(dt, ctx) {
  const game = ctx.game;
  const st = ctx.state;
  const pl = game.player;
  nebbia(game);
  if (game.indoors) return;
  aggiornaArea(ctx);
  const v = pl.vehicle;
  if (v && !v.dead) M9._auto = v;
  if (M9._auto && M9._auto.dead && !pl.dying) {
    st.crollo = (st.crollo || 0) + dt;
    if (st.crollo > RIPARTE_DOPO) {
      riparti(ctx, 'L\'auto è andata: se ne trova un\'altra, e Chun-sik ricomincia dal tratto');
      game.missions.replay(game);
    }
  }
}

/**
 * Entrando in una tratta: se nel frattempo si è morti (o arrestati), si riparte dall'area di servizio.
 * Il contatore sta nel taccuino, quindi sopravvive al salvataggio senza stato nuovo.
 */
function ripresa(ctx) {
  const game = ctx.game;
  const st = ctx.state;
  const n = (game.stats.deaths || 0) + (game.stats.busted || 0);
  if (st.morti !== undefined && st.morti !== n) riparti(ctx, 'Si ricomincia dall\'ultima area di servizio');
  st.morti = n;
  st.crollo = 0;
  const pl = game.player;
  if (pl.vehicle && !pl.vehicle.dead) M9._auto = pl.vehicle;
}

function bordo(ctx) {
  const game = ctx.game;
  game.passenger.board('Chun-sik', '안춘식');
  game.passenger.hush = false;
}

// --- il convoglio -----------------------------------------------------------------------------

function sgomberaConvoglio(game, tutti = false) {
  for (const v of M9._convoglio || []) {
    v.protect = false;
    v.hostile = false;
    if (tutti) rimuovi(game, v);
  }
  M9._convoglio = [];
}

/**
 * Tre furgoni e una scorta, in fila davanti a chi guida e **nella sua direzione di marcia**. Nascono
 * sulla corsia (`traffic.spawnScripted`) e vanno a Busan come ogni auto della storia (`sendTo`): il
 * resto del traffico vale per loro come per tutti, e se qualcuno si mette davanti frenano.
 */
function spawnConvoglio(game) {
  const s = sites(game);
  const pl = game.player;
  const out = [];
  const tipi = ['van', 'van', 'van', 'suv'];
  tipi.forEach((kind, i) => {
    const x = pl.x + CONVOGLIO_DAVANTI + i * 150;
    const v = game.traffic.spawnScripted(kind, x, s.ex.y + 38, game, {
      lightsOn: true, speed: CONVOGLIO_VEL, radius: 500, colorIndex: kind === 'suv' ? 1 : 9, dir: 1, lane: 0,
    });
    if (!v) return;
    v.hostile = true;
    v.fireT = 0.5 + i * 0.35;
    v.scorta = kind === 'suv';
    if (!game.traffic.sendTo(v, s.ing.approach.x, s.ing.approach.y - 300, game)) { rimuovi(game, v); return; }
    out.push(v);
  });
  M9._convoglio = out;
  return out;
}

/**
 * Il convoglio **spara e sperona**. Chi ha un finestrino aperto tira al giocatore quando è a tiro (pistola,
 * con molta dispersione: sono guidatori); la scorta, quando gli è accanto, gli butta addosso la fiancata.
 */
function convoglioAgisce(dt, game) {
  const pl = game.player;
  for (const v of M9._convoglio || []) {
    if (v.dead || !v.hostile) continue;
    const d = dist(v.x, v.y, pl.x, pl.y);
    if (d < 340 && !pl.dying) {
      v.fireT -= dt;
      if (v.fireT <= 0) {
        v.fireT = 0.8 + Math.random() * 0.7;
        const a = Math.atan2(pl.y - v.y, pl.x - v.x);
        shoot(game, v, WEAPONS.pistol, v.x + Math.cos(a) * 30, v.y + Math.sin(a) * 30, a, { spreadMul: 3.4, ignoreVehicle: v });
      }
    }
    if (v.scorta && d < 130 && d > 40) {
      v.ramT = (v.ramT || 0) - dt;
      if (v.ramT <= 0) {
        v.ramT = 1.6;
        const nx = (pl.x - v.x) / d;
        const ny = (pl.y - v.y) / d;
        v.vx = (v.vx || 0) + nx * 150;
        v.vy = (v.vy || 0) + ny * 150;
      }
    }
  }
}

function convoglioRisolto(game) {
  const l = M9._convoglio || [];
  if (!l.length) return true;
  const pl = game.player;
  return l.every((v) => v.dead || v.gone || pl.x - v.x > SUPERATO);
}

// --- i pannelli ---------------------------------------------------------------------------

/** Il cielo dell'alba sopra la nebbia: dal blu notte a un rosa sporco, con le risaie sotto. */
function albaCielo(P, opts = {}) {
  const { fog = 0.5, horizon = 0.56 } = opts;
  const ctx = P.ctx;
  wash(P, '#1d2736', '#d29a78', horizon);
  glow(P, px(P, 0.72), py(P, horizon), P.h * 0.5, '#ffd9a0', 0.38);
  ctx.fillStyle = '#34433b';
  ctx.fillRect(P.x, py(P, horizon), P.w, P.h * (1 - horizon));
  // Le risaie: strisce più scure e più chiare che si fanno larghe verso chi guarda.
  for (let i = 0; i < 9; i++) {
    const t = i / 9;
    ctx.fillStyle = i % 2 ? 'rgba(88,118,74,0.55)' : 'rgba(40,62,50,0.55)';
    ctx.fillRect(P.x, py(P, horizon + (1 - horizon) * t * t), P.w, P.h * (1 - horizon) * ((i + 1) / 9) ** 2 * 0.12 + 2);
  }
  // La nebbia: tre veli orizzontali, che sfumano verso l'alto.
  for (let i = 0; i < 3; i++) {
    const y = py(P, horizon - 0.04 + i * 0.07);
    const g = ctx.createLinearGradient(0, y - P.h * 0.12, 0, y + P.h * 0.08);
    g.addColorStop(0, 'rgba(214,220,226,0)');
    g.addColorStop(0.55, `rgba(214,220,226,${(fog * (0.42 - i * 0.08)).toFixed(3)})`);
    g.addColorStop(1, 'rgba(214,220,226,0)');
    ctx.fillStyle = g;
    ctx.fillRect(P.x, y - P.h * 0.12, P.w, P.h * 0.2);
  }
}

/** Un bicchiere di carta con il coperchio, e il filo di vapore. */
function bicchiere(P, x, y, s) {
  const ctx = P.ctx;
  ctx.fillStyle = '#e8e2d6';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y - s);
  ctx.lineTo(x + s * 0.5, y - s);
  ctx.lineTo(x + s * 0.38, y);
  ctx.lineTo(x - s * 0.38, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a4a2c';
  ctx.fillRect(x - s * 0.46, y - s * 0.62, s * 0.92, s * 0.22);
  ctx.fillStyle = '#f4efe4';
  ctx.fillRect(x - s * 0.56, y - s * 1.12, s * 1.12, s * 0.16);
  ctx.strokeStyle = 'rgba(240,236,226,0.4)';
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.2);
  ctx.bezierCurveTo(x - s * 0.3, y - s * 1.6, x + s * 0.3, y - s * 1.9, x, y - s * 2.3);
  ctx.stroke();
}

export const APERTURA = [
  {
    // Il piazzale di un'area di servizio, all'alba. **Due caffè sul tetto dell'auto**: il tetto è
    // la cosa grande, in primo piano, e i bicchieri ci stanno sopra.
    id: 'm9-1',
    draw(P) {
      const ctx = P.ctx;
      albaCielo(P, { fog: 0.6, horizon: 0.5 });
      // L'edificio dell'area di servizio, basso e vetrato, con l'insegna accesa.
      block(P, px(P, 0.5), py(P, 0.34), P.w * 0.44, P.h * 0.2, '#6d7a82', { lit: 0.7, window: '#ffe7b0', seed: 4, cols: 8, rows: 2 });
      ctx.fillStyle = '#39454c';
      ctx.fillRect(px(P, 0.5), py(P, 0.32), P.w * 0.44, P.h * 0.03);
      sign(P, '휴게소', px(P, 0.72), py(P, 0.31), { size: Math.round(P.h * 0.055), color: '#ffd05a', glowR: 70 });
      // Il piazzale, bagnato di rugiada.
      ctx.fillStyle = '#3a3f46';
      ctx.fillRect(P.x, py(P, 0.62), P.w, P.h * 0.38);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      for (let i = 0; i < 6; i++) ctx.fillRect(px(P, 0.04 + i * 0.17), py(P, 0.66), P.w * 0.1, 3);
      // L'auto, di profilo, grande; sul tetto i due bicchieri.
      const s = P.h * 0.86;
      car(P, px(P, 0.3), py(P, 0.97), s, '#2e3540', { glass: '#1c2736' });
      bicchiere(P, px(P, 0.282), py(P, 0.97) - s * 0.335, P.h * 0.045);
      bicchiere(P, px(P, 0.336), py(P, 0.97) - s * 0.335, P.h * 0.045);
      vignette(P, 0.45);
      narrator(P, '05:10. 휴게소, area di servizio sulla Seoul-Busan.');
    },
  },
  {
    // Dentro l'auto. **La cintura**: Chun-sik la tira e la aggancia, e il copione dice di notarlo — non
    // se la mette mai. Non si spiega perché lo fa; la nota dice dove guardare.
    id: 'm9-2',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#27324a', '#10151d', 1);
      // Il vetro davanti, con la strada che si schiarisce.
      ctx.fillStyle = '#44556a';
      ctx.fillRect(px(P, 0.05), py(P, 0.08), P.w * 0.9, P.h * 0.3);
      const g = ctx.createLinearGradient(0, py(P, 0.08), 0, py(P, 0.38));
      g.addColorStop(0, '#3b4a5f');
      g.addColorStop(1, '#c9b08f');
      ctx.fillStyle = g;
      ctx.fillRect(px(P, 0.05), py(P, 0.08), P.w * 0.9, P.h * 0.3);
      // Il sedile del passeggero, e lui.
      ctx.fillStyle = '#4a5160';
      ctx.fillRect(px(P, 0.5), py(P, 0.26), P.w * 0.38, P.h * 0.74);
      ctx.fillStyle = '#394050';
      ctx.fillRect(px(P, 0.5), py(P, 0.26), P.w * 0.04, P.h * 0.74);
      const k = unitScale(P, 0.66, 40);
      const f = figure(P, 'chunsik', px(P, 0.69), py(P, 0.98), k, 'seat', { crop: 40, mood: 'fermo' });
      // La cintura: un nastro diagonale dalla spalla all'anca, con la fibbia.
      ctx.strokeStyle = '#9aa3b4';
      ctx.lineWidth = Math.max(4, k * 1.5);
      ctx.beginPath();
      ctx.moveTo(f.x + k * 6, f.y + k * 24);
      ctx.lineTo(f.x + k * 17, f.y + k * 38);
      ctx.stroke();
      ctx.fillStyle = '#ffd05a';
      ctx.fillRect(f.x + k * 16, f.y + k * 36.5, k * 3, k * 2);
      // Il volante, in basso a sinistra, e la mano di chi guida.
      ctx.strokeStyle = '#0a0c10';
      ctx.lineWidth = Math.max(5, P.h * 0.02);
      ctx.beginPath();
      ctx.ellipse(px(P, 0.22), py(P, 0.9), P.w * 0.15, P.h * 0.07, 0, 0, Math.PI * 2);
      ctx.stroke();
      vignette(P, 0.55);
      speech(P, [{ text: 'Non se la mette mai.', note: true }]);
    },
  },
  {
    // La strada davanti: **vuota, dritta, con la nebbia sopra le risaie**. Le tre battute sono
    // quelle del copione, e l'ultima è il comando che apre la missione.
    id: 'm9-3',
    draw(P) {
      const ctx = P.ctx;
      albaCielo(P, { fog: 0.85, horizon: 0.3 });
      // L'asfalto in prospettiva, con la riga di mezzeria che si perde nella nebbia.
      const vx = px(P, 0.5);
      const vy = py(P, 0.3);
      ctx.fillStyle = '#2b3037';
      ctx.beginPath();
      ctx.moveTo(vx - P.w * 0.02, vy);
      ctx.lineTo(vx + P.w * 0.02, vy);
      ctx.lineTo(px(P, 0.92), py(P, 1));
      ctx.lineTo(px(P, 0.08), py(P, 1));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(232,226,200,0.7)';
      for (let i = 0; i < 7; i++) {
        const t0 = (i / 7) ** 1.8;
        const t1 = ((i + 0.55) / 7) ** 1.8;
        const w0 = P.w * 0.004 + P.w * 0.012 * t0;
        const w1 = P.w * 0.004 + P.w * 0.012 * t1;
        const y0 = vy + (py(P, 1) - vy) * t0;
        const y1 = vy + (py(P, 1) - vy) * t1;
        ctx.beginPath();
        ctx.moveTo(vx - w0, y0); ctx.lineTo(vx + w0, y0); ctx.lineTo(vx + w1, y1); ctx.lineTo(vx - w1, y1);
        ctx.closePath();
        ctx.fill();
      }
      // La nebbia sopra la strada, ancora, più fitta.
      const g = ctx.createLinearGradient(0, py(P, 0.2), 0, py(P, 0.42));
      g.addColorStop(0, 'rgba(214,220,226,0)');
      g.addColorStop(0.5, 'rgba(214,220,226,0.5)');
      g.addColorStop(1, 'rgba(214,220,226,0)');
      ctx.fillStyle = g;
      ctx.fillRect(P.x, py(P, 0.2), P.w, P.h * 0.22);
      vignette(P, 0.45);
      speech(P, [
        { who: 'Chun-sik', text: '«Quattrocento chilometri. Sei ore. Alla fine ti dico una cosa e mi lasci a Busan.»' },
        { who: 'Jae-min', text: '«Dimmela adesso.»' },
        { who: 'Chun-sik', text: '«No. Adesso guidi.»' },
      ]);
    },
  },
];

export const CHIUSURA = [
  {
    // Busan dall'alto, di mattina: **la baia, il ponte, le gru del porto**.
    id: 'm9-4',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#9fc3dd', '#e9dcc4', 0.55);
      // Le colline di Busan, case addossate.
      skyline(P, py(P, 0.62), { color: '#5d6b74', min: 0.06, max: 0.2, step: 0.04, seed: 9, lit: 0.12 });
      skyline(P, py(P, 0.66), { color: '#46535c', min: 0.04, max: 0.13, step: 0.05, seed: 4 });
      // Il mare, e le gru del porto a sinistra.
      ctx.fillStyle = '#3d7f9c';
      ctx.fillRect(P.x, py(P, 0.64), P.w, P.h * 0.36);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 12; i++) ctx.fillRect(px(P, hash(i * 7.3)), py(P, 0.7 + hash(i * 3.1) * 0.26), P.w * 0.06, 2);
      ctx.strokeStyle = '#c0463a';
      ctx.lineWidth = Math.max(3, P.h * 0.012);
      for (let i = 0; i < 4; i++) {
        const x = px(P, 0.06 + i * 0.07);
        ctx.beginPath();
        ctx.moveTo(x, py(P, 0.66)); ctx.lineTo(x, py(P, 0.34));
        ctx.moveTo(x - P.w * 0.03, py(P, 0.34)); ctx.lineTo(x + P.w * 0.05, py(P, 0.34));
        ctx.stroke();
      }
      // Il ponte: un impalcato basso e due piloni, i cavi a ventaglio.
      ctx.fillStyle = '#d8dde3';
      ctx.fillRect(px(P, 0.34), py(P, 0.585), P.w * 0.62, P.h * 0.016);
      for (const u of [0.52, 0.76]) {
        ctx.fillRect(px(P, u) - 3, py(P, 0.34), 6, P.h * 0.26);
        ctx.strokeStyle = 'rgba(216,221,227,0.6)';
        ctx.lineWidth = 1;
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(px(P, u), py(P, 0.36 + Math.abs(i) * 0.002));
          ctx.lineTo(px(P, u) + i * P.w * 0.03, py(P, 0.585));
          ctx.stroke();
        }
      }
      vignette(P, 0.3);
      narrator(P, `Busan. ${ORA}.`);
    },
  },
  {
    // Il piazzale di 서면. Chun-sik **scende con la sua borsa e non entra da nessuna parte**: resta
    // lì, in piedi. Il pannello lo fa piccolo in mezzo a un piazzale vuoto.
    id: 'm9-5',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#8fb4cf', '#d9d4c6', 0.5);
      skyline(P, py(P, 0.52), { color: '#59666f', min: 0.12, max: 0.34, step: 0.07, seed: 11, lit: 0.18 });
      sign(P, '서면', px(P, 0.18), py(P, 0.3), { size: Math.round(P.h * 0.07), color: '#ff5fa2', glowR: 60 });
      ctx.fillStyle = '#b9b3a4';
      ctx.fillRect(P.x, py(P, 0.52), P.w, P.h * 0.48);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      for (let i = 0; i < 9; i++) ctx.fillRect(px(P, i * 0.125), py(P, 0.52), 2, P.h * 0.48);
      // Lui, in piedi, con la borsa; e l'ombra lunga del mattino.
      const k = unitScale(P, 0.5, 44);
      const f = figure(P, 'chunsik', px(P, 0.62), py(P, 0.66), k, 'stand', { crop: 44, mood: 'fermo' });
      // La borsa: a tracolla, sul fianco di chi guarda a sinistra.
      ctx.fillStyle = '#5a4630';
      ctx.fillRect(f.x - k * 2, f.y + k * 30, k * 8, k * 7);
      ctx.fillStyle = '#3a2d1e';
      ctx.fillRect(f.x - k * 2, f.y + k * 30, k * 8, k * 1.4);
      vignette(P, 0.3);
      speech(P, [
        { who: 'Jae-min', text: '«Chi devi vedere?»' },
        { who: 'Chun-sik', text: '«Nessuno. Ti ho chiesto io di portarmi via da Seoul.»' },
      ]);
    },
  },
  {
    // Lo specchietto: l'auto riparte, e **lui diventa piccolo e non si muove**.
    id: 'm9-6',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#1a1f28', '#0b0e13', 1);
      const cx = px(P, 0.5);
      const cy = py(P, 0.46);
      const rx = P.w * 0.34;
      const ry = P.h * 0.26;
      ctx.fillStyle = '#10141a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + P.h * 0.02, ry + P.h * 0.02, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();
      wash({ ...P, x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 }, '#9fc3dd', '#cfc9bb', 0.5);
      ctx.fillStyle = '#b9b3a4';
      ctx.fillRect(cx - rx, cy + ry * 0.1, rx * 2, ry);
      // Lui, in fondo, piccolo: la borsa a terra accanto.
      const k = Math.max(2, Math.floor((ry * 1.0) / 50));
      figure(P, 'chunsik', cx + rx * 0.05, cy + ry * 0.7, k, 'stand', { crop: 50 });
      ctx.restore();
      vignette(P, 0.5);
      narrator(P, 'Nello specchietto, il piazzale. Non si è mosso.');
    },
  },
];

// --- la missione ------------------------------------------------------------------------------

export const M9 = {
  id: 'm9',
  title: 'Gyeongbu',
  hangul: '경부',
  act: 3,
  _sites: null,
  _convoglio: [],
  _auto: null,

  phases: [
    {
      // La prima area di servizio sulla Gyeongbu. Il blip porta lì, e lì si aspetta l'alba.
      id: 'viaggio',
      hint: 'L\'area di servizio sulla Gyeongbu — all\'alba',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!ok(s)) { ctx.next(); return; }
        ctx.mark(s.A.x, s.A.y, { label: '휴게소' });
      },
      tick(dt, ctx) {
        nebbia(ctx.game);
        const s = sites(ctx.game);
        const pl = ctx.game.player;
        if (ctx.game.indoors || !ok(s)) return;
        if (dist(pl.x, pl.y, s.A.x, s.A.y) < ARRIVO) ctx.next();
      },
    },

    {
      // L'alba. Come M6 e R3 il blip porta dove si aspetta, e l'ora non si guarda girare. **Serve
      // un'auto**: Chun-sik si siede accanto a chi guida.
      id: 'alba',
      hint: 'Aspetta l\'alba: Chun-sik arriva alle 05:10',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mark(s.A.x, s.A.y, { label: '휴게소' });
        ctx.point({
          id: 'aspetta', key: 'F', onFoot: false, text: 'aspetta l\'alba', reach: 440,
          x: s.A.x, y: s.A.y,
          run: (c) => { c.waitUntil(ALBA); c.next(); },
        });
      },
      tick(dt, ctx) {
        nebbia(ctx.game);
        const h = ctx.game.dayCycle.hour;
        // Chi arriva già alle cinque e dieci, o poco dopo, non aspetta niente. Prima dell'alba e dopo le
        // nove si aspetta (le nove del mattino sono ormai «dopo»: il giorno dopo).
        const pl = ctx.game.player;
        if (!pl.onFoot && h >= ALBA_DA && h < ALBA_A) ctx.next();
      },
    },

    panelPhase('m9-apertura', APERTURA),

    {
      // **Tratta 1 — la nebbia.** Guida pulita, nessun nemico. Chun-sik racconta il quartiere di
      // trent'anni fa, comico e lungo.
      id: 'nebbia',
      hint: 'Gyeongbu, prima tratta: guida, e ascolta',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        const st = ctx.state;
        st.radio = false;
        bordo(ctx);
        ripresa(ctx);
        ctx.mark(s.B.x, s.B.y, { label: '휴게소' });
        parla(ctx, NEBBIA);
      },
      tick(dt, ctx) {
        const game = ctx.game;
        comune(dt, ctx);
        const st = ctx.state;
        const s = sites(game);
        // La radio: una riga sola, e solo se la tratta è pulita.
        if (!st.radio && game.radio?.on && !game.radio.isKkachi && game.radio.state === 'acceso' && !game.indoors) {
          st.radio = true;
          game.passenger.say([{ who: BOSS.who, ...RADIO }]);
        }
        if (!game.indoors && game.player.x > CONVOGLIO_X && game.player.y < s.ex.y + 700) ctx.next();
      },
    },

    {
      // **Tratta 2 — il convoglio.** Tre furgoni e una scorta: superarli, affiancarli, farsi speronare.
      // La conversazione continua come se niente fosse, ed è il pezzo di tono dell'atto.
      id: 'convoglio',
      hint: 'Il convoglio di 한성개발: superalo',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        const st = ctx.state;
        bordo(ctx);
        sgomberaConvoglio(game, true);
        ripresa(ctx);
        st.convoglio = false;
        ctx.mark(s.ing.approach.x, s.ing.approach.y, { label: '부산' });
        // Dopo una ripresa da un'area più indietro, il convoglio nasce quando si torna a CONVOGLIO_X.
        parla(ctx, CONVOGLIO);
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const st = ctx.state;
        const s = sites(game);
        comune(dt, ctx);
        if (game.indoors) return;
        const pl = game.player;
        // Nessuno chiama il 112 per un convoglio privato.
        if (game.wanted.level > 0 && pl.y < s.ex.y + 700) { game.wanted.heat = 0; game.wanted.level = 0; }
        if (!st.convoglio) {
          if (pl.x < CONVOGLIO_X || pl.y > s.ex.y + 300) return;
          st.convoglio = true;
          spawnConvoglio(game);
          return;
        }
        convoglioAgisce(dt, game);
        // Superato (o distrutto) e la coda dei discorsi in pausa: si passa alla confessione.
        if (convoglioRisolto(game)) {
          st.libero = (st.libero || 0) + dt;
          if (st.libero > 1.5 && !game.passenger.talking) ctx.next();
        } else st.libero = 0;
      },
      leave(ctx) { sgomberaConvoglio(ctx.game, false); },
    },

    {
      // **La confessione** — il quarto ribaltamento, detto senza pannello e senza musica, con l'auto
      // che corre. Sei battute, ognuna con una cosa sola.
      id: 'confessione',
      hint: 'Ascolta',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        bordo(ctx);
        ripresa(ctx);
        ctx.mark(s.ing.approach.x, s.ing.approach.y, { label: '부산' });
        game.passenger.hush = true;
        parla(ctx, CONFESSIONE);
        ctx.state.parlato = true;
      },
      tick(dt, ctx) {
        const game = ctx.game;
        comune(dt, ctx);
        game.passenger.hush = true;
        // Dalle prime righe a quando ha detto tutto: a piedi la coda si ferma, e non si va avanti.
        if (ctx.state.parlato && !game.passenger.talking) ctx.next();
      },
      leave(ctx) { ctx.game.passenger.hush = false; },
    },

    {
      // **Tratta 3 — il blocco.** Il posto di blocco all'ingresso di Busan, a quattro stelle: passare,
      // aggirare, o lasciare l'auto e proseguire in campagna. Finisce al piazzale di 서면.
      id: 'blocco',
      hint: 'Posto di blocco all\'ingresso di Busan: passa, aggira, o lascia l\'auto',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        bordo(ctx);
        ripresa(ctx);
        ctx.state.blocco = false;
        ctx.mark(s.piaz.x, s.piaz.y, { label: '서면' });
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const st = ctx.state;
        const s = sites(game);
        comune(dt, ctx);
        if (game.indoors) return;
        const pl = game.player;
        if (!st.blocco && dist(pl.x, pl.y, s.ing.x, s.ing.y) < BLOCCO_RAGGIO) {
          st.blocco = 1;
          game.wanted.add(Math.max(0, 92 - game.wanted.heat), game);
          game.audio?.ui('deny');
          ctx.toast('Posto di blocco — 부산 입구', 3.2);
        } else if (st.blocco === 1) {
          // Il tempo che la polizia si accorga di te, e la strada davanti ha già il suo blocco.
          st.bloccoT = (st.bloccoT || 0) + dt;
          if (st.bloccoT > 0.8) { st.blocco = 2; game.police.makeRoadblock(game); }
        }
        if (!st.fine && dist(pl.x, pl.y, s.piaz.x, s.piaz.y) < PIAZZALE) {
          st.fine = true;
          game.wanted.reset();
          game.police.standDown(game, true);
          // Quello che Chun-sik non ha fatto in tempo a dire, lo dice qui: la tavola dopo non aspetta.
          if (game.passenger.talking) {
            const resto = game.passenger.pending();
            game.passenger.clear();
            ctx.talk(resto, () => ctx.next());
          } else ctx.next();
          ORA = oraDetta(game.dayCycle);
        }
      },
    },

    panelPhase('m9-chiusura', CHIUSURA),
  ],

  finish(game) {
    sgomberaConvoglio(game, false);
    game.passenger.alight();
    game.dayCycle.fogTarget = 0;
    game.missions.setFlag('confessione');
    game.missions.setFlag('gyeongbu');
    game.hud.toast('경부 — completata', 3.4);
  },
};
