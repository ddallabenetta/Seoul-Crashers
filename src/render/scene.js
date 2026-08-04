// Renderer principale. Ogni volume viene estruso verso l'esterno dello schermo in
// base alla sua altezza: è questo a dare la profondità "diorama" tipo GTA2/CTW.
// Tutti gli oggetti alti vengono ordinati per distanza radiale dal centro camera
// (painter's algorithm radiale) e disegnati dal più lontano al più vicino.
import { PROJ, SUN } from './camera.js';
import { facadeTexture, facadeGradient, bucketCols, bucketRows, signSprite, FTW, FTH } from './facades.js';
import {
  getVehicleSprite, getPedSprite, getPropSprite, getWreckSprite, getPickupSprite,
  getHeroSprite, getChopperSprite, getSpikeSprite, getThrownSprite, VEHICLE_TYPES, PED_FRAMES,
} from './sprites.js';
import { WEAPONS } from '../entities/weapons.js';
import { airborne } from '../entities/vehicle.js';
import { GroundRenderer } from './ground.js';
import { signalAxis } from '../world/roadgraph.js';
import { BUSINESSES as SHOP_BIZ } from '../world/interiors.js';

const POLE_PROPS = new Set(['lamp', 'crane']);

/**
 * Altezza di proiezione di un volume: altezza propria più la quota del terreno.
 * È così che si legge il dislivello — un palazzo su una collina "si apre" di più —
 * senza deformare il terreno, che resta disegnato in pianta.
 */
function projHeight(b) {
  return b.h3d + (b.elev || 0);
}

