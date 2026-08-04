// Sistema di ricercato a 5 livelli (Fase 2, tappa B).
//
// Due numeri, non uno. `heat` è il reato accumulato in punti, `level` è come lo
// legge il giocatore (le stelle). Serve la coppia perché i reati piccoli devono
// sommarsi — quattro colpi sparati in strada valgono una stella, un cadavere ne
// vale due subito — e perché scendere di livello non deve azzerare tutto: si perde
// una stella per volta, e sotto resta l'accumulo.
//
// Come si sale: ogni reato aggiunge heat e **riazzera il cronometro della fuga**.
// Come si scende: bisogna non farsi vedere. Finché una pattuglia ti ha in linea di
// vista (o il riflettore dell'elicottero ti tiene), `unseenT` resta a zero; appena
// li semini comincia a correre, e dopo `COOL_TIME[level]` secondi cade una stella.
// È il compromesso scelto con l'utente rispetto al "raggio in cui nessuno ti vede":
// costa un raycast per pattuglia e non un giro su tutti i pedoni della città.
import { dist } from '../core/math.js';

export const MAX_WANTED = 5;

// Soglia di heat di ogni livello. Tarate sui pesi qui sotto: un morto = 2 stelle,
// un poliziotto steso = 3, due poliziotti = 4.
const LEVEL_HEAT = [0, 10, 24, 52, 92, 145];

// Secondi di invisibilità per perdere una stella. Più si sale, più tempo serve.
const COOL_TIME = [0, 7, 11, 15, 20, 26];

// Peso dei reati. `gunshot` è limitato in frequenza (vedi `shotCd`), altrimenti una
// raffica di SMG varrebbe cinque stelle in un secondo.
const CRIMES = {
  brawl: 1.5,    // pugni e mazzate
  gunshot: 3,    // sparare in strada
  theft: 6,      // auto rubata sotto gli occhi di qualcuno
  copTheft: 12,  // ... o sotto quelli di una pattuglia
  copHit: 12,    // poliziotto ferito
  rob: 22,       // cassa di un negozio svuotata
  wreck: 18,     // veicolo fatto esplodere
  kill: 24,      // cadavere
  copKill: 60,   // poliziotto ammazzato
};

const STARS = ['', '★', '★★', '★★★', '★★★★', '★★★★★'];

function levelFor(heat) {
  let lvl = 0;
  for (let i = 1; i <= MAX_WANTED; i++) if (heat >= LEVEL_HEAT[i]) lvl = i;
  return lvl;
}

export class WantedSystem {
  constructor() {
    this.level = 0;
    this.heat = 0;
    this.seen = false;
    this.unseenT = 0;
    this.shotCd = 0;
    this.t = 0;
    // Ultima posizione nota: è lì che vanno le pattuglie quando ti perdono.
    this.lastX = 0;
    this.lastY = 0;
  }

  get stars() {
    return STARS[this.level];
  }

  /** Frazione di raffreddamento in corso (0 = appena visto, 1 = stella persa). */
  get cooling() {
    if (this.level === 0) return 0;
    return Math.min(1, this.unseenT / COOL_TIME[this.level]);
  }

  /**
   * Segnala un reato. `witness` serve solo ai reati silenziosi (il furto d'auto):
   * uno sparo lo sente tutto l'isolato e qualcuno chiama il 112 comunque.
   */
  report(kind, game, opts = {}) {
    const weight = CRIMES[kind];
    if (!weight) return;
    if (kind === 'gunshot') {
      if (this.shotCd > 0) return;
      this.shotCd = 0.55;
    }
    this.add(weight * (opts.mul || 1), game);
  }

  add(amount, game) {
    const before = this.level;
    this.heat = Math.min(LEVEL_HEAT[MAX_WANTED] + 90, this.heat + amount);
    this.level = levelFor(this.heat);
    this.unseenT = 0;
    this.lastX = game.player.x;
    this.lastY = game.player.y;
    if (this.level > before) {
      game.hud.toast(`수배 ${this.stars}`, 2.2);
      game.stats.maxWanted = Math.max(game.stats.maxWanted || 0, this.level);
    }
  }

  update(dt, game) {
    this.t += dt;
    this.shotCd = Math.max(0, this.shotCd - dt);
    if (this.level === 0) {
      // Sotto la prima stella l'accumulo si scarica piano: deve durare abbastanza
      // da sommare quattro colpi sparati in una manciata di secondi, non tanto da
      // farti arrivare la volante per una rissa di dieci minuti fa.
      this.heat = Math.max(0, this.heat - dt * 0.6);
      this.seen = false;
      return;
    }
    if (game.player.dying) return;

    this.seen = game.police ? game.police.spotted : false;
    if (this.seen) {
      this.unseenT = 0;
      this.lastX = game.player.x;
      this.lastY = game.player.y;
      return;
    }
    this.unseenT += dt;
    if (this.unseenT >= COOL_TIME[this.level]) this.drop(game);
  }

  /** Una stella in meno. L'heat scende al minimo del livello raggiunto. */
  drop(game) {
    this.level = Math.max(0, this.level - 1);
    this.heat = LEVEL_HEAT[this.level];
    this.unseenT = 0;
    if (this.level === 0) game.hud.toast('Li hai seminati', 2.4);
  }

  reset() {
    this.level = 0;
    this.heat = 0;
    this.unseenT = 0;
    this.seen = false;
  }

  /** Distanza dall'ultima posizione nota: la usa la polizia per il rastrellamento. */
  distFromLastKnown(x, y) {
    return dist(x, y, this.lastX, this.lastY);
  }
}
