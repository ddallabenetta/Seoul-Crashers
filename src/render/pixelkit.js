// I personaggi dei pannelli, in pixel art.
//
// Decisione presa con l'utente: nei pannelli i soggetti devono **vedersi e essere
// riconoscibili**, non essere sagome intercambiabili. Lo stile è quello del
// riferimento del progetto (*GTA: Chinatown Wars*): pixel grossi, pochi colori,
// nessuna interpolazione. Vale il vincolo di sempre — nessun asset, tutto generato
// da codice — con la stessa cache offscreen di `sprites.js`.
//
// **Dove sta l'identità: nella testa.** Ogni personaggio è una griglia di
// caratteri 24×24 scritta a mano, che si legge nel sorgente come si legge uno
// sprite. Non è pigrizia tipografica: una faccia si riconosce da tre pixel messi
// bene — la stempiatura di Chun-sik, la visiera del tassista, la frangia del
// commesso — e quei tre pixel vanno *visti* mentre li si scrive.
//
// **Dove non sta: nel corpo.** Corpo, braccia, gambe e pose sono parametrici, un
// rettangolo per pezzo, perché una posa in più deve costare quattro righe e non
// una griglia nuova. La stessa testa vale in piedi, seduta e di spalle.
//
// **Le espressioni sono sovrapposte, non ribattute.** La griglia porta il volto a
// riposo; occhi e bocca si riscrivono sopra, alle celle che il modello riserva
// loro (`EYE_L`, `EYE_R`, `MOUTH`). Quattro stati bastano — fermo, parla, ride,
// occhi bassi — e costano una manciata di rettangoli invece di quattro griglie
// per personaggio.
//
// Un pixel qui è **sempre** un quadrato di lato `scale`, con `scale` intero e le
// coordinate arrotondate: mezzo pixel di scala e i quadrati escono di larghezza
// diversa, che è il modo più veloce di far sembrare rotta la pixel art.

// --- il modello della testa ----------------------------------------------------
//
// Tutte le griglie sono 24×24 e condividono lo stesso impianto, così le
// espressioni sanno dove guardare senza che ogni personaggio dichiari le sue
// coordinate:
//
//   colonne 0-2 e 21-23  aria e contorno
//   colonne 3-20         il volto (18 celle)
//   righe   1-8          capelli / copricapo
//   riga    11           sopracciglia
//   riga    12           occhi          → EYE_L = 5-8, EYE_R = 15-18
//   righe   14-15        naso
//   riga    17           bocca          → MOUTH = 9-14
//   righe   19-22        mascella
//   riga    23           collo
const EYE_L = { x: 5, w: 4 };
const EYE_R = { x: 15, w: 4 };
const MOUTH = { x: 9, w: 6 };
const EYE_ROW = 12;
const MOUTH_ROW = 17;
export const HEAD_UNITS = 24;

