# Verifica e diagnosi

> §1 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../HANDOFF.md).

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

### La mappa unica regge ancora? (§5.25)

Prima di dire che una modifica alla geografia funziona, il controllo che vale è **dove si
arriva guidando**. Una visita in ampiezza sul grafo lo dice in un secondo, e coglie l'errore
che a schermo non si vede: un arco di troppo che trasforma Jeju in una penisola.

```bash
node .claude/tools/probe.mjs --seconds 0 --quiet \
  --script .claude/tools/scenes/korea-census.scene
```

Gli invarianti da difendere:

| | atteso |
| --- | --- |
| nodi di Seoul e Busan raggiungibili su gomma da Seoul | **tutti** (306/306 e 177/177) |
| nodi di Jeju raggiungibili su gomma | **zero** su 294 — è un'isola |
| corridoio e sede dell'autostrada | asciutti |
| mare del sud, canale Busan–Jeju, Mar dell'Est | bagnati |
| segnaletica senza asfalto sotto | **zero** (`marks` e `segments` devono restare allineati) |
| campioni di carreggiata in acqua | **zero** |
| muri sul percorso Seoul → Busan | **zero** (la cintura di `citygen` va tolta alla fusione) |

I conteggi esatti si spostano a ogni `rng` in più consumato in generazione (vedi il
determinismo in `CLAUDE.md`): quello che non deve cambiare sono i **rapporti** — tutto
raggiungibile sulla terraferma, niente su Jeju.

Per guardarla invece che contarla, la carta a tutto schermo è la vista più informativa:

```bash
node .claude/tools/probe.mjs --seconds 2 --shot /tmp/korea.png --size 1400x900 \
  --script /dev/stdin <<'EOF'
game.mapView.open = true; game.paused = true;
await new Promise((r) => setTimeout(r, 300));
EOF
```

---

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
// vicoli ciechi veri: Seoul ne ha 16 e sono tutti sul bordo (x/y ≈ 238 o 6928)
game.city.graph.usableNodes.filter(n => n.out.length === 1).map(n => [n.x | 0, n.y | 0])
// quanta strada è stata tolta dai superblocchi, e quanti disassamenti sono nati
game.city.stats // { buildings, props, blocks, nodes, edges, doglegs, stairs }
```

Valori attesi con le seed attuali (§5.24): Seoul `7200×7200`, 842 edifici, 1987 props,
234 isolati e grafo `306/479`; Busan `6400×5600`, 741 edifici, 1456 props, 150 isolati e
grafo `177/300`; Jeju `5400×5400`, 377 edifici, 1376 props, 226 isolati e grafo `294/425`.
Sono tre generatori deterministici con firme topologiche distinte: Busan e Jeju non chiamano
`generateCity`. Seoul ha 16 fermate; le altre due 7 ciascuna. Ogni fermata deve avere una
`entrance.visible`, un prop `metro_entrance` solido e un arrivo asciutto, libero e fuori strada.

Per l'itinerario verso il blip (§5.30):

```js
// dove sta portando la carta, quanto è lunga la strada e da quanti tratti è fatta
({ meta: game.route.target, punti: game.route.points.length,
   strada: Math.round(game.route.length), inLineaDAria: game.route.direct })
// prova a freddo: un blip lontano e il percorso ricalcolato a mano
game.setMarker('mission', game.player.x + 2400, game.player.y + 2600, { label: '당구장' });
game.route.build(game, game.route.pick(game));
```

`direct: true` **non è un difetto**: vuol dire che le strade non ci arrivano, ed è la risposta
giusta per Jeju e per un blip in mezzo al mare. `punti: 0` con una missione attiva sì: o il blip
non c'è, o si è dentro un edificio (lì l'itinerario si ferma apposta, §3). La verifica completa,
con le asserzioni e il costo del caso peggiore, è
`.claude/tools/scenes/itinerario.scene` (§9).

Per i cortili (§5.31):

```js
// chi comanda dove, e quanto c'è da riscuotere
game.city.turfs.map((t) => `${t.place}: ${t.hangul}${t.held ? ' (tuo)' : ''} · ${Math.round(t.pot)}`)
// prova a freddo: un cortile passa di mano senza sparare un colpo
game.turfs.claim(game.city.turfs[0], 'baekho', game, 'deal')
```

Se il tag a terra resta del colore di prima, non è la `claim`: è la cache dei tile del terreno
(§4). La verifica completa, con il round-trip del salvataggio e le asserzioni, è
`.claude/tools/scenes/cortili.scene` (§9).

Per le regioni e la metro (§5.22-5.24):

```js
// identità e consistenza della regione attiva
({ regione: game.city.region, edifici: game.city.buildings.length,
   isolati: game.city.blocks.length, nodi: game.city.graph.usableNodes.length,
   negozi: game.city.shops.length, landmark: game.city.landmarks.length,
   fermate: game.city.transitStations.length })

