# Storico — la vista piegata

> §5.21 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../HANDOFF.md).

### 5.21 La camera si piega (stile *Chinatown Wars*)

**Richiesta dell'utente:** *«ora il gioco ha una vista completamente dall'alto con effetti
2.5d. Evolvilo per fare in modo che sia lievemente piegata come è su gta chinatown wars»*.

Il gioco aveva una vista **a picco** con estrusione radiale: i volumi si aprivano verso
l'esterno partendo dal centro dell'inquadratura, quindi un palazzo inquadrato al centro era un
rettangolo piatto e uno al bordo si apriva molto. Bello ai bordi, illeggibile in mezzo — e
soprattutto senza una direzione: metà città mostrava la facciata nord, metà quella sud.

#### Cosa vuol dire "piegare" una camera che non ha una terza dimensione

Non è un effetto da aggiungere sopra: è la stessa proiezione con l'origine spostata. La
derivazione sta tutta in tre righe, ed è quella che ha reso il lavoro piccolo.

L'occhio sta a quota `PROJ` sopra il terreno. Con la camera a picco sta sopra il centro
dell'inquadratura, e la proiezione di un punto a quota `z` è il punto in cui il raggio verso
l'occhio buca il piano di terra: `offset = (p − camera) · z / (PROJ − z) ≈ (p − camera) · z / PROJ`.
È quello che il gioco già faceva.

Inclinare la camera di `θ` significa **spostare l'occhio all'indietro** di `PROJ·tan(θ)` e
guardare in avanti. Cambiano esattamente due cose:

1. il punto di terra sotto l'occhio — il **nadir** — non è più il centro dell'inquadratura ma
   sta `TILT_LEAN = PROJ·tan(θ)` più a sud. La formula della proiezione è identica, cambia da
   dove si misura: `offset = (p − nadir) · z / PROJ`;
2. il piano di terra si vede di sbieco, quindi va **schiacciato** di `TILT_COS = cos(θ)`.

Messe insieme danno il risultato giusto per costruzione: al centro dello schermo un volume
alto `z` si alza di `((0) − PROJ·tanθ) · z/PROJ · cosθ = −z·sin(θ)`, che è la formula di
un'assonometria. Verso i bordi resta l'apertura radiale, cioè la prospettiva debole che dà il
diorama. E siccome `distanza dall'occhio² = distanza dal nadir² + PROJ²`, **ordinare per
distanza dal nadir è ordinare per distanza dall'occhio**: il painter's algorithm che c'era già
diventa più corretto di prima invece che meno.

Valore scelto: `TILT = 0.42` rad (**24°**). `TILT_COS` 0,913, `TILT_LEAN` 393 px, un palazzo
di 60 px che si alza di 24 px al centro dello schermo. A `TILT = 0` si torna esattamente al
gioco di prima — non è una via di fuga teorica, è come sono stati misurati i costi qui sotto.

#### Cosa è bastato cambiare

Lo schiacciamento sta dentro `camera.apply`, quindi **niente a valle lo sa**: asfalto in tile
cachati, strisce, ombre, decalcomanie, sprite e traccianti si schiacciano insieme perché sono
tutti disegnati in coordinate di mondo. Le uniche eccezioni sono i tre posti che convertono a
mano fra mondo e schermo (`worldToScreen`, `screenToWorld`, `bounds`) più il cerchio dello
scoppio nel mirino, che è un cerchio *per terra* e adesso è un'ellisse.

Il nadir è esposto come `cam.projX/projY`, e la regola è secca: **chi proietta un'altezza usa
quelli, mai `cx`/`cy`**. Sono una dozzina di righe in `scene.js`, tre in `interiorscene.js`,
due in `police.js` (l'elicottero) e una in `weapons.js` (il colpo che *lo* prende: si spara
dove lo si vede, quindi le due formule devono restare identiche).

#### Le tre cose che non tornavano, e come sono state chiuse

**Dentro un negozio non si può piegare niente.** Una stanza è profonda 300 px, il nadir sta a
393: il muro sud si sarebbe aperto sopra tutta la pianta invece che verso fuori, e il §5.8
aveva scelto l'apertura verso fuori proprio per non avere una pianta catastale. Quindi
`InteriorScene.render` mette `cam.lean = 0`. Lo schiacciamento **resta** — è la stessa camera,
e un interno che si sgonfia sulla soglia si vede — e `roomZoom` lo divide via, o la stanza
resterebbe piccola in mezzo allo schermo.

**Il protagonista può sparire, e prima non poteva.** Era una proprietà che nessuno aveva mai
scritto: i volumi si aprivano *da lui*, quindi non gli finivano mai sopra. Con la camera
piegata un palazzo a sud gli si apre addosso, ed è **corretto** — quel palazzo è più vicino
all'occhio. Rimettere il giocatore in cima all'ordine lo avrebbe disegnato *sopra il tetto* di
un edificio dietro cui sta, che si legge peggio di una sagoma trasparente. Quindi l'ordine
resta quello giusto e `scene.drawPlayerThrough` ridisegna la sagoma sopra chi la copre: un
alone scuro (senza, la figura si perde fra finestre della sua stessa taglia) più lo sprite
all'82%. Il test è esatto e costa un rettangolo per edificio: pianta, facciate e tetto sono il
rettangolo di pianta **spazzato** lungo il vettore di proiezione, quindi basta chiedersi se
esiste una frazione `t` di quel vettore che riporta il punto dentro la pianta.

Vale anche al volante — un furgone dietro un palazzo è lo stesso problema — e si legge da fuori
con `scene.playerCovered`, perché la domanda «quanto spesso scatta» è l'unica che dice se
l'inclinazione è troppa. Misurato: **0% guidando**, e attorno al 20-35% camminando appiccicati
ai palazzi di Myeongdong, che è il caso per cui esiste.

**I palazzi comparivano a scatti in fondo allo schermo.** Con la camera piegata un volume si
apre verso l'alto anche quando è inquadrato al centro, quindi un palazzo con la pianta appena
sotto il bordo basso ha il tetto dentro. Il margine della query va allargato **solo verso
sud**: a nord chi sta oltre il bordo si apre ancora più in là, e allargare tutt'intorno
costava il 28% di edifici disegnati per un problema che ha un lato solo.

#### Misure

Costo di `scene.render` sulla stessa inquadratura di Myeongdong, mediana di cinque prove da 60
frame in headless (software rendering: contano i rapporti, non i millisecondi):

| | ms/frame |
| --- | --- |
| vista a picco (`main`) | 15,3 |
| **con la camera piegata** | **17,6** |
| e con `TILT = 0`, cioè lo stesso codice senza inclinazione | 15,8 |

Lo scarto si divide in due: **0,5 ms** di struttura (la query più larga, la sagoma trasparente)
e **1,8 ms** di inclinazione vera, che sono per metà il 9,5% di mondo in più che si vede in
verticale — una camera inclinata guarda più lontano, ed è giusto che costi — e per metà il
fatto che uno schiacciamento non intero toglie a `drawImage` la via veloce sui tile da 512 px.
Nel gioco che gira: **60 fps** con 81 veicoli e 102 pedoni, come prima, e 45 in una caccia a
cinque stelle, come prima.

Mira: `tilt-check.scene` confronta le tre trasformazioni fra loro. `apply` contro
`worldToScreen` **0,0001 px**, `worldToScreen` contro `screenToWorld` **0 px**, e il punto di
mira del giocatore contro il punto di mondo sotto il cursore **1,7 px** — che è un frame di
smorzamento della camera, non un errore di proiezione.
