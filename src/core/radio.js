// Radio dell'autoradio (e del negozio sotto casa): **stazioni coreane vere**, in
// streaming. È l'unica cosa in tutto Seoul Crashers che parla con la rete, e la
// regola che ne consegue è una sola: **il gioco deve comportarsi identico quando
// la rete non c'è**. Niente qui può bloccare il boot, rallentare un frame o far
// comparire un errore in console — al massimo una stazione non risponde e si
// passa alla successiva.
//
// Tre scelte che spiegano il resto del file:
//
// **Non passa da WebAudio.** Un `<audio>` con un `MediaElementAudioSourceNode`
// diventa muto se la sorgente è di un'altra origine senza intestazioni CORS, che
// è la norma per gli Icecast delle emittenti. Un elemento e basta invece suona
// sempre: il prezzo è che il volume si fa con `el.volume` e non passa dal
// compressore del mixer. Per un fondo musicale va benissimo.
//
// **Niente elenco di stazioni scritto a mano.** Gli URL delle emittenti cambiano,
// e una lista hardcoded è una lista che marcisce. Le stazioni si chiedono a
// **radio-browser.info**, che è aperto, gratuito e **non vuole nessuna chiave**;
// chi vuole fissare la propria mette la sua in `localStorage` (vedi `CUSTOM_KEY`),
// e quelle vincono sull'elenco scaricato.
//
// **Solo MP3/AAC diretti.** `<audio>` non sa leggere né una playlist (`.pls`,
// `.m3u`) né HLS (`.m3u8`) senza una libreria, e qui le librerie non esistono.
// Questo taglia fuori le tre grandi coreane (KBS, MBC, SBS), che trasmettono in
// HLS con un token: restano le decine di stazioni indipendenti dell'elenco, che
// per il fondo di un gioco sono anche più interessanti.
import { clamp } from './math.js';

// Mirror pubblici della directory. Si provano in ordine: se il primo non
// risponde entro il timeout si passa al successivo.
const DIRECTORY = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];
const QUERY = '/json/stations/bycountrycodeexact/KR?limit=80&order=votes&reverse=true&hidebroken=true';
const FETCH_TIMEOUT = 6000;
const MAX_STATIONS = 14;

// Stazioni aggiunte a mano, in localStorage: `[{ "name": "...", "url": "..." }]`.
// Vengono prima di quelle scaricate e non spariscono se la directory cambia idea.
const CUSTOM_KEY = 'seoul.radio.stations';
const STATE_KEY = 'seoul.radio';

// Quanto si aspetta prima di attaccarsi davvero a una stazione: scorrendo la
// manopola si passano cinque stazioni in due secondi, e senza questa pausa si
// aprirebbero cinque connessioni per ascoltarne una.
const TUNE_SETTLE = 0.45;
// Oltre questo tempo senza un byte utile la stazione si considera muta e si
// salta. Senza, una stazione morta blocca la radio per sempre.
const STALL_LIMIT = 11;

export class Radio {
  /** @param audio l'`AudioSystem`: da lì arrivano volume generale e muto. */
  constructor(audio) {
    this.audio = audio;
    this.stations = [];
    this.tuned = -1;      // stazione caricata nell'elemento
    this.pending = -1;    // stazione scelta dal giocatore (−1 = spenta)
    this.el = null;
    this.state = 'off';   // off | cerco | sintonizzo | acceso | muta
    this.note = '';       // motivo dell'ultimo fallimento, per l'HUD
    this.discovered = false;
    this._settle = 0;
    this._stall = 0;
    this._game = null;
    this.loadCustom();
  }

  get station() {
    return this.stations[this.tuned] || null;
  }

  get on() {
    return this.pending >= 0;
  }

  /** Etichetta per l'HUD: dice sempre a che punto è, anche quando non suona. */
  get label() {
    if (!this.on) return 'spenta';
    if (this.state === 'cerco') return 'cerco stazioni…';
    const s = this.stations[this.pending];
    if (!s) return this.note || 'nessuna stazione';
    if (this.state === 'sintonizzo') return `${s.name} · sintonizzo…`;
    return s.name;
  }

  get stats() {
    return {
      stato: this.state, stazione: this.station ? this.station.name : null,
      elenco: this.stations.length, rotte: this.stations.filter((s) => s.broken).length,
      volume: this.el ? +this.el.volume.toFixed(2) : 0,
    };
  }

  // --- elenco delle stazioni --------------------------------------------------

