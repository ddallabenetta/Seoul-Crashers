// Listino di un banco. Il pannello non sa niente di armi, cure o vestiti: legge
// una lista di articoli da `entities/shops.js`, disegna una riga per ciascuno e
// chiama `buy(game)` su quello scelto. Aggiungere merce non passa da qui.
//
// Non sa nemmeno **dietro a che cosa** sta il banco: `showStock` vuole
// un'intestazione (insegna, mestiere, colore, orario) e un modo di rileggere la
// merce. È così che il cortile di una banda usa lo stesso pannello di un 총포상
// senza che qui dentro compaia la parola "banda".
import { roundPath } from './hud.js';
import { clamp } from '../core/math.js';
import { stockFor, won, marketFor } from '../entities/shops.js';
import { bizAlwaysOpen, clockLabel } from '../world/interiors.js';
import { getWeaponIcon } from '../render/sprites.js';
import { uiLayout, insideRect, ellipsisText } from './layout.js';

const ROW = 46;
const CHROME = 190;   // testata + piede: quanto resta al pannello oltre le righe

export class ShopMenu {
  constructor() {
    this.open = false;
    this.counter = null;   // insegna del banco: negozio o territorio
    this.restock = null;   // come si rilegge la merce dopo una compravendita
    this.items = [];
    this.index = 0;
    this.hover = -1;
    this.flash = 0;
    this.note = '';
    // Il tasto che ha aperto il pannello è lo stesso che compra: senza questa
    // pausa il primo articolo verrebbe comprato nello stesso frame.
    this.cooldown = 0;
    this.rows = [];
    this.first = 0;        // prima riga visibile (l'elenco può non starci tutto)
  }

  show(floor, game) {
    this.showStock({
      hangul: floor.biz.hangul,
      label: floor.biz.label,
      accent: floor.biz.pal.accent,
      hours: hoursLabel(floor.biz),
    }, () => stockFor(floor.biz.shop, game), game);
  }

  /** Apre il pannello su un banco qualunque. `counter` è solo l'intestazione. */
  showStock(counter, restock, game) {
    this.counter = counter;
    this.restock = restock;
    this.items = restock();
    this.index = 0;
    this.first = 0;
    this.hover = -1;
    this.note = '';
    this.cooldown = 0.25;
    this.open = this.items.length > 0;
    game.audio?.ui(this.open ? 'open' : 'deny');
    if (!this.open) game.hud.toast(`${counter.hangul} — oggi non hanno niente per te`, 2.4);
  }

