// L'impianto delle missioni: fasi, blip, ripresa.
//
// Questo file **non sa niente della campagna**, come `ui/cutscene.js` non sa niente
// di «12년»: riceve delle definizioni e le fa girare. Quello che sa la trama sta
// tutto sotto `src/story/`, ed è l'unico posto in cui deve stare (§3).
//
// Tre decisioni prese con l'utente (`docs/storia/08-domande-aperte.md`) sono
// cablate qui e non nelle missioni, perché valgono per tutte e dodici:
//
//   · **un blip solo**, sulla missione in corso — non un elenco di commissioni
//     sulla mappa. Il marcatore ha sempre lo stesso id, quindi `setMarker` lo
//     *sposta* invece di accumularne (§5.27);
//   · **il fallimento riparte dall'ultima fase**, non dalla missione. Morire o
//     farsi arrestare rientra nella fase corrente, con i suoi blip e i suoi punti
//     rimessi come li aveva trovati;
//   · **le cutscene non si rivedono mai due volte.** Chi riprende una fase non si
//     ribecca i pannelli, e chi ricarica nemmeno: `seen` sta nel salvataggio.
//
// **Una fase è una funzione che apparecchia, non un ciclo che controlla.** `enter`
// mette blip, punti e iscrizioni al bus; da lì in poi la fase dorme finché non
// succede il fatto che aspettava. `tick` esiste per le poche condizioni che un
// evento non sa dire (essere arrivati in un posto), e per quelle sole.
//
// **Tutto quello che una fase apparecchia viene smontato da solo.** `ctx.on` e
// `ctx.point` si disfano al cambio di fase: senza, una missione ripresa tre volte
// lascerebbe tre iscritti sullo stesso evento e il terzo pegno si raccoglierebbe
// da sé.
import { dist } from './math.js';

/** L'id del blip. Uno solo, ed è il punto: la decisione è «una missione per volta». */
export const MARKER = 'mission';

// Quanto vicino bisogna stare a un punto perché il suggerimento compaia. È largo
// come la porta di un negozio (`DOOR_REACH` in `shops.js`) per la stessa ragione:
// più stretto e si gira attorno all'obiettivo senza trovarlo.
const POINT_REACH = 58;

export class MissionSystem {
  constructor() {
    this.defs = new Map();
    /** La missione in corso, o `null`. Ce n'è **una**: il blip è uno. */
    this.active = null;
    this.phase = 0;
    /** Il taccuino della missione in corso: quello che le fasi si dicono fra loro. */
    this.state = {};
    this.done = new Set();       // missioni finite
    this.seen = new Set();       // sequenze di pannelli già viste
    this.flags = new Set();      // fatti della storia che sopravvivono alla missione
    this.subs = [];              // disiscrizioni della fase corrente
    this.points = [];            // punti interattivi della fase corrente
    this.actions = [];           // quelli a portata, ricostruiti ogni frame per l'HUD
    this.hint = null;            // la riga che l'HUD mostra sotto il titolo
  }

  register(def) {
    this.defs.set(def.id, def);
    return def;
  }

  /**
   * Le due sconfitte del gioco rientrano nella fase corrente. Ci si iscrive a
   * `respawn` e `busted` invece che a `playerDeath` perché quando arrivano il
   * giocatore è **già stato spostato**: rientrare prima vorrebbe dire apparecchiare
   * la fase attorno a un cadavere.
   */
  attach(game) {
    game.on('respawn', () => this.replay(game));
    game.on('busted', () => this.replay(game));
  }

  get def() {
    return this.active ? this.defs.get(this.active) : null;
  }

  get phaseDef() {
    return this.def?.phases[this.phase] || null;
  }

  isDone(id) { return this.done.has(id); }
  flag(name) { return this.flags.has(name); }
  setFlag(name, on = true) { if (on) this.flags.add(name); else this.flags.delete(name); }

  // --- ciclo di vita ------------------------------------------------------------

  start(id, game, phase = 0) {
    const def = this.defs.get(id);
    if (!def || this.active) return false;
    this.active = id;
    this.phase = phase;
    this.state = {};
    if (def.prepare) def.prepare(game);
    game.emit('missionStart', id);
    this.enterPhase(game);
    return true;
  }

  /**
   * Fase successiva. Non si chiama da `enter` (si apparecchierebbe una fase per
   * smontarla nello stesso frame): una fase finisce da un evento o da `tick`.
   */
  advance(game) {
    if (!this.active) return;
    this.leavePhase(game);
    this.phase++;
    if (this.phase >= this.def.phases.length) this.complete(game);
    else this.enterPhase(game);
  }

