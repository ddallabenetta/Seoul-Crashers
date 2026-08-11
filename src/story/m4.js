// M4 · «Molo 7» — 7번 부두
//
// Il copione sta in `docs/storia/03-atto-1.md`. 인천항, notte, `22:40`: è il pezzo
// grosso dell'atto — container, gru, sparatoria, fuga in barca — e chiude con **il
// primo ribaltamento**, cioè con la sola cosa che il giocatore porta via da tutto
// l'Atto I: nella bara non c'è Seo Dong-hyeok.
//
// Quattro cose da sapere prima di toccarla:
//
//   · **i due fogli sono un oggetto vero** (`core/carry.js`). Si portano in mano
//     attraverso mezzo porto sotto tiro, e morire li lascia per terra dov'eri —
//     è la ragione per cui l'oggetto trasportabile esiste, e ogni fase da qui in
//     poi comincia guardando se ce li hai ancora;
//   · **Oh Se-jung muore male, e senza un pannello.** Cade mentre stai ricaricando
//     e il gioco non ci fa una tavola: si sente e basta. È una regola di tono
//     (`storia/README.md`), non una dimenticanza — non aggiungere quel pannello;
//   · **la gru non si scala**, perché una quota percorribile in questo motore non
//     c'è. Quello che il copione voleva da lì — *vedere quanto è grande la mappa* —
//     si ottiene con la manopola che c'è già: la camera si allarga fino al minimo
//     consentito e il porto entra tutto nell'inquadratura;
//   · **da tre stelle in su non ti ammanettano** (§5.16), e questa scena le tre
//     stelle le passa quasi subito. È voluto: al molo 7 non si viene presi vivi.
import { panelPhase } from '../core/missions.js';
import {
  AMBER, PAPER, BLOOD,
  px, py, flat, wash, vignette, glow, hash,
  block, sign, poster, wetFloor, dial, narrator, speech,
} from '../render/panelkit.js';
import { figure, head, unitScale } from '../render/pixelkit.js';
import { createPed } from '../entities/pedestrians.js';
import { VEHICLE_TYPES } from '../render/sprites.js';

/** L'ora del copione. Chi arriva di giorno aspetta il buio, come in M3. */
const APPUNTAMENTO = 22 + 40 / 60;
/** Quanti vengono a prendersi i fogli. Sei furgoni, sei uomini. */
const AGGUATO = 6;
/** Dopo quanti secondi di sparatoria cade Oh Se-jung. */
const CADE = 16;
/** Quanto si allarga la camera dalla cima della gru, e per quanto. */
const ZOOM_GRU = 0.5;
const ZOOM_T = 7;

/** I due fogli. Un oggetto solo: sono spillati insieme dal momento in cui li prendi. */
export const FOGLI = { id: 'fogli', label: 'il referto e il registro della gru' };

function sites(game) {
  if (M4._sites) return M4._sites;
  const city = game.city;
  // I moli del porto, non gli scali sul Han: quelli sono pontili da traghetto.
  // La scelta è deterministica come tutti gli indirizzi della storia (§5.29) —
  // si prende il secondo, che è quello che sta in mezzo al piazzale container.
  const piers = (city.piers || []).filter((p) => !p.river && (p.region || 'seoul') === 'seoul');
  const pier = piers[1] || piers[0] || null;
  if (!pier) { M4._sites = {}; return M4._sites; }
  // L'ufficio di banchina sta alla radice del molo, dal lato di terra: è dove
  // arriva chi viene in macchina, ed è l'unico punto del molo che ha un muro.
  const office = { x: pier.x + pier.w - 90, y: pier.y + pier.h / 2 };
  let crane = null;
  let bestD = Infinity;
  for (const p of city.props || []) {
    if (p.type !== 'crane') continue;
    const d = (p.x - office.x) ** 2 + (p.y - office.y) ** 2;
    if (d < bestD) { bestD = d; crane = p; }
  }
  // La foce: dove il Han finisce nel mare. Ci si arriva solo per acqua, ed è
  // l'unica meta di tutta la campagna che non ha una strada (la carta lo dice da
  // sola con una retta, §5.30).
  const midY = (city.river.y0 + city.river.y1) / 2;
  const shore = city.coastAt ? city.coastAt(midY) : city.waterX;
  const foce = { x: Math.max(140, shore - 260), y: midY };
  M4._sites = { pier, office, crane, foce };
  return M4._sites;
}

