// Salvataggio su localStorage: tre slot, e dentro solo quello che Seoul non sa
// rifare da sola.
//
// La città nasce da una seed fissa (`new Rng(20260730)`): strade, edifici,
// vetrine, officine e territori sono identici a ogni avvio e non hanno bisogno
// di stare in un file. Nemmeno il traffico e i pedoni, che sono streaming puro
// attorno al giocatore. Quello che va scritto è **solo ciò che il giocatore ha
// cambiato**: se stesso, l'orologio, il ricercato, le statistiche e le poche
// cose che gli interni ricordano (una cassa svuotata resta svuotata).
//
// Il risultato è un salvataggio da pochi kB invece che da megabyte, e il conto
// non cresce con la mappa. Il prezzo è che una modifica alla generazione
// **invalida i salvataggi**: per questo c'è `SEED`, e uno slot con una seed
// diversa viene rifiutato invece di far ricomparire il giocatore dentro un muro.
import { WEATHERS } from '../world/daycycle.js';
import { createVehicle } from '../entities/vehicle.js';

export const SLOTS = 3;
/**
 * Lo slot dell'autosave. **Non è uno dei tre manuali**: un salvataggio automatico
 * che sovrascrive quello che il giocatore ha messo da parte è un salvataggio che
 * gli fa perdere la partita invece di conservargliela. Quattro schede in lista,
 * l'ultima con la chiave sua.
 */
export const AUTO_SLOT = 3;
export const ALL_SLOTS = 4;
const VERSION = 1;
const SEED = 20260730;
const KEY = (i) => (i === AUTO_SLOT ? 'seoul.save.auto' : `seoul.save.${i}`);
const AUTO_KEY = 'seoul.autosave';
// Ogni quanto scatta l'autosave a tempo, in secondi di gioco.
const AUTO_EVERY = 240;
// Quanto si aspetta prima di riprovare quando il momento non è buono (stelle
// addosso, quasi morto): riprovare a ogni frame vorrebbe dire chiedere a
// `localStorage` sessanta volte al secondo per tutta la caccia.
const AUTO_RETRY = 20;

/**
 * localStorage non c'è sempre: in navigazione privata su qualche browser
 * l'accesso alza un'eccezione invece di restituire null. Il gioco deve girare
 * lo stesso, senza salvataggi.
 */
function store() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// --- lettura dello stato ------------------------------------------------------

/**
 * Fotografia della partita. Dentro un negozio si registra la **vetrina**, non le
 * coordinate della pianta: quelle sono numeri da 200-470 px che in città cadono
 * tutti nell'angolo nord-ovest della mappa (è la stessa trappola di
 * `wanted.add`). Si ricarica in strada, davanti alla porta da cui si era entrati.
 */
export function snapshot(game) {
  const pl = game.player;
  const dc = game.dayCycle;
  const door = game.indoors && game.shops.active ? game.shops.active.shop : null;
  const x = door ? door.x : pl.x;
  const y = door ? door.y : pl.y;
  const v = pl.vehicle;
  return {
    v: VERSION,
    seed: SEED,
    at: Date.now(),
    time: game.time,
    player: {
      x, y,
      angle: pl.angle,
      hp: pl.hp,
      money: pl.money,
      outfit: pl.outfit,
      weapon: pl.weapon,
      owned: [...pl.owned],
      ammo: { ...pl.ammo },
    },
    // Il mezzo si salva come descrizione, non come oggetto: alla ricarica ne
    // nasce uno nuovo sotto il giocatore. Salvare la lista dei veicoli
    // vorrebbe dire salvare mezza città per riavere l'auto che stavi guidando.
    vehicle: v ? { kind: v.kind, colorIndex: v.colorIndex, hp: v.hp, flatTires: !!v.flatTires } : null,
    clock: {
      t: dc.t, day: dc.day, weather: dc.weather.id, next: dc.next.id,
      weatherT: dc.weatherT, blend: dc.blend, wet: dc.wet,
    },
    wanted: {
      level: game.wanted.level, heat: game.wanted.heat,
      lastX: game.wanted.lastX, lastY: game.wanted.lastY,
    },
    stats: { ...game.stats, districts: [...game.stats.districts] },
    shops: { robbed: game.shops.robbed, spent: game.shops.spent, sold: game.shops.sold },
    interiors: game.shops.snapshot(),
  };
}

