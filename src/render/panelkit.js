// Le primitive con cui si disegna un pannello a fumetto.
//
// Stesso patto degli sprite (§5.4): nessun asset, tutto path su canvas, e **un
// pannello = una funzione**. Qui stanno solo i pezzi che tornano in più pannelli —
// sagome, insegne, pioggia, palazzi, un'auto, il quadrante della radio; il resto
// se lo disegna il pannello, che è il posto giusto perché lo usa una volta sola.
//
// **Si disegna dritti sul contesto del gioco, dentro un rettangolo ritagliato, non
// su un canvas offscreen.** Il copione diceva offscreen (`08-domande-aperte.md`,
// punto 6) e il senso era «niente asset in cache, si butta dopo»: quello vale
// ancora. Ma un canvas grande allocato a ogni frame per una pioggia che si muove
// costa più della pioggia, e il ritaglio dà lo stesso risultato con meno pezzi.
//
// Le facce non hanno tratti: si leggono dalla posa (regola della scena). Ogni
// pannello sta su due o tre colori, come una tavola stampata male.
import { wrapLines, drawParagraph } from '../ui/text.js';

export const INK = '#07080b';
export const PAPER = '#eef2f8';
export const PINK = '#ff5fa2';
export const CYAN = '#38d6ff';
export const AMBER = '#ffb163';
export const GREEN = '#5fe0a8';
export const BLOOD = '#c2384a';

const SANS = 'system-ui, "Apple SD Gothic Neo", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * Rumore ripetibile a partire da un indice. La pioggia deve stare ferma di goccia
 * in goccia e muoversi solo nel tempo: con `Math.random()` per goccia sfarfalla,
 * ed è il tipo di bruttura che nel sorgente non si vede.
 */
export function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Il rettangolo del pannello: cinematografico, centrato, con aria attorno. */
export function panelRect(w, h) {
  const maxW = Math.min(w - 96, 1180);
  const maxH = h - 150;
  let pw = maxW;
  let ph = pw * 0.5625;
  if (ph > maxH) { ph = maxH; pw = ph / 0.5625; }
  return { x: Math.round((w - pw) / 2), y: Math.round((h - ph) / 2 - 14), w: Math.round(pw), h: Math.round(ph) };
}

/** Coordinate relative: un pannello si scrive in frazioni, non in pixel. */
export function px(P, u) { return P.x + u * P.w; }
export function py(P, v) { return P.y + v * P.h; }

export function clipPanel(P) {
  P.ctx.save();
  P.ctx.beginPath();
  P.ctx.rect(P.x, P.y, P.w, P.h);
  P.ctx.clip();
}

export function unclip(P) { P.ctx.restore(); }

// --- fondi --------------------------------------------------------------------

export function flat(P, color) {
  P.ctx.fillStyle = color;
  P.ctx.fillRect(P.x, P.y, P.w, P.h);
}

export function wash(P, top, bottom, split = 1) {
  const g = P.ctx.createLinearGradient(0, P.y, 0, P.y + P.h * split);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  P.ctx.fillStyle = g;
  P.ctx.fillRect(P.x, P.y, P.w, P.h);
}

/** Buio ai bordi. Tiene insieme una tavola fatta di tinte piatte. */
export function vignette(P, strength = 0.5) {
  const ctx = P.ctx;
  const g = ctx.createRadialGradient(
    P.x + P.w / 2, P.y + P.h / 2, P.h * 0.25,
    P.x + P.w / 2, P.y + P.h / 2, P.h * 0.95
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(P.x, P.y, P.w, P.h);
}

export function glow(P, x, y, r, color, a = 0.5) {
  const ctx = P.ctx;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, a));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** `#rrggbb` + alfa in `rgba()`. I colori del kit sono esadecimali, i veli no. */
export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// --- città --------------------------------------------------------------------

/**
 * Un palazzo piatto con le finestre accese. `lit` è la frazione di finestre
 * accese: 0 di giorno, 0.4 di notte, 1 solo per un ospedale.
 */
