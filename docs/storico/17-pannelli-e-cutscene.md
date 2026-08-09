# Pannelli, pixel art e la cutscene iniziale

> §5.28 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).
> Il copione della scena sta in [`../storia/02-cutscene-iniziale.md`](../storia/02-cutscene-iniziale.md).

### 5.28 — La tappa A della campagna

La tappa A ([`storia/08-domande-aperte.md`](../storia/08-domande-aperte.md)) chiedeva le
primitive dei pannelli e la cutscene iniziale. L'impianto che le regge era già stato fatto nel
§5.27 — bus di eventi, tabella delle modalità, `ui/text.js` — quindi qui restava il contenuto.
In corso d'opera l'utente ha cambiato **due** cose rispetto al copione, e sono le due che
hanno determinato tutto il resto: **i dialoghi**, riscritti perché illeggibili, e **la resa dei
personaggi**, che da sagome è diventata pixel art.

---

## I dialoghi: la scena non era ellittica, era incomprensibile

La prima stesura era scritta da qualcuno che conosceva già la storia. A schermo, per chi non la
conosce, faceva così: si apre su una voce che conta numeri senza dire che è una radio; il
manifesto che annuncia la demolizione di mezza città è in hangul e nessuno lo traduce; il
funerale non dice mai di chi è; il tassista chiede «da quanto manca?», che in italiano non
vuol dire niente; la rivelazione finale è un indovinello in due frasi.

Adesso valgono **tre regole**, scritte in testa a `story/intro.js` e nel copione:

1. **Ogni fatto che serve a capire si dice una volta, in chiaro.** Chi è Jae-min (pannello 4),
   chi è il morto (11), cos'è 한성개발 (10), cosa c'è scritto sul manifesto (9).
2. **Il narratore traduce l'hangul che porta trama** — `철거예정`, `편의점`, il nome sulla
   lapide — e non quello decorativo. Continua a dire solo cose verificabili: ore, altezze,
   targhe, date.
3. **Gli indizi si rendono visibili, mai spiegati.** È la distinzione che teneva in piedi tutto
   il resto. La lancetta che si ferma fra due tacche e lo spessore della busta di 한성개발 sono
   *fatti che non si vedevano*, e il narratore adesso dice dove guardare; il presente di
   Chun-sik e il «di nuovo?» del commesso sono indizi che sembravano refusi, e una riga di nota
   li rende notabili senza risolverli. La cicatrice specchiata non ha una riga: ha un ritratto
   quattro volte più grande.

La rivelazione del pannello 26 ha guadagnato tre parole — «uno che ha letto il referto» — e con
quelle si capisce al primo passaggio invece che a M4.

## I personaggi: da sagome a pixel art

Il copione diceva «le facce non hanno tratti: si leggono dalla posa». Implementato, dava cinque
sagome nere identiche, e l'utente ha chiesto l'opposto: **soggetti visibili, personaggi
riconoscibili e carismatici, in sprite 2d**. Fra fumetto a inchiostro e pixel art ha scelto la
pixel art, che è anche il riferimento del progetto (*GTA: Chinatown Wars*).

`render/pixelkit.js` è nato da lì, e la divisione è netta:

- **L'identità sta nella testa**, ed è una griglia di caratteri 24×24 scritta a mano, che si
  legge nel sorgente come uno sprite vero. Non è vezzo: una faccia si riconosce da tre pixel
  messi bene — la stempiatura di Chun-sik, la visiera del tassista, la frangia del commesso —
  e quei tre pixel vanno *visti* mentre li si scrive.
- **Il corpo no.** Busto, braccia, gambe e sette pose sono parametrici, un rettangolo per
  pezzo: una posa in più costa quattro righe invece di una griglia nuova, e la stessa testa
  vale in piedi, seduta e di spalle.
