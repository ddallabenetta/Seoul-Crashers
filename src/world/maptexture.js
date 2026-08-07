// Texture della mappa cittadina, generata una volta: serve sia alla minimappa
// (ritaglio) sia alla mappa a tutto schermo del menu.
import { DISTRICT_BY_ID } from './districts.js';
import { SUN } from '../render/camera.js';

// La carta non è più quadrata: il mondo unificato è alto una volta e mezzo la
// sua larghezza, e una scala unica schiaccerebbe la penisola. Le due dimensioni
// restano quindi separate, come `kx`/`ky` erano già separate al loro interno.
export const MAP_W = 1200;
export const MAP_H = 1714;

export function buildMapTexture(city) {
  const c = document.createElement('canvas');
  c.width = MAP_W;
  c.height = MAP_H;
  const g = c.getContext('2d');
  const kx = MAP_W / city.w;
  const ky = MAP_H / city.h;

  // Terra
  g.fillStyle = '#191c21';
  g.fillRect(0, 0, MAP_W, MAP_H);

  // Tinta dei distretti (macchie morbide attorno ai centri)
  for (const d of city.districts || Object.values(DISTRICT_BY_ID)) {
    const cx = d.seed.x * MAP_W;
    const cy = d.seed.y * MAP_H;
    const grad = g.createRadialGradient(cx, cy, 8, cx, cy, MAP_W * 0.13);
    grad.addColorStop(0, hexA(d.accent, 0.14));
    grad.addColorStop(1, hexA(d.accent, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, MAP_W, MAP_H);
  }

  // Campagna: si dipinge *prima* degli isolati, campionando lo stesso campo che
  // decide dove finisce la maglia fitta. Senza questo strato la mappa resta un
  // reticolo uniforme da bordo a bordo e la città non si distingue da quello che
  // la circonda — che è esattamente l'informazione che una mappa deve dare.
  if (city.urbanAt) {
    const NX = 150;
    const NY = Math.round(NX * MAP_H / MAP_W);
    const sw = MAP_W / NX;
    const sh = MAP_H / NY;
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const u = city.urbanAt(((i + 0.5) * city.w) / NX, ((j + 0.5) * city.h) / NY);
        if (u >= 0.26) continue;
        g.fillStyle = `rgba(46,58,30,${0.55 - u})`;
        g.fillRect(i * sw, j * sh, sw + 1, sh + 1);
      }
    }
  }

  // Isolati
  const BLOCK_FILL = {
    park: '#22381f', dock: '#23272a', port: '#20262a',
    rural: '#2f3a1f', airport: '#31353b',
  };
  for (const b of city.blocks) {
    g.fillStyle = BLOCK_FILL[b.type] || '#272b31';
    g.fillRect(b.x * kx, b.y * ky, b.w * kx, b.h * ky);
    // I campi: le risaie a scacchiera sono il modo in cui la campagna si riconosce
    // su una mappa, esattamente come gli isolati riconoscono la città.
    if (!b.fields) continue;
    for (const f of b.fields) {
      g.fillStyle = f.wet ? '#35492c' : '#3d4426';
      g.fillRect(f.x * kx, f.y * ky, f.w * kx, f.h * ky);
    }
  }

  // Una maschera sola per tutta l'acqua del mondo: Han, mare occidentale, baia
  // di Busan, Mar dell'Est e il canale che stacca Jeju vengono tutti da
  // `city.isWater`, che è l'unica autorità sulla geografia (§3).
  const r = city.river;
  if (city.isWater) drawWaterMask(g, city);

  // Il Han però resta riconoscibile: un nastro con la sua sfumatura, dentro il
  // solo rettangolo di Seoul.
  const seoul = city.seoulArea;
  if (seoul) {
    const rg = g.createLinearGradient(0, r.y0 * ky, 0, r.y1 * ky);
    rg.addColorStop(0, '#1d4055');
    rg.addColorStop(0.5, '#16303f');
    rg.addColorStop(1, '#1d4055');
    g.fillStyle = rg;
    g.fillRect(seoul.x0 * kx, r.y0 * ky, (seoul.x1 - seoul.x0) * kx, (r.y1 - r.y0) * ky);
  }
  for (const p of city.piers) {
    g.fillStyle = '#4b5057';
    g.fillRect(p.x * kx, p.y * ky, p.w * kx, p.h * ky);
  }

  // Strade. Fuori città la carreggiata si scurisce: una provinciale in mezzo alle
  // risaie non deve pesare sulla mappa quanto un boulevard di Gangnam.
  const urban = city.urbanAt || (() => 1);
  const road = (l, a, b, vertical) => {
    const mid = (a + b) / 2;
    const u = urban(vertical ? l.c : mid, vertical ? mid : l.c);
    g.fillStyle = u < 0.26
      ? (l.arterial ? '#5a6060' : '#4a5050')
      : (l.arterial ? '#79808c' : '#5d646e');
    if (vertical) g.fillRect((l.c - l.width / 2) * kx, a * ky, l.width * kx, (b - a) * ky);
    else g.fillRect(a * kx, (l.c - l.width / 2) * ky, (b - a) * kx, l.width * ky);
  };
  for (const l of city.hLines) for (const [a, b] of l.segments) road(l, a, b, false);
  for (const l of city.vLines) for (const [a, b] of l.segments) road(l, a, b, true);

  // Ponti evidenziati
  g.strokeStyle = 'rgba(230,220,190,0.5)';
  g.lineWidth = 1.5;
  for (const br of city.river.bridges) {
    g.strokeRect((br.x - br.w / 2) * kx, r.y0 * ky, br.w * kx, (r.y1 - r.y0) * ky);
  }

  // Piste e piazzali: sulla mappa una pista è la cosa più riconoscibile che c'è.
  for (const a of city.aprons) {
    g.fillStyle = '#3a3f46';
    g.fillRect(a.x * kx, a.y * ky, a.w * kx, a.h * ky);
  }
  for (const t of city.taxiways) {
    g.fillStyle = '#44494f';
    g.fillRect(t.x * kx, t.y * ky, t.w * kx, t.h * ky);
  }
  for (const rw of city.runways) {
    g.fillStyle = '#5b626b';
    g.fillRect(rw.x * kx, rw.y * ky, rw.w * kx, rw.h * ky);
    g.strokeStyle = 'rgba(240,244,250,0.7)';
    g.lineWidth = 1;
    g.setLineDash([4, 5]);
    g.beginPath();
    if (rw.horiz) {
      g.moveTo(rw.x * kx, (rw.y + rw.h / 2) * ky);
      g.lineTo((rw.x + rw.w) * kx, (rw.y + rw.h / 2) * ky);
    } else {
      g.moveTo((rw.x + rw.w / 2) * kx, rw.y * ky);
      g.lineTo((rw.x + rw.w / 2) * kx, (rw.y + rw.h) * ky);
    }
    g.stroke();
    g.setLineDash([]);
  }

  // Edifici alti: leggero rilievo per riconoscere gli skyline
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (const b of city.buildings) {
    if (b.isBelt || b.h3d < 110) continue;
    g.fillRect(b.x * kx, b.y * ky, Math.max(1, b.w * kx), Math.max(1, b.h * ky));
  }

  // Ombreggiatura del rilievo: è quella che dà carattere geografico alla mappa
  // (Namsan al centro, il terreno che degrada verso il Han).
  drawRelief(g, city);

  // Bordo cartografico: doppia cornice e tacche. Adesso la carta è una sola per
  // tutto il paese, quindi la tinta non dipende più da dove ci si trova.
  g.strokeStyle = 'rgba(6,10,13,0.92)';
  g.lineWidth = 18;
  g.strokeRect(9, 9, MAP_W - 18, MAP_H - 18);
  g.strokeStyle = '#667d5f';
  g.lineWidth = 6;
  g.strokeRect(10, 10, MAP_W - 20, MAP_H - 20);
  g.strokeStyle = 'rgba(235,242,239,0.42)';
  g.lineWidth = 1.5;
  g.strokeRect(17, 17, MAP_W - 34, MAP_H - 34);
  g.lineWidth = 3;
  for (let p = 72; p < Math.max(MAP_W, MAP_H) - 50; p += 86) {
    g.beginPath();
    if (p < MAP_W - 50) {
      g.moveTo(p, 10); g.lineTo(p, 24);
      g.moveTo(p, MAP_H - 10); g.lineTo(p, MAP_H - 24);
    }
    if (p < MAP_H - 50) {
      g.moveTo(10, p); g.lineTo(24, p);
      g.moveTo(MAP_W - 10, p); g.lineTo(MAP_W - 24, p);
    }
    g.stroke();
  }

  return c;
}

