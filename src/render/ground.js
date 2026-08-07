// Terreno (asfalto, marciapiedi, segnaletica, fiume) pre-renderizzato in tile da 512px
// e messo in cache LRU: la mappa è troppo grande per essere ridisegnata ogni frame.
import { noiseCanvas } from './sprites.js';
import { SUN } from './camera.js';
import { DISTRICT_BY_ID, districtAtNorm } from '../world/districts.js';

export const TILE = 512;
const MAX_TILES = 96;
// Hillshade: griglia di campioni per tile (33 punti = un campione ogni 16 px) e
// pendenza che satura l'ombreggiatura.
const RELIEF_N = 33;
const RELIEF_SLOPE = 0.062;

function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const ROAD_WORDS = ['버스', '천천히', '어린이보호'];

export class GroundRenderer {
  constructor(city) {
    this.city = city;
    this.tiles = new Map();
    this.order = [];
  }

  draw(ctx, cam) {
    const b = cam.bounds(160);
    const x0 = Math.floor(b.x / TILE);
    const y0 = Math.floor(b.y / TILE);
    const x1 = Math.floor((b.x + b.w) / TILE);
    const y1 = Math.floor((b.y + b.h) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.getTile(tx, ty);
        if (t) ctx.drawImage(t, tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }

  getTile(tx, ty) {
    const key = `${tx},${ty}`;
    let t = this.tiles.get(key);
    if (t) return t;
    if (tx * TILE > this.city.w + TILE || ty * TILE > this.city.h + TILE) return null;
    if ((tx + 1) * TILE < -TILE || (ty + 1) * TILE < -TILE) return null;
    t = this.renderTile(tx, ty);
    this.tiles.set(key, t);
    this.order.push(key);
    if (this.order.length > MAX_TILES) {
      const old = this.order.shift();
      this.tiles.delete(old);
    }
    return t;
  }

  renderTile(tx, ty) {
    const city = this.city;
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const g = c.getContext('2d');
    const ox = tx * TILE;
    const oy = ty * TILE;
    const view = { x: ox, y: oy, w: TILE, h: TILE };

    g.save();
    g.translate(-ox, -oy);

    // --- Base: terra del distretto -------------------------------------------
    const d = city.districtAt
      ? city.districtAt(ox + TILE / 2, oy + TILE / 2)
      : districtAtNorm((ox + TILE / 2) / city.w, (oy + TILE / 2) / city.h);
    g.fillStyle = d.ground;
    g.fillRect(ox, oy, TILE, TILE);

    // --- Fiume Han ------------------------------------------------------------
    const r = city.river;
    const seoulWater = (city.region?.id || 'seoul') === 'seoul';
    if (seoulWater && oy < r.y1 && oy + TILE > r.y0) {
      const grad = g.createLinearGradient(0, r.y0, 0, r.y1);
      grad.addColorStop(0, '#1b3a4a');
      grad.addColorStop(0.35, '#16303f');
      grad.addColorStop(0.7, '#122b3a');
      grad.addColorStop(1, '#1b3a4a');
      g.fillStyle = grad;
      g.fillRect(ox, r.y0, TILE, r.y1 - r.y0);
      // Riflessi statici
      for (let i = 0; i < 30; i++) {
        const yy = r.y0 + hash2(tx * 31 + i, ty * 17) * (r.y1 - r.y0);
        const xx = ox + hash2(i, tx * 7 + ty) * TILE;
        const w = 20 + hash2(i * 3, ty) * 90;
        g.fillStyle = `rgba(150,200,225,${0.03 + hash2(i, i) * 0.05})`;
        g.fillRect(xx, yy, w, 2);
      }
      // Lungofiume: prato, pista ciclabile e banchina in cemento su entrambe le rive.
      const bank = (yTop, flip) => {
        const dir = flip ? -1 : 1;
        // Prato
        const gg = g.createLinearGradient(0, yTop, 0, yTop + dir * 62);
        gg.addColorStop(0, '#46583a');
        gg.addColorStop(1, '#36462e');
        g.fillStyle = gg;
        g.fillRect(ox, flip ? yTop : yTop - 62, TILE, 62);
        // Macchie d'erba
        for (let i = 0; i < 8; i++) {
          const rv = hash2(tx * 13 + i, (yTop | 0) + i * 7);
          g.fillStyle = `rgba(90,${120 + rv * 40 | 0},70,0.22)`;
          g.beginPath();
          g.ellipse(ox + rv * TILE, yTop - dir * (10 + rv * 44), 26 + rv * 40, 9 + rv * 12, 0, 0, 6.2832);
          g.fill();
        }
        // Pista ciclabile
        g.fillStyle = 'rgba(165,70,58,0.6)';
        g.fillRect(ox, yTop - dir * 40, TILE, 9);
        g.strokeStyle = 'rgba(240,240,235,0.25)';
        g.lineWidth = 1;
        g.setLineDash([10, 12]);
        g.beginPath();
        g.moveTo(ox, yTop - dir * 35.5);
        g.lineTo(ox + TILE, yTop - dir * 35.5);
        g.stroke();
        g.setLineDash([]);
        // Banchina
        g.fillStyle = '#4b5057';
        g.fillRect(ox, flip ? yTop : yTop - 18, TILE, 18);
        g.fillStyle = 'rgba(255,255,255,0.07)';
        g.fillRect(ox, flip ? yTop : yTop - 18, TILE, 2);
        // Gradini verso l'acqua
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let x = ox; x < ox + TILE; x += 150) {
          g.fillRect(x + 20, flip ? yTop + 4 : yTop - 22, 60, 3);
        }
      };
      bank(r.y0, false);
      bank(r.y1, true);
    }

    // --- Mare (서해), piana di marea e banchina --------------------------------
    if (seoulWater && city.waterX > 0 && ox < city.quayX + TILE) this.drawSea(g, ox, oy);
    else if (!seoulWater && city.isWater) this.drawRegionalWater(g, ox, oy);

    // --- Asfalto --------------------------------------------------------------
    const noise = g.createPattern(noiseCanvas(), 'repeat');
    const drawRoadRect = (x, y, w, h) => {
      g.fillStyle = '#34373d';
      g.fillRect(x, y, w, h);
      if (noise) {
        g.fillStyle = noise;
        g.fillRect(x, y, w, h);
      }
    };

    for (const l of city.vLines) {
      const x = l.c - l.width / 2;
      if (x > ox + TILE || x + l.width < ox) continue;
      for (const [a, b] of l.segments) {
        if (b < oy || a > oy + TILE) continue;
        drawRoadRect(x, a, l.width, b - a);
      }
    }
    for (const l of city.hLines) {
      const y = l.c - l.width / 2;
      if (y > oy + TILE || y + l.width < oy) continue;
      for (const [a, b] of l.segments) {
        if (b < ox || a > ox + TILE) continue;
        drawRoadRect(a, y, b - a, l.width);
      }
    }

    // --- Segnaletica tra incroci ---------------------------------------------
    this.drawMarkings(g, view);

    // --- Isolati: marciapiedi, cortili, parchi -------------------------------
    const blocks = city.blockGrid.queryRect(ox - 40, oy - 40, TILE + 80, TILE + 80);
    for (const b of blocks) this.drawBlock(g, b, tx, ty);

    // --- Strisce pedonali ----------------------------------------------------
    for (const cw of city.crosswalks) {
      if (cw.x + cw.w / 2 < ox || cw.x - cw.w / 2 > ox + TILE) continue;
      if (cw.y + cw.h / 2 < oy || cw.y - cw.h / 2 > oy + TILE) continue;
      g.fillStyle = 'rgba(235,238,242,0.72)';
      if (cw.horiz) {
        const n = Math.max(2, Math.floor(cw.w / 13));
        for (let i = 0; i < n; i++) {
          g.fillRect(cw.x - cw.w / 2 + i * (cw.w / n) + 2, cw.y - cw.h / 2, cw.w / n - 4, cw.h);
        }
      } else {
        const n = Math.max(2, Math.floor(cw.h / 13));
        for (let i = 0; i < n; i++) {
          g.fillRect(cw.x - cw.w / 2, cw.y - cw.h / 2 + i * (cw.h / n) + 2, cw.w, cw.h / n - 4);
        }
      }
    }

    // --- Aeroporto e territori delle bande -----------------------------------
    // Piste e piazzali stanno *sopra* l'isolato (che qui è solo il prato) e sotto
    // tutto il resto: sono superfici dipinte, come le strisce pedonali.
    this.drawAirfield(g, view);
    for (const t of this.city.turfs || []) {
      if (t.x > ox + TILE || t.x + t.w < ox || t.y > oy + TILE || t.y + t.h < oy) continue;
      this.drawTurf(g, t);
    }

    // --- Rilievo: ombreggiatura in base alla pendenza ------------------------
    g.restore();
    this.drawRelief(g, ox, oy);
    return c;
  }

  /**
   * Acqua per le geografie regionali. Campiona il campo autorevole `isWater`
   * invece di imporre la costa occidentale e il Han di Seoul: così Busan mostra
   * baia ed estuario e Jeju resta davvero un'isola anche nella scena giocata.
   */
  drawRegionalWater(g, ox, oy) {
    const city = this.city;
    const step = 12;
    const xEnd = ox + TILE;
    const yEnd = oy + TILE;
    g.fillStyle = '#123447';
    for (let y = oy; y < yEnd; y += step) {
      let run = null;
      for (let x = ox; x <= xEnd + step; x += step) {
        const wet = x <= xEnd && city.isWater(x + step / 2, y + step / 2);
        if (wet && run === null) run = x;
        if (!wet && run !== null) {
          g.fillRect(run, y, x - run + 0.8, step + 0.8);
          run = null;
        }
      }
    }

    // Riflessi deterministicamente sparsi, solo dove il centro resta acqua.
    for (let i = 0; i < 26; i++) {
      const x = ox + hash2(ox / TILE * 31 + i, oy / TILE * 17) * TILE;
      const y = oy + hash2(i * 13, ox + oy) * TILE;
      if (!city.isWater(x, y)) continue;
      g.fillStyle = `rgba(155,205,228,${0.035 + hash2(i, i * 3) * 0.05})`;
      g.fillRect(x, y, 22 + hash2(i * 5, oy) * 88, 2);
    }

    // I moli sono superfici calpestabili e devono tornare sopra la maschera.
    for (const p of city.piers || []) {
      if (p.x > xEnd || p.x + p.w < ox || p.y > yEnd || p.y + p.h < oy) continue;
      g.fillStyle = '#4e535a';
      g.fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(p.x, p.y, p.w, 3);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(p.x, p.y + p.h - 4, p.w, 4);
    }
  }

  /**
   * Hillshade del tile. Il terreno resta in pianta: il dislivello si legge da
   * questa ombreggiatura (e da quanto si aprono i volumi). Il campionamento è a
   * bassa risoluzione e viene ingrandito con interpolazione; l'offset di mezzo
   * passo serve a far cadere i campioni esattamente sui bordi, così tile
   * adiacenti combaciano invece di mostrare uno scalino.
   */
  drawRelief(g, ox, oy) {
    const el = this.city.elevationAt;
    if (!el) return;
    const n = RELIEF_N;
    const step = TILE / (n - 1);
    // Un anello di campioni in più per calcolare le derivate ai bordi.
    const h = new Float32Array((n + 2) * (n + 2));
    for (let j = -1; j <= n; j++) {
      for (let i = -1; i <= n; i++) {
        h[(j + 1) * (n + 2) + (i + 1)] = el(ox + i * step, oy + j * step);
      }
    }

    const img = new ImageData(n, n);
    const px = img.data;
    let flat = true;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = (j + 1) * (n + 2) + (i + 1);
        const dzdx = (h[k + 1] - h[k - 1]) / (2 * step);
        const dzdy = (h[k + n + 2] - h[k - n - 2]) / (2 * step);
        // Un versante che sale verso il sole guarda la luce: si schiarisce.
        let lit = (dzdx * SUN.x + dzdy * SUN.y) / RELIEF_SLOPE;
        if (lit > 1) lit = 1; else if (lit < -1) lit = -1;
        if (lit > 0.02 || lit < -0.02) flat = false;
        const v = 128 + lit * 44;
        const o = (j * n + i) * 4;
        px[o] = px[o + 1] = px[o + 2] = v;
        px[o + 3] = 255;
      }
    }
    if (flat) return; // pianura o fiume: niente da ombreggiare