- **Le espressioni sono sovrapposte, non ribattute.** La griglia porta il volto a riposo;
  occhi e bocca si riscrivono sopra, alle celle che il modello riserva loro. Quattro stati —
  fermo, parla, ride, occhi bassi — bastano a tutta la scena e costano una manciata di
  rettangoli invece di quattro griglie per personaggio.
- **La folla resta sagoma**, ed è il punto: è quello che fa leggere Jae-min come l'unico fermo.

Cinque teste disegnate: Jae-min, Chun-sik, il tassista, il commesso e Seo Dong-hyeok — che si
vede una volta sola, da morto, nel ritratto del funerale. **Dulchae non ce l'ha**, ed è di
trama: di lui c'è una mano.

Con i volti sono cambiate le **inquadrature**: dove un pannello ha una battuta, la camera si è
avvicinata a mezzo busto. Restano campi lunghi solo dove il soggetto è la città — l'oblò, Seoul
dall'alto, il vicolo, il titolo.

## Musica e tasto di salto

Nella prima stesura sotto i pannelli non suonava niente, «perché il silenzio è una scelta di
regia». Con il mondo fermo e nessun effetto, in pratica era una scheda muta. Adesso c'è
**`intro`**, il terzo pezzo di `core/music.js`: stesso impasto del tema del titolo — è lo
stesso gioco, e la cutscene parte proprio da lì — ma a metà del tempo e senza batteria, perché
sopra c'è da leggere. Un pad che entra lentissimo, un basso ogni quattro secondi, un battito
sordo al posto della cassa e una frase di cinque note a battute alterne. Il giro torna sempre
sulla tonica: sono ventotto pannelli in cui il protagonista non decide ancora niente.

Il livello lo alza **il pannello**, non il file della musica: basta dichiarare `music: 1.35` e
il tema sale. Lo usa solo l'ultima tavola, che è il titolo.

Il **salto** era già previsto (decisione 2) ma era `ESC` con un suggerimento che sfumava dopo
cinque secondi: una scorciatoia che si può usare sempre ma si vede per cinque secondi è una
scorciatoia che in pratica non c'è. Adesso la scritta **resta**, e il salto sfuma su nero per
sei decimi invece di tagliare — la differenza fra «ho saltato» e «si è rotto».

## I provini, e cosa hanno trovato

Tre scene nuove in `.claude/tools/scenes/`, e ognuna ha trovato qualcosa che nel sorgente non
si vedeva:

- **`cast-sheet.scene`** — tutto il cast ingrandito, quattro espressioni e sei pose a testa.
  Al primo giro metà personaggi erano **invisibili**: capelli quasi neri e contorno di
  inchiostro su fondo notturno fanno un buco, non una figura. Da lì il rim chiaro sempre
  acceso e i capelli mai neri. Ha anche trovato che Chun-sik, l'unico personaggio caldo del
  gioco, ringhiava: bocca aperta con i denti bianchi e nessun angolo all'insù.
- **`cutscene-sheet.scene`** — i ventotto pannelli in una griglia sola. Ha mostrato che i
  personaggi, centrati nella tavola, finivano **dietro al riquadro delle battute**. Da lì
  `bust()` in `story/intro.js`, che tiene in un posto solo l'unica misura che conta: dove
  finisce un mezzo busto in un pannello che parla.
- **`cutscene-run.scene`** — la scena fatta girare davvero, dal menu al gioco, e **asserisce**:
  diciannove voci fra modalità, musica, avanzamento, salto e passaggio di consegne. È quella
  che dice se funziona, non se si vede.

## Cosa resta alla tappa D

La riga di Kkachi del passaggio di consegne è ancora un `hud.toast`: la stazione `91.45` e la
tabella con predicato sono la tappa D, ed è l'unico punto dell'apertura che quella tappa dovrà
tornare a toccare. Stessa cosa per la **regia sonora** della scena — il fruscio di banda, la
voce che conta, il cane, la sirena lontana: la musica c'è, gli effetti no, e conviene farli
dove nasce il timbro del fruscio di Kkachi.
