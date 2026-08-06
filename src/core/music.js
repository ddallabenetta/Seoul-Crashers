// Musica di gioco. Vale il vincolo di tutto il resto (§7): niente file, niente
// asset — le note nascono dagli stessi oscillatori con cui sparano le pistole in
// `audio.js`. Ma la musica non è un suono in più, è **regia**: la domanda vera non
// è che timbro ha, è *quando parte e quando tace*.
//
// La risposta di questo file, in tre righe:
//
//   1. **In strada non suona niente.** Seoul ha già un fondo suo (traffico, pioggia,
//      insegne, sirene) e in macchina c'è la radio (§5.14), che è musica scelta dal
//      giocatore. Coprirle con un tappeto sarebbe togliere, non aggiungere.
//   2. **Suona dove il gioco parla di sé**: il menu iniziale (il tema) e la caccia
//      (l'inseguimento). Sono i due momenti in cui non c'è niente da ascoltare
//      *nel* mondo e tutto da sentire *sul* mondo.
//   3. **La radio vince sempre.** Se il giocatore ha acceso la sua stazione, la
//      musica del gioco non si sovrappone nemmeno con cinque stelle addosso.
//
// Tecnicamente è uno **scheduler in anticipo**: ogni frame si programmano sul
// clock del contesto le note dei prossimi 0,25 s. Non si può suonare a `dt` del
// game loop — un frame lungo diventerebbe una nota in ritardo, e sedici note in
// ritardo sono una canzone che zoppica. Il loop decide *cosa*, l'orologio
// dell'audio decide *quando*.
import { clamp, damp } from './math.js';

// Un passo è una croma. Bar = 8 passi, giro = 4 battute.
const STEPS_PER_BAR = 8;
const BARS = 4;
const LOOKAHEAD = 0.25;

const BPM = { menu: 84, chase: 148 };
// Guadagno del pezzo dentro il bus musica. Il tema sta più alto della caccia:
// nel menu non c'è nient'altro, in strada ci sono sirene e piombo.
const LEVEL = { menu: 0.85, chase: 0.5 };

// Semitoni rispetto al LA1 (55 Hz): `r` è il basso, `t` la triade.
const CHORDS = {
  am: { r: 0, t: [0, 3, 7] },
  f:  { r: -4, t: [-4, 0, 3] },
  c:  { r: 3, t: [3, 7, 10] },
  g:  { r: -2, t: [-2, 2, 5] },
};
// La minore, giro di quattro battute. Il tema respira (i-VI-III-VII), la caccia
// batte due volte sulla tonica prima di muoversi: è la differenza fra guardare
// una città e attraversarla con una volante dietro.
const PROG = {
  menu: [CHORDS.am, CHORDS.f, CHORDS.c, CHORDS.g],
  chase: [CHORDS.am, CHORDS.am, CHORDS.f, CHORDS.g],
};

// Pentatonica minore: cinque note, ed è anche la scala su cui gira la musica
// tradizionale coreana. Tutto quello che canta pesca da qui.
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];
// Motivo del ritornello della caccia, in gradi della pentatonica.
const RIFF = [5, 4, 5, 7, 6, 4, 3, 4];
// Arpeggio del tema: indici nella triade allargata (la quarta voce è l'ottava).
const ARP = [0, 2, 1, 3, 2, 1, 3, 2];

const hz = (n) => 55 * Math.pow(2, n / 12);

export class MusicSystem {
  /** @param audio l'`AudioSystem`: da lì arrivano contesto, rumore e bus del mixer. */
  constructor(audio) {
    this.audio = audio;
    this.ctx = audio.ctx;
    this.cue = null;        // pezzo che sta suonando
    this.want = null;       // pezzo che dovrebbe suonare
    this.intensity = 0;     // 0..1: quanti strati ha la caccia
    this.g = 0;
    this.target = 0;
    this.stepI = 0;
    this.nextT = 0;
    this.voices = 0;

    const ctx = this.ctx;
    // Due strade verso il mixer. `bus` porta il pezzo e il suo guadagno **è** la
    // dissolvenza; gli stacchi (arresto, partenza) vanno su `stings`, che non
    // sfuma mai — o un colpo di scena arriverebbe a volume di quello che c'era
    // prima invece che a volume suo.
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(audio.mus);
    this.stings = ctx.createGain();
    this.stings.gain.value = 1;
    this.stings.connect(audio.mus);
  }

