// Metropolitana e collegamenti interurbani: un unico pannello per viaggiare
// fra le stazioni della città e cambiare regione senza uscire dalla partita.
import { dist } from '../core/math.js';
import { roundPath } from './hud.js';

const REACH = 82;

const REGION_LINKS = [
  { id: 'seoul', label: 'Seoul', hangul: '서울', service: 'KTX' },
  { id: 'busan', label: 'Busan', hangul: '부산', service: 'KTX' },
  { id: 'jeju', label: 'Jeju', hangul: '제주', service: 'Aeroporto · traghetto' },
];

export class MetroSystem {
  constructor() {
    this.open = false;
    this.index = 0;
    this.station = null;
    this.options = [];
  }

  nearest(game) {
    if (!game.player.onFoot || game.indoors) return null;
    let best = null;
    let bestD = REACH;
    for (const station of game.city.transitStations || []) {
      const d = dist(game.player.x, game.player.y, station.x, station.y);
      if (d < bestD) { best = station; bestD = d; }
    }
    return best;
  }

  hint(game) {
    const s = this.nearest(game);
    return s ? `E  —  entra in metro · ${s.hangul} ${s.name}` : null;
  }

  buildOptions(game) {
    const regionId = game.city.region?.id || 'seoul';
    const local = (game.city.transitStations || [])
      .filter((s) => s !== this.station)
      .map((s) => ({
        region: regionId,
        station: s.id,
        title: `${s.hangul}  ${s.name}`,
        detail: `Metro ${s.lines.join(' · ')}`,
      }));
    const links = REGION_LINKS
      .filter((r) => r.id !== regionId)
      .map((r) => ({
        region: r.id,
        station: null,
        title: `${r.hangul}  ${r.label}`,
        detail: `Collegamento ${r.service}`,
      }));
    this.options = [...local, ...links];
  }

  enter(game, station) {
    if (game.wanted?.level > 0) {
      game.hud.toast('Con la polizia addosso i tornelli restano chiusi', 2.2);
      game.audio?.ui('deny');
      return;
    }
    this.station = station;
    this.index = 0;
    this.buildOptions(game);
    this.open = true;
    game.audio?.ui('open');
  }

  close(game) {
    this.open = false;
    this.station = null;
    this.options = [];
    game.audio?.ui('close');
  }

  update(_dt, game) {
    const input = game.input;
    if (!this.open) {
      const station = this.nearest(game);
      if (station && input.wasPressed('KeyE')) {
        this.enter(game, station);
        return true;
      }
      return false;
    }
    if (!this.options.length) {
      this.close(game);
      return true;
    }
    if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
      this.index = (this.index + this.options.length - 1) % this.options.length;
      game.audio?.ui('move');
    }
    if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
      this.index = (this.index + 1) % this.options.length;
      game.audio?.ui('move');
    }
    if (input.wasPressed('Enter') || input.wasPressed('KeyE')) {
      const option = this.options[this.index];
      game.audio?.ui('ok');
      this.open = false;
      game.travelTo(option.region, option.station);
      return true;
    }
    return false;
  }

  draw(ctx, game) {
    if (!this.open) return;
    const w = game.camera.viewW;
    const h = game.camera.viewH;
    ctx.save();
    ctx.fillStyle = 'rgba(5,7,11,0.88)';
    ctx.fillRect(0, 0, w, h);
    const pw = Math.min(620, w - 48);
    const ph = Math.min(560, h - 48);
    const x = (w - pw) / 2;
    const y = (h - ph) / 2;
    ctx.fillStyle = 'rgba(16,20,28,0.98)';
    roundPath(ctx, x, y, pw, ph, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,190,255,0.42)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#eef5ff';
    ctx.font = '800 27px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('수도권 전철 · METRO KOREA', x + 30, y + 42);
    ctx.fillStyle = '#64c7ff';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(`Partenza: ${this.station?.hangul || ''} ${this.station?.name || ''}`, x + 30, y + 66);

    const columns = this.options.length > 9 ? 2 : 1;
    const rows = Math.ceil(this.options.length / columns);
    const gap = 10;
    const colW = (pw - 48 - gap * (columns - 1)) / columns;
    const rowH = Math.min(54, (ph - 138) / Math.max(1, rows));
    for (let i = 0; i < this.options.length; i++) {
      const o = this.options[i];
      const active = i === this.index;
      const col = Math.floor(i / rows);
      const row = i % rows;
      const ox = x + 24 + col * (colW + gap);
      const oy = y + 92 + row * rowH;
      ctx.fillStyle = active ? 'rgba(61,169,232,0.24)' : 'rgba(255,255,255,0.045)';
      roundPath(ctx, ox, oy, colW, rowH - 7, 9);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = '#64c7ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.fillStyle = active ? '#ffffff' : 'rgba(235,241,250,0.78)';
      ctx.font = `700 ${columns === 1 ? 17 : 13}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.fillText(o.title, ox + 14, oy + 18, colW - 26);
      ctx.fillStyle = active ? '#8ed9ff' : 'rgba(225,235,245,0.45)';
      ctx.font = `500 ${columns === 1 ? 11 : 9}px system-ui, sans-serif`;
      ctx.fillText(o.detail, ox + 14, oy + 34, colW - 26);
    }
    ctx.fillStyle = 'rgba(235,241,250,0.48)';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillText('W/S o frecce: scegli · E/INVIO: viaggia · ESC: esci', x + 30, y + ph - 24);
    ctx.restore();
  }
}