export function block(P, x, y, w, h, color, opts = {}) {
  const ctx = P.ctx;
  const { lit = 0, window: wc = AMBER, seed = 1, cols = 0, rows = 0 } = opts;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (lit <= 0) return;
  const nc = cols || Math.max(2, Math.round(w / 22));
  const nr = rows || Math.max(2, Math.round(h / 26));
  const gw = w / nc, gh = h / nr;
  for (let i = 0; i < nc; i++) {
    for (let j = 0; j < nr; j++) {
      if (hash(seed * 97 + i * 13 + j * 7) > lit) continue;
      ctx.fillStyle = hexA(wc, 0.55 + hash(seed + i + j * 3) * 0.45);
      ctx.fillRect(x + i * gw + gw * 0.28, y + j * gh + gh * 0.24, gw * 0.44, gh * 0.4);
    }
  }
}

/** Una fila di palazzi con la base su `baseY`, per riempire un fondo. */
export function skyline(P, baseY, opts = {}) {
  const { color = '#12161e', min = 0.1, max = 0.36, step = 0.055, lit = 0, seed = 3, from = 0, to = 1 } = opts;
  for (let u = from; u < to; u += step) {
    const s = hash(seed * 31 + u * 211);
    const h = (min + s * (max - min)) * P.h;
    const w = step * P.w * (0.82 + hash(seed + u * 97) * 0.5);
    block(P, px(P, u), baseY - h, w, h, color, { lit, seed: seed + u * 100 });
  }
}

/**
 * Un'insegna in hangul. Il neon è il colore più il suo alone: due passate, perché
 * un neon senza alone letto su fondo scuro sembra un adesivo.
 */
export function sign(P, text, x, y, opts = {}) {
  const ctx = P.ctx;
  const { size = 22, color = PINK, glowR = 60, box = false, align = 'center' } = opts;
  if (box) {
    const w = size * text.length * 0.92 + 18;
    ctx.fillStyle = 'rgba(6,7,10,0.72)';
    ctx.fillRect(x - (align === 'center' ? w / 2 : 0), y - size * 1.05, w, size * 1.5);
  }
  glow(P, x, y - size * 0.35, glowR, color, 0.34);
  ctx.textAlign = align;
  ctx.font = `700 ${size}px ${SANS}`;
  ctx.fillStyle = hexA(color, 0.35);
  ctx.fillText(text, x, y + 1.5);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

/**
 * Il manifesto della demolizione. Torna in tre pannelli e tornerà in tutto
 * l'Atto I: incollato storto, sempre.
 */
export function poster(P, x, y, w, h, lines, opts = {}) {
  const ctx = P.ctx;
  const { tilt = -0.04, paper = '#e8e2d4', ink = '#1b1b1f', accent = BLOOD } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(3, 4, w, h);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, w, Math.max(3, h * 0.05));
  ctx.textAlign = 'center';
  lines.forEach((l, i) => {
    const s = l.size || (i === 0 ? h * 0.24 : h * 0.13);
    ctx.font = `${i === 0 ? '800' : '600'} ${s}px ${SANS}`;
    ctx.fillStyle = l.color || (i === 0 ? ink : 'rgba(27,27,31,0.72)');
    ctx.fillText(l.text, w / 2, h * (l.at ?? (0.36 + i * 0.24)));
  });
  ctx.textAlign = 'left';
  ctx.restore();
}

/**
 * Pioggia. `amount` va da 0 (niente) a 1 (il temporale del pannello 9). Le gocce
 * sono righe inclinate che scorrono in loop: la posizione è ferma per goccia
 * (`hash`), a muoversi è solo la fase.
 */
