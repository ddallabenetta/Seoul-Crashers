// HUD: minimappa, tachimetro, salute e arma, cartello del distretto, suggerimenti.
import { KMH, clamp } from '../core/math.js';
import { MAP_SIZE } from '../world/maptexture.js';
import { VEHICLE_TYPES, getHeroPortrait, getWeaponIcon } from '../render/sprites.js';
import { WEAPONS, WEAPON_SLOTS } from '../entities/weapons.js';
import { won } from '../entities/shops.js';

const MINIMAP = 196;
const MINIMAP_WORLD = 1000; // porzione di mondo inquadrata

export class Hud {
  constructor(city, mapTexture) {
    this.city = city;
    this.mapTexture = mapTexture;
    this.districtToast = 0;
    this.districtInfo = null;
    this.hint = null;
    this.hintT = 0;
    this.messages = [];
    this.venue = null;
    this.venueT = 0;
  }

  showDistrict(d) {
    this.districtInfo = d;
    this.districtToast = 4.2;
  }

  /** Cartello di un locale: stesso ruolo di quello del distretto, un piano alla volta. */
  showVenue(floor) {
    this.venue = floor;
    this.venueT = 2.8;
  }

  toast(text, seconds = 3) {
    this.messages.push({ text, t: seconds, max: seconds });
  }

