// 까치 — la stazione `91.45`.
//
// Il «codec» di Seoul Crashers, e l'unica voce del gioco che non sta nella
// stanza. Questo file **non sa niente di quello che Kkachi dice**: come
// `core/missions.js` non conosce nessuna missione, qui non c'è una battuta.
// Le righe stanno in `story/kkachi.js`, che è l'unico posto in cui devono stare.
//
// Le sei regole del copione (`docs/storia/07-radio-kkachi.md`) sono cablate qui,
// perché valgono per tutte le ventiquattro chiamate e per tutte le righe di
// servizio:
//
//   1. **esiste solo in macchina, sulla frequenza `91.45`.** A piedi, dentro un
//      negozio, in metro o in cella non parla, e non è un limite tecnico da
//      aggirare: è il personaggio (`canSpeak`);
//   2. **chi non accende la radio non sente mai una parola.** Nessun avviso,
//      nessun punto esclamativo: se la stazione non è sintonizzata, quello che
//      Kkachi avrebbe detto scade e nessuno lo dice;
//   5. **chiamata interrotta = chiamata persa.** Scendere dall'auto o cambiare
//      stazione la chiude e non la rimette in fila mai più — `done` si scrive
//      all'inizio, non alla fine, ed è l'unico modo di renderlo vero anche per
//      chi ricarica;
//   6. **la radio vera vince sempre.** Kkachi non si sovrappone e non abbassa
//      nessuno: aspetta che la manopola torni su `91.45`.
//
// **Una riga è una funzione che dice di sì, non un `if` sparso nel motore.** Il
// gioco emette già tutti i fatti che servono (`core/events.js`); una chiamata è
// un predicato che li legge, e la tabella si guarda a ogni mezzo secondo mentre
// si guida. Aggiungerne una è una riga in `story/kkachi.js` e nient'altro.
//
// **Il mondo non si ferma per una battuta.** Kkachi parla mentre guidi: niente
// modalità in `core/modes.js`, niente tasto per avanzare, le righe scorrono da
// sole a velocità di lettura. È la differenza fra una radio e una cutscene, ed è
// il motivo per cui questo sistema non assomiglia a `ui/dialogue.js`.

/** La frequenza. È anche il nome con cui la stazione compare nella manopola. */
export const FREQ = '91.45';

// Ogni quanto si guardano i predicati della tabella. Mezzo secondo: una
// chiamata che si innesca «quando entri sul ponte» non deve arrivare quando sei
// già dall'altra parte, e cento predicati due volte al secondo non si misurano.
const POLL = 0.5;
// Quanto resta a schermo una battuta: una base più il tempo di leggerla. Sono i
// numeri di `ui/text.js` guardati a occhio su una riga lunga — chi li ritocca lo
// faccia sulla battuta più lunga del copione, non sulla più corta.
const READ_BASE = 1.9;
const READ_PER_CHAR = 0.042;
const READ_MIN = 2.4;
const READ_MAX = 9;
// Il fruscio fra due battute. Senza, due righe di seguito sembrano un pannello.
const GAP = 0.45;
// La coda di fruscio dopo l'ultima battuta: è quello che fa sentire che la
// stazione resta accesa anche quando nessuno parla.
const TAIL = 1.1;
// Quanto vale una salita in macchina per le righe di servizio. Oltre questi
// secondi non è più «è appena salito», ed è meglio tacere.
const BOARD_WINDOW = 12;
// Quanto sta zitto fra due righe di servizio qualunque. Cento ripetizioni
// perdonano una battuta piatta e non perdonano una radio che non smette mai.
const SERVICE_REST = 75;
// Quanto vive una battuta diretta della storia se la radio è spenta. Scaduta,
// non la dice nessuno: è la regola 2, e vale anche per la trama.
const DIRECT_LIFE = 240;

/** Quanto dura a schermo una battuta. Un silenzio dichiara la sua durata. */
function lineTime(line) {
  if (!line) return 0;
  if (line.hold) return line.hold;
  const n = (line.text || '').length;
  return Math.min(READ_MAX, Math.max(READ_MIN, READ_BASE + n * READ_PER_CHAR));
}

/**
 * Un predicato non deve poter spegnere il gioco. Una riga scritta male fa
 * tacere sé stessa e si vede in console, come per gli iscritti del bus.
 */
function truthy(fn, game, k) {
  if (!fn) return true;
  try {
    return !!fn(game, k);
  } catch (err) {
    console.error('[kkachi] predicato in errore:', err);
    return false;
  }
}

function resolve(v, game, k) {
  return typeof v === 'function' ? v(game, k) : v;
}

