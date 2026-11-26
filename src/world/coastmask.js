// Terra e acqua di una regione disegnate come **forme**, non come formule.
//
// Busan e Jeju erano un rettangolo con la battigia a ovest e un'isola
// superellittica: la costa era una funzione di una variabile sola. Qui la costa
// è un insieme di poligoni (terra, baie, isolotti) rasterizzati una volta in
// una maschera a 8 px, e `isWater` diventa una lettura di memoria. Tutto il
// gioco continua a vedere solo `isWater(x, y)` (§3), quindi nessuno a valle sa
// che la forma è cambiata — e per lo stesso motivo nessuna di queste funzioni
// conosce Busan o Jeju: sono i generatori a dire *quali* poligoni.
//
// Determinismo: ogni irregolarità viene da un `Rng` con seme del chiamante.
import { Rng } from '../core/rng.js';

const TAU = Math.PI * 2;

/**
 * Contorno chiuso con raggio perturbato: serve per isole e penisole. Le armoniche
 * sono intere, quindi la curva si richiude da sola senza rattoppi sul punto di
 * partenza; la rugosità fine arriva da `roughen`.
 */
export function blobPoly(cx, cy, rx, ry, seed, { n = 96, rough = 0.1, rot = 0, harmonics = [2, 3, 4, 5, 7, 9] } = {}) {
  const rng = new Rng(seed);
  const parts = harmonics.map((k) => ({ k, a: rough * (0.4 + rng.next() * 0.9) / Math.pow(k, 0.55), p: rng.range(0, TAU) }));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    let r = 1;
    for (const q of parts) r += q.a * Math.sin(q.k * t + q.p);
    const x = Math.cos(t) * rx * r;
    const y = Math.sin(t) * ry * r;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}

/**
 * Spezza ogni lato a metà e sposta il punto di mezzo perpendicolarmente al lato
 * (spostamento del punto medio): da una poligonale di dieci vertici fatta a mano
 * esce una costa con le insenature di una costa vera. `amp` è relativo alla
 * lunghezza del lato e si dimezza a ogni livello, così i dettagli restano piccoli.
 */
export function roughen(pts, seed, { depth = 3, amp = 0.22, closed = true } = {}) {
  const rng = new Rng(seed);
  let cur = pts;
  let a = amp;
  for (let d = 0; d < depth; d++) {
    const next = [];
    const n = closed ? cur.length : cur.length - 1;
    for (let i = 0; i < n; i++) {
      const p = cur[i];
      const q = cur[(i + 1) % cur.length];
      next.push(p);
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const len = Math.hypot(dx, dy);
      const off = (rng.next() * 2 - 1) * a * len;
      next.push([(p[0] + q[0]) / 2 - (dy / (len || 1)) * off, (p[1] + q[1]) / 2 + (dx / (len || 1)) * off]);
    }
    if (!closed) next.push(cur[cur.length - 1]);
    cur = next;
    a *= 0.62;
  }
  return cur;
}

/**
 * Maschera terra/acqua. `paint(poly, 1)` aggiunge terra, `paint(poly, 0)` la toglie:
 * l'ordine delle chiamate è l'ordine dei livelli (prima l'isola, poi le baie).
 * Riempimento a scanline con regola pari-dispari, una riga alla volta.
 */
