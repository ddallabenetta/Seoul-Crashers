// 까치, la frequenza 91.45.
//
// È una tabella di righe con predicato, come deciso nel copione: nessun `if`
// nelle missioni e nessuna rete. Le emittenti vere restano a `Radio`; questo
// sistema parla solo quando il giocatore ha scelto la frequenza virtuale.

const K = (text) => ({ kkachi: true, text });
const J = (text) => ({ who: 'Jae-min', text });
const done = (game, id) => !!game.missions?.isDone(id);
const area = (game) => game.areaAt?.(game.player.x, game.player.y)?.id || null;
const nearTurf = (game, gang, radius = 520) => (game.city.turfs || []).some((t) =>
  t.gang === gang && Math.hypot(t.cx - game.player.x, t.cy - game.player.y) < radius);

export const KKACHI_CALLS = [
  { id: 1, when: (g) => done(g, 'm1') && g.stats.districts.size > 1,
    lines: [K('Tre ponti per ventitré milioni di persone. Quando ne chiudono uno, per due giorni la città è un’altra città.'), J('E chi li chiude?'), K('Quelli che hanno bisogno che tu passi da dove dicono loro.')] },
  { id: 2, when: (g) => g.dayCycle.rain > 0.18,
    lines: [K('Con l’acqua la gente compra di più e ruba di meno. È l’unica statistica del quartiere che non ha mai sbagliato.'), J('Chi la teneva?'), K('Uno che stava sempre alla finestra.')] },
  { id: 3, when: (g) => g.player.owned.size > 2,
    lines: [K('Non ti serve. Ti serve che si veda che ce l’hai. Sono due mestieri diversi e li paghi allo stesso prezzo.')] },
  { id: 4, when: (g) => g.stats.deaths >= 3,
    lines: [K('Ti hanno rimesso insieme in fretta. Ci sono posti dove non ti rimettono insieme per niente.'), J('Chi paga?'), K('Chi ha bisogno che tu cammini.')] },
  { id: 5, when: (g) => g.player.district?.id === 'gangnam' && g.player.outfit === 0,
    lines: [K('Non metterlo qui.'), J('Me l’hanno già detto.'), K('Allora ero io.')] },
  { id: 6, when: (g) => g.dayCycle.hour >= 3 && g.dayCycle.hour < 5,
    lines: [K('A quest’ora in strada ci sono tre categorie: chi torna, chi non è mai andato a casa e chi lavora. Tu di quale sei?'), J('Della quarta.'), K('Non esiste una quarta.'), J('Appunto.')] },
  { id: 7, when: (g) => g.stats.stolen >= 2,
    lines: [K('Adesso quella signora racconterà di un uomo alto un metro e ottantatré.'), J('Sono un metro e settantotto.'), K('Sì. Ma è l’altezza che dicono sempre.')] },
  { id: 8, when: (g) => done(g, 'm3') && g.player.district?.id === 'itaewon',
    lines: [K('I martedì e i venerdì. Dodici anni. Se moltiplichi, fa una cifra che in una busta non ci sta.'), J('E dove va a finire?'), K('Nelle perizie. Le paga qualcuno, e quel qualcuno siete voi.')] },
  { id: 9, when: (g) => done(g, 'm4') && g.player.district?.id === 'gyeonggi',
    lines: [K('Qui si demolisce senza gru. Basta smettere di riparare le strade e aspettare sei anni.')] },
  { id: 10, when: (g) => ['heli', 'plane'].includes(g.player.vehicle?.kind),
    lines: [K('Da lassù non si vede chi deve cosa a chi. È per questo che a loro piace guardare da lassù.'), J('Chi, loro?'), K('…Quelli che guardano da lassù.')] },
  { id: 11, when: (g) => done(g, 'm5') && nearTurf(g, 'hwangso'),
    lines: [K('Il vecchio Pyo ti ha chiamato con un altro nome.'), J('Come lo sai?'), K('Perché l’ha detto ad alta voce.')] },
  { id: 12, when: (g) => done(g, 'm5') && g.player.outfit > 0,
    lines: [K('Ti sta male.'), J('È della mia taglia.'), K('Non ho detto che è piccolo. Ho detto che ti sta male.')] },
  { id: 13, when: (_g, s) => s.usedMetro,
    lines: [K('Sotto non ti sento. È l’unico posto della città dove sei solo.'), { text: 'Sette secondi di fruscio. Nessuna risposta.' }] },
  { id: 14, when: (g) => done(g, 'm6'),
    lines: [J('Cos’è un’acquisizione?'), K('Una voce di bilancio.'), J('E un bambino?'), K('Una voce di bilancio.')] },
  { id: 15, when: (g, s) => s.cleanDriveT >= 10,
    lines: [K('Adesso non ti cerca nessuno. Goditelo, dura poco e non torna.'), { text: 'Jae-min non risponde.' }, K('Bravo.')] },
  { id: 16, when: (g) => done(g, 'm4') && g.player.district?.id === 'hongdae',
    lines: [K('Le buste bianche si contano il giorno dopo. Chi ha messo di più, di solito, è chi ha più da farsi perdonare.')] },
  { id: 17, when: (g) => (g.missions?.active === 'm9' || done(g, 'm9')) && area(g) === null,
    lines: [K('Quattrocento chilometri e non cambia niente. È tutto lo stesso paese, e questo è il problema: non c’è un posto dove non arrivano.')] },
  { id: 18, when: (g) => area(g) === 'busan',
    lines: [K('Qui parlano diverso. Tuo padre diceva che a Busan si mente più forte ma meno spesso.'), J('Diceva.'), K('Dice.')] },
  { id: 19, when: (g) => g.player.vehicle?.kind === 'boat' && area(g) !== 'seoul',
    lines: [K('…perdo… la banda…'), { text: 'C’è troppa acqua fra le due frequenze.' }] },
  { id: 20, when: (g) => done(g, 'm11') && area(g) === 'seoul',
    lines: [J('Ti ricordi la cucina?'), K('Quale cucina.'), J('Quella con la radio sul frigo.'), K('C’era la radio accesa.')] },
  { id: 21, when: (g) => done(g, 'm8') && g.dayCycle.isNight,
    lines: [K('Lì dentro c’è una ragazza che non dorme mai.'), J('La conosci?'), K('Mi conosce lei.')] },
  { id: 22, when: (_g, s) => s.fourSaves,
    lines: [J('Che partita è ancora in corso?'), K('Non ho detto niente di sbagliato, quindi non è quella la domanda.'), J('È la quarta volta.'), K('È la prima.')] },
  { id: 23, when: (g) => done(g, 'm8') && g.shops.sealed.size > 0,
    lines: [K('Questa strada me la ricordo con più insegne.'), J('Sei una radio. Non ti ricordi niente.'), K('No. No.')] },
  { id: 24, when: (g) => g.missions?.active === 'm12',
    lines: [K('Se stanotte non torni, io continuo a parlare lo stesso. Volevo che lo sapessi da me.'), J('Perché me lo dici?'), K('Perché è quello che si dice, prima.')] },
];

