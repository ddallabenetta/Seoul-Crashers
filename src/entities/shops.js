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
import { HERO_OUTFITS, VEHICLE_COLORS, VEHICLE_TYPES } from '../render/sprites.js';

const DOOR_REACH = 34;   // quanto ci si deve avvicinare alla porta dalla strada
const DESK_REACH = 54;   // raggio del bancone: comprare e rapinare
const STAIR_PAD = 10;
const GARAGE_PRICE = 30000;
const OUTFIT_PRICE = 40000;
// Quanto lontano dalla porta del 전당포 può stare il mezzo da vendere: 108 px sono
// nove metri, cioè la carreggiata davanti alla vetrina. Con meno non basta
// accostare — un'auto ferma al cordolo ha il centro a mezza corsia dalla porta.
const SELL_REACH = 108;
const ALARM_DELAY = 17;  // secondi fra il testimone che vede e la centrale che sa

/** ₩ con i punti delle migliaia: un prezzo a sei cifre senza va solo letto male. */
export function won(n) {
  return `₩${Math.round(n).toLocaleString('it-IT')}`;
}

// --- mercato nero -------------------------------------------------------------

/**
 * Ogni distretto ha i suoi prezzi, e sono **scritti a mano**, non un rumore sulla
 * seed: un moltiplicatore casuale è indistinguibile da un prezzo sbagliato, mentre
 * questi si spiegano guardando il quartiere. Le armi arrivano dal porto (0.68) e a
 * Gangnam si paga l'indirizzo (1.30); le munizioni in campagna costano perché non
 * c'è concorrenza (1.40); un'auto rubata vale dove partono i container (인천항
 * 1.35) e non vale niente dove si controllano le targhe (강남 0.85).
 *
 * `pawn` è la frazione del listino che il banco dei pegni ti ridà. Segue le armi —
 * dove valgono di più si rivende meglio — ma il valore più alto (0.50) resta sotto
 * al prezzo d'acquisto più basso della mappa (usato al porto: 0.68 × 0.72 = 0.49):
 * comprare in un posto e rivendere in un altro va **in pari**, non in guadagno, o
 * il giro diventerebbe una zecca che stampa denaro. Quello che il mercato paga
 * davvero è la roba che non hai comprato.
 */
export const MARKETS = {
  hongdae:    { hangul: '홍대',   guns: 1.00, ammo: 0.95, goods: 0.92, cars: 1.00, pawn: 0.42 },
  myeongdong: { hangul: '명동',   guns: 1.10, ammo: 1.05, goods: 1.15, cars: 0.95, pawn: 0.44 },
  itaewon:    { hangul: '이태원', guns: 0.92, ammo: 1.00, goods: 1.05, cars: 1.10, pawn: 0.48 },
  gangnam:    { hangul: '강남',   guns: 1.30, ammo: 1.22, goods: 1.35, cars: 0.85, pawn: 0.50 },
  docks:      { hangul: '인천항', guns: 0.68, ammo: 0.78, goods: 1.00, cars: 1.35, pawn: 0.34 },
  gimpo:      { hangul: '김포',   guns: 0.86, ammo: 0.95, goods: 1.10, cars: 1.15, pawn: 0.38 },
  gyeonggi:   { hangul: '경기도', guns: 1.05, ammo: 1.40, goods: 1.12, cars: 0.90, pawn: 0.40 },
};

// Il listino "di Seoul": è il riferimento rispetto a cui il pannello mostra gli
// scostamenti, ed è quello che valeva prima che i distretti avessero un prezzo.
const MARKET_BASE = { hangul: '서울', guns: 1, ammo: 1, goods: 1, cars: 1, pawn: 0.45 };

export function marketOf(districtId) {
  return MARKETS[districtId] || MARKET_BASE;
}

/** Il mercato in cui si sta trattando: quello del negozio, o quello dei tuoi piedi. */
export function marketFor(game) {
  const shop = game.shops && game.shops.active ? game.shops.active.shop : null;
  return marketOf(shop ? shop.district : game.player.district && game.player.district.id);
}

