// Texture per le facciate estruse. Ogni texture è un overlay semitrasparente
// (finestre, nervature, marcapiani) disegnato sopra il colore base dell'edificio,
// così un solo set di texture serve tutte le tinte dei distretti.
export const FTW = 64;   // larghezza texture (mappata sulla lunghezza del muro)
export const FTH = 160;  // altezza texture (mappata sull'altezza dell'edificio)

const texCache = new Map();
const lightCache = new Map();
const gradCache = new Map();
const signCache = new Map();
let gradCtx = null;

const COL_BUCKETS = [3, 5, 8];
const ROW_BUCKETS = [2, 4, 7, 12, 18];

export function bucketCols(edgeLen) {
  const want = edgeLen / 30;
  let best = COL_BUCKETS[0];
  for (const c of COL_BUCKETS) if (Math.abs(c - want) < Math.abs(best - want)) best = c;
  return best;
}

export function bucketRows(height) {
  const want = height / 17;
  let best = ROW_BUCKETS[0];
  for (const r of ROW_BUCKETS) if (Math.abs(r - want) < Math.abs(best - want)) best = r;
  return best;
}

function newTex() {
  const c = document.createElement('canvas');
  c.width = FTW;
  c.height = FTH;
  return c;
}

function drawGlass(g, cols, rows, variant) {
  const cw = FTW / cols;
  const rh = FTH / rows;
  // Vetro continuo: fasce riflettenti orizzontali
  for (let r = 0; r < rows; r++) {
    const y = FTH - (r + 1) * rh;
    const refl = 0.05 + ((r * 7 + variant * 3) % 5) * 0.022;
    g.fillStyle = `rgba(190,230,255,${refl})`;
    g.fillRect(0, y + rh * 0.12, FTW, rh * 0.62);
    g.fillStyle = 'rgba(8,14,22,0.42)';
    g.fillRect(0, y + rh * 0.74, FTW, rh * 0.2);
  }
  // Montanti verticali
  g.fillStyle = 'rgba(255,255,255,0.1)';
  for (let c = 0; c <= cols * 2; c++) g.fillRect((c * FTW) / (cols * 2), 0, 0.9, FTH);
  // Qualche pannello opaco
  for (let r = 0; r < rows; r++) {
    if ((r * 13 + variant * 5) % 7 !== 0) continue;
    g.fillStyle = 'rgba(20,28,38,0.35)';
    g.fillRect(0, FTH - (r + 1) * rh, FTW, rh * 0.9);
  }
}

function drawWindowGrid(g, cols, rows, variant, opts) {
  const cw = FTW / cols;
  const rh = FTH / rows;
  const mw = cw * (opts.mw ?? 0.56);
  const mh = rh * (opts.mh ?? 0.5);
  for (let r = 0; r < rows; r++) {
    const y = FTH - (r + 1) * rh;
    // Marcapiano
    if (opts.band) {
      g.fillStyle = 'rgba(255,255,255,0.075)';
      g.fillRect(0, y + rh - 1.6, FTW, 1.6);
      g.fillStyle = 'rgba(0,0,0,0.13)';
      g.fillRect(0, y + rh, FTW, 1.1);
    }
    for (let c = 0; c < cols; c++) {
      const seedv = (r * 31 + c * 17 + variant * 11) % 100;
      if (seedv < (opts.skip ?? 6)) continue;
      const x = c * cw + (cw - mw) / 2;
      const wy = y + (rh - mh) / 2;
      g.fillStyle = 'rgba(9,13,19,0.72)';
      g.fillRect(x, wy, mw, mh);
      // Riflesso in alto a sinistra del vetro
      g.fillStyle = `rgba(180,215,240,${0.05 + (seedv % 4) * 0.02})`;
      g.fillRect(x, wy, mw * 0.55, mh * 0.4);
      // Telaio
      g.fillStyle = 'rgba(255,255,255,0.11)';
      g.fillRect(x - 0.7, wy - 0.7, mw + 1.4, 0.8);
      if (opts.balcony && r > 0 && (seedv % 3 === 0)) {
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.fillRect(x - cw * 0.1, wy + mh, mw + cw * 0.2, rh * 0.13);
        g.fillStyle = 'rgba(255,255,255,0.07)';
        g.fillRect(x - cw * 0.1, wy + mh, mw + cw * 0.2, 1);
      }
    }
  }
}

