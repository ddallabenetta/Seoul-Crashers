// Orologio di gioco, luce e meteo. È l'unica fonte di verità su "che ora è" e
// "che tempo fa": tutto il resto (scena, HUD, negozi, traffico) legge di qui e
// non tiene stato proprio.
//
// Il ciclo dura 24 minuti reali, cioè un minuto di orologio ogni secondo. È la
// stessa scala di GTA III, ed è il compromesso che regge: più lento e in una
// partita non si vede mai la notte, più veloce e il cielo lampeggia.
import { clamp, lerp, smoothstep } from '../core/math.js';

export const DAY_SECONDS = 24 * 60;      // durata del giro completo, in secondi reali
const HOUR = DAY_SECONDS / 24;

/**
 * Chiavi di luce lungo la giornata. `amb` è la tinta con cui si moltiplica il
 * mondo già disegnato, `k` quanto morde (0 = pieno giorno, nessun velo), `warm`
 * il velo caldo additivo di alba e tramonto, `sh` l'opacità delle ombre.
 *
 * `sx`/`sy` sono la **direzione dell'ombra moltiplicata per la sua lunghezza**,
 * non un angolo: interpolando l'angolo, al tramonto l'ombra ruoterebbe
 * all'indietro fino alla posizione dell'alba. Interpolando il vettore invece si
 * accorcia fino a sparire e ricompare dall'altra parte, che è quello che fa il
 * sole quando passa sotto l'orizzonte. A mezzogiorno il vettore vale (0.25,
 * 0.33), cioè esattamente il `SUN` fisso di `camera.js` da cui è nato tutto il
 * resto dell'illuminazione: il mezzogiorno è il fotogramma di riferimento.
 *
 * Perché una tabella e non una formula: il colore del cielo non è una sinusoide.
 * Il blu della notte fonda, il viola dell'alba e l'arancio del tramonto sono
 * scelte, e messe in tabella si cambiano guardando il gioco invece di rifare i
 * conti.
 */
const KEYS = [
  //  h       amb (tinta moltiplicativa)   k     warm (velo additivo)      w      sx     sy    shadow
  { h: 0,   amb: [0x38, 0x48, 0x74], k: 0.80, warm: [0x24, 0x34, 0x66], w: 0.10, sx: 0.00, sy: 0.05, sh: 0.10 },
  { h: 4,   amb: [0x33, 0x42, 0x70], k: 0.82, warm: [0x24, 0x34, 0x66], w: 0.10, sx: 0.00, sy: 0.05, sh: 0.08 },
  { h: 5.5, amb: [0x6b, 0x5c, 0x8e], k: 0.52, warm: [0xa8, 0x62, 0x74], w: 0.16, sx: -1.42, sy: 0.46, sh: 0.20 },
  { h: 7,   amb: [0xc4, 0xa8, 0x9e], k: 0.24, warm: [0xd8, 0x92, 0x62], w: 0.14, sx: -1.09, sy: 0.36, sh: 0.32 },
  { h: 9,   amb: [0xf2, 0xec, 0xe2], k: 0.07, warm: [0xff, 0xd8, 0x9a], w: 0.05, sx: -0.40, sy: 0.60, sh: 0.36 },
  { h: 13,  amb: [0xff, 0xff, 0xff], k: 0.00, warm: [0xff, 0xff, 0xff], w: 0.00, sx: 0.25, sy: 0.33, sh: 0.34 },
  { h: 16,  amb: [0xf6, 0xe8, 0xd4], k: 0.09, warm: [0xff, 0xcf, 0x8a], w: 0.06, sx: 0.55, sy: 0.43, sh: 0.36 },
  { h: 18,  amb: [0xe0, 0xa8, 0x7e], k: 0.26, warm: [0xff, 0x9a, 0x4e], w: 0.18, sx: 0.98, sy: 0.78, sh: 0.30 },
  { h: 19.5,amb: [0x8e, 0x66, 0x86], k: 0.50, warm: [0xd8, 0x5e, 0x52], w: 0.20, sx: 1.65, sy: 0.41, sh: 0.18 },
  { h: 21,  amb: [0x3e, 0x4a, 0x78], k: 0.76, warm: [0x2c, 0x38, 0x6a], w: 0.12, sx: 0.30, sy: 0.08, sh: 0.10 },
  { h: 24,  amb: [0x38, 0x48, 0x74], k: 0.80, warm: [0x24, 0x34, 0x66], w: 0.10, sx: 0.00, sy: 0.05, sh: 0.10 },
];

