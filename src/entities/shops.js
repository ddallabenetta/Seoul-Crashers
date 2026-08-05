// Negozi, interni e officine (fase 3).
//
// Il sistema tiene tre cose che sembrano diverse e sono la stessa: un posto in cui
// si **entra** (la pianta la costruisce `world/interiors.js`), un posto in cui si
// **compra** (il listino è qui sotto) e un posto in cui si **paga** (l'officina, in
// cui non si entra a piedi: ci si guida dentro).
//
// Scelte di questa tappa, tutte discutibili in tre righe di codice:
//
// - **Dentro, la città si ferma.** Traffico, pedoni, polizia e ricercato non girano
//   mentre sei in un negozio. Costa zero CPU ed elimina la domanda "cosa succede
//   fuori mentre compro": niente. Il ricercato resta congelato, quindi entrare non
//   è una scappatoia gratis — per quello c'è l'officina, e si paga.
// - **La polizia non entra.** Un inseguimento dentro un 편의점 vorrebbe dire portare
//   il pathfinding, lo streaming e le volanti in uno spazio di 300 px. Chi ti
//   aspetta, ti aspetta fuori: esci esattamente com'eri entrato.
// - **L'interno si ricorda.** La pianta nasce alla prima visita e resta in cache:
//   la cassa che hai svuotato resta vuota e il commesso che hai steso resta a terra.
//   L'orario **no**: si rilegge a ogni arrivo su un piano (`showFloor`), o resterebbe
//   congelato a quello della prima visita.
// - **Comprare è `E`, rapinare è `F`.** Sono la stessa distanza dallo stesso bancone:
//   con un tasto solo si finirebbe per rapinare un negozio volendo comprare pallottole.
// - **Le vetrine hanno un orario** (`BUSINESSES[].open`). La porta del palazzo segue
//   il palazzo, non il negozio al piano terra: si entra se almeno un piano è aperto,
//   perché la scala è in comune. Dentro, il locale resta com'era quando ci sei
//   entrato — vedi `showFloor`.
import { Rng } from '../core/rng.js';
import { clamp, damp, dist, approachAngle, circleRectPush, pointInRect } from '../core/math.js';
import { createPed } from './pedestrians.js';
import { WEAPONS, shoot, hasLineOfSight } from './weapons.js';
import { buildInterior, BUSINESSES, bizOpenAt, clockLabel } from '../world/interiors.js';
import { HERO_OUTFITS, VEHICLE_COLORS } from '../render/sprites.js';

const DOOR_REACH = 34;   // quanto ci si deve avvicinare alla porta dalla strada
const DESK_REACH = 54;   // raggio del bancone: comprare e rapinare
const STAIR_PAD = 10;
const GARAGE_PRICE = 30000;
const OUTFIT_PRICE = 40000;

/** ₩ con i punti delle migliaia: un prezzo a sei cifre senza va solo letto male. */
export function won(n) {
  return `₩${Math.round(n).toLocaleString('it-IT')}`;
}

// --- listini -----------------------------------------------------------------
// Un articolo è un oggetto con `buy(game)`: il pannello di `ui/shopmenu.js` non sa
// niente di armi, cure o vestiti, disegna una riga e chiama questa funzione.

function weaponItem(id, mul = 1) {
  const s = WEAPONS[id];
  return {
    key: `w:${id}`,
    label: s.label,
    hangul: s.hangul,
    price: Math.round(s.price * mul),
    detail: (game) => {
      if (s.infinite) return 'non finisce mai';
      if (game.player.owned.has(id)) return `ce l'hai già: ricarica ${s.pickup * 2} colpi`;
      return `${s.pickup * 2} colpi inclusi`;
    },
    buy(game) {
      game.player.giveWeapon(id, s.pickup ? s.pickup * 2 : 0);
      return s.infinite ? s.label : `${s.label} — caricata`;
    },
  };
}

