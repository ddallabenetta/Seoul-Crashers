# Le cuciture della mappa

> §5.38 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.38 — Tappa T9a del rework: dove la città finisce, la mappa deve finire bene

Un audit a schermo (26 punti più sei di dettaglio) ha trovato sei famiglie di cuciture
sbagliate fra le tre città, la campagna e il bordo del mondo. Nessuna è un bug di logica:
tutte erano visibili solo guardando. **La maglia di Seoul e l'rng principale non sono stati
toccati**: `game.city.stats`, i vicoli ciechi (25, stesse coordinate) e un hash di edifici,
prop, negozi, nodi, isolati e territori dentro Seoul sono identici prima e dopo.

## Cosa c'era e cosa è stato fatto

- **70 spuntoni fantasma** (`korea.accorciaStrade`). Le linee di Seoul e Busan arrivavano al
  bordo della propria mappa (100..7100), ma il grafo si ferma all'ultimo incrocio: restavano
  138-172 px di asfalto senza strisce e non guidabili, che finivano in terra nuda. Un passo
  dopo `finishGraph` e prima di `roadIndex` taglia ogni estremo, **senza rng**: se il nodo ha un
  arco verso l'esterno non si tocca (innesto dell'autostrada); se è un vicolo cieco l'asfalto
  si ferma `TESTATA_LUNGHEZZA` (44 px) oltre il nodo; se è un incrocio con uno spuntone oltre,
  si taglia al bordo dell'incrocio.
- **Testate dei vicoli ciechi** (`korea.testate`, disegno in `ground.drawTestata`): barriera
  new-jersey con catarifrangenti e fascia a chevron giallo-neri. Per le vie che si fermavano già
  sul nodo (Busan, Jeju) si dipinge anche un apron fino alla barriera, **senza** allungare il
  segmento (allungarlo avrebbe fatto sparire edifici in `regions.reindex`). **Per T9c**: se una via
  diventa provinciale, `rimuoviTestata(city, nodo)` toglie la testata di quel nodo (poi
  `ground.invalidateRect`) e il segmento va allungato a mano.
- **Accessi al lungofiume** (`korea.accessiFiume`, `ground.drawAccessoFiume`): 18 spuntoni
  finivano sull'argine del Han senza ponte (citygen li fa arrivare apposta «fino all'argine»).
  Adesso sono una piazzetta lastricata con colonnine, senza strisce: non guidabile, e si vede.
- **Fascia scura attorno a Seoul**. Due cause. (1) `drawGroundBase` interpolava quattro angoli
  per tile: il degradé dal fondo scuro dei distretti al verde era largo un tile e partiva da una
  riga dritta. Ora `drawGroundField` campiona un campo continuo della distanza dal bordo (17×17
  per tile, campioni sui bordi come l'hillshade) con rampa che comincia `GROUND_RIM` px **dentro**
  la città, dove finiscono gli isolati. (2) Sul lato est l'**hillshade** saturava: `korea.elevationAt`
  raccordava la quota con uno smoothstep a derivata zero (plateau di colpo dopo una discesa di
  0,09 px/px → striscia chiara a x=7200 e parete scura). Ora la quota si continua con la
  pendenza del bordo (`EDGE_BLEND` 1300) e `reliefAttenuation` smorza il rilievo vicino al bordo.
  `drawCountryside` dirada le macchie su `GROUND_BLEND*0,8`.
- **Cucitura nell'acqua alla foce del Han**: `drawRegionalWater` escludeva Seoul anche dal
  confronto terra/acqua, quindi il bordo del rettangolo era una riva finta (la riga di schiuma
  verticale). Ora la battigia si decide sulla maschera intera e si salta solo dentro Seoul; il
  colore del fiume sfuma in quello del mare su `BLEND_FOCE` (260 px) e la riva passa da banchina
  a sabbia.
- **Raccordo dell'autostrada**: all'uscita di Seoul non c'è incrocio, ma le strisce si
  interrompevano per ~160 px (padding da incrocio). La linea d'uscita parte ora da `exit.y - w/2`
  e le sue strisce combaciano con quelle di Seoul. Il «doppio bianco vs giallo» dell'audit era
  solo l'antialiasing a 0,45× di due righe da 2 px; la larghezza 132/144 a Busan non produce
  nessun gradino visibile (l'angolo sborda a filo), quindi non è stata cambiata.
- **Bordi del mondo** (aggiunta di scopo). La mappa smetteva un tile oltre il limite: la camera
  mostrava un rettangolo nero a ovest, est e sud. `getTile` ora disegna fino a 8 tile oltre; il
  mare oltre il limite è quello vero (`isWater` si prolunga con i valori del bordo: `korea.isWater`
  clampa le coordinate fuori mondo), senza il gradino di tinta di `fillOutside`, che adesso scurisce
  solo la terra. Il limite fisico (`isBoundary`, 64 px) è segnato da **boe** sul mare, come già
  dal tratteggio nel bosco. Il degradé del mare occidentale parte da un'ascissa fissa (`SEA_X0`):
  prima ripartiva a ogni tile e il mare si leggeva a scacchi. La camera non si ferma prima del bordo:
  non serve più, perché oltre il bordo c'è sempre qualcosa di credibile.

## Verifica

`korea-census` (invarianti a 0, `segnaleticaSenzaAsfalto` compreso), `impianto-campagna` `[]`,
`missioni-run` e `atto-1` senza `false`, vicoli ciechi 25 → 25, traffico in due coppie di run
contemporanee entro il rumore. Screenshot prima/dopo di C01-C04, C08, C15, C18, C20 e dei bordi
(B01-B14).