// ogni uscita deve essere entro i confini, asciutta, fuori strada e fuori dai solidi
game.city.transitStations.filter((s) =>
  s.arrivalX < 0 || s.arrivalY < 0 || s.arrivalX > game.city.w || s.arrivalY > game.city.h ||
  game.city.isWater(s.arrivalX, s.arrivalY) || game.city.isOnRoad(s.arrivalX, s.arrivalY) ||
  game.city.solidGrid.queryCircle(s.arrivalX, s.arrivalY, 12).some((o) =>
    s.arrivalX > o.x - 12 && s.arrivalX < o.x + o.w + 12 &&
    s.arrivalY > o.y - 12 && s.arrivalY < o.y + o.h + 12))
// atteso: [] in tutte e tre le regioni

// ogni fermata ha un ingresso fisico associato al marker della carta
game.city.transitStations.filter((s) =>
  !s.entrance?.visible ||
  !game.city.props.some((p) => p.stationId === s.id && p.type === 'metro_entrance' &&
    p.solid && p.collisionW === s.entrance.w && p.collisionH === s.entrance.h))
// atteso: []

// il bordo fisico deve esistere su tutti e quattro gli angoli
[[1, 1], [game.city.w - 1, 1], [1, game.city.h - 1],
 [game.city.w - 1, game.city.h - 1]].filter(([x, y]) =>
  !game.city.solidGrid.queryCircle(x, y, 1).some((o) => o.isBoundary))
// atteso: []

// cambio regione a freddo; conserva inventario e orologio, ricostruisce i sistemi cittadini
game.travelTo('busan'); game.travelTo('jeju'); game.travelTo('seoul');
```

Valori attesi nell'ordine edifici / isolati / nodi / archi / negozi / landmark / fermate:
Seoul `842 / 234 / 306 / 479 / 240 / 21 / 16`, Busan
`741 / 150 / 177 / 300 / 140 / 6 / 7`, Jeju
`377 / 226 / 294 / 425 / 129 / 8 / 7`.

Verifica browser minima: a Seoul trovare il totem `M · 지하철` fuori dalle corsie, provare che
non sia attraversabile, premere `E`, osservare i passeggeri muoversi, comprare al chiosco e
camminare attraverso i tornelli fino alla banchina. Il tabellone si apre soltanto davanti al
treno. Poi viaggiare a Busan e Jeju e aprire le due carte: Busan mostra baia/Nakdong e Jeju il
mare su tutti e quattro i bordi. Gli hook locali sono `?regiontest=busan|jeju`,
`?metrotest=entrance|kiosk|platform` e `?edgetest=east`; servono solo alle prove e non cambiano
il percorso normale. La console deve restare senza errori. I tornelli devono rifiutare
l'ingresso con almeno una stella.

Dopo qualunque modifica a generatori, landmark o arredo, la sola query `isOnRoad` non basta:
va eseguito un audit rettangolare con `roadclearance.rectIntersectsRoad`, includendo larghezza
e rotazione di ogni volume. Il risultato atteso è zero per edifici ordinari, props solidi e
30 ingressi metro in tutte e tre le regioni.

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

Per i pedoni contro le lamiere ferme (§5.21):

```js
// nessuno deve essere piantato, e nessuno dentro un'auto
({ piantati: game.peds.filter((p) => p.stuckT > 1).length,
   dentroUnAuto: game.peds.filter((p) => !p.dead && game.vehicleGrid
     .queryCircle(p.x, p.y, 60).some((v) => !v.driver && Math.hypot(p.x - v.x, p.y - v.y) < 14)).length })
