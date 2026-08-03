// Texture della mappa cittadina, generata una volta: serve sia alla minimappa
// (ritaglio) sia alla mappa a tutto schermo del menu.
import { DISTRICT_BY_ID } from './districts.js';
import { SUN } from '../render/camera.js';

export const MAP_SIZE = 1100;

export function buildMapTexture(city) {
  const c = document.createElement('canvas');
  c.width = MAP_SIZE;
  c.height = MAP_SIZE;
  const g = c.getContext('2d');
  const k = MAP_SIZE / city.w;

  // Terra
  g.fillStyle = '#191c21';
  g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

  // Tinta dei distretti (macchie morbide attorno ai centri)
  for (const id of Object.keys(DISTRICT_BY_ID)) {
    const d = DISTRICT_BY_ID[id];
    const cx = d.seed.x * MAP_SIZE;
    const cy = d.seed.y * MAP_SIZE;
    const grad = g.createRadialGradient(cx, cy, 10, cx, cy, MAP_SIZE * 0.3);
    grad.addColorStop(0, hexA(d.accent, 0.12));
    grad.addColorStop(1, hexA(d.accent, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  }

  // Isolati
  for (const b of city.blocks) {
    if (b.type === 'park') g.fillStyle = '#22381f';
    else if (b.type === 'dock') g.fillStyle = '#23272a';
    else g.fillStyle = '#272b31';
    g.fillRect(b.x * k, b.y * k, b.w * k, b.h * k);
  }

  // Fiume Han
  const r = city.river;
  const rg = g.createLinearGradient(0, r.y0 * k, 0, r.y1 * k);
  rg.addColorStop(0, '#1d4055');
  rg.addColorStop(0.5, '#16303f');
  rg.addColorStop(1, '#1d4055');
  g.fillStyle = rg;
  g.fillRect(0, r.y0 * k, MAP_SIZE, (r.y1 - r.y0) * k);

  // Strade
  for (const l of city.hLines) {
    g.fillStyle = l.arterial ? '#79808c' : '#5d646e';
    for (const [a, b] of l.segments) {
      g.fillRect(a * k, (l.c - l.width / 2) * k, (b - a) * k, l.width * k);
    }
  }
  for (const l of city.vLines) {
    g.fillStyle = l.arterial ? '#79808c' : '#5d646e';
    for (const [a, b] of l.segments) {
      g.fillRect((l.c - l.width / 2) * k, a * k, l.width * k, (b - a) * k);
    }
  }

  // Ponti evidenziati
  g.strokeStyle = 'rgba(230,220,190,0.5)';
  g.lineWidth = 1.5;
  for (const br of city.river.bridges) {
    g.strokeRect((br.x - br.w / 2) * k, r.y0 * k, br.w * k, (r.y1 - r.y0) * k);
  }

  // Edifici alti: leggero rilievo per riconoscere gli skyline
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (const b of city.buildings) {
    if (b.isBelt || b.h3d < 110) continue;
    g.fillRect(b.x * k, b.y * k, Math.max(1, b.w * k), Math.max(1, b.h * k));
  }

  // Ombreggiatura del rilievo: è quella che dà carattere geografico alla mappa
  // (Namsan al centro, il terreno che degrada verso il Han).
  drawRelief(g, city);

  // Bordo mappa
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 6;
  g.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

  return c;
}

/** Hillshade dell'intera mappa: stessa quota e stessa luce del terreno di gioco. */
function drawRelief(g, city) {
  const el = city.elevationAt;
  if (!el) return;
  const n = 132;
  const step = city.w / (n - 1);
  const img = new ImageData(n, n);
  const px = img.data;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * step;
      const y = j * step;
      const dzdx = (el(x + step, y) - el(x - step, y)) / (2 * step);
      const dzdy = (el(x, y + step) - el(x, y - step)) / (2 * step);
      let lit = (dzdx * SUN.x + dzdy * SUN.y) / 0.07;
      if (lit > 1) lit = 1; else if (lit < -1) lit = -1;
      const o = (j * n + i) * 4;
      px[o] = px[o + 1] = px[o + 2] = 128 + lit * 58;
      px[o + 3] = 255;
    }
  }
  const src = document.createElement('canvas');
  src.width = n;
  src.height = n;
  src.getContext('2d').putImageData(img, 0, 0);

  g.save();
  g.globalCompositeOperation = 'soft-light';
  if (g.globalCompositeOperation !== 'soft-light') {
    g.restore();
    return;
  }
  const k = MAP_SIZE / (n - 1);
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, -k / 2, -k / 2, n * k, n * k);
  g.restore();
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
