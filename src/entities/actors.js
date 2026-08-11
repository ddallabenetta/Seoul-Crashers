// I personaggi che devono **essere lì**.
//
// Tutto quello che cammina per Seoul è streaming puro: compare fuori inquadratura,
// sparisce oltre l'anello, e se torni indietro non è la stessa persona — è un altro
// pedone generato uguale. Va benissimo per una folla, e non funziona per nessuno che
// abbia un nome: un personaggio che ti aspetta dietro un banco non può svanire perché
// sei andato a prendere l'auto, né essere ricreato vivo dopo che l'hai ammazzato.
//
// L'unico precedente erano i mezzi `moored` (nascono al boot e non passano dallo
// streaming) e le guardie di un territorio, che restano comunque streaming.
//
// **Un attore non è un'entità nuova**, per la stessa ragione per cui non lo sono la
// polizia e la vita degli NPC: è un pedone di `game.peds` con `p.actor` scritto sopra.
// Quello che questo file possiede non è il pedone — è la sua **definizione**, che
// sopravvive a tutto: allo streaming, a `clearWorld`, a un caricamento.
//
// Da qui tre conseguenze da conoscere prima di toccarlo.
//
// **Il pedone si può perdere, la definizione no.** Un attore lontano viene despawnato
// come tutti (con un anello più largo, come chi è dentro un fatto di `life.js`) e
// ricreato quando il giocatore torna. È voluto: la sua posizione sta nella
// definizione, quindi torna **al suo posto** — che è esattamente quello che deve fare
// uno che ti aspetta dietro un banco.
//
// **Quello che non si ricrea è la morte.** `dead` sta sulla definizione, non sul
// pedone, e ci arriva dal bus (`pedKilled`). Un attore morto non ricompare mai più, e
// quel fatto entra nel salvataggio.
//
// **Un attore di strada non gira dentro un edificio.** Lì `game.peds` è scambiato
// con la gente del piano (§3): aggiungercelo lo farebbe comparire dentro un 노래방.
// Chi invece *sta* dentro un edificio si dichiara tale (`indoor`), e allora non è
// lo streaming a occuparsene ma il piano: vedi `populate`.
import { createPed } from './pedestrians.js';

// Oltre questo raggio non si crea; l'anello di despawn dello streaming è più largo,
// e la differenza fra i due è quello che impedisce a un attore di lampeggiare a chi
// gli cammina attorno al bordo.
const SPAWN_R = 1400;

export class ActorSystem {
  /** @param rng generatore suo: un attore non deve spostare lo streaming di nessuno. */
  constructor(rng) {
    this.rng = rng;
    this.defs = new Map();
  }

  /**
   * Registra un personaggio. `def` è quello che il pedone non sa rifare da sé:
   * dove sta, che aspetto ha, come si chiama e in che stato lo si trova.
   *
   *   game.actors.define('chunsik', {
   *     x, y, kind: 'gangster', name: 'Chun-sik', hangul: '춘식',
   *     state: 'idle', angle: Math.PI,
   *   });
   */
  define(id, def) {
    const prev = this.defs.get(id);
    this.defs.set(id, {
      id,
      kind: 'civil',
      // `post` e non `idle`: `idle` è una **sosta** e scade da sola, quindi un
      // personaggio nato così se ne andava a spasso dopo un secondo (già pagato).
      state: 'post',
      angle: 0,
      name: null,
      hangul: null,
      ...def,
      dead: prev ? prev.dead : false,
      ped: null,
    });
    return this.defs.get(id);
  }

  /** Il pedone vivo di un attore, oppure `null` (morto, o non ancora comparso). */
  get(id) {
    const d = this.defs.get(id);
    if (!d || d.dead) return null;
    const p = d.ped;
    return p && !p.gone && !p.dead ? p : null;
  }

  isDead(id) {
    return !!this.defs.get(id)?.dead;
  }

  /**
   * Lo ammazza il copione, non un proiettile. Oh Se-jung cade a metà della
   * sparatoria di M4 e **deve cadere anche se in quel momento non è a schermo**:
   * il suo pedone può essere stato despawnato mentre il giocatore era dall'altra
   * parte del piazzale, e una morte che dipende da dove guardi non è una morte.
   *
   * Se il pedone c'è muore davvero — sangue, tonfo, `pedKilled` sul bus, quindi
   * anche la definizione si segna morta da sé; se non c'è, si segna la definizione
   * e basta, che è l'unica cosa che sopravvive comunque (§5.27).
   */
  die(id, game, dx = 0, dy = 1) {
    const d = this.defs.get(id);
    if (!d || d.dead) return false;
    const p = this.get(id);
    if (p && game?.pedSystem) game.pedSystem.kill(p, dx, dy, game, null);
    else d.dead = true;
    return true;
  }

