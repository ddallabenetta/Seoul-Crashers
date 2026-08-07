# Storico — mezzi e persone diventano volumi

> §5.22 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../HANDOFF.md).

### 5.22 Anche le auto e la gente hanno un fianco

**Richiesta dell'utente, subito dopo la §5.21:** *«molto bello il tilt a 24 gradi, però il
protagonista, gli npc e i veicoli sembrano sempre visti dall'alto e non hanno una proiezione a
24 gradi»*.

Aveva ragione, ed era una mezza verità del §5.21: lo schiacciamento del piano *toccava* anche
gli sprite (sono disegnati in coordinate di mondo, quindi si schiacciano con tutto il resto),
ma uno sprite schiacciato resta piatto. Un palazzo si apriva e mostrava una facciata; un'auto
restava una figurina stampata sull'asfalto. Con la camera a picco non si notava — non si
apriva niente — con la camera piegata era la prima cosa che si vedeva.

#### Estrudere, non impilare

La strada breve sarebbe stata lo *sprite stacking*: ridisegnare lo stesso sprite N volte lungo
il vettore di proiezione. Costa N `drawImage` per entità (con 100 pedoni e 45 mezzi sono più di
mille) e dà una colonna della sagoma vista da sopra, cioè estrude anche ruote e specchietti
fino al tetto.

Qui c'era già la macchina giusta, e serviva solo applicarla a qualcos'altro: `drawBuilding`
estrude un **rettangolo** e ci appoggia sopra una texture. Un mezzo è la stessa cosa, con il
rettangolo ruotato e lo sprite come faccia superiore. Da lì:

- **`extrudeRect`** estrude un rettangolo ruotato con la regola delle facce visibili identica a
  quella dei palazzi — una faccia si vede quando la sua normale uscente punta *contro* la
  proiezione, quindi al massimo due delle quattro. Due quadrilateri, nessuna allocazione, e non
  l'inviluppo convesso usato per le ombre (quello si calcola una volta e si mette in cache, qui
  cambia a ogni frame perché il mezzo si muove).
- **`extrudeDisc`** fa lo stesso per una figura tonda: il disco spazzato è una capsula, due
  semicerchi e i lati che li uniscono, in un path solo.

Un mezzo è estruso su **due piani**: la scocca fino alla cintura e poi l'abitacolo, più corto e
più stretto, dalla proporzione `spec.cabin` che lo sprite già usava per disegnare il tetto. È
quello scalino a far leggere un'auto come un'auto invece che come una scatola col disegno di
un'auto sopra, e a distinguere una berlina da un furgone — che dall'alto hanno la stessa
pianta. I mezzi a scatola (`box: true`: furgone, camion, autobus, SWAT, trattore) portano la
scocca all'86% e lo scalino quasi sparisce; barche e velivoli restano un piano solo, perché uno
scafo non ha una cintura.

Una persona è una capsula sola, fino alle spalle: la testa la disegna già lo sprite visto da
sopra, e una capsula in meno per pedone sono cento path per frame.

#### L'altezza non è quella vera, ed è giusto così

Prima versione: altezze in scala reale (`PX_PER_M = 12`, una berlina è 1,45 m → 17 px). A
schermo continuava a sembrare piatta. Il motivo non era la proiezione, era la **pianta**: una
berlina è disegnata lunga 78 px per 4,6 m reali, cioè a 17 px/m e non a 12. Le carrozzerie e le
figure sono disegnate un 40% più grandi del vero perché a schermo si leggano, e un'altezza in
scala reale sopra una pianta esagerata dà un oggetto schiacciato.

Quindi `spec.tall` esce dalla scala di pianta di ogni mezzo, e quello che deve tornare sono i
**rapporti**: un uomo è alto 1,17 volte una berlina (1,70 contro 1,45), qui 28 px contro 24. Da
lì tutto il resto — un camion a 50 px si apre quanto un edificio basso, ed è esattamente quello
che fa un camion in mezzo a una strada.

#### Le due cose che sono andate storte

**Un elicottero con una colonna che scendeva fino all'asfalto.** La quota `v.z` finiva
nell'*altezza da estrudere* invece che nella *base*: a 200 px di volo il volume partiva da terra
ed era una colonna di duecento pixel. Il volume di un oggetto parte dalla sua quota; a terra
`v.z` è zero e la base coincide con la pianta.

**Tre millisecondi per frame buttati in `shade()`.** La tinta di un fianco si ricavava a ogni
frame per ogni mezzo e ogni pedone: `shade` fa parsing di una stringa esadecimale e ne
costruisce una nuova, e duecento chiamate per frame producevano un valore che non cambia mai —
la carrozzeria di un'auto cambia colore solo diventando rottame, il bomber del protagonista solo
al 옷가게. Messa in cache sull'oggetto (`v._side`, `p._side`), come l'ombra di un edificio sta
in `b._shadow`, il costo dell'estrusione è sceso da ~3 ms a **0,2 ms per frame** misurati sulla
stessa inquadratura, spegnendo e riaccendendo `extrudeVehicle`/`extrudePerson` a runtime dentro
la stessa prova (l'unico modo di confrontare due varianti senza che la deriva della macchina —
±3 ms fra una prova e l'altra — si mangi la misura).

Nel gioco che gira: **60/58 fps** in strada con 81 veicoli e 102 pedoni, e mediana 36 in una
caccia a cinque stelle, cioè gli stessi numeri della §5.21.

#### Cosa è rimasto piatto

**L'arredo urbano** (`scene.drawProp`: cassonetti, panchine, chioschi, transenne) non è
estruso. È basso, è tanto, e non ha un'altezza in tabella: sarebbe un'altra tappa. I container
del porto non c'entrano — quelli sono edifici (`style: 'container'`) e si aprono già.
