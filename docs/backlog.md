# Backlog

> §6 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../HANDOFF.md).

## 6.0 — MASSIMA PRIORITÀ: le tappe della campagna

**Questo elenco viene prima di tutto il resto di questo file.** L'impianto è pronto (§5.27: bus
di eventi, tabella delle modalità, migrazioni del salvataggio, personaggi nominati, porte
sigillate, marcatori, testo su più righe). Quello che resta è **contenuto**, in quest'ordine e
**una consegna per volta**. Le decisioni d'impianto stanno in
[`storia/08-domande-aperte.md`](storia/08-domande-aperte.md) e non vanno ricavate dal copione.

| # | Tappa | Cosa contiene | Si prova così |
| --- | --- | --- | --- |
| ~~1~~ | ~~**A**~~ | ~~primitive dei pannelli + la cutscene iniziale~~ — **fatta**, §5.28 | — |
| ~~2~~ | ~~**B**~~ | ~~impianto missioni + M1 e M2~~, e con loro **il filo del 병원** — **fatta**, §5.29 | — |
| ~~3~~ | ~~**C**~~ | ~~**cortili persistenti** (nel salvataggio, con effetto sul commercio)~~ — **fatta**, §5.31 | — |
| ~~4~~ | ~~**D**~~ | ~~Kkachi: stazione `91.45`, tabella con predicato, le otto chiamate dell'Atto I e le dodici righe di servizio~~ — **fatta**, §5.32 | — |
| 5 | **E** | Atto I completo (M3, M4) + R1 | il primo ribaltamento in mano al giocatore |
| 6 | **F** | Atto II (M5-M8) + R2, R3 + le otto chiamate dell'Atto II | l'atto che chiede più cose nuove al motore |
| 7 | **G** | Atto III (M9-M12) + R4 + le otto chiamate dell'Atto III **e l'incontro facoltativo di Busan** | il viaggio: ha bisogno di tutto quello di prima |
| 8 | **H** | i tre finali, i titoli di coda, la scena dopo | e a quel punto la Fase 3 è chiusa |

**Il filo del 병원 è fatto** ([`storia/09-ospedale.md`](storia/09-ospedale.md), §5.29): è stato
agganciato alla B come previsto, e da adesso si accumula. Il conto delle morti **non è un
contatore nuovo** — è `stats.deaths`, che il salvataggio porta dal §5.15 — e M12 dovrà leggere
quello e nient'altro. La scena dopo M12 è scritta e cablata: aspetta solo che qualcuno alzi il
flag `m12` (`game.missions.setFlag('m12')`).

