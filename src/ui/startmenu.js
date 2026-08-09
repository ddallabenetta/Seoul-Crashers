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
import { Mixer } from './mixer.js';
import { latestSlot, readSlot, describe, apply } from '../core/save.js';
import { uiLayout, insideRect, ellipsisText } from './layout.js';

export class StartMenu {
  constructor() {
    this.open = true;
    this.index = 0;
    this.tab = null;          // null | 'load' | 'audio' | 'controls'
    this.focus = 'items';
    this.hover = -1;
    this.hitRects = [];
    this.items = [];
    this.saves = new SaveSlots({ canSave: false });
    this.mixer = new Mixer();
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
    this.items.push({ id: 'audio', label: 'Audio' });
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
    if (item.id === 'audio') return game.mobileControls?.active ? 'Volumi e audio' : 'Volumi · F4 per il muto';
    return game.mobileControls?.active ? 'Stick, pulsanti e gesti touch' : 'Tastiera e mouse';
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
    if (this.focus === 'audio') {
      this.mixer.update(game);
      return;
    }
    const was = this.index;
    const tapped = input.mouse.pressed
      ? this.hitRects.find((r) => insideRect(input.mouse.x, input.mouse.y, r))
      : null;
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) {
      this.index = (this.index - 1 + this.items.length) % this.items.length;
    }
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) {
      this.index = (this.index + 1) % this.items.length;
    }
    if (tapped) this.index = tapped.index;
    else if (this.hover >= 0 && input.mouse.pressed) this.index = this.hover;
    if (this.index !== was) game.audio?.ui('move');
    if (input.wasPressed('Space') || input.wasPressed('Enter') || !!tapped
      || (this.hover >= 0 && input.mouse.pressed)) {
      this.activate(game);
    }
  }

  activate(game) {
    const item = this.items[this.index];
    game.audio?.ui(item.id === 'new' || item.id === 'continue' ? 'close' : 'ok');
    switch (item.id) {
      case 'continue':
        apply(game, this.latest.data);
        game.start(true);
        break;
      case 'new':
        // Da capo davvero: chi arriva qui può aver caricato un salvataggio un
        // minuto fa (dal titolo si può, e dal menu di pausa ci si torna), e senza
        // `newGame` «Nuova partita» proseguiva quella.
        game.newGame();
        // I ventotto pannelli, e solo qui: «Continua» e «Carica» riprendono una
        // partita in cui l'apertura è già successa. `start` lo chiama la cutscene
        // quando finisce — saltata o guardata che sia.
        game.playIntro();
        break;
      case 'load':
        this.tab = 'load';
        this.focus = 'load';
        this.saves.refresh();
        this.saves.confirm = -1;
        break;
      case 'audio':
        this.tab = 'audio';
        this.focus = 'audio';
        break;
      case 'controls':
        this.tab = 'controls';
        this.focus = 'items';
        break;
    }
  }

  draw(ctx, game) {
    const w = game.camera.viewW;
    const h = game.camera.viewH;
    const L = uiLayout(w, h, game);
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

    if (L.compact) {
      this.drawCompact(ctx, game, L);
      ctx.restore();
      return;
    }

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
    this.hitRects.length = 0;
    let y = bar + 274;
    this.items.forEach((item, i) => {
      const boxX = 56, boxY = y - 26, boxW = 300, boxH = 44;
      const inside = this.focus === 'items'
        && mx >= boxX && mx <= boxX + boxW && my >= boxY && my <= boxY + boxH;
      this.hitRects.push({ x: boxX, y: boxY, w: boxW, h: boxH, index: i });
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
      : this.focus === 'audio' ? Mixer.LEGEND
        : 'W/S per navigare · Invio per confermare · F4 muto';
    ctx.fillText(legend, 60, h - bar - 26);

    if (this.tab) {
      const size = Math.min(h - 140 - bar * 2, w * 0.44);
      const px = w - size - 64;
      const py = (h - size) / 2;
      if (this.tab === 'controls') {
        panelCard(ctx, px, py, size, size, 'Comandi');
        drawControlsList(ctx, px + 24, py + 80);
      } else if (this.tab === 'audio') {
        panelCard(ctx, px, py, size, size, 'Audio');
        this.mixer.draw(ctx, game, px + 28, py + 92, size - 90, this.focus === 'audio');
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

  drawCompact(ctx, game, L) {
    const { w, h, safeX, safeTop } = L;
    const safeBottom = L.controls ? (L.short ? 70 : 72) : L.safeBottom;
    const x = safeX;
    const panelW = w - safeX * 2;
    ctx.fillStyle = 'rgba(7,9,12,0.9)';
    roundPath(ctx, x, safeTop, panelW, h - safeTop - safeBottom, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,240,250,0.15)';
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f5fa';
    ctx.font = '900 27px system-ui, sans-serif';
    ctx.fillText('SEOUL', x + 18, safeTop + 38);
    ctx.fillStyle = '#ff5fa2';
    ctx.fillText('CRASHERS', x + 18, safeTop + 67);

    if (this.tab) {
      const title = this.tab === 'controls' ? 'Comandi' : this.tab === 'audio' ? 'Audio' : 'Salvataggi';
      const py = safeTop + 84;
      const ph = h - py - safeBottom - 28;
      panelCard(ctx, x + 12, py, panelW - 24, ph, title);
      if (this.tab === 'controls') {
        drawControlsList(ctx, x + 28, py + 66, { maxW: panelW - 56, lineHeight: L.short ? 17 : 19, compact: true, columns: L.short ? 2 : 1, touch: L.controls });
      } else if (this.tab === 'audio') {
        this.mixer.draw(ctx, game, x + 28, py + (L.short ? 62 : 86), Math.max(90, panelW - 56), this.focus === 'audio', L);
      } else {
        ctx.fillStyle = 'rgba(235,240,250,0.4)';
        ctx.font = '500 10px system-ui, sans-serif';
        ctx.fillText('Salvataggi nel browser', x + 28, py + 58, panelW - 56);
        this.saves.draw(ctx, game, x + 28, py + 78, panelW - 56, Math.max(130, ph - 100), this.focus === 'load', L);
      }
      ctx.fillStyle = 'rgba(235,240,250,0.42)';
      ctx.font = '500 11px system-ui, sans-serif';
      ctx.fillText(this.focus === 'items' ? 'ESC · chiudi menu' : 'ESC · torna alle voci', x + 18, h - safeBottom - 10);
      return;
    }

    const mx = game.input.mouse.x;
    const my = game.input.mouse.y;
    this.hover = -1;
    this.hitRects.length = 0;
    let y = safeTop + (L.short ? 90 : 106);
    const rowH = 44;
    this.items.forEach((item, i) => {
      const box = { x: x + 12, y: y - 26, w: panelW - 24, h: rowH };
      this.hitRects.push({ ...box, index: i });
      if (insideRect(mx, my, box)) this.hover = i;
      const active = this.focus === 'items' && i === this.index;
      if (active) {
        ctx.fillStyle = 'rgba(255,95,162,0.16)';
        roundPath(ctx, box.x, box.y, box.w, box.h, 7);
        ctx.fill();
        ctx.fillStyle = '#ff5fa2';
        ctx.fillRect(box.x, box.y, 3, box.h);
      }
      ctx.fillStyle = active ? '#ffffff' : 'rgba(235,240,250,0.66)';
      ctx.font = `${active ? '700' : '600'} ${L.short ? 14 : 16}px system-ui, sans-serif`;
      ctx.fillText(item.label, box.x + 14, y);
      y += rowH + (L.short ? 0 : 4);
    });
    if (!L.short) {
      ctx.fillStyle = 'rgba(235,240,250,0.46)';
      ctx.font = '500 10px system-ui, sans-serif';
      ctx.fillText(ellipsisText(ctx, this.hint(game, this.items[this.index]), panelW - 34), x + 18, y + 4, panelW - 34);
    }
    if (!L.short) {
      ctx.fillStyle = 'rgba(235,240,250,0.42)';
      ctx.font = '500 11px system-ui, sans-serif';
      ctx.fillText(L.controls ? 'tocca una voce · conferma o torna indietro' : 'W/S · scegli  Invio · conferma  F4 · muto', x + 18, h - safeBottom - 10);
    }
  }
}
