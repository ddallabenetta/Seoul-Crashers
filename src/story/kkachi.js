// 까치 — quello che dice, e quando.
//
// Il copione sta in `docs/storia/07-radio-kkachi.md` e comanda lui: le battute
// qui sotto sono le sue, parola per parola. Il motore che le fa uscire è
// `core/kkachi.js` e non conosce nessuna di queste righe, come
// `core/missions.js` non conosce nessuna missione (§3).
//
// **Ogni battuta delle ventiquattro è copiata da qualcosa che dice qualcun
// altro**, e la colonna «origine» del copione esiste per tenere l'onestà: se una
// riga non ha un'origine, va riscritta. È il meccanismo con cui il settimo colpo
// di scena si dimostra da solo, quindi i commenti `// origine:` qui sotto non
// sono decorazione — sono la prova, e vanno tenuti aggiornati.
//
// **Le righe di servizio non hanno un'origine, e va bene**: sono quelle in cui
// Kkachi fa *la radio* e non il personaggio. Il patto con il giocatore è un
// altro, ed è più severo: le sente cento volte, quindi ognuna dice **un fatto**
// e nessuna commenta lui. «Frena prima» è un fatto; «guidi male» no.
//
// Delle otto chiamate dell'Atto I, **la ottava aspetta M3** (tappa E): il suo
// predicato è già quello definitivo e resta falso finché quella missione non
// esiste. Non è un pezzo mancante, è una riga che non si è ancora avverata.
import { PLAYER_GANG } from '../entities/turfs.js';
import { HERO_OUTFITS } from '../render/sprites.js';
import { findTurf } from './places.js';
import { airborne } from '../entities/vehicle.js';
import { dist } from '../core/math.js';

/**
 * Quanto costa un pieno, in won. Non esiste un serbatoio in questo gioco: è il
 * metro di paragone di una riga sola (S11), e serve a dire «sei a corto» con un
 * numero che vuol dire qualcosa invece che con una soglia inventata.
 */
const PIENO = 60000;
// Quanto lontano deve essere successo perché valga la pena raccontarlo: un
// cortile perso sotto gli occhi l'ha già visto, e il cartello glielo dice.
const LONTANO = 1200;

const ORE = [null, 'l\'una', 'le due', 'le tre', 'le quattro', 'le cinque', 'le sei',
  'le sette', 'le otto', 'le nove', 'le dieci', 'le undici'];

/**
 * L'ora come la direbbe una radio. Il copione scrive «Le sei e dieci», che è
 * giusto alle 06:10 e falso alle 07:40: una riga di servizio deve dire **un
 * fatto**, quindi l'ora è quella vera e il resto della battuta no.
 */
function oraDetta(dc) {
  const h = Math.floor(dc.hour);
  const m = dc.minutes;
  const nome = h === 0 ? 'mezzanotte' : h === 12 ? 'mezzogiorno' : ORE[h % 12];
  const min = m === 0 ? '' : m === 15 ? ' e un quarto' : m === 30 ? ' e mezza' : ` e ${m}`;
  const s = nome + min;
  return s[0].toUpperCase() + s.slice(1);
}

/** In quale delle tre città. Gli id dei distretti si ripetono, le città no (§5.25). */
function distretto(game, id) {
  return game.player.district?.id === id && game.areaAt(game.player.x, game.player.y)?.id === 'seoul';
}

/**
 * Sul ponte del 한강. Il fiume disegnato è solo quello di Seoul (`korea.river`),
 * e le sue campate sono le uniche che valgono: il ponte di Gwangalli è a Busan e
 * questa chiamata è dell'Atto I.
 */
function sulPonte(game) {
  const r = game.city.river;
  if (!r || !r.bridges?.length) return false;
  const { x, y } = game.player;
  if (y < r.y0 - 10 || y > r.y1 + 10) return false;
  return r.bridges.some((b) => Math.abs(x - b.x) < b.w / 2 + 6);
}