/** La barca ormeggiata più vicina al molo. È lì dal boot e non se ne va (§5.10). */
function barcaVicina(game, near) {
  let best = null;
  let bestD = Infinity;
  for (const v of game.vehicles) {
    if (v.dead || !VEHICLE_TYPES[v.kind]?.marine) continue;
    const d = (v.x - near.x) ** 2 + (v.y - near.y) ** 2;
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

/**
 * I fogli. Se li hai in mano non c'è niente da fare; se li hai persi morendo, il
 * blip va **su di loro** e la fase lo dice. Tutte le fasi da qui in fondo
 * cominciano con questa riga, ed è il motivo per cui l'oggetto trasportabile
 * cambia qualcosa: senza, morire con addosso la prova non costerebbe niente.
 */
function foglioPerso(ctx) {
  const held = ctx.game.carry.dropped;
  if (!held) return false;
  ctx.mark(held.x, held.y, { label: 'i fogli' });
  ctx.say('Sono rimasti dove sei caduto: torna a prenderli');
  return true;
}

/** Toglie di mezzo quello che la missione ha messo in strada. */
function sgombera(game) {
  for (const p of M4._agguato || []) p.gone = true;
  M4._agguato = null;
  game.camera.releaseZoom();
  game.camera.setZoomTarget(1);
}

// --- i pannelli -------------------------------------------------------------------

/** Una fila di container, in prospettiva finta: due tinte e le ombre a destra. */
function containers(P, y0, rows, opts = {}) {
  const ctx = P.ctx;
  const { from = 0.02, to = 0.98, h = 0.09, gap = 0.012, seed = 4 } = opts;
  for (let r = 0; r < rows; r++) {
    const yy = py(P, y0 + r * (h + gap));
    const hh = P.h * h;
    for (let u = from; u < to; u += 0.115) {
      const s = hash(seed * 13 + r * 31 + u * 211);
      const w = P.w * (0.09 + s * 0.02);
      const col = ['#3a4a52', '#5a4038', '#41503f', '#4a4756'][Math.floor(s * 4) % 4];
      ctx.fillStyle = col;
      ctx.fillRect(px(P, u), yy, w, hh);
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.fillRect(px(P, u) + w - P.w * 0.012, yy, P.w * 0.012, hh);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(px(P, u), yy, w, P.h * 0.008);
    }
  }
}

/** Una gru di banchina, vista di lato: due gambe, un braccio, un tirante. */
function crane(P, x, baseY, s, color = '#2a333c') {
  const ctx = P.ctx;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.035);
  const top = baseY - s;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.28, baseY); ctx.lineTo(x - s * 0.1, top);
  ctx.moveTo(x + s * 0.28, baseY); ctx.lineTo(x + s * 0.06, top);
  ctx.moveTo(x - s * 0.2, baseY - s * 0.35); ctx.lineTo(x + s * 0.22, baseY - s * 0.35);
  ctx.stroke();
  // Il braccio, che sporge verso l'acqua: è quello che la fa leggere come gru e
  // non come traliccio.
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.1, top);
  ctx.lineTo(x - s * 0.75, top + s * 0.08);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, top + s * 0.05);
  ctx.lineTo(x - s * 0.5, top + s * 0.42);
  ctx.stroke();
}

