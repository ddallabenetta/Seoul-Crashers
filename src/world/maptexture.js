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
  const kx = MAP_SIZE / city.w;
  const ky = MAP_SIZE / city.h;

  // Terra
  g.fillStyle = '#191c21';
  g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

  // Tinta dei distretti (macchie morbide attorno ai centri)
  for (const d of city.districts || Object.values(DISTRICT_BY_ID)) {
    const cx = d.seed.x * MAP_SIZE;
    const cy = d.seed.y * MAP_SIZE;
    const grad = g.createRadialGradient(cx, cy, 10, cx, cy, MAP_SIZE * 0.3);
    grad.addColorStop(0, hexA(d.accent, 0.12));
    grad.addColorStop(1, hexA(d.accent, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  }

  // Campagna: si dipinge *prima* degli isolati, campionando lo stesso campo che
  // decide dove finisce la maglia fitta. Senza questo strato la mappa resta un
  // reticolo uniforme da bordo a bordo e la città non si distingue da quello che
  // la circonda — che è esattamente l'informazione che una mappa deve dare.
  if (city.urbanAt) {
    const N = 110;
    const step = MAP_SIZE / N;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const u = city.urbanAt(((i + 0.5) * city.w) / N, ((j + 0.5) * city.h) / N);
        if (u >= 0.26) continue;
        g.fillStyle = `rgba(46,58,30,${0.55 - u})`;
        g.fillRect(i * step, j * step, step + 1, step + 1);
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

  const seoulWater = (city.region?.id || 'seoul') === 'seoul';

  // Seoul conserva il disegno editoriale di Han e costa; le regioni con una
  // geografia propria usano direttamente il loro campo `isWater`.
  const r = city.river;
  if (seoulWater) {
    const rg = g.createLinearGradient(0, r.y0 * ky, 0, r.y1 * ky);
    rg.addColorStop(0, '#1d4055');
    rg.addColorStop(0.5, '#16303f');
    rg.addColorStop(1, '#1d4055');
    g.fillStyle = rg;
    g.fillRect(0, r.y0 * ky, MAP_SIZE, (r.y1 - r.y0) * ky);
  } else if (city.isWater) {
    drawWaterMask(g, city);
  }

  // Mare (서해): la costa segue `coastAt`, quindi il bordo ovest della mappa non
  // è una riga dritta — ed è metà del motivo per cui Seoul qui ha una sagoma.
  if (seoulWater && city.waterX > 0) {
    g.fillStyle = '#123043';
    g.beginPath();
    g.moveTo(0, 0);
    for (let y = 0; y <= city.h; y += 40) g.lineTo(city.coastAt(y) * kx, y * ky);
    g.lineTo(0, MAP_SIZE);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(180,210,225,0.25)';
    g.lineWidth = 1.2;
    g.stroke();
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

  // Bordo mappa
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 6;
  g.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

  return c;
}

/** Maschera geografica comune: rende baie, estuari e l'intero profilo di Jeju. */
function drawWaterMask(g, city) {
  const n = 240;
  const cell = MAP_SIZE / n;
  const sx = city.w / n;
  const sy = city.h / n;
  g.fillStyle = '#123447';
  for (let j = 0; j < n; j++) {
    let run = -1;
    for (let i = 0; i <= n; i++) {
      const wet = i < n && city.isWater((i + 0.5) * sx, (j + 0.5) * sy);
      if (wet && run < 0) run = i;
      if (!wet && run >= 0) {
        g.fillRect(run * cell, j * cell, (i - run) * cell + 0.6, cell + 0.6);
        run = -1;
      }
    }
  }
  // Riflessi sottili: spezzano la massa blu senza cambiare la silhouette.
  g.fillStyle = 'rgba(145,200,226,0.07)';
  for (let j = 5; j < n; j += 11) {
    for (let i = (j * 7) % 17; i < n; i += 29) {
      if (city.isWater((i + 0.5) * sx, (j + 0.5) * sy)) g.fillRect(i * cell, j * cell, cell * 8, 1.2);
    }
  }
}

/** Hillshade dell'intera mappa: stessa quota e stessa luce del terreno di gioco. */
function drawRelief(g, city) {
  const el = city.elevationAt;
  if (!el) return;
  const n = 132;
  const stepX = city.w / (n - 1);
  const stepY = city.h / (n - 1);
  const img = new ImageData(n, n);
  const px = img.data;
  for (let j = 0; j < n; j++) {
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