function convexHull(pts) {
  const p = pts.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export class Scene {
  constructor(city) {
    this.city = city;
    this.ground = new GroundRenderer(city);
    this.list = [];
    this._bq = [];
    this._pq = [];
    this._kq = [];
    this._fq = [];
    this.debug = false;
  }

  /** Ombra statica di un volume: hull tra footprint e footprint traslato dal sole. */
  buildingShadow(b) {
    if (b._shadow) return b._shadow;
    const h = projHeight(b);
    const ox = SUN.x * h * SUN.scale;
    const oy = SUN.y * h * SUN.scale;
    const pts = [
      { x: b.x, y: b.y }, { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h },
      { x: b.x + ox, y: b.y + oy }, { x: b.x + b.w + ox, y: b.y + oy },
      { x: b.x + b.w + ox, y: b.y + b.h + oy }, { x: b.x + ox, y: b.y + b.h + oy },
    ];
    b._shadow = convexHull(pts);
    return b._shadow;
  }

  render(ctx, game) {
    const cam = game.camera;
    const city = this.city;
    cam.applyUI(ctx);
    ctx.fillStyle = '#0a0b0d';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    cam.apply(ctx);

    const view = cam.bounds(140);

    // 1) Terreno
    this.ground.draw(ctx, cam);

    // 2) Decalcomanie sul terreno (sangue, gomma, rottami piatti), chiodi, pozze
    // di fuoco e mine: tutto quello che è *sull'* asfalto e non sopra.
    if (game.fx) game.fx.drawDecals(ctx);
    if (game.police) this.drawSpikes(ctx, game);
    if (game.projectiles) {
      this.drawFires(ctx, game);
      this.drawMines(ctx, game, cam);
    }

    // 3) Ombre proiettate
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    const buildings = city.buildingGrid.queryRect(view.x, view.y, view.w, view.h, this._bq);
    for (const b of buildings) {
      if (b.isBelt) continue;
      const hull = this.buildingShadow(b);
      ctx.beginPath();
      ctx.moveTo(hull[0].x, hull[0].y);
      for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
      ctx.closePath();
      ctx.fill();
    }
    this.entityShadows(ctx, game);

    // 4) Semafori a terra, segnaletica luminosa, soglie dei negozi e piazzole
    // delle officine: tutto quello che è dipinto *sull'* asfalto.
    this.drawSignals(ctx, cam, game.time);
    this.drawThresholds(ctx, game, buildings);

    // 5) Oggetti alti ordinati per profondità radiale
    const list = this.list;
    list.length = 0;
    const ccx = cam.cx, ccy = cam.cy;

    for (const b of buildings) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      list.push({ t: 0, o: b, d: (cx - ccx) ** 2 + (cy - ccy) ** 2 });
    }
    const props = city.propGrid.queryRect(view.x, view.y, view.w, view.h, this._pq);
    for (const p of props) {
      const o = p.prop;
      list.push({ t: 1, o, d: (o.x - ccx) ** 2 + (o.y - ccy) ** 2 });
    }
    const flying = this._fq;
    flying.length = 0;
    for (const v of game.vehicles) {
      if (v.x < view.x || v.x > view.x + view.w || v.y < view.y || v.y > view.y + view.h) continue;
      if (airborne(v)) { flying.push(v); continue; }
      list.push({ t: 2, o: v, d: (v.x - ccx) ** 2 + (v.y - ccy) ** 2 });
    }
    for (const p of game.peds) {
      if (p.x < view.x || p.x > view.x + view.w || p.y < view.y || p.y > view.y + view.h) continue;
      list.push({ t: 3, o: p, d: (p.x - ccx) ** 2 + (p.y - ccy) ** 2 });
    }
    if (game.player.onFoot) {
      list.push({ t: 4, o: game.player, d: (game.player.x - ccx) ** 2 + (game.player.y - ccy) ** 2 });
    }
    if (game.pickups) {
      for (const it of game.pickups.visible(view, this._kq)) {
        list.push({ t: 5, o: it, d: (it.x - ccx) ** 2 + (it.y - ccy) ** 2 });
      }
    }

    list.sort((a, b) => b.d - a.d);

    for (const item of list) {
      switch (item.t) {
        case 0: this.drawBuilding(ctx, item.o, cam); break;
        case 1: this.drawProp(ctx, item.o, cam, game); break;
        case 2: this.drawVehicle(ctx, item.o, cam, game); break;
        case 3: this.drawPed(ctx, item.o, cam); break;
        case 4: this.drawPlayer(ctx, game.player, cam, game); break;
        case 5: this.drawPickup(ctx, item.o, cam, game); break;
      }
    }

    // 6) Transenne dei posti di blocco ed elicottero: stanno sopra tutto il resto
    // (le prime sono basse ma nascono a runtime, il secondo vola a 210 px di quota).
    for (const v of flying) this.drawVehicle(ctx, v, cam, game);
    if (game.police) {
      this.drawRoadblocks(ctx, game, cam);
      this.drawChopper(ctx, game, cam);
    }
    // Esplosivi in volo: hanno una quota, quindi vanno dopo tutto quello che sta a terra.
    if (game.projectiles) this.drawThrown(ctx, game, cam);

    // 7) Effetti sopra il mondo (proiettili, fuoco, particelle)
    if (game.fx) game.fx.draw(ctx, cam, game.time);
  }

  entityShadows(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    const drawShadow = (x, y, rx, ry, ang, z) => {
      const ox = SUN.x * z * SUN.scale;
      const oy = SUN.y * z * SUN.scale;
      ctx.beginPath();
      ctx.ellipse(x + ox, y + oy, rx, ry, ang, 0, 6.2832);
      ctx.fill();
    };
    for (const v of game.vehicles) {
      const s = VEHICLE_TYPES[v.kind];
      drawShadow(v.x, v.y, s.len * 0.48, s.wid * 0.5, v.angle, 14 + (v.z || 0));
    }
    for (const p of game.peds) drawShadow(p.x, p.y, 8, 7, 0, 20);
    if (game.player.onFoot) drawShadow(game.player.x, game.player.y, 9, 8, 0, 20);
  }

  /**
   * Soglie: lo zerbino luminoso davanti a ogni porta e la piazzola dell'officina.
   * Da sopra una vetrina è indistinguibile da un muro — senza un segno a terra il
   * giocatore non saprebbe mai che in quell'edificio si entra.
   */
  drawThresholds(ctx, game, buildings) {
    const pl = game.player;
    for (const b of buildings) {
      if (!b.shop) continue;
      const s = b.shop;
      const near = (s.x - pl.x) ** 2 + (s.y - pl.y) ** 2 < 210 * 210;
      const biz = SHOP_BIZ[s.biz[0]];
      const col = biz ? biz.pal.accent : '#ffd23f';
      const w = s.nx ? 15 : 34;
      const h = s.nx ? 34 : 15;
      ctx.save();
      // Gradino scuro col filo di neon del locale: si legge come una soglia, non
      // come una macchia di vernice.
      ctx.fillStyle = 'rgba(16,18,22,0.55)';
      ctx.fillRect(s.x - w / 2, s.y - h / 2, w, h);
      ctx.globalAlpha = near ? 0.7 + 0.3 * Math.sin(game.time * 3.4) : 0.42;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - w / 2 + 1, s.y - h / 2 + 1, w - 2, h - 2);
      ctx.globalAlpha = near ? 0.14 : 0.05;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 32, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }
    // Piazzola dell'officina: strisce gialle da carrozzeria, si legge da lontano.
    for (const g of this.city.garages) {
      if (g.cx < game.camera.cx - 900 || g.cx > game.camera.cx + 900) continue;
      ctx.save();
      ctx.fillStyle = 'rgba(24,26,30,0.55)';
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.strokeStyle = 'rgba(255,210,63,0.75)';
      ctx.lineWidth = 3;
      ctx.strokeRect(g.x + 2, g.y + 2, g.w - 4, g.h - 4);
      ctx.fillStyle = 'rgba(255,210,63,0.16)';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(g.x + 4 + i * (g.w - 8) / 6, g.y + 4, (g.w - 8) / 12, g.h - 8);
      }
      ctx.restore();
    }
  }

  drawSignals(ctx, cam, time) {
    const city = this.city;
    const view = cam.bounds(60);
    for (const n of city.intersections) {
      if (n.x < view.x || n.x > view.x + view.w || n.y < view.y || n.y > view.y + view.h) continue;
      const node = city.graph.nodes.find((g) => g.vi === n.vi && g.hi === n.hi);
      if (!node || !node.signal) continue;
      const ph = signalAxis(node, time);
      const vGreen = ph === 'v';
      const vYellow = ph === 'v-yellow';
      const hGreen = ph === 'h';
      const hYellow = ph === 'h-yellow';
      const colV = vGreen ? '#3ce07a' : vYellow ? '#e8c33a' : '#e04a3a';
      const colH = hGreen ? '#3ce07a' : hYellow ? '#e8c33a' : '#e04a3a';
      const hx = n.vw / 2 + 12;
      const hy = n.hw / 2 + 12;
      const lamp = (x, y, col) => {
        ctx.fillStyle = 'rgba(20,22,26,0.85)';
        ctx.fillRect(x - 7, y - 4, 14, 8);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, 6.2832);
        ctx.fill();
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 6.2832);
        ctx.fill();
        ctx.globalAlpha = 1;
      };
      lamp(n.x - hx, n.y - hy, colV);
      lamp(n.x + hx, n.y + hy, colV);
      lamp(n.x + hx, n.y - hy, colH);
      lamp(n.x - hx, n.y + hy, colH);
    }
  }

  drawBuilding(ctx, b, cam) {
    const h3d = projHeight(b);
    const f = h3d / PROJ;
    const bcx = b.x + b.w / 2;
    const bcy = b.y + b.h / 2;
    const ox = (bcx - cam.cx) * f;
    const oy = (bcy - cam.cy) * f;

    const rows = bucketRows(h3d);
    const stackVariant = b.style === 'container' ? b.variant : b.variant;

    // Facciata verticale visibile (nord/sud) e orizzontale (est/ovest)
    const faces = [];
    if (oy < -0.5) faces.push({ side: 'bottom', px: b.x, py: b.y + b.h, ex: b.w, ey: 0, len: b.w });
    else if (oy > 0.5) faces.push({ side: 'top', px: b.x, py: b.y, ex: b.w, ey: 0, len: b.w });
    if (ox < -0.5) faces.push({ side: 'right', px: b.x + b.w, py: b.y, ex: 0, ey: b.h, len: b.h });
    else if (ox > 0.5) faces.push({ side: 'left', px: b.x, py: b.y, ex: 0, ey: b.h, len: b.h });

    for (const face of faces) {
      const cols = bucketCols(face.len);
      const tex = facadeTexture(b.style, cols, rows, stackVariant);
      ctx.save();
      ctx.transform(face.ex / FTW, face.ey / FTW, ox / FTH, oy / FTH, face.px, face.py);
      ctx.fillStyle = facadeGradient(ctx, b.color, face.side);
      ctx.fillRect(0, 0, FTW, FTH);
      ctx.drawImage(tex, 0, 0, FTW, FTH);
      ctx.restore();
    }

    // Insegne montate sulle facciate visibili. Le dimensioni sono calcolate in
    // pixel di mondo e poi riportate in spazio texture, altrimenti la mappatura
    // anisotropa (64x160 su muro x altezza) le deformerebbe.
    if (b.signs.length) {
      for (const s of b.signs) {
        const face = faces.find((fc) => fc.side === s.edge);
        if (!face) continue;
        const spr = signSprite(s.word, s.color, s.vertical);
        const hWorld = Math.min(h3d * 0.55, s.vertical ? 62 : 26);
        const wWorld = hWorld * (spr.w / spr.h);
        if (wWorld > face.len * 0.85) continue;
        const sw = (wWorld / face.len) * FTW;
        const sh = (hWorld / h3d) * FTH;
        ctx.save();
        ctx.transform(face.ex / FTW, face.ey / FTW, ox / FTH, oy / FTH, face.px, face.py);
        const sx = FTW * s.t - sw / 2;
        ctx.drawImage(
          spr.canvas,
          Math.max(1, Math.min(FTW - sw - 1, sx)),
          FTH * (0.32 + s.h * 0.52) - sh / 2,
          sw, sh
        );
        ctx.restore();
      }
    }

    // Portone e colonna di insegne. A Seoul un palazzo dichiara dalla strada cosa
    // c'è a ogni piano, una targa per piano: è pittoresco *ed* è l'unico modo che
    // ha il giocatore di sapere che dietro quella facciata ci sono quattro posti
    // diversi. Le misure si calcolano in pixel di mondo e poi si riportano in
    // spazio texture, come per le insegne normali.
    if (b.shop) {
      const face = faces.find((fc) => fc.side === b.shop.edge);
      if (face) {
        const biz = b.shop.biz;
        ctx.save();
        ctx.transform(face.ex / FTW, face.ey / FTW, ox / FTH, oy / FTH, face.px, face.py);
        const dwWorld = Math.min(face.len * 0.42, 46);
        const dhWorld = Math.min(h3d * 0.5, 26);
        const dw = (dwWorld / face.len) * FTW;
        const dh = (dhWorld / h3d) * FTH;
        ctx.fillStyle = 'rgba(10,12,16,0.92)';
        ctx.fillRect(FTW / 2 - dw / 2, 0, dw, dh);
        const glow = SHOP_BIZ[biz[0]] ? SHOP_BIZ[biz[0]].pal.accent : '#ffd23f';
        ctx.fillStyle = glow;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(FTW / 2 - dw / 2, dh - dh * 0.12, dw, dh * 0.12);
        ctx.globalAlpha = 1;

        for (let i = 0; i < biz.length; i++) {
          const spec = SHOP_BIZ[biz[i]];
          if (!spec) continue;
          const spr = signSprite(spec.hangul, spec.pal.accent, false);
          let hWorld = Math.min((h3d * 0.62) / biz.length, 17);
          let wWorld = hWorld * (spr.w / spr.h);
          if (wWorld > face.len * 0.82) {
            wWorld = face.len * 0.82;
            hWorld = wWorld / (spr.w / spr.h);
          }
          const sw = (wWorld / face.len) * FTW;
          const sh = (hWorld / h3d) * FTH;
          ctx.drawImage(
            spr.canvas,
            FTW / 2 - sw / 2,
            FTH * (0.26 + (i + 0.5) * (0.66 / biz.length)) - sh / 2,
            sw, sh
          );
        }
        ctx.restore();
      }
    }

    // Saracinesca dell'officina: la stessa idea, ma larga come una macchina.
    if (b.garage) {
      const g = this.city.garages.find((q) => q.building === b);
      const face = g ? faces.find((fc) => fc.side === g.edge) : null;
      if (face) {
        ctx.save();
        ctx.transform(face.ex / FTW, face.ey / FTW, ox / FTH, oy / FTH, face.px, face.py);
        const dw = (Math.min(face.len * 0.7, 74) / face.len) * FTW;
        const dh = (Math.min(h3d * 0.6, 34) / h3d) * FTH;
        ctx.fillStyle = 'rgba(34,37,42,0.95)';
        ctx.fillRect(FTW / 2 - dw / 2, 0, dw, dh);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        for (let i = 1; i < 6; i++) ctx.fillRect(FTW / 2 - dw / 2, (dh * i) / 6, dw, dh * 0.05);
        const spr = signSprite('도색', '#b48cff', false);
        const sw = dw * 0.6;
        ctx.drawImage(spr.canvas, FTW / 2 - sw / 2, dh + 4, sw, (sw / (spr.w / spr.h)));
        ctx.restore();
      }
    }

    // Tetto
    const rx = b.x + ox;
    const ry = b.y + oy;
    ctx.fillStyle = b.roofColor;
    ctx.fillRect(rx, ry, b.w, b.h);
    // Parapetto: bordo chiaro sui lati verso la luce, scuro sugli altri
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(rx + 1.2, ry + 1.2, b.w - 2.4, b.h - 2.4);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(rx, ry, b.w, b.h);

    if (b.style === 'tower') {
      // Corona dell'osservatorio e antenna
      ctx.fillStyle = '#c9ccd4';
      ctx.beginPath();
      ctx.ellipse(rx + b.w / 2, ry + b.h / 2, b.w * 0.62, b.h * 0.62, 0, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = '#7f8894';
      ctx.beginPath();
      ctx.ellipse(rx + b.w / 2, ry + b.h / 2, b.w * 0.3, b.h * 0.3, 0, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = '#ff5b5b';
      ctx.beginPath();
      ctx.arc(rx + b.w / 2, ry + b.h / 2, 4, 0, 6.2832);
      ctx.fill();
      return;
    }
    if (b.isBelt || b.style === 'hill') return;

    // Dettagli di tetto: unità di condizionamento, serbatoio, ghiaia
    if (b.w > 46 && b.h > 46) {
      const n = b.ac;
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / (n + 1);
        const ax = rx + b.w * (0.2 + t * 0.6);
        const ay = ry + b.h * (0.25 + ((i * 37) % 50) / 100);
        ctx.fillStyle = '#7d838b';
        ctx.fillRect(ax - 7, ay - 6, 14, 12);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ax - 7, ay - 6, 14, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(ax - 6, ay - 5, 12, 4);
      }
      if (b.water) {
        ctx.fillStyle = '#8e949c';
        ctx.beginPath();
        ctx.arc(rx + b.w * 0.78, ry + b.h * 0.75, Math.min(11, b.w * 0.12), 0, 6.2832);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      if (b.style === 'warehouse') {
        // Lucernari a shed
        ctx.fillStyle = 'rgba(150,190,215,0.22)';
        for (let x = rx + 10; x < rx + b.w - 14; x += 26) {
          ctx.fillRect(x, ry + 8, 14, b.h - 16);
        }
      }
    }
  }

  drawProp(ctx, p, cam, game) {
    const f = p.z / PROJ;
    const ox = (p.x - cam.cx) * f;
    const oy = (p.y - cam.cy) * f;
    const spr = getPropSprite(p);

    if (p.type === 'lamp') {
      // Il palo va disegnato, non stirato: lo sprite scalato deformerebbe la lampada.
      const len = Math.max(6, Math.hypot(ox, oy));
      const ang = Math.atan2(oy, ox);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillStyle = '#31363d';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 3.4, 0, 0, 6.2832);
      ctx.fill();
      ctx.strokeStyle = '#41474f';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.fillStyle = game.isNight ? '#ffe9b0' : '#9aa2ac';
      ctx.beginPath();
      ctx.ellipse(len + 2, 0, 5.5, 3, 0, 0, 6.2832);
      ctx.fill();
      if (game.isNight) {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#ffe9b0';
        ctx.beginPath();
        ctx.arc(len + 2, 0, 26, 0, 6.2832);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      return;
    }

    if (POLE_PROPS.has(p.type)) {
      // Gru portuale: il braccio si stende davvero lungo la proiezione
      const len = Math.max(spr.w * 0.5, Math.hypot(ox, oy) * 1.2);
      const ang = Math.atan2(oy, ox);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.drawImage(spr.canvas, 0, -spr.h / 2, len, spr.h);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(p.x + ox * 0.65, p.y + oy * 0.65);
    if (p.rot) ctx.rotate(p.rot);
    ctx.drawImage(spr.canvas, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
    ctx.restore();
  }

  drawVehicle(ctx, v, cam, game) {
    const spec = VEHICLE_TYPES[v.kind];
    // La quota entra nella stessa proiezione dei palazzi: è per questo che un
    // elicottero a 300 px si vede spostato rispetto alla sua ombra.
    const z = 13 + (v.z || 0);
    const f = z / PROJ;
    const ox = (v.x - cam.cx) * f;
    const oy = (v.y - cam.cy) * f;
    const spr = v.dead ? getWreckSprite(v.kind) : getVehicleSprite(v.kind, v.colorIndex);

    ctx.save();
    ctx.translate(v.x + ox, v.y + oy);
    ctx.rotate(v.angle);
    ctx.drawImage(spr.canvas, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
    ctx.restore();

    if (v.dead) return;

    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    if (spec.air) {
      this.drawRotors(ctx, v, spec, cam, game, v.x + ox, v.y + oy);
      return;
    }
    if (spec.marine) {
      this.drawWake(ctx, v, spec, game, cos, sin);
      return;
    }

    // Fari e stop
    const nose = spec.len * 0.5;
    const tail = -spec.len * 0.5;
    const side = spec.wid * 0.3;
    if (v.lightsOn) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(v.x + cos * nose, v.y + sin * nose, 2, v.x + cos * nose, v.y + sin * nose, 120);
      grad.addColorStop(0, 'rgba(255,240,200,0.35)');
      grad.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(v.x + cos * nose - sin * side, v.y + sin * nose + cos * side);
      ctx.lineTo(v.x + cos * (nose + 150) - sin * 60, v.y + sin * (nose + 150) + cos * 60);
      ctx.lineTo(v.x + cos * (nose + 150) + sin * 60, v.y + sin * (nose + 150) - cos * 60);
      ctx.lineTo(v.x + cos * nose + sin * side, v.y + sin * nose - cos * side);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (v.braking) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,60,40,0.5)';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(v.x + cos * tail - sin * side * s * 1.6, v.y + sin * tail + cos * side * s * 1.6, 6, 0, 6.2832);
        ctx.fill();
      }
      ctx.restore();
    }
    // Lampeggianti della polizia
    if (v.siren) {
      const t = game.time * 7;
      const phase = Math.sin(t) > 0;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const c1 = phase ? 'rgba(90,120,255,0.55)' : 'rgba(255,60,60,0.55)';
      const c2 = phase ? 'rgba(255,60,60,0.2)' : 'rgba(90,120,255,0.2)';
      const px = v.x - cos * 4, py = v.y - sin * 4;
      const g1 = ctx.createRadialGradient(px, py, 2, px, py, 90);
      g1.addColorStop(0, c1);
      g1.addColorStop(0.5, c2);
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(px, py, 90, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }
    // Fumo dal motore quando è danneggiato
    if (v.hp < spec.hp * 0.35) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#3a3a3a';
      const t = game.time * 3 + v.id;
      for (let i = 0; i < 3; i++) {
        const r = 6 + ((t + i * 0.7) % 1) * 14;
        ctx.beginPath();
        ctx.arc(v.x + cos * nose * 0.7 + Math.sin(t + i) * 6, v.y + sin * nose * 0.7 - Math.cos(t + i) * 6, r, 0, 6.2832);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /**
   * Pale del rotore e disco dell'elica. Non stanno nello sprite perché devono
   * girare, ed è la rotazione l'unica cosa che dice "questo è acceso": un
   * elicottero fermo con le pale ferme si legge come un rottame sul piazzale.
   */
  drawRotors(ctx, v, spec, cam, game, px, py) {
    const running = v.driver === 'player' || v.z > 0 || Math.abs(v.speed) > 4;
    const t = game.time * (running ? 26 : 1.2);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(v.angle);
    if (spec.air === 'rotor') {
      const r = spec.rotor;
      ctx.strokeStyle = `rgba(210,220,235,${running ? 0.32 : 0.6})`;
      ctx.lineWidth = running ? 2.6 : 4;
      for (let i = 0; i < 4; i++) {
        const a = t + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(spec.len * 0.12, 0);
        ctx.lineTo(spec.len * 0.12 + Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      if (running) {
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(spec.len * 0.12, 0, r, 0, 6.2832);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // Rotore di coda: due trattini che girano sul piano verticale
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-spec.len * 0.42, -Math.cos(t * 1.4) * 11);
      ctx.lineTo(-spec.len * 0.42, Math.cos(t * 1.4) * 11);
      ctx.stroke();
    } else {
      ctx.strokeStyle = `rgba(210,220,235,${running ? 0.28 : 0.5})`;
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 3; i++) {
        const a = t + (i * 2.094);
        ctx.beginPath();
        ctx.moveTo(spec.len * 0.46, 0);
        ctx.lineTo(spec.len * 0.46, Math.sin(a) * 22);
        ctx.stroke();
      }
    }
    // Luce anticollisione: la stessa dell'elicottero della polizia.
    ctx.fillStyle = Math.sin(game.time * 6) > 0 ? '#ff5b5b' : 'rgba(120,20,20,0.5)';
    ctx.beginPath();
    ctx.arc(-spec.len * 0.34, 0, 2.6, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  /** Scia di poppa: due baffi di schiuma. Senza, una barca sembra scivolare su un vetro. */
  drawWake(ctx, v, spec, game, cos, sin) {
    const sp = Math.abs(v.speed);
    if (sp < 24) return;
    const k = Math.min(1, sp / spec.topSpeed);
    const tail = -spec.len * 0.5;
    const bx = v.x + cos * tail;
    const by = v.y + sin * tail;
    ctx.save();
    ctx.globalAlpha = 0.16 + k * 0.24;
    ctx.strokeStyle = '#cfe6f2';
    ctx.lineWidth = 3 + k * 5;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const ox = -sin * spec.wid * 0.4 * s;
      const oy = cos * spec.wid * 0.4 * s;
      ctx.beginPath();
      ctx.moveTo(bx + ox, by + oy);
      ctx.lineTo(bx + ox - cos * (40 + k * 130) - sin * 26 * s, by + oy - sin * (40 + k * 130) + cos * 26 * s);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.3 * k;
    ctx.beginPath();
    ctx.ellipse(bx - cos * 12, by - sin * 12, spec.wid * 0.5, spec.wid * 0.3, v.angle, 0, 6.2832);
    ctx.fillStyle = '#e2f0f7';
    ctx.fill();
    ctx.restore();
  }

  drawPed(ctx, p, cam) {
    const z = 20;
    const f = z / PROJ;
    const ox = (p.x - cam.cx) * f;
    const oy = (p.y - cam.cy) * f;
    const frame = p.dead ? 0 : Math.floor(p.animT) % PED_FRAMES;
    const spr = getPedSprite(p.kind, p.colorIndex, frame);
    // Chi ce l'ha con te va riconosciuto al volo: nella folla un teppista nero
    // è identico a un passante finché non ti spara.
    if ((p.hostile || p.cop) && !p.dead) {
      ctx.strokeStyle = p.cop ? 'rgba(84,132,255,0.7)' : 'rgba(226,60,52,0.75)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, 6.2832);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(p.x + ox * 0.7, p.y + oy * 0.7);
    ctx.rotate(p.angle);
    if (p.dead) {
      ctx.globalAlpha = 0.95;
      ctx.scale(1.05, 0.75);
    }
    ctx.drawImage(spr.canvas, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
    if (p.armed && !p.dead) drawHeldWeapon(ctx, p.copWeapon || 'pistol');
    ctx.restore();
  }

  drawPlayer(ctx, pl, cam, game) {
    const z = 21;
    const f = z / PROJ;
    const ox = (pl.x - cam.cx) * f;
    const oy = (pl.y - cam.cy) * f;
    const frame = pl.dying ? 0 : Math.floor(pl.animT) % PED_FRAMES;
    // Con un'arma da fuoco in pugno la posa cambia: braccia tese verso il mirino.
    const aiming = !pl.dying && !WEAPONS[pl.weapon].melee;
    const spr = getHeroSprite(frame, aiming ? 'aim' : 'walk', pl.outfit);
    ctx.save();
    ctx.translate(pl.x + ox * 0.7, pl.y + oy * 0.7);
    ctx.rotate(pl.angle);
    if (pl.dying) {
      ctx.globalAlpha = 0.95;
      ctx.scale(1.05, 0.75);
    }
    ctx.drawImage(spr.canvas, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
    // L'arma va sopra la sagoma, non sotto: è quello che si deve leggere per primo.
    if (!pl.dying) drawHeldWeapon(ctx, pl.weapon, game ? game.time * 34 * pl.spin : 0);
    ctx.restore();
  }

  /** Chiodi: piatti sull'asfalto, quindi vanno col pass delle decalcomanie. */
  drawSpikes(ctx, game) {
    for (const s of game.police.spikes) {
      const spr = getSpikeSprite(s.horiz);
      ctx.save();
      ctx.globalAlpha = Math.min(1, 0.35 + s.t * 2);
      ctx.drawImage(spr.canvas, s.x + s.w / 2 - spr.w / 2, s.y + s.h / 2 - spr.h / 2, spr.w, spr.h);
      ctx.restore();
    }
  }

  /**
   * Pozze di fuoco della molotov. Il disegno è tutto qui dentro: un alone caldo che
   * pulsa, sopra il quale `fx` fa uscire le fiamme. Le lingue di fuoco vere sono
   * particelle, così il fuoco si muove anche quando il giocatore sta fermo.
   */
  drawFires(ctx, game) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of game.projectiles.fires) {
      const fade = Math.min(1, f.life / 1.6);
      const puls = 0.86 + 0.14 * Math.sin(game.time * 7 + f.seed);
      const r = f.r * puls;
      const g = ctx.createRadialGradient(f.x, f.y, r * 0.12, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,206,110,${0.62 * fade})`);
      g.addColorStop(0.42, `rgba(238,116,28,${0.38 * fade})`);
      g.addColorStop(1, 'rgba(180,60,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Mine: piatte sull'asfalto, con il led che lampeggia solo quando sono armate. */
  drawMines(ctx, game, cam) {
    const spr = getThrownSprite('mine');
    for (const m of game.projectiles.mines) {
      ctx.drawImage(spr.canvas, m.x - spr.w / 2, m.y - spr.h / 2, spr.w, spr.h);
      const on = m.armed ? Math.sin(game.time * 6) > 0 : Math.sin(game.time * 2) > 0;
      ctx.fillStyle = m.armed
        ? (on ? '#ff4a4a' : 'rgba(120,20,20,0.5)')
        : (on ? 'rgba(230,200,80,0.9)' : 'rgba(120,100,30,0.5)');
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.9, 0, 6.2832);
      ctx.fill();
    }
  }

  /**
   * Granate e molotov in volo. Due segni bastano a leggere la parabola in una
   * visuale dall'alto: l'ombra resta a terra sotto la verticale e si stringe
   * salendo, l'oggetto si stacca in proiezione come tutto il resto.
   */
  drawThrown(ctx, game, cam) {
    for (const it of game.projectiles.items) {
      const z = Math.max(0, it.z);
      const spr = getThrownSprite(it.spec.id);
      const sh = 1 / (1 + z / 90);
      ctx.fillStyle = `rgba(0,0,0,${0.3 * sh})`;
      ctx.beginPath();
      ctx.ellipse(it.x + SUN.x * z * SUN.scale, it.y + SUN.y * z * SUN.scale, 5 * sh + 1.5, 4 * sh + 1.2, 0, 0, 6.2832);
      ctx.fill();

      const f = z / PROJ;
      ctx.save();
      ctx.translate(it.x + (it.x - cam.cx) * f, it.y + (it.y - cam.cy) * f);
      ctx.rotate(it.angle);
      ctx.drawImage(spr.canvas, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
      ctx.restore();

      // Scia della miccia: dice che quella cosa sta per esplodere.
      if (it.spec.fuse) {
        const blink = Math.sin(game.time * 22) > 0;
        ctx.fillStyle = blink ? 'rgba(255,120,60,0.9)' : 'rgba(255,220,140,0.5)';
        ctx.beginPath();
        ctx.arc(it.x + (it.x - cam.cx) * f, it.y + (it.y - cam.cy) * f - 6, 1.8, 0, 6.2832);
        ctx.fill();
      }
    }
  }

  drawRoadblocks(ctx, game, cam) {
    const spr = getPropSprite({ type: 'barrier', tint: 0 });
    for (const b of game.police.blocks) {
      for (const bar of b.barriers) {
        const cx = bar.x + bar.w / 2;
        const cy = bar.y + bar.h / 2;
        const f = 20 / PROJ;
        ctx.save();
        ctx.translate(cx + (cx - cam.cx) * f * 0.65, cy + (cy - cam.cy) * f * 0.65);
        ctx.rotate(b.vertical ? 0 : Math.PI / 2);
        ctx.drawImage(spr.canvas, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
        ctx.restore();
      }
    }
  }

  /**
   * Elicottero: ombra a terra, cono del riflettore, poi il velivolo alla sua quota
   * proiettata. Le pale girano a runtime — una pala ferma sembra un rottame.
   */
  drawChopper(ctx, game, cam) {
    const c = game.police.chopper;
    if (!c) return;
    const f = c.z / PROJ;
    const px = c.x + (c.x - cam.cx) * f;
    const py = c.y + (c.y - cam.cy) * f;

    // Riflettore
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.beamX, c.beamY, 4, c.beamX, c.beamY, 118);
    g.addColorStop(0, 'rgba(255,248,220,0.34)');
    g.addColorStop(0.55, 'rgba(255,244,200,0.13)');
    g.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.beamX, c.beamY, 118, 0, 6.2832);
    ctx.fill();
    // Fascio: dal velivolo alla macchia di luce
    ctx.strokeStyle = 'rgba(255,246,210,0.10)';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(c.beamX, c.beamY);
    ctx.stroke();
    ctx.restore();

    // Ombra sotto la verticale
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath();
    ctx.ellipse(c.x + SUN.x * c.z * SUN.scale, c.y + SUN.y * c.z * SUN.scale, 26, 12, c.angle, 0, 6.2832);
    ctx.fill();

    const spr = getChopperSprite();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(c.angle);
    ctx.drawImage(spr.canvas, -spr.w * 0.66, -spr.h / 2, spr.w, spr.h);
    // Rotore principale e di coda
    const a = game.time * 26;
    ctx.strokeStyle = 'rgba(210,220,235,0.34)';
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 4; i++) {
      const ang = a + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * 40, Math.sin(ang) * 40);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, 6.2832);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Luce anticollisione: è quello che lo fa leggere come velivolo e non come
    // una macchia scura che scivola sopra i tetti.
    ctx.fillStyle = Math.sin(game.time * 6) > 0 ? '#ff5b5b' : 'rgba(120,20,20,0.5)';
    ctx.beginPath();
    ctx.arc(-26, 0, 2.6, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  /** Raccolta a terra: alone pulsante e sagoma, così si nota da mezzo isolato. */
  drawPickup(ctx, it, cam, game) {
    const spr = getPickupSprite(it.spec.kind);
    const bob = Math.sin(game.time * 2.6 + it.x * 0.05) * 1.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(it.x, it.y, 2, it.x, it.y, 26);
    g.addColorStop(0, hexGlow(it.spec.color, 0.3));
    g.addColorStop(1, hexGlow(it.spec.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(it.x, it.y, 26, 0, 6.2832);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(spr.canvas, it.x - spr.w / 2, it.y - spr.h / 2 + bob, spr.w, spr.h);
  }
}

/**
 * Arma stretta in mano, disegnata nello spazio locale del personaggio (+x = davanti).
 * Vent'anni di pixel dicono che da sopra di un'arma si legge solo la **lunghezza**:
 * pistola corta, fucile lungo, minigun larga. Il resto è decorazione.
 */
function drawHeldWeapon(ctx, id, phase = 0) {
  if (!id || id === 'fists') return;
  ctx.fillStyle = '#14161a';
  switch (id) {
    case 'bat':
      ctx.fillStyle = '#8a6a42';
      ctx.fillRect(3, 3.4, 16, 2.6);
      ctx.fillRect(13, 2.6, 6, 4.2);
      break;
    case 'katana':
      ctx.fillStyle = '#1c2026';
      ctx.fillRect(2, 3.6, 5, 2.4);
      ctx.fillStyle = '#dfe6ef';
      ctx.beginPath();
      ctx.moveTo(7, 3.4);
      ctx.lineTo(23, 1.6);
      ctx.lineTo(23.6, 3);
      ctx.lineTo(7, 5.6);
      ctx.closePath();
      ctx.fill();
      break;
    case 'smg':
      ctx.fillRect(2, 3.2, 13, 3);
      ctx.fillRect(6, 6, 2.8, 4.4);
      break;
    case 'shotgun':
      ctx.fillRect(1, 3.4, 18, 2.6);
      ctx.fillStyle = '#6b4a2e';
      ctx.fillRect(1, 3.2, 6, 3);
      break;
    case 'rifle':
      ctx.fillRect(0, 3.4, 21, 2.6);
      ctx.fillRect(8, 6, 3.4, 4.6);
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(0, 3, 5, 3.4);
      break;
    case 'sniper':
      ctx.fillRect(-1, 3.6, 26, 2.2);
      ctx.fillStyle = '#0e1013';
      ctx.fillRect(7, 1.4, 8, 2);
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(-1, 3.2, 6, 3);
      break;
    case 'minigun': {
      ctx.fillStyle = '#2a2f36';
      ctx.fillRect(1, 1.6, 8, 7.6);
      // Canne che girano: la fase arriva dallo spin-up, quindi da fermo stanno ferme.
      for (let i = 0; i < 3; i++) {
        const y = 5 + Math.sin(phase + (i * Math.PI * 2) / 3) * 3;
        ctx.fillStyle = i === 0 ? '#12141a' : '#1c1f26';
        ctx.fillRect(8, y - 1, 15, 2);
      }
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(-2, 3.4, 4, 3.4);
      break;
    }
    case 'molotov':
      ctx.fillStyle = '#3f6b4a';
      ctx.fillRect(6, 3, 5, 4);
      ctx.fillStyle = '#ffb03a';
      ctx.beginPath();
      ctx.arc(12.4, 5, 1.8, 0, 6.2832);
      ctx.fill();
      break;
    case 'grenade':
      ctx.fillStyle = '#3f4a35';
      ctx.beginPath();
      ctx.ellipse(8, 5, 3, 3.4, 0, 0, 6.2832);
      ctx.fill();
      break;
    case 'mine':
      ctx.fillStyle = '#2c3138';
      ctx.beginPath();
      ctx.ellipse(8, 5, 4, 3, 0, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = '#c33a33';
      ctx.beginPath();
      ctx.arc(8, 5, 1.1, 0, 6.2832);
      ctx.fill();
      break;
    default:
      ctx.fillRect(3, 3.4, 9, 2.8);
      ctx.fillRect(5, 6, 2.6, 3.6);
  }
}

function hexGlow(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
