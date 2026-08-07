// Metropolitana fisica: in strada si entra da una scala riconoscibile, dentro si
// cammina davvero fra atrio, tornelli e banchina. Il pannello delle destinazioni
// compare soltanto davanti alle porte del treno, non al bordo del marciapiede.
import { dist, clamp } from '../core/math.js';
import { SpatialGrid } from '../core/spatial.js';
import { roundPath } from './hud.js';

const ENTRANCE_REACH = 72;
const ACTION_REACH = 48;
const WALL = 18;

const REGION_LINKS = [
  { id: 'seoul', label: 'Seoul', hangul: '서울', service: 'KTX' },
  { id: 'busan', label: 'Busan', hangul: '부산', service: 'KTX' },
  { id: 'jeju', label: 'Jeju', hangul: '제주', service: 'Aeroporto · traghetto' },
];

function solid(x, y, w, h, type, extra = {}) {
  return { x, y, w, h, type, solid: true, z: extra.z ?? 28, ...extra };
}

/** Una stazione completa e giocabile, abbastanza larga da avere atrio e banchina. */
function buildStationFloor(station) {
  const w = 1080;
  const h = 720;
  const walls = [
    solid(0, 0, w, WALL, 'wall', { z: 58 }),
    solid(0, h - WALL, w, WALL, 'wall', { z: 58 }),
    solid(0, 0, WALL, h, 'wall', { z: 58 }),
    solid(w - WALL, 0, WALL, h, 'wall', { z: 58 }),
    // Locali tecnici: spezzano l'atrio e rendono la pianta una stazione, non un hangar.
    solid(24, 244, 190, 122, 'service', { z: 42 }),
    solid(866, 244, 190, 122, 'service', { z: 42 }),
    // Il parapetto separa la banchina dai binari. Le porte del treno si usano dal lato sicuro.
    solid(18, 544, 1044, 14, 'platformEdge', { z: 16 }),
  ];
  const furni = [
    solid(342, 232, 38, 76, 'ticketGate', { z: 30 }),
    solid(442, 232, 38, 76, 'ticketGate', { z: 30 }),
    solid(600, 232, 38, 76, 'ticketGate', { z: 30 }),
    solid(700, 232, 38, 76, 'ticketGate', { z: 30 }),
    solid(250, 96, 48, 72, 'ticketMachine', { z: 48 }),
    solid(782, 96, 48, 72, 'ticketMachine', { z: 48 }),
    solid(250, 414, 126, 24, 'bench', { z: 20 }),
    solid(704, 414, 126, 24, 'bench', { z: 20 }),
    // Il pilastro dell'atrio resta fuori dall'asse scala-banchina: il punto di
    // ingresso deve essere libero già al primo frame, non corretto a spinta dal
    // risolutore delle collisioni.
    solid(400, 112, 34, 34, 'pillar', { z: 62 }),
    solid(523, 386, 34, 34, 'pillar', { z: 62 }),
  ];
  const grid = new SpatialGrid(w, h, 120);
  for (const o of [...walls, ...furni]) grid.insertRect(o);
  const pal = {
    floor: '#38424c', wall: '#53606b', trim: '#7d8b96', accent: '#48c8ff',
  };
  return {
    w, h, grid, walls, furni, people: [], idx: 0,
    entry: { x: 540, y: 82, angle: Math.PI / 2 },
    exit: { x: 540, y: 82 },
    platform: { x: 540, y: 486 },
    trainDoor: { x: 540, y: 506 },
    biz: { id: 'metro', hangul: '지하철', label: 'metropolitana', pal },
    label: `${station.hangul} ${station.name}`,
    station,
  };
}

export class MetroSystem {
  constructor() {
    this.open = false;
    this.inside = false;
    this.index = 0;
    this.station = null;
    this.floor = null;
    this.outside = null;
    this.options = [];
    this.fade = 0;
  }

  roomZoom(cam) {
    const f = this.floor;
    if (!f) return 1.12;
    return clamp(Math.min(cam.viewW / (f.w + 100), cam.viewH / (f.h + 100)), 0.72, 1.45);
  }

  entranceOf(station) {
    return station.entrance || { x: station.x, y: station.y };
  }

  nearestEntrance(game) {
    if (!game.player.onFoot || game.indoors) return null;
    let best = null;
    let bestD = ENTRANCE_REACH;
    for (const station of game.city.transitStations || []) {
      const e = this.entranceOf(station);
      const d = dist(game.player.x, game.player.y, e.x, e.y);
      if (d < bestD) { best = station; bestD = d; }
    }
    return best;
  }