**Cosa la tappa B (§5.29) ha già tolto di mezzo**, e che quindi nessuna delle tappe che restano
deve più affrontare: le **fasi** di una missione e la loro ripresa dopo una morte o un arresto,
il **blip** che si sposta invece di accumularsi, i **punti interattivi** in strada e su un piano
(`ctx.point`, che finisce da solo nei suggerimenti dell'HUD), il **dialogo in scena** con il
mondo fermo e la città a schermo (`ui/dialogue.js`), l'**avanzamento nel salvataggio** con i
pannelli già visti che non si rivedono, i personaggi nominati **dentro** un edificio
(`actors.define({ indoor: true, … })`), la **porta tenuta aperta fuori orario**
(`shops.hold`, senza cui ogni missione dipenderebbe dalla saracinesca di un negozio), e la
**ricerca deterministica di un indirizzo** (`story/places.js`: la storia non piazza niente).
Aggiungere una missione adesso è un file sotto `src/story/` e una riga in `story/campaign.js`.

**Cosa la tappa C (§5.31) ha già tolto di mezzo.** Un cortile **cambia padrone e se lo ricorda**:
`game.turfs.claim(turf, gang, game, how)` sposta il tag a terra, il colore sulle due carte, il
mestiere del banco e chi ci sta di guardia, e l'evento `turfClaimed` lo dice al bus. M5 non deve
scrivere niente di tutto questo — deve **contare fino a tre** e scegliere come si arriva a ogni
`claim`; delle sue tre strade, entrare sparando e comprare il capocortile sono già meccanica di
città, e portargli via il lavoro è una fase che finisce con una `claim`. Il salvataggio se lo
porta dietro da solo (v4, 92 byte) e `places.findTurf` non resta più senza obiettivo se il
giocatore si è preso tutti i cortili di quella banda.

**Cosa il §5.30 ha già tolto di mezzo**: come si **arriva** a una meta. Il blip è un rombo che
si vede su tutte e due le carte, fuori dal ritaglio della minimappa diventa una punta con la
distanza, e sotto ci passa la strada da fare (A* sul grafo, `world/route.js`). Una missione non
deve fare niente per ottenerlo: gli basta chiamare `ctx.mark(x, y, { label })` come già fanno
M1 e M2 — l'etichetta è il nome che comparirà sulla carta. I punti in strada di una fase che
**non** stanno sotto al blip compaiono da soli: il giorno che una fase avrà due mete, la carta
è già pronta e non c'è da tornarci.

**Cosa l'impianto del §5.27 ha già tolto di mezzo**, e che quindi nessuna di queste tappe deve
più affrontare: gli inneschi delle missioni (bus, `game.on('pedKilled', …)`), una modalità nuova
per un dialogo (una riga in `core/modes.js`), lo stato nuovo nel salvataggio (il proprio
`snapshot()` e uno scalino in `MIGRATIONS`, senza buttare gli slot di nessuno), i personaggi che
devono stare in un posto (`game.actors.define(...)` — Chun-sik al 당구장 e Jo Ok-bun al 전당포
di M1 e M2), il blip sulla mappa (`game.setMarker(...)`), e la porta sigillata su cui M1 si
sarebbe fermata al punto 4 su 5 (`game.shops.seal(...)`).

**Cosa ha lasciato la tappa A** (§5.28), e vale per tutte le altre. I pannelli si disegnano con
`render/panelkit.js` (fondi, insegne, pioggia, manifesti, quadrante) e `render/pixelkit.js` (i
personaggi); un pannello resta **una funzione**, una cutscene resta **un file**. Il cast a
pixel c'è — Jae-min, Chun-sik, il tassista, il commesso, Seo Dong-hyeok — con quattro
espressioni e sette pose; aggiungere un personaggio è una griglia 24×24 e una riga di palette.
Le **regole di scrittura dei dialoghi** (si dice in chiaro una volta, il narratore traduce
l'hangul che porta trama, gli indizi si rendono visibili e mai spiegati) sono in testa a
`story/intro.js` e vanno rispettate dalle aperture delle missioni. **Il copione dei tre atti è
già stato riscritto su quelle regole**: chi implementa un'apertura trova le battute nella forma
definitiva, con le `(nota)` dove il giocatore va aiutato a *guardare* e la tabella delle parole
già tradotte in testa a [`storia/README.md`](storia/README.md) — glossare una seconda volta la
stessa parola è un errore, non una gentilezza.

**Cosa la tappa D (§5.32) ha già tolto di mezzo.** 까치 esiste, sulla `91.45`, ed è una
**tabella con predicato**: aggiungere una chiamata è una riga in `story/kkachi.js` —
`{ id, when(game, k), lines }` — e il motore non va toccato. Le sedici chiamate degli Atti II e
III (tappe F e G) sono quindi contenuto puro. Sono già pagate anche le tre righe di Kkachi che
stavano appese a un `hud.toast` (apertura, M1, M2: erano tre e non quattro — la quarta era il
pannello del quadrante di M1, che era già un pannello vero), il conto delle chiamate ascoltate
nel salvataggio — che è **una delle tre condizioni del finale C** e adesso c'è — e l'avviso del
cortile portato via mentre eri altrove. Chi scrive una chiamata trova in testa a quel file la
regola che conta: **ogni battuta è copiata da qualcun altro**, e il commento `// origine:` è la
prova, non una nota.

**Quello che la tappa D lascia indietro:**
- **la regia sonora dell'apertura** (fruscio di banda sotto la voce che conta, il cane, la
  sirena lontana). Il timbro del fruscio adesso c'è ed è quello giusto (`audio.beds.kkachi`),
  quindi resta da fare un **aggancio dei suoni ai pannelli** — `ui/cutscene.js` non ce l'ha — e
  tre suoni nuovi;
- **l'ottava chiamata dell'Atto I aspetta M3**: il predicato è già definitivo
  (`missions.isDone('m3')`) e resta falso finché non c'è la tappa E;
- **le «visite che cambiano»** (Jo dopo M6, Chun-sik dopo M9, il commesso dopo M8) stanno nello
  stesso capitolo del copione ma non sono chiamate radio: restano alle tappe delle loro missioni.

**Tre cose che M1 e M2 lasciano indietro** (§5.29), e nessuna blocca la tappa C:
- **un oggetto di missione trasportabile.** I tre pegni di M2 sono tre caselle in un taccuino,
  non tre cose in mano: non si vedono addosso e non si possono perdere;
- **un pedinamento con soglia di distanza** («ti ha visto / l'hai perso»), che M3 chiede subito
  e che torna in M6 e M9. È la meccanica nuova più leggera dell'atto;
- **Jo che risponde in modo diverso dopo M6** (le «visite che cambiano»,
  [`storia/07-radio-kkachi.md`](storia/07-radio-kkachi.md)): oggi il banco dice sempre le stesse
  cose una volta finita M2.

**Rimasto indietro da 까치** (§5.32):
- **Le chiamate perse non si vedono da nessuna parte.** Il conto c'è (`kkachi.missed`) e per
  copione compare **solo** nei titoli di coda, che sono la tappa H: fino ad allora è un numero
  che nessuno legge.
- **Il fruscio non sa dove sei.** Suona identico in galleria, sotto un cavalcavia e in mezzo al
  campo. È lo stesso difetto della radio vera («non gracchia in galleria», sotto), e adesso ci
  sarebbe un letto su cui farlo.
- **Kkachi non tace quando parla qualcun altro.** Un dialogo di missione mette in pausa la sua
  battuta, ma appena finisce riprende da dove era: due voci in due secondi diversi va bene, la
  regia vera vorrebbe che aspettasse un momento.

---

## 6. Backlog successivo (già concordato con l'utente)

**Fase 3 — contenuti.** Negozi e interni (§5.8), la mappa (§5.9), il ciclo giorno-notte
(§5.11), i due giri di arretrati (§5.12 e §5.21), il salvataggio (§5.15), l'arresto (§5.16),
il menu iniziale (§5.18), la musica (§5.19) e l'autosave (§5.20) sono fatti; la segnalazione
sul traffico è chiusa (§5.10) e quella sulle auto attraversabili pure (§5.17, e dal §5.21 vale
anche per i pedoni). Dal §5.22-5.24 sono fatti anche **Seoul estesa, le geografie autonome di
Busan e Jeju, gli interni metro e i collegamenti interurbani**: ingressi solidi fuori dalle
corsie, passeggeri e chiosco nelle stazioni e coste rifinite. Dal §5.25 le tre città stanno
**nella stessa mappa**, disposte come in Corea: a Busan ci si arriva guidando sulla Gyeongbu,
a Jeju via mare o in volo. Mappa, carta e salvataggi sono unici.
**Restano le missioni**, che sono il lavoro grosso. **I contenuti però adesso ci sono**: il
copione completo della campagna — dodici missioni in tre atti, cutscene iniziale, raccordi,
finali e ventiquattro chiamate radio — sta in [`storia/`](storia/), scritto e non implementato.
**E l'impianto è deciso**, con l'utente: pannelli solo testo, cutscene saltabile, un blip solo
sulla missione attiva, fallimento che riparte dall'ultima fase, un pannello = una funzione,
cortili persistenti, tre finali, Kkachi come tabella con predicato (fatta, §5.32), storia prima
delle attività secondarie. Le decisioni e le **otto tappe** di lavoro stanno in
[`storia/08-domande-aperte.md`](storia/08-domande-aperte.md); l'**impianto è pronto** (§5.27) e
l'ordine delle tappe è quello del §6.0, qui sopra. Resta aperta una domanda sola: se le missioni
si rigiocano.

Quello che segue è quanto resta indietro, in ordine di quanto si sente. È molto più corto di
prima: il §5.12 ha pagato diciannove voci di questo elenco, il §5.13 ha chiuso l'audio, il
§5.15-5.16 le due voci che stavano in cima, il §5.18-5.20 le tre che le avevano sostituite e
il §5.21 altre undici — fra cui le due che erano tornate in cima.

**Le cose che si sentono di più, oggi:**
- **Non ti caricano in volante.** L'arresto c'è (§5.16), ma è uno stacco: manette, nero,
  commissariato. Vedere l'agente che ti ammanetta e la volante che parte vorrebbe
  un'animazione e un pezzo di regia della camera. **È la voce più visibile rimasta.**
- **Nessuno sorpassa.** Sull'arteria le due corsie per senso restano inutilizzate, ed è
  **l'ultimo debito grosso del traffico** (dettagli più sotto).

**Rimasto indietro dai cortili** (§5.31):
- **Le guardie del cortile tuo non sono tue.** Ci stanno e non ti sparano, ma non ti seguono,
  non si possono chiamare e non difendono niente più di prima.
- **Comprare un cortile è una riga di listino, non una trattativa.** Funziona e si capisce, ma
  il capocortile che si fa da parte non dice niente: è la scena che M5 avrà e la città no.
- **Un cortile non produce lavoro, solo una busta.** È la superficie naturale delle attività
  secondarie (consegne, corse), quando ci saranno.

**Rimasto indietro dal salvataggio** (§5.15, §5.18, §5.20, §5.21):
- **La folla degli interni non si ricorda i clienti stesi**: il personale sì, chi era di
  passaggio no (§5.15).
- **Chi è uscito in strada scappando non entra nel salvataggio**: dal §5.21 il commesso in
  fuga diventa un pedone di città, e i pedoni sono streaming — ricaricando è di nuovo al banco
  anche se la telefonata era già partita.

**Rimasto indietro dall'acustica** (§5.21):
- **Manca lo spazio grande.** `SPACES` ha quattro voci perché le 240 piante dei negozi sono
  tutte stanze (78k–117k px²): una `hall` la vorrà il primo interno grande, cioè il terminal
  dell'aeroporto quando ce l'avrà.
- **Il riverbero non sa che piove né che è notte**: uno sparo in un vicolo sotto il temporale
  suona identico a uno sparo nello stesso vicolo col sole.
- **La coda non passa dai muri**: dentro un negozio si sente la stanza, ma la strada fuori non
  filtra nulla verso l'interno — un'esplosione a due porte di distanza arriva secca.
- **Ci sono quattro voci e nessuna parla**: `VOICES` serve solo a urlare e a lamentarsi. Le
  missioni vorranno almeno un verso di richiamo.

**Rimasto indietro dalla radio** (§5.14):
- **Le tre grandi coreane non ci sono**: KBS, MBC e SBS trasmettono in HLS con un token, e
  `<audio>` non legge HLS. L'unica strada senza librerie sarebbe un demuxer TS→fMP4 scritto a
  mano sopra MSE: è tanto lavoro per tre stazioni, ma sono *le* tre stazioni.
- **Niente memoria di cosa suonava**: la stazione si ricorda (localStorage), il punto no —
  ovvio per una diretta, ma vuol dire che ogni salita in auto ricomincia dal buffering.
- **Non si vede il titolo del brano**: gli Icecast lo mandano nei metadati (`Icy-MetaData`),
  che da un `<audio>` non si leggono. Vorrebbe dire scaricare lo stream a mano.
- **La radio non reagisce a niente**: non si abbassa quando arriva la polizia, non gracchia
  in galleria, non si spegne quando l'auto prende fuoco.

**Rimasto indietro dalla musica** (§5.19):
- **Non c'è un pezzo per la guida**: fuori dal menu e dalla caccia il gioco è muto di musica,
  e quando la radio non ha rete resta muto e basta. Un pezzo lento da notte, che parta solo in
  auto e solo con la radio spenta, è la prima cosa da provare — e la prima da buttare se
  stanca dopo dieci minuti.
- **La caccia non sa se sei in auto o a piedi**, e nemmeno se stai scappando o combattendo:
  gli strati crescono con le stelle e basta.
- **Gli stacchi sono due** (`go`, `busted`): mancano quello della morte (c'è solo
  `audio.playerDown`), quello di una rapina riuscita e tutto quello che vorranno le missioni.
- **Niente musica negli interni**: un 노래방 senza musica è un 노래방 strano.

**Rimasto indietro dall'audio** (§5.13):
- **L'insegna non ronza e il 편의점 non ha la sua musichetta**: il fondo urbano è un letto solo
  e non sa niente di cosa c'è attorno. Un letto per prop acceso costerebbe poco (le insegne
  vicine sono già indicizzate) e caratterizzerebbe i quartieri di notte.

**Rimasto indietro dal ciclo giorno-notte** (§5.11):
- **Il traffico non sa che piove**: frena alle stesse distanze e sul bagnato scoda in curva
  (+30% di urti laterali). Farlo rallentare *in* curva è già stato provato e **misurato
  peggiore**. Se qualcuno ci riprova, il pezzo che manca è rallentare **prima** della curva,
  cioè guardare `nextChoice` un arco più avanti.
- **Il sole non entra nella scelta dei colori delle facciate**: al tramonto le ombre sono lunghe
  ma il lato illuminato di un palazzo è sempre lo stesso. Costa l'invalidazione di `gradCache`
  a ogni tacca del sole, ed è la cosa che si nota meno di tutto l'elenco.
- **Niente neve, nebbia o stagioni**, per le ragioni in §5.11.

**Rimasto indietro dai negozi** (§5.8) e dagli interni:
- **Dal retro non si entra e non si sale**: la porta di servizio è solo un'uscita.
- **La folla non ricorda chi era lì**: due visite alla stessa ora hanno gli stessi posti ma
  persone nuove. Ricordarle vorrebbe dire una lista permanente per fascia oraria, e non si nota.
- **Gimpo non ha ancora una vetrina.** Il §5.21 ha garantito un 전당포 ovunque *si potesse*;
  l'espansione del §5.23 ha dato edifici e due negozi anche alla campagna di Gyeonggi, ma a
  Gimpo i volumi restano infrastrutture aeroportuali senza una porta commerciale. La riga
  `gimpo` di `shops.MARKETS` (munizioni 1,40!) si legge quindi soltanto nel prezzo
  dell'officina finché il terminal non avrà un interno.

**Rimasto indietro dalla polizia** (§5.5, §5.12, §5.16):
- **Dalla cella non si esce a piedi con qualcosa da fare**: niente cauzione da pagare in
  anticipo, niente scelta fra restare dentro e uscire subito, e i commissariati restano volumi
  chiusi anche adesso che ci si rinasce davanti.
- **Durante l'assedio non si posano blocchi né chiodi**: uscendo non si trova mai una transenna
  davanti alla porta. `manageObstacles` ragiona su un vettore velocità, e una porta non ce l'ha.
- **Durante l'assedio gli agenti attraversano i muri** (nessuna collisione, per scelta di costo):
  per un frame se ne può vedere uno dentro una vetrina prima che lo steering lo rimetta a posto.
- **Non si entra nei commissariati**: non esiste un `biz` `police` in `interiors.js` — e
  adesso che l'arresto ti ci sveglia davanti, si nota di più.
- **Le motovedette non speronano e non fanno posti di blocco d'acqua**; non c'è un'unità aerea
  d'attacco oltre all'elicottero.
- **La granata è solo della SWAT e solo a cinque stelle**: niente lanci dal finestrino.

**Rimasto indietro dal traffico** (§5.10):
- **Nessuno sorpassa.** Sull'arteria le due corsie per senso restano inutilizzate. Un tentativo
  è già stato fatto e misurato peggiore: manca la scelta della corsia in base alla svolta
  successiva. **È l'ultimo debito grosso del traffico**, adesso che il ciclo del semaforo è
  stato misurato (§5.12).
- **Il traffico non sa niente della quota**: un'auto in salita rallenta per fisica ma non se lo
  aspetta, e alza il gas dopo.
- **`MAX_TRAFFIC` resta a 44, e adesso si sa che il semaforo non lo sblocca.** §5.10 lo aveva
  sceso da 54 indicando il ciclo del semaforo come la leva per rialzarlo; §5.12 l'ha misurata e
  la leva non c'è (accorciare non dà niente, allungare fa danni). Chi vuole più densità deve
  cercare la capacità da un'altra parte — il sorpasso, o la priorità fra i mezzi.
- **Non c'è priorità fra i mezzi**: un autobus (158 px) e uno scooter (44 px) trattano l'incrocio
  allo stesso modo, e il primo lo occupa per il doppio del tempo.
- **I pedoni aggirano le lamiere ferme ma non si aggirano fra loro**: dal §5.21 un passante
  scarta un'auto in sosta, due passanti che si incontrano invece si compenetrano. Si nota molto
  meno (sono sagome della stessa taglia che si sovrappongono per un istante), ma è lo stesso
  steering e costerebbe una query in più per pedone per frame.

**Rimasto indietro dalle regioni, dalla metro e dalla mappa unica** (§5.22-5.25):
- **Il corridoio è geografia, non ancora contenuto.** Fra Seoul e Busan ci sono l'autostrada,
  due aree di servizio, campi e boschi dipinti — ma nessun paese, nessuna uscita, nessun
  casello, nessuna strada provinciale che scenda verso la costa. È la superficie migliore su
  cui mettere le attività secondarie (consegne, corse), e va decisa insieme a quelle.
- **Nessun collegamento marittimo o aereo *messo in scena*.** Jeju è raggiungibile davvero in
  barca o in volo, ma non c'è un traghetto che parta a orari né una tratta di linea: si guida
  o si vola per conto proprio, oppure si prende il treno dalla metro.
- **Il tratto interurbano in metro è ancora uno stacco funzionale.** Ingresso, atrio, tornelli,
  banchina e treno si vedono e si percorrono; dopo la scelta, però, il tempo avanza e il
  personaggio arriva senza tariffa, biglietto né sequenza di KTX. Adesso però è una comodità e
  non l'unica via, quindi pesa meno di prima.
- **Il bordo di una città resta leggibile a terra.** La tinta del terreno si interpola fra i
  distretti e la campagna si dirada, ma dove finiscono gli isolati la trama cambia di colpo. Si
  legge come «qui finisce Seoul», che è quasi giusto — una periferia vera vorrebbe capannoni,
  svincoli e case sparse.
- **Lasciare una città non conserva il suo stato locale.** `ShopSystem` e gli interni non
  ricordano casse svuotate, spese e vendite di una città quando si è dall'altra parte del paese.
  Con una mappa sola non c'è più un momento in cui «si lascia una regione», quindi il difetto è
  meno visibile ma non è chiuso.
- **Le linee sono etichette, non un grafo.** Il pannello permette di scegliere ogni altra
  fermata; non calcola cambi, percorso, durata o fermate intermedie. Un vero grafo serve solo se
  il viaggio deve diventare gameplay invece di navigazione rapida.
- **Mercati e mix di popolazione riusano le chiavi canoniche di Seoul.** I nomi e l'identità
  visiva sono regionali, ma `hongdae`/`gangnam` restano gli id letti da negozi e traffico. Un
  bilanciamento economico davvero diverso per città richiede chiavi `region:id` o un secondo
  livello di configurazione.

**Rimasto indietro dalla mappa** (§5.9) e dagli esplosivi (§5.7):
- ~~Nessun traffico aereo o navale~~ · ~~le bande non si fanno la guerra~~ · ~~in campagna non
  c'è nessuno~~ — **fatte con il §5.26**, e ~~un territorio non cambia mai padrone~~ —
  **fatta con il §5.31**. Restano tre cose aperte:
  - **le rapine non riguardano il giocatore.** Passare di lì mentre succede è uno spettacolo,
    non un'occasione: non si può derubare il rapinatore, denunciarlo o farsi assumere. La
    superficie naturale sono le attività secondarie;
  - **nessuna linea di traghetto o volo di linea.** I mezzi pilotati sono traffico, non
    servizio: partono e arrivano dove capita, non c'è un orario né una tratta;
  - **in campagna c'è da lavorare ma non da fare**: le attività secondarie (consegne, salti,
    corse) restano la superficie migliore su cui metterle, e adesso hanno delle comparse.
