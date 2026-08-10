// Mappa della città: pannello riusabile dal menu di pausa e dalla vista a tutto schermo.
import { MAP_W, MAP_H } from '../world/maptexture.js';
import { DISTRICTS } from '../world/districts.js';
import { clamp } from '../core/math.js';
import { VEHICLE_TYPES } from '../render/sprites.js';
import { roundPath, drawRoutePath, drawMissionPin, fmtDistance } from './hud.js';
import { uiLayout, ellipsisText } from './layout.js';

export class MapView {
  constructor(city, texture) {
    this.city = city;
    this.texture = texture;
    this.open = false;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.dragging = false;
    this.lastMouse = { x: 0, y: 0 };
  }

  toggle() {
    this.open = !this.open;
    if (this.open) {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
    }
  }

  update(dt, game) {
    if (!this.open) return;
    const input = game.input;
    if (input.mouse.wheel) {
      this.zoom = clamp(this.zoom * (input.mouse.wheel > 0 ? 0.88 : 1.14), 1, 5);
    }
    if (input.mouse.down) {
      if (!this.dragging) {
        this.dragging = true;
        this.lastMouse.x = input.mouse.x;
        this.lastMouse.y = input.mouse.y;
      } else {
        this.panX += input.mouse.x - this.lastMouse.x;
        this.panY += input.mouse.y - this.lastMouse.y;
        this.lastMouse.x = input.mouse.x;
        this.lastMouse.y = input.mouse.y;
      }
    } else {
      this.dragging = false;
    }
  }

  /** Disegna la mappa dentro un quadrato. Restituisce la trasformazione usata. */
  drawPanel(ctx, game, x, y, size, opts = {}) {
    const city = this.city;
    const zoom = opts.zoom ?? 1;
    const panX = opts.panX ?? 0;
    const panY = opts.panY ?? 0;
    const p = game.player;

    ctx.save();
    ctx.fillStyle = 'rgba(8,10,13,0.95)';
    roundPath(ctx, x, y, size, size, 10);
    ctx.fill();
    roundPath(ctx, x, y, size, size, 10);
    ctx.clip();

    // Il pannello resta quadrato, la Corea no: la carta ci sta dentro con il suo
    // rapporto, centrata, invece di essere schiacciata su un lato.
    const fit = Math.min(size / MAP_W, size / MAP_H);
    const drawW = MAP_W * fit * zoom;
    const drawH = MAP_H * fit * zoom;
    let dx = x + (size - drawW) / 2 + panX;
    let dy = y + (size - drawH) / 2 + panY;
    if (zoom > 1.01) {
      dx = x + size / 2 - (p.x / city.w) * drawW + panX;
      dy = y + size / 2 - (p.y / city.h) * drawH + panY;
      dx = clamp(dx, x + Math.min(0, size - drawW), x + Math.max(0, size - drawW));
      dy = clamp(dy, y + Math.min(0, size - drawH), y + Math.max(0, size - drawH));
    }
    ctx.drawImage(this.texture, 0, 0, MAP_W, MAP_H, dx, dy, drawW, drawH);

    // Velo notturno sulla carta, più leggero che sulla minimappa: una mappa
    // aperta va letta, e qui non c'è la scena attorno a dare il contesto
    // dell'ora. Va prima dei blip, che devono restare pieni.
    const L = game.dayCycle && game.dayCycle.light;
    if (L && L.k > 0.02) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = L.k * 0.55;
      ctx.fillStyle = `rgb(${L.amb[0] | 0},${L.amb[1] | 0},${L.amb[2] | 0})`;
      ctx.fillRect(x, y, size, size);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    const toScreen = (wx, wy) => ({
      x: dx + (wx / city.w) * drawW,
      y: dy + (wy / city.h) * drawH,
    });

    // Etichette dei distretti. Sulle carte più piccole si applica un semplice
    // filtro di collisione: venticinque nomi sovrapposti non ne rendono leggibile
    // nessuno, mentre zoomando tornano tutti.
    ctx.textAlign = 'center';
    const labelPositions = [];
    const sparseLabels = size < 300 && zoom <= 1.25;
    for (const d of city.districts || DISTRICTS) {
      const s = toScreen(d.seed.x * city.w, d.seed.y * city.h);
      if (sparseLabels && labelPositions.some((p2) => Math.hypot(p2.x - s.x, p2.y - s.y) < 46)) continue;
      labelPositions.push(s);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = d.accent;
      ctx.font = `700 ${Math.max(12, 15 * Math.min(2, zoom))}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.fillText(d.hangul, s.x, s.y - 4);
      ctx.fillStyle = 'rgba(240,244,250,0.82)';
      ctx.font = `600 ${Math.max(9, 11 * Math.min(2, zoom))}px system-ui, sans-serif`;
      ctx.fillText(d.name.toUpperCase(), s.x, s.y + 11);
      ctx.restore();
    }

    // Territori delle bande: rettangolo tratteggiato e nome della banda. Sulla
    // mappa piena servono a decidere dove *non* passare, o dove andare a cercare.
    // Quelli tuoi sono pieni e dicono che sono tuoi: da lì in poi la carta non
    // serve più a evitarli ma a passare a riscuotere (§5.31).
    for (const t of city.turfs || []) {
      if (sparseLabels) continue;
      const mine = !!game.turfs?.mine(t);
      const a = toScreen(t.x, t.y);
      const b = toScreen(t.x + t.w, t.y + t.h);
      const rw = Math.max(5, b.x - a.x);
      const rh = Math.max(5, b.y - a.y);
      ctx.save();
      if (mine) {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = t.color;
        ctx.fillRect(a.x, a.y, rw, rh);
      }
      ctx.globalAlpha = mine ? 0.85 : 0.55;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2;
      if (!mine) ctx.setLineDash([6, 4]);
      ctx.strokeRect(a.x, a.y, rw, rh);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = t.color;
      ctx.font = `700 ${Math.max(8, 10 * Math.min(2, zoom))}px system-ui, "Apple SD Gothic Neo", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(mine ? `${t.hangul} · tuo` : t.hangul, (a.x + b.x) / 2, a.y - 3);
      ctx.restore();
    }

    // Landmark
    for (const lm of city.landmarks) {
      const s = toScreen(lm.x, lm.y);
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 7);
      ctx.lineTo(s.x + 5, s.y + 4);
      ctx.lineTo(s.x - 5, s.y + 4);
      ctx.closePath();
      ctx.fill();
      const major = /N Seoul Tower|COEX Mall|Gyeongbokgung|Lotte World Tower|Bukhansan|Incheon Chinatown|Suwon Hwaseong/.test(lm.name);
      if (city.landmarks.length <= 12 || zoom > 1.25 || major) {
        ctx.fillStyle = 'rgba(240,244,250,0.75)';
        ctx.font = '600 9px system-ui, sans-serif';
        ctx.fillText(lm.hangul, s.x, s.y + 15);
      }
    }