// I caratteri, uguali per tutti:
//   .  trasparente      #  inchiostro        h  capelli      H  capelli chiari
//   s  pelle            S  pelle in luce     d  pelle in ombra
//   w  bianco dell'occhio                    c  colore proprio (copricapo)
//   C  colore in luce   a  accento (montatura, visiera, cicatrice)
const HEADS = {
  // Seo Jae-min. Capelli corti e pieni, occhi stretti, mascella squadrata, bocca
  // dritta: nei pannelli non sorride mai, ed è il modo in cui si riconosce da
  // lontano prima ancora della faccia.
  jaemin: [
    '........................',
    '......############......',
    '....##hhhhhhhhhhhh##....',
    '...#hhhhhhhhhhhhhhhh#...',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#Hhhhhhhhhhhhhhhhhh#..',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssSS#..',
    '..#ss###ssssssss###ss#..',
    '..#ssw##wssssssw##wss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssss##ssssssss#..',
    '..#sssssssdd#ssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssss######ssssss#..',
    '..#ssssssssssssssssss#..',
    '...#ssssssssssssssss#...',
    '...#ssssssssssssssss#...',
    '....##ssssssssssss##....',
    '......############......',
    '.........#ssss#.........',
  ],

  // Ahn Chun-sik. Sessantuno anni e li porta tutti: faccia larga, capelli grigi
  // tirati indietro con le stempiature, sopracciglia spesse e alte, occhi ridotti
  // a due fessure allegre, bocca aperta. È l'unico che ride, in tutta la scena.
  chunsik: [
    '........................',
    '.......##########.......',
    '.....##hhhhhhhhhh##.....',
    '...##hhhhhhhhhhhhhh##...',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#hHhhhhhhhhhhhhhhHh#..',
    '..#ssshhhhhhhhhhhhsss#..',
    '..#ssssHhhhhhhhhhssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#s####ssssssss####s#..',
    '..#ss#ww#ssssss#ww#ss#..',
    '..#s####ssssssss####s#..',
    '..#sssssss####sssssss#..',
    '..#ssssssdd##ddssssss#..',
    '..#ssss#ssssssss#ssss#..',
    '..#sssss########sssss#..',
    '..#ssssssssssssssssss#..',
    '...#ssssssssssssssss#...',
    '..#ssssssssssssssssss#..',
    '...#ssss########ssss#...',
    '.....##############.....',
    '........#ssssss#........',
  ],

  // Il tassista. Non ha un nome e non gli serve: ha un berretto con la visiera e
  // gli occhiali, e sono le due cose che si vedono per prime in un pannello.
  tassista: [
    '........................',
    '.....##cccccccccc##.....',
    '...##cccccccccccccc##...',
    '..#CCCCCCCCCCCCCCCCCC#..',
    '..#cccccccccccccccccc#..',
    '.#aaaaaaaaaaaaaaaaaaaa#.',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ss###ssssssss###ss#..',
    '..#saaaaaaaaaaaaaaaas#..',
    '..#sawwwwassssawwwwas#..',
    '..#saw##wassssaw##was#..',
    '..#saaaaaassssaaaaaas#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssss##ssssssss#..',
    '..#sssssssdd#ssssssss#..',
    '..#ssssssshhhhssssssss..',
    '..#ssssss######ssssss#..',
    '..#ssssssssssssssssss#..',
    '...#ssssssssssssssss#...',
    '....#ssssssssssssss#....',
    '.....##ssssssssss##.....',
    '.......##########.......',
    '.........#ssss#.........',
  ],

  // Il commesso del 편의점. Diciannove anni: frangia lunga sugli occhi, faccia
  // stretta, occhi grandi e bocca piccola. Deve leggersi «ragazzo» in mezzo a una
  // scena piena di uomini di sessant'anni.
  commesso: [
    '........................',
    '......############......',
    '....##hhhhhhhhhhhh##....',
    '...#hhhhhhhhhhhhhhhh#...',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#hhhssssssssssshhhh#..',
    '..#ssssssssssssssssss#..',
    '..#sss##ssssssss##sss#..',
    '..#ssww#wwssssww#wwss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssss##ssssssss#..',
    '..#ssssssssdssssssssS#..',
    '..#sssssss####sssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssss#..',
    '...#ssssssssssssssss#...',
    '....#ssssssssssssss#....',
    '......##ssssssss##......',
    '........########........',
    '.........#ssss#.........',
  ],

  // Seo Dong-hyeok, il padre. Si vede una volta sola e da morto: è il ritratto
  // sul tavolo del funerale, e va ricordato per tre atti.
  //
  // LA CICATRICE STA A DESTRA DI CHI GUARDA (colonna 16, righe 13-16). Nella
  // realtà ce l'ha sulla guancia destra, quindi in una foto dritta si vedrebbe a
  // sinistra: **questa foto è specchiata**, ed è il primo indizio del gioco
  // (torna in M4). Non è un errore di disegno e non va «corretta».
  donghyeok: [
    '........................',
    '......############......',
    '....##hhhhhhhhhhhh##....',
    '...#hhhhhhhhhhhhhhhh#...',
    '..#HHhhhhhhhhhhhhhhHH#..',
    '..#HHhhhhhhhhhhhhhhHH#..',
    '..#HHhhhhhhhhhhhhhhHH#..',
    '..#sshhhhhhhhhhhhhhss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#s#####ssssss#####s#..',
    '..#ssw##wssssssw##wss#..',
    '..#sssssssssssssasssS#..',
    '..#ssssssss##sssasssS#..',
    '..#sssssssdd#sssasssS#..',
    '..#sssssssssssssasssS#..',
    '..#ssssss######ssssss#..',
    '..#ssssssssssssssssss#..',
    '...#ssssssssssssssss#...',
    '...#ssssssssssssssss#...',
    '....##ssssssssssss##....',
    '......############......',
    '.........#ssss#.........',
  ],
  // Jo Ok-bun. Settantotto anni, permanente grigia stretta, testa piccola. Gli
  // **occhi chiusi stanno nella griglia**, non nell'espressione: è cieca da nove
  // anni, e in tutti i pannelli in cui compare non li apre. Chi la disegna in un
  // pannello nuovo usi `fermo` o `parla` — `giu` le riscrive gli occhi con la
  // pelle e le riapre la faccia.
  jo: [
    '........................',
    '.....##############.....',
    '...##hhhhhhhhhhhhhh##...',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#hHhhhhhhhhhhhhhhHh#..',
    '..#hhHhhhhhhhhhhhhhhh#..',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#shhhhhhhhhhhhhhhhs#..',
    '..#sshhhhhhhhhhhhhhss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssSS#..',
    '..#ss###ssssssss###ss#..',
    '..#ss####ssssss####ss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssss##ssssssss#..',
    '..#sssssssdd#ssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#sssssss####sssssss#..',
    '..#ssssssssssssssssss#..',
    '...#ssssssssssssssss#...',
    '...#ssssssssssssssss#...',
    '....##ssssssssssss##....',
    '......############......',
    '.........#ssss#.........',
  ],

  // Yoon Ha-eun, ispettrice della omicidi di 종로. Quarantacinque anni, diciassette
  // di servizio. **I capelli raccolti sono la sua faccia**: la crocchia esce dal
  // profilo a destra, ed è l'unica sagoma del cast che sborda dalla testa — a
  // questa scala si riconosce prima dei lineamenti, che è quello che serve a un
  // personaggio che compare per due pannelli e torna cinque missioni dopo.
  // Sopracciglia dritte e bocca dritta: guarda e basta, come nella scena.
  haeun: [
    '........................',
    '.......##########.......',
    '.....##hhhhhhhhhh##.....',
    '...##hhhhhhhhhhhhhh##...',
    '..#hhhhhhhhhhhhhhhhhh#..',
    '..#hHhhhhhhhhhhhhhhhh#..',
    '..#hhhhhhhhhhhhhhhhhh#hh',
    '..#sshhhhhhhhhhhhhhss#hh',
    '..#ssssssssssssssssss#hh',
    '..#ssssssssssssssssss#h.',
    '..#ssssssssssssssssSS#..',
    '..#s####ssssssss####s#..',
    '..#ssw##wssssssw##wss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssss##ssssssss#..',
    '..#sssssssdd#ssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssss######ssssss#..',
    '..#ssssssssssssssssss#..',
    '...#ssssssssssssssss#...',
    '...#ssssssssssssssss#...',
    '....##ssssssssssss##....',
    '......############......',
    '.........#ssss#.........',
  ],

  // Oh Se-jung, medico legale. Sessantadue anni, e di lui si vedono **i baffi
  // grigi**: sono la sola cosa che lo separa da Chun-sik in un pannello di notte,
  // e stanno su una riga che le espressioni non riscrivono (la 16, sopra la
  // bocca). Stempiature alte e faccia lunga: uno che firma da trent'anni.
  sejung: [
    '........................',
    '.......##########.......',
    '.....##hhhhhhhhhh##.....',
    '...##hhhhhhhhhhhhhh##...',
    '..#sshhhhhhhhhhhhhhss#..',
    '..#sssHhhhhhhhhhhHsss#..',
    '..#sssssshhhhhhssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssSS#..',
    '..#ss###ssssssss###ss#..',
    '..#ssw##wssssssw##wss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssss##ssssssss#..',
    '..#sssssssdd#ssssssss#..',
    '..#sssssHHHHHHHHsssss#..',
    '..#ssssss######ssssss#..',
    '..#ssssssssssssssssss#..',
    '...#ssssssssssssssss#...',
    '...#ssssssssssssssss#...',
    '....##ssssssssssss##....',
    '......############......',
    '.........#ssss#.........',
  ],

  // Jeong Han-su, direttore del 병원. Gli **occhiali sono la sua faccia**: una
  // montatura in tre righe, che a questa scala è l'unica cosa che si legge da
  // lontano. Capelli grigi con le stempiature alte, bocca dritta: non commenta e
  // non si commuove, ed è quello che deve dire prima di aprire bocca.
  jeong: [
    '........................',
    '.......##########.......',
    '.....##hhhhhhhhhh##.....',
    '...##hhhhhhhhhhhhhh##...',
    '..#shhhhhhhhhhhhhhhhs#..',
    '..#sshhhhhhhhhhhhhhss#..',
    '..#sssHhhhhhhhhhhHsss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssssssssssssssSS#..',
    '..#saaaaaassssaaaaaas#..',
    '..#saw##wasaasaw##was#..',
    '..#saaaaaassssaaaaaas#..',
    '..#ssssssss##ssssssss#..',
    '..#sssssssdd#ssssssss#..',
    '..#ssssssssssssssssss#..',
    '..#ssssss######ssssss#..',
    '..#ssssssssssssssssss#..',
    '...#ssssssssssssssss#...',
    '...#ssssssssssssssss#...',
    '....##ssssssssssss##....',
    '......############......',
    '.........#ssss#.........',
  ],
};