function ammoItem(id) {
  const s = WEAPONS[id];
  const n = s.pickup * 3;
  return {
    key: `a:${id}`,
    label: `munizioni ${s.label}`,
    hangul: '탄약',
    price: s.ammoPrice,
    detail: (game) => `${n} colpi · hai ${game.player.ammo[id] || 0}/${s.maxAmmo}`,
    need: (game) => game.player.owned.has(id),
    buy(game) {
      if (!game.player.giveAmmo(id, n)) return null;
      return `+${n} colpi ${s.label}`;
    },
  };
}

function healItem(key, label, hangul, price, heal) {
  return {
    key,
    label,
    hangul,
    price,
    detail: () => (heal >= 100 ? 'rimette in piedi del tutto' : `+${heal} salute`),
    buy(game) {
      const p = game.player;
      if (p.hp >= p.maxHp) return null;
      p.heal(heal);
      return `${label} — ${Math.round(p.hp)} HP`;
    },
  };
}

const OUTFIT_ITEM = {
  key: 'outfit',
  label: 'cambio d\'abito',
  hangul: '옷 갈아입기',
  price: OUTFIT_PRICE,
  // Uscire vestito diverso è l'unico modo di far calare le stelle senza nasconderti,
  // e costa: senza prezzo sarebbe un pulsante "annulla il ricercato".
  detail: (game) => (game.wanted.level > 0 ? 'e una stella in meno' : 'nuovo colore del bomber'),
  buy(game) {
    const p = game.player;
    p.outfit = (p.outfit + 1) % HERO_OUTFITS.length;
    if (game.wanted.level > 0) {
      game.wanted.drop(game);
      return `${HERO_OUTFITS[p.outfit].label} — non ti riconoscono più`;
    }
    return HERO_OUTFITS[p.outfit].label;
  },
};

/** Listino di un'attività, montato al momento: il banco dei pegni compra da te. */
export function stockFor(bizId, game) {
  switch (bizId) {
    case 'guns':
      return [
        weaponItem('pistol'), ammoItem('pistol'),
        weaponItem('shotgun'), ammoItem('shotgun'),
        weaponItem('smg'), ammoItem('smg'),
        weaponItem('rifle'), ammoItem('rifle'),
        weaponItem('bat'),
      ];
    case 'pawn': {
      // Usato: costa meno e non fa domande. In cambio ricompra il tuo arsenale a
      // meno della metà, che è l'unico modo di trasformare un fucile in contanti.
      const list = [weaponItem('bat', 0.7), weaponItem('katana', 0.75), weaponItem('pistol', 0.72)];
      for (const id of game.player.owned) {
        const s = WEAPONS[id];
        if (!s || s.infinite || !s.price) continue;
        list.push({
          key: `s:${id}`,
          label: `vendi ${s.label}`,
          hangul: '팝니다',
          price: -Math.round(s.price * 0.45),
          detail: () => 'te la ricomprano, munizioni comprese',
          buy(game) {
            game.player.owned.delete(id);
            game.player.ammo[id] = 0;
            if (game.player.weapon === id) game.player.setWeapon('fists');
            return `${s.label} venduta`;
          },
        });
      }
      return list;
    }
    case 'conv':
      return [
        healItem('kimbap', 'triangolo di riso', '삼각김밥', 3000, 20),
        healItem('dosirak', 'schiscetta calda', '도시락', 9000, 55),
        {
          key: 'molotov', label: 'soju e benzina', hangul: '화염병 재료', price: 24000,
          detail: () => 'due molotov, nessuna domanda',
          buy(game) { game.player.giveWeapon('molotov', 2); return 'due molotov nel borsone'; },
        },
      ];
    case 'pharma':
      return [
        healItem('pain', 'antidolorifici', '진통제', 12000, 45),
        healItem('kit', 'kit di pronto soccorso', '구급상자', 26000, 100),
      ];
    case 'food':
      return [
        healItem('soju', 'soju', '소주', 3000, 15),
        healItem('tteok', 'tteokbokki', '떡볶이', 6000, 35),
        healItem('samgyup', 'samgyeopsal', '삼겹살', 16000, 70),
      ];
    case 'clothes':
      return [OUTFIT_ITEM];
    case 'clinic':
      return [
        healItem('visit', 'medicazione', '치료', 14000, 50),
        healItem('surgery', 'ricovero lampo', '입원', 32000, 100),
      ];
    default:
      return [];
  }
}