  update(dt) {
    if (this.districtToast > 0) this.districtToast -= dt;
    if (this.venueT > 0) this.venueT -= dt;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].t -= dt;
      if (this.messages[i].t <= 0) this.messages.splice(i, 1);
    }
  }

  draw(ctx, game) {
    const w = game.camera.viewW;
    const h = game.camera.viewH;
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    if (game.indoors) this.drawFloorPlan(ctx, game, 22, h - MINIMAP - 22);
    else this.drawMinimap(ctx, game, 22, h - MINIMAP - 22);
    if (!game.player.onFoot) this.drawSpeedo(ctx, game, w - 132, h - 112);
    this.drawWeaponBar(ctx, game, w, h);
    this.drawVitals(ctx, game, 22, 22);
    this.drawMoney(ctx, game, 22, 88);
    if (game.wanted) this.drawWanted(ctx, game, 22, 124);
    this.drawDistrictToast(ctx, game, w, h);
    this.drawVenueToast(ctx, game, w, h);
    this.drawHints(ctx, game, w, h);
    this.drawMessages(ctx, w, h);
    if (game.debug) this.drawDebug(ctx, game, w, h);
    this.drawDamage(ctx, game, w, h);
    this.drawCrosshair(ctx, game);
    this.drawFade(ctx, game, w, h);

    ctx.restore();
  }

  /** Ritratto, salute e arma in mano: la colonna di sinistra, sopra la minimappa. */
  drawVitals(ctx, game, x, y) {
    const p = game.player;
    const w = 262;
    const bx = x + 68; // colonna di barre e testo, a destra del ritratto
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,15,0.72)';
    roundPath(ctx, x, y, w, 62, 10);
    ctx.fill();

    // Ritratto di Jae-min: sotto tiro pulsa di rosso.
    const portrait = getHeroPortrait();
    ctx.drawImage(portrait.canvas, x + 8, y + 8, 46, 46);
    if (p.hurtT > 0 || p.hp < p.maxHp * 0.3) {
      ctx.save();
      ctx.globalAlpha = Math.max(clamp(p.hurtT / 0.4, 0, 1) * 0.5,
        p.hp < p.maxHp * 0.3 ? 0.18 + 0.14 * Math.sin(game.time * 5) : 0);
      ctx.fillStyle = '#c62f2a';
      roundPath(ctx, x + 8, y + 8, 46, 46, 7);
      ctx.fill();
      ctx.restore();
    }

    // Barra della salute
    const t = clamp(p.hp / p.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundPath(ctx, bx, y + 13, w - 12 - (bx - x), 12, 6);
    ctx.fill();
    ctx.fillStyle = t > 0.5 ? '#4ad98a' : t > 0.22 ? '#e8c33a' : '#e04a3a';
    if (t > 0.01) {
      roundPath(ctx, bx, y + 13, (w - 12 - (bx - x)) * t, 12, 6);
      ctx.fill();
    }
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(12,14,18,0.85)';
    ctx.fillText(String(Math.max(0, Math.ceil(p.hp))), x + w - 17, y + 23);

    // Arma corrente e colpi
    const spec = WEAPONS[p.weapon];
    ctx.textAlign = 'left';
    ctx.font = '700 13px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillStyle = '#eef1f6';
    ctx.fillText(`${spec.hangul}  ${spec.label}`, bx, y + 47);
    ctx.textAlign = 'right';
    ctx.font = '700 15px ui-monospace, monospace';
    ctx.fillStyle = spec.infinite ? 'rgba(230,235,245,0.45)' : p.shots > 0 ? '#ffd23f' : '#e04a3a';
    ctx.fillText(spec.infinite ? '∞' : String(p.shots), x + w - 12, y + 48);
    ctx.restore();
  }

  /** Contanti. Sta sotto il pannello vitale perché è un numero che cambia di rado. */
  drawMoney(ctx, game, x, y) {
    const p = game.player;
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,15,0.66)';
    roundPath(ctx, x, y, 150, 26, 8);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = '700 15px ui-monospace, monospace';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(won(p.money), x + 10, y + 18);
    ctx.restore();
  }

  /**
   * Pianta del piano al posto della minimappa. Dentro un edificio la mappa della
   * città non dice niente, e senza un riferimento non si trova più la porta.
   */
  drawFloorPlan(ctx, game, x, y) {
    const f = game.shops.floor;
    const pl = game.player;
    const pal = f.biz.pal;
    const k = Math.min(MINIMAP / f.w, MINIMAP / f.h) * 0.86;
    const ox = x + (MINIMAP - f.w * k) / 2;
    const oy = y + (MINIMAP - f.h * k) / 2;
    const to = (wx, wy) => ({ x: ox + wx * k, y: oy + wy * k });

    ctx.save();
    ctx.fillStyle = 'rgba(10,12,15,0.82)';
    roundPath(ctx, x - 4, y - 4, MINIMAP + 8, MINIMAP + 8, 12);
    ctx.fill();
    roundPath(ctx, x, y, MINIMAP, MINIMAP, 9);
    ctx.clip();
    ctx.fillStyle = '#12151a';
    ctx.fillRect(x, y, MINIMAP, MINIMAP);
    ctx.fillStyle = pal.floor;
    ctx.fillRect(ox, oy, f.w * k, f.h * k);
    ctx.fillStyle = pal.wall;
    for (const w of f.walls) ctx.fillRect(ox + w.x * k, oy + w.y * k, w.w * k, w.h * k);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const o of f.furni) if (o.solid) ctx.fillRect(ox + o.x * k, oy + o.y * k, o.w * k, o.h * k);
    // Scale, porta e cassa: sono le tre cose che si cercano su una pianta.
    for (const [s, col] of [[f.stairUp, '#4ad98a'], [f.stairDown, '#e8c33a']]) {
      if (!s) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + s.x * k, oy + s.y * k, s.w * k, s.h * k);
    }
    if (f.idx === 0) {
      const e = to(f.entry.x, f.entry.y);
      ctx.fillStyle = '#38d6ff';
      ctx.fillRect(e.x - 4, e.y - 2, 8, 4);
    }
    if (f.till && !f.robbed) {
      const t = to(f.till.x, f.till.y);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3, 0, 6.2832);
      ctx.fill();
    }
    for (const p of f.people) {
      if (p.dead) continue;
      const m = to(p.x, p.y);
      ctx.fillStyle = p.hostile ? '#ff4a4a' : 'rgba(210,216,226,0.8)';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 2.4, 0, 6.2832);
      ctx.fill();
    }
    const m = to(pl.x, pl.y);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(pl.angle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-4.5, 4.5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4.5, -4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    ctx.strokeStyle = 'rgba(230,235,245,0.28)';
    ctx.lineWidth = 1.6;
    roundPath(ctx, x, y, MINIMAP, MINIMAP, 9);
    ctx.stroke();

    ctx.font = '600 12px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillStyle = pal.accent;
    ctx.textAlign = 'left';
    const it = game.shops.active;
    ctx.fillText(`${f.biz.hangul}  ${f.idx === 0 ? 'PIANO TERRA' : `${f.idx + 1}° PIANO`} / ${it.floors.length}`, x + 2, y - 12);
  }

  /** Il nero fra una porta e l'altra: una scala senza stacco è un teletrasporto. */
  drawFade(ctx, game, w, h) {
    const a = game.shops ? game.shops.fade : 0;
    if (a <= 0.01) return;
    ctx.save();
    ctx.fillStyle = `rgba(4,5,7,${Math.min(1, a)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawVenueToast(ctx, game, w, h) {
    if (this.venueT <= 0 || !this.venue) return;
    const f = this.venue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.venueT / 0.6);
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = f.biz.pal.accent;
    ctx.font = '800 42px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(f.biz.hangul, w / 2, h * 0.17);
    ctx.fillStyle = '#f0f2f6';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(f.biz.label.toUpperCase(), w / 2, h * 0.17 + 24);
    ctx.restore();
  }

  /**
   * Livello di ricercato. Le stelle piene sono quelle attive; l'ultima lampeggia
   * mentre stai riuscendo a seminarli, ed è l'unico modo che ha il giocatore di
   * sapere che nascondersi sta funzionando.
   */
  drawWanted(ctx, game, x, y) {
    const wanted = game.wanted;
    if (wanted.level === 0) return;
    const cooling = wanted.cooling;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = '700 11px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillStyle = 'rgba(235,240,250,0.5)';
    ctx.fillText('수배', x + 2, y - 6);
    for (let i = 0; i < 5; i++) {
      const active = i < wanted.level;
      // La stella più alta sfarfalla quando il cronometro della fuga corre.
      const fading = active && i === wanted.level - 1 && cooling > 0.05;
      const alpha = fading ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(game.time * 9)) * (1 - cooling) : 1;
      ctx.globalAlpha = active ? alpha : 0.22;
      star(ctx, x + 12 + i * 26, y + 10, 10);
      ctx.fillStyle = active ? '#ffd23f' : 'rgba(230,235,245,0.35)';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(10,12,16,0.85)';
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Barra armi: una casella per fila (tasti 1-6) con l'arma scelta in quella fila.
   * Sta sempre a schermo ma in sordina, e si accende per un paio di secondi quando
   * si cambia arma — con undici armi il giocatore deve poter sapere cosa ha in mano
   * e cosa gli manca senza aprire un menu.
   */
  drawWeaponBar(ctx, game, w, h) {
    const p = game.player;
    const CW = 58, CH = 42, GAP = 6;
    const total = WEAPON_SLOTS.length * (CW + GAP) - GAP;
    const x0 = (w - total) / 2;
    // Sopra la riga dei suggerimenti (`E — sali in…`), che sta a h-62: sotto ci
    // finirebbe esattamente sopra.
    const y0 = h - CH - 76;
    const wake = clamp(p.weaponT / 1.8, 0, 1);

    ctx.save();
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < WEAPON_SLOTS.length; i++) {
      const row = WEAPON_SLOTS[i];
      const owned = row.filter((id) => p.owned.has(id));
      const id = owned.includes(p.weapon) ? p.weapon : (owned[0] || row[0]);
      const spec = WEAPONS[id];
      const has = owned.length > 0;
      const active = id === p.weapon;
      const x = x0 + i * (CW + GAP);

      ctx.globalAlpha = active ? 1 : 0.55 + wake * 0.3;
      ctx.fillStyle = active ? 'rgba(24,18,20,0.9)' : 'rgba(10,12,15,0.78)';
      roundPath(ctx, x, y0, CW, CH, 8);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = '#ff5fa2';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // Numero della fila e quante armi ci sono dentro (il puntino dice "ripremi").
      ctx.fillStyle = active ? 'rgba(255,214,80,0.95)' : 'rgba(230,235,245,0.4)';
      ctx.font = '700 9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + 5, y0 + 11);
      if (owned.length > 1) {
        for (let k = 0; k < owned.length; k++) {
          ctx.fillStyle = owned[k] === p.weapon ? '#ffd23f' : 'rgba(230,235,245,0.35)';
          ctx.beginPath();
          ctx.arc(x + CW - 7 - k * 5, y0 + 8, 1.6, 0, 6.2832);
          ctx.fill();
        }
      }

      const icon = getWeaponIcon(id);
      ctx.globalAlpha *= has ? 1 : 0.35;
      ctx.drawImage(icon.canvas, x + (CW - icon.w) / 2, y0 + 10, icon.w, icon.h);
      ctx.globalAlpha = active ? 1 : 0.55 + wake * 0.3;

      ctx.textAlign = 'center';
      ctx.font = '700 10px ui-monospace, monospace';
      if (!has) {
        ctx.fillStyle = 'rgba(230,235,245,0.25)';
        ctx.fillText('—', x + CW / 2, y0 + CH - 5);
      } else if (spec.infinite) {
        ctx.fillStyle = 'rgba(230,235,245,0.5)';
        ctx.fillText('∞', x + CW / 2, y0 + CH - 5);
      } else {
        const n = p.ammo[id] || 0;
        ctx.fillStyle = n > 0 ? '#ffd23f' : '#e04a3a';
        ctx.fillText(String(n), x + CW / 2, y0 + CH - 5);
      }
    }
    ctx.restore();
  }

  /** Botte prese: vignettatura rossa. Diventa fissa quando la salute è agli sgoccioli. */
  drawDamage(ctx, game, w, h) {
    const p = game.player;
    const low = clamp(1 - p.hp / (p.maxHp * 0.3), 0, 1);
    const hit = clamp(p.hurtT / 0.4, 0, 1);
    const a = Math.max(hit * 0.5, low * 0.3 * (0.6 + 0.4 * Math.sin(game.time * 4)));
    if (a > 0.01 && !p.dying) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, 'rgba(150,10,12,0)');
      g.addColorStop(1, `rgba(150,10,12,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (!p.dying) return;

    const t = clamp(p.deathT / 1.1, 0, 1);
    ctx.fillStyle = `rgba(40,4,6,${t * 0.82})`;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = clamp((p.deathT - 0.4) / 0.6, 0, 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e04a3a';
    ctx.font = '800 62px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('사망', w / 2, h / 2 - 6);
    ctx.fillStyle = '#f0f2f6';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText('CI HAI LASCIATO LE PENNE', w / 2, h / 2 + 26);
    ctx.restore();
  }

  /**
   * Mirino. Il raggio segue la dispersione vera dell'arma — la pompa "si apre", il
   * fucile di precisione si stringe solo col mirino — e per gli esplosivi mostra il
   * raggio dello scoppio dove cadranno: senza, tirare una granata è tirare a caso.
   */
  drawCrosshair(ctx, game) {
    const p = game.player;
    if (game.paused || p.dying) return;
    const m = game.input.mouse;
    const spec = WEAPONS[p.weapon];

    if (spec.thrown && !spec.placed) {
      const s = game.camera.worldToScreen(p.aimX, p.aimY);
      const r = ((spec.blast ? spec.blast.r : spec.fire.r) * game.camera.zoom);
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = spec.fire ? 'rgba(255,140,60,0.55)' : 'rgba(255,90,70,0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, 6.2832);
      ctx.stroke();
      ctx.restore();
    }

    const spreadMul = spec.scope && !p.scoping ? 9 : 1;
    const r = spec.melee ? 5 : clamp(6 + (spec.spread || 0) * spreadMul * 92, 6, 34);

    // Fucile di precisione col mirino: croce lunga e cerchio sottile, si legge come
    // un'ottica anche se la camera si è solo allargata.
    if (p.scoping) {
      const w = game.camera.viewW;
      const h = game.camera.viewH;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,214,80,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, m.y); ctx.lineTo(w, m.y);
      ctx.moveTo(m.x, 0); ctx.lineTo(m.x, h);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,80,0.5)';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 34, 0, 6.2832);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.strokeStyle = spec.melee ? 'rgba(235,240,250,0.55)' : 'rgba(255,214,80,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 6.2832);
    ctx.stroke();
    if (!spec.melee) {
      ctx.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(dx * (r + 3), dy * (r + 3));
        ctx.lineTo(dx * (r + 8), dy * (r + 8));
      }
      ctx.stroke();
    }
    // Minigun: l'anello si chiude mentre le canne prendono giro. Finché non è pieno
    // non parte un colpo, e il giocatore deve poterlo vedere.
    if (spec.spinUp && p.spin > 0.01) {
      ctx.strokeStyle = p.spin >= 1 ? 'rgba(255,90,60,0.95)' : 'rgba(255,214,80,0.7)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, r + 12, -Math.PI / 2, -Math.PI / 2 + p.spin * 6.2832);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMinimap(ctx, game, x, y) {
    const p = game.player;
    const k = MAP_SIZE / this.city.w;
    const src = MINIMAP_WORLD * k;
    const sx = p.x * k - src / 2;
    const sy = p.y * k - src / 2;

    ctx.save();
    // Cornice
    ctx.fillStyle = 'rgba(10,12,15,0.82)';
    roundPath(ctx, x - 4, y - 4, MINIMAP + 8, MINIMAP + 8, 12);
    ctx.fill();
    roundPath(ctx, x, y, MINIMAP, MINIMAP, 9);
    ctx.clip();
    ctx.fillStyle = '#12151a';
    ctx.fillRect(x, y, MINIMAP, MINIMAP);
    ctx.drawImage(this.mapTexture, sx, sy, src, src, x, y, MINIMAP, MINIMAP);

    const toMap = (wx, wy) => ({
      x: x + MINIMAP / 2 + ((wx - p.x) * MINIMAP) / MINIMAP_WORLD,
      y: y + MINIMAP / 2 + ((wy - p.y) * MINIMAP) / MINIMAP_WORLD,
    });

    // Traffico
    ctx.fillStyle = 'rgba(200,205,215,0.55)';
    for (const v of game.vehicles) {
      if (v.driver === 'player') continue;
      const m = toMap(v.x, v.y);
      if (m.x < x || m.x > x + MINIMAP || m.y < y || m.y > y + MINIMAP) continue;
      ctx.fillRect(m.x - 1.2, m.y - 1.2, 2.4, 2.4);
    }
    // Polizia
    for (const v of game.vehicles) {
      if (!v.siren) continue;
      const m = toMap(v.x, v.y);
      const blink = Math.sin(game.time * 9) > 0;
      ctx.fillStyle = blink ? '#5a8cff' : '#ff4a4a';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3.2, 0, 6.2832);
      ctx.fill();
    }
    // Territori delle bande: un rettangolo del loro colore. Chi ci passa dentro
    // armato se ne accorge in fretta; la minimappa serve a passarci apposta.
    for (const t of this.city.turfs || []) {
      const a = toMap(t.x, t.y);
      const b = toMap(t.x + t.w, t.y + t.h);
      if (b.x < x || a.x > x + MINIMAP || b.y < y || a.y > y + MINIMAP) continue;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(a.x, a.y, Math.max(4, b.x - a.x), Math.max(4, b.y - a.y));
      ctx.restore();
    }
    // Eliporti: un velivolo si posa solo dove c'è la H dipinta.
    for (const pad of this.city.helipads || []) {
      const m = toMap(pad.x, pad.y);
      if (m.x < x || m.x > x + MINIMAP || m.y < y || m.y > y + MINIMAP) continue;
      ctx.strokeStyle = 'rgba(230,240,250,0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, 6.2832);
      ctx.stroke();
      ctx.fillStyle = 'rgba(230,240,250,0.9)';
      ctx.font = '700 6px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('H', m.x, m.y + 2.2);
    }
    // Ospedali: sono i punti di risveglio, devono essere sempre localizzabili.
    for (const hsp of this.city.hospitals || []) {
      const m = toMap(hsp.x, hsp.y);
      if (m.x < x || m.x > x + MINIMAP || m.y < y || m.y > y + MINIMAP) continue;
      ctx.fillStyle = 'rgba(238,242,248,0.92)';
      ctx.fillRect(m.x - 4.5, m.y - 4.5, 9, 9);
      ctx.fillStyle = '#c62f34';
      ctx.fillRect(m.x - 1, m.y - 3.2, 2, 6.4);
      ctx.fillRect(m.x - 3.2, m.y - 1, 6.4, 2);
    }
    // Negozi con un servizio dentro (armeria, pegni, minimarket, farmacia, vestiti):
    // gli altri locali sono decine per isolato e riempirebbero la minimappa di puntini.
    for (const sh of this.city.shops || []) {
      if (!sh.blip) continue;
      const m = toMap(sh.x, sh.y);
      if (m.x < x || m.x > x + MINIMAP || m.y < y || m.y > y + MINIMAP) continue;
      ctx.fillStyle = sh.blip;
      ctx.fillRect(m.x - 2.6, m.y - 2.6, 5.2, 5.2);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(m.x - 2.6, m.y - 2.6, 5.2, 5.2);
    }
    // Officine: sono la sola via d'uscita rapida dal ricercato, si vedono sempre.
    for (const g of this.city.garages || []) {
      const m = toMap(g.cx, g.cy);
      if (m.x < x || m.x > x + MINIMAP || m.y < y || m.y > y + MINIMAP) continue;
      ctx.fillStyle = '#b48cff';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y - 5);
      ctx.lineTo(m.x + 5, m.y);
      ctx.lineTo(m.x, m.y + 5);
      ctx.lineTo(m.x - 5, m.y);
      ctx.closePath();
      ctx.fill();
    }
    // Chi ti sta dando la caccia: teppisti in rosso, divise in blu.
    for (const p of game.peds) {
      if ((!p.hostile && !p.cop) || p.dead) continue;
      const m = toMap(p.x, p.y);
      if (m.x < x || m.x > x + MINIMAP || m.y < y || m.y > y + MINIMAP) continue;
      ctx.fillStyle = p.cop ? '#5a8cff' : '#ff4a4a';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 2.8, 0, 6.2832);
      ctx.fill();
    }
    // Posti di blocco e chiodi: si devono vedere prima di prenderli in faccia.
    if (game.police) {
      for (const b of game.police.blocks) {
        const m = toMap(b.x, b.y);
        if (m.x < x || m.x > x + MINIMAP || m.y < y || m.y > y + MINIMAP) continue;
        ctx.fillStyle = '#5a8cff';
        ctx.fillRect(m.x - (b.vertical ? 7 : 2), m.y - (b.vertical ? 2 : 7), b.vertical ? 14 : 4, b.vertical ? 4 : 14);
      }
      for (const s of game.police.spikes) {
        const m = toMap(s.cx, s.cy);
        if (m.x < x || m.x > x + MINIMAP || m.y < y || m.y > y + MINIMAP) continue;
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(m.x - (s.horiz ? 6 : 1.5), m.y - (s.horiz ? 1.5 : 6), s.horiz ? 12 : 3, s.horiz ? 3 : 12);
      }
      const c = game.police.chopper;
      if (c) {
        const m = toMap(c.x, c.y);
        ctx.strokeStyle = '#5a8cff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(clamp(m.x, x + 5, x + MINIMAP - 5), clamp(m.y, y + 5, y + MINIMAP - 5), 5, 0, 6.2832);
        ctx.stroke();
      }
    }

    // Mine e incendi: sono roba tua, ma sono roba che esplode. Vanno viste.
    if (game.projectiles) {
      for (const mine of game.projectiles.mines) {
        const mm = toMap(mine.x, mine.y);
        if (mm.x < x || mm.x > x + MINIMAP || mm.y < y || mm.y > y + MINIMAP) continue;
        ctx.fillStyle = mine.armed ? '#e03a3a' : 'rgba(230,200,80,0.8)';
        ctx.fillRect(mm.x - 2, mm.y - 2, 4, 4);
      }
      for (const f of game.projectiles.fires) {
        const mm = toMap(f.x, f.y);
        if (mm.x < x || mm.x > x + MINIMAP || mm.y < y || mm.y > y + MINIMAP) continue;
        ctx.fillStyle = 'rgba(255,140,50,0.75)';
        ctx.beginPath();
        ctx.arc(mm.x, mm.y, 3.4, 0, 6.2832);
        ctx.fill();
      }
    }

    // Marker missione / obiettivi
    for (const mk of game.markers || []) {
      const m = toMap(mk.x, mk.y);
      ctx.fillStyle = mk.color || '#ffd23f';
      ctx.beginPath();
      ctx.arc(clamp(m.x, x + 4, x + MINIMAP - 4), clamp(m.y, y + 4, y + MINIMAP - 4), 4, 0, 6.2832);
      ctx.fill();
    }

    // Giocatore
    const cx = x + MINIMAP / 2;
    const cy = y + MINIMAP / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, 5);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    // Bordo
    ctx.strokeStyle = 'rgba(230,235,245,0.28)';
    ctx.lineWidth = 1.6;
    roundPath(ctx, x, y, MINIMAP, MINIMAP, 9);
    ctx.stroke();

    // Etichetta distretto sotto la minimappa
    const d = game.player.district;
    if (d) {
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(225,230,240,0.75)';
      ctx.textAlign = 'left';
      ctx.fillText(`${d.hangul}  ${d.name.toUpperCase()}`, x + 2, y - 12);
    }
  }

  drawSpeedo(ctx, game, x, y) {
    const v = game.player.vehicle;
    if (!v) return;
    const spec = VEHICLE_TYPES[v.kind];
    const kmh = Math.abs(KMH(v.speed));
    const maxKmh = KMH(spec.topSpeed);
    const t = clamp(kmh / maxKmh, 0, 1);
    const r = 52;
    const cx = x + 54;
    const cy = y + 54;

    ctx.save();
    ctx.fillStyle = 'rgba(10,12,15,0.72)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, 6.2832);
    ctx.fill();

    // Arco di fondo
    const a0 = Math.PI * 0.78;
    const a1 = Math.PI * 2.22;
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();

    // Arco attivo
    const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, '#38d6ff');
    grad.addColorStop(0.6, '#ffd23f');
    grad.addColorStop(1, '#ff4a4a');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * t);
    ctx.stroke();

    // Danno del veicolo
    const hpT = clamp(v.hp / v.maxHp, 0, 1);
    ctx.strokeStyle = hpT > 0.5 ? 'rgba(90,220,140,0.8)' : hpT > 0.25 ? 'rgba(240,200,70,0.85)' : 'rgba(240,80,60,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 10, a0, a0 + (a1 - a0) * hpT);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2f4f8';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText(Math.round(kmh), cx, cy + 6);
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(230,235,245,0.6)';
    ctx.fillText('KM/H', cx, cy + 21);
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(230,235,245,0.45)';
    ctx.fillText(spec.label.toUpperCase(), cx, cy + 40);
    // In volo la velocità non basta: senza la quota non si sa se si sta salendo
    // o se si sta per finire dentro una torre di Gangnam.
    if (spec.air) {
      const alt = Math.round(v.z);
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillStyle = v.z > 6 ? '#7cf3ff' : 'rgba(230,235,245,0.55)';
      ctx.fillText(`${alt} m`, cx, cy - 20);
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(230,235,245,0.45)';
      ctx.fillText('QUOTA', cx, cy - 32);
    }
    ctx.restore();
  }

  drawDistrictToast(ctx, game, w, h) {
    if (this.districtToast <= 0 || !this.districtInfo) return;
    const d = this.districtInfo;
    const t = this.districtToast;
    const alpha = Math.min(1, t > 3.6 ? (4.2 - t) / 0.6 : Math.min(1, t / 0.8));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = d.accent;
    ctx.font = '800 54px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(d.hangul, w / 2, h * 0.2);
    ctx.fillStyle = '#f0f2f6';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(d.name.toUpperCase(), w / 2, h * 0.2 + 30);
    ctx.fillStyle = 'rgba(235,240,250,0.66)';
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillText(d.subtitle, w / 2, h * 0.2 + 52);
    ctx.restore();
  }

  /**
   * Suggerimenti contestuali, impilati verso l'alto. Le azioni dei negozi arrivano
   * già pronte da `shops.actions`: l'HUD non decide cosa si può fare, lo mostra.
   */
  drawHints(ctx, game, w, h) {
    const p = game.player;
    const lines = [];
    for (const a of game.shops ? game.shops.actions : []) lines.push(`${a.key}  —  ${a.text}`);
    if (!game.indoors) {
      if (p.onFoot) {
        const v = p.findNearbyVehicle(game);
        if (v) lines.push(`E  —  sali in ${VEHICLE_TYPES[v.kind].label}`);
      } else if (VEHICLE_TYPES[p.vehicle.kind].air) {
        // Comandi di volo: sono l'unica cosa in tutto il gioco che non si indovina
        // dai tasti di guida, quindi restano scritti finché si è a bordo.
        lines.push('SPAZIO  —  sali   ·   SHIFT  —  scendi');
        if (p.vehicle.z <= 6) lines.push('E  —  scendi');
      } else if (Math.abs(p.vehicle.speed) < 40) {
        lines.push('E  —  scendi');
      }
    }
    if (!lines.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 14px system-ui, "Apple SD Gothic Neo", sans-serif';
    let y = h - 62;
    for (const text of lines) {
      const tw = ctx.measureText(text).width + 26;
      ctx.fillStyle = 'rgba(12,14,18,0.78)';
      roundPath(ctx, w / 2 - tw / 2, y, tw, 30, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#eef1f6';
      ctx.fillText(text, w / 2, y + 20);
      y -= 34;
    }
    ctx.restore();
  }

  drawMessages(ctx, w, h) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 15px system-ui, sans-serif';
    let y = h * 0.32;
    for (const m of this.messages) {
      const a = Math.min(1, m.t / 0.6);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(10,12,16,0.7)';
      const tw = ctx.measureText(m.text).width + 24;
      roundPath(ctx, w / 2 - tw / 2, y - 19, tw, 27, 7);
      ctx.fill();
      ctx.fillStyle = '#f2f5fa';
      ctx.fillText(m.text, w / 2, y);
      y += 34;
    }
    ctx.restore();
  }

  drawDebug(ctx, game, w, h) {
    const lines = [
      `fps ${game.loop.fps}`,
      `veicoli ${game.vehicles.length}  pedoni ${game.peds.length}`,
      `edifici ${this.city.stats.buildings}  props ${this.city.stats.props}`,
      `nodi ${this.city.stats.nodes}  archi ${this.city.stats.edges}`,
      `scalinate ${this.city.stats.stairs}  ostili ${game.peds.filter((p) => p.hostile).length}`,
      `wanted ${game.wanted.level}  heat ${game.wanted.heat.toFixed(0)}  ${game.wanted.seen ? 'visto' : `fuga ${game.wanted.unseenT.toFixed(1)}s`}`,
      `polizia ${game.police.cops.length}p ${game.police.cars.length}v  blocchi ${game.police.blocks.length}`,
      `esplosivi ${game.projectiles.items.length}v ${game.projectiles.mines.length}m ${game.projectiles.fires.length}f  scoppi ${game.stats.blasts || 0}`,
      game.indoors
        ? `dentro ${game.shops.floor.biz.id} piano ${game.shops.active.cur + 1}/${game.shops.active.floors.length}  gente ${game.shops.floor.people.length}`
        : `negozi ${this.city.stats.shops} locali ${this.city.stats.venues}  ₩${game.player.money}`,
      `pos ${Math.round(game.player.x)}, ${Math.round(game.player.y)}`,
      `zoom ${game.camera.zoom.toFixed(2)}`,
    ];
    ctx.save();
    ctx.font = '500 12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(w - 296, 14, 282, lines.length * 16 + 12);
    ctx.fillStyle = '#8ff0c0';
    lines.forEach((l, i) => ctx.fillText(l, w - 286, 32 + i * 16));
    ctx.restore();
  }
}

/** Stella a cinque punte centrata in (cx,cy). */
function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.44;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function roundPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