// Tinta verso cui tira il cielo coperto, qualunque ora sia.
const SLATE = [0x8e, 0x96, 0xa4];

/**
 * Quanto sono accese le luci artificiali (0 = giorno pieno, 1 = notte fonda).
 * Non coincide con `isNight`: le insegne si accendono prima che il cielo sia
 * blu, come succede davvero, e le finestre si spengono nel cuore della notte.
 */
function lampsAt(h) {
  if (h < 5) return 1;
  if (h < 7) return 1 - smoothstep((h - 5) / 2);
  if (h < 17) return 0;
  if (h < 19.5) return smoothstep((h - 17) / 2.5);
  return 1;
}

/**
 * Meteo: quattro condizioni. `hours` è quanto dura, in ore di gioco, ed è
 * l'unica ragione per cui un temporale non diventa il tempo normale di Seoul.
 */
export const WEATHERS = {
  clear:  { id: 'clear',  label: 'Sereno',    rain: 0,    cloud: 0,    wind: 0.1, hours: [7, 22] },
  cloudy: { id: 'cloudy', label: 'Nuvoloso',  rain: 0,    cloud: 0.42, wind: 0.4, hours: [5, 16] },
  rain:   { id: 'rain',   label: 'Pioggia',   rain: 0.55, cloud: 0.62, wind: 0.5, hours: [4, 12] },
  storm:  { id: 'storm',  label: 'Temporale', rain: 1,    cloud: 0.8,  wind: 0.9, hours: [2, 6] },
};

// Catena di Markov del meteo: da sereno non si passa mai direttamente a
// temporale — il cielo si copre prima. Serve a non avere un muro d'acqua che
// compare in due secondi sopra una città col sole.
const NEXT = {
  clear:  [['cloudy', 0.78], ['clear', 1]],
  cloudy: [['clear', 0.5], ['rain', 0.92], ['cloudy', 1]],
  rain:   [['cloudy', 0.6], ['storm', 0.8], ['rain', 1]],
  storm:  [['rain', 1]],
};

function keyAt(h) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smoothstep(clamp((h - a.h) / (b.h - a.h), 0, 1));
  return { a, b, t };
}

export class DayCycle {
  /** @param rng generatore deterministico: il meteo della partita è ripetibile. */
  constructor(rng, startHour = 8.4) {
    this.rng = rng;
    this.startHour = startHour;
    this.paused = false;                        // fermare il tempo è utile in una prova
    // Valori derivati, riscritti ogni frame: nessuna allocazione nel loop.
    this.light = {
      amb: [255, 255, 255], k: 0, warm: [255, 255, 255], w: 0,
      sx: 0.25, sy: 0.33, shadow: 0.34, lamps: 0,
    };
    this.reset();
  }

  /**
   * L'orologio come al boot. Serve alla partita nuova (§5.21): un giocatore che
   * ricomincia deve ritrovare la stessa mattina, non l'ora e il temporale della
   * partita che ha appena abbandonato. Il `light` non si ricostruisce — è letto
   * per riferimento dalla scena — ma `apply` lo riscrive tutto.
   */
  reset() {
    this.t = (this.startHour / 24) * DAY_SECONDS;   // secondi dall'inizio del giorno
    this.day = 1;
    this.weather = WEATHERS.clear;              // la condizione da cui si viene
    this.next = WEATHERS.cloudy;                // quella verso cui si sta andando
    this.weatherT = 60;                         // secondi al prossimo cambio
    this.blend = 1;                             // 0 = tutto `weather`, 1 = tutto `next`
    this.rain = 0;
    this.wet = 0;      // l'asfalto resta bagnato dopo che ha smesso: si asciuga piano
    this.wind = 0.1;
    this.flash = 0;    // lampo del temporale, in [0,1]
    this._flashT = 6;
    this.apply();
  }

