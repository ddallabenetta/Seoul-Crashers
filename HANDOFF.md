# HANDOFF — Seoul Crashers

Documento per riprendere il lavoro da una sessione pulita. Leggi anche `README.md`
(descrizione del gioco e comandi) — qui c'è quello che serve a *sviluppare*.

Ultimo aggiornamento: fine Fase 2 tappa C (arsenale pesante ed esplosivi) + strumenti,
skill e hook per gli agenti che lavorano al progetto (`.claude/`, §9).

---

## 1. Contesto in una pagina

Web game d'azione top-down 2.5D ambientato a Seoul, stile *GTA: Chinatown Wars*.
Canvas 2D puro, moduli ES nativi, **zero dipendenze, nessun build step**. Tutta la grafica
(sprite, facciate, terreno, mappa) è generata da codice a runtime: non esistono asset esterni.

Stato: **Fase 1, Fase 1.5 e Fase 2 tutta e tre le tappe completate e collaudate**.
10110 righe in 28 moduli. 60 fps con ~50 veicoli e ~93 pedoni attivi (~62 e ~112 a
Myeongdong, il distretto più denso), e restano 60 anche sotto raffica continua di SMG.

La Fase 2 era divisa in tre tappe, concordate con l'utente: **A** combattimento base,
**B** polizia e ricercato a 5 livelli, **C** armi pesanti ed esplosivi. **Sono tutte fatte.**
Il prossimo passo è la Fase 3 (contenuti), §6.

### Avvio

```bash
python3 -m http.server 8123 --directory .     # dalla radice del repo
```

Poi <http://localhost:8123>. Serve un server: i moduli ES non funzionano da `file://`.
In Claude Code esiste già `.claude/launch.json` (config `seoul-crashers`) per `preview_start`.

**Se non hai uno schermo** (agente, sessione remota, CI) il gioco si fa partire e interrogare
headless — è il modo normale di verificare, vedi §9:

```bash
node .claude/tools/probe.mjs --seconds 5 --eval "game.city.stats" --shot /tmp/seoul.png
```

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
`edges 261`, `doglegs 3`, `stairs 8`, e 43 raccolte a terra (`game.pickups.items.length`).
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

Per la caccia (tappa B). `F3` mostra le stesse cose in due righe.

```js
// ricercato: heat, avvistamento, cronometro della fuga
({ stelle: game.wanted.level, heat: Math.round(game.wanted.heat),
   visto: game.wanted.seen, fuga: +game.wanted.unseenT.toFixed(1),
   raffredda: +game.wanted.cooling.toFixed(2) })
// unità in campo e quanto sono lontane
const P = game.police, pl = game.player, d = o => Math.round(Math.hypot(o.x - pl.x, o.y - pl.y));
({ agenti: P.cops.map(d).sort((a,b)=>a-b), volanti: P.cars.map(d).sort((a,b)=>a-b),
   sbarcate: P.cars.filter(v => v.deployed).length,
   blocchi: P.blocks.length, chiodi: P.spikes.length, elicottero: !!P.chopper })
// prova a freddo: cinque stelle di colpo (e poi si torna puliti)
game.wanted.add(200, game);   game.wanted.reset();
```

Valori sani a 5 stelle: `agenti ≤ 16`, `volanti ≤ 6`, `blocchi ≤ 3`, `chiodi ≤ 2`. Se
crescono oltre, è saltato un tetto in `police.reinforce`/`addCop`. Con `stelle 0` deve
tornare tutto a zero entro un paio di secondi (`standDown`).

Per l'arsenale pesante (tappa C):

```js
// cosa c'è in aria, per terra e a fuoco
({ inVolo: game.projectiles.items.length, mine: game.projectiles.mines.length,
   pozze: game.projectiles.fires.length, scoppi: game.stats.blasts })
// arsenale in mano al giocatore
const p = game.player;
({ arma: p.weapon, colpi: p.shots, spin: +p.spin.toFixed(2), mirino: p.scoping,
   armi: [...p.owned], munizioni: p.ammo })
// prova a freddo: tutto l'arsenale addosso
(async () => { const W = await import('/src/entities/weapons.js');
  for (const id of W.WEAPON_ORDER) game.player.giveWeapon(id, 40); })()
```

