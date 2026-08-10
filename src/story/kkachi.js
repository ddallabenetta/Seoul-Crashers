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
  game.on('turfClaimed', (t, gangId, how, wasMine) => {
    if (!wasMine || gangId === PLAYER_GANG) return;
    // Solo quello che non ha visto: il cartello a terra lo dice già a chi c'era.
    if (dist(t.cx, t.cy, game.player.x, game.player.y) < LONTANO) return;
    k.mark('cortile', game, { place: t.place, hangul: t.hangul });
  });
}