- **L'aeroporto non ha interni**: terminal e hangar sono volumi chiusi. Adesso ne dipendono due
  cose in più — lo spazio acustico grande e le due righe di `MARKETS` senza vetrina.
- **Il fuoco non attacca gli edifici**: lambisce le facciate e si ferma. Bruciare un palazzo
  vorrebbe dire uno stato sui volumi e un modo di disegnarlo.

**Fase 3 — quello che resta.**
12 missioni in 3 atti con cutscene a **pannelli a fumetto** — **scritte**, vedi [`storia/`](storia/),
e da qui in poi il lavoro è impianto e disegno, non invenzione (gli interni sono anche il posto
dove ambientarne metà: un incontro in un 노래방 non ha bisogno di niente di nuovo, un
appuntamento può avere un'ora, e adesso una banda ha anche un motivo per parlarti); attività
secondarie (taxi, consegne, salti). **Sono il prossimo lavoro grosso**; i debiti tecnici e di
rifinitura restano elencati sopra. Le missioni avranno bisogno di
cinque cose che adesso ci sono e prima no — un posto da cui cominciare la partita (§5.18), un
posto in cui riprenderla (§5.15), una sconfitta che non sia solo la morte (§5.16), un sistema
musicale a cui aggiungere una riga per far partire un pezzo (§5.19: si tocca `music.direct` e
nient'altro) e un modo di ricominciare da capo senza ricaricare la pagina (§5.21:
`game.newGame()`).
