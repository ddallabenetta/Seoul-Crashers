// I cortili cambiano padrone, e il cambio resta.
//
// Fino a qui un territorio era un dato di generazione: nasceva dalla seed con la
// sua banda, il suo tag a terra e il suo banco, e restava di quella banda per
// sempre — anche dopo una guerra che ne aveva stesi sei (§5.26). Da qui in poi il
// padrone è **stato di partita**: si conquista, si compra, si perde, e sta nel
// salvataggio.
//
// Due scelte spiegano tutto il file.
//
// **Il padrone si scrive sul cortile, non in una tabella a parte.** Chi legge
// `t.gang`, `t.color`, `t.hangul` e `t.trade` è già mezza base di codice — il tag
// sull'asfalto (`render/ground.js`), i due rettangoli sulle carte (`ui/hud.js`,
// `ui/mapview.js`), l'anello sotto i piedi dei suoi (`render/scene.js`), il
// listino del banco (`entities/shops.js`), chi decide se prendersela con te
// (`entities/pedestrians.js`). Tenere il padrone da un'altra parte avrebbe voluto
// dire insegnare a tutti quei punti che esiste una seconda verità. Qui invece si
// riscrivono i campi che c'erano già, e il resto del gioco non si accorge di
// niente: **cambiare padrone è cambiare quei cinque campi**.
//
// **Nel salvataggio va solo la differenza.** Ogni cortile si ricorda il padrone
// di nascita (`gang0`), quindi uno slot contiene le poche righe in cui la partita
// si è discostata dalla seed — di solito zero, al massimo sei. È la stessa regola
// del resto del file di salvataggio (§5.15): si scrive quello che il giocatore ha
// cambiato, non quello che Seoul sa rifare da sola.
import { GANGS } from '../world/districts.js';
import { marketOf, won } from './shops.js';

/**
 * La banda del padre (§5.28, `docs/storia/01-personaggi.md`). Un cortile preso dal
 * giocatore passa a loro, e ci si dipinge il loro tag.
 *
 * **Ma «del 백호파» non vuol dire «tuo».** I due cortili che la Tigre Bianca ha
 * dalla seed non rispondono a Jae-min: che la banda di suo padre non gli obbedisca
 * ancora è la storia dell'Atto I, non un dettaglio da smentire con una rendita
 * regalata al primo minuto di partita. Tuo è quello che ti sei preso, e lo dice
 * `t.held` — l'unico campo che questo file aggiunge a un territorio.
 */
export const PLAYER_GANG = 'baekho';

// Quanto si sta dentro un cortile sgombro perché diventi tuo. Sei secondi sono
// abbastanza da non prenderlo per sbaglio passandoci in mezzo e pochi da non
// annoiare: il tempo lo occupa la barra, non l'attesa.
const TAKE_TIME = 6;
// Quanto lascia un cortile, per ora di gioco (un'ora di gioco è un minuto vero).
// Il metro di paragone è la cassa di un negozio, ₩20.000-90.000: un cortile ci
// arriva in una giornata piena e senza stelle addosso, che è esattamente la
// differenza fra una rendita e una rapina.
const POT_PER_HOUR = 2000;
// Oltre questo la busta non cresce più. Senza tetto, tornare dopo una settimana
// di gioco varrebbe più che tornare tutti i giorni — cioè il contrario di quello
// che un cortile deve chiedere al giocatore.
const POT_CAP_HOURS = 20;
// Il minimo che vale la pena raccogliere: sotto, la busta si lascia lì e non
// compare nemmeno il suggerimento.
const POT_MIN = 1500;
// Quanto vuole un capocortile per farsi da parte. Si ripaga in tre o quattro
// buste piene, ed è il prezzo *senza* morti: la via veloce costa piombo e stelle.
const YARD_PRICE = 320000;
// Un salto di orologio più lungo di così non è tempo passato: è un caricamento o
// un viaggio in metro. La busta non lo conta.
const CLOCK_JUMP = 26 * 60;

/** Minuti di gioco assoluti: l'orologio del giorno più i giorni passati. */
function clockMinutes(game) {
  const c = game.dayCycle;
  return c ? c.day * 24 * 60 + c.hour * 60 : 0;
}