// --- le tinte ------------------------------------------------------------------
//
// `skin`/`hair` fanno la testa, `coat`/`shirt`/`accent`/`pants` fanno il corpo.
// Sono separati apposta: Jae-min cambia giubbotto due volte nella scena e la
// faccia resta quella.
const INK = '#0d0f15';
const SKIN = { s: '#d3a37c', S: '#eec5a1', d: '#a4714b', w: '#eef2f8' };
// Il contorno chiaro attorno alla sagoma, e **si disegna sempre**.
//
// Al primo provino metà cast era invisibile: capelli quasi neri e contorno di
// inchiostro su un fondo notturno fanno un buco, non una figura — è la stessa
// trappola che nei pannelli vettoriali costò mezza tavola (§4). Un rim freddo
// funziona su tutti e due i lati: stacca dal nero di un vicolo e si legge lo
// stesso come bordo sul grigio chiaro di una sala.
const RIM = '#4d5768';

// I capelli non sono mai neri: nero su notte è un buco. Sono blu, bruni o grigi
// scuri, con una lumeggiatura di due toni sopra — è quella che dà la forma.
export const CAST = {
  jaemin: {
    head: 'jaemin',
    hair: '#241f2e', hairHi: '#453d55',
    coat: '#232a35', coatHi: '#333d4c', shirt: '#c9ced8', pants: '#1d212a',
    accent: '#c2384a', build: 10, name: 'Jae-min',
  },
  chunsik: {
    head: 'chunsik',
    hair: '#7b7883', hairHi: '#adaab5',
    coat: '#1b1c24', coatHi: '#2a2c37', shirt: '#e8ecf3', pants: '#1b1c24',
    accent: '#6d2c39', build: 14, name: 'Chun-sik',
  },
  tassista: {
    head: 'tassista',
    hair: '#2b2433', hairHi: '#443b4e',
    coat: '#2a3542', coatHi: '#3b4959', shirt: '#aeb8c6', pants: '#232b35',
    accent: '#161b23', cap: '#2b323e', capHi: '#3d4655', build: 9, name: 'Tassista',
  },
  commesso: {
    head: 'commesso',
    hair: '#272036', hairHi: '#463b5e',
    coat: '#1d5a44', coatHi: '#2a8062', shirt: '#dfe6ee', pants: '#252b34',
    accent: '#5fe0a8', build: 9, name: 'Commesso',
  },
  donghyeok: {
    head: 'donghyeok',
    hair: '#231e2b', hairHi: '#6f6b7a',
    coat: '#232833', coatHi: '#333a48', shirt: '#e4e9f1', pants: '#232833',
    // La cicatrice. Chiara sulla pelle, o non è un indizio: è un neo.
    accent: '#f0d3bb', build: 11, name: 'Seo Dong-hyeok',
  },
  jo: {
    head: 'jo',
    hair: '#8e8b93', hairHi: '#c3c0c9',
    coat: '#3a3038', coatHi: '#4e4149', shirt: '#d6cfc0', pants: '#2b242b',
    // L'ottone del banco dei pegni: è il colore della sua insegna e del suo mestiere.
    accent: '#c9a24a', build: 7, name: 'Jo Ok-bun',
  },
  haeun: {
    head: 'haeun',
    hair: '#2a2233', hairHi: '#4a3f57',
    // Il completo. È l'unica del cast vestita da ufficio, e in un pannello di
    // pioggia notturna la camicia chiara è quello che la stacca dal sedile.
    coat: '#26303f', coatHi: '#37455a', shirt: '#e2e8f1', pants: '#1f2734',
    accent: '#5a86c9', build: 8, name: 'Yoon Ha-eun',
  },
  sejung: {
    head: 'sejung',
    hair: '#8b8792', hairHi: '#c6c2cd',
    coat: '#3a3f46', coatHi: '#4c525b', shirt: '#cfd6de', pants: '#2c3037',
    accent: '#9fb4c9', build: 9, name: 'Oh Se-jung',
  },
  jeong: {
    head: 'jeong',
    hair: '#6a6270', hairHi: '#9c96a4',
    // Il camice. È l'unico personaggio del cast vestito di chiaro, e in un pannello
    // di corsia è quello che lo separa dal letto.
    coat: '#dbe1ea', coatHi: '#f1f4f9', shirt: '#93a8bd', pants: '#39424f',
    accent: '#5fe0a8', build: 9, name: 'Jeong Han-su',
  },
};

