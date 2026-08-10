# Cortili persistenti: un territorio che cambia padrone, e se lo ricorda

> §5.31 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.31 — La tappa C: la proprietà di un cortile, nel salvataggio e sul commercio

Dal §5.12 Seoul ha sedici territori di banda: un cortile, un piazzale o un capannone che
esistevano già, con un padrone, un tag dipinto a terra e un banco a cui si tratta. Dal §5.26 ci
si combatte pure una guerra ogni tanto. Ma **finiva lì**: sei morti sull'asfalto e il tag
restava del colore di prima. Il §6 lo elencava come debito con una frase sola — «un territorio
non cambia mai padrone» — e la campagna lo aveva già dato per scontato, perché M5
([`storia/04-atto-2.md`](../storia/04-atto-2.md)) chiede al giocatore di prendere tre cortili al
철마파 e di riportarli a chi li aveva prima.

È la tappa C ([`storia/08-domande-aperte.md`](../storia/08-domande-aperte.md), punto 7), e va
**prima** delle missioni che la usano: è l'unica cosa della campagna che cambia il mondo in modo
permanente, quindi tocca il salvataggio (§5.15) e i prezzi (§5.8), e M5 la deve trovare fatta.

Si prova come dice il §6.0: **si prende un cortile, si esce, si ricarica, è ancora tuo.**

---

## 1. Il padrone si scrive sul cortile (`entities/turfs.js`)

La scelta che spiega tutto il modulo. Chi legge `t.gang`, `t.color`, `t.hangul` e `t.trade` è
già mezza base di codice: il tag sull'asfalto (`render/ground.js`), i due rettangoli sulle carte
(`ui/hud.js`, `ui/mapview.js`), l'anello sotto i piedi dei suoi (`render/scene.js`), il listino
del banco (`entities/shops.js`), chi decide se prendersela con te (`entities/pedestrians.js`),
la guerra (`entities/life.js`). Tenere la proprietà in una tabella a parte avrebbe voluto dire
insegnare a tutti quei punti che esiste **una seconda verità** sul padrone di un cortile.

Quindi `claim()` riscrive i cinque campi che c'erano già, e il resto del gioco non si accorge di
niente: il tag cambia colore, il banco cambia mestiere, le carte cambiano tinta, i nuovi uomini
nascono della banda nuova (`pedestrians.spawnTurf` legge `t.gang`). **Cambiare padrone è
cambiare quei cinque campi**, e il modulo nuovo è 300 righe in croce.

Un campo però ce lo aggiunge, ed è quello che conta: **`t.held`**. Perché «del 백호파» non vuol
dire «tuo» — i due cortili che la Tigre Bianca ha dalla seed non rispondono a Jae-min, e che la
banda di suo padre non gli obbedisca ancora *è* la storia dell'Atto I. Regalargli una rendita al
primo minuto di partita l'avrebbe smentita prima di cominciare. Tuo è **quello che ti sei
preso**: `held` lo dice, e lo dice anche quando una guerra fra NPC porta un cortile al 백호파
senza che tu ci fossi (quello è della banda, e la banda non ti deve niente).

## 2. Tre modi di prenderlo, e uno di perderlo

Il copione di M5 ne elenca tre e non dice quale sia giusto. Due sono meccanica di città e
stanno qui; il terzo (portargli via il lavoro rubando le auto che stavano smontando) è
composizione di cose che esistono già e resta a M5.

- **A mani proprie.** Si sgombra il cortile e si **resta dentro** sei secondi, con una barra
  come quella del fermo (§5.16). Si prende stando dentro apposta: un cortile ripulito col fucile
  di precisione da un tetto sarebbe un cortile in cui non sei mai entrato, e il tag lo si
  dipinge da vicino. Basta uno dei loro ancora in piedi **dentro il recinto** perché la barra
  torni indietro; chi è scappato in strada ha già lasciato il posto. Costa piombo, salute e
  stelle, che è il prezzo della via veloce.
- **Comprandolo.** Una riga in cima al listino del loro banco: `il cortile · 마당`, ₩320.000
  piegati dal quartiere come ogni altro prezzo (§5.8). Nessuno muore, e ci si arriva solo come
  ci si arriva a un banco — **a mani vuote e senza stelle**, che dal §5.12 è la regola d'ingresso
  di un territorio. È anche il motivo per cui il banco dei 철마파 adesso si apre: il loro listino
  è vuoto (comprano mezzi col tasto `F` e basta) e senza questa riga sarebbero stati gli unici a
  non potersi comprare.
- **Perdendolo.** `life.updateWar` chiude la guerra assegnando il cortile a chi è rimasto in
  piedi. Vale in tutte e due le direzioni: una guerra vinta dagli incursori sposta il tag anche
  quando il giocatore non c'entra niente, e se il cortile era tuo e non eri lì a difenderlo, la
  sera lo trovi di un'altra banda. Sono cinque righe in `updateWar` e sono la ragione per cui la
  guerra fra bande del §5.26 adesso **vuol dire qualcosa**.

