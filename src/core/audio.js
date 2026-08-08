// Audio procedurale. Nessun file sonoro: ogni suono nasce da oscillatori, rumore
// generato una volta al boot e filtri WebAudio, esattamente come la grafica nasce
// da path su canvas. È il vincolo del progetto (§7 dell'HANDOFF), e per un gioco
// così è anche la scelta comoda: uno sparo che cambia timbro con l'arma, una sirena
// che scivola di tono quando la volante ti passa accanto e la pioggia che si sente
// ovattata dentro un negozio sono tre righe di parametri, non tre file da registrare.
//
// Due famiglie, e non si somigliano:
//
//   **Colpi secchi** (`shot`, `explosion`, `impact`, `ui`…) — nascono, suonano e
//   muoiono. Ogni colpo costruisce due o tre nodi, li programma sull'orologio del
//   contesto e finisce in `_live`, da cui `update` li stacca quando hanno smesso.
//   Hanno un tetto (`MAX_VOICES`): a raffica continua di minigun, con l'incendio
//   che scoppietta e mezza folla che urla, senza tetto si arriva a centinaia di
//   nodi vivi e il primo a saltare è il frame rate, non l'audio.
//
//   **Letti continui** (`beds`) — motore, sirena, rotore, pioggia, vento, città,
//   fuoco, gomme. Esistono una volta sola e restano accesi per sempre: ogni frame
//   si scrivono guadagno e frequenza. Riaccendere un oscillatore sessanta volte al
//   secondo costa e si sente (click); muovere un guadagno no.
//
// La posizione: c'è un solo ascoltatore, ed è **il centro camera**, non il
// giocatore. Col mirino del fucile di precisione la camera scivola via, e in quel
// caso quello che si sente deve essere quello che si vede. Distanza → volume,
// scarto orizzontale → panning. Dentro un edificio funziona identico perché le
// coordinate della pianta e quelle della camera sono le stesse (§3 dell'HANDOFF).
import { clamp, damp } from './math.js';
import { MusicSystem } from './music.js';
import { VEHICLE_TYPES } from '../render/sprites.js';

// Oltre questa distanza dall'ascoltatore un suono non viene proprio creato.
const HEAR = 1500;
// Metà larghezza su cui si apre il panorama stereo: a 760 px di scarto si è
// tutti a destra. Volutamente stretto — la camera inquadra ~1150 px di mondo.
const PAN_W = 760;
// Tetto dei suoni brevi vivi insieme.
const MAX_VOICES = 24;
// Distanza a cui uno sparo è «lontano» quanto può esserlo. Molto più corta di
// `HEAR`: a settecento pixel un colpo è già dall'altra parte dell'isolato, e
// tarare la trasformazione sul limite dell'udibile la renderebbe invisibile
// proprio nell'intervallo in cui si gioca.
const FAR_RANGE = 900;
// Quanto si allunga la coda di uno sparo lontano.
const FAR_TAIL = 0.6;

// Timbro delle bocche da fuoco. `f` è il centro della banda dello schiocco, `dec`
// quanto ci mette a spegnersi, `body` il colpo basso sotto (il "tonfo" nel petto),
// `tail` la coda che rimbalza fra i palazzi. Un'arma senza riga qui suona lo stesso:
// `gunTone` ricava i quattro numeri da cadenza e danno (vedi in fondo).
const GUN_TONE = {
  pistol:  { f: 1750, dec: 0.13, body: 150, tail: 0.16, gain: 0.55 },
  shotgun: { f: 900,  dec: 0.34, body: 96,  tail: 0.42, gain: 0.95 },
  smg:     { f: 2350, dec: 0.075, body: 165, tail: 0.08, gain: 0.4 },
  rifle:   { f: 2050, dec: 0.12, body: 132, tail: 0.2,  gain: 0.6 },
  sniper:  { f: 1150, dec: 0.42, body: 74,  tail: 0.75, gain: 1 },
  minigun: { f: 2450, dec: 0.055, body: 178, tail: 0.05, gain: 0.34 },
};

// Le voci di Seoul. Un grido si riconosce dalle **formanti** — le due risonanze
// del tratto vocale — non dall'altezza: spostare solo `f0`, che è quello che si
// faceva prima, dà lo stesso timbro cantato più acuto, e infatti uomini, donne e
// vecchi urlavano tutti uguale. `f1` e `f2` sono le due formanti, `rough` quanto
// la voce raschia, `trem` la frequenza del tremolo (un anziano ne ha molto).
const VOICES = {
  uomo:    { f0: [250, 350], f1: 620,  f2: 1150, rough: 1,    trem: [5, 7],   gain: 0.32 },
  donna:   { f0: [400, 560], f1: 830,  f2: 2150, rough: 0.7,  trem: [6, 9],   gain: 0.34 },
  giovane: { f0: [480, 680], f1: 920,  f2: 2600, rough: 0.55, trem: [7, 11],  gain: 0.3 },
  anziano: { f0: [215, 300], f1: 570,  f2: 990,  rough: 1.35, trem: [8, 13],  gain: 0.26 },
};

/** Volumi di partenza. Si spostano dal menu e restano in localStorage. */
const DEFAULT_MIX = { master: 0.7, sfx: 1, ambient: 0.8, music: 0.7, ui: 0.75, radio: 0.8 };
const MIX_KEY = 'seoul.audio';

