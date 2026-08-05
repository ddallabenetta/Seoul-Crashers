// Listino di un negozio. Il pannello non sa niente di armi, cure o vestiti: legge
// una lista di articoli da `entities/shops.js`, disegna una riga per ciascuno e
// chiama `buy(game)` su quello scelto. Aggiungere merce non passa da qui.
import { roundPath } from './hud.js';
import { clamp } from '../core/math.js';
import { stockFor, won, marketFor } from '../entities/shops.js';
import { bizAlwaysOpen, clockLabel } from '../world/interiors.js';
import { getWeaponIcon } from '../render/sprites.js';

const ROW = 46;

export class ShopMenu {
  constructor() {
    this.open = false;
    this.floor = null;
    this.items = [];
    this.index = 0;
    this.hover = -1;
    this.flash = 0;
    this.note = '';
    // Il tasto che ha aperto il pannello è lo stesso che compra: senza questa
    // pausa il primo articolo verrebbe comprato nello stesso frame.
    this.cooldown = 0;
    this.rows = [];
  }

  show(floor, game) {
    this.floor = floor;
    this.items = stockFor(floor.biz.shop, game);
    this.index = 0;
    this.hover = -1;
    this.note = '';
    this.cooldown = 0.25;
    this.open = this.items.length > 0;
  }

  close(game) {
    this.open = false;
    this.floor = null;
    game.player.enterCooldown = 0.3;
  }