const CACHE = new Map();

/**
 * Griglia → canvas 1:1, una volta sola. Poi si ingrandisce e basta.
 *
 * `rim` è un secondo canvas con la sagoma **dilatata di una cella**: si disegna
 * sotto la testa e le dà il contorno chiaro. Costa una volta per personaggio e
 * risolve il problema che al primo provino rendeva metà cast invisibile.
 */
function bake(id) {
  let s = CACHE.get(id);
  if (s) return s;
  const spec = CAST[id];
  const grid = HEADS[spec.head];
  const pal = {
    '#': INK, h: spec.hair, H: spec.hairHi, ...SKIN,
    c: spec.cap || spec.coat, C: spec.capHi || spec.coatHi, a: spec.accent,
  };
  const h = grid.length;
  const w = grid[0].length;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const face = make();
  const fg = face.getContext('2d');
  const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && grid[y][x] !== '.';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = pal[grid[y][x]];
      if (!col) continue;
      fg.fillStyle = col;
      fg.fillRect(x, y, 1, 1);
    }
  }
  const rim = make();
  const rg = rim.getContext('2d');
  rg.fillStyle = RIM;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) rg.fillRect(x, y, 1, 1);
    }
  }
  s = { face, rim, w, h };
  CACHE.set(id, s);
  return s;
}