  loadCustom() {
    try {
      const raw = window.localStorage?.getItem(CUSTOM_KEY);
      const list = raw ? JSON.parse(raw) : null;
      if (Array.isArray(list)) {
        for (const s of list) {
          if (s && typeof s.url === 'string') {
            this.stations.push({ name: String(s.name || s.url), url: s.url, tag: 'tua', mine: true });
          }
        }
      }
      const st = JSON.parse(window.localStorage?.getItem(STATE_KEY) || 'null');
      if (st && typeof st.name === 'string') this._wanted = st.name;
    } catch { /* niente localStorage: si parte senza stazioni proprie */ }
  }

  save() {
    try {
      const s = this.stations[this.pending];
      window.localStorage?.setItem(STATE_KEY, JSON.stringify(s ? { name: s.name } : null));
    } catch { /* idem */ }
  }

  /**
   * Chiede l'elenco alla directory. **Parte solo quando il giocatore accende la
   * radio**: finché non tocca `R`, il gioco non manda un pacchetto a nessuno.
   */
  async discover() {
    if (this.discovered) return;
    this.discovered = true;
    this.state = 'cerco';
    for (const host of DIRECTORY) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
        const res = await fetch(host + QUERY, {
          signal: ctrl.signal,
          // La directory chiede di identificarsi; è anche il modo educato di
          // farsi riconoscere nei loro log.
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);
        if (!res.ok) continue;
        const list = await res.json();
        const found = [];
        for (const s of list) {
          const url = s.url_resolved || s.url || '';
          if (!usable(url, s.codec)) continue;
          if (found.some((o) => o.url === url) || this.stations.some((o) => o.url === url)) continue;
          found.push({
            name: (s.name || 'senza nome').trim().slice(0, 34),
            url,
            tag: [s.codec, s.bitrate ? `${s.bitrate}k` : ''].filter(Boolean).join(' '),
          });
          if (found.length >= MAX_STATIONS) break;
        }
        this.stations.push(...found);
        break;
      } catch { /* mirror giù o rete assente: si prova il prossimo */ }
    }
    if (!this.stations.length) {
      this.note = 'nessuna stazione raggiungibile';
      this.state = 'off';
      this.pending = -1;
      this.toast('Radio: non riesco a raggiungere l\'elenco delle stazioni');
      return;
    }
    // Se la partita scorsa era su una stazione che c'è ancora, si riparte da lì.
    const back = this._wanted ? this.stations.findIndex((s) => s.name === this._wanted) : -1;
    this.pending = back >= 0 ? back : 0;
    this.state = 'sintonizzo';
    this._settle = 0;
  }

  // --- comandi ----------------------------------------------------------------

  /** `R`: accende, oppure passa alla stazione dopo. */
  next(game, dir = 1) {
    this._game = game;
    if (!this.discovered) {
      this.pending = 0;
      this.toast('Radio: cerco le stazioni…');
      this.discover();
      return;
    }
    if (!this.stations.length) {
      this.toast('Radio: nessuna stazione disponibile');
      return;
    }
    const n = this.stations.length;
    let i = this.pending < 0 ? 0 : (this.pending + dir + n) % n;
    // Le stazioni che non hanno risposto si saltano invece di sparire: al giro
    // dopo può darsi che siano tornate, ma non ci si inciampa scorrendo.
    for (let k = 0; k < n && this.stations[i].broken; k++) i = (i + dir + n) % n;
    this.pending = i;
    this.state = 'sintonizzo';
    this._settle = TUNE_SETTLE;
    this.toast(`Radio: ${this.stations[i].name}`);
    this.save();
  }

  /** `Shift+R`: spegne. */
  off(game) {
    this._game = game;
    if (!this.on) return;
    this.pending = -1;
    this.tuned = -1;
    this.state = 'off';
    if (this.el) { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); }
    this.toast('Radio spenta');
    this.save();
  }

  toggle(game) {
    if (this.on) this.off(game);
    else this.next(game);
  }

  // --- ciclo ------------------------------------------------------------------

  update(dt, game) {
    this._game = game;
    // Mentre si cerca l'elenco non c'è ancora niente su cui sintonizzarsi.
    if (this.state === 'cerco') return;
    const gain = this.contextGain(game);

    if (this.pending < 0) {
      if (this.el && !this.el.paused) this.el.pause();
      return;
    }
    // Si carica solo quando qualcuno può sentirla: accendere la radio a piedi in
    // mezzo alla strada non deve aprire uno stream che non esce da nessuna cassa.
    if (gain <= 0) {
      if (this.el && !this.el.paused) this.el.pause();
      return;
    }
    if (this.pending !== this.tuned) {
      this._settle -= dt;
      if (this._settle <= 0) this.tune(this.pending);
      return;
    }
    const el = this.el;
    if (!el) return;
    el.volume = clamp(gain, 0, 1);
    if (el.paused) el.play().catch(() => { /* il gesto arriverà col prossimo tasto */ });

    // Sintonia che non si aggancia: `readyState` sotto HAVE_FUTURE_DATA vuol dire
    // che non arriva niente di suonabile.
    if (el.readyState >= 3) {
      this._stall = 0;
      if (this.state !== 'acceso') { this.state = 'acceso'; this.note = ''; }
      return;
    }
    this._stall += dt;
    if (this._stall > STALL_LIMIT) this.fail('non risponde');
  }

  /**
   * Quanto forte, e se ha senso suonare. In macchina è l'autoradio; dentro un
   * locale aperto che ce l'ha è la radio del negozio, bassa — a Seoul in un
   * 편의점 c'è sempre accesa. **È la stessa stazione**: una seconda connessione
   * per un fondo appena percettibile non varrebbe il traffico.
   */
  contextGain(game) {
    const a = this.audio;
    if (a.muted || a.mix.master <= 0) return 0;
    const base = a.mix.master * a.mix.radio;
    // La radio si abbassa meno del mondo: è la musica che ha scelto il giocatore.
    // Ha un valore suo nella tabella delle modalità, per questo.
    const duck = game.mode.radioDuck;
    const pl = game.player;
    if (!pl.onFoot && pl.vehicle && !pl.vehicle.dead) return base * duck;
    if (game.indoors) {
      const f = game.shops.floor;
      if (f && f.openNow && f.biz.radio) return base * 0.26 * duck;
    }
    return 0;
  }

  /** Attacca l'elemento a una stazione. */
  tune(i) {
    const s = this.stations[i];
    if (!s) return;
    if (!this.el) this.makeElement();
    this.tuned = i;
    this._stall = 0;
    this.state = 'sintonizzo';
    this.el.src = s.url;
    this.el.load();
    this.el.play().catch(() => { /* serve un gesto: ci pensa il prossimo tasto */ });
  }

  makeElement() {
    const el = new window.Audio();
    el.preload = 'none';
    // **Niente `crossOrigin`**: chiederlo trasformerebbe ogni Icecast senza CORS
    // in un errore invece che in musica (e non serve, perché non passiamo da
    // WebAudio).
    el.addEventListener('error', () => this.fail('non risponde'));
    el.addEventListener('ended', () => this.fail('interrotta'));
    this.el = el;
  }

  /**
   * Stazione che non risponde: la si marchia e si passa alla prossima. **La
   * guardia sulla radio spenta non è pignoleria**: staccare la sorgente da un
   * `<audio>` fa scattare un `error` da solo, e senza guardia spegnere la radio
   * la riaccenderebbe sulla stazione dopo.
   */
  fail(why) {
    if (!this.on) return;
    const s = this.stations[this.tuned] || this.stations[this.pending];
    if (s) s.broken = true;
    this.note = why;
    this._stall = 0;
    const left = this.stations.filter((o) => !o.broken).length;
    if (!left) {
      this.pending = -1;
      this.tuned = -1;
      this.state = 'off';
      if (this.el) this.el.pause();
      this.toast('Radio: nessuna stazione risponde');
      return;
    }
    this.toast(`Radio: ${s ? s.name : 'stazione'} ${why}, passo alla prossima`);
    this.next(this._game);
  }

  toast(text) {
    this._game?.hud?.toast(text, 2.2);
  }
}

/**
 * Uno stream che `<audio>` sa davvero suonare. Le esclusioni non sono prudenza:
 * una playlist o un HLS qui non partono e basta, e finirebbero per sembrare
 * stazioni rotte.
 */
function usable(url, codec) {
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\.(m3u8|pls|m3u|asx|xspf|ram)(\?|$)/i.test(url)) return false;
  // Pagina servita in https: un flusso in chiaro verrebbe bloccato come contenuto
  // misto, e il sintomo sarebbe una stazione muta senza errori.
  if (window.location.protocol === 'https:' && /^http:/i.test(url)) return false;
  const c = (codec || '').toUpperCase();
  return !c || c.includes('MP3') || c.includes('AAC') || c.includes('MPEG');
}
