# Mappa unica della Corea

> §5.25 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.25 — Una mappa sola: Seoul, Busan e Jeju nello stesso spazio

Fino al §5.24 le tre città erano tre mondi che si escludevano a vicenda: si passava da una
all'altra ricostruendo tutto — scena, traffico, polizia, negozi, HUD — e il collegamento
interurbano era una voce di menu, non un posto. Adesso sono **tre porzioni dello stesso spazio
di coordinate**, disposte come stanno davvero.

```
 (0,0)                                              (16800, 0)
   ┌───────────────┬──────────────────────────────────┐
   │    SEOUL      │            강원 GANGWON           │
   │   7200×7200   │        (dorsale dei Taebaek)      │
   ├───────────────┴──────┐                            │
   │   충청 CHUNGCHEONG    │  ── 경부고속도로 ──────┐    │
   │      호남 HONAM       │                      │    │
   │                      └──────────┬───────────┘    │
   │  ~~~~~~~ mare del sud ~~~~~~~   │  BUSAN 6400×5600│
   │        ~~~~~~~~~~~~~~~~~~~~~~~~~└─────────────────┤
   │    ┌──────────┐   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ │
   │    │   JEJU   │  5400×5400 — isola                │
   │    └──────────┘                                   │
   └───────────────────────────────────────────────────┘
                                              (16800, 24000)
```

Origini: Seoul `(0, 0)`, Busan `(9600, 10400)`, Jeju `(3200, 17800)`. Le distanze sono
compresse — come tutto il resto del gioco, dove dodici pixel valgono un metro — ma i rapporti
reggono su una carta: Busan è a sud-est, Jeju è a sud-ovest di Busan e staccata dalla costa.

**Si arriva a Busan guidando.** L'autostrada Gyeongbu (경부고속도로) non è una scorciatoia fra
due menu: è fatta di tre rettilinei ortogonali con carreggiata disegnata, corsie e archi del
grafo come tutti gli altri, quindi ci passano il traffico civile, le volanti e chiunque
insegua qualcuno. Esce dal margine sud di Seoul, corre a quota `y = 9200` in aperta campagna e
rientra dal margine nord di Busan. Ha due aree di servizio (휴게소) su cui accostare, perché
settemila pixel senza niente da guardare sono un corridoio, non un viaggio.

**Jeju resta un'isola.** Non c'è nessun arco che la raggiunga: ci si arriva via mare dalle
banchine di Busan o in volo dagli scali. È l'unica delle tre a non essere collegata su gomma,
ed è una proprietà della geografia — non un divieto scritto da qualche parte.

#### Come sta insieme

Il pezzo nuovo è `world/korea.js`. I tre generatori restano intatti e continuano a lavorare in
coordinate locali; `korea.js` fa quattro cose.

**Trasla i dati, non i riferimenti.** Edifici, isolati, props, maglia, grafo, negozi,
territori, fermate: tutto viene spostato nello spazio di mondo. Restano invece **locali**
`piers`, `river`, `coastAt`, `waterX`/`quayX`, `w`/`h`: sono i campi che le closure geografiche
di ogni regione (`isWater`, `elevationAt`) leggono *per riferimento a ogni chiamata*, e
traslarli le romperebbe in silenzio. È l'unico modo di riusare quelle funzioni invece di
riscriverle: le funzioni composte convertono mondo → locale e delegano. Il grafo di oggetti è
pieno di alias — il cortile di un isolato è anche uno dei suoi `yards`, il territorio di una
banda è il cortile su cui è dipinto — quindi la traslazione passa da un `WeakSet`: spostare
due volte lo stesso rettangolo lo manderebbe altrove.

**Compone i campi geografici.** `isWater`, `elevationAt`, `urbanAt` e `districtAt` cercano
prima in quale dei tre rettangoli cade il punto e delegano; fuori rispondono la maschera delle
coste e il rilievo di campagna. Le curve delle coste sono scritte a mano e scelte perché
**combacino con il bordo delle città**: la costa occidentale riprende esattamente la battigia
di Seoul dove la mappa della capitale finisce, la baia di Jinhae prolunga verso ovest l'acqua
che Busan ha già sul proprio bordo, e il Han non si interrompe sul lato di un rettangolo — si
assottiglia fino a sparire fra le colline. Vale la regola del §3: *a valle nessuno sa niente di
forme, si legge solo il campo*.

