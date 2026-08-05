# HANDOFF — Seoul Crashers

Documento per riprendere il lavoro da una sessione pulita. Leggi anche `README.md`
(descrizione del gioco e comandi) — qui c'è quello che serve a *sviluppare*.

Ultimo aggiornamento: **il traffico si muove bene** (§5.10) — la segnalazione aperta dell'utente
(«si muove in modo strano, molti incidenti o ingorghi») è chiusa: **−83% di urti** a flusso
sostanzialmente invariato. Prima c'era la mappa (§5.9: mare, aeroporto, porto, campagna, bande),
i negozi e gli interni (§5.8), la Fase 2 tappa C (arsenale pesante) e gli strumenti (`.claude/`, §9).

> 📌 **Da concordare con l'utente prima di scrivere codice:** la Fase 3 ha ancora due lavori
> indipendenti, **missioni** e **ciclo giorno-notte**. Sono di taglia molto diversa e l'utente
> vuole essere consultato sulle scelte di design (§7): chiedigli da quale partire. §6 ha
> l'elenco completo di quello che resta indietro, in ordine di quanto si sente.

---

## 1. Contesto in una pagina

Web game d'azione top-down 2.5D ambientato a Seoul, stile *GTA: Chinatown Wars*.
Canvas 2D puro, moduli ES nativi, **zero dipendenze, nessun build step**. Tutta la grafica
(sprite, facciate, terreno, mappa) è generata da codice a runtime: non esistono asset esterni.

Stato: **Fase 1, Fase 1.5, Fase 2 (tutte e tre le tappe) e le prime due tappe della Fase 3
completate e collaudate**, più la revisione della guida AI del traffico (§5.10). ~13.500 righe
in 32 moduli. 60 fps con ~44 veicoli e ~93 pedoni attivi, e restano 60 anche sotto raffica
continua di SMG. Dentro un edificio il costo è trascurabile: la città non gira.

**Il mondo è 5400×5400 e la città non lo riempie: ha una sagoma.** A ovest il mare, con
l'aeroporto di Gimpo e il porto di Incheon sulla costa e la campagna in mezzo; a est, nord e
sud le colline. Si vola (elicottero, turboelica) e si naviga (motoscafo, battello); in acqua
si annega e le auto affondano. Sei territori di bande occupano cortili, piazzali e capannoni.

La Fase 2 era divisa in tre tappe, concordate con l'utente: **A** combattimento base,
**B** polizia e ricercato a 5 livelli, **C** armi pesanti ed esplosivi. **Sono tutte fatte.**
La Fase 3 (contenuti) è cominciata da **negozi e interni** (§5.8), che era una delle tre
partenze possibili; restano missioni e ciclo giorno-notte, §6.

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
`garages 7`, `turfs 6`, e 36 raccolte a terra (`game.pickups.items.length`).
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
polizia, ricercato e raccolte **non stanno girando**, e `game.area()` restituisce la pianta
del piano invece della città.

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
  interiors.js        catalogo delle attività + generazione della pianta di ogni piano
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
  si vuole più densità, la leva vera è il ciclo del semaforo (`SIGNAL_CYCLE`, 15,5 s), non
  `MAX_TRAFFIC`.
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

---

## 6. Backlog successivo (già concordato con l'utente)

**Fase 3 — contenuti.** È in corso: negozi e interni (§5.8) e la mappa (§5.9) sono fatti, e la
segnalazione sul traffico è chiusa (§5.10). Restano **missioni** e **ciclo giorno-notte**, due
lavori indipendenti e di taglia molto diversa. **Conviene farsi dire dall'utente da quale dei
due partire** — è la prima cosa da chiedere in apertura di sessione.

**Cose rimaste indietro dai negozi**, in ordine di quanto si sentono:
- **La polizia non ti aspetta fuori.** Entrare con quattro stelle e uscire dopo un minuto ti
  ridà la strada esattamente com'era. Basterebbe far girare `police.update` anche mentre sei
  dentro (il ricercato è già congelato apposta): costa un ramo in `main.update` e regala la
  scena migliore di tutta la meccanica.
- **Nessuno chiama la polizia da dentro.** Una rapina alza l'heat, ma il commesso che scappa
  dalla porta non porta nessuno con sé.
- **Gli interni non hanno finestre né retro**: una sola uscita, quella da cui sei entrato.
  Una porta sul retro che dà nel cortile dell'isolato sarebbe la via di fuga che manca.
- **I locali non hanno orari**: sono tutti aperti sempre. Con il ciclo giorno-notte diventerà
  la prima cosa da chiedersi (`game.isNight` è già lì).
- **Il mercato nero dinamico** — prezzi diversi per distretto — è due righe in `stockFor` più
  un moltiplicatore per distretto, ed è quello che rende sensato attraversare la città.
