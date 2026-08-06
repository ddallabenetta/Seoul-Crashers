# HANDOFF — Seoul Crashers

Documento per riprendere il lavoro da una sessione pulita. Leggi anche `README.md`
(descrizione del gioco e comandi) — qui c'è quello che serve a *sviluppare*.

Ultimo aggiornamento: **giro di arretrati** (§5.12) — diciannove punti che il §6 si portava
dietro da quattro fasi, chiusi in un colpo: la polizia assedia la porta di un negozio, i
pedoni si riparano dalla pioggia, il fuoco si propaga, le bande commerciano, i prezzi cambiano
da quartiere a quartiere, si dorme per far passare la notte. Prima c'erano il ciclo
giorno-notte (§5.11), il traffico (§5.10), la mappa (§5.9), i negozi (§5.8) e la Fase 2 tappa C.

> 📌 **Da concordare con l'utente prima di scrivere codice:** della Fase 3 restano le
> **missioni**, che sono il lavoro grosso e pieno di scelte di design (quante, come si
> attivano, cutscene a fumetti, fallimento e ripetizione). L'utente vuole essere consultato
> invece di trovarsele fatte (§7): **chiediglielo in apertura di sessione.** Adesso il §6 è
> corto: gli arretrati grossi sono stati pagati, e quello che resta è quasi tutto materia
> della storia o roba che si nota poco.

---

## 1. Contesto in una pagina

Web game d'azione top-down 2.5D ambientato a Seoul, stile *GTA: Chinatown Wars*.
Canvas 2D puro, moduli ES nativi, **zero dipendenze, nessun build step**. Tutta la grafica
(sprite, facciate, terreno, mappa) è generata da codice a runtime: non esistono asset esterni.

Stato: **Fase 1, Fase 1.5, Fase 2 (tutte e tre le tappe) e le prime tre tappe della Fase 3
completate e collaudate**, più la revisione della guida AI del traffico (§5.10) e il giro di
arretrati del §5.12. ~17.600 righe in 33 moduli. 60 fps con ~44 veicoli e ~93 pedoni attivi, e restano 60 anche sotto raffica
continua di SMG. Dentro un edificio il costo è trascurabile: la città non gira. Il ciclo
giorno-notte costa **1,5 ms di JS per frame nel caso peggiore** (notte con temporale) — ma i
veli a schermo intero non sono misurabili onestamente in headless, vedi l'avvertenza in §5.11.

**Seoul ha un'ora e un tempo.** L'orologio gira sempre (24 minuti reali = 24 ore, anche dentro
un negozio), la luce cambia con l'ora, il cielo passa da sereno a temporale e viceversa, e i
locali hanno un orario di apertura. Non è una decorazione: di notte la polizia vede meno lontano,
sotto l'acqua si frena peggio, e alle tre del mattino l'unica insegna accesa è quella del 편의점.

**Il mondo è 5400×5400 e la città non lo riempie: ha una sagoma.** A ovest il mare, con
l'aeroporto di Gimpo e il porto di Incheon sulla costa e la campagna in mezzo; a est, nord e
sud le colline. Si vola (elicottero, turboelica) e si naviga (motoscafo, battello); in acqua
si annega e le auto affondano. Sei territori di bande occupano cortili, piazzali e capannoni.

La Fase 2 era divisa in tre tappe, concordate con l'utente: **A** combattimento base,
**B** polizia e ricercato a 5 livelli, **C** armi pesanti ed esplosivi. **Sono tutte fatte.**
La Fase 3 (contenuti) è cominciata da **negozi e interni** (§5.8), poi la mappa (§5.9) e il
ciclo giorno-notte (§5.11); il §5.12 ha chiuso gli arretrati. **Restano le missioni**, §6.

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
// stato del traffico, istantanea
const ai = game.vehicles.filter(v => v.driver === 'ai');
const sp = ai.map(v => Math.abs(v.speed)).sort((a, b) => a - b);
({ fps: game.loop.fps, n: ai.length,
   stop: sp.filter(s => s < 8).length, move: sp.filter(s => s > 25).length,
   med: Math.round(sp[sp.length >> 1]),
   why: ai.filter(v => Math.abs(v.speed) < 8).reduce((a, v) => (a[v.ai.why] = (a[v.ai.why]||0)+1, a), {}) })
```

`ai.why` vale `incrocio` (aspetta il verde, il turno o che si liberi l'uscita) / `coda`
(incolonnato) / `curva` / `sblocco` (sta forzando un incastro, §5.10) / `libero`. **`libero`
su un veicolo fermo significa che è bloccato fisicamente**: è il sintomo da inseguire.

> ⚠️ **Questa istantanea non è più un giudizio sul traffico.** Da quando le auto tengono una
> distanza di sicurezza vera (§5.10) si fermano ai semafori e si incolonnano *per progetto*:
> `stop 20-30` su 44 veicoli è normale, e prima del §5.10 era `stop 3-6` solo perché le auto
> si attraversavano a vicenda. Quello che conta è **quanta strada fanno**, e per misurarlo c'è
> `.claude/tools/scenes/traffic-census.scene` (§9): urti al minuto, tipo di urto e px percorsi
> al minuto per veicolo, su cinque zone diverse.
>
> ```bash
> node .claude/tools/probe.mjs --seconds 0 --quiet \
>   --script .claude/tools/scenes/traffic-census.scene
> ```
>
> Valori di riferimento (Chromium headless in container, 170 s su 5 zone), misurati fianco a
> fianco con `git worktree add /tmp/base origin/main`:
>
> | | `main` prima del §5.10 | adesso |
> | --- | --- | --- |
> | urti al minuto | 235–266 | **36–40** |
> | di cui tamponamenti (su 170 s) | 358–414 | 6–8 |
> | flusso mediano (px/min per veicolo) | 4047–4245 | 3450–3811 |
> | veicoli praticamente fermi | 0–5 su ~230 | 11–12 su ~190 |
>
> **I numeri assoluti dipendono dalla macchina: si confrontano solo fianco a fianco**, e sono
> intervalli su due esecuzioni perché questa scena cambia zona a tempo di orologio, non di
> simulazione: sotto carico diverso i teletrasporti cadono in istanti diversi. Gli ordini di
> grandezza però sono stabili — una differenza del 10% non significa niente, una del 200% sì.
> **Misurato apposta in §5.12: due esecuzioni della stessa identica configurazione si scostano
> del ~7% sul flusso e del doppio sui veicoli fermi.** È la soglia sotto cui non c'è niente da
> leggere, ed è già bastata una volta a far sembrare un risultato quello che era rumore.
> Attenzione anche a un'altra cosa: **qualunque** modifica alla guida sposta le traiettorie e
> quindi cambia lo scenario, ed è per questo che si misura su cinque zone e non su una (su una
> sola il conteggio dei veicoli fermi salta da 0 a 10 senza che la legge di guida sia cambiata
> in meglio o in peggio — ci ho perso mezza sessione).

**Aspetta almeno 90 s prima di dare un giudizio.** Il `prewarm` immette 72 auto anche in
campo visivo: se il giocatore resta fermo lì il grumo non viene mai despawnato (`hopeless`
richiede `outsideView`) e ci mette ~1 minuto a diradarsi.

`med` oscilla parecchio: dipende da quanto traffico si trova in salita — e da quanto se ne
trova sulle provinciali di campagna, dove si viaggia molto più veloci. La pendenza da sola
vale ~15 px/s di mediana, ed è verificabile spegnendola a caldo:

```js
window._elev = game.city.elevationAt; game.city.elevationAt = () => 0; // A/B: pendenza off
game.city.elevationAt = window._elev;                                  // ripristino
```

Dopo aver toccato la generazione, controlla anche la salute della maglia:

```js
// vicoli ciechi veri: devono essere ≤ 6 e solo sul bordo mappa (x o y ≈ 188)
game.city.graph.usableNodes.filter(n => n.out.length === 1).map(n => [n.x | 0, n.y | 0])
// quanta strada è stata tolta dai superblocchi, e quanti disassamenti sono nati
game.city.stats // { buildings, props, blocks, nodes, edges, doglegs, stairs }
```

Valori attesi con la seed attuale: `buildings 418`, `props 1299`, `blocks 122`, `nodes 196`,
`edges 279`, `doglegs 4`, `stairs 3`, `rural 5`, `piers 10`, `shops 113`, `venues 324`,
`garages 7`, `turfs 6`, e 43 raccolte a terra (`game.pickups.items.length`) — erano 36 finché
non si è aggiunta la campagna e non si è cominciato a scartare i punti murati (§5.12).
I primi nove devono restare **identici** finché non si tocca l'ordine di consumo dell'rng in
generazione: se cambiano, hai spostato una `rng.*` e la città non è più quella collaudata.
`shops`/`venues`/`garages` e `turfs` nascono da rng **separati** (`placeShops`, `placeGarages`,
`placeTurfs`): cambiano solo se tocchi quelle funzioni, e non trascinano con sé il resto.

`stairs` è sceso da 8 a 3 perché i vicoli passanti candidati sono meno: la città copre la
stessa area di prima ma su una mappa più grande, e la campagna non ha vicoli.

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

Per negozi e interni (fase 3):

```js
// dove sei e cosa c'è nella stanza
({ dentro: game.indoors, locale: game.shops.floor?.biz.id,
   piano: game.shops.active && `${game.shops.active.cur + 1}/${game.shops.active.floors.length}`,
   gente: game.shops.floor?.people.length, cassa: game.shops.floor?.till,
   azioni: game.shops.actions.map((a) => `${a.key}: ${a.text}`) })
// contanti e conti
({ soldi: game.player.money, abito: game.player.outfit,
   rapine: game.stats.robberies, visite: game.stats.visits })
// prova a freddo: entra nel negozio più vicino e sali di un piano
(() => { const p = game.player;
  const s = game.city.shops.reduce((b, q) =>
    Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? q : b);
  game.shops.enter(s, game); game.shops.useStairs(1, game); return game.shops.floor.biz.id; })()
```

`game.indoors` è la domanda giusta da fare quasi sempre: se è vero, traffico, pedoni,
ricercato e raccolte **non stanno girando**, e `game.area()` restituisce la pianta del piano
invece della città. **Le eccezioni sono due**: l'orologio, che gira comunque (§5.11), e la
polizia, che dalla §5.12 assedia la porta invece di sparire — ma con una versione ridotta di
sé (`police.siege`), non facendo ripartire la città.

Per le bande, il mercato e l'assedio (§5.12):

```js
// il banco di una banda: chi è il contatto, e cosa vende oggi
const t = game.city.turfs[0];
const S = await import('/src/entities/shops.js');
({ banda: `${t.hangul} ${t.trade}`, contatto: !!game.shops.dealerOf(t),
   merce: game.shops.dealerOf(t) ? S.gangStock(t, game).map((i) => `${i.label} ${i.price}`) : [] })
// si tratta solo a mani vuote e senza stelle: con la mazza in pugno il banco sparisce
game.shops.actions.map((a) => `${a.key}: ${a.text}`)
// quanto costa la stessa cosa nei sette quartieri
S.MARKETS && Object.entries(S.MARKETS).map(([k, m]) => [k, m.guns, m.pawn])
// assedio: entra con quattro stelle e guarda chi trovi all'uscita
game.wanted.add(100, game); game.shops.enter(game.city.shops[0], game);
// ... qualche secondo ...
game.shops.leave(game);
const dp = (o) => Math.round(Math.hypot(o.x - game.player.x, o.y - game.player.y));
({ agenti: game.police.cops.map(dp).sort((a, b) => a - b),
   volanti: game.police.cars.map(dp).sort((a, b) => a - b),
   motovedette: game.police.boats.length })