export function createMask(w, h, res = 8) {
  const nx = Math.ceil(w / res);
  const ny = Math.ceil(h / res);
  const data = new Uint8Array(nx * ny);
  const mask = {
    w, h, res, nx, ny, data,
    paint(poly, value) {
      let ymin = Infinity;
      let ymax = -Infinity;
      for (const p of poly) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
      const j0 = Math.max(0, Math.floor(ymin / res - 0.5));
      const j1 = Math.min(ny - 1, Math.ceil(ymax / res - 0.5));
      const xs = [];
      for (let j = j0; j <= j1; j++) {
        const y = (j + 0.5) * res;
        xs.length = 0;
        for (let i = 0; i < poly.length; i++) {
          const p = poly[i];
          const q = poly[(i + 1) % poly.length];
          if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) {
            xs.push(p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
          }
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const i0 = Math.max(0, Math.ceil(xs[k] / res - 0.5));
          const i1 = Math.min(nx - 1, Math.floor(xs[k + 1] / res - 0.5));
          for (let i = i0; i <= i1; i++) data[j * nx + i] = value;
        }
      }
      return mask;
    },
    /** Disco pieno: foci di fiumi, isolotti, laghetti. */
    disc(cx, cy, r, value) {
      const j0 = Math.max(0, Math.floor((cy - r) / res));
      const j1 = Math.min(ny - 1, Math.ceil((cy + r) / res));
      const i0 = Math.max(0, Math.floor((cx - r) / res));
      const i1 = Math.min(nx - 1, Math.ceil((cx + r) / res));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (Math.hypot((i + 0.5) * res - cx, (j + 0.5) * res - cy) <= r) data[j * nx + i] = value;
      }
      return mask;
    },
    /** Rettangolo: banchine, moli e ponti si riportano a terra con questo. */
    rect(x, y, rw, rh, value) {
      const i0 = Math.max(0, Math.floor(x / res));
      const i1 = Math.min(nx - 1, Math.ceil((x + rw) / res) - 1);
      const j0 = Math.max(0, Math.floor(y / res));
      const j1 = Math.min(ny - 1, Math.ceil((y + rh) / res) - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) data[j * nx + i] = value;
      return mask;
    },
    land(x, y) {
      const i = Math.floor(x / res);
      const j = Math.floor(y / res);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return false;
      return data[j * nx + i] === 1;
    },
    /**
     * Distanza dalla riva in px, in cella da 16 (trasformata a chamfer 3-4): serve a
     * sapere quanto un punto di terra è vicino al mare (spiaggia, lungomare) senza
     * campionare l'acqua attorno ogni volta. Si calcola una volta, alla prima richiesta.
     */
    shoreDist(x, y) {
      if (!mask._dist) mask._buildDist();
      const d = mask._dist;
      const i = Math.min(d.nx - 1, Math.max(0, Math.floor(x / d.res)));
      const j = Math.min(d.ny - 1, Math.max(0, Math.floor(y / d.res)));
      return d.data[j * d.nx + i];
    },
    _buildDist() {
      const r = 16;
      const k = r / res;
      const dnx = Math.ceil(w / r);
      const dny = Math.ceil(h / r);
      const land = new Uint8Array(dnx * dny);
      for (let j = 0; j < dny; j++) for (let i = 0; i < dnx; i++) {
        land[j * dnx + i] = data[Math.min(ny - 1, Math.floor((j + 0.5) * k)) * nx + Math.min(nx - 1, Math.floor((i + 0.5) * k))];
      }
      const INF = 60000;
      const dist = new Uint16Array(dnx * dny);
      for (let q = 0; q < dist.length; q++) {
        // Il bordo della mappa conta come riva solo se è terra: fuori dal rettangolo c'è altro.
        dist[q] = INF;
      }
      for (let j = 0; j < dny; j++) for (let i = 0; i < dnx; i++) {
        const q = j * dnx + i;
        const me = land[q];
        // Una cella è «di riva» se ha un vicino di tipo diverso.
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= dnx || b >= dny) continue;
          if (land[b * dnx + a] !== me) { dist[q] = 0; break; }
        }
      }
      const relax = (i, j, a, b, c) => {
        if (a < 0 || b < 0 || a >= dnx || b >= dny) return;
        const v = dist[b * dnx + a] + c;
        if (v < dist[j * dnx + i]) dist[j * dnx + i] = v;
      };
      for (let j = 0; j < dny; j++) for (let i = 0; i < dnx; i++) {
        relax(i, j, i - 1, j, 3); relax(i, j, i, j - 1, 3); relax(i, j, i - 1, j - 1, 4); relax(i, j, i + 1, j - 1, 4);
      }
      for (let j = dny - 1; j >= 0; j--) for (let i = dnx - 1; i >= 0; i--) {
        relax(i, j, i + 1, j, 3); relax(i, j, i, j + 1, 3); relax(i, j, i + 1, j + 1, 4); relax(i, j, i - 1, j + 1, 4);
      }
      const out = new Uint16Array(dnx * dny);
      for (let q = 0; q < out.length; q++) out[q] = Math.min(65000, Math.round((dist[q] * r) / 3));
      mask._dist = { nx: dnx, ny: dny, res: r, data: out };
    },
  };
  return mask;
}

export function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = x - xi;
  const v = y - yi;
  const sm = (t) => t * t * (3 - 2 * t);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  const p = a + (b - a) * sm(u);
  const q = c + (d - c) * sm(u);
  return p + (q - p) * sm(v);
}

export const smooth = (t) => { const u = t < 0 ? 0 : t > 1 ? 1 : t; return u * u * (3 - 2 * u); };
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Punti a passo regolare lungo una poligonale: il campione che `staircase` si aspetta. */
export function densify(pts, step = 40) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Curva parallela alla riva: da un perno interno si lanciano raggi fra due angoli e
 * ci si ferma `inset` px prima della prima acqua. È come si ottiene una strada
 * litoranea senza tracciare la costa: la riva fa il lavoro, e la maschera è già lì.
 */
export function contour(mask, { px, py, a0, a1, n = 80, inset = 260, maxR = 5000, step = 12 }) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const c = Math.cos(a);
    const s = Math.sin(a);
    let r = 0;
    while (r < maxR && mask.land(px + c * r, py + s * r)) r += step;
    r -= inset;
    out.push([px + c * r, py + s * r]);
  }
  return out;
}