  /** Ora del giorno in [0,24). */
  get hour() { return (this.t / DAY_SECONDS) * 24; }

  set hour(h) {
    this.t = ((h % 24) + 24) % 24 * HOUR;
    this.apply();
  }

  get minutes() { return Math.floor((this.hour % 1) * 60); }

  /**
   * Notte "di gioco": è la soglia che accende fari e lampioni, non l'alba
   * astronomica. Sta sopra `lamps` così una sola manopola muove tutto.
   */
  get isNight() { return this.light.lamps > 0.5; }

  get phase() {
    const h = this.hour;
    if (h < 5 || h >= 20.5) return 'notte';
    if (h < 7.5) return 'alba';
    if (h < 17) return 'giorno';
    return 'tramonto';
  }

  /** Etichetta coreana da orologio: 오전/오후 e ore su 12. */
  get clock() {
    const h = Math.floor(this.hour);
    const m = this.minutes;
    const am = h < 12;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${am ? '오전' : '오후'} ${h12}:${String(m).padStart(2, '0')}`;
  }

  update(dt) {
    if (!this.paused) this.step(dt);
    this.apply();
  }

  /**
   * Un passo di orologio. Sta a parte perché lo fanno in due: il frame di gioco e
   * il salto di `advance`, che deve muovere *le stesse* cose o dormire otto ore
   * diventerebbe un teletrasporto dell'ora e basta.
   */
  step(dt) {
    this.t += dt;
    if (this.t >= DAY_SECONDS) { this.t -= DAY_SECONDS; this.day++; }
    this.updateWeather(dt);
    // L'asfalto si bagna in fretta e si asciuga piano: è quello che fa restare
    // i riflessi (e la scarsa aderenza) per un po' dopo che ha smesso. Il limite
    // serve al passo lungo di `advance`: con dt di cinque secondi la correzione
    // supera il bersaglio, e `wet` finirebbe fuori da [0,1].
    const target = this.rain > 0.05 ? 1 : 0;
    this.wet = clamp(this.wet + (target - this.wet) * (target > this.wet ? 0.7 : 0.1) * dt, 0, 1);
    this.updateFlash(dt);
  }

  /**
   * Porta l'orologio avanti di `hours` ore di gioco: è il letto della safehouse e
   * sarà l'attesa di un appuntamento. **Non è `hour = x`**: il meteo è una catena
   * di Markov e va *fatta girare*, non spostata — svegliarsi dopo otto ore con lo
   * stesso temporale che c'era andando a dormire vorrebbe dire che mentre dormivi
   * il tempo non è passato. Anche il giorno avanza, e l'asfalto si asciuga.
   *
   * Il passo è di 5 s reali (5 minuti di orologio): la catena cambia stato su
   * scale di ore, quindi otto ore costano 96 iterazioni e nessuna si vede.
   */
  advance(hours) {
    const STEP = 5;
    let left = Math.max(0, hours) * HOUR;
    while (left > 0.001) {
      this.step(Math.min(STEP, left));
      // `wet` legge `rain`, che nasce in `apply`: senza ricalcolarlo a ogni passo
      // il bagnato inseguirebbe la pioggia di otto ore prima.
      this.apply();
      left -= STEP;
    }
    this.flash = 0;
    this.apply();
  }

  updateWeather(dt) {
    // Il passaggio da una condizione all'altra dura 25 s: abbastanza perché si
    // veda il cielo caricarsi, abbastanza poco da non essere una dissolvenza.
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / 25);
      if (this.blend >= 1) this.weather = this.next;
    }
    this.weatherT -= dt;
    if (this.weatherT > 0 || this.blend < 1) return;
    const table = NEXT[this.weather.id];
    const r = this.rng.next();
    let pick = table[table.length - 1][0];
    for (const [id, p] of table) { if (r < p) { pick = id; break; } }
    this.next = WEATHERS[pick];
    this.blend = 0;
    const [lo, hi] = this.next.hours;
    this.weatherT = (lo + this.rng.next() * (hi - lo)) * 60;
  }

  /** Forza una condizione, saltando la transizione. Serve alle prove e ai debug. */
  setWeather(id, seconds = 240) {
    const w = WEATHERS[id];
    if (!w) return;
    this.weather = w;
    this.next = w;
    this.blend = 1;
    this.weatherT = seconds;
    // Anche l'asfalto salta al nuovo stato: forzare `clear` in una prova e
    // trovarsi la strada bagnata per i tre minuti successivi non aiuta nessuno.
    this.wet = w.rain > 0 ? 1 : 0;
    this.apply();
  }

  /** Ricalcola i valori derivati. Chiamata ogni frame, zero allocazioni. */
  apply() {
    const { a, b, t } = keyAt(this.hour);
    const L = this.light;
    const cloud = this.cloudiness;
    for (let i = 0; i < 3; i++) {
      // Sotto le nuvole la tinta va verso l'ardesia: un tramonto col temporale
      // non è arancione né viola, è piombo. Senza questo passaggio il cielo
      // coperto si limitava a scurire i colori dell'ora, che è la cosa che fa
      // sembrare finto un temporale.
      L.amb[i] = lerp(lerp(a.amb[i], b.amb[i], t), SLATE[i], cloud * 0.62);
      L.warm[i] = lerp(a.warm[i], b.warm[i], t);
    }
    // Le nuvole spengono il velo caldo e alzano quello grigio: sotto un
    // temporale il tramonto non è arancione, è plumbeo.
    L.k = clamp(lerp(a.k, b.k, t) + cloud * 0.30, 0, 0.9);
    L.w = lerp(a.w, b.w, t) * (1 - cloud);
    L.sx = lerp(a.sx, b.sx, t);
    L.sy = lerp(a.sy, b.sy, t);
    // Con il cielo coperto la luce è diffusa: le ombre non spariscono, sbiadiscono.
    L.shadow = lerp(a.sh, b.sh, t) * (1 - cloud * 0.72);
    L.lamps = clamp(lampsAt(this.hour) + cloud * 0.35, 0, 1);

    this.rain = lerp(this.weather.rain, this.next.rain, this.blend);
    this.wind = lerp(this.weather.wind, this.next.wind, this.blend);
  }

  get cloudiness() {
    return lerp(this.weather.cloud, this.next.cloud, this.blend);
  }

  /** Il lampo è un impulso che decade: un flash costante sarebbe uno stroboscopio. */
  updateFlash(dt) {
    const stormy = Math.min(this.rain, this.cloudiness) > 0.7;
    this.flash *= Math.pow(0.0002, dt);
    if (this.flash < 0.01) this.flash = 0;
    if (!stormy) return;
    this._flashT -= dt;
    if (this._flashT > 0) return;
    this._flashT = 3 + this.rng.next() * 11;
    this.flash = 0.55 + this.rng.next() * 0.45;
  }

  /**
   * Moltiplicatori di popolamento. Non è realismo: è che una città deserta a
   * mezzanotte e identica a mezzogiorno tradisce che il tempo non conta niente.
   */
  get trafficScale() {
    const h = this.hour;
    let s = 0.34;                                   // notte fonda
    if (h >= 6 && h < 10) s = lerp(0.6, 1.15, (h - 6) / 4);
    else if (h >= 10 && h < 17) s = 0.92;
    else if (h >= 17 && h < 20) s = 1.15;           // ora di punta della sera
    else if (h >= 20 && h < 23) s = 0.72;
    else if (h >= 23 || h < 5) s = 0.34;
    else s = 0.5;
    return s * (1 - this.rain * 0.18);
  }

  get pedScale() {
    const h = this.hour;
    let s = 0.2;
    if (h >= 7 && h < 10) s = 1.1;
    else if (h >= 10 && h < 18) s = 1;
    else if (h >= 18 && h < 22) s = 1.15;           // la sera si esce
    else if (h >= 22 && h < 24) s = 0.55;
    else if (h < 5) s = 0.2;
    else s = 0.45;
    // Sotto l'acqua i marciapiedi si svuotano molto più delle strade.
    return s * (1 - this.rain * 0.55);
  }
}
