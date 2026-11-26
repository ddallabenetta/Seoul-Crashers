# Polizia con A* e guardie tue

> §5.44 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).
> La polizia di partenza: [§5.5-5.6](02-fase-2-combattimento-polizia-arsenale.md). Il percorso sulla carta: [§5.30](19-itinerario-sulla-carta.md).

### 5.44 — Tappa T5 del rework: le volanti girano attorno alla baia, e le guardie sono tue

Due difetti che si vedevano giocando, e che non stavano nello stesso file solo per caso:
**una volante davanti a un fiume o a una baia si piantava**, a vista del giocatore e senza
arrivare mai; e **le guardie di un cortile preso** (§5.31) ci stavano e basta, senza seguirti
né difendere niente. Tutte e due le correzioni hanno una costante che le spegne e riporta il
comportamento di prima: `police.CHASE.on` e `pedestrians.GUARD_TUNE.escort`.

---

## 1. Greedy da vicino, A* da lontano

La guida della volante resta quella del §5.5: a ogni incrocio l'arco che avvicina di più. Su
una maglia ortogonale funziona quasi sempre e costa una decina di confronti. Davanti all'acqua,
però, la scelta locale migliore è la riva: la volante ci arriva, la distanza smette di calare,
e lo speronamento (`tier.ram`, che punta in linea d'aria quando c'è vista) la manda dritta nel Han.

Adesso la volante tiene un **percorso A*** sul grafo (`route.solve`, lo stesso del §5.30), e
`chooseEdge` lo segue quando c'è. Gli archi non arteriali pesano `CHASE.side` volte la loro lunghezza: chi
insegue preferisce le vie larghe, perché su una stradina un'auto ferma tappa tutto. Si accende in due casi:

- **da lontano**: oltre `CHASE.near` (520 px) dal bersaglio, e si spegne sotto il 70% di quella
  distanza (isteresi). Da vicino la guida diretta è più reattiva, e un percorso rifatto ogni
  secondo su un bersaglio che si muove non aggiunge niente;
- **in stallo**: `chaseProgress` misura da quanto la volante non guadagna 30 px (`ai.stallT`).
  Dopo `CHASE.stall` (3,5 s) è un minimo locale, e finché dura **lo speronamento è sospeso**:
  il percorso vince sulla mira. Un bersaglio che scappa (distanza che cresce di 260 px) azzera
  il conto, perché lì la volante non è bloccata.

**Il costo è a scaglioni.** Ogni volante ha un orologio sfasato (`CHASE.every` ±20%), il
percorso si rifà quando il bersaglio si è spostato di `CHASE.moved` (160 px), e a tutta la polizia
è concesso **un** calcolo per frame (`perFrame`). `route.solve` scrive in un buffer della volante
(`ai.pathBuf`): nessuna allocazione per calcolo. `police.chaseStats` conta numero, somma e picco
dei millisecondi, e la scena li legge.

**Due dettagli che hanno chiesto una diagnosi** (stanno anche in `docs/trappole.md`):
- il percorso parte dal **nodo davanti** alla volante, non da quello dietro, e da lì vieta
  l'arco da cui arriva (`route.solve(…, avoid)`): senza il divieto viene un'inversione a U in
  mezzo all'incrocio;
- con la meta in un'altra componente del grafo (Jeju) `solve` restituisce `null`: resta il
  greedy e si riprova al giro dopo.

La scorta dell'arresto (§5.35) ha già il suo A* (`escortWaypoint`) e azzera `ai.path` per non
tenerne due.

## 2. Le guardie del cortile tuo

`watchYard` gira una volta per frame e prepara due elenchi: **chi ti scorta** (fino a
`GUARD_TUNE.max`, in ordine di id, senza il 거래책 che resta al suo banco) e **chi è ostile**.
L'elenco degli ostili è **per ruolo**: chi è `hostile` dentro il recinto allargato di
`foeMargin`, e l'agente che ti ha a tiro (`copRange`) mentre sei ricercato e non ti stanno già
ammanettando. Non è «tutti tranne i miei», così una guardia non scambia mai un compagno per un
nemico.