function drawBrick(g, cols, rows, variant) {
  // Corso di mattoni
  g.fillStyle = 'rgba(0,0,0,0.1)';
  for (let y = 0; y < FTH; y += 3.2) g.fillRect(0, y, FTW, 1);
  g.fillStyle = 'rgba(255,255,255,0.045)';
  for (let y = 0; y < FTH; y += 3.2) {
    const off = ((y / 3.2) | 0) % 2 ? 3 : 0;
    for (let x = off; x < FTW; x += 6) g.fillRect(x, y + 1, 1, 2);
  }
  drawWindowGrid(g, cols, rows, variant, { mw: 0.44, mh: 0.42, skip: 10, band: false });
}

/**
 * Serra (비닐하우스): telo di plastica teso su centine. Non ha finestre né porte —
 * ed è proprio l'assenza di aperture a farla leggere come una serra e non come un
 * capannone basso.
 */
function drawGreenhouse(g, cols, rows, variant) {
  const gr = g.createLinearGradient(0, 0, 0, FTH);
  gr.addColorStop(0, 'rgba(255,255,255,0.3)');
  gr.addColorStop(0.45, 'rgba(220,235,225,0.14)');
  gr.addColorStop(1, 'rgba(120,140,125,0.2)');
  g.fillStyle = gr;
  g.fillRect(0, 0, FTW, FTH);
  // Centine
  const ribs = Math.max(4, cols * 2);
  g.fillStyle = 'rgba(255,255,255,0.22)';
  for (let i = 0; i < ribs; i++) g.fillRect((i * FTW) / ribs, 0, 1.6, FTH);
  // Riflesso lungo il colmo e cordolo a terra
  g.fillStyle = 'rgba(255,255,255,0.3)';
  g.fillRect(0, FTH * 0.1, FTW, FTH * 0.06);
  g.fillStyle = 'rgba(40,50,40,0.4)';
  g.fillRect(0, FTH * 0.9, FTW, FTH * 0.1);
}

function drawWarehouse(g, cols, rows, variant) {
  // Lamiera ondulata verticale
  for (let x = 0; x < FTW; x += 3) {
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(x, 0, 1.4, FTH);
    g.fillStyle = 'rgba(0,0,0,0.1)';
    g.fillRect(x + 1.6, 0, 1.4, FTH);
  }
  // Nastro di finestre alto
  g.fillStyle = 'rgba(9,13,19,0.6)';
  g.fillRect(2, FTH * 0.06, FTW - 4, FTH * 0.1);
  g.fillStyle = 'rgba(190,220,240,0.09)';
  g.fillRect(2, FTH * 0.06, FTW - 4, FTH * 0.045);
  // Portoni a saracinesca in basso
  const bays = Math.max(2, cols - 1);
  for (let i = 0; i < bays; i++) {
    if ((i * 7 + variant * 3) % 3 === 0) continue;
    const bw = FTW / bays;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(i * bw + bw * 0.16, FTH * 0.62, bw * 0.68, FTH * 0.38);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = FTH * 0.64; y < FTH; y += 3) g.fillRect(i * bw + bw * 0.16, y, bw * 0.68, 1);
  }
}

function drawContainer(g, cols, rows, variant) {
  for (let x = 0; x < FTW; x += 4) {
    g.fillStyle = 'rgba(255,255,255,0.09)';
    g.fillRect(x, 0, 2, FTH);
    g.fillStyle = 'rgba(0,0,0,0.13)';
    g.fillRect(x + 2, 0, 2, FTH);
  }
  // Fasce di separazione tra i container impilati
  const stacks = Math.max(1, variant);
  for (let s = 1; s < stacks; s++) {
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(0, (FTH * s) / stacks - 1.5, FTW, 3);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, FTW, 3);
  g.fillRect(0, FTH - 3, FTW, 3);
}

function drawWall(g) {
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fillRect(0, 0, FTW, 3);
  g.fillStyle = 'rgba(0,0,0,0.14)';
  for (let x = 0; x < FTW; x += 8) g.fillRect(x, 0, 1, FTH);
}

function drawTower(g) {
  const grad = g.createLinearGradient(0, 0, FTW, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.25)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = grad;
  g.fillRect(0, 0, FTW, FTH);
  for (let y = 0; y < FTH; y += 9) {
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, y, FTW, 1.6);
  }
  // Corona dell'osservatorio
  g.fillStyle = 'rgba(10,16,24,0.5)';
  g.fillRect(0, FTH * 0.02, FTW, FTH * 0.07);
  g.fillStyle = 'rgba(120,220,255,0.18)';
  g.fillRect(0, FTH * 0.03, FTW, FTH * 0.03);
}