/** Il cortile di una banda a portata di sguardo: un raggio, non un'inquadratura. */
function davantiAlCortile(game, gangId, raggio = 520) {
  const y = findTurf(game, gangId, game.player);
  return !!y && dist(game.player.x, game.player.y, y.x, y.y) < raggio;
}

/** Una volante ferma nei paraggi: quelle di quartiere e quelle della caccia. */
function volanteFerma(game) {
  const pl = game.player;
  for (const v of game.vehicles) {
    if (v.kind !== 'police' || v.dead || v.driver === 'player') continue;
    if (Math.abs(v.speed) > 14) continue;
    if (dist(v.x, v.y, pl.x, pl.y) < 900) return true;
  }
  return false;
}

/**
 * In campagna: l'area che non è né Seoul né Busan né Jeju (`areaAt` torna `null`), oppure il
 * distretto di 경기도 dentro Seoul. A bordo di un mezzo di terra — chi naviga o vola ha la sua
 * chiamata (la 10) — perché «prima volta in campagna» è una cosa che si fa guidando.
 */
function inCampagna(game) {
  const pl = game.player;
  const v = pl.vehicle;
  if (!v || pl.onFoot || airborne(v)) return false;
  const area = game.areaAt(pl.x, pl.y);
  return !area || (area.id === 'seoul' && pl.district?.id === 'gyeonggi');
}

/** Un ingresso della metro di Seoul a portata di sguardo, mentre si guida. */
function vicinoAllaMetro(game, raggio = 380) {
  const pl = game.player;
  if (!pl.vehicle || pl.onFoot) return false;
  for (const s of game.city.transitStations || []) {
    if (s.region && s.region !== 'seoul') continue;
    const e = game.metro.entranceOf(s);
    if (dist(pl.x, pl.y, e.x, e.y) < raggio) return true;
  }
  return false;
}

/**
 * Il 장례식장 di Hongdae. Il gioco non ha un edificio che si chiami così, e i funerali coreani si
 * tengono **nelle sale annesse agli ospedali**: è quello del distretto, e qui si cerca una volta
 * sola. Torna `null` se Seoul non ne ha uno.
 */
let _funerale;
function funerale(game) {
  if (_funerale === undefined || _funerale?.city !== game.city) {
    const h = (game.city.hospitals || []).find((q) => q.district === 'hongdae' && game.areaAt(q.x, q.y)?.id === 'seoul');
    _funerale = h ? { x: h.x, y: h.y, city: game.city } : { city: game.city, none: true };
  }
  return _funerale.none ? null : _funerale;
}

/**
 * Da quanto si guida dopo mezzanotte senza stelle. **Non è un timer a parte**: `Kkachi.pickCall`
 * guarda i predicati solo mentre si guida e senza stelle, quindi vale la regola «si valuta
 * ogni mezzo secondo quando può parlare». Un buco più lungo di `BUCO` secondi fra due
 * valutazioni (sceso dall'auto, un'inseguita, un menu lungo) azzera il conto.
 */
const BUCO = 20;
const DIECI_MINUTI = 600;
let calmo = { da: null, ultimo: 0 };

// --- le otto chiamate dell'Atto I -------------------------------------------------
//
// L'ordine di questa tabella *è* la priorità: se due predicati sono veri nello
// stesso istante parla il primo, e l'altro aspetta il prossimo giro. Sono messe
// in modo che la più rara stia sopra la più facile.