  get stats() {
    return {
      pezzo: this.cue, verso: this.want, volume: +this.g.toFixed(3),
      intensita: +this.intensity.toFixed(2), voci: this.voices,
      bpm: this.cue ? BPM[this.cue] : 0, battuta: Math.floor(this.stepI / STEPS_PER_BAR) % BARS,
    };
  }

  // --- regia --------------------------------------------------------------

  /**
   * Chi decide cosa suona. È l'unico punto del file che sa qualcosa del gioco, e
   * sta qui apposta: se domani la musica deve partire per una missione, si tocca
   * questa funzione e nient'altro.
   */
  direct(game) {
    let want = null;
    if (!game.started) want = 'menu';
    else if (game.wanted.level >= 2 && !game.indoors && !game.player.dying) want = 'chase';
    // La radio è la musica che ha scelto il giocatore: non gliela si copre.
    if (want === 'chase' && game.radio?.on) want = null;
    this.want = want;
    this.intensity = clamp((game.wanted.level - 1) / 4, 0, 1);

    if (this.want !== this.cue) {
      // Si sfuma il vecchio pezzo fino al silenzio e solo lì si cambia: tagliare
      // a metà battuta si sente come un guasto, esattamente come per i letti.
      this.target = 0;
      if (this.g < 0.01) {
        this.cue = this.want;
        this.stepI = 0;
        this.nextT = this.ctx.currentTime + 0.06;
      }
    }
    if (this.cue && this.cue === this.want) {
      this.target = LEVEL[this.cue] * (this.cue === 'chase' ? 0.72 + 0.28 * this.intensity : 1);
    }
  }

  update(dt, game) {
    this.direct(game);
    this.g = damp(this.g, this.target, 0.3, dt);
    this.bus.gain.value = this.g;
    if (!this.cue || this.g < 0.005) return;

    const now = this.ctx.currentTime;
    // Scheda in secondo piano, muto tolto, caricamento lungo: l'orologio del
    // contesto è andato avanti senza di noi. Si riparte da adesso invece di
    // sparare in un colpo solo tutte le note arretrate.
    if (this.nextT < now - 0.4) this.nextT = now + 0.05;
    const spb = 30 / BPM[this.cue];   // durata di una croma
    while (this.nextT < now + LOOKAHEAD) {
      this.step(this.stepI, this.nextT);
      this.stepI = (this.stepI + 1) % (STEPS_PER_BAR * BARS);
      this.nextT += spb;
    }
  }

  step(i, t) {
    if (this.cue === 'menu') this.stepMenu(i, t);
    else if (this.cue === 'chase') this.stepChase(i, t);
  }

  // --- i due pezzi ----------------------------------------------------------

  /**
   * Il tema. Lento, largo, senza batteria vera: un pad che tiene l'accordo, un
   * basso sotto e un arpeggio che si muove. Sotto sta girando la città vera
   * (§5.18), e la musica non deve raccontare l'azione — deve reggere un titolo.
   */
  stepMenu(i, t) {
    const bar = Math.floor(i / STEPS_PER_BAR) % BARS;
    const beat = i % STEPS_PER_BAR;
    const ch = PROG.menu[bar];
    if (beat === 0) {
      for (const n of ch.t) {
        this.note({ type: 'triangle', f: hz(n + 24), t, dur: 3.4, peak: 0.075, attack: 0.7, lp: 1500 });
      }
      this.note({ type: 'sine', f: hz(ch.r), t, dur: 2.4, peak: 0.24, attack: 0.03 });
      this.kick(t, 0.22);
    }
    if (beat === 4) this.note({ type: 'sine', f: hz(ch.r + 12), t, dur: 1.2, peak: 0.11, attack: 0.03 });
    const voices = [ch.t[0], ch.t[1], ch.t[2], ch.t[0] + 12];
    this.note({
      type: 'triangle', f: hz(voices[ARP[beat]] + 36), t,
      dur: 0.5, peak: beat % 2 ? 0.05 : 0.075, attack: 0.004, lp: 2600,
    });
    if (beat % 2 === 1) this.hat(t, 0.03);
  }

