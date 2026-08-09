# Trappole già pagate

> §4 e §4bis del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../HANDOFF.md).

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
| L'ambiente copre gli spari | il rumore rosa è ~3× più forte del bianco a parità di guadagno, e i letti erano tarati a occhio: misurato, l'ambiente aveva **lo stesso rms di un colpo di pistola** | buffer rosa normalizzato in `audio.makeNoise`, guadagni dei letti scesi di 3×, e `audio-census.scene` per non rifarlo a occhio |
| Una porta che si chiude non si sente | il suono nasceva **prima** di `camera.snapTo`, con l'ascoltatore ancora dentro la stanza: risultava a 2000 px e veniva scartato | `shops.stepOutside`, chiamata in coda alla funzione |
| Spegnendo la radio si riaccendeva sulla stazione dopo | staccare la sorgente da un `<audio>` (`removeAttribute('src')` + `load()`) fa scattare un `error`, e il gestore lo leggeva come «stazione muta, passo alla prossima» | `radio.fail`, uscita immediata se la radio è spenta |
| La radio suona in un `MediaElementAudioSourceNode`… muta | una sorgente di un'altra origine senza CORS **tainta** il nodo: il grafo gira, l'audio no. È la norma per gli Icecast delle emittenti | la radio **non** passa da WebAudio: `<audio>` e `el.volume` (§5.14) |
| Una stazione «rotta» che nell'app dell'emittente funziona | è HLS (`.m3u8`) o una playlist (`.pls`): `<audio>` non le sa leggere, e senza librerie non c'è modo | `radio.usable`, filtro sull'estensione e sul codec |
| **In una prova scriptata** l'audio non suona mai | senza gesto dell'utente il contesto resta sospeso, e sospeso vuol dire orologio fermo | `probe.mjs` passa `--autoplay-policy=no-user-gesture-required`; la scena chiama `game.audio.unlock()` |
| **In una prova scriptata** il ricercato torna a 0 da solo | il giocatore fermo allo spawn viene investito, oppure a cinque stelle la SWAT lo ammazza in ~8 s: la morte azzera tutto | metterlo su un marciapiede (`city.hospitals[i]`) e campionare entro 7 s |
| Il giocatore attraversa le auto e ci cammina sopra | `player.resolveCollisions` interrogava solo `area.grid` (edifici, props, limiti): i veicoli non ci sono mai stati, e in una visuale dall'alto il tetto è disegnato più in alto del marciapiede | `player.resolveVehicleCollisions`, sui tre cerchi di `collisionCircles` — **prima** dei muri, o un'auto ti spinge dentro una vetrina |
| Espulso da un'auto con spinta di lunghezza zero | il giocatore esattamente sull'asse del veicolo: la normale è `(0,0)` e la spinta non esiste | `resolveVehicleCollisions`, ripiego sulla perpendicolare al muso (da sotto un'auto si esce di fianco) |
| **In una prova scriptata** il giocatore non risponde a niente | il menu iniziale è ancora a schermo: `player.update` non viene chiamato finché `game.started` è falso (§5.18) | `probe.mjs` apre la pagina con `?autostart=1`; a mano si chiama `game.start(false)` |
| **In una prova scriptata** la musica della caccia si spegne da sola a metà misura | a cinque stelle la SWAT stende il giocatore, `player.dying` diventa vero e la regia toglie il pezzo | `pl.hp = 1e6` mentre si misura, come già serviva per il ricercato |
| Uno stacco musicale non si sente proprio dove serviva | il bus del pezzo è a zero (è lì che la musica tace): quello che ci passa dentro esce a volume zero | `music.stings`, un bus che non sfuma mai, separato da `music.bus` |
| Il commesso in fuga cammina per sempre con `p.home` nullo (`TypeError` a ogni frame) | il passaggio in strada azzerava `gone`, e la sala toglie dal ruolino **solo** chi ha `gone` alzato: restava in due liste | `shops.updateInside`, `spillOutside` chiamata **dopo** lo splice, non dove `gone` viene alzato |
| Metà dei marciapiedi di Seoul suona come un vicolo | il riverbero sceglieva lo spazio **contando** gli edifici vicini: un marciapiede qualunque ne ha tre a novanta pixel, ma tutti dalla stessa parte | `audio.pickSpace` conta i **lati** da cui arrivano i muri (`ALLEY_SIDES`), non gli edifici |
| Il riverbero cambia stanza con un clic udibile | la coda di un `ConvolverNode` non si può sostituire mentre ci passa del segnale | `audio.updateSpace`: si sfuma il ritorno a zero e **solo lì** si cambia `rev.buffer` — stesso idioma di `music.direct` |
| Passando da una stanza a un capannone il volume raddoppia invece di allargarsi | l'energia di una risposta all'impulso cresce con la sua durata | `audio.makeImpulse` normalizza ogni coda a energia uno, e `rev.normalize = false` |
| Un riverbero che suona a molla invece che a stanza | il rumore veniva filtrato *dopo* essere stato inviluppato, non mentre decade: la coda si spegneva senza perdere brillantezza | `makeImpulse`, il passa-basso a un polo è dentro il ciclo del campione |
| Una coda di riverbero che si sente più forte invece che più larga | lo stesso rumore nei due canali: in mono la coda collassa al centro | `makeImpulse` genera i due canali separatamente, e sfasa le prime riflessioni |
| **In una prova scriptata** la coda misurata dura tre secondi anche in mezzo a un campo | un tamponamento a due isolati e un clacson finiscono sullo stesso bus del colpo di prova | fermare il mondo con `game.menu.open = true` (`game.paused` da solo viene ricalcolato ogni frame) e azzerare i letti sostituendo `audio.updateBeds` |
| **In una prova scriptata** `shops.enter` non entra e `active` resta nullo | la serranda è abbassata a quell'ora, oppure il giocatore è lontano dalla porta | teletrasportarlo su `shop.x/y`, entrare a un'ora di apertura, e **spostare l'orologio dopo** |
| **In una prova scriptata** l'interno si chiude fra un `await` e l'altro | `shops.update` gira a ogni frame e può portare fuori il giocatore | la sequenza entra-sali-agisci si fa **sincrona**, come lo snippet di §1 |
| La metro viene disegnata come un commissariato | `city.stations` sembra il nome naturale, ma nel progetto storico contiene le stazioni di polizia | le fermate passeggeri vivono solo in `city.transitStations`; non rinominare il campo della polizia |
| Un landmark si vede ma lo si attraversa | gli adattatori regionali aggiungono edifici dopo che `generateCity` ha già costruito le griglie | `regions.reindex` ricostruisce insieme `buildingGrid`, `solidGrid`, `propGrid` e `blockGrid` dopo l'adattamento |
| Arrivando al COEX si nasce dentro il centro commerciale | la coordinata editoriale della stazione coincide col landmark, e `+24,+24` non basta a uscire da un volume largo 266 px | le fermate vengono agganciate alla strada e ricevono `arrivalX/Y` cercati liberi in otto direzioni fino a 120 px |
| A Busan continua a spawnare la polizia di Seoul | `PoliceSystem`, `TrafficSystem`, `ShopSystem`, renderer, HUD e griglie trattengono tutti un riferimento alla città del costruttore | `Game.travelTo` ricostruisce **insieme** tutti i sistemi city-bound; non cambiare solo `game.city` |
| La N Seoul Tower scompare con una seed valida | il parco la generava solo se un isolato cadeva entro il 45% del raggio del Namsan; alcune maglie non ne producono nessuno | `seoul_expansion` la garantisce per nome ed è idempotente se `citygen` l'ha già piazzata |
| Il pannello metro di Seoul ha righe sovrapposte | 17 destinazioni in una colonna riducono la riga a 25 px, ma titolo e dettaglio ne usano 39 | sopra nove opzioni `MetroSystem.draw` usa due colonne e calcola l'altezza sul numero di righe |
| Busan o Jeju sembrano ancora Seoul | `GroundRenderer` e `maptexture` conoscevano soltanto Han e mare occidentale, quindi una nuova topologia dati non bastava | per le regioni non-Seoul entrambi campionano `city.isWater`; non aggiungere un altro caso geografico hardcoded |
| Busan si deforma sulla carta | una scala sola ricavata da `city.w` funziona soltanto per mondi quadrati; Busan è 6400×5600 | `maptexture` mantiene `kx` e `ky` separate per ogni geometria |
| L'ingresso metro si vede ma nasce in acqua, dentro un landmark o sulle corsie | la coordinata della stazione è editoriale e può coincidere con un incrocio, un edificio o la costa; misurare solo la distanza dall'asse stradale ignora metà carreggiata | `regions.reindex` cerca una scala 86×58 asciutta e libera usando `roadclearance.rectIntersectsRoad`, associa `station.entrance`, poi cerca `arrivalX/Y` fuori strada attorno alla scala |
| Un tetto sembra fuori dall'asse ma copre ancora una corsia | il grafo descrive il percorso dei veicoli, non il rettangolo asfaltato; boulevard e strade hanno larghezze diverse | ogni controllo di piazzamento usa le linee attive e la loro `width` tramite `roadclearance.js`, non soltanto nodi o archi centrali |
| Uscendo dalla metro si riappare dentro la scala | quando l'ingresso è diventato solido, salvarne il centro come posizione esterna ha trasformato una coordinata valida in una collisione | `MetroSystem.enterStation` conserva la posizione reale del giocatore, già verificata dall'interazione |
| Entrando in metro il giocatore viene espulso di lato | `entry` cade dentro un pilastro/arredo e il primo frame di collisione corregge il punto iniziale | ogni cambio alla pianta 1080×720 va verificato con raggio giocatore: ingresso, uscita e porta del treno liberi e percorso connesso |

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

## 4ter. Trappole della mappa unica (§5.25)

**Traslare `piers`, `river` o `coastAt` di una regione la rende cieca.** `isWater` di Seoul,
Busan e Jeju rilegge quei campi *dal `city`* a ogni chiamata: se li si sposta nello spazio di
mondo, la funzione — che riceve coordinate locali — li confronta con numeri che stanno seimila
pixel più in là e comincia a dire che il porto è asciutto e che la strada è mare. Vanno lasciati
locali, e al mondo si danno delle copie. Lo stesso vale per `w`/`h`: `districtAt` di Jeju li usa
per normalizzare.

**Un alias spostato due volte finisce altrove.** Il cortile di un isolato è anche uno dei suoi
`yards`, il territorio di una banda è il cortile su cui è dipinto, la porta di un'officina è il
`doorPoint` che ha generato il negozio. Una traslazione che percorra tutte le liste senza
ricordarsi cosa ha già visto raddoppia l'offset su quegli oggetti. Il `WeakSet` in
`korea.shiftCity` è lì per questo.

**`marks` va traslato insieme a `segments`.** Sono le stesse coordinate lungo la linea, e i
tratti di segnaletica non hanno un asfalto proprio: stanno sopra quello dei segmenti. Traslarne
uno solo lascia le righe bianche, le linee gialle e le scritte 버스 di una città sparse sulla
campagna e sul mare di un'altra, **senza un pixel di strada sotto** — e il difetto non dà
nessun errore, perché ogni singolo pezzo è formalmente valido.

**La cintura invalicabile di Seoul era il limite di *quel* mondo.** `citygen` chiude la mappa
con quattro volumi solidi (`isBelt`) sui margini: quando Seoul era il mondo intero erano il
bordo giocabile, adesso sono un muro invisibile fra la capitale e la campagna, ed è esattamente
quello che questa tappa esiste per togliere. Il sintomo è una fascia verde che attraversa lo
schermo con le auto incolonnate contro. Il limite del mondo è uno solo, e lo mettono i
`boundaryColliders` di `regions.reindex` ai bordi della Corea.

**Due carreggiate che si incontrano devono sovrapporsi, non toccarsi.** Se il tratto orizzontale
comincia sull'*asse* di quello verticale invece che sul suo bordo esterno, all'angolo resta un
quadrante di terra grande quanto un quarto di incrocio. E l'innesto va su un'**arteria**: una
carreggiata da 144 px attaccata a una via secondaria da 76 dà lo stesso scalino, con in più la
corsia esterna (offset 54) che finisce fuori dall'asfalto.

**`l.on[j]` non significa più niente dopo la fusione.** L'indice `j` individua la *j*-esima
perpendicolare della **stessa** maglia: con le linee di tre città in un array solo punta a una
strada di un'altra provincia. Chiunque abbia bisogno dei tratti fra due incroci deve usare
`l.marks`, precalcolato mentre gli indici erano ancora buoni.

**Gli id dei distretti si ripetono in tutte e tre le città.** `gangnam` a Seoul e `gangnam` a
Busan (Haeundae) sono lo stesso id — è quello che tiene in piedi mercati, mix di popolazione e
salvataggi. Cercare un distretto per chiave dà quindi a un isolato di Haeundae i colori di
Gangnam: dove serve l'oggetto giusto si usa `b.districtRef`, che `korea.js` aggancia sapendo in
quale città sta l'isolato, oppure `city.districtAt(x, y)`.

**Una griglia dinamica che si rialloca ogni frame smette di essere gratis.** `DynamicGrid.clear`
costruiva un array nuovo di `cols × rows`: su Seoul erano 2.400 celle, sul mondo unificato sono
28.000, due volte per frame. Il frame rate è caduto del 60% senza che nessun sistema di gioco
fosse cambiato. Adesso si svuotano solo le celle toccate l'ultima volta.

**Uno slot salvato prima della mappa unica ha coordinate di un'altra mappa.** `3000/2000`
significava «Busan, Seomyeon» e nel mondo nuovo è un cortile di Seoul. Il campo `world`
distingue i due formati: senza, il caricamento riesce e il giocatore ricompare nel posto
sbagliato, che è il modo peggiore di rompersi.

**Il rettangolo di una città non è più un muro.** I collider di confine stanno ai limiti del
mondo, non a quelli di ogni città: si esce da Seoul guidando. Chi assume che il giocatore sia
sempre dentro una regione (`areaAt` può restituire `null`) va corretto, non aggirato.

**Un NPC dentro un fatto non deve spaventarsi.** Ogni sparo chiama `game.alarm`, e `alarm`
mette in fuga chiunque nel raggio: senza saltare chi è in stato `errand` (§5.26), la prima
pallottola di una rapina scioglieva la rapina. Vale anche per il traffico — `p.panic` viene
azzerato per chi ha un compito, come già per la divisa — o un'auto che passa vicino a un
cortile chiudeva una guerra fra bande.

**Chi viene colpito da un NPC scappa; chi viene colpito da te reagisce.** Sono due rami diversi
di `pedestrians.hurt` e vanno tenuti in quest'ordine: prima il giocatore (che rende `hostile`),
poi `errand` (che scrive `p.aggro` e resta nel fatto), poi il panico. Invertendoli, sparare a un
rapinatore non lo faceva più venire verso di te.

**Un sensore lungo il doppio non vede meglio, vede sempre.** Il tastatore di riva delle
imbarcazioni guarda avanti `130 + 0.35 × v` px. A `170 + 0.55 × v` trovava l'altra sponda del
Han — che è largo 300 px — praticamente sempre, e le barche navigavano al 54% della velocità di
crociera scansando una riva che non stava per toccare. La stessa trappola vale per qualunque
raggio di percezione tarato senza guardare quanto è largo lo spazio in cui vive.

**Un veicolo di `life.js` va tolto da chi lo possiede, non solo dalla lista.** `protect = true`
lo salva dallo streaming del traffico, quindi se `life` non lo rimuove da `game.vehicles` resta
lì per il resto della partita. Vale al contrario per il giocatore: se se l'è preso lui
(`driver === 'player'`), non si cancella e non gli si scrive addosso freno a mano e gas — un
frame di volante piantata si sente.

**`this.tmp` non è un posto solo.** `lanePoint` scrive nell'oggetto che gli passi: chi lo usa
come scratch (`roadPointNear`) e chi ci restituisce un punto (`suspectPoint`) devono avere due
oggetti diversi, o il secondo si ritrova le coordinate di una corsia.

**Una lamiera ferma in carreggiata è una corsia chiusa, e la coda arriva a mezzo quartiere.**
L'auto della fuga di una rapina (§5.26) nasceva su un punto di corsia qualunque: il traffico
civile le frena dietro (`senseAhead` non sa che quella non riparte più) e in venti secondi
l'incrocio a monte è bloccato. Adesso si cerca prima uno **stallo vero** fra quelli che il
traffico usa già (`traffic.parkingSpots`, cortili e vicoli — fuori carreggiata per costruzione)
e solo in mancanza di quello si ripiega su un **boulevard**, dove restano tre corsie. Vale per
qualunque cosa si voglia lasciare ferma in strada.

**«Tutti tranne i miei» non è l'elenco dei nemici.** In `life.foes` l'insieme dei bersagli
scritto per esclusione funzionava per l'incursore e per il difensore, e in una rapina — dove il
proprio gruppo *è* `ev.crew` — metteva il complice fra i nemici: con un uomo solo in squadra,
sé stesso. Il sorgente si legge come corretto perché il ramo sbagliato è quello che **manca**.
L'elenco va scritto per ruolo, non per differenza, e chi cerca un bersaglio scarta sé stesso.

**Chi non ha paura delle auto si fa investire.** Azzerare `p.panic` per chi è in `errand` è
obbligatorio (senza, il traffico scioglie ogni evento), ma toglie anche l'unico riflesso che
un pedone ha davanti a una macchina: un rapinatore che attraversa due carreggiate per arrivare
alla vetrina finisce sotto una berlina una volta su tre. La cura non è ridargli il panico, è
**accorciare la strada**: l'auto della fuga si cerca entro 340 px dal negozio, non 520.

**Uno stato non è un posto, nemmeno per le guardie di un territorio.** `startWar` pretendeva
`state === 'guard'` e falliva a caso: basta un'auto che accosta per mandare in `flee` mezzo
cortile, e il ritorno alla ronda è di qualche secondo. È la stessa lezione già pagata da
`canDeal` col 거래책 (§3): si guarda **dov'è**, non come si sente.

**`paused` è diventato una proprietà calcolata, e assegnarla adesso alza un'eccezione.** Dal
§5.27 `game.paused` si ricava dalla modalità (`core/modes.js`). I moduli ES girano in modalità
rigorosa, quindi un `this.paused = false` rimasto in giro non è un no-op: è un `TypeError` che
ferma il frame. Ce n'erano quattro (costruttore, `travelTo`, `toTitle`, `update`) e sono stati
tolti tutti; chi ne aggiunge uno per abitudine se ne accorge solo a run time.

**Il campo della larghezza di una linea stradale si chiama `width`, non `w`.** Scritto `l.w` si
ottiene `undefined`, poi `NaN` sulle coordinate — e un veicolo creato a `NaN` **non alza niente**:
entra nella lista, non si vede, non collide, e le prove che lo cercano per distanza rispondono
«non c'è» invece di «è rotto». Vale per qualunque cosa si posi sul bordo di una carreggiata.

**Un attore che muore mentre sei lontano deve morire lo stesso.** `ActorSystem` ricrea il pedone
di un personaggio ogni volta che torni: se la morte stesse sul **pedone** invece che sulla
definizione, chiunque tu abbia ammazzato sarebbe di nuovo dietro il suo banco al secondo giro. La
morte arriva dal bus (`pedKilled`) e sta sulla definizione. Stessa forma del problema che aveva
`v.spot` con le auto in sosta: lo stato che conta non è dell'oggetto che va e viene.

**`idle` non vuol dire «sta fermo», vuol dire «si è fermato un attimo».** È una sosta con un
timer (`idleT`): scade e il pedone riprende a camminare. Un personaggio nominato nato in `idle`
se ne andava a spasso dopo un secondo — e la prova che lo ha scoperto stava fallendo per il
motivo *sbagliato* (confrontava le coordinate dopo che aveva già camminato), quindi la prima
lettura è stata «asserzione fragile» invece di «bug». Chi deve restare dove lo metti va in
**`post`** (§5.27), che ci torna se lo spostano. La lezione è doppia: leggere cosa fa davvero
uno stato prima di riusarlo, e diffidare di una prova che passa a volte.

**Un personaggio scuro su un fondo scuro non è «poco contrastato»: è invisibile.** Capelli quasi
neri più un contorno di inchiostro, su un vicolo di notte, fanno un buco nella tavola — e nel
sorgente `#15121a` su `#171a21` si legge benissimo come «due colori diversi». Da §5.28 i capelli
non sono mai neri e ogni figura porta un **rim chiaro sempre acceso** (`pixelkit.RIM`), che
funziona da tutte e due le parti: stacca dal nero e si legge come bordo sul grigio. È la stessa
trappola che nei pannelli vettoriali era costata metà tavola, ripresentata su un altro impianto.

**In un pannello che parla, il testo si mangia il terzo centrale.** `speech` disegna in basso e
può arrivare a metà tavola: un personaggio centrato verticalmente finisce **dietro** la propria
battuta. Non si scopre leggendo il codice del pannello, perché lì la figura è centrata e basta.
Da §5.28 c'è `intro.bust()`, che tiene in un posto solo dove finisce un mezzo busto; chi
posiziona una figura a mano in un pannello con `speech` sta per rifare quell'errore.

**Una sagoma che non arriva a terra galleggia.** Le pose disegnate in celle vanno riferite al
**fondo** del riquadro, non alla cima: le sagome inginocchiate del funerale occupavano le righe
10-31 di 50 e restavano sospese venti celle sopra il pavimento, leggendosi come casse. Chi
aggiunge una posa bassa (seduta, a terra, china) parte dal fondo e sale.

**`imageSmoothingEnabled = false` non basta se la scala non è intera.** La pixel art si rovina
in due modi, e uno solo si vede subito: l'interpolazione, e il fatto che con una scala
frazionaria alcuni quadrati escono larghi *n* e altri *n+1*. `pixelkit.unitScale` arrotonda per
difetto apposta, e le destinazioni si arrotondano a intero. Attenzione anche a giudicare uno
screenshot ridimensionato: un pannello perfettamente netto sembra sfocato in anteprima, e si
verifica con `probe.mjs --zoom`.

**Un `id` numerico che passa da JSON torna una stringa, e una `Map` non se ne accorge.**
`shops.sealed` è indicizzata sull'indice della vetrina in `city.shops`; `Object.fromEntries`
lo scrive `"42"` e `new Map(Object.entries(...))` lo rilegge come stringa, quindi
`isSealed(42)` rispondeva **no** e la serranda col sigillo di perizia si riapriva al primo
caricamento. Non si vede in nessuna prova che non passi da un salvataggio e ritorno. Chi
serializza una `Map` con chiavi numeriche le riconverte al ripristino, sempre (§5.29).

**`shops.forceExit` non sposta il giocatore, e fuori da un negozio le coordinate di una pianta
sono in mezzo al mare.** Chiude l'interno e basta: chi lo chiama deve mettere il giocatore da
qualche parte, ed è quello che fa `stepOutside`. Usarlo da solo lascia Jae-min a `(240, 310)`,
cioè nell'angolo nord-ovest della mappa, dove `updateOnFoot` lo fa annegare — e il sintomo che
si vede è tutt'altro (una fase di missione che non risponde più, perché `pl.dying`). Vale per
gli script di prova quanto per il codice (§5.29).

**Chi esce dalla porta di un negozio non diventa «sparito»: diventa un pedone di città.**
`spillOutside` rimette `p.gone = false` e lo passa a `game.pedSystem.peds` (§5.21). Una scena
che aspetta che qualcuno se ne vada non può quindi guardare `gone`: deve guardare se è ancora
in `floor.people`. La rapina di M2 è rimasta appesa esattamente su questo (§5.29).

**Il bancone disegnato dopo la figura le arriva alla fronte.** In un pannello i mobili in primo
piano vanno disegnati **dopo** il fondo e **prima** delle persone che ci stanno dietro. Non si
vede nel sorgente, dove le due chiamate sembrano indipendenti: si vede a schermo, e il sintomo
è un personaggio che diventa un cappello (§5.29).

**Un piano di negozio è chiuso quasi sempre, e una missione ci arriva a qualunque ora.** Il
당구장 apre alle 15, il 술집 alle 17, il 노래방 alle 16: una fase che manda lì il giocatore alle
otto del mattino trova una porta che non si apre e si pianta. Non è un caso limite — è il caso
normale, perché l'ora la decide il giocatore. Si dichiara `shops.hold(shopId)` nel `prepare`
della missione, che è il contrario di `seal` e sta nel salvataggio come lei (§5.29).
