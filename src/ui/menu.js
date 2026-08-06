// Menu di pausa: voci a sinistra, mappa con la posizione del giocatore a destra.
import { roundPath } from './hud.js';
import { KMH } from '../core/math.js';
import { SaveSlots } from './saveslots.js';

// Esportata perché la usa anche il menu iniziale (§5.18): i comandi sono uno solo,
// e una seconda copia sarebbe una copia che invecchia.
export const CONTROLS = [
  ['W A S D / Frecce', 'muoviti · guida'],
  ['Shift', 'corri (a piedi)'],
  ['Spazio', 'freno a mano'],
  ['E', 'sali / scendi · entra nei negozi · scale'],
  ['F', 'svuota la cassa di un negozio'],
  ['H', 'clacson'],
  ['Mouse', 'mira dove punti'],
  ['Click sin.', 'spara · colpisci · lancia · drive-by'],
  ['Click des.', 'mirino (fucile di precisione)'],
  ['1-6 / rotella', 'barra armi (ripremi = scorri la fila)'],
  ['M', 'mappa a tutto schermo'],
  ['ESC', 'pausa'],
  ['F3', 'informazioni tecniche'],
  ['F4', 'audio muto'],
  ['R', 'radio: accendi · stazione dopo'],
  ['Shift + R', 'radio: spegni'],
];

// Righe del pannello audio: la chiave è il bus in `AudioSystem.mix`.
const MIXER = [
  ['master', 'Generale'],
  ['sfx', 'Effetti'],
  ['ambient', 'Ambiente'],
  ['music', 'Musica'],
  ['ui', 'Interfaccia'],
  ['radio', 'Radio'],
];

export class PauseMenu {
  constructor(mapView) {
    this.mapView = mapView;
    this.open = false;
    this.index = 0;
    this.tab = 'map';
    this.items = [
      { id: 'resume', label: 'Riprendi', hint: 'Torna in strada' },
      { id: 'map', label: 'Mappa', hint: 'Vista completa di Seoul' },
      { id: 'saves', label: 'Salvataggi', hint: 'Tre slot più l\'autosave' },
      { id: 'audio', label: 'Audio', hint: 'Volumi · F4 per il muto' },
      { id: 'controls', label: 'Comandi', hint: 'Tastiera e mouse' },
      { id: 'stats', label: 'Statistiche', hint: 'La tua corsa finora' },
    ];
    this.hover = -1;
    // Audio e salvataggi sono i due pannelli che si *usano* invece di leggersi:
    // quando sono attivi i tasti di navigazione passano a loro, e ESC torna alle
    // voci invece di chiudere il menu.
    this.focus = 'items';
    this.mixIndex = 0;
    this.bars = [];
    this.saves = new SaveSlots({ canSave: true });
  }

  toggle() {
    this.open = !this.open;
    this.index = 0;
    this.tab = 'map';
    this.focus = 'items';
  }

  /** ESC dentro un pannello che si usa torna alle voci invece di chiudere il menu. */
  backOut() {
    if (!this.open || this.focus === 'items') return false;
    this.focus = 'items';
    this.saves.confirm = -1;
    return true;
  }