  /** Toglie del tutto un personaggio: se n'è andato dalla storia, non è morto. */
  undefine(id) {
    this.defs.delete(id);
  }

  /**
   * Si iscrive al bus una volta sola. La morte di un attore arriva da lì e non da
   * un controllo per frame: è il primo cliente vero del bus, ed è anche il motivo
   * per cui il bus è stato scritto prima di questo file.
   */
  attach(game) {
    game.on('pedKilled', (p) => {
      if (!p?.actor) return;
      const d = this.defs.get(p.actor);
      if (d) d.dead = true;
    });
  }

  /**
   * I personaggi che stanno **su questo piano**, da aggiungere alla sua gente.
   *
   * Un attore d'interno non passa da `update`: lo streaming non arriva dentro un
   * edificio, e il piano si ricostruisce a ogni visita (`shops.refreshCrowd`).
   * Quello che *non* si ricostruisce è il pedone di un attore — lo si tiene, e
   * quindi ci si ritrova le stesse ferite, la stessa posizione e lo stesso morto
   * a terra della visita prima, che è tutto il punto di avere un nome.
   *
   * `x`/`y` sono in coordinate della **pianta**, non della città (§3). Chi non le
   * sa in anticipo — ed è il caso normale, perché le piante sono generate — passa
   * `place(floor)` e le riceve la prima volta che quel piano viene aperto: da lì
   * restano scritte nella definizione, o il personaggio si sposterebbe a ogni visita.
   */
  populate(shopId, level, floor, game) {
    const out = [];
    for (const d of this.defs.values()) {
      if (!d.indoor || d.shop !== shopId || (d.level || 0) !== level) continue;
      // Un attore morto resta per terra come i clienti stesi (`floor.kept`): a
      // sparire è chi non c'è mai stato, non chi ci hai lasciato.
      if (d.dead) { if (d.ped) out.push(d.ped); continue; }
      let p = d.ped;
      if (!p || p.gone) {
        if (d.place && d.x === undefined) Object.assign(d, d.place(floor));
        p = createPed(d.kind, d.x, d.y, this.rng);
        p.actor = d.id;
        p.angle = d.angle;
        p.faceA = d.angle;
        p.state = d.state;
        p.indoor = true;
        // `staff` tiene un personaggio fuori dalla folla di passaggio: non se ne
        // va alla chiusura e non lo si ritrova diverso alla visita dopo.
        p.staff = true;
        p.role = d.role || 'keeper';
        p.home = { x: d.x, y: d.y };
        d.ped = p;
      }
      out.push(p);
    }
    return out;
  }

  update(dt, game) {
    // Dentro un edificio `game.peds` è la gente del piano: un attore di strada
    // aggiunto lì comparirebbe dentro il negozio.
    if (game.indoors || !this.defs.size) return;
    const pl = game.player;
    for (const d of this.defs.values()) {
      if (d.indoor) continue;
      if (d.dead) { d.ped = null; continue; }
      if (d.ped && !d.ped.gone) continue;
      d.ped = null;
      if (Math.hypot(d.x - pl.x, d.y - pl.y) > SPAWN_R) continue;
      const p = createPed(d.kind, d.x, d.y, this.rng);
      p.actor = d.id;
      p.angle = d.angle;
      p.faceA = d.angle;
      p.state = d.state;
      // Un attore non vaga: sta dove la storia lo ha messo. `home` è il posto suo,
      // e ci torna da solo se lo spostano — è quello che legge lo stato `post`.
      p.home = { x: d.x, y: d.y };
      d.ped = p;
      game.peds.push(p);
    }
  }

  /** Solo quello che una partita ha cambiato: chi è morto. Il resto si rifà. */
  snapshot() {
    const out = {};
    for (const [id, d] of this.defs) if (d.dead) out[id] = 1;
    return out;
  }

  restore(data) {
    for (const d of this.defs.values()) { d.dead = false; d.ped = null; }
    for (const id of Object.keys(data || {})) {
      const d = this.defs.get(id);
      if (d) d.dead = true;
    }
  }

  /** Partita nuova: tutti vivi, e nessuno in strada finché non li si rimette. */
  reset() {
    for (const d of this.defs.values()) { d.dead = false; d.ped = null; }
  }

  /** Il mondo è stato svuotato: i pedoni non ci sono più, le definizioni sì. */
  clearPeds() {
    for (const d of this.defs.values()) d.ped = null;
  }
}