export const CHIAMATE = [
  {
    // origine: il narratore, pannello 4 della cutscene iniziale.
    id: 'a1-ponte',
    when: (game) => sulPonte(game),
    lines: [
      { kkachi: true, text: '«Tre ponti per ventitré milioni di persone. Quando ne chiudono uno, per due giorni la città è un\'altra città.»' },
      { who: 'Jae-min', text: '«E chi li chiude?»' },
      { kkachi: true, text: '«Quelli che hanno bisogno che tu passi da dove dicono loro.»' },
    ],
  },
  {
    // origine: nessuna — **è la prima invenzione**, e il giocatore può
    // verificarla: quella statistica non l'ha mai tenuta nessuno.
    id: 'a1-pioggia',
    when: (game) => game.dayCycle.rain > 0.2,
    lines: [
      { kkachi: true, text: '«Con l\'acqua la gente compra di più e ruba di meno. È l\'unica statistica del quartiere che non ha mai sbagliato.»' },
      { who: 'Jae-min', text: '«Chi la teneva?»' },
      { kkachi: true, text: '«Uno che stava sempre alla finestra.»' },
    ],
  },
  {
    // origine: Chun-sik, M1.
    id: 'a1-armeria',
    when: (game, k) => k.since('armeria', game) < 300,
    lines: [
      { kkachi: true, text: '«Non ti serve. Ti serve che si veda che ce l\'hai. Sono due mestieri diversi e li paghi allo stesso prezzo.»' },
    ],
  },
  {
    // origine: Ryu, M12 — **detta prima**. Il conto delle morti è `stats.deaths`,
    // lo stesso che leggerà M12: averne due sarebbe averne uno sbagliato.
    id: 'a1-ospedale',
    when: (game, k) => game.stats.deaths >= 3 && k.since('ospedale', game) < 600,
    lines: [
      { kkachi: true, text: '«Ti hanno rimesso insieme in fretta. Ci sono posti dove non ti rimettono insieme per niente.»' },
      { who: 'Jae-min', text: '«Chi paga?»' },
      { kkachi: true, text: '«Chi ha bisogno che tu cammini.»' },
    ],
  },
  {
    // origine: Chun-sik, pannello 17. **Il bomber conta**: `outfit` 0 è il nero
    // del 백호파 (`render/sprites.js`), quello che Jae-min si è trovato addosso
    // in M1, e chi si è cambiato al 옷가게 non si sente dire di non metterlo.
    id: 'a1-gangnam',
    when: (game) => game.player.outfit === 0 && distretto(game, 'gangnam'),
    lines: [
      { kkachi: true, text: '«Non metterlo qui.»' },
      { who: 'Jae-min', text: '«Me l\'hanno già detto.»' },
      { kkachi: true, text: '«Allora ero io.»' },
    ],
  },
  {
    // origine: nessuna. È la battuta che dice chi è Jae-min in quattro righe.
    id: 'a1-nottefonda',
    when: (game) => game.dayCycle.hour >= 3 && game.dayCycle.hour < 4.8,
    lines: [
      { kkachi: true, text: '«A quest\'ora in strada ci sono tre categorie: chi torna, chi non è mai andato a casa e chi lavora. Tu di quale sei?»' },
      { who: 'Jae-min', text: '«Della quarta.»' },
      { kkachi: true, text: '«Non esiste una quarta.»' },
      { who: 'Jae-min', text: '«Appunto.»' },
    ],
  },
  {
    // origine: il referto di M4, `171 cm` — **rovesciata**. È il secondo indizio
    // dei due Jae-min, e arriva molto prima che il referto si possa leggere.
    id: 'a1-furto',
    when: (game, k) => k.since('furtoVisto', game) < 45,
    lines: [
      { kkachi: true, text: '«Adesso quella signora racconterà di un uomo alto un metro e ottantatré.»' },
      { who: 'Jae-min', text: '«Sono un metro e settantotto.»' },
      { kkachi: true, text: '«Sì. Ma è l\'altezza che dicono sempre.»' },
    ],
  },
  {
    // origine: nessuna. **Aspetta M3** (tappa E): fino ad allora il predicato è
    // falso, e questa riga non esiste per nessuno.
    id: 'a1-itaewon',
    when: (game) => game.missions.isDone('m3') && distretto(game, 'itaewon'),
    lines: [
      { kkachi: true, text: '«I martedì e i venerdì. Dodici anni. Se moltiplichi, fa una cifra che in una busta non ci sta.»' },
      { who: 'Jae-min', text: '«E dove va a finire?»' },
      { kkachi: true, text: '«Nelle perizie. Le paga qualcuno, e quel qualcuno siete voi.»' },
    ],
  },

  // === Le chiamate dell'Atto II legate a M5 e M6 ===============================
  //
  // Delle otto dell'Atto II **tre** stanno qui perché il copione le lega a un momento
  // preciso di queste due missioni; le altre cinque (campagna, primo volo, metro, la
  // mezzanotte senza stelle, il 장례식장) sono della seconda metà della tappa F. Come le
  // altre, ognuna è copiata da qualcosa che qualcun altro dice. L'ordine è la
  // priorità: la riga del 1992, che vale un quarto d'ora, sopra la geografica, e questa
  // sopra quella che dipende da un abito.
  {
    // origine: nessuna. Il copione la dà come «—»: è la riga in cui Kkachi, domandato
    // su una parola che ha appena letto in un faldone, risponde con la stessa due volte.
    // Vale **dopo aver letto la pagina del 1992** (M6, `kkachi.mark('riga1992')`) e dura
    // un quarto d'ora di gioco: oltre, la domanda non ha più niente a cui appoggiarsi.
    id: 'a2-riga',
    when: (game, k) => k.since('riga1992', game) < 900,
    lines: [
      { who: 'Jae-min', text: '«Cos\'è un\'acquisizione?»' },
      { kkachi: true, text: '«Una voce di bilancio.»' },
      { who: 'Jae-min', text: '«E un bambino?»' },
      { kkachi: true, text: '«Una voce di bilancio.»' },
    ],
  },
  {
    // origine: Kkachi, M6 (pannello 8: «So quello che è stato detto ad alta voce») —
    // **anticipata**: il giocatore la sente passando davanti a Pyo, e la riga di M6 che
    // la spiega arriva dopo. Aspetta M5, perché «un altro nome» è quello che Pyo ha
    // detto e ha corretto.
    id: 'a2-pyo',
    when: (game) => game.missions.isDone('m5') && davantiAlCortile(game, 'hwangso'),
    lines: [
      { kkachi: true, text: '«Il vecchio Pyo ti ha chiamato con un altro nome.»' },
      { who: 'Jae-min', text: '«Come lo sai?»' },
      { kkachi: true, text: '«Perché l\'ha detto ad alta voce.»' },
    ],
  },
  {
    // origine: Ha-eun, M3 («Bel giubbotto. Le sta grande.»). Aspetta M3 per la stessa
    // ragione per cui `a1-itaewon` aspetta la sua: la copia non esiste prima dell'originale.
    // Il predicato è l'**abito addosso**, non l'acquisto: `HERO_OUTFITS` ha cinque giacche
    // e quella che conta è `suit`.
    id: 'a2-completo',
    when: (game) => game.missions.isDone('m3') && HERO_OUTFITS[game.player.outfit]?.id === 'suit',
    lines: [
      { kkachi: true, text: '«Ti sta male.»' },
      { who: 'Jae-min', text: '«È della mia taglia.»' },
      { kkachi: true, text: '«Non ho detto che è piccolo. Ho detto che ti sta male.»' },
    ],
  },

  // === Le altre cinque dell'Atto II (T8, §5.42) ================================
  //
  // Con queste le otto sono tutte: la 9, la 10, la 13, la 15 e la 16. Tre aspettano
  // l'originale (M7 e il copione dell'apertura), due non l'hanno e parlano quando il mondo lo
  // dice. L'ordine è la priorità, e le più rare stanno sopra.
  {
    // origine: **Byeon, M7** (la cella, dalla parte della sua rabbia: «Qui si demolisce senza
    // gru…»). Il copione la dà a Ryu in M6, ma Ryu non la dice in nessuna delle sue righe: la
    // riga è stata messa dove un capocantiere si rifiuta di parlare, perché la regola 3 vuole
    // che l'originale **esista**, non che stia dove il copione l'aveva immaginato.
    id: 'a2-campagna',
    when: (game) => game.missions.isDone('m7') && inCampagna(game),
    lines: [
      { kkachi: true, text: '«Qui si demolisce senza gru. Basta smettere di riparare le strade e aspettare sei anni.»' },
    ],
  },
  {
    // origine: nessuna. **La risposta è vuota**: è la prima volta che Kkachi non ne ha una, e si
    // sente perché la ripete con le stesse parole — «quelli che guardano da lassù» è la
    // domanda scritta al contrario. Nell'Atto II, e non prima: chi vola con la storia ancora
    // ferma al primo atto la sente comunque, perché volare si può dal primo minuto.
    id: 'a2-volo',
    when: (game) => game.missions.isDone('r1') && !!game.player.vehicle && airborne(game.player.vehicle),
    lines: [
      { kkachi: true, text: '«Da lassù non si vede chi deve cosa a chi. È per questo che a loro piace guardare da lassù.»' },
      { who: 'Jae-min', text: '«Chi, loro?»' },
      { kkachi: true, text: '«…Quelli che guardano da lassù.»' },
    ],
  },
  {
    // origine: Kkachi, M7 («Là dentro non c'è una macchina accesa. Io sto dove c'è una radio
    // accesa»). **Dice la stessa cosa dall'altra parte**: sotto non ci sarà nessuno a
    // sentirlo. Si sente avvicinandosi a una scala, **prima** di scendere (a piedi non parla),
    // e la seconda metà — sette secondi dopo, in banchina, **nessuna risposta** — non è una
    // riga di radio ma un toast di Jae-min (`attachKkachi`, `metroDwell`).
    id: 'a2-metro',
    when: (game) => game.missions.isDone('m7') && !(game.stats.metro > 0) && vicinoAllaMetro(game),
    lines: [
      { kkachi: true, text: '«Sotto non ti sento. È l\'unico posto della città dove sei solo.»' },
    ],
  },
  {
    // origine: Jo, M2 — **il silenzio come risposta**: in M2 Jo non risponde alla domanda e
    // basta, e qui Kkachi chiude con la stessa mancanza. Il predicato è l'unico stateful della
    // tabella: dieci minuti di gioco fra mezzanotte e le cinque, guidando e **senza stelle** —
    // quando ne ha una `Kkachi` tace (regola 4) e il conto si perde da solo.
    id: 'a2-mezzanotte',
    when: (game) => {
      const h = game.dayCycle.hour;
      const ora = game.time;
      if (calmo.da === null || ora - calmo.ultimo > BUCO || h >= 5) calmo.da = h < 5 ? ora : null;
      calmo.ultimo = ora;
      return game.missions.isDone('m2') && h < 5 && calmo.da !== null && ora - calmo.da >= DIECI_MINUTI;
    },
    lines: [
      { kkachi: true, text: '«Adesso non ti cerca nessuno. Goditelo, dura poco e non torna.»' },
      { who: 'Jae-min', text: '…' },
      { kkachi: true, text: '«Bravo.»' },
    ],
  },
  {
    // origine: il narratore, pannello 12 della cutscene («Buste di condoglianze. Sono tre. La più
    // spessa è di 한성개발»). Il copione la dà a Chun-sik in R1, che quelle buste non nomina mai:
    // l'originale vero è quel pannello, e dice la stessa cosa. Il 장례식장 di Hongdae è la sala
    // dell'ospedale del distretto — il gioco non ha un edificio con quel nome, e i funerali
    // coreani si fanno lì.
    id: 'a2-funerale',
    when: (game) => {
      if (!game.missions.isDone('r1')) return false;
      const f = funerale(game);
      const pl = game.player;
      return !!f && !!pl.vehicle && !pl.onFoot && dist(pl.x, pl.y, f.x, f.y) < 260;
    },
    lines: [
      { kkachi: true, text: '«Le buste bianche si contano il giorno dopo. Chi ha messo di più, di solito, è chi ha più da farsi perdonare.»' },
    ],
  },
];