  hint(game) {
    if (this.open) return null;
    if (!this.inside) {
      const s = this.nearestEntrance(game);
      return s ? `E  —  scendi in metro · ${s.hangul} ${s.name}` : null;
    }
    if (dist(game.player.x, game.player.y, this.floor.exit.x, this.floor.exit.y) < ACTION_REACH) {
      return 'E  —  risali in strada';
    }
    if (dist(game.player.x, game.player.y, this.floor.trainDoor.x, this.floor.trainDoor.y) < ACTION_REACH + 14) {
      return 'E  —  consulta le destinazioni e sali sul treno';
    }
    return 'Attraversa i tornelli e raggiungi la banchina';
  }

  buildOptions(game) {
    const regionId = game.city.region?.id || 'seoul';
    const local = (game.city.transitStations || [])
      .filter((s) => s.id !== this.station?.id)
      .map((s) => ({
        region: regionId,
        station: s.id,
        title: `${s.hangul}  ${s.name}`,
        detail: `Metro ${(s.lines || []).join(' · ')}`,
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

  enterStation(game, station) {
    if (game.wanted?.level > 0) {
      game.hud.toast('Con la polizia addosso i tornelli restano chiusi', 2.2);
      game.audio?.ui('deny');
      return false;
    }
    const pl = game.player;
    const e = this.entranceOf(station);
    this.station = station;
    this.outside = { x: e.x, y: e.y, angle: pl.angle };
    this.floor = buildStationFloor(station);
    this.inside = true;
    this.open = false;
    this.fade = 1;
    pl.x = this.floor.entry.x;
    pl.y = this.floor.entry.y;
    pl.vx = 0;
    pl.vy = 0;
    pl.angle = this.floor.entry.angle;
    pl.aimAngle = pl.angle;
    pl.enterCooldown = 0.42;
    game.peds = this.floor.people;
    game.pedGrid.rebuild(game.peds);
    game.camera.snapTo(this.floor.w / 2, this.floor.h / 2);
    game.fx.clear();
    game.projectiles.clear();
    game.audio?.ui('open');
    game.hud.showVenue(this.floor);
    game.stats.visits = (game.stats.visits || 0) + 1;
    return true;
  }

  openBoard(game) {
    this.index = 0;
    this.buildOptions(game);
    this.open = true;
    game.audio?.ui('open');
  }

  close(game) {
    this.open = false;
    this.options = [];
    game.audio?.ui('close');
  }

  forceExit(game) {
    if (!this.inside) return;
    this.inside = false;
    this.open = false;
    this.floor = null;
    this.station = null;
    this.options = [];
    game.peds = game.pedSystem.peds;
    game.pedGrid.rebuild(game.peds);
    game.fx.clear();
    game.projectiles.clear();
    game.player.enterCooldown = 0.42;
    this.fade = 1;
  }

  leaveStation(game) {
    if (!this.inside || !this.outside) return;
    const out = this.outside;
    this.forceExit(game);
    const pl = game.player;
    pl.x = out.x;
    pl.y = out.y;
    pl.vx = 0;
    pl.vy = 0;
    pl.angle = out.angle;
    pl.aimAngle = out.angle;
    pl.district = game.city.districtAt(pl.x, pl.y);
    game.camera.snapTo(pl.x, pl.y);
    game.audio?.doorClose(pl.x, pl.y);
  }

  update(dt, game) {
    this.fade = Math.max(0, this.fade - dt * 2.6);
    const input = game.input;
    if (!this.inside) {
      const station = this.nearestEntrance(game);
      if (station && input.wasPressed('KeyE') && game.player.enterCooldown <= 0) {
        return this.enterStation(game, station);
      }
      return false;
    }

    if (!this.open) {
      if (game.player.enterCooldown > 0) return false;
      if (dist(game.player.x, game.player.y, this.floor.exit.x, this.floor.exit.y) < ACTION_REACH
        && input.wasPressed('KeyE')) {
        this.leaveStation(game);
        return true;
      }
      if (dist(game.player.x, game.player.y, this.floor.trainDoor.x, this.floor.trainDoor.y) < ACTION_REACH + 14
        && input.wasPressed('KeyE')) {
        this.openBoard(game);
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
    ctx.fillText('승강장 · PROSSIMO TRENO', x + 30, y + 42);
    ctx.fillStyle = '#64c7ff';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(`Banchina: ${this.station?.hangul || ''} ${this.station?.name || ''}`, x + 30, y + 66);

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
    ctx.fillText('W/S o frecce: scegli · E/INVIO: sali · ESC: resta in banchina', x + 30, y + ph - 24);
    ctx.restore();
  }
}