  close(game) {
    this.open = false;
    this.counter = null;
    this.restock = null;
    game.player.enterCooldown = 0.3;
    game.audio?.ui('close');
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
    const was = this.index;
    const tapped = input.mouse.pressed
      ? this.rows.find((r) => insideRect(input.mouse.x, input.mouse.y, r))
      : null;
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) this.index = (this.index - 1 + n) % n;
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) this.index = (this.index + 1) % n;
    if (input.mouse.wheel) this.index = clamp(this.index + input.mouse.wheel, 0, n - 1);
    if (this.index !== was) game.audio?.ui('move');
    if (tapped) this.index = tapped.index;
    else if (this.hover >= 0 && input.mouse.pressed) this.index = this.hover;
    if (input.wasPressed('KeyE') || input.wasPressed('Enter') || input.wasPressed('Space')
      || !!tapped || (this.hover >= 0 && input.mouse.pressed)) {
      this.buy(game);
    }
  }

  buy(game) {
    const it = this.items[this.index];
    if (!it) return;
    const pl = game.player;
    if (it.need && !it.need(game)) {
      this.say('Prima serve l\'arma', false);
      game.audio?.ui('deny');
      return;
    }
    if (it.price > 0 && pl.money < it.price) {
      this.say(`Ti mancano ${won(it.price - pl.money)}`, false);
      game.audio?.ui('deny');
      return;
    }
    const msg = it.buy(game);
    if (msg === null) {
      this.say('Non ti serve', false);
      game.audio?.ui('deny');
      return;
    }
    pl.money -= it.price;
    if (it.price > 0) game.shops.spent += it.price;
    this.say(msg, true);
    game.audio?.cash(it.price >= 0);
    // Il banco dei pegni compra, e il ricettatore di 황소파 pure: dopo una vendita
    // la lista è un'altra. Finita la merce, il banco chiude da solo.
    this.items = this.restock();
    if (!this.items.length) { this.close(game); return; }
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
    const L = uiLayout(w, h, game);
    const modalBottom = L.controls ? 70 : L.safeBottom;
    const counter = this.counter;
    const accent = counter.accent;
    const pw = L.compact ? Math.max(260, w - L.safeX * 2) : 520;
    const rowH = L.compact ? 44 : ROW;
    const chrome = L.compact ? (L.short ? 96 : 136) : CHROME;
    // Un elenco che non ci sta si fa scorrere, non si taglia: il ricettatore
    // compra undici armi e su uno schermo basso le ultime finivano sotto al piede
    // del pannello, invisibili e non comprabili.
    const fit = Math.max(3, Math.floor((h - L.safeTop - modalBottom - chrome) / rowH));
    const shown = Math.min(this.items.length, fit);
    this.first = clamp(this.index - (shown >> 1), 0, Math.max(0, this.items.length - shown));
    const ph = chrome + shown * rowH;
    const x = L.compact ? L.safeX : (w - pw) / 2;
    const y = L.compact
      ? L.safeTop + Math.max(0, (h - L.safeTop - modalBottom - ph) / 2)
      : (h - ph) / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(6,7,9,0.82)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(14,16,20,0.96)';
    roundPath(ctx, x, y, pw, ph, 14);
    ctx.fill();
    ctx.strokeStyle = hexA(accent, 0.5);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Testata: insegna in hangul, mestiere in italiano, contanti a destra.
    ctx.textAlign = 'left';
    ctx.fillStyle = accent;
    ctx.font = `${L.compact ? '800 22px' : '800 30px'} system-ui, "Apple SD Gothic Neo", sans-serif`;
    ctx.fillText(ellipsisText(ctx, counter.hangul, pw * 0.42), x + 20, y + (L.compact ? 34 : 46), pw * 0.42);
    const titleW = ctx.measureText(counter.hangul).width;
    // Il quartiere in cui stai comprando, accanto all'insegna: senza dirlo, prezzi
    // diversi da un negozio all'altro sembrano un bug invece che un mercato.
    const market = counter.market || marketFor(game);
    ctx.font = `${L.compact ? '700 10px' : '700 13px'} system-ui, "Apple SD Gothic Neo", sans-serif`;
    ctx.fillStyle = hexA(accent, 0.6);
    ctx.fillText(`시세 ${market.hangul}`, x + 28 + titleW, y + (L.compact ? 32 : 44), pw * 0.3);
    ctx.fillStyle = 'rgba(238,242,248,0.9)';
    ctx.font = `${L.compact ? '700 12px' : '700 16px'} system-ui, sans-serif`;
    // Questa riga corre verso i contanti in alto a destra e un'insegna lunga ci
    // finisce sopra («usura · il vicolo dei debiti»). A cedere è la seconda metà,
    // non l'orario: quello è il pezzo per cui la riga esiste.
    const room = pw - (L.compact ? 38 : 52) - 84 - ctx.measureText(counter.hours).width - 14;
    const label = ellipsis(ctx, counter.label.toUpperCase(), room);
    ctx.fillText(label, x + (L.compact ? 20 : 26), y + (L.compact ? 53 : 68), Math.max(40, room));
    // L'orario sta qui perché è qui che si decide di spendere: sapere che fra
    // un'ora chiude cambia quanto ci si carica addosso adesso.
    ctx.fillStyle = 'rgba(238,242,248,0.42)';
    ctx.fillText(counter.hours, x + (L.compact ? 30 : 40) + ctx.measureText(label).width, y + (L.compact ? 53 : 68), Math.max(30, pw * 0.35));
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd23f';
    ctx.font = `${L.compact ? '700 16px' : '700 22px'} ui-monospace, monospace`;
    ctx.fillText(won(game.player.money), x + pw - (L.compact ? 18 : 26), y + (L.compact ? 38 : 50));
    ctx.fillStyle = 'rgba(235,240,250,0.4)';
    ctx.font = `${L.compact ? '600 9px' : '600 11px'} system-ui, sans-serif`;
    ctx.fillText('CONTANTI', x + pw - (L.compact ? 18 : 26), y + (L.compact ? 51 : 66));

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + (L.compact ? 14 : 20), y + (L.compact ? 66 : 84));
    ctx.lineTo(x + pw - (L.compact ? 14 : 20), y + (L.compact ? 66 : 84));
    ctx.stroke();

    // Righe
    this.rows.length = 0;
    this.hover = -1;
    let deviation = false;
    const m = game.input.mouse;
    let ry = y + (L.compact ? 76 : 96);
    for (let i = this.first; i < this.first + shown; i++) {
      const it = this.items[i];
      const sel = i === this.index;
      const sell = it.price < 0;
      const afford = sell || game.player.money >= it.price;
      const rx = x + 18;
      const rw = pw - 36;
      this.rows.push({ x: rx, y: ry, w: rw, h: rowH, index: i });
      if (m.x >= rx && m.x <= rx + rw && m.y >= ry && m.y <= ry + rowH - 6) this.hover = i;

      ctx.fillStyle = sel ? hexA(accent, 0.16) : 'rgba(255,255,255,0.03)';
      roundPath(ctx, rx, ry, rw, rowH - 6, 8);
      ctx.fill();
      if (sel) {
        ctx.strokeStyle = hexA(accent, 0.8);
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
        const iw = Math.min(icon.w, L.compact ? 24 : icon.w);
        const ih = icon.h * (iw / icon.w);
        ctx.drawImage(icon.canvas, rx + (L.compact ? 7 : 10), ry + (rowH - 6 - ih) / 2, iw, ih);
        ctx.restore();
      }

      ctx.textAlign = 'left';
      ctx.globalAlpha = afford ? 1 : 0.45;
      ctx.fillStyle = '#eef1f6';
      ctx.font = `${L.compact ? '700 11px' : '700 15px'} system-ui, "Apple SD Gothic Neo", sans-serif`;
      const tx = rx + (L.compact ? 42 : 62);
      const textW = Math.max(70, rw - (L.compact ? 138 : 160));
      ctx.fillText(ellipsisText(ctx, `${it.hangul}  ${it.label}`, textW), tx, ry + (L.compact ? 15 : 20), textW);
      ctx.fillStyle = 'rgba(230,236,245,0.5)';
      ctx.font = `${L.compact ? '500 9px' : '500 12px'} system-ui, sans-serif`;
      ctx.fillText(ellipsisText(ctx, it.detail ? it.detail(game) : '', textW), tx, ry + (L.compact ? 27 : 34), textW);

      ctx.textAlign = 'right';
      ctx.fillStyle = sell ? '#4ad98a' : afford ? '#ffd23f' : '#e04a3a';
      ctx.font = `${L.compact ? '700 12px' : '700 16px'} ui-monospace, monospace`;
      ctx.fillText(sell ? `+${won(-it.price)}` : won(it.price), rx + rw - 10, ry + (L.compact ? 17 : 24));
      // Scostamento dal listino di Seoul. Su una riga di vendita il segno si legge
      // al contrario — pagarti il 12% in più è una buona notizia — e il colore
      // segue quello, non il segno.
      const dev = Math.round(((it.mul || 1) - 1) * 100);
      if (Math.abs(dev) >= 2) {
        deviation = true;
        ctx.font = `${L.compact ? '700 9px' : '700 11px'} system-ui, sans-serif`;
        ctx.fillStyle = (sell ? dev > 0 : dev < 0) ? 'rgba(74,217,138,0.85)' : 'rgba(224,90,74,0.9)';
        ctx.fillText(`${dev > 0 ? '+' : ''}${dev}%`, rx + rw - 10, ry + (L.compact ? 29 : 38));
      }
      ctx.globalAlpha = 1;
      ry += rowH;
    }

    // Esito dell'ultimo acquisto
    if (this.flash > 0) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, this.flash * 2);
      ctx.fillStyle = this.ok ? '#4ad98a' : '#e04a3a';
      ctx.font = `${L.compact ? '700 11px' : '700 14px'} system-ui, sans-serif`;
      ctx.fillText(ellipsisText(ctx, this.note, pw - 34), x + pw / 2, y + ph - (L.compact ? 32 : 40), pw - 34);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(235,240,250,0.4)';
    ctx.font = `${L.compact ? '500 10px' : '500 12px'} system-ui, sans-serif`;
    ctx.fillText(L.controls ? 'su/giù · tocca per comprare · indietro per uscire' : 'W / S — scegli · E — compra · ESC — esci', x + pw / 2, y + ph - (L.compact ? 12 : 18), pw - 24);
    if (this.items.length > shown) {
      ctx.textAlign = 'right';
      ctx.fillStyle = hexA(accent, 0.55);
      ctx.font = `${L.compact ? '600 9px' : '600 11px'} ui-monospace, monospace`;
      ctx.fillText(`${this.index + 1}/${this.items.length}`, x + pw - 14, y + ph - (L.compact ? 12 : 18));
      ctx.textAlign = 'center';
    }
    if (deviation) {
      ctx.fillStyle = 'rgba(235,240,250,0.32)';
      ctx.font = `${L.compact ? '500 9px' : '500 11px'} system-ui, sans-serif`;
      ctx.fillText(ellipsisText(ctx, `${market.hangul} — scostamento dal listino di Seoul: rosso = ci rimetti, verde = ci guadagni`, pw - 28), x + pw / 2, y + ph - (L.compact ? 44 : 56), pw - 28);
    }
    ctx.restore();
  }
}

/** Taglia una scritta perché stia in `max` px, con i puntini. */
function ellipsis(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

function hoursLabel(biz) {
  return bizAlwaysOpen(biz.id) ? '· 24 ORE' : `· CHIUDE ALLE ${clockLabel(biz.open[1])}`;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}
