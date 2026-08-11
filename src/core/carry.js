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

  fall(game) {
    if (!this.item) return;
    this.dropped = { item: this.item, x: this._x, y: this._y };
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
