# HANDOFF — Seoul Crashers

Documento per riprendere il lavoro da una sessione pulita. Leggi anche `README.md`
(descrizione del gioco e comandi) — qui c'è quello che serve a *sviluppare*.

Ultimo aggiornamento: fine Fase 2 tappa A (combattimento base, salute e morte).

---

## 1. Contesto in una pagina

Web game d'azione top-down 2.5D ambientato a Seoul, stile *GTA: Chinatown Wars*.
Canvas 2D puro, moduli ES nativi, **zero dipendenze, nessun build step**. Tutta la grafica
(sprite, facciate, terreno, mappa) è generata da codice a runtime: non esistono asset esterni.

Stato: **Fase 1, Fase 1.5 e Fase 2 tappa A completate e collaudate**. 7524 righe in 25
moduli. 60 fps con ~50 veicoli e ~93 pedoni attivi (~62 e ~112 a Myeongdong, il distretto
più denso), e restano 60 anche sotto raffica continua di SMG.

La Fase 2 è divisa in tre tappe, concordate con l'utente: **A** combattimento base (fatta),
**B** polizia e ricercato a 5 livelli, **C** armi pesanti, esplosivi, chiodi e posti di blocco.

### Avvio

```bash
python3 -m http.server 8123 --directory /Users/danieldallabenetta/Documents/seoul_crashers
```

Poi <http://localhost:8123>. Serve un server: i moduli ES non funzionano da `file://`.
In Claude Code esiste già `.claude/launch.json` (config `seoul-crashers`) per `preview_start`.

> **Attenzione alla cache dei moduli.** `python3 -m http.server` non manda `Cache-Control`,
> quindi il browser applica la freschezza euristica: un file toccato giorni fa viene
> considerato valido per giorni e **le modifiche appena fatte non vengono caricate**, nemmeno
> con un reload. Il sintomo è subdolo: la pagina parte, non dà errori, e si comporta come
> prima.
>
> Il rimedio che funziona sempre, da console prima di ricaricare, è forzare la rivalidazione
> di ogni modulo e poi ricaricare (`cache: 'reload'` aggiorna anche la voce in cache, cosa che
> `location.reload()` non fa):
>
> ```js
> const files = [...document.querySelectorAll('script[src]')].map(s => s.src);
> // oppure l'elenco completo dei moduli; poi:
> await Promise.all(files.map(f => fetch(f, { cache: 'reload' })));
> location.reload();
> ```
>
> Scorciatoia una tantum: cambiare origine (`http://127.0.0.1:8123` invece di `localhost`) dà
> una cache vergine. Vale però solo per il primo giro — i file toccati **dopo** quel caricamento
> tornano a restare indietro. Non provare `127.0.0.2`: su macOS quell'alias di loopback non
> esiste e la richiesta resta appesa.

### Verifica rapida che tutto giri

`F3` in gioco mostra fps, entità, posizione. Da console del browser è esposto `window.game`:

```js
// stato del traffico: se "move" crolla e "stop" sale, c'è una regressione negli ingorghi
const ai = game.vehicles.filter(v => v.driver === 'ai');
const sp = ai.map(v => Math.abs(v.speed)).sort((a, b) => a - b);
({ fps: game.loop.fps, n: ai.length,
   stop: sp.filter(s => s < 8).length, move: sp.filter(s => s > 25).length,
   med: Math.round(sp[sp.length >> 1]),
   why: ai.filter(v => Math.abs(v.speed) < 8).reduce((a, v) => (a[v.ai.why] = (a[v.ai.why]||0)+1, a), {}) })
```

`ai.why` vale `incrocio` / `coda` / `curva` / `libero`. **`libero` su un veicolo fermo
significa che è bloccato fisicamente**: è il sintomo da inseguire.

Valori sani a regime: `fps 60`, `n ~49`, `move 31-35`, `stop < 15`, `med 46-58`, `libero ≤ 2`.
(`med` oscilla parecchio: dipende da quanto traffico si trova in salita in quel momento.)