Con `stelle 0` e nessun esplosivo in giro, `game.projectiles.count` deve essere 0: se resta
qualcosa, un proiettile non è stato rimosso dalla sua lista e continuerà a girare per sempre.

Costo reale della caccia, misurato strumentando il loop: **il tempo di simulazione non
cambia** (0.91 → 0.86 ms per passo), quello di rendering **raddoppia** (3.9 → 6.4 ms per
frame) per sirene, riflettore, traccianti e sangue. Il collo di bottiglia della tappa B è
il disegno, non l'AI.

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
  vehicle.js          fisica arcade, pendenza, collisioni a tre cerchi, gomme a terra
  player.js           a piedi / alla guida, entra-esci, mira, fuoco, salute, morte
  traffic.js          streaming, AI di guida, parcheggi
  pedestrians.js      streaming, marciapiedi, attraversamenti, panico, ostili, ragdoll
  weapons.js          tabella armi, raycast, magnetismo di mira, mischia
  pickups.js          armi/munizioni/kit medici a terra, con ricomparsa
  wanted.js           heat, 5 livelli di ricercato, raffreddamento a vista
  police.js           pattuglie, volanti, sbarchi, posti di blocco, chiodi, SWAT, elicottero
  projectiles.js      esplosivi con proiettili veri: granate, molotov, mine, onda d'urto

src/ui/
  hud.js              minimappa, tachimetro, barra armi, cartello distretto, toast, debug
  mapview.js          mappa a tutto schermo (pannello riusato dal menu)
  menu.js             menu di pausa

.claude/              strumenti per chi sviluppa (non fa parte del gioco), vedi §9
  tools/probe.mjs     avvia il gioco headless, esegue scene, misura, screenshot
  tools/sprite.mjs    guarda uno sprite generato ingrandito
  hooks/              controllo sintassi + briefing di sessione
  skills/             /seoul-verifica /seoul-arma /seoul-sprite /seoul-citta
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

**La polizia non ha entità sue.** Un agente è un pedone di `game.peds` con `p.cop = true` e
stato `duty`: `pedestrians.updatePed` gli chiede dove andare a `police.copBehavior` e poi usa
lo stesso steering di tutti gli altri (pendenza, collisioni, sangue, ragdoll: gratis). Una
volante è un veicolo di `game.vehicles` con `driver === 'cop'`: `police.driveCar` scrive solo
`throttle` e `steer`, la fisica la integra `traffic.update` — **quindi `police.update` deve
girare prima di `traffic.update`**, ed è così in `main.update`. Corollario: le volanti hanno
`protect = true`, altrimenti lo streaming del traffico se le porta via a metà inseguimento.

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