```

`dentroUnAuto` **deve essere 0**: non è una taratura, è un invariante. Per la misura vera, su
880 campioni in quattro zone, c'è `.claude/tools/scenes/walkers-census.scene` (§9).

Per gli spazi acustici e le voci (§5.21):

```js
// in che spazio si sta suonando, e quanto ritorno c'è in mezzo alla scena
game.audio.unlock();
game.audio.stats     // { …, spazio, verso, riverbero }
// dove si è, senza aspettare la lettura periodica (una ogni 0,3 s)
game.audio.pickSpace(game)
// forzarne uno: il cambio passa da una dissolvenza, non è immediato
game.audio.wantSpace = 'alley';
// le quattro voci, e chi ce l'ha
(async () => { const A = await import('/src/core/audio.js'); return Object.keys(A.SPACES); })()
game.peds.reduce((a, p) => (a[p.voice] = (a[p.voice] || 0) + 1, a), {})
game.audio.scream(game.camera.cx, game.camera.cy, 'anziano');
```

`spazio: null` vuol dire che il contesto audio non è mai partito (`updateSpace` gira solo a
contesto acceso): serve `unlock()`. `verso` diverso da `spazio` vuol dire che è in mezzo al
cambio. Per le code misurate c'è `.claude/tools/scenes/reverb-census.scene` (§9).

Per la partita nuova e il ritorno al titolo (§5.21):

```js
// da capo senza ricaricare la pagina; `toTitle` è `newGame` più il menu davanti
game.newGame();   game.toTitle();
// cosa deve tornare com'era
({ soldi: game.player.money, armi: game.player.owned.size, hp: game.player.hp,
   ora: +game.dayCycle.hour.toFixed(1), meteo: game.dayCycle.weather.id,
   stelle: game.wanted.level, km: Math.round(game.stats.distance),
   avviato: game.started, veicoli: game.vehicles.length, pedoni: game.peds.length })
```

Attesi dopo `newGame`: ₩60.000, 2 armi, 100 HP, le 8:24, `clear`, 0 stelle, 0 km, e la città
ripopolata (~60 veicoli, ~40 pedoni). `avviato` resta vero con `newGame` e diventa falso con
`toTitle`.

Per il salvataggio (§5.15) e l'arresto (§5.16):

```js
// cosa c'è nei tre slot, senza caricarli
const S = await import('/src/core/save.js');
[0, 1, 2].map((i) => { const d = S.readSlot(i); return d && S.describe(d, game); })
// le tre generazioni dell'autosave: la 0 è la più recente (§5.21)
[0, 1, 2].map((g) => { const d = S.readSlot(S.AUTO_SLOT, g); return d && S.describe(d, game); })
// scrivi, ricarica, cancella (nel gioco: ESC → Salvataggi)
S.writeSlot(0, game);   S.apply(game, S.readSlot(0));   S.clearSlot(0);
// quanto pesa davvero, e cosa c'è dentro
JSON.stringify(S.snapshot(game)).length / 1024
// arresto: la condizione del frame e il cronometro delle manette
({ ammanettabile: game.police.arresting, barra: +game.police.bustProgress.toFixed(2),
   celle: game.stats.busted })
// prova a freddo: due stelle, pugni in mano, e un agente addosso
game.player.setWeapon('fists'); game.wanted.add(30, game);
// ... aspetta che arrivi una pattuglia, poi ...
game.police.cops[0] && Object.assign(game.police.cops[0], { x: game.player.x + 30, y: game.player.y });
```

`arresting` falso con una pattuglia addosso ha **quattro** spiegazioni e sono tutte volute: hai
una bocca da fuoco in pugno, sei sopra le tre stelle, l'agente è della SWAT, oppure stai
menando (`player.swingT > 0`, §5.21 — la mazza *in mano* si lascia ammanettare, la mazza *in
movimento* no). **Il cronometro sta sul sistema e non sull'agente**: la condizione è del
giocatore, non di chi gli è addosso.

Per il menu iniziale (§5.18) e l'autosave (§5.20):

```js
// a che punto è l'avvio: `started` falso = si sta guardando il titolo
({ avviato: game.started, voci: game.startMenu.items.map((i) => i.label),
   pannello: game.startMenu.tab, quanto: +game.attractT.toFixed(1) })
