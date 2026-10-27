// Griglia spaziale a celle fisse per query di prossimità su mondo grande.
//
// Contatore delle query, uno solo per tutte le griglie: un oggetto che sta in due griglie
// (un edificio è sia in `buildingGrid` sia in `solidGrid`) porta un solo `_gq`, e dato che
// ogni query ha un numero mai visto prima il valore lasciato da un'altra non collide mai.
let queryStamp = 0;

export class SpatialGrid {
  constructor(width, height, cell = 256) {
    this.cell = cell;
    this.cols = Math.ceil(width / cell) + 1;
    this.rows = Math.ceil(height / cell) + 1;
    this.buckets = new Array(this.cols * this.rows);
    // Solo chi ha inserito rettangoli può comparire in più celle, e solo lì serve deduplicare.
    this._multi = false;
  }

  _idx(cx, cy) {
    return cy * this.cols + cx;
  }

  _cellOf(v) {
    return Math.max(0, Math.floor(v / this.cell));
  }

  clear() {
    this.buckets.length = 0;
    this.buckets = new Array(this.cols * this.rows);
  }

  /** Inserisce un oggetto con campi x,y,w,h (rettangolo mondo). */
  insertRect(obj) {
    // Il campo nasce qui, a generazione, così tutti gli oggetti di una griglia hanno la stessa
    // forma prima della prima query (aggiungerlo a metà partita farebbe cambiare classe nascosta).
    if (obj._gq === undefined) obj._gq = 0;
    this._multi = true;
    const x0 = Math.min(this.cols - 1, this._cellOf(obj.x));
    const y0 = Math.min(this.rows - 1, this._cellOf(obj.y));
    const x1 = Math.min(this.cols - 1, this._cellOf(obj.x + obj.w));
    const y1 = Math.min(this.rows - 1, this._cellOf(obj.y + obj.h));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const i = this._idx(cx, cy);
        (this.buckets[i] || (this.buckets[i] = [])).push(obj);
      }
    }
  }

  /**
   * Toglie un oggetto inserito con `insertRect`. L'oggetto non deve essersi mosso
   * nel frattempo: si ricalcolano le stesse celle dell'inserimento. Serve agli
   * ostacoli che nascono e muoiono a runtime (le transenne dei posti di blocco):
   * lasciarli nella griglia significherebbe muri invisibili per il resto della partita.
   */
  removeRect(obj) {
    const x0 = Math.min(this.cols - 1, this._cellOf(obj.x));
    const y0 = Math.min(this.rows - 1, this._cellOf(obj.y));
    const x1 = Math.min(this.cols - 1, this._cellOf(obj.x + obj.w));
    const y1 = Math.min(this.rows - 1, this._cellOf(obj.y + obj.h));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const b = this.buckets[this._idx(cx, cy)];
        if (!b) continue;
        const k = b.indexOf(obj);
        if (k >= 0) b.splice(k, 1);
      }
    }
  }

  /** Inserisce un oggetto puntiforme con campi x,y. */
  insertPoint(obj) {
    const cx = Math.min(this.cols - 1, this._cellOf(obj.x));
    const cy = Math.min(this.rows - 1, this._cellOf(obj.y));
    const i = this._idx(cx, cy);
    (this.buckets[i] || (this.buckets[i] = [])).push(obj);
  }

  /**
   * Oggetti unici che toccano il rettangolo dato.
   *
   * Prima la deduplica era una `Map` oggetto→numero di query, scritta per ogni oggetto di ogni
   * query (la voce più alta di JS puro nel profilo di un frame, §5.45). Adesso è un intero
   * sull'oggetto, e le griglie di soli punti (veicoli e pedoni, ricostruite a ogni frame) non
   * deduplicano affatto: un oggetto sta in una cella sola. L'ordine dei risultati non cambia.
   */
  queryRect(x, y, w, h, out = []) {
    out.length = 0;
    const x0 = Math.max(0, Math.min(this.cols - 1, this._cellOf(x)));
    const y0 = Math.max(0, Math.min(this.rows - 1, this._cellOf(y)));
    const x1 = Math.max(0, Math.min(this.cols - 1, this._cellOf(x + w)));
    const y1 = Math.max(0, Math.min(this.rows - 1, this._cellOf(y + h)));
    const buckets = this.buckets, cols = this.cols;
    if (this._multi) {
      const stamp = ++queryStamp;
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const b = buckets[cy * cols + cx];
          if (!b) continue;
          for (let k = 0; k < b.length; k++) {
            const o = b[k];
            if (o._gq === stamp) continue;
            o._gq = stamp;
            out.push(o);
          }
        }
      }
      return out;
    }
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const b = buckets[cy * cols + cx];
        if (!b) continue;
        for (let k = 0; k < b.length; k++) out.push(b[k]);
      }
    }
    return out;
  }

  queryCircle(cx, cy, r, out = []) {
    this.queryRect(cx - r, cy - r, r * 2, r * 2, out);
    return out;
  }
}

/** Griglia dinamica, ricostruita ogni frame per entità in movimento. */
export class DynamicGrid extends SpatialGrid {
  constructor(width, height, cell) {
    super(width, height, cell);
    this._used = [];
  }

  /**
   * Si svuotano **solo le celle toccate** l'ultima volta, non tutto l'array.
   * Finché il mondo era una città sola le celle erano un paio di migliaia e
   * riallocarle sessanta volte al secondo non si notava; sulla mappa unificata
   * sono decine di migliaia per griglia, e quella riallocazione da sola valeva
   * più della metà del frame rate.
   */
  rebuild(items) {
    for (let i = 0; i < this._used.length; i++) this.buckets[this._used[i]] = undefined;
    this._used.length = 0;
    for (const it of items) this.insertPoint(it);
  }

  insertPoint(obj) {
    const cx = Math.min(this.cols - 1, this._cellOf(obj.x));
    const cy = Math.min(this.rows - 1, this._cellOf(obj.y));
    const i = this._idx(cx, cy);
    let bucket = this.buckets[i];
    if (!bucket) {
      bucket = this.buckets[i] = [];
      this._used.push(i);
    }
    bucket.push(obj);
  }
}