  update(dt, game) {
    if (!this.open) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flash = Math.max(0, this.flash - dt);
    const input = game.input;
    if (this.cooldown > 0) return;

    if (input.wasPressed('Escape') || input.wasPressed('KeyM') || input.wasPressed('KeyQ')) {
      this.close(game);
      return;
    }
    const n = this.items.length;
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) this.index = (this.index - 1 + n) % n;
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) this.index = (this.index + 1) % n;
    if (input.mouse.wheel) this.index = clamp(this.index + input.mouse.wheel, 0, n - 1);
    if (this.hover >= 0 && input.mouse.pressed) this.index = this.hover;
    if (input.wasPressed('KeyE') || input.wasPressed('Enter') || input.wasPressed('Space')
      || (this.hover >= 0 && input.mouse.pressed)) {
      this.buy(game);
    }
  }

  buy(game) {
    const it = this.items[this.index];
    if (!it) return;
    const pl = game.player;
    if (it.need && !it.need(game)) {
      this.say('Prima serve l\'arma', false);
      return;
    }
    if (it.price > 0 && pl.money < it.price) {
      this.say(`Ti mancano ${won(it.price - pl.money)}`, false);
      return;
    }
    const msg = it.buy(game);
    if (msg === null) {
      this.say('Non ti serve', false);
      return;
    }
    pl.money -= it.price;
    if (it.price > 0) game.shops.spent += it.price;
    this.say(msg, true);
    // Il banco dei pegni compra: dopo una vendita la lista è un'altra.
    this.items = stockFor(this.floor.biz.shop, game);
    this.index = clamp(this.index, 0, this.items.length - 1);
  }

  say(text, ok) {
    this.note = text;
    this.flash = ok ? 1 : 0.6;
    this.ok = ok;
  }

  draw(ctx, game) {
    if (!this.open) return;
    const w = game.camera.viewW;
    const h = game.camera.viewH;
    const biz = this.floor.biz;
    const pal = biz.pal;
    const pw = 520;
    const ph = Math.min(h - 120, 190 + this.items.length * ROW);
    const x = (w - pw) / 2;
    const y = (h - ph) / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(6,7,9,0.82)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(14,16,20,0.96)';
    roundPath(ctx, x, y, pw, ph, 14);
    ctx.fill();
    ctx.strokeStyle = hexA(pal.accent, 0.5);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Testata: insegna in hangul, mestiere in italiano, contanti a destra.
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.accent;
    ctx.font = '800 30px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(biz.hangul, x + 26, y + 46);
    const titleW = ctx.measureText(biz.hangul).width;
    // Il quartiere in cui stai comprando, accanto all'insegna: senza dirlo, prezzi
    // diversi da un negozio all'altro sembrano un bug invece che un mercato.
    const market = marketFor(game);
    ctx.font = '700 13px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillStyle = hexA(pal.accent, 0.6);
    ctx.fillText(`시세 ${market.hangul}`, x + 42 + titleW, y + 44);
    ctx.fillStyle = 'rgba(238,242,248,0.9)';
    ctx.font = '700 16px system-ui, sans-serif';
    const label = biz.label.toUpperCase();
    ctx.fillText(label, x + 26, y + 68);
    // L'orario sta qui perché è qui che si decide di spendere: sapere che fra
    // un'ora chiude cambia quanto ci si carica addosso adesso.
    ctx.fillStyle = 'rgba(238,242,248,0.42)';
    ctx.fillText(hoursLabel(biz), x + 40 + ctx.measureText(label).width, y + 68);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '700 22px ui-monospace, monospace';
    ctx.fillText(won(game.player.money), x + pw - 26, y + 50);
    ctx.fillStyle = 'rgba(235,240,250,0.4)';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('CONTANTI', x + pw - 26, y + 66);

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 84);
    ctx.lineTo(x + pw - 20, y + 84);
    ctx.stroke();

    // Righe
    this.rows.length = 0;
    this.hover = -1;
    let deviation = false;
    const m = game.input.mouse;
    let ry = y + 96;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const sel = i === this.index;
      const sell = it.price < 0;
      const afford = sell || game.player.money >= it.price;
      const rx = x + 18;
      const rw = pw - 36;
      if (m.x >= rx && m.x <= rx + rw && m.y >= ry && m.y <= ry + ROW - 6) this.hover = i;

      ctx.fillStyle = sel ? hexA(pal.accent, 0.16) : 'rgba(255,255,255,0.03)';
      roundPath(ctx, rx, ry, rw, ROW - 6, 8);
      ctx.fill();
      if (sel) {
        ctx.strokeStyle = hexA(pal.accent, 0.8);
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // Icona: per le armi è la stessa della barra armi, così si riconoscono.
      const wid = it.key.startsWith('w:') || it.key.startsWith('s:') || it.key.startsWith('a:')
        ? it.key.slice(2) : null;
      if (wid) {
        const icon = getWeaponIcon(wid);
        ctx.save();
        ctx.globalAlpha = afford ? 1 : 0.4;
        ctx.drawImage(icon.canvas, rx + 10, ry + (ROW - 6 - icon.h) / 2, icon.w, icon.h);
        ctx.restore();
      }

      ctx.textAlign = 'left';
      ctx.globalAlpha = afford ? 1 : 0.45;
      ctx.fillStyle = '#eef1f6';
      ctx.font = '700 15px system-ui, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText(`${it.hangul}  ${it.label}`, rx + 62, ry + 20);
      ctx.fillStyle = 'rgba(230,236,245,0.5)';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillText(it.detail ? it.detail(game) : '', rx + 62, ry + 34);

      ctx.textAlign = 'right';
      ctx.fillStyle = sell ? '#4ad98a' : afford ? '#ffd23f' : '#e04a3a';
      ctx.font = '700 16px ui-monospace, monospace';
      ctx.fillText(sell ? `+${won(-it.price)}` : won(it.price), rx + rw - 14, ry + 24);
      // Scostamento dal listino di Seoul. Su una riga di vendita il segno si legge
      // al contrario — pagarti il 12% in più è una buona notizia — e il colore
      // segue quello, non il segno.
      const dev = Math.round(((it.mul || 1) - 1) * 100);
      if (Math.abs(dev) >= 2) {
        deviation = true;
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.fillStyle = (sell ? dev > 0 : dev < 0) ? 'rgba(74,217,138,0.85)' : 'rgba(224,90,74,0.9)';
        ctx.fillText(`${dev > 0 ? '+' : ''}${dev}%`, rx + rw - 14, ry + 38);
      }
      ctx.globalAlpha = 1;
      ry += ROW;
    }

    // Esito dell'ultimo acquisto
    if (this.flash > 0) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, this.flash * 2);
      ctx.fillStyle = this.ok ? '#4ad98a' : '#e04a3a';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText(this.note, x + pw / 2, y + ph - 40);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(235,240,250,0.4)';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillText('W / S — scegli · E — compra · ESC — esci', x + pw / 2, y + ph - 18);
    if (deviation) {
      ctx.fillStyle = 'rgba(235,240,250,0.32)';
      ctx.font = '500 11px system-ui, sans-serif';
      ctx.fillText(`${market.hangul} — scostamento dal listino di Seoul: rosso = ci rimetti, verde = ci guadagni`, x + pw / 2, y + ph - 56);
    }
    ctx.restore();
  }
}

function hoursLabel(biz) {
  return bizAlwaysOpen(biz.id) ? '· 24 ORE' : `· CHIUDE ALLE ${clockLabel(biz.open[1])}`;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}