/**
 * La scala in pixel-schermo di un pixel-sprite, **intera**: `units` celle devono
 * occupare `frac` dell'altezza del pannello. Con una scala frazionaria alcuni
 * quadrati escono larghi n e altri n+1, e l'occhio lo vede subito.
 */
export function unitScale(P, frac, units) {
  return Math.max(1, Math.floor((P.h * frac) / units));
}

/** Un rettangolo in celle. Tutto quello che si disegna qui passa da qui. */
function cell(P, ox, oy, k, x, y, w, h, color) {
  if (!color || w <= 0 || h <= 0) return;
  P.ctx.fillStyle = color;
  P.ctx.fillRect(ox + x * k, oy + y * k, w * k, h * k);
}

/**
 * Una testa. `cx` è il centro, `topY` il bordo alto: il modello è alto
 * `HEAD_UNITS` celle, quindi chi impagina sa già dove finisce senza misurare.
 *
 * `mood` è l'espressione, e sono quattro perché quattro bastano a tutta la
 * scena: `fermo` (com'è disegnata), `parla`, `ride`, `giu` (occhi bassi).
 * Si sovrascrivono le celle che il modello riserva a occhi e bocca — chi
 * ridisegna una griglia deve tenerle dove sono, o qui si scrive sulla guancia.
 */
