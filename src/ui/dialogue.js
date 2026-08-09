// Due che parlano, senza uscire dal gioco.
//
// I pannelli (`ui/cutscene.js`) coprono lo schermo e costano una tavola disegnata
// a mano: giustissimo per un'apertura, sbagliato per le tre battute del padrone
// del 술집. Metà del copione delle missioni sono scambi di due righe **nel posto
// in cui succedono** — e quel posto va lasciato a schermo, o si perde la sola
// cosa che li rende diversi da una cutscene.
//
// È la modalità che `core/modes.js` aveva previsto e che nessuno aveva ancora
// scritta: mondo fermo come in un menu, giocatore fermo come in un menu, e
// qualcosa che anima lo stesso. La città resta disegnata sotto, il riquadro ci
// sta sopra.
//
// **Una riga per volta, e si avanza a mano.** Come i pannelli: un testo che scorre
// da solo mentre stai ancora leggendo è il modo più veloce di far premere ESC.
// Qui però non c'è nessun ESC — un dialogo di due battute non si salta, si legge.
import { drawParagraph, measureParagraph } from './text.js';

const BOX_W = 720;       // larghezza massima del riquadro
const PAD = 18;
const LINE = 22;

export class Dialogue {
  constructor() {
    this.active = false;
    this.lines = null;
    this.i = 0;
    this.t = 0;
    this.onDone = null;
  }

  /**
   * `lines` è un array di `{ who, hangul, text, note, kkachi }`.
   *
   *   · `who` il nome davanti alla battuta; assente per il narratore;
   *   · `kkachi` la riga della radio, che non porta un nome ma la frequenza
   *     (regola 5 del copione: `docs/storia/README.md`);
   *   · `note` la *(nota)* che dice al giocatore **dove guardare** senza dirgli
   *     cosa significhi. Va sotto, in corsivo, e non è di nessuno.
   */
  play(game, lines, onDone = null) {
    this.active = true;
    this.lines = lines.filter(Boolean);
    this.i = 0;
    this.t = 0;
    this.onDone = onDone;
    game.emit('dialogueStart');
  }

  get line() {
    return this.lines ? this.lines[this.i] : null;
  }

  update(dt, game) {
    if (!this.active) return;
    this.t += dt;
    // Mezzo secondo di guardia: senza, il tasto con cui si è aperto il dialogo
    // (la `E` del punto di missione) ne salta subito la prima battuta.
    if (this.t < 0.25) return;
    const input = game.input;
    if (!(input.wasPressed('Space') || input.wasPressed('Enter') || input.mouse.pressed)) return;
    this.i++;
    this.t = 0;
    game.audio?.ui('move');
    if (this.i < this.lines.length) return;
    this.finish(game);
  }

  finish(game) {
    if (!this.active) return;
    this.active = false;
    const done = this.onDone;
    this.lines = null;
    this.onDone = null;
    game.emit('dialogueEnd');
    if (done) done(game);
  }

  draw(ctx, game) {
    if (!this.active) return;
    const line = this.line;
    if (!line) return;
    const w = game.camera.viewW;
    const h = game.camera.viewH;
    const bw = Math.min(BOX_W, w - 64);
    const x = (w - bw) / 2;
    const inner = bw - PAD * 2;

    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // Un velo leggero su tutto: dice che il mondo è fermo senza nasconderlo.
    ctx.fillStyle = 'rgba(6,8,12,0.34)';
    ctx.fillRect(0, 0, w, h);

    ctx.font = '600 16px system-ui, "Apple SD Gothic Neo", sans-serif';
    const bodyH = measureParagraph(ctx, line.text, inner, LINE);
    ctx.font = 'italic 500 13px system-ui, sans-serif';
    const noteH = line.note ? measureParagraph(ctx, line.note, inner, 18) + 10 : 0;
    const nameH = line.who || line.kkachi ? 24 : 0;
    const bh = PAD * 2 + nameH + bodyH + noteH + 16;
    const y = h - bh - 96;

    ctx.fillStyle = 'rgba(10,12,17,0.92)';
    box(ctx, x, y, bw, bh, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,236,248,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    let ty = y + PAD + 14;
    if (nameH) {
      ctx.font = '700 13px system-ui, "Apple SD Gothic Neo", sans-serif';
      // La radio non ha un nome: ha una frequenza, ed è di un altro colore perché
      // è l'unica voce del gioco che non sta nella stanza.
      ctx.fillStyle = line.kkachi ? '#38d6ff' : '#ffb163';
      ctx.fillText(line.kkachi ? '91.45' : `${line.who}${line.hangul ? ` · ${line.hangul}` : ''}`, x + PAD, ty);
      ty += 22;
    }
    ctx.font = '600 16px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillStyle = line.who || line.kkachi ? '#eef2f8' : '#c3ccda';
    ty += drawParagraph(ctx, line.text, x + PAD, ty, inner, { lineHeight: LINE });

    if (line.note) {
      ty += 8;
      ctx.font = 'italic 500 13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(226,236,248,0.5)';
      drawParagraph(ctx, line.note, x + PAD, ty, inner, { lineHeight: 18 });
    }

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(226,236,248,0.42)';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.i + 1} / ${this.lines.length}  ·  Spazio`, x + bw - PAD, y + bh - 12);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

function box(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
