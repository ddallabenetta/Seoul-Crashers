// Renderer degli interni. Stessa proiezione del mondo esterno — un volume si
// estrude *verso l'esterno dello schermo* in base alla sua altezza — applicata a
// una stanza invece che a un isolato.
//
// È quello che rende leggibile un interno visto dall'alto: i muri perimetrali si
// aprono verso fuori (sono i più lontani dal centro camera) e quindi non coprono
// mai la stanza, mentre bancone, scaffali e tavoli si staccano dal pavimento
// quanto basta a dire "ci si gira intorno". Con un disegno piatto sarebbe una
// pianta catastale.
import { PROJ, SUN } from './camera.js';
import { WALL } from '../world/interiors.js';
import { shade, rgba } from './sprites.js';

const WALL_H = 56;

export class InteriorScene {
  constructor(scene) {
    this.scene = scene; // per pedoni, giocatore e armi in pugno: già scritti una volta
    this.list = [];
  }

  render(ctx, game) {
    const cam = game.camera;
    const it = game.shops.active;
    const f = game.shops.floor;
    const pal = f.biz.pal;

    cam.applyUI(ctx);
    ctx.fillStyle = '#07080a';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    cam.apply(ctx);

    this.drawFloor(ctx, f, pal, game);
    if (f.stairUp) this.drawStairs(ctx, f.stairUp, pal, 1);
    if (f.stairDown) this.drawStairs(ctx, f.stairDown, pal, -1);
    if (f.idx === 0) this.drawMat(ctx, f, pal, game);

    // Ombre a terra, tutte in un pass prima dei volumi (come in scene.js).
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (const p of f.people) shadowEllipse(ctx, p.x, p.y, 8, 7, 20);
    if (game.player.onFoot) shadowEllipse(ctx, game.player.x, game.player.y, 9, 8, 20);
    if (game.fx) game.fx.drawDecals(ctx);
    // Pozze di fuoco e mine stanno *sull'* impiantito, come sull'asfalto: stesso
    // pass e stesso codice del mondo esterno.
    this.scene.drawFires(ctx, game);
    this.scene.drawMines(ctx, game, cam);

    // Ordinamento radiale: lontano dal centro camera = lontano dall'occhio.
    const list = this.list;
    list.length = 0;
    const ccx = cam.cx, ccy = cam.cy;
    for (const w of f.walls) list.push({ t: 0, o: w, d: (w.x + w.w / 2 - ccx) ** 2 + (w.y + w.h / 2 - ccy) ** 2 });
    for (const o of f.furni) list.push({ t: 1, o, d: (o.x + o.w / 2 - ccx) ** 2 + (o.y + o.h / 2 - ccy) ** 2 });
    for (const p of f.people) list.push({ t: 2, o: p, d: (p.x - ccx) ** 2 + (p.y - ccy) ** 2 });
    if (game.player.onFoot) list.push({ t: 3, o: game.player, d: (game.player.x - ccx) ** 2 + (game.player.y - ccy) ** 2 });
    list.sort((a, b) => b.d - a.d);

    for (const item of list) {
      switch (item.t) {
        case 0: this.drawWall(ctx, item.o, cam, pal); break;
        case 1: this.drawFurniture(ctx, item.o, cam, pal, game); break;
        case 2: this.scene.drawPed(ctx, item.o, cam); break;
        case 3: this.scene.drawPlayer(ctx, game.player, cam, game); break;
      }
    }

    this.scene.drawThrown(ctx, game, cam);
    if (game.fx) game.fx.draw(ctx, cam, game.time);
  }

