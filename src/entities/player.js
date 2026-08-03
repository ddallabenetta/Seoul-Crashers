// Jae-min Seo: a piedi o al volante. Un solo stato commuta tutto il controllo.
import { circleRectPush, clamp, approachAngle, damp, dist } from '../core/math.js';
import { PED_KINDS, VEHICLE_TYPES } from '../render/sprites.js';
import { vehicleDoorPoint, updateVehicle } from './vehicle.js';
import { WEAPONS, WEAPON_ORDER, shoot, meleeSwing, assistAim } from './weapons.js';

const WALK = 74;
const SPRINT = 126;
const RADIUS = 9;
const ENTER_RANGE = 78;
// Tempo a terra prima di risvegliarsi all'ospedale.
const DEATH_TIME = 2.8;
const WEAPON_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.vx = 0;
    this.vy = 0;
    this.onFoot = true;
    this.vehicle = null;
    this.animT = 0;
    this.colorIndex = 0;
    this.kind = 'player';
    this.hp = 100;
    this.maxHp = 100;
    this.enterCooldown = 0;
    this.stamina = 1;
    this.district = null;

    // Arsenale. Si parte con i pugni e una pistola: il resto si raccoglie in giro,
    // e alla morte resta solo quello che non si può perdere.
    this.owned = new Set(['fists', 'pistol']);
    this.ammo = { pistol: 60, smg: 0 };
    this.weapon = 'pistol';
    this.fireCd = 0;
    this.aimX = x + 40;
    this.aimY = y;
    this.aimAngle = 0;
    this.hurtT = 0;
    this.dying = false;
    this.deathT = 0;
  }

  get spec() {
    return WEAPONS[this.weapon];
  }

  /** Colpi rimasti per l'arma corrente; Infinity per pugni e mazza. */
  get shots() {
    const s = this.spec;
    return s.infinite ? Infinity : (this.ammo[s.id] || 0);
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  update(dt, game) {
    this.enterCooldown = Math.max(0, this.enterCooldown - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);

    // Il puntatore vale sempre: da fermo, in corsa e al volante.
    const m = game.camera.screenToWorld(game.input.mouse.x, game.input.mouse.y);
    this.aimX = m.x;
    this.aimY = m.y;
    if (dist(this.x, this.y, m.x, m.y) > 22) {
      this.aimAngle = Math.atan2(m.y - this.y, m.x - this.x);
    }

    if (this.dying) {
      this.updateDying(dt, game);
      return;
    }

    this.selectWeapon(game);
    if (this.onFoot) this.updateOnFoot(dt, game);
    else this.updateDriving(dt, game);

    const d = game.city.districtAt(this.x, this.y);
    if (d !== this.district) {
      const prev = this.district;
      this.district = d;
      if (prev) game.onDistrictChange(d);
    }
  }

  /** Tasti 1-4 e rotella, ma solo fra le armi che si possiedono davvero. */
  selectWeapon(game) {
    const input = game.input;
    for (let i = 0; i < WEAPON_KEYS.length; i++) {
      if (!input.wasPressed(WEAPON_KEYS[i])) continue;
      const id = WEAPON_ORDER[i];
      if (this.owned.has(id)) this.weapon = id;
      else game.hud.toast(`${WEAPONS[id].label}: non ce l'hai`, 1.4);
    }
    if (input.mouse.wheel) {
      const list = WEAPON_ORDER.filter((id) => this.owned.has(id));
      const i = list.indexOf(this.weapon);
      this.weapon = list[(i + (input.mouse.wheel > 0 ? 1 : list.length - 1)) % list.length];
    }
  }

  updateDying(dt, game) {
    this.deathT += dt;
    this.vx = damp(this.vx, 0, 0.12, dt);
    this.vy = damp(this.vy, 0, 0.12, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.deathT >= DEATH_TIME) game.respawnPlayer();
  }

  updateOnFoot(dt, game) {
    const input = game.input;
    const mv = input.moveVector();
    const sprinting = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    if (sprinting && mv.len > 0.1) this.stamina = Math.max(0, this.stamina - dt * 0.22);
    else this.stamina = Math.min(1, this.stamina + dt * 0.3);
    const canSprint = sprinting && this.stamina > 0.02;
    let target = canSprint ? SPRINT : WALK;
    // La pendenza si sente anche a piedi: in salita si arranca, in discesa si corre.
    if (mv.len > 0.05 && game.city.elevationAt) {
      const el = game.city.elevationAt;
      const p = 30;
      const slope = (el(this.x + mv.x * p, this.y + mv.y * p) - el(this.x, this.y)) / p;
      target *= clamp(1 - slope * 3.2, 0.62, 1.3);
    }

    const tvx = mv.x * target;
    const tvy = mv.y * target;
    this.vx = damp(this.vx, tvx, 0.055, dt);
    this.vy = damp(this.vy, tvy, 0.055, dt);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // A piedi si guarda sempre il cursore: camminare di lato tenendo il mirino
    // addosso a qualcuno è metà del combattimento in una visuale dall'alto.
    this.angle = approachAngle(this.angle, this.aimAngle, 18 * dt);
    this.animT += mv.len > 0.05 ? this.speed * dt * 0.16 : dt * 1.2;

    this.resolveCollisions(game);

    if (input.wasPressed('KeyE') && this.enterCooldown <= 0) {
      const v = this.findNearbyVehicle(game);
      if (v) this.enterVehicle(v, game);
    }

    // Anche per le automatiche vale il fronte del click: un tap secco che comincia
    // e finisce dentro lo stesso frame deve sparare lo stesso.
    const spec = this.spec;
    const held = input.mouse.pressed || ((spec.melee || spec.auto) && input.mouse.down);
    if (held && this.fireCd <= 0) this.attack(game, spec);

    game.camera.setZoomTarget(1.12);
  }

  /** Un colpo dell'arma corrente, dalla posizione attuale verso il cursore. */
  attack(game, spec) {
    if (spec.melee) {
      this.fireCd = spec.rate;
      meleeSwing(game, this, spec, this.x, this.y, this.angle);
      game.alarm(this.x, this.y, 170, this);
      return;
    }
    if (this.shots <= 0) {
      this.fireCd = 0.3;
      game.hud.toast(`${spec.label}: caricatore vuoto`, 1.2);
      return;
    }
    this.fireCd = spec.rate;
    this.ammo[spec.id]--;
    const ang = assistAim(game, this.x, this.y, this.angle, spec.range, this);
    shoot(game, this, spec, this.x + Math.cos(ang) * 15, this.y + Math.sin(ang) * 15, ang);
    game.camera.addShake(spec.shake);
    // Il rinculo si vede: il personaggio arretra di poco.
    this.vx -= Math.cos(ang) * spec.shake * 7;
    this.vy -= Math.sin(ang) * spec.shake * 7;
  }

  updateDriving(dt, game) {
    const input = game.input;
    const v = this.vehicle;
    if (!v) {
      this.onFoot = true;
      return;
    }
    v.throttle = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    v.steer = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    v.handbrake = input.isDown('Space');

    // La fisica del mezzo del giocatore gira qui: il sistema del traffico lo salta.
    updateVehicle(v, dt, game);

    this.x = v.x;
    this.y = v.y;
    this.angle = v.angle;
    this.vx = v.vx;
    this.vy = v.vy;

    if (input.wasPressed('KeyE') && this.enterCooldown <= 0) this.exitVehicle(game);
    if (input.wasPressed('KeyH')) game.audio?.honk(v);

    // Drive-by: dal finestrino si usano solo le armi leggere, e si mira peggio
    // quanto più si va forte.
    const gun = this.spec;
    if (!gun.melee) {
      const held = input.mouse.pressed || (gun.auto && input.mouse.down);
      if (held && this.fireCd <= 0) this.driveBy(game, gun, v);
    }

    const spec = VEHICLE_TYPES[v.kind];
    const frac = Math.min(1, Math.abs(v.speed) / spec.topSpeed);
    game.camera.setZoomTarget(1.0 - frac * 0.16);

    if (v.dead) this.exitVehicle(game, true);
  }

  driveBy(game, spec, v) {
    if (this.shots <= 0) {
      this.fireCd = 0.4;
      game.hud.toast(`${spec.label}: caricatore vuoto`, 1.2);
      return;
    }
    this.fireCd = spec.rate * 1.5;
    this.ammo[spec.id]--;
    const ang = this.aimAngle;
    const sway = 1 + Math.abs(v.speed) / 240;
    shoot(game, this, spec, v.x + Math.cos(ang) * 26, v.y + Math.sin(ang) * 26, ang, {
      spreadMul: 2.4 * sway,
      ignoreVehicle: v,
    });
    game.camera.addShake(spec.shake * 0.6);
  }

  resolveCollisions(game) {
    const solids = game.city.solidGrid.queryRect(this.x - 30, this.y - 30, 60, 60);
    for (const s of solids) {
      if (s.vehicleOnly) continue; // le scalinate si salgono a piedi
      const push = circleRectPush(this.x, this.y, RADIUS, s);
      if (!push) continue;
      this.x += push.nx * push.depth;
      this.y += push.ny * push.depth;
      const vn = this.vx * push.nx + this.vy * push.ny;
      if (vn < 0) {
        this.vx -= push.nx * vn;
        this.vy -= push.ny * vn;
      }
    }
    this.x = clamp(this.x, 40, game.city.w - 40);
    this.y = clamp(this.y, 40, game.city.h - 40);
  }

  findNearbyVehicle(game) {
    let best = null;
    let bestD = ENTER_RANGE;
    for (const v of game.vehicles) {
      if (v.dead || v.driver === 'player') continue;
      const d = dist(this.x, this.y, v.x, v.y);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  enterVehicle(v, game) {
    // Chi era al volante viene sbalzato fuori.
    if (v.driver === 'ai' && v.ai) {
      game.traffic.ejectDriver(v, game);
    }
    v.driver = 'player';
    v.ai = null;
    v.awake = true;
    v.handbrake = false;
    v.lightsOn = game.isNight ? true : v.lightsOn;
    this.vehicle = v;
    this.onFoot = false;
    this.enterCooldown = 0.35;
    game.audio?.doorClose();
    game.onEnterVehicle?.(v);
  }

  exitVehicle(game, forced = false) {
    const v = this.vehicle;
    if (!v) return;
    const spec = VEHICLE_TYPES[v.kind];
    // Non si scende in corsa, a meno che il mezzo sia distrutto.
    if (!forced && Math.abs(v.speed) > 90) return;

    const candidates = [];
    const door = vehicleDoorPoint(v);
    candidates.push(door);
    const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
    const side = spec.wid * 0.62;
    candidates.push({ x: v.x + sin * side, y: v.y - cos * side });
    candidates.push({ x: v.x - cos * (spec.len * 0.6 + 14), y: v.y - sin * (spec.len * 0.6 + 14) });
    candidates.push({ x: v.x + cos * (spec.len * 0.6 + 14), y: v.y + sin * (spec.len * 0.6 + 14) });

    let placed = false;
    for (const c of candidates) {
      const solids = game.city.solidGrid.queryRect(c.x - 24, c.y - 24, 48, 48);
      let blocked = false;
      for (const s of solids) {
        if (circleRectPush(c.x, c.y, RADIUS + 2, s)) { blocked = true; break; }
      }
      if (!blocked) {
        this.x = c.x;
        this.y = c.y;
        placed = true;
        break;
      }
    }
    if (!placed) {
      this.x = door.x;
      this.y = door.y;
    }

    this.vx = v.vx * 0.3;
    this.vy = v.vy * 0.3;
    v.driver = null;
    v.throttle = 0;
    v.steer = 0;
    v.handbrake = true;
    this.vehicle = null;
    this.onFoot = true;
    this.enterCooldown = 0.35;
    game.audio?.doorClose();
    game.onExitVehicle?.(v);
  }

  /** Danno subito: `dx,dy` è la direzione da cui arriva il colpo. */
  damage(dmg, dx, dy, game) {
    if (this.dying) return;
    this.hp -= dmg;
    this.hurtT = 0.4;
    game.camera.addShake(Math.min(9, dmg * 0.35));
    if (this.onFoot) game.fx.addBloodSpray(this.x, this.y, dx, dy, clamp(dmg / 34, 0.4, 1.3));
    if (this.hp <= 0) this.die(game);
  }

  die(game) {
    this.hp = 0;
    this.dying = true;
    this.deathT = 0;
    if (!this.onFoot) this.exitVehicle(game, true);
    game.fx.addBlood(this.x, this.y, 1.8);
    game.onPlayerDeath?.();
  }

  /** Risveglio all'ospedale: HP pieni, arsenale perso. */
  revive(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.hp = this.maxHp;
    this.dying = false;
    this.deathT = 0;
    this.hurtT = 0;
    this.stamina = 1;
    this.owned = new Set(['fists']);
    this.ammo = { pistol: 0, smg: 0 };
    this.weapon = 'fists';
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * Raccolta di un'arma. Il cambio in mano è automatico solo se quello che hai
   * è peggio: nessuno vuole ritrovarsi la mazza mentre imbraccia una SMG.
   */
  giveWeapon(id, ammo = 0) {
    const spec = WEAPONS[id];
    this.owned.add(id);
    if (!spec.infinite) this.ammo[id] = Math.min(spec.maxAmmo, (this.ammo[id] || 0) + ammo);
    const cur = WEAPONS[this.weapon];
    if (cur.melee && (!spec.melee || this.weapon === 'fists')) this.weapon = id;
  }

  giveAmmo(id, n) {
    const spec = WEAPONS[id];
    if (!spec || spec.infinite) return false;
    if (!this.owned.has(id)) return false;
    const before = this.ammo[id] || 0;
    if (before >= spec.maxAmmo) return false;
    this.ammo[id] = Math.min(spec.maxAmmo, before + n);
    return true;
  }
}