const SERVICE = [
  (g) => g.dayCycle.hour >= 5 && g.dayCycle.hour < 8 && 'Le sei e dieci. Il traffico va da sud: a quest’ora chi entra a Seoul ci viene a lavorare.',
  (g) => g.dayCycle.rain > 0.55 && 'Piove da tre ore. Frena prima.',
  (g) => g.dayCycle.weather?.id === 'storm' && 'Con questo tempo le volanti stanno sotto i cavalcavia.',
  (g) => g.player.vehicle?.hp < 45 && 'Questa macchina fa un rumore che due giorni fa non faceva.',
  (g) => g.player.vehicle?.occupiedTheft && 'Il proprietario sta già telefonando. Gli servono nove minuti per farsi credere.',
  (g) => g.player.money < 30000 && 'Hai in tasca meno di quanto costa un pieno. Non è un giudizio, è un’informazione.',
  (g) => g.dayCycle.hour >= 2 && g.dayCycle.hour < 5 && 'Tre auto in tutta la strada, e due sono ferme.',
  (g) => g.dayCycle.hour >= 18 && 'Le insegne si accendono a scaglioni: prima i 편의점, poi i 술집.',
  (g) => g.dayCycle.hour >= 12 && g.dayCycle.hour < 17 && g.dayCycle.rain < 0.1 && 'Bella giornata. Si vede tutto il quartiere, e tutto il quartiere vede te.',
  () => 'Adesso non si guida, si sta in fila. Se prendi i vicoli fai prima e sbagli lo stesso.',
  () => 'Qui non ci sei mai stato. Si capisce da come guardi i numeri civici.',
  () => 'Motore acceso. La città ha già cominciato senza di te.',
];

export class KkachiSystem {
  constructor() { this.reset(); }