  /**
   * La caccia. Cassa in quarti, basso in crome, e due strati che entrano con le
   * stelle: gli accordi a tre stelle, il ritornello a quattro. La musica dice
   * quanto sei nei guai **prima** che tu conti le stelle sull'HUD.
   */
  stepChase(i, t) {
    const bar = Math.floor(i / STEPS_PER_BAR) % BARS;
    const beat = i % STEPS_PER_BAR;
    const ch = PROG.chase[bar];
    if (beat % 2 === 0) this.kick(t, 0.42);
    if (beat === 2 || beat === 6) this.snare(t, 0.28);
    this.hat(t, beat % 2 ? 0.075 : 0.045);
    // Il basso sale di un'ottava sull'ultima croma: è la spinta che rilancia la
    // battuta dopo, e costa una riga.
    this.bass(hz(ch.r + (beat === 7 ? 12 : 0)), t, 0.19);
    if (this.intensity > 0.35 && (beat === 3 || beat === 6)) {
      for (const n of ch.t) {
        this.note({ type: 'sawtooth', f: hz(n + 24), t, dur: 0.24, peak: 0.045, attack: 0.006, lp: 2400 });
      }
    }
    if (this.intensity > 0.7 && bar % 2 === 1) {
      const n = PENTA[RIFF[beat] % PENTA.length];
      this.note({ type: 'square', f: hz(n + 36), t, dur: 0.22, peak: 0.05, attack: 0.005, lp: 3200 });
    }
  }

  /**
   * Stacchi. Non sono musica, sono punteggiatura: durano un secondo e mezzo e
   * suonano anche a pezzo spento, perché arrivano proprio dove la musica tace.
   */
  sting(kind) {
    if (!this.audio.on) return;
    const t = this.ctx.currentTime + 0.02;
    const d = this.stings;
    if (kind === 'go') {
      // Partenza: tre note che salgono sulla tonica e un tonfo. Serve a dire
      // «adesso comandi tu», che è l'unica cosa che il menu non può dire.
      [0, 7, 12].forEach((n, k) => {
        this.note({ type: 'triangle', f: hz(n + 24), t: t + k * 0.08, dur: 0.5, peak: 0.16, attack: 0.005, lp: 3000, dest: d });
      });
      this.kick(t + 0.16, 0.6, d);
    } else if (kind === 'busted') {
      // Arresto: due accordi che scendono, e il secondo è più lungo del primo.
      [[0, 3, 7], [-2, 1, 5]].forEach((ch, k) => {
        for (const n of ch) {
          this.note({ type: 'sawtooth', f: hz(n + 12), t: t + k * 0.42, dur: k ? 1.5 : 0.42, peak: 0.09, attack: 0.02, lp: 900, dest: d });
        }
      });
    }
  }

  // --- costruzione delle note -----------------------------------------------

  /**
   * Una nota. I nodi si staccano da soli a fine corsa (`onended`): un pezzo che
   * lascia dietro di sé venti gain al secondo fa crescere il grafo per tutta la
   * partita, ed è il modo silenzioso di rovinare gli fps a chi non spegne mai.
   */
  note({ type = 'triangle', f, t, dur, peak = 0.1, attack = 0.006, lp = 0, dest = null }) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let filt = null;
    if (lp) {
      filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = lp;
      g.connect(filt);
      filt.connect(dest || this.bus);
    } else {
      g.connect(dest || this.bus);
    }
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    osc.connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.03);
    this.voices++;
    osc.onended = () => {
      this.voices--;
      g.disconnect();
      if (filt) filt.disconnect();
    };
    return osc;
  }

  /** Basso della caccia: dente di sega con il filtro che si chiude. È il motore. */
  bass(f, t, peak) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1100, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.16);
    lp.Q.value = 4;
    g.connect(lp);
    lp.connect(this.bus);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.24);
    this.voices++;
    osc.onended = () => { this.voices--; g.disconnect(); lp.disconnect(); };
  }

  kick(t, peak, dest = null) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    g.connect(dest || this.bus);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(128, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.09);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.26);
    this.voices++;
    osc.onended = () => { this.voices--; g.disconnect(); };
  }

  snare(t, peak) {
    this._noise(t, peak, 0.17, 'bandpass', 1900, 0.8);
    this.note({ type: 'triangle', f: 195, t, dur: 0.12, peak: peak * 0.4, attack: 0.002 });
  }

  hat(t, peak) {
    this._noise(t, peak, 0.045, 'highpass', 7200, 0.7);
  }

  /** Rumore con inviluppo: usa gli stessi due buffer generati al boot da `audio.js`. */
  _noise(t, peak, dur, type, f, q) {
    const ctx = this.ctx;
    const buf = this.audio.white;
    if (!buf) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    filt.Q.value = q;
    g.connect(filt);
    filt.connect(this.bus);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.connect(g);
    this.voices++;
    s.onended = () => { this.voices--; g.disconnect(); filt.disconnect(); };
    s.start(t, Math.random() * (buf.duration - dur - 0.1), dur + 0.05);
  }
}