**Aspetta almeno 90 s prima di dare un giudizio.** Il `prewarm` immette 72 auto anche in
campo visivo e ne ammassa qualcuna sull'incrocio di partenza: se il giocatore resta fermo lì
il grumo non viene mai despawnato (`hopeless` richiede `outsideView`) e ci mette ~1 minuto a
sciogliersi da solo. Fino ad allora si legge `stop 16-21` e `libero 5-7` senza che ci sia
niente di rotto.

`med` è sceso da ~60 stabile a ~46-58 **per via della pendenza**, non per una regressione: è verificabile
in due minuti spegnendola a caldo e riconfrontando (con la quota a zero si torna a `med 58`,
`move 33`).

```js
window._elev = game.city.elevationAt; game.city.elevationAt = () => 0; // A/B: pendenza off
game.city.elevationAt = window._elev;                                  // ripristino
```

Dopo aver toccato la generazione, controlla anche la salute della maglia:

```js
// vicoli ciechi veri: devono essere 0-2 e solo sul bordo mappa (x o y ≈ 188)
game.city.graph.usableNodes.filter(n => n.out.length === 1).map(n => [n.x | 0, n.y | 0])
// quanta strada è stata tolta dai superblocchi, e quanti disassamenti sono nati
game.city.stats // { buildings, props, blocks, nodes, edges, doglegs, stairs }
```

Valori attesi con la seed attuale: `buildings 424`, `props 796`, `blocks 119`, `nodes 179`,
`edges 261`, `doglegs 3`, `stairs 8`, e 42 raccolte a terra (`game.pickups.items.length`).
I primi sei devono restare **identici** finché non si tocca l'ordine di consumo dell'rng in
generazione: se cambiano, hai spostato una `rng.*` e la città non è più quella collaudata.

Per il combattimento:

```js
// stato del giocatore
const p = game.player;
({ hp: p.hp, arma: p.weapon, colpi: p.shots, armi: [...p.owned], morente: p.dying })
// chi ce l'ha con te, e quanti cadaveri restano in giro
({ ostili: game.peds.filter(q => q.hostile).length,
   cadaveri: game.peds.filter(q => q.dead).length,
   sangue: game.fx.decals.filter(d => d.type === 'blood').length })
```

---

## 2. Mappa dei file