export function head(P, id, cx, topY, k, opts = {}) {
  const { mood = 'fermo', flip = false, dim = 0, rim = true } = opts;
  const s = bake(id);
  const ctx = P.ctx;
  const w = s.w * k;
  const ox = Math.round(cx - w / 2);
  // Un cenno del capo si legge prima degli occhi, e costa una cella.
  const oy = Math.round(topY) + (mood === 'giu' ? k : 0);

  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (flip) {
    ctx.translate(ox * 2 + w, 0);
    ctx.scale(-1, 1);
  }
  if (rim) ctx.drawImage(s.rim, ox, oy, w, s.h * k);
  ctx.drawImage(s.face, ox, oy, w, s.h * k);
  ctx.restore();
  ctx.imageSmoothingEnabled = prev;

  const put = (x, y, cw, ch, color) => cell(P, ox, oy, k, x, y, cw, ch, color);
  const eyes = (kind) => {
    for (const e of [EYE_L, EYE_R]) {
      put(e.x, EYE_ROW, e.w, 1, SKIN.s);
      if (kind === 'chiusi') {
        // Una riga intera di inchiostro sotto le sopracciglia. È poco, ed è
        // esattamente quello che legge come «occhi chiusi» a questa scala.
        put(e.x, EYE_ROW, e.w, 1, INK);
      } else if (kind === 'stretti') {
        // Sguardo basso: due fessure **corte**, al centro. Con la riga intera si
        // confondeva con gli occhi chiusi di chi ride, che è l'opposto.
        put(e.x + 1, EYE_ROW, e.w - 2, 1, INK);
      }
    }
  };
  if (mood === 'ride') {
    eyes('chiusi');
    // Bocca larga con gli **angoli in su**. Senza angoli è una smorfia, e con i
    // denti bianchi è un ringhio: al primo provino erano tutti e due insieme.
    put(MOUTH.x, MOUTH_ROW, MOUTH.w, 1, INK);
    put(MOUTH.x - 1, MOUTH_ROW - 1, 1, 1, INK);
    put(MOUTH.x + MOUTH.w, MOUTH_ROW - 1, 1, 1, INK);
    put(MOUTH.x + 1, MOUTH_ROW + 1, MOUTH.w - 2, 1, '#41202a');
  } else if (mood === 'giu') {
    eyes('stretti');
  } else if (mood === 'parla') {
    put(MOUTH.x + 1, MOUTH_ROW, MOUTH.w - 2, 1, INK);
    put(MOUTH.x + 1, MOUTH_ROW + 1, MOUTH.w - 2, 1, '#41202a');
  }
  if (dim > 0) {
    ctx.fillStyle = `rgba(4,6,10,${dim})`;
    ctx.fillRect(ox, oy, w, s.h * k);
  }
  return { x: ox, y: oy, w, h: s.h * k, k };
}

// --- il corpo ------------------------------------------------------------------
//
// Sotto la riga 23 della testa, in celle dello stesso reticolo. Le pose cambiano
// braccia e gambe e nient'altro: il busto è sempre lo stesso, ed è il motivo per
// cui aggiungerne una costa quattro righe.
//
// Si raccolgono prima tutti i rettangoli e si disegnano dopo, in due passate:
// **prima tutti allargati di una cella nel colore del rim, poi i pieni**. Un
// contorno disegnato pezzo per pezzo comparirebbe anche *dentro* la figura, fra
// un braccio e il busto.
const NECK = HEAD_UNITS;         // dove comincia il corpo
export const FIGURE_UNITS = 50;  // testa + corpo in piedi

/**
 * Un personaggio intero. `groundY` è dove poggiano i piedi; `k` la scala di una
 * cella (`unitScale`). `crop` taglia il corpo a una certa cella, e serve ai mezzi
 * busti: un primo piano che finisce nel nulla è meglio di un primo piano con due
 * gambe schiacciate in fondo.
 */
