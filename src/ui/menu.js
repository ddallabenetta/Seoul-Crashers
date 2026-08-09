// Menu di pausa: voci a sinistra, mappa con la posizione del giocatore a destra.
import { roundPath } from './hud.js';
import { KMH } from '../core/math.js';
import { SaveSlots } from './saveslots.js';
import { Mixer } from './mixer.js';
import { uiLayout, insideRect, ellipsisText } from './layout.js';

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

const TOUCH_CONTROLS = [
  ['Stick sinistro', 'muoviti · sterza'],
  ['Stick destro', 'mira · spara · drive-by'],
  ['Icona luminosa', 'azione disponibile · sali/scendi · entra'],
  ['Icona secondaria', 'azione alternativa · clacson'],
  ['Corsa / quota', 'corri · frena · sali/scendi di quota'],
  ['Mirino', 'fucile di precisione'],
  ['Cambio arma', 'arma successiva'],
  ['Mappa / pausa', 'apri i relativi pannelli'],
  ['Radio', 'solo a bordo · tocca: stazione · tieni: spegni'],
  ['Pinza / trascina', 'zoom e spostamento mappa'],
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
      { id: 'title', label: 'Esci al titolo', hint: 'Quello che non hai salvato lo perdi' },
    ];
    this.hover = -1;
    this.hitRects = [];
    // Uscire al titolo butta via la partita: la seconda pressione è l'unica cosa
    // che sta fra un dito scivolato sull'ultima voce e mezz'ora di gioco.
    this.quitConfirm = false;
    // Audio e salvataggi sono i due pannelli che si *usano* invece di leggersi:
    // quando sono attivi i tasti di navigazione passano a loro, e ESC torna alle
    // voci invece di chiudere il menu.
    this.focus = 'items';
    this.mixer = new Mixer();
    this.saves = new SaveSlots({ canSave: true });
  }

  toggle() {
    this.open = !this.open;
    this.index = 0;
    this.tab = 'map';
    this.focus = 'items';
    this.quitConfirm = false;
  }

  /** ESC dentro un pannello che si usa torna alle voci invece di chiudere il menu. */
  backOut() {
    if (!this.open) return false;
    // La conferma d'uscita si annulla per prima: ESC lì sopra vuol dire «no».
    if (this.quitConfirm) { this.quitConfirm = false; return true; }
    if (this.focus === 'items') return false;
    this.focus = 'items';
    this.saves.confirm = -1;
    return true;
  }

  update(dt, game) {
    if (!this.open) return;
    if (this.focus === 'audio') {
      this.mixer.update(game);
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
    // Spostarsi altrove è già una risposta: la conferma d'uscita non resta armata
    // alle spalle di chi è andato a guardare le statistiche.
    if (this.index !== was) { game.audio?.ui('move'); this.quitConfirm = false; }
    if (input.wasPressed('Space') || input.wasPressed('Enter') || !!tapped
      || (this.hover >= 0 && input.mouse.pressed)) {
      this.activate(game);
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
      case 'title':
        // La scheda dei salvataggi resta a fianco mentre si chiede conferma: chi
        // si accorge adesso di non aver salvato ha il posto dove farlo sott'occhio.
        if (!this.quitConfirm) {
          this.quitConfirm = true;
          this.tab = 'saves';
          this.saves.refresh();
          break;
        }
        this.quitConfirm = false;
        this.open = false;
        game.toTitle();
        break;
    }
  }

  draw(ctx, game) {
    if (!this.open) return;
    const w = game.camera.viewW;
    const h = game.camera.viewH;
    const L = uiLayout(w, h, game);
    ctx.save();
    ctx.fillStyle = 'rgba(6,7,9,0.88)';
    ctx.fillRect(0, 0, w, h);

    if (L.compact) {
      this.drawCompact(ctx, game, L);
      ctx.restore();
      return;
    }

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
    this.hitRects.length = 0;
    let y = 216;
    this.items.forEach((item, i) => {
      const boxX = 56, boxY = y - 26, boxW = 276, boxH = 44;
      const inside = mx >= boxX && mx <= boxX + boxW && my >= boxY && my <= boxY + boxH;
      this.hitRects.push({ x: boxX, y: boxY, w: boxW, h: boxH, index: i });
      if (inside) this.hover = i;
      const active = i === this.index;
      // La voce armata si tinge d'ambra: la conferma si deve vedere prima di
      // premere, non leggere in fondo allo schermo.
      const arming = active && item.id === 'title' && this.quitConfirm;
      if (active) {
        ctx.fillStyle = arming ? 'rgba(255,210,63,0.16)' : 'rgba(255,95,162,0.14)';
        roundPath(ctx, boxX, boxY, boxW, boxH, 8);
        ctx.fill();
        ctx.fillStyle = arming ? '#ffd23f' : '#ff5fa2';
        ctx.fillRect(boxX, boxY, 3, boxH);
      }
      ctx.fillStyle = arming ? '#ffd23f' : (active ? '#ffffff' : 'rgba(235,240,250,0.62)');
      ctx.font = `${active ? '700' : '600'} 20px system-ui, sans-serif`;
      ctx.fillText(arming ? 'Uscire? Invio conferma' : item.label, boxX + 20, y);
      y += 54;
    });

    // Descrizione della voce selezionata, su una riga sua: dentro il box si
    // sovrapponeva all'etichetta.
    ctx.fillStyle = this.quitConfirm ? 'rgba(255,210,63,0.7)' : 'rgba(235,240,250,0.45)';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText(
      this.quitConfirm ? 'Torni al titolo e la partita ricomincia · ESC annulla' : this.items[this.index].hint,
      76, y + 6
    );

    ctx.fillStyle = 'rgba(235,240,250,0.32)';
    ctx.font = '500 12px system-ui, sans-serif';
    const legend = {
      audio: Mixer.LEGEND,
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

  drawCompact(ctx, game, L) {
    const { w, h, safeX, safeTop } = L;
    const safeBottom = L.controls ? (L.short ? 70 : 72) : L.safeBottom;
    const x = safeX;
    const panelW = w - safeX * 2;
    const detail = this.tab && this.tab !== 'map';
    ctx.fillStyle = 'rgba(10,12,16,0.95)';
    roundPath(ctx, x, safeTop, panelW, h - safeTop - safeBottom, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,240,250,0.16)';
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f5fa';
    ctx.font = '900 25px system-ui, sans-serif';
    ctx.fillText('SEOUL', x + 18, safeTop + 34);
    ctx.fillStyle = '#ff5fa2';
    ctx.fillText('CRASHERS', x + 18, safeTop + 61);

    if (detail) {
      // Nei pannelli stretti il dettaglio prende tutta la scheda: comandi e
      // salvataggi non possono dividere la colonna con sette voci senza tagliarsi.
      const title = this.tab === 'controls' ? 'Comandi'
        : this.tab === 'stats' ? 'Statistiche'
          : this.tab === 'audio' ? 'Audio' : 'Salvataggi';
      const py = safeTop + 78;
      const ph = h - py - safeBottom - 28;
      panelCard(ctx, x + 12, py, panelW - 24, ph, title);
      if (this.tab === 'controls') drawControlsList(ctx, x + 28, py + 68, { maxW: panelW - 56, lineHeight: L.short ? 19 : 21, compact: true, columns: L.short ? 2 : 1, touch: L.controls });
      else if (this.tab === 'stats') this.drawStats(ctx, game, x + 12, py, panelW - 24, ph, L);
      else if (this.tab === 'audio') this.drawAudio(ctx, game, x + 12, py, panelW - 24, ph, L);
      else this.drawSaves(ctx, game, x + 12, py, panelW - 24, ph, L);
      ctx.fillStyle = 'rgba(235,240,250,0.45)';
      ctx.font = '500 11px system-ui, sans-serif';
      const backHint = L.controls
        ? (this.focus === 'items' ? 'indietro · chiudi menu' : 'indietro · torna alle voci')
        : (this.focus === 'items' ? 'ESC · chiudi menu' : 'ESC · torna alle voci');
      ctx.fillText(backHint, x + 18, h - safeBottom - 10);
      return;
    }

    // Con la mappa le voci restano visibili: il dock virtuale le attraversa con
    // su/giù e Invio, mentre la carta usa soltanto lo spazio che resta davvero.
    const mx = game.input.mouse.x;
    const my = game.input.mouse.y;
    this.hover = -1;
    this.hitRects.length = 0;
    const startY = safeTop + (L.short ? 86 : 94);
    let y = startY;
    const rowH = 44;
    const columns = L.short && panelW >= 480 ? 2 : 1;
    const rowsPerColumn = Math.ceil(this.items.length / columns);
    const columnGap = columns > 1 ? 8 : 0;
    const columnW = (panelW - 24 - columnGap * (columns - 1)) / columns;
    this.items.forEach((item, i) => {
      const column = Math.floor(i / rowsPerColumn);
      const row = i % rowsPerColumn;
      const baseline = startY + row * (rowH + (L.short ? 0 : 3));
      const box = {
        x: x + 12 + column * (columnW + columnGap),
        y: baseline - 23,
        w: columnW,
        h: rowH,
      };
      this.hitRects.push({ ...box, index: i });
      if (this.focus === 'items' && insideRect(mx, my, box)) this.hover = i;
      const active = this.focus === 'items' && i === this.index;
      if (active) {
        ctx.fillStyle = 'rgba(255,95,162,0.16)';
        roundPath(ctx, box.x, box.y, box.w, box.h, 7);
        ctx.fill();
        ctx.fillStyle = '#ff5fa2';
        ctx.fillRect(box.x, box.y, 3, box.h);
      }
      ctx.fillStyle = active ? '#ffffff' : 'rgba(235,240,250,0.66)';
      ctx.font = `${active ? '700' : '600'} ${L.short ? 13 : 15}px system-ui, sans-serif`;
      ctx.fillText(item.label, box.x + 14, baseline);
    });
    y = startY + rowsPerColumn * (rowH + (L.short ? 0 : 3));
    if (!L.short) {
      ctx.fillStyle = 'rgba(235,240,250,0.46)';
      ctx.font = '500 10px system-ui, sans-serif';
      ctx.fillText(ellipsisText(ctx, this.items[this.index].hint, panelW - 34), x + 18, y + 4, panelW - 34);
    }

    const mapRoom = h - y - safeBottom - 40;
    const mapSize = mapRoom >= 80 ? Math.min(panelW - 28, mapRoom) : 0;
    const mapX = x + (panelW - mapSize) / 2;
    const mapY = y + 18;
    if (mapSize >= 80) this.mapView.drawPanel(ctx, game, mapX, mapY, mapSize, { zoom: 1 });
    if (!L.short) {
      ctx.fillStyle = 'rgba(235,240,250,0.34)';
      ctx.font = '500 10px system-ui, sans-serif';
      ctx.fillText('W/S · scegli  Invio · conferma  ESC · riprendi', x + 18, h - safeBottom - 10);
    }
  }

  drawControls(ctx, x, y, size, h = size, L = null) {
    panelCard(ctx, x, y, size, size, 'Comandi');
    drawControlsList(ctx, x + 24, y + 80, L?.compact ? { maxW: size - 48, lineHeight: 21, compact: true, touch: L.controls } : {});
  }

  drawAudio(ctx, game, x, y, size, h = size, L = null) {
    panelCard(ctx, x, y, size, h, 'Audio');
    this.mixer.draw(ctx, game, x + 28, y + (L?.short ? 62 : 92), L?.compact ? Math.max(90, size - 56) : size, this.focus === 'audio', L);
  }

  /** Quattro schede: i tre slot manuali e quello dell'autosave. */
  drawSaves(ctx, game, x, y, size, h = size, L = null) {
    panelCard(ctx, x, y, size, h, 'Salvataggi');
    ctx.fillStyle = 'rgba(235,240,250,0.4)';
    ctx.font = '500 12px system-ui, sans-serif';
    const note = L?.compact
      ? 'Salvataggi conservati in questo browser'
      : 'Nel browser, non sul disco: svuotare i dati del sito li porta via.';
    ctx.fillText(ellipsisText(ctx, note, size - 56), x + 28, y + 64, size - 56);
    this.saves.draw(ctx, game, x + 28, y + 84, size - 56, Math.max(100, h - 110), this.focus === 'saves', L);
  }

  drawStats(ctx, game, x, y, size, h = size, L = null) {
    panelCard(ctx, x, y, size, h, 'Statistiche');
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
    const perCol = L?.compact ? Math.ceil(rows.length / 2) : (h < 380 ? rows.length : Math.ceil(rows.length / 2));
    const statY = L?.compact ? y + 64 : y + 90;
    rows.forEach(([label, value], i) => {
      const cx = x + 28 + (i < perCol ? 0 : (size - 44) / 2);
      const ly = statY + (i % perCol) * (L?.compact ? 20 : 52);
      ctx.fillStyle = 'rgba(235,240,250,0.45)';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText(label.toUpperCase(), cx, ly);
      ctx.fillStyle = '#ffd23f';
      ctx.font = `${L?.compact ? '700 11px' : '700 18px'} system-ui, sans-serif`;
      ctx.fillText(ellipsisText(ctx, value, Math.max(54, size / (perCol === rows.length ? 1 : 2) - 38)), cx, ly + (L?.compact ? 13 : 22));
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
  ctx.font = `700 ${Math.max(15, Math.min(20, w * 0.065))}px system-ui, sans-serif`;
  ctx.fillText(title, x + 28, y + Math.min(44, Math.max(30, h * 0.14)), w - 42);
}

/**
 * L'elenco dei comandi. Passo e corpo stretti: il pannello è quadrato e largo
 * 0.44 dello schermo, su una finestra alta e stretta sedici righe da 30 px
 * uscirebbero dal fondo.
 */
export function drawControlsList(ctx, x, y, opts = {}) {
  const controls = opts.touch ? TOUCH_CONTROLS : CONTROLS;
  const maxW = opts.maxW || Infinity;
  const compact = !!opts.compact;
  const lineHeight = opts.lineHeight || 26;
  const columns = Math.max(1, opts.columns || 1);
  const colW = maxW / columns;
  const keyW = compact ? Math.min(112, colW * 0.38) : 126;
  const perCol = Math.ceil(controls.length / columns);
  for (let i = 0; i < controls.length; i++) {
    const [key, desc] = controls[i];
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const ox = x + col * colW;
    const ly = y + row * lineHeight;
    ctx.fillStyle = 'rgba(56,214,255,0.92)';
    ctx.font = `${compact ? '600 10px' : '600 12px'} ui-monospace, monospace`;
    ctx.fillText(ellipsisText(ctx, key, keyW - 4), ox, ly, keyW - 4);
    ctx.fillStyle = 'rgba(235,240,250,0.66)';
    ctx.font = `${compact ? '500 10px' : '500 12px'} system-ui, sans-serif`;
    const descW = Number.isFinite(colW) ? Math.max(40, colW - keyW) : Infinity;
    const descText = ellipsisText(ctx, desc, descW);
    if (Number.isFinite(descW)) ctx.fillText(descText, ox + keyW, ly, descW);
    else ctx.fillText(descText, ox + keyW, ly);
  }
}