- **Niente ruba-e-rivendi**: il banco dei pegni ricompra solo le armi, non le auto.

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

**Cose rimaste indietro dal traffico** (§5.10), in ordine di quanto si sentono:
- **Nessuno sorpassa.** Sull'arteria le due corsie per senso restano inutilizzate e dietro al
  primo furgone lento si incolonna tutto. Un tentativo è già stato fatto e misurato peggiore:
  §5.10 dice cosa manca (scegliere la corsia in base alla svolta successiva).
- **Il ciclo del semaforo non è mai stato tarato con code vere.** `SIGNAL_CYCLE` vale 15,5 s
  dai tempi in cui nessuno si fermava. È la leva giusta se si vuole rialzare `MAX_TRAFFIC`.
- **Il traffico civile ignora ancora i chiodi** e **non sa niente della quota**: un'auto in
  salita rallenta per fisica ma non se lo aspetta, e alza il gas dopo.
- **Non c'è priorità fra i mezzi.** Un autobus (158 px) e uno scooter (44 px) trattano
  l'incrocio allo stesso modo, e il primo lo occupa per il doppio del tempo.

**Cose rimaste indietro dalla mappa nuova**, in ordine di quanto si sentono:
- **In volo e in barca la polizia non ti prende.** A cinque stelle l'elicottero c'è, ma sotto
  non esiste nessuna unità che segua un velivolo o una barca: si scappa banalmente. Un
  elicottero d'inseguimento anticipato a tre stelle e una motovedetta al porto sarebbero due
  riusi quasi diretti di `police.spawnCar`.
- **Nessun traffico aereo o navale**: aerei e barche sono tutti fermi. Un paio di battelli che
  fanno la spola sul Han costerebbero un `ai` semplice (nessun grafo: il fiume è una linea).
- **In campagna non c'è niente da fare**: nessun negozio (le cascine non hanno vetrine), nessuna
  officina utile, nessuna raccolta. È la superficie migliore su cui mettere le attività
  secondarie (consegne, salti, corse) quando arriveranno.
- **Le bande non hanno un'economia.** Occupano, difendono e basta: non vendono, non comprano,
  non si fanno la guerra. `city.turfs` ha già `trade` per banda e non lo legge nessuno.
- **L'aeroporto non ha interni**: terminal e hangar sono volumi chiusi.

**Fase 3 — quello che resta.**
12 missioni in 3 atti con cutscene a **pannelli a fumetto** (gli interni sono anche il posto
dove ambientarne metà: un incontro in un 노래방 non ha bisogno di niente di nuovo); attività
secondarie (taxi, consegne, salti); ciclo giorno-notte e meteo (`game.isNight` è già
consultato da lampioni, fari e insegne); audio procedurale WebAudio (`game.audio` è già
chiamato con optional chaining: `honk`, `doorClose`); salvataggio localStorage con 3 slot —
ora che c'è del denaro e un arsenale comprato, il salvataggio serve davvero.

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
| Ciclo del semaforo | `roadgraph.SIGNAL_CYCLE` | 15,5 s (verde 6,8 per asse) |
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
| Tile terreno | `ground.TILE` / `MAX_TILES` | 512 px / 96 |
| Volo: salita, tetto, velocità di rotazione | `sprites.VEHICLE_TYPES` `climb`/`ceiling`/`rotate` | elicottero 130 · 400 · da fermo; turboelica 105 · 460 · 250 px/s |
| Atterraggio duro / effetto suolo | `vehicle.HARD_LANDING`, `updateAircraft` | oltre 150 px/s di caduta si rompe; con discesa comandata sotto i 60 px si smorza a 140 |
| Caduta in stallo | `vehicle.GRAV_AIR` | 210 px/s² (ala sotto `rotate × 0.8`) |
| Imbarcazioni: grip e velocità | `VEHICLE_TYPES.boat` / `.ferry` | 0.34 · 400 px/s ; 0.26 · 215 px/s |
| Spinta a riva di una barca | `vehicle.resolveMarine` | 190 px/s verso l'acqua, campionata a 46 px su 8 direzioni |
| Affondamento di un mezzo di terra | `vehicle.sink` | 0.75 s in acqua, poi `onVehicleSunk` |
| Guardie per territorio · raggio di spawn | `pedestrians.spawnTurf` | max 4 · almeno 300 px dal giocatore |
| Provocazione di una banda | `pedestrians.watchTurfs` | arma diversa dai pugni **oppure** ricercato ≥ 1 stella |
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
| `traffic-census.scene` | urti al minuto e loro tipo, flusso in px/min per veicolo, su cinque zone. È la misura con cui è stato tarato §5.10 — e l'unica onesta per giudicare una modifica alla guida AI |

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
