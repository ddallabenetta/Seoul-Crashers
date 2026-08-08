// Il lettore di pannelli.
//
// Non sa niente di quale storia sta raccontando: riceve una sequenza (un array di
// `{ id, draw(P), hold? }`) e la mostra. La cutscene iniziale è la prima che passa
// di qui, le dodici missioni useranno lo stesso oggetto.
//
// **Si salta sempre**, dal primo avvio: è una decisione presa con l'utente
// (`08-domande-aperte.md`, punto 2), e regge perché i tre indizi seminati
// nell'apertura tornano tutti più avanti. Un'apertura che non si può saltare è
// un'apertura che alla seconda partita si odia.
//
// L'avanzamento è **sempre del giocatore**, tranne dove non c'è niente da leggere
// (`hold`): un pannello che scorre da solo mentre stai ancora leggendo la battuta
// è il modo più veloce di far saltare tutta la scena a chi l'avrebbe guardata.
import { panelRect, clipPanel, unclip, hexA, PAPER } from '../render/panelkit.js';

const TRANS = 0.26;        // lo stacco fra due pannelli, in secondi

export class Cutscene {
  constructor() {
    this.active = false;
    this.seq = null;
    this.id = null;
    this.i = 0;
    this.t = 0;            // secondi dentro il pannello corrente
    this.trans = 0;        // >0 mentre si sta passando al prossimo
    this.pending = -1;
    this.onDone = null;
    this.skipHintT = 0;
  }

  /**
   * `onDone` è quello che succede dopo. Non lo decide questo file: la cutscene
   * iniziale ci mette il passaggio di consegne, una missione ci metterà la fase
   * successiva.
   */
  play(game, seq, id, onDone = null) {
    this.active = true;
    this.seq = seq;
    this.id = id;
    this.i = 0;
    this.t = 0;
    this.trans = 0;
    this.pending = -1;
    this.onDone = onDone;
    this.skipHintT = 5;
    game.emit('cutsceneStart', id);
  }

  get panel() {
    return this.seq ? this.seq[this.i] : null;
  }

  update(dt, game) {
    if (!this.active) return;
    this.t += dt;
    this.skipHintT = Math.max(0, this.skipHintT - dt);
    const input = game.input;

    if (this.trans > 0) {
      this.trans -= dt;
      if (this.trans <= TRANS / 2 && this.pending >= 0) {
        this.i = this.pending;
        this.pending = -1;
        this.t = 0;
      }
      if (this.trans <= 0 && this.i >= this.seq.length) this.finish(game, false);
      return;
    }

    if (input.wasPressed('Escape')) { this.finish(game, true); return; }

    const panel = this.panel;
    const auto = panel?.hold && this.t >= panel.hold;
    const asked = input.wasPressed('Space') || input.wasPressed('Enter') || input.mouse.pressed;
    if (auto || asked) this.advance(game);
  }

  advance(game) {
    this.trans = TRANS;
    this.pending = this.i + 1;
    // Il verso di pagina è il suono dei menu, che è già quello giusto: un rumore
    // di carta qui suonerebbe come un altro gioco.
    if (this.pending < this.seq.length) game.audio?.ui('move');
  }

  /** `skipped` cambia solo cosa si racconta dopo, non cosa succede al mondo. */
  finish(game, skipped) {
    if (!this.active) return;
    this.active = false;
    const id = this.id;
    const done = this.onDone;
    this.seq = null;
    this.onDone = null;
    game.emit('cutsceneEnd', id, skipped);
    if (done) done(game, skipped);
  }

  draw(ctx, game) {
    if (!this.active) return;
    const w = game.camera.viewW;
    const h = game.camera.viewH;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const r = panelRect(w, h);
    const P = { ctx, x: r.x, y: r.y, w: r.w, h: r.h, t: this.t };
    const panel = this.panel;
    if (panel) {
      clipPanel(P);
      panel.draw(P);
      unclip(P);
      // La cornice: un filo chiaro attorno alla tavola, come una stampa.
      ctx.strokeStyle = 'rgba(226,236,248,0.14)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }

    // Quanto manca. Una riga sottile: dire «12 / 28» a chi sta leggendo una scena
    // gli fa contare i pannelli invece di guardarli.
    const prog = (this.i + 1) / this.seq.length;
    ctx.fillStyle = 'rgba(226,236,248,0.12)';
    ctx.fillRect(r.x, r.y + r.h + 10, r.w, 2);
    ctx.fillStyle = 'rgba(255,95,162,0.7)';
    ctx.fillRect(r.x, r.y + r.h + 10, r.w * prog, 2);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(226,236,248,0.4)';
    ctx.fillText('Spazio o clic per continuare', r.x, r.y + r.h + 32);
    // Il suggerimento del salto si spegne dopo qualche secondo, ma ESC funziona
    // per sempre: si nasconde la scritta, non la scorciatoia.
    if (this.skipHintT > 0) {
      ctx.globalAlpha = Math.min(1, this.skipHintT / 1.2);
      ctx.textAlign = 'right';
      ctx.fillStyle = hexA(PAPER, 0.5);
      ctx.fillText('ESC per saltare', r.x + r.w, r.y + r.h + 32);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    if (this.trans > 0) {
      // Triangolare: nero pieno a metà stacco, che è dove il pannello cambia.
      const k = 1 - Math.abs(this.trans - TRANS / 2) / (TRANS / 2);
      ctx.fillStyle = `rgba(0,0,0,${k})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
}