export class TurfSystem {
  constructor(city) {
    this.city = city;
    this.actions = [];     // suggerimenti per l'HUD, come `shops.actions`
    this.taking = null;    // il cortile che si sta prendendo adesso
    this.takeT = 0;
    this.clockAt = null;   // orologio all'ultimo giro di busta
    this.told = false;     // la busta si spiega una volta sola, alla prima presa
    this.adopt();
  }

  /**
   * Il padrone di nascita e una chiave stabile, una volta sola per partita. La
   * chiave sono le coordinate del centro e non l'indice in `city.turfs`: quella
   * lista è la somma di tre città (`world/korea.js`) e un giorno potrebbe essere
   * costruita in un altro ordine, mentre un cortile sta dove sta.
   */
  adopt() {
    for (const t of this.city.turfs || []) {
      if (t.key) continue;
      t.key = `${Math.round(t.cx)},${Math.round(t.cy)}`;
      t.gang0 = t.gang;
      t.held = false;
      t.pot = 0;
    }
  }

  /** L'hai preso tu. */
  mine(t) { return !!t && !!t.held; }

  /** Il cortile che contiene un punto, col margine con cui lo si «entra». */
  turfAt(x, y, pad = 0) {
    for (const t of this.city.turfs || []) {
      if (x > t.x - pad && x < t.x + t.w + pad && y > t.y - pad && y < t.y + t.h + pad) return t;
    }
    return null;
  }

  /** L'identità della banda, scritta sul cortile: è tutto quello che «padrone» vuol dire. */
  setGang(t, id) {
    const g = GANGS.find((q) => q.id === id);
    if (!g) return;
    t.gang = g.id;
    t.name = g.name;
    t.hangul = g.hangul;
    t.color = g.color;
    t.trade = g.trade;
  }

  /**
   * Passa di mano. `how` dice come (`force`, `deal`, `war`) e finisce sul bus:
   * una missione che vuole sapere *in che modo* hai preso un cortile — M5 ne
   * conta tre e non le importa quale — non deve guardare dentro questo file.
   */
  claim(t, gangId, game, how = 'force') {
    if (!t) return false;
    // Tuo se te lo sei preso tu. Una guerra fra bande può portare un cortile al
    // 백호파 senza che tu ci fossi (`entities/life.js`): quello è della banda, e
    // la banda non ti deve niente.
    const held = gangId === PLAYER_GANG && (how === 'force' || how === 'deal');
    if (t.gang === gangId && !!t.held === held) return false;
    const wasMine = this.mine(t);
    const before = t.hangul;
    const beforeTrade = t.trade;
    const place = t.place;
    this.setGang(t, gangId);
    t.held = held;
    t.pot = 0;
    // Il cartello che si legge entrando adesso dice un'altra cosa: va riletto.
    t.warned = false;
    // Gli uomini di prima non passano al padrone nuovo: chi è ancora in piedi
    // lascia il cortile e torna a essere un passante. I successori arrivano dallo
    // streaming (`pedestrians.spawnTurf`) appena il giocatore si allontana, che è
    // anche il motivo per cui il cortile resta vuoto finché gli stai dentro.
    for (const p of game.peds) {
      if (p.turf !== t) continue;
      p.turf = null;
      p.gang = null;
      p.dealer = false;
      if (p.state === 'guard') p.state = 'walk';
    }
    t.dealer = null;
    t.dealerT = 0;
    this.taking = null;
    this.takeT = 0;
    // Il tag a terra è dipinto dentro un tile in cache: senza questo il cortile
    // resta del colore di prima finché la cache non gira da sola, cioè finché non
    // si attraversa mezza città (§4).
    game.scene?.ground?.invalidateRect(t);
    game.emit('turfClaimed', t, gangId, how);

    if (held) {
      // L'insegna vecchia si mostra solo se era di un'altra banda: «백호파 → 백호파»
      // sarebbe un passaggio di mano che non si vede.
      game.hud.toast(before === t.hangul ? `${t.hangul} · ${place} è tuo` : `${before} → ${t.hangul} · ${place} è tuo`, 3.2);
      // Cosa vuol dire averne uno si dice **una volta sola**, alla prima presa: da
      // lì in poi il giocatore lo sa, e il gioco non spiega due volte (§7).
      if (!this.told) {
        this.told = true;
        game.hud.toast('Un cortile tuo mette da parte una busta: torna a prenderla', 5);
        if (before !== t.hangul) game.hud.toast(`E il suo banco adesso tratta ${t.trade}, non più ${beforeTrade}`, 5.5);
      }
      game.audio?.ui('ok');
    } else if (wasMine) {
      game.hud.toast(`${place} — te l'ha preso il ${t.hangul}`, 3.6);
      game.audio?.ui('deny');
    }
    return true;
  }

