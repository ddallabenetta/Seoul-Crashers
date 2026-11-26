// L'oggetto che si porta in mano.
//
// I tre pegni di M2 erano tre caselle in un taccuino (§5.29): non si vedevano
// addosso e non si potevano perdere. Va bene per una lista della spesa e non va
// bene per **i due fogli del molo 7**, che sono la prova su cui gira l'Atto I e
// che il giocatore attraversa mezzo porto con addosso, sotto tiro.
//
// La differenza fra le due cose è una sola, ed è tutta qui dentro: **un oggetto
// trasportabile si perde**. Morire o farsi arrestare lo lascia per terra dov'eri,
// e chi lo rivuole ci torna. Non lo confisca nessuno — la divisa ti prende
// l'arsenale (§5.16), non un registro di carico — e non svanisce mai: sparire
// sarebbe un fallimento senza un posto dove andare a rimediare.
//
// **Ce n'è uno per volta**, come il blip e come il pedinamento. Una missione che
// ne volesse due chiederebbe un inventario, e questo gioco non ne ha uno.
import { dist } from './math.js';

/** Da quanto lontano si raccoglie: come una raccolta a terra (`pickups.js`). */
const REACH = 30;

export class CarrySystem {
  constructor() {
    this.item = null;      // quello che si ha in mano, o `null`
    this.dropped = null;   // { item, x, y }: quello lasciato per terra
    this._x = 0;
    this._y = 0;
  }

  /**
   * Le due sconfitte lasciano cadere quello che si ha in mano. Ci si iscrive a
   * `respawn` e `busted` — gli stessi due della ripresa di una fase — ma il
   * posto in cui cade **non** è quello che ha il giocatore in quel momento: lì è
   * già in corsia o in cella. È l'ultimo punto buono in cui è stato visto, che
   * questo sistema tiene aggiornato a ogni frame per questa riga sola.
   */
  attach(game) {
    const fall = () => this.fall(game);
    game.on('respawn', fall);
    game.on('busted', fall);
  }

  has(id) {
    return !!this.item && (!id || this.item.id === id);
  }

  /** Preso. `item` è `{ id, label, hangul }` — quello che serve a scriverlo. */
  take(game, item) {
    this.item = item;
    this.dropped = null;
    game.hud.toast(`In mano: ${item.label}`, 2.8);
    game.audio?.pickup('weapon');
    return item;
  }

  /** Consegnato, o non serve più. Non è una perdita: sparisce e basta. */
  clear() {
    this.item = null;
    this.dropped = null;
  }

  /**
   * Il punto asciutto e libero più vicino a (x, y). Chi muore su una barca lascia cadere la cassa
   * **a riva** e non in mezzo alla baia: un oggetto che nessuno può raccogliere non è una perdita, è
   * una missione senza uscita (M10, §5.43). In terraferma torna il punto stesso.
   */
  landNear(game, x, y) {
    const city = game.city;
    const wet = (px, py) => (city.isNavigable ? city.isNavigable(px, py) : city.isWater?.(px, py));
    if (!wet(x, y)) return { x, y };
    const free = (px, py) => !wet(px, py)
      && !(city.solidGrid?.queryCircle(px, py, 18) || []).some((o) => px > o.x - 14 && px < o.x + o.w + 14 && py > o.y - 14 && py < o.y + o.h + 14);
    for (let r = 40; r <= 2400; r += 40) {
      const n = Math.max(12, Math.round(r / 18));
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (free(px, py)) return { x: px, y: py };
      }
    }
    return { x, y };
  }

  fall(game) {
    if (!this.item) return;
    const at = this.landNear(game, this._x, this._y);
    this.dropped = { item: this.item, x: at.x, y: at.y };
    this.item = null;
    game.hud.toast(`${this.dropped.item.label} — ti è rimasto dov'eri`, 4);
  }

  update(dt, game) {
    const pl = game.player;
    // L'ultimo punto buono: fuori da un edificio (dentro, le coordinate sono
    // quelle della pianta — §3) e ancora in piedi.
    if (!game.indoors && !pl.dying) {
      this._x = pl.x;
      this._y = pl.y;
    }
    const d = this.dropped;
    if (!d || game.indoors || pl.dying || !pl.onFoot) return;
    if (dist(pl.x, pl.y, d.x, d.y) > REACH) return;
    this.take(game, d.item);
  }

  /** Nel salvataggio va quello che si ha in mano e quello che si è perso. */
  snapshot() {
    return { item: this.item, dropped: this.dropped };
  }

  restore(data) {
    this.item = data?.item || null;
    this.dropped = data?.dropped || null;
  }

  reset() {
    this.item = null;
    this.dropped = null;
  }
}
