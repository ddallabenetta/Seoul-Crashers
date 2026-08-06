// Menu di pausa: voci a sinistra, mappa con la posizione del giocatore a destra.
import { roundPath } from './hud.js';
import { KMH } from '../core/math.js';
import { won } from '../entities/shops.js';
import { SLOTS, readSlot, writeSlot, clearSlot, describe, apply } from '../core/save.js';

const CONTROLS = [
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

// Azioni di uno slot di salvataggio. `Salva` vale sempre, le altre due solo su
// uno slot occupato: A/D scelgono la colonna, W/S la riga, Invio conferma.
const SLOT_ACTIONS = [
  { id: 'save', label: 'Salva' },
  { id: 'load', label: 'Carica' },
  { id: 'wipe', label: 'Cancella' },
];

// Righe del pannello audio: la chiave è il bus in `AudioSystem.mix`.
const MIXER = [
  ['master', 'Generale'],
  ['sfx', 'Effetti'],
  ['ambient', 'Ambiente'],
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
      { id: 'saves', label: 'Salvataggi', hint: 'Tre slot nel browser' },
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
    this.slotIndex = 0;
    this.slotAction = 0;
    // Sovrascrivere o cancellare vuole due Invio: uno slot con dentro un'ora di
    // partita non si perde per un tasto premuto per sbaglio.
    this.confirm = -1;
    this.slotBoxes = [];
    this.slotHover = null;
    // Gli slot si leggono all'apertura del pannello e dopo ogni azione, non a
    // ogni frame: `readSlot` fa un `JSON.parse` di qualche kB, e farlo tre volte
    // per sessanta frame al secondo per disegnare tre schede ferme è sprecato.
    this.slots = [];
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
    this.confirm = -1;
    return true;
  }

  update(dt, game) {
    if (!this.open) return;
    if (this.focus === 'audio') {
      this.updateMixer(game);
      return;
    }
    if (this.focus === 'saves') {
      this.updateSaves(game);
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

  /**
   * W/S scelgono lo slot, A/D l'azione, Invio conferma. Su uno slot occupato
   * `Salva` e `Cancella` chiedono un secondo Invio: un'ora di partita non si
   * butta via con un tasto premuto per sbaglio.
   */
  updateSaves(game) {
    const input = game.input;
    const audio = game.audio;
    const was = `${this.slotIndex}/${this.slotAction}`;
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) {
      this.slotIndex = (this.slotIndex - 1 + SLOTS) % SLOTS;
    }
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) {
      this.slotIndex = (this.slotIndex + 1) % SLOTS;
    }
    if (input.wasPressed('KeyD') || input.wasPressed('ArrowRight')) {
      this.slotAction = (this.slotAction + 1) % SLOT_ACTIONS.length;
    }
    if (input.wasPressed('KeyA') || input.wasPressed('ArrowLeft')) {
      this.slotAction = (this.slotAction - 1 + SLOT_ACTIONS.length) % SLOT_ACTIONS.length;
    }
    if (this.slotHover) {
      if (input.mouse.pressed) {
        this.slotIndex = this.slotHover.slot;
        this.slotAction = this.slotHover.action;
      }
    }
    if (`${this.slotIndex}/${this.slotAction}` !== was) {
      this.confirm = -1;
      audio?.ui('move');
    }
    const go = input.wasPressed('Space') || input.wasPressed('Enter')
      || (this.slotHover && input.mouse.pressed);
    if (go) this.runSlotAction(game);
  }

  refreshSlots() {
    this.slots = [];
    for (let i = 0; i < SLOTS; i++) this.slots.push(readSlot(i));
  }

  runSlotAction(game) {
    const i = this.slotIndex;
    const action = SLOT_ACTIONS[this.slotAction].id;
    const filled = !!this.slots[i];
    const audio = game.audio;
    if (action !== 'save' && !filled) {
      game.hud.toast(`Slot ${i + 1}: è vuoto`, 1.6);
      audio?.ui('deny');
      return;
    }
    // Conferma solo dove si perde qualcosa: salvare su uno slot vuoto no.
    if ((action === 'wipe' || (action === 'save' && filled)) && this.confirm !== this.slotAction) {
      this.confirm = this.slotAction;
      audio?.ui('move');
      return;
    }
    this.confirm = -1;
    if (action === 'save') {
      const ok = writeSlot(i, game);
      this.refreshSlots();
      game.hud.toast(ok ? `Partita salvata nello slot ${i + 1}` : 'Il browser non lascia salvare', 2.4);
      audio?.ui(ok ? 'ok' : 'deny');
      return;
    }
    if (action === 'wipe') {
      clearSlot(i);
      this.refreshSlots();
      game.hud.toast(`Slot ${i + 1} cancellato`, 2);
      audio?.ui('ok');
      return;
    }
    const data = this.slots[i];
    apply(game, data);
    this.open = false;
    this.focus = 'items';
    audio?.ui('ok');
    game.hud.toast(`Slot ${i + 1} caricato`, 2.6);
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
        this.confirm = -1;
        this.refreshSlots();
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
      saves: 'W/S per lo slot · A/D per l\'azione · Invio conferma · ESC per tornare',
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
    ctx.fillStyle = 'rgba(10,12,16,0.92)';
    roundPath(ctx, x, y, size, size, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,240,250,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f5fa';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText('Comandi', x + 28, y + 44);
    // Passo e corpo stretti: il pannello è quadrato e largo 0.44 dello schermo,
    // su una finestra alta e stretta undici righe da 30 px uscirebbero dal fondo.
    let ly = y + 80;
    for (const [key, desc] of CONTROLS) {
      ctx.fillStyle = 'rgba(56,214,255,0.92)';
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText(key, x + 24, ly);
      ctx.fillStyle = 'rgba(235,240,250,0.66)';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillText(desc, x + 150, ly);
      ly += 26;
    }
  }

  drawAudio(ctx, game, x, y, size) {
    ctx.fillStyle = 'rgba(10,12,16,0.92)';
    roundPath(ctx, x, y, size, size, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,240,250,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f5fa';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText('Audio', x + 28, y + 44);

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

  /**
   * Tre schede, una per slot. Ognuna dice dove eri, che ora era e con quanto in
   * tasca: senza quelle tre righe uno slot è una data, e fra due partite non si
   * riconosce quale sia quale.
   */
  drawSaves(ctx, game, x, y, size) {
    ctx.fillStyle = 'rgba(10,12,16,0.92)';
    roundPath(ctx, x, y, size, size, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,240,250,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f5fa';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText('Salvataggi', x + 28, y + 44);
    ctx.fillStyle = 'rgba(235,240,250,0.4)';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillText('Nel browser, non sul disco: svuotare i dati del sito li porta via.', x + 28, y + 64);

    const mx = game.input.mouse.x;
    const my = game.input.mouse.y;
    this.slotBoxes.length = 0;
    this.slotHover = null;
    const cardH = Math.min(126, (size - 130) / SLOTS);
    for (let i = 0; i < SLOTS; i++) {
      const cy = y + 84 + i * (cardH + 12);
      const cw = size - 56;
      const sel = this.focus === 'saves' && i === this.slotIndex;
      ctx.fillStyle = sel ? 'rgba(255,95,162,0.10)' : 'rgba(255,255,255,0.04)';
      roundPath(ctx, x + 28, cy, cw, cardH, 8);
      ctx.fill();
      if (sel) {
        ctx.fillStyle = '#ff5fa2';
        ctx.fillRect(x + 28, cy, 3, cardH);
      }

      const data = this.slots[i];
      ctx.fillStyle = sel ? '#ffffff' : 'rgba(235,240,250,0.6)';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText(`SLOT ${i + 1}`, x + 46, cy + 26);

      if (!data) {
        ctx.fillStyle = 'rgba(235,240,250,0.32)';
        ctx.font = '500 13px system-ui, sans-serif';
        ctx.fillText('vuoto', x + 46, cy + 50);
      } else {
        const d = describe(data, game);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(235,240,250,0.35)';
        ctx.font = '500 11px system-ui, sans-serif';
        ctx.fillText(d.at.toLocaleString('it-IT', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        }), x + 28 + cw - 18, cy + 26);
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(235,240,250,0.72)';
        ctx.font = '600 14px system-ui, "Apple SD Gothic Neo", sans-serif';
        ctx.fillText(d.place, x + 46, cy + 48);
        ctx.fillStyle = 'rgba(235,240,250,0.42)';
        ctx.font = '500 12px system-ui, sans-serif';
        ctx.fillText(d.clock, x + 46, cy + 66);
        ctx.fillStyle = '#ffd23f';
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.fillText(won(d.money), x + 46, cy + 86);
        if (d.stars) {
          ctx.fillStyle = '#ff5fa2';
          ctx.fillText('★'.repeat(d.stars), x + 150, cy + 86);
        }
      }

      // Pulsanti: sempre tutti e tre, ma spenti dove non hanno senso. Nasconderli
      // farebbe ballare la riga fra uno slot pieno e uno vuoto.
      let bx = x + 28 + cw - 16;
      for (let a = SLOT_ACTIONS.length - 1; a >= 0; a--) {
        const act = SLOT_ACTIONS[a];
        const on = act.id === 'save' || !!data;
        ctx.font = '700 12px system-ui, sans-serif';
        const bw = ctx.measureText(act.label.toUpperCase()).width + 24;
        const bh = 26;
        const bxx = bx - bw;
        const byy = cy + cardH - bh - 12;
        const hot = mx >= bxx && mx <= bxx + bw && my >= byy && my <= byy + bh;
        if (hot && on) this.slotHover = { slot: i, action: a };
        const active = sel && a === this.slotAction;
        const asking = active && this.confirm === a;
        ctx.fillStyle = asking ? 'rgba(255,95,162,0.85)'
          : active ? 'rgba(56,214,255,0.22)' : 'rgba(255,255,255,0.06)';
        roundPath(ctx, bxx, byy, bw, bh, 6);
        ctx.fill();
        if (active) {
          ctx.strokeStyle = asking ? '#ffffff' : 'rgba(56,214,255,0.8)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.fillStyle = !on ? 'rgba(235,240,250,0.22)' : asking ? '#0b0d11' : active ? '#ffffff' : 'rgba(235,240,250,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(act.label.toUpperCase(), bxx + bw / 2, byy + 17);
        ctx.textAlign = 'left';
        this.slotBoxes.push({ x: bxx, y: byy, w: bw, h: bh, slot: i, action: a });
        bx = bxx - 8;
      }
    }

    // La richiesta di conferma sta qui e non dentro il pulsante: cambiargli
    // l'etichetta gli cambierebbe la larghezza, e le tre file ballerebbero.
    if (this.confirm >= 0 && this.focus === 'saves') {
      ctx.fillStyle = '#ff5fa2';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillText(
        this.confirm === 0
          ? `Invio di nuovo per sovrascrivere lo slot ${this.slotIndex + 1}`
          : `Invio di nuovo per cancellare lo slot ${this.slotIndex + 1}`,
        x + 28, y + 84 + SLOTS * (cardH + 12) + 20
      );
    }
  }

  drawStats(ctx, game, x, y, size) {
    ctx.fillStyle = 'rgba(10,12,16,0.92)';
    roundPath(ctx, x, y, size, size, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,240,250,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f5fa';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText('Statistiche', x + 28, y + 44);
    const s = game.stats;
    const rows = [
      ['Tempo in strada', formatTime(game.time)],
      ['Distanza percorsa', `${(s.distance / 1000).toFixed(2)} km`],
      ['Velocità massima', `${Math.round(KMH(s.topSpeed))} km/h`],
      ['Veicoli rubati', String(s.stolen)],
      ['Incidenti', String(s.crashes)],
      ['Cadaveri lasciati', String(s.kills)],
      ['Volte all\'ospedale', String(s.deaths)],
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