  /** Quanto vuole il capocortile. Il quartiere pesa come su tutto il resto (§5.8). */
  price(t) {
    const mul = marketOf(t.district).goods;
    return Math.max(5000, Math.round(YARD_PRICE * mul / 5000) * 5000);
  }

  /**
   * La riga con cui un cortile si compra, da mettere in cima al listino del suo
   * banco (`shops.gangStock`). Sta qui e non lì perché il prezzo, il padrone e il
   * passaggio di mano sono roba di questo file: `shops` chiede e basta.
   *
   * I soldi li scala il pannello (`ui/shopmenu.js`), come per ogni altro
   * articolo, quindi `buy` non tocca il portafoglio.
   */
  stockItem(t, game) {
    if (!t || this.mine(t)) return null;
    const mul = marketOf(t.district).goods;
    const place = t.place;
    return {
      key: `yard:${t.key}`,
      // L'insegna della riga è il posto, e il mestiere lo dice il dettaglio: un
      // «il cortile — Il cortile dietro il club» si legge due volte per capirlo.
      label: place,
      hangul: '마당',
      base: YARD_PRICE,
      mul,
      price: this.price(t),
      detail: () => 'il cortile passa a te, gli uomini se ne vanno',
      buy: (g) => {
        if (!this.claim(t, PLAYER_GANG, g, 'deal')) return null;
        // Il pannello ha in testa l'insegna di chi il cortile non ce l'ha più:
        // si chiude invece di restare aperto su un banco che non esiste.
        g.shopMenu.close(g);
        return `${place} — è tuo`;
      },
    };
  }

  // --- il frame -----------------------------------------------------------------

  update(dt, game) {
    this.actions.length = 0;
    this.earn(game);
    if (game.indoors || game.metro?.inside || game.player.dying) {
      this.taking = null;
      this.takeT = 0;
      return;
    }
    const pl = game.player;
    const here = this.turfAt(pl.x, pl.y);
    if (!here || !pl.onFoot) {
      this.taking = null;
      this.takeT = 0;
      return;
    }
    if (this.mine(here)) {
      this.taking = null;
      this.takeT = 0;
      this.offerPot(here, game);
      return;
    }
    this.advance(here, dt, game);
  }

  /**
   * La busta cresce sull'**orologio**, non sui secondi veri: dormire in un futon
   * fino a domani deve valere una giornata di cortile, e infatti il letto sposta
   * le lancette (§5.8). Il salto di un caricamento o di un viaggio in metro no —
   * quello è tempo che il quartiere non ha vissuto.
   */
  earn(game) {
    const now = clockMinutes(game);
    const was = this.clockAt;
    this.clockAt = now;
    if (was === null) return;
    const mins = now - was;
    if (mins <= 0 || mins > CLOCK_JUMP) return;
    const cap = POT_PER_HOUR * POT_CAP_HOURS;
    for (const t of this.city.turfs || []) {
      if (!this.mine(t)) continue;
      t.pot = Math.min(cap, (t.pot || 0) + POT_PER_HOUR * marketOf(t.district).goods * (mins / 60));
    }
  }