// --- sistema ------------------------------------------------------------------

export class ShopSystem {
  constructor(city) {
    this.city = city;
    this.cache = new Map();   // interni già visitati, con le loro casse svuotate
    this.active = null;
    this.outside = null;      // dove si torna uscendo
    this.actions = [];        // suggerimenti contestuali per l'HUD
    this.fade = 0;            // nero fra una porta e l'altra
    this.garageT = 0;
    this.robbed = 0;
    this.spent = 0;
    // Porta a portata di mano: la calcola `updateOutside` e la legge anche il
    // giocatore, perché `E` sulla soglia di un negozio non deve rubare l'auto
    // parcheggiata dietro di lui.
    this.near = null;
  }

  get floor() {
    return this.active ? this.active.floors[this.active.cur] : null;
  }

  get indoors() {
    return this.active !== null;
  }

  /**
   * Zoom che fa stare tutto il piano nello schermo. Dentro una stanza la camera
   * non insegue nessuno: inquadra la stanza e sta ferma (vedi `player.cameraTarget`).
   * Una camera che scivola dietro al giocatore in uno spazio di 300 px darebbe solo
   * il mal di mare.
   */
  roomZoom(cam) {
    const f = this.floor;
    if (!f) return 1.12;
    return clamp(Math.min(cam.viewW / (f.w + 130), cam.viewH / (f.h + 130)), 1.15, 2.6);
  }

  // --- ingresso e uscita ------------------------------------------------------

  /** Interno dell'edificio, costruito alla prima visita e poi ricordato. */
  interiorOf(shop) {
    let it = this.cache.get(shop.id);
    if (it) return it;
    it = buildInterior(shop);
    const rng = new Rng((shop.seed ^ 0xbeef) >>> 0);
    for (const f of it.floors) {
      // `staff` è il ruolino del piano e non si tocca più: chi lavora qui è sempre
      // questo, anche mentre il locale è chiuso e in sala non c'è nessuno. Quello
      // che cambia con l'orario è `people`, cioè chi è in sala adesso.
      f.staff = f.npcs.map((d) => {
        const p = createPed(d.kind, d.x, d.y, rng);
        p.home = { x: d.x, y: d.y };
        p.role = d.role;
        p.state = 'post';
        p.indoor = true;
        // Chi tiene una cassa in un posto dove si beve o si vendono armi è armato:
        // è quello che rende una rapina una scelta e non un pulsante.
        if (d.role === 'keeper' && (f.biz.id === 'guns' || f.biz.id === 'bar' || f.biz.id === 'billiards')) {
          p.armed = true;
        }
        return p;
      });
      f.npcs = f.staff;
      f.people = f.staff;
    }
    this.cache.set(shop.id, it);
    return it;
  }

  // --- orari ------------------------------------------------------------------

  /**
   * Un tipo di attività è aperto **adesso**? È l'unica risposta per tutti: la
   * usano la porta, le scale, il bancone e la soglia luminosa di `render/scene.js`.
   */
  isOpen(bizId, game) {
    return bizOpenAt(bizId, game.dayCycle.hour);
  }

  /** Vetrina aperta = **almeno un piano** aperto: la scala è del palazzo, non del negozio. */
  shopOpen(shop, game) {
    return shop.biz.some((id) => this.isOpen(id, game));
  }

  /** Il piano che riapre prima: è l'unica cosa utile da leggere su una porta chiusa. */
  nextOpening(shop, game) {
    const h = game.dayCycle.hour;
    let best = null;
    for (const id of shop.biz) {
      const biz = BUSINESSES[id];
      const wait = (((biz.open[0] - h) % 24) + 24) % 24;
      if (!best || wait < best.wait) best = { biz, at: biz.open[0], wait };
    }
    return best;
  }

  /** Bussare a una porta chiusa: si ottiene il cartello con l'orario, e basta. */
  knock(shop, game) {
    const n = this.nextOpening(shop, game);
    game.hud.toast(`${n.biz.hangul} — apre alle ${clockLabel(n.at)}`, 2.4);
  }