// --- le righe di servizio ------------------------------------------------------------
//
// Prima le quattro che non dipendono da una salita in macchina (`boarding`
// assente): sono le più rare e le più informative, e messe in fondo non le
// sentirebbe mai nessuno — a qualunque ora del giorno una delle dodici di salita
// è vera, e vincerebbe sempre lei.
//
// Poi le dodici del copione, **e non nell'ordine in cui sono scritte lì**: quella
// tabella è un elenco, questa è una priorità. Le situazionali stanno sopra le
// meteorologiche e le meteorologiche sopra l'orologio, perché l'orologio è vero
// sempre e le altre quasi mai.

export const SERVIZIO = [
  {
    id: 'cella',
    when: (game, k) => k.since('cella', game) < 600,
    rest: 3600,
    line: 'Sei ore. Ti hanno preso l\'arsenale e un quinto dei contanti. Il quartiere l\'ha saputo prima di te.',
  },
  {
    // Il debito che i cortili avevano lasciato aperto (§5.31): una guerra ti
    // porta via un territorio e lo scopri tornando. Adesso te lo dice lui, e solo
    // se non c'eri — quello che è successo sotto i tuoi occhi l'hai già visto.
    id: 'cortile',
    when: (game, k) => k.since('cortile', game) < 900,
    rest: 600,
    line: (game, k) => {
      const p = k.value('cortile');
      return p ? `Al ${p.place} hanno rifatto il muro. Adesso il tag è del ${p.hangul}.` : null;
    },
  },
  {
    // §5.14: la radio è l'unica cosa che parla con la rete. Le battute di Kkachi
    // no, ma il pretesto è comodo e il copione dice di usarlo.
    id: 'rete',
    when: (game) => game.radio.discovered && !game.radio.stations.some((s) => !s.kkachi),
    rest: 1800,
    line: 'Stanotte la città è muta. Torna domani.',
  },
  {
    id: 'fermo',
    when: (game, k) => k.idleT > 120,
    rest: 240,
    line: 'Se ti sei addormentato, va bene. Se stai pensando, dimmelo che sto zitto.',
  },

  {
    id: 's10-rubata',
    boarding: true,
    when: (game, k) => k.since('furto', game) < 30,
    line: 'Il proprietario sta già telefonando. Gli servono nove minuti per farsi credere.',
  },
  {
    id: 's9-malandata',
    boarding: true,
    when: (game) => {
      const v = game.player.vehicle;
      return !!v && (v.flatTires || v.hp < v.maxHp * 0.5);
    },
    line: 'Questa macchina fa un rumore che due giorni fa non faceva. Non è un problema finché non ti fermi.',
  },
  {
    id: 's8-volante',
    boarding: true,
    when: (game) => volanteFerma(game),
    line: 'C\'è una volante ferma due strade più in là. Da venti minuti.',
  },
  {
    id: 's12-distretto',
    boarding: true,
    when: (game, k) => k.since('distrettoNuovo', game) < 90,
    line: 'Qui non ci sei mai stato. Si capisce da come guardi i numeri civici.',
  },
  {
    id: 's11-contanti',
    boarding: true,
    when: (game) => game.player.money < PIENO,
    line: 'Hai in tasca meno di quanto costa un pieno. Non è un giudizio, è un\'informazione.',
  },
  {
    id: 's7-temporale',
    boarding: true,
    when: (game) => game.dayCycle.rain > 0.85,
    line: 'Con questo tempo le volanti stanno sotto i cavalcavia. Tu sai dove sono, loro sanno dove sei.',
  },
  {
    id: 's6-pioggia',
    boarding: true,
    when: (game) => game.dayCycle.rain > 0.2,
    line: 'Piove da tre ore. Frena prima.',
  },
  {
    id: 's1-mattina',
    boarding: true,
    when: (game) => game.dayCycle.hour >= 5 && game.dayCycle.hour < 8,
    line: (game) => `${oraDetta(game.dayCycle)}. Il traffico va da sud: a quest\'ora chi entra a Seoul ci viene a lavorare.`,
  },
  {
    id: 's2-punta',
    boarding: true,
    when: (game) => {
      const h = game.dayCycle.hour;
      return (h >= 8 && h < 9.5) || (h >= 18 && h < 19.5);
    },
    line: 'Adesso non si guida, si sta in fila. Se prendi i vicoli fai prima e sbagli lo stesso.',
  },
  {
    id: 's5-notte',
    boarding: true,
    when: (game) => game.dayCycle.hour >= 2 && game.dayCycle.hour < 5,
    line: 'Tre auto in tutta la strada, e due sono ferme.',
  },
  {
    id: 's4-insegne',
    boarding: true,
    when: (game) => game.dayCycle.hour >= 18.5 && game.dayCycle.hour < 24,
    line: 'Le insegne si accendono a scaglioni: prima i 편의점, poi i 술집, per ultimo chi è indietro con la corrente.',
  },
  {
    id: 's3-pomeriggio',
    boarding: true,
    when: (game) => {
      const h = game.dayCycle.hour;
      return h >= 12 && h < 18 && game.dayCycle.rain < 0.05 && game.dayCycle.weather.cloud < 0.3;
    },
    line: 'Bella giornata. Si vede tutto il quartiere, e tutto il quartiere vede te.',
  },
];

