# Architettura — mappa dei file e concetti

> §2 e §3 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../HANDOFF.md).

## 2. Mappa dei file

```
index.html            schermata di caricamento + canvas
src/main.js           classe Game: boot, loop, callback del mondo, statistiche

src/core/
  loop.js             passo fisso 1/60 con accumulatore, render libero
  input.js            tastiera/mouse, stato continuo + fronti (wasPressed)
  audio.js            sintetizzatore WebAudio: colpi secchi + letti continui, mix, muto
  music.js            musica generata: tema del menu, caccia, stacchi — e la regia
  radio.js            stazioni coreane in streaming (`<audio>`, fuori dal grafo audio)
  save.js             salvataggio su localStorage: 3 slot + autosave, fotografia e ripristino
  math.js             angoli, damp, circleRectPush, pointSegment, KMH, PX_PER_M
  rng.js              mulberry32 deterministico (stessa seed = stessa Seoul)
  spatial.js          SpatialGrid (statica) e DynamicGrid (ricostruita ogni frame)

src/world/
  districts.js        i 7 distretti (con i parametri di maglia), RIVER, SEA, HILLS,
                      URBAN_BLOBS (la sagoma della città), GANGS, insegne
  citygen.js          quota del terreno, campo di urbanità, maglia stradale, mare e costa,
                      isolati (urbani, rurali, aeroporto, porto), edifici, props, indici,
                      vetrine (`placeShops`), officine (`placeGarages`), bande (`placeTurfs`)
  regions.js          registro delle città, ingressi metro e reindicizzazione comune
  seoul_expansion.js  landmark reali, cintura metropolitana e 16 stazioni della capitale
  busan.js            generatore autonomo: baia, Nakdong, ponti e tessuto urbano di Busan
  jeju.js             generatore autonomo: profilo insulare, Hallasan, campagne e due città
  daycycle.js         orologio, tabella della luce ora per ora, meteo a catena di Markov
  interiors.js        catalogo delle attività (con gli orari) + pianta di ogni piano
  roadgraph.js        nodi/archi, corsie, semafori, prenotazione incrocio
  maptexture.js       texture 1100×1100 della mappa, con hillshade (minimappa + mappa piena)

src/render/
  camera.js           camera 2.5D, PROJ, SUN, applyUI (DPR), shake, bounds
  sprites.js          VEHICLE_TYPES, PED_KINDS, sprite generati e cache
  facades.js          texture facciate (overlay), gradienti, insegne
  ground.js           GroundRenderer: tile 512 px con cache LRU + hillshade
  scene.js            pass di rendering, estrusione, ordinamento radiale
  fx.js               decals (gomma, sangue, bruciature) e particelle
  interiorscene.js    disegno di un piano: pavimento, muri estrusi, arredo, scale
  metroscene.js       interno stazione: atrio, tornelli, banchina, binari e convoglio

src/entities/
  vehicle.js          fisica arcade, pendenza, collisioni a tre cerchi, gomme a terra,
                      volo (`updateAircraft`), navigazione (`resolveMarine`), affondamento
  player.js           a piedi / alla guida, entra-esci, mira, fuoco, salute, morte
  traffic.js          streaming, AI di guida, parcheggi
  pedestrians.js      streaming, marciapiedi, attraversamenti, panico, ostili, ragdoll
  weapons.js          tabella armi, raycast, magnetismo di mira, mischia
  pickups.js          armi/munizioni/kit medici a terra, con ricomparsa
  wanted.js           heat, 5 livelli di ricercato, raffreddamento a vista
  police.js           pattuglie, volanti, sbarchi, posti di blocco, chiodi, SWAT, elicottero
  projectiles.js      esplosivi con proiettili veri: granate, molotov, mine, onda d'urto
  shops.js            interni: entrata/uscita, piani, gente dentro, casse, listini, officine

src/ui/
  hud.js              minimappa, tachimetro, barra armi, cartello distretto, toast, debug
  mapview.js          mappa a tutto schermo (pannello riusato dal menu)
  menu.js             menu di pausa (mappa, salvataggi, audio, comandi, statistiche, titolo)
  startmenu.js        menu iniziale sopra la città che gira (attract mode)
  saveslots.js        le schede dei salvataggi, condivise fra i due menu
  mixer.js            il pannello dei volumi, condiviso fra i due menu
  shopmenu.js         pannello del listino (compra/vendi)
  metro.js            ingresso/uscita, pianta fisica e rete locale/interurbana

.claude/              strumenti per chi sviluppa (non fa parte del gioco), vedi §9
  tools/probe.mjs     avvia il gioco headless, esegue scene, misura, screenshot
  tools/sprite.mjs    guarda uno sprite generato ingrandito
  tools/scenes/       scene pronte da dare a `probe.mjs --script`
  hooks/              controllo sintassi + briefing di sessione
  skills/             /seoul-verifica /seoul-arma /seoul-sprite /seoul-citta /seoul-suono
```