  /** Ripresa dall'ultima fase: si rientra dov'eri, non da capo. */
  replay(game) {
    if (!this.active) return;
    this.leavePhase(game);
    this.enterPhase(game);
  }

  complete(game) {
    const id = this.active;
    const def = this.def;
    this.leavePhase(game);
    this.active = null;
    this.phase = 0;
    this.state = {};
    this.done.add(id);
    game.clearMarker(MARKER);
    if (def?.finish) def.finish(game);
    game.emit('missionDone', id);
  }

  /** La missione si interrompe e non è finita: serve solo a `newGame` e ai test. */
  abandon(game) {
    if (!this.active) return;
    this.leavePhase(game);
    this.active = null;
    this.phase = 0;
    this.state = {};
    game.clearMarker(MARKER);
  }

  /**
   * L'evento si manda **prima** di apparecchiare, e non è un dettaglio: una fase
   * di soli pannelli già visti si chiude dentro il proprio `enter` (i pannelli non
   * si rivedono, quindi `onDone` è immediato), e la fase dopo entra annidata in
   * questa. Mandando l'evento dopo, quello della fase vecchia arriverebbe **in
   * coda** a quello della nuova — cioè nell'ordine sbagliato. Succede a ogni
   * caricamento che riprende su una chiusura già vista.
   */
  enterPhase(game) {
    const ph = this.phaseDef;
    if (!ph) return;
    this.hint = ph.hint || null;
    game.emit('missionPhase', this.active, ph.id);
    if (ph.enter) ph.enter(this.context(game));
  }

  leavePhase(game) {
    const ph = this.phaseDef;
    if (ph?.leave) ph.leave(this.context(game));
    for (const off of this.subs) off();
    this.subs.length = 0;
    this.points.length = 0;
    this.actions.length = 0;
    this.hint = null;
  }

  // --- il contesto passato alle fasi ---------------------------------------------

  /**
   * Quello che una fase può fare. Si ricostruisce a ogni chiamata ed è una manciata
   * di chiusure: costa niente, e in cambio una fase non tiene mai un riferimento a
   * questo oggetto più a lungo della chiamata in cui l'ha ricevuto — che è quello
   * che impedisce a una fase morta di spostare il blip di quella dopo.
   */
  context(game) {
    return {
      game,
      state: this.state,
      /** Iscrizione al bus che si disfa al cambio di fase. */
      on: (name, fn) => { this.subs.push(game.on(name, fn)); },
      /** Il blip. Uno, e si sposta. */
      mark: (x, y, opts = {}) => game.setMarker(MARKER, x, y, { color: '#ffd23f', ...opts }),
      unmark: () => game.clearMarker(MARKER),
      point: (p) => { this.points.push(p); return p; },
      drop: (id) => {
        const i = this.points.findIndex((p) => p.id === id);
        if (i >= 0) this.points.splice(i, 1);
      },
      toast: (text, seconds = 3.4) => game.hud.toast(text, seconds),
      /** La riga dell'HUD sotto il titolo della missione. */
      say: (text) => { this.hint = text; },
      /** Un dialogo in strada: mondo fermo, e si avanza a mano. */
      talk: (lines, onDone = null) => game.dialogue.play(game, lines, onDone),
      /** Pannelli. Se sono già stati visti non si rivedono, e si tira dritto. */
      panels: (id, seq, onDone = null) => {
        if (this.seen.has(id)) { if (onDone) onDone(game, true); return; }
        this.seen.add(id);
        game.cutscene.play(game, seq, id, onDone);
      },
      next: () => this.advance(game),
      flag: (name, on) => this.setFlag(name, on),
      has: (name) => this.flags.has(name),
    };
  }

  /**
   * Pannelli fuori da una missione, giocati **una volta sola in tutta la partita**.
   * Serve al filo del 병원, che non è una missione e non ha fasi: si accumula per
   * conto suo e ogni tanto ha una tavola da mostrare. `seen` è lo stesso elenco di
   * quello delle missioni, e sta nel salvataggio per la stessa ragione.
   */
  playOnce(game, id, seq, onDone = null) {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    game.cutscene.play(game, seq, id, onDone);
    return true;
  }

  // --- frame ---------------------------------------------------------------------

