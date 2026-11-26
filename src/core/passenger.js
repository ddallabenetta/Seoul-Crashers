// Il passeggero: qualcuno in macchina che parla mentre si guida.
//
// M9 è una missione fatta di una conversazione (`docs/storia/05-atto-3.md`): Chun-sik sale, e
// per quattrocento chilometri parla. Non è `ui/dialogue.js` — quello ferma il mondo e aspetta
// un tasto, e un uomo che racconta di trent'anni fa a duecento all'ora non aspetta nessuno —
// e non è 까치: la radio ha il suo quadrante, la sua frequenza e le sue sei regole. Questo è il
// terzo modo in cui il gioco fa parlare qualcuno, ed è il più semplice: una coda di righe che
// scorre da sola alla velocità di lettura, **solo se chi guida è davvero in macchina**.
//
// Quello che sa questo file è poco, e non sa chi sia nessuno:
//
//   · **parla solo se il giocatore è su un mezzo di terra.** Sceso dall'auto, la coda si
//     ferma dove sta; risalito, riprende. Una riga detta nel vuoto non è stata detta;
//   · **una chiamata al telefono** (`phone: true`) è la stessa coda senza il vincolo della
//     portiera: la risata di M10 arriva su una barca, e il telefono si sente ovunque;
//   · **`hush` fa tacere tutto il resto** — la musica della caccia, la radio vera — perché la
//     confessione di M9 va detta «senza pannello, senza musica, con l'auto a duecento»;
//   · **Kkachi tace con qualcuno a bordo** (`core/kkachi.js`, `canSpeak`): la chiamata 17 si
//     innesca «da solo» per questo. Non è una regola nuova del personaggio, è la prima.
//
// Lo stato non entra nel salvataggio: la fase che lo muove sta nel taccuino della missione, e
// riprendere vuol dire ricominciare **dal tratto** (è la sola punizione di M9, §5.43).
import { VEHICLE_TYPES } from '../render/sprites.js';

/** Quanto resta a schermo una riga: una base più il tempo di leggerla. */
const BASE = 1.7;
const PER_CHAR = 0.04;
const MIN = 2.2;
const MAX = 8;
/** Il respiro fra due righe. */
const GAP = 0.5;

function lineTime(line) {
  if (line.hold) return line.hold;
  const n = (line.text || '').length;
  return Math.min(MAX, Math.max(MIN, BASE + n * PER_CHAR));
}

export class PassengerSystem {
  constructor() {
    this.reset();
  }

  reset() {
    /** Chi è a bordo, o `null`. Ce n'è uno: come il blip e come il pedinamento. */
    this.who = null;
    this.hangul = null;
    this.queue = [];
    this.line = null;
    this.last = null;
    this.t = 0;
    this.dur = 0;
    this.gap = 0;
    /** Fa tacere musica e radio: la confessione di M9. */
    this.hush = false;
    this.shown = 0;
    this.tail = 0;
  }

  get aboard() {
    return !!this.who;
  }

  get talking() {
    return !!this.line || this.queue.length > 0;
  }

  /** Salito. Le righe che aveva ancora da dire non sopravvivono a un cambio di passeggero. */
  board(who, hangul = null) {
    this.reset();
    this.who = who;
    this.hangul = hangul;
  }

  /** Sceso. */
  alight() {
    this.reset();
  }

  /**
   * Mette in coda delle righe: `{ who?, text, hold? }`. Il nome è quello del passeggero se manca.
   * `phone` le rende audibili anche fuori da un'auto (il telefono di Jae-min), `front` le mette
   * prima di tutto il resto — il tratto che ricomincia non aspetta il vecchio.
   */
  say(lines, opts = {}) {
    const rows = (Array.isArray(lines) ? lines : [lines]).map((l) => ({
      who: l.who || this.who, text: l.text, hold: l.hold || 0, phone: !!(opts.phone || l.phone),
    }));
    if (opts.front) { this.queue.length = 0; this.line = null; this.gap = 0; }
    this.queue.push(...rows);
  }

  /** Quello che resta da dire (la riga in corso compresa), nella forma di `ui/dialogue.js`. */
  pending() {
    const out = this.line ? [this.line] : [];
    return out.concat(this.queue).map((l) => ({ who: l.who, text: l.text }));
  }

  clear() {
    this.queue.length = 0;
    this.line = null;
    this.gap = 0;
    this.tail = 0;
  }

  /**
   * Può parlare in questo frame? La portiera e il mondo che gira: un menu aperto, un dialogo o
   * un pannello mettono la riga in pausa, non la perdono.
   */
  canRun(game, line) {
    if (!game.started || game.indoors || !game.mode.worldRuns) return false;
    if (game.dialogue?.active || game.cutscene?.active) return false;
    const pl = game.player;
    if (pl.dying) return false;
    if (line?.phone) return true;
    const v = pl.vehicle;
    const spec = v && VEHICLE_TYPES[v.kind];
    return !!spec && !pl.onFoot && !v.dead && !spec.marine && !spec.air;
  }

  update(dt, game) {
    if (this.tail > 0) this.tail = Math.max(0, this.tail - dt);
    const next = this.line || this.queue[0];
    if (!next || !this.canRun(game, next)) return;
    this.shown += dt;
    if (this.gap > 0) { this.gap -= dt; return; }
    if (!this.line) {
      this.line = this.queue.shift();
      this.t = 0;
      this.dur = lineTime(this.line);
      this.shown = 0;
      return;
    }
    this.t += dt;
    if (this.t < this.dur) return;
    this.last = this.line;
    this.line = null;
    this.gap = GAP;
    // Una coda svuotata lascia la riga a schermo ancora un attimo: sparire nel frame in cui
    // finisce l'ultima parola vorrebbe dire non averla letta.
    this.tail = this.queue.length ? 0 : 0.5;
    this.shown = 0;
  }

  get visible() {
    return !!this.line || this.tail > 0;
  }
}