---

## 3. Concetti da conoscere prima di toccare qualcosa

**Proiezione 2.5D.** `PROJ = 880` in `camera.js`. Un punto ad altezza `z` viene disegnato con
offset `(pos − camera) * z / PROJ`, **lineare in z**, non prospettico. È una scelta: mantiene
le facciate parallelogrammi, quindi in `scene.drawBuilding` si può usare `ctx.transform(...)`
e riempirle con una texture affine. Se passi a una proiezione prospettica reale, le facciate
diventano trapezi e tutta la pipeline delle texture salta.

**Facce visibili.** Il tetto si sposta *verso l'esterno* dello schermo, quindi la facciata
visibile è quella rivolta *verso* il centro camera: `oy < 0 → 'bottom'`, `oy > 0 → 'top'`,
`ox < 0 → 'right'`, `ox > 0 → 'left'`. Sbagliarle è il tipico "edificio che si apre al
contrario".

**Ordinamento.** Un'unica lista (edifici + props + veicoli + pedoni + giocatore) ordinata per
distanza radiale **decrescente** dal centro camera: chi è lontano dal centro è più lontano
dalla camera, quindi va disegnato prima. Le ombre vanno tutte in un pass precedente.

**Terreno a tile.** `GroundRenderer` rende riquadri da 512 px in canvas cachati (LRU 96). Il
tile disegna, in ordine: base del distretto → fiume e lungofiume → asfalto → segnaletica →
isolati → strisce pedonali → **hillshade**. **Se cambi qualcosa che influenza il terreno devi
invalidare la cache** (`game.scene.ground.tiles.clear()`), altrimenti vedi il vecchio disegno.

**La maglia stradale è un dato, non una geometria.** `vLines` e `hLines` sono linee dritte
con centro `c`, larghezza e flag arteriale, **più un array `on[]`**: `l.on[j]` dice se quella
linea esiste davvero nella cella `j` (fra la perpendicolare `j` e la `j+1`). Da `on[]`
derivano *tutto*: i segmenti di asfalto, gli archi del grafo, gli isolati, la segnaletica, le
strisce. Tre fenomeni diversi sono lo stesso meccanismo:

- **superblocchi** — una via secondaria salta uno o due tratti, le celle si fondono;
- **disassamenti (dogleg)** — la via si spegne a metà e una *gemella* affiancata si accende
  per il resto, con il salto ancorato a un'arteria;
- **fiume** — le verticali senza ponte sono spente nella cella che contiene il Han.

Non ci sono casi speciali a valle: se aggiungi un fenomeno nuovo, esprimilo in `on[]`.

**Isolati per fusione.** Le celle libere vengono fuse con un greedy che **produce solo
rettangoli**: è un vincolo voluto, perché collisioni, tile, marciapiedi dei pedoni e parcheggi
assumono tutti isolati rettangolari (isolati poligonali sarebbero un lavoro di tutt'altra
scala). La crescita parte dal lato corto della cella: crescere sempre prima in orizzontale
trasformava la fessura di un disassamento in una striscia lunga mezza città.

**Grafo stradale.** Nodi in ogni incrocio della maglia, archi solo dove `on[]` è vero. Corsie
con `laneOffset`: boulevard (144 px) 2 corsie per senso a 18 e 54, strade normali (76 px) una
a 19. `lanePoint` restituisce il punto di corsia dato `(edge, dir, lane, s)`. **La geometria
di strade e veicoli è accoppiata**: se stringi le carreggiate o allarghi i mezzi, due auto che
si incrociano cominciano a collidere e il traffico si blocca.

**Rilievo.** `city.elevationAt(x, y)` è un campo di quota deterministico e senza allocazioni
(0 sul Han, ~30 in città, ~120 sul Namsan). **Il terreno disegnato resta in pianta**: il
dislivello si legge da tre cose messe insieme — l'ombreggiatura per pendenza nel tile,
l'altezza di proiezione dei volumi (`h3d + b.elev`) e la fisica delle salite. Deformare
davvero il terreno vorrebbe dire spostare ogni tile per la sua quota (scalini alle giunzioni)
o rinunciare alla cache: è una scelta consapevole, non una svista.