export class KkachiSystem {
  constructor() {
    /** Le ventiquattro conversazioni. Ognuna va una volta sola in tutta la partita. */
    this.calls = [];
    /** Le righe di servizio: una battuta, e si ripetono. */
    this.service = [];
    /** Chiamate già andate — **ascoltate o perse**: la regola 5 non distingue. */
    this.done = new Set();
    /** Quante ne ha sentite per intero. Venti su ventiquattro sono il finale C. */
    this.heard = 0;
    /** Quante ne ha perse a metà. Compare nei titoli di coda e in nessun altro posto. */
    this.missed = 0;

    this.marks = new Map();   // fatti recenti del mondo: tag -> { t, v }
    this.call = null;         // la conversazione in corso
    this.line = null;         // la battuta a schermo, o `null` (fruscio)
    this.direct = [];         // battute della storia in attesa del momento
    this.shown = 0;           // da quanto è a schermo il riquadro: serve alla dissolvenza
    this.tail = 0;            // coda di fruscio dopo l'ultima battuta
    this.idleT = 0;           // da quanto sta fermo col motore acceso
    this.boardT = 0;          // da quanto Kkachi può parlare: è «da quanto è salito»
    this.serviceT = SERVICE_REST;
    this._poll = 0;
    this._last = null;        // l'ultima riga di servizio: non si dice due volte di fila
    this._cool = new Map();   // id di servizio -> quando è stato detto
  }

  // --- registrazione -----------------------------------------------------------

  register(rows) {
    for (const r of rows) this.calls.push(r);
  }

  registerService(rows) {
    for (const r of rows) this.service.push(r);
  }

  /**
   * Quello che il mondo ha appena fatto. Lo scrive `story/kkachi.js` dal bus, e i
   * predicati lo leggono con `since`: è il modo in cui «primo furto d'auto con
   * testimoni» resta un predicato invece di diventare un innesco a parte.
   */
  mark(tag, game, value = null) {
    this.marks.set(tag, { t: game.time, v: value });
  }

  /** Quanti secondi da quel fatto. `Infinity` se non è mai successo. */
  since(tag, game) {
    const m = this.marks.get(tag);
    return m ? game.time - m.t : Infinity;
  }

  value(tag) {
    return this.marks.get(tag)?.v ?? null;
  }

  // --- stato --------------------------------------------------------------------

  get talking() {
    return !!this.call;
  }

  /** Il riquadro è a schermo: c'è una battuta, oppure la coda di fruscio. */
  get visible() {
    return !!this.call || this.tail > 0;
  }

  get stats() {
    return {
      ascoltate: this.heard, perse: this.missed, andate: this.done.size,
      inCorso: this.call ? this.call.id || 'servizio' : null,
      riga: this.line ? this.line.text || '(silenzio)' : null,
      inCoda: this.direct.length,
    };
  }

  /**
   * Regola 1 e regola 6 in una funzione sola. **Se questa diventa falsa mentre
   * una chiamata è in corso, la chiamata è persa** (regola 5): è per questo che
   * qui dentro non c'è niente che dipenda da un menu aperto o dal mondo fermo —
   * quelle cose mettono in pausa, non interrompono.
   */
  canSpeak(game) {
    if (!game.started || game.indoors) return false;
    const pl = game.player;
    if (pl.dying || pl.onFoot || !pl.vehicle || pl.vehicle.dead) return false;
    return !!game.radio?.isKkachi;
  }

  /** Il riquadro scorre solo se il mondo scorre: un menu aperto lo mette in pausa. */
  canRun(game) {
    return game.mode.worldRuns && !game.dialogue?.active && !game.cutscene?.active;
  }

  // --- battute della storia -------------------------------------------------------

  /**
   * Una battuta scritta da una missione. Non conta per il finale nascosto — le
   * ventiquattro sono altre — e scade se la radio resta spenta: chi non l'accende
   * non sente niente, nemmeno la trama (regola 2).
   */
  say(game, lines, opts = {}) {
    this.direct.push({
      id: opts.id || null,
      lines: Array.isArray(lines) ? lines : [lines],
      counts: false,
      until: game.time + (opts.life ?? DIRECT_LIFE),
    });
  }

  // --- ciclo -----------------------------------------------------------------------

  update(dt, game) {
    const speak = this.canSpeak(game);
    // Sceso dall'auto o cambiata stazione: la conversazione non riparte.
    if (this.call && !speak) this.lose(game);
    if (!speak) {
      // «Appena salito» è il momento in cui Kkachi torna a poter parlare, e sono
      // due: la portiera e la manopola. Contarli separatamente vorrebbe dire due
      // iscrizioni al bus per sapere una cosa che questa riga sa già.
      this.boardT = 0;
      this.idleT = 0;
      this.tail = 0;
      this.shown = 0;
      return;
    }
    if (!this.canRun(game)) return;

    this.shown += dt;
    this.boardT += dt;
    this.serviceT += dt;
    if (this.tail > 0) this.tail = Math.max(0, this.tail - dt);
    const v = game.player.vehicle;
    // Fermo col motore acceso: è una delle righe di servizio, ed è l'unica che
    // ha bisogno di un cronometro invece che di un fatto.
    if (Math.abs(v.speed) < 8) this.idleT += dt;
    else this.idleT = 0;

    if (this.call) { this.step(dt, game); return; }

    this._poll -= dt;
    if (this._poll > 0) return;
    this._poll = POLL;
    if (this.pickDirect(game)) return;
    // Con le stelle addosso Kkachi tace: la caccia ha già la sua musica (§5.19),
    // e commentarla sarebbe l'unica cosa che il personaggio non fa mai. Una
    // conversazione già cominciata invece continua — non stava commentando niente.
    if (game.wanted?.level > 0) return;
    if (this.pickCall(game)) return;
    this.pickService(game);
  }