function drawHill(g) {
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * FTW;
    const y = Math.random() * FTH;
    g.fillStyle = `rgba(${20 + Math.random() * 40 | 0},${40 + Math.random() * 50 | 0},${20 + Math.random() * 30 | 0},0.5)`;
    g.beginPath();
    g.arc(x, y, 1 + Math.random() * 3, 0, 6.2832);
    g.fill();
  }
}

export function facadeTexture(style, cols, rows, variant) {
  const key = `${style}:${cols}:${rows}:${variant}`;
  let t = texCache.get(key);
  if (t) return t;
  const c = newTex();
  const g = c.getContext('2d');
  switch (style) {
    case 'glass': drawGlass(g, cols, rows, variant); break;
    case 'concrete': drawWindowGrid(g, cols, rows, variant, { band: true, balcony: true }); break;
    case 'panel': drawWindowGrid(g, cols, rows, variant, { mw: 0.72, mh: 0.42, band: true, skip: 4 }); break;
    case 'brick': drawBrick(g, cols, rows, variant); break;
    case 'warehouse': drawWarehouse(g, cols, rows, variant); break;
    case 'greenhouse': drawGreenhouse(g, cols, rows, variant); break;
    case 'container': drawContainer(g, cols, rows, variant); break;
    case 'wall': drawWall(g); break;
    case 'tower': drawTower(g); break;
    case 'hill': drawHill(g); break;
    default: drawWindowGrid(g, cols, rows, variant, { band: true }); break;
  }
  texCache.set(key, c);
  return c;
}

// --- Finestre accese ---------------------------------------------------------
// Overlay separato, disegnato in `lighter` sopra la facciata con l'intensità
// della sera. Vale la pena di una seconda cache: il palazzo di giorno e quello
// di notte sono la stessa texture più questa, non due texture diverse.

// Tinte delle finestre accese: il giallo caldo è casa, il bianco freddo è un
// neon d'ufficio. Averle mescolate è quello che fa leggere un palazzo come
// abitato invece che come un pannello luminoso.
const BULBS = ['rgba(255,206,120,', 'rgba(255,184,96,', 'rgba(214,232,255,', 'rgba(255,232,178,'];

/** Quante finestre restano accese, e di che colore. Deterministico dal seed della facciata. */
function litWindows(g, cols, rows, variant, opts) {
  const cw = FTW / cols;
  const rh = FTH / rows;
  const mw = cw * (opts.mw ?? 0.56);
  const mh = rh * (opts.mh ?? 0.5);
  for (let r = 0; r < rows; r++) {
    const y = FTH - (r + 1) * rh;
    for (let c = 0; c < cols; c++) {
      const seedv = (r * 31 + c * 17 + variant * 11) % 100;
      if (seedv < (opts.skip ?? 6)) continue;          // qui la finestra non c'è
      const roll = (seedv * 7 + r * 13 + c * 5) % 100;
      if (roll > (opts.lit ?? 46)) continue;
      const x = c * cw + (cw - mw) / 2;
      const wy = y + (rh - mh) / 2;
      const bulb = BULBS[(seedv + r) % BULBS.length];
      g.fillStyle = `${bulb}${(0.5 + (roll % 5) * 0.09).toFixed(2)})`;
      g.fillRect(x, wy, mw, mh);
      // Un'ombra dentro al vetro: senza, la finestra accesa è un rettangolo piatto.
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(x + mw * 0.55, wy + mh * 0.45, mw * 0.45, mh * 0.55);
      // Alone sul muro attorno
      g.fillStyle = `${bulb}0.12)`;
      g.fillRect(x - 1.4, wy - 1.4, mw + 2.8, mh + 2.8);
    }
  }
}

function litGlass(g, cols, rows, variant) {
  const rh = FTH / rows;
  for (let r = 0; r < rows; r++) {
    if ((r * 11 + variant * 7) % 5 > 2) continue;
    const y = FTH - (r + 1) * rh;
    // Nei grattacieli si accende il piano intero, non la singola finestra: sono
    // open space, e di notte da fuori si vede la fascia illuminata.
    g.fillStyle = `rgba(206,228,255,${(0.24 + ((r * 3 + variant) % 4) * 0.05).toFixed(2)})`;
    g.fillRect(0, y + rh * 0.12, FTW, rh * 0.62);
  }
}

function litWarehouse(g) {
  g.fillStyle = 'rgba(226,238,255,0.4)';
  g.fillRect(2, FTH * 0.06, FTW - 4, FTH * 0.1);
}