/**
 * I fatti del mondo che i predicati leggono. Passano tutti dal bus (§5.27), e
 * questo è l'unico posto in cui la tabella di Kkachi tocca il resto del gioco:
 * nessun sistema sa che esiste una radio che lo guarda.
 */
export function attachKkachi(game) {
  const k = game.kkachi;
  k.register(CHIAMATE);
  k.registerService(SERVIZIO);

  game.on('respawn', () => k.mark('ospedale', game));
  game.on('busted', () => k.mark('cella', game));
  game.on('enterVehicle', (v, witness) => {
    if (!v.occupiedTheft) return;
    k.mark('furto', game);
    if (witness) k.mark('furtoVisto', game);
  });
  game.on('shopBuy', (item, floor) => {
    if (floor?.biz?.id === 'guns') k.mark('armeria', game);
  });
  game.on('districtChange', (d, isNew) => {
    if (isNew) k.mark('distrettoNuovo', game);
  });
  // **La seconda metà della chiamata 13**: sette secondi in banchina, e nessuna risposta. Non è una
  // riga di radio — sotto terra la radio non c'è, ed è tutto il punto — ma una domanda a vuoto. Si
  // dice una volta sola, e si segna fra le chiamate (non conta per il finale: `heard` non cambia).
  game.on('metroDwell', () => {
    if (!k.done.has('a2-metro') || k.done.has('a2-metro-vuoto')) return;
    k.done.add('a2-metro-vuoto');
    game.hud.toast('Jae-min: «…Kkachi?» — nessuna risposta', 4.6);
  });
  calmo = { da: null, ultimo: 0 };
  _funerale = undefined;
  game.on('turfClaimed', (t, gangId, how, wasMine) => {
    if (!wasMine || gangId === PLAYER_GANG) return;
    // Solo quello che non ha visto: il cartello a terra lo dice già a chi c'era.
    if (dist(t.cx, t.cy, game.player.x, game.player.y) < LONTANO) return;
    k.mark('cortile', game, { place: t.place, hangul: t.hangul });
  });
}