/** Le due righe che la lista degli slot mostra senza caricare niente. */
export function describe(data, game) {
  const d = game.city.districtAt(data.player.x, data.player.y);
  const h = data.clock.t / (24 * 60) * 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return {
    place: d ? `${d.hangul} ${d.name}` : 'Seoul',
    clock: `Giorno ${data.clock.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    money: data.player.money,
    stars: data.wanted.level,
    at: new Date(data.at),
  };
}

// --- scrittura dello stato ----------------------------------------------------

/**
 * Rimette la partita com'era. L'ordine conta: prima si svuota il mondo attorno
 * (traffico, pedoni, polizia, esplosivi), poi si sposta il giocatore, e solo
 * alla fine si ripopola — al contrario ci si ritroverebbe addosso il traffico
 * del punto in cui si era prima di caricare.
 */
export function apply(game, data) {
  const pl = game.player;
  if (game.indoors) game.shops.forceExit(game);

  // Il mondo attorno: quello che non è protetto se ne va. Liberare lo stallo di
  // sosta è obbligatorio, altrimenti resta occupato da un fantasma (§4).
  for (let i = game.vehicles.length - 1; i >= 0; i--) {
    const v = game.vehicles[i];
    if (v.protect && v.moored) continue;
    if (v.spot) v.spot.taken = false;
    game.vehicles.splice(i, 1);
  }
  for (const p of game.peds) p.gone = true;
  game.peds.length = 0;
  game.police.standDown(game, true);
  game.projectiles.clear();
  game.fx.clear();
  game.pickups.reset?.();

  pl.vehicle = null;
  pl.onFoot = true;
  pl.dying = false;
  pl.deathT = 0;
  pl.hurtT = 0;
  pl.carHitT = 0;
  pl.vx = 0;
  pl.vy = 0;
  pl.spin = 0;
  pl.scoping = false;
  pl.heat = 0;
  pl.overheated = false;
  pl.stamina = 1;
  pl.x = data.player.x;
  pl.y = data.player.y;
  pl.angle = data.player.angle;
  pl.hp = data.player.hp;
  pl.money = data.player.money;
  pl.outfit = data.player.outfit;
  pl.owned = new Set(data.player.owned);
  pl.ammo = { ...data.player.ammo };
  pl.weapon = data.player.weapon;

  const dc = game.dayCycle;
  dc.t = data.clock.t;
  dc.day = data.clock.day;
  dc.weather = WEATHERS[data.clock.weather] || WEATHERS.clear;
  dc.next = WEATHERS[data.clock.next] || WEATHERS.clear;
  dc.weatherT = data.clock.weatherT;
  dc.blend = data.clock.blend;
  dc.apply();
  dc.wet = data.clock.wet;

  game.wanted.reset();
  game.wanted.heat = data.wanted.heat;
  game.wanted.level = data.wanted.level;
  game.wanted.lastX = data.wanted.lastX;
  game.wanted.lastY = data.wanted.lastY;

  const districts = new Set(data.stats.districts);
  Object.assign(game.stats, data.stats, { districts });
  game.time = data.time;
  game.shops.robbed = data.shops.robbed;
  game.shops.spent = data.shops.spent;
  game.shops.sold = data.shops.sold;
  game.shops.restore(data.interiors);

  // Il mezzo che si stava guidando rinasce sotto il giocatore. `protect` glielo
  // dà `onEnterVehicle`, che qui non passa: senza, lo streaming può portarselo
  // via mentre il giocatore ci è dentro.
  if (data.vehicle) {
    const v = createVehicle(data.vehicle.kind, pl.x, pl.y, pl.angle, data.vehicle.colorIndex);
    v.hp = data.vehicle.hp;
    v.flatTires = data.vehicle.flatTires;
    v.driver = 'player';
    v.awake = true;
    v.protect = true;
    v.lightsOn = game.isNight;
    game.vehicles.push(v);
    pl.vehicle = v;
    pl.onFoot = false;
  }

  pl.district = game.city.districtAt(pl.x, pl.y);
  game.camera.snapTo(pl.x, pl.y);
  game.hud.showDistrict(pl.district);
  game.traffic.prewarm(game, 40, 18);
  game.pedSystem.prewarm(game, 40);
  // Le griglie sono ricostruite a ogni frame ma il primo dopo il caricamento
  // arriva *dopo* le collisioni del giocatore: senza questo si può nascere
  // dentro un'auto appena immessa (§4).
  game.vehicleGrid.rebuild(game.vehicles);
  game.pedGrid.rebuild(game.peds);
}

// --- slot ---------------------------------------------------------------------

export function readSlot(i) {
  const ls = store();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY(i));
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Una seed diversa vuol dire un'altra Seoul: le coordinate salvate non
    // vogliono più dire niente e il giocatore rinascerebbe dentro un palazzo.
    if (data.v !== VERSION || data.seed !== SEED) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSlot(i, game) {
  const ls = store();
  if (!ls) return false;
  try {
    ls.setItem(KEY(i), JSON.stringify(snapshot(game)));
    return true;
  } catch {
    return false;
  }
}

export function clearSlot(i) {
  const ls = store();
  if (!ls) return false;
  try {
    ls.removeItem(KEY(i));
    return true;
  } catch {
    return false;
  }
}

/** Quanti slot occupati, autosave compreso. */
export function usedSlots() {
  let n = 0;
  for (let i = 0; i < ALL_SLOTS; i++) if (readSlot(i)) n++;
  return n;
}

/** Lo slot scritto più di recente: è quello che «Continua» riapre. −1 se non ce n'è. */
export function latestSlot() {
  let best = -1;
  let at = -1;
  for (let i = 0; i < ALL_SLOTS; i++) {
    const d = readSlot(i);
    if (d && d.at > at) { at = d.at; best = i; }
  }
  return best;
}

/** Etichetta di uno slot in lista. */
export function slotLabel(i) {
  return i === AUTO_SLOT ? 'AUTO' : `SLOT ${i + 1}`;
}

// --- autosave -----------------------------------------------------------------
//
// Il §5.15 aveva scelto di non averlo, con una ragione buona: «un autosave che
// scatta da solo mentre hai quattro stelle addosso è una trappola». Resta vera,
// ed è per questo che l'autosave di qui non scatta *quando gli pare* ma solo dove
// la partita è in un punto da cui si può ripartire — e si può spegnere.

export function autosaveOn() {
  try {
    return window.localStorage?.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setAutosave(v) {
  try {
    window.localStorage?.setItem(AUTO_KEY, v ? '1' : '0');
  } catch { /* niente localStorage: resta acceso per questa sessione e basta */ }
  return !!v;
}

export function toggleAutosave() {
  return setAutosave(!autosaveOn());
}

/**
 * Il momento è buono? Le condizioni sono tutte la stessa: **si salva solo un
 * punto da cui si può ripartire**. Con le stelle addosso si ricaricherebbe dentro
 * l'inseguimento, morendo si ricaricherebbe a un passo dalla morte, e con le
 * manette che si stringono si ricaricherebbe in arresto.
 */
export function canAutosave(game) {
  if (!autosaveOn() || !game.started) return false;
  if (game.player.dying || game.player.hp <= 25) return false;
  if (game.wanted.level > 0) return false;
  return !(game.police && game.police.bustProgress > 0);
}

/** Scrive lo slot automatico, se il momento è buono. `reason` finisce nel toast. */
export function autosave(game, reason) {
  if (!canAutosave(game)) return false;
  const ok = writeSlot(AUTO_SLOT, game);
  game.autoT = AUTO_EVERY;
  if (ok) {
    game.hud.toast(`Salvataggio automatico · ${reason}`, 2);
    game.audio?.ui('move');
  }
  return ok;
}

/**
 * L'autosave a tempo. Gli altri tre punti di chiamata sono eventi (il letto,
 * l'ospedale, la cella) e sanno già di essere un buon momento; questo è l'unico
 * che deve chiederselo, e quando la risposta è no riprova più tardi invece di
 * saltare il giro.
 */
export function tickAutosave(dt, game) {
  if (game.autoT === undefined) game.autoT = AUTO_EVERY;
  game.autoT -= dt;
  if (game.autoT > 0) return;
  game.autoT = AUTO_RETRY;
  autosave(game, 'in strada');
}