function litGreenhouse(g) {
  // Le serre coreane si illuminano di notte per allungare la giornata alle
  // piante: da lontano sono lanterne posate nei campi, ed è uno dei pochi segni
  // di vita che ha la campagna dopo il tramonto.
  const gr = g.createLinearGradient(0, 0, 0, FTH);
  gr.addColorStop(0, 'rgba(255,238,190,0.4)');
  gr.addColorStop(1, 'rgba(255,214,140,0.16)');
  g.fillStyle = gr;
  g.fillRect(0, 0, FTW, FTH);
}

function litTower(g) {
  g.fillStyle = 'rgba(150,230,255,0.55)';
  g.fillRect(0, FTH * 0.03, FTW, FTH * 0.03);
  g.fillStyle = 'rgba(255,120,150,0.22)';
  g.fillRect(0, FTH * 0.09, FTW, FTH * 0.012);
}

/**
 * Strato delle luci accese di una facciata, o null se quello stile non si
 * illumina (muri di cinta, container, colline). Va disegnato in `lighter` con
 * alpha pari a quanto è calata la sera.
 */
export function facadeLights(style, cols, rows, variant) {
  const key = `${style}:${cols}:${rows}:${variant}`;
  if (lightCache.has(key)) return lightCache.get(key);
  let c = null;
  const make = () => { c = newTex(); return c.getContext('2d'); };
  switch (style) {
    case 'glass': litGlass(make(), cols, rows, variant); break;
    case 'concrete': litWindows(make(), cols, rows, variant, { lit: 52 }); break;
    case 'panel': litWindows(make(), cols, rows, variant, { mw: 0.72, mh: 0.42, skip: 4, lit: 58 }); break;
    case 'brick': litWindows(make(), cols, rows, variant, { mw: 0.44, mh: 0.42, skip: 10, lit: 44 }); break;
    case 'warehouse': litWarehouse(make()); break;
    case 'greenhouse': litGreenhouse(make()); break;
    case 'tower': litTower(make()); break;
    case 'container': case 'wall': case 'hill': break;
    default: litWindows(make(), cols, rows, variant, { lit: 50 }); break;
  }
  lightCache.set(key, c);
  return c;
}

/**
 * Gradiente verticale in coordinate texture (0 = base a terra, FTH = tetto).
 * side determina quanta luce prende la facciata (sole da nord-ovest).
 */
export function facadeGradient(ctx, color, side) {
  if (gradCtx !== ctx) {
    gradCache.clear();
    gradCtx = ctx;
  }
  const key = `${color}:${side}`;
  let gr = gradCache.get(key);
  if (gr) return gr;
  const light = side === 'top' ? 0.2 : side === 'left' ? 0.1 : side === 'right' ? -0.16 : -0.24;
  gr = ctx.createLinearGradient(0, 0, 0, FTH);
  gr.addColorStop(0, mix(color, -0.5 + light * 0.5));
  gr.addColorStop(0.45, mix(color, -0.2 + light));
  gr.addColorStop(1, mix(color, 0.06 + light));
  gradCache.set(key, gr);
  return gr;
}

/** Schiarisce (amt > 0) o scurisce (amt < 0) un colore esadecimale. */
export function mix(hex, amt) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const t = amt > 0 ? 255 : 0;
  const p = Math.min(1, Math.abs(amt));
  return `rgb(${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)})`;
}

/** Insegna al neon pre-renderizzata, montata sulla facciata. */
export function signSprite(word, color, vertical) {
  const key = `${word}:${color}:${vertical ? 'v' : 'h'}`;
  let s = signCache.get(key);
  if (s) return s;
  const SS = 2;
  const chars = [...word];
  const cell = 15;
  const w = vertical ? cell : cell * chars.length * 0.95;
  const h = vertical ? cell * chars.length : cell;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SS);
  c.height = Math.ceil(h * SS);
  const g = c.getContext('2d');
  g.scale(SS, SS);

  // Cassonetto scuro + bordo luminoso
  g.fillStyle = 'rgba(16,16,20,0.9)';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = color;
  g.lineWidth = 1.2;
  g.strokeRect(0.8, 0.8, w - 1.6, h - 1.6);
  g.shadowColor = color;
  g.shadowBlur = 6;
  g.fillStyle = color;
  g.font = `bold ${cell * 0.72}px system-ui, "Apple SD Gothic Neo", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (vertical) {
    chars.forEach((ch, i) => g.fillText(ch, w / 2, cell * (i + 0.5)));
  } else {
    g.fillText(word, w / 2, h / 2 + 0.5);
  }
  s = { canvas: c, w, h };
  signCache.set(key, s);
  return s;
}