```
index.html            schermata di caricamento + canvas
src/main.js           classe Game: boot, loop, callback del mondo, statistiche

src/core/
  loop.js             passo fisso 1/60 con accumulatore, render libero
  input.js            tastiera/mouse, stato continuo + fronti (wasPressed)
  math.js             angoli, damp, circleRectPush, pointSegment, KMH, PX_PER_M
  rng.js              mulberry32 deterministico (stessa seed = stessa Seoul)
  spatial.js          SpatialGrid (statica) e DynamicGrid (ricostruita ogni frame)

src/world/
  districts.js        i 5 distretti (con i parametri di maglia), RIVER, NAMSAN, insegne
  citygen.js          quota del terreno, maglia stradale, isolati, edifici, props, indici
  roadgraph.js        nodi/archi, corsie, semafori, prenotazione incrocio
  maptexture.js       texture 1100×1100 della mappa, con hillshade (minimappa + mappa piena)

src/render/
  camera.js           camera 2.5D, PROJ, SUN, applyUI (DPR), shake, bounds
  sprites.js          VEHICLE_TYPES, PED_KINDS, sprite generati e cache
  facades.js          texture facciate (overlay), gradienti, insegne
  ground.js           GroundRenderer: tile 512 px con cache LRU + hillshade
  scene.js            pass di rendering, estrusione, ordinamento radiale
  fx.js               decals (gomma, sangue, bruciature) e particelle

src/entities/
  vehicle.js          fisica arcade, pendenza, collisioni a tre cerchi
  player.js           a piedi / alla guida, entra-esci, mira, fuoco, salute, morte
  traffic.js          streaming, AI di guida, parcheggi
  pedestrians.js      streaming, marciapiedi, attraversamenti, panico, ostili, ragdoll
  weapons.js          tabella armi, raycast, magnetismo di mira, mischia
  pickups.js          armi/munizioni/kit medici a terra, con ricomparsa

src/ui/
  hud.js              minimappa, tachimetro, cartello distretto, toast, debug
  mapview.js          mappa a tutto schermo (pannello riusato dal menu)
  menu.js             menu di pausa
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

**Streaming.** Veicoli e pedoni compaiono **fuori dal rettangolo inquadrato** (`outsideView`)
e si dissolvono oltre `ring.despawn`. Il `prewarm` al boot è l'unico che può generare in
campo visivo.

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
gittata un proiettile vero arriverebbe comunque nello stesso frame; serviranno davvero solo
per gli esplosivi della tappa C.

**Magnetismo di mira.** `weapons.assistAim` piega la direzione del cursore di **al massimo
0.09 rad** verso il bersaglio più allineato entro un cono di 0.17 rad, e solo con linea di
tiro libera. I due numeri sono un compromesso scelto con l'utente: senza assistenza si manca
un pedone largo 20 px a 400 px quasi sempre, con un aggancio duro si smette di mirare. Chi è
`hostile` ha la precedenza sul passante che gli sta dietro.

---

## 4. Trappole già pagate — non reintrodurle

Ognuno di questi è costato una sessione di diagnosi. Sono tutti risolti; il commento nel
codice spiega il perché nel punto giusto.

| Sintomo | Causa | Dove |
| --- | --- | --- |
| L'auto accelera lentissima (22 km/h dopo 3 s) | `speed` riproiettato dal vettore velocità ogni frame: si sottraeva il ritardo del grip a ogni passo | `vehicle.js`, guardia `v._hit` |
| Auto ammassate e girate a caso agli incroci | rimbalzo elastico costante + torque alto, sommati su 9 coppie di cerchi | `applyImpact` (restituzione in funzione dell'urto), risoluzione della sola coppia più compenetrata |
| Metà del traffico fermo con gas a tavoletta e "libero" | al cambio arco `ai.s` non veniva riproiettato: il waypoint finiva fuori strada e l'auto si piantava, e il ramo di recupero saltava car-following e anti-ingorgo | `traffic.driveAI`, `projectS()` |
| Traffico che si congela progressivamente | incroci senza semaforo senza regole di precedenza | `roadgraph` `claimAxis/claimT` + prenotazione in `driveAI` |
| Auto che tagliano la curva e finiscono nel muro | velocità in svolta troppo alta | `driveAI`, target 64 e anticipo 175 px |
| Arredo urbano in mezzo alla carreggiata | `decorateBlockEdges` posizionava i props *fuori* dall'isolato: il marciapiede è la fascia **interna** | `citygen.decorateBlockEdges` |
| Auto parcheggiate intrappolate | i cortili perimetrali erano chiusi su quattro lati | vicoli in `fillUrbanArea` + `collectParkingSpots` accetta solo aree raggiungibili |
| Nessuna insegna visibile | dimensioni calcolate in spazio texture (anisotropo 64×160) invece che in pixel di mondo | `scene.drawBuilding`, blocco insegne |
| Lampione deformato in un bastone | lo sprite veniva stirato lungo il vettore di proiezione, lampada compresa | `scene.drawProp`, palo disegnato a mano |
| Pedoni investiti a raffica | camminavano a 10 px dal cordolo e attraversavano senza guardare | `sidewalkPoint` (0.78 × SIDEWALK) + `crossingIsSafe` |
| Traffico che appare solo lontano | spawn con anello circolare su archi scelti a caso in tutta la città | `graph.edgesNear` + `outsideView` |
| Un isolato = un solo scatolone | i lotti "da manuale" del distretto (62–130 px) ci stanno una volta sola in un isolato da 130 px | `fillUrbanArea`, helper `lot(span)` che rapporta i lotti all'isolato |
| Auto ferme al semaforo che rotolano all'indietro | la gravità della pendenza applicata anche da fermo e senza gas | `updateVehicle`, guardia `speed > 3 \|\| throttle` |
| Vicoli ciechi ovunque dopo i superblocchi | un tratto che finisce dove la trasversale è stata tolta: l'AI ci fa inversioni a U | `citygen.trimDeadEnds` + lungofiume promossi ad arterie |
| Hillshade invisibile sull'asfalto | `soft-light` non morde su colori molto scuri (#34373d) | `ground.drawRelief` usa `overlay`; la mappa, che è chiara, usa `soft-light` |
| Modifiche che "non fanno niente" | cache euristica del browser sui moduli ES (vedi §1) | cambiare origine: `127.0.0.1` invece di `localhost` |
| Teppista armato che non spara mai e avanza al rallentatore | teneva la distanza di tiro anche **senza** linea di tiro: restava a mirare un muro | `pedestrians` case `hostile`, `los` calcolata ogni frame: senza LOS corre a chiudere |
| Un tap secco del mouse non spara con le automatiche | `mouse.down` è già tornato false se click e rilascio cadono nello stesso frame | `player`, il fuoco guarda `mouse.pressed \|\| (auto && mouse.down)` |

Regola generale emersa: **prima di dare la colpa all'AI, verifica la geometria.** Quasi tutti
gli "stalli dell'AI" erano problemi di ingombri, corsie o posizionamento.

---

## 5. Cosa è stato fatto (Fase 1.5 e Fase 2 tappa A)

### 5.1 Urbanistica dinamica

- **Passo variabile per distretto** (`DISTRICTS[].grid.step`, `citygen.meshAt`). Il passo
  globale di una linea segue il distretto **più fitto** che attraversa, non la media: una
  maglia fitta si può diradare togliendo tratti, una larga non si può infittire a posteriori.
  Gangnam e i moli diventano larghi grazie ai superblocchi, non al passo.
- **Superblocchi** (`DISTRICTS[].grid.superblock`, `citygen.carveMesh`). Probabilità per
  cella, campionata sul distretto della cella. Oggi vengono tolti ~30 % dei tratti verticali
  e ~20 % di quelli orizzontali.
- **Disassamenti** (`DISTRICTS[].grid.jog`, `citygen.planDoglegs`). Costano poco perché
  riusano `on[]`, ma **ne nascono solo 2-4 su tutta la mappa**: servono ~230 px di varco per
  lasciare due isolati decenti ai lati della gemella, e con la maglia fitta pochi varchi ce
  la fanno. Se ne vuoi di più, l'unica leva vera è `MIN_BLOCK` in `planDoglegs`.
  Il ritaglio stretto che la gemella lascia di fianco a sé **non è uno scarto**: diventa una
  fila di negozi lunga e bassa (il marciapiede si assottiglia, `pad` in `fillUrbanBlock`), che
  è esattamente come si legge un 상가 dall'alto. Solo sotto i 64 px diventa un fazzoletto verde.
- **Vicoli passanti** (골목). Un isolato più largo di 320 px viene tagliato da una fessura di
  asfalto da 38-54 px: non è una strada del grafo, è un `yard`. Spezza il blocco unico e si
  vede benissimo dall'alto, senza toccare grafo né collisioni.
- **Lungofiume promossi ad arterie.** Le due strade che costeggiano il Han sono continue per
  definizione: autentico, e impedisce alle arterie verticali di finire cieche sull'argine.
- **`trimDeadEnds`** accorcia i tratti che finirebbero dove non passa nessuna trasversale.
  Restano ciechi solo i monconi verso il bordo mappa, dove c'è la cintura invalicabile.

### 5.2 Rilievo

- **`city.elevationAt(x, y)`** (`citygen.makeElevation`): il Han è quota zero, il terreno sale
  allontanandosene (~34), due ottave di value-noise danno il rilievo locale (±23 e ±8), il
  Namsan è una cupola da 110. Deterministico dalla seed, nessuna allocazione.
- **Hillshade** nel tile del terreno (`ground.drawRelief`) e nella texture della mappa
  (`maptexture.drawRelief`): un versante che sale verso il sole si schiarisce. Il
  campionamento è a bassa risoluzione (33×33 per tile) e ingrandito con interpolazione;
  **l'offset di mezzo passo in `drawImage` è quello che fa combaciare i tile adiacenti**,
  senza si vede uno scalino sulle giunzioni.
- **Volumi più alti in quota**: `scene.projHeight(b) = b.h3d + b.elev`, usato sia
  nell'estrusione sia in `buildingShadow` (che è cachata: se le due divergono, ombra e volume
  si staccano). `b.elev` è calcolato una volta in generazione; muri, argini e cintura hanno
  `flat: true` e restano a zero perché il loro centro non significa niente.
- **Fisica della pendenza** in `updateVehicle` (`SLOPE_G = 780`, pendenza limitata a 0.14) e,
  più leggera, su pedoni e giocatore a piedi. Misurato su una pendenza del 20 % (Namsan), a
  tutto gas dopo 1 s: **90 px/s in salita, 179 in piano, 268 in discesa**; in folle, in salita
  ci si ferma in due secondi. È anche il motivo per cui la velocità mediana del traffico è
  scesa da ~60 a ~46-58: le auto in salita vanno davvero più piano.

### 5.3 Cosa è rimasto fuori dall'urbanistica, e perché

**Piazze e rotonde** (richiedono archi curvi nel grafo) e **isolati non rettangolari**
(footprint poligonali: collisioni e facciate tutte diverse). Erano già marcati come
rimandabili nel piano precedente e non è cambiato niente che li renda più facili.

### 5.4 Fase 2, tappa A — combattimento base

Le quattro scelte di design sono state decise con l'utente prima di scrivere codice:
combattimento prima del ricercato, **mira libera col mouse più magnetismo**, morte con
**risveglio all'ospedale e perdita dell'arsenale**, **drive-by solo con le armi leggere**.

- **Scalinate (계단)** (`citygen`, sezione "Scalinate"). Una scalinata non è geometria nuova:
  è un **vicolo passante** (`yard.through`) la cui pendenza supera `STAIR_GRADE`, più un solido
  `vehicleOnly` sopra. Sono candidati solo i vicoli `through` — quelli di cortile (`block.alleys`)
  portano ai parcheggi, e murarli lascerebbe le auto in sosta senza uscita.
  **Ne escono 8, e il tetto è 14**: tanti sono i vicoli passanti in tutta la città. Il collo di
  bottiglia non è la pendenza, è il numero di varchi: per averne di più bisogna toccare
  `fillUrbanBlock`, che consuma rng diverso e **ridisegna tutta la città**. Ne vale la pena solo
  se si accetta di rifare la messa a punto del traffico.
- **Armi** (`weapons.js`). Pugni e mazza (mischia a cono), pistola e SMG (raycast). La tabella
  `WEAPONS` tiene danno, cadenza, dispersione, gittata e scorta massima. La mischia colpisce il
  primo pedone nel cono, e se non c'è nessuno prende a mazzate la carrozzeria.
- **Mira col mouse.** A piedi il personaggio **guarda sempre il cursore** e cammina di lato:
  è metà del combattimento in una visuale dall'alto. Il mirino lo disegna l'HUD (`cursor: none`
  sul canvas, il cursore di sistema torna solo nei menu).
- **Drive-by.** Solo pistola e SMG, cadenza × 1.5 e dispersione × 2.4 che peggiora con la
  velocità. Il proprio veicolo è escluso dal raycast (`ignoreVehicle`), altrimenti si spara sul
  proprio cofano.
- **Salute e morte.** 100 HP, vignettatura rossa sui colpi e pulsante sotto il 30 %, schermata
  `사망` e dopo 2.8 s risveglio all'ospedale del distretto più vicino: HP pieni, **arsenale
  perso** (restano i pugni). Un ospedale per distretto, sul marciapiede dell'isolato grande più
  vicino al centro, con la croce dipinta a terra e il blip su minimappa e mappa.
- **Pedoni che reagiscono.** Ogni sparo chiama `game.alarm`: chi è nel raggio scappa, e i
  teppisti vicini al giocatore diventano `hostile`. Un ostile armato tiene la distanza di tiro
  se ha la linea libera, altrimenti corre a chiuderla; uno disarmato carica e mena. Gli ostili
  hanno un anello rosso sotto i piedi e un puntino sulla minimappa — nella folla un teppista in
  nero è identico a un passante finché non spara.
- **Tono crudo.** Schizzo di sangue nella direzione del colpo, pozza persistente, scia mentre
  il ferito scappa, ragdoll che scivola e gira. L'esplosione di un veicolo fa danno in un
  raggio di 100 px a pedoni e giocatore.
- **Raccolte a terra** (`pickups.js`). 42 in tutta la città nei cortili e nei vicoli, più due
  garantite davanti alla safehouse; ricompaiono dopo 55 s. Senza negozi (fase 3) sono l'unico
  rifornimento, quindi non possono sparire per sempre.

---

## 6. Backlog successivo (già concordato con l'utente)

**Fase 2, tappa B — polizia e ricercato.** È il prossimo step.
Sistema di ricercato a 5 livelli: 1 pattuglia a piedi · 2 volanti · 3 speronamenti · 4 posti
di blocco e chiodi · 5 SWAT ed elicottero con riflettore. Il wanted cala nascondendosi (e in
fase 3 al pay-n-spray).
Quello che c'è già e va riusato: il flag `vehicleOnly` (chiodi e posti di blocco sono la stessa
cosa delle scalinate), `game.alarm` per far scattare il livello, `p.hostile` come modello di
nemico che insegue e spara, `getVehicleSprite` con `police` e `swat`, `PED_KINDS.cop` (75 HP,
`fights: true`, già armabile), il campo `siren` sui veicoli con i lampeggianti resi in
`scene.drawVehicle`, e i blip della polizia già disegnati da minimappa e mappa.
I tre ponti sul Han sono passaggi obbligati: sono il posto giusto per i blocchi stradali.
Da decidere con l'utente prima di implementare: cosa fa salire il livello (pedone investito?
sparo in strada? auto rubata a vista?) e come scende (tempo fuori vista, o un raggio in cui
nessuno ti vede).

**Fase 2, tappa C — arsenale pesante.**
Katana, pompa, fucile d'assalto, sniper, minigun, molotov, granate e mine. Gli esplosivi sono
gli unici che vogliono **proiettili veri** invece del raycast: vanno aggiunti come entità con
posizione e velocità, e fanno danno ad area come già fa l'esplosione di un veicolo.

**Fase 3 — contenuti.**
12 missioni in 3 atti con cutscene a **pannelli a fumetto**; negozi (armi, garage,
ospedale/pay-n-spray) — l'ospedale ha già posizione, piazzola e blip in `city.hospitals`, va
solo reso un posto dove si entra e si paga; mercato nero dinamico con prezzi per distretto; attività secondarie
(taxi, consegne, salti); ciclo giorno-notte e meteo (`game.isNight` è già consultato da
lampioni, fari e insegne); audio procedurale WebAudio (`game.audio` è già chiamato con
optional chaining: `honk`, `doorClose`); salvataggio localStorage con 3 slot.

## 7. Vincoli e convenzioni

- **Nessuna dipendenza, nessun build step.** Niente npm, niente bundler, niente CDN.
- **Nessun asset esterno**: se serve grafica nuova, si genera con path su canvas offscreen e
  si mette in cache (vedi `sprites.js`).
- **Commenti in italiano**, e solo dove spiegano un *perché* non ovvio. Il codice esistente ha
  una densità di commenti bassa e mirata: mantienila.
- **Italiano per UI e testi di gioco, hangul per insegne e toponimi.**
- **Determinismo**: la città nasce da `new Rng(20260730)`. Non usare `Math.random()` in
  generazione (va bene solo negli effetti a runtime). Attenzione: **qualunque `rng` in più
  consumato in generazione ridisegna tutta la città a valle**, quindi non spaventarti se una
  modifica minima cambia il conteggio di edifici — confronta gli ordini di grandezza, non i
  numeri esatti.
- **Verifica davvero.** Ogni modifica va provata nel browser, non solo "compilata": screenshot
  per la grafica, snippet della sezione 1 per il traffico. Diversi bug di queste fasi erano
  invisibili nel codice e ovvi a schermo.
- **Consegne a tappe**: l'utente vuole provare ogni fase prima della successiva, ed essere
  consultato sulle scelte di design invece di trovarsele fatte.

## 8. Parametri da conoscere per la messa a punto

| Cosa | Dove | Valore attuale |
| --- | --- | --- |
| Dimensione mondo | `citygen.WORLD` | 4200 × 4200, margine 150 |
| Passo della maglia | `districts.DISTRICTS[].grid.step` | 126–196 (Hongdae) … 330–480 (moli) |
| Superblocchi / disassamenti | `districts.DISTRICTS[].grid` | `superblock` 0.20→0.60, `jog` 0.08→0.62 |
| Isolato minimo ai lati di un dogleg | `citygen.planDoglegs` | `MIN_BLOCK` 62 |
| Ritaglio che diventa parco | `citygen.generateCity` | lato < 64 px (sopra: fila di negozi) |
| Vicolo passante | `citygen.fillUrbanBlock` | isolati > 320 px, fessura 38–54 |
| Quota: pianura / Namsan | `citygen.makeElevation` | 34 + rumore ±31 / +110 |
| Forza dell'ombreggiatura | `ground.RELIEF_SLOPE` / ampiezza | 0.062 / ±44 (mappa: 0.07 / ±58) |
| Gravità in pendenza | `vehicle.SLOPE_G` / `MAX_SLOPE` | 780 / 0.14 |
| Forza della parallasse | `camera.PROJ` | 880 (più basso = più estrusione) |
| Direzione/lunghezza ombre | `camera.SUN` | 0.5 / 0.66, scala 0.42 |
| Larghezza carreggiate | `citygen.genLines` | boulevard 144, strada 76 |
| Corsie | `roadgraph.laneOffset` | 18/54 (boulevard), 19 (strada) |
| Traffico attivo | `traffic.MAX_TRAFFIC` | 54 (× densità distretto) |
| Auto in sosta | `traffic.MAX_PARKED` | 24 |
| Pedoni | `pedestrians.BASE_MAX` | 62 (× densità distretto) |
| Pendenza minima per una scalinata | `citygen.STAIR_GRADE` | 0.018 (→ 8 scalinate su 14 vicoli passanti) |
| Danno / cadenza delle armi | `weapons.WEAPONS` | pugni 15·0.34 · mazza 46·0.52 · pistola 27·0.22 · SMG 15·0.075 |
| Magnetismo di mira | `weapons.ASSIST_WINDOW` / `ASSIST_BEND` | cono 0.17 rad / correzione max 0.09 rad |
| Peggioramento del drive-by | `player.driveBy` | dispersione × 2.4, cadenza × 1.5 |
| Teppista armato: gittata e cadenza | `pedestrians.GUN_RANGE`, case `hostile` | 330 px, un colpo ogni 0.5-1.3 s |
| Salute e tempo a terra | `player.maxHp` / `DEATH_TIME` | 100 / 2.8 s |
| Raccolte a terra | `pickups` densità / `RESPAWN` | 0.4 per cortile (42 totali) / 55 s |
| Tile terreno | `ground.TILE` / `MAX_TILES` | 512 px / 96 |
| Limite pixel canvas | `main.MAX_PIXELS` | 2.9 M (scala il DPR) |