// Gli spazi in cui Seoul può suonare. Prima erano uno solo: un vicolo, un 노래방
// e il piazzale di Gimpo avevano tutti la stessa acustica, cioè nessuna.
//
// Le due metà di una risposta all'impulso dicono cose diverse e vanno lette
// separate: le **prime riflessioni** (`early`, echi discreti in ms) dicono
// *quanto è grande* lo spazio, la **coda** (`sec`, `decay`, `damp`) dice quanto è
// vivo. Un vicolo ha riflessioni fittissime e vicine e una coda corta; un hangar
// ha poche riflessioni lontane e una coda lunga. Invertirle fa suonare la
// cabina di un 노래방 come una cattedrale, che è l'errore classico.
//
// `wet` è quanto ritorno si manda in mezzo alla scena. Le code sono normalizzate
// a energia uno (vedi `makeImpulse`), quindi questi numeri si confrontano fra
// loro: senza normalizzare, una coda da 2,4 s uscirebbe dieci volte più forte di
// una da 0,4 s e la tabella non vorrebbe dire niente.
export const SPACES = {
  // Campagna, mare, pista: niente da cui rimbalzare, solo un'aria.
  open:   { sec: 0.7, decay: 3.6, damp: 0.66, wet: 0.07, early: [] },
  // La strada normale: due file di palazzi larghe una carreggiata.
  street: { sec: 1.2, decay: 2.6, damp: 0.52, wet: 0.17, early: [[0.018, 0.5], [0.033, 0.32]] },
  // Vicolo o cortile: muri a due metri, riflessioni fitte, niente respiro.
  alley:  { sec: 1.0, decay: 1.8, damp: 0.34, wet: 0.36, early: [[0.005, 0.9], [0.011, 0.66], [0.018, 0.48], [0.026, 0.3]] },
  // Una stanza: 노래방, 편의점, retro di un'officina. **È l'unico spazio interno**,
  // e non è una semplificazione: le piante del gioco vanno da 78k a 117k px²
  // (misurate su tutte e 114 le vetrine), cioè sono tutte stanze. Una «sala» qui
  // non avrebbe niente da rappresentare — la vorrà il primo interno grande, che
  // sarà il terminal dell'aeroporto quando ce l'avrà (§6).
  room:   { sec: 0.4, decay: 2.2, damp: 0.56, wet: 0.28, early: [[0.004, 0.85], [0.009, 0.55], [0.014, 0.32]] },
};
// Ogni quanto si guarda dove si è. Lo spazio non cambia in un frame, e la query
// sugli edifici attorno all'ascoltatore non vale la pena sessanta volte al secondo.
const SPACE_EVERY = 0.3;
// Entro quanti pixel un muro conta come muro.
const SPACE_NEAR = 115;
// Da quanti **lati** devono arrivare i muri perché un posto sia un vicolo. Non
// quanti muri: un marciapiede qualunque ha tre palazzi a novanta pixel, ma tutti
// dalla stessa parte, e con un conteggio semplice metà Myeongdong risultava un
// vicolo (misurato: 45% dei marciapiedi). Quello che fa un vicolo è essere *in
// mezzo*, e la differenza si legge solo guardando da dove vengono.
const ALLEY_SIDES = 3;

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.built = false;
    this.muted = false;
    this.mix = { ...DEFAULT_MIX };
    this.load();
    this.lx = 0;
    this.ly = 0;
    this._live = [];      // suoni brevi in corso: { g, t } con t = quando staccarli
    this._stepD = 0;      // passi del giocatore, contati in pixel percorsi
    this._flash = 0;      // fronte del lampo, per far partire il tuono
    this._crackle = 0;    // prossimo scoppiettio del fuoco
    this._q = [];         // buffer riusato dalle query sulla griglia dei veicoli
    this._bq = [];        // idem, per gli edifici attorno all'ascoltatore
    this.beds = null;
    this.music = null;    // esiste solo a contesto acceso, come i letti
    // Riverbero: lo spazio che il convolutore ha adesso, quello che vorrebbe
    // avere, e il guadagno del ritorno.
    this.space = null;
    this.wantSpace = 'street';
    this._spaceT = 0;
    this._revG = 0;
  }

  /**
   * Vero solo con un contesto che sta **davvero** girando. Non basta averlo
   * costruito: un contesto sospeso (gesto dell'utente mai arrivato, scheda in
   * secondo piano) ha l'orologio fermo, e tutto quello che ci si programma dentro
   * resta in coda ad accumularsi finché non riparte.
   */
  get ready() {
    return this.built && this.ctx.state === 'running';
  }

  get on() {
    return this.ready && !this.muted;
  }

  /** Stato leggibile da console e dalle scene di prova. */
  get stats() {
    const b = this.beds;
    return {
      stato: this.ctx ? this.ctx.state : 'assente',
      muto: this.muted,
      voci: this._live.length,
      mix: this.mix,
      letti: b ? {
        citta: +b.city.g.toFixed(2), pioggia: +b.rain.g.toFixed(2), vento: +b.wind.g.toFixed(2),
        mare: +b.sea.g.toFixed(2), motore: +b.engine.g.toFixed(2), traffico: +b.traffic.g.toFixed(2),
        sirena: +b.siren.g.toFixed(2), rotore: +b.rotor.g.toFixed(2), fuoco: +b.fire.g.toFixed(2),
        gomme: +b.skid.g.toFixed(2), canne: +b.spin.g.toFixed(2),
      } : null,
      spazio: this.space, verso: this.wantSpace, riverbero: +this._revG.toFixed(3),
      musica: this.music ? this.music.stats : null,
    };
  }

  // --- accensione -------------------------------------------------------------

  /**
   * Il contesto si crea al primo gesto dell'utente: i browser non lasciano partire
   * l'audio prima, e un contesto creato e lasciato sospeso non è innocuo — tutto
   * quello che ci si programma dentro resta in coda perché il suo orologio è fermo.
   * Finché non passa di qui, ogni chiamata di questo file non fa niente.
   */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      return;
    }
    this.buildGraph();
    this.ctx.resume().catch(() => {});
  }

  buildGraph() {
    const ctx = this.ctx;
    // Il compressore è l'unica cosa che tiene insieme un mix in cui una granata e
    // un passo convivono: senza, l'esplosione satura e il resto sparisce.
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 14;
    this.comp.ratio.value = 6;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.28;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.mix.master;
    this.comp.connect(this.master);
    this.master.connect(ctx.destination);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.mix.sfx;
    this.sfx.connect(this.comp);

    this.amb = ctx.createGain();
    this.amb.gain.value = this.mix.ambient;
    this.amb.connect(this.comp);

    // La musica **passa dal compressore**, al contrario dell'interfaccia: quando
    // scoppia una granata deve abbassarsi come tutto il resto, o un pezzo che
    // continua indifferente sopra un'esplosione la fa sembrare piccola.
    this.mus = ctx.createGain();
    this.mus.gain.value = this.mix.music;
    this.mus.connect(this.comp);

    // L'interfaccia non passa dal compressore: un click di menu non deve abbassare
    // l'esplosione che c'è sotto, e in pausa dev'essere l'unica cosa che si sente.
    this.uiBus = ctx.createGain();
    this.uiBus.gain.value = this.mix.ui;
    this.uiBus.connect(this.master);

    // Riverbero: una mandata parallela dal bus degli effetti. Solo da lì — la
    // pioggia e il brontolio della città passati per una coda diventano fango, e
    // l'interfaccia non sta in nessuno spazio. Il secco continua ad arrivare al
    // compressore per conto suo: qui si aggiunge il bagnato, non lo si sostituisce.
    this.rev = ctx.createConvolver();
    this.rev.normalize = false;   // le code sono già normalizzate a energia uno
    this.revOut = ctx.createGain();
    this.revOut.gain.value = 0;
    this.sfx.connect(this.rev);
    this.rev.connect(this.revOut);
    this.revOut.connect(this.comp);
    this.impulses = {};
    for (const [id, s] of Object.entries(SPACES)) this.impulses[id] = this.makeImpulse(s);
    this.space = this.wantSpace;
    this.rev.buffer = this.impulses[this.space];

    this.white = this.makeNoise(2.4, false);
    this.pink = this.makeNoise(2.4, true);
    this.buildBeds();
    this.music = new MusicSystem(this);
    this.built = true;
  }

  /**
   * Rumore precalcolato: due secondi e mezzo, letti in punti casuali. Il rosa è un
   * bianco passato per un filtro a un polo — la pioggia e il vento con lo spettro
   * piatto suonano di friggitrice.
   */
  makeNoise(seconds, pink) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (pink) {
        // Il fattore riporta il rosa allo stesso valore efficace del bianco: il
        // filtro a un polo toglie quasi tutta l'energia, e senza compensazione un
        // letto di pioggia suonerebbe il triplo di un colpo di pistola (misurato).
        last = last * 0.86 + w * 0.14;
        d[i] = last * 2.05;
      } else {
        d[i] = w;
      }
    }
    return buf;
  }

  /**
   * Una risposta all'impulso generata: prime riflessioni più rumore che decade.
   * È l'unico modo di avere un riverbero senza un file — un `ConvolverNode` vuole
   * una coda registrata, e in questo progetto i file non esistono (§7).
   *
   * Tre cose che non sono ovvie e che sono costate un tentativo ciascuna:
   *
   * - **I due canali sono rumore diverso.** Con lo stesso rumore a destra e a
   *   sinistra la coda collassa al centro e lo spazio scompare: si sente più
   *   forte, non più largo.
   * - **La coda va filtrata mentre decade**, non dopo: un muro mangia gli acuti
   *   prima dei bassi, e un rumore bianco che si spegne senza perdere brillantezza
   *   suona come un riverbero a molla, non come una stanza.
   * - **Va normalizzata a energia uno.** L'energia di una coda cresce con la sua
   *   durata: senza normalizzare, passare da una stanza a un capannone alzerebbe
   *   il volume di dieci volte invece di allargare lo spazio.
   */
  makeImpulse(spec) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const n = Math.max(1, Math.floor(rate * spec.sec));
    const buf = ctx.createBuffer(2, n, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      let energy = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const env = Math.pow(1 - t, spec.decay);
        lp = lp * spec.damp + (Math.random() * 2 - 1) * (1 - spec.damp);
        d[i] = lp * env;
      }
      // Le prime riflessioni si sommano sopra la coda, sfasate fra i due canali:
      // sono l'unica parte che il timpano legge come «distanza da un muro».
      for (const [at, amp] of spec.early) {
        const i = Math.floor(at * rate);
        if (i >= n) continue;
        d[i] += (ch ? -amp : amp) * (0.75 + Math.random() * 0.5);
      }
      for (let i = 0; i < n; i++) energy += d[i] * d[i];
      const norm = energy > 0 ? 1 / Math.sqrt(energy) : 0;
      for (let i = 0; i < n; i++) d[i] *= norm;
    }
    return buf;
  }

  // --- impostazioni -----------------------------------------------------------

  load() {
    try {
      const raw = window.localStorage?.getItem(MIX_KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (v && typeof v === 'object') {
        for (const k of Object.keys(this.mix)) {
          if (typeof v[k] === 'number') this.mix[k] = clamp(v[k], 0, 1);
        }
        this.muted = !!v.muted;
      }
    } catch { /* niente localStorage (file://, modalità privata): si parte dai default */ }
  }

  save() {
    try {
      window.localStorage?.setItem(MIX_KEY, JSON.stringify({ ...this.mix, muted: this.muted }));
    } catch { /* idem */ }
  }

  setVolume(bus, value) {
    if (!(bus in this.mix)) return;
    this.mix[bus] = clamp(value, 0, 1);
    // `built`, non `ready`: i nodi esistono anche a contesto sospeso, e il volume
    // deve essere già quello giusto quando riparte.
    if (this.built) {
      if (bus === 'master') this.master.gain.value = this.muted ? 0 : this.mix.master;
      else if (bus === 'sfx') this.sfx.gain.value = this.mix.sfx;
      else if (bus === 'ambient') this.amb.gain.value = this.mix.ambient;
      else if (bus === 'music') this.mus.gain.value = this.mix.music;
      else if (bus === 'ui') this.uiBus.gain.value = this.mix.ui;
      // `radio` non ha un nodo: lo stream sta in un `<audio>` fuori dal grafo
      // (vedi `core/radio.js`), e legge questo numero da solo.
    }
    this.save();
  }

  setMuted(v) {
    this.muted = !!v;
    if (this.built) this.master.gain.value = this.muted ? 0 : this.mix.master;
    this.save();
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  /** Scheda nascosta: il loop si ferma e i letti resterebbero accesi da soli. */
  setActive(v) {
    if (!this.ctx) return;
    if (v) this.ctx.resume().catch(() => {});
    else this.ctx.suspend().catch(() => {});
  }

  // --- infrastruttura dei suoni brevi -----------------------------------------

  /**
   * Prepara la destinazione di un suono breve: guadagno per distanza, panning per
   * scarto orizzontale. Torna `null` — e chi chiama non costruisce niente — se il
   * suono è troppo lontano, troppo piano o se il tetto delle voci è pieno.
   * `x` a `null` significa "non ha una posizione": interfaccia, tuono, respiro.
   */
  _at(x, y, vol, life, bus) {
    if (!this.ready || this.muted || this.mix.master <= 0) return null;
    let g = vol;
    let pan = 0;
    if (x !== null && x !== undefined) {
      const dx = x - this.lx;
      const dy = y - this.ly;
      const d = Math.hypot(dx, dy);
      if (d > HEAR) return null;
      const f = 1 - d / HEAR;
      g *= f * f;
      pan = clamp(dx / PAN_W, -1, 1);
    }
    if (g < 0.005) return null;
    if (this._live.length >= MAX_VOICES) return null;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = g;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      out.connect(p);
      p.connect(bus || this.sfx);
      this._live.push({ g: out, p, t: ctx.currentTime + life + 0.1 });
    } else {
      out.connect(bus || this.sfx);
      this._live.push({ g: out, p: null, t: ctx.currentTime + life + 0.1 });
    }
    return out;
  }

  /** Oscillatore con inviluppo. `f1` fa scivolare la frequenza: è metà del carattere. */
  _tone(dest, o) {
    const ctx = this.ctx;
    const t = (o.t || 0) + ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(18, o.f1), t + (o.sweep || o.dur));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.peak ?? 0.5, t + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
    return osc;
  }

  /** Scoppio di rumore con inviluppo: schiocchi, tonfi, acqua, passi. */
  _noise(dest, o) {
    const ctx = this.ctx;
    const t = (o.t || 0) + ctx.currentTime;
    const buf = o.pink ? this.pink : this.white;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = o.rate || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.peak ?? 0.5, t + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(g);
    g.connect(dest);
    const span = Math.max(0, buf.duration - o.dur - 0.08);
    s.start(t, Math.random() * span, o.dur + 0.08);
    return s;
  }

  /** Filtro da mettere davanti a una sorgente. `f1` lo fa scivolare nel tempo. */
  _filter(dest, type, f0, q, o = {}) {
    const ctx = this.ctx;
    const t = (o.t || 0) + ctx.currentTime;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(24, o.f1), t + (o.sweep || 0.2));
    f.Q.value = q;
    f.connect(dest);
    return f;
  }

  // --- letti continui ---------------------------------------------------------

  /**
   * Un letto è una sorgente che non si spegne mai più: quello che cambia è il
   * guadagno, smorzato in JS e scritto direttamente sul parametro. Programmare
   * rampe sessanta volte al secondo riempirebbe la coda di automazione del
   * contesto senza suonare meglio.
   */
  bed(build, smooth = 0.12) {
    const node = this.ctx.createGain();
    node.gain.value = 0;
    const b = { g: 0, target: 0, node, smooth, ...build(node) };
    return b;
  }

  buildBeds() {
    const ctx = this.ctx;
    const loopNoise = (dest, rate = 1, pink = true) => {
      const s = ctx.createBufferSource();
      s.buffer = pink ? this.pink : this.white;
      s.loop = true;
      s.playbackRate.value = rate;
      s.connect(dest);
      s.start();
      return s;
    };

    this.beds = {
      // Fondo della città: un brontolio largo più un brusio di traffico lontano.
      city: this.bed((node) => {
        node.connect(this.amb);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 420;
        lp.connect(node);
        loopNoise(lp, 0.6);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 620;
        bp.Q.value = 0.7;
        const bpg = ctx.createGain();
        bpg.gain.value = 0.5;
        bp.connect(bpg);
        bpg.connect(node);
        loopNoise(bp, 0.9);
        return { lp };
      }, 0.5),

      // Pioggia: il sibilo sta in alto, il rimbombo in basso. Dentro un negozio si
      // sposta solo il taglio del filtro — è il muro, non un altro suono.
      rain: this.bed((node) => {
        node.connect(this.amb);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 900;
        hp.connect(node);
        loopNoise(hp, 1.6, false);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        const lg = ctx.createGain();
        lg.gain.value = 0.7;
        lp.connect(lg);
        lg.connect(node);
        loopNoise(lp, 0.8);
        return { hp, lp };
      }, 0.35),

      wind: this.bed((node) => {
        node.connect(this.amb);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 380;
        bp.Q.value = 1.6;
        bp.connect(node);
        loopNoise(bp, 0.5);
        // Il vento non è piatto: respira. Un LFO lentissimo sulla frequenza basta.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.13;
        const lg = ctx.createGain();
        lg.gain.value = 190;
        lfo.connect(lg);
        lg.connect(bp.frequency);
        lfo.start();
        return { bp };
      }, 0.6),

      sea: this.bed((node) => {
        node.connect(this.amb);
        // La risacca va su un guadagno interno: modulare quello del letto vorrebbe
        // dire sommarsi al valore che `update` gli scrive ogni frame.
        const swell = ctx.createGain();
        swell.gain.value = 0.6;
        swell.connect(node);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 800;
        lp.connect(swell);
        loopNoise(lp, 0.42);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.19;
        const lg = ctx.createGain();
        lg.gain.value = 0.4;
        lfo.connect(lg);
        lg.connect(swell.gain);
        lfo.start();
        return { lp, swell };
      }, 0.7),

      // Motore del mezzo del giocatore: due onde a dente di sega leggermente
      // scordate più un soffio d'aria. La marcia è finta ma è quella che fa
      // *sentire* la velocità: senza, il tono sale piatto fino al fondo scala.
      engine: this.bed((node) => {
        node.connect(this.sfx);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        lp.connect(node);
        const o1 = ctx.createOscillator();
        o1.type = 'sawtooth';
        o1.frequency.value = 60;
        const o2 = ctx.createOscillator();
        o2.type = 'square';
        o2.frequency.value = 61;
        const g2 = ctx.createGain();
        g2.gain.value = 0.35;
        o1.connect(lp);
        o2.connect(g2);
        g2.connect(lp);
        o1.start();
        o2.start();
        const air = ctx.createBiquadFilter();
        air.type = 'bandpass';
        air.frequency.value = 1100;
        air.Q.value = 0.9;
        const ag = ctx.createGain();
        ag.gain.value = 0.25;
        air.connect(ag);
        ag.connect(node);
        loopNoise(air, 1.1);
        return { lp, o1, o2, air, ag };
      }, 0.1),

      // Il traffico attorno: un solo letto per tutte le auto vicine. Un motore per
      // veicolo vorrebbe dire quaranta oscillatori e nessuno se ne accorgerebbe.
      traffic: this.bed((node) => {
        node.connect(this.amb);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 260;
        lp.connect(node);
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 68;
        const og = ctx.createGain();
        og.gain.value = 0.5;
        o.connect(og);
        og.connect(lp);
        o.start();
        loopNoise(lp, 0.7);
        return { lp, o };
      }, 0.4),

      // Sirena a due toni. Una sola voce per tutte le volanti in caccia: si aggancia
      // alla più vicina e prende il suo panning e il suo scivolamento di tono.
      siren: this.bed((node) => {
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) { node.connect(pan); pan.connect(this.sfx); } else node.connect(this.sfx);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1200;
        bp.Q.value = 1.2;
        bp.connect(node);
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 720;
        osc.connect(bp);
        osc.start();
        // Il salto fra i due toni: un'onda quadra lenta sulla frequenza.
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 1.5;
        const lg = ctx.createGain();
        lg.gain.value = 180;
        lfo.connect(lg);
        lg.connect(osc.frequency);
        lfo.start();
        return { osc, lfo, pan, bp };
      }, 0.25),

      // Rotore: rumore tagliato basso e "pale" ottenute modulando il guadagno.
      rotor: this.bed((node) => {
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) { node.connect(pan); pan.connect(this.sfx); } else node.connect(this.sfx);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 380;
        const chop = ctx.createGain();
        chop.gain.value = 0.45;
        lp.connect(chop);
        chop.connect(node);
        loopNoise(lp, 0.75);
        const lfo = ctx.createOscillator();
        lfo.type = 'sawtooth';
        lfo.frequency.value = 11;
        const lg = ctx.createGain();
        lg.gain.value = 0.5;
        lfo.connect(lg);
        lg.connect(chop.gain);
        lfo.start();
        const thrum = ctx.createOscillator();
        thrum.type = 'triangle';
        thrum.frequency.value = 52;
        const tg = ctx.createGain();
        tg.gain.value = 0.3;
        thrum.connect(tg);
        tg.connect(node);
        thrum.start();
        return { lp, lfo, thrum, pan };
      }, 0.3),

      fire: this.bed((node) => {
        node.connect(this.sfx);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 850;
        bp.Q.value = 0.6;
        bp.connect(node);
        loopNoise(bp, 1.3, false);
        return { bp };
      }, 0.4),

      skid: this.bed((node) => {
        node.connect(this.sfx);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1500;
        bp.Q.value = 2.4;
        bp.connect(node);
        loopNoise(bp, 1.2, false);
        return { bp };
      }, 0.15),

      // Canne della minigun che prendono giro: sale prima del primo colpo, ed è
      // metà del carattere dell'arma.
      spin: this.bed((node) => {
        node.connect(this.sfx);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 3;
        bp.connect(node);
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 120;
        o.connect(bp);
        o.start();
        return { o, bp };
      }, 0.12),
    };
    // L'elenco si costruisce una volta: `Object.values` in mezzo al loop allocherebbe
    // un array a ogni frame.
    this._bedList = Object.values(this.beds);
  }

  // --- ciclo ------------------------------------------------------------------

  update(dt, game) {
    if (!this.ctx) return;
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    // Sgombero dei suoni finiti: i nodi restano attaccati al bus finché non li si
    // stacca, e un grafo che cresce di venti nodi al secondo si nota.
    for (let i = this._live.length - 1; i >= 0; i--) {
      if (this._live[i].t > now) continue;
      const v = this._live[i];
      v.g.disconnect();
      if (v.p) v.p.disconnect();
      this._live.splice(i, 1);
    }
    if (this.muted) return;

    const cam = game.camera;
    this.lx = cam.cx;
    this.ly = cam.cy;

    this.updateBeds(dt, game);
    this.updateSpace(dt, game);
    for (const b of this._bedList) {
      b.g = damp(b.g, b.target, b.smooth, dt);
      b.node.gain.value = b.g;
    }
    // La musica gira anche in pausa e anche a menu aperto: è l'unica cosa che non
    // ha un `duck`, perché in quei due momenti è la sola cosa che si sente.
    this.music.update(dt, game);
  }

  /**
   * In che spazio si sta suonando. La coda del convolutore non si può cambiare a
   * caldo senza che si senta, quindi si usa lo stesso trucco della musica (§5.19):
   * si sfuma il ritorno fino a zero e **solo lì** si mette la risposta nuova. Il
   * secco non si interrompe mai, quindi il passaggio si sente come una stanza che
   * si apre, non come un taglio.
   */
  updateSpace(dt, game) {
    this._spaceT -= dt;
    if (this._spaceT <= 0) {
      this._spaceT = SPACE_EVERY;
      this.wantSpace = this.pickSpace(game);
    }
    // Nessun `duck` in pausa, al contrario dei letti: la mandata è una frazione
    // del secco, e il secco non è ducckato (il bus `sfx` resta pieno). Abbassare
    // solo il bagnato cambierebbe la stanza a menu aperto invece di abbassare il
    // mondo, che è tutta un'altra cosa.
    const want = this.space === this.wantSpace ? SPACES[this.space].wet : 0;
    this._revG = damp(this._revG, want, 0.22, dt);
    this.revOut.gain.value = this._revG;
    if (this.space !== this.wantSpace && this._revG < 0.004) {
      this.space = this.wantSpace;
      this.rev.buffer = this.impulses[this.space];
    }
  }

  /**
   * Dove si è, in termini di muri. Dentro decide la pianta; fuori si contano gli
   * edifici attorno all'ascoltatore, che è il modo più economico di distinguere un
   * vicolo da un viale: in un vicolo i palazzi sono *tutti* a meno di cento pixel,
   * su un viale ce ne sono due dall'altra parte della carreggiata, in campagna
   * nessuno. Nessun dato nuovo in `citygen`: la griglia degli edifici c'è già.
   */
  pickSpace(game) {
    if (game.indoors) return 'room';
    // Sopra i tetti non rimbalza niente: in volo si è nel posto più aperto che c'è.
    const v = game.player.vehicle;
    if (v && !game.player.onFoot && v.z > 30) return 'open';
    // Da che parte stanno i muri: nord, est, sud, ovest come quattro bit.
    let sides = 0;
    const near2 = SPACE_NEAR * SPACE_NEAR;
    for (const b of game.city.buildingGrid.queryRect(
      this.lx - SPACE_NEAR, this.ly - SPACE_NEAR, SPACE_NEAR * 2, SPACE_NEAR * 2, this._bq)) {
      const dx = clamp(this.lx, b.x, b.x + b.w) - this.lx;
      const dy = clamp(this.ly, b.y, b.y + b.h) - this.ly;
      const d2 = dx * dx + dy * dy;
      if (d2 > near2) continue;
      // Dentro la sagoma di un palazzo (capita alla camera, non al giocatore):
      // è chiuso da tutte le parti per definizione.
      if (d2 < 1) return 'alley';
      sides |= Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 2) : (dy > 0 ? 4 : 8);
    }
    let n = 0;
    for (let m = sides; m; m >>= 1) n += m & 1;
    if (n >= ALLEY_SIDES) return 'alley';
    return n > 0 ? 'street' : 'open';
  }

  updateBeds(dt, game) {
    const beds = this.beds;
    for (const b of this._bedList) b.target = 0;
    // In pausa il mondo si abbassa ma non si spegne: uno stacco netto sui letti
    // suona come un guasto. L'interfaccia resta piena, ha un bus suo.
    const duck = game.paused ? 0.22 : 1;
    const pl = game.player;
    const dc = game.dayCycle;
    const indoors = game.indoors;

    // Fondo urbano. In campagna resta il vento, in centro il brontolio; di notte
    // cala ma non sparisce (§5.11: la città non si spegne, si dirada).
    const urban = indoors ? 0.35 : clamp(game.city.urbanAt(pl.x, pl.y), 0, 1);
    const alive = 0.45 + 0.55 * clamp(game.trafficScale, 0, 1.4);
    beds.city.target = duck * (0.014 + urban * 0.042) * alive * (indoors ? 0.45 : 1);
    beds.city.lp.frequency.value = indoors ? 220 : 420;

    // Pioggia e vento. Sotto un tetto l'acqua si sente ovattata: cambia il taglio
    // del filtro, non il suono — è il muro, e si legge come tale.
    const rain = dc.rain;
    beds.rain.target = duck * rain * (indoors ? 0.028 : 0.085);
    beds.rain.hp.frequency.value = indoors ? 380 : 900;
    beds.wind.target = duck * (0.008 + dc.wind * (indoors ? 0.008 : 0.038));

    // Mare: la risacca cresce avvicinandosi alla battigia.
    if (!indoors && game.city.coastAt) {
      const shore = game.city.coastAt(pl.y);
      beds.sea.target = duck * 0.05 * clamp(1 - (pl.x - shore) / 1500, 0, 1);
    }

    this.updateVehicles(dt, game, duck);
    this.updatePolice(dt, game, duck);
    this.updateFires(dt, game, duck);

    // Canne della minigun: `spin` è già la manopola, qui diventa tono e volume.
    if (pl.spin > 0.01 && pl.onFoot) {
      beds.spin.target = duck * 0.1 * pl.spin;
      beds.spin.o.frequency.value = 90 + pl.spin * 340;
    }

    this.updateWalk(dt, game);
    this.updateThunder(dt, game);
  }

  /** Motore del giocatore, brusio del traffico attorno, stridore delle gomme. */
  updateVehicles(dt, game, duck) {
    const beds = this.beds;
    const v = game.player.vehicle;
    if (v && !game.player.onFoot && !v.dead) {
      const spec = VEHICLE_TYPES[v.kind];
      const frac = clamp(Math.abs(v.speed) / spec.topSpeed, 0, 1);
      // Marce finte: il giro motore risale a ogni cambio invece di salire piatto
      // fino al fondo scala. È il trucco classico dei motori sintetici, e senza
      // un'auto che accelera suona come una sirena.
      const g = frac * 3.4;
      const rpm = 0.3 + (g - Math.floor(g)) * 0.7;
      // Un autobus non gira come una sportiva: la cilindrata sta nella massa.
      const base = spec.marine ? 30 : spec.air ? 74 : 64 / Math.sqrt(spec.mass);
      const f = base * (0.85 + rpm * 1.9);
      beds.engine.o1.frequency.value = f;
      beds.engine.o2.frequency.value = f * 1.012;
      beds.engine.lp.frequency.value = 320 + rpm * 2000 + frac * 900;
      // Sull'acqua il soffio è lo scafo che sbatte, e conta più del motore.
      beds.engine.air.frequency.value = spec.marine ? 480 : 900 + frac * 1400;
      beds.engine.ag.gain.value = spec.marine ? 0.45 + frac * 0.7 : 0.18 + frac * 0.35;
      beds.engine.target = duck * (0.028 + rpm * 0.036 + (v.throttle > 0.1 ? 0.012 : 0));
    }

    // Traffico attorno e gomme: una passata sola sui veicoli vicini. Dentro un
    // edificio `vehicleGrid` è vuota per costruzione, quindi non serve una guardia.
    let hum = 0;
    let slip = 0;
    // `_q` è riusato: una query per frame che alloca un array è una query che
    // alloca 60 array al secondo.
    for (const o of game.vehicleGrid.queryCircle(this.lx, this.ly, 900, this._q)) {
      if (o.dead || o === v) continue;
      const d = Math.hypot(o.x - this.lx, o.y - this.ly);
      const near = 1 - d / 900;
      if (Math.abs(o.speed) > 20) hum += near * near * clamp(Math.abs(o.speed) / 300, 0, 1);
      if (o.slip > 60) slip = Math.max(slip, near * clamp((o.slip - 60) / 200, 0, 1));
    }
    if (v && v.slip > 60) slip = Math.max(slip, clamp((v.slip - 60) / 200, 0, 1));
    beds.traffic.target = duck * clamp(hum * 0.018, 0, 0.05);
    beds.traffic.lp.frequency.value = 200 + clamp(hum, 0, 4) * 60;
    beds.traffic.o.frequency.value = 60 + clamp(hum, 0, 4) * 8;
    beds.skid.target = duck * slip * 0.1;
  }

  /** Sirena della volante più vicina ed elicottero: una voce ciascuno. */
  updatePolice(dt, game, duck) {
    const beds = this.beds;
    const P = game.police;
    if (!P) return;
    let best = null;
    let bestD = 1400;
    let count = 0;
    const scan = (list) => {
      for (const c of list) {
        if (!c.siren || c.dead) continue;
        count++;
        const d = Math.hypot(c.x - this.lx, c.y - this.ly);
        if (d < bestD) { bestD = d; best = c; }
      }
    };
    scan(P.cars);
    scan(P.boats);
    // Anche le volanti di quartiere (`life.js`) hanno la sirena accesa: sono
    // veicoli come gli altri, e senza questa riga un inseguimento che non
    // riguarda il giocatore sarebbe muto.
    if (game.life) scan(game.life.units);
    if (best) {
      const f = 1 - bestD / 1400;
      beds.siren.target = duck * (0.022 + 0.04 * f) * Math.min(1.6, 0.7 + count * 0.3);
      if (beds.siren.pan) beds.siren.pan.pan.value = clamp((best.x - this.lx) / PAN_W, -1, 1);
      // Effetto Doppler: la volante che ti supera cala di tono. Costa una riga e
      // è l'unica cosa che fa sentire *dove sta andando* invece che dov'è.
      const dx = (best.x - this.lx) / (bestD || 1);
      const dy = (best.y - this.ly) / (bestD || 1);
      const closing = -(best.vx * dx + best.vy * dy);
      beds.siren.osc.frequency.value = 700 * (1 + clamp(closing / 2400, -0.12, 0.12));
      beds.siren.lfo.frequency.value = bestD < 500 ? 2.4 : 1.4;   // vicino diventa un yelp
    }

    const c = P.chopper;
    const air = game.player.vehicle;
    // Rotore: quello della polizia o quello che stai pilotando, il più forte dei due.
    let rx = 0;
    let rg = 0;
    let rate = 11;
    if (c) {
      const d = Math.hypot(c.x - this.lx, c.y - this.ly);
      if (d < 1800) { rg = 0.06 * (1 - d / 1800); rx = c.x; }
    }
    if (air && !game.player.onFoot && VEHICLE_TYPES[air.kind].air === 'rotor') {
      rg = Math.max(rg, 0.09);
      rx = air.x;
      rate = 12 + clamp(Math.abs(air.speed) / 200, 0, 1) * 4;
    }
    beds.rotor.target = duck * rg;
    beds.rotor.lfo.frequency.value = rate;
    if (beds.rotor.pan) beds.rotor.pan.pan.value = clamp((rx - this.lx) / PAN_W, -1, 1);
  }

  /** Incendi: un letto di crepitio più qualche scoppiettio secco. */
  updateFires(dt, game, duck) {
    const fires = game.projectiles?.fires;
    if (!fires || !fires.length) return;
    let g = 0;
    let near = null;
    for (const f of fires) {
      const d = Math.hypot(f.x - this.lx, f.y - this.ly);
      if (d > 900) continue;
      const w = (1 - d / 900) * clamp(f.r / 78, 0.3, 1.2);
      if (w > g) { g = w; near = f; }
    }
    this.beds.fire.target = duck * clamp(g * 0.06, 0, 0.08);
    if (!near) return;
    this._crackle -= dt;
    if (this._crackle > 0) return;
    this._crackle = 0.08 + Math.random() * 0.22;
    const out = this._at(near.x, near.y, 0.14 * g, 0.1);
    if (!out) return;
    this._noise(this._filter(out, 'bandpass', 900 + Math.random() * 1800, 3), { dur: 0.06, peak: 0.7 });
  }

  /** Passi del giocatore: contati in pixel percorsi, non a tempo. */
  updateWalk(dt, game) {
    const pl = game.player;
    if (!pl.onFoot || pl.dying || game.paused) { this._stepD = 0; return; }
    const sp = Math.hypot(pl.vx, pl.vy);
    if (sp < 18) { this._stepD = Math.max(0, this._stepD - dt * 30); return; }
    this._stepD += sp * dt;
    if (this._stepD < 34) return;
    this._stepD = 0;
    const out = this._at(pl.x, pl.y, 0.09, 0.09);
    if (!out) return;
    // Dentro si cammina su piastrelle, fuori sull'asfalto bagnato o asciutto.
    const wet = !game.indoors && game.dayCycle.wet > 0.4;
    const f = game.indoors ? 1500 : (wet ? 1100 : 620);
    this._noise(this._filter(out, 'bandpass', f * (0.9 + Math.random() * 0.2), 1.4),
      { dur: wet ? 0.07 : 0.05, peak: 0.5 });
  }

  /** Il tuono segue il lampo con il ritardo del suono: è quello che dà la distanza. */
  updateThunder(dt, game) {
    const f = game.dayCycle.flash;
    if (f > 0.35 && this._flash <= 0.35) {
      const far = Math.random();
      this.thunder(far);
    }
    this._flash = f;
  }

  // --- suoni: armi ------------------------------------------------------------

  /**
   * Uno sparo. Tre strati: lo schiocco (rumore in banda stretta), il corpo (il
   * tonfo basso sotto) e la coda che rimbalza fra i palazzi. Passa di qui *tutto*
   * quello che spara — giocatore, polizia, teppisti — perché `weapons.shoot` è
   * l'unico imbuto del fuoco.
   */
  /**
   * Una bocca da fuoco. Il timbro non dipende solo dall'arma ma **da quanto è
   * lontana**: prima le armi dei nemici erano le tue un po' più piano, e a
   * orecchio non c'era modo di distinguere «ti stanno sparando addosso» da «si
   * spara da qualche parte» (§6). Non è una questione di volume — quello lo fa
   * già `_at` — è che l'aria si mangia lo schiocco e lascia il rimbombo: a
   * duecento metri di uno sparo arriva la coda, non il crack.
   */
  shot(spec, x, y, fromPlayer = false) {
    const tone = GUN_TONE[spec.id] || gunTone(spec);
    // La tua arma è sempre all'orecchio, anche se la camera è scivolata via col
    // mirino: sei tu che premi il grilletto.
    const far = fromPlayer ? 0
      : clamp(Math.hypot(x - this.lx, y - this.ly) / FAR_RANGE, 0, 1);
    const boom = far * far;   // il rimbombo cresce tardi: da vicino resta uno sparo
    const tailDur = tone.tail + boom * FAR_TAIL;
    const out = this._at(x, y, tone.gain * (fromPlayer ? 1 : 0.85), tone.dec + tailDur + 0.2);
    if (!out) return;
    // Lo schiocco perde acuti e mordente con la distanza…
    const cf = tone.f * (1 - 0.5 * far);
    const crack = this._filter(out, 'bandpass', cf, 0.8, { f1: cf * 0.45, sweep: tone.dec });
    this._noise(crack, { dur: tone.dec, peak: 0.9 * (1 - 0.55 * far), attack: 0.001 });
    // …il colpo basso no, i bassi viaggiano.
    this._tone(out, { type: 'triangle', f0: tone.body, f1: tone.body * 0.4, dur: tone.dec * 1.6, peak: 0.7, attack: 0.002 });
    // …e quello che resta è la coda: più lunga, più cupa e in ritardo.
    if (tailDur > 0.06) {
      const tail = this._filter(out, 'lowpass', 1400 - 950 * far, 0.7, { f1: 300, sweep: tailDur });
      this._noise(tail, {
        dur: tailDur, peak: 0.22 + boom * 0.5, attack: 0.02 + far * 0.05,
        t: 0.03 + far * 0.05, pink: true,
      });
    }
  }

  /** Grilletto a vuoto: il click è l'unico modo di dire "è finito" senza un toast. */
  dryFire(x, y) {
    const out = this._at(x, y, 0.3, 0.08);
    if (!out) return;
    this._noise(this._filter(out, 'bandpass', 2600, 6), { dur: 0.035, peak: 0.6, attack: 0.001 });
    this._tone(out, { type: 'square', f0: 900, f1: 400, dur: 0.04, peak: 0.12 });
  }

  /** Mischia: il fendente si sente sempre, il tonfo solo se ha preso qualcosa. */
  melee(spec, x, y, hit) {
    const out = this._at(x, y, 0.45, 0.4);
    if (!out) return;
    const sw = this._filter(out, 'bandpass', 900, 1.6, { f1: 320, sweep: 0.18 });
    this._noise(sw, { dur: 0.18, peak: 0.5, attack: 0.03, pink: true });
    if (!hit) return;
    const sharp = spec.id === 'katana';
    this._tone(out, { type: sharp ? 'triangle' : 'sine', f0: sharp ? 260 : 130, f1: sharp ? 90 : 55, dur: 0.2, peak: 0.9, attack: 0.002 });
    this._noise(this._filter(out, 'bandpass', sharp ? 3200 : 700, sharp ? 4 : 1.2), { dur: 0.09, peak: 0.7, attack: 0.001 });
  }

  /** Lancio di una granata o di una molotov: solo il fruscio del braccio. */
  throwItem(x, y) {
    const out = this._at(x, y, 0.3, 0.25);
    if (!out) return;
    const bp = this._filter(out, 'bandpass', 620, 1.2, { f1: 1500, sweep: 0.2 });
    this._noise(bp, { dur: 0.2, peak: 0.5, attack: 0.04, pink: true });
  }

  /**
   * Onda d'urto. `size` 0..1 scala tutto: una mina e un serbatoio che salta sono
   * lo stesso suono a due dimensioni diverse. Il rimbombo lungo è quello che la fa
   * sembrare grossa — senza coda, un'esplosione è solo un tonfo.
   */
  explosion(x, y, size = 1) {
    const s = clamp(size, 0.35, 1.4);
    const out = this._at(x, y, 1.1 * s, 1.6 * s);
    if (!out) return;
    this._tone(out, { type: 'sine', f0: 120 * s, f1: 26, dur: 0.7 * s, sweep: 0.5 * s, peak: 1, attack: 0.005 });
    const blast = this._filter(out, 'lowpass', 3200, 0.8, { f1: 180, sweep: 0.9 * s });
    this._noise(blast, { dur: 1.1 * s, peak: 0.9, attack: 0.004 });
    // Coda: il rimbombo fra le facciate. Parte un attimo dopo, o si impasta col botto.
    const tail = this._filter(out, 'lowpass', 700, 0.6);
    this._noise(tail, { dur: 1.4 * s, peak: 0.2, attack: 0.15, t: 0.08, pink: true });
  }

  /** Vetro che si rompe e vampata: la molotov non esplode, si spacca. */
  firebomb(x, y) {
    const out = this._at(x, y, 0.75, 1.1);
    if (!out) return;
    const glass = this._filter(out, 'highpass', 2200, 0.7);
    this._noise(glass, { dur: 0.25, peak: 0.6, attack: 0.001 });
    const woof = this._filter(out, 'lowpass', 1200, 0.7, { f1: 300, sweep: 0.6 });
    this._noise(woof, { dur: 0.8, peak: 0.7, attack: 0.05, pink: true });
    this._tone(out, { type: 'sine', f0: 90, f1: 40, dur: 0.4, peak: 0.5 });
  }

  // --- suoni: veicoli ---------------------------------------------------------

  /** Urto. `force` è l'impatto in px/s: sotto i 90 è una toccata, sopra è lamiera. */
  impact(x, y, force) {
    const f = clamp(force / 320, 0.12, 1.2);
    const out = this._at(x, y, 0.5 + f * 0.7, 0.5);
    if (!out) return;
    const crunch = this._filter(out, 'bandpass', 1200 + Math.random() * 600, 1.1, { f1: 400, sweep: 0.2 });
    this._noise(crunch, { dur: 0.16 + f * 0.2, peak: 0.9, attack: 0.001 });
    this._tone(out, { type: 'triangle', f0: 140, f1: 52, dur: 0.22, peak: 0.6 * f, attack: 0.002 });
    // Sopra una certa botta si sente anche il vetro.
    if (f > 0.55) {
      const gl = this._filter(out, 'highpass', 3000, 0.8);
      this._noise(gl, { dur: 0.3, peak: 0.35, attack: 0.005, t: 0.02 });
    }
  }

  /** Clacson: due quadre a distanza di quinta, nasali come vuole la strada. */
  honk(v) {
    const x = v ? v.x : null;
    const y = v ? v.y : null;
    const out = this._at(x, y, 0.4, 0.6);
    if (!out) return;
    const bp = this._filter(out, 'bandpass', 1300, 0.9);
    const f = 380 * (v && v.kind === 'bus' ? 0.6 : 1);
    this._tone(bp, { type: 'square', f0: f, dur: 0.42, peak: 0.5, attack: 0.012 });
    this._tone(bp, { type: 'square', f0: f * 1.5, dur: 0.42, peak: 0.3, attack: 0.012 });
  }

  doorClose(x = null, y = null) {
    const out = this._at(x, y, 0.32, 0.3);
    if (!out) return;
    this._noise(this._filter(out, 'lowpass', 420, 0.8), { dur: 0.14, peak: 0.9, attack: 0.002 });
    this._tone(out, { type: 'sine', f0: 110, f1: 60, dur: 0.16, peak: 0.5 });
    this._noise(this._filter(out, 'bandpass', 2400, 5), { dur: 0.04, peak: 0.35, attack: 0.001, t: 0.03 });
  }

  /** Tuffo in acqua: la banda sale e poi ricade, come lo spruzzo. */
  splash(x, y, size = 1) {
    const out = this._at(x, y, 0.5 * size, 0.9);
    if (!out) return;
    const bp = this._filter(out, 'bandpass', 300, 0.9, { f1: 1800, sweep: 0.18 });
    this._noise(bp, { dur: 0.5 * size, peak: 0.8, attack: 0.01 });
    const lp = this._filter(out, 'lowpass', 900, 0.7, { f1: 240, sweep: 0.5 });
    this._noise(lp, { dur: 0.7 * size, peak: 0.4, attack: 0.06, t: 0.06, pink: true });
  }

  // --- suoni: persone ---------------------------------------------------------

  /**
   * Un grido. Non è una voce campionata e non prova a esserlo: è un dente di sega
   * dentro una formante stretta, con vibrato e una discesa di tono. Stilizzato,
   * corto e piano — di più suonerebbe finto invece che stilizzato.
   */
  /**
   * Un grido. `voice` è il timbro di chi lo tira (vedi `VOICES`), `hurt` alza il
   * tono e accorcia — è il verso di chi ha visto arrivare la macchina, non di chi
   * ha sentito uno sparo lontano.
   */
  scream(x, y, voice = 'uomo', hurt = false) {
    const v = VOICES[voice] || VOICES.uomo;
    const out = this._at(x, y, v.gain, 0.7);
    if (!out) return;
    const f0 = (v.f0[0] + Math.random() * (v.f0[1] - v.f0[0])) * (hurt ? 1.18 : 1);
    const dur = hurt ? 0.4 : 0.55;
    // Due formanti in parallelo: è quello che rende una voce *quella* voce. La
    // seconda è più stretta e più piano, come nel tratto vocale vero.
    const osc = this._tone(this._filter(out, 'bandpass', v.f1, 3.2),
      { type: 'sawtooth', f0, f1: f0 * 0.6, dur, sweep: dur * 0.9, peak: 0.3 * v.rough, attack: 0.05 });
    this._tone(this._filter(out, 'bandpass', v.f2, 6),
      { type: 'sawtooth', f0, f1: f0 * 0.6, dur, sweep: dur * 0.9, peak: 0.13, attack: 0.05 });
    const vib = this.ctx.createOscillator();
    vib.frequency.value = v.trem[0] + Math.random() * (v.trem[1] - v.trem[0]);
    const vg = this.ctx.createGain();
    vg.gain.value = f0 * 0.05 * v.rough;
    vib.connect(vg);
    vg.connect(osc.frequency);
    vib.start();
    vib.stop(this.ctx.currentTime + dur + 0.05);
  }

  /** Colpo incassato: un grugnito corto, più cupo per il giocatore. */
  /** Il verso di chi incassa. Stesso timbro del grido: è la stessa gola. */
  hurt(x, y, isPlayer = false, voice = 'uomo') {
    const out = this._at(x, y, isPlayer ? 0.36 : 0.24, 0.3);
    if (!out) return;
    const v = VOICES[voice] || VOICES.uomo;
    const f0 = isPlayer ? 150 : (v.f0[0] + Math.random() * (v.f0[1] - v.f0[0])) * 0.72;
    const form = this._filter(out, 'bandpass', isPlayer ? f0 * 3 : v.f1, 3);
    this._tone(form, { type: 'sawtooth', f0, f1: f0 * 0.7, dur: 0.2, peak: 0.4, attack: 0.01 });
    this._noise(this._filter(out, 'bandpass', 700, 1.5), { dur: 0.09, peak: 0.25, attack: 0.002 });
  }

  /**
   * Due parole in un capannello. Non è un grido a volume basso: è la stessa gola
   * a volume di conversazione — fondamentale più bassa, formante sola, niente
   * vibrato. Due sillabe e non una, perché una sillaba sola si sente come un
   * verso; e non tre, perché tre sillabe sono una frase, e una frase vorrebbe
   * delle parole.
   */
  chatter(x, y, voice = 'uomo') {
    const v = VOICES[voice] || VOICES.uomo;
    const out = this._at(x, y, v.gain * 0.34, 0.5);
    if (!out) return;
    const f0 = (v.f0[0] + Math.random() * (v.f0[1] - v.f0[0])) * 0.6;
    const form = this._filter(out, 'bandpass', v.f1 * 0.9, 2.6);
    for (let i = 0; i < 2; i++) {
      const f = f0 * (i ? 0.86 : 1);
      this._tone(form, {
        type: 'sawtooth', f0: f, f1: f * 0.92, dur: 0.13,
        peak: i ? 0.24 : 0.32, attack: 0.025, t: i * (0.15 + Math.random() * 0.06),
      });
    }
  }

  /** Corpo che cade. La carne non risuona: tonfo basso e niente coda. */
  bodyFall(x, y) {
    const out = this._at(x, y, 0.3, 0.25);
    if (!out) return;
    this._tone(out, { type: 'sine', f0: 95, f1: 45, dur: 0.18, peak: 0.7, attack: 0.004 });
    this._noise(this._filter(out, 'lowpass', 500, 0.8), { dur: 0.12, peak: 0.4, attack: 0.004 });
  }

  /** Morte del giocatore: la stessa discesa che fa il ricercato, al contrario. */
  playerDown() {
    const out = this._at(null, null, 0.5, 1.4);
    if (!out) return;
    this._tone(out, { type: 'triangle', f0: 220, f1: 55, dur: 1.2, sweep: 1, peak: 0.4, attack: 0.02 });
    this._tone(out, { type: 'sine', f0: 110, f1: 40, dur: 1.3, sweep: 1.1, peak: 0.35, attack: 0.05 });
  }

  // --- suoni: mondo e interfaccia ---------------------------------------------

  /** Tuono. `far` 0..1: vicino è uno schianto, lontano è solo rimbombo che arriva dopo. */
  thunder(far = 0.5) {
    const delay = 0.15 + far * 2.2;
    const out = this._at(null, null, 0.55 * (1 - far * 0.45), delay + 3);
    if (!out) return;
    if (far < 0.35) {
      const crack = this._filter(out, 'highpass', 1200, 0.7);
      this._noise(crack, { dur: 0.3, peak: 0.5, attack: 0.002, t: delay });
    }
    const rum = this._filter(out, 'lowpass', 260 - far * 120, 0.6);
    this._noise(rum, { dur: 2.4, peak: 0.9, attack: 0.12 + far * 0.5, t: delay, pink: true });
    this._tone(out, { type: 'sine', f0: 48, f1: 26, dur: 1.8, peak: 0.35, attack: 0.2, t: delay });
  }

  /** Campanello della porta di un negozio: due tintinni, come nei 편의점. */
  bell() {
    const out = this._at(null, null, 0.3, 0.9, this.uiBus);
    if (!out) return;
    this._tone(out, { type: 'sine', f0: 1560, dur: 0.5, peak: 0.4, attack: 0.002 });
    this._tone(out, { type: 'sine', f0: 2080, dur: 0.6, peak: 0.28, attack: 0.002, t: 0.1 });
  }

  /** Raccolta a terra: due note che salgono, l'unica cosa che dice "preso". */
  pickup(kind = 'ammo') {
    const out = this._at(null, null, 0.3, 0.4, this.uiBus);
    if (!out) return;
    const base = kind === 'heal' ? 520 : 660;
    this._tone(out, { type: 'triangle', f0: base, dur: 0.12, peak: 0.4 });
    this._tone(out, { type: 'triangle', f0: base * 1.5, dur: 0.22, peak: 0.34, t: 0.08 });
  }

  /** Contanti: registratore di cassa. Due blip metallici e un frusciare di carta. */
  cash(gain = true) {
    const out = this._at(null, null, 0.34, 0.6, this.uiBus);
    if (!out) return;
    const f = gain ? 1 : 0.6;
    this._tone(out, { type: 'square', f0: 1180 * f, dur: 0.09, peak: 0.3 });
    this._tone(out, { type: 'square', f0: 1620 * f, dur: 0.3, peak: 0.26, t: 0.06 });
    this._noise(this._filter(out, 'bandpass', 3200, 3), { dur: 0.16, peak: 0.2, attack: 0.02, t: 0.05 });
  }

  /** Una stella in più: tre note che salgono, secche. Una in meno: due che scendono. */
  star(up = true) {
    const out = this._at(null, null, 0.42, 0.9, this.uiBus);
    if (!out) return;
    const notes = up ? [440, 587, 880] : [660, 440];
    notes.forEach((f, i) => {
      this._tone(out, { type: 'triangle', f0: f, dur: 0.3, peak: 0.34, t: i * 0.09 });
    });
    if (up) {
      const sw = this._filter(out, 'bandpass', 900, 1.2, { f1: 2600, sweep: 0.3 });
      this._noise(sw, { dur: 0.32, peak: 0.2, attack: 0.05 });
    }
  }

  /** Interfaccia: 'move' scorrere, 'ok' confermare, 'deny' rifiutare, 'open'/'close'. */
  ui(kind = 'move') {
    const out = this._at(null, null, 0.3, 0.3, this.uiBus);
    if (!out) return;
    switch (kind) {
      case 'ok':
        this._tone(out, { type: 'square', f0: 880, dur: 0.07, peak: 0.24 });
        this._tone(out, { type: 'square', f0: 1320, dur: 0.13, peak: 0.2, t: 0.05 });
        break;
      case 'deny':
        this._tone(out, { type: 'square', f0: 220, f1: 150, dur: 0.18, peak: 0.26 });
        break;
      case 'open':
        this._tone(out, { type: 'triangle', f0: 420, f1: 840, dur: 0.16, peak: 0.24 });
        break;
      case 'close':
        this._tone(out, { type: 'triangle', f0: 840, f1: 380, dur: 0.16, peak: 0.22 });
        break;
      default:
        this._tone(out, { type: 'square', f0: 1200, dur: 0.045, peak: 0.16 });
    }
  }

  /**
   * Campione di prova per il mixer: suona **sul bus che si sta regolando**, o si
   * finirebbe per tarare «Ambiente» ascoltando un clic che passa da un'altra parte.
   */
  preview(bus) {
    const dest = bus === 'ambient' ? this.amb : bus === 'ui' ? this.uiBus
      : bus === 'music' ? this.mus : this.sfx;
    const out = this._at(null, null, 0.32, 0.5, dest);
    if (!out) return;
    if (bus === 'ambient') {
      const lp = this._filter(out, 'lowpass', 900, 0.8, { f1: 300, sweep: 0.4 });
      this._noise(lp, { dur: 0.4, peak: 0.7, attack: 0.04, pink: true });
    } else if (bus === 'music') {
      // Un accordo, non un clic: la musica si regola su quello che suonerà, e
      // quasi sempre in quel momento non sta suonando niente.
      for (const n of [0, 3, 7]) {
        this._tone(out, { type: 'triangle', f0: 220 * Math.pow(2, n / 12), dur: 0.5, peak: 0.3, attack: 0.02 });
      }
    } else {
      this._tone(out, { type: 'triangle', f0: 660, dur: 0.12, peak: 0.4 });
      this._tone(out, { type: 'triangle', f0: 990, dur: 0.2, peak: 0.3, t: 0.07 });
    }
  }

  /** Cambio d'arma: lo scatto metallico della barra. */
  weaponSwitch() {
    const out = this._at(null, null, 0.24, 0.15, this.uiBus);
    if (!out) return;
    this._noise(this._filter(out, 'bandpass', 2800, 6), { dur: 0.05, peak: 0.5, attack: 0.001 });
    this._noise(this._filter(out, 'bandpass', 1500, 5), { dur: 0.06, peak: 0.3, attack: 0.001, t: 0.04 });
  }

  /** Mina che si arma: un bip solo, in mezzo alla strada si sente. */
  beep(x, y) {
    const out = this._at(x, y, 0.22, 0.2);
    if (!out) return;
    this._tone(out, { type: 'square', f0: 1800, dur: 0.08, peak: 0.3 });
  }
}

/**
 * Timbro di un'arma che non ha una riga in `GUN_TONE`: si ricava da cadenza e
 * danno. Un'arma nuova suona subito come qualcosa — piccola e veloce diventa
 * acuta e corta, lenta e pesante diventa cupa e lunga — e la riga a mano resta
 * un affinamento, non un obbligo (vedi la skill `/seoul-suono`).
 */
function gunTone(spec) {
  const heft = clamp((spec.damage || 20) / 90, 0.12, 1);
  const slow = clamp((spec.rate || 0.3) / 1.2, 0.05, 1);
  return {
    f: 2600 - heft * 1500,
    dec: 0.05 + slow * 0.32,
    body: 190 - heft * 110,
    tail: slow * 0.6,
    gain: 0.35 + heft * 0.6,
  };
}