```

Per l'ora, la luce e il meteo (fase 3, terza tappa):

```js
// che ora è, che tempo fa, e cosa ne consegue
const dc = game.dayCycle;
({ ora: dc.clock, giorno: dc.day, fase: dc.phase, notte: dc.isNight,
   meteo: dc.weather.label, pioggia: +dc.rain.toFixed(2), bagnato: +dc.wet.toFixed(2),
   nuvole: +dc.cloudiness.toFixed(2), traffico: +dc.trafficScale.toFixed(2) })
// la luce del momento: è tutto quello che legge la scena
dc.light   // { amb:[r,g,b], k, warm:[r,g,b], w, sx, sy, shadow, lamps }
// comandi: spostare l'ora, forzare il tempo, fermare l'orologio
dc.hour = 21.5;  dc.setWeather('storm');  dc.paused = true;
// negozi: chi è aperto adesso
game.city.shops.filter((s) => game.shops.shopOpen(s, game)).length   // su 113
game.shops.isOpen('guns', game)          // un tipo di attività
game.shops.nextOpening(s, game)          // { biz, at, wait } del piano che riapre prima
```

`dc.light.lamps` (0..1) è la manopola da cui scende tutto quello che si accende: fari,
lampioni, insegne, finestre. `isNight` è solo `lamps > 0.5`. Per un giro completo delle 24 ore
in forma di tabella, senza guardare ventiquattro screenshot, c'è
`.claude/tools/scenes/daylight-sweep.scene` (§9).

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

Per la mappa nuova (fase 3, seconda tappa):

```js
// dove finisce la città: 0 = campagna, 1 = centro. Sotto 0.26 non c'è più maglia fitta.
const c = game.city;
({ urbanita: +c.urbanAt(game.player.x, game.player.y).toFixed(2),
   inAcqua: c.isWater(game.player.x, game.player.y),
   costa: [c.waterX | 0, c.quayX | 0], aeroporto: c.airport && [c.airport.w | 0, c.airport.h | 0],
   porto: c.port && [c.port.w | 0, c.port.h | 0], moli: c.piers.length })
// velivoli e imbarcazioni: nascono al boot e non passano mai dallo streaming
game.vehicles.filter(v => v.moored || ['plane','heli','boat','ferry'].includes(v.kind))
  .reduce((a, v) => (a[v.kind] = (a[v.kind] || 0) + 1, a), {})
// in volo: quota, velocità, se è ancora attaccato al terreno
const v = game.player.vehicle;
v && ({ arma: v.kind, z: Math.round(v.z), vz: Math.round(v.vz), v: Math.round(v.speed) })
// bande: territori, uomini di guardia in campo e chi è già ostile
({ territori: game.city.turfs.map(t => `${t.hangul} ${t.place}`),
   guardie: game.peds.filter(p => p.turf).length,
   ostili: game.peds.filter(p => p.turf && p.hostile).length })