**La forma della città è un campo, non un contorno.** `city.urbanAt(x, y)` vale 1 nel centro
dei quartieri e 0 in campagna: è la somma di dodici macchie scritte a mano (`URBAN_BLOBS` in
`districts.js`) più un rumore che ne sfrangia il bordo. Sotto `RURAL_U` (0.26) la maglia fitta
non esiste: restano **una arteria su due** e qualche strada bianca, e gli isolati diventano
campi. È l'unico posto in cui è deciso *dove finisce Seoul* — a valle nessuno sa niente di
forme, si legge solo questo campo. Alzare l'ampiezza del rumore fa nascere risaie in mezzo a
Gangnam: il bordo va sfrangiato, non bucato.

**Una regione è sempre una `city`.** Seoul, Busan e Jeju espongono lo stesso contratto
(`graph`, griglie, blocchi, negozi, acqua, distretti e spawn): al viaggio `Game.travelTo`
ricostruisce insieme tutti i sistemi che trattengono un riferimento alla città. I contenuti
regionali vengono chiusi da `regions.js`, che valida ingressi/uscite della metro e rifà una sola
volta gli indici spaziali; aggiungere un landmark fisico senza quel passaggio lo renderebbe
visibile ma non solido. Il contratto non implica una topologia comune: solo Seoul passa da
`generateCity`; Busan e Jeju costruiscono linee, blocchi, acqua, rilievo e grafo nei propri
generatori. La geometria e la texture della carta sono mantenute in cache per regione, mentre
traffico e pedoni restano streaming e ripartono all'arrivo.

**L'acqua regionale è un campo autorevole.** Il renderer storico di Seoul conosce Han e mare
occidentale; Busan e Jeju devono invece essere disegnate campionando `city.isWater(x, y)`, sia
nei tile di `GroundRenderer` sia nella texture della carta. `maptexture.js` usa scale `kx` e
`ky` separate: Busan non è quadrata e una scala unica deformerebbe costa, edifici e strade.

**Un interno è una pianta, non necessariamente un negozio.** `Game.interiorFloor` restituisce
la pianta attiva a camera, collisioni e minimappa. I negozi continuano a usare `InteriorScene`;
la metro usa `MetroScene`, ma il giocatore attraversa la stessa `SpatialGrid`. `MetroSystem`
salva l'ingresso esterno, sposta il giocatore nell'atrio 1080×720 e mostra la scelta della
tratta solo vicino alla porta del treno. Uscita, morte, arresto, salvataggio e cambio regione
passano tutti da `Game.leaveInterior`, così coordinate locali e cittadine non si mescolano.

**Le arterie non sono più intoccabili.** Prima erano continue per definizione; adesso in
campagna ne sopravvive una su due, altrimenti il reticolo arriva identico fino al bordo mappa
e la città non ha profilo. Restano continue solo le linee con **`keep`**: il lungomare e i due
argini del Han. I ponti no — la loro campata sul fiume è forzata a valle (passo 3 di
`carveMesh`) e gli argini, che sono continui, la raccolgono. Di conseguenza `trimDeadEnds`
adesso lavora anche sulle arterie (salta solo le `keep`): un moncone di arteria è possibile.

**Il mare è il fiume, ruotato.** A ovest di `city.quayX` non passa più niente: `carveMesh`
spegne tutte le linee a ovest del **lungomare** (`city.coastLine`, promosso ad arteria come gli
argini del Han) e le celle diventano acqua invece di isolati. La battigia `city.coastAt(y)`
ondeggia fino a mezzo chilometro ma **sempre a ovest di `city.waterX`**: la maglia è stata
tagliata su quel valore, e una costa che sconfinasse annegherebbe la strada. Fra battigia e
banchina resta la piana di marea (갯벌).

**Aeroporto e porto sono campate, non casi speciali.** `planPlatform` sceglie il rettangolo di
celle fra due arterie, `carveMesh` spegne tutto quello che c'è dentro e **riaccende le quattro
arterie di bordo**; la fusione greedy degli isolati restituisce da sola un unico rettangolo. Se
si dimentica di riaccendere i bordi, la piattaforma si mangia mezza provincia. Pista, raccordi,
piazzale ed eliporti sono **superfici dipinte** (`city.runways` e compagnia), come le strisce
pedonali: non fermano niente e non entrano nell'ordinamento radiale.