    // Stazioni della rete passeggeri: il cerchio ciano è distinto dal quadrato
    // blu dei commissariati, che storicamente usano `city.stations`.
    for (const st of city.transitStations || []) {
      const at = st.entrance || st;
      const s2 = toScreen(at.x, at.y);
      ctx.fillStyle = '#62c9ff';
      ctx.beginPath();
      ctx.arc(s2.x, s2.y, 6, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = '#11202a';
      ctx.font = '900 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('M', s2.x, s2.y + 2.8);
      if (zoom > 1.35) {
        ctx.fillStyle = 'rgba(235,245,252,0.9)';
        ctx.font = '600 9px system-ui, "Apple SD Gothic Neo", sans-serif';
        ctx.fillText(st.hangul, s2.x, s2.y + 17);
      }
    }

    // Ospedali
    for (const h of city.hospitals || []) {
      const s = toScreen(h.x, h.y);
      ctx.fillStyle = 'rgba(238,242,248,0.95)';
      ctx.fillRect(s.x - 6, s.y - 6, 12, 12);
      ctx.fillStyle = '#c62f34';
      ctx.fillRect(s.x - 1.5, s.y - 4.5, 3, 9);
      ctx.fillRect(s.x - 4.5, s.y - 1.5, 9, 3);
    }

    // Commissariati: sulla carta servono a decidere da che parte *non* scappare.
    for (const st of city.stations || []) {
      const s2 = toScreen(st.x, st.y);
      ctx.fillStyle = '#2f5fbf';
      ctx.fillRect(s2.x - 6, s2.y - 6, 12, 12);
      ctx.strokeStyle = 'rgba(226,234,248,0.9)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(s2.x - 6, s2.y - 6, 12, 12);
      ctx.fillStyle = 'rgba(226,234,248,0.95)';
      ctx.fillRect(s2.x - 4, s2.y - 1.5, 8, 3);
      if (zoom > 1.6) {
        ctx.fillStyle = 'rgba(240,244,250,0.8)';
        ctx.font = '600 9px system-ui, "Apple SD Gothic Neo", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('경찰서', s2.x, s2.y + 17);
      }
    }

    // Negozi con un servizio e officine di verniciatura: la mappa piena serve
    // proprio a decidere dove andare a rifornirsi o a farsi ridipingere l'auto.
    for (const sh of city.shops || []) {
      if (!sh.blip) continue;
      const s2 = toScreen(sh.x, sh.y);
      ctx.fillStyle = sh.blip;
      ctx.fillRect(s2.x - 3, s2.y - 3, 6, 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 1;
      ctx.strokeRect(s2.x - 3, s2.y - 3, 6, 6);
    }
    for (const g of city.garages || []) {
      const s2 = toScreen(g.cx, g.cy);
      ctx.fillStyle = '#b48cff';
      ctx.beginPath();
      ctx.moveTo(s2.x, s2.y - 6);
      ctx.lineTo(s2.x + 6, s2.y);
      ctx.lineTo(s2.x, s2.y + 6);
      ctx.lineTo(s2.x - 6, s2.y);
      ctx.closePath();
      ctx.fill();
      if (zoom > 1.6) {
        ctx.fillStyle = 'rgba(240,244,250,0.8)';
        ctx.font = '600 9px system-ui, "Apple SD Gothic Neo", sans-serif';
        ctx.fillText('도색', s2.x, s2.y + 16);
      }
    }

    // La strada da fare fino al blip. Va dopo insegne e territori e prima dei
    // marcatori: sopra la carta perché è quello che si è venuti a vedere, sotto
    // le mete perché una linea che copre il rombo dice dove passare e non dove
    // arrivare.
    drawRoutePath(ctx, game.route, toScreen, { width: 3.4 * Math.min(1.6, zoom), time: game.time });

    // Punti della fase in corso che non stanno sotto al blip (vedi `hud.js`).
    for (const pt of game.missions?.points || []) {
      if (pt.shop !== undefined) continue;
      if ((game.markers || []).some((mk) => Math.hypot(mk.x - pt.x, mk.y - pt.y) < 60)) continue;
      const s2 = toScreen(pt.x, pt.y);
      drawMissionPin(ctx, s2.x, s2.y, { r: 5, time: game.time, color: 'rgba(255,210,63,0.8)' });
    }

    // Marker attivi (missioni, negozi), con l'etichetta del posto: sulla carta
    // piena c'è lo spazio per dire *cos'è* la meta, e il 당구장 di una missione
    // altrimenti è un rombo giallo in mezzo a Hongdae.
    for (const mk of game.markers || []) {
      const s2 = toScreen(mk.x, mk.y);
      drawMissionPin(ctx, s2.x, s2.y, { r: 7, time: game.time, color: mk.color || '#ffd23f' });
      if (!mk.label) continue;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = mk.color || '#ffd23f';
      ctx.font = '700 11px system-ui, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText(mk.label, s2.x, s2.y - 13);
      ctx.restore();
    }

    // Polizia in caccia
    for (const v of game.vehicles) {
      if (!v.siren) continue;
      const s = toScreen(v.x, v.y);
      ctx.fillStyle = Math.sin(game.time * 9) > 0 ? '#5a8cff' : '#ff4a4a';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.5, 0, 6.2832);
      ctx.fill();
    }
    // Posti di blocco e chiodi: la mappa serve proprio a scegliere un'altra strada.
    if (game.police) {
      ctx.strokeStyle = '#5a8cff';
      ctx.lineWidth = 3;
      for (const b of game.police.blocks) {
        const s = toScreen(b.x, b.y);
        ctx.beginPath();
        if (b.vertical) { ctx.moveTo(s.x - 7, s.y); ctx.lineTo(s.x + 7, s.y); }
        else { ctx.moveTo(s.x, s.y - 7); ctx.lineTo(s.x, s.y + 7); }
        ctx.stroke();
      }
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      for (const sp of game.police.spikes) {
        const s = toScreen(sp.cx, sp.cy);
        ctx.beginPath();
        if (sp.horiz) { ctx.moveTo(s.x - 5, s.y); ctx.lineTo(s.x + 5, s.y); }
        else { ctx.moveTo(s.x, s.y - 5); ctx.lineTo(s.x, s.y + 5); }
        ctx.stroke();
      }
    }

    // Posizione del giocatore: freccia con alone pulsante
    const s = toScreen(p.x, p.y);
    const pulse = 8 + Math.sin(game.time * 3.4) * 3;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, pulse, 0, 6.2832);
    ctx.fill();
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Cornice
    ctx.strokeStyle = 'rgba(235,240,250,0.22)';
    ctx.lineWidth = 1.5;
    roundPath(ctx, x, y, size, size, 10);
    ctx.stroke();
  }

  draw(ctx, game) {
    if (!this.open) return;
    const w = game.camera.viewW;
    const h = game.camera.viewH;
    const L = uiLayout(w, h, game);
    const modalBottom = L.controls ? 70 : L.safeBottom;
    ctx.save();
    ctx.fillStyle = 'rgba(6,7,9,0.86)';
    ctx.fillRect(0, 0, w, h);

    const size = L.portrait
      ? Math.min(w - L.safeX * 2, Math.max(180, (h - L.safeTop - modalBottom) * (L.controls ? 0.4 : L.short ? 0.48 : 0.54)))
      : Math.min(h - L.safeTop - modalBottom, h * 0.82, w * 0.62);
    const x = L.portrait ? L.safeX : Math.max(L.safeX, (w - size) / 2 - 90);
    const y = L.portrait ? L.safeTop + 8 : Math.max(L.safeTop, (h - modalBottom - size) / 2);
    this.drawPanel(ctx, game, x, y, size, { zoom: this.zoom, panX: this.panX, panY: this.panY });

    // Colonna informativa
    const infoBelow = L.portrait;
    const px = infoBelow ? L.safeX : Math.min(w - L.safeX - 180, x + size + 26);
    const infoW = infoBelow ? w - L.safeX * 2 : Math.max(150, w - px - L.safeX);
    const infoY = infoBelow ? y + size + 24 : y;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f5fa';
    ctx.font = `${L.compact ? '800 20px' : '800 26px'} system-ui, sans-serif`;
    // La carta è una sola: il titolo dice dove si è, non quale mappa è aperta.
    const here = game.areaAt?.(game.player.x, game.player.y)
      || { name: 'Corea', hangul: '대한민국' };
    ctx.fillText(ellipsisText(ctx, here.name.toUpperCase(), infoW), px, infoY + 30, infoW);
    ctx.fillStyle = '#ff5fa2';
    ctx.font = `${L.compact ? '700 14px' : '700 18px'} system-ui, "Apple SD Gothic Neo", sans-serif`;
    ctx.fillText(`${here.hangul} — 지도`, px, infoY + 54, infoW);

    const d = game.player.district;
    let ly = infoY + (L.compact ? 80 : 96);
    const line = (label, value, color = 'rgba(235,240,250,0.7)') => {
      ctx.fillStyle = 'rgba(235,240,250,0.45)';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.fillText(label.toUpperCase(), px, ly);
      ctx.fillStyle = color;
      ctx.font = '600 15px system-ui, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText(ellipsisText(ctx, value, infoW), px, ly + 19, infoW);
      ly += L.compact ? 28 : 44;
    };
    if (d) line('quartiere', `${d.name} · ${d.hangul}`, d.accent);
    line('posizione', `${Math.round(game.player.x)} / ${Math.round(game.player.y)}`);
    const veh = game.player.vehicle;
    line('mezzo', game.player.onFoot || !veh ? 'a piedi' : VEHICLE_TYPES[veh.kind].label);
    line('contanti', `₩${game.player.money.toLocaleString('it-IT')}`, '#ffd23f');
    // La riga che spiega la linea gialla: dove porta e quanta strada è. Quando le
    // strade non ci arrivano lo dice, invece di far sembrare navigabile una retta
    // sul mare.
    const tgt = game.route?.target;
    if (tgt) {
      line(
        game.route.direct ? 'obiettivo · in linea d\'aria' : 'obiettivo · strada da fare',
        `${tgt.label ? `${tgt.label} — ` : ''}${fmtDistance(game.route.length)}`,
        '#ffd23f',
      );
    }

    ctx.fillStyle = 'rgba(235,240,250,0.4)';
    ctx.font = `${L.compact ? '500 11px' : '500 12px'} system-ui, sans-serif`;
    ctx.fillText(L.controls ? 'pinza/trascina: zoom e sposta' : 'rotella: zoom · trascina: sposta', px, ly + 4, infoW);
    ctx.fillText(L.controls ? 'indietro: chiudi · tocca una voce per orientarti' : 'M o ESC: chiudi', px, ly + 22, infoW);

    ctx.restore();
  }
}