**Fonde i grafi.** I tre grafi regionali vengono rinumerati e messi insieme, poi ci si
attaccano i nodi e gli archi dell'autostrada. `nearestNode` non scandisce più l'elenco: passa
da un indice spaziale, perché su un mondo lungo 24.000 px una scansione lineare comincia a
pesare.

**Dà un'identità alla campagna.** Tre distretti — 충청 Chungcheong (il corridoio), 호남 Honam
(le pianure a sud-ovest), 강원 Gangwon (la dorsale a est) — con l'`id` canonico `gyeonggi`,
perché è la chiave con cui mercati e statistiche indicizzano il mondo: quello che cambia è il
nome che il giocatore legge sul cartello.

#### Quello che è cambiato attorno

- **`main.js` non ricostruisce più niente al viaggio.** `travelTo` sposta il giocatore fra due
  fermate della stessa mappa: niente `regionCache`, niente `new Scene`, niente sistemi
  ricreati. Restano lo svuotamento del mondo attorno, la camera riagganciata e il
  ripopolamento dello streaming dove si arriva.
- **`ground.js` disegna l'acqua da `isWater` ovunque**, e il disegno editoriale del Han e della
  costa di Seoul (lungofiume, piana di marea, banchina) passa **sopra**, ritagliato sul
  rettangolo della capitale. La segnaletica non si ricava più da `l.on[j]`: quell'indice
  individuava una perpendicolare, e con tre maglie nello stesso array non individua più niente.
  I tratti da segnare (`l.marks`) si calcolano al momento della fusione, finché gli indici sono
  ancora quelli della regione.
- **La tinta di fondo di un tile si interpola sui quattro angoli.** Con la campagna attaccata al
  bordo di Seoul, il riempimento piatto col colore del distretto centrale produceva una riga
  dritta lunga tutta la mappa.
- **La carta non è più quadrata.** `MAP_W`/`MAP_H` conservano il rapporto della penisola;
  minimappa e mappa piena usano due scale separate.
- **La rete metro è una sola**, ordinata per area: prima le fermate della città in cui si è,
  poi le altre. Il servizio interurbano resta la via rapida, non più l'unica.
- **I salvataggi vecchi si migrano.** Uno slot scritto prima di questa tappa contiene coordinate
  *locali alla sua regione*: un salvataggio a Busan diceva `3000/2000`, che nel mondo nuovo è un
  cortile di Seoul. Il campo `world` distingue i due formati e le origini fanno il resto.
- **`DynamicGrid` svuota solo le celle toccate** invece di riallocare l'array. Finché il mondo
  era una città sola le celle erano un paio di migliaia e non si notava; qui sono decine di
  migliaia per griglia, e quella riallocazione sessanta volte al secondo da sola valeva più
  della metà del frame rate.

#### Verifica

Headless, con `probe.mjs`:

| Cosa | Risultato |
| --- | --- |
| Mondo | 16.800 × 24.000 px · 1962 edifici · 4847 props · 612 isolati · 30 fermate |
| Grafo | 779 nodi utili, 1207 archi |
| Raggiungibilità su gomma da Seoul | Seoul 306/306 · Busan 177/177 · **Jeju 0/294** · campagna 2/2 |
| Acqua | corridoio asciutto · autostrada asciutta · mare del sud, canale Busan–Jeju e Mar dell'Est bagnati |
| Autostrada | 10 veicoli in transito, tutti in movimento · **60 fps** |
| Viaggi metro Seoul → Busan → Jeju → Seoul | distretti corretti, nessun errore in console |
| Salvataggio, ricarica, slot vecchio di Busan | `3000/2000` → `12562/12400`, Seomyeon |

Il frame rate in container headless senza GPU sta fra 25 e 26 fps **anche sul ramo
precedente**: è il costo della composizione software, non della mappa. In campagna, dove il
disegno è leggero, si misurano 60 fps pieni.
