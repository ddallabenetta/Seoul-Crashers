// Il lettore di pannelli.
//
// Non sa niente di quale storia sta raccontando: riceve una sequenza (un array di
// `{ id, draw(P), hold?, music? }`) e la mostra. La cutscene iniziale è la prima
// che passa di qui, le dodici missioni useranno lo stesso oggetto.
//
// **Si salta sempre**, dal primo avvio: è una decisione presa con l'utente
// (`08-domande-aperte.md`, punto 2), e regge perché i tre indizi seminati
// nell'apertura tornano tutti più avanti. Un'apertura che non si può saltare è
// un'apertura che alla seconda partita si odia. Il tasto è `ESC` e **il
// suggerimento non sfuma**: una scorciatoia che si può usare sempre ma si vede
// per cinque secondi è una scorciatoia che, in pratica, non c'è.
//
// L'avanzamento è **sempre del giocatore**, tranne dove non c'è niente da leggere
// (`hold`): un pannello che scorre da solo mentre stai ancora leggendo la battuta
// è il modo più veloce di far saltare tutta la scena a chi l'avrebbe guardata.
import { panelRect, clipPanel, unclip, hexA, PAPER } from '../render/panelkit.js';
import { uiLayout, ellipsisText } from './layout.js';

const TRANS = 0.26;        // lo stacco fra due pannelli, in secondi
// Il salto è più lungo dello stacco normale, e apposta: si esce su un nero pieno
// invece che su un taglio secco, che è la differenza fra «ho saltato» e «si è rotto».
const SKIP_FADE = 0.6;

export class Cutscene {
  constructor() {
    this.active = false;
    this.seq = null;
    this.id = null;
    this.i = 0;
    this.t = 0;            // secondi dentro il pannello corrente
    this.trans = 0;        // >0 mentre si sta passando al prossimo
    this.transDur = TRANS;
    this.pending = -1;
    this.skipped = false;
    this.onDone = null;
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
    this.transDur = TRANS;
    this.pending = -1;
    this.skipped = false;
    this.onDone = onDone;
    game.emit('cutsceneStart', id);
  }

  get panel() {
    return this.seq ? this.seq[this.i] : null;
  }

  /**
   * Quanto deve stare alta la musica sotto questo pannello (`music.direct`). Sta
   * nel pannello e non qui perché è regia della scena, non del lettore: l'ultima
   * tavola dell'apertura è il titolo, e un titolo vuole il tema addosso.
   */
  get musicWeight() {
    return this.panel?.music ?? 1;
  }

  update(dt, game) {
    if (!this.active) return;
    this.t += dt;
    const input = game.input;

    if (this.trans > 0) {
      this.trans -= dt;
      if (this.trans <= this.transDur / 2 && this.pending >= 0) {
        this.i = this.pending;
        this.pending = -1;
        this.t = 0;
      }
      if (this.trans <= 0 && this.i >= this.seq.length) this.finish(game, this.skipped);
      return;
    }

    if (input.wasPressed('Escape')) { this.skip(game); return; }

    const panel = this.panel;
    const auto = panel?.hold && this.t >= panel.hold;
    const asked = input.wasPressed('Space') || input.wasPressed('Enter') || input.mouse.pressed;
    if (auto || asked) this.advance(game);
  }

  advance(game) {
    this.cut(this.i + 1, TRANS);
    // Il verso di pagina è il suono dei menu, che è già quello giusto: un rumore
    // di carta qui suonerebbe come un altro gioco.
    if (this.pending < this.seq.length) game.audio?.ui('move');
  }

  /** Il tasto di salto. Non chiede conferma: chiederla è metà del fastidio. */
  skip(game) {
    if (this.skipped) return;
    this.skipped = true;
    game.audio?.ui('close');
    this.cut(this.seq.length, SKIP_FADE);
  }

  /** Lo stacco: nero pieno a metà corsa, ed è lì che il pannello cambia. */
  cut(to, dur) {
    this.trans = dur;
    this.transDur = dur;
    this.pending = to;
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
    const L = uiLayout(w, h, game);
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

      // Quanto manca. Una riga sottile: dire «12 / 28» a chi sta leggendo una
      // scena gli fa contare i pannelli invece di guardarli.
      const prog = (this.i + 1) / this.seq.length;
      ctx.fillStyle = 'rgba(226,236,248,0.12)';
      const progressY = Math.min(h - (L.compact ? 30 : 24), r.y + r.h + 10);
      ctx.fillRect(r.x, progressY, r.w, 2);
      ctx.fillStyle = 'rgba(255,95,162,0.7)';
      ctx.fillRect(r.x, progressY, r.w * prog, 2);

      // Su touch il suggerimento e il pulsante Salta sono elementi DOM grandi:
      // ripeterli in piccolo sotto la tavola crea solo due istruzioni sovrapposte.
      if (!L.controls) {
        ctx.font = `${L.compact ? '500 10px' : '500 12px'} system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(226,236,248,0.4)';
        const promptY = Math.min(h - (L.compact ? 10 : 14), progressY + (L.compact ? 18 : 22));
        const promptW = Math.max(70, r.w * 0.58);
        ctx.fillText('Spazio o clic per continuare', r.x, promptY, promptW);
        ctx.textAlign = 'right';
        ctx.fillStyle = hexA(PAPER, 0.42);
        ctx.fillText(ellipsisText(ctx, 'ESC per saltare l\'introduzione', promptW), r.x + r.w, promptY, promptW);
        ctx.textAlign = 'left';
      }
    }

    if (this.trans > 0) {
      // Triangolare: nero pieno a metà stacco, che è dove il pannello cambia.
      const k = 1 - Math.abs(this.trans - this.transDur / 2) / (this.transDur / 2);
      ctx.fillStyle = `rgba(0,0,0,${k})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
}