**Volare è la stessa fisica con una quota.** `v.z` vive nella proiezione dei palazzi, quindi un
velivolo a 300 px si vede spostato rispetto alla sua ombra — ed è l'ombra a dire dov'è davvero.
In volo restano solidi **solo i volumi più alti della quota** (`resolveAirCollisions`): si passa
sopra Hongdae e ci si schianta sulle torri di Gangnam. Le due differenze fra rotore e ala sono
tutte in `updateAircraft`: il rotore stacca da fermo e **tiene la quota da solo** (in una
visuale dall'alto un elicottero che cala mentre miri è ingiocabile), l'ala pretende
`spec.rotate` di velocità e cade se la perde. Chi *sceglie* di scendere si posa sempre
(effetto suolo); a rompere il carrello è la caduta, non l'atterraggio.

**Per una barca non esistono edifici: esiste la riva.** `resolveMarine` campiona `isWater`
attorno ai tre punti dello scafo e spinge verso l'acqua. Il grip laterale bassissimo
(`spec.grip` 0.26-0.34) è quello che fa scarrocciare la poppa in virata, ed è metà del motivo
per cui una barca si sente diversa da un'auto.

**L'acqua è un confine vero.** A piedi si annega (`player.updateOnFoot`), un mezzo di terra che
ci finisce affonda senza esplodere (`sink` → `main.onVehicleSunk`), da una barca non si scende
in mezzo al mare. **Il controllo di annegamento va saltato quando si è dentro un edificio**: le
coordinate di una pianta sono piccole e cadono tutte dentro il mare, all'angolo nord-ovest.

**Un territorio è un posto che esisteva già.** `placeTurfs` non crea geometria: prende un
cortile, un piazzale o un capannone che c'erano, ci dipinge il tag della banda e ci mette
`props`. Le guardie sono pedoni con `p.turf` e stato `guard`, che girano dentro il rettangolo e
non ne escono. Diventano ostili quando il giocatore entra **con un'arma diversa dai pugni o già
ricercato** (`pedestrians.watchTurfs`): passarci disarmati e in fretta si può, ed è l'unica via
per andarci a trattare quando ci saranno le missioni.

**Streaming.** Veicoli e pedoni compaiono **fuori dal rettangolo inquadrato** (`outsideView`)
e si dissolvono oltre `ring.despawn`. Il `prewarm` al boot è l'unico che può generare in
campo visivo. **Due eccezioni:** velivoli e imbarcazioni (`v.moored`, `protect`) nascono una
volta sola al boot e non spariscono mai — un aeroporto senza aerei è un piazzale vuoto, e sono
l'unico modo di raggiungerlo; e le guardie di un territorio, che compaiono anche in campo
visivo purché a più di 300 px, perché un recinto di cento pixel non sta mai fuori vista.

**Auto in sosta.** Hanno `spot` e dormono (`updateVehicle` esce subito) finché non vengono
urtate o rubate: `awake = true`. Servono a non pagare CPU e a non farle vibrare.

**Fisica.** `v.speed` è la velocità del motore lungo il muso; `(vx, vy)` la insegue con grip
laterale, la differenza è il drift. **`speed` viene riallineato alla velocità reale solo dopo
un urto** (`v._hit`): farlo ogni frame smorza l'accelerazione dell'87% (bug già pagato, vedi
sotto).

**Solidi `vehicleOnly`.** `city.solidGrid` contiene tre categorie: edifici, props solidi e
**solidi che fermano solo i veicoli** (`s.vehicleOnly === true`). Oggi ci finiscono le
scalinate; nella tappa C ci finiranno chiodi e posti di blocco. **Chi interroga la griglia a
piedi deve saltarli**, e sono tre punti: `player.resolveCollisions`, il blocco anti-muro in
`pedestrians.updatePed` e i raggi in `weapons.rayCast` / `hasLineOfSight` (ci si spara sopra).
`vehicle.resolveVehicleCollisions` invece **non** li salta: è tutto il punto.

**I colpi sono raggi, non proiettili.** `weapons.rayCast` risolve il colpo nello stesso frame
contro solidi (AABB, metodo delle slab), pedoni (cerchio r=11), veicoli (gli stessi tre cerchi
della fisica) e giocatore. Quello che vola è solo il tracciante disegnato. A 500-900 px di
gittata un proiettile vero arriverebbe comunque nello stesso frame. **La perforazione non fa
eccezione**: è lo stesso raggio rilanciato da dove ha trapassato, con un `Set` di chi ha già
bucato passato a `rayCast` come `skip`. Solo i pedoni si trapassano — un muro ferma tutto.

**Gli esplosivi sono l'unica eccezione, e non per precisione.** Per una granata il **tempo di
volo è l'arma**: quella che rimbalza dietro l'angolo e la molotov che cade corta sono la
ragione per cui esistono. Quindi in `projectiles.js` hanno posizione, velocità e una quota `z`
che serve a due cose: scavalcare i solidi bassi (i `vehicleOnly` — transenne e gradini —
contano solo sotto i 14 px di quota) e proiettare un'ombra che dice **dove cadranno**, senza
la quale in una visuale dall'alto una parabola è illeggibile. La velocità orizzontale del
lancio non è fissa: è ricavata dal tempo di volo perché l'oggetto atterri *dove punta il
cursore*, che è l'unico modo di rendere mirabile un'arma che vola.

**Un'unica onda d'urto.** `projectiles.explode` fa danno a pedoni, giocatore e veicoli con
caduta lineare sul raggio, e i veicoli presi dentro possono saltare a loro volta: le catene
di esplosioni non sono codice, sono una conseguenza. Chiuso in macchina si incassa il 45%.

**Il mirino allarga, non stringe.** Col fucile di precisione (tasto destro) la camera *si
allontana* (`zoom 1.12 → 0.49`) e scivola verso il cursore. In una visuale dall'alto uno zoom
ottico sarebbe assurdo: il bersaglio a 1500 px non è piccolo, è **fuori schermo**. Attenzione
al giro vizioso — la posizione del cursore in coordinate mondo dipende dalla camera, quindi lo
scostamento va limitato (`SCOPE_LEAD 0.5` e tetto 300 px in `player.cameraTarget`), altrimenti
camera e cursore si rincorrono e la vista scappa via.

**Barra armi, non tasti.** Da cinque armi in su un tasto per arma non basta, e una rotella
sola su undici voci è ingiocabile: `WEAPONS[].slot` e `WEAPON_SLOTS` definiscono sei file
(tasti 1-6), ripremendo un tasto si scorre la fila, la rotella scorre tutto l'arsenale
posseduto. `WEAPON_ORDER` è la barra letta da sinistra a destra e si **ricava** da
`WEAPON_SLOTS`: non va tenuto allineato a mano.

**Magnetismo di mira.** `weapons.assistAim` piega la direzione del cursore di **al massimo
0.09 rad** verso il bersaglio più allineato entro un cono di 0.17 rad, e solo con linea di
tiro libera. I due numeri sono un compromesso scelto con l'utente: senza assistenza si manca
un pedone largo 20 px a 400 px quasi sempre, con un aggancio duro si smette di mirare. Chi è
`hostile` ha la precedenza sul passante che gli sta dietro.

**Dentro un edificio si cambia mondo, non motore.** `game.indoors` è vero quando
`shops.active` esiste. Da lì in poi due indirezioni fanno tutto il lavoro:
`game.area()` restituisce `{ grid, x0, y0, x1, y1 }` — la città oppure la pianta del piano —
e la usano `player.resolveCollisions`, `weapons.rayCast`, `hasLineOfSight` e il rimbalzo degli
esplosivi; `game.peds` viene **scambiato** con l'elenco della gente del piano, così la griglia
dinamica ricostruita ogni frame contiene loro e mischia, raggi, magnetismo di mira e onde
d'urto funzionano senza sapere dove sono. Non c'è un "motore per interni": c'è la stessa
geometria in uno spazio di coordinate diverso, da (0,0) a (w,h) della stanza.

**Le coordinate di un interno non significano niente fuori.** Sono piccole (200-470) e in
città cadono nell'angolo nord-ovest. Perciò tutto quello che vive nel mondo va azzerato al
passaggio della porta: `fx.clear()` e `projectiles.clear()` in `enter`/`leave`/`useStairs`.
Senza il secondo, una mina lasciata in un 노래방 resta armata all'angolo della mappa per il
resto della partita. Per lo stesso motivo `player.update` salta il cambio distretto e la
pendenza quando è dentro, e `main` non conta i chilometri durante lo stacco.

**La camera inquadra la stanza, non il personaggio.** Dentro, `player.cameraTarget(game)`
restituisce il centro del piano e `shops.roomZoom` sceglie lo zoom che ci fa stare tutto:
una camera che scivola dietro al giocatore in uno spazio di 300 px dà solo il mal di mare.
È anche il motivo per cui una prova scriptata può mirare col mouse senza aspettare la camera.

**Un edificio alto è una pila di attività, e si legge da fuori.** `placeShops` decide quante
attività dall'**altezza del volume** (`1 + (h3d-30)/46`, max 4) e `drawBuilding` disegna la
colonna di insegne più il portone sulla facciata del lato giusto. È il modo in cui a Seoul si
capisce cosa c'è al terzo piano, ed è l'unica informazione che il giocatore ha prima di entrare.

**La polizia non ha entità sue.** Un agente è un pedone di `game.peds` con `p.cop = true` e
stato `duty`: `pedestrians.updatePed` gli chiede dove andare a `police.copBehavior` e poi usa
lo stesso steering di tutti gli altri (pendenza, collisioni, sangue, ragdoll: gratis). Una
volante è un veicolo di `game.vehicles` con `driver === 'cop'`: `police.driveCar` scrive solo
`throttle` e `steer`, la fisica la integra `traffic.update` — **quindi `police.update` deve
girare prima di `traffic.update`**, ed è così in `main.update`. Corollario: le volanti hanno
`protect = true`, altrimenti lo streaming del traffico se le porta via a metà inseguimento.

**Il traffico ragiona in spazio libero, non in distanza.** Tutte le soglie di `driveAI` sono
**fra le carrozzerie** (`gap = forward − (len + olen) / 2`), mai fra i centri: due berline che
si toccano hanno i centri a 78 px, quindi una soglia "centro-centro" di 78 px vuol dire
frenare a urto avvenuto. Da lì escono tre regole che vanno lette insieme:
`senseAhead` restituisce un **tetto di velocità** (insegue la velocità di chi sta davanti,
corretta dall'errore di distanza — ridurre invece la velocità desiderata genera onde di
stop-and-go); `boxBlocked` dice se **oltre** l'incrocio c'è posto per tutta la carrozzeria, ed
è la regola che impedisce di tappare la giunzione; la prenotazione d'asse dice **di chi è il
turno**, e vale solo dove non c'è semaforo — dove c'è, il turno lo assegna già la lanterna e
sommarci una prenotazione ferma chi ha il verde. Ognuna di queste, da sola, produce uno stallo:
servono tutte e tre, più il limite di tempo che le sblocca (§5.10).

**Inseguimento senza pathfinding.** A ogni nodo `police.chooseEdge` prende l'arco il cui
estremo lontano è più vicino al bersaglio (greedy, dieci confronti). Su una maglia ortogonale
arriva quasi sempre; quando sbaglia interviene lo stesso anti-incastro del traffico civile
(fermo 1.6 s → retromarcia 0.9 s → `snapToRoad`). Sotto i 460 px, in vista e col giocatore in
auto, si passa allo speronamento diretto. **La riproiezione di `ai.s` al cambio d'arco è
obbligatoria** anche qui: è la trappola già pagata dal traffico.

**Ricercato = heat + livello.** `wanted.heat` accumula i reati, `wanted.level` è la lettura a
stelle (soglie in `LEVEL_HEAT`). Si scende **solo restando invisibili**: `police.spotted`
(pattuglia entro 470/640 px con linea di vista libera, oppure il riflettore addosso) azzera
`unseenT`, e dopo `COOL_TIME[level]` secondi cade una stella. Sotto la prima stella l'heat si
scarica da solo a 0.6/s: abbastanza lento da sommare quattro colpi sparati di fila,
abbastanza veloce da non farti arrivare la volante per una rissa di dieci minuti prima.

**Chiodi e posti di blocco sono `vehicleOnly`.** Le transenne finiscono in `city.solidGrid`
come le scalinate: fermano le ruote, lasciano passare piedi e proiettili. Nascono a runtime,
quindi **vanno tolte** quando il blocco si smonta (`SpatialGrid.removeRect`, aggiunto apposta):
lasciarle dentro significherebbe muri invisibili per il resto della partita. Le strisce
chiodate invece non stanno nella griglia: sono un rettangolo controllato solo contro il mezzo
del giocatore (`police.updateSpikes`), perché il traffico civile che si buca non lo guarda
nessuno e costerebbe un test per veicolo per frame.

**La luce è un velo, non un motore.** Il terreno è fatto di tile da 512 px messi in cache: se
l'illuminazione entrasse nel disegno, ogni minuto di orologio butterebbe via la cache e
ridisegnerebbe la città. Quindi la scena si disegna **sempre a mezzogiorno** e alla fine
(`scene.drawLight`, passo 8) ci passa sopra un velo a schermo intero: una tinta in `multiply`
per l'ora, un velo caldo in `lighter` per alba e tramonto, uno in `overlay` per il bagnato. Ne
segue una cosa da sapere prima di stupirsi: **tutto quello che viene disegnato dopo il velo non
è illuminato** — HUD, mappa e menu stanno fuori apposta, e ci si tingono da soli se serve
(`hud.drawMinimap`, `mapview.drawPanel`). E **dentro un edificio il velo non c'è**: la luce di
un interno è artificiale, un negozio aperto è uguale alle tre di notte e a mezzogiorno. Quello
che cambia è se l'interruttore è acceso, e lo dice l'orario (`floor.openNow`), non il sole.

**Le ombre si muovono a scatti, il rilievo non si muove affatto.** L'ombra di un volume è un
poligono cachato sull'edificio (`b._shadow`): seguirla con continuità vorrebbe dire un hull per
palazzo per frame. La direzione del sole viene quindi arrotondata a una griglia (`SUN_STEP`) e
le ombre si rifanno solo quando scatta la tacca — ogni 30-50 s reali. L'**hillshade** del
terreno e quello della mappa invece restano fermi sul `SUN` fisso di `camera.js`: sono lettura
del rilievo, non ora del giorno, e ruotarli vorrebbe dire invalidare la cache dei tile. Per
questo il vettore d'ombra di `daycycle` vale esattamente `SUN` a mezzogiorno: **il mezzogiorno
è il fotogramma di riferimento**, e da lì la giornata si allontana in avanti e indietro.

**Il vettore dell'ombra si interpola, l'angolo no.** In `KEYS` la luce è `(sx, sy)` = direzione
per lunghezza, non un angolo con una lunghezza a parte. Interpolando l'angolo, al tramonto
l'ombra ruoterebbe all'indietro attraversando tutta la giornata per tornare all'alba;
interpolando il vettore si accorcia fino a sparire e ricompare dall'altra parte, che è quello
che fa il sole quando passa sotto l'orizzonte.

**Il meteo è una catena, non un dado.** `NEXT` in `daycycle.js` dice cosa può venire dopo cosa:
da sereno non si arriva mai direttamente a temporale, il cielo si copre prima. Serve a non
avere un muro d'acqua che compare in due secondi sopra una città col sole. La transizione dura
25 s e `blend` va **da `weather` (0) a `next` (1)**: sbagliarne il verso fa una transizione che
va a ritroso e finisce con uno scatto, ed è un bug che nel sorgente si legge come corretto.

**L'assedio non fa ripartire la città.** Dalla §5.12 la polizia continua a lavorare mentre sei
dentro un negozio, ma non perché `main` abbia tolto il ramo `if (!this.indoors)`: gira
`police.siege`, che è un'altra cosa. Dentro un edificio `game.peds` è **scambiato** con la
gente del piano e `traffic.update` non gira, quindi né gli agenti (che sono pedoni) né le
volanti (la cui fisica la integra il traffico) avrebbero chi li muove: li muove l'assedio, con
uno steering punto-e-velocità senza collisioni e senza griglie. Il giocatore non sta guardando,
e all'uscita `snapToRoad` rimette le volanti in carreggiata. **Il ricercato invece resta
congelato**: se si raffreddasse dentro, la porta diventerebbe il nascondiglio che §5.8 aveva
deciso di non farne.

**Un solo punto di riferimento, `police.focus(game)`.** `prune`, `spawnCar`, `spawnFootCop` e
`updateChopper` leggevano tutti `player.x/y`, e dentro un edificio quelle coordinate sono
quelle della pianta (200-470 px), che in città cadono nell'angolo nord-ovest della mappa.
Ognuno che se ne dimentica manda un'unità a Gimpo: un punto solo da cui passare è l'unica
difesa possibile contro quella trappola.

**Un contatto è un posto, non uno stato.** Il 거래책 di una banda si riconosce con `canDeal`,
che guarda **dov'è** — vivo, non ostile, dentro il suo recinto — e non `state === 'guard'`.
Lo stato sembra più sicuro e chiude il banco al primo spavento: un'auto che accosta, un
tamponamento a due isolati, un allarme lontano. E siccome dai 철마파 ci si arriva **guidando**,
la versione con lo stato si rompeva esattamente nel caso per cui esisteva.

**Il fuoco si esaurisce da solo, il tetto è solo una rete.** Ogni pozza può generarne un'altra,
ma la figlia nasce più corta e più debole della madre (`× 0.62` di vita) e sotto 1,8 s smette
di generare: sono quelle frazioni a spegnere un incendio, non `MAX_FIRES`. Col solo tetto il
fuoco resterebbe acceso al massimo consentito finché c'è asfalto. Serve anche una distanza
minima fra due pozze, o il fuoco si accatasta dov'è invece di camminare — e venti pozze
sovrapposte sono una pozza sola che fa 20× danno.

**Il prezzo di una cosa dipende da dove la compri.** `shops.MARKETS` è una tabella scritta a
mano, sette distretti × quattro categorie più la percentuale di ricompra: un moltiplicatore
casuale sulla seed sarebbe indistinguibile da un prezzo sbagliato, questi si spiegano guardando
il quartiere. I numeri non sono liberi: messi in fila con lo sconto delle bande devono tenere
la catena **in perdita**, o comprare in un posto e rivendere in un altro diventa una zecca.
Quello che il mercato paga davvero è la roba che non hai comprato — raccolte a terra, armi dei
morti, auto rubate.

**L'elicottero vive nella proiezione.** Vola a `z = 210`, quindi a schermo sta dove lo mette
la parallasse, non sopra la sua verticale. Due conseguenze: si colpisce alla posizione
proiettata (c'è un caso apposta in `weapons.rayCast`, ed è l'unico bersaglio che dipende dalla
camera), e la sua raffica **non passa dal raycast** — un raggio radente sul piano si pianterebbe
nel primo palazzo. Tira a stima attorno al bersaglio, e chi resta dentro i 13 px incassa.

**L'audio ha due famiglie, e confonderle è il primo errore.** Un **colpo secco** (`shot`,
`explosion`, `ui`) costruisce due o tre nodi, li programma sull'orologio del contesto e
muore; un **letto continuo** (motore, sirena, pioggia, città) è acceso per sempre e quello
che cambia è il guadagno, scritto ogni frame. Un suono che dipende da uno *stato* e dura più
di mezzo secondo va fatto letto: riaccendere un oscillatore sessanta volte al secondo costa e
fa click. I colpi hanno un tetto (`MAX_VOICES` 24) perché una raffica di minigun dentro un
incendio, con la folla che urla, ne chiederebbe centinaia — e a saltare sarebbe il frame rate.

