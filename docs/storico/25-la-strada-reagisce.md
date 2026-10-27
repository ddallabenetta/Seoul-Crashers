# La strada reagisce: sirene, clacson, attraversamenti

> §5.36 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.36 — Tappa T2 del rework: chi sta in strada si accorge di chi arriva

Fino al §5.34 il traffico guidava come se la città fosse vuota di eventi: una volante a sirena
accesa restava a 60 px/s dietro l'utilitaria che la precedeva, un clacson era un suono e basta, e
un pedone attraversava un'arteria da 175 px con una meta fissa a 110. Questa tappa chiude i tre
buchi e ne trova un quarto, il bug dei passanti dentro le lamiere. **Ogni comportamento sta
dietro un interruttore** (`traffic.YIELD.on`, `pedestrians.PED_TUNE.react` e `.crossSmart`) che una
scena può girare a runtime per confrontare con e senza sullo stesso albero.

## 1. Il traffico cede il passo alle sirene

`TrafficSystem.update` raccoglie ogni frame le volanti a sirena **in moto** (`siren`, guidate da
un agente, non sbarcate, non un posto di blocco, più di 30 px/s). Poi, in `driveAI`:

- **`sirenWatch`**: una volante entro `YIELD.range` = 430 px alle spalle e nello stesso verso
  (coseno dell'angolo > 0,7), o contromano entro il 70% di quella distanza, con meno di
  `YIELD.band` = 60 px di scarto laterale. Il fatto dura `YIELD.hold` = 1,4 s oltre l'ultima
  volta in cui la si è vista (`ai.yieldT`): senza, si cede e si riprende a ogni frame in cui la
  volante esce dalla fascia.
- **Chi cede rallenta** a `YIELD.slow` = 100 px/s.
- **Sulle arterie** (due corsie) chi sta nella corsia interna si porta in quella esterna se
  `laneProbe` dice che c'è posto: è lo scivolamento di T1, `laneLogic` non prende altre decisioni
  finché dura la cortesia.
- **Sulle strade a corsia singola** non c'è un'altra corsia: l'auto scivola di `YIELD.bias` = 7 px
  verso il cordolo (`ai.bias`, che `wayPoint` somma al waypoint). Sette e non di più: la
  carreggiata da 76 px lascia 3 px di margine e oltre si va sul marciapiede.
- **Non si riparte da un incrocio verso la volante** (`sirenCrossing`): chi sta per entrare in un
  incrocio con una volante a meno di `nodeR` = 330 px che gli si avvicina da un'altra strada o
  contromano aspetta alla linea. Le volanti non guardano i semafori, quindi un verde non
  protegge nessuno. **La cortesia ha un tetto** (`nodeHold` = 4 s, per incrocio): due volanti in
  fila non devono poter tenere fermo un incrocio per sempre.

## 2. La volante passa

Cedere non basta: nella corsia interna di un'arteria, o nell'unica corsia di una strada, la
volante resta comunque dietro. `PoliceSystem.followRoads` adesso **supera dalla corsia opposta**:

- chi la blocca in corsia (la stessa fascia di 26 px di prima) fa scattare `oppositeClear`: la
  corsia speculare (`-2 · laneOffset`, a sinistra dell'asse) deve essere libera per
  `len/2 + 170 + 0,75·v` px, con la fascia di ogni veicolo ristretta di 4 px — l'ostacolo che si
  sta superando sta a un'ampiezza di distanza e non conta;
- se è libera si sposta a 120 px/s (`ai.bias`) con tetto di 280 px/s; **se non lo è resta il
  vecchio freno a 60**: un sorpasso contromano senza la fascia libera è una frontale;
- finché l'ostacolo è affiancato (`beside`) il bias resta anche se la fascia si è occupata: tornare
  indietro con la fiancata accanto sarebbe peggio.

## 3. I pedoni sentono

Un clacson è un evento sul bus: `game.emit('honk', veicolo)` (dal tasto H in `player.js`, dalla
frenata davanti al giocatore a piedi in `traffic.senseAhead`), e `main.js` lo gira a
`pedSystem.hearHonk`, che interroga **la griglia dei pedoni** (nessun giro su tutti, nessun
O(n²)) entro `PED_TUNE.hornR` = 240 px:

- chi **attraversa**: nella seconda metà allunga il passo (`hurryT`, ×2,0 invece di ×1,45 per
  1,8 s), nella prima — e con il clacson vicino — torna da dove è sceso (`crossSX/SY`);
- chi è **sul marciapiede** e ha il clacson entro 120 px si volta verso il rumore, si ferma per
  0,45-1 s e fa mezzo passo indietro. I tempi sono sfasati con l'`id` del pedone e non con l'rng;
- nessuno reagisce due volte entro 2 s (`reactT`), e chi è in panico, armato di compito o in
  divisa lo ignora.

Le **sirene** non hanno bisogno di un evento: `PedestrianSystem.update` raccoglie ogni frame le
stesse volanti che vede il traffico, e un pedone **in carreggiata** entro `sirenR` = 320 px
sgombera dal marciapiede più vicino, di corsa; chi è sul marciapiede **non comincia ad
attraversare** (`crossingVerdict`).

## 4. Gli attraversamenti

- **Meta in base alla carreggiata** (`planCrossing`): si cammina lungo la normale del lato fino al
  primo isolato oltre la strada, e si sbarca sul suo marciapiede. Una via da 76 px sono ~112 px,
  un'arteria da 144 sono ~175: la meta fissa a 110 lasciava a metà strada tutta la seconda
  metà della città, e il pedone, non trovando un isolato entro 40 px, «tornava a camminare» in
  mezzo alle corsie. Dove oltre la strada non c'è un isolato (il fiume, il bordo della mappa) non
  si attraversa.
- **Semaforo** (`roadgraph.trafficRed`, `signalNear`): si parte solo se le auto della strada
  che si attraversa hanno rosso, e con rosso sufficiente a *arrivare dall'altra parte* più
  `greenMargin` = 1 s. Altrimenti si aspetta (`crossPend`: dopo l'attesa si attraversa senza
  ritirare il dado del 16%), ma non oltre `maxWait` = 10 s e non più di due volte — poi si
  gira l'angolo come prima.
- **Finestra di sicurezza anche laterale** (`pathClear`): ogni veicolo in moto entro la
  traversata si segue per tutta la sua durata, a passi di 0,25 s, contro la posizione del pedone
  lungo il suo cammino. Il vecchio controllo guardava solo chi arrivava *di fronte*, e un'auto che
  passa di lato sulla corsia da attraversare non la vedeva.

## 5. Il bug di `dentroLamiera`

`walkers-census` doveva dare 0 e dava 2, 26, 46, 72, 144, 290 a seconda della run: sempre un
pedone dentro un'auto **in sosta**. Si è trovato con una scena che registra *chi* e *per quanto*
(le prime due coppie di run erano rumore di campioni isolati, la coda era un solo pedone fermo
decine di secondi):

1. **Chi**: i **rapinatori** di `life.startRobbery`, ma anche, più di rado, un passante qualunque
   fra un muro e un furgone in sosta.
2. **Perché restavano**: i rapinatori nascevano a ±26 px dal centro dell'auto della fuga, cioè
   *dentro* il cerchio solido (22 px). `pushOutOfCars` li spingeva fuori dal lato più corto, che
   in un cortile o un vicolo dà su un muro: incastrati fra muro e lamiera per tutta la rapina.
3. **Perché non se ne andavano**: la valvola anti-incastro (`stuckT`) misurava la
   *velocità* e non lo *spostamento*, e la velocità contro un muro o una lamiera non veniva mai
   tolta: il pedone «correva sul posto» a regime e `stuckT` restava a zero. Lo stesso valeva per
   i muri, e per i 15 s di rapinatore piantato a 160 px dall'auto della fuga visto nella prova.
4. **Perché risultava «dentro» e non «a contatto»**: `pushOutOfCars` usciva solo dal cerchio
   più compenetrato, ma i tre cerchi di un furgone si sovrappongono, e uscire dal centrale lascia
   uno o due pixel dentro il vicino.

La correzione sono quattro righe dette in quattro posti: i rapinatori nascono **accanto**
all'auto (`life.besideCar`: fianco, poi muso e coda, scartando i punti dentro un solido);
`pushOutOfCars` esce da **tutti** i cerchi (due passate, un cerchio alla volta: sommarli
spara via il pedone) e **toglie la componente di velocità contro la lamiera**; la valvola misura
lo **spostamento**.

## 6. Misura fianco a fianco

Due alberi (`origin/claude/rework-t1-sorpasso` e questo), le run **in coppia, contemporanee**, tre
coppie, medie. I numeri assoluti dipendono dalla macchina e sotto il 7% è rumore.

| Misura | Prima | Dopo |
| --- | --- | --- |
| Volante a sirena su un tratto di arteria con 5 berline lente (`sirene.scene`, 2 coppie) | 15,8 s, 2 arrivate su 5, 69 px/s | **3,5 s, 5 su 5**, 180 px/s (con `YIELD.on = false` sullo stesso albero: 15,6 s, 2 su 5) |
| Danno alla volante nel passaggio | 3 | 6-10: passa a 200+ km/h sfiorando le berline, il prezzo del sorpasso |
| Attraversamenti partiti con il verde alle auto | 29 | **0** |
| Attraversamenti partiti / arrivati / tornati (4 zone, 18 s l'una) | 128 / 76 / 26 | 78 / 58 / 14: si aspetta il verde e si torna meno |
| Pedoni che cambiano rotta al clacson vicino (quota, 3 run) | = controllo | volti verso il rumore 3, 4, 13 contro 0, 0, 1 |
| `traffic-census`: urti/min · flusso mediano · fps | 31 · 3700 · 37 | 28 · 3860 · 36 (entro il rumore) |
| `traffic-census`: auto immobili (3 coppie) | 11 | 19 (sull'albero con tutto spento 21-28, con i soli pedoni spenti 20-24, con tutto acceso in altre due run 9 e 14: la spaziatura fra run è 9-24 anche sull'albero di partenza, non è attribuibile a un interruttore) |
| `walkers-census`: `dentroLamiera` (6 run) | 50, 0, 0, 18, 114, 204 | **0, 0, 0, 0, 0, 0** |
| `walkers-census`: pedoni che «corrono sul posto» (px/s > 30, spostati < 10 px in 1 s) | 5,0 | **2,6** |

`piantati` di `walkers-census` sale da 0,03 a 0,7: non è un peggioramento ma una misura diversa.
`stuckT` guarda adesso lo spostamento (§5), e conta chi correva sul posto contro un muro e prima
non risultava; la colonna `correSulPosto`, calcolata da fuori e uguale su ogni albero, dice che
sono la metà.



## Cose da sapere

- **`YIELD.on` spegne tutto**, comprese le volanti che superano dalla corsia opposta: una
  scena che vuole il vecchio comportamento lo mette a `false`, non tocca altro. Con
  `OVERTAKE` spento le arterie non cambiano corsia e restano solo il rallentamento e il bias.
- **Il sorpasso della volante è prudente**: con traffico fitto sull'altra corsia (la fascia deve
  essere libera per circa 400 px a 300 px/s) resta il freno a 60 di prima. È il compromesso giusto
  finché le volanti non sanno fermare il traffico opposto, e non lo sapranno finché non si decide
  che una sirena vale una frontale.
- **I pedoni reagiscono al clacson dentro i 240 px, non per linea di vista**: un muro non lo
  ferma. Costa zero e si sente comunque (l'audio è già posizionale), ma è una semplificazione.
- **`stuckT` misura lo spostamento**: chi cammina davvero ma molto piano (in salita ripida, con
  pioggia forte) non ne risente, perché la soglia è il 28% della velocità voluta *per frame*.
- **I clacson dell'IA scattano solo davanti al giocatore a piedi**, quindi `hearHonk` riceve
  poco: la reazione si vede soprattutto col tasto H.