export function rain(P, amount, opts = {}) {
  if (amount <= 0) return;
  const ctx = P.ctx;
  const { angle = 0.28, color = 'rgba(190,214,240,', speed = 1.7, len = 0.11 } = opts;
  const n = Math.round(amount * 150);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < n; i++) {
    const ux = hash(i * 3.1);
    const phase = (hash(i * 7.7) + P.t * speed * (0.7 + hash(i * 5.3) * 0.6)) % 1;
    const x = P.x + ux * P.w + phase * P.h * angle;
    const y = P.y + phase * P.h * 1.05 - P.h * 0.05;
    const l = P.h * len * (0.5 + hash(i * 11.3) * 0.8);
    ctx.strokeStyle = `${color}${0.12 + hash(i * 2.9) * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - l * angle, y + l);
    ctx.stroke();
  }
}

/** Asfalto bagnato: strisce verticali di riflesso sotto una linea d'orizzonte. */
export function wetFloor(P, topY, colors, opts = {}) {
  const ctx = P.ctx;
  const { alpha = 0.3, seed = 5 } = opts;
  ctx.save();
  ctx.beginPath();
  ctx.rect(P.x, topY, P.w, P.y + P.h - topY);
  ctx.clip();
  colors.forEach((c, k) => {
    for (let i = 0; i < 5; i++) {
      const u = hash(seed * 17 + k * 31 + i * 7);
      const w = P.w * (0.012 + hash(seed + i * 3 + k) * 0.03);
      ctx.fillStyle = hexA(c, alpha * (0.4 + hash(seed + i) * 0.6));
      ctx.fillRect(px(P, u), topY, w, P.y + P.h - topY);
    }
  });
  ctx.restore();
}

// Le persone non stanno qui: stanno in `render/pixelkit.js`.
//
// Fino al primo provino erano sagome vettoriali con nove pose e nessun tratto sul
// viso. La decisione presa con l utente le ha sostituite con pixel art vera —
// volti disegnati, personaggi riconoscibili — e tenere due sistemi di persone
// voleva dire che il terzo pannello avrebbe usato quello sbagliato.

// --- cose ---------------------------------------------------------------------

/** Una berlina piatta, di profilo. Serve in sei pannelli e non è mai la stessa. */
export function car(P, x, y, s, color = '#14161c', opts = {}) {
  const ctx = P.ctx;
  const { flip = false, lights = false, glass = '#2b3a4d', wipers = false, dusty = false } = opts;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = color;
  ctx.beginPath();                                            // scocca
  ctx.moveTo(-s * 0.5, 0);
  ctx.lineTo(-s * 0.46, -s * 0.16);
  ctx.lineTo(-s * 0.2, -s * 0.19);
  ctx.lineTo(-s * 0.06, -s * 0.33);
  ctx.lineTo(s * 0.16, -s * 0.33);
  ctx.lineTo(s * 0.29, -s * 0.19);
  ctx.lineTo(s * 0.48, -s * 0.15);
  ctx.lineTo(s * 0.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = glass;
  ctx.fillRect(-s * 0.045, -s * 0.31, s * 0.19, s * 0.12);
  if (dusty) {
    ctx.fillStyle = 'rgba(190,180,160,0.14)';
    ctx.fillRect(-s * 0.5, -s * 0.2, s, s * 0.2);
  }
  ctx.fillStyle = '#05070a';
  for (const dx of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(dx * s, 0, s * 0.088, 0, Math.PI * 2);
    ctx.fill();
  }
  if (lights) {
    ctx.fillStyle = AMBER;
    ctx.fillRect(s * 0.46, -s * 0.13, s * 0.05, s * 0.05);
    glow(P, x + (flip ? -1 : 1) * s * 0.5, y - s * 0.11, s * 0.34, AMBER, 0.42);
  }
  if (wipers) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = Math.max(1, s * 0.012);
    const a = Math.sin(P.t * 5.5) * 0.42;
    ctx.save();
    ctx.translate(s * 0.16, -s * 0.19);
    ctx.rotate(-1.1 + a);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.14); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Il quadrante della radio. Torna in tre pannelli (8, 25, 26) ed è il filo della
 * scena: `mark` è dove sta la lancetta, e mezza tacca fuori posto è tutto il
 * personaggio di Kkachi.
 */
export function dial(P, x, y, w, h, opts = {}) {
  const ctx = P.ctx;
  const { from = 90, to = 93, mark = 91.3, label = null, color = AMBER, ticks = true } = opts;
  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (ticks) {
    for (let f = from; f <= to + 0.001; f += 0.1) {
      const big = Math.abs(f - Math.round(f)) < 0.01;
      const tx = x + ((f - from) / (to - from)) * w;
      ctx.fillStyle = big ? 'rgba(235,240,250,0.65)' : 'rgba(235,240,250,0.22)';
      ctx.fillRect(tx, y + h * (big ? 0.58 : 0.68), 1, h * (big ? 0.24 : 0.14));
      if (big) {
        ctx.font = `600 ${Math.round(h * 0.15)}px ${MONO}`;
        ctx.fillStyle = 'rgba(235,240,250,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText(String(Math.round(f)), tx, y + h * 0.97);
      }
    }
  }
  const nx = x + ((mark - from) / (to - from)) * w;
  glow(P, nx, y + h * 0.45, h * 0.5, color, 0.5);
  ctx.fillStyle = color;
  ctx.fillRect(nx - 1, y + h * 0.1, 2.5, h * 0.62);
  if (label) {
    ctx.font = `700 ${Math.round(h * 0.3)}px ${MONO}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h * 0.42);
  }
  ctx.textAlign = 'left';
}

