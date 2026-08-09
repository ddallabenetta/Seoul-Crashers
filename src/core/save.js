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
import { createVehicle } from '../entities/vehicle.js';
import { REGIONS } from '../world/regions.js';

const AREA_ORIGIN = Object.fromEntries(REGIONS.map((a) => [a.id, a]));

/**
 * Dove ricomincia la partita, in coordinate di mondo. Uno slot scritto prima
 * della mappa unica (§5.25) contiene coordinate **locali alla sua regione**: un
 * salvataggio a Busan diceva `3000/2000`, che nel mondo nuovo è un cortile di
 * Seoul. Il campo `world` distingue i due formati, e le origini fanno il resto —
 * è l'unico modo di non buttare via i salvataggi vecchi.
 */
function worldPoint(data) {
  if (data.world) return { x: data.player.x, y: data.player.y };
  const area = AREA_ORIGIN[data.region];
  if (!area) return { x: data.player.x, y: data.player.y };
  return { x: data.player.x + area.x, y: data.player.y + area.y };
}

export const SLOTS = 3;
/**
 * Lo slot dell'autosave. **Non è uno dei tre manuali**: un salvataggio automatico
 * che sovrascrive quello che il giocatore ha messo da parte è un salvataggio che
 * gli fa perdere la partita invece di conservargliela. Quattro schede in lista,
 * l'ultima con la chiave sua.
 */
export const AUTO_SLOT = 3;
export const ALL_SLOTS = 4;
/**
 * Quante generazioni tiene l'autosave. Una sola era una trappola al contrario:
 * chi si accorgeva tardi di aver sbagliato strada trovava l'errore già salvato
 * sopra il momento in cui non l'aveva ancora fatto. Tre costano 2 kB.
 */
export const AUTO_GENS = 3;
/**
 * Versione del **formato**, non del gioco. Si alza quando la forma dei dati cambia,
 * e per ogni scalino serve una riga in `MIGRATIONS`.
 *
 * Prima di questa revisione uno slot con `v` diverso veniva **rifiutato**, il che
 * voleva dire una cosa sola: il primo campo nuovo che qualcuno avesse aggiunto
 * avrebbe cancellato la partita di chiunque. La seed invece continua a rifiutare —
 * lì non c'è niente da migrare, perché una Seoul diversa rende le coordinate
 * salvate prive di significato e il giocatore rinascerebbe dentro un palazzo.
 */
const VERSION = 3;
const SEED = 20260730;

/**
 * `MIGRATIONS[n]` porta uno slot dalla versione `n` alla `n+1`. Si applicano in
 * fila, quindi per aggiungere un formato basta scrivere **l'ultimo scalino**: chi
 * arriva da tre versioni fa ci passa da solo.
 *
 * Regola per chi ne scrive una: **non si legge lo stato del gioco qui dentro.** Una
 * migrazione lavora sui dati e basta — gira anche solo per mostrare la riga di uno
 * slot nella lista, quando quella partita non è caricata e non lo sarà mai.
 */
const MIGRATIONS = {
  // 1 -> 2: i contatori dei negozi e le piante visitate stavano in due posti
  // diversi (`shops` e `interiors`); adesso li possiede `ShopSystem` e stanno
  // insieme. Nascono anche i sigilli delle vetrine e i personaggi nominati, che
  // in una partita vecchia semplicemente non c'erano.
  1: (d) => {
    d.shops = {
      robbed: d.shops?.robbed || 0,
      spent: d.shops?.spent || 0,
      sold: d.shops?.sold || 0,
      sealed: {},
      interiors: d.interiors || {},
    };
    delete d.interiors;
    d.actors = {};
    return d;
  },
  // 2 -> 3: la campagna. Uno slot di prima è una partita in cui la storia non era
  // ancora cominciata, e questo è esattamente quello che dice un `story` vuoto —
  // niente missione in corso, nessun pannello visto, nessun fatto acquisito.
  2: (d) => {
    d.story = { active: null, phase: 0, state: {}, done: [], seen: [], flags: [] };
    return d;
  },
};

/**
 * Porta uno slot alla versione corrente, o restituisce `null` se non ci si arriva.
 * Uno slot **dal futuro** (scritto da una versione più nuova del gioco) non si
 * tocca: indovinare cosa contiene è peggio che dire «non lo so leggere».
 */
