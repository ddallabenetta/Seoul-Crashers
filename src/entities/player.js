// Jae-min Seo: a piedi o al volante. Un solo stato commuta tutto il controllo.
import { circleRectPush, clamp, approachAngle, damp, dist } from '../core/math.js';
import { VEHICLE_TYPES } from '../render/sprites.js';
import { vehicleDoorPoint, updateVehicle } from './vehicle.js';
import { WEAPONS, WEAPON_ORDER, WEAPON_SLOTS, shoot, meleeSwing, assistAim } from './weapons.js';

const WALK = 74;
const SPRINT = 126;
const RADIUS = 9;
const ENTER_RANGE = 78;
// Tempo a terra prima di risvegliarsi all'ospedale.
const DEATH_TIME = 2.8;
// Un tasto per fila della barra armi: ripremendolo si scorre la fila.
const WEAPON_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
// Quanto la camera si sposta verso il mirino col fucile di precisione, e il tetto
// oltre il quale non va: senza tetto il punto fisso fra camera e cursore scappa via.
const SCOPE_LEAD = 0.5;
const SCOPE_MAX = 300;
// Calore delle canne, e vale solo per le armi con `spinUp` (oggi la sola minigun):
// una SMG che si inceppa non la vuole nessuno. `HEAT_TIME` è la raffica continua
// che si può tenere prima dell'inceppamento — 4,5 s, cioè un centinaio di colpi
// sui 600 del nastro: le raffiche lunghe restano possibili, svuotare il nastro
// tutto di fila no. `HEAT_OK` è la soglia sotto cui riparte, `HEAT_GRACE` il
// respiro prima che cominci a raffreddare (senza, raffredda mentre spara).
const HEAT_TIME = 4.5;
const HEAT_COOL = 0.16;
const HEAT_OK = 0.35;
const HEAT_GRACE = 0.35;
// Quanto scivola il passo sull'asfalto bagnato: con `wet` a 1 il tempo di
// dimezzamento della velocità passa da 0.055 a 0.088 s, cioè 2,4 px di spazio
// d'arresto in più (3,8 → 6,2) e 0,11 s in più per fermarsi. Volutamente poco: il
// combattimento a piedi è mira col mouse più passo laterale, e un protagonista
// che pattina lo cancella. A 0.8 lo spazio d'arresto raddoppiava e si sentiva.
const WET_SLIDE = 0.6;

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
    // Contanti e guardaroba (fase 3): si spendono nei negozi, si rifanno svuotando
    // le casse. L'abito cambia solo il colore del bomber (vedi `HERO_OUTFITS`).
    this.money = 60000;
    this.outfit = 0;

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
    // Tappa C: rotazione delle canne della minigun, mirino del fucile di precisione,
    // e il lampo della barra armi quando si cambia arma.
    this.spin = 0;
    this.scoping = false;
    this.weaponT = 0;
    // Calore delle canne (0..1) e inceppamento: li legge l'HUD, li scrive solo
    // `attack` e il raffreddamento qui sotto.
    this.heat = 0;
    this.overheated = false;
    this.heatCd = 0;
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
    this.weaponT = Math.max(0, this.weaponT - dt);
    this.updateHeat(dt, game);

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

    // Dentro un negozio le coordinate sono quelle della pianta, non della città:
    // chiedere il distretto qui darebbe un cartello a ogni passo.
    if (game.indoors) return;
    const d = game.city.districtAt(this.x, this.y);
    if (d !== this.district) {
      const prev = this.district;
      this.district = d;
      if (prev) game.onDistrictChange(d);
    }
  }

  /**
   * Le canne si raffreddano da ferme, non mentre sparano: senza il respiro di
   * `HEAT_GRACE` il calore che sale e quello che scende si annullerebbero e il
   * nastro finirebbe prima dell'inceppamento. Sopra 1 la canna si pianta e non
   * riparte finché non è scesa sotto `HEAT_OK` — e nel frattempo le canne
   * rallentano, così il mirino dice che l'arma non è pronta invece di mentire.
   */
  updateHeat(dt, game) {
    this.heatCd = Math.max(0, this.heatCd - dt);
    if (this.heat > 0 && this.heatCd <= 0) {
      this.heat = Math.max(0, this.heat - dt * HEAT_COOL);
    }
    if (!this.overheated && this.heat >= 1) {
      this.overheated = true;
      game.hud.toast('Canne surriscaldate — lascia raffreddare', 1.8);
      game.fx.addSmoke(this.x, this.y, 7, 1.2);
      game.audio?.dryFire(this.x, this.y);
    } else if (this.overheated) {
      if (Math.random() < dt * 6) game.fx.addSmoke(this.x, this.y, 1, 0.9);
      if (this.heat <= HEAT_OK) this.overheated = false;
    }
  }

  /**
   * Barra armi: tasti 1-6 (una fila per tasto, ripremendo si scorre la fila) e
   * rotella su tutto l'arsenale posseduto. Con undici armi i tasti singoli non
   * bastano più, e la sola rotella vorrebbe dieci scatti per cambiare idea.
   */
  selectWeapon(game) {
    const input = game.input;
    for (let i = 0; i < WEAPON_KEYS.length; i++) {
      if (!input.wasPressed(WEAPON_KEYS[i])) continue;
      const row = WEAPON_SLOTS[i].filter((id) => this.owned.has(id));
      if (!row.length) {
        game.hud.toast(`${WEAPONS[WEAPON_SLOTS[i][0]].label}: non ce l'hai`, 1.3);
        game.audio?.ui('deny');
        continue;
      }
      // Se l'arma in mano non è di questa fila, indexOf dà -1 e si parte dalla prima.
      this.setWeapon(row[(row.indexOf(this.weapon) + 1) % row.length]);
      // Lo scatto della barra sta qui e non in `setWeapon`: è il suono del *tasto*,
      // e una raccolta a terra che cambia l'arma in mano non deve produrlo.
      game.audio?.weaponSwitch();
    }
    if (input.mouse.wheel) {
      const list = WEAPON_ORDER.filter((id) => this.owned.has(id));
      const i = list.indexOf(this.weapon);
      this.setWeapon(list[(i + (input.mouse.wheel > 0 ? 1 : list.length - 1)) % list.length]);
      game.audio?.weaponSwitch();
    }
  }

  setWeapon(id) {
    if (!id || id === this.weapon) return;
    this.weapon = id;
    this.weaponT = 1.8; // la barra armi si accende: con undici armi serve
    this.spin = 0;      // la minigun riparte da ferma
    this.fireCd = Math.max(this.fireCd, 0.12);
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
    const spec0 = this.spec;
    const mv = input.moveVector();
    const sprinting = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    if (sprinting && mv.len > 0.1) this.stamina = Math.max(0, this.stamina - dt * 0.22);
    else this.stamina = Math.min(1, this.stamina + dt * 0.3);
    const canSprint = sprinting && this.stamina > 0.02 && !spec0.heavy;
    let target = canSprint ? SPRINT : WALK;
    // Con la minigun in braccio si cammina, punto: è il prezzo di 600 colpi.
    if (spec0.heavy) target *= spec0.heavy;
    // La pendenza si sente anche a piedi: in salita si arranca, in discesa si corre.
    if (mv.len > 0.05 && game.city.elevationAt && !game.indoors) {
      const el = game.city.elevationAt;
      const p = 30;
      const slope = (el(this.x + mv.x * p, this.y + mv.y * p) - el(this.x, this.y)) / p;
      target *= clamp(1 - slope * 3.2, 0.62, 1.3);
    }

    const tvx = mv.x * target;
    const tvy = mv.y * target;
    // Sul bagnato le suole tengono meno: si parte e ci si ferma con un filo di
    // ritardo in più. Dentro un negozio il pavimento è asciutto, qualunque tempo
    // faccia fuori.
    const wet = game.indoors ? 0 : game.dayCycle.wet;
    const grip = 0.055 * (1 + wet * WET_SLIDE);
    this.vx = damp(this.vx, tvx, grip, dt);
    this.vy = damp(this.vy, tvy, grip, dt);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // A piedi si guarda sempre il cursore: camminare di lato tenendo il mirino
    // addosso a qualcuno è metà del combattimento in una visuale dall'alto.
    this.angle = approachAngle(this.angle, this.aimAngle, 18 * dt);
    this.animT += mv.len > 0.05 ? this.speed * dt * 0.16 : dt * 1.2;

    this.resolveCollisions(game);

    // Il mare e il Han sono un confine vero, non uno sfondo: a piedi si annega.
    // Il controllo va saltato dentro un edificio — le coordinate di una pianta
    // sono piccole e cadrebbero tutte dentro il mare, all'angolo nord-ovest.
    if (!game.indoors && game.city.isWater(this.x, this.y)) {
      game.fx.addSplash?.(this.x, this.y);
      game.hud.toast('Sei finito in acqua', 2.4);
      this.die(game);
      return;
    }

    // Sulla soglia di un negozio `E` entra, non ruba l'auto parcheggiata dietro:
    // la porta ha un raggio molto più stretto, quindi vince lei.
    if (input.wasPressed('KeyE') && this.enterCooldown <= 0 && !game.shops?.near) {
      const v = this.findNearbyVehicle(game);
      if (v) this.enterVehicle(v, game);
    }

    // Anche per le automatiche vale il fronte del click: un tap secco che comincia
    // e finisce dentro lo stesso frame deve sparare lo stesso.
    const spec = this.spec;
    const held = input.mouse.pressed || ((spec.melee || spec.auto) && input.mouse.down);

    // Minigun: le canne devono arrivare in giro prima che parta il primo colpo, e
    // rallentano da sole appena molli il grilletto. È tutto il carattere dell'arma.
    // Da inceppata rallentano comunque: rimettere in giro le canne è il secondo
    // pezzo della penalità, dopo l'attesa.
    if (spec.spinUp) {
      const up = input.mouse.down && !this.overheated;
      this.spin = clamp(this.spin + (up ? dt / spec.spinUp : -dt / (spec.spinUp * 0.7)), 0, 1);
    } else if (this.spin > 0) {
      this.spin = Math.max(0, this.spin - dt * 2);
    }

    // Mirino del fucile di precisione (tasto destro): allarga il campo invece di
    // stringerlo — a 1900 px di gittata il bersaglio è fuori schermo, non lontano.
    this.scoping = !!spec.scope && input.mouse.right;

    if (held && this.fireCd <= 0 && !this.overheated && (!spec.spinUp || this.spin >= 1)) {
      this.attack(game, spec);
    }

    // Dentro un negozio l'inquadratura è la stanza intera, non il personaggio.
    const base = game.indoors ? game.shops.roomZoom(game.camera) : 1.12;
    game.camera.setZoomTarget(this.scoping ? base / spec.scope : base);
  }

  /**
   * Dove guarda la camera. Normalmente il giocatore; col mirino si sposta verso il
   * cursore, ma di poco e con un tetto: la posizione del cursore in coordinate mondo
   * dipende dalla camera, quindi senza limite le due si rincorrerebbero.
   */
  cameraTarget(game) {
    // Interno: la camera inquadra il piano e resta ferma. È la scelta classica per
    // gli interni dall'alto, e qui serve anche a non far scorrere i muri sotto il
    // naso ogni volta che si fa un passo.
    if (game && game.indoors) {
      const f = game.shops.floor;
      return { x: f.w / 2, y: f.h / 2, vx: 0, vy: 0 };
    }
    if (!this.onFoot) {
      const v = this.vehicle;
      return { x: v.x, y: v.y, vx: v.vx, vy: v.vy };
    }
    if (!this.scoping) return { x: this.x, y: this.y, vx: this.vx, vy: this.vy };
    let ox = (this.aimX - this.x) * SCOPE_LEAD;
    let oy = (this.aimY - this.y) * SCOPE_LEAD;
    const l = Math.hypot(ox, oy);
    if (l > SCOPE_MAX) { ox = (ox / l) * SCOPE_MAX; oy = (oy / l) * SCOPE_MAX; }
    return { x: this.x + ox, y: this.y + oy, vx: 0, vy: 0 };
  }

  /** Un colpo dell'arma corrente, dalla posizione attuale verso il cursore. */
  attack(game, spec) {
    if (spec.melee) {
      this.fireCd = spec.rate;
      // Una mazzata a vuoto non è un reato: la centrale se ne accorge solo se
      // qualcosa (o qualcuno) l'ha incassata.
      if (meleeSwing(game, this, spec, this.x, this.y, this.angle)) {
        game.wanted?.report('brawl', game);
      }
      game.alarm(this.x, this.y, 170, this);
      return;
    }
    if (spec.thrown) {
      this.useThrown(game, spec);
      return;
    }
    if (this.shots <= 0) {
      this.fireCd = 0.3;
      game.hud.toast(`${spec.label}: caricatore vuoto`, 1.2);
      game.audio?.dryFire(this.x, this.y);
      return;
    }
    this.fireCd = spec.rate;
    this.ammo[spec.id]--;
    // Il calore si conta a colpi, non a secondi di grilletto: così `HEAT_TIME`
    // resta la raffica utile qualunque cadenza abbia l'arma, e finire le munizioni
    // interrompe anche il surriscaldamento.
    if (spec.spinUp) {
      this.heat = Math.min(1.15, this.heat + spec.rate / HEAT_TIME);
      this.heatCd = HEAT_GRACE;
    }
    game.wanted?.report('gunshot', game);
    const ang = assistAim(game, this.x, this.y, this.angle, spec.range, this);
    // Un fucile di precisione sparato all'anca è un fucile di precisione sprecato.
    const spreadMul = spec.scope && !this.scoping ? 9 : 1;
    shoot(game, this, spec, this.x + Math.cos(ang) * 15, this.y + Math.sin(ang) * 15, ang, { spreadMul });
    game.camera.addShake(spec.shake);
    // Il rinculo si vede: il personaggio arretra di poco.
    this.vx -= Math.cos(ang) * spec.shake * 7;
    this.vy -= Math.sin(ang) * spec.shake * 7;
  }

  /**
   * Esplosivi. Le mine si posano dietro di sé (o si sganciano dalla coda dell'auto),
   * il resto vola verso il cursore: la gittata del lancio è la distanza del mirino,
   * quindi si mira dove si vuole che cada.
   */
  useThrown(game, spec, vehicle = null) {
    if (this.shots <= 0) {
      this.fireCd = 0.35;
      game.hud.toast(`${spec.label}: finite`, 1.2);
      game.audio?.dryFire(this.x, this.y);
      return;
    }
    this.fireCd = spec.rate;
    this.ammo[spec.id]--;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    if (spec.placed) {
      // Dall'auto la mina cade dalla coda: seminarla dietro di sé in corsa è mezzo
      // motivo per averla.
      const back = vehicle ? 46 : 16;
      const bx = (vehicle ? vehicle.x : this.x) - cos * back;
      const by = (vehicle ? vehicle.y : this.y) - sin * back;
      game.projectiles.place(game, this, spec, bx, by);
      game.hud.toast('mina posata — si arma quando ti allontani', 1.8);
      game.audio?.beep(bx, by);
      return;
    }

    const ang = vehicle ? this.aimAngle : this.angle;
    const ox = (vehicle ? vehicle.x : this.x) + Math.cos(ang) * (vehicle ? 30 : 16);
    const oy = (vehicle ? vehicle.y : this.y) + Math.sin(ang) * (vehicle ? 30 : 16);
    const reach = dist(ox, oy, this.aimX, this.aimY);
    game.projectiles.throwItem(game, this, spec, ox, oy, ang, reach);
    game.audio?.throwItem(ox, oy);
    game.camera.addShake(spec.shake * 0.35);
    // Una molotov che vola in mezzo alla strada la vede tutto l'isolato, e non la si
    // scambia per una lite finita male: pesa il doppio di uno sparo.
    game.wanted?.report('blast', game);
    game.alarm(ox, oy, 300, this);
  }

  updateDriving(dt, game) {
    const input = game.input;
    const v = this.vehicle;
    if (!v) {
      this.onFoot = true;
      return;
    }
    const vspec = VEHICLE_TYPES[v.kind];
    v.throttle = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    v.steer = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    if (vspec.air) {
      // In volo lo spazio non è il freno a mano: è la cloche. Shift scende.
      v.climb = (input.isDown('Space') ? 1 : 0)
        - (input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? 1 : 0);
      v.handbrake = false;
    } else {
      v.handbrake = input.isDown('Space');
    }

    // La fisica del mezzo del giocatore gira qui: il sistema del traffico lo salta.
    updateVehicle(v, dt, game);

    this.x = v.x;
    this.y = v.y;
    this.angle = v.angle;
    this.vx = v.vx;
    this.vy = v.vy;

    if (input.wasPressed('KeyE') && this.enterCooldown <= 0) {
      if (v.z > 8) game.hud.toast('Prima atterra (Shift per scendere)', 1.6);
      else this.exitVehicle(game);
    }
    if (input.wasPressed('KeyH')) game.audio?.honk(v);

    // Drive-by: dal finestrino si usano solo le armi che si tengono con una mano
    // (`driveby: false` esclude fucile, sniper e minigun), e si mira peggio quanto
    // più si va forte. Molotov e mine invece dall'auto ci stanno benissimo.
    const gun = this.spec;
    if (!gun.melee && gun.driveby !== false) {
      const held = input.mouse.pressed || (gun.auto && input.mouse.down);
      if (held && this.fireCd <= 0) {
        if (gun.thrown) this.useThrown(game, gun, v);
        else this.driveBy(game, gun, v);
      }
    }
    this.scoping = false;
    this.spin = 0;

    const frac = Math.min(1, Math.abs(v.speed) / vspec.topSpeed);
    // In quota la camera si allarga: senza, si vola alla cieca sopra i tetti.
    const alt = vspec.air ? Math.min(1, v.z / vspec.ceiling) * 0.34 : 0;
    game.camera.setZoomTarget(1.0 - frac * 0.16 - alt);

    if (v.dead) this.exitVehicle(game, true);
  }

  driveBy(game, spec, v) {
    if (this.shots <= 0) {
      this.fireCd = 0.4;
      game.hud.toast(`${spec.label}: caricatore vuoto`, 1.2);
      game.audio?.dryFire(v.x, v.y);
      return;
    }
    this.fireCd = spec.rate * 1.5;
    this.ammo[spec.id]--;
    game.wanted?.report('gunshot', game);
    const ang = this.aimAngle;
    const sway = 1 + Math.abs(v.speed) / 240;
    shoot(game, this, spec, v.x + Math.cos(ang) * 26, v.y + Math.sin(ang) * 26, ang, {
      spreadMul: 2.4 * sway,
      ignoreVehicle: v,
    });
    game.camera.addShake(spec.shake * 0.6);
  }

  resolveCollisions(game) {
    // `game.area()` è la città o la pianta del piano in cui si è entrati: muri e
    // limiti hanno la stessa forma, quindi qui non serve sapere dove siamo.
    const area = game.area();
    const solids = area.grid.queryRect(this.x - 30, this.y - 30, 60, 60);
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
    this.x = clamp(this.x, area.x0, area.x1);
    this.y = clamp(this.y, area.y0, area.y1);
  }

  findNearbyVehicle(game) {
    let best = null;
    let bestD = ENTER_RANGE;
    for (const v of game.vehicles) {
      if (v.dead || v.driver === 'player') continue;
      // Un battello è lungo 154 px: dal molo il suo centro è più lontano del
      // raggio buono per una berlina, e senza questo non ci si sale mai.
      const spec = VEHICLE_TYPES[v.kind];
      const d = dist(this.x, this.y, v.x, v.y) - spec.len * 0.3;
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  enterVehicle(v, game) {
    const wasOccupied = v.driver === 'ai' || v.driver === 'cop';
    // Chi era al volante viene sbalzato fuori.
    if (v.driver === 'ai' && v.ai) {
      game.traffic.ejectDriver(v, game);
    }
    if (v.copUnit) game.police?.releaseVehicle(v, game);
    game.traffic?.releaseMoored(v);
    v.occupiedTheft = wasOccupied;
    v.driver = 'player';
    v.ai = null;
    v.awake = true;
    v.handbrake = false;
    v.lightsOn = game.isNight ? true : v.lightsOn;
    this.vehicle = v;
    this.onFoot = false;
    this.enterCooldown = 0.35;
    game.audio?.doorClose(v.x, v.y);
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

    // Da una barca si sbarca a terra, non in mare: i punti d'uscita bagnati non
    // valgono, e se non ce n'è uno asciutto non si scende affatto.
    const wet = (c) => !game.indoors && game.city.isWater(c.x, c.y);
    let placed = false;
    for (const c of candidates) {
      if (!forced && wet(c)) continue;
      const solids = game.area().grid.queryRect(c.x - 24, c.y - 24, 48, 48);
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
      if (!forced && (spec.marine || wet(door))) {
        game.hud.toast('Accosta a un molo per scendere', 1.8);
        return;
      }
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
    game.audio?.doorClose(this.x, this.y);
    game.onExitVehicle?.(v);
  }

  /** Danno subito: `dx,dy` è la direzione da cui arriva il colpo. */
  damage(dmg, dx, dy, game) {
    if (this.dying) return;
    this.hp -= dmg;
    this.hurtT = 0.4;
    game.camera.addShake(Math.min(9, dmg * 0.35));
    game.audio?.hurt(this.x, this.y, true);
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
    this.ammo = {};
    this.weapon = 'fists';
    this.spin = 0;
    this.scoping = false;
    this.heat = 0;
    this.overheated = false;
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
    // Il cambio automatico vale solo in salita: nessuno vuole ritrovarsi la mazza
    // mentre imbraccia una SMG, né tre granate al posto del fucile.
    if (cur.melee && !spec.thrown && (!spec.melee || this.weapon === 'fists')) this.setWeapon(id);
    else this.weaponT = 1.8;
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
