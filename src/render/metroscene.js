// Interno dedicato della metropolitana. Non è uno sfondo dietro a un menu: usa
// la stessa camera, le stesse collisioni e lo stesso personaggio degli altri
// interni, ma mette in scena atrio, tornelli, banchina, binari e convoglio.
import { PROJ, SUN } from './camera.js';
import { shade } from './sprites.js';

function shadow(ctx, x, y, rx, ry, z) {
  ctx.beginPath();
  ctx.ellipse(x + SUN.x * z * SUN.scale, y + SUN.y * z * SUN.scale, rx, ry, 0, 0, 6.2832);
  ctx.fill();
}

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

function drawBox(ctx, o, cam, body, top) {
  const z = o.z || 24;
  const f = z / PROJ;
  const ox = (o.x + o.w / 2 - cam.cx) * f;
  const oy = (o.y + o.h / 2 - cam.cy) * f;
  if (oy < -0.5) face(ctx, o.x, o.y + o.h, o.x + o.w, o.y + o.h, ox, oy, shade(body, -0.3));
  else if (oy > 0.5) face(ctx, o.x, o.y, o.x + o.w, o.y, ox, oy, shade(body, 0.12));
  if (ox < -0.5) face(ctx, o.x + o.w, o.y, o.x + o.w, o.y + o.h, ox, oy, shade(body, -0.28));
  else if (ox > 0.5) face(ctx, o.x, o.y, o.x, o.y + o.h, ox, oy, shade(body, 0.08));
  ctx.fillStyle = top;
  ctx.fillRect(o.x + ox, o.y + oy, o.w, o.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.42)';
  ctx.lineWidth = 1;
  ctx.strokeRect(o.x + ox, o.y + oy, o.w, o.h);
  return { x: o.x + ox, y: o.y + oy };
}

export class MetroScene {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  render(ctx, game) {
    const cam = game.camera;
    const floor = game.metro.floor;
    const pal = floor.biz.pal;
    cam.applyUI(ctx);
    ctx.fillStyle = '#05080b';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    cam.apply(ctx);

    this.drawFloor(ctx, floor, pal, game);
    this.drawTracks(ctx, floor, game);
    this.drawTrain(ctx, floor, game);
    this.drawEntrance(ctx, floor, game);
    this.drawSigns(ctx, floor, game);

    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    for (const o of [...floor.walls, ...floor.furni]) {
      shadow(ctx, o.x + o.w / 2, o.y + o.h / 2, Math.max(5, o.w / 2), Math.max(4, o.h / 2), o.z || 24);
    }
    if (game.player.onFoot) shadow(ctx, game.player.x, game.player.y, 9, 8, 20);
    if (game.fx) game.fx.drawDecals(ctx);
    this.scene.drawFires(ctx, game);
    this.scene.drawMines(ctx, game, cam);

    const list = this.list;
    list.length = 0;
    for (const o of floor.walls) list.push({ type: 'wall', o, d: this.depth(o, cam) });
    for (const o of floor.furni) list.push({ type: 'furni', o, d: this.depth(o, cam) });
    if (game.player.onFoot) {
      list.push({ type: 'player', o: game.player, d: (game.player.x - cam.cx) ** 2 + (game.player.y - cam.cy) ** 2 });
    }
    list.sort((a, b) => b.d - a.d);
    for (const item of list) {
      if (item.type === 'player') this.scene.drawPlayer(ctx, game.player, cam, game);
      else this.drawFixture(ctx, item.o, cam, pal, game);
    }

    this.scene.drawThrown(ctx, game, cam);
    if (game.fx) game.fx.draw(ctx, cam, game.time);
  }

  depth(o, cam) {
    return (o.x + o.w / 2 - cam.cx) ** 2 + (o.y + o.h / 2 - cam.cy) ** 2;
  }