function migrate(data) {
  let d = data;
  let guard = 0;
  while (d.v < VERSION) {
    const step = MIGRATIONS[d.v];
    if (!step || guard++ > 32) return null;
    d = step(d);
    d.v += 1;
  }
  return d.v === VERSION ? d : null;
}
// La generazione 0 tiene la chiave storica: chi aggiorna il gioco si ritrova il
// suo autosave dov'era, non uno slot vuoto.
const KEY = (i, gen = 0) =>
  (i === AUTO_SLOT ? (gen ? `seoul.save.auto.${gen}` : 'seoul.save.auto') : `seoul.save.${i}`);
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
  const door = game.indoors && game.shops.active ? game.shops.active.shop : null;
  const metroExit = game.metro?.inside ? game.metro.outside : null;
  const v = pl.vehicle;
  // **Ogni sistema si serializza da sé.** Questo file non sa più che cosa c'è dentro
  // un giocatore, un orologio o un negozio: sa dove metterlo. Chi aggiunge uno stato
  // lo aggiunge nel proprio `snapshot()` e qui non tocca niente — che è il motivo per
  // cui `ShopSystem` lo faceva già da solo per le casse svuotate.
  const player = pl.snapshot();
  // L'unica cosa che decide *chi salva* e non il giocatore: dentro un negozio si
  // registra la **vetrina**, non le coordinate della pianta. Quelle sono numeri da
  // 200-470 px che in città cadono tutti nell'angolo nord-ovest della mappa.
  if (door) { player.x = door.x; player.y = door.y; }
  else if (metroExit) { player.x = metroExit.x; player.y = metroExit.y; }
  return {
    v: VERSION,
    seed: SEED,
    region: game.areaAt?.(pl.x, pl.y)?.id || 'korea',
    // Marchia il formato: da qui in poi le coordinate sono già di mondo.
    world: true,
    at: Date.now(),
    time: game.time,
    player,
    // Il mezzo si salva come descrizione, non come oggetto: alla ricarica ne
    // nasce uno nuovo sotto il giocatore. Salvare la lista dei veicoli
    // vorrebbe dire salvare mezza città per riavere l'auto che stavi guidando.
    vehicle: v ? { kind: v.kind, colorIndex: v.colorIndex, hp: v.hp, flatTires: !!v.flatTires } : null,
    clock: game.dayCycle.snapshot(),
    wanted: game.wanted.snapshot(),
    stats: { ...game.stats, districts: [...game.stats.districts] },
    shops: game.shops.snapshot(),
    actors: game.actors.snapshot(),
    // Dove sei arrivato nella storia. Il conto delle morti che il 병원 e M12 leggono
    // **non è qui**: è `stats.deaths`, che il salvataggio porta da sempre e che è
    // già lo stesso numero — averne due sarebbe averne uno sbagliato.
    story: game.missions.snapshot(),
  };
}

/** Le due righe che la lista degli slot mostra senza caricare niente. */
export function describe(data, game) {
  // Dal §5.25 c'è una mappa sola: il posto si legge dalle coordinate, sempre.
  const regionId = data.region || 'seoul';
  const p = worldPoint(data);
  const d = game.city.districtAt(p.x, p.y);
  const regionNames = { seoul: '서울 Seoul', busan: '부산 Busan', jeju: '제주 Jeju' };
  const h = data.clock.t / (24 * 60) * 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return {
    place: d ? `${d.hangul} ${d.name}` : (regionNames[regionId] || '서울 Seoul'),
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
  if (game.indoors) game.leaveInterior();

  // Il mondo attorno: quello che non è protetto se ne va. È lo stesso svuotamento
  // che fa la partita nuova, e sta in `Game` perché il mondo è suo (§5.21).
  game.clearWorld();

  // Ogni sistema si rimette a posto da sé (vedi `snapshot`). L'ordine conta per una
  // cosa sola: gli attori vanno **dopo** `clearWorld`, che ha appena tolto dalla
  // strada i loro pedoni, e prima del ripopolamento.
  pl.restore(data.player);
  const at = worldPoint(data);
  pl.x = at.x;
  pl.y = at.y;
  game.dayCycle.restore(data.clock);
  game.wanted.restore(data.wanted);
  game.shops.restore(data.shops);
  // **Prima degli attori.** Rientrare in una fase vuol dire rieseguire il suo
  // `prepare`, che è il posto in cui i personaggi di quella missione vengono
  // *definiti*: al contrario, `actors.restore` scriverebbe le morti su definizioni
  // che ancora non esistono e chi era morto tornerebbe dietro al banco.
  game.missions.restore(data.story, game);
  game.actors.restore(data.actors);

  const districts = new Set(data.stats.districts);
  Object.assign(game.stats, data.stats, { districts });
  game.time = data.time;

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

export function readSlot(i, gen = 0) {
  const ls = store();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY(i, gen));
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Una seed diversa vuol dire un'altra Seoul: le coordinate salvate non
    // vogliono più dire niente e il giocatore rinascerebbe dentro un palazzo. È
    // rimasta l'unica ragione per **buttare** uno slot: il formato invece si
    // aggiorna, e chi arriva da una versione vecchia ci passa da `migrate`.
    if (data.seed !== SEED) return null;
    return migrate(data);
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

export function clearSlot(i, gen = 0) {
  const ls = store();
  if (!ls) return false;
  try {
    ls.removeItem(KEY(i, gen));
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

/**
 * Fa scorrere lo storico: la generazione 0 diventa la 1, la 1 la 2, e la più
 * vecchia se ne va. Si spostano le stringhe invece di tenere un cursore da
 * qualche parte — due copie da 0,7 kB ogni quattro minuti — e in cambio la
 * generazione 0 è **sempre** la più recente, senza un indice da salvare, da
 * rileggere e da tenere allineato a quello che c'è davvero nel browser.
 */
function rotateAuto() {
  const ls = store();
  if (!ls) return;
  try {
    for (let g = AUTO_GENS - 1; g > 0; g--) {
      const prev = ls.getItem(KEY(AUTO_SLOT, g - 1));
      if (prev === null) ls.removeItem(KEY(AUTO_SLOT, g));
      else ls.setItem(KEY(AUTO_SLOT, g), prev);
    }
  } catch { /* quota piena: si perde lo storico, non il salvataggio che segue */ }
}

/** Scrive lo slot automatico, se il momento è buono. `reason` finisce nel toast. */
export function autosave(game, reason) {
  if (!canAutosave(game)) return false;
  rotateAuto();
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