  /**
   * La busta di un cortile tuo. Il tasto è **`F`**, non `E`: `F` è già il tasto
   * dei soldi (la cassa di un negozio, il mezzo al 전당포), e soprattutto `E`
   * dentro il proprio recinto è occupato dal banco della banda — con la busta lì
   * sopra, prendersi un cortile avrebbe voluto dire non poterci più comprare
   * niente.
   */
  offerPot(t, game) {
    const amount = Math.round(t.pot || 0);
    this.actions.push({
      key: 'F',
      // I nomi dei cortili cominciano con l'articolo («Il vicolo dei debiti»),
      // quindi il posto va davanti: «la busta di Il vicolo» non lo scrive nessuno.
      text: amount >= POT_MIN
        ? `${t.hangul} · ${t.place} — la busta: ${won(amount)}`
        : `${t.hangul} · ${t.place} — nella busta non c'è ancora niente`,
      run: () => {
        if (amount < POT_MIN) {
          game.hud.toast('La busta si riempie da sola: torna più tardi', 2.6);
          game.audio?.ui('deny');
          return;
        }
        t.pot = 0;
        game.player.money += amount;
        game.hud.toast(`${t.place} — la busta: ${won(amount)}`, 2.8);
        game.audio?.cash(false);
      },
    });
    this.readActions(game);
  }

  /**
   * Prendersi un cortile a mani proprie. Si prende **stando dentro**: un cortile
   * ripulito col fucile di precisione da un tetto sarebbe un cortile in cui non
   * sei mai entrato, e il tag lo si dipinge da vicino. Basta che ne resti in
   * piedi uno dei loro *dentro il recinto* perché la presa non cominci — chi è
   * scappato in strada ha già lasciato il posto.
   */
  advance(t, dt, game) {
    const guarded = game.peds.some((p) => p.turf === t && !p.dead && !p.gone
      && p.x > t.x - 60 && p.x < t.x + t.w + 60 && p.y > t.y - 60 && p.y < t.y + t.h + 60);
    this.taking = t;
    if (guarded) {
      this.takeT = Math.max(0, this.takeT - dt * 2);
      return;
    }
    this.takeT += dt;
    if (this.takeT < TAKE_TIME) return;
    this.claim(t, PLAYER_GANG, game, 'force');
  }

  /** Frazione di presa fatta, per la barra dell'HUD. 0 se non si sta prendendo niente. */
  get progress() {
    return this.taking ? Math.min(1, this.takeT / TAKE_TIME) : 0;
  }

  /**
   * I tasti delle proprie azioni se li legge il sistema, come fanno le missioni
   * (`core/missions.js`): l'HUD mostra e non decide, e `shops` non deve sapere
   * che esistono i cortili.
   */
  readActions(game) {
    const pl = game.player;
    for (const a of this.actions) {
      if (!game.input.wasPressed(`Key${a.key}`) || pl.enterCooldown > 0) continue;
      pl.enterCooldown = 0.35;
      a.run();
      return;
    }
  }

  // --- salvataggio ---------------------------------------------------------------

  snapshot() {
    const owners = {};
    const pots = {};
    const held = [];
    for (const t of this.city.turfs || []) {
      if (t.gang !== t.gang0) owners[t.key] = t.gang;
      if (t.held) held.push(t.key);
      if (t.pot >= 1) pots[t.key] = Math.round(t.pot);
    }
    return { owners, pots, held, told: this.told };
  }

  restore(data, game) {
    this.reset(game);
    if (!data) return;
    const owners = data.owners || {};
    const pots = data.pots || {};
    const held = new Set(data.held || []);
    for (const t of this.city.turfs || []) {
      if (owners[t.key] && owners[t.key] !== t.gang) {
        this.setGang(t, owners[t.key]);
        game?.scene?.ground?.invalidateRect(t);
      }
      t.held = held.has(t.key);
      t.pot = pots[t.key] || 0;
    }
    this.told = !!data.told;
  }

  /** Partita nuova: Seoul torna quella della seed. */
  reset(game) {
    for (const t of this.city.turfs || []) {
      if (t.gang !== t.gang0) {
        this.setGang(t, t.gang0);
        game?.scene?.ground?.invalidateRect(t);
      }
      t.held = false;
      t.pot = 0;
      t.dealer = null;
      t.dealerT = 0;
      t.warned = false;
    }
    this.actions.length = 0;
    this.taking = null;
    this.takeT = 0;
    this.clockAt = null;
    this.told = false;
  }
}
