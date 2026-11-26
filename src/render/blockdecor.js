// Pittura piatta degli isolati (§5.39): stagni, campi sportivi, piazzali, orti,
// filari, recinti. Sono dati di `block.decor` (li scrive `world/blocklife.js`) e
// finiscono **nel tile del terreno**, quindi costano una volta sola per tile e
// zero per frame. Tutto è deterministico: il rumore viene da hash di coordinate.

function h2(x, y) {
  let h = Math.imul(Math.round(x * 7) | 0, 374761393) ^ Math.imul(Math.round(y * 7) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Contorno irregolare ma chiuso: stagni e sponde non sono ellissi perfette. */
function blob(g, cx, cy, rx, ry, seed, wob = 0.14) {
  const n = 18;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (h2(seed, i % n) - 0.5) * wob * 2;
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}

const PAINT = {
  pond(g, d) {
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2, rx = d.w / 2, ry = d.h / 2;
    // Sponda: erba calpestata e una cornice di pietre chiare.
    blob(g, cx, cy, rx + 7, ry + 7, d.seed, 0.1);
    g.fillStyle = 'rgba(176,164,130,0.55)'; g.fill();
    blob(g, cx, cy, rx + 2, ry + 2, d.seed, 0.12);
    g.fillStyle = '#6f7468'; g.fill();
    blob(g, cx, cy, rx - 2, ry - 2, d.seed, 0.12);
    const gr = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.3, 2, cx, cy, Math.max(rx, ry));
    gr.addColorStop(0, '#4b8da0'); gr.addColorStop(1, '#285566');
    g.fillStyle = gr; g.fill();
    g.save();
    blob(g, cx, cy, rx - 2, ry - 2, d.seed, 0.12);
    g.clip();
    g.strokeStyle = 'rgba(210,235,242,0.22)'; g.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      const y = d.y + d.h * (0.2 + i * 0.15);
      g.beginPath(); g.moveTo(d.x + d.w * 0.15, y); g.quadraticCurveTo(cx, y + 5, d.x + d.w * 0.85, y); g.stroke();
    }
    // Ninfee: dischi verdi con un punto rosa, sempre dalla stessa parte.
    for (let i = 0; i < 7; i++) {
      const a = h2(d.seed, i + 40) * 6.28, r = 0.25 + h2(d.seed, i + 60) * 0.5;
      const lx = cx + Math.cos(a) * rx * r, ly = cy + Math.sin(a) * ry * r;
      g.fillStyle = '#4f8a45'; g.beginPath(); g.arc(lx, ly, 4.2, 0.4, 6.0); g.lineTo(lx, ly); g.fill();
      if (i % 3 === 0) { g.fillStyle = '#e98bb0'; g.beginPath(); g.arc(lx + 1, ly, 1.5, 0, 6.2832); g.fill(); }
    }
    g.restore();
  },

  court(g, d) {
    const { x, y, w, h } = d;
    const football = d.sport === 'football';
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    if (football) {
      g.fillStyle = '#3f7a3a'; g.fillRect(x, y, w, h);
      const n = Math.max(4, Math.floor(w / 24));
      for (let i = 0; i < n; i += 2) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + (i * w) / n, y, w / n, h); }
    } else {
      g.fillStyle = d.tint ? '#a8503a' : '#3b6f86'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.04)';
      for (let yy = y + 6; yy < y + h; yy += 10) g.fillRect(x, yy, w, 1);
    }
    g.strokeStyle = 'rgba(245,245,240,0.85)'; g.lineWidth = 2;
    g.strokeRect(x + 5, y + 5, w - 10, h - 10);
    g.beginPath(); g.moveTo(x + w / 2, y + 5); g.lineTo(x + w / 2, y + h - 5); g.stroke();
    g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.16, 0, 6.2832); g.stroke();
    if (football) {
      const bh = h * 0.46, bw = Math.min(26, w * 0.14);
      g.strokeRect(x + 5, y + (h - bh) / 2, bw, bh);
      g.strokeRect(x + w - 5 - bw, y + (h - bh) / 2, bw, bh);
    } else {
      // Aree dipinte sotto i canestri e arco da tre.
      const kh = h * 0.4, kw = Math.min(30, w * 0.2);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(x + 5, y + (h - kh) / 2, kw, kh); g.fillRect(x + w - 5 - kw, y + (h - kh) / 2, kw, kh);
      g.strokeRect(x + 5, y + (h - kh) / 2, kw, kh); g.strokeRect(x + w - 5 - kw, y + (h - kh) / 2, kw, kh);
      g.beginPath(); g.arc(x + 5, y + h / 2, h * 0.36, -1.2, 1.2); g.stroke();
      g.beginPath(); g.arc(x + w - 5, y + h / 2, h * 0.36, Math.PI - 1.2, Math.PI + 1.2); g.stroke();
    }
    // Recinto di rete attorno al campo.
    g.strokeStyle = 'rgba(30,36,40,0.7)'; g.lineWidth = 1.6; g.setLineDash([3, 3]);
    g.strokeRect(x - 2, y - 2, w + 4, h + 4); g.setLineDash([]);
  },

  plaza(g, d) {
    const { x, y, w, h } = d;
    g.fillStyle = d.col || '#7b7a76'; rr(g, x, y, w, h, 6); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1;
    const t = d.tile || 16;
    for (let xx = x + t; xx < x + w; xx += t) { g.beginPath(); g.moveTo(xx, y + 2); g.lineTo(xx, y + h - 2); g.stroke(); }
    for (let yy = y + t; yy < y + h; yy += t) { g.beginPath(); g.moveTo(x + 2, yy); g.lineTo(x + w - 2, yy); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; rr(g, x + 3, y + 3, w - 6, h - 6, 4); g.stroke();
    if (d.ring) {
      g.strokeStyle = 'rgba(60,70,80,0.35)'; g.lineWidth = 3;
      g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, 0, 6.2832); g.stroke();
    }
  },

  sandpit(g, d) {
    const { x, y, w, h } = d;
    g.fillStyle = d.tint ? '#3f7a5a' : '#4a6fa5'; rr(g, x, y, w, h, 8); g.fill();
    g.fillStyle = '#d2bd8a'; rr(g, x + 7, y + 7, w - 14, h - 14, 6); g.fill();
    g.fillStyle = 'rgba(120,96,50,0.25)';
    for (let i = 0; i < 18; i++) g.fillRect(x + 9 + h2(d.seed, i) * (w - 20), y + 9 + h2(i, d.seed) * (h - 20), 2, 2);
  },

  plots(g, d) {
    // Orti urbani: aiuole rialzate in fila con un sentiero di terra battuta.
    const { x, y, w, h } = d;
    g.fillStyle = '#7e6f4f'; g.fillRect(x, y, w, h);
    const cols = d.cols, rows = d.rows;
    const cw = w / cols, ch = h / rows;
    const crops = ['#5f9a44', '#7fae3c', '#4b8a50', '#a0b43a', '#6a8f3a'];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const px = x + i * cw + 3, py = y + j * ch + 3, pw = cw - 6, ph = ch - 6;
        g.fillStyle = '#4f3a28'; g.fillRect(px, py, pw, ph);
        g.fillStyle = crops[Math.floor(h2(i + d.seed, j) * crops.length)];
        const vert = h2(j, i + d.seed) > 0.5;
        const n = Math.max(2, Math.floor((vert ? pw : ph) / 5));
        for (let k = 0; k < n; k++) {
          if (vert) g.fillRect(px + 2 + k * ((pw - 4) / n), py + 2, 2.4, ph - 4);
          else g.fillRect(px + 2, py + 2 + k * ((ph - 4) / n), pw - 4, 2.4);
        }
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.strokeRect(px, py, pw, ph);
      }
    }
  },

  grass(g, d) {
    const { x, y, w, h } = d;
    g.fillStyle = d.col || '#4d7a3a'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    const step = d.step || 12;
    for (let i = 0; i * step < (d.vert ? w : h); i += 2) {
      if (d.vert) g.fillRect(x + i * step, y, step, h); else g.fillRect(x, y + i * step, w, step);
    }
  },

  dirt(g, d) {
    const { x, y, w, h } = d;
    g.fillStyle = '#6f5c3f'; rr(g, x, y, w, h, 5); g.fill();
    g.strokeStyle = 'rgba(40,28,14,0.3)'; g.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const yy = y + h * (0.3 + i * 0.4);
      g.beginPath(); g.moveTo(x + 4, yy); g.lineTo(x + w - 4, yy); g.stroke();
    }
    g.fillStyle = 'rgba(30,20,10,0.22)';
    for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(x + h2(d.seed, i) * w, y + h2(i, d.seed) * h, 6, 3, 0, 0, 6.2832); g.fill(); }
  },

  fence(g, d) {
    const { x, y, w, h } = d;
    g.strokeStyle = 'rgba(120,92,58,0.9)'; g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
    g.fillStyle = '#4d3a26';
    for (let xx = x; xx <= x + w + 1; xx += 20) { g.fillRect(xx - 1.5, y - 1.5, 3, 3); g.fillRect(xx - 1.5, y + h - 1.5, 3, 3); }
    for (let yy = y; yy <= y + h + 1; yy += 20) { g.fillRect(x - 1.5, yy - 1.5, 3, 3); g.fillRect(x + w - 1.5, yy - 1.5, 3, 3); }
  },

  stonewall(g, d) {
    // Muretto a secco di basalto (돌담): i campi di Jeju sono tutti chiusi da pietre
    // nere ammassate, senza malta. Un ellisse scura ogni sette pixel lungo il bordo.
    const { x, y, w, h, seed } = d;
    let i = 0;
    const stone = (px, py) => {
      const k = i++;
      const r = 2.8 + h2(seed, k) * 3.2;
      g.fillStyle = h2(seed, k + 99) > 0.5 ? '#3d3c3a' : '#2b2b2a';
      g.beginPath(); g.ellipse(px, py, r * 1.35, r, h2(seed, k + 7) * 3, 0, 6.2832); g.fill();
    };
    for (let xx = x; xx <= x + w; xx += 7) { stone(xx, y); stone(xx, y + h); }
    for (let yy = y + 7; yy < y + h; yy += 7) { stone(x, yy); stone(x + w, yy); }
  },

  paddy(g, d) {
    // Risaia con le piantine in file regolari sull'acqua bassa.
    const { x, y, w, h } = d;
    g.fillStyle = '#4c7a62'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(190,220,225,0.14)'; g.fillRect(x, y, w, h);
    g.fillStyle = '#79ab4d';
    for (let xx = x + 8; xx < x + w - 5; xx += 9) {
      for (let yy = y + 8; yy < y + h - 5; yy += 9) g.fillRect(xx, yy, 2.2, 2.2);
    }
    g.strokeStyle = 'rgba(170,158,118,0.8)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  },

  stripes(g, d) {
    // Segnaletica di piazzale: fascia a righe gialle e nere, corsie di carico.
    const { x, y, w, h } = d;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = 'rgba(30,32,36,0.8)'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(232,190,50,0.85)';
    for (let i = -h; i < w + h; i += 14) {
      g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + 7, y + h); g.lineTo(x + i + 7 + h, y); g.lineTo(x + i + h, y); g.closePath(); g.fill();
    }
    g.restore();
  },

  lane(g, d) {
    // Corsia dipinta di giallo per i carrelli, con la freccia.
    const { x, y, w, h } = d;
    g.strokeStyle = 'rgba(232,190,50,0.75)'; g.lineWidth = 2;
    g.setLineDash([10, 7]); g.strokeRect(x, y, w, h); g.setLineDash([]);
  },

  path(g, d) {
    g.strokeStyle = 'rgba(190,175,150,0.4)'; g.lineWidth = d.w || 9; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    d.pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.stroke();
  },
};

export function drawBlockDecor(g, b) {
  for (const d of b.decor) {
    const fn = PAINT[d.kind];
    if (fn) { g.save(); fn(g, d); g.restore(); }
  }
}