  reset() {
    this.heard = new Set();
    this.missed = new Set();
    this.active = null;
    this.cooldown = 0;
    this.cleanDriveT = 0;
    this.usedMetro = false;
    this.fourSaves = false;
    this._inCar = false;
    this._metro = false;
    this._serviceIndex = 0;
    this.pendingService = null;
    this._callLines = null;
  }

  attach(game) {
    game.on('busted', () => { this.pendingService = 'Sei ore. Ti hanno preso l’arsenale e un quinto dei contanti.'; });
  }

  get heardCount() { return this.heard.size; }
  get missedCount() { return this.missed.size; }
  get hiddenReady() { return this.heard.size >= 20; }

  eligible(game) {
    return !!(game.radio?.isKkachi && !game.player.onFoot && game.player.vehicle
      && !game.indoors && !game.metro?.inside && game.wanted.level < 5);
  }

  update(dt, game) {
    const inCar = !game.player.onFoot && !!game.player.vehicle;
    if (game.metro?.inside && !this._metro) this.usedMetro = true;
    this._metro = !!game.metro?.inside;
    try {
      this.fourSaves = this.fourSaves || ['seoul.save.0', 'seoul.save.1', 'seoul.save.2', 'seoul.save.auto']
        .every((k) => !!window.localStorage?.getItem(k));
    } catch { /* il quarto salvataggio resta una chiamata facoltativa */ }

    if (inCar && game.wanted.level === 0) this.cleanDriveT += dt;
    else this.cleanDriveT = 0;
    this.cooldown = Math.max(0, this.cooldown - dt);

    const eligible = this.eligible(game);
    // La manopola resta attiva durante un dialogo radio: cambiare stazione o
    // spegnerla interrompe la telefonata e la conta fra quelle perse.
    if (this.active && (!eligible || game.dialogue.lines !== this._callLines)) {
      this.interrupt(game);
    }
    if (eligible && !this._inCar && !game.dialogue.active && !game.cutscene.active) this.service(game);
    this._inCar = inCar;
    if (!eligible || this.cooldown > 0 || this.active || game.dialogue.active
      || game.cutscene.active || game.paused) return;

    const call = KKACHI_CALLS.find((c) => !this.heard.has(c.id) && !this.missed.has(c.id) && c.when(game, this));
    if (call) this.play(call, game);
  }

  service(game) {
    if (this.pendingService) {
      game.hud.toast(`91.45 — «${this.pendingService}»`, 5);
      this.pendingService = null;
      return;
    }
    const ordered = SERVICE.slice(this._serviceIndex).concat(SERVICE.slice(0, this._serviceIndex));
    const line = ordered.map((fn) => fn(game)).find(Boolean);
    this._serviceIndex = (this._serviceIndex + 1) % SERVICE.length;
    if (line) game.hud.toast(`91.45 — «${line}»`, 5);
  }

  play(call, game) {
    this.active = call.id;
    game.dialogue.play(game, call.lines, () => {
      this.heard.add(call.id);
      game.missions?.setFlag(`kkachi:${call.id}`);
      this.active = null;
      this._callLines = null;
      this.cooldown = 4;
      game.emit('kkachiCall', call.id);
    });
    // Dialogue filtra le righe e possiede quindi un array nuovo: il token da
    // confrontare per distinguere questa chiamata da un dialogo che la rimpiazza
    // è quello effettivamente montato nel lettore.
    this._callLines = game.dialogue.lines;
  }

  interrupt(game) {
    const id = this.active;
    if (id == null) return false;
    if (game.dialogue.lines === this._callLines) game.dialogue.cancel(game);
    this.missed.add(id);
    game.missions?.setFlag(`kkachi:persa:${id}`);
    this.active = null;
    this._callLines = null;
    this.cooldown = 4;
    game.hud?.toast('91.45 · chiamata interrotta', 2.4);
    game.emit('kkachiMissed', id);
    return true;
  }

  snapshot() {
    return { heard: [...this.heard], missed: [...this.missed], usedMetro: this.usedMetro };
  }

  restore(data) {
    const d = data || {};
    this.heard = new Set(d.heard || []);
    this.missed = new Set(d.missed || []);
    this.usedMetro = !!d.usedMetro;
    this.active = null;
    this._callLines = null;
    this.cooldown = 1;
    this.cleanDriveT = 0;
    this.fourSaves = false;
    this._inCar = false;
    this._metro = false;
    this._serviceIndex = 0;
    this.pendingService = null;
  }
}
