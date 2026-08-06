// Menu iniziale. Prima il gioco partiva in strada e un salvataggio esistente si
// annunciava con un toast: chi tornava il giorno dopo doveva sapere che «ESC →
// Salvataggi» era il posto in cui riprendere. Adesso la prima cosa che si vede è
// una porta d'ingresso, e «Continua» è la prima voce.
//
// **La città sotto è viva, non è uno sfondo.** Il gioco è già acceso — traffico,
// pedoni, luci — e la camera gira piano attorno al punto di partenza. Costa
// quanto un frame di gioco (che sarebbe stato disegnato comunque) e vale molto
// più di un'immagine ferma: la prima impressione è una Seoul che si muove.
// L'unica cosa che non risponde è il giocatore, e sta lì fermo in mezzo alla
// strada finché non si preme Invio.
import { roundPath } from './hud.js';
import { panelCard, drawControlsList } from './menu.js';
import { SaveSlots } from './saveslots.js';
import { latestSlot, readSlot, describe, apply } from '../core/save.js';

export class StartMenu {
  constructor() {
    this.open = true;
    this.index = 0;
    this.tab = null;          // null | 'load' | 'controls'
    this.focus = 'items';
    this.hover = -1;
    this.items = [];
    this.saves = new SaveSlots({ canSave: false });
    this.latest = null;
    this.refresh();
  }

  /**
   * L'elenco delle voci dipende da cosa c'è nel browser: «Continua» esiste solo
   * se c'è qualcosa da continuare. Una voce spenta in cima a un menu di quattro
   * righe è peggio di una voce che non c'è.
   */
  refresh() {
    this.saves.refresh();
    const i = latestSlot();
    this.latest = i >= 0 ? { slot: i, data: readSlot(i) } : null;
    this.items = [];
    if (this.latest) this.items.push({ id: 'continue', label: 'Continua' });
    this.items.push({ id: 'new', label: 'Nuova partita' });
    this.items.push({ id: 'load', label: 'Carica partita' });
    this.items.push({ id: 'controls', label: 'Comandi' });
    this.index = 0;
  }

  hint(game, item) {
    if (item.id === 'continue' && this.latest) {
      const d = describe(this.latest.data, game);
      return `${d.place} · ${d.clock}`;
    }
    if (item.id === 'new') return 'Seoul, un funerale e nessun piano';
    if (item.id === 'load') return 'Tre slot più il salvataggio automatico';
    return 'Tastiera e mouse';
  }

  update(dt, game) {
    const input = game.input;
    if (input.wasPressed('Escape') && this.focus !== 'items') {
      this.focus = 'items';
      this.tab = null;
      game.audio?.ui('close');
      return;
    }
    if (this.focus === 'load') {
      if (this.saves.update(game) === 'loaded') game.start(true);
      return;
    }
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

  activate(game) {
    const item = this.items[this.index];
    game.audio?.ui(item.id === 'controls' || item.id === 'load' ? 'ok' : 'close');
    switch (item.id) {
      case 'continue':
        apply(game, this.latest.data);
        game.start(true);
        break;
      case 'new':
        game.start(false);
        break;
      case 'load':
        this.tab = 'load';
        this.focus = 'load';
        this.saves.refresh();
        this.saves.confirm = -1;
        break;
      case 'controls':
        this.tab = 'controls';
        break;
    }
  }

  draw(ctx, game) {
    const w = game.camera.viewW;
    const h = game.camera.viewH;
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // Velo a sinistra e quasi niente a destra: il testo deve leggersi, la città
    // deve vedersi. Un rettangolo pieno le toglierebbe tutte e due le cose.
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(6,7,9,0.94)');
    grad.addColorStop(0.5, 'rgba(6,7,9,0.7)');
    grad.addColorStop(1, 'rgba(6,7,9,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Bande cinematografiche: dicono «questo non è ancora il gioco» senza scriverlo.
    const bar = Math.round(h * 0.05);
    ctx.fillStyle = '#050608';
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f5fa';
    ctx.font = '900 58px system-ui, sans-serif';
    ctx.fillText('SEOUL', 64, bar + 100);
    ctx.fillStyle = '#ff5fa2';
    ctx.fillText('CRASHERS', 64, bar + 158);
    ctx.fillStyle = 'rgba(56,214,255,0.85)';
    ctx.font = '700 15px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('서울  크래셔스', 66, bar + 186);
    ctx.fillStyle = 'rgba(235,240,250,0.42)';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText('Dodici anni fuori. Un funerale. Una città che ha già venduto il nome di tuo padre.', 66, bar + 212);

    const mx = game.input.mouse.x;
    const my = game.input.mouse.y;
    this.hover = -1;
    let y = bar + 274;
    this.items.forEach((item, i) => {
      const boxX = 56, boxY = y - 26, boxW = 300, boxH = 44;
      const inside = this.focus === 'items'
        && mx >= boxX && mx <= boxX + boxW && my >= boxY && my <= boxY + boxH;
      if (inside) this.hover = i;
      const active = this.focus === 'items' && i === this.index;
      if (active) {
        ctx.fillStyle = 'rgba(255,95,162,0.14)';
        roundPath(ctx, boxX, boxY, boxW, boxH, 8);
        ctx.fill();
        ctx.fillStyle = '#ff5fa2';
        ctx.fillRect(boxX, boxY, 3, boxH);
      }
      ctx.fillStyle = active ? '#ffffff' : 'rgba(235,240,250,0.62)';
      ctx.font = `${active ? '700' : '600'} 21px system-ui, sans-serif`;
      ctx.fillText(item.label, boxX + 20, y);
      y += 54;
    });

    ctx.fillStyle = 'rgba(235,240,250,0.45)';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText(this.hint(game, this.items[this.index]), 76, y + 6);

    // Il browser non lascia partire l'audio prima di un gesto: qui il gesto
    // arriva subito (si deve premere qualcosa per giocare), ma dirlo evita che
    // il primo mezzo secondo di silenzio sembri un gioco muto.
    ctx.fillStyle = 'rgba(235,240,250,0.3)';
    ctx.font = '500 12px system-ui, sans-serif';
    const legend = this.focus === 'load'
      ? 'W/S per lo slot · A/D per l\'azione · Invio conferma · F autosave · ESC per tornare'
      : 'W/S per navigare · Invio per confermare · F4 muto';
    ctx.fillText(legend, 60, h - bar - 26);

    if (this.tab) {
      const size = Math.min(h - 140 - bar * 2, w * 0.44);
      const px = w - size - 64;
      const py = (h - size) / 2;
      if (this.tab === 'controls') {
        panelCard(ctx, px, py, size, size, 'Comandi');
        drawControlsList(ctx, px + 24, py + 80);
      } else {
        panelCard(ctx, px, py, size, size, 'Salvataggi');
        ctx.fillStyle = 'rgba(235,240,250,0.4)';
        ctx.font = '500 12px system-ui, sans-serif';
        ctx.fillText('Nel browser, non sul disco: svuotare i dati del sito li porta via.', px + 28, py + 64);
        this.saves.draw(ctx, game, px + 28, py + 84, size - 56, size - 110, this.focus === 'load');
      }
    }

    ctx.restore();
  }
}