/** Un prezzo di mercato resta un prezzo da cartello: niente ₩2.763. */
function roundPrice(n) {
  const step = n < 20000 ? 100 : 500;
  return Math.max(step, Math.round(n / step) * step);
}

/**
 * Quanto vale un mezzo al banco dei pegni, a targhe pulite. Non è il prezzo di
 * listino di un concessionario: è quello che ti dà chi lo smonta o lo imbarca, ed
 * è per questo che una sportiva rende come sei berline e uno scooter come niente.
 * I mezzi che non ci sono (velivoli, barche) hanno un prezzo lo stesso: a un
 * 전당포 sul lungomare un motoscafo ci arriva davvero.
 */
const CAR_VALUE = {
  scooter: 18000, hatch: 42000, taxi: 48000, sedan: 55000, tractor: 60000,
  van: 70000, suv: 90000, bus: 95000, truck: 120000, sport: 210000,
  boat: 260000, ferry: 320000, heli: 850000, plane: 900000,
};

// --- listini -----------------------------------------------------------------
// Un articolo è un oggetto con `buy(game)`: il pannello di `ui/shopmenu.js` non sa
// niente di armi, cure o vestiti, disegna una riga e chiama questa funzione.

function weaponItem(id, m, used = 1) {
  const s = WEAPONS[id];
  // `base` è il listino (usato compreso), `mul` quanto lo piega il quartiere: il
  // pannello disegna lo scostamento, non può ricavarlo da un prezzo solo.
  const base = Math.round(s.price * used);
  return {
    key: `w:${id}`,
    label: s.label,
    hangul: s.hangul,
    base,
    mul: m.guns,
    price: roundPrice(base * m.guns),
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

function ammoItem(id, m) {
  const s = WEAPONS[id];
  const n = s.pickup * 3;
  return {
    key: `a:${id}`,
    label: `munizioni ${s.label}`,
    hangul: '탄약',
    base: s.ammoPrice,
    mul: m.ammo,
    price: roundPrice(s.ammoPrice * m.ammo),
    detail: (game) => `${n} colpi · hai ${game.player.ammo[id] || 0}/${s.maxAmmo}`,
    need: (game) => game.player.owned.has(id),
    buy(game) {
      if (!game.player.giveAmmo(id, n)) return null;
      return `+${n} colpi ${s.label}`;
    },
  };
}

function healItem(key, label, hangul, price, heal, m) {
  return {
    key,
    label,
    hangul,
    base: price,
    mul: m.goods,
    price: roundPrice(price * m.goods),
    detail: () => (heal >= 100 ? 'rimette in piedi del tutto' : `+${heal} salute`),
    buy(game) {
      const p = game.player;
      if (p.hp >= p.maxHp) return null;
      p.heal(heal);
      return `${label} — ${Math.round(p.hp)} HP`;
    },
  };
}

function outfitItem(m) {
  return {
    key: 'outfit',
    label: 'cambio d\'abito',
    hangul: '옷 갈아입기',
    base: OUTFIT_PRICE,
    mul: m.goods,
    price: roundPrice(OUTFIT_PRICE * m.goods),
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
}

/**
 * Listino di un'attività, montato al momento: il banco dei pegni compra da te, e
 * **i prezzi sono quelli del quartiere in cui ti trovi** (vedi `MARKETS`).
 */
export function stockFor(bizId, game) {
  const m = marketFor(game);
  switch (bizId) {
    case 'guns':
      return [
        weaponItem('pistol', m), ammoItem('pistol', m),
        weaponItem('shotgun', m), ammoItem('shotgun', m),
        weaponItem('smg', m), ammoItem('smg', m),
        weaponItem('rifle', m), ammoItem('rifle', m),
        weaponItem('bat', m),
      ];
    case 'pawn': {
      // Usato: costa meno e non fa domande. In cambio ricompra il tuo arsenale a
      // meno della metà, che è l'unico modo di trasformare un fucile in contanti.
      const list = [weaponItem('bat', m, 0.7), weaponItem('katana', m, 0.75), weaponItem('pistol', m, 0.72)];
      const pct = Math.round(m.pawn * 100);
      for (const id of game.player.owned) {
        const s = WEAPONS[id];
        if (!s || s.infinite || !s.price) continue;
        list.push({
          key: `s:${id}`,
          label: `vendi ${s.label}`,
          hangul: '팝니다',
          base: -Math.round(s.price * MARKET_BASE.pawn),
          mul: m.pawn / MARKET_BASE.pawn,
          price: -roundPrice(s.price * m.pawn),
          detail: () => `te la ricomprano al ${pct}% del listino, munizioni comprese`,
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
        healItem('kimbap', 'triangolo di riso', '삼각김밥', 3000, 20, m),
        healItem('dosirak', 'schiscetta calda', '도시락', 9000, 55, m),
        {
          key: 'molotov', label: 'soju e benzina', hangul: '화염병 재료',
          base: 24000, mul: m.goods, price: roundPrice(24000 * m.goods),
          detail: () => 'due molotov, nessuna domanda',
          buy(game) { game.player.giveWeapon('molotov', 2); return 'due molotov nel borsone'; },
        },
      ];
    case 'pharma':
      return [
        healItem('pain', 'antidolorifici', '진통제', 12000, 45, m),
        healItem('kit', 'kit di pronto soccorso', '구급상자', 26000, 100, m),
      ];
    case 'food':
      return [
        healItem('soju', 'soju', '소주', 3000, 15, m),
        healItem('tteok', 'tteokbokki', '떡볶이', 6000, 35, m),
        healItem('samgyup', 'samgyeopsal', '삼겹살', 16000, 70, m),
      ];
    case 'clothes':
      return [outfitItem(m)];
    case 'clinic':
      return [
        healItem('visit', 'medicazione', '치료', 14000, 50, m),
        healItem('surgery', 'ricovero lampo', '입원', 32000, 100, m),
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
    this.sold = 0;
    // Allarme silenzioso: chi ha visto la rapina, e quanto manca alla telefonata.
    this.alarmT = 0;
    this.alarmCaller = null;
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
    // Il banco dei pegni compra solo quello che hai guidato tu: il marchio si mette
    // qui, che è l'unico posto in cui si sa che al volante c'era il giocatore.
    if (!game.player.onFoot && game.player.vehicle) game.player.vehicle.hotwired = true;
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

    // Ruba-e-rivendi. `F` è già il tasto della cassa: qui e al bancone fa la stessa
    // cosa — trasforma in contanti qualcosa che non è tuo. Con `E` si finirebbe per
    // vendere il mezzo volendo entrare a comprare.
    if (shop.biz[0] === 'pawn' && this.isOpen('pawn', game)) {
      const { v, cop } = this.vehicleAtDoor(shop, game);
      if (cop && !v) {
        this.actions.push({ key: 'F', text: '전당포 — una volante non la compra nessuno', run: () => {
          game.hud.toast('전당포 — «quella riportala dove l\'hai presa»', 2.4);
        } });
      } else if (v) {
        const price = this.vehiclePrice(v, marketOf(shop.district));
        this.actions.push({
          key: 'F',
          text: `vendi ${VEHICLE_TYPES[v.kind].label} — ${won(price)}`,
          run: () => this.sellVehicle(v, shop, game),
        });
      }
    }

    for (const a of this.actions) {
      if (game.input.wasPressed(`Key${a.key}`) && game.player.enterCooldown <= 0) {
        game.player.enterCooldown = 0.35;
        a.run();
        break;
      }
    }
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

  // --- ruba-e-rivendi ---------------------------------------------------------

  /**
   * Un mezzo che il banco dei pegni comprerebbe. Due condizioni, e sono tutte e
   * due di regia: **l'hai guidato tu** (`hotwired`, scritto in `updateOutside`),
   * perché rivendere l'auto in sosta di uno sconosciuto senza toccarla è una
   * scorciatoia che svuota il gioco; e **non è della polizia**, che è la prima
   * cosa che prova chiunque. La volante ha una targa che conoscono tutti.
   */
  sellable(v) {
    if (!v || v.dead || !v.hotwired) return null;
    if (v.kind === 'police' || v.kind === 'swat' || v.driver === 'cop' || v.crew) return 'cop';
    if (!CAR_VALUE[v.kind]) return null;
    return 'ok';
  }

  /** Prezzo: tipo del mezzo × quanto è malmesso × il mercato del quartiere. */
  vehiclePrice(v, market) {
    const base = CAR_VALUE[v.kind] || 0;
    // Un rottame vale ancora qualcosa (i pezzi), un mezzo intatto non vale il
    // doppio di uno ammaccato: la forbice è 0.35-1, non 0-1.
    const cond = 0.35 + 0.65 * clamp(v.hp / (v.maxHp || 1), 0, 1);
    return roundPrice(base * cond * (v.flatTires ? 0.88 : 1) * market.cars);
  }

  /** Il mezzo fermo più vicino alla porta, fra quelli che si possono vendere. */
  vehicleAtDoor(shop, game) {
    let best = null;
    let bestD = SELL_REACH;
    let cop = false;
    for (const v of game.vehicles) {
      const d = dist(v.x, v.y, shop.x, shop.y);
      if (d > SELL_REACH || Math.abs(v.speed) > 24) continue;
      const kind = this.sellable(v);
      if (kind === 'cop') { cop = true; continue; }
      if (kind && d < bestD) { bestD = d; best = v; }
    }
    return { v: best, cop };
  }

  /**
   * Venduto. Il mezzo deve sparire **pulito**, come fa `main.onVehicleSunk` con un
   * relitto: se restasse in `game.vehicles` continuerebbe a girare la sua AI in
   * mezzo alla strada dopo essere stato pagato. E lo stallo va liberato, o quel
   * posto auto resta occupato da un fantasma per il resto della partita.
   */
  sellVehicle(v, shop, game) {
    const price = this.vehiclePrice(v, marketOf(shop.district));
    game.player.money += price;
    this.sold++;
    game.stats.soldCars = (game.stats.soldCars || 0) + 1;
    if (v.driver === 'player') game.player.exitVehicle(game, true);
    v.dead = true;
    v.deadT = 24;
    v.protect = false;
    if (v.spot) v.spot.taken = false;
    const i = game.vehicles.indexOf(v);
    if (i >= 0) game.vehicles.splice(i, 1);
    game.fx.addSmoke(v.x, v.y, 4, 1.3);
    game.hud.toast(`전당포 — ${won(price)} per ${VEHICLE_TYPES[v.kind].label}, e non l'hai mai vista`, 3.2);
  }

  /** Officina: ci si guida dentro, si paga, si esce puliti. */
  updateGarage(dt, game) {
    this.garageT = Math.max(0, this.garageT - dt);
    const pl = game.player;
    if (pl.onFoot || !pl.vehicle || this.garageT > 0) return;
    const v = pl.vehicle;
    for (const g of this.city.garages) {
      if (!pointInRect(v.x, v.y, g)) continue;
      // Anche la verniciatura ha il prezzo del quartiere: è l'unico pezzo di
      // mercato che esiste in tutti e sette i distretti, perché di officine ce n'è
      // una per distretto e di negozi no (al porto e in campagna non ce n'è nessuno).
      const price = roundPrice(GARAGE_PRICE * marketOf(g.district).goods);
      if (Math.abs(v.speed) > 60) {
        game.hud.toast('도색 — fermati nella piazzola', 1.2);
        return;
      }
      if (pl.money < price) {
        game.hud.toast(`도색 — ${won(price)}, non ce li hai`, 2);
        this.garageT = 3;
        return;
      }
      pl.money -= price;
      this.spent += price;
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
      game.hud.toast(had > 0 ? `도색 — ${won(price)}: verniciata e nessuno ti cerca` : `도색 — ${won(price)}: come nuova`, 3);
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