    const src = document.createElement('canvas');
    src.width = n;
    src.height = n;
    src.getContext('2d').putImageData(img, 0, 0);

    g.save();
    // `overlay` e non `soft-light`: su asfalto e terra, che sono molto scuri,
    // soft-light non si vedrebbe quasi.
    g.globalCompositeOperation = 'overlay';
    if (g.globalCompositeOperation !== 'overlay') {
      // Senza il blend giusto meglio non dipingere niente che spalmare un grigio.
      g.restore();
      return;
    }
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, -step / 2, -step / 2, n * step, n * step);
    g.restore();
  }

  /**
   * Il mare a ovest. Tre fasce: acqua aperta fino alla battigia (`coastAt`), la
   * piana di marea (갯벌) che resta scoperta, e la banchina di cemento davanti al
   * lungomare. I moli sono terra e vanno ridisegnati sopra l'acqua.
   */
  drawSea(g, ox, oy) {
    const city = this.city;
    const left = ox - 40;

    // Banchina: dal bordo strada verso l'acqua.
    g.fillStyle = '#4b5057';
    g.fillRect(city.quayX - 74, oy, 74, TILE);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(city.quayX - 74, oy, 3, TILE);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = oy - (oy % 150); y < oy + TILE; y += 150) g.fillRect(city.quayX - 68, y, 46, 4);

    // Piana di marea: fango striato, il colore che dice "qui l'acqua se n'è andata".
    g.fillStyle = '#4a4636';
    g.fillRect(left, oy, city.quayX - 74 - left, TILE);
    for (let i = 0; i < 26; i++) {
      const yy = oy + hash2(i * 7, oy + i) * TILE;
      const xx = left + hash2(i, ox + i * 3) * Math.max(1, city.quayX - left);
      g.fillStyle = `rgba(90,96,86,${0.06 + hash2(i, i) * 0.1})`;
      g.beginPath();
      g.ellipse(xx, yy, 30 + hash2(i, 3) * 90, 6 + hash2(3, i) * 10, 0, 0, 6.2832);
      g.fill();
    }

    // Acqua aperta.
    const step = 12;
    g.beginPath();
    g.moveTo(left, oy - 2);
    for (let y = oy - 2; y <= oy + TILE + 2; y += step) g.lineTo(city.coastAt(y), y);
    g.lineTo(city.coastAt(oy + TILE + 2), oy + TILE + 2);
    g.lineTo(left, oy + TILE + 2);
    g.closePath();
    const wg = g.createLinearGradient(left, 0, city.quayX, 0);
    wg.addColorStop(0, '#0f2a3a');
    wg.addColorStop(0.7, '#153648');
    wg.addColorStop(1, '#1d4a5c');
    g.fillStyle = wg;
    g.fill();
    // Frangenti sulla battigia e riflessi al largo
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(190,220,235,0.22)';
    g.lineWidth = 2;
    for (const off of [6, 22]) {
      g.beginPath();
      for (let y = oy - 2; y <= oy + TILE + 2; y += step) {
        const x = city.coastAt(y) - off - Math.sin(y * 0.06 + off) * 5;
        if (y === oy - 2) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 22; i++) {
      const yy = oy + hash2(i * 13, oy) * TILE;
      const xx = left + hash2(i, ox) * Math.max(1, city.waterX - left);
      g.fillStyle = `rgba(160,205,230,${0.03 + hash2(i, i * 2) * 0.05})`;
      g.fillRect(xx, yy, 24 + hash2(i * 5, oy) * 90, 2);
    }
    g.restore();

    // Moli: cemento sopra l'acqua, con la fascia di bordo che li stacca dal fondo.
    for (const p of city.piers) {
      if (p.x > ox + TILE || p.x + p.w < ox || p.y > oy + TILE || p.y + p.h < oy) continue;
      g.fillStyle = '#4e535a';
      g.fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle = 'rgba(255,255,255,0.07)';
      g.fillRect(p.x, p.y, p.w, 3);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(p.x, p.y + p.h - 4, p.w, 4);
      g.strokeStyle = 'rgba(230,230,235,0.14)';
      g.lineWidth = 1.4;
      for (let x = p.x + 40; x < p.x + p.w - 20; x += 40) {
        g.beginPath(); g.moveTo(x, p.y + 6); g.lineTo(x, p.y + p.h - 6); g.stroke();
      }
    }
  }

  /** Piste, raccordi, piazzali ed eliporti: superfici dipinte, non volumi. */
  drawAirfield(g, view) {
    const city = this.city;
    const hits = (r) => !(r.x > view.x + view.w || r.x + r.w < view.x || r.y > view.y + view.h || r.y + r.h < view.y);

    for (const a of city.aprons || []) {
      if (!hits(a)) continue;
      g.fillStyle = '#3b4046';
      g.fillRect(a.x, a.y, a.w, a.h);
      // Righe di sosta gialle: sono quelle che dicono dove va messo il velivolo.
      g.strokeStyle = 'rgba(226,186,60,0.6)';
      g.lineWidth = 2.5;
      const along = a.w >= a.h;
      const n = Math.floor((along ? a.w : a.h) / 190);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        g.beginPath();
        if (along) { g.moveTo(a.x + a.w * t, a.y + 12); g.lineTo(a.x + a.w * t, a.y + a.h - 12); }
        else { g.moveTo(a.x + 12, a.y + a.h * t); g.lineTo(a.x + a.w - 12, a.y + a.h * t); }
        g.stroke();
      }
    }
    for (const t of city.taxiways || []) {
      if (!hits(t)) continue;
      g.fillStyle = '#42474e';
      g.fillRect(t.x, t.y, t.w, t.h);
      g.strokeStyle = 'rgba(226,186,60,0.7)';
      g.lineWidth = 2;
      g.beginPath();
      if (t.w >= t.h) { g.moveTo(t.x, t.y + t.h / 2); g.lineTo(t.x + t.w, t.y + t.h / 2); }
      else { g.moveTo(t.x + t.w / 2, t.y); g.lineTo(t.x + t.w / 2, t.y + t.h); }
      g.stroke();
    }
    for (const rw of city.runways || []) {
      if (!hits(rw)) continue;
      g.fillStyle = '#31353b';
      g.fillRect(rw.x, rw.y, rw.w, rw.h);
      const long = rw.horiz ? rw.w : rw.h;
      const cross = rw.horiz ? rw.h : rw.w;
      const put = (u, v, uw, vh) => (rw.horiz
        ? g.fillRect(rw.x + u, rw.y + v, uw, vh)
        : g.fillRect(rw.x + v, rw.y + u, vh, uw));
      // Bordi, mezzeria tratteggiata e le due soglie a pettine.
      g.fillStyle = 'rgba(240,242,246,0.55)';
      put(0, 6, long, 3);
      put(0, cross - 9, long, 3);
      g.fillStyle = 'rgba(240,242,246,0.8)';
      for (let s = 60; s < long - 60; s += 90) put(s, cross / 2 - 2, 46, 4);
      for (const end of [0, 1]) {
        for (let k = 0; k < 6; k++) {
          const v = cross * (0.14 + k * 0.125);
          put(end ? long - 74 : 30, v, 44, 5);
        }
      }
    }
    for (const p of city.helipads || []) {
      if (!hits({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 })) continue;
      g.fillStyle = '#33383e';
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.2832); g.fill();
      g.strokeStyle = 'rgba(240,244,250,0.75)';
      g.lineWidth = 4;
      g.beginPath(); g.arc(p.x, p.y, p.r - 8, 0, 6.2832); g.stroke();
      g.lineWidth = 6;
      const a = p.r * 0.42;
      g.beginPath();
      g.moveTo(p.x - a, p.y - a); g.lineTo(p.x - a, p.y + a);
      g.moveTo(p.x - a, p.y); g.lineTo(p.x + a, p.y);
      g.moveTo(p.x + a, p.y - a); g.lineTo(p.x + a, p.y + a);
      g.stroke();
    }
  }

  /**
   * Territorio di una banda: il tag dipinto sull'asfalto e le macchie di chi ci
   * lavora. È l'unico avviso che il giocatore riceve prima di entrarci.
   */
  drawTurf(g, t) {
    g.save();
    g.beginPath();
    g.rect(t.x, t.y, t.w, t.h);
    g.clip();
    g.fillStyle = 'rgba(12,12,14,0.22)';
    g.fillRect(t.x, t.y, t.w, t.h);
    // Tag: hangul grande, ruotato, sbiadito come una bomboletta sull'asfalto.
    g.save();
    g.translate(t.cx, t.cy);
    g.rotate(((t.tag % 4) - 1.5) * 0.16);
    g.globalAlpha = 0.4;
    g.fillStyle = t.color;
    g.font = `900 ${Math.round(Math.min(t.w, t.h) * 0.46)}px system-ui, "Apple SD Gothic Neo", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t.hangul, 0, 0);
    g.restore();
    // Segno di confine sui quattro lati: una banda che non marca il territorio
    // non si distingue da un cortile qualunque.
    g.globalAlpha = 0.55;
    g.strokeStyle = t.color;
    g.lineWidth = 4;
    g.setLineDash([26, 20]);
    g.strokeRect(t.x + 6, t.y + 6, t.w - 12, t.h - 12);
    g.setLineDash([]);
    g.restore();
  }

  drawMarkings(g, view) {
    const city = this.city;
    const { hLines, vLines } = city;

    // Verticali: tratti tra due incroci consecutivi
    for (const l of vLines) {
      const x = l.c;
      if (x + l.width < view.x || x - l.width > view.x + view.w) continue;
      for (let j = 0; j < hLines.length - 1; j++) {
        if (!l.on[j]) continue;
        const a = hLines[j].c + hLines[j].width / 2;
        const b = hLines[j + 1].c - hLines[j + 1].width / 2;
        if (b < view.y - 20 || a > view.y + view.h + 20) continue;
        this.laneMarks(g, x, a, b, l, true);
      }
    }
    // Orizzontali
    for (const l of hLines) {
      const y = l.c;
      if (y + l.width < view.y || y - l.width > view.y + view.h) continue;
      for (let i = 0; i < vLines.length - 1; i++) {
        if (!l.on[i]) continue;
        const a = vLines[i].c + vLines[i].width / 2;
        const b = vLines[i + 1].c - vLines[i + 1].width / 2;
        if (b < view.x - 20 || a > view.x + view.w + 20) continue;
        this.laneMarks(g, y, a, b, l, false);
      }
    }
  }

  /** Segnaletica di un tratto: linea centrale gialla, corsie tratteggiate, bordi. */
  laneMarks(g, c, from, to, line, vertical) {
    const hw = line.width / 2;
    const dash = 22;
    const gap = 18;

    const seg = (offset, style, width, dashed) => {
      g.strokeStyle = style;
      g.lineWidth = width;
      g.setLineDash(dashed ? [dash, gap] : []);
      g.beginPath();
      if (vertical) {
        g.moveTo(c + offset, from + 4);
        g.lineTo(c + offset, to - 4);
      } else {
        g.moveTo(from + 4, c + offset);
        g.lineTo(to - 4, c + offset);
      }
      g.stroke();
    };

    // Linea centrale
    if (line.arterial) {
      seg(-2.5, 'rgba(226,186,60,0.85)', 2, false);
      seg(2.5, 'rgba(226,186,60,0.85)', 2, false);
      seg(-36, 'rgba(240,242,246,0.6)', 1.8, true);
      seg(36, 'rgba(240,242,246,0.6)', 1.8, true);
    } else {
      seg(0, 'rgba(226,186,60,0.7)', 2, true);
    }
    // Bordi corsia
    seg(-hw + 4, 'rgba(240,242,246,0.42)', 1.6, false);
    seg(hw - 4, 'rgba(240,242,246,0.42)', 1.6, false);
    g.setLineDash([]);

    // Scritta sull'asfalto, di rado
    const len = to - from;
    if (line.arterial && len > 200) {
      const rv = hash2(c | 0, from | 0);
      if (rv < 0.28) {
        const word = ROAD_WORDS[(rv * 100 | 0) % ROAD_WORDS.length];
        g.save();
        g.fillStyle = 'rgba(240,242,246,0.3)';
        g.font = 'bold 26px system-ui, "Apple SD Gothic Neo", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        if (vertical) {
          g.translate(c - 18, from + len * 0.5);
          g.rotate(Math.PI / 2);
        } else {
          g.translate(from + len * 0.5, c - 18);
        }
        g.fillText(word, 0, 0);
        g.restore();
      }
    }

    // Tombini e macchie
    const marks = Math.floor(len / 90);
    for (let i = 0; i < marks; i++) {
      const t = (i + 0.5) / marks;
      const p = from + len * t;
      const rv = hash2((c + i * 13) | 0, p | 0);
      if (rv > 0.7) {
        const px = vertical ? c + (rv > 0.85 ? hw - 12 : -hw + 12) : p;
        const py = vertical ? p : c + (rv > 0.85 ? hw - 12 : -hw + 12);
        g.fillStyle = 'rgba(20,22,25,0.5)';
        g.beginPath();
        g.arc(px, py, 7, 0, 6.2832);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.06)';
        g.lineWidth = 1;
        g.stroke();
      } else if (rv < 0.12) {
        const px = vertical ? c + (rv - 0.06) * 220 : p;
        const py = vertical ? p : c + (rv - 0.06) * 220;
        g.fillStyle = 'rgba(12,12,14,0.22)';
        g.beginPath();
        g.ellipse(px, py, 16, 9, rv * 6, 0, 6.2832);
        g.fill();
      }
    }
  }

  drawBlock(g, b, tx, ty) {
    const d = this.city.districtById?.[b.district] || DISTRICT_BY_ID[b.district];

    // Campagna: terra e campi. Niente marciapiedi, niente cordoli — è quello che
    // fa capire di essere usciti da Seoul molto prima del cartello del distretto.
    if (b.type === 'rural') {
      g.fillStyle = '#3a3b28';
      g.fillRect(b.x, b.y, b.w, b.h);
      for (let i = 0; i < 10; i++) {
        const rv = hash2(b.x + i * 11, b.y + i * 7);
        g.fillStyle = `rgba(${70 + rv * 30 | 0},${80 + rv * 34 | 0},${44 + rv * 20 | 0},0.3)`;
        g.beginPath();
        g.ellipse(b.x + rv * b.w, b.y + hash2(b.y, i) * b.h, 40 + rv * 90, 20 + rv * 40, rv * 6, 0, 6.2832);
        g.fill();
      }
      for (const f of b.fields || []) this.drawField(g, f);
      return;
    }

    // Aeroporto: prato rasato. Piste e piazzali arrivano dopo, in `drawAirfield`.
    if (b.type === 'airport') {
      const gr = g.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      gr.addColorStop(0, '#3b4a2e');
      gr.addColorStop(1, '#33422a');
      g.fillStyle = gr;
      g.fillRect(b.x, b.y, b.w, b.h);
      return;
    }

    // Porto: piazzale di cemento con giunti e macchie di gasolio.
    if (b.type === 'port') {
      g.fillStyle = '#3a3e42';
      g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = 'rgba(0,0,0,0.2)';
      g.lineWidth = 1.5;
      for (let x = b.x + 120; x < b.x + b.w; x += 120) {
        g.beginPath(); g.moveTo(x, b.y); g.lineTo(x, b.y + b.h); g.stroke();
      }
      for (let y = b.y + 120; y < b.y + b.h; y += 120) {
        g.beginPath(); g.moveTo(b.x, y); g.lineTo(b.x + b.w, y); g.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const rv = hash2(b.x + i * 5, b.y + i * 9);
        g.fillStyle = `rgba(10,10,12,${0.12 + rv * 0.18})`;
        g.beginPath();
        g.ellipse(b.x + rv * b.w, b.y + hash2(i, b.y) * b.h, 20 + rv * 30, 12 + rv * 18, rv * 5, 0, 6.2832);
        g.fill();
      }
      return;
    }

    if (b.type === 'park') {
      const grad = g.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      grad.addColorStop(0, '#2f4a2c');
      grad.addColorStop(1, '#263d25');
      g.fillStyle = grad;
      g.fillRect(b.x, b.y, b.w, b.h);
      // Chiazze di erba e sentiero
      for (let i = 0; i < 14; i++) {
        const rv = hash2(b.x + i * 7, b.y + i * 13);
        const rv2 = hash2(b.y + i * 3, b.x + i * 11);
        g.fillStyle = `rgba(${60 + rv * 40 | 0},${90 + rv2 * 50 | 0},${50 + rv * 30 | 0},0.35)`;
        g.beginPath();
        g.ellipse(b.x + rv * b.w, b.y + rv2 * b.h, 20 + rv * 40, 14 + rv2 * 30, rv * 6, 0, 6.2832);
        g.fill();
      }
      g.strokeStyle = 'rgba(190,175,150,0.35)';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(b.x, b.y + b.h * 0.35);
      g.quadraticCurveTo(b.x + b.w * 0.5, b.y + b.h * (0.2 + hash2(b.x, b.y) * 0.6), b.x + b.w, b.y + b.h * 0.62);
      g.stroke();
      return;
    }

    // Marciapiede perimetrale
    g.fillStyle = d ? d.sidewalk : '#4c4954';
    g.fillRect(b.x, b.y, b.w, b.h);
    // Bordo e fughe delle piastrelle
    g.strokeStyle = 'rgba(255,255,255,0.075)';
    g.lineWidth = 2;
    g.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    g.strokeStyle = 'rgba(0,0,0,0.14)';
    g.lineWidth = 1;
    for (let x = b.x + 14; x < b.x + b.w; x += 14) {
      g.beginPath(); g.moveTo(x, b.y); g.lineTo(x, b.y + b.h); g.stroke();
    }
    for (let y = b.y + 14; y < b.y + b.h; y += 14) {
      g.beginPath(); g.moveTo(b.x, y); g.lineTo(b.x + b.w, y); g.stroke();
    }
    // Fascia tattile gialla lungo il bordo strada
    g.fillStyle = 'rgba(215,180,70,0.22)';
    g.fillRect(b.x + 4, b.y + 4, b.w - 8, 3);
    g.fillRect(b.x + 4, b.y + b.h - 7, b.w - 8, 3);
    g.fillRect(b.x + 4, b.y + 4, 3, b.h - 8);
    g.fillRect(b.x + b.w - 7, b.y + 4, 3, b.h - 8);

    if (b.hospital) this.drawHospital(g, b);
    if (b.station) this.drawStation(g, b);

    // Cortili interni: asfalto con stalli di parcheggio
    for (const y of b.yards) {
      if (y.stairs) { this.drawStairs(g, y); continue; }
      g.fillStyle = '#2b2e33';
      g.fillRect(y.x, y.y, y.w, y.h);
      if (noiseOk(y)) {
        g.strokeStyle = 'rgba(230,230,235,0.16)';
        g.lineWidth = 1.5;
        const stalls = Math.floor(y.w / 30);
        for (let i = 1; i < stalls; i++) {
          const x = y.x + i * 30;
          g.beginPath();
          g.moveTo(x, y.y + 4);
          g.lineTo(x, y.y + Math.min(58, y.h - 8));
          g.stroke();
        }
      }
      // Macchie d'olio
      const rv = hash2(y.x, y.y);
      if (rv > 0.55) {
        g.fillStyle = 'rgba(10,10,12,0.3)';
        g.beginPath();
        g.ellipse(y.x + y.w * rv, y.y + y.h * (1 - rv), 14, 9, rv * 5, 0, 6.2832);
        g.fill();
      }
    }
  }

  /**
   * Un appezzamento. Le risaie allagate riflettono il cielo e stanno più basse,
   * i campi asciutti sono solcati: sono due texture diverse perché a scacchiera
   * si legge la campagna, con una sola si legge un prato.
   */
  drawField(g, f) {
    const CROPS = ['#4f5c2c', '#5d6630', '#6b5f2c', '#42542e'];
    const base = f.wet ? '#33472f' : CROPS[f.crop % CROPS.length];
    g.fillStyle = base;
    g.fillRect(f.x, f.y, f.w, f.h);
    // Argine chiaro attorno all'appezzamento (논둑).
    g.strokeStyle = 'rgba(150,140,105,0.5)';
    g.lineWidth = 3;
    g.strokeRect(f.x + 1.5, f.y + 1.5, f.w - 3, f.h - 3);

    if (f.wet) {
      // Acqua ferma: bande di riflesso, non solchi.
      g.fillStyle = 'rgba(150,190,205,0.13)';
      for (let y = f.y + 8; y < f.y + f.h - 4; y += 16) {
        g.fillRect(f.x + 5, y, f.w - 10, 4);
      }
      g.fillStyle = 'rgba(90,120,80,0.35)';
      for (let i = 0; i < 16; i++) {
        const rv = hash2(f.x + i * 3, f.y + i * 5);
        g.fillRect(f.x + 6 + rv * (f.w - 12), f.y + 6 + hash2(i, f.y) * (f.h - 12), 3, 3);
      }
      return;
    }
    g.strokeStyle = 'rgba(0,0,0,0.16)';
    g.lineWidth = 2;
    if (f.rows) {
      for (let x = f.x + 9; x < f.x + f.w - 5; x += 11) {
        g.beginPath(); g.moveTo(x, f.y + 5); g.lineTo(x, f.y + f.h - 5); g.stroke();
      }
    } else {
      for (let y = f.y + 9; y < f.y + f.h - 5; y += 11) {
        g.beginPath(); g.moveTo(f.x + 5, y); g.lineTo(f.x + f.w - 5, y); g.stroke();
      }
    }
  }

  /**
   * Scalinata: cemento chiaro, un'alzata scura per gradino e i corrimano ai lati.
   * L'ombra sotto ogni alzata è quello che la fa leggere come una salita invece
   * che come una grata — il terreno qui resta in pianta come tutto il resto.
   */
  drawStairs(g, y) {
    g.fillStyle = '#6a6a70';
    g.fillRect(y.x, y.y, y.w, y.h);
    const n = y.steps || 10;
    g.lineWidth = 2;
    if (y.vertical) {
      const step = y.h / n;
      for (let i = 0; i < n; i++) {
        const yy = y.y + i * step;
        g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        g.fillRect(y.x, yy, y.w, step);
        g.fillStyle = 'rgba(0,0,0,0.34)';
        g.fillRect(y.x, yy + step - 2.5, y.w, 2.5);
      }
      g.strokeStyle = 'rgba(210,215,225,0.5)';
      g.beginPath(); g.moveTo(y.x + 4, y.y); g.lineTo(y.x + 4, y.y + y.h); g.stroke();
      g.beginPath(); g.moveTo(y.x + y.w - 4, y.y); g.lineTo(y.x + y.w - 4, y.y + y.h); g.stroke();
    } else {
      const step = y.w / n;
      for (let i = 0; i < n; i++) {
        const xx = y.x + i * step;
        g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        g.fillRect(xx, y.y, step, y.h);
        g.fillStyle = 'rgba(0,0,0,0.34)';
        g.fillRect(xx + step - 2.5, y.y, 2.5, y.h);
      }
      g.strokeStyle = 'rgba(210,215,225,0.5)';
      g.beginPath(); g.moveTo(y.x, y.y + 4); g.lineTo(y.x + y.w, y.y + 4); g.stroke();
      g.beginPath(); g.moveTo(y.x, y.y + y.h - 4); g.lineTo(y.x + y.w, y.y + y.h - 4); g.stroke();
    }
  }

  /** Piazzola dell'ospedale: croce rossa dipinta sul marciapiede, si vede da lontano. */
  drawHospital(g, b) {
    const cx = b.x + b.w / 2;
    const cy = b.y + 16;
    g.fillStyle = 'rgba(238,242,248,0.9)';
    g.fillRect(cx - 26, cy - 13, 52, 26);
    g.fillStyle = '#c62f34';
    g.fillRect(cx - 4.5, cy - 10, 9, 20);
    g.fillRect(cx - 14, cy - 4.5, 28, 9);
  }

  // Il commissariato sta sul marciapiede a sud, l'ospedale su quello a nord: sullo
  // stesso isolato restano due posti diversi anche a colpo d'occhio da lontano.
  drawStation(g, b) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h - 16;
    g.fillStyle = 'rgba(238,242,248,0.9)';
    g.fillRect(cx - 26, cy - 13, 52, 26);
    g.fillStyle = '#2f5fbf';
    g.fillRect(cx - 22, cy - 9, 44, 18);
    // Un distintivo, non il taegeuk: dipinto largo quattordici pixel di mondo,
    // qualunque dettaglio interno diventa una macchia. Anello più punto si legge.
    g.strokeStyle = 'rgba(238,242,248,0.92)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, 6.5, 0, 6.2832);
    g.stroke();
    g.fillStyle = 'rgba(238,242,248,0.92)';
    g.beginPath();
    g.arc(cx, cy, 2.6, 0, 6.2832);
    g.fill();
  }
}

function noiseOk(y) {
  return y.w > 70 && y.h > 40;
}