## 3. L'effetto sul commercio

Era la richiesta esplicita della decisione 7, e sono due cose.

**Il banco segue il padrone.** `gangMarket` piega il listino del quartiere sul mestiere della
banda (§5.8), e il mestiere adesso è quello di chi comanda: prendersi il cortile del 황소파
vuol dire trasformare un ricettatore in un'armeria a prezzo di casa — e **perdere il
ricettatore**. È uno scambio, non un premio: chi si prende i 철마파 non ha più dove rivendere
le auto a 1,42, chi si prende gli 흑사파 non ha più dove comprare esplosivi e cure.

**E il cortile mette da parte una busta.** ₩2.000 per ora di gioco (un'ora di gioco è un minuto
vero), piegati dal quartiere, con un tetto a ₩40.000 — la stessa taglia della cassa di un
negozio, ma senza stelle addosso. Si riscuote con **`F`** stando dentro — `F` è già il tasto
dei soldi, e `E` nel proprio recinto è occupato dal banco della banda: con la busta lì sopra,
prendersi un cortile avrebbe voluto dire non poterci più comprare niente. Due dettagli sono scelte,
non dettagli: cresce **sull'orologio** e non sui secondi veri, quindi dormire in un futon fino a
domani vale una giornata di cortile (il letto sposta le lancette, §5.8); e ha un tetto, o
sparire per una settimana pagherebbe più che passare tutti i giorni.

## 4. Nel salvataggio ci va la differenza

Ogni cortile si ricorda il padrone di nascita (`gang0`) e ha una chiave stabile — le coordinate
del suo centro, non l'indice in `city.turfs`, che è la somma di tre città (`world/korea.js`).
Nello slot finiscono solo le righe in cui la partita si è discostata dalla seed: **92 byte** in
una partita con un cortile preso e una busta da riscuotere, zero in una partita che non ne ha
mai toccato uno. È la stessa regola del §5.15 — si scrive quello che il giocatore ha cambiato,
non quello che Seoul sa rifare da sola — ed è il primo pezzo di **città** che entra in un
salvataggio: fino a qui c'era solo roba del giocatore.

Formato **v4**, con lo scalino `3 → 4` che aggiunge una tabella vuota. Uno slot di prima è una
partita in cui nessuno aveva mai cambiato un cortile, che è esattamente quello che una tabella
vuota dice: nessuno perde niente (§5.27).

## 5. Cosa si vede

- Il **tag a terra** cambia colore appena il cortile passa di mano. Il terreno è disegnato in
  tile messi in cache, quindi `claim` butta i tile che il cortile tocca — non tutta la cache:
  `ground.invalidateRect` esiste per questo.
- Sulla **minimappa e sulla carta** un cortile tuo è pieno invece che tratteggiato, e sulla
  carta piena porta scritto `백호파 · tuo`. Da lì in poi le due carte non servono più a evitare
  i cortili ma a passare a riscuotere.
- Entrando nel proprio cortile il cartello dice `è tuo` invece del mestiere, e **la guardia non
  ti punta addosso niente**: nel cortile tuo si entra come si vuole, con la mazza in mano o con
  le stelle addosso. Una banda che punta la pistola al proprio capo è il primo modo in cui una
  conquista si trasformerebbe in una punizione.
- Cosa vuol dire averne uno si dice **una volta sola**, alla prima presa (§7: il gioco non
  spiega due volte).

## 6. Cosa lascia in mano a chi scrive M5

`game.turfs.claim(turf, gang, game, how)` e l'evento `turfClaimed` sul bus (§5.27). `how` dice
in che modo (`force`, `deal`, `war`), e M5 — che di cortili ne conta tre e non le importa quale
strada hai preso — si iscrive all'evento e conta. La terza strada del copione, rubare le tre
auto e rivenderle finché il 철마파 se ne va da solo, è una fase di missione che finisce con una
`claim`: il motore non ha bisogno di saperla.

`story/places.findTurf` ha un ripiego nuovo: se nessun cortile è più di quella banda perché il
giocatore se li è presi, si ripiega sul **padrone di nascita**. Una missione che cerca «il
cortile del 철마파» non deve restare senza obiettivo per una conquista fatta il giorno prima.

## 7. La prova

`.claude/tools/scenes/cortili.scene` non misura, **asserisce** — venti voci, e `[]` vuol dire
tutto a posto: la barra che sale, il tag che cambia colore, il banco che cambia listino, la
busta che cresce sull'orologio e si ferma al tetto, il round-trip del salvataggio, uno slot v3
che si migra invece di essere buttato, l'acquisto che paga davvero e la guerra persa che
riporta indietro il cortile. Tre non si interpretano: `restaTuoDopoRicarica` (è la prova della
tappa scritta nel §6.0), `nuovaPartitaRimetteLaSeed` e `bustaHaUnTetto`.