  drawFloor(ctx, f, pal, game) {
    ctx.fillStyle = pal.floor;
    ctx.fillRect(0, 0, f.w, f.h);
    // Piastrelle dell'atrio.
    ctx.strokeStyle = 'rgba(220,235,245,0.075)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 18; x < f.w - 18; x += 36) { ctx.moveTo(x, 18); ctx.lineTo(x, 544); }
    for (let y = 18; y < 544; y += 36) { ctx.moveTo(18, y); ctx.lineTo(f.w - 18, y); }
    ctx.stroke();

    // Fasce che leggono subito come atrio, varchi e banchina.
    ctx.fillStyle = 'rgba(65,190,242,0.10)';
    ctx.fillRect(216, 216, 648, 112);
    ctx.fillStyle = 'rgba(235,196,54,0.24)';
    ctx.fillRect(18, 516, f.w - 36, 18);
    ctx.fillStyle = '#d8bd36';
    for (let x = 28; x < f.w - 30; x += 22) ctx.fillRect(x, 520, 12, 3);

    // Frecce di percorso: ingresso -> tornelli -> banchina.
    const pulse = 0.48 + 0.24 * Math.sin(game.time * 3);
    ctx.fillStyle = `rgba(72,200,255,${pulse})`;
    for (const y of [150, 196, 342, 388]) {
      ctx.beginPath();
      ctx.moveTo(540, y + 15);
      ctx.lineTo(528, y - 2);
      ctx.lineTo(552, y - 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawTracks(ctx, f, game) {
    ctx.fillStyle = '#15191e';
    ctx.fillRect(18, 558, f.w - 36, f.h - 576);
    ctx.fillStyle = '#423d37';
    for (let x = 28; x < f.w - 28; x += 34) ctx.fillRect(x, 570, 18, 132);
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(18, 584, f.w - 36, 7);
    ctx.fillRect(18, 680, f.w - 36, 7);
    ctx.fillStyle = `rgba(72,200,255,${0.14 + 0.05 * Math.sin(game.time * 2)})`;
    ctx.fillRect(18, 558, f.w - 36, 3);
  }

  drawTrain(ctx, f, game) {
    const x = 54;
    const y = 590;
    const w = f.w - 108;
    const h = 84;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#d7dde2');
    g.addColorStop(0.55, '#8d9aa4');
    g.addColorStop(1, '#53616c');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#235e91';
    ctx.fillRect(x, y + 48, w, 13);
    ctx.fillStyle = '#18242d';
    for (let wx = x + 28; wx < x + w - 30; wx += 92) {
      ctx.fillRect(wx, y + 12, 54, 28);
      ctx.fillStyle = 'rgba(120,215,255,0.17)';
      ctx.fillRect(wx + 3, y + 15, 48, 9);
      ctx.fillStyle = '#18242d';
    }
    // Porte allineate al punto d'imbarco.
    for (const dx of [-210, 0, 210]) {
      const px = f.trainDoor.x + dx - 34;
      ctx.fillStyle = '#b9c4cc';
      ctx.fillRect(px, y + 6, 68, h - 10);
      ctx.strokeStyle = '#4c5963';
      ctx.strokeRect(px, y + 6, 68, h - 10);
      ctx.beginPath();
      ctx.moveTo(px + 34, y + 7);
      ctx.lineTo(px + 34, y + h - 5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(72,200,255,0.24)';
      ctx.fillRect(px + 7, y + 12, 22, 24);
      ctx.fillRect(px + 39, y + 12, 22, 24);
    }
    const blink = Math.sin(game.time * 5) > 0;
    ctx.fillStyle = blink ? '#53d88b' : '#d8bd36';
    ctx.fillRect(f.trainDoor.x - 42, y - 7, 84, 5);
  }

  drawEntrance(ctx, f, game) {
    // Scala mobile che risale in strada: non è solo un punto luminoso sul pavimento.
    ctx.fillStyle = '#242b31';
    ctx.fillRect(440, 26, 200, 130);
    const grad = ctx.createLinearGradient(0, 34, 0, 146);
    grad.addColorStop(0, '#151a20');
    grad.addColorStop(1, '#65737e');
    ctx.fillStyle = grad;
    ctx.fillRect(466, 36, 148, 108);
    for (let y = 42; y < 142; y += 12) {
      ctx.fillStyle = 'rgba(225,235,242,0.22)';
      ctx.fillRect(470, y, 140, 4);
    }
    ctx.strokeStyle = '#48c8ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(458, 38); ctx.lineTo(458, 146);
    ctx.moveTo(622, 38); ctx.lineTo(622, 146);
    ctx.stroke();
    ctx.fillStyle = `rgba(72,200,255,${0.55 + 0.3 * Math.sin(game.time * 3)})`;
    ctx.fillRect(512, 42, 56, 7);
  }

  drawSigns(ctx, f, game) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf5fb';
    ctx.font = '800 22px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(`${f.station.hangul}  ${f.station.name}`, f.w / 2, 190);
    ctx.fillStyle = '#48c8ff';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(`METRO ${(f.station.lines || []).join(' · ')}  ·  개찰구 TORNELLI`, f.w / 2, 212);
    ctx.fillStyle = '#f2cf43';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillText('승강장  PLATFORM  ↓', f.w / 2, 462);
    ctx.fillStyle = 'rgba(235,244,250,0.72)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('USCITA · EXIT', f.w / 2, 66);
  }

  drawFixture(ctx, o, cam, pal, game) {
    let body = pal.trim;
    let top = shade(body, 0.18);
    if (o.type === 'wall') { body = pal.wall; top = shade(pal.wall, 0.14); }
    else if (o.type === 'service') { body = '#46525c'; top = '#63717c'; }
    else if (o.type === 'platformEdge') { body = '#9d8631'; top = '#e2c640'; }
    else if (o.type === 'ticketGate') { body = '#56636e'; top = '#8b99a3'; }
    else if (o.type === 'ticketMachine') { body = '#254e6b'; top = '#48c8ff'; }
    else if (o.type === 'bench') { body = '#4f5a64'; top = '#7d8b96'; }
    else if (o.type === 'pillar') { body = '#5b6872'; top = '#87949e'; }
    const p = drawBox(ctx, o, cam, body, top);
    if (o.type === 'ticketGate') {
      ctx.fillStyle = '#48c8ff';
      ctx.fillRect(p.x + 7, p.y + 7, o.w - 14, 5);
      ctx.fillStyle = '#57dc8b';
      ctx.beginPath();
      ctx.arc(p.x + o.w / 2, p.y + o.h / 2, 4, 0, 6.2832);
      ctx.fill();
    } else if (o.type === 'ticketMachine') {
      ctx.fillStyle = '#10212c';
      ctx.fillRect(p.x + 7, p.y + 9, o.w - 14, 22);
      ctx.fillStyle = '#e5f8ff';
      ctx.font = '800 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('T-MONEY', p.x + o.w / 2, p.y + 23);
    } else if (o.type === 'bench') {
      ctx.strokeStyle = 'rgba(15,20,24,0.48)';
      for (let x = p.x + 10; x < p.x + o.w - 4; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, p.y + 3); ctx.lineTo(x, p.y + o.h - 3); ctx.stroke();
      }
    }
  }
}
