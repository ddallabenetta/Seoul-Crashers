// Il pedinamento: stargli dietro senza starci addosso.
//
// È la meccanica nuova più leggera dell'Atto I e torna in M6 e M9, quindi non sta
// dentro una missione: sta qui, e una missione la accende con `begin` e ascolta
// due fatti sul bus (§5.27). Come `core/missions.js` non conosce nessuna missione,
// questo file non sa **chi** stia seguendo chi.
//
// La regola è una sola e ha due capi. Troppo lontano e lo perdi; troppo vicino e
// ti vede. In mezzo c'è una fascia larga in cui non succede niente, ed è dove il
// giocatore deve imparare a stare — è per questo che l'indicatore non è una barra
// che si riempie ma **un cursore fra due bordi rossi**: dice da che parte stai
// sbagliando prima di dire quanto.
//
// Due decisioni che sembrano dettagli e non lo sono:
//
//   · **niente si azzera di colpo.** Uscire dalla fascia riempie un serbatoio, e
//     rientrare lo svuota — al doppio della velocità con cui si è riempito. Un
//     semaforo perso non fa fallire una scena da quattro minuti, e un sorpasso
//     sfortunato nemmeno;
//   · **quello che vede non è solo la distanza.** I fari accesi di notte, la
//     lamiera che si tocca e le sirene addosso valgono quanto starci sotto il
//     paraurti — e sono le tre cose che un giocatore fa senza accorgersene.
import { dist } from './math.js';

/** Oltre questo, l'hai perso: è la distanza a cui due fanalini sono un fanalino. */
const LOSE = 620;
/** Sotto questo, ti ha visto: è la lunghezza di tre auto in fila. */
const SPOT = 132;
/** Secondi di fila fuori fascia che chiudono la scena. */
const LOSE_TIME = 6;
const SPOT_TIME = 4.5;
/** Quanto più in fretta si rientra di quanto si sbaglia. */
const RECOVER = 2;

export class TailSystem {
  constructor() {
    this.reset();
  }

  reset() {
    /** Il mezzo pedinato, o `null`. Ce n'è **uno**: come il blip. */
    this.target = null;
    /** Quanto ti sei fatto notare, 0..1. */
    this.heat = 0;
    /** Quanto lo stai perdendo, 0..1. */
    this.slip = 0;
    this.d = 0;
    this.label = null;
    /** L'hai urtata **tu**: una lamiera toccata dal traffico non conta. */
    this.touched = false;
    this._hp = 0;
    this.lose = LOSE;
    this.spot = SPOT;
    this.ended = null;
  }

  get active() {
    return !!this.target;
  }

  /**
   * Comincia. `target` è un veicolo — un pedone verrebbe da sé, ma l'unico
   * pedinamento scritto finora è in macchina e non vale la pena indovinare il
   * resto adesso.
   */
  begin(game, target, opts = {}) {
    this.reset();
    if (!target) return false;
    this.target = target;
    this.label = opts.label || null;
    this.lose = opts.lose || LOSE;
    this.spot = opts.spot || SPOT;
    this.d = dist(game.player.x, game.player.y, target.x, target.y);
    this._hp = target.hp;
    return true;
  }

  stop() {
    this.reset();
  }

  /**
   * Il frame. Non muove niente e non ferma niente: alza i due serbatoi e, quando
   * uno arriva in fondo, lo dice al bus e si spegne. **Chi decide cosa vuol dire
   * è la missione** — in M3 «l'hai perso» rimette la fase, in M9 potrebbe non
   * essere nemmeno un fallimento.
   */
  update(dt, game) {
    const v = this.target;
    if (!v) return;
    // Dentro un edificio le coordinate del giocatore sono quelle della pianta
    // (§3): un pedinamento misurato da lì direbbe sempre «l'hai perso» a chi si è
    // solo fermato a comprare un caffè. Il tempo si congela come tutto il resto.
    if (game.indoors || game.player.dying) return;
    if (v.dead || !game.vehicles.includes(v)) {
      this.finish(game, 'lost');
      return;
    }
    const pl = game.player;
    this.d = dist(pl.x, pl.y, v.x, v.y);

    // Farsi notare. La distanza è la parte facile: le altre tre sono quelle che
    // in una prova a schermo hanno fatto fallire la scena senza spiegare perché,
    // quindi l'indicatore le mostra come mostra la distanza.
    const glare = game.isNight && !pl.onFoot && pl.vehicle?.lightsOn;
    // La lamiera toccata conta **solo se sei tu a toccarla**. Il traffico civile
    // tampona chiunque (§5.10), e con `hp < maxHp` la scena poteva saltare per un
    // urto fra due estranei dall'altra parte dell'incrocio: una prova headless si
    // è chiusa con «ti ha visto» mentre il giocatore era fermo a duecento metri.
    if (v.hp < this._hp && this.d < 120) this.touched = true;
    this._hp = v.hp;
    const sirens = game.wanted.level >= 2;
    const close = this.d < this.spot;
    const seen = close || glare || this.touched || sirens;
    const push = (close ? 1 : 0) + (glare ? 0.7 : 0) + (this.touched ? 1.4 : 0) + (sirens ? 1 : 0);
    if (seen) this.heat = Math.min(1, this.heat + (dt / SPOT_TIME) * Math.max(1, push));
    else this.heat = Math.max(0, this.heat - (dt / SPOT_TIME) * RECOVER);

    if (this.d > this.lose) this.slip = Math.min(1, this.slip + dt / LOSE_TIME);
    else this.slip = Math.max(0, this.slip - (dt / LOSE_TIME) * RECOVER);

    if (this.heat >= 1) this.finish(game, 'spotted');
    else if (this.slip >= 1) this.finish(game, 'lost');
  }

  finish(game, why) {
    this.ended = why;
    this.stop();
    game.emit(why === 'spotted' ? 'tailSpotted' : 'tailLost');
  }

  /**
   * Dove sta il cursore fra i due bordi: 0 gli sei sotto il paraurti, 1 l'hai
   * perso di vista. Lo legge solo l'HUD.
   */
  get gauge() {
    const span = Math.max(1, this.lose - this.spot);
    return Math.max(0, Math.min(1, (this.d - this.spot) / span));
  }
}