```

**In una prova scriptata i comandi si danno da `game.input.down`, non scrivendo sul veicolo:**
`player.updateDriving` riscrive `throttle`, `steer` e `climb` a ogni frame dall'input, quindi
impostarli a mano non fa niente (è la stessa trappola della mira, §4). E **non teletrasportare
il giocatore su una barca**: a piedi in acqua si annega prima di riuscire a salirci: ci si
mette sul molo e si chiama `enterVehicle`.

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
  districts.js        i 7 distretti (con i parametri di maglia), RIVER, SEA, HILLS,
                      URBAN_BLOBS (la sagoma della città), GANGS, insegne
  citygen.js          quota del terreno, campo di urbanità, maglia stradale, mare e costa,
                      isolati (urbani, rurali, aeroporto, porto), edifici, props, indici,
                      vetrine (`placeShops`), officine (`placeGarages`), bande (`placeTurfs`)
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
  menu.js             menu di pausa
  shopmenu.js         pannello del listino (compra/vendi)

.claude/              strumenti per chi sviluppa (non fa parte del gioco), vedi §9
  tools/probe.mjs     avvia il gioco headless, esegue scene, misura, screenshot
  tools/sprite.mjs    guarda uno sprite generato ingrandito
  tools/scenes/       scene pronte da dare a `probe.mjs --script`
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

**La forma della città è un campo, non un contorno.** `city.urbanAt(x, y)` vale 1 nel centro
dei quartieri e 0 in campagna: è la somma di otto macchie scritte a mano (`URBAN_BLOBS` in
`districts.js`) più un rumore che ne sfrangia il bordo. Sotto `RURAL_U` (0.26) la maglia fitta
non esiste: restano **una arteria su due** e qualche strada bianca, e gli isolati diventano
campi. È l'unico posto in cui è deciso *dove finisce Seoul* — a valle nessuno sa niente di
forme, si legge solo questo campo. Alzare l'ampiezza del rumore fa nascere risaie in mezzo a
Gangnam: il bordo va sfrangiato, non bucato.

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
| Ai piani alti le attività erano stanze vuote | i due vani scala occupano tutto il muro di fondo: cucina, frigoriferi e rastrelliere venivano scartati uno per uno | `buildFloor` calcola `f.band` (muro di fondo libero) e `f.body` (sala sotto i pianerottoli), e le piante usano solo quelle |
| `E` sulla soglia di un negozio rubava l'auto parcheggiata dietro | due sistemi leggevano lo stesso fronte di tasto nello stesso frame | `shops.update` gira **prima** di `player.update` e pubblica `shops.near`; il giocatore salta l'entrata in auto se è pieno |
| Il primo articolo del listino veniva comprato da solo | `E` apre il pannello e `E` compra: il fronte del tasto era ancora vivo | `ShopMenu.cooldown = 0.25` all'apertura |
| Una granata lanciata dentro restava appesa a mezz'aria | `projectiles.update` era nel ramo saltato quando si è dentro | gli esplosivi girano sempre; a cambiare è `game.area()` su cui rimbalzano |
| L'interno sembrava una pianta catastale, minuscola in mezzo allo schermo | zoom 1.12 e camera al seguito, come in strada | `roomZoom` (fit del piano) + camera sul centro della stanza |
| «NaN colpi inclusi» sulla mazza in vendita | le armi da mischia non hanno `pickup` | `weaponItem` guarda `spec.infinite` prima di moltiplicare |
| Un velivolo in volo viene sbattuto giù da niente | `vehicleGrid` è piatta: la prima berlina che passa *sotto* lo prende in pieno | `resolveVehicleCollisions`, `if (o === v \|\| airborne(o)) continue` |
| L'aereo parcheggiato non parte, e si rompe | era ormeggiato col muso verso le cisterne invece che verso il raccordo | `airSpots`, `angle: horiz ? -PI/2 : PI`; torre e cisterne spostate fuori dal piazzale |
| La barca ormeggiata non si muove per due secondi | muso verso terra: `resolveMarine` la respinge finché non gira | `boatSpots`, `angle: Math.PI` (al largo) |
| Un filare di alberi in mezzo al mare | le strisce dell'Han River Park nascevano su tutte le campate, anche a ovest della costa | `generateCity`, `if (x < city.quayX) continue` |
| Una barca che risale la costa sbatte contro il nulla | i muretti d'argine del Han partivano da x=0 e continuavano sull'acqua | argini tagliati a `city.quayX`: alla foce l'argine non c'è |
| L'aeroporto si mangia mezza provincia | una delle quattro arterie di bordo era stata spenta dal diradamento della campagna, e la fusione degli isolati non si fermava più | `carveMesh` passo 5: i bordi della piattaforma vengono **riaccesi** prima di svuotarla |
| Atterrare costava un terzo della fusoliera | la discesa comandata arrivava a −286 px/s, ben oltre `HARD_LANDING` | effetto suolo in `updateAircraft`: sotto i 60 px con `climb < 0` la caduta si smorza |
| **In una prova scriptata** il velivolo non si muove | `updateDriving` riscrive `throttle`/`steer`/`climb` dall'input a ogni frame | i comandi si danno con `game.input.down.add('KeyW')` |
| **In una prova scriptata** il giocatore muore appena teletrasportato | è finito in acqua, e a piedi in acqua si annega | teletrasportarlo sul molo, poi `enterVehicle` |
| Metà del traffico si tampona a gas costante, dicendosi `libero` | la distanza di sicurezza era misurata **fra i centri**: per una berlina lunga 78 px la frenata cominciava a paraurti già in contatto | `traffic.senseAhead`, `gap = forward − (len + olen) / 2` |
| Una coda si ferma da sola senza niente davanti (onde di stop-and-go) | la velocità *desiderata* veniva moltiplicata per quanto spazio mancava: chi frena troppo fa frenare di più chi ha dietro, e l'onda risale la fila | `senseAhead` restituisce un **tetto** di velocità (`lead + (gap − want) × 2.6`), non un fattore |
| Due mezzi fermi **dentro** l'incrocio, ognuno davanti all'altro | la prenotazione del nodo veniva liberata al cambio d'arco: lì il muso è sulla strada nuova ma la coda è ancora in mezzo, e l'asse perpendicolare parte addosso | `ai.clearing`, la prenotazione si libera a distanza dal nodo |
| Auto ferme al **verde** | prenotazione d'asse *e* semaforo sullo stesso incrocio: due arbitri, e quello dell'asse rosso non aveva ancora liberato | la prenotazione vale solo dove `!endNode.signal` |
| Nessuno entra più in nessun incrocio | "non entrare se non esci" senza filtro di corsia contava anche il traffico fermo in senso opposto, a 38 px di lato | `boxBlocked` proietta sulla direzione d'uscita e scarta chi è oltre 34 px di lato |
| Ognuno cede il passo a chi gli sta cedendo il passo | su maglia fitta l'uscita di un incrocio è già la coda di quello dopo: la cortesia si propaga all'indietro e non si scioglie mai | `ai.boxT`: dopo 3,5 s si entra lo stesso |
| Una coda ferma indietreggia e si tampona da sola | `throttle` negativo a velocità nulla **è retromarcia**, non freno | `if (v.speed > 3) throttle = −1; else { throttle = 0; handbrake = true }` |
| La manovra di sblocco sbatte le auto contro i palazzi | si indietreggiava senza guardare cosa c'è dietro | `startRecovery` controlla veicoli **e** `solidGrid` dietro; se è chiuso forza il passaggio invece di indietreggiare |
| Auto che nascono dentro un autobus | lo spazio libero preteso allo spawn era 88 px fissi, e un autobus è lungo 158 | `spawnTrafficNear`, `54 + len/2 + GAP_STOP` |
| Le code crescono finché non si smaltiscono più | con una distanza di sicurezza vera, 54 auto nell'anello di streaming superano la capacità degli incroci semaforizzati | `MAX_TRAFFIC` 54 → 44 (misurato: a 48 il flusso cala del 23%, a 44 del 6%) |
| Il temporale arriva a ritroso e finisce con uno scatto | `lerp(next, weather, blend)` invece di `lerp(weather, next, blend)`: a `blend = 0` restituisce già la condizione nuova, poi per 25 s torna verso la vecchia | `daycycle.apply`, `blend` va **da `weather` a `next`** |
| Un tramonto col temporale è viola invece che plumbeo | la nuvolosità alzava solo la forza della tinta, non ne cambiava il colore: restava quella dell'ora | `daycycle.apply`, `amb` tirata verso `SLATE` in funzione di `cloudiness` |
| `TypeError: … reading 'dayCycle'` a ogni pedone dentro un negozio | `interiorscene` chiama `scene.drawPed` con tre argomenti, e `drawPed` ne ha preso un quarto (`game`) per la pioggia | firma cambiata in un posto solo su due: `scene.drawPed` è **condiviso** fra strada e interni, come `drawPlayer` |
| La gente al tavolo di un 분식 apre l'ombrello | `drawPed` è lo stesso codice dentro e fuori, e leggeva `rain` senza guardare dove si trova | guardia `game.indoors` in `drawPed` |
| L'orologio dell'HUD è un emoji che cambia da macchina a macchina | `weather.icon` usato come glifo | icone del meteo disegnate con path (`hud.drawWeatherIcon`), come tutto il resto della grafica |
| L'asfalto resta bagnato per minuti dopo aver forzato `clear` in una prova | `setWeather` saltava alla nuova condizione ma lasciava `wet` a asciugarsi da solo (0.0016/frame) | `setWeather` porta `wet` a 0 o 1 insieme al resto |
| Assediando la porta la polizia sparisce dopo un secondo | `prune` misura la distanza da `player.x/y`, che dentro un edificio è la pianta: tutto risulta oltre 2200 px | `police.focus`, da cui passano `prune`, gli spawn e l'elicottero |
| Un agente di rinforzo compare fra gli scaffali del 편의점 | `addCop` faceva `game.peds.push`, e dentro `game.peds` è la gente del piano | `police.addCop`: `game.indoors ? game.pedSystem.peds : game.peds` |
| Svuotata una cassa al terzo piano, le pattuglie corrono nell'angolo nord-ovest della mappa | `wanted.add` registrava le coordinate della pianta come ultima posizione nota | `wanted.add`: se si è dentro si registra `shops.active.shop` |
| Le volanti escono dall'assedio a razzo e sbandano | durante l'assedio si scrive `x/y` a mano, ma `speed`/`vx`/`vy` restano quelli di prima e `traffic.update` li riprende alla lettera | `police.siegeCar` azzera velocità e comandi, `endSiege` chiama `snapToRoad` |
| Un pedone su due viene saltato nel frame in cui un agente risale in macchina | `boardCop` è chiamata da dentro il `for…of this.peds` di `pedSystem.update` | `police._boarded`: la rimozione si rimanda al `prune` del frame dopo |
| Il ricercato si raffredda con la motovedetta a cinquanta metri di poppa | `computeSpotted` guardava solo `cops` e `cars` | `police.computeSpotted`, terzo giro su `this.boats` |
| La SWAT non tira quasi mai la granata | la distanza di ingaggio (120-240 px) sta quasi tutta sotto la soglia minima del lancio (200) | `police.copBehavior`, banda 190-320 px per la SWAT |
| A cinque stelle arriva una granata ogni 2,5 s | «una sola in volo» non è un tetto di cadenza: con sei uomini della SWAT la miccia da 2,2 s diventa il periodo | `police.NADE_GAP`, 5 s di pausa per la squadra dopo ogni scoppio |
| Una motovedetta si pianta contro un molo e non riparte | in acqua non passa nessuno a spostarla, e non c'è grafo da cui riagganciarsi | `police.driveBoat`, anti-incastro in retromarcia come per le volanti |
| La pioggia non lava niente per quanto si aspetti | `Fx` non vede il meteo: `main` chiamava `fx.update(dt)` e basta | `fx.update(dt, game)`; `drawDecals` invece resta a un argomento, la usa anche `interiorscene` |
| Un incendio grosso fa sparire traccianti e sangue a metà volo | 22 pozze × 26 particelle/s riempiono da sole 346 dei 420 posti di `fx` | strozzatura `26 × min(1, 10 / fires.length)` in `updateFires` |
| Il fuoco si accatasta dov'è invece di camminare | senza distanza minima le figlie nascono dentro la madre | `projectiles.canBurn`, distanza minima `0.72 × r` |
| I pedoni al riparo costano più della pioggia stessa | venti fermi contro un muro rifacevano la query dei solidi a ogni frame | `updatePed`, il push anti-muro vale per `shelter` solo con `targetSpeed > 0` |
| Un posto auto resta occupato per sempre da un'auto venduta o affondata | togliere un veicolo da `game.vehicles` non libera il suo stallo | `shops.sellVehicle` e `main.onVehicleSunk`: `if (v.spot) v.spot.taken = false` |
| Il commesso scappato è di nuovo dietro al banco alla visita dopo | `f.people` non è più lo stesso array di `f.staff`: lo splice toglieva solo dalla copia | `shops.updateInside`, `drop(f.staff, p)` e `drop(f.crowd, p)` |
| Un buco nel muro di fondo che non porta da nessuna parte | il varco veniva aperto prima di sapere se dietro l'edificio c'è posto per un piede | `buildInterior(shop, back)`, `back` deciso da `shops.backDoorSpot` una volta sola |
| Il meteo dopo otto ore di sonno è quello di otto ore prima | `hour = x` sposta l'orologio ma non fa girare la catena di Markov | `daycycle.advance`, passi di 5 s con `apply()` dentro il ciclo |
| Una stella arriva dal nulla dopo essere rinato in ospedale | l'allarme silenzioso continuava a scorrere durante la morte, e la morte azzera il ricercato | `shops.updateAlarm`, uscita su `game.player.dying` |
| Il 거래책 sparisce proprio quando ti serve | un'auto che accosta fa scappare chi ha intorno, e una guardia spaventata restava `walk` per sempre | `updatePed` rimette in `guard` chi ha `turf`; `canDeal` guarda il recinto, non lo stato |
| Due uomini marchiati come contatto nello stesso cortile | il flag lo scrivevano sia `spawnTurf` sia il rimpiazzo, e il giocatore parlava con quello sbagliato | solo `refreshDealer` lo assegna, e spegne il precedente |
| Una raccolta a terra dentro un muro | nessuno controllava il punto: la molotov garantita davanti alla safehouse era murata da tre fasi | `pickups.freeSpot` e `addNear` |
| **In una prova scriptata** un incendio ammazza il giocatore fermo | il fuoco propagato cammina di ~60 px per generazione e torna addosso a chi l'ha appiccato | `pl.hp = 1e6` per lo scatto, o appiccare a più di 300 px |
| **In una prova scriptata** «tengo premuto il mouse» non spara | `mouse.down = true` a mano non alza `mouse.pressed`, e le semiautomatiche guardano il fronte | si prova con un'arma `auto` (SMG, minigun) |
| **In una prova scriptata** il contatto di una banda non c'è | le guardie nascono a scaglioni e a più di 300 px dal giocatore: due secondi non bastano | avvicinarsi da **fuori** dal recinto e aspettarne sette |
| **In una prova scriptata** `player.attack(game)` esplode | la firma è `attack(game, spec)`: senza spec si legge `.melee` di `undefined` | `attack(game, WEAPONS[id])` |
| **In una prova scriptata** il ricercato torna a 0 da solo | il giocatore fermo allo spawn viene investito, oppure a cinque stelle la SWAT lo ammazza in ~8 s: la morte azzera tutto | metterlo su un marciapiede (`city.hospitals[i]`) e campionare entro 7 s |

Regola generale emersa: **prima di dare la colpa all'AI, verifica la geometria.** Quasi tutti
gli "stalli dell'AI" erano problemi di ingombri, corsie o posizionamento.

---

## 4bis. Chiuso: il traffico si muoveva male

**Segnalazione dell'utente:** *«il traffico si muove spesso in modo strano e fanno molti
incidenti o ingorghi»*. **Risolto in §5.10**, dove ci sono la diagnosi completa e le misure.
Questa sezione resta come esempio di metodo, perché è il modo in cui va affrontato il
prossimo problema di questo tipo.

**Il difetto non era nell'AI: era nella geometria** (che è la regola generale del §4). La
distanza di sicurezza si misurava **fra i centri** dei due veicoli invece che fra le
carrozzerie: per una berlina lunga 78 px la frenata cominciava quando i paraurti si stavano
già toccando. Metà degli urti erano tamponamenti, e il 78% dei veicoli coinvolti si dichiarava
`libero` un istante prima di tamponare — non stavano frenando perché non vedevano niente.

**Quello che ha funzionato, come metodo:**

1. **Misurare prima di toccare.** Un censimento che classifica ogni urto (tamponamento,
   laterale, frontale, contro un solido), dice quanto è lontano dall'incrocio più vicino e
   cosa diceva di sé il veicolo (`ai.why`) nell'istante dell'urto. È
   `.claude/tools/scenes/traffic-census.scene`, ed è rimasto nel repo.
2. **Guardare l'ingorgo, non il codice.** Tre volte su tre la diagnosi è arrivata portando la
   camera sul grumo di auto ferme più grosso e leggendo lo stato di *ogni* veicolo dentro —
   `stopDist`, `claim` del nodo, `stallT`. Il difetto che ne è uscito (la prenotazione
   dell'incrocio liberata mentre l'auto è ancora in mezzo alla giunzione) nel sorgente non si
   vedeva: sembrava corretta.
3. **Misurare il flusso, non quanti sono fermi.** «Quante auto sono ferme adesso» è una
   fotografia che peggiora *proprio quando il traffico migliora*, perché le auto sane si
   fermano ai semafori. La misura giusta è quanta strada percorre un veicolo al minuto.
4. **Misurare su più zone.** Qualunque modifica alla guida sposta le traiettorie e cambia lo
   scenario: su una scena sola si finisce per tarare su un ingorgo che nasce o non nasce per
   caso. Su cinque zone il rumore si media.

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

### 5.8 Fase 3, prima tappa — negozi e interni

Dodici tipi di attività, 139 vetrine e 369 locali su più piani in tutta Seoul, un'economia in
contanti e quattro modi di spenderli. Le scelte di design prese qui — cambiare costa poco, i
punti sono tutti indicati:

- **Dentro, la città si ferma.** Traffico, pedoni, polizia, ricercato e raccolte non girano
  mentre sei in un negozio (`main.update`, ramo `if (!this.indoors)`). Costa zero CPU e
  risponde una volta per tutte a "cosa succede fuori mentre compro": niente. Il ricercato
  resta **congelato**, quindi la porta non è un nascondiglio — per quello c'è l'officina, e
  si paga. L'alternativa (mondo che continua) vorrebbe dire poliziotti che ti aspettano
  davvero fuori: è il primo candidato se si vuole ampliare.
- **La polizia non entra.** Un inseguimento dentro un 편의점 vorrebbe portare pathfinding,
  streaming e volanti in uno spazio di 300 px. Esci esattamente com'eri entrato, stelle comprese.
- **L'interno si ricorda** (`shops.cache`, chiave = id del negozio). La cassa svuotata resta
  vuota, il commesso steso resta a terra. Nasce alla prima visita, non in generazione: 139
  negozi × fino a 4 piani sarebbero 369 piante costruite al boot per niente.
- **Gli interni non sono in scala** (footprint × 1.8, limitato a 300-470 × 260-390 px). Un
  negozio di Hongdae è largo 70 px in pianta e il giocatore ne è largo 18: dentro non ci si
  girerebbe. È la stessa bugia di tutti i giochi con gli interni.
- **Comprare è `E`, rapinare è `F`.** Sono la stessa distanza dallo stesso bancone: con un
  tasto solo si finirebbe per rapinare un negozio volendo comprare pallottole.
- **Rapinare vuole un'arma in pugno** — o un commesso già a terra. Il commesso di 총포상,
  술집 e 당구장 è armato e risponde al fuoco: una rapina è una scelta, non un pulsante.
  Vale `rob: 22` di heat (una stella; un cadavere ne vale due).
- **I prezzi delle armi stanno in `WEAPONS`** (`price`, `ammoPrice`): la tabella armi è
  l'unica fonte di verità, e il banco dei pegni ricompra al 45% dello stesso numero.
- **Il denaro si finisce.** Si parte con ₩60.000 — abbastanza per mangiare e per una scatola
  di munizioni, **non** per una pompa. Le casse rendono ₩20.000-90.000, la clinica si prende
  un quarto dei contanti a ogni morte, l'officina ne costa 30.000 e il cambio d'abito 40.000.
- **L'officina (도색) azzera il ricercato**, ripara e riverniciata: una per distretto, con la
  piazzola **sulla strada** davanti a una saracinesca. I cortili interni sarebbero il posto
  giusto ma in tutta Seoul ce ne sono undici e solo quattro abbastanza larghi per una macchina.
- **Il cambio d'abito toglie una stella** e cambia il colore del bomber (`HERO_OUTFITS`,
  cinque capi; fascia rossa e tigre restano, o il giocatore smetterebbe di riconoscersi).
- **L'ospedale è diventato un posto in cui si entra**: `placeShops` promuove a `clinic`
  l'edificio più vicino al punto che `city.hospitals` aveva già, e sposta il blip (e il
  risveglio dopo la morte) sulla porta.
- **Le vetrine non consumano l'rng della città.** `placeShops`/`placeGarages` girano dopo la
  generazione con un `new Rng` loro: `buildings 424` e compagnia restano identici.
- **Gli esplosivi funzionano anche dentro** (rimbalzano sui tramezzi, l'onda d'urto prende la
  gente del piano) ma **non attraversano la porta**: `projectiles.clear()` a ogni passaggio.
  Una granata in una stanza di 300 px prende in pieno anche chi l'ha tirata, ed è giusto così.

Cosa c'è in un locale, per tipo: 총포상 armeria · 전당포 pegni (compra e vende) · 편의점
minimarket · 약국 farmacia · 분식 e 술집 da mangiare · 옷가게 vestiti · 병원 ospedale ·
피시방, 노래방, 당구장, 사무실, 주택 solo da esplorare (ma con la cassa). Sei piante
condivise — `counter`, `market`, `eatery`, `desks`, `rooms`, `hall` — bastano a farli sembrare
tutti diversi perché cambiano palette, arredo e gente.

### 5.9 Fase 3, seconda tappa — la mappa prende forma

Il mondo passa da 4200×4200 a **5400×5400**, ma la città resta grande come prima: quello che
si aggiunge attorno è il mare, l'aeroporto, il porto e la campagna. Misurato campionando la
mappa: la strada scende dal 43% al 30% della superficie, l'acqua sale dall'8% al 18%, e gli
isolati urbani restano 3,9 M px² contro i 4,3 M di prima. **Seoul non è rimpicciolita: si è
smesso di riempire il rettangolo.**

Le scelte di design prese qui — cambiare costa poco, i punti sono tutti indicati:

- **La mappa resta un quadrato, la città no.** Alternativa scartata: un mondo rettangolare.
  Sarebbe stato più fedele alla Seoul vera, ma minimappa, mappa piena e texture assumono tutte
  un mondo quadrato (`MAP_SIZE / city.w` usato per entrambi gli assi), e riscriverle costava più
  di quanto rendeva. La forma la dà il contenuto: `URBAN_BLOBS`, il mare a ovest, i rilievi a
  nord-est. Se un giorno serve davvero un mondo rettangolare, i punti da toccare sono tre —
  `buildMapTexture`, `MapView.drawPanel`, `Hud.drawMinimap`.
- **Due distretti nuovi**, Gimpo 김포 (aeroporto e risaie: a Gimpo le due cose si toccano
  davvero) e Gyeonggi 경기도 (campagna), più i moli promossi a **Porto di Incheon** 인천항 e
  spostati sulla costa. Sette distretti in tutto.
- **Un aeroporto solo, ma vero.** 1039 × 1530 px: pista da 1377, raccordo, due bretelle,
  piazzale con cinque piazzole, terminal, torre di controllo, tre hangar, cisterne e maniche a
  vento. Ci sono **tre turboelica e tre elicotteri** parcheggiati, più un eliporto al porto.
- **Si vola con due tasti.** `Spazio` sale, `Shift` scende; gas e sterzo restano quelli
  dell'auto. L'alternativa (assetto a due assi, beccheggio) vuole un modello di volo e una
  camera nuova per risolvere un problema che in visuale dall'alto non esiste. L'elicottero
  decolla da fermo, il turboelica vuole 250 px/s di rullaggio prima di staccare.
- **Il volo non è un cheat**: sopra i 400-460 px di quota non si sale, le torri di Gangnam e la
  N Seoul Tower restano solide, e la polizia continua a vedere il giocatore. Quello che il volo
  compra è la geografia — attraversare il Han senza ponte, arrivare al porto senza fare il giro.
- **Quattro imbarcazioni**: motoscafo e battello, ormeggiati ai moli del porto e agli scali sul
  Han. Il fiume attraversa tutta la mappa: in barca è la strada più veloce da est a ovest.
- **L'acqua uccide.** A piedi si annega, un'auto nel Han affonda (niente esplosione: uno spruzzo
  e il relitto che cala), da una barca non si sbarca in mezzo al mare. Senza questo il mare
  sarebbe uno sfondo, e con un quarto della mappa coperto d'acqua non poteva restarlo.
- **La campagna è fatta di campi, non di isolati vuoti.** `block.fields` è un elenco a parte che
  disegna il terreno: risaie allagate e campi solcati a scacchiera, con serre (비닐하우스),
  cascine, fienili, silo e filari. Non sono edifici né cortili — non devono fermare nessuno.
- **Sei territori di bande** (백호파 · 흑사파 · 철마파 · 황소파), piazzati con un rng loro su
  cortili e piazzali che esistevano già. Reagiscono a chi entra armato o già ricercato; con i
  pugni in tasca si passa. È il gancio per le missioni: un posto dove andare a trattare, e un
  posto da cui si esce sparando.
- **La polizia non è stata toccata.** Non ha elicotteri suoi da mandare dietro a un giocatore in
  volo (il suo ne ha già uno, ma solo a cinque stelle) e non insegue in barca. È la prima cosa
  che si sentirà mancare.

### 5.10 Il traffico si muove bene

Chiude la segnalazione dell'utente (§4bis). Misurato su 170 s in cinque zone diverse, due
esecuzioni per albero, fianco a fianco con `main`:

| | `main` | adesso |
| --- | --- | --- |
| urti al minuto | 235–266 | **36–40** (−85%) |
| di cui tamponamenti (su 170 s) | 358–414 | **6–8** (−98%) |
| di cui laterali all'incrocio | 149–155 | 42–45 |
| di cui frontali | 79–83 | 4–7 |
| di cui contro un solido | 51–67 | 39–52 |
| flusso mediano, px/min per veicolo | 4047–4245 | 3450–3811 (−13%) |
| veicoli praticamente fermi | 0–5 su ~230 | 11–12 su ~190 |

**Quello che resta indietro, detto chiaro:** il flusso mediano è ~13% sotto `main` e c'è un 6%
di veicoli che in mezzo minuto non si muove, contro l'1% di prima. Non sono ingorghi eterni —
guardati a schermo sono code al semaforo che si smaltiscono — ma è il prezzo che si paga per
avere auto che si cedono il passo invece di attraversarsi. Se qualcuno vuole ridurlo, le due
leve misurate sono il ciclo del semaforo e il sorpasso (§6), non la distanza di sicurezza.

**La causa era una sola riga di geometria.** La distanza di sicurezza si misurava fra i centri
dei due veicoli, non fra le carrozzerie: una berlina è lunga 78 px, quindi la frenata
cominciava a paraurti in contatto. Il 78% dei veicoli si dichiarava `libero` nell'istante in
cui tamponava. Corretto questo, i tamponamenti sono spariti (110 → 4 sulla prima misura) — e
sono emersi tutti i difetti che il caos precedente nascondeva, perché le auto hanno cominciato
a fare **code vere** invece di attraversarsi a vicenda. Sono in §4, uno per riga; qui c'è il
perché delle scelte, che è quello che serve per cambiarle:

- **Una legge di inseguimento invece di un fattore di frenata.** Si punta alla velocità di chi
  sta davanti, corretta dall'errore di distanza (`lead + (gap − want) × 2.6`). Moltiplicare la
  velocità desiderata per quanto spazio manca — quello che si faceva prima — è instabile: chi
  frena troppo fa frenare di più chi ha dietro, e la coda si ferma da sola senza che davanti ci
  sia niente. È la differenza fra una coda che scorre e una che pulsa.
- **Tre regole all'incrocio, e servono tutte.** «C'è posto di là?» (`boxBlocked`), «è il mio
  turno?» (prenotazione d'asse, **solo dove non c'è semaforo**), e un limite di tempo che le
  sblocca entrambe. Senza la prima l'incrocio si tappa; senza la terza si arriva a uno stallo
  di cortesia in cui ognuno cede il passo a chi gli sta cedendo il passo — e su una maglia
  fitta, dove l'uscita di un incrocio è già la coda di quello dopo, succede subito.
- **Il traffico è sceso da 54 a 44 veicoli.** Non è una resa: con una distanza di sicurezza
  vera, 54 auto nell'anello di streaming chiedono agli incroci semaforizzati più di quello che
  riescono a smaltire in un ciclo, e le code crescono finché non si smaltiscono più. Misurato:
  a 48 il flusso mediano cala del 23%, a 44 del 6%. Il limite di capacità sta lì in mezzo. Se
  si vuole più densità, la leva vera è il ciclo del semaforo, non `MAX_TRAFFIC`. §5.12 l'ha poi
  misurata: accorciarlo non dà niente, allungarlo fa danni.
- **La manovra di sblocco guarda dove va.** Prima indietreggiava con sterzo casuale: in coda
  innescava la carambola successiva, contro un palazzo rompeva la macchina e restava incastrata
  lo stesso. Ora controlla veicoli e solidi dietro; se è chiuso forza il passaggio
  nell'incrocio invece di indietreggiare, e alla terza volta indietreggia comunque ma piano —
  una spinta gentile a chi sta dietro costa un urto leggero, restare incastrati costa quella
  strada per il resto della partita.
- **La polizia ha preso solo la correzione geometrica** (`police.followRoads`): le volanti
  frenano per chi hanno davvero davanti, ma restano senza la prudenza del traffico civile, che
  è metà del carattere di un inseguimento. Verificato che a cinque stelle arrivino agenti,
  volanti, posti di blocco ed elicottero, e che `wanted.reset()` li smonti tutti.

**Provato e scartato: il sorpasso.** Un'arteria ha due corsie per senso e nessuno le usa, così
dietro al primo furgone lento resta incolonnata mezza città. Implementato (cambio corsia con
scivolamento su `laneOffset` frazionario, tre punti di controllo sulla corsia di fianco) e
**misurato peggiore**: flusso mediano da 3311 a 2191 px/min e da 1 a 9 veicoli fermi. Le auto
si spostano tutte nella corsia libera, si ritrovano affiancate all'incrocio dove le due corsie
si riuniscono, e il guadagno sul rettilineo si perde tutto lì. Se qualcuno ci riprova, il pezzo
che manca è la scelta della corsia **in funzione della svolta successiva**: senza quella, il
sorpasso è un debito che si paga all'incrocio dopo.

### 5.11 Fase 3, terza tappa — il tempo passa

Seoul ha un orologio, quattro condizioni di tempo e dei negozi che chiudono. Tutto nasce da un
modulo solo, `world/daycycle.js`, che è l'unica fonte di verità su che ora è e che tempo fa:
scena, HUD, negozi, polizia e traffico leggono di lì e non tengono stato proprio.

Le scelte di design prese qui — cambiare costa poco, i punti sono tutti indicati:

- **Un giro dura 24 minuti reali**, cioè un minuto di orologio al secondo (`DAY_SECONDS`). È la
  scala di GTA III, ed è il compromesso che regge: più lento e in una partita non si vede mai
  la notte, più veloce e il cielo lampeggia. Si comincia alle 8:24 del mattino.
- **L'orologio è l'unico sistema che gira anche dentro un negozio.** Tutto il resto è fermo per
  progetto (§5.8), ma un orologio che si ferma è un orologio a cui il giocatore smette di
  credere, e restare al riparo aspettando che faccia giorno deve poter funzionare.
- **La luce è un velo a schermo intero, non un motore** (§3). L'alternativa — illuminare i tile
  del terreno — vorrebbe dire buttare la cache a ogni minuto di orologio: la si è scartata
  prima di provarla, e non è una perdita, perché la parallasse di questo gioco non ha normali
  su cui far cadere una luce vera.
- **Il colore del cielo è una tabella, non una formula** (`KEYS`). Il blu della notte fonda, il
  viola dell'alba e l'arancio del tramonto sono scelte: in tabella si cambiano guardando il
  gioco, in una sinusoide si cambiano rifacendo i conti. Un giro completo si legge con
  `daylight-sweep.scene` (§9).
- **Le ombre girano col sole, il rilievo no** (§3). Ombre lunghe e radenti all'alba e al
  tramonto, corte a mezzogiorno, quasi nulle di notte; l'hillshade del terreno resta fermo
  perché è lettura del rilievo e non ora del giorno. È la stessa scelta consapevole del
  «terreno disegnato in pianta».
- **Le finestre si accendono.** Ogni facciata ha un secondo strato di texture
  (`facades.facadeLights`) disegnato in `lighter` con l'intensità della sera: giallo caldo per
  le case, bianco freddo per gli uffici, piani interi per i grattacieli di vetro, la corona
  della N Seoul Tower, e le serre della campagna che di notte diventano lanterne. Senza, un
  palazzo di notte è una sagoma nera.
- **Quattro condizioni di tempo, legate in catena** (§3): sereno · nuvoloso · pioggia ·
  temporale. Durano da 2 a 22 ore di gioco, la transizione è di 25 s.
- **La pioggia si sente al volante.** Grip laterale −17% e frenata −14% sul bagnato, e
  l'asfalto **si asciuga piano** dopo che ha smesso (i riflessi e la scarsa aderenza restano un
  po'). I numeri sono volutamente modesti: il traffico civile frena a distanze tarate a secco
  (§5.10) e non sa che piove — raddoppiare lo spazio di frenata rimetterebbe in strada i
  tamponamenti che sono costati una sessione intera. Misurato, sotto: non li rimette.
- **Di notte e sotto l'acqua la polizia vede meno lontano** (`police.visionScale`, fino a
  −26% al buio e −20% sotto il temporale, cumulativi). È quello che dà un senso di *gioco* al
  ciclo: seminare una caccia di notte con la pioggia è davvero più facile. Il riflettore
  dell'elicottero resta assoluto — è fatto apposta per vedere di notte.
- **La città si popola per fascia oraria.** `dayCycle.trafficScale`/`pedScale` scrivono in
  `game.trafficScale`/`pedScale`, che traffico e pedoni già leggevano: ora di punta la sera
  (×1.15), notte fonda deserta (×0.34 il traffico, ×0.2 i pedoni), e sotto l'acqua i
  marciapiedi si svuotano molto più delle strade (−55% contro −18%).
- **Gli ombrelli.** In una visuale dall'alto un passante sotto l'acqua *è* un ombrello: 62% dei
  pedoni ne ha uno, deciso alla nascita e non quando comincia a piovere (vederli comparire
  tutti insieme tradirebbe che sono un effetto). Poliziotti, ostili, guardie di un territorio e
  chi è in panico non ce l'hanno aperto.
- **I locali hanno un orario.** 편의점 e 병원 ventiquattr'ore (il secondo è anche il punto di
  risveglio dopo la morte: chiuderlo chiuderebbe la partita), negozi di giorno, 술집 · 노래방 ·
  피시방 · 당구장 di sera e notte. Fuori orario la porta non si apre e il cartello dice a che
  ora riapre. **La porta segue il palazzo, non il negozio**: la scala è in comune, quindi se il
  piano terra è chiuso ma sopra c'è un 당구장 aperto si entra lo stesso, e il piano chiuso si
  attraversa al buio e vuoto — una porta che non si apre senza nemmeno una serratura da
  guardare è una parete invisibile, una sala buia si spiega da sola.
- **Un locale chiuso non ha cassa e non ha listino.** Senza, un 총포상 alle tre di notte
  sarebbe contante gratis senza nessuno a difenderlo.
- **La soglia luminosa ha tre stati**, non due: aperto · chiuso ma con qualcosa di aperto sopra
  (metà intensità) · tutto chiuso (spenta). La saracinesca abbassata si deve vedere da lontano
  quanto l'insegna accesa, o di notte si attraversa mezza Seoul per niente.
- **La minimappa si tinge, la mappa piena si tinge a metà.** Una mappa aperta va letta, e lì
  non c'è la scena attorno a dare il contesto dell'ora.

**Quanto costa, misurato.** Strumentando il loop, per frame:

| | mezzogiorno sereno | notte + temporale |
| --- | --- | --- |
| `scene.render` | 2,25 ms | 2,99 ms |
| `hud.draw` | 0,40 ms | 0,45 ms |
| `update` | 1,61 ms | 2,29 ms |
| **JS per frame** | **4,3 ms** | **5,8 ms** |

Cioè il caso peggiore costa **1,5 ms di JS in più**, e `scene.render` resta sotto quello che
misura `main` sullo stesso albero (3,0 ms). ⚠️ **Il tempo di parete però, in container, passa
da 23 a 32 ms per frame**, e quegli ~8 ms non sono nostri: sono il rasterizzatore software di
Chromium headless che paga i riempimenti a schermo intero in `multiply`/`lighter`/`overlay` e
tutto il blending `lighter` di fari, aloni e finestre. **Su una GPU vera quei passaggi sono
sostanzialmente gratis, ma in questo ambiente non è verificabile**: se qualcuno ha uno schermo,
la prima cosa da controllare è `F3` di notte sotto il temporale. Se davvero costasse, la leva è
una sola — accorpare i veli, oggi sono fino a tre `fillRect` a tutto schermo in `drawLight`.

**Il conto della pioggia sul traffico, misurato.** Con `traffic-census.scene` (§9), 170 s su
cinque zone, orologio fermo alle 8:24. Attenzione a leggere la colonna giusta: **il temporale
toglie da solo il 18% dei veicoli** (`trafficScale`), quindi il confronto onesto è la terza
colonna, dove il numero di auto è stato riportato a mano a quello del sereno.

| | sereno | temporale | temporale, **stesso traffico** |
| --- | --- | --- | --- |
| veicoli seguiti | 188 | 149 | 172 |
| urti al minuto | 32,1 | 31,9 | **41,6** |
| di cui tamponamenti | 4 | 4 | 5 |
| di cui laterali all'incrocio | 39 | 37 | 51 |
| flusso mediano (px/min) | 3818 | 4402 | 4390 |

Tradotto: **sul bagnato il traffico si tocca il 30% in più, ma non si tampona.** Gli urti in
più sono laterali e frontali, cioè auto che scodano in curva — che è esattamente quello che
deve fare un'auto con meno aderenza. Il difetto chiuso in §5.10 (la distanza di sicurezza) non
si riapre, perché la frenata è quasi intatta (−14%) e la legge di inseguimento non è stata
toccata.

**Provate e scartate, due.** *(1)* **Far rallentare l'AI in curva quando piove**
(`driveAI`, target di svolta × 0,78): −12% di urti, ma **−22% di flusso mediano** e *più*
tamponamenti, perché una fila che rallenta in curva se la trova addosso chi sta dietro. Per i
criteri del §5.10 — il flusso conta più del conteggio degli urti, e i tamponamenti sono il
difetto vero — è un cattivo affare. *(2)* **Abbassare il grip bagnato** da 0,17 a 0,11:
misurato 44,1 urti/min, cioè *peggio* del valore più alto. Non è un paradosso, è il rumore di
questa scena: qualunque modifica alla guida sposta le traiettorie e cambia lo scenario, e
l'HANDOFF lo dice da §5.10 — «una differenza del 10% non significa niente». Fra due valori
indistinguibili alla misura si tiene quello che si sente meglio col volante in mano, ed è 0,17.

**Quello che non è stato fatto, e perché.** Niente neve né nebbia: la prima vorrebbe un
accumulo a terra (cioè toccare i tile, cioè la cache), la seconda in una visuale dall'alto
toglie solo informazione. Niente stagioni. Gli orari non cambiano il *contenuto* di un locale:
un 술집 alle nove di sera ha la stessa gente di uno alle due di notte.

### 5.12 Il giro di arretrati

Non una tappa nuova: **diciannove punti che il §6 si portava dietro da quattro fasi**, presi
in blocco perché messi insieme cambiano il gioco più di una funzione nuova. Sono arrivati da
tre lavorazioni parallele su file disgiunti più le cuciture fra l'una e l'altra; qui c'è il
perché delle scelte, che è quello che serve per cambiarle.

**La polizia ti aspetta fuori.** Era il primo punto della lista dei negozi, ed è la cosa che
si sente di più. Entrare con quattro stelle e uscire dopo un minuto ridava la strada esattamente
com'era. Adesso, mentre sei dentro, `police.siege` porta le unità **sulla porta** (§3): esci e
trovi gli agenti a 70-250 px e le volanti in corsia davanti. Tre scelte reggono il pezzo: il
ricercato resta **congelato** (la porta non diventa un nascondiglio); l'assedio muove le unità
da sé senza far ripartire streaming, griglie e collisioni; i rinforzi arrivano più lenti che in
strada (1,4 s contro 0,9), perché da dentro non si vede niente e riempire la strada mentre
compri è una punizione per aver aperto un menu. **Misurato: `update` dentro un negozio resta
0,2 ms mediani, identico a prima.** Il contrappeso è la porta sul retro, che è arrivata nello
stesso giro (sotto): senza, l'assedio sarebbe una trappola invece che una scelta.

**Chi sbarca risale.** Dopo `deployCrew` la volante restava ferma per sempre. Ora, se ti
allontani in auto oltre 750 px o se il contatto è perso da 5 s, gli agenti vivi **camminano**
fino alla macchina e risalgono (misurato: 2,1 s dal richiamo alla ripartenza). Camminano e non
spariscono sul posto perché quella è tutta la scena che si vede di questa meccanica. Se non
risale nessuno la volante **non riparte**: una volante vuota che ti sperona è una trappola già
pagata (§4).

**Commissariati.** `city.stations`, quattro, calcolati come `city.hospitals` e senza consumare
rng, sul marciapiede a **sud** mentre l'ospedale sta a nord (sullo stesso isolato restano due
posti diversi, e due blip a due passi sulla minimappa sono un blip solo). Targa blu dipinta a
terra, blip su minimappa e mappa piena, e le volanti nuove partono di lì quando il commissariato
è entro 1600 px: è quello che rende credibile da dove arriva la polizia.

**In volo e in barca non si scappa più banalmente.** L'elicottero arriva **a tre stelle** invece
che a cinque quando il giocatore guida un velivolo o una barca (con 6 s di memoria, o sparirebbe
ogni volta che uno scafo tocca riva), e da tre stelle partono fino a **due motovedette** (경비정)
dal molo più vicino. Non speronano: tengono 170-300 px e sparano, perché uno scafo che ti affonda
in mezzo al Han è una morte senza appello e da una barca non si sbarca al largo.

**La SWAT tira le granate**, e le due misure che l'hanno tarata hanno cambiato il progetto due
volte. «Una sola granata in volo» **non è** un tetto di cadenza: la miccia dura 2,2 s, e con sei
uomini in strada diventa il periodo — ne partiva una ogni 2,5 s. E con la vecchia distanza di
ingaggio (120-240 px) la SWAT era quasi sempre **troppo vicina** per lanciare, visto che il
raggio dello scoppio è 155 px. Ora la SWAT tiene 190-320 px e la cadenza reale è 7,2-7,8 s.
Effetto collaterale misurato: un giocatore **fermo allo scoperto** a cinque stelle muore in
10-16 s invece di 8-15 (chi tiene più distanza sbaglia più colpi), mentre chi si è imboscato
dietro un riparo adesso lo si stana. Era lo scopo.

**Il traffico civile buca sui chiodi.** Sei veicoli per frame a rotazione, solo entro 700 px dal
giocatore, e testando **tre punti** lungo la carrozzeria invece del solo centro: a campionamento
rotante una striscia larga 22 px la si attraversa in 0,09 s e il centro la salterebbe una volta
su due. Misurato: 2 auto bucate in 40 s su 4 strisce. Occasionale, non continuo.

**I pedoni si riparano dalla pioggia.** Sopra `rain 0.35`, chi **non ha l'ombrello** ed è `shy`
(75%) si infila sotto il portone più vicino entro 340 px e ci resta al massimo 40 s; chi
l'ombrello ce l'ha tira dritto, che è il motivo per cui se lo porta. Tutti affrettano il passo
(×1,12: di più si legge come panico, non come pioggia). Il rientro ha una soglia **per pedone**
più un ritardo casuale, per la stessa ragione degli ombrelli (§5.11): vederli ripartire tutti
insieme tradirebbe l'effetto. Il tetto dei 40 s non è pigrizia — i fermi contano nel tetto dello
streaming, e senza rotazione il marciapiede si svuota una volta sola e resta vuoto per tutto il
temporale. Misurato: 20 al riparo su 90 pedoni sotto il temporale, 0 dopo 11 s di sereno.

**La pioggia bagna anche quello che c'era già.** Spegne le pozze della molotov —
`life × (1 + rain² × 3,6)`, al quadrato perché una pioggerella deve accorciare e un temporale
spegnere: 9,7 s sereno · 4,6 s pioggia · **2,1 s temporale**, e la pozza fuma mentre muore.
Lava il sangue (~14 s col temporale) ma **non le bruciature**: un cerchio di catrame bruciato
non se ne va con l'acqua. E a piedi si slitta: spazio d'arresto da 3,8 a 6,2 px (+63%). Era
stato provato a +89% e a schermo il passo laterale cominciava a pattinare — che è metà del
combattimento a piedi in questa visuale. **Dentro un edificio `rain` vale 0**: il temporale di
fuori non spegne una pozza in un 노래방.

**Il fuoco si propaga** (§3 per il meccanismo). Una molotov: picco 12-13 pozze, terza
generazione, tutto spento da solo in 10,5 s. Quattro molotov insieme: tetto tenuto a 22, fps
32-39, e `projectiles.count` torna a 0. **Un'auto sotto il 45% della lamiera accende l'asfalto
sotto di sé**, ed è quello che fa attraversare al fuoco una fila di macchine in sosta invece di
fermarsi al primo paraurti. Non attacca sull'acqua, dentro un solido né sotto `rain > 0.35`.

**La minigun si surriscalda.** 5,8 s dal grilletto all'inceppamento (100 colpi sui 600), 4,4 s
per ripartire: un nastro intero passa da 27 a ~53 s e vuole sei inceppamenti. Il calore sale
**a colpi** e non a secondi di grilletto, così la taratura resta «la raffica utile» qualunque
cadenza abbia un'arma futura, e finire le munizioni interrompe anche il surriscaldamento. Vale
solo per le armi con `spinUp`: la SMG non si inceppa. Da inceppata le canne **rallentano**, e
l'anello del calore nel mirino lampeggia — un rosso fisso lì si confonderebbe con l'anello dello
spin-up pieno, che a dodici pixel di distanza vuol dire l'esatto contrario.

**Il mercato ha un prezzo per quartiere** (§3). La pompa costa 98.500 al porto e 188.500 a
강남; le munizioni costano di più in campagna, dove non c'è concorrenza. Il listino lo dice
(`시세 강남` accanto all'insegna e lo scostamento su ogni riga), perché un prezzo che cambia
senza dirlo è un bug agli occhi di chi gioca. **Il giro compra-e-rivendi migliore rende ~700₩
per la traversata di Seoul**, contro i 20-90k di una cassa: esiste sulla carta e non è una zecca.

**Si rivendono i mezzi rubati.** `F` davanti a un 전당포 con un veicolo fermo entro 108 px —
nove metri, cioè la carreggiata davanti alla vetrina, perché un'auto accostata ha il centro a
mezza corsia dalla porta. Si vende **solo quello che hai guidato tu** (`v.hotwired`): senza, si
rivenderebbe l'auto in sosta di uno sconosciuto senza toccarla. Prezzo per tipo × stato
(`0,35 + 0,65 × hp/maxHp`: un rottame vale i pezzi) × gomme × mercato. Una volante viene
rifiutata **con una risposta**, non col silenzio: è la prima cosa che prova chiunque.

**Gli interni cambiano con l'ora.** Tre liste invece di una — `f.staff` (il ruolino,
permanente), `f.crowd` (la folla di passaggio, rifatta a ogni arrivo su un piano), `f.kept` (i
clienti morti, permanenti); `f.people` è la loro somma e resta quello che leggono `game.peds`,
mischia, raggi e onde d'urto. Ricalcolare tutto rimetterebbe in piedi il commesso steso, non
ricalcolare niente era il difetto. Un 술집 ha 5 persone alle 22 e 2 alle 3, un 사무실 è deserto
alle 18:30, un 편의점 ha un cliente solo di notte. Il velo della luce dentro continua a non
esserci (§3): quello che cambia è **la luce che entra dalla porta**, un fascio bianco a
mezzogiorno e un fondo d'arancione da lampione di notte.

**Si dorme per far passare il tempo.** Su un futon di un 주택: «dormi fino alle 06:30 · 8h»,
dissolvenza, orologio e giorno avanti, salute piena. `daycycle.advance` **fa girare** la catena
di Markov a passi di 5 s (96 iterazioni per otto ore) invece di teletrasportare l'ora:
svegliarsi con lo stesso temporale che c'era andando a letto vorrebbe dire che mentre dormivi
il tempo non è passato. Due mete e non un menù di orari — all'alba o a stasera — perché la
domanda di chi va a letto in un gioco è una sola. **Dormire non azzera il ricercato**, e sopra
le tre stelle non si dorme affatto («con le sirene là fuori non chiudi occhio»): il letto non
deve essere la risposta all'assedio.

**L'allarme silenzioso.** Una rapina con testimoni vivi fa partire un timer di 17 s; alla
scadenza la centrale sa, e l'heat sale ancora fino alla seconda stella. Il chiamante ha un
anello rosso che si svuota e una cornetta sopra la testa. **Un commesso già steso non chiama
nessuno**, e chi è armato e ti sta sparando nemmeno: rapinare un 총포상 costa un conflitto a
fuoco, rapinare un 편의점 una denuncia. Rapinare senza testimoni resta possibile ed è l'unico
modo di farla franca.

**La porta sul retro.** Al piano terra, un varco di 44 px nel muro di fondo che esce dietro
l'edificio. Sta **all'estremo** del muro e non in mezzo, perché quello è il muro dell'arredo e
un varco al centro lo spezzerebbe in due tronconi corti (§4, la trappola dei vani scala). Il
punto d'uscita si decide una volta sola e dev'essere libero, non in acqua, non sul bordo mappa:
**se non c'è posto il varco non viene proprio aperto**, perché un buco nel muro che non porta da
nessuna parte è peggio di un muro. **42 negozi su 113 (37%) ce l'hanno**; gli altri 71 hanno un
palazzo attaccato dietro — misurato, è sempre quello il motivo, mai l'acqua o il bordo.

**Le bande commerciano** (§3 per `canDeal`). Un 거래책 per territorio, riconoscibile a vista da
un anello nel colore della banda e da un rombo sospeso; si tratta **solo a mani vuote e senza
stelle**, che è la stessa soglia con cui `watchTurfs` decide se prendersela con te. Da qui in
poi quella regola non è più solo un modo di farsi sparare: è l'unica porta d'ingresso a un
mercato che i negozi non hanno. Quattro mestieri, quattro cose diverse — 백호파 vende armi
sotto mercato (e anche sniper e minigun, che in vetrina non ci sono), 흑사파 esplosivi e cure,
철마파 **compra** i mezzi pagando più del 전당포, 황소파 ricompra le armi al 56%. Le armi
comprate da una banda finiscono **in borsa, non in mano**: senza quella riga, comprare una
pistola dai 백호파 vorrebbe dire farsi sparare dai 백호파 mezzo secondo dopo averli pagati.
Il contatto non è invulnerabile: stenderlo costa 18 s prima che un altro prenda il suo posto.

**In campagna c'è qualcosa da raccogliere.** Le capezzagne dei campi e le teste dei moli, con
tabelle diverse da quelle urbane (una pompa da caccia in un fienile si spiega, una minigun no)
e una densità **un ordine di grandezza più bassa**: la campagna è vuota per progetto e deve
restare un posto in cui si va apposta. Le raccolte passano da 36 a **43**, e adesso si controlla
che il punto non sia murato — così si è scoperto che **la molotov garantita davanti alla
safehouse era dentro un solido da tre fasi di sviluppo**, e non l'aveva mai raccolta nessuno.

**Il ciclo del semaforo, finalmente misurato — e lasciato dov'era.** `SIGNAL_CYCLE` valeva
15,5 s «dai tempi in cui nessuno si fermava» (§6, vecchia edizione), e non era mai stato
provato con le code vere che il §5.10 ha introdotto. C'era anche un difetto silenzioso: le
fasi erano tre numeri scritti a mano che con `SIGNAL_CYCLE` non c'entravano niente, quindi
cambiarlo **non cambiava il verde**. Adesso è una manopola sola — il giallo è un intervallo di
sicurezza e resta fisso a 1 s, il verde si prende quello che avanza — e si può misurare per
davvero con `traffic-census.scene` (170 s su cinque zone, un albero per configurazione, in fila):

| ciclo | urti al minuto | flusso mediano (px/min) | veicoli praticamente fermi |
| --- | --- | --- | --- |
| 12 s | 36,0 | 4323 | 4 su 172 |
| 12 s, **seconda esecuzione** | 33,5 | 4035 | 8 su 184 |
| 15,5 s (quello di prima) | 38,5 | 3926 | 8 su 183 |
| 19 s | 34,2 | 3084 (**−21%**) | 23 su 179 |

**Il ciclo lungo è fuori discussione**: un quinto del flusso in meno e tre volte i fermi, perché
con 8,5 s di verde per asse la coda formata sul rosso non si smaltisce in un ciclo solo. Ma
**fra 12 e 15,5 non c'è differenza**, e la riga che lo dimostra è la seconda: due esecuzioni
della *stessa* configurazione si scostano del 7% sul flusso e del doppio sui fermi, cioè più
di quanto separi 12 da 15,5. La prima misura da sola (+10% e metà dei fermi) sembrava un
risultato; è rumore, ed è esattamente il caso contro cui §5.10 mette in guardia — «una
differenza del 10% non significa niente». **Il valore resta 15,5.** Quello che si porta a casa
è che adesso la manopola funziona, che il verso lungo è già stato provato e non conviene, e che
**il rumore di questa scena a configurazione ferma vale ~7%**: chi misura la prossima modifica
alla guida sa sotto quale soglia non deve credersi.

**Cuciture.** Cinque pezzi stavano a cavallo di file diversi**Cuciture.** Cinque pezzi stavano a cavallo di file diversi e sono stati collegati a parte:
l'anello del calore nel mirino; il peso proprio di un esplosivo nel ricercato (`blast` 6, cioè
il doppio di uno sparo — due granate in strada fanno una stella); `fx.update(dt, game)`, che
riporta la sbiadita del sangue dentro `Fx` invece di farla chiamare a `projectiles` solo per
via della firma; lo stallo di sosta liberato quando un'auto affonda; la targa a terra del
commissariato.

**Costo, misurato.** fps nella solita banda del container (43-58 a riposo, 32-39 con un incendio
da 22 pozze), `update` in strada da 1,0 a 0,9-1,0 ms mediani, `update` dentro un negozio
invariato a 0,2 ms. `city.stats` **identico** (`buildings 418, props 1299, blocks 122, nodes 196,
edges 279, doglegs 4, stairs 3`): niente di tutto questo ha spostato una `rng` in generazione.

---

## 6. Backlog successivo (già concordato con l'utente)

**Fase 3 — contenuti.** Negozi e interni (§5.8), la mappa (§5.9), il ciclo giorno-notte
(§5.11) e il giro di arretrati (§5.12) sono fatti; la segnalazione sul traffico è chiusa
(§5.10). **Restano le missioni**, che sono il lavoro grosso: impianto (attivazione sulla mappa,
obiettivi, fallimento e ripetizione), cutscene a pannelli a fumetto, e i contenuti. **Le scelte
di design vanno concordate con l'utente prima di scrivere codice** — è la prima cosa da chiedere
in apertura di sessione.

Quello che segue è quanto resta indietro, in ordine di quanto si sente. È molto più corto di
prima: il §5.12 ha pagato diciannove voci di questo elenco.

**Le cose che si sentono di più, oggi:**
- **Niente audio.** `game.audio` è ancora `null` e i quattro punti di chiamata esistenti
  (`honk`, `doorClose`) girano a vuoto con l'optional chaining. Un sintetizzatore WebAudio
  procedurale — spari, motore, sirene, pioggia, l'insegna che ronza — è la cosa che manca di
  più adesso che a schermo succede tutto. Non è difficile, è **diffuso**: i punti di chiamata
  vanno messi in quasi tutti i file.
- **Niente salvataggio.** Con del denaro in tasca, un arsenale comprato, un orologio che avanza
  e degli interni che si ricordano, chiudere la pagina butta via tutto. localStorage con 3 slot:
  la città è deterministica dalla seed, quindi si salvano solo giocatore, ricercato, orologio,
  statistiche e le poche cose che `shops.cache` ricorda davvero (casse svuotate, morti).
- **Arresto (busted).** La polizia spara e basta, non ti carica in volante. Adesso che assedia
  la porta è anche più strano che non lo faccia. Vedi §5.5 per le ragioni per cui era stato
  rimandato: raddoppia i flussi di fine partita (celle, cauzione, arsenale confiscato).

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
- **Nessuno chiama la polizia *da fuori***: l'allarme silenzioso alza l'heat, ma il commesso che
  scappa dalla porta non porta nessuno con sé in strada. Serve un aggancio in `pedestrians` al
  momento del `gone`.
- **Dal retro non si entra e non si sale**: la porta di servizio è solo un'uscita.
- **Chi dorme non paga niente**: il letto è gratis e cura del tutto. Se la clinica deve avere
  senso, la leva è curare solo in parte.
- **La folla non ricorda chi era lì**: due visite alla stessa ora hanno gli stessi posti ma
  persone nuove. Ricordarle vorrebbe dire una lista permanente per fascia oraria, e non si nota.
- **I 전당포 stanno in 4 distretti su 7**, quindi le tre righe più caratterizzate di
  `shops.MARKETS` (armi 0.68 e auto 1.35 al porto, munizioni 1.40 in campagna) si toccano solo
  attraverso il prezzo dell'officina. Un banco dei pegni per distretto in `citygen.placeShops`,
  come `placeGarages` fa con le officine, e il mercato si vedrebbe tutto.

**Rimasto indietro dalla polizia** (§5.5, §5.12):
- **Durante l'assedio non si posano blocchi né chiodi**: uscendo non si trova mai una transenna
  davanti alla porta. `manageObstacles` ragiona su un vettore velocità, e una porta non ce l'ha.
- **Durante l'assedio gli agenti attraversano i muri** (nessuna collisione, per scelta di costo):
  per un frame se ne può vedere uno dentro una vetrina prima che lo steering lo rimetta a posto.
- **Non si entra nei commissariati**: non esiste un `biz` `police` in `interiors.js`.
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

**Rimasto indietro dalla mappa** (§5.9) e dagli esplosivi (§5.7):
- **Nessun traffico aereo o navale**: aerei e barche civili sono tutti fermi. Un paio di battelli
  che fanno la spola sul Han costerebbero un `ai` semplice — il fiume è una linea, non serve grafo.
- **Le bande non si fanno la guerra e non si conquistano.** Adesso commerciano (§5.12), ma
  restano quattro banchi: niente faide, niente territori che cambiano padrone. È materia della
  storia.
- **In campagna c'è da raccogliere ma non da fare**: le attività secondarie (consegne, salti,
  corse) sono ancora la superficie migliore su cui metterle.
- **L'aeroporto non ha interni**: terminal e hangar sono volumi chiusi.
- **Il fuoco non attacca gli edifici**: lambisce le facciate e si ferma. Bruciare un palazzo
  vorrebbe dire uno stato sui volumi e un modo di disegnarlo.

**Fase 3 — quello che resta.**
12 missioni in 3 atti con cutscene a **pannelli a fumetto** (gli interni sono anche il posto
dove ambientarne metà: un incontro in un 노래방 non ha bisogno di niente di nuovo, un
appuntamento può avere un'ora, e adesso una banda ha anche un motivo per parlarti); attività
secondarie (taxi, consegne, salti); audio procedurale WebAudio e salvataggio localStorage, che
sono in cima all'elenco qui sopra.

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
| Dimensione mondo | `citygen.WORLD` | 5400 × 5400, margine 150 |
| Sagoma della città | `districts.URBAN_BLOBS` | 8 macchie, raggio 0.13–0.205 della larghezza |
| Soglia città/campagna | `citygen.RURAL_U` | 0.26 (sotto: solo una arteria su due) |
| Strade bianche in campagna | `citygen.carveMesh` | 6% dei tratti non arteriali |
| Mare: limite di maglia / battigia | `districts.SEA.x1`, `citygen.QUAY_W`, `coastAt` | 0.185 · banchina 128 px · battigia fino a 560 px più a ovest |
| Piattaforme (aeroporto, porto) | `citygen.planPlatform` | campate fra arterie: 2 bande in y l'aeroporto, 1 il porto |
| Aeroporto e porto (seed attuale) | `city.airport` / `city.port` | 1039 × 1530 · 1039 × 775 |
| Moli e ormeggi | `citygen`, sezione costa | 4 al porto + 6 sul Han · 14 imbarcazioni |
| Velivoli parcheggiati | `city.airSpots` | 3 turboelica + 3 elicotteri |
| Territori delle bande | `citygen.TURF_ANCHORS` | 6, su cortili e piazzali già esistenti |
| Passo della maglia | `districts.DISTRICTS[].grid.step` | 126–196 (Hongdae) … 330–480 (moli) |
| Superblocchi / disassamenti | `districts.DISTRICTS[].grid` | `superblock` 0.20→0.60, `jog` 0.08→0.62 |
| Isolato minimo ai lati di un dogleg | `citygen.planDoglegs` | `MIN_BLOCK` 62 |
| Ritaglio che diventa parco | `citygen.generateCity` | lato < 64 px (sopra: fila di negozi) |
| Vicolo passante | `citygen.fillUrbanBlock` | isolati > 320 px, fessura 38–54 |
| Quota: pianura / rilievi | `citygen.makeElevation` | 34 + rumore ±31 / Namsan +110, Bukhansan +150 |
| Forza dell'ombreggiatura | `ground.RELIEF_SLOPE` / ampiezza | 0.062 / ±44 (mappa: 0.07 / ±58) |
| Gravità in pendenza | `vehicle.SLOPE_G` / `MAX_SLOPE` | 780 / 0.14 |
| Forza della parallasse | `camera.PROJ` | 880 (più basso = più estrusione) |
| Direzione/lunghezza ombre | `camera.SUN` | 0.5 / 0.66, scala 0.42 |
| Larghezza carreggiate | `citygen.genLines` | boulevard 144, strada 76 |
| Corsie | `roadgraph.laneOffset` | 18/54 (boulevard), 19 (strada) |
| Traffico attivo | `traffic.MAX_TRAFFIC` | 44 (× densità distretto) — vedi §5.10 |
| Auto in sosta | `traffic.MAX_PARKED` | 24 |
| Spazio libero da fermi | `traffic.GAP_STOP` | 13 px fra i paraurti |
| Distanza voluta / reattività | `traffic.senseAhead` | `13 + v × 0.16` px · guadagno 2.6 |
| Spazio preteso oltre l'incrocio | `traffic.boxBlocked` | mezza giunzione + tutta la carrozzeria + 13 |
| Cortesia massima all'incrocio | `traffic.driveAI` `ai.boxT` | 3,5 s, poi si entra lo stesso |
| Prenotazione dell'incrocio | `driveAI` (solo nodi senza semaforo) | scade dopo 0,6 s senza rinnovo |
| Fermo troppo a lungo → manovra | `driveAI` `ai.stallT` | 9 s (il rosso più lungo dura 7,7 s) |
| Ciclo del semaforo | `roadgraph.SIGNAL_CYCLE` / `YELLOW` | 15,5 s (verde 6,75 per asse, giallo 1) — misurato in §5.12: 19 s è peggio, 12 s è indistinguibile |
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
| Densità delle vetrine | `citygen.placeShops` | `signDensity × 0.55` (139 negozi, 369 locali), una porta ogni 80 px |
| Attività per edificio | `citygen.makeShop` | `1 + (h3d − 30) / 46`, massimo 4 |
| Taglia di un interno | `interiors.buildInterior` | footprint × 1.8, limitato a 300-470 × 260-390 |
| Muri e vani scala | `interiors` `WALL` / `STAIR_W×H` / `DOOR_W` | 12 · 58×78 · 54 |
| Raggio della porta e del bancone | `shops` `DOOR_REACH` / `DESK_REACH` | 34 px / 54 px |
| Denaro iniziale · cassa · conto della clinica | `player.money` · `interiors` · `main.respawnPlayer` | ₩60.000 · ₩20.000-90.000 · 25% dei contanti |
| Officina e cambio d'abito | `shops` `GARAGE_PRICE` / `OUTFIT_PRICE` | ₩30.000 · ₩40.000 (−1 stella) |
| Prezzi delle armi | `weapons.WEAPONS` `price`/`ammoPrice` | pistola 65k · pompa 145k · SMG 240k · fucile 380k · sniper 620k · minigun 1.25M |
| Ricompra del banco dei pegni | `shops.stockFor` case `pawn` | 45% del prezzo |
| Peso della rapina | `wanted.CRIMES.rob` | 22 (una stella) |
| Zoom dentro un interno | `shops.roomZoom` | fit del piano, limitato a 1.15-2.6 |
| Durata di un giorno · ora d'inizio | `daycycle.DAY_SECONDS` · `DayCycle` | 24 minuti reali (1 min di orologio al secondo) · si parte alle 8:24 |
| Colore e forza della luce, ora per ora | `daycycle.KEYS` | 11 chiavi: `amb`+`k` (tinta), `warm`+`w` (velo caldo), `sx`/`sy` (ombra), `sh` (opacità) |
| Accensione delle luci artificiali | `daycycle.lampsAt` | 0 fino alle 17, 1 dalle 19:30 alle 5; `isNight` = `lamps > 0.5` |
| Tinta del cielo coperto | `daycycle.SLATE` · `apply` | `#8e96a4`, pesata `cloudiness × 0.62` |
| Durata delle condizioni di tempo | `daycycle.WEATHERS[].hours` | sereno 7-22 h · nuvoloso 5-16 · pioggia 4-12 · temporale 2-6 (ore di gioco) |
| Transizione fra due condizioni | `daycycle.updateWeather` | 25 s |
| Asciugatura dell'asfalto | `daycycle.update` (`wet`) | misurato: bagnato in 4,4 s, asciutto in 30 s |
| Passo di rotazione del sole | `scene.SUN_STEP` / `SHADOW_K` | 0.055 (una tacca ogni 30-50 s reali) / 0.84 |
| Gocce disegnate col temporale | `scene.RAIN_DROPS` | 340 tratti in un path solo |
| Aderenza e frenata sul bagnato | `vehicle.updateVehicle` | grip × (1 − wet·0.17), freno × (1 − wet·0.14) |
| Vista della polizia col buio e la pioggia | `police.visionScale` | × (1 − lamps·0.26) × (1 − rain·0.20) |
| Popolamento per fascia oraria | `daycycle.trafficScale` / `pedScale` | punta serale ×1.15 · notte fonda ×0.34 e ×0.2 · pioggia −18% e −55% |
| Pedoni con l'ombrello | `pedestrians.createPed` | 62%, tinta fra 6 (`UMBRELLAS`) |
| Orari dei locali | `interiors.BUSINESSES[].open` | `[apre, chiude]`, `[0,24]` = sempre; 편의점 · 병원 · 주택 non chiudono mai |
| Tile terreno | `ground.TILE` / `MAX_TILES` | 512 px / 96 |
| Volo: salita, tetto, velocità di rotazione | `sprites.VEHICLE_TYPES` `climb`/`ceiling`/`rotate` | elicottero 130 · 400 · da fermo; turboelica 105 · 460 · 250 px/s |
| Atterraggio duro / effetto suolo | `vehicle.HARD_LANDING`, `updateAircraft` | oltre 150 px/s di caduta si rompe; con discesa comandata sotto i 60 px si smorza a 140 |
| Caduta in stallo | `vehicle.GRAV_AIR` | 210 px/s² (ala sotto `rotate × 0.8`) |
| Imbarcazioni: grip e velocità | `VEHICLE_TYPES.boat` / `.ferry` | 0.34 · 400 px/s ; 0.26 · 215 px/s |
| Spinta a riva di una barca | `vehicle.resolveMarine` | 190 px/s verso l'acqua, campionata a 46 px su 8 direzioni |
| Affondamento di un mezzo di terra | `vehicle.sink` | 0.75 s in acqua, poi `onVehicleSunk` |
| Guardie per territorio · raggio di spawn | `pedestrians.spawnTurf` | max 4 · almeno 300 px dal giocatore |
| Provocazione di una banda | `pedestrians.watchTurfs` | arma diversa dai pugni **oppure** ricercato ≥ 1 stella |
| **— arretrati (§5.12) —** | | |
| Commissariati | `citygen`, sezione «Commissariati» | uno per distretto urbano (4 con la seed attuale), a più di 420 px dall'ospedale |
| Raggio del commissariato per lo spawn | `police.STATION_REACH` | 1600 px (oltre, si ricade sull'anello) |
| Assedio: agenti attorno alla porta / volanti / rinforzi | `police.siegeCop` · `siegeCar` · `siege` | 60-220 px · in corsia, 52 px oltre la porta e una ogni 78 · uno ogni 1,4 s |
| Richiamo dell'equipaggio | `police.RECALL_FAR` / `RECALL_LOST` / `RECALL_R` / `RECALL_GIVEUP` / `BOARD_R` | 750 px · 5 s · 260 px · 12 s · 30 px |
| Motovedette | `police.MAX_BOATS` / `MARINE_LEVEL` · `sprites.VEHICLE_TYPES.patrol` | max 2 · da 3 stelle, solo in acqua o in barca · 104×34, 355 px/s, grip 0,33, 190 HP |
| Elicottero anticipato | `police.updateChopper` (`offT`) | 3 stelle se in volo o in barca (memoria 6 s), 5 negli altri casi |
| Granata della SWAT | `police.NADE_MIN` / `NADE_MAX` / `NADE_CD` / `NADE_GAP` | 200-430 px · 9 s per agente · 5 s per la squadra · max 1 in volo |
| Distanza di ingaggio a piedi | `police.copBehavior` | SWAT 190-320 px, divisa 120-240 px |
| Chiodi sul traffico civile | `police.SPIKE_WATCH` / `SPIKE_SLICE` | 700 px · 6 veicoli per frame a rotazione, 3 punti per carrozzeria |
| Peso di un lancio esplosivo | `wanted.CRIMES.blast` | 6 (due granate = una stella) |
| Riparo dei pedoni | `pedestrians.RAIN_SHELTER` / `SHELTER_REACH` / `SHELTER_MAX` / `RAIN_HURRY` | 0.35 · 340 px · 40 s · ×(1 + rain × 0.12) |
| Chi si ripara | `pedestrians.createPed` `shy` | 75% di chi non ha l'ombrello (≈28% del totale) |
| Pioggia che spegne le pozze / lava il sangue | `projectiles.RAIN_DOUSE` · `fx.WASH_RATE` | `1 + rain² × 3.6` (9,7 / 4,6 / 2,1 s) · 0.05 di opacità al secondo × rain |
| Propagazione del fuoco | `projectiles.MAX_FIRES` / `SPREAD_EVERY` / `SPREAD_LIFE` / `SPREAD_R` / `RAIN_STOP` | 22 pozze · 0,9 s · vita × 0.62 · raggio × 0.86 · rain 0.35 |
| Auto che incendia l'asfalto | `projectiles.updateFires` | sotto il 45% della lamiera, 50% per tick |
| Minigun: calore | `player.HEAT_TIME` / `HEAT_COOL` / `HEAT_OK` / `HEAT_GRACE` | 4,5 s di raffica (100 colpi) · 0.16/s · riparte a 0.35 · 0,35 s di respiro |
| Scivolata a piedi sul bagnato | `player.WET_SLIDE` | 0.6 (dimezzamento 0.055 → 0.088 s) |
| Mercato per distretto | `shops.MARKETS` · `MARKET_BASE` | 7 distretti × armi/munizioni/generi/auto + ricompra · ×1 e 45% il riferimento |
| Arrotondamento dei prezzi | `shops.roundPrice` | 100₩ sotto i 20k, 500₩ sopra |
| Valore di un mezzo · consegna | `shops.CAR_VALUE` · `vehiclePrice` · `SELL_REACH` | scooter 18k … sportiva 210k … turboelica 900k · `0.35 + 0.65 × hp/maxHp`, gomme ×0.88 · 108 px, fermo sotto 24 px/s |
| Sconto delle bande | `shops.GANG_GUNS` / `SMUGGLE` / `CHOP` / `FENCE_BONUS` / `FENCE_CAP` | 0.88 · 1.18 · 1.42 · +0.14 · tetto 0.56 (tiene la catena in perdita) |
| Raggio del banco di una banda | `shops.DEAL_REACH` | 54 px a piedi, 108 al volante (철마파) |
| Rimpiazzo del 거래책 | `pedestrians.DEALER_WAIT` · `canDeal` | 18 s se lo hai steso, subito se l'ha portato via lo streaming · recinto + 80 px |
| Allarme silenzioso | `shops.ALARM_DELAY` · `updateAlarm` | 17 s · `rob × 0.55` ≈ 12 di heat (22 + 12 = seconda stella) |
| Gente di passaggio, ora per ora | `interiors.RUSH` · `crowd()` | frazione di `biz.crowd` per fasce, 13 tipi di locale · `crowd + 2` posti |
| Varco sul retro | `interiors.BACK_W` · `shops.backDoorSpot` / `SIDE_SCAN` | 44 px all'estremo del muro di fondo · fuori 18-60 px, di lato fino a ±124 (42 negozi su 113) |
| Sonno | `shops.sleepTarget` · `sleep` · `daycycle.advance` | 06:30 o 20:00 · vietato da 3 stelle · passi di 5 s reali |
| Luce dalla porta di un interno | `interiorscene.drawDoorLight` | profondità `34 + 78 × (1 − lamps)` px |
| Raccolte in campagna e sui moli | `pickups.RURAL_TABLE` / `PIER_TABLE` / `placeRural` | 32% dei campi · 85% dei moli del porto, 30% degli scali sul Han (43 raccolte in tutto) |
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

Le trappole delle prove scriptate (mira dal cursore, camera smorzata, griglie ricostruite ogni
frame, il giocatore fermo che muore) sono in §4, in fondo: leggerle prima di dare la colpa al
codice.

### `tools/scenes/` — scene pronte

Una scena è il **corpo di una funzione async**, non un modulo: dentro c'è `game`, si può fare
`await import('/src/…')` e si termina con `return` di quello che si vuole leggere. Per questo
l'estensione è `.scene` e non `.js` — l'hook su Write/Edit passa `node --check` su ogni `.js`,
e un `return` a livello di file lo farebbe fallire.

| Scena | Cosa misura |
| --- | --- |
| `traffic-census.scene` | urti al minuto e loro tipo, flusso in px/min per veicolo, su cinque zone. È la misura con cui è stato tarato §5.10 — e l'unica onesta per giudicare una modifica alla guida AI **o al ciclo del semaforo** (`roadgraph.SIGNAL_CYCLE`, che dalla §5.12 è una manopola sola: il giallo è fisso e il verde si prende quello che avanza) |
| `daylight-sweep.scene` | la luce ora per ora su tutto il giro, più quattro campioni col temporale. Serve a vedere in una tabella quello che altrimenti vuole ventiquattro screenshot: tinta, velo caldo, lampioni, ombre, popolamento |

⚠️ **Una misura alla volta.** La scena cambia zona a tempo di *orologio*, non di simulazione:
due censimenti che girano insieme sulla stessa macchina si rubano la CPU e i teletrasporti
cadono in istanti diversi. Ancora peggio se condividono l'albero, perché ognuno riscrive il
parametro che l'altro sta misurando — è un modo silenzioso di produrre numeri che sembrano buoni
e non vogliono dire niente. Un albero per configurazione (`git worktree add`), e in fila.

Per forzare ora e meteo in una scena qualunque: `game.dayCycle.hour = 21.5`,
`game.dayCycle.setWeather('storm')`, `game.dayCycle.paused = true`. Per misurare qualcosa che
dipende dal traffico **a tempo fermo**, incolla le prime due righe davanti a
`traffic-census.scene` — è così che è stato misurato il traffico sotto la pioggia in §5.11.

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
