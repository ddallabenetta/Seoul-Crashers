// La rotta di una motovedetta: una griglia d'acqua grossa e una visita in ampiezza.
//
// Le motovedette (§5.5) inseguivano **in linea retta**, e andava bene sul Han: un fiume largo trecento
// pixel non ha niente in mezzo. Sulla costa di Busan (§5.41) la linea retta attraversa penisole, moli e
// l'isola di Yeongdo, e lo scafo si pianta contro la riva mentre il giocatore se ne va: una prova di M10
// con la polizia vera (§5.43) ha misurato motovedette a 1300 px dopo dieci secondi. La T9d aveva provato
// le barche sotto il ponte, non le barche **inseguite**.
//
// Quello che c'è qui non è un pathfinding da gioco di strategia: è la cosa più piccola che dica a una
// barca **da che parte girare** quando la linea retta è bagnata a metà. La griglia è di 96 px (una
// barca è larga 34), una cella è acqua solo se lo sono il centro e i quattro lati — niente rotte che
// sfiorano la riva — e i piloni dei ponti (`city.pylons`) la chiudono con un margine. Si ricalcola
// ogni mezzo secondo per scafo, e costa una visita su ~5000 celle.
//
// **Non sostituisce la guida**: `police.driveBoat` continua a puntare il giocatore quando la linea è
// libera, e a seguire il punto che ricava da qui quando non lo è. Anti-incastro, tiro e distanze sono
// quelli di sempre.

const CELL = 96;
/** Un cella è libera solo se l'acqua arriva a questa distanza dal suo centro, in tutte e quattro le direzioni. */
const SIDE = 34;
/** Attorno a un pilone la griglia è chiusa per questo margine. */
const PYLON_MARGIN = 60;

export class BoatNav {
  constructor(city) {
    this.city = city;
    this.grids = new Map();
    this.prev = null;
    this.queue = null;
  }

  wet(x, y) {
    const c = this.city;
    return c.isNavigable ? c.isNavigable(x, y) : c.isWater(x, y);
  }

  /** La griglia di un'area, costruita **la prima volta che serve** e poi tenuta. */
  grid(area) {
    const key = area ? area.id : '*';
    let g = this.grids.get(key);
    if (g) return g;
    const x0 = area ? area.x0 : 0;
    const y0 = area ? area.y0 : 0;
    const x1 = area ? area.x1 : this.city.w;
    const y1 = area ? area.y1 : this.city.h;
    const W = Math.max(1, Math.ceil((x1 - x0) / CELL));
    const H = Math.max(1, Math.ceil((y1 - y0) / CELL));
    const ok = new Uint8Array(W * H);
    const pylons = this.city.pylons || [];
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const cx = x0 + i * CELL + CELL / 2;
        const cy = y0 + j * CELL + CELL / 2;
        if (!this.wet(cx, cy)) continue;
        if (!this.wet(cx - SIDE, cy) || !this.wet(cx + SIDE, cy) || !this.wet(cx, cy - SIDE) || !this.wet(cx, cy + SIDE)) continue;
        let blocked = false;
        for (const p of pylons) {
          if (cx > p.x - PYLON_MARGIN && cx < p.x + p.w + PYLON_MARGIN && cy > p.y - PYLON_MARGIN && cy < p.y + p.h + PYLON_MARGIN) { blocked = true; break; }
        }
        if (!blocked) ok[j * W + i] = 1;
      }
    }
    g = { x0, y0, W, H, ok };
    this.grids.set(key, g);
    return g;
  }

  /** Acqua libera lungo il segmento, con un po' di spazio ai lati: la barca non è un punto. */
  clear(x0, y0, x1, y1, side = 26) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1) return true;
    const nx = -dy / len;
    const ny = dx / len;
    const n = Math.ceil(len / 32);
    const pylons = this.city.pylons || [];
    for (let i = 1; i <= n; i++) {
      const x = x0 + (dx * i) / n;
      const y = y0 + (dy * i) / n;
      if (!this.wet(x, y) || !this.wet(x + nx * side, y + ny * side) || !this.wet(x - nx * side, y - ny * side)) return false;
      for (const p of pylons) {
        if (x > p.x - 30 && x < p.x + p.w + 30 && y > p.y - 30 && y < p.y + p.h + 30) return false;
      }
    }
    return true;
  }

  /** La cella libera più vicina a (x, y): quella in cui sta, o la prima di un anello attorno. */
  cellNear(g, x, y) {
    const ci = Math.min(g.W - 1, Math.max(0, Math.floor((x - g.x0) / CELL)));
    const cj = Math.min(g.H - 1, Math.max(0, Math.floor((y - g.y0) / CELL)));
    if (g.ok[cj * g.W + ci]) return cj * g.W + ci;
    for (let r = 1; r <= 8; r++) {
      let best = -1;
      let bd = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= g.W || j >= g.H || !g.ok[j * g.W + i]) continue;
          const d = di * di + dj * dj;
          if (d < bd) { bd = d; best = j * g.W + i; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /**
   * Il punto verso cui girare per arrivare da (fx, fy) a (tx, ty) **per acqua**: il più lontano fra i
   * prossimi della rotta che si vede in linea retta. `null` se non c'è rotta (un lago chiuso, un
   * giocatore a riva): allora la barca fa quello che faceva prima, e si incastra come prima.
   */
  way(area, fx, fy, tx, ty) {
    const g = this.grid(area);
    const a = this.cellNear(g, fx, fy);
    const b = this.cellNear(g, tx, ty);
    if (a < 0 || b < 0) return null;
    const n = g.W * g.H;
    if (!this.prev || this.prev.length < n) { this.prev = new Int32Array(n); this.queue = new Int32Array(n); }
    const prev = this.prev;
    const q = this.queue;
    prev.fill(-2, 0, n);
    prev[a] = -1;
    let head = 0;
    let tail = 0;
    q[tail++] = a;
    let found = a === b;
    while (head < tail && !found) {
      const cur = q[head++];
      const ci = cur % g.W;
      const cj = (cur - ci) / g.W;
      for (let dj = -1; dj <= 1 && !found; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= g.W || j >= g.H) continue;
          const nx = j * g.W + i;
          if (!g.ok[nx] || prev[nx] !== -2) continue;
          // Niente diagonali che tagliano un angolo di terra: la barca ci si incastrerebbe.
          if (di && dj && (!g.ok[cj * g.W + i] || !g.ok[j * g.W + ci])) continue;
          prev[nx] = cur;
          if (nx === b) { found = true; break; }
          q[tail++] = nx;
        }
      }
    }
    if (!found) return null;
    const path = [];
    for (let c = b; c >= 0; c = prev[c]) path.push(c);
    path.reverse();
    const pt = (c) => ({ x: g.x0 + (c % g.W) * CELL + CELL / 2, y: g.y0 + Math.floor(c / g.W) * CELL + CELL / 2 });
    let pick = path.length > 1 ? 1 : 0;
    for (let k = Math.min(path.length - 1, 10); k > 0; k--) {
      const p = pt(path[k]);
      if (this.clear(fx, fy, p.x, p.y)) { pick = k; break; }
    }
    return pt(path[pick]);
  }
}