**L'ascoltatore è la camera, non il giocatore.** Col mirino del fucile di precisione la camera
scivola verso il cursore, e in quel momento quello che si sente deve essere quello che si
vede. Distanza → volume (oltre 1500 px il suono non viene nemmeno costruito), scarto
orizzontale → panning. Dentro un edificio funziona identico senza una riga di casi speciali,
perché le coordinate della pianta e quelle della camera sono le stesse: cambia solo il taglio
dei filtri, che è il muro. Corollario che è già costato un suono muto: **un suono generato
prima di uno `snapTo`** (una porta, un teletrasporto) risulta a mezza Seoul di distanza e
viene scartato — va chiamato dopo, come fa `shops.stepOutside`.

**La radio è l'unica dipendenza di rete, e va trattata come tale.** Tutto il resto del gioco
è deterministico e offline; `radio.js` no. Da qui tre vincoli che valgono per chiunque la
tocchi: non deve **mai** stare sul percorso del boot o di un frame (è tutta asincrona e
tollerante ai fallimenti), non deve **mai** aprire una connessione che nessuno ascolta (si
carica solo in auto o in un locale che ce l'ha) e non deve **mai** fidarsi di un URL (una
stazione che non risponde entro 11 s viene marchiata e saltata). Se un giorno servisse un
secondo pezzo che va in rete, la stessa disciplina o niente.