  update(dt, game) {
    if (!this.open) return;
    if (this.focus === 'audio') {
      this.updateMixer(game);
      return;
    }
    if (this.focus === 'saves') {
      // Caricare una partita chiude il menu: restare aperti sopra una Seoul che
      // non è più quella di prima non ha nessun senso.
      if (this.saves.update(game) === 'loaded') {
        this.open = false;
        this.focus = 'items';
      }
      return;
    }
    const input = game.input;
    const was = this.index;
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) {
      this.index = (this.index - 1 + this.items.length) % this.items.length;
    }
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) {
      this.index = (this.index + 1) % this.items.length;
    }
    if (this.hover >= 0 && input.mouse.pressed) this.index = this.hover;
    if (this.index !== was) game.audio?.ui('move');
    if (input.wasPressed('Space') || input.wasPressed('Enter') || (this.hover >= 0 && input.mouse.pressed)) {
      this.activate(game);
    }
  }

  /** W/S scelgono la riga, A/D spostano il volume, Invio accende e spegne tutto. */
  updateMixer(game) {
    const input = game.input;
    const audio = game.audio;
    const was = this.mixIndex;
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) {
      this.mixIndex = (this.mixIndex - 1 + MIXER.length) % MIXER.length;
    }
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) {
      this.mixIndex = (this.mixIndex + 1) % MIXER.length;
    }
    if (this.mixIndex !== was) audio?.ui('move');
    const step = (input.wasPressed('KeyD') || input.wasPressed('ArrowRight') ? 1 : 0)
      - (input.wasPressed('KeyA') || input.wasPressed('ArrowLeft') ? 1 : 0);
    const bus = MIXER[this.mixIndex][0];
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
        this.mixIndex = i;
        audio.setVolume(MIXER[i][0], (mx - b.x) / b.w);
        if (input.mouse.pressed && MIXER[i][0] !== 'radio') audio.preview(MIXER[i][0]);
      }
    }
  }

  activate(game) {
    const item = this.items[this.index];
    game.audio?.ui(item.id === 'resume' ? 'close' : 'ok');
    switch (item.id) {
      case 'resume':
        this.open = false;
        break;
      case 'map':
        this.open = false;
        this.mapView.open = true;
        break;
      case 'saves':
        this.tab = 'saves';
        this.focus = 'saves';
        this.saves.confirm = -1;
        this.saves.refresh();
        break;
      case 'audio':
        this.tab = 'audio';
        this.focus = 'audio';
        break;
      case 'controls':
        this.tab = 'controls';
        break;
      case 'stats':
        this.tab = 'stats';
        break;
    }
  }

  draw(ctx, game) {
    if (!this.open) return;
    const w = game.camera.viewW;
    const h = game.camera.viewH;
    ctx.save();
    ctx.fillStyle = 'rgba(6,7,9,0.88)';
    ctx.fillRect(0, 0, w, h);

    // Titolo
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f5fa';
    ctx.font = '900 42px system-ui, sans-serif';
    ctx.fillText('SEOUL', 64, 92);
    ctx.fillStyle = '#ff5fa2';
    ctx.fillText('CRASHERS', 64, 134);
    ctx.fillStyle = 'rgba(235,240,250,0.4)';
    ctx.font = '600 13px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('서울 크래셔스  ·  PAUSA', 64, 158);

    // Voci
    const mx = game.input.mouse.x;
    const my = game.input.mouse.y;
    this.hover = -1;
    let y = 216;
    this.items.forEach((item, i) => {
      const boxX = 56, boxY = y - 26, boxW = 276, boxH = 44;
      const inside = mx >= boxX && mx <= boxX + boxW && my >= boxY && my <= boxY + boxH;
      if (inside) this.hover = i;
      const active = i === this.index;
      if (active) {
        ctx.fillStyle = 'rgba(255,95,162,0.14)';
        roundPath(ctx, boxX, boxY, boxW, boxH, 8);
        ctx.fill();
        ctx.fillStyle = '#ff5fa2';
        ctx.fillRect(boxX, boxY, 3, boxH);
      }
      ctx.fillStyle = active ? '#ffffff' : 'rgba(235,240,250,0.62)';
      ctx.font = `${active ? '700' : '600'} 20px system-ui, sans-serif`;
      ctx.fillText(item.label, boxX + 20, y);
      y += 54;
    });

    // Descrizione della voce selezionata, su una riga sua: dentro il box si
    // sovrapponeva all'etichetta.
    ctx.fillStyle = 'rgba(235,240,250,0.45)';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText(this.items[this.index].hint, 76, y + 6);

    ctx.fillStyle = 'rgba(235,240,250,0.32)';
    ctx.font = '500 12px system-ui, sans-serif';
    const legend = {
      audio: 'W/S per la riga · A/D per il volume · Invio per il muto · ESC per tornare',
      saves: 'W/S per lo slot · A/D per l\'azione · Invio conferma · F autosave · ESC per tornare',
      items: 'W/S per navigare · Invio per confermare · ESC per riprendere',
    };
    ctx.fillText(legend[this.focus] || legend.items, 60, h - 42);

    // Pannello di destra
    const size = Math.min(h - 140, w * 0.44);
    const px = w - size - 64;
    const py = (h - size) / 2;
    if (this.tab === 'controls') this.drawControls(ctx, px, py, size);
    else if (this.tab === 'stats') this.drawStats(ctx, game, px, py, size);
    else if (this.tab === 'audio') this.drawAudio(ctx, game, px, py, size);
    else if (this.tab === 'saves') this.drawSaves(ctx, game, px, py, size);
    else this.mapView.drawPanel(ctx, game, px, py, size, { zoom: 1 });

    ctx.restore();
  }

  drawControls(ctx, x, y, size) {
    panelCard(ctx, x, y, size, size, 'Comandi');
    drawControlsList(ctx, x + 24, y + 80);
  }

  drawAudio(ctx, game, x, y, size) {
    panelCard(ctx, x, y, size, size, 'Audio');
    const audio = game.audio;
    const muted = audio ? audio.muted : true;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = muted ? '#ff5fa2' : 'rgba(90,220,150,0.9)';
    ctx.fillText(muted ? 'MUTO' : 'ACCESO', x + size - 96, y + 44);

    this.bars.length = 0;
    const bw = size - 90;
    MIXER.forEach(([bus, label], i) => {
      const ly = y + 92 + i * 58;
      const sel = i === this.mixIndex && this.focus === 'audio';
      const v = audio ? audio.mix[bus] : 0;
      ctx.fillStyle = sel ? '#ffffff' : 'rgba(235,240,250,0.55)';
      ctx.font = `${sel ? '700' : '600'} 12px system-ui, sans-serif`;
      ctx.fillText(label.toUpperCase(), x + 28, ly);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(235,240,250,0.45)';
      ctx.fillText(`${Math.round(v * 100)}%`, x + 28 + bw, ly);
      ctx.textAlign = 'left';
      const by = ly + 10;
      this.bars.push({ x: x + 28, y: by, w: bw, h: 8 });
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundPath(ctx, x + 28, by, bw, 8, 4);
      ctx.fill();
      ctx.fillStyle = muted ? 'rgba(235,240,250,0.28)' : (sel ? '#ff5fa2' : 'rgba(56,214,255,0.8)');
      roundPath(ctx, x + 28, by, Math.max(4, bw * v), 8, 4);
      ctx.fill();
    });

    // Il browser non lascia partire l'audio finché non si tocca qualcosa: senza
    // dirlo, un giocatore che apre il menu per primo pensa che sia rotto.
    ctx.fillStyle = 'rgba(235,240,250,0.4)';
    ctx.font = '500 12px system-ui, sans-serif';
    const info = !audio || !audio.ready
      ? 'Il browser accende l\'audio al primo clic o tasto premuto.'
      : 'Tutto sintetizzato, nessun file audio. La radio no: è in streaming (R in macchina).';
    ctx.fillText(info, x + 28, y + 92 + MIXER.length * 58 + 12);
  }

  /** Quattro schede: i tre slot manuali e quello dell'autosave. */
  drawSaves(ctx, game, x, y, size) {
    panelCard(ctx, x, y, size, size, 'Salvataggi');
    ctx.fillStyle = 'rgba(235,240,250,0.4)';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillText('Nel browser, non sul disco: svuotare i dati del sito li porta via.', x + 28, y + 64);
    this.saves.draw(ctx, game, x + 28, y + 84, size - 56, size - 110, this.focus === 'saves');
  }

  drawStats(ctx, game, x, y, size) {
    panelCard(ctx, x, y, size, size, 'Statistiche');
    const s = game.stats;
    const rows = [
      ['Tempo in strada', formatTime(game.time)],
      ['Distanza percorsa', `${(s.distance / 1000).toFixed(2)} km`],
      ['Velocità massima', `${Math.round(KMH(s.topSpeed))} km/h`],
      ['Veicoli rubati', String(s.stolen)],
      ['Incidenti', String(s.crashes)],
      ['Cadaveri lasciati', String(s.kills)],
      ['Volte all\'ospedale', String(s.deaths)],
      ['Volte in cella', String(s.busted || 0)],
      ['Quartieri visitati', `${s.districts.size} / 5`],
      ['Divise stese', String(s.copsKilled || 0)],
      ['Ricercato massimo', '★'.repeat(s.maxWanted || 0) || '—'],
      ['Esplosioni', String(s.blasts || 0)],
      ['Contanti', `₩${game.player.money.toLocaleString('it-IT')}`],
      ['Locali visitati', String(s.visits || 0)],
      ['Casse svuotate', String(s.robberies || 0)],
    ];
    // Due colonne: in una sola il pannello (quadrato, largo quanto 0.44 dello
    // schermo) non ci sta già a sei voci.
    const perCol = Math.ceil(rows.length / 2);
    rows.forEach(([label, value], i) => {
      const cx = x + 28 + (i < perCol ? 0 : (size - 44) / 2);
      const ly = y + 90 + (i % perCol) * 52;
      ctx.fillStyle = 'rgba(235,240,250,0.45)';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText(label.toUpperCase(), cx, ly);
      ctx.fillStyle = '#ffd23f';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillText(value, cx, ly + 22);
    });
  }
}

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** La cornice dei pannelli di destra: quattro schede, la stessa scatola. */
export function panelCard(ctx, x, y, w, h, title) {
  ctx.fillStyle = 'rgba(10,12,16,0.92)';
  roundPath(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235,240,250,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2f5fa';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText(title, x + 28, y + 44);
}

/**
 * L'elenco dei comandi. Passo e corpo stretti: il pannello è quadrato e largo
 * 0.44 dello schermo, su una finestra alta e stretta sedici righe da 30 px
 * uscirebbero dal fondo.
 */
export function drawControlsList(ctx, x, y) {
  let ly = y;
  for (const [key, desc] of CONTROLS) {
    ctx.fillStyle = 'rgba(56,214,255,0.92)';
    ctx.font = '600 12px ui-monospace, monospace';
    ctx.fillText(key, x, ly);
    ctx.fillStyle = 'rgba(235,240,250,0.66)';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillText(desc, x + 126, ly);
    ly += 26;
  }
}