`guardOrder` decide il passo di ogni guardia: prima l'ostile più vicino, con la stessa manovra
degli eventi di `life.js` (`life.engage`: tiene la distanza di tiro e gira l'angolo se c'è un
muro); poi la scorta, su una **corona a ventaglio dietro di te** (±0,8 e ±1,6 rad dal retro, a
`ringMin` + `ringStep` per guardia). Il posto resta dentro il recinto. Troppo vicina, la guardia
fa un passo indietro; al suo posto si gira verso fuori. Si entra nella scorta al recinto e se ne
esce a `leave` px oltre (isteresi): fuori dal cortile le guardie tornano alla ronda.

Tre scelte:

- **Non attaccano la polizia per prime.** Con zero stelle un agente nel cortile non viene
  toccato; e se le guardie stendono un agente che ti ha a tiro, il ricercato non sale, perché
  il reato non è tuo.
- **Non ti seguono fuori.** Il copione non lo chiede, e una banda che esce dal suo cortile è un
  evento di `life.js`, non una scorta.
- **Un tuo sparo non le spaventa.** Prima `pedestrians.alarm` rendeva ostile chi ha `fights`
  vicino a uno sparo, e sotto una raffica la scorta si rivoltava o scappava: le guardie di un
  cortile tuo sono escluse dall'allarme.

La ronda (`postX`, `idleT`) usava `Math.random`: adesso usa `this.rng`, come il resto dei pedoni.

## 3. Come si verifica

- `inseguimento.scene` **misura**, dall'esterno, così gira uguale sull'albero di partenza:
  sette posti (cinque a Seoul, due a Busan di là da una baia), a 3 e 5 stelle, con il secondo al
  primo contatto e i secondi persi in un minimo locale. Circa 12 minuti per albero.
- `guardie.scene` **asserisce**: `[]` vuol dire tutto a posto. Due voci sono invarianti,
  `nonTiBloccano` e `nonHostili`: una scorta che ti impedisce di passare, o che dopo il tuo
  sparo diventa ostile, è peggio di nessuna scorta.

### I numeri

`inseguimento.scene` sull'albero di partenza (greedy puro) e su quello finale (A* con `side` 1,6), una passata
intera per albero, secondi di gioco al primo contatto e secondi persi in un minimo locale:

| Gruppo | Greedy | A* |
| --- | --- | --- |
| Seoul, vicino (10 prove) | 17,5 s · 5,4 s persi | **10,2 s · 0,6 s persi** |
| di là da un fiume o una baia (4) | 31,0 s · 1 non arrivata | 34,1 s · 2 non arrivate |
| Busan (4) | 38,1 s · 1 non arrivata | 29,3 s · 1 non arrivata |

L'A* **puro** (senza `side`) a Busan andava peggio del greedy: su sei prove per posto, Haeundae 31 s contro 23 e
Gwangalli 45 contro 27, con una volante che non arrivava. Il motivo e la correzione stanno in
`docs/trappole.md`; dopo la correzione Haeundae è pari (26 s, 6/6) e Gwangalli scende a ~34 s. Lo scarto di là
dalla baia resta nel backlog. Il rumore è grande: per un confronto, un posto solo (`__SOLO`) e `__REP = 3` su
due alberi in parallelo. L'A* costa al massimo 0,2 ms in un frame.

## 4. Cose da sapere

- **Una guardia colpita da un nemico resta e risponde** invece di scappare (prima la scorta si svuotava al
  primo colpo). Una guardia sul bordo del cortile continua invece a schivare le auto come ogni passante.
- **Le guardie non si chiamano.** Ti scortano solo dentro il cortile; un comando per mandarle da
  qualche parte è nel backlog (§6, «Rimasto indietro dai cortili»).
- **Le motovedette** non sono toccate da questa tappa: per l'acqua c'è un navigatore a parte
  (`entities/boatnav.js`), arrivato con M10 (§5.43).