**L'elicottero vive nella proiezione.** Vola a `z = 210`, quindi a schermo sta dove lo mette
la parallasse, non sopra la sua verticale. Due conseguenze: si colpisce alla posizione
proiettata (c'è un caso apposta in `weapons.rayCast`, ed è l'unico bersaglio che dipende dalla
camera), e la sua raffica **non passa dal raycast** — un raggio radente sul piano si pianterebbe
nel primo palazzo. Tira a stima attorno al bersaglio, e chi resta dentro i 13 px incassa.

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
| Quattro colpi sparati in strada non fanno mai una stella | sotto la prima stella l'heat si scaricava a 3/s: ogni sparo evaporava prima del successivo | `wanted.update`, decadimento a 0.6/s |
| Volanti che si accumulano finché il gioco non annaspa | dopo lo sbarco la volante restava "viva" ma non contava come unità in caccia, e ne nasceva un'altra a ogni sbarco | `police.reinforce`: tetto sul **totale**, non sulle sole volanti attive; `addCop` ha il suo |
| Una volante vuota che ti sperona | dopo `deployCrew` la macchina continuava a girare la sua AI | `police.driveCar`, uscita anticipata su `v.deployed` |
| Muri invisibili dove c'era stato un posto di blocco | `SpatialGrid` non aveva rimozione: le transenne restavano nella griglia per sempre | `SpatialGrid.removeRect` + `police.removeBlock` |
| I chiodi non comparivano mai in un inseguimento | si mettevano solo dopo aver piazzato *tutti* i posti di blocco previsti, e uno ogni 7 s | `police.manageObstacles`, blocchi e chiodi si alternano |
| Il protagonista sembra un casco generico | testa grande e centrata sopra un'ellisse: da sopra restava solo una calotta scura | `getHeroSprite`: tronco trapezoidale con spalle larghe, testa piccola spostata avanti, banda rossa lungo la schiena |
| I fari della polizia accecano in pieno giorno | `lightsOn = true` fisso sulle volanti | `police.spawnCar`, `lightsOn = game.isNight` come per il traffico |
| Le icone della barra armi sembrano caselle vuote | le armi sono disegnate quasi nere (`#1a1c20`) su un pannello scuro | `getWeaponIcon` le schiarisce con `source-atop`, che tinge i pixel già disegnati e conserva la sagoma |
| La barra armi finisce sotto il suggerimento «E — sali in…» | il suggerimento è ancorato a `h-62` | barra a `h - CH - 76` in `hud.drawWeaponBar` |
| **In una prova scriptata** il colpo non colpisce mai | `player.angle` a piedi è riscritto ogni frame verso il cursore: impostarlo non serve a niente | si mira muovendo `game.input.mouse.x/y` (vedi §9) |
| **In una prova scriptata** la mira punta altrove dopo un teletrasporto | la camera arriva smorzata, quindi la conversione mondo→schermo di un istante prima non vale più | `game.camera.snapTo(...)` e un decimo di secondo di attesa prima di mirare |
| **In una prova scriptata** un bersaglio appena teletrasportato è immune | `pedGrid`/`vehicleGrid` sono ricostruite a ogni frame: la query lo cerca ancora dov'era | aspettare un frame dopo lo spostamento |

Regola generale emersa: **prima di dare la colpa all'AI, verifica la geometria.** Quasi tutti
gli "stalli dell'AI" erano problemi di ingombri, corsie o posizionamento.

---

## 5. Cosa è stato fatto (Fase 1.5 e Fase 2)

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

### 5.5 Fase 2, tappa B — polizia e ricercato