**Un contesto audio sospeso non è innocuo.** Finché l'utente non tocca qualcosa il browser lo
tiene fermo, e un contesto fermo ha l'orologio fermo: tutto quello che ci si programma dentro
resta in coda e si accumula. Per questo `audio.ready` guarda `ctx.state === 'running'` e non
"l'ho costruito", e finché è falso ogni chiamata di `audio.js` non fa niente.

**Lo spazio è un terzo bus, non una proprietà dei suoni.** Il riverbero (§5.21) è **una
mandata parallela dal solo bus `sfx`**: il secco continua ad arrivare al compressore per conto
suo e il convolutore ci aggiunge il bagnato. Da qui tre conseguenze che vale la pena sapere
prima di toccarlo. La prima: i letti agganciati a `sfx` (motore, sirena, rotore, gomme) ci
passano dentro e **questo è voluto** — un motore che rimbomba in un vicolo è metà dell'effetto;
quelli agganciati a `amb` (pioggia, città, vento, mare) no, e passati per una coda sarebbero
fango. La seconda: **la coda di un `ConvolverNode` non si cambia a caldo**, quindi lo spazio si
commuta come il pezzo musicale — si sfuma il ritorno a zero e solo lì si sostituisce il buffer.
La terza: le quattro risposte all'impulso sono **normalizzate a energia uno**, così i `wet` di
`SPACES` si confrontano fra loro; senza, la durata della coda diventerebbe un volume.

**Una partita si può ricominciare senza ricaricare la pagina.** La città non c'entra: nasce da
una seed fissa e non cambia mai. Quello che ha un ciclo di vita è tutto il resto, e sta in tre
metodi di `Game` (§5.21): `clearWorld` svuota quello che è streaming (traffico, pedoni,
polizia, esplosivi, effetti) lasciando stare velivoli e imbarcazioni, che nascono al boot e non
passerebbero da nessuno; `newGame` ci aggiunge il ripristino di chi ha uno stato — `Player.reset`,
`DayCycle.reset`, `ShopSystem.reset`, `wanted`, `stats` — e ripopola; `toTitle` è `newGame` più
il menu iniziale davanti. **`save.apply` condivide `clearWorld`**: caricare e ricominciare hanno
lo stesso problema, cioè che quello che c'è in strada appartiene a una partita che sta per non
esistere più. E i sistemi si **ripuliscono**, non si ricostruiscono: scena, HUD, polizia e
salvataggio tengono riferimenti diretti al giocatore e ai suoi sistemi.

---
