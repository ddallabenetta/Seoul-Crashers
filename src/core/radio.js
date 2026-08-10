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
//
// **E poi c'è `91.45`**, che non è nessuna di queste cose: non ha un URL, non
// apre una connessione e non può rompersi. È 까치 (`core/kkachi.js`), sta in
// cima alla manopola e la radio ci si accende sopra — il che vuol dire che il
// gioco adesso non parla con la rete finché non si preme `R` **due** volte.
import { clamp } from './math.js';
import { FREQ } from './kkachi.js';

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

/**
 * La stazione di 까치. Non è uno stream: `url` a `null` vuol dire che l'elemento
 * `<audio>` non la tocca mai, quindi non può essere lenta, muta né rotta. Quello
 * che si sente sopra la sua portante lo mette `core/kkachi.js`, ed è un fruscio.
 */
const KKACHI = { name: `${FREQ} · 까치`, url: null, tag: 'FM', kkachi: true };

export class Radio {
  /** @param audio l'`AudioSystem`: da lì arrivano volume generale e muto. */
  constructor(audio) {
    this.audio = audio;
    // Prima di tutte, comprese quelle scritte a mano: la manopola parte da qui e
    // accendere la radio non deve dipendere da un elenco che va scaricato.
    this.stations = [{ ...KKACHI }];
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

  /** Accesa **e** sulla frequenza di 까치: è la regola 6 in una riga sola. */
  get isKkachi() {
    return this.on && !!this.stations[this.pending]?.kkachi;
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
   * Chiede l'elenco alla directory. **Parte solo quando il giocatore vuole
   * lasciare `91.45`**: finché resta su 까치 — cioè finché non preme `R` la
   * seconda volta — il gioco non manda un pacchetto a nessuno.
   *
   * `then` è quello che si voleva fare con l'elenco in mano, di solito «vai
   * avanti di una stazione». Sta qui perché la ricerca è asincrona e chi l'ha
   * chiesta è già tornato indietro da un pezzo.
   */
  async discover(then = null) {
    if (this.discovered) { if (then) then(); return; }
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
    if (!this.stations.some((s) => !s.kkachi)) {
      this.note = 'nessuna stazione raggiungibile';
      // **La radio non si spegne più**: `91.45` c'è comunque, e spegnerla perché
      // la rete non risponde toglierebbe l'unica stazione che non ne ha mai
      // avuto bisogno. Si resta dov'è, e a dirlo ci pensa Kkachi.
      this.state = 'acceso';
      this.toast('Radio: non riesco a raggiungere l\'elenco delle stazioni');
      return;
    }
    // Se la partita scorsa era su una stazione che c'è ancora, si riparte da lì.
    // `> 0` e non `>= 0`: la posizione zero è 까치, ed è da lì che si sta
    // cercando di andarsene — riportarcisi sarebbe premere `R` per restare fermi.
    const back = this._wanted ? this.stations.findIndex((s) => s.name === this._wanted) : -1;
    if (back > 0) { this.pending = back; this.state = 'sintonizzo'; this._settle = 0; return; }
    if (then) then();
  }

  // --- comandi ----------------------------------------------------------------

  /** `R`: accende su `91.45`, oppure passa alla stazione dopo. */
  next(game, dir = 1) {
    this._game = game;
    // Si accende **sempre** su 까치, e senza toccare la rete: è la prima riga
    // della manopola, ed è la sola che c'è di sicuro.
    if (!this.on) { this.tuneTo(0); return; }
    if (this.state === 'cerco') return;
    if (!this.discovered) {
      this.toast('Radio: cerco le stazioni…');
      this.discover(() => this.step(dir));
      return;
    }
    this.step(dir);
  }

  /** Una tacca di manopola, saltando quelle che non hanno risposto. */
  step(dir) {
    const n = this.stations.length;
    if (n <= 1) {
      this.toast('Radio: nessun\'altra stazione');
      return;
    }
    let i = (this.pending + dir + n) % n;
    // Le stazioni che non hanno risposto si saltano invece di sparire: al giro
    // dopo può darsi che siano tornate, ma non ci si inciampa scorrendo.
    for (let k = 0; k < n && this.stations[i].broken; k++) i = (i + dir + n) % n;
    this.tuneTo(i);
  }

  tuneTo(i) {
    const s = this.stations[i];
    if (!s) return;
    this.pending = i;
    // `91.45` non si sintonizza: non c'è niente da agganciare, quindi è già accesa.
    this.state = s.kkachi ? 'acceso' : 'sintonizzo';
    this._settle = s.kkachi ? 0 : TUNE_SETTLE;
    this.toast(`Radio: ${s.name}`);
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
    // `91.45` non è uno stream: niente da caricare, niente da far suonare, niente
    // che possa non rispondere. Quello che si sente lo mette `core/kkachi.js`.
    if (this.stations[this.pending].kkachi) {
      if (this.el && !this.el.paused) this.el.pause();
      this.tuned = this.pending;
      this.state = 'acceso';
      this.note = '';
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
    // `91.45` non può fallire: non ha una sorgente. L'`error` che arriva qui
    // mentre si passa da un'altra stazione a 까치 è quello dell'elemento che
    // viene staccato, e segnarla rotta la toglierebbe dalla manopola per sempre.
    if (!s || s.kkachi) return;
    s.broken = true;
    this.note = why;
    this._stall = 0;
    const left = this.stations.filter((o) => !o.broken && !o.kkachi).length;
    if (!left) {
      // Si torna su 까치 invece di spegnersi: la radio resta accesa perché una
      // stazione c'è sempre, e che le altre non rispondano lo dice lei.
      this.toast('Radio: nessuna stazione risponde');
      this.tuneTo(0);
      return;
    }
    this.toast(`Radio: ${s.name} ${why}, passo alla prossima`);
    this.step(1);
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