// --- testo --------------------------------------------------------------------

/**
 * Il narratore. Solo cose vere e verificabili — ore, distanze, prezzi, anni — e
 * infatti è scritto come un dato, non come una voce: monospazio, in alto a
 * sinistra, senza virgolette.
 */
export function narrator(P, text) {
  const ctx = P.ctx;
  const pad = P.w * 0.035;
  ctx.font = `600 ${Math.round(P.h * 0.036)}px ${MONO}`;
  const lines = wrapLines(ctx, text, P.w * 0.56);
  const lh = P.h * 0.052;
  const bh = lines.length * lh + pad * 0.5;
  ctx.fillStyle = 'rgba(5,6,9,0.72)';
  ctx.fillRect(P.x, P.y + pad * 0.6, P.w * 0.62 + pad, bh);
  ctx.fillStyle = CYAN;
  ctx.fillRect(P.x, P.y + pad * 0.6, 2.5, bh);
  ctx.fillStyle = 'rgba(226,236,248,0.9)';
  lines.forEach((l, i) => ctx.fillText(l, P.x + pad, P.y + pad * 1.5 + i * lh));
}

/**
 * Le battute. `who` è il nome, tranne per Kkachi: le sue righe portano il
 * quadrante della frequenza al posto del nome e **stanno sempre da sole nel
 * pannello** — è l'indizio principale del settimo colpo di scena, e senza voce
 * doveva diventare un fatto tipografico.
 */
export function speech(P, lines) {
  const ctx = P.ctx;
  const pad = P.w * 0.035;
  const colW = P.w - pad * 2;
  const size = Math.round(P.h * 0.045);
  const lh = size * 1.38;
  ctx.font = `500 ${size}px ${SANS}`;

  let total = 0;
  const laid = lines.map((l) => {
    const name = l.who ? `${l.who}  ` : '';
    ctx.font = `700 ${size}px ${SANS}`;
    const nw = name ? ctx.measureText(name).width : 0;
    ctx.font = `500 ${size}px ${SANS}`;
    const h = wrapLines(ctx, l.text, colW - nw).length * lh;
    total += h + lh * 0.28;
    return { ...l, nw, name, h };
  });

  const boxH = total + pad * 0.9;
  const top = P.y + P.h - boxH - pad * 0.5;
  const g = ctx.createLinearGradient(0, top - P.h * 0.1, 0, P.y + P.h);
  g.addColorStop(0, 'rgba(5,6,9,0)');
  g.addColorStop(0.35, 'rgba(5,6,9,0.86)');
  g.addColorStop(1, 'rgba(5,6,9,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(P.x, top - P.h * 0.1, P.w, P.y + P.h - top + P.h * 0.1);

  let y = top + pad * 0.5 + size;
  for (const l of laid) {
    if (l.name) {
      ctx.font = `700 ${size}px ${SANS}`;
      ctx.fillStyle = l.kkachi ? AMBER : l.accent || PINK;
      ctx.fillText(l.name, P.x + pad, y);
    }
    ctx.font = `${l.note ? 'italic 500' : '500'} ${size}px ${SANS}`;
    ctx.fillStyle = l.note ? 'rgba(226,236,248,0.55)' : PAPER;
    y += drawParagraph(ctx, l.text, P.x + pad + l.nw, y, colW - l.nw, { lineHeight: lh }) + lh * 0.28;
  }
}

/** Una riga sola grande in mezzo al nero: il pannello 2 e i cartelli. */
export function slate(P, text, opts = {}) {
  const ctx = P.ctx;
  const { size = P.h * 0.075, color = PAPER, align = 'left', at = 0.5 } = opts;
  ctx.font = `500 ${Math.round(size)}px ${SANS}`;
  const colW = P.w * 0.74;
  const h = wrapLines(ctx, text, colW).length * size * 1.42;
  ctx.fillStyle = color;
  drawParagraph(ctx, text, px(P, align === 'center' ? (1 - 0.74) / 2 : 0.1), py(P, at) - h / 2 + size,
    colW, { lineHeight: size * 1.42, align });
}
