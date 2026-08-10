# L'itinerario sulla carta: la meta e la strada per arrivarci

> §5.30 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.30 — Un blip che si vede, e la strada da fare per raggiungerlo

La tappa B (§5.29) aveva dato alle missioni un blip. Il blip però era **un pallino di quattro
pixel**, uguale su minimappa e carta, e quando la meta usciva dal ritaglio veniva schiacciato
sul bordo: diceva «c'è qualcosa» e non diceva né *dove* né *quanto lontano*. In una città a
maglia ortogonale con un fiume in mezzo, «dove» e «quanto» sono l'informazione.

Questa tappa non aggiunge contenuto: aggiunge **la lettura**. Tre cose, nell'ordine in cui si
vedono a schermo — la meta si distingue, la strada per arrivarci è disegnata, e la distanza è
scritta dove serve.

---

## 1. Il percorso (`world/route.js`)

Il grafo stradale c'era dal §5.3 e **nessuno ci aveva mai cercato un percorso**: il traffico
sceglie a ogni incrocio (`nextLane`) e la polizia va greedy verso il bersaglio
(`police.chooseEdge`), che è tutto quello che serve a chi insegue. Una strada da *mostrare* è
un altro problema: deve arrivare davvero, e sulla maglia della Corea il greedy si infila nei
monconi lasciati da `trimDeadEnds` e resta lì.

Quindi A* vero, con l'insieme chiuso, i costi presi da `edge.len` e l'euristica euclidea. Non è
un lusso: il grafo dell'intera Corea è **951 nodi e 1207 archi**, ogni nodo si espande al più
una volta, e il caso peggiore misurato — Seoul → Busan, trenta incroci di percorso — costa
**0,26 ms**. I quattro buffer sono indicizzati per `node.id`, vivono quanto l'oggetto e si
marcano con una **generazione** invece di azzerarsi: un calcolo non tocca mille celle per
riscriverne trenta.

Il costo vero non è l'A*, è **quante volte lo si rifà**, e sono tre soglie:

- `RECALC` 0,4 s — sotto, si tiene quello che c'è;
- `MOVED` 45 px del giocatore — fermi a parlare, l'itinerario non si ricalcola **mai**;
- `TARGET_MOVED` 12 px del blip — e un blip nuovo si traccia **subito**, senza aspettare
  `RECALC`: mezzo secondo di ritardo su un cambio di fase si vede.

Misurato su venti secondi di gioco camminando: **23 ricalcoli, 2,7 ms in tutto**. A 60 fps sono
0,013 ms per frame.

Due cose che il percorso fa e che sembrano dettagli finché non si guarda la carta. La prima:
**il primo e l'ultimo nodo si tagliano** quando sono dietro le spalle — l'incrocio appena
superato e quello oltre la porta producono due segmenti all'indietro che a schermo si leggono
come un errore del percorso, non come la geometria del grafo. La seconda: quando la meta è in
un'altra componente del grafo, `solve` restituisce `null` e resta la **retta**, tratteggiata
più corta perché non si legga come una strada. Non è un ripiego: **Jeju non ha nessun arco che
la raggiunga** (§3), ed è giusto che la carta lo dica invece di inventarsi un ponte.

`RouteGuide` non è un sistema del mondo — non muove niente e nessuno lo interroga durante un
frame di gioco. Lo leggono la minimappa e la carta, che sono le due superfici su cui esiste.
Gira in `main.update` **subito dopo `missions.update`**: una fase appena cambiata ha già
spostato il blip, e l'itinerario disegnato in quel frame è già quello della meta nuova.

**Dentro un edificio si ferma da sé.** Le coordinate di una pianta sono piccole e in città
cadono nell'angolo nord-ovest (§3): un percorso ricalcolato da lì partirebbe da Gimpo. Resta
quello con cui si è entrati, che è anche quello che serve appena si riesce. È la stessa
trappola già pagata da `wanted.add` e da `police.focus`, e la difesa è la stessa — un punto
solo da cui passare.

## 2. Come si legge (`ui/hud.js`, `ui/mapview.js`)

Tre primitive condivise, esportate da `hud.js` come già faceva `roundPath`, perché minimappa e
carta piena devono disegnare **la stessa cosa** a due scale diverse:

- **`drawRoutePath`** — tre passate sulla stessa traccia: bordo scuro (una linea gialla su una
  strada gialla sparisce), pieno smorzato che dice *dove* si passa, e sopra il tratteggio che
  **scorre verso la meta**. Su una carta ferma quel movimento è l'unica cosa che dice da che
  parte si va, e costa un numero (`lineDashOffset`).
- **`drawMissionPin`** — rombo con l'alone che pulsa. La forma non è decorativa: sulla carta i
  quadrati sono negozi e commissariati, i cerchi metro e volanti, i triangoli landmark. Un
  rombo non è ancora di nessuno.
- **`drawEdgeArrow`** — quando la meta è fuori dal ritaglio della minimappa, una punta sul
  bordo che **guarda la meta** e la distanza scritta accanto. Due dettagli pagati a schermo:
  la punta sta 16 px dentro il bordo (nell'angolo il ritaglio è arrotondato e una punta
  appoggiata al vertice si taglia a metà) e l'etichetta va **verso il centro** della carta —
  sotto la punta, sul bordo basso, finisce fuori dal ritaglio.

La distanza compare in tre posti e vuol dire due cose diverse, che è voluto: accanto alla punta
sul bordo e nel riquadro della missione è la distanza **in linea d'aria** (quanto è lontana la
cosa), nella colonna della carta piena è la **strada da fare** (quanto si guida), con
l'etichetta che lo dice. Quando le strade non ci arrivano, l'etichetta diventa «in linea
d'aria» invece di far sembrare navigabile una retta sul mare.

**Anche la pianta di un interno ha i suoi punti.** Dentro un edificio la minimappa è la pianta
del piano (`hud.drawFloorPlan`) e il blip di strada resta fuori dalla porta: i punti della fase
che valgono *qui* — quelli per cui `missions.pointHere` è vero — ci compaiono con lo stesso
rombo. Senza, il terzo pegno di M2 si cerca a tentoni in una stanza di sei metri.

## 3. Cosa **non** è cambiato

La decisione presa con l'utente resta quella: **un blip solo, sulla missione in corso**, niente
elenco di commissioni sulla mappa ([`storia/08-domande-aperte.md`](../storia/08-domande-aperte.md),
punto 3). Qui non si aggiungono mete: si rende leggibile quella che c'è.

I punti della fase in corso che stanno in strada vengono disegnati **solo se non stanno già
sotto al blip**, e il caso normale è che ci stiano (si riscuote dove si entra). È la riga che
farà comparire da sola la seconda meta il giorno che una fase ne avrà due, senza che nessuno
debba tornare qui.

## 4. Come si verifica

`.claude/tools/scenes/itinerario.scene` (§9) non misura soltanto: **asserisce**, e ogni voce
`false` è un difetto. Il percorso parte dal giocatore e finisce *sulla* meta (non vicino), non
è mai più corto della linea d'aria né più lungo del doppio e mezzo, non ha salti oltre i
1800 px fra due punti consecutivi (sopra, due punti non sono un arco), il ricalcolo sta sotto
il mezzo millisecondo, Jeju resta in linea d'aria, dentro un negozio non si ricalcola, e senza
blip non resta una linea appesa.