  drawFloor(ctx, f, pal, game) {
    ctx.fillStyle = pal.floor;
    ctx.fillRect(0, 0, f.w, f.h);
    // Piastrelle: il passo regolare è l'unico riferimento di scala che c'è dentro
    // una stanza vuota.
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = WALL; x < f.w; x += 32) { ctx.moveTo(x, WALL); ctx.lineTo(x, f.h - WALL); }
    for (let y = WALL; y < f.h; y += 32) { ctx.moveTo(WALL, y); ctx.lineTo(f.w - WALL, y); }
    ctx.stroke();
    // Neon al soffitto: una banda chiara al centro e l'ombra lungo le pareti.
    const g = ctx.createRadialGradient(f.w / 2, f.h / 2, 10, f.w / 2, f.h / 2, Math.max(f.w, f.h) * 0.62);
    g.addColorStop(0, rgba(pal.accent, 0.09));
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, f.w, f.h);
  }

  /** Zerbino e freccia: la porta deve saltare all'occhio appena si entra. */
  drawMat(ctx, f, pal, game) {
    const e = f.entry;
    ctx.fillStyle = rgba(pal.accent, 0.22);
    ctx.fillRect(e.x - 30, f.h - WALL, 60, 12);
    ctx.fillStyle = 'rgba(20,22,26,0.5)';
    ctx.fillRect(e.x - 26, e.y - 6, 52, 18);
    ctx.fillStyle = rgba(pal.accent, 0.5 + 0.25 * Math.sin(game.time * 3));
    ctx.beginPath();
    ctx.moveTo(e.x, e.y + 12);
    ctx.lineTo(e.x - 7, e.y + 3);
    ctx.lineTo(e.x + 7, e.y + 3);
    ctx.closePath();
    ctx.fill();
  }

  drawStairs(ctx, s, pal, dir) {
    ctx.fillStyle = shade(pal.wall, -0.25);
    ctx.fillRect(s.x, s.y, s.w, s.h);
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const y = s.y + s.h * (dir > 0 ? t : 1 - t - 1 / steps);
      ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.09 * (dir > 0 ? 1 - t : t)})`;
      ctx.fillRect(s.x + 3, y + 1, s.w - 6, s.h / steps - 2);
    }
    ctx.strokeStyle = rgba(pal.accent, 0.55);
    ctx.lineWidth = 1.6;
    ctx.strokeRect(s.x + 0.8, s.y + 0.8, s.w - 1.6, s.h - 1.6);
    // Freccia su/giù: due scale nello stesso angolo devono distinguersi al volo.
    ctx.fillStyle = rgba(pal.accent, 0.8);
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - dir * 9);
    ctx.lineTo(cx - 7, cy + dir * 4);
    ctx.lineTo(cx + 7, cy + dir * 4);
    ctx.closePath();
    ctx.fill();
  }

  drawWall(ctx, w, cam, pal) {
    drawBox(ctx, w, cam, WALL_H, pal.wall, pal.trim);
  }

  drawFurniture(ctx, o, cam, pal, game) {
    const spec = FURNITURE[o.type] || FURNITURE.shelf;
    const body = spec.color || pal.trim;
    drawBox(ctx, o, cam, o.z, body, spec.top || shade(body, 0.2));
    const f = o.z / PROJ;
    const rx = o.x + (o.x + o.w / 2 - cam.cx) * f;
    const ry = o.y + (o.y + o.h / 2 - cam.cy) * f;
    if (spec.detail) {
      ctx.save();
      spec.detail(ctx, rx, ry, o.w, o.h, pal, game);
      ctx.restore();
    }
  }
}

// --- primitive ---------------------------------------------------------------

function shadowEllipse(ctx, x, y, rx, ry, z) {
  ctx.beginPath();
  ctx.ellipse(x + SUN.x * z * SUN.scale, y + SUN.y * z * SUN.scale, rx, ry, 0, 0, 6.2832);
  ctx.fill();
}

/** Quadrilatero di una faccia laterale estrusa da (ax,ay)-(bx,by). */
function face(ctx, ax, ay, bx, by, ox, oy, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + ox, by + oy);
  ctx.lineTo(ax + ox, ay + oy);
  ctx.closePath();
  ctx.fill();
}

/**
 * Volume basso: due facce laterali al massimo (le stesse regole di
 * `scene.drawBuilding`) più la faccia superiore traslata in proiezione.
 */
function drawBox(ctx, o, cam, z, sideColor, topColor) {
  const f = z / PROJ;
  const ox = (o.x + o.w / 2 - cam.cx) * f;
  const oy = (o.y + o.h / 2 - cam.cy) * f;
  const dark = shade(sideColor, -0.3);
  const lit = shade(sideColor, 0.12);
  if (oy < -0.5) face(ctx, o.x, o.y + o.h, o.x + o.w, o.y + o.h, ox, oy, dark);
  else if (oy > 0.5) face(ctx, o.x, o.y, o.x + o.w, o.y, ox, oy, lit);
  if (ox < -0.5) face(ctx, o.x + o.w, o.y, o.x + o.w, o.y + o.h, ox, oy, dark);
  else if (ox > 0.5) face(ctx, o.x, o.y, o.x, o.y + o.h, ox, oy, lit);

  ctx.fillStyle = topColor;
  ctx.fillRect(o.x + ox, o.y + oy, o.w, o.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(o.x + ox, o.y + oy, o.w, o.h);
}

// --- arredo ------------------------------------------------------------------
// Ogni voce disegna solo il *piano* del mobile: il volume lo ha già fatto drawBox.
// Da sopra è l'unica cosa che si vede, ed è quella che dice cos'è.

const bars = (ctx, x, y, w, h, colors) => {
  const n = Math.max(1, Math.floor(w / 9));
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x + 2 + i * (w - 4) / n, y + 2.5, (w - 4) / n - 1.6, h - 5);
  }
};

const FURNITURE = {
  shelf: {
    color: '#6b6259',
    detail: (ctx, x, y, w, h) => bars(ctx, x, y, w, h, ['#b4553f', '#4a7fa8', '#c9a24a', '#5f9a6a', '#a8607f']),
  },
  rack: {
    color: '#4a4038',
    top: '#2f2a25',
    // Rastrelliera: canne scure allineate. Da sopra un'arma è una linea, punto.
    detail: (ctx, x, y, w, h) => {
      ctx.fillStyle = '#14161a';
      const n = Math.max(2, Math.floor(w / 12));
      for (let i = 0; i < n; i++) ctx.fillRect(x + 4 + i * (w - 8) / n, y + 2, 2.4, h - 4);
      ctx.fillStyle = 'rgba(255,214,80,0.35)';
      ctx.fillRect(x + 2, y + h - 3, w - 4, 1.4);
    },
  },
  rail: {
    color: '#5d5566',
    top: '#3f3947',
    detail: (ctx, x, y, w, h) => bars(ctx, x, y, w, h, ['#c2607a', '#5f7fc2', '#d9c07a', '#6ac2a0', '#8f6ac2']),
  },
  fridge: {
    color: '#5a6068',
    top: '#7fa9bd',
    detail: (ctx, x, y, w, h) => {
      ctx.fillStyle = 'rgba(200,240,255,0.3)';
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.strokeStyle = 'rgba(20,30,40,0.6)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (w * i) / 3, y + 2);
        ctx.lineTo(x + (w * i) / 3, y + h - 2);
        ctx.stroke();
      }
    },
  },
  counter: {
    color: '#6a5c4c',
    top: '#8b7a63',
    detail: (ctx, x, y, w, h) => {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + 1.5, y + 1.5, w - 3, 2.4);
    },
  },
  till: {
    color: '#2f343c',
    top: '#3c434d',
    detail: (ctx, x, y, w, h) => {
      ctx.fillStyle = '#7ef0b0';
      ctx.fillRect(x + 3, y + 3, w - 6, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x + 3, y + 9, w - 6, 2);
    },
  },
  kitchen: {
    color: '#5e6266',
    top: '#8f959b',
    detail: (ctx, x, y, w, h) => {
      ctx.fillStyle = '#22262b';
      const n = Math.max(1, Math.floor(w / 26));
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(x + (w * (i + 0.5)) / n, y + h / 2, Math.min(6, h / 2 - 2), 0, 6.2832);
        ctx.fill();
      }
    },
  },
  table: {
    color: '#7a5a3c',
    top: '#96826a',
    detail: (ctx, x, y, w, h, pal) => {
      ctx.fillStyle = '#e8e2d4';
      ctx.beginPath();
      ctx.arc(x + w * 0.32, y + h / 2, 5, 0, 6.2832);
      ctx.arc(x + w * 0.68, y + h / 2, 5, 0, 6.2832);
      ctx.fill();
    },
  },
  stool: { color: '#4d4a46', top: '#635e57' },
  chair: { color: '#3e434b', top: '#525963' },
  desk: {
    color: '#5d5a54',
    top: '#767169',
    detail: (ctx, x, y, w, h) => {
      ctx.fillStyle = '#2a2f36';
      ctx.fillRect(x + w - 16, y + 3, 12, h - 6);
      ctx.fillStyle = '#e6e2d8';
      ctx.fillRect(x + 4, y + 5, 14, h - 10);
    },
  },
  pc: {
    color: '#343a44',
    top: '#454d5a',
    // Monitor acceso: il blu freddo di un 피시방 è metà della sua identità.
    detail: (ctx, x, y, w, h, pal, game) => {
      const puls = 0.6 + 0.25 * Math.sin((game ? game.time : 0) * 3 + x);
      ctx.fillStyle = '#101418';
      ctx.fillRect(x + w - 15, y + 2, 12, h - 4);
      ctx.fillStyle = `rgba(56,214,255,${puls})`;
      ctx.fillRect(x + w - 13.5, y + 3.5, 9, h - 7);
      ctx.fillStyle = '#20252c';
      ctx.fillRect(x + 3, y + h / 2 - 3, 20, 6);
    },
  },
  pool: {
    color: '#3f4a42',
    top: '#2f7a52',
    detail: (ctx, x, y, w, h) => {
      ctx.strokeStyle = '#6b4a2e';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.fillStyle = '#f2efe6';
      ctx.beginPath();
      ctx.arc(x + w * 0.3, y + h * 0.5, 2.6, 0, 6.2832);
      ctx.fill();
      for (const [dx, dy, c] of [[0.6, 0.4, '#c9452f'], [0.66, 0.56, '#e0c33a'], [0.72, 0.45, '#2f4fc9']]) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + w * dx, y + h * dy, 2.6, 0, 6.2832);
        ctx.fill();
      }
    },
  },
  bed: {
    color: '#6b6152',
    top: '#c8c3b6',
    detail: (ctx, x, y, w, h) => {
      ctx.fillStyle = '#eceade';
      ctx.fillRect(x + 2, y + 2, w - 4, Math.min(10, h * 0.3));
      ctx.fillStyle = 'rgba(70,90,120,0.35)';
      ctx.fillRect(x + 2, y + h * 0.42, w - 4, h * 0.55);
    },
  },
  sofa: {
    color: '#5a3f4a',
    top: '#75505f',
    detail: (ctx, x, y, w, h) => {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 1; i < 3; i++) ctx.fillRect(x + (w * i) / 3, y + 2, 1.4, h - 4);
    },
  },
  tv: {
    color: '#1d2026',
    top: '#12151a',
    detail: (ctx, x, y, w, h, pal, game) => {
      const puls = 0.35 + 0.3 * Math.sin((game ? game.time : 0) * 5 + y);
      ctx.fillStyle = rgba(pal.accent, puls);
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    },
  },
  plant: {
    color: '#4a463f',
    top: '#3f6b40',
    detail: (ctx, x, y, w, h) => {
      ctx.fillStyle = '#4f8a4a';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.46, 0, 6.2832);
      ctx.fill();
    },
  },
};