/** Maschera geografica comune: rende baie, estuari e l'intero profilo di Jeju. */
function drawWaterMask(g, city) {
  const nx = 300;
  const ny = Math.round(nx * MAP_H / MAP_W);
  const cw = MAP_W / nx;
  const ch = MAP_H / ny;
  const sx = city.w / nx;
  const sy = city.h / ny;
  g.fillStyle = '#123447';
  for (let j = 0; j < ny; j++) {
    let run = -1;
    for (let i = 0; i <= nx; i++) {
      const wet = i < nx && city.isWater((i + 0.5) * sx, (j + 0.5) * sy);
      if (wet && run < 0) run = i;
      if (!wet && run >= 0) {
        g.fillRect(run * cw, j * ch, (i - run) * cw + 0.6, ch + 0.6);
        run = -1;
      }
    }
  }
  // Riflessi sottili: spezzano la massa blu senza cambiare la silhouette.
  g.fillStyle = 'rgba(145,200,226,0.07)';
  for (let j = 5; j < ny; j += 11) {
    for (let i = (j * 7) % 17; i < nx; i += 29) {
      if (city.isWater((i + 0.5) * sx, (j + 0.5) * sy)) g.fillRect(i * cw, j * ch, cw * 8, 1.2);
    }
  }
}

/** Hillshade dell'intera mappa: stessa quota e stessa luce del terreno di gioco. */
function drawRelief(g, city) {
  const el = city.elevationAt;
  if (!el) return;
  const n = 150;
  const m = Math.round(n * MAP_H / MAP_W);
  const stepX = city.w / (n - 1);
  const stepY = city.h / (m - 1);
  const img = new ImageData(n, m);
  const px = img.data;
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * stepX;
      const y = j * stepY;
      const dzdx = (el(x + stepX, y) - el(x - stepX, y)) / (2 * stepX);
      const dzdy = (el(x, y + stepY) - el(x, y - stepY)) / (2 * stepY);
      let lit = (dzdx * SUN.x + dzdy * SUN.y) / 0.07;
      if (lit > 1) lit = 1; else if (lit < -1) lit = -1;
      const o = (j * n + i) * 4;
      px[o] = px[o + 1] = px[o + 2] = 128 + lit * 58;
      px[o + 3] = 255;
    }
  }
  const src = document.createElement('canvas');
  src.width = n;
  src.height = m;
  src.getContext('2d').putImageData(img, 0, 0);

  g.save();
  g.globalCompositeOperation = 'soft-light';
  if (g.globalCompositeOperation !== 'soft-light') {
    g.restore();
    return;
  }
  const kx = MAP_W / (n - 1);
  const ky = MAP_H / (m - 1);
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, -kx / 2, -ky / 2, n * kx, m * ky);
  g.restore();
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