export const APERTURA = [
  {
    // Il porto dall'alto. Nessuno dentro: sono file di ferro e acqua nera, e
    // servono a dire quanto è grande il posto in cui si sta per entrare.
    id: 'm4-1',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#0b1219', '#050709', 0.5);
      // L'acqua, in alto: il porto si guarda da terra verso il largo.
      ctx.fillStyle = '#070c12';
      ctx.fillRect(P.x, P.y, P.w, P.h * 0.3);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(120,150,180,${0.04 + hash(i * 3.3) * 0.07})`;
        ctx.fillRect(px(P, hash(i * 1.7)), py(P, 0.06 + hash(i * 5.9) * 0.22), P.w * 0.06, 1.5);
      }
      ctx.fillStyle = '#131a20';
      ctx.fillRect(P.x, py(P, 0.3), P.w, P.h * 0.7);
      containers(P, 0.42, 5, { seed: 4 });
      // Le gru sono **più chiare** del piazzale, non più scure: di notte un
      // traliccio scuro su fondo scuro non è una silhouette, è niente.
      crane(P, px(P, 0.2), py(P, 0.42), P.h * 0.36, '#5a6975');
      crane(P, px(P, 0.55), py(P, 0.4), P.h * 0.32, '#4e5c68');
      crane(P, px(P, 0.86), py(P, 0.44), P.h * 0.3, '#596773');
      // Due lampioni da piazzale: la sola luce, e fredda.
      glow(P, px(P, 0.32), py(P, 0.5), P.h * 0.3, '#c8d8ea', 0.14);
      glow(P, px(P, 0.72), py(P, 0.62), P.h * 0.28, '#c8d8ea', 0.12);
      vignette(P, 0.6);
      narrator(P, '인천항, molo 7. 22:40.\nDi notte al porto non lavora nessuno, e i cancelli restano aperti.');
    },
  },
  {
    // L'ufficio di banchina. Una finestra accesa in mezzo al buio, e dentro un
    // uomo solo: il pannello è tutto in quel rettangolo di luce.
    id: 'm4-2',
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#070a0e');
      containers(P, 0.06, 2, { seed: 9, h: 0.11 });
      // Il capannone, e la finestra. Al primo provino la stanza era un francobollo
      // e l'uomo dentro un pixel: se il soggetto è «una stanza accesa con dentro
      // qualcuno», la stanza deve prendere metà pannello.
      ctx.fillStyle = '#151b22';
      ctx.fillRect(px(P, 0.08), py(P, 0.26), P.w * 0.84, P.h * 0.62);
      glow(P, px(P, 0.5), py(P, 0.5), P.h * 0.7, '#cfe8dd', 0.26);
      ctx.fillStyle = '#2b3a36';
      ctx.fillRect(px(P, 0.2), py(P, 0.32), P.w * 0.6, P.h * 0.46);
      ctx.fillStyle = 'rgba(214,240,228,0.75)';
      ctx.fillRect(px(P, 0.215), py(P, 0.335), P.w * 0.57, P.h * 0.43);
      // Il montante della finestra: senza, il vetro è un muro chiaro.
      ctx.fillStyle = 'rgba(30,44,40,0.8)';
      ctx.fillRect(px(P, 0.495), py(P, 0.335), P.w * 0.012, P.h * 0.43);
      // Lui, di schiena, dentro la finestra, e il tavolo davanti.
      figure(P, 'sejung', px(P, 0.4), py(P, 0.72), unitScale(P, 0.42, 34), 'back', { crop: 34 });
      ctx.fillStyle = '#7a6a52';
      ctx.fillRect(px(P, 0.26), py(P, 0.7), P.w * 0.42, P.h * 0.045);
      ctx.fillStyle = PAPER;
      ctx.fillRect(px(P, 0.44), py(P, 0.682), P.w * 0.13, P.h * 0.032);
      // La lampada al neon appesa: due righe chiare in cima alla stanza.
      ctx.fillStyle = 'rgba(240,255,246,0.85)';
      ctx.fillRect(px(P, 0.33), py(P, 0.36), P.w * 0.34, P.h * 0.014);
      ctx.fillStyle = '#0a0d11';
      ctx.fillRect(P.x, py(P, 0.86), P.w, P.h * 0.14);
      vignette(P, 0.62);
      narrator(P, '오세중 · Oh Se-jung, medico legale.\nL\'autopsia di martedì l\'ha firmata lui. Il porto non è il suo posto di lavoro.');
    },
  },
  {
    // I due fogli sul tavolo. È il pannello che il giocatore deve ricordare fra
    // dieci minuti, quando li avrà in mano: quindi sono grandi, dritti e diversi
    // fra loro — uno è un modulo timbrato, l'altro è una griglia di orari.
    id: 'm4-3',
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#12161c');
      glow(P, px(P, 0.5), py(P, 0.4), P.h * 0.8, '#cfe8dd', 0.16);
      ctx.fillStyle = '#5c4c38';
      ctx.fillRect(P.x, py(P, 0.12), P.w, P.h * 0.88);
      // Il referto: modulo con la fascia rossa e il timbro.
      ctx.save();
      ctx.translate(px(P, 0.29), py(P, 0.52));
      ctx.rotate(-0.06);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-P.w * 0.19 + 5, -P.h * 0.28 + 6, P.w * 0.38, P.h * 0.56);
      ctx.fillStyle = '#e9e3d4';
      ctx.fillRect(-P.w * 0.19, -P.h * 0.28, P.w * 0.38, P.h * 0.56);
      ctx.fillStyle = BLOOD;
      ctx.fillRect(-P.w * 0.19, -P.h * 0.28, P.w * 0.38, P.h * 0.03);
      ctx.fillStyle = 'rgba(40,38,34,0.55)';
      for (let i = 0; i < 9; i++) ctx.fillRect(-P.w * 0.16, -P.h * 0.19 + i * P.h * 0.055, P.w * (i % 3 ? 0.3 : 0.2), P.h * 0.014);
      ctx.strokeStyle = 'rgba(150,40,50,0.8)';
      ctx.lineWidth = Math.max(2, P.h * 0.007);
      ctx.beginPath();
      ctx.arc(P.w * 0.1, P.h * 0.19, P.h * 0.06, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `700 ${Math.round(P.h * 0.04)}px ui-monospace, monospace`;
      ctx.fillStyle = '#2a2723';
      ctx.textAlign = 'center';
      ctx.fillText('부검', P.w * 0.1, P.h * 0.2);
      ctx.textAlign = 'left';
      ctx.restore();
      // Il registro della gru: righe e orari, niente timbri. Due fogli che si
      // somigliano sono un foglio solo, e questa scena ne conta due.
      ctx.save();
      ctx.translate(px(P, 0.71), py(P, 0.5));
      ctx.rotate(0.05);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-P.w * 0.17 + 5, -P.h * 0.26 + 6, P.w * 0.34, P.h * 0.52);
      ctx.fillStyle = '#d8dcd6';
      ctx.fillRect(-P.w * 0.17, -P.h * 0.26, P.w * 0.34, P.h * 0.52);
      ctx.strokeStyle = 'rgba(60,70,80,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(-P.w * 0.15, -P.h * 0.2 + i * P.h * 0.06);
        ctx.lineTo(P.w * 0.15, -P.h * 0.2 + i * P.h * 0.06);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-P.w * 0.02, -P.h * 0.24);
      ctx.lineTo(-P.w * 0.02, P.h * 0.24);
      ctx.stroke();
      ctx.font = `600 ${Math.round(P.h * 0.036)}px ui-monospace, monospace`;
      ctx.fillStyle = '#33383f';
      for (let i = 0; i < 7; i++) {
        ctx.fillText(`0${i + 1}:${i % 2 ? '40' : '10'}`, -P.w * 0.13, -P.h * 0.16 + i * P.h * 0.06);
        ctx.fillText(i === 3 ? '—' : `7-${12 + i * 4}`, P.w * 0.02, -P.h * 0.16 + i * P.h * 0.06);
      }
      ctx.restore();
      vignette(P, 0.55);
      narrator(P, 'Sul tavolo, due fogli. Uno è il referto dell\'autopsia.\nL\'altro è il registro dei movimenti della gru: cosa ha spostato, e a che ora.');
    },
  },
  {
    // Oh parla senza voltarsi, e resta di spalle per tutto il pannello: non
    // guarda in faccia quello a cui sta consegnando la prova che lo ammazzerà.
    id: 'm4-4',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#161d21', '#080b0e', 0.5);
      glow(P, px(P, 0.62), py(P, 0.24), P.h * 0.7, '#cfe8dd', 0.22);
      block(P, px(P, 0.0), py(P, 0.02), P.w * 0.18, P.h * 0.52, '#101519');
      // Di spalle e **in alto**: le tre battute si prendono il terzo basso del
      // pannello, e una figura intera lì sotto è una figura che non c'è.
      // Con `crop` corto la nuca resta una sagoma tonda e sembra un vaso: le
      // spalle sono quello che la fa leggere come una persona di schiena.
      figure(P, 'sejung', px(P, 0.72), py(P, 0.47), unitScale(P, 0.46, 34), 'back', { crop: 34 });
      // Il foglio che gira verso di noi: è l'unico gesto della scena, quindi sta
      // dall'altra parte del pannello e in piena luce.
      ctx.save();
      ctx.translate(px(P, 0.32), py(P, 0.28));
      ctx.rotate(0.12);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-P.w * 0.1 + 4, -P.h * 0.14 + 5, P.w * 0.2, P.h * 0.28);
      ctx.fillStyle = '#e9e3d4';
      ctx.fillRect(-P.w * 0.1, -P.h * 0.14, P.w * 0.2, P.h * 0.28);
      ctx.fillStyle = 'rgba(40,38,34,0.5)';
      for (let i = 0; i < 5; i++) ctx.fillRect(-P.w * 0.08, -P.h * 0.1 + i * P.h * 0.05, P.w * (i === 2 ? 0.1 : 0.16), P.h * 0.012);
      ctx.restore();
      vignette(P, 0.5);
      speech(P, [
        { who: 'Oh', text: '«Il container del molo 7, quella notte, non è mai stato movimentato. Lo dice il registro della gru. Non lo dico io.»' },
        { who: 'Jae-min', text: '«Sul referto c\'è scritto che l\'ha schiacciato un container.»' },
        { who: 'Oh', text: '«Sul referto c\'è scritto quello che mi hanno fatto scrivere. Quell\'uomo è morto annegato.» (gli gira il foglio) «E era alto un metro e settantuno.»' },
      ]);
    },
  },
];

export const CHIUSURA = [
  {
    // L'alba, e il silenzio dopo. Dopo venti minuti di sparatoria e motovedette
    // questo pannello **non deve avere niente dentro**: è metà del suo lavoro.
    id: 'm4-5',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#f0b07a', '#5d6d86', 0.42);
      // Il sole basso, dietro la foschia: un disco tenue, non una palla.
      glow(P, px(P, 0.72), py(P, 0.34), P.h * 0.5, '#ffd7a0', 0.34);
      ctx.fillStyle = 'rgba(255,214,160,0.5)';
      ctx.beginPath();
      ctx.arc(px(P, 0.72), py(P, 0.34), P.h * 0.075, 0, Math.PI * 2);
      ctx.fill();
      // La riva lontana: una riga sola, bassa.
      ctx.fillStyle = 'rgba(40,52,66,0.75)';
      ctx.fillRect(P.x, py(P, 0.46), P.w, P.h * 0.03);
      ctx.fillStyle = '#4c5f74';
      ctx.fillRect(P.x, py(P, 0.49), P.w, P.h * 0.51);
      // L'acqua: righe orizzontali che si allargano verso il basso.
      for (let i = 0; i < 30; i++) {
        const v = 0.5 + hash(i * 4.1) * 0.48;
        ctx.fillStyle = `rgba(255,205,160,${0.05 + hash(i * 2.7) * 0.16})`;
        ctx.fillRect(px(P, hash(i * 7.3) * 0.9), py(P, v), P.w * (0.04 + hash(i * 3.1) * 0.12), 2);
      }
      // La barca, ferma, piccola e di taglio: se è grande diventa una fuga, e la
      // fuga è finita.
      ctx.fillStyle = '#20262e';
      ctx.beginPath();
      ctx.moveTo(px(P, 0.28), py(P, 0.72));
      ctx.lineTo(px(P, 0.52), py(P, 0.7));
      ctx.lineTo(px(P, 0.5), py(P, 0.77));
      ctx.lineTo(px(P, 0.3), py(P, 0.78));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#39434f';
      ctx.fillRect(px(P, 0.42), py(P, 0.665), P.w * 0.05, P.h * 0.04);
      vignette(P, 0.35);
      narrator(P, '05:12, foce del Han. Il motore è spento da un\'ora.\nL\'acqua batte sotto la prua ogni due secondi.');
    },
  },
  {
    // La riga cerchiata. Il pannello ha **un** lavoro: far leggere `171`. Quindi
    // il numero è grande, il cerchio non ci passa sopra, e non c'è altro.
    id: 'm4-6',
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#2a3138');
      // Il fondo della barca: doghe bagnate.
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i % 2 ? '#333c45' : '#2c343c';
        ctx.fillRect(P.x, py(P, i * 0.145), P.w, P.h * 0.145);
      }
      wetFloor(P, P.y, ['#8fb6e8'], { alpha: 0.16 });
      ctx.save();
      ctx.translate(px(P, 0.5), py(P, 0.5));
      ctx.rotate(-0.03);
      const w = P.w * 0.74;
      const h = P.h * 0.72;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-w / 2 + 6, -h / 2 + 7, w, h);
      // Bagnato: la carta è più scura sui bordi e trasparente agli angoli.
      ctx.fillStyle = '#d9d3c2';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = 'rgba(90,100,110,0.22)';
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.18);
      ctx.fillRect(-w / 2, h / 2 - h * 0.14, w, h * 0.14);
      ctx.fillStyle = BLOOD;
      ctx.fillRect(-w / 2, -h / 2, w, Math.max(2, h * 0.02));
      ctx.fillStyle = 'rgba(40,38,34,0.4)';
      for (let i = 0; i < 4; i++) ctx.fillRect(-w * 0.42, -h * 0.34 + i * h * 0.1, w * (i % 2 ? 0.62 : 0.44), h * 0.02);
      // La riga che conta.
      ctx.font = `800 ${Math.round(P.h * 0.11)}px ui-monospace, monospace`;
      ctx.fillStyle = '#1d1c19';
      ctx.textAlign = 'center';
      ctx.fillText('신장  171 cm', 0, h * 0.08);
      ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(170,45,55,0.9)';
      ctx.lineWidth = Math.max(2, P.h * 0.008);
      for (const r of [1, 0.94]) {
        ctx.beginPath();
        ctx.ellipse(0, h * 0.04, w * 0.3 * r, h * 0.11 * r, 0.02, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(40,38,34,0.4)';
      for (let i = 0; i < 3; i++) ctx.fillRect(-w * 0.42, h * 0.24 + i * h * 0.1, w * (i ? 0.5 : 0.66), h * 0.02);
      ctx.restore();
      vignette(P, 0.45);
      narrator(P, '신장 171 cm — statura, un metro e settantuno.\nSulla patente di Seo Dong-hyeok: un metro e ottantatré.');
    },
  },
  {
    // Le due stampe, affiancate. **Non c'è nessuna freccia e nessun cerchio**: la
    // differenza sta in mezzo alle due facce e il giocatore deve trovarla lui.
    //
    // La stampa del funerale è quella della cutscene (§5.28), disegnata com'è
    // disegnata la griglia; la fotografia vecchia è la stessa **specchiata**. Il
    // testo dice quello che si vede a schermo, e non il contrario: chi tocca
    // questo pannello controlli il pannello 11 dell'apertura prima di girare un
    // `flip`, o l'indizio si contraddice da solo.
    id: 'm4-7',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#1a2028', '#0c1014', 0.5);
      const foto = (u, flip, label) => {
        const w = P.w * 0.34;
        const h = P.h * 0.62;
        const x = px(P, u) - w / 2;
        const y = py(P, 0.2);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(x + 5, y + 6, w, h);
        ctx.fillStyle = '#ded7c6';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#4a5462';
        ctx.fillRect(x + w * 0.06, y + h * 0.05, w * 0.88, h * 0.76);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + w * 0.06, y + h * 0.05, w * 0.88, h * 0.76);
        ctx.clip();
        head(P, 'donghyeok', x + w * 0.5, y + h * 0.1, Math.max(1, Math.floor((h * 0.72) / 24)), { flip });
        ctx.restore();
        ctx.font = `600 ${Math.round(P.h * 0.036)}px ui-monospace, monospace`;
        ctx.fillStyle = '#2b2a26';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + w / 2, y + h * 0.93);
        ctx.textAlign = 'left';
      };
      foto(0.28, false, '11. 8.');
      foto(0.72, true, '3. 12. — 12년 전');
      vignette(P, 0.5);
      narrator(P, 'Nel ritratto del funerale la cicatrice sta a destra. In questa foto sta a sinistra.\nLa stampa del funerale è specchiata, e farne una così costa mille won.');
    },
  },
  {
    // Kkachi, sul quadrante della radio della barca. La domanda e la risposta:
    // due battute e basta, perché il riquadro delle battute cresce con il testo
    // e a cinque voci **esce dal pannello** — è successo al primo provino, e la
    // prima riga finiva sopra il bordo di sopra.
    id: 'm4-8',
    draw(P) {
      flat(P, '#080b10');
      glow(P, px(P, 0.5), py(P, 0.3), P.h * 0.5, AMBER, 0.14);
      dial(P, px(P, 0.16), py(P, 0.14), P.w * 0.68, P.h * 0.26, {
        from: 90, to: 93, mark: 91.45, label: '91.45',
      });
      speech(P, [
        { who: 'Jae-min', text: '«Chi c\'è nella bara.»' },
        { who: '91.45', kkachi: true, text: '«Uno che il 12 marzo è entrato in acqua e il 14 ne è uscito. Cinque mesi in un cassetto dell\'obitorio, e nessuno che lo cercasse.»' },
      ]);
    },
  },
  {
    // Il fruscio. **Un pannello quasi vuoto, e va tenuto**: senza voce il silenzio
    // di Kkachi va disegnato o non si sente (decisione 1 di `08-domande-aperte.md`),
    // e questi tre secondi sono metà del personaggio. Il quadrante è più in basso
    // e più spento del pannello prima: è la stessa radio, tre secondi dopo.
    id: 'm4-8b',
    draw(P) {
      const ctx = P.ctx;
      flat(P, '#06080c');
      glow(P, px(P, 0.5), py(P, 0.34), P.h * 0.42, AMBER, 0.08);
      dial(P, px(P, 0.22), py(P, 0.2), P.w * 0.56, P.h * 0.22, {
        from: 90, to: 93, mark: 91.45, label: '91.45',
      });
      // Il fruscio, disegnato: una banda di puntini che non dice niente.
      for (let i = 0; i < 220; i++) {
        ctx.fillStyle = `rgba(226,236,248,${hash(i * 3.1) * 0.14})`;
        ctx.fillRect(px(P, 0.22 + hash(i * 1.7) * 0.56), py(P, 0.46 + hash(i * 5.3) * 0.06), 2, 2);
      }
      speech(P, [
        { who: 'Jae-min', text: '«E mio padre dov\'è?»' },
        { who: '91.45', kkachi: true, text: '(fruscio, tre secondi) «Non ho detto niente di sbagliato, quindi non è quella la domanda.»' },
        { text: 'Parola per parola, la stessa frase della prima notte in macchina.', note: true },
      ]);
    },
  },
  {
    // L'ultimo pannello dell'atto: il molo di giorno, vuoto, con il sigillo
    // inchiodato sul container. La data è la stessa del manifesto di Hongdae, e
    // non lo dice nessuno: sta scritta due volte in due posti diversi.
    id: 'm4-9',
    draw(P) {
      const ctx = P.ctx;
      wash(P, '#b9c4d2', '#8b95a2', 0.5);
      ctx.fillStyle = '#7d8794';
      ctx.fillRect(P.x, py(P, 0.36), P.w, P.h * 0.64);
      containers(P, 0.12, 2, { seed: 21, h: 0.12 });
      crane(P, px(P, 0.84), py(P, 0.4), P.h * 0.3, '#7a848f');
      // Il container in primo piano: grande, e con la carta bianca sopra.
      ctx.fillStyle = '#4a5a52';
      ctx.fillRect(px(P, 0.1), py(P, 0.42), P.w * 0.62, P.h * 0.42);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      for (let i = 0; i < 12; i++) ctx.fillRect(px(P, 0.12 + i * 0.05), py(P, 0.42), P.w * 0.012, P.h * 0.42);
      poster(P, px(P, 0.24), py(P, 0.5), P.w * 0.2, P.h * 0.26, [
        { text: '감정 중' }, { text: '한성개발' }, { text: '9. 21.' },
      ], { tilt: 0.02 });
      sign(P, '7번 부두', px(P, 0.8), py(P, 0.9), { size: P.h * 0.07, color: '#3a4148', glowR: 0 });
      vignette(P, 0.3);
      narrator(P, 'Perizia in corso. Demolizione prevista: 21 settembre.\nÈ la stessa data del manifesto di Hongdae.');
    },
  },
];

// --- la missione --------------------------------------------------------------------

export const M4 = {
  id: 'm4',
  title: 'Molo 7',
  hangul: '7번 부두',
  act: 1,

  prepare(game) {
    const s = sites(game);
    if (!s.office) return;
    // Oh Se-jung sta all'ufficio di banchina, in strada e non dentro un edificio:
    // al porto non ci sono vetrine, e la sua stanza è un pannello. Come tutti gli
    // attori, se muore non torna — ed è quello che succede a metà missione.
    game.actors.define('sejung', {
      x: s.office.x, y: s.office.y,
      kind: 'civil', name: 'Oh Se-jung', hangul: '오세중',
      angle: -Math.PI / 2,
    });
  },

  phases: [
    {
      // Chun-sik chiama e chiede di **non** andare. Il giocatore ci va: è l'unica
      // missione dell'atto che comincia con qualcuno che prova a fermarlo.
      id: 'chiamata',
      hint: 'Chun-sik al telefono',
      enter(ctx) {
        ctx.unmark();
        ctx.talk([
          { who: 'Chun-sik', text: '«Al porto non ci vai.»' },
          { who: 'Jae-min', text: '«Non ti ho detto del porto.»' },
          { who: 'Chun-sik', text: '(pausa) «Al porto non ci vai lo stesso.»', note: 'Non ha chiesto quale molo.' },
        ], () => ctx.next());
      },
    },

    {
      id: 'porto',
      hint: 'Il molo 7, al porto di 인천 — dopo le dieci e mezza',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!s.office) { ctx.next(); return; }
        ctx.mark(s.office.x, s.office.y, { label: '7번 부두' });
        // L'ora è del copione, e come in M3 è un appuntamento: chi arriva di
        // giorno aspetta lì il buio invece di guardare l'orologio girare.
        ctx.point({
          id: 'notte',
          key: 'F',
          onFoot: false,
          text: 'aspetta che faccia notte',
          reach: 260,
          x: s.office.x, y: s.office.y,
          run: (c) => { c.waitUntil(APPUNTAMENTO); },
        });
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        const pl = ctx.game.player;
        if (ctx.game.indoors || !s.office) return;
        if (Math.hypot(pl.x - s.office.x, pl.y - s.office.y) < 130) ctx.next();
      },
    },

    panelPhase('m4-apertura', APERTURA),

    {
      // I due fogli. Da qui in poi il giocatore ha qualcosa in mano che può
      // perdere, ed è la prima volta in tutta la campagna.
      id: 'registro',
      hint: 'Prendi il referto e il registro',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        if (!s.office) { ctx.next(); return; }
        const p = game.actors.get('sejung');
        ctx.mark(s.office.x, s.office.y, { label: '7번 부두' });
        ctx.point({
          id: 'fogli',
          key: 'E',
          text: 'prendi i due fogli',
          reach: 70,
          x: p ? p.x : s.office.x,
          y: p ? p.y + 20 : s.office.y,
          run: (c) => {
            c.talk([
              { who: 'Oh', text: '«Li porti via tutti e due. Uno solo non vale niente: è la differenza fra i due che è un reato.»' },
              { who: 'Jae-min', text: '«E lei?»' },
              { who: 'Oh', text: '«Io ho firmato. Non è la stessa cosa che sapere.»' },
            ], () => {
              c.game.carry.take(c.game, FOGLI);
              c.next();
            });
          },
        });
      },
    },

    {
      // L'agguato. Sei uomini fra i container, che arrivano dai due capi: non è
      // una scena scritta a mano, sono pedoni ostili normali — quindi mischia,
      // raggi, coperture e onda d'urto li trovano senza sapere niente di M4.
      id: 'sparatoria',
      hint: 'Fuori si sono accesi sei fari',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        ctx.state.t = 0;
        ctx.state.caduto = ctx.state.caduto || 0;
        // **Prima di ogni altra cosa**, e anche quando la fase rientra solo per
        // far riprendere i fogli: chi era rimasto in piedi al tentativo prima se
        // ne va. Sei nuovi e sei vecchi sarebbero dodici — e soprattutto, mentre
        // eri in corsia lo streaming si è portato via i vecchi (`gone`), quindi
        // tenerli voleva dire una sparatoria che finisce da sola nel frame in cui
        // raccogli i fogli, senza che tu abbia sparato un colpo.
        sgombera(game);
        if (foglioPerso(ctx)) return;
        if (!s.office) { ctx.next(); return; }
        ctx.mark(s.office.x, s.office.y, { label: '7번 부두' });
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const s = sites(game);
        if (game.carry.dropped || !s.office) return;
        const pl = game.player;
        const lontano = game.indoors || Math.hypot(pl.x - s.office.x, pl.y - s.office.y) > 900;
        // **L'agguato nasce quando ci sei.** Nascere in `enter` voleva dire che
        // morire mandava sei uomini a presidiare un piazzale vuoto: lo streaming
        // se li portava via mentre eri in corsia (`gone`), e al ritorno la fase si
        // chiudeva da sola perché non era rimasto nessuno da battere.
        if (!M4._agguato) {
          if (lontano) return;
          const out = [];
          for (let i = 0; i < AGGUATO; i++) {
            const a = (i / AGGUATO) * Math.PI * 2 + 0.4;
            const r = 240 + (i % 3) * 90;
            const p = createPed('gangster', s.office.x + Math.cos(a) * r, s.office.y + Math.sin(a) * r, game.actors.rng);
            p.armed = true;
            p.hostile = true;
            p.state = 'hostile';
            game.peds.push(p);
            out.push(p);
          }
          M4._agguato = out;
          game.pedGrid.rebuild(game.peds);
          game.audio?.ui('deny');
          ctx.toast('Sei fari si accendono in fondo al piazzale', 3.6);
          return;
        }
        // Lontano dal molo la scena si mette in pausa invece di risolversi da sé.
        if (lontano) return;
        ctx.state.t += dt;
        const vivi = (M4._agguato || []).filter((p) => !p.dead && !p.gone);
        // Oh Se-jung cade a metà scena, e **il gioco non fa un pannello**: un
        // toast e il tonfo. Non muore dicendo l'ultima frase utile — l'ha già
        // detta, ed è quello che rende la sua morte quello che è.
        if (!ctx.state.caduto && ctx.state.t > CADE) {
          ctx.state.caduto = 1;
          game.actors.die('sejung', game, 0.2, 0.6);
          ctx.toast('Un tonfo fra due container, alle tue spalle. Poi niente.', 4);
        }
        if (vivi.length > 1 && ctx.state.t < 150) return;
        ctx.next();
      },
    },

    {
      // La gru. Non ci si sale — una quota percorribile non c'è — ma quello che
      // il copione voleva da lassù è *vedere quanto è grande il posto*, e quello
      // la camera lo sa fare: si allarga al minimo consentito per sette secondi.
      id: 'gru',
      hint: 'La gru in fondo al molo: da lassù si vede il varco',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        ctx.state.zoom = 0;
        if (foglioPerso(ctx)) return;
        const at = s.crane || s.office;
        if (!at) { ctx.next(); return; }
        ctx.mark(at.x, at.y, { label: '기중기' });
        ctx.point({
          id: 'gru',
          key: 'E',
          text: 'sali sulla gru',
          reach: 80,
          x: at.x, y: at.y,
          run: (c) => {
            c.talk([
              { text: 'La scaletta di servizio sale per quindici metri e finisce in una cabina di vetro con il vetro rotto.' },
              { text: 'Da quassù il porto finisce dove comincia il mare, e il mare non finisce.', note: 'Il varco è là in fondo: la testa del molo, e una barca all\'ormeggio.' },
            ], () => {
              c.game.camera.holdZoom(ZOOM_GRU, ZOOM_T + 1);
              c.state.zoom = ZOOM_T;
            });
          },
        });
      },
      tick(dt, ctx) {
        if (ctx.game.carry.dropped) return;
        if (!ctx.state.zoom) return;
        ctx.state.zoom -= dt;
        if (ctx.state.zoom > 0) return;
        ctx.game.camera.releaseZoom();
        ctx.game.camera.setZoomTarget(1);
        ctx.next();
      },
      leave(ctx) { ctx.game.camera.releaseZoom(); ctx.game.camera.setZoomTarget(1); },
    },

    {
      // La fuga in barca. Le tre stelle non sono una punizione: sono quello che
      // mette in acqua le motovedette e in aria l'elicottero (§5.5), cioè la
      // scena. Da tre stelle in su non si viene ammanettati, ed è voluto.
      id: 'barca',
      hint: 'Prendi la barca e scendi alla foce del Han',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        if (foglioPerso(ctx)) return;
        if (!s.foce) { ctx.next(); return; }
        if (game.wanted.level < 3) game.wanted.add(Math.max(0, 56 - game.wanted.heat), game);
        const b = barcaVicina(game, s.pier ? { x: s.pier.x, y: s.pier.y + s.pier.h / 2 } : s.office);
        M4._barca = b;
        if (b && game.player.onFoot) ctx.mark(b.x, b.y, { label: '배' });
        else ctx.mark(s.foce.x, s.foce.y, { label: '한강 하구' });
      },
      tick(dt, ctx) {
        const game = ctx.game;
        const s = sites(game);
        if (game.carry.dropped || !s.foce) return;
        const pl = game.player;
        const marine = !pl.onFoot && VEHICLE_TYPES[pl.vehicle?.kind]?.marine;
        // Il blip segue quello che manca: prima la barca, poi la foce.
        if (marine) ctx.mark(s.foce.x, s.foce.y, { label: '한강 하구' });
        else if (M4._barca && !M4._barca.dead) ctx.mark(M4._barca.x, M4._barca.y, { label: '배' });
        if (!marine) return;
        if (Math.hypot(pl.x - s.foce.x, pl.y - s.foce.y) > 320) return;
        // Arrivati: il motore si spegne e le stelle cadono. Non è un condono —
        // è l'alba del pannello dopo, e con quattro motovedette addosso quella
        // tavola non si guarda.
        game.wanted.reset();
        game.police.standDown(game, true);
        ctx.next();
      },
    },

    panelPhase('m4-chiusura', CHIUSURA),
  ],

  /**
   * Fine dell'atto, quasi: **i fogli restano in mano**. R1 comincia con Jae-min
   * in piedi davanti a Chun-sik che non li posa, e sarebbe una battuta senza
   * oggetto se qui li si buttasse via.
   */
  finish(game) {
    sgombera(game);
    game.missions.setFlag('bara');
    game.hud.toast('7번 부두 — completata', 3.2);
  },
};