  update(dt, game) {
    this.actions.length = 0;
    if (!this.active) return;
    const ph = this.phaseDef;
    const ctx = this.context(game);
    if (ph?.tick) ph.tick(dt, ctx);
    // `tick` può aver chiuso la fase: i punti di quella vecchia non sono più suoi.
    if (this.phaseDef !== ph) return;
    this.collectActions(game);
  }

  /**
   * I punti a portata di mano. La lista finisce nell'HUD insieme a quella dei
   * negozi (`hud.drawHints`), e i tasti si leggono qui: `shops` non deve sapere
   * che esiste una campagna.
   */
  collectActions(game) {
    const pl = game.player;
    if (pl.dying) return;
    for (const p of this.points) {
      if (!this.pointHere(p, game)) continue;
      if (p.onFoot !== false && !pl.onFoot) continue;
      if (dist(pl.x, pl.y, p.x, p.y) > (p.reach || POINT_REACH)) continue;
      this.actions.push(p);
    }
    if (!this.actions.length) return;
    for (const a of this.actions) {
      if (!game.input.wasPressed(`Key${a.key || 'E'}`) || pl.enterCooldown > 0) continue;
      pl.enterCooldown = 0.35;
      a.run(this.context(game));
      break;
    }
  }

  /**
   * Un punto vale solo dove è stato messo. Le coordinate di una pianta sono piccole
   * (200-470) e in città cadono tutte nell'angolo nord-ovest della mappa: senza
   * questo controllo un punto d'interno si raccoglierebbe da un cortile di Hongdae
   * (è la trappola di §3, pagata da `wanted.add` e da `police.focus`).
   */
  pointHere(p, game) {
    if (p.shop === undefined) return !game.indoors;
    const it = game.shops.active;
    return !!it && it.shop.id === p.shop && it.cur === (p.level || 0);
  }

  // --- salvataggio -----------------------------------------------------------------

  /**
   * Nel salvataggio va **la posizione nella storia**, non la storia: la missione in
   * corso, a che fase è, il suo taccuino, e le tre liste che non devono ripetersi.
   * Sono poche centinaia di byte, e sono l'unica cosa che una partita ha davvero
   * cambiato di tutta la campagna.
   */
  snapshot() {
    return {
      active: this.active,
      phase: this.phase,
      state: this.state,
      done: [...this.done],
      seen: [...this.seen],
      flags: [...this.flags],
    };
  }

  /**
   * Il ripristino **rientra nella fase**, non la salta: `enterPhase` rimette blip e
   * punti, e i pannelli che quella fase avrebbe giocato sono già in `seen`. È lo
   * stesso percorso della ripresa dopo una morte, ed è voluto che sia lo stesso.
   */
  restore(data, game) {
    this.hardReset(game);
    const d = data || {};
    for (const id of d.done || []) this.done.add(id);
    for (const id of d.seen || []) this.seen.add(id);
    for (const f of d.flags || []) this.flags.add(f);
    if (!d.active || !this.defs.has(d.active)) return;
    this.active = d.active;
    this.phase = Math.min(d.phase || 0, this.defs.get(d.active).phases.length - 1);
    this.state = d.state || {};
    const def = this.def;
    if (def.prepare) def.prepare(game);
    this.enterPhase(game);
  }

  /** Partita nuova: nessuna missione, nessun pannello visto, nessun blip. */
  reset(game) {
    this.hardReset(game);
  }

  hardReset(game) {
    if (this.active) this.leavePhase(game);
    this.active = null;
    this.phase = 0;
    this.state = {};
    this.done.clear();
    this.seen.clear();
    this.flags.clear();
    this.subs.length = 0;
    this.points.length = 0;
    this.actions.length = 0;
    this.hint = null;
    game.clearMarker(MARKER);
  }
}

/**
 * Una fase che è solo dei pannelli. Ne servono tante — un'apertura e una chiusura
 * per missione — e scritte a mano sarebbero sei righe identiche ogni volta.
 *
 * Il `next()` sta nel `onDone` della cutscene e non subito dopo: chi avanzasse
 * qui smonterebbe la fase mentre i pannelli sono ancora a schermo, e con lei le
 * iscrizioni della fase successiva, che verrebbe apparecchiata due volte.
 */
export function panelPhase(id, seq, opts = {}) {
  return {
    id,
    hint: opts.hint || null,
    enter(ctx) {
      ctx.unmark();
      ctx.panels(id, typeof seq === 'function' ? seq(ctx) : seq, () => ctx.next());
    },
  };
}