// far partire la partita da console (è quello che fa Invio sul menu)
game.start(false);
// autosave: quanto manca al prossimo, se il momento è buono, e cosa c'è nello slot
const S = await import('/src/core/save.js');
({ fraQuanto: Math.round(game.autoT), sipuo: S.canAutosave(game), acceso: S.autosaveOn(),
   dentro: S.readSlot(S.AUTO_SLOT) && S.describe(S.readSlot(S.AUTO_SLOT), game) })
S.autosave(game, 'prova');   S.toggleAutosave();   S.latestSlot();
```

**`canAutosave` falso non è un difetto**: con le stelle addosso, quasi morti o con le manette
che si stringono l'autosave *deve* rifiutarsi (§5.20). `game.autoT` scende di 20 s alla volta
finché il momento non torna buono.

Per la musica (§5.19):

```js
// che pezzo sta suonando, quanto è forte, quanti strati ha
game.audio.music.stats     // { pezzo, verso, volume, intensita, voci, bpm, battuta }
// provarla a freddo: il tema, poi la caccia (`pezzo` cambia dopo ~2 s di dissolvenza)
game.audio.unlock();  game.wanted.add(60, game);
// gli stacchi suonano anche a musica spenta: hanno un bus loro
game.audio.music.sting('go');   game.audio.music.sting('busted');
```

`pezzo: null` in strada **è il comportamento giusto**: la musica suona solo sul menu e in
caccia. `verso` diverso da `pezzo` vuol dire che è in mezzo a una dissolvenza; `verso: null`
con tre stelle addosso vuol dire che è accesa la radio, che vince sempre.

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
game.city.shops.filter((s) => game.shops.shopOpen(s, game)).length   // su 240 a Seoul
game.shops.isOpen('guns', game)          // un tipo di attività
game.shops.nextOpening(s, game)          // { biz, at, wait } del piano che riapre prima
```

Per l'audio (§5.13):

```js
// stato del sintetizzatore: contesto, voci brevi vive (tetto 24), letti continui
game.audio.stats
// se `stato` non è "running" non sta suonando niente: nel browser serve un clic,
// in una prova scriptata si chiama unlock() a mano
game.audio.unlock();
// mix: master / sfx / ambient / ui, in [0,1]. Restano in localStorage.
game.audio.setVolume('master', 0.4);   game.audio.toggleMute();
// provare un suono a freddo, al centro camera
(async () => { const W = await import('/src/entities/weapons.js');
  game.audio.shot(W.WEAPONS.shotgun, game.camera.cx, game.camera.cy, true); })()
```

Per la radio (§5.14):

```js
// che sta facendo: off | cerco | sintonizzo | acceso, e quante stazioni ha trovato
game.radio.stats
// accendere, cambiare, spegnere da console (nel gioco: R e Shift+R)
game.radio.next(game);   game.radio.off(game);
// fissare una stazione propria: sopravvive alla directory e vince su di lei
localStorage.setItem('seoul.radio.stations', JSON.stringify([{ name: 'la mia', url: 'https://…' }]))
```

`stato: cerco` che non cambia mai vuol dire che la directory non risponde (rete, o mirror
giù); `rotte` che cresce vuol dire che le stazioni ci sono ma non mandano audio — quasi
sempre perché sono HLS travestite. **La radio non entra nel grafo di `audio.js`**: il suo
volume è `mix.master × mix.radio` scritto su un `<audio>`, vedi §5.14.

`letti` sono i suoni continui con il loro guadagno attuale: `citta pioggia vento mare
motore traffico sirena rotore fuoco gomme canne`. **Sono la diagnosi giusta**: se guidando
`motore` è 0, il letto non è agganciato al veicolo del giocatore; se `sirena` resta a 0 con
tre volanti addosso, `police.cars` non ha `siren`. Per i livelli veri (rms e picco) c'è
`.claude/tools/scenes/audio-census.scene` (§9), che è l'unico modo onesto di bilanciare
senza una cassa.

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
