// Menu di pausa: voci a sinistra, mappa con la posizione del giocatore a destra.
import { roundPath } from './hud.js';
import { KMH } from '../core/math.js';

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
      { id: 'controls', label: 'Comandi', hint: 'Tastiera e mouse' },
      { id: 'stats', label: 'Statistiche', hint: 'La tua corsa finora' },
    ];
    this.hover = -1;
  }

  toggle() {
    this.open = !this.open;
    this.index = 0;
    this.tab = 'map';
  }

  update(dt, game) {
    if (!this.open) return;
    const input = game.input;
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) {
      this.index = (this.index - 1 + this.items.length) % this.items.length;
    }
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) {
      this.index = (this.index + 1) % this.items.length;
    }
    if (this.hover >= 0 && input.mouse.pressed) this.index = this.hover;
    if (input.wasPressed('Space') || input.wasPressed('Enter') || (this.hover >= 0 && input.mouse.pressed)) {
      this.activate(game);
    }
  }

  activate(game) {
    const item = this.items[this.index];
    switch (item.id) {
      case 'resume':
        this.open = false;
        break;
      case 'map':
        this.open = false;
        this.mapView.open = true;
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
    ctx.fillText('W/S per navigare · Invio per confermare · ESC per riprendere', 60, h - 42);

    // Pannello di destra
    const size = Math.min(h - 140, w * 0.44);
    const px = w - size - 64;
    const py = (h - size) / 2;
    if (this.tab === 'controls') this.drawControls(ctx, px, py, size);
    else if (this.tab === 'stats') this.drawStats(ctx, game, px, py, size);
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