  /** Le battute della storia vengono prima di tutto, e scadono da sole. */
  pickDirect(game) {
    while (this.direct.length) {
      const d = this.direct.shift();
      if (d.until < game.time) continue;
      this.begin(d, game);
      return true;
    }
    return false;
  }

  pickCall(game) {
    for (const r of this.calls) {
      if (this.done.has(r.id)) continue;
      if (!truthy(r.when, game, this)) continue;
      this.begin({ id: r.id, lines: resolve(r.lines, game, this), counts: true }, game);
      return true;
    }
    return false;
  }

  /**
   * Una riga fra dodici, **scelta dalla prima condizione che è vera**. L'ordine
   * della tabella *è* la priorità, e la stessa non si dice mai due volte di fila:
   * sono righe che il giocatore sente cento volte, e la seconda identica alla
   * prima è quella che gli fa spegnere la radio.
   */
  pickService(game) {
    if (this.serviceT < SERVICE_REST) return false;
    let fallback = null;
    for (const r of this.service) {
      // Le dodici di salita valgono solo appena saliti; le altre (la cella, il
      // motore acceso da due minuti, la rete che non c'è) hanno la loro attesa.
      if (r.boarding && this.boardT > BOARD_WINDOW) continue;
      const cool = this._cool.get(r.id);
      if (cool !== undefined && game.time - cool < (r.rest ?? SERVICE_REST)) continue;
      if (!truthy(r.when, game, this)) continue;
      if (r.id === this._last) { fallback = fallback || r; continue; }
      return this.speakService(r, game);
    }
    return fallback ? this.speakService(fallback, game) : false;
  }

  speakService(row, game) {
    const text = resolve(row.line, game, this);
    if (!text) return false;
    this._last = row.id;
    this._cool.set(row.id, game.time);
    this.serviceT = 0;
    // La salita è stata spesa: senza questa riga, restare fermi dodici secondi
    // col motore acceso farebbe uscire una seconda riga di salita.
    this.boardT = BOARD_WINDOW + 1;
    this.begin({ id: null, lines: [{ kkachi: true, text }], counts: false }, game);
    return true;
  }

  begin(spec, game) {
    this.call = { id: spec.id, lines: spec.lines.filter(Boolean), i: 0, t: 0, gap: 0, counts: !!spec.counts };
    // **Si segna subito, non alla fine.** Una chiamata interrotta è una chiamata
    // persa (regola 5), e segnarla dopo vorrebbe dire rimetterla in fila al primo
    // semaforo — cioè il contrario di quello che il copione chiede.
    if (spec.id) this.done.add(spec.id);
    this.line = this.call.lines[0] || null;
    this.call.t = 0;
    this.call.dur = lineTime(this.line);
    this.shown = 0;
    this.tail = 0;
    game.audio?.squelch(true);
    game.emit('kkachiStart', spec.id);
  }

  step(dt, game) {
    const c = this.call;
    if (c.gap > 0) {
      c.gap -= dt;
      if (c.gap > 0) return;
      this.line = c.lines[c.i];
      c.dur = lineTime(this.line);
      c.t = 0;
      return;
    }
    c.t += dt;
    if (c.t < c.dur) return;
    c.i++;
    if (c.i >= c.lines.length) { this.end(game); return; }
    this.line = null;
    c.gap = GAP;
  }

  end(game) {
    const c = this.call;
    if (c.counts) this.heard++;
    this.call = null;
    this.line = null;
    this.tail = TAIL;
    game.audio?.squelch(false);
    game.emit('kkachiEnd', c.id, false);
  }

  lose(game) {
    const c = this.call;
    if (c.counts) this.missed++;
    this.call = null;
    this.line = null;
    this.tail = 0;
    this.shown = 0;
    game.emit('kkachiEnd', c.id, true);
  }

  // --- salvataggio -------------------------------------------------------------------

  /**
   * Nel salvataggio vanno **le chiamate andate e i due conti**, non i predicati:
   * quali fossero vere è roba di un istante, e i fatti recenti (`marks`) non
   * sopravvivono a un caricamento apposta — riprendere una partita non deve far
   * partire la battuta del furto d'auto di tre giorni fa.
   */
  snapshot() {
    return { done: [...this.done], heard: this.heard, missed: this.missed };
  }

  restore(data) {
    this.reset();
    const d = data || {};
    for (const id of d.done || []) this.done.add(id);
    this.heard = d.heard || 0;
    this.missed = d.missed || 0;
  }

  reset() {
    this.done.clear();
    this.marks.clear();
    this.direct.length = 0;
    this.heard = 0;
    this.missed = 0;
    this.call = null;
    this.line = null;
    this.shown = 0;
    this.tail = 0;
    this.idleT = 0;
    this.boardT = 0;
    this.serviceT = SERVICE_REST;
    this._poll = 0;
    this._last = null;
    this._cool.clear();
  }
}