  /** Negozio la cui porta è a portata, se il giocatore è a piedi. */
  nearestDoor(game) {
    const pl = game.player;
    if (!pl.onFoot || pl.dying) return null;
    let best = null;
    let bestD = DOOR_REACH;
    for (const s of this.city.shops) {
      const d = dist(pl.x, pl.y, s.x, s.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  /** Ingresso. Torna `false` se la porta non si apre, ed è l'unico modo di fallire. */
  enter(shop, game) {
    if (!this.shopOpen(shop, game)) {
      this.knock(shop, game);
      return false;
    }
    const pl = game.player;
    this.outside = { x: pl.x, y: pl.y, angle: pl.angle };
    this.active = this.interiorOf(shop);
    this.active.cur = 0;
    this.placeOnFloor(game, this.floor.entry);
    this.showFloor(game, this.floor);
    game.fx.clear();
    game.projectiles.clear();
    game.player.enterCooldown = 0.4;
    game.stats.visits = (game.stats.visits || 0) + 1;
    this.near = null;
    this.fade = 1;
    return true;
  }

  /**
   * Arrivo su un piano, dalla strada o dalla scala. **L'orario si rilegge qui**:
   * la pianta sta in cache da sempre, e se l'apertura ci finisse dentro resterebbe
   * quella della prima visita.
   *
   * Il locale poi resta com'è finché ci sei: la città è già ferma mentre sei
   * dentro (vedi in testa al file), e gente che si smaterializza attorno al
   * giocatore allo scoccare dell'ora sarebbe peggio di un negozio che ti lascia
   * finire di comprare. Chiude quando esci.
   */
  showFloor(game, f) {
    f.openNow = this.isOpen(f.biz.id, game);
    // Chiuso vuol dire vuoto: niente commessi, niente clienti, e la cassa la
    // svuotano loro alla chiusura (vedi `updateInside`). Il ruolino resta in
    // `staff` e torna al turno dopo.
    f.people = f.openNow ? f.staff : [];
    // I pedoni della città restano dove sono: dentro `game.peds` ci va la gente di
    // questo piano, così raggi, mischia e onde d'urto la trovano senza sapere che
    // sono in un interno (vedi `rayCast`, che interroga `game.pedGrid`).
    game.peds = f.people;
    game.pedGrid.rebuild(game.peds);
    game.hud.showVenue(f);
    if (!f.openNow) game.hud.toast(`${f.biz.hangul} — chiuso · apre alle ${clockLabel(f.biz.open[0])}`, 2.6);
  }

  leave(game) {
    if (!this.active) return;
    const shop = this.active.shop;
    const pl = game.player;
    this.forceExit(game);
    pl.x = shop.x + shop.nx * 16;
    pl.y = shop.y + shop.ny * 16;
    pl.vx = 0;
    pl.vy = 0;
    pl.angle = Math.atan2(shop.ny, shop.nx);
    game.camera.snapTo(pl.x, pl.y);
    pl.district = game.city.districtAt(pl.x, pl.y);
  }

  /** Chiude l'interno senza spostare nessuno: lo usa anche la morte in un negozio. */
  forceExit(game) {
    if (!this.active) return;
    this.active = null;
    game.peds = game.pedSystem.peds;
    game.pedGrid.rebuild(game.peds);
    game.fx.clear();
    // Una mina lasciata in un negozio resterebbe armata in coordinate che fuori non
    // significano niente: gli esplosivi non attraversano la porta, in nessun senso.
    game.projectiles.clear();
    game.player.enterCooldown = 0.4;
    this.fade = 1;
  }

  /**
   * Scala. **Al piano chiuso si sale lo stesso**: la tromba delle scale è del
   * palazzo, e una porta che non si apre senza nemmeno una serratura da guardare
   * è una parete invisibile. Di sopra si trova una sala vuota e una cassa che non
   * si apre — che è già tutta la risposta a "cosa ci vado a fare".
   */
  useStairs(dir, game) {
    const it = this.active;
    it.cur = clamp(it.cur + dir, 0, it.floors.length - 1);
    const f = this.floor;
    // Salendo si arriva sul pianerottolo, scendendo si sbuca dalla rampa opposta.
    const land = dir > 0
      ? f.entry
      : (f.stairUp ? { x: f.stairUp.x + f.stairUp.w / 2, y: f.stairUp.y + f.stairUp.h + 20, angle: Math.PI / 2 } : f.entry);
    this.placeOnFloor(game, land);
    this.showFloor(game, f);
    game.fx.clear();
    game.projectiles.clear();
    game.player.enterCooldown = 0.4;
    this.fade = 1;
  }

  placeOnFloor(game, at) {
    const pl = game.player;
    pl.x = at.x;
    pl.y = at.y;
    pl.vx = 0;
    pl.vy = 0;
    pl.angle = at.angle ?? -Math.PI / 2;
    pl.aimAngle = pl.angle;
    game.camera.snapTo(pl.x, pl.y);
  }

  // --- ciclo ------------------------------------------------------------------

  update(dt, game) {
    this.fade = Math.max(0, this.fade - dt * 2.6);
    this.actions.length = 0;
    if (this.active) { this.near = null; this.updateInside(dt, game); }
    else this.updateOutside(dt, game);
  }

  updateOutside(dt, game) {
    this.updateGarage(dt, game);
    const shop = this.nearestDoor(game);
    this.near = shop;
    if (!shop) return;
    const biz = BUSINESSES[shop.biz[0]];
    // Il primo piano aperto della colonna. Se non è il terra, il negozio della
    // vetrina ha la saracinesca giù ma il portone resta aperto per quello di sopra:
    // è come funziona un palazzo di Seoul, e il suggerimento lo deve dire.
    const openIdx = shop.biz.findIndex((id) => this.isOpen(id, game));
    let act;
    if (openIdx < 0) {
      const n = this.nextOpening(shop, game);
      act = { key: 'E', text: `${biz.hangul} — chiuso · apre alle ${clockLabel(n.at)}`, run: () => this.knock(shop, game) };
    } else if (openIdx === 0) {
      act = {
        key: 'E',
        text: `entra in ${biz.hangul} · ${biz.label}${shop.biz.length > 1 ? ` (+${shop.biz.length - 1} piani)` : ''}`,
        run: () => this.enter(shop, game),
      };
    } else {
      const up = BUSINESSES[shop.biz[openIdx]];
      act = {
        key: 'E',
        text: `entra — ${biz.hangul} è chiuso, ${up.hangul} aperto al ${ordinal(openIdx + 1)} piano`,
        run: () => this.enter(shop, game),
      };
    }
    this.actions.push(act);
    if (game.input.wasPressed('KeyE') && game.player.enterCooldown <= 0) act.run();
  }

  updateInside(dt, game) {
    const f = this.floor;
    const pl = game.player;
    for (const p of f.people) this.updateNpc(p, dt, game);
    for (let i = f.people.length - 1; i >= 0; i--) {
      if (f.people[i].gone) f.people.splice(i, 1);
    }

    // Azioni contestuali: scala, porta, bancone, cassa.
    if (f.stairUp && pointInRect(pl.x, pl.y, padRect(f.stairUp, STAIR_PAD))) {
      const up = this.active.floors[this.active.cur + 1].biz;
      const shut = this.isOpen(up.id, game) ? '' : ` — ${up.hangul} è chiuso`;
      this.actions.push({ key: 'E', text: `sali al ${ordinal(this.active.cur + 2)} piano${shut}`, run: () => this.useStairs(1, game) });
    } else if (f.stairDown && pointInRect(pl.x, pl.y, padRect(f.stairDown, STAIR_PAD))) {
      this.actions.push({ key: 'E', text: this.active.cur === 1 ? 'scendi al piano terra' : `scendi al ${ordinal(this.active.cur)} piano`, run: () => this.useStairs(-1, game) });
    } else if (f.idx === 0 && dist(pl.x, pl.y, f.entry.x, f.entry.y) < 34) {
      this.actions.push({ key: 'E', text: 'esci in strada', run: () => this.leave(game) });
    }

    // A locale chiuso il bancone è morto: niente listino e niente cassa. Senza,
    // un 총포상 alle tre di notte sarebbe contante gratis senza nessuno a difenderlo.
    if (f.till && f.openNow && dist(pl.x, pl.y, f.till.x, f.till.y) < DESK_REACH) {
      if (f.biz.shop) {
        this.actions.push({ key: 'E', text: `${f.biz.hangul} — vedi il listino`, run: () => game.shopMenu.show(f, game) });
      }
      if (!f.robbed) {
        this.actions.push({ key: 'F', text: 'svuota la cassa', run: () => this.rob(game) });
      }
    }

    for (const a of this.actions) {
      if (game.input.wasPressed(`Key${a.key}`) && pl.enterCooldown <= 0) {
        pl.enterCooldown = 0.35;
        a.run();
        break;
      }
    }
  }

  /**
   * Rapina. Serve un'arma da fuoco in pugno *oppure* nessuno dietro al banco: a
   * mani nude il commesso ti guarda e basta, ed è il modo più corto di dire che la
   * cassa non è una raccolta a terra.
   */
  rob(game) {
    const f = this.floor;
    const pl = game.player;
    const keeper = f.people.find((p) => p.role === 'keeper' && !p.dead);
    const armed = !WEAPONS[pl.weapon].melee;
    if (keeper && !armed) {
      game.hud.toast('Il commesso non si muove: serve qualcosa di più convincente', 2.4);
      return;
    }
    f.robbed = true;
    pl.money += f.till.cash;
    this.robbed++;
    game.stats.robberies = (game.stats.robberies || 0) + 1;
    game.hud.toast(`Cassa svuotata: ${won(f.till.cash)}`, 2.6);
    game.wanted.report('rob', game);
    this.alarm(f.till.x, f.till.y, 900, game, pl);
  }

  /** Officina: ci si guida dentro, si paga, si esce puliti. */
  updateGarage(dt, game) {
    this.garageT = Math.max(0, this.garageT - dt);
    const pl = game.player;
    if (pl.onFoot || !pl.vehicle || this.garageT > 0) return;
    const v = pl.vehicle;
    for (const g of this.city.garages) {
      if (!pointInRect(v.x, v.y, g)) continue;
      if (Math.abs(v.speed) > 60) {
        game.hud.toast('도색 — fermati nella piazzola', 1.2);
        return;
      }
      if (pl.money < GARAGE_PRICE) {
        game.hud.toast(`도색 — ${won(GARAGE_PRICE)}, non ce li hai`, 2);
        this.garageT = 3;
        return;
      }
      pl.money -= GARAGE_PRICE;
      this.spent += GARAGE_PRICE;
      this.garageT = 6;
      v.hp = v.maxHp;
      v.dead = false;
      v.flatTires = false;
      v.colorIndex = (v.colorIndex + 1 + Math.floor(Math.random() * (VEHICLE_COLORS.length - 1))) % VEHICLE_COLORS.length;
      game.fx.addSmoke(v.x, v.y, 3, 1.2);
      // Verniciata e targhe nuove: è l'unico modo di togliersi le stelle di dosso
      // senza aspettare, e infatti si paga.
      const had = game.wanted.level;
      game.wanted.reset();
      game.police.standDown(game, true);
      game.hud.toast(had > 0 ? `도색 — ${won(GARAGE_PRICE)}: verniciata e nessuno ti cerca` : `도색 — ${won(GARAGE_PRICE)}: come nuova`, 3);
      return;
    }
  }

  // --- gente dentro -----------------------------------------------------------

  /**
   * NPC di un interno. Non riusa `pedestrians.updatePed` perché quello sa navigare
   * i marciapiedi di un isolato: qui la stanza è larga trenta passi e "scappare"
   * vuol dire una cosa sola, arrivare alla porta e sparire.
   */
  updateNpc(p, dt, game) {
    const f = this.floor;
    const pl = game.player;
    if (p.dead) {
      p.deadT += dt;
      p.vx = damp(p.vx, 0, 0.12, dt);
      p.vy = damp(p.vy, 0, 0.12, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.spin = damp(p.spin, 0, 0.1, dt);
      return;
    }

    let tx = p.home.x;
    let ty = p.home.y;
    let speed = 0;
    const exit = f.idx === 0
      ? f.entry
      : (f.stairDown ? { x: f.stairDown.x + f.stairDown.w / 2, y: f.stairDown.y + f.stairDown.h + 16 } : f.entry);

    if (p.state === 'hostile' && p.armed) {
      const d = dist(p.x, p.y, pl.x, pl.y);
      const aim = Math.atan2(pl.y - p.y, pl.x - p.x);
      p.fireT -= dt;
      const los = hasLineOfSight(game, p.x, p.y, pl.x, pl.y);
      speed = los && d < 120 ? 0 : p.baseSpeed * 1.3;
      tx = p.x + Math.cos(aim) * (los && d < 90 ? -80 : 80);
      ty = p.y + Math.sin(aim) * (los && d < 90 ? -80 : 80);
      if (los && d < 340 && p.fireT <= 0 && !pl.dying) {
        p.fireT = 0.55 + Math.random() * 0.7;
        p.angle = aim;
        shoot(game, p, WEAPONS.pistol, p.x + Math.cos(aim) * 13, p.y + Math.sin(aim) * 13, aim, { spreadMul: 2.4 });
      }
    } else if (p.state === 'flee' || p.state === 'hostile') {
      speed = p.baseSpeed * 2.2;
      tx = exit.x;
      ty = exit.y;
      if (dist(p.x, p.y, exit.x, exit.y) < 26) {
        p.gone = true;
        return;
      }
    } else if (p.role === 'wander') {
      p.idleT -= dt;
      if (p.idleT <= 0) {
        p.idleT = 2 + Math.random() * 4;
        p.wanderX = p.home.x + (Math.random() - 0.5) * 90;
        p.wanderY = p.home.y + (Math.random() - 0.5) * 70;
      }
      tx = p.wanderX ?? p.home.x;
      ty = p.wanderY ?? p.home.y;
      speed = p.baseSpeed * 0.55;
    } else {
      // Al proprio posto: il commesso ti segue con gli occhi, ed è quello che
      // rende leggibile che c'è qualcuno dietro al banco.
      const d = dist(p.x, p.y, pl.x, pl.y);
      if (d < 200) {
        p.angle = approachAngle(p.angle, Math.atan2(pl.y - p.y, pl.x - p.x), 3 * dt);
      }
      speed = dist(p.x, p.y, p.home.x, p.home.y) > 6 ? p.baseSpeed * 0.6 : 0;
    }

    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 3 && speed > 1) {
      p.vx = damp(p.vx, (dx / d) * speed, 0.07, dt);
      p.vy = damp(p.vy, (dy / d) * speed, 0.07, dt);
    } else {
      p.vx = damp(p.vx, 0, 0.08, dt);
      p.vy = damp(p.vy, 0, 0.08, dt);
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 4) {
      p.angle = approachAngle(p.angle, Math.atan2(p.vy, p.vx), 10 * dt);
      p.animT += sp * dt * 0.2;
    }

    for (const s of f.grid.queryRect(p.x - 22, p.y - 22, 44, 44)) {
      const push = circleRectPush(p.x, p.y, 7, s);
      if (!push) continue;
      p.x += push.nx * push.depth;
      p.y += push.ny * push.depth;
    }
  }

  /** Uno sparo (o una rapina) dentro: chi può scappa, chi è armato reagisce. */
  alarm(x, y, r, game, source) {
    const f = this.floor;
    if (!f) return;
    for (const p of f.people) {
      if (p.dead || p.hostile) continue;
      if (dist(p.x, p.y, x, y) > r) continue;
      if (p.armed && p.role === 'keeper' && source === game.player) {
        p.hostile = true;
        p.state = 'hostile';
        continue;
      }
      p.state = 'flee';
      p.panic = 4;
    }
  }
}

function padRect(r, m) {
  return { x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 };
}

function ordinal(n) {
  return ['', 'primo', 'secondo', 'terzo', 'quarto', 'quinto'][n] || `${n}°`;
}