export function figure(P, id, cx, groundY, k, pose = 'stand', opts = {}) {
  const { mood = 'fermo', flip = false, coat = null, crop = FIGURE_UNITS, dim = 0, rim = true } = opts;
  const spec = CAST[id];
  const topY = groundY - crop * k;
  const ox = Math.round(cx - (HEAD_UNITS * k) / 2);
  const oy = Math.round(topY);
  const rects = [];
  const put = (x, y, w, h, color) => {
    if (!color || y >= crop) return;
    rects.push([x, y, w, Math.min(h, crop - y), color]);
  };

  const sw = Math.round(spec.build * 0.5) + 4;   // mezza spalla, in celle
  const c = 12;                                  // la colonna centrale del modello
  const jacket = coat || spec.coat;
  // La lumeggiatura non si può ereditare dal colore passato: quando un pannello
  // rivestiva Jae-min di nero, braccia e busto diventavano la stessa tinta e la
  // figura tornava una macchia.
  const jacketHi = coat ? shade(coat, 0.16) : spec.coatHi;
  const back = pose === 'back';
  const bend = pose === 'lean' ? 1 : 0;

  // Spalle e busto. Nel `back` la giacca copre anche il collo: è la nuca.
  put(c - sw, NECK, sw * 2, 3, jacket);
  put(c - sw + 1, NECK + 3, (sw - 1) * 2, 13, jacket);
  put(c - sw + 1, NECK + 3, 3, 13, jacketHi);        // la luce viene da sinistra
  if (!back) {
    put(c - 3, NECK, 6, 2, spec.shirt);
    put(c - 1, NECK + 2, 2, 7, spec.accent);
  } else {
    // La banda sulla schiena del bomber: è l'oggetto-tema del gioco, e di spalle
    // è l'unica cosa che si vede.
    put(c - sw + 1, NECK + 7, (sw - 1) * 2, 3, spec.accent);
  }

  const arm = (side) => {
    const x = side < 0 ? c - sw - 1 : c + sw - 1;
    if (pose === 'hug') {
      // Braccia aperte: salgono invece di scendere. È la posa di Chun-sik, e la
      // riconosci da lontano anche quando la faccia non si vede.
      put(x, NECK + 2, 2, 4, jacketHi);
      put(x + side * 2, NECK - 1, 2, 5, jacketHi);
      put(x + side * 4, NECK - 4, 2, 5, jacketHi);
      put(x + side * 4, NECK - 6, 2, 2, SKIN.s);
      return;
    }
    const len = pose === 'lean' ? 10 : 12;
    put(x, NECK + 2, 2, len, jacketHi);
    put(x, NECK + 2 + len, 2, 2, SKIN.s);            // la mano
  };
  arm(-1);
  arm(1);

  if (pose === 'seat' || pose === 'curb') {
    // Seduto: la coscia va avanti e lo stinco scende. Due rettangoli, e si legge.
    put(c - 3, NECK + 16, 10, 4, spec.pants);
    put(c + 4, NECK + 20, 4, 5, spec.pants);
    put(c + 3, NECK + 25, 6, 2, INK);
  } else {
    const spread = pose === 'walk' ? 2 : 0;
    put(c - 5 - spread, NECK + 16, 4, 9, spec.pants);
    put(c + 1 + spread, NECK + 16, 4, 9, spec.pants);
    put(c - 6 - spread, NECK + 25, 5, 2, INK);
    put(c + 1 + spread, NECK + 25, 5, 2, INK);
  }

  if (rim) for (const [x, y, w, h] of rects) cell(P, ox, oy, k, x - 1, y - 1, w + 2, h + 2, RIM);
  for (const [x, y, w, h, color] of rects) cell(P, ox, oy, k, x, y, w, h, color);

  // La testa per ultima: sta sopra il colletto, non sotto.
  if (back) {
    // Di spalle non c'è faccia: la nuca è la sola sagoma dei capelli. Serve a
    // Jae-min nel vicolo, ed è l'unico pannello in cui è giusto non vederlo —
    // ma va **sagomata**, o è un rettangolo con un giubbotto sotto.
    const nape = [
      [c - 6, 1, 12, 2, spec.hair],
      [c - 8, 3, 16, 2, spec.hair],
      [c - 9, 5, 18, 14, spec.hair],
      [c - 8, 19, 16, 2, spec.hair],
      [c - 6, 21, 12, 2, spec.hair],
      [c - 7, 6, 5, 7, spec.hairHi],      // la luce da sinistra, come sul busto
      [c - 3, 23, 6, 1, SKIN.d],          // il collo, sotto l'attaccatura
    ];
    if (rim) for (const [x, y, w, h] of nape) cell(P, ox, oy, k, x - 1, y - 1, w + 2, h + 2, RIM);
    for (const [x, y, w, h, col] of nape) cell(P, ox, oy, k, x, y, w, h, col);
  } else {
    head(P, id, cx + bend * k, oy, k, { mood, flip, dim, rim });
  }
  if (dim > 0 && back) {
    P.ctx.fillStyle = `rgba(4,6,10,${dim})`;
    P.ctx.fillRect(ox, oy, HEAD_UNITS * k, crop * k);
  }
  return { x: ox, y: oy, k };
}