Le scelte di design che nel piano precedente erano "da concordare" sono state prese qui, e
sono queste (se l'utente ne vuole altre, sono tutte in `wanted.js`, in cima):

- **Cosa alza il livello.** Ogni reato pesa in punti: rissa 1.5 · sparo 3 (al massimo uno
  ogni 0.55 s, altrimenti una raffica di SMG varrebbe cinque stelle in un secondo) · auto
  rubata a un testimone 6, a una pattuglia 12 · agente ferito 12 · veicolo fatto saltare 18 ·
  morto 24 · agente ammazzato 60. Soglie a 10/24/52/92/145. Tradotto: quattro colpi in strada
  = una stella, un cadavere = due, un poliziotto steso = tre (quattro se avevi già scaldato).
  Il furto d'auto è l'unico reato che **vuole un testimone**: rubare un'auto vuota in un
  vicolo non lo denuncia nessuno.
- **Come scende.** Solo non facendosi vedere: `COOL_TIME` va da 7 s (una stella) a 26 s
  (cinque). Un'auto veloce non basta, serve rompere la linea di vista — vicoli, scalinate,
  palazzi. La morte azzera tutto (svegliarsi in ospedale con quattro stelle addosso sarebbe
  una condanna senza uscita); il pay-n-spray arriva in fase 3.
- **Niente arresto.** Il "busted" raddoppierebbe i flussi di fine partita (celle, cauzione,
  arsenale confiscato) per aggiungere poco a una tappa che è già lunga: la polizia spara e
  basta, e la sconfitta resta una sola, l'ospedale. È il primo candidato se si vuole ampliare.
- **Scala delle unità** (`police.TIERS`): 1 → tre agenti a piedi · 2 → due volanti, e
  l'equipaggio scende quando sei a piedi · 3 → speronamenti e colpi dal finestrino · 4 →
  posti di blocco e strisce chiodate · 5 → SWAT con SMG ed elicottero col riflettore.
- **Chiodi.** `flatTires` toglie il 40 % di velocità massima, il 28 % di grip e fa tirare da
  un lato (`flatPull`); i cerchioni fanno scintille (`main.emitSkids`). Non si riparano: si
  cambia macchina.
- **Elicottero.** Orbita largo sopra il giocatore, il riflettore lo insegue **più lento del
  velivolo** — si può uscire dal cono, ed è quello che rende sensato scappare. Abbattibile
  (260 HP): esplode, e ne arriva un altro dopo 40 s.
- **Blip e stelle.** Stelle 수배 sotto il pannello vitale (l'ultima lampeggia mentre stai
  seminando: è l'unico modo che ha il giocatore di sapere che nascondersi funziona), agenti in
  blu su minimappa e anello blu a terra, blocchi e chiodi su minimappa e mappa piena.

### 5.6 Il protagonista

Il vecchio sprite del giocatore era un pedone generico col flag `hero`: da sopra restava una
calotta scura, indistinguibile da un teppista. Ora c'è `getHeroSprite(frame, pose)`, disegnato
apposta e più grande di tutti gli altri (40×34 contro 34×30):

- **tronco trapezoidale** — spalle larghe davanti, vita stretta dietro: è la forma che dice
  "persona, e guarda da quella parte" meglio di qualsiasi dettaglio;
- **banda rossa lungo la spina dorsale**, che a colpo d'occhio è anche una freccia, con
  l'artigliata bianca della tigre (백호, la gang del padre) sopra;
- **testa piccola e spostata in avanti**, con fascia rossa in fronte, ciuffo decolorato,
  rasatura ai lati e un filo di luce sul cranio (senza, la testa nera spariva dentro il
  bomber nero);
- **due pose**: con un'arma da fuoco le braccia si tendono verso il mirino (`pose: 'aim'`),
  altrimenti oscillano. L'arma ora si disegna **sopra** la sagoma, non sotto.
- **ritratto nell'HUD** (`getHeroPortrait`), che pulsa di rosso quando si incassa: è quello che
  dà una faccia al personaggio, visto che a schermo è alto venti pixel.

Le divise hanno avuto lo stesso trattamento minimo ma indispensabile: berretto blu e bretelle
catarifrangenti (`PED_KINDS.cop`), nero opaco e piastra antiproiettile per la SWAT.

### 5.7 Fase 2, tappa C — arsenale pesante ed esplosivi

Sette armi nuove più tre esplosivi, e i tre pezzi di sistema che li reggono (barra armi,
proiettili veri, onda d'urto condivisa). Le scelte di design prese qui — se l'utente ne vuole
altre, cambiare costa poco e i punti sono tutti indicati:

- **Barra armi a sei file** invece di un tasto per arma (§3). L'alternativa scartata era una
  ruota alla GTA V: costa un pannello modale e un input nuovo per risolvere un problema che
  sei file risolvono con i tasti che già c'erano. Sta in `WEAPON_SLOTS`, si riordina in
  trenta secondi.
- **Il fucile di precisione trapassa due bersagli** e col tasto destro **allarga** il campo
  (`scope: 2.3`) invece di stringerlo. Sparato all'anca la dispersione è ×9: senza quel
  malus sarebbe una pistola che uccide in un colpo a 1900 px.
- **La minigun costa mobilità e tempo**: `heavy: 0.56` (si cammina, non si corre) e
  `spinUp: 0.8` s prima del primo colpo, con l'anello del mirino che si chiude a dirlo. È
  l'unico modo di avere 600 colpi senza cancellare il gioco.
- **La pompa** tira otto pallini con `knock: 210`: a due passi stende, a mezzo isolato
  fa il solletico. `pellets` c'era già dalla tappa A e non è stato toccato.
- **Le mine non sono un solido `vehicleOnly`** — il piano della tappa B lo ipotizzava, ma una
  mina che *ferma* un'auto invece di saltare non è una mina. Sono un innesco di prossimità
  (32 px per i veicoli, 18 per chi va a piedi) che **si arma solo quando chi l'ha posata si
  allontana di 62 px**: piazzarne una ai propri piedi e morire non è una meccanica, è un
  incidente. Dall'auto si sgancia dalla coda, che è metà del motivo per averla.
- **La molotov non fa danno d'impatto**: lascia una pozza che brucia 9,5 s a 26 dps, fa
  scappare i pedoni intorno, danneggia anche i veicoli fermi dentro e lascia una bruciatura
  permanente sull'asfalto. La granata invece ha miccia 2,2 s, rimbalza e rotola.
- **Esplosivi ammessi al drive-by** (molotov, granata, mina), fucile d'assalto, sniper e
  minigun no (`driveby: false`): dal finestrino si tiene quello che si tiene con una mano.
- **La SWAT è passata al fucile d'assalto.** Misurato: un giocatore fermo a cinque stelle
  moriva in 10,3 s con la SMG, ora in 8,2 s. È l'escalation che tiene il passo dell'arsenale
  nuovo; se sembra troppo, è una parola in `police.spawnCar`/`spawnFootCop`.
- **Il mirino mostra il raggio dello scoppio** dove cadrà il lancio, e la barra armi dice
  cosa hai e cosa ti manca. Senza questi due, undici armi diventano un menu da imparare a
  memoria.
- Le raccolte a terra ora coprono tutto l'arsenale (`pickups.TABLE`, sniper e minigun rari),
  più una molotov garantita davanti alla safehouse per poter provare la tappa subito.
- **Morte e mine**: `respawnPlayer` chiama `projectiles.clear()`. Senza, ci si sveglia in
  ospedale con il quartiere minato e nessun modo di saperlo.

---

## 6. Backlog successivo (già concordato con l'utente)

**Fase 3 — contenuti.** È il prossimo step, ed è la fase più grossa del progetto: vedi più
sotto. Prima di cominciare **conviene farsi dire dall'utente da dove partire** — missioni,
negozi e ciclo giorno-notte sono tre lavori indipendenti e di taglia molto diversa.

**Cose rimaste indietro dalla tappa C**, in ordine di quanto si sentono:
- **Il fuoco non si propaga**: due molotov vicine fanno due pozze separate, e un'auto che
  brucia non incendia l'asfalto sotto. Propagare vorrebbe dire far generare pozze alle pozze,
  con un tetto duro: senza, mezza Seoul prende fuoco in venti secondi.
- **Nessuno tira esplosivi al giocatore**: la polizia spara e basta. Una granata dallo SWAT
  sarebbe il naturale livello 5 e riuserebbe `throwItem` così com'è.
- **Gli esplosivi non hanno un peso proprio nel ricercato**: lanciare vale come uno sparo
  (`gunshot`), e il resto dell'heat arriva dai morti e dai veicoli distrutti. Se serve, è
  una riga in `wanted.CRIMES`.
- **La minigun non ha un limite di calore**: 600 colpi si sparano tutti di fila.

**Cose rimaste indietro dalla tappa B**, in ordine di quanto si sentono:
- **Arresto (busted)**: oggi la polizia spara e basta, non ti carica in volante. Vedi §5.5.
- **Equipaggio che risale in macchina**: dopo lo sbarco la volante resta ferma per sempre.
- **Commissariati**: nessuna posizione in `city`, le unità nascono sulle strade attorno al
  giocatore. Un `city.stations` calcolato come `city.hospitals` (senza consumare rng, quindi
  senza ridisegnare la città) darebbe blip sulla mappa e un punto di partenza più credibile.
- **Traffico civile e chiodi**: le strisce le controlla solo il mezzo del giocatore.

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
  invisibili nel codice e ovvi a schermo. Chi non ha uno schermo usa `.claude/tools/` (§9),
  che fa le stesse due cose senza mani: far girare il gioco e guardare gli sprite ingranditi.
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
| Danno / cadenza delle armi | `weapons.WEAPONS` | pugni 15·0.34 · mazza 46·0.52 · katana 92·0.4 · pistola 27·0.22 · pompa 13×8·0.84 · SMG 15·0.075 · fucile 24·0.105 · sniper 145·1.35 · minigun 12·0.045 |
| File della barra armi (tasti 1-6) | `weapons.WEAPON_SLOTS` | mischia · pistola · pompa · SMG+fucile · sniper+minigun · esplosivi |
| Perforazione del sniper | `weapons.WEAPONS.sniper.pierce` | 2 bersagli oltre il primo (solo pedoni) |
| Mirino: ingrandimento e scostamento | `sniper.scope`, `player.SCOPE_LEAD/SCOPE_MAX` | 2.3 (zoom 1.12 → 0.49) · 0.5 con tetto 300 px |
| Malus di mira senza mirino | `player.attack` | dispersione × 9 |
| Minigun: spin-up e mobilità | `minigun.spinUp` / `heavy` | 0.8 s · velocità × 0.56 (niente scatto) |
| Esplosivi: raggio e danno | `weapons.WEAPONS` | granata 155 px · 190 · miccia 2.2 s; mina 140 px · 220; molotov pozza 78 px · 9.5 s · 26 dps |
| Danno d'esplosione in auto | `projectiles.explode` | × 0.45 (a piedi 1.0) |
| Volo di un lancio | `projectiles` `GRAV`/`THROW_Z` | 620 px/s² · 150 (gittata = distanza del cursore, max `spec.range`) |
| Innesco della mina | `projectiles.updateMines` | veicolo 32 px · piedi 18 px, si arma a 62 px da chi l'ha posata |
| Tick di danno del fuoco | `projectiles.FIRE_TICK` | 0.34 s |
| Magnetismo di mira | `weapons.ASSIST_WINDOW` / `ASSIST_BEND` | cono 0.17 rad / correzione max 0.09 rad |
| Peggioramento del drive-by | `player.driveBy` | dispersione × 2.4, cadenza × 1.5 |
| Teppista armato: gittata e cadenza | `pedestrians.GUN_RANGE`, case `hostile` | 330 px, un colpo ogni 0.5-1.3 s |
| Salute e tempo a terra | `player.maxHp` / `DEATH_TIME` | 100 / 2.8 s |
| Soglie delle stelle | `wanted.LEVEL_HEAT` | 10 · 24 · 52 · 92 · 145 |
| Peso dei reati | `wanted.CRIMES` | rissa 1.5 · sparo 3 · furto 6/12 · agente ferito 12 · veicolo 18 · morto 24 · agente ucciso 60 |
| Secondi invisibili per perdere una stella | `wanted.COOL_TIME` | 7 · 11 · 15 · 20 · 26 |
| Scarico dell'heat sotto la prima stella | `wanted.update` | 0.6 al secondo |
| Unità per livello | `police.TIERS` | 3 agenti → 2 volanti → speroni → blocchi+chiodi → SWAT+elicottero |
| Vista delle pattuglie | `police.SEE_FOOT` / `SEE_CAR` | 470 / 640 px (con linea di vista libera) |
| Tetti delle unità | `police.MAX_COPS`, `reinforce` | 10 (+6 dai posti di blocco) agenti, `tier.cars + 3` volanti |
| Gittata di fuoco della polizia | `police.COP_FIRE_RANGE` | 340 px |
| Riflettore e quota dell'elicottero | `police.BEAM_R` / `CHOPPER_Z` / `CHOPPER_HP` | 118 px / 210 / 260 |
| Gomme a terra | `vehicle` `flatTires` | velocità × 0.6, grip × 0.72, tiraggio `flatPull` |
| Ritmo di posa di blocchi e chiodi | `police.manageObstacles` | uno ogni 7 s, alternati |
| Raccolte a terra | `pickups` densità / `RESPAWN` | 0.4 per cortile (43 totali) / 55 s |
| Tile terreno | `ground.TILE` / `MAX_TILES` | 512 px / 96 |
| Limite pixel canvas | `main.MAX_PIXELS` | 2.9 M (scala il DPR) |

---

## 9. Strumenti per chi sviluppa (`.claude/`)

Il gioco resta senza dipendenze e senza build step: **niente di quello che c'è qui dentro
viene caricato dalla pagina**. Sono strumenti per chi lavora al progetto — pensati per un
agente che non ha uno schermo, ma comodi anche a mano. Usano `python3` (il server statico) e
il `playwright` già installato globalmente nell'ambiente.

### `tools/probe.mjs` — far girare il gioco e guardarci dentro

Alza un server su una porta libera, apre Chromium headless, aspetta il boot ed esegue quello
che gli chiedi nella pagina. **Esce con codice 1 se la pagina ha sollevato un errore JS o
loggato un `console.error`**, quindi vale come check secco dopo una modifica.

```bash
node .claude/tools/probe.mjs --seconds 5 --eval "game.city.stats"
node .claude/tools/probe.mjs --seconds 6 --shot /tmp/s.png --zoom 2 --clip 420,590,440,110
node .claude/tools/probe.mjs --seconds 3 --script /tmp/scena.js --shot /tmp/scena.png
```

`--script` inietta un file come corpo di funzione **async**: è così che si prepara una scena
(armi addosso, cinque stelle, un lancio) e si aspetta il risultato — il loop continua a
girare mentre lo script attende. Dentro c'è `game`, e si può `await import('/src/...')`.

Le tre trappole delle prove scriptate (mira dal cursore, camera smorzata, griglie ricostruite
ogni frame) sono in §4, in fondo: leggerle prima di dare la colpa al codice.

### `tools/sprite.mjs` — guardare uno sprite ingrandito

```bash
node .claude/tools/sprite.mjs --expr "getHeroSprite(2,'aim')" --scale 8 --out /tmp/hero.png
node .claude/tools/sprite.mjs --expr "WEAPON_IDS.map(getWeaponIcon)" --scale 6 --cols 4
```

Nell'espressione sono in scope tutti gli export di `sprites.js` più `WEAPON_IDS`. Fondo a
scacchi per vedere dove finisce la sagoma, `--bg` per provarla sul colore su cui vivrà
davvero. È la procedura con cui il protagonista è stato rifatto tre volte, automatizzata.

### Hook (`.claude/settings.json` + `hooks/`)

- **PostToolUse su Write/Edit** → `check-js.mjs`: `node --check` sul file toccato (un errore
  di sintassi qui si presenta come "schermata di caricamento ferma", che è il sintomo più
  costoso da diagnosticare), e un promemoria automatico quando si tocca la generazione della
  città (determinismo dell'rng, cache dei tile, `Math.random()` fuori posto).
- **SessionStart** → `session-brief.mjs`: quattro righe di briefing (leggi HANDOFF, i vincoli,
  come si verifica) e un controllo che `python3` e `playwright` ci siano davvero.

### Skill

Quattro, invocabili anche a mano con `/nome`:

| Skill | Quando |
| --- | --- |
| `/seoul-verifica` | dopo aver toccato `src/`, e prima di dire che qualcosa funziona |
| `/seoul-arma` | aggiungere o bilanciare un'arma: i sette punti che devono combaciare |
| `/seoul-sprite` | disegnare o correggere uno sprite generato |
| `/seoul-citta` | toccare la generazione senza rompere il determinismo o il traffico |
