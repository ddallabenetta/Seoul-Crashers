// Il pannello dei volumi. Sta in un file suo per la stessa ragione delle schede
// dei salvataggi (`saveslots.js`): i posti da cui si regola l'audio sono due — il
// menu di pausa e il menu iniziale — e sono lo stesso pannello con gli stessi
// tasti. Prima esisteva solo in pausa, e chi apriva il gioco e lo trovava troppo
// alto doveva cominciare a giocare per abbassarlo.
import { roundPath } from './hud.js';

// Righe del pannello: la chiave è il bus in `AudioSystem.mix`.
const MIXER = [
  ['master', 'Generale'],
  ['sfx', 'Effetti'],
  ['ambient', 'Ambiente'],
  ['music', 'Musica'],
  ['ui', 'Interfaccia'],
  ['radio', 'Radio'],
];

export class Mixer {
  constructor() {
    this.index = 0;
    // Rettangoli delle barre a schermo, riscritti dal disegno: il trascinamento
    // col mouse ha bisogno di sapere dove sono finite.
    this.bars = [];
  }

  /** W/S scelgono la riga, A/D spostano il volume, Invio accende e spegne tutto. */
  update(game) {
    const input = game.input;
    const audio = game.audio;
    const was = this.index;
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) {
      this.index = (this.index - 1 + MIXER.length) % MIXER.length;
    }
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) {
      this.index = (this.index + 1) % MIXER.length;
    }
    if (this.index !== was) audio?.ui('move');
    const step = (input.wasPressed('KeyD') || input.wasPressed('ArrowRight') ? 1 : 0)
      - (input.wasPressed('KeyA') || input.wasPressed('ArrowLeft') ? 1 : 0);
    const bus = MIXER[this.index][0];
    if (step && audio) {
      audio.setVolume(bus, audio.mix[bus] + step * 0.1);
      // La radio non ha bisogno di un campione: o sta già suonando, o non c'è
      // niente da provare.
      if (bus !== 'radio') audio.preview(bus);
    }
    if (input.wasPressed('Space') || input.wasPressed('Enter')) {
      audio?.toggleMute();
      audio?.ui('ok');
    }
    // Trascinamento col mouse: la barra si prende dove la si clicca.
    if (input.mouse.down && audio) {
      const mx = input.mouse.x;
      const my = input.mouse.y;
      for (let i = 0; i < this.bars.length; i++) {
        const b = this.bars[i];
        if (mx < b.x - 6 || mx > b.x + b.w + 6 || my < b.y - 10 || my > b.y + b.h + 10) continue;
        this.index = i;
        audio.setVolume(MIXER[i][0], (mx - b.x) / b.w);
        if (input.mouse.pressed && MIXER[i][0] !== 'radio') audio.preview(MIXER[i][0]);
      }
    }
  }

  /** Le barre dentro un pannello già disegnato: la cornice la mette chi ospita. */
  draw(ctx, game, x, y, w, focused) {
    const audio = game.audio;
    const muted = audio ? audio.muted : true;
    ctx.textAlign = 'left';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = muted ? '#ff5fa2' : 'rgba(90,220,150,0.9)';
    ctx.fillText(muted ? 'MUTO' : 'ACCESO', x + w - 68, y - 48);

    this.bars.length = 0;
    MIXER.forEach(([bus, label], i) => {
      const ly = y + i * 58;
      const sel = i === this.index && focused;
      const v = audio ? audio.mix[bus] : 0;
      ctx.fillStyle = sel ? '#ffffff' : 'rgba(235,240,250,0.55)';
      ctx.font = `${sel ? '700' : '600'} 12px system-ui, sans-serif`;
      ctx.fillText(label.toUpperCase(), x, ly);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(235,240,250,0.45)';
      ctx.fillText(`${Math.round(v * 100)}%`, x + w, ly);
      ctx.textAlign = 'left';
      const by = ly + 10;
      this.bars.push({ x, y: by, w, h: 8 });
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundPath(ctx, x, by, w, 8, 4);
      ctx.fill();
      ctx.fillStyle = muted ? 'rgba(235,240,250,0.28)' : (sel ? '#ff5fa2' : 'rgba(56,214,255,0.8)');
      roundPath(ctx, x, by, Math.max(4, w * v), 8, 4);
      ctx.fill();
    });

    // Il browser non lascia partire l'audio finché non si tocca qualcosa: senza
    // dirlo, chi apre il menu per primo pensa che sia rotto.
    ctx.fillStyle = 'rgba(235,240,250,0.4)';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillText(!audio || !audio.ready
      ? 'Il browser accende l\'audio al primo clic o tasto premuto.'
      : 'Tutto sintetizzato, nessun file audio. La radio no: è in streaming (R in macchina).',
    x, y + MIXER.length * 58 + 12);
  }

  static get LEGEND() {
    return 'W/S per la riga · A/D per il volume · Invio per il muto · ESC per tornare';
  }
}
