# L'impianto della campagna

> §5.27 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.27 — Cinque limiti tecnici tolti di mezzo prima di scrivere una missione

Questa tappa **non aggiunge niente che si veda**. Serviva a togliere i punti in cui il motore
avrebbe fatto resistenza alla campagna: cinque cose che, lasciate lì, si sarebbero pagate a
interessi composti a partire dalla prima missione.

Il criterio con cui sono state scelte: ognuna è un problema *del motore*, non della storia, e
ognuna sarebbe stata **più cara dopo**. Quello che invece dipende dal copione — pannelli,
cutscene, dialoghi — è rimasto fuori apposta.

---

**1. Il bus di eventi (`core/events.js`).** I fatti del mondo si dicevano con otto callback
fissi su `Game` (`onPedKilled`, `onVehicleDestroyed`, …), chiamati da tredici punti fra
`vehicle.js`, `player.js`, `pedestrians.js`, `projectiles.js` e `shops.js`. Funzionava perché
c'era **un solo** ascoltatore: `Game` stesso. Dodici missioni con cinque fasi e due condizioni
per fase fanno un centinaio di inneschi, e a quel modo sarebbero stati un centinaio di `if`
dentro `main.js`.

I callback ci sono ancora e i chiamanti non sono stati toccati: ognuno **finisce con un
`emit`**. Chi vuole *osservare* un fatto si iscrive. Due dettagli non sono decorativi: si itera
su una **copia** della lista (un iscritto che si disiscrive mentre viene chiamato è il caso
normale — una fase che si chiude proprio sull'evento che aspettava) e l'eccezione di un
iscritto **non ferma il frame**, perché un innesco scritto male non deve spegnere il gioco a
metà inseguimento.

Il primo cliente vero è già in casa: `ActorSystem` sa che un personaggio è morto perché è
iscritto a `pedKilled`, non perché lo controlla ogni frame.

**2. La tabella delle modalità (`core/modes.js`).** `paused` era una riga di `main.update` con
quattro `or` dentro, e le modalità del gioco erano dieci booleani sparsi (`started`, `paused`,
`indoors`, `menu.open`, `mapView.open`, `shopMenu.open`, `metro.open`, `startMenu.open`,
`shops.active`, `metro.inside`). Ha retto finché erano due e mezzo: si gioca, c'è un pannello
davanti, si guarda il titolo.

Le modalità che servono alla campagna non sono nessuna delle tre. Un dialogo di missione vuole
il mondo fermo come un menu, il giocatore fermo come un menu e **qualcosa che anima lo stesso**
come il gioco. Scritta a booleani sarebbe stata la quinta condizione di quella riga **più un
ramo in ognuno dei posti che leggono `game.paused`** — e quelli sono in altri file.

Adesso ogni modalità dichiara cosa concede (`worldRuns`, `playerRuns`, `duck`, `radioDuck`,
`cursor`) e **`game.paused` è derivato**. Chi lo leggeva funziona senza saperlo; `audio.updateBeds`
e `radio.contextGain` prendono i due `duck` dalla tabella invece di avere il numero scritto in
casa. Non è una pila: l'ordine della lista *è* la priorità. Diventerà una pila il giorno che due
modalità si sovrappongono davvero, e quel giorno cambia quel file e nient'altro.

**3. Il salvataggio si migra invece di rifiutarsi (`core/save.js`).** Era il debito più
pericoloso e il meno visibile: `readSlot` buttava qualunque slot con `v` diverso da `VERSION`.
Cioè **il primo campo nuovo che qualcuno avesse aggiunto — l'avanzamento della storia, i cortili
persistenti, un flag di finale — avrebbe cancellato la partita di chiunque.**

Adesso c'è `MIGRATIONS`, una catena di scalini `n → n+1` applicati in fila: per un formato nuovo
si scrive **solo l'ultimo scalino**, e chi arriva da tre versioni fa ci passa da solo. Uno slot
*dal futuro* resta rifiutato, perché indovinare cosa contiene è peggio che dire «non lo so
leggere». La **seed** resta l'unica ragione per buttarne uno davvero: una Seoul diversa rende le
coordinate salvate prive di significato.

Insieme è cambiato **chi possiede cosa**. `save.js` importava `WEATHERS` e leggeva a mano i
campi interni di player, orologio, ricercato e negozi; adesso ogni sistema ha il suo
`snapshot()`/`restore()` — `Player`, `DayCycle`, `WantedSystem`, `ShopSystem`, `ActorSystem` — e
`save.js` non sa più *che cosa* contengano, sa dove metterli. Era già il modo in cui `ShopSystem`
gestiva le casse svuotate: adesso vale per tutti. Il primo scalino, `1 → 2`, è proprio questo:
i contatori dei negozi e le piante visitate stavano in due chiavi diverse e adesso stanno
insieme.

Il salvataggio resta di **0,8 kB**.

**4. I personaggi nominati (`entities/actors.js`).** Tutto quello che cammina è streaming puro:
compare fuori inquadratura, sparisce oltre l'anello, e se torni indietro non è la stessa persona.
Va benissimo per una folla e non funziona per nessuno che abbia un nome — uno che ti aspetta
dietro un banco non può svanire perché sei andato a prendere l'auto, né essere ricreato vivo
dopo che l'hai ammazzato. L'unico precedente erano i mezzi `moored`.

Vale la regola della polizia e della vita degli NPC: **nessuna entità nuova**. Un attore è un
pedone di `game.peds` con `p.actor`. Quello che il sistema possiede non è il pedone, è la
**definizione** — e la differenza è tutta lì: il pedone viene despawnato come tutti (con l'anello
largo di chi è dentro un fatto di `life.js`) e **ricreato al suo posto** quando si torna, perché
la posizione sta nella definizione; quello che non si ricrea è la **morte**, che sta anch'essa
nella definizione, arriva dal bus e finisce nel salvataggio. Non gira dentro un edificio, dove
`game.peds` è scambiato con la gente del piano.

Oggi **non c'è nessun personaggio definito**: li definirà la prima missione che ne ha bisogno.
Il meccanismo però è provato, e la prova sta nel §9.

**5. Le due cose piccole.** Una porta può essere chiusa **senza che sia l'orario**
(`shops.sealed`): è un fatto capitato a *quella* vetrina — la serranda col sigillo di perizia —
non una proprietà dell'attività, passa da `shopOpen` che era già l'unico varco, e sta nel
salvataggio. E `game.markers` esisteva da sempre, letto da `hud.drawMinimap` e da
`mapview.drawPanel`, **senza che nessuno lo scrivesse**: adesso c'è `setMarker(id, …)`, con
l'`id` perché il caso normale è spostare il blip, non accumularne.

---

**Cosa resta fuori, e perché.** I pannelli a fumetto e la cutscene iniziale erano la tappa A del
piano in `docs/storia/08-domande-aperte.md` e non sono qui: dipendono dal copione e da scelte di
resa grafica che si concordano guardandole, non si deducono. Restano da fare, con il loro
impianto già pronto — `ui/text.js` (a capo automatico a corpo fisso, che il gioco non aveva mai
avuto) è la parte di quella tappa che era utile a prescindere, e infatti è rimasta.