/** `#rrggbb` schiarito di `amt`. Serve solo alle lumeggiature passate a mano. */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(v + (255 - v) * amt);
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

/**
 * La folla. Non sono personaggi e non devono diventarlo: stessa griglia, stessi
 * pixel quadrati, ma niente faccia — solo sagome in due tinte. Servono a far
 * vedere che Jae-min è **l'unico fermo**, che è il modo in cui lo si riconosce in
 * un pannello prima ancora di guardarlo in faccia.
 */
export function crowd(P, cx, groundY, k, n, opts = {}) {
  const { pose = 'stand', tint = '#252b38', spread = 15, seed = 1, crop = FIGURE_UNITS, rim = true } = opts;
  for (let i = 0; i < n; i++) {
    const r = Math.abs(Math.sin(seed * 37.1 + i * 91.7) * 43758.5453) % 1;
    const kk = Math.max(1, Math.round(k * (0.88 + r * 0.24)));
    const x = cx + (i - (n - 1) / 2) * spread * k + (r - 0.5) * k * 5;
    const y = groundY + (r - 0.5) * k * 2;
    silhouette(P, x, y, kk, pose, tint, r, crop, rim);
  }
}

function silhouette(P, cx, groundY, k, pose, tint, r, crop, rim) {
  const ox = Math.round(cx - (HEAD_UNITS * k) / 2);
  const oy = Math.round(groundY - crop * k);
  const c = 12;
  const rects = [];
  const put = (x, y, w, h) => {
    if (y >= crop) return;
    rects.push([x, y, w, Math.min(h, crop - y)]);
  };
  if (pose === 'kneel') {
    // In ginocchio si è **bassi**: la sagoma sta nell'ultimo terzo del riquadro,
    // o resta sospesa sopra il pavimento come una cassa.
    put(c - 5, 28, 10, 9);          // testa china
    put(c - 7, 37, 14, 8);          // schiena
    put(c - 9, 45, 18, 5);          // gambe piegate
  } else {
    put(c - 5, 0, 10, 10);          // testa
    put(c - 2, 10, 4, 3);           // collo
    put(c - 8, 13, 16, 15);         // busto
    const spread = pose === 'walk' ? Math.round(1 + r * 2) : 0;
    put(c - 6 - spread, 28, 5, 22);
    put(c + 1 + spread, 28, 5, 22);
  }
  if (rim) for (const [x, y, w, h] of rects) cell(P, ox, oy, k, x - 1, y - 1, w + 2, h + 2, '#39415222');
  for (const [x, y, w, h] of rects) cell(P, ox, oy, k, x, y, w, h, tint);
}

/**
 * Il cane. Non esiste nel gioco e non esisterà: serve in due pannelli fermi
 * (l'1 lo fa solo abbaiare, il 27 lo mostra) e da nessun'altra parte. Anche lui
 * a pixel, o nel pannello 27 sarebbe l'unica cosa liscia della tavola.
 */
export function dog(P, cx, groundY, k, color = '#1b1f2b') {
  const ox = Math.round(cx - 9 * k);
  const oy = Math.round(groundY - 12 * k);
  const rects = [
    [2, 4, 11, 4], [12, 1, 4, 4], [15, 3, 3, 2], [12, 0, 2, 1],
    [0, 3, 2, 3], [3, 8, 2, 4], [6, 8, 2, 4], [10, 8, 2, 4], [12, 8, 2, 4],
  ];
  for (const [x, y, w, h] of rects) cell(P, ox, oy, k, x - 1, y - 1, w + 2, h + 2, 'rgba(96,110,134,0.45)');
  for (const [x, y, w, h] of rects) cell(P, ox, oy, k, x, y, w, h, color);
}
